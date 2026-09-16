import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertDatabaseSecurityCatalog,
  captureDatabaseSecurityCatalog,
  loadDatabaseSecurityContract,
  type DatabaseSecurityCatalog,
  type LoadedDatabaseSecurityContract,
  type SecurityMigrationSource,
  type SecurityReadClient,
} from "./database-rls-security-contract.mts";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";
import {
  assertMigrationSourceProvenance,
  assertWholeFileMigrationProvenance,
  loadMigrationHistoryCompatibility,
} from "./migration-provenance.mjs";

export const RLS_MIGRATION86_VERSION = "20260819041808";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type RegistryRow = { version: string; name: string | null; statements: string[] | null };
type RegistryReceipt = { version: string; name: string; statementCount: number; statementsSha256: string };
type Marker = { name: string; version: string; revision: string; inputState: string; sourceSha256: string };
type JsonObject = Record<string, unknown>;
export class RlsMigration86ObserverError extends Error {
  readonly code: string;
  readonly queryId: string;
  constructor(queryId: string, error: unknown) {
    assert.match(queryId, /^[a-z0-9-]+$/u);
    const value = error !== null && typeof error === "object" && "code" in error ? error.code : null;
    const code = typeof value === "string" && /^[0-9A-Z]{5}$/u.test(value) ? value : "QUERY_FAILED";
    super(`Migration86 observer ${queryId} failed (${code}).`);
    this.name = "RlsMigration86ObserverError";
    this.code = code;
    this.queryId = queryId;
  }
}

async function observerQuery(client: SecurityReadClient, queryId: string, sql: string, parameters?: unknown[]) {
  try { return await client.query(sql, parameters); }
  catch (error) { throw new RlsMigration86ObserverError(queryId, error); }
}

export type RlsMigration86Snapshot = {
  sourceSha256: string;
  security: DatabaseSecurityCatalog;
  optionalPair: { functions: JsonObject[]; events: JsonObject[] };
  lineage: JsonObject[];
  registry: RegistryReceipt[];
  audit: { count: number; rowsSha256: string };
};
export type RlsMigration86ExecutionReceipt = {
  throughVersion: string; applied: string[]; registered: number; corpusSha256: string;
};

function object(value: unknown, label: string): JsonObject {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), label);
  return value as JsonObject;
}

function migrationSource(migrations: SecurityMigrationSource[]) {
  const migration = migrations.find(item => item.version === RLS_MIGRATION86_VERSION);
  assert.ok(migration, "Migration86 source is missing.");
  const compatibility = loadMigrationHistoryCompatibility(RLS_MIGRATION86_VERSION);
  const source = { ...migration, name: compatibility.name };
  assert.ok(migration.name === undefined || migration.name === source.name, "Migration86 name drift.");
  assert.ok(migration.file === undefined || migration.file === `${source.version}_${source.name}.sql`, "Migration86 filename drift.");
  assertMigrationSourceProvenance(source);
  return { source, compatibility };
}

function quotedSource(sql: string, tag: string) {
  const parts = sql.split(`$${tag}$`);
  assert.equal(parts.length, 3, `Migration86 ${tag} source is missing or ambiguous.`);
  return parts[1];
}

function markersFromSource(sql: string): Marker[] {
  const markers = [...sql.matchAll(/\('([a-z_]+_provenance)','(\d{14})','([a-z0-9-]+)',\s*'([a-z0-9_-]+)','([a-f0-9]{64})'\)/gu)]
    .map(match => ({ name: match[1], version: match[2], revision: match[3], inputState: match[4], sourceSha256: match[5] }));
  assert.equal(markers.length, 2, "Migration86 must bind both existing fresh-lineage attestors.");
  assert.equal(new Set(markers.map(marker => marker.name)).size, markers.length);
  return markers;
}

/** Compare the executable SQL projection to the existing reader, not a second query owner. */
export async function assertRlsMigration86SourceContract(migrations: SecurityMigrationSource[]) {
  const { source, compatibility } = migrationSource(migrations);
  const security = loadDatabaseSecurityContract(migrations, { throughVersion: RLS_MIGRATION86_VERSION });
  let readerSql: string | undefined;
  await captureDatabaseSecurityCatalog({ async query(sql) {
    assert.equal(readerSql, undefined, "The security owner must retain its single SELECT snapshot.");
    readerSql = sql;
    return { rows: [{ document: {} }] };
  } }, security);
  assert.equal(quotedSource(source.sql, "security_catalog_projection"), readerSql,
    "Migration86 catalog projection drifted from captureDatabaseSecurityCatalog.");
  assert.equal(quotedSource(source.sql, "historical_hardening"),
    compatibility.historicalSql.replace(/^\s*begin;\s*/u, "").replace(/\s*commit;\s*$/u, ""),
    "Migration86 historical hardening is not the unchanged original contract.");
  const markers = markersFromSource(source.sql);
  const prefix = JSON.parse(quotedSource(source.sql, "reviewed_prefix85")) as unknown;
  assert.ok(Array.isArray(prefix) && prefix.length > 0, "Migration86 reviewed fresh prefix is unavailable.");
  return { source, security, markers, reviewedPrefix: prefix as JsonObject[] };
}

async function captureOptionalPair(client: SecurityReadClient) {
  const result = await observerQuery(client, "optional-pair", `select jsonb_build_object(
    'functions',coalesce((select jsonb_agg(jsonb_build_object(
      'oid',p.oid::text,'identity',p.oid::regprocedure::text,'arguments',p.pronargs,
      'securityDefiner',p.prosecdef,'returnType',p.prorettype::regtype::text,'config',p.proconfig,
      'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'),
      'postgresExecute',has_function_privilege('postgres',p.oid,'EXECUTE'),
      'publicExecute',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE')) order by p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='rls_auto_enable'),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('name',evtname,'functionOid',evtfoid::text,
      'enabled',evtenabled) order by oid) from pg_event_trigger where evtname='ensure_rls'),'[]'::jsonb)) as document`);
  assert.equal(result.rows.length, 1);
  const pair = object(object(result.rows[0], "Migration86 pair row").document, "Migration86 pair");
  assert.ok(Array.isArray(pair.functions) && Array.isArray(pair.events));
  return { functions: pair.functions.map(value => object(value, "Migration86 function")),
    events: pair.events.map(value => object(value, "Migration86 event")) };
}

function assertAbsentPair(pair: RlsMigration86Snapshot["optionalPair"]) {
  assert.deepEqual(pair, { functions: [], events: [] }, "Fresh Migration86 requires both optional historical objects absent.");
}

function assertHistoricalPair(pair: RlsMigration86Snapshot["optionalPair"]) {
  assert.equal(pair.functions.length, 1, "Historical Migration86 helper is missing or overloaded.");
  assert.equal(pair.events.length, 1, "Historical Migration86 event dependency is missing.");
  const fn = pair.functions[0];
  assert.equal(fn.arguments, 0);
  assert.equal(fn.securityDefiner, true);
  assert.equal(fn.returnType, "event_trigger");
  assert.ok(Array.isArray(fn.config) && fn.config.includes("search_path=pg_catalog"));
  assert.deepEqual(pair.events[0], { name: "ensure_rls", functionOid: fn.oid, enabled: "O" });
  assert.equal(fn.anonExecute, false);
  assert.equal(fn.authenticatedExecute, false);
  assert.equal(fn.publicExecute, false);
  assert.equal(fn.serviceExecute, true);
  assert.equal(fn.postgresExecute, true);
}

async function captureFreshLineage(client: SecurityReadClient, markers: Marker[], pattern: string) {
  const lineage: JsonObject[] = [];
  for (const marker of markers) {
    const result = await observerQuery(client, `${marker.version}-attestor-metadata`, `select p.pronargs as arguments,p.prokind as kind,p.proretset as returns_set,
      p.prorettype::regtype::text as return_type,p.prosecdef as security_definer,p.provolatile as volatility,
      l.lanname as language,pg_get_userbyid(p.proowner) as owner,p.proconfig as config,
      encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as source_sha256,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      (select jsonb_agg(jsonb_build_object('role',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        'privilege',a.privilege_type,'grantable',a.is_grantable)
        order by pg_get_userbyid(a.grantee)::text collate "C",a.privilege_type collate "C")
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) as acl
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where n.nspname='public' and p.proname=$1`, [marker.name]);
    assert.equal(result.rows.length, 1, "Migration86 fresh attestation is missing or ambiguous.");
    const fn = object(result.rows[0], "Migration86 fresh attestation");
    assert.deepEqual(fn, { arguments: 0, kind: "f", returns_set: false, return_type: "jsonb", security_definer: true,
      volatility: "s", language: "sql", owner: "postgres", config: ['search_path=""'], source_sha256: marker.sourceSha256,
      anon_execute: false, authenticated_execute: false,
      acl: [{ role: "postgres", privilege: "EXECUTE", grantable: false }, { role: "service_role", privilege: "EXECUTE", grantable: false }] });
    // The source-hashed immutable path survives retirement of the old live
    // health projection. The migration owns the exact extraction expression.
    const proofResult = await observerQuery(client, `${marker.version}-attestor-proof`, `with literals as (
      select replace(m.parts[1],chr(39)||chr(39),chr(39))::jsonb as proof
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      cross join lateral regexp_matches(p.prosrc,$2,'gi') as m(parts)
      where n.nspname='public' and p.proname=$1
        and encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')=$3)
      select jsonb_build_object('contract_version',proof->'contract_version',
      'migration_version',proof->'migration_version','migration_revision',proof->'migration_revision',
      'input_state',proof->'input_state','migration_registered',exists(
        select 1 from supabase_migrations.schema_migrations where version=$4 and cardinality(statements)>0)) as document
      from literals`, [marker.name, pattern, marker.sourceSha256, marker.version]);
    assert.equal(proofResult.rows.length, 1);
    const proof = object(object(proofResult.rows[0], "Migration86 lineage row").document, "Migration86 lineage");
    assert.deepEqual(proof, { contract_version: 1, migration_version: marker.version, migration_revision: marker.revision,
      input_state: marker.inputState, migration_registered: true });
    lineage.push({ name: marker.name, sourceSha256: marker.sourceSha256, ...proof });
  }
  return lineage;
}

function receipt(row: RegistryRow): RegistryReceipt {
  assert.match(row.version, /^\d{14}$/u);
  assert.ok(typeof row.name === "string" && /^[a-z0-9_]+$/u.test(row.name));
  assert.ok(Array.isArray(row.statements) && row.statements.length > 0
    && row.statements.every(statement => typeof statement === "string" && statement.length > 0));
  return { version: row.version, name: row.name, statementCount: row.statements.length,
    statementsSha256: hash(JSON.stringify(row.statements)) };
}

/** Isolated observer only; it neither executes a migration nor repairs history. */
export async function captureRlsMigration86Snapshot(handle: OwnedLocalHandle, migrations: SecurityMigrationSource[]): Promise<RlsMigration86Snapshot> {
  assertOwnedLocalHandle(handle);
  const approved = await assertRlsMigration86SourceContract(migrations);
  await observerQuery(handle, "begin", "begin transaction isolation level repeatable read read only");
  try {
    const security = await captureDatabaseSecurityCatalog({ query: (sql, parameters) =>
      observerQuery(handle, "security-catalog", sql, parameters) }, approved.security);
    assertDatabaseSecurityCatalog(approved.security, security);
    const optionalPair = await captureOptionalPair(handle);
    assertAbsentPair(optionalPair);
    const lineage = await captureFreshLineage(handle, approved.markers, quotedSource(approved.source.sql, "frozen_attestation_pattern"));
    const registryResult = await observerQuery(handle, "registry-receipts", "select version,name,statements from supabase_migrations.schema_migrations order by version");
    const registry = registryResult.rows.map(row => receipt(row as RegistryRow));
    const auditResult = await observerQuery(handle, "audit-digest", `select count(*)::int as count,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) order by id),'[]'::jsonb)::text,'UTF8')),'hex') as rows_sha256
      from public.admin_audit_logs a`);
    assert.equal(auditResult.rows.length, 1);
    const auditRow = object(auditResult.rows[0], "Migration86 audit digest");
    assert.ok(typeof auditRow.count === "number" && Number.isSafeInteger(auditRow.count) && auditRow.count >= 0);
    assert.ok(typeof auditRow.rows_sha256 === "string" && /^[a-f0-9]{64}$/u.test(auditRow.rows_sha256));
    const snapshot: RlsMigration86Snapshot = { sourceSha256: hash(approved.source.sql), security, optionalPair, lineage, registry,
      audit: { count: auditRow.count, rowsSha256: auditRow.rows_sha256 } };
    await observerQuery(handle, "commit", "commit");
    return snapshot;
  } catch (error) {
    await handle.query("rollback").catch(() => undefined);
    if (error instanceof RlsMigration86ObserverError) handle.record("migration86-observer-query-failed", {
      queryId: error.queryId, sqlState: error.code, rawErrorRetained: false,
    });
    throw error;
  }
}

export async function assertFreshRlsMigration86Transition(before: RlsMigration86Snapshot, after: RlsMigration86Snapshot,
  migrations: SecurityMigrationSource[], execution: RlsMigration86ExecutionReceipt) {
  const approved = await assertRlsMigration86SourceContract(migrations);
  assert.equal(before.sourceSha256, hash(approved.source.sql));
  assert.equal(after.sourceSha256, before.sourceSha256);
  assertAbsentPair(before.optionalPair);
  assertAbsentPair(after.optionalPair);
  assertDatabaseSecurityCatalog(approved.security, before.security);
  assert.deepEqual(after.security, before.security, "Migration86 changed the established security catalog.");
  assert.deepEqual(before.lineage, approved.markers.map(marker => ({ name: marker.name, sourceSha256: marker.sourceSha256,
    contract_version: 1, migration_version: marker.version, migration_revision: marker.revision,
    input_state: marker.inputState, migration_registered: true })), "Migration86 fresh lineage is incomplete.");
  assert.deepEqual(after.lineage, before.lineage, "Migration86 changed an existing initialization attestation.");
  assert.deepEqual(after.audit, before.audit, "Migration86 must not manufacture or modify audit history.");
  const prefix = migrations.filter(item => item.version <= RLS_MIGRATION86_VERSION);
  assert.equal(prefix.at(-1)?.version, RLS_MIGRATION86_VERSION, "Canonical migration prefix is not ordered.");
  assert.equal(new Set(prefix.map(item => item.version)).size, prefix.length, "Duplicate migration version.");
  assert.deepEqual(before.registry.map(row => row.version), prefix.slice(0, -1).map(item => item.version));
  assert.deepEqual(after.registry.slice(0, before.registry.length), before.registry, "Migration86 rewrote prior registry receipts.");
  assert.equal(after.registry.length, before.registry.length + 1);
  const appended = after.registry.at(-1)!;
  assert.equal(appended.version, RLS_MIGRATION86_VERSION);
  assert.equal(appended.name, approved.source.name);
  assert.ok(Number.isSafeInteger(appended.statementCount) && appended.statementCount > 0);
  assert.match(appended.statementsSha256, /^[a-f0-9]{64}$/u);
  const oldPrefix = before.registry.filter(row => row.version !== approved.security.migrationVersion)
    .map(row => ({ version: row.version, name: row.name, statement_count: row.statementCount, statements_sha256: row.statementsSha256 }));
  assert.deepEqual(oldPrefix, approved.reviewedPrefix, "Fresh lineage differs from the migration-owned reviewed CLI prefix.");
  assert.equal(execution.throughVersion, RLS_MIGRATION86_VERSION);
  assert.deepEqual(execution.applied, [`${RLS_MIGRATION86_VERSION}_${approved.source.name}.sql`]);
  assert.equal(execution.registered, after.registry.length);
  assert.equal(execution.corpusSha256, hash(prefix.map(item => `${item.version}:${hash(item.sql)}`).join("\n")));
  return { migrationVersion: RLS_MIGRATION86_VERSION, sourceSha256: after.sourceSha256, branch: "proven-fresh-absent" as const,
    securityCatalogUnchanged: true, optionalObjectsCreated: false, auditUnchanged: true, priorRegistryUnchanged: true,
    registryAppends: 1, officialCliExecutionProvenanceVerified: true, canonicalWholeFileRegistryVerified: false };
}

/** Live whole-file registry owner keeps its representation; CLI receipts are not normalized into it. */
export async function verifyRlsMigration86Compatibility(client: SecurityReadClient, options: {
  migrations: SecurityMigrationSource[]; registry: RegistryRow[]; security: LoadedDatabaseSecurityContract; catalog: DatabaseSecurityCatalog;
}) {
  const { source } = await assertRlsMigration86SourceContract(options.migrations);
  const row = options.registry.find(item => item.version === RLS_MIGRATION86_VERSION);
  assert.ok(row, "Migration86 registry provenance is missing.");
  const provenance = assertWholeFileMigrationProvenance(row, source);
  const pair = await captureOptionalPair(client);
  if (pair.functions.length === 1 && pair.events.length === 1) {
    assertHistoricalPair(pair);
    return { branch: "historical-hardened" as const, revision: provenance.revision };
  }
  assertAbsentPair(pair);
  assert.equal(provenance.revision, "fresh-bootstrap-corrected", "Absent historical helper requires corrected86 provenance.");
  assertDatabaseSecurityCatalog(options.security, options.catalog);
  const markers = markersFromSource(source.sql);
  for (const marker of markers) {
    const migration = options.migrations.find(item => item.version === marker.version);
    const registered = options.registry.find(item => item.version === marker.version);
    assert.ok(migration && registered, "Fresh lineage migration history is missing.");
    const compatibility = loadMigrationHistoryCompatibility(marker.version);
    const lineageSource = { ...migration, name: compatibility.name };
    assert.ok(migration.name === undefined || migration.name === compatibility.name);
    assert.equal(assertWholeFileMigrationProvenance(registered, lineageSource).revision, "fresh-bootstrap-corrected",
      "Fresh lineage must preserve the corrected revision actually applied.");
  }
  const lineage = await captureFreshLineage(client, markers, quotedSource(source.sql, "frozen_attestation_pattern"));
  return { branch: "proven-fresh-absent" as const, revision: provenance.revision, lineage };
}
