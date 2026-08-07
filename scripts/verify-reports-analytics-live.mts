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
  application_name: "reports-analytics-live-read-only-proof",
});
await client.connect();

try {
  await client.query("begin read only");
  const registry = (await client.query(
    `select version,name,cardinality(statements) as statement_count,statements[1] as statement
     from supabase_migrations.schema_migrations where version=$1`,
    [migrationVersion],
  )).rows;
  assert.equal(registry.length, 1, "Reports migration must be registered exactly once");
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
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_reports_truth_v1'
  `)).rows[0]?.count);
  assert.equal(signatures, 1, "Reports RPC must have one signature and no legacy overload");

  const acl = (await client.query(`
    select
      has_function_privilege('service_role','public.admin_reports_truth_v1()','execute') as service,
      has_function_privilege('authenticated','public.admin_reports_truth_v1()','execute') as authenticated,
      has_function_privilege('anon','public.admin_reports_truth_v1()','execute') as anon
  `)).rows[0];
  assert.deepEqual(acl, { service: true, authenticated: false, anon: false });

  const model = (await client.query("select public.admin_reports_truth_v1() as model")).rows[0]?.model;
  assert.equal(model.contractVersion, "admin-reports-truth-v1");
  assert.equal(model.databaseDiagnostics.migrationRegistered, true);
  assert.equal(model.databaseDiagnostics.dashboardReadModelAvailable, true);
  assert.equal(model.databaseDiagnostics.rpcAclServiceOnly, true);
  assert.deepEqual(model.databaseDiagnostics.missingIndexes, []);
  assert.ok(Object.values(model.databaseDiagnostics.rls).every(Boolean));
  assert.ok(model.sourcesOfTruth.includes("public.admin_dashboard_truth_v1()"));

  const independent = (await client.query(`
    select
      (select count(*)::integer from public.topics where deleted_at is null and (
        nullif(btrim(seo_title),'') is null or nullif(btrim(seo_description),'') is null or nullif(btrim(focus_keyword),'') is null
      )) as content_missing_seo,
      (select count(*)::integer from public.topics where deleted_at is null and nullif(btrim(image),'') is null) as content_missing_images,
      (select count(*)::integer from public.projects where featured) as projects_featured,
      (select count(*)::integer from public.topics where deleted_at is null and content_type='site_update') as construction_updates,
      (select count(*)::integer from public.media_assets where status <> 'deleted' and missing_object) as media_missing_objects,
      (select count(*)::integer from public.media_assets where status <> 'deleted' and media_kind='image' and nullif(btrim(default_alt_text),'') is null) as media_missing_alt,
      (select count(*)::integer from public.topics where deleted_at is null and status='unpublished') as topic_unpublished,
      (select count(*)::integer from public.projects where publication_status='unpublished') as project_unpublished,
      (select count(*)::integer from public.pages where status='unpublished') as page_unpublished
  `)).rows[0];
  assert.equal(model.content.missingSeo, independent.content_missing_seo);
  assert.equal(model.content.missingImages, independent.content_missing_images);
  assert.equal(model.projects.featured, independent.projects_featured);
  assert.equal(model.projects.constructionUpdates.total, independent.construction_updates);
  assert.equal(model.media.missingObjects, independent.media_missing_objects);
  assert.equal(model.media.missingAlt, independent.media_missing_alt);
  assert.equal(model.publishing.unpublished.topics, independent.topic_unpublished);
  assert.equal(model.publishing.unpublished.projects, independent.project_unpublished);
  assert.equal(model.publishing.unpublished.pages, independent.page_unpublished);

  const requiredIndexes = [
    "topics_dashboard_updated_idx",
    "projects_dashboard_updated_idx",
    "topics_reports_site_update_idx",
    "projects_reports_published_at_idx",
    "media_assets_reconciliation_idx",
    "media_assets_default_alt_idx",
    "media_references_reports_active_idx",
    "admin_audit_logs_created_at_idx",
    "admin_audit_logs_action_created_at_idx",
    "pages_status_idx",
  ];
  const actualIndexes = (await client.query(
    "select indexname from pg_indexes where schemaname='public' and indexname=any($1)",
    [requiredIndexes],
  )).rows.map((row: { indexname: string }) => row.indexname);
  assert.equal(actualIndexes.length, requiredIndexes.length, "Reports-required indexes drifted");

  const protectedTables = [
    "topics",
    "projects",
    "pages",
    "media_assets",
    "media_references",
    "admin_audit_logs",
    "site_settings",
    "project_floor_plans",
    "project_media",
    "project_videos",
  ];
  const rlsRows = (await client.query(
    `select relname,relrowsecurity from pg_class
     where relnamespace='public'::regnamespace and relname=any($1)`,
    [protectedTables],
  )).rows;
  assert.equal(rlsRows.length, protectedTables.length);
  assert.ok(rlsRows.every((row: { relrowsecurity: boolean }) => row.relrowsecurity));

  await client.query("rollback");
  console.log(
    `OK: live Reports & Analytics proof passed (migration sha256 ${migrationHash}, sources ${model.sourcesOfTruth.length}).`,
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
