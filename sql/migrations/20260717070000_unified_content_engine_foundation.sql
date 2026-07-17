-- Unified Content Engine foundation (non-destructive).
-- Adds category tones, topic actors/views, per-admin preferences, a read model,
-- and an atomic public-view increment function. Existing content is preserved.

begin;

alter table public.topic_categories
  add column if not exists color_token text;

update public.topic_categories
set color_token = (
  array['gold', 'sky', 'blue', 'cyan', 'emerald', 'amber', 'orange', 'rose', 'violet', 'slate']
)[1 + mod(abs(id), 10)]
where color_token is null
   or color_token not in ('gold', 'sky', 'blue', 'cyan', 'emerald', 'amber', 'orange', 'rose', 'violet', 'slate');

alter table public.topic_categories
  alter column color_token set default 'slate',
  alter column color_token set not null;

alter table public.topic_categories
  drop constraint if exists topic_categories_color_token_check;

alter table public.topic_categories
  add constraint topic_categories_color_token_check check (
    color_token in ('gold', 'sky', 'blue', 'cyan', 'emerald', 'amber', 'orange', 'rose', 'violet', 'slate')
  );

comment on column public.topic_categories.color_token is
  'Semantic admin badge tone. Never stores CSS classes or arbitrary colors.';

alter table public.topics
  add column if not exists created_by bigint null,
  add column if not exists updated_by bigint null,
  add column if not exists published_by bigint null,
  add column if not exists views_count bigint not null default 0;

alter table public.topics
  drop constraint if exists topics_views_count_nonnegative;

alter table public.topics
  add constraint topics_views_count_nonnegative check (views_count >= 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'topics_created_by_fkey'
      and conrelid = 'public.topics'::regclass
  ) then
    alter table public.topics
      add constraint topics_created_by_fkey
      foreign key (created_by) references public.admin_users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'topics_updated_by_fkey'
      and conrelid = 'public.topics'::regclass
  ) then
    alter table public.topics
      add constraint topics_updated_by_fkey
      foreign key (updated_by) references public.admin_users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'topics_published_by_fkey'
      and conrelid = 'public.topics'::regclass
  ) then
    alter table public.topics
      add constraint topics_published_by_fkey
      foreign key (published_by) references public.admin_users(id) on delete set null;
  end if;
end
$$;

create index if not exists topics_created_by_idx on public.topics (created_by);
create index if not exists topics_updated_by_idx on public.topics (updated_by);
create index if not exists topics_published_by_idx on public.topics (published_by);
create index if not exists topics_views_count_idx on public.topics (views_count);

-- Evidence-based actor backfill only. Unknown historical actors remain NULL.
-- A publish actor is accepted only from an audit row tied to the same topic.
with latest_publish as (
  select distinct on (logs.entity_id)
    logs.entity_id,
    logs.actor_admin_user_id
  from public.admin_audit_logs logs
  join public.admin_users actor on actor.id = logs.actor_admin_user_id
  where logs.entity_type = 'topic'
    and logs.action = 'topic.publish'
    and logs.entity_id is not null
    and logs.actor_admin_user_id is not null
  order by logs.entity_id, logs.created_at desc, logs.id desc
)
update public.topics topics
set published_by = latest_publish.actor_admin_user_id
from latest_publish
where topics.id = latest_publish.entity_id
  and topics.published_by is null
  and topics.status = 'published';

create table if not exists public.admin_user_preferences (
  admin_user_id bigint not null references public.admin_users(id) on delete cascade,
  view_key text not null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (admin_user_id, view_key),
  constraint admin_user_preferences_view_key_check check (length(btrim(view_key)) between 1 and 120),
  constraint admin_user_preferences_object_check check (jsonb_typeof(preferences) = 'object')
);

alter table public.admin_user_preferences enable row level security;

comment on table public.admin_user_preferences is
  'Server-managed admin UI preferences, isolated by stable admin user ID and view key.';

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
  topics.faq,
  topics.date_label
from public.topics topics
left join public.topic_categories categories on categories.id = topics.category_id
left join public.topic_series series on series.id = topics.series_id
left join public.admin_users creator on creator.id = topics.created_by
left join public.admin_users updater on updater.id = topics.updated_by
left join public.admin_users publisher on publisher.id = topics.published_by;

comment on view public.admin_content_topics is
  'Unified admin read model for topics with database-owned taxonomy and actor display names.';

create or replace function public.increment_topic_view(p_topic_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_count bigint;
begin
  update public.topics
  set views_count = views_count + 1
  where id = p_topic_id
    and status = 'published'
    and deleted_at is null
  returning views_count into next_count;

  return next_count;
end;
$$;

comment on function public.increment_topic_view(bigint) is
  'Atomically increments a published, non-deleted topic view. Returns NULL when the topic is not publicly viewable.';

revoke all on function public.increment_topic_view(bigint) from public;
revoke all on function public.increment_topic_view(bigint) from anon;
revoke all on function public.increment_topic_view(bigint) from authenticated;
grant execute on function public.increment_topic_view(bigint) to service_role;

commit;

-- Manual rollback (only after confirming no deployed code depends on these contracts):
-- begin;
-- drop function if exists public.increment_topic_view(bigint);
-- drop view if exists public.admin_content_topics;
-- drop table if exists public.admin_user_preferences;
-- alter table public.topics
--   drop constraint if exists topics_created_by_fkey,
--   drop constraint if exists topics_updated_by_fkey,
--   drop constraint if exists topics_published_by_fkey,
--   drop constraint if exists topics_views_count_nonnegative,
--   drop column if exists created_by,
--   drop column if exists updated_by,
--   drop column if exists published_by,
--   drop column if exists views_count;
-- alter table public.topic_categories
--   drop constraint if exists topic_categories_color_token_check,
--   drop column if exists color_token;
-- commit;
