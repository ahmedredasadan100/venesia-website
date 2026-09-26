import "server-only";

import { cachePublicRead } from "../cache/public-cache-generation";

import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";

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
import { evaluateFooterReadiness, projectFooterSettingsForPublic } from "./footer-settings-readiness";

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
  const readiness = evaluateFooterReadiness({
    slots: slots.value,
    contactItems: byKey.get("footer.contact_items"),
    socialLinks: byKey.get("footer.social_links"),
    legal: byKey.get("footer.legal"),
  });

  if (!slots.value || !readiness.systemValid) {
    return cloneEmptyFooterSettings("invalid", readiness.issues);
  }

  return {
    slots: slots.value,
    contactItems,
    socialLinks,
    legal,
    sourceStatus: "database",
    sourceIssues: readiness.issues,
    readiness,
  };
}

async function queryFooterSettings(publicOnly = false): Promise<FooterSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("key,value")
    .in("key", [...FOOTER_LOADER_SETTING_KEYS]);

  if (error) {
    logError("loadFooterSettings failed", error, { resource: "site_settings:footer" });
    throw new Error(error.message);
  }

  const rows = data ?? [];
  if (!rows.length) {
    return cloneEmptyFooterSettings("missing", ["No canonical Footer settings are persisted."]);
  }

  const persistedSettings = buildSettingsFromRows(new Map(rows.map((row) => [row.key, row.value])));
  const settings = publicOnly ? projectFooterSettingsForPublic(persistedSettings) : persistedSettings;
  if (settings.sourceStatus !== "database" || !settings.readiness?.publicationReady) return settings;
  return resolveFooterSettingsLinks(settings);
}

export const loadFooterSettings = cache(async function loadFooterSettings(): Promise<FooterSettings> {
  try {
    return await cachePublicRead(
      async () => queryFooterSettings(true),
      ["public-footer-settings-v2"],
      { revalidate: 300, tags: ["footer", "site-settings"] },
    )();
  } catch (error) {
    logError("Footer safe rendering after source failure", error);
    return cloneEmptyFooterSettings("error", [error instanceof Error ? error.message : "Footer source read failed."]);
  }
});

export async function loadFooterSettingsForAdmin(): Promise<FooterSettings> {
  noStore();
  try {
    return await queryFooterSettings();
  } catch (error) {
    return cloneEmptyFooterSettings("error", [error instanceof Error ? error.message : "Footer source read failed."]);
  }
}

export { DEFAULT_FOOTER_SLOTS };
