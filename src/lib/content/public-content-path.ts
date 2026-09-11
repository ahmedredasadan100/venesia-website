import type { ContentType } from "../admin/content/content-types";
import {
  getPublicDynamicPageRoute,
  getPublicPageRoute,
  interpolatePublicRoute,
  type PublicDynamicPageRouteKey,
  type PublicStaticPageRouteKey,
} from "../admin/links/static-routes";

const CONTENT_TYPE_ROUTE_KEYS = {
  article: { listing: "topics", detail: "topic-detail" },
  news: { listing: "media-news", detail: "media-news-detail" },
  press: { listing: "media-press", detail: "media-press-detail" },
  site_update: {
    listing: "media-site-updates",
    detail: "media-site-update-detail",
  },
  video: { listing: "media-videos", detail: "media-video-detail" },
  gallery: { listing: "media-gallery", detail: "media-gallery-detail" },
} as const satisfies Record<
  ContentType,
  { listing: PublicStaticPageRouteKey; detail: PublicDynamicPageRouteKey }
>;

export function resolvePublicContentPageRoute(contentType: ContentType) {
  return getPublicPageRoute(CONTENT_TYPE_ROUTE_KEYS[contentType].listing);
}

export function resolvePublicContentBasePath(contentType: ContentType) {
  return resolvePublicContentPageRoute(contentType).href;
}

export function resolvePublicContentPath(contentType: ContentType, slug: string) {
  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "") || "your-slug";
  const template = getPublicDynamicPageRoute(
    CONTENT_TYPE_ROUTE_KEYS[contentType].detail,
  ).href;

  return interpolatePublicRoute(template, { slug: normalizedSlug });
}
