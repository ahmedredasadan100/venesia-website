-- Extend the existing command RPCs and canonical audit history, without a
-- command table, queue, or alternate domain source of truth. The explicit new
-- optional argument lets old callers work; new callers fail before writes on
-- an old schema (PostgREST cannot resolve p_command_id).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create unique index admin_audit_logs_topic_command_identity_idx
  on public.admin_audit_logs(actor_admin_user_id, (metadata -> 'command' ->> 'id'))
  where metadata -> 'command' ->> 'id' is not null;

-- Receipts are immutable audit history. Deleting one would make an old
-- committed command indistinguishable from a new command and permit replay.
create function public.preserve_admin_command_audit_receipt()
returns trigger language plpgsql security invoker set search_path = '' as $guard$
begin
  if old.metadata -> 'command' ->> 'id' is not null then
    -- Preserve the existing Admin FK ON DELETE SET NULL lifecycle. Only the
    -- FK-driven nullification may change; the immutable receipt retains its
    -- original actor identity and every other audit field stays identical.
    if tg_op = 'UPDATE' and pg_catalog.pg_trigger_depth() > 1
       and old.actor_admin_user_id is not null and new.actor_admin_user_id is null
       and (pg_catalog.to_jsonb(new) - 'actor_admin_user_id') =
           (pg_catalog.to_jsonb(old) - 'actor_admin_user_id') then
      return new;
    end if;
    raise exception using errcode = '23514', message = 'admin_command_receipt_is_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$guard$;
revoke all on function public.preserve_admin_command_audit_receipt() from public, anon, authenticated;
create trigger preserve_admin_command_audit_receipt
before update or delete on public.admin_audit_logs
for each row execute function public.preserve_admin_command_audit_receipt();

drop function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer);
drop function public.admin_publish_topics_atomically(bigint,jsonb);

create function public.admin_mutate_topics_batch_atomically(
  p_actor_id bigint,
  p_action text,
  p_topic_ids bigint[],
  p_category_id bigint default null,
  p_expected_deleted_count integer default null,
  p_command_id uuid default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_command_intent jsonb;
  v_command_receipt jsonb;
  v_command_result jsonb;
  v_audit_label text;
  v_audit_metadata jsonb;
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

  if p_command_id is not null then
    v_command_intent := pg_catalog.jsonb_build_object('action', p_action, 'ids', case when p_action = 'empty_trash' then null else pg_catalog.to_jsonb(v_ids) end, 'categoryId', p_category_id, 'expectedCount', p_expected_deleted_count);
    -- The lock precedes the receipt read and all target writes. Hash collisions
    -- only serialize unrelated commands; uniqueness still uses the exact UUID.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_actor_id::text || ':' || p_command_id::text, 0));
    select audit.metadata -> 'command' into v_command_receipt
    from public.admin_audit_logs as audit
    where audit.actor_admin_user_id = p_actor_id
      and audit.metadata -> 'command' ->> 'id' = p_command_id::text;
    if found then
      if v_command_receipt -> 'intent' is distinct from v_command_intent then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'command_conflict');
      end if;
      return v_command_receipt -> 'result';
    end if;
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

  if p_command_id is not null then
  -- Capture existing audit identity from the locked rows before a purge can
  -- remove them. These fields describe the event; Topics remains domain truth.
  if pg_catalog.cardinality(v_ids) = 1 then
    select topic.title, pg_catalog.jsonb_build_object(
      'slug', topic.slug, 'content_type', topic.content_type
    ) into v_audit_label, v_audit_metadata
    from public.topics as topic where topic.id = v_ids[1];
  else
    select pg_catalog.jsonb_build_object(
      'slugs', pg_catalog.jsonb_agg(topic.slug order by topic.id),
      'content_types', pg_catalog.jsonb_agg(topic.content_type order by topic.id)
    ) into v_audit_metadata
    from public.topics as topic
    join pg_catalog.unnest(v_ids) as requested(id) on requested.id = topic.id;
  end if;
  if p_action in ('delete', 'move_to_trash') then
    v_audit_metadata := v_audit_metadata || pg_catalog.jsonb_build_object('permanent', false, 'slug_retained', true);
  elsif p_action in ('permanent_delete', 'empty_trash') then
    v_audit_metadata := v_audit_metadata || pg_catalog.jsonb_build_object('permanent', true, 'slug_released', true, 'empty_trash', p_action = 'empty_trash');
  elsif p_action = 'restore' then
    v_audit_metadata := v_audit_metadata || pg_catalog.jsonb_build_object('restored_status', 'unpublished');
    if pg_catalog.cardinality(v_ids) = 1 then
      select v_audit_metadata || pg_catalog.jsonb_build_object('previous_deleted_at', topic.deleted_at)
      into v_audit_metadata from public.topics as topic where topic.id = v_ids[1];
    end if;
  elsif p_action in ('feature', 'unfeature') then
    v_audit_metadata := v_audit_metadata || pg_catalog.jsonb_build_object('is_featured', p_action = 'feature');
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

  v_command_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'requestedIds', v_ids,
    'changedIds', v_changed_ids,
    'committedAt', v_now
  );
  if p_command_id is not null then
    v_command_result := v_command_result || pg_catalog.jsonb_build_object('commandId', p_command_id);
    insert into public.admin_audit_logs (
      actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
    ) select p_actor_id, username, 'topic.' || case when p_action in ('delete','move_to_trash') then 'delete' when p_action in ('permanent_delete','empty_trash') then 'permanent_delete' when p_action in ('restore','unpublish') then p_action else 'update' end, 'topic',
      case when pg_catalog.cardinality(v_ids) = 1 then v_ids[1] else null end,
      v_audit_label,
      v_audit_metadata || pg_catalog.jsonb_build_object('atomic', true, 'topic_ids', v_ids, 'count', pg_catalog.cardinality(v_ids),
        'command', pg_catalog.jsonb_build_object('id', p_command_id, 'actorId', p_actor_id, 'intent', v_command_intent, 'result', v_command_result))
    from public.admin_users where id = p_actor_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'topics_command_audit_missing_actor';
    end if;
  end if;
  return v_command_result;
end;
$function$;


create or replace function public.admin_publish_topics_atomically(
  p_actor_id bigint,
  p_topics jsonb,
  p_command_id uuid default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_command_intent jsonb;
  v_command_receipt jsonb;
  v_command_result jsonb;
  v_audit_label text;
  v_audit_metadata jsonb;
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

  if p_command_id is not null then
    v_command_intent := pg_catalog.jsonb_build_object('action', 'publish', 'ids', v_topic_ids, 'categoryId', null, 'expectedCount', null);
    -- The lock precedes the receipt read and all target writes. Hash collisions
    -- only serialize unrelated commands; uniqueness still uses the exact UUID.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_actor_id::text || ':' || p_command_id::text, 0));
    select audit.metadata -> 'command' into v_command_receipt
    from public.admin_audit_logs as audit
    where audit.actor_admin_user_id = p_actor_id
      and audit.metadata -> 'command' ->> 'id' = p_command_id::text;
    if found then
      if v_command_receipt -> 'intent' is distinct from v_command_intent then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'command_conflict');
      end if;
      return v_command_receipt -> 'result';
    end if;
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

  if p_command_id is not null then
  -- Capture existing audit identity from the locked rows before a purge can
  -- remove them. These fields describe the event; Topics remains domain truth.
  if pg_catalog.cardinality(v_topic_ids) = 1 then
    select topic.title, pg_catalog.jsonb_build_object(
      'slug', topic.slug, 'content_type', topic.content_type
    ) into v_audit_label, v_audit_metadata
    from public.topics as topic where topic.id = v_topic_ids[1];
  else
    select pg_catalog.jsonb_build_object(
      'slugs', pg_catalog.jsonb_agg(topic.slug order by topic.id),
      'content_types', pg_catalog.jsonb_agg(topic.content_type order by topic.id)
    ) into v_audit_metadata
    from public.topics as topic
    join pg_catalog.unnest(v_topic_ids) as requested(id) on requested.id = topic.id;
  end if;

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

  v_command_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'published',
    'requestedIds', v_topic_ids,
    'publishedIds', v_published_topic_ids,
    'alreadyPublishedIds', v_already_published_topic_ids,
    'committedAt', v_now,
    'auditIds', v_audit_ids
  );
  if p_command_id is not null then
    v_command_result := v_command_result || pg_catalog.jsonb_build_object('commandId', p_command_id);
    insert into public.admin_audit_logs (
      actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
    ) select p_actor_id, username, 'topic.publish', 'topic',
      case when pg_catalog.cardinality(v_topic_ids) = 1 then v_topic_ids[1] else null end,
      v_audit_label,
      v_audit_metadata || pg_catalog.jsonb_build_object('atomic', true, 'topic_ids', v_topic_ids, 'count', pg_catalog.cardinality(v_topic_ids),
        'command', pg_catalog.jsonb_build_object('id', p_command_id, 'actorId', p_actor_id, 'intent', v_command_intent, 'result', v_command_result))
    from public.admin_users where id = p_actor_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'topics_command_audit_missing_actor';
    end if;
  end if;
  return v_command_result;
end;
$function$;
revoke all on function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid) to service_role;
revoke all on function public.admin_publish_topics_atomically(bigint,jsonb,uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_publish_topics_atomically(bigint,jsonb,uuid) to service_role;
comment on function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid) is 'Atomic Topics batch with optional immutable canonical audit receipt; exact command replay returns its original result without a domain write.';
comment on function public.admin_publish_topics_atomically(bigint,jsonb,uuid) is 'Revision checked publish with canonical transition audits and optional immutable command receipt; semantic validation remains application owned.';
select pg_catalog.pg_notify('pgrst', 'reload schema');
commit;
