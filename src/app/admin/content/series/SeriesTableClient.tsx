"use client";

import { useCallback, useMemo } from "react";
import {
  AdminEntityList,
  AdminEntityListSurface,
  AdminEntityTrashHeader,
} from "../../../../components/admin/entity-list";
import {
  AdminEntityListPrimarySection,
  AdminEntityListTableRegion,
} from "../../../../components/admin/entity-list/AdminEntityListSurface";
import {
  AdminMetricCardsGrid,
  AdminTablePagination,
} from "../../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { AdminActionFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { SERIES_DEFAULT_COLUMN_KEYS } from "../../../../lib/admin/content/series-list-config";
import {
  seriesQueryContract,
  type SeriesFilters,
  type SeriesSortField,
} from "../../../../lib/admin/content/entity-list-contracts/series";
import type { SeriesListRow } from "../../../../lib/admin/content/load-series-list";
import {
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  type AdminEntityFilterDef,
  type AdminEntityFilterOption,
} from "../../../../lib/admin/entity-list";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import { useAdminEntityInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import { ADMIN_BULK_ACTION_LABELS } from "../../../../lib/admin/entity-list/bulk-action-labels";
import {
  bulkSeriesActionAjax,
  deleteSeriesAjax,
  duplicateSeriesAjax,
  emptySeriesTrashAjax,
  permanentlyDeleteSeriesAjax,
  restoreSeriesAjax,
  restoreSeriesTablePreferences,
  saveSeriesTablePreferences,
  toggleSeriesStatusAjax,
} from "./actions";
import {
  createSeriesColumns,
  SERIES_ACTIONS_COLUMN_WIDTH,
  type SeriesColumnKey,
  type SeriesRowActionHandlers,
  type SeriesSortKey,
} from "./series-columns";

const BASE_PATH = "/admin/content/series";

const BULK_OPTIONS = [
  { value: "publish", label: ADMIN_BULK_ACTION_LABELS.showSelected },
  { value: "hide", label: ADMIN_BULK_ACTION_LABELS.hideSelected },
  { value: "delete", label: ADMIN_BULK_ACTION_LABELS.deleteSelected },
] as const;

const TRASH_BULK_OPTIONS = [
  { value: "restore", label: ADMIN_BULK_ACTION_LABELS.restoreSelected },
  {
    value: "permanent_delete",
    label: ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected,
  },
] as const;

const STATUS_FILTER: AdminEntityFilterDef = {
  id: "series-status-filter",
  paramKey: "status",
  placeholder: "كل الحالات",
  label: "الحالة",
  type: "status",
  options: [
    { value: "published", label: "منشور" },
    { value: "unpublished", label: "غير منشور" },
  ],
  className: "min-w-[150px]",
};

type SeriesMetrics = {
  total: number;
  published: number;
  unpublished: number;
  topics: number;
  averageTopics: number;
  trashed: number;
  categoryOptions: AdminEntityFilterOption[];
  categoryDescendantIdsByValue: Record<string, number[]>;
};

export type { SeriesListRow };

export default function SeriesTableClient({
  initialQuery,
  initialResult,
  initialVisibleColumns,
  initialFeedback,
}: {
  initialQuery: AdminEntityListQuery<SeriesFilters, SeriesSortField>;
  initialResult: AdminEntityListResult<SeriesListRow, SeriesMetrics>;
  initialVisibleColumns?: string[];
  initialFeedback?: AdminActionFeedback | null;
}) {
  const controller = useAdminEntityListController({
    entity: "series",
    contract: seriesQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const instant = useAdminEntityInstantMutation<SeriesListRow, SeriesMetrics>(
    "series",
    controller.query,
  );
  const isTrashView = controller.query.filters.view === "trash";

  const toggleSeries = useCallback(
    async (row: SeriesListRow): Promise<AdminActionResult> => {
      const nextStatus =
        row.status === "published" ? "unpublished" : "published";
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            if (controller.query.filters.status !== "all") {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, status: nextStatus }
                : current,
            );
          },
          execute: async () => {
            const actionResult = await toggleSeriesStatusAjax(row.id, row.status);
            return actionResult.ok
              ? {
                  ok: true as const,
                  message: actionResult.message ?? "تم تحديث حالة السلسلة.",
                }
              : {
                  ok: false as const,
                  code: "series_status_failed",
                  message: actionResult.message ?? "تعذر تحديث حالة السلسلة.",
                };
          },
        });
        return {
          ok: true,
          title: "تم بنجاح",
          message: result.message,
          code: nextStatus === "published" ? "published" : "unpublished",
          entityId: row.id,
        };
      } catch (error) {
        return {
          ok: false,
          title: "تعذر تنفيذ العملية",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تحديث حالة السلسلة.",
          entityId: row.id,
        };
      }
    },
    [controller.query.filters.status, instant],
  );

  const duplicateSeries = useCallback(
    async (row: SeriesListRow): Promise<AdminActionResult> => {
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "duplicate",
          optimistic: () => undefined,
          execute: async () => {
            const actionResult = await duplicateSeriesAjax(row.id);
            return actionResult.ok
              ? {
                  ok: true as const,
                  message: actionResult.message ?? "تم نسخ السلسلة بنجاح.",
                  affectedIds:
                    actionResult.entityId == null
                      ? undefined
                      : [actionResult.entityId],
                }
              : {
                  ok: false as const,
                  code: "series_duplicate_failed",
                  message: actionResult.message ?? "تعذر نسخ السلسلة.",
                };
          },
        });
        const insertedId = Array.isArray(result.affectedIds)
          ? result.affectedIds.find((id): id is number => typeof id === "number")
          : undefined;
        return {
          ok: true,
          title: "تم بنجاح",
          message: result.message,
          code: "created",
          entityId: insertedId,
        };
      } catch (error) {
        return {
          ok: false,
          title: "تعذر نسخ السلسلة",
          message:
            error instanceof Error ? error.message : "تعذر نسخ السلسلة.",
          entityId: row.id,
        };
      }
    },
    [instant],
  );

  const runLifecycleMutation = useCallback(
    async (
      row: SeriesListRow,
      action: "delete" | "restore" | "permanent_delete",
      execute: () => Promise<AdminActionResult>,
    ): Promise<AdminActionResult> => {
      const resultHolder: { current?: AdminActionResult } = {};
      try {
        await instant.mutateAsync({
          rowId: row.id,
          action,
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: async () => {
            const actionResult = await execute();
            resultHolder.current = actionResult;
            return actionResult.ok
              ? {
                  ok: true as const,
                  message: actionResult.message,
                  feedbackStatus:
                    actionResult.feedbackStatus === "warning"
                      ? ("warning" as const)
                      : ("success" as const),
                }
              : {
                  ok: false as const,
                  code: `series_${action}_failed`,
                  message: actionResult.message,
                };
          },
        });
        if (resultHolder.current) return resultHolder.current;
      } catch (error) {
        if (resultHolder.current) return resultHolder.current;
        return {
          ok: false,
          title: "تعذر تنفيذ العملية",
          message:
            error instanceof Error ? error.message : "تعذر تحديث السلسلة.",
          entityId: row.id,
        };
      }

      return {
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "تعذر إثبات نتيجة تحديث السلسلة.",
        entityId: row.id,
      };
    },
    [instant],
  );

  const deleteSeries = useCallback(
    (row: SeriesListRow) =>
      runLifecycleMutation(row, "delete", () => deleteSeriesAjax(row.id)),
    [runLifecycleMutation],
  );

  const restoreSeries = useCallback(
    (row: SeriesListRow) =>
      runLifecycleMutation(row, "restore", () => restoreSeriesAjax(row.id)),
    [runLifecycleMutation],
  );

  const permanentlyDeleteSeries = useCallback(
    (row: SeriesListRow) =>
      runLifecycleMutation(row, "permanent_delete", () =>
        permanentlyDeleteSeriesAjax(row.id, true),
      ),
    [runLifecycleMutation],
  );

  const rowHandlers = useMemo<SeriesRowActionHandlers>(
    () => ({
      view: controller.query.filters.view,
      rowInteraction: instant.getRowInteraction,
      onToggle: toggleSeries,
      onDuplicate: duplicateSeries,
      onDelete: deleteSeries,
      onRestore: restoreSeries,
      onPermanentDelete: permanentlyDeleteSeries,
    }),
    [
      deleteSeries,
      duplicateSeries,
      instant.getRowInteraction,
      permanentlyDeleteSeries,
      restoreSeries,
      toggleSeries,
      controller.query.filters.view,
    ],
  );
  const columns = useMemo(
    () => createSeriesColumns(rowHandlers),
    [rowHandlers],
  );

  const filters = useMemo<AdminEntityFilterDef[]>(
    () => isTrashView ? [] : [
      STATUS_FILTER,
      {
        id: "series-category-filter",
        paramKey: "category",
        label: "التصنيف",
        placeholder: "كل التصنيفات",
        type: "hierarchical_entity_select",
        searchable: true,
        options: controller.result.metrics?.categoryOptions ?? [],
        className: "min-w-[160px]",
      },
    ],
    [controller.result.metrics?.categoryOptions, isTrashView],
  );

  const executeBulkMutation = useCallback(
    async (action: string, ids: number[]): Promise<AdminActionResult> => {
      const idSet = new Set(ids);
      const nextStatus = action === "publish" ? "published" : "unpublished";
      try {
        const result = await instant.mutateAsync({
          action: `bulk-${action}`,
          bulk: true,
          optimistic: (cache) => {
            if (
              action === "delete" ||
              action === "restore" ||
              action === "permanent_delete"
            ) {
              cache.removeRows(idSet);
              return;
            }
            if (action !== "publish" && action !== "hide") return;
            if (controller.query.filters.status !== "all") {
              cache.removeRows(idSet);
              return;
            }
            cache.patchRows((row) =>
              idSet.has(Number(row.id)) ? { ...row, status: nextStatus } : row,
            );
          },
          execute: async () => {
            const actionResult = await bulkSeriesActionAjax(
              action,
              ids,
              action === "permanent_delete",
            );
            return actionResult.ok
              ? {
                  ok: true as const,
                  message: actionResult.message ?? "تم تنفيذ العملية.",
                }
              : {
                  ok: false as const,
                  code: "series_bulk_failed",
                  message: actionResult.message ?? "تعذر تنفيذ العملية.",
                };
          },
        });
        return {
          ok: true,
          title: "تم بنجاح",
          message: result.message,
          code:
            action === "delete"
              ? "deleted"
              : action === "restore"
                ? "restored"
                : action === "permanent_delete"
                  ? "permanently_deleted"
              : nextStatus === "published"
                ? "published"
                : "unpublished",
        };
      } catch (error) {
        return {
          ok: false,
          title: "تعذر تنفيذ العملية",
          message:
            error instanceof Error ? error.message : "تعذر تنفيذ العملية.",
        };
      }
    },
    [controller.query.filters.status, instant],
  );

  return (
    <AdminEntityListSurface consumer="series">
      {isTrashView ? (
        <AdminEntityTrashHeader
          count={controller.result.metrics?.trashed ?? 0}
          description="تظهر هنا السلاسل المحذوفة فقط. الاستعادة تعيد السلسلة كغير منشورة، والحذف النهائي يحرر الـSlug بعد إثبات عدم وجود علاقات."
          confirmationTitle={(count) => `إفراغ محذوفات السلاسل (${count})؟`}
          confirmationDescription={(count) =>
            `سيتم حذف ${count} من السلاسل نهائيًا وتحرير الـSlugs الخاصة بها. ستمنع العلاقات القائمة العملية، ولا يمكن التراجع عنها.`
          }
          feedbackChannel="entity-list:content-series-table"
          onEmptyTrash={(expectedCount) =>
            emptySeriesTrashAjax(expectedCount, true)
          }
          onSuccess={controller.invalidate}
        />
      ) : null}
      <AdminEntityListPrimarySection>
        <AdminMetricCardsGrid
          items={[
            { label: "إجمالي السلاسل", value: controller.result.metrics?.total ?? 0, tone: "gold", compact: true, onClick: controller.resetFilters, active: !isTrashView && !controller.query.search && controller.query.filters.status === "all" && !controller.query.filters.categoryId },
            { label: "إجمالي الموضوعات", value: controller.result.metrics?.topics ?? 0, tone: "cyan", compact: true },
            { label: "متوسط الموضوعات لكل سلسلة", value: controller.result.metrics?.averageTopics ?? 0, tone: "blue", compact: true },
            { label: "منشور", value: controller.result.metrics?.published ?? 0, tone: "green", compact: true, onClick: () => controller.setFilter("status", "published"), active: !isTrashView && controller.query.filters.status === "published" },
            { label: "غير منشور", value: controller.result.metrics?.unpublished ?? 0, tone: "violet", compact: true, onClick: () => controller.setFilter("status", "unpublished"), active: !isTrashView && controller.query.filters.status === "unpublished" },
          ]}
        />
      </AdminEntityListPrimarySection>

      <AdminEntityListTableRegion
        data-admin-entity-list-pending={
          controller.queryPending ? "true" : "false"
        }
      >
        <AdminEntityList<SeriesListRow, SeriesColumnKey, SeriesSortKey, number>
          listId="content-series-table"
          sizingStrategy={{ mode: "flexible", columnKey: "name" }}
          toolbar={{
            basePath: BASE_PATH,
            search: {
              placeholder: "ابحث في السلاسل",
              value: controller.query.search,
              className: "max-w-[330px]",
            },
            filters,
            values: {
              status: controller.query.filters.status,
              category: controller.query.filters.categoryId
                ? String(controller.query.filters.categoryId)
                : "all",
            },
            onQueryPatch: controller.applyQueryPatch,
          }}
          rows={controller.result.rows}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          initialVisibleColumns={
            initialVisibleColumns?.length
              ? initialVisibleColumns
              : [...SERIES_DEFAULT_COLUMN_KEYS]
          }
          defaultVisibleColumns={[...SERIES_DEFAULT_COLUMN_KEYS]}
          onPersistColumns={(visibleColumns) =>
            saveSeriesTablePreferences(visibleColumns)
          }
          onRestoreColumns={restoreSeriesTablePreferences}
          enableColumnManagement
          enableSelection
          selectionLabel="تحديد كل السلاسل"
          bulkOptions={isTrashView ? TRASH_BULK_OPTIONS : BULK_OPTIONS}
          bulkEntityLabel="سلسلة"
          getBulkConfirmation={(action, ids) =>
            action === "permanent_delete"
              ? {
                  title: `حذف نهائي لـ ${ids.length} سلسلة؟`,
                  description: `سيتم حذف ${ids.length} من السلاسل المحددة نهائيًا وتحرير الـSlugs الخاصة بها. ستمنع العلاقات القائمة العملية، ولا يمكن التراجع عنها.`,
                  confirmLabel:
                    ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected,
                }
              : action === "restore"
                ? {
                    title: `استعادة ${ids.length} سلسلة؟`,
                    description:
                      "ستعود السلاسل المحددة إلى القائمة النشطة كغير منشورة بعد التحقق من العلاقات والـSlugs.",
                    confirmLabel: ADMIN_BULK_ACTION_LABELS.restoreSelected,
                  }
                : action === "delete"
                  ? {
                      title: `نقل ${ids.length} سلسلة إلى المحذوفات؟`,
                      description:
                        "ستُنقل السلاسل المحددة إلى المحذوفات مع الاحتفاظ بالـSlugs. ستمنع العلاقات القائمة العملية.",
                      confirmLabel: ADMIN_BULK_ACTION_LABELS.deleteSelected,
                    }
                  : null
          }
          mapResultToFeedback={(result) => mapAdminActionResultToFeedback(result)}
          onSuccessfulMutation={(result) => {
            if (!result || result.entityId == null) return controller.invalidate();
          }}
          sort={{
            key: controller.query.sort.field as SeriesSortKey,
            direction: controller.query.sort.direction,
          }}
          sortMode={{
            mode: "callback",
            onToggle: (sortKey) => {
              const key = sortKey as SeriesSortKey;
              const current = controller.query.sort;
              controller.setSort(
                current.field === key
                  ? {
                      field: key,
                      direction: current.direction === "asc" ? "desc" : "asc",
                    }
                  : { field: key, direction: "asc" },
              );
            },
          }}
          actionsColumnWidth={SERIES_ACTIONS_COLUMN_WIDTH}
          emptyState={{
            mode:
              controller.result.pagination.totalRows === 0 &&
              !controller.query.search &&
              controller.query.filters.status === "all" &&
              !controller.query.filters.categoryId
                ? "system"
                : "filtered",
            systemEmpty: (
              <>
                <p className="text-base font-semibold text-white">
                  {isTrashView
                    ? "لا توجد سلاسل في المحذوفات"
                    : "لا توجد سلاسل حتى الآن"}
                </p>
                <p className="mt-2 text-sm text-white/45">
                  {isTrashView
                    ? "تظهر هنا السلاسل بعد نقلها إلى المحذوفات."
                    : "ابدأ بإضافة أول سلسلة من زر إضافة سلسلة."}
                </p>
              </>
            ),
            filteredEmpty: (
              <p className="text-base font-semibold text-white">
                {isTrashView
                  ? "لا توجد سلاسل محذوفة مطابقة للبحث."
                  : "لا توجد سلاسل مطابقة للبحث أو الفلاتر المحددة"}
              </p>
            ),
          }}
          onBulkExecute={executeBulkMutation}
          bulkInteraction={instant.bulkInteraction}
          initialFeedback={initialFeedback}
        />
        <AdminTablePagination
          basePath={BASE_PATH}
          totalCount={controller.result.pagination.totalRows}
          pageSize={String(controller.result.pagination.pageSize)}
          pageSizeOptions={ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS.map(String)}
          currentPage={controller.result.pagination.page}
          totalPages={controller.result.pagination.totalPages}
          emptySummaryText="لا توجد سلاسل"
          onPageChange={controller.setPage}
          onPageSizeChange={controller.setPageSize}
        />
      </AdminEntityListTableRegion>
    </AdminEntityListSurface>
  );
}
