import type { AdminEntityColumnDef } from "./types";

/**
 * Pure column preference helpers — no storage, no entity names.
 */
export function getDefaultVisibleColumnKeys<TRow, TKey extends string>(
  columns: readonly AdminEntityColumnDef<TRow, TKey>[],
): TKey[] {
  const defaults = columns
    .filter((column) => column.defaultVisible)
    .map((column) => column.key);
  return defaults.length
    ? defaults
    : columns.filter((column) => !column.hideable).map((column) => column.key);
}

export function sanitizeVisibleColumnKeys<TRow, TKey extends string>(
  columns: readonly AdminEntityColumnDef<TRow, TKey>[],
  keys: readonly string[],
): TKey[] {
  const allowed = new Set(columns.map((column) => column.key));
  const visible = keys.filter((key): key is TKey => allowed.has(key as TKey));

  for (const fixed of columns.filter((column) => !column.hideable)) {
    if (!visible.includes(fixed.key)) visible.push(fixed.key);
  }

  if (!visible.length) {
    return getDefaultVisibleColumnKeys(columns);
  }

  return visible;
}

export function filterPersistableColumnKeys(
  keys: readonly string[],
  allowedColumns: readonly string[],
): string[] {
  const allowed = new Set(allowedColumns);
  return [...new Set(keys)].filter((key) => allowed.has(key));
}

export function settleAdminColumnPreferenceSave<TKey extends string>(input: {
  committedColumns: readonly TKey[];
  requestedColumns: readonly TKey[];
  latestColumns: readonly TKey[];
  ok: boolean;
}) {
  if (input.ok) {
    return {
      committedColumns: [...input.requestedColumns],
      rollbackColumns: null,
    };
  }

  const requestIsLatest =
    input.latestColumns.length === input.requestedColumns.length &&
    input.latestColumns.every(
      (key, index) => key === input.requestedColumns[index],
    );

  return {
    committedColumns: [...input.committedColumns],
    rollbackColumns: requestIsLatest ? [...input.committedColumns] : null,
  };
}

export function resolveActiveSortColumnKey<
  TRow,
  TKey extends string,
  TSortKey extends string,
>(
  columns: readonly AdminEntityColumnDef<TRow, TKey, TSortKey>[],
  sortKey: TSortKey | null | undefined,
): TKey | null {
  if (!sortKey) return null;
  const match = columns.find((column) => column.sortKey === sortKey);
  return match?.key ?? null;
}
