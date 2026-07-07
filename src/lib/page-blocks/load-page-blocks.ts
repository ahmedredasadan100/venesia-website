import "server-only";

import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { resolveHomeModuleSlugFromTemplate, type HomeModuleSlug } from "./home-module-slugs";
import { asBreadcrumbConfig, asCardsConfig, asCtaConfig, resolveContentBlockConfig } from "./configs";
import {
  resolveBreadcrumbBlockConfigLinks,
  resolveCardsBlockConfigLinks,
  resolveCtaBlockConfigLinks,
  resolveContentBlockConfigLinks,
} from "../admin/links/block-config-links";
import { normalizeBoolean } from "./admin-utils";
import { sortPageBlocks } from "./page-block-layout";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageBlockTemplateBase, ResolvedPageBlock } from "./types";

function isPublishedTemplate(status: string | null | undefined) {
  return status === "published";
}

type TemplateRow = PageBlockTemplateBase & { config: Record<string, unknown> | null };

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type PageBlockLoadResult = {
  blocks: ResolvedPageBlock[];
  hasAssignments: boolean;
  hiddenHomeModuleSlugs: HomeModuleSlug[];
};

/**
 * Loads Content / CTA / Cards blocks assigned to a page.
 * Hero is intentionally excluded — use getHeroSectionByPageSlug().
 */
export async function loadPageBlockStateBySlug(pageSlug: string): Promise<PageBlockLoadResult> {
  return unstable_cache(
    async () => queryPageBlockStateBySlug(pageSlug),
    ["page-block-state", pageSlug],
    { revalidate: 300, tags: ["page-composition", "page-blocks"] },
  )();
}

async function queryPageBlockStateBySlug(pageSlug: string): Promise<PageBlockLoadResult> {
  const supabase = getSupabaseAdmin();

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("slug", pageSlug)
    .eq("status", "published")
    .maybeSingle();

  if (pageError) logError("loadPageBlockStateBySlug: page lookup failed", pageError, { pageSlug });
  if (!page) return { blocks: [], hasAssignments: false, hiddenHomeModuleSlugs: [] };

  const blocks: ResolvedPageBlock[] = [];
  const hiddenHomeModuleSlugs = new Set<HomeModuleSlug>();

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

  if (contentError) logError("loadPageBlockStateBySlug: content assignments failed", contentError, { pageSlug });
  if (ctaError) logError("loadPageBlockStateBySlug: cta assignments failed", ctaError, { pageSlug });
  if (cardsError) logError("loadPageBlockStateBySlug: cards assignments failed", cardsError, { pageSlug });
  if (breadcrumbError) logError("loadPageBlockStateBySlug: breadcrumb assignments failed", breadcrumbError, { pageSlug });

  for (const row of contentAssignments ?? []) {
    const template = joinedTemplate(row.content_block_templates) as TemplateRow | null;
    const homeModuleSlug = template
      ? resolveHomeModuleSlugFromTemplate(template.slug, template.variant)
      : null;

    if (!normalizeBoolean(row.is_visible, true)) {
      if (homeModuleSlug) hiddenHomeModuleSlugs.add(homeModuleSlug);
      continue;
    }

    if (!template || !isPublishedTemplate(template.status)) continue;

    const resolvedConfig = await resolveContentBlockConfigLinks(
      resolveContentBlockConfig(template) as Record<string, unknown>,
      template.slug,
      template.variant,
    );

    blocks.push({
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
    });

  }

  for (const row of ctaAssignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.cta_block_templates) as TemplateRow | null;
    if (!template || !isPublishedTemplate(template.status)) continue;

    blocks.push({
      assignmentId: row.id,
      blockType: "cta",
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveCtaBlockConfigLinks(asCtaConfig(template.config)),
      },
    });
  }

  for (const row of cardsAssignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.cards_block_templates) as TemplateRow | null;
    if (!template || !isPublishedTemplate(template.status)) continue;

    blocks.push({
      assignmentId: row.id,
      blockType: "cards",
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveCardsBlockConfigLinks(asCardsConfig(template.config)),
      },
    });
  }

  for (const row of breadcrumbAssignments ?? []) {
    if (!normalizeBoolean(row.is_visible, true)) continue;

    const template = joinedTemplate(row.breadcrumb_block_templates) as TemplateRow | null;
    if (!template || !isPublishedTemplate(template.status)) continue;

    blocks.push({
      assignmentId: row.id,
      blockType: "breadcrumb",
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: true,
      template: {
        ...template,
        config: await resolveBreadcrumbBlockConfigLinks(asBreadcrumbConfig(template.config)),
      },
    });
  }

  return {
    blocks: sortPageBlocks(blocks),
    hasAssignments: blocks.length > 0,
    hiddenHomeModuleSlugs: [...hiddenHomeModuleSlugs],
  };
}

export async function loadPageBlocksBySlug(pageSlug: string): Promise<ResolvedPageBlock[]> {
  const { blocks } = await loadPageBlockStateBySlug(pageSlug);
  return blocks;
}
