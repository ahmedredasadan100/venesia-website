"use client";

import { useCallback, useMemo, useState } from "react";
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
import { useAdminEntityInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  deleteCategorySafelyAjax,
  duplicateCategoryAjax,
  restoreCategoriesTablePreferences,
  saveCategoriesTablePreferences,
  toggleCategoryStatusAjax,
  type CategoryDuplicateMutationResult,
  type CategoryStatusMutationResult,
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
  label: "الحالة",
  type: "status",
  options: [
    { value: "published", label: "منشور" },
    { value: "hidden", label: "مخفي" },
  ],
  className: "min-w-[160px]",
};

type CategoryMetrics = {
  parentOptions: Array<{ id: number; name: string; level: number }>;
  total: number;
  published: number;
  topics: number;
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
  const instant = useAdminEntityInstantMutation<CategoryListRow, CategoryMetrics>(
    "categories",
    controller.query,
  );
  const rows = controller.result.rows;
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

  const toggleStatus = useCallback(
    async (category: CategoryListRow): Promise<CategoryStatusMutationResult> => {
      const nextActive = !Boolean(category.is_active);
      const nextStatus = nextActive ? "published" : "draft";
      try {
        const result = await instant.mutateAsync({
          rowId: category.id,
          action: "visibility",
          optimistic: (cache) => {
            if (controller.query.filters.status !== "all") {
              cache.removeRows(new Set([category.id]));
              return;
            }
            cache.patchRows((row) =>
              row.id === category.id
                ? { ...row, is_active: nextActive, status: nextStatus }
                : row,
            );
          },
          execute: async () => {
            const actionResult = await toggleCategoryStatusAjax(category.id);
            if (!actionResult.ok) {
              return {
                ok: false as const,
                code: "category_status_failed",
                message: actionResult.message,
              };
            }
            return {
              ok: true as const,
              message: actionResult.message,
              feedbackStatus:
                actionResult.feedbackStatus === "warning"
                  ? "warning" as const
                  : "success" as const,
              isActive: actionResult.isActive,
              status: actionResult.status,
              updatedAt: actionResult.updatedAt,
            };
          },
          reconcileSuccess: (mutationResult, { cache }) => {
            if (controller.query.filters.status !== "all") return;
            const isActive =
              typeof mutationResult.isActive === "boolean"
                ? mutationResult.isActive
                : nextActive;
            cache.patchRows((row) =>
              row.id === category.id
                ? {
                    ...row,
                    is_active: isActive,
                    status:
                      typeof mutationResult.status === "string"
                        ? mutationResult.status
                        : isActive
                          ? "published"
                          : "draft",
                    updated_at:
                      typeof mutationResult.updatedAt === "string"
                        ? mutationResult.updatedAt
                        : row.updated_at,
                  }
                : row,
            );
          },
        });
        return {
          ok: true,
          title: "تم بنجاح",
          message: result.message,
          feedbackStatus: result.feedbackStatus,
          code: nextActive ? "published" : "unpublished",
          entityId: category.id,
          isActive:
            typeof result.isActive === "boolean" ? result.isActive : nextActive,
          status:
            typeof result.status === "string" ? result.status : nextStatus,
          updatedAt:
            typeof result.updatedAt === "string" ? result.updatedAt : undefined,
        };
      } catch (error) {
        return {
          ok: false,
          title: "تعذر تنفيذ العملية",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تحديث حالة التصنيف.",
          entityId: category.id,
        };
      }
    },
    [controller.query.filters.status, instant],
  );

  const duplicate = useCallback(
    async (category: CategoryListRow): Promise<CategoryDuplicateMutationResult> => {
      try {
        const result = await instant.mutateAsync({
          rowId: category.id,
          action: "duplicate",
          optimistic: () => undefined,
          execute: async () => {
            const actionResult = await duplicateCategoryAjax(category.id);
            if (!actionResult.ok) {
              return {
                ok: false as const,
                code: "category_duplicate_failed",
                message: actionResult.message,
              };
            }
            return {
              ok: true as const,
              message: actionResult.message,
              feedbackStatus:
                actionResult.feedbackStatus === "warning"
                  ? "warning" as const
                  : "success" as const,
              insertedId: actionResult.insertedId,
            };
          },
        });
        const insertedId =
          typeof result.insertedId === "number" ? result.insertedId : undefined;
        return {
          ok: true,
          title: "تم بنجاح",
          message: result.message,
          feedbackStatus: result.feedbackStatus,
          code: "created",
          entityId: insertedId,
          insertedId,
        };
      } catch (error) {
        return {
          ok: false,
          title: "تعذر نسخ التصنيف",
          message:
            error instanceof Error ? error.message : "تعذر نسخ التصنيف.",
          entityId: category.id,
        };
      }
    },
    [instant],
  );

  const removeCategory = useCallback(
    async (categoryId: number, transferToId: number | null) => {
      try {
        const result = await instant.mutateAsync({
          rowId: categoryId,
          action: "delete",
          optimistic: (cache) => cache.removeRows(new Set([categoryId])),
          execute: async () => {
            const actionResult = await deleteCategorySafelyAjax(
              categoryId,
              transferToId,
            );
            return actionResult.ok
              ? {
                  ok: true as const,
                  message:
                    actionResult.message ?? "تم حذف التصنيف بنجاح.",
                  feedbackStatus:
                    "feedbackStatus" in actionResult &&
                    actionResult.feedbackStatus === "warning"
                      ? "warning" as const
                      : "success" as const,
                }
              : {
                  ok: false as const,
                  code: "category_delete_failed",
                  message: actionResult.message ?? "تعذر حذف التصنيف.",
                };
          },
        });
        return {
          ok: true,
          message: result.message,
          feedbackStatus: result.feedbackStatus,
        };
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error ? error.message : "تعذر حذف التصنيف.",
        };
      }
    },
    [instant],
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
  const maxVisibleDepth = pageRows.reduce(
    (maximum, row) => Math.max(maximum, row.depth),
    0,
  );

  const columns = useMemo(
    () =>
      createCategoryColumns(
        {
          isExpanded: (categoryId) => !collapsedCategoryIds.has(categoryId),
          onToggle: toggleCategory,
          rowPendingAction: (categoryId) =>
            instant.rowPending?.rowId === categoryId
              ? instant.rowPending.action
              : null,
          mutationBusy:
            instant.rowPending !== null || instant.bulkPending !== null,
          onToggleStatus: toggleStatus,
          onDuplicate: duplicate,
          onDelete: removeCategory,
        },
        { maxVisibleDepth },
      ),
    [
      collapsedCategoryIds,
      duplicate,
      instant.rowPending,
      instant.bulkPending,
      maxVisibleDepth,
      removeCategory,
      toggleCategory,
      toggleStatus,
    ],
  );

  const sort =
    controller.query.sort.field === "tree"
      ? null
      : {
          key: controller.query.sort.field as CategorySortKey,
          direction: controller.query.sort.direction,
        };

  return (
    <AdminEntityListSurface consumer="categories">
      <AdminEntityListPrimarySection>
        <AdminMetricCardsGrid
          items={[
            { label: "إجمالي التصنيفات", value: controller.result.metrics?.total ?? 0, tone: "gold", compact: true },
            { label: "نشط", value: controller.result.metrics?.published ?? 0, tone: "green", compact: true },
            { label: "الموضوعات", value: controller.result.metrics?.topics ?? 0, tone: "cyan", compact: true },
          ]}
        />
      </AdminEntityListPrimarySection>

      <AdminEntityListTableRegion
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
          toolbar={{
            basePath: BASE_PATH,
            search: {
              placeholder: "ابحث في التصنيفات",
              value: controller.query.search,
              className: "max-w-[330px]",
              pending: controller.isFetching,
            },
            filters,
            values: { status: controller.query.filters.status },
            onQueryPatch: (patch, behavior = "push") => {
              const search =
                "q" in patch
                  ? (patch.q ?? "").trim()
                  : controller.query.search;
              const status =
                "status" in patch
                  ? patch.status === "published" || patch.status === "hidden"
                    ? patch.status
                    : "all"
                  : controller.query.filters.status;
              controller.setSearchAndFilters(search, { status }, behavior);
            },
          }}
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
          onSuccessfulMutation={(result) => {
            if (!result) return controller.invalidate();
          }}
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
        <AdminTablePagination
          basePath={BASE_PATH}
          totalCount={controller.result.pagination.totalRows}
          pageSize={String(controller.result.pagination.pageSize)}
          pageSizeOptions={ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS.map(String)}
          currentPage={controller.result.pagination.page}
          totalPages={controller.result.pagination.totalPages}
          emptySummaryText="لا توجد تصنيفات"
          onPageChange={controller.setPage}
          onPageSizeChange={controller.setPageSize}
          pending={controller.isFetching}
        />
      </AdminEntityListTableRegion>
    </AdminEntityListSurface>
  );
}
