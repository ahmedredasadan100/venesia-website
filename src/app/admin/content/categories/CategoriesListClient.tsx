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
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
} from "../../../../lib/admin/content/categories-list-config";
import {
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  resolveClientPagination,
  slicePageRows,
  type AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import { saveCategoriesTablePreferences } from "./actions";
import {
  createCategoryColumns,
  type CategoryColumnKey,
  type CategoryListRow,
  type CategorySortKey,
  CATEGORIES_ACTIONS_COLUMN_WIDTH,
} from "./categories-columns";

const BASE_PATH = "/admin/content/categories";

const STATUS_FILTER: AdminEntityFilterDef = {
  id: "categories-status-filter",
  paramKey: "status",
  placeholder: "كل الحالات",
  options: [
    { value: "published", label: "منشور" },
    { value: "hidden", label: "مخفي" },
  ],
  className: "min-w-[160px]",
};

export default function CategoriesListClient({
  rows,
  parentOptions,
  initialVisibleColumns,
}: {
  rows: CategoryListRow[];
  parentOptions: Array<{ id: number; name: string; level: number }>;
  initialVisibleColumns?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const [sort, setSort] = useState<{
    key: CategorySortKey | "tree";
    direction: "asc" | "desc";
  }>({
    key: "tree",
    direction: "asc",
  });

  const columns = useMemo(
    () => createCategoryColumns(parentOptions),
    [parentOptions],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let next = rows.filter((row) => {
      const statusOk =
        status === "all" ||
        (status === "published" && Boolean(row.is_active)) ||
        (status === "hidden" && !row.is_active);
      if (!statusOk) return false;
      if (!normalized) return true;
      return row.name.toLowerCase().includes(normalized);
    });

    if (sort.key !== "tree") {
      next = [...next].sort((a, b) => {
        let result = 0;
        if (sort.key === "count") result = a.totalCount - b.totalCount;
        else if (sort.key === "status") {
          result = Number(Boolean(a.is_active)) - Number(Boolean(b.is_active));
        } else if (sort.key === "id") result = a.id - b.id;
        else if (sort.key === "parent") {
          result = (a.parent_name ?? "").localeCompare(b.parent_name ?? "", "ar");
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
    }

    return next;
  }, [query, rows, sort, status]);

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

  return (
    <AdminEntityListSurface
      className="space-y-4"
      consumer="categories"
    >
      <AdminEntityListFilters
        basePath={BASE_PATH}
        search={{
          placeholder: "ابحث في التصنيفات",
          value: query,
          className: "max-w-[330px]",
        }}
        filters={[STATUS_FILTER]}
        values={{ status }}
      />

      <AdminEntityList<
        CategoryListRow,
        CategoryColumnKey,
        CategorySortKey,
        number
      >
        listId="content-categories-table"
        rows={pageRows}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        initialVisibleColumns={
          initialVisibleColumns?.length
            ? initialVisibleColumns
            : [...CATEGORIES_DEFAULT_COLUMN_KEYS]
        }
        onPersistColumns={(visibleColumns) =>
          saveCategoriesTablePreferences(visibleColumns)
        }
        enableColumnManagement
        enableSelection={false}
        mapResultToFeedback={(result) => mapAdminActionResultToFeedback(result)}
        sort={
          sort.key === "tree"
            ? null
            : { key: sort.key, direction: sort.direction }
        }
        sortMode={{
          mode: "callback",
          onToggle: (sortKey) => {
            const key = sortKey as CategorySortKey;
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
        actionsColumnWidth={CATEGORIES_ACTIONS_COLUMN_WIDTH}
        empty={
          rows.length
            ? "لا توجد نتائج مطابقة للبحث أو الفلتر."
            : "لا توجد تصنيفات بعد."
        }
        getRowDepth={(row) => row.depth}
        rowClassName={(row) => (row.depth === 0 ? "bg-white/[0.015]" : "")}
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
        emptySummaryText="لا توجد تصنيفات"
        forceShowSummary
      />
    </AdminEntityListSurface>
  );
}
