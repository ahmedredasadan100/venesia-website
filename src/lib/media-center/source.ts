export type PublicMediaContentSource = "legacy" | "unified";

/** Public media reads from unified topics by default; set PUBLIC_MEDIA_CONTENT_SOURCE=legacy to opt out. */
export function getPublicMediaContentSource(): PublicMediaContentSource {
  const value = process.env.PUBLIC_MEDIA_CONTENT_SOURCE?.trim().toLowerCase();
  if (value === "legacy") return "legacy";
  return "unified";
}

/** Legacy fallback is off by default; set PUBLIC_MEDIA_LEGACY_FALLBACK=true to allow silent legacy reads. */
export function isLegacyFallbackEnabled() {
  const value = process.env.PUBLIC_MEDIA_LEGACY_FALLBACK?.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return true;
  return false;
}
