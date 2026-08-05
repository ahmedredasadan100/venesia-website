-- EXTERNAL INTEGRATIONS ASSET RESELECTION RECOVERY
-- Preserve the single Connection Aggregate while allowing the existing Wizard
-- to recover from an interrupted or failed connection test by selecting a
-- different first-party asset set.

create or replace function public.select_integration_assets(
  p_connection_id uuid,
  p_asset_ids uuid[],
  p_actor_admin_user_id bigint
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare selected_count integer;
begin
  perform 1
  from public.integration_connections
  where id = p_connection_id
    and status in ('pending_selection', 'testing', 'needs_attention')
    and revoked_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'integration_selection_state_invalid';
  end if;

  update public.integration_connection_assets
  set selected = false
  where connection_id = p_connection_id;

  update public.integration_connection_assets
  set selected = true
  where connection_id = p_connection_id
    and id = any(coalesce(p_asset_ids, '{}'));
  get diagnostics selected_count = row_count;

  update public.integration_connections
  set status = 'testing',
      last_error_code = null,
      last_error_message = null,
      updated_by_admin_user_id = p_actor_admin_user_id,
      updated_at = clock_timestamp(),
      version = version + 1
  where id = p_connection_id;

  return selected_count;
end;
$$;

create or replace function public.external_integrations_capability_health()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select jsonb_build_object(
    'contractVersion', 'external-integrations-v1',
    'migrationVersion', '20260806010000',
    'checkedAt', clock_timestamp(),
    'vaultAvailable', exists(select 1 from pg_extension where extname = 'supabase_vault'),
    'migrationRegistered', exists(
      select 1 from supabase_migrations.schema_migrations where version = '20260806010000'
    ),
    'rls', jsonb_build_object(
      'integration_authorization_attempts', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_authorization_attempts'::regclass), false),
      'integration_connections', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_connections'::regclass), false),
      'integration_credentials', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_credentials'::regclass), false),
      'integration_connection_assets', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_connection_assets'::regclass), false),
      'integration_sync_runs', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_sync_runs'::regclass), false),
      'analytics_provider_read_models', coalesce((select relrowsecurity from pg_class where oid = 'public.analytics_provider_read_models'::regclass), false)
    ),
    'activeConnections', (select count(*) from public.integration_connections where revoked_at is null),
    'connected', (select count(*) from public.integration_connections where status = 'connected' and revoked_at is null),
    'plaintextCredentialColumns', 0
  );
$$;

revoke all on function public.select_integration_assets(uuid,uuid[],bigint) from public, anon, authenticated;
revoke all on function public.external_integrations_capability_health() from public, anon, authenticated;
grant execute on function public.select_integration_assets(uuid,uuid[],bigint) to service_role;
grant execute on function public.external_integrations_capability_health() to service_role;
