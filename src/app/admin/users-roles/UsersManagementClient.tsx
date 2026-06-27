"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";

import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../components/admin/VenesiaModal";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  AdminActionButton,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../components/admin/ui";
import { ADMIN_LIST_PAGE } from "../../../lib/admin/admin-ui-styles";
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

const columns = `minmax(140px,1.4fr) 90px 100px minmax(120px,1fr) ${ADMIN_DATA_GRID_ACTION_COLUMNS.three}`;

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
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    resetAlerts();
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
    resetAlerts();

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
        setMessage(`تم إنشاء المستخدم «${result.user.username}».`);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "تعذر إنشاء المستخدم.");
      }
    });
  }

  function resetAlerts() {
    setMessage(null);
    setError(null);
  }

  function openEditModal(user: AdminUserListItem) {
    resetAlerts();
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

  async function handleSaveEdit() {
    if (!editUser) return;
    resetAlerts();

    const passwordFieldErrors =
      editUser.id === currentUserId
        ? {}
        : validateAdminOptionalPasswordFields(editPasswordForm.password, editPasswordForm.confirmPassword);

    if (hasAdminUserEditPasswordFieldErrors(passwordFieldErrors)) {
      setEditPasswordErrors(passwordFieldErrors);
      return;
    }
    setEditPasswordErrors({});

    startTransition(async () => {
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
        setEditUser(null);
        setMessage(`تم تحديث المستخدم «${updated.username}».`);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "تعذر تحديث المستخدم.");
      }
    });
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

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
                onClick={() => setStatusFilter(value)}
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

        <AdminDataGrid summary={`${filteredUsers.length} نتيجة`}>
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
            filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
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
                  <AdminDataGridActionsCell>
                    <AdminDataGridActionButton action="edit" title="تعديل" onClick={() => openEditModal(user)} />
                    <AdminDataGridActionButton
                      action="visibility"
                      hidden={!user.is_active}
                      title={user.is_active ? "تعطيل" : "تفعيل"}
                      disabled={isSelf && user.is_active}
                      onClick={() => {
                        resetAlerts();
                        const nextActive = !user.is_active;
                        const confirmText = nextActive
                          ? `تفعيل المستخدم «${user.username}»؟`
                          : `تعطيل المستخدم «${user.username}»؟ سيتم إبطال جلساته فورًا.`;
                        if (!window.confirm(confirmText)) return;

                        startTransition(async () => {
                          try {
                            const updated = await setAdminUserActiveAction(user.id, nextActive);
                            setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                            setMessage(
                              nextActive ? "تم تفعيل المستخدم." : "تم تعطيل المستخدم وإبطال جلساته.",
                            );
                          } catch (actionError) {
                            setError(
                              actionError instanceof Error ? actionError.message : "تعذر تحديث حالة المستخدم.",
                            );
                          }
                        });
                      }}
                    />
                    <AdminDataGridActionButton
                      action="delete"
                      title="حذف"
                      disabled={isSelf}
                      onClick={() => {
                        resetAlerts();
                        if (
                          !window.confirm(
                            `حذف المستخدم «${user.username}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`,
                          )
                        ) {
                          return;
                        }

                        startTransition(async () => {
                          try {
                            const deleted = await deleteAdminUserAction(user.id);
                            setUsers((prev) => prev.filter((item) => item.id !== deleted.id));
                            setMessage(`تم حذف المستخدم «${deleted.username}».`);
                          } catch (actionError) {
                            setError(actionError instanceof Error ? actionError.message : "تعذر حذف المستخدم.");
                          }
                        });
                      }}
                    />
                  </AdminDataGridActionsCell>
                </AdminDataGridRow>
              );
            })
          )}
        </AdminDataGrid>
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
        onClose={() => setEditUser(null)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setEditUser(null)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton disabled={isPending} onClick={handleSaveEdit}>
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

      <p className="text-xs text-white/35">
        المستخدم الحالي: <span className="text-white/55">{currentUsername}</span>
      </p>
    </div>
  );
}
