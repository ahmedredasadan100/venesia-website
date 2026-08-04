import type {
  FooterSettings,
  FooterSocialPlatform,
} from "./types";
import { FOOTER_SLOTS_CONFIG_VERSION, type FooterSlotsConfig } from "./footer-slot-types";

const SOCIAL_PLATFORMS: FooterSocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "whatsapp",
  "location",
];

/** Admin-only reset template. It is never used by the public read path. */
export const DEFAULT_FOOTER_SLOTS: FooterSlotsConfig = {
  version: FOOTER_SLOTS_CONFIG_VERSION,
  slots: [
    {
      index: 1,
      enabled: true,
      type: "text",
      heading: "Venesia Developments",
      config: {
        title: "",
        body: "Building trust before concrete.",
        showBrandIcon: true,
        cta: { enabled: false, label: "", href: "", target: "_self" },
      },
    },
    {
      index: 2,
      enabled: true,
      type: "menu",
      heading: "القائمة الرئيسية",
      config: {
        source: "location",
        menuId: null,
        location: "footer",
        fallbackLocation: "footer",
        maxItems: null,
        showOnlyTopLevel: true,
      },
    },
    {
      index: 3,
      enabled: true,
      type: "media",
      heading: "المركز الإعلامي",
      config: {
        source: "main_submenu",
        parentHref: "/media-center",
        parentLink: null,
        menuId: null,
        manualLinks: [],
        maxItems: null,
      },
    },
    {
      index: 4,
      enabled: true,
      type: "contact",
      heading: "تواصل معنا",
      config: { source: "global", items: [] },
    },
  ],
};

/** Fail-safe outage state: deliberately carries no public composition content. */
export const EMPTY_FOOTER_SETTINGS: FooterSettings = {
  contactItems: [],
  socialLinks: [],
  legal: { copyright: "", tagline: "" },
  slots: { version: FOOTER_SLOTS_CONFIG_VERSION, slots: [] },
  sourceStatus: "error",
  sourceIssues: ["Footer settings are unavailable."],
};

export function isSocialPlatform(value: string): value is FooterSocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as FooterSocialPlatform);
}
