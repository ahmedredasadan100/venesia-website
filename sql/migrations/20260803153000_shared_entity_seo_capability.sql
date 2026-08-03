-- Final Entity SEO data contract shared by Projects, Topics (article + media), and Pages.
-- The contract deliberately matches the existing Project aggregate schema:
-- title/description/focus/keywords are non-null values, canonical/robots/OG image
-- remain nullable overrides, and OG alt is required whenever an override image exists.

begin;

alter table public.topics
  add column if not exists og_image text,
  add column if not exists og_image_alt text;

alter table public.pages
  add column if not exists focus_keyword text,
  add column if not exists canonical_url text,
  add column if not exists robots_index boolean,
  add column if not exists robots_follow boolean,
  add column if not exists og_image text,
  add column if not exists og_image_alt text;

-- Pages and Topics historically stored keywords as jsonb while Projects used text[].
-- Convert the historical arrays once so all eligible entities expose one SQL type.
-- PostgreSQL cannot alter the Topic column while its Admin read model depends on it;
-- rebuild that existing read model in the same transaction and preserve its ACL.
drop view public.admin_content_topics;

create function public.__entity_seo_jsonb_to_text_array(value jsonb)
returns text[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(
    array(
      select item.keyword
      from jsonb_array_elements_text(
        case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
      ) as item(keyword)
    ),
    '{}'::text[]
  );
$$;

alter table public.topics alter column seo_keywords drop default;
alter table public.topics
  alter column seo_keywords type text[]
  using public.__entity_seo_jsonb_to_text_array(seo_keywords);

alter table public.pages alter column seo_keywords drop default;
alter table public.pages
  alter column seo_keywords type text[]
  using public.__entity_seo_jsonb_to_text_array(seo_keywords);

drop function public.__entity_seo_jsonb_to_text_array(jsonb);

create view public.admin_content_topics
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
  topics.date_label
from public.topics topics
left join public.topic_categories categories on categories.id = topics.category_id
left join public.topic_series series on series.id = topics.series_id
left join public.admin_users creator on creator.id = topics.created_by
left join public.admin_users updater on updater.id = topics.updated_by
left join public.admin_users publisher on publisher.id = topics.published_by;

comment on view public.admin_content_topics is
  'Unified admin read model for topics with database-owned taxonomy, actor display names, and the final Entity SEO contract.';

grant all on public.admin_content_topics to anon, authenticated, service_role;

-- Normalize historical values before enforcing the final shared constraints.
update public.topics
set
  seo_title = left(coalesce(seo_title, ''), 60),
  seo_description = left(coalesce(seo_description, ''), 160),
  focus_keyword = coalesce(focus_keyword, ''),
  seo_keywords = coalesce(seo_keywords, '{}'::text[]),
  canonical_url = case
    when canonical_url is null or canonical_url ~* '^https?://' then canonical_url
    else null
  end,
  og_image_alt = case
    when og_image is null then coalesce(og_image_alt, '')
    else coalesce(nullif(btrim(og_image_alt), ''), nullif(btrim(image_alt), ''), title)
  end;

update public.pages
set
  seo_title = left(coalesce(seo_title, ''), 60),
  seo_description = left(coalesce(seo_description, ''), 160),
  focus_keyword = coalesce(focus_keyword, ''),
  seo_keywords = coalesce(seo_keywords, '{}'::text[]),
  canonical_url = case
    when canonical_url is null or canonical_url ~* '^https?://' then canonical_url
    else null
  end,
  og_image_alt = case
    when og_image is null then coalesce(og_image_alt, '')
    else coalesce(nullif(btrim(og_image_alt), ''), nullif(btrim(seo_title), ''), title)
  end;

alter table public.topics
  alter column seo_title set default '',
  alter column seo_title set not null,
  alter column seo_description set default '',
  alter column seo_description set not null,
  alter column focus_keyword set default '',
  alter column focus_keyword set not null,
  alter column seo_keywords set default '{}'::text[],
  alter column seo_keywords set not null,
  alter column og_image_alt set default '',
  alter column og_image_alt set not null;

alter table public.pages
  alter column seo_title set default '',
  alter column seo_title set not null,
  alter column seo_description set default '',
  alter column seo_description set not null,
  alter column focus_keyword set default '',
  alter column focus_keyword set not null,
  alter column seo_keywords set default '{}'::text[],
  alter column seo_keywords set not null,
  alter column og_image_alt set default '',
  alter column og_image_alt set not null;

alter table public.topics
  drop constraint if exists topics_seo_title_check,
  drop constraint if exists topics_seo_description_check,
  drop constraint if exists topics_canonical_url_check,
  drop constraint if exists topics_og_image_alt_check,
  add constraint topics_seo_title_check check (char_length(seo_title) <= 60),
  add constraint topics_seo_description_check check (char_length(seo_description) <= 160),
  add constraint topics_canonical_url_check check (canonical_url is null or canonical_url ~* '^https?://'),
  add constraint topics_og_image_alt_check check (og_image is null or btrim(og_image_alt) <> '');

alter table public.pages
  drop constraint if exists pages_seo_title_check,
  drop constraint if exists pages_seo_description_check,
  drop constraint if exists pages_canonical_url_check,
  drop constraint if exists pages_og_image_alt_check,
  add constraint pages_seo_title_check check (char_length(seo_title) <= 60),
  add constraint pages_seo_description_check check (char_length(seo_description) <= 160),
  add constraint pages_canonical_url_check check (canonical_url is null or canonical_url ~* '^https?://'),
  add constraint pages_og_image_alt_check check (og_image is null or btrim(og_image_alt) <> '');

comment on column public.topics.og_image is 'Optional Entity SEO Open Graph image override; null falls back to the topic content image, then the global image.';
comment on column public.topics.og_image_alt is 'Alt text paired with the optional Entity SEO Open Graph image override.';
comment on column public.pages.focus_keyword is 'Primary analysis keyword for the shared Entity SEO capability.';
comment on column public.pages.canonical_url is 'Optional Entity SEO canonical override; null uses the generated public page URL.';
comment on column public.pages.robots_index is 'Optional Entity SEO index override; null inherits the global default.';
comment on column public.pages.robots_follow is 'Optional Entity SEO follow override; null inherits the global default.';
comment on column public.pages.og_image is 'Optional Entity SEO Open Graph image override; null falls back to the global image.';
comment on column public.pages.og_image_alt is 'Alt text paired with the optional Entity SEO Open Graph image override.';

commit;
