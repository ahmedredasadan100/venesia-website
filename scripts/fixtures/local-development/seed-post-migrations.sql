-- Synthetic local-development composition coverage. No Production data.
begin;
select set_config('app.page_composition_write', 'on', true);

insert into public.pages(title, slug, path, page_type, status, sort_order)
values
  ('من نحن — Development', 'about', '/about', 'static', 'published', 20),
  ('تواصل معنا — Development', 'contact', '/contact', 'contact', 'published', 30)
on conflict (slug) do update set
  title = excluded.title,
  path = excluded.path,
  page_type = excluded.page_type,
  status = excluded.status;

update public.pages set status = 'published' where slug = 'home';

insert into public.page_content_block_assignments(page_id, template_id, slot, sort_order, is_visible)
select page.id, template.id, 'main', source.sort_order, true
from (values
  ('about', 'about-intro-single-image', 10),
  ('about', 'vision-goals', 20),
  ('about', 'about-approach', 30),
  ('about', 'about-principles', 40),
  ('contact', 'contact-form-office', 10),
  ('contact', 'contact-form', 20),
  ('contact', 'contact-map', 30)
) source(page_slug, template_slug, sort_order)
join public.pages page on page.slug = source.page_slug
join public.content_block_templates template on template.slug = source.template_slug
where not exists (
  select 1 from public.page_content_block_assignments assignment
  where assignment.page_id = page.id and assignment.template_id = template.id
);

insert into public.page_cards_block_assignments(page_id, template_id, slot, sort_order, is_visible)
select page.id, template.id, 'main', source.sort_order, true
from (values
  ('contact', 'contact-trust-cards', 40),
  ('contact', 'contact-reasons', 50),
  ('contact', 'contact-departments', 60),
  ('contact', 'contact-faq', 70)
) source(page_slug, template_slug, sort_order)
join public.pages page on page.slug = source.page_slug
join public.cards_block_templates template on template.slug = source.template_slug
where not exists (
  select 1 from public.page_cards_block_assignments assignment
  where assignment.page_id = page.id and assignment.template_id = template.id
);

insert into public.page_cta_block_assignments(page_id, template_id, slot, sort_order, is_visible)
select page.id, template.id, 'bottom', source.sort_order, true
from (values
  ('about', 'about-cta', 90),
  ('contact', 'contact-cta', 90)
) source(page_slug, template_slug, sort_order)
join public.pages page on page.slug = source.page_slug
join public.cta_block_templates template on template.slug = source.template_slug
where not exists (
  select 1 from public.page_cta_block_assignments assignment
  where assignment.page_id = page.id and assignment.template_id = template.id
);

insert into public.page_breadcrumb_block_assignments(page_id, template_id, slot, sort_order, is_visible)
select page.id, template.id, 'main', 0, true
from (values
  ('about', 'breadcrumb-about'),
  ('contact', 'breadcrumb-contact')
) source(page_slug, template_slug)
join public.pages page on page.slug = source.page_slug
join public.breadcrumb_block_templates template on template.slug = source.template_slug
where not exists (
  select 1 from public.page_breadcrumb_block_assignments assignment
  where assignment.page_id = page.id and assignment.template_id = template.id
);

insert into public.page_composition_layouts(key, admin_label)
values ('development-flexible', 'Development Flexible Layout')
on conflict (key) do update set admin_label = excluded.admin_label;

insert into public.page_composition_regions(layout_id, key, admin_label, sort_order)
select layout.id, 'north-gallery', 'North Gallery', 10
from public.page_composition_layouts layout
where layout.key = 'development-flexible'
on conflict (layout_id, key) do update set
  admin_label = excluded.admin_label,
  sort_order = excluded.sort_order;

insert into public.pages(title, slug, path, page_type, status, sort_order, layout_id)
select 'Flexible Region — Development', 'development-flexible-region',
  '/development-flexible-region', 'static', 'published', 990, layout.id
from public.page_composition_layouts layout
where layout.key = 'development-flexible'
on conflict (slug) do update set
  title = excluded.title,
  path = excluded.path,
  status = excluded.status,
  layout_id = excluded.layout_id;

insert into public.page_content_block_assignments(page_id, template_id, slot, sort_order, is_visible)
select page.id, template.id, 'north-gallery', 10, true
from public.pages page
cross join lateral (
  select id from public.content_block_templates where status = 'published' order by id limit 1
) template
where page.slug = 'development-flexible-region'
  and not exists (
    select 1 from public.page_content_block_assignments assignment
    where assignment.page_id = page.id and assignment.slot = 'north-gallery'
  );

commit;
