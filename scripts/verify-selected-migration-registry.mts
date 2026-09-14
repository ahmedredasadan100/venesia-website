import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import type { SelectedCliRegistryOptions, SelectedCliRegistryReceipt, SelectedCliRegistryReport } from "./reconcile-migration-registry.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Row = { version: string; name: string; statements: string[]; created_by: string; inserted_at: string; custom: string };
type State = {
  rows: Row[]; queries: Array<{ sql: string; params: unknown[] }>; options?: Record<string, unknown>;
  connections: number; updates: number; audits: number; registryReads: number;
  snapshot?: { rows: Row[]; audits: number };
  failConnect?: boolean; failEnd?: boolean; failAudit?: boolean; failCommitAfter?: boolean; zeroUpdate?: boolean;
  afterUpdate?: (rows: Row[]) => void; identity?: string;
};

/** Actual registry owner with a transaction-capable pg port; no socket or SQL replay. */
export async function verifySelectedMigrationRegistry() {
  let checks = 0;
  const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
  const dir = mkdtempSync(resolve(tmpdir(), "selected-migration-registry-"));
  const binary = resolve(dir, "fixture-cli.bin");
  const caFile = resolve(dir, "fixture-ca.pem");
  writeFileSync(binary, "fixture CLI transport identity");
  writeFileSync(caFile, "fixture verified CA");
  const file = resolve(ROOT, "scripts/reconcile-migration-registry.mts");
  const loadMigration = (name: string) => {
    const match = /^(\d{14})_([a-z0-9_]+)\.sql$/u.exec(name)!;
    const sql = readFileSync(resolve(ROOT, "sql/migrations", name), "utf8").replace(/\r\n?/gu, "\n");
    return { version: match[1], name: match[2], sql };
  };
  const history = loadMigration(readdirSync(resolve(ROOT, "sql/migrations")).filter((name) => name.endsWith(".sql")).sort()[0]);
  const phase = ["20260914004050_entity_seo_persisted_score.sql", "20260914004118_project_seo_persisted_score.sql", "20260914151556_entity_seo_score_enforcement.sql"].map(loadMigration);
  const historicalRow: Row = { version: history.version, name: history.name, statements: [history.sql], created_by: "untouched fixture", inserted_at: "fixed", custom: "private metadata" };
  const receipt: SelectedCliRegistryReceipt = {
    kind: "selected-cli-migration-registry-receipt", formatVersion: 1,
    cli: { version: "2.114.0", binarySha256: hash(readFileSync(binary, "utf8")) },
    baseline: { count: 1, sha256: hash(JSON.stringify([{ version: history.version, name: history.name, statements: [history.sql] }])) },
    // These are transport fixtures, not a claim to implement the CLI SQL parser.
    migrations: phase.map((migration, index) => ({ version: migration.version, name: migration.name, sourceSha256: hash(migration.sql), statements: [`-- exact recorded statement ${index}`, "begin", "commit"] })),
  };
  const initial = () => [structuredClone(historicalRow), ...receipt.migrations.map((migration) => ({
    version: migration.version, name: migration.name, statements: [...migration.statements],
    created_by: "fixture CLI", inserted_at: "fixed", custom: "retain every metadata field",
  }))].sort((a, b) => a.version.localeCompare(b.version));
  const freshState = (): State => ({ rows: initial(), queries: [], connections: 0, updates: 0, audits: 0, registryReads: 0 });
  let state = freshState();
  const reset = () => { state = freshState(); };
  class FakePgClient {
    constructor(options: Record<string, unknown>) { state.options = options; }
    async connect() { state.connections++; if (state.failConnect) throw new Error("password=PRIVATE_SECRET private SQL"); }
    async end() { if (state.failEnd) throw new Error("PRIVATE_SECRET on cleanup"); }
    async query(sql: string, params: unknown[] = []) {
      state.queries.push({ sql, params });
      if (sql.startsWith("select current_database()")) return { rows: [{ database: state.identity ?? (state.options?.ssl ? "postgres" : "registry_fixture"), role: "postgres" }] };
      if (sql === "begin") { state.registryReads = 0; state.snapshot = { rows: structuredClone(state.rows), audits: state.audits }; return { rows: [] }; }
      if (sql === "rollback") {
        if (state.snapshot) { state.rows = state.snapshot.rows; state.audits = state.snapshot.audits; state.snapshot = undefined; }
        return { rows: [] };
      }
      if (sql === "commit") { state.snapshot = undefined; if (state.failCommitAfter) throw new Error("PRIVATE_SECRET commit response lost"); return { rows: [] }; }
      if (sql.startsWith("set local ") || sql.startsWith("select pg_advisory_xact_lock") || sql.startsWith("lock table ")) return { rows: [] };
      if (sql.startsWith("select version, name, statements, to_jsonb")) {
        state.registryReads++;
        return { rows: state.rows.map((row) => ({ version: row.version, name: row.name, statements: structuredClone(row.statements), full_row: structuredClone(row) })) };
      }
      if (sql.startsWith("update supabase_migrations.schema_migrations set statements")) {
        assert.ok(state.snapshot, "Writes require an open transaction.");
        assert.ok(state.queries.some((query) => query.sql.includes("in exclusive mode")));
        const row = state.rows.find((item) => item.version === params[1] && item.name === params[2] && JSON.stringify(item.statements) === JSON.stringify(params[3]));
        if (!row || state.zeroUpdate) return { rows: [], rowCount: 0 };
        row.statements = structuredClone(params[0] as string[]);
        state.updates++;
        state.afterUpdate?.(state.rows);
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("insert into public.admin_audit_logs")) {
        assert.ok(state.registryReads === 2, "Verify complete post-state before the audit.");
        if (state.failAudit) throw new Error("PRIVATE_SECRET audit SQL failure");
        state.audits++;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected pg contract: ${sql}`);
    }
  }
  const nodeRequire = createRequire(pathToFileURL(file));
  const source = readFileSync(file, "utf8").split("\nif (process.argv[1]")[0].replaceAll("import.meta.url", JSON.stringify(pathToFileURL(file).href));
  const output = ts.transpileModule(source, { fileName: file.replace(/\.mts$/u, ".ts"), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier: string) => specifier === "pg" ? { Client: FakePgClient } : nodeRequire(specifier), loaded, loaded.exports);
  const tool = loaded.exports as { reconcileSelectedMigrationRegistry(options: SelectedCliRegistryOptions): Promise<SelectedCliRegistryReport> };
  const isolated: SelectedCliRegistryOptions = {
    confirmation: "selected-cli-migration-registry", connectionString: "postgresql://fixture@127.0.0.1:55445/registry_fixture",
    expectedDatabase: "registry_fixture", versions: phase.slice(0, 2).map((migration) => migration.version), receipt, cliBinary: binary, apply: true,
  };
  const remote: SelectedCliRegistryOptions = {
    ...isolated, connectionString: "postgresql://postgres.abcdefghijklmnopqrst:PRIVATE_SECRET@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    expectedDatabase: "postgres", production: { confirmation: "production-selected-cli-migration-registry", projectRef: "abcdefghijklmnopqrst", expectedHost: "aws-1-eu-central-1.pooler.supabase.com" },
  };
  const blocked = async (options = isolated, beforeConnection = false) => {
    const before = structuredClone(state.rows);
    let failure: unknown;
    try { await tool.reconcileSelectedMigrationRegistry(options); } catch (error) { failure = error; }
    check(failure instanceof Error, "Unsafe input must fail.");
    check(!String(failure).includes("PRIVATE_SECRET") && !JSON.stringify(failure).includes("private SQL"), "Errors must not expose transport or data values.");
    assert.deepEqual(state.rows, before); checks++;
    check(state.audits === 0 && !state.queries.some((query) => query.sql === "commit"), "A failure cannot commit or leave an audit event.");
    if (beforeConnection) check(state.connections === 0, "Preflight failures cannot connect.");
  };
  try {
    reset();
    const before = structuredClone(state.rows);
    const dry = await tool.reconcileSelectedMigrationRegistry({ ...isolated, apply: false });
    check(dry.status === "dry_run" && dry.wouldUpdate === 2 && dry.updated === 0, "Dry-run reports only selected noncanonical entries.");
    assert.deepEqual(state.rows, before); checks++;
    check(state.updates === 0 && state.audits === 0, "Dry-run has no writes or audit.");
    const first = await tool.reconcileSelectedMigrationRegistry(isolated);
    check(first.updated === 2 && first.untouched === 2 && first.historicalRows === 1, "Apply updates exactly the selected two entries.");
    assert.deepEqual(state.rows[0], before[0]); checks++;
    assert.deepEqual(state.rows[3], before[3]); checks++;
    for (const row of state.rows.slice(1, 3)) {
      check(row.statements.length === 1 && row.statements[0] === phase.find((migration) => migration.version === row.version)!.sql, "Selected registry SQL is exact canonical LF source.");
      check(row.created_by === "fixture CLI" && row.inserted_at === "fixed" && row.custom === "retain every metadata field", "Selected metadata remains untouched.");
    }
    check(state.audits === 1, "One sanitized audit is emitted per changing transaction.");
    const retry = await tool.reconcileSelectedMigrationRegistry(isolated);
    check(retry.status === "already_canonical" && retry.updated === 0 && state.audits === 1, "Retry is idempotent without a duplicate audit.");
    state.registryReads = 0;
    const final = await tool.reconcileSelectedMigrationRegistry({ ...isolated, versions: [phase[2].version] });
    check(final.updated === 1 && final.untouched === 3 && state.audits === 2, "The later phase changes only its selected entry.");

    reset(); state.rows.pop();
    check((await tool.reconcileSelectedMigrationRegistry(isolated)).updated === 2, "The receipt permits the unapplied, unselected ENFORCE entry to be absent.");
    reset(); state.rows.pop(); await blocked({ ...isolated, versions: [phase[2].version] });
    reset(); state.rows[1].name += "_wrong"; await blocked();
    reset(); state.rows[1].statements[1] = "BEGIN"; await blocked();
    reset(); state.rows[1].statements[1] += ";"; await blocked();
    reset(); state.rows[3].statements[1] += " "; await blocked();
    reset(); state.rows[0].statements[0] += "\n"; await blocked();
    reset(); state.rows.push({ ...historicalRow, version: "19990101000000" }); await blocked();
    reset(); state.rows[0].version = "20260717063702"; await blocked();
    reset(); state.zeroUpdate = true; await blocked();
    reset(); state.failAudit = true; await blocked();
    reset(); state.afterUpdate = (rows) => { rows[0].custom = "changed by unexpected trigger"; }; await blocked();
    reset(); state.afterUpdate = (rows) => { rows[1].created_by = "changed selected metadata"; }; await blocked();
    reset(); state.identity = "wrong_database"; await blocked();
    reset(); state.failConnect = true; await blocked();
    reset(); state.failEnd = true;
    check((await tool.reconcileSelectedMigrationRegistry({ ...isolated, apply: false })).updated === 0, "Cleanup failures never leak transport errors.");
    reset(); state.failCommitAfter = true;
    let uncertain: unknown;
    try { await tool.reconcileSelectedMigrationRegistry(isolated); } catch (error) { uncertain = error; }
    check(uncertain instanceof Error && String(uncertain).includes("(commit)"), "A lost COMMIT response cannot claim confirmed success.");
    check(!String(uncertain).includes("PRIVATE_SECRET"), "Uncertain commit errors remain sanitized.");
    check(state.rows[1].statements[0] === phase[0].sql && state.audits === 1, "A rollback attempt cannot pretend to undo an already committed transaction.");
    state.failCommitAfter = false;
    check((await tool.reconcileSelectedMigrationRegistry(isolated)).status === "already_canonical", "Exact registry verification makes an uncertain-commit retry safe.");

    const invalidReceipts: SelectedCliRegistryReceipt[] = [
      { ...receipt, kind: "unknown" as SelectedCliRegistryReceipt["kind"] },
      { ...receipt, formatVersion: 2 as 1 },
      { ...receipt, cli: { ...receipt.cli, binarySha256: "0".repeat(64) } },
      { ...receipt, baseline: { ...receipt.baseline, sha256: "not-a-hash" } },
      { ...receipt, migrations: [...receipt.migrations, receipt.migrations[0]] },
      { ...receipt, migrations: receipt.migrations.map((migration, index) => index ? migration : { ...migration, sourceSha256: "0".repeat(64) }) },
      { ...receipt, migrations: receipt.migrations.map((migration, index) => index ? migration : { ...migration, statements: [] }) },
    ];
    for (const invalidReceipt of invalidReceipts) { reset(); await blocked({ ...isolated, receipt: invalidReceipt }, true); }
    for (const versions of [[], [phase[0].version, phase[0].version], ["19990101000000"]]) { reset(); await blocked({ ...isolated, versions }, true); }
    reset(); await blocked({ ...isolated, confirmation: "wrong" as SelectedCliRegistryOptions["confirmation"] }, true);
    reset(); await blocked({ ...isolated, connectionString: "invalid PRIVATE_SECRET" }, true);
    reset(); await blocked({ ...remote, production: undefined }, true);
    reset(); await blocked({ ...isolated, expectedDatabase: "other" }, true);
    reset(); await blocked({ ...isolated, connectionString: `${isolated.connectionString}?sslmode=no-verify` }, true);
    const invalidRemote: SelectedCliRegistryOptions[] = [
      { ...remote, production: { ...remote.production!, confirmation: "wrong" as "production-selected-cli-migration-registry" } },
      { ...remote, production: { ...remote.production!, projectRef: "zyxwvutsrqponmlkjihg" } },
      { ...remote, production: { ...remote.production!, expectedHost: "db.evil.example" } },
      { ...remote, connectionString: remote.connectionString.replace(":5432/", ":6543/") },
      { ...remote, connectionString: remote.connectionString.replace(":PRIVATE_SECRET@", "@") },
      { ...remote, connectionString: `${remote.connectionString}?sslmode=no-verify` },
      { ...remote, connectionString: `${remote.connectionString}#PRIVATE_SECRET` },
    ];
    for (const options of invalidRemote) { reset(); await blocked(options, true); }
    reset();
    check((await tool.reconcileSelectedMigrationRegistry(remote)).updated === 2, "Bound production target follows the same selected-only logic through the fake port.");
    assert.deepEqual(state.options?.ssl, { rejectUnauthorized: true }); checks++;
    check(state.options?.connectionTimeoutMillis === 15_000 && state.options?.statement_timeout === 30_000, "Connection and statement waits are bounded.");
    reset(); await tool.reconcileSelectedMigrationRegistry({ ...remote, production: { ...remote.production!, sslCaFile: caFile } });
    assert.deepEqual(state.options?.ssl, { rejectUnauthorized: true, ca: "fixture verified CA" }); checks++;

    for (const args of [["--selected-cl", "--apply"], ["--versions", phase[0].version, "--apply"], ["--selected-cli", "--unknown"], ["--selected-cli", "--apply", "--apply"]]) {
      const result = spawnSync(process.execPath, ["--experimental-strip-types", file, ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, SUPABASE_DB_URL: "postgresql://PRIVATE_SECRET@127.0.0.1:1/do_not_connect" } });
      check(result.status === 1 && result.stderr.includes('"status":"blocked"'), "Malformed scoped CLI arguments cannot invoke the broad owner.");
      check(!result.stderr.includes("PRIVATE_SECRET") && !result.stdout.includes("PRIVATE_SECRET"), "CLI failures contain no credentials.");
    }
    const imported = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", `await import(${JSON.stringify(pathToFileURL(file).href)}); process.stdout.write('imported-without-connection');`], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, SUPABASE_DB_URL: "postgresql://PRIVATE_SECRET@127.0.0.1:1/do_not_connect" },
    });
    check(imported.status === 0 && imported.stdout === "imported-without-connection", "Importing the owner must not execute either reconciliation mode or connect.");
    return { checks, actualRegistryOwner: true, pgTransport: "transactional fixture", liveDatabase: false };
  } finally {
    unlinkSync(binary); unlinkSync(caFile); rmdirSync(dir);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifySelectedMigrationRegistry()));
}
