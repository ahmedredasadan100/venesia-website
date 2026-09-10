-- P1-E Taxonomy Consistency
--
-- Forward-only contract:
-- - Category and Series edits require an exact updated_at revision.
-- - Series creation validates and locks its Category in the same transaction.
-- - Direct Series inserts/reassignments cannot bypass Category eligibility.
-- - Topic/Series assignments cannot cross Category boundaries, including
--   through direct SQL writes.

begin;

-- Existing drift is a stop condition, never a backfill opportunity. Raising
-- here aborts the whole migration before any function or constraint changes.
do $$
declare
  v_mismatch record;
begin
  select
    topics.id as topic_id,
    topics.series_id,
    topics.category_id as topic_category_id,
    series.category_id as series_category_id
  into v_mismatch
  from public.topics as topics
  left join public.topic_series as series
    on series.id = topics.series_id
  where topics.series_id is not null
    and (
      series.id is null
      or topics.category_id is null
      or topics.category_id is distinct from series.category_id
    )
  order by topics.id
  limit 1;

  if found then
    raise exception using
      errcode = '23514',
      message = 'topic_series_category_invariant_violation',
      detail = pg_catalog.format(
        'topic_id=%s series_id=%s topic_category_id=%s series_category_id=%s',
        v_mismatch.topic_id,
        v_mismatch.series_id,
        coalesce(v_mismatch.topic_category_id::text, 'null'),
        coalesce(v_mismatch.series_category_id::text, 'null')
      );
  end if;
end;
$$;

alter table public.topic_series
  add constraint topic_series_id_category_id_key
  unique (id, category_id);

alter table public.topics
  add constraint topics_series_requires_category_check
  check (series_id is null or category_id is not null);

alter table public.topics
  add constraint topics_series_category_id_fkey
  foreign key (series_id, category_id)
  references public.topic_series (id, category_id)
  on update restrict
  on delete restrict
  not deferrable;

drop function public.admin_update_topic_category(
  bigint, text, bigint, boolean, text, bigint
) restrict;

create function public.admin_update_topic_category(
  p_category_id bigint,
  p_name text,
  p_parent_id bigint,
  p_is_active boolean,
  p_color_token text,
  p_actor_id bigint,
  p_expected_updated_at timestamp with time zone
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_category record;
  v_topics_updated integer := 0;
begin
  if p_category_id is null
     or p_category_id <= 0
     or nullif(pg_catalog.btrim(coalesce(p_name, '')), '') is null
     or p_is_active is null
     or p_expected_updated_at is null then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  if p_actor_id is null
     or p_actor_id <= 0
     or not exists (
       select 1
       from public.admin_users as admin_users
       where admin_users.id = p_actor_id
     ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthorized_actor'
    );
  end if;

  -- Category lifecycle functions use this same table lock before row locks.
  -- Serializing this small hierarchy keeps cycle checks race-safe.
  lock table public.topic_categories in share row exclusive mode;

  -- Relationship writers lock Topics before Series/Category rows. Follow the
  -- same order before propagating Category metadata to avoid lock cycles.
  perform topics.id
  from public.topics as topics
  where topics.category_id = p_category_id
     or (
       topics.category_id is null
       and topics.category_slug = (
         select categories.slug
         from public.topic_categories as categories
         where categories.id = p_category_id
           and categories.deleted_at is null
       )
     )
  order by topics.id
  for update;

  select
    categories.id,
    categories.name,
    categories.slug,
    categories.parent_id,
    categories.is_active,
    categories.status,
    categories.color_token,
    categories.published_at,
    categories.updated_at
  into v_category
  from public.topic_categories as categories
  where categories.id = p_category_id
    and categories.deleted_at is null
  for no key update;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'not_found'
    );
  end if;

  if v_category.updated_at is distinct from p_expected_updated_at then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'revision_conflict'
    );
  end if;

  if p_parent_id is not null then
    if p_parent_id <= 0 or p_parent_id = p_category_id then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'invalid_input'
      );
    end if;

    if not exists (
      select 1
      from public.topic_categories as parent_category
      where parent_category.id = p_parent_id
        and parent_category.deleted_at is null
    ) then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'parent_unavailable'
      );
    end if;

    if exists (
      with recursive descendants as (
        select
          child.id,
          array[p_category_id, child.id]::bigint[] as ancestry
        from public.topic_categories as child
        where child.parent_id = p_category_id

        union all

        select
          child.id,
          descendants.ancestry || child.id
        from descendants
        join public.topic_categories as child
          on child.parent_id = descendants.id
        where not child.id = any(descendants.ancestry)
      )
      select 1
      from descendants
      where descendants.id = p_parent_id
    ) then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'hierarchy_cycle'
      );
    end if;
  end if;

  update public.topic_categories as categories
  set
    name = pg_catalog.btrim(p_name),
    parent_id = p_parent_id,
    is_active = p_is_active,
    status = case when p_is_active then 'published' else 'unpublished' end,
    color_token = coalesce(
      nullif(pg_catalog.btrim(p_color_token), ''),
      categories.color_token
    ),
    updated_at = greatest(
      pg_catalog.clock_timestamp(),
      v_category.updated_at + interval '1 microsecond'
    )
  where categories.id = p_category_id
  returning
    categories.id,
    categories.name,
    categories.slug,
    categories.parent_id,
    categories.is_active,
    categories.status,
    categories.color_token,
    categories.published_at,
    categories.updated_at
  into v_category;

  update public.topics as topics
  set
    category_id = v_category.id,
    category = v_category.name,
    category_slug = v_category.slug,
    updated_at = v_category.updated_at,
    updated_by = p_actor_id
  where topics.category_id = v_category.id
     or (
       topics.category_id is null
       and topics.category_slug = v_category.slug
     );
  get diagnostics v_topics_updated = row_count;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'category', pg_catalog.to_jsonb(v_category),
    'topics_updated', v_topics_updated
  );
end;
$$;

drop function public.admin_update_topic_series(
  bigint, text, bigint, text, bigint
) restrict;

create function public.admin_update_topic_series(
  p_series_id bigint,
  p_name text,
  p_category_id bigint,
  p_status text,
  p_actor_id bigint,
  p_expected_updated_at timestamp with time zone
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_series record;
  v_topics_linked integer := 0;
  v_topics_updated integer := 0;
begin
  if p_series_id is null
     or p_series_id <= 0
     or nullif(pg_catalog.btrim(coalesce(p_name, '')), '') is null
     or p_category_id is null
     or p_category_id <= 0
     or p_status is null
     or p_status not in ('published', 'unpublished')
     or p_expected_updated_at is null then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  if p_actor_id is null
     or p_actor_id <= 0
     or not exists (
       select 1
       from public.admin_users as admin_users
       where admin_users.id = p_actor_id
     ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthorized_actor'
     );
  end if;

  -- Topic relationship writes take their row lock before PostgreSQL checks
  -- the Series FK. Lock the same rows in id order before taking the Series
  -- lock, then recheck after it to observe a writer that committed while the
  -- Series lock was waiting.
  perform topics.id
  from public.topics as topics
  where topics.series_id = p_series_id
  order by topics.id
  for update;

  select
    series.id,
    series.name,
    series.slug,
    series.category_id,
    series.status,
    series.deleted_at,
    series.updated_at
  into v_series
  from public.topic_series as series
  where series.id = p_series_id
    and series.deleted_at is null
  for update;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'not_found'
    );
  end if;

  if v_series.updated_at is distinct from p_expected_updated_at then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'revision_conflict'
    );
  end if;

  perform topics.id
  from public.topics as topics
  where topics.series_id = p_series_id
  order by topics.id
  for update;
  get diagnostics v_topics_linked = row_count;

  if p_category_id is distinct from v_series.category_id
     and v_topics_linked > 0 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'series_category_conflict'
    );
  end if;

  -- Existing assignments remain editable if their Category is merely
  -- unpublished/inactive. Every reassignment requires a currently eligible
  -- Category; the trigger below independently guards direct SQL writes.
  perform 1
  from public.topic_categories as categories
  where categories.id = p_category_id
    and categories.deleted_at is null
    and (
      categories.id = v_series.category_id
      or (
        categories.is_active is true
        and categories.status = 'published'
      )
    )
  for share;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'category_unavailable'
    );
  end if;

  update public.topic_series as series
  set
    name = pg_catalog.btrim(p_name),
    category_id = p_category_id,
    status = p_status,
    updated_at = greatest(
      pg_catalog.clock_timestamp(),
      v_series.updated_at + interval '1 microsecond'
    )
  where series.id = p_series_id
  returning
    series.id,
    series.name,
    series.slug,
    series.category_id,
    series.status,
    series.deleted_at,
    series.updated_at
  into v_series;

  update public.topics as topics
  set
    series = v_series.name,
    series_slug = v_series.slug,
    updated_at = v_series.updated_at,
    updated_by = p_actor_id
  where topics.series_id = v_series.id;
  get diagnostics v_topics_updated = row_count;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'series', pg_catalog.to_jsonb(v_series),
    'topics_updated', v_topics_updated
  );
end;
$$;

create function public.admin_create_topic_series(
  p_name text,
  p_slug text,
  p_category_id bigint,
  p_status text,
  p_actor_id bigint
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_series record;
begin
  if nullif(pg_catalog.btrim(coalesce(p_name, '')), '') is null
     or nullif(pg_catalog.btrim(coalesce(p_slug, '')), '') is null
     or p_category_id is null
     or p_category_id <= 0
     or p_status is null
     or p_status not in ('published', 'unpublished') then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_input'
    );
  end if;

  if p_actor_id is null
     or p_actor_id <= 0
     or not exists (
       select 1
       from public.admin_users as admin_users
       where admin_users.id = p_actor_id
     ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthorized_actor'
    );
  end if;

  perform 1
  from public.topic_categories as categories
  where categories.id = p_category_id
    and categories.deleted_at is null
    and categories.is_active is true
    and categories.status = 'published'
  for share;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'category_unavailable'
    );
  end if;

  insert into public.topic_series as series (
    name,
    slug,
    category_id,
    status,
    created_at,
    updated_at
  )
  values (
    pg_catalog.btrim(p_name),
    pg_catalog.btrim(p_slug),
    p_category_id,
    p_status,
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp()
  )
  returning
    series.id,
    series.name,
    series.slug,
    series.category_id,
    series.status,
    series.deleted_at,
    series.created_at,
    series.updated_at
  into v_series;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'created',
    'series', pg_catalog.to_jsonb(v_series)
  );
end;
$$;

create function public.enforce_topic_series_category_eligibility()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.topic_categories as categories
  where categories.id = new.category_id
    and categories.deleted_at is null
    and categories.is_active is true
    and categories.status = 'published'
  for share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'topic_series_category_unavailable';
  end if;

  return new;
end;
$$;

create trigger topic_series_category_eligibility_on_insert
before insert on public.topic_series
for each row
execute function public.enforce_topic_series_category_eligibility();

create trigger topic_series_category_eligibility_on_reassignment
before update of category_id on public.topic_series
for each row
when (old.category_id is distinct from new.category_id)
execute function public.enforce_topic_series_category_eligibility();

revoke all on function public.admin_update_topic_category(
  bigint, text, bigint, boolean, text, bigint, timestamp with time zone
) from public, anon, authenticated;
grant execute on function public.admin_update_topic_category(
  bigint, text, bigint, boolean, text, bigint, timestamp with time zone
) to service_role;

revoke all on function public.admin_update_topic_series(
  bigint, text, bigint, text, bigint, timestamp with time zone
) from public, anon, authenticated;
grant execute on function public.admin_update_topic_series(
  bigint, text, bigint, text, bigint, timestamp with time zone
) to service_role;

revoke all on function public.admin_create_topic_series(
  text, text, bigint, text, bigint
) from public, anon, authenticated;
grant execute on function public.admin_create_topic_series(
  text, text, bigint, text, bigint
) to service_role;

revoke all on function public.enforce_topic_series_category_eligibility()
from public, anon, authenticated, service_role;

comment on function public.admin_update_topic_category(
  bigint, text, bigint, boolean, text, bigint, timestamp with time zone
) is 'Atomically updates a Topic Category only when updated_at matches the expected revision.';

comment on function public.admin_update_topic_series(
  bigint, text, bigint, text, bigint, timestamp with time zone
) is 'Atomically updates a Topic Series only when updated_at matches the expected revision.';

comment on function public.admin_create_topic_series(
  text, text, bigint, text, bigint
) is 'Atomically validates an eligible Topic Category and creates one Topic Series.';

comment on function public.enforce_topic_series_category_eligibility() is
  'Guards Topic Series inserts and Category reassignments with a row-share eligibility lock.';

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
