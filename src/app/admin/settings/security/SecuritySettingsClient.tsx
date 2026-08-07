"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminModuleTabs from "../../../../components/admin/ui/AdminModuleTabs";
import {
  AdminConfirmDialog,
  AdminPageContextHeader,
} from "../../../../components/admin/ui";
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

const fieldClassName =
  "w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-white outline-none focus:border-[#D8B87A]/45";

function fieldClassNameWithError(hasError: boolean) {
  return [
    fieldClassName,
    hasError ? "border-red-400/40 bg-red-500/[0.03] focus:border-red-400/55" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function FormFieldError({ error, children }: { error?: string; children: ReactNode }) {
  return (
    <div>
      {children}
      {error ? <p className="mt-1 text-right text-[11px] leading-5 text-red-300/90">{error}</p> : null}
    </div>
  );
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

  const accountPropsKey = `${email}|${fullName ?? ""}`;
  const [lastAccountPropsKey, setLastAccountPropsKey] = useState(accountPropsKey);
  if (accountPropsKey !== lastAccountPropsKey) {
    setLastAccountPropsKey(accountPropsKey);
    setAccountForm((prev) => ({
      ...prev,
      full_name: fullName ?? "",
      email,
    }));
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
      window.location.href = "/admin/login";
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
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
          <form
            className="grid max-w-xl gap-4"
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
            <input
              type="password"
              required
              value={passwordForm.current}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))}
              placeholder="كلمة المرور الحالية"
              className={fieldClassName}
            />
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.next}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))}
              placeholder="كلمة المرور الجديدة"
              className={fieldClassName}
            />
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.confirm}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))}
              placeholder="تأكيد كلمة المرور الجديدة"
              className={fieldClassName}
            />
            <button
              type="submit"
              disabled={isPending}
              className="w-fit rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A] px-5 py-3 text-sm font-semibold text-[#06101C] disabled:opacity-60"
            >
              حفظ كلمة المرور
            </button>
          </form>
        </section>
      ),
    },
    {
      id: "account",
      navigationLabel: "بيانات الحساب",
      sectionHeading: "بيانات الحساب الحالي",
      sectionDescription: "حدّث الاسم الكامل والبريد الإلكتروني؛ تغيير البريد يتطلب كلمة المرور الحالية.",
      icon: "content" as const,
      content: (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
          <form
            className="grid max-w-xl gap-4"
            onSubmit={(event) => {
              event.preventDefault();
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
            <div className="space-y-2 text-right">
              <span className="block text-xs font-medium text-white/48">اسم المستخدم</span>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-sm text-white/85" dir="ltr">
                  {username}
                </p>
              </div>
              <p className="text-[11px] leading-5 text-white/45">
                لا يمكن تغيير اسم المستخدم من هذه الصفحة.
              </p>
            </div>

            <label className="block space-y-2 text-right text-xs font-medium text-white/48">
              <span>الاسم الكامل</span>
              <FormFieldError error={accountFieldErrors.full_name}>
                <input
                  type="text"
                  value={accountForm.full_name}
                  onChange={(event) => updateAccountField("full_name", event.target.value)}
                  placeholder="الاسم الكامل"
                  aria-invalid={Boolean(accountFieldErrors.full_name)}
                  className={fieldClassNameWithError(Boolean(accountFieldErrors.full_name))}
                />
              </FormFieldError>
            </label>

            <label className="block space-y-2 text-right text-xs font-medium text-white/48">
              <span>البريد الإلكتروني</span>
              <FormFieldError error={accountFieldErrors.email}>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => updateAccountField("email", event.target.value)}
                  placeholder="البريد الإلكتروني"
                  aria-invalid={Boolean(accountFieldErrors.email)}
                  className={`${fieldClassNameWithError(Boolean(accountFieldErrors.email))} font-en`}
                  dir="ltr"
                />
              </FormFieldError>
            </label>

            {emailChanged ? (
              <label className="block space-y-2 text-right text-xs font-medium text-white/48">
                <span>كلمة المرور الحالية</span>
                <FormFieldError error={accountFieldErrors.currentPassword}>
                  <input
                    type="password"
                    value={accountForm.currentPassword}
                    onChange={(event) => updateAccountField("currentPassword", event.target.value)}
                    placeholder="مطلوبة لتأكيد تغيير البريد"
                    aria-invalid={Boolean(accountFieldErrors.currentPassword)}
                    className={fieldClassNameWithError(Boolean(accountFieldErrors.currentPassword))}
                  />
                </FormFieldError>
              </label>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-fit rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A] px-5 py-3 text-sm font-semibold text-[#06101C] disabled:opacity-60"
            >
              حفظ بيانات الحساب
            </button>
          </form>
        </section>
      ),
    },
    {
      id: "sessions",
      navigationLabel: "الأمان والجلسات",
      sectionHeading: "الأمان والجلسات",
      sectionDescription: "راجع آخر دخول وأدر الجلسات النشطة للحساب الحالي.",
      icon: "publish" as const,
      content: (
        <div className="space-y-5">
          <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
            <div className="grid max-w-xl gap-3 rounded-[22px] border border-white/10 bg-white/[0.02] p-4 text-sm text-white/62">
              <p>
                <span className="text-white/45">آخر دخول: </span>
                <span className="text-white/80">{formatAdminDateTime(lastLoginAt)}</span>
              </p>
              <p className="leading-7 text-white/45">
                عند تغيير كلمة المرور أو البريد أو إلغاء الجلسات، يتم إبطال الجلسات النشطة الأخرى حسب
                السياسة الحالية للنظام.
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-red-400/15 bg-red-500/5 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-red-100">تسجيل الخروج من جميع الجلسات</h2>
            <p className="mt-2 text-sm leading-7 text-red-100/70">
              يلغي جميع الجلسات النشطة على الأجهزة الأخرى ويُخرجك من الجلسة الحالية.
            </p>
            <form
              className="mt-5 grid max-w-xl gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                resetFeedback();
                setConfirmRevoke(true);
              }}
            >
              <input
                type="password"
                required
                value={revokePassword}
                onChange={(event) => setRevokePassword(event.target.value)}
                placeholder="كلمة المرور الحالية"
                className={fieldClassName}
              />
              <button
                ref={revokeTriggerRef}
                type="submit"
                disabled={isPending || revokePending}
                className="w-fit rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-100 disabled:opacity-60"
              >
                إلغاء جميع الجلسات
              </button>
            </form>
          </section>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-7 pb-10" dir="rtl">
      <AdminPageContextHeader
        eyebrow="ADMIN SETTINGS"
        title="الأمان"
        description="إدارة بيانات الدخول للحساب الحالي. يُشترط إدخال كلمة المرور الحالية قبل أي تغيير حساس."
      />

      <AdminModuleTabs
        tabs={tabs}
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
    </div>
  );
}
