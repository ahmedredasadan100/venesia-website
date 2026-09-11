import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { getPublishedPageStateBySlug } from "../pages/get-published-page-by-slug";
import { resolveHomeModuleSlugFromTemplate, type HomeModuleSlug } from "./home-module-slugs";
import {
  asBreadcrumbConfig,
  asCardsConfig,
  asCtaConfig,
  resolveContentBlockConfig,
} from "./configs";
import {
  resolveBreadcrumbBlockConfigLinks,
  resolveCardsBlockConfigLinks,
  resolveCtaBlockConfigLinks,
  resolveContentBlockConfigLinks,
} from "../admin/links/block-config-links";
import {
  isPageModulePubliclyVisible,
  isPublishedPageBlockStatus,
  normalizeBoolean,
  resolvePageModuleVisibilityFields,
} from "./admin-utils";
import { sortPageBlocks } from "./page-block-layout";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageBlockPublicState, PageBlockType, ResolvedPageBlock } from "./types";
import { isRetiredContentBlockTemplateSlug } from "./deprecated-block-modules";

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type PageBlockLoadResult = {
  blocks: ResolvedPageBlock[];
  /** Assignment + publication truth before public rendering filters. */
  blockStates: PageBlockPublicState[];
  /**
   * True when at least one assignment row exists for the page (any kind),
   * before visibility / published filters. Use this to decide CMS-managed layout
   * vs virgin static fallback.
   */
  hasAnyAssignmentRows: boolean;
  /**
   * True when at least one visible + published block can be rendered.
   * Prefer this name over hasAssignments for new call sites.
   */
  hasRenderableModules: boolean;
  /**
   * True when one or more assignment queries failed. Do not treat as "no data".
   */
  hasCompositionError: boolean;
  /**
   * @deprecated Alias of hasRenderableModules (post-filter). Prefer hasAnyAssignmentRows
   * when gating CMS vs static layout.
   */
  hasAssignments: boolean;
  hiddenHomeModuleSlugs: HomeModuleSlug[];
};

function emptyPageBlockLoadResult(hasCompositionError = false): PageBlockLoadResult {
  return {
    blocks: [],
    blockStates: [],
    hasAnyAssignmentRows: false,
    hasRenderableModules: false,
    hasCompositionError,
    hasAssignments: false,
    hiddenHomeModuleSlugs: [],
  };
}

type PageBlockReadFailure = {
  context: string;
  error: unknown;
  details: Record<string, unknown>;
};

class PageBlockStateReadError extends Error {
  constructor(
    readonly partialResult: PageBlockLoadResult,
    readonly failures: readonly PageBlockReadFailure[] = [],
  ) {
    super("Page block state read failed.");
    this.name = "PageBlockStateReadError";
  }
}

function appendBlockState(
  states: PageBlockPublicState[],
  blockType: PageBlockType,
  row: { id: number; is_visible: unknown },
  template: { id: number; slug: string; variant: string; status: string } | null,
) {
  if (!template) return;
  const visibility = resolvePageModuleVisibilityFields(
    row.is_visible,
    template.status,
  );
  states.push({
    assignmentId: row.id,
    blockType,
    templateId: template.id,
    templateSlug: template.slug,
    templateVariant: template.variant,
    templateStatus: template.status,
    templatePublished: isPublishedPageBlockStatus(template.status),
    assignmentVisible: visibility.is_visible,
    publiclyVisible: visibility.is_publicly_visible,
  });
}

/**
 * Loads Content / CTA / Cards blocks assigned to a page.
 * Hero is intentionally excluded — use getHeroSectionByPageSlug().
 */
export const loadPageBlockStateBySlug = cache(async function loadPageBlockStateBySlug(
  pageSlug: string,
): Promise<PageBlockLoadResult> {
  try {
    return await unstable_cache(
      async () => queryPageBlockStateBySlug(pageSlug),
      ["page-block-state-v4", pageSlug],
      { revalidate: 300, tags: ["page-composition", "page-blocks"] },
    )();
  } catch (error) {
    if (!(error instanceof PageBlockStateReadError)) {
      throw error;
    }

    for (const failure of error.failures) {
      logError(failure.context, failure.error, failure.details);
    }

    return error.partialResult;
  }
});

async function queryPageBlockStateBySlug(pageSlug: string): Promise<PageBlockLoadResult> {
  const supabase = getSupabaseAdmin();

  const pageState = await getPublishedPageStateBySlug(pageSlug);
  if (!pageState.page) {
    const result = emptyPageBlockLoadResult(pageState.sourceStatus === "error");
    if (pageState.sourceStatus === "error") {
      throw new PageBlockStateReadError(result);
    }
    return result;
  }
  const page = pageState.page;

  const blockPromises: Array<Promise<ResolvedPageBlock>> = [];
  const blockStates: PageBlockPublicState[] = [];
  const hiddenHomeModuleSlugs = new Set<HomeModuleSlug>();
  let assignmentRowCount = 0;

  const [
    { data: contentAssignments, error: contentError },
    { data: ctaAssignments, error: ctaError },
    { data: cardsAssignments, error: cardsError },
    { data: breadcrumbAssignments, error: breadcrumbError },
  ] = await Promise.all([
    supabase
      .from("page_content_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,content_block_templates(id,name,slug,description,variant,style_preset,status,config,sort_order)")
      .eq("page_id", page.id),
    supabase
      .from("page_cta_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,cta_block_templates(id,name,slug,description,variant,style_preset,status,config,sort_order)")
      .eq("page_id", page.id),
    supabase
      .from("page_cards_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,cards_block_templates(id,name,slug,description,variant,style_preset,status,config,sort_order)")
      .eq("page_id", page.id),
    supabase
      .from("page_breadcrumb_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,breadcrumb_block_templates(id,name,slug,description,variant,style_preset,status,config,sort_order)")
      .eq("page_id", page.id),
  ]);

  const assignmentFailures: PageBlockReadFailure[] = [];
  if (contentError) {
    assignmentFailures.push({
      context: "loadPageBlockStateBySlug: content assignments failed",
      error: contentError,
      details: { pageSlug },
    });
  }
  if (ctaError) {
    assignmentFailures.push({
      context: "loadPageBlockStateBySlug: cta assignments failed",
      error: ctaError,
      details: { pageSlug },
    });
  }
  if (cardsError) {
    assignmentFailures.push({
      context: "loadPageBlockStateBySlug: cards assignments failed",
      error: cardsError,
      details: { pageSlug },
    });
  }
  if (breadcrumbError) {
    assignmentFailures.push({
      context: "loadPageBlockStateBySlug: breadcrumb assignments failed",
      error: breadcrumbError,
      details: { pageSlug },
    });
  }
  const hasCompositionError = assignmentFailures.length > 0;

  assignmentRowCount += ctaAssignments?.length ?? 0;
  assignmentRowCount += cardsAssignments?.length ?? 0;
  assignmentRowCount += breadcrumbAssignments?.length ?? 0;

  for (const row of contentAssignments ?? []) {
    const template = joinedTemplate(row.content_block_templates);
    if (isRetiredContentBlockTemplateSlug(template?.slug)) continue;
    assignmentRowCount += 1;
    appendBlockState(blockStates, "content", row, template);
    const homeModuleSlug = template
      ? resolveHomeModuleSlugFromTemplate(template.slug, template.variant)
      : null;

    if (!normalizeBoolean(row.is_visible, true)) {
      if (homeModuleSlug) hiddenHomeModuleSlugs.add(homeModuleSlug);
      continue;
    }

    if (!template || !isPageModulePubliclyVisible(row.is_visible, template.status)) continue;

    blockPromises.push(
      resolveContentBlockConfigLinks(
        resolveContentBlockConfig(template) as Record<string, unknown>,
        template.slug,
        template.variant,
      ).then((resolvedConfig): ResolvedPageBlock => ({
        assignmentId: row.id,
        blockType: "content",
        templateId: template.id,
        slot: normalizeLayoutSlot(row.slot),
        sortOrder: row.sort_order ?? 0,
        isVisible: true,
        template: {
          ...template,
          config: resolvedConfig,
        },
      })),
    );
  }

  for (const row of ctaAssignments ?? []) {
    const template = joinedTemplate(row.cta_block_templates);
    appendBlockState(blockStates, "cta", row, template);
    if (!template || !isPageModulePubliclyVisible(row.is_visible, template.status)) continue;

    blockPromises.push(
      resolveCtaBlockConfigLinks(asCtaConfig(template.config)).then(
        (config): ResolvedPageBlock => ({
          assignmentId: row.id,
          blockType: "cta",
          templateId: template.id,
          slot: normalizeLayoutSlot(row.slot),
          sortOrder: row.sort_order ?? 0,
          isVisible: true,
          template: { ...template, config },
        }),
      ),
    );
  }

  for (const row of cardsAssignments ?? []) {
    const template = joinedTemplate(row.cards_block_templates);
    appendBlockState(blockStates, "cards", row, template);
    if (!template || !isPageModulePubliclyVisible(row.is_visible, template.status)) continue;

    blockPromises.push(
      resolveCardsBlockConfigLinks(asCardsConfig(template.config)).then(
        (config): ResolvedPageBlock => ({
          assignmentId: row.id,
          blockType: "cards",
          templateId: template.id,
          slot: normalizeLayoutSlot(row.slot),
          sortOrder: row.sort_order ?? 0,
          isVisible: true,
          template: { ...template, config },
        }),
      ),
    );
  }

  for (const row of breadcrumbAssignments ?? []) {
    const template = joinedTemplate(row.breadcrumb_block_templates);
    appendBlockState(blockStates, "breadcrumb", row, template);
    if (!template || !isPageModulePubliclyVisible(row.is_visible, template.status)) continue;

    blockPromises.push(
      resolveBreadcrumbBlockConfigLinks(asBreadcrumbConfig(template.config)).then(
        (config): ResolvedPageBlock => ({
          assignmentId: row.id,
          blockType: "breadcrumb",
          templateId: template.id,
          slot: normalizeLayoutSlot(row.slot),
          sortOrder: row.sort_order ?? 0,
          isVisible: true,
          template: { ...template, config },
        }),
      ),
    );
  }

  const blocks = await Promise.all(blockPromises);

  const hasRenderableModules = blocks.length > 0;
  const hasAnyAssignmentRows = assignmentRowCount > 0;

  const result: PageBlockLoadResult = {
    blocks: sortPageBlocks(blocks),
    blockStates,
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    hasAssignments: hasRenderableModules,
    hiddenHomeModuleSlugs: [...hiddenHomeModuleSlugs],
  };

  if (hasCompositionError) {
    throw new PageBlockStateReadError(result, assignmentFailures);
  }

  return result;
}

export async function loadPageBlocksBySlug(pageSlug: string): Promise<ResolvedPageBlock[]> {
  const { blocks } = await loadPageBlockStateBySlug(pageSlug);
  return blocks;
}
