import "server-only";

import {
  isPublishedPageBlockStatus,
  normalizeBoolean,
} from "../page-blocks/admin-utils";
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
  const pageResult = await getSupabaseAdmin().from("pages").select("id").eq("slug", pageSlug).maybeSingle();
  if (pageResult.error) {
    return { widgets: [], sourceStatus: "error", sourceIssues: [pageResult.error.message] };
  }
  if (!pageResult.data) {
    return { widgets: [], sourceStatus: "missing", sourceIssues: [`Page ${pageSlug} is not persisted.`] };
  }

  const { data: rows, error } = await getSupabaseAdmin()
    .from("page_media_sidebar_module_assignments")
    .select("id,sort_order,is_visible,media_sidebar_module_templates(widget_key,name,status,config)")
    .eq("page_id", pageResult.data.id)
    .eq("slot", "sidebar")
    .order("sort_order", { ascending: true });

  if (error) return { widgets: [], sourceStatus: "error", sourceIssues: [error.message] };

  const widgets: MediaSidebarWidgetState[] = [];
  for (const row of rows ?? []) {
    const template = joinedTemplate(row.media_sidebar_module_templates) as {
      widget_key: string; name: string; status: string; config: unknown;
    } | null;
    if (!template || !isPublishedPageBlockStatus(template.status) || !isWidgetKey(template.widget_key)) continue;
    widgets.push({
      widgetKey: template.widget_key,
      assignmentId: row.id,
      sortOrder: row.sort_order,
      isVisible: normalizeBoolean(row.is_visible, true),
      title: template.name,
      config: parseMediaSidebarModuleConfig(template.config, template.widget_key),
    });
  }

  return enrichMediaSidebarModules({ widgets, sourceStatus: "database", sourceIssues: [] });
}
