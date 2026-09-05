import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Json } from "../database.types";
import { logError, logWarn } from "../logging";
import { getPublishedPageStateBySlug } from "../pages/get-published-page-by-slug";
import { isPageModulePubliclyVisible } from "../page-blocks/admin-utils";
import { normalizeLayoutSlot } from "../page-blocks/layout-slots";
import { getSupabaseAdmin } from "../supabase-admin";
import { parseFeaturedModuleConfig } from "./config";
import { resolveFeaturedItems } from "./resolve-featured-items";
import type { FeaturedModuleTemplateRow } from "./contract";
import {
  buildFeaturedModuleCacheKey,
  FEATURED_MODULE_CACHE_CONTRACT_VERSION,
  normalizeFeaturedModuleLoadResult,
  rememberFeaturedPayloadRecovery,
  type FeaturedModuleLoadResult,
} from "./runtime-payload";

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isJsonObject(value: Json): value is Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const warnedPayloadRecoveries = new Set<string>();
const MAX_WARNED_PAYLOAD_RECOVERIES = 128;

export const loadFeaturedModuleStateForPageSlug = cache(
  async function loadFeaturedModuleStateForPageSlug(
    pageSlug: string,
  ): Promise<FeaturedModuleLoadResult> {
    const cachedState = await unstable_cache(
      () => queryFeaturedModuleStateForPageSlug(pageSlug),
      buildFeaturedModuleCacheKey(pageSlug),
      {
        revalidate: 300,
        tags: ["page-composition", "featured-modules", "public-content"],
      },
    )();
    const normalized = normalizeFeaturedModuleLoadResult(cachedState);
    for (const recovery of normalized.recoveries) {
      const recoveryKey = `${pageSlug}:${recovery.assignmentId ?? "payload"}:${recovery.fields.join(",")}`;
      if (
        !rememberFeaturedPayloadRecovery(
          warnedPayloadRecoveries,
          recoveryKey,
          MAX_WARNED_PAYLOAD_RECOVERIES,
        )
      ) {
        continue;
      }
      logWarn("Featured cached payload normalized", {
        pageSlug,
        assignmentId: recovery.assignmentId,
        recoveredFields: recovery.fields,
        cacheContractVersion: FEATURED_MODULE_CACHE_CONTRACT_VERSION,
      });
    }
    return normalized.state;
  },
);

async function queryFeaturedModuleStateForPageSlug(
  pageSlug: string,
): Promise<FeaturedModuleLoadResult> {
  const pageState = await getPublishedPageStateBySlug(pageSlug);
  if (!pageState.page) {
    return {
      modules: [],
      hasAnyAssignmentRows: false,
      hasCompositionError: pageState.sourceStatus === "error",
    };
  }

  const { data: assignments, error } = await getSupabaseAdmin()
    .from("page_featured_module_assignments")
    .select(
      "id,page_id,template_id,slot,sort_order,is_visible,featured_module_templates(id,name,slug,description,status,config,sort_order)",
    )
    .eq("page_id", pageState.page.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    logError("loadFeaturedModuleStateForPageSlug: assignments failed", error, {
      pageSlug,
    });
    return {
      modules: [],
      hasAnyAssignmentRows: false,
      hasCompositionError: true,
    };
  }

  const resolvable = (assignments ?? []).flatMap((row) => {
    const selectedTemplate = joinedTemplate(row.featured_module_templates);
    if (
      !selectedTemplate ||
      !isPageModulePubliclyVisible(row.is_visible, selectedTemplate.status)
    ) {
      return [];
    }
    const template: FeaturedModuleTemplateRow = {
      ...selectedTemplate,
      config: isJsonObject(selectedTemplate.config)
        ? selectedTemplate.config
        : null,
    };
    return [
      { row, template, config: parseFeaturedModuleConfig(template.config) },
    ];
  });

  const modules = await Promise.all(
    resolvable.map(async ({ row, template, config }) => ({
      assignmentId: row.id,
      templateId: template.id,
      sortOrder: row.sort_order ?? 0,
      slot: normalizeLayoutSlot(row.slot),
      source: config.source,
      selection: config.selection,
      itemLimit: config.itemLimit,
      itemsPerView: config.itemsPerView,
      display: config.display,
      displayFormatting: config.displayFormatting,
      navigation: config.navigation,
      presentation: config.presentation,
      items: await resolveFeaturedItems(config),
    })),
  );

  return {
    modules,
    hasAnyAssignmentRows: (assignments?.length ?? 0) > 0,
    hasCompositionError: false,
  };
}
