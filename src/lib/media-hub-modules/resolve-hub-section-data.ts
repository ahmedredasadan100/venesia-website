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
    current.items = true;
    if (
      moduleState.sectionKey === "featured" &&
      moduleState.config.contentHierarchy?.mode === "featured-first"
    ) {
      current.featured = true;
    }
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
  const itemLimit = config.itemLimit ?? 4;
  const hierarchyMode = config.contentHierarchy?.mode ?? "uniform";

  if (sectionKey === "featured") {
    const sourceItems = cache?.items ?? [];
    if (hierarchyMode !== "featured-first") {
      return { kind: "featured", items: sourceItems.slice(0, itemLimit) };
    }

    const primaryItem = cache?.featured ?? sourceItems[0];
    if (!primaryItem) return null;
    const secondaryItems = sourceItems
      .filter((item) => item.id !== primaryItem.id)
      .slice(0, Math.max(0, itemLimit - 1));

    return {
      kind: "featured",
      items: [primaryItem, ...secondaryItems],
    };
  }

  const items = cache?.items ?? [];

  if (sectionKey === "site-updates") {
    return {
      kind: "site-updates",
      items: items.slice(0, itemLimit),
    };
  }

  if (sectionKey === "videos") {
    return {
      kind: "videos",
      items: items.slice(0, itemLimit),
    };
  }

  if (sectionKey === "gallery") {
    return {
      kind: "gallery",
      items: items.slice(0, itemLimit),
    };
  }

  return {
    kind: "press",
    items: items.slice(0, itemLimit),
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
