import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.SUPABASE_DB_URL;
assert.ok(connectionString, "SUPABASE_DB_URL is required.");

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const migrations = [
  { version: "20260805234500", name: "external_integrations_capability" },
  { version: "20260806010000", name: "external_integrations_asset_reselection_recovery" },
].map((entry) => ({
  ...entry,
  sql: readFileSync(`sql/migrations/${entry.version}_${entry.name}.sql`, "utf8")
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n"),
}));
const latestVersion = migrations.at(-1)!.version;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: "external-integrations-database-live-proof",
});
await client.connect();

try {
  for (const migration of migrations) {
    const registry = await client.query(
      "select statements, name from supabase_migrations.schema_migrations where version=$1",
      [migration.version],
    );
    assert.equal(registry.rowCount, 1);
    assert.equal(registry.rows[0].name, migration.name);
    assert.equal(sha256(String(registry.rows[0].statements?.[0] ?? "")), sha256(migration.sql));
  }

  const health = (await client.query(
    "select public.external_integrations_capability_health() as health",
  )).rows[0]?.health;
  assert.equal(health.contractVersion, "external-integrations-v1");
  assert.equal(health.migrationVersion, latestVersion);
  assert.equal(health.vaultAvailable, true);
  assert.equal(health.migrationRegistered, true);
  assert.ok(Object.values(health.rls as Record<string, boolean>).every(Boolean));

  const plaintextColumns = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema='public'
      and table_name in ('integration_connections','integration_credentials')
      and column_name in ('access_token','refresh_token','client_secret','app_secret')
  `);
  assert.equal(plaintextColumns.rowCount, 0);

  const invalid = await client.query(`
    select indexrelid::regclass::text as name
    from pg_index
    where indrelid in (
      'public.integration_connections'::regclass,
      'public.integration_connection_assets'::regclass,
      'public.integration_sync_runs'::regclass,
      'public.analytics_provider_read_models'::regclass
    ) and not indisvalid
  `);
  assert.equal(invalid.rowCount, 0);

  const functions = await client.query(`
    select p.oid::regprocedure::text as identity,
           has_function_privilege('anon', p.oid, 'execute') as anon_execute,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
           has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (
      p.proname like '%integration%' or p.proname='ingest_analytics_provider_read_model'
    )
  `);
  assert.ok(functions.rowCount >= 17);
  assert.ok(functions.rows.every((row: { anon_execute: boolean; authenticated_execute: boolean; service_execute: boolean }) =>
    row.anon_execute === false && row.authenticated_execute === false && row.service_execute === true));

  await client.query("begin");
  const actorId = Number((await client.query("select id from public.admin_users order by id limit 1")).rows[0]?.id);
  assert.ok(Number.isInteger(actorId) && actorId > 0, "an existing admin actor is required for rollback-only lifecycle proof");
  const environment = `proof-${randomUUID().slice(0, 8)}`;
  const accessId = (await client.query(
    "select public.create_integration_vault_secret($1,$2,$3) as id",
    ["rollback-only-access-token", `integration-proof-${environment}`, "Rollback-only integration database proof."],
  )).rows[0].id;
  const connectionId = (await client.query(`
    select public.promote_integration_authorization(
      'google_analytics',$1,$2,'google_oauth_refresh',$3,null,'proof-subject',
      array['https://www.googleapis.com/auth/analytics.readonly'],
      clock_timestamp() + interval '1 hour',null
    ) as id
  `, [environment, actorId, accessId])).rows[0].id;
  let connection = (await client.query(
    "select status from public.integration_connections where id=$1",
    [connectionId],
  )).rows[0];
  assert.equal(connection.status, "authorized_unbound");

  const assets = [
    { type: "account", externalId: "accounts/1", parentExternalId: null, displayName: "Proof account", permissions: ["read"], metadata: {} },
    { type: "property", externalId: "properties/1", parentExternalId: "accounts/1", displayName: "Proof property", permissions: ["read"], metadata: {} },
  ];
  assert.equal(Number((await client.query(
    "select public.replace_integration_discovered_assets($1,$2::jsonb,$3) as count",
    [connectionId, JSON.stringify(assets), actorId],
  )).rows[0].count), 2);
  const assetIds = (await client.query(
    "select array_agg(id order by asset_type)::text[] as ids from public.integration_connection_assets where connection_id=$1",
    [connectionId],
  )).rows[0].ids;
  assert.equal(Number((await client.query(
    "select public.select_integration_assets($1,$2::uuid[],$3) as count",
    [connectionId, assetIds, actorId],
  )).rows[0].count), 2);

  const runId = (await client.query(
    "select public.queue_integration_initial_sync($1,'initial',$2) as id",
    [connectionId, actorId],
  )).rows[0].id;
  const claim = (await client.query(
    "select public.claim_integration_sync_run($1,240) as claim",
    [runId],
  )).rows[0].claim;
  assert.equal(claim.connectionId, connectionId);
  await client.query(`
    select public.ingest_analytics_provider_read_model(
      $1,'google_analytics_4','last_30_days','none','ready','Rollback-only proof',
      $2::jsonb,clock_timestamp(),$3::jsonb
    )
  `, [connectionId, JSON.stringify([{ key: "content.most_viewed", value: 1 }]), JSON.stringify({ proof: true })]);
  await client.query(
    "select public.complete_integration_sync_run($1,$2,'completed',$3::jsonb,1,'Rollback-only proof')",
    [runId, claim.leaseToken, JSON.stringify({ proof: true })],
  );
  connection = (await client.query(
    "select status,last_sync_at,next_sync_at from public.integration_connections where id=$1",
    [connectionId],
  )).rows[0];
  assert.equal(connection.status, "connected");
  assert.ok(connection.last_sync_at && connection.next_sync_at);

  const failureRunId = (await client.query(
    "select public.queue_integration_initial_sync($1,'manual',$2) as id",
    [connectionId, actorId],
  )).rows[0].id;
  const failureClaim = (await client.query(
    "select public.claim_integration_sync_run($1,240) as claim",
    [failureRunId],
  )).rows[0].claim;
  await client.query(
    "select public.fail_integration_sync_run($1,$2,'proof_failure','Rollback-only failure',false)",
    [failureRunId, failureClaim.leaseToken],
  );
  connection = (await client.query(
    "select status,backoff_until,consecutive_failures from public.integration_connections where id=$1",
    [connectionId],
  )).rows[0];
  assert.equal(connection.status, "needs_attention");
  assert.ok(connection.backoff_until);
  assert.equal(connection.consecutive_failures, 1);

  assert.equal(Number((await client.query(
    "select public.select_integration_assets($1,$2::uuid[],$3) as count",
    [connectionId, assetIds, actorId],
  )).rows[0].count), 2, "needs_attention must allow asset reselection for recovery");
  assert.equal((await client.query(
    "select status from public.integration_connections where id=$1",
    [connectionId],
  )).rows[0].status, "testing");

  await client.query("update public.integration_connections set backoff_until=null where id=$1", [connectionId]);
  const reauthRunId = (await client.query(
    "select public.queue_integration_initial_sync($1,'manual',$2) as id",
    [connectionId, actorId],
  )).rows[0].id;
  const reauthClaim = (await client.query(
    "select public.claim_integration_sync_run($1,240) as claim",
    [reauthRunId],
  )).rows[0].claim;
  await client.query(
    "select public.fail_integration_sync_run($1,$2,'invalid_grant','Rollback-only reauth',true)",
    [reauthRunId, reauthClaim.leaseToken],
  );
  assert.equal((await client.query(
    "select status from public.integration_connections where id=$1",
    [connectionId],
  )).rows[0].status, "needs_reauth");

  await client.query("select public.revoke_integration_connection($1,$2)", [connectionId, actorId]);
  assert.equal(Number((await client.query(
    "select count(*)::int as count from public.integration_credentials where connection_id=$1",
    [connectionId],
  )).rows[0].count), 0);
  assert.equal((await client.query(
    "select public.read_integration_vault_secret($1) as secret",
    [accessId],
  )).rows[0].secret, null);
  await client.query("rollback");

console.log("OK: live registry/Vault/RLS/ACL/index proof and rollback-only connection lifecycle, asset-reselection recovery, ingestion, lease, backoff, reauth, and revoke behavior passed.");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
