-- System Publication + Summary Cards + Collection Presentation Closure.
-- Publication is binary across editorial entities. Assignment visibility stays
-- an independent technical concern and is deliberately not changed here.

begin;

update public.topics
set status = 'unpublished'
where status is distinct from 'published';

update public.projects
set publication_status = 'unpublished'
where publication_status is distinct from 'published';

update public.pages
set status = 'unpublished'
where status is distinct from 'published';

update public.topic_categories
set status = case when status = 'published' then 'published' else 'unpublished' end,
    is_active = (status = 'published');

update public.topic_series
set status = 'unpublished'
where status is distinct from 'published';

update public.content_block_templates set status = 'unpublished' where status is distinct from 'published';
update public.breadcrumb_block_templates set status = 'unpublished' where status is distinct from 'published';
update public.cards_block_templates set status = 'unpublished' where status is distinct from 'published';
update public.cta_block_templates set status = 'unpublished' where status is distinct from 'published';
update public.feed_module_templates set status = 'unpublished' where status is distinct from 'published';
update public.media_hub_module_templates set status = 'unpublished' where status is distinct from 'published';
update public.media_sidebar_module_templates set status = 'unpublished' where status is distinct from 'published';

alter table public.hero_templates add column if not exists status text;
update public.hero_templates
set status = case when is_visible then 'published' else 'unpublished' end
where status is null or status not in ('published', 'unpublished');

alter table public.topics alter column status set default 'unpublished';
alter table public.projects alter column publication_status set default 'unpublished';
alter table public.pages alter column status set default 'unpublished';
alter table public.topic_categories alter column status set default 'unpublished';
alter table public.topic_series alter column status set default 'unpublished';
alter table public.content_block_templates alter column status set default 'unpublished';
alter table public.breadcrumb_block_templates alter column status set default 'unpublished';
alter table public.cards_block_templates alter column status set default 'unpublished';
alter table public.cta_block_templates alter column status set default 'unpublished';
alter table public.feed_module_templates alter column status set default 'unpublished';
alter table public.media_hub_module_templates alter column status set default 'unpublished';
alter table public.media_sidebar_module_templates alter column status set default 'unpublished';
alter table public.hero_templates alter column status set default 'unpublished';
alter table public.topics alter column status set not null;
alter table public.projects alter column publication_status set not null;
alter table public.pages alter column status set not null;
alter table public.topic_categories alter column status set not null;
alter table public.topic_series alter column status set not null;
alter table public.content_block_templates alter column status set not null;
alter table public.breadcrumb_block_templates alter column status set not null;
alter table public.cards_block_templates alter column status set not null;
alter table public.cta_block_templates alter column status set not null;
alter table public.feed_module_templates alter column status set not null;
alter table public.media_hub_module_templates alter column status set not null;
alter table public.media_sidebar_module_templates alter column status set not null;
alter table public.hero_templates alter column status set not null;

alter table public.topics drop constraint if exists topics_status_check;
alter table public.topics add constraint topics_status_check check (status in ('published', 'unpublished'));
alter table public.projects drop constraint if exists projects_publication_status_check;
alter table public.projects add constraint projects_publication_status_check check (publication_status in ('published', 'unpublished'));
alter table public.pages drop constraint if exists pages_status_check;
alter table public.pages add constraint pages_status_check check (status in ('published', 'unpublished'));
alter table public.topic_categories drop constraint if exists topic_categories_status_check;
alter table public.topic_categories add constraint topic_categories_status_check check (status in ('published', 'unpublished'));
alter table public.topic_series drop constraint if exists topic_series_status_check;
alter table public.topic_series add constraint topic_series_status_check check (status in ('published', 'unpublished'));
alter table public.hero_templates drop constraint if exists hero_templates_status_check;
alter table public.hero_templates add constraint hero_templates_status_check check (status in ('published', 'unpublished'));

alter table public.content_block_templates drop constraint if exists content_block_templates_status_check;
alter table public.content_block_templates add constraint content_block_templates_status_check check (status in ('published', 'unpublished'));
alter table public.breadcrumb_block_templates drop constraint if exists breadcrumb_block_templates_status_check;
alter table public.breadcrumb_block_templates add constraint breadcrumb_block_templates_status_check check (status in ('published', 'unpublished'));
alter table public.cards_block_templates drop constraint if exists cards_block_templates_status_check;
alter table public.cards_block_templates add constraint cards_block_templates_status_check check (status in ('published', 'unpublished'));
alter table public.cta_block_templates drop constraint if exists cta_block_templates_status_check;
alter table public.cta_block_templates add constraint cta_block_templates_status_check check (status in ('published', 'unpublished'));
alter table public.feed_module_templates drop constraint if exists feed_module_templates_status_check;
alter table public.feed_module_templates add constraint feed_module_templates_status_check check (status in ('published', 'unpublished'));
alter table public.media_hub_module_templates drop constraint if exists media_hub_module_templates_status_check;
alter table public.media_hub_module_templates add constraint media_hub_module_templates_status_check check (status in ('published', 'unpublished'));
alter table public.media_sidebar_module_templates drop constraint if exists media_sidebar_module_templates_status_check;
alter table public.media_sidebar_module_templates add constraint media_sidebar_module_templates_status_check check (status in ('published', 'unpublished'));

create or replace function public.sync_topic_category_publication_compatibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.is_active is distinct from old.is_active then
    new.status := case when new.is_active then 'published' else 'unpublished' end;
  else
    new.is_active := new.status = 'published';
  end if;
  return new;
end;
$$;

drop trigger if exists topic_categories_publication_compatibility on public.topic_categories;
create trigger topic_categories_publication_compatibility
before insert or update of status, is_active on public.topic_categories
for each row execute function public.sync_topic_category_publication_compatibility();

create or replace function public.sync_hero_template_publication_compatibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.is_visible is distinct from old.is_visible then
    new.status := case when new.is_visible then 'published' else 'unpublished' end;
  else
    new.is_visible := new.status = 'published';
  end if;
  return new;
end;
$$;

drop trigger if exists hero_templates_publication_compatibility on public.hero_templates;
create trigger hero_templates_publication_compatibility
before insert or update of status, is_visible on public.hero_templates
for each row execute function public.sync_hero_template_publication_compatibility();

-- Guarded in-place rewrites preserve the established database owners while
-- removing legacy publication values and extending their real read metrics.
do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.admin_list_categories(integer,integer,text,text,text,text)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$p_status not in ('all', 'published', 'hidden')$old$, $new$p_status not in ('all', 'published', 'unpublished')$new$);
  v_next := replace(v_next, $old$or (p_status = 'published' and listed.is_active is true)$old$, $new$or (p_status = 'published' and listed.status = 'published')$new$);
  v_next := replace(v_next, $old$or (p_status = 'hidden' and listed.is_active is not true)$old$, $new$or (p_status = 'unpublished' and listed.status = 'unpublished')$new$);
  v_next := replace(v_next, $old$count(*) filter (where category_base.is_active is true)::bigint as published$old$, $new$count(*) filter (where category_base.status = 'published')::bigint as published$new$);
  v_next := replace(v_next, $old$case when p_sort_field = 'status' and p_sort_direction = 'asc' then coalesce(filtered.is_active, false) end asc$old$, $new$case when p_sort_field = 'status' and p_sort_direction = 'asc' then filtered.status end asc$new$);
  v_next := replace(v_next, $old$case when p_sort_field = 'status' and p_sort_direction = 'desc' then coalesce(filtered.is_active, false) end desc$old$, $new$case when p_sort_field = 'status' and p_sort_direction = 'desc' then filtered.status end desc$new$);
  v_next := replace(v_next, $old$'published', (select published from metrics),
        'topics', (select topics from metrics)$old$, $new$'published', (select published from metrics),
        'unpublished', (select total - published from metrics),
        'topics', (select topics from metrics),
        'series', (select count(*)::bigint from public.topic_series)$new$);
  if v_next = v_definition or position($needle$'unpublished', (select total - published from metrics)$needle$ in v_next) = 0 then
    raise exception 'admin_list_categories publication rewrite drifted';
  end if;
  execute v_next;
end;
$$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.admin_list_series(integer,integer,text,text,text,text,bigint)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$'all', 'published', 'unpublished', 'draft', 'archived'$old$, $new$'all', 'published', 'unpublished'$new$);
  v_next := replace(v_next, $old$'published', (select published from metrics),
        'topics', (select topics from metrics),$old$, $new$'published', (select published from metrics),
        'unpublished', (select total - published from metrics),
        'topics', (select topics from metrics),
        'averageTopics', (select case when total = 0 then 0 else round(topics::numeric / total, 1) end from metrics),$new$);
  if v_next = v_definition or position($needle$'averageTopics'$needle$ in v_next) = 0 then
    raise exception 'admin_list_series publication rewrite drifted';
  end if;
  execute v_next;
end;
$$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$status = case when p_is_active then 'published' else 'draft' end$old$, $new$status = case when p_is_active then 'published' else 'unpublished' end$new$);
  if v_next = v_definition then raise exception 'admin_update_topic_category publication rewrite drifted'; end if;
  execute v_next;
end;
$$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.transition_project_publication_admin_entry(bigint,text,bigint)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$p_target_status not in ('draft', 'published', 'unpublished')$old$, $new$p_target_status not in ('published', 'unpublished')$new$);
  v_next := replace(v_next, $old$when v_current.publication_status = 'draft' then 'draft'
    else 'unpublished'$old$, $new$else 'unpublished'$new$);
  if v_next = v_definition or position($needle$p_target_status not in ('published', 'unpublished')$needle$ in v_next) = 0 then
    raise exception 'transition_project_publication_admin_entry rewrite drifted';
  end if;
  execute v_next;
end;
$$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.admin_list_projects(integer,integer,text,text,text,text,text,text)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$p_publication_status not in ('all', 'draft', 'published', 'unpublished')$old$, $new$p_publication_status not in ('all', 'published', 'unpublished')$new$);
  if v_next = v_definition then raise exception 'admin_list_projects publication rewrite drifted'; end if;
  execute v_next;
end;
$$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.duplicate_project_admin_entry(bigint)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$publication_status = 'draft'$old$, $new$publication_status = 'unpublished'$new$);
  if v_next = v_definition then raise exception 'duplicate_project_admin_entry publication rewrite drifted'; end if;
  execute v_next;
end;
$$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$'"draft"'::jsonb$old$, $new$'"unpublished"'::jsonb$new$);
  v_next := replace(v_next, $old$'status', 'draft'$old$, $new$'status', 'unpublished'$new$);
  if v_next = v_definition or position($needle$'status', 'unpublished'$needle$ in v_next) = 0 then
    raise exception 'mutate_page_composition publication rewrite drifted';
  end if;
  execute v_next;
end;
$$;

create or replace function public.admin_dashboard_truth_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with
topic_stats as (
  select count(*)::integer total,
         count(*) filter (where status = 'published')::integer published,
         count(*) filter (where status = 'unpublished')::integer unpublished,
         count(*) filter (where is_featured)::integer featured
  from public.topics where deleted_at is null
),
category_stats as (
  select count(*)::integer total,
         count(*) filter (where status = 'published')::integer published,
         count(*) filter (where status = 'unpublished')::integer unpublished
  from public.topic_categories
),
project_stats as (
  select count(*)::integer total,
         count(*) filter (where publication_status = 'published')::integer published,
         count(*) filter (where publication_status = 'unpublished')::integer unpublished
  from public.projects
),
page_stats as (
  select count(*)::integer total,
         count(*) filter (where status = 'published')::integer published,
         count(*) filter (where status = 'unpublished')::integer unpublished
  from public.pages
),
media_stats as (
  select count(*) filter (where status <> 'deleted')::integer total,
         count(*) filter (where status = 'active' and reconciliation_state = 'synced' and missing_object = false)::integer active,
         count(*) filter (where status <> 'deleted' and (status <> 'active' or reconciliation_state <> 'synced' or missing_object))::integer issues
  from public.media_assets
),
content_health as (
  select jsonb_build_object(
    'topicsMissingImage', (select count(*)::integer from public.topics where deleted_at is null and nullif(btrim(image), '') is null),
    'topicsMissingSeoDescription', (select count(*)::integer from public.topics where deleted_at is null and nullif(btrim(seo_description), '') is null),
    'categoriesMissingImage', (select count(*)::integer from public.topic_categories where status = 'published' and nullif(btrim(image), '') is null),
    'staleUnpublished', (select count(*)::integer from public.topics where deleted_at is null and status = 'unpublished' and updated_at < now() - interval '30 days')
  ) value
),
recent_topics as (
  select coalesce(jsonb_agg(to_jsonb(topic_row) order by topic_row.updated_at desc, topic_row.id desc), '[]'::jsonb) value
  from (select id,title,content_type,slug,status,category,updated_at,published_at from public.topics where deleted_at is null order by updated_at desc,id desc limit 6) topic_row
),
recent_projects as (
  select coalesce(jsonb_agg(to_jsonb(project_row) order by project_row.updated_at desc, project_row.id desc), '[]'::jsonb) value
  from (select id,code,arabic_name,slug,publication_status,updated_at from public.projects order by updated_at desc,id desc limit 4) project_row
),
required_indexes(index_name) as (values ('topics_dashboard_updated_idx'::text),('projects_dashboard_updated_idx'::text),('topic_categories_dashboard_active_idx'::text),('pages_status_idx'::text),('media_assets_reconciliation_idx'::text),('admin_audit_logs_created_at_idx'::text)),
missing_indexes as (
  select coalesce(jsonb_agg(index_name order by index_name), '[]'::jsonb) value from required_indexes required
  where not exists (select 1 from pg_catalog.pg_indexes actual where actual.schemaname='public' and actual.indexname=required.index_name)
),
rls_state as (
  select jsonb_object_agg(expected.table_name,coalesce(actual.relrowsecurity,false)) value
  from (values ('topics'::text),('topic_categories'::text),('projects'::text),('pages'::text),('media_assets'::text),('admin_audit_logs'::text),('site_settings'::text)) expected(table_name)
  left join pg_catalog.pg_class actual on actual.relname=expected.table_name and actual.relnamespace='public'::regnamespace
),
database_diagnostics as (
  select jsonb_build_object(
    'source','public.admin_dashboard_truth_v1()','migrationVersion','20260807120000',
    'migrationRegistered',exists(select 1 from supabase_migrations.schema_migrations where version='20260807120000'),
    'rls',(select value from rls_state),'missingIndexes',(select value from missing_indexes),
    'rpcAclServiceOnly',has_function_privilege('service_role','public.admin_dashboard_truth_v1()','EXECUTE') and not has_function_privilege('anon','public.admin_dashboard_truth_v1()','EXECUTE') and not has_function_privilege('authenticated','public.admin_dashboard_truth_v1()','EXECUTE'),
    'checkedAt',clock_timestamp()) value
)
select jsonb_build_object(
  'contractVersion','dashboard-truth-v1','checkedAt',clock_timestamp(),
  'kpis',jsonb_build_object('topics',to_jsonb(topic_stats),'categories',to_jsonb(category_stats),'projects',to_jsonb(project_stats),'pages',to_jsonb(page_stats),'media',to_jsonb(media_stats)),
  'contentHealth',(select value from content_health),'recentTopics',(select value from recent_topics),'recentProjects',(select value from recent_projects),'databaseDiagnostics',(select value from database_diagnostics)
)
from topic_stats,category_stats,project_stats,page_stats,media_stats;
$function$;

do $$
declare v_definition text; v_next text;
begin
  select pg_get_functiondef('public.admin_reports_truth_v1()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_next := replace(v_definition, $old$        'draft', count(*) filter (where status = 'draft')::integer,
$old$, '');
  v_next := replace(v_next,
$old$    'pendingPublishing', jsonb_build_object(
      'topics', (select count(*)::integer from public.topics where deleted_at is null and status = 'unpublished'),
      'projects', (select count(*)::integer from public.projects where publication_status = 'unpublished')
    ),
    'drafts', jsonb_build_object(
      'topics', (select count(*)::integer from public.topics where deleted_at is null and status = 'draft'),
      'projects', (select count(*)::integer from public.projects where publication_status = 'draft'),
      'pages', (select count(*)::integer from public.pages where status = 'draft')
    )$old$,
$new$    'unpublished', jsonb_build_object(
      'topics', (select count(*)::integer from public.topics where deleted_at is null and status = 'unpublished'),
      'projects', (select count(*)::integer from public.projects where publication_status = 'unpublished'),
      'pages', (select count(*)::integer from public.pages where status = 'unpublished')
    )$new$);
  v_next := replace(v_next, $old$'migrationVersion', '20260805230000'$old$, $new$'migrationVersion', '20260807120000'$new$);
  v_next := replace(v_next, $old$where version = '20260805230000'$old$, $new$where version = '20260807120000'$new$);
  if v_next = v_definition or position($needle$'unpublished', jsonb_build_object($needle$ in v_next) = 0 then
    raise exception 'admin_reports_truth_v1 publication rewrite drifted';
  end if;
  execute v_next;
end;
$$;

revoke all on function public.sync_topic_category_publication_compatibility() from public, anon, authenticated;
revoke all on function public.sync_hero_template_publication_compatibility() from public, anon, authenticated;
revoke all on function public.admin_dashboard_truth_v1() from public, anon, authenticated;
grant execute on function public.admin_dashboard_truth_v1() to service_role;

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
