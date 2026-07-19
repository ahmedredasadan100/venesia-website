"use client";

import {
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../components/admin/ui";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AdminPageExperience state="error">
      <AdminPageContextHeader
        eyebrow="ADMIN ERROR"
        title="تعذر تحميل الصفحة"
        description={error.message || "حدث خطأ غير متوقع أثناء تجهيز الصفحة."}
        status="error"
        variant="minimal"
        actions={
          <button
            type="button"
            onClick={unstable_retry}
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            إعادة المحاولة
          </button>
        }
      />
    </AdminPageExperience>
  );
}
