import {
  legacyGetMediaItemBySlug,
  legacyGetMediaItems,
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
  unifiedGetMediaStaticParams,
} from "./media-center/unified-provider";

export type { MediaContentItem, MediaContentType, MediaNewsItem, MediaSidebarItem };
export { getMediaHref, MEDIA_TYPE_PATHS, MEDIA_CONTENT_TYPES };

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

async function resolveMediaItemBySlug(type: MediaContentType, slug: string) {
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

export async function getMediaItems(type?: MediaContentType) {
  return resolveMediaItems(type);
}

export async function getMediaItemBySlug(type: MediaContentType, slug: string) {
  return resolveMediaItemBySlug(type, slug);
}

export async function getMediaStaticParams(type: MediaContentType) {
  return resolveMediaStaticParams(type);
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
  const allItems = await getMediaItems();
  const newsItems = allItems.filter((item) => item.type === "news");
  const popularItems = allItems.filter((item) => item.isPopular);

  const latestNewsSidebar: MediaSidebarItem[] = sortByNewest(newsItems)
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      date: item.date,
      image: item.image,
      href: getMediaHref(item),
    }));

  const popularMediaSidebarItems: MediaSidebarItem[] = sortByNewest(popularItems)
    .slice(0, 4)
    .map((item) => ({
      title: item.title,
      date: item.date,
      image: item.image,
      href: getMediaHref(item),
      label: item.category,
    }));

  return { latestNewsSidebar, popularMediaSidebarItems };
}
