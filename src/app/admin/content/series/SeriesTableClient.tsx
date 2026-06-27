"use client";

import { useMemo } from "react";
import {
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
} from "../../../../components/admin/ui";
import { useAdminTable } from "../../../../components/admin/table-engine";
import AdminStatusPill from "../../../../components/admin/ui/AdminStatusPill";
import {
  bulkSeriesActionAjax,
  deleteSeriesAjax,
  duplicateSeriesAjax,
  getSeriesTableRows,
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

type SeriesSortKey = "name" | "topics_count" | "status";

const columns = "44px minmax(420px,1.7fr) 120px 140px 220px";

function statusMeta(status?: string | null) {
  if (status === "published") return { label: "منشور", tone: "green" as const };
  if (status === "unpublished") return { label: "مخفي", tone: "gold" as const };
  if (status === "archived") return { label: "أرشيف", tone: "muted" as const };
  return { label: "مسودة", tone: "muted" as const };
}

function SeriesIcon() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/16 bg-[#D8B87A]/8 text-[#D8B87A]">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6.5 5h11M6.5 12h11M6.5 19h11" strokeLinecap="round" />
        <path d="M3.8 5h.01M3.8 12h.01M3.8 19h.01" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function SeriesTableClient({ series }: { series: SeriesListRow[] }) {
  const sortAccessors = useMemo(() => ({
    name: (item: SeriesListRow) => item.name,
    topics_count: (item: SeriesListRow) => item.topics_count,
    status: (item: SeriesListRow) => statusMeta(item.status).label,
  }), []);

  const table = useAdminTable<SeriesListRow, SeriesSortKey>({
    initialRows: series,
    getRowId: (item) => item.id,
    sortAccessors,
    refresh: getSeriesTableRows,
  });

  function sortProps(key: SeriesSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <div className="space-y-4">
      {table.feedback ? (
        <div
          className={`rounded-[16px] border px-4 py-3 text-sm font-semibold ${
            table.feedback.type === "success"
              ? "border-emerald-400/18 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/18 bg-red-500/10 text-red-100"
          }`}
        >
          {table.feedback.message}
        </div>
      ) : null}

      <AdminBulkActionBar
        selectedIds={table.selection.selectedIds}
        entityLabel="سلسلة"
        options={[
          { value: "publish", label: "إظهار المحدد" },
          { value: "hide", label: "إخفاء المحدد" },
          { value: "delete", label: "حذف المحدد" },
        ]}
        onClearSelection={table.selection.clearSelection}
        onExecute={(action, ids) => table.runAction(() => bulkSeriesActionAjax(action, ids.map(Number)))}
        isBusy={table.isPending}
      />

      <AdminDataGrid>
        <AdminDataGridHeader columns={columns}>
          <div className="flex justify-center">
            <AdminDataGridCheckbox
              inputRef={table.selection.selectAllRef}
              checked={table.selection.allSelected}
              onChange={(event) => table.selection.toggleAll(event.currentTarget.checked)}
              label="تحديد الكل"
            />
          </div>
<div className="flex w-full justify-start">
  <AdminDataGridSortLabel {...sortProps("name")}>
    السلسلة
  </AdminDataGridSortLabel>
</div>


          <AdminDataGridSortLabel {...sortProps("topics_count")} className="mx-auto">الموضوعات</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("status")} className="mx-auto">الحالة</AdminDataGridSortLabel>
          <span className="text-center">الإجراءات</span>
        </AdminDataGridHeader>

        {table.rows.length ? table.rows.map((item) => {
          const status = statusMeta(item.status);
          const isHidden = item.status === "unpublished";
          return (
            <AdminDataGridRow key={item.id} columns={columns} className="border-b border-white/[0.045] last:border-b-0">
              <div className="flex justify-center">
                <AdminDataGridCheckbox
                  checked={table.selection.selectedSet.has(item.id)}
                  onChange={(event) => table.selection.toggleOne(item.id, event.currentTarget.checked)}
                  label={`تحديد ${item.name}`}
                />
              </div>

              <div className="flex min-w-0 items-center justify-start gap-3 text-right">
                <SeriesIcon />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{item.name}</p>
                </div>
              </div>

              <div className="text-center font-en text-sm font-semibold text-white/72">{item.topics_count}</div>
              <div className="flex justify-center"><AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill></div>

              <AdminDataGridActionsCell>
                <AdminDataGridActionButton action="edit" href={`/admin/content/series/${item.id}`} />
                <AdminDataGridActionButton
                  action="visibility"
                  title={isHidden ? "إظهار" : "إخفاء"}
                  hidden={isHidden}
                  disabled={table.isPending}
                  onClick={() => table.runAction(() => toggleSeriesStatusAjax(item.id, item.status))}
                />
                <AdminDataGridActionButton
                  action="duplicate"
                  disabled={table.isPending}
                  onClick={() => table.runAction(() => duplicateSeriesAjax(item.id))}
                />
                <AdminDataGridActionButton
                  action="delete"
                  disabled={table.isPending}
                  onClick={() => table.runAction(() => deleteSeriesAjax(item.id))}
                />
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        }) : (
          <AdminDataGridEmpty>
            <p className="text-base font-semibold text-white">لا توجد سلاسل حتى الآن</p>
            <p className="mt-2 text-sm text-white/45">ابدأ بإضافة أول سلسلة من زر إضافة سلسلة.</p>
          </AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </div>
  );
}
