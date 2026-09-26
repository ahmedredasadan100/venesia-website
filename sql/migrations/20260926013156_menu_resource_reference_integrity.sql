-- Generated projections of the existing typed Menu link, never a second registry.
-- Native foreign keys coordinate reference creation and target deletion in both
-- directions, including READ COMMITTED and REPEATABLE READ transactions.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.menu_items
  add column linked_page_id bigint generated always as
    (case when linked_type = 'pages' then linked_id end) stored,
  add column linked_project_id bigint generated always as
    (case when linked_type = 'projects' then linked_id end) stored,
  add column linked_topic_id bigint generated always as
    (case when linked_type = 'topics' then linked_id end) stored,
  add column linked_category_id bigint generated always as
    (case when linked_type = 'topic_categories' then linked_id end) stored,
  add column linked_series_id bigint generated always as
    (case when linked_type = 'topic_series' then linked_id end) stored;

-- A pre-existing dangling link stops the whole migration; no data is silently
-- deleted, rewritten, or grandfathered into an unvalidated constraint.
alter table public.menu_items
  add constraint menu_items_linked_page_fkey foreign key (linked_page_id)
    references public.pages(id) on delete restrict,
  add constraint menu_items_linked_project_fkey foreign key (linked_project_id)
    references public.projects(id) on delete restrict,
  add constraint menu_items_linked_topic_fkey foreign key (linked_topic_id)
    references public.topics(id) on delete restrict,
  add constraint menu_items_linked_category_fkey foreign key (linked_category_id)
    references public.topic_categories(id) on delete restrict,
  add constraint menu_items_linked_series_fkey foreign key (linked_series_id)
    references public.topic_series(id) on delete restrict;

create index menu_items_linked_page_idx on public.menu_items(linked_page_id)
  where linked_page_id is not null;
create index menu_items_linked_project_idx on public.menu_items(linked_project_id)
  where linked_project_id is not null;
create index menu_items_linked_topic_idx on public.menu_items(linked_topic_id)
  where linked_topic_id is not null;
create index menu_items_linked_category_idx on public.menu_items(linked_category_id)
  where linked_category_id is not null;
create index menu_items_linked_series_idx on public.menu_items(linked_series_id)
  where linked_series_id is not null;

comment on column public.menu_items.linked_topic_id is
  'Generated from canonical linked_type/linked_id; native FK protects every Topic purge and typed Menu write.';
select pg_catalog.pg_notify('pgrst', 'reload schema');
commit;
