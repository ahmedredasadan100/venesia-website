begin;

-- Listing Heroes use the existing Hero source contract. The source_slug narrows
-- featured_media to the route's authoritative media content type.
update public.hero_templates
set
  source_type = 'featured_media',
  source_slug = case slug
    when 'hero-media-center-news' then 'news'
    when 'hero-media-center-videos' then 'video'
    when 'hero-media-center-gallery' then 'gallery'
    when 'hero-media-center-press' then 'press'
    when 'hero-media-center-site-updates' then 'site_update'
  end,
  source_id = null,
  limit_count = 1,
  updated_at = now()
where slug in (
  'hero-media-center-news',
  'hero-media-center-videos',
  'hero-media-center-gallery',
  'hero-media-center-press',
  'hero-media-center-site-updates'
);

-- Media Hub listing presentation no longer owns a second Hero contract.
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

commit;
