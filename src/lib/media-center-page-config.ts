import {
  getPublicPageRoute,
  type PublicStaticPageRoute,
} from "./admin/links/static-routes";

const MEDIA_CENTER_ROUTE_KEYS = [
  "media-center",
  "media-news",
  "media-videos",
  "media-gallery",
  "media-press",
  "media-site-updates",
] as const;

type MediaCenterRouteKey = (typeof MEDIA_CENTER_ROUTE_KEYS)[number];
type MediaCenterRoute = Extract<PublicStaticPageRoute, { key: MediaCenterRouteKey }>;

export type MediaCenterCmsPageSlug = MediaCenterRoute["cmsPageSlug"];

export type MediaCenterShellConfig = {
  cmsPageSlug: MediaCenterCmsPageSlug;
  publicPath: string;
  heroImage: string;
};

const mediaCenterRoutes = MEDIA_CENTER_ROUTE_KEYS.map((key) =>
  getPublicPageRoute(key),
);

/** Media shell registry projected from the canonical public route owner. */
export const MEDIA_CENTER_CMS_PAGES = Object.fromEntries(
  mediaCenterRoutes.map((route) => [
    route.cmsPageSlug,
    {
      cmsPageSlug: route.cmsPageSlug,
      publicPath: route.href,
      heroImage: "/images/venesia-5.png",
    },
  ]),
) as Record<MediaCenterCmsPageSlug, MediaCenterShellConfig>;

export const MEDIA_CENTER_PUBLIC_PATHS = mediaCenterRoutes.map(
  (route) => route.href,
);

export function getMediaCenterCmsPageConfig(slug: MediaCenterCmsPageSlug) {
  return MEDIA_CENTER_CMS_PAGES[slug];
}

export function isMediaCenterCmsPageSlug(
  slug: string,
): slug is MediaCenterCmsPageSlug {
  return slug in MEDIA_CENTER_CMS_PAGES;
}
