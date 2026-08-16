import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import type { Json } from "../database.types";
import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { getPublishedPageBySlug } from "../pages/get-published-page-by-slug";
import {
  isPageModulePubliclyVisible,
} from "../page-blocks/admin-utils";
import { normalizeLayoutSlot } from "../page-blocks/layout-slots";
import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import { parseFeedModuleConfig } from "./parse-feed-config";
import { resolveTopicsFeedModule } from "./resolve-topics-feed";
import {
  TOPICS_FEED_TYPES,
  type FeedModuleTemplateRow,
  type ResolvedFeedModule,
  type TopicsFeedType,
} from "./types";

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isJsonObject(value: Json): value is Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findTopicsFeedType(value: string): TopicsFeedType | null {
  return TOPICS_FEED_TYPES.find((candidate) => candidate === value) ?? null;
}

export type LoadedFeedModule = ResolvedFeedModule & {
  slot: PageLayoutSlot;
};

export type FeedModuleLoadResult = {
  modules: LoadedFeedModule[];
  /** Assignment rows exist before visibility / published filters. */
  hasAnyAssignmentRows: boolean;
  /** Query failed — do not treat as empty CMS. */
  hasCompositionError: boolean;
};

export const loadFeedModuleStateForPageSlug = cache(async function loadFeedModuleStateForPageSlug(
  pageSlug: string,
): Promise<FeedModuleLoadResult> {
  return unstable_cache(
    async () => queryFeedModuleStateForPageSlug(pageSlug),
    ["feed-module-state", pageSlug],
    { revalidate: 300, tags: ["page-composition", "feed-modules"] },
  )();
});

export const loadFeedModulesForPageSlug = cache(async function loadFeedModulesForPageSlug(
  pageSlug: string,
): Promise<LoadedFeedModule[]> {
  const state = await loadFeedModuleStateForPageSlug(pageSlug);
  return state.modules;
});

async function queryFeedModuleStateForPageSlug(pageSlug: string): Promise<FeedModuleLoadResult> {
  const supabase = getSupabaseAdmin();

  const page = await getPublishedPageBySlug(pageSlug);
  if (!page) {
    return { modules: [], hasAnyAssignmentRows: false, hasCompositionError: false };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("page_feed_module_assignments")
    .select("id,page_id,template_id,slot,sort_order,is_visible,feed_module_templates(id,name,slug,description,status,feed_type,config,sort_order)")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (assignmentsError) {
    logError("loadFeedModulesForPageSlug: assignments failed", assignmentsError, { pageSlug });
    return { modules: [], hasAnyAssignmentRows: false, hasCompositionError: true };
  }

  const hasAnyAssignmentRows = (assignments?.length ?? 0) > 0;

  const resolvableAssignments = (assignments ?? []).flatMap((row) => {
    const selectedTemplate = joinedTemplate(row.feed_module_templates);
    if (!selectedTemplate) return [];

    const feedType = findTopicsFeedType(selectedTemplate.feed_type);
    if (!feedType) return [];

    const template: FeedModuleTemplateRow = {
      ...selectedTemplate,
      feed_type: feedType,
      config: isJsonObject(selectedTemplate.config) ? selectedTemplate.config : null,
    };
    if (!isPageModulePubliclyVisible(row.is_visible, template.status)) return [];

    const config = parseFeedModuleConfig(template.config, template.feed_type);
    return [{ row, template, config }];
  });

  const modules = await Promise.all(
    resolvableAssignments.map(async ({ row, template, config }): Promise<LoadedFeedModule> => {
      const payload = await resolveTopicsFeedModule(template, config);

      return {
        assignmentId: row.id,
        templateId: template.id,
        sortOrder: row.sort_order ?? 0,
        feedType: template.feed_type,
        presentation: config.presentation,
        payload,
        slot: normalizeLayoutSlot(row.slot),
      };
    }),
  );

  return {
    modules,
    hasAnyAssignmentRows,
    hasCompositionError: false,
  };
}
