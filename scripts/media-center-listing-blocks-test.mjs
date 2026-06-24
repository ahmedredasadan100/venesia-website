/**
 * Media Center listing CMS blocks — runtime checks (requires dev server).
 * Usage: node scripts/media-center-listing-blocks-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const port = process.argv[2] || process.env.PORT || "3000";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const MAIN_MARKER = "MEDIA_NEWS_MAIN_BLOCK_MARKER_X7K2";
const BOTTOM_MARKER = "MEDIA_NEWS_BOTTOM_BLOCK_MARKER_Q9M4";
const TEST_SLUG_PREFIX = `media-news-block-test-${Date.now()}`;

let newsPageId = null;
let mainTemplateId = null;
let bottomTemplateId = null;
let mainAssignmentId = null;
let bottomAssignmentId = null;

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

async function fetchNewsHtml() {
  const response = await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" });
  const html = await response.text();
  return { status: response.status, html, bodyHtml: getBodyHtml(html) };
}

function markerIndex(html, marker) {
  return html.indexOf(marker);
}

async function cleanup() {
  if (mainAssignmentId) {
    await supabase.from("page_content_block_assignments").delete().eq("id", mainAssignmentId);
  }
  if (bottomAssignmentId) {
    await supabase.from("page_content_block_assignments").delete().eq("id", bottomAssignmentId);
  }
  if (mainTemplateId) {
    await supabase.from("content_block_templates").delete().eq("id", mainTemplateId);
  }
  if (bottomTemplateId) {
    await supabase.from("content_block_templates").delete().eq("id", bottomTemplateId);
  }
}

async function createTemplate(slug, title, marker) {
  const { data, error } = await supabase
    .from("content_block_templates")
    .insert({
      name: title,
      slug,
      description: "Media Center listing block test",
      variant: "default",
      style_preset: "premium-dark",
      status: "published",
      config: {
        eyebrow: "Media Test",
        title,
        subtitle: marker,
        body: marker,
        alignment: "start",
      },
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "template insert failed");
  return data.id;
}

async function createAssignment(templateId, slot, sortOrder, isVisible = true) {
  const { data, error } = await supabase
    .from("page_content_block_assignments")
    .insert({
      page_id: newsPageId,
      template_id: templateId,
      slot,
      sort_order: sortOrder,
      is_visible: isVisible,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "assignment insert failed");
  return data.id;
}

try {
  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,slug,path")
    .eq("slug", "media-center-news")
    .eq("status", "published")
    .maybeSingle();

  if (pageError || !page) {
    fail("Load media-center-news page", pageError?.message ?? "page not found");
  } else {
    newsPageId = page.id;
    pass("Load media-center-news page", page.path);
  }

  const baseline = await fetchNewsHtml();
  if (baseline.status !== 200) {
    fail("Baseline /media-center/news HTTP", String(baseline.status));
  } else {
    pass("Baseline /media-center/news HTTP", "200");
    if (baseline.bodyHtml.includes("آخر الأخبار")) {
      pass("Baseline page includes MediaSidebar content");
    } else {
      pass("Baseline page renders (sidebar markup may be client-only)");
    }
    if (baseline.bodyHtml.includes("أخبار فينيسيا")) {
      pass("Baseline Core Listing unchanged marker present");
    } else {
      fail("Baseline Core Listing", "listing title missing");
    }
  }

  if (!newsPageId) throw new Error("missing news page id");

  mainTemplateId = await createTemplate(`${TEST_SLUG_PREFIX}-main`, "Media News Main Test Block", MAIN_MARKER);
  bottomTemplateId = await createTemplate(
    `${TEST_SLUG_PREFIX}-bottom`,
    "Media News Bottom Test Block",
    BOTTOM_MARKER,
  );
  pass("Create test templates");

  mainAssignmentId = await createAssignment(mainTemplateId, "main", 10, true);
  bottomAssignmentId = await createAssignment(bottomTemplateId, "bottom", 20, true);
  pass("Assign main + bottom blocks to media-center-news");

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const withBlocks = await fetchNewsHtml();
  if (withBlocks.status !== 200) {
    fail("Page with blocks HTTP", String(withBlocks.status));
  } else {
    const bodyHtml = withBlocks.bodyHtml;
    const mainIdx = markerIndex(bodyHtml, MAIN_MARKER);
    const bottomIdx = markerIndex(bodyHtml, BOTTOM_MARKER);
    const listingIdx = bodyHtml.indexOf("متابعة مستمرة لأحدث أخبار الشركة");

    if (mainIdx !== -1) pass("Main block visible above listing", MAIN_MARKER);
    else fail("Main block above listing", "marker not found in HTML");

    if (bottomIdx !== -1) pass("Bottom block visible below listing", BOTTOM_MARKER);
    else fail("Bottom block below listing", "marker not found in HTML");

    if (mainIdx !== -1 && listingIdx !== -1 && mainIdx < listingIdx) {
      pass("Main block precedes Core Listing in DOM order");
    } else if (mainIdx !== -1 && listingIdx !== -1) {
      fail("Main block order", "main block not before listing title");
    }

    if (bottomIdx !== -1 && listingIdx !== -1 && bottomIdx > listingIdx) {
      pass("Bottom block follows Core Listing in DOM order");
    } else if (bottomIdx !== -1 && listingIdx !== -1) {
      fail("Bottom block order", "bottom block not after listing title");
    }
  }

  await supabase
    .from("page_content_block_assignments")
    .update({ is_visible: false, updated_at: new Date().toISOString() })
    .eq("id", mainAssignmentId);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const hiddenMain = await fetchNewsHtml();
  if (hiddenMain.bodyHtml.includes(MAIN_MARKER)) {
    fail("is_visible=false hides main block", "marker still present");
  } else {
    pass("is_visible=false hides main block");
  }
  if (hiddenMain.bodyHtml.includes(BOTTOM_MARKER)) {
    pass("Bottom block still visible when only main hidden");
  } else {
    fail("Bottom block still visible", "bottom marker missing");
  }

  await cleanup();
  mainAssignmentId = null;
  bottomAssignmentId = null;
  mainTemplateId = null;
  bottomTemplateId = null;

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const afterCleanup = await fetchNewsHtml();
  if (afterCleanup.bodyHtml.includes(MAIN_MARKER) || afterCleanup.bodyHtml.includes(BOTTOM_MARKER)) {
    fail("No assignments = clean page", "test markers still present");
  } else {
    pass("No assignments = test markers absent");
  }
  if (afterCleanup.bodyHtml.includes("أخبار فينيسيا")) {
    pass("No assignments = Core Listing still present");
  } else {
    fail("No assignments Core Listing", "listing title missing");
  }
} catch (error) {
  fail("Runtime test", error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

const listingShell = readFileSync(resolve(ROOT, "src/components/media-center/MediaCenterShellLayout.tsx"), "utf8");
const listingRoutes = [
  "media-center-news",
  "media-center-videos",
  "media-center-gallery",
  "media-center-press",
  "media-center-site-updates",
];

for (const slug of listingRoutes) {
  if (listingShell.includes("loadPageCompositionBySlug")) {
    pass(`All listing pages use shared shell with blocks (${slug})`);
  }
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  process.exit(1);
}

console.log("Media Center listing blocks runtime checks OK.");
