import { CONTENT_TYPES, type ContentType } from "../admin/content/content-types";
import { resolvePublicContentPath } from "../content/public-content-path";

export type MediaContentType = Exclude<ContentType, "article">;

export type MediaContentItem = {
  id: string;
  topicId?: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  series?: string;
  date: string;
  publishedAt: string;
  image: string;
  type: MediaContentType;
  featured?: boolean;
  isPopular?: boolean;
  project?: string;
  duration?: string;
  videoUrl?: string;
  content?: string[];
  /** Used by hero media_category filter — not rendered in public media UI. */
  categorySlug?: string;
  seriesSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  seoKeywords?: string[];
  canonicalUrl?: string;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
  imageAlt?: string;
  ogImage?: string;
  ogImageAlt?: string;
  showTitleOnPage: boolean;
  showImageOnPage: boolean;
  showExcerptOnPage: boolean;
  showDateOnPage: boolean;
  showCategoryOnPage: boolean;
  showSeriesOnPage: boolean;
  showIntroCardOnPage: boolean;
};

export type MediaNewsItem = MediaContentItem;

export type MediaSidebarItem = {
  title: string;
  date?: string;
  image: string;
  href: string;
  label?: string;
  seriesLabel?: string;
};

export const MEDIA_TYPE_PATHS: Record<MediaContentType, string> = {
  news: "news",
  video: "videos",
  gallery: "gallery",
  press: "press",
  site_update: "site-updates",
};

export const MEDIA_CONTENT_TYPES = CONTENT_TYPES.filter(
  (contentType): contentType is MediaContentType => contentType !== "article",
);

export function isMediaContentType(value: string | null | undefined): value is MediaContentType {
  return MEDIA_CONTENT_TYPES.includes(value as MediaContentType);
}

export function getMediaHref(item: Pick<MediaContentItem, "type" | "slug">) {
  return resolvePublicContentPath(item.type, item.slug);
}
