import Link from "next/link";

export default function AdminForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 py-16 text-white" dir="rtl">
      <div className="w-full max-w-lg rounded-[34px] border border-white/10 bg-[#080B10]/90 p-8 shadow-[0_30px_110px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Venesia CMS</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">استعادة كلمة المرور</h1>
        <p className="mt-4 text-sm leading-7 text-white/60">
          استعادة كلمة المرور غير مفعّلة حاليًا. يرجى التواصل مع مدير النظام.
        </p>

        <div className="mt-8">
          <Link
            href="/admin/login"
            className="inline-flex rounded-2xl border border-[#D8B87A]/30 px-4 py-3 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
          >
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
