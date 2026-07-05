-- Phase 2: Unified Content Engine — seed media-center branch in topic_categories.
-- Idempotent. Does not touch media_items or media_categories.

begin;

insert into public.topic_categories (
  name,
  slug,
  parent_id,
  sort_order,
  is_active,
  status,
  show_in_menu,
  is_featured
)
values (
  'المركز الإعلامي',
  'media-center',
  null,
  20,
  true,
  'published',
  true,
  false
)
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  status = excluded.status,
  show_in_menu = excluded.show_in_menu,
  is_featured = excluded.is_featured,
  updated_at = now();

insert into public.topic_categories (name, slug, parent_id, sort_order, is_active, status, show_in_menu, is_featured)
select seed.name, seed.slug, parent.id, seed.sort_order, true, 'published', true, false
from public.topic_categories parent
cross join (
  values
    ('الأخبار', 'media-news', 1),
    ('من أرض التنفيذ', 'media-site-updates', 2),
    ('الفيديوهات', 'media-videos', 3),
    ('البيانات الصحفية', 'media-press', 4),
    ('معرض الصور', 'media-gallery', 5)
) as seed(name, slug, sort_order)
where parent.slug = 'media-center'
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  status = excluded.status,
  show_in_menu = excluded.show_in_menu,
  is_featured = excluded.is_featured,
  updated_at = now();

commit;
