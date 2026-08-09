"use client";

import { useEffect } from "react";

import {
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../components/admin/ui";
import { logError } from "../../lib/logging";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    logError("Admin route render failed", error, {
      boundary: "admin",
      digest: error.digest,
    });
  }, [error]);

  return (
    <AdminPageExperience state="error">
      <AdminPageContextHeader
        eyebrow="ADMIN ERROR"
        title="تعذر تحميل الصفحة"
        description="حدث خطأ غير متوقع أثناء تجهيز الصفحة."
        status="error"
        variant="minimal"
        actions={
          <button
            type="button"
            onClick={retry}
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            إعادة المحاولة
          </button>
        }
      />
    </AdminPageExperience>
  );
}
