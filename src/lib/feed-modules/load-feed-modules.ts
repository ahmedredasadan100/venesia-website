import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import type { Json } from "../database.types";
import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { PublicContentReadError } from "../content/public-content-read/owner";
import { getPublishedPageStateBySlug } from "../pages/get-published-page-by-slug";
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

class FeedModuleLoadFailure extends Error {
  readonly result: FeedModuleLoadResult;
  readonly sourceError: unknown;

  constructor(result: FeedModuleLoadResult, sourceError: unknown) {
    super("Feed module source read failed.");
    this.name = "FeedModuleLoadFailure";
    this.result = result;
    this.sourceError = sourceError;
  }
}

function normalizeExcludeContentIds(ids: readonly number[]) {
  return [...new Set(ids.filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  ))].sort((left, right) => left - right);
}

export const loadFeedModuleStateForPageSlug = cache(async function loadFeedModuleStateForPageSlug(
  pageSlug: string,
  excludeContentIds: readonly number[] = [],
): Promise<FeedModuleLoadResult> {
  const normalizedExcludeIds = normalizeExcludeContentIds(excludeContentIds);
  try {
    return await unstable_cache(
      async () => queryFeedModuleStateForPageSlug(pageSlug, normalizedExcludeIds),
      ["feed-module-state-v2", pageSlug, JSON.stringify(normalizedExcludeIds)],
      { revalidate: 300, tags: ["page-composition", "feed-modules"] },
    )();
  } catch (error) {
    if (!(error instanceof FeedModuleLoadFailure)) throw error;
    logError("loadFeedModulesForPageSlug: public read failed", error.sourceError, {
      pageSlug,
      excludeContentIds: normalizedExcludeIds,
    });
    return error.result;
  }
});

export const loadFeedModulesForPageSlug = cache(async function loadFeedModulesForPageSlug(
  pageSlug: string,
): Promise<LoadedFeedModule[]> {
  const state = await loadFeedModuleStateForPageSlug(pageSlug);
  return state.modules;
});

async function queryFeedModuleStateForPageSlug(
  pageSlug: string,
  excludeContentIds: readonly number[],
): Promise<FeedModuleLoadResult> {
  const supabase = getSupabaseAdmin();

  const pageState = await getPublishedPageStateBySlug(pageSlug);
  if (!pageState.page) {
    const result = {
      modules: [],
      hasAnyAssignmentRows: false,
      hasCompositionError: pageState.sourceStatus === "error",
    };
    if (pageState.sourceStatus === "error") {
      throw new FeedModuleLoadFailure(result, pageState.sourceIssue);
    }
    return result;
  }
  const page = pageState.page;

  const { data: assignments, error: assignmentsError } = await supabase
    .from("page_feed_module_assignments")
    .select("id,page_id,template_id,slot,sort_order,is_visible,feed_module_templates(id,name,slug,description,status,feed_type,config,sort_order)")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (assignmentsError) {
    throw new FeedModuleLoadFailure(
      { modules: [], hasAnyAssignmentRows: false, hasCompositionError: true },
      assignmentsError,
    );
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

  let modules: LoadedFeedModule[];
  try {
    modules = await Promise.all(
      resolvableAssignments.map(async ({ row, template, config }): Promise<LoadedFeedModule> => {
        const payload = await resolveTopicsFeedModule(
          template,
          config,
          excludeContentIds,
        );

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
  } catch (error) {
    if (!(error instanceof PublicContentReadError)) throw error;
    throw new FeedModuleLoadFailure(
      { modules: [], hasAnyAssignmentRows, hasCompositionError: true },
      error,
    );
  }

  return {
    modules,
    hasAnyAssignmentRows,
    hasCompositionError: false,
  };
}
