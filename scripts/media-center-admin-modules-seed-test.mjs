/**
 * Verifies Media Center listing pages have default modules in Admin grid (not empty).
 * Usage: node scripts/media-center-admin-modules-seed-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] || process.env.PORT || "3002";
const baseUrl = `http://127.0.0.1:${port}`;

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LISTING_PAGES = [
  {
    slug: "media-center-news",
    heroName: "Hero — Media Center News",
    breadcrumbName: "Breadcrumb — Media Center News",
    contentName: "Media Center — News Listing Shell",
  },
  {
    slug: "media-center-videos",
    heroName: "Hero — Media Center Videos",
    breadcrumbName: "Breadcrumb — Media Center Videos",
    contentName: "Media Center — Videos Listing Shell",
  },
  {
    slug: "media-center-gallery",
    heroName: "Hero — Media Center Gallery",
    breadcrumbName: "Breadcrumb — Media Center Gallery",
    contentName: "Media Center — Gallery Listing Shell",
  },
  {
    slug: "media-center-press",
    heroName: "Hero — Media Center Press",
    breadcrumbName: "Breadcrumb — Media Center Press",
    contentName: "Media Center — Press Listing Shell",
  },
  {
    slug: "media-center-site-updates",
    heroName: "Hero — Media Center Site Updates",
    breadcrumbName: "Breadcrumb — Media Center Site Updates",
    contentName: "Media Center — Site Updates Listing Shell",
  },
];

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

async function countModules(pageId) {
  const [
    { count: heroCount },
    { count: breadcrumbCount },
    { count: contentCount },
    { count: sidebarCount },
  ] = await Promise.all([
    supabase
      .from("hero_assignments")
      .select("*", { count: "exact", head: true })
      .eq("target_type", "page")
      .eq("target_id", pageId)
      .eq("is_active", true),
    supabase.from("page_breadcrumb_block_assignments").select("*", { count: "exact", head: true }).eq("page_id", pageId),
    supabase.from("page_content_block_assignments").select("*", { count: "exact", head: true }).eq("page_id", pageId),
    supabase.from("page_media_sidebar_module_assignments").select("*", { count: "exact", head: true }).eq("page_id", pageId),
  ]);

  return (heroCount ?? 0) + (breadcrumbCount ?? 0) + (contentCount ?? 0) + (sidebarCount ?? 0);
}

for (const expected of LISTING_PAGES) {
  const { data: page } = await supabase.from("pages").select("id,slug").eq("slug", expected.slug).maybeSingle();
  if (!page) {
    fail(`Page exists: ${expected.slug}`, "missing");
    continue;
  }

  const moduleCount = await countModules(page.id);
  if (moduleCount >= 6) pass(`DB modules seeded: ${expected.slug}`, `${moduleCount} assignments`);
  else if (moduleCount >= 3) pass(`DB modules seeded (listing only): ${expected.slug}`, `${moduleCount} assignments`);
  else fail(`DB modules seeded: ${expected.slug}`, `only ${moduleCount} assignments`);

  const res = await fetch(`${baseUrl}/admin/pages-blocks/pages/${page.id}`, { cache: "no-store" });
  if (!res.ok) {
    fail(`Admin page loads: ${expected.slug}`, `HTTP ${res.status}`);
    continue;
  }

  const html = await res.text();

  if (html.includes("لا توجد موديولات معيّنة")) {
    fail(`Admin grid not empty: ${expected.slug}`, "empty state rendered");
  } else {
    pass(`Admin grid not empty: ${expected.slug}`);
  }

  for (const label of [expected.heroName, expected.breadcrumbName, expected.contentName]) {
    if (html.includes(label)) pass(`${expected.slug} admin shows ${label}`);
    else fail(`${expected.slug} admin shows ${label}`, "template name missing from admin HTML");
  }

  const metaMatch = html.match(/(\d+)\s+موديول/);
  const metaCount = metaMatch ? Number(metaMatch[1]) : 0;
  if (metaCount >= 6) pass(`${expected.slug} admin meta module count`, String(metaCount));
  else if (metaCount >= 3) pass(`${expected.slug} admin meta module count (listing only)`, String(metaCount));
  else fail(`${expected.slug} admin meta module count`, metaMatch ? String(metaCount) : "meta not found");
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
console.log("Media Center admin modules seed test OK.");
