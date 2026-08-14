import Link from "next/link";
import type { ReactNode } from "react";

import {
  ADMIN_REPORT_DEFINITIONS,
  REPORT_EXPERIENCE_CAPABILITIES,
  buildAdminReportHref,
  getAdminReportDefinition,
  type AdminReportId,
  type AdminReportQueryContext,
} from "../../../lib/admin/reports/reports-information-architecture";
import type { AdminReportPresentation } from "../../../lib/admin/reports/reports-presentation";
import type { AdminReportsModel, ReportsState } from "../../../lib/admin/reports/reports-contract";
import {
  AdminPageContextHeader,
  AdminPageExperience,
  AdminStatusPill,
} from "../ui";
import AdminReportActions from "./AdminReportActions";

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

function Panel({ title, description, children, id }: { title: string; description: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[28px] border border-white/10 bg-[#080B10]/64 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)] print:break-inside-avoid print:border-black/15 print:bg-white print:text-black">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white print:text-black">{title}</h2>
        <p className="mt-1 text-xs leading-6 text-white/42 print:text-black/60">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ReportNavigation({ current }: { current: AdminReportId }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 print:hidden" aria-label="التقارير المستقلة">
      {ADMIN_REPORT_DEFINITIONS.map((report) => (
        <Link
          key={report.id}
          href={report.href}
          aria-current={report.id === current ? "page" : undefined}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] ${report.id === current ? "border-[#D8B87A]/30 bg-[#D8B87A]/12 text-[#F0D69D]" : "border-white/10 bg-white/[0.025] text-white/48 hover:border-white/20 hover:text-white/74"}`}
        >
          {report.shortLabel}
        </Link>
      ))}
    </nav>
  );
}

function ReportFilters({ reportId, context }: { reportId: AdminReportId; context: AdminReportQueryContext }) {
  const definition = getAdminReportDefinition(reportId);
  const supportsAnalyticsContext = reportId === "analytics" || reportId === "business";
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 print:hidden" aria-label="Global Filters">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white/78">Global Filters</h2>
          <p className="mt-1 text-xs leading-6 text-white/40">الفلتر جزء من URL؛ فتح الرابط أو تصديره يحافظ على السياق نفسه.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {definition.filters.map((filter) => (
            <Link
              key={filter.id}
              href={buildAdminReportHref(reportId, { ...context, filter: filter.id })}
              aria-current={filter.id === context.filter ? "true" : undefined}
              title={filter.description}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] ${filter.id === context.filter ? "border-[#D8B87A]/34 bg-[#D8B87A]/12 text-[#F0D69D]" : "border-white/10 text-white/45 hover:border-white/18 hover:text-white/70"}`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>
      {supportsAnalyticsContext ? (
        <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold text-white/38">الفترة</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["last_30_days", "آخر 30 يومًا"],
                ["last_90_days", "آخر 90 يومًا"],
              ] as const).map(([period, label]) => (
                <Link key={period} href={buildAdminReportHref(reportId, { ...context, period })} aria-current={period === context.period ? "true" : undefined} className={`rounded-full border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] ${period === context.period ? "border-[#D8B87A]/30 bg-[#D8B87A]/10 text-[#F0D69D]" : "border-white/10 text-white/42"}`}>{label}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold text-white/38">المقارنة</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["none", "بدون مقارنة"],
                ["previous_period", "الفترة السابقة"],
                ["previous_year", "العام السابق"],
              ] as const).map(([compare, label]) => (
                <Link key={compare} href={buildAdminReportHref(reportId, { ...context, compare })} aria-current={compare === context.compare ? "true" : undefined} className={`rounded-full border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] ${compare === context.compare ? "border-[#D8B87A]/30 bg-[#D8B87A]/10 text-[#F0D69D]" : "border-white/10 text-white/42"}`}>{label}</Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 font-en text-[10px] text-white/34">period: current snapshot · compare: unavailable without time-series truth</p>
      )}
    </section>
  );
}

function ReportStateBanner({ presentation }: { presentation: AdminReportPresentation }) {
  return (
    <section className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.025] px-5 py-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
      <div>
        <h2 className="text-sm font-semibold text-white">حالة التقرير</h2>
        <p className="mt-1 text-xs leading-6 text-white/46">{presentation.message}</p>
      </div>
      <AdminStatusPill tone={STATE_TONES[presentation.state]}>{STATE_LABELS[presentation.state]}</AdminStatusPill>
    </section>
  );
}

function CapabilityReadiness({ reportId, model }: { reportId: AdminReportId; model: AdminReportsModel }) {
  return (
    <Panel title="قابلية التوسع" description="عقود Enterprise Reporting مهيأة دون إنشاء persistence أوprovider أوjob owners موازية.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_EXPERIENCE_CAPABILITIES.map((capability) => {
          const contextualUnavailable = capability.key === "compare_periods" &&
            (reportId !== "analytics" && reportId !== "business" || model.analytics.state === "unavailable");
          const state = contextualUnavailable ? "unavailable" : capability.state;
          const tone = state === "ready" ? "green" : state === "contextual" ? "gold" : "muted";
          return (
            <article key={capability.key} className="rounded-[20px] border border-white/9 bg-white/[0.022] p-4 print:break-inside-avoid print:border-black/10 print:bg-white">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-en text-xs font-semibold text-white/72 print:text-black">{capability.label}</h3>
                <AdminStatusPill tone={tone}>{state === "ready" ? "جاهز" : state === "contextual" ? "حسب المصدر" : "غير متاح"}</AdminStatusPill>
              </div>
              <p className="mt-3 text-xs leading-6 text-white/40 print:text-black/60">{capability.message}</p>
              <p className="mt-2 font-en text-[10px] text-white/26 print:text-black/45">{capability.owner}</p>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function InvalidQuery({ reportId, message }: { reportId: AdminReportId; message: string }) {
  const definition = getAdminReportDefinition(reportId);
  return (
    <AdminPageExperience className="min-w-0 pb-12" state="error" dir="rtl">
      <AdminPageContextHeader eyebrow={definition.eyebrow} title={definition.label} description={definition.description} status="error" />
      <section className="rounded-[28px] border border-rose-400/20 bg-rose-400/[0.06] p-6 text-rose-100">
        <h2 className="text-base font-semibold">سياق التقرير غير صالح</h2>
        <p className="mt-2 text-sm leading-7 opacity-75">{message}</p>
        <Link href={definition.href} className="mt-5 inline-flex rounded-2xl border border-rose-300/20 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">فتح التقرير بالسياق الأساسي</Link>
      </section>
    </AdminPageExperience>
  );
}

export { InvalidQuery as AdminReportInvalidQuery };

export default function AdminReportDetailView({
  model,
  presentation,
  context,
}: {
  model: AdminReportsModel;
  presentation: AdminReportPresentation;
  context: AdminReportQueryContext;
}) {
  const definition = getAdminReportDefinition(presentation.reportId);
  const exportParams = new URLSearchParams({ report: presentation.reportId });
  if (context.filter !== "all") exportParams.set("filter", context.filter);
  if (context.period !== "current") exportParams.set("period", context.period);
  if (context.compare !== "none") exportParams.set("compare", context.compare);
  const exportHref = `/admin/reports/export?${exportParams.toString()}`;
  const filterLabel = definition.filters.find((filter) => filter.id === context.filter)?.label ?? "الكل";

  return (
    <AdminPageExperience className="min-w-0 pb-12 print:block print:bg-white" dir="rtl">
      <div className="print:hidden"><ReportNavigation current={presentation.reportId} /></div>
      <AdminPageContextHeader
        eyebrow={definition.eyebrow}
        title={definition.label}
        description={definition.description}
        meta={`الفلتر: ${filterLabel}`}
        breadcrumb={<><Link href="/admin/reports" className="hover:text-white">التقارير</Link><span aria-hidden>/</span><span>{definition.shortLabel}</span></>}
        actions={<AdminReportActions exportHref={exportHref} />}
      />
      <ReportStateBanner presentation={presentation} />
      <ReportFilters reportId={presentation.reportId} context={context} />

      {presentation.groups.length || presentation.recordGroups.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {presentation.groups.map((group) => (
            <Panel key={group.id} id={group.id} title={group.title} description={group.description}>
              <dl className="grid gap-3 sm:grid-cols-2">
                {group.metrics.map((metric) => {
                  const content = (
                    <>
                      <dt className="text-xs leading-6 text-white/44 print:text-black/55">{metric.label}</dt>
                      <dd className="mt-2 font-en text-2xl font-semibold text-[#F0D69D] print:text-black">{metric.value}</dd>
                      {metric.description ? <span className="mt-2 block text-[10px] leading-5 text-white/30 print:text-black/45">{metric.description}</span> : null}
                    </>
                  );
                  return metric.href ? (
                    <Link key={metric.id} href={metric.href} className="rounded-[20px] border border-white/9 bg-white/[0.025] p-4 transition hover:border-[#D8B87A]/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] print:border-black/10 print:bg-white">{content}</Link>
                  ) : (
                    <div key={metric.id} className="rounded-[20px] border border-white/9 bg-white/[0.025] p-4 print:border-black/10 print:bg-white">{content}</div>
                  );
                })}
              </dl>
            </Panel>
          ))}

          {presentation.recordGroups.map((group) => (
            <Panel key={group.id} id={group.id} title={group.title} description={group.description}>
              {group.items.length ? (
                <ol className="space-y-2">
                  {group.items.map((item) => {
                    const content = (
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white/72 print:text-black">{item.title}</span>
                          <span className="mt-1 block break-words text-xs leading-6 text-white/38 print:text-black/55">{item.meta}</span>
                        </span>
                        {item.status ? <AdminStatusPill tone="muted">{item.status}</AdminStatusPill> : null}
                      </span>
                    );
                    return item.href ? (
                      <li key={item.id}><Link href={item.href} className="block rounded-[18px] border border-white/9 bg-white/[0.025] px-4 py-3 transition hover:border-[#D8B87A]/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A] print:border-black/10 print:bg-white">{content}</Link></li>
                    ) : <li key={item.id} className="rounded-[18px] border border-white/9 bg-white/[0.025] px-4 py-3 print:border-black/10 print:bg-white">{content}</li>;
                  })}
                </ol>
              ) : <p className="rounded-[18px] border border-dashed border-white/12 px-4 py-7 text-center text-xs leading-6 text-white/42 print:text-black/55">المصدر متاح ولا توجد سجلات في هذا السياق.</p>}
            </Panel>
          ))}
        </div>
      ) : (
        <section className="rounded-[28px] border border-amber-400/18 bg-amber-400/[0.055] p-6 text-amber-100">
          <h2 className="text-base font-semibold">لا توجد بيانات قابلة للعرض في هذا السياق</h2>
          <p className="mt-2 text-sm leading-7 opacity-70">المصدر غير مفعّل أو الفلتر لا يملك Rows حقيقية. لم تُعرض Charts أو أصفار بديلة.</p>
        </section>
      )}

      <Panel title="Action Center" description="روابط إلى المالك التشغيلي أو التقرير المتخصص؛ لا توجد mutations موازية داخل التقارير.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presentation.actions.map((action) => (
            <Link key={action.id} href={action.href} className="rounded-[20px] border border-[#D8B87A]/16 bg-[#D8B87A]/[0.045] p-4 transition hover:border-[#D8B87A]/34 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
              <span className="block text-sm font-semibold text-[#F0D69D]">{action.label}</span>
              <span className="mt-2 block text-xs leading-6 text-white/42 print:text-black/55">{action.description}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <CapabilityReadiness reportId={presentation.reportId} model={model} />
    </AdminPageExperience>
  );
}
