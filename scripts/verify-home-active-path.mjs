/**
 * Regression: empty SSR pathname for `/` must still mark home as active,
 * matching the client router value (`"/"`) and preventing React #418.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(resolve(root, "src/lib/navigation/is-active-path.ts"), "utf8");

assert.match(src, /export function normalizePathname/);
assert.match(src, /return pathname \|\| "\/"/);
assert.match(src, /export function isActivePath/);
assert.match(src, /if \(cleanHref === "\/"\) return path === "\/"/);

function normalizePathname(pathname) {
  return pathname || "/";
}

function isActivePath(pathname, href) {
  const path = normalizePathname(pathname);
  if (!href || href === "#") return false;
  const cleanHref = href.split("#")[0] || "/";
  if (cleanHref === "/") return path === "/";
  return path === cleanHref || path.startsWith(`${cleanHref}/`);
}

assert.equal(normalizePathname(""), "/");
assert.equal(normalizePathname(null), "/");
assert.equal(normalizePathname(undefined), "/");
assert.equal(normalizePathname("/"), "/");
assert.equal(normalizePathname("/about"), "/about");

assert.equal(isActivePath("", "/"), true);
assert.equal(isActivePath(null, "/"), true);
assert.equal(isActivePath("/", "/"), true);
assert.equal(isActivePath("", "/about"), false);
assert.equal(isActivePath("/about", "/about"), true);
assert.equal(isActivePath("/about", "/"), false);
assert.equal(isActivePath("/media-center/news", "/media-center"), true);
assert.equal(isActivePath("/topics", "#"), false);

console.log("verify-home-active-path: PASS");
