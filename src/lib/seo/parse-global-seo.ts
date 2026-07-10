import type { GlobalSeoSettings, GlobalSeoSettingsInput, GlobalSeoSocialLink } from "./global-seo-types";
import { getGlobalSeoDefaults } from "./global-seo-defaults";

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseSocialLinks(value: unknown, fallback: GlobalSeoSocialLink[]) {
  if (!Array.isArray(value)) return fallback;

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const href = typeof record.href === "string" ? record.href.trim() : "";
      if (!label || !href) return null;
      return { label, href };
    })
    .filter(Boolean) as GlobalSeoSocialLink[];
}

export function mergeGlobalSeoSettings(input?: GlobalSeoSettingsInput | null): GlobalSeoSettings {
  const defaults = getGlobalSeoDefaults();
  if (!input) return defaults;

  return {
    siteName: readString(input.siteName, defaults.siteName),
    defaultTitle: readString(input.defaultTitle, defaults.defaultTitle),
    defaultDescription: readString(input.defaultDescription, defaults.defaultDescription),
    defaultOgImage: readString(input.defaultOgImage, defaults.defaultOgImage),
    defaultOgImageAlt: readString(input.defaultOgImageAlt, defaults.defaultOgImageAlt),
    defaultTwitterImage: readString(input.defaultTwitterImage, defaults.defaultTwitterImage),
    defaultRobotsIndex: readBoolean(input.defaultRobotsIndex, defaults.defaultRobotsIndex),
    defaultRobotsFollow: readBoolean(input.defaultRobotsFollow, defaults.defaultRobotsFollow),
    siteUrl: readString(input.siteUrl, defaults.siteUrl),
    canonicalBaseUrl: readString(input.canonicalBaseUrl, defaults.canonicalBaseUrl),
    organizationName: readString(input.organizationName, defaults.organizationName),
    organizationDescription: readString(input.organizationDescription, defaults.organizationDescription),
    organizationLogo: readString(input.organizationLogo, defaults.organizationLogo),
    organizationPhone: readString(input.organizationPhone, defaults.organizationPhone),
    organizationEmail: readString(input.organizationEmail, defaults.organizationEmail),
    organizationAddress: readString(input.organizationAddress, defaults.organizationAddress),
    organizationSocialLinks: parseSocialLinks(input.organizationSocialLinks, defaults.organizationSocialLinks),
    twitterHandle: readString(input.twitterHandle, defaults.twitterHandle),
    googleSiteVerification: readString(input.googleSiteVerification, defaults.googleSiteVerification),
    bingSiteVerification: readString(input.bingSiteVerification, defaults.bingSiteVerification),
  };
}

export function parseGlobalSeoValue(value: unknown): GlobalSeoSettings {
  if (!value || typeof value !== "object") {
    return getGlobalSeoDefaults();
  }

  return mergeGlobalSeoSettings(value as GlobalSeoSettingsInput);
}
