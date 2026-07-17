"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkUpdateUnifiedContent,
  saveContentTablePreferences,
} from "../../../app/admin/content/topics/actions";
import AdminNotice from "../AdminNotice";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import type { AdminContentCategoryNode } from "../../../lib/admin/content/category-hierarchy";
import {
  adminContentTopicPath,
} from "../../../lib/admin/content-routes";
import type {
  ContentSortValue,
  UnifiedContentRow,
} from "../../../lib/admin/content/load-unified-content";
import AdminBulkActionBar from "../ui/AdminBulkActionBar";
import AdminColumnVisibilityMenu from "../ui/AdminColumnVisibilityMenu";
import {
  AdminDataGrid,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridSortLink,
  AdminDataGridStickyActionsCell,
  AdminDataGridStickyActionsHeaderCell,
  ADMIN_DATA_GRID_HEADER_CLASSES,
} from "../ui/AdminDataGrid";
import { AdminBulkActionSelect } from "../ui/AdminSelect";
import { useAdminGridSelection } from "../ui/useAdminGridSelection";
import {
  DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS,
  UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH,
  UNIFIED_CONTENT_COLUMNS,
  type UnifiedContentColumn,
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

function sanitizeVisibleColumns(keys: readonly string[]) {
  const allowed = new Set(UNIFIED_CONTENT_COLUMNS.map((column) => column.key));
  const visible = keys.filter((key): key is UnifiedContentColumnKey =>
    allowed.has(key as UnifiedContentColumnKey),
  );
  for (const fixed of UNIFIED_CONTENT_COLUMNS.filter(
    (column) => !column.hideable,
  )) {
    if (!visible.includes(fixed.key)) visible.push(fixed.key);
  }
  return visible.length
    ? visible
    : [...DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS];
}

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
  column: UnifiedContentColumn,
  currentSort: ContentSortValue,
) {
  if (!column.sortKey) return currentListPath;
  const parsed = parseSort(currentSort);
  const direction =
    parsed.key === column.sortKey && parsed.direction === "asc"
      ? "desc"
      : "asc";
  const url = new URL(currentListPath, "https://admin.local");
  url.searchParams.set("sort", `${column.sortKey}_${direction}`);
  url.searchParams.delete("page");
  return `${url.pathname}${url.search}#content-topics-table`;
}

function defaultSortPath(currentListPath: string) {
  const url = new URL(currentListPath, "https://admin.local");
  url.searchParams.delete("sort");
  url.searchParams.delete("page");
  return `${url.pathname}${url.search}#content-topics-table`;
}

export default function UnifiedContentList({
  rows,
  categories,
  currentListPath,
  sort,
  initialVisibleColumns,
}: {
  rows: UnifiedContentRow[];
  categories: AdminContentCategoryNode[];
  currentListPath: string;
  sort: ContentSortValue;
  initialVisibleColumns: string[];
}) {
  const router = useRouter();
  const bulkPendingRef = useRef(false);
  const selection = useAdminGridSelection(rows.map((row) => row.id));
  const [visibleColumns, setVisibleColumns] = useState<
    UnifiedContentColumnKey[]
  >(() => sanitizeVisibleColumns(initialVisibleColumns));
  const [bulkAction, setBulkAction] = useState("publish");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [feedback, setFeedback] = useState<AdminActionResult | null>(null);
  const columns = useMemo(
    () =>
      UNIFIED_CONTENT_COLUMNS.filter((column) =>
        visibleColumns.includes(column.key),
      ),
    [visibleColumns],
  );
  const parsedSort = parseSort(sort);

  function handleVisibleColumnsChange(next: UnifiedContentColumnKey[]) {
    const sanitized = sanitizeVisibleColumns(next);
    setVisibleColumns(sanitized);
  }

  function handleVisibleColumnsPersisted(next: UnifiedContentColumnKey[]) {
    const sanitized = sanitizeVisibleColumns(next);
    const activeColumn = UNIFIED_CONTENT_COLUMNS.find(
      (column) => column.sortKey === parsedSort.key,
    );
    if (activeColumn && !sanitized.includes(activeColumn.key)) {
      router.replace(defaultSortPath(currentListPath), { scroll: false });
    }
  }

  function handleMutationResult(result: AdminActionResult) {
    setFeedback(result);
    if (result.ok && result.code === "deleted" && result.entityId) {
      selection.removeSelection(result.entityId);
    }
  }

  async function executeBulkAction(action: string, ids: number[]) {
    if (bulkPendingRef.current) return;
    bulkPendingRef.current = true;
    setBulkPending(true);
    const formData = new FormData();
    formData.set("bulk_action", action);
    if (bulkCategoryId) formData.set("category_id", bulkCategoryId);
    ids.forEach((id) => formData.append("topic_ids", String(id)));

    try {
      const result = await bulkUpdateUnifiedContent(formData);
      setFeedback(result);
      if (result.ok) {
        selection.clearSelection();
        router.refresh();
      }
    } catch {
      setFeedback({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
      });
    } finally {
      bulkPendingRef.current = false;
      setBulkPending(false);
    }
  }

  const feedbackAction =
    feedback &&
    !feedback.ok &&
    feedback.code === "publish_validation" &&
    feedback.entityId
      ? {
          label: "فتح المحتوى واستكمال البيانات",
          href: adminContentTopicPath(feedback.entityId, {
            returnTo: currentListPath,
            focusTarget: feedback.focusTarget,
          }),
        }
      : undefined;

  return (
    <section id="content-topics-table" className="scroll-mt-6 space-y-3">
      <div className="flex justify-end">
        <AdminColumnVisibilityMenu
          columns={UNIFIED_CONTENT_COLUMNS}
          visibleColumns={visibleColumns}
          defaultColumns={DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS}
          onChange={handleVisibleColumnsChange}
          onPersist={saveContentTablePreferences}
          onPersisted={handleVisibleColumnsPersisted}
        />
      </div>

      {feedback ? (
        <AdminNotice
          variant={feedback.ok ? "success" : "danger"}
          title={feedback.title}
          message={feedback.message}
          action={feedbackAction}
        />
      ) : null}

      <AdminBulkActionBar
        selectedIds={selection.selectedIds}
        entityLabel="موضوع"
        options={[...BULK_OPTIONS]}
        onClearSelection={selection.clearSelection}
        onExecute={executeBulkAction}
        isBusy={bulkPending}
        idsFieldName="topic_ids"
        actionValue={bulkAction}
        actionControl={
          <AdminBulkActionSelect
            name="bulk_action"
            value={bulkAction}
            onChange={(event) => setBulkAction(event.currentTarget.value)}
            disabled={bulkPending}
            className="w-[165px]"
          >
            {BULK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminBulkActionSelect>
        }
        additionalControls={
          bulkAction === "move_category" ? (
            <AdminBulkActionSelect
              name="category_id"
              value={bulkCategoryId}
              onChange={(event) =>
                setBulkCategoryId(event.currentTarget.value)
              }
              disabled={bulkPending}
              className="w-[210px]"
            >
              <option value="">اختر تصنيف النقل</option>
              {categories
                .filter((category) => category.is_active !== false)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {`${"— ".repeat(category.depth)}${category.name}`}
                  </option>
                ))}
            </AdminBulkActionSelect>
          ) : null
        }
      />

      <AdminDataGrid className="max-w-full overflow-hidden">
        <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-right">
          <colgroup>
            <col style={{ width: 46 }} />
            {columns.map((column) => (
              <col
                key={column.key}
                style={{ width: column.width ?? column.minWidth }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className={ADMIN_DATA_GRID_HEADER_CLASSES}>
              <th className="sticky start-0 z-40 w-[46px] min-w-[46px] bg-[#10151C] px-3 py-4 text-center">
                <AdminDataGridCheckbox
                  inputRef={selection.selectAllRef}
                  checked={selection.allSelected}
                  onChange={(event) =>
                    selection.toggleAll(event.currentTarget.checked)
                  }
                  label="تحديد كل الموضوعات في الصفحة"
                />
              </th>
              {columns.map((column) => {
                const content = column.sortable ? (
                  <AdminDataGridSortLink
                    href={sortHref(currentListPath, column, sort)}
                    active={parsedSort.key === column.sortKey}
                    direction={parsedSort.direction}
                    className={column.key === "title" ? "justify-start" : ""}
                  >
                    {column.label}
                  </AdminDataGridSortLink>
                ) : (
                  column.label
                );

                if (column.sticky === "end") {
                  return (
                    <AdminDataGridStickyActionsHeaderCell
                      key={column.key}
                      width={UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH}
                    >
                      {content}
                    </AdminDataGridStickyActionsHeaderCell>
                  );
                }

                return (
                  <th
                    key={column.key}
                    style={{
                      minWidth: column.minWidth,
                      width: column.width,
                    }}
                    className={`whitespace-nowrap px-4 py-4 text-center ${
                      column.key === "title"
                        ? "sticky start-[46px] z-40 bg-[#10151C] text-right"
                        : ""
                    }`}
                  >
                    {content}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-white/8 transition hover:bg-white/[0.035]"
              >
                <td className="sticky start-0 z-30 w-[46px] min-w-[46px] border-b border-white/8 bg-[#080B10] px-3 py-4 text-center transition group-last:border-b-0 group-hover:bg-[#0D1117]">
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(row.id)}
                    onChange={(event) =>
                      selection.toggleOne(row.id, event.currentTarget.checked)
                    }
                    label={`تحديد ${row.title || `الموضوع ${row.id}`}`}
                  />
                </td>
                {columns.map((column) => {
                  const content = column.renderCell(
                    row,
                    currentListPath,
                    handleMutationResult,
                  );
                  if (column.sticky === "end") {
                    return (
                      <AdminDataGridStickyActionsCell
                        key={column.key}
                        width={UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH}
                        className="border-b border-white/8 group-last:border-b-0"
                      >
                        {content}
                      </AdminDataGridStickyActionsCell>
                    );
                  }
                  return (
                    <td
                      key={column.key}
                      style={{
                        minWidth: column.minWidth,
                        width: column.width,
                      }}
                      className={`min-w-0 overflow-hidden border-b border-white/8 px-4 py-4 text-center text-sm text-white/68 group-last:border-b-0 ${
                        column.key === "title"
                          ? "sticky start-[46px] z-30 bg-[#080B10] text-right transition group-hover:bg-[#0D1117]"
                          : ""
                      }`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <AdminDataGridEmpty>
            لا توجد موضوعات مطابقة للفلاتر الحالية.
          </AdminDataGridEmpty>
        ) : null}
      </AdminDataGrid>
    </section>
  );
}
