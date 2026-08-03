import "server-only";

import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import { adaptTopicRowToMediaItem, type UnifiedMediaTopicRow } from "./adapt-topic-row";
import {
  toTopicsContentType,
} from "./content-type-map";
import type { MediaContentItem, MediaContentType } from "./types";

/** Card / list / sidebar / hub fields — excludes body content and SEO blobs. */
export const UNIFIED_LISTING_SELECT =
  "id, slug, title, excerpt, image, image_alt, category, category_slug, date_label, published_at, content_type, is_featured, is_popular, media_payload";

/** Detail page fields — includes full content + SEO. */
export const UNIFIED_DETAIL_SELECT =
  "id, slug, title, excerpt, content, image, image_alt, category, category_slug, date_label, published_at, content_type, is_featured, is_popular, media_payload, seo_title, seo_description, seo_keywords, focus_keyword, canonical_url, robots_index, robots_follow, og_image, og_image_alt, show_title_on_page, show_image_on_page, show_excerpt_on_page";

const UNIFIED_MEDIA_CONTENT_TYPES = ["news", "press", "site_update", "video", "gallery"] as const;

type ListingSort = "newest" | "oldest";

function mapRows(data: unknown) {
  return ((data ?? []) as UnifiedMediaTopicRow[])
    .map(adaptTopicRowToMediaItem)
    .filter(Boolean) as MediaContentItem[];
}

function applyTypeFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  type?: MediaContentType,
) {
  if (!type) return query;
  return query.eq("content_type", toTopicsContentType(type));
}

function buildUnifiedMediaQuery(select: string, type?: MediaContentType, ascending = false) {
  const query = getSupabaseAdmin()
    .from("topics")
    .select(select)
    .in("content_type", [...UNIFIED_MEDIA_CONTENT_TYPES])
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending })
    .order("id", { ascending });

  return applyTypeFilter(query, type);
}

export async function unifiedGetMediaItems(type?: MediaContentType) {
  const { data, error } = await buildUnifiedMediaQuery(UNIFIED_LISTING_SELECT, type);

  if (error) {
    logError("Unified media topics fetch failed", error, { type });
    return [];
  }

  return mapRows(data);
}

export async function unifiedGetMediaItemBySlug(type: MediaContentType, slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(UNIFIED_DETAIL_SELECT)
    .eq("content_type", toTopicsContentType(type))
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logError("Unified media topic fetch failed", error, { type, slug });
    return null;
  }

  return data ? adaptTopicRowToMediaItem(data as UnifiedMediaTopicRow) : null;
}

export async function unifiedGetMediaStaticParams(type: MediaContentType) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("slug")
    .eq("content_type", toTopicsContentType(type))
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("Unified media static params fetch failed", error, { type });
    return [];
  }

  return (data ?? [])
    .map((item) => ({ slug: item.slug }))
    .filter((item): item is { slug: string } => Boolean(item.slug));
}

export type UnifiedMediaListingPageParams = {
  type: MediaContentType;
  page: number;
  pageSize: number;
  sort: ListingSort;
  pickFeatured: boolean;
};

export type UnifiedMediaListingPageResult = {
  featured: MediaContentItem | null;
  items: MediaContentItem[];
  totalRegular: number;
  totalPages: number;
  currentPage: number;
};

async function resolveFeaturedItem(
  type: MediaContentType,
  sort: ListingSort,
): Promise<MediaContentItem | null> {
  const ascending = sort === "oldest";

  const featuredQuery = buildUnifiedMediaQuery(UNIFIED_LISTING_SELECT, type, ascending)
    .eq("is_featured", true)
    .limit(1);

  const { data: featuredRows, error: featuredError } = await featuredQuery;
  if (featuredError) {
    logError("Unified media featured fetch failed", featuredError, { type });
  } else {
    const featured = mapRows(featuredRows)[0];
    if (featured) return featured;
  }

  const { data: firstRows, error: firstError } = await buildUnifiedMediaQuery(
    UNIFIED_LISTING_SELECT,
    type,
    ascending,
  ).limit(1);

  if (firstError) {
    logError("Unified media first-item featured fallback failed", firstError, { type });
    return null;
  }

  return mapRows(firstRows)[0] ?? null;
}

export async function unifiedGetMediaListingPage(
  params: UnifiedMediaListingPageParams,
): Promise<UnifiedMediaListingPageResult> {
  const pageSize = Math.max(1, params.pageSize);
  const ascending = params.sort === "oldest";

  const featured = params.pickFeatured
    ? await resolveFeaturedItem(params.type, params.sort)
    : null;
  const excludeId = featured ? Number(featured.id) : null;

  let countQuery = getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .in("content_type", [...UNIFIED_MEDIA_CONTENT_TYPES])
    .eq("status", "published")
    .is("deleted_at", null);

  countQuery = applyTypeFilter(countQuery, params.type);
  if (excludeId !== null && Number.isFinite(excludeId)) {
    countQuery = countQuery.neq("id", excludeId);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    logError("Unified media listing count failed", countError, { type: params.type });
  }

  const totalRegular = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRegular / pageSize) || 1);
  const currentPage = Math.min(Math.max(params.page, 1), totalPages);

  if (totalRegular === 0) {
    return { featured, items: [], totalRegular: 0, totalPages: 1, currentPage: 1 };
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let pageQuery = buildUnifiedMediaQuery(UNIFIED_LISTING_SELECT, params.type, ascending);
  if (excludeId !== null && Number.isFinite(excludeId)) {
    pageQuery = pageQuery.neq("id", excludeId);
  }

  const { data, error } = await pageQuery.range(from, to);
  if (error) {
    logError("Unified media listing page fetch failed", error, {
      type: params.type,
      page: currentPage,
    });
    return { featured, items: [], totalRegular, totalPages, currentPage };
  }

  return {
    featured,
    items: mapRows(data),
    totalRegular,
    totalPages,
    currentPage,
  };
}

export type UnifiedMediaLimitedQuery = {
  type?: MediaContentType;
  limit: number;
  popularOnly?: boolean;
  sort?: ListingSort;
};

export async function unifiedGetMediaItemsLimited(
  options: UnifiedMediaLimitedQuery,
): Promise<MediaContentItem[]> {
  const limit = Math.max(1, options.limit);
  const ascending = options.sort === "oldest";

  let query = buildUnifiedMediaQuery(UNIFIED_LISTING_SELECT, options.type, ascending).limit(limit);
  if (options.popularOnly) {
    query = query.eq("is_popular", true);
  }

  const { data, error } = await query;
  if (error) {
    logError("Unified media limited fetch failed", error, {
      type: options.type,
      popularOnly: options.popularOnly,
      limit,
    });
    return [];
  }

  return mapRows(data);
}
