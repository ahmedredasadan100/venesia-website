-- REPORTS & ANALYTICS CAPABILITY CLOSURE
-- Reports compose the existing Dashboard, Audit, SEO, Media, and publishing
-- owners. This RPC owns only the additional aggregate database read model.
-- External analytics never enter this function; they use the server adapter
-- contract and remain explicitly unavailable until a provider is configured.

create index if not exists projects_reports_published_at_idx
  on public.projects (published_at desc, id desc)
  where published_at is not null;

create index if not exists topics_reports_site_update_idx
  on public.topics (status, updated_at desc, id desc)
  where deleted_at is null and content_type = 'site_update';

create index if not exists media_references_reports_active_idx
  on public.media_references (asset_id, entity_type)
  where reference_state = 'active';

create or replace function public.admin_reports_truth_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with
content_stats as (
  select jsonb_build_object(
    'missingSeo', count(*) filter (
      where nullif(btrim(seo_title), '') is null
         or nullif(btrim(seo_description), '') is null
         or nullif(btrim(focus_keyword), '') is null
    )::integer,
    'missingImages', count(*) filter (
      where nullif(btrim(image), '') is null
    )::integer,
    'missingImageAlt', count(*) filter (
      where nullif(btrim(image), '') is not null
        and nullif(btrim(image_alt), '') is null
    )::integer,
    'publishedWithMissingSeo', count(*) filter (
      where status = 'published'
        and (
          nullif(btrim(seo_title), '') is null
          or nullif(btrim(seo_description), '') is null
          or nullif(btrim(focus_keyword), '') is null
        )
    )::integer
  ) as value
  from public.topics
  where deleted_at is null
),
project_completeness as (
  select
    project.id,
    (
      nullif(btrim(project.code), '') is null
      or nullif(btrim(project.arabic_name), '') is null
      or nullif(btrim(project.english_name), '') is null
      or nullif(btrim(project.slug), '') is null
      or nullif(btrim(project.general_description), '') is null
      or nullif(btrim(project.short_description), '') is null
      or nullif(btrim(project.image), '') is null
      or nullif(btrim(project.image_alt), '') is null
      or nullif(btrim(project.hero_image), '') is null
      or nullif(btrim(project.hero_image_alt), '') is null
      or nullif(btrim(project.small_box_image), '') is null
      or nullif(btrim(project.small_box_image_alt), '') is null
      or nullif(btrim(project.location_label), '') is null
      or nullif(btrim(project.overview_title), '') is null
      or nullif(btrim(project.overview_body), '') is null
      or nullif(btrim(project.delivery_title), '') is null
      or nullif(btrim(project.delivery_body), '') is null
      or (
        project.overview_media_type = 'image'
        and nullif(btrim(project.overview_main_image), '') is null
      )
      or exists (
        select 1 from public.project_media media
        where media.project_id = project.id
          and (
            nullif(btrim(media.image), '') is null
            or nullif(btrim(media.alt_text), '') is null
          )
      )
      or exists (
        select 1 from public.project_videos video
        where video.project_id = project.id
          and (
            video.video_url !~* '^https?://'
            or (
              nullif(btrim(video.poster_image), '') is not null
              and nullif(btrim(video.poster_alt), '') is null
            )
          )
      )
      or exists (
        select 1 from public.project_floor_plans plan
        where plan.project_id = project.id
          and (
            nullif(btrim(plan.name), '') is null
            or (
              nullif(btrim(plan.architectural_image), '') is not null
              and nullif(btrim(plan.architectural_image_alt), '') is null
            )
            or (
              nullif(btrim(plan.furnishing_image), '') is not null
              and nullif(btrim(plan.furnishing_image_alt), '') is null
            )
          )
      )
    ) as incomplete
  from public.projects project
),
project_stats as (
  select jsonb_build_object(
    'featured', count(*) filter (where project.featured)::integer,
    'missingSeo', count(*) filter (
      where nullif(btrim(project.seo_title), '') is null
         or nullif(btrim(project.seo_description), '') is null
         or nullif(btrim(project.focus_keyword), '') is null
    )::integer,
    'missingImages', count(*) filter (
      where nullif(btrim(project.image), '') is null
         or nullif(btrim(project.hero_image), '') is null
         or nullif(btrim(project.small_box_image), '') is null
    )::integer,
    'complete', count(*) filter (where not completeness.incomplete)::integer,
    'incomplete', count(*) filter (where completeness.incomplete)::integer,
    'constructionUpdates', (
      select jsonb_build_object(
        'source', 'topics.content_type=site_update',
        'total', count(*)::integer,
        'published', count(*) filter (where status = 'published')::integer,
        'draft', count(*) filter (where status = 'draft')::integer,
        'unpublished', count(*) filter (where status = 'unpublished')::integer
      )
      from public.topics
      where deleted_at is null and content_type = 'site_update'
    )
  ) as value
  from public.projects project
  join project_completeness completeness on completeness.id = project.id
),
seo_stats as (
  select jsonb_build_object(
    'missingMetadata', jsonb_build_object(
      'topics', (
        select count(*)::integer from public.topics
        where deleted_at is null and (
          nullif(btrim(seo_title), '') is null
          or nullif(btrim(seo_description), '') is null
        )
      ),
      'projects', (
        select count(*)::integer from public.projects
        where nullif(btrim(seo_title), '') is null
           or nullif(btrim(seo_description), '') is null
      ),
      'pages', (
        select count(*)::integer from public.pages
        where nullif(btrim(seo_title), '') is null
           or nullif(btrim(seo_description), '') is null
      )
    ),
    'canonicalOverrides', (
      select
        (select count(*) from public.topics where deleted_at is null and nullif(btrim(canonical_url), '') is not null)
        + (select count(*) from public.projects where nullif(btrim(canonical_url), '') is not null)
        + (select count(*) from public.pages where nullif(btrim(canonical_url), '') is not null)
    )::integer,
    'indexability', jsonb_build_object(
      'indexablePublished', (
        select
          (select count(*) from public.topics where deleted_at is null and status = 'published' and robots_index is distinct from false)
          + (select count(*) from public.projects where publication_status = 'published' and robots_index is distinct from false)
          + (select count(*) from public.pages where status = 'published' and robots_index is distinct from false)
      )::integer,
      'noindexPublished', (
        select
          (select count(*) from public.topics where deleted_at is null and status = 'published' and robots_index = false)
          + (select count(*) from public.projects where publication_status = 'published' and robots_index = false)
          + (select count(*) from public.pages where status = 'published' and robots_index = false)
      )::integer
    )
  ) as value
),
media_stats as (
  select jsonb_build_object(
    'storage', jsonb_build_object(
      'knownBytes', coalesce(sum(byte_size) filter (where status <> 'deleted' and byte_size is not null), 0)::bigint,
      'unknownByteSize', count(*) filter (where status <> 'deleted' and byte_size is null)::integer
    ),
    'brokenReferences', (
      select count(*)::integer
      from public.media_references reference
      join public.media_assets asset on asset.id = reference.asset_id
      where reference.reference_state = 'active'
        and (
          asset.status <> 'active'
          or asset.reconciliation_state <> 'synced'
          or asset.missing_object
        )
    ),
    'missingObjects', count(*) filter (where status <> 'deleted' and missing_object)::integer,
    'missingAlt', count(*) filter (
      where status <> 'deleted'
        and media_kind = 'image'
        and nullif(btrim(default_alt_text), '') is null
    )::integer,
    'missingVideoUrls', (
      select count(*)::integer
      from public.topics
      where deleted_at is null
        and content_type = 'video'
        and nullif(btrim(media_payload #>> '{video_url}'), '') is null
    )
  ) as value
  from public.media_assets
),
publishing_stats as (
  select jsonb_build_object(
    'recentPublishing', jsonb_build_object(
      'windowDays', 30,
      'topics', (
        select count(*)::integer from public.topics
        where deleted_at is null and status = 'published'
          and published_at >= now() - interval '30 days'
      ),
      'projects', (
        select count(*)::integer from public.projects
        where publication_status = 'published'
          and published_at >= now() - interval '30 days'
      )
    ),
    'pendingPublishing', jsonb_build_object(
      'topics', (select count(*)::integer from public.topics where deleted_at is null and status = 'unpublished'),
      'projects', (select count(*)::integer from public.projects where publication_status = 'unpublished')
    ),
    'drafts', jsonb_build_object(
      'topics', (select count(*)::integer from public.topics where deleted_at is null and status = 'draft'),
      'projects', (select count(*)::integer from public.projects where publication_status = 'draft'),
      'pages', (select count(*)::integer from public.pages where status = 'draft')
    )
  ) as value
),
required_indexes(index_name) as (
  values
    ('topics_dashboard_updated_idx'::text),
    ('projects_dashboard_updated_idx'::text),
    ('topics_reports_site_update_idx'::text),
    ('projects_reports_published_at_idx'::text),
    ('media_assets_reconciliation_idx'::text),
    ('media_assets_default_alt_idx'::text),
    ('media_references_reports_active_idx'::text),
    ('admin_audit_logs_created_at_idx'::text),
    ('admin_audit_logs_action_created_at_idx'::text),
    ('pages_status_idx'::text)
),
missing_indexes as (
  select coalesce(jsonb_agg(index_name order by index_name), '[]'::jsonb) as value
  from required_indexes required
  where not exists (
    select 1 from pg_catalog.pg_indexes actual
    where actual.schemaname = 'public'
      and actual.indexname = required.index_name
  )
),
rls_state as (
  select jsonb_object_agg(expected.table_name, coalesce(actual.relrowsecurity, false)) as value
  from (
    values
      ('topics'::text),
      ('projects'::text),
      ('pages'::text),
      ('media_assets'::text),
      ('media_references'::text),
      ('admin_audit_logs'::text),
      ('site_settings'::text),
      ('project_floor_plans'::text),
      ('project_media'::text),
      ('project_videos'::text)
  ) expected(table_name)
  left join pg_catalog.pg_class actual
    on actual.relname = expected.table_name
   and actual.relnamespace = 'public'::regnamespace
),
database_diagnostics as (
  select jsonb_build_object(
    'source', 'public.admin_reports_truth_v1()',
    'migrationVersion', '20260805230000',
    'migrationRegistered', exists (
      select 1 from supabase_migrations.schema_migrations
      where version = '20260805230000'
    ),
    'dashboardReadModelAvailable', to_regprocedure('public.admin_dashboard_truth_v1()') is not null,
    'rls', (select value from rls_state),
    'missingIndexes', (select value from missing_indexes),
    'rpcAclServiceOnly',
      has_function_privilege('service_role', 'public.admin_reports_truth_v1()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.admin_reports_truth_v1()', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.admin_reports_truth_v1()', 'EXECUTE'),
    'checkedAt', clock_timestamp()
  ) as value
)
select jsonb_build_object(
  'contractVersion', 'admin-reports-truth-v1',
  'checkedAt', clock_timestamp(),
  'content', (select value from content_stats),
  'projects', (select value from project_stats),
  'seo', (select value from seo_stats),
  'media', (select value from media_stats),
  'publishing', (select value from publishing_stats),
  'sourcesOfTruth', jsonb_build_array(
    'public.admin_dashboard_truth_v1()',
    'public.admin_reports_truth_v1()',
    'admin_audit_logs via Audit owner',
    'Global SEO health owner',
    'Media catalog diagnostics owner',
    'Analytics provider adapter registry'
  ),
  'databaseDiagnostics', (select value from database_diagnostics)
);
$function$;

revoke all on function public.admin_reports_truth_v1() from public;
revoke all on function public.admin_reports_truth_v1() from anon;
revoke all on function public.admin_reports_truth_v1() from authenticated;
grant execute on function public.admin_reports_truth_v1() to service_role;

comment on function public.admin_reports_truth_v1() is
  'Reports Truth v1: additional Content, Projects, SEO, Media, Publishing, and database-diagnostics aggregates. Dashboard, Audit, SEO, Media diagnostics, and Analytics keep their existing or dedicated owners.';
