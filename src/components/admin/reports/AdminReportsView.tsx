import Link from "next/link";
import type { ReactNode } from "react";

import type {
  AnalyticsCapabilityState,
  AnalyticsProviderStatus,
} from "../../../lib/admin/reports/analytics-contract";
import type {
  AdminReportsModel,
  ReportsSourceStatus,
} from "../../../lib/admin/reports/reports-contract";
import {
  AdminMetricCard,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../ui";

function formatDate(value?: string | null) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متاح";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value: string) {
  const bytes = BigInt(value);
  if (bytes < BigInt(1024)) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = Number(bytes);
  let unit = -1;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-premium-card rounded-[28px] p-5 ${className}`}>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-6 text-white/45">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

const STATUS_LABELS: Record<ReportsSourceStatus, string> = {
  ready: "جاهز",
  warning: "جزئي",
  unavailable: "غير متاح",
};

function Status({ status }: { status: ReportsSourceStatus }) {
  const classes = {
    ready: "border-emerald-400/24 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/24 bg-amber-400/10 text-amber-200",
    unavailable: "border-rose-400/24 bg-rose-400/10 text-rose-200",
  }[status];
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function StateStatus({ state }: { state: AnalyticsCapabilityState }) {
  return <Status status={state === "ready" ? "ready" : state === "partial" ? "warning" : "unavailable"} />;
}

function EmptyTruth({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.025] px-4 py-6 text-sm leading-7 text-white/50">
      {children}
    </div>
  );
}

function MetricRows({ items }: { items: Array<[string, number | string]> }) {
  return (
    <dl className="space-y-2.5">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-white/[0.028] px-4 py-3">
          <dt className="text-sm leading-6 text-white/58">{label}</dt>
          <dd className="shrink-0 font-en text-sm font-semibold text-[#D8B87A]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReportsStateBanner({ model }: { model: AdminReportsModel }) {
  const content = {
    ready: ["Reports جاهزة", "كل مصادر التقارير المطلوبة أعادت حقيقة موثوقة في هذا الطلب.", "border-emerald-400/24 bg-emerald-400/[0.07] text-emerald-100"],
    partial: ["Reports جزئية", "المصادر المتاحة معروضة بحالتها الحقيقية، والمصادر غير المفعلة أوالمتعذرة لم تُستبدل ببيانات وهمية.", "border-amber-400/24 bg-amber-400/[0.07] text-amber-100"],
    unavailable: ["Reports غير متاحة", "تعذر تكوين أي تقرير موثوق. لا توجد Charts أوأصفار أومحتويات بديلة.", "border-rose-400/24 bg-rose-400/[0.07] text-rose-100"],
  }[model.state];
  return (
    <section className={`flex flex-col gap-3 rounded-[24px] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${content[2]}`} aria-live="polite">
      <div>
        <h1 className="text-base font-semibold">{content[0]}</h1>
        <p className="mt-1 text-xs leading-6 opacity-75">{content[1]}</p>
      </div>
      <p className="shrink-0 font-en text-xs opacity-65">آخر فحص: {formatDate(model.checkedAt)}</p>
    </section>
  );
}

const PROVIDER_STATUS_LABELS: Record<AnalyticsProviderStatus, string> = {
  not_configured: "غير مفعّل",
  ready: "جاهز",
  partial: "جزئي",
  unavailable: "متعذر",
};

export default function AdminReportsView({ model }: { model: AdminReportsModel }) {
  const dashboard = model.dashboard.data;
  const reports = model.reports.data;
  const review = model.contentReview.data;
  const audit = model.audit.data;
  const seo = model.seo.data;
  const analyticsDomains = Object.values(model.analytics.reports);

  return (
    <AdminPageExperience className="pb-10" dir="rtl">
      <AdminPageContextHeader
        eyebrow="REPORTS & ANALYTICS CAPABILITY"
        title="التقارير والتحليلات"
        description="تقارير تشغيلية من Read Models وملاك النظام الحقيقيين، مع عقد Analytics موحد يفشل بوضوح عند غياب المزود."
      />
      <div className="space-y-5">
        <ReportsStateBanner model={model} />

        {dashboard ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="مؤشرات التقارير المشتركة مع Dashboard">
            <AdminMetricCard label="المحتوى" value={dashboard.kpis.topics.total} tone="gold" align="start" />
            <AdminMetricCard label="المحتوى المنشور" value={dashboard.kpis.topics.published} tone="green" align="start" />
            <AdminMetricCard label="المشاريع" value={dashboard.kpis.projects.total} tone="blue" align="start" />
            <AdminMetricCard label="المشاريع المنشورة" value={dashboard.kpis.projects.published} tone="cyan" align="start" />
            <AdminMetricCard label="الصفحات" value={dashboard.kpis.pages.total} tone="violet" align="start" />
            <AdminMetricCard label="أصول الميديا" value={dashboard.kpis.media.total} tone="amber" align="start" />
          </section>
        ) : (
          <EmptyTruth>{model.dashboard.message}</EmptyTruth>
        )}

        <section className="grid gap-5 xl:grid-cols-2">
          <Panel title="Content Reports" subtitle="الحالة الأساسية من Dashboard، والمراجعة من Content Review Capability نفسها.">
            {dashboard && reports ? (
              <div className="space-y-4">
                <MetricRows items={[
                  ["منشور", dashboard.kpis.topics.published],
                  ["مسودات", dashboard.kpis.topics.draft],
                  ["غير منشور", dashboard.kpis.topics.unpublished],
                  ["SEO ناقص", reports.content.missingSeo],
                  ["صور ناقصة", reports.content.missingImages],
                  ["Alt ناقص", reports.content.missingImageAlt],
                ]} />
                {review ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <AdminMetricCard label="تمت مراجعته" value={review.checked} tone="blue" compact />
                    <AdminMetricCard label="جاهز للنشر" value={review.ready} tone="green" compact />
                    <AdminMetricCard label="محجوب بالتحقق" value={review.blocked} tone="amber" compact />
                  </div>
                ) : <EmptyTruth>{model.contentReview.message}</EmptyTruth>}
                <Link href="/admin/reports/topics-without-image" className="inline-flex rounded-lg text-xs font-semibold text-[#D8B87A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
                  فتح تقرير المحتوى بلا صورة
                </Link>
              </div>
            ) : <EmptyTruth>{model.reports.message}</EmptyTruth>}
          </Panel>

          <Panel title="Projects Reports" subtitle="Data Completeness محسوبة من عقد المشروع الحالي وعلاقاته، وتحديثات التنفيذ من Unified Content.">
            {dashboard && reports ? (
              <MetricRows items={[
                ["منشور", dashboard.kpis.projects.published],
                ["مسودات", dashboard.kpis.projects.draft],
                ["مميز", reports.projects.featured],
                ["مكتمل البيانات", reports.projects.complete],
                ["ناقص البيانات", reports.projects.incomplete],
                ["SEO ناقص", reports.projects.missingSeo],
                ["صور أساسية ناقصة", reports.projects.missingImages],
                ["Construction Status", "غير متاح كحقل مستقل"],
                ["تحديثات تنفيذ منشورة", reports.projects.constructionUpdates.published],
              ]} />
            ) : <EmptyTruth>{model.reports.message}</EmptyTruth>}
          </Panel>

          <Panel title="SEO Reports" subtitle="Metadata من Reports Read Model؛ الصحة وSitemap من Global SEO owner.">
            {reports ? (
              <div className="space-y-4">
                <MetricRows items={[
                  ["محتوى ناقص Metadata", reports.seo.missingMetadata.topics],
                  ["مشاريع ناقصة Metadata", reports.seo.missingMetadata.projects],
                  ["صفحات ناقصة Metadata", reports.seo.missingMetadata.pages],
                  ["Canonical Overrides", reports.seo.canonicalOverrides],
                  ["منشور قابل للفهرسة", reports.seo.indexability.indexablePublished],
                  ["منشور Noindex", reports.seo.indexability.noindexPublished],
                  ["Sitemap Coverage", seo ? seo.sitemap.totalUrlCount : "غير متاح"],
                ]} />
                {seo ? (
                  <p className="rounded-[18px] border border-white/10 px-4 py-3 text-xs leading-6 text-white/52">
                    SEO Health: <span className="font-en font-semibold text-white/80">{seo.score}%</span> · Sitemap: {seo.sitemap.status}
                  </p>
                ) : <EmptyTruth>{model.seo.message}</EmptyTruth>}
              </div>
            ) : <EmptyTruth>{model.reports.message}</EmptyTruth>}
          </Panel>

          <Panel title="Media Reports" subtitle="Catalog، Storage، Reference Sync، Alt وVideo URL من الملاك الحالية.">
            {reports ? (
              <div className="space-y-4">
                <MetricRows items={[
                  ["حجم معروف", formatBytes(reports.media.storage.knownBytes)],
                  ["حجم غير معروف", reports.media.storage.unknownByteSize],
                  ["References مكسورة", reports.media.brokenReferences],
                  ["Objects مفقودة", reports.media.missingObjects],
                  ["Alt مفقود", reports.media.missingAlt],
                  ["Video URLs مفقودة", reports.media.missingVideoUrls],
                ]} />
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 px-4 py-3">
                  <p className="text-xs leading-6 text-white/52">{model.media.message}</p>
                  <Status status={model.media.status} />
                </div>
              </div>
            ) : <EmptyTruth>{model.reports.message}</EmptyTruth>}
          </Panel>

          <Panel title="Publishing Reports" subtitle="حركة النشر من Database؛ Validation Blocks من Content Review owner.">
            {reports ? (
              <div className="space-y-4">
                <MetricRows items={[
                  ["محتوى نُشر خلال 30 يومًا", reports.publishing.recentPublishing.topics],
                  ["مشاريع نُشرت خلال 30 يومًا", reports.publishing.recentPublishing.projects],
                  ["محتوى Pending", reports.publishing.pendingPublishing.topics],
                  ["مشاريع Pending", reports.publishing.pendingPublishing.projects],
                  ["إجمالي المسودات", reports.publishing.drafts.topics + reports.publishing.drafts.projects + reports.publishing.drafts.pages],
                  ["منشور مع Validation Blocks", review ? review.publishedWithBlocks : "غير متاح"],
                ]} />
                {review?.blockingChecks.length ? (
                  <ul className="flex flex-wrap gap-2" aria-label="أكثر Validation Blocks تكرارًا">
                    {review.blockingChecks.slice(0, 8).map((item) => (
                      <li key={item.id} className="rounded-full border border-amber-400/18 bg-amber-400/[0.06] px-3 py-1.5 font-en text-[11px] text-amber-100">
                        {item.id}: {item.count}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : <EmptyTruth>{model.reports.message}</EmptyTruth>}
          </Panel>

          <Panel title="Audit Reports" subtitle={audit ? `إجمالي ${audit.total}؛ التجميعات التالية من أحدث ${audit.sampled} حدث.` : undefined}>
            {audit ? (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-3 text-xs font-semibold text-white/62">Recent Activity</h3>
                  {audit.recentActivity.length ? (
                    <ol className="space-y-2">
                      {audit.recentActivity.slice(0, 5).map((event) => (
                        <li key={event.id} className="rounded-[18px] border border-white/10 px-4 py-3 text-xs leading-6 text-white/55">
                          <span className="font-en text-white/75">{event.action}</span> · {event.actor} · {event.entityLabel ?? event.entityType ?? "system"} · {formatDate(event.createdAt)}
                        </li>
                      ))}
                    </ol>
                  ) : <EmptyTruth>Audit متاح ولا توجد أحداث حالية.</EmptyTruth>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-xs font-semibold text-white/62">Entity Activity</h3>
                    <MetricRows items={audit.entityActivity.slice(0, 5).map((item) => [item.entityType, item.count])} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-xs font-semibold text-white/62">User Activity</h3>
                    <MetricRows items={audit.userActivity.slice(0, 5).map((item) => [item.actor, item.count])} />
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-xs font-semibold text-white/62">Publishing History</h3>
                  {audit.publishingHistory.length ? (
                    <ol className="space-y-2">
                      {audit.publishingHistory.slice(0, 5).map((event) => (
                        <li key={event.id} className="rounded-[18px] border border-white/10 px-4 py-3 text-xs leading-6 text-white/55">
                          <span className="font-en text-white/75">{event.action}</span> · {event.actor} · {event.entityLabel ?? event.entityType ?? "system"} · {formatDate(event.createdAt)}
                        </li>
                      ))}
                    </ol>
                  ) : <EmptyTruth>Audit متاح، ولا توجد أحداث نشر داخل نافذة العينة الحالية.</EmptyTruth>}
                </div>
              </div>
            ) : <EmptyTruth>{model.audit.message}</EmptyTruth>}
          </Panel>
        </section>

        <Panel title="Analytics Reports" subtitle={`العقد ${model.analytics.contractVersion} · لا توجد اتصالات مباشرة بالمزود داخل Reports.`}>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.025] p-4">
            <p className="text-sm leading-7 text-white/58">
              لا تُعرض Charts أوZeros عند غياب المصدر. كل مزود جديد يدخل عبر Adapter Registry الواحد.
            </p>
            <StateStatus state={model.analytics.state} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {analyticsDomains.map((report) => (
              <section key={report.domain} className="rounded-[22px] border border-white/10 bg-white/[0.028] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-en text-sm font-semibold capitalize text-white/80">{report.domain}</h3>
                  <StateStatus state={report.state} />
                </div>
                <p className="mt-3 text-xs leading-6 text-white/48">{report.message}</p>
                {report.metrics.length ? (
                  <MetricRows items={report.metrics.map((metric) => [metric.label, metric.value])} />
                ) : null}
              </section>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="حالة Analytics Providers">
            {model.analytics.providers.map((provider) => (
              <div key={provider.provider} className="rounded-[18px] border border-white/10 px-4 py-3">
                <p className="font-en text-xs font-semibold text-white/70">{provider.label}</p>
                <p className="mt-1 text-[11px] text-white/40">{PROVIDER_STATUS_LABELS[provider.status]}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="System Reports" subtitle="Diagnostics، Migration Health، Sources of Truth، Cache وFailure paths.">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              model.dashboard,
              model.reports,
              model.contentReview,
              model.audit,
              model.seo,
              model.media,
            ].map((source) => (
              <div key={source.key} className="rounded-[20px] border border-white/10 bg-white/[0.028] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white/72">{source.label}</h3>
                  <Status status={source.status} />
                </div>
                <p className="mt-2 text-xs leading-6 text-white/48">{source.message}</p>
                <p className="mt-2 break-all font-en text-[10px] leading-5 text-white/30">{source.source}</p>
              </div>
            ))}
            <div className="rounded-[20px] border border-emerald-400/18 bg-emerald-400/[0.055] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white/72">Cache / Revalidation</h3>
                <Status status="ready" />
              </div>
              <p className="mt-2 text-xs leading-6 text-white/48">{model.cache.message}</p>
              <p className="mt-2 font-en text-[10px] text-white/30">{model.cache.source}</p>
            </div>
          </div>
          {reports ? (
            <div className="mt-4 rounded-[20px] border border-white/10 p-4">
              <h3 className="text-sm font-semibold text-white/72">Database / Migration Proof</h3>
              <MetricRows items={[
                ["Migration Registered", reports.databaseDiagnostics.migrationRegistered ? "yes" : "no"],
                ["Dashboard Read Model", reports.databaseDiagnostics.dashboardReadModelAvailable ? "available" : "missing"],
                ["RPC ACL Service-only", reports.databaseDiagnostics.rpcAclServiceOnly ? "yes" : "no"],
                ["Missing Indexes", reports.databaseDiagnostics.missingIndexes.length],
                ["RLS Tables Ready", Object.values(reports.databaseDiagnostics.rls).filter(Boolean).length],
              ]} />
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Sources of Truth">
                {reports.sourcesOfTruth.map((source) => (
                  <li key={source} className="rounded-full border border-white/10 px-3 py-1.5 font-en text-[10px] text-white/45">{source}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>
    </AdminPageExperience>
  );
}
