/**
 * Projects single source of truth — Supabase runtime, no public projects-data imports.
 * Usage: node scripts/projects-single-source-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
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

function walkPublicRuntimeFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "admin") continue;
      walkPublicRuntimeFiles(fullPath, acc);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry)) acc.push(fullPath);
  }
  return acc;
}

function getBodyHtml(html) {
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return html;
  return bodyMatch[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "");
}

let probeProjectId = null;
let originalShortDescription = null;
let originalPublicationStatus = null;
let originalBrochureUrl = null;

try {
  const publicFiles = walkPublicRuntimeFiles(SRC).filter((file) => !file.includes(`${join("src", "config")}${join("", "")}projects-data.ts`));
  const offenders = publicFiles.filter((file) => {
    if (file.includes("projects-data.ts")) return false;
    if (file.includes("seed-from-static-data.ts")) return false;
    const source = readFileSync(file, "utf8");
    return /config\/projects-data|from ['"].*projects-data['"]/.test(source);
  });

  if (offenders.length === 0) pass("No public runtime imports from projects-data.ts");
  else fail("No public runtime imports from projects-data.ts", offenders.map((f) => f.replace(SRC + "\\", "")).join(", "));

  const { data: project, error } = await supabase
    .from("projects")
    .select("id,slug,code,short_description,publication_status,brochure_url,show_on_homepage")
    .eq("publication_status", "published")
    .eq("show_on_homepage", true)
    .order("homepage_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !project) {
    fail("Published homepage project exists", error?.message ?? "none found");
  } else {
    probeProjectId = project.id;
    originalShortDescription = project.short_description;
    originalPublicationStatus = project.publication_status;
    originalBrochureUrl = project.brochure_url;

    const marker = `__PST_${Date.now()}__`;
    await supabase.from("projects").update({ short_description: marker }).eq("id", probeProjectId);

    const [homeRes, hubRes, detailRes] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/projects`),
      fetch(`${baseUrl}/projects/${project.slug}`),
    ]);

    const homeHtml = homeRes.ok ? await homeRes.text() : "";
    const hubHtml = hubRes.ok ? await hubRes.text() : "";
    const detailHtml = detailRes.ok ? await detailRes.text() : "";

    if (homeRes.ok && homeHtml.includes(marker)) pass("DB short_description reflects on Home carousel", project.slug);
    else fail("DB short_description reflects on Home carousel", `status=${homeRes.status}`);

    if (hubRes.ok && hubHtml.includes(marker)) pass("DB short_description reflects on /projects", project.slug);
    else fail("DB short_description reflects on /projects", `status=${hubRes.status}`);

    if (detailRes.ok && detailHtml.includes(marker)) pass("DB short_description reflects on /projects/[slug]", project.slug);
    else fail("DB short_description reflects on /projects/[slug]", `status=${detailRes.status}`);

    await supabase.from("projects").update({ short_description: originalShortDescription }).eq("id", probeProjectId);

    await supabase.from("projects").update({ publication_status: "unpublished" }).eq("id", probeProjectId);
    const hiddenRes = await fetch(`${baseUrl}/projects/${project.slug}`);
    if (hiddenRes.status === 404) pass("unpublished project hidden from /projects/[slug]");
    else fail("unpublished project hidden from /projects/[slug]", `status=${hiddenRes.status}`);

    await supabase.from("projects").update({ publication_status: originalPublicationStatus }).eq("id", probeProjectId);

    const brochureUrl = "https://example.com/venesia-probe-brochure.pdf";
    await supabase.from("projects").update({ brochure_url: brochureUrl }).eq("id", probeProjectId);
    const brochureRes = await fetch(`${baseUrl}/projects/${project.slug}`);
    const brochureHtml = brochureRes.ok ? await brochureRes.text() : "";
    if (brochureHtml.includes(brochureUrl)) pass("brochure_url from DB renders on detail page");
    else fail("brochure_url from DB renders on detail page", `status=${brochureRes.status}`);

    await supabase.from("projects").update({ brochure_url: originalBrochureUrl }).eq("id", probeProjectId);

    const homeLinkRes = await fetch(`${baseUrl}/`);
    const homeBody = getBodyHtml(await homeLinkRes.text());
    if (homeBody.includes(`/projects/${project.slug}`)) {
      const detailFromHome = await fetch(`${baseUrl}/projects/${project.slug}`);
      if (detailFromHome.ok && (await detailFromHome.text()).includes(project.code)) {
        pass("Home carousel slug opens Supabase-backed detail page", project.slug);
      } else {
        fail("Home carousel slug opens Supabase-backed detail page", `detail status=${detailFromHome.status}`);
      }
    } else {
      fail("Home carousel slug opens Supabase-backed detail page", "slug link missing on home");
    }
  }
} catch (error) {
  fail("Test runner", error instanceof Error ? error.message : String(error));
} finally {
  if (probeProjectId !== null) {
    await supabase
      .from("projects")
      .update({
        short_description: originalShortDescription,
        publication_status: originalPublicationStatus,
        brochure_url: originalBrochureUrl,
      })
      .eq("id", probeProjectId);
  }
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map((f) => f.name) }));
if (failed.length) process.exit(1);
