"use client";

import { useState, useTransition } from "react";

import {
  AdminActionButton,
  AdminInfoBar,
  AdminPageContextHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import type {
  GlobalSeoHealthCheck,
  GlobalSeoHealthDimension,
  GlobalSeoHealthSnapshot,
} from "../../../../lib/seo/global-seo-health-types";
import { getSitemapSourceLabel } from "../../../../lib/seo/sitemap-monitor-types";
import { formatAdminDateTime } from "../../../../lib/content-dates";

import { runSitemapCheckAction } from "./actions";

type SitemapMonitorClientProps = {
  initialSnapshot: GlobalSeoHealthSnapshot;
};

const DIMENSION_LABELS: Record<GlobalSeoHealthDimension, string> = {
  identity: "Identity",
  metadata: "Metadata",
  crawl: "Crawl",
  adoption: "Adoption",
  infrastructure: "Infrastructure",
};

const SOURCE_LABELS = {
  database: "Database",
  environment: "Environment",
  code_fallback: "Code fallback",
} as const;

function healthTone(status: GlobalSeoHealthSnapshot["status"] | GlobalSeoHealthCheck["status"]) {
  if (status === "healthy" || status === "pass") return "green" as const;
  if (status === "warning") return "gold" as const;
  return "red" as const;
}

function healthLabel(status: GlobalSeoHealthSnapshot["status"] | GlobalSeoHealthCheck["status"]) {
  if (status === "healthy" || status === "pass") return "سليم";
  if (status === "warning") return "تحذير";
  return "فشل";
}

function getEffectiveValue(snapshot: GlobalSeoHealthSnapshot, field: string) {
  return snapshot.effectiveSources.find((item) => item.field === field)?.displayValue ?? "";
}

export default function SitemapMonitorClient({ initialSnapshot }: SitemapMonitorClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isPending, startTransition] = useTransition();

  function handleRunCheck() {
    startTransition(async () => {
      setSnapshot(await runSitemapCheckAction());
    });
  }

  const sitemapUrl = `${getEffectiveValue(snapshot, "canonicalBaseUrl").replace(/\/$/, "")}/sitemap.xml`;

  return (
    <main className="space-y-7" dir="rtl">
      <AdminPageContextHeader
        eyebrow="GLOBAL SEO HEALTH"
        title="لوحة صحة SEO العامة"
        description="تشخيص فعلي للهوية والبيانات الوصفية والزحف والتبنّي والبنية التحتية. التحذيرات الخاصة بالـCanonical تشخيصية فقط ولا تغيّر أي قيمة حية."
        actions={
          <AdminActionButton variant="primary" onClick={handleRunCheck} disabled={isPending}>
            {isPending ? "جارٍ الفحص..." : "تشغيل الفحص الكامل"}
          </AdminActionButton>
        }
      />

      <AdminInfoBar
        label="Health Score قائم على Checks حقيقية"
        description={snapshot.scoreFormula}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">الحالة</p>
          <div className="mt-3"><AdminStatusPill tone={healthTone(snapshot.status)}>{healthLabel(snapshot.status)}</AdminStatusPill></div>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">Health Score</p>
          <p className="mt-3 font-en text-3xl font-bold text-white">{snapshot.score}/100</p>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">Checks</p>
          <p className="mt-3 font-en text-2xl font-bold text-white">{snapshot.checks.length}</p>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">آخر فحص</p>
          <p className="mt-3 text-sm text-white/82">{formatAdminDateTime(snapshot.checkedAt)}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.entries(snapshot.dimensionScores) as Array<[GlobalSeoHealthDimension, number]>).map(([dimension, score]) => (
          <div key={dimension} className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
            <p className="font-en text-xs uppercase tracking-[0.14em] text-white/45">{DIMENSION_LABELS[dimension]}</p>
            <p className="mt-3 font-en text-2xl font-bold text-white">{score}/100</p>
          </div>
        ))}
      </section>

      {(Object.keys(DIMENSION_LABELS) as GlobalSeoHealthDimension[]).map((dimension) => (
        <section key={dimension} className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <h2 className="font-en text-lg font-bold text-white">{DIMENSION_LABELS[dimension]}</h2>
          <div className="mt-4 space-y-3">
            {snapshot.checks.filter((check) => check.dimension === dimension).map((check) => (
              <div key={check.id} className="rounded-[14px] border border-white/8 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <AdminStatusPill tone={healthTone(check.status)}>{healthLabel(check.status)}</AdminStatusPill>
                  {check.productDecision ? <AdminStatusPill tone="gold">Product Decision</AdminStatusPill> : null}
                  <h3 className="text-sm font-bold text-white">{check.title}</h3>
                  <span className="font-en text-xs text-white/45">weight {check.weight}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-white/68">{check.detail}</p>
                {check.samples?.length ? (
                  <ul className="mt-3 space-y-1 font-en text-xs text-white/55" dir="ltr">
                    {check.samples.map((sample) => <li key={sample}>{sample}</li>)}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Effective Source Contract</h2>
            <p className="mt-1 text-sm text-white/55">Database → Environment → Code Fallback. القيمة الموروثة لا تُعرض كأنها persisted.</p>
          </div>
          <a href={sitemapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-2xl border border-white/10 px-4 text-sm font-semibold text-white/72">
            فتح /sitemap.xml
          </a>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="text-xs text-white/45"><tr><th className="p-3">الحقل</th><th className="p-3">المصدر الفعلي</th><th className="p-3">Persisted</th><th className="p-3">Environment key</th><th className="p-3">القيمة الفعلية</th></tr></thead>
            <tbody>
              {snapshot.effectiveSources.map((item) => (
                <tr key={item.field} className="border-t border-white/8">
                  <td className="p-3 font-en text-white">{item.field}</td>
                  <td className="p-3"><AdminStatusPill tone={item.source === "database" ? "green" : item.source === "environment" ? "gold" : "muted"}>{SOURCE_LABELS[item.source]}</AdminStatusPill></td>
                  <td className="p-3 text-white/68">{item.persisted ? "نعم" : "لا"}</td>
                  <td className="p-3 font-en text-xs text-white/55" dir="ltr">{item.environmentKey}</td>
                  <td className="max-w-[360px] break-words p-3 text-white/68">{item.displayValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <h2 className="text-lg font-bold text-white">Sitemap Specialized Owner</h2>
          <p className="mt-2 text-sm text-white/55">{snapshot.sitemap.totalUrlCount} URL — Runtime-generated</p>
          <dl className="mt-4 space-y-2">
            {Object.entries(snapshot.sitemap.countsBySource).map(([source, count]) => (
              <div key={source} className="flex justify-between gap-4 text-sm"><dt className="text-white/62">{getSitemapSourceLabel(source as keyof typeof snapshot.sitemap.countsBySource)}</dt><dd className="font-en text-white">{count}</dd></div>
            ))}
          </dl>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <h2 className="text-lg font-bold text-white">Google Search Console</h2>
          <p className="mt-2 text-sm text-white/62">التكامل غير متصل؛ لا يدخل في Health Score لأنه ليس Capability مثبتة في المشروع.</p>
        </div>
      </section>
    </main>
  );
}
