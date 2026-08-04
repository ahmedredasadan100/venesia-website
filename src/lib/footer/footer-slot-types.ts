import type { FooterContactItem } from "./types";

export const FOOTER_SLOT_INDICES = [1, 2, 3, 4] as const;

export type FooterSlotIndex = (typeof FOOTER_SLOT_INDICES)[number];

export const FOOTER_BLOCK_TYPES = [
  "text",
  "menu",
  "contact",
  "media",
  "custom_links",
] as const;

export type FooterBlockType = (typeof FOOTER_BLOCK_TYPES)[number];

export const FOOTER_SLOTS_CONFIG_VERSION = 1;

export type FooterTextCtaConfig = {
  enabled: boolean;
  label: string;
  href: string;
  link?: Record<string, unknown> | null;
  target: "_self" | "_blank";
};

export type FooterTextSlotConfig = {
  title: string;
  body: string;
  showBrandIcon: boolean;
  cta: FooterTextCtaConfig;
};

export type FooterMenuLocation = "footer" | "main" | "mobile" | "custom";

export type FooterMenuSlotConfig = {
  source: "location" | "menu_id";
  menuId: number | null;
  location: FooterMenuLocation;
  fallbackLocation: FooterMenuLocation | null;
  maxItems: number | null;
  showOnlyTopLevel: boolean;
};

export type FooterContactSlotConfig = {
  source: "global" | "custom";
  items: FooterContactItem[];
};

export type FooterManualLink = {
  label: string;
  href: string;
  link?: Record<string, unknown> | null;
  target?: "_self" | "_blank";
  visible?: boolean;
  sortOrder?: number;
};

export type FooterMediaSlotConfig = {
  source: "main_submenu" | "menu_id" | "manual";
  parentHref: string;
  parentLink?: Record<string, unknown> | null;
  menuId: number | null;
  manualLinks: FooterManualLink[];
  maxItems: number | null;
};

export type FooterCustomLinksSlotConfig = {
  links: FooterManualLink[];
};

export type FooterSlotConfigByType = {
  text: FooterTextSlotConfig;
  menu: FooterMenuSlotConfig;
  contact: FooterContactSlotConfig;
  media: FooterMediaSlotConfig;
  custom_links: FooterCustomLinksSlotConfig;
};

export type FooterSlot<T extends FooterBlockType = FooterBlockType> = {
  index: FooterSlotIndex;
  enabled: boolean;
  type: T;
  heading: string | null;
  config: FooterSlotConfigByType[T];
};

export type FooterSlotsConfig = {
  version: typeof FOOTER_SLOTS_CONFIG_VERSION;
  slots: FooterSlot[];
};
