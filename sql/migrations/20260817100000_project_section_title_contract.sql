begin;

-- Additive Project Aggregate fields. Existing rows are backfilled to preserve
-- the current public headings; new rows intentionally receive NULL by default.
alter table public.projects
  add column if not exists location_title text,
  add column if not exists plans_title text,
  add column if not exists gallery_title text;

update public.projects
set location_title = coalesce(location_title, 'عن الموقع'),
    plans_title = coalesce(plans_title, 'المساحات والمخططات'),
    gallery_title = coalesce(gallery_title, 'معرض المشروع');

alter table public.projects
  drop constraint if exists projects_overview_title_check,
  drop constraint if exists projects_delivery_title_check,
  alter column overview_title drop not null,
  alter column delivery_title drop not null,
  alter column overview_title drop default,
  alter column delivery_title drop default,
  alter column location_title drop default,
  alter column plans_title drop default,
  alter column gallery_title drop default;

-- Section headings are presentation metadata, not publication blockers.
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

-- Keep the existing atomic Project writer as the sole mutation owner. This
-- compatibility wrapper removes the legacy required-title assertions inside
-- the private core and writes the nullable title contract in the same tx.
alter function public.save_project_admin_entry(bigint, jsonb)
  rename to save_project_admin_entry_before_section_titles;

create or replace function public.save_project_admin_entry(
  p_project_id bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns table (project_id bigint, slug text, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_saved record;
  v_root jsonb := coalesce(p_payload->'project', '{}'::jsonb);
  v_forward_payload jsonb;
  v_forward_root jsonb;
  v_optional_title_sentinel constant text := '__optional_project_section_title__';
begin
  v_forward_root := v_root || jsonb_build_object(
    'overview_title', coalesce(nullif(btrim(v_root->>'overview_title'), ''), v_optional_title_sentinel),
    'delivery_title', coalesce(nullif(btrim(v_root->>'delivery_title'), ''), v_optional_title_sentinel)
  );
  v_forward_payload := jsonb_set(coalesce(p_payload, '{}'::jsonb), '{project}', v_forward_root, true);

  select * into strict v_saved
  from public.save_project_admin_entry_before_section_titles(p_project_id, v_forward_payload);

  update public.projects project set
    location_title = nullif(btrim(v_root->>'location_title'), ''),
    overview_title = nullif(btrim(v_root->>'overview_title'), ''),
    plans_title = nullif(btrim(v_root->>'plans_title'), ''),
    delivery_title = nullif(btrim(v_root->>'delivery_title'), ''),
    gallery_title = nullif(btrim(v_root->>'gallery_title'), ''),
    updated_at = v_saved.updated_at
  where project.id = v_saved.project_id;

  return query select v_saved.project_id, v_saved.slug, v_saved.updated_at;
end
$function$;

alter function public.duplicate_project_admin_entry(bigint)
  rename to duplicate_project_admin_entry_before_section_titles;

create or replace function public.duplicate_project_admin_entry(p_project_id bigint)
returns table (
  project_id bigint, project_type text, project_slug text, featured boolean,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_copy record;
  v_source record;
begin
  select location_title, plans_title, gallery_title
    into v_source
    from public.projects
   where id = p_project_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  select * into strict v_copy
  from public.duplicate_project_admin_entry_before_section_titles(p_project_id);

  update public.projects set
    location_title = v_source.location_title,
    plans_title = v_source.plans_title,
    gallery_title = v_source.gallery_title
  where id = v_copy.project_id;

  return query select
    v_copy.project_id,
    v_copy.project_type,
    v_copy.project_slug,
    v_copy.featured,
    v_copy.created_at,
    v_copy.updated_at;
end
$function$;

revoke all on function public.save_project_admin_entry_before_section_titles(bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.duplicate_project_admin_entry_before_section_titles(bigint) from public, anon, authenticated, service_role;
revoke all on function public.save_project_admin_entry(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.duplicate_project_admin_entry(bigint) from public, anon, authenticated;
grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role;
grant execute on function public.duplicate_project_admin_entry(bigint) to service_role;

comment on column public.projects.location_title is 'Optional public Location section heading. NULL/blank renders no heading.';
comment on column public.projects.overview_title is 'Optional public Overview section heading. NULL/blank renders no heading.';
comment on column public.projects.plans_title is 'Optional public Plans/Areas section heading. NULL/blank renders no heading.';
comment on column public.projects.delivery_title is 'Optional public Delivery section heading. NULL/blank renders no heading.';
comment on column public.projects.gallery_title is 'Optional public Gallery section heading. NULL/blank renders no heading.';
comment on function public.save_project_admin_entry(bigint, jsonb) is
  'Single atomic Project aggregate writer with explicit nullable public section headings.';

commit;

-- Rollback policy: prefer a forward fix. Dropping location_title/plans_title/
-- gallery_title loses authored data; restoring NOT NULL title constraints also
-- requires an explicit backfill for rows whose overview/delivery title is NULL.
