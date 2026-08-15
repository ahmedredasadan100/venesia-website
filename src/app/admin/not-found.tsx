import Link from "next/link";

import AdminPageContextHeader from "../../components/admin/ui/AdminPageContextHeader";
import AdminPageExperience from "../../components/admin/ui/AdminPageExperience";

export default function AdminNotFound() {
  return (
    <AdminPageExperience state="empty">
      <AdminPageContextHeader
        eyebrow="ADMIN 404"
        title="صفحة الإدارة غير موجودة"
        description="تحقق من الرابط أو ارجع إلى الصفحة الرئيسية للوحة الإدارة."
        status="empty"
        variant="minimal"
        actions={
          <Link
            href="/admin"
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            العودة للرئيسية
          </Link>
        }
      />
    </AdminPageExperience>
  );
}
