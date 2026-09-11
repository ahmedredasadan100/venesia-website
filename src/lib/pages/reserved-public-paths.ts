import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../admin/links/static-routes";

/**
 * Fixed single-segment or nested paths served by App Router today.
 * The public route registry owns executable page paths; framework-generated
 * files remain explicit because they are not page routes.
 */
const ADDITIONAL_RESERVED_EXACT_PATHS = [
  "/robots.txt",
  "/sitemap.xml",
] as const;

/**
 * First-segment roots owned by admin, framework assets, or entity catch-all routes.
 * Any CMS path equal to the root or nested under it is rejected.
 */
const SYSTEM_RESERVED_PUBLIC_PATH_ROOTS = [
  "admin",
  "api",
  "_next",
] as const;

const DYNAMIC_PUBLIC_PATH_ROOTS = PUBLIC_PAGE_ROUTE_REGISTRY.flatMap((route) => {
  if (route.verification !== "compiled_dynamic") return [];
  const root = route.href.split("/").find((segment) => segment.length > 0);
  return root && !root.startsWith("[") ? [root] : [];
});

export const RESERVED_PUBLIC_PATH_ROOTS = [
  ...new Set([
    ...SYSTEM_RESERVED_PUBLIC_PATH_ROOTS,
    ...DYNAMIC_PUBLIC_PATH_ROOTS,
  ]),
];

function buildReservedExactPaths(): Set<string> {
  const paths = new Set<string>(["/"]);

  for (const route of PUBLIC_PAGE_ROUTE_REGISTRY) {
    if (route.verification === "http_exact") paths.add(route.href);
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

  return RESERVED_PUBLIC_PATH_ROOTS.includes(segments[0]);
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
