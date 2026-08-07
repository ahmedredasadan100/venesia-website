"use client";

import { useCallback, useMemo } from "react";
import {
  AdminEntityList,
  AdminEntityListSurface,
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
import {
  bulkSeriesActionAjax,
  deleteSeriesAjax,
  duplicateSeriesAjax,
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
  { value: "publish", label: "إظهار المحدد" },
  { value: "hide", label: "إخفاء المحدد" },
  { value: "delete", label: "حذف المحدد" },
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
                  affectedIds: actionResult.affectedIds,
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

  const deleteSeries = useCallback(
    async (row: SeriesListRow): Promise<AdminActionResult> => {
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "delete",
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: async () => {
            const actionResult = await deleteSeriesAjax(row.id);
            return actionResult.ok
              ? {
                  ok: true as const,
                  message: actionResult.message ?? "تم حذف السلسلة بنجاح.",
                }
              : {
                  ok: false as const,
                  code: "series_delete_failed",
                  message: actionResult.message ?? "تعذر حذف السلسلة.",
                };
          },
        });
        return {
          ok: true,
          title: "تم بنجاح",
          message: result.message,
          code: "deleted",
          entityId: row.id,
        };
      } catch (error) {
        return {
          ok: false,
          title: "تعذر حذف السلسلة",
          message:
            error instanceof Error ? error.message : "تعذر حذف السلسلة.",
          entityId: row.id,
        };
      }
    },
    [instant],
  );

  const rowHandlers = useMemo<SeriesRowActionHandlers>(
    () => ({
      rowPendingAction: (seriesId) =>
        instant.rowPending?.rowId === seriesId
          ? instant.rowPending.action
          : null,
      mutationBusy:
        instant.rowPending !== null || instant.bulkPending !== null,
      onToggle: toggleSeries,
      onDuplicate: duplicateSeries,
      onDelete: deleteSeries,
    }),
    [
      deleteSeries,
      duplicateSeries,
      instant.bulkPending,
      instant.rowPending,
      toggleSeries,
    ],
  );
  const columns = useMemo(
    () => createSeriesColumns(rowHandlers),
    [rowHandlers],
  );

  const filters = useMemo<AdminEntityFilterDef[]>(
    () => [
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
    [controller.result.metrics?.categoryOptions],
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
            if (action === "delete") {
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
            const actionResult = await bulkSeriesActionAjax(action, ids);
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
      <AdminEntityListPrimarySection>
        <AdminMetricCardsGrid
          items={[
            { label: "إجمالي السلاسل", value: controller.result.metrics?.total ?? 0, tone: "gold", compact: true, onClick: controller.resetFilters, active: !controller.query.search && controller.query.filters.status === "all" && !controller.query.filters.categoryId },
            { label: "إجمالي الموضوعات", value: controller.result.metrics?.topics ?? 0, tone: "cyan", compact: true },
            { label: "متوسط الموضوعات لكل سلسلة", value: controller.result.metrics?.averageTopics ?? 0, tone: "blue", compact: true },
            { label: "منشور", value: controller.result.metrics?.published ?? 0, tone: "green", compact: true, onClick: () => controller.setFilter("status", "published"), active: controller.query.filters.status === "published" },
            { label: "غير منشور", value: controller.result.metrics?.unpublished ?? 0, tone: "violet", compact: true, onClick: () => controller.setFilter("status", "unpublished"), active: controller.query.filters.status === "unpublished" },
          ]}
        />
      </AdminEntityListPrimarySection>

      <AdminEntityListTableRegion
        data-admin-entity-list-pending={
          controller.isFetching ? "true" : "false"
        }
      >
        <AdminEntityList<SeriesListRow, SeriesColumnKey, SeriesSortKey, number>
          listId="content-series-table"
          toolbar={{
            basePath: BASE_PATH,
            search: {
              placeholder: "ابحث في السلاسل",
              value: controller.query.search,
              className: "max-w-[330px]",
              pending: controller.isFetching,
            },
            filters,
            values: {
              status: controller.query.filters.status,
              category: controller.query.filters.categoryId
                ? String(controller.query.filters.categoryId)
                : "all",
            },
            onQueryPatch: (patch, behavior = "push") => {
              const search =
                "q" in patch ? (patch.q ?? "").trim() : controller.query.search;
              const statusValue =
                "status" in patch ? patch.status : controller.query.filters.status;
              const categoryValue =
                "category" in patch
                  ? patch.category
                  : controller.query.filters.categoryId
                    ? String(controller.query.filters.categoryId)
                    : "all";
              const status =
                statusValue === "published" ||
                statusValue === "unpublished"
                  ? statusValue
                  : "all";
              const categoryId = Number(categoryValue);
              controller.setSearchAndFilters(
                search,
                {
                  status,
                  categoryId:
                    Number.isInteger(categoryId) && categoryId > 0
                      ? categoryId
                      : null,
                },
                behavior,
              );
            },
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
          bulkOptions={BULK_OPTIONS}
          bulkEntityLabel="سلسلة"
          mapResultToFeedback={(result) => mapAdminActionResultToFeedback(result)}
          onSuccessfulMutation={(result) => {
            if (!result) return controller.invalidate();
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
                  لا توجد سلاسل حتى الآن
                </p>
                <p className="mt-2 text-sm text-white/45">
                  ابدأ بإضافة أول سلسلة من زر إضافة سلسلة.
                </p>
              </>
            ),
            filteredEmpty: (
              <p className="text-base font-semibold text-white">
                لا توجد سلاسل مطابقة للبحث أو الفلاتر المحددة
              </p>
            ),
          }}
          onBulkExecute={executeBulkMutation}
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
          pending={controller.isFetching}
        />
      </AdminEntityListTableRegion>
    </AdminEntityListSurface>
  );
}
