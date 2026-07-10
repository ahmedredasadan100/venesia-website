import { SEO_ROUTES } from "../../config/seo/seo-routes";

/**
 * Fixed single-segment or nested paths served by App Router today.
 * SEO_ROUTES is the primary source; add entries here only when a live route
 * is not yet represented there.
 */
const ADDITIONAL_RESERVED_EXACT_PATHS = [
  "/maintenance",
  "/robots.txt",
  "/sitemap.xml",
] as const;

/**
 * First-segment roots owned by admin, framework assets, or entity catch-all routes.
 * Any CMS path equal to the root or nested under it is rejected.
 */
export const RESERVED_PUBLIC_PATH_ROOTS = [
  "admin",
  "api",
  "_next",
  "projects",
  "topics",
  "media-center",
  "track-your-project",
] as const;

function buildReservedExactPaths(): Set<string> {
  const paths = new Set<string>(["/"]);

  for (const route of SEO_ROUTES) {
    paths.add(route.path);
  }

  for (const path of ADDITIONAL_RESERVED_EXACT_PATHS) {
    paths.add(path);
  }

  return paths;
}

/** Exact public paths that must not be claimed by new CMS pages. */
export const RESERVED_EXACT_PUBLIC_PATHS = buildReservedExactPaths();

function matchesReservedRoot(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) {
    return true;
  }

  return RESERVED_PUBLIC_PATH_ROOTS.includes(segments[0] as (typeof RESERVED_PUBLIC_PATH_ROOTS)[number]);
}

/**
 * Returns an Arabic error message when the path is reserved, otherwise null.
 */
export function getReservedPublicPathReason(path: string): string | null {
  if (RESERVED_EXACT_PUBLIC_PATHS.has(path)) {
    return "هذا المسار محجوز لصفحة نظامية أو مسار ثابت في الموقع.";
  }

  if (matchesReservedRoot(path)) {
    return "هذا المسار يتعارض مع مسار نظامي أو صفحة كيانات في الموقع.";
  }

  return null;
}

export function isReservedPublicPath(path: string): boolean {
  return getReservedPublicPathReason(path) !== null;
}
