/**
 * Verify Page Builder duplicate-assigned-module affordances only.
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
const action = read("src/app/admin/pages-blocks/pages/page-actions/assignment-duplicate.ts");
const helpers = read("src/app/admin/pages-blocks/pages/page-actions/helpers.ts");
const result = read("src/lib/page-blocks/action-result.ts");
const audit = read("scripts/verify-admin-audit-coverage.mjs");
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");

assert(row.includes('action="duplicate"'), "Page assignment row must expose duplicate action");
assert(row.includes("نسخ الموديول"), "Duplicate action label missing");
assert(grid.includes("onDuplicate"), "Assignments grid must wire onDuplicate");
assert(grid.includes("sixCompact"), "Grid must reserve six compact action columns");
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
assert(dataGrid.includes("sixCompact"), "AdminDataGrid sixCompact preset missing");

if (failures.length) {
  console.error("verify-page-builder-duplicate FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-page-builder-duplicate OK");
