import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMigrationCorpusProvenance,
  assertMigrationSourceProvenance,
  assertWholeFileMigrationProvenance,
  classifyWholeFileMigrationProvenance,
  getMigrationHistoryCompatibilityVersions,
  loadGitMigrationCorpusEvidence,
  loadMigrationHistoryCompatibility,
  verifyMigrationCorpusProvenance,
  verifyMigrationHistoryCompatibilitySources,
} from "./lib/migration-provenance.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalize = (value) => value.replace(/\r\n?/gu, "\n");

/** Corpus membership is historical Git evidence, never a timestamp/name exception. */
export function verifyMigrationCorpusProvenanceTests() {
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  const fails = (callback, message) => { assert.throws(callback, undefined, message); checks++; };
  const migration = (version, name, sql) => ({
    file: `${version}_${name}.sql`, version, name, sql: normalize(sql), sha256: digest(normalize(sql)),
  });
  const first = migration("20200102000000", "first", "select 1;\n");
  const second = migration("20200103000000", "second", "select 2;\n");
  const historical = [first, second];
  const unchangedInput = { historical, committed: [...historical], current: [...historical], compatibilities: [] };
  const untouched = JSON.stringify(unchangedInput);
  const unchanged = verifyMigrationCorpusProvenance(unchangedInput);
  check(unchanged.historicalMembers === 2 && unchanged.unchangedHistoricalMembers === 2
    && unchanged.approvedHistoricalRevisions === 0 && unchanged.currentMembers === 2
    && unchanged.currentAdditions.length === 0, "Exact historical membership/source remains valid without a compatibility exception.");
  check(JSON.stringify(unchangedInput) === untouched, "Corpus verification never rewrites historical, committed or current inputs.");

  const addition = migration("20200101000000", "arbitrary_dependency_name", "select 3;\n");
  const expanded = [addition, ...historical];
  const added = verifyMigrationCorpusProvenance({ historical, committed: expanded, current: expanded, compatibilities: [] });
  check(added.historicalMembers === 2 && added.currentMembers === 3 && added.unchangedHistoricalMembers === 2,
    "A legitimate committed dependency-ordered addition can precede the historical timestamp range.");
  check(JSON.stringify(added.currentAdditions) === JSON.stringify([
    { version: addition.version, name: addition.name, sourceSha256: addition.sha256 },
  ]), "The new member is identified by committed source provenance, without a name exception.");
  fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, current: expanded }),
    "An uncommitted inserted migration cannot acquire provenance from its timestamp or canonical filename.");
  fails(() => verifyMigrationCorpusProvenance({ historical, committed: [second], current: [second], compatibilities: [] }),
    "Deleting a historical member from both HEAD and current source does not erase snapshot membership.");
  fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, current: [first] }),
    "A missing current historical member fails even if it remains committed.");

  const revised = migration(first.version, first.name, "select 11;\n");
  const revisedCorpus = [revised, second];
  fails(() => verifyMigrationCorpusProvenance({ historical, committed: revisedCorpus, current: revisedCorpus, compatibilities: [] }),
    "Committing an altered historical migration alone cannot approve its source change.");
  const compatibility = {
    version: first.version, name: first.name,
    historicalSourceSha256: first.sha256, correctedSourceSha256: revised.sha256,
    reason: "Bounded synthetic revision proof.",
    existingDatabasePolicy: "preserve-recorded-revision-without-replay-or-registry-rewrite",
    freshDatabasePolicy: "execute-corrected-canonical-source",
  };
  const approved = verifyMigrationCorpusProvenance({ historical, committed: revisedCorpus, current: revisedCorpus, compatibilities: [compatibility] });
  check(approved.approvedHistoricalRevisions === 1 && approved.unchangedHistoricalMembers === 1,
    "Only the exact separately approved historical/corrected identity pair can replace historical source.");
  const correctedSnapshot = verifyMigrationCorpusProvenance({ historical: revisedCorpus,
    committed: revisedCorpus, current: revisedCorpus, compatibilities: [compatibility] });
  check(correctedSnapshot.historicalMembers === 2 && correctedSnapshot.unchangedHistoricalMembers === 2
    && correctedSnapshot.approvedHistoricalRevisions === 0 && correctedSnapshot.currentAdditions.length === 0,
  "A later historical snapshot that already contains the frozen corrected source is unchanged, not another revision application.");
  const third = migration(first.version, first.name, "select 111;\n");
  fails(() => verifyMigrationCorpusProvenance({ historical, committed: [third, second], current: [third, second], compatibilities: [compatibility] }),
    "An unapproved third historical revision fails even after being committed.");
  fails(() => verifyMigrationCorpusProvenance({ historical: [third, second], committed: revisedCorpus,
    current: revisedCorpus, compatibilities: [compatibility] }),
  "A third snapshot hash cannot become approved history merely because current source has the corrected hash.");
  fails(() => verifyMigrationCorpusProvenance({ historical, committed: revisedCorpus, current: revisedCorpus,
    compatibilities: [{ ...compatibility, historicalSourceSha256: second.sha256 }] }),
    "A compatibility record cannot replace the actual snapshot source identity.");
  for (const property of ["historical", "committed", "current"]) {
    fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, [property]: [first, first, second] }),
      `Duplicate ${property} provenance is ambiguous.`);
    const duplicateVersion = migration(first.version, "different_name", first.sql);
    fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, [property]: [first, duplicateVersion, second] }),
      `Duplicate ${property} version cannot be hidden behind another filename.`);
  }
  for (const records of [
    [compatibility, { ...compatibility }],
    [compatibility, { ...compatibility, correctedSourceSha256: third.sha256 }],
    [{ ...compatibility, correctedSourceSha256: first.sha256 }],
  ]) {
    fails(() => verifyMigrationCorpusProvenance({ historical, committed: revisedCorpus, current: revisedCorpus, compatibilities: records }),
      "Duplicate, ambiguous or indistinguishable compatibility identities fail closed.");
  }
  fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, current: [second, first] }),
    "Current execution ordering must be deterministic and canonical.");
  fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, current: [{ ...first, sha256: second.sha256 }, second] }),
    "A claimed hash cannot conceal different SQL bytes.");
  fails(() => verifyMigrationCorpusProvenance({ ...unchangedInput, current: [{ ...first, file: second.file }, second] }),
    "Canonical basename, version and name must describe the same migration.");

  // Bind the repository's dated snapshot to its exact documented Git object.
  const state = readFileSync(join(ROOT, "docs/CURRENT_PROJECT_STATE.md"), "utf8");
  const stateRow = (label) => state.split(/\r?\n/u).map(line => line.split("|").map(cell => cell.trim()))
    .find(cells => cells[1] === label)?.[2];
  const snapshotCommit = /^`([a-f0-9]{40})`$/u.exec(stateRow("Verified cutover baseline") ?? "")?.[1];
  assert.ok(snapshotCommit, "The verified cutover row must record an immutable Git SHA.");
  const countText = stateRow("Repository migration files");
  assert.match(countText ?? "", /^\d+$/u);
  const historicalCount = Number(countText);
  const current = readdirSync(join(ROOT, "sql/migrations")).filter(file => file.endsWith(".sql")).sort().map(file => {
    const match = /^(\d{14})_([a-z0-9_]+)\.sql$/u.exec(file);
    assert.ok(match, "The current corpus contains a noncanonical SQL file.");
    return migration(match[1], match[2], readFileSync(join(ROOT, "sql/migrations", file), "utf8"));
  });
  const compatibilities = getMigrationHistoryCompatibilityVersions().map(version => loadMigrationHistoryCompatibility(version));
  const actual = assertMigrationCorpusProvenance({ migrations: current, snapshotCommit, historicalCount, root: ROOT });
  const evidence = loadGitMigrationCorpusEvidence({ root: ROOT, snapshotCommit });
  const currentByVersion = new Map(current.map(row => [row.version, row]));
  const compatibilityByVersion = new Map(compatibilities.map(record => [record.version, record]));
  const expectedRevisions = evidence.historical.filter(row => {
    const present = currentByVersion.get(row.version);
    const compatibility = compatibilityByVersion.get(row.version);
    return present?.sha256 !== row.sha256 && compatibility?.name === row.name
      && compatibility.historicalSourceSha256 === row.sha256
      && compatibility.correctedSourceSha256 === present?.sha256;
  }).length;
  check(actual.historicalMembers === historicalCount && actual.currentMembers === current.length
    && actual.approvedHistoricalRevisions === expectedRevisions
    && actual.unchangedHistoricalMembers === historicalCount - expectedRevisions,
  "The real documented historical corpus and current committed corpus recognize all and only approved revisions.");
  check(actual.currentAdditions.length === current.length - historicalCount,
    "Real additions are complete membership differences, not a timestamp-prefix count.");
  check(evidence.snapshotCommit === snapshotCommit && /^[a-f0-9]{40}$/u.test(evidence.headCommit),
    "Git evidence identifies both immutable historical and current HEAD commits.");

  // Tiny offline repository proves Git-object availability, ancestry and LF
  // normalization through the real loader, without editing this checkout.
  const temporaryParent = realpathSync(tmpdir());
  const temporaryRoot = mkdtempSync(join(temporaryParent, "migration-corpus-proof-"));
  const canonicalTemporaryRoot = realpathSync(temporaryRoot);
  const cleanEnvironment = {};
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "PATHEXT", "TEMP", "TMP"]) {
    if (process.env[key]) cleanEnvironment[key] = process.env[key];
  }
  const globalConfig = join(temporaryRoot, "empty-global-git-config");
  const hooks = join(temporaryRoot, "empty-hooks");
  const localGit = (...args) => execFileSync("git", [
    "-c", "user.name=Migration Corpus QA", "-c", "user.email=migration-corpus-qa@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", "-c", "core.safecrlf=false",
    "-c", `core.hooksPath=${hooks}`, ...args,
  ], { cwd: temporaryRoot, encoding: "utf8", windowsHide: true, timeout: 15_000,
    env: { ...cleanEnvironment, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: globalConfig,
      GIT_TERMINAL_PROMPT: "0", GIT_NO_REPLACE_OBJECTS: "1" }, stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    assert.equal(dirname(canonicalTemporaryRoot), temporaryParent);
    writeFileSync(globalConfig, "", { flag: "wx" }); mkdirSync(hooks);
    mkdirSync(join(temporaryRoot, "sql/migrations"), { recursive: true });
    localGit("init", "--quiet", "--initial-branch=main");
    writeFileSync(join(temporaryRoot, "sql/migrations", first.file), first.sql.replaceAll("\n", "\r\n"), { flag: "wx" });
    localGit("add", "--", `sql/migrations/${first.file}`);
    localGit("commit", "--quiet", "-m", "Historical fixture source");
    const historicalCommit = localGit("rev-parse", "HEAD");
    writeFileSync(join(temporaryRoot, "sql/migrations", addition.file), addition.sql, { flag: "wx" });
    localGit("add", "--", `sql/migrations/${addition.file}`);
    localGit("commit", "--quiet", "-m", "Committed dependency-ordered fixture addition");
    const committedHead = localGit("rev-parse", "HEAD");
    const captured = loadGitMigrationCorpusEvidence({ root: temporaryRoot, snapshotCommit: historicalCommit });
    check(captured.headCommit === committedHead && captured.snapshotCommit === historicalCommit,
      "The loader reports the actual owned repository HEAD and the requested snapshot.");
    check(captured.historical.length === 1 && captured.committed.length === 2
      && captured.historical[0].sql === first.sql && captured.historical[0].sha256 === first.sha256,
    "Git blob evidence normalizes CRLF to LF before comparing exact SQL provenance.");
    const fixtureProof = verifyMigrationCorpusProvenance({ historical: captured.historical,
      committed: captured.committed, current: [addition, first], compatibilities: [] });
    check(fixtureProof.currentAdditions.length === 1 && fixtureProof.currentAdditions[0].version === addition.version,
      "The real Git loader and pure verifier accept the committed backdated addition together.");
    fails(() => loadGitMigrationCorpusEvidence({ root: temporaryRoot, snapshotCommit: "0".repeat(40) }),
      "A missing historical Git object fails closed without network fallback.");
    localGit("checkout", "--quiet", "--orphan", "disconnected-history");
    localGit("commit", "--quiet", "--allow-empty", "-m", "Unrelated fixture history");
    fails(() => loadGitMigrationCorpusEvidence({ root: temporaryRoot, snapshotCommit: historicalCommit }),
      "An available historical object outside current HEAD ancestry fails closed.");
  } finally {
    assert.equal(realpathSync(temporaryRoot), canonicalTemporaryRoot);
    assert.equal(dirname(canonicalTemporaryRoot), temporaryParent);
    assert.ok(canonicalTemporaryRoot.startsWith(join(temporaryParent, "migration-corpus-proof-")));
    rmSync(canonicalTemporaryRoot, { recursive: true, force: false });
  }
  check(!existsSync(temporaryRoot), "Only the uniquely owned temporary Git fixture is removed.");
  return { checks, historicalMembers: actual.historicalMembers, currentMembers: actual.currentMembers,
    approvedHistoricalRevisions: actual.approvedHistoricalRevisions, additions: actual.currentAdditions.length,
    databaseAccess: false, networkAccess: false, temporaryGitFixtureCleaned: true };
}

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
  const superseded = contract.supersededFreshSql === undefined ? undefined
    : { ...old, statements: [contract.supersededFreshSql] };
  const revised = { ...old, statements: [contract.correctedSql] };
  const before = JSON.stringify([migration, old, superseded, revised]);
  check(assertWholeFileMigrationProvenance(old, migration).revision === "historical-applied", "Original applied SQL retains its actual revision identity.");
  if (superseded !== undefined) {
    const provenance = assertWholeFileMigrationProvenance(superseded, migration);
    check(provenance.revision === "fresh-bootstrap-superseded"
      && provenance.sourceSha256 === contract.supersededFreshSourceSha256,
    "Superseded fresh SQL retains its exact historical execution identity.");
  }
  check(assertWholeFileMigrationProvenance(revised, migration).revision === "fresh-bootstrap-corrected", "Corrected SQL has a distinct source identity.");
  check(JSON.stringify([migration, old, superseded, revised]) === before, "Provenance verification never rewrites its inputs.");
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
  if (contract.supersededFreshSql !== undefined) {
    fails(() => verifyMigrationHistoryCompatibilitySources(contract, contract.historicalSql, contract.correctedSql,
      `${contract.supersededFreshSql}\n`), "Superseded fresh archive drift is rejected.");
    fails(() => verifyMigrationHistoryCompatibilitySources(contract, contract.historicalSql, contract.correctedSql),
      "A declared superseded fresh revision requires its immutable archive.");
  }
  fails(() => verifyMigrationHistoryCompatibilitySources({ ...contract, correctedSourceSha256: contract.historicalSourceSha256 }, contract.historicalSql, contract.correctedSql), "Ambiguous revision identities are rejected.");
  const unrelated = { version: "19990101000000", name: "unrelated", sql: "select 1;\n" };
  check(assertWholeFileMigrationProvenance({ ...unrelated, statements: [unrelated.sql] }, unrelated).revision === "canonical-current", "Unrelated migrations retain exact current SQL provenance.");
  fails(() => assertWholeFileMigrationProvenance({ ...unrelated, statements: [contract.historicalSql] }, unrelated), "Historical compatibility never applies to another version.");
  for (const otherVersion of allVersions.filter(value => value !== version)) {
    const other = loadMigrationHistoryCompatibility(otherVersion);
    fails(() => assertWholeFileMigrationProvenance({ ...old, statements: [other.historicalSql] }, migration), "Compatibility source from another reviewed version is never accepted.");
  }
  }
  const corpus = selectedVersion === undefined ? verifyMigrationCorpusProvenanceTests() : undefined;
  return { checks: checks + (corpus?.checks ?? 0), compatibilityVersions: versions,
    ...(corpus ? { corpus } : {}), databaseAccess: false, registryWrites: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 2 && args[0] === "--version" && /^\d{14}$/u.test(args[1]), "Expected optional --version <canonical version>.");
  console.log(JSON.stringify(verifyMigrationHistoryCompatibility(args[1])));
}
