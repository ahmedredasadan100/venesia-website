import type { PageModuleKind } from "../page-blocks/types";
import type { PageCompositionSlot } from "./slot-module-registry";

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
  sectionHeadingAr: string;
  sectionDescriptionAr: string;
  icon: ModuleEditorIconToken;
};

type ModuleEditorSections = Record<string, ModuleEditorSectionMetadata>;

export type ModuleKindMetadata = {
  kind: PageModuleKind | string;
  labelAr: string;
  descriptionAr: string;
  typicalSlots: PageCompositionSlot[];
  dependencyHints: string[];
  previewNoteAr: string;
  editorSections: ModuleEditorSections;
};

export type SlotModuleSlugMetadata = {
  slug: string;
  labelAr: string;
  descriptionAr: string;
  typicalSlot: PageCompositionSlot;
  dependencyHints: string[];
  editorSections?: ModuleEditorSections;
};

const SETTINGS_SECTION: ModuleEditorSectionMetadata = {
  navigationLabelAr: "الإعدادات",
  sectionHeadingAr: "إعدادات الموديول",
  sectionDescriptionAr: "أدر الهوية الداخلية وحالة نشر الموديول.",
  icon: "settings",
};

const PAGES_SECTION: ModuleEditorSectionMetadata = {
  navigationLabelAr: "الصفحات",
  sectionHeadingAr: "الظهور في الصفحات",
  sectionDescriptionAr: "راجع مواضع استخدام الموديول وحدّد الصفحات المرتبطة به.",
  icon: "plans",
};

const HOME_PAGES_SECTION: ModuleEditorSectionMetadata = {
  ...PAGES_SECTION,
  navigationLabelAr: "الظهور",
};

const CONTENT_MODULE_SECTIONS: ModuleEditorSections = {
  content: {
    navigationLabelAr: "المحتوى",
    sectionHeadingAr: "محتوى الموديول",
    sectionDescriptionAr: "أدر المحتوى والإعدادات المتخصصة لهذا الموديول.",
    icon: "content",
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
    typicalSlots: ["hero"],
    dependencyHints: [
      "يفضّل وجود breadcrumb في نفس فتحة الهيرو للصفحات الداخلية.",
      "صور الهيرو يجب أن تكون بجودة عالية وبنسبة 16:9.",
    ],
    previewNoteAr: "المعاينة العامة تعرض الهيرو المنشور فقط — لا توجد معاينة side-by-side بعد.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "محتوى الهيرو",
        sectionDescriptionAr: "أدر النصوص والعناصر الأساسية الظاهرة داخل الهيرو.",
        icon: "content",
      },
      order: {
        navigationLabelAr: "ترتيب العناصر",
        sectionHeadingAr: "ترتيب عناصر الهيرو",
        sectionDescriptionAr: "حدّد ترتيب ظهور عناصر الهيرو للصفحات الداخلية.",
        icon: "plans",
      },
      "media-desktop": {
        navigationLabelAr: "صور الديسكتوب",
        sectionHeadingAr: "صور الهيرو على الشاشات الكبيرة",
        sectionDescriptionAr: "اختر الصور ورتّبها واضبط موضعها في عرض الديسكتوب.",
        icon: "media",
      },
      "media-mobile": {
        navigationLabelAr: "صور الموبايل",
        sectionHeadingAr: "صور الهيرو على الموبايل",
        sectionDescriptionAr: "أضف صورًا بديلة للموبايل أو اتركها فارغة لاستخدام صور الديسكتوب.",
        icon: "media",
      },
      buttons: {
        navigationLabelAr: "الأزرار",
        sectionHeadingAr: "أزرار الهيرو وروابطها",
        sectionDescriptionAr: "أدر نصوص أزرار الإجراء ووجهاتها.",
        icon: "section",
      },
      display: {
        navigationLabelAr: "العرض والربط",
        sectionHeadingAr: "إعدادات العرض والصفحات",
        sectionDescriptionAr: "اضبط حالة الظهور والمصدر وراجع الصفحات المرتبطة بالهيرو.",
        icon: "settings",
      },
    },
  },
  breadcrumb: {
    kind: "breadcrumb",
    labelAr: "مسار التنقل",
    descriptionAr: "Breadcrumb داخل فتحة الهيرو للصفحات الداخلية.",
    typicalSlots: ["hero"],
    dependencyHints: ["يُربط عادةً مع هيرو نشط على نفس الصفحة."],
    previewNoteAr: "يظهر ضمن الهيرو على الموقع العام.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "محتوى مسار التنقل",
        sectionDescriptionAr: "حدّد مصدر المسار وتسميات عناصره وخيارات ظهوره.",
        icon: "content",
      },
      settings: {
        ...SETTINGS_SECTION,
        sectionDescriptionAr: "أدر الهوية الداخلية ونمط العرض وحالة النشر.",
      },
      pages: PAGES_SECTION,
    },
  },
  content: {
    kind: "content",
    labelAr: "محتوى",
    descriptionAr: "كتل محتوى نصية/بصرية متخصصة حسب slug الصفحة.",
    typicalSlots: ["main", "bottom"],
    dependencyHints: [
      "يعمل أفضل بعد هيرو واضح يحدد سياق الصفحة.",
      "تحقق من الصور والنصوص قبل النشر — التعديل يؤثر على كل الصفحات المرتبطة.",
    ],
    previewNoteAr: "لا توجد معاينة عامة للمسودة — راجع الصفحة المنشورة من الرابط العام.",
    editorSections: CONTENT_MODULE_SECTIONS,
  },
  cta: {
    kind: "cta",
    labelAr: "دعوة لإجراء",
    descriptionAr: "شريط CTA بعنوان ونص وزر وروابط.",
    typicalSlots: ["main", "bottom"],
    dependencyHints: [
      "يحتاج عنوانًا واضحًا ونصًا مختصرًا ورابط إجراء صالحًا.",
      "تجنّب تكرار نفس CTA في عدة فتحات على نفس الصفحة.",
    ],
    previewNoteAr: "المعاينة العامة متاحة فقط بعد النشر والربط الظاهر.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "محتوى الدعوة للإجراء",
        sectionDescriptionAr: "أدر النصوص والأزرار والروابط الأساسية للموديول.",
        icon: "content",
      },
      meta: SETTINGS_SECTION,
      pages: PAGES_SECTION,
    },
  },
  cards: {
    kind: "cards",
    labelAr: "بطاقات",
    descriptionAr: "شبكة بطاقات بعناوين وروابط وصور.",
    typicalSlots: ["main", "sidebar", "bottom"],
    dependencyHints: ["كل بطاقة تحتاج عنوانًا ووصفًا مختصرًا على الأقل."],
    previewNoteAr: "لا توجد معاينة token — استخدم حالة النشر والظهور.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "محتوى شبكة البطاقات",
        sectionDescriptionAr: "أدر عنوان القسم ووصفه والبطاقات وروابطها.",
        icon: "content",
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
    typicalSlots: ["sidebar", "main"],
    dependencyHints: [
      "يعتمد على موضوعات منشورة — تحقق من وجود مقالات كافية.",
      "مصمم غالبًا للشريط الجانبي في صفحات topics/media.",
    ],
    previewNoteAr: "يعرض بيانات حية من قاعدة البيانات عند النشر.",
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
  "media-sidebar": {
    kind: "media-sidebar",
    labelAr: "شريط إعلامي جانبي",
    descriptionAr: "ودجات المركز الإعلامي في الشريط الجانبي.",
    typicalSlots: ["sidebar"],
    dependencyHints: [
      "مخصص لصفحات المركز الإعلامي والمواضيع ذات الشريط الجانبي.",
      "يعتمد على محتوى إعلامي منشور أو legacy حسب الإعداد.",
    ],
    previewNoteAr: "يُحمّل مع صفحات media-center/topics عند الربط.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "إعدادات الشريط الجانبي",
        sectionDescriptionAr: "حدّد نوع الـwidget ومصدر البيانات وعدد العناصر المعروضة.",
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
    labelAr: "مركز إعلامي — Hub",
    descriptionAr: "أقسام المركز الإعلامي داخل الصفحة الرئيسية للمركز.",
    typicalSlots: ["main"],
    dependencyHints: ["يُستخدم في صفحة media-center — يعتمد على أقسام المحتوى الإعلامي."],
    previewNoteAr: "لا يمر عبر composition الموحد بعد — راجع صفحة المركز الإعلامي.",
    editorSections: {
      content: {
        navigationLabelAr: "المحتوى",
        sectionHeadingAr: "إعدادات مركز الميديا",
        sectionDescriptionAr: "حدّد نوع القسم ومصدر البيانات وحدود العناصر المعروضة.",
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
    typicalSlot: "main",
    dependencyHints: ["يفضّل أن يسبقه هيرو سينمائي قوي."],
    editorSections: {
      text: {
        navigationLabelAr: "النص",
        sectionHeadingAr: "نص قسم القصة",
        sectionDescriptionAr: "أدر العنوان والنصوص التعريفية للقسم.",
        icon: "content",
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
    typicalSlot: "main",
    dependencyHints: ["يعمل بعد سكشن القصة أو الهيرو."],
    editorSections: {
      pages: HOME_PAGES_SECTION,
    },
  },
  "home-projects": {
    slug: "home-projects",
    labelAr: "مشاريع الرئيسية",
    descriptionAr: "يعرض مشاريع homepage من جدول projects.",
    typicalSlot: "main",
    dependencyHints: ["يتطلب مشاريع منشورة مع show_on_homepage."],
    editorSections: {
      pages: HOME_PAGES_SECTION,
    },
  },
  "home-contact": {
    slug: "home-contact",
    labelAr: "تواصل الرئيسية",
    descriptionAr: "CTA تواصل مع صورة ووسائل اتصال.",
    typicalSlot: "main",
    dependencyHints: ["يحتاج نص CTA وصورة وروابط تواصل صحيحة."],
    editorSections: {
      text: {
        navigationLabelAr: "النص",
        sectionHeadingAr: "نص قسم التواصل",
        sectionDescriptionAr: "أدر العنوان والنصوص التعريفية للقسم.",
        icon: "content",
      },
      image: {
        navigationLabelAr: "الصورة",
        sectionHeadingAr: "صورة قسم التواصل",
        sectionDescriptionAr: "اختر صورة القسم وأضف وصفها البديل.",
        icon: "media",
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
    typicalSlot: "main",
    dependencyHints: ["يتطلب مشروعات سكنية منشورة مع وسائط."],
  },
  "projects-hub-featured": {
    slug: "projects-hub-featured",
    labelAr: "المشروعات المميزة",
    descriptionAr: "سكشن المشروعات المميزة على /projects.",
    typicalSlot: "main",
    dependencyHints: ["يتطلب مشروعات بمنشور وfeatured = true."],
  },
  "projects-hub-listing": {
    slug: "projects-hub-listing",
    labelAr: "قائمة المشروعات",
    descriptionAr: "فهرس المشروعات مع الفلاتر على /projects.",
    typicalSlot: "main",
    dependencyHints: ["يعرض المشروعات المنشورة من جدول projects."],
  },
  "projects-hub-map": {
    slug: "projects-hub-map",
    labelAr: "خريطة المشروعات",
    descriptionAr: "خريطة بيت الوطن وربط الدبابيس بكود المشروع.",
    typicalSlot: "main",
    dependencyHints: ["يطابق الدبابيس عبر code وmapArea."],
  },
  "about-intro": {
    slug: "about-intro",
    labelAr: "من نحن — المقدمة",
    descriptionAr: "مقدمة بصرية لصفحة عن فينيسيا.",
    typicalSlot: "main",
    dependencyHints: ["صور رئيسية/ثانوية مع alt text."],
  },
  "about-intro-single-image": {
    slug: "about-intro-single-image",
    labelAr: "من نحن — محتوى وصورة واحدة",
    descriptionAr: "محتوى من نحن بصورة واحدة وموضع يمين/يسار.",
    typicalSlot: "main",
    dependencyHints: ["صورة واحدة فقط — موضع سطح المكتب يمين أو شمال."],
  },
  "vision-goals": {
    slug: "vision-goals",
    labelAr: "الرؤية والأهداف",
    descriptionAr: "نصوص وصورة قسم الرؤية والأهداف في صفحة من نحن.",
    typicalSlot: "main",
    dependencyHints: ["يحتاج نصوص رؤية وأهداف وصورة موصوفة بوضوح."],
  },
  "about-cta": {
    slug: "about-cta",
    labelAr: "دعوة للتواصل",
    descriptionAr: "قسم دعوة للتواصل في صفحة من نحن مع صورة وزر ووسائل اتصال.",
    typicalSlot: "main",
    dependencyHints: ["يحتاج صورة ونص CTA وروابط تواصل صحيحة."],
    editorSections: {
      text: {
        navigationLabelAr: "النص",
        sectionHeadingAr: "نص الدعوة للتواصل",
        sectionDescriptionAr: "أدر العنوان التمهيدي والعنوان والوصف.",
        icon: "content",
      },
      image: {
        navigationLabelAr: "الصورة",
        sectionHeadingAr: "صورة الدعوة للتواصل",
        sectionDescriptionAr: "اختر صورة القسم وأضف وصفها البديل.",
        icon: "media",
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
    typicalSlot: "main",
    dependencyHints: ["كل مبدأ يحتاج عنوانًا ووصفًا واضحين."],
  },
  "about-approach": {
    slug: "about-approach",
    labelAr: "منهج العمل",
    descriptionAr: "عنوان ومنهج العمل في صفحة من نحن.",
    typicalSlot: "main",
    dependencyHints: ["يحافظ العنوان على الفصل البصري المعتمد عند وجود جزأين."],
  },
  "topics-intro": {
    slug: "topics-intro",
    labelAr: "مقدمة الموضوعات",
    descriptionAr: "تمهيد لصفحة topics.",
    typicalSlot: "main",
    dependencyHints: ["يُفضّل مع feed في sidebar."],
  },
  "topics-insight-cta": {
    slug: "topics-insight-cta",
    labelAr: "CTA موضوعات",
    descriptionAr: "دعوة لإجراء في صفحة الموضوعات.",
    typicalSlot: "sidebar",
    dependencyHints: ["رابط إجراء واضح ونص هادئ."],
  },
};

export function getModuleKindMetadata(kind: string): ModuleKindMetadata | null {
  return MODULE_KIND_METADATA[kind] ?? null;
}

export function getSlotModuleSlugMetadata(slug: string): SlotModuleSlugMetadata | null {
  return SLOT_MODULE_SLUG_METADATA[slug] ?? null;
}

export type ResolvedModuleEditorHeaderMetadata = {
  eyebrowAr: string;
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
    eyebrowAr: kindMetadata?.labelAr ?? owner.labelAr,
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

export function getModuleDependencyHints(kind: string, slug?: string | null) {
  const hints = new Set<string>();
  const kindMeta = getModuleKindMetadata(kind);
  kindMeta?.dependencyHints.forEach((hint) => hints.add(hint));

  if (slug) {
    getSlotModuleSlugMetadata(slug)?.dependencyHints.forEach((hint) => hints.add(hint));
  }

  return [...hints];
}

export function getSlotCompatibilityLabel(kind: string) {
  const meta = getModuleKindMetadata(kind);
  if (!meta?.typicalSlots.length) return null;
  const labels: Record<PageCompositionSlot, string> = {
    hero: "الهيرو",
    main: "المحتوى الرئيسي",
    sidebar: "الشريط الجانبي",
    bottom: "أسفل الصفحة",
    footer: "قبل الفوتر",
  };
  return meta.typicalSlots.map((slot) => labels[slot]).join(" · ");
}
