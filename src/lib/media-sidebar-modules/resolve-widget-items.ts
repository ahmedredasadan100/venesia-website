import "server-only";

import { getMediaHref, getMediaItems, type MediaContentItem, type MediaSidebarItem } from "../media-center";
import { parseMediaSidebarModuleConfig, type MediaSidebarModuleConfig } from "./parse-config";
import type { MediaSidebarModulesState, MediaSidebarWidgetKey } from "./types";

function sortByNewest(items: MediaContentItem[]) {
  return [...items].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );
}

function mapMediaItemToSidebarItem(item: MediaContentItem, showLabel: boolean): MediaSidebarItem {
  return {
    title: item.title,
    date: item.date,
    image: item.image,
    href: getMediaHref(item),
    ...(showLabel && item.category ? { label: item.category } : {}),
  };
}

export function resolveLatestSidebarItems(items: MediaContentItem[], config: MediaSidebarModuleConfig): MediaSidebarItem[] {
  const limit = config.limit ?? 3;
  const newsItems = items.filter((item) => item.type === "news");
  return sortByNewest(newsItems)
    .slice(0, limit)
    .map((item) => mapMediaItemToSidebarItem(item, false));
}

export function resolvePopularSidebarItems(items: MediaContentItem[], config: MediaSidebarModuleConfig): MediaSidebarItem[] {
  const limit = config.limit ?? 4;
  const popularItems = items.filter((item) => item.isPopular);
  return sortByNewest(popularItems)
    .slice(0, limit)
    .map((item) => mapMediaItemToSidebarItem(item, true));
}

export async function enrichMediaSidebarModules(state: MediaSidebarModulesState): Promise<MediaSidebarModulesState> {
  const needsMediaItems = state.widgets.some(
    (widget) => widget.widgetKey === "latest" || widget.widgetKey === "popular",
  );

  const allItems = needsMediaItems ? await getMediaItems() : [];

  const widgets = state.widgets.map((widget) => {
    const config = parseMediaSidebarModuleConfig(widget.config, widget.widgetKey);

    if (widget.widgetKey === "latest") {
      return {
        ...widget,
        config,
        items: resolveLatestSidebarItems(allItems, config),
      };
    }

    if (widget.widgetKey === "popular") {
      return {
        ...widget,
        config,
        items: resolvePopularSidebarItems(allItems, config),
      };
    }

    return { ...widget, config };
  });

  return { ...state, widgets };
}

export function defaultConfigForWidget(widgetKey: MediaSidebarWidgetKey): MediaSidebarModuleConfig {
  return parseMediaSidebarModuleConfig(null, widgetKey);
}
