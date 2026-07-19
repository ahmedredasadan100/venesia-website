import "server-only";

import { z } from "zod";

import {
  loadUnifiedContentList,
  type UnifiedContentRow,
} from "../load-unified-content";
import {
  topicsQueryContract,
  type TopicFilters,
  type TopicSortField,
} from "../entity-list-contracts/topics";
import type { AdminContentCategory } from "../category-hierarchy";
import { getSupabaseAdmin } from "../../../supabase-admin";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../../entity-list/data-engine/contracts";
import type { AdminEntityListAdapter } from "../../entity-list/data-engine/adapter";

const topicRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().nullable(),
  content_type: z.enum([
    "article",
    "news",
    "press",
    "site_update",
    "video",
    "gallery",
  ]),
  category_id: z.number().int().positive().nullable(),
  category_name: z.string().nullable(),
  category_color_token: z.string().nullable(),
  series_id: z.number().int().positive().nullable(),
  series_name: z.string().nullable(),
  status: z.string().nullable(),
  is_featured: z.boolean().nullable(),
  views_count: z.number().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  published_at: z.string().nullable(),
  created_by_display: z.string().nullable(),
  updated_by_display: z.string().nullable(),
  published_by_display: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export async function loadTopicsEntityListResult(
  query: AdminEntityListQuery<TopicFilters, TopicSortField>,
  providedCategories?: AdminContentCategory[],
) {
  let categories = providedCategories;
  if (!categories) {
    const { data, error: categoriesError } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id,name,slug,parent_id,sort_order,is_active,color_token")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (categoriesError) throw new Error(categoriesError.message);
    categories = (data ?? []) as AdminContentCategory[];
  }

  const list = await loadUnifiedContentList(
    {
      q: query.search,
      contentType: query.filters.contentType,
      categoryId: query.filters.categoryId,
      seriesId: query.filters.seriesId,
      status: query.filters.status,
      featured: query.filters.featured,
      sort: `${query.sort.field}_${query.sort.direction}`,
      page: query.page,
      pageSize: query.pageSize,
    },
    categories,
  );
  if (list.error) throw new Error(list.error);

  return {
    rows: list.rows,
    pagination: {
      page: list.page,
      pageSize: list.pageSize,
      totalRows: list.totalCount,
      totalPages: list.totalPages,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: query.mode,
    },
  };
}

export const topicsEntityListAdapter: AdminEntityListAdapter<
  "topics",
  TopicFilters,
  TopicSortField,
  UnifiedContentRow
> = {
  entity: "topics",
  queryContract: topicsQueryContract,
  resultSchema: createAdminEntityListResultSchema(topicRowSchema),
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadTopicsEntityListResult,
};
