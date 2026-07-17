import "server-only";

import { analyzeTopicSeo } from "../seo-score";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  getCategoryAndDescendantIds,
  type AdminContentCategory,
} from "./category-hierarchy";
import { isContentType, type ContentType } from "./content-types";

export const CONTENT_LIST_VIEW_KEY = "content-topics";
export const CONTENT_LIST_PAGE_SIZES = [10, 20, 30, 50] as const;
export const DEFAULT_CONTENT_LIST_PAGE_SIZE = 10;

export const CONTENT_SORT_VALUES = [
  "id_asc",
  "id_desc",
  "title_asc",
  "title_desc",
  "category_asc",
  "category_desc",
  "views_asc",
  "views_desc",
  "created_at_asc",
  "created_at_desc",
  "updated_at_asc",
  "updated_at_desc",
  "created_by_asc",
  "created_by_desc",
] as const;

export type ContentSortValue = (typeof CONTENT_SORT_VALUES)[number];

const CONTENT_SORT_SET = new Set<string>(CONTENT_SORT_VALUES);
const STATUS_VALUES = new Set(["published", "draft", "unpublished", "archived"]);
const FEATURED_VALUES = new Set(["yes", "no"]);

export type UnifiedContentFilters = {
  q: string;
  contentType: ContentType | "all";
  categoryId: number | null;
  seriesId: number | null;
  status: string | "all";
  featured: "yes" | "no" | "all";
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
  views_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_by_display: string | null;
  updated_by_display: string | null;
  published_by_display: string | null;
};

export type UnifiedContentListResult = {
  rows: UnifiedContentRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

export type ContentListSearchParams = {
  q?: string;
  content_type?: string;
  category?: string;
  series?: string;
  status?: string;
  featured?: string;
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

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getOptionalId(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeUnifiedContentFilters(
  params?: ContentListSearchParams,
): UnifiedContentFilters {
  const rawType = params?.content_type;
  const rawStatus = params?.status;
  const rawFeatured = params?.featured;
  const rawSort = params?.sort;
  const requestedPageSize = getPositiveInteger(params?.limit, DEFAULT_CONTENT_LIST_PAGE_SIZE);

  return {
    q: cleanContentTitleSearch(params?.q),
    contentType: isContentType(rawType) ? rawType : "all",
    categoryId: getOptionalId(params?.category),
    seriesId: getOptionalId(params?.series),
    status: rawStatus && STATUS_VALUES.has(rawStatus) ? rawStatus : "all",
    featured:
      rawFeatured && FEATURED_VALUES.has(rawFeatured)
        ? (rawFeatured as "yes" | "no")
        : "all",
    sort:
      rawSort && CONTENT_SORT_SET.has(rawSort)
        ? (rawSort as ContentSortValue)
        : "updated_at_desc",
    page: getPositiveInteger(params?.page, 1),
    pageSize: CONTENT_LIST_PAGE_SIZES.includes(
      requestedPageSize as (typeof CONTENT_LIST_PAGE_SIZES)[number],
    )
      ? requestedPageSize
      : DEFAULT_CONTENT_LIST_PAGE_SIZE,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: UnifiedContentFilters, categories: AdminContentCategory[]) {
  let next = query.is("deleted_at", null);

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
  if (filters.seriesId) next = next.eq("series_id", filters.seriesId);
  if (filters.status !== "all") next = next.eq("status", filters.status);
  if (filters.featured === "yes") next = next.eq("is_featured", true);
  if (filters.featured === "no") next = next.eq("is_featured", false);

  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySort(query: any, sort: ContentSortValue) {
  const sortMap: Record<ContentSortValue, { column: string; ascending: boolean }> = {
    id_asc: { column: "id", ascending: true },
    id_desc: { column: "id", ascending: false },
    title_asc: { column: "title", ascending: true },
    title_desc: { column: "title", ascending: false },
    category_asc: { column: "category_name", ascending: true },
    category_desc: { column: "category_name", ascending: false },
    views_asc: { column: "views_count", ascending: true },
    views_desc: { column: "views_count", ascending: false },
    created_at_asc: { column: "created_at", ascending: true },
    created_at_desc: { column: "created_at", ascending: false },
    updated_at_asc: { column: "updated_at", ascending: true },
    updated_at_desc: { column: "updated_at", ascending: false },
    created_by_asc: { column: "created_by_display", ascending: true },
    created_by_desc: { column: "created_by_display", ascending: false },
  };
  const selected = sortMap[sort];
  return query.order(selected.column, {
    ascending: selected.ascending,
    nullsFirst: false,
  });
}

const CONTENT_LIST_SELECT =
  "id,title,content_type,category_id,category_name,category_color_token,series_id,series_name,status,is_featured,views_count,created_at,updated_at,published_at,created_by_display,updated_by_display,published_by_display";

export async function loadUnifiedContentList(
  filters: UnifiedContentFilters,
  categories: AdminContentCategory[],
): Promise<UnifiedContentListResult> {
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await applyFilters(
    supabase.from("admin_content_topics").select("id", { count: "exact", head: true }),
    filters,
    categories,
  );

  if (countError) {
    return {
      rows: [],
      totalCount: 0,
      page: 1,
      pageSize: filters.pageSize,
      totalPages: 1,
      error: countError.message,
    };
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const from = (page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { data, error } = await applySort(
    applyFilters(
      supabase.from("admin_content_topics").select(CONTENT_LIST_SELECT),
      filters,
      categories,
    ),
    filters.sort,
  ).range(from, to);

  return {
    rows: error ? [] : ((data ?? []) as UnifiedContentRow[]),
    totalCount,
    page,
    pageSize: filters.pageSize,
    totalPages,
    error: error?.message ?? null,
  };
}

export async function loadUnifiedContentMetrics() {
  const supabase = getSupabaseAdmin();
  const base = () =>
    supabase.from("topics").select("id", { count: "exact", head: true }).is("deleted_at", null);

  const [
    total,
    published,
    draft,
    unpublished,
    archived,
    { data: seoRows, error: seoError },
  ] = await Promise.all([
    base(),
    base().eq("status", "published"),
    base().eq("status", "draft"),
    base().eq("status", "unpublished"),
    base().eq("status", "archived"),
    supabase
      .from("topics")
      .select(
        "title,slug,excerpt,image,image_alt,seo_title,seo_description,seo_keywords,focus_keyword",
      )
      .is("deleted_at", null),
  ]);

  const safeSeoRows = seoError ? [] : (seoRows ?? []);
  const seoAverage = safeSeoRows.length
    ? Math.round(
        safeSeoRows.reduce(
          (sum, row) =>
            sum +
            analyzeTopicSeo({
              title: row.title ?? "",
              excerpt: row.excerpt ?? "",
              slug: row.slug ?? "",
              content: "",
              image: row.image ?? "",
              imageAlt: row.image_alt ?? "",
              seoTitle: row.seo_title ?? "",
              seoDescription: row.seo_description ?? "",
              seoKeywords: Array.isArray(row.seo_keywords) ? row.seo_keywords.map(String) : [],
              focusKeyword: row.focus_keyword ?? "",
              faq: [],
            }).overallScore,
          0,
        ) / safeSeoRows.length,
      )
    : 0;

  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    draft: draft.count ?? 0,
    unpublished: unpublished.count ?? 0,
    archived: archived.count ?? 0,
    seoAverage,
    error:
      total.error?.message ??
      published.error?.message ??
      draft.error?.message ??
      unpublished.error?.message ??
      archived.error?.message ??
      seoError?.message ??
      null,
  };
}
