"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AdminFormActions, AdminFormPendingFields } from "../../../../components/admin/ui/AdminFormRuntime";
import { AdminStickyFormBar } from "../../../../components/admin/ui/AdminForm";
import { shouldAcceptAdminFormSource } from "../../../../lib/admin/form-runtime";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminModuleTabs, { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../../../components/admin/ui/AdminModuleTabs";
import {
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminActionButton,
  AdminCard,
  AdminConfirmDialog,
  AdminFormField,
  AdminFormGrid,
  AdminFormSection,
  AdminPageContextHeader,
  AdminPageExperience,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import {
  hasAdminSelfAccountFieldErrors,
  normalizeAdminEmail,
  validateAdminSelfAccountForm,
  type AdminSelfAccountField,
  type AdminSelfAccountFieldErrors,
} from "../../../../lib/admin/users/admin-users-validation";
import { formatAdminDateTime } from "../../../../lib/content-dates";

import {
  changeAdminPasswordAction,
  revokeAllAdminSessionsAction,
  updateAdminSelfAccountAction,
} from "./actions";

type SecuritySettingsClientProps = {
  username: string;
  email: string;
  fullName: string | null;
  lastLoginAt: string | null;
};

const FEEDBACK_CHANNEL = "settings-security";

const fieldClassName = adminFormFieldClassName();

function fieldClassNameWithError(hasError: boolean) {
  return adminFormFieldClassName(hasError ? "border-red-400/40 bg-red-500/[0.03] focus:border-red-400/55" : "");
}

export default function SecuritySettingsClient({
  username,
  email,
  fullName,
  lastLoginAt,
}: SecuritySettingsClientProps) {
  const router = useRouter();
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [accountForm, setAccountForm] = useState({
    full_name: fullName ?? "",
    email,
    currentPassword: "",
  });
  const [savedEmail, setSavedEmail] = useState(email);
  const [accountFieldErrors, setAccountFieldErrors] = useState<AdminSelfAccountFieldErrors>({});
  const [revokePassword, setRevokePassword] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const revokeTriggerRef = useRef<HTMLButtonElement>(null);

  const accountPropsKey = JSON.stringify([email, fullName ?? ""]);
  const [savedAccountKey, setSavedAccountKey] = useState(accountPropsKey);
  const [lastAccountPropsKey, setLastAccountPropsKey] = useState(accountPropsKey);
  if (accountPropsKey !== lastAccountPropsKey) {
    setLastAccountPropsKey(accountPropsKey);
    if (shouldAcceptAdminFormSource({ pending: isPending,
      dirty: JSON.stringify([accountForm.email, accountForm.full_name]) !== savedAccountKey })) {
      setAccountForm((prev) => ({ ...prev, full_name: fullName ?? "", email }));
      setSavedAccountKey(accountPropsKey);
    }
    setSavedEmail(email);
  }

  const emailChanged = normalizeAdminEmail(accountForm.email) !== normalizeAdminEmail(savedEmail);

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

  async function revokeAllSessions() {
    resetFeedback();
    setRevokePending(true);
    try {
      await revokeAllAdminSessionsAction(revokePassword);
      router.replace("/admin/login");
      router.refresh();
    } catch (actionError) {
      announce(
        "danger",
        "تعذر إلغاء الجلسات",
        actionError instanceof Error
          ? actionError.message
          : "تعذر إلغاء الجلسات.",
      );
      throw actionError;
    } finally {
      setRevokePending(false);
    }
  }

  function clearAccountFieldError(field: AdminSelfAccountField) {
    setAccountFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateAccountField(field: keyof typeof accountForm, value: string) {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
    if (field === "full_name" || field === "email" || field === "currentPassword") {
      clearAccountFieldError(field);
    }
  }

  const tabs = [
    {
      id: "password",
      navigationLabel: "كلمة المرور",
      sectionHeading: "تغيير كلمة المرور",
      sectionDescription: "عيّن كلمة مرور جديدة بعد التحقق من كلمة المرور الحالية.",
      icon: "settings" as const,
      content: (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              resetFeedback();
              if (passwordForm.next !== passwordForm.confirm) {
                announce(
                  "danger",
                  "تعذر حفظ كلمة المرور",
                  "تأكيد كلمة المرور غير متطابق.",
                );
                return;
              }
              startTransition(async () => {
                try {
                  await changeAdminPasswordAction(passwordForm.current, passwordForm.next);
                  setPasswordForm({ current: "", next: "", confirm: "" });
                  announce(
                    "success",
                    "تم تحديث كلمة المرور",
                    "تم تحديث كلمة المرور بنجاح.",
                  );
                  router.refresh();
                } catch (actionError) {
                  announce(
                    "danger",
                    "تعذر تحديث كلمة المرور",
                    actionError instanceof Error
                      ? actionError.message
                      : "تعذر تحديث كلمة المرور.",
                  );
                }
              });
            }}
          >
            <AdminFormPendingFields pending={isPending}>
              <div className={ADMIN_FORM_STACK_CLASS_NAME}>
              <AdminFormGrid columnRatio="3:2" presentation="equal-height-columns">
              <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id="security-password" sectionHeading="تغيير كلمة المرور" sectionDescription="عيّن كلمة مرور جديدة بعد التحقق من كلمة المرور الحالية." icon="settings" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>
              <AdminFormGrid columns={1}>
            <AdminFormField label="كلمة المرور الحالية" required presentation="panel">
            <input
              type="password"
              required
              value={passwordForm.current}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))}
              placeholder="كلمة المرور الحالية"
              className={fieldClassName}
            />
            </AdminFormField>
            <AdminFormField label="كلمة المرور الجديدة" required presentation="panel">
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.next}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))}
              placeholder="كلمة المرور الجديدة"
              className={fieldClassName}
            />
            </AdminFormField>
            <AdminFormField label="تأكيد كلمة المرور الجديدة" required presentation="panel">
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.confirm}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))}
              placeholder="تأكيد كلمة المرور الجديدة"
              className={fieldClassName}
            />
            </AdminFormField>
              </AdminFormGrid>
              </AdminFormSection>
              <div aria-hidden="true" className="hidden md:grid"><AdminCard presentation="premium">{null}</AdminCard></div>
              </AdminFormGrid>
              <AdminFormActions pending={isPending} showClose={false} title="إجراءات النموذج" submitLabel="حفظ كلمة المرور" description={null} icon={<AdminModuleTabIcon name="content" />} />
              </div>
            </AdminFormPendingFields>
          </form>
      ),
    },
    {
      id: "account",
      navigationLabel: "بيانات الحساب",
      sectionHeading: "بيانات الحساب الحالي",
      sectionDescription: "حدّث الاسم الكامل والبريد الإلكتروني؛ تغيير البريد يتطلب كلمة المرور الحالية.",
      icon: "content" as const,
      content: (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (isPending) return;
              resetFeedback();
              setAccountFieldErrors({});

              const fieldErrors = validateAdminSelfAccountForm({
                ...accountForm,
                originalEmail: savedEmail,
              });
              if (hasAdminSelfAccountFieldErrors(fieldErrors)) {
                setAccountFieldErrors(fieldErrors);
                announce(
                  "danger",
                  "راجع بيانات الحساب",
                  "تحقق من الحقول الموضحة ثم أعد المحاولة.",
                );
                return;
              }

              startTransition(async () => {
                try {
                  const result = await updateAdminSelfAccountAction(accountForm);
                  if (!result.success) {
                    setAccountFieldErrors(result.fieldErrors);
                    announce(
                      "danger",
                      "تعذر حفظ بيانات الحساب",
                      "تحقق من الحقول الموضحة ثم أعد المحاولة.",
                    );
                    return;
                  }

                  setAccountForm({
                    full_name: result.fullName ?? "",
                    email: result.email,
                    currentPassword: "",
                  });
                  setSavedEmail(result.email);
                  setSavedAccountKey(JSON.stringify([result.email, result.fullName ?? ""]));
                  setAccountFieldErrors({});
                  announce(
                    "success",
                    "تم حفظ بيانات الحساب",
                    "تم حفظ بيانات الحساب بنجاح.",
                  );
                  router.refresh();
                } catch (actionError) {
                  announce(
                    "danger",
                    "تعذر حفظ بيانات الحساب",
                    actionError instanceof Error
                      ? actionError.message
                      : "تعذر حفظ بيانات الحساب.",
                  );
                }
              });
            }}
          >
            <AdminFormPendingFields pending={isPending}>
              <div className={ADMIN_FORM_STACK_CLASS_NAME}>
              <AdminFormGrid columnRatio="3:2" presentation="equal-height-columns">
              <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id="security-account" sectionHeading="بيانات الحساب الحالي" sectionDescription="حدّث الاسم الكامل والبريد الإلكتروني؛ تغيير البريد يتطلب كلمة المرور الحالية." icon="content" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>
              <AdminFormGrid columns={1}>
              <AdminFormField label="اسم المستخدم" presentation="panel" hint="لا يمكن تغيير اسم المستخدم من هذه الصفحة.">
                  <p className={fieldClassName} dir="ltr">
                    {username}
                  </p>
              </AdminFormField>

              <AdminFormField label="الاسم الكامل" presentation="panel" error={accountFieldErrors.full_name}>
                  <input
                    type="text"
                    value={accountForm.full_name}
                    onChange={(event) => updateAccountField("full_name", event.target.value)}
                    placeholder="الاسم الكامل"
                    aria-invalid={Boolean(accountFieldErrors.full_name)}
                    className={fieldClassNameWithError(Boolean(accountFieldErrors.full_name))}
                  />
              </AdminFormField>

              <AdminFormField label="البريد الإلكتروني" presentation="panel" error={accountFieldErrors.email}>
                  <input
                    type="email"
                    value={accountForm.email}
                    onChange={(event) => updateAccountField("email", event.target.value)}
                    placeholder="البريد الإلكتروني"
                    aria-invalid={Boolean(accountFieldErrors.email)}
                    className={`${fieldClassNameWithError(Boolean(accountFieldErrors.email))} font-en`}
                    dir="ltr"
                  />
              </AdminFormField>

              {emailChanged ? (
                <AdminFormField label="كلمة المرور الحالية" presentation="panel" error={accountFieldErrors.currentPassword}>
                    <input
                      type="password"
                      value={accountForm.currentPassword}
                      onChange={(event) => updateAccountField("currentPassword", event.target.value)}
                      placeholder="مطلوبة لتأكيد تغيير البريد"
                      aria-invalid={Boolean(accountFieldErrors.currentPassword)}
                      className={fieldClassNameWithError(Boolean(accountFieldErrors.currentPassword))}
                    />
                </AdminFormField>
              ) : null}

              </AdminFormGrid>
              </AdminFormSection>
              <div aria-hidden="true" className="hidden md:grid"><AdminCard presentation="premium">{null}</AdminCard></div>
              </AdminFormGrid>
              <AdminFormActions pending={isPending} showClose={false} title="إجراءات النموذج" submitLabel="حفظ بيانات الحساب" description={null} icon={<AdminModuleTabIcon name="content" />} />
              </div>
            </AdminFormPendingFields>
          </form>
      ),
    },
    {
      id: "sessions",
      navigationLabel: "الأمان والجلسات",
      sectionHeading: "الأمان والجلسات",
      sectionDescription: "راجع آخر دخول وأدر الجلسات النشطة للحساب الحالي.",
      icon: "publish" as const,
      content: (
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id="security-sessions" sectionHeading="الأمان والجلسات" sectionDescription="راجع آخر دخول وأدر الجلسات النشطة للحساب الحالي." icon="publish" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>
            <AdminFormGrid columns={1}>
              <p>
                <span className="text-white/45">آخر دخول: </span>
                <span className="text-white/80">{formatAdminDateTime(lastLoginAt)}</span>
              </p>
              <p className="leading-7 text-white/45">
                عند تغيير كلمة المرور أو البريد أو إلغاء الجلسات، يتم إبطال الجلسات النشطة الأخرى حسب
                السياسة الحالية للنظام.
              </p>
            </AdminFormGrid>
          </AdminFormSection>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                resetFeedback();
                setConfirmRevoke(true);
              }}
            >
              <AdminFormPendingFields pending={isPending || revokePending}>
                <div className={ADMIN_FORM_STACK_CLASS_NAME}>
                <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id="security-revoke-sessions" sectionHeading="تسجيل الخروج من جميع الجلسات" sectionDescription="يلغي جميع الجلسات النشطة على الأجهزة الأخرى ويُخرجك من الجلسة الحالية." icon="security" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>
                <AdminFormGrid columns={1}>
              <AdminFormField label="كلمة المرور الحالية" required presentation="panel">
              <input
                type="password"
                required
                value={revokePassword}
                onChange={(event) => setRevokePassword(event.target.value)}
                placeholder="كلمة المرور الحالية"
                className={fieldClassName}
              />
              </AdminFormField>
                </AdminFormGrid>
                </AdminFormSection>
                <AdminStickyFormBar title="إجراءات النموذج" description={null} icon={<AdminModuleTabIcon name="content" />}>
              <AdminActionButton
                buttonRef={revokeTriggerRef}
                type="submit"
                disabled={isPending || revokePending}
                variant="danger"
              >
                إلغاء جميع الجلسات
              </AdminActionButton>
                </AdminStickyFormBar>
                </div>
              </AdminFormPendingFields>
            </form>
        </div>
      ),
    },
  ];

  return (
    <AdminPageExperience as="div" className="pb-10" dir="rtl">
      <AdminPageContextHeader
        visualPreset="security"
        eyebrow="ADMIN SETTINGS"
        title="الأمان"
        description="إدارة بيانات الدخول للحساب الحالي. يُشترط إدخال كلمة المرور الحالية قبل أي تغيير حساس."
      />

      <AdminModuleTabs
        tabs={tabs.map(tab => ({ ...tab, sectionHeading: undefined, sectionDescription: undefined }))}
        activePanelContext={
          <AdminFeedbackChannelViewport
            channel={FEEDBACK_CHANNEL}
            label="نتيجة إجراءات إعدادات الأمان"
          />
        }
      />

      <AdminConfirmDialog
        open={confirmRevoke}
        title="إلغاء جميع الجلسات؟"
        description="سيتم إلغاء جميع الجلسات النشطة، بما فيها الجلسة الحالية، ثم إعادتك إلى صفحة تسجيل الدخول."
        confirmLabel="إلغاء جميع الجلسات"
        pending={revokePending}
        returnFocusRef={revokeTriggerRef}
        onCancel={() => setConfirmRevoke(false)}
        onConfirm={revokeAllSessions}
      />
    </AdminPageExperience>
  );
}
