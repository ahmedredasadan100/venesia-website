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
} from "./media-center/unified-provider";
import { normalizePublicContentSearchQuery } from "./content/public-content-read/contract";

export type { MediaContentItem, MediaContentType, MediaNewsItem, MediaSidebarItem };
export { getMediaHref, MEDIA_TYPE_PATHS, MEDIA_CONTENT_TYPES };

/** Public listing page size — keep in sync with the public presentation. */
export const MEDIA_LISTING_PAGE_SIZE = 2;

/** Media remains a presentation facade over Unified Content's Public Collection owner. */
export async function getMediaItems(type?: MediaContentType) {
  return unifiedGetMediaItems(type);
}

export async function getMediaItemBySlug(type: MediaContentType, slug: string) {
  return unifiedGetMediaItemBySlug(type, slug);
}

export async function getMediaStaticParams(type: MediaContentType) {
  return unifiedGetMediaStaticParams(type);
}

export async function getMediaListingPage(
  input: {
    type: MediaContentType;
    page: number;
    sort?: "newest" | "oldest";
    pageSize?: number;
    pickFeatured?: boolean;
    search?: string;
  },
) {
  const sort = input.sort === "oldest" ? "oldest" : "newest";
  const pageSize = input.pageSize ?? MEDIA_LISTING_PAGE_SIZE;
  const search = normalizePublicContentSearchQuery(input.search);

  return unifiedGetMediaListingPage({
    type: input.type,
    page: search ? 1 : Number.isFinite(input.page) && input.page > 0 ? Math.floor(input.page) : 1,
    pageSize,
    sort,
    pickFeatured: search ? false : Boolean(input.pickFeatured),
    search,
  });
}

export async function getMediaSidebarLatest(limit = 3): Promise<MediaContentItem[]> {
  return unifiedGetMediaItemsLimited({
    type: "news",
    limit: Math.max(1, limit),
    sort: "newest",
  });
}

export async function getMediaSidebarPopular(limit = 4): Promise<MediaContentItem[]> {
  return unifiedGetMediaItemsLimited({
    limit: Math.max(1, limit),
    popularOnly: true,
    sort: "newest",
  });
}

export async function getFeaturedNews() {
  const featured = await unifiedGetMediaItemsLimited({
    type: "news",
    limit: 1,
    featuredOnly: true,
  });
  if (featured[0]) return featured[0];

  const latest = await unifiedGetMediaItemsLimited({
    type: "news",
    limit: 1,
    sort: "newest",
  });
  return latest[0] ?? null;
}

export async function getRegularNews() {
  const items = await getMediaItems("news");
  const featured = items.find((item) => item.featured);
  return featured ? items.filter((item) => item.slug !== featured.slug) : items;
}

export async function getRelatedMediaItems(
  type: MediaContentType,
  excludeId: number,
  limit = 3,
) {
  return unifiedGetMediaItemsLimited({
    type,
    limit: Math.max(1, limit),
    excludeIds: [excludeId],
  });
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
