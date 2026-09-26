import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import type { OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import type { ApplicationHandoffReport } from "./lib/isolated-public-application.mts";

const ROOT = resolve(import.meta.dirname, "..");
const filename = resolve(ROOT, "scripts/lib/isolated-public-application.mts");
const require = createRequire(import.meta.url);
type Owner = typeof import("./lib/isolated-public-application.mts");
type Row = { version: string; name: string; statements: string[] };
type Faults = { failCliAt?: number; failPageVerify?: boolean; driftSource?: boolean };

/** Run the actual handoff control flow with isolated CLI/registry/SEO ports.
 * No container, connection, file mutation, migration or integration claim. */
function fixture(faults: Faults = {}) {
  const registry: Row[] = [], applied: number[] = [], backfills: Array<{ mode: string; entities: readonly string[]; registered: number }> = [];
  const handle = {
    identity: { database: "postgres" },
    query: async (sql: string) => {
      if (sql.startsWith("select current_database()")) return { rows: [{ database: "postgres", role: "postgres" }] };
      if (sql.startsWith("select to_regclass(")) return { rows: [{ present: registry.length > 0 }] };
      if (sql.startsWith("select version, name, statements")) return { rows: structuredClone(registry) };
      if (sql.includes("from public.page_composition_assignments")) return { rows: [] };
      throw new Error("Unexpected offline SQL port: " + sql.slice(0, 80));
    },
    pushApplicationMigrations: async (request: { mode: "dry-run" | "apply"; stage: { files: Array<{ file: string }> } }) => {
      const pending = request.stage.files.slice(registry.length).map(entry => entry.file);
      const failed = request.mode === "apply" && faults.failCliAt === request.stage.files.length;
      if (request.mode === "apply") {
        applied.push(request.stage.files.length);
        if (!failed) {
          for (const file of pending) registry.push({ version: file.slice(0, 14), name: file.slice(15, -4), statements: ["offline-registry-fixture"] });
        }
      }
      return { exitCode: failed ? 1 : 0, cliVersion: "offline", cliSha256: "a".repeat(64),
        stdoutSha256: "b".repeat(64), stderrSha256: "c".repeat(64), sqlState: failed ? "23514" : null,
        failedFile: failed ? pending[0] : null, failureClass: failed ? "sql_error" : null,
        pendingFiles: pending, dryRun: request.mode === "dry-run" };
    },
    runEntitySeoBackfill: async (request: { mode: string; entities?: readonly string[] }) => {
      const entities = request.entities ?? ["topics", "projects"];
      backfills.push({ mode: request.mode, entities, registered: registry.length });
      if (faults.failPageVerify && entities.includes("pages") && request.mode === "verify") throw new Error("Injected Page SEO readiness failure");
      return { mode: request.mode === "dry-run" ? "dry_run" : request.mode, database: "postgres",
        complete: true, readyForEnforcement: true, entities: entities.map(entity => ({ entity })),
        counts: { failed: 0, conflicted: 0, unresolved: 0, written: 0 } };
    },
    record: () => undefined,
  } as unknown as OwnedLocalHandle;
  const compiled = ts.transpileModule(readFileSync(filename, "utf8").replaceAll("import.meta.url", "__sourceUrl"), {
    fileName: filename.replace(/\.mts$/u, ".ts"), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "__sourceUrl", compiled)((specifier: string) => {
    if (specifier === "./isolated-supabase.mts") return { assertOwnedLocalHandle: (candidate: unknown) => assert.equal(candidate, handle) };
    if (specifier === "./migration-provenance.mjs") return { assertMigrationSourceProvenance: () => undefined };
    if (specifier === "node:fs") return {
      readdirSync,
      readFileSync: (file: string, encoding: BufferEncoding) => {
        const bytes = readFileSync(file, encoding);
        return faults.driftSource && file.endsWith("20260926013156_menu_resource_reference_integrity.sql") ? bytes + "\n-- injected offline source drift\n" : bytes;
      },
    };
    assert.ok(specifier.startsWith("node:"), "Unexpected actual-owner dependency in offline port fixture.");
    return require(specifier);
  }, loadedModule, loadedModule.exports, pathToFileURL(filename).href);
  return { owner: loadedModule.exports as Owner, handle, registry, applied, backfills, faults };
}

export async function verifyApplicationClosureCheckpointsOffline() {
  const checks: string[] = [];
  const test = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); };
  const blocked = async (f: ReturnType<typeof fixture>, observer: Parameters<Owner["runApplicationHandoff"]>[2] = {}) => {
    let report: ApplicationHandoffReport | undefined;
    await assert.rejects(f.owner.runApplicationHandoff(f.handle, [], observer), error => {
      assert.ok(error instanceof f.owner.ApplicationHandoffBlocked);
      report = error.report;
      return true;
    });
    assert.ok(report);
    assert.equal(report.status, "blocked");
    return report;
  };
  await test("Omitted closure observer preserves the existing apply sequence and final Page SEO phase", async () => {
    const f = fixture(), report = await f.owner.runApplicationHandoff(f.handle);
    assert.equal(report.status, "complete");
    assert.deepEqual(f.applied, [1, 104, 106, 107, 115]);
    assert.equal(report.closureCheckpointsVerified, undefined);
    assert.ok(f.backfills.filter(row => row.entities.includes("pages")).every(row => row.registered === 115));
  });
  await test("Actual callback flow visits112,113,114 once with ready Page SEO and frozen metadata", async () => {
    const f = fixture(), observed: Array<{ version: string; registered: number }> = [];
    const report = await f.owner.runApplicationHandoff(f.handle, [], { onClosureCheckpoint: async (handle, checkpoint) => {
      assert.equal(handle, f.handle);
      assert.ok(Object.isFrozen(checkpoint));
      assert.equal(f.registry.length, checkpoint.registered);
      assert.equal(f.registry.at(-1)!.version, checkpoint.version);
      assert.match(checkpoint.corpusSha256, /^[a-f0-9]{64}$/u);
      assert.ok(f.backfills.some(row => row.entities.includes("pages") && row.mode === "verify" && row.registered === 112));
      observed.push({ version: checkpoint.version, registered: checkpoint.registered });
    } });
    assert.deepEqual(f.applied, [1, 104, 106, 107, 112, 113, 114, 115]);
    assert.deepEqual(observed, [{ version: "20260925200723", registered: 112 }, { version: "20260926013156", registered: 113 }, { version: "20260926013216", registered: 114 }]);
    assert.equal(report.closureCheckpointsVerified, 3);
    assert.equal(report.status, "complete");
  });
  await test("Provisioning mode supports only the new observer without replaying SEO idempotency suites", async () => {
    const f = fixture(), observed: number[] = [];
    const report = await f.owner.runApplicationHandoff(f.handle, [], { mode: "measurement-provision",
      onClosureCheckpoint: async (_handle, checkpoint) => { observed.push(checkpoint.registered); } });
    assert.deepEqual(observed, [112, 113, 114]);
    assert.equal(report.closureCheckpointsVerified, 3);
    assert.equal(report.seoIdempotencyVerified, false);
    assert.equal(report.migrationIdempotencyVerified, false);
    assert.equal(f.backfills.filter(row => row.entities.includes("pages") && row.mode === "apply").length, 1);
  });
  await test("Changed observer registry history is rejected before113", async () => {
    const f = fixture();
    const report = await blocked(f, { onClosureCheckpoint: async () => { f.registry[0].statements.push("rewritten"); } });
    assert.equal(report.stage, "closure_checkpoint");
    assert.equal(report.closureCheckpointsVerified, 0);
    assert.equal(f.applied.at(-1), 112);
  });
  await test("Changed canonical source is rejected before113", async () => {
    const f = fixture();
    const report = await blocked(f, { onClosureCheckpoint: async () => { f.faults.driftSource = true; } });
    assert.equal(report.stage, "closure_checkpoint");
    assert.equal(report.closureCheckpointsVerified, 0);
    assert.equal(f.applied.at(-1), 112);
  });
  await test("Observer rejection cannot be relabeled as a verified checkpoint or resumed suffix", async () => {
    const f = fixture();
    const report = await blocked(f, { onClosureCheckpoint: async () => { throw new Error("Measured checkpoint rejection"); } });
    assert.equal(report.stage, "closure_checkpoint");
    assert.equal(report.closureCheckpointsVerified, 0);
    assert.equal(f.applied.at(-1), 112);
  });
  await test("CLI failure at113 retains the last verified112 boundary and prevents114", async () => {
    const f = fixture({ failCliAt: 113 }), observed: number[] = [];
    const report = await blocked(f, { onClosureCheckpoint: async (_handle, checkpoint) => { observed.push(checkpoint.registered); } });
    assert.deepEqual(observed, [112]);
    assert.equal(report.registered, 112);
    assert.equal(report.sqlState, "23514");
    assert.equal(report.closureCheckpointsVerified, 1);
    assert.equal(f.applied.at(-1), 113);
  });
  await test("Reviewed115 suffix failure preserves completed112-114 observations and does not claim complete", async () => {
    const f = fixture({ failCliAt: 115 }), observed: number[] = [];
    const report = await blocked(f, { onClosureCheckpoint: async (_handle, checkpoint) => { observed.push(checkpoint.registered); } });
    assert.deepEqual(observed, [112, 113, 114]);
    assert.equal(report.registered, 114);
    assert.equal(report.closureCheckpointsVerified, 3);
    assert.equal(report.sqlState, "23514");
    assert.equal(f.applied.at(-1), 115);
  });
  await test("Page SEO readiness failure prevents the112 observation and later migrations", async () => {
    const f = fixture({ failPageVerify: true }), observed: number[] = [];
    const report = await blocked(f, { onClosureCheckpoint: async (_handle, checkpoint) => { observed.push(checkpoint.registered); } });
    assert.deepEqual(observed, []);
    assert.equal(report.stage, "seo_verify");
    assert.equal(report.closureCheckpointsVerified, 0);
    assert.equal(f.applied.at(-1), 112);
  });
  return { status: "PASS", checks: checks.length, cases: checks, actualHandoffControlFlow: true,
    ports: ["offline registry", "offline CLI", "offline SEO", "offline source provenance"], dockerExecuted: false, databaseCalls: 0, networkRequests: 0, integrationReadinessClaimed: false };
}
