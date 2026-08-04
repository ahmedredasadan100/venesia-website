"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../../components/admin/entity-list";
import {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  AdminActionButton,
  AdminDataGridRowActions,
  AdminPageContextHeader,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../lib/admin/admin-action-feedback";
import {
  adminActionFailure,
  adminActionSuccess,
  type AdminActionResult,
} from "../../../lib/admin/admin-action-result";
import type {
  AdminEntityColumnDef,
  AdminEntityFilterDef,
} from "../../../lib/admin/entity-list";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../lib/admin/entity-list/data-engine/client-controller";
import { useAdminEntityInstantMutation } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  ADMIN_USERS_LIST_PAGE_SIZES,
  adminUserEntityListRowSchema,
  adminUsersQueryContract,
  type AdminUserEntityListMetrics,
  type AdminUserEntityListRow,
  type AdminUserFilters,
  type AdminUserSortField,
  type AdminUserStatusFilter,
} from "../../../lib/admin/users/entity-list-contract";
import {
  ADMIN_USERS_LIST_COLUMN_META,
  getAdminUsersDefaultColumnKeys,
  type AdminUserColumnKey,
} from "../../../lib/admin/users/list-config";

import AdminUserFormModal from "./AdminUserFormModal";
import {
  deleteAdminUserAction,
  restoreAdminUsersTablePreferences,
  saveAdminUsersTablePreferences,
  setAdminUserActiveAction,
} from "./actions";

type UsersManagementClientProps = {
  initialQuery: AdminEntityListQuery<AdminUserFilters, AdminUserSortField>;
  initialResult: AdminEntityListResult<
    AdminUserEntityListRow,
    AdminUserEntityListMetrics
  >;
  initialVisibleColumns?: readonly string[];
  preferenceError?: string | null;
  currentUserId: number;
  currentUsername: string;
};

const PAGE_SIZE_OPTIONS = ADMIN_USERS_LIST_PAGE_SIZES.map(String);

const STATUS_FILTER: AdminEntityFilterDef = {
  id: "users-status",
  paramKey: "status",
  label: "الحالة",
  placeholder: "الحالة",
  type: "status",
  options: [
    { value: "active", label: "نشط" },
    { value: "inactive", label: "موقوف" },
  ],
};

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

function roleLabel(role: string) {
  return role === "admin" ? "مدير" : role;
}

function createAdminUserColumns(input: {
  currentUserId: number;
  rowPendingAction: (id: number) => string | null;
  mutationBusy: boolean;
  onEdit: (row: AdminUserEntityListRow) => void;
  onToggle: (row: AdminUserEntityListRow) => Promise<AdminActionResult>;
  onDelete: (row: AdminUserEntityListRow) => Promise<AdminActionResult>;
}): AdminEntityColumnDef<
  AdminUserEntityListRow,
  AdminUserColumnKey,
  AdminUserSortField
>[] {
  return [
    {
      ...ADMIN_USERS_LIST_COLUMN_META.username,
      minWidth: 160,
      width: 180,
      primary: true,
      sticky: "start",
      renderCell: ({ row }) => (
        <span className="block text-right font-semibold text-white">
          {row.username}
        </span>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.email,
      minWidth: 220,
      width: 240,
      renderCell: ({ row }) => (
        <span className="block truncate text-left font-en text-sm text-white/72" dir="ltr">
          {row.email}
        </span>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.fullName,
      minWidth: 170,
      width: 190,
      renderCell: ({ row }) => (
        <span className="block truncate text-right text-sm text-white/72">
          {row.full_name || "—"}
        </span>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.role,
      minWidth: 100,
      width: 110,
      renderCell: ({ row }) => (
        <span className="text-sm text-white/65">{roleLabel(row.role)}</span>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.status,
      minWidth: 108,
      width: 112,
      renderCell: ({ row }) => (
        <AdminStatusPill tone={row.is_active ? "green" : "muted"}>
          {row.is_active ? "نشط" : "موقوف"}
        </AdminStatusPill>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.lastLogin,
      minWidth: 164,
      width: 174,
      renderCell: ({ row }) => (
        <span className="block text-right text-sm text-white/55">
          {formatDate(row.last_login_at)}
        </span>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.created,
      minWidth: 164,
      width: 174,
      renderCell: ({ row }) => (
        <span className="block text-right text-sm text-white/55">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      ...ADMIN_USERS_LIST_COLUMN_META.actions,
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => {
        const isSelf = row.id === input.currentUserId;
        const pendingAction = input.rowPendingAction(row.id);
        const blockedReason = "انتظر انتهاء الإجراء الحالي.";
        const capability: AdminRowActionsCapability = {
          entityType: "admin_user",
          entityId: row.id,
          entityLabel: row.username,
          actions: {
            edit: input.mutationBusy
              ? {
                  access: "disabled",
                  disabledReason: blockedReason,
                  pending: Boolean(pendingAction),
                }
              : { access: "allowed", onSelect: () => input.onEdit(row) },
            preview: { access: "hidden" },
            information: {
              access: "allowed",
              title: "معلومات المستخدم",
              items: [
                { label: "اسم المستخدم", value: row.username },
                { label: "البريد الإلكتروني", value: row.email },
                { label: "الدور", value: roleLabel(row.role) },
                {
                  label: "الحالة",
                  value: row.is_active ? "نشط" : "موقوف",
                },
                { label: "آخر دخول", value: formatDate(row.last_login_at) },
              ],
            },
            copyPublicLink: { access: "hidden" },
            visibility: input.mutationBusy
              ? {
                  access: "disabled",
                  disabledReason: blockedReason,
                  pending: pendingAction === "visibility",
                  isVisible: row.is_active,
                }
              : isSelf && row.is_active
                ? {
                    access: "disabled",
                    disabledReason: "لا يمكنك تعطيل حسابك الحالي.",
                    isVisible: true,
                  }
                : {
                    access: "allowed",
                    isVisible: row.is_active,
                    onSelect: async () => {
                      const result = await input.onToggle(row);
                      onMutationResult?.(result);
                    },
                    confirmation: {
                      mode: "shared",
                      title: row.is_active
                        ? "تعطيل المستخدم؟"
                        : "تفعيل المستخدم؟",
                      description: row.is_active
                        ? `سيتم تعطيل «${row.username}» وإبطال جلساته فورًا.`
                        : `سيتم تفعيل «${row.username}» والسماح له بتسجيل الدخول وفق الصلاحيات الحالية.`,
                      confirmLabel: row.is_active
                        ? "تأكيد التعطيل"
                        : "تأكيد التفعيل",
                    },
                  },
            featured: { access: "hidden" },
            duplicate: { access: "hidden" },
            archive: { access: "hidden" },
            delete: input.mutationBusy
              ? {
                  access: "disabled",
                  disabledReason: blockedReason,
                  pending: pendingAction === "delete",
                }
              : isSelf
                ? {
                    access: "disabled",
                    disabledReason: "لا يمكنك حذف حسابك الحالي.",
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
                      title: "حذف المستخدم نهائيًا؟",
                      description: `سيتم حذف المستخدم «${row.username}» نهائيًا. لا يمكن التراجع عن هذا الإجراء.`,
                      confirmLabel: "تأكيد الحذف النهائي",
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

export default function UsersManagementClient({
  initialQuery,
  initialResult,
  initialVisibleColumns,
  preferenceError = null,
  currentUserId,
  currentUsername,
}: UsersManagementClientProps) {
  const controller = useAdminEntityListController({
    entity: "admin_users",
    contract: adminUsersQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const instant = useAdminEntityInstantMutation<AdminUserEntityListRow>(
    "admin_users",
    controller.query,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] =
    useState<AdminUserEntityListRow | null>(null);

  const toggleUserActive = useCallback(
    async (row: AdminUserEntityListRow): Promise<AdminActionResult> => {
      const nextActive = !row.is_active;
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            if (
              controller.query.filters.status !== "all" &&
              controller.query.filters.status !==
                (nextActive ? "active" : "inactive")
            ) {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, is_active: nextActive }
                : current,
            );
          },
          execute: async () => {
            const user = await setAdminUserActiveAction(row.id, nextActive);
            return {
              ok: true as const,
              message: nextActive
                ? `تم تفعيل المستخدم «${user.username}».`
                : `تم تعطيل المستخدم «${user.username}» وإبطال جلساته.`,
              user,
            };
          },
          reconcileSuccess: (confirmed, tools) => {
            const parsed = adminUserEntityListRowSchema.safeParse(
              confirmed.user,
            );
            if (!parsed.success) return;
            tools.cache.patchRows((current) =>
              current.id === parsed.data.id ? parsed.data : current,
            );
          },
        });
        return adminActionSuccess(
          nextActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم",
          result.message,
          {
            code: nextActive ? "published" : "unpublished",
            entityId: row.id,
          },
        );
      } catch (error) {
        return adminActionFailure(
          "تعذر تحديث حالة المستخدم",
          error instanceof Error
            ? error.message
            : "تعذر تحديث حالة المستخدم.",
          { entityId: row.id },
        );
      }
    },
    [controller.query.filters.status, instant],
  );

  const deleteUser = useCallback(
    async (row: AdminUserEntityListRow): Promise<AdminActionResult> => {
      try {
        const result = await instant.mutateAsync({
          rowId: row.id,
          action: "delete",
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: async () => {
            const deleted = await deleteAdminUserAction(row.id);
            return {
              ok: true as const,
              message: `تم حذف المستخدم «${deleted.username}».`,
              deletedId: deleted.id,
            };
          },
        });
        return adminActionSuccess("تم حذف المستخدم", result.message, {
          code: "deleted",
          entityId: row.id,
        });
      } catch (error) {
        return adminActionFailure(
          "تعذر حذف المستخدم",
          error instanceof Error ? error.message : "تعذر حذف المستخدم.",
          { entityId: row.id },
        );
      }
    },
    [instant],
  );

  const columns = useMemo(
    () =>
      createAdminUserColumns({
        currentUserId,
        rowPendingAction: (id) =>
          instant.rowPending?.rowId === id
            ? instant.rowPending.action
            : null,
        mutationBusy:
          instant.rowPending !== null || instant.bulkPending !== null,
        onEdit: setEditingUser,
        onToggle: toggleUserActive,
        onDelete: deleteUser,
      }),
    [
      currentUserId,
      deleteUser,
      instant.bulkPending,
      instant.rowPending,
      toggleUserActive,
    ],
  );
  const filters = useMemo<readonly AdminEntityFilterDef[]>(
    () => [
      STATUS_FILTER,
      {
        id: "users-role",
        paramKey: "role",
        label: "الدور",
        placeholder: "الدور",
        type: "single_select",
        options: (controller.result.metrics?.roles ?? []).map((role) => ({
          value: role,
          label: roleLabel(role),
        })),
      },
    ],
    [controller.result.metrics?.roles],
  );
  const hasFilters =
    Boolean(controller.query.search) ||
    controller.query.filters.status !== "all" ||
    controller.query.filters.role !== "all";
  const initialFeedback = useMemo(
    () =>
      controller.error || preferenceError
        ? mapAdminActionResultToFeedback(
            adminActionFailure(
              controller.error
                ? "تعذر تحميل المستخدمين"
                : "تعذر تحميل تفضيلات الأعمدة",
              controller.error?.message ??
                preferenceError ??
                "تعذر تحميل البيانات.",
            ),
          )
        : null,
    [controller.error, preferenceError],
  );
  const pagination = controller.result.pagination;

  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="ADMIN USERS DATA ENGINE"
          title="المستخدمون والصلاحيات"
          description="إدارة حسابات دخول لوحة التحكم. التعطيل هو الإجراء المعتمد بدل الحذف، ويتم إبطال جلسات المستخدم فورًا عند التعطيل أو تغيير بيانات الدخول."
          meta={`${pagination.totalRows} مستخدم`}
          actions={
            <AdminActionButton
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              إضافة مستخدم
            </AdminActionButton>
          }
        />

        <AdminEntityListSurface consumer="admin-users">
          <AdminEntityListTableRegion
            data-admin-entity-list-pending={
              controller.isFetching ? "true" : "false"
            }
          >
            <AdminEntityList<
              AdminUserEntityListRow,
              AdminUserColumnKey,
              AdminUserSortField,
              number
            >
              listId="admin-users-table"
              toolbar={{
                basePath: "/admin/users-roles",
                preserveParams: ["sort", "limit"],
                search: {
                  value: controller.query.search,
                  placeholder:
                    "بحث باسم المستخدم أو البريد أو الاسم الكامل...",
                  minLength: adminUsersQueryContract.searchMinLength,
                  pending: controller.isFetching,
                },
                filters,
                values: {
                  status: controller.query.filters.status,
                  role: controller.query.filters.role,
                },
                clearableFilterKeys: ["status", "role"],
                onQueryPatch: (patch, behavior = "push") => {
                  const search =
                    "q" in patch
                      ? (patch.q ?? "").trim()
                      : controller.query.search;
                  const status: AdminUserStatusFilter =
                    "status" in patch
                      ? patch.status === "active" ||
                        patch.status === "inactive"
                        ? patch.status
                        : "all"
                      : controller.query.filters.status;
                  const role =
                    "role" in patch
                      ? typeof patch.role === "string" && patch.role
                        ? patch.role
                        : "all"
                      : controller.query.filters.role;
                  controller.setSearchAndFilters(
                    search,
                    { status, role },
                    behavior,
                  );
                },
              }}
              rows={controller.result.rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.username}
              initialVisibleColumns={initialVisibleColumns}
              defaultVisibleColumns={[
                ...getAdminUsersDefaultColumnKeys(),
              ]}
              onPersistColumns={saveAdminUsersTablePreferences}
              onRestoreColumns={restoreAdminUsersTablePreferences}
              enableColumnManagement
              enableSelection={false}
              scrollLabel="جدول المستخدمين والصلاحيات"
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={null}
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              initialFeedback={initialFeedback}
              emptyState={{
                mode:
                  pagination.totalRows === 0 && !hasFilters
                    ? "system"
                    : "filtered",
                systemEmpty: (
                  <p className="text-base font-semibold text-white">
                    لا يوجد مستخدمون بعد.
                  </p>
                ),
                filteredEmpty: (
                  <p className="text-base font-semibold text-white">
                    لا يوجد مستخدمون مطابقون للبحث أو الفلتر.
                  </p>
                ),
              }}
            />

            <AdminTablePagination
              basePath="/admin/users-roles"
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalCount={pagination.totalRows}
              pageSize={String(pagination.pageSize)}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              emptySummaryText="لا يوجد مستخدمون مطابقون"
              pending={controller.isFetching}
              onPageChange={controller.setPage}
              onPageSizeChange={controller.setPageSize}
            />
          </AdminEntityListTableRegion>
        </AdminEntityListSurface>

        <p className="text-xs text-white/35">
          المستخدم الحالي:{" "}
          <span className="text-white/55">{currentUsername}</span>
        </p>
      </AdminEntityListPageLayout>

      <AdminUserFormModal
        key="admin-user-create"
        open={createOpen}
        mode="create"
        currentUserId={currentUserId}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          void controller.invalidate();
        }}
      />
      <AdminUserFormModal
        key={`admin-user-edit:${editingUser?.id ?? "closed"}`}
        open={Boolean(editingUser)}
        mode="edit"
        user={editingUser ?? undefined}
        currentUserId={currentUserId}
        onClose={() => setEditingUser(null)}
        onSaved={() => {
          void controller.invalidate();
        }}
      />
    </>
  );
}
