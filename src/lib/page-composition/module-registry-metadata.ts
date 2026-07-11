import type { PageModuleKind } from "../page-blocks/types";
import type { PageCompositionSlot } from "./slot-module-registry";

export type ModuleKindMetadata = {
  kind: PageModuleKind | string;
  labelAr: string;
  descriptionAr: string;
  typicalSlots: PageCompositionSlot[];
  dependencyHints: string[];
  previewNoteAr: string;
};

export type SlotModuleSlugMetadata = {
  slug: string;
  labelAr: string;
  descriptionAr: string;
  typicalSlot: PageCompositionSlot;
  dependencyHints: string[];
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
  },
  breadcrumb: {
    kind: "breadcrumb",
    labelAr: "مسار التنقل",
    descriptionAr: "Breadcrumb داخل فتحة الهيرو للصفحات الداخلية.",
    typicalSlots: ["hero"],
    dependencyHints: ["يُربط عادةً مع هيرو نشط على نفس الصفحة."],
    previewNoteAr: "يظهر ضمن الهيرو على الموقع العام.",
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
  },
  cards: {
    kind: "cards",
    labelAr: "بطاقات",
    descriptionAr: "شبكة بطاقات بعناوين وروابط وصور.",
    typicalSlots: ["main", "sidebar", "bottom"],
    dependencyHints: ["كل بطاقة تحتاج عنوانًا ووصفًا مختصرًا على الأقل."],
    previewNoteAr: "لا توجد معاينة token — استخدم حالة النشر والظهور.",
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
  },
  "media-hub": {
    kind: "media-hub",
    labelAr: "مركز إعلامي — Hub",
    descriptionAr: "أقسام المركز الإعلامي داخل الصفحة الرئيسية للمركز.",
    typicalSlots: ["main"],
    dependencyHints: ["يُستخدم في صفحة media-center — يعتمد على أقسام المحتوى الإعلامي."],
    previewNoteAr: "لا يمر عبر composition الموحد بعد — راجع صفحة المركز الإعلامي.",
  },
};

export const SLOT_MODULE_SLUG_METADATA: Record<string, SlotModuleSlugMetadata> = {
  "home-story": {
    slug: "home-story",
    labelAr: "قصة فينيسيا",
    descriptionAr: "سرد تمهيدي للصفحة الرئيسية.",
    typicalSlot: "main",
    dependencyHints: ["يفضّل أن يسبقه هيرو سينمائي قوي."],
  },
  "home-trust": {
    slug: "home-trust",
    labelAr: "ثقة فينيسيا",
    descriptionAr: "شبكة مبادئ/ثقة للصفحة الرئيسية.",
    typicalSlot: "main",
    dependencyHints: ["يعمل بعد سكشن القصة أو الهيرو."],
  },
  "home-projects": {
    slug: "home-projects",
    labelAr: "مشاريع الرئيسية",
    descriptionAr: "يعرض مشاريع homepage من جدول projects.",
    typicalSlot: "main",
    dependencyHints: ["يتطلب مشاريع منشورة مع show_on_homepage."],
  },
  "home-contact": {
    slug: "home-contact",
    labelAr: "تواصل الرئيسية",
    descriptionAr: "CTA تواصل مع صورة ووسائل اتصال.",
    typicalSlot: "main",
    dependencyHints: ["يحتاج نص CTA وصورة وروابط تواصل صحيحة."],
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
    labelAr: "من نحن — مقدمة",
    descriptionAr: "مقدمة بصرية لصفحة عن فينيسيا.",
    typicalSlot: "main",
    dependencyHints: ["صور رئيسية/ثانوية مع alt text."],
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
