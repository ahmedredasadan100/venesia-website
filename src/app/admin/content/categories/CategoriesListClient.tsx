"use client";

import { useMemo, useState } from "react";
import { AdminEntityList } from "../../../../components/admin/entity-list";
import {
  AdminFilterListbox,
  AdminFiltersShell,
  AdminSearchInput,
  AdminTablePagination,
} from "../../../../components/admin/ui";
import { useClientMounted } from "../../../../hooks/use-client-mounted";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import {
  createCategoryColumns,
  type CategoryColumnKey,
  type CategoryListRow,
  type CategorySortKey,
  CATEGORIES_ACTIONS_COLUMN_WIDTH,
} from "./categories-columns";

const STATUS_OPTIONS = [
  { value: "all", label: "كل الحالات" },
  { value: "published", label: "منشور" },
  { value: "hidden", label: "مخفي" },
] as const;

export default function CategoriesListClient({
  rows,
  parentOptions,
}: {
  rows: CategoryListRow[];
  parentOptions: Array<{ id: number; name: string; level: number }>;
}) {
  const isMounted = useClientMounted();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
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
        } else {
          result = a.name.localeCompare(b.name, "ar");
        }
        return sort.direction === "asc" ? result : -result;
      });
    }

    return next;
  }, [query, rows, sort, status]);

  const statusDisplay =
    STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "كل الحالات";

  return (
    <div className="space-y-4" data-admin-entity-list-consumer="categories">
      <AdminFiltersShell>
        <AdminSearchInput
          value={query}
          onChange={setQuery}
          placeholder="ابحث في التصنيفات..."
          className="max-w-[330px]"
        />
        <AdminFilterListbox
          id="categories-status-filter"
          isMounted={isMounted}
          placeholder="كل الحالات"
          value={status}
          displayValue={statusDisplay}
          isOpen={openDropdown === "status"}
          onToggle={() =>
            setOpenDropdown((current) => (current === "status" ? null : "status"))
          }
          onSelect={(value) => {
            setStatus(value);
            setOpenDropdown(null);
          }}
          options={STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          className="min-w-[160px]"
        />
      </AdminFiltersShell>

      <AdminEntityList<
        CategoryListRow,
        CategoryColumnKey,
        CategorySortKey,
        number
      >
        listId="content-categories-table"
        rows={filteredRows}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        enableColumnManagement={false}
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
        rowClassName={(row) =>
          row.depth === 0 ? "bg-white/[0.015]" : ""
        }
      />

      <AdminTablePagination
        basePath="/admin/content/categories"
        rangeStart={filteredRows.length ? 1 : 0}
        rangeEnd={filteredRows.length}
        totalCount={filteredRows.length}
        pageSize={String(Math.max(filteredRows.length, 10))}
        pageSizeOptions={["10", "20", "30", "50"]}
        pageSizeSelectorMode="never"
        currentPage={1}
        totalPages={1}
        emptySummaryText="لا توجد تصنيفات"
        forceShowSummary
      />
    </div>
  );
}
