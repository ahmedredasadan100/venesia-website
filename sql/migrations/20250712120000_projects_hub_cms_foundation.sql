-- Projects Hub CMS foundation
-- Registers /projects as a seeded system hub page + four content module templates
-- and initial main-slot assignments matching the current public Projects Hub order.
-- Idempotent: safe to re-run (upserts by slug / page_id+template_id).
-- Does not change public App Router rendering for /projects.

begin;

-- A. Projects Hub system page
insert into public.pages (title, slug, path, page_type, status, is_system, sort_order)
values (
  'المشروعات',
  'projects',
  '/projects',
  'hub',
  'published',
  true,
  30
)
on conflict (slug) do update set
  title = excluded.title,
  path = excluded.path,
  page_type = excluded.page_type,
  status = excluded.status,
  is_system = true,
  sort_order = excluded.sort_order,
  updated_at = now();

-- B. Module templates (presentation/selection defaults only — no project row data)
insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'هيرو صفحة المشروعات',
    'projects-hub-hero',
    'هيرو صفحة /projects — الشرائح تُحمَّل من جدول projects',
    'projects-hub-hero',
    'premium-dark',
    'published',
    $json${
      "selectionMode": "auto_residential_with_media",
      "autoplayMs": 6000,
      "emptyState": null
    }$json$::jsonb,
    10
  ),
  (
    'المشروعات المميزة',
    'projects-hub-featured',
    'سكشن المشروعات المميزة على /projects — البطاقات من projects.featured',
    'projects-hub-featured',
    'premium-dark',
    'published',
    $json${
      "selectionMode": "featured_flag",
      "title": "مشروع مميز",
      "subtitle": "اختيار يعكس مسار التنفيذ على الأرض",
      "limit": null,
      "autoplayMs": 6000
    }$json$::jsonb,
    20
  ),
  (
    'قائمة المشروعات',
    'projects-hub-listing',
    'فهرس المشروعات مع الفلاتر على /projects',
    'projects-hub-listing',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Projects Index",
      "title": "جميع المشروعات",
      "defaultFilter": "all",
      "visibleFilters": ["all", "residential", "commercial"],
      "defaultView": "list",
      "pageSize": 6,
      "sort": "homepage_order"
    }$json$::jsonb,
    30
  ),
  (
    'خريطة المشروعات',
    'projects-hub-map',
    'خريطة بيت الوطن وربط الدبابيس بكود المشروع',
    'projects-hub-map',
    'premium-dark',
    'published',
    $json${
      "title": "مشروعاتنا على الخريطة",
      "mapImage": "/images/projects/beit-elwatan-map1.webp",
      "exploreButtonLabel": "استكشف على الخريطة",
      "mapPins": [
        { "code": "I87", "district": "الحي الأول", "right": "20%", "top": "50%" },
        { "code": "I76", "district": "الحي الأول", "right": "27%", "top": "45%" },
        { "code": "B84", "district": "الحي الأول", "right": "34%", "top": "52%" },
        { "code": "C35", "district": "الحي الثاني", "right": "50%", "top": "46%" },
        { "code": "J118", "district": "الحي الثاني", "right": "57%", "top": "53%" },
        { "code": "J191", "district": "الحي الثاني", "right": "63%", "top": "46%" },
        { "code": "F92", "district": "الحي الرابع", "right": "45%", "top": "72%" },
        { "code": "F222", "district": "الحي الرابع", "right": "55%", "top": "74%" },
        { "code": "D174", "district": "النورث هاوس", "right": "38%", "top": "25%" },
        { "code": "B137", "district": "النورث هاوس", "right": "48%", "top": "21%" },
        { "code": "B138", "district": "النورث هاوس", "right": "58%", "top": "27%" }
      ]
    }$json$::jsonb,
    40
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

-- C. Initial assignments (order matches current public ProjectsHubPage)
insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, true
from public.pages p
join public.content_block_templates t on t.slug = 'projects-hub-hero'
where p.slug = 'projects'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 20, true
from public.pages p
join public.content_block_templates t on t.slug = 'projects-hub-featured'
where p.slug = 'projects'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 30, true
from public.pages p
join public.content_block_templates t on t.slug = 'projects-hub-listing'
where p.slug = 'projects'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 40, true
from public.pages p
join public.content_block_templates t on t.slug = 'projects-hub-map'
where p.slug = 'projects'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
