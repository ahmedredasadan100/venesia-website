import Link from "next/link";
import { formatAdminListDate } from "../../../lib/content-dates";
import { getContentTypeLabel } from "../../../lib/admin/content/content-types";
import { getContentStatusMetadata } from "../../../lib/admin/content/content-status-metadata";
import { adminContentTopicPath } from "../../../lib/admin/content-routes";
import type { UnifiedContentRow } from "../../../lib/admin/content/load-unified-content";
import type { AdminEntityColumnDef } from "../../../lib/admin/entity-list";
import {
  AdminStatusPill,
} from "../ui";
import {
  ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
} from "../ui/AdminDataGrid";
import AdminCategoryBadge from "./AdminCategoryBadge";
import UnifiedContentRowActions, {
  type UnifiedContentRowActionHandlers,
} from "./UnifiedContentRowActions";

export type UnifiedContentColumnKey =
  | "title"
  | "category"
  | "id"
  | "views"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "content_type"
  | "series"
  | "status"
  | "featured"
  | "published_at"
  | "actions";

export type UnifiedContentSortKey =
  | "id"
  | "title"
  | "category"
  | "views"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "status";

export type UnifiedContentColumn = AdminEntityColumnDef<
  UnifiedContentRow,
  UnifiedContentColumnKey,
  UnifiedContentSortKey
>;

export {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH as UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH,
} from "../ui/AdminDataGrid";

export {
  TOPICS_LIST_VIEW_KEY,
  TOPICS_PREFERENCE_COLUMN_KEYS,
} from "../../../lib/admin/content/topics-list-config";

function singleLine(value?: string | null, fallback = "—") {
  const text = value?.trim() || fallback;
  return (
    <span className="block min-w-0 truncate whitespace-nowrap" title={text}>
      {text}
    </span>
  );
}

export function createUnifiedContentColumns(
  currentListPath: string,
  rowActionHandlers?: UnifiedContentRowActionHandlers,
): UnifiedContentColumn[] {
  return [
    {
      key: "title",
      label: "العنوان",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "title",
      minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.compactIcon,
      width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.compactIcon,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <div className="flex min-w-0 flex-nowrap items-center gap-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-7 w-7 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path
              d="M7 3.75h6.2L18 8.55v11.7H7V3.75Z"
              stroke="#E7B94F"
              fill="rgba(216,184,122,0.08)"
            />
            <path
              d="M13.1 4.1v4.75h4.65M9.7 12.3h5.4M9.7 15.3h4.2"
              stroke="#F1C668"
              strokeLinecap="round"
            />
          </svg>
          <Link
            href={adminContentTopicPath(row.id, { returnTo: currentListPath })}
            className="block min-w-0 flex-1 cursor-pointer truncate whitespace-nowrap text-right text-sm font-bold text-white transition hover:text-[#F4D99A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
            style={{
              maxWidth:
                ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textBudgetPx,
            }}
            title={row.title || "بدون عنوان"}
          >
            {row.title || "بدون عنوان"}
          </Link>
        </div>
      ),
    },
    {
      key: "category",
      label: "التصنيف",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "category",
      minWidth: 170,
      renderCell: ({ row }) => (
        <AdminCategoryBadge
          name={row.category_name}
          colorToken={row.category_color_token}
        />
      ),
    },
    {
      key: "id",
      label: "ID",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "id",
      minWidth: 86,
      renderCell: ({ row }) => (
        <span className="font-en tabular-nums text-white/58">#{row.id}</span>
      ),
    },
    {
      key: "views",
      label: "المشاهدات",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "views",
      minWidth: 120,
      renderCell: ({ row }) => (
        <span className="font-en tabular-nums text-white/68">
          {new Intl.NumberFormat("ar-EG").format(row.views_count ?? 0)}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "تاريخ الإنشاء",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "created_at",
      minWidth: 140,
      renderCell: ({ row }) => singleLine(formatAdminListDate(row.created_at)),
    },
    {
      key: "updated_at",
      label: "آخر تعديل",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "updated_at",
      minWidth: 140,
      renderCell: ({ row }) => singleLine(formatAdminListDate(row.updated_at)),
    },
    {
      key: "created_by",
      label: "أنشأه",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "created_by",
      minWidth: 180,
      renderCell: ({ row }) =>
        singleLine(row.created_by_display, "غير مسجل"),
    },
    {
      key: "content_type",
      label: "نوع المحتوى",
      defaultVisible: false,
      hideable: true,
      sortable: false,
      minWidth: 130,
      renderCell: ({ row }) =>
        singleLine(getContentTypeLabel(row.content_type)),
    },
    {
      key: "series",
      label: "السلسلة",
      defaultVisible: false,
      hideable: true,
      sortable: false,
      minWidth: 170,
      renderCell: ({ row }) => singleLine(row.series_name),
    },
    {
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "status",
      minWidth: 104,
      renderCell: ({ row }) => {
        const status = getContentStatusMetadata(row.status);
        return (
          <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
        );
      },
    },
    {
      key: "featured",
      label: "التمييز",
      defaultVisible: false,
      hideable: true,
      sortable: false,
      minWidth: 100,
      renderCell: ({ row }) =>
        singleLine(row.is_featured ? "مميز" : "غير مميز"),
    },
    {
      key: "published_at",
      label: "تاريخ النشر",
      defaultVisible: false,
      hideable: true,
      sortable: false,
      minWidth: 140,
      renderCell: ({ row }) =>
        singleLine(
          row.published_at ? formatAdminListDate(row.published_at) : "لم يُنشر",
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
      renderCell: ({ row, onMutationResult }) =>
        rowActionHandlers ? (
          <UnifiedContentRowActions
            row={row}
            currentListPath={currentListPath}
            onMutationResult={onMutationResult}
            handlers={rowActionHandlers}
          />
        ) : null,
    },
  ];
}

/** Static catalog for preference allow-lists and default keys (no path-bound renderers). */
export const UNIFIED_CONTENT_COLUMNS = createUnifiedContentColumns("");

export const DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS = UNIFIED_CONTENT_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.key);
