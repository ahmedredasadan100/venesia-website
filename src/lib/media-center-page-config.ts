/**
 * CMS page registry for Media Center shell routes.
 * Static hero props preserve the current UI when no hero assignment exists.
 */
export type MediaCenterCmsPageSlug =
  | "media-center"
  | "media-center-news"
  | "media-center-videos"
  | "media-center-gallery"
  | "media-center-press"
  | "media-center-site-updates";

export type MediaCenterShellConfig = {
  cmsPageSlug: MediaCenterCmsPageSlug;
  publicPath: string;
  heroImage: string;
};

export const MEDIA_CENTER_CMS_PAGES: Record<MediaCenterCmsPageSlug, MediaCenterShellConfig> = {
  "media-center": {
    cmsPageSlug: "media-center",
    publicPath: "/media-center",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-news": {
    cmsPageSlug: "media-center-news",
    publicPath: "/media-center/news",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-videos": {
    cmsPageSlug: "media-center-videos",
    publicPath: "/media-center/videos",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-gallery": {
    cmsPageSlug: "media-center-gallery",
    publicPath: "/media-center/gallery",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-press": {
    cmsPageSlug: "media-center-press",
    publicPath: "/media-center/press",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-site-updates": {
    cmsPageSlug: "media-center-site-updates",
    publicPath: "/media-center/site-updates",
    heroImage: "/images/venesia-5.png",
  },
};

export const MEDIA_CENTER_PUBLIC_PATHS = Object.values(MEDIA_CENTER_CMS_PAGES).map(
  (page) => page.publicPath,
);

export function getMediaCenterCmsPageConfig(slug: MediaCenterCmsPageSlug) {
  return MEDIA_CENTER_CMS_PAGES[slug];
}

export function isMediaCenterCmsPageSlug(slug: string): slug is MediaCenterCmsPageSlug {
  return slug in MEDIA_CENTER_CMS_PAGES;
}
