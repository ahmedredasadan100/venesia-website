import { z } from "zod";

import type { BoundedPublicCacheRevalidationResult } from "../../cache/revalidate-public-cache-tags";
import { TOPICS_LIST_MAX_PAGE_SIZE } from "./topics-list-config";

export const TOPICS_BULK_PUBLISH_MAX_ITEMS = TOPICS_LIST_MAX_PAGE_SIZE;

const POSITIVE_INTEGER_TEXT = /^[1-9]\d*$/;
const positiveTopicIdSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

function createSortedUniqueTopicIdsSchema(minimumItems: 0 | 1) {
  return z
    .array(positiveTopicIdSchema)
    .min(minimumItems)
    .max(TOPICS_BULK_PUBLISH_MAX_ITEMS)
    .superRefine((ids, context) => {
      const seen = new Set<number>();
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index];
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            message: "topic IDs must be unique",
            path: [index],
          });
        }
        seen.add(id);
        if (index > 0 && ids[index - 1] >= id) {
          context.addIssue({
            code: "custom",
            message: "topic IDs must be sorted in ascending order",
            path: [index],
          });
        }
      }
    });
}

const requestedTopicIdsSchema = createSortedUniqueTopicIdsSchema(1);
const optionalTopicIdsSchema = createSortedUniqueTopicIdsSchema(0);
const affectedTopicIdsSchema = createSortedUniqueTopicIdsSchema(1);
const auditIdsSchema = z
  .array(positiveTopicIdSchema)
  .max(TOPICS_BULK_PUBLISH_MAX_ITEMS)
  .superRefine((ids, context) => {
    const seen = new Set<number>();
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (seen.has(id)) {
        context.addIssue({
          code: "custom",
          message: "auditIds must be unique",
          path: [index],
        });
      }
      seen.add(id);
    }
  });

const publishedRpcResultSchema = z
  .strictObject({
    ok: z.literal(true),
    code: z.literal("published"),
    requestedIds: requestedTopicIdsSchema,
    publishedIds: optionalTopicIdsSchema,
    alreadyPublishedIds: optionalTopicIdsSchema,
    committedAt: z.string().datetime({ offset: true }),
    auditIds: auditIdsSchema,
  })
  .superRefine((result, context) => {
    const resolvedIds = [
      ...result.publishedIds,
      ...result.alreadyPublishedIds,
    ].sort((left, right) => left - right);
    if (
      resolvedIds.length !== result.requestedIds.length ||
      resolvedIds.some((id, index) => id !== result.requestedIds[index])
    ) {
      context.addIssue({
        code: "custom",
        message:
          "publishedIds and alreadyPublishedIds must partition requestedIds",
        path: ["requestedIds"],
      });
    }
    if (result.auditIds.length !== result.publishedIds.length) {
      context.addIssue({
        code: "custom",
        message: "auditIds must match the newly published Topics",
        path: ["auditIds"],
      });
    }
  });

const topicsBulkPublishRpcResultSchema = z.discriminatedUnion("code", [
  publishedRpcResultSchema,
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("invalid_input"),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("batch_limit"),
    limit: z.literal(TOPICS_BULK_PUBLISH_MAX_ITEMS),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("duplicate_ids"),
    duplicateIds: affectedTopicIdsSchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("missing_topics"),
    topicIds: affectedTopicIdsSchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("deleted_topics"),
    topicIds: affectedTopicIdsSchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("unauthorized_actor"),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.literal("revision_conflict"),
    topicIds: affectedTopicIdsSchema,
  }),
]);

export type TopicsBulkPublishRpcResult = z.output<
  typeof topicsBulkPublishRpcResultSchema
>;

export type TopicsBulkPublishExpectedRevision = {
  id: number;
  expected_updated_at: string;
};

export type TopicsBulkPublishIdsResult =
  | { ok: true; ids: number[] }
  | { ok: false; code: "invalid_input" }
  | { ok: false; code: "duplicate_ids"; duplicateIds: number[] }
  | {
      ok: false;
      code: "batch_limit";
      limit: typeof TOPICS_BULK_PUBLISH_MAX_ITEMS;
    };

export function parseTopicsBulkPublishIds(
  values: readonly unknown[],
): TopicsBulkPublishIdsResult {
  if (values.length === 0) return { ok: false, code: "invalid_input" };
  if (values.length > TOPICS_BULK_PUBLISH_MAX_ITEMS) {
    return {
      ok: false,
      code: "batch_limit",
      limit: TOPICS_BULK_PUBLISH_MAX_ITEMS,
    };
  }

  const ids: number[] = [];
  const seen = new Set<number>();
  const duplicateIds = new Set<number>();
  for (const value of values) {
    if (typeof value !== "string" || !POSITIVE_INTEGER_TEXT.test(value)) {
      return { ok: false, code: "invalid_input" };
    }
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return { ok: false, code: "invalid_input" };
    }
    if (seen.has(id)) duplicateIds.add(id);
    else ids.push(id);
    seen.add(id);
  }

  if (duplicateIds.size > 0) {
    return {
      ok: false,
      code: "duplicate_ids",
      duplicateIds: [...duplicateIds].sort((left, right) => left - right),
    };
  }
  return { ok: true, ids: ids.sort((left, right) => left - right) };
}

export function parseTopicsBulkPublishRpcResult(
  value: unknown,
): TopicsBulkPublishRpcResult {
  return topicsBulkPublishRpcResultSchema.parse(value);
}

export type TopicsBulkPublishSafeMetadata = {
  topic_ids: number[];
  count: number;
  correlation_id: string;
};

export function createTopicsBulkPublishSafeMetadata(
  topicIds: readonly number[],
  correlationId: string,
): TopicsBulkPublishSafeMetadata {
  return {
    topic_ids: [...topicIds],
    count: topicIds.length,
    correlation_id: correlationId,
  };
}

export type TopicsBulkPublishPostCommitDependencies = {
  cacheInvalidations: readonly {
    name: string;
    run: () => void | Promise<void>;
  }[];
  runCacheInvalidation: (
    revalidate: () => void | Promise<void>,
  ) => Promise<BoundedPublicCacheRevalidationResult>;
  logError: (
    message: string,
    error: unknown,
    metadata: TopicsBulkPublishSafeMetadata,
  ) => void;
};

export type TopicsBulkPublishPostCommitResult =
  | {
      feedbackStatus: "success";
      code: "published";
      failedCacheOperations: [];
    }
  | {
      feedbackStatus: "warning";
      code: "committed_cache_revalidation_pending";
      correlationId: string;
      failedCacheOperations: [string, ...string[]];
    };

function logPostCommitFailure(
  dependencies: TopicsBulkPublishPostCommitDependencies,
  message: string,
  error: unknown,
  metadata: TopicsBulkPublishSafeMetadata,
) {
  try {
    dependencies.logError(message, error, metadata);
  } catch {
    // Post-commit diagnostics must never turn a committed publish into failure.
  }
}

export async function runTopicsBulkPublishPostCommit(
  metadata: TopicsBulkPublishSafeMetadata,
  dependencies: TopicsBulkPublishPostCommitDependencies,
): Promise<TopicsBulkPublishPostCommitResult> {
  const failedCacheOperations: string[] = [];

  for (const invalidation of dependencies.cacheInvalidations) {
    const result = await dependencies.runCacheInvalidation(invalidation.run);
    if (!result.ok) {
      failedCacheOperations.push(invalidation.name);
      logPostCommitFailure(
        dependencies,
        `Topics bulk publish cache invalidation remained pending after ${result.attempts} attempts: ${invalidation.name}`,
        result.error,
        metadata,
      );
    }
  }

  if (failedCacheOperations.length > 0) {
    return {
      feedbackStatus: "warning",
      code: "committed_cache_revalidation_pending",
      correlationId: metadata.correlation_id,
      failedCacheOperations: failedCacheOperations as [string, ...string[]],
    };
  }
  return {
    feedbackStatus: "success",
    code: "published",
    failedCacheOperations: [],
  };
}
