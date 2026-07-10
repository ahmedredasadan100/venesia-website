import AdminNotice from "../../../../../components/admin/AdminNotice";
import type { HomepageFallbackStatusReport } from "../../../../../lib/home/derive-homepage-fallback-status";

const STATUS_LABELS = {
  cms_managed: "تدار بالكامل عبر نظام المحتوى",
  partial_fallback: "تستخدم محتوى احتياطي مدمج جزئياً",
  full_fallback: "تستخدم محتوى احتياطي مدمج بالكامل",
} as const;

type HomepageFallbackStatusPanelProps = {
  report: HomepageFallbackStatusReport;
};

export default function HomepageFallbackStatusPanel({ report }: HomepageFallbackStatusPanelProps) {
  const statusLabel = STATUS_LABELS[report.status];
  const isManaged = report.status === "cms_managed";

  const fallbackList = report.fallbackSections.map((section) => section.label).join("، ");

  const message = isManaged
    ? "جميع أقسام الصفحة الرئيسية في الفتحة الرئيسية مرتبطة ببلوكات نظام المحتوى. التعديلات في لوحة الإدارة تنعكس على الموقع العام."
    : `الصفحة الرئيسية العامة تعرض حالياً محتوى احتياطي مدمج في الأقسام التالية: ${fallbackList}. التعديلات في لوحة الإدارة لن تتحكم بالكامل في هذه الأقسام حتى يتم ربط بلوكات نظام المحتوى الصحيحة. هذا سلوك احتياطي وليس دليلاً على أن بيانات نظام المحتوى نشطة.`;

  return (
    <div
      className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
      dir="rtl"
      data-homepage-fallback-status={report.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
            حالة المحتوى الاحتياطي
          </p>
          <p className="mt-1 text-base font-semibold text-white">{statusLabel}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isManaged
              ? "bg-emerald-400/15 text-emerald-200"
              : "bg-[#D8B87A]/15 text-[#F2D99B]"
          }`}
        >
          {isManaged ? "CMS MANAGED" : report.status === "full_fallback" ? "USING STATIC FALLBACKS" : "PARTIALLY USING STATIC FALLBACKS"}
        </span>
      </div>

      {!isManaged ? (
        <div className="mt-4">
          <AdminNotice variant="warning" message={message} />
          <ul className="mt-3 list-disc space-y-1 pr-5 text-sm text-white/65">
            {report.fallbackSections.map((section) => (
              <li key={section.slug}>{section.label}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-7 text-white/60">{message}</p>
      )}
    </div>
  );
}
