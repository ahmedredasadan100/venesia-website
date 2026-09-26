import { connection } from "next/server";
import type { MetadataRoute } from "next";

import { generateSitemapEntries } from "../lib/seo/generate-sitemap-entries";
import { resolveSitemapRouteOutput } from "../lib/seo/sitemap-output-contract";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const result = await generateSitemapEntries();
  return resolveSitemapRouteOutput(result);
}
