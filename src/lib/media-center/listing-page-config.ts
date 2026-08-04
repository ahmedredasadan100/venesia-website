import type { MediaContentType } from "./types";

export type MediaListingPageConfig = {
  mediaType: MediaContentType;
  cmsPageSlug: string;
  basePath: `/media-center/${string}`;
  metadataPath: string;
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
  itemsLabel: string;
  showFeaturedNews?: boolean;
};

export const MEDIA_LISTING_PAGE_CONFIG = {
  news: {
    mediaType: "news",
    cmsPageSlug: "media-center-news",
    basePath: "/media-center/news",
    metadataPath: "/media-center/news",
    title: "أخبار فينيسيا",
    eyebrow: "Latest Update",
    description:
      "متابعة مستمرة لأحدث أخبار الشركة ومراحل التنفيذ والتطورات المرتبطة بمشروعات فينيسيا.",
    emptyTitle: "لا توجد أخبار متاحة حاليًا",
    emptyDescription: "عند إضافة أخبار جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    actionLabel: "قراءة الخبر",
    itemsLabel: "أخبار",
    showFeaturedNews: true,
  },
  press: {
    mediaType: "press",
    cmsPageSlug: "media-center-press",
    basePath: "/media-center/press",
    metadataPath: "/media-center/press",
    title: "بيانات فينيسيا الصحفية",
    eyebrow: "Press Releases",
    description:
      "مساحة رسمية للبيانات الصحفية والتغطيات التي توثق تحركات الشركة ومراحل تطورها.",
    emptyTitle: "لا توجد بيانات صحفية متاحة حاليًا",
    emptyDescription: "عند إضافة بيانات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    actionLabel: "قراءة البيان",
    itemsLabel: "بيانات",
  },
  "site-updates": {
    mediaType: "site_update",
    cmsPageSlug: "media-center-site-updates",
    basePath: "/media-center/site-updates",
    metadataPath: "/media-center/site-updates",
    title: "تحديثات مواقع فينيسيا",
    eyebrow: "Site Updates",
    description:
      "توثيق مستمر لحركة التنفيذ على الأرض، من مراحل الخرسانة إلى التشطيبات والتسليم.",
    emptyTitle: "لا توجد تحديثات متاحة حاليًا",
    emptyDescription: "عند إضافة تحديثات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    actionLabel: "عرض التحديث",
    itemsLabel: "تحديثات",
  },
  videos: {
    mediaType: "video",
    cmsPageSlug: "media-center-videos",
    basePath: "/media-center/videos",
    metadataPath: "/media-center/videos",
    title: "فيديوهات فينيسيا",
    eyebrow: "Venesia Videos",
    description:
      "توثيق مرئي من أرض التنفيذ، جولات ميدانية، ولقطات تشرح مراحل العمل كما تحدث على الواقع.",
    emptyTitle: "لا توجد فيديوهات متاحة حاليًا",
    emptyDescription: "عند إضافة فيديوهات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    actionLabel: "مشاهدة الفيديو",
    itemsLabel: "فيديوهات",
  },
  gallery: {
    mediaType: "gallery",
    cmsPageSlug: "media-center-gallery",
    basePath: "/media-center/gallery",
    metadataPath: "/media-center/gallery",
    title: "معرض صور فينيسيا",
    eyebrow: "Venesia Gallery",
    description:
      "لقطات حقيقية من أرض التنفيذ، واجهات، تفاصيل، ومراحل تتحول فيها الرؤية إلى واقع.",
    emptyTitle: "لا توجد صور متاحة حاليًا",
    emptyDescription: "عند إضافة صور جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي.",
    actionLabel: "عرض الصور",
    itemsLabel: "صور",
  },
} as const satisfies Record<string, MediaListingPageConfig>;

export type MediaListingPageKey = keyof typeof MEDIA_LISTING_PAGE_CONFIG;
