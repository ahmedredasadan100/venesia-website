/**
 * Footer CMS smoke test — site_settings + footer menu on public pages.
 * Usage: node scripts/footer-settings-test.mjs [port]
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

const REQUIRED_KEYS = ["footer.brand", "footer.contact_items", "footer.social_links", "footer.legal"];

try {
  const { data: settings, error: settingsError } = await supabase
    .from("site_settings")
    .select("key")
    .in("key", REQUIRED_KEYS);

  if (settingsError) fail("site_settings readable", settingsError.message);
  else if ((settings ?? []).length >= 4) pass("site_settings keys seeded", `${settings.length}/4`);
  else fail("site_settings keys seeded", `found ${settings?.length ?? 0}/4`);

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

  const adminRes = await fetch(`${baseUrl}/admin/pages-blocks/footer`, { cache: "no-store" });
  if (adminRes.ok) pass("Admin footer settings page loads");
  else fail("Admin footer settings page loads", String(adminRes.status));

  for (const path of ["/", "/about", "/contact"]) {
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
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
  }
} catch (error) {
  fail("footer settings test", error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  console.error(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed }, null, 2));
  process.exit(1);
}

console.log("Footer settings test OK.");
