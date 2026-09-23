-- Synthetic local-development composition coverage. No Production data.
begin;
select set_config('app.page_composition_write', 'on', true);

do $development_navigation$
declare
  v_main_menu_id bigint;
  v_footer_menu_id bigint;
  v_item record;
begin
  insert into public.menus(name, slug, location, is_active)
  values ('Development Main Navigation', 'development-main', 'main', true)
  on conflict (slug) do update set
    name = excluded.name,
    location = excluded.location,
    is_active = excluded.is_active
  returning id into v_main_menu_id;

  for v_item in select * from (values
    ('الرئيسية', '/', 10),
    ('من نحن', '/about', 20),
    ('الموضوعات', '/topics', 30),
    ('المركز الإعلامي', '/media-center', 40),
    ('المشروعات', '/projects', 50),
    ('تواصل معنا', '/contact', 60)
  ) source(label, href, sort_order)
  loop
    if not exists (
      select 1 from public.menu_items item
      where item.menu_id = v_main_menu_id and item.href = v_item.href
    ) then
      perform public.mutate_menu_tree(
        v_main_menu_id,
        'save_item',
        jsonb_build_object('item', jsonb_build_object(
          'label', v_item.label,
          'item_type', 'custom',
          'href', v_item.href,
          'sort_order', v_item.sort_order,
          'is_visible', true
        )),
        null,
        'system:local-development-seed'
      );
    end if;
  end loop;

  insert into public.menus(name, slug, location, is_active)
  values ('Development Footer Navigation', 'development-footer', 'footer', true)
  on conflict (slug) do update set
    name = excluded.name,
    location = excluded.location,
    is_active = excluded.is_active
  returning id into v_footer_menu_id;

  for v_item in select * from (values
    ('الرئيسية', '/', 10),
    ('من نحن', '/about', 20),
    ('تواصل معنا', '/contact', 30)
  ) source(label, href, sort_order)
  loop
    if not exists (
      select 1 from public.menu_items item
      where item.menu_id = v_footer_menu_id and item.href = v_item.href
    ) then
      perform public.mutate_menu_tree(
        v_footer_menu_id,
        'save_item',
        jsonb_build_object('item', jsonb_build_object(
          'label', v_item.label,
          'item_type', 'custom',
          'href', v_item.href,
          'sort_order', v_item.sort_order,
          'is_visible', true
        )),
        null,
        'system:local-development-seed'
      );
    end if;
  end loop;

  perform public.save_footer_settings(
    jsonb_build_array(
      jsonb_build_object('key', 'footer.slots', 'value', jsonb_build_object(
        'version', 1,
        'slots', jsonb_build_array(
          jsonb_build_object('index', 1, 'type', 'text', 'enabled', true, 'heading', 'Venesia Development',
            'config', jsonb_build_object('title', 'بيئة تطوير محلية', 'body', 'بيانات صناعية آمنة للتطوير.',
              'showBrandIcon', true, 'cta', jsonb_build_object('enabled', false, 'label', '', 'href', '', 'target', '_self'))),
          jsonb_build_object('index', 2, 'type', 'menu', 'enabled', true, 'heading', 'روابط',
            'config', jsonb_build_object('source', 'location', 'location', 'footer', 'fallbackLocation', 'footer',
              'menuId', null, 'maxItems', null, 'showOnlyTopLevel', true)),
          jsonb_build_object('index', 3, 'type', 'media', 'enabled', false, 'heading', null,
            'config', jsonb_build_object('source', 'main_submenu', 'parentHref', '/media-center',
              'parentLink', null, 'menuId', null, 'maxItems', null, 'manualLinks', jsonb_build_array())),
          jsonb_build_object('index', 4, 'type', 'contact', 'enabled', true, 'heading', 'تواصل معنا',
            'config', jsonb_build_object('source', 'global', 'items', jsonb_build_array()))
        )
      )),
      jsonb_build_object('key', 'footer.contact_items', 'value', jsonb_build_array(
        jsonb_build_object('label', 'الهاتف', 'value', '15875', 'href', 'tel:15875', 'visible', true)
      )),
      jsonb_build_object('key', 'footer.legal', 'value', jsonb_build_object(
        'copyright', 'Venesia Development — Local Development',
        'tagline', 'بيانات صناعية محلية'
      ))
    ),
    null,
    'system:local-development-seed',
    'local-development.footer.seed',
    '{"fixture":"local-development"}'::jsonb
  );
end;
$development_navigation$;

insert into public.pages(title, slug, path, page_type, status, sort_order)
values
  ('من نحن — Development', 'about', '/about', 'static', 'published', 20),
  ('تواصل معنا — Development', 'contact', '/contact', 'contact', 'published', 30),
  ('الموضوعات — Development', 'topics', '/topics', 'static', 'published', 40)
on conflict (slug) do update set
  title = excluded.title,
  path = excluded.path,
  page_type = excluded.page_type,
  status = excluded.status;

update public.pages set status = 'published' where slug = 'home';
update public.pages set status = 'published' where slug = 'topics';

do $development_topics_search$
declare
  v_page_id bigint;
  v_template_id bigint;
begin
  select id into strict v_page_id from public.pages where slug = 'topics';
  select id into strict v_template_id from public.content_block_templates where slug = 'topics-search';

  if not exists (
    select 1 from public.page_content_block_assignments
    where page_id = v_page_id and template_id = v_template_id
  ) then
    perform public.mutate_page_composition(
      v_page_id,
      'save_assignment',
      jsonb_build_object(
        'kind', 'content',
        'template_id', v_template_id,
        'slot', 'sidebar',
        'sort_order', 10,
        'is_visible', true
      ),
      null,
      'system:local-development-seed'
    );
  end if;
end;
$development_topics_search$;

-- Exercise the canonical Project publication owner instead of bypassing the
-- readiness and first-publish contract with a direct fixture update.
select * from public.set_project_publication_admin_entry(
  (select id from public.projects order by id limit 1),
  true,
  (select id from public.admin_users where is_active order by id limit 1)
);

insert into public.page_content_block_assignments(page_id, template_id, slot, sort_order, is_visible)
select page.id, template.id, 'main', source.sort_order, true
from (values
  ('home', 'home-story', 10),
  ('home', 'home-projects', 20),
  ('home', 'home-trust', 30),
  ('home', 'home-contact', 40),
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
