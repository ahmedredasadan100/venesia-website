/**
 * Applies media_center_cms_pages seed — registers shell pages in CMS.
 * Usage: node scripts/apply-media-center-pages-seed.mjs
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

const PAGE_TYPE_BY_SLUG = {
  "media-center": "hub",
  "media-center-news": "static",
  "media-center-videos": "static",
  "media-center-gallery": "static",
  "media-center-press": "static",
  "media-center-site-updates": "static",
};

const PAGES = [
  { title: "المركز الإعلامي", slug: "media-center", path: "/media-center" },
  { title: "المركز الإعلامي — الأخبار", slug: "media-center-news", path: "/media-center/news" },
  { title: "المركز الإعلامي — الفيديوهات", slug: "media-center-videos", path: "/media-center/videos" },
  { title: "المركز الإعلامي — معرض الصور", slug: "media-center-gallery", path: "/media-center/gallery" },
  { title: "المركز الإعلامي — الصحافة", slug: "media-center-press", path: "/media-center/press" },
  {
    title: "المركز الإعلامي — تحديثات المواقع",
    slug: "media-center-site-updates",
    path: "/media-center/site-updates",
  },
];

for (const page of PAGES) {
  const { data, error } = await supabase
    .from("pages")
    .upsert(
      {
        title: page.title,
        slug: page.slug,
        path: page.path,
        page_type: PAGE_TYPE_BY_SLUG[page.slug],
        status: "published",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id,slug,path,status")
    .single();

  if (error) {
    console.error(`FAIL ${page.slug}:`, error.message);
    process.exit(1);
  }

  console.log(`OK ${data.slug} → ${data.path} (id=${data.id})`);
}

console.log("Media Center CMS pages seed applied.");
