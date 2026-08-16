import "server-only";

import type { MediaContentItem, MediaContentType } from "../media-center";
import { getMediaItems, getMediaListingPage } from "../media-center";
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
  const needsFeaturedNews = state.modules.some(
    (module) => module.isVisible && module.sectionKey === "featured",
  );
  const requiredTypes = Array.from(
    new Set(
      state.modules
        .filter((module) => module.isVisible)
        .map((module) => SECTION_MEDIA_TYPE[module.sectionKey]),
    ),
  );
  const entries = await Promise.all(requiredTypes.map(async (type) => {
    if (type === "news" && needsFeaturedNews) {
      const collection = await getMediaListingPage({
        type,
        page: 1,
        pageSize: 60,
        sort: "newest",
        featuredSelection: { mode: "automatic" },
      });
      return [type, { items: collection.items, featured: collection.featured }] as const;
    }
    return [type, { items: await getMediaItems(type), featured: null }] as const;
  }));
  const collectionsByType = new Map(entries);

  const newsCollection = collectionsByType.get("news");
  const news = newsCollection?.items ?? [];
  const siteUpdates = collectionsByType.get("site_update")?.items ?? [];
  const videos = collectionsByType.get("video")?.items ?? [];
  const gallery = collectionsByType.get("gallery")?.items ?? [];
  const press = collectionsByType.get("press")?.items ?? [];

  const featuredNews = newsCollection?.featured ?? null;
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
