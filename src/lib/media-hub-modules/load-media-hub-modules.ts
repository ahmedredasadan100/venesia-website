import "server-only";

import { normalizeBoolean } from "../page-blocks/admin-utils";
import { getSupabaseAdmin } from "../supabase-admin";
import { DEFAULT_MEDIA_HUB_MODULES_STATE } from "./defaults";
import { parseMediaHubModuleConfig } from "./parse-config";
import { enrichMediaHubModules } from "./resolve-hub-section-data";
import type { MediaHubModuleState, MediaHubModulesState, MediaHubSectionKey } from "./types";

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isSectionKey(value: string): value is MediaHubSectionKey {
  return (
    value === "featured" ||
    value === "site-updates" ||
    value === "videos" ||
    value === "gallery" ||
    value === "press"
  );
}

export async function loadMediaHubModules(pageSlug: string): Promise<MediaHubModulesState> {
  const { data: page } = await getSupabaseAdmin().from("pages").select("id").eq("slug", pageSlug).maybeSingle();

  if (!page) {
    return enrichMediaHubModules(DEFAULT_MEDIA_HUB_MODULES_STATE);
  }

  const { data: rows, error } = await getSupabaseAdmin()
    .from("page_media_hub_module_assignments")
    .select("id,sort_order,is_visible,media_hub_module_templates(section_key,name,slug,status,config)")
    .eq("page_id", page.id)
    .eq("slot", "main")
    .order("sort_order", { ascending: true });

  if (error || !rows?.length) {
    return enrichMediaHubModules(DEFAULT_MEDIA_HUB_MODULES_STATE);
  }

  const modules: MediaHubModuleState[] = [];

  for (const row of rows) {
    const template = joinedTemplate(row.media_hub_module_templates) as {
      section_key: string;
      name: string;
      slug: string;
      status: string;
      config: unknown;
    } | null;

    if (!template || template.status !== "published" || !isSectionKey(template.section_key)) {
      continue;
    }

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

  if (!modules.length) {
    return enrichMediaHubModules(DEFAULT_MEDIA_HUB_MODULES_STATE);
  }

  return enrichMediaHubModules({
    modules,
    usesFallback: false,
  });
}
