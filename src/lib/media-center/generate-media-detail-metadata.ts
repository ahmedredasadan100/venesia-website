import type { Metadata } from "next";

import { NO_INDEX_ROBOTS } from "../../config/seo/seo-rules";
import { getMediaItemBySlug } from "../media-center";
import { MEDIA_DETAIL_PAGE_CONFIG, type MediaDetailPageKey } from "./detail-page-config";
import { generatePublicMetadata } from "../seo/generate-public-metadata";

type MediaDetailPageParams = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMediaDetailMetadata(
  configKey: MediaDetailPageKey,
  { params }: MediaDetailPageParams,
): Promise<Metadata> {
  const config = MEDIA_DETAIL_PAGE_CONFIG[configKey];
  const { slug } = await params;
  const item = await getMediaItemBySlug(config.mediaType, slug);

  if (!item) {
    return generatePublicMetadata({
      path: config.basePath,
      title: config.notFound.title,
      description: config.notFound.description,
      robots: NO_INDEX_ROBOTS,
      includePageSeo: false,
    });
  }

  const pagePath = `${config.basePath}/${item.slug}`;

  return generatePublicMetadata({
    path: pagePath,
    entitySeo: {
      title: item.seoTitle,
      description: item.seoDescription,
      keywords: item.seoKeywords,
      image: item.image,
      imageAlt: item.imageAlt,
      ogImage: item.ogImage,
    },
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.excerpt,
    image: item.ogImage || item.image,
    imageAlt: item.imageAlt || item.title,
    type: "article",
    publishedTime: item.publishedAt,
    modifiedTime: item.publishedAt,
    authors: ["Venesia Developments"],
    includePageSeo: false,
  });
}
