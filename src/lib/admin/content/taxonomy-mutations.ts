import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "../../supabase-admin";
import { ADMIN_TONE_TOKENS } from "./admin-tone-palette";

const positiveIdSchema = z.number().int().positive();
const seriesStatusSchema = z.enum([
  "draft",
  "published",
  "unpublished",
  "archived",
]);

const updateTopicCategoryInputSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string().trim().min(1),
  parentId: positiveIdSchema.nullable(),
  isActive: z.boolean(),
  colorToken: z.enum(ADMIN_TONE_TOKENS).nullable(),
  actorId: positiveIdSchema,
});

const updateTopicSeriesInputSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string().trim().min(1),
  categoryId: positiveIdSchema,
  status: seriesStatusSchema,
  actorId: positiveIdSchema,
});

const deleteTopicCategoryInputSchema = z.strictObject({
  id: positiveIdSchema,
  transferToId: positiveIdSchema.nullable(),
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
  updated_at: z.string().nullable(),
});

const seriesMutationRowSchema = z.strictObject({
  id: positiveIdSchema,
  name: z.string(),
  slug: z.string(),
  category_id: positiveIdSchema,
  status: seriesStatusSchema,
  deleted_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

const updateTopicCategoryResultSchema = z.strictObject({
  category: categoryMutationRowSchema,
  topics_updated: z.coerce.number().int().nonnegative().finite(),
});

const updateTopicSeriesResultSchema = z.strictObject({
  series: seriesMutationRowSchema,
  topics_updated: z.coerce.number().int().nonnegative().finite(),
});

const deleteTopicCategoryResultSchema = z.strictObject({
  deleted_category_id: positiveIdSchema,
  transfer_to_id: positiveIdSchema.nullable(),
  topics_updated: z.coerce.number().int().nonnegative().finite(),
});

export type UpdateTopicCategoryAtomicInput = z.input<
  typeof updateTopicCategoryInputSchema
>;
export type UpdateTopicSeriesAtomicInput = z.input<
  typeof updateTopicSeriesInputSchema
>;
export type DeleteTopicCategoryAtomicInput = z.input<
  typeof deleteTopicCategoryInputSchema
>;

export type UpdateTopicCategoryAtomicResult = z.output<
  typeof updateTopicCategoryResultSchema
>;
export type UpdateTopicSeriesAtomicResult = z.output<
  typeof updateTopicSeriesResultSchema
>;
export type DeleteTopicCategoryAtomicResult = z.output<
  typeof deleteTopicCategoryResultSchema
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
      p_parent_id: parsed.parentId,
      p_is_active: parsed.isActive,
      p_color_token: parsed.colorToken,
      p_actor_id: parsed.actorId,
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
    },
  );
  if (error) throw new TaxonomyMutationDatabaseError(error);
  return updateTopicSeriesResultSchema.parse(data);
}

export async function deleteTopicCategoryAtomically(
  input: DeleteTopicCategoryAtomicInput,
): Promise<DeleteTopicCategoryAtomicResult> {
  const parsed = deleteTopicCategoryInputSchema.parse(input);
  const { data, error } = await getSupabaseAdmin().rpc(
    "admin_delete_topic_category",
    {
      p_category_id: parsed.id,
      p_transfer_to_id: parsed.transferToId,
      p_actor_id: parsed.actorId,
    },
  );
  if (error) throw new TaxonomyMutationDatabaseError(error);
  return deleteTopicCategoryResultSchema.parse(data);
}
