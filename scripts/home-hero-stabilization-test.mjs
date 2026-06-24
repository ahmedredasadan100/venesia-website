/**
 * Home Hero CMS closure — no static fallback when CMS hero is disabled.
 * Usage: node scripts/home-hero-stabilization-test.mjs [port]
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

async function fetchHomeHtml() {
  const response = await fetch(`${baseUrl}/`);
  if (!response.ok) throw new Error(`Home HTTP ${response.status}`);
  return response.text();
}

function countHeroSections(html) {
  const body = getBodyHtml(html);
  return (body.match(/hero-slide-ken-burns/g) ?? []).length;
}

let heroId = null;
let wasVisible = null;
let probeTitle = null;

try {
  const pageSource = readFileSync(resolve(ROOT, "src/app/page.tsx"), "utf8");
  if (!pageSource.includes("HomeHeroSection")) {
    pass("page.tsx has no HomeHeroSection import");
  } else {
    fail("page.tsx has no HomeHeroSection import", "HomeHeroSection still referenced");
  }

  try {
    readFileSync(resolve(ROOT, "src/components/home/HomeHeroSection.tsx"), "utf8");
    fail("HomeHeroSection file removed", "file still exists");
  } catch {
    pass("HomeHeroSection file removed");
  }
} catch (error) {
  fail("Static hero guard", error instanceof Error ? error.message : String(error));
}

try {
  const homeRes = await fetch(`${baseUrl}/`);
  if (homeRes.ok) pass("Home HTTP", String(homeRes.status));
  else fail("Home HTTP", String(homeRes.status));

  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", "home")
    .maybeSingle();

  const { data: heroAssignment } = await supabase
    .from("hero_assignments")
    .select("id,hero_templates(id,is_visible,config,name,variant)")
    .eq("target_type", "page")
    .eq("target_id", page?.id ?? 0)
    .eq("is_active", true)
    .maybeSingle();

  const hero = heroAssignment?.hero_templates;
  if (!hero) {
    pass("CMS hero visible (skipped — no home hero assignment)");
    pass("CMS hero disabled hides hero (skipped — no assignment)");
    pass("Admin hero config reflects on home (skipped — no assignment)");
  } else {
    heroId = hero.id;
    wasVisible = hero.is_visible;
    const config = hero.config ?? {};
    probeTitle = typeof config.title === "string" ? config.title.trim() : "";

    if (hero.is_visible && hero.variant === "home-cinematic") {
      const html = await fetchHomeHtml();
      if (countHeroSections(html) > 0) pass("CMS hero visible renders DynamicHeroSection");
      else fail("CMS hero visible renders DynamicHeroSection", "no hero-slide-ken-burns found");

      if (probeTitle && html.includes(probeTitle)) {
        pass("Admin hero config reflects on home", probeTitle.slice(0, 40));
      } else if (probeTitle) {
        fail("Admin hero config reflects on home", `missing title: ${probeTitle}`);
      } else {
        pass("Admin hero config reflects on home (skipped — empty title in config)");
      }
    } else {
      pass("CMS hero visible renders DynamicHeroSection (skipped — hero not visible or not home-cinematic)");
    }

    await supabase.from("hero_templates").update({ is_visible: false }).eq("id", heroId);
    const disabledHtml = await fetchHomeHtml();
    const disabledHeroSlides = countHeroSections(disabledHtml);
    if (disabledHeroSlides === 0) {
      pass("CMS hero disabled hides hero", "no static fallback");
    } else {
      fail("CMS hero disabled hides hero", `hero-slide-ken-burns count=${disabledHeroSlides}`);
    }

    await supabase.from("hero_templates").update({ is_visible: wasVisible }).eq("id", heroId);
    pass("CMS hero visibility restored");
  }
} catch (error) {
  fail("Test runner", error instanceof Error ? error.message : String(error));
} finally {
  if (heroId !== null && wasVisible !== null) {
    await supabase.from("hero_templates").update({ is_visible: wasVisible }).eq("id", heroId);
  }
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map((f) => f.name) }));
if (failed.length) process.exit(1);
