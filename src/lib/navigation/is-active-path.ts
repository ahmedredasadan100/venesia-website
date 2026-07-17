/**
 * Next.js App Router can yield an empty pathname during SSR/prerender of `/`.
 * Treat that as the root so active-nav classes match the client (`"/"`).
 */
export function normalizePathname(pathname: string | null | undefined): string {
  return pathname || "/";
}

export function isActivePath(pathname: string | null | undefined, href: string): boolean {
  const path = normalizePathname(pathname);
  if (!href || href === "#") return false;
  const cleanHref = href.split("#")[0] || "/";
  if (cleanHref === "/") return path === "/";
  return path === cleanHref || path.startsWith(`${cleanHref}/`);
}
