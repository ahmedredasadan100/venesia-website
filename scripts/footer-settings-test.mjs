/**
 * Footer CMS smoke test — site_settings, footer.slots, footer menu, public pages.
 * Usage: node scripts/footer-settings-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_FOOTER_SLOT_TYPES } from "./lib/footer-default-slots.mjs";

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

async function fetchWithTimeout(url, timeoutMs = 30_000) {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
}

const REQUIRED_KEYS = ["footer.brand", "footer.contact_items", "footer.social_links", "footer.legal"];
const SLOTS_KEY = "footer.slots";

try {
  const { data: settings, error: settingsError } = await supabase
    .from("site_settings")
    .select("key")
    .in("key", [...REQUIRED_KEYS, SLOTS_KEY]);

  if (settingsError) fail("site_settings readable", settingsError.message);
  else if ((settings ?? []).filter((row) => REQUIRED_KEYS.includes(row.key)).length >= 4) {
    pass("site_settings keys seeded", `${(settings ?? []).filter((row) => REQUIRED_KEYS.includes(row.key)).length}/4 legacy`);
  } else {
    fail("site_settings keys seeded", `found legacy keys < 4`);
  }

  const hasSlotsKey = (settings ?? []).some((row) => row.key === SLOTS_KEY);
  if (hasSlotsKey) pass("footer.slots key present");
  else fail("footer.slots key present", "missing — run apply-footer-settings-seed.mjs");

  const { data: slotsRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", SLOTS_KEY)
    .maybeSingle();

  const slots = Array.isArray(slotsRow?.value?.slots) ? slotsRow.value.slots : [];
  if (slots.length === 4) pass("footer.slots has 4 columns", String(slots.length));
  else fail("footer.slots has 4 columns", String(slots.length));

  if (slotsRow?.value?.version === 1) pass("footer.slots version", "1");
  else fail("footer.slots version", String(slotsRow?.value?.version ?? "missing"));

  const orderedTypes = [...slots].sort((a, b) => a.index - b.index).map((slot) => slot.type);
  const matchesDefault =
    orderedTypes.length === DEFAULT_FOOTER_SLOT_TYPES.length &&
    orderedTypes.every((type, index) => type === DEFAULT_FOOTER_SLOT_TYPES[index]);

  if (matchesDefault) pass("footer.slots default layout", orderedTypes.join(" | "));
  else pass("footer.slots custom layout", orderedTypes.join(" | "));

  const { data: socialRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "footer.social_links")
    .maybeSingle();

  const socialLinks = Array.isArray(socialRow?.value) ? socialRow.value : [];
  const whatsapp = socialLinks.find((item) => item?.platform === "whatsapp");
  if (whatsapp?.href?.includes("201033766876")) pass("WhatsApp uses correct number");
  else fail("WhatsApp uses correct number", whatsapp?.href ?? "missing");

  if (String(whatsapp?.href ?? "").includes("201000000000")) {
    fail("WhatsApp placeholder removed", "still has 201000000000");
  } else {
    pass("WhatsApp placeholder removed");
  }

  const { data: footerMenu } = await supabase
    .from("menus")
    .select("id")
    .eq("location", "footer")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (footerMenu?.id) {
    pass("footer menu exists", `id=${footerMenu.id}`);
    const { count } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("menu_id", footerMenu.id)
      .eq("is_visible", true);
    if ((count ?? 0) > 0) pass("footer menu has items", String(count));
    else fail("footer menu has items", "empty");
  } else {
    fail("footer menu exists", "missing — run apply-footer-settings-seed.mjs");
  }
} catch (error) {
  fail("footer settings database checks", error instanceof Error ? error.message : String(error));
}

try {
  const adminRes = await fetchWithTimeout(`${baseUrl}/admin/pages-blocks/footer`, 15_000);
  if (adminRes.ok) {
    const adminHtml = await adminRes.text();
    pass("Admin footer settings page loads");
    if (adminHtml.includes("منشئ الفوتر") || adminHtml.includes("Footer Builder")) {
      pass("Admin footer builder UI visible");
    } else {
      fail("Admin footer builder UI visible", "missing builder title");
    }

    if (adminHtml.includes("Menus Admin") || adminHtml.includes("إدارة القوائم")) {
      pass("Admin footer builder references Menus Admin");
    } else {
      fail("Admin footer builder references Menus Admin", "missing menu admin hint");
    }

    if (adminHtml.includes("FooterSettingsClient")) {
      fail("Legacy FooterSettingsClient removed", "still referenced in HTML");
    } else {
      pass("Legacy FooterSettingsClient removed");
    }
  } else {
    fail("Admin footer settings page loads", `${adminRes.status} (is dev server running?)`);
  }
} catch (error) {
  fail("Admin footer settings page loads", error instanceof Error ? error.message : String(error));
}

for (const path of ["/", "/about", "/contact"]) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}${path}`, 15_000);
      if (!response.ok) {
        fail(`Public footer on ${path}`, String(response.status));
        continue;
      }

      const html = getBodyHtml(await response.text());
      if (html.includes("01033766876") || html.includes("15875")) pass(`Public contact visible on ${path}`);
      else fail(`Public contact visible on ${path}`, "phone missing");

      if (html.includes("wa.me/201033766876")) pass(`WhatsApp link on ${path}`);
      else fail(`WhatsApp link on ${path}`, "link missing");

      if (html.includes("Building trust before concrete")) pass(`Brand tagline on ${path}`);
      else fail(`Brand tagline on ${path}`, "missing");

      if (html.includes("المركز الإعلامي") || html.includes("media-center")) {
        pass(`Footer media column markers on ${path}`);
      } else {
        fail(`Footer media column markers on ${path}`, "missing heading or media links");
      }
    } catch (fetchError) {
      fail(`Public footer on ${path}`, fetchError instanceof Error ? fetchError.message : String(fetchError));
    }
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  console.error(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed }, null, 2));
  process.exit(1);
}

console.log("Footer settings test OK.");
