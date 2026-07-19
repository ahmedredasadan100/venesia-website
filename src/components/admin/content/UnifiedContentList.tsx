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
import AdminListboxSelect from "../ui/AdminListboxSelect";
import {
  createUnifiedContentColumns,
  UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH,
  type UnifiedContentColumnKey,
  type UnifiedContentSortKey,
} from "./unified-content-columns";

const BULK_OPTIONS = [
  { value: "publish", label: "نشر" },
  { value: "unpublish", label: "إخفاء" },
  { value: "archive", label: "أرشفة" },
  { value: "delete", label: "حذف آمن" },
  { value: "move_category", label: "نقل لتصنيف" },
  { value: "feature", label: "تعيين كمميز" },
  { value: "unfeature", label: "إلغاء التمييز" },
] as const;

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
  onSortChange,
  onSuccessfulMutation,
}: {
  rows: UnifiedContentRow[];
  categories: AdminContentCategoryNode[];
  currentListPath: string;
  sort: ContentSortValue;
  initialVisibleColumns: string[];
  initialFeedback?: AdminActionFeedback | null;
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
}) {
  const router = useRouter();
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const columns = useMemo(
    () =>
      createUnifiedContentColumns(currentListPath, {
        deferRefresh: Boolean(onSuccessfulMutation),
      }),
    [currentListPath, onSuccessfulMutation],
  );
  const parsedSort = parseSort(sort);
  const categoryOptions = useMemo(
    () =>
      toAdminCategoryFilterOptions(
        categories.filter((category) => category.is_active !== false),
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
      listId="content-topics-table"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.title || `الموضوع ${row.id}`}
      initialVisibleColumns={initialVisibleColumns}
      onPersistColumns={saveContentTablePreferences}
      enableColumnManagement
      enableSelection
      selectionLabel="تحديد كل الموضوعات في الصفحة"
      bulkOptions={BULK_OPTIONS}
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
                const key = sortKey as UnifiedContentSortKey;
                onSortChange({
                  key,
                  direction:
                    parsedSort.key === key && parsedSort.direction === "asc"
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
        systemEmpty: "لا توجد موضوعات حتى الآن.",
        filteredEmpty: "لا توجد موضوعات مطابقة للفلاتر الحالية.",
      }}
      onBulkExecute={async (action, ids) => {
        const formData = new FormData();
        formData.set("bulk_action", action);
        if (action === "move_category" && bulkCategoryId) {
          formData.set("category_id", bulkCategoryId);
        }
        ids.forEach((id) => formData.append("topic_ids", String(id)));
        return bulkUpdateUnifiedContent(formData);
      }}
      initialFeedback={initialFeedback}
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
