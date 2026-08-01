"use client";

import { useMemo, useState, useTransition } from "react";
import { useAdminGridSelection } from "../ui";
import type { AdminTableActionResult, AdminTableId, AdminTableSortDirection, AdminTableSortState } from "./types";

type SortAccessor<TRow> = (row: TRow) => string | number | null | undefined;

type UseAdminTableOptions<TRow, TSortKey extends string> = {
  initialRows: TRow[];
  getRowId: (row: TRow) => AdminTableId;
  sortAccessors?: Partial<Record<TSortKey, SortAccessor<TRow>>>;
  defaultSort?: AdminTableSortState<TSortKey>;
  refresh?: () => Promise<TRow[]>;
};

function compareValues(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "ar", { numeric: true, sensitivity: "base" });
}

export function useAdminTable<TRow, TSortKey extends string = string>({
  initialRows,
  getRowId,
  sortAccessors,
  defaultSort = { key: null, direction: "asc" as AdminTableSortDirection },
  refresh,
}: UseAdminTableOptions<TRow, TSortKey>) {
  const [rows, setRows] = useState<TRow[]>(initialRows);
  const [sort, setSort] = useState<AdminTableSortState<TSortKey>>(defaultSort);
  const [isPending, startTransition] = useTransition();

  const visibleIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const selection = useAdminGridSelection(visibleIds);

  const sortedRows = useMemo(() => {
    if (!sort.key || !sortAccessors?.[sort.key]) return rows;
    const accessor = sortAccessors[sort.key];
    if (!accessor) return rows;

    return [...rows].sort((first, second) => {
      const result = compareValues(accessor(first), accessor(second));
      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, sort, sortAccessors]);

  function toggleSort(key: TSortKey) {
    setSort((current) => {
      if (current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: "asc" };
    });
  }

  async function refreshRows() {
    if (!refresh) return;
    const nextRows = await refresh();
    setRows(nextRows);
    selection.clearSelection();
  }

  function runAction(action: () => Promise<AdminTableActionResult<TRow>>) {
    return new Promise<AdminTableActionResult<TRow>>((resolve) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (!result.ok) {
            resolve(result);
            return;
          }

          if (result.rows) {
            setRows(result.rows);
          } else {
            await refreshRows();
          }

          selection.clearSelection();
          resolve(result);
        } catch (error) {
          resolve({
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "تعذر تنفيذ العملية.",
          });
        }
      });
    });
  }

  return {
    rows: sortedRows,
    rawRows: rows,
    setRows,
    sort,
    toggleSort,
    selection,
    isPending,
    refreshRows,
    runAction,
  };
}
