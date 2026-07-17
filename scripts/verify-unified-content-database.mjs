/**
 * Read-only live-schema verification for the Unified Content Engine.
 *
 * The RPC probe uses an impossible negative topic ID, so it verifies function
 * availability and published-only behavior without mutating content.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const failures = [];

function record(label, error) {
  if (error) failures.push(`${label}: ${error.message}`);
}

const [
  categoryContract,
  topicContract,
  invalidColors,
  negativeViews,
  preferencesContract,
  readModelContract,
  rpcContract,
] = await Promise.all([
  supabase
    .from("topic_categories")
    .select("id,name,slug,parent_id,sort_order,is_active,color_token")
    .limit(1),
  supabase
    .from("topics")
    .select(
      "id,content_type,category_id,series_id,created_at,created_by,updated_at,updated_by,published_at,published_by,views_count",
    )
    .limit(1),
  supabase
    .from("topic_categories")
    .select("id", { count: "exact", head: true })
    .not(
      "color_token",
      "in",
      "(gold,sky,blue,cyan,emerald,amber,orange,rose,violet,slate)",
    ),
  supabase
    .from("topics")
    .select("id", { count: "exact", head: true })
    .lt("views_count", 0),
  supabase
    .from("admin_user_preferences")
    .select("admin_user_id,view_key,preferences,created_at,updated_at")
    .limit(1),
  supabase
    .from("admin_content_topics")
    .select(
      "id,title,category_id,category_name,category_color_token,series_id,series_name,content_type,status,is_featured,created_by_display,updated_by_display,published_by_display,views_count",
    )
    .limit(1),
  supabase.rpc("increment_topic_view", { p_topic_id: -9223372036854775000n.toString() }),
]);

record("topic_categories contract", categoryContract.error);
record("topics metadata contract", topicContract.error);
record("category color constraint query", invalidColors.error);
record("views non-negative query", negativeViews.error);
record("admin preferences contract", preferencesContract.error);
record("admin content read model", readModelContract.error);
record("atomic view RPC", rpcContract.error);

if (!invalidColors.error && (invalidColors.count ?? 0) !== 0) {
  failures.push(`${invalidColors.count} categories have invalid semantic color tokens`);
}
if (!negativeViews.error && (negativeViews.count ?? 0) !== 0) {
  failures.push(`${negativeViews.count} topics have a negative views_count`);
}
if (!rpcContract.error && rpcContract.data !== null) {
  failures.push("increment_topic_view changed or returned data for an impossible topic ID");
}

if (failures.length) {
  console.error("FAIL: Unified Content Engine live database verification failed.");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("OK: Unified Content Engine live database contracts are present.");
console.log(` - Categories with invalid colors: ${invalidColors.count ?? 0}`);
console.log(` - Topics with negative views: ${negativeViews.count ?? 0}`);
console.log(" - Atomic RPC rejected an impossible topic without mutation.");
