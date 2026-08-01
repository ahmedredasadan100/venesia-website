"use client";

import Link from "next/link";

import {
  AdminDataGridRowActions,
  AdminStatusPill,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import {
  ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
} from "../../../../components/admin/ui/AdminDataGrid";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import type { ProjectSortField } from "../../../../lib/admin/projects/entity-list-contract";
import type { ProjectColumnKey } from "../../../../lib/admin/projects/projects-list-config";
import { getProjectHref } from "../../../../lib/projects/public-helpers";
import { formatDate } from "./projects-table-utils";
import type { ProjectGridRow } from "./projects-table-types";

export {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH as PROJECT_ACTIONS_COLUMN_WIDTH,
} from "../../../../components/admin/ui/AdminDataGrid";

export type ProjectRowActionHandlers = {
  rowPendingAction: (id: number) => string | null;
  mutationBusy: boolean;
  onCopyPublicLink: (row: ProjectGridRow) => Promise<AdminActionResult>;
  onDelete: (row: ProjectGridRow) => Promise<AdminActionResult>;
  onDuplicate: (row: ProjectGridRow) => Promise<AdminActionResult>;
  onToggleFeatured: (row: ProjectGridRow) => Promise<AdminActionResult>;
};

function ProjectIcon({ type }: Pick<ProjectGridRow, "type">) {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B87A]/16 bg-[#D8B87A]/8 text-[#D8B87A]">
      {type === "commercial" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
          <path d="M10 6h4M10 10h4M10 14h4M10 18h4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V21h13V10.5M9.5 21v-6h5v6" />
        </svg>
      )}
    </span>
  );
}

function ProjectRowActions({
  row,
  handlers,
  onMutationResult,
}: {
  row: ProjectGridRow;
  handlers: ProjectRowActionHandlers;
  onMutationResult?: (result: AdminActionResult) => void;
}) {
  const pendingAction = handlers.rowPendingAction(row.id);
  const pendingState = {
    access: "disabled" as const,
    disabledReason: "انتظر انتهاء الإجراء الحالي.",
    pending: true,
  };
  const busyState = {
    access: "disabled" as const,
    disabledReason: "انتظر انتهاء الإجراء الحالي.",
  };

  async function run(
    handler: (project: ProjectGridRow) => Promise<AdminActionResult>,
  ) {
    const result = await handler(row);
    onMutationResult?.(result);
    if (!result.ok) throw new Error(result.message);
  }

  const capability: AdminRowActionsCapability = {
    entityType: "project",
    entityId: row.id,
    entityLabel: row.arabic_name,
    actions: {
      edit: {
        access: "allowed",
        href: `/admin/projects/${row.id}`,
      },
      preview: {
        access: "allowed",
        href: getProjectHref(row),
        target: "_blank",
        rel: "noopener noreferrer",
      },
      information: {
        access: "allowed",
        title: "معلومات المشروع",
        items: [
          { label: "المعرف", value: String(row.id) },
          { label: "الرابط المختصر", value: row.slug },
          {
            label: "النوع",
            value: row.type === "commercial" ? "تجاري" : "سكني",
          },
          { label: "الموقع", value: row.location_label || "—" },
          { label: "التمييز", value: row.featured ? "مميز" : "عادي" },
          { label: "آخر تحديث", value: formatDate(row.updated_at) },
        ],
      },
      copyPublicLink: {
        access: "allowed",
        onSelect: () => run(handlers.onCopyPublicLink),
      },
      visibility: { access: "hidden" },
      featured:
        pendingAction === "featured"
          ? { ...pendingState, isFeatured: row.featured }
          : handlers.mutationBusy
            ? { ...busyState, isFeatured: row.featured }
            : {
                access: "allowed",
                isFeatured: row.featured,
                onSelect: () => run(handlers.onToggleFeatured),
              },
      duplicate:
        pendingAction === "duplicate"
          ? pendingState
          : handlers.mutationBusy
            ? busyState
            : {
                access: "allowed",
                onSelect: () => run(handlers.onDuplicate),
              },
      archive: { access: "hidden" },
      delete: pendingAction === "delete"
        ? pendingState
        : handlers.mutationBusy
          ? busyState
          : {
              access: "allowed",
              onSelect: () => run(handlers.onDelete),
              confirmation: {
                mode: "shared",
                title: "حذف نهائي للمشروع",
                description: `سيُحذف «${row.arabic_name}» وكل بياناته التابعة من المخطط النظيف. لا يمكن التراجع عن هذا الإجراء.`,
                confirmLabel: "تأكيد الحذف النهائي",
              },
            },
    },
  };

  return (
    <AdminDataGridRowActions capability={capability} size="compact" />
  );
}

function singleLine(value: string, className = "") {
  return (
    <span className={`block truncate text-sm text-white/65 ${className}`.trim()} title={value}>
      {value}
    </span>
  );
}

export function createProjectColumns(
  handlers: ProjectRowActionHandlers,
): AdminEntityColumnDef<ProjectGridRow, ProjectColumnKey, ProjectSortField>[] {
  return [
    {
      key: "project",
      label: "اسم المشروع (العربي)",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "arabic_name",
      align: "start",
      minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon,
      width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <Link
          href={`/admin/projects/${row.id}`}
          className="flex min-w-0 items-center gap-3 text-right transition hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
          title={`تعديل ${row.arabic_name}`}
        >
          <ProjectIcon type={row.type} />
          <span
            className="min-w-0 truncate font-semibold text-white"
            style={{
              maxWidth:
                ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textBudgetPx,
            }}
          >
            {row.arabic_name}
          </span>
        </Link>
      ),
    },
    {
      key: "featured",
      label: "مميز",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 96,
      width: 96,
      renderCell: ({ row }) => (
        <AdminStatusPill tone={row.featured ? "gold" : "muted"}>
          {row.featured ? "مميز" : "غير مميز"}
        </AdminStatusPill>
      ),
    },
    {
      key: "city",
      label: "المدينة",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 150,
      width: 160,
      renderCell: ({ row }) => singleLine(row.city_name),
    },
    {
      key: "main_area",
      label: "المنطقة الرئيسية",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 170,
      width: 180,
      renderCell: ({ row }) => singleLine(row.main_area_name),
    },
    {
      key: "sub_area",
      label: "المنطقة الفرعية",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 170,
      width: 180,
      renderCell: ({ row }) => singleLine(row.sub_area_name),
    },
    {
      key: "english_name",
      label: "الاسم بالإنجليزية",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "english_name",
      align: "center",
      minWidth: 190,
      width: 210,
      renderCell: ({ row }) => singleLine(row.english_name, "font-en text-center"),
    },
    {
      key: "slug",
      label: "الرابط",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "slug",
      align: "center",
      minWidth: 170,
      width: 190,
      renderCell: ({ row }) => singleLine(row.slug, "font-en text-center text-[#D8B87A]/85"),
    },
    {
      key: "updated_at",
      label: "آخر تحديث",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "updated_at",
      align: "center",
      minWidth: 140,
      width: 150,
      renderCell: ({ row }) => singleLine(formatDate(row.updated_at), "font-en text-center tabular-nums"),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      align: "center",
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => (
        <ProjectRowActions
          row={row}
          handlers={handlers}
          onMutationResult={onMutationResult}
        />
      ),
    },
  ];
}
