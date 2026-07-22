-- Per-topic SEO overrides. NULL means "inherit the global SEO setting".
-- The global robots defaults remain index=true and follow=true, preserving
-- the effective behavior of existing topics without duplicating global data.

alter table public.topics
  add column if not exists canonical_url text,
  add column if not exists robots_index boolean,
  add column if not exists robots_follow boolean;

comment on column public.topics.canonical_url is
  'Optional topic canonical URL override. NULL uses the generated public topic URL.';

comment on column public.topics.robots_index is
  'Optional topic robots index override. NULL inherits seo.global.defaultRobotsIndex.';

comment on column public.topics.robots_follow is
  'Optional topic robots follow override. NULL inherits seo.global.defaultRobotsFollow.';
