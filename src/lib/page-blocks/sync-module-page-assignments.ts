import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { MEDIA_HUB_ASSIGNMENT_TABLE } from "../media-hub-modules/registry";
import { MEDIA_SIDEBAR_ASSIGNMENT_TABLE } from "../media-sidebar-modules/registry";
import { BLOCK_MODULE_REGISTRY } from "./block-module-registry";
import { revalidatePageBlocksPath } from "./admin-revalidate";
import type { PageBlockType } from "./types";

function defaultSlotForBlockType(blockType: PageBlockType) {
  if (blockType === "breadcrumb") return "hero";
  if (blockType === "feed") return "sidebar";
  return "main";
}

async function nextSortOrderForTable(pageId: number, table: string) {
  const { data } = await getSupabaseAdmin()
    .from(table)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

export function parsePageIdsFromForm(formData: FormData) {
  return [...new Set(formData.getAll("page_ids").map((value) => Number(value)).filter(Boolean))];
}

async function syncModulePageAssignmentsForTable(
  table: string,
  templateId: number,
  pageIds: number[],
  defaultSlot: string,
) {
  const targetIds = [...new Set(pageIds.filter(Boolean))];

  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from(table)
    .select("id,page_id")
    .eq("template_id", templateId);

  if (currentError) throw new Error(currentError.message);

  const currentPageIds = new Set((current ?? []).map((row) => row.page_id));
  const targetSet = new Set(targetIds);
  const affectedPageIds = new Set<number>();

  const toRemove = (current ?? []).filter((row) => !targetSet.has(row.page_id));
  if (toRemove.length) {
    const { error } = await getSupabaseAdmin()
      .from(table)
      .delete()
      .in(
        "id",
        toRemove.map((row) => row.id),
      );

    if (error) throw new Error(error.message);
    toRemove.forEach((row) => affectedPageIds.add(row.page_id));
  }

  const toAdd = targetIds.filter((pageId) => !currentPageIds.has(pageId));
  for (const pageId of toAdd) {
    const { error } = await getSupabaseAdmin().from(table).insert({
      page_id: pageId,
      template_id: templateId,
      slot: defaultSlot,
      sort_order: await nextSortOrderForTable(pageId, table),
      is_visible: true,
    });

    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }

    affectedPageIds.add(pageId);
  }

  await Promise.all([...affectedPageIds].map((pageId) => revalidatePageBlocksPath(pageId)));
}

export async function syncBlockModulePageAssignments(
  blockType: PageBlockType,
  templateId: number,
  pageIds: number[],
) {
  await syncModulePageAssignmentsForTable(
    BLOCK_MODULE_REGISTRY[blockType].assignmentTable,
    templateId,
    pageIds,
    defaultSlotForBlockType(blockType),
  );
}

export async function syncMediaHubModulePageAssignments(templateId: number, pageIds: number[]) {
  await syncModulePageAssignmentsForTable(MEDIA_HUB_ASSIGNMENT_TABLE, templateId, pageIds, "main");
}

export async function syncMediaSidebarModulePageAssignments(templateId: number, pageIds: number[]) {
  await syncModulePageAssignmentsForTable(MEDIA_SIDEBAR_ASSIGNMENT_TABLE, templateId, pageIds, "sidebar");
}
