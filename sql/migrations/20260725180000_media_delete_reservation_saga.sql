-- Media write/delete coordination and recovery correction.
-- Forward-only and limited to deletion reservations, reference locking, and
-- lease-bound physical identity transitions.
-- This migration does not seed data, alter provider scope, or repair migration history.

begin;

create table if not exists public.media_delete_reservations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  status text not null default 'reserved'
    check (status in ('reserved', 'cancelled', 'completed', 'recovery_required', 'missing_confirmed')),
  previous_asset_status text not null,
  previous_reconciliation_state text not null,
  previous_missing_object boolean not null,
  actor_id bigint references public.admin_users(id) on delete set null,
  request_identity text,
  provider text not null,
  reserved_bucket text not null,
  reserved_object_key text not null,
  reserved_public_url text not null,
  environment text not null,
  environment_key text not null,
  provider_registry_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  failure_code text,
  failure_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_delete_reservations_request_identity_check check (
    request_identity is null or char_length(request_identity) between 1 and 160
  ),
  constraint media_delete_reservations_context_check check (
    provider = 'supabase'
    and char_length(trim(reserved_bucket)) between 1 and 120
    and char_length(trim(reserved_object_key)) between 1 and 1024
    and char_length(trim(reserved_public_url)) between 1 and 2048
    and char_length(trim(environment)) between 1 and 40
    and char_length(trim(environment_key)) between 1 and 240
    and char_length(trim(provider_registry_version)) between 1 and 160
  )
);

create table if not exists public.media_reference_write_leases (
  id uuid primary key default gen_random_uuid(),
  lease_token uuid not null,
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  domain_key text not null,
  entity_type text not null,
  entity_identity text not null,
  write_targets jsonb not null default '[]'::jsonb,
  synchronized_targets jsonb not null default '[]'::jsonb,
  actor_id bigint references public.admin_users(id) on delete set null,
  request_identity text,
  provider text not null,
  environment text not null,
  environment_key text not null,
  provider_registry_version text not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'failed', 'expired', 'reconciled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  resolved_at timestamptz,
  failure_code text,
  failure_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_reference_write_leases_token_asset_unique
    unique (lease_token, asset_id),
  constraint media_reference_write_leases_identity_check check (
    char_length(trim(domain_key)) between 1 and 120
    and char_length(trim(entity_type)) between 1 and 120
    and char_length(trim(entity_identity)) between 1 and 240
  ),
  constraint media_reference_write_leases_request_identity_check check (
    request_identity is null or char_length(request_identity) between 1 and 160
  ),
  constraint media_reference_write_leases_context_check check (
    provider = 'supabase'
    and char_length(trim(environment)) between 1 and 40
    and char_length(trim(environment_key)) between 1 and 240
    and char_length(trim(provider_registry_version)) between 1 and 160
  ),
  constraint media_reference_write_leases_expiry_check check (expires_at > started_at),
  constraint media_reference_write_leases_targets_check check (
    jsonb_typeof(write_targets) = 'array' and jsonb_array_length(write_targets) > 0
    and jsonb_typeof(synchronized_targets) = 'array'
  )
);

create table if not exists public.media_reference_provider_revisions (
  domain_key text primary key,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_reference_provider_revisions_domain_check check (
    char_length(trim(domain_key)) between 1 and 120
  )
);

create unique index if not exists media_delete_reservations_one_active_per_asset_idx
  on public.media_delete_reservations(asset_id)
  where status = 'reserved';

create index if not exists media_delete_reservations_status_started_idx
  on public.media_delete_reservations(status, started_at desc);

create unique index if not exists media_reference_write_leases_one_active_per_asset_idx
  on public.media_reference_write_leases(asset_id)
  where status = 'active';

create index if not exists media_reference_write_leases_asset_state_idx
  on public.media_reference_write_leases(asset_id, status, expires_at);

create index if not exists media_reference_write_leases_state_expiry_idx
  on public.media_reference_write_leases(status, expires_at, started_at desc);

create index if not exists media_reference_write_leases_token_state_idx
  on public.media_reference_write_leases(lease_token, status);

create index if not exists media_assets_recovery_queue_idx
  on public.media_assets(status, reconciliation_state, updated_at desc)
  where status in ('deleting', 'missing') or reconciliation_state = 'uncertain';

drop trigger if exists media_delete_reservations_set_updated_at on public.media_delete_reservations;
create trigger media_delete_reservations_set_updated_at
before update on public.media_delete_reservations
for each row execute function public.set_media_catalog_updated_at();

drop trigger if exists media_reference_write_leases_set_updated_at on public.media_reference_write_leases;
create trigger media_reference_write_leases_set_updated_at
before update on public.media_reference_write_leases
for each row execute function public.set_media_catalog_updated_at();

drop trigger if exists media_reference_provider_revisions_set_updated_at on public.media_reference_provider_revisions;
create trigger media_reference_provider_revisions_set_updated_at
before update on public.media_reference_provider_revisions
for each row execute function public.set_media_catalog_updated_at();

create or replace function public.assert_media_catalog_coordination_ready(
  p_expected_provider text,
  p_expected_environment text,
  p_expected_environment_key text,
  p_expected_provider_registry_version text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog_state jsonb;
begin
  if coalesce(trim(p_expected_provider), '') = ''
    or coalesce(trim(p_expected_environment), '') = ''
    or coalesce(trim(p_expected_environment_key), '') = ''
    or coalesce(trim(p_expected_provider_registry_version), '') = ''
  then
    raise exception using
      errcode = 'P0001',
      message = 'media_catalog_environment_unproven';
  end if;

  select value into catalog_state
  from public.site_settings
  where key = 'media.catalog_state'
  for share;

  if catalog_state is null
    or coalesce(catalog_state->>'state', '') <> 'synced'
    or coalesce(catalog_state->>'provider', '') <> trim(p_expected_provider)
    or coalesce(catalog_state->>'environment', '') <> trim(p_expected_environment)
    or coalesce(catalog_state->>'environmentKey', '') <> trim(p_expected_environment_key)
    or coalesce(catalog_state->>'providerRegistryVersion', '') <> trim(p_expected_provider_registry_version)
  then
    raise exception using
      errcode = 'P0001',
      message = 'media_catalog_runtime_uncertain';
  end if;
end;
$$;

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
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_write_lease_input';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_targets) target
    where coalesce(target->>'provider', '') <> 'supabase'
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

  perform public.assert_media_catalog_coordination_ready(
    p_expected_provider,
    p_expected_environment,
    p_expected_environment_key,
    p_expected_provider_registry_version
  );

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
      or asset.reconciliation_state <> 'synced'
    )
  order by asset.id
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = case
        when blocked_asset.status <> 'active' then 'media_write_lease_asset_not_active'
        when blocked_asset.missing_object then 'media_write_lease_asset_missing_from_storage'
        else 'media_write_lease_asset_uncertain'
      end,
      detail = jsonb_build_object(
        'assetId', blocked_asset.id,
        'status', blocked_asset.status,
        'reconciliationState', blocked_asset.reconciliation_state,
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

create or replace function public.complete_media_reference_write_lease(
  p_lease_token uuid,
  p_entity_identity text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
  lease_row_count integer := 0;
  completable_row_count integer := 0;
begin
  if p_lease_token is null or coalesce(trim(p_entity_identity), '') = '' then
    raise exception using errcode = 'P0001', message = 'invalid_media_write_lease_completion';
  end if;

  perform asset.id
  from public.media_assets asset
  join public.media_reference_write_leases lease on lease.asset_id = asset.id
  where lease.lease_token = p_lease_token
  order by asset.id
  for update of asset;

  select
    count(*),
    count(*) filter (
      where lease.status = 'active'
        and lease.expires_at > clock_timestamp()
    )
  into lease_row_count, completable_row_count
  from public.media_reference_write_leases lease
  where lease.lease_token = p_lease_token;

  if lease_row_count = 0 or completable_row_count <> lease_row_count then
    raise exception using errcode = 'P0001', message = 'media_write_lease_not_active';
  end if;

  if not exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.lease_token = p_lease_token
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'entityIdentity' = p_entity_identity
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_identity_mismatch';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.lease_token = p_lease_token
      and lease.status = 'active'
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where not exists (
          select 1
          from jsonb_array_elements(lease.synchronized_targets) synchronized
          where synchronized->>'domainKey' = target->>'domainKey'
            and synchronized->>'entityType' = target->>'entityType'
            and synchronized->>'entityIdentity' = target->>'entityIdentity'
        )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_sync_incomplete';
  end if;

  update public.media_reference_write_leases lease
  set
    status = 'completed',
    completed_at = now()
  where lease.lease_token = p_lease_token
    and lease.status = 'active'
    and lease.expires_at > clock_timestamp();
  get diagnostics affected_count = row_count;

  if affected_count <> lease_row_count then
    raise exception using errcode = 'P0001', message = 'media_write_lease_not_active';
  end if;
  return affected_count;
end;
$$;

create or replace function public.fail_media_reference_write_lease(
  p_lease_token uuid,
  p_entity_identity text,
  p_failure_code text,
  p_failure_metadata jsonb default '{}'::jsonb,
  p_domain_write_committed boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
  lease_row_count integer := 0;
  failable_row_count integer := 0;
begin
  if p_lease_token is null
    or coalesce(trim(p_entity_identity), '') = ''
    or coalesce(trim(p_failure_code), '') = ''
    or p_domain_write_committed is null
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_write_lease_failure';
  end if;

  -- Match entity/provider synchronization's revision-before-asset lock order.
  -- A failed lease means the provider snapshot captured before this transition
  -- can no longer be called authoritative, even when the Domain write outcome
  -- is unknown or the caller reports that it did not commit.
  insert into public.media_reference_provider_revisions (domain_key, revision)
  select distinct trim(target->>'domainKey'), 0
  from public.media_reference_write_leases lease
  cross join lateral jsonb_array_elements(lease.write_targets) target
  where lease.lease_token = p_lease_token
    and coalesce(trim(target->>'domainKey'), '') <> ''
  order by 1
  on conflict (domain_key) do nothing;

  perform revision.domain_key
  from public.media_reference_provider_revisions revision
  where revision.domain_key in (
    select distinct trim(target->>'domainKey')
    from public.media_reference_write_leases lease
    cross join lateral jsonb_array_elements(lease.write_targets) target
    where lease.lease_token = p_lease_token
      and coalesce(trim(target->>'domainKey'), '') <> ''
  )
  order by revision.domain_key
  for update;

  perform asset.id
  from public.media_assets asset
  join public.media_reference_write_leases lease on lease.asset_id = asset.id
  where lease.lease_token = p_lease_token
  order by asset.id
  for update of asset;

  select
    count(*),
    count(*) filter (where lease.status in ('active', 'expired'))
  into lease_row_count, failable_row_count
  from public.media_reference_write_leases lease
  where lease.lease_token = p_lease_token;

  if lease_row_count = 0 or failable_row_count <> lease_row_count then
    raise exception using errcode = 'P0001', message = 'media_write_lease_not_fail_safe';
  end if;

  if not exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.lease_token = p_lease_token
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'entityIdentity' = p_entity_identity
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_identity_mismatch';
  end if;

  update public.media_reference_write_leases lease
  set
    status = 'failed',
    completed_at = now(),
    resolved_at = case when p_domain_write_committed then null else now() end,
    failure_code = trim(p_failure_code),
    failure_metadata = coalesce(p_failure_metadata, '{}'::jsonb)
      || jsonb_build_object('domainWriteCommitted', p_domain_write_committed)
  where lease.lease_token = p_lease_token
    and lease.status in ('active', 'expired');
  get diagnostics affected_count = row_count;

  if affected_count <> lease_row_count then
    raise exception using errcode = 'P0001', message = 'media_write_lease_not_fail_safe';
  end if;

  update public.media_reference_provider_revisions revision
  set revision = revision.revision + 1
  where revision.domain_key in (
    select distinct trim(target->>'domainKey')
    from public.media_reference_write_leases lease
    cross join lateral jsonb_array_elements(lease.write_targets) target
    where lease.lease_token = p_lease_token
      and coalesce(trim(target->>'domainKey'), '') <> ''
  );

  return affected_count;
end;
$$;

create or replace function public.resolve_media_reference_write_lease(
  p_lease_token uuid,
  p_reconciliation_run_identity uuid,
  p_resolution_code text,
  p_entity_identity text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
  catalog_state jsonb;
  newest_failure_at timestamptz;
begin
  if p_lease_token is null
    or p_reconciliation_run_identity is null
    or coalesce(trim(p_resolution_code), '') = ''
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_write_lease_resolution';
  end if;

  perform asset.id
  from public.media_assets asset
  join public.media_reference_write_leases lease on lease.asset_id = asset.id
  where lease.lease_token = p_lease_token
  order by asset.id
  for update of asset;

  select value into catalog_state
  from public.site_settings
  where key = 'media.catalog_state'
  for share;

  select max(coalesce(lease.completed_at, lease.expires_at, lease.started_at))
  into newest_failure_at
  from public.media_reference_write_leases lease
  where lease.lease_token = p_lease_token
    and lease.status in ('failed', 'expired')
    and lease.resolved_at is null;

  if catalog_state is null
    or coalesce(catalog_state->>'state', '') <> 'synced'
    or coalesce(catalog_state->>'lastSuccessfulReconciliationRunIdentity', '') <> p_reconciliation_run_identity::text
    or coalesce(catalog_state->>'lastSuccessfulReconciliationAt', '') = ''
    or newest_failure_at is null
    or (catalog_state->>'lastSuccessfulReconciliationAt')::timestamptz <= newest_failure_at
  then
    raise exception using errcode = 'P0001', message = 'media_write_lease_reconciliation_not_proven';
  end if;

  if exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.lease_token = p_lease_token
      and (
        lease.provider <> catalog_state->>'provider'
        or lease.environment <> catalog_state->>'environment'
        or lease.environment_key <> catalog_state->>'environmentKey'
        or lease.provider_registry_version <> catalog_state->>'providerRegistryVersion'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_reconciliation_context_mismatch';
  end if;

  update public.media_reference_write_leases lease
  set
    status = 'reconciled',
    completed_at = coalesce(lease.completed_at, now()),
    resolved_at = now(),
    failure_metadata = lease.failure_metadata || jsonb_build_object(
      'resolutionCode', trim(p_resolution_code),
      'reconciliationRunIdentity', p_reconciliation_run_identity
    )
  where lease.lease_token = p_lease_token
    and lease.status in ('failed', 'expired')
    and lease.resolved_at is null;
  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    raise exception using errcode = 'P0001', message = 'media_write_lease_not_resolvable';
  end if;
  return affected_count;
end;
$$;

create or replace function public.transition_media_asset_identity_for_move(
  p_asset_id uuid,
  p_lease_token uuid,
  p_expected_provider text,
  p_expected_bucket text,
  p_expected_object_key text,
  p_expected_public_url text,
  p_next_bucket text,
  p_next_object_key text,
  p_next_public_url text,
  p_next_folder_path text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asset public.media_assets%rowtype;
  affected_count integer := 0;
  lease_affected_count integer := 0;
begin
  if p_asset_id is null
    or p_lease_token is null
    or coalesce(trim(p_expected_provider), '') = ''
    or coalesce(trim(p_expected_bucket), '') = ''
    or coalesce(trim(p_expected_object_key), '') = ''
    or coalesce(trim(p_expected_public_url), '') = ''
    or coalesce(trim(p_next_bucket), '') = ''
    or coalesce(trim(p_next_object_key), '') = ''
    or coalesce(trim(p_next_public_url), '') = ''
    or coalesce(trim(p_next_folder_path), '') = ''
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_physical_move_transition';
  end if;

  select * into target_asset
  from public.media_assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'media_physical_move_asset_missing';
  end if;

  if target_asset.provider <> trim(p_expected_provider)
    or target_asset.bucket <> trim(p_expected_bucket)
    or target_asset.object_key <> trim(p_expected_object_key)
    or target_asset.public_url <> trim(p_expected_public_url)
  then
    raise exception using errcode = 'P0001', message = 'media_physical_move_identity_changed';
  end if;

  if target_asset.status <> 'active'
    or target_asset.missing_object
    or target_asset.reconciliation_state <> 'synced'
  then
    raise exception using errcode = 'P0001', message = 'media_physical_move_asset_uncertain';
  end if;

  if exists (
    select 1
    from public.media_delete_reservations reservation
    where reservation.asset_id = p_asset_id
      and reservation.status = 'reserved'
  ) then
    raise exception using errcode = 'P0001', message = 'media_physical_move_delete_reserved';
  end if;

  if not exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.asset_id = p_asset_id
      and lease.lease_token = p_lease_token
      and lease.status = 'active'
      and lease.expires_at > clock_timestamp()
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = 'media_catalog_physical_move'
          and target->>'entityType' = 'media_asset'
          and target->>'entityIdentity' = p_asset_id::text
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_physical_move_write_lease_mismatch';
  end if;

  update public.media_assets
  set
    bucket = trim(p_next_bucket),
    object_key = trim(p_next_object_key),
    public_url = trim(p_next_public_url),
    folder_path = trim(p_next_folder_path),
    reconciliation_state = 'uncertain'
  where id = p_asset_id;
  get diagnostics affected_count = row_count;

  update public.media_reference_write_leases lease
  set synchronized_targets = case
    when exists (
      select 1
      from jsonb_array_elements(lease.synchronized_targets) synchronized
      where synchronized->>'domainKey' = 'media_catalog_physical_move'
        and synchronized->>'entityType' = 'media_asset'
        and synchronized->>'entityIdentity' = p_asset_id::text
    ) then lease.synchronized_targets
    else lease.synchronized_targets || jsonb_build_array(jsonb_build_object(
      'domainKey', 'media_catalog_physical_move',
      'entityType', 'media_asset',
      'entityIdentity', p_asset_id::text
    ))
  end
  where lease.asset_id = p_asset_id
    and lease.lease_token = p_lease_token
    and lease.status = 'active'
    and lease.expires_at > clock_timestamp();
  get diagnostics lease_affected_count = row_count;

  if affected_count <> 1 or lease_affected_count <> 1 then
    raise exception using errcode = 'P0001', message = 'media_physical_move_transition_incomplete';
  end if;
  return affected_count;
end;
$$;

create or replace function public.rollback_media_asset_identity_move(
  p_asset_id uuid,
  p_lease_token uuid,
  p_expected_provider text,
  p_expected_bucket text,
  p_expected_object_key text,
  p_expected_public_url text,
  p_restore_bucket text,
  p_restore_object_key text,
  p_restore_public_url text,
  p_restore_folder_path text,
  p_restore_reconciliation_state text,
  p_restore_missing_object boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_asset public.media_assets%rowtype;
  affected_count integer := 0;
begin
  if p_asset_id is null
    or p_lease_token is null
    or coalesce(trim(p_expected_provider), '') = ''
    or coalesce(trim(p_expected_bucket), '') = ''
    or coalesce(trim(p_expected_object_key), '') = ''
    or coalesce(trim(p_expected_public_url), '') = ''
    or coalesce(trim(p_restore_bucket), '') = ''
    or coalesce(trim(p_restore_object_key), '') = ''
    or coalesce(trim(p_restore_public_url), '') = ''
    or coalesce(trim(p_restore_folder_path), '') = ''
    or coalesce(trim(p_restore_reconciliation_state), '') = ''
    or p_restore_missing_object is null
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_physical_move_rollback';
  end if;

  select * into target_asset
  from public.media_assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'media_physical_move_asset_missing';
  end if;

  if target_asset.provider <> trim(p_expected_provider)
    or target_asset.bucket <> trim(p_expected_bucket)
    or target_asset.object_key <> trim(p_expected_object_key)
    or target_asset.public_url <> trim(p_expected_public_url)
  then
    raise exception using errcode = 'P0001', message = 'media_physical_move_rollback_identity_changed';
  end if;

  if not exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.asset_id = p_asset_id
      and lease.lease_token = p_lease_token
      and lease.resolved_at is null
      and (
        lease.status in ('active', 'expired')
        or (lease.status = 'failed' and lease.failure_metadata->>'domainWriteCommitted' = 'true')
      )
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = 'media_catalog_physical_move'
          and target->>'entityType' = 'media_asset'
          and target->>'entityIdentity' = p_asset_id::text
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_physical_move_rollback_lease_mismatch';
  end if;

  update public.media_assets
  set
    bucket = trim(p_restore_bucket),
    object_key = trim(p_restore_object_key),
    public_url = trim(p_restore_public_url),
    folder_path = trim(p_restore_folder_path),
    reconciliation_state = trim(p_restore_reconciliation_state),
    missing_object = p_restore_missing_object
  where id = p_asset_id;
  get diagnostics affected_count = row_count;

  if affected_count <> 1 then
    raise exception using errcode = 'P0001', message = 'media_physical_move_rollback_incomplete';
  end if;
  return affected_count;
end;
$$;

create or replace function public.finalize_media_asset_identity_move(
  p_asset_id uuid,
  p_lease_token uuid,
  p_expected_provider text,
  p_expected_bucket text,
  p_expected_object_key text,
  p_expected_public_url text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  if p_asset_id is null
    or p_lease_token is null
    or coalesce(trim(p_expected_provider), '') = ''
    or coalesce(trim(p_expected_bucket), '') = ''
    or coalesce(trim(p_expected_object_key), '') = ''
    or coalesce(trim(p_expected_public_url), '') = ''
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_physical_move_finalization';
  end if;

  perform asset.id
  from public.media_assets asset
  where asset.id = p_asset_id
  for update;

  if not exists (
    select 1
    from public.media_reference_write_leases lease
    where lease.asset_id = p_asset_id
      and lease.lease_token = p_lease_token
      and lease.status = 'active'
      and lease.expires_at > clock_timestamp()
      and exists (
        select 1
        from jsonb_array_elements(lease.write_targets) target
        where target->>'domainKey' = 'media_catalog_physical_move'
          and target->>'entityType' = 'media_asset'
          and target->>'entityIdentity' = p_asset_id::text
      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_physical_move_finalization_lease_mismatch';
  end if;

  update public.media_assets asset
  set reconciliation_state = 'synced'
  where asset.id = p_asset_id
    and asset.provider = trim(p_expected_provider)
    and asset.bucket = trim(p_expected_bucket)
    and asset.object_key = trim(p_expected_object_key)
    and asset.public_url = trim(p_expected_public_url)
    and asset.status = 'active'
    and not asset.missing_object
    and asset.reconciliation_state = 'uncertain';
  get diagnostics affected_count = row_count;

  if affected_count <> 1 then
    raise exception using errcode = 'P0001', message = 'media_physical_move_finalization_identity_mismatch';
  end if;
  return affected_count;
end;
$$;

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
  p_expected_provider_registry_version text default null
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

  if exists (
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
    provider_registry_version
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
    trim(p_expected_provider_registry_version)
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

create or replace function public.cancel_media_asset_deletion(
  p_asset_id uuid,
  p_reservation_id uuid,
  p_failure_code text,
  p_failure_metadata jsonb default '{}'::jsonb,
  p_storage_state text default null,
  p_storage_verified_at timestamptz default null
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
  if p_storage_state is distinct from 'exists'
    or p_storage_verified_at is null
    or p_storage_verified_at < clock_timestamp() - interval '5 minutes'
    or p_storage_verified_at > clock_timestamp() + interval '1 minute'
  then
    raise exception using errcode = 'P0001', message = 'media_delete_storage_existence_not_proven';
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

  update public.media_assets
  set
    status = target_reservation.previous_asset_status,
    reconciliation_state = target_reservation.previous_reconciliation_state,
    missing_object = target_reservation.previous_missing_object
  where id = p_asset_id;

  update public.media_delete_reservations
  set
    status = 'cancelled',
    finished_at = now(),
    failure_code = nullif(trim(p_failure_code), ''),
    failure_metadata = coalesce(p_failure_metadata, '{}'::jsonb) || jsonb_build_object(
      'storageState', p_storage_state,
      'storageVerifiedAt', p_storage_verified_at
    )
  where id = p_reservation_id;

  return target_reservation.previous_asset_status;
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

  if exists (
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
    reconciliation_state = 'synced',
    missing_object = false
  where id = p_asset_id;

  update public.media_delete_reservations
  set status = 'completed', finished_at = now()
  where id = p_reservation_id;

  return 'deleted';
end;
$$;

create or replace function public.mark_media_asset_delete_recovery(
  p_asset_id uuid,
  p_reservation_id uuid,
  p_failure_code text,
  p_failure_metadata jsonb default '{}'::jsonb,
  p_storage_state text default 'uncertain',
  p_storage_verified_at timestamptz default null
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
  if p_storage_state is null
    or p_storage_state not in ('missing', 'uncertain')
    or (p_storage_state = 'missing' and p_storage_verified_at is null)
    or (p_storage_verified_at is not null and (
      p_storage_verified_at < clock_timestamp() - interval '5 minutes'
      or p_storage_verified_at > clock_timestamp() + interval '1 minute'
    ))
  then
    raise exception using errcode = 'P0001', message = 'invalid_media_delete_recovery_input';
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

  update public.media_assets
  set
    status = case when p_storage_state = 'missing' then 'missing' else 'deleting' end,
    reconciliation_state = 'uncertain',
    missing_object = p_storage_state = 'missing'
  where id = p_asset_id;

  update public.media_delete_reservations
  set
    status = 'recovery_required',
    finished_at = now(),
    failure_code = nullif(trim(p_failure_code), ''),
    failure_metadata = coalesce(p_failure_metadata, '{}'::jsonb) || jsonb_build_object(
      'storageState', p_storage_state,
      'storageVerifiedAt', p_storage_verified_at
    )
  where id = p_reservation_id;

  return case when p_storage_state = 'missing' then 'missing' else 'deleting' end;
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

  if exists (
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

create or replace function public.get_media_reference_provider_revision(
  p_domain_key text
)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  current_revision bigint;
begin
  if coalesce(trim(p_domain_key), '') = '' then
    raise exception using errcode = 'P0001', message = 'invalid_media_provider_revision_input';
  end if;

  select revision
  into current_revision
  from public.media_reference_provider_revisions
  where domain_key = trim(p_domain_key);

  return coalesce(current_revision, 0);
end;
$$;

-- Both reference-replacement functions lock every requested asset in stable UUID
-- order before deleting or inserting references. Entity replacement also advances
-- a provider-domain revision inside the same transaction. Provider reconciliation
-- must present the revision captured before scanAll, preventing stale snapshots from
-- overwriting a completed write or resurrecting an explicit-empty reference set.
drop function if exists public.replace_media_references_for_entity(text, text, text, jsonb);
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
      or not pg_input_is_valid(entry->>'assetId', 'uuid')
      or coalesce(trim(entry->>'fieldKey'), '') = ''
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_media_reference_entry';
  end if;

  insert into public.media_reference_provider_revisions (domain_key, revision)
  values (trim(p_domain_key), 0)
  on conflict (domain_key) do nothing;

  perform revision
  from public.media_reference_provider_revisions
  where domain_key = trim(p_domain_key)
  for update;

  select count(distinct (entry->>'assetId')::uuid)
  into requested_asset_count
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
  where coalesce(entry->>'assetId', '') <> '';

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

  if requested_asset_count > 0 then
    if p_lease_token is null then
      raise exception using errcode = 'P0001', message = 'media_reference_write_lease_required';
    end if;

    select count(distinct lease.asset_id)
    into leased_asset_count
    from public.media_reference_write_leases lease
    where lease.lease_token = p_lease_token
      and lease.status = 'active'
      and lease.expires_at > clock_timestamp()
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

    if leased_asset_count <> requested_asset_count
      or expected_target_asset_count <> requested_asset_count
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
  where domain_key = trim(p_domain_key);

  return inserted_count;
end;
$$;

drop function if exists public.replace_media_references_for_provider(text, jsonb);
drop function if exists public.replace_media_references_for_provider(text, jsonb, uuid);
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
      or not pg_input_is_valid(entry->>'assetId', 'uuid')
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

alter table public.media_delete_reservations enable row level security;
alter table public.media_reference_write_leases enable row level security;
alter table public.media_reference_provider_revisions enable row level security;

revoke all on public.media_delete_reservations, public.media_reference_write_leases, public.media_reference_provider_revisions from anon, authenticated;
revoke insert, update, delete on public.media_delete_reservations, public.media_reference_write_leases, public.media_reference_provider_revisions from service_role;
grant select on public.media_delete_reservations, public.media_reference_write_leases, public.media_reference_provider_revisions to service_role;
revoke insert, update, delete on public.media_references from service_role;
grant select on public.media_references to service_role;
revoke delete on public.media_assets from service_role;
grant select, insert, update on public.media_assets to service_role;

revoke all on function public.assert_media_catalog_coordination_ready(text, text, text, text) from public;
grant execute on function public.assert_media_catalog_coordination_ready(text, text, text, text) to service_role;
revoke all on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text) from public;
grant execute on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text) to service_role;
revoke all on function public.complete_media_reference_write_lease(uuid, text) from public;
grant execute on function public.complete_media_reference_write_lease(uuid, text) to service_role;
revoke all on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) from public;
grant execute on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) to service_role;
revoke all on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) from public;
grant execute on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) to service_role;
revoke all on function public.transition_media_asset_identity_for_move(uuid, uuid, text, text, text, text, text, text, text, text) from public;
grant execute on function public.transition_media_asset_identity_for_move(uuid, uuid, text, text, text, text, text, text, text, text) to service_role;
revoke all on function public.rollback_media_asset_identity_move(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.rollback_media_asset_identity_move(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) to service_role;
revoke all on function public.finalize_media_asset_identity_move(uuid, uuid, text, text, text, text) from public;
grant execute on function public.finalize_media_asset_identity_move(uuid, uuid, text, text, text, text) to service_role;

revoke all on function public.reserve_media_asset_deletion(uuid, bigint, text, text, text, text, text, text, text, text) from public;
grant execute on function public.reserve_media_asset_deletion(uuid, bigint, text, text, text, text, text, text, text, text) to service_role;
revoke all on function public.cancel_media_asset_deletion(uuid, uuid, text, jsonb, text, timestamptz) from public;
grant execute on function public.cancel_media_asset_deletion(uuid, uuid, text, jsonb, text, timestamptz) to service_role;
revoke all on function public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz) from public;
grant execute on function public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz) to service_role;
revoke all on function public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz) from public;
grant execute on function public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz) to service_role;
revoke all on function public.repair_media_delete_reservation(uuid, uuid, text, text, timestamptz, jsonb) from public;
grant execute on function public.repair_media_delete_reservation(uuid, uuid, text, text, timestamptz, jsonb) to service_role;
revoke all on function public.get_media_reference_provider_revision(text) from public;
grant execute on function public.get_media_reference_provider_revision(text) to service_role;
revoke all on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text) from public;
grant execute on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text) to service_role;
revoke all on function public.replace_media_references_for_provider(text, jsonb, uuid, bigint) from public;
grant execute on function public.replace_media_references_for_provider(text, jsonb, uuid, bigint) to service_role;

comment on table public.media_delete_reservations is
  'Short-lived reservations and recovery evidence for the Media safe-delete Saga.';
comment on table public.media_reference_write_leases is
  'Batch write coordination between managed Media domain mutations and delete reservations; failed or expired unresolved leases block deletion.';
comment on table public.media_reference_provider_revisions is
  'Monotonic provider-domain fence advanced by every successful entity replacement and every failed write lease.';
comment on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text) is
  'Locks managed assets in stable UUID order and atomically leases the full batch before a domain write.';
comment on function public.complete_media_reference_write_lease(uuid, text) is
  'Completes a batch lease after both the domain write and entity reference synchronization succeed.';
comment on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) is
  'Persists a failed lease; committed domain writes remain unresolved and keep safe delete fail-closed.';
comment on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) is
  'Resolves a failed or expired lease only with an explicit reconciliation run identity.';
comment on function public.transition_media_asset_identity_for_move(uuid, uuid, text, text, text, text, text, text, text, text) is
  'Atomically validates a physical-move lease and the old canonical identity, transitions the Catalog identity, and marks the asset uncertain.';
comment on function public.rollback_media_asset_identity_move(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) is
  'Restores a Catalog identity under its unresolved physical-move lease after Storage compensation succeeds.';
comment on function public.finalize_media_asset_identity_move(uuid, uuid, text, text, text, text) is
  'Marks a moved Catalog asset synchronized only while its exact identity and active physical-move lease still match.';
comment on function public.reserve_media_asset_deletion(uuid, bigint, text, text, text, text, text, text, text, text) is
  'Atomically locks the exact expected canonical identity of an unused active Media asset, records a reservation, and marks it deleting.';
comment on function public.cancel_media_asset_deletion(uuid, uuid, text, jsonb, text, timestamptz) is
  'Compensates a reserved delete only after recent evidence proves the Storage object still exists.';
comment on function public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz) is
  'Finalizes a reserved delete only after recent Storage evidence proves the object is absent.';
comment on function public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz) is
  'Records delete-Saga recovery evidence without marking an asset missing unless Storage absence is proven.';
comment on function public.repair_media_delete_reservation(uuid, uuid, text, text, timestamptz, jsonb) is
  'Applies one evidence-bound recovery action; it never force-deletes or restores active without recent Storage proof.';
comment on function public.get_media_reference_provider_revision(text) is
  'Returns the current provider-domain revision without mutating reconciliation state.';

commit;
