/**
 * Phase 0 baseline + Phase 1 parallel render plan comparison.
 * Usage: node scripts/home-page-composition-phase0-phase1.mjs [port]
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
const APPROVED_SORT = {
  "home-story": 10,
  "home-projects": 20,
  "home-trust": 30,
  "home-contact": 40,
};

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

const results = { phase0: [], phase1: [] };

function pass(phase, name, detail) {
  results[phase].push({ name, ok: true, detail });
  console.log(`PASS [${phase}] ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(phase, name, detail) {
  results[phase].push({ name, ok: false, detail });
  console.error(`FAIL [${phase}] ${name}: ${detail}`);
}

function getBodyHtml(html) {
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return html;
  return bodyMatch[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "");
}

/** Legacy path only — excludes Phase 1 parallel preview container. */
function getLegacyBodyHtml(html) {
  const body = getBodyHtml(html);
  const split = body.indexOf('data-home-render-plan="parallel"');
  return split >= 0 ? body.slice(0, split) : body;
}

function extractVisibleLegacyOrder(html) {
  const body = getLegacyBodyHtml(html);
  const markers = [
    { slug: "home-story", pattern: /FROM VISION TO EXECUTION|من المخطط إلى التنفيذ/ },
    { slug: "home-projects", pattern: /مشاريع فينيسيا/ },
    { slug: "home-trust", pattern: /لماذا يثق/ },
    { slug: "home-contact", pattern: /تبحث عن وحدة/ },
  ];

  const hits = markers
    .map(({ slug, pattern }) => {
      const match = body.match(pattern);
      return match ? { slug, index: match.index ?? -1 } : null;
    })
    .filter(Boolean);

  hits.sort((a, b) => a.index - b.index);
  return hits.map((hit) => hit.slug);
}

function extractParallelPlan(html) {
  const body = getBodyHtml(html);
  const start = body.indexOf('data-home-render-plan="parallel"');
  if (start < 0) return [];

  const slice = body.slice(start);
  const slugRe = /data-home-plan-slug="(home-(?:story|projects|trust|contact))"/g;
  const entries = [];
  let match;

  while ((match = slugRe.exec(slice)) !== null) {
    const slug = match[1];
    const window = slice.slice(match.index, match.index + 400);
    const sourceMatch = window.match(/data-home-plan-source="(cms|fallback)"/);
    const sortMatch = window.match(/data-home-plan-sort="(\d+)"/);
    entries.push({
      slug,
      source: sourceMatch?.[1] ?? "unknown",
      sortOrder: sortMatch ? Number(sortMatch[1]) : -1,
    });
  }

  return entries.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

function countMarker(html, pattern, legacyOnly = false) {
  const body = legacyOnly ? getLegacyBodyHtml(html) : getBodyHtml(html);
  return (body.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) || [])
    .length;
}

function extractProjectsSection(html, legacyOnly = false) {
  const body = legacyOnly ? getLegacyBodyHtml(html) : getBodyHtml(html);
  const start = body.indexOf("مشاريع فينيسيا");
  if (start < 0) return "";
  const end = body.indexOf("استعرض كل المشاريع", start);
  return end > start ? body.slice(start, end) : body.slice(start, start + 8000);
}

async function fetchHtml(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text() };
}

async function loadHomeMainAssignments() {
  const { data: homePage } = await supabase.from("pages").select("id").eq("slug", "home").maybeSingle();
  if (!homePage) return [];

  const { data: templates } = await supabase
    .from("content_block_templates")
    .select("id, slug")
    .in("slug", APPROVED_ORDER);

  const templateBySlug = new Map((templates ?? []).map((row) => [row.slug, row.id]));

  const rows = [];
  for (const slug of APPROVED_ORDER) {
    const templateId = templateBySlug.get(slug);
    if (!templateId) continue;
    const { data: assignment } = await supabase
      .from("page_content_block_assignments")
      .select("id, sort_order, is_visible, slot")
      .eq("page_id", homePage.id)
      .eq("template_id", templateId)
      .maybeSingle();
    if (assignment) rows.push({ slug, ...assignment });
  }

  return rows.sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug));
}

let savedAssignment = null;

try {
  const assignments = await loadHomeMainAssignments();
  if (assignments.length !== 4) {
    fail("phase0", "DB home main assignments", `expected 4, got ${assignments.length}`);
  } else {
    pass("phase0", "DB home main assignments", "count=4");
  }

  for (const row of assignments) {
    const expected = APPROVED_SORT[row.slug];
    if (row.sort_order === expected && row.slot === "main" && row.is_visible) {
      pass("phase0", `DB sort_order ${row.slug}`, String(expected));
    } else {
      fail(
        "phase0",
        `DB sort_order ${row.slug}`,
        `sort_order=${row.sort_order}, slot=${row.slot}, visible=${row.is_visible}`,
      );
    }
  }

  const dbOrder = assignments.map((row) => row.slug).join(" → ");
  pass("phase0", "DB assignment order", dbOrder);

  const { status, html } = await fetchHtml("/");
  if (status !== 200) fail("phase0", "Home HTTP", String(status));
  else pass("phase0", "Home HTTP", "200");

  const legacyOrder = extractVisibleLegacyOrder(html);
  pass("phase0", "Legacy visible section order", legacyOrder.join(" → "));

  for (const slug of APPROVED_ORDER) {
    const pattern =
      slug === "home-story"
        ? /grid items-center gap-14 lg:grid-cols-\[0\.95fr_1\.05fr\]/
        : slug === "home-projects"
          ? /مشاريع فينيسيا/
          : slug === "home-trust"
            ? /لماذا يثق/
            : /تبحث عن وحدة/;
    const count = countMarker(html, pattern, true);
    if (count === 1) pass("phase0", `Legacy single section ${slug}`, String(count));
    else fail("phase0", `Legacy single section ${slug}`, `count=${count}`);
  }

  const projectsSection = extractProjectsSection(html, true);
  const exploreCount = (projectsSection.match(/استكشف المشروع/g) || []).length;
  const hubLink = html.includes('href="/projects"') && html.includes("استعرض كل المشاريع");
  if (exploreCount >= 1) pass("phase0", "Projects carousel CTA present", `explore=${exploreCount}`);
  else fail("phase0", "Projects carousel CTA present", "missing");
  if (hubLink) pass("phase0", "Projects hub link present");
  else fail("phase0", "Projects hub link present", "missing");

  const parallel = extractParallelPlan(html);
  if (parallel.length === 4) pass("phase1", "Parallel plan entries", "count=4");
  else fail("phase1", "Parallel plan entries", `count=${parallel.length}`);

  const parallelSlugs = parallel.map((entry) => entry.slug);
  const parallelSorts = parallel.map((entry) => entry.sortOrder);
  pass("phase1", "Parallel plan slug order", parallelSlugs.join(" → "));

  if (JSON.stringify(parallelSlugs) === JSON.stringify(APPROVED_ORDER)) {
    pass("phase1", "Parallel plan matches approved order");
  } else {
    fail("phase1", "Parallel plan matches approved order", parallelSlugs.join(", "));
  }

  if (JSON.stringify(parallelSorts) === JSON.stringify(Object.values(APPROVED_SORT))) {
    pass("phase1", "Parallel plan sort_order values", parallelSorts.join(", "));
  } else {
    fail("phase1", "Parallel plan sort_order values", parallelSorts.join(", "));
  }

  if (JSON.stringify(parallelSlugs) === JSON.stringify(assignments.map((row) => row.slug))) {
    pass("phase1", "Parallel plan matches DB assignment order");
  } else {
    fail("phase1", "Parallel plan matches DB assignment order");
  }

  if (JSON.stringify(legacyOrder) === JSON.stringify(parallelSlugs)) {
    pass("phase1", "Legacy visible order matches parallel plan");
  } else {
    fail(
      "phase1",
      "Legacy visible order matches parallel plan",
      `legacy=[${legacyOrder.join(", ")}] parallel=[${parallelSlugs.join(", ")}]`,
    );
  }

  for (const slug of APPROVED_ORDER) {
    const entries = parallel.filter((entry) => entry.slug === slug);
    if (entries.length === 1) {
      pass("phase1", `Parallel single entry ${slug}`, `sort=${entries[0].sortOrder}, source=${entries[0].source}`);
    } else {
      fail("phase1", `Parallel single entry ${slug}`, `count=${entries.length}`);
    }
  }

  const contactAssignment = assignments.find((row) => row.slug === "home-contact");
  if (contactAssignment) {
    savedAssignment = { id: contactAssignment.id, is_visible: contactAssignment.is_visible };
    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: false, updated_at: new Date().toISOString() })
      .eq("id", contactAssignment.id);

    const fallbackHtml = (await fetchHtml("/")).html;
    const legacyContactCount = countMarker(fallbackHtml, /تبحث عن وحدة/, true);
    const parallelAfterHide = extractParallelPlan(fallbackHtml);
    const contactParallel = parallelAfterHide.find((entry) => entry.slug === "home-contact");

    if (legacyContactCount === 1) pass("phase1", "Legacy fallback on hidden assignment", "contact visible once");
    else fail("phase1", "Legacy fallback on hidden assignment", `count=${legacyContactCount}`);

    if (contactParallel && contactParallel.source === "fallback" && contactParallel.sortOrder === 40) {
      pass("phase1", "Parallel fallback on hidden assignment", "home-contact source=fallback");
    } else {
      fail(
        "phase1",
        "Parallel fallback on hidden assignment",
        `source=${contactParallel?.source}, sort=${contactParallel?.sortOrder}`,
      );
    }

    const parallelContainer = getBodyHtml(fallbackHtml).match(
      /data-home-plan-slug="home-contact"[\s\S]*?data-home-plan-source="(cms|fallback)"/,
    );
    if (parallelContainer && parallelContainer[1] === "fallback") {
      pass("phase1", "Parallel plan source fallback for contact");
    } else {
      fail("phase1", "Parallel plan source fallback for contact", parallelContainer?.[1] ?? "missing");
    }

    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq("id", contactAssignment.id);
    savedAssignment = null;
  }

  const detail = await fetchHtml("/projects/i87");
  if (detail.status === 200) pass("phase1", "Project card link /projects/i87", "200");
  else fail("phase1", "Project card link /projects/i87", String(detail.status));
} catch (error) {
  fail("phase1", "Test runner", error.message);
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

function summarize(phase) {
  const items = results[phase];
  const failed = items.filter((item) => !item.ok);
  return { passed: items.length - failed.length, total: items.length, failed: failed.map((f) => f.name) };
}

const phase0 = summarize("phase0");
const phase1 = summarize("phase1");
console.log("\n--- Phase 0 baseline ---");
console.log(JSON.stringify(phase0));
console.log("--- Phase 1 comparison ---");
console.log(JSON.stringify(phase1));

if (phase0.failed.length || phase1.failed.length) process.exit(1);
