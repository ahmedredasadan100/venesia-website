-- Keep generic Topics batch membership and lifecycle transitions atomic.
-- Semantic publish validation stays with admin_publish_topics_atomically.
begin;

create function public.admin_mutate_topics_batch_atomically(
  p_actor_id bigint,
  p_action text,
  p_topic_ids bigint[],
  p_category_id bigint default null,
  p_expected_deleted_count integer default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_ids bigint[];
  v_missing_ids bigint[];
  v_wrong_state_ids bigint[];
  v_changed_ids bigint[];
  v_actor_exists boolean;
  v_category_id bigint;
  v_category_name text;
  v_category_slug text;
  v_now timestamptz;
begin
  if p_action is null or p_action not in (
    'unpublish', 'delete', 'move_to_trash', 'feature', 'unfeature',
    'move_category', 'restore', 'permanent_delete', 'empty_trash'
  ) or p_topic_ids is null or pg_catalog.cardinality(p_topic_ids) = 0
     or pg_catalog.array_position(p_topic_ids, null) is not null
     or exists (
       select 1 from pg_catalog.unnest(p_topic_ids) as requested(id)
       where requested.id <= 0
     ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select pg_catalog.array_agg(requested.id order by requested.id)
  into v_ids
  from (
    select distinct id from pg_catalog.unnest(p_topic_ids) as input(id)
  ) as requested;

  if pg_catalog.cardinality(v_ids) <> pg_catalog.cardinality(p_topic_ids) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'duplicate_ids');
  end if;

  select exists (
    select 1 from public.admin_users
    where id = p_actor_id and is_active is true
  ) into v_actor_exists;
  if not v_actor_exists then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthorized_actor');
  end if;

  -- The confirmation count for Empty Trash describes the whole trash, not
  -- merely the IDs loaded by the caller. Hold writers out while checking it.
  if p_action = 'empty_trash' then
    if p_expected_deleted_count is null or p_expected_deleted_count <= 0
       or p_expected_deleted_count <> pg_catalog.cardinality(v_ids) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'revision_conflict');
    end if;
    lock table public.topics in share row exclusive mode;
    if (select pg_catalog.count(*) from public.topics where deleted_at is not null)
       <> p_expected_deleted_count then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'revision_conflict');
    end if;
  end if;

  -- Lock the requested set in a stable order. Every eligibility check below
  -- and the write then observe the same rows in this transaction.
  perform topic.id
  from public.topics as topic
  join pg_catalog.unnest(v_ids) as requested(id) on requested.id = topic.id
  order by topic.id
  for update of topic;

  select pg_catalog.array_agg(requested.id order by requested.id)
  into v_missing_ids
  from pg_catalog.unnest(v_ids) as requested(id)
  left join public.topics as topic on topic.id = requested.id
  where topic.id is null;
  if pg_catalog.cardinality(v_missing_ids) > 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'missing_topics', 'topicIds', v_missing_ids
    );
  end if;

  select pg_catalog.array_agg(topic.id order by topic.id)
  into v_wrong_state_ids
  from public.topics as topic
  join pg_catalog.unnest(v_ids) as requested(id) on requested.id = topic.id
  where (p_action in ('restore', 'permanent_delete', 'empty_trash')
         and topic.deleted_at is null)
     or (p_action not in ('restore', 'permanent_delete', 'empty_trash')
         and topic.deleted_at is not null);
  if pg_catalog.cardinality(v_wrong_state_ids) > 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'revision_conflict', 'topicIds', v_wrong_state_ids
    );
  end if;

  if p_action = 'move_category' then
    if p_category_id is null or p_category_id <= 0 then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    select category.id, category.name, category.slug
    into v_category_id, v_category_name, v_category_slug
    from public.topic_categories as category
    where category.id = p_category_id
      and category.deleted_at is null
      and category.is_active is true
    for share;
    if not found then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'revision_conflict');
    end if;
    perform series.id
    from public.topic_series as series
    join public.topics as topic on topic.series_id = series.id
    join pg_catalog.unnest(v_ids) as requested(id) on requested.id = topic.id
    order by series.id
    for share of series;
    if exists (
      select 1 from public.topics as topic
      join pg_catalog.unnest(v_ids) as requested(id) on requested.id = topic.id
      left join public.topic_series as series on series.id = topic.series_id
      where topic.series_id is not null
        and (series.id is null or series.deleted_at is not null
             or series.category_id is distinct from p_category_id)
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'revision_conflict');
    end if;
  end if;

  v_now := pg_catalog.statement_timestamp();

  if p_action in ('permanent_delete', 'empty_trash') then
    with changed as (
      delete from public.topics as topic
      using pg_catalog.unnest(v_ids) as requested(id)
      where topic.id = requested.id and topic.deleted_at is not null
      returning topic.id
    )
    select coalesce(pg_catalog.array_agg(id order by id), array[]::bigint[])
    into v_changed_ids from changed;
  else
    with changed as (
      update public.topics as topic
      set status = case
            when p_action in ('unpublish', 'delete', 'move_to_trash', 'restore')
              then 'unpublished' else topic.status end,
          deleted_at = case
            when p_action in ('delete', 'move_to_trash') then v_now
            when p_action = 'restore' then null else topic.deleted_at end,
          is_featured = case
            when p_action = 'feature' then true
            when p_action = 'unfeature' then false else topic.is_featured end,
          category_id = case
            when p_action = 'move_category' then v_category_id else topic.category_id end,
          category = case
            when p_action = 'move_category' then v_category_name else topic.category end,
          category_slug = case
            when p_action = 'move_category' then v_category_slug else topic.category_slug end,
          updated_by = p_actor_id,
          updated_at = v_now
      from pg_catalog.unnest(v_ids) as requested(id)
      where topic.id = requested.id
        and ((p_action = 'restore' and topic.deleted_at is not null)
          or (p_action <> 'restore' and topic.deleted_at is null))
      returning topic.id
    )
    select coalesce(pg_catalog.array_agg(id order by id), array[]::bigint[])
    into v_changed_ids from changed;
  end if;

  if pg_catalog.cardinality(v_changed_ids) <> pg_catalog.cardinality(v_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'topics_batch_atomic_membership_mismatch';
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'requestedIds', v_ids,
    'changedIds', v_changed_ids,
    'committedAt', v_now
  );
end;
$function$;

revoke all on function public.admin_mutate_topics_batch_atomically(
  bigint, text, bigint[], bigint, integer
) from public, anon, authenticated, service_role;
grant execute on function public.admin_mutate_topics_batch_atomically(
  bigint, text, bigint[], bigint, integer
) to service_role;

comment on function public.admin_mutate_topics_batch_atomically(
  bigint, text, bigint[], bigint, integer
) is 'Atomically rejects a changed Topics requested set or applies the full generic batch, restore, or purge intent; only the existing Topics action settles cache, media, and feedback.';

select pg_catalog.pg_notify('pgrst', 'reload schema');
commit;