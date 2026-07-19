"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AdminEntityList,
  AdminEntityListFilters,
  AdminEntityListSurface,
} from "../../../../components/admin/entity-list";
import { AdminTablePagination } from "../../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { AdminActionFeedback } from "../../../../lib/admin/admin-action-feedback";
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
} from "../../../../lib/admin/content/categories-list-config";
import {
  categoriesQueryContract,
  type CategoryFilters,
  type CategorySortField,
} from "../../../../lib/admin/content/entity-list-contracts/categories";
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import {
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  type AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import {
  restoreCategoriesTablePreferences,
  saveCategoriesTablePreferences,
} from "./actions";
import {
  createCategoryColumns,
  type CategoryColumnKey,
  type CategorySortKey,
  CATEGORIES_ACTIONS_COLUMN_WIDTH,
} from "./categories-columns";

const BASE_PATH = "/admin/content/categories";
const EMPTY_COLLAPSED_CATEGORY_IDS = new Set<number>();

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

type CategoryMetrics = {
  parentOptions: Array<{ id: number; name: string; level: number }>;
};

export default function CategoriesListClient({
  initialQuery,
  initialResult,
  initialVisibleColumns,
  initialFeedback,
}: {
  initialQuery: AdminEntityListQuery<CategoryFilters, CategorySortField>;
  initialResult: AdminEntityListResult<CategoryListRow, CategoryMetrics>;
  initialVisibleColumns?: string[];
  initialFeedback?: AdminActionFeedback | null;
}) {
  const controller = useAdminEntityListController({
    entity: "categories",
    contract: categoriesQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const rows = controller.result.rows;
  const parentOptions = useMemo(
    () => controller.result.metrics?.parentOptions ?? [],
    [controller.result.metrics?.parentOptions],
  );
  const filterSignature = `${controller.query.search}\u0000${controller.query.filters.status}`;
  const [treeState, setTreeState] = useState<{
    filterSignature: string;
    collapsedCategoryIds: Set<number>;
  }>(() => ({
    filterSignature,
    collapsedCategoryIds: new Set(),
  }));
  const collapsedCategoryIds =
    treeState.filterSignature === filterSignature
      ? treeState.collapsedCategoryIds
      : EMPTY_COLLAPSED_CATEGORY_IDS;
  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );

  const toggleCategory = useCallback(
    (categoryId: number) => {
      setTreeState((current) => {
        const currentCollapsed =
          current.filterSignature === filterSignature
            ? current.collapsedCategoryIds
            : EMPTY_COLLAPSED_CATEGORY_IDS;
        const next = new Set(currentCollapsed);
        if (next.has(categoryId)) next.delete(categoryId);
        else next.add(categoryId);
        return { filterSignature, collapsedCategoryIds: next };
      });
    },
    [filterSignature],
  );

  // Stable identity so shared filter nodes don't remount on every render.
  const filters = useMemo(() => [STATUS_FILTER], []);

  const columns = useMemo(
    () =>
      createCategoryColumns(parentOptions, {
        isExpanded: (categoryId) => !collapsedCategoryIds.has(categoryId),
        onToggle: toggleCategory,
      }),
    [collapsedCategoryIds, parentOptions, toggleCategory],
  );

  const pageRows = rows.filter((row) => {
    let parentId = row.parent_id;
    const visited = new Set<number>();
    while (parentId && !visited.has(parentId)) {
      if (collapsedCategoryIds.has(parentId)) return false;
      visited.add(parentId);
      parentId = rowById.get(parentId)?.parent_id ?? null;
    }
    return true;
  });

  const sort =
    controller.query.sort.field === "tree"
      ? null
      : {
          key: controller.query.sort.field as CategorySortKey,
          direction: controller.query.sort.direction,
        };

  return (
    <AdminEntityListSurface className="space-y-4" consumer="categories">
      <AdminEntityListFilters
        basePath={BASE_PATH}
        search={{
          placeholder: "ابحث في التصنيفات",
          value: controller.query.search,
          className: "max-w-[330px]",
        }}
        filters={filters}
        values={{ status: controller.query.filters.status }}
        onQueryPatch={(patch) => {
          const search =
            "q" in patch
              ? (patch.q ?? "").trim()
              : controller.query.search;
          // Engine path: only accepted status tokens reach the controller.
          // Unknown/null status resets to the shared "all" sentinel so the
          // trigger returns to "كل الحالات" without a duplicate option.
          const status =
            "status" in patch
              ? patch.status === "published" || patch.status === "hidden"
                ? patch.status
                : "all"
              : controller.query.filters.status;
          controller.setSearchAndFilters(
            search,
            { status },
            "q" in patch && !("status" in patch) ? "replace" : "push",
          );
        }}
      />

      <div
        data-admin-entity-list-pending={
          controller.isFetching ? "true" : "false"
        }
      >
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
          defaultVisibleColumns={[...CATEGORIES_DEFAULT_COLUMN_KEYS]}
          onPersistColumns={(visibleColumns) =>
            saveCategoriesTablePreferences(visibleColumns)
          }
          onRestoreColumns={restoreCategoriesTablePreferences}
          enableColumnManagement
          enableSelection={false}
          mapResultToFeedback={(result) => mapAdminActionResultToFeedback(result)}
          onSuccessfulMutation={() => controller.invalidate()}
          sort={sort}
          sortMode={{
            mode: "callback",
            onToggle: (sortKey) => {
              const key = sortKey as CategorySortKey;
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
          actionsColumnWidth={CATEGORIES_ACTIONS_COLUMN_WIDTH}
          emptyState={{
            mode:
              controller.result.pagination.totalRows === 0 &&
              !controller.query.search &&
              controller.query.filters.status === "all"
                ? "system"
                : "filtered",
            systemEmpty: "لا توجد تصنيفات بعد.",
            filteredEmpty: "لا توجد نتائج مطابقة للبحث أو الفلتر.",
          }}
          getRowDepth={(row) => row.depth}
          rowClassName={(row) => (row.depth === 0 ? "bg-white/[0.015]" : "")}
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
        emptySummaryText="لا توجد تصنيفات"
        forceShowSummary
        onPageChange={controller.setPage}
        onPageSizeChange={controller.setPageSize}
      />
    </AdminEntityListSurface>
  );
}
