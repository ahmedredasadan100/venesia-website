/**
 * Production readiness — verify migrations/seeds applied in Supabase.
 * Usage: node scripts/production-readiness-verify.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];

function record(area, ok, detail) {
  results.push({ area, ok, detail });
  console.log(`${ok ? "OK" : "MISSING"} ${area}${detail ? `: ${detail}` : ""}`);
}

async function tableExists(table) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
  return !error || error.code !== "PGRST205";
}

async function pageId(slug) {
  const { data } = await supabase.from("pages").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

async function assignmentCount(table, pageIdValue) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageIdValue)
    .eq("is_visible", true);
  if (error) return -1;
  return count ?? 0;
}

async function heroAssignmentForPage(pageIdValue) {
  const { count } = await supabase
    .from("hero_assignments")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "page")
    .eq("target_id", pageIdValue)
    .eq("is_active", true);
  return count ?? 0;
}

async function templateExists(table, slug) {
  const { data, error } = await supabase.from(table).select("id").eq("slug", slug).maybeSingle();
  return !error && Boolean(data?.id);
}

// Core schema tables (New folder + root migrations)
const CORE_TABLES = [
  "pages",
  "content_block_templates",
  "page_content_block_assignments",
  "cta_block_templates",
  "page_cta_block_assignments",
  "cards_block_templates",
  "page_cards_block_assignments",
  "breadcrumb_block_templates",
  "page_breadcrumb_block_assignments",
  "hero_templates",
  "hero_assignments",
  "feed_module_templates",
  "page_feed_module_assignments",
  "projects",
  "project_floor_plans",
  "project_delivery_spec_items",
  "project_media",
  "media_items",
  "topics",
  "menus",
  "menu_items",
  "site_settings",
  "media_hub_module_templates",
  "page_media_hub_module_assignments",
  "media_sidebar_module_templates",
  "page_media_sidebar_module_assignments",
];

console.log("=== Schema tables ===");
for (const table of CORE_TABLES) {
  const exists = await tableExists(table);
  record(`table:${table}`, exists, exists ? "exists" : "not in schema cache");
}

console.log("\n=== Footer site_settings ===");
for (const key of ["footer.brand", "footer.contact_items", "footer.social_links", "footer.legal"]) {
  const { data, error } = await supabase.from("site_settings").select("key").eq("key", key).maybeSingle();
  record(`site_settings:${key}`, !error && Boolean(data), error?.message);
}

{
  const { data, error } = await supabase
    .from("site_settings")
    .select("key,value")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  record(
    "site_settings:maintenance_mode",
    !error && Boolean(data),
    error?.message ?? (data ? `enabled=${data.value?.enabled === true}` : "missing — run node scripts/apply-maintenance-mode-seed.mjs"),
  );
}

const { data: footerMenu } = await supabase
  .from("menus")
  .select("id")
  .eq("location", "footer")
  .eq("is_active", true)
  .maybeSingle();
record("footer menu", Boolean(footerMenu?.id), footerMenu?.id ? `id=${footerMenu.id}` : "missing");

console.log("\n=== Pages & assignments ===");
const PAGE_CHECKS = [
  { slug: "home", label: "Home", minContent: 1, modules: ["home-story", "home-trust", "home-contact", "home-projects"] },
  { slug: "about", label: "About", minContent: 1, modules: ["about-intro"] },
  { slug: "contact", label: "Contact", minContent: 1, modules: ["contact-form"] },
  { slug: "topics", label: "Topics", minContent: 0, modules: ["topics-intro"] },
  { slug: "track-your-project", label: "Track Your Project", minContent: 1, modules: ["track-intro"] },
  { slug: "media-center", label: "Media Center hub", minContent: 0, modules: [] },
];

for (const check of PAGE_CHECKS) {
  const id = await pageId(check.slug);
  record(`page:${check.slug}`, Boolean(id), id ? `id=${id}` : "missing");
  if (!id) continue;

  const heroCount = await heroAssignmentForPage(id);
  record(`${check.label} hero assignment`, heroCount > 0, heroCount ? String(heroCount) : "none");

  const contentCount = await assignmentCount("page_content_block_assignments", id);
  const cardsCount = await assignmentCount("page_cards_block_assignments", id);
  const ctaCount = await assignmentCount("page_cta_block_assignments", id);
  const breadcrumbCount = await assignmentCount("page_breadcrumb_block_assignments", id);
  const total = contentCount + cardsCount + ctaCount + breadcrumbCount;
  record(`${check.label} block assignments`, total >= check.minContent, `content=${contentCount} cards=${cardsCount} cta=${ctaCount} breadcrumb=${breadcrumbCount}`);

  for (const mod of check.modules) {
    const ok = await templateExists("content_block_templates", mod);
    record(`template:${mod}`, ok);
  }
}

console.log("\n=== Media Center pages ===");
for (const slug of [
  "media-center-news",
  "media-center-videos",
  "media-center-gallery",
  "media-center-press",
  "media-center-site-updates",
]) {
  const id = await pageId(slug);
  record(`page:${slug}`, Boolean(id), id ? `id=${id}` : "missing");
  if (id) {
    const heroCount = await heroAssignmentForPage(id);
    record(`${slug} hero`, heroCount > 0, String(heroCount));
  }
}

console.log("\n=== Media Hub / Sidebar modules ===");
const hubPageId = await pageId("media-center");
if (hubPageId) {
  const hubCount = await assignmentCount("page_media_hub_module_assignments", hubPageId);
  const sidebarCount = await assignmentCount("page_media_sidebar_module_assignments", hubPageId);
  record("media-center hub assignments", hubCount > 0, String(hubCount));
  record("media-center sidebar assignments", sidebarCount > 0, String(sidebarCount));
} else {
  record("media-center hub assignments", false, "page missing");
}

console.log("\n=== Projects core ===");
const { count: projectCount } = await supabase
  .from("projects")
  .select("id", { count: "exact", head: true })
  .eq("publication_status", "published");
record("published projects", (projectCount ?? 0) > 0, String(projectCount ?? 0));

console.log("\n=== RPC (projects sync) ===");
const { error: rpcError } = await supabase.rpc("sync_project_children", {
  p_project_id: 0,
});
record(
  "rpc:sync_project_children",
  rpcError?.code === "PGRST202" ? false : true,
  rpcError?.code === "42883" || rpcError?.message?.includes("project") ? "exists (error expected on bad id)" : rpcError?.message ?? "callable",
);

const missing = results.filter((r) => !r.ok);
console.log(`\n${results.length - missing.length}/${results.length} checks OK`);
if (missing.length) {
  console.log("\nMissing / needs seed:");
  for (const item of missing) console.log(`  - ${item.area}: ${item.detail ?? ""}`);
  process.exitCode = 1;
}
