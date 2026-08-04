import type { MetadataRoute } from "next";

import { loadGlobalSeoSettings } from "../lib/seo/load-global-seo-settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const global = await loadGlobalSeoSettings();
  const baseUrl = (global.canonicalBaseUrl || global.siteUrl).replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: global.robotsTxtAllow,
        disallow: global.robotsTxtDisallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
