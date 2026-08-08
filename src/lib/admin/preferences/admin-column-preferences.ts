import "server-only";

import { requireAdminSession } from "../auth/require-admin-session";
import { filterPersistableColumnKeys } from "../entity-list/column-preferences";
import type { AdminEntityPersistResult } from "../entity-list/types";
import { getSupabaseAdmin } from "../../supabase-admin";

type StoredAdminColumnPreferences = {
  visibleColumns?: string[];
  columnContractVersion?: number;
};

/**
 * Project infrastructure adapter for column preferences.
 * UI core must not import this module — pages/actions call it with a view key.
 */
export async function readAdminColumnPreferences(
  viewKey: string,
  options: { contractVersion?: number } = {},
): Promise<{
  visibleColumns: string[] | null;
  error: string | null;
}> {
  const actor = await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("admin_user_preferences")
    .select("preferences")
    .eq("admin_user_id", actor.id)
    .eq("view_key", viewKey)
    .maybeSingle<{ preferences: StoredAdminColumnPreferences }>();

  if (error) {
    return { visibleColumns: null, error: error.message };
  }

  const contractMatches =
    options.contractVersion === undefined ||
    data?.preferences?.columnContractVersion === options.contractVersion;
  const visibleColumns =
    contractMatches && Array.isArray(data?.preferences?.visibleColumns)
    ? data.preferences.visibleColumns
    : null;

  return { visibleColumns, error: null };
}

export async function saveAdminColumnPreferences(input: {
  viewKey: string;
  visibleColumns: string[];
  allowedColumns: readonly string[];
  contractVersion?: number;
}): Promise<AdminEntityPersistResult> {
  const actor = await requireAdminSession();
  const safeColumns = filterPersistableColumnKeys(
    input.visibleColumns,
    input.allowedColumns,
  );
  const now = new Date().toISOString();
  const preferences: StoredAdminColumnPreferences = {
    visibleColumns: safeColumns,
    ...(input.contractVersion === undefined
      ? {}
      : { columnContractVersion: input.contractVersion }),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("admin_user_preferences")
    .upsert(
      {
        admin_user_id: actor.id,
        view_key: input.viewKey,
        preferences,
        updated_at: now,
      },
      { onConflict: "admin_user_id,view_key" },
    )
    .select("preferences")
    .single<{ preferences: StoredAdminColumnPreferences }>();

  if (error) return { ok: false, message: error.message };

  const storedColumns = Array.isArray(data?.preferences?.visibleColumns)
    ? data.preferences.visibleColumns
    : [];
  const matchesRequestedValue =
    storedColumns.length === safeColumns.length &&
    storedColumns.every((column, index) => column === safeColumns[index]);

  return matchesRequestedValue
    ? { ok: true }
    : { ok: false, message: "تعذر التحقق من تفضيلات الأعمدة المحفوظة." };
}
