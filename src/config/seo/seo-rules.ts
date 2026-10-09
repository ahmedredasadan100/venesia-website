import type { SeoRobotsDirective } from "./seo-types";

export const NO_INDEX_ROBOTS: SeoRobotsDirective = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    "max-image-preview": "none",
    "max-snippet": 0,
    "max-video-preview": 0,
  },
};

export const SEO_DEFAULTS = {
  fallbackTitle: "الموقع",
  fallbackDescription: "",
} as const;

/** Existing public output policy; separate from authored-field validation limits. */
export const SEO_OUTPUT_LIMITS = { title: 65, description: 165 } as const;
