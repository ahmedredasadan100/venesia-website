-- DASHBOARD TRUTH CLOSURE
-- One authenticated, service-role-only read model for Dashboard KPIs, recency,
-- content-health, and database diagnostics. Audit and Media diagnostics keep
-- their existing domain owners and are composed by the server loader.

create index if not exists topics_dashboard_updated_idx
  on public.topics (updated_at desc, id desc)
  where deleted_at is null;

create index if not exists projects_dashboard_updated_idx
  on public.projects (updated_at desc, id desc);

create index if not exists topic_categories_dashboard_active_idx
  on public.topic_categories (is_active);

create or replace function public.admin_dashboard_truth_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with
topic_stats as (
  select
    count(*)::integer as total,
    count(*) filter (where status = 'published')::integer as published,
    count(*) filter (where status is distinct from 'published')::integer as non_published,
    count(*) filter (where status = 'draft')::integer as draft,
    count(*) filter (where status = 'unpublished')::integer as unpublished,
    count(*) filter (where status = 'archived')::integer as archived,
    count(*) filter (where is_featured)::integer as featured
  from public.topics
  where deleted_at is null
),
category_stats as (
  select
    count(*)::integer as total,
    count(*) filter (where is_active is distinct from false)::integer as active,
    count(*) filter (where is_active = false)::integer as inactive
  from public.topic_categories
),
project_stats as (
  select
    count(*)::integer as total,
    count(*) filter (where publication_status = 'published')::integer as published,
    count(*) filter (where publication_status is distinct from 'published')::integer as non_published,
    count(*) filter (where publication_status = 'draft')::integer as draft,
    count(*) filter (where publication_status = 'unpublished')::integer as unpublished
  from public.projects
),
page_stats as (
  select
    count(*)::integer as total,
    count(*) filter (where status = 'published')::integer as published,
    count(*) filter (where status is distinct from 'published')::integer as non_published
  from public.pages
),
media_stats as (
  select
    count(*) filter (where status <> 'deleted')::integer as total,
    count(*) filter (
      where status = 'active'
        and reconciliation_state = 'synced'
        and missing_object = false
    )::integer as active,
    count(*) filter (
      where status <> 'deleted'
        and (
          status <> 'active'
          or reconciliation_state <> 'synced'
          or missing_object
        )
    )::integer as issues
  from public.media_assets
),
content_health as (
  select jsonb_build_object(
    'topicsMissingImage', (
      select count(*)::integer
      from public.topics
      where deleted_at is null and nullif(btrim(image), '') is null
    ),
    'topicsMissingSeoDescription', (
      select count(*)::integer
      from public.topics
      where deleted_at is null and nullif(btrim(seo_description), '') is null
    ),
    'categoriesMissingImage', (
      select count(*)::integer
      from public.topic_categories
      where is_active is distinct from false and nullif(btrim(image), '') is null
    ),
    'staleDrafts', (
      select count(*)::integer
      from public.topics
      where deleted_at is null
        and status = 'draft'
        and updated_at < now() - interval '30 days'
    )
  ) as value
),
recent_topics as (
  select coalesce(jsonb_agg(to_jsonb(topic_row) order by topic_row.updated_at desc, topic_row.id desc), '[]'::jsonb) as value
  from (
    select id, title, content_type, slug, status, category, updated_at, published_at
    from public.topics
    where deleted_at is null
    order by updated_at desc, id desc
    limit 6
  ) topic_row
),
recent_projects as (
  select coalesce(jsonb_agg(to_jsonb(project_row) order by project_row.updated_at desc, project_row.id desc), '[]'::jsonb) as value
  from (
    select id, code, arabic_name, slug, publication_status, updated_at
    from public.projects
    order by updated_at desc, id desc
    limit 4
  ) project_row
),
required_indexes(index_name) as (
  values
    ('topics_dashboard_updated_idx'::text),
    ('projects_dashboard_updated_idx'::text),
    ('topic_categories_dashboard_active_idx'::text),
    ('pages_status_idx'::text),
    ('media_assets_reconciliation_idx'::text),
    ('admin_audit_logs_created_at_idx'::text)
),
missing_indexes as (
  select coalesce(jsonb_agg(index_name order by index_name), '[]'::jsonb) as value
  from required_indexes required
  where not exists (
    select 1
    from pg_catalog.pg_indexes actual
    where actual.schemaname = 'public'
      and actual.indexname = required.index_name
  )
),
rls_state as (
  select jsonb_object_agg(expected.table_name, coalesce(actual.relrowsecurity, false)) as value
  from (
    values
      ('topics'::text),
      ('topic_categories'::text),
      ('projects'::text),
      ('pages'::text),
      ('media_assets'::text),
      ('admin_audit_logs'::text),
      ('site_settings'::text)
  ) expected(table_name)
  left join pg_catalog.pg_class actual
    on actual.relname = expected.table_name
   and actual.relnamespace = 'public'::regnamespace
),
database_diagnostics as (
  select jsonb_build_object(
    'source', 'public.admin_dashboard_truth_v1()',
    'migrationVersion', '20260805210000',
    'migrationRegistered', exists (
      select 1
      from supabase_migrations.schema_migrations
      where version = '20260805210000'
    ),
    'rls', (select value from rls_state),
    'missingIndexes', (select value from missing_indexes),
    'rpcAclServiceOnly',
      has_function_privilege('service_role', 'public.admin_dashboard_truth_v1()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.admin_dashboard_truth_v1()', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.admin_dashboard_truth_v1()', 'EXECUTE'),
    'checkedAt', clock_timestamp()
  ) as value
)
select jsonb_build_object(
  'contractVersion', 'dashboard-truth-v1',
  'checkedAt', clock_timestamp(),
  'kpis', jsonb_build_object(
    'topics', to_jsonb(topic_stats),
    'categories', to_jsonb(category_stats),
    'projects', to_jsonb(project_stats),
    'pages', to_jsonb(page_stats),
    'media', to_jsonb(media_stats)
  ),
  'contentHealth', (select value from content_health),
  'recentTopics', (select value from recent_topics),
  'recentProjects', (select value from recent_projects),
  'databaseDiagnostics', (select value from database_diagnostics)
)
from topic_stats, category_stats, project_stats, page_stats, media_stats;
$function$;

revoke all on function public.admin_dashboard_truth_v1() from public;
revoke all on function public.admin_dashboard_truth_v1() from anon;
revoke all on function public.admin_dashboard_truth_v1() from authenticated;
grant execute on function public.admin_dashboard_truth_v1() to service_role;

comment on function public.admin_dashboard_truth_v1() is
  'Dashboard Truth v1: one request-time KPI, content-health, recency, and database-diagnostics read model. Service-role only; page auth is enforced before invocation.';
