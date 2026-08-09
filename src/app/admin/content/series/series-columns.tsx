"use client";

import Link from "next/link";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import {
  AdminDataGridRowActions,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import {
  ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH,
  ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
} from "../../../../components/admin/ui/AdminDataGrid";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import type { SeriesListRow } from "../../../../lib/admin/content/load-series-list";
import { buildAdminSeriesCollectionPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import { resolveAdminEntityPreviewActions } from "../../../../lib/admin/interaction-system/entity-preview-capability";

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

export {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH as SERIES_ACTIONS_COLUMN_WIDTH,
} from "../../../../components/admin/ui/AdminDataGrid";

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
  display = "menu",
}: {
  row: SeriesListRow;
  onMutationResult?: (result: AdminActionResult) => void;
  handlers: SeriesRowActionHandlers;
  display?: "menu" | "visibility";
}) {
  const pendingAction = handlers.rowPendingAction(row.id);
  const isTrashView = handlers.view === "trash";
  const isHidden = row.status !== "published";
  const previewCapability = buildAdminSeriesCollectionPreviewCapability({
    id: row.id,
  });
  const preview = resolveAdminEntityPreviewActions(previewCapability)[0];

  async function run(action: () => Promise<AdminActionResult>) {
    try {
      const result = await action();
      onMutationResult?.(result);
      return result;
    } catch {
      const result: AdminActionResult = {
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        entityId: row.id,
      };
      onMutationResult?.(result);
      return result;
    }
  }

  const pendingReason = "انتظر انتهاء الإجراء الحالي.";
  const capability: AdminRowActionsCapability = {
    entityType: "series",
    entityId: row.id,
    entityLabel: row.name,
    actions: {
      edit: isTrashView
        ? { access: "hidden" }
        : {
            access: "allowed",
            href: `/admin/content/series/${row.id}`,
          },
      preview: isTrashView
        ? { access: "hidden" }
        : preview
        ? preview.disabled
          ? {
              access: "disabled",
              disabledReason: "المعاينة غير متاحة لهذه السلسلة.",
            }
          : {
              access: "allowed",
              href: preview.href,
              target: "_blank",
              rel: "noopener noreferrer",
            }
        : { access: "hidden" },
      information: {
        access: "allowed",
        title: `معلومات السلسلة: ${row.name}`,
        items: [
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
          ...(isTrashView
            ? [
                {
                  label: "تاريخ الحذف",
                  value: row.deleted_at
                    ? formatAdminDateTime(row.deleted_at)
                    : "—",
                },
              ]
            : []),
          {
            label: "التصنيف",
            value: row.category_name?.trim() || "—",
          },
          { label: "الموضوعات", value: String(row.topics_count) },
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility: isTrashView
        ? display === "visibility"
          ? {
              access: "disabled",
              disabledReason: "عرض فقط داخل المحذوفات.",
              isVisible: !isHidden,
            }
          : { access: "hidden" }
        : pendingAction === "visibility"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isVisible: !isHidden,
            }
          : handlers.mutationBusy
            ? {
                access: "disabled",
                disabledReason: pendingReason,
                isVisible: !isHidden,
              }
            : {
                access: "allowed",
                isVisible: !isHidden,
                onSelect: async () => {
                  await run(() => handlers.onToggle(row));
                },
              },
      featured: { access: "hidden" },
      duplicate: isTrashView
        ? { access: "hidden" }
        : pendingAction === "duplicate"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : handlers.mutationBusy
            ? { access: "disabled", disabledReason: pendingReason }
            : {
                access: "allowed",
                onSelect: async () => {
                  await run(() => handlers.onDuplicate(row));
                },
              },
      archive: !isTrashView
        ? { access: "hidden" }
        : pendingAction === "restore"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isArchived: true,
              label: "استعادة",
            }
          : handlers.mutationBusy
            ? {
                access: "disabled",
                disabledReason: pendingReason,
                isArchived: true,
                label: "استعادة",
              }
            : {
                access: "allowed",
                isArchived: true,
                label: "استعادة",
                confirmation: {
                  mode: "shared",
                  title: "استعادة السلسلة؟",
                  description:
                    "ستعود السلسلة إلى القائمة النشطة كغير منشورة بعد التحقق من الـSlug والتصنيف المرتبط.",
                  confirmLabel: "استعادة",
                },
                onSelect: async () => {
                  const result = await run(() => handlers.onRestore(row));
                  if (!result.ok) throw new Error(result.message);
                },
              },
      delete:
        pendingAction === (isTrashView ? "permanent_delete" : "delete")
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات",
            }
          : handlers.mutationBusy
            ? {
                access: "disabled",
                disabledReason: pendingReason,
                label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات",
              }
            : {
                access: "allowed",
                label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات",
                confirmation: isTrashView
                  ? {
                      mode: "shared",
                      title: "حذف السلسلة نهائيًا؟",
                      description:
                        "ستُحذف السلسلة نهائيًا ويصبح الـSlug متاحًا. أي Topic مرتبط سيمنع العملية، ولا يمكن التراجع عنها.",
                      confirmLabel: "حذف نهائي",
                    }
                  : {
                      mode: "shared",
                      title: "نقل السلسلة إلى المحذوفات؟",
                      description:
                        "ستختفي السلسلة من القوائم والاختيارات النشطة ويمكن استعادتها لاحقًا. أي Topic مرتبط سيمنع العملية وسيبقى الـSlug محجوزًا.",
                      confirmLabel: "نقل إلى المحذوفات",
                    },
                onSelect: async () => {
                  const result = await run(() =>
                    isTrashView
                      ? handlers.onPermanentDelete(row)
                      : handlers.onDelete(row),
                  );
                  if (!result.ok) throw new Error(result.message);
                },
              },
    },
  };

  return (
    <AdminDataGridRowActions
      capability={capability}
      display={display}
      size="compact"
    />
  );
}

export type SeriesRowActionHandlers = {
  view: "active" | "trash";
  rowPendingAction: (id: number) => string | null;
  mutationBusy: boolean;
  onToggle: (row: SeriesListRow) => Promise<AdminActionResult>;
  onDuplicate: (row: SeriesListRow) => Promise<AdminActionResult>;
  onDelete: (row: SeriesListRow) => Promise<AdminActionResult>;
  onRestore: (row: SeriesListRow) => Promise<AdminActionResult>;
  onPermanentDelete: (row: SeriesListRow) => Promise<AdminActionResult>;
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
      minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon,
      width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon,
      flexible: true,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => {
        const content = (
          <>
          <SeriesIcon />
          <span
            className="min-w-0 truncate text-sm font-bold text-white"
            style={{
              maxWidth:
                ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textBudgetPx,
            }}
          >
            {row.name}
          </span>
          </>
        );
        return handlers.view === "trash" ? (
          <span className="flex min-w-0 items-center justify-start gap-3 text-right">
            {content}
          </span>
        ) : (
          <Link
            href={`/admin/content/series/${row.id}`}
            className="flex min-w-0 cursor-pointer items-center justify-start gap-3 text-right transition hover:text-[#F4D99A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
          >
            {content}
          </Link>
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
      renderCell: ({ row, onMutationResult }) => (
        <SeriesRowActions
          row={row}
          onMutationResult={onMutationResult}
          handlers={handlers}
          display="visibility"
        />
      ),
    },
    {
      key: "category",
      label: "التصنيف",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "category",
      minWidth: ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH,
      renderCell: ({ row }) =>
        singleLine(row.category_name?.trim() ? row.category_name : "—"),
    },
    {
      key: "topics_count",
      label: "الموضوعات",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "topics_count",
      minWidth: ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH,
      renderCell: ({ row }) => (
        <span className="font-en text-sm font-semibold tabular-nums text-white/72">
          {row.topics_count}
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
      key: "slug",
      label: "الرابط",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "slug",
      minWidth: 140,
      width: 160,
      renderCell: ({ row }) => singleLine(row.slug || "—"),
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
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "created_at",
      minWidth: ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH,
      renderCell: ({ row }) => (
        <span
          dir="ltr"
          className="block whitespace-nowrap font-en text-sm tabular-nums text-white/68"
        >
          {row.created_at ? formatAdminDateTime(row.created_at) : "—"}
        </span>
      ),
    },
    {
      key: "updated_at",
      label: "آخر تعديل",
      defaultVisible: false,
      hideable: true,
      sortable: true,
      sortKey: "updated_at",
      minWidth: ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH,
      renderCell: ({ row }) => (
        <span
          dir="ltr"
          className="block whitespace-nowrap font-en text-sm tabular-nums text-white/68"
        >
          {row.updated_at ? formatAdminDateTime(row.updated_at) : "—"}
        </span>
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
        <SeriesRowActions
          row={row}
          onMutationResult={onMutationResult}
          handlers={handlers}
        />
      ),
    },
  ];
}
