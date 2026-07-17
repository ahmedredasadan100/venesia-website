import Link from "next/link";
import { AdminPageContextHeader } from "./ui";

type AdminPlaceholderPageProps = {
  title: string;
  description?: string;
  badge?: string;
};

export default function AdminPlaceholderPage({
  title,
  description = "هذه الصفحة جاهزة داخل هيكل لوحة التحكم، وسيتم تفعيل وظائفها في المرحلة المناسبة بدون كسر المعمار الحالي.",
  badge = "قيد التطوير",
}: AdminPlaceholderPageProps) {
  return (
    <div className="pb-10">
      <AdminPageContextHeader
        badge={badge}
        title={title}
        description={description}
        actions={
          <>
            <Link href="/admin" className="rounded-2xl bg-[#D8B87A] px-5 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
              العودة للوحة التحكم
            </Link>
            <Link href="/admin/content/topics" className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/72 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]">
              إدارة المقالات
            </Link>
          </>
        }
      />
    </div>
  );
}
