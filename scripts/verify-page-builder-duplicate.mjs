/**
 * Verify Page Builder duplicate-assigned-module affordances only.
 *
 * The duplicate capability is owned by the shared row-actions contract. The
 * page builder keeps unsafe persisted reorder controls fail-closed until an
 * atomic domain mutation exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];

function read(relPath) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${relPath}`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const row = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx");
const grid = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx");
const client = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const header = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksHeader.tsx");
const pagePolicy = read("src/lib/pages/page-admin-policy.ts");
const action = read("src/app/admin/pages-blocks/pages/page-actions/assignment-duplicate.ts");
const helpers = read("src/app/admin/pages-blocks/pages/page-actions/helpers.ts");
const result = read("src/lib/page-blocks/action-result.ts");
const audit = read("scripts/verify-admin-audit-coverage.mjs");

assert(row.includes("AdminDataGridRowActions"), "Page assignment row must adopt shared row actions");
assert(row.includes("duplicate: manageable"), "Page assignment row must expose the duplicate capability");
assert(row.includes("onSelect: onDuplicate"), "Shared duplicate capability must invoke onDuplicate");
assert(
  pagePolicy.includes("export function resolvePagePublicPath"),
  "Page public paths must have one shared policy owner",
);
assert(
  client.includes("const previewHref = resolvePagePublicPath(page)") &&
    client.match(/previewHref=\{previewHref\}/g)?.length === 2,
  "Page Composition must resolve once and pass the public preview path to Header and Assignments",
);
assert(
  header.includes("previewHref: string | null") &&
    header.includes("disabled={!previewHref}") &&
    !header.includes('page.path || "/"'),
  "Page Composition Header must fail closed instead of inventing a root preview path",
);
assert(
  grid.includes("previewHref={previewHref}") &&
    row.includes("preview: previewHref") &&
    row.includes('access: "allowed"') &&
    row.includes("href: previewHref"),
  "Every assignment row must inherit the authoritative page Preview capability",
);
assert(grid.includes("onDuplicate"), "Assignments grid must wire onDuplicate");
assert(
  !grid.includes('adminDataGridActionsColumn(2, "compact")') &&
    !grid.includes("onReorder") &&
    !row.includes("canReorderUp") &&
    !row.includes("تحريك لأعلى"),
  "Assignments grid must fail closed while atomic reorder is unavailable",
);
assert(
  grid.includes("ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact"),
  "Grid must reserve the shared row-actions track",
);
assert(client.includes("duplicateAssignedPageModule"), "PageBlocksClient must call duplicate action");
assert(client.includes("handleDuplicateAssignment"), "Duplicate handler missing");
assert(action.includes("export async function duplicateAssignedPageModule"), "duplicateAssignedPageModule missing");
assert(action.includes('moduleKind === "hero"'), "Hero duplicate branch missing");
assert(action.includes("is_visible: false"), "Copied assignment must be hidden");
assert(action.includes('status: "draft"'), "Copied template must start as draft");
assert(action.includes("deleteTemplateOrphan"), "Orphan template cleanup missing");
assert(action.includes("uniqueCopySlug"), "Unique internal slug helper missing");
assert(helpers.includes('"duplicate"'), "Audit verb duplicate missing");
assert(result.includes("redirectTo"), "Action result redirectTo missing");
assert(audit.includes("assignment-duplicate.ts"), "Audit coverage must list assignment-duplicate");

if (failures.length) {
  console.error("verify-page-builder-duplicate FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-page-builder-duplicate OK");
