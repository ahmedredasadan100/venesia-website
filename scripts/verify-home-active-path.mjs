/**
 * Regression: active-nav must be hydration-safe under ISR.
 *
 * usePathname() proved unreliable during Vercel ISR revalidation of "/"
 * (React #418). The contract is now:
 *   - SSR / pre-mount (pathname = null): every link inactive.
 *   - First client render: identical to SSR (also pathname = null).
 *   - Post-mount: real pathname applies ("/" → home active, "/about" → about).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Source contract — fail if the helper or the navbar mounted-gate diverges.
const helperSrc = readFileSync(resolve(root, "src/lib/navigation/is-active-path.ts"), "utf8");
assert.match(helperSrc, /export function normalizePathname/);
assert.match(helperSrc, /export function isActivePath/);
assert.match(helperSrc, /if \(!pathname\) return false/);

const navbarSrc = readFileSync(resolve(root, "src/components/SiteNavbar.tsx"), "utf8");
assert.match(navbarSrc, /const mounted = useMounted\(\)/);
assert.match(navbarSrc, /useSyncExternalStore\(/);
assert.match(navbarSrc, /mounted \? normalizePathname\(routerPathname\) : null/);
assert.doesNotMatch(navbarSrc, /suppressHydrationWarning/);

// Mirror of the helper logic (keep in sync with src).
function normalizePathname(pathname) {
  return pathname || "/";
}

function isActivePath(pathname, href) {
  if (!pathname) return false;
  if (!href || href === "#") return false;
  const cleanHref = href.split("#")[0] || "/";
  if (cleanHref === "/") return pathname === "/";
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

/** Simulates the navbar pathname gate for a given render phase. */
function navPathname({ mounted, routerPathname }) {
  return mounted ? normalizePathname(routerPathname) : null;
}

const NAV_HREFS = ["/", "/about", "/topics", "/media-center", "/contact"];

function activeSet(pathname) {
  return NAV_HREFS.filter((href) => isActivePath(pathname, href));
}

// 1. SSR with any pathname value (reliable, unreliable, or empty) → no active.
for (const routerPathname of ["/", "", null, undefined, "/index", "/about", "/anything"]) {
  const ssr = navPathname({ mounted: false, routerPathname });
  assert.equal(ssr, null);
  assert.deepEqual(activeSet(ssr), [], `SSR must render zero active links (got pathname=${routerPathname})`);
}

// 2. First client render (pre-mount) matches SSR exactly.
const ssrActive = activeSet(navPathname({ mounted: false, routerPathname: "/index" }));
const firstClientActive = activeSet(navPathname({ mounted: false, routerPathname: "/" }));
assert.deepEqual(ssrActive, firstClientActive, "initial client markup must equal SSR markup");

// 3. Post-mount on "/" → home active only (empty router value still resolves home).
assert.deepEqual(activeSet(navPathname({ mounted: true, routerPathname: "/" })), ["/"]);
assert.deepEqual(activeSet(navPathname({ mounted: true, routerPathname: "" })), ["/"]);

// 4. Post-mount on other routes.
assert.deepEqual(activeSet(navPathname({ mounted: true, routerPathname: "/about" })), ["/about"]);
assert.deepEqual(activeSet(navPathname({ mounted: true, routerPathname: "/media-center/news" })), [
  "/media-center",
]);
assert.deepEqual(activeSet(navPathname({ mounted: true, routerPathname: "/topics" })), ["/topics"]);

// 5. Helper edge cases.
assert.equal(isActivePath(null, "/"), false);
assert.equal(isActivePath("/topics", "#"), false);
assert.equal(isActivePath("/about", "/"), false);
assert.equal(normalizePathname(""), "/");
assert.equal(normalizePathname("/about"), "/about");

console.log("verify-home-active-path: PASS");
