import type { MediaContentType } from "./types";

export type MediaDetailHeroVariant = "default" | "gallery" | "video";

export type MediaDetailPageConfig = {
  mediaType: MediaContentType;
  cmsPageSlug: string;
  basePath: `/media-center/${string}`;
  layoutEyebrow: string;
  breadcrumbSectionLabel: string;
  notFound: {
    title: string;
    description: string;
  };
  fallbackContent: string[];
  cta: {
    message: string;
    backLabel: string;
  };
  related: {
    eyebrow: string;
    title: string;
    actionLabel: string;
  };
  heroVariant: MediaDetailHeroVariant;
  showProjectBadge?: boolean;
  showDurationBadge?: boolean;
};

export const MEDIA_DETAIL_PAGE_CONFIG = {
  news: {
    mediaType: "news",
    cmsPageSlug: "media-center-news",
    basePath: "/media-center/news",
    layoutEyebrow: "News",
    breadcrumbSectionLabel: "الأخبار",
    notFound: {
      title: "خبر غير موجود | فينيسيا للتطوير العقاري",
      description:
        "الخبر المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
    },
    fallbackContent: ["تابع أخبار فينيسيا وتحديثات التنفيذ من داخل المركز الإعلامي."],
    cta: {
      message: "تابع أخبار فينيسيا وتحديثات التنفيذ من داخل المركز الإعلامي.",
      backLabel: "العودة للأخبار",
    },
    related: {
      eyebrow: "Related News",
      title: "أخبار ذات صلة",
      actionLabel: "قراءة الخبر",
    },
    heroVariant: "default",
    showProjectBadge: true,
  },
  press: {
    mediaType: "press",
    cmsPageSlug: "media-center-press",
    basePath: "/media-center/press",
    layoutEyebrow: "Press",
    breadcrumbSectionLabel: "البيانات الصحفية",
    notFound: {
      title: "بيان غير موجود | فينيسيا للتطوير العقاري",
      description:
        "البيان المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
    },
    fallbackContent: [
      "هذا البيان جزء من التوثيق الرسمي لتحركات فينيسيا ومراحل تطورها.",
      "نؤمن أن المعلومة الواضحة جزء من الثقة، وأن كل خطوة يجب أن تُعرض بهدوء وبدقة.",
      "الثقة مش وعد… الثقة فعل.",
    ],
    cta: {
      message: "تابع البيانات والتغطيات الرسمية داخل المركز الإعلامي.",
      backLabel: "العودة للبيانات",
    },
    related: {
      eyebrow: "Related Press",
      title: "بيانات ذات صلة",
      actionLabel: "قراءة البيان",
    },
    heroVariant: "default",
  },
  "site-updates": {
    mediaType: "site-update",
    cmsPageSlug: "media-center-site-updates",
    basePath: "/media-center/site-updates",
    layoutEyebrow: "Site Update",
    breadcrumbSectionLabel: "تحديثات المواقع",
    notFound: {
      title: "تحديث غير موجود | فينيسيا للتطوير العقاري",
      description:
        "التحديث المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
    },
    fallbackContent: [
      "هذا التحديث يوثق مرحلة تنفيذية من داخل الموقع، ضمن التزام فينيسيا بعرض حركة العمل كما هي، خطوة بخطوة.",
      "كل مرحلة يتم تنفيذها تحت إشراف ومراجعة، لأن الجودة لا تبدأ عند التسليم، بل تبدأ من التفاصيل التي لا يراها العميل الآن.",
      "الثقة مش وعد… الثقة فعل.",
    ],
    cta: {
      message: "تابع تحديثات التنفيذ كما تحدث على أرض الواقع.",
      backLabel: "العودة للتحديثات",
    },
    related: {
      eyebrow: "Related Updates",
      title: "تحديثات ذات صلة",
      actionLabel: "عرض التحديث",
    },
    heroVariant: "default",
  },
  videos: {
    mediaType: "video",
    cmsPageSlug: "media-center-videos",
    basePath: "/media-center/videos",
    layoutEyebrow: "Video",
    breadcrumbSectionLabel: "الفيديوهات",
    notFound: {
      title: "فيديو غير موجود | فينيسيا للتطوير العقاري",
      description:
        "الفيديو المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
    },
    fallbackContent: [
      "هذا المحتوى المرئي جزء من توثيق فينيسيا المستمر لحركة التنفيذ داخل المشروعات، ليبقى العميل قريبًا من المشهد كما يحدث على أرض الواقع.",
      "الفيديو هنا ليس عرضًا دعائيًا منفصلًا، بل امتداد لفلسفة الشركة: أن يرى العميل التنفيذ، لا أن يسمع عنه فقط.",
      "تابعونا لحظة بلحظة وشوفوا التنفيذ بيتحوّل لواقع.",
    ],
    cta: {
      message: "شاهد المزيد من الفيديوهات والجولات المرئية داخل المركز الإعلامي.",
      backLabel: "العودة للفيديوهات",
    },
    related: {
      eyebrow: "Related Videos",
      title: "فيديوهات ذات صلة",
      actionLabel: "مشاهدة الفيديو",
    },
    heroVariant: "video",
    showDurationBadge: true,
  },
  gallery: {
    mediaType: "gallery",
    cmsPageSlug: "media-center-gallery",
    basePath: "/media-center/gallery",
    layoutEyebrow: "Gallery",
    breadcrumbSectionLabel: "معرض الصور",
    notFound: {
      title: "معرض غير موجود | فينيسيا للتطوير العقاري",
      description:
        "المعرض المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
    },
    fallbackContent: [
      "هذه الصور جزء من التوثيق المستمر لمراحل التنفيذ داخل مشروعات فينيسيا للتطوير العقاري.",
      "الهدف ليس عرض صور جميلة فقط، بل توثيق ما يحدث على أرض الواقع وإظهار التفاصيل التنفيذية كما هي.",
      "لأن الثقة تبدأ عندما يرى العميل ما يتم تنفيذه بالفعل.",
    ],
    cta: {
      message: "استكشف المزيد من الصور والجولات الميدانية داخل مشروعات فينيسيا.",
      backLabel: "العودة للمعرض",
    },
    related: {
      eyebrow: "Related Gallery",
      title: "معارض ذات صلة",
      actionLabel: "عرض المعرض",
    },
    heroVariant: "gallery",
  },
} as const satisfies Record<string, MediaDetailPageConfig>;

export type MediaDetailPageKey = keyof typeof MEDIA_DETAIL_PAGE_CONFIG;
