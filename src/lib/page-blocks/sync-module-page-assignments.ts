import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { MEDIA_HUB_ASSIGNMENT_TABLE } from "../media-hub-modules/registry";
import { MEDIA_SIDEBAR_ASSIGNMENT_TABLE } from "../media-sidebar-modules/registry";
import {
  BLOCK_MODULE_REGISTRY,
  type PageModuleAssignmentTable,
} from "./block-module-registry";
import { revalidatePageBlocksPath } from "./admin-revalidate";
import type { PageBlockType, PageModuleKind } from "./types";
import { getDefaultAssignmentPosition } from "../page-composition/page-assignment-contract";

type AssignmentSyncActor = { id: number; username: string };

export function parsePageIdsFromForm(formData: FormData) {
  return [...new Set(formData.getAll("page_ids").map((value) => Number(value)).filter(Boolean))];
}

async function syncModulePageAssignmentsForTable(
  table: PageModuleAssignmentTable,
  moduleKind: PageModuleKind,
  databaseKind: string,
  templateId: number,
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  const targetIds = [...new Set(pageIds.filter(Boolean))];
  const defaultPosition = getDefaultAssignmentPosition(moduleKind);

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
      kind: databaseKind,
      template_id: templateId,
      page_ids: targetIds,
      default_slot: defaultPosition,
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
    blockType,
    templateId,
    pageIds,
    actor,
  );
}

export async function syncMediaHubModulePageAssignments(
  templateId: number,
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  await syncModulePageAssignmentsForTable(
    MEDIA_HUB_ASSIGNMENT_TABLE,
    "media-hub",
    "media_hub",
    templateId,
    pageIds,
    actor,
  );
}

export async function syncMediaSidebarModulePageAssignments(
  templateId: number,
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  await syncModulePageAssignmentsForTable(
    MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
    "media-sidebar",
    "media_sidebar",
    templateId,
    pageIds,
    actor,
  );
}
