import Link from "next/link";
import type { ReactNode } from "react";
import PublicMediaImage from "../../public/PublicMediaImage";

import { getContentTypeLabel } from "../../../lib/admin/content/content-types";
import type {
  AdminDashboardModel,
  DashboardSourceStatus,
} from "../../../lib/admin/dashboard/dashboard-contract";
import AdminMetricCard, {
  type AdminMetricCardTone,
} from "../ui/AdminMetricCard";
import AdminActionButton from "../ui/AdminActionButton";
import AdminPageContextHeader from "../ui/AdminPageContextHeader";
import AdminStatusPill from "../ui/AdminStatusPill";
import {
  AdminModuleTabIcon,
  type AdminModuleTabIconName,
} from "../ui/AdminModuleTabs";
import { ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME } from "../../../lib/admin/admin-ui-styles";
import {
  adminDataGridActionsColumn,
  AdminDataGrid,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridRowActions,
  type AdminRowActionsCapability,
} from "../ui";
import { formatAdminDateTime } from "../../../lib/content-dates";

// This bounded Dashboard snapshot groups metadata below its title. The table
// primary presets reserve 260px+ for a single-line identity; a wrapping track
// preserves the full title on Mobile without a redundant horizontal scrollbar.
const RECENT_CONTENT_COLUMNS = `minmax(0,1fr) ${adminDataGridActionsColumn(2, "compact")}`;

// Presentation excerpts only. The existing read owners and full-list routes
// retain all data; no query limit or collection capability changes here.
const DASHBOARD_EXCERPT_SIZE = 4;

const DASHBOARD_LINK_CLASS_NAME =
  "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/8 hover:text-[#F4D99A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]";

function DashboardThumbnail({
  image,
  imageAlt,
  icon,
}: {
  image?: string | null;
  imageAlt?: string | null;
  icon: AdminModuleTabIconName;
}) {
  return (
    <span
      data-dashboard-thumbnail
      className="relative block h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-[#D8B87A]/20 bg-[#D8B87A]/8"
    >
      <span className="absolute inset-0 grid place-items-center text-[#D8B87A]/65" aria-hidden="true">
        <span className="size-5"><AdminModuleTabIcon name={icon} /></span>
      </span>
      {image ? (
        <PublicMediaImage
          src={image}
          alt={imageAlt ?? ""}
          fill
          sizes="40px"
          composition="cover-center"
          fallbackSrc={null}
        />
      ) : null}
    </span>
  );
}

function statusLabel(status?: string | null) {
  return status === "published" ? "منشور" : "غير منشور";
}

const SOURCE_STATUS_LABELS: Record<DashboardSourceStatus, string> = {
  ready: "جاهز",
  warning: "تحذير",
  unavailable: "غير متاح",
};

function SourceStatus({
  status,
  label,
}: {
  status: DashboardSourceStatus;
  label?: string;
}) {
  const classes = {
    ready: "border-emerald-400/24 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/24 bg-amber-400/10 text-amber-200",
    unavailable: "border-rose-400/24 bg-rose-400/10 text-rose-200",
  }[status];
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label ?? SOURCE_STATUS_LABELS[status]}
    </span>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
  href,
  linkLabel = "عرض الكل",
  badge,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  href?: string;
  linkLabel?: string;
  badge?: ReactNode;
}) {
  return (
    <section
      data-dashboard-panel={title}
      className={`flex min-w-0 flex-col p-4 sm:p-5 ${ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME} ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-white/8 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white/90">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-6 text-white/45">{subtitle}</p>
          ) : null}
        </div>
        {badge}
        {href ? (
          <Link
            href={href}
            aria-label={`${linkLabel} — ${title}`}
            className={DASHBOARD_LINK_CLASS_NAME}
          >
            {linkLabel}
            <span aria-hidden="true">‹</span>
          </Link>
        ) : null}
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
  if (model.state === "ready") return null;

  const content = {
    partial: {
      title: "Dashboard جزئية",
      body: "بعض المصادر غير مكتملة. القيم المتاحة مميزة بوضوح ولا توجد أصفار أو حالات نجاح بديلة.",
      classes: "border-amber-400/24 bg-amber-400/[0.07] text-amber-100",
    },
    unavailable: {
      title: "Dashboard غير متاحة",
      body: "تعذر تكوين Dashboard موثوقة. لم تُعرض بيانات ثابتة أو فارغة بدلًا من أخطاء المصادر.",
      classes: "border-rose-400/24 bg-rose-400/[0.07] text-rose-100",
    },
  }[model.state];

  return (
    <section
      data-dashboard-state-banner={model.state}
      className={`flex flex-col gap-3 rounded-[24px] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${content.classes}`}
      aria-live="polite"
    >
      <div>
        <h2 className="text-base font-semibold">{content.title}</h2>
        <p className="mt-1 text-xs leading-6 opacity-75">{content.body}</p>
      </div>
      <time dateTime={model.checkedAt} className="shrink-0 text-xs opacity-65">
        بدء الطلب: {formatAdminDateTime(model.checkedAt)}
      </time>
    </section>
  );
}

export default function AdminDashboardView({
  model,
}: {
  model: AdminDashboardModel;
}) {
  const truth = model.readModel.data;
  const metricDefinitions: Array<{
    label: string;
    tone: AdminMetricCardTone;
    icon: AdminModuleTabIconName;
    value: number | undefined;
  }> = [
    {
      label: "إجمالي المحتوى النشط",
      value: truth?.kpis.topics.total,
      tone: "gold",
      icon: "content",
    },
    {
      label: "المحتوى المنشور",
      value: truth?.kpis.topics.published,
      tone: "blue",
      icon: "publish",
    },
    {
      label: "إجمالي المشاريع",
      value: truth?.kpis.projects.total,
      tone: "green",
      icon: "plans",
    },
    {
      label: "الصفحات",
      value: truth?.kpis.pages.total,
      tone: "violet",
      icon: "content",
    },
    {
      label: "الميديا المدارة",
      value: truth?.kpis.media.total,
      tone: "cyan",
      icon: "media",
    },
    {
      label: "التصنيفات المنشورة",
      value: truth?.kpis.categories.published,
      tone: "amber",
      icon: "specifications",
    },
  ];
  const quickActions: Array<{
    href: string;
    label: string;
    hint: string;
    icon: AdminModuleTabIconName;
  }> = [
    {
      href: "/admin/content/topics/new",
      label: "موضوع جديد",
      hint: "إضافة محتوى",
      icon: "content",
    },
    {
      href: "/admin/content/categories/new",
      label: "تصنيف جديد",
      hint: "تنظيم الشجرة",
      icon: "specifications",
    },
    {
      href: "/admin/settings/general",
      label: "الإعدادات",
      hint: "بيانات النظام",
      icon: "settings",
    },
  ];
  const distributions = truth
    ? [
        {
          label: "محتوى منشور",
          value: truth.kpis.topics.published,
          color: "#D8B87A",
        },
        {
          label: "محتوى غير منشور",
          value: truth.kpis.topics.unpublished,
          color: "#B99AE9",
        },
        {
          label: "مشاريع منشورة",
          value: truth.kpis.projects.published,
          color: "#64A5E8",
        },
        {
          label: "مشاريع غير منشورة",
          value: truth.kpis.projects.unpublished,
          color: "#4EC6B4",
        },
        {
          label: "صفحات منشورة",
          value: truth.kpis.pages.published,
          color: "#E8C785",
        },
      ]
    : [];
  // Geometry only: all displayed counts still come from the canonical read model.
  const distributionTotal = distributions.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const circumference = 2 * Math.PI * 42;
  const sources = [model.readModel, model.audit, model.media] as const;

  return (
    <div className="min-w-0 space-y-5 pb-5" dir="rtl" data-admin-dashboard>
      <AdminPageContextHeader
        title="لوحة التحكم"
        description="نظرة شاملة على المحتوى والمشاريع وحالة مصادر النظام."
        actions={quickActions.map((action) => (
          <AdminActionButton
            key={action.href}
            href={action.href}
            title={action.hint}
            variant="gold-ghost"
          >
            <span className="size-4 shrink-0" aria-hidden="true">
              <AdminModuleTabIcon name={action.icon} />
            </span>
            {action.label}
          </AdminActionButton>
        ))}
      />
      <DashboardStateBanner model={model} />
      <section
        className="grid min-w-0 auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        aria-label="مؤشرات Dashboard"
      >
        {metricDefinitions.map(({ icon, value, ...metric }) => (
          <AdminMetricCard
            key={metric.label}
            {...metric}
            value={value ?? "غير متاح"}
            align="start"
            icon={<AdminModuleTabIcon name={icon} />}
          />
        ))}
      </section>

      <section
        className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3"
        aria-label="ملخص المحتوى والمشاريع"
      >
        <Panel
          title="آخر المحتويات"
          subtitle="أحدث 4 محتويات حسب آخر تحديث"
          href="/admin/content/topics"
          className="lg:col-span-2 xl:col-span-1"
        >
          {truth ? (
            truth.recentTopics.length ? (
              <AdminDataGrid
                surface="embedded"
                scrollLabel="آخر المحتويات"
                className="flex-1 [&>div]:h-full"
              >
                {truth.recentTopics
                  .slice(0, DASHBOARD_EXCERPT_SIZE)
                  .map((topic) => {
                    const hidden = { access: "hidden" as const };
                    const capability: AdminRowActionsCapability = {
                      entityType: "dashboard_recent_topic",
                      entityId: topic.id,
                      entityLabel: topic.title,
                      actions: {
                        edit: {
                          access: "allowed",
                          href: `/admin/content/topics/${topic.id}`,
                        },
                        preview: hidden,
                        information: {
                          access: "allowed",
                          title: `معلومات ${topic.title}`,
                          items: [
                            {
                              label: "النوع",
                              value: getContentTypeLabel(topic.contentType),
                            },
                            { label: "التصنيف", value: topic.category },
                            { label: "الحالة", value: statusLabel(topic.status) },
                            {
                              label: "آخر تحديث",
                              value: formatAdminDateTime(topic.updatedAt),
                            },
                          ],
                        },
                        copyPublicLink: hidden,
                        visibility: hidden,
                        featured: hidden,
                        duplicate: hidden,
                        archive: hidden,
                        delete: hidden,
                      },
                    };
                    return (
                      <AdminDataGridRow
                        key={topic.id}
                        columns={RECENT_CONTENT_COLUMNS}
                        divided
                        stickyActions={false}
                      >
                        <AdminDataGridPrimaryCell className="pe-2">
                          <div className="flex items-start gap-3">
                            <DashboardThumbnail image={topic.image} imageAlt={topic.imageAlt} icon="media" />
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="break-words text-sm font-semibold leading-6 text-white/85 [overflow-wrap:anywhere]">
                                {topic.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-white/50">
                                <span>{getContentTypeLabel(topic.contentType)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="break-words [overflow-wrap:anywhere]">
                                  {topic.category}
                                </span>
                                <span className="text-[#D8B87A]/85">
                                  {statusLabel(topic.status)}
                                </span>
                              </div>
                              <time
                                dateTime={topic.updatedAt}
                                className="block text-[11px] text-white/45"
                              >
                                {formatAdminDateTime(topic.updatedAt)}
                              </time>
                            </div>
                          </div>
                        </AdminDataGridPrimaryCell>
                        <AdminDataGridRowActions
                          capability={capability}
                          size="compact"
                        />
                      </AdminDataGridRow>
                    );
                  })}
              </AdminDataGrid>
            ) : (
              <EmptyTruth>Read Model متاح ولا توجد محتويات حالية.</EmptyTruth>
            )
          ) : (
            <EmptyTruth>{model.readModel.message}</EmptyTruth>
          )}
        </Panel>

        <Panel title="توزيع الحالات" subtitle="حالات النشر من القراءة الحالية">
          {truth ? (
            <div className="flex flex-1 flex-col justify-evenly gap-6 py-2">
              <div className="relative mx-auto aspect-square w-full max-w-56">
                <svg
                  viewBox="0 0 100 100"
                  className="size-full -rotate-90"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="13"
                  />
                  {distributions.map((item, index) => {
                    const offset = distributions
                      .slice(0, index)
                      .reduce((sum, preceding) => sum + preceding.value, 0);
                    return (
                      <circle
                        key={item.label}
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="13"
                        strokeDasharray={`${distributionTotal ? item.value / distributionTotal * circumference : 0} ${circumference}`}
                        strokeDashoffset={
                          distributionTotal
                            ? -offset / distributionTotal * circumference
                            : 0
                        }
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="size-7 text-[#D8B87A]" aria-hidden="true">
                    <AdminModuleTabIcon name="statistics" />
                  </span>
                  <span className="text-sm font-semibold text-white/80">
                    توزيع النشر
                  </span>
                  <span className="text-[11px] text-white/45">
                    المحتوى · المشاريع · الصفحات
                  </span>
                </div>
              </div>
              <dl className="space-y-4">
                {distributions.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <dt className="flex min-w-0 items-center gap-2 text-white/60">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </dt>
                    <dd className="font-en font-semibold tabular-nums text-white/85">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <EmptyTruth>{model.readModel.message}</EmptyTruth>
          )}
        </Panel>

        <Panel
          title="ملخص المشاريع"
          subtitle="أحدث المشاريع"
          href="/admin/projects"
        >
          {truth ? (
            truth.recentProjects.length ? (
              <div className="grid flex-1 auto-rows-fr divide-y divide-white/8">
                {truth.recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/admin/projects/${project.id}`}
                    className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-4 transition hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B87A] first:pt-0 last:pb-0"
                  >
                    <DashboardThumbnail image={project.image} imageAlt={project.imageAlt} icon="plans" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[#D8B87A]">
                          <span
                            dir="ltr"
                            className="font-en text-sm font-semibold"
                          >
                            {project.code}
                          </span>
                        </span>
                        <AdminStatusPill
                          tone={
                            project.publicationStatus === "published"
                              ? "green"
                              : "muted"
                          }
                        >
                          {statusLabel(project.publicationStatus)}
                        </AdminStatusPill>
                      </div>
                      <p className="break-words text-sm leading-6 text-white/75 [overflow-wrap:anywhere]">
                        {project.arabicName}
                      </p>
                      <time
                        dateTime={project.updatedAt}
                        title="آخر تحديث لبيانات المشروع"
                        className="block text-[11px] text-white/45"
                      >
                        تحديث البيانات:{" "}
                        {formatAdminDateTime(project.updatedAt)}
                      </time>
                    </div>
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

      <section
        className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3"
        aria-label="حالة النظام والنشاط"
      >
        <Panel
          title="حالة النظام"
          badge={
            <span role="status" data-dashboard-readiness-summary={model.state}>
              <SourceStatus
                status={
                  model.state === "ready"
                    ? "ready"
                    : model.state === "partial"
                      ? "warning"
                      : "unavailable"
                }
                label={
                  model.state === "ready"
                    ? "قراءة المصادر ناجحة"
                    : model.state === "partial"
                      ? "قراءة جزئية"
                      : "القراءة غير متاحة"
                }
              />
            </span>
          }
        >
          <div className="grid flex-1 content-between divide-y divide-white/8">
            {sources.map((source) => (
              <div key={source.key} className="min-w-0 py-3 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/75">
                    {source.label}
                  </p>
                  <SourceStatus status={source.status} />
                </div>
                <p className="mt-2 text-xs leading-6 text-white/50">
                  {source.message}
                </p>
                <p
                  className="mt-1 break-words text-[10px] leading-5 text-white/35 [overflow-wrap:anywhere]"
                  dir="ltr"
                >
                  {source.source}
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/45">
                  <time dateTime={source.checkedAt}>
                    توقيت المصدر: {formatAdminDateTime(source.checkedAt)}
                  </time>
                  {source.href ? (
                    <Link
                      href={source.href}
                      aria-label={`التشخيص — ${source.label}`}
                      className={DASHBOARD_LINK_CLASS_NAME}
                    >
                      التشخيص
                      <span aria-hidden="true">‹</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
            <div className="py-3 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white/75">
                  Cache وRevalidation
                </p>
                <SourceStatus status="ready" />
              </div>
              <p className="mt-2 text-xs leading-6 text-white/50">
                نجاح القراءة لا يثبت حداثة التشخيصات المحفوظة. طلب الخادم الجديد
                يعيد القراءة؛ العودة قد تعرض لقطة سابقة.
              </p>
              <p
                className="mt-1 break-words text-[10px] leading-5 text-white/35 [overflow-wrap:anywhere]"
                dir="ltr"
              >
                {model.cache.source}
              </p>
              <time
                dateTime={model.checkedAt}
                className="mt-1 block text-[11px] text-white/45"
              >
                بدء الطلب: {formatAdminDateTime(model.checkedAt)}
              </time>
            </div>
          </div>
        </Panel>

        <Panel
          title="آخر النشاطات"
          subtitle="أحدث 4 أحداث من مالك Audit الحقيقي فقط"
          href="/admin/activity-log"
          linkLabel="فتح سجل النشاط"
        >
          {model.audit.data ? (
            model.audit.data.events.length ? (
              <ol className="grid flex-1 auto-rows-fr divide-y divide-white/8">
                {model.audit.data.events
                  .slice(0, DASHBOARD_EXCERPT_SIZE)
                  .map((event) => (
                    <li
                      key={event.id}
                      className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/[0.035] text-white/50"
                        aria-hidden="true"
                      >
                        <span className="size-4">
                          <AdminModuleTabIcon name="content" />
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-6 text-white/80 [overflow-wrap:anywhere]">
                          {event.action}
                        </p>
                        <p className="mt-1 break-words text-xs leading-6 text-white/50 [overflow-wrap:anywhere]">
                          {event.actor} · {event.entity}
                          {event.outcome ? ` · ${event.outcome}` : ""}
                        </p>
                        <time
                          className="mt-1 block text-[11px] text-white/45"
                          dateTime={event.timestamp}
                        >
                          {formatAdminDateTime(event.timestamp)}
                        </time>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <EmptyTruth>Audit متاح، ولا توجد أحداث مسجلة.</EmptyTruth>
            )
          ) : (
            <EmptyTruth>{model.audit.message}</EmptyTruth>
          )}
        </Panel>

        <div className="grid min-w-0 gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
          <Panel
            title="تشخيص الميديا"
            badge={<SourceStatus status={model.media.status} />}
          >
            {truth ? (
              <dl className="grid flex-1 grid-cols-2 items-center gap-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <dt className="text-xs leading-6 text-white/50">ميديا سليمة</dt>
                  <dd className="mt-3 font-en text-3xl font-semibold tabular-nums text-white/90">
                    {truth.kpis.media.active}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <dt className="text-xs leading-6 text-white/50">مشاكل ميديا</dt>
                  <dd className="mt-3 font-en text-3xl font-semibold tabular-nums text-white/90">
                    {truth.kpis.media.issues}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyTruth>{model.readModel.message}</EmptyTruth>
            )}
            <p className="mt-3 text-xs leading-6 text-white/50">
              توقيت التشخيص المحفوظ:{" "}
              {model.media.data?.lastUpdatedAt ? (
                <time dateTime={model.media.data.lastUpdatedAt}>
                  {formatAdminDateTime(model.media.data.lastUpdatedAt)}
                </time>
              ) : (
                "التوقيت غير متاح"
              )}
            </p>
            <Link
              href="/admin/settings/media"
              className={`${DASHBOARD_LINK_CLASS_NAME} mt-2 self-start`}
            >
              إعدادات وتشخيص الميديا
              <span aria-hidden="true">‹</span>
            </Link>
          </Panel>
          <Panel title="صحة المحتوى" subtitle="مؤشرات من نفس القراءة الحالية">
            {truth ? (
              <dl className="grid flex-1 auto-rows-fr divide-y divide-white/8">
                {[
                  ["محتوى بدون صورة", truth.contentHealth.topicsMissingImage],
                  [
                    "محتوى بدون وصف SEO",
                    truth.contentHealth.topicsMissingSeoDescription,
                  ],
                  [
                    "غير منشور منذ أكثر من 30 يومًا",
                    truth.contentHealth.staleUnpublished,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <dt className="text-xs leading-6 text-white/60">{label}</dt>
                    <dd className="font-en text-sm font-semibold tabular-nums text-[#D8B87A]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyTruth>{model.readModel.message}</EmptyTruth>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
