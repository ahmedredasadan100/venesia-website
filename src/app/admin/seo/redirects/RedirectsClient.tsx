"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../../../components/admin/entity-list";
import {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  AdminActionButton,
  AdminDataGridRowActions,
  AdminPageContextHeader,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import {
  adminActionFailure,
  adminActionSuccess,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import { useAdminEntityInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import type { RedirectEntityListRow } from "../../../../lib/admin/redirects/entity-list-adapter";
import {
  REDIRECTS_LIST_PAGE_SIZES,
  redirectsQueryContract,
  type RedirectFilters,
  type RedirectSortField,
} from "../../../../lib/admin/redirects/entity-list-contract";
import {
  getRedirectsDefaultColumnKeys,
  REDIRECTS_LIST_COLUMN_META,
  type RedirectColumnKey,
} from "../../../../lib/admin/redirects/list-config";

import RedirectFormModal from "./RedirectFormModal";
import { createRedirectsCollectionToolbar } from "./RedirectsListFilters";
import {
  deleteRedirectAction,
  restoreRedirectsTablePreferences,
  saveRedirectsTablePreferences,
  toggleRedirectStatusAction,
} from "./actions";

type RedirectColumnSortKey = "fixed";

type RedirectsClientProps = {
  initialQuery: AdminEntityListQuery<RedirectFilters, RedirectSortField>;
  initialResult: AdminEntityListResult<RedirectEntityListRow>;
  initialVisibleColumns?: readonly string[];
  preferenceError?: string | null;
};

const PAGE_SIZE_OPTIONS = REDIRECTS_LIST_PAGE_SIZES.map(String);

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function createRedirectColumns(input: {
  rowPendingAction: (id: number) => string | null;
  mutationBusy: boolean;
  onEdit: (row: RedirectEntityListRow) => void;
  onToggle: (row: RedirectEntityListRow) => Promise<AdminActionResult>;
  onDelete: (row: RedirectEntityListRow) => Promise<AdminActionResult>;
}): AdminEntityColumnDef<
  RedirectEntityListRow,
  RedirectColumnKey,
  RedirectColumnSortKey
>[] {
  return [
    {
      ...REDIRECTS_LIST_COLUMN_META.source,
      minWidth: 210,
      width: 210,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <span className="block break-all text-right font-en text-sm text-white">
          {row.source_path}
        </span>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.destination,
      minWidth: 220,
      width: 220,
      renderCell: ({ row }) => (
        <span className="block break-all text-right font-en text-sm text-white/88">
          {row.destination_path}
        </span>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.type,
      minWidth: 96,
      width: 96,
      renderCell: ({ row }) => (
        <span className="font-en text-sm">{row.redirect_type}</span>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.status,
      minWidth: 112,
      width: 112,
      renderCell: ({ row }) => (
        <AdminStatusPill tone={row.status === "active" ? "green" : "gold"}>
          {row.status === "active" ? "نشط" : "غير نشط"}
        </AdminStatusPill>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.note,
      minWidth: 150,
      width: 150,
      renderCell: ({ row }) => (
        <span className="block truncate text-right text-sm text-white/70">
          {row.note || "—"}
        </span>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.created,
      minWidth: 164,
      width: 164,
      renderCell: ({ row }) => (
        <span className="block text-right text-sm text-white/62">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.updated,
      minWidth: 164,
      width: 164,
      renderCell: ({ row }) => (
        <span className="block text-right text-sm text-white/62">
          {formatDate(row.updated_at)}
        </span>
      ),
    },
    {
      ...REDIRECTS_LIST_COLUMN_META.actions,
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => {
        const pendingAction = input.rowPendingAction(row.id);
        const disabled = input.mutationBusy;
        const capability: AdminRowActionsCapability = {
          entityType: "redirect",
          entityId: row.id,
          entityLabel: row.source_path,
          actions: {
            edit: disabled
              ? {
                  access: "disabled",
                  disabledReason: "انتظر انتهاء الإجراء الحالي.",
                }
              : { access: "allowed", onSelect: () => input.onEdit(row) },
            preview: { access: "hidden" },
            information: {
              access: "allowed",
              title: "معلومات التحويل",
              items: [
                { label: "المعرف", value: String(row.id) },
                { label: "المصدر", value: row.source_path },
                { label: "الوجهة", value: row.destination_path },
                { label: "النوع", value: row.redirect_type },
                {
                  label: "الحالة",
                  value: row.status === "active" ? "نشط" : "غير نشط",
                },
              ],
            },
            copyPublicLink: { access: "hidden" },
            visibility: disabled
              ? {
                  access: "disabled",
                  disabledReason: "انتظر انتهاء الإجراء الحالي.",
                  pending: pendingAction === "visibility",
                  isVisible: row.status === "active",
                }
              : {
                  access: "allowed",
                  isVisible: row.status === "active",
                  onSelect: async () => {
                    const result = await input.onToggle(row);
                    onMutationResult?.(result);
                  },
                },
            featured: { access: "hidden" },
            duplicate: { access: "hidden" },
            archive: { access: "hidden" },
            delete: disabled
              ? {
                  access: "disabled",
                  disabledReason: "انتظر انتهاء الإجراء الحالي.",
                  pending: pendingAction === "delete",
                }
              : {
                  access: "allowed",
                  onSelect: async () => {
                    const result = await input.onDelete(row);
                    onMutationResult?.(result);
                    if (!result.ok) throw new Error(result.message);
                  },
                  confirmation: {
                    mode: "shared",
                    title: "تأكيد حذف التحويل",
                    description: `هل أنت متأكد من حذف التحويل من ${row.source_path}؟ لا يمكن التراجع عن هذا الإجراء.`,
                    confirmLabel: "حذف التحويل",
                  },
                },
          },
        };
        return (
          <AdminDataGridRowActions capability={capability} size="compact" />
        );
      },
    },
  ];
}

export default function RedirectsClient({
  initialQuery,
  initialResult,
  initialVisibleColumns,
  preferenceError = null,
}: RedirectsClientProps) {
  const controller = useAdminEntityListController({
    entity: "redirects",
    contract: redirectsQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const instant = useAdminEntityInstantMutation<RedirectEntityListRow>(
    "redirects",
    controller.query,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] =
    useState<RedirectEntityListRow | null>(null);

  const toggleRedirect = useCallback(
    async (row: RedirectEntityListRow): Promise<AdminActionResult> => {
      const nextStatus = row.status === "active" ? "inactive" : "active";
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            if (
              controller.query.filters.status !== "all" &&
              controller.query.filters.status !== nextStatus
            ) {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, status: nextStatus }
                : current,
            );
          },
          execute: () => toggleRedirectStatusAction(row.id),
          reconcileSuccess: (confirmed, tools) => {
            const status =
              confirmed.status === "active" || confirmed.status === "inactive"
                ? confirmed.status
                : nextStatus;
            const updatedAt =
              typeof confirmed.updatedAt === "string"
                ? confirmed.updatedAt
                : null;
            tools.cache.patchRows((current) =>
              current.id === row.id
                ? {
                    ...current,
                    status,
                    updated_at: updatedAt ?? current.updated_at,
                  }
                : current,
            );
          },
        });
        const confirmedStatus =
          result.status === "active" || result.status === "inactive"
            ? result.status
            : nextStatus;
        return adminActionSuccess(
          confirmedStatus === "active"
            ? "تم تفعيل التحويل"
            : "تم إيقاف التحويل",
          result.message,
          {
            code:
              confirmedStatus === "active" ? "published" : "unpublished",
            entityId: row.id,
          },
        );
      } catch (error) {
        return adminActionFailure(
          "تعذر تحديث حالة التحويل",
          error instanceof Error
            ? error.message
            : "تعذر تحديث حالة التحويل. حاول مرة أخرى.",
          { entityId: row.id },
        );
      }
    },
    [controller.query.filters.status, instant],
  );

  const deleteRedirect = useCallback(
    async (row: RedirectEntityListRow): Promise<AdminActionResult> => {
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "delete",
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: () => deleteRedirectAction(row.id),
        });
        return adminActionSuccess("تم حذف التحويل", result.message, {
          code: "deleted",
          entityId: row.id,
        });
      } catch (error) {
        return adminActionFailure(
          "تعذر حذف التحويل",
          error instanceof Error
            ? error.message
            : "تعذر حذف التحويل. حاول مرة أخرى.",
          { entityId: row.id },
        );
      }
    },
    [instant],
  );

  const columns = useMemo(
    () =>
      createRedirectColumns({
        rowPendingAction: (id) =>
          instant.rowPending?.rowId === id
            ? instant.rowPending.action
            : null,
        mutationBusy:
          instant.rowPending !== null || instant.bulkPending !== null,
        onEdit: setEditingRedirect,
        onToggle: toggleRedirect,
        onDelete: deleteRedirect,
      }),
    [
      deleteRedirect,
      instant.bulkPending,
      instant.rowPending,
      toggleRedirect,
    ],
  );
  const hasFilters =
    Boolean(controller.query.search) ||
    controller.query.filters.status !== "all" ||
    controller.query.filters.redirectType !== "all";
  const initialFeedback = useMemo(
    () =>
      controller.error || preferenceError
        ? mapAdminActionResultToFeedback(
            adminActionFailure(
              controller.error
                ? "تعذر تحميل التحويلات"
                : "تعذر تحميل تفضيلات الأعمدة",
              controller.error?.message ?? preferenceError ?? "تعذر تحميل التفضيلات.",
            ),
          )
        : null,
    [controller.error, preferenceError],
  );
  function invalidateAfterFormSave() {
    void controller.invalidate();
  }

  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="SEO REDIRECTS"
          title="إدارة التحويلات"
          description="أنشئ تحويلات URL عامة لتغييرات المسارات بعد الإطلاق. التحويلات النشطة تُطبَّق فورًا على الطلبات العامة."
          actions={
            <AdminActionButton
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              إضافة تحويل
            </AdminActionButton>
          }
        />

        <AdminEntityListSurface consumer="redirects">
          <AdminEntityListTableRegion
            data-admin-entity-list-pending={
              controller.isFetching ? "true" : "false"
            }
          >
            <AdminEntityList<
              RedirectEntityListRow,
              RedirectColumnKey,
              RedirectColumnSortKey,
              number
            >
              listId="redirects-table"
              toolbar={createRedirectsCollectionToolbar({
                search: controller.query.search,
                status: controller.query.filters.status,
                redirectType: controller.query.filters.redirectType,
                pending: controller.isFetching,
                onQueryPatch: (patch, behavior = "push") => {
                  const search =
                    "q" in patch
                      ? (patch.q ?? "").trim()
                      : controller.query.search;
                  const status =
                    "status" in patch
                      ? patch.status === "active" || patch.status === "inactive"
                        ? patch.status
                        : "all"
                      : controller.query.filters.status;
                  const redirectType =
                    "type" in patch
                      ? patch.type === "301" || patch.type === "302"
                        ? patch.type
                        : "all"
                      : controller.query.filters.redirectType;
                  controller.setSearchAndFilters(
                    search,
                    { status, redirectType },
                    behavior,
                  );
                },
              })}
              rows={controller.result.rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.source_path}
              initialVisibleColumns={initialVisibleColumns}
              defaultVisibleColumns={[...getRedirectsDefaultColumnKeys()]}
              onPersistColumns={saveRedirectsTablePreferences}
              onRestoreColumns={restoreRedirectsTablePreferences}
              enableColumnManagement
              enableSelection={false}
              scrollLabel="جدول تحويلات SEO"
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={null}
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              initialFeedback={initialFeedback}
              emptyState={{
                mode:
                  controller.result.pagination.totalRows === 0 && !hasFilters
                    ? "system"
                    : "filtered",
                systemEmpty: (
                  <div>
                    <p className="text-base font-semibold text-white">
                      لا توجد تحويلات بعد
                    </p>
                    <p className="mt-2 text-sm leading-7 text-white/45">
                      أنشئ أول تحويل URL لإدارة تغييرات المسارات العامة بعد
                      الإطلاق.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-6 inline-flex rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
                    >
                      إضافة تحويل
                    </button>
                  </div>
                ),
                filteredEmpty: (
                  <p className="text-base font-semibold text-white">
                    لا توجد نتائج مطابقة للبحث أو الفلتر
                  </p>
                ),
              }}
            />
            <AdminTablePagination
              basePath="/admin/seo/redirects"
              totalCount={controller.result.pagination.totalRows}
              pageSize={String(controller.result.pagination.pageSize)}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              currentPage={controller.result.pagination.page}
              totalPages={controller.result.pagination.totalPages}
              emptySummaryText="لا توجد تحويلات"
              pending={controller.isFetching}
              onPageChange={controller.setPage}
              onPageSizeChange={controller.setPageSize}
            />
          </AdminEntityListTableRegion>
        </AdminEntityListSurface>
      </AdminEntityListPageLayout>

      <RedirectFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={invalidateAfterFormSave}
      />
      <RedirectFormModal
        open={Boolean(editingRedirect)}
        mode="edit"
        redirect={editingRedirect ?? undefined}
        onClose={() => setEditingRedirect(null)}
        onSaved={invalidateAfterFormSave}
      />
    </>
  );
}
