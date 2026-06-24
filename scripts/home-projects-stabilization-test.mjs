/**
 * Home Projects stabilization — verifies DB-driven HomeProjectsSection.
 * Usage: node scripts/home-projects-stabilization-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const port = process.argv[2] || process.env.PORT || "3000";
const baseUrl = `http://127.0.0.1:${port}`;
const HOME_PROJECTS_SECTION = resolve(ROOT, "src/components/home/HomeProjectsSection.tsx");

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

function getLegacyBodyHtml(html) {
  const body = getBodyHtml(html);
  const split = body.indexOf('data-home-render-plan="parallel"');
  return split >= 0 ? body.slice(0, split) : body;
}

function extractHomeProjectSlugs(html, legacyOnly = false) {
  const body = legacyOnly ? getLegacyBodyHtml(html) : getBodyHtml(html);
  const sectionStart = body.indexOf("مشاريع فينيسيا");
  if (sectionStart < 0) return [];

  const sectionEnd = body.indexOf("استعرض كل المشاريع", sectionStart);
  const section = sectionEnd > sectionStart ? body.slice(sectionStart, sectionEnd) : body.slice(sectionStart);

  const slugs = [];
  const re = /href="\/projects\/([^"/#?]+)"/g;
  let match;
  while ((match = re.exec(section)) !== null) {
    slugs.push(match[1]);
  }
  return slugs;
}

async function fetchHtml(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text() };
}

async function loadHomepageProjectsFromDb() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, code, homepage_order, show_on_homepage")
    .eq("publication_status", "published")
    .eq("show_on_homepage", true)
    .order("homepage_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function restoreProject(id, patch) {
  await supabase
    .from("projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

function countProjectsSectionTitles(html, legacyOnly = false) {
  const body = legacyOnly ? getLegacyBodyHtml(html) : getBodyHtml(html);
  return (body.match(/مشاريع فينيسيا/g) || []).length;
}

async function getHomeProjectsAssignment() {
  const { data: homePage } = await supabase.from("pages").select("id").eq("slug", "home").maybeSingle();
  const { data: template } = await supabase
    .from("content_block_templates")
    .select("id, slug, status")
    .eq("slug", "home-projects")
    .maybeSingle();

  if (!homePage || !template) return { template, assignment: null };

  const { data: assignment } = await supabase
    .from("page_content_block_assignments")
    .select("id, slot, sort_order, is_visible")
    .eq("page_id", homePage.id)
    .eq("template_id", template.id)
    .maybeSingle();

  return { template, assignment };
}

let savedToggle = null;
let savedOrders = null;
let savedAssignmentVisibility = null;

try {
  const sectionSource = readFileSync(HOME_PROJECTS_SECTION, "utf8");
  if (sectionSource.includes("projects-data") || sectionSource.includes("PROJECTS")) {
    fail("HomeProjectsSection has no static imports", "found projects-data or PROJECTS reference");
  } else {
    pass("HomeProjectsSection has no static imports");
  }

  if (
    sectionSource.includes("loadHomepageProjects") ||
    sectionSource.includes("projects-data")
  ) {
    // loadHomepageProjects lives in HomePageContent, not section — that's fine
  }
  if (!sectionSource.includes("HomepageProjectCard")) {
    fail("HomeProjectsSection uses HomepageProjectCard prop", "type import missing");
  } else {
    pass("HomeProjectsSection uses HomepageProjectCard prop");
  }

  const dbProjects = await loadHomepageProjectsFromDb();
  if (dbProjects.length === 0) {
    fail("DB has homepage projects", "none found");
  } else {
    pass("DB has homepage projects", `count=${dbProjects.length}`);
  }

  const { status, html } = await fetchHtml("/");
  if (status !== 200) {
    fail("Home HTTP", String(status));
  } else {
    pass("Home HTTP", "200");
  }

  const expectedSlugs = dbProjects.map((p) => p.slug);
  const renderedSlugs = extractHomeProjectSlugs(html, true);

  if (renderedSlugs.length === 0) {
    fail("Home renders project cards", "no /projects/[slug] links in section");
  } else if (renderedSlugs.length !== expectedSlugs.length) {
    fail(
      "Home card count matches DB",
      `rendered=${renderedSlugs.length}, db=${expectedSlugs.length}`,
    );
  } else {
    pass("Home card count matches DB", String(renderedSlugs.length));
  }

  if (JSON.stringify(renderedSlugs) === JSON.stringify(expectedSlugs)) {
    pass("Home order matches DB", expectedSlugs.slice(0, 5).join(", ") + "…");
  } else {
    fail(
      "Home order matches DB",
      `rendered=[${renderedSlugs.slice(0, 5).join(", ")}…] expected=[${expectedSlugs.slice(0, 5).join(", ")}…]`,
    );
  }

  const toggleTarget = dbProjects[dbProjects.length - 1];
  savedToggle = {
    id: toggleTarget.id,
    show_on_homepage: true,
  };

  await supabase
    .from("projects")
    .update({ show_on_homepage: false, updated_at: new Date().toISOString() })
    .eq("id", toggleTarget.id);

  const hiddenHtml = (await fetchHtml("/")).html;
  const hiddenSlugs = extractHomeProjectSlugs(hiddenHtml, true);
  if (hiddenSlugs.includes(toggleTarget.slug)) {
    fail("hide show_on_homepage removes card", `slug ${toggleTarget.slug} still visible`);
  } else {
    pass("hide show_on_homepage removes card", toggleTarget.code);
  }

  await supabase
    .from("projects")
    .update({ show_on_homepage: true, updated_at: new Date().toISOString() })
    .eq("id", toggleTarget.id);

  const restoredHtml = (await fetchHtml("/")).html;
  const restoredSlugs = extractHomeProjectSlugs(restoredHtml, true);
  if (!restoredSlugs.includes(toggleTarget.slug)) {
    fail("restore show_on_homepage shows card", `slug ${toggleTarget.slug} missing`);
  } else {
    pass("restore show_on_homepage shows card", toggleTarget.code);
  }

  if (dbProjects.length >= 2) {
    const first = dbProjects[0];
    const second = dbProjects[1];
    savedOrders = [
      { id: first.id, homepage_order: first.homepage_order },
      { id: second.id, homepage_order: second.homepage_order },
    ];

    await supabase
      .from("projects")
      .update({ homepage_order: second.homepage_order, updated_at: new Date().toISOString() })
      .eq("id", first.id);
    await supabase
      .from("projects")
      .update({ homepage_order: first.homepage_order, updated_at: new Date().toISOString() })
      .eq("id", second.id);

    const reorderedDb = await loadHomepageProjectsFromDb();
    const reorderedHtml = (await fetchHtml("/")).html;
    const reorderedSlugs = extractHomeProjectSlugs(reorderedHtml, true);

    if (
      reorderedDb[0]?.slug === second.slug &&
      reorderedDb[1]?.slug === first.slug &&
      reorderedSlugs[0] === second.slug &&
      reorderedSlugs[1] === first.slug
    ) {
      pass("homepage_order swap changes card order", `${second.code} before ${first.code}`);
    } else {
      fail(
        "homepage_order swap changes card order",
        `db=[${reorderedDb.slice(0, 2).map((p) => p.slug).join(", ")}] rendered=[${reorderedSlugs.slice(0, 2).join(", ")}]`,
      );
    }

    for (const row of savedOrders) {
      await restoreProject(row.id, { homepage_order: row.homepage_order });
    }
    savedOrders = null;
  } else {
    pass("homepage_order swap changes card order", "skipped — need >= 2 projects");
  }

  const linkTarget = dbProjects[0];
  const detail = await fetchHtml(`/projects/${linkTarget.slug}`);
  if (detail.status === 200) {
    pass("Project detail link works", `/projects/${linkTarget.slug}`);
  } else {
    fail("Project detail link works", `HTTP ${detail.status} for /projects/${linkTarget.slug}`);
  }

  const { template, assignment } = await getHomeProjectsAssignment();
  if (!template) {
    fail("home-projects template in DB", "not found");
  } else {
    pass("home-projects template in DB", `status=${template.status}`);
  }

  if (!assignment) {
    fail("home-projects assignment on home", "not found");
  } else if (assignment.slot === "main" && assignment.sort_order === 20) {
    pass("home-projects assignment on home", `id=${assignment.id}, sort_order=20`);
  } else {
    fail(
      "home-projects assignment on home",
      `slot=${assignment.slot}, sort_order=${assignment.sort_order}`,
    );
  }

  const cmsHtml = (await fetchHtml("/")).html;
  const cmsSectionCount = countProjectsSectionTitles(cmsHtml, true);
  if (cmsSectionCount === 1) {
    pass("Home shows projects section once (CMS mode)", String(cmsSectionCount));
  } else {
    fail("Home shows projects section once (CMS mode)", `count=${cmsSectionCount}`);
  }

  if (assignment) {
    savedAssignmentVisibility = { id: assignment.id, is_visible: assignment.is_visible };

    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: false, updated_at: new Date().toISOString() })
      .eq("id", assignment.id);

    const hiddenHtml = (await fetchHtml("/")).html;
    const hiddenCount = countProjectsSectionTitles(hiddenHtml, true);
    if (hiddenCount === 0) pass("Projects hidden when assignment is_visible=false");
    else fail("Projects hidden when assignment is_visible=false", `sections=${hiddenCount}`);

    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq("id", assignment.id);

    const restoredPlacementHtml = (await fetchHtml("/")).html;
    if (countProjectsSectionTitles(restoredPlacementHtml, true) === 1) {
      pass("CMS restored after re-enable assignment");
    } else {
      fail("CMS restored after re-enable assignment", "duplicate or missing section");
    }
  }

  const siblingHtml = (await fetchHtml("/")).html;
  const siblingBody = getBodyHtml(siblingHtml);
  const siblingChecks = [
    ["Home Story marker", /FROM VISION TO EXECUTION|من المخطط إلى التنفيذ/.test(siblingBody)],
    ["Home Trust marker", /لماذا يثق/.test(siblingBody)],
    ["Home Contact marker", /تبحث عن وحدة/.test(siblingBody)],
  ];
  for (const [name, ok] of siblingChecks) {
    if (ok) pass(`${name} present`);
    else fail(`${name} present`, "missing");
  }
} catch (error) {
  fail("Test runner", error.message);
} finally {
  if (savedToggle) {
    await restoreProject(savedToggle.id, { show_on_homepage: savedToggle.show_on_homepage });
  }
  if (savedOrders) {
    for (const row of savedOrders) {
      await restoreProject(row.id, { homepage_order: row.homepage_order });
    }
  }
  if (savedAssignmentVisibility) {
    await supabase
      .from("page_content_block_assignments")
      .update({
        is_visible: savedAssignmentVisibility.is_visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", savedAssignmentVisibility.id);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map((f) => f.name) }));
if (failed.length) process.exit(1);
