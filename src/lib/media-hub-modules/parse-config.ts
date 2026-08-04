import type { MediaHubSectionKey } from "./types";

export type MediaHubMediaType = "news" | "site_update" | "video" | "gallery" | "press";

export type MediaHubModuleConfig = {
  source: "topics";
  type?: MediaHubMediaType;
  featured?: boolean;
  limit?: number;
  sideLimit?: number;
  listLimit?: number;
};

export const MEDIA_HUB_SECTION_DEFAULTS: Record<
  MediaHubSectionKey,
  {
    config: MediaHubModuleConfig;
    defaultLimit?: number;
    defaultSideLimit?: number;
    defaultListLimit?: number;
  }
> = {
  featured: {
    config: { source: "topics", type: "news", featured: true, sideLimit: 3, listLimit: 4 },
    defaultSideLimit: 3,
    defaultListLimit: 4,
  },
  "site-updates": {
    config: { source: "topics", type: "site_update", limit: 4 },
    defaultLimit: 4,
  },
  videos: {
    config: { source: "topics", type: "video", limit: 4 },
    defaultLimit: 4,
  },
  gallery: {
    config: { source: "topics", type: "gallery", limit: 8 },
    defaultLimit: 8,
  },
  press: {
    config: { source: "topics", type: "press", limit: 6 },
    defaultLimit: 6,
  },
};

export function isMediaHubSectionKey(value: string): value is MediaHubSectionKey {
  return value in MEDIA_HUB_SECTION_DEFAULTS;
}

export function parseMediaHubSectionKey(value: string): MediaHubSectionKey {
  if (isMediaHubSectionKey(value)) return value;
  throw new Error("نوع السكشن غير صالح.");
}

function readLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseMediaHubModuleConfig(
  raw: unknown,
  sectionKey: MediaHubSectionKey,
): MediaHubModuleConfig {
  const fallback = MEDIA_HUB_SECTION_DEFAULTS[sectionKey].config;
  if (!raw || typeof raw !== "object") return { ...fallback };

  const value = raw as Record<string, unknown>;
  const source = value.source === "topics" ? "topics" : fallback.source;

  if (sectionKey === "featured") {
    return {
      source,
      type: "news",
      featured: true,
      sideLimit: readLimit(value.sideLimit, fallback.sideLimit ?? 3),
      listLimit: readLimit(value.listLimit, fallback.listLimit ?? 4),
    };
  }

  const mediaType = sectionKey === "site-updates" ? "site_update" : sectionKey;
  return {
    source,
    type: mediaType as MediaHubMediaType,
    limit: readLimit(value.limit, fallback.limit ?? MEDIA_HUB_SECTION_DEFAULTS[sectionKey].defaultLimit ?? 4),
  };
}

export function buildMediaHubModuleConfig(
  sectionKey: MediaHubSectionKey,
  dataSource: string,
  limits: { limit?: number; sideLimit?: number; listLimit?: number },
): MediaHubModuleConfig {
  if (dataSource !== "topics") {
    throw new Error("مصدر البيانات غير مدعوم حاليًا.");
  }

  if (sectionKey === "featured") {
    const defaults = MEDIA_HUB_SECTION_DEFAULTS.featured;
    return {
      source: "topics",
      type: "news",
      featured: true,
      sideLimit: Math.max(1, limits.sideLimit || defaults.defaultSideLimit || 3),
      listLimit: Math.max(1, limits.listLimit || defaults.defaultListLimit || 4),
    };
  }

  const defaults = MEDIA_HUB_SECTION_DEFAULTS[sectionKey];
  return {
    source: "topics",
    type: (sectionKey === "site-updates" ? "site_update" : sectionKey) as MediaHubMediaType,
    limit: Math.max(1, limits.limit || defaults.defaultLimit || 4),
  };
}
