import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { blockModuleHref, blockModuleListHref, normalizeBoolean } from "./admin-utils";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageBlockAssignmentRow } from "./types";

export { blockModuleHref, blockModuleListHref };

type AssignmentQueryResult = {
  assignments: PageBlockAssignmentRow[];
  templates: {
    content: Array<{ id: number; name: string; slug: string; status: string }>;
    cta: Array<{ id: number; name: string; slug: string; status: string }>;
    cards: Array<{ id: number; name: string; slug: string; status: string }>;
    breadcrumb: Array<{ id: number; name: string; slug: string; status: string }>;
    feed: Array<{ id: number; name: string; slug: string; status: string }>;
    hero: Array<{ id: number; name: string; slug: string; status: string }>;
    mediaSidebar: Array<{ id: number; name: string; slug: string; status: string }>;
    mediaHub: Array<{ id: number; name: string; slug: string; status: string }>;
  };
};

function joinedTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getPageModuleAssignmentsForAdmin(pageId: number): Promise<AssignmentQueryResult> {
  const [
    { data: contentRows },
    { data: ctaRows },
    { data: cardsRows },
    { data: breadcrumbRows },
    { data: feedRows },
    { data: heroRows },
    { data: mediaSidebarRows },
    { data: mediaHubRows },
    { data: contentTemplates },
    { data: ctaTemplates },
    { data: cardsTemplates },
    { data: breadcrumbTemplates },
    { data: feedTemplates },
    { data: heroTemplates },
    { data: mediaSidebarTemplates },
    { data: mediaHubTemplates },
  ] = await Promise.all([
    getSupabaseAdmin()
      .from("page_content_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,content_block_templates(name,slug,status,variant)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_cta_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,cta_block_templates(name,slug,status,variant)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_cards_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,cards_block_templates(name,slug,status,variant)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_breadcrumb_block_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,breadcrumb_block_templates(name,slug,status,variant)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_feed_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,feed_module_templates(name,slug,status,feed_type)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("hero_assignments")
      .select("id,target_id,is_active,priority,updated_at,hero_templates(id,name,slug,variant,status,sort_order)")
      .eq("target_type", "page")
      .eq("target_id", pageId),
    getSupabaseAdmin()
      .from("page_media_sidebar_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,media_sidebar_module_templates(name,slug,status,widget_key)")
      .eq("page_id", pageId),
    getSupabaseAdmin()
      .from("page_media_hub_module_assignments")
      .select("id,page_id,template_id,slot,sort_order,is_visible,updated_at,media_hub_module_templates(name,slug,status,section_key)")
      .eq("page_id", pageId),
    getSupabaseAdmin().from("content_block_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("cta_block_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("cards_block_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("breadcrumb_block_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("feed_module_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("hero_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("media_sidebar_module_templates").select("id,name,slug,status").order("name"),
    getSupabaseAdmin().from("media_hub_module_templates").select("id,name,slug,status").order("name"),
  ]);

  const assignments: PageBlockAssignmentRow[] = [];

  for (const row of heroRows ?? []) {
    const template = joinedTemplate(row.hero_templates) as {
      id: number;
      name: string;
      slug: string;
      variant: string;
      status: string;
      sort_order: number | null;
    } | null;

    if (!template) continue;

    assignments.push({
      id: row.id,
      page_id: pageId,
      template_id: template.id,
      slot: "hero",
      sort_order: Math.max(0, 1000 - Number(row.priority ?? 1000)),
      is_visible: normalizeBoolean(row.is_active, true) && template.status === "published",
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
    const template = joinedTemplate(row.content_block_templates) as {
      name: string;
      slug: string;
      status: string;
      variant: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
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
    const template = joinedTemplate(row.cta_block_templates) as {
      name: string;
      slug: string;
      status: string;
      variant: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
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
    const template = joinedTemplate(row.cards_block_templates) as {
      name: string;
      slug: string;
      status: string;
      variant: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
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
    const template = joinedTemplate(row.breadcrumb_block_templates) as {
      name: string;
      slug: string;
      status: string;
      variant: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
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
    const template = joinedTemplate(row.feed_module_templates) as {
      name: string;
      slug: string;
      status: string;
      feed_type: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
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

  for (const row of mediaSidebarRows ?? []) {
    const template = joinedTemplate(row.media_sidebar_module_templates) as {
      name: string;
      slug: string;
      status: string;
      widget_key: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: row.slot,
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
      updated_at: String(row.updated_at),
      module_kind: "media-sidebar",
      block_type: null,
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.widget_key ?? "sections",
      manages_assignment_on_page: true,
      assignment_note: "slot: sidebar — يتحكم في ظهور وترتيب لوحة الشريط الجانبي على الموقع.",
    });
  }

  for (const row of mediaHubRows ?? []) {
    const template = joinedTemplate(row.media_hub_module_templates) as {
      name: string;
      slug: string;
      status: string;
      section_key: string;
    } | null;
    assignments.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: row.slot,
      sort_order: row.sort_order,
      is_visible: normalizeBoolean(row.is_visible, true),
      updated_at: String(row.updated_at),
      module_kind: "media-hub",
      block_type: null,
      template_name: template?.name ?? "—",
      template_slug: template?.slug ?? "—",
      template_status: template?.status ?? "unpublished",
      template_variant: template?.section_key ?? "featured",
      manages_assignment_on_page: true,
      assignment_note: "slot: main — يتحكم في ظهور وترتيب سكشن Hub على /media-center.",
    });
  }

  assignments.sort((a, b) => {
    const slotOrder = (slot: string) => slot === "hero" ? -2 : slot === "top" ? -1 : slot === "main" ? 0 : 1;
    return slotOrder(a.slot) - slotOrder(b.slot)
      || a.sort_order - b.sort_order
      || a.module_kind.localeCompare(b.module_kind)
      || a.id - b.id;
  });

  return {
    assignments,
    templates: {
      content: (contentTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
      cta: (ctaTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
      cards: (cardsTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
      breadcrumb: (breadcrumbTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
      feed: (feedTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
      hero: ((heroTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>).map(
        (hero) => ({
          id: hero.id,
          name: hero.name,
          slug: hero.slug,
          status: hero.status,
        }),
      ),
      mediaSidebar: (mediaSidebarTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
      mediaHub: (mediaHubTemplates ?? []) as Array<{ id: number; name: string; slug: string; status: string }>,
    },
  };
}
