"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  AdminEntityList,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../../../components/admin/entity-list";
import MediaNoImage from "../../../../components/admin/media/MediaNoImage";
import {
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  AdminDataGridRowActions,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import { adminActionFailure } from "../../../../lib/admin/admin-action-result";
import {
  adminContentTopicPath,
} from "../../../../lib/admin/content-routes";
import {
  CONTENT_STATUS_METADATA,
  CONTENT_STATUS_VALUES,
} from "../../../../lib/admin/content/content-status-metadata";
import {
  CONTENT_TYPE_OPTIONS,
  getContentTypeLabel,
} from "../../../../lib/admin/content/content-types";
import { buildAdminContentPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import type {
  AdminEntityColumnDef,
  AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { resolveAdminEntityPreviewActions } from "../../../../lib/admin/interaction-system/entity-preview-capability";
import type { TopicWithoutImageRow } from "../../../../lib/admin/media-catalog/reports";
import {
  topicsWithoutImageQueryContract,
  type TopicsWithoutImageFilters,
  type TopicsWithoutImageSortField,
} from "../../../../lib/admin/media-catalog/topics-without-image-entity-list-contract";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import { TOPICS_WITHOUT_IMAGE_DEFAULT_COLUMN_KEYS } from "../../../../lib/admin/media-catalog/topics-without-image-list-config";

import { saveTopicsWithoutImageColumnPreferences } from "./column-preferences";

type ReportColumnKey =
  | "topic"
  | "content_type"
  | "status"
  | "category"
  | "updated_at"
  | "actions";

const PAGE_SIZE_OPTIONS =
  topicsWithoutImageQueryContract.pageSizeOptions.map(String);

const REPORT_FILTERS: readonly AdminEntityFilterDef[] = [
  {
    id: "topics-without-image-status",
    paramKey: "status",
    label: "الحالة",
    placeholder: "الحالة",
    type: "status",
    options: CONTENT_STATUS_VALUES.map((status) => ({
      value: status,
      label: CONTENT_STATUS_METADATA[status].label,
    })),
    className: "min-w-[150px] flex-1 lg:flex-none",
  },
  {
    id: "topics-without-image-content-type",
    paramKey: "type",
    label: "نوع المحتوى",
    placeholder: "نوع المحتوى",
    type: "single_select",
    options: CONTENT_TYPE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    className: "min-w-[160px] flex-1 lg:flex-none",
  },
];

function buildTopicWithoutImageRowActions(
  topic: TopicWithoutImageRow,
): AdminRowActionsCapability {
  const preview = resolveAdminEntityPreviewActions(
    buildAdminContentPreviewCapability({
      entityType: "topic",
      id: topic.id,
      contentType: topic.contentType,
      slug: topic.slug,
      publicationStatus: topic.status,
      allowedActions: ["internal-preview"],
    }),
  )[0];

  return {
    entityType: "topic",
    entityId: topic.id,
    entityLabel: topic.title || topic.slug,
    actions: {
      edit: {
        access: "allowed",
        href: adminContentTopicPath(topic.id),
      },
      preview: preview
        ? preview.disabled
          ? {
              access: "disabled",
              disabledReason: "المعاينة غير متاحة لهذا الموضوع.",
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
        title: "معلومات الموضوع",
        items: [
          { label: "العنوان", value: topic.title || "بدون عنوان" },
          { label: "المسار", value: `/${topic.slug}` },
          {
            label: "نوع المحتوى",
            value: getContentTypeLabel(topic.contentType),
          },
          {
            label: "الحالة",
            value: CONTENT_STATUS_METADATA[topic.status].label,
          },
          { label: "التصنيف", value: topic.categorySlug || "—" },
          { label: "آخر تحديث", value: formatAdminDateTime(topic.updatedAt) },
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility: { access: "hidden" },
      featured: { access: "hidden" },
      duplicate: { access: "hidden" },
      archive: { access: "hidden" },
      delete: { access: "hidden" },
    },
  };
}

function createReportColumns(): AdminEntityColumnDef<
  TopicWithoutImageRow,
  ReportColumnKey,
  TopicsWithoutImageSortField
>[] {
  return [
    {
      key: "topic",
      label: "الموضوع",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      align: "start",
      minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon,
      width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon,
      sticky: "start",
      primary: true,
      primaryPresentation: "standard-icon",
      renderCell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
            <MediaNoImage compact />
          </div>
          <div className="min-w-0">
            <Link
              href={adminContentTopicPath(row.id)}
              prefetch={false}
              className="block truncate text-right text-sm font-semibold text-white transition hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
            >
              {row.title || `الموضوع ${row.id}`}
            </Link>
            <span
              dir="ltr"
              className="mt-1 block truncate text-left font-en text-[11px] text-white/38"
            >
              /{row.slug}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "content_type",
      label: "نوع المحتوى",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 138,
      width: 138,
      flexible: true,
      renderCell: ({ row }) => (
        <span className="text-sm text-white/70">
          {getContentTypeLabel(row.contentType)}
        </span>
      ),
    },
    {
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 118,
      width: 118,
      renderCell: ({ row }) => {
        const status = CONTENT_STATUS_METADATA[row.status];
        return <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>;
      },
    },
    {
      key: "category",
      label: "التصنيف",
      defaultVisible: true,
      hideable: true,
      sortable: false,
      align: "center",
      minWidth: 144,
      width: 144,
      renderCell: ({ row }) => (
        <span className="block truncate text-sm text-white/58">
          {row.categorySlug || "—"}
        </span>
      ),
    },
    {
      key: "updated_at",
      label: "آخر تحديث",
      defaultVisible: true,
      hideable: true,
      sortable: true,
      sortKey: "updated_at",
      align: "center",
      minWidth: 190,
      width: 190,
      renderCell: ({ row }) => (
        <span className="block text-sm text-white/58">
          {formatAdminDateTime(row.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      align: "center",
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row }) => (
        <AdminDataGridRowActions
          capability={buildTopicWithoutImageRowActions(row)}
          size="compact"
        />
      ),
    },
  ];
}

export default function TopicsWithoutImageReportClient({
  initialQuery,
  initialResult,
  initialVisibleColumns,
}: {
  initialQuery: AdminEntityListQuery<
    TopicsWithoutImageFilters,
    TopicsWithoutImageSortField
  >;
  initialResult: AdminEntityListResult<TopicWithoutImageRow>;
  initialVisibleColumns: string[] | null;
}) {
  const controller = useAdminEntityListController({
    entity: "topics_without_image",
    contract: topicsWithoutImageQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const columns = useMemo(() => createReportColumns(), []);
  const hasFilters =
    Boolean(controller.query.search) ||
    controller.query.filters.status !== "all" ||
    controller.query.filters.contentType !== "all";
  const initialFeedback = useMemo(
    () =>
      controller.error
        ? mapAdminActionResultToFeedback(
            adminActionFailure(
              "تعذر تحميل تقرير الموضوعات بلا صورة",
              controller.error.message,
            ),
          )
        : null,
    [controller.error],
  );

  return (
    <AdminEntityListSurface consumer="topics-without-image">
      <AdminEntityListTableRegion
        data-admin-entity-list-pending={
          controller.queryPending ? "true" : "false"
        }
      >
        <AdminEntityList<
          TopicWithoutImageRow,
          ReportColumnKey,
          TopicsWithoutImageSortField,
          number
        >
          listId="topics-without-image-table"
          sizingStrategy={{ mode: "flexible", columnKey: "content_type" }}
          toolbar={{
            basePath: "/admin/reports/topics-without-image",
            preserveParams: ["sort", "limit"],
            search: {
              placeholder: "بحث بالعنوان أو slug",
              value: controller.query.search,
              minLength: topicsWithoutImageQueryContract.searchMinLength,
            },
            filters: REPORT_FILTERS,
            values: {
              status: controller.query.filters.status,
              type: controller.query.filters.contentType,
            },
            onQueryPatch: controller.applyQueryPatch,
          }}
          rows={controller.result.rows}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title || `الموضوع ${row.id}`}
          initialVisibleColumns={
            initialVisibleColumns ?? [
              ...TOPICS_WITHOUT_IMAGE_DEFAULT_COLUMN_KEYS,
            ]
          }
          defaultVisibleColumns={[
            ...TOPICS_WITHOUT_IMAGE_DEFAULT_COLUMN_KEYS,
          ]}
          onPersistColumns={saveTopicsWithoutImageColumnPreferences}
          enableColumnManagement
          enableSelection={false}
          scrollLabel="جدول الموضوعات بلا صورة"
          mapResultToFeedback={mapAdminActionResultToFeedback}
          sort={{
            key: controller.query.sort.field,
            direction: controller.query.sort.direction,
          }}
          sortMode={{
            mode: "callback",
            onToggle: () => {
              controller.setSort({
                field: "updated_at",
                direction:
                  controller.query.sort.direction === "asc" ? "desc" : "asc",
              });
            },
          }}
          actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
          initialFeedback={initialFeedback}
          emptyState={{
            mode:
              controller.result.pagination.totalRows === 0 && !hasFilters
                ? "system"
                : "filtered",
            systemEmpty: (
              <div className="h-44">
                <MediaNoImage label="لا توجد موضوعات بلا صورة" />
              </div>
            ),
            filteredEmpty: (
              <p className="text-base font-semibold text-white">
                لا توجد موضوعات مطابقة للفلاتر الحالية
              </p>
            ),
          }}
        />

        <AdminTablePagination
          basePath="/admin/reports/topics-without-image"
          totalCount={controller.result.pagination.totalRows}
          pageSize={String(controller.result.pagination.pageSize)}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          currentPage={controller.result.pagination.page}
          totalPages={controller.result.pagination.totalPages}
          emptySummaryText="لا توجد موضوعات بلا صورة"
          onPageChange={controller.setPage}
          onPageSizeChange={controller.setPageSize}
        />
      </AdminEntityListTableRegion>
    </AdminEntityListSurface>
  );
}
