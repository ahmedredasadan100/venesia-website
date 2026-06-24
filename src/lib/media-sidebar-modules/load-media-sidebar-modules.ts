import "server-only";

import { normalizeBoolean } from "../page-blocks/admin-utils";
import { getSupabaseAdmin } from "../supabase-admin";
import type { MediaCenterCmsPageSlug } from "../media-center-page-config";
import { DEFAULT_MEDIA_SIDEBAR_MODULES } from "./defaults";
import { parseMediaSidebarModuleConfig } from "./parse-config";
import { enrichMediaSidebarModules } from "./resolve-widget-items";
import type { MediaSidebarModulesState, MediaSidebarWidgetKey, MediaSidebarWidgetState } from "./types";

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isWidgetKey(value: string): value is MediaSidebarWidgetKey {
  return value === "sections" || value === "latest" || value === "popular";
}

export async function loadMediaSidebarModules(pageSlug: string): Promise<MediaSidebarModulesState> {
  const { data: page } = await getSupabaseAdmin().from("pages").select("id").eq("slug", pageSlug).maybeSingle();

  if (!page) {
    return DEFAULT_MEDIA_SIDEBAR_MODULES;
  }

  const { data: rows, error } = await getSupabaseAdmin()
    .from("page_media_sidebar_module_assignments")
    .select("id,sort_order,is_visible,media_sidebar_module_templates(widget_key,name,status,config)")
    .eq("page_id", page.id)
    .eq("slot", "sidebar")
    .order("sort_order", { ascending: true });

  if (error || !rows?.length) {
    return DEFAULT_MEDIA_SIDEBAR_MODULES;
  }

  const widgets: MediaSidebarWidgetState[] = [];

  for (const row of rows) {
    const template = joinedTemplate(row.media_sidebar_module_templates) as {
      widget_key: string;
      name: string;
      status: string;
      config: unknown;
    } | null;

    if (!template || template.status !== "published" || !isWidgetKey(template.widget_key)) {
      continue;
    }

    widgets.push({
      widgetKey: template.widget_key,
      assignmentId: row.id,
      sortOrder: row.sort_order,
      isVisible: normalizeBoolean(row.is_visible, true),
      title: template.name,
      config: parseMediaSidebarModuleConfig(template.config, template.widget_key),
    });
  }

  return {
    widgets,
    usesFallback: false,
  };
}

export async function loadMediaCenterSidebarProps(cmsPageSlug: MediaCenterCmsPageSlug) {
  const sidebarModules = await enrichMediaSidebarModules(await loadMediaSidebarModules(cmsPageSlug));
  const latestWidget = sidebarModules.widgets.find((widget) => widget.widgetKey === "latest");
  const popularWidget = sidebarModules.widgets.find((widget) => widget.widgetKey === "popular");

  return {
    latestNewsSidebar: latestWidget?.items ?? [],
    popularMediaSidebarItems: popularWidget?.items ?? [],
    sidebarModules,
  };
}
