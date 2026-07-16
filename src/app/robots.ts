import type { MetadataRoute } from "next";

import { resolveCanonicalBaseUrl } from "../lib/seo/generate-sitemap-entries";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await resolveCanonicalBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/admin/",
          "/maintenance/",
          "/dashboard/",
          "/private/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
