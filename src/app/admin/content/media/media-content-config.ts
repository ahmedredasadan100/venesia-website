export const MEDIA_LIST_CONTENT_TYPES = ["news", "video", "gallery", "press", "site_update"] as const;

export type MediaListContentType = (typeof MEDIA_LIST_CONTENT_TYPES)[number];

export const MEDIA_EDITABLE_CONTENT_TYPES = ["news", "press", "site_update", "video", "gallery"] as const;

export type MediaEditableContentType = (typeof MEDIA_EDITABLE_CONTENT_TYPES)[number];

export const MEDIA_SECTION_OPTIONS = [
  { slug: "media-news", label: "الأخبار", contentType: "news" as const },
  { slug: "media-press", label: "البيانات الصحفية", contentType: "press" as const },
  { slug: "media-site-updates", label: "من أرض التنفيذ", contentType: "site_update" as const },
  { slug: "media-videos", label: "الفيديوهات", contentType: "video" as const },
  { slug: "media-gallery", label: "معرض الصور", contentType: "gallery" as const },
] as const;

export type MediaSectionSlug = (typeof MEDIA_SECTION_OPTIONS)[number]["slug"];

export const ALLOWED_MEDIA_SECTION_SLUGS: MediaSectionSlug[] = MEDIA_SECTION_OPTIONS.map((option) => option.slug);

export const TEXT_MEDIA_SECTION_SLUGS = ["media-news", "media-press", "media-site-updates"] as const;

export const MEDIA_SECTION_ERROR =
  "القسم المختار غير مسموح. اختر قسمًا فرعيًا صالحًا تحت المركز الإعلامي.";

export const MEDIA_CONTENT_TYPE_ERROR =
  "نوع المحتوى غير مسموح. يُسمح فقط بـ news و press و site_update و video و gallery.";

export const CONTENT_TYPE_LABELS: Record<MediaListContentType, string> = {
  news: "أخبار",
  video: "فيديو",
  gallery: "معرض صور",
  press: "بيانات صحفية",
  site_update: "من أرض التنفيذ",
};

export function getContentTypeForSectionSlug(slug: string): MediaEditableContentType | null {
  const match = MEDIA_SECTION_OPTIONS.find((option) => option.slug === slug);
  return match?.contentType ?? null;
}

export function isMediaEditableContentType(value?: string | null): value is MediaEditableContentType {
  return MEDIA_EDITABLE_CONTENT_TYPES.includes(value as MediaEditableContentType);
}

export function isTextMediaSectionSlug(slug: string) {
  return TEXT_MEDIA_SECTION_SLUGS.includes(slug as (typeof TEXT_MEDIA_SECTION_SLUGS)[number]);
}

export function getContentTypeLabel(value?: string | null) {
  if (!value) return "غير محدد";
  if (value in CONTENT_TYPE_LABELS) return CONTENT_TYPE_LABELS[value as MediaListContentType];
  return value;
}
