import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { getPublishedPageBySlug } from "../pages/get-published-page-by-slug";
import { resolveHomeModuleSlugFromTemplate, type HomeModuleSlug } from "./home-module-slugs";
import { asBreadcrumbConfig, asCardsConfig, asCtaConfig, resolveContentBlockConfig } from "./configs";
import {
  resolveBreadcrumbBlockConfigLinks,
  resolveCardsBlockConfigLinks,
  resolveCtaBlockConfigLinks,
  resolveContentBlockConfigLinks,
} from "../admin/links/block-config-links";
import { isPublishedPageBlockStatus, normalizeBoolean } from "./admin-utils";
import { sortPageBlocks } from "./page-block-layout";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageBlockTemplateBase, ResolvedPageBlock } from "./types";

type TemplateRow = PageBlockTemplateBase & { config: Record<string, unknown> | null };

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type PageBlockLoadResult = {
  blocks: ResolvedPageBlock[];
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

function emptyPageBlockLoadResult(): PageBlockLoadResult {
  return {
    blocks: [],
    hasAnyAssignmentRows: false,
    hasRenderableModules: false,
    hasCompositionError: false,
    hasAssignments: false,
    hiddenHomeModuleSlugs: [],
  };
}

/**
 * Loads Content / CTA / Cards blocks assigned to a page.
 * Hero is intentionally excluded — use getHeroSectionByPageSlug().
 */
export const loadPageBlockStateBySlug = cache(async function loadPageBlockStateBySlug(
  pageSlug: string,
): Promise<PageBlockLoadResult> {
  return unstable_cache(
    async () => queryPageBlockStateBySlug(pageSlug),
    ["page-block-state", pageSlug],
    { revalidate: 300, tags: ["page-composition", "page-blocks"] },
  )();
});

async function queryPageBlockStateBySlug(pageSlug: string): Promise<PageBlockLoadResult> {
  const supabase = getSupabaseAdmin();

  const page = await getPublishedPageBySlug(pageSlug);
  if (!page) return emptyPageBlockLoadResult();

  const blockPromises: Array<Promise<ResolvedPageBlock>> = [];
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

  const hasCompositionError = Boolean(contentError || ctaError || cardsError || breadcrumbError);
  if (contentError) logError("loadPageBlockStateBySlug: content assignments failed", contentError, { pageSlug });
  if (ctaError) logError("loadPageBlockStateBySlug: cta assignments failed", ctaError, { pageSlug });
  if (cardsError) logError("loadPageBlockStateBySlug: cards assignments failed", cardsError, { pageSlug });
  if (breadcrumbError) logError("loadPageBlockStateBySlug: breadcrumb assignments failed", breadcrumbError, { pageSlug });

  assignmentRowCount += contentAssignments?.length ?? 0;
  assignmentRowCount += ctaAssignments?.length ?? 0;
  assignmentRowCount += cardsAssignments?.length ?? 0;
  assignmentRowCount += breadcrumbAssignments?.length ?? 0;

  for (const row of contentAssignments ?? []) {
    const template = joinedTemplate(row.content_block_templates) as TemplateRow | null;
    const homeModuleSlug = template
      ? resolveHomeModuleSlugFromTemplate(template.slug, template.variant)
      : null;

    if (!normalizeBoolean(row.is_visible, true)) {
      if (homeModuleSlug) hiddenHomeModuleSlugs.add(homeModuleSlug);
      continue;
    }

    if (!template || !isPublishedPageBlockStatus(template.status)) continue;

    blockPromises.push((async () => ({
      assignmentId: row.id,
      blockType: "content" as const,
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveContentBlockConfigLinks(
          resolveContentBlockConfig(template) as Record<string, unknown>,
          template.slug,
          template.variant,
        ),
      },
    }))());

  }

  for (const row of ctaAssignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.cta_block_templates) as TemplateRow | null;
    if (!template || !isPublishedPageBlockStatus(template.status)) continue;

    blockPromises.push((async () => ({
      assignmentId: row.id,
      blockType: "cta" as const,
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveCtaBlockConfigLinks(asCtaConfig(template.config)),
      },
    }))());
  }

  for (const row of cardsAssignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.cards_block_templates) as TemplateRow | null;
    if (!template || !isPublishedPageBlockStatus(template.status)) continue;

    blockPromises.push((async () => ({
      assignmentId: row.id,
      blockType: "cards" as const,
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveCardsBlockConfigLinks(asCardsConfig(template.config)),
      },
    }))());
  }

  for (const row of breadcrumbAssignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.breadcrumb_block_templates) as TemplateRow | null;
    if (!template || !isPublishedPageBlockStatus(template.status)) continue;

    blockPromises.push((async () => ({
      assignmentId: row.id,
      blockType: "breadcrumb" as const,
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveBreadcrumbBlockConfigLinks(asBreadcrumbConfig(template.config)),
      },
    }))());
  }

  const blocks = await Promise.all(blockPromises);
  const hasRenderableModules = blocks.length > 0;
  const hasAnyAssignmentRows = assignmentRowCount > 0;

  return {
    blocks: sortPageBlocks(blocks),
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    hasAssignments: hasRenderableModules,
    hiddenHomeModuleSlugs: [...hiddenHomeModuleSlugs],
  };
}

export async function loadPageBlocksBySlug(pageSlug: string): Promise<ResolvedPageBlock[]> {
  const { blocks } = await loadPageBlockStateBySlug(pageSlug);
  return blocks;
}
