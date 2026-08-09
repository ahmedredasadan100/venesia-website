"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkUpdateUnifiedContent,
  saveContentTablePreferences,
} from "../../../app/admin/content/topics/actions";
import {
  toAdminCategoryFilterOptions,
  type AdminContentCategoryNode,
} from "../../../lib/admin/content/category-hierarchy";
import { mapTopicsActionResultToFeedback } from "../../../lib/admin/content/topics-action-feedback";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import type {
  ContentSortValue,
  UnifiedContentRow,
} from "../../../lib/admin/content/load-unified-content";
import { AdminEntityList } from "../entity-list";
import type { AdminEntityListFiltersProps } from "../entity-list/AdminEntityListFilters";
import AdminListboxSelect from "../ui/AdminListboxSelect";
import {
  createUnifiedContentColumns,
  DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS,
  UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH,
  type UnifiedContentColumnKey,
  type UnifiedContentSortKey,
} from "./unified-content-columns";
import type { UnifiedContentRowActionHandlers } from "./UnifiedContentRowActions";
import { ADMIN_BULK_ACTION_LABELS } from "../../../lib/admin/entity-list/bulk-action-labels";

const BULK_OPTIONS = [
  { value: "publish", label: ADMIN_BULK_ACTION_LABELS.showSelected },
  { value: "unpublish", label: ADMIN_BULK_ACTION_LABELS.hideSelected },
  { value: "move_to_trash", label: ADMIN_BULK_ACTION_LABELS.deleteSelected },
  { value: "move_category", label: "نقل لتصنيف" },
  { value: "feature", label: "تعيين كمميز" },
  { value: "unfeature", label: "إلغاء التمييز" },
] as const;

const TRASH_BULK_OPTIONS = [
  { value: "restore", label: ADMIN_BULK_ACTION_LABELS.restoreSelected },
  {
    value: "permanent_delete",
    label: ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected,
  },
] as const;

export const UNIFIED_CONTENT_LIST_ID = "content-topics-table";

function parseSort(sort: ContentSortValue) {
  const direction = sort.endsWith("_asc")
    ? ("asc" as const)
    : ("desc" as const);
  const key = sort.slice(
    0,
    -(direction.length + 1),
  ) as UnifiedContentSortKey;
  return { key, direction };
}

function sortHref(
  currentListPath: string,
  sortKey: string,
  currentSort: ContentSortValue,
) {
  const parsed = parseSort(currentSort);
  const direction =
    parsed.key === sortKey && parsed.direction === "asc" ? "desc" : "asc";
  const url = new URL(currentListPath, "https://admin.local");
  url.searchParams.set("sort", `${sortKey}_${direction}`);
  url.searchParams.delete("page");
  return `${url.pathname}${url.search}#content-topics-table`;
}

function defaultSortPath(currentListPath: string) {
  const url = new URL(currentListPath, "https://admin.local");
  url.searchParams.delete("sort");
  return `${url.pathname}${url.search}#content-topics-table`;
}

export default function UnifiedContentList({
  rows,
  categories,
  currentListPath,
  sort,
  initialVisibleColumns,
  initialFeedback,
  rowActionHandlers,
  onSortChange,
  onSuccessfulMutation,
  toolbar,
  trashView,
}: {
  rows: UnifiedContentRow[];
  categories: AdminContentCategoryNode[];
  currentListPath: string;
  sort: ContentSortValue;
  initialVisibleColumns: string[];
  initialFeedback?: AdminActionFeedback | null;
  rowActionHandlers: UnifiedContentRowActionHandlers;
  onSortChange?: (
    sort: {
      key: UnifiedContentSortKey;
      direction: "asc" | "desc";
    },
    options?: { resetPage?: boolean },
  ) => void;
  onSuccessfulMutation?: (
    result?: AdminActionResult,
  ) => void | Promise<void>;
  toolbar: AdminEntityListFiltersProps;
  trashView: boolean;
}) {
  const router = useRouter();
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const columns = useMemo(
    () => createUnifiedContentColumns(currentListPath, rowActionHandlers),
    [currentListPath, rowActionHandlers],
  );
  const parsedSort = parseSort(sort);
  const categoryOptions = useMemo(
    () =>
      toAdminCategoryFilterOptions(
        categories.filter((category) => category.status === "published"),
      ),
    [categories],
  );

  return (
    <AdminEntityList<
      UnifiedContentRow,
      UnifiedContentColumnKey,
      UnifiedContentSortKey,
      number
    >
      listId={UNIFIED_CONTENT_LIST_ID}
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.title || `الموضوع ${row.id}`}
      initialVisibleColumns={initialVisibleColumns}
      defaultVisibleColumns={DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS}
      onPersistColumns={saveContentTablePreferences}
      enableColumnManagement
      enableSelection
      selectionLabel="تحديد كل الموضوعات في الصفحة"
      bulkOptions={trashView ? TRASH_BULK_OPTIONS : BULK_OPTIONS}
      bulkEntityLabel="موضوع"
      mapResultToFeedback={(result) =>
        mapTopicsActionResultToFeedback(result, { currentListPath })
      }
      onSuccessfulMutation={onSuccessfulMutation}
      sort={parsedSort}
      sortMode={
        onSortChange
          ? {
              mode: "callback",
              onToggle: (sortKey) => {
                onSortChange({
                  key: sortKey,
                  direction:
                    parsedSort.key === sortKey && parsedSort.direction === "asc"
                      ? "desc"
                      : "asc",
                });
              },
            }
          : {
              mode: "href",
              hrefFor: (_columnKey, sortKey) =>
                sortHref(currentListPath, sortKey, sort),
            }
      }
      onSortColumnHidden={() => {
        if (onSortChange) {
          onSortChange(
            { key: "title", direction: "asc" },
            { resetPage: false },
          );
        } else {
          router.replace(defaultSortPath(currentListPath), { scroll: false });
        }
      }}
      actionsColumnWidth={UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH}
      emptyState={{
        mode: "filtered",
        systemEmpty: trashView
          ? "لا توجد موضوعات في المحذوفات."
          : "لا توجد موضوعات حتى الآن.",
        filteredEmpty: trashView
          ? "لا توجد موضوعات محذوفة مطابقة للفلاتر الحالية."
          : "لا توجد موضوعات مطابقة للفلاتر الحالية.",
      }}
      onBulkExecute={async (action, ids) => {
        const formData = new FormData();
        formData.set("bulk_action", action);
        if (action === "permanent_delete") {
          formData.set("confirm_permanent", "true");
        }
        if (action === "move_category" && bulkCategoryId) {
          formData.set("category_id", bulkCategoryId);
        }
        ids.forEach((id) => formData.append("topic_ids", String(id)));
        return bulkUpdateUnifiedContent(formData);
      }}
      getBulkConfirmation={(action, ids) =>
        action === "permanent_delete"
          ? {
              title: `حذف نهائي لـ ${ids.length} موضوع؟`,
              description: `سيتم حذف ${ids.length} من الموضوعات المحددة نهائيًا وتحرير الـSlugs الخاصة بها. لا يمكن التراجع عن هذا الإجراء.`,
              confirmLabel:
                ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected,
            }
          : action === "move_to_trash"
            ? {
                title: `نقل ${ids.length} موضوع إلى المحذوفات؟`,
                description: `سيتم نقل ${ids.length} من الموضوعات المحددة إلى المحذوفات مع إبقاء الـSlugs محجوزة، ويمكن استعادتها لاحقًا.`,
                confirmLabel: "نقل إلى المحذوفات",
              }
            : null
      }
      initialFeedback={initialFeedback}
      toolbar={toolbar}
      bulkAdditionalControls={({
        bulkAction,
        pending,
        openLayerId,
        setOpenLayerId,
      }) =>
        bulkAction === "move_category" ? (
          <AdminListboxSelect
            id="content-topics-bulk-category"
            layerId="content-topics-bulk-category"
            openLayerId={openLayerId}
            onOpenLayer={setOpenLayerId}
            value={bulkCategoryId}
            onChange={setBulkCategoryId}
            disabled={pending}
            placeholder="اختر تصنيف النقل"
            options={[
              { value: "", label: "اختر تصنيف النقل" },
              ...categoryOptions,
            ]}
            className="w-[210px]"
          />
        ) : null
      }
    />
  );
}
