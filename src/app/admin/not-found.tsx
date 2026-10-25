import AdminActionButton from "../../components/admin/ui/AdminActionButton";

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
          <AdminActionButton
            href="/admin"
            variant="dark"
          >
            العودة للرئيسية
          </AdminActionButton>
        }
      />
    </AdminPageExperience>
  );
}
