export type PublicMediaContentSource = "legacy" | "unified";

export function getPublicMediaContentSource(): PublicMediaContentSource {
  const value = process.env.PUBLIC_MEDIA_CONTENT_SOURCE?.trim().toLowerCase();
  if (value === "unified") return "unified";
  return "legacy";
}

export function isLegacyFallbackEnabled() {
  const value = process.env.PUBLIC_MEDIA_LEGACY_FALLBACK?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "no") return false;
  return true;
}
