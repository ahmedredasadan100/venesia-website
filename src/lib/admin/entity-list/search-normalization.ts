const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_TATWEEL = /\u0640/g;

const DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

/**
 * Canonical matching form for Arabic-aware collection search.
 * This never mutates stored or user-visible text. It deliberately does not
 * collapse taa marbuta (ة) into haa (ه), because they are not equivalent.
 */
export function normalizeAdminCollectionSearchText(value: string) {
  return value
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(ARABIC_TATWEEL, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] ?? digit)
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

export function adminCollectionSearchIncludes(
  candidate: string,
  query: string,
) {
  const normalizedQuery = normalizeAdminCollectionSearchText(query);
  return (
    normalizedQuery.length === 0 ||
    normalizeAdminCollectionSearchText(candidate).includes(normalizedQuery)
  );
}

