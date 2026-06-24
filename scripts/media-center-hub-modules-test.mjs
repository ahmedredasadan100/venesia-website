/**
 * Media Center hub modules — public + admin smoke tests.
 * Usage: node scripts/media-center-hub-modules-test.mjs [port]
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

const SECTION_MARKERS = [
  { slug: "media-hub-featured", pattern: /Latest News/ },
  { slug: "media-hub-site-updates", pattern: /Site Updates/ },
  { slug: "media-hub-videos", pattern: /\bVideos\b/ },
  { slug: "media-hub-gallery", pattern: /\bGallery\b/ },
  { slug: "media-hub-press", pattern: /Press Releases/ },
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

function extractHubSectionHtml(html) {
  const marker = '<section class="space-y-10 text-right text-white" dir="rtl">';
  const start = html.indexOf(marker);
  if (start === -1) return "";
  return html.slice(start);
}

function extractHubSectionOrder(html) {
  const hubHtml = extractHubSectionHtml(html);
  const found = [];

  for (const marker of SECTION_MARKERS) {
    const idx = hubHtml.search(marker.pattern);
    if (idx !== -1) found.push({ slug: marker.slug, idx });
  }

  found.sort((a, b) => a.idx - b.idx);
  return found.map((entry) => entry.slug);
}

async function getTemplateId(slug) {
  const { data } = await supabase.from("media_hub_module_templates").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

async function getHubAssignment(pageId, templateSlug) {
  const templateId = await getTemplateId(templateSlug);
  if (!templateId) return null;

  const { data } = await supabase
    .from("page_media_hub_module_assignments")
    .select("id,is_visible,sort_order")
    .eq("page_id", pageId)
    .eq("template_id", templateId)
    .maybeSingle();

  return data;
}

async function setHubVisibility(pageId, templateSlug, isVisible) {
  const assignment = await getHubAssignment(pageId, templateSlug);
  if (!assignment) throw new Error(`assignment missing: ${templateSlug}`);

  const { error } = await supabase
    .from("page_media_hub_module_assignments")
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq("id", assignment.id);

  if (error) throw new Error(error.message);
}

async function setHubTemplateConfig(templateSlug, config) {
  const templateId = await getTemplateId(templateSlug);
  if (!templateId) throw new Error(`template missing: ${templateSlug}`);

  const { error } = await supabase
    .from("media_hub_module_templates")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", templateId);

  if (error) throw new Error(error.message);
}

async function getHubTemplateConfig(templateSlug) {
  const { data } = await supabase
    .from("media_hub_module_templates")
    .select("config")
    .eq("slug", templateSlug)
    .maybeSingle();

  return data?.config ?? null;
}

function countSiteUpdateLinks(html) {
  const hubHtml = extractHubSectionHtml(html);
  const siteUpdatesStart = hubHtml.indexOf("Site Updates");
  if (siteUpdatesStart === -1) return 0;

  const slice = hubHtml.slice(siteUpdatesStart);
  const matches = slice.match(/href="\/media-center\/site-updates\/[^"]+"/g);
  return matches?.length ?? 0;
}

async function setHubSortOrder(pageId, templateSlug, sortOrder) {
  const assignment = await getHubAssignment(pageId, templateSlug);
  if (!assignment) throw new Error(`assignment missing: ${templateSlug}`);

  const { error } = await supabase
    .from("page_media_hub_module_assignments")
    .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", assignment.id);

  if (error) throw new Error(error.message);
}

async function deleteHubAssignments(pageId) {
  const { error } = await supabase.from("page_media_hub_module_assignments").delete().eq("page_id", pageId);
  if (error) throw new Error(error.message);
}

async function restoreHubAssignments(pageId) {
  for (const marker of SECTION_MARKERS) {
    const templateId = await getTemplateId(marker.slug);
    if (!templateId) throw new Error(`template missing: ${marker.slug}`);

    const sortOrder = SECTION_MARKERS.indexOf(marker) * 10 + 10;
    const { error } = await supabase.from("page_media_hub_module_assignments").upsert(
      {
        page_id: pageId,
        template_id: templateId,
        slot: "main",
        sort_order: sortOrder,
        is_visible: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "page_id,template_id" },
    );
    if (error) throw new Error(error.message);
  }
}

const { data: page } = await supabase.from("pages").select("id,slug").eq("slug", "media-center").maybeSingle();
if (!page) {
  fail("Page exists: media-center", "missing");
  process.exit(1);
}

const hubCountRes = await supabase
  .from("page_media_hub_module_assignments")
  .select("*", { count: "exact", head: true })
  .eq("page_id", page.id);

if ((hubCountRes.count ?? 0) >= 5) pass("DB hub assignments seeded", String(hubCountRes.count));
else fail("DB hub assignments seeded", String(hubCountRes.count ?? 0));

for (const marker of SECTION_MARKERS) {
  const assignment = await getHubAssignment(page.id, marker.slug);
  if (assignment) pass(`Hub assignment exists: ${marker.slug}`);
  else fail(`Hub assignment exists: ${marker.slug}`, "missing");
}

const publicRes = await fetch(`${baseUrl}/media-center`, { cache: "no-store" });
if (!publicRes.ok) {
  fail("Public hub page loads", `HTTP ${publicRes.status}`);
} else {
  pass("Public hub page loads");
  const html = await publicRes.text();
  const order = extractHubSectionOrder(html);

  if (order.length >= 5) pass("Default five hub sections visible", order.join(" → "));
  else fail("Default five hub sections visible", order.join(", ") || "none");

  if (html.includes('class="space-y-10 text-right text-white"')) pass("Hub section layout markup preserved");
  else fail("Hub section layout markup preserved", "space-y-10 section missing");

  if (html.includes("xl:grid-cols-[0.95fr_1.05fr]")) pass("Timeline/videos grid markup preserved");
  else fail("Timeline/videos grid markup preserved", "grid class missing");

  await setHubVisibility(page.id, "media-hub-videos", false);
  const hiddenRes = await fetch(`${baseUrl}/media-center`, { cache: "no-store" });
  const hiddenHtml = await hiddenRes.text();
  const hiddenHub = extractHubSectionHtml(hiddenHtml);

  if (!/\bVideos\b/.test(hiddenHub)) pass("Hide videos module removes section from hub");
  else fail("Hide videos module removes section from hub", "Videos marker still present");

  await setHubVisibility(page.id, "media-hub-videos", true);
  await setHubSortOrder(page.id, "media-hub-gallery", 5);
  await setHubSortOrder(page.id, "media-hub-featured", 45);

  const reorderedRes = await fetch(`${baseUrl}/media-center`, { cache: "no-store" });
  const reorderedOrder = extractHubSectionOrder(await reorderedRes.text());

  if (
    reorderedOrder.includes("media-hub-gallery") &&
    reorderedOrder.includes("media-hub-featured") &&
    reorderedOrder.indexOf("media-hub-gallery") < reorderedOrder.indexOf("media-hub-featured")
  ) {
    pass("Sort order changes hub section sequence", reorderedOrder.join(" → "));
  } else {
    fail("Sort order changes hub section sequence", reorderedOrder.join(" → ") || "insufficient sections");
  }

  await restoreHubAssignments(page.id);

  await deleteHubAssignments(page.id);
  const fallbackRes = await fetch(`${baseUrl}/media-center`, { cache: "no-store" });
  const fallbackOrder = extractHubSectionOrder(await fallbackRes.text());

  if (fallbackOrder.length >= 5) pass("Fallback shows five hub sections when assignments removed", fallbackOrder.join(" → "));
  else fail("Fallback shows five hub sections when assignments removed", fallbackOrder.join(", ") || "none");

  await restoreHubAssignments(page.id);

  const originalSiteUpdatesConfig =
    (await getHubTemplateConfig("media-hub-site-updates")) ?? {
      source: "media_items",
      type: "site-update",
      limit: 4,
    };

  await setHubTemplateConfig("media-hub-site-updates", {
    source: "media_items",
    type: "site-update",
    limit: 2,
  });

  const limitedRes = await fetch(`${baseUrl}/media-center`, { cache: "no-store" });
  const limitedCount = countSiteUpdateLinks(await limitedRes.text());

  if (limitedCount === 2) pass("Hub site-updates limit applies from config", String(limitedCount));
  else fail("Hub site-updates limit applies from config", String(limitedCount));

  await setHubTemplateConfig("media-hub-site-updates", originalSiteUpdatesConfig);
}

const adminRes = await fetch(`${baseUrl}/admin/pages-blocks/pages/${page.id}`, { cache: "no-store" });
if (!adminRes.ok) {
  fail("Admin page loads: media-center", `HTTP ${adminRes.status}`);
} else {
  const adminHtml = await adminRes.text();

  if (adminHtml.includes("Hero — Media Center Hub")) pass("Admin shows hub hero");
  else fail("Admin shows hub hero", "missing");

  if (adminHtml.includes("Breadcrumb — Media Center Hub")) pass("Admin shows hub breadcrumb");
  else fail("Admin shows hub breadcrumb", "missing");

  if (adminHtml.includes("Media Hub") && adminHtml.includes("Media Featured News Module")) {
    pass("Admin shows hub modules on media-center");
  } else {
    fail("Admin shows hub modules on media-center", "expected labels missing");
  }

  for (const marker of SECTION_MARKERS) {
    const label = marker.slug
      .replace("media-hub-", "")
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ");
    const expectedName = adminHtml.includes(
      marker.slug === "media-hub-featured"
        ? "Media Featured News Module"
        : marker.slug === "media-hub-site-updates"
          ? "Media Site Updates Module"
          : marker.slug === "media-hub-videos"
            ? "Media Videos Module"
            : marker.slug === "media-hub-gallery"
              ? "Media Gallery Module"
              : "Media Press Module",
    );
    if (expectedName) pass(`Admin lists ${marker.slug}`);
    else fail(`Admin lists ${marker.slug}`, "template name missing");
  }

  const metaMatch = adminHtml.match(/(\d+)\s+موديول/);
  const metaCount = metaMatch ? Number(metaMatch[1]) : 0;
  if (metaCount >= 10) pass("Admin module count includes hero/breadcrumb/hub/sidebar", String(metaCount));
  else if (metaCount >= 7) pass("Admin module count includes hero/breadcrumb/hub", String(metaCount));
  else fail("Admin module count", metaMatch ? String(metaCount) : "meta not found");
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
console.log("Media Center hub modules test OK.");
