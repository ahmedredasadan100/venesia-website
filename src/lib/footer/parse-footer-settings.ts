import type {
  FooterContactItem,
  FooterLegal,
  FooterSocialLink,
  FooterSocialPlatform,
} from "./types";
import { isSocialPlatform } from "./defaults";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseFooterContactItemVisible(value: unknown): boolean | undefined {
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

export function isFooterContactItemVisible(item: FooterContactItem) {
  return item.visible !== false;
}

export function hasFooterContactItemContent(item: Pick<FooterContactItem, "label" | "value" | "icon">) {
  return Boolean(item.label?.trim() || item.value?.trim() || item.icon?.trim());
}

export function isFooterContactItemPublic(item: FooterContactItem) {
  return isFooterContactItemVisible(item) && hasFooterContactItemContent(item);
}

export function normalizeFooterContactItem(item: FooterContactItem): FooterContactItem | null {
  const label = item.label?.trim() ?? "";
  const value = item.value?.trim() ?? "";
  const href = item.href?.trim();
  const icon = item.icon?.trim();

  if (!hasFooterContactItemContent({ label, value, icon })) {
    return null;
  }

  return {
    label,
    value,
    href: href || undefined,
    icon: icon || undefined,
    visible: item.visible === false ? false : undefined,
  };
}

export function parseFooterContactItem(record: Record<string, unknown>): FooterContactItem | null {
  const label = cleanText(record.label);
  const value = cleanText(record.value);
  const href = cleanText(record.href);
  const icon = cleanText(record.icon);

  if (!hasFooterContactItemContent({ label, value, icon })) {
    return null;
  }

  return {
    icon: icon || undefined,
    label,
    value,
    href: href || undefined,
    visible: parseFooterContactItemVisible(record.visible),
  };
}

export function parseFooterContactItems(value: unknown, fallback: FooterContactItem[]): FooterContactItem[] {
  if (!Array.isArray(value) || !value.length) return fallback;

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return parseFooterContactItem(item as Record<string, unknown>);
    })
    .filter(Boolean) as FooterContactItem[];

  return parsed.length ? parsed : fallback;
}

export function parseFooterSocialLinks(value: unknown, fallback: FooterSocialLink[]): FooterSocialLink[] {
  if (!Array.isArray(value) || !value.length) return fallback;

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const platformRaw = cleanText(record.platform);
      const platform: FooterSocialPlatform = isSocialPlatform(platformRaw) ? platformRaw : "facebook";
      const label = cleanText(record.label);
      const href = cleanText(record.href);
      if (!label || !href) return null;

      return { platform, label, href, visible: record.visible === false ? false : undefined } satisfies FooterSocialLink;
    })
    .filter(Boolean) as FooterSocialLink[];

  return parsed.length ? parsed : fallback;
}

export function parseFooterLegal(value: unknown, fallback: FooterLegal): FooterLegal {
  if (!value || typeof value !== "object") return fallback;

  const record = value as Record<string, unknown>;
  return {
    copyright: cleanText(record.copyright) || fallback.copyright,
    tagline: cleanText(record.tagline) || fallback.tagline,
  };
}
