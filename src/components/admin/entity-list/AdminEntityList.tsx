"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AdminNotice from "../AdminNotice";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import {
  getDefaultVisibleColumnKeys,
  resolveActiveSortColumnKey,
  sanitizeVisibleColumnKeys,
  type AdminEntityBulkOption,
  type AdminEntityColumnDef,
  type AdminEntityFeedbackMapper,
  type AdminEntityPersistResult,
} from "../../../lib/admin/entity-list";
import AdminBulkActionBar from "../ui/AdminBulkActionBar";
import AdminColumnVisibilityMenu from "../ui/AdminColumnVisibilityMenu";
import AdminListboxSelect from "../ui/AdminListboxSelect";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "../ui/admin-scrollbar-styles";
import { useAdminGridSelection, type AdminGridId } from "../ui/useAdminGridSelection";
import AdminEntityListTable, {
  type AdminEntityListTableProps,
  type AdminEntitySortState,
} from "./AdminEntityListTable";
import {
  AdminFloatingLayerProvider,
  useAdminFloatingLayer,
} from "./AdminFloatingLayerContext";

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
  onPersistColumns?: (
    columns: string[],
  ) => Promise<AdminEntityPersistResult>;
  enableColumnManagement?: boolean;
  enableSelection?: boolean;
  selectionLabel?: string;
  bulkOptions?: readonly AdminEntityBulkOption[];
  bulkEntityLabel?: string;
  onBulkExecute?: (action: string, ids: TId[]) => Promise<AdminActionResult>;
  bulkAdditionalControls?: (ctx: {
    bulkAction: string;
    setBulkAction: (value: string) => void;
    pending: boolean;
    openLayerId: string | null;
    setOpenLayerId: (id: string | null) => void;
  }) => ReactNode;
  mapResultToFeedback: AdminEntityFeedbackMapper;
  sort?: AdminEntitySortState<TSortKey> | null;
  sortMode?: AdminEntityListTableProps<TRow, TKey, TSortKey, TId>["sortMode"];
  onSortColumnHidden?: () => void;
  actionsColumnWidth: number;
  empty: ReactNode;
  getRowDepth?: (row: TRow) => number;
  rowClassName?: (row: TRow) => string;
  toolbarStart?: ReactNode;
  initialFeedback?: AdminActionFeedback | null;
};

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
    onPersistColumns,
    enableColumnManagement = Boolean(onPersistColumns),
    enableSelection = Boolean(props.bulkOptions?.length),
    selectionLabel,
    bulkOptions = [],
    bulkEntityLabel = "عنصر",
    onBulkExecute,
    bulkAdditionalControls,
    mapResultToFeedback,
    sort,
    sortMode,
    onSortColumnHidden,
    actionsColumnWidth,
    empty,
    getRowDepth,
    rowClassName,
    toolbarStart,
    initialFeedback = null,
  } = props;

  const router = useRouter();
  const floating = useAdminFloatingLayer();
  const bulkPendingRef = useRef(false);
  const sortCorrectionRef = useRef(false);
  const selection = useAdminGridSelection(rows.map(getRowId));
  const [visibleColumns, setVisibleColumns] = useState<TKey[]>(() =>
    sanitizeVisibleColumnKeys(
      columns,
      initialVisibleColumns ?? getDefaultVisibleColumnKeys(columns),
    ),
  );
  const [bulkAction, setBulkAction] = useState(bulkOptions[0]?.value ?? "");
  const [bulkPending, setBulkPending] = useState(false);
  const [feedback, setFeedback] = useState<AdminActionFeedback | null>(
    initialFeedback,
  );
  const [feedbackRevision, setFeedbackRevision] = useState(0);

  const visibleColumnDefs = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [columns, visibleColumns],
  );

  useEffect(() => {
    sortCorrectionRef.current = false;
  }, [sort?.key, sort?.direction]);

  function showFeedback(result: AdminActionResult) {
    setFeedback(mapResultToFeedback(result));
    setFeedbackRevision((current) => current + 1);
  }

  function handleMutationResult(result: AdminActionResult) {
    showFeedback(result);
    if (result.ok && result.code === "deleted" && result.entityId != null) {
      selection.removeSelection(result.entityId as TId);
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
    if (!onBulkExecute || bulkPendingRef.current) return;
    bulkPendingRef.current = true;
    setBulkPending(true);
    try {
      const result = await onBulkExecute(action, ids);
      showFeedback(result);
      if (result.ok) {
        selection.clearSelection();
        router.refresh();
      }
    } catch {
      showFeedback({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
      });
    } finally {
      bulkPendingRef.current = false;
      setBulkPending(false);
    }
  }

  const openLayerId = floating?.openLayerId ?? null;
  const setOpenLayerId = floating?.setOpenLayerId ?? (() => undefined);

  return (
    <section id={listId} className="scroll-mt-6 space-y-3" data-admin-entity-list="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{toolbarStart}</div>
        {enableColumnManagement && onPersistColumns ? (
          <AdminColumnVisibilityMenu
            columns={columns}
            visibleColumns={visibleColumns}
            defaultColumns={getDefaultVisibleColumnKeys(columns)}
            onChange={handleVisibleColumnsChange}
            onPersist={onPersistColumns}
            scrollAreaClassName={ADMIN_SCROLLBAR_VISUAL_CLASSES}
          />
        ) : null}
      </div>

      {feedback ? (
        <AdminNotice
          key={feedbackRevision}
          variant={feedback.variant}
          layout={feedback.layout}
          dismissible={feedback.dismissible}
          title={feedback.title}
          message={feedback.message}
          action={feedback.action}
        />
      ) : null}

      {enableSelection && bulkOptions.length && onBulkExecute ? (
        <AdminBulkActionBar
          selectedIds={selection.selectedIds}
          entityLabel={bulkEntityLabel}
          options={[...bulkOptions]}
          onClearSelection={selection.clearSelection}
          onExecute={executeBulk}
          isBusy={bulkPending}
          actionValue={bulkAction}
          actionControl={
            <AdminListboxSelect
              id={`${listId}-bulk-action`}
              layerId={`${listId}-bulk-action`}
              openLayerId={openLayerId}
              onOpenLayer={setOpenLayerId}
              value={bulkAction}
              onChange={setBulkAction}
              disabled={bulkPending}
              options={bulkOptions}
              className="w-[180px]"
            />
          }
          additionalControls={bulkAdditionalControls?.({
            bulkAction,
            setBulkAction,
            pending: bulkPending,
            openLayerId,
            setOpenLayerId,
          })}
        />
      ) : null}

      <AdminEntityListTable
        rows={rows}
        columns={visibleColumnDefs}
        getRowId={getRowId}
        getRowLabel={getRowLabel}
        sort={sort}
        sortMode={sortMode}
        selection={enableSelection ? selection : null}
        selectionLabel={selectionLabel}
        actionsColumnWidth={actionsColumnWidth}
        empty={empty}
        getRowDepth={getRowDepth}
        rowClassName={rowClassName}
        onMutationResult={handleMutationResult}
      />
    </section>
  );
}

export default function AdminEntityList<
  TRow,
  TKey extends string,
  TSortKey extends string,
  TId extends AdminGridId = AdminGridId,
>(props: AdminEntityListProps<TRow, TKey, TSortKey, TId>) {
  return (
    <AdminFloatingLayerProvider>
      <AdminEntityListInner {...props} />
    </AdminFloatingLayerProvider>
  );
}
