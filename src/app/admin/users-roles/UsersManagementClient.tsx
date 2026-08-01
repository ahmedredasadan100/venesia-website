"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../components/admin/VenesiaModal";
import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../components/admin/AdminFeedbackProvider";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  AdminActionButton,
  AdminConfirmDialog,
  AdminDataGrid,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRowActions,
  AdminDataGridRow,
  AdminPageHeader,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../components/admin/ui";
import { ADMIN_LIST_PAGE } from "../../../lib/admin/admin-ui-styles";
import {
  resolveClientPagination,
  slicePageRows,
} from "../../../lib/admin/entity-list/pagination";
import type { AdminUserListItem } from "../../../lib/admin/users/admin-users-management";
import {
  hasAdminUserCreateFieldErrors,
  hasAdminUserEditPasswordFieldErrors,
  validateAdminCreateUserForm,
  validateAdminOptionalPasswordFields,
  type AdminUserCreateField,
  type AdminUserCreateFieldErrors,
  type AdminUserEditPasswordField,
  type AdminUserEditPasswordFieldErrors,
} from "../../../lib/admin/users/admin-users-validation";

import {
  createAdminUserAction,
  deleteAdminUserAction,
  setAdminUserActiveAction,
  updateAdminUserAction,
} from "./actions";

type UsersManagementClientProps = {
  initialUsers: AdminUserListItem[];
  currentUserId: number;
  currentUsername: string;
};

type StatusFilter = "all" | "active" | "inactive";

const FEEDBACK_CHANNEL = "users-roles";
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

const columns = `minmax(140px,1.4fr) 90px 100px minmax(120px,1fr) ${ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact}`;

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
  if (role === "admin") return "مدير";
  return role;
}

function FormFieldError({ error, children }: { error?: string; children: ReactNode }) {
  return (
    <div>
      {children}
      {error ? <p className="mt-1 text-right text-[11px] leading-5 text-red-300/90">{error}</p> : null}
    </div>
  );
}

function fieldClassName(hasError: boolean, extra = "") {
  return adminFormFieldClassName(
    [hasError ? "border-red-400/40 bg-red-500/[0.03] focus:border-red-400/55" : "", extra]
      .filter(Boolean)
      .join(" "),
  );
}

export default function UsersManagementClient({
  initialUsers,
  currentUserId,
  currentUsername,
}: UsersManagementClientProps) {
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [confirmEditStatus, setConfirmEditStatus] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserListItem | null>(null);

  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    confirmPassword: "",
  });
  const [createFieldErrors, setCreateFieldErrors] = useState<AdminUserCreateFieldErrors>({});

  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    full_name: "",
    is_active: true,
  });

  const [editPasswordForm, setEditPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [editPasswordErrors, setEditPasswordErrors] = useState<AdminUserEditPasswordFieldErrors>({});

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter === "active" && !user.is_active) return false;
      if (statusFilter === "inactive" && user.is_active) return false;
      if (!query) return true;
      return (
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.full_name ?? "").toLowerCase().includes(query)
      );
    });
  }, [users, search, statusFilter]);
  const pagination = resolveClientPagination(
    filteredUsers.length,
    page,
    pageSize,
    PAGE_SIZE_OPTIONS,
    10,
  );
  const visibleUsers = slicePageRows(
    filteredUsers,
    pagination.page,
    pagination.pageSize,
  );

  function resetFeedback() {
    clearFeedback(FEEDBACK_CHANNEL);
  }

  function announce(
    variant: "success" | "danger" | "warning",
    title: string,
    message: string,
  ) {
    publishFeedback(
      {
        variant,
        title,
        message,
        layout: "inline",
        dismissible: true,
        lifecycle: variant === "danger" ? "persistent" : "manual",
      },
      {
        channel: FEEDBACK_CHANNEL,
        placement: "inline",
        critical: variant === "danger",
        reveal: variant === "danger",
      },
    );
  }

  function clearCreateFieldError(field: AdminUserCreateField) {
    setCreateFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateCreateFormField<K extends keyof typeof createForm>(field: K, value: (typeof createForm)[K]) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    clearCreateFieldError(field as AdminUserCreateField);
  }

  function openCreateModal() {
    resetFeedback();
    setCreateFieldErrors({});
    setCreateForm({
      username: "",
      email: "",
      full_name: "",
      password: "",
      confirmPassword: "",
    });
    setCreateOpen(true);
  }

  async function handleCreateUser() {
    resetFeedback();

    const fieldErrors = validateAdminCreateUserForm(createForm);
    if (hasAdminUserCreateFieldErrors(fieldErrors)) {
      setCreateFieldErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        const result = await createAdminUserAction(createForm);
        if (!result.success) {
          setCreateFieldErrors(result.fieldErrors);
          return;
        }

        setUsers((prev) => [...prev, result.user].sort((a, b) => a.id - b.id));
        setCreateOpen(false);
        setCreateFieldErrors({});
        announce(
          "success",
          "تم إنشاء المستخدم",
          `تم إنشاء المستخدم «${result.user.username}».`,
        );
      } catch (actionError) {
        announce(
          "danger",
          "تعذر إنشاء المستخدم",
          actionError instanceof Error
            ? actionError.message
            : "تعذر إنشاء المستخدم.",
        );
      }
    });
  }

  function openEditModal(user: AdminUserListItem) {
    resetFeedback();
    setConfirmEditStatus(false);
    setEditUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      full_name: user.full_name ?? "",
      is_active: user.is_active,
    });
    setEditPasswordForm({ password: "", confirmPassword: "" });
    setEditPasswordErrors({});
  }

  function clearEditPasswordFieldError(field: AdminUserEditPasswordField) {
    setEditPasswordErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateEditPasswordField(field: AdminUserEditPasswordField, value: string) {
    setEditPasswordForm((prev) => ({ ...prev, [field]: value }));
    clearEditPasswordFieldError(field);
  }

  function editFormIsValid() {
    if (!editUser) return false;
    const passwordFieldErrors =
      editUser.id === currentUserId
        ? {}
        : validateAdminOptionalPasswordFields(editPasswordForm.password, editPasswordForm.confirmPassword);

    if (hasAdminUserEditPasswordFieldErrors(passwordFieldErrors)) {
      setEditPasswordErrors(passwordFieldErrors);
      return false;
    }
    setEditPasswordErrors({});
    return true;
  }

  async function executeEditSave() {
    if (!editUser || editPending) return;
    resetFeedback();
    setEditPending(true);
    try {
      const updated = await updateAdminUserAction({
        id: editUser.id,
        ...editForm,
        ...(editUser.id !== currentUserId && editPasswordForm.password.trim()
          ? {
              password: editPasswordForm.password,
              confirmPassword: editPasswordForm.confirmPassword,
            }
          : {}),
      });
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setConfirmEditStatus(false);
      setEditUser(null);
      announce(
        "success",
        "تم تحديث المستخدم",
        `تم تحديث المستخدم «${updated.username}».`,
      );
    } catch (actionError) {
      announce(
        "danger",
        "تعذر تحديث المستخدم",
        actionError instanceof Error
          ? actionError.message
          : "تعذر تحديث المستخدم.",
      );
      throw actionError;
    } finally {
      setEditPending(false);
    }
  }

  function handleSaveEdit() {
    if (!editUser || editPending) return;
    resetFeedback();
    if (!editFormIsValid()) return;
    if (editForm.is_active !== editUser.is_active) {
      setConfirmEditStatus(true);
      return;
    }
    void executeEditSave().catch(() => undefined);
  }

  async function toggleUserActive(user: AdminUserListItem) {
    const nextActive = !user.is_active;
    const operationKey = `${user.id}:visibility`;
    resetFeedback();
    setRowPending(operationKey);
    try {
      const updated = await setAdminUserActiveAction(user.id, nextActive);
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      announce(
        "success",
        nextActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم",
        nextActive
          ? `تم تفعيل المستخدم «${updated.username}».`
          : `تم تعطيل المستخدم «${updated.username}» وإبطال جلساته.`,
      );
    } catch (actionError) {
      announce(
        "danger",
        "تعذر تحديث حالة المستخدم",
        actionError instanceof Error
          ? actionError.message
          : "تعذر تحديث حالة المستخدم.",
      );
      throw actionError;
    } finally {
      setRowPending(null);
    }
  }

  async function deleteUser(user: AdminUserListItem) {
    const operationKey = `${user.id}:delete`;
    resetFeedback();
    setRowPending(operationKey);
    try {
      const deleted = await deleteAdminUserAction(user.id);
      setUsers((current) =>
        current.filter((item) => item.id !== deleted.id),
      );
      setPage(
        resolveClientPagination(
          Math.max(0, filteredUsers.length - 1),
          page,
          pageSize,
          PAGE_SIZE_OPTIONS,
          10,
        ).page,
      );
      announce(
        "success",
        "تم حذف المستخدم",
        `تم حذف المستخدم «${deleted.username}».`,
      );
    } catch (actionError) {
      announce(
        "danger",
        "تعذر حذف المستخدم",
        actionError instanceof Error
          ? actionError.message
          : "تعذر حذف المستخدم.",
      );
      throw actionError;
    } finally {
      setRowPending(null);
    }
  }

  function getUserRowActions(
    user: AdminUserListItem,
  ): AdminRowActionsCapability {
    const isSelf = user.id === currentUserId;
    const visibilityPending = rowPending === `${user.id}:visibility`;
    const deletePending = rowPending === `${user.id}:delete`;
    const otherThanVisibilityPending = rowPending !== null && !visibilityPending;
    const otherThanDeletePending = rowPending !== null && !deletePending;
    const blockedReason = "انتظر انتهاء الإجراء الحالي.";

    return {
      entityType: "admin_user",
      entityId: user.id,
      entityLabel: user.username,
      actions: {
        edit: rowPending
          ? {
              access: "disabled",
              disabledReason: blockedReason,
              pending: visibilityPending || deletePending,
            }
          : { access: "allowed", onSelect: () => openEditModal(user) },
        preview: { access: "hidden" },
        information: {
          access: "allowed",
          title: "معلومات المستخدم",
          items: [
            { label: "اسم المستخدم", value: user.username },
            { label: "البريد الإلكتروني", value: user.email },
            { label: "الدور", value: roleLabel(user.role) },
            {
              label: "الحالة",
              value: user.is_active ? "نشط" : "موقوف",
            },
            { label: "آخر دخول", value: formatDate(user.last_login_at) },
          ],
        },
        copyPublicLink: { access: "hidden" },
        visibility: visibilityPending
          ? {
              access: "disabled",
              disabledReason: blockedReason,
              pending: true,
              isVisible: user.is_active,
            }
          : otherThanVisibilityPending
            ? {
                access: "disabled",
                disabledReason: blockedReason,
                isVisible: user.is_active,
              }
            : isSelf && user.is_active
              ? {
                  access: "disabled",
                  disabledReason: "لا يمكنك تعطيل حسابك الحالي.",
                  isVisible: true,
                }
              : {
                  access: "allowed",
                  isVisible: user.is_active,
                  onSelect: () => toggleUserActive(user),
                  confirmation: {
                    mode: "shared",
                    title: user.is_active
                      ? "تعطيل المستخدم؟"
                      : "تفعيل المستخدم؟",
                    description: user.is_active
                      ? `سيتم تعطيل «${user.username}» وإبطال جلساته فورًا.`
                      : `سيتم تفعيل «${user.username}» والسماح له بتسجيل الدخول وفق الصلاحيات الحالية.`,
                    confirmLabel: user.is_active
                      ? "تأكيد التعطيل"
                      : "تأكيد التفعيل",
                  },
                },
        featured: { access: "hidden" },
        duplicate: { access: "hidden" },
        archive: { access: "hidden" },
        delete: deletePending
          ? {
              access: "disabled",
              disabledReason: blockedReason,
              pending: true,
            }
          : otherThanDeletePending
            ? { access: "disabled", disabledReason: blockedReason }
            : isSelf
              ? {
                  access: "disabled",
                  disabledReason: "لا يمكنك حذف حسابك الحالي.",
                }
              : {
                  access: "allowed",
                  onSelect: () => deleteUser(user),
                  confirmation: {
                    mode: "shared",
                    title: "حذف المستخدم نهائيًا؟",
                    description: `سيتم حذف المستخدم «${user.username}» نهائيًا. لا يمكن التراجع عن هذا الإجراء.`,
                    confirmLabel: "تأكيد الحذف النهائي",
                  },
                },
      },
    };
  }

  return (
    <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
      <AdminPageHeader
        title="المستخدمون والصلاحيات"
        description="إدارة حسابات دخول لوحة التحكم. التعطيل هو الإجراء المعتمد بدل الحذف، ويتم إبطال جلسات المستخدم فورًا عند التعطيل أو تغيير بيانات الدخول."
        meta={`${users.length} مستخدم`}
        actions={
          <AdminActionButton variant="primary" onClick={openCreateModal}>
            إضافة مستخدم
          </AdminActionButton>
        }
      />

      <AdminFeedbackChannelViewport
        channel={FEEDBACK_CHANNEL}
        label="نتيجة إجراءات المستخدمين والصلاحيات"
      />

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="بحث باسم المستخدم أو البريد..."
            className={adminFormFieldClassName("max-w-xl")}
          />

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "الكل"],
                ["active", "نشط"],
                ["inactive", "موقوف"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  statusFilter === value
                    ? "border-[#D8B87A]/35 bg-[#D8B87A]/12 text-[#D8B87A]"
                    : "border-white/10 text-white/55 hover:border-[#D8B87A]/25 hover:text-[#D8B87A]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <AdminDataGrid
          summary={`${filteredUsers.length} نتيجة`}
          scrollLabel="جدول المستخدمين والصلاحيات"
        >
          <AdminDataGridHeader columns={columns}>
            <span>اسم المستخدم</span>
            <span>الدور</span>
            <span>الحالة</span>
            <span>آخر دخول</span>
            <span className="text-center">الإجراءات</span>
          </AdminDataGridHeader>

          {filteredUsers.length === 0 ? (
            <AdminDataGridEmpty>لا يوجد مستخدمون مطابقون للبحث أو الفلتر.</AdminDataGridEmpty>
          ) : (
            visibleUsers.map((user) => {
              return (
                <AdminDataGridRow key={user.id} columns={columns}>
                  <span className="font-semibold text-white">{user.username}</span>
                  <span className="text-white/65">{roleLabel(user.role)}</span>
                  <span>
                    <AdminStatusPill tone={user.is_active ? "green" : "muted"}>
                      {user.is_active ? "نشط" : "موقوف"}
                    </AdminStatusPill>
                  </span>
                  <span className="text-white/55">{formatDate(user.last_login_at)}</span>
                  <AdminDataGridRowActions
                    capability={getUserRowActions(user)}
                    size="compact"
                    sticky
                  />
                </AdminDataGridRow>
              );
            })
          )}
        </AdminDataGrid>

        <AdminTablePagination
          basePath="/admin/users-roles"
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={String(pagination.pageSize)}
          pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)}
          emptySummaryText="لا يوجد مستخدمون مطابقون"
          pending={rowPending !== null}
          className="mt-4"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </section>

      <VenesiaModal
        open={createOpen}
        title="إضافة مستخدم"
        description="إنشاء حساب أدمن جديد. الدور يُحفظ كبيانات metadata فقط (admin)."
        size="md"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setCreateOpen(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton disabled={isPending} onClick={handleCreateUser}>
              إنشاء المستخدم
            </AdminModalPrimaryButton>
          </>
        }
      >
        <div className={ADMIN_FORM.grid}>
          <FormFieldError error={createFieldErrors.username}>
            <input
              value={createForm.username}
              onChange={(event) => updateCreateFormField("username", event.target.value)}
              placeholder="اسم المستخدم"
              aria-invalid={Boolean(createFieldErrors.username)}
              className={fieldClassName(Boolean(createFieldErrors.username))}
            />
          </FormFieldError>
          <FormFieldError error={createFieldErrors.email}>
            <input
              type="email"
              value={createForm.email}
              onChange={(event) => updateCreateFormField("email", event.target.value)}
              placeholder="البريد الإلكتروني"
              aria-invalid={Boolean(createFieldErrors.email)}
              className={fieldClassName(Boolean(createFieldErrors.email), "font-en")}
            />
          </FormFieldError>
          <FormFieldError error={createFieldErrors.full_name}>
            <input
              value={createForm.full_name}
              onChange={(event) => updateCreateFormField("full_name", event.target.value)}
              placeholder="الاسم الكامل (اختياري)"
              aria-invalid={Boolean(createFieldErrors.full_name)}
              className={fieldClassName(Boolean(createFieldErrors.full_name))}
            />
          </FormFieldError>
          <FormFieldError error={createFieldErrors.password}>
            <input
              type="password"
              value={createForm.password}
              onChange={(event) => updateCreateFormField("password", event.target.value)}
              placeholder="كلمة المرور"
              aria-invalid={Boolean(createFieldErrors.password)}
              className={fieldClassName(Boolean(createFieldErrors.password))}
            />
          </FormFieldError>
          <FormFieldError error={createFieldErrors.confirmPassword}>
            <input
              type="password"
              value={createForm.confirmPassword}
              onChange={(event) => updateCreateFormField("confirmPassword", event.target.value)}
              placeholder="تأكيد كلمة المرور"
              aria-invalid={Boolean(createFieldErrors.confirmPassword)}
              className={fieldClassName(Boolean(createFieldErrors.confirmPassword))}
            />
          </FormFieldError>
        </div>
      </VenesiaModal>

      <VenesiaModal
        open={Boolean(editUser)}
        title="تعديل المستخدم"
        description={editUser ? `تعديل بيانات «${editUser.username}»` : undefined}
        size="md"
        onClose={() => {
          if (editPending) return;
          setConfirmEditStatus(false);
          setEditUser(null);
        }}
        footer={
          <>
            <AdminModalCancelButton
              disabled={editPending}
              onClick={() => {
                setConfirmEditStatus(false);
                setEditUser(null);
              }}
            >
              إلغاء
            </AdminModalCancelButton>
            <AdminModalPrimaryButton
              data-admin-users-edit-save=""
              disabled={isPending || editPending}
              onClick={handleSaveEdit}
            >
              حفظ التعديل
            </AdminModalPrimaryButton>
          </>
        }
      >
        <div className={ADMIN_FORM.grid}>
          <label className={adminFormLabelClassName()}>
            <span>اسم المستخدم</span>
            <input
              value={editForm.username}
              onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
              className={adminFormFieldClassName()}
            />
          </label>
          <label className={adminFormLabelClassName()}>
            <span>البريد الإلكتروني</span>
            <input
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              className={adminFormFieldClassName("font-en")}
            />
          </label>
          <label className={adminFormLabelClassName()}>
            <span>الاسم الكامل</span>
            <input
              value={editForm.full_name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))}
              className={adminFormFieldClassName()}
            />
          </label>
          <label className={adminFormLabelClassName()}>
            <span>الدور</span>
            <input
              value={editUser ? roleLabel(editUser.role) : "مدير"}
              readOnly
              disabled
              className={adminFormFieldClassName("text-white/55")}
            />
          </label>
          <label className={ADMIN_FORM.checkboxRow}>
            <span>الحالة</span>
            <input
              type="checkbox"
              checked={editForm.is_active}
              disabled={editUser?.id === currentUserId}
              onChange={(event) => setEditForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              className="h-4 w-4 accent-[#D8B87A]"
            />
          </label>
          {editUser?.id === currentUserId ? (
            <p className="text-xs text-white/45">لا يمكنك تعطيل حسابك الحالي من هنا.</p>
          ) : null}
        </div>

        <div className="mt-5 border-t border-white/8 pt-5">
          <h3 className="text-sm font-semibold text-white/80">تغيير كلمة المرور</h3>
          {editUser?.id === currentUserId ? (
            <p className="mt-2 text-xs leading-6 text-white/45">
              لتغيير كلمة مرورك استخدم صفحة الأمان في الإعدادات.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-6 text-white/45">
                اترك الحقول فارغة إذا كنت لا تريد تغيير كلمة المرور
              </p>
              <div className={`${ADMIN_FORM.grid} mt-4`}>
                <FormFieldError error={editPasswordErrors.password}>
                  <label className={adminFormLabelClassName()}>
                    <span>كلمة المرور الجديدة</span>
                    <input
                      type="password"
                      value={editPasswordForm.password}
                      onChange={(event) => updateEditPasswordField("password", event.target.value)}
                      aria-invalid={Boolean(editPasswordErrors.password)}
                      className={fieldClassName(Boolean(editPasswordErrors.password))}
                    />
                  </label>
                </FormFieldError>
                <FormFieldError error={editPasswordErrors.confirmPassword}>
                  <label className={adminFormLabelClassName()}>
                    <span>تأكيد كلمة المرور</span>
                    <input
                      type="password"
                      value={editPasswordForm.confirmPassword}
                      onChange={(event) => updateEditPasswordField("confirmPassword", event.target.value)}
                      aria-invalid={Boolean(editPasswordErrors.confirmPassword)}
                      className={fieldClassName(Boolean(editPasswordErrors.confirmPassword))}
                    />
                  </label>
                </FormFieldError>
              </div>
            </>
          )}
        </div>
      </VenesiaModal>

      <AdminConfirmDialog
        open={confirmEditStatus && Boolean(editUser)}
        title={editForm.is_active ? "تفعيل المستخدم ضمن حفظ التعديلات؟" : "تعطيل المستخدم ضمن حفظ التعديلات؟"}
        description={
          editForm.is_active
            ? `سيتم حفظ تعديلات «${editUser?.username ?? "المستخدم"}» وتفعيل الحساب وفق الصلاحيات الحالية.`
            : `سيتم حفظ تعديلات «${editUser?.username ?? "المستخدم"}» وتعطيل الحساب وإبطال جلساته الحالية.`
        }
        confirmLabel={editForm.is_active ? "حفظ وتفعيل المستخدم" : "حفظ وتعطيل المستخدم"}
        pending={editPending}
        resolveReturnFocus={() =>
          document.querySelector<HTMLButtonElement>("[data-admin-users-edit-save]")
        }
        onCancel={() => setConfirmEditStatus(false)}
        onConfirm={executeEditSave}
      />

      <p className="text-xs text-white/35">
        المستخدم الحالي: <span className="text-white/55">{currentUsername}</span>
      </p>
    </div>
  );
}
