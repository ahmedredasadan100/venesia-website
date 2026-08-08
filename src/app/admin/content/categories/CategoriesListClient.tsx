"use client";

import { useCallback, useMemo, useState } from "react";
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
import { ADMIN_BULK_ACTION_LABELS } from "../../../../lib/admin/entity-list/bulk-action-labels";
import {
  bulkCategoriesLifecycleAjax,
  deleteCategorySafelyAjax,
  duplicateCategoryAjax,
  emptyCategoriesTrashAjax,
  permanentlyDeleteCategoryAjax,
  restoreCategoriesTablePreferences,
  restoreCategoryAjax,
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
const LIST_ID = "content-categories-table";
const EMPTY_COLLAPSED_CATEGORY_IDS = new Set<number>();

const TRASH_BULK_OPTIONS = [
  { value: "restore", label: ADMIN_BULK_ACTION_LABELS.restoreSelected },
  {
    value: "permanent_delete",
    label: ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected,
  },
] as const;

const STATUS_FILTER: AdminEntityFilterDef = {
  id: "categories-status-filter",
  paramKey: "status",
  placeholder: "كل الحالات",
  label: "الحالة",
  type: "status",
  options: [
    { value: "published", label: "منشور" },
    { value: "unpublished", label: "غير منشور" },
  ],
  className: "min-w-[160px]",
};

type CategoryMetrics = {
  parentOptions: Array<{ id: number; name: string; level: number }>;
  total: number;
  published: number;
  unpublished: number;
  topics: number;
  series: number;
  trashed: number;
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
  const isTrashView = controller.query.filters.view === "trash";
  const rows = controller.result.rows;
  const filterSignature = `${controller.query.filters.view}\u0000${controller.query.search}\u0000${controller.query.filters.status}`;
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
  const filters = useMemo(
    () => (isTrashView ? [] : [STATUS_FILTER]),
    [isTrashView],
  );

  const toggleStatus = useCallback(
    async (category: CategoryListRow): Promise<CategoryStatusMutationResult> => {
      const nextActive = category.status !== "published";
      const nextStatus = nextActive ? "published" : "unpublished";
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
              publishedAt: actionResult.publishedAt,
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
                          : "unpublished",
                    published_at:
                      typeof mutationResult.publishedAt === "string"
                        ? mutationResult.publishedAt
                        : mutationResult.publishedAt === null
                          ? null
                          : row.published_at,
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
          publishedAt:
            typeof result.publishedAt === "string" || result.publishedAt === null
              ? result.publishedAt
              : undefined,
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

  const runLifecycleMutation = useCallback(
    async (
      category: CategoryListRow,
      action: "delete" | "restore" | "permanent_delete",
      execute: () => Promise<AdminActionResult>,
    ): Promise<AdminActionResult> => {
      let actionResult: AdminActionResult | null = null;
      try {
        await instant.mutateAsync({
          rowId: category.id,
          action,
          optimistic: (cache) => cache.removeRows(new Set([category.id])),
          execute: async () => {
            actionResult = await execute();
            return actionResult.ok
              ? {
                  ok: true as const,
                  message: actionResult.message,
                  feedbackStatus:
                    actionResult.feedbackStatus === "warning"
                      ? "warning" as const
                      : "success" as const,
                }
              : {
                  ok: false as const,
                  code: `category_${action}_failed`,
                  message: actionResult.message,
                };
          },
        });
        await controller.invalidate();
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return {
          ok: false,
          title: "تعذر تنفيذ العملية",
          message:
            error instanceof Error ? error.message : "تعذر تحديث التصنيف.",
          entityId: category.id,
        };
      }

      return {
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "تعذر إثبات نتيجة تحديث التصنيف.",
        entityId: category.id,
      };
    },
    [controller, instant],
  );

  const removeCategory = useCallback(
    (category: CategoryListRow) =>
      runLifecycleMutation(category, "delete", () =>
        deleteCategorySafelyAjax(category.id),
      ),
    [runLifecycleMutation],
  );

  const restoreCategory = useCallback(
    (category: CategoryListRow) =>
      runLifecycleMutation(category, "restore", () =>
        restoreCategoryAjax(category.id),
      ),
    [runLifecycleMutation],
  );

  const permanentlyDeleteCategory = useCallback(
    (category: CategoryListRow) =>
      runLifecycleMutation(category, "permanent_delete", () =>
        permanentlyDeleteCategoryAjax(category.id, true),
      ),
    [runLifecycleMutation],
  );

  const pageRows = isTrashView ? rows : rows.filter((row) => {
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
          view: controller.query.filters.view,
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
          onRestore: restoreCategory,
          onPermanentDelete: permanentlyDeleteCategory,
        },
        { maxVisibleDepth },
      ),
    [
      collapsedCategoryIds,
      duplicate,
      instant.rowPending,
      instant.bulkPending,
      controller.query.filters.view,
      maxVisibleDepth,
      removeCategory,
      restoreCategory,
      permanentlyDeleteCategory,
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
      {isTrashView ? (
        <AdminEntityTrashHeader
          count={controller.result.metrics?.trashed ?? 0}
          description="تظهر هنا التصنيفات المحذوفة فقط. الاستعادة تعيد التصنيف كغير منشور، والحذف النهائي يحرر الـSlug بعد إثبات عدم وجود علاقات."
          confirmationTitle={(count) => `إفراغ محذوفات التصنيفات (${count})؟`}
          confirmationDescription={(count) =>
            `سيتم حذف ${count} من التصنيفات نهائيًا وتحرير الـSlugs الخاصة بها. ستمنع العلاقات القائمة العملية، ولا يمكن التراجع عنها.`
          }
          feedbackChannel={`entity-list:${LIST_ID}`}
          onEmptyTrash={(expectedCount) =>
            emptyCategoriesTrashAjax(expectedCount, true)
          }
          onSuccess={controller.invalidate}
        />
      ) : null}
      <AdminEntityListPrimarySection>
        <AdminMetricCardsGrid
          items={[
            { label: "إجمالي التصنيفات", value: controller.result.metrics?.total ?? 0, tone: "gold", compact: true, onClick: controller.resetFilters, active: !isTrashView && !controller.query.search && controller.query.filters.status === "all" },
            { label: "إجمالي الموضوعات", value: controller.result.metrics?.topics ?? 0, tone: "cyan", compact: true },
            { label: "إجمالي السلاسل", value: controller.result.metrics?.series ?? 0, tone: "blue", compact: true },
            { label: "منشور", value: controller.result.metrics?.published ?? 0, tone: "green", compact: true, onClick: () => controller.setFilter("status", "published"), active: !isTrashView && controller.query.filters.status === "published" },
            { label: "غير منشور", value: controller.result.metrics?.unpublished ?? 0, tone: "violet", compact: true, onClick: () => controller.setFilter("status", "unpublished"), active: !isTrashView && controller.query.filters.status === "unpublished" },
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
          listId={LIST_ID}
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
                  ? patch.status === "published" || patch.status === "unpublished"
                    ? patch.status
                    : "all"
                  : controller.query.filters.status;
              controller.setSearchAndFilters(
                search,
                { view: controller.query.filters.view, status },
                behavior,
              );
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
          enableSelection={isTrashView}
          selectionLabel="تحديد كل التصنيفات في الصفحة"
          bulkOptions={isTrashView ? TRASH_BULK_OPTIONS : []}
          bulkEntityLabel="تصنيف"
          onBulkExecute={(action, ids) =>
            bulkCategoriesLifecycleAjax(
              action,
              ids,
              action === "permanent_delete",
            )
          }
          getBulkConfirmation={(action, ids) =>
            action === "permanent_delete"
              ? {
                  title: `حذف نهائي لـ ${ids.length} تصنيف؟`,
                  description: `سيتم حذف ${ids.length} من التصنيفات المحددة نهائيًا وتحرير الـSlugs الخاصة بها. ستمنع العلاقات القائمة العملية، ولا يمكن التراجع عنها.`,
                  confirmLabel:
                    ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected,
                }
              : action === "restore"
                ? {
                    title: `استعادة ${ids.length} تصنيف؟`,
                    description:
                      "ستعود التصنيفات المحددة إلى القائمة النشطة كغير منشورة بعد التحقق من العلاقات والـSlugs.",
                    confirmLabel: ADMIN_BULK_ACTION_LABELS.restoreSelected,
                  }
                : null
          }
          mapResultToFeedback={(result) => mapAdminActionResultToFeedback(result)}
          onSuccessfulMutation={(result) => {
            if (!result || result.entityId == null) return controller.invalidate();
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
            systemEmpty: isTrashView
              ? "لا توجد تصنيفات محذوفة."
              : "لا توجد تصنيفات بعد.",
            filteredEmpty: isTrashView
              ? "لا توجد تصنيفات محذوفة مطابقة للبحث."
              : "لا توجد نتائج مطابقة للبحث أو الفلتر.",
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
