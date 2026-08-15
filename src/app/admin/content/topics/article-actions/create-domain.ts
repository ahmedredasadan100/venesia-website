import "server-only";

import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { buildTopicWritePayload, type TopicPayload } from "./helpers";
import type { CategoryRow, SeriesRow, TopicStatus } from "./types";

export class ArticleSlugConflictError extends Error {
  readonly slug: string;

  constructor(slug: string, options?: ErrorOptions) {
    super(`Article slug already exists: ${slug}`, options);
    this.name = "ArticleSlugConflictError";
    this.slug = slug;
  }
}

function isSlugUniqueViolation(error: {
  code?: string;
  message?: string;
  details?: string;
} | null) {
  if (!error || error.code !== "23505") return false;
  return /topics_slug_key|\bslug\b/i.test(
    `${error.message ?? ""} ${error.details ?? ""}`,
  );
}

export function createArticleDomainRecord(input: {
  payload: TopicPayload;
  category: CategoryRow;
  series: SeriesRow | null;
  status: TopicStatus;
  actorId: number;
  now: string;
  requestIdentity: string;
}) {
  const writePayload = buildTopicWritePayload(
    input.payload,
    input.category,
    input.series,
    input.status,
    input.now,
  );
  const leaseEntityIdentity = `create:${crypto.randomUUID()}`;

  return coordinateMediaReferenceEntityMutation({
    domainKey: "topics",
    leaseEntityIdentity,
    intendedRow: writePayload,
    actorId: input.actorId,
    requestIdentity: input.requestIdentity,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("topics")
        .insert({
          ...writePayload,
          created_at: input.now,
          created_by: input.actorId,
          updated_by: input.actorId,
          published_by: input.status === "published" ? input.actorId : null,
        })
        .select("id, slug")
        .single();

      if (isSlugUniqueViolation(error)) {
        throw new ArticleSlugConflictError(input.payload.slug, {
          cause: error,
        });
      }
      if (error || !data) {
        throw new Error(
          error?.message ?? "تعذر إنشاء الموضوع. راجع قاعدة البيانات.",
          { cause: error ?? undefined },
        );
      }
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
}
