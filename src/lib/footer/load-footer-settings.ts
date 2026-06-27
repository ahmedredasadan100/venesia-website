import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { buildSlotsFromLegacy } from "./build-slots-from-legacy";
import {
  DEFAULT_FOOTER_BRAND,
  DEFAULT_FOOTER_CONTACT_ITEMS,
  DEFAULT_FOOTER_LEGAL,
  DEFAULT_FOOTER_SETTINGS,
  DEFAULT_FOOTER_SLOTS,
  DEFAULT_FOOTER_SOCIAL_LINKS,
} from "./defaults";
import {
  parseFooterBrand,
  parseFooterContactItems,
  parseFooterLegal,
  parseFooterSocialLinks,
} from "./parse-footer-settings";
import { parseFooterSlots } from "./parse-footer-slots";
import type { FooterBrand, FooterSettings } from "./types";
import {
  FOOTER_LOADER_SETTING_KEYS,
  FOOTER_SETTING_KEYS,
  FOOTER_SLOTS_SETTING_KEY,
} from "./types";
import { resolveFooterSettingsLinks } from "../admin/links/block-config-links";
import { validateFooterSlots } from "./validate-footer-slots";

function resolveFooterSlots(
  rawSlots: unknown,
  brand: FooterBrand,
): Pick<FooterSettings, "slots" | "slotsSource"> {
  if (rawSlots == null) {
    return { slots: buildSlotsFromLegacy(brand), slotsSource: "legacy" };
  }

  const parsed = parseFooterSlots(rawSlots, brand);
  const validation = validateFooterSlots(parsed);
  if (validation.ok) {
    return { slots: validation.value, slotsSource: "database" };
  }

  logError("footer.slots validation failed; using legacy builder", new Error(validation.errors.join(" ")));
  return { slots: buildSlotsFromLegacy(brand), slotsSource: "legacy" };
}

function buildSettingsFromRows(byKey: Map<string, unknown>): FooterSettings {
  const brand = parseFooterBrand(byKey.get("footer.brand"), DEFAULT_FOOTER_BRAND);
  const { slots, slotsSource } = resolveFooterSlots(byKey.get(FOOTER_SLOTS_SETTING_KEY), brand);
  const hasAllLegacyKeys = FOOTER_SETTING_KEYS.every((key) => byKey.has(key));
  const hasSlotsKey = byKey.has(FOOTER_SLOTS_SETTING_KEY);

  return {
    brand,
    contactItems: parseFooterContactItems(byKey.get("footer.contact_items"), DEFAULT_FOOTER_CONTACT_ITEMS),
    socialLinks: parseFooterSocialLinks(byKey.get("footer.social_links"), DEFAULT_FOOTER_SOCIAL_LINKS),
    legal: parseFooterLegal(byKey.get("footer.legal"), DEFAULT_FOOTER_LEGAL),
    slots,
    slotsSource,
    usesFallback: !hasAllLegacyKeys || !hasSlotsKey,
  };
}

export async function loadFooterSettings(): Promise<FooterSettings> {
  noStore();

  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("key,value")
    .in("key", [...FOOTER_LOADER_SETTING_KEYS]);

  if (error) {
    logError("loadFooterSettings failed", error);
    return DEFAULT_FOOTER_SETTINGS;
  }

  const rows = data ?? [];
  if (!rows.length) {
    return DEFAULT_FOOTER_SETTINGS;
  }

  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const settings = buildSettingsFromRows(byKey);
  return resolveFooterSettingsLinks(settings);
}

export async function loadFooterSettingsForAdmin(): Promise<FooterSettings> {
  const settings = await loadFooterSettings();
  return { ...settings, usesFallback: settings.usesFallback };
}

export function loadFooterSettingsFromValues(
  values: Partial<Record<(typeof FOOTER_LOADER_SETTING_KEYS)[number], unknown>>,
): FooterSettings {
  const byKey = new Map<string, unknown>(Object.entries(values));
  if (!byKey.size) return DEFAULT_FOOTER_SETTINGS;
  return buildSettingsFromRows(byKey);
}

export { DEFAULT_FOOTER_SLOTS };
