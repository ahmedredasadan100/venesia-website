import type { MediaContentType } from "./types";

export type MediaDetailPageConfig = {
  mediaType: MediaContentType;
  layoutEyebrow: string;
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
  showProjectBadge?: boolean;
  showDurationBadge?: boolean;
};

export const MEDIA_DETAIL_PAGE_CONFIG = {
  news: {
    mediaType: "news",
    layoutEyebrow: "News",
    notFound: {
      title: "خبر غير موجود",
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
    showProjectBadge: true,
  },
  press: {
    mediaType: "press",
    layoutEyebrow: "Press",
    notFound: {
      title: "بيان غير موجود",
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
  },
  "site-updates": {
    mediaType: "site_update",
    layoutEyebrow: "Site Update",
    notFound: {
      title: "تحديث غير موجود",
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
  },
  videos: {
    mediaType: "video",
    layoutEyebrow: "Video",
    notFound: {
      title: "فيديو غير موجود",
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
    showDurationBadge: true,
  },
  gallery: {
    mediaType: "gallery",
    layoutEyebrow: "Gallery",
    notFound: {
      title: "معرض غير موجود",
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
  },
} as const satisfies Record<string, MediaDetailPageConfig>;

export type MediaDetailPageKey = keyof typeof MEDIA_DETAIL_PAGE_CONFIG;

/** The entity image is reused by multiple selected public presentations. */
export function mediaContentSlot(slot: "image" | "galleryImage" | "videoPoster"): import("../media/media-slot-contract").MediaSlotContract {
  return { owner: "media-center/detail-and-listing", slot, device: "all",
    evidence: ["src/components/media-center/MediaDetailArticle.tsx", "src/components/media-center/MediaCenterCollectionItems.tsx", "src/app/(site)/topics/[slug]/page.tsx", "src/components/InternalPageLayout.tsx", "src/lib/hero/hero-content-controls.ts", "src/components/collection-modules/CollectionListingPresenter.tsx", "src/components/sidebar-feeds/SidebarLatestArticlesWidget.tsx", "src/components/featured/FeaturedContentCard.tsx"],
    design: slot === "galleryImage" ? {
      kind: "recommended", width: 2560, height: 1920,
      rationale: "نسبة 4:3 تطابق إطار معرض التفاصيل. عرض تصميم 2560 يغطي حتى عمود كامل داخل جسم الصفحة ذي الحد الأقصى 1280 بكسل بكثافة 2×، سواء تفعّل تخطيط العمودين أو بقي عمود واحد.",
      composition: "احتفظ بالتفاصيل المهمة داخل الإطار؛ هذه التوصية لمعرض التفاصيل ولا تضمن منع القص إذا استُخدم الأصل في موضع آخر.",
    } : slot === "image" ? {
      kind: "recommended", width: 3840, height: 2560,
      rationale: "ماستر 3:2 كحل وسط بين Hero التفاصيل والبطاقات والعرض القريب من المربع على الهاتف؛ عرض 3840 يدعم شاشة حتى 1920 بكسل بكثافة 2×. ليست هذه نسبة جميع مواضع العرض ولا ضمانًا لعدم القص.",
      composition: "ضع العنصر الأساسي قرب المركز، داخل 40% من العرض و30% من الارتفاع في المركز كنقطة بداية. اترك بقية الصورة خلفية قابلة للقص؛ لا تضع كتابة أساسية داخل الصورة. راجع Hero والبطاقات مع النصوص والحركة؛ المواضع المرنة قد تقص أكثر.",
    } : {
      kind: "no-single-size",
      rationale: "غلاف الفيديو يتنقل بين إطار المشغل والبطاقات، ولا يحدد هذا الحقل قالبًا واحدًا أو مساحة نص ثابتة.",
      composition: "ابدأ بتكوين أفقي يضع الموضوع في المركز، واترك حواف قابلة للقص؛ راجع المشغل والبطاقة قبل الاعتماد.",
    },
    display: slot === "galleryImage" ? { kind: "ratio", ratio: [4, 3] } : { kind: "responsive", description: "تُستخدم الصورة في مواضع عرض متعددة حسب القالب والبطاقة؛ لا توجد أبعاد بكسل أو نسبة واحدة مطلوبة للملف." },
    fit: slot === "galleryImage" ? "cover" : undefined,
  };
}
