"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ADMIN_DATA_GRID_RULES,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActions,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import AdminNotice from "../../../../components/admin/AdminNotice";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import { useAdminTable } from "../../../../components/admin/table-engine";
import { getPageDeleteBlockReason } from "../../../../lib/pages/page-admin-policy";
import { deletePage, duplicatePage, togglePageStatus } from "./actions";

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

type PageSortKey = "title" | "slug" | "path" | "block_count" | "status";

const columns = `minmax(220px,1.4fr) minmax(140px,0.8fr) minmax(140px,0.8fr) 100px 100px 110px ${ADMIN_LIST_PAGE.actionsColumnWidth}`;

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
      slug: (item: AdminPageListRow) => item.slug,
      path: (item: AdminPageListRow) => item.path,
      block_count: (item: AdminPageListRow) => item.block_count,
      status: (item: AdminPageListRow) => statusMeta(item.status).label,
    }),
    [],
  );

  const table = useAdminTable<AdminPageListRow, PageSortKey>({
    initialRows: pages,
    getRowId: (item) => item.id,
    sortAccessors,
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

      <AdminDataGrid summary={`${table.rows.length} صفحة`}>
        <AdminDataGridHeader columns={columns}>
          <AdminDataGridSortLabel {...sortProps("title")}>الصفحة</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("slug")}>Slug</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("path")}>Path</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("block_count")} className="mx-auto">
            الموديولات
          </AdminDataGridSortLabel>
          <div>النوع</div>
          <AdminDataGridSortLabel {...sortProps("status")} className="mx-auto">
            الحالة
          </AdminDataGridSortLabel>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {table.rows.map((page) => {
          const status = statusMeta(page.status);
          const deleteBlockReason = getPageDeleteBlockReason(page.slug);
          const isPublished = page.status === "published";
          const publicPath = resolvePublicPath(page);

          return (
            <AdminDataGridRow key={page.id} columns={columns}>
              <div>
                <Link
                  href={`/admin/pages-blocks/pages/${page.id}`}
                  className="font-semibold text-white hover:text-[#D8B87A]"
                >
                  {page.title}
                </Link>
              </div>
              <div className="font-mono text-xs text-white/42">{page.slug}</div>
              <div className="font-mono text-xs text-white/42">{page.path}</div>
              <div className="text-center text-white/60">{page.block_count}</div>
              <div className="text-white/55">{page.page_type}</div>
              <div className="flex justify-center">
                <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
              </div>
              <AdminDataGridActions>
                <AdminDataGridActionButton
                  action="edit"
                  href={`/admin/pages-blocks/pages/${page.id}`}
                  title="إدارة الموديولات"
                />

                <AdminDataGridActionButton
                  href={publicPath}
                  target="_blank"
                  tone="dark"
                  title="معاينة الصفحة العامة"
                >
                  <PublicPreviewIcon />
                </AdminDataGridActionButton>

                <form action={togglePageStatus} className="inline-flex shrink-0">
                  <input type="hidden" name="id" value={page.id} />
                  <AdminDataGridActionButton
                    type="submit"
                    action="visibility"
                    hidden={isPublished}
                    title={isPublished ? "إخفاء الصفحة" : "نشر / إظهار الصفحة"}
                  />
                </form>

                <form action={duplicatePage} className="inline-flex shrink-0">
                  <input type="hidden" name="id" value={page.id} />
                  <AdminDataGridActionButton
                    type="submit"
                    action="duplicate"
                    title="نسخ الصفحة مع الموديولات (مسودة مخفية)"
                  />
                </form>

                {deleteBlockReason ? (
                  <AdminDataGridActionButton
                    action="delete"
                    disabled
                    title={deleteBlockReason}
                  />
                ) : (
                  <form action={deletePage} className="inline-flex shrink-0">
                    <input type="hidden" name="id" value={page.id} />
                    <AdminDataGridActionButton
                      type="submit"
                      action="delete"
                      title="حذف الصفحة وجميع ربط الموديولات"
                    />
                  </form>
                )}
              </AdminDataGridActions>
            </AdminDataGridRow>
          );
        })}

        {!table.rows.length ? <AdminDataGridEmpty>لا توجد صفحات بعد.</AdminDataGridEmpty> : null}
      </AdminDataGrid>
    </div>
  );
}
