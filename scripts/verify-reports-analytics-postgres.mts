import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.REPORTS_ANALYTICS_DATABASE_URL;
if (!connectionString) throw new Error("REPORTS_ANALYTICS_DATABASE_URL is required.");
if (process.env.REPORTS_ANALYTICS_DATABASE_REQUIRED !== "1") {
  throw new Error("REPORTS_ANALYTICS_DATABASE_REQUIRED=1 is required.");
}
if (process.env.REPORTS_ANALYTICS_DATABASE_DISPOSABLE !== "1") {
  throw new Error("Refusing fixture setup without REPORTS_ANALYTICS_DATABASE_DISPOSABLE=1.");
}

const migrationVersion = "20260805230000";
const migrationSource = readFileSync(
  "sql/migrations/20260805230000_reports_analytics_capability_closure.sql",
  "utf8",
).replace(/^\uFEFF/u, "");

const client = new Client({
  connectionString,
  application_name: "reports-analytics-postgres-proof",
});
await client.connect();

try {
  const databaseName = String((await client.query("select current_database() as name")).rows[0]?.name ?? "");
  assert.match(databaseName, /reports|analytics|venesia/i, "disposable database name must be explicit");
  const publicTables = Number((await client.query(
    "select count(*)::integer as count from pg_tables where schemaname='public'",
  )).rows[0]?.count);
  assert.equal(publicTables, 0, "isolated proof refuses a non-empty public schema");

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
      title text not null default '',
      slug text not null default '',
      status text,
      excerpt text not null default '',
      content text not null default '',
      image text not null default '',
      image_alt text,
      category_slug text not null default '',
      seo_title text not null default '',
      seo_description text not null default '',
      focus_keyword text not null default '',
      canonical_url text,
      robots_index boolean,
      og_image text,
      og_image_alt text not null default '',
      faq jsonb not null default '[]'::jsonb,
      content_type text not null default 'article',
      media_payload jsonb,
      is_featured boolean not null default false,
      published_at timestamptz,
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    create table public.projects (
      id bigint primary key,
      code text not null default '',
      arabic_name text not null default '',
      english_name text not null default '',
      slug text not null default '',
      general_description text not null default '',
      short_description text not null default '',
      image text not null default '',
      image_alt text not null default '',
      hero_image text not null default '',
      hero_image_alt text not null default '',
      small_box_image text not null default '',
      small_box_image_alt text not null default '',
      location_label text not null default '',
      overview_title text not null default '',
      overview_body text not null default '',
      overview_media_type text not null default 'image',
      overview_main_image text,
      delivery_title text not null default '',
      delivery_body text not null default '',
      seo_title text not null default '',
      seo_description text not null default '',
      focus_keyword text not null default '',
      canonical_url text,
      robots_index boolean,
      featured boolean not null default false,
      publication_status text not null default 'draft',
      published_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create table public.pages (
      id bigint primary key,
      status text not null default 'draft',
      seo_title text not null default '',
      seo_description text not null default '',
      canonical_url text,
      robots_index boolean
    );
    create table public.media_assets (
      id uuid primary key,
      status text not null,
      reconciliation_state text not null,
      missing_object boolean not null,
      media_kind text not null,
      byte_size bigint,
      default_alt_text text
    );
    create table public.media_references (
      id uuid primary key,
      asset_id uuid not null references public.media_assets(id),
      entity_type text not null,
      reference_state text not null
    );
    create table public.project_floor_plans (
      id bigint primary key,
      project_id bigint not null references public.projects(id),
      name text not null default '',
      architectural_image text,
      architectural_image_alt text not null default '',
      furnishing_image text,
      furnishing_image_alt text not null default ''
    );
    create table public.project_media (
      id bigint primary key,
      project_id bigint not null references public.projects(id),
      image text not null default '',
      alt_text text not null default ''
    );
    create table public.project_videos (
      id bigint primary key,
      project_id bigint not null references public.projects(id),
      video_url text not null default '',
      poster_image text,
      poster_alt text not null default ''
    );
    create table public.admin_audit_logs (
      id bigint primary key,
      action text not null,
      created_at timestamptz not null default now()
    );
    create table public.site_settings (key text primary key);

    alter table public.topics enable row level security;
    alter table public.projects enable row level security;
    alter table public.pages enable row level security;
    alter table public.media_assets enable row level security;
    alter table public.media_references enable row level security;
    alter table public.project_floor_plans enable row level security;
    alter table public.project_media enable row level security;
    alter table public.project_videos enable row level security;
    alter table public.admin_audit_logs enable row level security;
    alter table public.site_settings enable row level security;

    create index topics_dashboard_updated_idx on public.topics(updated_at desc,id desc) where deleted_at is null;
    create index projects_dashboard_updated_idx on public.projects(updated_at desc,id desc);
    create index media_assets_reconciliation_idx on public.media_assets(reconciliation_state,missing_object) where status <> 'deleted';
    create index media_assets_default_alt_idx on public.media_assets(default_alt_text) where media_kind='image' and status <> 'deleted';
    create index admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
    create index admin_audit_logs_action_created_at_idx on public.admin_audit_logs(action,created_at desc);
    create index pages_status_idx on public.pages(status);

    create function public.admin_dashboard_truth_v1() returns jsonb
    language sql stable security definer set search_path=''
    as $$ select '{}'::jsonb $$;
    revoke all on function public.admin_dashboard_truth_v1() from public, anon, authenticated;
    grant execute on function public.admin_dashboard_truth_v1() to service_role;
  `);

  await client.query(migrationSource);
  await client.query(
    `insert into supabase_migrations.schema_migrations(version,statements,name,created_by,idempotency_key)
     values($1,array[$2],'reports_analytics_capability_closure','reports-analytics-postgres-proof',$1)`,
    [migrationVersion, migrationSource],
  );

  await client.query("set local role service_role");
  const empty = (await client.query("select public.admin_reports_truth_v1() as model")).rows[0]?.model;
  await client.query("reset role");
  assert.equal(empty.contractVersion, "admin-reports-truth-v1");
  assert.deepEqual(empty.content, {
    missingSeo: 0,
    missingImages: 0,
    missingImageAlt: 0,
    publishedWithMissingSeo: 0,
  });
  assert.deepEqual(empty.projects.constructionUpdates, {
    source: "topics.content_type=site_update",
    total: 0,
    published: 0,
    draft: 0,
    unpublished: 0,
  });
  assert.equal(empty.databaseDiagnostics.migrationRegistered, true);

  await client.query(`
    insert into public.topics(id,title,slug,status,excerpt,content,image,image_alt,category_slug,seo_title,seo_description,focus_keyword,content_type,media_payload,published_at) values
      (1,'Article','article','published','Excerpt','Body','/article.jpg','Article alt','news','SEO','Description','article','article',null,now()),
      (2,'Draft','draft','draft','Excerpt','Body','','','news','','','','article',null,null),
      (3,'Site update','site-update','published','Excerpt','Body','/update.jpg','Update alt','updates','SEO','Description','update','site_update',null,now()),
      (4,'Video','video','published','Excerpt','Body','/video.jpg','Video alt','video','SEO','Description','video','video','{}'::jsonb,now());

    insert into public.topics(id,title,slug,status,excerpt,content,image,image_alt,category_slug,seo_title,seo_description,focus_keyword,content_type,published_at)
    select n + 1000, 'Large ' || n, 'large-' || n, 'published', 'Excerpt', 'Body', '/large.jpg', 'Large alt', 'news', 'SEO', 'Description', 'large', 'article', now()
    from generate_series(1,2500) n;

    insert into public.projects(id,code,arabic_name,english_name,slug,general_description,short_description,image,image_alt,hero_image,hero_image_alt,small_box_image,small_box_image_alt,location_label,overview_title,overview_body,overview_media_type,overview_main_image,delivery_title,delivery_body,seo_title,seo_description,focus_keyword,featured,publication_status,published_at) values
      (10,'P10','Project','Project','project','General','Short','/project.jpg','Project alt','/hero.jpg','Hero alt','/small.jpg','Small alt','Cairo','Overview','Overview body','image','/overview.jpg','Delivery','Delivery body','SEO','Description','project',true,'published',now()),
      (11,'','','','','','','','','','','','','','','','image',null,'','','','','',false,'draft',null);

    insert into public.pages(id,status,seo_title,seo_description,robots_index) values
      (20,'published','SEO','Description',true),
      (21,'draft','','',null);

    insert into public.media_assets(id,status,reconciliation_state,missing_object,media_kind,byte_size,default_alt_text) values
      ('00000000-0000-0000-0000-000000000001','active','synced',false,'image',100,null),
      ('00000000-0000-0000-0000-000000000002','missing','uncertain',true,'image',null,'Known alt');
    insert into public.media_references(id,asset_id,entity_type,reference_state) values
      ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','topic','active');
  `);

  await client.query("set local role service_role");
  const model = (await client.query("select public.admin_reports_truth_v1() as model")).rows[0]?.model;
  await client.query("reset role");

  assert.deepEqual(model.content, {
    missingSeo: 1,
    missingImages: 1,
    missingImageAlt: 0,
    publishedWithMissingSeo: 0,
  });
  assert.equal(model.projects.featured, 1);
  assert.equal(model.projects.complete, 1);
  assert.equal(model.projects.incomplete, 1);
  assert.equal(model.projects.missingSeo, 1);
  assert.equal(model.projects.missingImages, 1);
  assert.deepEqual(model.projects.constructionUpdates, {
    source: "topics.content_type=site_update",
    total: 1,
    published: 1,
    draft: 0,
    unpublished: 0,
  });
  assert.deepEqual(model.seo.missingMetadata, { topics: 1, projects: 1, pages: 1 });
  assert.equal(model.media.storage.knownBytes, 100);
  assert.equal(model.media.storage.unknownByteSize, 1);
  assert.equal(model.media.brokenReferences, 1);
  assert.equal(model.media.missingObjects, 1);
  assert.equal(model.media.missingAlt, 1);
  assert.equal(model.media.missingVideoUrls, 1);
  assert.deepEqual(model.publishing.recentPublishing, { windowDays: 30, topics: 2503, projects: 1 });
  assert.deepEqual(model.publishing.drafts, { topics: 1, projects: 1, pages: 1 });
  assert.equal(model.databaseDiagnostics.rpcAclServiceOnly, true);
  assert.equal(model.databaseDiagnostics.dashboardReadModelAvailable, true);
  assert.deepEqual(model.databaseDiagnostics.missingIndexes, []);
  assert.ok(Object.values(model.databaseDiagnostics.rls).every(Boolean));

  const acl = (await client.query(`
    select
      has_function_privilege('service_role','public.admin_reports_truth_v1()','execute') as service,
      has_function_privilege('authenticated','public.admin_reports_truth_v1()','execute') as authenticated,
      has_function_privilege('anon','public.admin_reports_truth_v1()','execute') as anon
  `)).rows[0];
  assert.deepEqual(acl, { service: true, authenticated: false, anon: false });

  await client.query("savepoint anon_denial");
  await client.query("set local role anon");
  await assert.rejects(
    client.query("select public.admin_reports_truth_v1()"),
    /permission denied/i,
    "anon must not execute the administrative Reports read model",
  );
  await client.query("rollback to savepoint anon_denial");
  await client.query("reset role");

  const signatures = Number((await client.query(`
    select count(*)::integer as count from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_reports_truth_v1'
  `)).rows[0]?.count);
  assert.equal(signatures, 1, "one Reports RPC signature and no legacy overload");

  const registry = (await client.query(
    "select statements[1] as statement from supabase_migrations.schema_migrations where version=$1",
    [migrationVersion],
  )).rows;
  assert.equal(registry.length, 1);
  assert.equal(registry[0]?.statement, migrationSource, "registry provenance must equal repository SQL");

  await client.query("rollback");
  console.log("OK: Reports & Analytics migration passed empty, large, ACL, RLS, index, and provenance proof.");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
