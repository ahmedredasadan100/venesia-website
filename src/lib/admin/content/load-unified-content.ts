import "server-only";

import {
  analyzeEntitySeo,
  sortRowsBySeoScore,
} from "../seo-score";
import type { Json, Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { parseTopicFaq } from "../content-workflow/topic-publish-validation";
import {
  getCategoryAndDescendantIds,
  type AdminContentCategory,
} from "./category-hierarchy";
import { isContentType, type ContentType } from "./content-types";

export {
  TOPICS_LIST_DEFAULT_PAGE_SIZE as DEFAULT_CONTENT_LIST_PAGE_SIZE,
  TOPICS_LIST_PAGE_SIZES as CONTENT_LIST_PAGE_SIZES,
  TOPICS_LIST_VIEW_KEY as CONTENT_LIST_VIEW_KEY,
} from "./topics-list-config";
import {
  TOPICS_LIST_DEFAULT_PAGE_SIZE,
  TOPICS_LIST_PAGE_SIZES,
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

export const DEFAULT_CONTENT_LIST_SORT: ContentSortValue = "title_asc";

const CONTENT_SORT_SET = new Set<string>(CONTENT_SORT_VALUES);
type SeoContentSortValue = "seo_asc" | "seo_desc";
const SEO_SORT_VALUES = new Set<ContentSortValue>(["seo_asc", "seo_desc"]);

function isSeoContentSortValue(
  value: ContentSortValue,
): value is SeoContentSortValue {
  return SEO_SORT_VALUES.has(value);
}
const STATUS_VALUES = new Set(["published", "unpublished"]);
const FEATURED_VALUES = new Set(["yes", "no"]);

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

type UnifiedContentSeoInputRow = {
  title: string | null;
  content_type: ContentType;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  focus_keyword: string | null;
  og_image: string | null;
  og_image_alt: string | null;
  faq: Json | null;
};

type UnifiedContentSeoSourceRow = Omit<UnifiedContentRow, "seo_score"> &
  UnifiedContentSeoInputRow;

type UnifiedContentMetricsSourceRow = UnifiedContentSeoInputRow & {
  id: number;
  status: string | null;
  is_featured: boolean | null;
  series_id: number | null;
};

type AdminContentTopicDatabaseRow = Tables<"admin_content_topics">;
type TopicDatabaseRow = Tables<"topics">;

type UnifiedContentListDatabaseRow = Pick<
  AdminContentTopicDatabaseRow,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "content"
  | "image"
  | "image_alt"
  | "content_type"
  | "category_id"
  | "category_name"
  | "category_color_token"
  | "series_id"
  | "series_name"
  | "status"
  | "is_featured"
  | "views_count"
  | "created_at"
  | "updated_at"
  | "published_at"
  | "created_by_display"
  | "updated_by_display"
  | "published_by_display"
  | "deleted_at"
  | "seo_title"
  | "seo_description"
  | "seo_keywords"
  | "focus_keyword"
  | "og_image"
  | "og_image_alt"
  | "faq"
>;

type UnifiedContentMetricsDatabaseRow = Pick<
  TopicDatabaseRow,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "content"
  | "image"
  | "image_alt"
  | "content_type"
  | "status"
  | "is_featured"
  | "series_id"
  | "seo_title"
  | "seo_description"
  | "seo_keywords"
  | "focus_keyword"
  | "og_image"
  | "og_image_alt"
  | "faq"
>;

function normalizeUnifiedContentListSourceRow(
  row: UnifiedContentListDatabaseRow,
): UnifiedContentSeoSourceRow | null {
  if (row.id === null || !isContentType(row.content_type)) return null;
  return {
    ...row,
    id: row.id,
    content_type: row.content_type,
  };
}

function normalizeUnifiedContentListSourceRows(
  rows: readonly UnifiedContentListDatabaseRow[],
): UnifiedContentSeoSourceRow[] | null {
  const normalized = rows.flatMap((row) => {
    const item = normalizeUnifiedContentListSourceRow(row);
    return item ? [item] : [];
  });
  return normalized.length === rows.length ? normalized : null;
}

function normalizeUnifiedContentMetricsSourceRow(
  row: UnifiedContentMetricsDatabaseRow,
): UnifiedContentMetricsSourceRow | null {
  if (!Number.isSafeInteger(row.id) || !isContentType(row.content_type)) {
    return null;
  }
  return {
    ...row,
    content_type: row.content_type,
  };
}

function normalizeUnifiedContentMetricsSourceRows(
  rows: readonly UnifiedContentMetricsDatabaseRow[],
): UnifiedContentMetricsSourceRow[] | null {
  const normalized = rows.flatMap((row) => {
    const item = normalizeUnifiedContentMetricsSourceRow(row);
    return item ? [item] : [];
  });
  return normalized.length === rows.length ? normalized : null;
}

function normalizeSeoKeywords(value: string[] | null) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return [];
  }
  return value.filter(Boolean);
}

function getUnifiedContentSeoScore(row: UnifiedContentSeoInputRow) {
  return analyzeEntitySeo({
    profile: row.content_type === "article" ? "article" : "entity",
    title: row.title ?? "",
    description: row.excerpt ?? "",
    content: row.content ?? "",
    slug: row.slug ?? "",
    image: row.image ?? "",
    imageAlt: row.image_alt ?? "",
    ogImage: row.og_image ?? "",
    ogImageAlt: row.og_image_alt ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    seoKeywords: normalizeSeoKeywords(row.seo_keywords),
    focusKeyword: row.focus_keyword ?? "",
    faq: parseTopicFaq(row.faq ?? null) ?? [],
  }).score;
}

function toUnifiedContentRow(
  source: UnifiedContentSeoSourceRow,
): UnifiedContentRow {
  return {
    id: source.id,
    title: source.title,
    content_type: source.content_type,
    category_id: source.category_id,
    category_name: source.category_name,
    category_color_token: source.category_color_token,
    series_id: source.series_id,
    series_name: source.series_name,
    status: source.status,
    is_featured: source.is_featured,
    seo_score: getUnifiedContentSeoScore(source),
    views_count: source.views_count,
    created_at: source.created_at,
    updated_at: source.updated_at,
    published_at: source.published_at,
    created_by_display: source.created_by_display,
    updated_by_display: source.updated_by_display,
    published_by_display: source.published_by_display,
    deleted_at: source.deleted_at,
  };
}

export function sortUnifiedContentRowsBySeo(
  rows: readonly UnifiedContentRow[],
  direction: "asc" | "desc",
) {
  return sortRowsBySeoScore(
    rows,
    direction,
    (row) => row.seo_score,
    (row) => row.id,
  );
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
  const requestedPageSize = getPositiveInteger(params?.limit, TOPICS_LIST_DEFAULT_PAGE_SIZE);

  return {
    q: cleanContentTitleSearch(params?.q),
    view: params?.view === "trash" ? "trash" : "active",
    contentType: isContentType(rawType) ? rawType : "all",
    categoryId: getOptionalId(params?.category),
    seriesId: params?.series === "any" ? "any" : getOptionalId(params?.series),
    status: rawStatus && STATUS_VALUES.has(rawStatus) ? rawStatus : "all",
    featured:
      rawFeatured && FEATURED_VALUES.has(rawFeatured)
        ? (rawFeatured as "yes" | "no")
        : "all",
    image: params?.image === "without" ? "without" : "all",
    sort:
      rawSort && CONTENT_SORT_SET.has(rawSort)
        ? (rawSort as ContentSortValue)
        : DEFAULT_CONTENT_LIST_SORT,
    page: getPositiveInteger(params?.page, 1),
    pageSize: TOPICS_LIST_PAGE_SIZES.includes(
      requestedPageSize as (typeof TOPICS_LIST_PAGE_SIZES)[number],
    )
      ? requestedPageSize
      : TOPICS_LIST_DEFAULT_PAGE_SIZE,
  };
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
  sort: Exclude<ContentSortValue, SeoContentSortValue>,
): Query {
  const sortMap: Record<
    Exclude<ContentSortValue, SeoContentSortValue>,
    { column: UnifiedContentSortColumn; ascending: boolean }
  > = {
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
  "id,title,slug,excerpt,content,image,image_alt,content_type,category_id,category_name,category_color_token,series_id,series_name,status,is_featured,views_count,created_at,updated_at,published_at,created_by_display,updated_by_display,published_by_display,deleted_at,seo_title,seo_description,seo_keywords,focus_keyword,og_image,og_image_alt,faq";
const CONTENT_METRICS_SELECT =
  "id,title,slug,excerpt,content,image,image_alt,content_type,status,is_featured,series_id,seo_title,seo_description,seo_keywords,focus_keyword,og_image,og_image_alt,faq";

export async function loadUnifiedContentList(
  filters: UnifiedContentFilters,
  categories: AdminContentCategory[],
): Promise<UnifiedContentListResult> {
  const supabase = getSupabaseAdmin();
  let totalCount = 0;
  let seoSourceRows: UnifiedContentSeoSourceRow[] | null = null;
  let dataError: string | null = null;

  if (isSeoContentSortValue(filters.sort)) {
    const { data, count, error } = await applyFilters(
      supabase
        .from("admin_content_topics")
        .select(CONTENT_LIST_SELECT, { count: "exact" }),
      filters,
      categories,
    ).order("id", { ascending: true });

    if (error) {
      dataError = error.message;
    } else {
      const normalizedRows = normalizeUnifiedContentListSourceRows(data ?? []);
      if (!normalizedRows) {
        dataError = "The Topics list returned an invalid generated Database row.";
      } else {
        seoSourceRows = normalizedRows;
        totalCount = count ?? seoSourceRows.length;

        // PostgREST may cap a response. Continue only when the authoritative
        // count proves that the first response was truncated; no fixed fan-out.
        while (seoSourceRows.length < totalCount) {
          const offset = seoSourceRows.length;
          const { data: nextData, error: nextError } = await applyFilters(
            supabase.from("admin_content_topics").select(CONTENT_LIST_SELECT),
            filters,
            categories,
          )
            .order("id", { ascending: true })
            .range(offset, totalCount - 1);
          if (nextError) {
            dataError = nextError.message;
            break;
          }
          const nextRows = normalizeUnifiedContentListSourceRows(nextData ?? []);
          if (!nextRows) {
            dataError = "The Topics list returned an invalid generated Database row.";
            break;
          }
          if (!nextRows.length) {
            dataError = "The complete SEO sorting source could not be read.";
            break;
          }
          seoSourceRows.push(...nextRows);
        }
      }
    }
  } else {
    const { count, error: countError } = await applyFilters(
      supabase
        .from("admin_content_topics")
        .select("id", { count: "exact", head: true }),
      filters,
      categories,
    );
    if (countError) dataError = countError.message;
    else totalCount = count ?? 0;
  }

  if (dataError) {
    return {
      rows: [],
      totalCount,
      page: 1,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / filters.pageSize)),
      error: dataError,
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const from = (page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let rows: UnifiedContentRow[] = [];

  if (isSeoContentSortValue(filters.sort)) {
    const direction = filters.sort === "seo_asc" ? "asc" : "desc";
    rows = sortUnifiedContentRowsBySeo(
      (seoSourceRows ?? []).map(toUnifiedContentRow),
      direction,
    ).slice(from, to + 1);
  } else {
    const { data, error } = await applySort(
      applyFilters(
        supabase.from("admin_content_topics").select(CONTENT_LIST_SELECT),
        filters,
        categories,
      ),
      filters.sort,
    ).range(from, to);
    const sourceRows = error
      ? null
      : normalizeUnifiedContentListSourceRows(data ?? []);
    dataError = error?.message ?? (
      sourceRows === null
        ? "The Topics list returned an invalid generated Database row."
        : null
    );
    rows = sourceRows?.map(toUnifiedContentRow) ?? [];
  }

  return {
    rows,
    totalCount,
    page,
    pageSize: filters.pageSize,
    totalPages,
    error: dataError,
  };
}

export async function loadUnifiedContentMetrics() {
  const supabase = getSupabaseAdmin();
  const [active, trashed] = await Promise.all([
    supabase
      .from("topics")
      .select(CONTENT_METRICS_SELECT, { count: "exact" })
      .is("deleted_at", null)
      .order("id", { ascending: true }),
    supabase.from("topics").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
  ]);

  const activeCount = active.count ?? active.data?.length ?? 0;
  const normalizedActiveRows = active.error
    ? null
    : normalizeUnifiedContentMetricsSourceRows(active.data ?? []);
  const activeRows = normalizedActiveRows ?? [];
  let activeError = active.error?.message ?? (
    normalizedActiveRows === null
      ? "The Topics metrics query returned an invalid generated Database row."
      : null
  );

  while (!activeError && activeRows.length < activeCount) {
    const offset = activeRows.length;
    const { data, error } = await supabase
      .from("topics")
      .select(CONTENT_METRICS_SELECT)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, activeCount - 1);
    if (error) {
      activeError = error.message;
      break;
    }
    const nextRows = normalizeUnifiedContentMetricsSourceRows(data ?? []);
    if (!nextRows) {
      activeError = "The Topics metrics query returned an invalid generated Database row.";
      break;
    }
    if (!nextRows.length) {
      activeError = "The complete Topics metrics source could not be read.";
      break;
    }
    activeRows.push(...nextRows);
  }

  const completeRows = activeError ? [] : activeRows;
  const published = completeRows.filter((row) => row.status === "published").length;
  const unpublished = completeRows.filter((row) => row.status === "unpublished").length;
  const withoutImage = completeRows.filter((row) => !row.image).length;
  const withSeries = completeRows.filter((row) => row.series_id !== null).length;
  const featured = completeRows.filter((row) => row.is_featured === true).length;
  const seoAverage = completeRows.length
    ? Math.round(
        completeRows.reduce(
          (sum, row) => sum + getUnifiedContentSeoScore(row),
          0,
        ) / completeRows.length,
      )
    : 0;

  return {
    total: activeError ? 0 : activeCount,
    trashed: trashed.count ?? 0,
    published,
    unpublished,
    withoutImage,
    withSeries,
    featured,
    seoAverage,
    error:
      activeError ??
      trashed.error?.message ??
      null,
  };
}
