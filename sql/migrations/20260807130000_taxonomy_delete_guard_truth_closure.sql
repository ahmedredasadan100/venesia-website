begin;

-- Delete guards must use current domain truth. Active topics block taxonomy
-- deletion; soft-deleted topics are retained as tombstones, but their optional
-- taxonomy references are detached atomically when the referenced owner is
-- removed. Foreign keys remain authoritative throughout the mutation.

do $taxonomy_delete_guard_preflight$
begin
  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conname = 'topics_series_id_fkey'
      and constraint_record.conrelid = 'public.topics'::regclass
      and constraint_record.confrelid = 'public.topic_series'::regclass
      and constraint_record.contype = 'f'
  ) then
    raise exception using
      errcode = '42883',
      message = 'taxonomy delete guard requires topics_series_id_fkey';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conname = 'topics_category_id_fkey'
      and constraint_record.conrelid = 'public.topics'::regclass
      and constraint_record.confrelid = 'public.topic_categories'::regclass
      and constraint_record.contype = 'f'
  ) then
    raise exception using
      errcode = '42883',
      message = 'taxonomy delete guard requires topics_category_id_fkey';
  end if;
end;
$taxonomy_delete_guard_preflight$;

-- Normalize only proven legacy category references. Matching slugs identify an
-- existing canonical category; timestamps are intentionally preserved because
-- this repair does not change the content itself.
update public.topics topics
set category_id = categories.id
from public.topic_categories categories
where topics.category_id is null
  and nullif(btrim(topics.category_slug), '') is not null
  and topics.category_slug = categories.slug;

create or replace function public.admin_delete_topic_category(
  p_category_id bigint,
  p_transfer_to_id bigint,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_source record;
  v_target record;
  v_active_topic_count bigint := 0;
  v_topics_updated integer := 0;
  v_soft_deleted_topics_detached integer := 0;
  v_applied_transfer_id bigint := null;
begin
  if p_category_id is null or p_category_id <= 0 then
    raise exception using errcode = '22023', message = 'category id is invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  lock table public.topic_categories in share row exclusive mode;

  select categories.id, categories.name, categories.slug
  into v_source
  from public.topic_categories categories
  where categories.id = p_category_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'category was not found';
  end if;

  if exists (
    select 1 from public.topic_series series where series.category_id = v_source.id
  ) then
    raise exception using errcode = '23503', message = 'category still has linked series';
  end if;
  if exists (
    select 1 from public.topic_categories child where child.parent_id = v_source.id
  ) then
    raise exception using errcode = '23503', message = 'category still has child categories';
  end if;

  select count(*)::bigint
  into v_active_topic_count
  from public.topics topics
  where topics.deleted_at is null
    and (
      topics.category_id = v_source.id
      or (
        topics.category_id is null
        and topics.category_slug = v_source.slug
      )
    );

  if v_active_topic_count > 0 and (
    p_transfer_to_id is null
    or p_transfer_to_id <= 0
    or p_transfer_to_id = v_source.id
  ) then
    raise exception using
      errcode = '22023',
      message = 'a valid transfer category is required',
      detail = format('active_topic_count=%s', v_active_topic_count);
  end if;

  if p_transfer_to_id is not null then
    if p_transfer_to_id <= 0 or p_transfer_to_id = v_source.id then
      raise exception using errcode = '22023', message = 'a valid transfer category is required';
    end if;

    select categories.id, categories.name, categories.slug
    into v_target
    from public.topic_categories categories
    where categories.id = p_transfer_to_id
    for update;

    if not found then
      raise exception using errcode = '23503', message = 'transfer category was not found';
    end if;

    update public.topics topics
    set
      category_id = v_target.id,
      category = v_target.name,
      category_slug = v_target.slug,
      updated_at = now(),
      updated_by = p_actor_id
    where topics.category_id = v_source.id
       or (
         topics.category_id is null
         and topics.category_slug = v_source.slug
       );
    get diagnostics v_topics_updated = row_count;
    v_applied_transfer_id := v_target.id;
  else
    update public.topics topics
    set
      category_id = null,
      category = '',
      category_slug = '',
      updated_at = now(),
      updated_by = p_actor_id
    where topics.deleted_at is not null
      and (
        topics.category_id = v_source.id
        or (
          topics.category_id is null
          and topics.category_slug = v_source.slug
        )
      );
    get diagnostics v_soft_deleted_topics_detached = row_count;
  end if;

  delete from public.topic_categories categories
  where categories.id = v_source.id;

  return jsonb_build_object(
    'deleted_category_id', v_source.id,
    'transfer_to_id', v_applied_transfer_id,
    'topics_updated', v_topics_updated,
    'soft_deleted_topics_detached', v_soft_deleted_topics_detached
  );
end;
$function$;

create or replace function public.admin_delete_topic_series(
  p_series_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_series_ids bigint[];
  v_found_count integer := 0;
  v_active_topic_count bigint := 0;
  v_soft_deleted_topics_detached integer := 0;
  v_deleted_count integer := 0;
  v_now timestamptz := now();
begin
  if p_series_ids is null
     or cardinality(p_series_ids) = 0
     or exists (
       select 1 from unnest(p_series_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'series ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_series_ids
  from unnest(p_series_ids) requested(id);

  perform 1
  from public.topic_series series
  where series.id = any(v_series_ids)
  order by series.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_series_ids) then
    raise exception using errcode = 'P0002', message = 'one or more series were not found';
  end if;

  select count(*)::bigint
  into v_active_topic_count
  from public.topics topics
  where topics.deleted_at is null
    and (
      topics.series_id = any(v_series_ids)
      or (
        topics.series_id is null
        and exists (
          select 1
          from public.topic_series series
          where series.id = any(v_series_ids)
            and topics.series_slug = series.slug
        )
      )
    );

  if v_active_topic_count > 0 then
    raise exception using
      errcode = '23503',
      message = 'series still has active topics',
      detail = format('active_topic_count=%s', v_active_topic_count);
  end if;

  update public.topics topics
  set
    series_id = null,
    series = null,
    series_slug = null,
    updated_at = v_now,
    updated_by = p_actor_id
  where topics.deleted_at is not null
    and (
      topics.series_id = any(v_series_ids)
      or (
        topics.series_id is null
        and exists (
          select 1
          from public.topic_series series
          where series.id = any(v_series_ids)
            and topics.series_slug = series.slug
        )
      )
    );
  get diagnostics v_soft_deleted_topics_detached = row_count;

  delete from public.topic_series series
  where series.id = any(v_series_ids);
  get diagnostics v_deleted_count = row_count;

  return jsonb_build_object(
    'deleted_series_ids', to_jsonb(v_series_ids),
    'deleted_series_count', v_deleted_count,
    'soft_deleted_topics_detached', v_soft_deleted_topics_detached
  );
end;
$function$;

revoke all on function public.admin_delete_topic_category(
  bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.admin_delete_topic_category(
  bigint, bigint, bigint
) to service_role;

revoke all on function public.admin_delete_topic_series(
  bigint[], bigint
) from public, anon, authenticated;
grant execute on function public.admin_delete_topic_series(
  bigint[], bigint
) to service_role;

comment on function public.admin_delete_topic_category(bigint, bigint, bigint) is
  'Atomic Category delete guard: active topics require transfer; soft-deleted tombstone references detach safely.';
comment on function public.admin_delete_topic_series(bigint[], bigint) is
  'Atomic Series delete guard: active topics block deletion; soft-deleted tombstone references detach safely.';

commit;
