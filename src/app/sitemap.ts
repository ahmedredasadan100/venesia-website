import type { MetadataRoute } from "next";

import { generateSitemapEntries, toMetadataSitemap } from "../lib/seo/generate-sitemap-entries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await generateSitemapEntries();
  if (result.error) {
    throw new Error(`Sitemap generation failed: ${result.error}`);
  }
  return toMetadataSitemap(result.entries);
}
