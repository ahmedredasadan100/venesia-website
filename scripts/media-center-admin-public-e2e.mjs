/**
 * Admin + Public E2E for Media Center listing CMS blocks.
 * Usage: node scripts/media-center-admin-public-e2e.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const port = process.argv[2] || process.env.PORT || "3002";
const baseUrl = `http://127.0.0.1:${port}`;

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LISTING_PAGES = [
  { slug: "media-center-news", path: "/media-center/news", title: "المركز الإعلامي — الأخبار" },
  { slug: "media-center-videos", path: "/media-center/videos", title: "المركز الإعلامي — الفيديوهات" },
  { slug: "media-center-gallery", path: "/media-center/gallery", title: "المركز الإعلامي — معرض الصور" },
  { slug: "media-center-press", path: "/media-center/press", title: "المركز الإعلامي — الصحافة" },
  {
    slug: "media-center-site-updates",
    path: "/media-center/site-updates",
    title: "المركز الإعلامي — تحديثات المواقع",
  },
];

const MARKER_MAIN = `MEDIA_ADMIN_MAIN_${Date.now()}`;
const MARKER_BOTTOM = `MEDIA_ADMIN_BOTTOM_${Date.now()}`;
const MARKER_FIRST = `MEDIA_ADMIN_FIRST_${Date.now()}`;
const MARKER_SECOND = `MEDIA_ADMIN_SECOND_${Date.now()}`;
const TEST_SLUG_MAIN = `media-admin-e2e-main-${Date.now()}`;
const TEST_SLUG_BOTTOM = `media-admin-e2e-bottom-${Date.now()}`;
const TEST_SLUG_FIRST = `media-admin-e2e-first-${Date.now()}`;
const TEST_SLUG_SECOND = `media-admin-e2e-second-${Date.now()}`;

let templateMainId = null;
let templateBottomId = null;
let templateFirstId = null;
let templateSecondId = null;
let mainAssignmentId = null;
let bottomAssignmentId = null;
let firstAssignmentId = null;
let secondAssignmentId = null;
let newsPageId = null;

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function getBodyHtml(html) {
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return html;
  return bodyMatch[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "");
}

async function cleanup() {
  for (const id of [mainAssignmentId, bottomAssignmentId, firstAssignmentId, secondAssignmentId]) {
    if (id) await supabase.from("page_content_block_assignments").delete().eq("id", id);
  }
  for (const id of [templateMainId, templateBottomId, templateFirstId, templateSecondId]) {
    if (id) await supabase.from("content_block_templates").delete().eq("id", id);
  }
}

async function createTemplate(slug, name, marker) {
  const { data, error } = await supabase
    .from("content_block_templates")
    .insert({
      name,
      slug,
      description: "E2E admin/public block test",
      variant: "default",
      style_preset: "premium-dark",
      status: "published",
      config: { eyebrow: "Media E2E", title: marker, subtitle: marker, body: marker, alignment: "start" },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "template insert failed");
  return data.id;
}

try {
  const { data: adminPages } = await supabase.from("pages").select("id,title,slug,path,status").order("slug");
  for (const expected of LISTING_PAGES) {
    const row = adminPages?.find((page) => page.slug === expected.slug);
    if (row?.status === "published" && row.path === expected.path) {
      pass(`Admin pages list contains ${expected.slug}`, row.title);
    } else {
      fail(`Admin pages list contains ${expected.slug}`, row ? `status=${row.status}` : "missing");
    }
  }

  const { data: pickerPages } = await supabase.from("pages").select("id,title,slug,path").order("sort_order");
  const pickerSlugs = (pickerPages ?? []).map((page) => page.slug);
  for (const expected of LISTING_PAGES) {
    if (pickerSlugs.includes(expected.slug)) pass(`Assignment picker includes ${expected.slug}`);
    else fail(`Assignment picker includes ${expected.slug}`, "not in pages query");
  }

  newsPageId = adminPages?.find((page) => page.slug === "media-center-news")?.id ?? null;
  if (!newsPageId) throw new Error("media-center-news page id missing");

  templateMainId = await createTemplate(TEST_SLUG_MAIN, "Media E2E Main Block", MARKER_MAIN);
  templateBottomId = await createTemplate(TEST_SLUG_BOTTOM, "Media E2E Bottom Block", MARKER_BOTTOM);
  pass("Create published content templates", `${TEST_SLUG_MAIN}, ${TEST_SLUG_BOTTOM}`);

  const { data: mainAssign, error: mainError } = await supabase
    .from("page_content_block_assignments")
    .insert({
      page_id: newsPageId,
      template_id: templateMainId,
      slot: "main",
      sort_order: 10,
      is_visible: true,
    })
    .select("id")
    .single();
  if (mainError || !mainAssign) throw new Error(mainError?.message ?? "main assignment failed");
  mainAssignmentId = mainAssign.id;
  pass("Assign block to media-center-news", "slot=main sort_order=10");

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const mainHtml = getBodyHtml(await (await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" })).text());
  if (mainHtml.includes(MARKER_MAIN)) pass("Public /media-center/news shows main block", MARKER_MAIN);
  else fail("Public /media-center/news shows main block", "marker missing — restart server after build");

  await supabase
    .from("page_content_block_assignments")
    .update({ is_visible: false, updated_at: new Date().toISOString() })
    .eq("id", mainAssignmentId);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const hiddenHtml = getBodyHtml(await (await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" })).text());
  if (!hiddenHtml.includes(MARKER_MAIN)) pass("is_visible=false hides block on public page");
  else fail("is_visible=false hides block", "marker still visible");

  await supabase
    .from("page_content_block_assignments")
    .update({ is_visible: true, updated_at: new Date().toISOString() })
    .eq("id", mainAssignmentId);

  const { data: bottomAssign, error: bottomError } = await supabase
    .from("page_content_block_assignments")
    .insert({
      page_id: newsPageId,
      template_id: templateBottomId,
      slot: "bottom",
      sort_order: 20,
      is_visible: true,
    })
    .select("id")
    .single();
  if (bottomError) throw new Error(bottomError.message);
  bottomAssignmentId = bottomAssign.id;
  pass("Assign bottom block to media-center-news", "slot=bottom sort_order=20");

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const bothHtml = getBodyHtml(await (await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" })).text());
  const mainIdx = bothHtml.indexOf(MARKER_MAIN);
  const bottomIdx = bothHtml.indexOf(MARKER_BOTTOM);
  if (mainIdx !== -1 && bottomIdx !== -1 && mainIdx < bottomIdx) {
    pass("main block precedes bottom block in public DOM");
  } else {
    fail("main/bottom DOM order", `main=${mainIdx} bottom=${bottomIdx}`);
  }

  templateFirstId = await createTemplate(TEST_SLUG_FIRST, "Media E2E Sort First", MARKER_FIRST);
  templateSecondId = await createTemplate(TEST_SLUG_SECOND, "Media E2E Sort Second", MARKER_SECOND);

  const { data: firstAssign } = await supabase
    .from("page_content_block_assignments")
    .insert({ page_id: newsPageId, template_id: templateFirstId, slot: "main", sort_order: 5, is_visible: true })
    .select("id")
    .single();
  firstAssignmentId = firstAssign.id;

  const { data: secondAssign } = await supabase
    .from("page_content_block_assignments")
    .insert({ page_id: newsPageId, template_id: templateSecondId, slot: "main", sort_order: 15, is_visible: true })
    .select("id")
    .single();
  secondAssignmentId = secondAssign.id;
  pass("Assign two main blocks for sort_order", "sort 5 then 15");

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const sortHtml = getBodyHtml(await (await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" })).text());
  const firstIdx = sortHtml.indexOf(MARKER_FIRST);
  const secondIdx = sortHtml.indexOf(MARKER_SECOND);
  if (firstIdx !== -1 && secondIdx !== -1 && firstIdx < secondIdx) {
    pass("sort_order renders lower order first within main slot");
  } else {
    fail("sort_order within main", `first=${firstIdx} second=${secondIdx}`);
  }
} catch (error) {
  fail("Admin/public E2E", error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
console.log("Media Center admin/public E2E OK.");
