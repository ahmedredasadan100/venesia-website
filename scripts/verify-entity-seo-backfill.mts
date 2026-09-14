import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import type { EntitySeoBackfillOptions, EntitySeoBackfillReceipt, EntitySeoBackfillReport } from "./backfill-entity-seo-scores.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { TopicSeoSource, ProjectSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";

type Row = Record<string, unknown> & ProjectSeoSource & Partial<TopicSeoSource> & { id: number };
type Entity = "topics" | "projects";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = loadEntitySeoPersistenceOwner();

/** Execute the actual tooling with a pg transport port; never open a socket. */
export async function verifyEntitySeoBackfill() {
  let checks = 0;
  const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
  let state!: {
    tables: Record<Entity, Row[]>; queries: Array<{ sql: string; params: unknown[] }>;
    connections: number; updates: number; options?: Record<string, unknown>;
    beforeUpdate?: (entity: Entity, row: Row) => void;
    beforeRead?: (entity: Entity) => void;
    connectFailure?: boolean; updateFailure?: boolean; endFailure?: boolean;
  };
  function reset() {
    state = {
      tables: {
        topics: [{ id: 1, content_type: "article", title: "Actual title", excerpt: "Actual summary", slug: "topic-one", content: "Actual authored body", faq: [], seo_keywords: [], seo_score: null, seo_score_version: null, seo_score_input_hash: null, updated_at: "unchanged-editorial-time" }],
        projects: [{ id: 2, arabic_name: "Actual project", general_description: "Summary", overview_body: "Body", slug: "project-two", seo_keywords: [], seo_score: null, seo_score_version: null, seo_score_input_hash: null, updated_at: "unchanged-editorial-time" }],
      }, queries: [], connections: 0, updates: 0,
    };
  }
  const input = (entity: Entity, row: Row) => entity === "topics"
    ? owner.toTopicSeoScoreInput({ ...row, content_type: row.content_type ?? "" })
    : owner.toProjectSeoScoreInput(row);
  class FakePgClient {
    constructor(options: Record<string, unknown>) { state.options = options; }
    async connect() { state.connections++; if (state.connectFailure) throw new Error("password=PRIVATE_SECRET actual title PRIVATE_PERSON"); }
    async end() { if (state.endFailure) throw new Error("PRIVATE_SECRET in connection cleanup"); }
    async query(sql: string, params: unknown[] = []) {
      state.queries.push({ sql, params });
      if (sql.startsWith("select current_database()")) return { rows: [{ database: state.options?.application_name === "production-entity-seo-backfill" ? "postgres" : "entity_seo_test", role: "postgres" }] };
      const match = sql.match(/(?:from|update) public\.(topics|projects)/u);
      assert.ok(match, `Unexpected query contract: ${sql}`);
      const entity = match[1] as Entity;
      const rows = state.tables[entity];
      if (sql.startsWith("select count(*)")) return { rows: [{ targeted: String(rows.length), upper_id: String(Math.max(0, ...rows.map((row) => row.id))), lower_id: String(rows.length ? Math.min(...rows.map((row) => row.id)) : 1) }] };
      if (sql.startsWith("select ")) {
        state.beforeRead?.(entity);
        return { rows: structuredClone(rows.filter((row) => BigInt(row.id) > BigInt(String(params[0])) && BigInt(row.id) <= BigInt(String(params[2])))
          .sort((a, b) => a.id - b.id).slice(0, Number(params[1]))) };
      }
      const row = rows.find((item) => item.id === params[3]);
      if (!row) return { rows: [], rowCount: 0 };
      state.beforeUpdate?.(entity, row);
      if (state.updateFailure) throw new Error("PRIVATE_SECRET and PRIVATE_PERSON in remote SQL error");
      // Model the existing CAS predicate, not the PostgreSQL trigger. Native
      // trigger/projection proof belongs to the separate cutover rehearsal.
      if (owner.entitySeoInputHash(input(entity, row)) !== params[2]) return { rows: [], rowCount: 0 };
      Object.assign(row, { seo_score: params[0], seo_score_version: params[1], seo_score_input_hash: params[2] });
      state.updates++;
      return { rows: [{ id: row.id }], rowCount: 1 };
    }
  }
  const file = resolve(ROOT, "scripts/backfill-entity-seo-scores.mts");
  const nodeRequire = createRequire(pathToFileURL(file));
  const source = readFileSync(file, "utf8").split("\nif (process.argv[1]")[0]
    .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(file).href));
  const output = ts.transpileModule(source, { fileName: file.replace(/\.mts$/u, ".ts"), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier: string) => specifier === "pg" ? { Client: FakePgClient } : nodeRequire(specifier), loaded, loaded.exports);
  const tool = loaded.exports as {
    runEntitySeoBackfill(options: EntitySeoBackfillOptions): Promise<EntitySeoBackfillReport>;
    assertProductionSeoBackfillTarget(options: EntitySeoBackfillOptions): string;
  };
  const isolated = { connectionString: "postgresql://fixture@127.0.0.1:55445/entity_seo_test", expectedDatabase: "entity_seo_test", batchSize: 1 };
  const production: EntitySeoBackfillOptions = {
    connectionString: "postgresql://postgres.abcdefghijklmnopqrst:PRIVATE_SECRET@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    expectedDatabase: "postgres", batchSize: 1,
    production: { confirmation: "production-entity-seo-backfill", projectRef: "abcdefghijklmnopqrst", expectedHost: "aws-1-eu-central-1.pooler.supabase.com", maxRows: 10 },
  };
  async function blocked(options: EntitySeoBackfillOptions) {
    let failure: unknown;
    try { await tool.runEntitySeoBackfill(options); } catch (error) { failure = error; }
    check(failure instanceof Error, "A blocked operation must fail.");
    const printable = JSON.stringify(failure) + String(failure);
    check(!printable.includes("PRIVATE_SECRET") && !printable.includes("PRIVATE_PERSON"), "Backfill errors never expose credentials or source text.");
    return (failure as Error & { report?: EntitySeoBackfillReport }).report;
  }

  reset();
  const dry = await tool.runEntitySeoBackfill(isolated);
  check(dry.counts.targeted === 2 && dry.counts.calculated === 2 && dry.counts.unresolved === 2 && state.updates === 0, "Dry-run reports pending tuples without writes.");
  check(dry.complete && !dry.readyForEnforcement, "A successful dry-run cannot authorize enforcement.");
  const originalFields = structuredClone(state.tables);
  const applied = await tool.runEntitySeoBackfill({ ...isolated, apply: true });
  check(applied.counts.written === 2 && applied.counts.unresolved === 0 && !applied.readyForEnforcement, "Apply resolves tuples but still requires independent verify.");
  const verified = await tool.runEntitySeoBackfill({ ...isolated, verify: true });
  check(verified.readyForEnforcement && verified.counts.calculated === 2 && verified.counts.written === 0, "Verify recalculates every row and never writes.");
  const again = await tool.runEntitySeoBackfill({ ...isolated, apply: true });
  check(again.counts.calculated === 0 && again.counts.written === 0 && again.counts.unchanged === 2, "Rerun reuses unchanged proofs without recalculation or writes.");
  for (const entity of ["topics", "projects"] as const) {
    for (const [key, value] of Object.entries(originalFields[entity][0])) {
      if (!owner.PERSISTED_ENTITY_SEO_FIELDS.includes(key)) check(state.tables[entity][0][key] === value || JSON.stringify(state.tables[entity][0][key]) === JSON.stringify(value), "Backfill preserves original fields and editorial timestamps.");
    }
  }
  check(state.queries.filter((query) => query.sql.includes("where id >")).every((query) => query.params[1] === 1 && query.sql.includes("id <= $3")), "Reads use bounded keyset pages.");
  state.tables.topics[0].seo_score = (Number(state.tables.topics[0].seo_score) + 1) % 101;
  const forged = await blocked({ ...isolated, verify: true });
  check(forged?.counts.unresolved === 1 && !forged.readyForEnforcement, "Independent verify detects a wrong score with an otherwise matching hash.");

  reset();
  state.beforeUpdate = (entity, row) => { if (entity === "topics") { row.title = "Concurrent edit"; state.beforeUpdate = undefined; } };
  const conflict = await blocked({ ...isolated, apply: true });
  check(conflict?.counts.conflicted === 1 && conflict.counts.unresolved === 1 && conflict.counts.written === 1, "CAS conflicts are counted and partial progress remains resumable.");
  const resumed = await tool.runEntitySeoBackfill({ ...isolated, apply: true });
  check(resumed.counts.written === 1 && resumed.counts.unchanged === 1, "Resume recalculates the conflicted snapshot and preserves completed rows.");
  reset();
  state.tables.topics[0].faq = [{ question: "PRIVATE_PERSON" }];
  const invalid = await blocked(isolated);
  check(invalid?.counts.failed === 1 && invalid.counts.unresolved === 2 && state.updates === 0, "Malformed canonical inputs fail dry-run without leaking source data.");
  reset(); state.connectFailure = true;
  const disconnected = await blocked(isolated);
  check(disconnected?.counts.failed === 1 && !disconnected.readyForEnforcement, "Connection failures produce sanitized blocking counts.");
  reset(); state.updateFailure = true;
  const sqlFailure = await blocked({ ...isolated, apply: true });
  check(sqlFailure?.counts.failed === 2 && sqlFailure.counts.unresolved === 2, "SQL failures expose only counts and cannot authorize enforcement.");
  reset(); state.endFailure = true;
  const closeFailure = await blocked({ ...isolated, apply: true });
  check(closeFailure?.counts.written === 2 && closeFailure.counts.failed === 1 && !closeFailure.readyForEnforcement,
    "Connection cleanup failure retains completed write counts and blocks enforcement without leaking its error.");

  reset();
  for (const connectionString of [
    `${isolated.connectionString}?host=remote.example`,
    `${isolated.connectionString}?port=5432`,
    `${isolated.connectionString}#PRIVATE_SECRET`,
    isolated.connectionString.replace("postgresql:", "https:"),
  ]) {
    await blocked({ ...isolated, connectionString });
    check(state.connections === 0 && state.updates === 0, "Isolated target overrides and invalid protocols fail before any connection or write.");
  }
  reset();
  await blocked({ ...production, production: undefined });
  check(state.connections === 0, "Remote remains prohibited without explicit Production opt-in.");
  for (const mutation of [
    { connectionString: production.connectionString.replace("/postgres", "/other") },
    { connectionString: production.connectionString.replace("5432", "6543") },
    { connectionString: `${production.connectionString}?sslmode=disable` },
    { production: { ...production.production!, projectRef: "zyxwvutsrqponmlkjihg" } },
    { production: { ...production.production!, expectedHost: "db.abcdefghijklmnopqrst.supabase.co" } },
    { production: { ...production.production!, confirmation: "" as "production-entity-seo-backfill" } },
  ]) {
    await blocked({ ...production, ...mutation });
    check(state.connections === 0, "Mismatched target/confirmation/TLS is rejected before opening a connection.");
  }
  const direct = { ...production, connectionString: "postgresql://postgres:PRIVATE_SECRET@db.abcdefghijklmnopqrst.supabase.co:5432/postgres", production: { ...production.production!, expectedHost: "db.abcdefghijklmnopqrst.supabase.co" } };
  check(tool.assertProductionSeoBackfillTarget(direct).length === 64, "An exact direct Supabase endpoint is supported.");
  await blocked({ ...production, apply: true });
  check(state.connections === 0, "Production apply requires dry-run before any connection/write.");

  const plan = await tool.runEntitySeoBackfill(production);
  const receipt = plan.dryRunReceipt as EntitySeoBackfillReceipt;
  check(receipt?.kind === "entity-seo-production-dry-run" && plan.counts.unresolved === 2 && state.updates === 0, "Production dry-run issues a bounded receipt and performs no writes.");
  check((state.options?.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized === true, "Production TLS certificate verification remains enabled.");
  check(!JSON.stringify(receipt).includes("PRIVATE_SECRET") && !JSON.stringify(receipt).includes("Actual title"), "Receipt contains identity hashes and population bounds, no credentials/source text.");
  for (const patch of [{ sourceFingerprint: "changed" }, { targetFingerprint: "changed" }, { scoreVersion: 999 }, { maxRows: 11 }, { failed: 1 }, { conflicted: 1 }]) {
    const previousConnections = state.connections;
    await blocked({ ...production, apply: true, production: { ...production.production!, dryRunReceipt: { ...receipt, ...patch } } });
    check(state.connections === previousConnections && state.updates === 0, "A changed or failed dry-run receipt cannot authorize apply.");
  }
  state.tables.topics.push({ ...structuredClone(state.tables.topics[0]), id: 3 });
  await blocked({ ...production, apply: true, production: { ...production.production!, dryRunReceipt: receipt } });
  check(state.updates === 0, "A changed bounded population requires a fresh dry-run receipt before writes.");
  reset();
  const fresh = (await tool.runEntitySeoBackfill(production)).dryRunReceipt!;
  state.tables.topics[0].faq = [{ question: "PRIVATE_PERSON" }];
  const preflight = await blocked({ ...production, apply: true, production: { ...production.production!, dryRunReceipt: fresh } });
  check(preflight?.counts.failed === 1 && state.updates === 0, "Production apply repeats full read-only validation and stops before all writes on malformed input.");
  reset();
  const validPlan = (await tool.runEntitySeoBackfill(production)).dryRunReceipt!;
  const prodApply = await tool.runEntitySeoBackfill({ ...production, apply: true, production: { ...production.production!, dryRunReceipt: validPlan } });
  check(prodApply.counts.written === 2 && prodApply.counts.failed === 0 && !prodApply.readyForEnforcement, "Production apply executes the same CAS engine and retains the verify gate.");
  check(prodApply.preflight?.calculated === 2 && prodApply.counts.calculated === 2, "Preflight calculations are reported separately from apply, never hidden.");
  const prodResume = await tool.runEntitySeoBackfill({ ...production, apply: true, production: { ...production.production!, dryRunReceipt: validPlan } });
  check(prodResume.counts.written === 0 && prodResume.counts.calculated === 0, "A matching receipt can resume idempotently.");
  check((await tool.runEntitySeoBackfill({ ...production, verify: true })).readyForEnforcement, "Independent Production verify succeeds through the same read-only engine.");
  reset();
  const bound = await blocked({ ...production, production: { ...production.production!, maxRows: 1 } });
  check(bound?.counts.failed === 1 && state.updates === 0, "Explicit Production maximum prevents a broader population.");
  reset();
  state.beforeRead = (entity) => { if (entity === "topics") { state.tables.topics.push({ ...structuredClone(state.tables.topics[0]), id: 4 }); state.beforeRead = undefined; } };
  const inserted = await blocked(isolated);
  check(Boolean(inserted?.counts.conflicted) && !inserted?.readyForEnforcement, "Rows created after the bounded snapshot are detected before declaring completeness.");
  const certificateDirectory = mkdtempSync(resolve(tmpdir(), "entity-seo-backfill-ca-"));
  const certificateFile = resolve(certificateDirectory, "fixture-ca.pem");
  try {
    reset();
    writeFileSync(certificateFile, "-----BEGIN CERTIFICATE-----\nfixture-trust-root-one\n-----END CERTIFICATE-----\n");
    const withCa = { ...production, production: { ...production.production!, sslCaFile: certificateFile } };
    const caPlan = (await tool.runEntitySeoBackfill(withCa)).dryRunReceipt!;
    check((state.options?.ssl as { ca?: string }).ca?.includes("fixture-trust-root-one"), "The explicitly supplied CA reaches pg; the fake transport does not claim TLS validation.");
    check((state.options?.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized === true, "Custom CA never disables certificate verification.");
    writeFileSync(certificateFile, "-----BEGIN CERTIFICATE-----\nfixture-trust-root-two\n-----END CERTIFICATE-----\n");
    const connections = state.connections;
    await blocked({ ...withCa, apply: true, production: { ...withCa.production, dryRunReceipt: caPlan } });
    check(state.connections === connections && state.updates === 0, "Changing the trust root invalidates the prior receipt before connecting.");
  } finally {
    unlinkSync(certificateFile);
    rmdirSync(certificateDirectory);
  }
  const cliFailure = spawnSync(process.execPath, ["--experimental-strip-types", file, "--production", "--database", "postgres", "--verify", "--confirm", "production-entity-seo-backfill", "--project-ref", "abcdefghijklmnopqrst"], {
    encoding: "utf8", env: { ...process.env, ENTITY_SEO_BACKFILL_DATABASE_URL: "invalid-url-PRIVATE_SECRET" },
  });
  check(cliFailure.status === 1, "CLI invalid identity exits unsuccessfully before a database connection.");
  check(!`${cliFailure.stdout}${cliFailure.stderr}`.includes("PRIVATE_SECRET"), "CLI failures do not print a supplied secret.");
  // Node diagnostics can arrive after the report on stderr. Require exactly
  // one structured report instead of depending on warning delivery order.
  const cliReports = cliFailure.stderr.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.startsWith("{"));
  check(cliReports.length === 1, "CLI failure emits exactly one structured report alongside any Node diagnostics.");
  const cliCounts = JSON.parse(cliReports[0]) as { counts: Record<string, number>; readyForEnforcement: boolean };
  check(["targeted", "calculated", "written", "unchanged", "conflicted", "failed", "unresolved"].every((field) => typeof cliCounts.counts[field] === "number") && !cliCounts.readyForEnforcement,
    "Even pre-connection CLI failures report every required count and block enforcement.");
  console.log(`Entity SEO backfill verified (${checks} assertions; actual shared owner and tooling, isolated pg transport only).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyEntitySeoBackfill();
