import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Safe database-independent parity proof: the read model must use exactly the
// same additive assignment sources registered by the existing module owners.
const migration = await readFile(new URL("../sql/migrations/20260805120000_admin_pages_search_read_model.sql", import.meta.url), "utf8");
const featuredMigration = await readFile(new URL("../sql/migrations/20260828233733_featured_page_composition_module.sql", import.meta.url), "utf8");
const registry = await readFile(new URL("../src/lib/page-blocks/block-module-registry.ts", import.meta.url), "utf8");
const mediaSidebarRegistry = await readFile(new URL("../src/lib/media-sidebar-modules/registry.ts", import.meta.url), "utf8");
const mediaHubRegistry = await readFile(new URL("../src/lib/media-hub-modules/registry.ts", import.meta.url), "utf8");
const independentSources = `${registry}\n${mediaSidebarRegistry}\n${mediaHubRegistry}`;
for (const table of ["page_content_block_assignments", "page_cta_block_assignments", "page_cards_block_assignments", "page_breadcrumb_block_assignments", "page_feed_module_assignments", "page_featured_module_assignments", "page_media_sidebar_module_assignments", "page_media_hub_module_assignments"]) {
  assert.ok(`${migration}\n${featuredMigration}`.includes(table), `read model missing ${table}`);
  assert.ok(independentSources.includes(table), `independent registry missing ${table}`);
}
assert.match(migration, /target_type = 'page' and is_active = true/);
for (const retiredPath of ["../src/lib/admin/pages/load-page-module-counts.ts", "../src/lib/admin/pages/load-pages-table-rows.ts"]) {
  assert.equal(existsSync(new URL(retiredPath, import.meta.url)), false, `parallel Pages read path remains: ${retiredPath}`);
}
console.log("qa:admin-instant-pages structural database parity passed");
console.log("browser QA requires an authenticated Chromium session and is executed separately");
