import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "../../supabase-admin";
import { ADMIN_TONE_TOKENS } from "./admin-tone-palette";

const positiveIdSchema = z.number().int().positive();
const seriesStatusSchema = z.enum([
  "published",
  "unpublished",
]);
const expectedRevisionSchema = z.string().trim().datetime({ offset: true });

const updateTopicCategoryInputSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string().trim().min(1),
  parentId: positiveIdSchema.nullable(),
  isActive: z.boolean(),
  colorToken: z.enum(ADMIN_TONE_TOKENS).nullable(),
  actorId: positiveIdSchema,
  expectedUpdatedAt: expectedRevisionSchema,
});

const updateTopicSeriesInputSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string().trim().min(1),
  categoryId: positiveIdSchema,
  status: seriesStatusSchema,
  actorId: positiveIdSchema,
  expectedUpdatedAt: expectedRevisionSchema,
});

const createTopicSeriesInputSchema = z.strictObject({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  categoryId: positiveIdSchema,
  status: seriesStatusSchema,
  actorId: positiveIdSchema,
});

const taxonomyLifecycleInputSchema = z.strictObject({
  ids: z.array(positiveIdSchema).min(1),
  actorId: positiveIdSchema,
});

const categoryMutationRowSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string(),
  slug: z.string(),
  parent_id: positiveIdSchema.nullable(),
  is_active: z.boolean().nullable(),
  status: z.string().nullable(),
  color_token: z.enum(ADMIN_TONE_TOKENS),
  published_at: z.string().nullable(),
  updated_at: expectedRevisionSchema,
});

const seriesMutationRowSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string(),
  slug: z.string(),
  category_id: positiveIdSchema,
  status: seriesStatusSchema,
  deleted_at: z.string().nullable(),
  updated_at: expectedRevisionSchema,
});

const categoryMutationFailureCodeSchema = z.enum([
  "invalid_input",
  "unauthorized_actor",
  "not_found",
  "revision_conflict",
  "parent_unavailable",
  "hierarchy_cycle",
]);
const seriesMutationFailureCodeSchema = z.enum([
  "invalid_input",
  "unauthorized_actor",
  "not_found",
  "revision_conflict",
  "category_unavailable",
  "series_category_conflict",
]);
const createSeriesMutationFailureCodeSchema = z.enum([
  "invalid_input",
  "unauthorized_actor",
  "category_unavailable",
]);

const updateTopicCategoryResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    code: z.literal("updated"),
    category: categoryMutationRowSchema,
    topics_updated: z.coerce.number().int().nonnegative().finite(),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: categoryMutationFailureCodeSchema,
  }),
]);

const updateTopicSeriesResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    code: z.literal("updated"),
    series: seriesMutationRowSchema,
    topics_updated: z.coerce.number().int().nonnegative().finite(),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: seriesMutationFailureCodeSchema,
  }),
]);

const createTopicSeriesResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    code: z.literal("created"),
    series: seriesMutationRowSchema.extend({
      created_at: expectedRevisionSchema,
    }),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: createSeriesMutationFailureCodeSchema,
  }),
]);

const taxonomyLifecycleResultSchema = z.strictObject({
  affected_ids: z.array(positiveIdSchema).min(1),
  affected_count: z.coerce.number().int().positive().finite(),
});

export type UpdateTopicCategoryAtomicInput = z.input<
  typeof updateTopicCategoryInputSchema
>;
export type UpdateTopicSeriesAtomicInput = z.input<
  typeof updateTopicSeriesInputSchema
>;
export type CreateTopicSeriesAtomicInput = z.input<
  typeof createTopicSeriesInputSchema
>;
export type TaxonomyLifecycleAtomicInput = z.input<
  typeof taxonomyLifecycleInputSchema
>;

export type UpdateTopicCategoryAtomicResult = z.output<
  typeof updateTopicCategoryResultSchema
>;
export type UpdateTopicSeriesAtomicResult = z.output<
  typeof updateTopicSeriesResultSchema
>;
export type CreateTopicSeriesAtomicResult = z.output<
  typeof createTopicSeriesResultSchema
>;
export type TaxonomyLifecycleAtomicResult = z.output<
  typeof taxonomyLifecycleResultSchema
>;

type SupabaseRpcError = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export class TaxonomyMutationDatabaseError extends Error {
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(error: SupabaseRpcError) {
    super(error.message);
    this.name = "TaxonomyMutationDatabaseError";
    this.code = error.code ?? null;
    this.details = error.details ?? null;
    this.hint = error.hint ?? null;
  }
}

export async function updateTopicCategoryAtomically(
  input: UpdateTopicCategoryAtomicInput,
): Promise<UpdateTopicCategoryAtomicResult> {
  const parsed = updateTopicCategoryInputSchema.parse(input);
  const { data, error } = await getSupabaseAdmin().rpc(
    "admin_update_topic_category",
    {
      p_category_id: parsed.id,
      p_name: parsed.name,
      // PostgreSQL function arguments are nullable at runtime, but Supabase's
      // generated Args shape cannot encode that metadata for required args.
      p_parent_id: parsed.parentId as number,
      p_is_active: parsed.isActive,
      p_color_token: parsed.colorToken as string,
      p_actor_id: parsed.actorId,
      p_expected_updated_at: parsed.expectedUpdatedAt,
    },
  );
  if (error) throw new TaxonomyMutationDatabaseError(error);
  return updateTopicCategoryResultSchema.parse(data);
}

export async function updateTopicSeriesAtomically(
  input: UpdateTopicSeriesAtomicInput,
): Promise<UpdateTopicSeriesAtomicResult> {
  const parsed = updateTopicSeriesInputSchema.parse(input);
  const { data, error } = await getSupabaseAdmin().rpc(
    "admin_update_topic_series",
    {
      p_series_id: parsed.id,
      p_name: parsed.name,
      p_category_id: parsed.categoryId,
      p_status: parsed.status,
      p_actor_id: parsed.actorId,
      p_expected_updated_at: parsed.expectedUpdatedAt,
    },
  );
  if (error) throw new TaxonomyMutationDatabaseError(error);
  return updateTopicSeriesResultSchema.parse(data);
}

export async function createTopicSeriesAtomically(
  input: CreateTopicSeriesAtomicInput,
): Promise<CreateTopicSeriesAtomicResult> {
  const parsed = createTopicSeriesInputSchema.parse(input);
  const { data, error } = await getSupabaseAdmin().rpc(
    "admin_create_topic_series",
    {
      p_name: parsed.name,
      p_slug: parsed.slug,
      p_category_id: parsed.categoryId,
      p_status: parsed.status,
      p_actor_id: parsed.actorId,
    },
  );
  if (error) throw new TaxonomyMutationDatabaseError(error);
  return createTopicSeriesResultSchema.parse(data);
}

type TaxonomyLifecycleMutation =
  | {
      rpcName:
        | "admin_move_topic_categories_to_trash"
        | "admin_restore_topic_categories"
        | "admin_permanently_delete_topic_categories";
      idParameter: "p_category_ids";
    }
  | {
      rpcName:
        | "admin_move_topic_series_to_trash"
        | "admin_restore_topic_series"
        | "admin_permanently_delete_topic_series";
      idParameter: "p_series_ids";
    };

async function runTaxonomyLifecycleMutation(
  mutation: TaxonomyLifecycleMutation,
  input: TaxonomyLifecycleAtomicInput,
): Promise<TaxonomyLifecycleAtomicResult> {
  const parsed = taxonomyLifecycleInputSchema.parse(input);
  const ids = [...new Set(parsed.ids)];
  const { rpcName, idParameter } = mutation;
  const result = idParameter === "p_category_ids"
    ? await getSupabaseAdmin().rpc(rpcName, {
        p_category_ids: ids,
        p_actor_id: parsed.actorId,
      })
    : await getSupabaseAdmin().rpc(rpcName, {
        p_series_ids: ids,
        p_actor_id: parsed.actorId,
      });
  if (result.error) throw new TaxonomyMutationDatabaseError(result.error);
  const parsedResult = taxonomyLifecycleResultSchema.parse(result.data);
  if (
    parsedResult.affected_count !== ids.length ||
    parsedResult.affected_ids.length !== ids.length
  ) {
    throw new Error("taxonomy lifecycle mutation returned a partial result");
  }
  return parsedResult;
}

export function moveTopicCategoriesToTrashAtomically(
  input: TaxonomyLifecycleAtomicInput,
) {
  return runTaxonomyLifecycleMutation(
    {
      rpcName: "admin_move_topic_categories_to_trash",
      idParameter: "p_category_ids",
    },
    input,
  );
}

export function restoreTopicCategoriesAtomically(
  input: TaxonomyLifecycleAtomicInput,
) {
  return runTaxonomyLifecycleMutation(
    {
      rpcName: "admin_restore_topic_categories",
      idParameter: "p_category_ids",
    },
    input,
  );
}

export function permanentlyDeleteTopicCategoriesAtomically(
  input: TaxonomyLifecycleAtomicInput,
) {
  return runTaxonomyLifecycleMutation(
    {
      rpcName: "admin_permanently_delete_topic_categories",
      idParameter: "p_category_ids",
    },
    input,
  );
}

export function moveTopicSeriesToTrashAtomically(
  input: TaxonomyLifecycleAtomicInput,
) {
  return runTaxonomyLifecycleMutation(
    {
      rpcName: "admin_move_topic_series_to_trash",
      idParameter: "p_series_ids",
    },
    input,
  );
}

export function restoreTopicSeriesAtomically(
  input: TaxonomyLifecycleAtomicInput,
) {
  return runTaxonomyLifecycleMutation(
    {
      rpcName: "admin_restore_topic_series",
      idParameter: "p_series_ids",
    },
    input,
  );
}

export function permanentlyDeleteTopicSeriesAtomically(
  input: TaxonomyLifecycleAtomicInput,
) {
  return runTaxonomyLifecycleMutation(
    {
      rpcName: "admin_permanently_delete_topic_series",
      idParameter: "p_series_ids",
    },
    input,
  );
}
