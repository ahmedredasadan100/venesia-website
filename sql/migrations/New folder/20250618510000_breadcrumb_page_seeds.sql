-- Seed breadcrumb modules for About / Contact / Topics (navigation-driven defaults)

begin;

insert into public.breadcrumb_block_templates (name, slug, description, variant, status, config, sort_order)
values
  (
    'Breadcrumb — About',
    'breadcrumb-about',
    'مسار التنقل لصفحة من نحن',
    'hero-inline',
    'published',
    '{"source":"navigation","showHome":true}'::jsonb,
    5
  ),
  (
    'Breadcrumb — Contact',
    'breadcrumb-contact',
    'مسار التنقل لصفحة تواصل معنا',
    'hero-inline',
    'published',
    '{"source":"navigation","showHome":true}'::jsonb,
    5
  ),
  (
    'Breadcrumb — Topics',
    'breadcrumb-topics',
    'مسار التنقل لصفحة مواضيع تهمك',
    'hero-inline',
    'published',
    '{"source":"navigation","showHome":true}'::jsonb,
    5
  )
on conflict (slug) do nothing;

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'top', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-about'
where p.slug = 'about'
on conflict (page_id, template_id) do nothing;

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'top', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-contact'
where p.slug = 'contact'
on conflict (page_id, template_id) do nothing;

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'top', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-topics'
where p.slug = 'topics'
on conflict (page_id, template_id) do nothing;

commit;
