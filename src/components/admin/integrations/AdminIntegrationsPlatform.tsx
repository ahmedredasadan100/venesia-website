"use client";

import { useMemo, useState } from "react";

import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../lib/admin/admin-ui-styles";
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
  AdminActionButton,
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminFormGrid,
  AdminFormSection,
  AdminMetricCardsGrid,
  AdminPageContextHeader,
  AdminPageExperience,
  AdminListboxSelect,
  AdminListEmptyState,
  AdminSearchInput,
  AdminStatusPill,
} from "../ui";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../ui/AdminModuleTabs";
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

function DisabledAction({
  children,
  reason,
}: {
  children: string;
  reason: string;
}) {
  return (
    <AdminActionButton
      type="button"
      disabled
      title={reason}
      variant="dark"
      className="w-full"
    >
      {children}
    </AdminActionButton>
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
    <AdminActionButton
      href={href}
      variant="dark"
    >
      {children}
    </AdminActionButton>
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
    <article className="min-w-0">
      <AdminFormSection presentation="panel" className="h-full" header={(
        <AdminModuleSectionHeader
          id={`integration-${item.key}`}
          sectionHeading={item.label}
          icon="link"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          sectionSummary={<IntegrationBrandIcon integration={item.key} />}
        />
      )}>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          <div className="flex flex-wrap items-center gap-2">
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
      <p className="text-[11px] leading-6 text-white/42">
        {item.description}
      </p>
      <div>
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

      <AdminFormGrid>
        <IntegrationAction href={item.configureHref}>
          {configureLabel}
        </IntegrationAction>
        <IntegrationAction href={item.testHref}>
          اختبار الاتصال
        </IntegrationAction>
        {reportsAvailable ? (
          <AdminActionButton
            href={item.reportsHref}
            variant="dark"
            className="md:col-span-2"
          >
            عرض التقارير
          </AdminActionButton>
        ) : null}
      </AdminFormGrid>
        </div>
      </AdminFormSection>
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
    <AdminPageExperience as="div" className="min-w-0 pb-12" dir="rtl">
      <AdminPageContextHeader
        visualPreset="integrations"
        eyebrow="INTEGRATIONS PLATFORM"
        title="التكاملات والربط الخارجي"
        description="إدارة جميع اتصالات المنصات الخارجية من مكان واحد. التقارير لا تتصل بالمزودين مباشرة؛ بياناتها تمر فقط عبر Analytics Contract والـAdapter Registry المعتمد."
        meta={`العقد ${snapshot.contractVersion}`}
        actions={
          <AdminActionButton
            href="/admin/settings/integrations/server-configuration"
            variant="dark"
          >
            إعدادات الربط على السيرفر
          </AdminActionButton>
        }
        status={snapshot.state === "ready" ? "ready" : "error"}
      />

      <div role="region" data-testid="integrations-overview" aria-labelledby="integrations-overview-heading">
        <AdminFormSection presentation="panel" header={(
          <AdminModuleSectionHeader
            id="integrations-overview"
            sectionHeading={<span id="integrations-overview-heading">نظرة عامة</span>}
            sectionDescription="حالة الاتصال والمزامنة كما تعيدها الملاك المعتمدة، دون أرقام تجريبية أو نجاح افتراضي."
            icon="statistics"
            sectionHeaderPresentation="premium"
            sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          />
        )}>
          <AdminFormGrid columns={1}>
            <IntegrationOverviewVisual />
            <AdminMetricCardsGrid ariaLabel="ملخص حالة التكاملات" items={[
              { label: "إجمالي التكاملات", value: snapshot.statistics.total, description: "منصات المرحلة الأولى فقط", tone: "gold", icon: <AdminModuleTabIcon name="link" />, artwork: "series" },
              { label: "المتصل", value: snapshot.statistics.connected, description: "اتصال مثبت بمصدر حقيقي", tone: "green", icon: <AdminModuleTabIcon name="link" />, artwork: "series" },
              { label: "يحتاج انتباه", value: snapshot.statistics.needsAttention, description: "تعذر الفحص أو مصدر جزئي", tone: snapshot.statistics.needsAttention ? "red" : "neutral", icon: <AdminModuleTabIcon name="activity" />, artwork: "series" },
              { label: "غير المتصل", value: snapshot.statistics.disconnected, description: "لا يوجد Adapter مفعّل", tone: "neutral", icon: <AdminModuleTabIcon name="link" />, artwork: "series" },
              { label: "حالة الأمان", value: securityReady ? "محمي" : "مراجعة", description: "الأسرار لا تنتقل إلى العميل", tone: securityReady ? "green" : "red", icon: <AdminModuleTabIcon name="security" />, artwork: "series" },
              { label: "آخر مزامنة", value: snapshot.lastSyncAt ? "متاحة" : "لا توجد", description: snapshot.lastSyncAt ? formatAdminDateTime(snapshot.lastSyncAt) : "لا توجد مزامنة", tone: "neutral", icon: <AdminModuleTabIcon name="activity" />, artwork: "series" },
            ]} />
          </AdminFormGrid>
        </AdminFormSection>
      </div>

      {snapshot.state !== "ready" ? (
        <div
          role="status"
          className="rounded-[20px] border border-amber-300/16 bg-amber-300/[0.055] px-5 py-4 text-xs leading-6 text-amber-100/70"
        >
          حالة المنصة جزئية لأن Connection Aggregate أو Vault أو Migration proof
          غير متاح بالكامل. لا تُستنتج حالة اتصال من Analytics.
        </div>
      ) : null}

      <div role="region" aria-labelledby="available-integrations-heading">
      <AdminFormSection presentation="panel" header={(
        <AdminModuleSectionHeader
          id="available-integrations"
          sectionHeading={<span id="available-integrations-heading">التكاملات المتاحة</span>}
          sectionDescription="البحث والتصفية يعملان على كتالوج المرحلة الأولى دون تغيير مصدر الحقيقة."
          icon="link"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          sectionSummary={<AdminStatusPill>{visibleIntegrations.length}/{snapshot.integrations.length}</AdminStatusPill>}
        />
      )}>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
            <AdminFormGrid columns={4}>
              <AdminSearchInput value={query} onChange={setQuery} placeholder="بحث في التكاملات..." inputLabel="البحث في التكاملات" className="sm:w-full lg:w-full" />

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

              <AdminActionButton
                type="button"
                onClick={resetFilters}
                disabled={!query && category === "all" && status === "all"}
                variant="dark"
              >
                إعادة التعيين
              </AdminActionButton>
            </AdminFormGrid>

        <p className="sr-only" aria-live="polite">
          تم العثور على {visibleIntegrations.length} تكامل
        </p>
        {visibleIntegrations.length ? (
          <AdminFormGrid columns={4}>
            {visibleIntegrations.map((item) => (
              <IntegrationCard key={item.key} item={item} />
            ))}
          </AdminFormGrid>
        ) : (
          <AdminListEmptyState title="لا توجد تكاملات تطابق البحث الحالي" description="غيّر الفلاتر أو أعد تعيينها لعرض المنصات التسع المعتمدة.">
            <AdminActionButton
              type="button"
              onClick={resetFilters}
              variant="dark"
              className="mt-5"
            >
              عرض كل التكاملات
            </AdminActionButton>
          </AdminListEmptyState>
        )}
        </div>
      </AdminFormSection>
      </div>

      <div role="region" data-testid="integrations-security-band" aria-label="حالة الأمان والإجراءات السريعة">
        <AdminFormSection presentation="panel" header={(
          <AdminModuleSectionHeader
            id="integrations-security"
            sectionHeading="حالة أمان الاتصالات"
            sectionDescription="بيانات الاعتماد تبقى خلف Server Adapters. وقت الفحص لا يُحتسب كمزامنة، ولا تحتوي هذه الصفحة على Secrets أو اتصال مباشر بمزود خارجي."
            icon="security"
            sectionHeaderPresentation="premium"
            sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
            sectionSummary={<AdminStatusPill tone={securityReady ? "green" : "red"}>{securityReady ? "محمي" : "يحتاج مراجعة"}</AdminStatusPill>}
          />
        )}>
        <AdminFormGrid columns={4}>
          <AdminActionButton
            href="/admin/settings/integrations/server-configuration"
            variant="dark"
          >
            App Configuration
          </AdminActionButton>
          <AdminActionButton
            href="/admin/settings/security"
            variant="dark"
          >
            إعدادات الأمان
          </AdminActionButton>
          <AdminActionButton
            href="/admin/reports/analytics?filter=providers"
            variant="dark"
          >
            تقارير Analytics
          </AdminActionButton>
          <AdminActionButton
            href="/admin/reports/system?filter=diagnostics"
            variant="dark"
          >
            تشخيص المصادر
          </AdminActionButton>
        </AdminFormGrid>
        </AdminFormSection>
      </div>
    </AdminPageExperience>
  );
}
