"use client";

import {
  Fragment,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { AdminEntityColumnDef } from "../../../lib/admin/entity-list";
import {
  AdminDataGrid,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridSortLink,
  AdminDataGridSortLabel,
  AdminDataGridStickyActionsCell,
  AdminDataGridStickyActionsHeaderCell,
  ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES,
  ADMIN_DATA_GRID_HEADER_CLASSES,
  ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT,
  getAdminDataGridFixedColumnStyle,
  getAdminDataGridPrimaryPresentationStyle,
} from "../ui/AdminDataGrid";
import type { AdminGridId } from "../ui/useAdminGridSelection";

const ADMIN_ENTITY_LIST_MINIMUM_FLEXIBLE_TRACK_WIDTH = 72;

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

type SortMode<TSortKey extends string> =
  | {
      mode: "href";
      hrefFor: (columnKey: string, sortKey: TSortKey) => string;
    }
  | {
      mode: "callback";
      onToggle: (sortKey: TSortKey) => void;
    };

export type AdminEntityListSizingStrategy<TKey extends string> =
  | {
      mode: "flexible";
      columnKey: TKey;
    }
  | {
      mode: "fixed";
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
  sortMode?: SortMode<TSortKey>;
  selection?: AdminEntityListSelectionApi<TId> | null;
  selectionLabel?: string;
  scrollLabel?: string;
  actionsColumnWidth: number;
  empty: ReactNode;
  className?: string;
  sizingStrategy: AdminEntityListSizingStrategy<TKey>;
  /**
   * Fills the available table surface without allowing a data column to absorb
   * the remaining width. A presentation-only spacer track owns the remainder.
   */
  fillAvailableWidth?: boolean;
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
  sizingStrategy,
  fillAvailableWidth = false,
  getRowDepth,
  rowClassName,
  onMutationResult,
}: AdminEntityListTableProps<TRow, TKey, TSortKey, TId>) {
  const selectionColumnWidth = 46;
  const showSelection = Boolean(selection);
  const flexibleColumnKey =
    sizingStrategy.mode === "flexible"
      ? sizingStrategy.columnKey
      : undefined;
  const fillSpacerBeforeColumnKey = columns.find(
    (column) => column.sticky === "end",
  )?.key;
  const showFillSpacer = fillAvailableWidth && flexibleColumnKey === undefined;
  const showTrailingFillSpacer =
    showFillSpacer && fillSpacerBeforeColumnKey === undefined;
  const tableRef = useRef<HTMLTableElement>(null);
  const [availableTableWidth, setAvailableTableWidth] = useState<number | null>(
    null,
  );

  useLayoutEffect(() => {
    const scrollport = tableRef.current?.parentElement;
    if (!scrollport) return;

    const updateAvailableWidth = () => {
      const nextWidth = scrollport.clientWidth;
      setAvailableTableWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
    };

    updateAvailableWidth();
    const observer = new ResizeObserver(updateAvailableWidth);
    observer.observe(scrollport);
    return () => observer.disconnect();
  }, []);

  function getColumnMinimumWidth(
    column: AdminEntityColumnDef<TRow, TKey, TSortKey>,
  ) {
    if (column.sticky === "end") {
      return actionsColumnWidth;
    }

    return column.minWidth;
  }

  function getColumnPreferredWidth(
    column: AdminEntityColumnDef<TRow, TKey, TSortKey>,
  ) {
    if (column.sticky === "end") {
      return actionsColumnWidth;
    }

    return Math.max(column.minWidth, column.width ?? column.minWidth);
  }

  const minimumColumnsWidth = columns.reduce(
    (total, column) => total + getColumnMinimumWidth(column),
    0,
  );
  const preferredColumnsWidth = columns.reduce(
    (total, column) => total + getColumnPreferredWidth(column),
    0,
  );
  const selectionWidth = showSelection ? selectionColumnWidth : 0;
  const minimumTableWidth = selectionWidth + minimumColumnsWidth;
  const preferredTableWidth = selectionWidth + preferredColumnsWidth;
  const fillsAvailableWidth =
    flexibleColumnKey !== undefined || showFillSpacer;
  const constrainedMinimumWidths = new Map<TKey, number>(
    columns.map((column) => [
      column.key,
      getColumnMinimumWidth(column),
    ]),
  );
  let constrainedWidthDeficit =
    fillsAvailableWidth && availableTableWidth !== null
      ? Math.max(0, minimumTableWidth - availableTableWidth)
      : 0;
  const constrainedPressureColumns = [
    ...columns.filter((column) => column.key === flexibleColumnKey),
    ...columns.filter(
      (column) => column.primary && column.key !== flexibleColumnKey,
    ),
  ];

  for (const column of constrainedPressureColumns) {
    if (constrainedWidthDeficit <= 0) break;
    const currentWidth = constrainedMinimumWidths.get(column.key) ?? 0;
    const safeFloor =
      column.key === flexibleColumnKey
        ? Math.min(
            currentWidth,
            ADMIN_ENTITY_LIST_MINIMUM_FLEXIBLE_TRACK_WIDTH,
          )
        : Math.min(
            currentWidth,
            ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textBudgetPx +
              ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.cellInlinePaddingPx * 2,
          );
    const reduction = Math.min(
      constrainedWidthDeficit,
      currentWidth - safeFloor,
    );
    constrainedMinimumWidths.set(column.key, currentWidth - reduction);
    constrainedWidthDeficit -= reduction;
  }

  const constrainedMinimumColumnsWidth = columns.reduce(
    (total, column) =>
      total +
      (constrainedMinimumWidths.get(column.key) ??
        getColumnMinimumWidth(column)),
    0,
  );
  const constrainedMinimumTableWidth =
    selectionWidth + constrainedMinimumColumnsWidth;
  const tableWidth = fillsAvailableWidth
    ? Math.max(
        constrainedMinimumTableWidth,
        availableTableWidth ?? preferredTableWidth,
      )
    : preferredTableWidth;
  const availableColumnsWidth = tableWidth - selectionWidth;
  const preferredGrowthBudget = Math.min(
    preferredColumnsWidth - constrainedMinimumColumnsWidth,
    Math.max(0, availableColumnsWidth - constrainedMinimumColumnsWidth),
  );
  const preferredHeadroom = columns.reduce(
    (total, column) =>
      total +
      (getColumnPreferredWidth(column) - getColumnMinimumWidth(column)),
    0,
  );
  const allocatedColumnWidths = new Map<TKey, number>();

  for (const column of columns) {
    const minimumWidth =
      constrainedMinimumWidths.get(column.key) ??
      getColumnMinimumWidth(column);
    const columnHeadroom = getColumnPreferredWidth(column) - minimumWidth;
    const preferredGrowth =
      preferredHeadroom > 0
        ? (preferredGrowthBudget * columnHeadroom) / preferredHeadroom
        : 0;
    allocatedColumnWidths.set(column.key, minimumWidth + preferredGrowth);
  }

  const flexibleGrowth =
    availableColumnsWidth -
    constrainedMinimumColumnsWidth -
    preferredGrowthBudget;
  if (flexibleColumnKey !== undefined && flexibleGrowth > 0) {
    allocatedColumnWidths.set(
      flexibleColumnKey,
      (allocatedColumnWidths.get(flexibleColumnKey) ?? 0) + flexibleGrowth,
    );
  }

  const stickyEndOffsets = new Map<TKey, number>();
  let nextStickyEndOffset = 0;
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index];
    if (column.sticky !== "end" && column.sticky !== "end-adjacent") {
      continue;
    }

    stickyEndOffsets.set(column.key, nextStickyEndOffset);
    nextStickyEndOffset += allocatedColumnWidths.get(column.key) ?? 0;
  }

  function getColumnTrackStyle(
    column: AdminEntityColumnDef<TRow, TKey, TSortKey>,
  ) {
    return getAdminDataGridFixedColumnStyle(
      allocatedColumnWidths.get(column.key) ??
        getColumnMinimumWidth(column),
    );
  }

  function getColumnPresentationStyle(
    column: AdminEntityColumnDef<TRow, TKey, TSortKey>,
  ) {
    const trackStyle = getColumnTrackStyle(column);
    if (!column.primary) return trackStyle;

    return {
      ...(trackStyle ?? {}),
      ...getAdminDataGridPrimaryPresentationStyle(
        column.primaryPresentation,
      ),
    };
  }

  function renderHeaderLabel(column: AdminEntityColumnDef<TRow, TKey, TSortKey>) {
    const sortKey = column.sortKey;
    if (!column.sortable || !sortKey || !sortMode) {
      return column.label;
    }

    const active = sort?.key === sortKey;
    const direction = sort?.direction ?? "asc";
    const alignment = column.align ?? (column.primary ? "start" : "center");
    const justifyClass =
      alignment === "start"
        ? "justify-start"
        : alignment === "end"
          ? "justify-end"
          : "justify-center";

    if (sortMode.mode === "href") {
      return (
        <AdminDataGridSortLink
          href={sortMode.hrefFor(column.key, sortKey)}
          active={active}
          direction={direction}
          announceState={false}
          className={justifyClass}
        >
          {column.label}
        </AdminDataGridSortLink>
      );
    }

    return (
      <AdminDataGridSortLabel
        active={active}
        direction={direction}
        announceState={false}
        onClick={() => sortMode.onToggle(sortKey)}
        className={justifyClass}
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
        ref={tableRef}
        data-admin-table-min-width={minimumTableWidth}
        data-admin-table-constrained-min-width={constrainedMinimumTableWidth}
        data-admin-table-preferred-width={preferredTableWidth}
        data-admin-table-width-budget={availableTableWidth ?? undefined}
        style={{
          width: tableWidth,
          minWidth: constrainedMinimumTableWidth,
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
            <Fragment key={column.key}>
              {showFillSpacer && column.key === fillSpacerBeforeColumnKey ? (
                <col data-admin-table-fill-spacer="" />
              ) : null}
              <col style={getColumnTrackStyle(column)} />
            </Fragment>
          ))}
          {showTrailingFillSpacer ? (
            <col data-admin-table-fill-spacer="" />
          ) : null}
        </colgroup>
        <thead>
          <tr
            className={`${ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES} ${ADMIN_DATA_GRID_HEADER_CLASSES}`}
          >
            {showSelection && selection ? (
              <th
                scope="col"
                className="sticky start-0 z-40 w-[46px] min-w-[46px] bg-[#10151C] text-center"
              >
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
              const ariaSort:
                | "ascending"
                | "descending"
                | "none"
                | undefined =
                column.sortable && column.sortKey && sortMode
                  ? sort?.key === column.sortKey
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined;
              const fillSpacer =
                showFillSpacer && column.key === fillSpacerBeforeColumnKey ? (
                  <th
                    aria-hidden="true"
                    data-admin-table-fill-spacer=""
                    style={{ padding: 0, borderInlineStart: 0 }}
                  />
                ) : null;
              if (column.sticky === "end") {
                return (
                  <Fragment key={column.key}>
                    {fillSpacer}
                    <AdminDataGridStickyActionsHeaderCell
                      width={actionsColumnWidth}
                      columnKey={column.key}
                    >
                      {content}
                    </AdminDataGridStickyActionsHeaderCell>
                  </Fragment>
                );
              }

              if (column.sticky === "end-adjacent") {
                return (
                  <Fragment key={column.key}>
                    {fillSpacer}
                    <th
                      scope="col"
                      aria-sort={ariaSort}
                      data-admin-grid-sticky="inline-end-adjacent"
                      data-admin-column-key={column.key}
                      style={{
                        ...getColumnTrackStyle(column),
                        insetInlineEnd: stickyEndOffsets.get(column.key) ?? 0,
                      }}
                      className="sticky z-30 whitespace-nowrap bg-[#10151C] text-center"
                    >
                      {content}
                    </th>
                  </Fragment>
                );
              }

              const stickyPrimary =
                column.sticky === "start"
                  ? showSelection
                    ? "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-[46px] min-[641px]:z-40 bg-[#10151C] text-right"
                    : "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-0 min-[641px]:z-40 bg-[#10151C] text-right"
                  : "";
              const alignment =
                column.align ?? (column.primary ? "start" : "center");
              const alignmentClass =
                alignment === "start"
                  ? "text-start"
                  : alignment === "end"
                    ? "text-end"
                    : "text-center";

              return (
                <Fragment key={column.key}>
                  {fillSpacer}
                  <th
                    scope="col"
                    aria-sort={ariaSort}
                    data-admin-column-key={column.key}
                    style={getColumnPresentationStyle(column)}
                    className={`whitespace-nowrap ${alignmentClass} ${stickyPrimary}`}
                  >
                    {content}
                  </th>
                </Fragment>
              );
            })}
            {showTrailingFillSpacer ? (
              <th
                aria-hidden="true"
                data-admin-table-fill-spacer=""
                style={{ padding: 0, borderInlineStart: 0 }}
              />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = getRowId(row);
            const depth = getRowDepth?.(row) ?? 0;
            return (
              <tr
                key={String(rowId)}
                className={`group ${ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES} border-b border-white/8 transition hover:bg-white/[0.035] ${
                  rowClassName?.(row) ?? ""
                }`}
                data-entity-row-id={String(rowId)}
                data-entity-depth={depth}
              >
                {showSelection && selection ? (
                  <td className="sticky start-0 z-30 w-[46px] min-w-[46px] border-b border-white/8 bg-[#080B10] text-center transition group-last:border-b-0 group-hover:bg-[#0D1117]">
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
                  const fillSpacer =
                    showFillSpacer &&
                    column.key === fillSpacerBeforeColumnKey ? (
                      <td
                        aria-hidden="true"
                        data-admin-table-fill-spacer=""
                        style={{ padding: 0, borderInlineStart: 0 }}
                      />
                    ) : null;
                  if (column.sticky === "end") {
                    return (
                      <Fragment key={column.key}>
                        {fillSpacer}
                        <AdminDataGridStickyActionsCell
                          width={actionsColumnWidth}
                          columnKey={column.key}
                          className="border-b border-white/8 group-last:border-b-0"
                        >
                          {content}
                        </AdminDataGridStickyActionsCell>
                      </Fragment>
                    );
                  }


                  if (column.sticky === "end-adjacent") {
                    return (
                      <Fragment key={column.key}>
                        {fillSpacer}
                        <td
                          data-admin-grid-sticky="inline-end-adjacent"
                          data-admin-column-key={column.key}
                          style={{
                            ...getColumnTrackStyle(column),
                            insetInlineEnd:
                              stickyEndOffsets.get(column.key) ?? 0,
                          }}
                          className="sticky z-20 min-w-0 overflow-hidden border-b border-white/8 bg-[#080B10] text-center text-sm text-white/68 transition group-last:border-b-0 group-hover:bg-[#0D1117]"
                        >
                          {content}
                        </td>
                      </Fragment>
                    );
                  }

                  const stickyPrimary =
                    column.sticky === "start"
                      ? showSelection
                        ? "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-[46px] min-[641px]:z-30 bg-[#080B10] text-right transition group-hover:bg-[#0D1117]"
                        : "max-[640px]:static max-[640px]:z-auto min-[641px]:sticky min-[641px]:start-0 min-[641px]:z-30 bg-[#080B10] text-right transition group-hover:bg-[#0D1117]"
                      : "";
                  const alignment =
                    column.align ?? (column.primary ? "start" : "center");
                  const alignmentClass =
                    alignment === "start"
                      ? "text-start"
                      : alignment === "end"
                        ? "text-end"
                        : "text-center";

                  return (
                    <Fragment key={column.key}>
                      {fillSpacer}
                      <td
                        data-admin-column-key={column.key}
                        style={{
                          ...(getColumnPresentationStyle(column) ?? {}),
                          ...(column.primary && depth > 0
                            ? { paddingInlineStart: undefined }
                            : {}),
                        }}
                        className={`min-w-0 overflow-hidden border-b border-white/8 text-sm text-white/68 group-last:border-b-0 ${alignmentClass} ${stickyPrimary}`}
                      >
                        {content}
                      </td>
                    </Fragment>
                  );
                })}
                {showTrailingFillSpacer ? (
                  <td
                    aria-hidden="true"
                    data-admin-table-fill-spacer=""
                    style={{ padding: 0, borderInlineStart: 0 }}
                  />
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length ? <AdminDataGridEmpty>{empty}</AdminDataGridEmpty> : null}
    </AdminDataGrid>
  );
}
