import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is required.");

const migrationVersion = "20260807120000";
const canonicalizeMigrationSql = (source: string) =>
  source.replace(/^\uFEFF/u, "").replace(/\r\n?/g, "\n");
const migrationSource = canonicalizeMigrationSql(readFileSync(
  "sql/migrations/20260807120000_system_publication_summary_cards_closure.sql",
  "utf8",
));
const migrationHash = createHash("sha256").update(migrationSource).digest("hex");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: "dashboard-truth-live-read-only-proof",
});
await client.connect();

try {
  await client.query("begin read only");
  const registry = (await client.query(
    `select version,name,cardinality(statements) as statement_count,statements[1] as statement
     from supabase_migrations.schema_migrations where version=$1`,
    [migrationVersion],
  )).rows;
  assert.equal(registry.length, 1, "Dashboard migration must be registered exactly once");
  assert.equal(registry[0]?.name, "system_publication_summary_cards_closure");
  assert.equal(Number(registry[0]?.statement_count), 1);
  assert.equal(
    createHash("sha256")
      .update(canonicalizeMigrationSql(String(registry[0]?.statement ?? "")))
      .digest("hex"),
    migrationHash,
    "live registry SQL must match the repository migration",
  );

  const signatures = Number((await client.query(`
    select count(*)::integer as count
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_dashboard_truth_v1'
  `)).rows[0]?.count);
  assert.equal(signatures, 1, "Dashboard RPC must have one signature and no legacy overload");

  const acl = (await client.query(`
    select
      has_function_privilege('service_role','public.admin_dashboard_truth_v1()','execute') as service,
      has_function_privilege('authenticated','public.admin_dashboard_truth_v1()','execute') as authenticated,
      has_function_privilege('anon','public.admin_dashboard_truth_v1()','execute') as anon
  `)).rows[0];
  assert.deepEqual(acl, { service: true, authenticated: false, anon: false });

  const model = (await client.query("select public.admin_dashboard_truth_v1() as model")).rows[0]?.model;
  assert.equal(model.contractVersion, "dashboard-truth-v1");
  assert.equal(model.databaseDiagnostics.migrationRegistered, true);
  assert.equal(model.databaseDiagnostics.rpcAclServiceOnly, true);
  assert.deepEqual(model.databaseDiagnostics.missingIndexes, []);
  assert.ok(Object.values(model.databaseDiagnostics.rls).every(Boolean));

  const independent = (await client.query(`
    select
      (select count(*)::integer from public.topics where deleted_at is null) as topics_total,
      (select count(*)::integer from public.topics where deleted_at is null and status='published') as topics_published,
      (select count(*)::integer from public.projects) as projects_total,
      (select count(*)::integer from public.projects where publication_status='published') as projects_published,
      (select count(*)::integer from public.pages) as pages_total,
      (select count(*)::integer from public.topic_categories where status='published') as categories_published,
      (select count(*)::integer from public.media_assets where status <> 'deleted') as media_total
  `)).rows[0];
  assert.equal(model.kpis.topics.total, independent.topics_total);
  assert.equal(model.kpis.topics.published, independent.topics_published);
  assert.equal(model.kpis.projects.total, independent.projects_total);
  assert.equal(model.kpis.projects.published, independent.projects_published);
  assert.equal(model.kpis.pages.total, independent.pages_total);
  assert.equal(model.kpis.categories.published, independent.categories_published);
  assert.equal(model.kpis.media.total, independent.media_total);

  const requiredIndexes = [
    "topics_dashboard_updated_idx",
    "projects_dashboard_updated_idx",
    "topic_categories_dashboard_active_idx",
    "pages_status_idx",
    "media_assets_reconciliation_idx",
    "admin_audit_logs_created_at_idx",
  ];
  const actualIndexes = (await client.query(
    "select indexname from pg_indexes where schemaname='public' and indexname=any($1)",
    [requiredIndexes],
  )).rows.map((row: { indexname: string }) => row.indexname);
  assert.equal(actualIndexes.length, requiredIndexes.length, "Dashboard-required indexes drifted");

  const protectedTables = [
    "topics",
    "topic_categories",
    "projects",
    "pages",
    "media_assets",
    "admin_audit_logs",
    "site_settings",
  ];
  const rlsRows = (await client.query(
    `select relname,relrowsecurity from pg_class
     where relnamespace='public'::regnamespace and relname=any($1)`,
    [protectedTables],
  )).rows;
  assert.equal(rlsRows.length, protectedTables.length);
  assert.ok(rlsRows.every((row: { relrowsecurity: boolean }) => row.relrowsecurity));

  const recentTopicIds = model.recentTopics.map((row: { id: number }) => row.id);
  const recentProjectIds = model.recentProjects.map((row: { id: number }) => row.id);
  assert.equal(new Set(recentTopicIds).size, recentTopicIds.length, "recent topics contain duplicate owners");
  assert.equal(new Set(recentProjectIds).size, recentProjectIds.length, "recent projects contain duplicate owners");

  await client.query("rollback");
  console.log(
    `OK: live Dashboard Truth proof passed (migration sha256 ${migrationHash}, topics ${model.kpis.topics.total}, projects ${model.kpis.projects.total}).`,
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
