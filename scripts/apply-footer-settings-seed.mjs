/**
 * Applies site_settings footer keys + footer menu quick links.
 * Usage: node scripts/apply-footer-settings-seed.mjs
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

const FOOTER_SETTINGS = {
  "footer.brand": {
    title: "Venesia Developments",
    tagline: "Building trust before concrete.",
  },
  "footer.contact_items": [
    {
      icon: "⌖",
      label: "العنوان",
      value: "Street 12, New Cairo 1, Cairo Governorate",
      href: "https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate",
    },
    {
      icon: "✆",
      label: "الرقم المختصر",
      value: "15875",
      href: "tel:15875",
    },
    {
      icon: "✆",
      label: "موبايل",
      value: "01033766876",
      href: "tel:01033766876",
    },
    {
      icon: "✉",
      label: "البريد الإلكتروني",
      value: "info@venesia-developments.com",
      href: "mailto:info@venesia-developments.com",
    },
  ],
  "footer.social_links": [
    { platform: "facebook", label: "Facebook", href: "https://facebook.com/venesia-developments" },
    { platform: "instagram", label: "Instagram", href: "https://instagram.com/venesia_developments" },
    { platform: "tiktok", label: "TikTok", href: "https://tiktok.com/@venesiadevelopments" },
    { platform: "youtube", label: "YouTube", href: "https://youtube.com/@venesia" },
    { platform: "whatsapp", label: "WhatsApp", href: "https://wa.me/201033766876" },
    {
      platform: "location",
      label: "Location",
      href: "https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate",
    },
  ],
  "footer.legal": {
    copyright: "Venesia Developments. All rights reserved.",
    tagline: "Trust Built On Ground",
  },
};

const FOOTER_MENU_ITEMS = [
  { label: "الرئيسية", href: "/", sort_order: 10 },
  { label: "من نحن", href: "/about", sort_order: 20 },
  { label: "مشروعاتنا", href: "/projects", sort_order: 30 },
  { label: "تابع مشروعك", href: "/track-your-project", sort_order: 40 },
  { label: "موضوعات تهمك", href: "/topics", sort_order: 50 },
  { label: "تواصل معنا", href: "/contact", sort_order: 60 },
];

async function upsertSetting(settingKey, value) {
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: settingKey,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(`${settingKey}: ${error.message}`);
  console.log(`OK site_settings ${settingKey}`);
}

async function ensureFooterMenu() {
  const { data: existing, error: lookupError } = await supabase
    .from("menus")
    .select("id,slug")
    .eq("slug", "footer-menu")
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  let menuId = existing?.id ?? null;

  if (!menuId) {
    const { data: inserted, error: insertError } = await supabase
      .from("menus")
      .insert({
        name: "Footer Quick Links",
        slug: "footer-menu",
        location: "footer",
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);
    menuId = inserted.id;
    console.log(`Inserted footer menu id=${menuId}`);
  } else {
    const { error: updateError } = await supabase
      .from("menus")
      .update({ location: "footer", is_active: true, name: "Footer Quick Links" })
      .eq("id", menuId);

    if (updateError) throw new Error(updateError.message);
    console.log(`Updated footer menu id=${menuId}`);
  }

  const { data: existingItems } = await supabase
    .from("menu_items")
    .select("id,href")
    .eq("menu_id", menuId);

  const existingHrefs = new Set((existingItems ?? []).map((item) => item.href));

  for (const item of FOOTER_MENU_ITEMS) {
    if (existingHrefs.has(item.href)) {
      await supabase
        .from("menu_items")
        .update({
          label: item.label,
          sort_order: item.sort_order,
          is_visible: true,
          item_type: "custom",
          target: "_self",
          style_preset: "default",
        })
        .eq("menu_id", menuId)
        .eq("href", item.href);
      console.log(`Updated menu item ${item.href}`);
      continue;
    }

    const { error } = await supabase.from("menu_items").insert({
      menu_id: menuId,
      parent_id: null,
      label: item.label,
      item_type: "custom",
      href: item.href,
      linked_type: null,
      linked_id: null,
      anchor: null,
      target: "_self",
      css_class: null,
      style_preset: "default",
      is_visible: true,
      sort_order: item.sort_order,
    });

    if (error) throw new Error(error.message);
    console.log(`Inserted menu item ${item.href}`);
  }
}

try {
  for (const [settingKey, value] of Object.entries(FOOTER_SETTINGS)) {
    await upsertSetting(settingKey, value);
  }

  await ensureFooterMenu();
  console.log("Footer settings seed complete.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
