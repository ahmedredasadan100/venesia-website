import Link from "next/link";
import type { ReactNode } from "react";

import { getContentTypeLabel } from "../../../lib/admin/content/content-types";
import type {
  AdminDashboardModel,
  DashboardSourceStatus,
} from "../../../lib/admin/dashboard/dashboard-contract";
import AdminMetricCard, {
  type AdminMetricCardTone,
} from "../ui/AdminMetricCard";

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متاح";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function statusLabel(status?: string | null) {
  return status === "published" ? "منشور" : "غير منشور";
}

const SOURCE_STATUS_LABELS: Record<DashboardSourceStatus, string> = {
  ready: "جاهز",
  warning: "تحذير",
  unavailable: "غير متاح",
};

function SourceStatus({ status }: { status: DashboardSourceStatus }) {
  const classes = {
    ready: "border-emerald-400/24 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/24 bg-amber-400/10 text-amber-200",
    unavailable: "border-rose-400/24 bg-rose-400/10 text-rose-200",
  }[status];
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>
      {SOURCE_STATUS_LABELS[status]}
    </span>
  );
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

function EmptyTruth({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.025] px-4 py-7 text-center text-sm leading-7 text-white/48">
      {children}
    </div>
  );
}

function DashboardStateBanner({ model }: { model: AdminDashboardModel }) {
  const content = {
    ready: {
      title: "Dashboard جاهزة",
      body: "جميع مصادر الحقيقة المطلوبة نجحت في هذا الطلب.",
      classes: "border-emerald-400/24 bg-emerald-400/[0.07] text-emerald-100",
    },
    partial: {
      title: "Dashboard جزئية",
      body: "بعض المصادر غير مكتملة. القيم المتاحة مميزة بوضوح ولا توجد أصفار أوحالات نجاح بديلة.",
      classes: "border-amber-400/24 bg-amber-400/[0.07] text-amber-100",
    },
    unavailable: {
      title: "Dashboard غير متاحة",
      body: "تعذر تكوين Dashboard موثوقة. لم تُعرض بيانات ثابتة أوفارغة بدلًا من أخطاء المصادر.",
      classes: "border-rose-400/24 bg-rose-400/[0.07] text-rose-100",
    },
  }[model.state];

  return (
    <section
      className={`flex flex-col gap-3 rounded-[24px] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${content.classes}`}
      aria-live="polite"
    >
      <div>
        <h1 className="text-base font-semibold">{content.title}</h1>
        <p className="mt-1 text-xs leading-6 opacity-75">{content.body}</p>
      </div>
      <p className="shrink-0 font-en text-xs opacity-65">
        آخر فحص: {formatDate(model.checkedAt, true)}
      </p>
    </section>
  );
}

export default function AdminDashboardView({ model }: { model: AdminDashboardModel }) {
  const truth = model.readModel.data;
  const kpis: Array<{
    label: string;
    value: number | string;
    tone: AdminMetricCardTone;
  }> = truth
    ? [
        { label: "إجمالي المحتوى النشط", value: truth.kpis.topics.total, tone: "gold" },
        { label: "المحتوى المنشور", value: truth.kpis.topics.published, tone: "blue" },
        { label: "إجمالي المشاريع", value: truth.kpis.projects.total, tone: "green" },
        { label: "الصفحات", value: truth.kpis.pages.total, tone: "violet" },
        { label: "الميديا المدارة", value: truth.kpis.media.total, tone: "cyan" },
        { label: "التصنيفات المنشورة", value: truth.kpis.categories.published, tone: "amber" },
      ]
    : [
        "إجمالي المحتوى النشط",
        "المحتوى المنشور",
        "إجمالي المشاريع",
        "الصفحات",
        "الميديا المدارة",
        "التصنيفات النشطة",
      ].map((label, index) => ({
        label,
        value: "غير متاح",
        tone: (["gold", "blue", "green", "violet", "cyan", "amber"] as const)[index],
      }));

  const quickActions = [
    { href: "/admin/content/topics/new", label: "موضوع جديد", hint: "إضافة محتوى", icon: "+" },
    { href: "/admin/content/categories/new", label: "تصنيف جديد", hint: "تنظيم الشجرة", icon: "◇" },
    { href: "/admin/settings/general", label: "الإعدادات", hint: "بيانات النظام", icon: "⚙" },
  ];

  const distributions = truth
    ? [
        { label: "محتوى منشور", value: truth.kpis.topics.published, color: "bg-emerald-300" },
        { label: "محتوى غير منشور", value: truth.kpis.topics.unpublished, color: "bg-violet-300" },
        { label: "مشاريع منشورة", value: truth.kpis.projects.published, color: "bg-cyan-300" },
        { label: "مشاريع غير منشورة", value: truth.kpis.projects.unpublished, color: "bg-blue-300" },
        { label: "صفحات منشورة", value: truth.kpis.pages.published, color: "bg-[#D8B87A]" },
      ]
    : [];
  const maxDistribution = Math.max(1, ...distributions.map((item) => item.value));

  const sources = [model.readModel, model.audit, model.media] as const;

  return (
    <div className="space-y-5 pb-10" dir="rtl">
      <DashboardStateBanner model={model} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="مؤشرات Dashboard">
        {kpis.map((kpi) => (
          <AdminMetricCard key={kpi.label} {...kpi} align="start" />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1fr_.95fr]">
        <Panel title="إجراءات سريعة" subtitle="روابط تنفيذية لا تمثل بيانات تشغيلية">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-[20px] border border-[#D8B87A]/12 bg-white/[0.035] p-4 transition hover:border-[#D8B87A]/34 hover:bg-[#D8B87A]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl border border-[#D8B87A]/20 text-[#D8B87A]" aria-hidden>
                    {action.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{action.label}</span>
                    <span className="mt-1 block text-xs text-white/45">{action.hint}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="آخر النشاطات" subtitle="من مالك Audit الحقيقي فقط">
          {model.audit.data ? (
            model.audit.data.events.length ? (
              <ol className="space-y-3">
                {model.audit.data.events.map((event) => (
                  <li key={event.id} className="rounded-[20px] border border-white/10 bg-white/[0.028] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-6 text-white/78">{event.action}</p>
                      <time className="shrink-0 font-en text-[11px] text-white/38" dateTime={event.timestamp}>
                        {formatDate(event.timestamp, true)}
                      </time>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-white/48">
                      {event.actor} · {event.entity}
                      {event.outcome ? ` · ${event.outcome}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyTruth>Audit متاح، ولا توجد أحداث مسجلة.</EmptyTruth>
            )
          ) : (
            <EmptyTruth>{model.audit.message}</EmptyTruth>
          )}
          <Link
            href="/admin/activity-log"
            className="mt-4 inline-flex text-xs font-semibold text-[#D8B87A] hover:text-[#F4D99A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            فتح سجل النشاط
          </Link>
        </Panel>

        <Panel title="صحة المحتوى" subtitle="Counts حقيقية من نفس الـRead Model الذري">
          {truth ? (
            <div className="space-y-3">
              {[
                ["محتوى بدون صورة", truth.contentHealth.topicsMissingImage],
                ["محتوى بدون وصف SEO", truth.contentHealth.topicsMissingSeoDescription],
                ["تصنيفات نشطة بدون صورة", truth.contentHealth.categoriesMissingImage],
                ["غير منشور منذ أكثر من 30 يومًا", truth.contentHealth.staleUnpublished],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.028] px-4 py-3">
                  <span className="text-sm text-white/62">{label}</span>
                  <span className="font-en text-sm font-semibold text-[#D8B87A]">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyTruth>{model.readModel.message}</EmptyTruth>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Panel title="آخر المحتويات" subtitle="أحدث المحتويات حسب updated_at؛ ليست بديلًا عن Audit">
          {truth ? (
            truth.recentTopics.length ? (
              <div className="overflow-x-auto rounded-[22px] border border-white/10">
                <table className="min-w-[760px] w-full border-collapse text-right text-sm">
                  <thead className="bg-white/[0.045] text-white/42">
                    <tr>
                      <th className="px-4 py-3 font-medium">العنوان</th>
                      <th className="px-4 py-3 font-medium">النوع</th>
                      <th className="px-4 py-3 font-medium">التصنيف</th>
                      <th className="px-4 py-3 font-medium">الحالة</th>
                      <th className="px-4 py-3 font-medium">آخر تحديث</th>
                      <th className="px-4 py-3 font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {truth.recentTopics.map((topic) => (
                      <tr key={topic.id} className="hover:bg-white/[0.025]">
                        <td className="max-w-[290px] px-4 py-4 text-white/78"><span className="line-clamp-1">{topic.title}</span></td>
                        <td className="px-4 py-4 text-white/48">{getContentTypeLabel(topic.contentType)}</td>
                        <td className="px-4 py-4 text-white/48">{topic.category}</td>
                        <td className="px-4 py-4 text-white/62">{statusLabel(topic.status)}</td>
                        <td className="px-4 py-4 text-white/48">{formatDate(topic.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <Link className="text-[#D8B87A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]" href={`/admin/content/topics/${topic.id}`}>
                            تعديل
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyTruth>Read Model متاح ولا توجد محتويات حالية.</EmptyTruth>
            )
          ) : (
            <EmptyTruth>{model.readModel.message}</EmptyTruth>
          )}
        </Panel>

        <Panel title="ملخص المشاريع" subtitle="أحدث المشاريع من نفس الـRead Model">
          {truth ? (
            truth.recentProjects.length ? (
              <div className="space-y-3">
                {truth.recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/admin/projects/${project.id}`}
                    className="block rounded-[20px] border border-white/10 bg-white/[0.028] p-4 transition hover:border-[#D8B87A]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-en text-xs font-semibold text-[#D8B87A]">{project.code}</span>
                      <span className="text-xs text-white/42">{statusLabel(project.publicationStatus)}</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-white/72">{project.arabicName}</p>
                    <p className="mt-1 font-en text-[11px] text-white/35">{formatDate(project.updatedAt)}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyTruth>Read Model متاح ولا توجد مشاريع.</EmptyTruth>
            )
          ) : (
            <EmptyTruth>{model.readModel.message}</EmptyTruth>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <Panel title="حالة النظام" subtitle="Diagnostics فعلية مع المصدر ووقت الفحص">
          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.key} className="rounded-[20px] border border-white/10 bg-white/[0.028] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white/72">{source.label}</p>
                  <SourceStatus status={source.status} />
                </div>
                <p className="mt-2 text-xs leading-6 text-white/48">{source.message}</p>
                <p className="mt-2 break-all font-en text-[10px] leading-5 text-white/30">{source.source}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/35">
                  <span>{formatDate(source.checkedAt, true)}</span>
                  {source.href ? <Link href={source.href} className="text-[#D8B87A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">التشخيص</Link> : null}
                </div>
              </div>
            ))}
            <div className="rounded-[20px] border border-emerald-400/18 bg-emerald-400/[0.055] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white/72">Cache وRevalidation</p>
                <SourceStatus status="ready" />
              </div>
              <p className="mt-2 text-xs leading-6 text-white/48">{model.cache.message}</p>
              <p className="mt-2 font-en text-[10px] text-white/30">{model.cache.source}</p>
            </div>
          </div>
        </Panel>

        <Panel title="توزيع الحالات" subtitle="توزيع مشتق من الـRead Model الحالي، بلا chart ثابت">
          {truth ? (
            <div className="space-y-4">
              {distributions.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-white/58">{item.label}</span>
                    <span className="font-en font-semibold text-white/75">{item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / maxDistribution) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 p-3 text-xs text-white/52">
                  ميديا سليمة: <span className="font-en text-white/80">{truth.kpis.media.active}</span>
                </div>
                <div className="rounded-[18px] border border-white/10 p-3 text-xs text-white/52">
                  مشاكل ميديا: <span className="font-en text-white/80">{truth.kpis.media.issues}</span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyTruth>{model.readModel.message}</EmptyTruth>
          )}
        </Panel>
      </section>
    </div>
  );
}
