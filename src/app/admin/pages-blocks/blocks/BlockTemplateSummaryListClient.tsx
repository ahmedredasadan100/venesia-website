"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import MediaSynchronizationWarningNotice from "../../../../components/admin/media/MediaSynchronizationWarningNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminDataGrid,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminDataGridStatusCell,
  AdminPageExperience,
  AdminPageHeader,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import { statusMeta } from "../../../../lib/page-blocks/admin-utils";

type BlockTemplateSummaryRow = {
  id: number;
  name: string;
  slug: string;
  detail: string;
  status: string;
};

type BlockTemplateSummaryListClientProps = {
  moduleKey: "media-hub" | "media-sidebar";
  title: string;
  description: string;
  detailLabel: string;
  rows: BlockTemplateSummaryRow[];
  errorMessage?: string | null;
  mediaSynchronizationWarning?: boolean;
};

const columns = `${ADMIN_DATA_GRID_COLUMNS.primaryStandard} ${ADMIN_DATA_GRID_COLUMNS.slug} 160px ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact}`;
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);

export default function BlockTemplateSummaryListClient({
  moduleKey,
  title,
  description,
  detailLabel,
  rows,
  errorMessage = null,
  mediaSynchronizationWarning = false,
}: BlockTemplateSummaryListClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const resolvedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((resolvedCurrentPage - 1) * pageSize, resolvedCurrentPage * pageSize),
    [pageSize, resolvedCurrentPage, rows],
  );
  const basePath = `/admin/pages-blocks/blocks/${moduleKey}`;

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title={title}
        description={description}
        meta={`${rows.length} بلوك`}
      />

      <AdminFeedbackRegion
        channel={`block-manager:${moduleKey}`}
        label={`نتائج قراءة ${title}`}
        feedback={
          errorMessage
            ? {
                variant: "danger",
                title: "تعذر تحميل مكتبة البلوكات",
                message: errorMessage,
                layout: "inline",
                dismissible: true,
                lifecycle: "persistent",
              }
            : null
        }
      />

      <MediaSynchronizationWarningNotice visible={mediaSynchronizationWarning} />

      <AdminDataGrid summary={rows.length ? `${rows.length} بلوك` : undefined}>
        <AdminDataGridHeader columns={columns}>
          <AdminDataGridPrimaryCell>الاسم</AdminDataGridPrimaryCell>
          <AdminDataGridCenterCell>Slug</AdminDataGridCenterCell>
          <AdminDataGridCenterCell>{detailLabel}</AdminDataGridCenterCell>
          <AdminDataGridCenterCell>الحالة</AdminDataGridCenterCell>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {paginatedRows.map((row) => {
          const status = statusMeta(row.status);
          const hidden = { access: "hidden" as const };
          const capability: AdminRowActionsCapability = {
            entityType: `${moduleKey}_block_template`,
            entityId: row.id,
            entityLabel: row.name,
            actions: {
              edit: { access: "allowed", href: `${basePath}/${row.id}` },
              preview: {
                access: "disabled",
                disabledReason: "المعاينة العامة تتطلب ربط القالب بصفحة عامة.",
              },
              information: {
                access: "allowed",
                title: `معلومات ${row.name}`,
                items: [
                  { label: "Slug", value: row.slug },
                  { label: detailLabel, value: row.detail },
                  { label: "الحالة", value: status.label },
                ],
              },
              copyPublicLink: hidden,
              visibility: hidden,
              featured: hidden,
              duplicate: hidden,
              archive: hidden,
              delete: hidden,
            },
          };

          return (
            <AdminDataGridRow key={row.id} columns={columns}>
              <AdminDataGridPrimaryCell>
                <Link
                  href={`${basePath}/${row.id}`}
                  className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                >
                  {row.name}
                </Link>
              </AdminDataGridPrimaryCell>
              <AdminDataGridCenterCell className="font-en truncate text-xs text-white/45">
                {row.slug}
              </AdminDataGridCenterCell>
              <AdminDataGridCenterCell className="truncate text-sm text-white/58">
                {row.detail}
              </AdminDataGridCenterCell>
              <AdminDataGridStatusCell>
                <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
              </AdminDataGridStatusCell>
              <AdminDataGridRowActions capability={capability} size="compact" />
            </AdminDataGridRow>
          );
        })}

        {!paginatedRows.length && !errorMessage ? (
          <AdminDataGridEmpty>لا توجد بلوكات بعد.</AdminDataGridEmpty>
        ) : null}
      </AdminDataGrid>

      <AdminTablePagination
        basePath={basePath}
        currentPage={resolvedCurrentPage}
        totalPages={totalPages}
        totalCount={rows.length}
        pageSize={String(pageSize)}
        onPageChange={setCurrentPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setCurrentPage(1);
        }}
      />
    </AdminPageExperience>
  );
}
