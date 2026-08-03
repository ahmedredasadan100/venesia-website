export type MediaContentType =
  | "news"
  | "video"
  | "gallery"
  | "press"
  | "site-update";

export type MediaContentItem = {
  id: string;
  topicId?: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  publishedAt: string;
  image: string;
  type: MediaContentType;
  featured?: boolean;
  isPopular?: boolean;
  project?: string;
  duration?: string;
  content?: string[];
  /** Used by hero media_category filter — not rendered in public media UI. */
  categorySlug?: string;
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
};

export type MediaNewsItem = MediaContentItem;

export type MediaSidebarItem = {
  title: string;
  date: string;
  image: string;
  href: string;
  label?: string;
};

export const MEDIA_TYPE_PATHS: Record<MediaContentType, string> = {
  news: "news",
  video: "videos",
  gallery: "gallery",
  press: "press",
  "site-update": "site-updates",
};

export const MEDIA_CONTENT_TYPES: MediaContentType[] = [
  "news",
  "video",
  "gallery",
  "press",
  "site-update",
];

export function isMediaContentType(value: string | null | undefined): value is MediaContentType {
  return MEDIA_CONTENT_TYPES.includes(value as MediaContentType);
}

export function getMediaHref(item: Pick<MediaContentItem, "type" | "slug">) {
  const path = MEDIA_TYPE_PATHS[item.type] ?? "news";
  return `/media-center/${path}/${item.slug}`;
}
