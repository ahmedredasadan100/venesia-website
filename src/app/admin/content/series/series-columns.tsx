"use client";

import Link from "next/link";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import {
  AdminActivityPopover,
  AdminConfirmDialog,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminEntityPreviewActions,
  AdminStatusPill,
  getAdminDataGridActionsColumnWidth,
} from "../../../../components/admin/ui";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import {
  formatAdminDateTime,
  formatAdminListDate,
} from "../../../../lib/content-dates";
import type { SeriesListRow } from "../../../../lib/admin/content/load-series-list";
import { buildAdminSeriesCollectionPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import { useRef, useState } from "react";

export type SeriesColumnKey =
  | "name"
  | "topics_count"
  | "status"
  | "actions"
  | "id"
  | "slug"
  | "category"
  | "sort_order"
  | "created_at"
  | "updated_at";

export type SeriesSortKey =
  | "name"
  | "topics_count"
  | "status"
  | "id"
  | "slug"
  | "category"
  | "sort_order"
  | "created_at"
  | "updated_at";

export const SERIES_ACTIONS_COLUMN_WIDTH = getAdminDataGridActionsColumnWidth(
  6,
  "compact",
  12,
);

function SeriesIcon() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/16 bg-[#D8B87A]/8 text-[#D8B87A]">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6.5 5h11M6.5 12h11M6.5 19h11" strokeLinecap="round" />
        <path d="M3.8 5h.01M3.8 12h.01M3.8 19h.01" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function statusMeta(status?: string | null) {
  if (status === "published") return { label: "منشور", tone: "green" as const };
  if (status === "unpublished") return { label: "مخفي", tone: "gold" as const };
  if (status === "archived") return { label: "أرشيف", tone: "muted" as const };
  return { label: "مسودة", tone: "muted" as const };
}

function singleLine(value: string) {
  return (
    <span className="block truncate text-sm text-white/68" title={value}>
      {value}
    </span>
  );
}

function SeriesRowActions({
  row,
  onMutationResult,
  handlers,
}: {
  row: SeriesListRow;
  onMutationResult?: (result: AdminActionResult) => void;
  handlers: SeriesRowActionHandlers;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingAction = handlers.rowPendingAction(row.id);
  const isHidden = row.status !== "published";
  const previewCapability = buildAdminSeriesCollectionPreviewCapability({
    id: row.id,
  });

  async function run(
    action: () => Promise<AdminActionResult>,
  ) {
    try {
      const result = await action();
      onMutationResult?.(result);
      return result;
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
      });
      return { ok: false as const };
    }
  }

  return (
    <>
      <AdminDataGridActionsCell compact>
        <AdminDataGridActionButton
          action="edit"
          href={`/admin/content/series/${row.id}`}
          size="compact"
        />
        <AdminEntityPreviewActions
          capability={previewCapability}
          presentation="data-grid-compact"
        />
        <AdminDataGridActionButton
          action="visibility"
          size="compact"
          isCurrentlyHidden={isHidden}
          visibilityEntityLabel="السلسلة"
          pending={pendingAction === "visibility"}
          disabled={pendingAction === "visibility"}
          onClick={() =>
            void run(() => handlers.onToggle(row))
          }
        />
        <AdminDataGridActionButton
          action="duplicate"
          size="compact"
          pending={pendingAction === "duplicate"}
          disabled={pendingAction === "duplicate"}
          onClick={() => void run(() => handlers.onDuplicate(row))}
        />
        <AdminDataGridActionButton
          buttonRef={deleteTriggerRef}
          action="delete"
          size="compact"
          pending={pendingAction === "delete"}
          disabled={pendingAction === "delete"}
          onClick={() => setDeleteOpen(true)}
        />
        <AdminActivityPopover
          title={`نشاط السلسلة: ${row.name}`}
          triggerLabel="معلومات النشاط"
          items={[
            {
              label: "تاريخ الإنشاء",
              value: row.created_at
                ? formatAdminDateTime(row.created_at)
                : "—",
            },
            {
              label: "آخر تعديل",
              value: row.updated_at
                ? formatAdminDateTime(row.updated_at)
                : "—",
            },
            {
              label: "التصنيف",
              value: row.category_name?.trim() || "—",
            },
            {
              label: "الموضوعات",
              value: String(row.topics_count),
            },
          ]}
        />
      </AdminDataGridActionsCell>

      <AdminConfirmDialog
        open={deleteOpen}
        title="حذف السلسلة"
        description={`هل تريد حذف سلسلة «${row.name}»؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        pending={pendingAction === "delete"}
        returnFocusRef={deleteTriggerRef}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          const result = await run(() => handlers.onDelete(row));
          if (result?.ok) setDeleteOpen(false);
        }}
      />
    </>
  );
}

export type SeriesRowActionHandlers = {
  rowPendingAction: (id: number) => string | null;
  onToggle: (row: SeriesListRow) => Promise<AdminActionResult>;
  onDuplicate: (row: SeriesListRow) => Promise<AdminActionResult>;
  onDelete: (row: SeriesListRow) => Promise<AdminActionResult>;
};

export function createSeriesColumns(
  handlers: SeriesRowActionHandlers,
): AdminEntityColumnDef<SeriesListRow, SeriesColumnKey, SeriesSortKey>[] {
  return [
    {
      key: "name",
      label: "السلسلة",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "name",
      minWidth: 320,
      width: 420,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <Link
          href={`/admin/content/series/${row.id}`}
          className="flex min-w-0 cursor-pointer items-center justify-start gap-3 text-right transition hover:text-[#F4D99A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          <SeriesIcon />
          <span className="min-w-0 truncate text-sm font-bold text-white">
            {row.name}
          </span>
        </Link>
      ),
    },
    {
      key: "topics_count",
      label: "الموضوعات",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "topics_count",
      minWidth: 120,
      width: 120,
      renderCell: ({ row }) => (
        <span className="font-en text-sm font-semibold tabular-nums text-white/72">
          {row.topics_count}
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
      minWidth: 120,
      width: 140,
      renderCell: ({ row }) => {
        const status = statusMeta(row.status);
        return (
          <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
        );
      },
    },
    {
      key: "id",
      label: "ID",
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
      key: "slug",
      label: "Slug",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "slug",
      minWidth: 140,
      width: 160,
      renderCell: ({ row }) => singleLine(row.slug || "—"),
    },
    {
      key: "category",
      label: "التصنيف",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "category",
      minWidth: 160,
      width: 180,
      renderCell: ({ row }) =>
        singleLine(row.category_name?.trim() ? row.category_name : "—"),
    },
    {
      key: "sort_order",
      label: "الترتيب",
      defaultVisible: false,
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
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "created_at",
      minWidth: 140,
      width: 150,
      renderCell: ({ row }) =>
        singleLine(row.created_at ? formatAdminListDate(row.created_at) : "—"),
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
        singleLine(row.updated_at ? formatAdminListDate(row.updated_at) : "—"),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      minWidth: SERIES_ACTIONS_COLUMN_WIDTH,
      width: SERIES_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => (
        <SeriesRowActions
          row={row}
          onMutationResult={onMutationResult}
          handlers={handlers}
        />
      ),
    },
  ];
}
