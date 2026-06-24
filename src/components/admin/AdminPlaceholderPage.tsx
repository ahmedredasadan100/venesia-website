import Link from "next/link";

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
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#080B10]/78 p-8 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(216,184,122,0.14),transparent_34%),radial-gradient(circle_at_86%_8%,rgba(33,70,132,0.18),transparent_32%)]" />
        <div className="relative max-w-3xl">
          <span className="inline-flex rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-xs font-semibold text-[#D8B87A]">
            {badge}
          </span>
          <h2 className="mt-5 text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-4 text-sm leading-8 text-white/56">{description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin" className="rounded-2xl bg-[#D8B87A] px-5 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
              العودة للوحة التحكم
            </Link>
            <Link href="/admin/topics" className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/72 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]">
              إدارة المقالات
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
