import type { MetadataRoute } from "next";

import { PWA_CONFIG } from "../config/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: PWA_CONFIG.startUrl,
    name: PWA_CONFIG.name,
    short_name: PWA_CONFIG.shortName,
    description: PWA_CONFIG.description,
    start_url: PWA_CONFIG.startUrl,
    scope: PWA_CONFIG.scope,
    display: PWA_CONFIG.display,
    background_color: PWA_CONFIG.backgroundColor,
    theme_color: PWA_CONFIG.themeColor,
    lang: PWA_CONFIG.lang,
    dir: PWA_CONFIG.dir,
    icons: [
      {
        src: PWA_CONFIG.icons.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_CONFIG.icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_CONFIG.icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
