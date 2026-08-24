-- Keep entity reference synchronization complete across Catalog providers while
-- requiring a write lease only for assets managed by the active Supabase
-- storage runtime. Filesystem Catalog assets remain reference-tracked and
-- locked, but they are not valid targets for a Supabase storage write lease.

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
    count(distinct requested.asset_id) filter (where asset.provider = 'supabase')
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
      and asset.provider = 'supabase'
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
      and asset.provider = 'supabase'
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

revoke all on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text)
from public, anon, authenticated;
grant execute on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text)
to service_role;

comment on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text)
is 'Atomically replaces one entity reference set, requiring the matching write lease only for Supabase-managed assets while retaining complete cross-provider Catalog references.';
