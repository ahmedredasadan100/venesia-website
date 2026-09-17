import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RECORD = join(ROOT, "scripts/lib/migration-history-compatibility.json");
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const MIGRATION_FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const digest = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const source = (path) => readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");

/** @typedef {{version:string,name:string,sql:string,sha256?:string}} MigrationSource */
/** @typedef {{version:string,name:string|null,statements:string[]|null}} MigrationRegistryRow */
/** @typedef {{revision:'canonical-current'|'historical-applied'|'fresh-bootstrap-corrected',sourceSha256:string}} Provenance */
/** @typedef {{version:string,name:string,historicalSourceSha256:string,correctedSourceSha256:string,reason:string,existingDatabasePolicy:string,freshDatabasePolicy:string}} MigrationCompatibilityRecord */

/** @returns {MigrationCompatibilityRecord[]} */
function readRecords() {
  const record = JSON.parse(readFileSync(RECORD, "utf8"));
  assert.equal(record.formatVersion, 2, "Unsupported migration compatibility record.");
  assert.equal(record.kind, "bounded-migration-history-compatibility");
  assert.equal(record.existingDatabasePolicy, "preserve-recorded-revision-without-replay-or-registry-rewrite");
  assert.equal(record.freshDatabasePolicy, "execute-corrected-canonical-source");
  assert.ok(Array.isArray(record.entries) && record.entries.length > 0, "Missing reviewed compatibility entries.");
  for (const entry of record.entries) {
    assert.match(entry.version, /^\d{14}$/u);
    assert.match(entry.name, /^[a-z0-9_]+$/u);
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 0);
  }
  assert.equal(new Set(record.entries.map(entry => entry.version)).size, record.entries.length, "Ambiguous compatibility version.");
  return record.entries.map(entry => ({ ...entry,
    existingDatabasePolicy: record.existingDatabasePolicy, freshDatabasePolicy: record.freshDatabasePolicy,
  }));
}

/** Only explicitly reviewed versions; no semantic or arbitrary hash allowlist. */
export function isMigrationHistoryCompatibilityVersion(version) {
  return readRecords().some(record => version === record.version);
}

export function getMigrationHistoryCompatibilityVersions() {
  return Object.freeze(readRecords().map(record => record.version));
}

/**
 * Historical evidence is outside the executable corpus. Verify both immutable
 * revision identities before recognizing either; no unknown source is accepted.
 */
export function loadMigrationHistoryCompatibility(version = "20260729150000") {
  const record = readRecords().find(entry => entry.version === version);
  assert.ok(record, "Migration version has no reviewed history compatibility contract.");
  const historicalSql = source(join(ROOT, "sql/migration-history", record.version, "historical-applied.sql"));
  const correctedSql = source(join(ROOT, "sql/migrations", `${record.version}_${record.name}.sql`));
  return verifyMigrationHistoryCompatibilitySources(record, historicalSql, correctedSql);
}

/**
 * Pure source verification used by the loader and negative provenance tests.
 * @param {MigrationCompatibilityRecord} record
 * @param {string} historicalSql
 * @param {string} correctedSql
 */
export function verifyMigrationHistoryCompatibilitySources(record, historicalSql, correctedSql) {
  assert.match(record.historicalSourceSha256, SHA256, "Historical revision hash is not frozen.");
  assert.match(record.correctedSourceSha256, SHA256, "Corrected revision hash is not frozen.");
  assert.notEqual(record.historicalSourceSha256, record.correctedSourceSha256);
  assert.equal(digest(historicalSql), record.historicalSourceSha256, "Historical migration archive drift.");
  assert.equal(digest(correctedSql), record.correctedSourceSha256, "Corrected migration source drift.");
  return Object.freeze({ ...record, historicalSql, correctedSql });
}

/** @param {MigrationSource} migration */
export function assertMigrationSourceProvenance(migration) {
  assert.match(migration.version, /^\d{14}$/u);
  assert.match(migration.name, /^[a-z0-9_]+$/u);
  assert.equal(typeof migration.sql, "string");
  if (migration.sha256 !== undefined) assert.equal(digest(migration.sql), migration.sha256);
  if (!isMigrationHistoryCompatibilityVersion(migration.version)) return;
  const contract = loadMigrationHistoryCompatibility(migration.version);
  assert.equal(migration.name, contract.name, "Compatibility migration name drift.");
  assert.equal(migration.sql, contract.correctedSql, "Executable migration is not the approved corrected revision.");
}

/**
 * Whole-file registry provenance only. Official CLI statement receipts are a
 * different execution representation and must never be normalized into this one.
 * @param {MigrationRegistryRow} row
 * @param {MigrationSource} migration
 * @returns {Provenance|null}
 */
export function classifyWholeFileMigrationProvenance(row, migration) {
  assertMigrationSourceProvenance(migration);
  if (row.version !== migration.version || row.name !== migration.name
    || row.statements?.length !== 1 || typeof row.statements[0] !== "string") return null;
  const recordedSql = row.statements[0];
  if (!isMigrationHistoryCompatibilityVersion(migration.version)) {
    return recordedSql === migration.sql ? { revision: "canonical-current", sourceSha256: digest(recordedSql) } : null;
  }
  const contract = loadMigrationHistoryCompatibility(migration.version);
  if (recordedSql === contract.historicalSql) {
    return { revision: "historical-applied", sourceSha256: contract.historicalSourceSha256 };
  }
  if (recordedSql === contract.correctedSql) {
    return { revision: "fresh-bootstrap-corrected", sourceSha256: contract.correctedSourceSha256 };
  }
  return null;
}

/** @param {MigrationRegistryRow} row @param {MigrationSource} migration @returns {Provenance} */
export function assertWholeFileMigrationProvenance(row, migration) {
  const provenance = classifyWholeFileMigrationProvenance(row, migration);
  assert.ok(provenance, `Unrecognized exact migration provenance: ${migration.version}`);
  return provenance;
}

/** Read immutable Git evidence only; never fetch, repair, or trust replacement refs. */
function gitEvidence(root, args) {
  try {
    return execFileSync("git", ["--no-replace-objects", ...args], {
      cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    assert.fail("Required migration Git evidence is unavailable or has unrelated ancestry; fetch complete history before verification.");
  }
}

function readGitMigrationTree(root, commit) {
  const entries = gitEvidence(root, ["ls-tree", "-r", "-z", commit, "--", "sql/migrations"])
    .split("\0").filter(Boolean);
  return entries.filter(entry => entry.endsWith(".sql")).map(entry => {
    const match = /^(100644) blob ([a-f0-9]{40})\tsql\/migrations\/([^/]+)$/u.exec(entry);
    assert.ok(match, "Migration Git evidence must contain regular canonical SQL files, not links or nested paths.");
    const identity = MIGRATION_FILE.exec(match[3]);
    assert.ok(identity, "Migration Git evidence has a noncanonical filename.");
    const sql = gitEvidence(root, ["cat-file", "blob", match[2]]).replace(/\r\n?/gu, "\n");
    return { file: match[3], version: identity[1], name: identity[2], sql, sha256: digest(sql) };
  });
}

/**
 * Historical membership comes from the pinned snapshot tree, never the current
 * sorted prefix. Current additions are exact files in a committed descendant
 * tree, not assertions about review approval or Production application.
 */
export function loadGitMigrationCorpusEvidence({ root = ROOT, snapshotCommit }) {
  assert.match(snapshotCommit, COMMIT, "Historical snapshot must be an immutable full commit SHA.");
  const headCommit = gitEvidence(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  assert.match(headCommit, COMMIT);
  assert.equal(gitEvidence(root, ["rev-parse", "--verify", `${snapshotCommit}^{commit}`]).trim(), snapshotCommit);
  gitEvidence(root, ["merge-base", "--is-ancestor", snapshotCommit, headCommit]);
  const historical = readGitMigrationTree(root, snapshotCommit);
  const committed = readGitMigrationTree(root, headCommit);
  assert.ok(historical.length > 0 && committed.length > 0, "Migration Git tree evidence is empty.");
  assert.equal(gitEvidence(root, ["rev-parse", "HEAD"]).trim(), headCommit, "HEAD changed during migration evidence collection.");
  return { snapshotCommit, headCommit, historical, committed };
}

/** @param {Array<MigrationSource & {file?:string}>} migrations */
function corpusByVersion(migrations, label) {
  const byVersion = new Map();
  const files = [];
  for (const migration of migrations) {
    const file = `${migration.version}_${migration.name}.sql`;
    assert.match(file, MIGRATION_FILE, `${label} migration identity is not canonical.`);
    if (migration.file !== undefined) assert.equal(migration.file, file, `${label} migration filename/identity mismatch.`);
    assert.equal(byVersion.has(migration.version), false, `${label} has duplicate migration provenance.`);
    assert.equal(typeof migration.sql, "string");
    const sql = migration.sql.replace(/\r\n?/gu, "\n");
    const sha256 = digest(sql);
    if (migration.sha256 !== undefined) assert.equal(migration.sha256, sha256, `${label} migration checksum mismatch.`);
    byVersion.set(migration.version, { ...migration, file, sql, sha256 });
    files.push(file);
  }
  assert.deepEqual(files, [...files].sort(), `${label} execution ordering must be deterministic.`);
  return byVersion;
}

/**
 * Pure verification of independent historical, committed, working and revision
 * evidence. No count/date heuristic, migration-name exemption or copied ledger.
 * @param {{historical:Array<MigrationSource & {file?:string}>,committed:Array<MigrationSource & {file?:string}>,current:Array<MigrationSource & {file?:string}>,compatibilities:MigrationCompatibilityRecord[]}} input
 */
export function verifyMigrationCorpusProvenance({ historical, committed, current, compatibilities }) {
  const old = corpusByVersion(historical, "Historical");
  const head = corpusByVersion(committed, "Committed");
  const working = corpusByVersion(current, "Current");
  assert.ok(old.size > 0, "Historical migration membership evidence is empty.");
  assert.deepEqual([...working.keys()], [...head.keys()], "Unknown insertion or missing current migration: corpus must match committed Git membership.");
  for (const [version, migration] of working) {
    const recorded = head.get(version);
    assert.equal(migration.file, recorded.file, "Current migration identity differs from committed evidence.");
    assert.equal(migration.sha256, recorded.sha256, "Current migration checksum differs from committed evidence.");
  }

  const revisions = new Map();
  for (const record of compatibilities) {
    assert.equal(revisions.has(record.version), false, "Duplicate or ambiguous compatibility provenance.");
    assert.match(record.historicalSourceSha256, SHA256);
    assert.match(record.correctedSourceSha256, SHA256);
    assert.notEqual(record.historicalSourceSha256, record.correctedSourceSha256, "Ambiguous compatibility revision hashes.");
    const original = old.get(record.version);
    assert.ok(original, "Compatibility revision has no historical snapshot member.");
    assert.equal(record.name, original.name, "Historical compatibility identity mismatch.");
    assert.ok([record.historicalSourceSha256, record.correctedSourceSha256].includes(original.sha256),
      "Compatibility revision does not recognize the immutable Git snapshot checksum.");
    revisions.set(record.version, record);
  }

  let unchangedHistoricalMembers = 0;
  let approvedHistoricalRevisions = 0;
  for (const [version, original] of old) {
    const migration = working.get(version);
    assert.ok(migration, "Missing historical migration member.");
    assert.equal(migration.file, original.file, "Historical migration identity changed.");
    const revision = revisions.get(version);
    if (revision) {
      assert.equal(migration.sha256, revision.correctedSourceSha256, "Unapproved historical migration revision.");
    } else {
      assert.equal(migration.sha256, original.sha256, "Unknown historical SQL/checksum mutation.");
    }
    if (migration.sha256 === original.sha256) unchangedHistoricalMembers++;
    else approvedHistoricalRevisions++;
  }
  const currentAdditions = [...working.values()].filter(migration => !old.has(migration.version))
    .map(({ version, name, sha256 }) => ({ version, name, sourceSha256: sha256 }));
  return { historicalMembers: old.size, unchangedHistoricalMembers, approvedHistoricalRevisions,
    currentMembers: working.size, currentAdditions };
}

/** Structural evidence only; registry verification remains a separate live contract. */
export function assertMigrationCorpusProvenance({ migrations, snapshotCommit, historicalCount, root = ROOT }) {
  const evidence = loadGitMigrationCorpusEvidence({ root, snapshotCommit });
  assert.equal(evidence.historical.length, historicalCount, "Documented historical migration count differs from its immutable Git tree.");
  const compatibilities = readRecords().map(record => loadMigrationHistoryCompatibility(record.version));
  const proof = verifyMigrationCorpusProvenance({
    historical: evidence.historical, committed: evidence.committed, current: migrations, compatibilities,
  });
  assert.equal(gitEvidence(root, ["rev-parse", "HEAD"]).trim(), evidence.headCommit, "HEAD changed during migration provenance verification.");
  return { snapshotCommit, headCommit: evidence.headCommit, ...proof };
}
