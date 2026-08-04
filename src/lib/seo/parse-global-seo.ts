import {
  GLOBAL_SEO_FIELD_KEYS,
  type GlobalSeoSettings,
  type GlobalSeoSettingsInput,
  type GlobalSeoSocialLink,
} from "./global-seo-types";
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

function parseStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
}

export function parseGlobalSeoPersistedValue(value: unknown): GlobalSeoSettingsInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const parsed: GlobalSeoSettingsInput = {};

  for (const key of GLOBAL_SEO_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const candidate = record[key];
    if (key === "defaultRobotsIndex" || key === "defaultRobotsFollow") {
      if (typeof candidate === "boolean") {
        (parsed as Record<string, unknown>)[key] = candidate;
      }
      continue;
    }
    if (key === "organizationSocialLinks") {
      if (Array.isArray(candidate)) parsed.organizationSocialLinks = parseSocialLinks(candidate, []);
      continue;
    }
    if (key === "organizationKnowsAbout" || key === "robotsTxtAllow" || key === "robotsTxtDisallow") {
      if (Array.isArray(candidate)) {
        (parsed as Record<string, unknown>)[key] = parseStringList(candidate, []);
      }
      continue;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      (parsed as Record<string, unknown>)[key] = candidate.trim();
    }
  }

  return parsed;
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
    organizationAlternateName: readString(input.organizationAlternateName, defaults.organizationAlternateName),
    organizationLegalName: readString(input.organizationLegalName, defaults.organizationLegalName),
    organizationTagline: readString(input.organizationTagline, defaults.organizationTagline),
    organizationDescription: readString(input.organizationDescription, defaults.organizationDescription),
    organizationLogo: readString(input.organizationLogo, defaults.organizationLogo),
    organizationPhone: readString(input.organizationPhone, defaults.organizationPhone),
    organizationEmail: readString(input.organizationEmail, defaults.organizationEmail),
    organizationAddress: readString(input.organizationAddress, defaults.organizationAddress),
    organizationAddressLocality: readString(input.organizationAddressLocality, defaults.organizationAddressLocality),
    organizationAddressRegion: readString(input.organizationAddressRegion, defaults.organizationAddressRegion),
    organizationPostalCode: readString(input.organizationPostalCode, defaults.organizationPostalCode),
    organizationAddressCountry: readString(input.organizationAddressCountry, defaults.organizationAddressCountry),
    organizationAreaServed: readString(input.organizationAreaServed, defaults.organizationAreaServed),
    organizationKnowsAbout: parseStringList(input.organizationKnowsAbout, defaults.organizationKnowsAbout),
    organizationSocialLinks: parseSocialLinks(input.organizationSocialLinks, defaults.organizationSocialLinks),
    twitterHandle: readString(input.twitterHandle, defaults.twitterHandle),
    googleSiteVerification: readString(input.googleSiteVerification, defaults.googleSiteVerification),
    bingSiteVerification: readString(input.bingSiteVerification, defaults.bingSiteVerification),
    robotsTxtAllow: parseStringList(input.robotsTxtAllow, defaults.robotsTxtAllow),
    robotsTxtDisallow: parseStringList(input.robotsTxtDisallow, defaults.robotsTxtDisallow),
  };
}

export function parseGlobalSeoValue(value: unknown): GlobalSeoSettings {
  if (!value || typeof value !== "object") {
    return getGlobalSeoDefaults();
  }

  return mergeGlobalSeoSettings(parseGlobalSeoPersistedValue(value));
}

export type GlobalSeoValidationIssue = {
  field: keyof GlobalSeoSettings;
  message: string;
};

function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAssetReference(value: string) {
  return value.startsWith("/") || isAbsoluteHttpUrl(value);
}

export function validateGlobalSeoSettingsInput(
  input: GlobalSeoSettingsInput,
): GlobalSeoValidationIssue[] {
  const issues: GlobalSeoValidationIssue[] = [];
  const absoluteUrls: Array<keyof GlobalSeoSettings> = ["siteUrl", "canonicalBaseUrl"];
  const assets: Array<keyof GlobalSeoSettings> = [
    "defaultOgImage",
    "defaultTwitterImage",
    "organizationLogo",
  ];

  for (const key of absoluteUrls) {
    const value = input[key];
    if (typeof value === "string" && value && !isAbsoluteHttpUrl(value)) {
      issues.push({ field: key, message: "يجب أن تكون القيمة رابط http أو https كاملًا." });
    }
  }
  for (const key of assets) {
    const value = input[key];
    if (typeof value === "string" && value && !isAssetReference(value)) {
      issues.push({ field: key, message: "يجب أن تكون الصورة مسارًا عامًا يبدأ بـ / أو رابطًا كاملًا." });
    }
  }
  if (
    input.organizationEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.organizationEmail)
  ) {
    issues.push({ field: "organizationEmail", message: "البريد الإلكتروني غير صالح." });
  }
  for (const link of input.organizationSocialLinks ?? []) {
    if (!isAbsoluteHttpUrl(link.href)) {
      issues.push({ field: "organizationSocialLinks", message: "روابط التواصل يجب أن تكون روابط كاملة." });
      break;
    }
  }
  for (const key of ["robotsTxtAllow", "robotsTxtDisallow"] as const) {
    if ((input[key] ?? []).some((path) => !path.startsWith("/"))) {
      issues.push({ field: key, message: "كل مسار Robots يجب أن يبدأ بـ /." });
    }
  }
  if (input.defaultTitle && input.defaultTitle.length > 65) {
    issues.push({ field: "defaultTitle", message: "العنوان الافتراضي لا يتجاوز 65 حرفًا." });
  }
  if (input.defaultDescription && input.defaultDescription.length > 165) {
    issues.push({ field: "defaultDescription", message: "الوصف الافتراضي لا يتجاوز 165 حرفًا." });
  }
  return issues;
}
