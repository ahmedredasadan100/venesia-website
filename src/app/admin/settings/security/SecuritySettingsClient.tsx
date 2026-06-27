"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";

import AdminModuleTabs from "../../../../components/admin/page-blocks/AdminModuleTabs";
import {
  hasAdminSelfAccountFieldErrors,
  normalizeAdminEmail,
  validateAdminSelfAccountForm,
  type AdminSelfAccountField,
  type AdminSelfAccountFieldErrors,
} from "../../../../lib/admin/users/admin-users-validation";

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
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [accountForm, setAccountForm] = useState({
    full_name: fullName ?? "",
    email,
    currentPassword: "",
  });
  const [savedEmail, setSavedEmail] = useState(email);
  const [accountFieldErrors, setAccountFieldErrors] = useState<AdminSelfAccountFieldErrors>({});
  const [revokePassword, setRevokePassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAccountForm((prev) => ({
      ...prev,
      full_name: fullName ?? "",
      email,
    }));
    setSavedEmail(email);
  }, [email, fullName]);

  const emailChanged = normalizeAdminEmail(accountForm.email) !== normalizeAdminEmail(savedEmail);

  function resetAlerts() {
    setMessage(null);
    setError(null);
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
      label: "تغيير كلمة المرور",
      content: (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white">تغيير كلمة المرور</h2>
          <p className="mt-2 text-sm leading-7 text-white/55">
            يُشترط إدخال كلمة المرور الحالية قبل تعيين كلمة مرور جديدة.
          </p>
          <form
            className="mt-5 grid max-w-xl gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              resetAlerts();
              if (passwordForm.next !== passwordForm.confirm) {
                setError("تأكيد كلمة المرور غير متطابق.");
                return;
              }
              startTransition(async () => {
                try {
                  await changeAdminPasswordAction(passwordForm.current, passwordForm.next);
                  setPasswordForm({ current: "", next: "", confirm: "" });
                  setMessage("تم تحديث كلمة المرور بنجاح.");
                  router.refresh();
                } catch (actionError) {
                  setError(actionError instanceof Error ? actionError.message : "تعذر تحديث كلمة المرور.");
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
      label: "بيانات الحساب",
      content: (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white">بيانات الحساب الحالي</h2>
          <p className="mt-2 text-sm leading-7 text-white/55">
            يمكنك تعديل الاسم الكامل والبريد الإلكتروني من هنا. تغيير البريد يتطلب كلمة المرور الحالية
            للتأكيد.
          </p>
          <form
            className="mt-5 grid max-w-xl gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              resetAlerts();
              setAccountFieldErrors({});

              const fieldErrors = validateAdminSelfAccountForm({
                ...accountForm,
                originalEmail: savedEmail,
              });
              if (hasAdminSelfAccountFieldErrors(fieldErrors)) {
                setAccountFieldErrors(fieldErrors);
                return;
              }

              startTransition(async () => {
                const result = await updateAdminSelfAccountAction(accountForm);
                if (!result.success) {
                  setAccountFieldErrors(result.fieldErrors);
                  return;
                }

                setAccountForm((prev) => ({
                  full_name: result.fullName ?? "",
                  email: result.email,
                  currentPassword: "",
                }));
                setSavedEmail(result.email);
                setAccountFieldErrors({});
                setMessage("تم حفظ بيانات الحساب.");
                router.refresh();
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
      label: "الأمان والجلسات",
      content: (
        <div className="space-y-5">
          <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-white">الأمان والجلسات</h2>
            <p className="mt-2 text-sm leading-7 text-white/55">
              إدارة بيانات الدخول للحساب الحالي. يُشترط إدخال كلمة المرور الحالية قبل أي تغيير حساس.
            </p>
            <div className="mt-5 grid max-w-xl gap-3 rounded-[22px] border border-white/10 bg-white/[0.02] p-4 text-sm text-white/62">
              <p>
                <span className="text-white/45">آخر دخول: </span>
                <span className="text-white/80">{formatDate(lastLoginAt)}</span>
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
                resetAlerts();
                startTransition(async () => {
                  try {
                    await revokeAllAdminSessionsAction(revokePassword);
                    window.location.href = "/admin/login";
                  } catch (actionError) {
                    setError(actionError instanceof Error ? actionError.message : "تعذر إلغاء الجلسات.");
                  }
                });
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
                type="submit"
                disabled={isPending}
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
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-white">الأمان</h1>
        <p className="mt-2 text-sm leading-7 text-white/55">
          إدارة بيانات الدخول للحساب الحالي. يُشترط إدخال كلمة المرور الحالية قبل أي تغيير حساس.
        </p>
      </section>

      {message ? (
        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-5 md:p-6">
        <AdminModuleTabs tabs={tabs} />
      </section>
    </div>
  );
}
