-- Phase 3D: Unified Media clean seed — 50 draft rows in topics only.
-- Idempotent via ON CONFLICT (slug) DO NOTHING (never overwrites admin edits).
-- Apply manually in Supabase SQL Editor. Does not touch media_items or media_categories.

begin;

-- 10 news (media_payload = null)
insert into public.topics (
  slug,
  title,
  excerpt,
  content,
  image,
  category,
  category_slug,
  category_id,
  content_type,
  media_payload,
  series_id,
  series,
  series_slug,
  date_label,
  status,
  published_at,
  is_featured,
  is_popular,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  faq,
  image_alt,
  deleted_at,
  created_at,
  updated_at
)
select
  'unified-media-news-' || lpad(gs.n::text, 2, '0'),
  'خبر seed — Venesia Unified Media ' || lpad(gs.n::text, 2, '0'),
  'ملخص seed للاختبار الإداري — خبر ' || lpad(gs.n::text, 2, '0'),
  '# خبر seed ' || lpad(gs.n::text, 2, '0') || E'\n\nمحتوى seed للاختبار الإداري فقط. يمكن تعديله من /admin/content/media.',
  '',
  cat.name,
  cat.slug,
  cat.id,
  'news',
  null,
  null,
  null,
  null,
  null,
  'draft',
  null,
  false,
  false,
  null,
  null,
  '[]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  now(),
  now()
from generate_series(1, 10) as gs(n)
cross join public.topic_categories cat
where cat.slug = 'media-news'
on conflict (slug) do nothing;

-- 10 press (media_payload = null)
insert into public.topics (
  slug,
  title,
  excerpt,
  content,
  image,
  category,
  category_slug,
  category_id,
  content_type,
  media_payload,
  series_id,
  series,
  series_slug,
  date_label,
  status,
  published_at,
  is_featured,
  is_popular,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  faq,
  image_alt,
  deleted_at,
  created_at,
  updated_at
)
select
  'unified-media-press-' || lpad(gs.n::text, 2, '0'),
  'بيان صحفي seed — Venesia Unified Media ' || lpad(gs.n::text, 2, '0'),
  'ملخص seed للاختبار الإداري — بيان صحفي ' || lpad(gs.n::text, 2, '0'),
  '# بيان صحفي seed ' || lpad(gs.n::text, 2, '0') || E'\n\nمحتوى seed للاختبار الإداري فقط. يمكن تعديله من /admin/content/media.',
  '',
  cat.name,
  cat.slug,
  cat.id,
  'press',
  null,
  null,
  null,
  null,
  null,
  'draft',
  null,
  false,
  false,
  null,
  null,
  '[]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  now(),
  now()
from generate_series(1, 10) as gs(n)
cross join public.topic_categories cat
where cat.slug = 'media-press'
on conflict (slug) do nothing;

-- 10 site_update (media_payload = null)
insert into public.topics (
  slug,
  title,
  excerpt,
  content,
  image,
  category,
  category_slug,
  category_id,
  content_type,
  media_payload,
  series_id,
  series,
  series_slug,
  date_label,
  status,
  published_at,
  is_featured,
  is_popular,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  faq,
  image_alt,
  deleted_at,
  created_at,
  updated_at
)
select
  'unified-media-site-update-' || lpad(gs.n::text, 2, '0'),
  'من أرض التنفيذ seed — Venesia Unified Media ' || lpad(gs.n::text, 2, '0'),
  'ملخص seed للاختبار الإداري — من أرض التنفيذ ' || lpad(gs.n::text, 2, '0'),
  '# من أرض التنفيذ seed ' || lpad(gs.n::text, 2, '0') || E'\n\nمحتوى seed للاختبار الإداري فقط. يمكن تعديله من /admin/content/media.',
  '',
  cat.name,
  cat.slug,
  cat.id,
  'site_update',
  null,
  null,
  null,
  null,
  null,
  'draft',
  null,
  false,
  false,
  null,
  null,
  '[]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  now(),
  now()
from generate_series(1, 10) as gs(n)
cross join public.topic_categories cat
where cat.slug = 'media-site-updates'
on conflict (slug) do nothing;

-- 10 video (structured media_payload — empty draft payload, no placeholder URLs)
insert into public.topics (
  slug,
  title,
  excerpt,
  content,
  image,
  category,
  category_slug,
  category_id,
  content_type,
  media_payload,
  series_id,
  series,
  series_slug,
  date_label,
  status,
  published_at,
  is_featured,
  is_popular,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  faq,
  image_alt,
  deleted_at,
  created_at,
  updated_at
)
select
  'unified-media-video-' || lpad(gs.n::text, 2, '0'),
  'فيديو seed — Venesia Unified Media ' || lpad(gs.n::text, 2, '0'),
  'ملخص seed للاختبار الإداري — فيديو ' || lpad(gs.n::text, 2, '0'),
  '',
  '',
  cat.name,
  cat.slug,
  cat.id,
  'video',
  jsonb_build_object(
    'kind', 'video',
    'provider', 'youtube',
    'video_url', '',
    'thumbnail', null,
    'duration', null
  ),
  null,
  null,
  null,
  null,
  'draft',
  null,
  false,
  false,
  null,
  null,
  '[]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  now(),
  now()
from generate_series(1, 10) as gs(n)
cross join public.topic_categories cat
where cat.slug = 'media-videos'
on conflict (slug) do nothing;

-- 10 gallery (structured media_payload — empty images array, no placeholder paths)
insert into public.topics (
  slug,
  title,
  excerpt,
  content,
  image,
  category,
  category_slug,
  category_id,
  content_type,
  media_payload,
  series_id,
  series,
  series_slug,
  date_label,
  status,
  published_at,
  is_featured,
  is_popular,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  faq,
  image_alt,
  deleted_at,
  created_at,
  updated_at
)
select
  'unified-media-gallery-' || lpad(gs.n::text, 2, '0'),
  'معرض seed — Venesia Unified Media ' || lpad(gs.n::text, 2, '0'),
  'ملخص seed للاختبار الإداري — معرض صور ' || lpad(gs.n::text, 2, '0'),
  '',
  '',
  cat.name,
  cat.slug,
  cat.id,
  'gallery',
  jsonb_build_object(
    'kind', 'gallery',
    'images', '[]'::jsonb
  ),
  null,
  null,
  null,
  null,
  'draft',
  null,
  false,
  false,
  null,
  null,
  '[]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  now(),
  now()
from generate_series(1, 10) as gs(n)
cross join public.topic_categories cat
where cat.slug = 'media-gallery'
on conflict (slug) do nothing;

commit;
