"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_DATA_GRID_RULES,
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridSortLabel,
  AdminDataGridStatusCell,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import AdminNotice from "../../../../components/admin/AdminNotice";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import { useAdminTable } from "../../../../components/admin/table-engine";
import { getPageDeleteBlockReason } from "../../../../lib/pages/page-admin-policy";
import { bulkDeletePagesAjax, deletePage, duplicatePage, getPagesTableRows, togglePageStatus } from "./actions";

export type AdminPageListRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
  block_count: number;
};

type PagesTableClientProps = {
  pages: AdminPageListRow[];
  notice?: string | null;
  error?: string | null;
};

type PageSortKey = "title" | "block_count" | "status";

/**
 * RTL table: الصفحة (1fr, يمين) → … → الإجراءات (ثابت، شمال).
 * الـ 1fr يملأ المساحة المتبقية فلا يبقى فراغ بعد عمود الإجراءات.
 */
// 96px (4th) = secondary page-type column (no dedicated preset).
const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.count} 96px ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

function statusMeta(status: string) {
  if (status === "published") return { label: "منشورة", tone: "green" as const };
  if (status === "hidden") return { label: "مخفية", tone: "gold" as const };
  if (status === "archived") return { label: "أرشيف", tone: "muted" as const };
  return { label: "مسودة", tone: "muted" as const };
}

function resolvePublicPath(page: AdminPageListRow) {
  if (page.path) return page.path;
  if (page.slug === "home") return "/";
  return `/${page.slug}`;
}

function PublicPreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={ADMIN_DATA_GRID_RULES.actionIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export default function PagesTableClient({ pages, notice, error }: PagesTableClientProps) {
  const sortAccessors = useMemo(
    () => ({
      title: (item: AdminPageListRow) => item.title,
      block_count: (item: AdminPageListRow) => item.block_count,
      status: (item: AdminPageListRow) => statusMeta(item.status).label,
    }),
    [],
  );

  const table = useAdminTable<AdminPageListRow, PageSortKey>({
    initialRows: pages,
    getRowId: (item) => item.id,
    sortAccessors,
    refresh: getPagesTableRows,
  });

  function sortProps(key: PageSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title="إدارة الصفحات"
        description="كل صفحة حاوية للموديولات المعيّنة: Hero، Content، CTA، Cards، وغيرها. افتح الصفحة لرؤية الترتيب والحالة والربط."
        meta={`${pages.length} صفحة`}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {error ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={error} /> : null}

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
          entityLabel="صفحة"
          options={[{ value: "delete", label: "حذف المحدد" }]}
          onClearSelection={table.selection.clearSelection}
          onExecute={(action, ids) => {
            if (action !== "delete") return;
            if (!window.confirm(`حذف ${ids.length} صفحة؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
            table.runAction(() => bulkDeletePagesAjax(ids.map(Number)));
          }}
          isBusy={table.isPending}
        />

        <AdminDataGrid summary={`${table.rows.length} صفحة`}>
        <AdminDataGridHeader columns={columns}>
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              inputRef={table.selection.selectAllRef}
              checked={table.selection.allSelected}
              onChange={(event) => table.selection.toggleAll(event.currentTarget.checked)}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
          <AdminDataGridPrimaryCell>
            <AdminDataGridSortLabel {...sortProps("title")} className="justify-end">
              الصفحة
            </AdminDataGridSortLabel>
          </AdminDataGridPrimaryCell>
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("block_count")} className="justify-center">
              الموديولات
            </AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
          <AdminDataGridCenterCell>النوع</AdminDataGridCenterCell>
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
              الحالة
            </AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {table.rows.map((page) => {
          const status = statusMeta(page.status);
          const deleteBlockReason = getPageDeleteBlockReason(page.slug);
          const isPublished = page.status === "published";
          const publicPath = resolvePublicPath(page);

          return (
            <AdminDataGridRow key={page.id} columns={columns}>
              <AdminDataGridCheckboxCell>
                <AdminDataGridCheckbox
                  checked={table.selection.selectedSet.has(page.id)}
                  onChange={(event) => table.selection.toggleOne(page.id, event.currentTarget.checked)}
                  label={`تحديد ${page.title}`}
                />
              </AdminDataGridCheckboxCell>
              <AdminDataGridPrimaryCell>
                <Link
                  href={`/admin/pages-blocks/pages/${page.id}`}
                  className="block truncate font-semibold text-white hover:text-[#D8B87A]"
                >
                  {page.title}
                </Link>
              </AdminDataGridPrimaryCell>
              <AdminDataGridCenterCell className="font-en text-sm tabular-nums text-white/60">{page.block_count}</AdminDataGridCenterCell>
              <AdminDataGridCenterCell className="truncate text-sm text-white/55">{page.page_type}</AdminDataGridCenterCell>
              <AdminDataGridStatusCell>
                <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
              </AdminDataGridStatusCell>
              <AdminDataGridActionsCell compact>
                <AdminDataGridActionButton
                  action="edit"
                  href={`/admin/pages-blocks/pages/${page.id}`}
                  title="إدارة الموديولات"
                  size="compact"
                />

                <AdminDataGridActionButton
                  href={publicPath}
                  target="_blank"
                  tone="dark"
                  title="معاينة الصفحة العامة"
                  size="compact"
                >
                  <PublicPreviewIcon />
                </AdminDataGridActionButton>

                <form action={togglePageStatus} className="contents">
                  <input type="hidden" name="id" value={page.id} />
                  <AdminDataGridActionButton
                    type="submit"
                    action="visibility"
                    size="compact"
                    hidden={isPublished}
                    title={isPublished ? "إخفاء الصفحة" : "نشر / إظهار الصفحة"}
                  />
                </form>

                <form action={duplicatePage} className="contents">
                  <input type="hidden" name="id" value={page.id} />
                  <AdminDataGridActionButton
                    type="submit"
                    action="duplicate"
                    size="compact"
                    title="نسخ الصفحة مع الموديولات (مسودة مخفية)"
                  />
                </form>

                {deleteBlockReason ? (
                  <AdminDataGridActionButton
                    action="delete"
                    size="compact"
                    disabled
                    title={deleteBlockReason}
                  />
                ) : (
                  <form action={deletePage} className="contents">
                    <input type="hidden" name="id" value={page.id} />
                    <AdminDataGridActionButton
                      type="submit"
                      action="delete"
                      size="compact"
                      title="حذف الصفحة وجميع ربط الموديولات"
                    />
                  </form>
                )}
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        })}

        {!table.rows.length ? <AdminDataGridEmpty>لا توجد صفحات بعد.</AdminDataGridEmpty> : null}
        </AdminDataGrid>
      </div>
    </div>
  );
}
