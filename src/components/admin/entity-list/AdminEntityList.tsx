"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAdminFeedback } from "../AdminFeedbackProvider";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import type { AdminInstantMutationBulkInteraction } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  getDefaultVisibleColumnKeys,
  isAdminEntityPrimaryColumnPresentation,
  resolveAdminEntityListEmptyState,
  resolveActiveSortColumnKey,
  sanitizeVisibleColumnKeys,
  type AdminEntityBulkOption,
  type AdminEntityColumnDef,
  type AdminEntityFeedbackMapper,
  type AdminEntityListEmptyState,
  type AdminEntityPersistResult,
} from "../../../lib/admin/entity-list";
import AdminBulkActionBar from "../ui/AdminBulkActionBar";
import AdminColumnVisibilityMenu from "../ui/AdminColumnVisibilityMenu";
import AdminListboxSelect from "../ui/AdminListboxSelect";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "../ui/admin-scrollbar-styles";
import {
  useAdminGridSelection,
  type AdminGridId,
} from "../ui/useAdminGridSelection";
import AdminEntityListTable, {
  type AdminEntityListTableProps,
  type AdminEntityListSizingStrategy,
  type AdminEntitySortState,
} from "./AdminEntityListTable";
import AdminEntityListFilters, {
  type AdminEntityListFiltersProps,
} from "./AdminEntityListFilters";
import { AdminEntityListPrimarySection } from "./AdminEntityListSurface";
import {
  AdminFloatingLayerProvider,
  type AdminEntityListConfirmationSnapshot,
  useAdminFloatingLayer,
} from "./AdminFloatingLayerContext";

export type AdminEntityListBulkConfirmation = Pick<
  AdminEntityListConfirmationSnapshot,
  "title" | "description" | "confirmLabel" | "cancelLabel"
>;

type AdminEntityListBulkExecutionProps<TId extends AdminGridId> =
  | {
      onBulkExecute: (action: string, ids: TId[]) => Promise<AdminActionResult>;
      bulkInteraction: AdminInstantMutationBulkInteraction;
    }
  | {
      onBulkExecute?: undefined;
      bulkInteraction?: never;
    };

export type AdminEntityListProps<
  TRow,
  TKey extends string,
  TSortKey extends string,
  TId extends AdminGridId = AdminGridId,
> = {
  listId: string;
  rows: readonly TRow[];
  columns: readonly AdminEntityColumnDef<TRow, TKey, TSortKey>[];
  getRowId: (row: TRow) => TId;
  getRowLabel: (row: TRow) => string;
  initialVisibleColumns?: readonly string[];
  defaultVisibleColumns?: readonly string[];
  onPersistColumns?: (columns: string[]) => Promise<AdminEntityPersistResult>;
  onRestoreColumns?: () => Promise<AdminEntityPersistResult>;
  /** @deprecated The official control is always rendered when persistence is declared. */
  enableColumnManagement?: boolean;
  enableSelection?: boolean;
  selectionLabel?: string;
  scrollLabel?: string;
  sizingStrategy: AdminEntityListSizingStrategy<TKey>;
  fillAvailableWidth?: boolean;
  bulkOptions?: readonly AdminEntityBulkOption[];
  bulkEntityLabel?: string;
  getBulkConfirmation?: (
    action: string,
    ids: TId[],
  ) => AdminEntityListBulkConfirmation | null;
  bulkAdditionalControls?: (ctx: {
    bulkAction: string;
    setBulkAction: (value: string) => void;
    pending: boolean;
    openLayerId: string | null;
    setOpenLayerId: (id: string | null) => void;
  }) => ReactNode;
  /**
   * Prefer cache invalidation over a full RSC refresh when provided.
   * Receives the action result so engine consumers can apply targeted
   * cache patches before revalidation.
   */
  onSuccessfulMutation?: (result?: AdminActionResult) => void | Promise<void>;
  mapResultToFeedback: AdminEntityFeedbackMapper;
  sort?: AdminEntitySortState<TSortKey> | null;
  sortMode?: AdminEntityListTableProps<TRow, TKey, TSortKey, TId>["sortMode"];
  onSortColumnHidden?: () => void;
  actionsColumnWidth: number;
  emptyState: AdminEntityListEmptyState;
  getRowDepth?: (row: TRow) => number;
  rowClassName?: (row: TRow) => string;
  /** Shared Collection toolbar/search/filter contract. */
  toolbar?: Omit<
    AdminEntityListFiltersProps,
    "columnsControl" | "contextOverride" | "contextOverrideActive"
  >;
  /** @deprecated Use toolbar. Kept only for classified legacy consumers. */
  toolbarStart?: ReactNode;
  initialFeedback?: AdminActionFeedback | null;
} & AdminEntityListBulkExecutionProps<TId>;

function isAttentionFeedback(feedback: AdminActionFeedback | null) {
  return Boolean(
    feedback &&
    (feedback.variant === "danger" ||
      feedback.variant === "warning" ||
      feedback.lifecycle === "persistent"),
  );
}

function assertAdminEntityListContracts<
  TRow,
  TKey extends string,
  TSortKey extends string,
>(input: {
  listId: string;
  columns: readonly AdminEntityColumnDef<TRow, TKey, TSortKey>[];
  sizingStrategy: AdminEntityListSizingStrategy<TKey>;
  sortMode: AdminEntityListTableProps<TRow, TKey, TSortKey>["sortMode"];
}) {
  const columnKeys = new Set(input.columns.map((column) => column.key));
  if (columnKeys.size !== input.columns.length) {
    throw new Error(
      `[AdminEntityList:${input.listId}] column keys must be unique.`,
    );
  }

  const invalidWidthColumn = input.columns.find(
    (column) =>
      !Number.isFinite(column.minWidth) ||
      column.minWidth <= 0 ||
      (column.width !== undefined &&
        (!Number.isFinite(column.width) || column.width < column.minWidth)),
  );
  if (invalidWidthColumn) {
    throw new Error(
      `[AdminEntityList:${input.listId}] column ${invalidWidthColumn.key} must declare a positive minimum width and a preferred width that is not smaller.`,
    );
  }

  const primaryColumns = input.columns.filter(
    (column) => column.primary === true,
  );
  if (primaryColumns.length !== 1) {
    throw new Error(
      `[AdminEntityList:${input.listId}] exactly one primary column is required.`,
    );
  }
  if (
    !isAdminEntityPrimaryColumnPresentation(
      primaryColumns[0]?.primaryPresentation,
    )
  ) {
    throw new Error(
      `[AdminEntityList:${input.listId}] the primary column must explicitly declare a supported primaryPresentation.`,
    );
  }
  const nonPrimaryPresentationColumn = input.columns.find(
    (column) =>
      column.primary !== true && "primaryPresentation" in column,
  );
  if (nonPrimaryPresentationColumn) {
    throw new Error(
      `[AdminEntityList:${input.listId}] only the primary column may declare primaryPresentation.`,
    );
  }
  if (primaryColumns[0]?.sticky !== "start") {
    throw new Error(
      `[AdminEntityList:${input.listId}] the primary column must explicitly declare sticky: "start".`,
    );
  }

  const stickyEndColumns = input.columns.filter(
    (column) => column.sticky === "end",
  );
  if (stickyEndColumns.length > 1) {
    throw new Error(
      `[AdminEntityList:${input.listId}] at most one sticky end column is allowed.`,
    );
  }
  const firstStickyEndTrack = input.columns.findIndex(
    (column) => column.sticky === "end" || column.sticky === "end-adjacent",
  );
  if (firstStickyEndTrack >= 0) {
    const stickyTail = input.columns.slice(firstStickyEndTrack);
    if (
      stickyTail.some(
        (column) => column.sticky !== "end" && column.sticky !== "end-adjacent",
      ) ||
      stickyTail.at(-1)?.sticky !== "end"
    ) {
      throw new Error(
        `[AdminEntityList:${input.listId}] sticky end-adjacent columns must form one contiguous tail ending in sticky: "end".`,
      );
    }
  }

  const flexibleColumns = input.columns.filter(
    (column) => column.flexible === true,
  );

  if (input.sizingStrategy.mode === "flexible") {
    if (
      flexibleColumns.length !== 1 ||
      flexibleColumns[0]?.key !== input.sizingStrategy.columnKey
    ) {
      throw new Error(
        `[AdminEntityList:${input.listId}] flexible sizing requires exactly one matching column with flexible: true.`,
      );
    }
  } else if (flexibleColumns.length !== 0) {
    throw new Error(
      `[AdminEntityList:${input.listId}] fixed sizing cannot declare a flexible column.`,
    );
  }

  const hasSortableColumn = input.columns.some(
    (column) => column.sortable === true && column.sortKey,
  );
  if (hasSortableColumn && !input.sortMode) {
    throw new Error(
      `[AdminEntityList:${input.listId}] sortable columns require an explicit sort mode.`,
    );
  }
}

function AdminEntityListInner<
  TRow,
  TKey extends string,
  TSortKey extends string,
  TId extends AdminGridId = AdminGridId,
>(props: AdminEntityListProps<TRow, TKey, TSortKey, TId>) {
  const {
    listId,
    rows,
    columns,
    getRowId,
    getRowLabel,
    initialVisibleColumns,
    defaultVisibleColumns,
    onPersistColumns,
    onRestoreColumns,
    enableSelection = Boolean(props.bulkOptions?.length),
    selectionLabel,
    scrollLabel,
    sizingStrategy,
    fillAvailableWidth,
    bulkOptions = [],
    bulkEntityLabel = "عنصر",
    onBulkExecute,
    bulkInteraction,
    getBulkConfirmation,
    bulkAdditionalControls,
    onSuccessfulMutation,
    mapResultToFeedback,
    sort,
    sortMode,
    onSortColumnHidden,
    actionsColumnWidth,
    emptyState,
    getRowDepth,
    rowClassName,
    toolbar,
    toolbarStart,
    initialFeedback = null,
  } = props;

  const floating = useAdminFloatingLayer();
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const sortCorrectionRef = useRef(false);
  const feedbackChannel = `entity-list:${listId}`;
  const selection = useAdminGridSelection(rows.map(getRowId));
  assertAdminEntityListContracts({
    listId,
    columns,
    sizingStrategy,
    sortMode,
  });
  const resolvedDefaultVisibleColumns = sanitizeVisibleColumnKeys(
    columns,
    defaultVisibleColumns ?? getDefaultVisibleColumnKeys(columns),
  );
  const [visibleColumns, setVisibleColumns] = useState<TKey[]>(() =>
    sanitizeVisibleColumnKeys(
      columns,
      initialVisibleColumns ?? resolvedDefaultVisibleColumns,
    ),
  );
  const [bulkAction, setBulkAction] = useState(bulkOptions[0]?.value ?? "");
  const initialFeedbackSignature = useMemo(
    () =>
      initialFeedback
        ? `${initialFeedback.variant}|${initialFeedback.title}|${initialFeedback.message}`
        : null,
    [initialFeedback],
  );

  const visibleColumnDefs = columns.filter((column) =>
    visibleColumns.includes(column.key),
  );
  const visibleSizingStrategy: AdminEntityListSizingStrategy<TKey> =
    sizingStrategy.mode === "flexible" &&
    visibleColumnDefs.some((column) => column.key === sizingStrategy.columnKey)
      ? sizingStrategy
      : { mode: "fixed" };

  useEffect(() => {
    sortCorrectionRef.current = false;
  }, [sort?.key, sort?.direction]);

  useEffect(() => {
    clearFeedback(feedbackChannel);
    if (initialFeedback) {
      publishFeedback(initialFeedback, {
        channel: feedbackChannel,
        placement: "global",
        reveal: isAttentionFeedback(initialFeedback),
      });
    }
    return () => clearFeedback(feedbackChannel);
  }, [
    clearFeedback,
    feedbackChannel,
    initialFeedback,
    initialFeedbackSignature,
    publishFeedback,
  ]);

  function showFeedback(
    result: AdminActionResult,
    options: { bulk?: boolean } = {},
  ) {
    const nextFeedback = mapResultToFeedback(result);
    const shouldFocus = isAttentionFeedback(nextFeedback);
    publishFeedback(nextFeedback, {
      channel: feedbackChannel,
      placement: "global",
      critical: shouldFocus,
      reveal: shouldFocus || options.bulk === true || result.code === "deleted",
    });
  }

  function handleMutationResult(result: AdminActionResult) {
    showFeedback(result);
    if (result.ok && result.code === "deleted" && result.entityId != null) {
      selection.removeSelection(result.entityId as TId);
    }
    if (result.ok && onSuccessfulMutation) {
      void onSuccessfulMutation(result);
    }
  }

  function handleVisibleColumnsChange(next: TKey[]) {
    const sanitized = sanitizeVisibleColumnKeys(columns, next);
    setVisibleColumns(sanitized);
    const activeKey = resolveActiveSortColumnKey(columns, sort?.key);
    if (
      activeKey &&
      !sanitized.includes(activeKey) &&
      !sortCorrectionRef.current
    ) {
      sortCorrectionRef.current = true;
      onSortColumnHidden?.();
    }
  }

  async function executeBulk(action: string, ids: TId[]) {
    if (!onBulkExecute || bulkInteraction?.isBlocked) return;
    try {
      const result = await onBulkExecute(action, ids);
      showFeedback(result, { bulk: true });
      if (result.ok) {
        selection.clearSelection();
      }
    } catch {
      showFeedback(
        {
          ok: false,
          title: "تعذر تنفيذ العملية",
          message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        },
        { bulk: true },
      );
    }
  }

  function requestBulkExecution(action: string, ids: TId[]) {
    const confirmation = getBulkConfirmation?.(action, ids) ?? null;
    if (!confirmation) {
      void executeBulk(action, ids);
      return;
    }
    if (!floating) {
      showFeedback(
        {
          ok: false,
          title: "تعذر فتح التأكيد",
          message: "لم يبدأ الإجراء لأن طبقة التأكيد المشتركة غير متاحة.",
        },
        { bulk: true },
      );
      return;
    }

    floating.openConfirmation({
      ...confirmation,
      onConfirm: () => executeBulk(action, ids),
    });
  }

  const openLayerId = floating?.openLayerId ?? null;
  const setOpenLayerId = floating?.setOpenLayerId ?? (() => undefined);
  const columnsControl = onPersistColumns ? (
    <AdminColumnVisibilityMenu
      columns={columns}
      visibleColumns={visibleColumns}
      defaultColumns={resolvedDefaultVisibleColumns}
      onChange={handleVisibleColumnsChange}
      onPersist={onPersistColumns}
      onRestore={onRestoreColumns}
      scrollAreaClassName={ADMIN_SCROLLBAR_VISUAL_CLASSES}
    />
  ) : null;
  const bulkBar =
    enableSelection && bulkOptions.length && onBulkExecute ? (
      <AdminBulkActionBar
        selectedIds={selection.selectedIds}
        entityLabel={bulkEntityLabel}
        options={[...bulkOptions]}
        onClearSelection={selection.clearSelection}
        onExecute={requestBulkExecution}
        isBusy={bulkInteraction.isBlocked}
        actionValue={bulkAction}
        actionControl={
          <AdminListboxSelect
            id={`${listId}-bulk-action`}
            layerId={`${listId}-bulk-action`}
            openLayerId={openLayerId}
            onOpenLayer={setOpenLayerId}
            value={bulkAction}
            onChange={setBulkAction}
            disabled={bulkInteraction.isBlocked}
            options={bulkOptions}
            className="w-[180px]"
          />
        }
        additionalControls={bulkAdditionalControls?.({
          bulkAction,
          setBulkAction,
          pending: bulkInteraction.isBlocked,
          openLayerId,
          setOpenLayerId,
        })}
      />
    ) : null;
  const selectionActive = selection.selectedIds.length > 0;
  const showLegacyToolbar = Boolean(
    !toolbar && (toolbarStart || columnsControl),
  );

  return (
    <section
      id={listId}
      className={`scroll-mt-6 flex flex-col ${toolbar ? "gap-0" : "gap-7"}`}
      data-admin-entity-list=""
    >
      {toolbar ? (
        <AdminEntityListFilters
          {...toolbar}
          columnsControl={columnsControl}
          contextOverride={bulkBar}
          contextOverrideActive={selectionActive}
        />
      ) : null}

      {showLegacyToolbar ? (
        <AdminEntityListPrimarySection>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">{toolbarStart}</div>
            {columnsControl}
          </div>
        </AdminEntityListPrimarySection>
      ) : null}

      {!toolbar ? bulkBar : null}

      <AdminEntityListPrimarySection>
        <AdminEntityListTable
          key={visibleColumnDefs.map((column) => column.key).join("|")}
          rows={rows}
          columns={visibleColumnDefs}
          getRowId={getRowId}
          getRowLabel={getRowLabel}
          sort={sort}
          sortMode={sortMode}
          selection={enableSelection ? selection : null}
          selectionLabel={selectionLabel}
          scrollLabel={scrollLabel}
          sizingStrategy={visibleSizingStrategy}
          fillAvailableWidth={fillAvailableWidth}
          actionsColumnWidth={actionsColumnWidth}
          empty={resolveAdminEntityListEmptyState(emptyState)}
          getRowDepth={getRowDepth}
          rowClassName={rowClassName}
          className={toolbar ? "!rounded-t-none !border-t-0" : undefined}
          onMutationResult={handleMutationResult}
        />
      </AdminEntityListPrimarySection>
    </section>
  );
}

export default function AdminEntityList<
  TRow,
  TKey extends string,
  TSortKey extends string,
  TId extends AdminGridId = AdminGridId,
>(props: AdminEntityListProps<TRow, TKey, TSortKey, TId>) {
  const existingLayer = useAdminFloatingLayer();
  if (existingLayer) {
    return <AdminEntityListInner {...props} />;
  }
  return (
    <AdminFloatingLayerProvider>
      <AdminEntityListInner {...props} />
    </AdminFloatingLayerProvider>
  );
}
