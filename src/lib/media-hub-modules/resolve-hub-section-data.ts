import "server-only";

import type { MediaContentItem, MediaContentType } from "../media-center";
import { getMediaItems } from "../media-center";
import { parseMediaHubModuleConfig, type MediaHubModuleConfig } from "./parse-config";
import type { MediaHubModulesState, MediaHubSectionData, MediaHubSectionKey } from "./types";

type HubDataCacheEntry = {
  items: MediaContentItem[];
};

type HubDataCaches = Map<MediaContentType, HubDataCacheEntry>;

async function loadHubDataCaches(state: MediaHubModulesState): Promise<HubDataCaches> {
  const requirements = new Map<MediaContentType, { items: boolean }>();
  for (const moduleState of state.modules) {
    if (
      !moduleState.isVisible ||
      moduleState.config.placement === "listing" ||
      moduleState.sectionKey === "featured" ||
      !moduleState.config.type
    ) continue;
    const current = requirements.get(moduleState.config.type) ?? { items: false };
    current.items = true;
    requirements.set(moduleState.config.type, current);
  }

  const entries = await Promise.all(
    [...requirements.entries()].map(async ([type, needs]) => {
      const items = needs.items ? await getMediaItems(type) : [];
      return [type, { items }] as const;
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
  // Legacy `featured` section keys remain parseable only for Media Listing
  // templates. Public featured selection/rendering is owned exclusively by
  // the standalone Featured Page Composition module.
  if (sectionKey === "featured") return null;
  const cache = caches.get(config.type);
  const itemLimit = config.itemLimit ?? 4;

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
