import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  registry,
  client,
  page,
  actions,
  mutation,
  mutationCache,
  controller,
  normalizedCache,
  adapter,
  migration,
  correctiveMigration,
  searchMigration,
  company,
  settings,
  contracts,
  pageColumns,
  pageColumnActions,
] = await Promise.all([
  read("src/lib/admin/entity-list/data-engine/registry.ts"),
  read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx"),
  read("src/app/admin/pages-blocks/pages/page.tsx"),
  read("src/app/admin/pages-blocks/pages/page-actions/page-delete.ts"),
  read("src/lib/admin/entity-list/data-engine/instant-mutation.ts"),
  read("src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts"),
  read("src/lib/admin/entity-list/data-engine/client-controller.ts"),
  read("src/lib/admin/entity-list/data-engine/normalized-result-cache.ts"),
  read("src/lib/admin/pages/entity-list-adapter.ts"),
  read("sql/migrations/20260720060000_admin_pages_list_read_model.sql"),
  read("sql/migrations/20260720100000_admin_pages_list_read_model_page_normalization.sql"),
  read("sql/migrations/20260805120000_admin_pages_search_read_model.sql"),
  read("src/lib/admin/shell/company-config.ts"),
  read("src/app/admin/settings/general/actions.ts"),
  read("src/lib/admin/entity-list/data-engine/contracts.ts"),
  read("src/lib/admin/pages/pages-list-config.ts"),
  read("src/app/admin/pages-blocks/pages/page-actions/column-preferences.ts"),
]);
const pagePolicy = await read("src/lib/pages/page-admin-policy.ts");
assert.match(registry, /pages:\s*pagesEntityListAdapter/);
assert.match(client, /useAdminEntityListController/);
assert.match(client, /useAdminEntityInstantMutation/);
assert.match(client, /controller\.query/);
assert.match(client, /<AdminEntityList</);
assert.match(client, /enableColumnManagement/);
assert.match(client, /mapAdminActionResultToFeedback/);
assert.doesNotMatch(client, /<AdminNotice\b|\bsetFeedback\b|\buseAdminFeedback\b/);
assert.match(client, /AdminDataGridRowActions/);
assert.match(pagePolicy, /export function resolvePagePublicPath/);
assert.match(client, /resolvePagePublicPath/);
assert.doesNotMatch(client, /function publicPath/);
assert.match(client, /duplicatePageAjax/);
assert.match(
  client,
  /action:\s*"duplicate"[\s\S]*?optimistic:\s*\(\)\s*=>\s*undefined/,
);
assert.match(client, /confirmation:\s*\{[\s\S]*?mode:\s*"shared"/);
assert.match(client, /getBulkConfirmation/);
assert.equal((client.match(/<AdminConfirmDialog/g) ?? []).length, 0);
assert.match(pageColumns, /PAGES_PREFERENCE_COLUMN_KEYS/);
assert.match(pageColumnActions, /saveAdminColumnPreferences/);
assert.match(page, /readAdminColumnPreferences/);
assert.doesNotMatch(client, /router\.refresh|window\.confirm|useAdminTable/);
assert.doesNotMatch(actions, /redirect\(|loadPagesTableRows/);
assert.doesNotMatch(actions, /rows\s*:/);
assert.match(mutation, /cancelQueries/);
assert.match(mutation, /getQueriesData/);
assert.match(mutation, /snapshot\.forEach/);
assert.match(mutation, /setAdminEntityListCachesInScope/);
assert.match(mutation, /matchesAdminEntityListScope/);
assert.match(mutation, /replaceExistingAdminEntityRows/);
assert.match(mutationCache, /totalRows - ids\.size/);
assert.match(mutationCache, /setAdminEntityListCachesInScope/);
assert.match(mutationCache, /matchesAdminEntityListScope/);
assert.doesNotMatch(mutationCache, /rows:\s*\[\.\.\.inserted/);
assert.match(controller, /cacheNormalizedAdminEntityListResult/);
assert.match(normalizedCache, /setQueryData\(normalizedKey, result\)/);
assert.match(adapter, /\.rpc\("admin_list_pages"/);
assert.match(adapter, /p_search:\s*query\.search/);
assert.equal((adapter.match(/\.rpc\(/g) ?? []).length, 1);
assert.doesNotMatch(adapter, /return loadPagesEntityListResult/);
assert.match(adapter, /z\.coerce\.number\(\)\.int\(\)\.nonnegative\(\)\.finite\(\)/);
assert.doesNotMatch(adapter, /Number\(readModel\.total_count\)/);
assert.match(adapter, /PagesEntityListDatabaseError/);
assert.match(adapter, /page:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
for (const table of ["page_content_block_assignments", "page_cta_block_assignments", "page_cards_block_assignments", "page_breadcrumb_block_assignments", "page_feed_module_assignments", "page_media_sidebar_module_assignments", "page_media_hub_module_assignments", "hero_assignments"]) assert.ok(migration.includes(table), table);
assert.match(correctiveMigration, /normalized_state/);
assert.match(correctiveMigration, /'page', \(select page from normalized_state\)/);
assert.match(searchMigration, /p_search text default ''/);
assert.match(searchMigration, /drop function if exists public\.admin_list_pages\(integer, integer, text, text\)/);
for (const field of ["title", "slug", "path", "page_type", "status"]) {
  assert.ok(searchMigration.includes(`coalesce(p.${field}, '')`), `search read model missing ${field}`);
}
assert.match(searchMigration, /notify pgrst, 'reload schema'/);
assert.match(searchMigration, /revoke all on function public\.admin_list_pages\(integer, integer, text, text, text\)/);
assert.match(searchMigration, /grant execute on function public\.admin_list_pages\(integer, integer, text, text, text\)[\s\S]*?to service_role/);
assert.match(contracts, /isSameAdminEntityListScope/);
assert.match(company, /unstable_cache/);
assert.match(company, /ADMIN_COMPANY_CONFIG_CACHE_TAG/);
assert.match(company, /revalidateTag\(ADMIN_COMPANY_CONFIG_CACHE_TAG/);
assert.equal((settings.match(/revalidatePath\("\/admin"/g) ?? []).length, 1);
assert.match(page, /loadPagesEntityListResult/);
console.log("verify:admin-instant-pages passed (69 structural assertions)");
