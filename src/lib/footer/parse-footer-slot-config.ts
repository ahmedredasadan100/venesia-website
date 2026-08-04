import type {
  FooterContactSlotConfig,
  FooterCustomLinksSlotConfig,
  FooterManualLink,
  FooterMediaSlotConfig,
  FooterMenuLocation,
  FooterMenuSlotConfig,
  FooterTextSlotConfig,
} from "./footer-slot-types";
import { parseFooterContactItem } from "./parse-footer-settings";
import type { FooterContactItem } from "./types";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function parseContactItems(value: unknown): FooterContactItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const parsed = parseFooterContactItem(item as Record<string, unknown>);
    return parsed ? [parsed] : [];
  });
}

function parseManualLinks(value: unknown): FooterManualLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = cleanText(record.label);
    const href = cleanText(record.href);
    const link = record.link && typeof record.link === "object" ? record.link as Record<string, unknown> : null;
    if (!label || (!href && !link)) return [];
    return [{
      label,
      href,
      link,
      target: cleanText(record.target) === "_blank" ? "_blank" : "_self",
      visible: record.visible === false ? false : undefined,
      sortOrder: parsePositiveIntOrNull(record.sortOrder ?? record.sort_order) ?? index,
    } satisfies FooterManualLink];
  });
}

export function parseTextSlotConfig(raw: unknown, fallback: FooterTextSlotConfig): FooterTextSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  const cta = record.cta && typeof record.cta === "object" ? record.cta as Record<string, unknown> : {};
  return {
    title: typeof record.title === "string" ? cleanText(record.title) : fallback.title,
    body: typeof record.body === "string" ? cleanText(record.body) : fallback.body,
    showBrandIcon: parseBoolean(record.showBrandIcon, fallback.showBrandIcon),
    cta: {
      enabled: parseBoolean(cta.enabled, fallback.cta.enabled),
      label: cleanText(cta.label),
      href: cleanText(cta.href),
      link: cta.link && typeof cta.link === "object" ? cta.link as Record<string, unknown> : null,
      target: cleanText(cta.target) === "_blank" ? "_blank" : "_self",
    },
  };
}

export function parseMenuSlotConfig(raw: unknown, fallback: FooterMenuSlotConfig): FooterMenuSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  const location = cleanText(record.location);
  const fallbackLocation = cleanText(record.fallbackLocation);
  return {
    source: cleanText(record.source) === "menu_id" ? "menu_id" : "location",
    menuId: parsePositiveIntOrNull(record.menuId),
    location: isMenuLocation(location) ? location : fallback.location,
    fallbackLocation: isMenuLocation(fallbackLocation) ? fallbackLocation : fallback.fallbackLocation,
    maxItems: parsePositiveIntOrNull(record.maxItems),
    showOnlyTopLevel: parseBoolean(record.showOnlyTopLevel, fallback.showOnlyTopLevel),
  };
}

export function parseContactSlotConfig(raw: unknown, fallback: FooterContactSlotConfig): FooterContactSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  return {
    source: cleanText(record.source) === "custom" ? "custom" : "global",
    items: parseContactItems(record.items),
  };
}

export function parseMediaSlotConfig(raw: unknown, fallback: FooterMediaSlotConfig): FooterMediaSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  const rawSource = cleanText(record.source);
  const source = rawSource === "menu_id" || rawSource === "manual" || rawSource === "main_submenu"
    ? rawSource
    : fallback.source;
  return {
    source,
    parentHref: typeof record.parentHref === "string" ? cleanText(record.parentHref) : fallback.parentHref,
    parentLink: record.parentLink && typeof record.parentLink === "object" ? record.parentLink as Record<string, unknown> : null,
    menuId: parsePositiveIntOrNull(record.menuId),
    manualLinks: parseManualLinks(record.manualLinks),
    maxItems: parsePositiveIntOrNull(record.maxItems),
  };
}

export function parseCustomLinksSlotConfig(raw: unknown, fallback: FooterCustomLinksSlotConfig): FooterCustomLinksSlotConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const links = parseManualLinks((raw as Record<string, unknown>).links);
  return { links };
}
