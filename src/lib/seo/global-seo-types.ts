export type GlobalSeoSocialLink = {
  label: string;
  href: string;
};

export type GlobalSeoSettings = {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: string;
  defaultOgImageAlt: string;
  defaultTwitterImage: string;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  siteUrl: string;
  canonicalBaseUrl: string;
  organizationName: string;
  organizationAlternateName: string;
  organizationLegalName: string;
  organizationTagline: string;
  organizationDescription: string;
  organizationLogo: string;
  organizationPhone: string;
  organizationEmail: string;
  organizationAddress: string;
  organizationAddressLocality: string;
  organizationAddressRegion: string;
  organizationPostalCode: string;
  organizationAddressCountry: string;
  organizationAreaServed: string;
  organizationKnowsAbout: string[];
  organizationSocialLinks: GlobalSeoSocialLink[];
  twitterHandle: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
  robotsTxtAllow: string[];
  robotsTxtDisallow: string[];
};

export type GlobalSeoSettingsInput = Partial<GlobalSeoSettings>;

export const GLOBAL_SEO_SETTING_KEY = "seo.global" as const;

export const GLOBAL_SEO_FIELD_KEYS = [
  "siteName",
  "defaultTitle",
  "defaultDescription",
  "defaultOgImage",
  "defaultOgImageAlt",
  "defaultTwitterImage",
  "defaultRobotsIndex",
  "defaultRobotsFollow",
  "siteUrl",
  "canonicalBaseUrl",
  "organizationName",
  "organizationAlternateName",
  "organizationLegalName",
  "organizationTagline",
  "organizationDescription",
  "organizationLogo",
  "organizationPhone",
  "organizationEmail",
  "organizationAddress",
  "organizationAddressLocality",
  "organizationAddressRegion",
  "organizationPostalCode",
  "organizationAddressCountry",
  "organizationAreaServed",
  "organizationKnowsAbout",
  "organizationSocialLinks",
  "twitterHandle",
  "googleSiteVerification",
  "bingSiteVerification",
  "robotsTxtAllow",
  "robotsTxtDisallow",
] as const satisfies readonly (keyof GlobalSeoSettings)[];

export type GlobalSeoFieldKey = (typeof GLOBAL_SEO_FIELD_KEYS)[number];
export type GlobalSeoEffectiveSource = "database" | "environment" | "code_fallback";

export type GlobalSeoEffectiveField = {
  key: GlobalSeoFieldKey;
  value: GlobalSeoSettings[GlobalSeoFieldKey];
  source: GlobalSeoEffectiveSource;
  persisted: boolean;
  environmentKey: string;
};

export type GlobalSeoEffectiveContract = {
  settingKey: typeof GLOBAL_SEO_SETTING_KEY;
  databaseStatus: "loaded" | "missing" | "error";
  databaseError?: string;
  persistedSettings: GlobalSeoSettingsInput;
  settings: GlobalSeoSettings;
  fields: Record<GlobalSeoFieldKey, GlobalSeoEffectiveField>;
  sourceIssues: Array<{
    source: "database" | "environment";
    field: GlobalSeoFieldKey;
    message: string;
  }>;
};
