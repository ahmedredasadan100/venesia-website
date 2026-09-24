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

function splitCanonicalStatements(sql) {
  const statements = [];
  let start = 0;
  let offset = 0;
  while (offset < sql.length) {
    if (sql.startsWith("--", offset)) {
      const newline = sql.indexOf("\n", offset + 2);
      offset = newline < 0 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith("/*", offset)) {
      let depth = 1;
      offset += 2;
      while (offset < sql.length && depth > 0) {
        if (sql.startsWith("/*", offset)) { depth++; offset += 2; }
        else if (sql.startsWith("*/", offset)) { depth--; offset += 2; }
        else offset++;
      }
      assert.equal(depth, 0, "Canonical SQL has an unterminated block comment.");
      continue;
    }
    if (sql[offset] === "'" || sql[offset] === "\"") {
      const quote = sql[offset++];
      while (offset < sql.length) {
        if (sql[offset] !== quote) { offset++; continue; }
        if (sql[offset + 1] === quote) { offset += 2; continue; }
        offset++;
        break;
      }
      continue;
    }
    if (sql[offset] === "$") {
      const tag = /^\$(?:[a-z_][a-z0-9_]*)?\$/iu.exec(sql.slice(offset))?.[0];
      if (tag !== undefined) {
        const close = sql.indexOf(tag, offset + tag.length);
        assert.ok(close >= 0, "Canonical SQL has an unterminated dollar quote.");
        offset = close + tag.length;
        continue;
      }
    }
    if (sql[offset] !== ";") { offset++; continue; }
    statements.push(sql.slice(start, offset));
    offset++;
    while (offset < sql.length && /\s/u.test(sql[offset])) offset++;
    start = offset;
  }
  assert.equal(sql.slice(start), "", "Canonical SQL has unterminated executable bytes.");
  assert.ok(statements.every(statement => statement.length > 0), "Canonical SQL has an empty statement.");
  return statements;
}

function verifyCanonicalRegistryRepresentations() {
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  const expected = [
    ["20260819040000", "database_rls_security_contract", 3, "supabase-cli-v2.116-three-statement",
      "c0b1d13cfb49256a9811c7e6d97c94fe0e35f102a8b862e336c0f5d71a310587", "409b501179fc89d8442b09554c2f85f595e99ed3e678d81124c88cf596e31637"],
    ["20260916201230", "database_rls_post_platform_classification", 3, "canonical-statement-array-with-source-trivia-v1",
      "aafc443cc836c4186e9f85684cc0a352e7078b620e465be98bae625006509805", "19f6d457df2106777a91a6434ad80cfb74470bb4c16e7490b79dc00b0350f82b"],
    ["20260920010000", "public_feed_aggregated_reads", 8, "canonical-statement-array-with-source-trivia-v1",
      "b3482df9a29f3be2a30ca8897745dbde58d74df68399cc45c7fd2753f6062d73", "c0c73d1fd71300df3d0cf4807488ee3c285df49e4a1f47a2effb937e4f1b8627"],
    ["20260920011000", "page_composition_layout_regions", 36, "canonical-statement-array-with-source-trivia-v1",
      "c6b4d4b817a75dfe0f53ea55efabe4e824dd0885506f0e0a6d13a00ebda21645", "f024e3fda109b47c2251fc5ef6d4da49f2b4142fa697a5c50629d7241ec1c67c"],
  ];
  const reports = [];
  for (const [version, name, statementCount, kind, statementArraySha256, sourceSha256] of expected) {
    const sql = normalize(readFileSync(join(ROOT, "sql/migrations", `${version}_${name}.sql`), "utf8"));
    const migration = { version, name, sql, sha256: digest(sql) };
    const statements = splitCanonicalStatements(sql);
    const row = { version, name, statements };
    const before = JSON.stringify([migration, row]);
    check(statements.length === statementCount && digest(JSON.stringify(statements)) === statementArraySha256,
      `Canonical ${version} projects to the frozen ordered Production statement array.`);
    const provenance = assertWholeFileMigrationProvenance(row, migration);
    check(provenance.revision === "canonical-current" && provenance.registryRepresentation === kind
      && provenance.statementArraySha256 === statementArraySha256 && provenance.sourceSha256 === sourceSha256,
    `The exact Production receipt resolves to canonical ${version}.`);
    check(JSON.stringify([migration, row]) === before, `Canonical ${version} verification never mutates its inputs.`);

    check(classifyWholeFileMigrationProvenance({ ...row, statements: statements.slice(0, -1) }, migration) === null,
      `Wrong statement count fails closed for ${version}.`);
    check(classifyWholeFileMigrationProvenance({ ...row,
      statements: statements.map((statement, index) => index === 1 ? `${statement} ` : statement) }, migration) === null,
    `An altered statement fails closed for ${version}.`);
    const reordered = [...statements];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    check(classifyWholeFileMigrationProvenance({ ...row, statements: reordered }, migration) === null,
      `Reordered statements fail closed for ${version}.`);
    const differentlySegmented = [...statements];
    differentlySegmented[0] = `${differentlySegmented[0]};`;
    check(digest(JSON.stringify(differentlySegmented)) !== statementArraySha256
      && classifyWholeFileMigrationProvenance({ ...row, statements: differentlySegmented }, migration) === null,
    `A different statement-array hash fails closed for ${version} even when canonical bytes can be reconstructed.`);
    const changedSql = `${statements[0]};\nselect 'unregistered executable token';\n${sql.slice(statements[0].length + 2)}`;
    check(classifyWholeFileMigrationProvenance(row,
      { ...migration, sql: changedSql, sha256: digest(changedSql) }) === null,
    `A reconstruction/source mismatch fails closed for ${version}.`);
    check(classifyWholeFileMigrationProvenance({ ...row, version: "19990101000000" }, migration) === null,
      `The exact receipt cannot authorize another version for ${version}.`);
    check(classifyWholeFileMigrationProvenance({ ...row, name: `${name}_wrong` }, migration) === null,
      `The exact receipt cannot authorize another name for ${version}.`);
    reports.push({ version, statementCount, statementArraySha256, sourceSha256, kind });
  }
  return { checks, reports };
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
  const canonicalRegistryRepresentations = verifyCanonicalRegistryRepresentations();
  const corpus = selectedVersion === undefined ? verifyMigrationCorpusProvenanceTests() : undefined;
  return { checks: checks + canonicalRegistryRepresentations.checks + (corpus?.checks ?? 0), compatibilityVersions: versions,
    canonicalRegistryRepresentations, ...(corpus ? { corpus } : {}), databaseAccess: false, registryWrites: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 2 && args[0] === "--version" && /^\d{14}$/u.test(args[1]), "Expected optional --version <canonical version>.");
  console.log(JSON.stringify(verifyMigrationHistoryCompatibility(args[1])));
}
