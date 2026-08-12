import Link from "next/link";

import { buildAdminReportsOverview } from "../../../lib/admin/reports/reports-overview-presentation";
import type { AdminReportsModel, ReportsState } from "../../../lib/admin/reports/reports-contract";
import { formatAdminDateTime } from "../../../lib/content-dates";
import {
  AdminPageContextHeader,
  AdminPageExperience,
  AdminStatusPill,
} from "../ui";

const STATE_LABELS: Record<ReportsState, string> = {
  ready: "جاهز",
  partial: "جزئي",
  unavailable: "غير متاح",
};

const STATE_TONES: Record<ReportsState, "green" | "gold" | "red"> = {
  ready: "green",
  partial: "gold",
  unavailable: "red",
};

const TONE_CLASSES = {
  gold: "border-[#D8B87A]/18 from-[#D8B87A]/12 text-[#F0D69D]",
  blue: "border-blue-400/16 from-blue-400/10 text-blue-200",
  green: "border-emerald-400/16 from-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/16 from-amber-400/10 text-amber-200",
  violet: "border-violet-400/16 from-violet-400/10 text-violet-200",
  cyan: "border-cyan-400/16 from-cyan-400/10 text-cyan-200",
  red: "border-rose-400/16 from-rose-400/10 text-rose-200",
} as const;

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="max-w-2xl text-xs leading-6 text-white/42">{description}</p>
    </div>
  );
}

function MetricLink({
  href,
  label,
  value,
  description,
  tone,
}: {
  href: string;
  label: string;
  value: number | string;
  description: string;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <Link
      href={href}
      className={`group relative isolate min-h-[138px] overflow-hidden rounded-[26px] border bg-gradient-to-bl to-transparent p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-white/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] ${TONE_CLASSES[tone]}`}
    >
      <span className="absolute inset-x-5 bottom-4 h-px origin-right scale-x-0 bg-current opacity-35 transition group-hover:scale-x-100" aria-hidden />
      <span className="block text-xs font-semibold text-white/54">{label}</span>
      <span className="mt-4 block font-en text-3xl font-semibold leading-none">{value}</span>
      <span className="mt-3 block text-xs leading-6 text-white/42">{description}</span>
    </Link>
  );
}

function RecordColumn({
  title,
  description,
  items,
  emptyHref,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; title: string; meta: string; href: string }>;
  emptyHref: string;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/10 bg-[#080B10]/64 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
      <SectionHeading title={title} description={description} />
      <div className="space-y-2">
        {items.length ? items.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex items-center gap-3 rounded-[18px] border border-white/9 bg-white/[0.025] px-4 py-3 transition hover:border-[#D8B87A]/26 hover:bg-[#D8B87A]/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] font-en text-[11px] text-white/42 group-hover:text-[#D8B87A]">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white/75">{item.title}</span>
              <span className="mt-1 block truncate text-[11px] text-white/38">{item.meta}</span>
            </span>
            <span className="text-[#D8B87A]/55 transition group-hover:-translate-x-1" aria-hidden>←</span>
          </Link>
        )) : (
          <Link
            href={emptyHref}
            className="block rounded-[18px] border border-dashed border-white/12 px-4 py-7 text-center text-xs leading-6 text-white/42 hover:border-[#D8B87A]/24 hover:text-white/62 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            المصدر متاح ولا توجد سجلات في النافذة الحالية. افتح التقرير للتفاصيل.
          </Link>
        )}
      </div>
    </section>
  );
}

function OverviewState({ model }: { model: AdminReportsModel }) {
  const content = {
    ready: "جميع مصادر النظام المطلوبة أعادت حقيقة موثوقة.",
    partial: "المصادر المتاحة معروضة كما هي؛ المصادر غير المفعلة لم تُستبدل ببيانات وهمية.",
    unavailable: "تعذر تكوين نظرة تنفيذية موثوقة، لذلك لم تُعرض أصفار أو Charts بديلة.",
  }[model.state];
  return (
    <Link
      href="/admin/reports/system?filter=diagnostics"
      className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.025] px-5 py-4 transition hover:border-[#D8B87A]/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] sm:flex-row sm:items-center sm:justify-between"
      aria-label={`حالة التقارير ${STATE_LABELS[model.state]}، فتح تشخيص النظام`}
    >
      <span>
        <span className="block text-sm font-semibold text-white">حالة منظومة التقارير</span>
        <span className="mt-1 block text-xs leading-6 text-white/46">{content}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <AdminStatusPill tone={STATE_TONES[model.state]}>{STATE_LABELS[model.state]}</AdminStatusPill>
        <span className="font-en text-[11px] text-white/34">{formatAdminDateTime(model.checkedAt)}</span>
      </span>
    </Link>
  );
}

function ProviderStatus({ status }: { status: string }) {
  const state: ReportsState = status === "ready" ? "ready" : status === "partial" ? "partial" : "unavailable";
  return <AdminStatusPill tone={STATE_TONES[state]}>{status === "not_configured" ? "غير مفعّل" : STATE_LABELS[state]}</AdminStatusPill>;
}

export default function AdminReportsView({ model }: { model: AdminReportsModel }) {
  const overview = buildAdminReportsOverview(model);
  return (
    <AdminPageExperience className="min-w-0 pb-12" dir="rtl">
      <AdminPageContextHeader
        eyebrow="REPORTING SYSTEM"
        title="نظرة عامة على التقارير"
        description="ملخص تنفيذي قابل للقرار. كل بطاقة تنقلك إلى التقرير والفلتر المرتبطين بها، بينما التفاصيل الكاملة تعيش في صفحاتها المستقلة."
        meta={`العقد ${model.reports.data?.contractVersion ?? "غير متاح"}`}
      />

      <OverviewState model={model} />

      <section aria-label="أهم مؤشرات التقارير">
        <SectionHeading title="المؤشرات التنفيذية" description="نفس KPIs وSources of Truth المشتركة مع Dashboard والتقارير المتخصصة." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {overview.kpis.map((card) => <MetricLink key={card.id} {...card} />)}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="min-w-0 rounded-[28px] border border-white/10 bg-[#080B10]/64 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
          <SectionHeading title="أهم التنبيهات" description="الإشارات ذات القيمة غير الصفرية فقط، مع رابط مباشر إلى نفس سياق المشكلة." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overview.alerts.length ? overview.alerts.slice(0, 6).map((alert) => (
              <MetricLink key={alert.id} {...alert} />
            )) : (
              <Link href="/admin/reports/system?filter=diagnostics" className="rounded-[22px] border border-emerald-400/18 bg-emerald-400/[0.055] p-5 text-sm leading-7 text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] sm:col-span-2 xl:col-span-3">
                لا توجد تنبيهات بقيم موجبة في الحقائق الحالية. افتح تشخيص النظام للتأكد من صحة المصادر.
              </Link>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-[28px] border border-white/10 bg-[#080B10]/64 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
          <SectionHeading title="Analytics Providers" description="حالة الـAdapter Registry الواحد؛ ليست أرقام أداء." />
          <div className="space-y-2">
            {overview.providers.map((provider) => (
              <Link key={provider.id} href={provider.href} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/9 bg-white/[0.025] px-4 py-3 transition hover:border-[#D8B87A]/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
                <span className="min-w-0">
                  <span className="block font-en text-xs font-semibold text-white/70">{provider.label}</span>
                  <span className="mt-1 block truncate text-[10px] text-white/34">{provider.description}</span>
                </span>
                <ProviderStatus status={provider.status} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="Health" description="قراءة سريعة لصحة المجالات الرئيسية دون تكرار التقرير الكامل." />
        <div className="grid gap-4 md:grid-cols-3">
          {overview.health.map((health) => (
            <Link key={health.id} href={health.href} className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 transition hover:-translate-y-1 hover:border-[#D8B87A]/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white/76">{health.label}</span>
                <AdminStatusPill tone={STATE_TONES[health.state]}>{STATE_LABELS[health.state]}</AdminStatusPill>
              </span>
              <span className="mt-3 block text-xs leading-6 text-white/42">{health.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <RecordColumn title="أهم المشاريع" description="أحدث المشاريع؛ البطاقة تفتح تقرير المشاريع أولًا." items={overview.projects} emptyHref="/admin/reports/projects" />
        <RecordColumn title="أهم المحتوى" description="أحدث المحتوى؛ البطاقة تفتح تقرير المحتوى أولًا." items={overview.content} emptyHref="/admin/reports/content" />
        <RecordColumn title="أهم النشاط" description="أحدث Audit activity من العينة الحالية." items={overview.activity} emptyHref="/admin/reports/audit" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <SectionHeading title="أهم مشاكل SEO" description="روابط مباشرة إلى نفس فلتر المشكلة." />
          <div className="grid gap-3 sm:grid-cols-2">{overview.seoIssues.map((card) => <MetricLink key={card.id} {...card} />)}</div>
        </div>
        <div>
          <SectionHeading title="أهم مشاكل الميديا" description="صحة Reference Sync وMetadata من المالك الحالي." />
          <div className="grid gap-3 sm:grid-cols-2">{overview.mediaIssues.map((card) => <MetricLink key={card.id} {...card} />)}</div>
        </div>
      </section>

      <section>
        <SectionHeading title="الوصول السريع للتقارير" description="تقارير مستقلة؛ لا Tabs تجمع النظام كله في صفحة واحدة." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {overview.quickAccess.map((report) => (
            <Link key={report.id} href={report.href} className="group rounded-[22px] border border-white/10 bg-white/[0.025] p-4 transition hover:-translate-y-1 hover:border-[#D8B87A]/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
              <span className="grid size-10 place-items-center rounded-2xl border border-[#D8B87A]/18 bg-[#D8B87A]/[0.055] text-lg text-[#D8B87A]" aria-hidden>{report.icon}</span>
              <span className="mt-4 block text-sm font-semibold text-white/76">{report.label}</span>
              <span className="mt-2 block text-xs leading-6 text-white/40">{report.description}</span>
              <span className="mt-3 block text-xs font-semibold text-[#D8B87A]/70 transition group-hover:-translate-x-1">فتح التقرير ←</span>
            </Link>
          ))}
        </div>
      </section>
    </AdminPageExperience>
  );
}
