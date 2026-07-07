export type ContentTemplateTarget = "article" | "media";

export type ContentTemplatePreset = {
  key: string;
  labelAr: string;
  target: ContentTemplateTarget;
  description: string;
  suggestedSectionSlug?: string;
  mediaContentType?: "news" | "press" | "site_update";
  defaults: {
    title?: string;
    excerpt?: string;
    content?: string;
    seoTitle?: string;
    seoDescription?: string;
    focusKeyword?: string;
  };
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
    suggestedSectionSlug: "media-site-updates",
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
    key: "man-hakak-tafham",
    labelAr: "من حقك تفهم",
    target: "article",
    description: "مقال توعوي يشرح قرارًا أو مفهومًا عقاريًا ببساطة واحترام.",
    defaults: {
      title: "من حقك تفهم: [الموضوع]",
      excerpt: "شرح واضح يساعد القارئ على فهم [الموضوع] قبل اتخاذ قرار.",
      content:
        "# لماذا يهمك هذا الموضوع\n\n## ما الذي تحتاج معرفته\n\n\n## الأسئلة الشائعة\n\n",
      seoTitle: "من حقك تفهم: [الموضوع] | Venesia",
      focusKeyword: "من حقك تفهم",
    },
    requiredFieldHints: ["مقدمة توضح المشكلة", "FAQ مكتمل", "روابط داخلية"],
    seoHints: ["Focus Keyword واضح في العنوان والوصف."],
    mediaHints: ["صورة توضيحية هادئة بلا إيموجي."],
    toneNotes: ["تعليمي، مطمئن، بلا وعود مبالغ فيها."],
  },
  {
    key: "hikayat-bayt",
    labelAr: "حكاية بيت",
    target: "article",
    description: "سرد إنساني عن تجربة سكن أو مجتمع داخل مشروع Venesia.",
    defaults: {
      title: "حكاية بيت: [العنوان]",
      excerpt: "قصة حقيقية عن تجربة معيشة أو بناء داخل مشروع Venesia.",
      content: "# البداية\n\n## اللحظة التي تغيّر كل شيء\n\n## ماذا يعني هذا اليوم\n\n",
      seoTitle: "حكاية بيت: [العنوان] | Venesia",
    },
    requiredFieldHints: ["زاوية بشرية واضحة", "تفاصيل ملموسة", "خاتمة هادئة"],
    seoHints: ["عنوان عاطفي لكن غير مبالغ فيه."],
    mediaHints: ["صورة واحدة قوية تكفي — جودة أهم من الكم."],
    toneNotes: ["سرد وثائقي دافئ، ليس إعلانًا مباشرًا."],
  },
  {
    key: "project-launch",
    labelAr: "Project Launch",
    target: "media",
    description: "إطلاق مشروع أو مرحلة جديدة بصياغة رسمية وواثقة.",
    suggestedSectionSlug: "media-press",
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
    suggestedSectionSlug: "media-news",
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
    key: "media-news",
    labelAr: "Media News",
    target: "media",
    description: "خبر إعلامي عام لأخبار الشركة أو المشاريع.",
    suggestedSectionSlug: "media-news",
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

export function getContentTemplatePresets(target: ContentTemplateTarget) {
  return VENESIA_CONTENT_TEMPLATE_PRESETS.filter((preset) => preset.target === target);
}
