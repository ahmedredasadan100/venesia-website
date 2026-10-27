import { AdminActionButton, AdminPageContextHeader } from "./ui";
import type { AdminPageContextHeaderProps } from "./ui/AdminPageContextHeader";

type AdminPlaceholderPageProps = {
  title: string;
  description?: string;
  badge?: string;
  visualPreset?: AdminPageContextHeaderProps["visualPreset"];
};

export default function AdminPlaceholderPage({
  title,
  description = "هذه الصفحة جاهزة داخل هيكل لوحة التحكم، وسيتم تفعيل وظائفها في المرحلة المناسبة بدون كسر المعمار الحالي.",
  badge = "قيد التطوير",
  visualPreset,
}: AdminPlaceholderPageProps) {
  return (
    <div className="pb-10">
      <AdminPageContextHeader
        visualPreset={visualPreset}
        badge={badge}
        title={title}
        description={description}
        actions={
          <>
            <AdminActionButton href="/admin" variant="primary">
              العودة للوحة التحكم
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">
              إدارة المقالات
            </AdminActionButton>
          </>
        }
      />
    </div>
  );
}
