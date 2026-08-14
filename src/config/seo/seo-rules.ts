import type { SeoRobotsDirective } from "./seo-types";

export const NO_INDEX_ROBOTS: SeoRobotsDirective = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    maxImagePreview: "none",
    maxSnippet: 0,
    maxVideoPreview: 0,
  },
};

export const SEO_DEFAULTS = {
  titleTemplate: "%s | Venesia Developments",
  fallbackTitle: "فينيسيا للتطوير العقاري | Venesia Developments",
  fallbackDescription:
    "فينيسيا للتطوير العقاري شركة تطوير عقاري مصرية توثق تنفيذ مشروعاتها خطوة بخطوة، من الأرض إلى التسليم، بثقة قائمة على الفعل لا الوعود.",
} as const;
