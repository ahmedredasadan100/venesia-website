"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  AdminFeedbackRegion,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminEntityListFilters from "../../../../components/admin/entity-list/AdminEntityListFilters";
import MediaSynchronizationWarningNotice from "../../../../components/admin/media/MediaSynchronizationWarningNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminBulkActionBar,
  AdminColumnVisibilityMenu,
  AdminDataGrid,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminDataGridSortLabel,
  AdminDataGridStatusCell,
  AdminPageExperience,
  AdminPageContextHeader,
  AdminTablePagination,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../../../../components/admin/ui";
import { useAdminTable } from "../../../../components/admin/table-engine";
import {
  adminCollectionSearchIncludes,
  useAdminBoundedClientPagination,
  type AdminBoundedClientQueryContract,
  type AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import { ADMIN_BULK_ACTION_LABELS } from "../../../../lib/admin/entity-list/bulk-action-labels";
import { useAdminBoundedClientInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
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
  toggleAction: (
    id: number,
    nextStatus: "published" | "unpublished",
  ) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
  errorMessage?: string | null;
  mediaSynchronizationWarning?: boolean;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);
type BlockTemplateSummarySortKey = "name" | "slug" | "detail" | "status";
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
  toggleAction,
  bulkAction,
  errorMessage = null,
  mediaSynchronizationWarning = false,
  initialVisibleColumns = null,
  preferenceError = null,
}: BlockTemplateSummaryListClientProps) {
  const feedbackChannel = `block-manager:${moduleKey}`;
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const instant = useAdminBoundedClientInstantMutation<BlockTemplateSummaryRow>({
    entity: `${moduleKey}-block-templates`,
    initialRows: rows,
    datasetKey: moduleKey,
  });
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
        ADMIN_DATA_GRID_COLUMNS.checkbox,
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
  const sortAccessors = useMemo(
    () => ({
      name: (row: BlockTemplateSummaryRow) => row.name,
      slug: (row: BlockTemplateSummaryRow) => row.slug,
      detail: (row: BlockTemplateSummaryRow) => row.detail,
      status: (row: BlockTemplateSummaryRow) => statusMeta(row.status).label,
    }),
    [],
  );
  const table = useAdminTable<BlockTemplateSummaryRow, BlockTemplateSummarySortKey>({
    initialRows: instant.rows,
    getRowId: (row) => row.id,
    sortAccessors,
  });
  const setTableRows = table.setRows;
  useEffect(() => {
    setTableRows(instant.rows);
  }, [instant.rows, setTableRows]);
  const filters = useMemo<readonly AdminEntityFilterDef[]>(
    () => [
      {
        id: `${moduleKey}-template-status`,
        paramKey: "status",
        label: "الحالة",
        type: "status",
        allValue: "all",
        placeholder: "الحالة",
        options: [
          { value: "published", label: "منشور" },
          { value: "unpublished", label: "غير منشور" },
        ],
      },
    ],
    [moduleKey],
  );
  const queryContract = useMemo<
    AdminBoundedClientQueryContract<BlockTemplateSummaryRow>
  >(
    () => ({
      mode: "bounded-client",
      search: { minLength: 1 },
      filters,
      matchesRow: (row, query) => {
        const matchesSearch = adminCollectionSearchIncludes(
          `${row.name} ${row.slug} ${row.detail} ${row.status}`,
          query.search,
        );
        const status = query.filters.status;
        return matchesSearch && (status === "all" || row.status === status);
      },
      getRowId: (row) => row.id,
    }),
    [filters],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: table.rows,
    datasetKey: moduleKey,
    queryContract,
    defaultPageSize: PAGE_SIZE,
  });
  const search = pagination.search;
  const statusFilter = pagination.filterValues.status;
  const paginatedRows = pagination.rows;
  const visibleIds = useMemo(
    () => paginatedRows.map((row) => row.id),
    [paginatedRows],
  );
  const selection = useAdminGridSelection<number>(visibleIds);
  const basePath = `/admin/pages-blocks/blocks/${moduleKey}`;

  async function runVisibilityMutation(
    row: BlockTemplateSummaryRow,
    nextStatus: "published" | "unpublished",
  ) {
    const successMessage =
      nextStatus === "published" ? "تم نشر الموديول." : "تم إخفاء الموديول.";
    clearFeedback(feedbackChannel);
    try {
      await instant.mutateAsync({
        rowId: row.id,
        action: "visibility",
        optimistic: (cache) =>
          cache.patchRows((candidate) =>
            candidate.id === row.id
              ? { ...candidate, status: nextStatus }
              : candidate,
          ),
        execute: async () => {
          await toggleAction(row.id, nextStatus);
          return { ok: true, message: successMessage };
        },
      });
      publishFeedback(
        {
          variant: "success",
          title: "تم تنفيذ الإجراء",
          message: successMessage,
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline" },
      );
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
    }
  }

  async function runBulkPublicationMutation(
    action: "publish" | "hide",
    ids: number[],
  ) {
    const nextStatus = action === "publish" ? "published" : "unpublished";
    const selectedIds = new Set(ids);
    const formData = new FormData();
    formData.set("bulk_action", action);
    ids.forEach((id) => formData.append("ids", String(id)));
    clearFeedback(feedbackChannel);

    try {
      await instant.mutateAsync({
        action: `bulk-${action}`,
        bulk: true,
        optimistic: (cache) =>
          cache.patchRows((row) =>
            selectedIds.has(row.id) ? { ...row, status: nextStatus } : row,
          ),
        execute: async () => {
          await bulkAction(formData);
          return {
            ok: true as const,
            message:
              action === "publish"
                ? "تم نشر الموديولات المحددة."
                : "تم إخفاء الموديولات المحددة.",
          };
        },
      });
      selection.clearSelection();
      publishFeedback(
        {
          variant: "success",
          title: "تم تنفيذ الإجراء",
          message:
            action === "publish"
              ? "تم نشر الموديولات المحددة."
              : "تم إخفاء الموديولات المحددة.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline" },
      );
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تنفيذ الإجراء الجماعي. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
    }
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة الموديولات"
        title={title}
        description={description}
      />

      <AdminFeedbackRegion
        channel={`block-manager:${moduleKey}`}
        label={`نتائج قراءة ${title}`}
        placement="global"
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
        filters={filters}
        values={{ status: statusFilter }}
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
        contextOverrideActive={selection.selectedIds.length > 0}
        contextOverride={
          <AdminBulkActionBar
            selectedIds={selection.selectedIds}
            entityLabel="موديول"
            options={[
              {
                value: "publish",
                label: ADMIN_BULK_ACTION_LABELS.showSelected,
              },
              {
                value: "hide",
                label: ADMIN_BULK_ACTION_LABELS.hideSelected,
              },
            ]}
            onExecute={(action, ids) =>
              runBulkPublicationMutation(action as "publish" | "hide", ids)
            }
            onClearSelection={selection.clearSelection}
            isBusy={instant.bulkInteraction.isBlocked}
          />
        }
        onQueryPatch={pagination.applyQueryPatch}
      />

      <AdminDataGrid className="!rounded-t-none !border-t-0">
        <AdminDataGridHeader columns={columns}>
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.target.checked)}
              inputRef={selection.selectAllRef}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
          <AdminDataGridPrimaryCell>
            <AdminDataGridSortLabel
              active={table.sort.key === "name"}
              direction={table.sort.direction}
              onClick={() => {
                pagination.resetPage();
                table.toggleSort("name");
              }}
              className="justify-end"
            >
              الاسم
            </AdminDataGridSortLabel>
          </AdminDataGridPrimaryCell>
          {visibleColumnSet.has("slug") ? (
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel
                active={table.sort.key === "slug"}
                direction={table.sort.direction}
                onClick={() => {
                  pagination.resetPage();
                  table.toggleSort("slug");
                }}
              >
                المعرّف
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("detail") ? (
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel
                active={table.sort.key === "detail"}
                direction={table.sort.direction}
                onClick={() => {
                  pagination.resetPage();
                  table.toggleSort("detail");
                }}
              >
                {detailLabel}
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("status") ? (
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel
                active={table.sort.key === "status"}
                direction={table.sort.direction}
                onClick={() => {
                  pagination.resetPage();
                  table.toggleSort("status");
                }}
              >
                الحالة
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
          ) : null}
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {paginatedRows.map((row) => {
          const status = statusMeta(row.status);
          const hidden = { access: "hidden" as const };
          const interaction = instant.getRowInteraction(row.id);
          const pendingAction = interaction.pendingAction;
          const visibilityPending = pendingAction === "visibility";
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
                  { label: "المعرّف", value: row.slug },
                  { label: detailLabel, value: row.detail },
                  { label: "الحالة", value: status.label },
                ],
              },
              copyPublicLink: hidden,
              visibility: visibilityPending
                ? {
                    access: "disabled",
                    disabledReason: "انتظر انتهاء الإجراء الحالي.",
                    pending: true,
                    isVisible: row.status === "published",
                  }
                : {
                    access: "allowed",
                    isVisible: row.status === "published",
                    onSelect: () =>
                      runVisibilityMutation(
                        row,
                        row.status === "published"
                          ? "unpublished"
                          : "published",
                      ),
                  },
              featured: hidden,
              duplicate: hidden,
              archive: hidden,
              delete: hidden,
            },
          };

          return (
            <AdminDataGridRow key={row.id} columns={columns}>
              <AdminDataGridCheckboxCell>
                <AdminDataGridCheckbox
                  checked={selection.selectedSet.has(row.id)}
                  onChange={(event) =>
                    selection.toggleOne(row.id, event.target.checked)
                  }
                  label={`تحديد ${row.name}`}
                />
              </AdminDataGridCheckboxCell>
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
                  <AdminDataGridRowActions
                    capability={capability}
                    display="visibility"
                    size="compact"
                  />
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
