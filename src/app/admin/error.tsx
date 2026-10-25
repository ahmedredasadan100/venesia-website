"use client";

import { useEffect } from "react";

import AdminPageContextHeader from "../../components/admin/ui/AdminPageContextHeader";
import AdminActionButton from "../../components/admin/ui/AdminActionButton";
import AdminPageExperience from "../../components/admin/ui/AdminPageExperience";
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
          <AdminActionButton
            type="button"
            onClick={retry}
            variant="dark"
          >
            إعادة المحاولة
          </AdminActionButton>
        }
      />
    </AdminPageExperience>
  );
}
