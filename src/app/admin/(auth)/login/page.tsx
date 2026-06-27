import { Suspense } from "react";

import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 py-16 text-white" dir="rtl">
      <div className="w-full max-w-lg rounded-[34px] border border-white/10 bg-[#080B10]/90 p-8 shadow-[0_30px_110px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Venesia CMS</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">تسجيل دخول الإدارة</h1>
        <p className="mt-2 text-sm leading-7 text-white/50">
          هذه الصفحة محمية. أدخل بيانات الدخول المسجّلة في نظام المستخدمين للوصول إلى لوحة التحكم.
        </p>

        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-white/45">جاري التحميل…</p>}>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
