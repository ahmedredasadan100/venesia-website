-- Project Publishing / Visibility Capability.
-- Additive Project-domain adoption only: no Runtime, auth, or table rebuild.
-- Existing rows are explicitly backfilled to published so deployment preserves
-- the pre-capability public behavior. The aggregate save signature is retained
-- for rolling compatibility and is extended by an audited definition rewrite.
-- Apply these exact committed bytes, then register only version 20260803120000;
-- unrelated historical registry provenance remains a separate reconciliation.

begin;

set local search_path = pg_catalog, pg_temp;

do $project_publishing_preflight$
declare
  v_save_oid oid := pg_catalog.to_regprocedure(
    'public.save_project_admin_entry(bigint,jsonb)'
  );
  v_save_hash text;
  v_new_column_count integer;
  v_admin_id_type text;
  v_admin_id_not_null boolean;
begin
  if pg_catalog.to_regclass('public.projects') is null then
    raise exception using errcode = '42P01', message = 'Required table public.projects is missing.';
  end if;
  if pg_catalog.to_regclass('public.admin_users') is null then
    raise exception using errcode = '42P01', message = 'Required table public.admin_users is missing.';
  end if;

  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod), attribute.attnotnull
    into v_admin_id_type, v_admin_id_not_null
    from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.admin_users'::pg_catalog.regclass
     and attribute.attname = 'id'
     and attribute.attnum > 0
     and not attribute.attisdropped;

  if v_admin_id_type is distinct from 'bigint' or not coalesce(v_admin_id_not_null, false) then
    raise exception using
      errcode = '42804',
      message = 'public.admin_users.id must be a NOT NULL bigint before Project publishing adoption.';
  end if;

  select pg_catalog.count(*)::integer
    into v_new_column_count
    from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.projects'::pg_catalog.regclass
     and attribute.attname in ('publication_status', 'published_at', 'published_by')
     and attribute.attnum > 0
     and not attribute.attisdropped;

  if v_new_column_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Project publication columns already exist or are partially applied; refusing migration replay/drift.';
  end if;

  if v_save_oid is null
     or pg_catalog.to_regprocedure('public.duplicate_project_admin_entry(bigint)') is null
     or pg_catalog.to_regprocedure('public.set_project_featured_admin_entry(bigint,boolean)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'The expected Project aggregate save and row-action RPC signatures are required.';
  end if;

  if pg_catalog.to_regprocedure('public.set_project_publication_admin_entry(bigint,boolean,bigint)') is not null
     or pg_catalog.to_regprocedure('public.admin_list_projects(integer,integer,text,text,text,text,text,text)') is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Project publishing RPCs already exist outside this migration; refusing unexpected drift.';
  end if;

  select pg_catalog.md5(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.replace(
          pg_catalog.replace(procedure_record.prosrc, pg_catalog.chr(13) || pg_catalog.chr(10), pg_catalog.chr(10)),
          pg_catalog.chr(13),
          pg_catalog.chr(10)
        ),
        E'[ \t]+\n',
        E'\n',
        'g'
      )
    )
  )
    into v_save_hash
    from pg_catalog.pg_proc procedure_record
   where procedure_record.oid = v_save_oid
     and procedure_record.prokind = 'f'
     and procedure_record.prosecdef
     and procedure_record.provolatile = 'v'
     and procedure_record.proowner = 'postgres'::pg_catalog.regrole
     and 'search_path=pg_catalog, pg_temp' = any(coalesce(procedure_record.proconfig, '{}'::text[]));

  if v_save_hash is distinct from 'bc79445ae958779ed889651cd980c236' then
    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'save_project_admin_entry semantic body hash %s is outside the audited baseline.',
        coalesce(v_save_hash, '<missing>')
      );
  end if;
end
$project_publishing_preflight$;

-- Explicit backfill avoids the constant-default atthasmissing shortcut.
alter table public.projects
  add column publication_status text,
  add column published_at timestamptz,
  add column published_by bigint;

update public.projects
   set publication_status = 'published',
       published_at = coalesce(published_at, created_at, updated_at, pg_catalog.clock_timestamp()),
       published_by = null;

alter table public.projects
  alter column publication_status set default 'draft'::text,
  alter column publication_status set not null,
  add constraint projects_publication_status_check
    check (publication_status in ('draft', 'published', 'unpublished')),
  add constraint projects_published_by_fkey
    foreign key (published_by)
    references public.admin_users(id)
    on delete set null;

create index projects_published_type_updated_idx
  on public.projects (type, updated_at desc, id desc)
  where publication_status = 'published';

create index projects_published_featured_type_updated_idx
  on public.projects (type, updated_at desc, id desc)
  where publication_status = 'published' and featured = true;

create index projects_admin_publication_updated_idx
  on public.projects (type, publication_status, updated_at desc, id desc);

create index projects_published_by_idx
  on public.projects (published_by)
  where published_by is not null;

create or replace function public.project_publishing_readiness(
  p_project_id bigint
)
returns table (ready boolean, blocker_code text)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select
    not (
      coalesce(pg_catalog.btrim(project.arabic_name), '') = ''
      or coalesce(pg_catalog.btrim(project.english_name), '') = ''
      or coalesce(pg_catalog.btrim(project.slug), '') = ''
      or coalesce(pg_catalog.btrim(project.general_description), '') = ''
      or coalesce(pg_catalog.btrim(project.short_description), '') = ''
      or coalesce(pg_catalog.btrim(project.image), '') = ''
      or coalesce(pg_catalog.btrim(project.image_alt), '') = ''
      or coalesce(pg_catalog.btrim(project.hero_image), '') = ''
      or coalesce(pg_catalog.btrim(project.hero_image_alt), '') = ''
      or coalesce(pg_catalog.btrim(project.small_box_image), '') = ''
      or coalesce(pg_catalog.btrim(project.small_box_image_alt), '') = ''
      or project.governorate_id is null
      or project.city_id is null
      or project.main_area_id is null
      or coalesce(pg_catalog.btrim(project.location_label), '') = ''
      or coalesce(pg_catalog.btrim(project.google_maps_url), '') = ''
      or project.latitude is null
      or project.longitude is null
      or project.map_zoom is null
      or coalesce(pg_catalog.btrim(project.overview_title), '') = ''
      or coalesce(pg_catalog.btrim(pg_catalog.regexp_replace(
        pg_catalog.replace(coalesce(project.overview_body, ''), '&nbsp;', ' '),
        '<[^>]*>', '', 'g'
      )), '') = ''
      or (
        project.overview_media_type = 'image'
        and (
          coalesce(pg_catalog.btrim(project.overview_main_image), '') = ''
          or coalesce(pg_catalog.btrim(project.overview_main_image_alt), '') = ''
        )
      )
      or (
        project.overview_media_type = 'video'
        and 1 <> (
          select pg_catalog.count(*)
            from public.project_videos video
           where video.project_id = project.id
             and video.section = 'overview'
        )
      )
      or coalesce(pg_catalog.btrim(project.delivery_title), '') = ''
      or coalesce(pg_catalog.btrim(pg_catalog.regexp_replace(
        pg_catalog.replace(coalesce(project.delivery_body, ''), '&nbsp;', ' '),
        '<[^>]*>', '', 'g'
      )), '') = ''
      or exists (
        select 1 from public.project_location_points item
         where item.project_id = project.id and coalesce(pg_catalog.btrim(item.label), '') = ''
      )
      or exists (
        select 1 from public.project_features item
         where item.project_id = project.id and coalesce(pg_catalog.btrim(item.body), '') = ''
      )
      or exists (
        select 1 from public.project_floor_plans item
         where item.project_id = project.id
           and (
             coalesce(pg_catalog.btrim(item.name), '') = ''
             or (item.architectural_image is not null and coalesce(pg_catalog.btrim(item.architectural_image_alt), '') = '')
             or (item.furnishing_image is not null and coalesce(pg_catalog.btrim(item.furnishing_image_alt), '') = '')
           )
      )
      or exists (
        select 1
          from public.project_floor_plan_details detail
          join public.project_floor_plans plan on plan.id = detail.floor_plan_id
         where plan.project_id = project.id
           and (
             coalesce(pg_catalog.btrim(detail.label), '') = ''
             or coalesce(pg_catalog.btrim(detail.value), '') = ''
           )
      )
      or exists (
        select 1 from public.project_delivery_items item
         where item.project_id = project.id and coalesce(pg_catalog.btrim(item.body), '') = ''
      )
      or exists (
        select 1 from public.project_media item
         where item.project_id = project.id
           and (
             coalesce(pg_catalog.btrim(item.image), '') = ''
             or coalesce(pg_catalog.btrim(item.alt_text), '') = ''
           )
      )
      or exists (
        select 1 from public.project_videos item
         where item.project_id = project.id
           and (
             coalesce(pg_catalog.btrim(item.video_url), '') !~* '^https?://'
             or (item.poster_image is not null and coalesce(pg_catalog.btrim(item.poster_alt), '') = '')
           )
      )
    ) as ready,
    case
      when project.id is null then 'PROJECT_PUBLISH_AGGREGATE_UNAVAILABLE'
      when (
        coalesce(pg_catalog.btrim(project.arabic_name), '') = ''
        or coalesce(pg_catalog.btrim(project.english_name), '') = ''
        or coalesce(pg_catalog.btrim(project.slug), '') = ''
        or coalesce(pg_catalog.btrim(project.general_description), '') = ''
        or coalesce(pg_catalog.btrim(project.short_description), '') = ''
        or coalesce(pg_catalog.btrim(project.image), '') = ''
        or coalesce(pg_catalog.btrim(project.image_alt), '') = ''
        or coalesce(pg_catalog.btrim(project.hero_image), '') = ''
        or coalesce(pg_catalog.btrim(project.hero_image_alt), '') = ''
        or coalesce(pg_catalog.btrim(project.small_box_image), '') = ''
        or coalesce(pg_catalog.btrim(project.small_box_image_alt), '') = ''
      ) then 'PROJECT_PUBLISH_FIELD_INVALID'
      else null
    end as blocker_code
  from public.projects project
  where project.id = p_project_id;
$function$;

create or replace function public.transition_project_publication_admin_entry(
  p_project_id bigint,
  p_target_status text,
  p_actor_id bigint
)
returns table (
  project_id bigint,
  publication_status text,
  published_at timestamptz,
  published_by bigint,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_current public.projects%rowtype;
  v_ready boolean;
  v_blocker_code text;
  v_next_status text;
begin
  if p_project_id is null or p_project_id <= 0 then
    raise exception using errcode = '22023', message = 'Project id is invalid.';
  end if;
  if p_target_status not in ('draft', 'published', 'unpublished') then
    raise exception using errcode = '22023', message = 'Project publication target is invalid.';
  end if;

  select project.* into v_current
    from public.projects project
   where project.id = p_project_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  v_next_status := case
    when p_target_status = 'published' then 'published'
    when v_current.publication_status = 'draft' then 'draft'
    else 'unpublished'
  end;

  if v_next_status = 'published' and v_current.publication_status <> 'published' then
    if p_actor_id is null or not exists (
      select 1 from public.admin_users admin_user where admin_user.id = p_actor_id
    ) then
      raise exception using errcode = '22023', message = 'PROJECT_PUBLICATION_ACTOR_REQUIRED';
    end if;

    select readiness.ready, readiness.blocker_code
      into v_ready, v_blocker_code
      from public.project_publishing_readiness(p_project_id) readiness;
    if not coalesce(v_ready, false) then
      raise exception using
        errcode = '23514',
        message = 'PROJECT_PUBLISH_BLOCKED',
        detail = coalesce(v_blocker_code, 'PROJECT_PUBLISH_FIELD_INVALID');
    end if;
  end if;

  if v_next_status <> v_current.publication_status then
    update public.projects project
       set publication_status = v_next_status,
           published_at = case
             when v_next_status = 'published' then coalesce(project.published_at, pg_catalog.clock_timestamp())
             else project.published_at
           end,
           published_by = case
             when v_next_status = 'published' then p_actor_id
             else project.published_by
           end,
           updated_at = pg_catalog.clock_timestamp()
     where project.id = p_project_id;
  end if;

  return query
  select project.id, project.publication_status, project.published_at,
         project.published_by, project.updated_at
    from public.projects project
   where project.id = p_project_id;
end
$function$;

-- Extend the existing save owner in place. Every marker must occur once; any
-- unknown function drift aborts the whole migration before the rewrite commits.
do $project_aggregate_save_publication_adoption$
declare
  v_function_oid oid := pg_catalog.to_regprocedure(
    'public.save_project_admin_entry(bigint,jsonb)'
  );
  v_definition text;
  v_rewritten text;
  v_acl_before aclitem[];
  v_owner_before oid;
  v_identity_before text;
  v_arguments_before text;
  v_result_before text;
  v_old text;
  v_new text;
  v_count integer;
begin
  select pg_catalog.pg_get_functiondef(procedure_record.oid),
         procedure_record.proacl,
         procedure_record.proowner,
         pg_catalog.pg_get_function_identity_arguments(procedure_record.oid),
         pg_catalog.pg_get_function_arguments(procedure_record.oid),
         pg_catalog.pg_get_function_result(procedure_record.oid)
    into v_definition, v_acl_before, v_owner_before,
         v_identity_before, v_arguments_before, v_result_before
    from pg_catalog.pg_proc procedure_record
   where procedure_record.oid = v_function_oid;
  if v_definition is null then
    raise exception using errcode = 'P0001', message = 'save_project_admin_entry disappeared during migration.';
  end if;

  v_rewritten := pg_catalog.replace(
    pg_catalog.replace(
      v_definition,
      pg_catalog.chr(13) || pg_catalog.chr(10),
      pg_catalog.chr(10)
    ),
    pg_catalog.chr(13),
    pg_catalog.chr(10)
  );

  v_old := E'      canonical_url, robots_index, robots_follow, og_image, og_image_alt,\n      created_at, updated_at';
  v_new := E'      canonical_url, robots_index, robots_follow, og_image, og_image_alt,\n      featured, created_at, updated_at';
  v_count := (pg_catalog.length(v_rewritten) - pg_catalog.length(pg_catalog.replace(v_rewritten, v_old, ''))) / pg_catalog.length(v_old);
  if v_count <> 1 then raise exception 'Project save create-column marker count is %, expected 1.', v_count; end if;
  v_rewritten := pg_catalog.replace(v_rewritten, v_old, v_new);

  v_old := E'      nullif(v_root ->> ''og_image'', ''''), coalesce(v_root ->> ''og_image_alt'', ''''),\n      v_now, v_now';
  v_new := E'      nullif(v_root ->> ''og_image'', ''''), coalesce(v_root ->> ''og_image_alt'', ''''),\n      coalesce(nullif(v_root ->> ''featured'', '''')::boolean, false),\n      v_now, v_now';
  v_count := (pg_catalog.length(v_rewritten) - pg_catalog.length(pg_catalog.replace(v_rewritten, v_old, ''))) / pg_catalog.length(v_old);
  if v_count <> 1 then raise exception 'Project save create-value marker count is %, expected 1.', v_count; end if;
  v_rewritten := pg_catalog.replace(v_rewritten, v_old, v_new);

  v_old := E'      og_image_alt = case when v_root ? ''og_image_alt'' then coalesce(v_root ->> ''og_image_alt'', '''') else project.og_image_alt end,\n      updated_at = v_now';
  v_new := E'      og_image_alt = case when v_root ? ''og_image_alt'' then coalesce(v_root ->> ''og_image_alt'', '''') else project.og_image_alt end,\n      featured = case when v_root ? ''featured'' then coalesce(nullif(v_root ->> ''featured'', '''')::boolean, false) else project.featured end,\n      updated_at = v_now';
  v_count := (pg_catalog.length(v_rewritten) - pg_catalog.length(pg_catalog.replace(v_rewritten, v_old, ''))) / pg_catalog.length(v_old);
  if v_count <> 1 then raise exception 'Project save featured-update marker count is %, expected 1.', v_count; end if;
  v_rewritten := pg_catalog.replace(v_rewritten, v_old, v_new);

  v_old := E'    if v_root ->> ''type'' <> v_existing_type then\n      raise exception using errcode = ''23514'', message = ''Project type is immutable after creation.'';\n    end if;';
  v_new := v_old || E'\n    if p_payload ? ''publication_previous_status'' and (\n      select project.publication_status from public.projects project where project.id = p_project_id\n    ) <> coalesce(p_payload ->> ''publication_previous_status'', '''') then\n      raise exception using errcode = ''40001'', message = ''PROJECT_PUBLICATION_STATE_CONFLICT'';\n    end if;';
  v_count := (pg_catalog.length(v_rewritten) - pg_catalog.length(pg_catalog.replace(v_rewritten, v_old, ''))) / pg_catalog.length(v_old);
  if v_count <> 1 then raise exception 'Project save stale-state marker count is %, expected 1.', v_count; end if;
  v_rewritten := pg_catalog.replace(v_rewritten, v_old, v_new);

  v_old := E'  immediate;\n\n  return query';
  v_new := E'  immediate;\n\n  if v_root ? ''publication_status'' then\n    perform * from public.transition_project_publication_admin_entry(\n      v_project_id,\n      v_root ->> ''publication_status'',\n      nullif(p_payload ->> ''publication_actor_id'', '''')::bigint\n    );\n  end if;\n\n  return query';
  v_count := (pg_catalog.length(v_rewritten) - pg_catalog.length(pg_catalog.replace(v_rewritten, v_old, ''))) / pg_catalog.length(v_old);
  if v_count <> 1 then raise exception 'Project save transition marker count is %, expected 1.', v_count; end if;
  v_rewritten := pg_catalog.replace(v_rewritten, v_old, v_new);

  execute v_rewritten;

  if not exists (
    select 1 from pg_catalog.pg_proc procedure_record
     where procedure_record.oid = pg_catalog.to_regprocedure('public.save_project_admin_entry(bigint,jsonb)')
       and procedure_record.proowner = v_owner_before
       and procedure_record.proacl is not distinct from v_acl_before
       and pg_catalog.pg_get_function_identity_arguments(procedure_record.oid) = v_identity_before
       and pg_catalog.pg_get_function_arguments(procedure_record.oid) = v_arguments_before
       and pg_catalog.pg_get_function_result(procedure_record.oid) = v_result_before
       and procedure_record.prosecdef
       and procedure_record.provolatile = 'v'
       and 'search_path=pg_catalog, pg_temp' = any(coalesce(procedure_record.proconfig, '{}'::text[]))
       and pg_catalog.strpos(procedure_record.prosrc, 'transition_project_publication_admin_entry') > 0
       and pg_catalog.strpos(procedure_record.prosrc, 'PROJECT_PUBLICATION_STATE_CONFLICT') > 0
  ) then
    raise exception using errcode = 'P0001', message = 'Project aggregate save ownership/signature/ACL changed unexpectedly.';
  end if;
end
$project_aggregate_save_publication_adoption$;

create or replace function public.set_project_publication_admin_entry(
  p_project_id bigint,
  p_visible boolean,
  p_actor_id bigint
)
returns table (
  project_id bigint,
  project_type text,
  project_slug text,
  publication_status text,
  published_at timestamptz,
  published_by bigint,
  featured boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
begin
  if p_visible is null then
    raise exception using errcode = '22023', message = 'Project visibility target is required.';
  end if;

  perform * from public.transition_project_publication_admin_entry(
    p_project_id,
    case when p_visible then 'published' else 'unpublished' end,
    p_actor_id
  );

  return query
  select project.id, project.type, project.slug, project.publication_status,
         project.published_at, project.published_by, project.featured,
         project.updated_at
    from public.projects project
   where project.id = p_project_id;
end
$function$;

create or replace function public.admin_list_projects(
  p_page integer,
  p_page_size integer,
  p_sort_field text,
  p_sort_direction text,
  p_project_type text,
  p_search text default '',
  p_publication_status text default 'all',
  p_featured text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_total bigint;
  v_rows jsonb;
  v_search_pattern text;
begin
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Project list pagination is invalid.';
  end if;
  if p_sort_field not in ('arabic_name', 'english_name', 'slug', 'location_label', 'publication_status', 'published_at', 'updated_at')
     or p_sort_direction not in ('asc', 'desc') then
    raise exception using errcode = '22023', message = 'Project list sort is invalid.';
  end if;
  if p_project_type not in ('residential', 'commercial')
     or p_publication_status not in ('all', 'draft', 'published', 'unpublished')
     or p_featured not in ('all', 'yes', 'no') then
    raise exception using errcode = '22023', message = 'Project list filter is invalid.';
  end if;

  v_search_pattern := '%' || pg_catalog.replace(
    pg_catalog.replace(pg_catalog.replace(coalesce(pg_catalog.btrim(p_search), ''), E'\\', E'\\\\'), '%', E'\\%'),
    '_', E'\\_'
  ) || '%';

  select pg_catalog.count(*) into v_total
    from public.projects project
   where project.type = p_project_type
     and (p_publication_status = 'all' or project.publication_status = p_publication_status)
     and (p_featured = 'all' or project.featured = (p_featured = 'yes'))
     and (
       coalesce(pg_catalog.btrim(p_search), '') = ''
       or project.arabic_name ilike v_search_pattern escape E'\\'
       or project.english_name ilike v_search_pattern escape E'\\'
       or project.slug ilike v_search_pattern escape E'\\'
       or project.location_label ilike v_search_pattern escape E'\\'
     );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row_data)), '[]'::jsonb)
    into v_rows
    from (
      select project.id, project.type, project.slug,
             project.arabic_name, project.english_name, project.location_label,
             coalesce(city.name_ar, '') as city_name,
             coalesce(main_area.name_ar, '') as main_area_name,
             coalesce(sub_area.name_ar, '') as sub_area_name,
             project.featured, project.publication_status,
             project.published_at, project.updated_at
        from public.projects project
        left join public.project_locations city on city.id = project.city_id
        left join public.project_locations main_area on main_area.id = project.main_area_id
        left join public.project_locations sub_area on sub_area.id = project.sub_area_id
       where project.type = p_project_type
         and (p_publication_status = 'all' or project.publication_status = p_publication_status)
         and (p_featured = 'all' or project.featured = (p_featured = 'yes'))
         and (
           coalesce(pg_catalog.btrim(p_search), '') = ''
           or project.arabic_name ilike v_search_pattern escape E'\\'
           or project.english_name ilike v_search_pattern escape E'\\'
           or project.slug ilike v_search_pattern escape E'\\'
           or project.location_label ilike v_search_pattern escape E'\\'
         )
       order by
         case when p_sort_direction = 'asc' and p_sort_field = 'arabic_name' then project.arabic_name end asc,
         case when p_sort_direction = 'desc' and p_sort_field = 'arabic_name' then project.arabic_name end desc,
         case when p_sort_direction = 'asc' and p_sort_field = 'english_name' then project.english_name end asc,
         case when p_sort_direction = 'desc' and p_sort_field = 'english_name' then project.english_name end desc,
         case when p_sort_direction = 'asc' and p_sort_field = 'slug' then project.slug end asc,
         case when p_sort_direction = 'desc' and p_sort_field = 'slug' then project.slug end desc,
         case when p_sort_direction = 'asc' and p_sort_field = 'location_label' then project.location_label end asc,
         case when p_sort_direction = 'desc' and p_sort_field = 'location_label' then project.location_label end desc,
         case when p_sort_direction = 'asc' and p_sort_field = 'publication_status' then project.publication_status end asc,
         case when p_sort_direction = 'desc' and p_sort_field = 'publication_status' then project.publication_status end desc,
         case when p_sort_direction = 'asc' and p_sort_field = 'published_at' then project.published_at end asc nulls last,
         case when p_sort_direction = 'desc' and p_sort_field = 'published_at' then project.published_at end desc nulls last,
         case when p_sort_direction = 'asc' and p_sort_field = 'updated_at' then project.updated_at end asc,
         case when p_sort_direction = 'desc' and p_sort_field = 'updated_at' then project.updated_at end desc,
         project.id desc
       limit p_page_size
       offset (p_page - 1) * p_page_size
    ) row_data;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total,
    'page', p_page,
    'metrics', pg_catalog.jsonb_build_object('total', v_total)
  );
end
$function$;

comment on function public.project_publishing_readiness(bigint) is
  'Internal defensive readiness assertion for the Project publication capability.';
comment on function public.transition_project_publication_admin_entry(bigint, text, bigint) is
  'Internal owner of Project publication transition and first-publish semantics.';
comment on function public.set_project_publication_admin_entry(bigint, boolean, bigint) is
  'Service-role Project visibility quick command using the shared transition owner.';
comment on function public.admin_list_projects(integer, integer, text, text, text, text, text, text) is
  'Service-role Project Admin list read model with publication filtering.';

revoke all on function public.project_publishing_readiness(bigint) from public, anon, authenticated, service_role;
revoke all on function public.transition_project_publication_admin_entry(bigint, text, bigint) from public, anon, authenticated, service_role;

revoke all on function public.set_project_publication_admin_entry(bigint, boolean, bigint) from public, anon, authenticated, service_role;
grant execute on function public.set_project_publication_admin_entry(bigint, boolean, bigint) to service_role;

revoke all on function public.admin_list_projects(integer, integer, text, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_projects(integer, integer, text, text, text, text, text, text) to service_role;

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
