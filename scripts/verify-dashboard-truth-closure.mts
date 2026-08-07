import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DASHBOARD_CONTRACT_VERSION,
  DASHBOARD_MIGRATION_VERSION,
  buildAdminDashboardModel,
  parseDashboardReadModel,
  type DashboardAuditReadModel,
  type DashboardMediaDiagnostics,
  type DashboardReadModel,
  type DashboardSource,
  type DashboardSourceStatus,
} from "../src/lib/admin/dashboard/dashboard-contract.ts";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

function rawReadModel() {
  return {
    contractVersion: DASHBOARD_CONTRACT_VERSION,
    checkedAt: "2026-08-05T21:00:00.000Z",
    kpis: {
      topics: {
        total: 0,
        published: 0,
        unpublished: 0,
        featured: 0,
      },
      categories: { total: 0, published: 0, unpublished: 0 },
      projects: {
        total: 0,
        published: 0,
        unpublished: 0,
      },
      pages: { total: 0, published: 0, unpublished: 0 },
      media: { total: 0, active: 0, issues: 0 },
    },
    contentHealth: {
      topicsMissingImage: 0,
      topicsMissingSeoDescription: 0,
      categoriesMissingImage: 0,
      staleUnpublished: 0,
    },
    recentTopics: [],
    recentProjects: [],
    databaseDiagnostics: {
      source: "public.admin_dashboard_truth_v1()",
      migrationVersion: DASHBOARD_MIGRATION_VERSION,
      migrationRegistered: true,
      rls: {
        topics: true,
        topic_categories: true,
        projects: true,
        pages: true,
        media_assets: true,
        admin_audit_logs: true,
        site_settings: true,
      },
      missingIndexes: [],
      rpcAclServiceOnly: true,
      checkedAt: "2026-08-05T21:00:00.000Z",
    },
  };
}

function envelope<T>(
  key: DashboardSource<T>["key"],
  status: DashboardSourceStatus,
  data: T | null,
): DashboardSource<T> {
  return {
    key,
    label: key,
    source: `test:${key}`,
    status,
    checkedAt: "2026-08-05T21:00:00.000Z",
    message: status,
    data,
  };
}

const readModel = parseDashboardReadModel(rawReadModel());
assert.equal(readModel.kpis.topics.total, 0, "a proven database zero must remain a real zero");
assert.deepEqual(readModel.recentTopics, [], "a proven empty topic dataset must remain empty");
assert.deepEqual(readModel.recentProjects, [], "a proven empty project dataset must remain empty");

const auditData: DashboardAuditReadModel = { events: [], total: 0 };
const mediaData: DashboardMediaDiagnostics = {
  state: "synced",
  provider: "supabase",
  environment: "production",
  lastUpdatedAt: null,
  storageAssetCount: 0,
  catalogAssetCount: 0,
  warnings: [],
};

function dashboardState(statuses: [DashboardSourceStatus, DashboardSourceStatus, DashboardSourceStatus]) {
  return buildAdminDashboardModel({
    checkedAt: "2026-08-05T21:00:00.000Z",
    readModel: envelope<DashboardReadModel>(
      "read_model",
      statuses[0],
      statuses[0] === "unavailable" ? null : readModel,
    ),
    audit: envelope<DashboardAuditReadModel>(
      "audit",
      statuses[1],
      statuses[1] === "unavailable" ? null : auditData,
    ),
    media: envelope<DashboardMediaDiagnostics>(
      "media_diagnostics",
      statuses[2],
      statuses[2] === "unavailable" ? null : mediaData,
    ),
  }).state;
}

assert.equal(dashboardState(["ready", "ready", "ready"]), "ready", "all sources ready");
assert.equal(dashboardState(["ready", "unavailable", "ready"]), "partial", "one source fails");
assert.equal(
  dashboardState(["ready", "unavailable", "unavailable"]),
  "partial",
  "more than one source fails while one remains truthful",
);
assert.equal(
  dashboardState(["unavailable", "unavailable", "unavailable"]),
  "unavailable",
  "all sources fail",
);
assert.equal(dashboardState(["ready", "ready", "warning"]), "partial", "diagnostics warning");
assert.equal(
  buildAdminDashboardModel({
    checkedAt: "2026-08-05T21:00:00.000Z",
    readModel: envelope("read_model", "ready", readModel),
    audit: envelope("audit", "ready", auditData),
    media: envelope("media_diagnostics", "ready", mediaData),
  }).audit.data?.events.length,
  0,
  "a successful Audit read with no events is a truthful empty state",
);

assert.throws(
  () => parseDashboardReadModel({ ...rawReadModel(), kpis: { topics: {} } }),
  /Invalid Dashboard read-model object|Invalid Dashboard read-model count/,
  "malformed RPC data must fail closed",
);
assert.throws(
  () => parseDashboardReadModel({ ...rawReadModel(), contractVersion: "legacy" }),
  /Unsupported Dashboard read-model contract version/,
  "a stale read-model signature must fail closed",
);

const page = source("src/app/admin/page.tsx");
const loader = source("src/lib/admin/dashboard/load-admin-dashboard.ts");
const contract = source("src/lib/admin/dashboard/dashboard-contract.ts");
const view = source("src/components/admin/dashboard/AdminDashboardView.tsx");
const collectionManifest = source("src/lib/admin/interaction-system/adoption-manifest.ts");
const migration = source("sql/migrations/20260805210000_dashboard_truth_closure.sql");
const liveProof = source("scripts/verify-dashboard-truth-live.mts");

assert.match(page, /export const dynamic = "force-dynamic"/, "Dashboard must be request-time rendered");
assert.match(page, /loadAdminDashboard\(\)/, "route must delegate to the Dashboard loader");
assert.doesNotMatch(page, /getSupabaseAdmin|\.from\(|\.rpc\(|try\s*\{|catch\s*\{/, "route must not own reads or fallbacks");
assert.ok(
  loader.indexOf("await requireAdminSession()") < loader.indexOf("Promise.allSettled"),
  "auth must fail before any privileged Dashboard source starts",
);
assert.match(loader, /\.rpc\("admin_dashboard_truth_v1"\)/, "one Dashboard RPC must own KPI truth");
assert.match(loader, /listAdminAuditLogs\(/, "Recent Activity must use the Audit owner");
assert.match(loader, /getMediaCatalogRuntimeState\(/, "Media health must use the Media diagnostics owner");
assert.doesNotMatch(loader, /\.from\("admin_audit_logs"\)/, "Dashboard must not duplicate Audit persistence");
assert.doesNotMatch(loader, /return\s+0|\?\?\s*0|return\s+\[\]|\?\?\s*\[\]/, "source failures must not become zero or empty data");
assert.match(loader, /Promise\.allSettled/, "sources must retain independent failure semantics");
assert.match(loader, /logError\("Dashboard read model unavailable"/, "internal failures must be server-logged");
assert.doesNotMatch(loader, /ip_address|user_agent/, "sensitive Audit fields must not enter the Dashboard payload");

assert.doesNotMatch(view, /key=\{index\}/, "presentation must not use array indexes as identity");
assert.doesNotMatch(view, /\[46,\s*72|Placeholder|تم تحديث لوحة التحكم الرئيسية/, "Dashboard mocks and static chart truth must stay removed");
assert.match(view, /آخر النشاطات/, "Recent Activity remains visible");
assert.match(view, /من مالك Audit الحقيقي فقط/, "Activity provenance must be explicit");
assert.match(view, /غير متاح/, "presentation must distinguish an unavailable source");
assert.match(view, /لا توجد/, "presentation must distinguish a truthful empty dataset");
assert.match(
  collectionManifest,
  /src\/lib\/admin\/dashboard\/load-admin-dashboard\.ts#loadAdminDashboard/,
  "Collection inventory must point to the current Dashboard source owner",
);
assert.match(
  collectionManifest,
  /src\/components\/admin\/dashboard\/AdminDashboardView\.tsx/,
  "Collection inventory must point to the current Dashboard presentation owner",
);
assert.doesNotMatch(
  collectionManifest,
  /src\/app\/admin\/page\.tsx#getDashboardStats/,
  "retired Dashboard source ownership must stay removed",
);

assert.match(contract, /"ready" \| "partial" \| "unavailable"/, "state contract must remain explicit");
assert.doesNotMatch(contract, /dashboard_truth_closed\s*=\s*true/, "closure cannot be claimed in runtime code");

assert.match(migration, /security definer/, "RPC must keep its protected execution boundary");
assert.match(migration, /set search_path = ''/, "RPC must keep a safe search_path");
assert.match(migration, /grant execute on function public\.admin_dashboard_truth_v1\(\) to service_role/, "service role owns execution");
assert.match(migration, /revoke all on function public\.admin_dashboard_truth_v1\(\) from authenticated/, "authenticated clients cannot invoke the RPC directly");
assert.match(migration, /supabase_migrations\.schema_migrations/, "registry provenance must be diagnosed live");
assert.match(migration, /pg_catalog\.pg_indexes/, "required indexes must be diagnosed live");
assert.match(migration, /relrowsecurity/, "RLS state must be diagnosed live");
assert.match(
  liveProof,
  /canonicalizeMigrationSql[\s\S]*replace\(\/\\r\\n\?\/g, "\\n"\)/,
  "live migration provenance must be portable across LF and CRLF checkouts",
);
assert.match(
  liveProof,
  /update\(canonicalizeMigrationSql\(String\(registry\[0\]\?\.statement/,
  "live registry SQL must be canonicalized before provenance hashing",
);

const dashboardSources = `${page}\n${loader}\n${contract}\n${view}`;
assert.doesNotMatch(
  dashboardSources,
  /unstable_cache|revalidatePath|revalidateTag|router\.refresh/,
  "request-time Dashboard truth must not gain a parallel cache or invalidation owner",
);

console.log("OK: Dashboard Truth closure behavior and ownership guards passed.");
