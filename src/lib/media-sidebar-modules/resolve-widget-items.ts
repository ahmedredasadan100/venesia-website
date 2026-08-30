import "server-only";

import {
  publicContentSourceContentTypes,
  type PublicContentSummary,
} from "../content/public-content-read/contract";
import { loadPublicContentCollection } from "../content/public-content-read/owner";
import { resolveContentItemDisplay } from "../page-blocks/configs";
import {
  parseMediaSidebarModuleConfig,
  type MediaSidebarContentSource,
  type MediaSidebarModuleConfig,
} from "./parse-config";
import type {
  MediaSidebarContentItem,
  MediaSidebarModulesState,
} from "./types";

type MediaSidebarContentConfig = Extract<
  MediaSidebarModuleConfig,
  { source: MediaSidebarContentSource }
>;

function isContentConfig(
  config: MediaSidebarModuleConfig,
): config is MediaSidebarContentConfig {
  return typeof config.source === "object";
}

export function resolveMediaSidebarItems(
  items: PublicContentSummary[],
  config: MediaSidebarContentConfig,
): MediaSidebarContentItem[] {
  return items.slice(0, config.limit).map((item) => ({
    id: item.id,
    href: item.href,
    title: item.title,
    image: item.image,
    imageAlt: item.imageAlt,
    category: item.category,
    series: item.series,
    excerpt: item.excerpt,
    date: item.date,
    display: resolveContentItemDisplay(config.display, item.display, {
      title: item.title,
      image: item.image,
      category: item.category,
      series: item.series,
      excerpt: item.excerpt,
      date: item.date,
    }),
  }));
}

export async function enrichMediaSidebarModules(
  state: MediaSidebarModulesState,
): Promise<MediaSidebarModulesState> {
  const widgets = await Promise.all(
    state.widgets.map(async (widget) => {
      const config = parseMediaSidebarModuleConfig(
        widget.config,
        widget.widgetKey,
      );
      if (!widget.isVisible || !isContentConfig(config)) {
        return { ...widget, config };
      }

      const result = await loadPublicContentCollection({
        contentTypes: publicContentSourceContentTypes(config.source),
        categorySlugs:
          config.source.kind === "categories"
            ? [config.source.categorySlug]
            : [],
        popularOnly: widget.widgetKey === "popular",
        page: 1,
        pageSize: config.limit,
        sort: "newest",
      });

      return {
        ...widget,
        config,
        items: resolveMediaSidebarItems(result.items, config),
      };
    }),
  );

  return { ...state, widgets };
}
