/**
 * Verify Page Builder duplicate-assigned-module affordances only.
 *
 * The duplicate capability is owned by the shared row-actions contract. The
 * page builder delegates duplicate and reorder persistence to the aggregate
 * atomic Page Composition owner.
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
const reorder = read("src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts");
const migration = read("sql/migrations/20260805180000_global_truth_atomic_operations_closure.sql");
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
  grid.includes("canMove") && grid.includes("onMove") &&
    row.includes("canMoveUp") && row.includes("canMoveDown") &&
    client.includes("handleMoveAssignment") && reorder.includes('"reorder"'),
  "Assignments grid must delegate persisted ordering to the atomic reorder action",
);
assert(
  grid.includes("ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact"),
  "Grid must reserve the shared row-actions track",
);
assert(client.includes("duplicateAssignedPageModule"), "PageBlocksClient must call duplicate action");
assert(client.includes("handleDuplicateAssignment"), "Duplicate handler missing");
assert(action.includes("export async function duplicateAssignedPageModule"), "duplicateAssignedPageModule missing");
assert(action.includes('kind === "hero"'), "Hero duplicate branch missing");
assert(action.includes("coordinateMediaReferenceEntityMutation"), "Duplicate must retain Media write coordination");
assert(action.includes("mutatePageComposition") && action.includes('"duplicate_assignment"'), "Non-Hero duplicate must use the atomic aggregate owner");
assert(migration.includes("jsonb_set(v_clone, '{status}', '\"draft\"'::jsonb)"), "Copied status-capable template must start as draft");
assert(migration.includes("jsonb_set(v_clone, '{is_visible}', 'false'::jsonb)"), "Copied template must start hidden");
assert(migration.includes("'page_composition.' || p_operation"), "Atomic duplicate owner must write Audit");
assert(helpers.includes("mutatePageComposition"), "Page actions helper must expose the RPC boundary");
assert(result.includes("redirectTo"), "Action result redirectTo missing");
assert(audit.includes("assignment-duplicate.ts"), "Audit coverage must list assignment-duplicate");

if (failures.length) {
  console.error("verify-page-builder-duplicate FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-page-builder-duplicate OK");
