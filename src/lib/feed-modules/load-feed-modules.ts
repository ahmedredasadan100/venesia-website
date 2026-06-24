import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { normalizeBoolean } from "../page-blocks/admin-utils";
import { normalizeLayoutSlot } from "../page-blocks/layout-slots";
import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import { parseFeedModuleConfig } from "./parse-feed-config";
import { resolveTopicsFeedModule } from "./resolve-topics-feed";
import type { FeedModuleTemplateRow, ResolvedFeedModule, TopicsFeedType } from "./types";

function isPublishedTemplate(status: string | null | undefined) {
  return status === "published";
}

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type LoadedFeedModule = ResolvedFeedModule & {
  slot: PageLayoutSlot;
};

export async function loadFeedModulesForPageSlug(pageSlug: string): Promise<LoadedFeedModule[]> {
  const supabase = getSupabaseAdmin();

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", pageSlug)
    .eq("status", "published")
    .maybeSingle();

  if (pageError) {
    logError("loadFeedModulesForPageSlug: page lookup failed", pageError, { pageSlug });
  }

  if (!page) return [];

  const { data: assignments, error: assignmentsError } = await supabase
    .from("page_feed_module_assignments")
    .select("id,page_id,template_id,slot,sort_order,is_visible,feed_module_templates(id,name,slug,description,status,feed_type,config,sort_order)")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (assignmentsError) {
    logError("loadFeedModulesForPageSlug: assignments failed", assignmentsError, { pageSlug });
    return [];
  }

  const modules: LoadedFeedModule[] = [];

  for (const row of assignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.feed_module_templates) as FeedModuleTemplateRow | null;
    if (!template || !isPublishedTemplate(template.status)) continue;

    const config = parseFeedModuleConfig(template.config);
    const payload = await resolveTopicsFeedModule(template, config);

    modules.push({
      assignmentId: row.id,
      templateId: template.id,
      sortOrder: row.sort_order ?? 0,
      feedType: template.feed_type as TopicsFeedType,
      presentation: config.presentation,
      payload,
      slot: normalizeLayoutSlot(row.slot),
    });
  }

  return modules;
}
