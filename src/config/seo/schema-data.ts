import { SEO_SITE } from "./seo-site";

export const SCHEMA_ORGANIZATION = {
  name: SEO_SITE.name,
  alternateName: SEO_SITE.arabicName,
  legalName: SEO_SITE.legalName,
  url: SEO_SITE.defaultUrl,
  logo: `${SEO_SITE.defaultUrl}${SEO_SITE.logo}`,
  image: `${SEO_SITE.defaultUrl}${SEO_SITE.defaultImage}`,
  telephone: SEO_SITE.contact.phone,
  areaServed: SEO_SITE.contact.areaServed,
  address: {
    addressCountry: SEO_SITE.country,
    addressLocality: SEO_SITE.city,
  },
} as const;

export const SCHEMA_WEBSITE = {
  name: SEO_SITE.name,
  alternateName: SEO_SITE.arabicName,
  url: SEO_SITE.defaultUrl,
  inLanguage: SEO_SITE.language,
} as const;