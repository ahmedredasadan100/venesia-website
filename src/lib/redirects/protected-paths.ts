const PROTECTED_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/sitemap.xml",
  "/robots.txt",
] as const;

export function isProtectedRedirectPath(pathname: string) {
  const normalized = pathname.toLowerCase();
  return PROTECTED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
