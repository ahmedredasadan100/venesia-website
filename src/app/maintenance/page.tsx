import { Suspense } from "react";

import { NO_INDEX_ROBOTS } from "../../config/seo/seo-rules";
import { buildMetadata } from "../../lib/seo/build-metadata";

import MaintenanceLoginForm from "./MaintenanceLoginForm";

export const metadata = buildMetadata({
  path: "/maintenance",
  title: "الموقع قيد الصيانة | فينيسيا للتطوير العقاري",
  description: "الموقع قيد الصيانة مؤقتًا. أدخل بيانات الدخول للوصول.",
  robots: NO_INDEX_ROBOTS,
});

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 py-16 text-white" dir="rtl">
      <div className="w-full max-w-lg rounded-[34px] border border-white/10 bg-[#080B10]/90 p-8 shadow-[0_30px_110px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Venesia</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">الموقع قيد الصيانة</h1>
        <p className="mt-2 text-sm leading-7 text-white/50">
          نعمل حاليًا على تحسين تجربة الموقع. إذا كنت تملك بيانات الدخول المعتمدة، يمكنك الوصول مؤقتًا إلى
          الموقع أثناء فترة الصيانة.
        </p>

        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-white/45">جاري التحميل…</p>}>
            <MaintenanceLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
