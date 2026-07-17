/**
 * `usePathname()` is unreliable during SSR/ISR runtime revalidation on Vercel:
 * for the root route it can yield "" at build prerender and a non-"/" value
 * during ISR regeneration, which made server HTML disagree with the client
 * and triggered React #418 on "/".
 *
 * Contract: active-nav state may only be computed from a *mounted* client
 * pathname. Callers must pass `null` until after hydration so the server tree
 * and the first client paint always render every link inactive (identical
 * markup), then apply the real active state post-mount.
 */
export function normalizePathname(pathname: string | null | undefined): string {
  return pathname || "/";
}

export function isActivePath(pathname: string | null | undefined, href: string): boolean {
  // No trustworthy pathname (SSR/ISR or pre-mount) → nothing is active.
  if (!pathname) return false;
  if (!href || href === "#") return false;
  const cleanHref = href.split("#")[0] || "/";
  if (cleanHref === "/") return pathname === "/";
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
