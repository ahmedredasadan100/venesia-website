const ARABIC_CHAR_MAP: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "e",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "g",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "z",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ة: "h",
  ء: "",
  ئ: "e",
  ؤ: "o",
};

/** Build a URL-safe slug from a title or name (Arabic transliteration + ASCII cleanup). */
export function slugifyFromTitle(value: string) {
  return value
    .split("")
    .map((char) => ARABIC_CHAR_MAP[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Normalize manual slug input while typing (lowercase, strip invalid chars). */
export function normalizeSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateSlugFormat(slug: string): string | null {
  const trimmed = slug.trim();

  if (!trimmed) {
    return "Slug مطلوب.";
  }

  if (/\s/.test(slug)) {
    return "Slug لا يجب أن يحتوي على مسافات.";
  }

  if (/[^a-z0-9-]/.test(trimmed)) {
    return "Slug يقبل حروفًا إنجليزية صغيرة وأرقام وشرطة (-) فقط.";
  }

  if (trimmed.startsWith("-") || trimmed.endsWith("-")) {
    return "Slug لا يبدأ أو ينتهي بشرطة (-).";
  }

  if (trimmed.includes("--")) {
    return "Slug لا يجب أن يحتوي على شرطتين متتاليتين (--).";
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
    return "صيغة Slug غير صالحة.";
  }

  return null;
}
