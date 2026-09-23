-- Public Content Read: two bounded taxonomy Feed projections.
-- The server-only Public Content Read owner supplies already-selected identities;
-- these functions never choose taxonomy order, page limits, or public URLs.
begin;

create or replace function public.public_feed_category_counts(
  p_categories jsonb,
  p_series_slugs text[] default '{}'::text[]
)
returns table(category_id bigint, article_count bigint)
language plpgsql stable security invoker
set search_path = ''
as $function$
begin
  if jsonb_typeof(p_categories) is distinct from 'array' or p_series_slugs is null then
    raise exception using errcode = '22023', message = 'public_feed_category_input_invalid';
  end if;
  if jsonb_array_length(p_categories) > 60 then
    raise exception using errcode = '22023', message = 'public_feed_category_input_invalid';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_categories) as item(id bigint, slugs text[])
    where item.id is null or item.slugs is null or cardinality(item.slugs) = 0
       or array_position(item.slugs, null) is not null
  ) or exists (
    select 1 from jsonb_to_recordset(p_categories) as item(id bigint, slugs text[])
    group by item.id having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'public_feed_category_input_invalid';
  end if;

  return query
    select requested.id, count(topic.id)::bigint
    from jsonb_to_recordset(p_categories) as requested(id bigint, slugs text[])
    left join public.topics topic
      on topic.category_slug = any(requested.slugs)
     and (cardinality(p_series_slugs) = 0 or topic.series_slug = any(p_series_slugs))
     and topic.content_type = 'article'
     and topic.status = 'published'
     and topic.deleted_at is null
     and topic.slug not like 'e2e-test%'
    group by requested.id;
end;
$function$;

revoke all on function public.public_feed_category_counts(jsonb,text[]) from public, anon, authenticated;
grant execute on function public.public_feed_category_counts(jsonb,text[]) to service_role;

create or replace function public.public_feed_series_representatives(
  p_series_slugs text[]
)
returns table(series_slug text, representative jsonb)
language plpgsql stable security invoker
set search_path = ''
as $function$
begin
  if p_series_slugs is null or cardinality(p_series_slugs) > 60
     or array_position(p_series_slugs, null) is not null
     or exists (select 1 from unnest(p_series_slugs) slug where btrim(slug) = '')
     or (select count(*) from unnest(p_series_slugs) slug)
        <> (select count(distinct slug) from unnest(p_series_slugs) slug) then
    raise exception using errcode = '22023', message = 'public_feed_series_input_invalid';
  end if;

  return query
    with ranked as (
      select topic.*,
        row_number() over (
          partition by topic.series_slug
          order by topic.published_at desc, topic.id desc
        ) as series_rank
      from public.topics topic
      where topic.series_slug = any(p_series_slugs)
        and topic.content_type = 'article'
        and topic.status = 'published'
        and topic.deleted_at is null
        and topic.slug not like 'e2e-test%'
    )
    select topic.series_slug,
      jsonb_build_object(
        'id', topic.id,
        'slug', topic.slug,
        'title', topic.title,
        'excerpt', topic.excerpt,
        'image', topic.image,
        'image_alt', topic.image_alt,
        'category', topic.category,
        'category_slug', topic.category_slug,
        'series', topic.series,
        'series_slug', topic.series_slug,
        'date_label', topic.date_label,
        'published_at', topic.published_at,
        'content_type', topic.content_type,
        'is_featured', topic.is_featured,
        'is_popular', topic.is_popular,
        'views_count', topic.views_count,
        'media_kind', topic.media_payload->>'kind',
        'media_duration', topic.media_payload->>'duration',
        'media_thumbnail', topic.media_payload->>'thumbnail',
        'media_gallery_cover', topic.media_payload->'images'->0->>'url',
        'media_gallery_cover_alt', topic.media_payload->'images'->0->>'alt',
        'media_project', topic.media_project,
        'show_title_on_page', topic.show_title_on_page,
        'show_image_on_page', topic.show_image_on_page,
        'show_excerpt_on_page', topic.show_excerpt_on_page,
        'show_date_on_page', topic.show_date_on_page,
        'show_category_on_page', topic.show_category_on_page,
        'show_series_on_page', topic.show_series_on_page,
        'show_intro_card_on_page', topic.show_intro_card_on_page
      )
    from ranked topic
    where topic.series_rank = 1;
end;
$function$;

revoke all on function public.public_feed_series_representatives(text[]) from public, anon, authenticated;
grant execute on function public.public_feed_series_representatives(text[]) to service_role;

commit;
