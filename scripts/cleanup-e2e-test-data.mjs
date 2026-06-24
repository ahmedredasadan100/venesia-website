/**
 * Archive/remove E2E test CMS rows before launch.
 * Targets slugs starting with "e2e-test" in topics, topic_categories, topic_series.
 *
 * Usage:
 *   node scripts/cleanup-e2e-test-data.mjs           # apply
 *   node scripts/cleanup-e2e-test-data.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const report = {
  dryRun,
  topics: { archived: [] },
  categories: { deactivated: [] },
  series: { archived: [] },
  errors: [],
};

const now = new Date().toISOString();
const E2E_PREFIX = "e2e-test";

function isE2eSlug(slug) {
  return String(slug ?? "")
    .trim()
    .toLowerCase()
    .startsWith(E2E_PREFIX);
}

async function archiveTopics() {
  const { data, error } = await supabase
    .from("topics")
    .select("id, slug, status, deleted_at")
    .ilike("slug", `${E2E_PREFIX}%`);

  if (error) throw new Error(`topics lookup: ${error.message}`);

  for (const topic of data ?? []) {
    if (topic.status === "archived" && topic.deleted_at) {
      console.log("SKIP topic %s (already archived)", topic.slug);
      continue;
    }

    if (dryRun) {
      console.log("DRY-RUN archive topic %s (id=%s, was %s)", topic.slug, topic.id, topic.status);
      report.topics.archived.push({ id: topic.id, slug: topic.slug, previousStatus: topic.status });
      continue;
    }

    const { error: updateError } = await supabase
      .from("topics")
      .update({
        status: "archived",
        deleted_at: topic.deleted_at ?? now,
        updated_at: now,
      })
      .eq("id", topic.id);

    if (updateError) {
      report.errors.push(`topic ${topic.slug}: ${updateError.message}`);
      continue;
    }

    report.topics.archived.push({ id: topic.id, slug: topic.slug, previousStatus: topic.status });
    console.log("OK archived topic %s (id=%s)", topic.slug, topic.id);
  }
}

async function deactivateCategories() {
  const { data, error } = await supabase.from("topic_categories").select("id, slug, name, is_active, status");

  if (error) throw new Error(`categories lookup: ${error.message}`);

  for (const row of data ?? []) {
    if (!isE2eSlug(row.slug)) continue;

    if (!row.is_active && row.status === "draft") {
      console.log("SKIP category %s (already inactive)", row.slug);
      continue;
    }

    if (dryRun) {
      console.log("DRY-RUN deactivate category %s (id=%s)", row.slug, row.id);
      report.categories.deactivated.push({ id: row.id, slug: row.slug, name: row.name });
      continue;
    }

    const { error: updateError } = await supabase
      .from("topic_categories")
      .update({ is_active: false, status: "draft", updated_at: now })
      .eq("id", row.id);

    if (updateError) {
      report.errors.push(`category ${row.slug}: ${updateError.message}`);
      continue;
    }

    report.categories.deactivated.push({ id: row.id, slug: row.slug, name: row.name });
    console.log("OK deactivated category %s (id=%s)", row.slug, row.id);
  }
}

async function archiveSeries() {
  const { data, error } = await supabase.from("topic_series").select("id, slug, name, status");

  if (error) throw new Error(`series lookup: ${error.message}`);

  for (const row of data ?? []) {
    if (!isE2eSlug(row.slug)) continue;

    if (row.status === "archived") {
      console.log("SKIP series %s (already archived)", row.slug);
      continue;
    }

    if (dryRun) {
      console.log("DRY-RUN archive series %s (id=%s)", row.slug, row.id);
      report.series.archived.push({ id: row.id, slug: row.slug, previousStatus: row.status });
      continue;
    }

    const { error: updateError } = await supabase
      .from("topic_series")
      .update({ status: "archived", updated_at: now })
      .eq("id", row.id);

    if (updateError) {
      report.errors.push(`series ${row.slug}: ${updateError.message}`);
      continue;
    }

    report.series.archived.push({ id: row.id, slug: row.slug, previousStatus: row.status });
    console.log("OK archived series %s (id=%s)", row.slug, row.id);
  }
}

async function verify() {
  const { data: publishedE2e } = await supabase
    .from("topics")
    .select("slug")
    .ilike("slug", `${E2E_PREFIX}%`)
    .eq("status", "published")
    .is("deleted_at", null);

  if (publishedE2e?.length) {
    throw new Error(`Still published e2e topics: ${publishedE2e.map((t) => t.slug).join(", ")}`);
  }

  const { data: activeE2eCategories } = await supabase
    .from("topic_categories")
    .select("slug")
    .ilike("slug", `${E2E_PREFIX}%`)
    .eq("is_active", true);

  if (activeE2eCategories?.length) {
    throw new Error(`Still active e2e categories: ${activeE2eCategories.map((c) => c.slug).join(", ")}`);
  }

  const { data: publishedE2eSeries } = await supabase
    .from("topic_series")
    .select("slug")
    .ilike("slug", `${E2E_PREFIX}%`)
    .eq("status", "published");

  if (publishedE2eSeries?.length) {
    throw new Error(`Still published e2e series: ${publishedE2eSeries.map((s) => s.slug).join(", ")}`);
  }

  console.log("VERIFY OK — no active/published e2e-test rows");
}

await archiveTopics();
await deactivateCategories();
await archiveSeries();

if (!dryRun) {
  await verify();
}

console.log("\n=== CLEANUP REPORT ===");
console.log(JSON.stringify(report, null, 2));

if (report.errors.length) process.exit(1);
