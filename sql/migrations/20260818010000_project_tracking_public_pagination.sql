begin;

-- Keep the existing public read owner and narrow it to bounded core facts.
-- Stages, Items, Updates and Media are paged by public-read.ts with stable order.
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
  'Existing Project Tracking public core read model. Child Stages, Items, Updates and Media are intentionally excluded and paged by the canonical application read owner.';

commit;
