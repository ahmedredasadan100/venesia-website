import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import type { Json } from "../database.types";
import type { PageModuleKind } from "./types";
import { getDefaultAssignmentPosition } from "../page-composition/page-assignment-contract";

type AssignmentSyncActor = { id: number; username: string };

export function parsePageIdsFromForm(formData: FormData) {
  const ids = formData.getAll("page_ids").map((value) => Number(value));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("معرّفات الصفحات غير صالحة.");
  }
  return [...new Set(ids)];
}

/** Atomic extension of the existing Composition owner, with no legacy fallback. */
export async function saveModuleTemplateWithPageAssignments(
  moduleKind: Exclude<PageModuleKind, "hero">,
  templateId: number,
  template: { [key: string]: Json | undefined },
  pageIds: number[],
  actor: AssignmentSyncActor,
) {
  const { data, error } = await getSupabaseAdmin().rpc("mutate_page_composition", {
    p_page_id: null,
    p_operation: "save_template",
    p_payload: {
      kind: moduleKind.replaceAll("-", "_"),
      template_id: templateId,
      template,
      page_ids: pageIds,
      default_slot: getDefaultAssignmentPosition(moduleKind),
    },
    p_actor_admin_user_id: actor.id,
    p_actor_username: actor.username,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("لم تصل نتيجة حفظ القالب الذري. أعد القراءة قبل إعادة المحاولة.");
  }
  return {
    id: templateId,
    updatedAt: String(data.updated_at),
    affectedPageIds: (data.affected_page_ids as number[]) ?? [],
  };
}
