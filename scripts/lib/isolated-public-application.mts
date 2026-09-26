import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertMigrationSourceProvenance } from "./migration-provenance.mjs";

import {
  assertOwnedLocalHandle,
  type ApplicationMigrationCliResult,
  type ApplicationMigrationStage,
  type EntitySeoBackfillReport,
  type OwnedLocalHandle,
} from "./isolated-supabase.mts";

const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../sql/migrations");
const migrationFilename = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
// docs/operations/entity-seo-cutover.md owns EXPAND -> backfill -> ENFORCE.
const firstSeoExpand = "20260914004050_entity_seo_persisted_score.sql";
const secondSeoExpand = "20260914004118_project_seo_persisted_score.sql";
const seoEnforce = "20260914151556_entity_seo_score_enforcement.sql";
// The later declaration classifies the five tables introduced after security
// revision 1. It preserves their existing ACL/RLS and follows the SEO cutover.
const postSeoSecurityDeclaration = "20260916201230_database_rls_post_platform_classification.sql";

type Migration = { file: string; version: string; name: string; sha256: string };
type RegistryRow = { version: string; name: string; statements: string[] };
type RegistrySnapshot = { present: boolean; rows: RegistryRow[] };
type Stage = "identity" | "corpus" | "registry_preflight" | "dry_run" | "apply" | "registry_verify"
  | "seo_dry_run" | "seo_apply" | "seo_verify" | "seo_idempotency" | "closure_checkpoint" | "complete";

const closureVersions = ["20260925200723", "20260926013156", "20260926013216"] as const;
export type ApplicationClosureCheckpoint = Readonly<{
  version: typeof closureVersions[number];
  registered: number;
  corpusSha256: string;
}>;

export type ApplicationHandoffReport = {
  status: "blocked" | "complete";
  stage: Stage;
  migration: string | null;
  sqlState: string | null;
  reason: "migration_registry_not_empty" | "cli_failed" | "cli_plan_mismatch" | "seo_backfill_failed" | "operation_failed" | null;
  planned: number;
  baselinePlanned: number;
  registered: number;
  corpusSha256: string | null;
  firstMigrationVerified: boolean;
  baselineVerified: boolean;
  seoExpandVerified: boolean;
  seoBackfillVerified: boolean;
  seoIdempotencyVerified: boolean;
  seoEnforceVerified: boolean;
  pageSeoBackfillVerified: boolean;
  registryReadback: "not_attempted" | "verified_prefix" | "unavailable_or_mismatch";
  canonicalWholeFileRegistryVerified: false;
  officialCliExecutionProvenanceVerified: boolean;
  migrationIdempotencyVerified: boolean;
  failedMigrationState: "not_started" | "unconfirmed";
  provisioningOnly?: true;
  priorVerificationSuitesRerun?: false;
  closureCheckpointsVerified?: number;
};

export class ApplicationHandoffBlocked extends Error {
  readonly report: ApplicationHandoffReport;

  constructor(report: ApplicationHandoffReport) {
    super(`Isolated application handoff stopped at ${report.stage}${report.migration ? ` (${report.migration})` : ""}.`);
    this.name = "ApplicationHandoffBlocked";
    this.report = report;
  }
}

// The current repository corpus remains authoritative. Only line endings are
// normalized for the same source fingerprint used by the existing registry owner.
function readCanonicalCorpus(): Migration[] {
  const files = readdirSync(migrationsDirectory).filter((file) => file.endsWith(".sql")).sort();
  assert.ok(files.length > 0, "Canonical migration corpus is empty.");
  const migrations = files.map((file) => {
    const match = migrationFilename.exec(file);
    assert.ok(match, "Noncanonical migration filename.");
    const sql = readFileSync(join(migrationsDirectory, file), "utf8").replace(/\r\n?/gu, "\n");
    assertMigrationSourceProvenance({ version: match[1], name: match[2], sql });
    return { file, version: match[1], name: match[2], sha256: digest(sql) };
  });
  assert.equal(new Set(migrations.map(({ version }) => version)).size, migrations.length);
  return migrations;
}

function cliStage(migrations: Migration[]): ApplicationMigrationStage {
  return {
    files: migrations.map(({ file, sha256 }) => ({ file, sourceSha256: sha256 })),
    corpusSha256: digest(migrations.map(({ version, sha256 }) => `${version}:${sha256}`).join("\n")),
  };
}

async function readRegistry(handle: OwnedLocalHandle): Promise<RegistrySnapshot> {
  const registry = await handle.query("select to_regclass('supabase_migrations.schema_migrations') is not null as present");
  assert.equal(registry.rows.length, 1);
  assert.equal(typeof registry.rows[0].present, "boolean");
  if (registry.rows[0].present === false) return { present: false, rows: [] };
  const result = await handle.query("select version, name, statements from supabase_migrations.schema_migrations order by version");
  const rows = result.rows.map((row) => {
    assert.equal(typeof row.version, "string");
    assert.equal(typeof row.name, "string");
    assert.ok(Array.isArray(row.statements) && row.statements.length > 0
      && row.statements.every((statement) => typeof statement === "string" && statement.length > 0));
    return { version: row.version as string, name: row.name as string, statements: row.statements as string[] };
  });
  return { present: true, rows };
}

function verifyRegistryPrefix(snapshot: RegistrySnapshot, phase: Migration[], before: RegistrySnapshot): void {
  assert.ok(snapshot.rows.length <= phase.length);
  assert.deepEqual(snapshot.rows.map(({ version, name }) => ({ version, name })),
    phase.slice(0, snapshot.rows.length).map(({ version, name }) => ({ version, name })));
  assert.deepEqual(snapshot.rows.slice(0, before.rows.length), before.rows, "Prior CLI history changed.");
}

function recordCli(handle: OwnedLocalHandle, result: ApplicationMigrationCliResult, phase: Migration[], mode: "dry-run" | "apply"): void {
  assert.ok(/^[a-f0-9]{64}$/u.test(result.cliSha256)
    && /^[a-f0-9]{64}$/u.test(result.stdoutSha256) && /^[a-f0-9]{64}$/u.test(result.stderrSha256));
  assert.ok(result.sqlState === null || /^[0-9A-Z]{5}$/u.test(result.sqlState));
  assert.ok(result.failedFile === null || phase.some(({ file }) => file === result.failedFile));
  handle.record("application-cli-result", {
    mode, exitCode: result.exitCode, cliVersion: result.cliVersion, cliSha256: result.cliSha256,
    stdoutSha256: result.stdoutSha256, stderrSha256: result.stderrSha256,
    pendingCount: result.pendingFiles.length, sqlState: result.sqlState, failedFile: result.failedFile, failureClass: result.failureClass,
    securityAssertionCode: result.securityAssertionCode ?? null,
  });
}

function recordSeo(handle: OwnedLocalHandle, result: EntitySeoBackfillReport, stage: Stage): void {
  handle.record("application-seo-backfill", {
    stage, entities: result.entities.map(({ entity }) => entity).join(","),
    mode: result.mode, complete: result.complete, readyForEnforcement: result.readyForEnforcement,
    ...result.counts,
  });
}

/**
 * Fresh, owned local handoff through the official CLI. SQL execution, history
 * creation, and statement parsing belong to that CLI, never this adapter.
 */
export type ApplicationMigrationCheckpoint = {
  version: string;
  observe: (handle: OwnedLocalHandle, boundary: "before" | "after") => Promise<void>;
};

const verificationPrefixes = new WeakMap<OwnedLocalHandle, {
  registry: RegistrySnapshot;
  source: Migration[];
}>();

/**
 * Targeted, staged migration verification on the same canonical isolated owner.
 * Each call advances the full canonical prefix using the official CLI. It never
 * selects a non-prefix file, replays applied SQL, repairs history, or accepts an
 * existing environment. Later draft SQL can be finalized between stages, while
 * the already applied source and CLI registry must remain byte-for-byte stable.
 */
export async function applyCanonicalApplicationVerificationPrefix(
  handle: OwnedLocalHandle,
  throughVersion: string,
): Promise<{ registered: number; throughVersion: string; corpusSha256: string; applied: string[] }> {
  assertOwnedLocalHandle(handle);
  assert.match(throughVersion, /^\d{14}$/u);
  const identity = await handle.query("select current_database() as database, current_user as role");
  assert.equal(identity.rows[0]?.database, handle.identity.database);
  assert.equal(identity.rows[0]?.role, "postgres");
  const corpus = readCanonicalCorpus();
  const end = corpus.findIndex(migration => migration.version === throughVersion);
  assert.ok(end >= 0, "Unknown canonical verification boundary.");
  const phase = corpus.slice(0, end + 1);
  const before = await readRegistry(handle);
  const previous = verificationPrefixes.get(handle);
  if (previous) {
    assert.deepEqual(before, previous.registry, "Previously observed official CLI history changed.");
    assert.deepEqual(phase.slice(0, previous.source.length), previous.source, "Applied canonical source changed.");
    assert.ok(phase.length >= previous.source.length, "A verification boundary cannot move backwards.");
  } else {
    assert.equal(before.rows.length, 0, "Targeted verification requires a newly owned fresh history.");
  }
  const stage = cliStage(phase);
  const pending = phase.slice(before.rows.length).map(migration => migration.file);
  const assertStable = () => assert.deepEqual(readCanonicalCorpus().slice(0, phase.length), phase, "Planned prefix changed.");
  const dry = await handle.pushApplicationMigrations({ mode: "dry-run", stage });
  recordCli(handle, dry, phase, "dry-run");
  assert.equal(dry.exitCode, 0, "Canonical prefix dry-run failed.");
  assert.deepEqual(dry.pendingFiles, pending);
  assert.deepEqual(await readRegistry(handle), before, "Dry-run changed migration history.");
  assertStable();
  const applied = await handle.pushApplicationMigrations({ mode: "apply", stage });
  recordCli(handle, applied, phase, "apply");
  const after = await readRegistry(handle);
  verifyRegistryPrefix(after, phase, before);
  if (applied.exitCode !== 0) handle.record("application-verification-prefix-failed", {
    registered: after.rows.length, beforeRegistered: before.rows.length,
    registryUnchanged: JSON.stringify(after) === JSON.stringify(before),
    registrySha256: digest(JSON.stringify(after)),
    throughVersion, sqlState: applied.sqlState,
    securityAssertionCode: applied.securityAssertionCode ?? null,
    historyRewritten: false,
  });
  assert.equal(applied.exitCode, 0, `Canonical prefix application failed (${applied.sqlState ?? "unknown"}).`);
  assert.deepEqual(applied.pendingFiles, pending);
  assert.equal(after.rows.length, phase.length);
  assertStable();
  verificationPrefixes.set(handle, { registry: after, source: phase });
  const receipt = { registered: after.rows.length, throughVersion, corpusSha256: stage.corpusSha256, applied: pending };
  handle.record("application-verification-prefix", {
    registered: receipt.registered, throughVersion, corpusSha256: stage.corpusSha256,
    appliedCount: pending.length, officialCliExecution: true, historyRewritten: false,
  });
  return receipt;
}

export async function runApplicationHandoff(
  handle: OwnedLocalHandle,
  checkpoints: readonly ApplicationMigrationCheckpoint[] = [],
  options: {
    mode?: "measurement-provision";
    /** Fixed release boundaries only; observers cannot replace SQL or history. */
    onClosureCheckpoint?: (handle: OwnedLocalHandle, checkpoint: ApplicationClosureCheckpoint) => Promise<void>;
  } = {},
): Promise<ApplicationHandoffReport> {
  assertOwnedLocalHandle(handle);
  assert.ok(options.mode === undefined || options.mode === "measurement-provision");
  assert.ok(options.onClosureCheckpoint === undefined || typeof options.onClosureCheckpoint === "function");
  const provisioningOnly = options.mode === "measurement-provision";
  if (provisioningOnly) assert.equal(checkpoints.length, 0, "Measurement provisioning does not replay verification checkpoints.");
  const report: ApplicationHandoffReport = {
    status: "blocked", stage: "identity", migration: null, sqlState: null, reason: null,
    planned: 0, baselinePlanned: 0, registered: 0, corpusSha256: null,
    firstMigrationVerified: false, baselineVerified: false, registryReadback: "not_attempted",
    seoExpandVerified: false, seoBackfillVerified: false, seoIdempotencyVerified: false, seoEnforceVerified: false, pageSeoBackfillVerified: false,
    canonicalWholeFileRegistryVerified: false, officialCliExecutionProvenanceVerified: false,
    migrationIdempotencyVerified: false, failedMigrationState: "not_started",
    ...(provisioningOnly ? { provisioningOnly: true as const, priorVerificationSuitesRerun: false as const } : {}),
    ...(options.onClosureCheckpoint ? { closureCheckpointsVerified: 0 } : {}),
  };

  try {
    const identity = await handle.query("select current_database() as database, current_user as role");
    assert.equal(identity.rows.length, 1);
    assert.equal(identity.rows[0].database, handle.identity.database);
    assert.equal(identity.rows[0].role, "postgres");

    report.stage = "corpus";
    const migrations = readCanonicalCorpus();
    const seoBoundary = migrations.findIndex(({ file }) => file === firstSeoExpand);
    assert.ok(seoBoundary > 0, "The runbook's SEO phase boundary must exist in the current corpus.");
    assert.equal(migrations[seoBoundary + 1]?.file, secondSeoExpand);
    assert.equal(migrations[seoBoundary + 2]?.file, seoEnforce);
    assert.equal(migrations[seoBoundary + 3]?.file, postSeoSecurityDeclaration,
      "The reviewed post-SEO security declaration must follow ENFORCE.");
    assert.deepEqual(
      migrations.slice(seoBoundary + 4).map(({ file }) => file),
      [
        "20260920010000_public_feed_aggregated_reads.sql",
        "20260920011000_page_composition_layout_regions.sql",
        "20260925001602_f03_page_layout_admin_f07_page_seo_persistence.sql",
        "20260925200723_topics_batch_atomic_current_state.sql",
        "20260926013156_menu_resource_reference_integrity.sql",
        "20260926013216_topics_command_completion.sql",
        "20260926153347_public_cache_invalidation_generation.sql",
      ],
      "Only the reviewed composition, SEO, resource-integrity, Topics command, and cache generation extensions may follow the SEO security declaration.",
    );
    const baseline = migrations.slice(0, seoBoundary);
    assert.equal(new Set(checkpoints.map(({ version }) => version)).size, checkpoints.length);
    const orderedCheckpoints = checkpoints.map((checkpoint) => {
      const index = baseline.findIndex(({ version }) => version === checkpoint.version);
      assert.ok(index > 0, "A checkpoint must observe an existing baseline migration after the first file.");
      return { ...checkpoint, index };
    }).sort((left, right) => left.index - right.index);
    report.planned = migrations.length;
    report.baselinePlanned = baseline.length;
    report.corpusSha256 = cliStage(migrations).corpusSha256;
    handle.record("application-corpus", {
      count: report.planned, baselineCount: baseline.length, sha256: report.corpusSha256,
      syntheticSeeds: false, historicalArtifactsLoaded: false,
    });

    report.stage = "registry_preflight";
    let before = await readRegistry(handle);
    if (before.rows.length !== 0) report.reason = "migration_registry_not_empty";
    assert.equal(before.rows.length, 0, "Application handoff requires a fresh migration history.");
    // An absent registry is valid: official db push creates it during apply.
    const applyPhase = async (phase: Migration[]): Promise<void> => {
      assertOwnedLocalHandle(handle);
      assert.deepEqual(readCanonicalCorpus(), migrations, "Migration source changed after planning.");
      const pending: string[] = phase.slice(before.rows.length).map(({ file }) => file);
      report.migration = pending.length === 1 ? pending[0] : null;
      report.stage = "dry_run";
      const dryRun = await handle.pushApplicationMigrations({ mode: "dry-run", stage: cliStage(phase) });
      recordCli(handle, dryRun, phase, "dry-run");
      if (dryRun.exitCode !== 0) {
        report.reason = "cli_failed";
        report.sqlState = dryRun.sqlState;
        report.migration = dryRun.failedFile;
        throw new ApplicationHandoffBlocked(report);
      }
      report.reason = "cli_plan_mismatch";
      assert.equal(dryRun.dryRun, true);
      assert.deepEqual(dryRun.pendingFiles, pending);
      assert.deepEqual(await readRegistry(handle), before, "Dry-run changed migration history.");
      assert.deepEqual(readCanonicalCorpus(), migrations, "Migration source changed during dry-run.");
      report.reason = null;

      report.stage = "apply";
      report.failedMigrationState = "unconfirmed";
      const applied = await handle.pushApplicationMigrations({ mode: "apply", stage: cliStage(phase) });
      recordCli(handle, applied, phase, "apply");
      report.sqlState = applied.sqlState;
      report.migration = applied.failedFile;
      if (applied.exitCode !== 0) report.reason = "cli_failed";

      // A failed file can leave effects without a history row. Read back the
      // actual successful prefix, but never infer rollback or retry from it.
      report.registryReadback = "unavailable_or_mismatch";
      const after = await readRegistry(handle);
      verifyRegistryPrefix(after, phase, before);
      report.registered = after.rows.length;
      report.registryReadback = "verified_prefix";
      for (const [index, row] of after.rows.entries()) {
        handle.record("application-cli-registry-entry", {
          version: row.version, name: row.name, sourceSha256: phase[index].sha256,
          statementCount: row.statements.length, statementsSha256: digest(JSON.stringify(row.statements)),
          canonicalWholeFileRegistryVerified: false,
        });
      }
      if (applied.exitCode !== 0) throw new ApplicationHandoffBlocked(report);

      report.stage = "registry_verify";
      assert.equal(applied.dryRun, false);
      assert.deepEqual(applied.pendingFiles, pending);
      assert.equal(after.present, true);
      assert.equal(after.rows.length, phase.length);
      assert.deepEqual(readCanonicalCorpus(), migrations, "Migration corpus changed during application.");
      report.failedMigrationState = "not_started";
      report.firstMigrationVerified = true;
      before = after;
    };

    await applyPhase(baseline.slice(0, 1));
    // Read-only observers select boundaries, never alternate SQL or registry data.
    // Every applied prefix still passes the same official CLI/source checks.
    for (const checkpoint of orderedCheckpoints) {
      if (before.rows.length < checkpoint.index) await applyPhase(baseline.slice(0, checkpoint.index));
      await checkpoint.observe(handle, "before");
      await applyPhase(baseline.slice(0, checkpoint.index + 1));
      await checkpoint.observe(handle, "after");
    }
    if (before.rows.length < baseline.length) await applyPhase(baseline);

    report.baselineVerified = true;
    await applyPhase(migrations.slice(0, seoBoundary + 2));
    report.seoExpandVerified = true;

    const backfill = async (mode: "dry-run" | "apply" | "verify", stage: Stage,
      entities: readonly ("topics" | "projects" | "pages")[] = ["topics", "projects"]): Promise<EntitySeoBackfillReport> => {
      assertOwnedLocalHandle(handle);
      assert.deepEqual(readCanonicalCorpus(), migrations, "Migration source changed before SEO backfill.");
      report.stage = stage;
      report.migration = null;
      report.reason = "seo_backfill_failed";
      let result: EntitySeoBackfillReport;
      try {
        result = await handle.runEntitySeoBackfill({ mode, entities });
      } catch (error) {
        // The official tool exposes a counts-only blocked report, never SQL or
        // connection errors. Preserve that evidence without turning it into PASS.
        if (error instanceof Error && error.name === "EntitySeoBackfillBlocked" && "report" in error) {
          recordSeo(handle, error.report as EntitySeoBackfillReport, stage);
        }
        throw error;
      }
      recordSeo(handle, result, stage);
      assert.equal(result.mode, mode === "dry-run" ? "dry_run" : mode);
      assert.equal(result.database, handle.identity.database);
      assert.equal(result.complete, true);
      assert.equal(result.counts.failed, 0);
      assert.equal(result.counts.conflicted, 0);
      // Dry-run unresolved means calculated rows awaiting this tool's writes.
      if (mode !== "dry-run") assert.equal(result.counts.unresolved, 0);
      if (mode === "verify") assert.equal(result.readyForEnforcement, true);
      assert.deepEqual(await readRegistry(handle), before, "Backfill changed migration history.");
      assert.deepEqual(readCanonicalCorpus(), migrations, "Migration source changed during SEO backfill.");
      report.reason = null;
      return result;
    };

    if (!provisioningOnly) await backfill("dry-run", "seo_dry_run");
    await backfill("apply", "seo_apply");
    await backfill("verify", "seo_verify");
    report.seoBackfillVerified = true;
    if (!provisioningOnly) {
      const idempotent = await backfill("apply", "seo_idempotency");
      report.reason = "seo_backfill_failed";
      assert.equal(idempotent.counts.written, 0, "Idempotency rerun must not write any row.");
      report.reason = null;
      report.seoIdempotencyVerified = true;
      await backfill("verify", "seo_verify");
    }
    // The canonical ENFORCE file also locks and rechecks all tuples atomically.
    await applyPhase(migrations.slice(0, seoBoundary + 3));
    report.seoEnforceVerified = true;
    const legacyPositions = await handle.query(`select assignment.slot, count(*)::int as assignments
      from public.page_composition_assignments assignment
      join public.pages page on page.id=assignment.page_id
      where assignment.slot not in ('main','sidebar','bottom','footer','hero')
      group by assignment.slot order by assignment.slot`);
    handle.record("legacy-assignment-position-preflight", {
      positionSummary: legacyPositions.rows.map((row) => `${String(row.slot)}=${Number(row.assignments)}`).join(",").slice(0, 256),
      unknownPositionKinds: legacyPositions.rows.length,
    });
    // Pages adopt persisted SEO in the later Page SEO extension. Its columns and
    // composition-region source do not exist at the Topic/Project EXPAND gate.
    const backfillPages = async () => {
      if (!provisioningOnly) await backfill("dry-run", "seo_dry_run", ["pages"]);
      await backfill("apply", "seo_apply", ["pages"]);
      await backfill("verify", "seo_verify", ["pages"]);
      if (!provisioningOnly) {
        const idempotentPages = await backfill("apply", "seo_idempotency", ["pages"]);
        assert.equal(idempotentPages.counts.written, 0, "Page SEO idempotency rerun must not write any row.");
        await backfill("verify", "seo_verify", ["pages"]);
      }
      report.pageSeoBackfillVerified = true;
    };
    if (options.onClosureCheckpoint) {
      for (const version of closureVersions) {
        const index = migrations.findIndex(migration => migration.version === version);
        assert.ok(index > seoBoundary + 3, "Closure checkpoint must be in the reviewed post-SEO suffix.");
        const phase = migrations.slice(0, index + 1);
        await applyPhase(phase);
        if (!report.pageSeoBackfillVerified) await backfillPages();
        const checkpoint = Object.freeze({ version, registered: before.rows.length, corpusSha256: cliStage(phase).corpusSha256 });
        report.stage = "closure_checkpoint";
        assert.deepEqual(await readRegistry(handle), before, "Closure checkpoint began with changed CLI history.");
        await options.onClosureCheckpoint(handle, checkpoint);
        assertOwnedLocalHandle(handle);
        assert.deepEqual(readCanonicalCorpus(), migrations, "Closure checkpoint changed canonical source.");
        assert.deepEqual(await readRegistry(handle), before, "Closure checkpoint changed CLI history.");
        report.closureCheckpointsVerified! += 1;
        handle.record("application-closure-checkpoint", { ...checkpoint, status: "verified", registryUnchanged: true });
      }
      // Fixed release observers retain112/113/114; apply only the remaining
      // exact reviewed corpus after their source/history invariants pass.
      if (before.rows.length < migrations.length) await applyPhase(migrations);
      assert.equal(before.rows.length, migrations.length, "Closure handoff must reach the complete reviewed corpus.");
    } else {
      await applyPhase(migrations);
      await backfillPages();
    }
    // The official CLI owns statement splitting. Preserve its rows and prove
    // source-bound execution; never relabel them as whole-file registry SQL.
    if (!provisioningOnly) {
      const idempotentPlan = await handle.pushApplicationMigrations({ mode: "dry-run", stage: cliStage(migrations) });
      recordCli(handle, idempotentPlan, migrations, "dry-run");
      assert.equal(idempotentPlan.exitCode, 0);
      assert.deepEqual(idempotentPlan.pendingFiles, []);
      assert.deepEqual(await readRegistry(handle), before, "Final CLI verification changed history.");
      assert.deepEqual(readCanonicalCorpus(), migrations, "Source changed during final CLI verification.");
      report.migrationIdempotencyVerified = true;
    }
    report.officialCliExecutionProvenanceVerified = true;
    report.status = "complete";
    report.stage = "complete";
    report.migration = null;
    handle.record("application-complete", { ...report });
    return report;
  } catch (error) {
    report.status = "blocked";
    report.reason ??= "operation_failed";
    if (report.sqlState === null && typeof error === "object" && error !== null && "code" in error
      && typeof error.code === "string" && /^[0-9A-Z]{5}$/u.test(error.code)) report.sqlState = error.code;
    try { handle.record("application-blocked", { ...report }); } catch { /* Preserve the safe original outcome. */ }
    throw new ApplicationHandoffBlocked(report);
  }
}
