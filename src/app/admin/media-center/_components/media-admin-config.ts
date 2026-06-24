export const MEDIA_TYPES = ["news", "video", "gallery", "press", "site-update"] as const;

export type MediaAdminType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_CONFIG: Record<MediaAdminType, { label: string; plural: string; path: string; eyebrow: string }> = {
  news: { label: "خبر", plural: "الأخبار", path: "news", eyebrow: "NEWS" },
  video: { label: "فيديو", plural: "الفيديوهات", path: "videos", eyebrow: "VIDEOS" },
  gallery: { label: "معرض صور", plural: "الجاليري", path: "gallery", eyebrow: "GALLERY" },
  press: { label: "بيان صحفي", plural: "البيانات الصحفية", path: "press", eyebrow: "PRESS" },
  "site-update": { label: "تحديث موقع", plural: "تحديثات المواقع", path: "site-updates", eyebrow: "SITE UPDATES" },
};

export function isMediaAdminType(value: string | undefined | null): value is MediaAdminType {
  return MEDIA_TYPES.includes(value as MediaAdminType);
}

export function getMediaTypeFromPath(path: string | undefined | null): MediaAdminType | null {
  if (!path) return null;
  const found = MEDIA_TYPES.find((type) => MEDIA_TYPE_CONFIG[type].path === path || type === path);
  return found ?? null;
}

export function getMediaAdminPath(type: MediaAdminType) {
  return `/admin/media-center/${MEDIA_TYPE_CONFIG[type].path}`;
}

export function getPublicMediaPath(type: MediaAdminType, slug?: string | null) {
  const base = `/media-center/${MEDIA_TYPE_CONFIG[type].path}`;
  return slug ? `${base}/${slug}` : base;
}
