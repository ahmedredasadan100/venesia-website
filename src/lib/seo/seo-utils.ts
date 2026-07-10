import { SEO_SITE } from "../../config/seo/seo-site";

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

export function trimToSeoLength(value: string, maxLength: number): string {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}