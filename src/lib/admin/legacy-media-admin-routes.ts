export const UNIFIED_MEDIA_ADMIN_PATH = "/admin/content/media";
export const UNIFIED_MEDIA_ADMIN_NEW_PATH = "/admin/content/media/new";
export const UNIFIED_TOPIC_CATEGORIES_PATH = "/admin/topics/categories";

/**
 * Single source of truth for Legacy Media Admin → Unified Media Admin redirects.
 * Route stubs under src/app/admin/media-center must import from here only.
 */
const LEGACY_TYPE_PATH_TO_CONTENT_TYPE: Record<string, string> = {
  news: "news",
  videos: "video",
  gallery: "gallery",
  press: "press",
  "site-updates": "site_update",
  "site-update": "site_update",
};

export function getUnifiedMediaAdminListPath(contentType?: string | null) {
  const normalized = contentType?.trim();
  if (!normalized) return UNIFIED_MEDIA_ADMIN_PATH;
  return `${UNIFIED_MEDIA_ADMIN_PATH}?content_type=${encodeURIComponent(normalized)}`;
}

export function getUnifiedMediaAdminPathFromLegacyTypePath(typePath: string | undefined | null) {
  const contentType = typePath ? LEGACY_TYPE_PATH_TO_CONTENT_TYPE[typePath] : undefined;
  return getUnifiedMediaAdminListPath(contentType);
}
