"use client";

import Link from "next/link";

import AdminCategoryBadge from "../../../../components/admin/content/AdminCategoryBadge";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import {
  AdminStatusPill,
} from "../../../../components/admin/ui";
import {
  ADMIN_DATA_GRID_HIERARCHY_LABEL_MAX_WIDTH,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  getAdminDataGridHierarchyPrimaryColumnWidth,
} from "../../../../components/admin/ui/AdminDataGrid";
import CategoryRowActions from "./CategoryRowActions";
import type {
  CategoryDuplicateMutationResult,
  CategoryStatusMutationResult,
} from "./actions";

export type CategoryColumnKey =
  | "name"
  | "count"
  | "status"
  | "actions"
  | "id"
  | "parent"
  | "sort_order"
  | "created_at"
  | "updated_at";

export type CategorySortKey =
  | "name"
  | "count"
  | "status"
  | "id"
  | "parent"
  | "sort_order"
  | "created_at"
  | "updated_at";

export {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH as CATEGORIES_ACTIONS_COLUMN_WIDTH,
} from "../../../../components/admin/ui/AdminDataGrid";

function FolderIcon({
  large = false,
  open = false,
}: {
  large?: boolean;
  open?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={large ? "h-9 w-9" : "h-6 w-6"}
      fill="none"
    >
      {open ? (
        <>
          <path
            d="M3.4 8A2.4 2.4 0 0 1 5.8 5.6h4.5c.55 0 1.08.2 1.48.58l1.13 1.02c.4.36.93.56 1.47.56h3.82a2.4 2.4 0 0 1 2.4 2.4v1.1H3.4V8Z"
            fill="#F1C668"
          />
          <path
            d="M4.2 10.2h16.7l-2.1 6.8a2.55 2.55 0 0 1-2.44 1.8H5.9a2.55 2.55 0 0 1-2.5-3.05l.8-5.55Z"
            fill="#D9A93B"
          />
          <path d="M5 11h14.7" stroke="#FFE49A" strokeOpacity=".55" strokeWidth=".8" />
        </>
      ) : (
        <>
          <path
            d="M3.4 7.9A2.4 2.4 0 0 1 5.8 5.5h4.6c.5 0 .98.18 1.36.51l1.35 1.16c.38.33.86.51 1.36.51h3.73a2.4 2.4 0 0 1 2.4 2.4v.57H3.4V7.9Z"
            fill="#F1C668"
          />
          <path
            d="M3.4 9.9h17.2v6.35a2.55 2.55 0 0 1-2.55 2.55H5.95a2.55 2.55 0 0 1-2.55-2.55V9.9Z"
            fill="#D9A93B"
          />
          <path d="M4 10.35h16" stroke="#FFE49A" strokeOpacity=".45" strokeWidth=".8" />
        </>
      )}
    </svg>
  );
}

function singleLine(value: string) {
  return (
    <span className="block truncate text-sm text-white/68" title={value}>
      {value}
    </span>
  );
}

export type CategoryColumnLayoutOptions = {
  /** Deepest row in the current visible tree snapshot, not a product depth cap. */
  maxVisibleDepth?: number;
};

export function createCategoryColumns(
  tree: {
    isExpanded: (categoryId: number) => boolean;
    onToggle: (categoryId: number) => void;
    rowPendingAction: (categoryId: number) => string | null;
    mutationBusy: boolean;
    onToggleStatus: (
      category: CategoryListRow,
    ) => Promise<CategoryStatusMutationResult>;
    onDuplicate: (
      category: CategoryListRow,
    ) => Promise<CategoryDuplicateMutationResult>;
    onDelete: (
      categoryId: number,
      transferToId: number | null,
    ) => Promise<{ ok: boolean; message?: string }>;
  },
  { maxVisibleDepth = 0 }: CategoryColumnLayoutOptions = {},
): AdminEntityColumnDef<CategoryListRow, CategoryColumnKey, CategorySortKey>[] {
  const primaryColumnWidth =
    getAdminDataGridHierarchyPrimaryColumnWidth(maxVisibleDepth);

  return [
    {
      key: "name",
      label: "التصنيف",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "name",
      minWidth: primaryColumnWidth,
      width: primaryColumnWidth,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => {
        const expanded = tree.isExpanded(row.id);
        return (
          <div
            className="relative flex w-full min-w-0 items-center justify-start gap-3 py-1 text-right"
            style={{
              paddingInlineStart: row.depth
                ? `${row.depth * ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.hierarchyDepthStepPx}px`
                : 0,
            }}
          >
            {row.depth > 0 ? (
              <span
                aria-hidden="true"
                className="hidden h-px w-7 shrink-0 border-t border-dashed border-white/25 xl:block"
              />
            ) : null}
            {row.childCount > 0 ? (
              <button
                type="button"
                data-category-folder-toggle=""
                data-category-folder-state={expanded ? "open" : "closed"}
                aria-expanded={expanded}
                aria-label={`${expanded ? "طي" : "فتح"} فروع التصنيف ${row.name}`}
                onClick={() => tree.onToggle(row.id)}
                className="shrink-0 cursor-pointer rounded-[8px] transition hover:bg-[#D8B87A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
              >
                <FolderIcon large={row.depth === 0} open={expanded} />
              </button>
            ) : (
              <span data-category-folder-static="" className="shrink-0">
                <FolderIcon large={row.depth === 0} />
              </span>
            )}
            <Link
              href={`/admin/content/categories/${row.id}`}
              data-category-edit-link=""
              className="min-w-0 flex-1 cursor-pointer rounded-[8px] px-1.5 py-1 text-right transition hover:bg-white/[0.04] hover:text-[#F4D99A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
              style={{ maxWidth: ADMIN_DATA_GRID_HIERARCHY_LABEL_MAX_WIDTH }}
              title={`تعديل ${row.name}`}
            >
              <AdminCategoryBadge
                name={row.name}
                colorToken={row.color_token}
                className={row.depth === 0 ? "text-sm font-bold" : "font-semibold"}
              />
            </Link>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "status",
      minWidth: 104,
      width: 104,
      renderCell: ({ row }) => (
        <AdminStatusPill tone={row.status === "published" ? "green" : "gold"}>
          {row.status === "published" ? "منشور" : "غير منشور"}
        </AdminStatusPill>
      ),
    },
    {
      key: "parent",
      label: "التصنيف الأب",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "parent",
      minWidth: 160,
      width: 180,
      renderCell: ({ row }) =>
        singleLine(row.parent_name?.trim() ? row.parent_name : "—"),
    },
    {
      key: "count",
      label: "الموضوعات",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "count",
      minWidth: 96,
      width: 96,
      renderCell: ({ row }) => (
        <span className="font-en tabular-nums text-sm font-semibold text-white/82">
          {row.totalCount}
        </span>
      ),
    },
    {
      key: "id",
      label: "المعرف",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "id",
      minWidth: 72,
      width: 72,
      renderCell: ({ row }) => (
        <span className="font-en tabular-nums text-sm text-white/55">{row.id}</span>
      ),
    },
    {
      key: "sort_order",
      label: "الترتيب",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "sort_order",
      minWidth: 88,
      width: 88,
      renderCell: ({ row }) => (
        <span className="font-en tabular-nums text-sm text-white/68">
          {row.sort_order ?? 0}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "تاريخ الإنشاء",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "created_at",
      minWidth: 140,
      width: 150,
      renderCell: ({ row }) =>
        singleLine(
          row.created_at ? formatAdminDateTime(row.created_at) : "—",
        ),
    },
    {
      key: "updated_at",
      label: "آخر تعديل",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "updated_at",
      minWidth: 140,
      width: 150,
      renderCell: ({ row }) =>
        singleLine(
          row.updated_at ? formatAdminDateTime(row.updated_at) : "—",
        ),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => (
        <CategoryRowActions
          category={row}
          onMutationResult={onMutationResult}
          pendingAction={tree.rowPendingAction(row.id)}
          mutationBusy={tree.mutationBusy}
          onToggle={tree.onToggleStatus}
          onDuplicate={tree.onDuplicate}
          onDelete={tree.onDelete}
        />
      ),
    },
  ];
}
