import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RECORD = join(ROOT, "scripts/lib/migration-history-compatibility.json");
const SHA256 = /^[a-f0-9]{64}$/u;
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
