import "server-only";

import { z } from "zod";

import {
  buildAdminCategoryFilterModel,
  type AdminContentCategory,
} from "./category-hierarchy";
import { loadActiveSeriesTopicCounts } from "./series-topic-counts";
import { getSupabaseAdmin } from "../../supabase-admin";

export const seriesListRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  status: z.string().nullable(),
  sort_order: z.number().nullable(),
  category_id: z.number().int().positive().nullable(),
  category_name: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  topics_count: z.number().int().nonnegative(),
});

export type SeriesListRow = z.infer<typeof seriesListRowSchema>;

export async function loadSeriesListData() {
  const [
    { data: seriesRows, error: seriesError },
    { counts, error: topicError },
    { data: categoryRows, error: categoryError },
  ] = await Promise.all([
    getSupabaseAdmin()
      .from("topic_series")
      .select(
        "id, name, slug, status, sort_order, category_id, created_at, updated_at, deleted_at",
      )
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: false }),
    loadActiveSeriesTopicCounts(),
    getSupabaseAdmin()
      .from("topic_categories")
      .select("id, name, slug, parent_id, sort_order, is_active")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (seriesError) throw new Error(seriesError.message);
  if (topicError) throw new Error(topicError.message);
  if (categoryError) throw new Error(categoryError.message);

  const categories: AdminContentCategory[] = categoryRows ?? [];
  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const rows: SeriesListRow[] = (seriesRows ?? []).map((series) => ({
    ...series,
    category_name: series.category_id
      ? (categoryNameById.get(series.category_id) ?? null)
      : null,
    topics_count: counts.get(series.id) ?? 0,
  }));

  return {
    rows,
    categoryFilterModel: buildAdminCategoryFilterModel(categories),
    metrics: {
      total: rows.length,
      published: rows.filter((row) => row.status === "published").length,
      topics: rows.reduce((total, row) => total + row.topics_count, 0),
    },
  };
}
