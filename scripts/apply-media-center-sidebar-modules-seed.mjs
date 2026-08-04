/**
 * Applies media_sidebar_modules seed — templates + sidebar assignments on Media Center pages.
 * Usage: node scripts/apply-media-center-sidebar-modules-seed.mjs
 */
import { createClient } from "@supabase/supabase-js";
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

const PAGE_SLUGS = [
  "media-center",
  "media-center-news",
  "media-center-videos",
  "media-center-gallery",
  "media-center-press",
  "media-center-site-updates",
];

const TEMPLATES = [
  {
    slug: "media-sidebar-sections",
    name: "أقسام المركز الإعلامي",
    description: "Navigation links for Media Center sections",
    widget_key: "sections",
    config: { source: "navigation", menuParent: "/media-center" },
    sort_order: 10,
    assignmentSortOrder: 10,
  },
  {
    slug: "media-sidebar-latest",
    name: "أحدث الأخبار",
    description: "Latest news items in Media Center sidebar",
    widget_key: "latest",
    config: { source: "topics", type: "news", limit: 3 },
    sort_order: 20,
    assignmentSortOrder: 20,
  },
  {
    slug: "media-sidebar-popular",
    name: "الأكثر قراءة",
    description: "Popular media items in Media Center sidebar",
    widget_key: "popular",
    config: { source: "topics", isPopular: true, limit: 4 },
    sort_order: 30,
    assignmentSortOrder: 30,
  },
];

async function upsertTemplate(template) {
  const { data, error } = await supabase
    .from("media_sidebar_module_templates")
    .upsert(
      {
        name: template.name,
        slug: template.slug,
        description: template.description,
        widget_key: template.widget_key,
        status: "published",
        config: template.config,
        sort_order: template.sort_order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id,slug")
    .single();

  if (error || !data) throw new Error(`template ${template.slug}: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertAssignment(pageId, templateId, sortOrder) {
  const { error } = await supabase.from("page_media_sidebar_module_assignments").upsert(
    {
      page_id: pageId,
      template_id: templateId,
      slot: "sidebar",
      sort_order: sortOrder,
      is_visible: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_id,template_id" },
  );

  if (error) throw new Error(`assignment page=${pageId} template=${templateId}: ${error.message}`);
}

const templateIds = new Map();
for (const template of TEMPLATES) {
  const id = await upsertTemplate(template);
  templateIds.set(template.slug, { id, assignmentSortOrder: template.assignmentSortOrder });
  console.log(`OK template ${template.slug} (id=${id})`);
}

for (const pageSlug of PAGE_SLUGS) {
  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,slug")
    .eq("slug", pageSlug)
    .maybeSingle();

  if (pageError || !page) {
    console.error(`Page missing: ${pageSlug}. Run apply-media-center-pages-seed.mjs first.`);
    process.exit(1);
  }

  for (const template of TEMPLATES) {
    const entry = templateIds.get(template.slug);
    await upsertAssignment(page.id, entry.id, entry.assignmentSortOrder);
  }

  console.log(`OK ${pageSlug} → 3 sidebar modules (page id=${page.id})`);
}

console.log("Media Center sidebar modules seed applied.");
