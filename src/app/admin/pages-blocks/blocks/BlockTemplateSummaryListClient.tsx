"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminEntityListFilters from "../../../../components/admin/entity-list/AdminEntityListFilters";
import MediaSynchronizationWarningNotice from "../../../../components/admin/media/MediaSynchronizationWarningNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminColumnVisibilityMenu,
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
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
} from "../../../../lib/admin/entity-list";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
  type PageCompositionColumnPreferenceId,
} from "../../../../lib/page-blocks/admin-collection-columns";
import { statusMeta } from "../../../../lib/page-blocks/admin-utils";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../column-preferences";

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
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);
const COLUMN_PREFERENCE_ID_BY_MODULE = {
  "media-hub": "mediaHubTemplates",
  "media-sidebar": "mediaSidebarTemplates",
} as const satisfies Record<
  BlockTemplateSummaryListClientProps["moduleKey"],
  PageCompositionColumnPreferenceId
>;

export default function BlockTemplateSummaryListClient({
  moduleKey,
  title,
  description,
  detailLabel,
  rows,
  errorMessage = null,
  mediaSynchronizationWarning = false,
  initialVisibleColumns = null,
  preferenceError = null,
}: BlockTemplateSummaryListClientProps) {
  const searchParams = useSearchParams();
  const columnPreferenceId = COLUMN_PREFERENCE_ID_BY_MODULE[moduleKey];
  const columnConfig = getPageCompositionColumnPreferenceConfig(columnPreferenceId);
  const defaultColumns = getPageCompositionDefaultColumnKeys(columnPreferenceId);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys(
      columnPreferenceId,
      initialVisibleColumns,
    ),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const columns = useMemo(
    () =>
      [
        ADMIN_DATA_GRID_COLUMNS.primaryStandard,
        visibleColumnSet.has("slug") ? ADMIN_DATA_GRID_COLUMNS.slug : null,
        visibleColumnSet.has("detail") ? "160px" : null,
        visibleColumnSet.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusStandard : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );
  const search = searchParams.get("q") ?? "";
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        adminCollectionSearchIncludes(
          `${row.name} ${row.slug} ${row.detail} ${row.status}`,
          search,
        ),
      ),
    [rows, search],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredRows,
    datasetKey: `${moduleKey}|${search}|${filteredRows.map((row) => row.id).sort().join("|")}`,
    defaultPageSize: PAGE_SIZE,
  });
  const paginatedRows = pagination.rows;
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

      <AdminFeedbackRegion
        channel={`block-manager:${moduleKey}:columns`}
        label={`حالة تفضيلات أعمدة ${title}`}
        feedback={
          preferenceError
            ? {
                variant: "warning",
                title: "تعذر تحميل تفضيلات الأعمدة",
                message: preferenceError,
                layout: "inline",
                dismissible: true,
                lifecycle: "persistent",
              }
            : null
        }
      />

      <MediaSynchronizationWarningNotice visible={mediaSynchronizationWarning} />

      <AdminEntityListFilters
        basePath={basePath}
        search={{
          value: search,
          placeholder: "ابحث باسم القالب أو الـslug أو التفاصيل…",
          minLength: 1,
        }}
        filters={[]}
        values={{}}
        columnsControl={
          <AdminColumnVisibilityMenu
            columns={columnConfig.columns}
            visibleColumns={visibleColumns}
            defaultColumns={defaultColumns}
            onChange={setVisibleColumns}
            onPersist={(next) =>
              savePageCompositionColumnPreferences(columnPreferenceId, next)
            }
            onRestore={() =>
              restorePageCompositionColumnPreferences(columnPreferenceId)
            }
          />
        }
        onQueryPatch={(patch, behavior = "push") => {
          const next = applyAdminEntityUrlPatch(
            new URLSearchParams(window.location.search),
            patch,
          );
          const query = next.toString();
          window.history[
            behavior === "replace" ? "replaceState" : "pushState"
          ](
            window.history.state,
            "",
            `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
          );
        }}
      />

      <AdminDataGrid className="!rounded-t-none !border-t-0" summary={filteredRows.length ? `${filteredRows.length} بلوك` : undefined}>
        <AdminDataGridHeader columns={columns}>
          <AdminDataGridPrimaryCell>الاسم</AdminDataGridPrimaryCell>
          {visibleColumnSet.has("slug") ? (
            <AdminDataGridCenterCell>Slug</AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("detail") ? (
            <AdminDataGridCenterCell>{detailLabel}</AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("status") ? (
            <AdminDataGridCenterCell>الحالة</AdminDataGridCenterCell>
          ) : null}
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
              {visibleColumnSet.has("slug") ? (
                <AdminDataGridCenterCell className="font-en truncate text-xs text-white/45">
                  {row.slug}
                </AdminDataGridCenterCell>
              ) : null}
              {visibleColumnSet.has("detail") ? (
                <AdminDataGridCenterCell className="truncate text-sm text-white/58">
                  {row.detail}
                </AdminDataGridCenterCell>
              ) : null}
              {visibleColumnSet.has("status") ? (
                <AdminDataGridStatusCell>
                  <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
                </AdminDataGridStatusCell>
              ) : null}
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
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={String(pagination.pageSize)}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </AdminPageExperience>
  );
}
