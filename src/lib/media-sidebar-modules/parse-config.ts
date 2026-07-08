import type { MediaSidebarWidgetKey } from "./types";

export type MediaSidebarModuleConfig = {
  source: "navigation" | "media_items";
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
    config: { source: "media_items", type: "news", limit: 3 },
    defaultLimit: 3,
  },
  popular: {
    config: { source: "media_items", isPopular: true, limit: 4 },
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
  raw: unknown,
  widgetKey: MediaSidebarWidgetKey,
): MediaSidebarModuleConfig {
  const fallback = MEDIA_SIDEBAR_WIDGET_DEFAULTS[widgetKey].config;
  if (!raw || typeof raw !== "object") return { ...fallback };

  const value = raw as Record<string, unknown>;

  if (widgetKey === "sections") {
    return {
      source: "navigation",
      menuParent: typeof value.menuParent === "string" && value.menuParent.trim() ? value.menuParent.trim() : "/media-center",
    };
  }

  if (widgetKey === "latest") {
    const limit = Number(value.limit);
    return {
      source: "media_items",
      type: "news",
      limit: Number.isFinite(limit) && limit > 0 ? limit : fallback.limit ?? 3,
    };
  }

  const limit = Number(value.limit);
  return {
    source: "media_items",
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
    if (dataSource !== "media_items") throw new Error("مصدر البيانات غير متوافق مع widget أحدث الأخبار.");
    return {
      source: "media_items",
      type: "news",
      limit: Math.max(1, limitValue || MEDIA_SIDEBAR_WIDGET_DEFAULTS.latest.defaultLimit || 3),
    };
  }

  if (dataSource !== "media_items") throw new Error("مصدر البيانات غير متوافق مع widget الأكثر قراءة.");
  return {
    source: "media_items",
    isPopular: true,
    limit: Math.max(1, limitValue || MEDIA_SIDEBAR_WIDGET_DEFAULTS.popular.defaultLimit || 4),
  };
}
