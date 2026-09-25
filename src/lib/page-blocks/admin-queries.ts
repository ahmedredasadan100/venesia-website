import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import {
  blockModuleHref,
  blockModuleListHref,
  isPageModulePubliclyVisible,
  resolvePageModuleVisibilityFields,
} from "./admin-utils";
import { extractPageBlockSeoText } from "./configs";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageBlockAssignmentRow, PageModuleKind } from "./types";
import { BLOCK_MODULE_REGISTRY } from "./block-module-registry";
import { MEDIA_HUB_TEMPLATE_TABLE } from "../media-hub-modules/registry";
import { MEDIA_SIDEBAR_TEMPLATE_TABLE } from "../media-sidebar-modules/registry";
import { isRetiredContentBlockTemplateSlug } from "./deprecated-block-modules";
import {
  comparePageAssignmentOrder,
  getDefaultAssignmentPosition,
  getProductFixedPositionReason,
} from "../page-composition/page-assignment-contract";
import { PAGE_COMPOSITION_POSITIONS } from "../page-composition/positions";
import { loadPageRegionsForPage } from "../page-composition/load-page-regions";
import {
  buildPageSeoSemanticContent,
  type PageSeoSemanticPart,
} from "./page-seo-semantic-source";

export { blockModuleHref, blockModuleListHref };

function toTemplateSummary({ id, name, slug, status }: { id: number; name: string; slug: string; status: string }) {
  return { id, name, slug, status };
}

type AssignmentQueryResult = {
  assignments: PageBlockAssignmentRow[];
  /** Only the default picker's small summary is ready with the page. */
  initialContentTemplates: Awaited<ReturnType<typeof getPageModuleTemplateOptionsForAdmin>> | null;
  /** Latest saved visible/published authored copy for the shared SEO analyzer. */
  seoContent: string;
};

/** Summary-only options for the default picker or an explicitly selected kind. */
export async function getPageModuleTemplateOptionsForAdmin(kind: PageModuleKind) {
  const table = kind === "hero" ? "hero_templates"
    : kind === "media-sidebar" ? MEDIA_SIDEBAR_TEMPLATE_TABLE
      : kind === "media-hub" ? MEDIA_HUB_TEMPLATE_TABLE
        : BLOCK_MODULE_REGISTRY[kind].templateTable;
  const { data, error } = await getSupabaseAdmin().from(table)
    .select("id,name,slug,status").order("name");
  if (error) throw new Error(`Page Composition template read failed: ${error.message}`);
  return (data ?? [])
    .filter(template => kind !== "content" || !isRetiredContentBlockTemplateSlug(template.slug))
    .map(toTemplateSummary);
}

export async function getPageModuleAssignmentsForAdmin(pageId: number): Promise<AssignmentQueryResult> {
  const [results, initialContentTemplates, layout] = await Promise.all([
    Promise.all([
    getSupabaseAdmin()
      .from("page_content_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,content_block_templates(id,name,slug,status,variant,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_cta_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,cta_block_templates(id,name,slug,status,variant,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_cards_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,cards_block_templates(id,name,slug,status,variant,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_breadcrumb_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,breadcrumb_block_templates(id,name,slug,status,variant,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_feed_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,feed_module_templates(id,name,slug,status,feed_type,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_featured_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,featured_module_templates(id,name,slug,status,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("hero_assignments")
      .select("id,hero_id,target_id,is_active,priority,updated_at,hero_templates(id,name,slug,status,variant,config)")
      .eq("target_type", "page")
      .eq("target_id", pageId),
    getSupabaseAdmin()
      .from("page_media_sidebar_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,media_sidebar_module_templates(id,name,slug,status,widget_key,config)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_media_hub_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,media_hub_module_templates(id,name,slug,status,section_key,config)")
      .eq("page_id", pageId),
    ]),
    // A failed optional summary must not prevent editing current assignments.
    // Opening Assign can retry through the same authenticated read action.
    getPageModuleTemplateOptionsForAdmin("content").catch(() => null),
    loadPageRegionsForPage(pageId),
  ]);

  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) {
    throw new Error(`Page Composition assignment read failed: ${failedResult.error.message}`);
  }

  const [
    { data: contentRows },
    { data: ctaRows },
    { data: cardsRows },
    { data: breadcrumbRows },
    { data: feedRows },
    { data: featuredRows },
    { data: heroRows },
    { data: mediaSidebarRows },
    { data: mediaHubRows },
  ] = results;

  const assignments: PageBlockAssignmentRow[] = [];
  const seoContentParts: PageSeoSemanticPart[] = [];

  function appendSeoContent(
    row: { is_visible?: unknown; is_active?: unknown },
    template: { status: string } | null | undefined,
    config: unknown,
    order: { slot: string; sortOrder: number; moduleKind: PageModuleKind; assignmentId: number },
  ) {
    if (!template) return;
    const assignmentVisible = row.is_visible ?? row.is_active;
    if (!isPageModulePubliclyVisible(assignmentVisible, template.status)) return;
    const content = extractPageBlockSeoText(config);
    if (content) seoContentParts.push({ content, ...order });
  }

  for (const row of heroRows ?? []) {
    const template = row.hero_templates;

    if (!template) continue;
    appendSeoContent(row, template, row.hero_templates?.config, {
      slot: getDefaultAssignmentPosition("hero"),
      sortOrder: Math.max(0, 1000 - Number(row.priority ?? 1000)),
      moduleKind: "hero",
      assignmentId: row.id,
    });

    assignments.push({
      id: row.id,
      page_id: pageId,
      template_id: template.id,
      slot: getDefaultAssignmentPosition("hero"),
      sort_order: Math.max(0, 1000 - Number(row.priority ?? 1000)),
      ...resolvePageModuleVisibilityFields(row.is_active, template.status),
      updated_at: String(row.updated_at),
      module_kind: "hero",
      block_type: null,
      template_name: template.name,
      template_slug: template.slug,
      template_status: template.status,
      template_variant: template.variant ?? "internal-page",
      manages_assignment_on_page: true,
      assignment_note: "حذف الربط يزيل الهيرو من هذه الصفحة فقط — الموديول يبقى في Hero Manager.",
    });
  }

  for (const row of contentRows ?? []) {
    const template = row.content_block_templates;
    if (!template || isRetiredContentBlockTemplateSlug(template.slug)) continue;
    appendSeoContent(row, template, row.content_block_templates?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "content", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "content",
      block_type: "content",
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.variant ?? "default",
      manages_assignment_on_page: true,
      assignment_note: null,
    });
  }

  for (const row of ctaRows ?? []) {
    const template = row.cta_block_templates;
    appendSeoContent(row, template, row.cta_block_templates?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "cta", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "cta",
      block_type: "cta",
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.variant ?? "band",
      manages_assignment_on_page: true,
      assignment_note: null,
    });
  }

  for (const row of cardsRows ?? []) {
    const template = row.cards_block_templates;
    appendSeoContent(row, template, row.cards_block_templates?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "cards", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "cards",
      block_type: "cards",
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.variant ?? "glass",
      manages_assignment_on_page: true,
      assignment_note: null,
    });
  }

  for (const row of breadcrumbRows ?? []) {
    const template = row.breadcrumb_block_templates;
    appendSeoContent(row, template, row.breadcrumb_block_templates?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "breadcrumb", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "breadcrumb",
      block_type: "breadcrumb",
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.variant ?? "hero-inline",
      manages_assignment_on_page: true,
      assignment_note: null,
    });
  }

  for (const row of feedRows ?? []) {
    const template = row.feed_module_templates;
    appendSeoContent(row, template, template?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "feed", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "feed",
      block_type: "feed",
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.feed_type ?? "latest",
      manages_assignment_on_page: true,
      assignment_note: null,
    });
  }

  for (const row of featuredRows ?? []) {
    const template = row.featured_module_templates;
    const config = row.featured_module_templates?.config;
    appendSeoContent(row, template, config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "featured", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "featured",
      block_type: "featured",
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant:
        template && config && typeof config === "object" && !Array.isArray(config)
          ? String((config.presentation as { variant?: unknown } | undefined)?.variant ?? "editorial")
          : "editorial",
      manages_assignment_on_page: true,
      assignment_note: null,
    });
  }

  for (const row of mediaSidebarRows ?? []) {
    const template = row.media_sidebar_module_templates;
    appendSeoContent(row, template, template?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "media-sidebar", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: row.slot,
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "media-sidebar",
      block_type: null,
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.widget_key ?? "sections",
      manages_assignment_on_page: true,
      assignment_note: getProductFixedPositionReason("media-sidebar"),
    });
  }

  for (const row of mediaHubRows ?? []) {
    const template = row.media_hub_module_templates;
    appendSeoContent(row, template, template?.config, {
      slot: normalizeLayoutSlot(row.slot), sortOrder: row.sort_order,
      moduleKind: "media-hub", assignmentId: row.id,
    });
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: row.slot,
      sort_order: row.sort_order,
      ...resolvePageModuleVisibilityFields(row.is_visible, template?.status),
      updated_at: String(row.updated_at),
      module_kind: "media-hub",
      block_type: null,
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.section_key ?? "featured",
      manages_assignment_on_page: true,
      assignment_note: getProductFixedPositionReason("media-hub"),
    });
  }

  assignments.sort((a, b) => {
    const positionOrder = (slot: string) =>
      (PAGE_COMPOSITION_POSITIONS as readonly string[]).indexOf(normalizeLayoutSlot(slot));
    return positionOrder(a.slot) - positionOrder(b.slot)
      || comparePageAssignmentOrder(
        {
          sortOrder: a.sort_order,
          moduleKind: a.module_kind,
          assignmentId: a.id,
        },
        {
          sortOrder: b.sort_order,
          moduleKind: b.module_kind,
          assignmentId: b.id,
        },
      );
  });

  return {
    initialContentTemplates,
    assignments,
    seoContent: buildPageSeoSemanticContent(
      seoContentParts,
      layout.regions.map((region) => region.key),
    ),
  };
}
