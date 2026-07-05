export const MEDIA_LIST_CONTENT_TYPES = ["news", "video", "gallery", "press", "site_update"] as const;

export type MediaListContentType = (typeof MEDIA_LIST_CONTENT_TYPES)[number];

export const PHASE_3B_EDITABLE_CONTENT_TYPES = ["news", "press", "site_update"] as const;

export type Phase3BEditableContentType = (typeof PHASE_3B_EDITABLE_CONTENT_TYPES)[number];

export const MEDIA_SECTION_OPTIONS = [
  { slug: "media-news", label: "الأخبار", contentType: "news" as const },
  { slug: "media-press", label: "البيانات الصحفية", contentType: "press" as const },
  { slug: "media-site-updates", label: "من أرض التنفيذ", contentType: "site_update" as const },
] as const;

export type MediaSectionSlug = (typeof MEDIA_SECTION_OPTIONS)[number]["slug"];

export const ALLOWED_MEDIA_SECTION_SLUGS: MediaSectionSlug[] = MEDIA_SECTION_OPTIONS.map((option) => option.slug);

export const MEDIA_SECTION_ERROR =
  "القسم المختار غير مسموح. اختر أخبار أو بيانات صحفية أو من أرض التنفيذ فقط.";

export const MEDIA_CONTENT_TYPE_ERROR =
  "نوع المحتوى غير مسموح في هذه المرحلة. يُسمح فقط بـ news و press و site_update.";

export const CONTENT_TYPE_LABELS: Record<MediaListContentType, string> = {
  news: "أخبار",
  video: "فيديو",
  gallery: "معرض صور",
  press: "بيانات صحفية",
  site_update: "من أرض التنفيذ",
};

export function getContentTypeForSectionSlug(slug: string): Phase3BEditableContentType | null {
  const match = MEDIA_SECTION_OPTIONS.find((option) => option.slug === slug);
  return match?.contentType ?? null;
}

export function isPhase3BEditableContentType(value?: string | null): value is Phase3BEditableContentType {
  return PHASE_3B_EDITABLE_CONTENT_TYPES.includes(value as Phase3BEditableContentType);
}

export function getContentTypeLabel(value?: string | null) {
  if (!value) return "غير محدد";
  if (value in CONTENT_TYPE_LABELS) return CONTENT_TYPE_LABELS[value as MediaListContentType];
  return value;
}
