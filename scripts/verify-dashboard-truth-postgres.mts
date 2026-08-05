import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DASHBOARD_TRUTH_DATABASE_URL;
if (!connectionString) throw new Error("DASHBOARD_TRUTH_DATABASE_URL is required.");
if (process.env.DASHBOARD_TRUTH_DATABASE_REQUIRED !== "1") {
  throw new Error("DASHBOARD_TRUTH_DATABASE_REQUIRED=1 is required.");
}
if (process.env.DASHBOARD_TRUTH_DATABASE_DISPOSABLE !== "1") {
  throw new Error("Refusing fixture setup without DASHBOARD_TRUTH_DATABASE_DISPOSABLE=1.");
}

const migrationVersion = "20260805210000";
const migrationSource = readFileSync(
  "sql/migrations/20260805210000_dashboard_truth_closure.sql",
  "utf8",
).replace(/^\uFEFF/u, "");

const client = new Client({ connectionString, application_name: "dashboard-truth-postgres-proof" });
await client.connect();

try {
  const databaseName = String((await client.query("select current_database() as name")).rows[0]?.name ?? "");
  assert.match(databaseName, /dashboard|venesia/i, "disposable database name must be explicit");
  const existingPublicTables = Number(
    (await client.query("select count(*)::integer as count from pg_tables where schemaname='public'")).rows[0]?.count,
  );
  assert.equal(existingPublicTables, 0, "isolated proof refuses a non-empty public schema");

  await client.query("begin");
  await client.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key,
      statements text[] not null,
      name text,
      created_by text,
      idempotency_key text,
      rollback text[]
    );

    create table public.topics (
      id bigint primary key,
      title text not null,
      content_type text not null,
      slug text not null,
      status text,
      category text not null,
      image text not null,
      seo_description text not null default '',
      is_featured boolean not null default false,
      updated_at timestamptz not null default now(),
      published_at timestamptz,
      deleted_at timestamptz
    );
    create table public.topic_categories (
      id bigint primary key,
      image text,
      is_active boolean
    );
    create table public.projects (
      id bigint primary key,
      code text not null,
      arabic_name text not null,
      slug text not null,
      publication_status text not null,
      updated_at timestamptz not null default now()
    );
    create table public.pages (
      id bigint primary key,
      status text not null
    );
    create table public.media_assets (
      id uuid primary key,
      status text not null,
      reconciliation_state text not null,
      missing_object boolean not null
    );
    create table public.admin_audit_logs (
      id bigint primary key,
      created_at timestamptz not null default now()
    );
    create table public.site_settings (
      key text primary key
    );

    alter table public.topics enable row level security;
    alter table public.topic_categories enable row level security;
    alter table public.projects enable row level security;
    alter table public.pages enable row level security;
    alter table public.media_assets enable row level security;
    alter table public.admin_audit_logs enable row level security;
    alter table public.site_settings enable row level security;

    create index pages_status_idx on public.pages(status);
    create index media_assets_reconciliation_idx on public.media_assets(reconciliation_state, missing_object) where status <> 'deleted';
    create index admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
  `);

  await client.query(migrationSource);
  await client.query(
    `insert into supabase_migrations.schema_migrations(version,statements,name,created_by,idempotency_key)
     values($1,array[$2],'dashboard_truth_closure','dashboard-truth-postgres-proof',$1)`,
    [migrationVersion, migrationSource],
  );

  await client.query(`
    insert into public.topics(id,title,content_type,slug,status,category,image,seo_description,is_featured,updated_at,deleted_at) values
      (1,'Published','article','published','published','News','/one.jpg','SEO',true,now(),null),
      (2,'Draft','article','draft','draft','News','','',false,now() - interval '40 days',null),
      (3,'Hidden','video','hidden','unpublished','Video','/three.jpg','',false,now() - interval '1 day',null),
      (4,'Deleted','article','deleted','published','News','/four.jpg','SEO',false,now(),now());
    insert into public.topic_categories(id,image,is_active) values
      (1,'/category.jpg',true),(2,null,false),(3,null,null);
    insert into public.projects(id,code,arabic_name,slug,publication_status,updated_at) values
      (10,'P10','مشروع منشور','p10','published',now()),
      (11,'P11','مشروع مسودة','p11','draft',now() - interval '1 day');
    insert into public.pages(id,status) values (20,'published'),(21,'draft');
    insert into public.media_assets(id,status,reconciliation_state,missing_object) values
      ('00000000-0000-0000-0000-000000000001','active','synced',false),
      ('00000000-0000-0000-0000-000000000002','missing','uncertain',true),
      ('00000000-0000-0000-0000-000000000003','deleted','synced',false);
  `);

  await client.query("set local role service_role");
  const model = (await client.query("select public.admin_dashboard_truth_v1() as model")).rows[0]?.model;
  await client.query("reset role");

  assert.equal(model.contractVersion, "dashboard-truth-v1");
  assert.deepEqual(model.kpis.topics, {
    total: 3,
    published: 1,
    non_published: 2,
    draft: 1,
    unpublished: 1,
    archived: 0,
    featured: 1,
  });
  assert.deepEqual(model.kpis.categories, { total: 3, active: 2, inactive: 1 });
  assert.deepEqual(model.kpis.projects, {
    total: 2,
    published: 1,
    non_published: 1,
    draft: 1,
    unpublished: 0,
  });
  assert.deepEqual(model.kpis.pages, { total: 2, published: 1, non_published: 1 });
  assert.deepEqual(model.kpis.media, { total: 2, active: 1, issues: 1 });
  assert.deepEqual(model.contentHealth, {
    topicsMissingImage: 1,
    topicsMissingSeoDescription: 2,
    categoriesMissingImage: 1,
    staleDrafts: 1,
  });
  assert.equal(model.recentTopics.length, 3, "soft-deleted topics must not enter recency");
  assert.equal(model.recentProjects.length, 2);
  assert.equal(model.databaseDiagnostics.migrationRegistered, true);
  assert.equal(model.databaseDiagnostics.rpcAclServiceOnly, true);
  assert.deepEqual(model.databaseDiagnostics.missingIndexes, []);
  assert.ok(Object.values(model.databaseDiagnostics.rls).every(Boolean));

  const acl = (await client.query(`
    select
      has_function_privilege('service_role','public.admin_dashboard_truth_v1()','execute') as service,
      has_function_privilege('authenticated','public.admin_dashboard_truth_v1()','execute') as authenticated,
      has_function_privilege('anon','public.admin_dashboard_truth_v1()','execute') as anon
  `)).rows[0];
  assert.deepEqual(acl, { service: true, authenticated: false, anon: false });

  await client.query("savepoint anon_denial");
  await client.query("set local role anon");
  await assert.rejects(
    client.query("select public.admin_dashboard_truth_v1()"),
    /permission denied/i,
    "anon must not execute the administrative read model",
  );
  await client.query("rollback to savepoint anon_denial");
  await client.query("reset role");

  const registry = (await client.query(
    "select statements[1] as statement from supabase_migrations.schema_migrations where version=$1",
    [migrationVersion],
  )).rows;
  assert.equal(registry.length, 1);
  assert.equal(registry[0]?.statement, migrationSource, "registry provenance must equal repository SQL");

  await client.query("rollback");
  console.log("OK: Dashboard Truth migration passed isolated PostgreSQL proof.");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
