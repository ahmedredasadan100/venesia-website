"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AdminNotice from "../AdminNotice";
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
  defaultVisibleColumns?: readonly string[];
  onPersistColumns?: (
    columns: string[],
  ) => Promise<AdminEntityPersistResult>;
  onRestoreColumns?: () => Promise<AdminEntityPersistResult>;
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
    bulkOptions = [],
    bulkEntityLabel = "عنصر",
    onBulkExecute,
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
    toolbarStart,
    initialFeedback = null,
  } = props;

  const router = useRouter();
  const floating = useAdminFloatingLayer();
  const bulkPendingRef = useRef(false);
  const sortCorrectionRef = useRef(false);
  const feedbackSlotRef = useRef<HTMLDivElement>(null);
  const revealedFeedbackRevisionRef = useRef<number | null>(null);
  const pendingFeedbackFocusRevisionRef = useRef<number | null>(null);
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
  const initialFeedbackSignature = initialFeedback
    ? `${initialFeedback.variant}|${initialFeedback.title}|${initialFeedback.message}`
    : null;
  const [feedbackState, setFeedbackState] = useState(() => ({
    sourceSignature: initialFeedbackSignature,
    feedback: initialFeedback,
    revision: 0,
    shouldReveal: isAttentionFeedback(initialFeedback),
    shouldFocus: isAttentionFeedback(initialFeedback),
  }));

  if (feedbackState.sourceSignature !== initialFeedbackSignature) {
    setFeedbackState({
      sourceSignature: initialFeedbackSignature,
      feedback: initialFeedback,
      revision: feedbackState.revision + 1,
      shouldReveal: isAttentionFeedback(initialFeedback),
      shouldFocus: isAttentionFeedback(initialFeedback),
    });
  }

  const feedback =
    feedbackState.sourceSignature === initialFeedbackSignature
      ? feedbackState.feedback
      : initialFeedback;
  const feedbackRevision = feedbackState.revision;

  const visibleColumnDefs = columns.filter((column) =>
    visibleColumns.includes(column.key),
  );

  useEffect(() => {
    sortCorrectionRef.current = false;
  }, [sort?.key, sort?.direction]);

  useEffect(() => {
    if (!feedback || !feedbackState.shouldReveal) {
      pendingFeedbackFocusRevisionRef.current = null;
      return;
    }

    const slot = feedbackSlotRef.current;
    if (!slot) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (revealedFeedbackRevisionRef.current !== feedbackRevision) {
      revealedFeedbackRevisionRef.current = feedbackRevision;
      const rect = slot.getBoundingClientRect();
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (isVisible) {
        pendingFeedbackFocusRevisionRef.current = null;
        return;
      }

      slot.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest",
      });
      pendingFeedbackFocusRevisionRef.current = feedbackState.shouldFocus
        ? feedbackRevision
        : null;
    }

    if (
      !feedbackState.shouldFocus ||
      pendingFeedbackFocusRevisionRef.current !== feedbackRevision
    ) {
      return;
    }
    if (prefersReducedMotion) {
      slot.focus({ preventScroll: true });
      pendingFeedbackFocusRevisionRef.current = null;
      return;
    }

    const focusTimer = window.setTimeout(() => {
      if (pendingFeedbackFocusRevisionRef.current !== feedbackRevision) return;
      slot.focus({ preventScroll: true });
      pendingFeedbackFocusRevisionRef.current = null;
    }, 350);
    return () => window.clearTimeout(focusTimer);
  }, [
    feedback,
    feedbackRevision,
    feedbackState.shouldFocus,
    feedbackState.shouldReveal,
  ]);

  function showFeedback(
    result: AdminActionResult,
    options: { bulk?: boolean } = {},
  ) {
    const nextFeedback = mapResultToFeedback(result);
    const shouldFocus = isAttentionFeedback(nextFeedback);
    setFeedbackState((current) => ({
      sourceSignature: initialFeedbackSignature,
      feedback: nextFeedback,
      revision: current.revision + 1,
      shouldReveal:
        shouldFocus || options.bulk === true || result.code === "deleted",
      shouldFocus,
    }));
  }

  function dismissFeedback() {
    setFeedbackState((current) => ({
      ...current,
      feedback: null,
      revision: current.revision + 1,
      shouldReveal: false,
      shouldFocus: false,
    }));
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
        ) : null}
      </div>

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

      {feedback ? (
        <div
          ref={feedbackSlotRef}
          tabIndex={feedbackState.shouldFocus ? -1 : undefined}
          data-admin-entity-feedback-slot=""
          data-admin-entity-feedback-reveal={
            feedbackState.shouldReveal ? "true" : "false"
          }
          className="scroll-mt-6 focus:outline-none"
        >
          <AdminNotice
            key={feedbackRevision}
            variant={feedback.variant}
            layout={feedback.layout}
            dismissible
            lifecycle={feedback.lifecycle}
            dismissSearchParams={feedback.dismissSearchParams}
            title={feedback.title}
            message={feedback.message}
            action={feedback.action}
            onDismiss={dismissFeedback}
          />
        </div>
      ) : null}

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
        actionsColumnWidth={actionsColumnWidth}
        empty={resolveAdminEntityListEmptyState(emptyState)}
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
