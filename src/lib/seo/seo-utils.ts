import { SEO_SITE } from "../../config/seo/seo-site";
import type { GlobalSeoSettings } from "./global-seo-types";

export function normalizePath(path: string): string {
  if (!path || path === "/") return "/";

  return `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = normalizePath(path);

  return `${SEO_SITE.defaultUrl}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function absoluteUrlWithBase(path = "/", baseUrl = SEO_SITE.defaultUrl): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = normalizePath(path);

  return `${normalizedBase}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function absoluteAssetUrl(path?: string, baseUrl?: string): string {
  if (!path) return absoluteUrlWithBase(SEO_SITE.defaultImage, baseUrl);

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return absoluteUrlWithBase(path, baseUrl);
}

export function buildCanonicalWithBase(path: string, baseUrl = SEO_SITE.defaultUrl): string {
  return absoluteUrlWithBase(path, baseUrl);
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedTitleKey(value: string): string {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase("ar");
}

/** One presentation separator for every locally composed SEO title. */
export const SEO_TITLE_SEPARATOR = " | " as const;

/**
 * Existing Site Settings own the reusable brand segment. No second title-template
 * setting is persisted: Arabic organization identity + site name are composed here.
 */
export function getSeoTitleSuffix(
  settings: Pick<GlobalSeoSettings, "organizationAlternateName" | "siteName">,
): string {
  const labels = [settings.organizationAlternateName, settings.siteName]
    .map(cleanText)
    .filter(Boolean);
  const seen = new Set<string>();
  return labels
    .filter((label) => {
      const key = normalizedTitleKey(label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" - ");
}

/** Removes the canonical suffix from legacy values that stored the final title. */
export function stripSeoTitleSuffix(title: string, suffix: string): string {
  const cleanedTitle = cleanText(title);
  const cleanedSuffix = cleanText(suffix);
  if (!cleanedTitle || !cleanedSuffix) return cleanedTitle;

  const titleKey = normalizedTitleKey(cleanedTitle);
  const suffixCandidates = [
    cleanedSuffix,
    ...cleanedSuffix.split(" - ").map(cleanText),
  ].filter(Boolean);

  for (const candidate of suffixCandidates) {
    if (titleKey === normalizedTitleKey(candidate)) return "";
    for (const separator of [" | ", " — ", " – ", " - "]) {
      const ending = `${separator}${candidate}`;
      if (titleKey.endsWith(normalizedTitleKey(ending))) {
        return cleanedTitle.slice(0, -ending.length).trim();
      }
    }
  }

  return cleanedTitle;
}

/** Builds the final search/social title from one page-specific segment + Site Settings. */
export function composeSeoTitle(
  preferredTitle: string | null | undefined,
  fallbackTitle: string | null | undefined,
  suffix: string,
): string {
  const preferredSegment = stripSeoTitleSuffix(preferredTitle ?? "", suffix);
  const fallbackSegment = stripSeoTitleSuffix(fallbackTitle ?? "", suffix);
  const segment = preferredSegment || fallbackSegment;
  const cleanedSuffix = cleanText(suffix);

  if (!segment) return cleanedSuffix;
  if (!cleanedSuffix) return segment;
  return `${segment}${SEO_TITLE_SEPARATOR}${cleanedSuffix}`;
}

export function trimToSeoLength(value: string, maxLength: number): string {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}
