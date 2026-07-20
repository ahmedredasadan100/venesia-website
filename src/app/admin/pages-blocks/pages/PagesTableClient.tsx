"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS, ADMIN_DATA_GRID_COLUMNS, ADMIN_DATA_GRID_RULES,
  AdminBulkActionBar, AdminDataGrid, AdminDataGridActionButton, AdminDataGridActionsCell,
  AdminDataGridCenterCell, AdminDataGridCheckbox, AdminDataGridCheckboxCell, AdminDataGridEmpty,
  AdminDataGridHeader, AdminDataGridPrimaryCell, AdminDataGridRow, AdminDataGridSortLabel,
  AdminDataGridStatusCell, AdminPageContextHeader, AdminStatusPill, AdminTablePagination,
  useAdminGridSelection,
} from "../../../../components/admin/ui";
import AdminConfirmDialog from "../../../../components/admin/ui/AdminConfirmDialog";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import type { AdminEntityListQuery, AdminEntityListResult } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import { useAdminEntityInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import { pagesQueryContract, type PageFilters, type PageSortField } from "../../../../lib/admin/pages/entity-list-contract";
import { formatPageTypeLabel } from "../../../../lib/admin/pages/format-page-type-label";
import { getPageDeleteBlockReason } from "../../../../lib/pages/page-admin-policy";
import CreatePageModal from "./CreatePageModal";
import { deletePages, duplicatePage, togglePageStatus } from "./actions";

export type AdminPageListRow = { id: number; title: string; slug: string; path: string; page_type: string; status: string; block_count: number };
type ConfirmState = { ids: number[]; bulk: boolean } | null;
const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.count} 96px ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;
const PAGE_DELETE_CONFIRM = "سيتم حذف الصفحة وروابط الموديولات الخاصة بها فقط. الموديولات والقوالب نفسها لن يتم حذفها.";

function statusMeta(status: string) {
  if (status === "published") return { label: "منشورة", tone: "green" as const };
  if (status === "hidden") return { label: "مخفية", tone: "gold" as const };
  if (status === "archived") return { label: "أرشيف", tone: "muted" as const };
  return { label: "مسودة", tone: "muted" as const };
}
function publicPath(page: AdminPageListRow) { return page.path || (page.slug === "home" ? "/" : `/${page.slug}`); }
function PublicPreviewIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/></svg>; }

export default function PagesTableClient({ initialQuery, initialResult }: {
  initialQuery: AdminEntityListQuery<PageFilters, PageSortField>;
  initialResult: AdminEntityListResult<AdminPageListRow>;
}) {
  const controller = useAdminEntityListController({ entity: "pages", contract: pagesQueryContract, initialQuery, initialResult, staleTimeMs: 30_000 });
  const instant = useAdminEntityInstantMutation<AdminPageListRow>("pages", controller.query);
  const pages = controller.result.rows;
  const sort = `${controller.query.sort.field}_${controller.query.sort.direction}`;
  const selection = useAdminGridSelection(useMemo(() => pages.map((page) => page.id), [pages]));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const rangeStart = controller.result.pagination.totalRows ? (controller.result.pagination.page - 1) * controller.result.pagination.pageSize + 1 : 0;
  const rangeEnd = controller.result.pagination.totalRows ? Math.min(controller.result.pagination.page * controller.result.pagination.pageSize, controller.result.pagination.totalRows) : 0;

  function sortProps(column: "title" | "status") {
    const asc = `${column}_asc`, desc = `${column}_desc`;
    return { active: sort === asc || sort === desc, direction: sort === desc ? "desc" as const : "asc" as const,
      onClick: () => controller.setSort(sort === asc ? { field: column, direction: "desc" } : sort === desc ? { field: "id", direction: "asc" } : { field: column, direction: "asc" }) };
  }
  async function confirmDelete() {
    if (!confirm) return;
    const valid = confirm.ids.filter((id) => { const page = pages.find((row) => row.id === id); return page && !getPageDeleteBlockReason({ slug: page.slug, path: page.path }); });
    try {
      const result = await instant.mutateAsync({ rowId: confirm.bulk ? undefined : valid[0], action: "delete", bulk: confirm.bulk,
        optimistic: (cache) => cache.removeRows(new Set(valid)), execute: () => deletePages(confirm.ids) });
      selection.clearSelection(); setConfirm(null); setFeedback({ type: "success", message: result.message });
    } catch (error) { setConfirm(null); setFeedback({ type: "error", message: error instanceof Error ? error.message : "تعذر تنفيذ العملية." }); }
  }
  async function toggle(page: AdminPageListRow) {
    const nextStatus = page.status === "published" ? "hidden" : "published";
    try {
      const result = await instant.mutateAsync({ rowId: page.id, action: "status", optimistic: (cache) => cache.patchRows((row) => row.id === page.id ? { ...row, status: nextStatus } : row), execute: () => togglePageStatus(page.id) });
      setFeedback({ type: "success", message: result.message });
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "تعذر تحديث الحالة." }); }
  }

  return <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
    <AdminPageContextHeader eyebrow="PAGES CONTROL" title="إدارة الصفحات" description="إدارة صفحات الموقع ومكوناتها، مع التحكم في الترتيب، الربط، وحالة النشر." actions={<CreatePageModal/>}/>
    {feedback ? <AdminNotice variant={feedback.type === "success" ? "success" : "danger"} message={feedback.message} /> : null}
    <div className="space-y-4" data-admin-entity-list-consumer="pages" data-admin-entity-list-pending={controller.isFetching ? "true" : "false"}>
      <AdminBulkActionBar selectedIds={selection.selectedIds} entityLabel="صفحة" options={[{ value: "delete", label: "حذف المحدد" }]} onClearSelection={selection.clearSelection} onExecute={(action, ids) => { if (action === "delete") setConfirm({ ids: ids.map(Number), bulk: true }); }} isBusy={instant.bulkPending !== null}/>
      <AdminDataGrid><AdminDataGridHeader columns={columns}>
        <AdminDataGridCheckboxCell><AdminDataGridCheckbox inputRef={selection.selectAllRef} checked={selection.allSelected} onChange={(event) => selection.toggleAll(event.currentTarget.checked)} label="تحديد الكل"/></AdminDataGridCheckboxCell>
        <AdminDataGridPrimaryCell><AdminDataGridSortLabel {...sortProps("title")} className="justify-end">الصفحة</AdminDataGridSortLabel></AdminDataGridPrimaryCell>
        <AdminDataGridCenterCell>الموديولات</AdminDataGridCenterCell><AdminDataGridCenterCell>النوع</AdminDataGridCenterCell>
        <AdminDataGridCenterCell><AdminDataGridSortLabel {...sortProps("status")} className="justify-center">الحالة</AdminDataGridSortLabel></AdminDataGridCenterCell><div className="text-center">الإجراءات</div>
      </AdminDataGridHeader>
      {pages.map((page) => { const status = statusMeta(page.status); const blocked = getPageDeleteBlockReason({ slug: page.slug, path: page.path }); const pending = instant.rowPending?.rowId === page.id; return <AdminDataGridRow key={page.id} columns={columns} aria-busy={pending || undefined}>
        <AdminDataGridCheckboxCell><AdminDataGridCheckbox checked={selection.selectedSet.has(page.id)} onChange={(event) => selection.toggleOne(page.id, event.currentTarget.checked)} label={`تحديد ${page.title}`}/></AdminDataGridCheckboxCell>
        <AdminDataGridPrimaryCell><Link href={`/admin/pages-blocks/pages/${page.id}`} className="block truncate font-semibold text-white hover:text-[#D8B87A]">{page.title}</Link></AdminDataGridPrimaryCell>
        <AdminDataGridCenterCell className="font-en text-sm tabular-nums text-white/60">{page.block_count}</AdminDataGridCenterCell><AdminDataGridCenterCell className="truncate text-sm text-white/55">{formatPageTypeLabel(page.page_type)}</AdminDataGridCenterCell>
        <AdminDataGridStatusCell><AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill></AdminDataGridStatusCell>
        <AdminDataGridActionsCell compact><AdminDataGridActionButton action="edit" href={`/admin/pages-blocks/pages/${page.id}`} title="إدارة الموديولات" size="compact"/><AdminDataGridActionButton href={publicPath(page)} target="_blank" tone="dark" title="معاينة الصفحة العامة" size="compact"><PublicPreviewIcon/></AdminDataGridActionButton>
          <AdminDataGridActionButton type="button" action="visibility" size="compact" disabled={pending} isCurrentlyHidden={page.status !== "published"} title="تغيير حالة الصفحة" onClick={() => toggle(page)}/>
          <form action={duplicatePage} className="contents"><input type="hidden" name="id" value={page.id}/><AdminDataGridActionButton type="submit" action="duplicate" size="compact" title="نسخ الصفحة مع الموديولات"/></form>
          <AdminDataGridActionButton type="button" action="delete" size="compact" disabled={Boolean(blocked) || pending} title={blocked ?? "حذف الصفحة وروابط الموديولات"} onClick={() => setConfirm({ ids: [page.id], bulk: false })}/>
        </AdminDataGridActionsCell></AdminDataGridRow>; })}
      {!pages.length ? <AdminDataGridEmpty>لا توجد صفحات بعد.</AdminDataGridEmpty> : null}</AdminDataGrid>
      <AdminTablePagination basePath="/admin/pages-blocks/pages" rangeStart={rangeStart} rangeEnd={rangeEnd} totalCount={controller.result.pagination.totalRows} pageSize={String(controller.result.pagination.pageSize)} pageSizeOptions={["10","20","30"]} currentPage={controller.result.pagination.page} totalPages={controller.result.pagination.totalPages} emptySummaryText="لا توجد صفحات" onPageChange={controller.setPage} onPageSizeChange={controller.setPageSize}/>
    </div>
    <AdminConfirmDialog open={confirm !== null} title={confirm?.bulk ? "حذف الصفحات المحددة؟" : "حذف الصفحة؟"} description={PAGE_DELETE_CONFIRM} confirmLabel="تأكيد الحذف" pending={instant.bulkPending !== null || instant.rowPending?.action === "delete"} onCancel={() => setConfirm(null)} onConfirm={confirmDelete}/>
  </div>;
}
