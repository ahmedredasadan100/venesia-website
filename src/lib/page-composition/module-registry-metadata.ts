import type { PageModuleKind } from "../page-blocks/types";
import type {
  ModuleEditorCompositionApplicability,
  ResolvedModuleEditorCompositionApplicability,
} from "../page-blocks/module-editor-presentation-contract";
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

/** Functional tab labels belong to module metadata; section headings remain independent. */
export const MODULE_EDITOR_TAB_LABELS = {
  text: "النصوص",
  images: "الصور",
  cards: "البطاقات",
  visibility: "الظهور",
  cta: "الزر والرابط",
} as const;

export type ModuleEditorSectionMetadata = {
  navigationLabelAr: string;
  sectionHeadingAr: string | null;
  sectionDescriptionAr: string | null;
  icon: ModuleEditorIconToken;
  operationalRole?: "settings" | "visibility";
  sectionChrome?: "implicit";
  /** Explicit reference applicability only; absence is not approval or an exception. */
  composition?: ModuleEditorCompositionApplicability;
};

type ModuleEditorSections = Record<string, ModuleEditorSectionMetadata>;

export type ModuleKindMetadata = {
  kind: PageModuleKind;
  labelAr: string;
  descriptionAr: string;
  editorSections: ModuleEditorSections;
};

export type SlotModuleSlugMetadata = {
  slug: string;
  labelAr: string;
  descriptionAr: string;
  editorSections?: ModuleEditorSections;
  /** Opt in to the saved entity name without changing registry identity or other headers. */
  editorTitleSource?: "entity-name";
};

const SETTINGS_SECTION: ModuleEditorSectionMetadata = {
  navigationLabelAr: "الإعدادات",
  sectionHeadingAr: "إعدادات الموديول",
  sectionDescriptionAr: "أدر الهوية الداخلية وحالة نشر الموديول.",
  icon: "settings",
  operationalRole: "settings",
};

const PAGES_SECTION: ModuleEditorSectionMetadata = {
  navigationLabelAr: MODULE_EDITOR_TAB_LABELS.visibility,
  sectionHeadingAr: "الظهور في الصفحات",
  sectionDescriptionAr: null,
  icon: "plans",
  operationalRole: "visibility",
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

export const MODULE_KIND_METADATA: Record<PageModuleKind, ModuleKindMetadata> = {
  hero: {
    kind: "hero",
    labelAr: "الهيرو",
    descriptionAr: "شريحة علوية سينمائية — صور، عنوان، وCTA رئيسي للصفحة.",
    editorSections: {
      content: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
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
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images,
        sectionHeadingAr: "صور الهيرو",
        sectionDescriptionAr: "أدر صور سطح المكتب والهاتف المحمول وتكوين عرضها من مكان واحد.",
        icon: "media",
      },
      buttons: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cta,
        sectionHeadingAr: "أزرار الهيرو وروابطها",
        sectionDescriptionAr: "أدر نصوص أزرار الإجراء ووجهاتها.",
        icon: "section",
      },
      display: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.visibility,
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
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      images: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images,
        sectionHeadingAr: "صورة الخلفية",
        sectionDescriptionAr: "أدر صورة خلفية الدعوة للإجراء.",
        icon: "media",
      },
      cta: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cta,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "section",
        sectionChrome: "implicit",
      },
      presentation: {
        navigationLabelAr: "إعدادات العرض",
        sectionHeadingAr: "إعدادات العرض",
        sectionDescriptionAr: "اختر نمط خلفية الدعوة للإجراء.",
        icon: "settings",
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
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      cards: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cards,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "section",
        sectionChrome: "implicit",
      },
      presentation: {
        navigationLabelAr: "إعدادات العرض",
        sectionHeadingAr: "إعدادات العرض",
        sectionDescriptionAr: "اضبط عدد أعمدة البطاقات في العرض العام.",
        icon: "settings",
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
        navigationLabelAr: "مصدر المحتوى",
        sectionHeadingAr: "مصدر المحتوى",
        sectionDescriptionAr: "حدّد نوع المحتوى والتصنيفات والسلاسل المستخدمة.",
        icon: "content",
      },
      text: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      presentation: {
        navigationLabelAr: "إعدادات العرض",
        sectionHeadingAr: "إعدادات العرض",
        sectionDescriptionAr: "اضبط عدد النتائج ونمط العرض وخيارات التنقل المتاحة.",
        icon: "settings",
      },
      formatting: {
        navigationLabelAr: "تنسيق عناصر المحتوى",
        sectionHeadingAr: "تنسيق عناصر المحتوى",
        sectionDescriptionAr: "خصّص ظهور عناصر المحتوى وتنسيقها حسب نوع الموديول.",
        icon: "section",
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
        navigationLabelAr: "مصدر المحتوى",
        sectionHeadingAr: "مصدر المحتوى المميز",
        sectionDescriptionAr: "حدّد المصدر وطريقة الاختيار دون ربطها بطريقة العرض.",
        icon: "content",
      },
      text: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      presentation: {
        navigationLabelAr: "تنسيق عناصر المحتوى",
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
        navigationLabelAr: "إعدادات المحتوى",
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
        sectionDescriptionAr: "حرّر نصوص السكشن مع بقاء إعدادات العرض في قسمها المستقل.",
        icon: "media",
      },
      presentation: {
        navigationLabelAr: "العرض",
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "media",
        sectionChrome: "implicit",
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
  "media-featured-content-news": {
    slug: "media-featured-content-news",
    labelAr: MODULE_KIND_METADATA.featured.labelAr,
    descriptionAr: MODULE_KIND_METADATA.featured.descriptionAr,
    editorSections: {
      content: { ...MODULE_KIND_METADATA.featured.editorSections.content, navigationLabelAr: "مصدر المحتوى" },
      text: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "content", sectionChrome: "implicit" },
      presentation: { ...MODULE_KIND_METADATA.featured.editorSections.presentation, navigationLabelAr: "تنسيق عناصر المحتوى" },
    },
  },
  "media-listing-presentation-news": {
    slug: "media-listing-presentation-news",
    labelAr: MODULE_KIND_METADATA["media-hub"].labelAr,
    descriptionAr: MODULE_KIND_METADATA["media-hub"].descriptionAr,
    editorSections: {
      content: {
        ...MODULE_KIND_METADATA["media-hub"].editorSections.content,
        navigationLabelAr: "إعدادات القائمة",
      },
      presentation: {
        ...MODULE_KIND_METADATA["media-hub"].editorSections.presentation,
        navigationLabelAr: "إعدادات العرض",
      },
    },
  },
  "home-story": {
    slug: "home-story",
    editorTitleSource: "entity-name",
    labelAr: "قصة فينيسيا",
    descriptionAr: "سرد تمهيدي للصفحة الرئيسية.",
    editorSections: {
      text: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      images: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images,
        sectionHeadingAr: "صور قسم القصة",
        sectionDescriptionAr: "اختر صور القسم واضبط أوصافها وترتيبها.",
        icon: "media",
      },
      cta: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cta,
        sectionHeadingAr: "زر قسم القصة",
        sectionDescriptionAr: "أدر نص زر الإجراء ومظهره.",
        icon: "section",
        composition: {
          role: "reference",
          functionalScope: "standalone-cta",
          source: {
            sourceFile: "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
            exportName: "default",
            mode: { editorMode: "home-story" },
            section: "cta",
          },
          rationale: "The approved Story CTA separates button data from appearance and behavior through existing shared presentation owners.",
        },
      },
      pages: { ...PAGES_SECTION, sectionDescriptionAr: "حدد الصفحات التي يظهر بها الموديول." },
    },
  },
  "home-trust": {
    slug: "home-trust",
    labelAr: "ثقة فينيسيا",
    descriptionAr: "شبكة مبادئ/ثقة للصفحة الرئيسية.",
    editorSections: {
      content: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      cards: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cards,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "section",
        sectionChrome: "implicit",
      },
      pages: { ...PAGES_SECTION, sectionDescriptionAr: "حدد الصفحات التي يظهر بها الموديول." },
    },
  },
  "home-projects": {
    slug: "home-projects",
    labelAr: "مشاريع الرئيسية",
    descriptionAr: "يعرض مشاريع homepage من جدول projects.",
    editorSections: {
      content: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "content", sectionChrome: "implicit" },
      projects: { navigationLabelAr: "إعدادات المشاريع", sectionHeadingAr: null, sectionDescriptionAr: null, icon: "settings", sectionChrome: "implicit" },
      cta: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cta,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "section",
        sectionChrome: "implicit",
        composition: {
          role: "adopter",
          functionalScope: "standalone-cta",
          source: {
            sourceFile: "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
            exportName: "default",
            mode: {},
            section: "cta",
          },
          reference: { moduleSlug: "home-story", sectionId: "cta" },
          rationale: "The Home Projects footer CTA uses the reference's data and appearance/behavior groups while retaining its existing domain contract.",
          contractDifferences: [
            "The footer CTA retains its existing visibility setting and center alignment default; the Story CTA defaults to right alignment.",
            "The adopter does not acquire Story-only icon or anchor editing.",
          ],
        },
      },
      pages: PAGES_SECTION,
    },
  },
  "home-contact": {
    slug: "home-contact",
    labelAr: "تواصل الرئيسية",
    descriptionAr: "CTA تواصل مع صورة ووسائل اتصال.",
    editorSections: {
      text: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      image: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "media",
        sectionChrome: "implicit",
      },
      cta: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cta,
        sectionHeadingAr: "زر قسم التواصل",
        sectionDescriptionAr: "أدر نص زر الإجراء ووجهته والملاحظة المصاحبة.",
        icon: "section",
      },
      contacts: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cards,
        sectionHeadingAr: "وسائل التواصل",
        sectionDescriptionAr: "أدر بيانات التواصل وترتيب ظهورها وروابطها.",
        icon: "location",
      },
      pages: { ...PAGES_SECTION, sectionDescriptionAr: "حدد الصفحات التي يظهر بها الموديول." },
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
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.visibility,
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
    editorSections: {
      text: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "content", sectionChrome: "implicit" },
      images: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images, sectionHeadingAr: "صور المقدمة", sectionDescriptionAr: "أدر صور المقدمة وأوصافها مع الحفاظ على موضع كل صورة.", icon: "media" },
      cards: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cards, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "section", sectionChrome: "implicit" },
      pages: { ...PAGES_SECTION, sectionDescriptionAr: "حدد الصفحات التي يظهر بها الموديول." },
    },
  },
  "about-intro-single-image": {
    slug: "about-intro-single-image",
    labelAr: "من نحن — محتوى وصورة واحدة",
    descriptionAr: "محتوى من نحن بصورة واحدة وموضع يمين/يسار.",
    editorSections: {
      content: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "content", sectionChrome: "implicit" },
      images: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "media", sectionChrome: "implicit" },
      cards: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cards, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "section", sectionChrome: "implicit" },
      pages: PAGES_SECTION,
    },
  },
  "vision-goals": {
    slug: "vision-goals",
    labelAr: "الرؤية والأهداف",
    descriptionAr: "نصوص وصورة قسم الرؤية والأهداف في صفحة من نحن.",
    editorSections: {
      content: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "content", sectionChrome: "implicit" },
      images: { navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images, sectionHeadingAr: null, sectionDescriptionAr: null, icon: "media", sectionChrome: "implicit" },
      vision: { navigationLabelAr: "الرؤية", sectionHeadingAr: null, sectionDescriptionAr: null, icon: "overview", sectionChrome: "implicit" },
      goals: { navigationLabelAr: "الأهداف", sectionHeadingAr: null, sectionDescriptionAr: null, icon: "plans", sectionChrome: "implicit" },
      pages: PAGES_SECTION,
    },
  },
  "about-cta": {
    slug: "about-cta",
    labelAr: "دعوة للتواصل",
    descriptionAr: "قسم دعوة للتواصل في صفحة من نحن مع صورة وزر ووسائل اتصال.",
    editorSections: {
      text: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "content",
        sectionChrome: "implicit",
      },
      image: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.images,
        sectionHeadingAr: null,
        sectionDescriptionAr: null,
        icon: "media",
        sectionChrome: "implicit",
      },
      cta: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.cta,
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
    editorSections: {
      ...CONTENT_MODULE_SECTIONS,
      content: {
        ...CONTENT_MODULE_SECTIONS.content,
        composition: {
          functionalScope: "compact-inline-settings",
          role: "reference",
          source: {
            sourceFile: "src/components/admin/page-blocks/editors/AboutApproachModuleEditor.tsx",
            exportName: "default",
            mode: {},
            section: "content",
          },
          rationale: "صفّا النص القصير والوصف يستخدمان مالك الإظهار والتنسيق المشترك؛ الأدوات وفق قدرات الحقل، والمدخل في صف تالٍ بعرض البطاقة الداخلي كاملًا. لا يشمل الاعتماد المحررات المتخصصة أو موافقة المالك البصرية.",
          visualReference: {
            assetName: "Premium Arabic Inline Settings UI Guide.png",
            assetPath: "docs/references/admin/compact-inline-settings.png",
            sha256: "7cbf467b1fe71df80a7bd1d14597c494359632115a26d39b45caf9e4eb812357",
            inputPlacement: "full-card-internal-width",
          },
        },
      },
    },
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
      formatting: { navigationLabelAr: "تنسيق العرض", sectionHeadingAr: null, sectionDescriptionAr: null, icon: "settings", sectionChrome: "implicit" },
      pages: PAGES_SECTION,
    },
  },
  "search-platform": {
    slug: "search-platform",
    labelAr: "منصة البحث",
    descriptionAr:
      "بحث موحّد في المحتوى العام؛ مصدر النتائج هو نظام قراءة المحتوى العام، والظهور مملوك لتعيينات الصفحات.",
    editorSections: {
      content: {
        navigationLabelAr: MODULE_EDITOR_TAB_LABELS.text,
        sectionHeadingAr: "نصوص واجهة البحث",
        sectionDescriptionAr: "أدر نصوص واجهة البحث وتنسيقها وحالات النتائج.",
        icon: "content",
      },
      search: {
        navigationLabelAr: "إعدادات البحث",
        sectionHeadingAr: "إعدادات البحث",
        sectionDescriptionAr: "حدّد نطاق البحث وأنواع المحتوى والفلاتر المتاحة.",
        icon: "seo",
        operationalRole: "settings",
      },
      presentation: {
        navigationLabelAr: "إعدادات العرض",
        sectionHeadingAr: "إعدادات العرض",
        sectionDescriptionAr: "اضبط عدد النتائج وطريقة عرضها وترتيبها.",
        icon: "settings",
        operationalRole: "settings",
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
  return Object.hasOwn(MODULE_KIND_METADATA, kind)
    ? MODULE_KIND_METADATA[kind as PageModuleKind]
    : null;
}

export function getSlotModuleSlugMetadata(slug: string): SlotModuleSlugMetadata | null {
  return SLOT_MODULE_SLUG_METADATA[slug] ?? null;
}

/** Resolves explicit declarations in the existing metadata; does not infer applicability. */
export function resolveModuleEditorCompositionApplicability(
  moduleSlug: string,
  sectionId: string,
  metadata: Readonly<Record<string, SlotModuleSlugMetadata>> = SLOT_MODULE_SLUG_METADATA,
): ResolvedModuleEditorCompositionApplicability | null {
  const read = (slug: string, section: string) => Object.hasOwn(metadata, slug)
    ? metadata[slug]?.editorSections?.[section]?.composition
    : undefined;
  const validate = (declaration: ModuleEditorCompositionApplicability) => {
    const identity = declaration.source;
    if (
      !["standalone-cta", "compact-inline-settings"].includes(declaration.functionalScope) ||
      !["reference", "adopter"].includes(declaration.role) ||
      !declaration.rationale?.trim() ||
      !identity?.sourceFile?.trim() || !identity.exportName?.trim() || !identity.section?.trim() ||
      !identity.mode || typeof identity.mode !== "object" || Array.isArray(identity.mode) ||
      Object.entries(identity.mode).some(([key, value]) => !key.trim() || typeof value !== "string" || !value.trim()) ||
      (declaration.functionalScope === "compact-inline-settings" && declaration.role === "reference" && (
        !declaration.visualReference?.assetName?.trim() ||
        !declaration.visualReference.assetPath?.trim() ||
        !/^[a-f0-9]{64}$/u.test(declaration.visualReference.sha256) ||
        declaration.visualReference.inputPlacement !== "full-card-internal-width"
      )) ||
      (declaration.role === "adopter" && (
        !declaration.reference?.moduleSlug?.trim() || !declaration.reference.sectionId?.trim() ||
        !Array.isArray(declaration.contractDifferences) ||
        declaration.contractDifferences.some((difference) => typeof difference !== "string" || !difference.trim())
      ))
    ) throw new Error("Invalid module editor composition declaration.");
  };
  const applicability = read(moduleSlug, sectionId);
  if (!applicability) return null;
  validate(applicability);
  if (applicability.role === "reference") return { applicability, reference: applicability };

  const reference = read(applicability.reference.moduleSlug, applicability.reference.sectionId);
  if (!reference) throw new Error("Module editor composition reference is missing.");
  validate(reference);
  if (reference.role !== "reference" || reference.functionalScope !== applicability.functionalScope) {
    throw new Error("Module editor composition target must be a reference in the same functional scope.");
  }
  return { applicability, reference };
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
    titleAr: slugMetadata?.editorTitleSource === "entity-name"
      ? entityName?.trim() || owner.labelAr
      : slugMetadata?.labelAr ?? entityName ?? owner.labelAr,
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
  const labels: Record<string, string> = {
    hero: "الهيرو",
    main: "المحتوى الرئيسي",
    sidebar: "الشريط الجانبي",
    bottom: "أسفل الصفحة",
    footer: "قبل الفوتر",
  };
  return positions.map((slot) => labels[slot]).join(" · ");
}
