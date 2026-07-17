/**
 * Verifies the clean admin-content cutover: only /admin/content/** is canonical,
 * and no page, action, component, link, or redirect keeps an old admin engine alive.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = resolve(ROOT, "src");
const failures = [];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

for (const required of [
  "src/app/admin/content/topics/page.tsx",
  "src/app/admin/content/topics/new/page.tsx",
  "src/app/admin/content/topics/[id]/page.tsx",
  "src/app/admin/content/categories/page.tsx",
  "src/app/admin/content/series/page.tsx",
]) {
  if (!existsSync(resolve(ROOT, required))) failures.push(`Missing canonical route: ${required}`);
}

for (const legacyRoot of [
  "src/app/admin/topics",
  "src/app/admin/content/media",
  "src/app/admin/media-center",
]) {
  const files = walk(resolve(ROOT, legacyRoot));
  if (files.length) {
    failures.push(`${legacyRoot} still contains: ${files.map((file) => relative(ROOT, file).split(sep).join("/")).join(", ")}`);
  }
}

const oldRoutePattern = /\/admin\/(?:topics|content\/media|media-center)(?:[/?#"'`]|\b)/;
for (const file of walk(SRC_ROOT)) {
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (oldRoutePattern.test(text)) {
    failures.push(`Old admin route reference in ${relative(ROOT, file).split(sep).join("/")}`);
  }
}

if (failures.length) {
  console.error("FAIL: Unified Content Admin clean cutover is incomplete.");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("OK: legacy admin content engines and routes are removed.");
