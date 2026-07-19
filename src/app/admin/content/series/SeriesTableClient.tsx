"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  resolveClientPagination,
  slicePageRows,
  type AdminEntityFilterDef,
  type AdminEntityFilterOption,
} from "../../../../lib/admin/entity-list";
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
import type { SeriesListRow } from "../../../../lib/admin/content/load-series-list";

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

export default function SeriesTableClient({
  series,
  categoryOptions,
  categoryDescendantIdsByValue,
  initialVisibleColumns,
  initialFeedback,
}: {
  series: SeriesListRow[];
  categoryOptions: AdminEntityFilterOption[];
  categoryDescendantIdsByValue: Record<string, number[]>;
  initialVisibleColumns?: string[];
  initialFeedback?: AdminActionFeedback | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(series);
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const category = searchParams.get("category") ?? "all";
  const [sort, setSort] = useState<{
    key: SeriesSortKey;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const selectedCategoryIds = useMemo(
    () =>
      new Set(
        category === "all"
          ? []
          : (categoryDescendantIdsByValue[category] ?? [Number(category)]),
      ),
    [category, categoryDescendantIdsByValue],
  );

  const columns = useMemo(
    () => createSeriesColumns({ onRowsUpdated: setRows }),
    [],
  );

  const filters = useMemo<AdminEntityFilterDef[]>(
    () => [
      STATUS_FILTER,
      {
        id: "series-category-filter",
        paramKey: "category",
        placeholder: "كل التصنيفات",
        options: categoryOptions,
        className: "min-w-[160px]",
      },
    ],
    [categoryOptions],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let next = rows.filter((row) => {
      const statusOk = status === "all" || row.status === status;
      const categoryOk =
        category === "all" ||
        (row.category_id != null && selectedCategoryIds.has(row.category_id));
      if (!statusOk || !categoryOk) return false;
      if (!normalized) return true;
      return (
        row.name.toLowerCase().includes(normalized) ||
        row.slug.toLowerCase().includes(normalized)
      );
    });

    next = [...next].sort((a, b) => {
      let result = 0;
      if (sort.key === "topics_count") {
        result = a.topics_count - b.topics_count;
      } else if (sort.key === "status") {
        result = String(a.status ?? "").localeCompare(String(b.status ?? ""), "ar");
      } else if (sort.key === "id") {
        result = a.id - b.id;
      } else if (sort.key === "slug") {
        result = a.slug.localeCompare(b.slug, "en");
      } else if (sort.key === "category") {
        result = (a.category_name ?? "").localeCompare(
          b.category_name ?? "",
          "ar",
        );
      } else if (sort.key === "sort_order") {
        result = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      } else if (sort.key === "created_at") {
        result = String(a.created_at ?? "").localeCompare(
          String(b.created_at ?? ""),
        );
      } else if (sort.key === "updated_at") {
        result = String(a.updated_at ?? "").localeCompare(
          String(b.updated_at ?? ""),
        );
      } else {
        result = a.name.localeCompare(b.name, "ar");
      }
      return sort.direction === "asc" ? result : -result;
    });

    return next;
  }, [category, query, rows, selectedCategoryIds, sort, status]);

  const pagination = resolveClientPagination(
    filteredRows.length,
    searchParams.get("page"),
    searchParams.get("limit"),
  );
  const pageRows = slicePageRows(
    filteredRows,
    pagination.page,
    pagination.pageSize,
  );

  useEffect(() => {
    const rawPage = searchParams.get("page");
    if (!rawPage) return;
    const requested = Number.parseInt(rawPage, 10);
    if (!Number.isFinite(requested)) return;
    if (requested === pagination.page) return;
    const params = new URLSearchParams(searchParams.toString());
    if (pagination.page <= 1) params.delete("page");
    else params.set("page", String(pagination.page));
    const next = params.toString();
    router.replace(next ? `${BASE_PATH}?${next}` : BASE_PATH, { scroll: false });
  }, [pagination.page, router, searchParams]);

  function mapSeriesResult(result: {
    ok: boolean;
    message?: string;
    rows?: SeriesListRow[];
  }): AdminActionResult {
    if (result.rows) setRows(result.rows);
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
          value: query,
          className: "max-w-[330px]",
        }}
        filters={filters}
        values={{ status, category }}
      />

      <AdminEntityList<SeriesListRow, SeriesColumnKey, SeriesSortKey, number>
        listId="content-series-table"
        rows={pageRows}
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
        sort={sort}
        sortMode={{
          mode: "callback",
          onToggle: (sortKey) => {
            const key = sortKey as SeriesSortKey;
            setSort((current) =>
              current.key === key
                ? {
                    key,
                    direction: current.direction === "asc" ? "desc" : "asc",
                  }
                : { key, direction: "asc" },
            );
          },
        }}
        actionsColumnWidth={SERIES_ACTIONS_COLUMN_WIDTH}
        emptyState={{
          mode: rows.length === 0 ? "system" : "filtered",
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

      <AdminTablePagination
        basePath={BASE_PATH}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        totalCount={pagination.totalCount}
        pageSize={String(pagination.pageSize)}
        pageSizeOptions={ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS.map(String)}
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        emptySummaryText="لا توجد سلاسل"
        forceShowSummary
      />
    </AdminEntityListSurface>
  );
}
