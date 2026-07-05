-- Phase 1: Unified Content Engine — add content_type to topics.
-- All existing rows default to 'article'. No category seed, no media migration.

begin;

alter table public.topics
  add column if not exists content_type text not null default 'article';

update public.topics
set content_type = 'article'
where content_type is null
   or content_type = '';

alter table public.topics
  alter column content_type set default 'article';

alter table public.topics
  alter column content_type set not null;

alter table public.topics
  drop constraint if exists topics_content_type_check;

alter table public.topics
  add constraint topics_content_type_check check (
    content_type = any (
      array[
        'article'::text,
        'news'::text,
        'video'::text,
        'gallery'::text,
        'press'::text,
        'site_update'::text
      ]
    )
  );

create index if not exists topics_content_type_idx
  on public.topics (content_type);

commit;
