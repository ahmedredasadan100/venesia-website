import "server-only";

import { isPageModulePubliclyVisible } from "../page-blocks/admin-utils";
import { getPublishedPageStateBySlug } from "../pages/get-published-page-by-slug";
import { getSupabaseAdmin } from "../supabase-admin";
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

/** Internal query used only by the canonical Page Composition resolver. */
export async function queryMediaSidebarModules(pageSlug: string): Promise<MediaSidebarModulesState> {
  const pageState = await getPublishedPageStateBySlug(pageSlug);
  if (!pageState.page) {
    return {
      widgets: [],
      sourceStatus: pageState.sourceStatus,
      sourceIssues: pageState.sourceIssue ? [pageState.sourceIssue] : [],
      hasAnyAssignmentRows: false,
      hasRenderableModules: false,
    };
  }

  const { data: rows, error } = await getSupabaseAdmin()
    .from("page_media_sidebar_module_assignments")
    .select("id,sort_order,is_visible,media_sidebar_module_templates(widget_key,name,status,config)")
    .eq("page_id", pageState.page.id)
    .eq("slot", "sidebar")
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      widgets: [],
      sourceStatus: "error",
      sourceIssues: [error.message],
      hasAnyAssignmentRows: false,
      hasRenderableModules: false,
    };
  }

  const widgets: MediaSidebarWidgetState[] = [];
  for (const row of rows ?? []) {
    const template = joinedTemplate(row.media_sidebar_module_templates);
    if (
      !template ||
      !isPageModulePubliclyVisible(true, template.status) ||
      !isWidgetKey(template.widget_key)
    ) continue;
    widgets.push({
      widgetKey: template.widget_key,
      assignmentId: row.id,
      sortOrder: row.sort_order,
      isVisible: isPageModulePubliclyVisible(row.is_visible, template.status),
      title: template.name,
      config: parseMediaSidebarModuleConfig(template.config, template.widget_key),
    });
  }

  return enrichMediaSidebarModules({
    widgets,
    sourceStatus: "database",
    sourceIssues: [],
    hasAnyAssignmentRows: (rows?.length ?? 0) > 0,
    hasRenderableModules: widgets.some((widget) => widget.isVisible),
  });
}
