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
        draft: 0,
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
      pendingPublishing: { topics: 0, projects: 0 },
      drafts: { topics: 0, projects: 0, pages: 0 },
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

const analytics = await createAnalyticsProviderRegistry([]).load();
assert.equal(analytics.contractVersion, ANALYTICS_CONTRACT_VERSION);
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

function validContentAssessment(id: number): ContentReviewAssessment {
  return {
    id,
    title: `Valid content ${id}`,
    status: "draft",
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
const loader = source("src/lib/admin/reports/load-admin-reports.ts");
const analyticsRoot = source("src/lib/admin/reports/load-analytics.ts");
const analyticsContract = source("src/lib/admin/reports/analytics-contract.ts");
const view = source("src/components/admin/reports/AdminReportsView.tsx");
const reviewLoader = source("src/lib/admin/content-workflow/load-content-review-report.ts");
const reviewOwner = source("src/lib/admin/content-workflow/content-review-report.ts");
const migration = source("sql/migrations/20260805230000_reports_analytics_capability_closure.sql");
const manifest = source("src/lib/admin/interaction-system/adoption-manifest.ts");
const navigation = source("src/config/admin/navigation.ts");
const workflow = source(".github/workflows/quality-gate.yml");

assert.match(page, /export const dynamic = "force-dynamic"/);
assert.match(page, /loadAdminReports\(\)/);
assert.doesNotMatch(page, /AdminPlaceholderPage|getSupabaseAdmin|\.from\(|\.rpc\(/);
assert.ok(
  loader.indexOf("await requireAdminSession()") < loader.indexOf("Promise.allSettled"),
  "auth must complete before privileged Reports sources start",
);
assert.match(loader, /\.rpc\("admin_reports_truth_v1"\)/);
assert.match(loader, /loadAdminDashboardSources\(\)/, "Reports and Dashboard must share the Dashboard owner");
assert.match(loader, /loadAdminAuditReport\(\)/, "Reports must use the Audit owner");
assert.match(loader, /runGlobalSeoHealth\(\)/, "Reports must use the SEO owner");
assert.match(loader, /loadContentReviewReport\(\)/, "Reports must use the current validation owner");
assert.match(loader, /loadAnalyticsSnapshot\(\)/, "Reports must use one Analytics composition root");
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
assert.match(view, /لا تُعرض Charts أوZeros عند غياب المصدر/);
assert.match(view, /غير مفعّل/);
assert.match(view, /Content Reports/);
assert.match(view, /Projects Reports/);
assert.match(view, /SEO Reports/);
assert.match(view, /Media Reports/);
assert.match(view, /Publishing Reports/);
assert.match(view, /Audit Reports/);
assert.match(view, /System Reports/);
assert.match(view, /Analytics Reports/);

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
assert.match(navigation, /id: "reports-overview"/);
assert.match(workflow, /Reports Analytics · PostgreSQL 15/);

const runtimeSources = `${page}\n${loader}\n${analyticsRoot}\n${view}`;
assert.doesNotMatch(runtimeSources, /\b(?:mock|placeholder|dummy|fake)\b/i);
assert.doesNotMatch(runtimeSources, /unstable_cache|revalidatePath|revalidateTag|router\.refresh/);

console.log("OK: Reports & Analytics capability behavior and ownership guards passed.");
