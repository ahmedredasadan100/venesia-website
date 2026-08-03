-- Complete the unified Admin content read model with the shared publishing and
-- display-settings contract already owned by public.topics. No data backfill is
-- needed because the display columns are NOT NULL with preserving defaults.

begin;

create or replace view public.admin_content_topics
with (security_invoker = true)
as
select
  topics.id,
  topics.slug,
  topics.title,
  topics.excerpt,
  topics.content,
  topics.image,
  topics.image_alt,
  topics.category_id,
  categories.name as category_name,
  categories.slug as category_slug,
  categories.color_token as category_color_token,
  topics.series_id,
  series.name as series_name,
  series.slug as series_slug,
  topics.content_type,
  topics.media_payload,
  topics.status,
  topics.is_featured,
  topics.is_popular,
  topics.published_at,
  topics.created_at,
  topics.updated_at,
  topics.created_by,
  coalesce(creator.full_name, creator.email) as created_by_display,
  topics.updated_by,
  coalesce(updater.full_name, updater.email) as updated_by_display,
  topics.published_by,
  coalesce(publisher.full_name, publisher.email) as published_by_display,
  topics.views_count,
  topics.deleted_at,
  topics.seo_title,
  topics.seo_description,
  topics.seo_keywords,
  topics.focus_keyword,
  topics.canonical_url,
  topics.robots_index,
  topics.robots_follow,
  topics.og_image,
  topics.og_image_alt,
  topics.faq,
  topics.date_label,
  topics.show_title_on_page,
  topics.show_image_on_page,
  topics.show_excerpt_on_page
from public.topics topics
left join public.topic_categories categories on categories.id = topics.category_id
left join public.topic_series series on series.id = topics.series_id
left join public.admin_users creator on creator.id = topics.created_by
left join public.admin_users updater on updater.id = topics.updated_by
left join public.admin_users publisher on publisher.id = topics.published_by;

comment on view public.admin_content_topics is
  'Unified Admin topics read model including taxonomy, audit, Entity SEO, publishing, and shared public display settings.';

grant all on public.admin_content_topics to anon, authenticated, service_role;

commit;
