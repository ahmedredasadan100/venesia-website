import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [registry, client, page, actions, mutation, adapter, migration, company, settings] = await Promise.all([
  read("src/lib/admin/entity-list/data-engine/registry.ts"),
  read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx"),
  read("src/app/admin/pages-blocks/pages/page.tsx"),
  read("src/app/admin/pages-blocks/pages/page-actions/page-delete.ts"),
  read("src/lib/admin/entity-list/data-engine/instant-mutation.ts"),
  read("src/lib/admin/pages/entity-list-adapter.ts"),
  read("sql/migrations/20260720060000_admin_pages_list_read_model.sql"),
  read("src/lib/admin/shell/company-config.ts"),
  read("src/app/admin/settings/general/actions.ts"),
]);
assert.match(registry, /pages:\s*pagesEntityListAdapter/);
assert.match(client, /useAdminEntityListController/);
assert.match(client, /useAdminEntityInstantMutation/);
assert.doesNotMatch(client, /router\.refresh|window\.confirm|useAdminTable/);
assert.doesNotMatch(actions, /redirect\(|loadPagesTableRows/);
assert.doesNotMatch(actions, /rows\s*:/);
assert.match(mutation, /cancelQueries/);
assert.match(mutation, /getQueriesData/);
assert.match(mutation, /snapshot\.forEach/);
assert.match(mutation, /totalRows - ids\.size/);
assert.match(adapter, /\.rpc\("admin_list_pages"/);
assert.equal((adapter.match(/\.rpc\(/g) ?? []).length, 1);
assert.doesNotMatch(adapter, /return loadPagesEntityListResult/);
assert.match(adapter, /z\.coerce\.number\(\)\.int\(\)\.nonnegative\(\)\.finite\(\)/);
assert.doesNotMatch(adapter, /Number\(readModel\.total_count\)/);
assert.match(adapter, /PagesEntityListDatabaseError/);
for (const table of ["page_content_block_assignments", "page_cta_block_assignments", "page_cards_block_assignments", "page_breadcrumb_block_assignments", "page_feed_module_assignments", "page_media_sidebar_module_assignments", "page_media_hub_module_assignments", "hero_assignments"]) assert.ok(migration.includes(table), table);
assert.match(company, /unstable_cache/);
assert.match(company, /ADMIN_COMPANY_CONFIG_CACHE_TAG/);
assert.match(company, /revalidateTag\(ADMIN_COMPANY_CONFIG_CACHE_TAG/);
assert.equal((settings.match(/revalidatePath\("\/admin"/g) ?? []).length, 1);
assert.match(page, /loadPagesEntityListResult/);
console.log("verify:admin-instant-pages passed (18 structural assertions)");
