-- Usage is advisory only after explicit confirmation. All identity, lease, runtime and Storage guards remain.
begin;
alter table public.media_delete_reservations add column usage_confirmed boolean not null default false;
alter table public.media_folders add column deleted_at timestamptz;
drop function public.reserve_media_asset_deletion(uuid,bigint,text,text,text,text,text,text,text,text);

create or replace function public.reserve_media_asset_deletion(
  p_asset_id uuid,
  p_actor_id bigint default null,
  p_request_identity text default null,
  p_expected_asset_provider text default null,
  p_expected_asset_bucket text default null,
  p_expected_asset_object_key text default null,
  p_expected_provider text default null,
  p_expected_environment text default null,
  p_expected_environment_key text default null,
  p_expected_provider_registry_version text default null,
  p_confirm_referenced boolean default false
)
returns table (
  reservation_id uuid,
  reserved_asset_id uuid,
  reservation_status text,
  asset_status text,
  reserved_provider text,
  reserved_bucket text,
  reserved_object_key text,
  reserved_public_url text,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asset public.media_assets%rowtype;
  created_reservation public.media_delete_reservations%rowtype;
begin
  if (
    p_request_identity is not null
    and char_length(trim(p_request_identity)) not between 1 and 160
  )
    or coalesce(trim(p_expected_asset_provider), '') = ''
    or coalesce(trim(p_expected_asset_bucket), '') = ''
    or coalesce(trim(p_expected_asset_object_key), '') = ''
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_delete_reservation_input';
  end if;

  perform public.assert_media_catalog_coordination_ready(
    p_expected_provider,
    p_expected_environment,
    p_expected_environment_key,
    p_expected_provider_registry_version
  );

  select *
  into target_asset
  from public.media_assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'media_delete_asset_not_found';
  end if;

  if target_asset.provider <> trim(p_expected_asset_provider)
    or target_asset.bucket <> trim(p_expected_asset_bucket)
    or target_asset.object_key <> trim(p_expected_asset_object_key)
  then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_identity_changed';
  end if;

  if target_asset.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'media_delete_asset_not_active',
      detail = jsonb_build_object('assetId', p_asset_id, 'status', target_asset.status)::text;
  end if;

  if target_asset.missing_object or target_asset.reconciliation_state <> 'synced' then
    raise exception using
      errcode = 'P0001',
      message = 'media_delete_asset_uncertain',
      detail = jsonb_build_object(
        'assetId', p_asset_id,
        'reconciliationState', target_asset.reconciliation_state,
        'missingObject', target_asset.missing_object
      )::text;
  end if;

  if exists (
    select 1
    from public.media_delete_reservations reservation
    where reservation.asset_id = p_asset_id
      and reservation.status = 'reserved'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'media_delete_asset_already_reserved';
  end if;

  if not coalesce(p_confirm_referenced, false) and exists (
    select 1
    from public.media_references reference
    where reference.asset_id = p_asset_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'media_delete_asset_in_use';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.asset_id = p_asset_id
      and (
        lease.status = 'active'
        or (lease.status in ('failed', 'expired') and lease.resolved_at is null)
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'media_delete_write_lease_unresolved';
  end if;

  insert into public.media_delete_reservations (
    asset_id,
    previous_asset_status,
    previous_reconciliation_state,
    previous_missing_object,
    actor_id,
    request_identity,
    provider,
    reserved_bucket,
    reserved_object_key,
    reserved_public_url,
    environment,
    environment_key,
    provider_registry_version,
    usage_confirmed
  )
  values (
    p_asset_id,
    target_asset.status,
    target_asset.reconciliation_state,
    target_asset.missing_object,
    p_actor_id,
    nullif(trim(p_request_identity), ''),
    trim(p_expected_provider),
    target_asset.bucket,
    target_asset.object_key,
    target_asset.public_url,
    trim(p_expected_environment),
    trim(p_expected_environment_key),
    trim(p_expected_provider_registry_version),
    coalesce(p_confirm_referenced, false)
  )
  returning * into created_reservation;

  update public.media_assets
  set status = 'deleting'
  where id = p_asset_id;

  return query
  select
    created_reservation.id,
    created_reservation.asset_id,
    created_reservation.status,
    'deleting'::text,
    target_asset.provider,
    target_asset.bucket,
    target_asset.object_key,
    target_asset.public_url,
    created_reservation.started_at;
end;
$$;

create or replace function public.finalize_media_asset_deletion(
  p_asset_id uuid,
  p_reservation_id uuid,
  p_storage_state text,
  p_storage_verified_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asset public.media_assets%rowtype;
  target_reservation public.media_delete_reservations%rowtype;
begin
  if p_storage_state is distinct from 'missing'
    or p_storage_verified_at is null
    or p_storage_verified_at < clock_timestamp() - interval '5 minutes'
    or p_storage_verified_at > clock_timestamp() + interval '1 minute'
  then
    raise exception using errcode = 'P0001', message = 'media_delete_storage_absence_not_proven';
  end if;

  select * into target_asset
  from public.media_assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_not_found';
  end if;

  select * into target_reservation
  from public.media_delete_reservations
  where id = p_reservation_id
    and asset_id = p_asset_id
  for update;

  if not found or target_reservation.status <> 'reserved' then
    raise exception using errcode = 'P0001', message = 'media_delete_reservation_not_active';
  end if;

  if target_asset.provider <> target_reservation.provider
    or target_asset.bucket <> target_reservation.reserved_bucket
    or target_asset.object_key <> target_reservation.reserved_object_key
    or target_asset.public_url <> target_reservation.reserved_public_url
  then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_identity_changed';
  end if;

  if target_asset.status <> 'deleting' then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_not_reserved';
  end if;

  if not target_reservation.usage_confirmed and exists (
    select 1 from public.media_references reference where reference.asset_id = p_asset_id
  ) then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_in_use';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.asset_id = p_asset_id
      and (
        lease.status = 'active'
        or (lease.status in ('failed', 'expired') and lease.resolved_at is null)
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_delete_write_lease_unresolved';
  end if;

  update public.media_assets
  set
    status = 'deleted',
    metadata = metadata || jsonb_build_object('usageConfirmedDeletion', target_reservation.usage_confirmed),
    reconciliation_state = 'synced',
    missing_object = false
  where id = p_asset_id;

  update public.media_delete_reservations
  set status = 'completed', finished_at = now()
  where id = p_reservation_id;

  return 'deleted';
end;
$$;

create or replace function public.repair_media_delete_reservation(
  p_asset_id uuid,
  p_reservation_id uuid,
  p_action text,
  p_storage_state text,
  p_storage_verified_at timestamptz,
  p_repair_metadata jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asset public.media_assets%rowtype;
  target_reservation public.media_delete_reservations%rowtype;
begin
  if p_action is null
    or p_action not in ('cancel', 'finalize', 'confirm_missing')
    or p_storage_state is null
    or p_storage_state not in ('exists', 'missing')
    or p_storage_verified_at is null
    or p_storage_verified_at < clock_timestamp() - interval '5 minutes'
    or p_storage_verified_at > clock_timestamp() + interval '1 minute'
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_delete_repair_input';
  end if;

  select * into target_asset
  from public.media_assets
  where id = p_asset_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_not_found';
  end if;

  select * into target_reservation
  from public.media_delete_reservations
  where id = p_reservation_id
    and asset_id = p_asset_id
  for update;
  if not found or target_reservation.status not in ('reserved', 'recovery_required') then
    raise exception using errcode = 'P0001', message = 'media_delete_reservation_not_repairable';
  end if;

  if target_asset.provider <> target_reservation.provider
    or target_asset.bucket <> target_reservation.reserved_bucket
    or target_asset.object_key <> target_reservation.reserved_object_key
    or target_asset.public_url <> target_reservation.reserved_public_url
  then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_identity_changed';
  end if;

  if not target_reservation.usage_confirmed and exists (
    select 1 from public.media_references reference where reference.asset_id = p_asset_id
  ) then
    raise exception using errcode = 'P0001', message = 'media_delete_asset_in_use';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.asset_id = p_asset_id
      and (
        lease.status = 'active'
        or (lease.status in ('failed', 'expired') and lease.resolved_at is null)
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_delete_write_lease_unresolved';
  end if;

  if p_action = 'cancel' then
    if p_storage_state is distinct from 'exists' then
      raise exception using errcode = 'P0001', message = 'media_delete_storage_existence_not_proven';
    end if;
    update public.media_assets
    set
      status = 'active',
      reconciliation_state = 'synced',
      missing_object = false
    where id = p_asset_id;
    update public.media_delete_reservations
    set
      status = 'cancelled',
      finished_at = now(),
      failure_code = 'media_delete_repair_cancelled',
      failure_metadata = coalesce(p_repair_metadata, '{}'::jsonb) || jsonb_build_object(
        'storageState', p_storage_state,
        'storageVerifiedAt', p_storage_verified_at
      )
    where id = p_reservation_id;
    return 'active';
  end if;

  if p_storage_state is distinct from 'missing' then
    raise exception using errcode = 'P0001', message = 'media_delete_storage_absence_not_proven';
  end if;

  if p_action = 'finalize' then
    update public.media_assets
    set
      status = 'deleted',
    metadata = metadata || jsonb_build_object('usageConfirmedDeletion', target_reservation.usage_confirmed),
      reconciliation_state = 'synced',
      missing_object = false
    where id = p_asset_id;
    update public.media_delete_reservations
    set
      status = 'completed',
      finished_at = now(),
      failure_metadata = coalesce(p_repair_metadata, '{}'::jsonb) || jsonb_build_object(
        'storageState', p_storage_state,
        'storageVerifiedAt', p_storage_verified_at,
        'repaired', true
      )
    where id = p_reservation_id;
    return 'deleted';
  end if;

  update public.media_assets
  set
    status = 'missing',
    reconciliation_state = 'uncertain',
    missing_object = true
  where id = p_asset_id;
  update public.media_delete_reservations
  set
    status = 'missing_confirmed',
    finished_at = now(),
    failure_code = coalesce(failure_code, 'media_delete_storage_missing_confirmed'),
    failure_metadata = coalesce(p_repair_metadata, '{}'::jsonb) || jsonb_build_object(
      'storageState', p_storage_state,
      'storageVerifiedAt', p_storage_verified_at
    )
  where id = p_reservation_id;
  return 'missing';
end;
$$;

create or replace function public.replace_media_references_for_provider(
  p_domain_key text,
  p_references jsonb,
  p_reconciliation_run_identity uuid,
  p_expected_provider_revision bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
  requested_asset_count integer := 0;
  requested_existing_asset_count integer := 0;
  locked_asset_count integer := 0;
  coordination_asset_count integer := 0;
  coordination_asset_ids uuid[] := '{}'::uuid[];
  blocked_asset_id uuid;
  blocked_asset_status text;
  current_provider_revision bigint;
begin
  if coalesce(trim(p_domain_key), '') = ''
    or p_reconciliation_run_identity is null
    or p_expected_provider_revision is null
    or p_expected_provider_revision < 0
    or p_references is null
    or jsonb_typeof(p_references) <> 'array'
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_provider_synchronization_input';
  end if;

  p_domain_key := trim(p_domain_key);

  if exists (
    select 1
    from jsonb_array_elements(p_references) entry
    where jsonb_typeof(entry) <> 'object'
      or coalesce(trim(entry->>'assetId'), '') = ''
      or entry->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(trim(entry->>'entityType'), '') = ''
      or coalesce(trim(entry->>'entityIdentity'), '') = ''
      or coalesce(trim(entry->>'fieldKey'), '') = ''
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_media_provider_reference_entry';
  end if;

  insert into public.media_reference_provider_revisions (domain_key, revision)
  values (trim(p_domain_key), 0)
  on conflict (domain_key) do nothing;

  select revision
  into current_provider_revision
  from public.media_reference_provider_revisions
  where domain_key = trim(p_domain_key)
  for update;

  if current_provider_revision is distinct from p_expected_provider_revision then
    raise exception using
      errcode = 'P0001',
      message = 'media_reconciliation_snapshot_stale',
      detail = jsonb_build_object(
        'domainKey', trim(p_domain_key),
        'expectedRevision', p_expected_provider_revision,
        'currentRevision', current_provider_revision,
        'runIdentity', p_reconciliation_run_identity
      )::text;
  end if;

  select count(distinct (entry->>'assetId')::uuid)
  into requested_asset_count
  from jsonb_array_elements(p_references) entry
  where coalesce(entry->>'assetId', '') <> '';

  select count(distinct asset.id)
  into requested_existing_asset_count
  from public.media_assets asset
  where asset.id in (
    select distinct (entry->>'assetId')::uuid
    from jsonb_array_elements(p_references) entry
    where coalesce(entry->>'assetId', '') <> ''
  );

  if requested_existing_asset_count <> requested_asset_count then
    raise exception using errcode = 'P0001', message = 'media_reference_asset_missing';
  end if;

  select coalesce(array_agg(asset_id order by asset_id), '{}'::uuid[])
  into coordination_asset_ids
  from (
    select distinct (entry->>'assetId')::uuid as asset_id
    from jsonb_array_elements(p_references) entry
    where coalesce(entry->>'assetId', '') <> ''
    union
    select distinct reference.asset_id
    from public.media_references reference
    where reference.domain_key = p_domain_key
  ) coordinated;
  coordination_asset_count := cardinality(coordination_asset_ids);

  perform asset.id
  from public.media_assets asset
  where asset.id = any(coordination_asset_ids)
  order by asset.id
  for update;
  get diagnostics locked_asset_count = row_count;

  if locked_asset_count <> coordination_asset_count then
    raise exception using errcode = 'P0001', message = 'media_reference_asset_missing';
  end if;

  select asset.id, asset.status
  into blocked_asset_id, blocked_asset_status
  from public.media_assets asset
  where asset.id = any(coordination_asset_ids)
    and asset.status <> 'active'
    and not (asset.status = 'deleted' and coalesce(asset.metadata->>'usageConfirmedDeletion', 'false') = 'true')
  order by asset.id
  limit 1;

  if blocked_asset_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'media_reference_asset_not_active',
      detail = jsonb_build_object('assetId', blocked_asset_id, 'status', blocked_asset_status)::text;
  end if;

  if exists (
    select 1
    from public.media_delete_reservations reservation
    where reservation.asset_id = any(coordination_asset_ids)
      and reservation.status = 'reserved'
  ) then
    raise exception using errcode = 'P0001', message = 'media_reconciliation_delete_reserved';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.status = 'active'
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = trim(p_domain_key)
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_reconciliation_write_lease_active';
  end if;

  delete from public.media_references where domain_key = p_domain_key;

  insert into public.media_references (
    asset_id, domain_key, entity_type, entity_identity, entity_label,
    field_key, edit_href, public_href, reference_state, restorable, metadata
  )
  select
    (entry->>'assetId')::uuid,
    p_domain_key,
    entry->>'entityType',
    entry->>'entityIdentity',
    nullif(entry->>'entityLabel', ''),
    entry->>'fieldKey',
    nullif(entry->>'editHref', ''),
    nullif(entry->>'publicHref', ''),
    coalesce(nullif(entry->>'referenceState', ''), 'active'),
    coalesce((entry->>'restorable')::boolean, false),
    coalesce(entry->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
  where coalesce(entry->>'assetId', '') <> ''
    and coalesce(entry->>'entityType', '') <> ''
    and coalesce(entry->>'entityIdentity', '') <> ''
    and coalesce(entry->>'fieldKey', '') <> ''
  on conflict (asset_id, domain_key, entity_type, entity_identity, field_key)
  do update set
    entity_label = excluded.entity_label,
    edit_href = excluded.edit_href,
    public_href = excluded.public_href,
    reference_state = excluded.reference_state,
    restorable = excluded.restorable,
    metadata = excluded.metadata,
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.replace_media_references_for_entity(
  p_domain_key text,
  p_entity_type text,
  p_entity_identity text,
  p_references jsonb,
  p_lease_token uuid,
  p_lease_entity_identity text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
  requested_asset_count integer := 0;
  lease_required_asset_count integer := 0;
  locked_asset_count integer := 0;
  leased_asset_count integer := 0;
  expected_target_asset_count integer := 0;
  blocked_asset_id uuid;
  blocked_asset_status text;
begin
  if coalesce(trim(p_domain_key), '') = ''
    or coalesce(trim(p_entity_type), '') = ''
    or coalesce(trim(p_entity_identity), '') = ''
    or (p_lease_token is not null and coalesce(trim(p_lease_entity_identity), '') = '')
    or p_references is null
    or jsonb_typeof(p_references) <> 'array'
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_reference_synchronization_input';
  end if;

  p_domain_key := trim(p_domain_key);

  if exists (
    select 1
    from jsonb_array_elements(p_references) entry
    where jsonb_typeof(entry) <> 'object'
      or coalesce(trim(entry->>'assetId'), '') = ''
      or entry->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(trim(entry->>'fieldKey'), '') = ''
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_media_reference_entry';
  end if;

  insert into public.media_reference_provider_revisions (domain_key, revision)
  values (p_domain_key, 0)
  on conflict (domain_key) do nothing;

  perform revision
  from public.media_reference_provider_revisions
  where domain_key = p_domain_key
  for update;

  select
    count(distinct requested.asset_id),
    count(distinct requested.asset_id) filter (where asset.provider = 'supabase' and asset.status <> 'deleted')
  into requested_asset_count, lease_required_asset_count
  from (
    select distinct (entry->>'assetId')::uuid as asset_id
    from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
    where coalesce(entry->>'assetId', '') <> ''
  ) requested
  left join public.media_assets asset on asset.id = requested.asset_id;

  perform asset.id
  from public.media_assets asset
  where asset.id in (
    select distinct (entry->>'assetId')::uuid
    from jsonb_array_elements(p_references) entry
    where coalesce(entry->>'assetId', '') <> ''
  )
  order by asset.id
  for update;
  get diagnostics locked_asset_count = row_count;

  if locked_asset_count <> requested_asset_count then
    raise exception using errcode = 'P0001', message = 'media_reference_asset_missing';
  end if;

  select asset.id, asset.status
  into blocked_asset_id, blocked_asset_status
  from public.media_assets asset
  where asset.id in (
    select distinct (entry->>'assetId')::uuid
    from jsonb_array_elements(p_references) entry
    where coalesce(entry->>'assetId', '') <> ''
  )
    and asset.status <> 'active'
    and not (asset.status = 'deleted' and coalesce(asset.metadata->>'usageConfirmedDeletion', 'false') = 'true')
  order by asset.id
  limit 1;

  if blocked_asset_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'media_reference_asset_not_active',
      detail = jsonb_build_object('assetId', blocked_asset_id, 'status', blocked_asset_status)::text;
  end if;

  if exists (
    select 1
    from public.media_delete_reservations reservation
    where reservation.asset_id in (
      select distinct (entry->>'assetId')::uuid
      from jsonb_array_elements(p_references) entry
      where coalesce(entry->>'assetId', '') <> ''
    )
      and reservation.status = 'reserved'
  ) then
    raise exception using errcode = 'P0001', message = 'media_reference_delete_reserved';
  end if;

  if lease_required_asset_count > 0 then
    if p_lease_token is null then
      raise exception using errcode = 'P0001', message = 'media_reference_write_lease_required';
    end if;

    select count(distinct lease.asset_id)
    into leased_asset_count
    from public.media_reference_write_leases lease
    join public.media_assets asset on asset.id = lease.asset_id
    where lease.lease_token = p_lease_token
      and lease.status = 'active'
      and lease.expires_at > clock_timestamp()
      and asset.provider = 'supabase' and asset.status <> 'deleted'
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = p_domain_key
          and target->>'entityType' = p_entity_type
          and target->>'entityIdentity' = p_lease_entity_identity
      )
      and lease.asset_id in (
        select distinct (entry->>'assetId')::uuid
        from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
        where coalesce(entry->>'assetId', '') <> ''
      );

    select count(distinct lease.asset_id)
    into expected_target_asset_count
    from public.media_reference_write_leases lease
    join public.media_assets asset on asset.id = lease.asset_id
    where lease.lease_token = p_lease_token
      and lease.status = 'active'
      and lease.expires_at > clock_timestamp()
      and asset.provider = 'supabase' and asset.status <> 'deleted'
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = p_domain_key
          and target->>'entityType' = p_entity_type
          and target->>'entityIdentity' = p_lease_entity_identity
      );

    if leased_asset_count <> lease_required_asset_count
      or expected_target_asset_count <> lease_required_asset_count
    then
      raise exception using errcode = 'P0001', message = 'media_reference_write_lease_mismatch';
    end if;
  end if;

  delete from public.media_references
  where domain_key = p_domain_key
    and entity_type = p_entity_type
    and entity_identity = p_entity_identity;

  insert into public.media_references (
    asset_id, domain_key, entity_type, entity_identity, entity_label,
    field_key, edit_href, public_href, reference_state, restorable, metadata
  )
  select
    (entry->>'assetId')::uuid,
    p_domain_key,
    p_entity_type,
    p_entity_identity,
    nullif(entry->>'entityLabel', ''),
    entry->>'fieldKey',
    nullif(entry->>'editHref', ''),
    nullif(entry->>'publicHref', ''),
    coalesce(nullif(entry->>'referenceState', ''), 'active'),
    coalesce((entry->>'restorable')::boolean, false),
    coalesce(entry->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
  where coalesce(entry->>'assetId', '') <> ''
    and coalesce(entry->>'fieldKey', '') <> ''
  on conflict (asset_id, domain_key, entity_type, entity_identity, field_key)
  do update set
    entity_label = excluded.entity_label,
    edit_href = excluded.edit_href,
    public_href = excluded.public_href,
    reference_state = excluded.reference_state,
    restorable = excluded.restorable,
    metadata = excluded.metadata,
    updated_at = now();

  get diagnostics inserted_count = row_count;

  if p_lease_token is not null then
    update public.media_reference_write_leases lease
    set synchronized_targets = case
      when exists (
        select 1
        from jsonb_array_elements(lease.synchronized_targets) synchronized
        where synchronized->>'domainKey' = p_domain_key
          and synchronized->>'entityType' = p_entity_type
          and synchronized->>'entityIdentity' = p_lease_entity_identity
      ) then lease.synchronized_targets
      else lease.synchronized_targets || jsonb_build_array(jsonb_build_object(
        'domainKey', p_domain_key,
        'entityType', p_entity_type,
        'entityIdentity', p_lease_entity_identity
      ))
    end
    where lease.lease_token = p_lease_token
      and lease.status = 'active'
      and lease.expires_at > clock_timestamp()
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = p_domain_key
          and target->>'entityType' = p_entity_type
          and target->>'entityIdentity' = p_lease_entity_identity
      );
  end if;

  update public.media_reference_provider_revisions
  set revision = revision + 1
  where domain_key = p_domain_key;

  return inserted_count;
end;
$$;

create or replace view public.admin_media_folders_catalog
with (security_invoker = true)
as
select
  f.id, f.normalized_path, f.parent_path, f.display_name, f.created_by,
  f.reconciliation_state, f.created_at, f.updated_at,
  (
    select count(*)::bigint
    from public.media_folders child
    where child.parent_path = f.normalized_path and child.deleted_at is null
  ) as child_folder_count,
  (
    select count(*)::bigint
    from public.media_assets a
    where a.folder_path = f.normalized_path
      and a.status <> 'deleted'
  ) as direct_asset_count,
  (
    select coalesce(sum(a.byte_size), 0)::bigint
    from public.media_assets a
    where a.folder_path = f.normalized_path
      and a.status <> 'deleted'
  ) as direct_total_bytes
from public.media_folders f where f.deleted_at is null;

revoke all on function public.reserve_media_asset_deletion(uuid,bigint,text,text,text,text,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.reserve_media_asset_deletion(uuid,bigint,text,text,text,text,text,text,text,text,boolean) to service_role;
create or replace function public.retire_empty_media_folder(p_folder text)
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  if p_folder is null or p_folder !~ '^(images|files)/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$'
    or p_folder ~ '(^|/)\.\.?(/|$)' then
    raise exception 'invalid_media_folder_delete_target';
  end if;
  lock table public.media_assets, public.media_folders in share row exclusive mode;
  if not exists (select 1 from public.media_folders where normalized_path=p_folder and deleted_at is null) then
    raise exception 'media_folder_not_found';
  end if;
  if exists (select 1 from public.media_assets where status <> 'deleted'
    and (folder_path=p_folder or left(folder_path,length(p_folder)+1)=p_folder||'/')) then
    raise exception 'media_folder_not_empty';
  end if;
  update public.media_folders set deleted_at=now()
  where deleted_at is null and (normalized_path=p_folder or left(normalized_path,length(p_folder)+1)=p_folder||'/');
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.retire_empty_media_folder(text) from public, anon, authenticated;
grant execute on function public.retire_empty_media_folder(text) to service_role;

-- Registration after a concurrent folder retirement restores the existing path.
-- The asset write and folder revival commit together, so active assets cannot
-- become invisible behind a retired folder.
create or replace function public.revive_media_asset_folder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'deleted' then
    update public.media_folders set deleted_at = null
    where deleted_at is not null and
      (normalized_path = new.folder_path or left(new.folder_path,length(normalized_path)+1)=normalized_path||'/');
  end if;
  return new;
end;
$$;
revoke all on function public.revive_media_asset_folder() from public, anon, authenticated;
create trigger media_asset_revives_folder
before insert or update of folder_path, status on public.media_assets
for each row execute function public.revive_media_asset_folder();

-- CREATE OR REPLACE preserves ACLs, but restate the current boundary explicitly.
revoke all on function public.finalize_media_asset_deletion(uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_media_asset_deletion(uuid,uuid,text,timestamptz) to service_role;
revoke all on function public.repair_media_delete_reservation(uuid,uuid,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.repair_media_delete_reservation(uuid,uuid,text,text,timestamptz,jsonb) to service_role;
revoke all on function public.replace_media_references_for_entity(text,text,text,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.replace_media_references_for_entity(text,text,text,jsonb,uuid,text) to service_role;
revoke all on function public.replace_media_references_for_provider(text,jsonb,uuid,bigint) from public, anon, authenticated;
grant execute on function public.replace_media_references_for_provider(text,jsonb,uuid,bigint) to service_role;
grant execute on function public.revive_media_asset_folder() to service_role;

commit;
