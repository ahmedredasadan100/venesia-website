import "server-only";

import type { MediaContentItem, MediaContentType } from "../media-center";
import { getFeaturedMediaItems, getMediaItems } from "../media-center";
import { parseMediaHubModuleConfig, type MediaHubModuleConfig } from "./parse-config";
import type { MediaHubModulesState, MediaHubSectionData, MediaHubSectionKey } from "./types";

type HubDataCacheEntry = {
  featured: MediaContentItem | null;
  items: MediaContentItem[];
};

type HubDataCaches = Map<MediaContentType, HubDataCacheEntry>;

async function loadHubDataCaches(state: MediaHubModulesState): Promise<HubDataCaches> {
  const requirements = new Map<MediaContentType, { featured: boolean; items: boolean }>();
  for (const moduleState of state.modules) {
    if (
      !moduleState.isVisible ||
      moduleState.config.placement === "listing" ||
      !moduleState.config.type
    ) continue;
    const current = requirements.get(moduleState.config.type) ?? { featured: false, items: false };
    if (moduleState.sectionKey === "featured") current.featured = true;
    else current.items = true;
    requirements.set(moduleState.config.type, current);
  }

  const entries = await Promise.all(
    [...requirements.entries()].map(async ([type, needs]) => {
      const [featuredItems, items] = await Promise.all([
        needs.featured ? getFeaturedMediaItems(type, 1) : Promise.resolve([]),
        needs.items ? getMediaItems(type) : Promise.resolve([]),
      ]);
      return [type, { featured: featuredItems[0] ?? null, items }] as const;
    }),
  );
  return new Map(entries);
}

function resolveSectionData(
  sectionKey: MediaHubSectionKey,
  config: MediaHubModuleConfig,
  caches: HubDataCaches,
): MediaHubSectionData | null {
  if (!config.type) return null;
  const cache = caches.get(config.type);

  if (sectionKey === "featured") {
    if (!cache?.featured) return null;

    return {
      kind: "featured",
      item: cache.featured,
    };
  }

  const items = cache?.items ?? [];

  if (sectionKey === "site-updates") {
    return {
      kind: "site-updates",
      items: items.slice(0, config.limit ?? 4),
    };
  }

  if (sectionKey === "videos") {
    return {
      kind: "videos",
      items: items.slice(0, config.limit ?? 4),
    };
  }

  if (sectionKey === "gallery") {
    return {
      kind: "gallery",
      items: items.slice(0, config.limit ?? 8),
    };
  }

  const pressLimit = config.limit ?? items.length;
  return {
    kind: "press",
    items: items.slice(0, pressLimit),
  };
}

export async function enrichMediaHubModules(state: MediaHubModulesState): Promise<MediaHubModulesState> {
  const caches = await loadHubDataCaches(state);

  const modules = state.modules.map((module) => {
    const config = parseMediaHubModuleConfig(module.config, module.sectionKey);
    const sectionData = config.placement === "listing"
      ? null
      : resolveSectionData(module.sectionKey, config, caches);

    return {
      ...module,
      config,
      sectionData,
    };
  });

  return { ...state, modules };
}

export type { MediaHubSectionData } from "./types";
