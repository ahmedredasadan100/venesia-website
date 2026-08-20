"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  IntegrationCategory,
  IntegrationConnectionStatus,
  IntegrationKey,
  IntegrationSnapshotItem,
  IntegrationsSnapshot,
} from "../../../lib/admin/integrations/integrations-contract";
import { isIntegrationAppConfigurationAuthorizationReady } from "../../../lib/admin/integrations/server-configuration-contract";
import { formatAdminDateTime } from "../../../lib/content-dates";
import {
  AdminPageContextHeader,
  AdminPageExperience,
  AdminListboxSelect,
  AdminStatusPill,
} from "../ui";
import IntegrationBrandIcon from "./IntegrationBrandIcon";

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  analytics: "التحليلات",
  advertising: "الإعلانات",
  communication: "التواصل",
  crm: "CRM",
};

const STATUS_LABELS: Record<IntegrationConnectionStatus, string> = {
  authorizing: "بدء التفويض",
  authorized_unbound: "تم التفويض",
  discovering_assets: "اكتشاف الأصول",
  pending_selection: "اختيار الأصول",
  testing: "اختبار الاتصال",
  connected: "متصل",
  disconnected: "غير متصل",
  needs_configuration: "يحتاج إعدادًا",
  needs_reauth: "إعادة تفويض",
  needs_attention: "يحتاج انتباه",
  syncing: "جارٍ المزامنة",
  unavailable: "غير متاح",
};

const STATUS_TONES: Record<
  IntegrationConnectionStatus,
  "green" | "muted" | "red" | "blue" | "gold"
> = {
  authorizing: "blue",
  authorized_unbound: "blue",
  discovering_assets: "blue",
  pending_selection: "gold",
  testing: "gold",
  connected: "green",
  disconnected: "muted",
  needs_configuration: "gold",
  needs_reauth: "red",
  needs_attention: "red",
  syncing: "gold",
  unavailable: "muted",
};

const STATUS_DOTS: Record<IntegrationConnectionStatus, string> = {
  authorizing: "bg-sky-400 shadow-[0_0_0_5px_rgba(56,189,248,.10)]",
  authorized_unbound: "bg-sky-400 shadow-[0_0_0_5px_rgba(56,189,248,.10)]",
  discovering_assets: "bg-sky-400 shadow-[0_0_0_5px_rgba(56,189,248,.10)]",
  pending_selection: "bg-[#D8B87A] shadow-[0_0_0_5px_rgba(216,184,122,.10)]",
  testing: "bg-[#D8B87A] shadow-[0_0_0_5px_rgba(216,184,122,.10)]",
  connected: "bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,.10)]",
  disconnected: "bg-white/28 shadow-[0_0_0_5px_rgba(255,255,255,.04)]",
  needs_configuration: "bg-[#D8B87A] shadow-[0_0_0_5px_rgba(216,184,122,.10)]",
  needs_reauth: "bg-rose-400 shadow-[0_0_0_5px_rgba(251,113,133,.10)]",
  needs_attention: "bg-rose-400 shadow-[0_0_0_5px_rgba(251,113,133,.10)]",
  syncing: "bg-[#D8B87A] shadow-[0_0_0_5px_rgba(216,184,122,.10)]",
  unavailable: "bg-white/28 shadow-[0_0_0_5px_rgba(255,255,255,.04)]",
};

type CategoryFilter = "all" | IntegrationCategory;
type StatusFilter = "all" | IntegrationConnectionStatus;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3 5.5 5.8v5.3c0 4.1 2.6 7.8 6.5 9.9 3.9-2.1 6.5-5.8 6.5-9.9V5.8L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IntegrationOverviewVisual() {
  const satellites: Array<{ key: IntegrationKey; className: string }> = [
    { key: "google_analytics", className: "right-3 top-3" },
    { key: "meta_business", className: "left-3 top-3" },
    { key: "tiktok_ads", className: "right-3 bottom-3" },
    { key: "whatsapp_business", className: "left-3 bottom-3" },
  ];
  return (
    <div
      className="relative mx-auto h-[188px] w-full max-w-[270px] overflow-hidden rounded-[28px] border border-white/9 bg-[radial-gradient(circle_at_center,rgba(216,184,122,.12),transparent_58%)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:26px_26px]" />
      <svg
        viewBox="0 0 270 188"
        className="absolute inset-0 h-full w-full text-[#D8B87A]/30"
        fill="none"
      >
        <path
          d="M57 47 135 94l78-47M57 141l78-47 78 47"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 7"
        />
        <circle
          cx="135"
          cy="94"
          r="46"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 8"
        />
      </svg>
      <div className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[26px] border border-[#D8B87A]/28 bg-[#D8B87A]/[0.10] text-[#E4C683] shadow-[0_0_70px_rgba(216,184,122,.14)]">
        <svg viewBox="0 0 48 48" className="size-10" fill="none">
          <circle
            cx="13"
            cy="14"
            r="5"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle
            cx="35"
            cy="14"
            r="5"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle
            cx="24"
            cy="35"
            r="5"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="m17 17 4 13m10-13-4 13M18 14h12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {satellites.map((item) => (
        <div
          key={item.key}
          className={`absolute scale-[.68] ${item.className}`}
        >
          <IntegrationBrandIcon integration={item.key} />
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "default" | "green" | "red" | "gold";
}) {
  const toneClasses = {
    default: "border-white/9 from-white/[0.045]",
    green: "border-emerald-400/15 from-emerald-400/[0.07]",
    red: "border-rose-400/15 from-rose-400/[0.07]",
    gold: "border-[#D8B87A]/18 from-[#D8B87A]/[0.07]",
  }[tone];
  return (
    <article
      className={`min-h-[118px] rounded-[22px] border bg-gradient-to-bl to-transparent p-4 shadow-[0_18px_55px_rgba(0,0,0,.18)] ${toneClasses}`}
    >
      <p className="text-[10px] font-semibold text-white/42">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-[10px] leading-5 text-white/34">{helper}</p>
    </article>
  );
}

function DisabledAction({
  children,
  reason,
}: {
  children: string;
  reason: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/8 bg-white/[0.025] px-3 text-[11px] font-semibold text-white/27"
    >
      {children}
    </button>
  );
}

function IntegrationAction({
  href,
  children,
}: {
  href: string | null;
  children: string;
}) {
  if (!href) {
    return (
      <DisabledAction reason="يتطلب Connection Adapter آمنًا ومفعّلًا داخل المالك الحالي.">
        {children}
      </DisabledAction>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/[0.045] px-3 text-[11px] font-semibold text-white/65 transition hover:border-[#D8B87A]/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
    >
      {children}
    </Link>
  );
}

function IntegrationCard({ item }: { item: IntegrationSnapshotItem }) {
  const reportsAvailable = item.reportsAvailable;
  const configureLabel =
    item.appConfigurationStatus !== null &&
    isIntegrationAppConfigurationAuthorizationReady({
      status: item.appConfigurationStatus,
      lastTestedAt: item.appConfigurationLastTestedAt,
    })
      ? "إدارة الاتصال"
      : "إعداد App";
  return (
    <article className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[24px] border border-white/9 bg-gradient-to-bl from-white/[0.045] to-[#080B10]/78 p-5 shadow-[0_22px_70px_rgba(0,0,0,.20)] transition hover:-translate-y-1 hover:border-[#D8B87A]/25">
      <div
        className="absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-[#D8B87A]/40 to-transparent opacity-0 transition group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="flex items-start gap-4">
        <IntegrationBrandIcon integration={item.key} />
        <div className="min-w-0 flex-1 pt-1">
          <p className="font-en truncate text-[15px] font-semibold text-white">
            {item.label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AdminStatusPill tone={STATUS_TONES[item.status]}>
              <span
                className={`ms-1.5 inline-block size-1.5 rounded-full ${STATUS_DOTS[item.status]}`}
                aria-hidden="true"
              />
              {STATUS_LABELS[item.status]}
            </AdminStatusPill>
            <span className="text-[9px] font-semibold text-[#D8B87A]/55">
              {CATEGORY_LABELS[item.category]}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 min-h-11 text-[11px] leading-6 text-white/42">
        {item.description}
      </p>
      <div className="mt-3 border-t border-white/7 pt-3">
        <div className="flex items-center justify-between gap-3 text-[10px]">
          <span className="font-semibold text-white/32">آخر مزامنة</span>
          <span className="font-en text-white/50">
            {item.lastSyncAt
              ? formatAdminDateTime(item.lastSyncAt)
              : "لا توجد مزامنة"}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-white/32">
          {item.message}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <IntegrationAction href={item.configureHref}>
          {configureLabel}
        </IntegrationAction>
        <IntegrationAction href={item.testHref}>
          اختبار الاتصال
        </IntegrationAction>
        {reportsAvailable ? (
          <Link
            href={item.reportsHref}
            className="col-span-2 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[#D8B87A]/22 bg-[#D8B87A]/[0.075] px-3 text-[11px] font-semibold text-[#E8CF9A] transition hover:border-[#D8B87A]/42 hover:bg-[#D8B87A]/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            عرض التقارير
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function AdminIntegrationsPlatform({
  snapshot,
}: {
  snapshot: IntegrationsSnapshot;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");

  const visibleIntegrations = useMemo(
    () =>
      snapshot.integrations.filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          [item.label, item.description, CATEGORY_LABELS[item.category]]
            .join(" ")
            .toLocaleLowerCase("ar")
            .includes(normalizedQuery);
        return (
          matchesQuery &&
          (category === "all" || item.category === category) &&
          (status === "all" || item.status === status)
        );
      }),
    [category, normalizedQuery, snapshot.integrations, status],
  );

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setStatus("all");
  };

  const securityReady = snapshot.security === "guarded";

  return (
    <AdminPageExperience className="min-w-0 pb-12" dir="rtl">
      <AdminPageContextHeader
        eyebrow="INTEGRATIONS PLATFORM"
        title="التكاملات والربط الخارجي"
        description="إدارة جميع اتصالات المنصات الخارجية من مكان واحد. التقارير لا تتصل بالمزودين مباشرة؛ بياناتها تمر فقط عبر Analytics Contract والـAdapter Registry المعتمد."
        meta={`العقد ${snapshot.contractVersion}`}
        actions={
          <Link
            href="/admin/settings/integrations/server-configuration"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#D8B87A]/24 px-4 text-xs font-semibold text-[#E8CF9A] hover:border-[#D8B87A]/42 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            إعدادات الربط على السيرفر
          </Link>
        }
        status={snapshot.state === "ready" ? "ready" : "error"}
      />

      <section
        data-testid="integrations-overview"
        aria-labelledby="integrations-overview-heading"
        className="overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-bl from-white/[0.045] via-[#09101A]/82 to-[#070A0F] p-5 shadow-[0_26px_90px_rgba(0,0,0,.24)] lg:p-6"
      >
        <div className="grid items-center gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <h2
              id="integrations-overview-heading"
              className="text-lg font-semibold text-white"
            >
              نظرة عامة
            </h2>
            <p className="mt-2 text-xs leading-6 text-white/42">
              حالة الاتصال والمزامنة كما تعيدها الملاك المعتمدة، دون أرقام
              تجريبية أو نجاح افتراضي.
            </p>
            <div className="mt-4">
              <IntegrationOverviewVisual />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <MetricCard
              label="إجمالي التكاملات"
              value={snapshot.statistics.total}
              helper="منصات المرحلة الأولى فقط"
              tone="gold"
            />
            <MetricCard
              label="المتصل"
              value={snapshot.statistics.connected}
              helper="اتصال مثبت بمصدر حقيقي"
              tone="green"
            />
            <MetricCard
              label="يحتاج انتباه"
              value={snapshot.statistics.needsAttention}
              helper="تعذر الفحص أو مصدر جزئي"
              tone={snapshot.statistics.needsAttention ? "red" : "default"}
            />
            <MetricCard
              label="غير المتصل"
              value={snapshot.statistics.disconnected}
              helper="لا يوجد Adapter مفعّل"
            />
            <MetricCard
              label="حالة الأمان"
              value={securityReady ? "محمي" : "مراجعة"}
              helper="الأسرار لا تنتقل إلى العميل"
              tone={securityReady ? "green" : "red"}
            />
            <MetricCard
              label="آخر مزامنة"
              value={snapshot.lastSyncAt ? "متاحة" : "لا توجد"}
              helper={
                snapshot.lastSyncAt
                  ? formatAdminDateTime(snapshot.lastSyncAt)
                  : "لا توجد مزامنة"
              }
            />
          </div>
        </div>
      </section>

      {snapshot.state !== "ready" ? (
        <div
          role="status"
          className="rounded-[20px] border border-amber-300/16 bg-amber-300/[0.055] px-5 py-4 text-xs leading-6 text-amber-100/70"
        >
          حالة المنصة جزئية لأن Connection Aggregate أو Vault أو Migration proof
          غير متاح بالكامل. لا تُستنتج حالة اتصال من Analytics.
        </div>
      ) : null}

      <section
        aria-labelledby="available-integrations-heading"
        className="space-y-4"
      >
        <div className="rounded-[26px] border border-white/9 bg-[#080B10]/70 p-4 shadow-[0_20px_65px_rgba(0,0,0,.18)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2
                  id="available-integrations-heading"
                  className="text-lg font-semibold text-white"
                >
                  التكاملات المتاحة
                </h2>
                <span className="rounded-full border border-[#D8B87A]/18 bg-[#D8B87A]/[0.06] px-2.5 py-1 font-en text-[10px] text-[#E4C683]">
                  {visibleIntegrations.length}/{snapshot.integrations.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-white/35">
                البحث والتصفية يعملان على كتالوج المرحلة الأولى دون تغيير مصدر
                الحقيقة.
              </p>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:max-w-[820px] xl:grid-cols-[minmax(250px,1fr)_170px_170px_auto]">
              <label className="relative block sm:col-span-2 xl:col-span-1">
                <span className="sr-only">البحث في التكاملات</span>
                <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-white/32">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="بحث في التكاملات..."
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 pe-11 ps-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#D8B87A]/42 focus:ring-2 focus:ring-[#D8B87A]/12"
                />
              </label>

              <AdminListboxSelect
                value={category}
                onChange={(value) => setCategory(value as CategoryFilter)}
                options={[
                  { value: "all", label: "كل الفئات" },
                  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                ariaLabel="فلترة حسب الفئة"
              />

              <AdminListboxSelect
                value={status}
                onChange={(value) => setStatus(value as StatusFilter)}
                options={[
                  { value: "all", label: "كل الحالات" },
                  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                ariaLabel="فلترة حسب حالة الاتصال"
              />

              <button
                type="button"
                onClick={resetFilters}
                disabled={!query && category === "all" && status === "all"}
                className="min-h-11 cursor-pointer rounded-xl border border-[#D8B87A]/18 bg-[#D8B87A]/[0.055] px-4 text-[11px] font-semibold text-[#E5CA91] transition hover:border-[#D8B87A]/35 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
              >
                إعادة التعيين
              </button>
            </div>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          تم العثور على {visibleIntegrations.length} تكامل
        </p>
        {visibleIntegrations.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleIntegrations.map((item) => (
              <IntegrationCard key={item.key} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
            <p className="text-sm font-semibold text-white/65">
              لا توجد تكاملات تطابق البحث الحالي
            </p>
            <p className="mt-2 text-xs leading-6 text-white/38">
              غيّر الفلاتر أو أعد تعيينها لعرض المنصات التسع المعتمدة.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 cursor-pointer rounded-xl border border-[#D8B87A]/25 px-4 py-2 text-xs font-semibold text-[#E5CA91] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
            >
              عرض كل التكاملات
            </button>
          </div>
        )}
      </section>

      <section
        data-testid="integrations-security-band"
        aria-label="حالة الأمان والإجراءات السريعة"
        className="flex flex-col gap-5 rounded-[26px] border border-white/9 bg-gradient-to-l from-[#D8B87A]/[0.055] to-[#080B10]/76 p-5 shadow-[0_20px_70px_rgba(0,0,0,.18)] lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-[18px] border border-[#D8B87A]/22 bg-[#D8B87A]/[0.07] text-[#D8B87A]">
            <ShieldIcon />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">
                حالة أمان الاتصالات
              </p>
              <AdminStatusPill tone={securityReady ? "green" : "red"}>
                {securityReady ? "محمي" : "يحتاج مراجعة"}
              </AdminStatusPill>
            </div>
            <p className="mt-2 max-w-2xl text-[11px] leading-6 text-white/40">
              بيانات الاعتماد تبقى خلف Server Adapters. وقت الفحص لا يُحتسب
              كمزامنة، ولا تحتوي هذه الصفحة على Secrets أو اتصال مباشر بمزود
              خارجي.
            </p>
          </div>
        </div>
        <div className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/settings/integrations/server-configuration"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[#D8B87A]/20 px-4 text-[11px] font-semibold text-[#E4C683] hover:border-[#D8B87A]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            App Configuration
          </Link>
          <Link
            href="/admin/settings/security"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[#D8B87A]/20 px-4 text-[11px] font-semibold text-[#E4C683] hover:border-[#D8B87A]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            إعدادات الأمان
          </Link>
          <Link
            href="/admin/reports/analytics?filter=providers"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 px-4 text-[11px] font-semibold text-white/55 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            تقارير Analytics
          </Link>
          <Link
            href="/admin/reports/system?filter=diagnostics"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 px-4 text-[11px] font-semibold text-white/55 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            تشخيص المصادر
          </Link>
        </div>
      </section>
    </AdminPageExperience>
  );
}
