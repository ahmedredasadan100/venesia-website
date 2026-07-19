import {
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../components/admin/ui";

export default function AdminLoading() {
  return (
    <AdminPageExperience
      state="loading"
      className="animate-pulse"
    >
      <AdminPageContextHeader
        eyebrow="ADMIN"
        title="جارٍ تحميل الصفحة"
        description="يتم تجهيز بيانات الصفحة كاملة قبل عرضها."
        status="loading"
        variant="minimal"
      />
      <div className="h-16 rounded-[24px] border border-white/5 bg-white/[0.03]" />
      <div className="h-72 rounded-[28px] border border-white/5 bg-white/[0.04]" />
    </AdminPageExperience>
  );
}
