import AdminNotice from "../../AdminNotice";

/** Placement-only home projects module — project cards load from Supabase projects table. */
export default function HomeProjectsPlacementEditor() {
  return (
    <AdminNotice
      variant="info"
      title="Home Projects — Placement Module"
      message="هذا الموديول يتحكم فقط في ظهور سكشن المشاريع ومكانه على الصفحة الرئيسية. بيانات الكروت (الصور، الأكواد، الأوصاف، الترتيب) تُدار من لوحة المشاريع عبر show_on_homepage و homepage_order في جدول projects."
    />
  );
}
