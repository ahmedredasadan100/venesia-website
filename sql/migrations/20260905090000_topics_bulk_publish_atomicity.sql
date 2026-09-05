-- Publish a bounded Topics batch and its canonical Audit rows as one
-- revision-checked database transaction.

begin;

create or replace function public.admin_publish_topics_atomically(
  p_actor_id bigint,
  p_topics jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_batch_limit constant integer := 50;
  v_item_count integer;
  v_unique_count integer;
  v_topic_ids bigint[];
  v_expected_updated_at timestamptz[];
  v_duplicate_topic_ids bigint[];
  v_missing_topic_ids bigint[];
  v_deleted_topic_ids bigint[];
  v_conflicting_topic_ids bigint[];
  v_already_published_topic_ids bigint[];
  v_publishable_topic_ids bigint[];
  v_published_topic_ids bigint[];
  v_audit_ids bigint[];
  v_actor_username text;
  v_now timestamptz;
begin
  if p_topics is null
     or pg_catalog.jsonb_typeof(p_topics) is distinct from 'array' then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_topics);
  if v_item_count = 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  if v_item_count > v_batch_limit then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'batch_limit',
      'limit', v_batch_limit
    );
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_topics) as input_item(value)
    where case
      when pg_catalog.jsonb_typeof(input_item.value) is distinct from 'object' then true
      when (
        select pg_catalog.count(*)
        from pg_catalog.jsonb_object_keys(input_item.value) as object_key(key)
      ) <> 2 then true
      when not (input_item.value ? 'id')
        or not (input_item.value ? 'expected_updated_at') then true
      when pg_catalog.jsonb_typeof(input_item.value -> 'id') is distinct from 'number'
        or pg_catalog.jsonb_typeof(input_item.value -> 'expected_updated_at') is distinct from 'string' then true
      else
        (input_item.value ->> 'id') !~ '^[1-9][0-9]*$'
        or pg_catalog.btrim(input_item.value ->> 'expected_updated_at') = ''
    end
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  begin
    select
      pg_catalog.array_agg(parsed.id order by parsed.id),
      pg_catalog.array_agg(parsed.expected_updated_at order by parsed.id)
    into v_topic_ids, v_expected_updated_at
    from (
      select
        (input_item.value ->> 'id')::bigint as id,
        (input_item.value ->> 'expected_updated_at')::timestamptz as expected_updated_at
      from pg_catalog.jsonb_array_elements(p_topics) as input_item(value)
    ) as parsed;
  exception
    when data_exception then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'invalid_input'
      );
  end;

  if exists (
    select 1
    from pg_catalog.unnest(v_expected_updated_at) as expected_revision(value)
    where not pg_catalog.isfinite(expected_revision.value)
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  select pg_catalog.count(distinct requested.id)::integer
  into v_unique_count
  from pg_catalog.unnest(v_topic_ids) as requested(id);

  if v_unique_count <> v_item_count then
    select pg_catalog.array_agg(duplicate.id order by duplicate.id)
    into v_duplicate_topic_ids
    from (
      select requested.id
      from pg_catalog.unnest(v_topic_ids) as requested(id)
      group by requested.id
      having pg_catalog.count(*) > 1
    ) as duplicate;

    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'duplicate_ids',
      'duplicateIds', v_duplicate_topic_ids
    );
  end if;

  if p_actor_id is null or p_actor_id <= 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthorized_actor'
    );
  end if;

  select admin_user.username
  into v_actor_username
  from public.admin_users as admin_user
  where admin_user.id = p_actor_id
    and admin_user.is_active is true
  for share;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthorized_actor'
    );
  end if;

  -- A single global order prevents overlapping batches from taking row locks
  -- in opposite orders.
  perform topic.id
  from public.topics as topic
  join pg_catalog.unnest(v_topic_ids) as requested(id)
    on requested.id = topic.id
  order by topic.id
  for update of topic;

  select pg_catalog.array_agg(requested.id order by requested.id)
  into v_missing_topic_ids
  from pg_catalog.unnest(v_topic_ids) as requested(id)
  left join public.topics as topic
    on topic.id = requested.id
  where topic.id is null;

  if pg_catalog.cardinality(v_missing_topic_ids) > 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'missing_topics',
      'topicIds', v_missing_topic_ids
    );
  end if;

  select pg_catalog.array_agg(topic.id order by topic.id)
  into v_deleted_topic_ids
  from public.topics as topic
  join pg_catalog.unnest(v_topic_ids) as requested(id)
    on requested.id = topic.id
  where topic.deleted_at is not null;

  if pg_catalog.cardinality(v_deleted_topic_ids) > 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'deleted_topics',
      'topicIds', v_deleted_topic_ids
    );
  end if;

  select coalesce(
    pg_catalog.array_agg(topic.id order by topic.id),
    array[]::bigint[]
  )
  into v_already_published_topic_ids
  from public.topics as topic
  join pg_catalog.unnest(v_topic_ids) as requested(id)
    on requested.id = topic.id
  where topic.status = 'published';

  select coalesce(
    pg_catalog.array_agg(topic.id order by topic.id),
    array[]::bigint[]
  )
  into v_publishable_topic_ids
  from public.topics as topic
  join pg_catalog.unnest(v_topic_ids) as requested(id)
    on requested.id = topic.id
  where topic.status is distinct from 'published';

  select pg_catalog.array_agg(topic.id order by topic.id)
  into v_conflicting_topic_ids
  from pg_catalog.generate_subscripts(v_topic_ids, 1) as requested(position)
  join public.topics as topic
    on topic.id = v_topic_ids[requested.position]
  where topic.status is distinct from 'published'
    and topic.updated_at is distinct from v_expected_updated_at[requested.position];

  if pg_catalog.cardinality(v_conflicting_topic_ids) > 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'revision_conflict',
      'topicIds', v_conflicting_topic_ids
    );
  end if;

  v_now := pg_catalog.statement_timestamp();

  with updated_topics as (
    update public.topics as topic
    set
      status = 'published',
      published_at = coalesce(topic.published_at, v_now),
      published_by = p_actor_id,
      updated_by = p_actor_id,
      updated_at = v_now
    from pg_catalog.generate_subscripts(v_topic_ids, 1) as requested(position)
    where topic.id = v_topic_ids[requested.position]
      and topic.deleted_at is null
      and topic.status is distinct from 'published'
      and topic.updated_at is not distinct from v_expected_updated_at[requested.position]
    returning topic.id
  )
  select coalesce(
    pg_catalog.array_agg(updated_topics.id order by updated_topics.id),
    array[]::bigint[]
  )
  into v_published_topic_ids
  from updated_topics;

  if pg_catalog.cardinality(v_published_topic_ids)
     is distinct from pg_catalog.cardinality(v_publishable_topic_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'topics_bulk_publish_update_count_mismatch';
  end if;

  -- The canonical audit table is part of the same statement transaction. Any
  -- audit insert failure therefore rolls back both every Topic transition and
  -- every audit row already produced by this batch.
  with inserted_audits as (
    insert into public.admin_audit_logs (
      actor_admin_user_id,
      actor_username,
      action,
      entity_type,
      entity_id,
      entity_label,
      metadata,
      created_at
    )
    select
      p_actor_id,
      v_actor_username,
      'topic.publish',
      'topic',
      topic.id,
      topic.title,
      pg_catalog.jsonb_build_object(
        'operation', 'bulk_publish',
        'atomic', true
      ),
      v_now
    from public.topics as topic
    join pg_catalog.unnest(v_published_topic_ids) as published(id)
      on published.id = topic.id
    order by topic.id
    returning id
  )
  select coalesce(
    pg_catalog.array_agg(inserted_audits.id order by inserted_audits.id),
    array[]::bigint[]
  )
  into v_audit_ids
  from inserted_audits;

  if pg_catalog.cardinality(v_audit_ids)
     is distinct from pg_catalog.cardinality(v_published_topic_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'topics_bulk_publish_audit_count_mismatch';
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'published',
    'requestedIds', v_topic_ids,
    'publishedIds', v_published_topic_ids,
    'alreadyPublishedIds', v_already_published_topic_ids,
    'committedAt', v_now,
    'auditIds', v_audit_ids
  );
end;
$function$;

revoke all on function public.admin_publish_topics_atomically(bigint, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_publish_topics_atomically(bigint, jsonb)
  to service_role;

comment on function public.admin_publish_topics_atomically(bigint, jsonb) is
  'Publishes one bounded Topics batch with per-transition canonical Audit rows in the same transaction, after active-actor, availability, and exact updated_at revision checks. Semantic publish validation remains application-owned.';

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
