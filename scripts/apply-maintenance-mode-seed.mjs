/**
 * Seeds site_settings.maintenance_mode in Supabase (production-safe default: OFF).
 * Usage: node scripts/apply-maintenance-mode-seed.mjs
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { data: existing, error: existingError } = await supabase
  .from("site_settings")
  .select("key")
  .eq("key", "maintenance_mode")
  .maybeSingle();

if (existingError) {
  console.error("Failed to read maintenance_mode:", existingError.message);
  process.exit(1);
}

if (!existing) {
  const { error } = await supabase.from("site_settings").insert({
    key: "maintenance_mode",
    value: { enabled: false },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to seed maintenance_mode:", error.message);
    process.exit(1);
  }
}

const { data, error: readError } = await supabase
  .from("site_settings")
  .select("key,value")
  .eq("key", "maintenance_mode")
  .maybeSingle();

if (readError || !data) {
  console.error("Seed verification failed:", readError?.message ?? "row missing");
  process.exit(1);
}

console.log("OK site_settings.maintenance_mode seeded (enabled:", data.value?.enabled === true, ")");
