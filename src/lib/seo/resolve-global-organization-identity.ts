import { SEO_SITE } from "../../config/seo/seo-site";
import { getGlobalSeoDefaults } from "./global-seo-defaults";
import type { GlobalSeoSettings, GlobalSeoSocialLink } from "./global-seo-types";

/**
 * English navbar tagline — no dedicated field in site_settings.seo.global.
 * Explicit code fallback when global settings do not provide a short tagline.
 */
export const NAVBAR_TAGLINE_FALLBACK = "Trust Built On Ground";

export type GlobalOrganizationIdentity = {
  displayName: string;
  displayTagline: string;
  mobileShortName: string;
  arabicName: string;
  legalName: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  areaServed: string;
  knowsAbout: string[];
  logo: string;
  socialLinks: GlobalSeoSocialLink[];
  siteUrl: string;
  canonicalBaseUrl: string;
};

function pickNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function deriveMobileShortName(displayName: string): string {
  const firstWord = displayName.trim().split(/\s+/)[0];
  return firstWord || SEO_SITE.name.split(/\s+/)[0] || "Venesia";
}

/**
 * Resolves canonical global organization identity for public surfaces.
 *
 * Precedence per field:
 * 1. Valid value from site_settings.seo.global (GlobalSeoSettings)
 * 2. Explicit code fallback via getGlobalSeoDefaults() / SEO_SITE
 *
 * Footer layout values are intentionally excluded — use footer settings for footer presentation.
 */
export function resolveGlobalOrganizationIdentity(
  global: GlobalSeoSettings,
): GlobalOrganizationIdentity {
  const defaults = getGlobalSeoDefaults();

  const displayName = pickNonEmpty(
    global.organizationName,
    global.siteName,
    defaults.organizationName,
    defaults.siteName,
    SEO_SITE.name,
  );

  return {
    displayName,
    displayTagline: pickNonEmpty(
      global.organizationTagline,
      defaults.organizationTagline,
      NAVBAR_TAGLINE_FALLBACK,
    ),
    mobileShortName: deriveMobileShortName(displayName),
    arabicName: pickNonEmpty(
      global.organizationAlternateName,
      defaults.organizationAlternateName,
      SEO_SITE.arabicName,
    ),
    legalName: pickNonEmpty(
      global.organizationLegalName,
      defaults.organizationLegalName,
      SEO_SITE.legalName,
    ),
    description: pickNonEmpty(
      global.organizationDescription,
      defaults.organizationDescription,
    ),
    phone: pickNonEmpty(global.organizationPhone, defaults.organizationPhone),
    email: pickNonEmpty(global.organizationEmail, defaults.organizationEmail),
    address: pickNonEmpty(global.organizationAddress, defaults.organizationAddress),
    addressLocality: pickNonEmpty(
      global.organizationAddressLocality,
      defaults.organizationAddressLocality,
    ),
    addressRegion: pickNonEmpty(
      global.organizationAddressRegion,
      defaults.organizationAddressRegion,
    ),
    postalCode: pickNonEmpty(global.organizationPostalCode, defaults.organizationPostalCode),
    addressCountry: pickNonEmpty(
      global.organizationAddressCountry,
      defaults.organizationAddressCountry,
    ),
    areaServed: pickNonEmpty(global.organizationAreaServed, defaults.organizationAreaServed),
    knowsAbout:
      global.organizationKnowsAbout?.length > 0
        ? global.organizationKnowsAbout
        : defaults.organizationKnowsAbout,
    logo: pickNonEmpty(global.organizationLogo, defaults.organizationLogo, SEO_SITE.logo),
    socialLinks:
      global.organizationSocialLinks?.length > 0
        ? global.organizationSocialLinks
        : defaults.organizationSocialLinks,
    siteUrl: pickNonEmpty(global.siteUrl, defaults.siteUrl, SEO_SITE.defaultUrl),
    canonicalBaseUrl: pickNonEmpty(
      global.canonicalBaseUrl,
      global.siteUrl,
      defaults.canonicalBaseUrl,
      defaults.siteUrl,
      SEO_SITE.defaultUrl,
    ),
  };
}

/**
 * Safe identity used when global settings cannot be loaded.
 * Does not query Supabase.
 */
export function getFallbackGlobalOrganizationIdentity(): GlobalOrganizationIdentity {
  return resolveGlobalOrganizationIdentity(getGlobalSeoDefaults());
}
