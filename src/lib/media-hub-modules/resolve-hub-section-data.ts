import "server-only";

import type { MediaContentItem, MediaContentType } from "../media-center";
import { getMediaItems } from "../media-center";
import { parseMediaHubModuleConfig, type MediaHubModuleConfig } from "./parse-config";
import type { MediaHubModulesState, MediaHubSectionData, MediaHubSectionKey } from "./types";

type HubDataCaches = {
  featuredNews: MediaContentItem | null;
  news: MediaContentItem[];
  siteUpdates: MediaContentItem[];
  videos: MediaContentItem[];
  gallery: MediaContentItem[];
  press: MediaContentItem[];
};

const SECTION_MEDIA_TYPE: Record<MediaHubSectionKey, MediaContentType> = {
  featured: "news",
  "site-updates": "site_update",
  videos: "video",
  gallery: "gallery",
  press: "press",
};

async function loadHubDataCaches(state: MediaHubModulesState): Promise<HubDataCaches> {
  const requiredTypes = Array.from(
    new Set(
      state.modules
        .filter((module) => module.isVisible)
        .map((module) => SECTION_MEDIA_TYPE[module.sectionKey]),
    ),
  );
  const entries = await Promise.all(
    requiredTypes.map(async (type) => [type, await getMediaItems(type)] as const),
  );
  const itemsByType = new Map<MediaContentType, MediaContentItem[]>(entries);

  const news = itemsByType.get("news") ?? [];
  const siteUpdates = itemsByType.get("site_update") ?? [];
  const videos = itemsByType.get("video") ?? [];
  const gallery = itemsByType.get("gallery") ?? [];
  const press = itemsByType.get("press") ?? [];

  const featuredNews = news.find((item) => item.featured) ?? news[0] ?? null;
  return { featuredNews, news, siteUpdates, videos, gallery, press };
}

function resolveSectionData(
  sectionKey: MediaHubSectionKey,
  config: MediaHubModuleConfig,
  caches: HubDataCaches,
): MediaHubSectionData | null {
  if (sectionKey === "featured") {
    if (!caches.featuredNews) return null;

    return {
      kind: "featured",
      featuredNews: caches.featuredNews,
      latestNews: caches.news.slice(0, config.listLimit ?? 4),
      sideLimit: config.sideLimit ?? 3,
    };
  }

  if (sectionKey === "site-updates") {
    return {
      kind: "site-updates",
      items: caches.siteUpdates.slice(0, config.limit ?? 4),
    };
  }

  if (sectionKey === "videos") {
    return {
      kind: "videos",
      items: caches.videos.slice(0, config.limit ?? 4),
    };
  }

  if (sectionKey === "gallery") {
    return {
      kind: "gallery",
      items: caches.gallery.slice(0, config.limit ?? 8),
    };
  }

  const pressLimit = config.limit ?? caches.press.length;
  return {
    kind: "press",
    items: caches.press.slice(0, pressLimit),
  };
}

export async function enrichMediaHubModules(state: MediaHubModulesState): Promise<MediaHubModulesState> {
  const caches = await loadHubDataCaches(state);

  const modules = state.modules.map((module) => {
    const config = parseMediaHubModuleConfig(module.config, module.sectionKey);
    const sectionData = resolveSectionData(module.sectionKey, config, caches);

    return {
      ...module,
      config,
      sectionData,
    };
  });

  return { ...state, modules };
}

export type { MediaHubSectionData } from "./types";
