import { SCHEMA_ORGANIZATION } from "../../config/seo/schema-data";
import { SEO_DEFAULTS } from "../../config/seo/seo-rules";
import { SEO_SITE } from "../../config/seo/seo-site";
import type { GlobalSeoSettings } from "./global-seo-types";

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
    organizationName: SCHEMA_ORGANIZATION.name,
    organizationDescription: SEO_DEFAULTS.fallbackDescription,
    organizationLogo: SEO_SITE.logo,
    organizationPhone: SCHEMA_ORGANIZATION.telephone,
    organizationEmail: "info@venesia-developments.com",
    organizationAddress: `${SCHEMA_ORGANIZATION.address.addressLocality}, ${SCHEMA_ORGANIZATION.address.addressCountry}`,
    organizationSocialLinks: [],
    twitterHandle: SEO_SITE.twitterHandle,
    googleSiteVerification: "",
    bingSiteVerification: "",
  };
}
