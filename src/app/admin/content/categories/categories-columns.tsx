"use client";

import AdminCategoryBadge from "../../../../components/admin/content/AdminCategoryBadge";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import {
  AdminStatusPill,
  getAdminDataGridActionsColumnWidth,
} from "../../../../components/admin/ui";
import CategoryEditModal from "./CategoryEditModal";
import CategoryRowActions from "./CategoryRowActions";

export type CategoryListRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  parent_id: number | null;
  status: string | null;
  color_token: string | null;
  ownCount: number;
  totalCount: number;
  depth: number;
  childCount: number;
};

export type CategoryColumnKey = "name" | "count" | "status" | "actions";
export type CategorySortKey = "name" | "count" | "status";

export const CATEGORIES_ACTIONS_COLUMN_WIDTH = getAdminDataGridActionsColumnWidth(
  5,
  "compact",
  12,
);

function FolderIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={large ? "h-9 w-9" : "h-6 w-6"}
      fill="none"
    >
      <path
        d="M3.4 7.9A2.4 2.4 0 0 1 5.8 5.5h4.6c.5 0 .98.18 1.36.51l1.35 1.16c.38.33.86.51 1.36.51h3.73a2.4 2.4 0 0 1 2.4 2.4v.57H3.4V7.9Z"
        fill="#F1C668"
      />
      <path
        d="M3.4 9.9h17.2v6.35a2.55 2.55 0 0 1-2.55 2.55H5.95a2.55 2.55 0 0 1-2.55-2.55V9.9Z"
        fill="#D9A93B"
      />
      <path
        d="M4 10.35h16"
        stroke="#FFE49A"
        strokeOpacity=".45"
        strokeWidth=".8"
      />
    </svg>
  );
}

export function createCategoryColumns(
  parentOptions: Array<{ id: number; name: string; level: number }>,
): AdminEntityColumnDef<CategoryListRow, CategoryColumnKey, CategorySortKey>[] {
  return [
    {
      key: "name",
      label: "التصنيف",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "name",
      minWidth: 320,
      width: 360,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <CategoryEditModal
          category={row}
          parentOptions={parentOptions}
          showActionButton={false}
          renderTrigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="relative flex w-full min-w-0 items-center justify-start gap-3 rounded-[10px] py-1 text-right transition hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
              style={{ paddingInlineStart: row.depth ? `${row.depth * 28}px` : 0 }}
              title={`تعديل ${row.name}`}
            >
              {row.depth > 0 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-px w-7 shrink-0 border-t border-dashed border-white/25 xl:block"
                />
              ) : null}
              <span data-category-folder>
                <FolderIcon large={row.depth === 0} />
              </span>
              <span className="min-w-0">
                <AdminCategoryBadge
                  name={row.name}
                  colorToken={row.color_token}
                  className={row.depth === 0 ? "text-sm font-bold" : "font-semibold"}
                />
              </span>
            </button>
          )}
        />
      ),
    },
    {
      key: "count",
      label: "العدد",
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
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "status",
      minWidth: 104,
      width: 104,
      renderCell: ({ row }) => (
        <AdminStatusPill tone={Boolean(row.is_active) ? "green" : "gold"}>
          {Boolean(row.is_active) ? "منشور" : "مخفي"}
        </AdminStatusPill>
      ),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      minWidth: CATEGORIES_ACTIONS_COLUMN_WIDTH,
      width: CATEGORIES_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row }) => (
        <CategoryRowActions category={row} parentOptions={parentOptions} />
      ),
    },
  ];
}
