import type { MediaContentItem, MediaContentType } from "./media-center/types";
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
} from "./media-center/unified-provider";
import { normalizePublicContentSearchQuery } from "./content/public-content-read/contract";
import type { PublicContentFeaturedSelection } from "./content/public-content-read/contract";
import { getDefaultMediaListingPresentation } from "./media-hub-modules/parse-config";

export type { MediaContentItem, MediaContentType, MediaNewsItem };
export { getMediaHref, MEDIA_TYPE_PATHS, MEDIA_CONTENT_TYPES };

/** Media remains a presentation facade over Unified Content's Public Collection owner. */
export async function getMediaItems(type?: MediaContentType) {
  return unifiedGetMediaItems(type);
}

export async function getMediaItemBySlug(type: MediaContentType, slug: string) {
  return unifiedGetMediaItemBySlug(type, slug);
}

export async function getMediaListingPage(
  input: {
    type: MediaContentType;
    page: number;
    sort?: "newest" | "oldest";
    pageSize?: number;
    featuredSelection?: PublicContentFeaturedSelection;
    search?: string;
  },
) {
  const sort = input.sort === "oldest" ? "oldest" : "newest";
  const pageSize = input.pageSize ?? getDefaultMediaListingPresentation().itemLimit;
  const search = normalizePublicContentSearchQuery(input.search);

  return unifiedGetMediaListingPage({
    type: input.type,
    page: search ? 1 : Number.isFinite(input.page) && input.page > 0 ? Math.floor(input.page) : 1,
    pageSize,
    sort,
    featuredSelection: search ? undefined : input.featuredSelection,
    search,
  });
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
