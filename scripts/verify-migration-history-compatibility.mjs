import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMigrationSourceProvenance,
  assertWholeFileMigrationProvenance,
  classifyWholeFileMigrationProvenance,
  getMigrationHistoryCompatibilityVersions,
  loadMigrationHistoryCompatibility,
  verifyMigrationHistoryCompatibilitySources,
} from "./lib/migration-provenance.mjs";

export function verifyMigrationHistoryCompatibility(selectedVersion) {
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  const fails = (callback, message) => { assert.throws(callback, undefined, message); checks++; };
  const allVersions = getMigrationHistoryCompatibilityVersions();
  if (selectedVersion !== undefined) assert.ok(allVersions.includes(selectedVersion), "Unknown selected compatibility version.");
  const versions = selectedVersion === undefined ? allVersions : [selectedVersion];
  if (selectedVersion === undefined) {
    check(loadMigrationHistoryCompatibility().version === versions[0], "The original no-argument Project compatibility API remains unchanged.");
    fails(() => loadMigrationHistoryCompatibility("19990101000000"), "Unreviewed versions cannot acquire a compatibility revision.");
  }
  for (const version of versions) {
  const contract = loadMigrationHistoryCompatibility(version);
  const migration = { version: contract.version, name: contract.name, sql: contract.correctedSql, sha256: contract.correctedSourceSha256 };
  const old = { version: contract.version, name: contract.name, statements: [contract.historicalSql] };
  const revised = { ...old, statements: [contract.correctedSql] };
  const before = JSON.stringify([migration, old, revised]);
  check(assertWholeFileMigrationProvenance(old, migration).revision === "historical-applied", "Original applied SQL retains its actual revision identity.");
  check(assertWholeFileMigrationProvenance(revised, migration).revision === "fresh-bootstrap-corrected", "Corrected SQL has a distinct source identity.");
  check(JSON.stringify([migration, old, revised]) === before, "Provenance verification never rewrites its inputs.");
  for (const row of [
    { ...old, name: `${old.name}_wrong` },
    { ...old, version: "19990101000000" },
    { ...old, statements: [`${contract.historicalSql}\n`] },
    { ...old, statements: [`${contract.correctedSql}\n`] },
    { ...old, statements: [contract.historicalSql, contract.correctedSql] },
    { ...old, statements: [contract.historicalSql.replaceAll("\n", "\r\n")] },
    { ...old, statements: [] },
    { ...old, statements: null },
  ]) {
    check(classifyWholeFileMigrationProvenance(row, migration) === null, "Unknown name/version/bytes/statement representation is not recognized.");
    fails(() => assertWholeFileMigrationProvenance(row, migration), "Unknown provenance fails closed.");
  }
  fails(() => assertMigrationSourceProvenance({ ...migration, sql: contract.historicalSql, sha256: contract.historicalSourceSha256 }), "The historical revision cannot become executable current source.");
  fails(() => assertMigrationSourceProvenance({ ...migration, name: "wrong" }), "Current source name is frozen.");
  fails(() => assertMigrationSourceProvenance({ ...migration, sha256: "0".repeat(64) }), "Caller-supplied current hash cannot override source bytes.");
  fails(() => verifyMigrationHistoryCompatibilitySources(contract, `${contract.historicalSql}\n`, contract.correctedSql), "Archive drift is rejected.");
  fails(() => verifyMigrationHistoryCompatibilitySources(contract, contract.historicalSql, `${contract.correctedSql}\n`), "Corrected source drift is rejected.");
  fails(() => verifyMigrationHistoryCompatibilitySources({ ...contract, correctedSourceSha256: contract.historicalSourceSha256 }, contract.historicalSql, contract.correctedSql), "Ambiguous revision identities are rejected.");
  const unrelated = { version: "19990101000000", name: "unrelated", sql: "select 1;\n" };
  check(assertWholeFileMigrationProvenance({ ...unrelated, statements: [unrelated.sql] }, unrelated).revision === "canonical-current", "Unrelated migrations retain exact current SQL provenance.");
  fails(() => assertWholeFileMigrationProvenance({ ...unrelated, statements: [contract.historicalSql] }, unrelated), "Historical compatibility never applies to another version.");
  for (const otherVersion of allVersions.filter(value => value !== version)) {
    const other = loadMigrationHistoryCompatibility(otherVersion);
    fails(() => assertWholeFileMigrationProvenance({ ...old, statements: [other.historicalSql] }, migration), "Compatibility source from another reviewed version is never accepted.");
  }
  }
  return { checks, compatibilityVersions: versions, databaseAccess: false, registryWrites: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 2 && args[0] === "--version" && /^\d{14}$/u.test(args[1]), "Expected optional --version <canonical version>.");
  console.log(JSON.stringify(verifyMigrationHistoryCompatibility(args[1])));
}
