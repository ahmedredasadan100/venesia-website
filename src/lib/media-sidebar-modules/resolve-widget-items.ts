import "server-only";

import {
  getMediaHref,
  getMediaSidebarLatest,
  getMediaSidebarPopular,
  type MediaContentItem,
  type MediaSidebarItem,
} from "../media-center";
import { parseMediaSidebarModuleConfig, type MediaSidebarModuleConfig } from "./parse-config";
import type { MediaSidebarModulesState } from "./types";

function mapMediaItemToSidebarItem(item: MediaContentItem, showLabel: boolean): MediaSidebarItem {
  return {
    title: item.title,
    ...(item.showDateOnPage && item.date ? { date: item.date } : {}),
    image: item.image,
    href: getMediaHref(item),
    ...(showLabel && item.showCategoryOnPage && item.category ? { label: item.category } : {}),
    ...(showLabel && item.showSeriesOnPage && item.series ? { seriesLabel: item.series } : {}),
  };
}

export function resolveLatestSidebarItems(
  items: MediaContentItem[],
  config: MediaSidebarModuleConfig,
): MediaSidebarItem[] {
  const limit = config.limit ?? 3;
  return items.slice(0, limit).map((item) => mapMediaItemToSidebarItem(item, false));
}

export function resolvePopularSidebarItems(
  items: MediaContentItem[],
  config: MediaSidebarModuleConfig,
): MediaSidebarItem[] {
  const limit = config.limit ?? 4;
  return items.slice(0, limit).map((item) => mapMediaItemToSidebarItem(item, true));
}

export async function enrichMediaSidebarModules(
  state: MediaSidebarModulesState,
): Promise<MediaSidebarModulesState> {
  const latestWidget = state.widgets.find((widget) => widget.widgetKey === "latest");
  const popularWidget = state.widgets.find((widget) => widget.widgetKey === "popular");

  const latestLimit = latestWidget
    ? parseMediaSidebarModuleConfig(latestWidget.config, "latest").limit ?? 3
    : 0;
  const popularLimit = popularWidget
    ? parseMediaSidebarModuleConfig(popularWidget.config, "popular").limit ?? 4
    : 0;

  const [latestItems, popularItems] = await Promise.all([
    latestWidget ? getMediaSidebarLatest(latestLimit) : Promise.resolve([] as MediaContentItem[]),
    popularWidget ? getMediaSidebarPopular(popularLimit) : Promise.resolve([] as MediaContentItem[]),
  ]);

  const widgets = state.widgets.map((widget) => {
    const config = parseMediaSidebarModuleConfig(widget.config, widget.widgetKey);

    if (widget.widgetKey === "latest") {
      return {
        ...widget,
        config,
        items: resolveLatestSidebarItems(latestItems, config),
      };
    }

    if (widget.widgetKey === "popular") {
      return {
        ...widget,
        config,
        items: resolvePopularSidebarItems(popularItems, config),
      };
    }

    return { ...widget, config };
  });

  return { ...state, widgets };
}
