import type { Metadata } from "next";
import { getSeoRoute } from "../../config/seo/seo-data";
import { SEO_DEFAULTS, DEFAULT_ROBOTS } from "../../config/seo/seo-rules";
import { SEO_SITE } from "../../config/seo/seo-site";
import type { BuildMetadataInput } from "../../config/seo/seo-types";
import { PWA_ICON_PATHS } from "../../config/pwa";
import { buildCanonical } from "./build-canonical";
import { cleanText, trimToSeoLength } from "./seo-utils";
import { buildOpenGraph } from "./build-open-graph";

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const route = getSeoRoute(input.path);

  const rawTitle =
    input.title ?? route?.title ?? SEO_DEFAULTS.fallbackTitle;

  const rawDescription =
    input.description ??
    route?.description ??
    SEO_DEFAULTS.fallbackDescription;

  const title = trimToSeoLength(rawTitle, 65);
  const description = trimToSeoLength(rawDescription, 165);

  const canonical =
    route?.alternates?.canonical ?? buildCanonical(input.path);

  const image =
    input.image ?? route?.openGraph?.image ?? SEO_SITE.defaultImage;

  const type =
    input.type ?? route?.openGraph?.type ?? "website";

  const robots = input.robots ?? route?.robots ?? DEFAULT_ROBOTS;

  return {
    metadataBase: new URL(SEO_SITE.defaultUrl),
    title: cleanText(title),
    description: cleanText(description),
    applicationName: SEO_SITE.name,
    generator: "Next.js",
    referrer: "origin-when-cross-origin",
    alternates: {
      canonical,
    },
    robots,
    openGraph: buildOpenGraph({
      path: input.path,
      title,
      description,
      image,
      type,
      publishedTime: input.publishedTime,
      modifiedTime: input.modifiedTime,
      authors: input.authors,
    }),
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      creator: SEO_SITE.twitterHandle || undefined,
    },
    icons: {
      icon: PWA_ICON_PATHS.favicon,
      apple: PWA_ICON_PATHS.appleTouch,
    },
  };
}