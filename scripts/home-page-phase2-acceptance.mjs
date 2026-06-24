/**
 * Phase 2 acceptance — sort_order main slot via buildHomeMainRenderPlan().
 * Usage: node scripts/home-page-phase2-acceptance.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const port = process.argv[2] || process.env.PORT || "3000";
const baseUrl = `http://127.0.0.1:${port}`;

const APPROVED_ORDER = ["home-story", "home-projects", "home-trust", "home-contact"];

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

function countMarker(html, pattern) {
  const body = getBodyHtml(html);
  return (body.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) || [])
    .length;
}

function extractMainPlanOrder(html) {
  const body = getBodyHtml(html);
  const start = body.indexOf('data-home-main-slot="plan"');
  if (start < 0) return [];

  const slice = body.slice(start);
  const slugRe = /data-home-plan-slug="(home-(?:story|projects|trust|contact))"/g;
  const entries = [];
  let match;

  while ((match = slugRe.exec(slice)) !== null) {
    const slug = match[1];
    const window = slice.slice(match.index, match.index + 400);
    const sortMatch = window.match(/data-home-plan-sort="(\d+)"/);
    entries.push({ slug, sortOrder: sortMatch ? Number(sortMatch[1]) : -1 });
  }

  return entries.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

function extractVisibleSectionOrder(html) {
  const body = getBodyHtml(html);
  const markers = [
    { slug: "home-story", pattern: /FROM VISION TO EXECUTION|من المخطط إلى التنفيذ/ },
    { slug: "home-projects", pattern: /مشاريع فينيسيا/ },
    { slug: "home-trust", pattern: /لماذا يثق/ },
    { slug: "home-contact", pattern: /تبحث عن وحدة/ },
  ];

  return markers
    .map(({ slug, pattern }) => {
      const match = body.match(pattern);
      return match ? { slug, index: match.index ?? -1 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map((hit) => hit.slug);
}

function extractProjectsSection(html) {
  const body = getBodyHtml(html);
  const start = body.indexOf("مشاريع فينيسيا");
  if (start < 0) return "";
  const end = body.indexOf("استعرض كل المشاريع", start);
  return end > start ? body.slice(start, end) : body.slice(start, start + 8000);
}

async function fetchHtml(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text() };
}

let savedAssignment = null;

try {
  const { status, html } = await fetchHtml("/");
  if (status !== 200) fail("Home HTTP", String(status));
  else pass("Home HTTP", "200");

  if (!getBodyHtml(html).includes('data-home-render-plan="parallel"')) {
    pass("No parallel hidden duplicate");
  } else {
    fail("No parallel hidden duplicate", "data-home-render-plan=parallel still present");
  }

  if (getBodyHtml(html).includes('data-home-main-slot="plan"')) {
    pass("Visible plan main slot mounted");
  } else {
    fail("Visible plan main slot mounted", "missing data-home-main-slot=plan");
  }

  const planOrder = extractMainPlanOrder(html).map((entry) => entry.slug);
  pass("Plan slug order", planOrder.join(" → "));

  if (JSON.stringify(planOrder) === JSON.stringify(APPROVED_ORDER)) {
    pass("DOM plan order matches approved sort_order");
  } else {
    fail("DOM plan order matches approved sort_order", planOrder.join(", "));
  }

  const visibleOrder = extractVisibleSectionOrder(html);
  if (JSON.stringify(visibleOrder) === JSON.stringify(APPROVED_ORDER)) {
    pass("Visible section order", visibleOrder.join(" → "));
  } else {
    fail("Visible section order", visibleOrder.join(" → "));
  }

  const sectionChecks = [
    ["Story once", /grid items-center gap-14 lg:grid-cols-\[0\.95fr_1\.05fr\]/, 1],
    ["Projects once", /مشاريع فينيسيا/, 1],
    ["Trust once", /لماذا يثق/, 1],
    ["Contact once", /تبحث عن وحدة/, 1],
  ];

  for (const [name, pattern, expected] of sectionChecks) {
    const count = countMarker(html, pattern);
    if (count === expected) pass(name, String(count));
    else fail(name, `count=${count}`);
  }

  const projectsSection = extractProjectsSection(html);
  const exploreCount = (projectsSection.match(/استكشف المشروع/g) || []).length;
  if (exploreCount >= 1) pass("Projects carousel CTA", `explore=${exploreCount}`);
  else fail("Projects carousel CTA", "missing");

  if (html.includes('href="/projects"') && html.includes("استعرض كل المشاريع")) {
    pass("Projects hub link /projects");
  } else {
    fail("Projects hub link /projects", "missing");
  }

  const detail = await fetchHtml("/projects/i87");
  if (detail.status === 200) pass("Card link /projects/i87", "200");
  else fail("Card link /projects/i87", String(detail.status));

  const { data: homePage } = await supabase.from("pages").select("id").eq("slug", "home").maybeSingle();
  const { data: template } = await supabase
    .from("content_block_templates")
    .select("id")
    .eq("slug", "home-trust")
    .maybeSingle();

  if (homePage && template) {
    const { data: assignment } = await supabase
      .from("page_content_block_assignments")
      .select("id, is_visible")
      .eq("page_id", homePage.id)
      .eq("template_id", template.id)
      .maybeSingle();

    if (assignment) {
      savedAssignment = { id: assignment.id, is_visible: assignment.is_visible };
      await supabase
        .from("page_content_block_assignments")
        .update({ is_visible: false, updated_at: new Date().toISOString() })
        .eq("id", assignment.id);

      const hiddenHtml = (await fetchHtml("/")).html;
      const trustCount = countMarker(hiddenHtml, /لماذا يثق/);
      if (trustCount === 0) pass("Trust hidden when assignment is_visible=false");
      else fail("Trust hidden when assignment is_visible=false", `count=${trustCount}`);

      const trustPlan = extractMainPlanOrder(hiddenHtml).find((entry) => entry.slug === "home-trust");
      if (!trustPlan) pass("Trust omitted from plan when assignment hidden");
      else fail("Trust omitted from plan when assignment hidden", `source=${trustPlan.source}`);

      await supabase
        .from("page_content_block_assignments")
        .update({ is_visible: true, updated_at: new Date().toISOString() })
        .eq("id", assignment.id);
      savedAssignment = null;
    }
  }
} catch (error) {
  fail("Test runner", error.message);
} finally {
  if (savedAssignment) {
    await supabase
      .from("page_content_block_assignments")
      .update({
        is_visible: savedAssignment.is_visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", savedAssignment.id);
  }
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map((f) => f.name) }));
if (failed.length) process.exit(1);
