import "server-only";

import { runGlobalSeoHealth } from "../../seo/run-global-seo-health";
import { getSupabaseAdmin } from "../../supabase-admin";
import { logError } from "../../logging/logger";
import { loadAdminAuditReport } from "../audit/load-admin-audit-report";
import type { AdminAuditReport } from "../audit/audit-report";
import { requireAdminSession } from "../auth/require-admin-session";
import { loadContentReviewReport } from "../content-workflow/load-content-review-report";
import type { ContentReviewReport } from "../content-workflow/content-review-report";
import { loadAdminDashboardSources } from "../dashboard/load-admin-dashboard";
import type {
  DashboardMediaDiagnostics,
  DashboardReadModel,
  DashboardSource,
  DashboardSourceStatus,
} from "../dashboard/dashboard-contract";
import { loadAnalyticsSnapshot } from "./load-analytics";
import type { AnalyticsQueryContext } from "./analytics-contract";
import {
  deriveReportsState,
  parseReportsReadModel,
  type AdminReportsModel,
  type ReportsReadModel,
  type ReportsSource,
  type ReportsSourceStatus,
} from "./reports-contract";

function reportStatus(status: DashboardSourceStatus): ReportsSourceStatus {
  return status;
}

function unavailableSource<T>(input: {
  key: ReportsSource<T>["key"];
  label: string;
  source: string;
  message: string;
  href?: string;
}): ReportsSource<T> {
  return {
    ...input,
    status: "unavailable",
    checkedAt: new Date().toISOString(),
    data: null,
  };
}

function unavailableDashboardSource<T>(input: {
  key: DashboardSource<T>["key"];
  label: string;
  source: string;
  message: string;
  href?: string;
}): DashboardSource<T> {
  return {
    ...input,
    status: "unavailable",
    checkedAt: new Date().toISOString(),
    data: null,
  };
}

async function readReportsTruth(): Promise<ReportsSource<ReportsReadModel>> {
  const checkedAt = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin().rpc("admin_reports_truth_v1");
  if (error) throw new Error(error.message);
  const model = parseReportsReadModel(data);
  const diagnostics = model.databaseDiagnostics;
  const provenanceReady =
    diagnostics.migrationRegistered &&
    diagnostics.dashboardReadModelAvailable &&
    diagnostics.rpcAclServiceOnly &&
    diagnostics.missingIndexes.length === 0 &&
    Object.values(diagnostics.rls).every(Boolean);
  return {
    key: "reports_read_model",
    label: "Reports Database Read Model",
    source: diagnostics.source,
    status: provenanceReady ? "ready" : "warning",
    checkedAt,
    message: provenanceReady
      ? "القراءة التجميعية مثبتة بالـmigration والـregistry والـACL والـRLS والفهارس."
      : "البيانات متاحة، لكن إثبات قاعدة البيانات أوالحماية أوالفهارس يحتاج مراجعة.",
    data: model,
  };
}

async function readContentReview(): Promise<ReportsSource<ContentReviewReport>> {
  const checkedAt = new Date().toISOString();
  const data = await loadContentReviewReport();
  return {
    key: "content_review",
    label: "Content Review & Validation",
    source: "Content Review Capability via loadContentReviewReport",
    status: "ready",
    checkedAt,
    message: data.checked
      ? "تم تقييم السجلات بقواعد النشر الحالية نفسها، وليس بقواعد Reports موازية."
      : "مصدر المراجعة متاح ومجموعة المحتوى الحالية فارغة.",
    data,
  };
}

async function readAuditReport(): Promise<ReportsSource<AdminAuditReport>> {
  const checkedAt = new Date().toISOString();
  const data = await loadAdminAuditReport();
  return {
    key: "audit_report",
    label: "Audit Reports",
    source: "admin_audit_logs via loadAdminAuditReport",
    status: "ready",
    checkedAt,
    message: data.sampled
      ? `التجميعات معروضة بوضوح من أحدث ${data.sampled} حدث، والإجمالي الكامل ${data.total}.`
      : "مالك Audit متاح ولا توجد أحداث مسجلة حتى الآن.",
    data,
    href: "/admin/activity-log",
  };
}

async function readSeoHealth(): Promise<ReportsSource<Awaited<ReturnType<typeof runGlobalSeoHealth>>>> {
  const data = await runGlobalSeoHealth();
  return {
    key: "seo_health",
    label: "SEO & Sitemap Health",
    source: "Global SEO Capability via runGlobalSeoHealth",
    status: data.status === "healthy" ? "ready" : "warning",
    checkedAt: data.checkedAt,
    message: data.status === "healthy"
      ? "SEO وSitemap اجتازا تشخيص المالك الحالي."
      : "تشخيص SEO الحقيقي متاح ويحتوي تحذيرات أوأخطاء تحتاج معالجة.",
    data,
    href: "/admin/seo/sitemap",
  };
}

export async function loadAdminReports(options?: {
  analytics?: AnalyticsQueryContext;
}): Promise<AdminReportsModel> {
  await requireAdminSession();

  const checkedAt = new Date().toISOString();
  const analytics = await loadAnalyticsSnapshot(options?.analytics);
  const [dashboardResult, reportsResult, reviewResult, auditResult, seoResult] =
    await Promise.allSettled([
      loadAdminDashboardSources(),
      readReportsTruth(),
      readContentReview(),
      readAuditReport(),
      readSeoHealth(),
    ]);

  const failures = [
    ["Reports Dashboard source unavailable", dashboardResult, "loadAdminDashboardSources"],
    ["Reports database read model unavailable", reportsResult, "public.admin_reports_truth_v1()"],
    ["Reports Content Review source unavailable", reviewResult, "loadContentReviewReport"],
    ["Reports Audit source unavailable", auditResult, "loadAdminAuditReport"],
    ["Reports SEO source unavailable", seoResult, "runGlobalSeoHealth"],
  ] as const;
  for (const [message, result, source] of failures) {
    if (result.status === "rejected") logError(message, result.reason, { source });
  }

  const dashboard = dashboardResult.status === "fulfilled"
    ? dashboardResult.value.readModel
    : unavailableDashboardSource<DashboardReadModel>({
        key: "read_model",
        label: "Dashboard Read Model",
        source: "public.admin_dashboard_truth_v1()",
        message: "تعذر تحميل مصدر Dashboard المشترك. لم تُعرض أصفار بديلة.",
      });
  const media = dashboardResult.status === "fulfilled"
    ? dashboardResult.value.media
    : unavailableDashboardSource<DashboardMediaDiagnostics>({
        key: "media_diagnostics",
        label: "Media Diagnostics",
        source: "getMediaCatalogRuntimeState",
        message: "تعذر إثبات حالة Media من مالك التشخيص الحالي.",
        href: "/admin/settings/media",
      });
  const reports = reportsResult.status === "fulfilled"
    ? reportsResult.value
    : unavailableSource<ReportsReadModel>({
        key: "reports_read_model",
        label: "Reports Database Read Model",
        source: "public.admin_reports_truth_v1()",
        message: "تعذر تكوين التقارير التجميعية الموثوقة. لم تُستبدل البيانات بأصفار.",
      });
  const contentReview = reviewResult.status === "fulfilled"
    ? reviewResult.value
    : unavailableSource<ContentReviewReport>({
        key: "content_review",
        label: "Content Review & Validation",
        source: "Content Review Capability via loadContentReviewReport",
        message: "تعذر تطبيق قواعد المراجعة الحالية؛ حالة الجاهزية غير متاحة.",
      });
  const audit = auditResult.status === "fulfilled"
    ? auditResult.value
    : unavailableSource<AdminAuditReport>({
        key: "audit_report",
        label: "Audit Reports",
        source: "admin_audit_logs via loadAdminAuditReport",
        message: "تعذر تحميل Audit الحقيقي. لم تُعرض أحداث بديلة.",
        href: "/admin/activity-log",
      });
  const seo = seoResult.status === "fulfilled"
    ? seoResult.value
    : unavailableSource<Awaited<ReturnType<typeof runGlobalSeoHealth>>>({
        key: "seo_health",
        label: "SEO & Sitemap Health",
        source: "Global SEO Capability via runGlobalSeoHealth",
        message: "تعذر تحميل تشخيص SEO الحقيقي.",
        href: "/admin/seo/sitemap",
      });

  const analyticsStatus: ReportsSourceStatus = analytics.state === "ready"
    ? "ready"
    : analytics.state === "partial"
      ? "warning"
      : "unavailable";
  const state = deriveReportsState([
    reportStatus(dashboard.status),
    reports.status,
    contentReview.status,
    audit.status,
    seo.status,
    reportStatus(media.status),
    analyticsStatus,
  ]);

  return {
    state,
    checkedAt,
    dashboard,
    reports,
    contentReview,
    audit,
    seo,
    media,
    analytics,
    cache: {
      status: "ready",
      source: "Next.js force-dynamic request-time rendering",
      checkedAt,
      message: "كل طلب Reports يعيد قراءة الملاك الحالية؛ لا توجد نسخة Cache موازية أوRevalidation مستقلة.",
    },
  };
}
