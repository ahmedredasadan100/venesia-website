import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
// @ts-expect-error This workspace uses pg without separate declarations.
import pg from "pg";
import type { SeoScoreInput } from "../src/lib/admin/seo-score.ts";
import type { PersistedEntitySeoScore, PersistedEntitySeoScoreSource } from "../src/lib/seo/entity-seo-types.ts";
import type { TopicSeoSource, ProjectSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";
import { ADMIN_ENTITY_SEO_ADOPTION_MANIFEST, type AdminEntitySeoAdoptionEntry } from "../src/lib/admin/seo/entity-seo-adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

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
      if (!specifier.startsWith(".")) return require(specifier);
      const base = resolve(dirname(file), specifier);
      const target = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")].find(existsSync);
      assert.ok(target, `Unresolved owner dependency: ${specifier}`);
      return load(target);
    }, loaded, loaded.exports);
    return loaded.exports;
  }
  return load(resolve(ROOT, "src/lib/admin/seo/entity-seo-persistence.ts")) as unknown as {
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
  const target = new URL(connectionString);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "A PostgreSQL URL is required.");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Remote backfill targets are prohibited by this execution artifact.");
  assert.match(expectedDatabase, /^[a-z][a-z0-9_]*$/u, "An explicit isolated database name is required.");
  assert.equal(decodeURIComponent(target.pathname.slice(1)), expectedDatabase, "Database identity mismatch.");
}

export async function runEntitySeoBackfill(options: {
  connectionString: string;
  expectedDatabase: string;
  apply?: boolean;
  verify?: boolean;
  recalculate?: boolean;
  batchSize?: number;
}) {
  assertIsolatedSeoBackfillTarget(options.connectionString, options.expectedDatabase);
  assert.ok(!(options.apply && options.verify), "Verification never writes.");
  const batchSize = options.batchSize ?? 100;
  assert.ok(Number.isInteger(batchSize) && batchSize > 0 && batchSize <= 1000);
  const owner = loadEntitySeoPersistenceOwner();
  const inventory: readonly AdminEntitySeoAdoptionEntry[] = ADMIN_ENTITY_SEO_ADOPTION_MANIFEST;
  const adoptedTables = [...new Set(inventory.flatMap((entry) =>
    entry.persistedScore?.status === "adopted" && entry.persistedScore.table ? [entry.persistedScore.table] : []))];
  const client = new pg.Client({ connectionString: options.connectionString, application_name: "isolated-entity-seo-backfill" });
  const report = {
    mode: options.verify ? "verify" : options.apply ? "apply" : "dry_run",
    database: options.expectedDatabase,
    entities: [] as Array<{ entity: string; scanned: number; recalculated: number; written: number; unchanged: number }>,
    excluded: inventory.flatMap((entry) => entry.persistedScore?.status === "gap"
      ? [{ entity: entry.id, reason: entry.persistedScore.reason }] : []),
  };
  await client.connect();
  try {
    const identity = await client.query("select current_database() as database");
    assert.equal(identity.rows[0].database, options.expectedDatabase);
    for (const entity of adoptedTables) {
      const columns = entity === "topics" ? owner.TOPIC_SEO_SOURCE_COLUMNS : owner.PROJECT_SEO_SOURCE_COLUMNS;
      const projection = ["id", ...columns, ...owner.PERSISTED_ENTITY_SEO_FIELDS].map((column) => `"${column}"`).join(",");
      const counts = { entity, scanned: 0, recalculated: 0, written: 0, unchanged: 0 };
      report.entities.push(counts);
      let afterId = 0;
      while (true) {
        // The table/projection come only from the closed adoption contract above.
        const batch = await client.query(`select ${projection} from public.${entity} where id > $1 order by id limit $2`, [afterId, batchSize]);
        if (!batch.rows.length) break;
        for (const row of batch.rows) {
          counts.scanned++;
          try {
            const input = entity === "topics" ? owner.toTopicSeoScoreInput(row) : owner.toProjectSeoScoreInput(row);
            const derived = owner.deriveEntitySeoScore(input, options.verify || options.recalculate ? undefined : row);
            const unchanged = owner.PERSISTED_ENTITY_SEO_FIELDS.every((field) => row[field] === derived[field as keyof PersistedEntitySeoScore]);
            if (options.verify || options.recalculate || !unchanged) counts.recalculated++;
            if (options.verify) assert.ok(unchanged, "Stored score/provenance differs from the canonical SEO owner.");
            if (unchanged) counts.unchanged++;
            else if (options.apply) {
              // A concurrent SEO edit cannot receive a score from this snapshot.
              // Updating only the derived tuple preserves editorial timestamps.
              const written = await client.query(
                `update public.${entity} entity set seo_score=$1, seo_score_version=$2, seo_score_input_hash=$3
                 where id=$4 and public.entity_seo_score_input_hash($5, to_jsonb(entity))=$3 returning id`,
                [derived.seo_score, derived.seo_score_version, derived.seo_score_input_hash, row.id, entity],
              );
              assert.equal(written.rowCount, 1, "Concurrent SEO input change; safely rerun the backfill.");
              counts.written++;
            }
            afterId = Number(row.id);
          } catch (error) {
            throw new Error(`Entity SEO backfill failed at ${entity}:${row.id}; earlier rows are resumable and this row was not partially written. ${error instanceof Error ? error.message : "Unknown failure"}`);
          }
        }
      }
    }
    return report;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const databaseIndex = args.indexOf("--database");
  const expectedDatabase = databaseIndex >= 0 ? args[databaseIndex + 1] : "";
  const connectionString = process.env.ENTITY_SEO_BACKFILL_DATABASE_URL;
  assert.ok(connectionString, "ENTITY_SEO_BACKFILL_DATABASE_URL is required; .env.local is never loaded implicitly.");
  assert.ok(expectedDatabase, "--database must name the isolated target explicitly.");
  const report = await runEntitySeoBackfill({
    connectionString, expectedDatabase,
    apply: args.includes("--apply"), verify: args.includes("--verify"), recalculate: args.includes("--recalculate"),
  });
  console.log(JSON.stringify(report, null, 2));
}
