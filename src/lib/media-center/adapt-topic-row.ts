import type { PublicContentDetail } from "../content/public-content-read/owner";
import type { PublicContentSummary } from "../content/public-content-read/contract";
import { isMediaContentType, type MediaContentItem } from "./types";

/** Media is a presentation adapter over Unified Content's normalized output. */
export function adaptPublicContentToMediaItem(
  item: PublicContentSummary | PublicContentDetail,
): MediaContentItem | null {
  if (!isMediaContentType(item.contentType)) return null;
  const detail = "content" in item ? item : null;

  return {
    id: String(item.id),
    topicId: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    category: item.category,
    categorySlug: item.categorySlug || undefined,
    series: item.series || undefined,
    seriesSlug: item.seriesSlug || undefined,
    date: item.date,
    publishedAt: item.publishedAt,
    image: item.image,
    type: item.contentType,
    featured: item.isFeatured,
    isPopular: item.isPopular,
    project: item.mediaProject || undefined,
    duration: item.mediaDuration || detail?.videoDuration || undefined,
    videoUrl: detail?.videoUrl || undefined,
    content: detail?.content,
    galleryImages:
      item.contentType === "gallery" && detail
        ? detail.galleryImages
        : undefined,
    seoTitle: detail?.seoTitle || undefined,
    seoDescription: detail?.seoDescription || undefined,
    focusKeyword: detail?.focusKeyword || undefined,
    seoKeywords: detail?.seoKeywords.length ? detail.seoKeywords : undefined,
    canonicalUrl: detail?.canonicalUrl || undefined,
    robotsIndex: detail?.robotsIndex ?? null,
    robotsFollow: detail?.robotsFollow ?? null,
    imageAlt: item.imageAlt || undefined,
    ogImage: detail?.ogImage || undefined,
    ogImageAlt: detail?.ogImageAlt || undefined,
    showTitleOnPage: item.display.title,
    showImageOnPage: item.display.image,
    showExcerptOnPage: item.display.excerpt,
    showDateOnPage: item.display.date,
    showCategoryOnPage: item.display.category,
    showSeriesOnPage: item.display.series,
    showIntroCardOnPage: item.display.introCard,
  };
}
