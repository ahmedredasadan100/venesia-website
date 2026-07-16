import { unstable_cache } from "next/cache";
import { cache } from "react";

import {
  legacyGetMediaItemBySlug,
  legacyGetMediaItems,
  legacyGetMediaItemsLimited,
  legacyGetMediaListingPage,
  legacyGetMediaStaticParams,
} from "./media-center/legacy-provider";
import { getPublicMediaContentSource, isLegacyFallbackEnabled } from "./media-center/source";
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

function sortByNewest<T extends { publishedAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );
}

async function resolveMediaItemsForType(type: MediaContentType) {
  const unifiedItems = await unifiedGetMediaItems(type);
  if (unifiedItems.length > 0 || !isLegacyFallbackEnabled()) {
    return unifiedItems;
  }
  return legacyGetMediaItems(type);
}

async function resolveMediaItems(type?: MediaContentType) {
  const source = getPublicMediaContentSource();

  if (source === "legacy") {
    return legacyGetMediaItems(type);
  }

  if (type) {
    return resolveMediaItemsForType(type);
  }

  const merged = await Promise.all(MEDIA_CONTENT_TYPES.map((mediaType) => resolveMediaItemsForType(mediaType)));
  return sortByNewest(merged.flat());
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
  const source = getPublicMediaContentSource();

  if (source === "legacy") {
    return legacyGetMediaItemBySlug(type, slug);
  }

  const unifiedItem = await unifiedGetMediaItemBySlug(type, slug);
  if (unifiedItem || !isLegacyFallbackEnabled()) {
    return unifiedItem;
  }

  return legacyGetMediaItemBySlug(type, slug);
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
  const source = getPublicMediaContentSource();

  if (source === "legacy") {
    return legacyGetMediaStaticParams(type);
  }

  const unifiedParams = await unifiedGetMediaStaticParams(type);
  if (unifiedParams.length > 0 || !isLegacyFallbackEnabled()) {
    return unifiedParams;
  }

  return legacyGetMediaStaticParams(type);
}

async function resolveMediaListingPage(
  params: UnifiedMediaListingPageParams,
): Promise<UnifiedMediaListingPageResult> {
  const source = getPublicMediaContentSource();

  if (source === "legacy") {
    return legacyGetMediaListingPage(params);
  }

  const unified = await unifiedGetMediaListingPage(params);
  if (
    unified.featured ||
    unified.items.length > 0 ||
    unified.totalRegular > 0 ||
    !isLegacyFallbackEnabled()
  ) {
    return unified;
  }

  return legacyGetMediaListingPage(params);
}

async function resolveMediaItemsLimited(
  options: UnifiedMediaLimitedQuery,
): Promise<MediaContentItem[]> {
  const source = getPublicMediaContentSource();

  if (source === "legacy") {
    return legacyGetMediaItemsLimited(options);
  }

  const unified = await unifiedGetMediaItemsLimited(options);
  if (unified.length > 0 || !isLegacyFallbackEnabled()) {
    return unified;
  }

  return legacyGetMediaItemsLimited(options);
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
    date: item.date,
    image: item.image,
    href: getMediaHref(item),
  }));

  const popularMediaSidebarItems: MediaSidebarItem[] = popularItems.map((item) => ({
    title: item.title,
    date: item.date,
    image: item.image,
    href: getMediaHref(item),
    label: item.category,
  }));

  return { latestNewsSidebar, popularMediaSidebarItems };
}
