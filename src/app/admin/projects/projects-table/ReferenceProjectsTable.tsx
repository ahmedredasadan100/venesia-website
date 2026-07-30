"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  AdminConfirmDialog,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  getAdminDataGridActionsColumnWidth,
} from "../../../../components/admin/ui";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import type { ProjectSortField } from "../../../../lib/admin/projects/entity-list-contract";
import type { ProjectColumnKey } from "../../../../lib/admin/projects/projects-list-config";
import { formatDate } from "./projects-table-utils";
import type { ProjectGridRow } from "./projects-table-types";

export const PROJECT_ACTIONS_COLUMN_WIDTH = getAdminDataGridActionsColumnWidth(
  2,
  "default",
  12,
);

export type ProjectRowActionHandlers = {
  rowPendingAction: (id: number) => string | null;
  onDelete: (row: ProjectGridRow) => Promise<AdminActionResult>;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pending = handlers.rowPendingAction(row.id) === "delete";

  async function deleteProject() {
    const result = await handlers.onDelete(row);
    onMutationResult?.(result);
    if (result.ok) setDeleteOpen(false);
  }

  return (
    <>
      <AdminDataGridActionsCell>
        <AdminDataGridActionButton
          action="edit"
          href={`/admin/projects/${row.id}`}
          title="تعديل المشروع"
        />
        <AdminDataGridActionButton
          buttonRef={deleteTriggerRef}
          action="delete"
          title="حذف نهائي — يتطلب تأكيدًا"
          disabled={pending}
          pending={pending}
          onClick={() => setDeleteOpen(true)}
        />
      </AdminDataGridActionsCell>

      <AdminConfirmDialog
        open={deleteOpen}
        title="حذف نهائي للمشروع"
        description={`سيُحذف «${row.arabic_name}» وكل بياناته التابعة من المخطط النظيف. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد الحذف النهائي"
        pending={pending}
        returnFocusRef={deleteTriggerRef}
        onCancel={() => {
          if (!pending) setDeleteOpen(false);
        }}
        onConfirm={deleteProject}
      />
    </>
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
      label: "المشروع",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "arabic_name",
      minWidth: 260,
      width: 320,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <Link
          href={`/admin/projects/${row.id}`}
          className="flex min-w-0 items-center gap-3 text-right transition hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
          title={`تعديل ${row.arabic_name}`}
        >
          <ProjectIcon type={row.type} />
          <span className="min-w-0 truncate font-semibold text-white">{row.arabic_name}</span>
        </Link>
      ),
    },
    {
      key: "english_name",
      label: "الاسم بالإنجليزية",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "english_name",
      minWidth: 190,
      width: 210,
      renderCell: ({ row }) => singleLine(row.english_name, "font-en text-center"),
    },
    {
      key: "slug",
      label: "الرابط المختصر",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "slug",
      minWidth: 170,
      width: 190,
      renderCell: ({ row }) => singleLine(row.slug, "font-en text-center text-[#D8B87A]/85"),
    },
    {
      key: "location",
      label: "الموقع",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "location_label",
      minWidth: 190,
      width: 210,
      renderCell: ({ row }) => singleLine(row.location_label || "—", "text-center"),
    },
    {
      key: "updated_at",
      label: "آخر تحديث",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "updated_at",
      minWidth: 140,
      width: 150,
      renderCell: ({ row }) => singleLine(formatDate(row.updated_at), "font-en text-center tabular-nums"),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      minWidth: PROJECT_ACTIONS_COLUMN_WIDTH,
      width: PROJECT_ACTIONS_COLUMN_WIDTH,
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
