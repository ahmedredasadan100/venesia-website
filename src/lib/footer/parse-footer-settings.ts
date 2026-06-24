import type {
  FooterBrand,
  FooterContactItem,
  FooterLegal,
  FooterSocialLink,
  FooterSocialPlatform,
} from "./types";
import { isSocialPlatform } from "./defaults";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseFooterBrand(value: unknown, fallback: FooterBrand): FooterBrand {
  if (!value || typeof value !== "object") return fallback;

  const record = value as Record<string, unknown>;
  return {
    title: cleanText(record.title) || fallback.title,
    tagline: cleanText(record.tagline) || fallback.tagline,
    contactHeading: cleanText(record.contactHeading) || fallback.contactHeading,
    mediaHeading: cleanText(record.mediaHeading) || fallback.mediaHeading,
  };
}

export function parseFooterContactItems(value: unknown, fallback: FooterContactItem[]): FooterContactItem[] {
  if (!Array.isArray(value) || !value.length) return fallback;

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = cleanText(record.label);
      const contactValue = cleanText(record.value);
      if (!label || !contactValue) return null;

      const href = cleanText(record.href);
      const icon = cleanText(record.icon);

      return {
        icon: icon || undefined,
        label,
        value: contactValue,
        href: href || undefined,
        visible: record.visible === false ? false : undefined,
      } satisfies FooterContactItem;
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
