-- Resolve stale leases only with current, complete, post-write reconciliation proof.
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

  if exists (select 1 from public.media_reference_write_leases
    where lease_token = p_lease_token and status = 'active') then
    raise exception using errcode = 'P0001', message = 'media_write_lease_still_active';
  end if;

  -- Expiry alone is never release: a completed scan must start after the last
  -- possible write window, then this locked transition fences the old token.
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
    or coalesce(catalog_state->>'lastSuccessfulReconciliationStartedAt', '') = ''
    or (catalog_state->>'lastSuccessfulReconciliationStartedAt')::timestamptz <= newest_failure_at
    or (catalog_state->>'lastSuccessfulReconciliationAt')::timestamptz < (catalog_state->>'lastSuccessfulReconciliationStartedAt')::timestamptz
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

      )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_reconciliation_context_mismatch';
  end if;

  -- Registry upgrades require positive coverage of every original write domain
  -- in the current successful scan; never rewrite the lease's historical owner.
  if exists (
    select 1 from public.media_reference_write_leases lease
    cross join lateral jsonb_array_elements(lease.write_targets) target
    where lease.lease_token = p_lease_token
      and not coalesce(catalog_state->'lastSuccessfulReconciliationDomains' ? (target->>'domainKey'), false)
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_reconciliation_coverage_missing';
  end if;

  update public.media_reference_write_leases lease
  set
    status = 'reconciled',
    completed_at = coalesce(lease.completed_at, now()),
    resolved_at = now(),
    failure_metadata = lease.failure_metadata || jsonb_build_object(
      'resolutionCode', trim(p_resolution_code),
      'reconciliationRunIdentity', p_reconciliation_run_identity,
      'resolvedProviderRegistryVersion', catalog_state->>'providerRegistryVersion'
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

revoke all on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) to service_role;
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

  -- Automatic stale recovery is a fenced failure, never a successful release.
  -- Expiry is rechecked under the same asset locks used by acquisition/sync.
  if p_failure_code = 'media_write_lease_expired_before_delete' and (
    not p_domain_write_committed or exists (
      select 1 from public.media_reference_write_leases
      where lease_token = p_lease_token and expires_at > clock_timestamp()
    )
  ) then
    raise exception using errcode = 'P0001', message = 'media_write_lease_still_active';
  end if;

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

revoke all on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) to service_role;
