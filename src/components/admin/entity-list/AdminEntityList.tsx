"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../AdminFeedbackProvider";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import {
  getDefaultVisibleColumnKeys,
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
import { useAdminGridSelection, type AdminGridId } from "../ui/useAdminGridSelection";
import AdminEntityListTable, {
  type AdminEntityListTableProps,
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
  onPersistColumns?: (
    columns: string[],
  ) => Promise<AdminEntityPersistResult>;
  onRestoreColumns?: () => Promise<AdminEntityPersistResult>;
  enableColumnManagement?: boolean;
  enableSelection?: boolean;
  selectionLabel?: string;
  scrollLabel?: string;
  bulkOptions?: readonly AdminEntityBulkOption[];
  bulkEntityLabel?: string;
  onBulkExecute?: (action: string, ids: TId[]) => Promise<AdminActionResult>;
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
};

function isAttentionFeedback(feedback: AdminActionFeedback | null) {
  return Boolean(
    feedback &&
      (feedback.variant === "danger" ||
        feedback.variant === "warning" ||
        feedback.lifecycle === "persistent"),
  );
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
    enableColumnManagement = Boolean(onPersistColumns),
    enableSelection = Boolean(props.bulkOptions?.length),
    selectionLabel,
    scrollLabel,
    bulkOptions = [],
    bulkEntityLabel = "عنصر",
    onBulkExecute,
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

  const router = useRouter();
  const floating = useAdminFloatingLayer();
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const bulkPendingRef = useRef(false);
  const sortCorrectionRef = useRef(false);
  const feedbackChannel = `entity-list:${listId}`;
  const selection = useAdminGridSelection(rows.map(getRowId));
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
  const [bulkPending, setBulkPending] = useState(false);
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

  useEffect(() => {
    sortCorrectionRef.current = false;
  }, [sort?.key, sort?.direction]);

  useEffect(() => {
    clearFeedback(feedbackChannel);
    if (initialFeedback) {
      publishFeedback(initialFeedback, {
        channel: feedbackChannel,
        placement: "inline",
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
      placement: "inline",
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
    if (!onBulkExecute || bulkPendingRef.current) return;
    bulkPendingRef.current = true;
    setBulkPending(true);
    try {
      const result = await onBulkExecute(action, ids);
      showFeedback(result, { bulk: true });
      if (result.ok) {
        selection.clearSelection();
        if (onSuccessfulMutation) await onSuccessfulMutation(result);
        else router.refresh();
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
    } finally {
      bulkPendingRef.current = false;
      setBulkPending(false);
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
  const columnsControl =
    enableColumnManagement && onPersistColumns ? (
      <AdminColumnVisibilityMenu
        columns={columns}
        visibleColumns={visibleColumns}
        defaultColumns={resolvedDefaultVisibleColumns}
        onChange={handleVisibleColumnsChange}
        onPersist={onPersistColumns}
        onRestore={onRestoreColumns}
        onPersisted={() => {
          if (onSuccessfulMutation) void onSuccessfulMutation();
          else router.refresh();
        }}
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

      <AdminFeedbackChannelViewport
        channel={feedbackChannel}
        label={`إشعارات ${listId}`}
      />

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
