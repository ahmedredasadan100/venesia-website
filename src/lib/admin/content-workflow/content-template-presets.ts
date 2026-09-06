import {
  isMediaEditableContentType,
  type MediaEditableContentType,
} from "../content/content-types.ts";

export type ContentTemplateTarget = "article" | "media";

export type ContentTemplateContext =
  | { target: "article" }
  | {
      target: "media";
      mediaContentType: MediaEditableContentType;
    };

export type ContentTemplateDefaults = {
  title?: string;
  excerpt?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
};

export type ContentTemplateEditableValues = Required<ContentTemplateDefaults>;

export type ContentTemplatePreset = {
  key: string;
  labelAr: string;
  target: ContentTemplateTarget;
  description: string;
  mediaContentType?: MediaEditableContentType;
  defaults: ContentTemplateDefaults;
  requiredFieldHints: string[];
  seoHints: string[];
  mediaHints: string[];
  toneNotes: string[];
};

export const VENESIA_CONTENT_TEMPLATE_PRESETS: ContentTemplatePreset[] = [
  {
    key: "construction-update",
    labelAr: "تحديث تنفيذ",
    target: "media",
    description: "تحديث من أرض المشروع مع حقائق التنفيذ والمرحلة الحالية.",
    mediaContentType: "site_update",
    defaults: {
      title: "تحديث تنفيذ — [اسم المشروع]",
      excerpt: "ملخص قصير لما تم إنجازه في الموقع خلال الفترة الأخيرة.",
      content:
        "# أين وصل المشروع الآن\n\n## ما تم إنجازه\n\n- \n\n## المرحلة الحالية\n\n\n## الخطوة التالية\n\n",
    },
    requiredFieldHints: ["اسم المشروع", "مرحلة التنفيذ", "صور من الموقع"],
    seoHints: ["استخدم عنوانًا يذكر المشروع والمرحلة دون مبالغة."],
    mediaHints: ["صورة غلاف من الموقع + معرض صور إن وُجد."],
    toneNotes: ["وثائقي، هادئ، يعتمد على ما تم رصده فعليًا في الموقع."],
  },
  {
    key: "project-launch",
    labelAr: "Project Launch",
    target: "media",
    description: "إطلاق مشروع أو مرحلة جديدة بصياغة رسمية وواثقة.",
    mediaContentType: "press",
    defaults: {
      title: "Venesia تعلن إطلاق [اسم المشروع]",
      excerpt: "بيان يوضح تفاصيل الإطلاق، الموقع، والمرحلة الأولى.",
      content:
        "# ملخص الإطلاق\n\n## تفاصيل المشروع\n\n## ما الذي يميز هذا الإطلاق\n\n## للتواصل الإعلامي\n\n",
    },
    requiredFieldHints: ["اسم المشروع", "الموقع", "مرحلة الإطلاق"],
    seoHints: ["عنوان صحفي مباشر مع اسم المشروع."],
    mediaHints: ["صورة رسمية للمشروع أو الهوية البصرية."],
    toneNotes: ["رسمي، واثق، بلا مبالغة تسويقية."],
  },
  {
    key: "sold-out",
    labelAr: "Sold Out",
    target: "media",
    description: "إعلان اكتمال مرحلة أو وحدات مع توضيح السياق.",
    mediaContentType: "news",
    defaults: {
      title: "اكتمال [المرحلة/الوحدات] في [اسم المشروع]",
      excerpt: "إعلان رسمي عن اكتمال مرحلة محددة مع شكر للعملاء.",
      content: "# ماذا يعني الاكتمال\n\n## ما الذي يلي\n\n",
    },
    requiredFieldHints: ["اسم المشروع", "ما الذي اكتمل بالضبط"],
    seoHints: ["وضوح في العنوان — تجنب عبارات مبهمة."],
    mediaHints: ["صورة للمشروع أو المرحلة المكتملة."],
    toneNotes: ["احتفالي هادئ — احترم خصوصية العملاء."],
  },
  {
    key: "news-brief",
    labelAr: "Media News",
    target: "media",
    description: "خبر إعلامي عام لأخبار الشركة أو المشاريع.",
    mediaContentType: "news",
    defaults: {
      title: "خبر: [العنوان]",
      excerpt: "ملخص الخبر في جملتين واضحتين.",
      content: "# الخبر\n\n## التفاصيل\n\n## ماذا يعني هذا\n\n",
    },
    requiredFieldHints: ["زاوية الخبر", "حقيقة قابلة للتحقق"],
    seoHints: ["عنوان خبري مباشر."],
    mediaHints: ["صورة غلاف متعلقة بالحدث."],
    toneNotes: ["إخباري، موضوعي، بلا إيموجي."],
  },
];

export function isContentTemplatePresetApplicable(
  preset: ContentTemplatePreset,
  context: ContentTemplateContext,
) {
  if (preset.target !== context.target) return false;
  if (context.target === "article") {
    return preset.mediaContentType === undefined;
  }

  return (
    isMediaEditableContentType(context.mediaContentType) &&
    isMediaEditableContentType(preset.mediaContentType) &&
    preset.mediaContentType === context.mediaContentType
  );
}

export function getContentTemplatePresets(context: ContentTemplateContext) {
  return VENESIA_CONTENT_TEMPLATE_PRESETS.filter((preset) =>
    isContentTemplatePresetApplicable(preset, context),
  );
}

export function resolveContentTemplatePreset(
  presetKey: string,
  context: ContentTemplateContext,
) {
  const preset = VENESIA_CONTENT_TEMPLATE_PRESETS.find(
    (candidate) => candidate.key === presetKey,
  );
  return preset && isContentTemplatePresetApplicable(preset, context)
    ? preset
    : null;
}

export function applyContentTemplatePreset(
  current: ContentTemplateEditableValues,
  presetKey: string,
  context: ContentTemplateContext,
): ContentTemplateEditableValues | null {
  const preset = resolveContentTemplatePreset(presetKey, context);
  if (!preset) return null;

  return Object.entries(preset.defaults).reduce(
    (next, [field, value]) =>
      value === undefined ? next : { ...next, [field]: value },
    current,
  );
}
