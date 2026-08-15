import "server-only";

import {
  isPublishedPageBlockStatus,
  normalizeBoolean,
} from "../page-blocks/admin-utils";
import { getPublishedPageStateBySlug } from "../pages/get-published-page-by-slug";
import { getSupabaseAdmin } from "../supabase-admin";
import { parseMediaHubModuleConfig } from "./parse-config";
import { enrichMediaHubModules } from "./resolve-hub-section-data";
import type { MediaHubModuleState, MediaHubModulesState, MediaHubSectionKey } from "./types";

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isSectionKey(value: string): value is MediaHubSectionKey {
  return value === "featured" || value === "site-updates" || value === "videos" || value === "gallery" || value === "press";
}

/** Internal query used only by the canonical Page Composition resolver. */
export async function queryMediaHubModules(
  pageSlug: string,
  options: { enrich?: boolean } = {},
): Promise<MediaHubModulesState> {
  const pageState = await getPublishedPageStateBySlug(pageSlug);
  if (!pageState.page) {
    return {
      modules: [],
      sourceStatus: pageState.sourceStatus,
      sourceIssues: pageState.sourceIssue ? [pageState.sourceIssue] : [],
    };
  }

  const { data: rows, error } = await getSupabaseAdmin()
    .from("page_media_hub_module_assignments")
    .select("id,sort_order,is_visible,media_hub_module_templates(section_key,name,slug,status,config)")
    .eq("page_id", pageState.page.id)
    .eq("slot", "main")
    .order("sort_order", { ascending: true });

  if (error) return { modules: [], sourceStatus: "error", sourceIssues: [error.message] };

  const modules: MediaHubModuleState[] = [];
  for (const row of rows ?? []) {
    const template = joinedTemplate(row.media_hub_module_templates);
    if (!template || !isPublishedPageBlockStatus(template.status) || !isSectionKey(template.section_key)) continue;
    modules.push({
      sectionKey: template.section_key,
      assignmentId: row.id,
      sortOrder: row.sort_order,
      isVisible: normalizeBoolean(row.is_visible, true),
      title: template.name,
      templateSlug: template.slug,
      config: parseMediaHubModuleConfig(template.config, template.section_key),
    });
  }

  const state = { modules, sourceStatus: "database" as const, sourceIssues: [] };
  return options.enrich === false ? state : enrichMediaHubModules(state);
}
