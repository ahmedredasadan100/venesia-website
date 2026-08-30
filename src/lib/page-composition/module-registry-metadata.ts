import type { PageModuleKind } from "../page-blocks/types";
import type { PageCompositionPosition } from "./positions";
import { getAssignablePositions } from "./page-assignment-contract.ts";

export type ModuleEditorIconToken =
  | "content"
  | "faq"
  | "location"
  | "media"
  | "overview"
  | "plans"
  | "publish"
  | "section"
  | "seo"
  | "settings"
  | "specifications";

export type ModuleEditorSectionMetadata = {
  navigationLabelAr: string;
  sectionHeadingAr: string | null;
  sectionDescriptionAr: string | null;
  icon: ModuleEditorIconToken;
  operationalRole?: "settings" | "visibility";
  sectionChrome?: "implicit";
};

type ModuleEditorSections = Record<string, ModuleEditorSectionMetadata>;

export type ModuleKindMetadata = {
  kind: PageModuleKind | string;
  labelAr: string;
  descriptionAr: string;
  editorSections: ModuleEditorSections;
};

export type SlotModuleSlugMetadata = {
  slug: string;
  labelAr: string;
  descriptionAr: string;
  editorSections?: ModuleEditorSections;
};

const SETTINGS_SECTION: ModuleEditorSectionMetadata = {
  navigationLabelAr: "الإعدادات",
  sectionHeadingAr: "إعدادات الموديول",
  sectionDescriptionAr: "أدر الهوية الداخلية وحالة نشر الموديول.",
  icon: "settings",
  operationalRole: "settings",
};

const PAGES_SECTION: ModuleEditorSectionMetadata = {
  navigationLabelAr: "الصفحات",
  sectionHeadingAr: "الظهور في الصفحات",
  sectionDescriptionAr: null,
  icon: "plans",
  operationalRole: "visibility",
};

const HOME_PAGES_SECTION: ModuleEditorSectionMetadata = {
  ...PAGES_SECTION,
  navigationLabelAr: "الظهور",
};

const CONTENT_MODULE_SECTIONS: ModuleEditorSections = {
  content: {
    navigationLabelAr: "المحتوى",
    sectionHeadingAr: null,
    sectionDescriptionAr: null,
    icon: "content",
    sectionChrome: "implicit",
  },
  meta: SETTINGS_SECTION,
  settings: SETTINGS_SECTION,
  pages: PAGES_SECTION,
};

export const MODULE_KIND_METADATA: Record<string, ModuleKindMetadata> = {
  hero: {
    kind: "hero",
    labelAr: "الهيرو",
    descriptionAr: "شريحة علوية سينمائية — صور، عنوان، وCTA رئيسي للصفحة.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "محتوى الهيرو",
        sectionDescriptionAr: "أدر النصوص والعناصر الأساسية الظاهرة داخل الهيرو.",
        icon: "content",
      },
      order: {
        navigationLabelAr: "الترتيب",
        sectionHeadingAr: "ترتيب عناصر الهيرو",
        sectionDescriptionAr: "حدّد ترتيب ظهور عناصر الهيرو للصفحات الداخلية.",
        icon: "plans",
      },
      media: {
        navigationLabelAr: "الصور",
        sectionHeadingAr: "صور الهيرو",
        sectionDescriptionAr: "أدر صور سطح المكتب والهاتف المحمول وتكوين عرضها من مكان واحد.",
        icon: "media",
      },
      buttons: {
        navigationLabelAr: "الأزرار",
        sectionHeadingAr: "أزرار الهيرو وروابطها",
        sectionDescriptionAr: "أدر نصوص أزرار الإجراء ووجهاتها.",
        icon: "section",
      },
      display: {
        navigationLabelAr: "الصفحات",
        sectionHeadingAr: "ربط الهيرو بالصفحات",
        sectionDescriptionAr: "راجع الصفحات المرتبطة بالهيرو وحدّث التعيينات عند الحاجة.",
        icon: "settings",
        operationalRole: "visibility",
      },
    },
  },
  breadcrumb: {
    kind: "breadcrumb",
    labelAr: "مسار التنقل",
    descriptionAr: "مسار تنقل تلقائي أو يدوي للصفحات الداخلية.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      settings: {
        ...SETTINGS_SECTION,
        sectionDescriptionAr: "أدر اسم الموديول ووصفه الداخلي وحالة النشر.",
      },
      pages: PAGES_SECTION,
    },
  },
  content: {
    kind: "content",
    labelAr: "محتوى",
    descriptionAr: "كتل محتوى نصية/بصرية متخصصة حسب slug الصفحة.",
    editorSections: CONTENT_MODULE_SECTIONS,
  },
  cta: {
    kind: "cta",
    labelAr: "دعوة لإجراء",
    descriptionAr: "شريط CTA بعنوان ونص وزر وروابط.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      meta: SETTINGS_SECTION,
      pages: PAGES_SECTION,
    },
  },
  cards: {
    kind: "cards",
    labelAr: "بطاقات",
    descriptionAr: "شبكة بطاقات بعناوين وروابط وصور.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      meta: {
        ...SETTINGS_SECTION,
        sectionDescriptionAr: "أدر الهوية الداخلية وحالة النشر وتخطيط الأعمدة.",
      },
      pages: PAGES_SECTION,
    },
  },
  feed: {
    kind: "feed",
    labelAr: "خلاصة موضوعات",
    descriptionAr: "ودجت يجلب موضوعات أو تصنيفات منشورة من Supabase.",
    editorSections: {
      content: {
        navigationLabelAr: "إعدادات Feed",
        sectionHeadingAr: "محتوى وفلترة الـFeed",
        sectionDescriptionAr: "حدّد مصدر الموضوعات والفلاتر وعدد النتائج وخيارات العرض.",
        icon: "content",
      },
      settings: SETTINGS_SECTION,
      pages: PAGES_SECTION,
    },
  },
  featured: {
    kind: "featured",
    labelAr: "Featured",
    descriptionAr: "قسم محتوى مميز مستقل يقرأ من المحتوى العام ويُرتّب عبر Page Composition.",
    editorSections: {
      content: {
        navigationLabelAr: "المصدر والاختيار",
        sectionHeadingAr: "مصدر المحتوى المميز",
        sectionDescriptionAr: "حدّد المصدر وطريقة الاختيار دون ربطها بطريقة العرض.",
        icon: "content",
      },
      presentation: {
        navigationLabelAr: "العرض",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "media",
        sectionChrome: "implicit",
      },
      settings: SETTINGS_SECTION,
      pages: PAGES_SECTION,
    },
  },
  "media-sidebar": {
    kind: "media-sidebar",
    labelAr: "شريط إعلامي جانبي",
    descriptionAr: "ودجات المركز الإعلامي في الشريط الجانبي.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "إعدادات الشريط الجانبي",
        sectionDescriptionAr: "حدّد مصدر المحتوى وطريقة الاختيار وعدد العناصر المعروضة.",
        icon: "media",
      },
      settings: {
        ...SETTINGS_SECTION,
        sectionDescriptionAr: "أدر الوصف الداخلي وحالة نشر الموديول.",
      },
      pages: PAGES_SECTION,
    },
  },
  "media-hub": {
    kind: "media-hub",
    labelAr: "موديولات المركز الإعلامي",
    descriptionAr: "أقسام Hub وإعدادات عرض قوائم المركز الإعلامي باستخدام مالك الموديولات الحالي.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "إعدادات موديول المركز الإعلامي",
        sectionDescriptionAr: "حدّد وظيفة الموديول ونوع المحتوى وإعدادات العرض التابعة له.",
        icon: "media",
      },
      settings: {
        ...SETTINGS_SECTION,
        sectionDescriptionAr: "أدر الوصف الداخلي وحالة نشر الموديول.",
      },
      pages: PAGES_SECTION,
    },
  },
};

export const SLOT_MODULE_SLUG_METADATA: Record<string, SlotModuleSlugMetadata> = {
  "home-story": {
    slug: "home-story",
    labelAr: "قصة فينيسيا",
    descriptionAr: "سرد تمهيدي للصفحة الرئيسية.",
    editorSections: {
      text: {
        navigationLabelAr: "النص",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      images: {
        navigationLabelAr: "الصور",
        sectionHeadingAr: "صور قسم القصة",
        sectionDescriptionAr: "اختر صور القسم واضبط أوصافها وترتيبها.",
        icon: "media",
      },
      cta: {
        navigationLabelAr: "الزر والرابط",
        sectionHeadingAr: "زر قسم القصة",
        sectionDescriptionAr: "أدر نص زر الإجراء ووجهته.",
        icon: "section",
      },
      pages: HOME_PAGES_SECTION,
    },
  },
  "home-trust": {
    slug: "home-trust",
    labelAr: "ثقة فينيسيا",
    descriptionAr: "شبكة مبادئ/ثقة للصفحة الرئيسية.",
    editorSections: {
      pages: HOME_PAGES_SECTION,
    },
  },
  "home-projects": {
    slug: "home-projects",
    labelAr: "مشاريع الرئيسية",
    descriptionAr: "يعرض مشاريع homepage من جدول projects.",
    editorSections: {
      pages: HOME_PAGES_SECTION,
    },
  },
  "home-contact": {
    slug: "home-contact",
    labelAr: "تواصل الرئيسية",
    descriptionAr: "CTA تواصل مع صورة ووسائل اتصال.",
    editorSections: {
      text: {
        navigationLabelAr: "النص",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      image: {
        navigationLabelAr: "الصورة",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "media",
        sectionChrome: "implicit",
      },
      cta: {
        navigationLabelAr: "الزر والرابط",
        sectionHeadingAr: "زر قسم التواصل",
        sectionDescriptionAr: "أدر نص زر الإجراء ووجهته والملاحظة المصاحبة.",
        icon: "section",
      },
      contacts: {
        navigationLabelAr: "وسائل التواصل",
        sectionHeadingAr: "وسائل التواصل",
        sectionDescriptionAr: "أدر بيانات التواصل وترتيب ظهورها وروابطها.",
        icon: "location",
      },
      pages: HOME_PAGES_SECTION,
    },
  },
  "projects-hub-hero": {
    slug: "projects-hub-hero",
    labelAr: "هيرو صفحة المشروعات",
    descriptionAr: "هيرو /projects — الشرائح من جدول projects.",
    editorSections: {
      content: {
        navigationLabelAr: "شرائح الهيرو",
        sectionHeadingAr: "Hero صفحة المشروعات",
        sectionDescriptionAr:
          "تحكم في مصدر شرائح المشروعات والبيانات الظاهرة داخل كل شريحة.",
        icon: "content",
      },
      buttons: {
        navigationLabelAr: "زر التفاصيل",
        sectionHeadingAr: "زر فتح تفاصيل المشروع",
        sectionDescriptionAr:
          "تحكم في نص وتنسيق الزر الذي ينقل من الشريحة إلى صفحة تفاصيل المشروع.",
        icon: "section",
      },
      order: {
        navigationLabelAr: "ترتيب البيانات",
        sectionHeadingAr: "ترتيب بيانات شريحة المشروع",
        sectionDescriptionAr:
          "حدد ترتيب بيانات المشروع الظاهرة داخل شرائح Hero صفحة المشروعات.",
        icon: "plans",
      },
      details: {
        navigationLabelAr: "Hero التفاصيل",
        sectionHeadingAr: "Hero تفاصيل المشروع",
        sectionDescriptionAr:
          "افتح المحرر المستقل أو انتقل مباشرة إلى أحد إجراءات Hero التفاصيل.",
        icon: "section",
      },
      display: {
        navigationLabelAr: "الصفحات",
        sectionHeadingAr: "ظهور Hero صفحة المشروعات",
        sectionDescriptionAr: "راجع الصفحة المرتبطة بهذا Hero.",
        icon: "settings",
        operationalRole: "visibility",
      },
    },
  },
  "projects-hub-featured": {
    slug: "projects-hub-featured",
    labelAr: "المشروعات المميزة",
    descriptionAr: "سكشن المشروعات المميزة على /projects.",
  },
  "projects-hub-listing": {
    slug: "projects-hub-listing",
    labelAr: "قائمة المشروعات",
    descriptionAr: "فهرس المشروعات مع الفلاتر على /projects.",
  },
  "projects-hub-map": {
    slug: "projects-hub-map",
    labelAr: "خريطة المشروعات",
    descriptionAr: "خريطة بيت الوطن وربط الدبابيس بكود المشروع.",
  },
  "about-intro": {
    slug: "about-intro",
    labelAr: "من نحن — المقدمة",
    descriptionAr: "مقدمة بصرية لصفحة عن فينيسيا.",
  },
  "about-intro-single-image": {
    slug: "about-intro-single-image",
    labelAr: "من نحن — محتوى وصورة واحدة",
    descriptionAr: "محتوى من نحن بصورة واحدة وموضع يمين/يسار.",
  },
  "vision-goals": {
    slug: "vision-goals",
    labelAr: "الرؤية والأهداف",
    descriptionAr: "نصوص وصورة قسم الرؤية والأهداف في صفحة من نحن.",
  },
  "about-cta": {
    slug: "about-cta",
    labelAr: "دعوة للتواصل",
    descriptionAr: "قسم دعوة للتواصل في صفحة من نحن مع صورة وزر ووسائل اتصال.",
    editorSections: {
      text: {
        navigationLabelAr: "النص",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      image: {
        navigationLabelAr: "الصورة",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "media",
        sectionChrome: "implicit",
      },
      cta: {
        navigationLabelAr: "الزر والرابط",
        sectionHeadingAr: "زر الدعوة للتواصل",
        sectionDescriptionAr: "أدر نص زر الإجراء ووجهته والملاحظة المصاحبة.",
        icon: "section",
      },
      contacts: {
        navigationLabelAr: "وسائل التواصل",
        sectionHeadingAr: "بيانات التواصل",
        sectionDescriptionAr: "أدر بيانات التواصل وترتيب ظهورها وروابطها.",
        icon: "location",
      },
    },
  },
  "about-principles": {
    slug: "about-principles",
    labelAr: "المبادئ",
    descriptionAr: "عناوين وبطاقات المبادئ في صفحة من نحن.",
  },
  "about-approach": {
    slug: "about-approach",
    labelAr: "منهج العمل",
    descriptionAr: "عنوان ومنهج العمل في صفحة من نحن.",
  },
  "topics-intro": {
    slug: "topics-intro",
    labelAr: "مقدمة الموضوعات",
    descriptionAr: "تمهيد لصفحة topics.",
  },
  "topics-listing": {
    slug: "topics-listing",
    labelAr: "قائمة الموضوعات",
    descriptionAr:
      "يعرض الموضوعات التي ترسلها الصفحة ويتحكم في طريقة عرضها فقط.",
    editorSections: {
      content: {
        navigationLabelAr: "العرض",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      meta: SETTINGS_SECTION,
      pages: PAGES_SECTION,
    },
  },
  "topics-insight-cta": {
    slug: "topics-insight-cta",
    labelAr: "CTA موضوعات",
    descriptionAr: "دعوة لإجراء في صفحة الموضوعات.",
  },
};

export function getModuleKindMetadata(kind: string): ModuleKindMetadata | null {
  return MODULE_KIND_METADATA[kind] ?? null;
}

export function getSlotModuleSlugMetadata(slug: string): SlotModuleSlugMetadata | null {
  return SLOT_MODULE_SLUG_METADATA[slug] ?? null;
}

export type ResolvedModuleEditorHeaderMetadata = {
  eyebrowAr: string | null;
  titleAr: string;
  descriptionAr: string;
};

export function getModuleEditorHeaderMetadata(
  kind: string,
  slug?: string | null,
  entityName?: string | null,
): ResolvedModuleEditorHeaderMetadata | null {
  const kindMetadata = getModuleKindMetadata(kind);
  const slugMetadata = slug ? getSlotModuleSlugMetadata(slug) : null;
  const owner = slugMetadata ?? kindMetadata;
  if (!owner) return null;

  return {
    eyebrowAr: null,
    titleAr: slugMetadata?.labelAr ?? entityName ?? owner.labelAr,
    descriptionAr: owner.descriptionAr,
  };
}

export function getModuleEditorSectionMetadata(
  kind: string,
  sectionId: string,
  slug?: string | null,
): ModuleEditorSectionMetadata | null {
  const slugSection = slug ? getSlotModuleSlugMetadata(slug)?.editorSections?.[sectionId] : null;
  return slugSection ?? getModuleKindMetadata(kind)?.editorSections[sectionId] ?? null;
}

export function getModuleEditorSectionOrder(metadata: ModuleEditorSectionMetadata) {
  if (metadata.operationalRole === "settings") return 1;
  if (metadata.operationalRole === "visibility") return 2;
  return 0;
}

export function getSlotCompatibilityLabel(kind: string) {
  const positions = getAssignablePositions(kind);
  if (!positions.length) return null;
  const labels: Record<PageCompositionPosition, string> = {
    hero: "الهيرو",
    main: "المحتوى الرئيسي",
    sidebar: "الشريط الجانبي",
    bottom: "أسفل الصفحة",
    footer: "قبل الفوتر",
  };
  return positions.map((slot) => labels[slot]).join(" · ");
}
