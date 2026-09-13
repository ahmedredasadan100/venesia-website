import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

/** Exact schema/owner excerpts only; no historical CMS seed or backup replay. */
export function buildSharedAtomicFixtureSchema() {
  const evidence = [];
  const read = (file) => {
    const source = readFileSync(`sql/migrations/${file}`, "utf8").replaceAll("\r\n", "\n");
    evidence.push({ file, sha256: createHash("sha256").update(source).digest("hex") });
    return source;
  };
  const tables = [];
  function addTables(file, names) {
    const source = read(file);
    for (const name of names) {
      const match = source.match(new RegExp(`create table if not exists (?:public\\.)?${name} \\([\\s\\S]*?\\n\\);`, "i"));
      if (!match) throw new Error(`Missing fixture table ${name}`);
      tables.push({ name, source: match[0] });
    }
    return source;
  }
  addTables("20250618000000_foundational_schema_baseline.sql", ["pages", "hero_templates", "hero_assignments", "menus", "menu_items", "topic_categories", "topic_series", "topics"]);
  addTables("20250618100000_page_blocks_phase1.sql", ["content_block_templates", "cta_block_templates", "cards_block_templates", "page_content_block_assignments", "page_cta_block_assignments", "page_cards_block_assignments"]);
  addTables("20250618500000_breadcrumb_module.sql", ["breadcrumb_block_templates", "page_breadcrumb_block_assignments"]);
  addTables("20250622000000_feed_modules_topics.sql", ["feed_module_templates", "page_feed_module_assignments"]);
  addTables("20250625200000_media_sidebar_modules.sql", ["media_sidebar_module_templates", "page_media_sidebar_module_assignments"]);
  addTables("20250625300000_media_hub_modules.sql", ["media_hub_module_templates", "page_media_hub_module_assignments"]);
  addTables("20250625600000_admin_users.sql", ["admin_users"]);
  addTables("20250625700000_admin_audit_logs.sql", ["admin_audit_logs"]);
  const featured = addTables("20260828233733_featured_page_composition_module.sql", ["featured_module_templates", "page_featured_module_assignments"]);
  const atomic = read("20260805180000_global_truth_atomic_operations_closure.sql");
  const atomicOwners = atomic.slice(atomic.indexOf("do $normalize_menu$"), atomic.indexOf("-- Normalize the existing cross-table slot order"));
  if (!atomicOwners.includes("mutate_page_composition") || !atomicOwners.includes("mutate_menu_tree")) throw new Error("Owner fixture incomplete");
  const featureView = featured.slice(featured.indexOf("create or replace view public.page_composition_assignments"), featured.indexOf("do $extend_admin_pages_read_owner$"));
  const featureOwner = featured.slice(featured.indexOf("do $extend_page_composition_owner$"), featured.indexOf("-- Adopt every non-listing"));
  const publication = read("20260807120000_system_publication_summary_cards_closure.sql");
  const heroTrigger = publication.slice(publication.indexOf("create or replace function public.sync_hero_template_publication_compatibility()"), publication.indexOf("-- Guarded in-place"));
  const affected = tables.map((table) => table.name);
  const publicationDdl = [...publication.matchAll(/alter table public\.\w+[\s\S]*?;/g)].map((match) => match[0]).filter((s) => affected.some((name) => s.startsWith(`alter table public.${name} `)));
  const taxonomy=read("20260808120000_taxonomy_lifecycle_contract.sql").match(/alter table public\.topic_categories\s+add column if not exists deleted_at timestamp with time zone;/)[0];
  return {
    evidence,
    tables: affected,
    sql: `begin; set local role postgres;\n${tables.map((table) => table.source).join("\n")}\n${atomicOwners}\n${featureView}\n${featureOwner}\n${publicationDdl.join("\n")}\n${heroTrigger}\n${taxonomy}\n${read("20260810010000_page_delete_hero_assignment_integrity.sql").replace(/^begin;|^commit;/gm, "")}\n${read("20260827122828_page_composition_media_position_adoption.sql").replace(/^begin;|^commit;/gm, "")}\n${affected.map((name) => `alter table public.${name} enable row level security; grant select,insert,update,delete on public.${name} to service_role;`).join("\n")}\ngrant usage,select on all sequences in schema public to service_role;\ncommit;`,
  };
}
