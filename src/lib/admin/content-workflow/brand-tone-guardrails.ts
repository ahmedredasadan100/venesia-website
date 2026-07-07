export type BrandToneRule = {
  id: string;
  label: string;
  hint: string;
};

export const VENESIA_BRAND_TONE_RULES: BrandToneRule[] = [
  {
    id: "no-emojis",
    label: "بدون إيموجي",
    hint: "تجنّب الرموز التعبيرية في العناوين والنصوص الرسمية.",
  },
  {
    id: "documentary-tone",
    label: "نبرة وثائقية هادئة",
    hint: "اكتب بثقة ووضوح — لغة هادئة تشبه السرد الوثائقي لا الإعلان الصاخب.",
  },
  {
    id: "proof-before-promise",
    label: "إثبات قبل وعد",
    hint: "قدّم حقائق التنفيذ والموقع والمرحلة قبل أي ادعاء تسويقي.",
  },
  {
    id: "no-hype",
    label: "تجنّب المبالغة",
    hint: "ابتعد عن عبارات مثل «الأفضل على الإطلاق» أو «فرصة لن تتكرر».",
  },
  {
    id: "cinematic-identity",
    label: "هوية Venesia السينمائية",
    hint: "حافظ على أسلوب Venesia Cinematic Gold — فخامة هادئة لا ضجيجًا.",
  },
];
