-- Media Center CMS pages — shell routes for hero assignments and optional page blocks.
-- Core content (hub modules, listings, details) remains media_items-driven in code.
-- Idempotent: upserts by slug.

begin;

insert into public.pages (title, slug, path, page_type, status)
values
  ('المركز الإعلامي', 'media-center', '/media-center', 'hub', 'published'),
  ('المركز الإعلامي — الأخبار', 'media-center-news', '/media-center/news', 'static', 'published'),
  ('المركز الإعلامي — الفيديوهات', 'media-center-videos', '/media-center/videos', 'static', 'published'),
  ('المركز الإعلامي — معرض الصور', 'media-center-gallery', '/media-center/gallery', 'static', 'published'),
  ('المركز الإعلامي — الصحافة', 'media-center-press', '/media-center/press', 'static', 'published'),
  ('المركز الإعلامي — تحديثات المواقع', 'media-center-site-updates', '/media-center/site-updates', 'static', 'published')
on conflict (slug) do update set
  title = excluded.title,
  path = excluded.path,
  page_type = excluded.page_type,
  status = excluded.status,
  updated_at = now();

commit;
