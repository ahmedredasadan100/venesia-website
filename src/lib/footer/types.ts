import type { FooterSlotsConfig } from "./footer-slot-types";

export type FooterContactItem = {
  icon?: string;
  label: string;
  value: string;
  href?: string;
  visible?: boolean;
};

export type FooterSocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "whatsapp"
  | "location";

export type FooterSocialLink = {
  platform: FooterSocialPlatform;
  label: string;
  href: string;
  visible?: boolean;
};

export type FooterLegal = {
  copyright: string;
  tagline: string;
};

export type { FooterSlotsConfig };

export type FooterSourceStatus = "database" | "missing" | "invalid" | "error";

export type FooterSettings = {
  contactItems: FooterContactItem[];
  socialLinks: FooterSocialLink[];
  legal: FooterLegal;
  slots: FooterSlotsConfig;
  sourceStatus: FooterSourceStatus;
  sourceIssues: string[];
};

export const FOOTER_SETTING_KEYS = [
  "footer.slots",
  "footer.contact_items",
  "footer.social_links",
  "footer.legal",
] as const;

export const FOOTER_SLOTS_SETTING_KEY = "footer.slots" as const;

export const FOOTER_LOADER_SETTING_KEYS = FOOTER_SETTING_KEYS;
