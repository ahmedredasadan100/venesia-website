import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { MediaContentItem, MediaContentType, MediaSidebarItem } from "./media-center/types";
import {
  getMediaHref,
  MEDIA_CONTENT_TYPES,
  MEDIA_TYPE_PATHS,
  type MediaNewsItem,
} from "./media-center/types";
import {
  unifiedGetMediaItemBySlug,
  unifiedGetMediaItems,
  unifiedGetMediaItemsLimited,
  unifiedGetMediaListingPage,
  unifiedGetMediaStaticParams,
  type UnifiedMediaLimitedQuery,
  type UnifiedMediaListingPageParams,
  type UnifiedMediaListingPageResult,
} from "./media-center/unified-provider";

export type { MediaContentItem, MediaContentType, MediaNewsItem, MediaSidebarItem };
export type { UnifiedMediaListingPageResult as MediaListingPageResult };
export { getMediaHref, MEDIA_TYPE_PATHS, MEDIA_CONTENT_TYPES };

/** Public listing page size — keep in sync with previous client ITEMS_PER_PAGE. */
export const MEDIA_LISTING_PAGE_SIZE = 2;

async function resolveMediaItems(type?: MediaContentType) {
  return unifiedGetMediaItems(type);
}

/** Lean listing catalog (no body content). Cache key scoped by type. */
async function resolveMediaItemsCached(type?: MediaContentType) {
  return unstable_cache(
    async () => resolveMediaItems(type),
    ["media-items-lean", type ?? "all"],
    { revalidate: 300, tags: ["media-center"] },
  )();
}

async function queryMediaItemBySlug(type: MediaContentType, slug: string) {
  return unifiedGetMediaItemBySlug(type, slug);
}

const resolveMediaItemBySlug = cache(async function resolveMediaItemBySlug(
  type: MediaContentType,
  slug: string,
) {
  return unstable_cache(
    async () => queryMediaItemBySlug(type, slug),
    ["media-item", type, slug],
    { revalidate: 300, tags: ["media-center", "media-item"] },
  )();
});

async function resolveMediaStaticParams(type: MediaContentType) {
  return unifiedGetMediaStaticParams(type);
}

async function resolveMediaListingPage(
  params: UnifiedMediaListingPageParams,
): Promise<UnifiedMediaListingPageResult> {
  return unifiedGetMediaListingPage(params);
}

async function resolveMediaItemsLimited(
  options: UnifiedMediaLimitedQuery,
): Promise<MediaContentItem[]> {
  return unifiedGetMediaItemsLimited(options);
}

export async function getMediaItems(type?: MediaContentType) {
  return resolveMediaItemsCached(type);
}

export async function getMediaItemBySlug(type: MediaContentType, slug: string) {
  return resolveMediaItemBySlug(type, slug);
}

export async function getMediaStaticParams(type: MediaContentType) {
  return resolveMediaStaticParams(type);
}

export type GetMediaListingPageInput = {
  type: MediaContentType;
  page: number;
  sort?: "newest" | "oldest";
  pageSize?: number;
  pickFeatured?: boolean;
};

/**
 * Server-paginated lean listing for a single media type.
 * Cache key includes type, sort, page, pageSize, and featured mode — no collisions.
 */
export async function getMediaListingPage(
  input: GetMediaListingPageInput,
): Promise<UnifiedMediaListingPageResult> {
  const sort = input.sort === "oldest" ? "oldest" : "newest";
  const pageSize = input.pageSize ?? MEDIA_LISTING_PAGE_SIZE;
  const pickFeatured = Boolean(input.pickFeatured);
  const page = Number.isFinite(input.page) && input.page > 0 ? Math.floor(input.page) : 1;

  return unstable_cache(
    async () =>
      resolveMediaListingPage({
        type: input.type,
        page,
        pageSize,
        sort,
        pickFeatured,
      }),
    [
      "media-listing-page",
      input.type,
      sort,
      String(page),
      String(pageSize),
      pickFeatured ? "featured" : "plain",
    ],
    { revalidate: 300, tags: ["media-center", "media-listing"] },
  )();
}

/** Latest news sidebar — lean, limited, news-only. */
export async function getMediaSidebarLatest(limit = 3): Promise<MediaContentItem[]> {
  const safeLimit = Math.max(1, limit);
  return unstable_cache(
    async () =>
      resolveMediaItemsLimited({
        type: "news",
        limit: safeLimit,
        sort: "newest",
      }),
    ["media-sidebar-latest", String(safeLimit)],
    { revalidate: 300, tags: ["media-center", "media-sidebar"] },
  )();
}

/** Popular sidebar — lean, limited, popular-only across media types. */
export async function getMediaSidebarPopular(limit = 4): Promise<MediaContentItem[]> {
  const safeLimit = Math.max(1, limit);
  return unstable_cache(
    async () =>
      resolveMediaItemsLimited({
        limit: safeLimit,
        popularOnly: true,
        sort: "newest",
      }),
    ["media-sidebar-popular", String(safeLimit)],
    { revalidate: 300, tags: ["media-center", "media-sidebar"] },
  )();
}

export async function getFeaturedNews() {
  const items = await getMediaItems("news");
  return items.find((item) => item.featured) ?? items[0] ?? null;
}

export async function getRegularNews() {
  const items = await getMediaItems("news");
  const featured = items.find((item) => item.featured);
  return featured ? items.filter((item) => item.slug !== featured.slug) : items;
}

export async function getMediaSidebarData() {
  const [latestNews, popularItems] = await Promise.all([
    getMediaSidebarLatest(3),
    getMediaSidebarPopular(4),
  ]);

  const latestNewsSidebar: MediaSidebarItem[] = latestNews.map((item) => ({
    title: item.title,
    ...(item.showDateOnPage && item.date ? { date: item.date } : {}),
    image: item.image,
    href: getMediaHref(item),
  }));

  const popularMediaSidebarItems: MediaSidebarItem[] = popularItems.map((item) => ({
    title: item.title,
    ...(item.showDateOnPage && item.date ? { date: item.date } : {}),
    image: item.image,
    href: getMediaHref(item),
    ...(item.showCategoryOnPage && item.category ? { label: item.category } : {}),
    ...(item.showSeriesOnPage && item.series ? { seriesLabel: item.series } : {}),
  }));

  return { latestNewsSidebar, popularMediaSidebarItems };
}
