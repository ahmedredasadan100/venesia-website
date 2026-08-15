import "server-only";

import type { Json } from "../../database.types";
import { requireAdminSession } from "../auth/require-admin-session";
import { filterPersistableColumnKeys } from "../entity-list/column-preferences";
import type { AdminEntityPersistResult } from "../entity-list/types";
import { getSupabaseAdmin } from "../../supabase-admin";

type StoredAdminColumnPreferences = {
  visibleColumns?: string[];
  columnContractVersion?: number;
};

function parseStoredAdminColumnPreferences(
  value: Json,
): StoredAdminColumnPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const visibleColumns = Array.isArray(value.visibleColumns)
    ? value.visibleColumns.filter((column): column is string =>
        typeof column === "string",
      )
    : undefined;
  const columnContractVersion =
    typeof value.columnContractVersion === "number" &&
    Number.isSafeInteger(value.columnContractVersion)
      ? value.columnContractVersion
      : undefined;

  return {
    ...(visibleColumns ? { visibleColumns } : {}),
    ...(columnContractVersion === undefined ? {} : { columnContractVersion }),
  };
}

/**
 * Entity-neutral Admin infrastructure adapter for column preferences.
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
    .maybeSingle();

  if (error) {
    return { visibleColumns: null, error: error.message };
  }

  const preferences = data
    ? parseStoredAdminColumnPreferences(data.preferences)
    : null;
  const contractMatches =
    options.contractVersion === undefined ||
    preferences?.columnContractVersion === options.contractVersion;
  const visibleColumns =
    contractMatches && preferences?.visibleColumns
    ? preferences.visibleColumns
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
    .single();

  if (error) return { ok: false, message: error.message };

  const storedColumns = data
    ? (parseStoredAdminColumnPreferences(data.preferences).visibleColumns ?? [])
    : [];
  const matchesRequestedValue =
    storedColumns.length === safeColumns.length &&
    storedColumns.every((column, index) => column === safeColumns[index]);

  return matchesRequestedValue
    ? { ok: true }
    : { ok: false, message: "تعذر التحقق من تفضيلات الأعمدة المحفوظة." };
}
