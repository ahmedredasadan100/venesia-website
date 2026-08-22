import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "sql", "migrations");
const MIGRATION_FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const VERSION_ALIASES = new Map([
  ["20260717063702", "20260717070000"],
  ["20260822094544", "20260822090000"],
]);

type Migration = {
  version: string;
  name: string;
  sql: string;
  sha256: string;
};

type RegistryRow = {
  version: string;
  name: string | null;
  statements: string[] | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeSemanticSql(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/^\s*--.*$/gmu, "")
    .replace(/\s+/gu, " ")
    .replace(/\s*([(),;=])\s*/gu, "$1")
    .trim()
    .toLowerCase();
}

const migrations: Migration[] = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => {
    const match = MIGRATION_FILE.exec(file);
    assert.ok(match, `Migration filename is not canonical: ${file}`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/\r\n?/gu, "\n");
    return { version: match[1], name: match[2], sql, sha256: sha256(sql) };
  });
const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));
const connectionString = process.env.SUPABASE_DB_URL;
assert.ok(connectionString, "SUPABASE_DB_URL is required.");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: "final-migration-registry-reconciliation",
});
await client.connect();

try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtextextended('venesia:migration-registry-reconciliation', 0))");
  await client.query("lock table supabase_migrations.schema_migrations in exclusive mode");

  const before = (await client.query(
    "select version, name, statements from supabase_migrations.schema_migrations order by version",
  )) as { rows: RegistryRow[] };
  const recognizedVersions = new Set([...byVersion.keys(), ...VERSION_ALIASES.keys()]);
  const unknown = before.rows.filter((row) => !recognizedVersions.has(row.version));
  assert.deepEqual(unknown, [], `Unknown remote migration registry entries: ${unknown.map((row) => row.version).join(", ")}`);

  for (const [remoteVersion, repositoryVersion] of VERSION_ALIASES) {
    const aliasRow = before.rows.find((row) => row.version === remoteVersion);
    if (!aliasRow) continue;
    assert.equal(
      before.rows.some((row) => row.version === repositoryVersion),
      false,
      `Both alias and canonical migration versions exist: ${remoteVersion}, ${repositoryVersion}`,
    );
    const migration = byVersion.get(repositoryVersion);
    assert.ok(migration, `Repository migration missing for alias target ${repositoryVersion}`);
    assert.equal(
      normalizeSemanticSql((aliasRow.statements ?? []).join("\n")),
      normalizeSemanticSql(migration.sql),
      `Alias registry SQL does not semantically match ${repositoryVersion}`,
    );
  }

  const canonicalBefore = new Set(before.rows.map((row) => VERSION_ALIASES.get(row.version) ?? row.version));
  const missingVersions = migrations.filter((migration) => !canonicalBefore.has(migration.version));
  const nonCanonicalRows = before.rows.filter((row) => {
    const canonicalVersion = VERSION_ALIASES.get(row.version) ?? row.version;
    const migration = byVersion.get(canonicalVersion);
    return row.version !== canonicalVersion
      || row.name !== migration?.name
      || row.statements?.length !== 1
      || sha256(row.statements?.[0] ?? "") !== migration?.sha256;
  });

  const plan = {
    repositoryVersions: migrations.length,
    remoteVersionsBefore: before.rows.length,
    missingVersions: missingVersions.map((migration) => migration.version),
    nonCanonicalVersions: nonCanonicalRows.map((row) => row.version),
  };

  if (!process.argv.includes("--apply")) {
    await client.query("rollback");
    console.log(JSON.stringify({ status: "dry_run", plan }, null, 2));
    process.exitCode = missingVersions.length || nonCanonicalRows.length ? 2 : 0;
  } else if (missingVersions.length === 0 && nonCanonicalRows.length === 0) {
    await client.query("rollback");
    console.log(JSON.stringify({ status: "already_reconciled", plan }, null, 2));
  } else {
    for (const [remoteVersion, repositoryVersion] of VERSION_ALIASES) {
      if (before.rows.some((row) => row.version === remoteVersion)) {
        await client.query(
          "update supabase_migrations.schema_migrations set version = $1 where version = $2",
          [repositoryVersion, remoteVersion],
        );
      }
    }

    for (const migration of migrations) {
      await client.query(
        `insert into supabase_migrations.schema_migrations(version, statements, name, created_by)
         values ($1, $2::text[], $3, 'final-legacy-database-reconciliation')
         on conflict (version) do update
           set statements = excluded.statements,
               name = excluded.name`,
        [migration.version, [migration.sql], migration.name],
      );
    }

    const after = (await client.query(
      "select version, name, statements from supabase_migrations.schema_migrations order by version",
    )) as { rows: RegistryRow[] };
    assert.deepEqual(after.rows.map((row) => row.version), migrations.map((migration) => migration.version));
    for (const [index, migration] of migrations.entries()) {
      const row = after.rows[index];
      assert.equal(row.name, migration.name, `Name reconciliation failed: ${migration.version}`);
      assert.equal(row.statements?.length, 1, `Statement reconciliation failed: ${migration.version}`);
      assert.equal(sha256(row.statements?.[0] ?? ""), migration.sha256, `SQL reconciliation failed: ${migration.version}`);
    }

    const corpusSha256 = sha256(migrations.map((migration) => `${migration.version}:${migration.sha256}`).join("\n"));
    await client.query(
      `insert into public.admin_audit_logs(actor_admin_user_id, actor_username, action, entity_type, entity_label, metadata)
       values (null, 'system:database-reconciliation', 'database.migration_registry_reconciled', 'database_registry',
               'supabase_migrations.schema_migrations',
               jsonb_build_object(
                 'repositoryMigrationCount', $1::int,
                 'remoteMigrationCountBefore', $2::int,
                 'missingVersionsReconciled', $3::int,
                 'nonCanonicalVersionsReconciled', $4::int,
                 'migrationCorpusSha256', $5::text
               ))`,
      [migrations.length, before.rows.length, missingVersions.length, nonCanonicalRows.length, corpusSha256],
    );
    await client.query("commit");
    console.log(JSON.stringify({ status: "reconciled", plan, corpusSha256 }, null, 2));
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
