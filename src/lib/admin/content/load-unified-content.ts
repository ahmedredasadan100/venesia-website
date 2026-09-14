import "server-only";

import { ENTITY_SEO_SCORE_VERSION } from "../seo-score";
import { z } from "zod";
import type { Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  getCategoryAndDescendantIds,
  type AdminContentCategory,
} from "./category-hierarchy";
import { isContentType, type ContentType } from "./content-types";

export {
  TOPICS_LIST_VIEW_KEY as CONTENT_LIST_VIEW_KEY,
} from "./topics-list-config";

export const CONTENT_SORT_VALUES = [
  "id_asc",
  "id_desc",
  "title_asc",
  "title_desc",
  "content_type_asc",
  "content_type_desc",
  "category_asc",
  "category_desc",
  "series_asc",
  "series_desc",
  "featured_asc",
  "featured_desc",
  "seo_asc",
  "seo_desc",
  "views_asc",
  "views_desc",
  "created_at_asc",
  "created_at_desc",
  "updated_at_asc",
  "updated_at_desc",
  "created_by_asc",
  "created_by_desc",
  "status_asc",
  "status_desc",
] as const;

export type ContentSortValue = (typeof CONTENT_SORT_VALUES)[number];
export type UnifiedContentFilters = {
  q: string;
  view: "active" | "trash";
  contentType: ContentType | "all";
  categoryId: number | null;
  seriesId: number | "any" | null;
  status: string | "all";
  featured: "yes" | "no" | "all";
  image: "without" | "all";
  sort: ContentSortValue;
  page: number;
  pageSize: number;
};

export type UnifiedContentRow = {
  id: number;
  title: string | null;
  content_type: ContentType;
  category_id: number | null;
  category_name: string | null;
  category_color_token: string | null;
  series_id: number | null;
  series_name: string | null;
  status: string | null;
  is_featured: boolean | null;
  seo_score: number;
  views_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_by_display: string | null;
  updated_by_display: string | null;
  published_by_display: string | null;
  deleted_at: string | null;
};

export type UnifiedContentListResult = {
  rows: UnifiedContentRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

type UnifiedContentListDatabaseRow = Pick<
  Tables<"admin_content_topics">,
  keyof UnifiedContentRow | "seo_score_version"
>;

function toUnifiedContentRow(source: UnifiedContentListDatabaseRow): UnifiedContentRow | null {
  const { seo_score_version, ...row } = source;
  if (source.id === null || !isContentType(source.content_type)
    || seo_score_version !== ENTITY_SEO_SCORE_VERSION
    || source.seo_score === null || !Number.isInteger(source.seo_score)
    || source.seo_score < 0 || source.seo_score > 100) return null;
  return { ...row, id: source.id, content_type: source.content_type, seo_score: source.seo_score };
}

export type ContentListSearchParams = {
  q?: string;
  view?: string;
  content_type?: string;
  category?: string;
  series?: string;
  status?: string;
  featured?: string;
  image?: string;
  sort?: string;
  page?: string;
  limit?: string;
};

export function cleanContentTitleSearch(value?: string | null) {
  return (value ?? "")
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface UnifiedContentFilterQuery {
  not(column: "deleted_at" | "series_id", operator: "is", value: null): this;
  is(column: "deleted_at", value: null): this;
  ilike(column: "title", pattern: string): this;
  eq(column: "content_type", value: ContentType): this;
  eq(column: "series_id", value: number): this;
  eq(column: "status", value: string): this;
  eq(column: "is_featured", value: boolean): this;
  in(column: "category_id", values: readonly number[]): this;
  or(filter: string): this;
}

function applyFilters<Query extends UnifiedContentFilterQuery>(
  query: Query,
  filters: UnifiedContentFilters,
  categories: AdminContentCategory[],
): Query {
  let next = filters.view === "trash"
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);

  for (const word of filters.q.split(" ").filter(Boolean)) {
    next = next.ilike("title", `%${word}%`);
  }

  if (filters.contentType !== "all") next = next.eq("content_type", filters.contentType);
  if (filters.categoryId) {
    next = next.in(
      "category_id",
      getCategoryAndDescendantIds(categories, filters.categoryId),
    );
  }
  if (filters.seriesId === "any") next = next.not("series_id", "is", null);
  else if (filters.seriesId) next = next.eq("series_id", filters.seriesId);
  if (filters.status !== "all") next = next.eq("status", filters.status);
  if (filters.featured === "yes") next = next.eq("is_featured", true);
  if (filters.featured === "no") next = next.eq("is_featured", false);
  if (filters.image === "without") next = next.or("image.is.null,image.eq.");

  return next;
}

type UnifiedContentSortColumn =
  | "id"
  | "seo_score"
  | "title"
  | "content_type"
  | "category_name"
  | "series_name"
  | "is_featured"
  | "views_count"
  | "created_at"
  | "updated_at"
  | "created_by_display"
  | "status";

interface UnifiedContentSortQuery {
  order(
    column: UnifiedContentSortColumn,
    options: { ascending: boolean; nullsFirst?: boolean },
  ): this;
}

function applySort<Query extends UnifiedContentSortQuery>(
  query: Query,
  sort: ContentSortValue,
): Query {
  const sortMap: Record<
    ContentSortValue,
    { column: UnifiedContentSortColumn; ascending: boolean }
  > = {
    seo_asc: { column: "seo_score", ascending: true },
    seo_desc: { column: "seo_score", ascending: false },
    id_asc: { column: "id", ascending: true },
    id_desc: { column: "id", ascending: false },
    title_asc: { column: "title", ascending: true },
    title_desc: { column: "title", ascending: false },
    content_type_asc: { column: "content_type", ascending: true },
    content_type_desc: { column: "content_type", ascending: false },
    category_asc: { column: "category_name", ascending: true },
    category_desc: { column: "category_name", ascending: false },
    series_asc: { column: "series_name", ascending: true },
    series_desc: { column: "series_name", ascending: false },
    featured_asc: { column: "is_featured", ascending: true },
    featured_desc: { column: "is_featured", ascending: false },
    views_asc: { column: "views_count", ascending: true },
    views_desc: { column: "views_count", ascending: false },
    created_at_asc: { column: "created_at", ascending: true },
    created_at_desc: { column: "created_at", ascending: false },
    updated_at_asc: { column: "updated_at", ascending: true },
    updated_at_desc: { column: "updated_at", ascending: false },
    created_by_asc: { column: "created_by_display", ascending: true },
    created_by_desc: { column: "created_by_display", ascending: false },
    status_asc: { column: "status", ascending: true },
    status_desc: { column: "status", ascending: false },
  };
  const selected = sortMap[sort];
  const sorted = query.order(selected.column, {
    ascending: selected.ascending,
    nullsFirst: false,
  });
  return selected.column === "id"
    ? sorted
    : sorted.order("id", { ascending: true });
}

const CONTENT_LIST_SELECT =
  "id,title,content_type,category_id,category_name,category_color_token,series_id,series_name,status,is_featured,seo_score,seo_score_version,views_count,created_at,updated_at,published_at,created_by_display,updated_by_display,published_by_display,deleted_at";

export async function loadUnifiedContentList(
  filters: UnifiedContentFilters,
  categories: AdminContentCategory[],
): Promise<UnifiedContentListResult> {
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await applyFilters(
    supabase.from("admin_content_topics").select("id", { count: "exact", head: true }),
    filters, categories,
  );
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const result = { totalCount, page, pageSize: filters.pageSize, totalPages };
  if (countError) return { ...result, rows: [], error: countError.message };

  const from = (page - 1) * filters.pageSize;
  const { data, error } = await applySort(
    applyFilters(supabase.from("admin_content_topics").select(CONTENT_LIST_SELECT), filters, categories),
    filters.sort,
  ).range(from, from + filters.pageSize - 1);
  if (error) return { ...result, rows: [], error: error.message };
  const rows = (data ?? []).map(toUnifiedContentRow);
  if (rows.some((row) => row === null)) {
    return { ...result, rows: [], error: "درجات SEO المحفوظة للموضوعات غير مكتملة أو غير محدثة." };
  }
  return { ...result, rows: rows as UnifiedContentRow[], error: null };
}

const contentMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  trashed: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  unpublished: z.number().int().nonnegative(),
  withoutImage: z.number().int().nonnegative(),
  withSeries: z.number().int().nonnegative(),
  featured: z.number().int().nonnegative(),
  seoAverage: z.number().int().min(0).max(100),
  staleScores: z.number().int().nonnegative(),
});

export async function loadUnifiedContentMetrics() {
  const { data, error } = await getSupabaseAdmin().rpc("admin_content_topic_metrics", {
    p_seo_score_version: ENTITY_SEO_SCORE_VERSION,
  });
  const parsed = contentMetricsSchema.safeParse(data);
  const empty = { total: 0, trashed: 0, published: 0, unpublished: 0, withoutImage: 0, withSeries: 0, featured: 0, seoAverage: 0 };
  if (error || !parsed.success) {
    return { ...empty, error: error?.message ?? "تعذر قراءة إحصاءات الموضوعات." };
  }
  const { staleScores, ...metrics } = parsed.data;
  if (staleScores > 0) {
    return { ...empty, error: "درجات SEO المحفوظة للموضوعات غير مكتملة أو غير محدثة." };
  }
  return { ...metrics, error: null };
}
