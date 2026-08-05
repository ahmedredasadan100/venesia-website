-- EXTERNAL INTEGRATIONS CAPABILITY
-- Connection truth belongs to public.integration_connections. Provider secrets
-- live only in Supabase Vault; Reports read normalized Analytics read models.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.integration_authorization_attempts (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null,
  environment_key text not null,
  actor_admin_user_id bigint not null references public.admin_users(id) on delete restrict,
  state_hash text not null,
  pkce_verifier_secret_id uuid,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default clock_timestamp(),
  constraint integration_authorization_attempt_key_check check (
    integration_key in (
      'google_analytics','google_search_console','google_ads','meta_business',
      'tiktok_ads','snapchat_ads','whatsapp_business'
    )
  ),
  constraint integration_authorization_attempt_state_check check (
    state_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint integration_authorization_attempt_return_path_check check (
    return_path like '/admin/settings/integrations/%'
  )
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null,
  environment_key text not null,
  status text not null,
  credential_strategy text not null,
  external_subject_id text,
  granted_scopes text[] not null default '{}',
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  last_validated_at timestamptz,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  last_error_code text,
  last_error_message text,
  consecutive_failures integer not null default 0,
  backoff_until timestamptz,
  sync_watermark jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_by_admin_user_id bigint not null references public.admin_users(id) on delete restrict,
  updated_by_admin_user_id bigint not null references public.admin_users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  constraint integration_connection_key_check check (
    integration_key in (
      'google_analytics','google_search_console','google_ads','meta_business',
      'tiktok_ads','snapchat_ads','whatsapp_business'
    )
  ),
  constraint integration_connection_status_check check (
    status in (
      'authorized_unbound','discovering_assets','pending_selection','testing',
      'syncing','connected','needs_configuration','needs_reauth',
      'needs_attention','unavailable','revoked'
    )
  ),
  constraint integration_connection_strategy_check check (
    credential_strategy in (
      'google_oauth_refresh','meta_user','meta_system_user',
      'tiktok_marketing_long_lived','snap_oauth_refresh'
    )
  ),
  constraint integration_connection_failure_count_check check (consecutive_failures >= 0),
  constraint integration_connection_version_check check (version > 0)
);

create unique index if not exists integration_connections_active_owner_uq
  on public.integration_connections(integration_key, environment_key)
  where revoked_at is null;
create index if not exists integration_connections_due_sync_idx
  on public.integration_connections(next_sync_at, backoff_until)
  where status in ('syncing','connected','needs_attention') and revoked_at is null;

create table if not exists public.integration_credentials (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  credential_strategy text not null,
  access_secret_id uuid not null,
  refresh_secret_id uuid,
  updated_at timestamptz not null default clock_timestamp(),
  constraint integration_credentials_strategy_check check (
    credential_strategy in (
      'google_oauth_refresh','meta_user','meta_system_user',
      'tiktok_marketing_long_lived','snap_oauth_refresh'
    )
  )
);

create table if not exists public.integration_connection_assets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  asset_type text not null,
  external_id text not null,
  parent_external_id text,
  display_name text not null,
  permissions text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  selected boolean not null default false,
  discovered_at timestamptz not null default clock_timestamp(),
  unique(connection_id, asset_type, external_id),
  constraint integration_asset_type_check check (
    asset_type in (
      'account','property','site','manager_customer','customer','business',
      'ad_account','pixel','dataset','business_center','advertiser',
      'organization','waba','phone_number'
    )
  )
);
create index if not exists integration_connection_assets_selected_idx
  on public.integration_connection_assets(connection_id, asset_type)
  where selected;

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  trigger_kind text not null,
  status text not null,
  lease_token uuid,
  leased_until timestamptz,
  attempt_number integer not null default 1,
  watermark_before jsonb not null default '{}'::jsonb,
  watermark_after jsonb not null default '{}'::jsonb,
  records_written integer not null default 0,
  error_code text,
  error_message text,
  queued_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint integration_sync_trigger_check check (trigger_kind in ('initial','manual','cron')),
  constraint integration_sync_status_check check (status in ('queued','running','completed','partial','failed')),
  constraint integration_sync_attempt_check check (attempt_number > 0),
  constraint integration_sync_records_check check (records_written >= 0)
);
create index if not exists integration_sync_runs_connection_idx
  on public.integration_sync_runs(connection_id, queued_at desc);
create index if not exists integration_sync_runs_claim_idx
  on public.integration_sync_runs(status, leased_until, queued_at);

-- Analytics Foundation read model. The provider remains origin truth; this
-- table is a normalized, replaceable report projection keyed by query context.
create table if not exists public.analytics_provider_read_models (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  provider_key text not null,
  period_key text not null,
  compare_key text not null,
  status text not null,
  message text not null,
  metrics jsonb not null default '[]'::jsonb,
  source_updated_at timestamptz not null,
  checked_at timestamptz not null default clock_timestamp(),
  watermark jsonb not null default '{}'::jsonb,
  unique(connection_id, provider_key, period_key, compare_key),
  constraint analytics_provider_read_model_provider_check check (
    provider_key in (
      'google_analytics_4','google_search_console','google_ads',
      'meta_marketing','tiktok_ads','snapchat_ads'
    )
  ),
  constraint analytics_provider_read_model_period_check check (period_key in ('last_30_days','last_90_days')),
  constraint analytics_provider_read_model_compare_check check (compare_key in ('none','previous_period','previous_year')),
  constraint analytics_provider_read_model_status_check check (status in ('ready','partial','unavailable')),
  constraint analytics_provider_read_model_metrics_array_check check (jsonb_typeof(metrics) = 'array'),
  constraint analytics_provider_read_model_ready_check check (status <> 'ready' or jsonb_array_length(metrics) > 0),
  constraint analytics_provider_read_model_unavailable_check check (status <> 'unavailable' or jsonb_array_length(metrics) = 0)
);
create index if not exists analytics_provider_read_models_lookup_idx
  on public.analytics_provider_read_models(provider_key, period_key, compare_key, checked_at desc);

alter table public.integration_authorization_attempts enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.integration_connection_assets enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.analytics_provider_read_models enable row level security;

revoke all on public.integration_authorization_attempts from public, anon, authenticated;
revoke all on public.integration_connections from public, anon, authenticated;
revoke all on public.integration_credentials from public, anon, authenticated;
revoke all on public.integration_connection_assets from public, anon, authenticated;
revoke all on public.integration_sync_runs from public, anon, authenticated;
revoke all on public.analytics_provider_read_models from public, anon, authenticated;
grant select, insert, update, delete on public.integration_authorization_attempts to service_role;
grant select, insert, update, delete on public.integration_connections to service_role;
grant select, insert, update, delete on public.integration_credentials to service_role;
grant select, insert, update, delete on public.integration_connection_assets to service_role;
grant select, insert, update, delete on public.integration_sync_runs to service_role;
grant select, insert, update, delete on public.analytics_provider_read_models to service_role;

create or replace function public.create_integration_vault_secret(
  p_secret text,
  p_name text,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  created_id uuid;
begin
  if coalesce(p_secret, '') = '' then
    raise exception using errcode = '22023', message = 'integration_secret_empty';
  end if;
  select vault.create_secret(p_secret, nullif(trim(p_name), ''), nullif(trim(p_description), ''))
    into created_id;
  return created_id;
end;
$$;

create or replace function public.read_integration_vault_secret(p_secret_id uuid)
returns text
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id;
$$;

create or replace function public.delete_integration_vault_secret(p_secret_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  delete from vault.secrets where id = p_secret_id;
end;
$$;

create or replace function public.consume_integration_authorization_attempt(
  p_attempt_id uuid,
  p_state_hash text,
  p_actor_admin_user_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  attempt public.integration_authorization_attempts%rowtype;
begin
  select * into attempt
  from public.integration_authorization_attempts
  where id = p_attempt_id
  for update;
  if attempt.id is null
    or attempt.actor_admin_user_id <> p_actor_admin_user_id
    or attempt.state_hash <> lower(trim(p_state_hash))
    or attempt.consumed_at is not null
    or attempt.expires_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'integration_oauth_attempt_invalid';
  end if;
  update public.integration_authorization_attempts
    set consumed_at = clock_timestamp()
    where id = attempt.id;
  return jsonb_build_object(
    'id', attempt.id,
    'integrationKey', attempt.integration_key,
    'environmentKey', attempt.environment_key,
    'pkceVerifierSecretId', attempt.pkce_verifier_secret_id,
    'returnPath', attempt.return_path
  );
end;
$$;

create or replace function public.prune_integration_authorization_attempts()
returns integer
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  deleted_count integer;
begin
  delete from vault.secrets secret
  where secret.id in (
    select attempt.pkce_verifier_secret_id
    from public.integration_authorization_attempts attempt
    where attempt.pkce_verifier_secret_id is not null
      and (
        attempt.expires_at <= clock_timestamp() - interval '1 hour'
        or (attempt.consumed_at is not null and attempt.consumed_at <= clock_timestamp() - interval '1 hour')
      )
  );
  delete from public.integration_authorization_attempts attempt
  where attempt.expires_at <= clock_timestamp() - interval '1 hour'
     or (attempt.consumed_at is not null and attempt.consumed_at <= clock_timestamp() - interval '1 hour');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.promote_integration_authorization(
  p_integration_key text,
  p_environment_key text,
  p_actor_admin_user_id bigint,
  p_credential_strategy text,
  p_access_secret_id uuid,
  p_refresh_secret_id uuid,
  p_external_subject_id text,
  p_granted_scopes text[],
  p_access_expires_at timestamptz,
  p_refresh_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_connection_id uuid;
  old_access uuid;
  old_refresh uuid;
begin
  select c.id, credentials.access_secret_id, credentials.refresh_secret_id
    into v_connection_id, old_access, old_refresh
  from public.integration_connections c
  left join public.integration_credentials credentials on credentials.connection_id = c.id
  where c.integration_key = trim(p_integration_key)
    and c.environment_key = trim(p_environment_key)
    and c.revoked_at is null
  for update of c;

  if v_connection_id is null then
    insert into public.integration_connections(
      integration_key, environment_key, status, credential_strategy,
      external_subject_id, granted_scopes, access_expires_at, refresh_expires_at,
      created_by_admin_user_id, updated_by_admin_user_id
    ) values (
      trim(p_integration_key), trim(p_environment_key), 'authorized_unbound',
      trim(p_credential_strategy), nullif(trim(p_external_subject_id), ''),
      coalesce(p_granted_scopes, '{}'), p_access_expires_at, p_refresh_expires_at,
      p_actor_admin_user_id, p_actor_admin_user_id
    ) returning id into v_connection_id;
  else
    update public.integration_connections
      set status = 'authorized_unbound',
          credential_strategy = trim(p_credential_strategy),
          external_subject_id = nullif(trim(p_external_subject_id), ''),
          granted_scopes = coalesce(p_granted_scopes, '{}'),
          access_expires_at = p_access_expires_at,
          refresh_expires_at = p_refresh_expires_at,
          last_error_code = null,
          last_error_message = null,
          consecutive_failures = 0,
          backoff_until = null,
          revoked_at = null,
          updated_by_admin_user_id = p_actor_admin_user_id,
          updated_at = clock_timestamp(),
          version = version + 1
      where id = v_connection_id;
    delete from public.integration_connection_assets asset where asset.connection_id = v_connection_id;
  end if;

  insert into public.integration_credentials(
    connection_id, credential_strategy, access_secret_id, refresh_secret_id, updated_at
  ) values (
    v_connection_id, trim(p_credential_strategy), p_access_secret_id, p_refresh_secret_id, clock_timestamp()
  ) on conflict (connection_id) do update set
    credential_strategy = excluded.credential_strategy,
    access_secret_id = excluded.access_secret_id,
    refresh_secret_id = excluded.refresh_secret_id,
    updated_at = excluded.updated_at;

  if old_access is not null and old_access <> p_access_secret_id then
    delete from vault.secrets where id = old_access;
  end if;
  if old_refresh is not null and old_refresh <> p_refresh_secret_id then
    delete from vault.secrets where id = old_refresh;
  end if;
  return v_connection_id;
end;
$$;

create or replace function public.rotate_integration_credentials(
  p_connection_id uuid,
  p_access_secret_id uuid,
  p_refresh_secret_id uuid,
  p_granted_scopes text[],
  p_access_expires_at timestamptz,
  p_refresh_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare old_access uuid;
declare old_refresh uuid;
begin
  select access_secret_id, refresh_secret_id into old_access, old_refresh
  from public.integration_credentials where connection_id = p_connection_id for update;
  if old_access is null then raise exception using errcode = 'P0001', message = 'integration_credentials_missing'; end if;
  update public.integration_credentials
    set access_secret_id = p_access_secret_id,
        refresh_secret_id = coalesce(p_refresh_secret_id, refresh_secret_id),
        updated_at = clock_timestamp()
    where connection_id = p_connection_id;
  update public.integration_connections
    set granted_scopes = case when cardinality(p_granted_scopes) > 0 then p_granted_scopes else granted_scopes end,
        access_expires_at = p_access_expires_at,
        refresh_expires_at = coalesce(p_refresh_expires_at, refresh_expires_at),
        updated_at = clock_timestamp(), version = version + 1
    where id = p_connection_id and revoked_at is null;
  if old_access <> p_access_secret_id then delete from vault.secrets where id = old_access; end if;
  if p_refresh_secret_id is not null and old_refresh is not null and old_refresh <> p_refresh_secret_id then
    delete from vault.secrets where id = old_refresh;
  end if;
end;
$$;

create or replace function public.replace_integration_discovered_assets(
  p_connection_id uuid,
  p_assets jsonb,
  p_actor_admin_user_id bigint
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  if jsonb_typeof(p_assets) <> 'array' then
    raise exception using errcode = '22023', message = 'integration_assets_invalid';
  end if;
  perform 1 from public.integration_connections where id = p_connection_id and revoked_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'integration_connection_missing'; end if;
  delete from public.integration_connection_assets where connection_id = p_connection_id;
  insert into public.integration_connection_assets(
    connection_id, asset_type, external_id, parent_external_id, display_name,
    permissions, metadata, selected
  )
  select
    p_connection_id,
    item->>'type',
    item->>'externalId',
    nullif(item->>'parentExternalId', ''),
    item->>'displayName',
    coalesce(array(select jsonb_array_elements_text(coalesce(item->'permissions', '[]'::jsonb))), '{}'),
    coalesce(item->'metadata', '{}'::jsonb),
    false
  from jsonb_array_elements(p_assets) item;
  get diagnostics inserted_count = row_count;
  update public.integration_connections
    set status = case when inserted_count > 0 then 'pending_selection' else 'needs_attention' end,
        last_error_code = case when inserted_count > 0 then null else 'integration_no_assets' end,
        last_error_message = case when inserted_count > 0 then null else 'No accessible assets were returned by the provider.' end,
        updated_by_admin_user_id = p_actor_admin_user_id,
        updated_at = clock_timestamp(),
        version = version + 1
    where id = p_connection_id;
  return inserted_count;
end;
$$;

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
  perform 1 from public.integration_connections where id = p_connection_id and status = 'pending_selection' and revoked_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'integration_selection_state_invalid'; end if;
  update public.integration_connection_assets set selected = false where connection_id = p_connection_id;
  update public.integration_connection_assets
    set selected = true
    where connection_id = p_connection_id and id = any(coalesce(p_asset_ids, '{}'));
  get diagnostics selected_count = row_count;
  update public.integration_connections
    set status = 'testing', updated_by_admin_user_id = p_actor_admin_user_id,
        updated_at = clock_timestamp(), version = version + 1
    where id = p_connection_id;
  return selected_count;
end;
$$;

create or replace function public.queue_integration_initial_sync(
  p_connection_id uuid,
  p_trigger_kind text,
  p_actor_admin_user_id bigint
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare run_id uuid;
begin
  perform 1 from public.integration_connections where id = p_connection_id and status in ('testing','connected','needs_attention') and revoked_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'integration_test_state_invalid'; end if;
  update public.integration_connections
    set status = 'syncing', last_validated_at = clock_timestamp(), next_sync_at = clock_timestamp(),
        last_error_code = null, last_error_message = null,
        updated_by_admin_user_id = p_actor_admin_user_id,
        updated_at = clock_timestamp(), version = version + 1
    where id = p_connection_id;
  insert into public.integration_sync_runs(connection_id, trigger_kind, status, watermark_before)
    select id, p_trigger_kind, 'queued', sync_watermark
    from public.integration_connections where id = p_connection_id
    returning id into run_id;
  return run_id;
end;
$$;

create or replace function public.claim_integration_sync_run(
  p_run_id uuid default null,
  p_lease_seconds integer default 240
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed public.integration_sync_runs%rowtype;
declare token uuid := gen_random_uuid();
begin
  select run.* into claimed
  from public.integration_sync_runs run
  join public.integration_connections connection on connection.id = run.connection_id
  where (
      run.status = 'queued'
      or (run.status = 'running' and run.leased_until <= clock_timestamp())
    )
    and (p_run_id is null or run.id = p_run_id)
    and connection.revoked_at is null
    and (connection.backoff_until is null or connection.backoff_until <= clock_timestamp())
  order by run.queued_at
  for update of run skip locked
  limit 1;
  if claimed.id is null then return null; end if;
  update public.integration_sync_runs
    set status = 'running', lease_token = token,
        leased_until = clock_timestamp() + make_interval(secs => greatest(30, least(p_lease_seconds, 900))),
        started_at = coalesce(started_at, clock_timestamp()),
        attempt_number = case when claimed.status = 'running' then attempt_number + 1 else attempt_number end
    where id = claimed.id;
  return jsonb_build_object('runId', claimed.id, 'connectionId', claimed.connection_id, 'leaseToken', token);
end;
$$;

create or replace function public.queue_due_integration_sync_runs(p_limit integer default 8)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare queued_count integer;
begin
  with due as (
    select connection.id
    from public.integration_connections connection
    where connection.revoked_at is null
      and connection.status in ('connected','needs_attention','syncing')
      and connection.next_sync_at is not null
      and connection.next_sync_at <= clock_timestamp()
      and (connection.backoff_until is null or connection.backoff_until <= clock_timestamp())
      and not exists (
        select 1 from public.integration_sync_runs run
        where run.connection_id = connection.id and run.status in ('queued','running')
      )
    order by connection.next_sync_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 8), 32))
  ), inserted as (
    insert into public.integration_sync_runs(connection_id, trigger_kind, status, watermark_before)
    select due.id, 'cron', 'queued', connection.sync_watermark
    from due join public.integration_connections connection on connection.id = due.id
    returning connection_id
  )
  update public.integration_connections connection
    set status = 'syncing', updated_at = clock_timestamp(), version = version + 1
  where connection.id in (select connection_id from inserted);
  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

create or replace function public.complete_integration_sync_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_status text,
  p_watermark jsonb,
  p_records_written integer,
  p_message text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare connection_id uuid;
begin
  select run.connection_id into connection_id
  from public.integration_sync_runs run
  where run.id = p_run_id and run.status = 'running' and run.lease_token = p_lease_token
    and run.leased_until > clock_timestamp()
  for update;
  if connection_id is null then raise exception using errcode = 'P0001', message = 'integration_sync_lease_invalid'; end if;
  update public.integration_sync_runs
    set status = p_status, watermark_after = coalesce(p_watermark, '{}'::jsonb),
        records_written = greatest(coalesce(p_records_written, 0), 0),
        error_message = nullif(trim(p_message), ''), completed_at = clock_timestamp()
    where id = p_run_id;
  update public.integration_connections
    set status = 'connected', last_sync_at = clock_timestamp(),
        next_sync_at = clock_timestamp() + interval '24 hours',
        sync_watermark = coalesce(p_watermark, '{}'::jsonb),
        consecutive_failures = 0, backoff_until = null,
        last_error_code = null, last_error_message = null,
        updated_at = clock_timestamp(), version = version + 1
    where id = connection_id;
end;
$$;

create or replace function public.fail_integration_sync_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text,
  p_requires_reauth boolean default false
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare connection_id uuid;
declare failures integer;
begin
  select run.connection_id into connection_id
  from public.integration_sync_runs run
  where run.id = p_run_id and run.status = 'running' and run.lease_token = p_lease_token
  for update;
  if connection_id is null then raise exception using errcode = 'P0001', message = 'integration_sync_lease_invalid'; end if;
  update public.integration_sync_runs
    set status = 'failed', error_code = left(trim(p_error_code), 120),
        error_message = left(trim(p_error_message), 500), completed_at = clock_timestamp()
    where id = p_run_id;
  update public.integration_connections
    set consecutive_failures = consecutive_failures + 1,
        status = case when p_requires_reauth then 'needs_reauth' else 'needs_attention' end,
        last_error_code = left(trim(p_error_code), 120),
        last_error_message = left(trim(p_error_message), 500),
        backoff_until = case when p_requires_reauth then null else clock_timestamp() + make_interval(secs => least(86400, 60 * power(2, least(consecutive_failures, 10))::integer)) end,
        next_sync_at = case when p_requires_reauth then null else clock_timestamp() + make_interval(secs => least(86400, 60 * power(2, least(consecutive_failures, 10))::integer)) end,
        updated_at = clock_timestamp(), version = version + 1
    where id = connection_id
    returning consecutive_failures into failures;
end;
$$;

create or replace function public.ingest_analytics_provider_read_model(
  p_connection_id uuid,
  p_provider_key text,
  p_period_key text,
  p_compare_key text,
  p_status text,
  p_message text,
  p_metrics jsonb,
  p_source_updated_at timestamptz,
  p_watermark jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare model_id uuid;
declare expected_provider text;
begin
  select case connection.integration_key
    when 'google_analytics' then 'google_analytics_4'
    when 'google_search_console' then 'google_search_console'
    when 'google_ads' then 'google_ads'
    when 'meta_business' then 'meta_marketing'
    when 'tiktok_ads' then 'tiktok_ads'
    when 'snapchat_ads' then 'snapchat_ads'
    else null
  end into expected_provider
  from public.integration_connections connection
  where connection.id = p_connection_id and connection.revoked_at is null;
  if expected_provider is null or expected_provider <> trim(p_provider_key) then
    raise exception using errcode = 'P0001', message = 'analytics_ingestion_connection_provider_mismatch';
  end if;
  insert into public.analytics_provider_read_models(
    connection_id, provider_key, period_key, compare_key, status, message,
    metrics, source_updated_at, checked_at, watermark
  ) values (
    p_connection_id, p_provider_key, p_period_key, p_compare_key, p_status,
    left(trim(p_message), 500), coalesce(p_metrics, '[]'::jsonb),
    p_source_updated_at, clock_timestamp(), coalesce(p_watermark, '{}'::jsonb)
  ) on conflict (connection_id, provider_key, period_key, compare_key) do update set
    status = excluded.status, message = excluded.message, metrics = excluded.metrics,
    source_updated_at = excluded.source_updated_at, checked_at = excluded.checked_at,
    watermark = excluded.watermark
  returning id into model_id;
  return model_id;
end;
$$;

create or replace function public.revoke_integration_connection(
  p_connection_id uuid,
  p_actor_admin_user_id bigint
) returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare access_id uuid;
declare refresh_id uuid;
begin
  select access_secret_id, refresh_secret_id into access_id, refresh_id
  from public.integration_credentials where connection_id = p_connection_id for update;
  update public.integration_connections
    set status = 'revoked', revoked_at = clock_timestamp(), next_sync_at = null,
        updated_by_admin_user_id = p_actor_admin_user_id,
        updated_at = clock_timestamp(), version = version + 1
    where id = p_connection_id and revoked_at is null;
  delete from public.analytics_provider_read_models where connection_id = p_connection_id;
  delete from public.integration_credentials where connection_id = p_connection_id;
  if access_id is not null then delete from vault.secrets where id = access_id; end if;
  if refresh_id is not null then delete from vault.secrets where id = refresh_id; end if;
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
    'migrationVersion', '20260805234500',
    'checkedAt', clock_timestamp(),
    'vaultAvailable', exists(select 1 from pg_extension where extname = 'supabase_vault'),
    'migrationRegistered', exists(
      select 1 from supabase_migrations.schema_migrations where version = '20260805234500'
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

revoke all on function public.create_integration_vault_secret(text,text,text) from public, anon, authenticated;
revoke all on function public.read_integration_vault_secret(uuid) from public, anon, authenticated;
revoke all on function public.delete_integration_vault_secret(uuid) from public, anon, authenticated;
revoke all on function public.consume_integration_authorization_attempt(uuid,text,bigint) from public, anon, authenticated;
revoke all on function public.prune_integration_authorization_attempts() from public, anon, authenticated;
revoke all on function public.promote_integration_authorization(text,text,bigint,text,uuid,uuid,text,text[],timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.rotate_integration_credentials(uuid,uuid,uuid,text[],timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.replace_integration_discovered_assets(uuid,jsonb,bigint) from public, anon, authenticated;
revoke all on function public.select_integration_assets(uuid,uuid[],bigint) from public, anon, authenticated;
revoke all on function public.queue_integration_initial_sync(uuid,text,bigint) from public, anon, authenticated;
revoke all on function public.claim_integration_sync_run(uuid,integer) from public, anon, authenticated;
revoke all on function public.queue_due_integration_sync_runs(integer) from public, anon, authenticated;
revoke all on function public.complete_integration_sync_run(uuid,uuid,text,jsonb,integer,text) from public, anon, authenticated;
revoke all on function public.fail_integration_sync_run(uuid,uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function public.ingest_analytics_provider_read_model(uuid,text,text,text,text,text,jsonb,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.revoke_integration_connection(uuid,bigint) from public, anon, authenticated;
revoke all on function public.external_integrations_capability_health() from public, anon, authenticated;

grant execute on function public.create_integration_vault_secret(text,text,text) to service_role;
grant execute on function public.read_integration_vault_secret(uuid) to service_role;
grant execute on function public.delete_integration_vault_secret(uuid) to service_role;
grant execute on function public.consume_integration_authorization_attempt(uuid,text,bigint) to service_role;
grant execute on function public.prune_integration_authorization_attempts() to service_role;
grant execute on function public.promote_integration_authorization(text,text,bigint,text,uuid,uuid,text,text[],timestamptz,timestamptz) to service_role;
grant execute on function public.rotate_integration_credentials(uuid,uuid,uuid,text[],timestamptz,timestamptz) to service_role;
grant execute on function public.replace_integration_discovered_assets(uuid,jsonb,bigint) to service_role;
grant execute on function public.select_integration_assets(uuid,uuid[],bigint) to service_role;
grant execute on function public.queue_integration_initial_sync(uuid,text,bigint) to service_role;
grant execute on function public.claim_integration_sync_run(uuid,integer) to service_role;
grant execute on function public.queue_due_integration_sync_runs(integer) to service_role;
grant execute on function public.complete_integration_sync_run(uuid,uuid,text,jsonb,integer,text) to service_role;
grant execute on function public.fail_integration_sync_run(uuid,uuid,text,text,boolean) to service_role;
grant execute on function public.ingest_analytics_provider_read_model(uuid,text,text,text,text,text,jsonb,timestamptz,jsonb) to service_role;
grant execute on function public.revoke_integration_connection(uuid,bigint) to service_role;
grant execute on function public.external_integrations_capability_health() to service_role;

comment on table public.integration_connections is
  'Single Source of Truth for External Integrations connection lifecycle; Analytics metrics never own connection state.';
comment on table public.integration_credentials is
  'Server-only Supabase Vault references. Provider tokens are never stored in plaintext application columns.';
comment on table public.analytics_provider_read_models is
  'Analytics Foundation projection populated only through Integrations Sync adapters and consumed through Analytics Contract.';
