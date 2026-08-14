import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildAdminAuditReport } from "../src/lib/admin/audit/audit-report.ts";
import type { AuditLogRecord } from "../src/lib/admin/audit/audit-types.ts";
import {
  aggregateContentReviewAssessments,
  type ContentReviewAssessment,
} from "../src/lib/admin/content-workflow/content-review-report-aggregation.ts";
import {
  ANALYTICS_CONTRACT_VERSION,
  createAnalyticsProviderRegistry,
  type AnalyticsProviderAdapter,
} from "../src/lib/admin/reports/analytics-contract.ts";
import {
  REPORTS_CONTRACT_VERSION,
  REPORTS_MIGRATION_VERSION,
  deriveReportsState,
  parseReportsReadModel,
} from "../src/lib/admin/reports/reports-contract.ts";
import {
  ADMIN_REPORT_DEFINITIONS,
  ADMIN_REPORT_IDS,
  REPORT_EXPERIENCE_CAPABILITIES,
  buildAdminReportHref,
  resolveAdminReportQuery,
} from "../src/lib/admin/reports/reports-information-architecture.ts";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

function rawReadModel() {
  return {
    contractVersion: REPORTS_CONTRACT_VERSION,
    checkedAt: "2026-08-05T23:00:00.000Z",
    content: {
      missingSeo: 0,
      missingImages: 0,
      missingImageAlt: 0,
      publishedWithMissingSeo: 0,
    },
    projects: {
      featured: 0,
      missingSeo: 0,
      missingImages: 0,
      complete: 0,
      incomplete: 0,
      constructionUpdates: {
        source: "topics.content_type=site_update",
        total: 0,
        published: 0,
        unpublished: 0,
      },
    },
    seo: {
      missingMetadata: { topics: 0, projects: 0, pages: 0 },
      canonicalOverrides: 0,
      indexability: { indexablePublished: 0, noindexPublished: 0 },
    },
    media: {
      storage: { knownBytes: 0, unknownByteSize: 0 },
      brokenReferences: 0,
      missingObjects: 0,
      missingAlt: 0,
      missingVideoUrls: 0,
    },
    publishing: {
      recentPublishing: { windowDays: 30, topics: 0, projects: 0 },
      unpublished: { topics: 0, projects: 0, pages: 0 },
    },
    sourcesOfTruth: ["public.admin_reports_truth_v1()"],
    databaseDiagnostics: {
      source: "public.admin_reports_truth_v1()",
      migrationVersion: REPORTS_MIGRATION_VERSION,
      migrationRegistered: true,
      dashboardReadModelAvailable: true,
      rls: { topics: true, projects: true },
      missingIndexes: [],
      rpcAclServiceOnly: true,
      checkedAt: "2026-08-05T23:00:00.000Z",
    },
  };
}

const emptyReadModel = parseReportsReadModel(rawReadModel());
assert.equal(emptyReadModel.content.missingSeo, 0, "a database-proven zero remains a real zero");
assert.equal(emptyReadModel.projects.complete, 0, "an empty project dataset remains truthful");
assert.equal(emptyReadModel.media.storage.knownBytes, "0");
assert.throws(
  () => parseReportsReadModel({ ...rawReadModel(), contractVersion: "legacy" }),
  /Unsupported Reports read-model contract version/,
  "stale contracts fail closed",
);
assert.throws(
  () => parseReportsReadModel({ ...rawReadModel(), content: { missingSeo: -1 } }),
  /Invalid Reports read-model count/,
  "malformed aggregate data fails closed",
);
assert.equal(deriveReportsState(["ready", "ready"]), "ready");
assert.equal(deriveReportsState(["ready", "unavailable"]), "partial");
assert.equal(deriveReportsState(["warning", "ready"]), "partial");
assert.equal(deriveReportsState(["unavailable", "unavailable"]), "unavailable");

assert.deepEqual(ADMIN_REPORT_IDS, [
  "content",
  "projects",
  "analytics",
  "seo",
  "media",
  "publishing",
  "audit",
  "system",
  "business",
]);
assert.equal(new Set(ADMIN_REPORT_DEFINITIONS.map((report) => report.href)).size, 9);
for (const report of ADMIN_REPORT_DEFINITIONS) {
  assert.equal(report.filters[0]?.id, "all", `${report.id} must expose a canonical all filter`);
  assert.equal(
    new Set(report.filters.map((filter) => filter.id)).size,
    report.filters.length,
    `${report.id} filter ids must be unique`,
  );
}
assert.deepEqual(resolveAdminReportQuery("content", { filter: "missing_images" }), {
  state: "valid",
  context: { filter: "missing_images", period: "current", compare: "none" },
});
assert.deepEqual(resolveAdminReportQuery("analytics", {}), {
  state: "valid",
  context: { filter: "all", period: "last_30_days", compare: "none" },
});
assert.equal(resolveAdminReportQuery("content", { unknown: "x" }).state, "invalid");
assert.equal(resolveAdminReportQuery("content", { filter: ["all", "draft"] }).state, "invalid");
assert.equal(resolveAdminReportQuery("content", { filter: "provider" }).state, "invalid");
assert.equal(resolveAdminReportQuery("content", { period: "last_90_days" }).state, "invalid");
assert.equal(resolveAdminReportQuery("content", { compare: "previous_period" }).state, "invalid");
assert.equal(
  buildAdminReportHref("content", { filter: "missing_images" }),
  "/admin/reports/content?filter=missing_images",
);
assert.equal(
  new Set(REPORT_EXPERIENCE_CAPABILITIES.map((capability) => capability.key)).size,
  REPORT_EXPERIENCE_CAPABILITIES.length,
);
assert.equal(REPORT_EXPERIENCE_CAPABILITIES.find((item) => item.key === "export")?.state, "ready");
assert.equal(REPORT_EXPERIENCE_CAPABILITIES.find((item) => item.key === "saved_reports")?.state, "unavailable");
assert.equal(REPORT_EXPERIENCE_CAPABILITIES.find((item) => item.key === "ai_insights")?.state, "unavailable");

const analytics = await createAnalyticsProviderRegistry([]).load();
assert.equal(analytics.contractVersion, ANALYTICS_CONTRACT_VERSION);
assert.deepEqual(analytics.query, { period: "last_30_days", compare: "none" });
assert.equal(analytics.state, "unavailable", "no configured provider must not become a fake success");
assert.ok(analytics.providers.every((provider) => provider.status === "not_configured"));
assert.ok(Object.values(analytics.reports).every((report) => report.state === "unavailable"));
assert.ok(Object.values(analytics.reports).every((report) => report.metrics.length === 0));

const invalidReadyAdapter: AnalyticsProviderAdapter = {
  provider: "google_analytics_4",
  async load() {
    return {
      provider: "google_analytics_4",
      status: "ready",
      checkedAt: "2026-08-05T23:00:00.000Z",
      message: "invalid contract fixture",
      metrics: [],
    };
  },
};
const invalidReady = await createAnalyticsProviderRegistry([invalidReadyAdapter]).load();
assert.equal(
  invalidReady.providers.find((provider) => provider.provider === "google_analytics_4")?.status,
  "unavailable",
  "an adapter cannot claim ready without real metrics",
);
assert.throws(
  () => createAnalyticsProviderRegistry([invalidReadyAdapter, invalidReadyAdapter]),
  /Duplicate Analytics adapter/,
  "parallel provider owners are rejected",
);
await assert.rejects(
  () => createAnalyticsProviderRegistry([]).load({ period: "invalid" as never, compare: "none" }),
  /Invalid Analytics query context/,
);
const comparisonWithoutBaseline: AnalyticsProviderAdapter = {
  provider: "google_search_console",
  async load() {
    return {
      provider: "google_search_console",
      status: "ready",
      checkedAt: "2026-08-05T23:00:00.000Z",
      message: "comparison fixture",
      metrics: [{
        key: "seo.organic_traffic",
        label: "Organic traffic",
        value: 10,
        unit: "count",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-30",
      }],
    };
  },
};
const rejectedComparison = await createAnalyticsProviderRegistry([comparisonWithoutBaseline]).load({
  period: "last_30_days",
  compare: "previous_period",
});
assert.equal(
  rejectedComparison.providers.find((provider) => provider.provider === "google_search_console")?.status,
  "unavailable",
  "ready comparison data must include a real comparison period",
);

function validContentAssessment(id: number): ContentReviewAssessment {
  return {
    id,
    title: `Valid content ${id}`,
    status: "unpublished",
    contentType: "article",
    blockerIds: [],
  };
}

const emptyReview = aggregateContentReviewAssessments([]);
assert.deepEqual(emptyReview, {
  checked: 0,
  ready: 0,
  blocked: 0,
  publishedWithBlocks: 0,
  blockingChecks: [],
  samples: [],
});
const largeRows = Array.from({ length: 5_000 }, (_, index) => validContentAssessment(index + 1));
const largeReview = aggregateContentReviewAssessments(largeRows);
assert.equal(largeReview.checked, 5_000, "large datasets must be evaluated without truncation");
assert.equal(largeReview.ready, 5_000);
const blockedReview = aggregateContentReviewAssessments([
  validContentAssessment(1),
  { ...validContentAssessment(2), title: "", status: "published", blockerIds: ["title"] },
]);
assert.equal(blockedReview.blocked, 1);
assert.equal(blockedReview.publishedWithBlocks, 1);
assert.ok(blockedReview.blockingChecks.some((item) => item.id === "title"));

const auditEmpty = buildAdminAuditReport({ items: [], total: 0, sampleLimit: 50 });
assert.equal(auditEmpty.total, 0);
assert.deepEqual(auditEmpty.recentActivity, []);
const auditItems: AuditLogRecord[] = Array.from({ length: 50 }, (_, index) => ({
  id: index + 1,
  actor_admin_user_id: 1,
  actor_username: index % 2 ? "editor" : "admin",
  action: index % 5 === 0 ? "topic.publish" : "topic.update",
  entity_type: "topic",
  entity_id: index + 1,
  entity_label: `Topic ${index + 1}`,
  metadata: {},
  ip_address: null,
  user_agent: null,
  created_at: "2026-08-05T23:00:00.000Z",
}));
const auditReport = buildAdminAuditReport({ items: auditItems, total: 10_000, sampleLimit: 50 });
assert.equal(auditReport.total, 10_000);
assert.equal(auditReport.sampled, 50);
assert.equal(auditReport.publishingHistory.length, 10);
assert.equal(auditReport.entityActivity[0]?.entityType, "topic");

const page = source("src/app/admin/reports/page.tsx");
const reportPage = source("src/app/admin/reports/[report]/page.tsx");
const exportRoute = source("src/app/admin/reports/export/route.ts");
const loader = source("src/lib/admin/reports/load-admin-reports.ts");
const analyticsRoot = source("src/lib/admin/reports/load-analytics.ts");
const analyticsContract = source("src/lib/admin/reports/analytics-contract.ts");
const view = source("src/components/admin/reports/AdminReportsView.tsx");
const detailView = source("src/components/admin/reports/AdminReportDetailView.tsx");
const reportActions = source("src/components/admin/reports/AdminReportActions.tsx");
const informationArchitecture = source("src/lib/admin/reports/reports-information-architecture.ts");
const overviewPresentation = source("src/lib/admin/reports/reports-overview-presentation.ts");
const reportPresentation = source("src/lib/admin/reports/reports-presentation.ts");
const auditActions = source("src/lib/admin/audit/audit-actions.ts");
const reviewLoader = source("src/lib/admin/content-workflow/load-content-review-report.ts");
const reviewOwner = source("src/lib/admin/content-workflow/content-review-report.ts");
const migration = source("sql/migrations/20260805230000_reports_analytics_capability_closure.sql");
const manifest = source("src/lib/admin/interaction-system/adoption-manifest.ts");
const navigation = source("src/config/admin/navigation.ts");
const workflow = source(".github/workflows/quality-gate.yml");

assert.match(page, /export const dynamic = "force-dynamic"/);
assert.match(page, /loadAdminReports\(\)/);
assert.doesNotMatch(page, /AdminPlaceholderPage|getSupabaseAdmin|\.from\(|\.rpc\(/);
assert.match(reportPage, /resolveAdminReportQuery/);
assert.match(reportPage, /buildAdminReportPresentation/);
assert.match(reportPage, /loadAdminReports\(\)/);
assert.doesNotMatch(reportPage, /getSupabaseAdmin|\.from\(|\.rpc\(/);
assert.ok(
  loader.indexOf("await requireAdminSession()") < loader.indexOf("Promise.allSettled"),
  "auth must complete before privileged Reports sources start",
);
assert.match(loader, /\.rpc\("admin_reports_truth_v1"\)/);
assert.match(loader, /loadAdminDashboardSources\(\)/, "Reports and Dashboard must share the Dashboard owner");
assert.match(loader, /loadAdminAuditReport\(\)/, "Reports must use the Audit owner");
assert.match(loader, /runGlobalSeoHealth\(\)/, "Reports must use the SEO owner");
assert.match(loader, /loadContentReviewReport\(\)/, "Reports must use the current validation owner");
assert.match(loader, /loadAnalyticsSnapshot\(options\?\.analytics\)/, "Reports must use one Analytics composition root");
assert.match(
  loader,
  /const \[analytics, sourceResults\] = await Promise\.all\(\[/,
  "Analytics and the independent Reports owners must start in the same parallel wave",
);
assert.ok(
  loader.indexOf("loadAnalyticsSnapshot(options?.analytics)") <
    loader.indexOf("Promise.allSettled(["),
  "Analytics must not block the independent fail-soft source group",
);
assert.doesNotMatch(loader, /\.from\("admin_audit_logs"\)|\.from\("media_assets"\)/);
assert.doesNotMatch(loader, /return\s+0|\?\?\s*0|return\s+\[\]|\?\?\s*\[\]/);
assert.match(reviewLoader, /REVIEW_PAGE_SIZE = 500/);
assert.match(reviewLoader, /while \(true\)[\s\S]*\.range\(/, "large content review reads must be paginated");
assert.match(reviewOwner, /getTopicPublishBlockingChecks/);
assert.match(reviewOwner, /getMediaPublishBlockingChecks/);

assert.equal((analyticsRoot.match(/= createAnalyticsProviderRegistry\(/g) ?? []).length, 1);
assert.doesNotMatch(loader, /google_analytics_4|google_search_console|microsoft_clarity|meta_pixel|googleapis/);
assert.doesNotMatch(
  `${analyticsRoot}\n${loader}`,
  /from\s+["'](?:@google|googleapis)|https?:\/\/(?:[^/]+\.)?(?:googleapis\.com|google-analytics\.com)/i,
  "Reports and its composition root must not integrate directly with Google",
);
assert.match(analyticsContract, /cannot claim ready without data/);
assert.match(analyticsContract, /Duplicate Analytics adapter/);
assert.match(analyticsContract, /"ready" \| "partial" \| "unavailable"/);

assert.doesNotMatch(view, /key=\{index\}|<canvas|AdminPlaceholderPage/i);
assert.match(view, /buildAdminReportsOverview/);
assert.match(view, /نظرة عامة على التقارير/);
assert.match(view, /أهم التنبيهات/);
assert.match(view, /Analytics Providers/);
assert.match(
  view,
  /function RecordColumn[\s\S]*?<section className="min-w-0 rounded-\[28px\]/,
  "Reusable Reports record columns must allow their grid tracks to shrink on mobile",
);
assert.match(
  view,
  /<section className="grid gap-5 xl:grid-cols-\[1\.35fr_\.65fr\]">[\s\S]*?<div className="min-w-0 rounded-\[28px\][\s\S]*?<div className="min-w-0 rounded-\[28px\]/,
  "Both overview diagnostic cards must allow their grid tracks to shrink on mobile",
);
assert.match(view, /أهم المشاريع/);
assert.match(view, /أهم المحتوى/);
assert.match(view, /أهم النشاط/);
assert.match(view, /أهم مشاكل SEO/);
assert.match(view, /أهم مشاكل الميديا/);
assert.match(view, /الوصول السريع للتقارير/);
assert.doesNotMatch(view, /Content Reports|Projects Reports|Publishing Reports|Audit Reports|System Reports/);
assert.match(detailView, /Global Filters/);
assert.match(detailView, /Action Center/);
assert.match(detailView, /قابلية التوسع/);
assert.match(detailView, /REPORT_EXPERIENCE_CAPABILITIES/);
assert.match(reportActions, /window\.print\(\)/);
assert.match(informationArchitecture, /saved_reports/);
assert.match(informationArchitecture, /schedule_reports/);
assert.match(informationArchitecture, /executive_pdf/);
assert.match(informationArchitecture, /ai_insights/);
assert.match(informationArchitecture, /لا يوجد مالك persistence معتمد/);
assert.doesNotMatch(
  `${informationArchitecture}\n${overviewPresentation}\n${reportPresentation}`,
  /getSupabaseAdmin|\.from\(|\.rpc\(/,
);

assert.ok(
  exportRoute.indexOf("await requireAdminSession()") < exportRoute.indexOf("loadAdminReports({"),
  "export must authenticate before privileged report reads",
);
assert.match(exportRoute, /buildAdminReportExportRows/);
assert.match(exportRoute, /AUDIT_ACTIONS\.reportsExport/);
assert.match(exportRoute, /text\/csv; charset=utf-8/);
assert.match(exportRoute, /private, no-store/);
assert.match(exportRoute, /status: 503/);
assert.match(auditActions, /reportsExport: "reports\.export"/);

assert.match(migration, /security definer/);
assert.match(migration, /set search_path = ''/);
assert.match(migration, /grant execute on function public\.admin_reports_truth_v1\(\) to service_role/);
assert.match(migration, /revoke all on function public\.admin_reports_truth_v1\(\) from authenticated/);
assert.match(migration, /supabase_migrations\.schema_migrations/);
assert.match(migration, /pg_catalog\.pg_indexes/);
assert.match(migration, /relrowsecurity/);
assert.doesNotMatch(migration, /create table[^;]*(?:analytics|report)/i, "the phase must not add another analytics truth store");
assert.match(manifest, /src\/lib\/admin\/reports\/load-admin-reports\.ts#loadAdminReports/);
assert.match(manifest, /src\/components\/admin\/reports\/AdminReportsView\.tsx/);
assert.match(manifest, /src\/components\/admin\/reports\/AdminReportDetailView\.tsx/);
assert.match(navigation, /id: "reports-overview"/);
for (const reportId of ADMIN_REPORT_IDS) {
  assert.match(navigation, new RegExp(`href: "/admin/reports/${reportId}"`));
}
assert.match(workflow, /Reports Analytics · PostgreSQL 17/);

const runtimeSources = `${page}\n${reportPage}\n${exportRoute}\n${loader}\n${analyticsRoot}\n${view}\n${detailView}\n${informationArchitecture}\n${overviewPresentation}\n${reportPresentation}`;
assert.doesNotMatch(runtimeSources, /\b(?:mock|placeholder|dummy|fake)\b/i);
assert.doesNotMatch(runtimeSources, /unstable_cache|revalidatePath|revalidateTag|router\.refresh/);

console.log("OK: Reports & Analytics capability behavior and ownership guards passed.");
