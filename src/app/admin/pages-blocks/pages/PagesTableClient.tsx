"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  AdminPageContextHeader,
  AdminStatusPill,
  AdminTablePagination,
  buildAdminPaginationHref,
  useAdminGridSelection,
} from "../../../../components/admin/ui";
import AdminNotice from "../../../../components/admin/AdminNotice";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import { formatPageTypeLabel } from "../../../../lib/admin/pages/format-page-type-label";
import type { PagesListSort } from "../../../../lib/admin/pages/load-pages-table-rows";
import { getPageDeleteBlockReason } from "../../../../lib/pages/page-admin-policy";
import CreatePageModal from "./CreatePageModal";
import { bulkDeletePagesAjax, deletePage, duplicatePage, togglePageStatus } from "./actions";

export type AdminPageListRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
  block_count: number;
};

type PagesPaginationState = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  pageSize: string;
};

type PagesTableClientProps = {
  pages: AdminPageListRow[];
  pagination: PagesPaginationState;
  sort: PagesListSort;
  notice?: string | null;
  error?: string | null;
};

type SortableColumn = "title" | "status";

const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.count} 96px ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

const PAGES_LIST_BASE_PATH = "/admin/pages-blocks/pages";

const PAGE_DELETE_CONFIRM =
  "سيتم حذف الصفحة وروابط الموديلات الخاصة بها فقط.\nالموديلات والقوالب نفسها لن يتم حذفها.";

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

function getNextSort(current: PagesListSort, column: SortableColumn): PagesListSort | null {
  const asc = `${column}_asc` as PagesListSort;
  const desc = `${column}_desc` as PagesListSort;

  if (current === asc) return desc;
  if (current === desc) return null;
  return asc;
}

export default function PagesTableClient({
  pages,
  pagination,
  sort,
  notice,
  error,
}: PagesTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const rowIds = useMemo(() => pages.map((page) => page.id), [pages]);
  const selection = useAdminGridSelection(rowIds);

  useEffect(() => {
    selection.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when the server page slice changes
  }, [pages]);

  function buildListHref(patch: Record<string, string | null>) {
    return buildAdminPaginationHref(PAGES_LIST_BASE_PATH, new URLSearchParams(searchParams.toString()), patch);
  }

  function sortProps(column: SortableColumn) {
    const asc = `${column}_asc` as PagesListSort;
    const desc = `${column}_desc` as PagesListSort;
    const active = sort === asc || sort === desc;

    return {
      active,
      direction: sort === desc ? ("desc" as const) : ("asc" as const),
      onClick: () => {
        const nextSort = getNextSort(sort, column);
        router.push(
          buildListHref({
            sort: nextSort,
            page: "1",
          }),
        );
      },
    };
  }

  function handleBulkDelete(ids: number[]) {
    if (!window.confirm(PAGE_DELETE_CONFIRM)) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await bulkDeletePagesAjax(ids);
        if (!result.ok) {
          setFeedback({ type: "error", message: result.message ?? "تعذر تنفيذ العملية." });
          return;
        }

        selection.clearSelection();
        setFeedback({ type: "success", message: result.message ?? "تم تنفيذ العملية بنجاح." });
        router.refresh();
      } catch (caught) {
        setFeedback({
          type: "error",
          message: caught instanceof Error ? caught.message : "تعذر تنفيذ العملية.",
        });
      }
    });
  }

  return (
    <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
      <AdminPageContextHeader
        eyebrow="PAGES CONTROL"
        title="إدارة الصفحات"
        description="إدارة صفحات الموقع ومكوناتها، مع التحكم في الترتيب، الربط، وحالة النشر."
        actions={<CreatePageModal />}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {error ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={error} /> : null}

      <div className="space-y-4">
        {feedback ? (
          <div
            className={`rounded-[16px] border px-4 py-3 text-sm font-semibold ${
              feedback.type === "success"
                ? "border-emerald-400/18 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/18 bg-red-500/10 text-red-100"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <AdminBulkActionBar
          selectedIds={selection.selectedIds}
          entityLabel="صفحة"
          options={[{ value: "delete", label: "حذف المحدد" }]}
          onClearSelection={selection.clearSelection}
          onExecute={(action, ids) => {
            if (action !== "delete") return;
            handleBulkDelete(ids.map(Number));
          }}
          isBusy={isPending}
        />

        <AdminDataGrid>
          <AdminDataGridHeader columns={columns}>
            <AdminDataGridCheckboxCell>
              <AdminDataGridCheckbox
                inputRef={selection.selectAllRef}
                checked={selection.allSelected}
                onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
                label="تحديد الكل"
              />
            </AdminDataGridCheckboxCell>
            <AdminDataGridPrimaryCell>
              <AdminDataGridSortLabel {...sortProps("title")} className="justify-end">
                الصفحة
              </AdminDataGridSortLabel>
            </AdminDataGridPrimaryCell>
            <AdminDataGridCenterCell>الموديولات</AdminDataGridCenterCell>
            <AdminDataGridCenterCell>النوع</AdminDataGridCenterCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                الحالة
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {pages.map((page) => {
            const status = statusMeta(page.status);
            const deleteBlockReason = getPageDeleteBlockReason({ slug: page.slug, path: page.path });
            const isPublished = page.status === "published";
            const publicPath = resolvePublicPath(page);

            return (
              <AdminDataGridRow key={page.id} columns={columns}>
                <AdminDataGridCheckboxCell>
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(page.id)}
                    onChange={(event) => selection.toggleOne(page.id, event.currentTarget.checked)}
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
                <AdminDataGridCenterCell className="font-en text-sm tabular-nums text-white/60">
                  {page.block_count}
                </AdminDataGridCenterCell>
                <AdminDataGridCenterCell className="truncate text-sm text-white/55">
                  {formatPageTypeLabel(page.page_type)}
                </AdminDataGridCenterCell>
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
                    <form
                      action={deletePage}
                      className="contents"
                      onSubmit={(event) => {
                        if (!window.confirm(PAGE_DELETE_CONFIRM)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={page.id} />
                      <AdminDataGridActionButton
                        type="submit"
                        action="delete"
                        size="compact"
                        title="حذف الصفحة وروابط الموديلات الخاصة بها فقط"
                      />
                    </form>
                  )}
                </AdminDataGridActionsCell>
              </AdminDataGridRow>
            );
          })}

          {!pages.length ? <AdminDataGridEmpty>لا توجد صفحات بعد.</AdminDataGridEmpty> : null}
        </AdminDataGrid>

        <AdminTablePagination
          basePath={PAGES_LIST_BASE_PATH}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
          totalCount={pagination.totalCount}
          pageSize={pagination.pageSize}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          emptySummaryText="لا توجد صفحات"
        />
      </div>
    </div>
  );
}
