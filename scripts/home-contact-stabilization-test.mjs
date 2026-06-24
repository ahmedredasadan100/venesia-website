/**
 * Home Contact stabilization — run after apply-home-contact-seed.mjs
 * Usage: node scripts/home-contact-stabilization-test.mjs [port]
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

const CONTACT_GRID = "lg:grid-cols-[1fr_288px]";
const CONTACT_SECTION = "relative mx-auto max-w-7xl overflow-hidden px-6 pb-14 pt-10";
const ABOUT_CTA_MARKER = "استكشف مشاريعنا";
const HOME_CONTACT_TITLE = "تبحث عن وحدة";

function countInBody(html, needle) {
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return 0;
  const body = bodyMatch[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "");
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (body.match(new RegExp(escaped, "g")) || []).length;
}

async function fetchHtml(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text() };
}

async function getHomeContactAssignment() {
  const { data: homePage } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", "home")
    .maybeSingle();

  if (!homePage) return null;

  const { data: template } = await supabase
    .from("content_block_templates")
    .select("id,slug,status")
    .eq("slug", "home-contact")
    .maybeSingle();

  if (!template) return { template: null, assignment: null };

  const { data: assignment } = await supabase
    .from("page_content_block_assignments")
    .select("id,slot,sort_order,is_visible,page_id,template_id")
    .eq("page_id", homePage.id)
    .eq("template_id", template.id)
    .maybeSingle();

  return { template, assignment, homePageId: homePage.id };
}

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

let savedAssignmentId = null;
let savedVisibility = true;

try {
  const state = await getHomeContactAssignment();
  if (!state?.template) fail("DB template home-contact", "not found");
  else pass("DB template home-contact", `id=${state.template.id}, status=${state.template.status}`);

  if (!state?.assignment) fail("DB assignment on home", "not found");
  else {
    savedAssignmentId = state.assignment.id;
    savedVisibility = state.assignment.is_visible;
    if (state.assignment.slot === "main" && state.assignment.sort_order === 40) {
      pass("DB assignment on home", `id=${state.assignment.id}, slot=main, sort_order=40`);
    } else {
      fail(
        "DB assignment on home",
        `slot=${state.assignment.slot}, sort_order=${state.assignment.sort_order}`,
      );
    }
  }

  {
    const { status, html } = await fetchHtml("/");
    if (status !== 200) fail("Home HTTP", String(status));
    else pass("Home HTTP", "200");

    const sections = countInBody(html, CONTACT_SECTION);
    const grids = countInBody(html, CONTACT_GRID);
    if (sections === 1 && grids === 1) pass("Home single contact section", `sections=${sections}, grids=${grids}`);
    else fail("Home single contact section", `sections=${sections}, grids=${grids}`);

    if (html.includes(HOME_CONTACT_TITLE)) pass("Home contact content visible");
    else fail("Home contact content visible", "title marker missing");

    if (state?.assignment?.is_visible) pass("CMS mode expected", "assignment visible — fallback should be hidden");
  }

  if (savedAssignmentId) {
    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: false, updated_at: new Date().toISOString() })
      .eq("id", savedAssignmentId);

    const { html } = await fetchHtml("/");
    const sectionsHidden = countInBody(html, CONTACT_SECTION);
    if (sectionsHidden === 0) pass("Contact hidden when assignment is_visible=false", `sections=${sectionsHidden}`);
    else fail("Contact hidden when assignment is_visible=false", `sections=${sectionsHidden}`);

    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq("id", savedAssignmentId);

    const { html: restored } = await fetchHtml("/");
    const sectionsRestored = countInBody(restored, CONTACT_SECTION);
    if (sectionsRestored === 1) pass("CMS restored after re-enable", `sections=${sectionsRestored}`);
    else fail("CMS restored after re-enable", `sections=${sectionsRestored}`);
  }

  {
    const { status, html } = await fetchHtml("/about");
    if (status !== 200) fail("About HTTP", String(status));
    else pass("About HTTP", "200");

    if (html.includes(ABOUT_CTA_MARKER)) pass("About CTA marker present");
    else fail("About CTA marker present", `missing "${ABOUT_CTA_MARKER}"`);

    const homeGridOnAbout = countInBody(html, CONTACT_GRID);
    if (homeGridOnAbout === 0) pass("No home-contact leak on /about");
    else fail("No home-contact leak on /about", `home grid count=${homeGridOnAbout}`);
  }
} catch (error) {
  fail("Test runner", error.message);
} finally {
  if (savedAssignmentId && savedVisibility !== false) {
    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq("id", savedAssignmentId);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map((f) => f.name) }));
if (failed.length) process.exit(1);
