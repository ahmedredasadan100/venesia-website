/**
 * Idempotent migration: creates site_settings.footer.slots from legacy footer.brand
 * when the key does not already exist.
 *
 * Usage: node scripts/apply-footer-slots-migration.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildFooterSlotsFromBrand,
  DEFAULT_FOOTER_BRAND,
  FOOTER_SLOTS_SETTING_KEY,
} from "./lib/footer-default-slots.mjs";

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
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

async function loadExistingSlots() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key,value,updated_at")
    .eq("key", FOOTER_SLOTS_SETTING_KEY)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function loadLegacyBrand() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "footer.brand")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.value ?? DEFAULT_FOOTER_BRAND;
}

async function insertSlots(value) {
  const { error } = await supabase.from("site_settings").insert({
    key: FOOTER_SLOTS_SETTING_KEY,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

const report = {
  action: "none",
  key: FOOTER_SLOTS_SETTING_KEY,
  slotsCount: 0,
};

try {
  const existing = await loadExistingSlots();
  if (existing?.value) {
    report.action = "skipped_existing";
    report.slotsCount = Array.isArray(existing.value?.slots) ? existing.value.slots.length : 0;
    console.log(JSON.stringify({ ok: true, report }, null, 2));
    process.exit(0);
  }

  const legacyBrand = await loadLegacyBrand();
  const slots = buildFooterSlotsFromBrand(legacyBrand);
  await insertSlots(slots);

  report.action = "inserted";
  report.slotsCount = slots.slots.length;
  console.log(JSON.stringify({ ok: true, report }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    report,
  }, null, 2));
  process.exit(1);
}
