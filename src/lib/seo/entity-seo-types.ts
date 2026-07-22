import type { SeoOpenGraphType, SeoRobotsDirective } from "../../config/seo/seo-types";

export type EntitySeoData = {
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  image?: string | null;
  imageAlt?: string | null;
  ogImage?: string | null;
  canonical?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
};

export type PageSeoData = EntitySeoData;

export type ResolveSeoMetadataInput = {
  path: string;
  entitySeo?: EntitySeoData | null;
  pageSeo?: PageSeoData | null;
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  type?: SeoOpenGraphType;
  robots?: SeoRobotsDirective;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

export type ResolvedSeoMetadata = {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  canonical: string;
  metadataBase: string;
  siteName: string;
  image: string;
  imageAlt: string;
  twitterImage: string;
  type: SeoOpenGraphType;
  robots: SeoRobotsDirective;
  twitterHandle?: string;
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};
