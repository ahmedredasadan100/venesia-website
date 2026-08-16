import "server-only";

import {
  loadPublicContentCollection,
  loadPublicContentDetail,
} from "../content/public-content-read/owner";
import type { PublicContentFeaturedSelection } from "../content/public-content-read/contract";
import { adaptPublicContentToMediaItem } from "./adapt-topic-row";
import {
  MEDIA_CONTENT_TYPES,
  type MediaContentItem,
  type MediaContentType,
} from "./types";

type ListingSort = "newest" | "oldest";

function adaptItems(items: Awaited<ReturnType<typeof loadPublicContentCollection>>["items"]) {
  return items.flatMap((item) => {
    const adapted = adaptPublicContentToMediaItem(item);
    return adapted ? [adapted] : [];
  });
}

/** Media provider is an adapter only. It never constructs a database query. */
export async function unifiedGetMediaItems(type?: MediaContentType) {
  const result = await loadPublicContentCollection({
    contentTypes: type ? [type] : MEDIA_CONTENT_TYPES,
    page: 1,
    pageSize: 60,
    sort: "newest",
  });
  return adaptItems(result.items);
}

export async function unifiedGetMediaItemBySlug(type: MediaContentType, slug: string) {
  const item = await loadPublicContentDetail(type, slug);
  return item ? adaptPublicContentToMediaItem(item) : null;
}

export async function unifiedGetMediaListingPage(
  params: {
    type: MediaContentType;
    page: number;
    pageSize: number;
    sort: ListingSort;
    featuredSelection?: PublicContentFeaturedSelection;
    search?: string;
  },
) {
  const result = await loadPublicContentCollection({
    contentTypes: [params.type],
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    search: params.search,
    featuredSelection: params.featuredSelection,
  });

  return {
    featured: result.featured
      ? adaptPublicContentToMediaItem(result.featured)
      : null,
    items: adaptItems(result.items),
    totalRegular: result.totalCount,
    totalPages: result.totalPages,
    currentPage: result.page,
  };
}

export async function unifiedGetMediaItemsLimited(
  options: {
    type?: MediaContentType;
    limit: number;
    popularOnly?: boolean;
    featuredOnly?: boolean;
    sort?: ListingSort;
    excludeIds?: readonly number[];
  },
): Promise<MediaContentItem[]> {
  const result = await loadPublicContentCollection({
    contentTypes: options.type ? [options.type] : MEDIA_CONTENT_TYPES,
    page: 1,
    pageSize: options.limit,
    popularOnly: options.popularOnly,
    featured: options.featuredOnly ? "only" : "none",
    sort: options.sort,
    excludeIds: options.excludeIds,
  });
  return adaptItems(result.items);
}
