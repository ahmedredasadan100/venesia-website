import type { Metadata } from "next";

import { PWA_ICON_PATHS } from "../../config/pwa";
import type { ResolvedSeoMetadata } from "./entity-seo-types";
import { buildOpenGraph } from "./build-open-graph";
import { cleanText, trimToSeoLength } from "./seo-utils";

export function buildMetadataFromResolved(resolved: ResolvedSeoMetadata): Metadata {
  const title = trimToSeoLength(resolved.title, 65);
  const description = trimToSeoLength(resolved.description, 165);

  const verification: Metadata["verification"] = {};
  if (resolved.googleSiteVerification) {
    verification.google = resolved.googleSiteVerification;
  }
  if (resolved.bingSiteVerification) {
    verification.other = {
      "msvalidate.01": resolved.bingSiteVerification,
    };
  }

  return {
    metadataBase: new URL(resolved.metadataBase),
    title: cleanText(title),
    description: cleanText(description),
    keywords: resolved.keywords?.length ? resolved.keywords : undefined,
    applicationName: resolved.siteName,
    generator: "Next.js",
    referrer: "origin-when-cross-origin",
    alternates: {
      canonical: resolved.canonical,
    },
    robots: resolved.robots,
    openGraph: buildOpenGraph({
      path: resolved.path,
      title,
      description,
      image: resolved.image,
      imageAlt: resolved.imageAlt,
      siteName: resolved.siteName,
      metadataBase: resolved.metadataBase,
      type: resolved.type,
      publishedTime: resolved.publishedTime,
      modifiedTime: resolved.modifiedTime,
      authors: resolved.authors,
    }),
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: resolved.twitterImage,
          alt: resolved.imageAlt,
        },
      ],
      creator: resolved.twitterHandle,
    },
    verification: Object.keys(verification).length ? verification : undefined,
    icons: {
      icon: [
        { url: PWA_ICON_PATHS.favicon96, sizes: "96x96", type: "image/png" },
        { url: PWA_ICON_PATHS.faviconSvg, type: "image/svg+xml" },
      ],
      shortcut: PWA_ICON_PATHS.faviconIco,
      apple: {
        url: PWA_ICON_PATHS.appleTouch,
        sizes: "180x180",
        type: "image/png",
      },
    },
    manifest: PWA_ICON_PATHS.manifest,
  };
}
