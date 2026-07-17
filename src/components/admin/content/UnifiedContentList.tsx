"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { bulkUpdateUnifiedContent } from "../../../app/admin/content/topics/actions";
import type { AdminContentCategoryNode } from "../../../lib/admin/content/category-hierarchy";
import type {
  ContentSortValue,
  UnifiedContentRow,
} from "../../../lib/admin/content/load-unified-content";
import { AdminBulkActionSelect } from "../ui/AdminSelect";
import AdminColumnVisibilityMenu from "./AdminColumnVisibilityMenu";
import {
  DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS,
  UNIFIED_CONTENT_COLUMNS,
  type UnifiedContentColumn,
  type UnifiedContentColumnKey,
  type UnifiedContentSortKey,
} from "./unified-content-columns";

function sanitizeVisibleColumns(keys: string[]) {
  const allowed = new Set(UNIFIED_CONTENT_COLUMNS.map((column) => column.key));
  const visible = keys.filter((key): key is UnifiedContentColumnKey =>
    allowed.has(key as UnifiedContentColumnKey),
  );
  for (const fixed of UNIFIED_CONTENT_COLUMNS.filter((column) => !column.hideable)) {
    if (!visible.includes(fixed.key)) visible.push(fixed.key);
  }
  return visible.length ? visible : [...DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS];
}

function parseSort(sort: ContentSortValue) {
  const direction = sort.endsWith("_asc") ? "asc" : "desc";
  const key = sort.slice(0, -(direction.length + 1)) as UnifiedContentSortKey;
  return { key, direction };
}

function sortHref(
  currentListPath: string,
  column: UnifiedContentColumn,
  currentSort: ContentSortValue,
) {
  if (!column.sortKey) return currentListPath;
  const parsed = parseSort(currentSort);
  const direction = parsed.key === column.sortKey && parsed.direction === "asc" ? "desc" : "asc";
  const url = new URL(currentListPath, "https://admin.local");
  url.searchParams.set("sort", `${column.sortKey}_${direction}`);
  url.searchParams.delete("page");
  return `${url.pathname}${url.search}#content-topics-table`;
}

function SortIndicator({
  column,
  sort,
}: {
  column: UnifiedContentColumn;
  sort: ContentSortValue;
}) {
  if (!column.sortKey) return null;
  const parsed = parseSort(sort);
  const active = parsed.key === column.sortKey;
  return (
    <span className={active ? "text-[#D8B87A]" : "text-white/25"}>
      {active ? (parsed.direction === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
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
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<UnifiedContentColumnKey[]>(() =>
    sanitizeVisibleColumns(initialVisibleColumns),
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const columns = UNIFIED_CONTENT_COLUMNS.filter((column) =>
    visibleColumns.includes(column.key),
  );
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(row.id));
  const someSelected = rows.some((row) => selectedSet.has(row.id)) && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(rows.map((row) => row.id));
  }

  function toggleOne(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section id="content-topics-table" className="scroll-mt-6 space-y-3">
      <div className="flex justify-end">
        <AdminColumnVisibilityMenu
          visibleColumns={visibleColumns}
          onChange={(next) => setVisibleColumns(sanitizeVisibleColumns(next))}
        />
      </div>

      {selectedIds.length ? (
        <form
          action={bulkUpdateUnifiedContent}
          className="flex flex-col gap-3 rounded-[18px] border border-[#D8B87A]/16 bg-[#080B10]/92 p-4 md:flex-row md:items-center md:justify-between"
        >
          <input type="hidden" name="redirect_to" value={currentListPath} />
          {selectedIds.map((id) => <input key={id} type="hidden" name="topic_ids" value={id} />)}
          <p className="text-sm font-semibold text-white">
            تم تحديد <span className="font-en text-[#D8B87A]">{selectedIds.length}</span> موضوع
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminBulkActionSelect name="bulk_action" defaultValue="publish" className="w-[165px]">
              <option value="publish">نشر</option>
              <option value="unpublish">إخفاء</option>
              <option value="archive">أرشفة</option>
              <option value="delete">حذف آمن</option>
              <option value="move_category">نقل لتصنيف</option>
              <option value="feature">تعيين كمميز</option>
              <option value="unfeature">إلغاء التمييز</option>
            </AdminBulkActionSelect>
            <AdminBulkActionSelect name="category_id" defaultValue="" className="w-[210px]">
              <option value="">اختر تصنيف النقل</option>
              {categories.filter((category) => category.is_active !== false).map((category) => (
                <option key={category.id} value={category.id}>
                  {`${"— ".repeat(category.depth)}${category.name}`}
                </option>
              ))}
            </AdminBulkActionSelect>
            <button type="submit" className="h-11 rounded-[10px] bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C]">
              تنفيذ
            </button>
            <button type="button" onClick={() => setSelectedIds([])} className="h-11 px-4 text-sm text-white/55">
              إلغاء التحديد
            </button>
          </div>
        </form>
      ) : null}

      <div className="max-w-full overflow-hidden rounded-[20px] border border-[#D8B87A]/12 bg-[#080B10]/86 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="max-w-full overflow-x-auto rounded-[14px] border border-white/8 bg-black/14">
          <table className="w-max min-w-full table-fixed border-collapse text-right">
            <colgroup>
              <col style={{ width: 46 }} />
              {columns.map((column) => (
                <col key={column.key} style={{ width: column.width ?? column.minWidth }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-[#D8B87A]/18 bg-[linear-gradient(135deg,rgba(216,184,122,0.14),rgba(56,189,248,0.08),rgba(255,255,255,0.03))] text-sm font-bold text-[#F4E7C5]">
                <th className="sticky right-0 z-30 w-[46px] min-w-[46px] bg-[#11151B] px-3 py-4 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="تحديد كل الموضوعات في الصفحة"
                    className="h-4 w-4 accent-[#D8B87A]"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    style={{ minWidth: column.minWidth, width: column.width }}
                    className={`px-4 py-4 text-center whitespace-nowrap ${
                      column.key === "title" ? "sticky right-[46px] z-30 bg-[#11151B] text-right" : ""
                    } ${column.sticky === "end" ? "sticky left-0 z-30 bg-[#11151B]" : ""}`}
                  >
                    {column.sortable ? (
                      <Link
                        href={sortHref(currentListPath, column, sort)}
                        className={`inline-flex items-center justify-center gap-2 ${column.key === "title" ? "justify-start" : ""}`}
                      >
                        {column.label}
                        <SortIndicator column={column} sort={sort} />
                      </Link>
                    ) : column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/8 transition last:border-b-0 hover:bg-white/[0.035]">
                  <td className="sticky right-0 z-20 w-[46px] min-w-[46px] bg-[#080B10] px-3 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`تحديد ${row.title || `الموضوع ${row.id}`}`}
                      className="h-4 w-4 accent-[#D8B87A]"
                    />
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{ minWidth: column.minWidth, width: column.width }}
                      className={`min-w-0 overflow-hidden px-4 py-4 text-center text-sm text-white/68 ${
                        column.key === "title" ? "sticky right-[46px] z-20 bg-[#080B10] text-right" : ""
                      } ${column.sticky === "end" ? "sticky left-0 z-20 bg-[#080B10]" : ""}`}
                    >
                      {column.renderCell(row, currentListPath)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <div className="px-6 py-14 text-center text-sm text-white/45">
              لا توجد موضوعات مطابقة للفلاتر الحالية.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
