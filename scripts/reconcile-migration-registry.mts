import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMigrationSourceProvenance,
  assertWholeFileMigrationProvenance,
  classifyWholeFileMigrationProvenance,
  isMigrationHistoryCompatibilityVersion,
} from "./lib/migration-provenance.mjs";

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

function readMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => {
    const match = MIGRATION_FILE.exec(file);
    assert.ok(match, `Migration filename is not canonical: ${file}`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/\r\n?/gu, "\n");
    const migration = { version: match[1], name: match[2], sql, sha256: sha256(sql) };
    assertMigrationSourceProvenance(migration);
    return migration;
  });
}

async function runLegacyRegistryReconciliation() {
const migrations = readMigrations();
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
  // An applied revision is evidence, never a repair target. Unknown bytes for
  // the compatibility version stop even the historical broad repair mode.
  const preservedRevisions = new Map(before.rows
    .filter((row) => isMigrationHistoryCompatibilityVersion(row.version))
    .map((row) => {
      const migration = byVersion.get(row.version);
      assert.ok(migration);
      const provenance = assertWholeFileMigrationProvenance(row, migration);
      return [row.version, { row, provenance }] as const;
    }));

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
    if (preservedRevisions.has(row.version)) return false;
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
    preservedRevisions: [...preservedRevisions.values()].map(({ row, provenance }) => ({ version: row.version, ...provenance })),
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
      if (preservedRevisions.has(migration.version)) continue;
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
      assertWholeFileMigrationProvenance(row, migration);
      const preserved = preservedRevisions.get(migration.version);
      if (preserved) assert.deepEqual(row, preserved.row, "Applied revision provenance changed during unrelated reconciliation.");
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
}

export type SelectedCliRegistryReceipt = {
  kind: "selected-cli-migration-registry-receipt";
  formatVersion: 1;
  cli: { version: string; binarySha256: string };
  baseline: { count: number; sha256: string };
  migrations: Array<{ version: string; name: string; sourceSha256: string; statements: string[] }>;
};

export type SelectedCliRegistryOptions = {
  confirmation: "selected-cli-migration-registry";
  connectionString: string;
  expectedDatabase: string;
  versions: string[];
  receipt: SelectedCliRegistryReceipt;
  cliBinary: string;
  apply?: boolean;
  production?: {
    confirmation: "production-selected-cli-migration-registry";
    projectRef: string;
    expectedHost: string;
    sslCaFile?: string;
  };
};

export type SelectedCliRegistryReport = {
  status: "dry_run" | "already_canonical" | "reconciled";
  selected: number;
  registryRows: number;
  historicalRows: number;
  alreadyCanonical: number;
  wouldUpdate: number;
  updated: number;
  untouched: number;
  preservedRevisions: Array<{ version: string; revision: "historical-applied" | "fresh-bootstrap-superseded" | "fresh-bootstrap-corrected"; sourceSha256: string }>;
};

type CompleteRegistryRow = RegistryRow & { full_row: Record<string, unknown> };
const SELECT_REGISTRY = "select version, name, statements, to_jsonb(registry) as full_row from supabase_migrations.schema_migrations registry order by version";
const SHA256 = /^[a-f0-9]{64}$/u;

/** Receipt hashing deliberately preserves every registry statement byte. */
export function selectedRegistryBaseline(rows: RegistryRow[]) {
  const ordered = [...rows].sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0);
  return {
    count: ordered.length,
    sha256: sha256(JSON.stringify(ordered.map(({ version, name, statements }) => ({ version, name, statements })))),
  };
}

function selectedRegistryTarget(options: SelectedCliRegistryOptions) {
  const target = new URL(options.connectionString);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol));
  assert.equal(target.search, ""); // pg URL options must never replace verified TLS.
  assert.equal(target.hash, "");
  assert.match(options.expectedDatabase, /^[a-z][a-z0-9_]*$/u);
  assert.equal(decodeURIComponent(target.pathname.slice(1)), options.expectedDatabase);
  if (!options.production) {
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
    assert.notEqual(options.expectedDatabase, "postgres");
    return false;
  }
  const production = options.production;
  assert.equal(production.confirmation, "production-selected-cli-migration-registry");
  assert.match(production.projectRef, /^[a-z]{20}$/u);
  assert.equal(target.hostname, production.expectedHost);
  assert.equal(options.expectedDatabase, "postgres");
  assert.ok(!target.port || target.port === "5432");
  assert.ok(target.password);
  const username = decodeURIComponent(target.username);
  assert.ok((target.hostname === `db.${production.projectRef}.supabase.co` && username === "postgres")
    || (/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/u.test(target.hostname)
      && username === `postgres.${production.projectRef}`));
  return {
    rejectUnauthorized: true,
    ...(production.sslCaFile ? { ca: readFileSync(production.sslCaFile, "utf8") } : {}),
  };
}

/**
 * Canonicalize only actual, source-bound CLI entries. This path never invokes
 * semantic normalization, alias repair, migration replay, or missing-row insert.
 */
export async function reconcileSelectedMigrationRegistry(options: SelectedCliRegistryOptions): Promise<SelectedCliRegistryReport> {
  let stage = "preflight";
  let client: InstanceType<typeof Client> | undefined;
  let transactionOpen = false;
  try {
    assert.equal(options.confirmation, "selected-cli-migration-registry");
    assert.ok(Array.isArray(options.versions) && options.versions.length > 0);
    assert.equal(new Set(options.versions).size, options.versions.length);
    const receipt = options.receipt;
    assert.equal(receipt?.kind, "selected-cli-migration-registry-receipt");
    assert.equal(receipt.formatVersion, 1);
    assert.match(receipt.cli.version, /^\d+\.\d+\.\d+$/u);
    assert.match(receipt.cli.binarySha256, SHA256);
    assert.equal(createHash("sha256").update(readFileSync(options.cliBinary)).digest("hex"), receipt.cli.binarySha256);
    assert.ok(Number.isSafeInteger(receipt.baseline.count) && receipt.baseline.count >= 0);
    assert.match(receipt.baseline.sha256, SHA256);
    assert.ok(Array.isArray(receipt.migrations) && receipt.migrations.length > 0);
    const migrations = readMigrations();
    const repository = new Map(migrations.map((migration) => [migration.version, migration]));
    assert.equal(new Set(receipt.migrations.map((migration) => migration.version)).size, receipt.migrations.length);
    const phase = new Map(receipt.migrations.map((entry) => {
      assert.match(entry.version, /^\d{14}$/u);
      assert.match(entry.name, /^[a-z0-9_]+$/u);
      assert.match(entry.sourceSha256, SHA256);
      assert.ok(Array.isArray(entry.statements) && entry.statements.length > 0
        && entry.statements.every((statement) => typeof statement === "string" && statement.length > 0));
      const migration = repository.get(entry.version);
      assert.ok(migration);
      assert.equal(entry.name, migration.name);
      assert.equal(entry.sourceSha256, migration.sha256);
      return [entry.version, { receipt: entry, migration }] as const;
    }));
    for (const version of options.versions) assert.ok(phase.has(version));
    const selected = new Set(options.versions);
    const ssl = selectedRegistryTarget(options);
    client = new Client({
      connectionString: options.connectionString,
      ssl,
      connectionTimeoutMillis: 15_000,
      statement_timeout: 30_000,
      application_name: "selected-cli-migration-registry-reconciliation",
    });
    stage = "connection";
    await client.connect();
    const identity = await client.query("select current_database() as database, current_user as role");
    assert.equal(identity.rows[0]?.database, options.expectedDatabase);
    if (options.production) assert.equal(identity.rows[0]?.role, "postgres");

    stage = "locked_registry_verification";
    await client.query("begin");
    transactionOpen = true;
    await client.query("set local lock_timeout = '5000ms'");
    await client.query("set local statement_timeout = '30000ms'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('venesia:migration-registry-reconciliation', 0))");
    await client.query("lock table supabase_migrations.schema_migrations in exclusive mode");
    const before = (await client.query(SELECT_REGISTRY)).rows as CompleteRegistryRow[];
    assert.equal(new Set(before.map((row) => row.version)).size, before.length);
    const historical = before.filter((row) => !phase.has(row.version));
    assert.deepEqual(selectedRegistryBaseline(historical), receipt.baseline);
    const preservedRevisions: SelectedCliRegistryReport["preservedRevisions"] = [];
    // A receipt cannot authorize aliases or unknown historical SQL. The
    // approved applied revisions remain exact history, not rewrite targets.
    for (const row of historical) {
      const migration = repository.get(row.version);
      assert.ok(migration);
      const provenance = assertWholeFileMigrationProvenance(row, migration);
      if (provenance.revision !== "canonical-current") preservedRevisions.push({ version: row.version, revision: provenance.revision, sourceSha256: provenance.sourceSha256 });
    }
    const pending: CompleteRegistryRow[] = [];
    let alreadyCanonical = 0;
    for (const row of before) {
      const entry = phase.get(row.version);
      if (!entry) continue;
      assert.equal(row.name, entry.migration.name);
      const provenance = classifyWholeFileMigrationProvenance(row, entry.migration);
      const canonical = provenance !== null;
      if (provenance && provenance.revision !== "canonical-current") preservedRevisions.push({ version: row.version, revision: provenance.revision, sourceSha256: provenance.sourceSha256 });
      if (!canonical) {
        // A selected CLI receipt must never authorize rewriting an approved revision,
        // including an unknown historical revision disguised as CLI statements.
        assert.equal(isMigrationHistoryCompatibilityVersion(row.version), false);
        assert.deepEqual(row.statements, entry.receipt.statements);
      }
      if (!selected.has(row.version)) continue;
      if (canonical) alreadyCanonical++;
      else pending.push(row);
    }
    assert.equal(alreadyCanonical + pending.length, selected.size); // Missing selected entries are never inserted.
    const report: SelectedCliRegistryReport = {
      status: !options.apply ? "dry_run" : pending.length ? "reconciled" : "already_canonical",
      selected: selected.size, registryRows: before.length, historicalRows: historical.length,
      alreadyCanonical, wouldUpdate: pending.length, updated: 0, untouched: before.length,
      preservedRevisions,
    };
    if (!options.apply || pending.length === 0) {
      await client.query("rollback");
      transactionOpen = false;
      return report;
    }

    stage = "selected_update";
    for (const row of pending) {
      const migration = phase.get(row.version)!.migration;
      const update = await client.query(
        `update supabase_migrations.schema_migrations set statements = $1::text[]
         where version = $2 and name = $3 and statements is not distinct from $4::text[]`,
        [[migration.sql], row.version, row.name, row.statements],
      );
      assert.equal(update.rowCount, 1);
    }

    stage = "before_commit_verification";
    const after = (await client.query(SELECT_REGISTRY)).rows as CompleteRegistryRow[];
    const changed = new Set(pending.map((row) => row.version));
    assert.deepEqual(after.map((row) => row.version), before.map((row) => row.version));
    for (const [index, row] of after.entries()) {
      const previous = before[index];
      const expectedStatements = changed.has(row.version) ? [phase.get(row.version)!.migration.sql] : previous.statements;
      assert.equal(row.name, previous.name);
      assert.deepEqual(row.statements, expectedStatements);
      assert.deepEqual(row.full_row, { ...previous.full_row, statements: expectedStatements });
    }
    stage = "audit";
    await client.query(
      `insert into public.admin_audit_logs(actor_admin_user_id, actor_username, action, entity_type, entity_label, metadata)
       values (null, 'system:database-reconciliation', 'database.migration_registry_reconciled', 'database_registry',
               'supabase_migrations.schema_migrations',
               jsonb_build_object('mode', 'selected_cli', 'selectedCount', $1::int,
                 'remoteMigrationCountBefore', $2::int, 'nonCanonicalVersionsReconciled', $3::int,
                 'historicalRowsUnchanged', $4::int, 'receiptSha256', $5::text))`,
      [selected.size, before.length, pending.length, historical.length, sha256(JSON.stringify(receipt))],
    );
    stage = "commit";
    await client.query("commit");
    transactionOpen = false;
    return { ...report, updated: pending.length, untouched: before.length - pending.length };
  } catch {
    if (transactionOpen) await client?.query("rollback").catch(() => undefined);
    // pg errors may include credentials, SQL, or private values. Never forward them.
    throw new Error(`Selected CLI migration registry reconciliation blocked (${stage}).`);
  } finally {
    await client?.end().catch(() => undefined);
  }
}

async function runSelectedRegistryCli(args: string[]) {
  const switches = new Set(["--selected-cli", "--apply"]);
  const valued = new Set(["--confirm", "--versions", "--receipt", "--cli-binary", "--database", "--production-confirm", "--project-ref", "--expected-host", "--ssl-ca-file"]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    assert.ok((switches.has(key) || valued.has(key)) && !values.has(key));
    if (switches.has(key)) values.set(key, "true");
    else {
      const value = args[++index];
      assert.ok(value && !value.startsWith("--"));
      values.set(key, value);
    }
  }
  assert.ok(values.has("--selected-cli"));
  const required = (key: string) => { const value = values.get(key); assert.ok(value); return value; };
  const productionKeys = ["--production-confirm", "--project-ref", "--expected-host", "--ssl-ca-file"];
  const production = productionKeys.some((key) => values.has(key)) ? {
    confirmation: required("--production-confirm") as "production-selected-cli-migration-registry",
    projectRef: required("--project-ref"), expectedHost: required("--expected-host"), sslCaFile: values.get("--ssl-ca-file"),
  } : undefined;
  const report = await reconcileSelectedMigrationRegistry({
    confirmation: required("--confirm") as "selected-cli-migration-registry",
    connectionString: process.env.SUPABASE_DB_URL ?? "",
    expectedDatabase: required("--database"), versions: required("--versions").split(","),
    receipt: JSON.parse(readFileSync(required("--receipt"), "utf8")) as SelectedCliRegistryReceipt,
    cliBinary: required("--cli-binary"), apply: values.has("--apply"), production,
  });
  console.log(JSON.stringify(report));
  if (!values.has("--apply") && report.wouldUpdate > 0) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--apply")) {
    await runLegacyRegistryReconciliation();
  } else {
    // Unknown/misspelled scoped flags must never fall through to broad repair.
    try { await runSelectedRegistryCli(args); }
    catch { console.error(JSON.stringify({ status: "blocked", outcome: "unconfirmed; verify registry before retry" })); process.exitCode = 1; }
  }
}
