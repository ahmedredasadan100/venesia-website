begin;

-- Product correction: the two existing Boolean values are authored per
-- Project, but they belong only to the Project Location Section presentation.
-- Location data remains in the Project payload; Hero, Featured, Listing,
-- Home, Search, Tracking, JSON-LD, and every other Consumer ignore them.
do $project_location_section_presentation_preflight$
begin
  if to_regclass('public.projects') is null then
    raise exception 'Project Location Section presentation requires public.projects.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = 'public.projects'::regclass
      and attribute.attname = 'show_location_label'
      and not attribute.attisdropped
  ) or not exists (
    select 1
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = 'public.projects'::regclass
      and attribute.attname = 'show_location_tags'
      and not attribute.attisdropped
  ) then
    raise exception 'Project Location Section presentation requires the existing compatibility columns.';
  end if;

  if to_regprocedure('public.save_project_admin_entry(bigint,jsonb)') is null
     or to_regprocedure('public.save_project_admin_entry_before_section_titles(bigint,jsonb)') is null
     or to_regprocedure('public.duplicate_project_admin_entry(bigint)') is null
     or to_regprocedure('public.duplicate_project_admin_entry_before_section_titles(bigint)') is null then
    raise exception 'Project Location Section presentation requires the canonical Project writer chain.';
  end if;
end
$project_location_section_presentation_preflight$;

-- The canonical aggregate writer remains atomic. Presentation is a sibling
-- payload boundary rather than Project data, while the existing columns keep
-- per-Project persistence without introducing another table or config source.
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
  v_location_section_presentation jsonb :=
    coalesce(p_payload->'location_section_presentation', '{}'::jsonb);
  v_forward_payload jsonb;
  v_forward_root jsonb;
  v_optional_title_sentinel constant text := '__optional_project_section_title__';
begin
  v_forward_root := v_root || jsonb_build_object(
    'overview_title', coalesce(nullif(btrim(v_root->>'overview_title'), ''), v_optional_title_sentinel),
    'delivery_title', coalesce(nullif(btrim(v_root->>'delivery_title'), ''), v_optional_title_sentinel)
  );
  v_forward_payload := jsonb_set(
    coalesce(p_payload, '{}'::jsonb),
    '{project}',
    v_forward_root,
    true
  );

  select * into strict v_saved
  from public.save_project_admin_entry_before_section_titles(
    p_project_id,
    v_forward_payload
  );

  update public.projects project set
    location_title = nullif(btrim(v_root->>'location_title'), ''),
    overview_title = nullif(btrim(v_root->>'overview_title'), ''),
    plans_title = nullif(btrim(v_root->>'plans_title'), ''),
    delivery_title = nullif(btrim(v_root->>'delivery_title'), ''),
    gallery_title = nullif(btrim(v_root->>'gallery_title'), ''),
    show_location_label = case
      when v_location_section_presentation ? 'show_location_label'
        then coalesce(
          (v_location_section_presentation->>'show_location_label')::boolean,
          true
        )
      else project.show_location_label
    end,
    show_location_tags = case
      when v_location_section_presentation ? 'show_location_tags'
        then coalesce(
          (v_location_section_presentation->>'show_location_tags')::boolean,
          true
        )
      else project.show_location_tags
    end,
    updated_at = v_saved.updated_at
  where project.id = v_saved.project_id;

  return query select v_saved.project_id, v_saved.slug, v_saved.updated_at;
end
$function$;

-- Duplication stays inside the existing owner and copies the Location Section
-- presentation for the duplicated Project page only.
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
  select
    location_title,
    plans_title,
    gallery_title,
    show_location_label,
    show_location_tags
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
    gallery_title = v_source.gallery_title,
    show_location_label = v_source.show_location_label,
    show_location_tags = v_source.show_location_tags
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

revoke all on function public.save_project_admin_entry(bigint, jsonb)
from public, anon, authenticated;
revoke all on function public.duplicate_project_admin_entry(bigint)
from public, anon, authenticated;
grant execute on function public.save_project_admin_entry(bigint, jsonb)
to service_role;
grant execute on function public.duplicate_project_admin_entry(bigint)
to service_role;

comment on column public.projects.show_location_label is
  'Project Location Section presentation for this Project page only. Other Consumers must ignore it.';
comment on column public.projects.show_location_tags is
  'Project Location Section hierarchy-tag presentation for this Project page only. Other Consumers must ignore it.';
comment on function public.save_project_admin_entry(bigint, jsonb) is
  'Single atomic Project Admin writer. Project data and per-Project Location Section presentation use separate payload boundaries.';

commit;

-- Data impact: none during migration. Existing Boolean values are preserved.
-- Rollback policy: forward-fix only; reverting the function bodies would make
-- the Admin switches inert again without deleting their stored decisions.
