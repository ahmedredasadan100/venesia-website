-- Media Center listing presentation templates.
-- Data-only adoption of the existing Media Hub module owner and assignment contract.

begin;

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
    'Media Center — News Listing Presentation',
    'media-listing-presentation-news',
    'Featured and listing presentation for /media-center/news',
    'featured',
    'published',
    $json${"placement":"listing","source":"topics","type":"news","presentation":{"eyebrow":"","title":"","description":"","ctaText":""},"listing":{"featuredMode":"automatic","manualTopicId":null,"pageSize":2,"layout":"grid","columns":2,"paginationEnabled":true,"cardVariant":"default","featuredCtaText":"اقرأ الخبر الكامل","cardCtaText":"قراءة الخبر"}}$json$::jsonb,
    10
  ),
  (
    'Media Center — Videos Listing Presentation',
    'media-listing-presentation-videos',
    'Featured and listing presentation for /media-center/videos',
    'videos',
    'published',
    $json${"placement":"listing","source":"topics","type":"video","presentation":{"eyebrow":"","title":"","description":"","ctaText":""},"listing":{"featuredMode":"automatic","manualTopicId":null,"pageSize":2,"layout":"grid","columns":2,"paginationEnabled":true,"cardVariant":"default","featuredCtaText":"مشاهدة الفيديو","cardCtaText":"مشاهدة الفيديو"}}$json$::jsonb,
    20
  ),
  (
    'Media Center — Gallery Listing Presentation',
    'media-listing-presentation-gallery',
    'Featured and listing presentation for /media-center/gallery',
    'gallery',
    'published',
    $json${"placement":"listing","source":"topics","type":"gallery","presentation":{"eyebrow":"","title":"","description":"","ctaText":""},"listing":{"featuredMode":"automatic","manualTopicId":null,"pageSize":2,"layout":"grid","columns":2,"paginationEnabled":true,"cardVariant":"default","featuredCtaText":"عرض الصور","cardCtaText":"عرض الصور"}}$json$::jsonb,
    30
  ),
  (
    'Media Center — Press Listing Presentation',
    'media-listing-presentation-press',
    'Featured and listing presentation for /media-center/press',
    'press',
    'published',
    $json${"placement":"listing","source":"topics","type":"press","presentation":{"eyebrow":"","title":"","description":"","ctaText":""},"listing":{"featuredMode":"automatic","manualTopicId":null,"pageSize":2,"layout":"grid","columns":2,"paginationEnabled":true,"cardVariant":"default","featuredCtaText":"اقرأ البيان الكامل","cardCtaText":"قراءة البيان"}}$json$::jsonb,
    40
  ),
  (
    'Media Center — Site Updates Listing Presentation',
    'media-listing-presentation-site-updates',
    'Featured and listing presentation for /media-center/site-updates',
    'site-updates',
    'published',
    $json${"placement":"listing","source":"topics","type":"site_update","presentation":{"eyebrow":"","title":"","description":"","ctaText":""},"listing":{"featuredMode":"automatic","manualTopicId":null,"pageSize":2,"layout":"grid","columns":2,"paginationEnabled":true,"cardVariant":"default","featuredCtaText":"عرض التحديث الكامل","cardCtaText":"عرض التحديث"}}$json$::jsonb,
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

do $sync_media_center_listing_presentations$
declare
  v_listing record;
begin
  for v_listing in
    select
      page.id as page_id,
      template.id as template_id
    from (
      values
        ('media-center-news', 'media-listing-presentation-news'),
        ('media-center-videos', 'media-listing-presentation-videos'),
        ('media-center-gallery', 'media-listing-presentation-gallery'),
        ('media-center-press', 'media-listing-presentation-press'),
        ('media-center-site-updates', 'media-listing-presentation-site-updates')
    ) as listing(page_slug, template_slug)
    join public.pages page on page.slug = listing.page_slug
    join public.media_hub_module_templates template on template.slug = listing.template_slug
  loop
    perform public.mutate_page_composition(
      v_listing.page_id,
      'sync_template_pages',
      jsonb_build_object(
        'kind', 'media_hub',
        'template_id', v_listing.template_id,
        'default_slot', 'main',
        'page_ids', jsonb_build_array(v_listing.page_id)
      ),
      null,
      'system:migration:20260815092555_media_center_listing_presentation'
    );
  end loop;
end;
$sync_media_center_listing_presentations$;

commit;
