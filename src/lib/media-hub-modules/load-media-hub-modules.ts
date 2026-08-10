import "server-only";

import {
  isPublishedPageBlockStatus,
  normalizeBoolean,
} from "../page-blocks/admin-utils";
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
export async function queryMediaHubModules(pageSlug: string): Promise<MediaHubModulesState> {
  const pageResult = await getSupabaseAdmin().from("pages").select("id").eq("slug", pageSlug).maybeSingle();
  if (pageResult.error) {
    return { modules: [], sourceStatus: "error", sourceIssues: [pageResult.error.message] };
  }
  if (!pageResult.data) {
    return { modules: [], sourceStatus: "missing", sourceIssues: [`Page ${pageSlug} is not persisted.`] };
  }

  const { data: rows, error } = await getSupabaseAdmin()
    .from("page_media_hub_module_assignments")
    .select("id,sort_order,is_visible,media_hub_module_templates(section_key,name,slug,status,config)")
    .eq("page_id", pageResult.data.id)
    .eq("slot", "main")
    .order("sort_order", { ascending: true });

  if (error) return { modules: [], sourceStatus: "error", sourceIssues: [error.message] };

  const modules: MediaHubModuleState[] = [];
  for (const row of rows ?? []) {
    const template = joinedTemplate(row.media_hub_module_templates) as {
      section_key: string; name: string; slug: string; status: string; config: unknown;
    } | null;
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

  return enrichMediaHubModules({ modules, sourceStatus: "database", sourceIssues: [] });
}
