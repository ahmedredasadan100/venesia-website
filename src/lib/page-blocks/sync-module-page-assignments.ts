import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { MEDIA_HUB_ASSIGNMENT_TABLE } from "../media-hub-modules/registry";
import { MEDIA_SIDEBAR_ASSIGNMENT_TABLE } from "../media-sidebar-modules/registry";
import { BLOCK_MODULE_REGISTRY } from "./block-module-registry";
import { revalidatePageBlocksPath } from "./admin-revalidate";
import type { PageBlockType } from "./types";

type AssignmentSyncActor = { id: number; username: string };

function defaultSlotForBlockType(blockType: PageBlockType) {
  if (blockType === "breadcrumb") return "hero";
  if (blockType === "feed") return "sidebar";
  return "main";
}

export function parsePageIdsFromForm(formData: FormData) {
  return [...new Set(formData.getAll("page_ids").map((value) => Number(value)).filter(Boolean))];
}

async function syncModulePageAssignmentsForTable(
  table: string,
  kind: string,
  templateId: number,
  pageIds: number[],
  defaultSlot: string,
  actor: AssignmentSyncActor,
) {
  const targetIds = [...new Set(pageIds.filter(Boolean))];

  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from(table)
    .select("page_id")
    .eq("template_id", templateId);

  if (currentError) throw new Error(currentError.message);
  const affectedPageIds = [...new Set([...(current ?? []).map((row) => row.page_id), ...targetIds])].sort(
    (left, right) => left - right,
  );
  if (!affectedPageIds.length) return;

  const { error } = await getSupabaseAdmin().rpc("mutate_page_composition", {
    p_page_id: affectedPageIds[0],
    p_operation: "sync_template_pages",
    p_payload: {
      kind,
      template_id: templateId,
      page_ids: targetIds,
      default_slot: defaultSlot,
    },
    p_actor_admin_user_id: actor.id,
    p_actor_username: actor.username,
  });
  if (error) throw new Error(error.message);

  await Promise.all(affectedPageIds.map((pageId) => revalidatePageBlocksPath(pageId)));
}

export async function syncBlockModulePageAssignments(
  blockType: PageBlockType,
  templateId: number,
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  await syncModulePageAssignmentsForTable(
    BLOCK_MODULE_REGISTRY[blockType].assignmentTable,
    blockType,
    templateId,
    pageIds,
    defaultSlotForBlockType(blockType),
    actor,
  );
}

export async function syncMediaHubModulePageAssignments(
  templateId: number,
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  await syncModulePageAssignmentsForTable(MEDIA_HUB_ASSIGNMENT_TABLE, "media_hub", templateId, pageIds, "main", actor);
}

export async function syncMediaSidebarModulePageAssignments(
  templateId: number,
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  await syncModulePageAssignmentsForTable(
    MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
    "media_sidebar",
    templateId,
    pageIds,
    "sidebar",
    actor,
  );
}
