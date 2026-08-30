/**
 * Basic guardrail: known critical CMS mutation action files must reference
 * a CMS audit helper. Skips files with no obvious Supabase mutations.
 *
 * Usage: node scripts/verify-admin-audit-coverage.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const TARGET_FILES = [
  "src/app/admin/pages-blocks/pages/page-actions/page-status.ts",
  "src/app/admin/pages-blocks/pages/page-actions/page-delete.ts",
  "src/app/admin/pages-blocks/pages/page-actions/page-duplicate.ts",
  "src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts",
  "src/app/admin/pages-blocks/pages/page-actions/assignment-update.ts",
  "src/app/admin/pages-blocks/pages/page-actions/assignment-status.ts",
  "src/app/admin/pages-blocks/pages/page-actions/assignment-delete.ts",
  "src/app/admin/pages-blocks/pages/page-actions/assignment-duplicate.ts",
  "src/app/admin/pages-blocks/pages/page-actions/bulk.ts",
  "src/app/admin/content/topics/article-actions/save.ts",
  "src/app/admin/content/topics/media-actions/save.ts",
  "src/app/admin/content/topics/actions.ts",
  "src/app/admin/content/categories/actions.ts",
  "src/app/admin/projects/project-actions/save-entry.ts",
  "src/app/admin/projects/project-actions/publication.ts",
  "src/app/admin/projects/project-actions/delete.ts",
  "src/app/admin/projects/locations/actions.ts",
  "src/app/admin/content/series/actions.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/save.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/menu-status.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/delete.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/duplicate.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/import.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/bulk.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/items-save.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/items-delete.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/items-status.ts",
  "src/app/admin/pages-blocks/footer/footer-actions/save.ts",
  "src/app/admin/pages-blocks/footer/footer-actions/restore-default.ts",
  "src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts",
  "src/app/admin/pages-blocks/blocks/cards/actions.ts",
  "src/app/admin/pages-blocks/blocks/cta/actions.ts",
  "src/app/admin/pages-blocks/blocks/feed/actions.ts",
  "src/app/admin/pages-blocks/blocks/featured/actions.ts",
  "src/app/admin/pages-blocks/blocks/hero/actions.ts",
  "src/app/admin/pages-blocks/blocks/media-hub/actions.ts",
  "src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts",
  "src/app/admin/settings/general/actions.ts",
  "src/app/admin/seo/redirects/actions.ts",
  "src/app/admin/seo/meta-manager/actions.ts",
];

const MUTATION_MARKERS = [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("];

const AUDIT_MARKERS = [
  "recordCmsAdminAudit(",
  "auditMenuAction(",
  "auditPageBlockAssignment(",
];

const MINIMUM_PAGE_BLOCK_AUDIT_CALLS = new Map([
  ["src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts", 6],
  ["src/app/admin/pages-blocks/blocks/cards/actions.ts", 6],
  ["src/app/admin/pages-blocks/blocks/cta/actions.ts", 6],
  ["src/app/admin/pages-blocks/blocks/feed/actions.ts", 6],
  ["src/app/admin/pages-blocks/blocks/featured/actions.ts", 6],
  ["src/app/admin/pages-blocks/blocks/hero/actions.ts", 6],
  ["src/app/admin/pages-blocks/blocks/media-hub/actions.ts", 2],
  ["src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts", 2],
]);

const failures = [];

for (const rel of TARGET_FILES) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) {
    failures.push(`Missing expected action file: ${rel}`);
    continue;
  }

  const content = readFileSync(full, "utf8");
  const hasMutation = MUTATION_MARKERS.some((marker) => content.includes(marker));
  if (!hasMutation) continue;

  const hasAudit = AUDIT_MARKERS.some((marker) => content.includes(marker));
  if (!hasAudit) {
    failures.push(`${rel} performs mutations but has no CMS audit helper call`);
  }

  const minimumAuditCalls = MINIMUM_PAGE_BLOCK_AUDIT_CALLS.get(rel);
  if (minimumAuditCalls) {
    const auditCallCount = content.match(/\brecordCmsAdminAudit\s*\(/gu)?.length ?? 0;
    if (auditCallCount < minimumAuditCalls) {
      failures.push(
        `${rel} has ${auditCallCount} CMS audit calls; expected at least ${minimumAuditCalls} for its mutation inventory`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("FAIL: Admin audit coverage guardrail failed.");
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log("OK: Critical CMS action files include audit logging.");
for (const rel of TARGET_FILES) {
  console.log(` - ${rel}`);
}
