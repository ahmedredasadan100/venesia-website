/**
 * Applies product-approved home main slot sort_order via Supabase JS.
 * home-story=10, home-projects=20, home-trust=30, home-contact=40
 *
 * Usage: node scripts/apply-home-main-sort-order.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");

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

const TARGET_ORDER = [
  { slug: "home-story", sortOrder: 10 },
  { slug: "home-projects", sortOrder: 20 },
  { slug: "home-trust", sortOrder: 30 },
  { slug: "home-contact", sortOrder: 40 },
];

async function main() {
  const { data: homePage, error: pageError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", "home")
    .maybeSingle();

  if (pageError) {
    console.error(pageError.message);
    process.exit(1);
  }
  if (!homePage) {
    console.error("pages.slug='home' not found");
    process.exit(1);
  }

  const results = [];

  for (const target of TARGET_ORDER) {
    const { data: template, error: templateError } = await supabase
      .from("content_block_templates")
      .select("id")
      .eq("slug", target.slug)
      .maybeSingle();

    if (templateError || !template) {
      console.error(`Template ${target.slug} not found`);
      process.exit(1);
    }

    const { data: assignment, error: assignError } = await supabase
      .from("page_content_block_assignments")
      .update({
        sort_order: target.sortOrder,
        slot: "main",
        is_visible: true,
        updated_at: new Date().toISOString(),
      })
      .eq("page_id", homePage.id)
      .eq("template_id", template.id)
      .select("id, sort_order")
      .maybeSingle();

    if (assignError) {
      console.error(`${target.slug}: ${assignError.message}`);
      process.exit(1);
    }

    results.push({
      slug: target.slug,
      assignmentId: assignment?.id ?? null,
      sortOrder: assignment?.sort_order ?? target.sortOrder,
    });
    console.log(`Updated ${target.slug} → sort_order=${target.sortOrder} (assignment=${assignment?.id ?? "missing"})`);
  }

  console.log(JSON.stringify({ ok: true, assignments: results }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
