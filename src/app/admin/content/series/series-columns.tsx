"use client";

import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import {
  AdminConfirmDialog,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminStatusPill,
  getAdminDataGridActionsColumnWidth,
} from "../../../../components/admin/ui";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { useRef, useState } from "react";
import {
  deleteSeriesAjax,
  duplicateSeriesAjax,
  toggleSeriesStatusAjax,
} from "./actions";

export type SeriesListRow = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  sort_order: number | null;
  topics_count: number;
};

export type SeriesColumnKey = "name" | "topics_count" | "status" | "actions";
export type SeriesSortKey = "name" | "topics_count" | "status";

export const SERIES_ACTIONS_COLUMN_WIDTH = getAdminDataGridActionsColumnWidth(
  4,
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

function SeriesRowActions({
  row,
  onMutationResult,
  onRowsUpdated,
}: {
  row: SeriesListRow;
  onMutationResult?: (result: AdminActionResult) => void;
  onRowsUpdated?: (rows: SeriesListRow[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const isHidden = row.status === "unpublished";

  async function run(
    action: () => Promise<{
      ok: boolean;
      message?: string;
      rows?: SeriesListRow[];
    }>,
    successCode?: AdminActionResult["code"],
  ) {
    if (pending) return;
    setPending(true);
    try {
      const result = await action();
      if (result.rows) onRowsUpdated?.(result.rows);
      onMutationResult?.({
        ok: result.ok,
        title: result.ok ? "تم بنجاح" : "تعذر تنفيذ العملية",
        message: result.message ?? (result.ok ? "تم التحديث." : "فشلت العملية."),
        code: result.ok ? successCode : undefined,
        entityId: row.id,
      });
      return result;
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
      });
      return { ok: false as const };
    } finally {
      setPending(false);
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
        <AdminDataGridActionButton
          action="visibility"
          size="compact"
          title={isHidden ? "إظهار" : "إخفاء"}
          hidden={isHidden}
          disabled={pending}
          onClick={() =>
            void run(
              () => toggleSeriesStatusAjax(row.id, row.status),
              isHidden ? "published" : "unpublished",
            )
          }
        />
        <AdminDataGridActionButton
          action="duplicate"
          size="compact"
          disabled={pending}
          onClick={() => void run(() => duplicateSeriesAjax(row.id), "created")}
        />
        <AdminDataGridActionButton
          buttonRef={deleteTriggerRef}
          action="delete"
          size="compact"
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
        />
      </AdminDataGridActionsCell>

      <AdminConfirmDialog
        open={deleteOpen}
        title="حذف السلسلة"
        description={`هل تريد حذف سلسلة «${row.name}»؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        pending={pending}
        returnFocusRef={deleteTriggerRef}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          const result = await run(() => deleteSeriesAjax(row.id), "deleted");
          if (result?.ok) setDeleteOpen(false);
        }}
      />
    </>
  );
}

export function createSeriesColumns(handlers: {
  onRowsUpdated?: (rows: SeriesListRow[]) => void;
}): AdminEntityColumnDef<SeriesListRow, SeriesColumnKey, SeriesSortKey>[] {
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
        <a
          href={`/admin/content/series/${row.id}`}
          className="flex min-w-0 items-center justify-start gap-3 text-right transition hover:text-[#F4D99A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          <SeriesIcon />
          <span className="min-w-0 truncate text-sm font-bold text-white">
            {row.name}
          </span>
        </a>
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
          onRowsUpdated={handlers.onRowsUpdated}
        />
      ),
    },
  ];
}
