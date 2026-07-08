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
  "src/app/admin/pages-blocks/pages/actions.ts",
  "src/app/admin/topics/topic-actions/create.ts",
  "src/app/admin/topics/topic-actions/update.ts",
  "src/app/admin/topics/topic-actions/status.ts",
  "src/app/admin/topics/topic-actions/delete.ts",
  "src/app/admin/topics/topic-actions/duplicate.ts",
  "src/app/admin/topics/topic-actions/bulk.ts",
  "src/app/admin/topics/categories/actions.ts",
  "src/app/admin/content/media/media-actions/create.ts",
  "src/app/admin/content/media/media-actions/update.ts",
  "src/app/admin/content/media/media-actions/status.ts",
  "src/app/admin/content/media/media-actions/duplicate.ts",
  "src/app/admin/content/media/media-actions/bulk.ts",
  "src/app/admin/projects/project-actions/create.ts",
  "src/app/admin/projects/project-actions/update.ts",
  "src/app/admin/projects/project-actions/status.ts",
  "src/app/admin/projects/project-actions/delete.ts",
  "src/app/admin/projects/project-actions/duplicate.ts",
  "src/app/admin/projects/project-actions/bulk.ts",
  "src/app/admin/content/series/actions.ts",
  "src/app/admin/pages-blocks/menus/actions.ts",
  "src/app/admin/pages-blocks/footer/actions.ts",
  "src/app/admin/settings/general/actions.ts",
];

const MUTATION_MARKERS = [".insert(", ".update(", ".delete(", ".upsert("];

const AUDIT_MARKERS = [
  "recordCmsAdminAudit",
  "auditMenuAction",
  "auditPageBlockAssignment",
];

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
