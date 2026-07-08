import type { Metadata } from "next";

import { NO_INDEX_ROBOTS } from "../../config/seo/seo-rules";
import { buildMetadata } from "../seo/build-metadata";
import { getMediaItemBySlug } from "../media-center";
import { MEDIA_DETAIL_PAGE_CONFIG, type MediaDetailPageKey } from "./detail-page-config";

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
    return buildMetadata({
      path: config.basePath,
      title: config.notFound.title,
      description: config.notFound.description,
      robots: NO_INDEX_ROBOTS,
    });
  }

  return buildMetadata({
    path: `${config.basePath}/${item.slug}`,
    title: `${item.title} | فينيسيا للتطوير العقاري`,
    description: item.excerpt,
    image: item.image,
    type: "article",
    publishedTime: item.publishedAt,
    modifiedTime: item.publishedAt,
    authors: ["Venesia Developments"],
  });
}
