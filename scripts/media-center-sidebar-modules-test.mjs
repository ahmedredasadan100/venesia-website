/**
 * Media Center sidebar modules — public + admin runtime tests.
 * Usage: node scripts/media-center-sidebar-modules-test.mjs [port]
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

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function extractSidebarPanelTitles(html) {
  const asideMatch = html.match(/<aside class="space-y-6 text-right"[^>]*dir="rtl"[^>]*>([\s\S]*?)<\/aside>/);
  const slice = asideMatch?.[1] ?? html;
  const titles = [];
  const patterns = ["أقسام المركز الإعلامي", "أحدث الأخبار", "الأكثر قراءة"];
  for (const title of patterns) {
    const idx = slice.indexOf(title);
    if (idx !== -1) titles.push({ title, idx });
  }

  titles.sort((a, b) => a.idx - b.idx);
  return titles.map((entry) => entry.title);
}

async function getPageId(slug) {
  const { data } = await supabase.from("pages").select("id,slug").eq("slug", slug).maybeSingle();
  return data;
}

async function getLatestAssignment(pageId) {
  const { data: template } = await supabase
    .from("media_sidebar_module_templates")
    .select("id")
    .eq("slug", "media-sidebar-latest")
    .maybeSingle();

  if (!template) return null;

  const { data } = await supabase
    .from("page_media_sidebar_module_assignments")
    .select("id,is_visible,sort_order")
    .eq("page_id", pageId)
    .eq("template_id", template.id)
    .maybeSingle();

  return data;
}

async function setLatestVisibility(pageId, isVisible) {
  const assignment = await getLatestAssignment(pageId);
  if (!assignment) throw new Error("latest assignment missing");

  const { error } = await supabase
    .from("page_media_sidebar_module_assignments")
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq("id", assignment.id);

  if (error) throw new Error(error.message);
  return assignment.id;
}

async function setWidgetSortOrders(pageId, sectionsOrder, popularOrder) {
  const slugs = [
    ["media-sidebar-sections", sectionsOrder],
    ["media-sidebar-popular", popularOrder],
  ];

  for (const [slug, sortOrder] of slugs) {
    const { data: template } = await supabase
      .from("media_sidebar_module_templates")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!template) throw new Error(`template ${slug} missing`);

    const { error } = await supabase
      .from("page_media_sidebar_module_assignments")
      .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
      .eq("page_id", pageId)
      .eq("template_id", template.id);

    if (error) throw new Error(error.message);
  }
}

async function deleteSidebarAssignments(pageId) {
  const { error } = await supabase
    .from("page_media_sidebar_module_assignments")
    .delete()
    .eq("page_id", pageId);

  if (error) throw new Error(error.message);
}

async function restoreSidebarAssignments(pageId) {
  const templates = [
    ["media-sidebar-sections", 10],
    ["media-sidebar-latest", 20],
    ["media-sidebar-popular", 30],
  ];

  for (const [slug, sortOrder] of templates) {
    const { data: template } = await supabase
      .from("media_sidebar_module_templates")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!template) throw new Error(`template ${slug} missing`);

    const { error } = await supabase.from("page_media_sidebar_module_assignments").upsert(
      {
        page_id: pageId,
        template_id: template.id,
        slot: "sidebar",
        sort_order: sortOrder,
        is_visible: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "page_id,template_id" },
    );

    if (error) throw new Error(error.message);
  }
}

const newsPage = await getPageId("media-center-news");
if (!newsPage) {
  fail("Page exists: media-center-news", "missing");
  process.exit(1);
}

const sidebarCountRes = await supabase
  .from("page_media_sidebar_module_assignments")
  .select("*", { count: "exact", head: true })
  .eq("page_id", newsPage.id);

if ((sidebarCountRes.count ?? 0) >= 3) {
  pass("DB sidebar assignments seeded", String(sidebarCountRes.count));
} else {
  fail("DB sidebar assignments seeded", String(sidebarCountRes.count ?? 0));
}

const publicRes = await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" });
if (!publicRes.ok) {
  fail("Public news page loads", `HTTP ${publicRes.status}`);
} else {
  pass("Public news page loads");
  const html = await publicRes.text();
  const titles = extractSidebarPanelTitles(html);

  if (html.includes("ابحث في المركز الإعلامي")) pass("Search panel present");
  else fail("Search panel present", "missing");

  if (titles.includes("أقسام المركز الإعلامي") && titles.includes("أحدث الأخبار") && titles.includes("الأكثر قراءة")) {
    pass("Default three sidebar panels visible", titles.join(" → "));
  } else {
    fail("Default three sidebar panels visible", titles.join(", ") || "none");
  }

  if (html.includes('class="space-y-6 text-right"') && html.includes("lg:grid-cols-[320px_1fr]")) {
    pass("Sidebar/layout markup unchanged");
  } else {
    fail("Sidebar/layout markup unchanged", "expected classes missing");
  }

  await setLatestVisibility(newsPage.id, false);
  const hiddenRes = await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" });
  const hiddenHtml = await hiddenRes.text();
  const hiddenTitles = extractSidebarPanelTitles(hiddenHtml);

  if (!hiddenTitles.includes("أحدث الأخبار")) pass("Hide latest panel removes title from public");
  else fail("Hide latest panel removes title from public", hiddenTitles.join(", "));

  if (hiddenTitles.includes("أقسام المركز الإعلامي") && hiddenTitles.includes("الأكثر قراءة")) {
    pass("Other panels remain after hiding latest");
  } else {
    fail("Other panels remain after hiding latest", hiddenTitles.join(", "));
  }

  await setLatestVisibility(newsPage.id, true);
  await setWidgetSortOrders(newsPage.id, 30, 10);

  const reorderedRes = await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" });
  const reorderedHtml = await reorderedRes.text();
  const reorderedTitles = extractSidebarPanelTitles(reorderedHtml);

  if (
    reorderedTitles.length >= 3 &&
    reorderedTitles.indexOf("الأكثر قراءة") < reorderedTitles.indexOf("أقسام المركز الإعلامي")
  ) {
    pass("Sort order changes panel sequence", reorderedTitles.join(" → "));
  } else {
    fail("Sort order changes panel sequence", reorderedTitles.join(" → ") || "insufficient panels");
  }

  await setWidgetSortOrders(newsPage.id, 10, 30);

  await deleteSidebarAssignments(newsPage.id);
  const fallbackRes = await fetch(`${baseUrl}/media-center/news`, { cache: "no-store" });
  const fallbackHtml = await fallbackRes.text();
  const fallbackTitles = extractSidebarPanelTitles(fallbackHtml);

  if (
    fallbackTitles.includes("أقسام المركز الإعلامي") &&
    fallbackTitles.includes("أحدث الأخبار") &&
    fallbackTitles.includes("الأكثر قراءة")
  ) {
    pass("Fallback shows three panels when assignments removed", fallbackTitles.join(" → "));
  } else {
    fail("Fallback shows three panels when assignments removed", fallbackTitles.join(", ") || "none");
  }

  await restoreSidebarAssignments(newsPage.id);
}

const adminRes = await fetch(`${baseUrl}/admin/pages-blocks/pages/${newsPage.id}`, { cache: "no-store" });
if (!adminRes.ok) {
  fail("Admin page loads: media-center-news", `HTTP ${adminRes.status}`);
} else {
  const adminHtml = await adminRes.text();
  if (adminHtml.includes("Media Sidebar") && adminHtml.includes("أحدث الأخبار")) {
    pass("Admin shows sidebar modules on media-center-news");
  } else {
    fail("Admin shows sidebar modules on media-center-news", "expected labels missing");
  }

  const metaMatch = adminHtml.match(/(\d+)\s+موديول/);
  const metaCount = metaMatch ? Number(metaMatch[1]) : 0;
  if (metaCount >= 6) pass("Admin module count includes sidebar modules", String(metaCount));
  else fail("Admin module count includes sidebar modules", metaMatch ? String(metaCount) : "meta not found");
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
console.log("Media Center sidebar modules test OK.");
