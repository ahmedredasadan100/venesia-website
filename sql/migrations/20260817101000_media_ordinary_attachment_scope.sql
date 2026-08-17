begin;

-- Ordinary domain attachment is decided from the addressed assets and their
-- direct conflicts. Global reconciliation readiness remains owned by safe
-- delete/reservation flows and is intentionally not consulted here.
create or replace function public.acquire_media_reference_write_lease(
  p_targets jsonb,
  p_actor_id bigint default null,
  p_request_identity text default null,
  p_ttl_seconds integer default 180,
  p_expected_provider text default null,
  p_expected_environment text default null,
  p_expected_environment_key text default null,
  p_expected_provider_registry_version text default null
)
returns table (
  lease_token uuid,
  leased_asset_count integer,
  lease_started_at timestamptz,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_asset_ids uuid[];
  requested_asset_count integer;
  requested_identity_count integer;
  locked_asset_count integer := 0;
  blocked_asset public.media_assets%rowtype;
  created_token uuid;
  created_at_value timestamptz;
  expires_at_value timestamptz;
begin
  if jsonb_typeof(coalesce(p_targets, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_targets, '[]'::jsonb)) = 0
    or p_ttl_seconds < 30
    or p_ttl_seconds > 600
    or (p_request_identity is not null and char_length(trim(p_request_identity)) not between 1 and 160)
    or coalesce(trim(p_expected_provider), '') = ''
    or coalesce(trim(p_expected_environment), '') = ''
    or coalesce(trim(p_expected_environment_key), '') = ''
    or coalesce(trim(p_expected_provider_registry_version), '') = ''
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_write_lease_input';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_targets) target
    where coalesce(target->>'provider', '') <> trim(p_expected_provider)
      or coalesce(trim(target->>'bucket'), '') = ''
      or coalesce(trim(target->>'objectKey'), '') = ''
      or coalesce(trim(target->>'domainKey'), '') = ''
      or coalesce(trim(target->>'entityType'), '') = ''
      or coalesce(trim(target->>'entityIdentity'), '') = ''
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_media_write_lease_target';
  end if;

  select count(*) into requested_identity_count
  from (
    select distinct
      target->>'provider' as provider,
      target->>'bucket' as bucket,
      target->>'objectKey' as object_key
    from jsonb_array_elements(p_targets) target
  ) requested;

  select coalesce(array_agg(asset_id order by asset_id), '{}'::uuid[])
  into normalized_asset_ids
  from (
    select distinct asset.id as asset_id
    from jsonb_array_elements(p_targets) target
    join public.media_assets asset
      on asset.provider = target->>'provider'
      and asset.bucket = target->>'bucket'
      and asset.object_key = target->>'objectKey'
  ) requested;
  requested_asset_count := cardinality(normalized_asset_ids);
  if requested_asset_count = 0 or requested_asset_count <> requested_identity_count then
    raise exception using errcode = 'P0001', message = 'media_write_lease_asset_missing';
  end if;

  perform asset.id
  from public.media_assets asset
  where asset.id = any(normalized_asset_ids)
  order by asset.id
  for update;
  get diagnostics locked_asset_count = row_count;

  if locked_asset_count <> requested_asset_count then
    raise exception using errcode = 'P0001', message = 'media_write_lease_asset_missing';
  end if;

  select asset.* into blocked_asset
  from public.media_assets asset
  where asset.id = any(normalized_asset_ids)
    and (
      asset.status <> 'active'
      or asset.missing_object
    )
  order by asset.id
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = case
        when blocked_asset.status <> 'active' then 'media_write_lease_asset_not_active'
        else 'media_write_lease_asset_missing_from_storage'
      end,
      detail = jsonb_build_object(
        'assetId', blocked_asset.id,
        'status', blocked_asset.status,
        'missingObject', blocked_asset.missing_object
      )::text;
  end if;

  if exists (
    select 1
    from public.media_delete_reservations reservation
    where reservation.asset_id = any(normalized_asset_ids)
      and reservation.status = 'reserved'
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_delete_reserved';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases existing
    where existing.asset_id = any(normalized_asset_ids)
      and (
        existing.status = 'active'
        or (existing.status in ('failed', 'expired') and existing.resolved_at is null)
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_conflict';
  end if;

  loop
    created_token := gen_random_uuid();
    perform pg_advisory_xact_lock(hashtextextended(created_token::text, 0));
    exit when not exists (
      select 1
      from public.media_reference_write_leases existing
      where existing.lease_token = created_token
    );
  end loop;

  created_at_value := clock_timestamp();
  expires_at_value := created_at_value + make_interval(secs => p_ttl_seconds);
  insert into public.media_reference_write_leases (
    lease_token,
    asset_id,
    domain_key,
    entity_type,
    entity_identity,
    write_targets,
    synchronized_targets,
    actor_id,
    request_identity,
    provider,
    environment,
    environment_key,
    provider_registry_version,
    started_at,
    expires_at
  )
  select
    created_token,
    grouped.asset_id,
    (grouped.ordered_targets->0)->>'domainKey',
    (grouped.ordered_targets->0)->>'entityType',
    (grouped.ordered_targets->0)->>'entityIdentity',
    grouped.ordered_targets,
    '[]'::jsonb,
    p_actor_id,
    nullif(trim(p_request_identity), ''),
    trim(p_expected_provider),
    trim(p_expected_environment),
    trim(p_expected_environment_key),
    trim(p_expected_provider_registry_version),
    created_at_value,
    expires_at_value
  from (
    select
      asset.id as asset_id,
      jsonb_agg(
        jsonb_build_object(
          'domainKey', trim(target->>'domainKey'),
          'entityType', trim(target->>'entityType'),
          'entityIdentity', trim(target->>'entityIdentity')
        )
        order by trim(target->>'domainKey'), trim(target->>'entityType'), trim(target->>'entityIdentity')
      ) as ordered_targets
    from jsonb_array_elements(p_targets) target
    join public.media_assets asset
      on asset.provider = target->>'provider'
      and asset.bucket = target->>'bucket'
      and asset.object_key = target->>'objectKey'
    group by asset.id
  ) grouped
  order by grouped.asset_id;

  return query select created_token, requested_asset_count, created_at_value, expires_at_value;
end;
$$;

revoke all on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text)
  to service_role;

comment on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text) is
  'Acquires ordinary attachment leases from target-local catalog safety and direct conflict checks; global readiness remains a safe-delete concern.';

commit;

-- Rollback policy: restoring the previous function body is metadata-safe. No
-- catalog, object, reference, or domain data is rewritten by this migration.
