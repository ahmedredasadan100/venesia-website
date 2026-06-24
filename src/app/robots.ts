import type { MetadataRoute } from "next";
import { SEO_SITE } from "../config/seo/seo-site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/admin/",
          "/dashboard/",
          "/private/",
        ],
      },
    ],
    sitemap: `${SEO_SITE.defaultUrl}/sitemap.xml`,
    host: SEO_SITE.defaultUrl,
  };
}