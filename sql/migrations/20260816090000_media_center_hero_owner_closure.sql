begin;

-- Hero owns authored Hero presentation only. Legacy source columns stay as
-- storage compatibility fields, but their only valid product value is manual.
update public.hero_templates
set
  source_type = 'manual',
  source_id = null,
  source_slug = null,
  limit_count = 1,
  updated_at = now()
where source_type is distinct from 'manual'
   or source_id is not null
   or source_slug is not null
   or limit_count is distinct from 1;

-- Listing Presentation keeps only listing presentation. Featured Content is a
-- separate Media Hub module contract with its own publication and assignment.
update public.media_hub_module_templates
set
  config = jsonb_set(
    config,
    '{listing}',
    (((config -> 'listing') - 'featuredMode') - 'manualTopicId') - 'featuredCtaText',
    false
  ),
  updated_at = now()
where config ->> 'placement' = 'listing'
  and jsonb_typeof(config -> 'listing') = 'object';

update public.media_hub_module_templates
set
  description = replace(description, 'Featured and listing presentation', 'Listing presentation'),
  updated_at = now()
where config ->> 'placement' = 'listing'
  and description like 'Featured and listing presentation%';

-- Remove the retired Hub-featured side/latest contract. Featured modules read
-- featured content only and never own a latest-content fallback.
update public.media_hub_module_templates
set
  config = ((config - 'sideLimit') - 'listLimit') || jsonb_build_object(
    'featured', true,
    'limit', 1
  ),
  updated_at = now()
where section_key = 'featured'
  and coalesce(config ->> 'placement', 'hub') <> 'listing';

-- Listing Shell is retired through the existing Page Composition mutation
-- owner. Historical templates remain unpublished only as inert provenance.
do $retire_media_center_listing_shells$
declare
  v_shell record;
begin
  for v_shell in
    select template.id as template_id, min(assignment.page_id) as anchor_page_id
    from public.content_block_templates template
    join public.page_content_block_assignments assignment
      on assignment.template_id = template.id
    where template.slug in (
      'media-center-news-listing-shell',
      'media-center-videos-listing-shell',
      'media-center-gallery-listing-shell',
      'media-center-press-listing-shell',
      'media-center-site-updates-listing-shell'
    )
    group by template.id
  loop
    perform public.mutate_page_composition(
      v_shell.anchor_page_id,
      'sync_template_pages',
      jsonb_build_object(
        'kind', 'content',
        'template_id', v_shell.template_id,
        'default_slot', 'main',
        'page_ids', '[]'::jsonb
      ),
      null,
      'system:migration:20260816090000_media_center_hero_owner_closure'
    );
  end loop;
end;
$retire_media_center_listing_shells$;

update public.content_block_templates
set status = 'unpublished', updated_at = now()
where slug in (
  'media-center-news-listing-shell',
  'media-center-videos-listing-shell',
  'media-center-gallery-listing-shell',
  'media-center-press-listing-shell',
  'media-center-site-updates-listing-shell'
);

insert into public.media_hub_module_templates (
  name,
  slug,
  description,
  section_key,
  status,
  config,
  sort_order
)
values
  (
    'Media Center — News Featured Content',
    'media-featured-content-news',
    'Independent Featured Content module for /media-center/news',
    'featured',
    'published',
    $json${"placement":"featured","source":"topics","type":"news","featured":true,"limit":1,"presentation":{"eyebrow":"Featured News","title":"خبر مميز","description":"","ctaText":"كل الأخبار"}}$json$::jsonb,
    10
  ),
  (
    'Media Center — Videos Featured Content',
    'media-featured-content-videos',
    'Independent Featured Content module for /media-center/videos',
    'featured',
    'published',
    $json${"placement":"featured","source":"topics","type":"video","featured":true,"limit":1,"presentation":{"eyebrow":"Featured Video","title":"فيديو مميز","description":"","ctaText":"كل الفيديوهات"}}$json$::jsonb,
    20
  ),
  (
    'Media Center — Gallery Featured Content',
    'media-featured-content-gallery',
    'Independent Featured Content module for /media-center/gallery',
    'featured',
    'published',
    $json${"placement":"featured","source":"topics","type":"gallery","featured":true,"limit":1,"presentation":{"eyebrow":"Featured Gallery","title":"معرض مميز","description":"","ctaText":"كل المعارض"}}$json$::jsonb,
    30
  ),
  (
    'Media Center — Press Featured Content',
    'media-featured-content-press',
    'Independent Featured Content module for /media-center/press',
    'featured',
    'published',
    $json${"placement":"featured","source":"topics","type":"press","featured":true,"limit":1,"presentation":{"eyebrow":"Featured Press","title":"بيان مميز","description":"","ctaText":"كل البيانات"}}$json$::jsonb,
    40
  ),
  (
    'Media Center — Site Updates Featured Content',
    'media-featured-content-site-updates',
    'Independent Featured Content module for /media-center/site-updates',
    'featured',
    'published',
    $json${"placement":"featured","source":"topics","type":"site_update","featured":true,"limit":1,"presentation":{"eyebrow":"Featured Update","title":"تحديث مميز","description":"","ctaText":"كل التحديثات"}}$json$::jsonb,
    50
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  section_key = excluded.section_key,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

do $sync_media_center_featured_content$
declare
  v_featured record;
begin
  for v_featured in
    select page.id as page_id, template.id as template_id
    from (
      values
        ('media-center-news', 'media-featured-content-news'),
        ('media-center-videos', 'media-featured-content-videos'),
        ('media-center-gallery', 'media-featured-content-gallery'),
        ('media-center-press', 'media-featured-content-press'),
        ('media-center-site-updates', 'media-featured-content-site-updates')
    ) as featured(page_slug, template_slug)
    join public.pages page on page.slug = featured.page_slug
    join public.media_hub_module_templates template on template.slug = featured.template_slug
  loop
    perform public.mutate_page_composition(
      v_featured.page_id,
      'sync_template_pages',
      jsonb_build_object(
        'kind', 'media_hub',
        'template_id', v_featured.template_id,
        'default_slot', 'main',
        'page_ids', jsonb_build_array(v_featured.page_id)
      ),
      null,
      'system:migration:20260816090000_media_center_hero_owner_closure'
    );
  end loop;
end;
$sync_media_center_featured_content$;

do $assert_media_center_owner_closure$
begin
  if exists (
    select 1 from public.hero_templates
    where source_type <> 'manual'
       or source_id is not null
       or source_slug is not null
       or limit_count <> 1
  ) then
    raise exception 'Media Center owner closure refused: Hero still owns a content source';
  end if;

  if exists (
    select 1
    from public.page_content_block_assignments assignment
    join public.content_block_templates template on template.id = assignment.template_id
    where template.slug in (
      'media-center-news-listing-shell',
      'media-center-videos-listing-shell',
      'media-center-gallery-listing-shell',
      'media-center-press-listing-shell',
      'media-center-site-updates-listing-shell'
    )
  ) then
    raise exception 'Media Center owner closure refused: retired Listing Shell remains assigned';
  end if;

  if exists (
    select 1 from public.content_block_templates
    where slug in (
      'media-center-news-listing-shell',
      'media-center-videos-listing-shell',
      'media-center-gallery-listing-shell',
      'media-center-press-listing-shell',
      'media-center-site-updates-listing-shell'
    ) and status <> 'unpublished'
  ) then
    raise exception 'Media Center owner closure refused: retired Listing Shell is publishable';
  end if;

  if exists (
    select 1 from public.media_hub_module_templates
    where config ->> 'placement' = 'listing'
      and (
        config -> 'listing' ? 'featuredMode'
        or config -> 'listing' ? 'manualTopicId'
        or config -> 'listing' ? 'featuredCtaText'
      )
  ) then
    raise exception 'Media Center owner closure refused: Listing Presentation still owns Featured Content';
  end if;

  if (
    select count(*)
    from public.media_hub_module_templates
    where slug like 'media-featured-content-%'
      and status = 'published'
      and section_key = 'featured'
      and config ->> 'placement' = 'featured'
      and config ->> 'source' = 'topics'
      and config ->> 'featured' = 'true'
  ) <> 5 then
    raise exception 'Media Center owner closure refused: expected five Featured Content templates';
  end if;

  if exists (
    select 1
    from (
      values
        ('media-center-news', 'media-featured-content-news', 'news'),
        ('media-center-videos', 'media-featured-content-videos', 'video'),
        ('media-center-gallery', 'media-featured-content-gallery', 'gallery'),
        ('media-center-press', 'media-featured-content-press', 'press'),
        ('media-center-site-updates', 'media-featured-content-site-updates', 'site_update')
    ) as expected(page_slug, template_slug, content_type)
    where (
      select count(*)
      from public.page_media_hub_module_assignments assignment
      join public.pages page on page.id = assignment.page_id
      join public.media_hub_module_templates template on template.id = assignment.template_id
      where page.slug = expected.page_slug
        and template.slug = expected.template_slug
        and assignment.is_visible
        and template.status = 'published'
        and template.config ->> 'type' = expected.content_type
    ) <> 1
  ) then
    raise exception 'Media Center owner closure refused: Featured Content adoption is incomplete';
  end if;
end;
$assert_media_center_owner_closure$;

commit;
