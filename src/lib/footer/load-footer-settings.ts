import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import {
  DEFAULT_FOOTER_BRAND,
  DEFAULT_FOOTER_CONTACT_ITEMS,
  DEFAULT_FOOTER_LEGAL,
  DEFAULT_FOOTER_SETTINGS,
  DEFAULT_FOOTER_SOCIAL_LINKS,
} from "./defaults";
import {
  parseFooterBrand,
  parseFooterContactItems,
  parseFooterLegal,
  parseFooterSocialLinks,
} from "./parse-footer-settings";
import type { FooterSettings } from "./types";
import { FOOTER_SETTING_KEYS } from "./types";

export async function loadFooterSettings(): Promise<FooterSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("key,value")
    .in("key", [...FOOTER_SETTING_KEYS]);

  if (error) {
    logError("loadFooterSettings failed", error);
    return DEFAULT_FOOTER_SETTINGS;
  }

  const rows = data ?? [];
  if (!rows.length) {
    return DEFAULT_FOOTER_SETTINGS;
  }

  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const hasAllKeys = FOOTER_SETTING_KEYS.every((key) => byKey.has(key));
  if (!hasAllKeys) {
    return {
      brand: parseFooterBrand(byKey.get("footer.brand"), DEFAULT_FOOTER_BRAND),
      contactItems: parseFooterContactItems(byKey.get("footer.contact_items"), DEFAULT_FOOTER_CONTACT_ITEMS),
      socialLinks: parseFooterSocialLinks(byKey.get("footer.social_links"), DEFAULT_FOOTER_SOCIAL_LINKS),
      legal: parseFooterLegal(byKey.get("footer.legal"), DEFAULT_FOOTER_LEGAL),
      usesFallback: true,
    };
  }

  return {
    brand: parseFooterBrand(byKey.get("footer.brand"), DEFAULT_FOOTER_BRAND),
    contactItems: parseFooterContactItems(byKey.get("footer.contact_items"), DEFAULT_FOOTER_CONTACT_ITEMS),
    socialLinks: parseFooterSocialLinks(byKey.get("footer.social_links"), DEFAULT_FOOTER_SOCIAL_LINKS),
    legal: parseFooterLegal(byKey.get("footer.legal"), DEFAULT_FOOTER_LEGAL),
    usesFallback: false,
  };
}

export async function loadFooterSettingsForAdmin(): Promise<FooterSettings> {
  const settings = await loadFooterSettings();
  return { ...settings, usesFallback: settings.usesFallback };
}
