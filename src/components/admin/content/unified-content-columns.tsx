import Link from "next/link";
import type { ReactNode } from "react";
import { formatAdminListDate } from "../../../lib/content-dates";
import { getContentTypeLabel } from "../../../lib/admin/content/content-types";
import { adminContentTopicPath } from "../../../lib/admin/content-routes";
import type { UnifiedContentRow } from "../../../lib/admin/content/load-unified-content";
import AdminCategoryBadge from "./AdminCategoryBadge";
import UnifiedContentRowActions from "./UnifiedContentRowActions";

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
  | "created_by";

export type UnifiedContentColumn = {
  key: UnifiedContentColumnKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
  sortable: boolean;
  sortKey?: UnifiedContentSortKey;
  minWidth: number;
  width?: number;
  sticky?: "start" | "end";
  responsiveBehavior: "always" | "scroll";
  renderCell: (row: UnifiedContentRow, currentListPath: string) => ReactNode;
};

function singleLine(value?: string | null, fallback = "—") {
  const text = value?.trim() || fallback;
  return (
    <span className="block min-w-0 truncate whitespace-nowrap" title={text}>
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = status || "draft";
  const label =
    value === "published"
      ? "منشور"
      : value === "unpublished"
        ? "مخفي"
        : value === "archived"
          ? "أرشيف"
          : "مسودة";
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-xs font-semibold text-white/70">
      {label}
    </span>
  );
}

export const UNIFIED_CONTENT_COLUMNS: UnifiedContentColumn[] = [
  {
    key: "title",
    label: "العنوان",
    defaultVisible: true,
    hideable: false,
    sortable: true,
    sortKey: "title",
    minWidth: 360,
    width: 420,
    sticky: "start",
    responsiveBehavior: "always",
    renderCell: (row) => (
      <div className="flex min-w-0 flex-nowrap items-center gap-3">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M7 3.75h6.2L18 8.55v11.7H7V3.75Z" stroke="#E7B94F" fill="rgba(216,184,122,0.08)" />
          <path d="M13.1 4.1v4.75h4.65M9.7 12.3h5.4M9.7 15.3h4.2" stroke="#F1C668" strokeLinecap="round" />
        </svg>
        <Link
          href={adminContentTopicPath(row.id)}
          className="block min-w-0 flex-1 truncate whitespace-nowrap text-right text-sm font-bold text-white transition hover:text-[#F4D99A]"
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
    responsiveBehavior: "scroll",
    renderCell: (row) => (
      <AdminCategoryBadge name={row.category_name} colorToken={row.category_color_token} />
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
    responsiveBehavior: "scroll",
    renderCell: (row) => <span className="font-en tabular-nums text-white/58">#{row.id}</span>,
  },
  {
    key: "views",
    label: "المشاهدات",
    defaultVisible: false,
    hideable: true,
    sortable: true,
    sortKey: "views",
    minWidth: 120,
    responsiveBehavior: "scroll",
    renderCell: (row) => <span className="font-en tabular-nums text-white/68">{new Intl.NumberFormat("ar-EG").format(row.views_count ?? 0)}</span>,
  },
  {
    key: "created_at",
    label: "تاريخ الإنشاء",
    defaultVisible: false,
    hideable: true,
    sortable: true,
    sortKey: "created_at",
    minWidth: 140,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(formatAdminListDate(row.created_at)),
  },
  {
    key: "updated_at",
    label: "آخر تعديل",
    defaultVisible: false,
    hideable: true,
    sortable: true,
    sortKey: "updated_at",
    minWidth: 140,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(formatAdminListDate(row.updated_at)),
  },
  {
    key: "created_by",
    label: "أنشأه",
    defaultVisible: false,
    hideable: true,
    sortable: true,
    sortKey: "created_by",
    minWidth: 180,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(row.created_by_display, "غير مسجل"),
  },
  {
    key: "content_type",
    label: "نوع المحتوى",
    defaultVisible: false,
    hideable: true,
    sortable: false,
    minWidth: 130,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(getContentTypeLabel(row.content_type)),
  },
  {
    key: "series",
    label: "السلسلة",
    defaultVisible: false,
    hideable: true,
    sortable: false,
    minWidth: 170,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(row.series_name),
  },
  {
    key: "status",
    label: "الحالة",
    defaultVisible: false,
    hideable: true,
    sortable: false,
    minWidth: 110,
    responsiveBehavior: "scroll",
    renderCell: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "featured",
    label: "التمييز",
    defaultVisible: false,
    hideable: true,
    sortable: false,
    minWidth: 100,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(row.is_featured ? "مميز" : "غير مميز"),
  },
  {
    key: "published_at",
    label: "تاريخ النشر",
    defaultVisible: false,
    hideable: true,
    sortable: false,
    minWidth: 140,
    responsiveBehavior: "scroll",
    renderCell: (row) => singleLine(row.published_at ? formatAdminListDate(row.published_at) : "لم يُنشر"),
  },
  {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
    sortable: false,
    minWidth: 344,
    width: 344,
    sticky: "end",
    responsiveBehavior: "always",
    renderCell: (row, currentListPath) => (
      <UnifiedContentRowActions row={row} currentListPath={currentListPath} />
    ),
  },
];

export const DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS = UNIFIED_CONTENT_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.key);
