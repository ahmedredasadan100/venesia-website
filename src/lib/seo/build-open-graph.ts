import { SEO_SITE } from "../../config/seo/seo-site";
import type { SeoOpenGraphType } from "../../config/seo/seo-types";
import { absoluteAssetUrl, absoluteUrl } from "./seo-utils";

export function buildOpenGraph(input: {
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: SeoOpenGraphType;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}) {
  const type = input.type ?? "website";

  const base = {
    title: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    siteName: SEO_SITE.name,
    locale: SEO_SITE.defaultLocale,
    type,
    images: [
      {
        url: absoluteAssetUrl(input.image ?? SEO_SITE.defaultImage),
        width: 1200,
        height: 630,
        alt: input.title,
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