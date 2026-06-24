/**
 * Track Your Project CMS smoke test.
 * Usage: node scripts/track-your-project-cms-test.mjs [port]
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
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

try {
  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,slug,path,status")
    .eq("slug", "track-your-project")
    .maybeSingle();

  if (pageError || !page) fail("page exists in DB", pageError?.message ?? "missing");
  else pass("page exists in DB", `id=${page.id}`);

  if (page?.id) {
    const { data: heroAssignment } = await supabase
      .from("hero_assignments")
      .select("id,hero_id,is_active")
      .eq("target_type", "page")
      .eq("target_id", page.id)
      .eq("is_active", true)
      .maybeSingle();

    if (heroAssignment?.id) pass("hero assignment exists", `id=${heroAssignment.id}`);
    else fail("hero assignment exists", "missing");

    const assignmentTables = [
      ["page_breadcrumb_block_assignments", "breadcrumb"],
      ["page_content_block_assignments", "content"],
      ["page_cta_block_assignments", "cta"],
    ];

    for (const [table, label] of assignmentTables) {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("page_id", page.id)
        .eq("is_visible", true);

      if (error) fail(`${label} assignment visible`, error.message);
      else if ((count ?? 0) > 0) pass(`${label} assignment visible`, String(count));
      else fail(`${label} assignment visible`, "none");
    }
  }

  const adminPagesRes = await fetch(`${baseUrl}/admin/pages-blocks/pages`, { cache: "no-store" });
  if (adminPagesRes.ok) pass("Admin pages list loads");
  else fail("Admin pages list loads", String(adminPagesRes.status));

  const response = await fetch(`${baseUrl}/track-your-project`, { cache: "no-store" });
  if (!response.ok) {
    fail("public route loads", String(response.status));
  } else {
    pass("public route loads");
    const html = getBodyHtml(await response.text());

    if (html.includes("المحتوى قيد الإعداد")) {
      fail("no under-construction placeholder", "still shows المحتوى قيد الإعداد");
    } else {
      pass("no under-construction placeholder");
    }

    if (html.includes("Project Tracking") || html.includes("تابع مشروعك")) {
      pass("hero content visible");
    } else {
      fail("hero content visible", "title/eyebrow missing");
    }

    if (html.includes("يمكنك تعديل هذا النص من لوحة التحكم")) {
      fail("no admin placeholder in intro", "still shows placeholder text");
    } else {
      pass("no admin placeholder in intro");
    }

    if (html.includes("مراحل التنفيذ والتحديثات الميدانية")) {
      pass("CMS intro content visible");
    } else {
      fail("CMS intro content visible", "final intro body missing");
    }
  }
} catch (error) {
  fail("track cms test", error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  console.error(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed }, null, 2));
  process.exit(1);
}

console.log("Track Your Project CMS test OK.");
