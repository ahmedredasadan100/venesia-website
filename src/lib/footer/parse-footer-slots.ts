import { buildSlotsFromLegacy } from "./build-slots-from-legacy";
import { DEFAULT_FOOTER_SLOTS } from "./defaults";
import {
  FOOTER_BLOCK_TYPES,
  FOOTER_SLOT_INDICES,
  FOOTER_SLOTS_CONFIG_VERSION,
  type FooterBlockType,
  type FooterContactSlotConfig,
  type FooterCustomLinksSlotConfig,
  type FooterManualLink,
  type FooterMediaSlotConfig,
  type FooterMenuLocation,
  type FooterMenuSlotConfig,
  type FooterSlot,
  type FooterSlotsConfig,
  type FooterTextSlotConfig,
} from "./footer-slot-types";
import { parseFooterContactItem } from "./parse-footer-settings";
import type { FooterContactItem } from "./types";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parsePositiveIntOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return null;
  return Math.floor(num);
}

function isMenuLocation(value: string): value is FooterMenuLocation {
  return value === "footer" || value === "main" || value === "mobile" || value === "custom";
}

function isBlockType(value: string): value is FooterBlockType {
  return (FOOTER_BLOCK_TYPES as readonly string[]).includes(value);
}

function parseContactItems(value: unknown): FooterContactItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return parseFooterContactItem(item as Record<string, unknown>);
    })
    .filter(Boolean) as FooterContactItem[];
}

function parseManualLinks(value: unknown): FooterManualLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = cleanText(record.label);
      const href = cleanText(record.href);
      const link = record.link && typeof record.link === "object" ? (record.link as Record<string, unknown>) : null;
      if (!label) return null;
      if (!href && !link) return null;

      const targetRaw = cleanText(record.target);
      const sortOrder = parsePositiveIntOrNull(record.sortOrder ?? record.sort_order) ?? index;

      return {
        label,
        href,
        link,
        target: targetRaw === "_blank" ? "_blank" : "_self",
        visible: record.visible === false ? false : undefined,
        sortOrder,
      } satisfies FooterManualLink;
    })
    .filter(Boolean) as FooterManualLink[];
}

export function parseTextSlotConfig(raw: unknown, fallback: FooterTextSlotConfig): FooterTextSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const ctaRaw = record.cta && typeof record.cta === "object" ? (record.cta as Record<string, unknown>) : {};
  const targetRaw = cleanText(ctaRaw.target);

  return {
    title: typeof record.title === "string" ? cleanText(record.title) : fallback.title,
    body: cleanText(record.body) || fallback.body,
    showBrandIcon: parseBoolean(record.showBrandIcon, fallback.showBrandIcon),
    cta: {
      enabled: parseBoolean(ctaRaw.enabled, fallback.cta.enabled),
      label: cleanText(ctaRaw.label),
      href: cleanText(ctaRaw.href),
      link: ctaRaw.link && typeof ctaRaw.link === "object" ? (ctaRaw.link as Record<string, unknown>) : null,
      target: targetRaw === "_blank" ? "_blank" : "_self",
    },
  };
}

export function parseMenuSlotConfig(raw: unknown, fallback: FooterMenuSlotConfig): FooterMenuSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const sourceRaw = cleanText(record.source);
  const source = sourceRaw === "menu_id" ? "menu_id" : "location";
  const locationRaw = cleanText(record.location);
  const fallbackRaw = cleanText(record.fallbackLocation);

  return {
    source,
    menuId: parsePositiveIntOrNull(record.menuId),
    location: isMenuLocation(locationRaw) ? locationRaw : fallback.location,
    fallbackLocation: isMenuLocation(fallbackRaw) ? fallbackRaw : fallback.fallbackLocation,
    maxItems: parsePositiveIntOrNull(record.maxItems),
    showOnlyTopLevel: parseBoolean(record.showOnlyTopLevel, fallback.showOnlyTopLevel),
  };
}

export function parseContactSlotConfig(raw: unknown, fallback: FooterContactSlotConfig): FooterContactSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const sourceRaw = cleanText(record.source);

  return {
    source: sourceRaw === "custom" ? "custom" : "global",
    items: parseContactItems(record.items),
  };
}

export function parseMediaSlotConfig(raw: unknown, fallback: FooterMediaSlotConfig): FooterMediaSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const sourceRaw = cleanText(record.source);
  let source: FooterMediaSlotConfig["source"] = fallback.source;
  if (sourceRaw === "menu_id" || sourceRaw === "manual" || sourceRaw === "main_submenu") {
    source = sourceRaw;
  }

  return {
    source,
    parentHref: cleanText(record.parentHref) || fallback.parentHref,
    parentLink:
      record.parentLink && typeof record.parentLink === "object"
        ? (record.parentLink as Record<string, unknown>)
        : null,
    menuId: parsePositiveIntOrNull(record.menuId),
    manualLinks: parseManualLinks(record.manualLinks),
    maxItems: parsePositiveIntOrNull(record.maxItems),
  };
}

export function parseCustomLinksSlotConfig(
  raw: unknown,
  fallback: FooterCustomLinksSlotConfig,
): FooterCustomLinksSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const links = parseManualLinks(record.links);

  return { links: links.length ? links : fallback.links };
}

function getDefaultSlot(index: number): FooterSlot {
  const defaults = DEFAULT_FOOTER_SLOTS.slots.find((slot) => slot.index === index);
  if (!defaults) {
    throw new Error(`Missing default footer slot for index ${index}.`);
  }
  return structuredClone(defaults) as FooterSlot;
}

function getDefaultConfigForType(type: FooterBlockType): FooterSlot["config"] {
  const match = DEFAULT_FOOTER_SLOTS.slots.find((slot) => slot.type === type);
  if (match) return structuredClone(match.config);

  if (type === "custom_links") {
    return { links: [] } satisfies FooterCustomLinksSlotConfig;
  }

  throw new Error(`No default footer config for block type: ${type}`);
}

function parseSlotHeading(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return cleanNullableText(value);
}

function parseSlot(raw: unknown, index: number): FooterSlot {
  const fallback = getDefaultSlot(index);
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const typeRaw = cleanText(record.type);
  const type = isBlockType(typeRaw) ? typeRaw : fallback.type;
  const configRaw = record.config;
  const configFallback = getDefaultConfigForType(type);

  let config = configFallback;
  if (type === "text") {
    config = parseTextSlotConfig(configRaw, configFallback as FooterTextSlotConfig);
  } else if (type === "menu") {
    config = parseMenuSlotConfig(configRaw, configFallback as FooterMenuSlotConfig);
  } else if (type === "contact") {
    config = parseContactSlotConfig(configRaw, configFallback as FooterContactSlotConfig);
  } else if (type === "media") {
    config = parseMediaSlotConfig(configRaw, configFallback as FooterMediaSlotConfig);
  } else if (type === "custom_links") {
    config = parseCustomLinksSlotConfig(configRaw, configFallback as FooterCustomLinksSlotConfig);
  }

  return {
    index: index as FooterSlot["index"],
    enabled: parseBoolean(record.enabled, fallback.enabled),
    type,
    heading: parseSlotHeading(record.heading),
    config,
  } as FooterSlot;
}

export function parseFooterSlots(
  value: unknown,
  legacyBrand?: Parameters<typeof buildSlotsFromLegacy>[0],
): FooterSlotsConfig {
  if (!value || typeof value !== "object") {
    return legacyBrand ? buildSlotsFromLegacy(legacyBrand) : DEFAULT_FOOTER_SLOTS;
  }

  const record = value as Record<string, unknown>;
  const slotsRaw = Array.isArray(record.slots) ? record.slots : [];

  const slotsByIndex = new Map<number, FooterSlot>();
  for (const slotRaw of slotsRaw) {
    if (!slotRaw || typeof slotRaw !== "object") continue;
    const index = Number((slotRaw as Record<string, unknown>).index);
    if (!FOOTER_SLOT_INDICES.includes(index as (typeof FOOTER_SLOT_INDICES)[number])) continue;
    slotsByIndex.set(index, parseSlot(slotRaw, index));
  }

  const slots = FOOTER_SLOT_INDICES.map((index) => slotsByIndex.get(index) ?? getDefaultSlot(index));

  return {
    version: FOOTER_SLOTS_CONFIG_VERSION,
    slots,
  };
}
