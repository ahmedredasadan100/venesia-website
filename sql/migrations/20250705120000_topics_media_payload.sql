-- Phase 3C: structured rich media payload on topics (video/gallery admin only).

begin;

alter table public.topics
  add column if not exists media_payload jsonb null;

comment on column public.topics.media_payload is
  'Structured payload for rich media types video/gallery. Null for article/news/press/site_update.';

commit;
