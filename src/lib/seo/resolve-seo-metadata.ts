import { SEO_DEFAULTS } from "../../config/seo/seo-rules";
import { SEO_SITE } from "../../config/seo/seo-site";
import type { SeoRobotsDirective } from "../../config/seo/seo-types";
import type { GlobalSeoSettings } from "./global-seo-types";
import {
  hasEntitySeoData,
  type ResolveSeoMetadataInput,
  type ResolvedSeoMetadata,
} from "./entity-seo-types";
import {
  buildCanonicalWithBase,
  composeSeoTitle,
  getSeoTitleSuffix,
  stripSeoTitleSuffix,
} from "./seo-utils";

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
  global: GlobalSeoSettings,
): SeoRobotsDirective {
  if (explicit) return explicit;

  const index =
    entityIndex ??
    global.defaultRobotsIndex;

  const follow =
    entityFollow ??
    global.defaultRobotsFollow;

  return {
    index,
    follow,
    googleBot: {
      index,
      follow,
      "max-image-preview": index ? "large" : "none",
      "max-snippet": index ? -1 : 0,
      "max-video-preview": index ? -1 : 0,
    },
  };
}

/** URL and indexability authority shared by metadata, JSON-LD and sitemap. */
export function resolveSeoUrlPolicy(
  input: Pick<ResolveSeoMetadataInput, "path" | "entitySeo" | "robots">,
  global: GlobalSeoSettings,
) {
  const metadataBase = pickString(global.canonicalBaseUrl, global.siteUrl, SEO_SITE.defaultUrl);
  return {
    metadataBase,
    canonical: buildCanonicalWithBase(
      pickString(input.entitySeo?.canonical, input.path),
      metadataBase,
    ),
    robots: buildRobotsDirective(
      input.robots,
      input.entitySeo?.robotsIndex,
      input.entitySeo?.robotsFollow,
      global,
    ),
  };
}

export function resolveSeoMetadata(
  input: ResolveSeoMetadataInput,
  global: GlobalSeoSettings,
): ResolvedSeoMetadata {
  const { metadataBase, canonical, robots } = resolveSeoUrlPolicy(input, global);

  const hasExplicitSeoWithoutEntityContract =
    !hasEntitySeoData(input.entitySeo) &&
    Boolean(
      input.title?.trim() ||
        input.description?.trim() ||
        input.keywords?.length ||
        input.image?.trim() ||
        input.imageAlt?.trim() ||
        input.robots,
    );
  const hasLocalSeo =
    hasEntitySeoData(input.entitySeo) ||
    hasExplicitSeoWithoutEntityContract;

  const preferredTitle = pickString(
    input.entitySeo?.title,
  );
  const fallbackTitle = pickString(input.title);
  const titleSuffix = getSeoTitleSuffix(global);
  const normalizedPreferredTitle =
    preferredTitle && preferredTitle === global.defaultTitle
      ? ""
      : stripSeoTitleSuffix(preferredTitle, titleSuffix);
  const title = hasLocalSeo && (normalizedPreferredTitle || fallbackTitle)
    ? composeSeoTitle(normalizedPreferredTitle, fallbackTitle, titleSuffix)
    : pickString(global.defaultTitle, SEO_DEFAULTS.fallbackTitle);

  const description = hasLocalSeo
    ? pickString(
        input.entitySeo?.description,
        input.description,
        global.defaultDescription,
        SEO_DEFAULTS.fallbackDescription,
      )
    : pickString(global.defaultDescription, SEO_DEFAULTS.fallbackDescription);

  const keywords = pickKeywords(
    input.entitySeo?.keywords,
    input.keywords,
  );

  const entityOgImage = pickString(input.entitySeo?.ogImage);
  const specificImage = hasLocalSeo
    ? pickString(
        entityOgImage,
        input.image,
        input.entitySeo?.image,
      )
    : "";
  const image = pickString(
    specificImage,
    global.defaultOgImage,
    SEO_SITE.defaultImage,
  );

  const imageAlt = pickString(
    entityOgImage ? input.entitySeo?.ogImageAlt : undefined,
    input.imageAlt,
    input.entitySeo?.imageAlt,
    global.defaultOgImageAlt,
    title,
    global.siteName,
  );

  const twitterImage = pickString(
    specificImage,
    global.defaultTwitterImage,
    global.defaultOgImage,
    SEO_SITE.defaultImage,
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
    type: input.type ?? "website",
    robots,
    twitterHandle: global.twitterHandle || undefined,
    googleSiteVerification: global.googleSiteVerification || undefined,
    bingSiteVerification: global.bingSiteVerification || undefined,
    publishedTime: input.publishedTime,
    modifiedTime: input.modifiedTime,
    authors: input.authors?.length
      ? input.authors
      : (input.type) === "article"
        ? [global.organizationName]
        : undefined,
  };
}
