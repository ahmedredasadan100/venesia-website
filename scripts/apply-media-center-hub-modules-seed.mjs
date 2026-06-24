/**
 * Applies media_hub_modules seed — hub sections + hero/breadcrumb on media-center.
 * Prerequisite: sql/migrations/20250625300000_media_hub_modules.sql applied
 *   (node scripts/apply-media-hub-migration.mjs with SUPABASE_DB_URL, or Supabase SQL Editor)
 * Usage: node scripts/apply-media-center-hub-modules-seed.mjs
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function ensureHubSchema() {
  const { error } = await supabase.from("media_hub_module_templates").select("id").limit(1);
  if (!error) return;

  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Hub tables missing. Apply sql/migrations/20250625300000_media_hub_modules.sql first.");
    console.error("Or set SUPABASE_DB_URL / DATABASE_URL and re-run this script.");
    process.exit(1);
  }

  const sql = readFileSync(resolve(ROOT, "sql/migrations/20250625300000_media_hub_modules.sql"), "utf8");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Applied hub migration SQL via database connection.");
}

await ensureHubSchema();

const HUB_TEMPLATES = [
  {
    slug: "media-hub-featured",
    name: "Media Featured News Module",
    description: "Featured news + side carousel on Media Center hub",
    section_key: "featured",
    config: { source: "media_items", type: "news", featured: true, sideLimit: 3, listLimit: 4 },
    sort_order: 10,
    assignmentSortOrder: 10,
  },
  {
    slug: "media-hub-site-updates",
    name: "Media Site Updates Module",
    description: "Site updates timeline on Media Center hub",
    section_key: "site-updates",
    config: { source: "media_items", type: "site-update", limit: 4 },
    sort_order: 20,
    assignmentSortOrder: 20,
  },
  {
    slug: "media-hub-videos",
    name: "Media Videos Module",
    description: "Videos section on Media Center hub",
    section_key: "videos",
    config: { source: "media_items", type: "video", limit: 4 },
    sort_order: 30,
    assignmentSortOrder: 30,
  },
  {
    slug: "media-hub-gallery",
    name: "Media Gallery Module",
    description: "Gallery section on Media Center hub",
    section_key: "gallery",
    config: { source: "media_items", type: "gallery", limit: 8 },
    sort_order: 40,
    assignmentSortOrder: 40,
  },
  {
    slug: "media-hub-press",
    name: "Media Press Module",
    description: "Press releases section on Media Center hub",
    section_key: "press",
    config: { source: "media_items", type: "press" },
    sort_order: 50,
    assignmentSortOrder: 50,
  },
];

async function upsertHeroTemplate() {
  const { data, error } = await supabase
    .from("hero_templates")
    .upsert(
      {
        name: "Hero — Media Center Hub",
        slug: "hero-media-center",
        description: "Hero for /media-center hub",
        section_key: "hero",
        variant: "internal-page",
        style_preset: "cinematic-gold",
        source_type: "manual",
        limit_count: 1,
        is_visible: true,
        sort_order: 30,
        config: {
          title: "المركز الإعلامي",
          images: ["/images/venesia-5.png"],
          eyebrow: "Media Center",
          showCta: false,
          subtitle: "أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.",
          highlight: "",
          description: "أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.",
          showBreadcrumb: true,
          imagePositionClassName: "object-[42%_36%]",
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (error || !data) throw new Error(`hero template: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertBreadcrumbTemplate() {
  const { data, error } = await supabase
    .from("breadcrumb_block_templates")
    .upsert(
      {
        name: "Breadcrumb — Media Center Hub",
        slug: "breadcrumb-media-center",
        description: "Breadcrumb for /media-center hub",
        variant: "hero-inline",
        status: "published",
        config: { source: "navigation", showHome: true },
        sort_order: 30,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (error || !data) throw new Error(`breadcrumb template: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertHubTemplate(template) {
  const { data, error } = await supabase
    .from("media_hub_module_templates")
    .upsert(
      {
        name: template.name,
        slug: template.slug,
        description: template.description,
        section_key: template.section_key,
        status: "published",
        config: template.config,
        sort_order: template.sort_order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id,slug")
    .single();

  if (error || !data) throw new Error(`hub template ${template.slug}: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertHeroAssignment(pageId, pageSlug, pagePath, heroId) {
  const { data: existing } = await supabase
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("target_id", pageId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("hero_assignments")
      .update({ hero_id: heroId, target_slug: pageSlug, path: pagePath, priority: 100 })
      .eq("id", existing.id);
    if (error) throw new Error(`hero assignment update: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("hero_assignments").insert({
    hero_id: heroId,
    target_type: "page",
    target_id: pageId,
    target_slug: pageSlug,
    path: pagePath,
    is_active: true,
    priority: 100,
  });
  if (error) throw new Error(`hero assignment insert: ${error.message}`);
}

async function upsertAssignment(table, pageId, templateId, slot, sortOrder, isVisible) {
  const { error } = await supabase.from(table).upsert(
    {
      page_id: pageId,
      template_id: templateId,
      slot,
      sort_order: sortOrder,
      is_visible: isVisible,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_id,template_id" },
  );
  if (error) throw new Error(`${table}: ${error.message}`);
}

const { data: page, error: pageError } = await supabase
  .from("pages")
  .select("id,slug,path")
  .eq("slug", "media-center")
  .maybeSingle();

if (pageError || !page) {
  console.error("Page missing: media-center. Run apply-media-center-pages-seed.mjs first.");
  process.exit(1);
}

const heroId = await upsertHeroTemplate();
const breadcrumbId = await upsertBreadcrumbTemplate();
await upsertHeroAssignment(page.id, page.slug, page.path, heroId);
await upsertAssignment("page_breadcrumb_block_assignments", page.id, breadcrumbId, "hero", 5, true);

for (const template of HUB_TEMPLATES) {
  const templateId = await upsertHubTemplate(template);
  await upsertAssignment("page_media_hub_module_assignments", page.id, templateId, "main", template.assignmentSortOrder, true);
  console.log(`OK ${template.slug} (id=${templateId})`);
}

console.log(`Media Center hub modules seed applied on page id=${page.id}.`);
