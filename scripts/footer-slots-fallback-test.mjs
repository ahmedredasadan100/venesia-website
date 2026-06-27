/**
 * Fallback smoke test for footer.slots (missing + invalid → legacy build).
 * Restores the previous DB value when finished.
 *
 * Usage: node scripts/footer-slots-fallback-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FOOTER_SLOTS_SETTING_KEY } from "./lib/footer-default-slots.mjs";

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

async function fetchFooterMarkers(path) {
  const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(120_000) });
  const html = await res.text();
  const ok =
    res.status === 200 &&
    html.includes("تواصل معنا") &&
    html.includes("Venesia") &&
    html.includes("Building trust before concrete");
  return { status: res.status, ok };
}

const { data: row } = await supabase
  .from("site_settings")
  .select("value")
  .eq("key", FOOTER_SLOTS_SETTING_KEY)
  .maybeSingle();
const backup = row?.value ?? null;

try {
  await supabase.from("site_settings").delete().eq("key", FOOTER_SLOTS_SETTING_KEY);
  const missing = await fetchFooterMarkers("/");
  if (missing.ok) pass("missing footer.slots (legacy fallback)");
  else fail("missing footer.slots (legacy fallback)", `status=${missing.status}`);

  await supabase.from("site_settings").upsert({
    key: FOOTER_SLOTS_SETTING_KEY,
    value: { version: 1, slots: "not-an-array" },
  });
  const invalid = await fetchFooterMarkers("/");
  if (invalid.ok) pass("invalid footer.slots (legacy fallback)");
  else fail("invalid footer.slots (legacy fallback)", `status=${invalid.status}`);

  if (backup) {
    await supabase.from("site_settings").upsert({ key: FOOTER_SLOTS_SETTING_KEY, value: backup });
  } else {
    await supabase.from("site_settings").delete().eq("key", FOOTER_SLOTS_SETTING_KEY);
  }

  const restored = await fetchFooterMarkers("/");
  if (restored.ok) pass("restored footer.slots");
  else fail("restored footer.slots", `status=${restored.status}`);
} catch (error) {
  if (backup) {
    await supabase.from("site_settings").upsert({ key: FOOTER_SLOTS_SETTING_KEY, value: backup });
  }
  fail("footer slots fallback test", error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  process.exit(1);
}

console.log("Footer slots fallback test OK.");
