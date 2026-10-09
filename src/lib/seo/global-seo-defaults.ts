import { SEO_DEFAULTS } from "../../config/seo/seo-rules";
import { SEO_SITE } from "../../config/seo/seo-site";
import type { GlobalSeoSettings } from "./global-seo-types";

/** Emergency defaults after valid DB and environment values are exhausted.
 * No business identity, marketing copy, contact details or claims live here.
 */
export function getGlobalSeoDefaults(): GlobalSeoSettings {
  const siteUrl = SEO_SITE.defaultUrl;

  return {
    siteName: SEO_SITE.name,
    defaultTitle: SEO_DEFAULTS.fallbackTitle,
    defaultDescription: SEO_DEFAULTS.fallbackDescription,
    defaultOgImage: SEO_SITE.defaultImage,
    defaultOgImageAlt: SEO_SITE.arabicName,
    defaultTwitterImage: SEO_SITE.defaultImage,
    defaultRobotsIndex: true,
    defaultRobotsFollow: true,
    siteUrl,
    canonicalBaseUrl: siteUrl,
    organizationName: SEO_SITE.name,
    organizationAlternateName: SEO_SITE.arabicName,
    organizationLegalName: SEO_SITE.legalName,
    organizationTagline: SEO_SITE.tagline,
    organizationDescription: SEO_DEFAULTS.fallbackDescription,
    organizationLogo: SEO_SITE.logo,
    organizationPhone: SEO_SITE.contact.phone,
    organizationEmail: "",
    organizationAddress: "",
    organizationAddressLocality: SEO_SITE.city,
    organizationAddressRegion: "",
    organizationPostalCode: "",
    organizationAddressCountry: SEO_SITE.country,
    organizationAreaServed: SEO_SITE.contact.areaServed,
    organizationKnowsAbout: [],
    organizationSocialLinks: [],
    twitterHandle: SEO_SITE.twitterHandle,
    googleSiteVerification: "",
    bingSiteVerification: "",
    robotsTxtAllow: ["/"],
    robotsTxtDisallow: [
      "/api/",
      "/_next/",
      "/admin/",
      "/maintenance/",
      "/dashboard/",
      "/private/",
    ],
  };
}
