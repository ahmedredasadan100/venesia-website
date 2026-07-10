import { SEO_SITE } from "../../config/seo/seo-site";
import type { SeoOpenGraphType } from "../../config/seo/seo-types";
import { absoluteAssetUrl, absoluteUrlWithBase } from "./seo-utils";

export function buildOpenGraph(input: {
  path: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  siteName?: string;
  metadataBase?: string;
  type?: SeoOpenGraphType;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}) {
  const type = input.type ?? "website";
  const metadataBase = input.metadataBase ?? SEO_SITE.defaultUrl;
  const siteName = input.siteName ?? SEO_SITE.name;
  const imageAlt = input.imageAlt ?? input.title;

  const base = {
    title: input.title,
    description: input.description,
    url: absoluteUrlWithBase(input.path, metadataBase),
    siteName,
    locale: SEO_SITE.defaultLocale,
    type,
    images: [
      {
        url: absoluteAssetUrl(input.image ?? SEO_SITE.defaultImage, metadataBase),
        width: 1200,
        height: 630,
        alt: imageAlt,
      },
    ],
  };

  if (type === "article") {
    return {
      ...base,
      publishedTime: input.publishedTime,
      modifiedTime: input.modifiedTime,
      authors: input.authors,
    };
  }

  return base;
}
