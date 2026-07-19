"use client";

import { useMemo } from "react";
import {
  AdminEntityList,
  AdminEntityListFilters,
  AdminEntityListSurface,
} from "../../../../components/admin/entity-list";
import { AdminTablePagination } from "../../../../components/admin/ui";
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
import {
  bulkSeriesActionAjax,
  restoreSeriesTablePreferences,
  saveSeriesTablePreferences,
} from "./actions";
import {
  createSeriesColumns,
  SERIES_ACTIONS_COLUMN_WIDTH,
  type SeriesColumnKey,
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
  options: [
    { value: "published", label: "منشور" },
    { value: "unpublished", label: "مخفي" },
    { value: "draft", label: "مسودة" },
    { value: "archived", label: "مؤرشف" },
  ],
  className: "min-w-[150px]",
};

type SeriesMetrics = {
  total: number;
  published: number;
  topics: number;
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

  const invalidate = controller.invalidate;
  const columns = useMemo(
    () =>
      createSeriesColumns({
        onRowsUpdated: () => {
          void invalidate();
        },
      }),
    [invalidate],
  );

  const filters = useMemo<AdminEntityFilterDef[]>(
    () => [
      STATUS_FILTER,
      {
        id: "series-category-filter",
        paramKey: "category",
        placeholder: "كل التصنيفات",
        options: controller.result.metrics?.categoryOptions ?? [],
        className: "min-w-[160px]",
      },
    ],
    [controller.result.metrics?.categoryOptions],
  );

  function mapSeriesResult(result: {
    ok: boolean;
    message?: string;
    rows?: SeriesListRow[];
  }): AdminActionResult {
    if (result.ok) void controller.invalidate();
    return {
      ok: result.ok,
      title: result.ok ? "تم بنجاح" : "تعذر تنفيذ العملية",
      message: result.message ?? (result.ok ? "تم التحديث." : "فشلت العملية."),
      code: result.ok ? "saved" : undefined,
    };
  }

  return (
    <AdminEntityListSurface className="space-y-4" consumer="series">
      <AdminEntityListFilters
        basePath={BASE_PATH}
        search={{
          placeholder: "ابحث في السلاسل",
          value: controller.query.search,
          className: "max-w-[330px]",
        }}
        filters={filters}
        values={{
          status: controller.query.filters.status,
          category: controller.query.filters.categoryId
            ? String(controller.query.filters.categoryId)
            : "all",
        }}
        onQueryPatch={(patch) => {
          const search =
            "q" in patch
              ? (patch.q ?? "").trim()
              : controller.query.search;
          const statusValue =
            "status" in patch
              ? patch.status
              : controller.query.filters.status;
          const categoryValue =
            "category" in patch
              ? patch.category
              : controller.query.filters.categoryId
                ? String(controller.query.filters.categoryId)
                : "all";
          const status =
            statusValue === "published" ||
            statusValue === "unpublished" ||
            statusValue === "draft" ||
            statusValue === "archived"
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
            "q" in patch && !("status" in patch) && !("category" in patch)
              ? "replace"
              : "push",
          );
        }}
      />

      <div
        data-admin-entity-list-pending={
          controller.isFetching ? "true" : "false"
        }
      >
        <AdminEntityList<SeriesListRow, SeriesColumnKey, SeriesSortKey, number>
          listId="content-series-table"
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
          onSuccessfulMutation={() => controller.invalidate()}
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
          onBulkExecute={async (action, ids) =>
            mapSeriesResult(await bulkSeriesActionAjax(action, ids))
          }
          initialFeedback={initialFeedback}
        />
      </div>

      <AdminTablePagination
        basePath={BASE_PATH}
        rangeStart={
          controller.result.pagination.totalRows
            ? (controller.result.pagination.page - 1) *
                controller.result.pagination.pageSize +
              1
            : 0
        }
        rangeEnd={
          controller.result.pagination.totalRows
            ? Math.min(
                controller.result.pagination.page *
                  controller.result.pagination.pageSize,
                controller.result.pagination.totalRows,
              )
            : 0
        }
        totalCount={controller.result.pagination.totalRows}
        pageSize={String(controller.result.pagination.pageSize)}
        pageSizeOptions={ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS.map(String)}
        currentPage={controller.result.pagination.page}
        totalPages={controller.result.pagination.totalPages}
        emptySummaryText="لا توجد سلاسل"
        forceShowSummary
        onPageChange={controller.setPage}
        onPageSizeChange={controller.setPageSize}
      />
    </AdminEntityListSurface>
  );
}
