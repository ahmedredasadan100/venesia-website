import type { MetadataRoute } from "next";

import type { SitemapGenerationResult } from "./sitemap-monitor-types";

/**
 * Public route output for the existing Sitemap capability.
 *
 * Source failures are already captured and logged by the generator. The route
 * must preserve the generator's partial-result contract instead of replacing a
 * usable sitemap with a 500 response.
 */
export function resolveSitemapRouteOutput(
  result: SitemapGenerationResult,
): MetadataRoute.Sitemap {
  return result.entries.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency ?? "monthly",
    priority: entry.priority ?? 0.7,
  }));
}
