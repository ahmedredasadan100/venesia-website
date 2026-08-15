import type { MediaContentType } from "./types";

export type MediaListingPageConfig = {
  mediaType: MediaContentType;
  cmsPageSlug: string;
  basePath: `/media-center/${string}`;
  metadataPath: string;
  emptyTitle: string;
  emptyDescription: string;
  itemsLabel: string;
};

export const MEDIA_LISTING_PAGE_CONFIG = {
  news: {
    mediaType: "news",
    cmsPageSlug: "media-center-news",
    basePath: "/media-center/news",
    metadataPath: "/media-center/news",
    emptyTitle: "لا توجد أخبار متاحة حاليًا",
    emptyDescription: "عند إضافة أخبار جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "أخبار",
  },
  press: {
    mediaType: "press",
    cmsPageSlug: "media-center-press",
    basePath: "/media-center/press",
    metadataPath: "/media-center/press",
    emptyTitle: "لا توجد بيانات صحفية متاحة حاليًا",
    emptyDescription: "عند إضافة بيانات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "بيانات",
  },
  "site-updates": {
    mediaType: "site_update",
    cmsPageSlug: "media-center-site-updates",
    basePath: "/media-center/site-updates",
    metadataPath: "/media-center/site-updates",
    emptyTitle: "لا توجد تحديثات متاحة حاليًا",
    emptyDescription: "عند إضافة تحديثات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "تحديثات",
  },
  videos: {
    mediaType: "video",
    cmsPageSlug: "media-center-videos",
    basePath: "/media-center/videos",
    metadataPath: "/media-center/videos",
    emptyTitle: "لا توجد فيديوهات متاحة حاليًا",
    emptyDescription: "عند إضافة فيديوهات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "فيديوهات",
  },
  gallery: {
    mediaType: "gallery",
    cmsPageSlug: "media-center-gallery",
    basePath: "/media-center/gallery",
    metadataPath: "/media-center/gallery",
    emptyTitle: "لا توجد صور متاحة حاليًا",
    emptyDescription: "عند إضافة صور جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    itemsLabel: "صور",
  },
} as const satisfies Record<string, MediaListingPageConfig>;

export type MediaListingPageKey = keyof typeof MEDIA_LISTING_PAGE_CONFIG;
