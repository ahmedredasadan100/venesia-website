begin;

-- Product correction: Project remains the owner of location data only.
-- Existing Consumer configurations own whether that data is rendered. The two
-- legacy columns remain inert for rolling-deployment compatibility; this
-- migration removes them from every active Project write/read contract.
do $project_location_consumer_ownership_preflight$
begin
  if to_regclass('public.projects') is null then
    raise exception 'Project Location Consumer Ownership requires public.projects.';
  end if;

  if to_regprocedure('public.save_project_admin_entry(bigint,jsonb)') is null
     or to_regprocedure('public.save_project_admin_entry_before_section_titles(bigint,jsonb)') is null
     or to_regprocedure('public.duplicate_project_admin_entry(bigint)') is null
     or to_regprocedure('public.duplicate_project_admin_entry_before_section_titles(bigint)') is null then
    raise exception 'Project Location Consumer Ownership requires the canonical Project writer chain.';
  end if;

  if to_regprocedure('public.project_tracking_public_detail_v1(text)') is null then
    raise exception 'Project Location Consumer Ownership requires the canonical Tracking read owner.';
  end if;
end
$project_location_consumer_ownership_preflight$;

-- Restore the canonical section-title wrapper as the complete Project writer.
-- Unknown legacy presentation keys are ignored by the private core and no
-- Project-owned visibility state is authored by this boundary.
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

-- Restore duplication to Project data only. Legacy presentation columns take
-- their compatibility defaults and are not copied as authored Project state.
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

revoke all on function public.save_project_admin_entry(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.duplicate_project_admin_entry(bigint) from public, anon, authenticated;
grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role;
grant execute on function public.duplicate_project_admin_entry(bigint) to service_role;

comment on column public.projects.show_location_label is
  'Deprecated compatibility-only value. Project owns location data; active presentation decisions belong to each Consumer.';
comment on column public.projects.show_location_tags is
  'Deprecated compatibility-only value. Project owns location data; active presentation decisions belong to each Consumer.';
comment on function public.save_project_admin_entry(bigint, jsonb) is
  'Single atomic Project aggregate writer for Project data and nullable section headings; Consumer presentation is excluded.';

-- Restore the bounded Tracking read model to Project data only. Tracking owns
-- its own presenter and therefore receives the location value without a
-- Project-level visibility override.
create or replace function public.project_tracking_public_detail_v1(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $function$
with project_row as (
  select
    project.id, project.slug, project.code, project.type,
    project.arabic_name, project.english_name, project.location_label,
    project.hero_image, project.hero_image_alt
  from public.projects project
  where project.slug = pg_catalog.lower(pg_catalog.btrim(p_slug))
    and project.publication_status = 'published'
),
eligible_stages as (
  select stage.id, stage.project_id
  from public.project_tracking_stages stage
  join project_row project on project.id = stage.project_id
  where stage.is_visible
),
eligible_items as (
  select item.id, item.stage_id
  from public.project_tracking_items item
  join eligible_stages stage on stage.id = item.stage_id
  where item.is_visible
),
eligible_updates as (
  select update_row.*, item.stage_id
  from public.project_tracking_updates update_row
  join eligible_items item on item.id = update_row.item_id
  where update_row.publication_status = 'published'
),
latest_update as (
  select update_row.*
  from eligible_updates update_row
  order by update_row.occurred_at desc, update_row.id desc
  limit 1
),
derived_counts as (
  select
    (select count(*) from eligible_updates)::integer as update_count,
    (select count(*)
      from public.project_tracking_update_media media
      join eligible_updates update_row on update_row.id = media.update_id
      where media.media_kind = 'image')::integer as image_count,
    (select count(*)
      from public.project_tracking_update_media media
      join eligible_updates update_row on update_row.id = media.update_id
      where media.media_kind = 'video')::integer as video_count,
    (select count(*) from eligible_stages)::integer as stage_count
)
select case
  when not exists (select 1 from project_row) then null
  else pg_catalog.jsonb_build_object(
    'project', (
      select pg_catalog.jsonb_build_object(
        'id', project.id, 'slug', project.slug, 'code', project.code,
        'type', project.type, 'arabicName', project.arabic_name,
        'englishName', project.english_name, 'location', project.location_label,
        'heroImage', project.hero_image, 'heroImageAlt', project.hero_image_alt
      )
      from project_row project
    ),
    'profile', (
      select case
        when profile.project_id is null then null
        else pg_catalog.jsonb_build_object(
          'projectReceiptDate', profile.project_receipt_date,
          'licenseReceiptDate', profile.license_receipt_date,
          'contractorName', profile.contractor_name
        )
      end
      from project_row project
      left join public.project_tracking_profiles profile
        on profile.project_id = project.id
    ),
    'latestUpdate', (
      select pg_catalog.jsonb_build_object(
        'id', update_row.id,
        'itemId', update_row.item_id,
        'stageId', update_row.stage_id,
        'occurredAt', update_row.occurred_at,
        'title', update_row.title,
        'body', update_row.body,
        'publishedAt', update_row.published_at
      )
      from latest_update update_row
    ),
    'latestVisual', coalesce(
      (
        select media.public_url
        from public.project_tracking_update_media media
        join latest_update update_row on update_row.id = media.update_id
        where media.media_kind = 'image'
        order by media.sort_order, media.id
        limit 1
      ),
      (
        select media.poster_url
        from public.project_tracking_update_media media
        join latest_update update_row on update_row.id = media.update_id
        where media.media_kind = 'video'
          and coalesce(media.poster_url, '') <> ''
        order by media.sort_order, media.id
        limit 1
      ),
      (select project.hero_image from project_row project)
    ),
    'counts', (
      select pg_catalog.jsonb_build_object(
        'updates', counts.update_count,
        'images', counts.image_count,
        'videos', counts.video_count,
        'stages', counts.stage_count
      )
      from derived_counts counts
    )
  )
end
$function$;

revoke all on function public.project_tracking_public_detail_v1(text)
from public, anon, authenticated;
grant execute on function public.project_tracking_public_detail_v1(text)
to service_role;

comment on function public.project_tracking_public_detail_v1(text) is
  'Existing Project Tracking public core read model. Project location is data; Tracking presentation remains Consumer-owned.';

commit;

-- Rollback policy: forward-fix only. Historical Boolean values are retained
-- as inert compatibility storage, so this correction has no Project data loss.
