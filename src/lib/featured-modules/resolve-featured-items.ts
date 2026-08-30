import "server-only";

import { loadPublicContentCollection } from "../content/public-content-read/owner";
import type { PublicContentSummary } from "../content/public-content-read/contract";
import type { FeaturedModuleConfig } from "./contract";
import { featuredSourceContentTypes } from "./contract";

export async function resolveFeaturedItems(
  config: FeaturedModuleConfig,
): Promise<PublicContentSummary[]> {
  if (config.selection.mode === "manual" && config.selection.topicIds.length === 0) {
    return [];
  }

  const manualIds = config.selection.mode === "manual"
    ? config.selection.topicIds.slice(0, config.itemLimit)
    : undefined;
  const result = await loadPublicContentCollection({
    contentTypes: featuredSourceContentTypes(config.source),
    categorySlugs:
      config.source.kind === "categories" ? [config.source.categorySlug] : [],
    featured: config.selection.mode === "automatic" ? "only" : "none",
    popularOnly: config.selection.mode === "popular",
    includeIds: manualIds,
    page: 1,
    pageSize: manualIds?.length ?? config.itemLimit,
    sort: "newest",
  });

  if (config.selection.mode === "automatic") return result.items;
  const byId = new Map(result.items.map((item) => [item.id, item]));
  return (manualIds ?? [])
    .flatMap((id) => byId.get(id) ?? [])
    .slice(0, config.itemLimit);
}
