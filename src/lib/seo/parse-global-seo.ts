import {
  GLOBAL_SEO_FIELD_KEYS,
  type GlobalSeoSettings,
  type GlobalSeoSettingsInput,
  type GlobalSeoSocialLink,
} from "./global-seo-types";

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
