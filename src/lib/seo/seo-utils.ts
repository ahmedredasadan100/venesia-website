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

export function absoluteAssetUrl(path?: string): string {
  if (!path) return absoluteUrl(SEO_SITE.defaultImage);

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return absoluteUrl(path);
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function trimToSeoLength(value: string, maxLength: number): string {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}