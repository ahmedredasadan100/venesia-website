import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { MEDIA_HUB_ASSIGNMENT_TABLE } from "../media-hub-modules/registry";
import { MEDIA_SIDEBAR_ASSIGNMENT_TABLE } from "../media-sidebar-modules/registry";
import { BLOCK_MODULE_REGISTRY } from "./block-module-registry";
import { normalizeLayoutSlot } from "./layout-slots";
import { normalizeBoolean } from "./admin-utils";
import type { PageBlockType } from "./types";

export type ModuleAssignmentRow = {
  id: number;
  page_id: number;
  template_id: number;
  slot: string;
  sort_order: number;
  is_visible: boolean;
  page_title: string;
  page_slug: string;
  page_path: string;
};

export type ModuleAssignmentContext = {
  assignments: ModuleAssignmentRow[];
  pages: Array<{ id: number; title: string; slug: string; path: string }>;
};

async function loadModuleAssignmentContext(
  assignmentTable: string,
  templateId: number,
): Promise<ModuleAssignmentContext> {
  const [{ data: assignments }, { data: pages }] = await Promise.all([
    getSupabaseAdmin()
      .from(assignmentTable)
      .select("id,page_id,template_id,slot,sort_order,is_visible")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true }),
    getSupabaseAdmin()
      .from("pages")
      .select("id,title,slug,path")
      .order("sort_order", { ascending: true }),
  ]);

  const pageById = new Map((pages ?? []).map((page) => [page.id, page]));
  const rows: ModuleAssignmentRow[] = [];

  for (const row of assignments ?? []) {
    const page = pageById.get(row.page_id);
    rows.push({
      id: row.id,
      page_id: row.page_id,
      template_id: row.template_id,
      slot: normalizeLayoutSlot(row.slot),
      sort_order: row.sort_order ?? 0,
      is_visible: normalizeBoolean(row.is_visible, true),
      page_title: page?.title ?? "—",
      page_slug: page?.slug ?? "—",
      page_path: page?.path ?? "—",
    });
  }

  return {
    assignments: rows,
    pages: (pages ?? []) as Array<{ id: number; title: string; slug: string; path: string }>,
  };
}

export async function getModuleAssignmentContext(
  blockType: PageBlockType,
  templateId: number,
): Promise<ModuleAssignmentContext> {
  return loadModuleAssignmentContext(BLOCK_MODULE_REGISTRY[blockType].assignmentTable, templateId);
}

export async function getMediaHubModuleAssignmentContext(templateId: number) {
  return loadModuleAssignmentContext(MEDIA_HUB_ASSIGNMENT_TABLE, templateId);
}

export async function getMediaSidebarModuleAssignmentContext(templateId: number) {
  return loadModuleAssignmentContext(MEDIA_SIDEBAR_ASSIGNMENT_TABLE, templateId);
}

export async function getHeroModuleAssignmentContext(templateId: number): Promise<ModuleAssignmentContext> {
  const [{ data: assignments }, { data: pages }] = await Promise.all([
    getSupabaseAdmin()
      .from("hero_assignments")
      .select("id,target_id,is_active,priority")
      .eq("hero_id", templateId)
      .eq("target_type", "page")
      .order("priority", { ascending: true }),
    getSupabaseAdmin().from("pages").select("id,title,slug,path").order("sort_order", { ascending: true }),
  ]);

  const pageById = new Map((pages ?? []).map((page) => [page.id, page]));
  const rows: ModuleAssignmentRow[] = [];

  for (const row of assignments ?? []) {
    const page = pageById.get(row.target_id);
    if (!page) continue;

    rows.push({
      id: row.id,
      page_id: page.id,
      template_id: templateId,
      slot: "hero",
      sort_order: row.priority ?? 0,
      is_visible: normalizeBoolean(row.is_active, true),
      page_title: page.title ?? "—",
      page_slug: page.slug ?? "—",
      page_path: page.path ?? "—",
    });
  }

  return {
    assignments: rows,
    pages: (pages ?? []) as Array<{ id: number; title: string; slug: string; path: string }>,
  };
}
