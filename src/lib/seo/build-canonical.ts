import { absoluteUrl, normalizePath } from "./seo-utils";

export function buildCanonical(path: string): string {
  return absoluteUrl(normalizePath(path));
}