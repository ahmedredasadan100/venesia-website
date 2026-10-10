-- Extend the existing lease owner; direct service-role writes remain forbidden.
create or replace function public.record_media_relocation_journal(p_lease_token uuid, p_plan jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare first_lease public.media_reference_write_leases%rowtype; affected integer;
begin
  perform id from public.media_reference_write_leases where lease_token=p_lease_token order by id for update;
  select * into first_lease from public.media_reference_write_leases where lease_token=p_lease_token order by id limit 1;
  if not found or exists(select 1 from public.media_reference_write_leases where lease_token=p_lease_token and (status <> 'active' or expires_at <= clock_timestamp() or resolved_at is not null)) then
    raise exception 'media_relocation_journal_lease_invalid';
  end if;
  if p_plan->>'operation' is distinct from 'physical_move' or jsonb_typeof(p_plan->'previousAsset') is distinct from 'object' or jsonb_typeof(p_plan->'nextIdentity') is distinct from 'object' or jsonb_typeof(p_plan->'referenceKeys') is distinct from 'array' or jsonb_typeof(p_plan->'copyConfirmed') is distinct from 'boolean' then
    raise exception 'media_relocation_journal_plan_invalid';
  end if;
  if not exists(select 1 from public.media_reference_write_leases l, jsonb_array_elements(l.write_targets) t where l.lease_token=p_lease_token and l.asset_id::text=p_plan->'previousAsset'->>'id' and t->>'domainKey'='media_catalog_physical_move' and t->>'entityIdentity'=l.asset_id::text and t->>'entityType'='media_asset') then
    raise exception 'media_relocation_journal_owner_invalid';
  end if;
  if first_lease.failure_metadata->>'operation' = 'physical_move' then
    if (first_lease.failure_metadata-'copyConfirmed') is distinct from (p_plan-'copyConfirmed') or (first_lease.failure_metadata->>'copyConfirmed'='true' and p_plan->>'copyConfirmed'<>'true') then
      raise exception 'media_relocation_journal_plan_changed';
    end if;
  elsif p_plan->>'copyConfirmed'<>'false' or not exists(select 1 from public.media_assets a where a.id::text=p_plan->'previousAsset'->>'id' and a.object_key=p_plan->'previousAsset'->>'objectKey' and a.public_url=p_plan->'previousAsset'->>'publicUrl' and a.status='active' and a.reconciliation_state='synced') then
    raise exception 'media_relocation_journal_initial_identity_invalid';
  end if;
  update public.media_reference_write_leases set failure_metadata=p_plan where lease_token=p_lease_token;
  get diagnostics affected=row_count; return affected;
end $$;

create or replace function public.transition_media_relocation_repair(p_lease_token uuid, p_action text, p_expected_updated_at timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare first_lease public.media_reference_write_leases%rowtype; affected integer;
begin
  perform id from public.media_reference_write_leases where lease_token=p_lease_token order by id for update;
  select * into first_lease from public.media_reference_write_leases where lease_token=p_lease_token order by id limit 1;
  if not found or exists(select 1 from public.media_reference_write_leases where lease_token=p_lease_token and (status<>'failed' or resolved_at is not null or failure_metadata->>'operation' is distinct from 'physical_move')) then
    raise exception 'media_relocation_repair_lease_invalid';
  end if;
  if p_action='claim' then
    if first_lease.updated_at is distinct from p_expected_updated_at or first_lease.failure_code='media_relocation_repair_running' or first_lease.failure_metadata->>'relocationRepaired'='true' then raise exception 'media_relocation_repair_conflict'; end if;
    update public.media_reference_write_leases set failure_code='media_relocation_repair_running' where lease_token=p_lease_token;
  elsif p_action in ('complete','fail') then
    if exists(select 1 from public.media_reference_write_leases where lease_token=p_lease_token and failure_code is distinct from 'media_relocation_repair_running') then raise exception 'media_relocation_repair_not_claimed'; end if;
    update public.media_reference_write_leases set failure_code=case when p_action='complete' then 'media_relocation_repaired' else 'media_relocation_repair_failed' end,
      failure_metadata=case when p_action='complete' then failure_metadata || '{"relocationRepaired":true}'::jsonb else failure_metadata end where lease_token=p_lease_token;
  else raise exception 'media_relocation_repair_action_invalid'; end if;
  get diagnostics affected=row_count; return affected;
end $$;

revoke all on function public.record_media_relocation_journal(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.transition_media_relocation_repair(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_media_relocation_journal(uuid,jsonb) to service_role;
grant execute on function public.transition_media_relocation_repair(uuid,text,timestamptz) to service_role;
