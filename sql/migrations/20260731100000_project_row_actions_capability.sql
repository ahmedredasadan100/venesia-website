-- Project Row Actions domain capability (additive, not remotely applied here).
--
-- Adds the authoritative Project featured flag and two service-role-only RPCs:
--   1. set_project_featured_admin_entry: idempotent desired-state write.
--   2. duplicate_project_admin_entry: one transaction-owned full aggregate copy.
--
-- The duplicate copies every Project child relation in the clean aggregate.
-- Identity-derived values receive new IDs/client keys/slug/timestamps; the new
-- Project starts unfeatured and without the source canonical URL so an Admin
-- must deliberately curate the duplicate before promoting it.
--
-- This migration MUST NOT be applied to Remote/Production without a separate
-- explicit authorization. Repository presence is not application proof.

begin;

do $project_row_actions_preflight$
declare
  v_table text;
  v_featured_type text;
  v_featured_nullable text;
  v_featured_default text;
begin
  foreach v_table in array array[
    'projects',
    'project_location_points',
    'project_features',
    'project_floor_plans',
    'project_floor_plan_details',
    'project_delivery_items',
    'project_media',
    'project_videos'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception using
        errcode = '42P01',
        message = format('Required Project aggregate table public.%I is missing.', v_table);
    end if;
  end loop;

  select columns.data_type, columns.is_nullable, columns.column_default
    into v_featured_type, v_featured_nullable, v_featured_default
    from information_schema.columns
   where columns.table_schema = 'public'
     and columns.table_name = 'projects'
     and columns.column_name = 'featured';

  if v_featured_type is not null and (
    v_featured_type <> 'boolean'
    or v_featured_nullable <> 'NO'
    or coalesce(v_featured_default, '') not in ('false', 'false::boolean')
  ) then
    raise exception using
      errcode = '42804',
      message = 'Existing public.projects.featured does not match boolean NOT NULL DEFAULT false.';
  end if;
end
$project_row_actions_preflight$;

-- Use an explicit backfill instead of PostgreSQL's constant-default fast path
-- so the final catalog does not retain an atthasmissing representation.
alter table public.projects
  add column if not exists featured boolean;

update public.projects
   set featured = false
 where featured is null;

alter table public.projects
  alter column featured set default false,
  alter column featured set not null;

create index if not exists projects_type_featured_updated_idx
  on public.projects (type, featured, updated_at desc, id desc);

create or replace function public.set_project_featured_admin_entry(
  p_project_id bigint,
  p_featured boolean
)
returns table (
  project_id bigint,
  project_type text,
  project_slug text,
  featured boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
begin
  if p_project_id is null or p_project_id <= 0 then
    raise exception using errcode = '22023', message = 'Project id is invalid.';
  end if;
  if p_featured is null then
    raise exception using errcode = '22023', message = 'Featured target state is required.';
  end if;

  return query
  update public.projects as project
     set featured = p_featured,
         updated_at = clock_timestamp()
   where project.id = p_project_id
  returning
    project.id,
    project.type,
    project.slug,
    project.featured,
    project.updated_at;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;
end
$function$;

create or replace function public.duplicate_project_admin_entry(
  p_project_id bigint
)
returns table (
  project_id bigint,
  project_type text,
  project_slug text,
  featured boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_source public.projects%rowtype;
  v_new_project_id bigint;
  v_new_plan_id bigint;
  v_slug_candidate text;
  v_copy_number integer := 1;
  v_now timestamptz := clock_timestamp();
  v_plan record;
begin
  if p_project_id is null or p_project_id <= 0 then
    raise exception using errcode = '22023', message = 'Project id is invalid.';
  end if;

  -- save_project_admin_entry updates and locks the root before touching
  -- children. Taking the same root lock yields one consistent aggregate and
  -- serializes duplicate slug allocation for the source Project.
  select project.*
    into v_source
    from public.projects as project
   where project.id = p_project_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  loop
    v_slug_candidate := v_source.slug || '-copy' ||
      case when v_copy_number = 1 then '' else '-' || v_copy_number::text end;

    begin
      insert into public.projects (
        type, arabic_name, english_name, slug,
        general_description, short_description,
        image, image_alt, hero_image, hero_image_alt,
        small_box_image, small_box_image_alt,
        governorate_id, city_id, main_area_id, sub_area_id,
        location_label, location_description, google_maps_url,
        latitude, longitude, map_zoom,
        overview_title, overview_body, overview_media_type,
        overview_main_image, overview_main_image_alt,
        delivery_title, delivery_body,
        seo_title, seo_description, focus_keyword, seo_keywords,
        canonical_url, robots_index, robots_follow, og_image, og_image_alt,
        featured, created_at, updated_at
      ) values (
        v_source.type,
        v_source.arabic_name || ' — نسخة' ||
          case when v_copy_number = 1 then '' else ' ' || v_copy_number::text end,
        v_source.english_name || ' Copy' ||
          case when v_copy_number = 1 then '' else ' ' || v_copy_number::text end,
        v_slug_candidate,
        v_source.general_description, v_source.short_description,
        v_source.image, v_source.image_alt,
        v_source.hero_image, v_source.hero_image_alt,
        v_source.small_box_image, v_source.small_box_image_alt,
        v_source.governorate_id, v_source.city_id,
        v_source.main_area_id, v_source.sub_area_id,
        v_source.location_label, v_source.location_description,
        v_source.google_maps_url,
        v_source.latitude, v_source.longitude, v_source.map_zoom,
        v_source.overview_title, v_source.overview_body,
        v_source.overview_media_type,
        v_source.overview_main_image, v_source.overview_main_image_alt,
        v_source.delivery_title, v_source.delivery_body,
        v_source.seo_title, v_source.seo_description,
        v_source.focus_keyword, v_source.seo_keywords,
        null, v_source.robots_index, v_source.robots_follow,
        v_source.og_image, v_source.og_image_alt,
        false, v_now, v_now
      )
      returning id into v_new_project_id;
      exit;
    exception
      when unique_violation then
        v_copy_number := v_copy_number + 1;
        if v_copy_number > 10000 then
          raise exception using
            errcode = '54000',
            message = 'Could not allocate a unique Project copy slug.';
        end if;
    end;
  end loop;

  insert into public.project_location_points (
    client_key, project_id, kind, label, distance_text,
    sort_order, created_at, updated_at
  )
  select
    pg_catalog.gen_random_uuid(), v_new_project_id,
    point.kind, point.label, point.distance_text,
    point.sort_order, v_now, v_now
  from public.project_location_points as point
  where point.project_id = p_project_id
  order by point.kind, point.sort_order, point.id;

  insert into public.project_features (
    client_key, project_id, body, sort_order, created_at, updated_at
  )
  select
    pg_catalog.gen_random_uuid(), v_new_project_id,
    feature.body, feature.sort_order, v_now, v_now
  from public.project_features as feature
  where feature.project_id = p_project_id
  order by feature.sort_order, feature.id;

  for v_plan in
    select plan.*
      from public.project_floor_plans as plan
     where plan.project_id = p_project_id
     order by plan.sort_order, plan.id
  loop
    insert into public.project_floor_plans (
      client_key, project_id, name, area_text, featured,
      architectural_image, architectural_image_alt,
      furnishing_image, furnishing_image_alt,
      sort_order, created_at, updated_at
    ) values (
      pg_catalog.gen_random_uuid(), v_new_project_id,
      v_plan.name, v_plan.area_text, v_plan.featured,
      v_plan.architectural_image, v_plan.architectural_image_alt,
      v_plan.furnishing_image, v_plan.furnishing_image_alt,
      v_plan.sort_order, v_now, v_now
    )
    returning id into v_new_plan_id;

    insert into public.project_floor_plan_details (
      client_key, floor_plan_id, label, value,
      sort_order, created_at, updated_at
    )
    select
      pg_catalog.gen_random_uuid(), v_new_plan_id,
      detail.label, detail.value,
      detail.sort_order, v_now, v_now
    from public.project_floor_plan_details as detail
    where detail.floor_plan_id = v_plan.id
    order by detail.sort_order, detail.id;
  end loop;

  insert into public.project_delivery_items (
    client_key, project_id, body, sort_order, created_at, updated_at
  )
  select
    pg_catalog.gen_random_uuid(), v_new_project_id,
    item.body, item.sort_order, v_now, v_now
  from public.project_delivery_items as item
  where item.project_id = p_project_id
  order by item.sort_order, item.id;

  insert into public.project_media (
    client_key, project_id, section, image, alt_text,
    sort_order, created_at, updated_at
  )
  select
    pg_catalog.gen_random_uuid(), v_new_project_id,
    media.section, media.image, media.alt_text,
    media.sort_order, v_now, v_now
  from public.project_media as media
  where media.project_id = p_project_id
  order by media.section, media.sort_order, media.id;

  insert into public.project_videos (
    client_key, project_id, section, video_url, poster_image, poster_alt,
    sort_order, created_at, updated_at
  )
  select
    pg_catalog.gen_random_uuid(), v_new_project_id,
    video.section, video.video_url, video.poster_image, video.poster_alt,
    video.sort_order, v_now, v_now
  from public.project_videos as video
  where video.project_id = p_project_id
  order by video.section, video.sort_order, video.id;

  return query
  select
    project.id,
    project.type,
    project.slug,
    project.featured,
    project.created_at,
    project.updated_at
  from public.projects as project
  where project.id = v_new_project_id;
end
$function$;

comment on function public.set_project_featured_admin_entry(bigint, boolean) is
  'Idempotently writes the authoritative Project featured state.';
comment on function public.duplicate_project_admin_entry(bigint) is
  'Atomically duplicates the complete clean Project aggregate.';

revoke all on function public.set_project_featured_admin_entry(bigint, boolean) from public;
revoke all on function public.set_project_featured_admin_entry(bigint, boolean) from anon;
revoke all on function public.set_project_featured_admin_entry(bigint, boolean) from authenticated;
grant execute on function public.set_project_featured_admin_entry(bigint, boolean) to service_role;

revoke all on function public.duplicate_project_admin_entry(bigint) from public;
revoke all on function public.duplicate_project_admin_entry(bigint) from anon;
revoke all on function public.duplicate_project_admin_entry(bigint) from authenticated;
grant execute on function public.duplicate_project_admin_entry(bigint) to service_role;

commit;
