import "server-only";

import { cache } from "react";
import { unstable_cache, unstable_noStore as noStore } from "next/cache";

import { resolveFooterSettingsLinks } from "../admin/links/block-config-links";
import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import { DEFAULT_FOOTER_SLOTS, EMPTY_FOOTER_SETTINGS } from "./defaults";
import {
  parseFooterContactItems,
  parseFooterLegal,
  parseFooterSocialLinks,
} from "./parse-footer-settings";
import type { FooterSlotsConfig } from "./footer-slot-types";
import type { FooterSettings } from "./types";
import { FOOTER_LOADER_SETTING_KEYS, FOOTER_SLOTS_SETTING_KEY } from "./types";
import { validateFooterSlots } from "./validate-footer-slots";

function cloneEmptyFooterSettings(
  sourceStatus: FooterSettings["sourceStatus"],
  sourceIssues: string[],
): FooterSettings {
  return {
    ...structuredClone(EMPTY_FOOTER_SETTINGS),
    sourceStatus,
    sourceIssues,
  };
}

function readCanonicalSlots(value: unknown): { value: FooterSlotsConfig | null; issue?: string } {
  if (!value || typeof value !== "object") {
    return { value: null, issue: `${FOOTER_SLOTS_SETTING_KEY} is missing or not an object.` };
  }

  try {
    const validation = validateFooterSlots(value as FooterSlotsConfig);
    if (!validation.ok) return { value: null, issue: validation.errors.join(" ") };
    return { value: validation.value };
  } catch (error) {
    return {
      value: null,
      issue: error instanceof Error ? error.message : `${FOOTER_SLOTS_SETTING_KEY} is invalid.`,
    };
  }
}

function buildSettingsFromRows(byKey: Map<string, unknown>): FooterSettings {
  const missingKeys = FOOTER_LOADER_SETTING_KEYS.filter((key) => !byKey.has(key));
  if (missingKeys.length) {
    return cloneEmptyFooterSettings(
      "missing",
      missingKeys.map((key) => `${key} is not persisted.`),
    );
  }

  const slots = readCanonicalSlots(byKey.get(FOOTER_SLOTS_SETTING_KEY));
  const contactItems = parseFooterContactItems(byKey.get("footer.contact_items"), []);
  const socialLinks = parseFooterSocialLinks(byKey.get("footer.social_links"), []);
  const legal = parseFooterLegal(byKey.get("footer.legal"), { copyright: "", tagline: "" });
  const issues = [
    ...(slots.issue ? [slots.issue] : []),
    ...(!Array.isArray(byKey.get("footer.contact_items")) || contactItems.length === 0
      ? ["footer.contact_items is invalid or empty."]
      : []),
    ...(!Array.isArray(byKey.get("footer.social_links")) || socialLinks.length === 0
      ? ["footer.social_links is invalid or empty."]
      : []),
    ...(!legal.copyright.trim() || !legal.tagline.trim()
      ? ["footer.legal is incomplete."]
      : []),
  ];

  if (!slots.value || issues.length) {
    return cloneEmptyFooterSettings("invalid", issues);
  }

  return {
    slots: slots.value,
    contactItems,
    socialLinks,
    legal,
    sourceStatus: "database",
    sourceIssues: [],
  };
}

async function queryFooterSettings(): Promise<FooterSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("key,value")
    .in("key", [...FOOTER_LOADER_SETTING_KEYS]);

  if (error) {
    logError("loadFooterSettings failed", error, { resource: "site_settings:footer" });
    return cloneEmptyFooterSettings("error", [error.message]);
  }

  const rows = data ?? [];
  if (!rows.length) {
    return cloneEmptyFooterSettings("missing", ["No canonical Footer settings are persisted."]);
  }

  const settings = buildSettingsFromRows(new Map(rows.map((row) => [row.key, row.value])));
  if (settings.sourceStatus !== "database") return settings;
  return resolveFooterSettingsLinks(settings);
}

export const loadFooterSettings = cache(async function loadFooterSettings(): Promise<FooterSettings> {
  return unstable_cache(
    async () => queryFooterSettings(),
    ["public-footer-settings-v2"],
    { revalidate: 300, tags: ["footer", "site-settings"] },
  )();
});

export async function loadFooterSettingsForAdmin(): Promise<FooterSettings> {
  noStore();
  return queryFooterSettings();
}

export function loadFooterSettingsFromValues(
  values: Partial<Record<(typeof FOOTER_LOADER_SETTING_KEYS)[number], unknown>>,
): FooterSettings {
  return buildSettingsFromRows(new Map<string, unknown>(Object.entries(values)));
}

export { DEFAULT_FOOTER_SLOTS };
