import { getSeoRoute } from "../../config/seo/seo-data";
import { SEO_DEFAULTS } from "../../config/seo/seo-rules";
import { SEO_SITE } from "../../config/seo/seo-site";
import type { SeoRobotsDirective } from "../../config/seo/seo-types";
import type { GlobalSeoSettings } from "./global-seo-types";
import type { ResolveSeoMetadataInput, ResolvedSeoMetadata } from "./entity-seo-types";
import { buildCanonicalWithBase } from "./seo-utils";

function pickString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickKeywords(...values: Array<string[] | null | undefined>) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
  }
  return undefined;
}

function buildRobotsDirective(
  explicit: SeoRobotsDirective | undefined,
  entityIndex: boolean | null | undefined,
  entityFollow: boolean | null | undefined,
  pageIndex: boolean | null | undefined,
  pageFollow: boolean | null | undefined,
  global: GlobalSeoSettings,
): SeoRobotsDirective {
  if (explicit) return explicit;

  const index =
    entityIndex ??
    pageIndex ??
    global.defaultRobotsIndex;

  const follow =
    entityFollow ??
    pageFollow ??
    global.defaultRobotsFollow;

  return {
    index,
    follow,
    googleBot: {
      index,
      follow,
      maxImagePreview: index ? "large" : "none",
      maxSnippet: index ? -1 : 0,
      maxVideoPreview: index ? -1 : 0,
    },
  };
}

export function resolveSeoMetadata(
  input: ResolveSeoMetadataInput,
  global: GlobalSeoSettings,
): ResolvedSeoMetadata {
  const route = getSeoRoute(input.path);
  const metadataBase = pickString(global.canonicalBaseUrl, global.siteUrl, SEO_SITE.defaultUrl);

  const title = pickString(
    input.entitySeo?.title,
    input.pageSeo?.title,
    input.title,
    route?.title,
    global.defaultTitle,
    SEO_DEFAULTS.fallbackTitle,
  );

  const description = pickString(
    input.entitySeo?.description,
    input.pageSeo?.description,
    input.description,
    route?.description,
    global.defaultDescription,
    SEO_DEFAULTS.fallbackDescription,
  );

  const keywords = pickKeywords(
    input.keywords,
    input.entitySeo?.keywords,
    input.pageSeo?.keywords,
  );

  const image = pickString(
    input.image,
    input.entitySeo?.ogImage,
    input.entitySeo?.image,
    input.pageSeo?.ogImage,
    input.pageSeo?.image,
    route?.openGraph?.image,
    global.defaultOgImage,
    SEO_SITE.defaultImage,
  );

  const imageAlt = pickString(
    input.imageAlt,
    input.entitySeo?.imageAlt,
    input.pageSeo?.imageAlt,
    global.defaultOgImageAlt,
    title,
    global.siteName,
  );

  const twitterImage = pickString(
    global.defaultTwitterImage,
    image,
    global.defaultOgImage,
    SEO_SITE.defaultImage,
  );

  const canonical = route?.alternates?.canonical ?? buildCanonicalWithBase(input.path, metadataBase);

  const robots = buildRobotsDirective(
    input.robots ?? route?.robots,
    input.entitySeo?.robotsIndex,
    input.entitySeo?.robotsFollow,
    input.pageSeo?.robotsIndex,
    input.pageSeo?.robotsFollow,
    global,
  );

  return {
    path: input.path,
    title,
    description,
    keywords,
    canonical,
    metadataBase,
    siteName: pickString(global.siteName, SEO_SITE.name),
    image,
    imageAlt,
    twitterImage,
    type: input.type ?? route?.openGraph?.type ?? "website",
    robots,
    twitterHandle: global.twitterHandle || undefined,
    googleSiteVerification: global.googleSiteVerification || undefined,
    bingSiteVerification: global.bingSiteVerification || undefined,
    publishedTime: input.publishedTime,
    modifiedTime: input.modifiedTime,
    authors: input.authors,
  };
}
