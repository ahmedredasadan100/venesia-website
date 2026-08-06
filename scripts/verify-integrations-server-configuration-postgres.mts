import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const migrationVersion = "20260806140000";
const migration = readFileSync(
  "sql/migrations/20260806140000_integrations_server_configuration_capability.sql",
  "utf8",
).replace(/^\uFEFF/u, "");

const db = await PGlite.create({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create extension if not exists pgcrypto;
    create schema vault;
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key);
    create table vault.secrets (
      id uuid primary key default gen_random_uuid(),
      secret text not null,
      name text,
      description text
    );
    create function vault.create_secret(p_secret text, p_name text, p_description text)
    returns uuid language plpgsql as $$
    declare v_id uuid;
    begin
      insert into vault.secrets(secret,name,description)
      values(p_secret,p_name,p_description) returning id into v_id;
      return v_id;
    end;
    $$;

    create table public.admin_users(id bigint primary key);
    create table public.integration_authorization_attempts(id uuid primary key default gen_random_uuid());
    create table public.integration_credentials(id uuid primary key default gen_random_uuid());
    create table public.integration_connection_assets(id uuid primary key default gen_random_uuid());
    create table public.integration_sync_runs(id uuid primary key default gen_random_uuid());
    create table public.analytics_provider_read_models(id uuid primary key default gen_random_uuid());
    create table public.integration_connections (
      id uuid primary key default gen_random_uuid(),
      integration_key text not null,
      environment_key text not null,
      status text not null default 'disconnected',
      last_error_code text,
      last_error_message text,
      updated_by_admin_user_id bigint,
      updated_at timestamptz not null default now(),
      version integer not null default 1,
      revoked_at timestamptz
    );
    alter table public.integration_authorization_attempts enable row level security;
    alter table public.integration_credentials enable row level security;
    alter table public.integration_connection_assets enable row level security;
    alter table public.integration_sync_runs enable row level security;
    alter table public.analytics_provider_read_models enable row level security;
    alter table public.integration_connections enable row level security;
    insert into public.admin_users(id) values (1);
  `);

  await db.exec("begin;");
  await db.exec(migration);
  await db.query(
    "insert into supabase_migrations.schema_migrations(version) values('20260806010000'),($1)",
    [migrationVersion],
  );
  await db.exec("commit;");

  const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(`
    select relname, relrowsecurity
      from pg_class
     where relname in (
       'integration_app_configuration_groups',
       'integration_app_configuration_entries',
       'integration_app_configuration_validations'
     ) order by relname
  `);
  assert.equal(rls.rows.length, 3);
  assert.ok(rls.rows.every((row) => row.relrowsecurity));

  const initialEntries = JSON.stringify([
    {
      configuration_key: "meta_app_id",
      is_secret: false,
      secret_id: null,
      secret_value: null,
      safe_value: "123456789012345",
    },
    {
      configuration_key: "meta_app_secret",
      is_secret: true,
      secret_id: null,
      secret_value: "fixture-meta-secret",
      safe_value: null,
    },
  ]);
  const created = await db.query<{ result: { groupId: string; version: number } }>(
    `select public.replace_integration_app_configuration(
      'meta','production',0,$1::jsonb,array[]::text[],1,'cms_vault'
    ) as result`,
    [initialEntries],
  );
  assert.equal(created.rows[0]?.result.version, 1);
  const secret = await db.query<{ id: string; secret: string }>("select id,secret from vault.secrets");
  assert.equal(secret.rows.length, 1);
  assert.equal(secret.rows[0]?.secret, "fixture-meta-secret");
  const ordinary = await db.query<{ safe_value: string | null; vault_secret_id: string | null }>(
    "select safe_value,vault_secret_id from integration_app_configuration_entries where configuration_key='meta_app_secret'",
  );
  assert.equal(ordinary.rows[0]?.safe_value, null);
  assert.equal(ordinary.rows[0]?.vault_secret_id, secret.rows[0]?.id);

  const validation = await db.query<{ integration_key: string; status: string }>(
    "select integration_key,status from integration_app_configuration_validations order by integration_key",
  );
  assert.deepEqual(validation.rows, [
    { integration_key: "meta_business", status: "configuration_saved_waiting_for_authorization" },
    { integration_key: "whatsapp_business", status: "configuration_saved_waiting_for_authorization" },
  ]);

  const retainedEntries = JSON.stringify([
    {
      configuration_key: "meta_app_id",
      is_secret: false,
      secret_id: null,
      secret_value: null,
      safe_value: "123456789012346",
    },
    {
      configuration_key: "meta_app_secret",
      is_secret: true,
      secret_id: secret.rows[0]?.id,
      secret_value: null,
      safe_value: null,
    },
  ]);
  const replaced = await db.query<{ result: { version: number } }>(
    "select public.replace_integration_app_configuration('meta','production',1,$1::jsonb,array[]::text[],1,'cms_vault') as result",
    [retainedEntries],
  );
  assert.equal(replaced.rows[0]?.result.version, 2);
  assert.equal(Number((await db.query<{ count: number }>("select count(*)::integer as count from vault.secrets")).rows[0]?.count), 1);

  const replacementEntries = JSON.stringify([
    {
      configuration_key: "meta_app_id",
      is_secret: false,
      secret_id: null,
      secret_value: null,
      safe_value: "123456789012346",
    },
    {
      configuration_key: "meta_app_secret",
      is_secret: true,
      secret_id: null,
      secret_value: "fixture-meta-secret-replaced",
      safe_value: null,
    },
  ]);
  const secretReplaced = await db.query<{ result: { version: number } }>(
    "select public.replace_integration_app_configuration('meta','production',2,$1::jsonb,array[]::text[],1,'cms_vault') as result",
    [replacementEntries],
  );
  assert.equal(secretReplaced.rows[0]?.result.version, 3);
  const replacementVaultRows = await db.query<{ id: string; secret: string }>("select id,secret from vault.secrets");
  assert.deepEqual(replacementVaultRows.rows.map((row) => row.secret), ["fixture-meta-secret-replaced"]);
  assert.notEqual(replacementVaultRows.rows[0]?.id, secret.rows[0]?.id, "replacement must retire the old Vault UUID");

  const beforeConflict = Number((await db.query<{ count: number }>("select count(*)::integer as count from vault.secrets")).rows[0]?.count);
  const conflictEntries = JSON.stringify([
    {
      configuration_key: "meta_app_id",
      is_secret: false,
      secret_id: null,
      secret_value: null,
      safe_value: "123456789012347",
    },
    {
      configuration_key: "meta_app_secret",
      is_secret: true,
      secret_id: null,
      secret_value: "must-rollback",
      safe_value: null,
    },
  ]);
  await assert.rejects(
    db.query(
      "select public.replace_integration_app_configuration('meta','production',2,$1::jsonb,array[]::text[],1,'cms_vault')",
      [conflictEntries],
    ),
    /integration_app_configuration_version_conflict/,
  );
  assert.equal(Number((await db.query<{ count: number }>("select count(*)::integer as count from vault.secrets")).rows[0]?.count), beforeConflict);

  await assert.rejects(
    db.query(
      "select public.replace_integration_app_configuration('meta','invalid environment!',0,$1::jsonb,array[]::text[],1,'cms_vault')",
      [replacementEntries],
    ),
    /integration_app_configuration_input_invalid/,
  );
  const rogue = await db.query<{ id: string }>(
    "insert into vault.secrets(secret,name) values('rogue-secret','unowned') returning id",
  );
  const rogueReferenceEntries = JSON.stringify([
    {
      configuration_key: "meta_app_id",
      is_secret: false,
      secret_id: null,
      secret_value: null,
      safe_value: "123456789012346",
    },
    {
      configuration_key: "meta_app_secret",
      is_secret: true,
      secret_id: rogue.rows[0]?.id,
      secret_value: null,
      safe_value: null,
    },
  ]);
  await assert.rejects(
    db.query(
      "select public.replace_integration_app_configuration('meta','production',3,$1::jsonb,array[]::text[],1,'cms_vault')",
      [rogueReferenceEntries],
    ),
    /integration_app_configuration_vault_reference_invalid/,
  );
  await db.query("delete from vault.secrets where id=$1", [rogue.rows[0]?.id]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await db.query(
      "select public.claim_integration_app_configuration_test('meta_business','production',3)",
    );
  }
  await assert.rejects(
    db.query("select public.claim_integration_app_configuration_test('meta_business','production',3)"),
    /integration_app_configuration_test_rate_limited/,
  );

  const health = await db.query<{ value: {
    migrationVersion: string;
    migrationRegistered: boolean;
    serverConfigurationMigrationVersion: string;
    serverConfigurationMigrationRegistered: boolean;
    plaintextCredentialColumns: number;
  } }>(
    "select public.external_integrations_capability_health() as value",
  );
  assert.equal(health.rows[0]?.value.migrationVersion, "20260806010000");
  assert.equal(health.rows[0]?.value.migrationRegistered, true);
  assert.equal(health.rows[0]?.value.serverConfigurationMigrationVersion, migrationVersion);
  assert.equal(health.rows[0]?.value.serverConfigurationMigrationRegistered, true);
  assert.equal(health.rows[0]?.value.plaintextCredentialColumns, 0);

  const removed = await db.query<{ value: boolean }>(
    "select public.remove_integration_app_configuration('meta','production',3,1) as value",
  );
  assert.equal(removed.rows[0]?.value, true);
  assert.equal(Number((await db.query<{ count: number }>("select count(*)::integer as count from vault.secrets")).rows[0]?.count), 0);
  assert.equal(Number((await db.query<{ count: number }>("select count(*)::integer as count from integration_app_configuration_groups")).rows[0]?.count), 0);

  console.log("OK: disposable PostgreSQL proved atomic Vault replacement, rollback, optimistic concurrency, rate limits, RLS, health, and removal.");
} finally {
  await db.close();
}
