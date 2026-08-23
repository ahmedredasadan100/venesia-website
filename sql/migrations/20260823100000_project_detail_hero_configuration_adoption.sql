-- Project Detail Hero adopts the existing hero_templates presentation owner.
-- Project data remains in Projects Domain; only Hero presentation is persisted here.

begin;

alter table public.hero_templates
  drop constraint if exists hero_templates_source_type_check;

alter table public.hero_templates
  add constraint hero_templates_source_type_check check (
    source_type = any (array[
      'manual'::text,
      'domain-backed'::text,
      'latest_topics'::text,
      'featured_topics'::text,
      'topic_category'::text,
      'latest_media'::text,
      'featured_media'::text,
      'media_category'::text
    ])
  );

update public.hero_templates
set
  source_type = 'domain-backed',
  source_id = null,
  source_slug = null,
  config = config
    - 'eyebrow' - 'title' - 'highlight' - 'subtitle' - 'description'
    - 'images' - 'mobileImages' - 'mobile_images'
    - 'primaryCtaLabel' - 'primaryCtaLink' - 'primaryCtaHref'
    - 'secondaryCtaLabel' - 'secondaryCtaLink' - 'secondaryCtaHref',
  updated_at = now()
where variant = 'project-detail';

create unique index if not exists hero_templates_project_detail_singleton_idx
  on public.hero_templates (variant)
  where variant = 'project-detail';

insert into public.hero_templates (
  name,
  slug,
  description,
  section_key,
  variant,
  style_preset,
  source_type,
  source_id,
  source_slug,
  limit_count,
  is_visible,
  sort_order,
  status,
  config
)
select
  'Hero تفاصيل المشروع',
  'project-detail-hero',
  'Presentation مشتركة لكل صفحات تفاصيل المشاريع؛ البيانات مملوكة لـProjects Domain.',
  'hero',
  'project-detail',
  'cinematic-gold',
  'domain-backed',
  null,
  null,
  1,
  true,
  0,
  'published',
  jsonb_build_object(
    'showEyebrow', true,
    'eyebrowBold', false,
    'eyebrowAlignment', 'right',
    'showTitle', true,
    'titleBold', true,
    'titleAlignment', 'right',
    'showHighlight', false,
    'highlightBold', false,
    'highlightAlignment', 'right',
    'showSubtitle', true,
    'subtitleBold', true,
    'subtitleAlignment', 'right',
    'showDescription', true,
    'descriptionAlignment', 'right',
    'showCta', true,
    'ctaAlignment', 'right',
    'heroElementOrder', jsonb_build_array('eyebrow', 'title', 'subtitle', 'description', 'cta'),
    'imageComposition', 'cover-center'
  )
where not exists (
  select 1 from public.hero_templates where variant = 'project-detail'
)
on conflict (slug) do nothing;

do $adoption$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.hero_templates
  where variant = 'project-detail';

  if v_count <> 1 then
    raise exception 'Project Detail Hero configuration adoption requires exactly one template; found %', v_count;
  end if;
end;
$adoption$;

comment on index public.hero_templates_project_detail_singleton_idx is
  'One canonical Hero presentation configuration for all Project Detail consumers.';

-- Shared Hero status persistence is intentionally outside this adoption migration.

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
