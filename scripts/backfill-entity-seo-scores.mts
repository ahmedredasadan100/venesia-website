import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
// @ts-expect-error This workspace uses pg without separate declarations.
import pg from "pg";
import type { SeoScoreInput } from "../src/lib/admin/seo-score.ts";
import type { PersistedEntitySeoScore, PersistedEntitySeoScoreSource } from "../src/lib/seo/entity-seo-types.ts";
import type { TopicSeoSource, ProjectSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";
import { ADMIN_ENTITY_SEO_ADOPTION_MANIFEST, type AdminEntitySeoAdoptionEntry } from "../src/lib/admin/seo/entity-seo-adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

/** Execute the actual server-only owner in this controlled Node data artifact. */
export function loadEntitySeoPersistenceOwner() {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(file, loaded);
    const output = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function("require", "module", "exports", output)((specifier: string) => {
      if (specifier === "server-only") return {};
      if (!specifier.startsWith(".")) return nodeRequire(specifier);
      const base = resolve(dirname(file), specifier);
      const target = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")].find(existsSync);
      assert.ok(target, `Unresolved owner dependency: ${specifier}`);
      return load(target);
    }, loaded, loaded.exports);
    return loaded.exports;
  }
  const owner = load(resolve(ROOT, "src/lib/admin/seo/entity-seo-persistence.ts"));
  const sourceFiles = [...cache.keys(), fileURLToPath(import.meta.url),
    resolve(ROOT, "src/lib/admin/seo/entity-seo-adoption-manifest.ts")].sort();
  const sourceFingerprint = createHash("sha256").update(JSON.stringify(sourceFiles.map((file) => [
    relative(ROOT, file).replaceAll("\\", "/"), createHash("sha256").update(readFileSync(file)).digest("hex"),
  ]))).digest("hex");
  return { ...owner, sourceFingerprint } as unknown as {
    sourceFingerprint: string;
    ENTITY_SEO_SCORE_VERSION: number;
    TOPIC_SEO_SOURCE_COLUMNS: readonly string[];
    PROJECT_SEO_SOURCE_COLUMNS: readonly string[];
    PERSISTED_ENTITY_SEO_FIELDS: readonly string[];
    toTopicSeoScoreInput(row: TopicSeoSource): SeoScoreInput;
    toProjectSeoScoreInput(row: ProjectSeoSource): SeoScoreInput;
    deriveEntitySeoScore(input: SeoScoreInput, previous?: PersistedEntitySeoScoreSource): PersistedEntitySeoScore;
    entitySeoInputHash(input: SeoScoreInput): string;
  };
}

export function assertIsolatedSeoBackfillTarget(connectionString: string, expectedDatabase: string) {
  let target: URL;
  try { target = new URL(connectionString); }
  catch { throw new Error("A valid explicit isolated PostgreSQL URL is required."); }
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "A PostgreSQL URL is required.");
  assert.ok(target.search === "", "Isolated connection options must not override the explicit target.");
  assert.ok(target.hash === "", "Isolated connection fragments are not allowed.");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Remote backfill targets are prohibited by this execution artifact.");
  assert.match(expectedDatabase, /^[a-z][a-z0-9_]*$/u, "An explicit isolated database name is required.");
  assert.equal(decodeURIComponent(target.pathname.slice(1)), expectedDatabase, "Database identity mismatch.");
}

type Entity = "topics" | "projects";
type Scope = { entity: Entity; upperId: string; targeted: number };
export type EntitySeoBackfillCounts = {
  entity: Entity;
  targeted: number;
  calculated: number;
  written: number;
  unchanged: number;
  conflicted: number;
  failed: number;
  unresolved: number;
  // Retained for existing isolated callers and evidence consumers.
  scanned: number;
  recalculated: number;
};
export type EntitySeoBackfillReceipt = {
  kind: "entity-seo-production-dry-run";
  targetFingerprint: string;
  sourceFingerprint: string;
  scoreVersion: number;
  maxRows: number;
  scopes: Scope[];
  failed: number;
  conflicted: number;
};
export type EntitySeoBackfillReport = {
  mode: "verify" | "apply" | "dry_run";
  database: string;
  entities: EntitySeoBackfillCounts[];
  excluded: Array<{ entity: string; reason: string | undefined }>;
  complete: boolean;
  readyForEnforcement: boolean;
  counts: { targeted: number; calculated: number; written: number; unchanged: number; conflicted: number; failed: number; unresolved: number };
  preflight?: EntitySeoBackfillReport["counts"];
  dryRunReceipt?: EntitySeoBackfillReceipt;
};
export class EntitySeoBackfillBlocked extends Error {
  readonly report: EntitySeoBackfillReport;
  constructor(report: EntitySeoBackfillReport) {
    super("Entity SEO backfill is incomplete; inspect counts and rerun after resolving the blocking condition.");
    this.report = report;
    this.name = "EntitySeoBackfillBlocked";
  }
}
export type EntitySeoProductionBackfill = {
  confirmation: "production-entity-seo-backfill";
  projectRef: string;
  expectedHost: string;
  maxRows: number;
  sslCaFile?: string;
  dryRunReceipt?: EntitySeoBackfillReceipt;
};
export type EntitySeoBackfillOptions = {
  connectionString: string;
  expectedDatabase: string;
  apply?: boolean;
  verify?: boolean;
  recalculate?: boolean;
  batchSize?: number;
  production?: EntitySeoProductionBackfill;
};

/** Explicit Production opt-in never changes the isolated target guard. */
export function assertProductionSeoBackfillTarget(options: EntitySeoBackfillOptions) {
  const production = options.production;
  assert.ok(production?.confirmation === "production-entity-seo-backfill", "Explicit Production confirmation is required.");
  assert.match(production.projectRef, /^[a-z]{20}$/u, "An exact Supabase project reference is required.");
  let target: URL;
  try { target = new URL(options.connectionString); }
  catch { throw new Error("A valid explicit Production PostgreSQL URL is required."); }
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "A PostgreSQL URL is required.");
  assert.equal(target.hostname, production.expectedHost, "Production host identity mismatch.");
  assert.equal(decodeURIComponent(target.pathname.slice(1)), options.expectedDatabase, "Production database identity mismatch.");
  assert.equal(options.expectedDatabase, "postgres", "Production must name the Supabase database explicitly.");
  assert.ok(!target.port || target.port === "5432", "Production requires a direct or session connection.");
  const username = decodeURIComponent(target.username);
  const direct = target.hostname === `db.${production.projectRef}.supabase.co` && username === "postgres";
  const session = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/u.test(target.hostname)
    && username === `postgres.${production.projectRef}`;
  assert.ok(direct || session, "Production endpoint does not identify the explicitly selected project.");
  assert.ok(target.password, "Explicit database credentials are required.");
  assert.ok(Number.isSafeInteger(production.maxRows) && production.maxRows > 0 && production.maxRows <= 1_000_000,
    "Production requires an explicit bounded row limit.");
  // pg connection-string SSL options can override the ssl object. Reject all
  // URL query options; the connection below owns certificate verification.
  assert.equal(target.search, "", "Production connection options must not override verified TLS.");
  assert.equal(target.hash, "", "Production connection fragments are not allowed.");
  return createHash("sha256").update(JSON.stringify([
    production.projectRef, target.hostname, target.port || "5432", username, options.expectedDatabase,
    production.sslCaFile ? createHash("sha256").update(readFileSync(production.sslCaFile)).digest("hex") : "system-ca",
  ])).digest("hex");
}

export function assertEntitySeoBackfillReceipt(
  receipt: EntitySeoBackfillReceipt | undefined,
  expected: { targetFingerprint: string; sourceFingerprint: string; scoreVersion: number; maxRows: number; scopes?: Scope[] },
) {
  assert.ok(receipt?.kind === "entity-seo-production-dry-run", "A successful Production dry-run receipt is required before apply.");
  assert.ok(receipt.targetFingerprint === expected.targetFingerprint, "Dry-run target identity mismatch.");
  assert.ok(receipt.sourceFingerprint === expected.sourceFingerprint, "Dry-run owner/tooling source changed.");
  assert.ok(receipt.scoreVersion === expected.scoreVersion, "Dry-run score version changed.");
  assert.ok(receipt.maxRows === expected.maxRows, "Dry-run row limit changed.");
  assert.ok(receipt.failed === 0, "Dry-run contains failed records.");
  assert.ok(receipt.conflicted === 0, "Dry-run contains conflicts.");
  assert.ok(Array.isArray(receipt.scopes) && receipt.scopes.length > 0, "Dry-run scope is missing.");
  if (expected.scopes) assert.ok(JSON.stringify(receipt.scopes) === JSON.stringify(expected.scopes), "Dry-run bounded population changed; obtain a fresh receipt.");
}

export async function runEntitySeoBackfill(options: EntitySeoBackfillOptions): Promise<EntitySeoBackfillReport> {
  const targetFingerprint = options.production
    ? assertProductionSeoBackfillTarget(options)
    : (assertIsolatedSeoBackfillTarget(options.connectionString, options.expectedDatabase), "");
  assert.ok(!(options.apply && options.verify), "Verification never writes.");
  const batchSize = options.batchSize ?? 100;
  assert.ok(Number.isInteger(batchSize) && batchSize > 0 && batchSize <= 1000);
  const owner = loadEntitySeoPersistenceOwner();
  const receiptIdentity = {
    targetFingerprint, sourceFingerprint: owner.sourceFingerprint,
    scoreVersion: owner.ENTITY_SEO_SCORE_VERSION, maxRows: options.production?.maxRows ?? 0,
  };
  if (options.production && options.apply) assertEntitySeoBackfillReceipt(options.production.dryRunReceipt, receiptIdentity);
  const inventory: readonly AdminEntitySeoAdoptionEntry[] = ADMIN_ENTITY_SEO_ADOPTION_MANIFEST;
  const adoptedTables = [...new Set(inventory.flatMap((entry) =>
    entry.persistedScore?.status === "adopted" && entry.persistedScore.table ? [entry.persistedScore.table] : []))];
  const client = new pg.Client({
    connectionString: options.connectionString,
    application_name: options.production ? "production-entity-seo-backfill" : "isolated-entity-seo-backfill",
    ...(options.production ? { ssl: { rejectUnauthorized: true,
      ...(options.production.sslCaFile ? { ca: readFileSync(options.production.sslCaFile, "utf8") } : {}),
    }, connectionTimeoutMillis: 15_000, statement_timeout: 30_000 } : {}),
  });
  const report: EntitySeoBackfillReport = {
    mode: options.verify ? "verify" : options.apply ? "apply" : "dry_run",
    database: options.expectedDatabase,
    entities: [],
    excluded: inventory.flatMap((entry) => entry.persistedScore?.status === "gap"
      ? [{ entity: entry.id, reason: entry.persistedScore.reason }] : []),
    complete: false,
    readyForEnforcement: false,
    counts: { targeted: 0, calculated: 0, written: 0, unchanged: 0, conflicted: 0, failed: 0, unresolved: 0 },
  };
  const summarize = () => {
    for (const field of Object.keys(report.counts) as Array<keyof EntitySeoBackfillReport["counts"]>) {
      report.counts[field] = report.entities.reduce((sum, counts) => sum + counts[field], 0);
    }
  };
  try {
    await client.connect();
    const identity = await client.query("select current_database() as database, current_user as role");
    assert.equal(identity.rows[0].database, options.expectedDatabase);
    if (options.production) assert.equal(identity.rows[0].role, "postgres", "Production database role mismatch.");
    const scopes: Scope[] = [];
    for (const entity of adoptedTables) {
      const population = await client.query(`select count(*)::text as targeted, coalesce(max(id),0)::text as upper_id, coalesce(min(id),1)::text as lower_id from public.${entity}`);
      const targeted = Number(population.rows[0].targeted);
      const upperId = String(population.rows[0].upper_id);
      assert.ok(Number.isSafeInteger(targeted) && targeted >= 0 && BigInt(population.rows[0].lower_id) > BigInt(0),
        "Backfill population cannot be represented safely.");
      scopes.push({ entity, targeted, upperId });
    }
    if (options.production) {
      assert.ok(scopes.reduce((sum, scope) => sum + scope.targeted, 0) <= options.production.maxRows,
        "Production population exceeds the explicitly authorized row limit.");
      if (options.apply) assertEntitySeoBackfillReceipt(options.production.dryRunReceipt, { ...receiptIdentity, scopes });
    }

    async function scan(write: boolean, verify: boolean) {
      const entities: EntitySeoBackfillCounts[] = [];
      report.entities = entities;
      for (const { entity, targeted, upperId } of scopes) {
      const columns = entity === "topics" ? owner.TOPIC_SEO_SOURCE_COLUMNS : owner.PROJECT_SEO_SOURCE_COLUMNS;
      const projection = ["id", ...columns, ...owner.PERSISTED_ENTITY_SEO_FIELDS].map((column) => `"${column}"`).join(",");
      const counts: EntitySeoBackfillCounts = { entity, targeted, calculated: 0, written: 0, unchanged: 0,
        conflicted: 0, failed: 0, unresolved: 0, scanned: 0, recalculated: 0 };
      entities.push(counts);
      let afterId = "0";
      while (true) {
        // The table/projection come only from the closed adoption contract above.
        const batch = await client.query(`select ${projection} from public.${entity} where id > $1 and id <= $3 order by id limit $2`, [afterId, batchSize, upperId]);
        if (!batch.rows.length) break;
        for (const row of batch.rows) {
          counts.scanned++;
          try {
            const input = entity === "topics" ? owner.toTopicSeoScoreInput(row) : owner.toProjectSeoScoreInput(row);
            const derived = owner.deriveEntitySeoScore(input, verify || options.recalculate ? undefined : row);
            const unchanged = owner.PERSISTED_ENTITY_SEO_FIELDS.every((field) => row[field] === derived[field as keyof PersistedEntitySeoScore]);
            if (verify || options.recalculate || !unchanged) counts.calculated++;
            if (unchanged) counts.unchanged++;
            else if (verify) counts.unresolved++;
            else if (write) {
              // A concurrent SEO edit cannot receive a score from this snapshot.
              // Updating only the derived tuple preserves editorial timestamps.
              const written = await client.query(
                `update public.${entity} entity set seo_score=$1, seo_score_version=$2, seo_score_input_hash=$3
                 where id=$4 and public.entity_seo_score_input_hash($5, to_jsonb(entity))=$3 returning id`,
                [derived.seo_score, derived.seo_score_version, derived.seo_score_input_hash, row.id, entity],
              );
              if (written.rowCount === 1) counts.written++;
              else { counts.conflicted++; counts.unresolved++; }
            }
            else counts.unresolved++;
          } catch {
            counts.failed++;
            counts.unresolved++;
          }
          afterId = String(row.id);
        }
      }
      counts.recalculated = counts.calculated;
      const finalPopulation = await client.query(`select count(*)::text as targeted, coalesce(max(id),0)::text as upper_id, coalesce(min(id),1)::text as lower_id from public.${entity}`);
      if (counts.scanned !== targeted || Number(finalPopulation.rows[0].targeted) !== targeted
        || String(finalPopulation.rows[0].upper_id) !== upperId) {
        const difference = Math.max(1, Math.abs(targeted - counts.scanned), Math.abs(Number(finalPopulation.rows[0].targeted) - targeted));
        counts.conflicted += difference;
        counts.unresolved += difference;
      }
      }
      return entities;
    }

    // Production apply repeats a full read-only validation immediately before
    // its first write. The retained receipt alone never authorizes stale inputs.
    if (options.production && options.apply) {
      report.entities = await scan(false, false);
      summarize();
      report.preflight = { ...report.counts };
      if (report.entities.some((counts) => counts.failed || counts.conflicted)) throw new EntitySeoBackfillBlocked(report);
    }
    report.entities = await scan(Boolean(options.apply), Boolean(options.verify));
    summarize();
    const hasFailure = report.entities.some((counts) => counts.failed || counts.conflicted);
    const hasUnresolved = report.entities.some((counts) => counts.unresolved);
    report.complete = !hasFailure && (!(options.apply || options.verify) || !hasUnresolved);
    // Only a fresh, independently recalculated verify satisfies this tool's
    // enforcement prerequisite. The ENFORCE migration must still atomically
    // recheck current rows; online verification cannot freeze later writers.
    report.readyForEnforcement = Boolean(options.verify) && report.complete;
    if (!report.complete) throw new EntitySeoBackfillBlocked(report);
    if (options.production && !options.apply && !options.verify) {
      report.dryRunReceipt = { kind: "entity-seo-production-dry-run", ...receiptIdentity, scopes, failed: 0, conflicted: 0 };
    }
    return report;
  } catch (error) {
    if (error instanceof EntitySeoBackfillBlocked) throw error;
    // Connection/SQL/validation errors can contain credentials or source text.
    // Never include them, even as Error.cause, in the execution artifact.
    summarize();
    report.counts.failed++;
    report.counts.unresolved++;
    throw new EntitySeoBackfillBlocked(report);
  } finally {
    try { await client.end(); }
    catch {
      report.counts.failed++;
      report.counts.unresolved++;
      report.complete = false;
      report.readyForEnforcement = false;
      throw new EntitySeoBackfillBlocked(report);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
  const args = process.argv.slice(2);
  assert.ok(["--apply", "--verify", "--dry-run"].filter((flag) => args.includes(flag)).length <= 1,
    "Choose exactly one backfill mode; the default is dry-run.");
  const databaseIndex = args.indexOf("--database");
  const expectedDatabase = databaseIndex >= 0 ? args[databaseIndex + 1] : "";
  const connectionString = process.env.ENTITY_SEO_BACKFILL_DATABASE_URL;
  assert.ok(connectionString, "ENTITY_SEO_BACKFILL_DATABASE_URL is required; .env.local is never loaded implicitly.");
  assert.ok(expectedDatabase, "--database must name the isolated target explicitly.");
  const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const production = args.includes("--production");
  const receiptFile = value("--receipt");
  assert.ok(!production || receiptFile || args.includes("--verify"), "Production dry-run/apply requires an explicit --receipt file.");
  const report = await runEntitySeoBackfill({
    connectionString, expectedDatabase,
    apply: args.includes("--apply"), verify: args.includes("--verify"), recalculate: args.includes("--recalculate"),
    ...(production ? { production: {
      confirmation: value("--confirm") as EntitySeoProductionBackfill["confirmation"],
      projectRef: value("--project-ref") ?? "", expectedHost: value("--host") ?? "",
      maxRows: Number(value("--max-rows")),
      ...(process.env.ENTITY_SEO_BACKFILL_CA_FILE ? { sslCaFile: process.env.ENTITY_SEO_BACKFILL_CA_FILE } : {}),
      ...(args.includes("--apply") && receiptFile ? { dryRunReceipt: JSON.parse(readFileSync(receiptFile, "utf8")) as EntitySeoBackfillReceipt } : {}),
    } } : {}),
  });
  if (report.dryRunReceipt && receiptFile) writeFileSync(receiptFile, JSON.stringify(report.dryRunReceipt, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ mode: report.mode, counts: report.counts, preflight: report.preflight, entities: report.entities,
    complete: report.complete, readyForEnforcement: report.readyForEnforcement }, null, 2));
  } catch (error) {
    console.error(JSON.stringify(error instanceof EntitySeoBackfillBlocked
      ? { counts: error.report.counts, entities: error.report.entities, complete: false, readyForEnforcement: false }
      : { counts: { targeted: 0, calculated: 0, written: 0, unchanged: 0, conflicted: 0, failed: 1, unresolved: 1 }, complete: false, readyForEnforcement: false }));
    process.exitCode = 1;
  }
}
