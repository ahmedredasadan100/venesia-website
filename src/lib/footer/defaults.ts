import type {
  FooterSettings,
  FooterSettingsContent,
  FooterSocialPlatform,
} from "./types";
import { FOOTER_SLOTS_CONFIG_VERSION, type FooterSlotsConfig } from "./footer-slot-types";
import { getPublicPageRoute } from "../admin/links/static-routes";

const SOCIAL_PLATFORMS: FooterSocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "whatsapp",
  "location",
];

/** One structural preset owner. Business copy is applied only for an explicit Admin reset. */
export function createFooterSlotsPreset(purpose: "fresh" | "reset"): FooterSlotsConfig {
  const reset = purpose === "reset";
  return {
  version: FOOTER_SLOTS_CONFIG_VERSION,
  slots: [
    {
      index: 1,
      enabled: reset,
      type: "text",
      heading: reset ? "Venesia Developments" : null,
      config: {
        title: "",
        body: reset ? "Building trust before concrete." : "",
        showBrandIcon: reset,
        cta: { enabled: false, label: "", href: "", target: "_self" },
      },
    },
    {
      index: 2,
      enabled: reset,
      type: "menu",
      heading: reset ? "القائمة الرئيسية" : null,
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
      enabled: reset,
      type: "media",
      heading: reset ? "المركز الإعلامي" : null,
      config: {
        source: "main_submenu",
        parentHref: getPublicPageRoute("media-center").href,
        parentLink: null,
        menuId: null,
        manualLinks: [],
        maxItems: null,
      },
    },
    {
      index: 4,
      enabled: reset,
      type: "contact",
      heading: reset ? "تواصل معنا" : null,
      config: { source: "global", items: [] },
    },
  ],
  };
}

/** Admin-only reset template. It is never used by the public read path. */
export const DEFAULT_FOOTER_SLOTS = createFooterSlotsPreset("reset");

/** Explicit fresh-install structure, without business content or publication intent. */
export function createFreshFooterSettings(): FooterSettingsContent {
  return {
    slots: createFooterSlotsPreset("fresh"),
    contactItems: [],
    socialLinks: [],
    legal: { copyright: "", tagline: "" },
  };
}

/** Fail-safe outage state: deliberately carries no public composition content. */
export const EMPTY_FOOTER_SETTINGS: FooterSettings = {
  contactItems: [],
  socialLinks: [],
  legal: { copyright: "", tagline: "" },
  slots: { version: FOOTER_SLOTS_CONFIG_VERSION, slots: [] },
  sourceStatus: "error",
  sourceIssues: ["Footer settings are unavailable."],
  readiness: { systemValid: false, publicationReady: false, issues: ["Footer settings are unavailable."] },
};

export function isSocialPlatform(value: string): value is FooterSocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as FooterSocialPlatform);
}
