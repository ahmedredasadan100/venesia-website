import { SEO_SITE } from "./seo/seo-site";

/** Swap final brand assets by replacing files at these paths only. */
export const PWA_ICON_PATHS = {
  icon192: "/icons/icon-192.png",
  icon512: "/icons/icon-512.png",
  appleTouch: "/apple-touch-icon.png",
  faviconIco: "/favicon.ico",
  faviconSvg: "/favicon.svg",
  favicon96: "/favicon-96x96.png",
  manifest: "/manifest.webmanifest",
} as const;

export const PWA_CONFIG = {
  name: SEO_SITE.name,
  shortName: "Venesia",
  description: SEO_SITE.tagline,
  startUrl: "/",
  scope: "/",
  display: "standalone" as const,
  backgroundColor: "#0B0B0B",
  themeColor: SEO_SITE.themeColor,
  lang: SEO_SITE.language,
  dir: SEO_SITE.direction,
  icons: PWA_ICON_PATHS,
  serviceWorkerPath: "/sw.js",
  install: {
    delayMs: 10_000,
    dismissDays: 7,
    storageKey: "venesia-pwa-install-dismissed-at",
  },
} as const;

export type PwaIconPaths = typeof PWA_ICON_PATHS;
