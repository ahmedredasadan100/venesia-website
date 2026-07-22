import type { ContentType } from "../admin/content/content-types";

const CONTENT_TYPE_PUBLIC_BASE: Record<ContentType, string> = {
  article: "/topics",
  news: "/media-center/news",
  press: "/media-center/press",
  site_update: "/media-center/site-updates",
  video: "/media-center/videos",
  gallery: "/media-center/gallery",
};

export function resolvePublicContentPath(contentType: ContentType, slug: string) {
  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "");
  const basePath = CONTENT_TYPE_PUBLIC_BASE[contentType];
  return normalizedSlug ? `${basePath}/${normalizedSlug}` : `${basePath}/your-slug`;
}
