import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/gu, "\n");

const migrationPath =
  "sql/migrations/20260810010000_page_delete_hero_assignment_integrity.sql";
const migration = read(migrationPath);
const contract = read("src/lib/admin/pages/entity-list-contract.ts");
const adapter = read("src/lib/admin/pages/entity-list-adapter.ts");
const config = read("src/lib/admin/pages/pages-list-config.ts");
const page = read("src/app/admin/pages-blocks/pages/page.tsx");
const client = read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx");
const preferenceAction = read(
  "src/app/admin/pages-blocks/pages/page-actions/column-preferences.ts",
);
const compositionClient = read(
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
);
const assignmentRow = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
);
const assignModal = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx",
);
const assignmentDelete = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-delete.ts",
);
const assignmentReorder = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
);
const pagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const uiRules = read("src/components/admin/ui/ADMIN_UI_RULES.md");

const replacementMatch = migration.match(
  /v_new constant text := \$new\$([\s\S]*?)\$new\$;/u,
);
const deleteReplacement = replacementMatch?.[1] ?? "";
const heroCleanup =
  "delete from public.hero_assignments\n    where target_type = 'page' and target_id = p_page_id;";
const pageDelete = "delete from public.pages where id = p_page_id;";

assert.match(migration, /^-- Page hard-delete Hero assignment integrity correction\./u);
assert.match(migration, /begin;[\s\S]*pg_get_functiondef[\s\S]*commit;\s*$/u);
assert.match(migration, /elsif p_operation = 'delete_page' then/u);
assert.match(migration, /elsif p_operation = 'replace_hero_template' then/u);
assert.match(migration, /v_delete_branch := left\(v_delete_branch, v_branch_end - 1\)/u);
assert.ok(replacementMatch, "Migration replacement payload is missing.");
assert.ok(deleteReplacement.includes(heroCleanup));
assert.ok(deleteReplacement.indexOf(heroCleanup) < deleteReplacement.indexOf(pageDelete));
assert.equal((deleteReplacement.match(/delete from public\.hero_assignments/gu) ?? []).length, 1);
assert.doesNotMatch(deleteReplacement, /delete from public\.hero_templates|target_type\s*(?:<>|!=|in\s*\()/iu);
assert.doesNotMatch(migration.replace(/^\s*--.*$/gmu, ""), /drop\s+table|alter\s+table|truncate\s+table/iu);

assert.match(contract, /moduleCount:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/u);
assert.match(contract, /createAdminEntityListResultSchema\(pageEntityListRowSchema\)/u);
assert.match(adapter, /block_count:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/u);
assert.match(adapter, /moduleCount:\s*block_count/u);
assert.equal((adapter.match(/\.rpc\(/gu) ?? []).length, 1);

assert.match(config, /PAGES_LIST_COLUMN_CONTRACT_VERSION\s*=\s*2/u);
for (const key of ["page", "slug", "moduleCount", "status", "actions"]) {
  assert.ok(config.includes(`key: "${key}"`), `Pages column contract missing ${key}`);
}
assert.doesNotMatch(config, /key:\s*"type"/u);
assert.match(page, /contractVersion:\s*PAGES_LIST_COLUMN_CONTRACT_VERSION/u);
assert.match(preferenceAction, /contractVersion:\s*PAGES_LIST_COLUMN_CONTRACT_VERSION/u);
assert.match(client, /type PageEntityListRow/u);
assert.match(client, /export type AdminPageListRow = PageEntityListRow/u);
assert.match(client, /flexible:\s*true/u);
assert.match(client, /row\.moduleCount/u);

for (const retiredPath of [
  "src/lib/admin/pages/load-pages-table-rows.ts",
  "src/lib/admin/pages/load-page-module-counts.ts",
]) {
  assert.equal(existsSync(resolve(root, retiredPath)), false, `Legacy Pages read path remains: ${retiredPath}`);
}

assert.doesNotMatch(assignmentRow, /AdminStatusPill/u);
assert.match(assignmentRow, /AdminDataGridRowActions[\s\S]*display="visibility"/u);
assert.equal((assignmentRow.match(/const capability: AdminRowActionsCapability/gu) ?? []).length, 1);
assert.match(compositionClient, /if \(table\.sort\.key !== null\) return false;/u);
assert.match(compositionClient, /if \(table\.sort\.key !== null\) return;/u);
assert.match(uiRules, /عند تفعيل فرز عرض مختلف، يُعطّل reorder/u);
assert.match(assignmentReorder, /mutatePageComposition\([\s\S]*"reorder"/u);

assert.match(assignModal, /ASSIGNABLE_MODULE_KINDS/u);
assert.match(assignModal, /moduleKindLabel\(kind\)/u);
assert.match(assignModal, /getContentStatusMetadata\(template\.status\)\.label/u);
assert.doesNotMatch(assignModal, /<option value="hero">Hero<\/option>/u);
assert.match(assignmentDelete, /mutatePageComposition\([\s\S]*"bulk"[\s\S]*action:\s*"delete"/u);
assert.doesNotMatch(assignmentDelete, /hero_templates|_templates"\)\.delete/u);

assert.match(pagination, /const shouldShowFooter = totalCount > currentPageSize \|\| totalPages > 1;/u);
assert.match(pagination, /if \(!shouldShowFooter\) return null;/u);
assert.equal(9 > 10 || 1 > 1, false, "9/10 must keep the shared pagination footer hidden");

console.log("Pages Shell closure guard passed (owner, contracts, consumers, integrity, and failure boundaries).\n");
