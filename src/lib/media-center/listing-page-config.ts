import type { MediaContentType } from "./types";

export type MediaListingPageConfig = {
  mediaType: MediaContentType;
  emptyTitle: string;
  emptyDescription: string;
  itemsLabel: string;
};

export const MEDIA_LISTING_PAGE_CONFIG = {
  news: {
    mediaType: "news",
    emptyTitle: "لا توجد أخبار متاحة حاليًا",
    emptyDescription: "عند إضافة أخبار جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "أخبار",
  },
  press: {
    mediaType: "press",
    emptyTitle: "لا توجد بيانات صحفية متاحة حاليًا",
    emptyDescription: "عند إضافة بيانات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "بيانات",
  },
  "site-updates": {
    mediaType: "site_update",
    emptyTitle: "لا توجد تحديثات متاحة حاليًا",
    emptyDescription: "عند إضافة تحديثات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "تحديثات",
  },
  videos: {
    mediaType: "video",
    emptyTitle: "لا توجد فيديوهات متاحة حاليًا",
    emptyDescription: "عند إضافة فيديوهات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "فيديوهات",
  },
  gallery: {
    mediaType: "gallery",
    emptyTitle: "لا توجد صور متاحة حاليًا",
    emptyDescription: "عند إضافة صور جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "صور",
  },
} as const satisfies Record<string, MediaListingPageConfig>;

export type MediaListingPageKey = keyof typeof MEDIA_LISTING_PAGE_CONFIG;

const MEDIA_LISTING_PAGE_KEY_BY_CONTENT_TYPE = {
  news: "news",
  press: "press",
  site_update: "site-updates",
  video: "videos",
  gallery: "gallery",
} as const satisfies Record<MediaContentType, MediaListingPageKey>;

/** Existing Media Listing copy/path projection, keyed by assigned content type. */
export function getMediaListingPageConfigForContentType(
  contentType: MediaContentType,
): MediaListingPageConfig {
  return MEDIA_LISTING_PAGE_CONFIG[
    MEDIA_LISTING_PAGE_KEY_BY_CONTENT_TYPE[contentType]
  ];
}
