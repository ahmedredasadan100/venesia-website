"use client";

import { useState, useTransition } from "react";

import {
  AdminActionButton,
  AdminInfoBar,
  AdminPageContextHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import { SEO_SITE } from "../../../../config/seo/seo-site";
import {
  getSitemapSourceLabel,
  type SitemapMonitorSnapshot,
} from "../../../../lib/seo/sitemap-monitor-types";

import { runSitemapCheckAction } from "./actions";

type SitemapMonitorClientProps = {
  initialSnapshot: SitemapMonitorSnapshot;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusTone(status: SitemapMonitorSnapshot["status"]) {
  if (status === "healthy") return "green" as const;
  if (status === "warning") return "gold" as const;
  return "red" as const;
}

function statusLabel(status: SitemapMonitorSnapshot["status"]) {
  if (status === "healthy") return "سليم";
  if (status === "warning") return "تحذير";
  return "خطأ";
}

function severityLabel(severity: "info" | "warning" | "error") {
  if (severity === "info") return "معلومة";
  if (severity === "warning") return "تحذير";
  return "خطأ";
}

export default function SitemapMonitorClient({ initialSnapshot }: SitemapMonitorClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isPending, startTransition] = useTransition();

  function handleRunCheck() {
    startTransition(async () => {
      const next = await runSitemapCheckAction();
      setSnapshot(next);
    });
  }

  const sitemapUrl = `${SEO_SITE.defaultUrl}/sitemap.xml`;

  return (
    <main className="space-y-7" dir="rtl">
      <AdminPageContextHeader
        eyebrow="SITEMAP MONITOR"
        title="مراقبة Sitemap"
        description="صفحة تشخيصية لملف /sitemap.xml المُولَّد وقت التشغيل. لا تُعدِّل المحتوى أو حقول SEO."
        actions={
          <AdminActionButton variant="primary" onClick={handleRunCheck} disabled={isPending}>
            {isPending ? "جار الفحص..." : "تشغيل فحص Sitemap"}
          </AdminActionButton>
        }
      />

      <AdminInfoBar
        label="توليد وقت التشغيل"
        description="يتم توليد Sitemap تلقائيًا وقت التشغيل من مصادر المحتوى العامة الحالية. هذه الصفحة للمراقبة والتشخيص فقط — وليست محررًا يدويًا لعناوين URL."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">الحالة الحالية</p>
          <div className="mt-3">
            <AdminStatusPill tone={statusTone(snapshot.status)}>{statusLabel(snapshot.status)}</AdminStatusPill>
          </div>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">إجمالي العناوين</p>
          <p className="mt-3 text-2xl font-bold text-white">{snapshot.totalUrlCount}</p>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">آخر فحص</p>
          <p className="mt-3 text-sm text-white/82">{formatDate(snapshot.checkedAt)}</p>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <p className="text-xs text-white/45">وضع التوليد</p>
          <p className="mt-3 text-sm font-semibold text-white">Runtime-generated</p>
        </div>
      </section>

      <section className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">ملف Sitemap الحالي</h2>
            <p className="mt-1 text-sm text-white/55">افتح الملف العام كما يُقدَّم للزوّار.</p>
          </div>
          <a
            href={sitemapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#080B10]/70 px-4 py-2.5 text-sm font-semibold text-white/72 transition hover:border-white/18 hover:bg-white/[0.05]"
          >
            فتح /sitemap.xml
          </a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <h2 className="text-lg font-bold text-white">العناوين حسب المصدر</h2>
          <dl className="mt-4 space-y-3">
            {Object.entries(snapshot.countsBySource).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-white/68">{getSitemapSourceLabel(source as keyof typeof snapshot.countsBySource)}</dt>
                <dd className="font-en font-semibold text-white">{count}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
          <h2 className="text-lg font-bold text-white">سجلات مستبعدة (تقديري)</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/68">غير منشور</dt>
              <dd className="font-en font-semibold text-white">{snapshot.excludedCounts.unpublished}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/68">محذوف</dt>
              <dd className="font-en font-semibold text-white">{snapshot.excludedCounts.deleted}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/68">noindex (صفحات متابعة فردية)</dt>
              <dd className="font-en font-semibold text-white">{snapshot.excludedCounts.noindex}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/68">slug غير صالح أو مفقود</dt>
              <dd className="font-en font-semibold text-white">{snapshot.excludedCounts.invalidOrMissingSlug}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
        <h2 className="text-lg font-bold text-white">نتائج الفحص</h2>
        <div className="mt-4 space-y-3">
          {snapshot.checks.map((check) => (
            <div key={check.id} className="rounded-[14px] border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <AdminStatusPill tone={check.severity === "error" ? "red" : check.severity === "warning" ? "gold" : "green"}>
                  {severityLabel(check.severity)}
                </AdminStatusPill>
                <h3 className="text-sm font-bold text-white">{check.title}</h3>
                {typeof check.count === "number" ? (
                  <span className="text-xs text-white/45">({check.count})</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-7 text-white/68">{check.detail}</p>
              {check.samples && check.samples.length > 0 ? (
                <ul className="mt-3 space-y-1 font-en text-xs text-white/55" dir="ltr">
                  {check.samples.map((sample) => (
                    <li key={sample}>{sample}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-white/10 bg-[#080B10]/78 p-5">
        <h2 className="text-lg font-bold text-white">Google Search Console</h2>
        <p className="mt-2 text-sm text-white/62">Google Search Console integration is not connected.</p>
      </section>
    </main>
  );
}
