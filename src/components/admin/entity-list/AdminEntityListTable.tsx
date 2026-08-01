"use client";

import type { ReactNode } from "react";
import type { AdminEntityColumnDef } from "../../../lib/admin/entity-list";
import {
  AdminDataGrid,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridSortLink,
  AdminDataGridSortLabel,
  AdminDataGridStickyActionsCell,
  AdminDataGridStickyActionsHeaderCell,
  ADMIN_DATA_GRID_HEADER_CLASSES,
  getAdminDataGridFixedColumnStyle,
} from "../ui/AdminDataGrid";
import type { AdminGridId } from "../ui/useAdminGridSelection";

export type AdminEntitySortState<TSortKey extends string = string> = {
  key: TSortKey;
  direction: "asc" | "desc";
};

export type AdminEntityListSelectionApi<TId extends AdminGridId = AdminGridId> = {
  selectedSet: Set<TId>;
  allSelected: boolean;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  toggleAll: (checked: boolean) => void;
  toggleOne: (id: TId, checked: boolean) => void;
};

type SortMode =
  | {
      mode: "href";
      hrefFor: (columnKey: string, sortKey: string) => string;
    }
  | {
      mode: "callback";
      onToggle: (sortKey: string) => void;
    };

export type AdminEntityListTableProps<
  TRow,
  TKey extends string,
  TSortKey extends string,
  TId extends AdminGridId = AdminGridId,
> = {
  rows: readonly TRow[];
  columns: readonly AdminEntityColumnDef<TRow, TKey, TSortKey>[];
  getRowId: (row: TRow) => TId;
  getRowLabel: (row: TRow) => string;
  sort?: AdminEntitySortState<TSortKey> | null;
  sortMode?: SortMode;
  selection?: AdminEntityListSelectionApi<TId> | null;
  selectionLabel?: string;
  scrollLabel?: string;
  actionsColumnWidth: number;
  empty: ReactNode;
  className?: string;
  /** Optional hierarchy depth for indent capability. */
  getRowDepth?: (row: TRow) => number;
  rowClassName?: (row: TRow) => string;
  onMutationResult?: (
    result: import("../../../lib/admin/admin-action-result").AdminActionResult,
  ) => void;
};

/**
 * Shared Entity List table engine — builds thead/tbody from column config.
 * Entity pages must not reassemble table structure; only pass config + renderers.
 */
export default function AdminEntityListTable<
  TRow,
  TKey extends string,
  TSortKey extends string,
  TId extends AdminGridId = AdminGridId,
>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  sort,
  sortMode,
  selection,
  selectionLabel = "تحديد كل الصفوف في الصفحة",
  scrollLabel = "جدول بيانات الإدارة",
  actionsColumnWidth,
  empty,
  className = "",
  getRowDepth,
  rowClassName,
  onMutationResult,
}: AdminEntityListTableProps<TRow, TKey, TSortKey, TId>) {
  const selectionColumnWidth = 46;
  const showSelection = Boolean(selection);
  const flexibleColumnKey = columns.find(
    (column) =>
      !column.primary &&
      column.sticky !== "start" &&
      column.sticky !== "end",
  )?.key;

  function getColumnBaseWidth(
    column: AdminEntityColumnDef<TRow, TKey, TSortKey>,
  ) {
    return column.sticky === "end"
      ? actionsColumnWidth
      : Math.max(column.minWidth, column.width ?? column.minWidth);
  }

  const tableMinWidth =
    (showSelection ? selectionColumnWidth : 0) +
    columns.reduce(
      (total, column) => total + getColumnBaseWidth(column),
      0,
    );

  function getColumnTrackStyle(
    column: AdminEntityColumnDef<TRow, TKey, TSortKey>,
  ) {
    if (column.sticky === "end") {
      return getAdminDataGridFixedColumnStyle(actionsColumnWidth);
    }

    return column.key === flexibleColumnKey
      ? undefined
      : getAdminDataGridFixedColumnStyle(getColumnBaseWidth(column));
  }

  function renderHeaderLabel(column: AdminEntityColumnDef<TRow, TKey, TSortKey>) {
    if (!column.sortable || !column.sortKey || !sortMode) {
      return column.label;
    }

    const active = sort?.key === column.sortKey;
    const direction = sort?.direction ?? "asc";

    if (sortMode.mode === "href") {
      return (
        <AdminDataGridSortLink
          href={sortMode.hrefFor(column.key, column.sortKey)}
          active={active}
          direction={direction}
          className={column.primary ? "justify-start" : ""}
        >
          {column.label}
        </AdminDataGridSortLink>
      );
    }

    return (
      <AdminDataGridSortLabel
        active={active}
        direction={direction}
        onClick={() => sortMode.onToggle(column.sortKey!)}
        className={column.primary ? "justify-start" : "mx-auto"}
      >
        {column.label}
      </AdminDataGridSortLabel>
    );
  }

  return (
    <AdminDataGrid
      scrollLabel={scrollLabel}
      className={`max-w-full ${className}`.trim()}
    >
      <table
        style={{
          width: flexibleColumnKey === undefined ? tableMinWidth : "100%",
          minWidth: tableMinWidth,
        }}
        className="w-full table-fixed border-separate border-spacing-0 text-right"
      >
        <colgroup>
          {showSelection ? (
            <col
              style={getAdminDataGridFixedColumnStyle(selectionColumnWidth)}
            />
          ) : null}
          {columns.map((column) => (
            <col
              key={column.key}
              style={getColumnTrackStyle(column)}
            />
          ))}
        </colgroup>
        <thead>
          <tr className={ADMIN_DATA_GRID_HEADER_CLASSES}>
            {showSelection && selection ? (
              <th className="sticky start-0 z-40 w-[46px] min-w-[46px] bg-[#10151C] px-3 py-4 text-center">
                <AdminDataGridCheckbox
                  inputRef={selection.selectAllRef}
                  checked={selection.allSelected}
                  onChange={(event) =>
                    selection.toggleAll(event.currentTarget.checked)
                  }
                  label={selectionLabel}
                />
              </th>
            ) : null}
            {columns.map((column) => {
              const content = renderHeaderLabel(column);
              if (column.sticky === "end") {
                return (
                  <AdminDataGridStickyActionsHeaderCell
                    key={column.key}
                    width={actionsColumnWidth}
                  >
                    {content}
                  </AdminDataGridStickyActionsHeaderCell>
                );
              }

              const stickyPrimary =
                column.primary || column.sticky === "start"
                  ? showSelection
                    ? "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-[46px] min-[641px]:z-40 bg-[#10151C] text-right"
                    : "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-0 min-[641px]:z-40 bg-[#10151C] text-right"
                  : "";

              return (
                <th
                  key={column.key}
                  style={getColumnTrackStyle(column)}
                  className={`whitespace-nowrap px-4 py-4 text-center ${stickyPrimary}`}
                >
                  {content}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = getRowId(row);
            const depth = getRowDepth?.(row) ?? 0;
            return (
              <tr
                key={String(rowId)}
                className={`group border-b border-white/8 transition hover:bg-white/[0.035] ${
                  rowClassName?.(row) ?? ""
                }`}
                data-entity-row-id={String(rowId)}
                data-entity-depth={depth}
              >
                {showSelection && selection ? (
                  <td className="sticky start-0 z-30 w-[46px] min-w-[46px] border-b border-white/8 bg-[#080B10] px-3 py-4 text-center transition group-last:border-b-0 group-hover:bg-[#0D1117]">
                    <AdminDataGridCheckbox
                      checked={selection.selectedSet.has(rowId)}
                      onChange={(event) =>
                        selection.toggleOne(rowId, event.currentTarget.checked)
                      }
                      label={`تحديد ${getRowLabel(row)}`}
                    />
                  </td>
                ) : null}
                {columns.map((column) => {
                  const content = column.renderCell({
                    row,
                    rowId,
                    onMutationResult,
                  });
                  if (column.sticky === "end") {
                    return (
                      <AdminDataGridStickyActionsCell
                        key={column.key}
                        width={actionsColumnWidth}
                        className="border-b border-white/8 group-last:border-b-0"
                      >
                        {content}
                      </AdminDataGridStickyActionsCell>
                    );
                  }

                  const stickyPrimary =
                    column.primary || column.sticky === "start"
                      ? showSelection
                        ? "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-[46px] min-[641px]:z-30 bg-[#080B10] text-right transition group-hover:bg-[#0D1117]"
                        : "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-0 min-[641px]:z-30 bg-[#080B10] text-right transition group-hover:bg-[#0D1117]"
                      : "";

                  return (
                    <td
                      key={column.key}
                      style={{
                        ...(getColumnTrackStyle(column) ?? {}),
                        ...(column.primary && depth > 0
                          ? { paddingInlineStart: undefined }
                          : {}),
                      }}
                      className={`min-w-0 overflow-hidden border-b border-white/8 px-4 py-4 text-center text-sm text-white/68 group-last:border-b-0 ${stickyPrimary}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length ? <AdminDataGridEmpty>{empty}</AdminDataGridEmpty> : null}
    </AdminDataGrid>
  );
}
