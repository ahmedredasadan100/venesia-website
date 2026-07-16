-- Idempotent seed: About Intro single-image content module (independent of about-intro).
-- Source lookup by slug = about-intro. Does not mutate the original template or its assignments.

begin;

with source as (
  select id, description, style_preset, config
  from public.content_block_templates
  where slug = 'about-intro'
  limit 1
)
insert into public.content_block_templates (
  name,
  slug,
  description,
  variant,
  style_preset,
  status,
  config,
  sort_order,
  created_at,
  updated_at
)
select
  'من نحن — محتوى وصورة واحدة',
  'about-intro-single-image',
  coalesce(source.description, 'موديول من نحن بصورة واحدة وموضع يمين/يسار قابل للضبط.'),
  'about-intro-single-image',
  coalesce(source.style_preset, 'premium-dark'),
  'draft',
  (
    coalesce(source.config, '{}'::jsonb)
    || jsonb_build_object(
      'imagePosition', 'left',
      'images', jsonb_build_object(
        'main', source.config #>> '{images,main}',
        'mainAlt', source.config #>> '{images,mainAlt}'
      )
    )
  ),
  coalesce((select max(sort_order) from public.content_block_templates), 0) + 10,
  now(),
  now()
from source
where not exists (
  select 1 from public.content_block_templates where slug = 'about-intro-single-image'
);

insert into public.page_content_block_assignments (
  page_id,
  template_id,
  slot,
  sort_order,
  is_visible
)
select
  p.id,
  t.id,
  coalesce(sa.slot, 'main'),
  coalesce(sa.sort_order, 0) + 5,
  false
from public.pages p
join public.content_block_templates t on t.slug = 'about-intro-single-image'
left join lateral (
  select a.slot, a.sort_order
  from public.page_content_block_assignments a
  join public.content_block_templates src on src.id = a.template_id
  where a.page_id = p.id
    and src.slug = 'about-intro'
  order by a.sort_order asc
  limit 1
) sa on true
where p.slug = 'about'
  and not exists (
    select 1
    from public.page_content_block_assignments a
    where a.page_id = p.id
      and a.template_id = t.id
  );

commit;
