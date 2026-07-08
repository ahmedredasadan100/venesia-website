/**
 * Fail if Legacy Media Admin still contains active CRUD/UI under
 * src/app/admin/media-center. Redirect stubs + mapping helper are allowed.
 *
 * Usage: node scripts/verify-no-active-legacy-media-admin.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEGACY_ROOT = resolve(ROOT, "src", "app", "admin", "media-center");
const SRC_ROOT = resolve(ROOT, "src");

const ALLOWED_LEGACY_FILES = new Set(
  [
    "page.tsx",
    "new/page.tsx",
    "[type]/page.tsx",
    "items/[id]/page.tsx",
    "items/[id]/preview/page.tsx",
    "categories/page.tsx",
    "categories/[id]/page.tsx",
  ].map((p) => p.split("/").join(sep)),
);

const FORBIDDEN_BASENAMES = new Set([
  "actions.ts",
  "MediaEditTabs.tsx",
  "MediaListControls.tsx",
  "MediaSaveBar.tsx",
  "MediaItemsAdminPage.tsx",
  "MediaAdminFilters.tsx",
  "MediaAdminTabs.tsx",
  "MediaImageField.tsx",
  "media-admin-config.ts",
  "MediaCategoriesTableClient.tsx",
  "MediaCategoryCreateModal.tsx",
  "CategorySlugFields.tsx",
]);

const failures = [];

function fail(message) {
  failures.push(message);
}

function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function walkSourceFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walkSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs|md)$/i.test(entry)) out.push(full);
  }
  return out;
}

if (!existsSync(LEGACY_ROOT)) {
  fail("src/app/admin/media-center is missing (redirect stubs required).");
} else {
  if (existsSync(join(LEGACY_ROOT, "actions.ts"))) {
    fail("Forbidden: src/app/admin/media-center/actions.ts still exists.");
  }
  if (existsSync(join(LEGACY_ROOT, "categories", "actions.ts"))) {
    fail("Forbidden: src/app/admin/media-center/categories/actions.ts still exists.");
  }
  if (existsSync(join(LEGACY_ROOT, "_components"))) {
    fail("Forbidden: src/app/admin/media-center/_components still exists.");
  }

  for (const file of listFilesRecursive(LEGACY_ROOT)) {
    const rel = relative(LEGACY_ROOT, file);
    const base = rel.split(sep).pop() ?? "";
    if (FORBIDDEN_BASENAMES.has(base)) {
      fail(`Forbidden legacy active file still present: src/app/admin/media-center/${rel.split(sep).join("/")}`);
      continue;
    }
    if (!ALLOWED_LEGACY_FILES.has(rel)) {
      fail(`Unexpected file under legacy media admin (redirect stubs only): src/app/admin/media-center/${rel.split(sep).join("/")}`);
    }
  }

  for (const allowed of ALLOWED_LEGACY_FILES) {
    const full = join(LEGACY_ROOT, allowed);
    if (!existsSync(full)) {
      fail(`Missing required redirect stub: src/app/admin/media-center/${allowed.split(sep).join("/")}`);
    }
  }
}

const importActionRe =
  /from\s+["'][^"']*admin\/media-center\/(?:actions\/)?actions["']|import\s*\(\s*["'][^"']*admin\/media-center\/(?:categories\/)?actions["']\s*\)/;
const navHrefRe =
  /(?:href|to)\s*[:=]\s*["'`]\/admin\/media-center(?:\/[^"'`]*)?["'`]|redirect\(\s*["'`]\/admin\/media-center(?:\/[^"'`]*)?["'`]\s*\)/;

for (const file of walkSourceFiles(SRC_ROOT)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (rel.startsWith("src/app/admin/media-center/")) continue;
  if (rel === "src/lib/admin/legacy-media-admin-routes.ts") continue;

  const text = readFileSync(file, "utf8");
  if (importActionRe.test(text)) {
    fail(`Forbidden import of legacy media-center actions in ${rel}`);
  }
  if (navHrefRe.test(text)) {
    fail(`Forbidden active /admin/media-center navigation/link in ${rel}`);
  }
  if (text.includes("/admin/media-center")) {
    fail(`Forbidden remaining /admin/media-center reference in ${rel}`);
  }
}

if (failures.length > 0) {
  console.error("FAIL: Legacy Media Admin is not fully closed.");
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log("OK: Legacy Media Admin is redirect-only.");
console.log("Allowed stubs:");
for (const allowed of [...ALLOWED_LEGACY_FILES].sort()) {
  console.log(` - src/app/admin/media-center/${allowed.split(sep).join("/")}`);
}
