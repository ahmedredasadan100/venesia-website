import type { Json } from "../database.types";
import type { MediaSidebarWidgetKey } from "./types";

export type MediaSidebarModuleConfig = {
  source: "navigation" | "topics";
  type?: "news";
  isPopular?: boolean;
  limit?: number;
  menuParent?: string;
};

export const MEDIA_SIDEBAR_WIDGET_DEFAULTS: Record<
  MediaSidebarWidgetKey,
  { config: MediaSidebarModuleConfig; defaultLimit?: number }
> = {
  sections: {
    config: { source: "navigation", menuParent: "/media-center" },
  },
  latest: {
    config: { source: "topics", type: "news", limit: 3 },
    defaultLimit: 3,
  },
  popular: {
    config: { source: "topics", isPopular: true, limit: 4 },
    defaultLimit: 4,
  },
};

export function isMediaSidebarWidgetKey(value: string): value is MediaSidebarWidgetKey {
  return value === "sections" || value === "latest" || value === "popular";
}

export function parseMediaSidebarWidgetKey(value: string): MediaSidebarWidgetKey {
  if (isMediaSidebarWidgetKey(value)) return value;
  throw new Error("نوع الـ widget غير صالح.");
}

export function parseMediaSidebarModuleConfig(
  raw: Json,
  widgetKey: MediaSidebarWidgetKey,
): MediaSidebarModuleConfig {
  const fallback = MEDIA_SIDEBAR_WIDGET_DEFAULTS[widgetKey].config;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };

  if (widgetKey === "sections") {
    return {
      source: "navigation",
      menuParent: typeof raw.menuParent === "string" && raw.menuParent.trim() ? raw.menuParent.trim() : "/media-center",
    };
  }

  if (widgetKey === "latest") {
    const limit = Number(raw.limit);
    return {
      source: "topics",
      type: "news",
      limit: Number.isFinite(limit) && limit > 0 ? limit : fallback.limit ?? 3,
    };
  }

  const limit = Number(raw.limit);
  return {
    source: "topics",
    isPopular: true,
    limit: Number.isFinite(limit) && limit > 0 ? limit : fallback.limit ?? 4,
  };
}

export function buildMediaSidebarModuleConfig(
  widgetKey: MediaSidebarWidgetKey,
  dataSource: string,
  limitValue: number,
): MediaSidebarModuleConfig {
  if (widgetKey === "sections") {
    return { source: "navigation", menuParent: "/media-center" };
  }

  if (widgetKey === "latest") {
    if (dataSource !== "topics") throw new Error("مصدر البيانات غير متوافق مع widget أحدث الأخبار.");
    return {
      source: "topics",
      type: "news",
      limit: Math.max(1, limitValue || MEDIA_SIDEBAR_WIDGET_DEFAULTS.latest.defaultLimit || 3),
    };
  }

  if (dataSource !== "topics") throw new Error("مصدر البيانات غير متوافق مع widget الأكثر قراءة.");
  return {
    source: "topics",
    isPopular: true,
    limit: Math.max(1, limitValue || MEDIA_SIDEBAR_WIDGET_DEFAULTS.popular.defaultLimit || 4),
  };
}
