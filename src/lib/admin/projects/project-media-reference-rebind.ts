import "server-only";
import type { Json } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";

/** Media adopts the Project aggregate writer; it never gains table-write grants. */
export async function persistProjectMediaReferenceRebind(input: {
  table: string;
  entityIdentity: string;
  fieldKey: string;
  currentRow: Record<string, Json | undefined>;
  nextValue: Json;
  derivedFields?: Record<string, Json | undefined>;
}) {
  const projectId = input.table === "projects"
    ? Number(input.entityIdentity) : Number(input.currentRow.project_id);
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new Error("project_media_rebind_parent_unproven");
  }
  const { data, error } = await getSupabaseAdmin().rpc("save_project_admin_entry", {
    p_project_id: projectId,
    p_payload: {
      media_rebind: {
        table: input.table,
        id: input.entityIdentity,
        field: input.fieldKey,
        expected_value: input.currentRow[input.fieldKey],
        expected_updated_at: input.currentRow.updated_at,
        next_value: input.nextValue,
        expected_source: input.currentRow,
        score: input.derivedFields ?? null,
      },
    },
  });
  return { data: data?.[0] ?? null, error };
}
