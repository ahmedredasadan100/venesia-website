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
  title: string;
  eyebrow: string;
  subtitle: string;
  heroImage: string;
  heroImagePositionClassName?: string;
};

export const MEDIA_CENTER_CMS_PAGES: Record<MediaCenterCmsPageSlug, MediaCenterShellConfig> = {
  "media-center": {
    cmsPageSlug: "media-center",
    publicPath: "/media-center",
    title: "المركز الإعلامي",
    eyebrow: "Media Center",
    subtitle: "أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.",
    heroImage: "/images/venesia-5.png",
    heroImagePositionClassName: "object-[42%_36%]",
  },
  "media-center-news": {
    cmsPageSlug: "media-center-news",
    publicPath: "/media-center/news",
    title: "الأخبار",
    eyebrow: "News",
    subtitle: "آخر أخبار وتحديثات فينيسيا.",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-videos": {
    cmsPageSlug: "media-center-videos",
    publicPath: "/media-center/videos",
    title: "الفيديوهات",
    eyebrow: "Videos",
    subtitle: "لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-gallery": {
    cmsPageSlug: "media-center-gallery",
    publicPath: "/media-center/gallery",
    title: "معرض الصور",
    eyebrow: "Gallery",
    subtitle: "صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-press": {
    cmsPageSlug: "media-center-press",
    publicPath: "/media-center/press",
    title: "البيانات الصحفية",
    eyebrow: "Press",
    subtitle: "بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.",
    heroImage: "/images/venesia-5.png",
  },
  "media-center-site-updates": {
    cmsPageSlug: "media-center-site-updates",
    publicPath: "/media-center/site-updates",
    title: "تحديثات المواقع",
    eyebrow: "Site Updates",
    subtitle: "متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.",
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
