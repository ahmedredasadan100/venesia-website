import "server-only";

import { requireAdminSession } from "../auth/require-admin-session";
import { filterPersistableColumnKeys } from "../entity-list/column-preferences";
import type { AdminEntityPersistResult } from "../entity-list/types";
import { getSupabaseAdmin } from "../../supabase-admin";

/**
 * Project infrastructure adapter for column preferences.
 * UI core must not import this module — pages/actions call it with a view key.
 */
export async function readAdminColumnPreferences(viewKey: string): Promise<{
  visibleColumns: string[] | null;
  error: string | null;
}> {
  const actor = await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("admin_user_preferences")
    .select("preferences")
    .eq("admin_user_id", actor.id)
    .eq("view_key", viewKey)
    .maybeSingle<{ preferences: { visibleColumns?: string[] } }>();

  if (error) {
    return { visibleColumns: null, error: error.message };
  }

  const visibleColumns = Array.isArray(data?.preferences?.visibleColumns)
    ? data.preferences.visibleColumns
    : null;

  return { visibleColumns, error: null };
}

export async function saveAdminColumnPreferences(input: {
  viewKey: string;
  visibleColumns: string[];
  allowedColumns: readonly string[];
}): Promise<AdminEntityPersistResult> {
  const actor = await requireAdminSession();
  const safeColumns = filterPersistableColumnKeys(
    input.visibleColumns,
    input.allowedColumns,
  );
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("admin_user_preferences").upsert(
    {
      admin_user_id: actor.id,
      view_key: input.viewKey,
      preferences: { visibleColumns: safeColumns },
      updated_at: now,
    },
    { onConflict: "admin_user_id,view_key" },
  );

  return error
    ? { ok: false, message: error.message }
    : { ok: true };
}
