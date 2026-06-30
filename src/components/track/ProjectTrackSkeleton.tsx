import Link from "next/link";

type ProjectTrackSkeletonProps = {
  projectCode: string;
  projectName: string;
  projectHref: string;
};

export default function ProjectTrackSkeleton({
  projectCode,
  projectName,
  projectHref,
}: ProjectTrackSkeletonProps) {
  return (
    <main
      dir="rtl"
      className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-24 sm:px-6"
    >
      <div className="w-full max-w-xl rounded-[24px] border border-[#D8B87A]/20 bg-[#080B10]/90 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-10">
        <p className="font-en text-[11px] uppercase tracking-[0.24em] text-[#D8B87A]/55">
          Construction Tracking
        </p>

        <h1 className="mt-3 font-en text-3xl font-semibold text-[#D8B87A] sm:text-4xl">
          {projectCode}
        </h1>

        <p className="mt-2 text-lg font-medium text-white/85">{projectName}</p>

        <p className="mt-6 text-sm leading-8 text-white/62 sm:text-[15px]">
          جاري تحديث بيانات المشروع... سيتم قريبًا إضافة نظام متابعة مراحل التنفيذ لهذا
          المشروع.
        </p>

        <Link
          href={projectHref}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D8B87A]/35 px-6 py-3 text-sm text-[#D8B87A] transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A]/10"
        >
          العودة إلى صفحة المشروع
        </Link>
      </div>
    </main>
  );
}
