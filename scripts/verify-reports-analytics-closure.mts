import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import * as ts from "typescript";

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
  getAdminReportDefinition,
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

// Execute the existing presentation/export owners and the route's pure CSV
// fragment. Authentication, privileged reads and audit writes are never invoked.
function loadReportPureModule<T>(text: string, ports: Record<string, unknown> = {}): T {
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  Function("exports", "module", "require", compiled)(loaded.exports, loaded, (name: string) => {
    assert.ok(Object.hasOwn(ports, name), `Unexpected pure Reports dependency ${name}`);
    return ports[name];
  });
  return loaded.exports as T;
}
type DateOwner = typeof import("../src/lib/content-dates.ts");
type ReportPresentationOwner = typeof import("../src/lib/admin/reports/reports-presentation.ts");
const dateOwnerPath = "src/lib/content-dates.ts";
const presentationOwnerPath = "src/lib/admin/reports/reports-presentation.ts";
const dateSource = source(dateOwnerPath);
const dates = loadReportPureModule<DateOwner>(dateSource);
const loadPresentation = (text: string, datePort: unknown) => loadReportPureModule<ReportPresentationOwner>(text, {
  "../../content-dates": datePort,
  "./reports-information-architecture": { getAdminReportDefinition },
});
const currentPresentation = loadPresentation(reportPresentation, dates);
const rtlBaselineArgument = process.argv.find((argument) => argument.startsWith("--date-rtl-baseline-file="));
const originalDateBaselineArgument = process.argv.find((argument) => argument.startsWith("--date-original-baseline-file="));
let originalDateSource: string | null = null;
let originalPresentationSource = reportPresentation;
if (rtlBaselineArgument) {
  assert.ok(originalDateBaselineArgument, "Captured serialization proof requires the earliest pre-format date baseline, not numeric intermediate output");
  const captured = (receiptPath: string, path: string) => {
    const receipt: { entries: { path: string; sha256: string; snapshot?: string }[] } | { path: string; sha256: string; snapshot?: string }[] = JSON.parse(readFileSync(receiptPath, "utf8").replace(/^\uFEFF/u, ""));
    const entries = Array.isArray(receipt) ? receipt : receipt.entries;
    const entry = entries.find((item) => item.path === path);
    assert.ok(entry, `Captured original serialization source ${path}`);
    const snapshot = entry.snapshot ? resolve(root, entry.snapshot) : resolve(dirname(receiptPath), basename(receiptPath, ".json"), path);
    const bytes = readFileSync(snapshot);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256.toLowerCase());
    return bytes.toString("utf8");
  };
  originalDateSource = captured(resolve(root, originalDateBaselineArgument.slice("--date-original-baseline-file=".length)), dateOwnerPath);
  originalPresentationSource = captured(resolve(root, rtlBaselineArgument.slice("--date-rtl-baseline-file=".length)), presentationOwnerPath);
}
assert.ok(!originalDateBaselineArgument || rtlBaselineArgument, "Captured original date proof also requires the original Reports owner snapshot");
const originalCases = new Map<string, string>([
  ["2026-12-01T12:53:00.000Z", "01 Dec 2026, 02:53 PM"],
  ["2026-04-23T22:30:00.000Z", "24 Apr 2026, 01:30 AM"],
  ["+010000-12-01T12:53:00.000Z", "01 Dec 10000, 02:53 PM"],
  ["2026-12-01", "01 Dec 2026"],
  ["invalid", "—"],
]);
const literalOriginalDatePort = {
  ADMIN_DATE_TIME_PATTERN: "DD MMM YYYY, hh:mm A",
  formatAdminDateTime(value: string) { assert.ok(originalCases.has(value), "Explicit original month-name export vector"); return originalCases.get(value)!; },
  serializeAdminDateTimeDisplay: (value: string) => value,
};
const originalDates = originalDateSource ? loadReportPureModule<DateOwner>(originalDateSource) : literalOriginalDatePort;
assert.equal(originalDates.ADMIN_DATE_TIME_PATTERN, "DD MMM YYYY, hh:mm A", "Export comparison must bind the original month-name contract");
const previousPresentation = loadPresentation(originalPresentationSource, originalDates);
const unrelatedDirections = '\u2066unrelated Latin\u2069 · \u2067عربي\u2069 · \u200E · 09/10/2026, 06:26 PM';
const rtlEvents = [...originalCases.keys()].map((createdAt, index) => ({
  id: index + 1, action: 'تحديث "خاص"\nسطر جديد', actor: `مدير ${unrelatedDirections}`, entityLabel: 'عنصر "مهم", عربي', entityType: "topic", createdAt,
}));
const rtlModel = {
  dashboard: { status: "ready", data: { kpis: { projects: { total: rtlEvents.length, published: 1, unpublished: 3 } }, recentProjects: rtlEvents.map((event) => ({ id: event.id, arabicName: event.entityLabel, code: `J"${event.id}",\n${unrelatedDirections}`, updatedAt: event.createdAt, publicationStatus: "published" })) } },
  reports: { status: "ready", data: parseReportsReadModel(rawReadModel()) },
  audit: { status: "ready", message: "نشاط عربي", data: { total: rtlEvents.length, sampled: rtlEvents.length, entityActivity: [{ entityType: "topic", count: rtlEvents.length }], userActivity: [{ actor: unrelatedDirections, count: rtlEvents.length }], recentActivity: rtlEvents, publishingHistory: rtlEvents } },
} as unknown as Parameters<ReportPresentationOwner["buildAdminReportPresentation"]>[0];
const rtlContext = { filter: "all", period: "current", compare: "none" } as const;
const routeTree = ts.createSourceFile("reports-export-route.ts", exportRoute, ts.ScriptTarget.Latest, true);
function matchingNodes(node: ts.Node, predicate: (node: ts.Node) => boolean) {
  const matches: ts.Node[] = [];
  const visit = (value: ts.Node) => { if (predicate(value)) matches.push(value); ts.forEachChild(value, visit); };
  visit(node); return matches;
}
const csvCells = matchingNodes(routeTree, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "csvCell");
const csvDeclarations = matchingNodes(routeTree, (node) => ts.isVariableDeclaration(node) && node.name.getText(routeTree) === "csv");
const csvResponses = matchingNodes(routeTree, (node) => ts.isNewExpression(node) && node.expression.getText(routeTree) === "Response");
assert.equal(csvCells.length, 1); assert.equal(csvDeclarations.length, 1); assert.equal(csvResponses.length, 1);
const csvResponse = csvResponses[0] as ts.NewExpression;
assert.ok(csvResponse.arguments?.[0] && ts.isTemplateExpression(csvResponse.arguments[0]) && csvResponse.arguments[0].head.text === "\uFEFF", "Actual success response owns BOM-prefixed CSV");
const csvOwner = loadReportPureModule<{ bytes(rows: ReturnType<ReportPresentationOwner["buildAdminReportExportRows"]>): string }>(
  `${csvCells[0].getText(routeTree)}\nexport function bytes(rows){const ${csvDeclarations[0].getText(routeTree)};return ${csvResponse.arguments[0].getText(routeTree)};}`,
);
const rtlCsvProof = (["projects", "audit"] as const).map((reportId) => {
  const current = currentPresentation.buildAdminReportPresentation(rtlModel, reportId, rtlContext);
  const before = previousPresentation.buildAdminReportPresentation(rtlModel, reportId, rtlContext);
  const rows = currentPresentation.buildAdminReportExportRows(current);
  const expectedRows = previousPresentation.buildAdminReportExportRows(before);
  assert.deepEqual(rows, expectedRows, `Actual ${reportId} export rows preserve the exact original month-name serialization`);
  assert.ok(expectedRows.some((row) => row.context.includes("01 Dec 2026, 02:53 PM")), "Expected export is original month-name text, never numeric intermediate text");
  const actualBytes = Buffer.from(csvOwner.bytes(rows), "utf8"), expectedBytes = Buffer.from(csvOwner.bytes(expectedRows), "utf8");
  assert.deepEqual(actualBytes, expectedBytes, `Actual ${reportId} csvCell/CSV/BOM bytes remain exact`);
  assert.ok(actualBytes.toString("utf8").includes(unrelatedDirections), "Unrelated directionality marks survive export unchanged");
  assert.ok(current.recordGroups.some((group) => group.items.some((item) => item.meta.includes("\u206601/12/2026, 02:53 PM\u2069"))), "Actual UI presentation retains isolated timestamps inside Arabic metadata");
  assert.ok(rows.every((row) => !row.context.includes("\u206601/12/2026, 02:53 PM\u2069")), "New timestamp envelopes do not leak into CSV context");
  return { reportId, rows: rows.length, byteLength: actualBytes.length, sha256: createHash("sha256").update(actualBytes).digest("hex") };
});
if (originalDateSource) {
  for (const value of ["2026-12-01T12:53:00.000Z", "2026-04-23T22:30:00.000Z", "2026-12-01T12:53:00", "0001-12-01T12:53:00.000Z", "+010000-12-01T12:53:00.000Z", "2026-12-01", "invalid", ""]) {
    assert.equal(dates.serializeAdminDateTimeDisplay(dates.formatAdminDateTime(value)), originalDates.formatAdminDateTime(value), "Parsing/timezone/fallback/date-only serialization equals the earliest captured owner");
  }
}
const bypassedExport = reportPresentation.replace("context: serializeAdminDateTimeDisplay(item.meta)", "context: item.meta");
assert.notEqual(bypassedExport, reportPresentation, "Negative mutates the actual export inverse call");
const bypassOwner = loadPresentation(bypassedExport, dates);
const expectedAuditRows = previousPresentation.buildAdminReportExportRows(previousPresentation.buildAdminReportPresentation(rtlModel, "audit", rtlContext));
assert.notDeepEqual(bypassOwner.buildAdminReportExportRows(bypassOwner.buildAdminReportPresentation(rtlModel, "audit", rtlContext)), expectedAuditRows, "Bypassing the inverse leaks marks and fails byte parity");
const dateTree = ts.createSourceFile("content-dates.ts", dateSource, ts.ScriptTarget.Latest, true);
const inverseNodes = matchingNodes(dateTree, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "serializeAdminDateTimeDisplay");
assert.equal(inverseNodes.length, 1);
const inverseBody = (inverseNodes[0] as ts.FunctionDeclaration).body!;
const serializerReturn = inverseBody.statements.find(ts.isReturnStatement);
assert.ok(serializerReturn?.expression);
const broadDateSource = dateSource.slice(0, serializerReturn.expression.getStart(dateTree)) + `(${serializerReturn.expression.getText(dateTree)}).replace(/[\\u2066\\u2069]/gu, "")` + dateSource.slice(serializerReturn.expression.end);
const broadDates = loadReportPureModule<DateOwner>(broadDateSource), broadOwner = loadPresentation(reportPresentation, broadDates);
assert.notDeepEqual(broadOwner.buildAdminReportExportRows(broadOwner.buildAdminReportPresentation(rtlModel, "audit", rtlContext)), expectedAuditRows, "A broad bidi stripper corrupts unrelated content and fails parity");
const rtlOutputArgument = process.argv.find((argument) => argument.startsWith("--date-rtl-output-file="));
if (rtlOutputArgument) writeFileSync(resolve(root, rtlOutputArgument.slice("--date-rtl-output-file=".length)), JSON.stringify({
  status: "PASS", basis: originalDateSource ? "earliest captured month-name date owner and original Reports owner" : "explicit original month-name export vectors through actual Reports owners", cases: rtlCsvProof, negatives: ["bypassed export serializer", "overbroad bidi stripping after correct serialization"], capturedParseParityCases: originalDateSource ? 8 : 0,
  sourceHashes: [dateOwnerPath, presentationOwnerPath, "src/app/admin/reports/export/route.ts"].map((path) => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex") })),
  limitations: ["Pure actual report builders/export rows and actual route CSV fragment only; no authenticated HTTP route, DB read or audit mutation was executed.", "DOM visual order, font geometry and screen-reader/browser behavior require separate live RTL evidence."],
}, null, 2) + "\n");
console.log(`OK: Admin RTL timestamp/original export parity (${rtlCsvProof.length} reports, 2 negatives, ${originalDateSource ? 8 : 0} captured parsing cases).`);

console.log("OK: Reports & Analytics capability behavior and ownership guards passed.");
