import type {
  GlobalSeoFieldKey,
  GlobalSeoSettingsInput,
  GlobalSeoSocialLink,
} from "./global-seo-types";

export const GLOBAL_SEO_ENVIRONMENT_KEYS: Record<GlobalSeoFieldKey, string> = {
  siteName: "SEO_SITE_NAME",
  defaultTitle: "SEO_DEFAULT_TITLE",
  defaultDescription: "SEO_DEFAULT_DESCRIPTION",
  defaultOgImage: "SEO_DEFAULT_OG_IMAGE",
  defaultOgImageAlt: "SEO_DEFAULT_OG_IMAGE_ALT",
  defaultTwitterImage: "SEO_DEFAULT_TWITTER_IMAGE",
  defaultRobotsIndex: "SEO_DEFAULT_ROBOTS_INDEX",
  defaultRobotsFollow: "SEO_DEFAULT_ROBOTS_FOLLOW",
  siteUrl: "NEXT_PUBLIC_SITE_URL",
  canonicalBaseUrl: "SEO_CANONICAL_BASE_URL | NEXT_PUBLIC_SITE_URL",
  organizationName: "SEO_ORGANIZATION_NAME",
  organizationAlternateName: "SEO_ORGANIZATION_ALTERNATE_NAME",
  organizationLegalName: "SEO_ORGANIZATION_LEGAL_NAME",
  organizationTagline: "SEO_ORGANIZATION_TAGLINE",
  organizationDescription: "SEO_ORGANIZATION_DESCRIPTION",
  organizationLogo: "SEO_ORGANIZATION_LOGO",
  organizationPhone: "SEO_ORGANIZATION_PHONE",
  organizationEmail: "SEO_ORGANIZATION_EMAIL",
  organizationAddress: "SEO_ORGANIZATION_STREET_ADDRESS",
  organizationAddressLocality: "SEO_ORGANIZATION_ADDRESS_LOCALITY",
  organizationAddressRegion: "SEO_ORGANIZATION_ADDRESS_REGION",
  organizationPostalCode: "SEO_ORGANIZATION_POSTAL_CODE",
  organizationAddressCountry: "SEO_ORGANIZATION_ADDRESS_COUNTRY",
  organizationAreaServed: "SEO_ORGANIZATION_AREA_SERVED",
  organizationKnowsAbout: "SEO_ORGANIZATION_KNOWS_ABOUT",
  organizationSocialLinks: "SEO_ORGANIZATION_SOCIAL_LINKS_JSON",
  twitterHandle: "SEO_TWITTER_HANDLE",
  googleSiteVerification: "SEO_GOOGLE_SITE_VERIFICATION",
  bingSiteVerification: "SEO_BING_SITE_VERIFICATION",
  robotsTxtAllow: "SEO_ROBOTS_TXT_ALLOW",
  robotsTxtDisallow: "SEO_ROBOTS_TXT_DISALLOW",
};

function envString(key: string) {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function envBoolean(key: string) {
  const value = envString(key)?.toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

function envStringList(key: string) {
  const value = envString(key);
  if (!value) return undefined;
  const items = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? [...new Set(items)] : undefined;
}

function envSocialLinks(key: string): GlobalSeoSocialLink[] | undefined {
  const value = envString(key);
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const links = parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const label = typeof record.label === "string" ? record.label.trim() : "";
        const href = typeof record.href === "string" ? record.href.trim() : "";
        return label && href ? { label, href } : null;
      })
      .filter((item): item is GlobalSeoSocialLink => item !== null);
    return links.length ? links : undefined;
  } catch {
    return undefined;
  }
}

export function readGlobalSeoEnvironmentSettings(): GlobalSeoSettingsInput {
  const siteUrl = envString("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "");
  const canonicalBaseUrl =
    envString("SEO_CANONICAL_BASE_URL")?.replace(/\/$/, "") || siteUrl;

  return {
    siteName: envString("SEO_SITE_NAME"),
    defaultTitle: envString("SEO_DEFAULT_TITLE"),
    defaultDescription: envString("SEO_DEFAULT_DESCRIPTION"),
    defaultOgImage: envString("SEO_DEFAULT_OG_IMAGE"),
    defaultOgImageAlt: envString("SEO_DEFAULT_OG_IMAGE_ALT"),
    defaultTwitterImage: envString("SEO_DEFAULT_TWITTER_IMAGE"),
    defaultRobotsIndex: envBoolean("SEO_DEFAULT_ROBOTS_INDEX"),
    defaultRobotsFollow: envBoolean("SEO_DEFAULT_ROBOTS_FOLLOW"),
    siteUrl,
    canonicalBaseUrl,
    organizationName: envString("SEO_ORGANIZATION_NAME"),
    organizationAlternateName: envString("SEO_ORGANIZATION_ALTERNATE_NAME"),
    organizationLegalName: envString("SEO_ORGANIZATION_LEGAL_NAME"),
    organizationTagline: envString("SEO_ORGANIZATION_TAGLINE"),
    organizationDescription: envString("SEO_ORGANIZATION_DESCRIPTION"),
    organizationLogo: envString("SEO_ORGANIZATION_LOGO"),
    organizationPhone: envString("SEO_ORGANIZATION_PHONE"),
    organizationEmail: envString("SEO_ORGANIZATION_EMAIL"),
    organizationAddress: envString("SEO_ORGANIZATION_STREET_ADDRESS"),
    organizationAddressLocality: envString("SEO_ORGANIZATION_ADDRESS_LOCALITY"),
    organizationAddressRegion: envString("SEO_ORGANIZATION_ADDRESS_REGION"),
    organizationPostalCode: envString("SEO_ORGANIZATION_POSTAL_CODE"),
    organizationAddressCountry: envString("SEO_ORGANIZATION_ADDRESS_COUNTRY"),
    organizationAreaServed: envString("SEO_ORGANIZATION_AREA_SERVED"),
    organizationKnowsAbout: envStringList("SEO_ORGANIZATION_KNOWS_ABOUT"),
    organizationSocialLinks: envSocialLinks("SEO_ORGANIZATION_SOCIAL_LINKS_JSON"),
    twitterHandle: envString("SEO_TWITTER_HANDLE"),
    googleSiteVerification: envString("SEO_GOOGLE_SITE_VERIFICATION"),
    bingSiteVerification: envString("SEO_BING_SITE_VERIFICATION"),
    robotsTxtAllow: envStringList("SEO_ROBOTS_TXT_ALLOW"),
    robotsTxtDisallow: envStringList("SEO_ROBOTS_TXT_DISALLOW"),
  };
}
