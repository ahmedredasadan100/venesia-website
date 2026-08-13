"use client";

import { useMemo } from "react";

import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../../components/admin/entity-list";
import {
  AdminPageHeader,
  AdminTablePagination,
} from "../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../lib/admin/admin-action-feedback";
import { adminActionFailure } from "../../../lib/admin/admin-action-result";
import {
  AUDIT_ACTION_LABELS,
  type AuditAction,
} from "../../../lib/admin/audit/audit-actions";
import { formatCmsAuditActionLabel } from "../../../lib/admin/audit/cms-audit-actions";
import type { AuditLogRecord } from "../../../lib/admin/audit/audit-types";
import {
  activityLogQueryContract,
  type ActivityLogFilters,
  type ActivityLogSortField,
} from "../../../lib/admin/audit/entity-list-contract";
import type {
  AdminEntityColumnDef,
  AdminEntityFilterDef,
} from "../../../lib/admin/entity-list";
import { useAdminEntityListController } from "../../../lib/admin/entity-list/data-engine/client-controller";
import { ACTIVITY_LOG_DEFAULT_COLUMN_KEYS } from "../../../lib/admin/audit/activity-log-list-config";
import { formatAdminDateTime } from "../../../lib/content-dates";

import { saveActivityLogColumnPreferences } from "./column-preferences";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../lib/admin/entity-list/data-engine/contracts";

type ActivityLogClientProps = {
  initialQuery: AdminEntityListQuery<
    ActivityLogFilters,
    ActivityLogSortField
  >;
  initialResult: AdminEntityListResult<AuditLogRecord>;
  actionOptions: Array<{ value: string; label: string }>;
  actorOptions: string[];
  entityTypeOptions: string[];
  initialVisibleColumns: string[] | null;
};

type ActivityLogColumnKey =
  | "created_at"
  | "actor"
  | "action"
  | "entity_type"
  | "entity"
  | "ip"
  | "details";

function formatMetadata(metadata: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  try {
    return JSON.stringify(metadata);
  } catch {
    return "—";
  }
}

function actionLabel(action: string) {
  return (
    AUDIT_ACTION_LABELS[action as AuditAction] ??
    formatCmsAuditActionLabel(action) ??
    action
  );
}

const ACTIVITY_LOG_COLUMNS: readonly AdminEntityColumnDef<
  AuditLogRecord,
  ActivityLogColumnKey,
  ActivityLogSortField
>[] = [
  {
    key: "created_at",
    label: "التاريخ",
    defaultVisible: true,
    hideable: false,
    sortable: true,
    sortKey: "created_at",
    align: "start",
    minWidth: 164,
    width: 164,
    primary: true,
    sticky: "start",
    renderCell: ({ row }) => (
      <span className="block text-right text-sm text-white/60">
        {formatAdminDateTime(row.created_at)}
      </span>
    ),
  },
  {
    key: "actor",
    label: "المستخدم",
    defaultVisible: true,
    hideable: true,
    sortable: false,
    align: "center",
    minWidth: 150,
    width: 150,
    renderCell: ({ row }) => (
      <span className="block truncate font-semibold text-white" title={row.actor_username}>
        {row.actor_username}
      </span>
    ),
  },
  {
    key: "action",
    label: "العملية",
    defaultVisible: true,
    hideable: true,
    sortable: false,
    align: "center",
    minWidth: 190,
    width: 190,
    renderCell: ({ row }) => (
      <span className="block truncate text-[#D8B87A]/85" title={actionLabel(row.action)}>
        {actionLabel(row.action)}
      </span>
    ),
  },
  {
    key: "entity_type",
    label: "نوع الكيان",
    defaultVisible: true,
    hideable: true,
    sortable: false,
    align: "center",
    minWidth: 132,
    width: 132,
    renderCell: ({ row }) => (
      <span className="block truncate text-white/55" title={row.entity_type ?? undefined}>
        {row.entity_type ?? "—"}
      </span>
    ),
  },
  {
    key: "entity",
    label: "الكيان",
    defaultVisible: true,
    hideable: true,
    sortable: false,
    align: "center",
    minWidth: 160,
    width: 160,
    renderCell: ({ row }) => (
      <span className="block truncate text-white/70" title={row.entity_label ?? undefined}>
        {row.entity_label ?? "—"}
      </span>
    ),
  },
  {
    key: "ip",
    label: "عنوان IP",
    defaultVisible: true,
    hideable: true,
    sortable: false,
    align: "center",
    minWidth: 136,
    width: 136,
    renderCell: ({ row }) => (
      <span className="block truncate font-en text-xs text-white/45" dir="ltr" title={row.ip_address ?? undefined}>
        {row.ip_address ?? "—"}
      </span>
    ),
  },
  {
    key: "details",
    label: "التفاصيل",
    defaultVisible: true,
    hideable: true,
    sortable: false,
    align: "start",
    minWidth: 220,
    width: 220,
    renderCell: ({ row }) => {
      const details = formatMetadata(row.metadata);
      return (
        <span className="block truncate text-xs text-white/45" title={details}>
          {details}
        </span>
      );
    },
  },
];

export default function ActivityLogClient({
  initialQuery,
  initialResult,
  actionOptions,
  actorOptions,
  entityTypeOptions,
  initialVisibleColumns,
}: ActivityLogClientProps) {
  const controller = useAdminEntityListController({
    entity: "activity_log",
    contract: activityLogQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 15_000,
  });
  const entityTypes = useMemo(() => {
    const merged = new Set([
      ...entityTypeOptions,
      ...controller.result.rows
        .map((item) => item.entity_type)
        .filter((entityType): entityType is string => Boolean(entityType)),
    ]);
    if (controller.query.filters.entityType) {
      merged.add(controller.query.filters.entityType);
    }
    return [...merged].sort() as string[];
  }, [
    controller.query.filters.entityType,
    controller.result.rows,
    entityTypeOptions,
  ]);
  const filterDefinitions = useMemo<AdminEntityFilterDef[]>(
    () => [
      {
        id: "activity-actor",
        paramKey: "actor",
        label: "المستخدم",
        placeholder: "كل المستخدمين",
        type: "entity_select",
        searchable: true,
        allValue: "",
        options: actorOptions.map((actor) => ({ value: actor, label: actor })),
      },
      {
        id: "activity-action",
        paramKey: "action",
        label: "نوع العملية",
        placeholder: "كل العمليات",
        type: "entity_select",
        searchable: true,
        allValue: "",
        options: actionOptions,
      },
      {
        id: "activity-entity-type",
        paramKey: "entityType",
        label: "نوع الكيان",
        placeholder: "كل أنواع الكيانات",
        type: "entity_select",
        searchable: true,
        allValue: "",
        options: entityTypes.map((entityType) => ({
          value: entityType,
          label: entityType,
          })),
        },
        {
          id: "activity-date-from",
          paramKey: "dateFrom",
          label: "تاريخ النشاط من",
          placeholder: "تاريخ البداية",
          allValue: "",
          type: "date",
        },
        {
          id: "activity-date-to",
          paramKey: "dateTo",
          label: "تاريخ النشاط إلى",
          placeholder: "تاريخ النهاية",
          allValue: "",
          type: "date",
        },
    ],
    [actionOptions, actorOptions, entityTypes],
  );
  const pagination = controller.result.pagination;
  const initialFeedback = useMemo(
    () =>
      controller.error
        ? mapAdminActionResultToFeedback(
            adminActionFailure(
              "تعذر تحميل سجل النشاط",
              controller.error.message,
            ),
          )
        : null,
    [controller.error],
  );

  return (
    <AdminEntityListPageLayout className="pb-10" dir="rtl">
      <AdminPageHeader
        eyebrow="ACTIVITY LOG"
        title="سجل النشاط"
        description="سجل تدقيق للعمليات الإدارية الحساسة: المصادقة وإدارة المستخدمين. لا يتم تخزين كلمات المرور أو الرموز أو ملفات تعريف الارتباط."
        meta={`${pagination.totalRows} حدث`}
      />

      <AdminEntityListSurface consumer="activity-log">
        <AdminEntityListTableRegion
          data-admin-entity-list-pending={controller.queryPending ? "true" : "false"}
        >
          <AdminEntityList<
            AuditLogRecord,
            ActivityLogColumnKey,
            ActivityLogSortField,
            number
          >
            listId="activity-log-table"
            toolbar={{
              basePath: "/admin/activity-log",
              search: {
                value: controller.query.search,
                placeholder: "بحث في المستخدم أو الكيان...",
                debounceMs: 350,
              },
              filters: filterDefinitions,
              values: {
                actor: controller.query.filters.actorUsername,
                action: controller.query.filters.action,
                entityType: controller.query.filters.entityType,
                dateFrom: controller.query.filters.dateFrom,
                dateTo: controller.query.filters.dateTo,
              },
              clearableFilterKeys: [
                "actor",
                "action",
                "entityType",
                "dateFrom",
                "dateTo",
              ],
              onQueryPatch: controller.applyQueryPatch,
            }}
            rows={controller.result.rows}
            columns={ACTIVITY_LOG_COLUMNS}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.entity_label || row.actor_username}
            initialVisibleColumns={
              initialVisibleColumns ?? [...ACTIVITY_LOG_DEFAULT_COLUMN_KEYS]
            }
            defaultVisibleColumns={[...ACTIVITY_LOG_DEFAULT_COLUMN_KEYS]}
            onPersistColumns={saveActivityLogColumnPreferences}
            enableColumnManagement
            enableSelection={false}
            scrollLabel="جدول سجل النشاط"
            mapResultToFeedback={mapAdminActionResultToFeedback}
            sort={{
              key: controller.query.sort.field,
              direction: controller.query.sort.direction,
            }}
            sortMode={{
              mode: "callback",
              onToggle: (field) => {
                const current = controller.query.sort;
                controller.setSort({
                  field: field as ActivityLogSortField,
                  direction:
                    current.field === field && current.direction === "asc"
                      ? "desc"
                      : "asc",
                });
              },
            }}
            actionsColumnWidth={0}
            initialFeedback={initialFeedback}
            emptyState={{
              mode:
                pagination.totalRows === 0 &&
                !controller.query.search &&
                !Object.values(controller.query.filters).some(Boolean)
                  ? "system"
                  : "filtered",
              systemEmpty: (
                <p className="text-base font-semibold text-white">
                  لا توجد أحداث مسجلة بعد.
                </p>
              ),
              filteredEmpty: (
                <p className="text-base font-semibold text-white">
                  لا توجد أحداث مطابقة للفلاتر الحالية.
                </p>
              ),
            }}
          />

          <AdminTablePagination
            basePath="/admin/activity-log"
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalRows}
            pageSize={String(pagination.pageSize)}
            emptySummaryText="لا توجد أحداث"
            onPageChange={controller.setPage}
            onPageSizeChange={controller.setPageSize}
          />
        </AdminEntityListTableRegion>
      </AdminEntityListSurface>
    </AdminEntityListPageLayout>
  );
}
