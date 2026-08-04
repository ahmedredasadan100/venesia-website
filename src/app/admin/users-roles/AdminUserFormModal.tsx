"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import {
  AdminConfirmDialog,
  AdminFormField,
  AdminFormGrid,
  AdminFormSwitch,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../components/admin/ui";
import AdminFormRuntime, {
  AdminFormError,
  type AdminFormRuntimeHandle,
} from "../../../components/admin/ui/AdminFormRuntime";
import type { AdminFormActionState } from "../../../lib/admin/form-runtime";
import type { AdminUserEntityListRow } from "../../../lib/admin/users/entity-list-contract";

import {
  createAdminUserFormAction,
  updateAdminUserFormAction,
} from "./actions";

type AdminUserFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  user?: AdminUserEntityListRow;
  currentUserId: number;
  onClose: () => void;
  onSaved: (user: AdminUserEntityListRow) => void;
};

function roleLabel(role: string) {
  return role === "admin" ? "مدير" : role;
}

function getForm(formId: string) {
  return document.getElementById(formId) as HTMLFormElement | null;
}

export default function AdminUserFormModal({
  open,
  mode,
  user,
  currentUserId,
  onClose,
  onSaved,
}: AdminUserFormModalProps) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);
  const [confirmedActiveStatus, setConfirmedActiveStatus] = useState<
    boolean | null
  >(null);
  const [activeStatus, setActiveStatus] = useState(user?.is_active ?? true);
  const formId = `admin-user-form-${mode}`;
  const action =
    mode === "create"
      ? createAdminUserFormAction
      : updateAdminUserFormAction;
  const editingSelf = mode === "edit" && user?.id === currentUserId;

  function requestClose() {
    if (confirmStatusChange) {
      setConfirmStatusChange(false);
      setConfirmedActiveStatus(null);
      return;
    }
    runtimeRef.current?.requestClose();
  }

  function handleSuccess(
    state: AdminFormActionState<AdminUserEntityListRow>,
  ) {
    if (!state.result) return;
    onSaved(state.result);
    onClose();
  }

  function requestEditSubmit() {
    const form = getForm(formId);
    if (!form || !user) return;
    if (activeStatus !== user.is_active) {
      setConfirmedActiveStatus(activeStatus);
      setConfirmStatusChange(true);
      return;
    }
    form.requestSubmit();
  }

  function handleEditKeyboardSubmit(event: KeyboardEvent<HTMLDivElement>) {
    if (
      mode !== "edit" ||
      confirmStatusChange ||
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLButtonElement
    ) {
      return;
    }
    event.preventDefault();
    requestEditSubmit();
  }

  return (
    <VenesiaModal
      open={open}
      title={mode === "create" ? "إضافة مستخدم" : "تعديل المستخدم"}
      description={
        mode === "create"
          ? "إنشاء حساب أدمن جديد بالدور الحالي المعتمد."
          : user
            ? `تعديل بيانات «${user.username}» دون تغيير عقد الصلاحيات.`
            : undefined
      }
      size="md"
      onClose={requestClose}
    >
      <AdminFormRuntime<AdminUserEntityListRow>
        key={`${mode}:${user?.id ?? "new"}`}
        action={action}
        mode={mode}
        entityKey={`admin-user:${mode}:${user?.id ?? "new"}`}
        onClose={onClose}
        onSuccess={handleSuccess}
        runtimeRef={runtimeRef}
        formId={formId}
        className="space-y-5"
      >
        {({ fieldErrors, pending, requestClose: requestRuntimeClose }) => (
          <div onKeyDown={handleEditKeyboardSubmit}>
            {mode === "edit" && user ? (
              <input type="hidden" name="id" value={user.id} />
            ) : null}

            <AdminFormGrid columns={1}>
              <AdminFormField label="اسم المستخدم" required>
                <input
                  name="username"
                  defaultValue={user?.username ?? ""}
                  placeholder="اسم المستخدم"
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.username?.length)}
                  aria-describedby={
                    fieldErrors.username?.length
                      ? "username-error"
                      : undefined
                  }
                  className={adminFormFieldClassName(
                    fieldErrors.username?.length
                      ? "border-red-400/40"
                      : "",
                  )}
                />
                <AdminFormError name="username" />
              </AdminFormField>

              <AdminFormField label="البريد الإلكتروني" required>
                <input
                  type="email"
                  name="email"
                  defaultValue={user?.email ?? ""}
                  placeholder="admin@example.com"
                  required
                  autoComplete="off"
                  dir="ltr"
                  aria-invalid={Boolean(fieldErrors.email?.length)}
                  aria-describedby={
                    fieldErrors.email?.length ? "email-error" : undefined
                  }
                  className={adminFormFieldClassName(
                    `${fieldErrors.email?.length ? "border-red-400/40" : ""} font-en`,
                  )}
                />
                <AdminFormError name="email" />
              </AdminFormField>

              <AdminFormField label="الاسم الكامل">
                <input
                  name="full_name"
                  defaultValue={user?.full_name ?? ""}
                  placeholder="الاسم الكامل (اختياري)"
                  aria-invalid={Boolean(fieldErrors.full_name?.length)}
                  aria-describedby={
                    fieldErrors.full_name?.length
                      ? "full_name-error"
                      : undefined
                  }
                  className={adminFormFieldClassName(
                    fieldErrors.full_name?.length
                      ? "border-red-400/40"
                      : "",
                  )}
                />
                <AdminFormError name="full_name" />
              </AdminFormField>

              {mode === "edit" && user ? (
                <>
                  <AdminFormField
                    label="الدور"
                    hint="معروض للقراءة فقط؛ هذه المرحلة لا تغيّر عقد الصلاحيات."
                  >
                    <input
                      value={roleLabel(user.role)}
                      readOnly
                      disabled
                      className={adminFormFieldClassName("text-white/55")}
                    />
                  </AdminFormField>

                  <AdminFormSwitch
                    name="is_active"
                    label="الحساب نشط ويمكنه تسجيل الدخول"
                    checked={activeStatus}
                    onChange={(event) => setActiveStatus(event.target.checked)}
                    disabled={editingSelf}
                    value="true"
                    uncheckedValue={editingSelf ? String(user.is_active) : "false"}
                    surface
                    describedBy={editingSelf ? "admin-user-self-status" : undefined}
                  />
                  {editingSelf ? (
                    <p
                      id="admin-user-self-status"
                      className="text-xs text-white/45"
                    >
                      لا يمكنك تعطيل حسابك الحالي من هنا.
                    </p>
                  ) : null}
                </>
              ) : null}

              {mode === "create" || !editingSelf ? (
                <>
                  <AdminFormField
                    label={
                      mode === "create"
                        ? "كلمة المرور"
                        : "كلمة المرور الجديدة"
                    }
                    hint={
                      mode === "edit"
                        ? "اترك الحقلين فارغين إذا كنت لا تريد تغيير كلمة المرور."
                        : undefined
                    }
                    required={mode === "create"}
                  >
                    <input
                      type="password"
                      name="password"
                      required={mode === "create"}
                      autoComplete="new-password"
                      aria-invalid={Boolean(fieldErrors.password?.length)}
                      aria-describedby={
                        fieldErrors.password?.length
                          ? "password-error"
                          : undefined
                      }
                      className={adminFormFieldClassName(
                        fieldErrors.password?.length
                          ? "border-red-400/40"
                          : "",
                      )}
                    />
                    <AdminFormError name="password" />
                  </AdminFormField>

                  <AdminFormField
                    label="تأكيد كلمة المرور"
                    required={mode === "create"}
                  >
                    <input
                      type="password"
                      name="confirmPassword"
                      required={mode === "create"}
                      autoComplete="new-password"
                      aria-invalid={Boolean(
                        fieldErrors.confirmPassword?.length,
                      )}
                      aria-describedby={
                        fieldErrors.confirmPassword?.length
                          ? "confirmPassword-error"
                          : undefined
                      }
                      className={adminFormFieldClassName(
                        fieldErrors.confirmPassword?.length
                          ? "border-red-400/40"
                          : "",
                      )}
                    />
                    <AdminFormError name="confirmPassword" />
                  </AdminFormField>
                </>
              ) : null}
            </AdminFormGrid>

            {mode === "edit" && editingSelf ? (
              <p className="mt-4 text-xs leading-6 text-white/45">
                لتغيير كلمة مرورك استخدم صفحة الأمان في الإعدادات.
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminModalCancelButton
                type="button"
                onClick={requestRuntimeClose}
                disabled={pending}
              >
                إلغاء
              </AdminModalCancelButton>
              <AdminModalPrimaryButton
                type={mode === "create" ? "submit" : "button"}
                data-admin-users-edit-save={mode === "edit" ? "" : undefined}
                disabled={pending || confirmStatusChange}
                onClick={mode === "edit" ? requestEditSubmit : undefined}
              >
                {pending
                  ? "جارٍ الحفظ…"
                  : mode === "create"
                    ? "إنشاء المستخدم"
                    : "حفظ التعديل"}
              </AdminModalPrimaryButton>
            </div>

            {mode === "edit" && user ? (
              <AdminConfirmDialog
                open={confirmStatusChange}
                title={
                  confirmedActiveStatus
                    ? "تفعيل المستخدم ضمن حفظ التعديلات؟"
                    : "تعطيل المستخدم ضمن حفظ التعديلات؟"
                }
                description={
                  confirmedActiveStatus
                    ? `سيتم حفظ تعديلات «${user.username}» وتفعيل الحساب وفق الصلاحيات الحالية.`
                    : `سيتم حفظ تعديلات «${user.username}» وتعطيل الحساب وإبطال جلساته الحالية.`
                }
                confirmLabel={
                  confirmedActiveStatus
                    ? "حفظ وتفعيل المستخدم"
                    : "حفظ وتعطيل المستخدم"
                }
                pending={pending}
                resolveReturnFocus={() =>
                  document.querySelector<HTMLButtonElement>(
                    "[data-admin-users-edit-save]",
                  )
                }
                onCancel={() => {
                  setConfirmStatusChange(false);
                  setConfirmedActiveStatus(null);
                }}
                onConfirm={() => {
                  setConfirmStatusChange(false);
                  setConfirmedActiveStatus(null);
                  getForm(formId)?.requestSubmit();
                }}
              />
            ) : null}
          </div>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}
