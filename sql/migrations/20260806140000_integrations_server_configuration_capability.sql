-- INTEGRATIONS SERVER CONFIGURATION CAPABILITY
-- App-level credentials are owned separately from per-connection OAuth tokens.
-- Secrets remain exclusively in Supabase Vault; ordinary tables contain only
-- Vault UUID references, safe identifiers, validation truth, and audit-safe codes.

create table public.integration_app_configuration_groups (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  environment_key text not null,
  configuration_source text not null default 'cms_vault',
  version integer not null default 0,
  updated_by_admin_user_id bigint references public.admin_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint integration_app_configuration_group_provider_check check (
    provider_key in ('google','meta','tiktok','snapchat')
  ),
  constraint integration_app_configuration_group_environment_check check (
    environment_key ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$'
  ),
  constraint integration_app_configuration_group_source_check check (
    configuration_source in ('cms_vault','environment_import')
  ),
  constraint integration_app_configuration_group_version_check check (version >= 0),
  unique (provider_key, environment_key),
  unique (id, provider_key)
);

create table public.integration_app_configuration_entries (
  group_id uuid not null,
  provider_key text not null,
  configuration_key text not null,
  is_secret boolean not null,
  vault_secret_id uuid,
  safe_value text,
  safe_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (group_id, configuration_key),
  foreign key (group_id, provider_key)
    references public.integration_app_configuration_groups(id, provider_key)
    on delete cascade,
  constraint integration_app_configuration_entry_value_check check (
    (is_secret and vault_secret_id is not null and safe_value is null)
    or
    (not is_secret and vault_secret_id is null and nullif(btrim(safe_value), '') is not null)
  ),
  constraint integration_app_configuration_entry_metadata_check check (
    jsonb_typeof(safe_metadata) = 'object'
    and not (safe_metadata ?| array['value','secret','token','credential','client_secret','app_secret','developer_token'])
  ),
  constraint integration_app_configuration_entry_owner_check check (
    (provider_key = 'google' and configuration_key in (
      'google_client_id','google_client_secret','google_ads_developer_token'
    ))
    or (provider_key = 'meta' and configuration_key in ('meta_app_id','meta_app_secret'))
    or (provider_key = 'tiktok' and configuration_key in ('tiktok_app_id','tiktok_app_secret'))
    or (provider_key = 'snapchat' and configuration_key in ('snapchat_client_id','snapchat_client_secret'))
  ),
  constraint integration_app_configuration_entry_secret_kind_check check (
    is_secret = (configuration_key in (
      'google_client_secret','google_ads_developer_token','meta_app_secret',
      'tiktok_app_secret','snapchat_client_secret'
    ))
  )
);

create table public.integration_app_configuration_validations (
  group_id uuid not null,
  provider_key text not null,
  integration_key text not null,
  status text not null,
  missing_keys text[] not null default '{}',
  last_tested_at timestamptz,
  safe_error_code text,
  version integer not null default 1,
  test_window_started_at timestamptz,
  test_attempts_in_window integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (group_id, integration_key),
  foreign key (group_id, provider_key)
    references public.integration_app_configuration_groups(id, provider_key)
    on delete cascade,
  constraint integration_app_configuration_validation_owner_check check (
    (provider_key = 'google' and integration_key in ('google_analytics','google_search_console','google_ads'))
    or (provider_key = 'meta' and integration_key in ('meta_business','whatsapp_business'))
    or (provider_key = 'tiktok' and integration_key = 'tiktok_ads')
    or (provider_key = 'snapchat' and integration_key = 'snapchat_ads')
  ),
  constraint integration_app_configuration_validation_status_check check (
    status in (
      'needs_configuration','configuration_incomplete','configuration_invalid',
      'configuration_saved_waiting_for_authorization','ready_to_connect'
    )
  ),
  constraint integration_app_configuration_validation_error_check check (
    safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,120}$'
  ),
  constraint integration_app_configuration_validation_version_check check (version > 0),
  constraint integration_app_configuration_validation_rate_check check (
    test_attempts_in_window between 0 and 5
  )
);

create index integration_app_configuration_entries_secret_idx
  on public.integration_app_configuration_entries(vault_secret_id)
  where vault_secret_id is not null;
create index integration_app_configuration_validations_status_idx
  on public.integration_app_configuration_validations(status, last_tested_at desc);

alter table public.integration_app_configuration_groups enable row level security;
alter table public.integration_app_configuration_entries enable row level security;
alter table public.integration_app_configuration_validations enable row level security;

revoke all on public.integration_app_configuration_groups from public, anon, authenticated;
revoke all on public.integration_app_configuration_entries from public, anon, authenticated;
revoke all on public.integration_app_configuration_validations from public, anon, authenticated;
grant select, insert, update, delete on public.integration_app_configuration_groups to service_role;
grant select, insert, update, delete on public.integration_app_configuration_entries to service_role;
grant select, insert, update, delete on public.integration_app_configuration_validations to service_role;

create or replace function public.integration_app_configuration_provider(
  p_integration_key text
) returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select case trim(p_integration_key)
    when 'google_analytics' then 'google'
    when 'google_search_console' then 'google'
    when 'google_ads' then 'google'
    when 'meta_business' then 'meta'
    when 'whatsapp_business' then 'meta'
    when 'tiktok_ads' then 'tiktok'
    when 'snapchat_ads' then 'snapchat'
  end;
$$;

create or replace function public.integration_app_configuration_required_keys(
  p_integration_key text
) returns text[]
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select case trim(p_integration_key)
    when 'google_analytics' then array['google_client_id','google_client_secret']
    when 'google_search_console' then array['google_client_id','google_client_secret']
    when 'google_ads' then array['google_client_id','google_client_secret','google_ads_developer_token']
    when 'meta_business' then array['meta_app_id','meta_app_secret']
    when 'whatsapp_business' then array['meta_app_id','meta_app_secret']
    when 'tiktok_ads' then array['tiktok_app_id','tiktok_app_secret']
    when 'snapchat_ads' then array['snapchat_client_id','snapchat_client_secret']
    else array[]::text[]
  end;
$$;

create or replace function public.replace_integration_app_configuration(
  p_provider_key text,
  p_environment_key text,
  p_expected_version integer,
  p_entries jsonb,
  p_affected_integrations text[],
  p_actor_admin_user_id bigint,
  p_configuration_source text default 'cms_vault'
) returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_catalog, pg_temp
as $$
declare
  v_group public.integration_app_configuration_groups%rowtype;
  v_entry record;
  v_integration text;
  v_missing text[];
  v_old_secret_ids uuid[];
  v_new_secret_id uuid;
  v_entry_count integer;
begin
  p_provider_key := btrim(coalesce(p_provider_key, ''));
  p_environment_key := lower(btrim(coalesce(p_environment_key, '')));
  if p_provider_key not in ('google','meta','tiktok','snapchat')
     or p_environment_key !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$'
     or p_expected_version < 0
     or p_configuration_source not in ('cms_vault','environment_import')
     or jsonb_typeof(p_entries) <> 'array' then
    raise exception using errcode = '22023', message = 'integration_app_configuration_input_invalid';
  end if;

  select count(*) into v_entry_count from jsonb_array_elements(p_entries);
  if v_entry_count < 1 or v_entry_count > 10
     or v_entry_count <> (
       select count(distinct value ->> 'configuration_key') from jsonb_array_elements(p_entries)
     ) then
    raise exception using errcode = '22023', message = 'integration_app_configuration_entries_invalid';
  end if;

  for v_entry in
    select
      value ->> 'configuration_key' as configuration_key,
      coalesce((value ->> 'is_secret')::boolean, false) as is_secret,
      nullif(value ->> 'secret_id', '')::uuid as secret_id,
      nullif(value ->> 'secret_value', '') as secret_value,
      nullif(btrim(value ->> 'safe_value'), '') as safe_value
    from jsonb_array_elements(p_entries)
  loop
    if not (
      (p_provider_key = 'google' and v_entry.configuration_key in ('google_client_id','google_client_secret','google_ads_developer_token'))
      or (p_provider_key = 'meta' and v_entry.configuration_key in ('meta_app_id','meta_app_secret'))
      or (p_provider_key = 'tiktok' and v_entry.configuration_key in ('tiktok_app_id','tiktok_app_secret'))
      or (p_provider_key = 'snapchat' and v_entry.configuration_key in ('snapchat_client_id','snapchat_client_secret'))
    ) then
      raise exception using errcode = '22023', message = 'integration_app_configuration_key_invalid';
    end if;
    if v_entry.is_secret <> (v_entry.configuration_key in (
      'google_client_secret','google_ads_developer_token','meta_app_secret',
      'tiktok_app_secret','snapchat_client_secret'
    )) then
      raise exception using errcode = '22023', message = 'integration_app_configuration_secret_kind_invalid';
    end if;
    if v_entry.is_secret then
      if (v_entry.secret_id is null) = (v_entry.secret_value is null)
         or (v_entry.secret_value is not null and length(v_entry.secret_value) > 4096) then
        raise exception using errcode = '22023', message = 'integration_app_configuration_secret_input_invalid';
      end if;
    elsif v_entry.secret_id is not null
       or v_entry.secret_value is not null
       or v_entry.safe_value is null
       or length(v_entry.safe_value) > 500 then
      raise exception using errcode = '22023', message = 'integration_app_configuration_safe_value_invalid';
    end if;
  end loop;

  insert into public.integration_app_configuration_groups(
    provider_key, environment_key, configuration_source, version,
    updated_by_admin_user_id
  ) values (
    p_provider_key, p_environment_key, p_configuration_source, 0,
    p_actor_admin_user_id
  ) on conflict (provider_key, environment_key) do nothing;

  select * into v_group
  from public.integration_app_configuration_groups
  where provider_key = p_provider_key and environment_key = p_environment_key
  for update;

  if v_group.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'integration_app_configuration_version_conflict';
  end if;

  select coalesce(array_agg(vault_secret_id), array[]::uuid[])
  into v_old_secret_ids
  from public.integration_app_configuration_entries
  where group_id = v_group.id and vault_secret_id is not null;

  for v_entry in
    select
      value ->> 'configuration_key' as configuration_key,
      coalesce((value ->> 'is_secret')::boolean, false) as is_secret,
      nullif(value ->> 'secret_id', '')::uuid as secret_id,
      nullif(value ->> 'secret_value', '') as secret_value
    from jsonb_array_elements(p_entries)
  loop
    if v_entry.is_secret and v_entry.secret_value is null and not exists (
      select 1 from public.integration_app_configuration_entries current_entry
      where current_entry.group_id = v_group.id
        and current_entry.configuration_key = v_entry.configuration_key
        and current_entry.vault_secret_id = v_entry.secret_id
    ) then
      raise exception using errcode = '22023', message = 'integration_app_configuration_vault_reference_invalid';
    end if;
  end loop;

  delete from public.integration_app_configuration_entries where group_id = v_group.id;
  for v_entry in
    select
      value ->> 'configuration_key' as configuration_key,
      coalesce((value ->> 'is_secret')::boolean, false) as is_secret,
      nullif(value ->> 'secret_id', '')::uuid as secret_id,
      nullif(value ->> 'secret_value', '') as secret_value,
      nullif(btrim(value ->> 'safe_value'), '') as safe_value
    from jsonb_array_elements(p_entries)
  loop
    v_new_secret_id := v_entry.secret_id;
    if v_entry.is_secret and v_entry.secret_value is not null then
      select vault.create_secret(
        v_entry.secret_value,
        format('integration-app-%s-%s-%s', p_provider_key, v_entry.configuration_key, gen_random_uuid()),
        'Provider application credential owned by Integrations Server Configuration.'
      ) into v_new_secret_id;
    end if;
    insert into public.integration_app_configuration_entries(
      group_id, provider_key, configuration_key, is_secret,
      vault_secret_id, safe_value, safe_metadata
    ) values (
      v_group.id, p_provider_key, v_entry.configuration_key, v_entry.is_secret,
      v_new_secret_id, v_entry.safe_value,
      case when v_entry.is_secret then jsonb_build_object('display', 'Configured') else '{}'::jsonb end
    );
  end loop;

  update public.integration_app_configuration_groups
  set configuration_source = p_configuration_source,
      version = version + 1,
      updated_by_admin_user_id = p_actor_admin_user_id,
      updated_at = clock_timestamp()
  where id = v_group.id
  returning * into v_group;

  foreach v_integration in array case p_provider_key
    when 'google' then array['google_analytics','google_search_console','google_ads']
    when 'meta' then array['meta_business','whatsapp_business']
    when 'tiktok' then array['tiktok_ads']
    else array['snapchat_ads']
  end
  loop
    select coalesce(array_agg(required_key order by required_key), array[]::text[])
    into v_missing
    from unnest(public.integration_app_configuration_required_keys(v_integration)) required_key
    where not exists (
      select 1 from public.integration_app_configuration_entries entry
      where entry.group_id = v_group.id and entry.configuration_key = required_key
    );

    insert into public.integration_app_configuration_validations(
      group_id, provider_key, integration_key, status, missing_keys,
      last_tested_at, safe_error_code, version
    ) values (
      v_group.id, p_provider_key, v_integration,
      case when cardinality(v_missing) > 0 then 'configuration_incomplete'
           else 'configuration_saved_waiting_for_authorization' end,
      v_missing, null, null, 1
    ) on conflict (group_id, integration_key) do update
      set status = excluded.status,
          missing_keys = excluded.missing_keys,
          last_tested_at = null,
          safe_error_code = null,
          version = public.integration_app_configuration_validations.version + 1,
          test_window_started_at = null,
          test_attempts_in_window = 0,
          updated_at = clock_timestamp();
  end loop;

  if cardinality(coalesce(p_affected_integrations, array[]::text[])) > 0 then
    if exists (
      select 1 from unnest(p_affected_integrations) affected
      where public.integration_app_configuration_provider(affected) is distinct from p_provider_key
    ) then
      raise exception using errcode = '22023', message = 'integration_app_configuration_affected_owner_invalid';
    end if;
    update public.integration_connections
    set status = 'needs_reauth',
        last_error_code = 'integration_app_configuration_changed',
        last_error_message = 'Application configuration changed; provider authorization must be renewed.',
        updated_by_admin_user_id = p_actor_admin_user_id,
        updated_at = clock_timestamp(),
        version = version + 1
    where integration_key = any(p_affected_integrations)
      and environment_key = p_environment_key
      and revoked_at is null;
  end if;

  delete from vault.secrets secret
  where secret.id = any(coalesce(v_old_secret_ids, array[]::uuid[]))
    and not exists (
      select 1 from public.integration_app_configuration_entries entry
      where entry.vault_secret_id = secret.id
    );

  return jsonb_build_object('groupId', v_group.id, 'version', v_group.version);
end;
$$;

create or replace function public.remove_integration_app_configuration(
  p_provider_key text,
  p_environment_key text,
  p_expected_version integer,
  p_actor_admin_user_id bigint
) returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_catalog, pg_temp
as $$
declare
  v_group public.integration_app_configuration_groups%rowtype;
  v_secret_ids uuid[];
  v_integrations text[];
begin
  select * into v_group
  from public.integration_app_configuration_groups
  where provider_key = btrim(p_provider_key)
    and environment_key = lower(btrim(p_environment_key))
  for update;
  if not found then return false; end if;
  if v_group.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'integration_app_configuration_version_conflict';
  end if;

  select coalesce(array_agg(vault_secret_id), array[]::uuid[])
  into v_secret_ids
  from public.integration_app_configuration_entries
  where group_id = v_group.id and vault_secret_id is not null;

  v_integrations := case v_group.provider_key
    when 'google' then array['google_analytics','google_search_console','google_ads']
    when 'meta' then array['meta_business','whatsapp_business']
    when 'tiktok' then array['tiktok_ads']
    else array['snapchat_ads']
  end;

  update public.integration_connections
  set status = 'needs_reauth',
      last_error_code = 'integration_app_configuration_removed',
      last_error_message = 'Application configuration was removed; provider authorization must be renewed after configuration is restored.',
      updated_by_admin_user_id = p_actor_admin_user_id,
      updated_at = clock_timestamp(),
      version = version + 1
  where integration_key = any(v_integrations)
    and environment_key = v_group.environment_key
    and revoked_at is null;

  delete from public.integration_app_configuration_groups where id = v_group.id;
  delete from vault.secrets where id = any(coalesce(v_secret_ids, array[]::uuid[]));
  return true;
end;
$$;

create or replace function public.claim_integration_app_configuration_test(
  p_integration_key text,
  p_environment_key text,
  p_expected_group_version integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_provider text := public.integration_app_configuration_provider(p_integration_key);
  v_group public.integration_app_configuration_groups%rowtype;
  v_validation public.integration_app_configuration_validations%rowtype;
  v_missing text[];
begin
  if v_provider is null then
    raise exception using errcode = '22023', message = 'integration_app_configuration_owner_missing';
  end if;
  select * into v_group
  from public.integration_app_configuration_groups
  where provider_key = v_provider and environment_key = lower(btrim(p_environment_key))
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'integration_app_configuration_missing';
  end if;
  if v_group.version <> p_expected_group_version then
    raise exception using errcode = '40001', message = 'integration_app_configuration_version_conflict';
  end if;

  select coalesce(array_agg(required_key order by required_key), array[]::text[])
  into v_missing
  from unnest(public.integration_app_configuration_required_keys(p_integration_key)) required_key
  where not exists (
    select 1 from public.integration_app_configuration_entries entry
    where entry.group_id = v_group.id and entry.configuration_key = required_key
  );
  if cardinality(v_missing) > 0 then
    raise exception using errcode = 'P0001', message = 'integration_app_configuration_incomplete';
  end if;

  insert into public.integration_app_configuration_validations(
    group_id, provider_key, integration_key, status, missing_keys
  ) values (
    v_group.id, v_provider, p_integration_key,
    'configuration_saved_waiting_for_authorization', array[]::text[]
  ) on conflict (group_id, integration_key) do nothing;

  select * into v_validation
  from public.integration_app_configuration_validations
  where group_id = v_group.id and integration_key = p_integration_key
  for update;

  if v_validation.test_window_started_at is null
     or v_validation.test_window_started_at <= clock_timestamp() - interval '10 minutes' then
    v_validation.test_window_started_at := clock_timestamp();
    v_validation.test_attempts_in_window := 0;
  end if;
  if v_validation.test_attempts_in_window >= 5 then
    raise exception using errcode = 'P0001', message = 'integration_app_configuration_test_rate_limited';
  end if;

  update public.integration_app_configuration_validations
  set test_window_started_at = v_validation.test_window_started_at,
      test_attempts_in_window = v_validation.test_attempts_in_window + 1,
      version = version + 1,
      updated_at = clock_timestamp()
  where group_id = v_group.id and integration_key = p_integration_key
  returning * into v_validation;

  return jsonb_build_object(
    'groupId', v_group.id,
    'groupVersion', v_group.version,
    'testVersion', v_validation.version
  );
end;
$$;

create or replace function public.complete_integration_app_configuration_test(
  p_integration_key text,
  p_environment_key text,
  p_test_version integer,
  p_status text,
  p_safe_error_code text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_provider text := public.integration_app_configuration_provider(p_integration_key);
  v_group_id uuid;
begin
  if p_status not in (
    'configuration_invalid','configuration_saved_waiting_for_authorization','ready_to_connect'
  ) or (p_safe_error_code is not null and p_safe_error_code !~ '^[a-z0-9_]{1,120}$') then
    raise exception using errcode = '22023', message = 'integration_app_configuration_test_result_invalid';
  end if;
  select id into v_group_id
  from public.integration_app_configuration_groups
  where provider_key = v_provider and environment_key = lower(btrim(p_environment_key));
  if v_group_id is null then
    raise exception using errcode = 'P0001', message = 'integration_app_configuration_missing';
  end if;

  update public.integration_app_configuration_validations
  set status = p_status,
      missing_keys = array[]::text[],
      last_tested_at = clock_timestamp(),
      safe_error_code = p_safe_error_code,
      version = version + 1,
      updated_at = clock_timestamp()
  where group_id = v_group_id
    and integration_key = p_integration_key
    and version = p_test_version;
  if not found then
    raise exception using errcode = '40001', message = 'integration_app_configuration_test_conflict';
  end if;
  return true;
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
    'serverConfigurationContractVersion', 'integrations-server-configuration-v1',
    'serverConfigurationMigrationVersion', '20260806140000',
    'serverConfigurationMigrationRegistered', exists(
      select 1 from supabase_migrations.schema_migrations where version = '20260806140000'
    ),
    'rls', jsonb_build_object(
      'integration_authorization_attempts', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_authorization_attempts'::regclass), false),
      'integration_connections', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_connections'::regclass), false),
      'integration_credentials', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_credentials'::regclass), false),
      'integration_connection_assets', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_connection_assets'::regclass), false),
      'integration_sync_runs', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_sync_runs'::regclass), false),
      'analytics_provider_read_models', coalesce((select relrowsecurity from pg_class where oid = 'public.analytics_provider_read_models'::regclass), false),
      'integration_app_configuration_groups', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_app_configuration_groups'::regclass), false),
      'integration_app_configuration_entries', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_app_configuration_entries'::regclass), false),
      'integration_app_configuration_validations', coalesce((select relrowsecurity from pg_class where oid = 'public.integration_app_configuration_validations'::regclass), false)
    ),
    'activeConnections', (select count(*) from public.integration_connections where revoked_at is null),
    'connected', (select count(*) from public.integration_connections where status = 'connected' and revoked_at is null),
    'applicationConfigurationGroups', (select count(*) from public.integration_app_configuration_groups),
    'applicationConfigurationSecrets', (
      select count(*) from public.integration_app_configuration_entries where vault_secret_id is not null
    ),
    'plaintextCredentialColumns', 0
  );
$$;

revoke all on function public.integration_app_configuration_provider(text) from public, anon, authenticated;
revoke all on function public.integration_app_configuration_required_keys(text) from public, anon, authenticated;
revoke all on function public.replace_integration_app_configuration(text,text,integer,jsonb,text[],bigint,text) from public, anon, authenticated;
revoke all on function public.remove_integration_app_configuration(text,text,integer,bigint) from public, anon, authenticated;
revoke all on function public.claim_integration_app_configuration_test(text,text,integer) from public, anon, authenticated;
revoke all on function public.complete_integration_app_configuration_test(text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.external_integrations_capability_health() from public, anon, authenticated;

grant execute on function public.integration_app_configuration_provider(text) to service_role;
grant execute on function public.integration_app_configuration_required_keys(text) to service_role;
grant execute on function public.replace_integration_app_configuration(text,text,integer,jsonb,text[],bigint,text) to service_role;
grant execute on function public.remove_integration_app_configuration(text,text,integer,bigint) to service_role;
grant execute on function public.claim_integration_app_configuration_test(text,text,integer) to service_role;
grant execute on function public.complete_integration_app_configuration_test(text,text,integer,text,text) to service_role;
grant execute on function public.external_integrations_capability_health() to service_role;

comment on table public.integration_app_configuration_groups is
  'Server Configuration Aggregate for provider app credentials; separate from per-account Connection Aggregates.';
comment on table public.integration_app_configuration_entries is
  'App configuration entries. Secret plaintext is prohibited; secret values live only in Supabase Vault.';
comment on table public.integration_app_configuration_validations is
  'Per-integration readiness and rate-limited test truth for the shared provider app configuration.';
