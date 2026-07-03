-- Direct Series → Category relation via topic_series.category_id

begin;

alter table public.topic_series
  add column if not exists category_id bigint
  references public.topic_categories (id)
  on delete restrict;

create index if not exists topic_series_category_id_idx
  on public.topic_series (category_id);

-- Backfill from existing topics (most common category_id per series)
update public.topic_series ts
set category_id = sub.category_id
from (
  select
    t.series_id,
    mode() within group (order by t.category_id) as category_id
  from public.topics t
  where t.series_id is not null
    and t.category_id is not null
    and t.deleted_at is null
  group by t.series_id
) sub
where ts.id = sub.series_id
  and ts.category_id is null;

commit;
