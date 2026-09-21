-- Synthetic local-development content installed before Entity SEO ENFORCE.
-- The canonical TypeScript backfill derives the score tuple after this seed.
begin;

do $development_feed$
declare
  v_category_id bigint;
  v_series_id bigint;
begin
  insert into public.topic_categories
    (name, slug, description, sort_order, is_active, status, published_at)
  values
    ('Development Articles', 'development-articles', 'Synthetic local development category.', 900, true, 'published', now())
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    is_active = excluded.is_active,
    status = excluded.status,
    published_at = excluded.published_at
  returning id into v_category_id;

  insert into public.topic_series
    (name, slug, description, status, sort_order, category_id)
  values
    ('Development Series', 'development-series', 'Synthetic local development series.', 'published', 900, v_category_id)
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    category_id = excluded.category_id
  returning id into v_series_id;

  insert into public.topics
    (slug, title, excerpt, content, image, image_alt, category, category_slug,
     category_id, series, series_slug, series_id, date_label, published_at,
     content_type, status, seo_title, seo_description, focus_keyword)
  values
    ('development-series-first', 'Development Series First', 'Synthetic published article.',
     '<p>Synthetic local development content.</p>', '/images/placeholder.jpg', 'Synthetic image',
     'Development Articles', 'development-articles', v_category_id,
     'Development Series', 'development-series', v_series_id, 'Development',
     '2026-01-01T09:00:00Z', 'article', 'published', 'Development Series First',
     'Synthetic published article for local development.', 'development'),
    ('development-series-latest', 'Development Series Latest', 'Synthetic latest published article.',
     '<p>Synthetic local development content.</p>', '/images/placeholder.jpg', 'Synthetic image',
     'Development Articles', 'development-articles', v_category_id,
     'Development Series', 'development-series', v_series_id, 'Development',
     '2026-02-01T09:00:00Z', 'article', 'published', 'Development Series Latest',
     'Synthetic latest article for local development.', 'development'),
    ('development-series-hidden', 'Development Series Hidden', 'Synthetic unpublished article.',
     '<p>Synthetic hidden local development content.</p>', '/images/placeholder.jpg', 'Synthetic image',
     'Development Articles', 'development-articles', v_category_id,
     'Development Series', 'development-series', v_series_id, 'Development',
     null, 'article', 'unpublished', 'Development Series Hidden',
     'Synthetic unpublished article for local development.', 'development')
  on conflict (slug) do update set
    title = excluded.title,
    excerpt = excluded.excerpt,
    content = excluded.content,
    image = excluded.image,
    image_alt = excluded.image_alt,
    category = excluded.category,
    category_slug = excluded.category_slug,
    category_id = excluded.category_id,
    series = excluded.series,
    series_slug = excluded.series_slug,
    series_id = excluded.series_id,
    date_label = excluded.date_label,
    published_at = excluded.published_at,
    content_type = excluded.content_type,
    status = excluded.status,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    focus_keyword = excluded.focus_keyword,
    seo_score = null,
    seo_score_version = null,
    seo_score_input_hash = null;
end;
$development_feed$;

commit;
