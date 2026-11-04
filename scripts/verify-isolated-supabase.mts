import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { constants as fsConstants, unlinkSync } from "node:fs";
import * as asyncFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer, type IncomingMessage } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import sharp from "sharp";
import { verifyIsolatedApplicationCliPulse } from "./verify-isolated-application-cli-pulse.mjs";
import { verifyApplicationClosureCheckpointsOffline } from "./verify-application-closure-checkpoints.mts";
import { selectSourceInventory, sourceIncluded } from "./lib/verification-source-inventory.mts";
import { collectExecutableSourceGraph } from "./lib/typescript-executable-graph.mts";
import { windowsOwnedProcessCapability, spawnWindowsOwnedProcess, requestWindowsClosureCheckpoint,
  startWindowsClosureObservation, qualifyWindowsClosureEvidence } from "./lib/windows-owned-process.mts";
import type { LocalVerificationInputObservations } from "./lib/isolated-public-verification.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const cases: string[] = [];
let qualifiedFormDiagnosticCost: Record<string, unknown> | null = null;

function check(name: string, run: () => void) {
  try { run(); } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
  cases.push(name);
}

function readSource(relative: string) {
  assert.ok(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes(".."));
  return readFileSync(path.join(root, relative), "utf8");
}

/** Pure existing selection declarations only; no fixture modules or seeds execute. */
function adminAdoptionControlSource(owner: ts.SourceFile) {
  const rows: string[] = [];
  for (const [file, names] of [
    ["scripts/fixtures/admin-core-domain-form-journeys.mjs", ["validateCoreJourneySelection"]],
    ["scripts/fixtures/admin-core-preview-journeys.mjs", ["CORE_PREVIEW_PUBLIC_IMPACT_SELECTION", "validateCorePreviewPublicImpactSelection"]],
  ] as const) {
    const parsed = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const wanted = new Set<string>(names);
    const selected = parsed.statements.filter(node => ts.isFunctionDeclaration(node) ? wanted.has(node.name?.text ?? "")
      : ts.isVariableStatement(node) && node.declarationList.declarations.some(value => wanted.has(value.name.getText(parsed))));
    assert.equal(selected.length, names.length);
    rows.push(...selected.map(node => node.getText(parsed).replace(/^export /u, "")));
  }
  for (const name of ["adminAdoptionGate", "localVerificationNativeGate"]) {
    const selected = owner.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(selected.length, 1); rows.push(selected[0].getText(owner).replace(/^export /u, ""));
  }
  return rows.join("\n");
}

/** Inspect executable module references and SQL literals, not comments or locked upstream SQL. */
function sourceFailures(source: string, filename: string): string[] {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const failures = new Set<string>();
  function moduleReference(node: ts.Node | undefined) {
    // The fixed local fixture module uses a SHA256 query solely to refresh Node's
    // module cache between owned attempts. The path itself cannot be supplied by a caller.
    if (node && ts.isPropertyAccessExpression(node) && node.name.text === "href"
      && ts.isNewExpression(node.expression) && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === "URL" && node.expression.arguments?.length === 2) {
      const [path, base] = node.expression.arguments;
      if (ts.isTemplateExpression(path) && path.head.text === "../fixtures/admin-interaction-fixtures.mts?fixture="
        && path.templateSpans.length === 1 && ts.isIdentifier(path.templateSpans[0].expression)
        && path.templateSpans[0].expression.text === "fixtureHash" && path.templateSpans[0].literal.text === ""
        && ts.isPropertyAccessExpression(base) && base.name.text === "url"
        && ts.isMetaProperty(base.expression) && base.expression.keywordToken === ts.SyntaxKind.ImportKeyword
        && base.expression.name.text === "meta") return;
    }
    if (!node || !ts.isStringLiteralLike(node)) {
      failures.add("dynamic-module-reference");
      return;
    }
    if (/(?:^|[\\/])\.tmp-qa(?:[\\/]|$)/i.test(node.text)) failures.add("historical-executable-import");
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) moduleReference(node.moduleSpecifier);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")) {
        moduleReference(node.arguments[0]);
      }
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const sql = node.text.replace(/"/g, "");
      if (/\b(?:CREATE|ALTER)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?storage\s*\.\s*(?:buckets|objects)\b/i.test(sql)) failures.add("local-storage-ddl");
      if (/\b(?:GRANT\s+[\s\S]+?\s+TO|REVOKE\s+[\s\S]+?\s+FROM|ALTER\s+(?:ROLE|USER|DATABASE)\b)/i.test(sql)) failures.add("local-permission-repair");
      if (/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:auth\.)?(?:uid|role|jwt)\s*\(/i.test(sql)) failures.add("local-auth-emulation");
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...failures].sort();
}

function assertLockedArtifactPath(relative: string) {
  assert.equal(typeof relative, "string");
  assert.ok(!path.isAbsolute(relative) && !relative.includes("\\"));
  assert.equal(path.posix.parse(relative).root, "");
  assert.equal(path.win32.parse(relative).root, "");
  assert.ok(!relative.split("/").some(part => part === ".." || part === ".git" || part === "node_modules" || part === ".tmp-qa"));
  assert.ok(!/(^|\/)\.env(?:\.|$)|(^|\/)debug\.log$/i.test(relative));
}

function verifyScanner() {
  const negative: Array<[string, string, string]> = [
    ["historical static import", 'import value from "../../.tmp-qa/old/bootstrap.cjs";', "historical-executable-import"],
    ["historical require", 'const value = require("../../.tmp-qa/old/bootstrap.cjs");', "historical-executable-import"],
    ["historical dynamic import", 'await import("../../.tmp-qa/old/bootstrap.cjs");', "historical-executable-import"],
    ["historical re-export", 'export { value } from "../../.tmp-qa/old/bootstrap.cjs";', "historical-executable-import"],
    ["nonliteral executable import", "await import(untrustedPath);", "dynamic-module-reference"],
    ["variable fixture path", 'await import(new URL(`../fixtures/${name}.mts?fixture=${fixtureHash}`, import.meta.url).href);', "dynamic-module-reference"],
    ["variable fixture identity", 'await import(new URL(`../fixtures/admin-interaction-fixtures.mts?fixture=${token}`, import.meta.url).href);', "dynamic-module-reference"],
    ["legacy bucket DDL", 'db.query("CREATE TABLE storage.buckets (id text)");', "local-storage-ddl"],
    ["legacy object DDL", 'db.query("ALTER TABLE storage.objects ADD COLUMN owner text");', "local-storage-ddl"],
    ["permission grant repair", 'db.query("GRANT CREATE ON DATABASE postgres TO postgres");', "local-permission-repair"],
    ["permission role repair", 'db.query("ALTER ROLE postgres SUPERUSER");', "local-permission-repair"],
    ["local Auth emulation", 'db.query("CREATE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT null $$ LANGUAGE SQL");', "local-auth-emulation"],
  ];
  for (const [name, source, expected] of negative) check(`source guard rejects ${name}`, () => assert.ok(sourceFailures(source, "negative.mts").includes(expected)));
  check("source guard allows canonical imports and read-only catalog queries", () => {
    assert.deepEqual(sourceFailures('import { value } from "./isolated-supabase.mts"; const sql = "select has_database_privilege(current_user, current_database(), \'CREATE\')";', "valid.mts"), []);
    assert.deepEqual(sourceFailures('await import(new URL(`../fixtures/admin-interaction-fixtures.mts?fixture=${fixtureHash}`, import.meta.url).href);', "valid.mts"), []);
  });
  check("source guard does not execute or classify historical comments as imports", () => {
    assert.deepEqual(sourceFailures('// Historical evidence: .tmp-qa/old/bootstrap.cjs; GRANT CREATE ON DATABASE postgres TO postgres\nconst ownedEvidenceDirectory = ".tmp-qa/current-owned";', "valid.mts"), []);
  });
  for (const candidate of ["../private.json", "C:/private.json", ".tmp-qa/old/bootstrap.sql", "node_modules/hidden.sql", ".env.local", "debug.log",
    "c:/private.json", "C:\\private.json", "C:private.json", "c:private.json",
    "//server/share/private.json", "\\\\server\\share\\private.json", "/private.json", "\\private.json",
    "folder/../private.json", "folder\\../private.json", "folder/..\\private.json", ".git/config"]) {
    check(`lock rejects unsafe artifact path ${candidate}`, () => assert.throws(() => assertLockedArtifactPath(candidate)));
  }
  const lock: StackLock = JSON.parse(readSource("scripts/fixtures/isolated-supabase/stack.lock.json"));
  for (const candidate of new Set([lock.compose.path, lock.transport.path, ...lock.files.map(file => file.path)])) {
    check(`lock allows canonical repository-relative artifact ${candidate}`, () => assertLockedArtifactPath(candidate));
  }
}

type StackLock = {
  schemaVersion: 1;
  release: { repository: string; commit: string; sourceBaseUrl: string };
  images: Record<string, { reference: string; manifestDigest: string; configDigest: string; indexDigest: string; platform: string }>;
  files: Array<{ path: string; sha256: string }>;
  compose: { path: string; sha256: string };
  transport: { path: string; sha256: string };
  applicationMigrationTool: import("./lib/isolated-supabase-cli.mts").ApplicationMigrationTool;
  applicationMigrationToolLinuxX64: import("./lib/isolated-supabase-cli.mts").ApplicationMigrationTool;
};

function verifyReleaseLock(): { lock: StackLock; hash: string } {
  const lockSource = readSource("scripts/fixtures/isolated-supabase/stack.lock.json");
  const lock: StackLock = JSON.parse(lockSource);
  check("release is the approved immutable upstream commit", () => {
    assert.equal(lock.schemaVersion, 1);
    assert.equal(lock.release.repository, "https://github.com/supabase/supabase");
    assert.equal(lock.release.commit, "8c7a4d9dbbaf8b552893822e89d7bf06f33f9220");
    assert.equal(lock.release.sourceBaseUrl, `https://raw.githubusercontent.com/supabase/supabase/${lock.release.commit}/`);
  });
  check("compose is hash-locked and contains exactly the approved immutable images", () => {
    assertLockedArtifactPath(lock.compose.path);
    const compose = readSource(lock.compose.path);
    assert.match(lock.compose.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(sha256(compose), lock.compose.sha256);
    assert.deepEqual(Object.keys(lock.images).sort(), ["api-gw", "db", "imgproxy", "rest", "storage"]);
    const references = [...compose.matchAll(/^\s+image:\s+(\S+)\s*$/gmu)].map(match => match[1]);
    assert.deepEqual(references.sort(), [...Object.values(lock.images).map(image => image.reference), lock.images.storage.reference].sort());
    for (const image of Object.values(lock.images)) {
      assert.equal(image.platform, "linux/amd64");
      for (const digest of [image.manifestDigest, image.configDigest, image.indexDigest]) assert.match(digest, /^sha256:[a-f0-9]{64}$/u);
      assert.match(image.reference, /^[a-z0-9/_-]+@sha256:[a-f0-9]{64}$/u);
      assert.ok(image.reference.endsWith(`@${image.manifestDigest}`));
    }
    assert.match(compose, /restart:\s*["']?no["']?/u);
    assert.match(compose, /internal:\s*true/u);
    assert.ok(!/^\s*(?:build|external|env_file|privileged|network_mode):/mu.test(compose));
    assert.ok(!/POSTGRES_USER:/u.test(compose), "Do not replace the official image's bootstrap role.");
    assert.ok(!/shared_preload_libraries/u.test(compose), "Do not replace official platform initialization with a local worker override.");
    assert.ok(!/^\s+ports:/mu.test(compose), "Internal-only services must not depend on ineffective Docker port publication.");
    const mountedSql = [...compose.matchAll(/\$\{UPSTREAM_ROOT:[^}]+\}\/([^:"\s]+\.sql):([^"\s]+):ro/gmu)].map(match => match[1]);
    const lockedSql = lock.files.filter(file => file.path.endsWith(".sql")).map(file => file.path);
    assert.deepEqual(mountedSql.sort(), lockedSql.sort(), "Every upstream SQL mount must be locked and read-only.");
  });
  check("all official source paths and hashes are immutable and unique", () => {
    assert.ok(lock.files.length > 0);
    assert.equal(new Set(lock.files.map(file => file.path)).size, lock.files.length);
    for (const file of lock.files) {
      assertLockedArtifactPath(file.path);
      assert.ok(file.path.startsWith("docker/"));
      assert.match(file.sha256, /^[a-f0-9]{64}$/u);
      const url = new URL(file.path, lock.release.sourceBaseUrl);
      assert.ok(url.href.startsWith(lock.release.sourceBaseUrl));
    }
  });
  check("the canonical QA transport module is source-hash locked", () => {
    assert.equal(lock.transport.path, "scripts/lib/isolated-supabase-transport.mjs");
    assert.match(lock.transport.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(sha256(readSource(lock.transport.path)), lock.transport.sha256);
  });
  return { lock, hash: sha256(lockSource) };
}

function verifyReleaseLockInputContracts(owner: Pick<typeof import("./lib/isolated-supabase.mts"), "readReleaseLock" | "IsolatedSupabaseError">,
  archiveInput?: (file: string, bytes: string) => void) {
  const input = readSource("scripts/fixtures/isolated-supabase/stack.lock.json"), expected = JSON.parse(input) as StackLock;
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "venisia-release-lock-inputs-"))), names: string[] = [];
  let serial = 0;
  const read = (bytes: string) => {
    const file = path.join(directory, "lock-" + ++serial + ".json");
    writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
    archiveInput?.(file, bytes);
    return owner.readReleaseLock(file);
  };
  try {
    const actual = read(input); assert.deepEqual(actual, expected);
    assert.equal(actual.schemaVersion, 1); assert.equal(actual.release.commit, expected.release.commit);
    assert.equal(actual.compose.sha256, sha256(readSource(actual.compose.path)));
    assert.equal(actual.transport.sha256, sha256(readSource(actual.transport.path)));
    names.push("actual current JSON bytes parse and validate through the existing release lock owner");
    const negative: Array<[string, string, (value: StackLock) => void]> = [
      ["schema drift", "UNAPPROVED_RELEASE", value => { Object.assign(value, { schemaVersion: 2 }); }],
      ["release drift", "UNAPPROVED_RELEASE", value => { value.release.commit = "0".repeat(40); }],
      ["release source drift", "INCOMPLETE_RELEASE_LOCK", value => { value.release.sourceBaseUrl = "https://example.invalid/"; }],
      ["missing upstream inputs", "INCOMPLETE_RELEASE_LOCK", value => { value.files = []; }],
      ["duplicate upstream input", "DUPLICATE_LOCK_PATH", value => { value.files.push({ ...value.files[0]! }); }],
      ["unsafe upstream path", "UNSAFE_UPSTREAM_PATH", value => { value.files[0]!.path = "docker/../outside.sql"; }],
      ["upstream digest drift", "UNSAFE_UPSTREAM_PATH", value => { value.files[0]!.sha256 = "unqualified"; }],
      ["missing image", "INVALID_IMAGE_SET", value => { delete value.images.db; }],
      ["mutable image", "UNPINNED_IMAGE", value => { value.images.db!.reference = "supabase/postgres:latest"; }],
      ["image config drift", "UNPINNED_IMAGE", value => { value.images.db!.configDigest = "unqualified"; }],
      ["image manifest mismatch", "UNPINNED_IMAGE", value => { value.images.db!.manifestDigest = "sha256:" + "0".repeat(64); }],
      ["compose content drift", "SOURCE_HASH_MISMATCH", value => { value.compose.sha256 = "0".repeat(64); }],
      ["transport content drift", "TRANSPORT_SOURCE_HASH_MISMATCH", value => { value.transport.sha256 = "0".repeat(64); }],
      ["transport owner substitution", "TRANSPORT_SOURCE_HASH_MISMATCH", value => { value.transport.path = "scripts/qa-isolated-supabase-transport.mjs"; }],
    ];
    for (const [name, code, mutate] of negative) {
      const changed = structuredClone(expected); mutate(changed);
      assert.throws(() => read(JSON.stringify(changed)), error => error instanceof owner.IsolatedSupabaseError && error.code === code);
      names.push(name);
    }
    assert.throws(() => read("{"), SyntaxError); names.push("malformed JSON rejects before any lifecycle entry");
    assert.equal(readSource("scripts/fixtures/isolated-supabase/stack.lock.json"), input);
  } finally {
    assert.equal(path.dirname(directory), realpathSync(tmpdir())); assert.ok(path.basename(directory).startsWith("venisia-release-lock-inputs-"));
    assert.equal(realpathSync(directory), directory); rmSync(directory, { recursive: true, force: false }); assert.equal(existsSync(directory), false);
  }
  cases.push(...names.map(name => "Release lock input: " + name));
  return { status: "PASS", input: "scripts/fixtures/isolated-supabase/stack.lock.json", sourceSha256: sha256(input), names,
    actualOwnerReadParseValidation: true, tempFixtureCleanupVerified: true, dockerExecuted: false, databaseCalls: 0 };
}

function verifyImageIdentity(owner: typeof import("./lib/isolated-supabase.mts"), expected: StackLock["images"][string]) {
  const actual = { id: expected.configDigest, os: "linux", architecture: "amd64", repoDigests: [expected.reference] };
  check("image accepts the pinned config ID with exact RepoDigest and platform", () => owner.assertPinnedImageIdentity(actual, expected));
  check("image accepts the pinned manifest ID with exact RepoDigest and platform", () => owner.assertPinnedImageIdentity({ ...actual, id: expected.manifestDigest }, expected));
  const rejects = (name: string, value: typeof actual, lock = expected) => check(name, () => assert.throws(() => owner.assertPinnedImageIdentity(value, lock), error => error instanceof owner.IsolatedSupabaseError && error.code === "IMAGE_IDENTITY_MISMATCH"));
  rejects("image rejects unknown ID despite matching RepoDigest", { ...actual, id: "sha256:" + "0".repeat(64) });
  rejects("image rejects wrong RepoDigest despite known ID", { ...actual, repoDigests: ["supabase/postgres@sha256:" + "0".repeat(64)] });
  rejects("image rejects wrong architecture", { ...actual, architecture: "arm64" });
  rejects("image rejects wrong operating system", { ...actual, os: "windows" });
  rejects("image rejects reference and manifest disagreement", actual, { ...expected, manifestDigest: "sha256:" + "0".repeat(64) });
  rejects("image rejects malformed pinned config digest", actual, { ...expected, configDigest: "sha256:invalid" });
}

async function imageIdentityOnly() {
  const sourceFiles = ["scripts/lib/isolated-supabase.mts", "scripts/verify-isolated-supabase.mts", "scripts/fixtures/isolated-supabase/stack.lock.json"];
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, sha256(readSource(file))]));
  const lock: StackLock = JSON.parse(readSource("scripts/fixtures/isolated-supabase/stack.lock.json"));
  const owner = await import("./lib/isolated-supabase.mts");
  verifyImageIdentity(owner, lock.images.db);
  for (const file of sourceFiles) assert.equal(sha256(readSource(file)), sourceHashes[file], "Image guard source changed during verification.");
  console.log(JSON.stringify({ status: "PASS", scope: "image-identity-only", checks: cases.length, cases, sourceHashes, dockerExecuted: false, networkRequests: 0, databaseCalls: 0, historicalChecksReexecuted: false, integrationReadinessClaimed: false }, null, 2));
}

function verifyDockerMountNormalization(owner: typeof import("./lib/isolated-supabase.mts")) {
  const expectedPath = path.join(root, ".tmp-qa", "offline-owned-run", "upstream", "docker", "volumes", "db", "roles.sql");
  const normalized = owner.normalizeDockerBindSource(expectedPath);
  const runId = "a".repeat(32), projectName = `venisia-qa-${runId}`;
  const expected: Parameters<typeof owner.assertOwnedResource>[1] = { kind: "container", id: "b".repeat(64), runId, projectName, name: `${projectName}-db-1`, mounts: [{ source: normalized, readOnly: true }] };
  const compare = (source: string) => owner.assertOwnedResource({ ...expected, mounts: [{ source: owner.normalizeDockerBindSource(source), readOnly: true }] }, expected);
  check("mount normalization preserves the complete native locked path", () => compare(expectedPath));
  check("mount comparison rejects a neighboring file", () => assert.throws(() => compare(`${expectedPath}.bak`), owner.IsolatedSupabaseError));
  check("mount comparison rejects another owned run directory", () => assert.throws(() => compare(expectedPath.replace("offline-owned-run", "another-run")), owner.IsolatedSupabaseError));
  check("mount comparison rejects an external resolved path", () => assert.throws(() => compare(path.resolve(root, "..", "outside", "roles.sql")), owner.IsolatedSupabaseError));
  if (process.platform === "win32") {
    const suffix = expectedPath.slice(3).replace(/\\/gu, "/"), drive = expectedPath[0].toLowerCase();
    const desktop = `/run/desktop/mnt/host/${drive}/${suffix}`;
    check("Docker Desktop anchored drive mount equals the exact native path", () => compare(desktop));
    check("Docker Desktop capital drive spelling equals the same path", () => compare(`/run/desktop/mnt/host/${drive.toUpperCase()}/${suffix}`));
    check("native slash and drive-case spelling equals the same path", () => compare(`${drive}:/${suffix}`));
    for (const [name, source] of [
      ["unanchored Desktop prefix", `/prefix${desktop}`],
      ["unsupported host_mnt prefix", `/host_mnt/${drive}/${suffix}`],
      ["unsupported multi-character drive prefix", `/run/desktop/mnt/host/${drive}x/${suffix}`],
      ["different drive", `/run/desktop/mnt/host/${drive === "e" ? "f" : "e"}/${suffix}`],
      ["Desktop traversal outside the target", `/run/desktop/mnt/host/${drive}/outside/../other/roles.sql`],
    ]) check(`mount comparison rejects ${name}`, () => assert.throws(() => compare(source), owner.IsolatedSupabaseError));
  }
}

/** Actual comparison plus the current lifecycle closure; no Docker or SQL executes. */
function verifyExistingResourcePreservationComparison(owner: typeof import("./lib/isolated-supabase.mts")) {
  const row = { id: "container-id", name: "/retained", state: "exited", aliases: ["first", "second"], mounts: [
    { Type: "bind", Source: "/qa/input", Destination: "/input", RW: false, Mode: "ro", Options: { labels: ["a", "b"] } },
    { Type: "bind", Source: "/qa/evidence", Destination: "/evidence", RW: true, Mode: "rw", Options: { labels: ["c", "d"] } },
  ] };
  const reversed = { ...structuredClone(row), mounts: [...structuredClone(row.mounts)].reverse() };
  const untouched = JSON.stringify([row, reversed]);
  type OfflineInventory = { containers: Record<string, unknown>[]; volumes: Record<string, unknown>[]; networks: Record<string, unknown>[]; imageIds: string[] };
  const baseline: OfflineInventory = { containers: [row], volumes: [], networks: [], imageIds: ["retained-image"] };
  const source = ts.createSourceFile("isolated-supabase.mts", readSource("scripts/lib/isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations: ts.VariableDeclaration[] = [];
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && ["canonical", "assertOriginalsUnchanged"].includes(node.name.getText(source))) declarations.push(node); ts.forEachChild(node, visit); };
  visit(source);
  const initializer = (name: string) => { const found = declarations.filter(node => node.name.getText(source) === name); assert.equal(found.length, 1); assert.ok(found[0].initializer); return found[0].initializer.getText(source); };
  const body = ts.transpileModule("const canonical = " + initializer("canonical") + "; return " + initializer("assertOriginalsUnchanged") + ";", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const diagnostics: unknown[] = [];
  const lifecycle = new Function("before", "preservationComparisonJson", "requireThat", "recordFile", "sha256", body)(baseline, owner.preservationComparisonJson,
    (condition: unknown, code: string, stage: string) => { if (!condition) throw new owner.IsolatedSupabaseError(code, stage); },
    (_name: string, value: unknown) => { diagnostics.push(value); }, sha256) as (after: OfflineInventory, baseline?: OfflineInventory) => void;
  check("preservation accepts only a permutation of the complete top-level container mounts", () => {
    assert.equal(owner.preservationComparisonJson("container", row), owner.preservationComparisonJson("container", reversed));
    lifecycle({ ...baseline, containers: [reversed] }); assert.equal(diagnostics.length, 0);
  });
  const mutations: Array<[string, (value: typeof row) => void]> = [
    ["source", value => { value.mounts[0].Source += ".changed"; }],
    ["destination", value => { value.mounts[0].Destination += ".changed"; }],
    ["RW", value => { value.mounts[0].RW = !value.mounts[0].RW; }],
    ["type", value => { value.mounts[0].Type = "volume"; }],
    ["mode", value => { value.mounts[0].Mode = "rw"; }],
    ["options value", value => { value.mounts[0].Options.labels[0] = "changed"; }],
    ["nested options array order", value => { value.mounts[0].Options.labels.reverse(); }],
    ["missing mount field", value => { delete (value.mounts[0] as Partial<typeof value.mounts[0]>).Source; }],
    ["extra mount field", value => { Object.assign(value.mounts[0], { unreviewed: true }); }],
    ["missing mount", value => { value.mounts.pop(); }],
    ["extra mount", value => { value.mounts.push({ ...structuredClone(value.mounts[0]), Source: "/another" }); }],
    ["extra duplicate mount", value => { value.mounts.push(structuredClone(value.mounts[0])); }],
    ["duplicate replacing a distinct mount", value => { value.mounts[1] = structuredClone(value.mounts[0]); }],
    ["resource id", value => { value.id = "another-container"; }],
    ["resource name", value => { value.name = "/another"; }],
    ["resource state", value => { value.state = "running"; }],
    ["other top-level array order", value => { value.aliases.reverse(); }],
  ];
  for (const [name, mutate] of mutations) check("preservation rejects changed " + name, () => {
    const changed = structuredClone(row); mutate(changed);
    assert.notEqual(owner.preservationComparisonJson("container", changed), owner.preservationComparisonJson("container", row));
    assert.throws(() => lifecycle({ ...baseline, containers: [changed] }), (error: unknown) => error instanceof owner.IsolatedSupabaseError && error.code === "EXISTING_RESOURCE_CHANGED");
  });
  for (const kind of ["volume", "network"] as const) check("preservation keeps every " + kind + " array ordered", () => {
    assert.notEqual(owner.preservationComparisonJson(kind, row), owner.preservationComparisonJson(kind, reversed));
    const key = kind === "volume" ? "volumes" : "networks";
    const before = { ...baseline, containers: [], [key]: [row] }, after = { ...before, [key]: [reversed] };
    assert.throws(() => lifecycle(after, before), owner.IsolatedSupabaseError);
  });
  check("preservation retains duplicate counts when mounts are only reordered", () => {
    const duplicated = { ...row, mounts: [...row.mounts, row.mounts[0]] };
    const reordered = { ...duplicated, mounts: [...duplicated.mounts].reverse() };
    assert.equal(owner.preservationComparisonJson("container", duplicated), owner.preservationComparisonJson("container", reordered));
    assert.notEqual(owner.preservationComparisonJson("container", duplicated), owner.preservationComparisonJson("container", row));
  });
  check("preservation comparison never mutates either input", () => assert.equal(JSON.stringify([row, reversed]), untouched));
}

async function currentInfrastructureOnly() {
  await verifyOrderedLocalVerificationControls();
  await verifyOwnedAdminFixtureDelivery();
  await verifyLocalRiskExecutionControls(["lint", "typecheck", "verify:dashboard-truth"], true);
  await verifyAdmissionQualificationControls();
  await verifyQualifiedSelectionControls();
  const sources = ["scripts/lib/isolated-supabase.mts", "scripts/qa-isolated-supabase.mts", "scripts/lib/isolated-public-application.mts", "scripts/lib/isolated-supabase-cli.mts", "scripts/verify-isolated-supabase.mts", "scripts/fixtures/isolated-supabase/stack.lock.json", "scripts/fixtures/isolated-supabase/compose.test.yml", "scripts/lib/isolated-public-verification.mts"];
  const texts = Object.fromEntries(sources.map(file => [file, readSource(file)]));
  const sourceHashes = Object.fromEntries(sources.map(file => [file, sha256(texts[file])]));
  for (const file of sources.slice(0, 4)) check(`current canonical source safety: ${file}`, () => assert.deepEqual(sourceFailures(texts[file], file), []));
  const owner = await import("./lib/isolated-supabase.mts");
  const cli = await import("./lib/isolated-supabase-cli.mts");
  const lock = owner.readReleaseLock(path.join(root, "scripts/fixtures/isolated-supabase/stack.lock.json"));
  check("actual lifecycle lock binds the official CLI tool contract", () => cli.assertApplicationMigrationTool(lock.applicationMigrationTool));
  verifyDockerMountNormalization(owner);
  verifyExistingResourcePreservationComparison(owner);
  const file = ts.createSourceFile("owner.mts", texts[sources[0]], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let cleanupBranch: ts.IfStatement | undefined, prepareCompose: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node) && node.expression.getText(file) === "priorIntent" && node.elseStatement && node.thenStatement.getText(file).includes("await prepareCompose()")) cleanupBranch = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "prepareCompose" && node.initializer && ts.isArrowFunction(node.initializer)) prepareCompose = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file);
  check("cleanup-only branch has no startup, download or SQL calls", () => {
    assert.ok(cleanupBranch?.elseStatement);
    const allowed = new Set(["prepareCompose", "discoverOwned", "requireThat", "recordFile", "safeRecord"]);
    // Admit the reviewed read/ownership expressions, not every use of their
    // helper names. AST identity ignores trivia, quotes and runtime-neutral TS.
    const shape = (node: ts.Node): string => {
      if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node)
        || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) return shape(node.expression);
      const value = ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ? node.text : null;
      return JSON.stringify([node.kind, value, node.getChildren(node.getSourceFile()).map(shape)]);
    };
    const parse = (source: string) => ts.createSourceFile("cleanup-control.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const approvedCalls = new Set<string>();
    for (const expression of [
      "Object.keys(config!.volumes)", "Object.keys(config!.networks)",
      'captured.filter(row => row.identity.kind === "container").map(row => row.identity.id)',
      'captured.filter(row => row.identity.kind === "network")',
      'inspect("network", item.identity.id)',
      "Object.keys(object(network.containers ?? {})).every(id => ownedContainerIds.has(id))",
      "sha256(readFileSync(path))", "Boolean(recoveryBaseline)", "Boolean(recoveryCurrentInventorySha256)",
    ]) {
      const collect = (node: ts.Node) => { if (ts.isCallExpression(node)) approvedCalls.add(shape(node)); ts.forEachChild(node, collect); };
      collect(parse(expression + ";"));
    }
    // These ownership checks must run before authorizing cleanup. Mere call
    // presence would also accept a dead branch or a predicate replaced by true.
    const requiredPrefix = parse(`
      await prepareCompose(); await discoverOwned();
      requireThat(captured.length === SERVICES.length + Object.keys(config!.volumes).length + Object.keys(config!.networks).length,
        "FAILED_CREATION_RESOURCE_SET_CHANGED", "cleanup-preflight");
      if (recoveryManifest) {
        requireThat(captured.length === recoveryManifest.length, "RECOVERY_RESOURCE_SET_CHANGED", "cleanup-preflight");
        const ownedContainerIds = new Set(captured.filter(row => row.identity.kind === "container").map(row => row.identity.id));
        for (const item of captured.filter(row => row.identity.kind === "network")) {
          const network = await inspect("network", item.identity.id);
          requireThat(Object.keys(object(network.containers ?? {})).every(id => ownedContainerIds.has(id)),
            "FOREIGN_NETWORK_MEMBER", "cleanup-preflight");
        }
      }
      for (const [path, expectedHash] of recoveryFiles) requireThat(sha256(readFileSync(path)) === expectedHash,
        "RECOVERY_EVIDENCE_CHANGED", "cleanup-preflight");
      created = true; recoveryAuthorized = true;
    `).statements;
    const approvedSet = shape(parse('new Set(captured.filter(row => row.identity.kind === "container").map(row => row.identity.id));').statements[0]);
    const protectedNames = new Set([...allowed, "Object", "Set", "inspect", "object", "sha256", "readFileSync", "Boolean", "captured", "recoveryFiles", "recoveryManifest"]);
    const assertCleanupOperations = (block: ts.Statement) => {
      assert.ok(ts.isBlock(block));
      assert.ok(block.statements.length >= requiredPrefix.length, "Cleanup ownership checks are missing.");
      assert.deepEqual(block.statements.slice(0, requiredPrefix.length).map(shape), requiredPrefix.map(shape),
        "Cleanup must validate resource identities, network ownership and evidence before authorization.");
      const assertBinding = (name: ts.BindingName) => {
        if (ts.isIdentifier(name)) assert.ok(!protectedNames.has(name.text), "Cleanup cannot shadow a reviewed owner or input.");
        else for (const element of name.elements) if (ts.isBindingElement(element)) assertBinding(element.name);
      };
      function inspect(node: ts.Node) {
        if (ts.isVariableDeclaration(node) || ts.isParameter(node)) assertBinding(node.name);
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) assertBinding(node.name);
        if (ts.isCallExpression(node)) assert.ok(
          (ts.isIdentifier(node.expression) && allowed.has(node.expression.text)) || approvedCalls.has(shape(node)),
          "Unexpected cleanup-only operation.",
        );
        if (ts.isNewExpression(node)) {
          const statement = parse(node.getText(node.getSourceFile()) + ";").statements[0];
          assert.equal(shape(statement), approvedSet, "Unexpected cleanup-only constructor.");
        }
        ts.forEachChild(node, inspect);
      }
      inspect(block);
    };
    assertCleanupOperations(cleanupBranch.thenStatement);
    assert.ok(cleanupBranch.elseStatement.getText(file).includes('currentStage = "upstream-provenance"'));
    const actual = cleanupBranch.thenStatement.getText(file);
    const blockFrom = (source: string) => {
      const declaration = parse("async function cleanupControl() " + source).statements[0];
      assert.ok(ts.isFunctionDeclaration(declaration) && declaration.body);
      return declaration.body;
    };
    check("cleanup ownership proof accepts actual CRLF, quote and parenthesis variants", () => {
      const equivalent = actual.replace(/\r\n/gu, "\n").replace(/\n/gu, "\r\n")
        .replace('inspect("network", item.identity.id)', "inspect('network', item.identity.id)")
        .replace("Object.keys(config!.volumes)", "Object.keys((config!).volumes)");
      assert.notEqual(equivalent, actual);
      assertCleanupOperations(blockFrom(equivalent));
    });
    const reject = (name: string, from: string, to: string) => check("cleanup ownership proof rejects " + name, () => {
      const mutant = actual.replace(from, to); assert.notEqual(mutant, actual, "Control must mutate the actual cleanup branch.");
      assert.throws(() => assertCleanupOperations(blockFrom(mutant)));
    });
    for (const [name, operation] of [
      ["download", 'fetch("https://unowned.invalid")'], ["startup", 'startService("db")'],
      ["connection", "connect()"], ["SQL", 'db.query("select 1")'],
      ["migration", "pushApplicationMigrations()"], ["unknown helper", "unreviewedRecoveryOperation()"],
    ]) {
      reject("direct " + name, 'recordFile("owned-resources.json", captured)', operation);
      reject("nested " + name, 'recordFile("owned-resources.json", captured)', 'recordFile("owned-resources.json", () => { ' + operation + '; return captured; })');
    }
    for (const [name, from, to] of [
      ["non-network inspection", 'inspect("network", item.identity.id)', 'inspect("container", item.identity.id)'],
      ["foreign metadata identity", 'inspect("network", item.identity.id)', 'inspect("network", foreignId)'],
      ["foreign evidence read", "readFileSync(path)", 'readFileSync(".env.local")'],
      ["missing evidence hash", "sha256(readFileSync(path)) === expectedHash", "true"],
      ["foreign network membership", "ownedContainerIds.has(id)", "true"],
      ["wrong manifest bound", "captured.length === recoveryManifest.length", "captured.length >= recoveryManifest.length"],
      ["dead ownership branch", "if (recoveryManifest)", "if (false && recoveryManifest)"],
      ["early cleanup authorization", "await prepareCompose();", "recoveryAuthorized = true; await prepareCompose();"],
      ["missing captured ownership discovery", "await discoverOwned();", ""],
      ["shadowed hash helper", 'recordFile("owned-resources.json", captured)', 'recordFile("owned-resources.json", captured); const sha256 = () => expectedHash'],
      ["unknown constructor", 'recordFile("owned-resources.json", captured)', 'recordFile("owned-resources.json", captured); new UnreviewedCleanupWorker()'],
    ]) reject(name, from, to);
  });
  check("cleanup compose preparation only reads config and uses generated local values", () => {
    assert.ok(prepareCompose);
    const body = prepareCompose.getText(file);
    assert.match(body, /dc\(\[\.\.\.args,\s*"config",\s*"--format",\s*"json"\]/u);
    assert.ok(!/\b(?:fetch|startService|connect|readonly|pushApplicationMigrations)\s*\(/u.test(body));
  });
  check("cleanup-only is restricted to the exact failed-mount ownership receipt", () => {
    const source = texts[sources[0]];
    for (const token of ['failure.stage === "ownership"', 'failure.code === "UNEXPECTED_CONTAINER_MOUNT"', 'cleanup.status === "blocked"', "priorIntent.releaseCommit === RELEASE_COMMIT", "priorIntent.composeSha256 === lock.compose.sha256", "canonical(priorIntent.images) === canonical(lock.images)", '"PRIOR_BASELINE_CHANGED"', "assertOwnedResource(actual.identity, item.identity)"]) assert.ok(source.includes(token));
    assert.ok(texts[sources[1]].includes('flags.has("--platform-only") || flags.has("--cleanup-only") ? undefined : runApplicationHandoff'));
  });
  check("CLI binding is ownership checked and receives private context only", () => {
    const source = texts[sources[0]];
    assert.match(source, /from\s+"\.\/isolated-supabase-cli\.mts"/u);
    assert.ok(source.includes("pushApplicationMigrations(") && source.includes("assertOwnedLocalHandle(handle)"));
    const helper = texts[sources[3]];
    assert.ok(helper.includes("await context.assertOwned();") && helper.includes("assertApplicationMigrationStage(request.stage, corpus())"));
    assert.ok(helper.includes('"--skip-vault"') && helper.includes('"--output-format", "json"'));
    const unwrap = (node: ts.Node): ts.Node => ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
      || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node) ? unwrap(node.expression) : node;
    const shape = (input: ts.Node): string => {
      const node = unwrap(input), value = ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ? node.text : null;
      return JSON.stringify([node.kind, value, node.getChildren(node.getSourceFile()).map(shape)]);
    };
    const parse = (text: string) => ts.createSourceFile("cli-binding-control.mts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const expectedArguments = parse('const args = ["db", "push", "--db-url", `postgresql://postgres@127.0.0.1:${context.port}/postgres`, "--skip-vault", "--workdir", workdir, "--output-format", "json", request.mode === "dry-run" ? "--dry-run" : "--yes"];').statements[0];
    assert.ok(ts.isVariableStatement(expectedArguments));
    const expectedArgv = expectedArguments.declarationList.declarations[0].initializer!;
    const assertPrivatePushBinding = (text: string) => {
      const tree = parse(text);
      const declaration = (name: string) => {
        const matches = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
        assert.equal(matches.length, 1, `The actual ${name} owner must be unique.`);
        assert.ok(matches[0].body); return matches[0];
      };
      const push = declaration("pushApplicationMigrations"), environment = declaration("applicationMigrationChildEnvironment");
      const pushText = push.getText(tree);
      assert.ok(pushText.includes("await context.assertOwned();") && pushText.includes("assertApplicationMigrationStage(request.stage, corpus())"));
      assert.ok(pushText.includes('"--skip-vault"') && pushText.includes('"--output-format", "json"'));
      assert.ok(!pushText.includes("context.password}@"), "Migration push must never interpolate the password into its URL.");
      const variables = (scope: ts.Node, name: string) => {
        const matches: ts.VariableDeclaration[] = [];
        const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) matches.push(node); ts.forEachChild(node, visit); };
        visit(scope); assert.equal(matches.length, 1, `${name} must have one actual binding.`); assert.ok(matches[0].initializer); return matches[0].initializer;
      };
      assert.equal(shape(variables(push, "args")), shape(expectedArgv), "Migration push argv must retain its reviewed password-free target and flags.");
      const env = variables(push, "env");
      assert.ok(ts.isCallExpression(env) && ts.isIdentifier(env.expression) && env.expression.text === "applicationMigrationChildEnvironment");
      assert.deepEqual(env.arguments.map(node => node.getText(tree)), ["home", "workdir", "context.password"]);
      const childEnvironment = variables(environment, "childEnvironment");
      assert.ok(ts.isObjectLiteralExpression(childEnvironment));
      const password = childEnvironment.properties.filter((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === "PGPASSWORD");
      assert.equal(password.length, 1, "The private environment must retain exactly one password binding.");
      assert.ok(ts.isIdentifier(password[0].initializer) && password[0].initializer.text === "password");
      const returns = environment.body!.statements.filter(ts.isReturnStatement);
      assert.equal(returns.length, 1); assert.ok(returns[0].expression);
      const returned = unwrap(returns[0].expression);
      assert.ok(ts.isIdentifier(returned) && returned.text === "childEnvironment", "The actual private environment must be returned.");
      const runs: ts.CallExpression[] = [];
      const visit = (node: ts.Node) => { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "run") runs.push(node); ts.forEachChild(node, visit); };
      visit(push); assert.equal(runs.length, 1);
      assert.deepEqual(runs[0].arguments.map(node => node.getText(tree)), ["state.binary", "args", "workdir", "env", "control"], "The actual CLI runner must receive the private environment separately from argv.");
    };
    assertPrivatePushBinding(helper);
    check("CLI password-free argv proof preserves separate owned SEO and type-generation URL helpers", () => {
      assertPrivatePushBinding(helper.replace(/\r\n/gu, "\n").replace(/\n/gu, "\r\n"));
    });
    for (const [name, from, to] of [
      ["password URL in push argv", "postgresql://postgres@127.0.0.1:${context.port}/postgres", "postgresql://postgres:${context.password}@127.0.0.1:${context.port}/postgres"],
      ["password as an extra push argument", '["db", "push", "--db-url",', '["db", "push", context.password, "--db-url",'],
      ["missing private environment password", "PGPASSWORD: password", "REMOVED_PASSWORD: password"],
      ["incorrect private environment password", "PGPASSWORD: password", 'PGPASSWORD: ""'],
      ["wrong returned environment", "return childEnvironment as NodeJS.ProcessEnv", "return source as NodeJS.ProcessEnv"],
      ["disconnected push environment", "applicationMigrationChildEnvironment(home, workdir, context.password)", "applicationMigrationChildEnvironment(home, workdir, unownedPassword)"],
      ["disconnected CLI runner environment", "run(state.binary, args, workdir, env, control)", "run(state.binary, args, workdir, process.env, control)"],
      ["missing ownership check", "await context.assertOwned();", "void context;"],
      ["missing migration-stage recheck", "assertApplicationMigrationStage(request.stage, corpus())", "void request.stage"],
      ["missing skip-vault boundary", '"--skip-vault"', '"--skip-other"'],
    ]) check("CLI private push binding rejects " + name, () => {
      const mutant = helper.replaceAll(from, to); assert.notEqual(mutant, helper, "Control must mutate the actual CLI helper source.");
      assert.throws(() => assertPrivatePushBinding(mutant));
    });
    assert.ok(!/\bfetch\s*\(/u.test(helper));
  });
  for (const source of sources) assert.equal(sha256(readSource(source)), sourceHashes[source], "Current infrastructure changed during verification.");
  console.log(JSON.stringify({ status: "PASS", scope: "current-infrastructure-only", checks: cases.length, cases, sourceHashes, normalizationPlatform: process.platform, dockerExecuted: false, networkRequests: 0, databaseCalls: 0, historicalChecksReexecuted: false, integrationReadinessClaimed: false, boundary: "New mount behavior and current source integration only; CLI helper pure cases remain separate retained evidence." }, null, 2));
}

function offlineComposeFixture(owner: typeof import("./lib/isolated-supabase.mts"), lock: StackLock) {
  type Compose = ReturnType<typeof owner.validateComposeConfig>;
  const runId = "a".repeat(32), projectName = `venisia-qa-${runId}`;
  const run = { runId, projectName, pgPort: 55965, restPort: 55966, storagePort: 55967, apiPort: 55968, upstreamRoot: path.join(root, ".tmp-qa", "offline-uncreated-upstream") };
  const labels = { "com.venisia.qa.run": projectName, "com.venisia.qa.owner": "isolated-supabase" };
  const names = ["db", "rest", "storage", "imgproxy", "api-gw", "qa-transport"] as const;
  const services = Object.fromEntries(names.map(name => [name, {
    image: lock.images[name === "qa-transport" ? "storage" : name].reference,
    restart: "no", labels: { ...labels }, networks: { isolated: {} }, ports: [], volumes: [],
  }])) as unknown as Compose["services"];
  services["qa-transport"] = { ...services["qa-transport"], user: "1000:1000", read_only: true,
    cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"],
    command: ["node", "/qa/isolated-supabase-transport.mjs", "--hold"],
    volumes: [{ type: "bind", source: path.join(root, lock.transport.path), target: "/qa/isolated-supabase-transport.mjs", read_only: true }] };
  services["api-gw"].logging = { driver: "none" };
  const compose: Compose = {
    name: projectName, services,
    networks: { isolated: { name: `${projectName}_isolated`, labels: { ...labels }, internal: true, driver: "bridge" } },
    volumes: Object.fromEntries(["database", "database-config", "storage-data"].map(name => [name, { name: `${projectName}_${name}`, labels: { ...labels } }])),
  };
  const sqlFile = lock.files.find(file => file.path.endsWith(".sql"));
  assert.ok(sqlFile);
  compose.services.db.volumes = [{ type: "bind", source: path.join(run.upstreamRoot, sqlFile.path), target: "/docker-entrypoint-initdb.d/locked.sql", read_only: true }, { type: "volume", source: "database", target: "/var/lib/postgresql/data" }];
  return { compose, run };
}

async function networkBoundaryOnly() {
  const sources = ["scripts/lib/isolated-supabase.mts", "scripts/lib/isolated-supabase-transport.mjs", "scripts/qa-isolated-supabase-transport.mjs", "scripts/verify-isolated-supabase.mts", "scripts/fixtures/isolated-supabase/stack.lock.json", "scripts/fixtures/isolated-supabase/compose.test.yml"];
  const sourceHashes = Object.fromEntries(sources.map(file => [file, sha256(readSource(file))]));
  const provenance = verifyReleaseLock();
  const owner = await import("./lib/isolated-supabase.mts");
  const { compose, run } = offlineComposeFixture(owner, provenance.lock);
  check("network boundary accepts only the owned internal-only six-service stack", () => owner.validateComposeConfig(compose, provenance.lock, run));
  type Compose = typeof compose;
  const negative: Array<[string, (value: Compose) => void]> = [
    ["Docker published port", value => { value.services.db.ports = [{ host_ip: "127.0.0.1", published: "55965", target: 5432 }]; }],
    ["wildcard published gateway", value => { value.services["api-gw"].ports = [{ host_ip: "0.0.0.0", published: "55968", target: 8000 }]; }],
    ["external egress", value => { value.networks.isolated.internal = false; }],
    ["second ordinary network", value => { value.networks.ordinary = { name: `${run.projectName}_ordinary`, labels: { ...value.networks.isolated.labels } }; }],
    ["pre-existing network", value => { value.services["api-gw"].networks = { bridge: {} }; }],
    ["host network", value => { value.services["qa-transport"].network_mode = "host"; }],
    ["privileged transport", value => { value.services["qa-transport"].privileged = true; }],
    ["extra network capability", value => { value.services["qa-transport"].cap_add = ["NET_ADMIN"]; }],
    ["missing capability drop", value => { value.services["qa-transport"].cap_drop = []; }],
    ["missing no-new-privileges", value => { value.services["qa-transport"].security_opt = []; }],
    ["gateway request-log retention", value => { value.services["api-gw"].logging = { driver: "json-file" }; }],
    ["root transport user", value => { value.services["qa-transport"].user = "0:0"; }],
    ["writable transport root", value => { value.services["qa-transport"].read_only = false; }],
    ["arbitrary transport command", value => { value.services["qa-transport"].command = ["node", "--eval", "untrusted"]; }],
    ["wrong transport image", value => { value.services["qa-transport"].image = provenance.lock.images.db.reference; }],
    ["mutable gateway image", value => { value.services["api-gw"].image = "envoyproxy/envoy:v1.39.1"; }],
    ["transport module replacement", value => { value.services["qa-transport"].volumes![0].source = path.join(root, "scripts", "other.mjs"); }],
    ["writable transport module", value => { value.services["qa-transport"].volumes![0].read_only = false; }],
    ["Docker socket mount", value => { value.services["qa-transport"].volumes!.push({ type: "bind", source: "/var/run/docker.sock", target: "/var/run/docker.sock", read_only: true }); }],
  ];
  for (const [name, mutate] of negative) check(`network boundary rejects ${name}`, () => {
    const candidate = structuredClone(compose); mutate(candidate);
    assert.throws(() => owner.validateComposeConfig(candidate, provenance.lock, run), owner.IsolatedSupabaseError);
  });
  const oldBridge = {
    id: "1".repeat(64), name: "bridge", createdAt: "2026-09-16T01:00:00Z", driver: "bridge", scope: "local",
    internal: false, attachable: false, ingress: false, configOnly: false, configFrom: { Network: "" },
    enableIPv4: true, enableIPv6: false, labels: {}, containers: {},
    options: { "com.docker.network.bridge.default_bridge": "true", "com.docker.network.bridge.name": "docker0" },
    ipam: { Driver: "default", Options: null, Config: [{ Subnet: "172.17.0.0/16", Gateway: "172.17.0.1" }] },
  };
  const newBridge = { ...structuredClone(oldBridge), id: "2".repeat(64), createdAt: "2026-09-16T02:00:00.000000001Z" };
  const epoch = { warmStartedAt: "2026-09-16T02:00:00.000Z", firstOwnedCreatedAt: "2026-09-16T02:00:00.000000002Z" };
  check("empty built-in bridge epoch accepts only identical semantics before the first owned resource", () =>
    owner.assertBuiltinBridgeEpochTransition(oldBridge, newBridge, epoch));
  const invalidEpochs: Array<[string, (previous: Record<string, unknown>, current: Record<string, unknown>, window: typeof epoch) => void]> = [
    ["ordinary named network", (_previous, current) => { current.name = "old-user-network"; }],
    ["attached user container", (_previous, current) => { current.containers = { retained: { Name: "old" } }; }],
    ["changed IPAM", (_previous, current) => { current.ipam = { Driver: "default", Config: [{ Subnet: "10.0.0.0/8" }] }; }],
    ["changed options", (_previous, current) => { current.options = { ...oldBridge.options, unexpected: "true" }; }],
    ["different ownership labels", (_previous, current) => { current.labels = { owner: "another" }; }],
    ["missing default marker", (_previous, current) => { current.options = { "com.docker.network.bridge.name": "docker0" }; }],
    ["creation before warmup", (_previous, current) => { current.createdAt = "2026-09-16T01:59:59Z"; }],
    ["creation after owned resources", (_previous, current) => { current.createdAt = "2026-09-16T02:00:00.000000003Z"; }],
    ["old network from the same epoch", (previous) => { previous.createdAt = newBridge.createdAt; }],
    ["invalid timestamp", (_previous, _current, window) => { window.warmStartedAt = "invalid"; }],
    ["same identity", (_previous, current) => { current.id = oldBridge.id; }],
  ];
  for (const [name, mutate] of invalidEpochs) check(`pre-start baseline rejects ${name}`, () => {
    const previous = structuredClone(oldBridge), current = structuredClone(newBridge), window = structuredClone(epoch);
    mutate(previous, current, window);
    assert.throws(() => owner.assertBuiltinBridgeEpochTransition(previous, current, window), owner.IsolatedSupabaseError);
  });
  check("new transport and its test import only canonical modules without SQL repair", () => {
    for (const source of sources.slice(1, 3)) assert.deepEqual(sourceFailures(readSource(source), source), []);
  });
  check("official gateway source files remain exact-commit locks", () => {
    assert.deepEqual(provenance.lock.files.filter(file => file.path.startsWith("docker/volumes/api/envoy/")).map(file => file.path).sort(),
      ["cds.yaml", "docker-entrypoint.sh", "envoy.yaml", "lds.template.yaml"].map(file => `docker/volumes/api/envoy/${file}`).sort());
    const composeText = readSource(provenance.lock.compose.path);
    for (const file of provenance.lock.files.filter(file => file.path.startsWith("docker/volumes/api/envoy/"))) assert.ok(composeText.includes(`}/${file.path}:`));
  });
  for (const source of sources) assert.equal(sha256(readSource(source)), sourceHashes[source], "Network infrastructure changed during verification.");
  console.log(JSON.stringify({ status: "PASS", scope: "new-host-access-network-boundary-only", checks: cases.length, cases, sourceHashes,
    dockerExecuted: false, networkRequests: 0, databaseCalls: 0, retainedNavigationGatesReexecuted: false, integrationReadinessClaimed: false }, null, 2));
}

/** Execute the actual private fixture producer with owned local files; no lifecycle or database starts. */
async function verifyOwnedAdminFixtureDelivery() {
  const ownerPath = "scripts/lib/isolated-supabase.mts", ownerSource = readSource(ownerPath);
  const publicSource = readSource("scripts/lib/isolated-public-verification.mts"), driverSource = readSource("scripts/qa-admin-adoption-journeys.mjs");
  const cliSource = readSource("scripts/qa-isolated-supabase.mts");
  const parse = (source: string, file: string) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const nodes = <T extends ts.Node>(tree: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const found: T[] = []; const visit = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }; visit(tree); return found;
  };
  const named = (node: ts.PropertyAssignment, name: string) => (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) && node.name.text === name;
  const assertSource = (source: string, publicText = publicSource, driverText = driverSource, cliText = cliSource) => {
    const tree = parse(source, ownerPath);
    const helpers = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "persistOwnedAdminFixtures");
    assert.equal(helpers.length, 1); assert.equal(helpers[0].modifiers?.some(node => node.kind === ts.SyntaxKind.ExportKeyword) ?? false, false);
    const preparation = nodes(tree, ts.isPropertyAssignment).filter(node => named(node, "prepareAdminInteractions")); assert.equal(preparation.length, 1);
    assert.ok(ts.isArrowFunction(preparation[0].initializer)); const method = preparation[0].initializer;
    const phases = nodes(method, ts.isCallExpression).filter(node => node.expression.getText(tree) === "runPreparationPhase"); assert.equal(phases.length, 1);
    assert.ok(ts.isStringLiteralLike(phases[0].arguments[0])); assert.equal(phases[0].arguments[0].text, "admin-fixture");
    const callback = phases[0].arguments[1]; assert.ok(ts.isArrowFunction(callback) && ts.isBlock(callback.body)); const body = callback.body;
    const persistence = nodes(body, ts.isCallExpression).filter(node => node.expression.getText(tree) === "persistOwnedAdminFixtures"); assert.equal(persistence.length, 1);
    assert.deepEqual(persistence[0].arguments.map(node => node.getText(tree)), ["publicContext", "result.fixtures", "acceptedAdminFixtureFile"]);
    const assignment = persistence[0].parent; assert.ok(ts.isBinaryExpression(assignment) && assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken);
    assert.equal(assignment.left.getText(tree), "acceptedAdminFixtureFile"); assert.ok(ts.isExpressionStatement(assignment.parent));
    assert.equal(assignment.parent.parent === body, true, "Persistence must execute directly in the active preparation phase.");
    const statements = [...body.statements], persistAt = statements.indexOf(assignment.parent);
    const seedAt = statements.findIndex(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(value =>
      value.name.getText(tree) === "result" && value.initializer && ts.isAwaitExpression(value.initializer)
      && ts.isCallExpression(value.initializer.expression) && value.initializer.expression.expression.getText(tree) === "fixtureOwner.seedOwnedAdminInteractionFixtures"));
    const acceptedAt = statements.findIndex(node => ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
      && node.expression.left.getText(tree) === "acceptedAdminFixtureHash");
    const readyAt = statements.findIndex(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
      && node.expression.expression.getText(tree) === "safeRecord" && ts.isStringLiteralLike(node.expression.arguments[0]) && node.expression.arguments[0].text === "admin-fixture-ready");
    const returnAt = statements.findIndex(node => ts.isReturnStatement(node) && node.expression?.getText(tree) === "result.fixtures");
    assert.ok(seedAt >= 0 && seedAt < persistAt && persistAt < acceptedAt && acceptedAt < readyAt && readyAt < returnAt);
    const ready = statements[readyAt]; assert.ok(ts.isExpressionStatement(ready) && ts.isCallExpression(ready.expression));
    const metadata = ready.expression.arguments[1]; assert.ok(ts.isObjectLiteralExpression(metadata));
    for (const [name, expected] of [["file", '"admin-adoption-fixtures.json"'], ["fixtureContentSha256", "acceptedAdminFixtureFile.sha256"], ["fixtureBytes", "acceptedAdminFixtureFile.bytes"]]) {
      const values: ts.PropertyAssignment[] = metadata.properties.filter((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && named(node, name));
      assert.equal(values.length, 1); assert.equal(values[0].initializer.getText(tree), expected);
    }
    const accountAt = statements.findIndex(node => ts.isIfStatement(node) && node.expression.getText(tree) === 'request?.study === "media-upload-limit"'
      && ts.isReturnStatement(node.thenStatement)); assert.ok(accountAt >= 0 && accountAt < seedAt, "Account-only preparation must not persist full fixtures.");
    const state = nodes(tree, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === "acceptedAdminFixtureFile"); assert.equal(state.length, 1);
    assert.equal(state[0].initializer, undefined); assert.ok(!ts.isSourceFile(state[0].parent.parent.parent), "File identity belongs to one lifecycle invocation.");
    const contexts = nodes(tree, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === "publicContext"); assert.equal(contexts.length, 1);
    const sanitizer = nodes(contexts[0], ts.isPropertyAssignment).filter(node => named(node, "sanitize")); assert.equal(sanitizer.length, 1);
    assert.ok(sanitizer[0].initializer.getText(tree).includes("privateValues.reduce"), "Persistence must use the same private credential sanitizer.");
    const publicTree = parse(publicText, "public.mts");
    const paths = nodes(publicTree, ts.isPropertyAssignment).filter(node => named(node, "QA_ADMIN_FIXTURES")); assert.equal(paths.length, 1);
    assert.ok(ts.isCallExpression(paths[0].initializer)); assert.equal(paths[0].initializer.expression.getText(publicTree), "ownedPath");
    assert.deepEqual(paths[0].initializer.arguments.map(node => ts.isStringLiteralLike(node) ? node.text : node.getText(publicTree)), ["originalContext", "admin-adoption-fixtures.json"]);
    const driverTree = parse(driverText, "driver.mjs");
    const fixtureReads = nodes(driverTree, ts.isVariableDeclaration).filter(node => node.name.getText(driverTree) === "fixtures"
      && node.initializer && node.initializer.getText(driverTree) === 'JSON.parse(readFileSync(process.env.QA_ADMIN_FIXTURES, "utf8"))'); assert.equal(fixtureReads.length, 1);
    const launches = nodes(driverTree, ts.isCallExpression).filter(node => node.expression.getText(driverTree) === "chromium.launch"); assert.equal(launches.length, 1);
    assert.ok(fixtureReads[0].getStart(driverTree) < launches[0].getStart(driverTree));
    const cliTree = parse(cliText, "cli.mts"), fixturePath = (node: ts.Node) => nodes(node, ts.isStringLiteralLike).some(value => value.text === "run/admin-adoption-fixtures.json");
    assert.equal(nodes(cliTree, ts.isCallExpression).filter(node => /^(?:writeFileSync|appendFileSync|openSync)$/u.test(node.expression.getText(cliTree)) && node.arguments[0] && fixturePath(node.arguments[0])).length, 0,
      "The tracked CLI must not overwrite the producer-owned file.");
    assert.equal(nodes(cliTree, ts.isCallExpression).filter(node => node.expression.getText(cliTree) === "assert.deepEqual"
      && node.arguments.length === 2 && fixturePath(node.arguments[0]) && node.arguments[1].getText(cliTree) === "relocationFixtures").length, 1);
    return helpers[0].getText(tree);
  };
  let helperSource = "";
  check("Admin fixture delivery is a private producer call before readiness and exact runtime/driver handoff", () => { helperSource = assertSource(ownerSource); });
  for (const [name, before, after] of [
    ["missing persistence", "acceptedAdminFixtureFile = persistOwnedAdminFixtures(publicContext, result.fixtures, acceptedAdminFixtureFile);", ""],
    ["wrong payload", "persistOwnedAdminFixtures(publicContext, result.fixtures, acceptedAdminFixtureFile)", "persistOwnedAdminFixtures(publicContext, result, acceptedAdminFixtureFile)"],
    ["wrong ownership context", "persistOwnedAdminFixtures(publicContext, result.fixtures, acceptedAdminFixtureFile)", "persistOwnedAdminFixtures(cliContext, result.fixtures, acceptedAdminFixtureFile)"],
    ["dead persistence", "acceptedAdminFixtureFile = persistOwnedAdminFixtures(publicContext, result.fixtures, acceptedAdminFixtureFile);", "if (false) { acceptedAdminFixtureFile = persistOwnedAdminFixtures(publicContext, result.fixtures, acceptedAdminFixtureFile); }"],
  ]) check("Admin fixture source binding rejects " + name, () => {
    const mutant = ownerSource.replace(before, after); assert.notEqual(mutant, ownerSource);
    if (name !== "dead persistence") { assert.throws(() => assertSource(mutant)); return; }
    assert.throws(() => assertSource(mutant), (error: unknown) => {
      assert.ok(error instanceof assert.AssertionError);
      assert.equal(error.actual, false); assert.equal(error.expected, true); assert.equal(error.operator, "strictEqual");
      assert.ok(error.message.startsWith("Persistence must execute directly in the active preparation phase."));
      assert.ok(error.message.length <= 256, "AST identity refusal must retain a bounded diagnostic.");
      return true;
    });
  });
  check("Admin fixture source binding rejects a caller overwrite", () => assert.throws(() => assertSource(ownerSource, publicSource, driverSource,
    cliSource + '\nwriteFileSync(resolve(output,"run/admin-adoption-fixtures.json"),"unowned");\n')));
  check("Admin fixture source binding rejects an execution-mirror path", () => { const mutant = publicSource.replace('ownedPath(originalContext, "admin-adoption-fixtures.json")', 'ownedPath(context, "admin-adoption-fixtures.json")'); assert.notEqual(mutant, publicSource); assert.throws(() => assertSource(ownerSource, mutant)); });
  type FileIdentity = { dev: bigint; ino: bigint; birthtimeNs: bigint; sha256: string; bytes: number };
  type Context = { runDirectory: string; sanitize(value: string): string };
  type Persist = (context: Context, fixtures: Record<string, unknown>, accepted?: FileIdentity) => FileIdentity;
  const nativeFs = await import("node:fs"), opened = new Set<number>(); let openedCount = 0, writes = 0, truncations = 0;
  let afterOpen: ((fd: number) => void) | undefined, writeFault: Error | undefined, closeFault: Error | undefined, shortIo = false, readFault = false, zeroWrite = false;
  const ioOrder: string[] = [];
  const argumentNames = ["requireThat", "Buffer", "resolve", "realpathSync", "lstatSync", "openSync", "fsConstants", "fstatSync", "readSync", "writeSync", "ftruncateSync", "closeSync", "sha256"];
  const actual = new Function(...argumentNames, ts.transpileModule(helperSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return persistOwnedAdminFixtures;")(
    (value: unknown, code: string) => assert.ok(value, code), Buffer, path.resolve, realpathSync, lstatSync,
    (...args: unknown[]) => { const fd = Reflect.apply(nativeFs.openSync, nativeFs, args) as number; opened.add(fd); openedCount++; afterOpen?.(fd); return fd; },
    fsConstants, nativeFs.fstatSync,
    (fd: number, buffer: Buffer, offset: number, length: number, position: number) => readFault ? 0 : nativeFs.readSync(fd, buffer, offset, shortIo ? Math.min(length, 3) : length, position),
    (fd: number, buffer: Buffer, offset: number, length: number, position: number) => { ioOrder.push("write"); if (writeFault) throw writeFault; writes++; return zeroWrite ? 0 : nativeFs.writeSync(fd, buffer, offset, shortIo ? Math.min(length, 3) : length, position); },
    (fd: number, length: number) => { truncations++; nativeFs.ftruncateSync(fd, length); },
    (fd: number) => { assert.ok(opened.has(fd)); nativeFs.closeSync(fd); opened.delete(fd); ioOrder.push("close"); if (closeFault) throw closeFault; }, sha256) as Persist;
  const base = path.resolve(root, ".tmp-qa"); mkdirSync(base, { recursive: true }); assert.equal(realpathSync(base), base);
  const directory = mkdtempSync(path.join(base, "admin-fixture-delivery-controls-")); assert.equal(realpathSync(directory), directory);
  const model = { topic: { id: 71, slug: "owned-fixture" }, category: { id: 12 }, pages: [] };
  const bytes = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
  let sequence = 0;
  const control = (name: string, run: (context: Context, file: string) => void) => check("Actual private Admin fixture producer " + name, () => {
    const current = path.join(directory, String(++sequence)); mkdirSync(current); const file = path.join(current, "admin-adoption-fixtures.json");
    const context: Context = { runDirectory: current, sanitize: value => value.replaceAll("controlled-private-secret", "[REDACTED]") };
    afterOpen = undefined; writeFault = undefined; closeFault = undefined; shortIo = false; readFault = false; zeroWrite = false; openedCount = 0; writes = 0; truncations = 0; ioOrder.length = 0;
    try { run(context, file); } finally { const remaining = opened.size; for (const fd of opened) nativeFs.closeSync(fd); opened.clear(); assert.equal(remaining, 0, "Every opened fixture handle must close on success or refusal."); }
  });
  try {
    control("creates exact bytes exclusively and retains actual file identity", (context, file) => {
      const state = actual(context, model); assert.deepEqual(readFileSync(file), bytes(model)); const stat = lstatSync(file, { bigint: true });
      assert.deepEqual(state, { dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs, sha256: sha256(bytes(model)), bytes: bytes(model).length });
      assert.equal(stat.nlink, BigInt(1)); assert.equal(openedCount, 1); if (process.platform !== "win32") assert.equal(stat.mode & BigInt(0o777), BigInt(0o600));
    });
    control("accepts identical repeat without writing or truncating", (context, file) => {
      const state = actual(context, model); writes = 0; truncations = 0; assert.deepEqual(actual(context, model, state), state);
      assert.equal(writes, 0); assert.equal(truncations, 0); assert.deepEqual(readFileSync(file), bytes(model));
    });
    control("updates a legitimately changed model through the retained identity and truncates old bytes", (context, file) => {
      const state = actual(context, model), changed = { topic: { id: 71 } }; const next = actual(context, changed, state);
      assert.deepEqual(readFileSync(file), bytes(changed)); assert.equal(next.ino, state.ino); assert.equal(next.birthtimeNs, state.birthtimeNs);
      assert.equal(next.sha256, sha256(bytes(changed))); assert.equal(next.bytes, bytes(changed).length);
    });
    control("completes bounded short positional reads and writes", (context, file) => {
      shortIo = true; const state = actual(context, model); assert.ok(writes > 1); assert.deepEqual(actual(context, model, state), state); assert.deepEqual(readFileSync(file), bytes(model));
    });
    control("refuses an unowned preexisting file even with identical bytes", (context, file) => {
      writeFileSync(file, bytes(model), { flag: "wx" }); assert.throws(() => actual(context, model), /EEXIST/u); assert.equal(openedCount, 0); assert.deepEqual(readFileSync(file), bytes(model));
    });
    for (const [name, value] of [["credential envelope", { credentials: {} }], ["nested private credential", { topic: { value: "controlled-private-secret" } }], ["array envelope", []], ["null envelope", null]] as const)
      control("refuses " + name + " before opening any file", (context, file) => { assert.throws(() => actual(context, value as unknown as Record<string, unknown>), /ADMIN_FIXTURE_(?:ENVELOPE_INVALID|CONTAINS_CREDENTIAL)/u); assert.equal(existsSync(file), false); assert.equal(openedCount, 0); });
    for (const field of ["dev", "ino", "birthtimeNs", "bytes", "sha256"] as const) control("refuses altered accepted " + field + " without a write", (context, file) => {
      const state = actual(context, model), changed = { ...state };
      if (field === "sha256") changed.sha256 = "0".repeat(64); else if (field === "bytes") changed.bytes++; else changed[field] += BigInt(1);
      writes = 0; assert.throws(() => actual(context, { changed: true }, changed), /ADMIN_FIXTURE_(?:IDENTITY_CHANGED|CONTENT_CHANGED|READ_SIZE_CHANGED)/u); assert.equal(writes, 0); assert.deepEqual(readFileSync(file), bytes(model));
    });
    control("refuses same-identity content mutation before updating", (context, file) => {
      const state = actual(context, model); writeFileSync(file, Buffer.alloc(state.bytes, 65)); const mutated = readFileSync(file); writes = 0;
      assert.throws(() => actual(context, model, state), /ADMIN_FIXTURE_CONTENT_CHANGED/u); assert.equal(writes, 0); assert.deepEqual(readFileSync(file), mutated);
    });
    control("refuses a resized retained file before reading its payload", (context, file) => {
      const state = actual(context, model); nativeFs.appendFileSync(file, "foreign"); writes = 0;
      assert.throws(() => actual(context, model, state), /ADMIN_FIXTURE_(?:CONTENT_CHANGED|READ_SIZE_CHANGED)/u); assert.equal(writes, 0);
    });
    control("refuses replacement with identical bytes and a stale file identity", (context, file) => {
      const state = actual(context, model); nativeFs.renameSync(file, path.join(context.runDirectory, "original.json")); writeFileSync(file, bytes(model), { flag: "wx" });
      assert.throws(() => actual(context, model, state), /ADMIN_FIXTURE_IDENTITY_CHANGED/u); assert.deepEqual(readFileSync(file), bytes(model));
    });
    control("refuses a new hardlink without mutating either name", (context, file) => {
      const state = actual(context, model), alias = path.join(context.runDirectory, "alias.json"); nativeFs.linkSync(file, alias); writes = 0;
      assert.throws(() => actual(context, { changed: true }, state), /ADMIN_FIXTURE_IDENTITY_CHANGED/u); assert.equal(writes, 0); assert.deepEqual(readFileSync(alias), bytes(model));
    });
    control("refuses a junction or symlink as the runtime directory", (context, file) => {
      const alias = path.join(directory, "directory-alias"); symlinkSync(context.runDirectory, alias, process.platform === "win32" ? "junction" : "dir");
      assert.throws(() => actual({ ...context, runDirectory: alias }, model), /ADMIN_FIXTURE_DIRECTORY_INVALID/u); assert.equal(existsSync(file), false); assert.equal(openedCount, 0);
    });
    control("refuses a reparse or symbolic directory at the fixture file name", (context, file) => {
      const state = actual(context, model), original = path.join(context.runDirectory, "original.json"), target = path.join(context.runDirectory, "foreign-directory");
      nativeFs.renameSync(file, original); mkdirSync(target); symlinkSync(target, file, process.platform === "win32" ? "junction" : "dir"); writes = 0;
      assert.throws(() => actual(context, model, state), /ADMIN_FIXTURE_IDENTITY_CHANGED/u); assert.equal(writes, 0); assert.deepEqual(readFileSync(original), bytes(model));
    });
    control("refuses a relative runtime path before allocation", (context, file) => {
      assert.throws(() => actual({ ...context, runDirectory: path.relative(root, context.runDirectory) }, model), /ADMIN_FIXTURE_DIRECTORY_INVALID/u); assert.equal(existsSync(file), false); assert.equal(openedCount, 0);
    });
    control("closes the exact retained handle after a write failure", (context, file) => {
      const original = new Error("controlled owned fixture write failure"); writeFault = original; assert.throws(() => actual(context, model), error => error === original); assert.equal(openedCount, 1); assert.equal(readFileSync(file).length, 0);
    });
    control("preserves a close-only failure after actually closing its descriptor", (context, file) => {
      const original = new Error("controlled owned fixture close failure"); closeFault = original;
      assert.throws(() => actual(context, model), error => error === original); assert.equal(opened.size, 0); assert.equal(openedCount, 1);
      assert.deepEqual(readFileSync(file), bytes(model)); assert.deepEqual(ioOrder, ["write", "close"]);
    });
    control("retains primary then close failure in order with the primary as cause", (context, file) => {
      const primary = new Error("controlled primary fixture write failure"), secondary = new Error("controlled secondary fixture close failure"); writeFault = primary; closeFault = secondary;
      assert.throws(() => actual(context, model), error => {
        assert.ok(error instanceof AggregateError); assert.deepEqual(error.errors, [primary, secondary]); assert.equal(error.errors[0], primary); assert.equal(error.errors[1], secondary);
        assert.equal(error.cause, primary); return true;
      });
      assert.equal(opened.size, 0); assert.equal(openedCount, 1); assert.equal(readFileSync(file).length, 0); assert.deepEqual(ioOrder, ["write", "close"]);
    });
    control("refuses a zero-progress write and closes the opened handle", (context, file) => {
      zeroWrite = true; assert.throws(() => actual(context, model), /ADMIN_FIXTURE_WRITE_INCOMPLETE/u); assert.equal(writes, 1); assert.equal(readFileSync(file).length, 0);
    });
    control("closes the exact retained handle after an incomplete read", (context, file) => {
      const state = actual(context, model); readFault = true; assert.throws(() => actual(context, model, state), /ADMIN_FIXTURE_READ_INCOMPLETE/u); assert.deepEqual(readFileSync(file), bytes(model));
    });
    control("detects pathname replacement after opening and closes the originally opened handle", (context, file) => {
      const state = actual(context, model); afterOpen = () => { nativeFs.renameSync(file, path.join(context.runDirectory, "opened-original.json")); writeFileSync(file, bytes(model), { flag: "wx" }); };
      assert.throws(() => actual(context, model, state), /ADMIN_FIXTURE_IDENTITY_CHANGED/u); assert.deepEqual(readFileSync(file), bytes(model));
    });
  } finally {
    assert.equal(path.resolve(directory), directory); assert.ok(directory.startsWith(base + path.sep)); assert.equal(realpathSync(directory), directory);
    rmSync(directory, { recursive: true, force: true }); assert.equal(existsSync(directory), false);
  }
  assert.equal(readSource(ownerPath), ownerSource, "The executed producer source must remain unchanged.");
}

/** Project the actual private floor and its unchanged budget; never duplicate its execution logic. */
function orderedSourceFloorControlSource(tree: ts.SourceFile) {
  return ["localVerificationQualityPrefixDeadlineMs", "localVerificationOperationalDeadlineMs", "runLocalVerificationSourceFloor"].map(name => {
    const found = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(found.length, 1, "Missing unique ordered verification owner: " + name);
    return found[0].getText(tree).replace(/^export /u, "");
  }).join("\n");
}

/** Bounded ports execute the actual source floor without starting a process, Browser, Docker or database. */
async function verifyOrderedLocalVerificationControls() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const tree = ts.createSourceFile("owner.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const code = ts.transpileModule(orderedSourceFloorControlSource(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  type Child = { code: number; stdout: string; stderr: string; rawExit: { code: number | null; signal: string | null };
    cleanup: { status: string; liveProcesses: number; processTreeVerified: boolean } };
  type Floor = { contextSha256: string; sourceSha256: string; syntaxFiles: string[]; checks: Array<{ stage: string; step: string; limitMs: number; result: Child }> };
  type Options = { sourceDirectory: string; context: { runDirectory: string; sanitize(value: string): string; cleanEnvironment(): NodeJS.ProcessEnv };
    operationalBudget?: import("./lib/isolated-public-verification.mts").LocalVerificationOperationalBudget;
    signal: AbortSignal; sources: Map<string, string | Buffer>; changedFiles: readonly string[]; verifySource(): void;
    drainControlPulse?: () => Promise<void>;
    governance: readonly { step: string; limitMs: number; successMarker?: string }[]; governanceQualified: boolean; prior?: Floor };
  const fixture = (fault: { stage?: string; code?: number; childError?: Error; cleanupError?: Error; abortAfter?: string; driftAt?: number } = {}) => {
    const events: string[] = [], launches: Array<{ name: string; args: string[]; environment: NodeJS.ProcessEnv; limitMs: number }> = [];
    const saved: Array<{ name: string; value: Record<string, unknown> }> = [], children = new Set<ChildProcess>();
    const controller = new AbortController(), cancelled = Error("Controlled ordered cancellation");
    const original: Child = { code: fault.code ?? 0, stdout: "", stderr: "", rawExit: { code: fault.code ?? 0, signal: null },
      cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true } };
    const sourceDirectory = path.join(root, ".tmp-qa", "controlled-order-no-files");
    const sources = new Map<string, string | Buffer>([["package.json", JSON.stringify({ scripts: { lint: "eslint --max-warnings=0", typecheck: "tsc --noEmit" } })],
      ["control.mts", "export const value: number = 1;"], ["view.tsx", "export const View = () => <div />;"], ["view.jsx", "export const View = () => <div />;"]]);
    let snapshots = 0;
    const options: Options = { sourceDirectory, sources, changedFiles: [], signal: controller.signal,
      context: { runDirectory: sourceDirectory, sanitize: value => value, cleanEnvironment: () => ({ NODE_ENV: "test", PATH: "controlled-path", TEMP: "controlled-temp", PRIVATE_SECRET: "excluded" }) },
      verifySource() { events.push("snapshot"); if (++snapshots === fault.driftAt) throw Error("Controlled ordered source drift"); },
      governance: [{ step: "node scripts/verify-controlled.mjs", limitMs: 17_000, successMarker: "controlled governance PASS" },
        { step: "node scripts/verify-controlled.mjs", limitMs: 17_000, successMarker: "controlled governance PASS" }], governanceQualified: true };
    const run = new Function("assert", "ts", "digest", "process", "join", "receipt", "runOwnedVerificationChild", "stopChild", code + ";return runLocalVerificationSourceFloor;")(
      assert, ts, sha256, { execPath: "controlled-node", version: "controlled-version", versions: { v8: "controlled-v8" }, execArgv: [] }, path.join,
      (_context: unknown, name: string, value: Record<string, unknown>) => { saved.push({ name, value }); if (name === "ordered-source-syntax.json") events.push("syntax"); },
      async (ports: { children: Set<ChildProcess> }, args: string[], environment: NodeJS.ProcessEnv, name: string, limitMs: number) => {
        launches.push({ name, args, environment, limitMs }); events.push(name);
        if (fault.abortAfter === name) controller.abort(cancelled);
        if (fault.stage === name) {
          const child = new EventEmitter() as ChildProcess; ports.children.add(child); children.add(child);
          if (fault.childError) throw fault.childError;
          return original;
        }
        return { code: 0, stdout: "controlled governance PASS", stderr: "", rawExit: { code: 0, signal: null }, cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true } };
      }, async (child: ChildProcess) => {
        events.push("cleanup-enter"); await Promise.resolve(); children.delete(child); events.push("cleanup-complete");
        if (fault.cleanupError) throw fault.cleanupError;
      }) as (options: Options) => Promise<Floor>;
    return { options, run: () => run(options), events, launches, saved, children, controller, cancelled, original };
  };
  const control = async (name: string, operation: () => Promise<void>) => { await operation(); cases.push("Ordered verification " + name); };
  await control("actual source floor executes Syntax ESLint TypeScript then qualified Governance exactly once per leaf", async () => {
    const value = fixture(), result = await value.run(); value.events.push("behavior", "admission");
    assert.deepEqual(value.events.filter(event => event !== "snapshot"), ["syntax", "ordered-1-eslint", "ordered-2-typescript", "ordered-3-governance", "behavior", "admission"]);
    assert.deepEqual(result.checks.map(check => check.stage), ["eslint", "typescript", "governance"]);
    assert.equal(new Set(value.launches.map(launch => launch.args.join(" "))).size, 3);
    assert.deepEqual(result.syntaxFiles, ["control.mts", "view.jsx", "view.tsx"]);
    assert.ok(value.launches.every(launch => launch.environment.PRIVATE_SECRET === undefined && launch.environment.CI === "1"));
    assert.deepEqual(value.launches.map(launch => launch.limitMs), [1_800_000, 1_800_000, 17_000]);
  });
  await control("explicit operational scope doubles each external source-floor leaf once and cannot borrow default-budget receipts", async () => {
    const value = fixture(), original = await value.run(); value.options.prior = original;
    value.options.operationalBudget = "pr229-20261103-double-operational"; value.launches.length = 0;
    const expanded = await value.run();
    assert.deepEqual(value.launches.map(launch => launch.limitMs), [3_600_000, 3_600_000, 34_000]);
    assert.deepEqual(expanded.checks.map(check => check.limitMs), [3_600_000, 3_600_000, 34_000]);
    value.options.prior = expanded; value.launches.length = 0;
    assert.deepEqual((await value.run()).checks, expanded.checks); assert.equal(value.launches.length, 0);
    delete value.options.operationalBudget;
    await value.run(); assert.deepEqual(value.launches.map(launch => launch.limitMs), [1_800_000, 1_800_000, 17_000]);
  });
  await control("malformed Syntax refuses every executable leaf with a bounded diagnostic", async () => {
    const value = fixture(); value.options.sources.set("control.mts", "export const = ;");
    await assert.rejects(value.run(), (error: unknown) => error instanceof assert.AssertionError && error.message.startsWith("Ordered Syntax check failed: control.mts;") && error.message.length <= 256);
    assert.deepEqual(value.launches, []); assert.equal(value.events.includes("syntax"), false);
  });
  await control("ambiguous duplicate deadlines cannot silently reuse a completed leaf", async () => {
    const value = fixture(); value.options.governance = [value.options.governance[0], { ...value.options.governance[0], limitMs: 17_001 }];
    await assert.rejects(value.run(), /Duplicate leaf has an ambiguous deadline/u); assert.equal(value.launches.length, 3);
  });
  await control("qualified Governance still requires its actual original success marker", async () => {
    const value = fixture(); value.options.governance = [{ ...value.options.governance[0], successMarker: "missing qualified marker" }];
    await assert.rejects(value.run(), /Qualified Governance leaf lacks its original success marker/u); assert.equal(value.launches.length, 3);
  });
  for (const [stage, code, expected] of [["ordered-1-eslint", 17, ["ordered-1-eslint"]], ["ordered-2-typescript", 2, ["ordered-1-eslint", "ordered-2-typescript"]]] as const)
    await control(stage + " failure preserves its original exit and blocks all dependent heavy work", async () => {
      const value = fixture({ stage, code });
      await assert.rejects(value.run().then(() => { value.events.push("behavior", "admission"); }), (error: unknown) => {
        assert.ok(error instanceof Error && "childResult" in error); assert.equal(error.childResult, value.original);
        assert.equal((error.childResult as Child).code, code); assert.equal(Object.getOwnPropertyDescriptor(error, "childResult")?.enumerable, false); return true;
      });
      assert.deepEqual(value.launches.map(launch => launch.name), [...expected]);
      assert.equal(value.events.includes("behavior"), false); assert.equal(value.events.includes("admission"), false);
      assert.equal(value.children.size, 0); assert.equal(value.events.at(-1), "cleanup-complete");
    });
  await control("pre-cancellation starts no syntax receipt or child", async () => {
    const value = fixture(); value.controller.abort(value.cancelled); await assert.rejects(value.run(), error => error === value.cancelled);
    assert.deepEqual(value.launches, []); assert.deepEqual(value.saved, []);
  });
  await control("mid-floor cancellation preserves its cause and prevents the next leaf", async () => {
    const value = fixture({ abortAfter: "ordered-1-eslint" }); await assert.rejects(value.run(), error => error === value.cancelled);
    assert.deepEqual(value.launches.map(launch => launch.name), ["ordered-1-eslint"]);
  });
  await control("child rejection retains its exact error while awaited cleanup completes", async () => {
    const original = Error("Controlled ordered child failure"), value = fixture({ stage: "ordered-2-typescript", childError: original });
    await assert.rejects(value.run(), error => error === original); assert.equal(value.children.size, 0); assert.equal(value.events.at(-1), "cleanup-complete");
  });
  await control("cleanup rejection remains secondary to the original TypeScript failure", async () => {
    const cleanup = Error("Controlled ordered cleanup failure"), value = fixture({ stage: "ordered-2-typescript", code: 2, cleanupError: cleanup });
    await assert.rejects(value.run(), (error: unknown) => error instanceof Error && "childResult" in error && error.childResult === value.original
      && Object.getOwnPropertyDescriptor(error, "sourceFloorCleanupFailure")?.value === cleanup);
    assert.equal(value.events.at(-1), "cleanup-complete");
  });
  await control("source drift between Syntax and ESLint blocks execution", async () => {
    const value = fixture({ driftAt: 5 }); await assert.rejects(value.run(), /Controlled ordered source drift/u); assert.deepEqual(value.launches, []);
  });
  await control("same live execution context reuses exact passed leaves without executing duplicates", async () => {
    const value = fixture(), prior = await value.run(); value.options.prior = prior; value.launches.length = 0;
    const repeated = await value.run(); assert.equal(value.launches.length, 0); assert.deepEqual(repeated.checks, prior.checks);
  });
  await control("changed context or source cannot borrow a prior source-floor PASS", async () => {
    for (const mutate of [(options: Options) => { options.sourceDirectory += "-different"; },
      (options: Options) => { options.sources.set("control.mts", "export const value: number = 2;"); },
      (options: Options) => { options.context.cleanEnvironment = () => ({ NODE_ENV: "test", PATH: "changed-path" }); }]) {
      const value = fixture(); value.options.prior = await value.run(); mutate(value.options); value.launches.length = 0;
      await value.run(); assert.equal(value.launches.length, 3);
    }
  });
  await control("missing affected qualification parses complete source and retains conservative Full Gate fallback", async () => {
    const value = fixture(); value.options.governanceQualified = false;
    await assert.rejects(value.run(), /conservative Full Gate fallback remains required/u);
    assert.deepEqual(value.launches.map(launch => launch.name), ["ordered-1-eslint", "ordered-2-typescript"]);
    assert.equal(value.saved[0].value.fallback, "complete_source_without_affected_qualification");
  });
  await control("live source units yield to queued heartbeat work before draining the existing pulse", async () => {
    const value = fixture(); let ready = false, pulses = 0;
    setImmediate(() => { ready = true; });
    value.options.drainControlPulse = async () => { assert.equal(ready, true); pulses++; value.events.push("pulse"); };
    const result = await value.run();
    assert.ok(pulses >= result.syntaxFiles.length + result.checks.length);
    for (let index = 0; index < value.events.length; index++) if (value.events[index] === "snapshot")
      assert.equal(value.events[index - 1], "pulse");
    assert.deepEqual(value.launches.map(row => row.name), ["ordered-1-eslint", "ordered-2-typescript", "ordered-3-governance"]);
  });
  await control("synchronous source work remains ordered while queued heartbeat callbacks run between units", async () => {
    const value = fixture(); let beats = 0, stopped = false;
    const beat = () => { if (!stopped) { beats++; setImmediate(beat); } };
    setImmediate(beat);
    const verify = value.options.verifySource;
    value.options.verifySource = () => { verify(); const end = performance.now() + 4; while (performance.now() < end) { /* bounded synchronous source unit */ } };
    value.options.drainControlPulse = async () => { assert.ok(beats > 0); };
    try { await value.run(); assert.ok(beats > value.options.sources.size); }
    finally { stopped = true; await new Promise<void>(done => setImmediate(done)); }
    assert.deepEqual(value.saved.filter(row => /^ordered-source-\d+\.json$/u.test(row.name)).map(row => row.value.stage), ["eslint", "typescript", "governance"]);
  });
  await control("failed existing heartbeat retains its exact error and starts no dependent child", async () => {
    const value = fixture(), failure = Error("Controlled existing heartbeat failure");
    value.options.drainControlPulse = async () => { throw failure; };
    await assert.rejects(value.run(), error => error === failure);
    assert.deepEqual(value.launches, []); assert.deepEqual(value.saved, []); assert.equal(value.children.size, 0);
  });
  await control("cancellation during heartbeat drain prevents the next source unit and child", async () => {
    const value = fixture();
    value.options.drainControlPulse = async () => { value.controller.abort(value.cancelled); };
    await assert.rejects(value.run(), error => error === value.cancelled);
    assert.deepEqual(value.launches, []); assert.deepEqual(value.saved, []); assert.deepEqual(value.events, []);
  });
  await control("actual public source floor adopts the existing private heartbeat drain", async () => {
    const publicRun = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification");
    assert.ok(publicRun); const calls: ts.CallExpression[] = [];
    const visit = (node: ts.Node) => { if (ts.isCallExpression(node) && node.expression.getText(tree) === "runLocalVerificationSourceFloor") calls.push(node); ts.forEachChild(node, visit); };
    visit(publicRun); assert.equal(calls.length, 1); assert.ok(ts.isObjectLiteralExpression(calls[0].arguments[0]));
    const drains = calls[0].arguments[0].properties.filter(node => ts.isShorthandPropertyAssignment(node) && node.name.text === "drainControlPulse");
    assert.equal(drains.length, 1);
  });
  assert.equal(readSource("scripts/lib/isolated-public-verification.mts"), source, "Ordered execution owner changed during controlled verification.");
}

async function verifyAdminMeasurementControlLease(owner: typeof import("./lib/isolated-supabase.mts")) {
  await verifyPreparationCancellationContracts(owner);
  await verifyOwnedPreparationLifecycle(owner);
  await verifyPublicSourceHeartbeatBoundary(owner);
  const cliControl = await verifyIsolatedApplicationCliPulse();
  cases.push(...cliControl.names.map((name: string) => `CLI control pulse: ${name}`));
  // Exercise the real private receipt validator as well as the exported lease.
  // No socket, database, clock wait, environment loader or lifecycle is started.
  const source = readSource("scripts/lib/isolated-supabase.mts");
  const declaration = source.slice(source.indexOf("  const safeRecord ="), source.indexOf("  const events:"));
  assert.ok(declaration.includes("UNSAFE_RECEIPT_KEY"));
  const receipt = new Function("requireThat", "privateValues", "events", "recordFile", "process",
    ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return safeRecord;")(
    (value: unknown, code: string) => assert.ok(value, code), [], [], () => {}, { stdout: { write() {} } });
  function setup() {
    let time = 0, connections = 0, owned = 0, queryFailure = false, ownershipFailure = false, expireOnQuery = false;
    let connectFailure: Error | undefined = new owner.IsolatedSupabaseError("ECONNRESET", "database-connect");
    let identity = { database: "postgres", role: "postgres", backend_pid: 11 };
    const make = (pid: number) => Object.assign(new EventEmitter(), {
      closed: false, queries: 0, async connect() {},
      async query() {
        this.queries++;
        if (queryFailure) throw new Error("old-query-failed");
        if (expireOnQuery) time = 480_000;
        return { rows: [pid === 11 ? identity : { database: "postgres", role: "postgres", backend_pid: pid }], rowCount: 1 };
      },
      async end() { this.closed = true; },
    });
    const first = make(11), second = make(12), records: Array<Record<string, unknown>> = [];
    const observer = owner.observeApplicationClient(first, () => {});
    const lease = owner.createAdminMeasurementControlLease(first, {
      now: () => time,
      connect: async () => { connections++; if (connectFailure) throw connectFailure; return second; },
      assertHealthy: () => observer.assertHealthy(),
      assertOwned: async () => { owned++; if (ownershipFailure) throw new Error("ownership-lost"); },
      watch: client => observer.watch(client), replaced: () => {},
      record: row => {
        receipt(row.deferred === true ? "admin-control-connection-deferred" : "admin-control-connection-renewed", row);
        records.push(row);
      },
    });
    time = 240_000;
    return {
      lease, first, second, records, connections: () => connections, owned: () => owned,
      setTime: (value: number) => { time = value; }, setError: (error?: Error) => { connectFailure = error; },
      loseOwnership: () => { ownershipFailure = true; }, failQuery: () => { queryFailure = true; },
      expireOnQuery: () => { expireOnQuery = true; }, wrongIdentity: () => { identity = { ...identity, role: "other" }; },
    };
  }
  {
    const t = setup();
    await Promise.all([t.lease.renewIfDue(true), t.lease.renewIfDue(true)]);
    assert.equal(t.connections(), 1); assert.equal(t.first.queries, 1); assert.equal(t.owned(), 3);
    assert.equal(t.first.closed, false); assert.equal(t.lease.client, t.first);
    assert.equal(t.records[0].deferred, true); assert.equal(t.records[0].previousAgeMs, 240_000);
    t.setError(); t.setTime(260_000); await t.lease.renewIfDue(true);
    assert.equal(t.connections(), 2); assert.equal(t.first.closed, true); assert.equal(t.lease.client, t.second);
    assert.equal(t.records[1].previousAgeMs, 260_000); assert.equal(t.records[1].previousSocketClosed, true);
    cases.push("control lease defers a fresh reset only on verified current identity, serializes callers, retains original deadline, then validates and swaps on next heartbeat; actual receipts pass");
  }
  {
    const t = setup(); t.first.emit("error", new Error("idle-error"));
    await assert.rejects(t.lease.renewIfDue(true), /APPLICATION_CLIENT_DISCONNECTED/); assert.equal(t.connections(), 0);
    cases.push("control lease never reconnects a failed current session");
  }
  {
    const t = setup(); t.loseOwnership();
    await assert.rejects(t.lease.renewIfDue(true), /ownership-lost/); assert.equal(t.connections(), 0);
    cases.push("control lease rejects lost ownership before connecting");
  }
  {
    const t = setup(); t.failQuery();
    await assert.rejects(t.lease.renewIfDue(true), /old-query-failed/); assert.equal(t.records.length, 0); assert.equal(t.first.queries, 1);
    assert.equal(t.lease.client, t.first);
    cases.push("control lease never replays a failed current read or reports it as deferred");
  }
  {
    const t = setup(); t.wrongIdentity();
    await assert.rejects(t.lease.renewIfDue(true), /ADMIN_CONTROL_IDENTITY_MISMATCH/); assert.equal(t.records.length, 0);
    cases.push("control lease requires the current role identity for deferral");
  }
  for (const duringQuery of [false, true]) {
    const t = setup(); if (duringQuery) t.expireOnQuery(); else t.setTime(480_000);
    await assert.rejects(t.lease.renewIfDue(true), /ADMIN_CONTROL_LEASE_RENEWAL_OVERDUE/);
    assert.equal(t.records.length, 0); assert.equal(t.connections(), duringQuery ? 1 : 0);
  }
  cases.push("control lease enforces eight minutes before attempt and after validation without resetting birth time");
  for (const error of [new owner.IsolatedSupabaseError("ECONNREFUSED", "database-connect"), new owner.IsolatedSupabaseError("ECONNRESET", "ownership"), new Error("ECONNRESET")]) {
    const t = setup(); t.setError(error);
    await assert.rejects(t.lease.renewIfDue(true), value => value === error); assert.equal(t.first.queries, 0); assert.equal(t.records.length, 0);
  }
  cases.push("control lease permits only sanitized database-connect ECONNRESET; other codes, stages and raw errors fail closed");
  {
    const t = setup(); await t.lease.renewIfDue(false); assert.equal(t.connections(), 0);
    t.setTime(239_999); await t.lease.renewIfDue(true); assert.equal(t.connections(), 0);
    cases.push("control lease does no connection or probe outside active Admin jobs or before renewal is due");
  }
  {
    const t = setup(); t.setTime(1); t.setError();
    await t.lease.renewIfDue(false, true); assert.equal(t.connections(), 0);
    await t.lease.renewIfDue(true, true);
    assert.equal(t.connections(), 1); assert.equal(t.first.closed, true); assert.equal(t.lease.client, t.second);
    assert.equal(t.records[0].previousAgeMs, 1);
    cases.push("explicit verified idle phase renews early through the same healthy identity and closes the prior socket");
  }
  {
    const t = setup(); t.setTime(1);
    await assert.rejects(t.lease.renewIfDue(true, true), /ECONNRESET/);
    assert.equal(t.connections(), 1); assert.equal(t.first.closed, false); assert.equal(t.records.length, 0);
    cases.push("explicit idle phase cannot continue on a deferred fresh socket failure");
  }
  {
    const t = setup(); t.setTime(480_000); t.setError();
    await assert.rejects(t.lease.renewIfDue(true, true), /ADMIN_CONTROL_LEASE_RENEWAL_OVERDUE/);
    assert.equal(t.connections(), 0);
    cases.push("explicit idle phase preserves the existing lease deadline without reconnecting an expired control socket");
  }
}

async function verifyPreparationCancellationContracts(api: Pick<typeof import("./lib/isolated-supabase.mts"), "observeApplicationClient">) {
  const compileOnly = false as boolean;
  const contextSignal = (context: Pick<import("./lib/isolated-supabase-cli.mts").ApplicationMigrationCliContext, "signal">) => {
    if (compileOnly) {
      // @ts-expect-error A private CLI context cannot replace its caller's readonly cancellation binding.
      context.signal = new AbortController().signal;
    }
    return context.signal;
  };
  const optionSignal = (options: Pick<import("./lib/isolated-supabase.mts").IsolatedSupabaseOptions, "signal">) => options.signal;
  const cancellation = new AbortController();
  assert.equal(contextSignal({}), undefined, "CLI lifecycle cancellation remains optional for existing contexts.");
  assert.equal(optionSignal({}), undefined, "An existing lifecycle caller can omit external cancellation.");
  assert.equal(contextSignal({ signal: cancellation.signal }), cancellation.signal);
  assert.equal(optionSignal({ signal: cancellation.signal }), cancellation.signal);
  if (compileOnly) {
    // @ts-expect-error CLI cancellation accepts AbortSignal rather than an arbitrary lookalike payload.
    contextSignal({ signal: "cancel" });
    // @ts-expect-error Lifecycle options cannot accept a boolean as a cancellation signal.
    optionSignal({ signal: true });
  }
  cancellation.abort(new Error("Controlled external preparation cancellation"));
  assert.throws(() => contextSignal({ signal: cancellation.signal })!.throwIfAborted(), error => error === cancellation.signal.reason);
  assert.throws(() => optionSignal({ signal: cancellation.signal })!.throwIfAborted(), error => error === cancellation.signal.reason);
  cases.push("actual imported CLI/lifecycle option types preserve optional AbortSignal identity, caller abort reason and readonly CLI cancellation binding");
  for (const vector of [
    { error: Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" }), expected: { pgCode: "ECONNRESET", pgMessageClass: "pg_unexpected_end" } },
    { error: new Error("timeout expired"), expected: { pgCode: null, pgMessageClass: "pg_timeout_expired" } },
    { error: Object.assign(new Error("private password must stay unrecorded"), { code: "private-token" }), expected: { pgCode: null, pgMessageClass: "unclassified" } },
  ]) {
    const client = new EventEmitter(), facts: Array<{ pgCode: string | null; pgMessageClass: string }> = [];
    const observer = api.observeApplicationClient(client, row => facts.push(row));
    const pending = observer.run(() => new Promise<void>(() => undefined));
    client.emit("error", vector.error);
    await assert.rejects(pending, /APPLICATION_CLIENT_DISCONNECTED/u);
    await assert.rejects(pending, error => {
      assert.ok(error instanceof Error); assert.equal(error.cause, vector.error);
      assert.equal(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable, false);
      assert.equal(JSON.stringify(error).includes("private"), false);
      return true;
    });
    assert.deepEqual(facts, [vector.expected]);
    assert.equal(JSON.stringify(facts).includes("private"), false, "Only bounded code/class facts leave the observer.");
    client.emit("error", new Error("later failure")); assert.equal(facts.length, 1, "The first disconnect remains authoritative.");
    assert.throws(() => observer.assertHealthy(), /APPLICATION_CLIENT_DISCONNECTED/u);
  }
  {
    const client = new EventEmitter();
    const pgError = Object.assign(new Error("Connection terminated"), { code: "ECONNRESET" });
    const receiptError = new Error("Secondary private receipt failure");
    const observer = api.observeApplicationClient(client, () => { throw receiptError; });
    const pending = observer.run(() => new Promise<void>(() => undefined));
    client.emit("error", pgError);
    await assert.rejects(pending, /APPLICATION_CLIENT_RECEIPT_FAILED/u);
    assert.throws(() => observer.assertHealthy(), /APPLICATION_CLIENT_RECEIPT_FAILED/u);
    await assert.rejects(pending, error => {
      assert.ok(error instanceof Error);
      const originalDisconnect = error.cause;
      assert.ok(originalDisconnect instanceof Error);
      assert.equal((originalDisconnect as Error & { code: string }).code, "APPLICATION_CLIENT_DISCONNECTED");
      assert.equal(originalDisconnect.cause, pgError);
      assert.equal((error as Error & { receiptCause: unknown }).receiptCause, receiptError);
      for (const [object, property] of [[error, "cause"], [error, "receiptCause"], [originalDisconnect, "cause"]] as const)
        assert.equal(Object.getOwnPropertyDescriptor(object, property)?.enumerable, false);
      assert.equal(JSON.stringify(error).includes("private"), false);
      client.emit("error", new Error("later private transport failure"));
      assert.throws(() => observer.assertHealthy(), retained => retained === error);
      return true;
    });
  }
  cases.push("canonical pg observer retains safe code/message class, refuses raw error payloads, preserves first disconnect and fails closed on receipt failure");
}

async function verifyOwnedPreparationLifecycle(owner: typeof import("./lib/isolated-supabase.mts")) {
  const setup = (phaseLimitMs = 100, totalLimitMs = 150) => {
    let time = 0, age: number | null = null, cancellations = 0;
    const records: Array<Record<string, unknown>> = [], signal = new AbortController();
    const lifecycle = owner.createOwnedPreparationLifecycle({ phaseLimitMs, totalLimitMs, now: () => time,
      signal: signal.signal, controlAgeMs: () => age, record: value => records.push(value), cancel: () => { cancellations++; } });
    return { lifecycle, records, signal, setTime(value: number) { time = value; }, setAge(value: number | null) { age = value; }, cancelled: () => cancellations };
  };
  {
    const t = setup();
    try {
      t.lifecycle.enter("platform"); t.setTime(90); t.lifecycle.enter("admin-fixture"); t.setTime(149); t.lifecycle.check();
      t.setTime(150); assert.throws(() => t.lifecycle.check(), /PREPARATION_TOTAL_TIMEOUT/);
      assert.equal(t.cancelled(), 1); assert.equal(t.lifecycle.signal.aborted, true);
      assert.equal(t.records.at(-1)?.phase, "admin-fixture"); assert.equal(t.records.at(-1)?.totalDurationMs, 150);
      assert.throws(() => t.lifecycle.enter("retry"), /PREPARATION_TOTAL_TIMEOUT/); assert.equal(t.cancelled(), 1);
    } finally { t.lifecycle.close(); }
    cases.push("preparation aggregate deadline survives phase transitions and preserves the first failure without retry");
  }
  {
    const t = setup();
    try {
      t.lifecycle.enter("admin-fixture"); t.setTime(99); t.lifecycle.check(); t.setTime(100);
      assert.throws(() => t.lifecycle.check(), /PREPARATION_PHASE_TIMEOUT/);
      assert.equal(t.records.at(-1)?.phaseDurationMs, 100); assert.equal(t.cancelled(), 1);
    } finally { t.lifecycle.close(); }
    cases.push("each preparation phase fails at its exact finite deadline with phase and duration evidence");
  }
  {
    const t = setup();
    try {
      t.lifecycle.enter("fixture"); t.setTime(60); t.lifecycle.pause(); t.setTime(5_000); t.lifecycle.check();
      t.lifecycle.enter("after-gate-fixture"); t.setTime(5_089); t.lifecycle.check(); t.setTime(5_090);
      assert.throws(() => t.lifecycle.check(), /PREPARATION_TOTAL_TIMEOUT/);
    } finally { t.lifecycle.close(); }
    cases.push("gate time is excluded while later preparation retains the same cumulative operating budget");
  }
  {
    const t = setup();
    try {
      t.lifecycle.enter("fixture"); t.setAge(240_000); t.lifecycle.check(); t.lifecycle.check();
      assert.equal(t.records.filter(row => row.code === "PREPARATION_CONTROL_RENEWAL_DUE").length, 1);
      t.setAge(480_000); assert.throws(() => t.lifecycle.check(), /PREPARATION_CONTROL_LEASE_OVERDUE/);
      assert.equal(t.records.at(-1)?.controlAgeMs, 480_000); assert.equal(t.cancelled(), 1);
    } finally { t.lifecycle.close(); }
    cases.push("preparation observes control age before expiry and fails closed at the existing eight-minute lease bound");
  }
  {
    const t = setup(); let finished = false, release: (() => void) | undefined;
    try {
      t.lifecycle.enter("fixture");
      const work = t.lifecycle.run(async () => { await new Promise<void>(resolve => { release = resolve; }); finished = true; });
      await Promise.resolve(); t.signal.abort();
      await assert.rejects(work, error => error === t.lifecycle.failure);
      assert.equal(t.cancelled(), 1); assert.equal(finished, false); release!(); await Promise.resolve();
      await assert.rejects(t.lifecycle.run(async () => { throw Error("must not launch"); }), /PREPARATION_CANCELLED/);
    } finally { t.lifecycle.close(); }
    cases.push("preparation cancellation rejects awaited work with original failure and prohibits later allocation; cleanup is an explicit owner port");
  }
  for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => setup(limit), /INVALID_PREPARATION_BUDGET/);
    assert.throws(() => setup(100, limit), /INVALID_PREPARATION_BUDGET/);
  }
  cases.push("nonfinite or nonpositive preparation limits are rejected before starting lifecycle work");
  {
    let time = 0;
    const lifecycle = owner.createOwnedPreparationLifecycle({ phaseLimitMs: 10, totalLimitMs: 100, now: () => time,
      controlAgeMs: () => 11, record() { throw Error("Secondary evidence failure"); }, cancel() { throw Error("Secondary cancellation failure"); } });
    try {
      lifecycle.enter("fixture"); time = 10;
      assert.throws(() => lifecycle.check(), error => error === lifecycle.failure && /PREPARATION_PHASE_TIMEOUT/u.test(String(error)));
      assert.equal(lifecycle.signal.aborted, true); assert.equal(lifecycle.snapshot().cancellationPortFailed, true);
    } finally { lifecycle.close(); }
    cases.push("secondary receipt/cancellation-port errors cannot replace the original timeout and cancellation weakness remains explicit");
  }
  {
    const t = setup(); let release: (() => void) | undefined;
    try {
      t.lifecycle.enter("fixture");
      const pending = t.lifecycle.run(() => new Promise<void>(resolve => { release = resolve; }));
      await Promise.resolve(); t.setTime(100);
      assert.throws(() => t.lifecycle.check(), /PREPARATION_PHASE_TIMEOUT/);
      await assert.rejects(pending, error => error === t.lifecycle.failure);
      assert.equal(t.cancelled(), 1); assert.equal(t.lifecycle.snapshot().phase, "fixture"); release!();
    } finally { t.lifecycle.close(); }
    cases.push("phase deadline rejects the actual awaited preparation body through the cancellation port with original timeout identity");
  }
  const file = ts.createSourceFile("isolated-supabase.mts", readSource("scripts/lib/isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let renewal: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(file) === "renewPreparationControl") renewal = node; ts.forEachChild(node, visit); }; visit(file);
  assert.ok(renewal?.initializer);
  {
    const declarations = new Map<string, ts.VariableDeclaration>();
    const find = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && ["runPreparationPhase", "handoffJob"].includes(node.name.getText(file))) declarations.set(node.name.getText(file), node); ts.forEachChild(node, find); }; find(file);
    const source = declarations.get("runPreparationPhase")!.initializer!.getText(file);
    const handoff = declarations.get("handoffJob")!.initializer!.getText(file);
    for (const removeGuard of [false, true]) {
      let release: (() => void) | undefined, started = 0;
      const t = setup(), jobs = new Set<Promise<unknown>>();
      const selected = removeGuard ? source.replace("preparation!.check(); preparation!.signal.throwIfAborted(); return body();", "return body();") : source;
      assert.ok(!removeGuard || selected !== source);
      const compiled = ts.transpileModule("return " + selected, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      const run = new Function("preparation", "preparationJobs", "renewPreparationControl", compiled)(t.lifecycle, jobs,
        () => new Promise<void>(resolve => { release = resolve; })) as (phase: string, body: () => Promise<void>) => Promise<void>;
      try {
        const pending = run("fixture", async () => { started++; });
        t.lifecycle.cancel(); release!(); await assert.rejects(pending, /PREPARATION_CANCELLED/); await Promise.resolve();
        assert.equal(started, removeGuard ? 1 : 0);
      } finally { t.lifecycle.close(); }
    }
    {
      let started = 0; const t = setup(); t.lifecycle.enter("application-handoff");
      const compiled = ts.transpileModule("return " + handoff, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      try {
        const pending = new Function("preparation", "options", "boundHandle", compiled)(t.lifecycle, { handoff: async () => { started++; } }, {});
        t.lifecycle.cancel(); await assert.rejects(pending, /PREPARATION_CANCELLED/); assert.equal(started, 0);
      } finally { t.lifecycle.close(); }
    }
    cases.push("actual deferred preparation and handoff callbacks refuse cancellation before their microtask; removing the preparation callback guard reproduces the forbidden launch");
  }
  const compile = ts.transpileModule("return " + renewal.initializer.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const state of ["idle", "transaction", "failed"] as const) {
    let calls = 0, records = 0;
    const t = setup(); t.lifecycle.enter("fixture"); t.setAge(240_000);
    const expected = new owner.IsolatedSupabaseError(state === "transaction" ? "CONTROL_TRANSACTION_OPEN" : "APPLICATION_CLIENT_DISCONNECTED", "application-query");
    const run = new Function("preparation", "applicationLease", "controlMaintenance", "controlQueries", "pendingScopedConnections", "scopedConnections", "cliJob", "publicJob", "handle", "safeRecord", "IsolatedSupabaseError", compile)(
      t.lifecycle, { ageMs: () => 240_000 }, false, 0, 0, new Set(), undefined, undefined,
      { async renewDatabaseControlConnection() { calls++; if (state !== "idle") throw expected; } }, () => { records++; }, owner.IsolatedSupabaseError) as () => Promise<void>;
    try {
      if (state === "failed") await assert.rejects(run(), error => error === expected);
      else await run();
      assert.equal(calls, 1); assert.equal(records, state === "transaction" ? 1 : 0);
    } finally { t.lifecycle.close(); }
  }
  cases.push("actual preparation query boundary uses the verified-idle renewal port, skips an active transaction, and propagates failed-session transport without retry");
  const source = file.text;
  assert.ok(source.indexOf('await verifyOwnedProcessReadiness(') < source.indexOf('const prewarmStartedAt'));
  assert.ok(source.includes('preparation?.pause();') && source.includes('query_timeout: 30000'));
  assert.ok(source.includes('preparationJobs') && source.includes('PREPARATION_DRAIN_TIMEOUT'));
  cases.push("fresh lifecycle qualifies process permissions before Docker work and retains bounded preparation drain and client query timeout");
  {
    const cli = ts.createSourceFile("qa-isolated-supabase.mts", readSource("scripts/qa-isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const proof = cli.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "connectionLifecycleProof");
    assert.ok(proof && ts.isFunctionDeclaration(proof) && proof.body);
    const variables = proof.body.statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []);
    const binding = (name: string) => { const matches = variables.filter(node => node.name.getText(cli) === name); assert.equal(matches.length, 1); return matches[0]!; };
    const names = ["originalExecutionDeadlineMs", "operationalBudget", "executionDeadlineMs"];
    const declarations = names.map(name => `const ${binding(name).getText(cli)};`).join("\n");
    assert.equal(binding("originalExecutionDeadlineMs").initializer?.getText(cli), "420_000");
    assert.equal(binding("executionDeadlineMs").initializer?.getText(cli), "localVerificationOperationalDeadlineMs(originalExecutionDeadlineMs, operationalBudget)");
    const timer = binding("timer"); assert.ok(timer.initializer && ts.isCallExpression(timer.initializer));
    assert.equal(timer.initializer.expression.getText(cli), "setTimeout");
    assert.equal(timer.initializer.arguments[1].getText(cli), "executionDeadlineMs");
    let delay: number | undefined, timeout: (() => void) | undefined;
    const controller = new AbortController(), deadlineOwner = await import("./lib/isolated-public-verification.mts");
    const bound = new Function("localVerificationOperationalDeadlineMs", "controller", "IsolatedSupabaseError", "setTimeout",
      ts.transpileModule(`${declarations}\nconst ${timer.getText(cli)};\nreturn {${names.join(",")},timer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
      deadlineOwner.localVerificationOperationalDeadlineMs, controller, owner.IsolatedSupabaseError,
      (callback: () => void, limit: number) => { timeout = callback; delay = limit; return "controlled-timer"; }) as Record<string, unknown>;
    assert.deepEqual(bound, { originalExecutionDeadlineMs: 420_000, operationalBudget: "pr229-20261103-double-operational", executionDeadlineMs: 840_000, timer: "controlled-timer" });
    assert.equal(delay, 840_000); assert.equal(controller.signal.aborted, false); assert.ok(timeout); timeout();
    assert.equal(controller.signal.aborted, true); assert.equal(controller.signal.reason.code, "CONNECTION_READINESS_TIMEOUT");
    assert.equal(controller.signal.reason.stage, "connection-readiness");
    const receipts: ts.ObjectLiteralExpression[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(cli) === "save" && node.arguments[0]?.getText(cli) === '"connection-readiness-result.json"') {
        assert.ok(ts.isObjectLiteralExpression(node.arguments[1])); receipts.push(node.arguments[1]);
      }
      ts.forEachChild(node, visit);
    };
    visit(proof); assert.equal(receipts.length, 1);
    for (const name of names) assert.equal(receipts[0].properties.filter(node => ts.isShorthandPropertyAssignment(node) && node.name.text === name).length, 1);
    cases.push("actual connection CLI derives its840-second operational bound once from original420, retains exact timeout cancellation and binds both budgets in the existing receipt");
  }
}

async function verifyPublicSourceHeartbeatBoundary(owner: typeof import("./lib/isolated-supabase.mts")) {
  const lifecycle = ts.createSourceFile("isolated-supabase.mts", readSource("scripts/lib/isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const publicFile = ts.createSourceFile("isolated-public-verification.mts", readSource("scripts/lib/isolated-public-verification.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const all = (file: ts.Node, predicate: (node: ts.Node) => boolean) => { const found: ts.Node[] = []; const visit = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }; visit(file); return found; };
  const run = all(publicFile, node => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification")[0] as ts.FunctionDeclaration;
  const launch = all(lifecycle, node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "runOwnedPublicVerification");
  assert.equal(launch.length, 1); const args = (launch[0] as ts.CallExpression).arguments;
  assert.equal(args.length, 4); assert.deepEqual(args.slice(0, 3).map(node => node.getText(lifecycle)), ["publicContext", "request", "publicJobAbort.signal"]);
  assert.ok(ts.isArrowFunction(args[3])); assert.equal(run.parameters[3].name.getText(publicFile), "drainControlPulse");
  const inspectDrainBoundaries = (file: ts.SourceFile) => {
    assert.equal((file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0);
    const candidates = all(file, node => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification") as ts.FunctionDeclaration[];
    assert.equal(candidates.length, 1); const candidate = candidates[0];
    const bindings = (name: string) => all(candidate, node => (ts.isVariableDeclaration(node) || ts.isParameter(node)
      || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isBindingElement(node)) && node.name?.getText(file) === name);
    const sourceBindings = bindings("verifySource"); assert.equal(sourceBindings.length, 1, "The actual source verifier cannot be shadowed.");
    const sourceBinding = sourceBindings[0]; assert.ok(ts.isVariableDeclaration(sourceBinding));
    assert.equal(sourceBinding.parent.parent.parent === candidate.body, true);
    const archives = bindings("preserveClosedNativeArchives"); assert.equal(archives.length, 1);
    const archive = archives[0]; assert.ok(ts.isVariableDeclaration(archive)); assert.equal(archive.parent.parent.parent === candidate.body, true);
    assert.ok(archive.initializer && ts.isArrowFunction(archive.initializer) && ts.isBlock(archive.initializer.body));
    assert.ok(archive.initializer.modifiers?.some(value => value.kind === ts.SyntaxKind.AsyncKeyword));
    const archiveBody = archive.initializer.body, archiveEntry = archiveBody.statements[0];
    assert.equal(archiveEntry.getText(file), 'await drainControlPulse("archive-preservation");');
    assert.ok(ts.isExpressionStatement(archiveEntry) && ts.isAwaitExpression(archiveEntry.expression) && ts.isCallExpression(archiveEntry.expression.expression));
    const archiveDrain = archiveEntry.expression.expression;
    const archiveAwaits = all(archiveBody, ts.isAwaitExpression);
    assert.equal(archiveAwaits.length, 1, "Archive binding and copying must remain synchronous after the sole passive pulse drain.");
    assert.equal(archiveAwaits[0] === archiveEntry.expression, true);
    const archiveSources = all(archiveBody, node => ts.isCallExpression(node) && node.expression.getText(file) === "verifySource") as ts.CallExpression[];
    assert.equal(archiveSources.length, 1); const archiveSource = archiveSources[0];
    assert.ok(ts.isExpressionStatement(archiveSource.parent) && ts.isBlock(archiveSource.parent.parent));
    const archiveBinding = archiveSource.parent.parent, archiveCondition = archiveBinding.parent;
    assert.ok(ts.isIfStatement(archiveCondition) && archiveCondition.thenStatement === archiveBinding && !archiveCondition.elseStatement);
    assert.equal(archiveCondition.expression.getText(file), "!bindingChecked");
    const checkedBindings = all(archiveBody, node => (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node))
      && node.name.getText(file) === "bindingChecked");
    assert.equal(checkedBindings.length, 1); const checkedBinding = checkedBindings[0];
    assert.ok(ts.isVariableDeclaration(checkedBinding)); assert.equal(checkedBinding.parent.parent.parent === archiveBody, true);
    assert.equal(checkedBinding.initializer?.getText(file), "false");
    const archiveSourceIndex = archiveBinding.statements.indexOf(archiveSource.parent);
    assert.equal(archiveSourceIndex, archiveBinding.statements.length - 2);
    assert.equal(archiveBinding.statements[archiveSourceIndex + 1].getText(file), "bindingChecked = true;");
    const admission = archiveBinding.statements[archiveSourceIndex - 1];
    assert.ok(ts.isExpressionStatement(admission) && ts.isCallExpression(admission.expression));
    assert.equal(admission.expression.expression.getText(file), "assertLocalVerificationAdmissionQualification");
    assert.equal(admission.expression.arguments[0].getText(file), "request.admissionQualification!");
    const archiveTryBody = archiveCondition.parent; assert.ok(ts.isBlock(archiveTryBody));
    assert.equal(archiveTryBody.statements[archiveTryBody.statements.indexOf(archiveCondition) - 1].getText(file), 'stage = "source_runtime_binding";');
    const archiveTry = archiveTryBody.parent; assert.ok(ts.isTryStatement(archiveTry) && archiveTry.tryBlock === archiveTryBody);
    assert.ok(ts.isBlock(archiveTry.parent) && ts.isForOfStatement(archiveTry.parent.parent));
    assert.equal(archiveTry.parent.parent.expression.getText(file), "closedVerificationChildren");
    assert.equal(archiveTry.parent.parent.parent === archiveBody, true);
    const sourceCalls = (all(candidate, node => ts.isCallExpression(node) && node.expression.getText(file) === "verifySource") as ts.CallExpression[])
      .filter(node => node !== archiveSource);
    assert.equal(sourceCalls.length, 3);
    const sourceDrains: ts.CallExpression[] = [];
    for (const call of sourceCalls) {
      assert.ok(ts.isExpressionStatement(call.parent) && ts.isBlock(call.parent.parent));
      const statements = call.parent.parent.statements, index = statements.indexOf(call.parent);
      assert.equal(statements[index - 1].getText(file), "await drainControlPulse();", "Every source pass must immediately follow the completed control drain.");
      const preceding = statements[index - 1] as ts.ExpressionStatement;
      assert.ok(ts.isAwaitExpression(preceding.expression) && ts.isCallExpression(preceding.expression.expression));
      sourceDrains.push(preceding.expression.expression);
    }
    const stages = all(candidate, node => ts.isVariableDeclaration(node) && node.name.getText(file) === "stageInstalledDependencies") as ts.VariableDeclaration[];
    assert.equal(stages.length, 1); const stage = stages[0];
    assert.equal(stage.parent.parent.parent === candidate.body, true);
    assert.ok(stage.initializer && ts.isArrowFunction(stage.initializer) && ts.isBlock(stage.initializer.body));
    const steps = stage.initializer.body.statements.flatMap(statement => ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].filter(value => value.name.getText(file) === "step") : []);
    assert.equal(steps.length, 1); const step = steps[0];
    assert.ok(step.initializer && ts.isArrowFunction(step.initializer) && ts.isBlock(step.initializer.body));
    assert.ok(step.initializer.modifiers?.some(value => value.kind === ts.SyntaxKind.AsyncKeyword));
    assert.deepEqual(step.initializer.body.statements.map(statement => statement.getText(file)), [
      "checkpoint();", "await drainControlPulse();", "checkpoint();",
      "const value = await operation();", "checkpoint();", "return value;",
    ], "The sole additional drain belongs to the awaited dependency step before the operation and between its checkpoints.");
    const stagingDrain = all(step.initializer.body, node => ts.isCallExpression(node) && node.expression.getText(file) === "drainControlPulse") as ts.CallExpression[];
    assert.equal(stagingDrain.length, 1);
    const bound = bindings("drainControlPulse");
    assert.equal(bound.length, 1, "The private drain port cannot be shadowed by a local binding.");
    assert.equal(bound[0] === candidate.parameters[3], true, "The sole drain binding must be the actual private parameter.");
    const drains = all(candidate, node => ts.isCallExpression(node) && node.expression.getText(file) === "drainControlPulse") as ts.CallExpression[];
    assert.deepEqual(drains.map(node => node.getStart(file)).sort((a, b) => a - b),
      [...sourceDrains, ...stagingDrain, archiveDrain].map(node => node.getStart(file)).sort((a, b) => a - b), "Every drain must belong to an original source pass, the checked dependency step, or the passive archive entry.");
    return { sourceDrains, stagingDrain: stagingDrain[0], stage, step, candidate, archiveBody, archiveEntry, archiveDrain, archiveSource, archiveBinding, admission };
  };
  const drainBoundaries = inspectDrainBoundaries(publicFile);
  const replaceNode = (node: ts.Node, replacement: string) => publicFile.text.slice(0, node.getStart(publicFile)) + replacement + publicFile.text.slice(node.end);
  const rejectBoundary = (name: string, changed: string) => {
    assert.notEqual(changed, publicFile.text);
    assert.throws(() => inspectDrainBoundaries(ts.createSourceFile("isolated-public-verification.mts", changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)), name);
  };
  for (const [index, drain] of drainBoundaries.sourceDrains.entries()) {
    rejectBoundary(`omitted original source drain ${index + 1}`, replaceNode(drain.parent.parent, ""));
    rejectBoundary(`original source drain ${index + 1} cannot use the passive archive phase`, replaceNode(drain.parent.parent, 'await drainControlPulse("archive-preservation");'));
  }
  rejectBoundary("unawaited dependency drain", replaceNode(drainBoundaries.stagingDrain.parent, "drainControlPulse()"));
  const stepBody = (drainBoundaries.step.initializer as ts.ArrowFunction).body as ts.Block;
  for (const [index, statement] of stepBody.statements.entries()) {
    if (index === 0 || index === 2 || index === 4)
      rejectBoundary(`omitted dependency checkpoint ${index}`, replaceNode(statement, ""));
  }
  rejectBoundary("unawaited dependency operation", replaceNode(stepBody.statements[3], "const value = operation();"));
  const stageBody = (drainBoundaries.stage.initializer as ts.ArrowFunction).body as ts.Block;
  rejectBoundary("shadowed private dependency drain", replaceNode(stageBody, "{ const drainControlPulse = async () => {};" + stageBody.getText(publicFile).slice(1)));
  rejectBoundary("extra dependency drain outside step", replaceNode(stageBody, stageBody.getText(publicFile).slice(0, -1) + "await drainControlPulse(); }"));
  const runBody = drainBoundaries.candidate.body!;
  rejectBoundary("extra drain outside qualified boundaries", replaceNode(runBody, runBody.getText(publicFile).slice(0, -1) + "await drainControlPulse(); }"));
  rejectBoundary("omitted passive archive drain", replaceNode(drainBoundaries.archiveEntry, ""));
  rejectBoundary("unawaited passive archive drain", replaceNode(drainBoundaries.archiveEntry, 'drainControlPulse("archive-preservation");'));
  rejectBoundary("archive drain cannot use the failing live mode", replaceNode(drainBoundaries.archiveEntry, "await drainControlPulse();"));
  rejectBoundary("archive drain cannot accept an unknown passive phase", replaceNode(drainBoundaries.archiveEntry, 'await drainControlPulse("unclassified");'));
  rejectBoundary("archive work cannot yield after its entry drain", replaceNode(drainBoundaries.archiveBody,
    drainBoundaries.archiveBody.getText(publicFile).slice(0, -1) + "await Promise.resolve(); }"));
  rejectBoundary("omitted archive source binding", replaceNode(drainBoundaries.archiveSource.parent, ""));
  rejectBoundary("duplicated archive source binding", replaceNode(drainBoundaries.archiveSource.parent, "verifySource(); verifySource();"));
  rejectBoundary("archive source binding cannot follow its completion marker", replaceNode(drainBoundaries.archiveBinding,
    drainBoundaries.archiveBinding.getText(publicFile).replace("verifySource();", "").replace("bindingChecked = true;", "bindingChecked = true; verifySource();")));
  rejectBoundary("archive source binding cannot move outside its qualified block", replaceNode(drainBoundaries.archiveBody,
    drainBoundaries.archiveBody.getText(publicFile).replace("verifySource();", "").slice(0, -1) + "verifySource(); }"));
  rejectBoundary("archive source binding retains live admission qualification", replaceNode(drainBoundaries.admission, ""));
  rejectBoundary("archive source verifier cannot be shadowed", replaceNode(drainBoundaries.archiveBody,
    "{ const verifySource = () => {};" + drainBoundaries.archiveBody.getText(publicFile).slice(1)));
  rejectBoundary("unclassified extra source verification", replaceNode(runBody, runBody.getText(publicFile).slice(0, -1) + "verifySource(); }"));
  cases.push("source pulse boundaries retain three original awaited drains and reject omitted, unawaited, shadowed or extra dependency-step drains and checkpoints");
  cases.push("admission, per-gate and final source passes await the private pulse drain immediately; context/request/signal identities stay unchanged");
  cases.push("the archive source binding has one passive entry drain, no later await or shadow, and rejects omitted, duplicated, moved or unclassified source checks");
  const verify = all(run, node => ts.isVariableDeclaration(node) && node.name.getText(publicFile) === "verifySource")[0] as ts.VariableDeclaration;
  const timer = all(lifecycle, node => ts.isCallExpression(node) && node.expression.getText(lifecycle) === "setInterval" && node.getText(lifecycle).includes("public-job-heartbeat")) as ts.CallExpression[];
  assert.equal(timer.length, 1); assert.equal(timer[0].arguments[1].getText(lifecycle), "20_000");
  const launchStatement = launch[0].parent.parent; assert.ok(ts.isExpressionStatement(launchStatement) && ts.isBlock(launchStatement.parent));
  const lifecycleResult = launchStatement.parent.statements[launchStatement.parent.statements.indexOf(launchStatement) + 1];
  assert.ok(ts.isTryStatement(lifecycleResult) && lifecycleResult.catchClause && lifecycleResult.finallyBlock);
  const transpile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const factory = new Function("applicationLease", "request", "publicContext", "handle", "safeRecord", "publicJobAbort", "asSafeError", "isOwnedLocalVerificationActive",
    transpile(`let heartbeatActive=true, heartbeatBusy=false, heartbeatFailure; let pulse=Promise.resolve(); const timer=undefined;
      const tick=${timer[0].arguments[0].getText(lifecycle)}; const drain=${args[3].getText(lifecycle)};
      const settle=async(publicJob:Promise<unknown>)=>{${lifecycleResult.getText(lifecycle)}}; return {tick,drain,settle,pending:()=>pulse};`));
  const archiveSourceBoundary = (drainControlPulse: (phase?: string) => Promise<void>, verifySource: () => void, omitEntry = false) => {
    const entry = drainBoundaries.archiveEntry.getText(publicFile), sourceCheck = drainBoundaries.archiveSource.parent.getText(publicFile);
    // These are the actual entry and source call, whose intervening owner body is
    // required above to stay synchronous. Raw archive behavior is verified at its existing fixture owner.
    return new Function("drainControlPulse", "verifySource", transpile(`return async()=>{${omitEntry ? "" : entry}\n${sourceCheck}};`))(
      drainControlPulse, verifySource) as () => Promise<void>;
  };
  function setup(connectFailure?: Error, scheduled = false, failAfterRelease = false) {
    let time = 0, connections = 0, heartbeats = 0, sourceReads = 0, connectStarted = false, oldClosed = false;
    const events: string[] = [], abort = new AbortController();
    const client = (pid: number) => Object.assign(new EventEmitter(), { async connect() {}, async query() { return { rows: [{ database: "postgres", role: "postgres", backend_pid: pid }], rowCount: 1 }; }, async end() { if (pid === 1) oldClosed = true; } });
    const first = client(1), second = client(2);
    let release: (() => void) | undefined;
    const lease = owner.createAdminMeasurementControlLease(first, { now: () => time, assertHealthy() {}, async assertOwned() {}, watch() {}, replaced() {}, record() {},
      connect: async () => { connections++; connectStarted = true; events.push("connect-start");
        if (connectFailure && !failAfterRelease) throw connectFailure;
        if (scheduled) await new Promise<void>((resolve, reject) => { const deadline = setTimeout(() => reject(new owner.IsolatedSupabaseError("DB_CONNECTION_TIMEOUT", "database-connect")), 20); setImmediate(() => { clearTimeout(deadline); events.push("connect-ready"); resolve(); }); });
        else await new Promise<void>(resolve => { release = resolve; });
        if (connectFailure) throw connectFailure;
        return second;
      } });
    time = 240_000;
    const control = factory(lease, { selection: "admin-adoption" }, { async assertOwned() {} }, { async query() { heartbeats++; events.push("heartbeat"); } }, () => {}, abort, (error: unknown) => error, () => false) as {
      tick(): void; drain(phase?: string): Promise<void>; settle(job: Promise<unknown>): Promise<unknown>; pending(): Promise<void> };
    const bytes = Buffer.from("exact-source"), digest = sha256(bytes), manifest = [{ file: "owner.mts", sha256: digest }];
    let stall = false;
    const sourceGuard = new Function("manifest", "digest", "readFileSync", "sourcePath", "join", "sourceDirectory", "imageConfig", "readdirSync", "assert", "downloadFixture", "localImpact",
      transpile(`return ${verify.initializer!.getText(publicFile)};`))(manifest, sha256, () => { sourceReads++; events.push("source-read"); if (stall) { stall = false; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60); } return bytes; }, (file: string) => file, path.join, "owned", { file: "next.config.mjs", sha256: digest }, () => ["next.config.ts", "next.config.mjs"], assert, null, undefined) as () => void;
    return { control, abort, events, sourceGuard, setStall: () => { stall = true; }, release: () => { assert.ok(release); release(); }, started: () => connectStarted,
      state: () => ({ connections, heartbeats, sourceReads, oldClosed }) };
  }
  {
    const t = setup(); t.control.tick(); for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve(); assert.equal(t.started(), true);
    let completed = false; const boundary = (async () => { await t.control.drain(); t.sourceGuard(); completed = true; })();
    await Promise.resolve(); assert.equal(completed, false); assert.equal(t.state().sourceReads, 0);
    t.control.tick(); assert.equal(t.state().connections, 1); t.release(); await boundary;
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true });
    assert.ok(t.events.indexOf("heartbeat") < t.events.indexOf("source-read")); assert.equal(t.abort.signal.aborted, false);
    cases.push("pending current renewal drains before source reads; overlapping timer creates no extra connection or query");
    await t.control.drain(); assert.equal(t.state().connections, 1); assert.equal(t.state().heartbeats, 1);
    cases.push("resolved pulse drain is passive and does not renew, probe, retry or replay a query");
  }
  {
    const failure = new owner.IsolatedSupabaseError("DB_CONNECTION_TIMEOUT", "database-connect"), t = setup(failure); t.control.tick();
    await assert.rejects((async () => { await t.control.drain(); t.sourceGuard(); })(), error => error === failure);
    assert.equal(t.abort.signal.aborted, true); assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 0, oldClosed: false });
    t.control.tick(); await assert.rejects(t.control.drain(), error => error === failure); assert.equal(t.state().connections, 1);
    cases.push("failed pulse aborts original job and rejects before source checks with original error identity; no retry/fallback");
  }
  {
    const t = setup(); const seen: string[] = [];
    const queuedTimer = new Promise<void>(resolve => setImmediate(() => { seen.push("timer"); resolve(); }));
    await t.control.drain(); t.sourceGuard(); seen.push("source"); await queuedTimer;
    assert.deepEqual(seen, ["source", "timer"]); assert.equal(t.state().connections, 0);
    cases.push("new timer cannot interleave between completed drain and immediately synchronous verification");
  }
  for (const drain of [false, true]) {
    await new Promise<void>(resolve => setImmediate(resolve)); const t = setup(undefined, true); t.control.tick();
    for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve(); assert.equal(t.started(), true);
    t.setStall(); if (drain) await t.control.drain(); t.sourceGuard(); await t.control.pending();
    if (drain) { assert.equal(t.abort.signal.aborted, false); assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true }); }
    else { assert.equal(t.abort.signal.aborted, true); assert.equal(t.state().connections, 1); assert.equal(t.state().heartbeats, 0); await assert.rejects(t.control.drain(), /DB_CONNECTION_TIMEOUT/); }
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  cases.push("actual lease/heartbeat/source guard scheduling model reproduces undrained timeout and drained success with identical scaled deadline and injected synchronous stall; no real database claim");
  for (const omitEntry of [true, false]) {
    const t = setup(); t.control.tick(); for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve(); assert.equal(t.started(), true);
    let finished = false; const pending = archiveSourceBoundary(t.control.drain, t.sourceGuard, omitEntry)().then(() => { finished = true; });
    await Promise.resolve(); assert.equal(t.state().sourceReads, omitEntry ? 3 : 0); assert.equal(finished, omitEntry);
    t.control.tick(); assert.equal(t.state().connections, 1); t.release(); await pending; await t.control.pending();
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true });
    assert.equal(t.events.indexOf("heartbeat") < t.events.indexOf("source-read"), !omitEntry);
    assert.equal(t.abort.signal.aborted, false);
  }
  cases.push("removing only the actual passive archive entry reproduces source reads during pending renewal; the maintained entry waits without another connection or query");
  {
    const failure = new owner.IsolatedSupabaseError("DB_CONNECTION_TIMEOUT", "database-connect"), t = setup(failure); t.control.tick();
    const preservation = archiveSourceBoundary(t.control.drain, t.sourceGuard)();
    await assert.rejects(t.control.settle(preservation), error => error === failure);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 3, oldClosed: false });
    assert.equal(t.abort.signal.aborted, true);
    for (const phase of [undefined, "unclassified"]) await assert.rejects(t.control.drain(phase), error => error === failure);
    t.control.tick(); assert.equal(t.state().connections, 1);
  }
  cases.push("failed heartbeat still permits passive archive source checks but actual outer lifecycle rejects the original heartbeat; default and unknown drain phases never suppress it or retry");
  {
    const t = setup(), original = Error("Controlled original Public cancellation"); t.control.tick();
    for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve(); assert.equal(t.started(), true);
    const preservation = archiveSourceBoundary(t.control.drain, t.sourceGuard)();
    const result = t.control.settle(preservation.then(() => { throw original; })); result.catch(() => {});
    t.abort.abort(original); await Promise.resolve(); assert.equal(t.state().sourceReads, 0);
    t.release(); await assert.rejects(result, error => error === original);
    assert.equal(t.abort.signal.reason, original); assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true });
    assert.ok(t.events.indexOf("heartbeat") < t.events.indexOf("source-read")); t.control.tick(); assert.equal(t.state().connections, 1);
  }
  cases.push("cancellation during the passive archive wait keeps source reads behind the pending pulse and preserves the original Public error when that pulse succeeds");
  {
    const failure = new owner.IsolatedSupabaseError("DB_CONNECTION_TIMEOUT", "database-connect"), original = Error("Controlled earlier Public failure");
    const t = setup(failure, false, true); t.control.tick();
    for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve(); assert.equal(t.started(), true);
    let publicError: unknown;
    const preservation = archiveSourceBoundary(t.control.drain, t.sourceGuard)().then(() => { throw original; })
      .catch(error => { publicError = error; throw error; });
    const result = t.control.settle(preservation); result.catch(() => {});
    await Promise.resolve(); assert.equal(t.state().sourceReads, 0); t.release();
    await assert.rejects(result, error => error === failure); assert.equal(publicError, original);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 3, oldClosed: false });
    assert.equal(t.abort.signal.aborted, true); t.control.tick(); assert.equal(t.state().connections, 1);
  }
  cases.push("a heartbeat failing during the archive wait preserves the Public rejection at its boundary while the unchanged outer lifecycle returns the exact heartbeat error without a success claim");
  // Dispatch the actual timer callback through the real event loop while its
  // existing lease is pending. These short fixture delays do not change the
  // production cadence, socket deadlines, or passive source/archive contract.
  const dispatchHeartbeat = (control: { tick(): void }) => new Promise<void>(resolve => {
    setTimeout(() => { control.tick(); resolve(); }, 1);
  });
  {
    const t = setup(), dispatched = dispatchHeartbeat(t.control);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    assert.equal(t.started(), false, "A due callback cannot run inside synchronous source work.");
    await dispatched;
    for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve();
    assert.equal(t.started(), true);
    let finished = false;
    const boundary = (async () => { await t.control.drain(); t.sourceGuard(); finished = true; })();
    await dispatchHeartbeat(t.control);
    assert.equal(finished, false); assert.equal(t.state().sourceReads, 0);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 0, oldClosed: false });
    t.release(); await boundary;
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true });
    assert.ok(t.events.indexOf("heartbeat") < t.events.indexOf("source-read"));
    assert.equal(t.abort.signal.aborted, false);
    await t.control.settle(Promise.resolve()); await dispatchHeartbeat(t.control);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true });
  }
  cases.push("real delayed timer dispatch during an async wait renews once, serializes another pending tick, drains before source reads and stops after lifecycle settlement");
  {
    const failure = new owner.IsolatedSupabaseError("DB_CONNECTION_TIMEOUT", "database-connect"), t = setup(failure, false, true);
    await dispatchHeartbeat(t.control);
    for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve();
    assert.equal(t.started(), true);
    const boundary = (async () => { await t.control.drain(); t.sourceGuard(); })();
    void boundary.catch(() => undefined);
    await dispatchHeartbeat(t.control);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 0, oldClosed: false });
    t.release(); await assert.rejects(boundary, error => error === failure);
    assert.equal(t.abort.signal.aborted, true);
    await assert.rejects(t.control.settle(boundary), error => error === failure);
    await dispatchHeartbeat(t.control);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 0, oldClosed: false });
  }
  cases.push("real dispatched heartbeat failure aborts the waiting job, preserves exact failure through settlement and denies source reads or retry");
  {
    const original = Error("Controlled timer-wait cancellation"), t = setup();
    await dispatchHeartbeat(t.control);
    for (let n = 0; n < 8 && !t.started(); n++) await Promise.resolve();
    assert.equal(t.started(), true);
    const preservation = archiveSourceBoundary(t.control.drain, t.sourceGuard)();
    let settled = false;
    const result = t.control.settle(preservation.then(() => { throw original; }))
      .finally(() => { settled = true; });
    void result.catch(() => undefined);
    t.abort.abort(original); await dispatchHeartbeat(t.control);
    assert.equal(settled, false);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 0, sourceReads: 0, oldClosed: false });
    t.release(); await assert.rejects(result, error => error === original);
    assert.equal(t.abort.signal.reason, original);
    assert.ok(t.events.indexOf("heartbeat") < t.events.indexOf("source-read"));
    await dispatchHeartbeat(t.control);
    assert.deepEqual(t.state(), { connections: 1, heartbeats: 1, sourceReads: 3, oldClosed: true });
  }
  cases.push("real timer dispatch during cancellation preserves the original error, waits pending renewal before archive source checks and leaves no post-settlement pulse");
}

async function adminControlLeaseOnly() {
  await verifyRestoreAclPolicy();
  const sources = ["scripts/lib/isolated-supabase.mts", "scripts/lib/isolated-public-verification.mts", "scripts/verify-isolated-supabase.mts"];
  const sourceHashes = Object.fromEntries(sources.map(file => [file, sha256(readSource(file))]));
  await verifyAdminMeasurementControlLease(await import("./lib/isolated-supabase.mts"));
  verifyAdminMeasurementRestartPolicy();
  for (const file of sources) assert.equal(sha256(readSource(file)), sourceHashes[file]);
  console.log(JSON.stringify({ status: "PASS", scope: "admin-control-lease-only", checks: cases.length, cases, sourceHashes,
    dockerExecuted: false, networkRequests: 0, databaseCalls: 0, actualRenewalClaimed: false }, null, 2));
}

function verifyAdminMeasurementRestartPolicy() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const inspectLaunches = (candidate: string) => {
    const file = ts.createSourceFile("isolated-public-verification.mts", candidate, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const launches: ts.CallExpression[] = [];
    const policies: ts.IfStatement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(file) === "runChild") launches.push(node);
      if (ts.isIfStatement(node) && ts.isBlock(node.thenStatement)
        && node.thenStatement.statements.some(statement => ts.isExpressionStatement(statement)
          && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(file) === "receipt"
          && statement.expression.arguments[1]?.getText(file) === '"admin-driver-restart-rejected.json"')) policies.push(node);
      ts.forEachChild(node, visit);
    };
    visit(file);
    assert.equal(policies.length, 1, "Admin measurement failure must reject reuse at the canonical owner.");
    assert.equal(launches.length, 2, "Only the canonical gate driver and fixed successful Hero typegen prerequisite may launch children.");
    const driver = launches.filter(call => call.arguments[0]?.getText(file) === "args");
    assert.equal(driver.length, 1, "Exactly one generic gate driver may launch.");
    assert.deepEqual(driver[0].arguments.map(argument => argument.getText(file)), ["args", "env", "gate.name", "gate.limitMs"]);
    const prerequisite = launches.find(call => call !== driver[0])!;
    assert.deepEqual(prerequisite.arguments.map(argument => argument.getText(file)), [
      '[join(sourceDirectory, "node_modules/next/dist/bin/next"), "typegen"]',
      "childEnvironment", '"hero-compatibility-typegen"', "180_000",
    ], "The extra child is exactly the fixed Next typegen prerequisite.");
    const declarationStatement = (call: ts.CallExpression, name: string) => {
      let awaited: ts.Node = call;
      if (name === "result") {
        const access = call.parent;
        assert.ok(ts.isPropertyAccessExpression(access) && access.expression === call && access.name.text === "catch",
          "The driver may add only the canonical first-failure rejection boundary.");
        const caught = access.parent;
        assert.ok(ts.isCallExpression(caught) && caught.expression === access && caught.arguments.length === 1);
        const callback = caught.arguments[0];
        assert.ok(ts.isArrowFunction(callback) && ts.isBlock(callback.body));
        assert.deepEqual(callback.parameters.map(parameter => parameter.getText(file)), ["error"]);
        assert.deepEqual(callback.body.statements.map(statement => statement.getText(file).replace(/\s+/gu, " ")), [
          "const first = gateApp ? nativeApplications.get(gateApp)?.failure : undefined;",
          "if (first === undefined) throw error;",
          'if (first instanceof Error && Object.isExtensible(first) && !Object.hasOwn(first, "applicationDriverFailure")) Object.defineProperty(first, "applicationDriverFailure", { value: error });',
          "throw first;",
        ], "The driver must preserve its original failure or the already-recorded application failure without recovery or another launch.");
        awaited = caught;
      }
      assert.ok(ts.isAwaitExpression(awaited.parent) && ts.isVariableDeclaration(awaited.parent.parent));
      const declaration = awaited.parent.parent;
      assert.equal(declaration.name.getText(file), name);
      assert.ok(ts.isVariableDeclarationList(declaration.parent) && ts.isVariableStatement(declaration.parent.parent));
      return declaration.parent.parent;
    };
    const driverStatement = declarationStatement(driver[0], "result");
    const prerequisiteStatement = declarationStatement(prerequisite, "types");
    const resetBody = prerequisiteStatement.parent;
    assert.ok(ts.isBlock(resetBody) && ts.isIfStatement(resetBody.parent));
    const reset = resetBody.parent;
    assert.equal(reset.thenStatement, resetBody);
    assert.equal(reset.expression.getText(file), 'heroCompatibility && request.finalQualityGate && gate.name === "hero-compatibility"');
    const gateBody = driverStatement.parent;
    assert.ok(ts.isBlock(gateBody) && ts.isForOfStatement(gateBody.parent));
    assert.equal(gateBody.parent.expression.getText(file), "executionGates");
    assert.equal(reset.parent, gateBody, "Typegen belongs only to the successful Hero gate reset.");
    const policy = policies[0];
    assert.equal(policy.parent, gateBody);
    const successIndex = gateBody.statements.findIndex(statement => ts.isExpressionStatement(statement)
      && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(file) === "assert.equal"
      && statement.expression.arguments[0]?.getText(file) === "result.code" && statement.expression.arguments[1]?.getText(file) === "0");
    const nativeStopIndex = gateBody.statements.findIndex(statement => ts.isIfStatement(statement)
      && statement.expression.getText(file) === "gateApp && nativeApplications.has(gateApp)"
      && statement.thenStatement.getText(file) === "await stopNativeApplication(nativeApplications.get(gateApp)!);");
    const stopIndex = gateBody.statements.findIndex(statement => ts.isIfStatement(statement)
      && statement.expression.getText(file) === "gateApp && !nativeApplications.has(gateApp)"
      && statement.thenStatement.getText(file) === "await stopChild(gateApp, context.cleanEnvironment());");
    const passIndex = gateBody.statements.findIndex(statement => ts.isExpressionStatement(statement)
      && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(file) === "context.record"
      && statement.expression.arguments[0]?.getText(file) === '"public-gate-pass"');
    const driverIndex = gateBody.statements.indexOf(driverStatement), policyIndex = gateBody.statements.indexOf(policy), resetIndex = gateBody.statements.indexOf(reset);
    assert.ok(driverIndex < policyIndex && policyIndex < successIndex && successIndex < nativeStopIndex
      && nativeStopIndex < passIndex && passIndex < stopIndex && stopIndex < resetIndex,
      "Typegen follows failure rejection, success and both qualified shutdown branches; Native cleanup precedes PASS and Linux shutdown retains its original boundary.");
    return { file, policy, reset, prerequisiteStatement, nativeStop: gateBody.statements[nativeStopIndex], linuxStop: gateBody.statements[stopIndex] };
  };
  const { file, policy, reset, prerequisiteStatement, nativeStop, linuxStop } = inspectLaunches(source);
  const replaceOnce = (before: string, after: string) => {
    assert.equal(source.split(before).length, 2);
    return source.replace(before, after);
  };
  const moved = source.slice(0, prerequisiteStatement.getStart(file)) + source.slice(prerequisiteStatement.end);
  const resetEndAfterRemoval = reset.end - (prerequisiteStatement.end - prerequisiteStatement.getStart(file));
  for (const [name, changed] of [
    ["changed prerequisite command", replaceOnce('[join(sourceDirectory, "node_modules/next/dist/bin/next"), "typegen"]', '[join(sourceDirectory, "node_modules/next/dist/bin/next"), "build"]')],
    ["widened prerequisite scope", replaceOnce(reset.expression.getText(file), 'request.finalQualityGate && gate.name === "hero-compatibility"')],
    ["prerequisite moved outside reset", moved.slice(0, resetEndAfterRemoval) + "\n" + prerequisiteStatement.getText(file) + moved.slice(resetEndAfterRemoval)],
    ["duplicated prerequisite", replaceOnce(prerequisiteStatement.getText(file), prerequisiteStatement.getText(file) + "\n" + prerequisiteStatement.getText(file))],
    ["missing success boundary", replaceOnce('assert.equal(result.code, 0, `Required Public gate failed: ${gate.name}`);', '')],
    ["unqualified driver rejection wrapper", replaceOnce("await runChild(args, env, gate.name, gate.limitMs).catch(error =>", "await runChild(args, env, gate.name, gate.limitMs).then(error =>")],
    ["discarded first application failure", replaceOnce("throw first;", "throw error;")],
    ["missing Native app shutdown", replaceOnce(nativeStop.getText(file), "")],
    ["Native app shutdown moved after PASS", replaceOnce(nativeStop.getText(file), "").replace(linuxStop.getText(file), nativeStop.getText(file) + "\n" + linuxStop.getText(file))],
    ["widened Linux app shutdown", replaceOnce(linuxStop.getText(file), "if (gateApp) await stopChild(gateApp, context.cleanEnvironment());")],
    ["missing Linux app shutdown", replaceOnce(linuxStop.getText(file), "")],
  ]) assert.throws(() => inspectLaunches(changed), name);
  cases.push("child launch guard permits only one generic driver and one fixed typegen after successful Hero reset; changed command, scope, placement, duplication and missing success boundary are rejected");
  const events: unknown[] = [];
  const evaluate = new Function("measurement", "gate", "result", "receipt", "context", "assert", "manifest", "digest",
    ts.transpileModule(policy.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
  const record = (_context: unknown, name: string, metadata: unknown) => events.push({ name, metadata });
  for (const phase of ["before", "after"] as const) {
    assert.throws(() => evaluate({ phase }, { name: "admin-interactions" }, { code: 1 }, record, {}, assert, [], () => "source"), /owned fixture must be recreated/);
    assert.throws(() => evaluate({ phase, study: "heavy-editor-performance" }, { name: "admin-interactions" }, { code: 1 }, record, {}, assert, [], () => "source"), /owned fixture must be recreated/);
  }
  assert.equal(events.length, 4);
  evaluate({ phase: "before" }, { name: "admin-interactions" }, { code: 0 }, record, {}, assert, [], () => "source");
  assert.equal(events.length, 4, "Successful driver needs no repair policy.");
  cases.push("all failed Admin measurement drivers reject same-fixture restart; a successful driver continues");
}

/** Exercise the installed Next config loader, client validator and optimizer; no Product app or DB. */
async function verifyOwnedPublicImageConfig(network = false) {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const builder = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "isolatedPublicImageConfigSource");
  assert.ok(builder);
  const code = ts.transpileModule(builder.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const build = new Function("assert", code + ";return isolatedPublicImageConfigSource;")(assert) as (port: number, sha: string) => string;
  const originalConfig = readFileSync(path.join(root, "next.config.ts")), originalSha256 = sha256(originalConfig);
  for (const port of [0, 80, 1023, 3000, 65536, NaN, 57604.5]) assert.throws(() => build(port, originalSha256));
  assert.throws(() => build(57604, "invalid"));
  const require = createRequire(import.meta.url);
  const { CONFIG_FILES, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require("next/dist/shared/lib/constants.js");
  assert.ok(CONFIG_FILES.indexOf("next.config.mjs") < CONFIG_FILES.indexOf("next.config.ts"));
  const loadConfig = require("next/dist/server/config.js").default;
  const loader = require("next/dist/shared/lib/image-loader.js").default;
  const { ImageOptimizerCache, fetchExternalImage, imageOptimizer } = require("next/dist/server/image-optimizer.js");
  const temporaryRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "venisia-owned-image-config-")));
  const beforeDirectory = path.join(temporaryRoot, "before"), afterDirectory = path.join(temporaryRoot, "after");
  const png = await sharp({ create: { width: 96, height: 64, channels: 3, background: "#245670" } }).png().toBuffer();
  const requests: string[] = [];
  const server = network ? createServer((req, res) => {
    requests.push(req.url ?? "");
    if (req.url === "/storage/v1/object/public/cms-images/redirect.png") {
      res.writeHead(302, { Location: "/outside-owned-images.png" }); res.end(); return;
    }
    if (req.url !== "/storage/v1/object/public/cms-images/probe.png") { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length }); res.end(png);
  }) : undefined;
  const testEnvironment = process.env as Record<string, string | undefined>;
  const originalNodeEnv = testEnvironment.NODE_ENV;
  let apiPort = 57604, generatedConfigSha256 = "", optimizedBytes = 0, closed = false;
  try {
    if (server) {
      await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
      apiPort = (server.address() as AddressInfo).port;
    }
    for (const directory of [beforeDirectory, afterDirectory]) {
      mkdirSync(directory); writeFileSync(path.join(directory, "next.config.ts"), originalConfig, { flag: "wx" });
      symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "junction");
    }
    const generated = build(apiPort, originalSha256); generatedConfigSha256 = sha256(generated);
    writeFileSync(path.join(afterDirectory, "next.config.mjs"), generated, { flag: "wx" });
    const before = await loadConfig(PHASE_PRODUCTION_BUILD, beforeDirectory, { silent: true });
    const after = await loadConfig(PHASE_PRODUCTION_BUILD, afterDirectory, { silent: true });
    const runtime = await loadConfig(PHASE_PRODUCTION_SERVER, afterDirectory, { silent: true });
    assert.equal(before.configFileName, "next.config.ts"); assert.equal(after.configFileName, "next.config.mjs");
    assert.deepEqual(after.images, runtime.images);
    assert.deepEqual(await before.headers(), await after.headers());
    for (const key of ["allowedDevOrigins", "outputFileTracingExcludes"]) assert.deepEqual(before[key], after[key]);
    assert.equal(after.images.unoptimized, false); assert.deepEqual(after.images.domains, []);
    assert.equal(after.images.dangerouslyAllowLocalIP, true); assert.equal(after.images.maximumRedirects, 0);
    const origin = `http://127.0.0.1:${apiPort}`, imageUrl = `${origin}/storage/v1/object/public/cms-images/probe.png`;
    const request = { headers: { accept: "image/webp" } } as IncomingMessage;
    const validate = (url: string, config = after) => ImageOptimizerCache.validateParams(request, { url, w: "64", q: "75" }, config, false);
    assert.equal(validate(imageUrl, before).errorMessage, '"url" parameter is not allowed');
    const accepted = validate(imageUrl); assert.equal(accepted.errorMessage, undefined); assert.equal(accepted.href, imageUrl);
    testEnvironment.NODE_ENV = "development";
    assert.throws(() => loader({ config: before.images, src: imageUrl, width: 64, quality: 75 }), /not configured/u);
    assert.match(loader({ config: after.images, src: imageUrl, width: 64, quality: 75 }), /^\/_next\/image\?/u);
    const rejectedUrls = [imageUrl.replace("127.0.0.1", "127.0.0.2"), imageUrl.replace("127.0.0.1", "localhost"),
      imageUrl.replace(`:${apiPort}/`, `:${apiPort === 65535 ? 65534 : apiPort + 1}/`), imageUrl.replace("http:", "https:"),
      imageUrl.replace("cms-images", "cms-documents"), imageUrl.replace("/public/", "/sign/"), `${imageUrl}?download=1`,
      `${origin}/outside-owned-images.png`, "https://unowned.supabase.co/storage/v1/object/public/cms-images/probe.png"];
    for (const url of rejectedUrls) {
      assert.equal(validate(url).errorMessage, '"url" parameter is not allowed');
      assert.throws(() => loader({ config: after.images, src: url, width: 64, quality: 75 }), /not configured/u);
    }
    let verifyNode: ts.VariableDeclaration | undefined;
    const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(file) === "verifySource") verifyNode = node; ts.forEachChild(node, visit); };
    visit(file); assert.ok(verifyNode?.initializer);
    const verifyCode = ts.transpileModule("const verify = " + verifyNode.initializer.getText(file) + ";", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    // This image fixture has no reviewed local-risk request; preserve that
    // production branch explicitly when evaluating its extracted closure.
    const verifySnapshot = new Function("manifest", "digest", "readFileSync", "sourcePath", "join", "sourceDirectory", "imageConfig", "readdirSync", "assert", "downloadFixture", "localImpact", verifyCode + ";return verify;")(
      [{ file: "next.config.ts", sha256: originalSha256 }], sha256, readFileSync, () => path.join(beforeDirectory, "next.config.ts"),
      path.join, afterDirectory, { file: "next.config.mjs", sha256: generatedConfigSha256 }, readdirSync, assert, null, null);
    verifySnapshot();
    writeFileSync(path.join(afterDirectory, "next.config.mjs"), generated + "\n// tampered\n"); assert.throws(verifySnapshot, /changed after binding/u);
    writeFileSync(path.join(afterDirectory, "next.config.mjs"), generated);
    writeFileSync(path.join(afterDirectory, "next.config.js"), "module.exports={};"); assert.throws(verifySnapshot, /precedence/u);
    rmSync(path.join(afterDirectory, "next.config.js")); verifySnapshot();
    if (network) {
      await assert.rejects(fetchExternalImage(imageUrl, false, png.length + 1024, 0), { statusCode: 400 });
      assert.deepEqual(requests, []);
      const fetched = await fetchExternalImage(imageUrl, after.images.dangerouslyAllowLocalIP, png.length + 1024, after.images.maximumRedirects);
      assert.equal(sha256(fetched.buffer), sha256(png));
      const optimized = await imageOptimizer(fetched, accepted, after, { silent: true });
      assert.equal(optimized.contentType, "image/webp"); assert.ok(optimized.buffer.length > 0); optimizedBytes = optimized.buffer.length;
      await assert.rejects(fetchExternalImage(`${origin}/storage/v1/object/public/cms-images/redirect.png`, true, png.length + 1024, 0), { statusCode: 508 });
      assert.deepEqual(requests, ["/storage/v1/object/public/cms-images/probe.png", "/storage/v1/object/public/cms-images/redirect.png"]);
    }
    assert.equal(sha256(readFileSync(path.join(root, "next.config.ts"))), originalSha256);
    cases.push("installed Next config precedence and original TS delegation preserve Product config; owned image allowlist rejects nine origin/path/query negatives");
    cases.push("actual snapshot guard rejects derived-config tampering and config-precedence shadowing");
  } finally {
    if (originalNodeEnv === undefined) delete testEnvironment.NODE_ENV; else testEnvironment.NODE_ENV = originalNodeEnv;
    if (server?.listening) { server.closeAllConnections(); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); }
    if (server) {
      const probe = createNetServer(); await new Promise<void>((done, reject) => { probe.once("error", reject); probe.listen(apiPort, "127.0.0.1", () => probe.close(error => error ? reject(error) : done())); });
    }
    assert.equal(realpathSync(temporaryRoot), temporaryRoot);
    assert.equal(path.dirname(temporaryRoot), realpathSync(tmpdir()));
    assert.ok(path.basename(temporaryRoot).startsWith("venisia-owned-image-config-"));
    rmSync(temporaryRoot, { recursive: true, force: false }); closed = !existsSync(temporaryRoot) && !server?.listening;
  }
  assert.equal(closed, true);
  return { status: "PASS", scope: "installed Next isolated image configuration", nextVersion: require("next/package.json").version,
    originalConfigSha256: originalSha256, generatedConfigSha256, nativeValidationNegativeControls: 9,
    clientValidationReproducedBefore: true, serverValidationReproducedBefore: true, buildAndRuntimeConfigEqual: true,
    networkRequests: requests.length, actualOptimizerOutputBytes: optimizedBytes, redirectFollowed: false,
    browserExecuted: false, databaseCalls: 0, productConfigUnchanged: true, remainingOwnedResources: 0, remainingOwnedProcesses: 0 };
}


/** Full admission controls use the maintained function, real SHA256 and memory-only artifact ports. */
async function verifyRetainedFinalQualityAdmissionControls(admissionControls: Awaited<ReturnType<typeof verifyAdmissionQualificationControls>>) {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = (name: string) => {
    const rows = file.statements.filter(node => ts.isFunctionDeclaration(node) ? node.name?.text === name : ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === name));
    assert.equal(rows.length, 1, name); return rows[0];
  };
  const compile = (value: string) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const constants = ["FINAL_QUALITY_ACCOUNTING", "FINAL_QUALITY_READINESS", "RETAINED_FINAL_QUALITY_AUTHORITY"].map(name => statement(name).getText(file)).join("\n");
  const config = new Function(compile(constants) + ";return {base:FINAL_QUALITY_ACCOUNTING,admission:FINAL_QUALITY_READINESS,authority:RETAINED_FINAL_QUALITY_AUTHORITY};")() as {
    base: string; admission: string; authority: { predicateCorrectionManifest: { path: string; historicalSha256: string }; retainedQualificationRoot: string; operationIdentitySha256: string; caseIdentitySha256: string; priorAccounting: { path: string; sha256: string }; final27Plan: { path: string; sha256: string } };
  };
  assert.equal(config.authority.operationIdentitySha256, "15721c1324f7123bcdbb6d72669ff81cf34229ff748e0e04ffbd39709f42d517");
  assert.equal(config.authority.caseIdentitySha256, "f8a774a6e85c6ab9ec0bce374a5e18f286e8b840ed5b46349714ee00dae44d71");
  assert.equal(config.authority.priorAccounting.sha256, "34f9f296582055191d68b8415f44324587b68a77d29169317f159c84d3f573ab");
  assert.ok(!statement("loadRetainedFinalQualityAdmission").getText(file).includes("process.env"));
  const { sourceIncluded } = await import("./lib/verification-source-inventory.mts");
  type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
  const memoryRoot = path.resolve(tmpdir(), "venisia-memory-only-quality-contract");
  const base = ".tmp-qa/core-final-closure/", b = config.base, retainedBase = config.authority.retainedQualificationRoot, h = "b".repeat(40), oldHead = "a".repeat(40);
  const operationIds = [...Array.from({ length: 73 }, (_, index) => "retained-" + index), ...Array.from({ length: 10 }, (_, index) => "media-" + index), ...Array.from({ length: 27 }, (_, index) => "final-" + index), "footer-na"];
  const caseKeys = Array.from({ length: 959 }, (_, index) => "case-" + String(index).padStart(3, "0"));
  const rolePaths: Record<string, string> = { admission: config.admission, candidate: b + "final-source-manifest.json", ledger: b + "final-current-accounting-successor.json", operations: b + "final-111-reconciliation.json", integrity: b + "final-evidence-integrity.json", impact: b + "source-impact-current-to-final.json", producer: b + "final-accounting-producer-execution.json", review: b + "final-accounting-root-review.json", parent: config.authority.priorAccounting.path,
    progress: base + "final-accounting-interim/progress-73-retained-1-na-0-hard-37-held-after-hard-open-2026-10-03.json", old: retainedBase + "retained-qualification.json", media7: retainedBase + "r144-partial/partial-qualification.json", media3: retainedBase + "browser-r145-qualified-observations.json", final: retainedBase + "browser-r146-qualified-observations.json", owner: path.posix.dirname(config.authority.priorAccounting.path) + "/materialize.mjs", blocker: b + "domain-blocker.json", na: b + "footer-disposition.json", proof: b + "scoped-proof.json", log: base + "browser-r146/public-admin-adoption.stdout.log", product: "src/app/page.tsx", package: "package.json" };
  for (const name of ["public-source-manifest.json", "public-and-admin-adoption-gates.json", "admin-adoption-browser.json", "admin-adoption-database-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json", "selected-journey-canonical-inventory/admin-adoption-browser.json"]) rolePaths[name] = base + "browser-r146/" + name;
  Object.assign(rolePaths, { partial: retainedBase + "browser-r148-qualified-observations.json", composition: retainedBase + "final27-composite-qualification.json", compositeImpact: retainedBase + "source-impact-partial148-to-final-six.json", originalPlan: config.authority.final27Plan.path, verifyowner: "scripts/verify-admin-core-date-controls.mjs" });
  for (const name of ["public-source-manifest.json", "admin-adoption-browser.json", "partial-native-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json", "public-normal-build.json", "public-product-surface-build.json", "public-platform-contracts.json", "public-admin-adoption.json"]) rolePaths["partial-" + name] = base + "browser-r148/" + name;
  for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) for (const stream of ["stdout", "stderr"]) rolePaths["partial-public-" + name + "." + stream + ".log"] = base + "browser-r148/public-" + name + "." + stream + ".log";
  Object.assign(rolePaths, { middle: retainedBase + "browser-r149-qualified-observations.json", compositeUpdateImpact: retainedBase + "source-impact-partial148-to-final-update.json", residualImpact: retainedBase + "source-impact-partial149-to-final-update.json" });
  for (const [role, file] of Object.entries(rolePaths)) if (role.startsWith("partial-")) rolePaths["middle-" + role.slice("partial-".length)] = file.replace("browser-r148/", "browser-r149/");
  rolePaths.corrections = base + "ledger959-reconciliation-2026-10-04/root/specialized-atomic-integrated-proof.json";
  const marker = (role: string): Json => ({ fixtureRef: role });
  const fixture = (mutate?: (edit: (role: string, keys: Array<string | number>, value: Json | undefined) => void) => void, composite: boolean | "three" = false, corrections = false) => {
    const models = new Map<string, Json | Buffer>();
    const put = (role: string, value: Json | Buffer) => models.set(role, value);
    put("package", Buffer.from('{}\n')); put("product", Buffer.from('export default function Page() { return null; }\n'));
    if (composite) put("verifyowner", Buffer.from("revised-verification-owner"));
    const manifest = ["package", "product", ...(composite ? ["verifyowner"] : [])].map(role => ({ file: rolePaths[role], sha256: sha256(models.get(role) as Buffer) }));
    const sourceSha = sha256(JSON.stringify(manifest)), expected = { invocationHeadSha: h, sourceSha256: sourceSha, manifest };
    const oldSourceSha = sha256("retained-source"), oldOwned = "owned-retained", owned = "owned-final";
    put("candidate", { ...expected, inventoryOnly: true, buildClaimed: false }); put("public-source-manifest.json", expected);
    for (const role of ["na", "proof", "blocker"]) put(role, { status: "controlled-evidence", globalClosed: false });
    put("log", Buffer.from("not JSON: captured synthetic log\n")); put("owner", Buffer.from("export function materializeFinalAccountingReviewed() {}\n"));
    put("corrections", { status: "PURE_COMPOSED_EXISTING_OWNER_SPECIALIZED_ATOMIC_PASS", deltas: [], globalClosed: false });
    put("old", { run: "browser-r90", sourceHead: oldHead, sourceSha256: oldSourceSha, ownedRunId: oldOwned });
    const retained = operationIds.slice(0, 73).map(id => ({ id, run: "browser-r90", sourceHead: oldHead, qualification: marker("old") }));
    const mediaIds = operationIds.slice(73, 83), finalIds = operationIds.slice(83, 110);
    put("progress", { retained, held: [...mediaIds.map(id => ({ id, run: "browser-r101" })), ...finalIds.map(id => ({ id, run: "browser-r52" }))], notApplicable: [{ id: "footer-na", disposition: marker("na") }] });
    const observation = (id: string, sha: string, runId: string) => ({ status: "QUALIFIED_SCOPED_BEHAVIORAL_OBSERVATION", journeyId: id, sourceSha256: sha, ownedRunId: runId });
    for (const [role, ids, run] of [["media7", mediaIds.slice(0, 7), "browser-r144"], ["media3", mediaIds.slice(7), "browser-r145"]] as const) put(role, { status: role === "media7" ? "SCOPED_MEDIA_SEVEN_QUALIFIED_ORIGINAL_FAILED" : "QUALIFIED_SCOPED_COHORT_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT", run, sourceHead: oldHead, sourceSha256: oldSourceSha, ownedRunId: "owned-" + role, observations: ids.map(id => observation(id, oldSourceSha, "owned-" + role)), globalClosed: false });
    const rawRoles = Object.keys(rolePaths).filter(role => rolePaths[role].startsWith(base + "browser-r146/"));
    for (const role of rawRoles.filter(role => !["log", "public-source-manifest.json"].includes(role))) put(role, { status: "pass" });
    const inventory = [{ boundary: "form", id: "one", surfaces: ["edit"], domainJourneyInventoryComplete: true }, { boundary: "collection", id: "two", surfaces: ["list"], domainJourneyInventoryComplete: false }];
    const preview = [{ consumer: "one", publication: "published", session: "authorized" }, { consumer: "one", publication: "unpublished", session: "authorized" }];
    put("selected-journey-canonical-inventory/admin-adoption-browser.json", { inventoryOnly: true, driverCompleted: false, globalClosed: false, inventory, previewMatrix: preview });
    put("public-and-admin-adoption-gates.json", { status: "pass", selection: "admin-adoption", sourceSha256: sourceSha, buildIdSha256: sha256("same-valid-build-id"), gates: ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"].map(name => ({ name, code: 0 })) });
    put("final", { status: "QUALIFIED_SCOPED_COHORT_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT", statusEnvelope: "qualified-sealed-cohort-envelope", cohort: "domain-forms", run: "browser-r146", sourceHead: h, sourceSha256: sourceSha, ownedRunId: owned, originalHookRun: "browser-r52", deferredFinalQuality: true, finalQuality: false, journeyCount: 27, observations: finalIds.map(id => observation(id, sourceSha, owned)), inputArtifacts: rawRoles.map(marker), automaticCoverage: [], globalClosed: false });
    const qualified = [...retained.map(row => ({ ...row, sourceSha256: oldSourceSha, ownedRunId: oldOwned })), ...mediaIds.map((id, index) => ({ id, qualification: marker(index < 7 ? "media7" : "media3"), run: index < 7 ? "browser-r144" : "browser-r145", sourceHead: oldHead, sourceSha256: oldSourceSha, ownedRunId: index < 7 ? "owned-media7" : "owned-media3" })), ...finalIds.map(id => ({ id, qualification: marker("final"), run: "browser-r146", sourceHead: h, sourceSha256: sourceSha, ownedRunId: owned }))];
    const counts = { qualified: 110, notApplicable: 1, hardOpen: 0, held: 0, total: 111 };
    put("operations", { status: "EXACT_ORIGINAL111_RECONCILED", sourceHead: h, originalIdentitySha256: sha256(JSON.stringify([...operationIds].sort())), retained73Authority: marker("progress"), partitions: { qualified, notApplicable: [{ id: "footer-na", authority: marker("na"), countsAsPass: false }], hardOpen: [], held: [] }, counts, globalClosed: false });
    const modules = Object.fromEntries(["U02", "U04", "U05"].map((key, index) => [key, [{ key: caseKeys[index], status: "OPEN_WITH_EXACT_PREDICATES", completeNamedContract: false, qualifiedPredicates: [], openPredicates: [{ id: "predicate-" + index }] }]]));
    const u01 = { lifecycle: { denominator: 2, qualified: 1, remaining: 1 }, scopedFormRuntime: { denominator: 2, qualified: 1, open: 1 } };
    const u03 = { cells: [{ key: caseKeys[3], status: "OPEN", qualifiedNamedCell: false, remainingConditions: ["condition"] }] };
    put("parent", { modules, U01: u01, U03: u03, predicateCorrections: [] });
    const namedCells = caseKeys.map((key, index) => ({ key, disposition: index === 957 ? "PROVEN_NOT_APPLICABLE" : index === 958 ? "NOT_APPLICABLE_PENDING_PROOF" : "OPEN", evidence: index === 957 ? [marker("proof")] : [] }));
    const namedCellCounts = { historical: 959, applicable: 957, qualifiedApplicable: 0, openApplicable: 957, pendingNotApplicable: 1, provenNotApplicable: 1 };
    put("ledger", { sourceHead: h, globalClosed: false, automaticCoverage: [], modules: structuredClone(modules), U01: structuredClone(u01), U03: structuredClone(u03), predicateCorrections: [], accounting: { historical: 959, applicable: 957, pendingNotApplicable: 1, provenNotApplicable: 1, pending: [{ key: caseKeys[958] }], proven: [{ key: caseKeys[957] }] }, closureEligibility: { eligible: false, namedCells, namedCellCounts, remainingPredicates: 3, incompleteDomainInventories: 1, openPreviewStates: 1, domainInventories: inventory.map(row => ({ boundary: row.boundary, id: row.id, surfaces: row.surfaces, asRecordedComplete: row.domainJourneyInventoryComplete, complete: row.domainJourneyInventoryComplete })), previewStates: preview.map((row, index) => ({ ...row, status: index === 0 ? "pass" : "open", evidence: index === 0 ? [marker("proof")] : [] })) } });
    if (corrections) {
      const predicates = Array.from({ length: 8 }, (_, index) => ({ id: "predicate-1-" + index, status: "OPEN", expectedEvidence: "Exact current route; reconcile absent affordance." }));
      const evidence = { sourceManifest: marker("candidate"), formManifest: marker("product"), collectionManifest: marker("product"), review: marker("proof"), analysis: marker("proof"),
        sourceGraph: { owner: marker("product"), entry: rolePaths.product, sources: [marker("product")] } };
      const added = predicates.map(previousPredicate => ({ moduleId: "U04", key: caseKeys[1], predicateId: previousPredicate.id, kind: "PREDICATE_CONTRACT_DISPOSITION", previousPredicate,
        countsAsPass: false, qualifiedNamedCell: false, wholeCellNotApplicable: false, evidence }));
      const prefix = [{ classification: "prior-correction-one" }, { classification: "prior-correction-two" }];
      const parent = models.get("parent") as Record<string, Json>, ledger = models.get("ledger") as Record<string, Json>;
      ((parent.modules as Record<string, Json>).U04 as Array<Record<string, Json>>)[0].openPredicates = predicates;
      parent.predicateCorrections = prefix;
      ledger.predicateCorrections = [...prefix, ...added];
      const cell = ((ledger.modules as Record<string, Json>).U04 as Array<Record<string, Json>>)[0];
      cell.openPredicates = []; cell.completeNamedContract = true;
      cell.dispositionEvidence = { status: "PREDICATE_CONTRACT_CORRECTIONS_ONLY", previousOpenPredicates: predicates };
      cell.predicateDispositions = added.map(row => ({ predicateId: row.predicateId, status: "PROVEN_NO_DIRTY_FORM_AFFORDANCE", previousPredicate: row.previousPredicate,
        countsAsPass: false, qualifiedNamedCell: false, wholeCellNotApplicable: false, evidence }));
      (ledger.closureEligibility as Record<string, Json>).remainingPredicates = 2;
      put("corrections", { status: "PURE_COMPOSED_EXISTING_OWNER_SPECIALIZED_ATOMIC_PASS", deltas: added, globalClosed: false });
    }
    put("impact", { status: "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT", retained: { sourceHead: h, sourceSha256: sourceSha, sourceManifest: marker("public-source-manifest.json") }, candidate: { sourceHead: h, sourceSha256: sourceSha, sourceManifest: marker("candidate") }, changes: [], retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false });
    const ownerRef = { fixtureRef: "owner", export: "materializeFinalAccountingReviewed" };
    const producerInputs = ["progress", "parent", "old", "media7", "media3", "final", "impact", "proof"].map(marker);
    put("review", { status: "ROOT_REVIEWED_FINAL_ACCOUNTING_MATERIALIZATION", sourceHead: h, accountingOwner: ownerRef, inputs: producerInputs, qualifiedOperations: ["old", "media7", "media3", "final"].map(marker) });
    put("producer", { status: "FINAL_ACCOUNTING_MATERIALIZED_REVIEWED", sourceHead: h, accountingOwner: ownerRef, review: marker("review"), inputs: producerInputs, outputs: { accounting: marker("ledger"), operations: marker("operations") }, automaticCoverage: [], globalClosed: false });
    if (composite) {
      const fields = ["draftRestoration", "companyImages", "trackingDates", "trackingMedia", "trackingMediaApplicability", "writes"];
      const failedIds = [0, 1, 17, 18, 19, 20].map(index => finalIds[index]), partialIds = finalIds.filter(id => !failedIds.includes(id));
      const priorManifest = manifest.map(row => row.file === rolePaths.verifyowner ? { ...row, sha256: sha256("original-verification-owner") } : row);
      const priorSource = { invocationHeadSha: oldHead, sourceSha256: sha256(JSON.stringify(priorManifest)), manifest: priorManifest };
      put("originalPlan", { cohortHooks: [{ run: "browser-r52", cohort: "domain-forms", expectedJourneyIds: finalIds, privateCompletionFields: fields, finalQuality: true }] });
      const partialRaw = ["public-source-manifest.json", "admin-adoption-browser.json", "partial-native-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json", "public-normal-build.json", "public-product-surface-build.json", "public-platform-contracts.json", "public-admin-adoption.json"];
      for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) for (const stream of ["stdout", "stderr"]) partialRaw.push("public-" + name + "." + stream + ".log");
      for (const name of partialRaw) put("partial-" + name, name.endsWith(".log") ? Buffer.from(name.includes(".stdout.") ? "stdout" : "stderr") : { status: "controlled-original-evidence" });
      put("partial-public-source-manifest.json", priorSource);
      put("partial-admin-adoption-browser.json", { status: "fail", sourceSha256: priorSource.sourceSha256, journeySelection: null,
        evidence: [{ id: "existing-auth-login", status: "pass" }, ...finalIds.map(id => ({ id, status: failedIds.includes(id) ? "fail" : "pass" }))] });
      for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) put("partial-public-" + name + ".json", { name, code: name === "admin-adoption" ? 1 : 0, stdoutSha256: sha256("stdout"), stderrSha256: sha256("stderr") });
      const partialCompletion = { pointers: ["/draftRestoration", "/companyImages", "/writes", "/currentIdentityProtection"],
        fields: { draftRestoration: { status: "scoped" }, companyImages: { status: "scoped" }, writes: [], currentIdentityProtection: { status: "scoped" } },
        missingOriginalFields: ["trackingDates", "trackingMedia", "trackingMediaApplicability"] };
      put("partial", { status: "QUALIFIED_SCOPED_DOMAIN_FORM_PARTIAL_OBSERVATIONS_ORIGINAL_FAILED", statusEnvelope: "qualified-sealed-partial-cohort-envelope", cohort: "domain-forms",
        run: "browser-r148", sourceHead: oldHead, sourceSha256: priorSource.sourceSha256, ownedRunId: "owned-partial", originalHookRun: "browser-r52", deferredFinalQuality: true, finalQuality: false,
        partialOriginalHook: true, originalJourneyCount: 27, journeyCount: 21, originalPrivateCompletionFields: fields, completion: partialCompletion,
        observations: partialIds.map(id => observation(id, priorSource.sourceSha256, "owned-partial")), inputArtifacts: partialRaw.map(name => marker("partial-" + name)), automaticCoverage: [], globalClosed: false });
      const current = models.get("final") as Record<string, Json>; current.journeyCount = 6; current.observations = failedIds.map(id => observation(id, sourceSha, owned));
      current.completion = { pointers: ["/selectedJourneys", "/draftRestoration", "/trackingDates", "/trackingMedia", "/trackingMediaApplicability", "/writes"] };
      put("admin-adoption-browser.json", { status: "pass", sourceSha256: sourceSha, scope: "core-closure", cohort: "domain-forms", journeySelection: "domain-forms-final-six-followup",
        driverCompleted: true, wholeCohortExecuted: false, selectedJourneyIds: failedIds, executedJourneyIds: failedIds,
        evidence: [{ id: "existing-auth-login", status: "pass" }, ...failedIds.map(id => ({ id, status: "pass" }))] });
      const operation = models.get("operations") as { partitions: { qualified: Array<Record<string, Json>> } };
      for (const row of operation.partitions.qualified) if (partialIds.includes(row.id as string)) Object.assign(row, { qualification: marker("partial"), run: "browser-r148", sourceHead: oldHead, sourceSha256: priorSource.sourceSha256, ownedRunId: "owned-partial" });
      put("compositeImpact", { status: "ROOT_REVIEWED_EXACT_VERIFICATION_ONLY_SOURCE_IMPACT", retained: { sourceHead: oldHead, sourceSha256: priorSource.sourceSha256, sourceManifest: marker("partial-public-source-manifest.json") },
        candidate: { sourceHead: h, sourceSha256: sourceSha, sourceManifest: marker("public-source-manifest.json") },
        changes: [{ path: rolePaths.verifyowner, beforeSha256: priorManifest.at(-1)!.sha256, afterSha256: manifest.at(-1)!.sha256, role: "verification-only-residual-correction" }],
        retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false });
      put("composition", { status: "QUALIFIED_SCOPED_DOMAIN_FORM_COMPOSITE_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT", statusEnvelope: "qualified-sealed-composite-cohort-envelope", cohort: "domain-forms", originalHookRun: "browser-r52",
        originalPlan: marker("originalPlan"), originalProgress: marker("progress"), originalJourneyIds: finalIds, journeyCount: 27, sameRun: false, deferredFinalQuality: true, finalQuality: false,
        qualifications: [{ role: "partial-original-failed", qualification: marker("partial"), run: "browser-r148", sourceHead: oldHead, sourceSha256: priorSource.sourceSha256, ownedRunId: "owned-partial", sourceManifest: marker("partial-public-source-manifest.json"), rawArtifacts: partialRaw.map(name => marker("partial-" + name)) },
          { role: "fresh-final-six", qualification: marker("final"), run: "browser-r146", sourceHead: h, sourceSha256: sourceSha, ownedRunId: owned, sourceManifest: marker("public-source-manifest.json"), gateReceipt: marker("public-and-admin-adoption-gates.json"), rawArtifacts: rawRoles.map(marker) }],
        sourceCompatibility: marker("compositeImpact"), completionAssignments: fields.map(field => ({ field, qualifications: field === "draftRestoration" || field === "writes" ? [marker("partial"), marker("final")] : field === "companyImages" ? [marker("partial")] : [marker("final")] })), automaticCoverage: [], globalClosed: false });
      if (composite === "three") {
        const middleHead = "c".repeat(40), middleOwned = "owned-middle", middleIds = failedIds.slice(0, 5), updateIds = failedIds.slice(5);
        const middleManifest = manifest.map(row => row.file === rolePaths.verifyowner ? { ...row, sha256: sha256("intermediate-verification-owner") } : row);
        const middleSource = { invocationHeadSha: middleHead, sourceSha256: sha256(JSON.stringify(middleManifest)), manifest: middleManifest };
        for (const name of partialRaw) put("middle-" + name, name.endsWith(".log") ? Buffer.from(name.includes(".stdout.") ? "stdout" : "stderr") : { status: "controlled-failed-followup" });
        put("middle-public-source-manifest.json", middleSource);
        put("middle-admin-adoption-browser.json", { status: "fail", sourceSha256: middleSource.sourceSha256, scope: "core-closure", cohort: "domain-forms", journeySelection: "domain-forms-final-six-followup",
          driverCompleted: true, wholeCohortExecuted: false, selectedJourneyIds: failedIds, executedJourneyIds: failedIds,
          evidence: [{ id: "existing-auth-login", status: "pass" }, ...failedIds.map(id => ({ id, status: middleIds.includes(id) ? "pass" : "fail" }))] });
        for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) put("middle-public-" + name + ".json", { name, code: name === "admin-adoption" ? 1 : 0, stdoutSha256: sha256("stdout"), stderrSha256: sha256("stderr") });
        const fragment = { status: "partial-not-global-pass", recipeKinds: ["profile", "stage", "item"], completeTrackingFamily: false };
        put("middle", { status: "QUALIFIED_SCOPED_DOMAIN_FORM_PARTIAL_OBSERVATIONS_ORIGINAL_FAILED", statusEnvelope: "qualified-sealed-partial-cohort-envelope", cohort: "domain-forms",
          run: "browser-r149", sourceHead: middleHead, sourceSha256: middleSource.sourceSha256, ownedRunId: middleOwned, originalHookRun: "browser-r52", deferredFinalQuality: true, finalQuality: false,
          partialOriginalHook: true, originalJourneyCount: 27, journeyCount: 5, selectedJourneyCount: 6, selectedJourneyIds: failedIds, excludedJourneyIds: updateIds, originalPrivateCompletionFields: fields,
          completion: { pointers: ["/draftRestoration", "/trackingDates", "/trackingMediaApplicability", "/writes"], fields: { draftRestoration: { status: "scoped" }, writes: [],
            trackingDates: { ...fragment, familyAxisQualified: false }, trackingMediaApplicability: { ...fragment, dispositions: [], dispositionCandidates: ["form", "collection"] } }, missingOriginalFields: ["companyImages", "trackingMedia"] },
          observations: middleIds.map(id => observation(id, middleSource.sourceSha256, middleOwned)), inputArtifacts: partialRaw.map(name => marker("middle-" + name)), automaticCoverage: [], globalClosed: false });
        current.journeyCount = 1; current.observations = updateIds.map(id => observation(id, sourceSha, owned));
        const dateRows = ["update-create", "update-edit"].map((surface, index) => ({ journeyId: updateIds[0], surface, nativeId: "fresh-update-native-" + index, sourceSha256: sourceSha, ownedRunId: owned }));
        const nativeIds = dateRows.map(row => row.nativeId), dateCase = "collection:project-tracking-updates:capability:date_picker";
        put("admin-adoption-database-readback.json", { status: "pass", globalClosed: false, companyImages: null,
          trackingDates: { status: "pass", recipeKinds: ["update"], completeTrackingFamily: false, familyAxisQualified: false, qualified: dateRows,
            aliases: [{ candidateRequiredCase: dateCase, childSurfaces: ["update-create", "update-edit"], nativeIds }], candidateRequiredCases: [dateCase], automaticCoverage: [], globalClosed: false },
          trackingMediaApplicability: { status: "pass", recipeKinds: ["update"], completeTrackingFamily: false, mounted: dateRows.map(row => ({ ...row, kind: "update" })), nativeSaveCount: 2,
            dispositions: [], positiveControl: { consumer: "project-tracking-updates", nativeIds, mediaApplicable: true }, automaticCoverage: [], globalClosed: false },
          trackingMedia: { status: "partial-not-global-pass", exactWrites: 2, nativeSaveReceipts: nativeIds, automaticCoverage: [], globalClosed: false } });
        put("admin-adoption-browser.json", { status: "pass", sourceSha256: sourceSha, scope: "core-closure", cohort: "domain-forms", journeySelection: "domain-forms-update-followup",
          driverCompleted: true, wholeCohortExecuted: false, selectedJourneyIds: updateIds, executedJourneyIds: updateIds,
          evidence: [{ id: "existing-auth-login", status: "pass" }, ...updateIds.map(id => ({ id, status: "pass" }))] });
        for (const row of operation.partitions.qualified) if (middleIds.includes(row.id as string)) Object.assign(row, { qualification: marker("middle"), run: "browser-r149", sourceHead: middleHead, sourceSha256: middleSource.sourceSha256, ownedRunId: middleOwned });
        put("compositeUpdateImpact", structuredClone(models.get("compositeImpact") as Json));
        put("residualImpact", { status: "ROOT_REVIEWED_EXACT_VERIFICATION_ONLY_SOURCE_IMPACT", retained: { sourceHead: middleHead, sourceSha256: middleSource.sourceSha256, sourceManifest: marker("middle-public-source-manifest.json") },
          candidate: { sourceHead: h, sourceSha256: sourceSha, sourceManifest: marker("public-source-manifest.json") },
          changes: [{ path: rolePaths.verifyowner, beforeSha256: middleManifest.at(-1)!.sha256, afterSha256: manifest.at(-1)!.sha256, role: "verification-only-residual-correction" }], retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false });
        const composition = models.get("composition") as Record<string, Json>, leaves = composition.qualifications as Array<Record<string, Json>>;
        leaves[1].role = "fresh-final-update";
        leaves.splice(1, 0, { role: "partial-final-six-failed", qualification: marker("middle"), run: "browser-r149", sourceHead: middleHead, sourceSha256: middleSource.sourceSha256, ownedRunId: middleOwned,
          sourceManifest: marker("middle-public-source-manifest.json"), rawArtifacts: partialRaw.map(name => marker("middle-" + name)) });
        composition.sourceCompatibility = marker("compositeUpdateImpact"); composition.residualSourceCompatibility = marker("residualImpact");
        composition.completionAssignments = fields.map(field => ({ field, qualifications: field === "draftRestoration" || field === "writes" ? [marker("partial"), marker("middle"), marker("final")]
          : field === "companyImages" ? [marker("partial")] : field === "trackingMedia" ? [marker("final")] : [marker("middle"), marker("final")] }));
        composition.completionRecipeAssignments = fields.filter(field => field.startsWith("tracking")).map(field => ({ field,
          qualifications: [...(field === "trackingMedia" ? [] : [{ qualification: marker("middle"), recipeKinds: ["profile", "stage", "item"] }]), { qualification: marker("final"), recipeKinds: ["update"] }] }));
        producerInputs.push(marker("middle"), marker("compositeUpdateImpact"), marker("residualImpact"));
        (models.get("review") as { qualifiedOperations: Json[] }).qualifiedOperations.push(marker("middle"));
      }
      producerInputs.push(marker("partial"), marker("composition"), marker("compositeImpact"), marker("originalPlan"));
      (models.get("review") as { qualifiedOperations: Json[] }).qualifiedOperations.push(marker("partial"));
    }
    put("integrity", { status: "FINAL_EVIDENCE_INTEGRITY_PASS", sourceHead: h, requiredReferences: [...models.keys()].map(marker), checkedReferences: [...models.keys()].map(marker), failedReferences: [], historicalFailedSealsPreserved: true, qualifiedSourceIdentitiesPreserved: true, remainingOwnedResources: 0, remainingOwnedProcesses: 0 });
    put("admission", { status: "ROOT_REVIEWED_FINAL_BEHAVIOR_READY_FOR_QUALITY", sourceHead: h, sourceManifest: marker("candidate"), accounting: marker("ledger"), operations: marker("operations"), integrity: marker("integrity"), sourceCompatibility: marker("impact"), accountingOwner: ownerRef, producerExecution: marker("producer"), closureEligible: false, closureBlockers: [marker("blocker")], final27: { qualification: marker("final"), sourceManifest: marker("public-source-manifest.json"), gateReceipt: marker("public-and-admin-adoption-gates.json"), originalHookRun: "browser-r52", ...(composite ? { composition: marker("composition") } : {}) }, operationCounts: counts, namedCellCounts, remainingPredicates: corrections ? 2 : 3, incompleteDomainInventories: 1, openPreviewStates: 1, cleanup: { remainingOwnedResources: 0, remainingOwnedProcesses: 0 }, automaticCoverage: [], globalClosed: false });
    const edit = (role: string, keys: Array<string | number>, value: Json | undefined) => {
      let node = models.get(role) as Json;
      for (const key of keys.slice(0, -1)) { assert.ok(node && typeof node === "object"); node = (node as Record<string, Json>)[String(key)]; }
      assert.ok(node && typeof node === "object"); const key = String(keys.at(-1));
      if (value === undefined) delete (node as Record<string, Json>)[key]; else (node as Record<string, Json>)[key] = value;
    };
    const bytes = new Map<string, Buffer>(), refs = new Map<string, { path: string; sha256: string }>();
    const expand = (value: Json): Json => {
      if (Array.isArray(value)) return value.map(expand);
      if (value && typeof value === "object") { if (typeof value.fixtureRef === "string") { const { fixtureRef, ...extra } = value; return { ...seal(fixtureRef as string), ...extra }; } return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item)])); }
      return value;
    };
    const seal = (role: string): { path: string; sha256: string } => {
      const cached = refs.get(role); if (cached) return cached;
      assert.ok(models.has(role), role); const value = models.get(role)!;
      const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(expand(value)));
      const ref = { path: rolePaths[role], sha256: sha256(raw) }; assert.ok(ref.path, role); refs.set(role, ref); bytes.set(path.resolve(memoryRoot, ref.path), raw); return ref;
    };
    const priorAuthority = seal("parent");
    const authority = { predicateCorrectionManifest: config.authority.predicateCorrectionManifest, retainedQualificationRoot: config.authority.retainedQualificationRoot, operationIdentitySha256: sha256(JSON.stringify([...operationIds].sort())), caseIdentitySha256: sha256(JSON.stringify(caseKeys)), priorAccounting: priorAuthority, predicateCorrectionProof: seal("corrections"), final27Plan: composite ? seal("originalPlan") : config.authority.final27Plan };
    mutate?.(edit); refs.clear(); bytes.clear(); const admission = seal("admission");
    return { authority, expected, admission, bytes, refs, links: new Map<string, string>() };
  };
  const code = ["assertRetainedFinalQualitySource", "assertRetainedFinalQualityCompositeSource", "loadRetainedFinalQualityAdmission"].map(name => statement(name).getText(file).replace(/^export /u, "")).join("\n");
  type Loaded = ReturnType<typeof import("./lib/isolated-public-verification.mts").loadRetainedFinalQualityAdmission>;
  const invoke = (frame: ReturnType<typeof fixture>, expected = frame.expected) => {
    const read = (name: string) => { const value = frame.bytes.get(name); assert.ok(value, "Missing memory-only artifact: " + name); return value; };
    const ports = { assert, digest: sha256, ROOT: memoryRoot, sourceIncluded, resolve: path.resolve, sep: path.sep,
      FINAL_QUALITY_ACCOUNTING: config.base, FINAL_QUALITY_READINESS: config.admission, RETAINED_FINAL_QUALITY_AUTHORITY: frame.authority,
      readFileSync: read, realpathSync: (name: string) => frame.links.get(name) ?? name, lstatSync: (name: string) => ({ isFile: () => frame.bytes.has(name) }) };
    const load = new Function(...Object.keys(ports), compile(code) + ";return loadRetainedFinalQualityAdmission;")(...Object.values(ports)) as (sha: string, source: typeof expected) => Loaded;
    return load(frame.admission.sha256, expected);
  };
  check("retained Quality accepts sealed partial7 plus fresh3 and Final27 with honest OPEN959 and explicit Closure blockers", () => {
    const f = fixture(), result = invoke(f); result.verify(); assert.equal(result.receipt.reexecuted, false);
    assert.equal(result.receipt.accountingState.namedCellCounts.openApplicable, 957); assert.equal(result.receipt.accountingState.incompleteDomainInventories, 1); assert.equal(result.receipt.globalClosed, false);
  });
  check("retained artifact roles preserve old qualifications and new successor outputs with distinct fixed roots", () => {
    assert.equal(retainedBase, ".tmp-qa/core-final-closure/held37-final52-closure-2026-10-03/accounting/");
    assert.equal(b, ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/accounting/");
    assert.notEqual(retainedBase, b);
    const f = fixture(undefined, "three"), admitted = invoke(f); admitted.verify();
    for (const role of ["final", "partial", "middle", "composition", "compositeUpdateImpact", "residualImpact"]) assert.ok(f.refs.get(role)!.path.startsWith(retainedBase));
    for (const role of ["candidate", "ledger", "operations", "integrity", "impact", "producer", "review"]) assert.ok(f.refs.get(role)!.path.startsWith(b));
    assert.equal(admitted.receipt.reexecuted, false);
  });
  for (const role of ["final", "partial", "middle", "composition", "compositeUpdateImpact", "residualImpact"]) check("retained artifact roles reject relocated historical " + role + " after all metadata is resealed", () => {
    const originalPath = rolePaths[role];
    try { rolePaths[role] = b + originalPath.slice(retainedBase.length); assert.throws(() => invoke(fixture(undefined, "three"))); }
    finally { rolePaths[role] = originalPath; }
  });
  for (const role of ["candidate", "ledger", "operations", "integrity", "impact", "producer", "review"]) check("retained artifact roles reject predecessor-root current " + role + " after all metadata is resealed", () => {
    const originalPath = rolePaths[role];
    try { rolePaths[role] = retainedBase + originalPath.slice(b.length); assert.throws(() => invoke(fixture(undefined, "three"))); }
    finally { rolePaths[role] = originalPath; }
  });
  check("retained Quality accepts only approved non-pass predicate corrections with every old identity retained", () => {
    const f = fixture(undefined, false, true), result = invoke(f); result.verify();
    assert.equal(result.receipt.accountingState.remainingPredicates, 2); assert.equal(result.receipt.accountingState.namedCellCounts.qualifiedApplicable, 0);
    assert.equal(result.receipt.accountingState.namedCellCounts.openApplicable, 957);
  });
  const correctionNegatives: Array<[string, string, Array<string | number>, Json | undefined]> = [
    ["changed prior correction", "ledger", ["predicateCorrections", 0, "classification"], "rewritten"],
    ["unapproved appended correction", "ledger", ["predicateCorrections", 2, "predicateId"], "foreign"],
    ["correction counted as behavior", "ledger", ["predicateCorrections", 2, "countsAsPass"], true],
    ["missing disposition", "ledger", ["modules", "U04", 0, "predicateDispositions"], []],
    ["orphan correction history", "ledger", ["modules", "U04", 0, "dispositionEvidence", "previousOpenPredicates"], []],
    ["altered original predicate", "ledger", ["modules", "U04", 0, "predicateDispositions", 0, "previousPredicate", "status"], "PASS"],
    ["nonpass disposition qualified", "ledger", ["modules", "U04", 0, "predicateDispositions", 0, "qualifiedNamedCell"], true],
    ["nonpass disposition promotes whole cell", "ledger", ["modules", "U04", 0, "predicateDispositions", 0, "wholeCellNotApplicable"], true],
    ["whole-cell N/A substitution", "ledger", ["modules", "U04", 0, "status"], "PROVEN_NOT_APPLICABLE"],
    ["unapproved disposition status", "ledger", ["modules", "U04", 0, "predicateDispositions", 0, "status"], "QUALIFIED"],
    ["proof source changed independently", "ledger", ["modules", "U04", 0, "predicateDispositions", 0, "evidence", "sourceGraph", "entry"], "src/app/foreign.tsx"],
    ["missing correction", "ledger", ["predicateCorrections"], []],
    ["duplicate original open predicate", "ledger", ["modules", "U02", 0, "openPredicates"], [{ id: "predicate-0" }, { id: "predicate-0" }]],
    ["qualified/open overlap", "ledger", ["modules", "U02", 0, "qualifiedPredicates"], [{ id: "predicate-0" }]],
    ["disposed/qualified overlap", "ledger", ["modules", "U04", 0, "qualifiedPredicates"], [{ id: "predicate-1-0" }]],
    ["duplicate disposed identity", "ledger", ["modules", "U04", 0, "predicateDispositions", 1, "predicateId"], "predicate-1-0"],
  ];
  for (const [name, role, keys, value] of correctionNegatives) check("retained corrections reject " + name + " after resealing", () => assert.throws(() => invoke(fixture(edit => edit(role, keys, value), false, true))));
  check("retained corrections reject changed authority bytes and current source before every later gate", () => {
    for (const role of ["corrections", "product"]) { const f = fixture(undefined, false, true), admitted = invoke(f); f.bytes.set(path.resolve(memoryRoot, rolePaths[role]), Buffer.from("changed")); assert.throws(admitted.verify); assert.throws(() => invoke(f)); }
  });
  check("retained admission hashes non-JSON raw logs/owner source and exact finite tracked source without executing or parsing them", () => { const f = fixture(); invoke(f).verify(); assert.ok(f.bytes.get(path.resolve(memoryRoot, rolePaths.log))!.toString().startsWith("not JSON")); });
  const negatives: Array<[string, string, Array<string | number>, Json | undefined]> = [
    ["unreviewed admission", "admission", ["status"], "DRAFT"], ["wrong current head", "admission", ["sourceHead"], oldHead],
    ["stale source digest", "candidate", ["sourceSha256"], "0".repeat(64)], ["changed executable manifest", "candidate", ["manifest", 1, "sha256"], "0".repeat(64)],
    ["invented Final27 journey", "final", ["observations", 0, "journeyId"], "foreign"], ["wrong Final27 source", "final", ["observations", 0, "sourceSha256"], "0".repeat(64)],
    ["wrong Final27 owned run", "final", ["ownedRunId"], "foreign"], ["missing deferred Quality provenance", "final", ["deferredFinalQuality"], false],
    ["substituted retained qualification", "operations", ["partitions", "qualified", 0, "qualification"], marker("media7")],
    ["relabelled retained source", "operations", ["partitions", "qualified", 0, "sourceHead"], h],
    ["relabelled retained owned run", "operations", ["partitions", "qualified", 0, "ownedRunId"], "foreign"],
    ["misbound Media observation", "media7", ["observations", 0, "journeyId"], "foreign"],
    ["unqualified Media observation", "media7", ["observations", 0, "status"], "pass"],
    ["remaining held original operation", "operations", ["partitions", "held"], ["final-0"]], ["N/A counted as pass", "operations", ["partitions", "notApplicable", 0, "countsAsPass"], true],
    ["falsified original111 total", "operations", ["counts", "total"], 110], ["missing raw native input", "final", ["inputArtifacts"], []],
    ["failed original Admin gate", "public-and-admin-adoption-gates.json", ["gates", 3, "code"], 1], ["fabricated public gate in targeted behavior", "public-and-admin-adoption-gates.json", ["gates", 3, "name"], "public-e2e"],
    ["falsified open959 count", "admission", ["namedCellCounts", "openApplicable"], 0], ["replaced canonical959 key", "ledger", ["closureEligibility", "namedCells", 0, "key"], "foreign"],
    ["dropped module cell", "ledger", ["modules", "U04"], []], ["dropped predicate", "ledger", ["modules", "U04", 0, "openPredicates"], []],
    ["shrunk lifecycle denominator", "ledger", ["U01", "lifecycle", "denominator"], 1], ["falsified open predicate total", "admission", ["remainingPredicates"], 0],
    ["concealed domain inventory gap", "admission", ["incompleteDomainInventories"], 0], ["dropped domain identity", "ledger", ["closureEligibility", "domainInventories"], []],
    ["concealed Preview gap", "admission", ["openPreviewStates"], 0], ["dropped Preview identity", "ledger", ["closureEligibility", "previewStates"], []],
    ["false Closure eligibility", "admission", ["closureEligible"], true], ["missing Closure blockers", "admission", ["closureBlockers"], []],
    ["changed producer export", "admission", ["accountingOwner", "export"], "parallelOwner"], ["unreviewed producer", "producer", ["status"], "PASS"],
    ["missing producer qualifier", "review", ["qualifiedOperations"], [marker("final")]], ["incomplete integrity", "integrity", ["checkedReferences"], []],
    ["failed integrity", "integrity", ["failedReferences"], ["changed"]], ["resource leak", "admission", ["cleanup", "remainingOwnedResources"], 1],
  ];
  for (const [name, role, keys, value] of negatives) check("retained admission rejects " + name + " after all artifact hashes are resealed", () => assert.throws(() => invoke(fixture(edit => edit(role, keys, value)))));
  check("retained admission rejects artifact-byte mutation after admission and again before a later gate", () => {
    const f = fixture(), admitted = invoke(f); f.bytes.set(path.resolve(memoryRoot, rolePaths.log), Buffer.from("changed raw log")); assert.throws(admitted.verify); assert.throws(() => invoke(f));
  });
  check("retained admission rejects a symlink/junction escape", () => { const f = fixture(); f.links.set(path.resolve(memoryRoot, rolePaths.final), path.resolve(memoryRoot, "outside.json")); assert.throws(() => invoke(f)); });
  check("retained admission rejects a private environment reference even with a known hash", () => { const f = fixture(edit => edit("integrity", ["requiredReferences", 0], { path: ".env.local", sha256: "0".repeat(64) })); assert.throws(() => invoke(f)); });

  check("retained Quality accepts exact composite21 plus fresh6 while preserving failed148 and every per-leaf111 identity", () => {
    const f = fixture(undefined, true), result = invoke(f); result.verify();
    assert.equal(result.receipt.composition?.sameRun, false); assert.equal(result.receipt.qualifiedJourneyIds.length, 27);
    assert.equal(result.receipt.primaryQualificationJourneyIds?.length, 6); assert.equal(result.receipt.composition?.qualifications[0].run, "browser-r148");
    assert.equal(JSON.parse(f.bytes.get(path.resolve(memoryRoot, rolePaths["partial-admin-adoption-browser.json"]))!.toString()).status, "fail");
    assert.equal(JSON.parse(f.bytes.get(path.resolve(memoryRoot, rolePaths["partial-public-admin-adoption.json"]))!.toString()).code, 1);
  });
  const compositeNegatives: Array<[string, string, Array<string | number>, Json | undefined]> = [
    ["missing composite authority", "admission", ["final27", "composition"], undefined],
    ["fabricated one run", "composition", ["sameRun"], true], ["invented shared build", "composition", ["buildIdSha256"], "a".repeat(64)],
    ["duplicate original27", "composition", ["originalJourneyIds", 0], "final-1"], ["missing original27", "composition", ["journeyCount"], 26],
    ["wrong original progress", "composition", ["originalProgress"], marker("proof")], ["missing original plan", "composition", ["originalPlan"], marker("proof")],
    ["partial relabelled complete", "partial", ["status"], "QUALIFIED_SCOPED_COHORT_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT"],
    ["raw failed Browser relabelled PASS", "partial-admin-adoption-browser.json", ["status"], "pass"],
    ["raw failed Admin relabelled success", "partial-public-admin-adoption.json", ["code"], 0],
    ["partial build failed", "partial-public-normal-build.json", ["code"], 1],
    ["resealed partial log digest differs from raw bytes", "partial-public-normal-build.json", ["stdoutSha256"], "0".repeat(64)],
    ["partial build missing", "partial", ["inputArtifacts"], []], ["partial fabricated build", "partial", ["buildIdSha256"], "a".repeat(64)],
    ["failed case promoted inside partial", "partial-admin-adoption-browser.json", ["evidence", 1, "status"], "pass"],
    ["partial missing current identity proof", "partial", ["completion", "fields", "currentIdentityProtection"], undefined],
    ["wrong leaf source", "composition", ["qualifications", 0, "sourceSha256"], "0".repeat(64)],
    ["wrong partial observation source", "partial", ["observations", 0, "sourceSha256"], "0".repeat(64)],
    ["partial row assigned latest run", "operations", ["partitions", "qualified", 85, "run"], "browser-r146"],
    ["partial row assigned latest qualification", "operations", ["partitions", "qualified", 85, "qualification"], marker("final")],
    ["fresh whole-cohort claim", "admin-adoption-browser.json", ["wholeCohortExecuted"], true],
    ["wrong fresh selector", "admin-adoption-browser.json", ["journeySelection"], "text-topic-forms"],
    ["fresh missing selected case", "admin-adoption-browser.json", ["selectedJourneyIds"], []],
    ["fresh missing full gate", "public-and-admin-adoption-gates.json", ["gates"], []],
    ["wrong completion assignment", "composition", ["completionAssignments", 1, "qualifications"], [marker("final")]],
    ["missing fresh draft assignment", "composition", ["completionAssignments", 0, "qualifications"], [marker("partial")]],
    ["missing fresh draft proof", "final", ["completion", "pointers"], ["/selectedJourneys", "/trackingDates", "/trackingMedia", "/trackingMediaApplicability", "/writes"]],
    ["missing partial company proof", "partial", ["completion", "pointers"], ["/draftRestoration", "/writes", "/currentIdentityProtection"]],
    ["unreviewed intermediate impact", "compositeImpact", ["status"], "DRAFT"],
    ["omitted intermediate change", "compositeImpact", ["changes"], []],
    ["wrong exact prior digest", "compositeImpact", ["changes", 0, "beforeSha256"], "0".repeat(64)],
    ["wrong exact latest digest", "compositeImpact", ["changes", 0, "afterSha256"], "0".repeat(64)],
    ["relabelled partial behavior", "compositeImpact", ["retainedBehaviorRelabelled"], true],
    ["wrong latest docs-only impact", "impact", ["status"], "ROOT_REVIEWED_EXACT_VERIFICATION_ONLY_SOURCE_IMPACT"],
  ];
  for (const [name, role, keys, value] of compositeNegatives) check("composite Quality rejects " + name + " after resealing metadata", () => assert.throws(() => invoke(fixture(edit => edit(role, keys, value), true))));
  check("composite source guard rejects a fully rehashed Product/config/migration delta and unrelated Verification owner", () => {
    const body = compile(statement("assertRetainedFinalQualityCompositeSource").getText(file).replace(/^export /u, ""));
    const guard = new Function("assert", "digest", "sourceIncluded", body + ";return assertRetainedFinalQualityCompositeSource;")(assert, sha256, sourceIncluded);
    for (const name of ["src/app/page.tsx", "next.config.ts", "supabase/migrations/20261004000000_change.sql", "scripts/verify-platform.mts"]) {
      const retained = { invocationHeadSha: oldHead, manifest: [{ file: name, sha256: sha256("before") }], sourceSha256: "" };
      const candidate = { invocationHeadSha: h, manifest: [{ file: name, sha256: sha256("after") }], sourceSha256: "" };
      retained.sourceSha256 = sha256(JSON.stringify(retained.manifest)); candidate.sourceSha256 = sha256(JSON.stringify(candidate.manifest));
      assert.throws(() => guard({ status: "ROOT_REVIEWED_EXACT_VERIFICATION_ONLY_SOURCE_IMPACT", retained: { sourceHead: oldHead, sourceSha256: retained.sourceSha256 }, candidate: { sourceHead: h, sourceSha256: candidate.sourceSha256 }, changes: [{ path: name, beforeSha256: retained.manifest[0].sha256, afterSha256: candidate.manifest[0].sha256, role: "verification-only-residual-correction" }], retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false }, retained, candidate));
    }
  });
  check("composite Quality rejects a missing individual build even when both raw-input lists agree", () => {
    const refs = Object.keys(rolePaths).filter(role => role.startsWith("partial-") && role !== "partial-public-normal-build.json").map(marker);
    assert.throws(() => invoke(fixture(edit => { edit("partial", ["inputArtifacts"], refs); edit("composition", ["qualifications", 0, "rawArtifacts"], refs); }, true)));
  });
  check("retained Quality accepts exact21 plus partial5 plus fresh Update1 without promoting either failed raw run", () => {
    const f = fixture(undefined, "three"), result = invoke(f); result.verify();
    assert.equal(result.receipt.qualifiedJourneyIds.length, 27); assert.equal(result.receipt.primaryQualificationJourneyIds?.length, 1);
    assert.deepEqual(result.receipt.composition?.qualifications.map(row => row.role), ["partial-original-failed", "partial-final-six-failed", "fresh-final-update"]);
    assert.ok(result.receipt.composition?.residualSourceCompatibility); assert.equal(result.receipt.composition?.sameRun, false);
    for (const prefix of ["partial-", "middle-"]) {
      assert.equal(JSON.parse(f.bytes.get(path.resolve(memoryRoot, rolePaths[prefix + "admin-adoption-browser.json"]))!.toString()).status, "fail");
      assert.equal(JSON.parse(f.bytes.get(path.resolve(memoryRoot, rolePaths[prefix + "public-admin-adoption.json"]))!.toString()).code, 1);
    }
  });
  const threeNegatives: Array<[string, string, Array<string | number>, Json | undefined]> = [
    ["latest missing raw date completion", "admin-adoption-database-readback.json", ["trackingDates"], undefined],
    ["latest falsely complete family", "admin-adoption-database-readback.json", ["trackingDates", "completeTrackingFamily"], true],
    ["latest falsely grants date family axis", "admin-adoption-database-readback.json", ["trackingDates", "familyAxisQualified"], true],
    ["latest wrong scoped recipes", "admin-adoption-database-readback.json", ["trackingDates", "recipeKinds"], ["profile", "stage", "item", "update"]],
    ["latest wrong date source", "admin-adoption-database-readback.json", ["trackingDates", "qualified", 0, "sourceSha256"], "0".repeat(64)],
    ["latest wrong date owned run", "admin-adoption-database-readback.json", ["trackingDates", "qualified", 0, "ownedRunId"], "owned-middle"],
    ["latest missing edit date", "admin-adoption-database-readback.json", ["trackingDates", "qualified", 1, "surface"], "stage-edit"],
    ["latest duplicate native dates", "admin-adoption-database-readback.json", ["trackingDates", "qualified", 1, "nativeId"], "fresh-update-native-0"],
    ["latest falsely adds family candidate", "admin-adoption-database-readback.json", ["trackingDates", "candidateRequiredCases"], ["form:project-tracking-create-edit:capability:date_picker"]],
    ["latest foreign date alias", "admin-adoption-database-readback.json", ["trackingDates", "aliases", 0, "childSurfaces"], ["item-create", "item-edit"]],
    ["latest missing mounted applicability", "admin-adoption-database-readback.json", ["trackingMediaApplicability", "mounted"], []],
    ["latest wrong applicability native join", "admin-adoption-database-readback.json", ["trackingMediaApplicability", "mounted", 0, "nativeId"], "foreign"],
    ["latest grants unrelated applicability disposition", "admin-adoption-database-readback.json", ["trackingMediaApplicability", "dispositions"], [{ status: "PROVEN_NOT_APPLICABLE" }]],
    ["latest wrong positive-control IDs", "admin-adoption-database-readback.json", ["trackingMediaApplicability", "positiveControl", "nativeIds"], ["foreign"]],
    ["latest lacks positive Media applicability", "admin-adoption-database-readback.json", ["trackingMediaApplicability", "positiveControl", "mediaApplicable"], false],
    ["latest incomplete Media writes", "admin-adoption-database-readback.json", ["trackingMedia", "exactWrites"], 1],
    ["latest Media uses another native save", "admin-adoption-database-readback.json", ["trackingMedia", "nativeSaveReceipts"], ["foreign", "fresh-update-native-1"]],
    ["latest promotes Media to global pass", "admin-adoption-database-readback.json", ["trackingMedia", "status"], "pass"],
    ["latest claims automatic coverage", "admin-adoption-database-readback.json", ["trackingDates", "automaticCoverage"], ["axis"]],
    ["latest claims Company execution", "admin-adoption-database-readback.json", ["companyImages"], { status: "pass" }],
    ["wrong middle role", "composition", ["qualifications", 1, "role"], "fresh-final-six"],
    ["missing middle qualification", "composition", ["qualifications", 1, "qualification"], marker("partial")],
    ["invented middle full gate", "composition", ["qualifications", 1, "gateReceipt"], marker("public-and-admin-adoption-gates.json")],
    ["middle relabelled full success", "middle", ["status"], "QUALIFIED_SCOPED_COHORT_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT"],
    ["middle raw relabelled pass", "middle-admin-adoption-browser.json", ["status"], "pass"],
    ["middle admin failure concealed", "middle-public-admin-adoption.json", ["code"], 0],
    ["middle public build failed", "middle-public-product-surface-build.json", ["code"], 1],
    ["middle wrong raw log digest", "middle-public-normal-build.json", ["stdoutSha256"], "0".repeat(64)],
    ["middle invented build identity", "middle", ["buildIdSha256"], "a".repeat(64)],
    ["middle wrong source", "middle", ["sourceSha256"], "0".repeat(64)],
    ["middle wrong owned run", "middle", ["ownedRunId"], "wrong"],
    ["middle wrong selected count", "middle", ["selectedJourneyCount"], 5],
    ["middle missing selection", "middle", ["selectedJourneyIds"], []],
    ["middle missing failed exclusion", "middle", ["excludedJourneyIds"], []],
    ["middle missing executed case", "middle-admin-adoption-browser.json", ["executedJourneyIds"], []],
    ["middle whole cohort claim", "middle-admin-adoption-browser.json", ["wholeCohortExecuted"], true],
    ["middle driver incomplete", "middle-admin-adoption-browser.json", ["driverCompleted"], false],
    ["middle wrong selector", "middle-admin-adoption-browser.json", ["journeySelection"], "domain-forms-update-followup"],
    ["failed Update promoted in middle", "middle-admin-adoption-browser.json", ["evidence", 6, "status"], "pass"],
    ["middle duplicated observation", "middle", ["observations", 1, "journeyId"], "final-0"],
    ["middle observation source mismatch", "middle", ["observations", 0, "sourceSha256"], "0".repeat(64)],
    ["middle111 row assigned latest", "operations", ["partitions", "qualified", 83, "qualification"], marker("final")],
    ["middle falsely complete Tracking family", "middle", ["completion", "fields", "trackingDates", "completeTrackingFamily"], true],
    ["middle falsely qualifies family axis", "middle", ["completion", "fields", "trackingDates", "familyAxisQualified"], true],
    ["middle prematurely grants applicability dispositions", "middle", ["completion", "fields", "trackingMediaApplicability", "dispositions"], [{ status: "PROVEN_NOT_APPLICABLE" }]],
    ["middle falsely granted Update dates", "middle", ["completion", "fields", "trackingDates", "recipeKinds"], ["profile", "stage", "item", "update"]],
    ["middle falsely granted Tracking media", "middle", ["completion", "fields", "trackingMedia"], { status: "pass" }],
    ["middle missing scoped date pointer", "middle", ["completion", "pointers"], ["/draftRestoration", "/trackingMediaApplicability", "/writes"]],
    ["missing middle draft assignment", "composition", ["completionAssignments", 0, "qualifications"], [marker("partial"), marker("final")]],
    ["media assigned failed middle", "composition", ["completionAssignments", 3, "qualifications"], [marker("middle"), marker("final")]],
    ["missing recipe assignment", "composition", ["completionRecipeAssignments"], undefined],
    ["Update recipe assigned middle", "composition", ["completionRecipeAssignments", 0, "qualifications", 0, "recipeKinds"], ["update"]],
    ["middle applicability assigned latest only", "composition", ["completionRecipeAssignments", 2, "qualifications"], [{ qualification: marker("final"), recipeKinds: ["update"] }]],
    ["missing residual source impact", "composition", ["residualSourceCompatibility"], undefined],
    ["substituted residual source impact", "composition", ["residualSourceCompatibility"], marker("compositeUpdateImpact")],
    ["residual wrong source binding", "residualImpact", ["retained", "sourceManifest"], marker("partial-public-source-manifest.json")],
    ["residual omitted source change", "residualImpact", ["changes"], []],
    ["residual changed before digest", "residualImpact", ["changes", 0, "beforeSha256"], "0".repeat(64)],
    ["original148 source impact omitted", "compositeUpdateImpact", ["changes"], []],
    ["latest wrong subset selector", "admin-adoption-browser.json", ["journeySelection"], "domain-forms-final-six-followup"],
    ["latest repeated five cases", "final", ["journeyCount"], 6],
    ["latest fabricated full gate", "public-and-admin-adoption-gates.json", ["gates", 3, "code"], 1],
    ["latest missing Tracking media pointer", "final", ["completion", "pointers"], ["/draftRestoration", "/trackingDates", "/trackingMediaApplicability", "/writes"]],
    ["three leaf bypasses latest docs-only guard", "impact", ["status"], "ROOT_REVIEWED_EXACT_REPORT_AND_POST149_TEST_CORRECTION_SOURCE_IMPACT"],
  ];
  for (const [name, role, keys, value] of threeNegatives) check("three-leaf Quality rejects " + name + " after all hashes are resealed", () => assert.throws(() => invoke(fixture(edit => edit(role, keys, value), "three"))));
  check("three-leaf Quality rejects missing middle raw native even when both input lists agree", () => {
    const refs = Object.keys(rolePaths).filter(role => role.startsWith("middle-") && role !== "middle-core-native-control-readback.json").map(marker);
    assert.throws(() => invoke(fixture(edit => { edit("middle", ["inputArtifacts"], refs); edit("composition", ["qualifications", 1, "rawArtifacts"], refs); }, "three")));
  });
  check("three-leaf Quality retains live byte verification across both historical leaves", () => {
    const f = fixture(undefined, "three"), result = invoke(f); f.bytes.set(path.resolve(memoryRoot, rolePaths["middle-public-admin-adoption.stdout.log"]), Buffer.from("changed middle raw log")); assert.throws(result.verify);
  });
  const run = statement("runOwnedPublicVerification") as ts.FunctionDeclaration; assert.ok(run.body);
  const beforeContext = run.body.statements.findIndex(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === "originalContext")); assert.ok(beforeContext > 0);
  const requestCode = run.body.statements.slice(0, beforeContext).map(node => node.getText(file)).join("\n");
  assert.equal(admissionControls.status, "PASS"); assert.equal(admissionControls.actualOsProcessesExecuted, false); assert.equal(admissionControls.actualFilesWritten, false);
  // This actual executor fixture supplies private in-memory control authority only;
  // it does not qualify the current runtime, source checkout or any owned resources.
  const { qualification, privateInvocations } = admissionControls.requestGuardAdmission;
  assert.equal(qualification.status, "PASS");
  const guard = new Function("assert", "digest", "localVerificationAdmissionInvocations", "gitHead", "prepared", "adminCredentials", "CORE_PREVIEW_PUBLIC_IMPACT_SELECTION", "validateCorePreviewPublicImpactSelection", "validateCoreJourneySelection", "ownedProcessCleanupQualification", compile(["localVerificationOperationalDeadlineMs", "adminAdoptionGate"].map(name => statement(name).getText(file).replace(/^export /u, "")).join("\n") + "\nreturn async function(request) { const context={assertOwned:async()=>{}}; " + requestCode + ";return {adoption,retainedQuality}; }"))(assert, sha256, privateInvocations, async () => qualification.finalHead, { get: () => ({}) }, { get: () => ({}) }, "preview-public-impact", () => undefined, () => undefined,
    () => ({ fullEProcessCleanupQualified: true })) as (request: Record<string, unknown>) => Promise<{ adoption: boolean; retainedQuality: boolean }>;
  const requests = { retained: { additionalSourceFiles: [], finalQualityGate: true, retainedAdminBehaviorAdmissionSha256: "f".repeat(64), admissionQualification: qualification }, legacy: { additionalSourceFiles: [], finalQualityGate: true, selection: "admin-adoption", adoptionScope: "core-closure", adoptionCohort: "domain-forms", admissionQualification: qualification } };
  assert.deepEqual(await guard(requests.retained), { adoption: false, retainedQuality: true }); assert.deepEqual(await guard(requests.legacy), { adoption: true, retainedQuality: false });
  for (const patch of [{ finalQualityGate: undefined }, { selection: "admin-adoption" }, { selection: "build-contracts" }, { adoptionCohort: "domain-forms" }, { additionalSourceFiles: ["scripts/foreign.mts"] }, { retainedAdminBehaviorAdmissionSha256: "bad" }]) await assert.rejects(guard({ ...requests.retained, ...patch }), assert.AssertionError);
  await assert.rejects(guard({ additionalSourceFiles: [], finalQualityGate: true, admissionQualification: qualification }), assert.AssertionError);
  cases.push("actual request guard preserves legacy combined Quality and rejects mixed retained/subset/measurement admission");
  await assert.rejects(guard({ ...requests.retained, admissionQualification: undefined }), error => error instanceof assert.AssertionError && /fresh live source qualification/u.test(error.message));
  await assert.rejects(guard({ ...requests.retained, admissionQualification: JSON.parse(JSON.stringify(qualification)) }), error => error instanceof assert.AssertionError && /live source qualification/u.test(error.message));
  const qualifiedReceiptSha256 = sha256(JSON.stringify(qualification));
  for (const key of ["sourceSha256", "runtime"] as const) {
    const original = qualification[key];
    try {
      if (key === "sourceSha256") qualification.sourceSha256 = "0".repeat(64); else qualification.runtime = { controlledReceiptMutation: true };
      await assert.rejects(guard(requests.retained), error => error instanceof assert.AssertionError && /altered after qualification/u.test(error.message));
    } finally {
      if (key === "sourceSha256") qualification.sourceSha256 = original as string; else qualification.runtime = original;
    }
  }
  assert.equal(sha256(JSON.stringify(qualification)), qualifiedReceiptSha256);
  cases.push("actual controlled request prefix rejects missing or cloned qualification and altered source/runtime receipt fields without granting real live Admission");
  const gateDeclaration = run.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === "gates")); assert.ok(gateDeclaration);
  const gateDependencies = ["mediaUpload", "heroCompatibility", "heroGate"].map(name => {
    const declaration = run.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === name));
    assert.ok(declaration); return declaration.getText(file);
  }).join("\n");
  const gates = new Function("assert", "request", "adoption", "measurement", compile(adminAdoptionControlSource(file) + "\n" + statement("GATES").getText(file) + "\n" + gateDependencies + "\n" + gateDeclaration.getText(file)) + ";return gates;").bind(null, assert) as (request: object, adoption: boolean, measurement?: unknown) => Array<{ name: string }>;
  assert.deepEqual(gates(requests.retained, false).map(row => row.name), ["normal-build", "product-surface-build", "platform-contracts", "public-e2e"]);
  assert.deepEqual(gates(requests.legacy, true).map(row => row.name), ["normal-build", "product-surface-build", "platform-contracts", "public-e2e", "admin-adoption"]);
  assert.deepEqual(gates({ selection: "media-upload-limit" }, false).map(row => row.name), ["normal-build", "media-upload-limit"]);
  assert.deepEqual(gates({ selection: "hero-compatibility" }, false).map(row => row.name), ["normal-build", "hero-compatibility"]);
  cases.push("actual gate selection preserves retained, adoption and media gates while isolating the fixed Hero journey");
  const finalBranch = run.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(file) === "retainedAdmission"); assert.ok(finalBranch);
  const receipts: Array<[string, unknown]> = [], retained = invoke(fixture()), reports = gates(requests.retained, false).map(row => ({ ...row, code: 0 }));
  const value = new Function("assert", "GATES", "reports", "retainedAdmission", "result", "qualityReports", "buildIdSha256", "receipt", "context", compile(finalBranch.getText(file)))(assert, reports, reports, retained, { status: "pass", gates: reports, sourceSha256: "a".repeat(64) }, [], retained.receipt.buildIdSha256, (_context: unknown, name: string, data: unknown) => receipts.push([name, data]), {}) as { finalQualityGate: { retainedAdminBehavior: { reexecuted: boolean }; buildIdSha256: string }; globalClosedClaimed: boolean };
  assert.equal(value.finalQualityGate.retainedAdminBehavior.reexecuted, false); assert.equal(value.finalQualityGate.buildIdSha256, retained.receipt.buildIdSha256); assert.equal(value.globalClosedClaimed, false);
  assert.deepEqual(receipts.map(row => row[0]), ["final-quality-gate.json", "public-four-gates.json"]);
  cases.push("actual retained branch emits only real Public gate slots and separate behavior/build provenance; equal IDs alone are allowed, no fake Admin gate");
}

function verifyFinalQualityGatePlan() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const gates = file.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(file) === "GATES"));
  const planner = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "finalQualityScriptNames");
  const deadline = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "localVerificationQualityPrefixDeadlineMs");
  assert.ok(gates && planner && deadline);
  const code = ts.transpileModule(gates.getText(file) + "\n" + planner.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const plan = new Function("assert", code + ";return finalQualityScriptNames;")(assert) as (scripts: Record<string, string>) => string[];
  const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;
  const prefix = plan(scripts);
  assert.equal(prefix.length + 4, scripts["ci:check"].split("&&").length);
  assert.equal(prefix[0], "lint"); assert.equal(prefix[1], "typecheck");
  for (const changed of [
    { ...scripts, "ci:check": scripts["ci:check"] + " && npm run lint" },
    { ...scripts, "ci:check": "npm run build && " + scripts["ci:check"] },
    { ...scripts, "ci:check": scripts["ci:check"].replace("npm run lint", "npm run lint; echo bypass") },
    { ...scripts, "test:e2e:public": "echo skipped" },
  ]) assert.throws(() => plan(changed));
  cases.push("Final Quality Gate derives every non-build step from ci:check and rejects skipped, duplicated, shell-injected or changed Public tails");
  const run = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification") as ts.FunctionDeclaration;
  assert.ok(run?.body);
  const body = run.body.statements.find(ts.isTryStatement); assert.ok(body);
  const declaration = (name: string, nodes: ts.NodeArray<ts.Statement>) => {
    const result = nodes.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === name));
    assert.equal(result.length, 1); return result[0].getText(file);
  };
  const pending = declaration("pendingQualityPrefix", body.tryBlock.statements);
  const operationalDeadline = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "localVerificationOperationalDeadlineMs"); assert.ok(operationalDeadline);
  const declarations = [deadline.getText(file).replace(/^export /u, ""), operationalDeadline.getText(file).replace(/^export /u, ""), "const operationalBudget = undefined;", gates.getText(file), declaration("heroGate", run.body.statements),
    declaration("qualityPrefix", body.tryBlock.statements), pending, declaration("executionGates", body.tryBlock.statements)];
  type Gate = { name: string; qualityScript?: string };
  type Execution = { qualityPrefix: Gate[]; pendingQualityPrefix: Gate[]; executionGates: Gate[] };
  const compileExecution = (parts: readonly string[]) => new Function("assert", "qualityScripts", "heroCompatibility", "request", "gates",
    ts.transpileModule(parts.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      + ";return {qualityPrefix,pendingQualityPrefix,executionGates};").bind(null, assert) as (scripts: string[], hero: boolean, request: object, gates: Gate[]) => Execution;
  const execution = compileExecution(declarations);
  const canonical = new Function(code + ";return GATES;")() as Gate[];
  // The two source-floor leaves already ran in this exact context. Their named
  // receipts precede the pending queue; they must be conserved, never rerun.
  const floor = body.tryBlock.statements.findIndex(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(row => row.name.getText(file) === "sourceFloor"));
  const floorReports = body.tryBlock.statements.findIndex(node => ts.isForOfStatement(node)
    && node.expression.getText(file) === "sourceFloor.checks.slice(0, qualityPrefix.length ? 2 : 0).entries()");
  const pendingAt = body.tryBlock.statements.findIndex(node => node.getText(file) === pending);
  assert.ok(floor >= 0 && floorReports > floor && pendingAt > floorReports);
  const complete = (value: Execution) => {
    assert.deepEqual(value.qualityPrefix.map(gate => gate.qualityScript), prefix);
    assert.deepEqual(value.pendingQualityPrefix.map(gate => gate.qualityScript), prefix.slice(2));
    return [...value.qualityPrefix.slice(0, 2), ...value.executionGates];
  };
  const standardResult = execution(prefix, false, { finalQualityGate: true }, canonical);
  const standard = standardResult.executionGates, completeStandard = complete(standardResult);
  assert.deepEqual(completeStandard.slice(0, prefix.length).map(gate => gate.qualityScript), prefix);
  assert.deepEqual(completeStandard.slice(prefix.length), canonical);
  assert.equal(completeStandard.length, prefix.length + canonical.length);
  assert.equal(new Set(completeStandard.map(gate => gate.name)).size, completeStandard.length);
  const heroResult = execution(prefix, true, { finalQualityGate: true }, []), hero = heroResult.executionGates;
  assert.deepEqual(hero.slice(0, 2).map(gate => gate.name), ["hero-compatibility-build", "hero-compatibility"]);
  assert.deepEqual(hero.slice(2), standard);
  assert.deepEqual(complete(heroResult).slice(0, 2).map(gate => gate.qualityScript), ["lint", "typecheck"]);
  assert.deepEqual(complete(heroResult).slice(4), completeStandard.slice(2));
  cases.push("Completed source-floor lint/typecheck retain their named slots before Hero prerequisites, pending Quality prefix and unchanged Public tail");
  assert.throws(() => compileExecution(declarations.filter(part => part !== pending))(prefix, false, { finalQualityGate: true }, canonical),
    error => error instanceof ReferenceError && error.message === "pendingQualityPrefix is not defined");
  for (const start of [0, 3]) {
    const mutated = pending.replace("qualityPrefix.length ? 2 : 0", String(start)); assert.notEqual(mutated, pending);
    assert.throws(() => complete(compileExecution(declarations.map(part => part === pending ? mutated : part))(prefix, false, { finalQualityGate: true }, canonical)));
  }
  cases.push("Actual pending-prefix projection rejects its missing binding, duplicate source-floor leaves and an omitted pending leaf");

  const verifier = ts.createSourceFile("verify-isolated-supabase.mts", readSource("scripts/verify-isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tail = verifier.statements.at(-1); assert.ok(tail && ts.isExpressionStatement(tail) && ts.isCallExpression(tail.expression));
  const callback = tail.expression.arguments[0]; assert.ok(callback && ts.isArrowFunction(callback));
  const project = (error: unknown, argv: string[], names: string[]) => {
    const output: string[] = [], controlledProcess = { argv, exitCode: 0 }, mainPort = () => undefined;
    const handler = new Function("assert", "sha256", "process", "cases", "main", "selectedVerification", "console",
      ts.transpileModule("return (" + callback.getText(verifier) + ");", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
      assert, sha256, controlledProcess, names, mainPort, mainPort, { error: (text: string) => output.push(text) }) as (error: unknown) => void;
    handler(error); assert.equal(controlledProcess.exitCode, 1); return output;
  };
  const privateValue = "controlled-private-error://user:password@private.invalid/private-sql";
  const failure = new assert.AssertionError({ actual: privateValue, expected: [privateValue], operator: "strictEqual", message: privateValue });
  const privateCause = Error(privateValue); Object.defineProperty(failure, "cause", { value: privateCause });
  failure.stack = privateValue + "\n at owned (file:///private/verify-isolated-supabase.mts:123:4)\n at foreign (/private/foreign.js:2:3)";
  const output = project(failure, [], [privateValue]), diagnostic = JSON.parse(output[1]);
  assert.equal(output.length, 2); assert.equal(diagnostic.scope, "source/offline");
  assert.equal(output.join("\n").includes(privateValue), false);
  assert.deepEqual(diagnostic.error.actual, { type: "string", length: privateValue.length, sha256: sha256(privateValue) });
  assert.deepEqual(diagnostic.error.expected, { type: "array", length: 1 });
  assert.deepEqual(diagnostic.error.locations, [{ source: "scripts/verify-isolated-supabase.mts", line: 123, column: 4 }]);
  assert.equal(diagnostic.error.code, "ERR_ASSERTION"); assert.equal(diagnostic.error.operator, "strictEqual");
  assert.equal(diagnostic.error.safeMessage, null); assert.equal(Object.getOwnPropertyDescriptor(failure, "cause")?.value, privateCause);
  const current = JSON.parse(project(failure, ["--current-infrastructure-only"], ["controlled-current"])[0]);
  assert.equal(current.scope, "current-infrastructure-only"); assert.equal(current.lastCompletedControl, "controlled-current");
  assert.equal(JSON.stringify(current).includes(privateValue), false);
  const nonError = JSON.parse(project(privateValue, [], [privateValue])[1]); assert.equal(nonError.error.name, "Error");
  assert.equal(JSON.stringify(nonError).includes(privateValue), false);
  const unreadable = Error(privateValue); Object.defineProperty(unreadable, "stack", { get() { throw privateCause; } });
  const fallback = JSON.parse(project(unreadable, [], [privateValue])[1]); assert.equal(fallback.diagnosticProjectionFailed, true);
  assert.equal(JSON.stringify(fallback).includes(privateValue), false);
  assert.equal(project(failure, ["--execute-qualified-impact"], [privateValue]).length, 1);
  cases.push("Actual default/current diagnostic catch preserves exit1, safe assertion facts and private cause identity; non-Error and projection-failure boundaries disclose no private strings");
}

/** Targeted negative proof over actual retained observations; it never grants a live admission seal. */
export function verifyRetainedAssertionRelocationControls(api: Pick<typeof import("./lib/isolated-public-verification.mts"), "validateLocalVerificationAssertionRelocations">,
  input: { baselineSources: ReadonlyMap<string, string | Buffer>; currentSources: ReadonlyMap<string, string | Buffer>; observations: readonly unknown[] }) {
  const form = "scripts/verify-admin-form-system.mts", page = "scripts/verify-page-block-editor-presentation.mts", helper = "scripts/fixtures/admin-form-section-contract.mts";
  const scopes = new Map([[form, "verifyUnifiedFormFields"], [page, "verifyBlockPanelComposition"]]);
  const original = api.validateLocalVerificationAssertionRelocations(input);
  for (const [file, scope] of scopes) assert.ok(original.relocations.some(row => row.file === file && row.scope === scope && row.matched === row.before), "The retained actual positive scope must qualify before its adversaries.");
  assert.ok(original.failures.every(row => row.scope === "registeredVerificationNodeEntries"), "A separate absent parser proof cannot conceal another positive failure.");
  type Observation = Record<string, unknown>;
  const object = (value: unknown): Observation => { assert.ok(value && typeof value === "object" && !Array.isArray(value)); return value as Observation; };
  const rows = (value: unknown): Observation[] => { assert.ok(Array.isArray(value)); return value.map(object); };
  const results: Array<{ name: string; status: "BLOCKED"; failures: Array<{ file: string; scope: string; reason: string }> }> = [];
  const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const reject = (name: string, affected: string, edit: (files: Map<string, string | Buffer>, observations: Observation[]) => void) => {
    const currentSources = new Map(input.currentSources), observations = JSON.parse(JSON.stringify(input.observations)) as Observation[];
    try {
      edit(currentSources, observations);
      const outcome = api.validateLocalVerificationAssertionRelocations({ baselineSources: input.baselineSources, currentSources, observations });
      const failures = outcome.failures.filter(row => row.file === affected || affected === helper && (row.file === form || row.file === page || row.file === helper));
      assert.equal(outcome.status, "BLOCKED", name); assert.ok(failures.length > 0, name + " must fail its changed source/receipt, independently of missing parser proof");
      results.push({ name, status: "BLOCKED", failures });
    } catch (error) {
      if (error instanceof Error) Object.defineProperty(error, "controlProgress", { value: { completed: [...results], failedCase: name } });
      throw error;
    }
  };
  const replace = (files: Map<string, string | Buffer>, file: string, from: string, to: string) => {
    const before = files.get(file)!.toString(); assert.equal(before.split(from).length, 2, "Mutation must select one actual source site");
    files.set(file, before.replace(from, to));
  };
  const refresh = (files: Map<string, string | Buffer>, observations: Observation[], file: string) => {
    for (const receipt of observations.filter(row => row.kind === "assertion-relocation-observations")) {
      const bindings = object(receipt.sourceBindings);
      if (receipt.consumer === file) bindings.consumerRawSha256 = digest(files.get(file)!);
      if (receipt.calleeFile === file) {
        bindings.calleeRawSha256 = digest(files.get(file)!);
        const emitted = ts.transpileModule(files.get(file)!.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
        const tree = ts.createSourceFile(file + ".js", emitted, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const declaration = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === object(bindings.callee).export);
        assert.ok(declaration); const runtimeSource = declaration.getText(tree).replace(/^export /u, "");
        Object.assign(object(bindings.callee), { runtimeSource, runtimeSha256: digest(runtimeSource) });
      }
    }
  };
  const sourceMutation = (name: string, file: string, from: string, to: string) => reject(name, file, (files, observations) => { replace(files, file, from, to); refresh(files, observations, file); });
  sourceMutation("actual predicate deletion with same-count tautological compensation", helper, "assert.ok(panel.includes(premiumSurfaceClassName));", "assert.ok(true);");
  sourceMutation("actual predicate operator reversal", helper, 'assert.equal(neutral.type, "section");', 'assert.notEqual(neutral.type, "section");');
  for (const file of [form, page]) {
    const call = "verifyAdminFormSectionContract(" + (file === form ? "source" : "formSource") + ", {";
    reject("unrelated retained scope deletion cannot borrow a qualified file relocation " + file, file, (files, observations) => {
      const text = files.get(file)!.toString(), previous = input.baselineSources.get(file)!.toString();
      const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), baseline = ts.createSourceFile(file, previous, ts.ScriptTarget.Latest, true);
      const candidates: ts.CallExpression[] = [], prior = new Set<string>();
      const scan = (node: ts.Node, parsed: ts.SourceFile, result: ts.CallExpression[] | Set<string>) => {
        if (ts.isCallExpression(node) && /^assert(?:\.[A-Za-z]+)?$/u.test(node.expression.getText(parsed))) {
          let owner: ts.Node | undefined = node.parent; while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
          if (owner && ts.isFunctionDeclaration(owner) && owner.name && owner.name.text !== scopes.get(file)) {
            if (Array.isArray(result)) result.push(node); else result.add(node.getText(parsed));
          }
        } ts.forEachChild(node, child => scan(child, parsed, result));
      }; scan(tree, tree, candidates); scan(baseline, baseline, prior);
      const selected = candidates.find(node => prior.has(node.getText(tree)) && ts.isExpressionStatement(node.parent));
      assert.ok(selected); files.set(file, text.slice(0, selected.getStart(tree)) + "void 0" + text.slice(selected.end)); refresh(files, observations, file);
    });
    sourceMutation("dead actual helper continuation " + file, file, call, "if (false) " + call);
    reject("unused imported actual helper " + file, file, (files, observations) => {
      const text = files.get(file)!.toString(), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === scopes.get(file));
      assert.ok(owner?.body); const statement = owner.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(tree) === "verifyAdminFormSectionContract");
      assert.ok(statement); files.set(file, text.slice(0, statement.getStart(tree)) + "void 0;" + text.slice(statement.end)); refresh(files, observations, file);
    });
    sourceMutation("shadowed imported actual helper " + file, file, call, "const verifyAdminFormSectionContract = () => true; " + call);
    sourceMutation("foreign helper import " + file, file, 'from "./fixtures/admin-form-section-contract.mts"', 'from "./fixtures/unobserved-contract.mts"');
  }
  sourceMutation("cached source replaces actual Form candidate", form, "loadUnifiedFormOwners(candidate, dependencies).AdminFormSection", "loadUnifiedFormOwners(source, dependencies).AdminFormSection");
  sourceMutation("shared loader ignores actual candidate", helper, "const Section = loadSection(candidate);", "const Section = loadSection(source);");
  sourceMutation("native adapter changes only original candidate operands", helper, "let result: unknown;", 'if (actualContext.candidateKind === "original") { if (property === "ok") args[0] = true; else if (property === "equal") args[1] = args[0]; } let result: unknown;');
  reject("missing actual mutant receipt", form, (_files, observations) => { const receipt = observations.find(row => row.consumer === form); assert.ok(receipt); rows(receipt.mutants); (receipt.mutants as unknown[]).pop(); });
  reject("missing actual mutant, loader and candidate events together", form, (_files, observations) => {
    const receipt = observations.find(row => row.consumer === form); assert.ok(receipt); const mutation = rows(receipt.mutants).at(-1)!;
    receipt.mutants = rows(receipt.mutants).slice(0, -1); receipt.loaders = rows(receipt.loaders).filter(row => row.candidateSha256 !== mutation.candidateSha256);
    receipt.events = rows(receipt.events).filter(row => object(row.context).candidateSha256 !== mutation.candidateSha256);
  });
  reject("changed observed runtime callback despite refreshed self digest", form, (_files, observations) => {
    const receipt = observations.find(row => row.consumer === form); assert.ok(receipt); const callback = object(object(receipt.sourceBindings).loaderCallback);
    callback.runtimeSource = "candidate => cachedSection"; callback.runtimeSha256 = digest(String(callback.runtimeSource));
  });
  reject("changed source consumer binding", form, (_files, observations) => { const receipt = observations.find(row => row.consumer === form); assert.ok(receipt); object(receipt.sourceBindings).consumerRawSha256 = "0".repeat(64); });
  reject("missing source dependency binding", form, (_files, observations) => { const receipt = observations.find(row => row.consumer === form); assert.ok(receipt); delete object(object(receipt.sourceBindings).dependencyBindings).AdminCard; });
  return { status: "PASS" as const, scope: "pure-current-source-over-retained-raw-adversaries", positiveRelocations: original.relocations,
    cases: results, actualProfileExecutions: 0, liveAdmissionSeal: false, retainedPositiveObservations: true, syntheticNegativeMutations: true };
}

/** Execute source discovery and admission with in-memory source bytes, never Browser/DB transports. */
function verifyLocalSourceImpactControls(api: Pick<typeof import("./lib/isolated-public-verification.mts"),
  "deriveLocalVerificationSourceImpact" | "localVerificationAssertionRelocationRequired" | "validateLocalVerificationAssertionRelocations" | "localVerificationSemanticSource" | "localVerificationPresentationSource" | "assertLocalVerificationProtectionMaintenance"
  | "planLocalVerification" | "assertLocalVerificationRequest" | "localVerificationCommandSteps"
  | "deriveLocalVerificationSourceCoherence" | "resolveLocalVerificationCiBaseline" | "localVerificationCiDiagnostic">,
  repositoryScripts: Record<string, string>) {
  const authority = "src/lib/admin/interaction-system/adoption-manifest.ts", formAuthority = "src/lib/admin/form-system/adoption-manifest.ts";
  const owner = "src/components/admin/ui/Phase03Owner.tsx", consumer = "src/app/admin/phase03/Consumer.tsx";
  const contract = "src/lib/admin/phase03/contracts.ts", entry = "scripts/verify-phase03-contract.mts", css = "src/styles/phase03.css";
  const browser = "scripts/qa-phase03-browser.mjs", database = "scripts/qa-phase03-database.mjs", checkName = "verify:phase03-owner";
  const capability = 'widget: { owner: "Phase03Owner", sourceFiles: ["' + owner + '"], executableBindings: [{sourceFile: "' + owner + '", exportNames:["Phase03Owner"]}] }';
  const authoritySource = 'function defineAdminSharedCapabilitySet(value) { return value; } export const ADMIN_CURRENT_SHARED_CAPABILITY_SET = defineAdminSharedCapabilitySet({' + capability + '});\n'
    + 'export function adminSharedCapabilityKeys(capabilitySet) { return Object.keys(capabilitySet); }\n'
    + 'export const ADMIN_COLLECTION_SURFACE_ADOPTION = {surfaces:[{id:"phase03-consumer",pageSourceFiles:["' + consumer + '"],presentationSourceFiles:[],capabilityAudit:{}}]};';
  const guardSource = 'import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; const target="' + contract + '"; const value=readFileSync(target,"utf8"); assert.ok(value.includes("value: string")); const ownerPath="' + owner + '"; const cssPath="' + css + '";';
  const originals = new Map<string, string | Buffer>([
    [authority, authoritySource], [formAuthority, "export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST = [];"],
    [owner, 'export function Phase03Owner() { return "before"; }'],
    [consumer, 'import {Phase03Owner} from "../../../components/admin/ui/Phase03Owner"; export function Consumer() { return Phase03Owner(); }'],
    [contract, "export type RecordContract = { value: string };"], [entry, guardSource], [css, ".card { gap: 8px; }"],
    [browser, 'const marker="' + owner + '";'], [database, 'const marker="' + owner + '";'],
  ]);
  const scripts: Record<string, string> = { lint: repositoryScripts.lint, typecheck: repositoryScripts.typecheck,
    [checkName]: "node --experimental-strip-types " + entry,
    "qa:phase03-browser": "node " + browser + " --browser", "qa:phase03-database": "node " + database + " --database" };
  const tail = ["build", "verify:product-surface-identity-build", "verify:platform-contracts", "test:e2e:public"];
  for (const name of tail) scripts[name] = repositoryScripts[name];
  scripts["ci:check"] = ["lint", "typecheck", checkName, ...tail].map(name => "npm run " + name).join(" && ");
  type Impact = import("./lib/isolated-public-verification.mts").LocalVerificationImpact;
  type Actual = import("./lib/isolated-public-verification.mts").LocalVerificationInputs;
  const scenario = (edits: Array<[string, string | Buffer | undefined]>, baseline = originals) => {
    const current = new Map(baseline);
    for (const [file, source] of edits) if (source === undefined) current.delete(file); else current.set(file, source);
    const changes: import("./lib/isolated-public-verification.mts").LocalVerificationChange[] = edits.map(([file]) => ({
      file, beforeSha256: baseline.has(file) ? sha256(baseline.get(file)!) : null, afterSha256: current.has(file) ? sha256(current.get(file)!) : null,
      risk: file === contract || file === authority || file === formAuthority ? "C" : file.startsWith("scripts/") ? "E" : "A",
      owner: file, reviewedBy: "phase03-source-impact-controls", rationale: "Exact in-memory source control.", bounded: true, nonImportImpactReviewed: true,
      contracts: [contract], consumers: [consumer], checks: [checkName],
    }));
    const impact: Impact = { baselineHead: "a".repeat(40), finalHead: "b".repeat(40), sourceSha256: "c".repeat(64), changes };
    const actual: Actual = { baselineHead: impact.baselineHead, finalHead: impact.finalHead, sourceSha256: impact.sourceSha256,
      changes: changes.map(({ file, beforeSha256, afterSha256 }) => ({ file, beforeSha256, afterSha256 })),
      changeImpact: api.deriveLocalVerificationSourceImpact(scripts, changes, current, baseline) };
    return { impact, actual, current, baseline };
  };
  const maintain = (value: ReturnType<typeof scenario>, mode: "updated" | "existing_dynamic_axes" = "updated") => {
    value.impact.protectionMaintenance = value.actual.changeImpact!.obligations.map(obligation => ({ file: obligation.file, contract: obligation.contract,
      protectionFile: entry, check: checkName, beforeSha256: sha256(value.baseline.get(entry)!), afterSha256: sha256(value.current.get(entry)!),
      mode, reviewedBy: "phase03-contract-maintenance-review", rationale: "The source-bound changed assertion preserves this exact obligation.",
      assertionSha256: value.actual.changeImpact!.protections.find(protection => protection.file === entry && protection.check === checkName)?.assertionChanges
        .find(assertion => assertion.references.includes(obligation.file) && assertion.contracts.includes(obligation.contract))?.sha256 }));
  };
  const plan = (value: ReturnType<typeof scenario>) => api.planLocalVerification(scripts, value.impact, value.actual);
  check("source impact small owner edit preserves contracts and reports candidates without scheduling Browser/Database", () => {
    const value = scenario([[owner, 'export function Phase03Owner() { return "after"; }']]), result = plan(value);
    assert.equal(result.mode, "bounded"); assert.equal(result.changeImpact?.proofBoundary, "source_discovery_only");
    const row = result.changeImpact!.changes.find(row => row.file === owner)!;
    assert.ok(row.owners.includes("Phase03Owner") && row.capabilities.includes("widget"));
    assert.ok(row.consumers.includes(authority + "#phase03-consumer"));
    assert.ok(row.candidateChecks.includes("qa:phase03-browser") && row.candidateChecks.includes("qa:phase03-database"));
    assert.deepEqual(result.fast.prefix, ["lint", "typecheck", checkName]); assert.equal(result.fast.releaseEvidence, false);
    assert.deepEqual(result.changeImpact!.obligations, []);
    assert.deepEqual(result.changeImpact!.protections, [], "No unchanged-obligation edit should traverse protection assertions.");
    assert.throws(() => api.assertLocalVerificationRequest({ localVerification: value.impact, additionalSourceFiles: [] }, result.fast as unknown as ReturnType<typeof api.planLocalVerification>), /Fast report/u);
  });
  check("shared owner impact discovers every statically registered direct and indirect consumer without granting adoption PASS", () => {
    const second = "src/app/admin/phase03/Indirect.tsx", baseline = new Map(originals);
    baseline.set(second, 'import {Consumer} from "./Consumer"; export function Indirect() { return Consumer(); }');
    baseline.set(formAuthority, 'export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST=[{id:"second-consumer",sourceFiles:["' + second + '"],capabilityAudit:{}}];');
    const value = scenario([[owner, 'export function Phase03Owner() { return "shared after"; }']], baseline);
    assert.ok(value.actual.changeImpact!.changes[0].consumers.includes(formAuthority + "#second-consumer"));
    assert.equal(value.actual.changeImpact!.proofBoundary, "source_discovery_only");
  });
  check("every changed QA script or fixture selects existing quality guards without inventing executable coverage", () => {
    const extra = "scripts/fixtures/phase06-unreferenced.mts", baseline = new Map(originals);
    baseline.set(extra, "export const vector = 1;");
    const value = scenario([[extra, "export const vector = 2;"]], baseline);
    const qualityScripts = { ...scripts, "verify:executable-governance": repositoryScripts["verify:executable-governance"],
      "verify:verification-infrastructure": repositoryScripts["verify:verification-infrastructure"] };
    const analysis = api.deriveLocalVerificationSourceImpact(qualityScripts, value.actual.changes, value.current, value.baseline);
    const row = analysis.changes.find(row => row.file === extra)!;
    assert.ok(row.candidateChecks.includes("verify:executable-governance") && row.candidateChecks.includes("verify:verification-infrastructure"));
    assert.ok(row.unresolved.includes("no_positive_source_protection_relationship"), "A quality-guard selection does not manufacture coverage of an unreferenced fixture.");
  });
  check("QA assertion loss blocks automatic source correspondence and reviewed admission without dropping the original protection", () => {
    const value = scenario([[entry, guardSource.replace('assert.ok(value.includes("value: string"));', "")]]);
    const quality = value.actual.changeImpact!.qaQuality!.find(row => row.file === entry)!;
    assert.equal(quality.assertionsBefore, 1); assert.equal(quality.assertionsAfter, 0);
    assert.deepEqual(quality.failures, ["qa_assertion_count_decreased_requires_explicit_protection_review"]);
    const coherence = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
    assert.equal(coherence.status, "DRIFT"); assert.ok(coherence.diagnostics.some(message => message.includes("assertion preservation")));
    assert.throws(() => plan(value), /QA assertion coverage decreased/u);
  });
  check("source impact quality contract retains optional readonly counts and explicit failure dispositions", () => {
    const source = ts.createSourceFile("owner.mts", readSource("scripts/lib/isolated-public-verification.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const contract = source.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "LocalVerificationSourceImpact");
    assert.ok(contract && ts.isTypeLiteralNode(contract.type));
    const quality = contract.type.members.find((node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(source) === "qaQuality");
    assert.ok(quality?.questionToken && quality.type && ts.isTypeOperatorNode(quality.type) && quality.type.operator === ts.SyntaxKind.ReadonlyKeyword);
    assert.ok(ts.isArrayTypeNode(quality.type.type) && ts.isTypeLiteralNode(quality.type.type.elementType));
    const fields = quality.type.type.elementType.members.filter(ts.isPropertySignature);
    assert.deepEqual(fields.map(field => [field.name.getText(source), Boolean(field.questionToken), field.type?.getText(source)]),
      [["file", false, "string"], ["assertionsBefore", false, "number"], ["assertionsAfter", false, "number"], ["failures", false, "readonly string[]"],
        ["rawFailures", true, "readonly string[]"], ["qualifiedRelocation", true, "unknown"]]);
  });
  check("unrelated added assertions cannot conceal lost owner or assertion-operator coverage", () => {
    const before = new Map(originals);
    before.set(entry, 'import assert from "node:assert/strict"; function protectsOwner(){ assert.equal(actual,expected); }');
    for (const source of [
      'import assert from "node:assert/strict"; function protectsOwner(){ assert.ok(actual); }',
      'import assert from "node:assert/strict"; function protectsOwner(){} function unrelated(){ assert.equal(other,other); }',
    ]) {
      const value = scenario([[entry, source]], before), row = value.actual.changeImpact!.qaQuality!.find(row => row.file === entry)!;
      assert.equal(row.assertionsBefore, row.assertionsAfter);
      assert.deepEqual(row.failures, ["qa_assertion_owner_or_operator_coverage_decreased_requires_explicit_protection_review",
        ...(source.includes("assert.equal(other,other)") ? ["qa_new_tautological_assertion_cannot_replace_protection"] : [])]);
      assert.equal(api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 }).status, "DRIFT");
      assert.throws(() => plan(value), /QA assertion coverage decreased/u);
    }
  });
  check("equal assertion totals and comparison totals cannot authorize a new tautology or a reversed real predicate", () => {
    const baseline = new Map(originals), before = 'import assert from "node:assert/strict"; export function protects(actual){assert.equal(actual.enabled,true);}';
    baseline.set(entry, before);
    for (const [source, reason] of [
      [before.replace("assert.equal(actual.enabled,true)", "assert.equal(true,true)"), "qa_new_tautological_assertion_cannot_replace_protection"],
      [before.replace("assert.equal(actual.enabled,true)", "assert.notEqual(actual.enabled,true)"), "qa_predicate_operator_changed_requires_equivalence_proof"],
    ] as const) {
      const value = scenario([[entry, source]], baseline), row = value.actual.changeImpact!.qaQuality!.find(row => row.file === entry)!;
      assert.equal(row.assertionsBefore, row.assertionsAfter); assert.ok(row.failures.includes(reason));
      const executable = ts.transpileModule(source.replace('import assert from "node:assert/strict";', "").replace("export function", "function"),
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      const invalid = new Function("assert", executable + ";return protects;")(assert) as (actual: { enabled: boolean }) => void;
      assert.doesNotThrow(() => invalid({ enabled: false }), "The counterexample really lost its original rejection.");
      assert.equal(api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 }).status, "DRIFT");
      assert.throws(() => plan(value), /QA assertion coverage decreased/u);
    }
  });
  check("observed assertion contracts demand fresh proof after adapter-only, loader or foreign consumer changes without a count drop", () => {
    const provider = "scripts/fixtures/admin-form-section-contract.mts", caller = "scripts/verify-admin-form-system.mts";
    const baseline = new Map([[provider, readSource(provider)], [caller, readSource(caller)]]);
    assert.equal(api.localVerificationAssertionRelocationRequired({ baselineSources: baseline, currentSources: baseline }).required, false);
    for (const [file, after] of [
      [provider, baseline.get(provider)!.replace("Reflect.apply(method, target, args)", "Reflect.apply(method, target, [true])")],
      [provider, baseline.get(provider)!.replace("new Proxy(nativeAssert", "new UnobservedProxy(nativeAssert")],
      [caller, baseline.get(caller)!.replace('from "./fixtures/admin-form-section-contract.mts"', 'from "./fixtures/unobserved-contract.mts"')],
      [caller, baseline.get(caller)!.replace("loadUnifiedFormOwners(candidate, dependencies).AdminFormSection", "loadUnifiedFormOwners(source, dependencies).AdminFormSection")],
    ] as const) {
      assert.notEqual(after, baseline.get(file));
      const current = new Map(baseline); current.set(file, after);
      const demand = api.localVerificationAssertionRelocationRequired({ baselineSources: baseline, currentSources: current });
      assert.equal(demand.required, true); assert.ok(demand.files.includes(file));
    }
  });
  check("finite relocation proof accepts no-change discovery but refuses unsupported lost predicates and missing native observations", () => {
    const file = "scripts/proof-contract.mts", baseline = new Map([[file, 'import assert from "node:assert/strict";function protects(actual){assert.equal(actual.enabled,true);}']]);
    const unchanged = api.validateLocalVerificationAssertionRelocations({ baselineSources: baseline, currentSources: baseline, observations: [] });
    assert.equal(unchanged.status, "PASS"); assert.deepEqual(unchanged.relocations, []); assert.deepEqual(unchanged.providers, []);
    const current = new Map([[file, 'import assert from "node:assert/strict";function protects(actual){}']]);
    const missing = api.validateLocalVerificationAssertionRelocations({ baselineSources: baseline, currentSources: current, observations: [] });
    assert.equal(missing.status, "BLOCKED"); assert.equal(missing.failures.length, 1); assert.deepEqual(missing.relocations, []);
  });
  check("preflight emits selected and not-selected source-bound rows without granting unexecuted behavior PASS", () => {
    const value = scenario([[owner, 'export function Phase03Owner() { return "preflight"; }']]);
    const coherence = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
    assert.equal(coherence.behavioralPass, false); assert.equal(coherence.releaseEvidence, false);
    for (const row of coherence.preflight) {
      assert.equal(row.sourceSha256, value.actual.changeImpact!.sourceSha256); assert.equal(row.durationMs, 0);
      assert.equal(row.result, "NOT RUN"); assert.equal(row.evidence, null); assert.ok(row.reason && row.command);
      assert.ok(Array.isArray(row.owner) && Array.isArray(row.contract));
    }
    assert.ok(coherence.preflight.find(row => row.check === "lint")?.selected);
    assert.ok(coherence.preflight.find(row => row.check === "typecheck")?.selected);
    const unrelated = api.deriveLocalVerificationSourceCoherence({ ...scripts, "verify:unrelated-preflight": "node scripts/unrelated.mjs" },
      { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
    assert.equal(unrelated.preflight.find(row => row.check === "verify:unrelated-preflight")?.selected, false);
  });
  check("unknown generated adoption stays explicit and widens only the affected shared owner", () => {
    const baseline = new Map(originals);
    baseline.set(formAuthority, 'export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST = values.map(value => ({id:`generated-${value}`,sourceFiles:[value],capabilityAudit:{}}));');
    const shared = scenario([[owner, 'export function Phase03Owner() { return "shared"; }']], baseline);
    assert.equal(plan(shared).mode, "full"); assert.ok(shared.actual.changeImpact!.changes[0].unresolved.some(value => value.includes("generated_or_dynamic_consumer")));
    const small = scenario([[css, ".card { gap: 12px; }"]], baseline);
    assert.equal(plan(small).mode, "bounded"); assert.deepEqual(small.actual.changeImpact!.obligations, []);
  });
  check("contract drift without maintained protection fails with file owner and contract diagnostic", () => {
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"]]);
    assert.throws(() => plan(value), error => error instanceof Error && error.message.includes(contract) && error.message.includes("owner=") && error.message.includes("#RecordContract"));
  });
  check("exact-byte contract maintenance requires a newly changed assertion linked to that contract", () => {
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, guardSource.replace('"value: string"', '"revision: number"')]]);
    maintain(value); const result = plan(value); assert.equal(result.mode, "full"); assert.equal(result.risk, "E");
    const review = value.impact.protectionMaintenance![0];
    value.impact.protectionMaintenance = [{ ...review, afterSha256: "f".repeat(64) }]; assert.throws(() => plan(value), /stale protection current bytes/u);
  });
  check("actual maintenance owner validates exact reviewed protection and rejects missing stale duplicate or unselected reviews", () => {
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"],
      [entry, guardSource.replace('"value: string"', '"revision: number"')]]);
    maintain(value);
    assert.doesNotThrow(() => api.assertLocalVerificationProtectionMaintenance(value.impact, value.actual));
    const review = value.impact.protectionMaintenance![0]!;
    assert.ok(review.beforeSha256);
    assert.notEqual(review.beforeSha256, review.afterSha256);
    assert.notEqual(review.assertionSha256, review.afterSha256);
    const rejectedReviews = [
      [],
      [{ ...review, beforeSha256: review.afterSha256 }],
      [{ ...review, afterSha256: review.beforeSha256 }],
      [{ ...review, assertionSha256: review.afterSha256 }],
      [review, review],
    ];
    for (const protectionMaintenance of rejectedReviews) {
      assert.throws(() => api.assertLocalVerificationProtectionMaintenance({ ...value.impact, protectionMaintenance }, value.actual),
        /missing unique reviewed protection maintenance|stale protection baseline bytes|stale protection current bytes|real verification-source change/u);
    }
    const unselected = { ...value.impact, changes: value.impact.changes.map(change => ({ ...change, checks: [] })) };
    assert.throws(() => api.assertLocalVerificationProtectionMaintenance(unselected, value.actual), /protection check is not selected fresh/u);
    const noObligations = scenario([[owner, 'export function Phase03Owner() { return "changed body only"; }']]);
    assert.deepEqual(noObligations.actual.changeImpact!.obligations, []);
    assert.doesNotThrow(() => api.assertLocalVerificationProtectionMaintenance(noObligations.impact, noObligations.actual));
    assert.throws(() => api.assertLocalVerificationProtectionMaintenance({ ...noObligations.impact, protectionMaintenance: [review] }, noObligations.actual),
      /Unexpected protection maintenance/u);
  });
  check("source-confirmed explicit contract changes cannot be mislabeled A to avoid the C full-risk floor", () => {
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, guardSource.replace('"value: string"', '"revision: number"')]]);
    value.impact.changes = value.impact.changes.map(row => ({ ...row, risk: "A" }));
    value.actual.verificationCoverage = [{ file: entry, checks: [checkName] }]; maintain(value);
    const result = plan(value); assert.equal(result.risk, "C"); assert.equal(result.mode, "full");
  });
  check("repeated canonical aliases share only identical per-entry protection metadata within the same exact source snapshot", () => {
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, guardSource.replace('"value: string"', '"revision: number"')]]);
    const commands = { ...scripts, "verify:phase03-owner-wrapper": "npm run " + checkName, "verify:phase03-owner-alias": scripts[checkName] };
    const analysis = api.deriveLocalVerificationSourceImpact(commands, value.actual.changes, value.current, value.baseline);
    const rows = analysis.protections.filter(protection => protection.file === entry);
    assert.equal(rows.length, 3); assert.ok(rows[0].assertionChanges.length > 0);
    for (const row of rows.slice(1)) {
      assert.equal(row.afterSha256, rows[0].afterSha256); assert.equal(row.beforeSha256, rows[0].beforeSha256);
      assert.equal(row.assertionChanges, rows[0].assertionChanges, "An alias must reuse the exact per-entry immutable assertion projection.");
      assert.deepEqual(row.references, rows[0].references);
    }
    const changed = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, guardSource.replace('"value: string"', '"revision: string"')]]);
    const next = api.deriveLocalVerificationSourceImpact(commands, changed.actual.changes, changed.current, changed.baseline).protections.find(protection => protection.file === entry)!;
    assert.notEqual(next.afterSha256, rows[0].afterSha256); assert.notEqual(next.assertionChanges, rows[0].assertionChanges);
    assert.notDeepEqual(next.assertionChanges.map(assertion => assertion.sha256), rows[0].assertionChanges.map(assertion => assertion.sha256));
  });
  for (const [label, nextGuard] of [["logging-only", guardSource + '\nconsole.log("changed");'], ["unrelated assertion", guardSource + "\nassert.equal(1, 2);"], ["comments-only", guardSource + "\n// contract review"],
    ["diagnostic-only", guardSource.replace('assert.ok(value.includes("value: string"))', 'assert.ok(value.includes("value: string"),"new message")')]] as const)
    check("contract maintenance rejects " + label + " changes as replacement protection", () => {
      const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, nextGuard]]);
      maintain(value); assert.throws(() => plan(value), /real verification-source change/u);
    });
  check("changed local expected vectors preserve assertion identity and still require the exact reviewed protection fingerprint", () => {
    const baseline = new Map(originals), vectorGuard = guardSource.replace('assert.ok(value.includes("value: string"))', 'const expected="value: string"; assert.ok(value.includes(expected))');
    baseline.set(entry, vectorGuard);
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, vectorGuard.replace('expected="value: string"', 'expected="revision: number"')]], baseline);
    maintain(value); assert.equal(plan(value).mode, "full");
    value.impact.protectionMaintenance = value.impact.protectionMaintenance!.map(review => ({ ...review, assertionSha256: "f".repeat(64) }));
    assert.throws(() => plan(value), /real verification-source change/u);
  });
  check("contract-specific assertion projection rejects a changed assertion about an unrelated export in the same file", () => {
    const baseline = new Map(originals), both = "export type RecordContract = { value: string }; export type OtherContract = { other: number };";
    const otherGuard = guardSource.replace('"value: string"', '"other:number"');
    baseline.set(contract, both); baseline.set(entry, otherGuard);
    const value = scenario([[contract, both.replace("value: string", "value: string; revision: number")],
      [entry, otherGuard.replace('"other:number"', '"other: number"')]], baseline);
    assert.ok(value.actual.changeImpact!.protections[0].assertionChanges.some(assertion => assertion.references.includes(contract)), "Preserve the demonstrated same-file relationship.");
    assert.ok(value.actual.changeImpact!.protections[0].assertionChanges.every(assertion => !assertion.contracts.includes(contract + "#RecordContract")));
    maintain(value); assert.throws(() => plan(value), /real verification-source change/u);
    const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
    assert.equal(result.status, "DRIFT"); assert.ok(result.diagnostics.some(message => message.includes(contract + "#RecordContract")));
  });
  for (const [label, nextGuard] of [
    ["whole-file length", guardSource + "\nassert.equal(value.length,1234);"],
    ["unchanged export name", guardSource + '\nassert.ok(value.includes("RecordContract"));'],
    ["diagnostic symbol mention", guardSource.replace('assert.ok(value.includes("value: string"))', 'assert.ok(value.includes("value: string"),"RecordContract revision: number")')],
    ["unrelated local expected vector", guardSource + '\nconst otherExpected="other: number"; assert.ok(value.includes(otherExpected));'],
  ] as const) check("contract specificity rejects " + label + " as updated protection", () => {
    const baseline = new Map(originals); baseline.set(contract, "export type RecordContract = { value: string }; export type OtherContract = { other: number };");
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number }; export type OtherContract = { other: number };"], [entry, nextGuard]], baseline);
    maintain(value); assert.throws(() => plan(value), /real verification-source change/u);
    assert.equal(api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 }).status, "DRIFT");
  });
  check("new runtime export name alone cannot satisfy applicable contract protection", () => {
    const nextContract = 'export type RecordContract = { value: string }; export function saveRecord(value: string) { return value; }';
    const value = scenario([[contract, nextContract], [entry, guardSource + '\nassert.ok(value.includes("saveRecord"));']]);
    assert.equal(value.actual.changeImpact!.obligations[0]!.contract, contract + "#saveRecord");
    const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
    assert.equal(result.status, "DRIFT", "Availability of a newly named export is not applicable signature or behavioral protection.");
    maintain(value);
    assert.throws(() => plan(value), /real verification-source change/u);
  });
  check("new runtime signature and aliased invocation retain applicable source protection", () => {
    const nextContract = 'export type RecordContract = { value: string }; export function saveRecord(value: string) { return value; }';
    for (const nextGuard of [
      guardSource + '\nassert.ok(value.includes("export function saveRecord(value: string)"));',
      'import assert from "node:assert/strict"; import {saveRecord as actualSave} from "../' + contract
        + '"; const expected="saved"; assert.equal(actualSave(expected),expected);',
    ]) {
      const value = scenario([[contract, nextContract], [entry, nextGuard]]);
      maintain(value);
      assert.doesNotThrow(() => api.assertLocalVerificationProtectionMaintenance(value.impact, value.actual));
      assert.equal(plan(value).mode, "full");
      const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
      assert.equal(result.status, "PASS_AUTOMATIC_SOURCE_PROTECTION");
      assert.equal(result.behavioralPass, false, "Source correspondence must not claim runtime execution of the example export.");
    }
  });
  check("each changed export requires its own applicable assertion rather than borrowing a sibling contract", () => {
    const baseline = new Map(originals), before = "export type RecordContract = { value: string }; export type OtherContract = { other: number };";
    baseline.set(contract, before);
    const next = "export type RecordContract = { value: string; revision: number }; export type OtherContract = { other: number; enabled: boolean };";
    const firstGuard = guardSource.replace('"value: string"', '"revision: number"');
    const partial = scenario([[contract, next], [entry, firstGuard]], baseline);
    maintain(partial); assert.throws(() => plan(partial), /real verification-source change/u);
    const rejected = api.deriveLocalVerificationSourceCoherence(scripts, { ...partial.actual, sourceSha256: partial.actual.changeImpact!.sourceSha256 });
    assert.equal(rejected.status, "DRIFT"); assert.equal(rejected.fast.correspondence.find(row => row.contract.endsWith("#RecordContract"))?.protected, true);
    assert.equal(rejected.fast.correspondence.find(row => row.contract.endsWith("#OtherContract"))?.protected, false);
    const complete = scenario([[contract, next], [entry, firstGuard + '\nassert.ok(value.includes("enabled: boolean"));']], baseline);
    maintain(complete); assert.equal(plan(complete).mode, "full");
    const accepted = api.deriveLocalVerificationSourceCoherence(scripts, { ...complete.actual, sourceSha256: complete.actual.changeImpact!.sourceSha256 });
    assert.equal(accepted.status, "PASS_AUTOMATIC_SOURCE_PROTECTION"); assert.equal(accepted.behavioralPass, false);
  });
  check("changed runtime export invocation through an imported alias binds its exact contract without generating expectations", () => {
    const baseline = new Map(originals), oldGuard = 'import assert from "node:assert/strict"; import {saveRecord as actualSave} from "../' + contract + '"; assert.equal(actualSave("before"), "before");';
    baseline.set(contract, "export function saveRecord(value: string) { return value; }"); baseline.set(entry, oldGuard);
    const value = scenario([[contract, "export function saveRecord(value: string, confirmed: boolean) { return confirmed ? value : undefined; }"],
      [entry, oldGuard.replace('actualSave("before"), "before"', 'actualSave("after", true), "after"')]], baseline);
    const assertion = value.actual.changeImpact!.protections[0].assertionChanges.find(row => row.contracts.includes(contract + "#saveRecord"));
    assert.ok(assertion); maintain(value); assert.equal(plan(value).mode, "full");
  });
  check("a changed data export binds only the asserted imported value and cannot borrow a sibling numeric assertion", () => {
    const baseline = new Map(originals), oldGuard = 'import assert from "node:assert/strict"; import {SAVE_LIMIT as actualLimit,OTHER_LIMIT} from "../' + contract + '"; assert.equal(actualLimit,1); assert.equal(OTHER_LIMIT,2);';
    baseline.set(contract, "export const SAVE_LIMIT=1; export const OTHER_LIMIT=2;"); baseline.set(entry, oldGuard);
    const valid = scenario([[contract, "export const SAVE_LIMIT=3; export const OTHER_LIMIT=2;"], [entry, oldGuard.replace("actualLimit,1", "actualLimit,3")]], baseline);
    maintain(valid); assert.equal(plan(valid).mode, "full");
    const unrelated = scenario([[contract, "export const SAVE_LIMIT=3; export const OTHER_LIMIT=2;"], [entry, oldGuard.replace("OTHER_LIMIT,2", "OTHER_LIMIT,2+0")]], baseline);
    maintain(unrelated); assert.throws(() => plan(unrelated), /real verification-source change/u);
    assert.equal(api.deriveLocalVerificationSourceCoherence(scripts, { ...unrelated.actual, sourceSha256: unrelated.actual.changeImpact!.sourceSha256 }).status, "DRIFT");
  });
  check("repeated local assertion names resolve only their nearest lexical contract source", () => {
    const baseline = new Map(originals), both = "export type RecordContract = { value: string }; export type OtherContract = { other: number };";
    const oldGuard = 'import assert from "node:assert/strict"; import {readFileSync} from "node:fs"; '
      + 'function first(){const value=readFileSync("' + contract + '","utf8"); assert.ok(value.includes("value: string"));} '
      + 'function second(){const value="local unrelated value"; assert.equal(value,"local unrelated value");}';
    baseline.set(contract, both); baseline.set(entry, oldGuard);
    const valid = scenario([[contract, both.replace("value: string", "value: string; revision: number")], [entry, oldGuard.replace('"value: string"', '"revision: number"')]], baseline);
    maintain(valid); assert.equal(plan(valid).mode, "full");
    const unrelated = scenario([[contract, both.replace("value: string", "value: string; revision: number")], [entry, oldGuard.replace('assert.equal(value,"local unrelated value")', 'assert.equal(value,"revision: number")')]], baseline);
    maintain(unrelated); assert.throws(() => plan(unrelated), /real verification-source change/u);
  });
  check("typed owner API parameters stay scoped and reject a foreign same-named runtime export", () => {
    const baseline = new Map(originals), foreign = "src/lib/admin/phase03/foreign.ts";
    const oldGuard = 'import assert from "node:assert/strict"; import {saveRecord} from "../' + contract + '"; import {saveRecord as foreignSave} from "../' + foreign
      + '"; function ownerCase(api: Pick<typeof import("../' + contract + '"),"saveRecord">){const actual=api.saveRecord("before"); assert.equal(actual,"before");} '
      + 'function foreignCase(api: Pick<typeof import("../' + foreign + '"),"saveRecord">){const actual=api.saveRecord("other"); assert.equal(actual,"other");} ownerCase({saveRecord}); foreignCase({saveRecord:foreignSave});';
    baseline.set(contract, "export function saveRecord(value: string) { return value; }"); baseline.set(foreign, "export function saveRecord(value: string) { return value; }"); baseline.set(entry, oldGuard);
    const next = "export function saveRecord(value: string, confirmed: boolean) { return confirmed ? value : undefined; }";
    const valid = scenario([[contract, next], [entry, oldGuard.replace('api.saveRecord("before")', 'api.saveRecord("before",true)')]], baseline);
    maintain(valid); assert.equal(plan(valid).mode, "full");
    const unrelated = scenario([[contract, next], [entry, oldGuard.replace('api.saveRecord("other")', 'api.saveRecord("other",true)')]], baseline);
    maintain(unrelated); assert.throws(() => plan(unrelated), /real verification-source change/u);
  });
  check("type-only callback contracts bind actual changed imported members without borrowing sibling names", () => {
    const oldGuard = guardSource + '\nconst read=(value:import("../' + contract
      + '").RecordContract)=>value.value; assert.equal(read({value:"before",stop:()=>undefined}),"before");';
    const signalGuard = guardSource + '\nconst signal=new AbortController().signal; ';
    for (const declaration of [
      'export type RecordContract = { value: string; stop: () => void };',
      'export interface RecordContract { value: string; stop(): void }',
    ]) {
      const baseline = new Map(originals), sibling = ' export type OtherContract = { signal?: AbortSignal; stop: () => void };';
      baseline.set(contract, declaration + sibling); baseline.set(entry, oldGuard);
      const next = declaration.replace("value: string;", "value: string; signal?: AbortSignal;") + sibling;
      for (const nextGuard of [
        signalGuard + 'const read=(value:import("../' + contract + '").RecordContract)=>value.signal; assert.equal(read({value:"after",signal,stop:()=>undefined}),signal);',
        signalGuard + 'const read=(value:Pick<import("../' + contract + '").RecordContract,"signal">)=>value.signal; assert.equal(read({signal}),signal);',
        signalGuard + 'const input:Pick<import("../' + contract + '").RecordContract,"signal">={signal}; assert.equal(input.signal,signal);',
      ]) {
        const valid = scenario([[contract, next], [entry, nextGuard]], baseline);
        const binding = valid.actual.changeImpact!.protections[0].assertionChanges.find(row => row.contracts.includes(contract + "#RecordContract"));
        assert.ok(binding, "The changed imported member is asserted through its exact lexical type.");
        maintain(valid); assert.equal(plan(valid).mode, "full");
        const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...valid.actual, sourceSha256: valid.actual.changeImpact!.sourceSha256 });
        assert.equal(result.status, "PASS_AUTOMATIC_SOURCE_PROTECTION"); assert.equal(result.behavioralPass, false);
      }
    }
  });
  check("new type and interface export names alone cannot satisfy changed member protection", () => {
    for (const added of ['export type NewCancellationContract={signal?:AbortSignal;onEnd:()=>void};',
      'export interface NewCancellationContract {signal?:AbortSignal;onEnd():void}']) {
      const value = scenario([[contract, 'export type RecordContract={value:string}; ' + added],
        [entry, guardSource + '\nassert.ok(value.includes("NewCancellationContract"));']]);
      const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
      assert.equal(result.status, "DRIFT"); assert.equal(result.fast.correspondence.find(row => row.contract.endsWith("#NewCancellationContract"))?.protected, false);
      maintain(value); assert.throws(() => plan(value), /real verification-source change/u);
    }
  });
  check("typed member correspondence rejects unchanged members foreign types shadowed names and nested wrappers", () => {
    const baseline = new Map(originals), declaration = 'export type RecordContract = { value: string; stop: () => void };',
      sibling = ' export type OtherContract = { signal?: AbortSignal; stop: () => void };';
    baseline.set(contract, declaration + sibling);
    baseline.set("src/lib/admin/phase03/foreign-pick.ts", 'export default interface ForeignPick<T,K> { signal: AbortSignal }');
    const prefix = guardSource + '\nconst signal=new AbortController().signal; ';
    for (const [label, body] of [
      ["unchanged member", 'const read=(value:import("../' + contract + '").RecordContract)=>value.value; assert.equal(read({value:"local",stop:()=>undefined}),"local");'],
      ["foreign sibling type", 'const read=(value:import("../' + contract + '").OtherContract)=>value.signal; assert.equal(read({signal,stop:()=>undefined}),signal);'],
      ["type name only", 'const input=undefined as import("../' + contract + '").RecordContract|undefined; assert.equal(typeof input,"undefined");'],
      ["closer untyped shadow", 'function read(value:import("../' + contract + '").RecordContract){{const value={signal}; assert.equal(value.signal,signal);}} read({value:"local",stop:()=>undefined});'],
      ["closer foreign typed shadow", 'function read(value:import("../' + contract + '").RecordContract){{const value:import("../' + contract + '").OtherContract={signal,stop:()=>undefined}; assert.equal(value.signal,signal);}} read({value:"local",stop:()=>undefined});'],
      ["nested imported object", 'const read=(value:{nested:import("../' + contract + '").RecordContract;signal:AbortSignal})=>value.signal; assert.equal(read({nested:{value:"local",stop:()=>undefined},signal}),signal);'],
      ["unselected Pick member", 'const read=(value:Pick<import("../' + contract + '").RecordContract,"value">)=>value.signal; assert.equal(read({value:"local"}),signal);'],
      ["shadowed Pick utility", 'type Pick<T,K>={signal:AbortSignal}; const read=(value:Pick<import("../' + contract + '").RecordContract,"signal">)=>value.signal; assert.equal(read({signal}),signal);'],
      ["default imported Pick utility", 'import type Pick from "../src/lib/admin/phase03/foreign-pick"; const read=(value:Pick<import("../' + contract + '").RecordContract,"signal">)=>value.signal; assert.equal(read({signal}),signal);'],
    ]) {
      const value = scenario([[contract, declaration.replace("value: string;", "value: string; signal?: AbortSignal;") + sibling], [entry, prefix + body]], baseline);
      assert.ok(value.actual.changeImpact!.protections.every(protection => protection.assertionChanges.every(assertion => !assertion.contracts.includes(contract + "#RecordContract"))), label);
      maintain(value); assert.throws(() => plan(value), /real verification-source change/u, label);
      const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
      assert.equal(result.status, "DRIFT", label); assert.equal(result.behavioralPass, false);
    }
  });
  check("explicit removed-field rejection remains valid source correspondence and cannot establish behavioral PASS", () => {
    const baseline = new Map(originals); baseline.set(contract, "export type RecordContract = { value: string; obsolete: number };");
    const value = scenario([[contract, "export type RecordContract = { value: string };"], [entry, guardSource + '\nassert.equal(value.includes("obsolete: number"),false);']], baseline);
    maintain(value); assert.equal(plan(value).mode, "full");
    const result = api.deriveLocalVerificationSourceCoherence(scripts, { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
    assert.equal(result.status, "PASS_AUTOMATIC_SOURCE_PROTECTION"); assert.equal(result.behavioralPass, false);
  });
  check("the maintained impact type carries exact assertion contract correspondence beside file references", () => {
    const source = readSource("scripts/lib/isolated-public-verification.mts");
    assert.ok(source.includes("assertionChanges: readonly { sha256: string; references: readonly string[]; contracts: readonly string[] }[]"));
  });
  check("reviewed QA input and maintenance records retain exact identity and source-discovery boundaries", () => {
    const tree = ts.createSourceFile("owner.mts", readSource("scripts/lib/isolated-public-verification.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const alias = (name: string) => {
      const declarations = tree.statements.filter((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === name);
      assert.equal(declarations.length, 1); return declarations[0].type;
    };
    const inputs = alias("LocalVerificationInputs"); assert.ok(ts.isTypeLiteralNode(inputs));
    const members = inputs.members.filter(ts.isPropertySignature);
    const property = (name: string) => { const found = members.filter(node => node.name.getText(tree) === name); assert.equal(found.length, 1); return found[0]; };
    assert.deepEqual(["baselineHead", "finalHead", "sourceSha256"].map(name => { const node = property(name); return [name, Boolean(node.questionToken), node.type?.kind]; }),
      [["baselineHead", false, ts.SyntaxKind.StringKeyword], ["finalHead", false, ts.SyntaxKind.StringKeyword], ["sourceSha256", false, ts.SyntaxKind.StringKeyword]]);
    const discovery = property("changeImpact");
    assert.ok(discovery.questionToken && discovery.type && ts.isTypeReferenceNode(discovery.type) && discovery.type.typeName.getText(tree) === "LocalVerificationSourceImpact");
    const admission = property("admissionQualification");
    assert.ok(admission.questionToken && admission.type && ts.isTypeReferenceNode(admission.type) && admission.type.typeName.getText(tree) === "LocalVerificationAdmissionQualification");
    const impact = alias("LocalVerificationImpact"); assert.ok(ts.isIntersectionTypeNode(impact));
    const omitted = impact.types.find(ts.isTypeReferenceNode), reviewed = impact.types.find(ts.isTypeLiteralNode);
    assert.ok(omitted && omitted.typeName.getText(tree) === "Omit" && omitted.typeArguments?.length === 2
      && ts.isTypeReferenceNode(omitted.typeArguments[0]) && omitted.typeArguments[0].typeName.getText(tree) === "LocalVerificationInputs"
      && ts.isUnionTypeNode(omitted.typeArguments[1]));
    assert.deepEqual(omitted.typeArguments[1].types.map(node => { assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)); return node.literal.text; }).sort(),
      ["changes", "verificationCoverage", "changeImpact", "admissionQualification"].sort());
    const changes = reviewed?.members.filter(ts.isPropertySignature).find(node => node.name.getText(tree) === "changes");
    assert.ok(changes && !changes.questionToken && changes.type && ts.isTypeOperatorNode(changes.type) && changes.type.operator === ts.SyntaxKind.ReadonlyKeyword
      && ts.isArrayTypeNode(changes.type.type) && ts.isTypeReferenceNode(changes.type.type.elementType) && changes.type.type.elementType.typeName.getText(tree) === "LocalVerificationChange");
    const maintenance = alias("LocalVerificationProtectionMaintenance"); assert.ok(ts.isTypeLiteralNode(maintenance));
    const identity = maintenance.members.filter(ts.isPropertySignature).filter(node => ["file", "contract", "protectionFile", "check", "beforeSha256", "afterSha256"].includes(node.name.getText(tree)));
    assert.deepEqual(identity.map(node => [node.name.getText(tree), Boolean(node.questionToken), node.type?.getText(tree)]),
      [["file", false, "string"], ["contract", false, "string"], ["protectionFile", false, "string"], ["check", false, "string"], ["beforeSha256", false, "string | null"], ["afterSha256", false, "string"]]);
  });
  check("contract evidence data and approved presentation values remain semantic obligations", () => {
    const baseline = new Map(originals); baseline.set(contract, 'export const contractData={evidence:"required"};');
    assert.equal(scenario([[contract, 'export const contractData={evidence:"different"};']], baseline).actual.changeImpact!.obligations.length, 1);
    const presentation = 'export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST=[{id:"form",sourceFiles:["' + consumer + '"],capabilityAudit:{},presentationContract:{requirements:[{target:"grid",requirement:"required",presentation:{port:"columns",value:"2"},evidence:["required-proof"]}]}}];';
    baseline.set(formAuthority, presentation);
    assert.notEqual(api.localVerificationPresentationSource(formAuthority, presentation),
      api.localVerificationPresentationSource(formAuthority, presentation.replace('value:"2"', 'value:"3"')),
      "Approved presentation-contract values remain authoritative rather than literal class spacing.");
    const changed = scenario([[formAuthority, presentation.replace('value:"2"', 'value:"3"')]], baseline);
    assert.throws(() => plan(changed), /manifest-obligations/u);
    assert.equal(scenario([[formAuthority, presentation.replace('required-proof', 'different-proof')]], baseline).actual.changeImpact!.obligations.length, 1);
  });
  check("valid TypeScript angle assertions and generic arrows parse while malformed contracts fail closed", () => {
    assert.ok(api.localVerificationSemanticSource("contract.mts", "export const cast = <string>value; export const identity = <T>(value:T) => value;").includes("identity"));
    assert.throws(() => api.localVerificationSemanticSource("contract.ts", "export type Broken = {"), /malformed/u);
    const value = scenario([[contract, "  // formatting\nexport type RecordContract = { value: string };\n"]]);
    assert.deepEqual(value.actual.changeImpact!.obligations, []);
    const baseline = new Map(originals); baseline.set(owner, 'export const Owner = (value: string): string => value;');
    const signature = scenario([[owner, 'export const Owner = (value: number): string => String(value);']], baseline);
    assert.equal(signature.actual.changeImpact!.obligations[0].contract, owner + "#Owner");
    assert.throws(() => plan(signature), /Contract drift/u);
  });
  check("binary source bytes stay exact and opaque asset impact is unresolved instead of decoded or silently bounded", () => {
    const asset = "public/phase03.png", baseline = new Map(originals); baseline.set(asset, Buffer.from([0, 255, 1]));
    const value = scenario([[asset, Buffer.from([0, 254, 1])]], baseline);
    assert.deepEqual(value.actual.changeImpact!.obligations, []); assert.equal(plan(value).mode, "full");
    value.current.delete(asset);
    assert.throws(() => api.deriveLocalVerificationSourceImpact(scripts, value.actual.changes, value.current, baseline), /current bytes differ/u);
  });
  check("added and deleted contract boundaries cannot borrow missing or stale source bytes", () => {
    const added = "src/lib/admin/phase03/new-contract.ts", value = scenario([[added, "export type Added = {id: string};"]]);
    assert.equal(value.actual.changeImpact!.obligations[0].before, null); assert.throws(() => plan(value), /Contract drift/u);
    const removed = scenario([[contract, undefined]]); assert.equal(removed.actual.changeImpact!.obligations[0].after, null);
    const stale = new Map(originals); stale.set(contract, "export type RecordContract = { value: number };");
    assert.throws(() => api.deriveLocalVerificationSourceImpact(scripts, removed.actual.changes, removed.current, stale), /baseline bytes differ/u);
  });
  check("existing dynamic axes require actual Object.keys derivation and unchanged source-bound audit protection", () => {
    const dynamicGuard = 'import assert from "node:assert/strict"; import {ADMIN_CURRENT_SHARED_CAPABILITY_SET,adminSharedCapabilityKeys} from "../src/lib/admin/interaction-system/adoption-manifest.ts";\n'
      + 'const currentSharedCapabilityKeys=adminSharedCapabilityKeys(ADMIN_CURRENT_SHARED_CAPABILITY_SET); const decisions={}; const failures=[];\n'
      + 'if(Object.keys(decisions).length!==currentSharedCapabilityKeys.length) failures.push("unclassified_capability_axis");\n'
      + 'for(const capability of currentSharedCapabilityKeys) { assert.ok(ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability]); assert.ok(decisions[capability]); }';
    const baseline = new Map(originals); baseline.set(entry, dynamicGuard);
    const nextAuthority = authoritySource.replace(capability, capability + ',other:{owner:"Other",sourceFiles:["src/other.ts"],executableBindings:[]}');
    const value = scenario([[authority, nextAuthority]], baseline); maintain(value, "existing_dynamic_axes");
    assert.equal(value.actual.changeImpact!.obligations[0].addedCapabilityAxis, true); assert.equal(plan(value).mode, "full");
    const hardcoded = new Map(baseline); hardcoded.set(entry, dynamicGuard.replace("of currentSharedCapabilityKeys", 'of ["widget"]'));
    const invalid = scenario([[authority, nextAuthority]], hardcoded); maintain(invalid, "existing_dynamic_axes");
    assert.throws(() => plan(invalid), /proven existing dynamic/u);
    const modified = scenario([[authority, authoritySource.replace('owner: "Phase03Owner"', 'owner: "ChangedOwner"')]], baseline); maintain(modified, "existing_dynamic_axes");
    assert.throws(() => plan(modified), /proven existing dynamic/u);
  });
  check("additional checks prune only an ordered exact canonical command and argv chain already inside a full-prefix owner", () => {
    const value = scenario([[owner, 'export function Phase03Owner() { return "dedupe"; }']]);
    const changes = value.impact.changes.map(row => ({ ...row, risk: "C" as const, checks: ["verify:phase03-child", "verify:phase03-direct-alias", "verify:phase03-different-mode", "verify:phase03-reversed", "verify:phase03-repeated", "verify:phase03-unsupported"] }));
    const commandA = "node scripts/phase03-a.mjs --mode=one", commandB = "node scripts/phase03-b.mjs";
    const commands = { ...scripts, [checkName]: "npm run verify:phase03-child && " + commandB,
      "verify:phase03-child": commandA, "verify:phase03-direct-alias": commandA, "verify:phase03-different-mode": commandA.replace("one", "two"),
      "verify:phase03-reversed": commandB + " && " + commandA, "verify:phase03-repeated": commandA + " && " + commandA,
      "verify:phase03-unsupported": "node scripts/phase03-a.mjs --mode=one; echo unsupported" };
    const result = api.planLocalVerification(commands, { ...value.impact, changes }, { ...value.actual, changeImpact: undefined });
    assert.deepEqual(result.redundantAdditionalChecks, ["verify:phase03-child"]);
    assert.equal(result.prefix.includes("verify:phase03-child"), false);
    for (const name of changes[0].checks.slice(1)) assert.ok(result.prefix.includes(name));
    assert.deepEqual(result.prefix.slice(0, 3), ["lint", "typecheck", checkName]);
    assert.equal(api.localVerificationCommandSteps(commands, "verify:phase03-unsupported"), undefined);
  });
  check("actual admission reader derives from controlled Git and raw source bytes then reuses only an identical immutable snapshot", () => {
    const value = scenario([[owner, 'export function Phase03Owner() { return "reader"; }']]);
    value.current.set("package.json", JSON.stringify({ scripts })); value.baseline.set("package.json", JSON.stringify({ scripts }));
    for (const file of ["package-lock.json", "tsconfig.json"]) { value.current.set(file, "{}"); value.baseline.set(file, "{}"); }
    const manifest = [...value.current].map(([file, source]) => ({ file, sha256: sha256(source) })).sort((a, b) => a.file.localeCompare(b.file));
    value.impact.sourceSha256 = sha256(JSON.stringify(manifest));
    const ownerSource = readSource("scripts/lib/isolated-public-verification.mts"), tree = ts.createSourceFile("owner.mts", ownerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "readLocalVerificationInputs"); assert.ok(declaration);
    const inspector = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "inspectLocalVerificationChangeImpact"); assert.ok(inspector);
    let discoveries = 0;
    const inspectorEnvironments: Array<Readonly<Record<string, string | undefined>>> = [];
    const git = (_command: string, args: string[], options?: { env?: Readonly<Record<string, string | undefined>> }) => {
      if (options?.env?.NODE_ENV === "test") inspectorEnvironments.push(options.env);
      if (args[0] === "rev-parse") return Buffer.from(args.includes("--verify") ? value.impact.baselineHead : value.impact.finalHead);
      if (args[0] === "merge-base") return Buffer.alloc(0);
      if (args[0] === "ls-tree") return Buffer.from([...value.baseline.keys()].join("\0") + "\0");
      if (args[0] === "ls-files") return Buffer.from([...value.current.keys()].join("\0") + "\0");
      if (args[0] === "diff") return Buffer.from(value.actual.changes.map(row => row.file).join("\0") + "\0");
      if (args[0] === "show") { const bytes = value.baseline.get(args[1].slice(41)); assert.ok(bytes !== undefined); return typeof bytes === "string" ? Buffer.from(bytes) : Buffer.from(bytes); }
      throw Error("Unexpected controlled Git command");
    };
    const read = (file: string, encoding?: string) => { const bytes = value.current.get(file); assert.ok(bytes !== undefined); return encoding ? bytes.toString() : typeof bytes === "string" ? Buffer.from(bytes) : Buffer.from(bytes); };
    const code = ts.transpileModule(declaration.getText(tree) + "\n" + inspector.getText(tree).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const controlledProcess = { env: { NODE_ENV: "production", SUPABASE_SERVICE_ROLE_KEY: "private-sentinel", ADMIN_SESSION_SECRET: "private-sentinel",
      PATH: "controlled-path", GIT_OPTIONAL_LOCKS: "1", GIT_CONFIG_COUNT: "99" } };
    const guard = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "assertLocalVerificationAdmissionQualification"); assert.ok(guard);
    const seals = tree.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(tree) === "localVerificationAdmissionInvocations")); assert.ok(seals);
    const rejectSerialized = new Function("assert", "digest", ts.transpileModule(seals.getText(tree) + "\n" + guard.getText(tree),
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return assertLocalVerificationAdmissionQualification;")(assert, sha256);
    const readerApi = new Function("assert", "execFileSync", "ROOT", "digest", "safeSourcePath", "existsSync", "lstatSync", "realpathSync", "readFileSync", "localVerificationNativeGate", "localVerificationCoverage", "deriveLocalVerificationSourceImpact", "selectSourceInventory", "planLocalVerification", "process", "assertLocalVerificationAdmissionQualification", code + ";return {readLocalVerificationInputs,inspectLocalVerificationChangeImpact};")(
      assert, git, root, sha256, (file: string) => file, (file: string) => value.current.has(file), () => ({ isFile: () => true }), (file: string) => file, read,
      () => undefined, () => [], (...args: Parameters<typeof api.deriveLocalVerificationSourceImpact>) => { discoveries += 1; return api.deriveLocalVerificationSourceImpact(...args); },
      selectSourceInventory, api.planLocalVerification, controlledProcess, rejectSerialized) as {
        readLocalVerificationInputs(context: { cleanEnvironment(): object }, impact: Impact, manifest: Array<{ file: string; sha256: string }>, additional: string[], request: object, previous?: Actual): Actual;
        inspectLocalVerificationChangeImpact: typeof import("./lib/isolated-public-verification.mts").inspectLocalVerificationChangeImpact;
      };
    const reader = readerApi.readLocalVerificationInputs;
    const context = { cleanEnvironment: () => ({}) };
    const first: import("./lib/isolated-public-verification.mts").LocalVerificationInputs = reader(context, value.impact, manifest, [], {});
    assert.equal(first.sourceSha256, value.impact.sourceSha256); assert.equal(first.changeImpact!.proofBoundary, "source_discovery_only");
    assert.equal(first.admissionQualification, undefined, "The actual default reader returns discovery without manufacturing qualified execution authority.");
    assert.equal(api.planLocalVerification(scripts, value.impact, first).mode, "bounded");
    const serializedRequest: import("./lib/isolated-public-verification.mts").PublicGateRequest = {
      additionalSourceFiles: [], admissionQualification: JSON.parse('{"schema":1,"kind":"owned-admission-qualification","status":"PASS"}'),
    };
    assert.ok(serializedRequest.admissionQualification);
    assert.throws(() => reader(context, value.impact, manifest, [], serializedRequest), /live qualified execution/u,
      "The actual Public request reader must reject a serialized admission object before granting coverage.");
    const second = reader(context, value.impact, manifest, [], {}, first);
    assert.equal(second.changeImpact, first.changeImpact); assert.equal(discoveries, 1);
    assert.throws(() => reader(context, value.impact, manifest.map(row => row.file === contract ? { ...row, sha256: "f".repeat(64) } : row), [], {}, first), /changed source manifest/u);
    const inspectActualOwner = (ownerApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "inspectLocalVerificationChangeImpact">) => {
      const discovery = ownerApi.inspectLocalVerificationChangeImpact({ baselineHead: value.impact.baselineHead });
      assert.equal(discovery.status, "REVIEW_REQUIRED"); assert.equal(discovery.checksExecuted, 0); assert.equal(discovery.releaseEvidence, false);
      const reviewed = ownerApi.inspectLocalVerificationChangeImpact({ baselineHead: value.impact.baselineHead, impact: value.impact });
      assert.equal(reviewed.status, "PASS_SOURCE_CONSISTENCY"); assert.equal(reviewed.browserExecuted, false); assert.equal(reviewed.databaseCalls, 0);
      const stale = ownerApi.inspectLocalVerificationChangeImpact({ baselineHead: value.impact.baselineHead,
        impact: { ...value.impact, sourceSha256: sha256("stale controlled source snapshot") } });
      assert.equal(stale.status, "DRIFT");
      assert.throws(() => ownerApi.inspectLocalVerificationChangeImpact({}), /explicit immutable impact baseline/u);
      assert.throws(() => ownerApi.inspectLocalVerificationChangeImpact({ baselineHead: value.impact.baselineHead, additionalSourceFiles: [".env.local"] }), /Unsafe additional source/u);
      assert.ok(inspectorEnvironments.length > 0);
      for (const environment of inspectorEnvironments) assert.deepEqual(environment, { NODE_ENV: "test", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false", PATH: "controlled-path" });
    };
    inspectActualOwner(readerApi);
    value.current.set(owner, 'export function Phase03Owner() { return "unreviewed"; }');
    assert.throws(() => reader(context, value.impact, manifest, [], {}, first), /omits or differs/u);
  });
  const automatic = (value: ReturnType<typeof scenario>) => api.deriveLocalVerificationSourceCoherence(scripts,
    { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 });
  check("automatic Fast source checks isolate literal spacing and radius presentation without executing unrelated Browser or database candidates", () => {
    const baseline = new Map(originals), jsx = 'export function Phase03Owner() { return <section className="p-4 rounded-lg">Content</section>; }';
    baseline.set(owner, jsx);
    assert.equal(api.localVerificationPresentationSource(owner, jsx),
      api.localVerificationPresentationSource(owner, jsx.replace("p-4 rounded-lg", "p-6 rounded-xl")),
      "The actual projector normalizes only the existing literal spacing and radius ports.");
    const value = scenario([[owner, jsx.replace("p-4 rounded-lg", "p-6 rounded-xl")]], baseline), result = automatic(value);
    assert.equal(result.status, "PASS_AUTOMATIC_SOURCE_PROTECTION"); assert.equal(result.fullRequired, false);
    assert.equal(result.fast.candidateCommandsExecuted, 0); assert.equal(result.fast.databaseCalls, 0); assert.equal(result.fast.browserExecuted, false);
    assert.deepEqual(result.functionalEvidenceRequired, []); assert.equal(result.releaseEvidence, false); assert.equal(result.ownerReviewSatisfied, false);
    assert.notEqual(api.localVerificationPresentationSource(owner, jsx),
      api.localVerificationPresentationSource(owner, jsx.replace("p-4", "hover:p-6")),
      "The actual projector retains governed visual-state changes.");
    const stateChange = automatic(scenario([[owner, jsx.replace("p-4", "hover:p-6")]], baseline));
    assert.equal(stateChange.fullRequired, true, "Changing a governed visual state cannot be masked as the same spacing port.");
  });
  check("approved height and responsive geometry cannot be normalized as a historical spacing or radius expectation", () => {
    const baseline = new Map(originals), jsx = 'export function Phase03Owner() { return <section className="h-10 md:grid-cols-2 p-4 rounded-lg">Content</section>; }';
    baseline.set(owner, jsx);
    baseline.set(formAuthority, 'export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST=[{id:"geometry-consumer",sourceFiles:["' + consumer
      + '"],capabilityAudit:{},presentationContract:{requirements:[{target:"rowGeometry",requirement:"required",owner:{sourceFile:"'
      + owner + '",exportName:"Phase03Owner"},presentation:{port:"height",value:"40px"}}]}}];');
    for (const after of [jsx.replace("h-10", "h-8"), jsx.replace("md:grid-cols-2", "md:grid-cols-3")]) {
      assert.notEqual(api.localVerificationPresentationSource(owner, jsx), api.localVerificationPresentationSource(owner, after),
        "The actual projector retains approved height and responsive geometry.");
      const value = scenario([[owner, after]], baseline), result = automatic(value);
      assert.equal(value.actual.changeImpact!.changes[0].presentationOnly, false);
      assert.equal(result.fullRequired, true); assert.equal(result.functionalEvidenceRequired[0].sourceChecksAdequate, false);
      assert.ok(result.targeted.some(target => target.reasons.some(reason => reason.consumers.includes(formAuthority + "#geometry-consumer"))));
      assert.equal(result.behavioralPass, false); assert.equal(result.fast.databaseCalls, 0);
    }
  });
  check("actual presentation projector retains dynamic class decisions", () => {
    const dynamic = 'export function Phase03Owner({compact}: {compact: boolean}) { return <section className={compact ? "p-4 rounded-lg" : "p-6 rounded-xl"}>Content</section>; }';
    const changed = dynamic.replace("p-4 rounded-lg", "p-8 rounded-2xl");
    assert.notEqual(api.localVerificationPresentationSource(owner, dynamic), api.localVerificationPresentationSource(owner, changed),
      "Conditional class behavior cannot borrow literal-only spacing and radius normalization.");
  });
  check("automatic shared contract coherence reports owner and all registered consumers and rejects missing protection", () => {
    const second = "src/app/admin/phase03/Indirect.tsx", baseline = new Map(originals);
    baseline.set(authority, authoritySource.replace('sourceFiles: ["' + owner + '"]', 'sourceFiles: ["' + owner + '","' + contract + '"]'));
    baseline.set(second, 'import {Consumer} from "./Consumer"; export function Indirect() { return Consumer(); }');
    baseline.set(formAuthority, 'export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST=[{id:"second-consumer",sourceFiles:["' + second + '"],capabilityAudit:{}}];');
    const next = "export type RecordContract = { value: string; revision: number };";
    const missing = automatic(scenario([[contract, next]], baseline));
    assert.equal(missing.status, "DRIFT"); assert.equal(missing.exitCode, 2);
    assert.ok(missing.diagnostics.some(message => message.includes(contract) && message.includes("Phase03Owner") && message.includes("second-consumer")));
    const protectedResult = automatic(scenario([[contract, next], [entry, guardSource.replace('"value: string"', '"revision: number"')]], baseline));
    assert.equal(protectedResult.status, "PASS_AUTOMATIC_SOURCE_PROTECTION"); assert.equal(protectedResult.behavioralPass, false);
    assert.equal(JSON.stringify(protectedResult).includes("reviewedBy"), false, "Automatic source correspondence cannot manufacture approval metadata.");
  });
  check("save delete and duplicate body changes retain functional and native readback obligations despite unchanged signatures", () => {
    for (const action of ["save", "delete", "duplicate"]) {
      const baseline = new Map(originals); baseline.set(owner, `export async function ${action}Record() { return "before"; }`);
      const result = automatic(scenario([[owner, `export async function ${action}Record() { return "after"; }`]], baseline));
      assert.equal(result.fullRequired, true); assert.equal(result.functionalEvidenceRequired.length, 1);
      assert.equal(result.functionalEvidenceRequired[0].sourceChecksAdequate, false);
      assert.ok(result.functionalEvidenceRequired[0].required.includes("affected_native_integration_or_readback"));
      assert.ok(result.targeted.every(target => target.executionAllowed === false && target.proofLevel === "unexecuted_source_candidate"));
    }
  });
  check("automatic source selectors reject absent stale and partial actual input bindings", () => {
    const value = scenario([[contract, "export type RecordContract = { value: string; revision: number };"], [entry, guardSource.replace('"value: string"', '"revision: number"')]]);
    const actual = { ...value.actual, sourceSha256: value.actual.changeImpact!.sourceSha256 };
    assert.throws(() => api.deriveLocalVerificationSourceCoherence(scripts, { ...actual, changeImpact: undefined }), /complete actual source/u);
    assert.throws(() => api.deriveLocalVerificationSourceCoherence(scripts, { ...actual, sourceSha256: "f".repeat(64) }), /stale source snapshot/u);
    assert.throws(() => api.deriveLocalVerificationSourceCoherence(scripts, { ...actual, changes: actual.changes.slice(0, 1) }), /stale or partial/u);
    assert.throws(() => api.deriveLocalVerificationSourceCoherence(scripts, { ...actual, changeImpact: { ...actual.changeImpact!, changes: actual.changeImpact!.changes.slice(0, 1) } }), /omits actual/u);
  });
  check("actual CI inspector fixes test mode and preserves Git environment isolation", () => {
    const source = readSource("scripts/lib/isolated-public-verification.mts");
    const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const inspector = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
      && node.name?.text === "inspectLocalVerificationChangeImpact");
    assert.ok(inspector?.body, "The canonical source inspector must own its clean environment.");
    const initialization = inspector.body.statements.find(node => ts.isVariableStatement(node)
      && node.declarationList.declarations.some(declaration => declaration.name.getText(file) === "environment"));
    const inheritance = inspector.body.statements.find(node => ts.isForOfStatement(node)
      && ts.isArrayLiteralExpression(node.expression) && node.statement.getText(file).includes("environment[key]"));
    assert.ok(initialization && ts.isVariableStatement(initialization)
      && initialization.declarationList.declarations.some(declaration => declaration.name.getText(file) === "environment"));
    assert.ok(inheritance && ts.isForOfStatement(inheritance), "Only the actual whitelist loop may inherit caller values.");
    const code = ts.transpileModule(initialization.getText(file) + "\n" + inheritance.getText(file), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const initialize = new Function("process", code + ";return environment;") as (process: { env: Record<string, string> }) => Record<string, string | undefined>;
    const environment = initialize({ env: { NODE_ENV: "production", SUPABASE_SERVICE_ROLE_KEY: "sentinel", PATH: "safe", GIT_OPTIONAL_LOCKS: "1", GIT_CONFIG_COUNT: "99" } });
    assert.deepEqual(environment, { NODE_ENV: "test", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false", PATH: "safe" });
    assert.equal(Object.hasOwn(environment, "SUPABASE_SERVICE_ROLE_KEY"), false, "Caller credentials cannot enter the inspector's Git environment.");
  });
  check("CI admission diagnostics preserve original public bindings and actual bounded Git query results", () => {
    const base = "a".repeat(40), head = "b".repeat(40), checkout = "c".repeat(40), merge = "d".repeat(40);
    const report = api.localVerificationCiDiagnostic({ eventName: "pull_request", event: { pull_request: { base: { sha: base }, head: { sha: head }, merge_commit_sha: merge } },
      githubSha: checkout, checkoutHead: checkout, lastCommitLookup: merge, lastCommitProbe: { sha: merge, exitCode: 128, identity: null } }, (operation, sha) => {
      assert.match(sha, /^[a-f0-9]{40}$/u);
      if (sha === merge) return { exitCode: 128, output: "" };
      return { exitCode: 0, output: operation === "identity" ? sha : operation === "objectType" ? "commit" : operation === "parents" && sha === checkout ? base + " " + head : "" };
    });
    assert.deepEqual(report.bindings.mergeCommitSha, { present: true, type: "string", value: merge });
    assert.deepEqual(report.originalCommitProbe, { operation: "identity", sha: merge, exitCode: 128, identity: null });
    assert.deepEqual(report.objects.find(object => object.sha === checkout)?.parents, { exitCode: 0, values: [base, head], complete: true });
    assert.deepEqual(report.objects.find(object => object.sha === merge)?.identity, { exitCode: 128, value: null });
    assert.equal(report.ancestry.find(row => row.ancestor === merge)?.isAncestor, null);
    assert.equal(report.ancestry.find(row => row.ancestor === head)?.isAncestor, true);
  });
  check("CI admission diagnostics suppress arbitrary payload text Git output paths and caller secrets", () => {
    const secret = "sentinel-private-body-path-and-credential", checkout = "c".repeat(40);
    const report = api.localVerificationCiDiagnostic({ eventName: secret, event: { title: secret, body: secret, pull_request: {
      base: { sha: secret }, head: { sha: secret }, merge_commit_sha: secret, credentials: secret } }, githubSha: secret, checkoutHead: checkout,
    lastCommitProbe: { sha: secret, exitCode: -1, identity: secret } }, (_operation, sha) => {
      assert.equal(sha, checkout, "Noncanonical event values cannot become Git arguments."); return { exitCode: 300, output: secret };
    });
    assert.equal(report.eventName, "unsupported"); assert.equal(JSON.stringify(report).includes(secret), false);
    assert.deepEqual(report.objects[0].identity, { exitCode: null, value: null });
    assert.deepEqual(report.objects[0].objectType, { exitCode: null, value: null });
    assert.deepEqual(report.objects[0].parents, { exitCode: null, values: [], complete: false });
    assert.deepEqual(report.originalCommitProbe, { operation: "identity", sha: null, exitCode: null, identity: null });
  });
  check("CI admission diagnostics distinguish absent null and invalid merge metadata and contain probe failures", () => {
    for (const request of [{}, { merge_commit_sha: null }, { merge_commit_sha: [] }]) {
      const report = api.localVerificationCiDiagnostic({ eventName: "pull_request", event: { pull_request: request }, githubSha: "c".repeat(40), checkoutHead: "c".repeat(40) },
        () => { throw Error("sentinel Git error must not appear"); });
      assert.equal(report.bindings.mergeCommitSha.present, Object.hasOwn(request, "merge_commit_sha"));
      assert.equal(report.bindings.mergeCommitSha.type, "merge_commit_sha" in request ? request.merge_commit_sha === null ? "null" : "array" : "undefined");
      assert.equal(report.bindings.mergeCommitSha.value, null); assert.equal(report.originalCommitProbe, null);
      assert.equal(report.objects[0].identity.exitCode, null); assert.equal(JSON.stringify(report).includes("sentinel"), false);
    }
  });
  check("immutable CI event resolution distinguishes PR merge checkout from PR head and validates push before history", () => {
    const base = "a".repeat(40), head = "b".repeat(40), merge = "c".repeat(40), known = new Set([base, head, merge]);
    const history = { exists: (sha: string) => known.has(sha), isAncestor: (left: string, right: string) => left === right || left === base || left === head && right === merge,
      parents: (sha: string) => sha === merge ? [base, head] : [] };
    const event = { pull_request: { base: { sha: base }, head: { sha: head }, merge_commit_sha: merge, title: "untrusted $(title) is never a command" } };
    assert.deepEqual(api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event, githubSha: merge, checkoutHead: merge }, history), { baselineHead: base, finalHead: merge, eventName: "pull_request" });
    assert.deepEqual(api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event, githubSha: head, checkoutHead: head }, history), { baselineHead: base, finalHead: head, eventName: "pull_request" });
    for (const request of [
      { base: { sha: base }, head: { sha: head } },
      { base: { sha: base }, head: { sha: head }, merge_commit_sha: null },
    ]) {
      const opened = { action: "opened", number: 229, pull_request: request };
      assert.deepEqual(api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: opened, githubSha: merge, checkoutHead: merge }, history),
        { baselineHead: base, finalHead: merge, eventName: "pull_request" }, "Absent/null merge metadata requires independently exact base/head merge parents.");
      assert.equal(api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: opened, githubSha: head, checkoutHead: head }, history).finalHead, head,
        "An exact event-head checkout does not need a synthesized merge.");
    }
    for (const value of ["", "not-a-sha", "0".repeat(40), 229, "D".repeat(40)]) {
      const malformed = { pull_request: { ...event.pull_request, merge_commit_sha: value } };
      for (const checkout of [head, merge]) assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: malformed,
        githubSha: checkout, checkoutHead: checkout }, history), /Invalid or missing immutable CI|Missing local Git history/u,
      "Present merge metadata cannot bypass validation even for an exact event-head checkout.");
    }
    assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: { pull_request: { ...event.pull_request, merge_commit_sha: base } },
      githubSha: merge, checkoutHead: merge }, { ...history, parents: () => [base, base] }), /parents differ/u,
    "Advisory metadata cannot authorize a checkout whose actual parents differ from the immutable event.");
    for (const advisory of [base, "d".repeat(40)]) for (const checkout of [head, merge]) {
      assert.equal(api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: { pull_request: { ...event.pull_request, merge_commit_sha: advisory } },
        githubSha: checkout, checkoutHead: checkout }, history).finalHead, checkout,
      "Canonical advisory metadata neither replaces the actual checkout nor requires an unrelated local Git object.");
    }
    // Exact original Actions bindings from diagnostic run 40615509207, artifact 12784204891.
    // Its supplied merge SHA was absent locally (identity/type/parents exit 128); actual base/head
    // identities, checkout equality, ordered two-parent topology and both ancestry probes passed.
    const recorded = { base: "a29a9a89779c70fcf8f256faebd6103d566f5b1c", head: "545ee380ecedd8ba0e4d5c7d9e949bcb5309c34e",
      checkout: "4fafac2754f2f11f54f1bda84c62464050791944", advisory: "1ff04a04d24bcaaa8a38d13028469a0e8025622b" };
    const recordedEvent = { action: "synchronize", number: 229, pull_request: { base: { sha: recorded.base }, head: { sha: recorded.head }, merge_commit_sha: recorded.advisory } };
    const recordedHistory = { exists: (sha: string) => [recorded.base, recorded.head, recorded.checkout].includes(sha),
      parents: (sha: string) => sha === recorded.checkout ? [recorded.base, recorded.head] : [],
      isAncestor: (ancestor: string, descendant: string) => ancestor === descendant || descendant === recorded.checkout && [recorded.base, recorded.head].includes(ancestor) };
    assert.equal(recordedHistory.exists(recorded.advisory), false);
    assert.deepEqual(api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: recordedEvent, githubSha: recorded.checkout, checkoutHead: recorded.checkout }, recordedHistory),
      { baselineHead: recorded.base, finalHead: recorded.checkout, eventName: "pull_request" }, "Replay the captured event rather than guessing current PR metadata.");
    assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: recordedEvent, githubSha: recorded.head, checkoutHead: recorded.checkout }, recordedHistory), /checkout HEAD differs/u);
    assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: recordedEvent, githubSha: recorded.checkout, checkoutHead: recorded.checkout },
      { ...recordedHistory, exists: (sha: string) => sha !== recorded.head }), /Missing local Git history/u);
    assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: recordedEvent, githubSha: recorded.checkout, checkoutHead: recorded.checkout },
      { ...recordedHistory, parents: () => [recorded.base, recorded.advisory] }), /Missing local Git history|parents differ/u);
    assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: recordedEvent, githubSha: recorded.checkout, checkoutHead: recorded.checkout },
      { ...recordedHistory, isAncestor: () => false }), /not an ancestor/u);
    const withoutMerge = { action: "opened", pull_request: { base: { sha: base }, head: { sha: head } } };
    for (const guardedEvent of [withoutMerge, event]) for (const parents of [[], [base], [head, base], [base, head, merge], [base, merge], ["0".repeat(40), head], ["d".repeat(40), head]]) {
      assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: guardedEvent, githubSha: merge, checkoutHead: merge },
        { ...history, parents: () => parents }), /exactly two Git parents|parents differ|Invalid or missing immutable CI|Missing local Git history/u,
      "Every merge checkout rejects missing, reversed, foreign or octopus topology regardless of advisory metadata.");
    }
    assert.throws(() => api.resolveLocalVerificationCiBaseline({ eventName: "pull_request", event: withoutMerge, githubSha: merge, checkoutHead: merge },
      { ...history, parents: () => { throw new Error("Git parent history unavailable"); } }), /Git parent history unavailable/u);
    assert.equal(api.resolveLocalVerificationCiBaseline({ eventName: "push", event: { before: base, after: head }, githubSha: head, checkoutHead: head }, history).baselineHead, base);
    for (const [label, input, facts] of [
      ["missing base", { eventName: "pull_request", event: { pull_request: { head: { sha: head } } }, githubSha: head, checkoutHead: head }, history],
      ["missing head", { eventName: "pull_request", event: { pull_request: { base: { sha: base } } }, githubSha: merge, checkoutHead: merge }, history],
      ["invalid GitHub SHA", { eventName: "pull_request", event: withoutMerge, githubSha: "invalid", checkoutHead: merge }, history],
      ["missing checkout SHA", { eventName: "pull_request", event: withoutMerge, githubSha: merge, checkoutHead: "" }, history],
      ["PR missing history", { eventName: "pull_request", event: withoutMerge, githubSha: merge, checkoutHead: merge }, { ...history, exists: (sha: string) => sha !== head }],
      ["PR head nonancestor", { eventName: "pull_request", event: withoutMerge, githubSha: merge, checkoutHead: merge }, { ...history, isAncestor: (left: string) => left !== head }],
      ["PR base nonancestor", { eventName: "pull_request", event: withoutMerge, githubSha: merge, checkoutHead: merge }, { ...history, isAncestor: (left: string) => left !== base }],
      ["zero before", { eventName: "push", event: { before: "0".repeat(40), after: head }, githubSha: head, checkoutHead: head }, history],
      ["checkout mismatch", { eventName: "push", event: { before: base, after: head }, githubSha: head, checkoutHead: merge }, history],
      ["missing history", { eventName: "push", event: { before: base, after: head }, githubSha: head, checkoutHead: head }, { ...history, exists: () => false }],
      ["nonancestor", { eventName: "push", event: { before: base, after: head }, githubSha: head, checkoutHead: head }, { ...history, isAncestor: () => false }],
      ["unsupported event", { eventName: "workflow_dispatch", event: {}, githubSha: head, checkoutHead: head }, history],
    ] as const) assert.throws(() => api.resolveLocalVerificationCiBaseline(input, facts), Error, label);
    const phase04OwnerContractSource = readSource("scripts/lib/isolated-public-verification.mts");
    assert.ok(phase04OwnerContractSource.includes("export function resolveLocalVerificationCiBaseline") && phase04OwnerContractSource.includes("export function deriveLocalVerificationSourceCoherence"));
  });
}

/** Execute the canonical local-risk planner without starting its owned lifecycle. */
function verifyLocalRiskVerificationPlan() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = (name: string) => {
    const found = file.statements.find(node => (ts.isFunctionDeclaration(node) && node.name?.text === name)
      || (ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === name)));
    assert.ok(found, `Missing canonical local verification declaration: ${name}`);
    return found.getText(file).replace(/^export /u, "");
  };
  const declarations = ["GATES", "localVerificationAssertionRelocationRequired", "validateLocalVerificationAssertionRelocations", "finalQualityScriptNames", "localVerificationSemanticSource", "localVerificationPresentationSource", "deriveLocalVerificationSourceImpact", "deriveLocalVerificationSourceCoherence", "resolveLocalVerificationCiBaseline", "localVerificationCiDiagnostic", "assertLocalVerificationProtectionMaintenance", "localVerificationCommandSteps", "planLocalVerification", "assertLocalVerificationRequest", "registeredVerificationNodeEntries", "localVerificationCoverage"];
  const code = ts.transpileModule(adminAdoptionControlSource(file) + "\n" + declarations.map(statement).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  type Change = import("./lib/isolated-public-verification.mts").LocalVerificationChange;
  type Impact = { baselineHead: string; finalHead: string; sourceSha256: string; changes: Change[];
    verificationEntries?: Array<{ check: string; entry: string }> };
  type Actual = import("./lib/isolated-public-verification.mts").LocalVerificationInputs & {
    changes: Array<Pick<Change, "file" | "beforeSha256" | "afterSha256">> };
  type Plan = ReturnType<typeof import("./lib/isolated-public-verification.mts").planLocalVerification>;
  type Request = import("./lib/isolated-public-verification.mts").PublicGateRequest;
  const api = new Function("assert", "sourceIncluded", "collectExecutableSourceGraph", "ROOT", "readFileSync", "safeSourcePath", "digest", "ts", "resolve", "dirname", "createHash", "fileURLToPath", code + ";return {planLocalVerification,assertLocalVerificationRequest,registeredVerificationNodeEntries,localVerificationCoverage,adminAdoptionGate,deriveLocalVerificationSourceImpact,deriveLocalVerificationSourceCoherence,resolveLocalVerificationCiBaseline,localVerificationCiDiagnostic,localVerificationSemanticSource,localVerificationPresentationSource,assertLocalVerificationProtectionMaintenance,localVerificationCommandSteps,localVerificationAssertionRelocationRequired,validateLocalVerificationAssertionRelocations};")(assert, sourceIncluded, collectExecutableSourceGraph, root, readFileSync, (name: string) => path.join(root, name), sha256, ts, path.resolve, path.dirname, createHash, fileURLToPath) as {
    planLocalVerification: typeof import("./lib/isolated-public-verification.mts").planLocalVerification;
    assertLocalVerificationRequest(request: Record<string, unknown>, plan: Plan): void;
    registeredVerificationNodeEntries(scripts: Readonly<Record<string, string>>, check: string): string[];
    localVerificationCoverage(scripts: Readonly<Record<string, string>>, impact: Impact, manifest: Array<{ file: string; sha256: string }>, request?: Request): NonNullable<Actual["verificationCoverage"]>;
    adminAdoptionGate(request: Request): ReturnType<typeof import("./lib/isolated-public-verification.mts").adminAdoptionGate>;
    deriveLocalVerificationSourceImpact: typeof import("./lib/isolated-public-verification.mts").deriveLocalVerificationSourceImpact;
    localVerificationAssertionRelocationRequired: typeof import("./lib/isolated-public-verification.mts").localVerificationAssertionRelocationRequired;
    validateLocalVerificationAssertionRelocations: typeof import("./lib/isolated-public-verification.mts").validateLocalVerificationAssertionRelocations;
    localVerificationSemanticSource: typeof import("./lib/isolated-public-verification.mts").localVerificationSemanticSource;
    localVerificationPresentationSource: typeof import("./lib/isolated-public-verification.mts").localVerificationPresentationSource;
    assertLocalVerificationProtectionMaintenance: typeof import("./lib/isolated-public-verification.mts").assertLocalVerificationProtectionMaintenance;
    localVerificationCommandSteps: typeof import("./lib/isolated-public-verification.mts").localVerificationCommandSteps;
    deriveLocalVerificationSourceCoherence: typeof import("./lib/isolated-public-verification.mts").deriveLocalVerificationSourceCoherence;
    resolveLocalVerificationCiBaseline: typeof import("./lib/isolated-public-verification.mts").resolveLocalVerificationCiBaseline;
    localVerificationCiDiagnostic: typeof import("./lib/isolated-public-verification.mts").localVerificationCiDiagnostic;
  };
  const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;
  verifyLocalSourceImpactControls(api, scripts);
  const fullPrefix = new Function("assert", ts.transpileModule(statement("GATES") + "\n" + statement("finalQualityScriptNames"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + ";return finalQualityScriptNames;")(assert)(scripts) as string[];
  const fixture = (): { impact: Impact; actual: Actual } => {
    const impact: Impact = { baselineHead: "a".repeat(40), finalHead: "b".repeat(40), sourceSha256: "c".repeat(64), changes: [{
      file: "src/components/admin/dashboard/AdminDashboardView.tsx", beforeSha256: "d".repeat(64), afterSha256: "e".repeat(64),
      risk: "A", owner: "src/components/admin/dashboard/AdminDashboardView.tsx", reviewedBy: "local-impact-review",
      rationale: "Bounded Dashboard presentation; canonical data contract and behavior unchanged.", bounded: true,
      nonImportImpactReviewed: true, contracts: ["src/lib/admin/dashboard/dashboard-contract.ts"],
      consumers: ["src/app/admin/page.tsx"], checks: ["verify:dashboard-truth"],
    }] };
    return { impact, actual: { baselineHead: impact.baselineHead, finalHead: impact.finalHead, sourceSha256: impact.sourceSha256,
      changes: impact.changes.map(({ file: name, beforeSha256, afterSha256 }) => ({ file: name, beforeSha256, afterSha256 })) } };
  };
  const run = (value = fixture(), commandScripts = scripts) => api.planLocalVerification(commandScripts, value.impact, value.actual);
  const rejects = (name: string, mutate: (value: ReturnType<typeof fixture>) => void) => check("local risk rejects " + name, () => {
    const value = fixture(); mutate(value); assert.throws(() => run(value));
  });
  const requiresFull = (name: string, mutate: (value: ReturnType<typeof fixture>) => void) => check("local risk requires full for " + name, () => {
    const value = fixture(); mutate(value); const plan = run(value);
    assert.equal(plan.mode, "full"); assert.deepEqual(plan.prefix.slice(0, fullPrefix.length), fullPrefix);
    for (const row of value.impact.changes) for (const check of row.checks) {
      const covered = new Set(plan.prefix.flatMap(name => api.localVerificationCommandSteps(scripts, name) ?? []));
      assert.ok(plan.prefix.includes(check) || plan.redundantAdditionalChecks.includes(check) &&
        api.localVerificationCommandSteps(scripts, check)?.every(step => covered.has(step)), "Full Gate must retain every affected command and its exact arguments.");
    }
  });
  check("bounded A includes selected affected checks, TypeScript, ESLint and every canonical Public tail", () => {
    const plan = run(); assert.equal(plan.risk, "A"); assert.equal(plan.mode, "bounded");
    assert.ok(plan.prefix.includes("lint") && plan.prefix.includes("typecheck") && plan.prefix.includes("verify:dashboard-truth"));
    assert.deepEqual(plan.tail, ["normal-build", "product-surface-build", "platform-contracts", "public-e2e"]);
    assert.ok(plan.prefix.length < fullPrefix.length, "A bounded change must not silently expand to the Full Gate prefix.");
  });
  check("bounded B retains shared owner, consumer, adoption and source-proof requirements", () => {
    const value = fixture(); Object.assign(value.impact.changes[0], { risk: "B", file: "src/components/admin/ui/AdminMetricCardsGrid.tsx",
      owner: "src/components/admin/ui/AdminMetricCardsGrid.tsx", consumers: ["src/app/admin/content/categories/CategoriesListClient.tsx", "src/app/admin/content/series/SeriesTableClient.tsx"],
      checks: ["verify:consumer-capability-adoption", "verify:dashboard-truth"],
      adoption: { applicabilityEvidence: "verify:consumer-capability-adoption", sourceProofEvidence: "verify:consumer-capability-adoption", consumerEvidence: "verify:dashboard-truth" } });
    value.actual.changes[0].file = value.impact.changes[0].file;
    const plan = run(value); assert.equal(plan.risk, "B"); assert.equal(plan.mode, "bounded");
    assert.ok(plan.prefix.includes("verify:dashboard-truth"));
  });
  for (const risk of ["C", "D", "E"] as const) requiresFull("declared " + risk, value => { value.impact.changes[0].risk = risk; });
  requiresFull("unbounded impact", value => { value.impact.changes[0].bounded = false; });
  requiresFull("unreviewed non-import dependencies", value => { value.impact.changes[0].nonImportImpactReviewed = false; });
  requiresFull("mixed A and C changes", value => {
    const change = { ...value.impact.changes[0], file: "src/lib/admin/dashboard/dashboard-contract.ts", risk: "C" as const };
    value.impact.changes.push(change); value.actual.changes.push({ file: change.file, beforeSha256: change.beforeSha256, afterSha256: change.afterSha256 });
  });
  for (const key of ["baselineHead", "finalHead", "sourceSha256"] as const) rejects("stale " + key, value => { value.actual[key] = "f".repeat(key === "sourceSha256" ? 64 : 40); });
  rejects("omitted actual changed file", value => { value.impact.changes = []; });
  rejects("invented changed file", value => { value.impact.changes[0].file = "src/components/admin/ui/AdminMetricCardsGrid.tsx"; });
  rejects("changed prior bytes", value => { value.impact.changes[0].beforeSha256 = "f".repeat(64); });
  rejects("changed current bytes", value => { value.impact.changes[0].afterSha256 = "f".repeat(64); });
  rejects("duplicate changed file", value => { value.impact.changes.push({ ...value.impact.changes[0] }); });
  rejects("missing owner", value => { value.impact.changes[0].owner = ""; });
  rejects("missing impact reviewer", value => { value.impact.changes[0].reviewedBy = ""; });
  rejects("missing rationale", value => { value.impact.changes[0].rationale = ""; });
  rejects("missing affected contracts", value => { value.impact.changes[0].contracts = []; });
  rejects("missing direct and indirect consumer review", value => { value.impact.changes[0].consumers = []; });
  rejects("missing affected checks", value => { value.impact.changes[0].checks = []; });
  rejects("unknown check", value => { value.impact.changes[0].checks = ["verify:nonexistent-pretend-check"]; });
  rejects("shell injection instead of a named check", value => { value.impact.changes[0].checks = ["verify:dashboard-truth && echo skipped"]; });
  rejects("Public subset instead of an affected check", value => { value.impact.changes[0].checks = ["build"]; });
  for (const field of ["applicabilityEvidence", "sourceProofEvidence", "consumerEvidence"] as const) requiresFull("B missing " + field, value => {
    const adoption = { applicabilityEvidence: "verify:consumer-capability-adoption", sourceProofEvidence: "verify:consumer-capability-adoption", consumerEvidence: "verify:dashboard-truth" };
    adoption[field] = ""; Object.assign(value.impact.changes[0], { risk: "B", checks: ["verify:consumer-capability-adoption", "verify:dashboard-truth"], adoption });
  });
  const commandMutations: Array<Record<string, string>> = [
    { "ci:check": scripts["ci:check"] + " && npm run lint" },
    { "ci:check": scripts["ci:check"].replace("npm run lint", "npm run lint; echo bypass") },
    { "test:e2e:public": "echo skipped" },
  ];
  for (const patch of commandMutations)
    check("bounded plan rejects changed canonical CI/Public command contract", () => assert.throws(() => run(fixture(), { ...scripts, ...patch })));
  const boundedPlan = run();
  check("the actual release path selects the bounded prefix and preserves the existing full fallback", () => {
    const assignments: ts.ExpressionStatement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
        && node.expression.left.getText(file) === "qualityScripts") assignments.push(node);
      ts.forEachChild(node, visit);
    };
    visit(file); assert.equal(assignments.length, 1);
    const choose = new Function("localPlan", "finalQualityScriptNames", "scripts", ts.transpileModule(
      "let qualityScripts;" + assignments[0].getText(file) + ";return qualityScripts;",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText) as (plan: Plan | undefined, fallback: () => string[], scripts: object) => string[];
    assert.deepEqual(choose(boundedPlan, () => { assert.fail("A bounded path must not select the full prefix."); }, scripts), boundedPlan.prefix);
    assert.deepEqual(choose(undefined, () => fullPrefix, scripts), fullPrefix);
  });
  check("bounded request accepts only the complete canonical Public path", () => api.assertLocalVerificationRequest({ localVerification: {} }, boundedPlan));
  for (const patch of [{ finalQualityGate: true }, { selection: "build-contracts" }, { selection: "admin-adoption" },
    { selection: "media-upload-limit" }, { selection: "hero-compatibility" }, { selection: "admin-interactions" },
    { retainedAdminBehaviorAdmissionSha256: "f".repeat(64) }, { adoptionScope: "core-closure" }, { adoptionCohort: "domain-forms" },
    { adoptionJourneySelection: "foreign" }, { adminMeasurement: {} }, { heroCompatibilityFinalHead: "b".repeat(40) }]) {
    check("bounded request rejects incompatible mode " + Object.keys(patch)[0] + ":" + String(Object.values(patch)[0]),
      () => assert.throws(() => api.assertLocalVerificationRequest({ localVerification: {}, ...patch }, boundedPlan)));
  }
  const highRisk = fixture(); highRisk.impact.changes[0].risk = "D"; const fullPlan = run(highRisk);
  check("high-risk request cannot omit Full Gate", () => assert.throws(() => api.assertLocalVerificationRequest({ localVerification: {} }, fullPlan)));
  check("high-risk request keeps the existing full Admin mode", () => api.assertLocalVerificationRequest({ localVerification: {}, finalQualityGate: true, selection: "admin-adoption", adoptionScope: "core-closure" }, fullPlan));
  const native = fixture(), nativeEntry = "scripts/qa-admin-adoption-journeys.mjs";
  Object.assign(native.impact.changes[0], { file: nativeEntry, risk: "E", checks: ["admin-adoption"] });
  native.actual.changes[0].file = nativeEntry;
  const nativeRequest: Request = { additionalSourceFiles: [], finalQualityGate: true, selection: "admin-adoption", localVerification: native.impact };
  const nativeManifest = [{ file: nativeEntry, sha256: sha256(readSource(nativeEntry)) }];
  native.actual.verificationNativeGate = api.adminAdoptionGate(nativeRequest);
  native.actual.verificationCoverage = api.localVerificationCoverage(scripts, native.impact, nativeManifest, nativeRequest);
  const nativePlan = api.planLocalVerification(scripts, native.impact, native.actual, nativeRequest);
  check("selected native Admin tail positively covers its real source-bound driver without adding prefix execution", () => {
    assert.deepEqual(native.actual.verificationCoverage, [{ file: nativeEntry, checks: ["admin-adoption"] }]);
    assert.equal(nativePlan.mode, "full"); assert.deepEqual(nativePlan.prefix, fullPrefix);
    assert.deepEqual(nativePlan.tail, ["normal-build", "product-surface-build", "platform-contracts", "public-e2e"]);
    assert.equal(nativePlan.prefix.includes("admin-adoption"), false);
    assert.deepEqual(nativePlan.nativeGate, { name: "admin-adoption", script: nativeEntry, args: [], limitMs: 900_000 });
    api.assertLocalVerificationRequest(nativeRequest, nativePlan);
  });
  const ineligibleNativeRequests: Array<[string, Record<string, unknown>]> = [
    ["missing selection", { selection: undefined }], ["false final gate", { finalQualityGate: false }],
    ["missing final gate", { finalQualityGate: undefined }], ["build only", { selection: "build-contracts" }],
    ["media", { selection: "media-upload-limit" }], ["measurement", { selection: "admin-interactions" }],
    ["Hero", { selection: "hero-compatibility" }], ["scoped core", { adoptionScope: "core-closure" }],
    ["scoped cohort", { adoptionScope: "core-closure", adoptionCohort: "domain-forms" }],
    ["scoped journey", { adoptionScope: "core-closure", adoptionCohort: "domain-forms", adoptionJourneySelection: "text-topic-forms" }],
  ];
  for (const [name, patch] of ineligibleNativeRequests) check("native coverage cannot borrow " + name, () => {
    const request = { ...nativeRequest, ...patch } as unknown as Request;
    assert.deepEqual(api.localVerificationCoverage(scripts, native.impact, nativeManifest, request), [{ file: nativeEntry, checks: [] }]);
    assert.throws(() => api.planLocalVerification(scripts, native.impact, native.actual, request));
    assert.throws(() => api.assertLocalVerificationRequest(request, nativePlan));
  });
  for (const [name, patch] of [
    ["retained conflict", { retainedAdminBehaviorAdmissionSha256: "a".repeat(64) }],
    ["measurement conflict", { adminMeasurement: {} }], ["unknown scope", { adoptionScope: "foreign" }],
    ["unknown cohort", { adoptionScope: "core-closure", adoptionCohort: "foreign" }],
    ["cohort without scope", { adoptionCohort: "domain-forms" }],
    ["journey cohort mismatch", { adoptionScope: "core-closure", adoptionCohort: "readonly-hubs", adoptionJourneySelection: "text-topic-forms" }],
  ] as const) check("native coverage rejects " + name, () => {
    const request = { ...nativeRequest, ...patch } as unknown as Request;
    assert.throws(() => api.localVerificationCoverage(scripts, native.impact, nativeManifest, request));
    assert.throws(() => api.assertLocalVerificationRequest(request, nativePlan));
  });
  check("native coverage rejects missing or stale driver bytes and missing actual descriptor", () => {
    assert.throws(() => api.localVerificationCoverage(scripts, native.impact, [], nativeRequest));
    assert.throws(() => api.localVerificationCoverage(scripts, native.impact, [{ file: nativeEntry, sha256: "f".repeat(64) }], nativeRequest));
    assert.throws(() => api.planLocalVerification(scripts, native.impact, { ...native.actual, verificationNativeGate: undefined }, nativeRequest));
    assert.throws(() => api.planLocalVerification(scripts, native.impact, native.actual));
  });
  for (const field of ["script", "args"] as const) check("cached native plan rejects swapped " + field, () => {
    const changed = structuredClone(nativePlan); assert.ok(changed.nativeGate);
    if (field === "script") (changed.nativeGate as { script: string }).script = "scripts/foreign-driver.mjs";
    else changed.nativeGate.args.push("--core-cohort=domain-forms");
    assert.throws(() => api.assertLocalVerificationRequest(nativeRequest, changed));
  });
  const helperTree = ts.createSourceFile("native-controls.mts", adminAdoptionControlSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cohortArrays: ts.ArrayLiteralExpression[] = [];
  const visitCohorts = (node: ts.Node) => { if (ts.isArrayLiteralExpression(node) && node.elements.some(value => ts.isStringLiteral(value) && value.text === "preview-recovery-templates")) cohortArrays.push(node); ts.forEachChild(node, visitCohorts); };
  visitCohorts(helperTree); assert.equal(cohortArrays.length, 1);
  check("shared runtime descriptor preserves every existing cohort argument and timeout including nonfinal execution", () => {
    for (const value of cohortArrays[0].elements) {
      assert.ok(ts.isStringLiteral(value)); const cohort = value.text;
      const descriptor = api.adminAdoptionGate({ additionalSourceFiles: [], selection: "admin-adoption", adoptionScope: "core-closure", adoptionCohort: cohort } as Request);
      assert.deepEqual(descriptor, { name: "admin-adoption", script: nativeEntry, args: ["--core-closure", "--core-cohort=" + cohort],
        limitMs: cohort === "media-recovery" ? 1_200_000 : ["domain-commands", "query-presentation"].includes(cohort) ? 1_800_000 : 900_000 });
    }
    assert.deepEqual(api.adminAdoptionGate({ ...nativeRequest, adoptionScope: "core-closure", adoptionCohort: "domain-forms", adoptionJourneySelection: "text-topic-forms" })?.args,
      ["--core-closure", "--core-cohort=domain-forms", "--core-journey-selection=text-topic-forms"]);
  });
  const assertNativeOwnerBindings = (input: string) => {
    const parsed = ts.createSourceFile("native-owner.mts", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const declaration = (name: string) => { const found = parsed.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(found?.body); return found; };
    const runtime = declaration("runOwnedPublicVerification"), reads = declaration("readLocalVerificationInputs");
    const gates = runtime.body!.statements.find((node): node is ts.VariableStatement => ts.isVariableStatement(node) && node.declarationList.declarations.some(value => value.name.getText(parsed) === "gates")); assert.ok(gates);
    const calls: ts.CallExpression[] = [], aliases: ts.Node[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(parsed) === "adminAdoptionGate") calls.push(node);
      if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)) && node.name?.getText(parsed) === "adminAdoptionGate") aliases.push(node);
      ts.forEachChild(node, visit);
    };
    visit(gates); assert.equal(calls.length, 1); assert.equal(calls[0].getText(parsed), "adminAdoptionGate(request)");
    calls.length = 0; visit(runtime); assert.equal(aliases.length, 0, "The runtime cannot shadow its canonical descriptor helper.");
    const cacheGuard = reads.body!.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node) && node.expression.getText(parsed) === "previous" && node.thenStatement.getText(parsed).startsWith("assert.deepEqual(verificationNativeGate, previous.verificationNativeGate,")); assert.ok(cacheGuard);
    const coverage = reads.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(value => value.name.getText(parsed) === "verificationCoverage")); assert.ok(coverage);
    assert.ok(cacheGuard.pos < coverage.pos); assert.ok(coverage.getText(parsed).includes("localVerificationCoverage(scripts, impact, manifest, request)"));
    return cacheGuard.getText(parsed);
  };
  check("actual runtime and cached coverage consume the same canonical selected native gate", () => {
    const cache = assertNativeOwnerBindings(source);
    const compare = new Function("assert", "previous", "verificationNativeGate", cache);
    compare(assert, { verificationNativeGate: nativePlan.nativeGate }, structuredClone(nativePlan.nativeGate));
    assert.throws(() => compare(assert, { verificationNativeGate: nativePlan.nativeGate }, { ...nativePlan.nativeGate, args: ["--core-closure"] }));
  });
  for (const [name, from, to] of [
    ["parallel runtime helper", "adminAdoptionGate(request)!]", "otherAdoptionGate(request)!]"],
    ["runtime literal duplicate", "adminAdoptionGate(request)!]", "{name:'admin-adoption',script:'scripts/foreign-driver.mjs',args:[],limitMs:900000}]"],
    ["runtime helper shadow", "const heroGate =", "const adminAdoptionGate = otherAdoptionGate; const heroGate ="],
    ["cached descriptor assertion removed", "if (previous) assert.deepEqual(verificationNativeGate, previous.verificationNativeGate,", "if (false) assert.deepEqual(verificationNativeGate, previous.verificationNativeGate,"],
    ["request dropped from coverage", "localVerificationCoverage(scripts, impact, manifest, request)", "localVerificationCoverage(scripts, impact, manifest)"],
  ] as const) check("native binding source rejects " + name, () => {
    const mutant = source.replace(from, to); assert.notEqual(mutant, source); assert.throws(() => assertNativeOwnerBindings(mutant));
  });
  for (const name of ["sql/migrations/20261022000000_review.sql", "src/lib/admin/auth/session.ts", "src/lib/admin/permissions/access.ts",
    ".github/workflows/quality-gate.yml", "package-lock.json", "next.config.ts", "scripts/lib/isolated-public-verification.mts",
    "scripts/lib/typescript-executable-graph.mts", "scripts/verify-isolated-supabase.mts"]) {
    requiresFull("low-risk label cannot override protected path " + name, value => {
      value.impact.changes[0].file = name; value.actual.changes[0].file = name;
    });
  }
  for (const name of ["scripts/verify-admin-core-residual-search.mjs", "scripts/fixtures/admin-core-residual-search.mjs"]) {
    rejects("changed Test/Guard/Fixture cannot omit its fresh covering check: " + name, value => {
      value.impact.changes[0].file = name; value.actual.changes[0].file = name; value.impact.changes[0].checks = [];
    });
    rejects("changed Test/Guard/Fixture cannot substitute lint-only evidence: " + name, value => {
      value.impact.changes[0].file = name; value.actual.changes[0].file = name; value.impact.changes[0].checks = ["lint"];
    });
    requiresFull("changed Test/Guard/Fixture cannot substitute an unrelated real check: " + name, value => {
      value.impact.changes[0].file = name; value.actual.changes[0].file = name; value.impact.changes[0].checks = ["verify:dashboard-truth"];
    });
    check("actual executable graph proves the selected fresh guard reaches " + name, () => {
      const value = fixture(); value.impact.changes[0].file = name; value.actual.changes[0].file = name;
      value.impact.changes[0].owner = "scripts/verify-admin-core-residual-search.mjs";
      value.impact.changes[0].contracts = ["scripts/fixtures/admin-core-residual-search.mjs"];
      value.impact.changes[0].consumers = ["scripts/verify-admin-core-residual-search.mjs"];
      value.impact.changes[0].checks = ["verify:admin-core-residual-search"];
      value.impact.verificationEntries = [{ check: "verify:admin-core-residual-search", entry: "scripts/verify-admin-core-residual-search.mjs" }];
      value.actual.verificationCoverage = api.localVerificationCoverage(scripts, value.impact,
        [{ file: "scripts/verify-admin-core-residual-search.mjs", sha256: sha256(readSource("scripts/verify-admin-core-residual-search.mjs")) }]);
      assert.ok(value.actual.verificationCoverage.some(row => row.file === name && row.checks.includes("verify:admin-core-residual-search")));
      const plan = run(value); assert.equal(plan.mode, "bounded"); assert.ok(plan.prefix.includes("verify:admin-core-residual-search"));
    });
  }
  check("literal registered npm chains expose their actual Node entries recursively without executing or duplicating leaves", () => {
    const entry = "scripts/verify-admin-core-residual-search.mjs";
    const commands = { ...scripts,
      "verify:coverage-parent": "npm run verify:coverage-middle && node " + entry + " --literal=boundary",
      "verify:coverage-middle": "npm run verify:admin-core-residual-search" };
    assert.deepEqual(api.localVerificationCommandSteps(commands, "verify:coverage-parent"),
      [scripts["verify:admin-core-residual-search"], "node " + entry + " --literal=boundary"]);
    assert.deepEqual(api.registeredVerificationNodeEntries(commands, "verify:coverage-parent"), [entry]);
    assert.ok(api.registeredVerificationNodeEntries(scripts, "verify:admin-runtime").includes("scripts/verify-page-block-editor-presentation.mts"),
      "The actual current Admin aggregate positively reaches its registered nested Page Block guard.");
  });
  check("registered command consolidation rejects inherited root and recursive child commands before granting entry coverage", () => {
    const entry = "scripts/verify-admin-core-residual-search.mjs", leaf = "node " + entry;
    const inherited = { "verify:coverage-prototype": leaf };
    const own = (values: Record<string, string>) => Object.assign(Object.create(inherited) as Record<string, string>, values);
    for (const [commands, name] of [
      [own({}), "verify:coverage-prototype"],
      [own({ "verify:coverage-parent": "npm run verify:coverage-prototype" }), "verify:coverage-parent"],
      [own({ "verify:coverage-parent": leaf + " && npm run verify:coverage-prototype" }), "verify:coverage-parent"],
      [own({ "verify:coverage-parent": "npm run verify:coverage-middle", "verify:coverage-middle": "npm run verify:coverage-prototype" }), "verify:coverage-parent"],
    ] as const) {
      assert.equal(api.localVerificationCommandSteps(commands, name), undefined);
      assert.throws(() => api.registeredVerificationNodeEntries(commands, name));
    }
    const commands = Object.assign(Object.create(null) as Record<string, string>, {
      "verify:coverage-parent": "npm run verify:coverage-middle", "verify:coverage-middle": leaf,
    });
    assert.deepEqual(api.localVerificationCommandSteps(commands, "verify:coverage-parent"), [leaf]);
    assert.deepEqual(api.registeredVerificationNodeEntries(commands, "verify:coverage-parent"), [entry]);
  });
  check("literal command ownership requires a valid own string at every recursive boundary", () => {
    const leaf = "node scripts/verify-admin-core-residual-search.mjs";
    for (const invalid of [undefined, null, 17, true, [], {}, () => leaf]) {
      const commands = { "verify:coverage-parent": "npm run verify:coverage-middle", "verify:coverage-middle": invalid } as unknown as Record<string, string>;
      assert.equal(api.localVerificationCommandSteps(commands, "verify:coverage-middle"), undefined);
      assert.equal(api.localVerificationCommandSteps(commands, "verify:coverage-parent"), undefined);
      assert.throws(() => api.registeredVerificationNodeEntries(commands, "verify:coverage-middle"));
      assert.throws(() => api.registeredVerificationNodeEntries(commands, "verify:coverage-parent"));
    }
    for (const invalid of ["", "verify:invalid name", "../verify:parent", "verify:parent\nchild", "verify:parent\rchild"]) {
      const commands = { [invalid]: leaf };
      assert.equal(api.localVerificationCommandSteps(commands, invalid), undefined);
      assert.throws(() => api.registeredVerificationNodeEntries(commands, invalid));
    }
  });
  check("removing the actual registered-entry assertion admits a private path and is detected by the unchanged negative boundary", () => {
    const registration = ts.createSourceFile("registration.mts", statement("registeredVerificationNodeEntries"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const guards: ts.ExpressionStatement[] = [];
    const inspect = (node: ts.Node) => {
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(registration) === "assert.ok"
        && node.expression.arguments[0] && ts.isCallExpression(node.expression.arguments[0])
        && node.expression.arguments[0].expression.getText(registration) === "sourceIncluded") guards.push(node);
      ts.forEachChild(node, inspect);
    };
    inspect(registration); assert.equal(guards.length, 1);
    const transformed = ts.transform(registration, [context => {
      const visit: ts.Visitor = node => node === guards[0] ? undefined : ts.visitEachChild(node, visit, context);
      return node => ts.visitNode(node, visit) as ts.SourceFile;
    }]);
    try {
      const mutantSource = ts.createPrinter().printFile(transformed.transformed[0]);
      const removed = new Function("assert", "sourceIncluded", "localVerificationCommandSteps",
        ts.transpileModule(mutantSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return registeredVerificationNodeEntries;")(
        assert, sourceIncluded, api.localVerificationCommandSteps) as typeof api.registeredVerificationNodeEntries;
      const commands = { "verify:private-control": "node scripts/../private/coverage.mjs" };
      assert.throws(() => api.registeredVerificationNodeEntries(commands, "verify:private-control"));
      assert.deepEqual(removed(commands, "verify:private-control"), ["scripts/../private/coverage.mjs"]);
    } finally { transformed.dispose(); }
  });
  check("canonical parent coverage retains its parent key and the complete existing full prefix without appending nested execution", () => {
    const value = fixture(), entry = "scripts/verify-admin-core-residual-search.mjs", changed = "scripts/fixtures/admin-core-residual-search.mjs";
    value.impact.changes[0].file = changed; value.actual.changes[0].file = changed;
    value.impact.changes[0].risk = "E"; value.impact.changes[0].checks = ["verify:admin-core-closure"];
    value.impact.verificationEntries = [{ check: "verify:admin-core-closure", entry }];
    value.actual.verificationCoverage = api.localVerificationCoverage(scripts, value.impact,
      [{ file: entry, sha256: sha256(readSource(entry)) }]);
    assert.deepEqual(value.actual.verificationCoverage.find(row => row.file === changed)?.checks, ["verify:admin-core-closure"]);
    const plan = run(value); assert.equal(plan.mode, "full"); assert.deepEqual(plan.prefix, fullPrefix);
    assert.ok(!plan.prefix.includes("verify:admin-core-residual-search"), "Coverage discovery cannot add a duplicate child command to execution.");
    api.assertLocalVerificationRequest({ localVerification: value.impact, finalQualityGate: true, selection: "admin-adoption", adoptionScope: "core-closure" }, plan);
  });
  const coverageEntry = "scripts/verify-admin-core-residual-search.mjs";
  const unsafeChains: Array<{ name: string; command: string; child?: string }> = [
    { name: "missing child", command: "npm run verify:coverage-missing" },
    { name: "self cycle", command: "npm run verify:coverage-parent" },
    { name: "nested cycle", command: "npm run verify:coverage-child", child: "npm run verify:coverage-parent" },
    { name: "wrapper arguments", command: "npm run verify:admin-core-residual-search -- --candidate" },
    { name: "wrapper options", command: "npm run --silent verify:admin-core-residual-search" },
    { name: "environment wrapper", command: "NODE_OPTIONS=unsafe node " + coverageEntry },
    { name: "environment Node option", command: "node --env-file=.env.local " + coverageEntry },
    { name: "dynamic npm command", command: "npm run ${CHECK_NAME}" },
    { name: "shell substitution", command: "node " + coverageEntry + " $(echo unsafe)" },
    { name: "shell continuation", command: "node " + coverageEntry + "; echo unsafe" },
    { name: "pipe", command: "node " + coverageEntry + " | cat" },
    { name: "failure fallback", command: "node " + coverageEntry + " || echo skipped" },
    { name: "background execution", command: "node " + coverageEntry + " & echo skipped" },
    { name: "redirection", command: "node " + coverageEntry + " > result.log" },
    { name: "newline", command: "node " + coverageEntry + "\necho unsafe" },
    { name: "carriage return", command: "node " + coverageEntry + "\recho unsafe" },
    { name: "empty chain step", command: "node " + coverageEntry + " && " },
    { name: "private path", command: "node scripts/../private/coverage.mjs" },
    { name: "valid match cannot conceal invalid sibling", command: "node " + coverageEntry + " && echo skipped" },
  ];
  for (const probe of unsafeChains) check("registered coverage rejects " + probe.name, () => {
    const commands = { ...scripts, "verify:coverage-parent": probe.command,
      ...(probe.child ? { "verify:coverage-child": probe.child } : {}) };
    if (probe.name !== "private path") assert.equal(api.localVerificationCommandSteps(commands, "verify:coverage-parent"), undefined);
    assert.throws(() => api.registeredVerificationNodeEntries(commands, "verify:coverage-parent"));
  });
  check("registered coverage rejects a missing root command and unresolved executable graphs after valid wrapper reachability", () => {
    assert.throws(() => api.registeredVerificationNodeEntries(scripts, "verify:coverage-missing"));
    const value = fixture(); value.impact.changes[0].checks = ["verify:admin-core-closure"];
    value.impact.verificationEntries = [{ check: "verify:admin-core-closure", entry: coverageEntry }];
    const unresolved = new Function("assert", "sourceIncluded", "collectExecutableSourceGraph", "ROOT", "readFileSync", "safeSourcePath", code + ";return localVerificationCoverage;")(
      assert, sourceIncluded, () => { throw Error("Unresolved executable source edge"); }, root, () => "current bound source", (name: string) => name) as typeof api.localVerificationCoverage;
    assert.throws(() => unresolved(scripts, value.impact, [{ file: coverageEntry, sha256: "a".repeat(64) }]), /Unresolved executable source edge/u);
  });
  check("verification coverage rejects an entry not registered by its claimed package command", () => {
    const value = fixture(); value.impact.verificationEntries = [{ check: "verify:dashboard-truth", entry: "scripts/verify-admin-core-residual-search.mjs" }];
    assert.throws(() => api.localVerificationCoverage(scripts, value.impact, [{ file: "scripts/verify-admin-core-residual-search.mjs", sha256: "a".repeat(64) }]));
  });
  check("verification coverage rejects an entry absent from the bound snapshot", () => {
    const value = fixture(); value.impact.changes[0].checks = ["verify:admin-core-residual-search"];
    value.impact.verificationEntries = [{ check: "verify:admin-core-residual-search", entry: "scripts/verify-admin-core-residual-search.mjs" }];
    assert.throws(() => api.localVerificationCoverage(scripts, value.impact, []));
  });
  check("an unrelated registered graph provides no credit for a changed fixture", () => {
    const value = fixture(), name = "scripts/fixtures/admin-core-residual-search.mjs";
    value.impact.changes[0].file = name; value.actual.changes[0].file = name;
    value.impact.verificationEntries = [{ check: "verify:dashboard-truth", entry: "scripts/verify-dashboard-truth-closure.mts" }];
    value.actual.verificationCoverage = api.localVerificationCoverage(scripts, value.impact,
      [{ file: "scripts/verify-dashboard-truth-closure.mts", sha256: sha256(readSource("scripts/verify-dashboard-truth-closure.mts")) }]);
    assert.equal(run(value).mode, "full");
  });
  check("an unresolved changed fixture cannot borrow a Full Gate admission as executable proof", () => {
    const value = fixture(), changed = "scripts/fixtures/admin-core-residual-search.mjs";
    value.impact.changes[0].file = changed; value.actual.changes[0].file = changed;
    value.actual.verificationCoverage = [{ file: changed, checks: [] }];
    const plan = run(value); assert.equal(plan.mode, "full"); assert.ok(plan.unresolvedVerificationInputs?.includes(changed));
    assert.throws(() => api.assertLocalVerificationRequest({ localVerification: value.impact, finalQualityGate: true,
      selection: "admin-adoption", adoptionScope: "core-closure" }, plan));
  });
  check("future verification inputs require positive reachability rather than a fixed fixture allowlist", () => {
    const value = fixture(), entry = "scripts/verify-future-owner-coverage.mts", changed = "scripts/fixtures/future-owner-specific-case.mts";
    const commandScripts = { ...scripts, "verify:future-owner-coverage": "node --experimental-strip-types " + entry };
    value.impact.changes[0].file = changed; value.actual.changes[0].file = changed;
    value.impact.changes[0].checks = ["verify:future-owner-coverage"];
    value.impact.verificationEntries = [{ check: "verify:future-owner-coverage", entry }];
    const graphPort = ({ entrySourceFiles }: { entrySourceFiles: string[] }) => { assert.deepEqual(entrySourceFiles, [entry]); return new Map([[entry, {}], [changed, {}]]); };
    const controlled = new Function("assert", "sourceIncluded", "collectExecutableSourceGraph", "ROOT", "readFileSync", "safeSourcePath", code + ";return localVerificationCoverage;")(
      assert, sourceIncluded, graphPort, root, () => "controlled future source", (name: string) => name) as typeof api.localVerificationCoverage;
    value.actual.verificationCoverage = controlled(commandScripts, value.impact, [{ file: entry, sha256: "a".repeat(64) }]);
    assert.equal(api.planLocalVerification(commandScripts, value.impact, value.actual).mode, "bounded");
    value.actual.verificationCoverage = [{ file: changed, checks: [] }];
    assert.equal(api.planLocalVerification(commandScripts, value.impact, value.actual).mode, "full");
  });
  rejects("invalid byte hash", value => { value.impact.changes[0].beforeSha256 = "not-a-hash"; value.actual.changes[0].beforeSha256 = "not-a-hash"; });
  rejects("unchanged byte identity labelled as a delta", value => { value.impact.changes[0].afterSha256 = value.impact.changes[0].beforeSha256; value.actual.changes[0].afterSha256 = value.actual.changes[0].beforeSha256; });
  rejects("private/generated file admission", value => { value.impact.changes[0].file = ".tmp-qa/private-source.ts"; value.actual.changes[0].file = ".tmp-qa/private-source.ts"; });
  return boundedPlan;
}

/** Execute the existing driver/report/finally slices with controlled child and filesystem ports. */
async function verifyLocalRiskExecutionControls(prefix: readonly string[], executionOnly = false) {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const run = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification") as ts.FunctionDeclaration;
  assert.ok(run?.body);
  const body = run.body.statements.find(ts.isTryStatement); assert.ok(body?.finallyBlock && body.catchClause);
  const declaration = (name: string, nodes: ts.NodeArray<ts.Statement>) => {
    const result = nodes.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === name));
    assert.ok(result, "Missing canonical execution declaration: " + name); return result.getText(file);
  };
  const loop = body.tryBlock.statements.find(node => ts.isForOfStatement(node) && node.expression.getText(file) === "executionGates") as ts.ForOfStatement;
  assert.ok(loop && ts.isBlock(loop.statement));
  const gateStatements = loop.statement.statements;
  const begin = gateStatements.findIndex(node => node.getText(file).startsWith('context.record("public-gate-start"'));
  const end = gateStatements.findIndex(node => ts.isIfStatement(node) && node.expression.getText(file) === 'heroCompatibility && request.finalQualityGate && gate.name === "hero-compatibility"');
  assert.ok(begin >= 0 && end > begin);
  const gates = file.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === "GATES")); assert.ok(gates);
  const deadline = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "localVerificationQualityPrefixDeadlineMs"); assert.ok(deadline);
  const compile = (value: string) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const stageDeclaration = declaration("stageInstalledDependencies", run.body.statements);
  const inspectStageBranch = (source: string) => {
    const parsed = ts.createSourceFile("actual-dependency-branch.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.equal(parsed.statements.length, 1); const branch = parsed.statements[0]; assert.ok(branch && ts.isIfStatement(branch));
    assert.equal(branch.expression.getText(parsed), 'process.platform === "win32"');
    assert.ok(ts.isExpressionStatement(branch.thenStatement) && ts.isAwaitExpression(branch.thenStatement.expression)
      && ts.isCallExpression(branch.thenStatement.expression.expression));
    const call = branch.thenStatement.expression.expression;
    assert.equal(call.expression.getText(parsed), "stageInstalledDependencies"); assert.equal(call.arguments.length, 0);
    assert.ok(branch.elseStatement && ts.isExpressionStatement(branch.elseStatement));
    assert.equal(branch.elseStatement.getText(parsed), 'symlinkSync(join(ROOT, "node_modules"), join(sourceDirectory, "node_modules"), "junction");');
    return branch.getText(parsed);
  };
  const stageCalls = body.tryBlock.statements.filter(node => ts.isIfStatement(node)
    && node.expression.getText(file) === 'process.platform === "win32"');
  assert.equal(stageCalls.length, 1, "The actual platform branch must stage once on Windows and preserve the original Linux link.");
  const stageBranch = inspectStageBranch(stageCalls[0]!.getText(file));
  const stagePosition = body.tryBlock.statements.indexOf(stageCalls[0]!);
  assert.ok(stagePosition < body.tryBlock.statements.indexOf(loop));
  const qualityPosition = body.tryBlock.statements.findIndex(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(row => row.name.getText(file) === "qualityPrefix"));
  assert.ok(qualityPosition > stagePosition && qualityPosition < body.tryBlock.statements.indexOf(loop));
  const orderedPreparation = body.tryBlock.statements.slice(qualityPosition, body.tryBlock.statements.indexOf(loop)).map(node => node.getText(file)).join("\n");
  const factory = new Function("ports", compile(`return async () => {
    const { assert, ts, join, sep, digest, context, runChild: driverChild, receipt, children, retainedAdmission,
      stopChild, sourceDirectory, realpathSync, rmSync, existsSync, readFileSync, activeLocalVerifications, originalContext, drainControlPulse,
      lstatSync, readdirSync, writeFileSync, mkdirSync, dirname, isAbsolute, ownedPath, registeredVerificationNodeEntries } = ports;
    const request = ports.request ?? {admissionQualification:{baselineHead:"controlled-baseline"}}, heroCompatibility = false, measurement = undefined, ROOT = ports.ROOT ?? "controlled-root";
    const operationalBudget = request.admissionQualification?.operationalBudget;
    const headSha = ports.headSha ?? "controlled-head", localInputs = undefined, signal = ports.signal ?? new AbortController().signal;
    const manifest = ports.manifest ?? [{file:"package.json"},{file:"controlled.mts"}], qualityEnvironment = {};
    const verifySource = ports.verifySource ?? (() => {}), process = ports.process ?? {platform:"win32",execPath:"controlled-node",version:"controlled-version",versions:{v8:"controlled-v8"},execArgv:[]};
    const assertLocalVerificationAdmissionQualification = ports.assertLocalVerificationAdmissionQualification
      ?? (() => ({sourceDiscovery:{changes:[]},sourceFloor:{checks:[]}}));
    const runOwnedVerificationChild = (_ports,args,env,name,limitMs) => driverChild(args,env,name,limitMs);
    ${declaration("nativeArchiveBinding", run.body.statements)}
    nativeArchiveBinding = ports.nativeArchiveBinding;
    ${declaration("closedVerificationChildren", run.body.statements)}
    ${declaration("closedNativeArchiveCandidate", run.body.statements)}
    ${declaration("runChild", run.body.statements)}
    ${declaration("preserveClosedNativeArchives", run.body.statements)}
    const stageInstalledDependencies = ports.stageInstalledDependencies;
    const qualityScripts = ports.prefix, npmCli = "controlled-npm-cli", env = {};
    const reports = [], qualityReports = []; let buildIdSha256 = null, appPort = null, appFailed = false;
    ${declaration("nativeApplications", run.body.statements)}
    ${declaration("stopNativeApplication", run.body.statements)}
    ${declaration("publicFailed", run.body.statements)}
    ${orderedSourceFloorControlSource(file)}
    ${gates.getText(file)}
    const gates = GATES;
    ${declaration("heroGate", run.body.statements)}
    try {
      if (stageInstalledDependencies) { const process = { platform: "win32" }; ${stageBranch} }
      ${orderedPreparation}
      for (${loop.initializer.getText(file)} of executionGates) {
        ${declaration("gate", gateStatements)}
        const gateApp = undefined;
        ${gateStatements.slice(begin, end).map(node => node.getText(file)).join("\n")}
      }
    } ${body.catchClause.getText(file)} finally ${body.finallyBlock.getText(file)}
    return { reports, qualityReports, buildIdSha256 };
  };`)) as (ports: Record<string, unknown>) => () => Promise<{ reports: Array<{ name: string; code: number }>; qualityReports: Array<{ script: string; code: number }> }>;
  const fixture = (options: { failedChild?: string; driverFailure?: Error; skippedE2E?: boolean; failedCleanup?: boolean; failedWorker?: boolean;
    stageInstalledDependencies?: () => Promise<void>; operationalBudget?: import("./lib/isolated-public-verification.mts").LocalVerificationOperationalBudget } = {}) => {
    const events: string[] = [], launched: string[] = [], budgets: Array<{ name: string; limitMs: number }> = [], receipts: Array<{ name: string; value: Record<string, unknown> }> = [];
    let removed = false, stopped = false, workerStopped = false;
    const sourceDirectory = path.join("owned", "source");
    const retainedAdmission = { get workerStopped() { return workerStopped; }, async close() {
      await Promise.resolve(); workerStopped = true; events.push("worker-stopped");
      if (options.failedWorker) throw Error("controlled worker cleanup failure");
    } };
    const context = { runDirectory: "owned", sanitize: (value: string) => value, cleanEnvironment: () => ({}), record: (event: string, data: { gate: string }) => events.push(event + ":" + data.gate) };
    const activeLocalVerifications = new WeakSet([context]);
    const ports = { assert, ts, join: path.join, sep: path.sep, digest: sha256, prefix, stageInstalledDependencies: options.stageInstalledDependencies,
      request: { admissionQualification: { baselineHead: "controlled-baseline", operationalBudget: options.operationalBudget } },
      context, originalContext: context, activeLocalVerifications, async drainControlPulse() {},
      async runChild(_args: string[], _env: object, name: string, limitMs: number) {
        launched.push(name); budgets.push({ name, limitMs });
        if (options.failedChild === name && options.driverFailure) throw options.driverFailure;
        const code = options.failedChild === name ? 1 : 0;
        return { code, rawExit: { code, signal: null }, cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true },
          stdout: options.skippedE2E && name === "public-e2e" ? "1 skipped\n" : "", stderr: "" };
      },
      receipt: (_context: unknown, name: string, value: Record<string, unknown>) => receipts.push({ name, value }),
      children: new Set([{}]), retainedAdmission,
      async stopChild() { await Promise.resolve(); stopped = true; events.push("child-stopped"); if (options.failedCleanup) throw Error("controlled child cleanup failure"); },
      sourceDirectory, realpathSync: (value: string) => value,
      rmSync: (value: string, settings: unknown) => { assert.equal(value, sourceDirectory); assert.deepEqual(settings, { recursive: true, force: false }); removed = true; events.push("workspace-removed"); },
      existsSync: (value: string) => { assert.equal(value, sourceDirectory); return !removed; },
      readFileSync: (value: string) => {
        if (value === path.join(sourceDirectory, "package.json")) return Buffer.from(JSON.stringify({ scripts: { lint: "eslint --max-warnings=0", typecheck: "tsc --noEmit" } }));
        if (value === path.join(sourceDirectory, "controlled.mts")) return Buffer.from("export const controlled = true;");
        assert.equal(value, path.join(sourceDirectory, ".next/BUILD_ID")); return Buffer.from("controlled-build-id");
      },
    };
    return { execute: factory(ports), events, launched, budgets, receipts, stopped: () => stopped, workerStopped: () => workerStopped, removed: () => removed,
      active: () => activeLocalVerifications.has(context) };
  };
  const control = async (name: string, operation: () => Promise<void>) => { await operation(); cases.push(name); };
  await control("bounded prefix and every canonical Public tail use the unchanged generic driver and awaited cleanup", async () => {
    const value = fixture(), result = await value.execute();
    assert.deepEqual(result.qualityReports.map(row => row.script), ["lint", "typecheck", "verify:dashboard-truth"]);
    assert.deepEqual(result.reports.map(row => row.name), ["normal-build", "product-surface-build", "platform-contracts", "public-e2e"]);
    assert.ok(value.stopped() && value.workerStopped() && value.removed()); assert.equal(value.active(), false);
    const cleanup = value.receipts.find(row => row.name === "public-process-cleanup.json"); assert.ok(cleanup);
    assert.deepEqual(cleanup.value, { ownedProcessesStopped: true, loopbackPortReleased: true, buildWorkspaceRemoved: true,
      otherResourcesTouched: false, retainedEvidenceWorkerStopped: true });
  });
  await control("actual execution mapping doubles scoped external prefix and Public tails once without changing default descriptors", async () => {
    const normal = fixture(), expanded = fixture({ operationalBudget: "pr229-20261103-double-operational" });
    await normal.execute(); await expanded.execute();
    assert.deepEqual(expanded.budgets, normal.budgets.map(row => ({ name: row.name, limitMs: row.limitMs * 2 })));
    assert.deepEqual(normal.budgets.slice(-4).map(row => row.limitMs), [900_000, 180_000, 180_000, 600_000]);
    assert.ok(normal.stopped() && expanded.stopped() && normal.removed() && expanded.removed());
  });
  await control("a failed affected check aborts later checks and Public gates while awaiting original cleanup", async () => {
    const value = fixture({ failedChild: "quality-2-typecheck" });
    await assert.rejects(value.execute(), /Ordered typescript check failed; dependent verification was not started/u);
    assert.deepEqual(value.launched, ["quality-1-lint", "quality-2-typecheck"]);
    assert.ok(value.stopped() && value.workerStopped() && value.removed()); assert.equal(value.active(), false);
    assert.equal(value.events.includes("public-gate-pass:quality-2-typecheck"), false);
  });
  await control("a failed Public gate propagates and prevents later Public gates without bypassing cleanup", async () => {
    const value = fixture({ failedChild: "product-surface-build" });
    await assert.rejects(value.execute(), /Required Public gate failed: product-surface-build/u);
    assert.equal(value.launched.includes("platform-contracts"), false); assert.equal(value.launched.includes("public-e2e"), false);
    assert.ok(value.stopped() && value.workerStopped() && value.removed()); assert.equal(value.active(), false);
  });
  await control("bounded verification still rejects skipped Public E2E coverage", async () => {
    const value = fixture({ skippedE2E: true }); await assert.rejects(value.execute(), /Public E2E skipped\/flaky coverage cannot pass/u);
    assert.ok(value.stopped() && value.workerStopped() && value.removed()); assert.equal(value.active(), false);
  });
  await control("failed owned-child cleanup cannot become a successful bounded result", async () => {
    const value = fixture({ failedCleanup: true }); await assert.rejects(value.execute(), /owned Public process could not be stopped/u);
    assert.ok(value.stopped() && value.workerStopped()); assert.equal(value.active(), false);
    assert.equal(value.receipts.some(row => row.name === "public-process-cleanup.json"), false);
  });
  await control("retained worker cleanup rejection remains fatal after owned workspace removal", async () => {
    const value = fixture({ failedWorker: true }); await assert.rejects(value.execute(), /controlled worker cleanup failure/u);
    assert.ok(value.stopped() && value.workerStopped() && value.removed()); assert.equal(value.active(), false);
  });
  await control("actual outer catch and finally preserve the first driver error when subsequent owned cleanup rejects", async () => {
    const original = Error("controlled first driver failure");
    const value = fixture({ failedChild: "quality-2-typecheck", driverFailure: original, failedCleanup: true });
    await assert.rejects(value.execute(), error => error === original);
    assert.deepEqual(value.launched, ["quality-1-lint", "quality-2-typecheck"]);
    assert.ok(value.stopped() && value.workerStopped()); assert.equal(value.active(), false);
    const secondary = Object.getOwnPropertyDescriptor(original, "publicCleanupFailure");
    assert.ok(secondary?.value instanceof Error); assert.match(secondary.value.message, /owned Public process could not be stopped/u);
    assert.equal(secondary.enumerable, false);
    assert.equal(value.receipts.some(row => row.name === "public-process-cleanup.json"), false);
  });
  await control("actual closed-child capture retains exact success nonzero timeout and cancellation outcomes without granting a gate", async () => {
    const capture = new Function("ports", compile(`const {digest,runOwnedVerificationChild,sourceDirectory,context,children,signal,process,join}=ports;
      ${declaration("nativeArchiveBinding", run.body!.statements)}
      nativeArchiveBinding=ports.binding;
      ${declaration("closedVerificationChildren", run.body!.statements)}
      ${declaration("closedNativeArchiveCandidate", run.body!.statements)}
      ${declaration("runChild", run.body!.statements)}
      return {runChild,closedVerificationChildren};`)) as (ports: Record<string, unknown>) => {
        runChild: (args: string[], env: object, name: string, limitMs: number) => Promise<unknown>;
        closedVerificationChildren: Array<{ name: string; args: string[]; commandSha256: string; binding: unknown; result: unknown }>;
      };
    const binding = Object.freeze({ controlledPrivateBinding: true });
    for (const reason of ["completed", "nonzero_exit", "timeout", "cancelled"] as const) {
      const result = { code: reason === "completed" ? 0 : 1, reason, stderr: reason === "completed" ? "controlled closed stream"
        : '{"ownedNativeEvidenceDirectory":"controlled-unread-archive","retainedFiles":0}' };
      const original = Error("Controlled original " + reason);
      if (reason === "timeout" || reason === "cancelled") Object.defineProperty(original, "childResult", { value: result });
      const value = capture({ digest: sha256, binding, sourceDirectory: "controlled-source", context: {}, children: new Set(), signal: new AbortController().signal, process: { platform: "win32" }, join: path.join,
        async runOwnedVerificationChild() { if (reason === "timeout" || reason === "cancelled") throw original; return result; } });
      const args = ["controlled-npm-cli", "run", "verify:admin-runtime"], expected = [...args];
      if (reason === "timeout" || reason === "cancelled") await assert.rejects(value.runChild(args, {}, "quality-57-verify-admin-runtime", 1_800_000), error => error === original);
      else assert.equal(await value.runChild(args, {}, "quality-57-verify-admin-runtime", 1_800_000), result);
      args.push("changed-after-settlement");
      assert.equal(value.closedVerificationChildren.length, 1);
      const row = value.closedVerificationChildren[0]!; assert.equal(row.result, result); assert.equal(row.binding, binding);
      assert.deepEqual(row.args, expected); assert.equal(row.commandSha256, sha256(JSON.stringify(expected)));
      assert.equal(Object.hasOwn(row, "gatePassClaimed"), false);
    }
    const largeResult = { code: 0, stdout: "unrelated large Public output\n".repeat(100_000), stderr: "unrelated warnings\n".repeat(100_000) };
    const unrelated = capture({ digest: sha256, binding, sourceDirectory: "controlled-source", context: {}, children: new Set(), signal: new AbortController().signal,
      process: { platform: "win32" }, join: path.join, async runOwnedVerificationChild() { return largeResult; } });
    assert.equal(await unrelated.runChild(["controlled-next-cli", "build"], {}, "normal-build", 900_000), largeResult);
    assert.equal(unrelated.closedVerificationChildren.length, 0, "Unrelated large streams cannot accumulate in the private archive capture.");
    const original = Object.freeze(Error("Controlled failure before any closed result"));
    const value = capture({ digest: sha256, binding, sourceDirectory: "controlled-source", context: {}, children: new Set(), signal: new AbortController().signal, process: { platform: "win32" }, join: path.join,
      async runOwnedVerificationChild() { throw original; } });
    await assert.rejects(value.runChild([], {}, "controlled-unsettled", 1_800_000), error => error === original);
    assert.equal(value.closedVerificationChildren.length, 0);
  });
  await control("actual Public finally closes children before preservation and preserves before workspace deletion", async () => {
    const cleanup = body.finallyBlock!.getText(file), close = cleanup.indexOf("await Promise.all("), preserve = cleanup.indexOf("await preserveClosedNativeArchives()"), remove = cleanup.indexOf("rmSync(sourceDirectory");
    assert.ok(close >= 0 && preserve > close && remove > preserve);
    assert.equal(cleanup.match(/await preserveClosedNativeArchives\(\)/gu)?.length, 1);
    const value = fixture(); await value.execute();
    assert.ok(value.events.indexOf("child-stopped") < value.events.indexOf("workspace-removed"));
    assert.ok(value.events.indexOf("worker-stopped") < value.events.indexOf("workspace-removed"));
    assert.equal(value.receipts.some(row => row.name === "public-native-evidence-preservation.json"), false,
      "No captured producer or declaration is not fabricated as preservation success.");
  });
  if (executionOnly) return;
  // Actual owner declarations with controlled file/child ports only; these fixtures never grant live Admission or OS Native authority.
  const commandEntries = new Function("assert", "sourceIncluded", compile(["localVerificationCommandSteps", "registeredVerificationNodeEntries"].map(name => {
    const node = file.statements.find(row => ts.isFunctionDeclaration(row) && row.name?.text === name); assert.ok(node);
    return node.getText(file).replace(/^export /u, "");
  }).join("\n")) + ";return registeredVerificationNodeEntries;")(assert, sourceIncluded) as
    (scripts: Record<string, string>, check: string) => string[];
  const buildPreservation = new Function("ports", compile(`const {assert,digest,receipt,lstatSync,realpathSync,readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync,
    join,dirname,isAbsolute,sep,ROOT,process,sourceDirectory,ownedPath,context,request,manifest,verifySource,drainControlPulse,registeredVerificationNodeEntries,assertLocalVerificationAdmissionQualification}=ports;
    ${declaration("nativeArchiveBinding", run.body.statements)}
    nativeArchiveBinding=ports.nativeArchiveBinding;
    ${declaration("closedVerificationChildren", run.body.statements)}
    closedVerificationChildren.push(...ports.closed);
    ${declaration("preserveClosedNativeArchives", run.body.statements)}
    return preserveClosedNativeArchives;`)) as (ports: Record<string, unknown>) => () => Promise<void>;
  type ArchiveFault = "missing-binding" | "cloned-child-binding" | "command-mismatch" | "stderr-mismatch" | "native-receipt-mismatch"
    | "native-exit-mismatch" | "source-manifest-mismatch" | "source-sha-mismatch" | "runtime-mismatch" | "project-lock-mismatch" | "installed-lock-mismatch"
    | "missing-declaration" | "malformed-declaration" | "duplicate-declaration" | "missing-archive" | "path-escape" | "link" | "hard-link"
    | "malformed-index" | "index-hash" | "index-membership" | "index-path" | "index-cleanup" | "archive-mutation" | "destination-mutation" | "existing-copy" | "private-io-failure";
  const archiveFixture = async (options: { outcome?: "completed" | "nonzero_exit" | "timeout" | "cancelled"; fault?: ArchiveFault; omitDeclaration?: boolean;
    drainControlPulse?: (phase?: "archive-preservation") => Promise<void>; sourceFailure?: Error; cleanupFailure?: Error } = {}) => {
    const directory = realpathSync(mkdtempSync(path.join(root, ".tmp-qa", "native-archive-preservation-controls-")));
    const installation = path.join(directory, "installation"), runDirectory = path.join(directory, "run"), workspace = path.join(runDirectory, "public-build-source");
    const temporary = path.join(workspace, ".tmp-qa"), originalRoot = path.join(temporary, "owned-process-controls-controlled"), preservedRoot = path.join(runDirectory, "native-archives-preserved", path.basename(originalRoot));
    for (const at of [installation, path.join(installation, "node_modules"), runDirectory, workspace, temporary, originalRoot, path.join(originalRoot, "empty"), path.join(originalRoot, "nested"), path.join(workspace, ".next")]) mkdirSync(at);
    const packageBytes = JSON.stringify({ scripts: { lint: "eslint --max-warnings=0", typecheck: "tsc --noEmit", "verify:admin-runtime": "node --experimental-strip-types scripts/verify-isolated-supabase.mts" } });
    const lock = "controlled project and installed lock\n", controlled = "export const controlled = true;\n";
    writeFileSync(path.join(workspace, "package.json"), packageBytes); writeFileSync(path.join(workspace, "controlled.mts"), controlled);
    writeFileSync(path.join(workspace, "package-lock.json"), lock); writeFileSync(path.join(workspace, ".next/BUILD_ID"), "controlled-build-id");
    writeFileSync(path.join(installation, "package-lock.json"), lock); writeFileSync(path.join(installation, "node_modules/.package-lock.json"), lock);
    const manifest = [{ file: "package.json", sha256: sha256(packageBytes) }, { file: "controlled.mts", sha256: sha256(controlled) }, { file: "package-lock.json", sha256: sha256(lock) }];
    const headSha = "a".repeat(40), runtime = { projectLockSha256: sha256(lock), installedLockSha256: sha256(lock), controlledRuntime: true };
    const qualification = { baselineHead: "b".repeat(40), finalHead: headSha, sourceSha256: sha256(JSON.stringify(manifest)), runtime };
    const sourceManifestFile = path.join(runDirectory, "public-source-manifest.json");
    writeFileSync(sourceManifestFile, JSON.stringify({ invocationHeadSha: headSha, sourceSha256: qualification.sourceSha256, manifest, privateEnvironmentFilesCopied: false }));
    const binding = Object.freeze({ headSha, sourceSha256: options.fault === "source-sha-mismatch" ? "f".repeat(64) : qualification.sourceSha256,
      sourceManifestSha256: sha256(readFileSync(sourceManifestFile)), runtimeSha256: sha256(JSON.stringify(runtime)), projectLockSha256: runtime.projectLockSha256, installedLockSha256: runtime.installedLockSha256 });
    const negativeBytes = Buffer.from('{"intentionally-invalid-negative":'), binaryBytes = Buffer.from([0, 255, 9, 13, 10]);
    const negativeFile = path.join(originalRoot, "negative-fixture.json"), binaryFile = path.join(originalRoot, "nested/bytes.bin");
    writeFileSync(negativeFile, negativeBytes); writeFileSync(binaryFile, binaryBytes);
    const indexed = [{ file: "negative-fixture.json", sha256: sha256(negativeBytes), bytes: negativeBytes.length }, { file: "nested/bytes.bin", sha256: sha256(binaryBytes), bytes: binaryBytes.length }];
    if (options.fault === "index-hash") indexed[0]!.sha256 = "f".repeat(64);
    if (options.fault === "index-membership") indexed.pop();
    if (options.fault === "index-path") indexed[0]!.file = "../private-file";
    const index = { schema: 1, originalNativeEvidenceRetained: true, finalCleanup: [options.fault === "index-cleanup" ? "rejected" : "fulfilled"], files: indexed };
    writeFileSync(path.join(originalRoot, "evidence-index.json"), options.fault === "malformed-index" ? "{not-json" : JSON.stringify(index));
    const link = path.join(originalRoot, "linked"), foreign = path.join(directory, "foreign");
    if (options.fault === "link") { mkdirSync(foreign); symlinkSync(foreign, link, "junction"); }
    if (options.fault === "hard-link") await asyncFs.link(negativeFile, path.join(directory, "hard-link-peer.json"));
    if (options.fault === "missing-archive") rmSync(originalRoot, { recursive: true, force: false });
    const declaredRoot = options.fault === "path-escape" ? path.join(directory, "outside-owned-source") : originalRoot;
    const declarationLine = options.fault === "malformed-declaration" ? '{"ownedNativeEvidenceDirectory":'
      : JSON.stringify({ ownedNativeEvidenceDirectory: declaredRoot, retainedFiles: 2 });
    const stderr = options.omitDeclaration || options.fault === "missing-declaration" ? "" : declarationLine + "\n" + (options.fault === "duplicate-declaration" ? declarationLine + "\n" : "");
    const outcome = options.outcome ?? "completed", code = outcome === "completed" ? 0 : outcome === "nonzero_exit" ? 1 : 3758096385;
    const name = "quality-3-verify-admin-runtime", identity = { jobToken: "controlled-private-job", rootPid: 4242, rootCreationTimeFileTime: "133000000000000000", ownerJobAssignedBeforeResume: true };
    const native = { ...identity, status: "PASS", reason: outcome === "nonzero_exit" ? "completed" : outcome, rootExitCode: options.fault === "native-exit-mismatch" ? code + 1 : code,
      cleanup: { status: "PASS", processTreeVerified: true, activeProcessesAfterCleanup: 0 } };
    const result = { code, reason: outcome, rawExit: { code, signal: null }, signal: null, stdout: "controlled producer output\n", stderr,
      identity: { pid: identity.rootPid }, nativeJobIdentity: identity, nativeJobReceipt: native,
      cleanup: { status: "PASS", processTreeVerified: true, liveProcesses: 0 } };
    for (const [suffix, value] of [["native-identity", identity], ["native-result", native]] as const) writeFileSync(path.join(runDirectory, `public-${name}.${suffix}.json`), JSON.stringify(value));
    const stdoutFile = path.join(runDirectory, `public-${name}.stdout.log`), stderrFile = path.join(runDirectory, `public-${name}.stderr.log`);
    writeFileSync(stdoutFile, result.stdout); writeFileSync(stderrFile, options.fault === "stderr-mismatch" ? "changed closed stderr" : stderr);
    if (options.fault === "native-receipt-mismatch") writeFileSync(path.join(runDirectory, `public-${name}.native-result.json`), JSON.stringify({ ...native, rootPid: 9999 }));
    if (options.fault === "source-manifest-mismatch") writeFileSync(sourceManifestFile, "changed source receipt");
    if (options.fault === "runtime-mismatch") (runtime as Record<string, unknown>).changed = true;
    if (options.fault === "project-lock-mismatch") writeFileSync(path.join(installation, "package-lock.json"), "changed project lock");
    if (options.fault === "installed-lock-mismatch") writeFileSync(path.join(installation, "node_modules/.package-lock.json"), "changed installed lock");
    if (options.fault === "existing-copy") { mkdirSync(path.dirname(preservedRoot)); mkdirSync(preservedRoot); writeFileSync(path.join(preservedRoot, "sentinel"), "earlier raw evidence"); }
    const original = Error("Controlled original producer " + outcome), privateMessage = "PRIVATE_CONTROLLED_ERROR_MUST_NOT_BE_PROJECTED";
    const privateFailure = Object.assign(Error(privateMessage), { code: "PRIVATE ERROR CODE WITH SPACES" });
    if (outcome === "timeout" || outcome === "cancelled") Object.defineProperty(original, "childResult", { value: result });
    const args = ["controlled-npm-cli", "run", "verify:admin-runtime"];
    const closed = [{ name, args, commandSha256: options.fault === "command-mismatch" ? "f".repeat(64) : sha256(JSON.stringify(args)),
      binding: options.fault === "cloned-child-binding" ? { ...binding } : binding, result }];
    const events: string[] = [], receipts: Array<{ name: string; value: Record<string, unknown> }> = [];
    let removed = false, workerStopped = false, childStopped = false, preservationStarted = false, sourceReads = 0, qualificationChecks = 0, sourceChecks = 0;
    const context = { runDirectory, sanitize: (value: string) => value, cleanEnvironment: () => ({}), record: (event: string, data: { gate?: string }) => events.push(event + ":" + (data.gate ?? "")) };
    const retainedAdmission = { get workerStopped() { return workerStopped; }, async close() {
      await Promise.resolve(); workerStopped = true; events.push("worker-stopped"); if (options.cleanupFailure) throw options.cleanupFailure;
    } };
    const ports = { assert, ts, join: path.join, dirname: path.dirname, isAbsolute: path.isAbsolute, sep: path.sep, digest: sha256, ROOT: installation,
      process: { platform: "win32", execPath: "controlled-node", version: "controlled-version", versions: { v8: "controlled-v8" }, execArgv: [] },
      sourceDirectory: workspace, context, originalContext: context, activeLocalVerifications: new WeakSet([context]), children: new Set([{}]), retainedAdmission,
      signal: undefined as AbortSignal | undefined,
      request: { admissionQualification: qualification }, headSha, manifest, nativeArchiveBinding: options.fault === "missing-binding" ? undefined : binding, closed,
      prefix: ["lint", "typecheck", "verify:admin-runtime"], registeredVerificationNodeEntries: commandEntries, ownedPath: (_context: unknown, file: string) => path.join(runDirectory, file),
      async drainControlPulse(phase?: "archive-preservation") {
        if (phase === "archive-preservation") { preservationStarted = true; events.push("archive-pulse-wait"); }
        await options.drainControlPulse?.(phase);
        if (phase === "archive-preservation") events.push("archive-pulse-settled");
      },
      verifySource() { sourceChecks++; events.push("source-verified"); if (preservationStarted && options.sourceFailure) throw options.sourceFailure; },
      assertLocalVerificationAdmissionQualification(value: unknown) { assert.equal(value, qualification); qualificationChecks++; return { sourceDiscovery: { changes: [] }, sourceFloor: { checks: [] } }; },
      async runChild(_args: string[], _env: object, gate: string) {
        if (gate === name) { if (outcome === "timeout" || outcome === "cancelled") throw original; return result; }
        return { code: 0, rawExit: { code: 0, signal: null }, cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true }, stdout: "", stderr: "" };
      },
      async stopChild() { await Promise.resolve(); childStopped = true; events.push("child-stopped"); },
      receipt(_context: unknown, file: string, value: Record<string, unknown>) { receipts.push({ name: file, value });
        if (file === "public-native-evidence-preservation.json") { events.push("native-preservation-receipt"); writeFileSync(path.join(runDirectory, file), JSON.stringify(value)); } },
      lstatSync, realpathSync, readdirSync, mkdirSync, existsSync,
      readFileSync(at: string, encoding?: BufferEncoding) {
        if (at.startsWith(originalRoot + path.sep) || at.startsWith(path.join(runDirectory, `public-${name}`))) events.push("native-file-read");
        if (options.fault === "private-io-failure" && at === stdoutFile) throw privateFailure;
        const bytes = encoding ? readFileSync(at, encoding) : readFileSync(at);
        if (options.fault === "archive-mutation" && at === negativeFile && ++sourceReads === 2) writeFileSync(negativeFile, "changed after source read");
        return bytes;
      },
      writeFileSync(at: string, bytes: Uint8Array, settings: { flag: string; mode: number }) {
        writeFileSync(at, bytes, settings);
        if (options.fault === "destination-mutation" && at === path.join(preservedRoot, "negative-fixture.json")) writeFileSync(at, "changed destination bytes");
      },
      rmSync(at: string, settings: unknown) { assert.equal(at, workspace); assert.deepEqual(settings, { recursive: true, force: false }); rmSync(workspace, { recursive: true, force: false }); removed = true; events.push("workspace-removed"); },
    };
    return { execute: factory(ports), preserve: buildPreservation(ports), events, receipts, original, privateFailure, privateMessage, originalRoot, preservedRoot,
      negativeBytes, binaryBytes, directory, workspace, qualificationChecks: () => qualificationChecks, sourceChecks: () => sourceChecks,
      setSignal(signal: AbortSignal) { ports.signal = signal; }, signal: () => ports.signal,
      stopped: () => childStopped && workerStopped, removed: () => removed,
      cleanup() { if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link);
        assert.equal(path.dirname(directory), realpathSync(path.join(root, ".tmp-qa"))); assert.equal(lstatSync(directory).isSymbolicLink(), false);
        rmSync(directory, { recursive: true, force: false }); assert.equal(existsSync(directory), false); } };
  };
  for (const outcome of ["completed", "nonzero_exit", "timeout", "cancelled"] as const) await control("actual pre-delete Native archive preservation retains " + outcome + " without relabeling its gate", async () => {
    const value = await archiveFixture({ outcome });
    try {
      if (outcome === "completed") {
        const result = await value.execute(); assert.deepEqual(result.qualityReports.map(row => row.script), ["lint", "typecheck", "verify:admin-runtime"]);
      } else if (outcome === "nonzero_exit") await assert.rejects(value.execute(), error => error instanceof assert.AssertionError);
      else await assert.rejects(value.execute(), error => error === value.original);
      assert.ok(value.stopped() && value.removed());
      const receipts = value.receipts.filter(row => row.name === "public-native-evidence-preservation.json"); assert.equal(receipts.length, 1);
      const receipt = receipts[0]!.value; assert.equal(receipt.status, "PASS_PRESERVATION_ONLY");
      assert.equal(receipt.qualificationGranted, false); assert.equal(receipt.nativePassClaimed, false);
      assert.equal(receipt.gatePassClaimed, false); assert.equal(receipt.liveAdmissionGranted, false);
      assert.deepEqual(receipt.failures, []); assert.ok(Array.isArray(receipt.archives)); assert.equal(receipt.archives.length, 1);
      const archive = (receipt.archives as Array<Record<string, unknown>>)[0]!;
      assert.equal(archive.status, "PASS_PRESERVATION_ONLY"); assert.equal(archive.qualificationGranted, false); assert.equal(archive.gatePassClaimed, false);
      assert.equal(archive.rawBytesUnmodified, true); assert.equal(archive.completeTreeAndEmptyDirectories, true);
      assert.deepEqual(archive.before, archive.after); assert.deepEqual(archive.before, archive.copied);
      assert.equal(archive.snapshotSha256, sha256(JSON.stringify(archive.before)));
      assert.deepEqual(readFileSync(path.join(value.preservedRoot, "negative-fixture.json")), value.negativeBytes,
        "Intentionally invalid negative JSON is retained as opaque bytes.");
      assert.deepEqual(readFileSync(path.join(value.preservedRoot, "nested/bytes.bin")), value.binaryBytes);
      assert.equal(lstatSync(path.join(value.preservedRoot, "empty")).isDirectory(), true);
      const firstRead = value.events.indexOf("native-file-read"), receiptAt = value.events.indexOf("native-preservation-receipt"), removedAt = value.events.indexOf("workspace-removed");
      assert.ok(firstRead > value.events.indexOf("child-stopped") && firstRead > value.events.indexOf("worker-stopped"));
      assert.ok(receiptAt > firstRead && removedAt > receiptAt);
      assert.ok(value.qualificationChecks() >= 1 && value.sourceChecks() >= 1);
      if (outcome !== "completed") assert.equal(value.events.includes("public-gate-pass:quality-3-verify-admin-runtime"), false);
    } finally { value.cleanup(); }
  });
  for (const fault of ["missing-binding", "cloned-child-binding", "command-mismatch", "stderr-mismatch", "native-receipt-mismatch", "native-exit-mismatch",
    "source-manifest-mismatch", "source-sha-mismatch", "runtime-mismatch", "project-lock-mismatch", "installed-lock-mismatch", "missing-declaration",
    "malformed-declaration", "duplicate-declaration", "missing-archive", "path-escape", "link", "hard-link", "malformed-index", "index-hash", "index-membership",
    "index-path", "index-cleanup", "archive-mutation", "destination-mutation", "existing-copy", "private-io-failure"] as const) {
    await control("actual Native archive preservation rejects " + fault + " without granting execution authority", async () => {
      const value = await archiveFixture({ fault });
      try {
        await assert.rejects(value.preserve(), error => fault === "private-io-failure" ? error === value.privateFailure
          : fault === "missing-archive" ? error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT"
          : fault === "malformed-declaration" || fault === "malformed-index" ? error instanceof SyntaxError : error instanceof assert.AssertionError);
        const receipt = value.receipts.find(row => row.name === "public-native-evidence-preservation.json"); assert.ok(receipt);
        assert.equal(receipt.value.status, "BLOCKED"); assert.equal(receipt.value.qualificationGranted, false); assert.equal(receipt.value.nativePassClaimed, false);
        assert.equal(receipt.value.gatePassClaimed, false); assert.equal(receipt.value.liveAdmissionGranted, false);
        assert.ok(Array.isArray(receipt.value.failures)); assert.equal(receipt.value.failures.length, 1);
        const expectedStage = ["source-manifest-mismatch", "source-sha-mismatch", "runtime-mismatch", "project-lock-mismatch", "installed-lock-mismatch"].includes(fault) ? "source_runtime_binding"
          : fault === "missing-declaration" ? "closed_child_declaration"
          : ["malformed-declaration", "duplicate-declaration", "missing-archive", "path-escape"].includes(fault) ? "declared_archive_path"
          : ["malformed-index", "index-hash", "index-membership", "index-path", "index-cleanup"].includes(fault) ? "archive_index_membership"
          : ["link", "hard-link", "archive-mutation", "destination-mutation", "existing-copy"].includes(fault) ? "raw_archive_copy" : "closed_child_binding";
        assert.equal((receipt.value.failures as Array<{ stage: string }>)[0]!.stage, expectedStage);
        assert.equal(value.receipts.some(row => row.name === "final-quality-gate.json"), false);
        assert.equal(value.events.some(row => row.startsWith("public-gate-pass:")), false);
        if (fault === "existing-copy") assert.equal(readFileSync(path.join(value.preservedRoot, "sentinel"), "utf8"), "earlier raw evidence");
        if (fault === "private-io-failure") {
          const projected = JSON.stringify(receipt.value); assert.equal(projected.includes(value.privateMessage), false);
          assert.equal(projected.includes("PRIVATE ERROR CODE WITH SPACES"), false);
          assert.ok((receipt.value.failures as Array<{ code: unknown }>).every(row => row.code === null));
        }
      } finally { value.cleanup(); }
    });
  }
  await control("Native preservation failure retains the original timed-out child error and completes owned cleanup", async () => {
    const value = await archiveFixture({ outcome: "timeout", fault: "private-io-failure" });
    try {
      await assert.rejects(value.execute(), error => error === value.original);
      assert.ok(value.stopped() && value.removed());
      const secondary = Object.getOwnPropertyDescriptor(value.original, "publicCleanupFailure");
      assert.ok(secondary); assert.equal(secondary.value, value.privateFailure); assert.equal(secondary.enumerable, false);
      const receipt = value.receipts.find(row => row.name === "public-native-evidence-preservation.json"); assert.ok(receipt);
      assert.equal(receipt.value.status, "BLOCKED"); assert.equal(JSON.stringify(receipt.value).includes(value.privateMessage), false);
      assert.equal(value.events.includes("public-gate-pass:quality-3-verify-admin-runtime"), false);
      assert.ok(value.events.indexOf("native-preservation-receipt") < value.events.indexOf("workspace-removed"));
    } finally { value.cleanup(); }
  });
  await control("a producer interrupted before any declaration preserves its original failure without inventing archive evidence", async () => {
    const value = await archiveFixture({ outcome: "timeout", omitDeclaration: true, fault: "missing-binding" });
    try {
      await assert.rejects(value.execute(), error => error === value.original);
      assert.ok(value.stopped() && value.removed());
      assert.equal(value.receipts.some(row => row.name === "public-native-evidence-preservation.json"), false);
      assert.equal(value.events.includes("public-gate-pass:quality-3-verify-admin-runtime"), false);
    } finally { value.cleanup(); }
  });
  const lifecycleTree = ts.createSourceFile("isolated-supabase.mts", readSource("scripts/lib/isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lifecycleMethods: ts.ArrowFunction[] = [];
  const findLifecycleMethod = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(lifecycleTree) === "runPublicVerification" && ts.isArrowFunction(node.initializer)) lifecycleMethods.push(node.initializer);
    ts.forEachChild(node, findLifecycleMethod);
  };
  findLifecycleMethod(lifecycleTree); assert.equal(lifecycleMethods.length, 1);
  const lifecycleMethod = lifecycleMethods[0]!; assert.ok(ts.isBlock(lifecycleMethod.body));
  const lifecycleStatements = lifecycleMethod.body.statements;
  const lifecycleStart = lifecycleStatements.findIndex(node => node.getText(lifecycleTree) === "publicJobAbort = new AbortController();");
  assert.ok(lifecycleStart >= 0); assert.ok(ts.isTryStatement(lifecycleStatements[lifecycleStatements.length - 1]!));
  const buildArchiveLifecycle = new Function("ports", compile(`return async (request) => {
    const {AbortController,setInterval,clearInterval,applicationLease,publicContext,handle,safeRecord,asSafeError,isOwnedLocalVerificationActive,runOwnedPublicVerification}=ports;
    let publicJob,publicJobAbort;
    ${lifecycleStatements.slice(lifecycleStart).map(node => node.getText(lifecycleTree)).join("\n")}
  };`)) as (ports: Record<string, unknown>) => (request: object) => Promise<unknown>;
  const deferredArchivePulse = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
  const archiveLifecycleFixture = async (options: { pending?: boolean; heartbeatFailure?: Error; outcome?: "completed" | "timeout" | "cancelled";
    fault?: ArchiveFault; sourceFailure?: Error; cleanupFailure?: Error } = {}) => {
    const pending = deferredArchivePulse(), entered = deferredArchivePulse(), observed: string[] = [];
    let tick: (() => void) | undefined, controller: AbortController | undefined, drain: ((phase?: "archive-preservation") => Promise<void>) | undefined;
    let timerCleared = false, publicSignal: AbortSignal | undefined;
    const value = await archiveFixture({ ...options, async drainControlPulse(phase) {
      assert.ok(drain);
      if (phase === "archive-preservation") { assert.ok(tick); tick(); entered.resolve(); }
      await drain(phase);
    } });
    const timer = Object.freeze({ controlledTimer: true });
    const execute = buildArchiveLifecycle({
      AbortController: function ControlledAbortController() { controller = new AbortController(); return controller; },
      setInterval(callback: () => void, interval: number) { assert.equal(interval, 20_000); assert.equal(tick, undefined); tick = callback; return timer; },
      clearInterval(value: unknown) { assert.equal(value, timer); timerCleared = true; observed.push("timer-cleared"); },
      applicationLease: { async renewIfDue() { observed.push("pulse-start"); if (options.pending) await pending.promise;
        if (options.heartbeatFailure) throw options.heartbeatFailure; observed.push("pulse-renewed"); } },
      publicContext: { async assertOwned() { observed.push("pulse-owned"); } },
      handle: { async query(query: string) { assert.equal(query, "select 1 as owned_public_job_heartbeat"); observed.push("pulse-query"); } },
      safeRecord(event: string) { observed.push(event); }, asSafeError(error: unknown, stage: string) { assert.equal(stage, "public-job-heartbeat"); return error; },
      isOwnedLocalVerificationActive() { return false; },
      async runOwnedPublicVerification(_context: unknown, _request: unknown, signal: AbortSignal, callback: (phase?: "archive-preservation") => Promise<void>) {
        publicSignal = signal; value.setSignal(signal); drain = callback; return value.execute();
      },
    });
    return { value, observed, entered: entered.promise, release: pending.resolve, execute: () => execute({ selection: "admin-adoption" }),
      timerCleared: () => timerCleared, signal: () => publicSignal,
      cancel() { assert.ok(controller); controller.abort(value.original); },
      async defaultDrain() { assert.ok(drain); await drain(); } };
  };
  const assertArchiveLifecycle = (value: Awaited<ReturnType<typeof archiveLifecycleFixture>>, status: "PASS_PRESERVATION_ONLY" | "BLOCKED") => {
    assert.ok(value.timerCleared() && value.value.stopped() && value.value.removed());
    const receipts = value.value.receipts.filter(row => row.name === "public-native-evidence-preservation.json"); assert.equal(receipts.length, 1);
    assert.equal(receipts[0]!.value.status, status);
    for (const key of ["qualificationGranted", "nativePassClaimed", "gatePassClaimed", "liveAdmissionGranted"]) assert.equal(receipts[0]!.value[key], false);
    assert.equal(value.value.receipts.some(row => row.name === "final-quality-gate.json"), false);
    assert.ok(value.value.events.indexOf("archive-pulse-settled") < value.value.events.indexOf("native-preservation-receipt"));
    assert.ok(value.value.events.indexOf("native-preservation-receipt") < value.value.events.indexOf("workspace-removed"));
  };
  await control("actual lifecycle healthy pulse settles before Native archive source reads and cleanup", async () => {
    const value = await archiveLifecycleFixture();
    try {
      await value.execute(); assertArchiveLifecycle(value, "PASS_PRESERVATION_ONLY");
      assert.deepEqual(value.observed, ["pulse-start", "pulse-renewed", "pulse-owned", "pulse-query", "public-job-heartbeat", "timer-cleared"]);
      assert.ok(value.value.events.indexOf("archive-pulse-settled") < value.value.events.indexOf("native-file-read"));
    } finally { value.release(); value.value.cleanup(); }
  });
  await control("actual lifecycle pending pulse blocks archive reads until settlement without changing gate authority", async () => {
    const value = await archiveLifecycleFixture({ pending: true });
    let execution: Promise<unknown> | undefined;
    try {
      execution = value.execute(); await value.entered;
      const sourceChecks = value.value.sourceChecks(); await Promise.resolve();
      assert.equal(value.value.sourceChecks(), sourceChecks); assert.equal(value.value.events.includes("native-file-read"), false);
      assert.equal(value.value.removed(), false); assert.equal(value.timerCleared(), false);
      value.release(); await execution; assertArchiveLifecycle(value, "PASS_PRESERVATION_ONLY");
      assert.ok(value.value.sourceChecks() > sourceChecks);
    } finally { value.release(); await execution?.catch(() => undefined); value.value.cleanup(); }
  });
  for (const outcome of ["completed", "timeout"] as const) {
    await control(`actual failed heartbeat preserves ${outcome} archives and rejects at unchanged outer lifecycle and default drain`, async () => {
      const failure = Error("controlled heartbeat failure"), value = await archiveLifecycleFixture({ heartbeatFailure: failure, outcome });
      try {
        await assert.rejects(value.execute(), error => error === failure); assertArchiveLifecycle(value, "PASS_PRESERVATION_ONLY");
        assert.equal(value.signal()?.aborted, true); await assert.rejects(value.defaultDrain(), error => error === failure);
        if (outcome === "timeout") {
          assert.equal(Object.getOwnPropertyDescriptor(value.value.original, "childResult")?.value.reason, "timeout");
          assert.equal(value.value.events.includes("public-gate-pass:quality-3-verify-admin-runtime"), false);
        }
      } finally { value.release(); value.value.cleanup(); }
    });
  }
  await control("actual cancellation during a pending archive pulse retains the original cancelled child and finishes preservation", async () => {
    const value = await archiveLifecycleFixture({ pending: true, outcome: "cancelled" });
    let rejected: Promise<void> | undefined;
    try {
      rejected = assert.rejects(value.execute(), error => error === value.value.original); await value.entered;
      value.cancel(); assert.equal(value.signal()?.aborted, true); assert.equal(value.value.signal(), value.signal());
      assert.equal(value.value.signal()?.aborted, true); assert.equal(value.value.events.includes("native-file-read"), false);
      value.release(); await rejected; assertArchiveLifecycle(value, "PASS_PRESERVATION_ONLY");
      assert.equal(Object.getOwnPropertyDescriptor(value.value.original, "childResult")?.value.reason, "cancelled");
      assert.equal(value.value.events.includes("public-gate-pass:quality-3-verify-admin-runtime"), false);
    } finally { value.release(); await rejected?.catch(() => undefined); value.value.cleanup(); }
  });
  await control("actual archive source verification failure remains fatal after healthy pulse and awaited cleanup", async () => {
    const failure = Error("controlled archive source failure"), value = await archiveLifecycleFixture({ sourceFailure: failure });
    try {
      await assert.rejects(value.execute(), error => error === failure); assertArchiveLifecycle(value, "BLOCKED");
      const receipt = value.value.receipts.find(row => row.name === "public-native-evidence-preservation.json")!;
      assert.deepEqual((receipt.value.failures as Array<{ stage: string }>).map(row => row.stage), ["source_runtime_binding"]);
    } finally { value.release(); value.value.cleanup(); }
  });
  await control("actual lifecycle worker cleanup failure cannot become a pass after healthy pulse and archive preservation", async () => {
    const failure = Error("controlled worker cleanup rejection"), value = await archiveLifecycleFixture({ cleanupFailure: failure });
    try {
      await assert.rejects(value.execute(), error => error === failure); assertArchiveLifecycle(value, "PASS_PRESERVATION_ONLY");
    } finally { value.release(); value.value.cleanup(); }
  });
  for (const outcome of ["timeout", "cancelled"] as const) for (const failureKind of ["archive", "cleanup"] as const) {
    await control(`actual lifecycle retains original ${outcome} and secondary ${failureKind} failure after passive pulse`, async () => {
      const cleanupFailure = Error("controlled secondary worker cleanup"), value = await archiveLifecycleFixture({ outcome,
        ...(failureKind === "archive" ? { fault: "private-io-failure" as const } : { cleanupFailure }) });
      try {
        await assert.rejects(value.execute(), error => error === value.value.original);
        assertArchiveLifecycle(value, failureKind === "archive" ? "BLOCKED" : "PASS_PRESERVATION_ONLY");
        const secondary = Object.getOwnPropertyDescriptor(value.value.original, "publicCleanupFailure");
        assert.ok(secondary); assert.equal(secondary.value, failureKind === "archive" ? value.value.privateFailure : cleanupFailure); assert.equal(secondary.enumerable, false);
        assert.equal(value.value.events.includes("public-gate-pass:quality-3-verify-admin-runtime"), false);
      } finally { value.release(); value.value.cleanup(); }
    });
  }
  const buildStage = new Function("ports", compile(`const {assert,asyncFs,fsConstants,performance,join,sep,ROOT,sourceDirectory,context,signal,process,
    drainControlPulse,manifest,digest,receipt,localVerificationAdmissionRuntimeIdentity}=ports;
    ${stageDeclaration}
    return async()=>{${stageBranch}};`)) as (ports: Record<string, unknown>) => () => Promise<void>;
  type StageFault = "source-link" | "hard-link" | "destination-hard-link" | "escape" | "run-boundary" | "path-name" | "entry-bound" | "file-byte-bound"
    | "source-mutation" | "late-source-mutation" | "destination-mutation" | "existing-destination" | "lock-mismatch" | "runtime-mutation" | "cancel" | "already-cancelled" | "exact-deadline" | "deadline";
  const deferred = () => { let release!: () => void; const promise = new Promise<void>(done => { release = done; }); return { promise, release }; };
  const stageFixture = async (options: { fault?: StageFault; operationFailure?: Error; closeFailure?: Error; receiptFailure?: Error;
    closeGate?: ReturnType<typeof deferred>; closeEntered?: ReturnType<typeof deferred>; pulseGate?: ReturnType<typeof deferred>;
    pulseEntered?: ReturnType<typeof deferred> } = {}) => {
    const directory = realpathSync(mkdtempSync(path.join(root, ".tmp-qa", "owned-dependency-controls-")));
    const installation = path.join(directory, "installation"), runDirectory = path.join(directory, "run"), workspace = path.join(runDirectory, "source");
    const installed = path.join(installation, "node_modules"), pkg = path.join(installed, "control-package");
    for (const at of [installation, runDirectory, workspace, installed, pkg]) mkdirSync(at);
    const locked = JSON.stringify({ packages: { "node_modules/control-package": { version: "1.0.0", integrity: "controlled-lock" } } });
    writeFileSync(path.join(workspace, "package-lock.json"), locked); writeFileSync(path.join(installed, ".package-lock.json"), locked);
    writeFileSync(path.join(pkg, "package.json"), '{"name":"control-package","version":"1.0.0"}');
    const original = Buffer.from("export const original = 'same installed bytes';\n");
    writeFileSync(path.join(pkg, "a.js"), original); writeFileSync(path.join(pkg, "z.js"), "export const final = true;\n");
    if (options.fault === "source-link") { const foreign = path.join(directory, "foreign"); mkdirSync(foreign); symlinkSync(foreign, path.join(pkg, "linked"), "junction"); }
    if (options.fault === "hard-link") await asyncFs.link(path.join(pkg, "a.js"), path.join(directory, "hard-link-peer.js"));
    const controller = new AbortController(), cancelled = Error("Controlled dependency-stage cancellation");
    const target = path.join(workspace, "node_modules"), copiedA = path.join(target, "control-package", "a.js");
    const events: string[] = [], handles: Array<{ file: string; closed: boolean }> = [], receipts: Array<{ name: string; value: Record<string, unknown> }> = [];
    let clock = 0, pulses = 0, operations = 0, identities = 0;
    const actualIdentity = { node: "controlled-node", installedLockSha256: sha256(locked), projectLockSha256: sha256(locked), packages: [] };
    const fsPort = new Proxy(asyncFs, { get(namespace, key) {
      if (key === "lstat") return async (at: string) => { operations++; events.push("fs:lstat"); const stat = await asyncFs.lstat(at);
        return options.fault === "file-byte-bound" && at === path.join(pkg, "a.js") ? new Proxy(stat, { get(actual, property) {
          if (property === "size") return 512 * 1024 * 1024 + 1;
          const value = Reflect.get(actual, property, actual); return typeof value === "function" ? value.bind(actual) : value;
        } }) : stat; };
      if (key === "realpath") return async (at: string) => { operations++; events.push("fs:realpath"); const value = await asyncFs.realpath(at);
        return options.fault === "escape" && at === workspace ? path.join(directory, "outside-owned-run") : value; };
      if (key === "readdir") return async (at: string) => { operations++; events.push("fs:readdir"); const values = await asyncFs.readdir(at);
        if (options.fault === "entry-bound" && at === installed) return Array.from({ length: 200_000 }, (_value, index) => "controlled-" + index);
        return options.fault === "path-name" && at === installed ? [...values, "../escape"] : values; };
      if (key === "mkdir") return async (at: string) => { operations++; events.push("fs:mkdir"); await asyncFs.mkdir(at);
        if (options.fault === "existing-destination" && at === target) await asyncFs.writeFile(path.join(at, ".package-lock.json"), "owned existing destination sentinel"); };
      if (key === "readFile") return async (at: string) => { operations++; events.push("fs:readFile");
        if (options.fault === "destination-mutation" && at === copiedA) await asyncFs.writeFile(at, "changed destination bytes");
        return asyncFs.readFile(at); };
      if (key === "open") return async (...args: Parameters<typeof asyncFs.open>) => {
        operations++; events.push("fs:open"); const handle = await asyncFs.open(...args), at = String(args[0]);
        const row = { file: at, closed: false }; handles.push(row);
        return new Proxy(handle, { get(actual, property) {
          if (property === "readFile") return async () => { const bytes = await actual.readFile();
            if (options.fault === "source-mutation" && at === path.join(pkg, "a.js")) await asyncFs.writeFile(at, "changed source bytes");
            if (options.fault === "late-source-mutation" && at === path.join(pkg, "z.js")) await asyncFs.writeFile(path.join(pkg, "a.js"), "changed earlier source bytes");
            return bytes; };
          if (property === "writeFile") return async (bytes: Uint8Array) => {
            if (options.operationFailure) throw options.operationFailure;
            await actual.writeFile(bytes);
            if (options.fault === "destination-hard-link") await asyncFs.link(at, path.join(directory, "destination-hard-link-peer.js"));
            if (options.fault === "cancel") controller.abort(cancelled);
            if (options.fault === "exact-deadline") clock = 600_000;
            if (options.fault === "deadline") clock = 600_001;
          };
          if (property === "close") return async () => { options.closeEntered?.release(); if (options.closeGate) await options.closeGate.promise;
            await actual.close(); row.closed = true; events.push("handle-closed"); if (options.closeFailure) throw options.closeFailure; };
          const value = Reflect.get(actual, property, actual); return typeof value === "function" ? value.bind(actual) : value;
        } });
      };
      const value = Reflect.get(namespace, key, namespace);
      return typeof value === "function" ? (...args: unknown[]) => { operations++; events.push("fs:" + String(key)); return Reflect.apply(value, namespace, args); } : value;
    } });
    const context = { runDirectory: options.fault === "run-boundary" ? installation : runDirectory, async assertOwned() { events.push("ownership-verified"); } };
    if (options.fault === "already-cancelled") controller.abort(cancelled);
    const execute = buildStage({ assert, asyncFs: fsPort, fsConstants, performance: { now: () => clock }, process: { platform: "win32" }, join: path.join, sep: path.sep,
      ROOT: installation, sourceDirectory: workspace, context, signal: controller.signal,
      async drainControlPulse() { pulses++; events.push("pulse-start"); if (options.pulseGate && pulses === 1) { options.pulseEntered?.release(); await options.pulseGate.promise; }
        events.push("pulse-end"); }, manifest: [{ file: "package-lock.json", sha256: sha256(locked) }], digest: sha256,
      receipt(_context: unknown, name: string, value: Record<string, unknown>) { if (options.receiptFailure) throw options.receiptFailure; receipts.push({ name, value }); },
      localVerificationAdmissionRuntimeIdentity() { identities++; return { ...actualIdentity,
        projectLockSha256: options.fault === "lock-mismatch" || options.fault === "runtime-mutation" && identities > 1 ? "b".repeat(64) : actualIdentity.projectLockSha256 }; } });
    return { execute, events, handles, receipts, cancelled, copiedA, original, sourceA: path.join(pkg, "a.js"), target, installation, workspace,
      operations: () => operations, pulses: () => pulses,
      cleanup() { assert.equal(handles.every(row => row.closed), true, "All opened file handles settle before fixture removal.");
        assert.equal(path.dirname(directory), realpathSync(path.join(root, ".tmp-qa"))); assert.equal(lstatSync(directory).isSymbolicLink(), false);
        const link = path.join(pkg, "linked"); if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link);
        rmSync(directory, { recursive: true, force: false }); assert.equal(existsSync(directory), false); } };
  };
  const buildStageBranch = new Function("ports", compile(`const {process,stageInstalledDependencies,symlinkSync,join,ROOT,sourceDirectory}=ports;
    return async()=>{${stageBranch}};`)) as (ports: Record<string, unknown>) => () => Promise<void>;
  await control("actual dependency platform branch awaits only Windows physical staging and preserves the exact original Linux link", async () => {
    const entered = deferred(), release = deferred(); let copies = 0, links = 0, settled = false;
    const ports = { process: { platform: "win32" }, ROOT: "controlled-root", sourceDirectory: "controlled-owned-copy", join: path.join,
      async stageInstalledDependencies() { copies++; entered.release(); await release.promise; },
      symlinkSync(...args: unknown[]) { links++; assert.deepEqual(args, [path.join("controlled-root", "node_modules"), path.join("controlled-owned-copy", "node_modules"), "junction"]); } };
    const pending = buildStageBranch(ports)(); pending.then(() => { settled = true; }, () => { settled = true; });
    await entered.promise; assert.equal(copies, 1); assert.equal(links, 0); assert.equal(settled, false);
    release.release(); await pending;
    await buildStageBranch({ ...ports, process: { platform: "linux" }, stageInstalledDependencies() { throw Error("Linux cannot execute the Windows dependency copy."); } })();
    assert.equal(copies, 1); assert.equal(links, 1);
  });
  for (const [name, mutate] of [
    ["wrong platform", (text: string) => text.replace('process.platform === "win32"', 'process.platform === "linux"')],
    ["missing await", (text: string) => text.replace("await stageInstalledDependencies()", "stageInstalledDependencies()")],
    ["widened source root", (text: string) => text.replace('join(ROOT, "node_modules")', 'join(ROOT, "..", "node_modules")')],
    ["multiple copy calls", (text: string) => text.replace("await stageInstalledDependencies();", "{ await stageInstalledDependencies(); await stageInstalledDependencies(); }")],
    ["missing original else", (text: string) => text.replace(/else\s+symlinkSync\([^;]+;/u, "")],
  ] as const) await control("actual dependency platform source rejects " + name, async () => {
    const changed = mutate(stageBranch); assert.notEqual(changed, stageBranch); assert.throws(() => inspectStageBranch(changed));
  });
  await control("actual physical dependency staging preserves private bytes lock modes and a complete verified manifest", async () => {
    const value = await stageFixture();
    try {
      await value.execute(); assert.equal(lstatSync(value.target).isSymbolicLink(), false); assert.equal(realpathSync(value.target), value.target);
      assert.deepEqual(readFileSync(value.copiedA), value.original); assert.equal(lstatSync(value.copiedA).nlink, 1);
      assert.equal(lstatSync(value.copiedA).mode & 0o777, lstatSync(value.sourceA).mode & 0o777);
      assert.deepEqual(readFileSync(path.join(value.target, ".package-lock.json")), readFileSync(path.join(value.workspace, "package-lock.json")));
      const receipt = value.receipts.find(row => row.name === "public-installed-dependencies.json"); assert.ok(receipt);
      assert.equal(receipt.value.status, "PASS"); assert.equal(receipt.value.method, "physical-same-installed-tree");
      assert.equal(receipt.value.sourceAndDestinationBytesVerified, true); assert.equal(receipt.value.noLinksOrHardlinks, true);
      assert.equal(receipt.value.networkUsed, false); assert.equal(receipt.value.reinstallPerformed, false);
      assert.ok(Array.isArray(receipt.value.manifest)); assert.equal(receipt.value.manifestSha256, sha256(JSON.stringify(receipt.value.manifest)));
      assert.ok(value.handles.length > 0 && value.handles.every(row => row.closed)); assert.ok(value.pulses() >= value.operations());
    } finally { value.cleanup(); }
  });
  for (const fault of ["source-link", "hard-link", "destination-hard-link", "escape", "run-boundary", "path-name", "entry-bound", "file-byte-bound",
    "source-mutation", "late-source-mutation", "destination-mutation", "existing-destination", "lock-mismatch", "runtime-mutation", "cancel", "already-cancelled", "exact-deadline", "deadline"] as const) {
    await control("actual physical dependency staging rejects " + fault + " without publishing success or leaving handles open", async () => {
      const value = await stageFixture({ fault });
      try {
        await assert.rejects(value.execute(), error => fault === "cancel" || fault === "already-cancelled" ? error === value.cancelled : error instanceof Error);
        assert.equal(value.receipts.some(row => row.name === "public-installed-dependencies.json"), false);
        assert.equal(value.receipts.filter(row => row.name === "public-installed-dependencies-failure.json").length, 1);
        assert.ok(value.handles.every(row => row.closed));
        if (fault === "existing-destination") assert.equal(readFileSync(path.join(value.target, ".package-lock.json"), "utf8"), "owned existing destination sentinel");
        if (fault === "already-cancelled") assert.equal(value.operations(), 0);
      } finally { value.cleanup(); }
    });
  }
  await control("actual physical dependency staging awaits the existing control pulse before filesystem work", async () => {
    const pulseGate = deferred(), pulseEntered = deferred(), value = await stageFixture({ pulseGate, pulseEntered });
    try { const pending = value.execute(); await pulseEntered.promise; assert.equal(value.operations(), 0); pulseGate.release(); await pending;
      assert.ok(value.events.indexOf("pulse-end") < value.events.findIndex(event => event.startsWith("fs:")));
    } finally { pulseGate.release(); value.cleanup(); }
  });
  await control("actual staging failure settles both handles before outer cleanup and preserves the first error over secondary failures", async () => {
    const original = Error("Controlled first dependency copy failure"), closeFailure = Error("Controlled secondary close failure"), closeGate = deferred(), closeEntered = deferred();
    const stage = await stageFixture({ operationFailure: original, closeFailure, receiptFailure: Error("Controlled secondary receipt failure"), closeGate, closeEntered });
    const value = fixture({ stageInstalledDependencies: stage.execute, failedCleanup: true });
    try {
      let settled = false; const pending = value.execute(); pending.then(() => { settled = true; }, () => { settled = true; });
      await closeEntered.promise; assert.equal(settled, false); assert.equal(value.stopped(), false); assert.equal(value.removed(), false);
      closeGate.release(); await assert.rejects(pending, error => error === original);
      assert.ok(stage.handles.every(row => row.closed)); assert.ok(value.stopped() && value.workerStopped()); assert.equal(value.launched.length, 0);
      const closes = Object.getOwnPropertyDescriptor(original, "dependencyStagingCloseFailures");
      assert.ok(Array.isArray(closes?.value)); assert.equal(closes.value.length, 2); assert.ok(closes.value.every((error: unknown) => error === closeFailure));
      assert.equal(closes.enumerable, false);
      assert.ok(Object.getOwnPropertyDescriptor(original, "publicCleanupFailure")?.value instanceof Error);
      assert.equal(value.receipts.some(row => row.name === "public-process-cleanup.json"), false);
    } finally { closeGate.release(); stage.cleanup(); }
  });
  await control("actual physical staging refuses a success close failure and preserves a frozen original failure", async () => {
    const closeFailure = Error("Controlled file close failure"), closed = await stageFixture({ closeFailure });
    try { await assert.rejects(closed.execute(), error => error === closeFailure);
      assert.equal(closed.receipts.some(row => row.name === "public-installed-dependencies.json"), false);
      const failure = closed.receipts.find(row => row.name === "public-installed-dependencies-failure.json"); assert.ok(failure);
      assert.deepEqual(failure.value.closeFailures, [{ name: "Error", code: null }, { name: "Error", code: null }]);
    } finally { closed.cleanup(); }
    const original = Object.freeze(Error("Controlled frozen original file failure"));
    const frozen = await stageFixture({ operationFailure: original, closeFailure, receiptFailure: Error("Controlled secondary receipt failure") });
    try { await assert.rejects(frozen.execute(), error => error === original); assert.equal(Object.hasOwn(original, "dependencyStagingCloseFailures"), false); }
    finally { frozen.cleanup(); }
  });
}

async function verifyLocalRiskControlLeaseAdmission() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = (name: string) => {
    const node = file.statements.find(row => (ts.isFunctionDeclaration(row) && row.name?.text === name)
      || (ts.isVariableStatement(row) && row.declarationList.declarations.some(declaration => declaration.name.getText(file) === name)));
    assert.ok(node); return node.getText(file).replace(/^export /u, "");
  };
  const run = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification") as ts.FunctionDeclaration;
  assert.ok(run?.body);
  const admissions: ts.IfStatement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && ts.isBlock(node.thenStatement)
      && node.thenStatement.statements.some(row => row.getText(file) === "activeLocalVerifications.add(originalContext);")) admissions.push(node);
    ts.forEachChild(node, visit);
  };
  visit(run); assert.equal(admissions.length, 1);
  const admission = admissions[0], runText = run.getText(file), admissionText = admission.getText(file);
  assert.ok(runText.indexOf("assertLocalVerificationRequest(request, localPlan)") < runText.indexOf(admissionText));
  assert.ok(runText.indexOf('execFileSync("git", ["diff", "--quiet", "HEAD", "--"]') < runText.indexOf(admissionText));
  assert.ok(admissionText.includes('localPlan?.mode === "bounded"'));
  assert.ok(admissionText.indexOf("await drainControlPulse()") < admissionText.indexOf("verifySource()"));
  assert.ok(admissionText.indexOf("verifySource()") < admissionText.indexOf("activeLocalVerifications.add(originalContext)"));
  const compile = (value: string) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = new Function("assert", compile(`${statement("activeLocalVerifications")}
    ${statement("isOwnedLocalVerificationActive")}
    return { active:isOwnedLocalVerificationActive,
      admit:async (ports)=>{const {localPlan,localInputs,headSha,originalContext,verifySource,drainControlPulse}=ports;${admissionText}},
      clear:(originalContext)=>activeLocalVerifications.delete(originalContext) };`))(assert) as {
      active(context: object): boolean; admit(ports: Record<string, unknown>): Promise<void>; clear(context: object): void;
    };
  const lifecycle = ts.createSourceFile("isolated-supabase.mts", readSource("scripts/lib/isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const renewals: ts.CallExpression[] = [];
  const findRenewal = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(lifecycle) === "applicationLease.renewIfDue"
      && node.arguments.some(argument => argument.getText(lifecycle).includes("isOwnedLocalVerificationActive(publicContext)"))) renewals.push(node);
    ts.forEachChild(node, findRenewal);
  };
  findRenewal(lifecycle); assert.equal(renewals.length, 1);
  const renew = new Function("request", "publicContext", "isOwnedLocalVerificationActive", compile("return (" + renewals[0].arguments[0].getText(lifecycle) + ");")) as
    (request: object, context: object, active: (context: object) => boolean) => boolean;
  const context = {}, head = "b".repeat(40), events: string[] = [];
  const ports = { localPlan: { mode: "bounded" }, localInputs: { finalHead: head }, headSha: head, originalContext: context,
    verifySource() { events.push("source-verified"); }, async drainControlPulse() { events.push("pulse-drained"); } };
  const request = { localVerification: { risk: "A", bounded: true }, additionalSourceFiles: [] };
  assert.equal(api.active(context), false); assert.equal(renew(request, context, api.active), false);
  assert.equal(api.active({ ...request, admitted: true, active: true }), false);
  cases.push("forged request presence or active/admitted flags cannot renew the existing control lease");
  await assert.rejects(api.admit({ ...ports, verifySource() { throw Error("controlled changed source"); } }), /controlled changed source/u);
  assert.equal(api.active(context), false);
  await assert.rejects(api.admit({ ...ports, localInputs: { finalHead: "c".repeat(40) } })); assert.equal(api.active(context), false);
  await api.admit({ ...ports, localPlan: { mode: "full" } }); assert.equal(api.active(context), false);
  cases.push("failed source/HEAD admission and a full-mode request cannot activate the bounded lease marker");
  events.length = 0; await api.admit(ports);
  assert.deepEqual(events, ["pulse-drained", "source-verified"]); assert.equal(api.active(context), true);
  assert.equal(api.active({}), false); assert.equal(renew(request, context, api.active), true);
  cases.push("only the validated exact owned context activates bounded renewal after the existing pulse drain");
  api.clear(context); assert.equal(api.active(context), false); assert.equal(renew(request, context, api.active), false);
  cases.push("bounded cleanup revokes lease eligibility instead of extending request lifetime or authority");
}

async function verifyQualifiedFormHarnessControls() {
  const filename = "scripts/qa-admin-form-guarded-navigation.mts";
  const source = ts.createSourceFile(filename, readSource(filename), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const entry = source.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(source) === "entrySource");
  assert.ok(entry?.initializer && ts.isTaggedTemplateExpression(entry.initializer) && ts.isNoSubstitutionTemplateLiteral(entry.initializer.template));
  const embedded = entry.initializer.template as ts.NoSubstitutionTemplateLiteral & { rawText?: string };
  const browserSource = ts.createSourceFile("actual-form-fixture.js", embedded.rawText ?? embedded.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const diagnostic = browserSource.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "createSaveCacheDiagnosticTimeline");
  assert.ok(diagnostic, "Diagnostics execute the same bounded collector embedded in the canonical Browser fixture.");
  const capture = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "snapshotSaveCacheDiagnostic");
  assert.ok(capture, "Failure snapshots share the actual bounded fixture callback.");
  const captureCode = ts.transpileModule(capture.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const captureCallback = new Function(captureCode + ";return snapshotSaveCacheDiagnostic;")() as (input: Record<string, unknown>) => unknown;
  const createTimeline = new Function(ts.transpileModule(diagnostic.getText(browserSource), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    + ";return createSaveCacheDiagnosticTimeline;")() as (now: () => number, mode?: string) => {
      record(kind: string, facts?: Record<string, unknown>): void;
      snapshot(): { events: Array<Record<string, unknown>>; totalObserved: number; dropped: number; limit: number; mode: string };
    };
  check("qualified diagnostics retain bounded pre-failure metadata without recording field values URLs or arbitrary facts", () => {
    let clock = 0;
    const timeline = createTimeline(() => clock);
    timeline.record("foreign", { value: "private" });
    assert.equal(timeline.snapshot().totalObserved, 0);
    for (let index = 0; index < 129; index++) {
      clock += 1;
      timeline.record("input", { valueLength: index, trusted: true, status: "secret", token: "private", value: "private", url: "https://private.invalid" });
    }
    const snapshot = timeline.snapshot();
    assert.equal(snapshot.events.length, 128); assert.equal(snapshot.totalObserved, 129); assert.equal(snapshot.dropped, 1); assert.equal(snapshot.limit, 128);
    assert.equal(snapshot.events[0].sequence, 2); assert.equal(snapshot.events.at(-1)?.sequence, 129);
    assert.equal(snapshot.events[0].elapsedMs, 2);
    assert.equal(JSON.stringify(snapshot).includes("private"), false); assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    assert.deepEqual(Object.keys(snapshot.events[0]), ["sequence", "elapsedMs", "kind", "valueLength", "trusted"]);
    snapshot.events[0].kind = "mutated"; assert.equal(timeline.snapshot().events[0].kind, "input");
    timeline.record("assertion_failure", { assertionOrdinal: 7, valueLength: -1, reads: Infinity });
    assert.equal(timeline.snapshot().events.at(-1)?.assertionOrdinal, 7);
    assert.equal("valueLength" in timeline.snapshot().events.at(-1)!, false);
    assert.equal("reads" in timeline.snapshot().events.at(-1)!, false);
  });
  check("normal diagnostic history keeps event order without inspecting deep facts and invalid modes fail closed", () => {
    let clock = 0;
    const timeline = createTimeline(() => clock, "light");
    const facts = Object.defineProperties({}, {
      valueLength: { get() { throw Error("Deep field facts must not be inspected by the light collector"); } },
      status: { get() { throw Error("Deep state facts must not be inspected by the light collector"); } },
    });
    for (let index = 0; index < 257; index++) { clock++; timeline.record("input", facts); }
    const snapshot = timeline.snapshot();
    assert.equal(snapshot.mode, "light"); assert.equal(snapshot.events.length, 128);
    assert.equal(snapshot.totalObserved, 257); assert.equal(snapshot.dropped, 129);
    assert.equal(snapshot.events[0].sequence, 130); assert.equal(snapshot.events.at(-1)?.sequence, 257);
    assert.deepEqual(Object.keys(snapshot.events[0]), ["sequence", "elapsedMs", "kind"]);
    snapshot.events[0].kind = "changed"; assert.equal(timeline.snapshot().events[0].kind, "input");
    timeline.record("assertion_failure", { assertionOrdinal: 8, value: "private" });
    assert.equal(timeline.snapshot().events.at(-1)?.assertionOrdinal, 8);
    assert.equal(JSON.stringify(timeline.snapshot()).includes("private"), false);
    assert.throws(() => createTimeline(() => 0, "unreviewed"), /UNQUALIFIED_DIAGNOSTIC_MODE/u);
  });
  check("the existing ring distinguishes an observed contract mismatch without promoting light history to deep metadata", () => {
    for (const mode of ["light", "deep"] as const) {
      const timeline = createTimeline(() => 1, mode);
      timeline.record("contract_divergence", { dirty: false, value: "private-value", owner: "invented-cause" });
      const row = timeline.snapshot().events[0]; assert.equal(row.kind, "contract_divergence");
      assert.equal(Object.hasOwn(row, "dirty"), mode === "deep");
      if (mode === "deep") assert.equal(row.dirty, false);
      assert.equal(JSON.stringify(row).includes("private"), false); assert.equal(JSON.stringify(row).includes("invented"), false);
    }
  });
  check("the actual shared snapshot callback records only requested observed boundaries and missing evidence stays null", () => {
    for (const mode of ["light", "deep"] as const) {
      const timeline = createTimeline(() => 1, mode);
      timeline.record("input", { valueLength: 9 });
      const snapshot = new Function("window", captureCode + ";return snapshotSaveCacheDiagnostic;")({
        __ADMIN_FORM_GUARDED_NAV_QA__: { saveCacheDiagnostic: timeline },
      }) as (input: Record<string, unknown>) => ReturnType<typeof timeline.snapshot>;
      const first = snapshot({ assertionFailure: false, assertionOrdinal: 5, contractDivergence: true, dirty: false });
      assert.deepEqual(first.events.map(row => row.kind), ["input", "contract_divergence"]);
      assert.equal(Object.hasOwn(first.events[1], "dirty"), mode === "deep");
      const terminal = snapshot({ assertionFailure: true, assertionOrdinal: 8 });
      assert.equal(terminal.events.at(-1)?.kind, "assertion_failure"); assert.equal(terminal.events.at(-1)?.assertionOrdinal, 8);
    }
    const missing = new Function("window", captureCode + ";return snapshotSaveCacheDiagnostic;")({}) as (input: object) => unknown;
    assert.equal(missing({ assertionFailure: true, assertionOrdinal: 1 }), null);
  });
  check("diagnostic collector cost is measured independently from fixture preparation and Browser scheduling", () => {
    const count = 20_000, costs: Record<"light" | "deep", number[]> = { light: [], deep: [] };
    const facts = { valueLength: 9, trusted: true, pending: false, dirty: true, status: "success", actionCalls: 1, reads: 0 };
    for (const mode of ["light", "deep"] as const) {
      const warm = createTimeline(() => 0, mode); for (let index = 0; index < 1000; index++) warm.record("input", facts);
    }
    for (let pair = 0; pair < 6; pair++) for (const mode of (pair % 2 ? ["deep", "light"] : ["light", "deep"]) as Array<"light" | "deep">) {
      const timeline = createTimeline(() => 0, mode), started = performance.now();
      for (let index = 0; index < count; index++) timeline.record(index % 2 ? "input" : "state_render_observed", facts);
      costs[mode].push(performance.now() - started);
      assert.equal(timeline.snapshot().totalObserved, count); assert.equal(timeline.snapshot().events.length, 128);
    }
    const median = (values: number[]) => { const ordered = [...values].sort((a, b) => a - b); return (ordered[2] + ordered[3]) / 2; };
    qualifiedFormDiagnosticCost = { scope: "actual_embedded_collector_only", diagnosticSourceSha256: sha256(diagnostic.getText(browserSource)),
      eventsPerSample: count, samplesPerMode: 6, order: "alternating_light_deep_pairs", constantClock: true,
      lightMs: costs.light, deepMs: costs.deep, lightMedianMs: median(costs.light), deepMedianMs: median(costs.deep),
      excludes: ["actual Browser event delivery", "timestamp clock cost", "fixture preparation", "RPC snapshot collection", "cleanup"],
      globalSpeedupClaim: false };
  });
  check("the actual bounded fixture keeps exact normal arguments and accepts only the explicit deep diagnostic arm", () => {
    const names = new Set(["saveCacheOnly", "saveCacheDiagnosticMode", "saveCacheDiagnosticRequested", "reportFreshnessOnly", "returnPathOnly"]);
    const declarations = source.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
      .filter(declaration => names.has(declaration.name.getText(source)));
    assert.equal(declarations.length, names.size);
    const guard = source.statements.find((statement): statement is ts.IfStatement => ts.isIfStatement(statement)
      && statement.expression.getText(source) === "saveCacheOnly");
    const namespaceGuard = source.statements.find((statement): statement is ts.IfStatement => ts.isIfStatement(statement)
      && statement.expression.getText(source) === "saveCacheDiagnosticRequested");
    assert.ok(guard?.elseStatement, "The explicit deep arm must not activate outside the bounded family.");
    assert.ok(namespaceGuard && namespaceGuard.end < guard.getStart(source), "A diagnostic typo must reject before any unrelated family can run.");
    const actual = new Function("assert", "process", declarations.map(declaration => "const " + declaration.getText(source) + ";").join("\n")
      + namespaceGuard.getText(source) + guard.getText(source)) as (assertPort: typeof assert, processPort: { argv: string[] }) => void;
    const run = (args: string[]) => actual(assert, { argv: ["node", filename, ...args] });
    run(["--save-cache-only"]); run(["--save-cache-only", "--save-cache-diagnostics=deep"]);
    for (const args of [["--save-cache-only", "--unknown"], ["--save-cache-diagnostics=deep"],
      ["--save-cache-only", "--save-cache-only"], ["--save-cache-diagnostics=deep", "--save-cache-only"],
      ["--save-cache-only", "--save-cache-diagnostics=unreviewed"], ["--save-cache-diagnostics=depp"],
      ["--save-cache-diagnostics=light"], ["--save-cache-diagnostics"]]) assert.throws(() => run(args));
  });
  check("qualified diagnostic observation adds no timers microtasks React state setters or DOM writes", () => {
    const forbidden = new Set(["setTimeout", "setInterval", "queueMicrotask", "requestAnimationFrame", "setState", "setControlledTitle"]);
    const inspect = (node: ts.Node, tree: ts.SourceFile) => {
      if (ts.isCallExpression(node)) assert.equal(forbidden.has(node.expression.getText(tree)), false);
      ts.forEachChild(node, child => inspect(child, tree));
    };
    inspect(diagnostic, browserSource);
    inspect(capture, source);
    const mount = browserSource.statements.find(node => ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
      && node.expression.left.getText(browserSource) === "qa.mountSaveCache");
    assert.ok(mount && ts.isExpressionStatement(mount) && ts.isBinaryExpression(mount.expression) && ts.isArrowFunction(mount.expression.right));
    const observers: ts.ArrowFunction[] = [];
    const registrations: ts.CallExpression[] = [], removals: ts.CallExpression[] = [];
    const findObserver = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(browserSource) === "observe") {
        assert.ok(node.initializer && ts.isArrowFunction(node.initializer)); observers.push(node.initializer);
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(browserSource);
        if (callee === "document.addEventListener") registrations.push(node);
        if (callee === "document.removeEventListener") removals.push(node);
        assert.ok(["qa.saveCacheDiagnosticDispose", "createSaveCacheDiagnosticTimeline", "qa.saveCacheDiagnostic.record",
          "document.addEventListener", "document.removeEventListener", "root.render", "React.createElement"].includes(callee),
        "Passive diagnostic mount cannot introduce scheduling or unreviewed callback calls: " + callee);
      }
      ts.forEachChild(node, findObserver);
    };
    findObserver(mount.expression.right);
    assert.equal(observers.length, 1);
    const observe = observers[0];
    const inspectPassive = (callback: ts.Node, tree: ts.SourceFile) => {
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) assert.equal(node.expression.getText(tree), "qa.saveCacheDiagnostic.record",
          "Passive observer allows only bounded metadata recording");
        if (ts.isBinaryExpression(node)) assert.equal(node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment,
          false, "Passive observer cannot assign DOM values or schedule through an assignment");
        if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) assert.equal(
          node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken, false, "Passive observer cannot update DOM values");
        assert.equal(ts.isNewExpression(node), false, "Passive observer cannot construct an unreviewed effect");
        ts.forEachChild(node, visit);
      };
      visit(callback);
    };
    inspectPassive(observe, browserSource);
    assert.ok(observe.getText(browserSource).includes('field.form?.id !== "qa-save-cache-form"'));
    const eventBindings = (rows: ts.CallExpression[]) => rows.map(call => [
      ts.isStringLiteral(call.arguments[0]) ? call.arguments[0].text : null, call.arguments[1]?.getText(browserSource), call.arguments.length,
    ]);
    assert.deepEqual(eventBindings(registrations), [["input", "observe", 2], ["change", "observe", 2]]);
    assert.deepEqual(eventBindings(removals), [["input", "observe", 2], ["change", "observe", 2]]);
    assert.ok(ts.isBlock(observe.body));
    const printer = ts.createPrinter();
    for (const statement of [
      ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier("queueMicrotask"), undefined, [ts.factory.createIdentifier("unobservedCallback")])),
      ts.factory.createExpressionStatement(ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("field"), "value"),
        ts.factory.createToken(ts.SyntaxKind.EqualsToken), ts.factory.createStringLiteral("changed"))),
    ]) {
      const changed = ts.factory.updateArrowFunction(observe, observe.modifiers, observe.typeParameters, observe.parameters, observe.type, observe.equalsGreaterThanToken,
        ts.factory.updateBlock(observe.body, [...observe.body.statements, statement]));
      const negative = ts.createSourceFile("diagnostic-observer-negative.js", "const observe = " + printer.printNode(ts.EmitHint.Expression, changed, browserSource) + ";",
        ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const declaration = negative.statements[0]; assert.ok(ts.isVariableStatement(declaration));
      const callback = declaration.declarationList.declarations[0].initializer; assert.ok(callback);
      assert.throws(() => inspectPassive(callback, negative), /Passive observer/u);
    }
    assert.ok(diagnostic.getText(browserSource).includes("events.map(row => ({ ...row }))"));
    const main = source.statements.find(ts.isTryStatement); assert.ok(main?.catchClause);
    assert.ok(main.catchClause.block.getText(source).includes("saveCacheFailureTimeline"));
    assert.ok(main.catchClause.block.statements.some(node => ts.isThrowStatement(node) && node.expression?.getText(source) === "error"));
    assert.ok(main.finallyBlock?.getText(source).includes('"Causal owner of divergence UNKNOWN"'));
  });
  const mainCatch = source.statements.find(ts.isTryStatement)?.catchClause;
  assert.ok(mainCatch);
  for (const captureFails of [false, true]) {
    const original = new assert.AssertionError({ message: "controlled original assertion" });
    let inspected: Record<string, unknown> | undefined;
    const compiled = ts.transpileModule(`return (async () => {
      let primaryFailed=false,saveCacheObservedAssertionFailure=false,saveCacheFailureTimeline=null,saveCacheDiagnosticCaptureFailed=false;
      let saveCacheFirstDivergence=null,saveCacheOriginalFailure=null;
      const fixtureTimings={diagnosticCollectionMs:0},fixtureStarted=performance.now();
      const saveCacheOnly=true,saveCacheDiagnosticPage=ports.page,passed=4,error=ports.original;
      const snapshotSaveCacheDiagnostic=ports.capture;
      try ${mainCatch.block.getText(source)} finally { ports.inspect({primaryFailed,saveCacheObservedAssertionFailure,saveCacheFailureTimeline,saveCacheDiagnosticCaptureFailed,saveCacheOriginalFailure}); }
    })();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const run = new Function("assert", "ports", compiled) as (assertPort: typeof assert, ports: Record<string, unknown>) => Promise<void>;
    await assert.rejects(run(assert, { original, capture: captureCallback, page: { isClosed: () => false, evaluate: async (callback: unknown, args: { assertionFailure: boolean; assertionOrdinal: number }) => {
      assert.equal(callback, captureCallback);
      assert.deepEqual(args, { assertionFailure: true, assertionOrdinal: 5 });
      if (captureFails) throw Error("controlled unavailable page");
      return { events: [{ kind: "assertion_failure", assertionOrdinal: 5 }], totalObserved: 1, dropped: 0, limit: 128 };
    } }, inspect: (value: Record<string, unknown>) => { inspected = value; } }), error => error === original);
    assert.equal(inspected?.primaryFailed, true); assert.equal(inspected?.saveCacheObservedAssertionFailure, true);
    assert.equal(inspected?.saveCacheDiagnosticCaptureFailed, captureFails);
    assert.equal(inspected?.saveCacheFailureTimeline === null, captureFails);
    const failure = inspected?.saveCacheOriginalFailure as Record<string, unknown>;
    assert.ok(typeof failure.observedElapsedMs === "number" && Number.isFinite(failure.observedElapsedMs) && failure.observedElapsedMs >= 0);
    assert.deepEqual({ ...failure, observedElapsedMs: undefined }, { name: "AssertionError", code: "ERR_ASSERTION", assertionOrdinal: 5, observedElapsedMs: undefined });
    cases.push("Qualified diagnostics preserve the original assertion when failure capture " + (captureFails ? "fails" : "succeeds"));
  }
  const early: ts.IfStatement[] = [];
  const findEarly = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.expression.getText(source) === 'dirty !== "true"'
      && ts.isBlock(node.thenStatement) && node.thenStatement.statements.some(statement => ts.isExpressionStatement(statement)
        && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(source) === "secondSaveFailures.push")) early.push(node);
    ts.forEachChild(node, findEarly);
  };
  findEarly(source); assert.equal(early.length, 1, "The original deferred second-save contract has one observation boundary.");
  const observeEarly = async (dirty: string | null, captureFails = false, existing?: { first: unknown; timeline: unknown }) => {
    let observed: Record<string, unknown> | undefined, captures = 0;
    const execute = new Function("ports", ts.transpileModule(`return (async()=>{
      const dirty=ports.dirty,secondSaveFailures=[],secondLabel="controlled-second-save",saveCacheOnly=true;
      const saveCacheScenariosStarted=10,scenario={controlled:true,secondFailure:"error"},passed=4,fixtureStarted=performance.now();
      const fixtureTimings={diagnosticCollectionMs:0},snapshotSaveCacheDiagnostic=ports.capture;
      let saveCacheFirstDivergence=ports.first??null,saveCacheFailureTimeline=ports.timeline??null,saveCacheDiagnosticCaptureFailed=false;
      const page=ports.page;
      try { ${early[0].getText(source)} } finally {ports.inspect({secondSaveFailures,saveCacheFirstDivergence,saveCacheFailureTimeline,saveCacheDiagnosticCaptureFailed});}
    })();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText) as (ports: Record<string, unknown>) => Promise<void>;
    await execute({ dirty, capture: captureCallback, first: existing?.first, timeline: existing?.timeline,
      page: { evaluate: async (callback: unknown, args: Record<string, unknown>) => {
        captures++; assert.equal(callback, captureCallback); assert.equal(args.contractDivergence, true); assert.equal(args.assertionFailure, false);
        if (captureFails) throw Error("controlled unavailable snapshot");
        return { events: [{ kind: "contract_divergence" }], totalObserved: 1, dropped: 0, limit: 128, mode: "light" };
      } }, inspect: (value: Record<string, unknown>) => { observed = value; } });
    assert.ok(observed); return { observed, captures };
  };
  for (const captureFails of [false, true]) {
    const { observed, captures } = await observeEarly("false", captureFails);
    assert.equal(captures, 1); const first = observed.saveCacheFirstDivergence as Record<string, unknown>;
    assert.equal(first.boundary, "dirty_state_dom"); assert.equal(first.scenarioIndex, 10); assert.equal(first.expected, "true"); assert.equal(first.observed, "false");
    assert.equal(first.observedAfterAssertions, 4); assert.equal(observed.saveCacheDiagnosticCaptureFailed, captureFails);
    assert.ok(typeof first.elapsedMs === "number" && Number.isFinite(first.elapsedMs) && first.elapsedMs >= 0);
    assert.equal(observed.saveCacheFailureTimeline === null, captureFails);
    assert.deepEqual(observed.secondSaveFailures, ["controlled-second-save: dirty=false"]);
    cases.push("Qualified diagnostics retain first proven dirty divergence when immediate capture " + (captureFails ? "fails" : "succeeds"));
  }
  const normal = await observeEarly("true");
  assert.equal(normal.captures, 0); assert.equal(normal.observed.saveCacheFirstDivergence, null); assert.deepEqual(normal.observed.secondSaveFailures, []);
  cases.push("Qualified normal successful dirty state adds no diagnostic await or capture");
  const originalFirst = { boundary: "dirty_state_dom", scenarioIndex: 9 }, originalTimeline = { events: [{ sequence: 1, kind: "input" }] };
  const later = await observeEarly("false", false, { first: originalFirst, timeline: originalTimeline });
  assert.equal(later.captures, 0); assert.equal(later.observed.saveCacheFirstDivergence, originalFirst); assert.equal(later.observed.saveCacheFailureTimeline, originalTimeline);
  const absent = await observeEarly(null), unknown = await observeEarly("private-unexpected-attribute");
  assert.equal((absent.observed.saveCacheFirstDivergence as Record<string, unknown>).observed, "missing");
  assert.equal((unknown.observed.saveCacheFirstDivergence as Record<string, unknown>).observed, "unexpected");
  assert.equal(JSON.stringify(unknown.observed.saveCacheFirstDivergence).includes("private"), false);
  cases.push("Qualified diagnostics never replace the first timeline or disclose unexpected raw DOM values");
  const original = new assert.AssertionError({ message: "controlled aggregate failure after closed page" });
  let retained: Record<string, unknown> | undefined;
  const preserve = new Function("assert", "ports", ts.transpileModule(`return (async()=>{
    let primaryFailed=false,saveCacheObservedAssertionFailure=false,saveCacheDiagnosticCaptureFailed=false,saveCacheOriginalFailure=null;
    let saveCacheFirstDivergence=ports.first,saveCacheFailureTimeline=ports.timeline;
    const fixtureTimings={diagnosticCollectionMs:0},fixtureStarted=performance.now(),saveCacheOnly=true,saveCacheDiagnosticPage=ports.page,passed=7,error=ports.original,snapshotSaveCacheDiagnostic=ports.capture;
    try ${mainCatch.block.getText(source)} finally {ports.inspect({saveCacheFirstDivergence,saveCacheFailureTimeline,saveCacheOriginalFailure});}
  })();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText) as (assertPort: typeof assert, ports: Record<string, unknown>) => Promise<void>;
  await assert.rejects(preserve(assert, { original, first: originalFirst, timeline: originalTimeline, capture: captureCallback,
    page: { isClosed: () => true, evaluate: () => { assert.fail("A later closed page must not replace earlier evidence."); } },
    inspect: (value: Record<string, unknown>) => { retained = value; } }), error => error === original);
  assert.equal(retained?.saveCacheFirstDivergence, originalFirst); assert.equal(retained?.saveCacheFailureTimeline, originalTimeline);
  const aggregate = retained?.saveCacheOriginalFailure as Record<string, unknown>;
  assert.ok(typeof aggregate.observedElapsedMs === "number" && Number.isFinite(aggregate.observedElapsedMs) && aggregate.observedElapsedMs >= 0);
  assert.deepEqual({ ...aggregate, observedElapsedMs: undefined }, { name: "AssertionError", code: "ERR_ASSERTION", assertionOrdinal: 8, observedElapsedMs: undefined });
  cases.push("Qualified aggregate assertion preserves original Error and earlier proof after its page closes");
  const inaccessibleName = Object.defineProperty(new Error("private original error text"), "name", { get() { throw Error("secondary metadata getter failure"); } });
  await assert.rejects(preserve(assert, { original: inaccessibleName, first: originalFirst, timeline: originalTimeline, capture: captureCallback,
    page: { isClosed: () => true }, inspect: (value: Record<string, unknown>) => { retained = value; } }), error => error === inaccessibleName);
  const fallback = retained?.saveCacheOriginalFailure as Record<string, unknown>;
  assert.ok(typeof fallback.observedElapsedMs === "number" && Number.isFinite(fallback.observedElapsedMs) && fallback.observedElapsedMs >= 0);
  assert.deepEqual({ ...fallback, observedElapsedMs: undefined }, { name: "UNKNOWN", code: null, assertionOrdinal: null, observedElapsedMs: undefined });
  cases.push("Qualified diagnostics keep the original Error when optional error metadata cannot be read");
  const diagnosticReceipts: ts.ObjectLiteralExpression[] = [];
  const findReceipt = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "diagnostics" && ts.isObjectLiteralExpression(node.initializer))
      diagnosticReceipts.push(node.initializer);
    ts.forEachChild(node, findReceipt);
  };
  findReceipt(source); assert.equal(diagnosticReceipts.length, 1);
  check("actual diagnostic receipt separates first observation original failure native exit and unavailable causal evidence", () => {
    const values = { primaryFailed: true, saveCacheFailureTimeline: originalTimeline, saveCacheObservedAssertionFailure: true,
      saveCacheFirstDivergence: originalFirst, passed: 7, saveCacheOriginalFailure: { name: "AssertionError", code: "ERR_ASSERTION", assertionOrdinal: 8, observedElapsedMs: 25 },
      process: { version: "controlled-node", versions: { v8: "controlled-v8" }, platform: "controlled-platform", arch: "controlled-arch", env: { SECRET: "private" } },
      saveCacheDiagnosticCaptureFailed: false, saveCacheDiagnosticSummaries: [], saveCacheDiagnosticMode: "light" };
    const evaluate = new Function(...Object.keys(values), "return (" + diagnosticReceipts[0].getText(source) + ");");
    const receipt = evaluate(...Object.values(values)) as Record<string, unknown>;
    assert.equal(receipt.firstProvenDivergence, originalFirst); assert.deepEqual(receipt.originalFailure, values.saveCacheOriginalFailure);
    assert.deepEqual(receipt.originalExit, { value: null, owner: "canonical_parent_process_receipt", status: "NOT_YET_OBSERVED_BY_FIXTURE" });
    assert.equal(receipt.owner, "src/components/admin/ui/AdminFormRuntime.tsx");
    assert.equal(receipt.consumer, "scripts/qa-admin-form-guarded-navigation.mts#SaveCacheFlow");
    assert.equal(receipt.evidenceConfidence, "observed_dom_contract_boundary_only");
    assert.ok((receipt.missingEvidence as string[]).includes("Causal owner of divergence UNKNOWN"));
    assert.ok((receipt.missingEvidence as string[]).includes("Deep pre-failure metadata was not recorded in light mode"));
    assert.equal(JSON.stringify(receipt).includes("private"), false);
    assert.equal(receipt.fieldContentsRecorded, false); assert.equal(receipt.schedulingAdded, false);
  });
  type CleanupResource = { resource: "browser" | "server" | "temp"; close: () => Promise<void> };
  type CleanupResult = { resource: CleanupResource["resource"]; status: "PASS" | "FAIL"; error?: unknown };
  type DeniedRequest = { method: string; origin: string | null; resourceType: string };
  type RoutePort = {
    request: () => { url: () => string; method: () => string; resourceType: () => string };
    fallback: () => Promise<void>;
    abort: (reason: string) => Promise<void>;
  };
  type FenceHandler = (route: RoutePort) => Promise<void>;
  type HarnessApi = {
    settleGuardedNavigationCleanup: (resources: readonly CleanupResource[]) => Promise<CleanupResult[]>;
    installSaveCacheNetworkFence: (page: { route: (pattern: string, handler: FenceHandler) => Promise<void> }, url: string, denied: DeniedRequest[]) => Promise<void>;
  };
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const declarations = ["settleGuardedNavigationCleanup", "installSaveCacheNetworkFence"].map(name => {
    const matches = source.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(matches.length, 1, "The qualified fixture retains one original " + name + " owner.");
    return matches[0].getText(source);
  }).join("\n");
  const load = (text = declarations) => new Function(compile(text) + "; return { settleGuardedNavigationCleanup, installSaveCacheNetworkFence };")() as HarnessApi;
  const api = load(), resources = ["browser", "server", "temp"] as const;
  for (const [label, failures, synchronous] of [
    ["all cleanup succeeds", [], false], ["first cleanup rejects", [0], false], ["middle cleanup rejects", [1], false],
    ["last cleanup rejects", [2], false], ["first cleanup throws synchronously", [0], true], ["every cleanup rejects", [0, 1, 2], false],
  ] as const) {
    const calls: string[] = [], errors = new Map<number, Error>();
    for (const index of failures) errors.set(index, new Error("controlled-" + resources[index] + "-cleanup-failure"));
    const actual = await api.settleGuardedNavigationCleanup(resources.map((resource, index) => ({ resource, close: () => {
      calls.push(resource);
      const error = errors.get(index);
      if (error && synchronous) throw error;
      return error ? Promise.reject(error) : Promise.resolve();
    } })));
    assert.deepEqual(calls, resources, "A cleanup failure cannot skip any later resource.");
    assert.deepEqual(actual.map(row => row.resource), resources);
    actual.forEach((row, index) => {
      assert.equal(row.status, errors.has(index) ? "FAIL" : "PASS");
      assert.equal(row.error, errors.get(index), "Cleanup preserves each failure identity.");
    });
    cases.push("Qualified Form harness: " + label + " still attempts all cleanup resources");
  }
  const harnessUrl = "http://127.0.0.1:43127/harness";
  const fenceCase = async (actualApi: HarnessApi, requestUrl: string, allowed: boolean, portFailure?: "fallback" | "abort") => {
    let handler: FenceHandler | undefined;
    const denied: DeniedRequest[] = [], events: string[] = [], expected = new Error("controlled-route-port-failure");
    await actualApi.installSaveCacheNetworkFence({ route: async (pattern, value) => { assert.equal(pattern, "**/*"); handler = value; } }, harnessUrl, denied);
    assert.ok(handler, "The fence is actually registered before fixture navigation.");
    const route: RoutePort = { request: () => ({ url: () => requestUrl, method: () => "GET", resourceType: () => "fetch" }),
      fallback: async () => { events.push("fallback"); if (portFailure === "fallback") throw expected; },
      abort: async reason => { assert.equal(reason, "blockedbyclient"); events.push("abort"); if (portFailure === "abort") throw expected; } };
    if (portFailure) await assert.rejects(handler(route), error => error === expected);
    else await handler(route);
    assert.deepEqual(events, [allowed ? "fallback" : "abort"]);
    assert.equal(denied.length, allowed ? 0 : 1);
    if (!allowed) {
      assert.deepEqual(Object.keys(denied[0]).sort(), ["method", "origin", "resourceType"]);
      assert.equal(denied[0].method, "GET"); assert.equal(denied[0].resourceType, "fetch");
    }
  };
  for (const [label, requestUrl, allowed] of [
    ["owned document", harnessUrl, true], ["owned API stub", "http://127.0.0.1:43127/api/admin/entity-lists/topics?page=1", true],
    ["foreign origin", "https://example.invalid/path?private=value", false], ["deceptive hostname", "http://127.0.0.1.example.invalid:43127/harness", false],
    ["different port", "http://127.0.0.1:43128/harness", false], ["userinfo camouflage", "http://127.0.0.1:43127@example.invalid/harness", false],
    ["foreign matching API path", "https://example.invalid/api/admin/entity-lists/topics?page=1", false], ["malformed URL", "not a URL", false],
    ["inline data", "data:text/plain,controlled", true], ["owned blob", "blob:http://127.0.0.1:43127/controlled", true],
    ["foreign blob", "blob:https://example.invalid/controlled", false], ["opaque blob", "blob:null/controlled", false],
  ] as const) {
    await fenceCase(api, requestUrl, allowed);
    cases.push("Qualified Form harness network fence: " + label);
  }
  await fenceCase(api, harnessUrl, true, "fallback");
  await fenceCase(api, "https://example.invalid/path", false, "abort");
  cases.push("Qualified Form harness propagates allowed-route and denied-route transport failures");
  const broadBlob = declarations.replace('target.protocol === "data:"', '["data:", "blob:"].includes(target.protocol)');
  assert.notEqual(broadBlob, declarations);
  await assert.rejects(fenceCase(load(broadBlob), "blob:https://example.invalid/controlled", false));
  cases.push("Qualified Form harness rejects a broadened foreign-blob fence mutation");
  check("Qualified Form harness source retains exact canonical flag, thirteen scenarios, primary failure and post-cleanup PASS boundary", () => {
    const scripts = (JSON.parse(readSource("package.json")) as { scripts: Record<string, string> }).scripts;
    assert.equal(scripts["qa:admin-form-guarded-navigation"], "node --experimental-strip-types scripts/qa-admin-form-guarded-navigation.mts");
    const main = source.statements.find((node): node is ts.TryStatement => ts.isTryStatement(node));
    assert.ok(main?.catchClause && main.finallyBlock);
    const parameter = main.catchClause.variableDeclaration?.name.getText(source);
    assert.ok(parameter);
    assert.ok(main.catchClause.block.statements.some(node => ts.isThrowStatement(node) && node.expression?.getText(source) === parameter), "The main body rethrows its original failure object.");
    assert.ok(main.catchClause.block.getText(source).includes("primaryFailed = true"));
    const throws: ts.ThrowStatement[] = [], visit = (node: ts.Node) => { if (ts.isThrowStatement(node)) throws.push(node); ts.forEachChild(node, visit); };
    visit(main.finallyBlock); assert.equal(throws.length, 1);
    assert.ok(ts.isIfStatement(throws[0].parent) && throws[0].parent.expression.getText(source) === "!primaryFailed", "Cleanup may throw only when no primary failure is pending.");
    assert.ok(throws[0].expression && ts.isNewExpression(throws[0].expression) && throws[0].expression.expression.getText(source) === "AggregateError");
    const scenarioLoops = main.tryBlock.statements.filter((node): node is ts.ForOfStatement => ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer) && node.initializer.declarations.some(value => value.name.getText(source) === "scenario"));
    assert.equal(scenarioLoops.length, 1);
    const expression = scenarioLoops[0].expression;
    assert.ok(ts.isConditionalExpression(expression) && ts.isArrayLiteralExpression(expression.whenFalse));
    assert.equal(expression.whenFalse.elements.length, 13);
    const strictFlag = source.statements.find(node => ts.isIfStatement(node) && node.expression.getText(source) === "saveCacheOnly"
      && node.getText(source).includes("assert.deepEqual(process.argv.slice(2), saveCacheDiagnosticMode"));
    const temporaryDirectory = source.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(value => value.name.getText(source) === "tempDir"));
    assert.ok(strictFlag && temporaryDirectory && strictFlag.end < temporaryDirectory.getStart(source), "Bounded flag rejection precedes resource creation.");
    const finalPass = source.statements.at(-1);
    assert.ok(finalPass && ts.isExpressionStatement(finalPass) && finalPass.getText(source).includes("qa:admin-form-guarded-navigation passed") && finalPass.getStart(source) > main.end, "The final PASS cannot precede cleanup.");
    assert.ok(main.finallyBlock.getText(source).includes('proofLevel: "shared_owner_controlled_browser_behavior"'));
    assert.ok(main.finallyBlock.getText(source).includes("nativePersistenceVerified: false"));
    assert.ok(main.finallyBlock.getText(source).includes("businessConsumerAdoptionVerified: false"));
  });
}

/** Real imported compiler contracts plus source-bound union/member checks, not native execution evidence. */
function verifyWindowsOwnedProcessContracts() {
  function verifyNativeBuildPublicationControls() {
    const capturedNativeSource = Buffer.from(readSource("scripts/lib/windows-owned-process.cs"));
    const nativeFile = "scripts/lib/windows-owned-process.mts", nativeSource = ts.createSourceFile(nativeFile, readSource(nativeFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const actual = ["hash", "build", "nativeBuild"].map(name => {
      const node = nativeSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name
        || ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(nativeSource) === name));
      assert.ok(node); return node.getText(nativeSource);
    }).join("\n");
    type Built = Extract<ReturnType<typeof windowsOwnedProcessCapability>, { status: "PASS" }>["native"];
    type Mutation = "source" | "snapshot" | "compiler" | "reference";
    const setup = (options: { mutateDuringCompile?: Mutation; failProvenanceOnce?: boolean; corruptProvenanceOnce?: boolean } = {}) => {
      const fixtureRoot = path.resolve(root, ".tmp-qa", "controlled-native-build-no-files"), systemRoot = path.join(fixtureRoot, "controlled-windows");
      const framework = path.join(systemRoot, "Microsoft.NET/Framework64/v4.0.30319"), source = path.join(fixtureRoot, "scripts/lib/windows-owned-process.cs"), compiler = path.join(framework, "csc.exe");
      const references = ["mscorlib.dll", "System.dll", "System.Core.dll", "System.Web.dll", "System.Web.Extensions.dll"].map(name => path.join(framework, name));
      const files = new Map<string, Buffer>([[source, Buffer.from(capturedNativeSource)], [compiler, Buffer.from("controlled compiler bytes")],
        ...references.map(file => [file, Buffer.from("controlled reference " + path.basename(file))] as const)]);
      const directories = new Set<string>([fixtureRoot]), writes: Array<{ file: string; flag: string }> = [], invocations: Array<{ snapshot: string; flags: string[] }> = [];
      let serial = 0, failProvenance = options.failProvenanceOnce ?? false, corruptProvenance = options.corruptProvenanceOnce ?? false;
      const failure = Error("Controlled native provenance write failure");
      const read = (file: string) => { const value = files.get(file); assert.ok(value, "Unexpected controlled native read: " + file); return Buffer.from(value); };
      const ports = {
        assert, ROOT: fixtureRoot, createHash, join: path.join, release: () => "10.0.19045",
        process: { platform: "win32", arch: "x64", version: "controlled-node", env: { SystemRoot: systemRoot, WINDIR: systemRoot, TEMP: fixtureRoot, TMP: fixtureRoot } },
        readFileSync: read, realpathSync: (file: string) => { assert.ok(files.has(file) || directories.has(file)); return file; },
        lstatSync: (file: string) => ({ isFile: () => files.has(file) }),
        mkdirSync: (directory: string, settings: { recursive: boolean }) => { assert.equal(settings.recursive, true); directories.add(directory); },
        mkdtempSync: (prefix: string) => { const directory = prefix + ++serial; assert.equal(directories.has(directory), false); directories.add(directory); return directory; },
        writeFileSync: (file: string, data: string | Buffer, settings: { flag: string }) => {
          assert.equal(settings.flag, "wx"); assert.equal(files.has(file), false); writes.push({ file, flag: settings.flag });
          if (path.basename(file) === "build.json" && failProvenance) { failProvenance = false; throw failure; }
          files.set(file, Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data));
          if (path.basename(file) === "build.json" && corruptProvenance) { corruptProvenance = false; files.set(file, Buffer.from("altered provenance write")); }
        },
        execFileSync: (binary: string, flags: string[], settings: { cwd: string; timeout: number; env: { NODE_ENV: string } }) => {
          assert.equal(binary, compiler); assert.equal(settings.cwd, fixtureRoot); assert.equal(settings.timeout, 60_000); assert.equal(settings.env.NODE_ENV, "test");
          const snapshot = flags.at(-1)!; assert.notEqual(snapshot, source); assert.deepEqual(read(snapshot), capturedNativeSource);
          assert.ok(writes.some(row => row.file === snapshot && row.flag === "wx")); invocations.push({ snapshot, flags: [...flags] });
          const output = flags.find(flag => flag.startsWith("/out:")); assert.ok(output); files.set(output.slice(5), Buffer.from("controlled executable " + invocations.length));
          const changed = { source, snapshot, compiler, reference: references[0]! };
          if (options.mutateDuringCompile) files.set(changed[options.mutateDuringCompile], Buffer.from("changed during controlled compilation"));
          return Buffer.alloc(0);
        },
      };
      const api = new Function(...Object.keys(ports), ts.transpileModule(actual, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
        + ";return {nativeBuild, inspectBuild:()=>build};")(...Object.values(ports)) as { nativeBuild(): Built; inspectBuild(): Built | undefined };
      return { api, files, writes, invocations, failure, source, compiler, references, read };
    };
    const results: string[] = [], prove = (name: string, run: () => void) => { run(); results.push(name); };
    prove("captured source compiles once and only fully verified provenance publishes immutable cached build", () => {
      const fixture = setup(), built = fixture.api.nativeBuild();
      assert.equal(fixture.invocations.length, 1); assert.equal(fixture.invocations[0]!.snapshot, built.sourceSnapshot);
      assert.equal(sha256(fixture.read(built.sourceSnapshot)), built.sourceSha256); assert.equal(sha256(fixture.read(built.provenance)), built.provenanceSha256);
      assert.equal(Object.isFrozen(built), true); assert.equal(Object.isFrozen(built.frameworkReferences), true);
      assert.ok(built.frameworkReferences.every(reference => Object.isFrozen(reference)));
      const writes = fixture.writes.length; assert.equal(fixture.api.inspectBuild(), built); assert.equal(fixture.api.nativeBuild(), built);
      assert.equal(fixture.invocations.length, 1); assert.equal(fixture.writes.length, writes);
    });
    for (const [mutation, message] of [["source", "Native source changed during compilation."], ["snapshot", "Native captured source changed during compilation."],
      ["compiler", "Native compiler changed during compilation."], ["reference", "Native framework input changed during compilation."]] as const) {
      prove(mutation + " mutation during compilation rejects without publishing cache", () => {
        const fixture = setup({ mutateDuringCompile: mutation });
        assert.throws(() => fixture.api.nativeBuild(), (error: unknown) => error instanceof Error && error.message.includes(message));
        assert.equal(fixture.api.inspectBuild(), undefined); assert.equal(fixture.invocations.length, 1);
        assert.equal(fixture.writes.some(row => path.basename(row.file) === "build.json"), false);
      });
    }
    prove("failed provenance write retains the failure and the next call compiles fresh before publishing", () => {
      const fixture = setup({ failProvenanceOnce: true }); assert.throws(() => fixture.api.nativeBuild(), error => error === fixture.failure);
      assert.equal(fixture.api.inspectBuild(), undefined); assert.equal(fixture.invocations.length, 1);
      const built = fixture.api.nativeBuild(); assert.equal(fixture.invocations.length, 2);
      assert.notEqual(fixture.invocations[0]!.snapshot, fixture.invocations[1]!.snapshot); assert.equal(fixture.api.inspectBuild(), built);
      assert.equal(sha256(fixture.read(built.provenance)), built.provenanceSha256);
    });
    prove("provenance readback mismatch rejects before cache publication", () => {
      const fixture = setup({ corruptProvenanceOnce: true });
      assert.throws(() => fixture.api.nativeBuild(), /Native build provenance was not preserved/u); assert.equal(fixture.api.inspectBuild(), undefined);
    });
    for (const [field, message] of [["provenance", "Native build provenance changed during this invocation."], ["sourceSnapshot", "Native captured source changed during this invocation."],
      ["compiler", "Native compiler changed during this invocation."]] as const) {
      prove("cached " + field + " byte tamper rejects without recompilation or spawn", () => {
        const fixture = setup(), built = fixture.api.nativeBuild(), writes = fixture.writes.length;
        fixture.files.set(built[field], Buffer.from("tampered cached input"));
        assert.throws(() => fixture.api.nativeBuild(), (error: unknown) => error instanceof Error && error.message.includes(message));
        assert.equal(fixture.invocations.length, 1); assert.equal(fixture.writes.length, writes);
      });
    }
    return { status: "PASS", scope: "actual_nativeBuild_hash_and_build_declarations_with_controlled_ports", checks: results.length, cases: results,
      operatingSystemWrites: 0, compilerProcessesExecuted: 0, nativeProcessesAllocated: 0,
      actualNativeSourceInput: "scripts/lib/windows-owned-process.cs", actualNativeSourceSha256: sha256(capturedNativeSource) };
  }
  const nativeBuildPublication = verifyNativeBuildPublicationControls();
  const identity: import("./lib/windows-owned-process.mts").WindowsJobIdentity = {
    jobToken: "00000000-0000-4000-8000-000000000000", helperPid: 11, rootPid: 12, rootPpid: 11,
    rootCreationTimeFileTime: "1", rootCreationTimeUtc: "2000-01-01T00:00:00.000Z",
    ownerJobAssignedBeforeResume: true, effectiveLimitFlags: 0x2000, jobHandleNonInheritable: true,
    jobBeforeResume: { totalProcesses: 1, activeProcesses: 1, processIds: [12] },
  };
  const identityPid = (value: import("./lib/windows-owned-process.mts").WindowsJobIdentity) => value.rootPid;
  assert.equal(identityPid(identity), 12); assert.equal(identity.ownerJobAssignedBeforeResume, true); assert.equal(identity.jobHandleNonInheritable, true);
  const receipt: import("./lib/windows-owned-process.mts").WindowsJobReceipt = { ...identity, status: "PASS", reason: "completed", rootExitCode: 9,
    resumeSucceeded: true, nativeFailure: null, cleanup: { status: "PASS", method: "windows-private-job", rootExitedBeforeCleanup: true,
      forcedTermination: false, activeProcessesBeforeCleanup: 0, activeProcessesAfterCleanup: 0, activeProcessIdsBeforeCleanup: [],
      activeProcessIdsAfterCleanup: [], totalProcesses: 1, rootHandleExited: true, processTreeVerified: true, jobHandleClosed: true } };
  const receiptCode = (value: import("./lib/windows-owned-process.mts").WindowsJobReceipt) => value.rootExitCode;
  assert.equal(receiptCode(receipt), 9); assert.equal(receiptCode({ ...receipt, rootPid: null, rootExitCode: null, resumeSucceeded: false }), null);
  const stopReasons: import("./lib/windows-owned-process.mts").WindowsStopReason[] = ["cancelled", "timeout", "output_limit", "owner_shutdown"];
  const compileOnly = false as boolean;
  if (compileOnly) {
    // @ts-expect-error Process identities retain the imported owner's numeric PID contract.
    identityPid({ ...identity, rootPid: "12" });
    // @ts-expect-error The original native DWORD/null exit cannot be replaced by a string.
    receiptCode({ ...receipt, rootExitCode: "9" });
    // @ts-expect-error Unknown control reasons do not enter the native cancellation protocol.
    const invalidReason: import("./lib/windows-owned-process.mts").WindowsStopReason = "arbitrary_shutdown";
    void invalidReason;
  }
  const file = "scripts/lib/windows-owned-process.mts", source = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const nativeSpawn = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "spawnWindowsOwnedProcess");
  assert.ok(nativeSpawn?.body, "Use the actual native launch owner for its preallocation deadline contract.");
  const nativeSpawnCode = ts.transpileModule(nativeSpawn.getText(source).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const nativeDeadlineValidation: { acceptedLimits: number[]; rejectedLimits: string[]; nativeProcessesAllocated: number } = { acceptedLimits: [], rejectedLimits: [], nativeProcessesAllocated: 0 };
  for (const limitMs of [1, 86_400_000, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, 86_400_001, 139_440_000, 2_147_483_647]) {
    check("actual native launch validates deadline before build evidence or process allocation: " + String(limitMs), () => {
      let builds = 0, evidenceReads = 0, launches = 0;
      const boundary = Error("Controlled native spawn boundary; no process allocation"), input = { args: ["-e", "0"], cwd: root, env: { NODE_ENV: "test" as const },
        identityPath: path.join(root, "controlled.identity.json"), receiptPath: path.join(root, "controlled.receipt.json"), limitMs };
      const api: Pick<typeof import("./lib/windows-owned-process.mts"), "spawnWindowsOwnedProcess"> = {
        spawnWindowsOwnedProcess: new Function("assert", "nativeBuild", "existsSync", "realpathSync", "dirname", "spawn", "process", nativeSpawnCode + ";return spawnWindowsOwnedProcess;")(
          assert, () => { builds++; return { executable: "controlled-native-executable" }; }, () => { evidenceReads++; return false; },
          (value: string) => { evidenceReads++; return value; }, path.dirname,
          (executable: string, args: string[]) => {
            launches++; assert.equal(executable, "controlled-native-executable");
            assert.deepEqual(args, ["--identity", input.identityPath, "--receipt", input.receiptPath, "--limit-ms", String(limitMs),
              "--cleanup-ms", "10000", "--", process.execPath, ...input.args]); throw boundary;
          }, { execPath: process.execPath }) as typeof import("./lib/windows-owned-process.mts").spawnWindowsOwnedProcess,
      };
      if (limitMs === 1 || limitMs === 86_400_000) {
        assert.throws(() => api.spawnWindowsOwnedProcess(input), error => error === boundary);
        assert.equal(builds, 1); assert.equal(launches, 1); assert.equal(evidenceReads, 4); nativeDeadlineValidation.acceptedLimits.push(limitMs);
      } else {
        assert.throws(() => api.spawnWindowsOwnedProcess(input), /Native owned process deadline must be a positive integer no greater than 86400000 ms/u);
        assert.equal(builds, 0); assert.equal(launches, 0); assert.equal(evidenceReads, 0); nativeDeadlineValidation.rejectedLimits.push(String(limitMs));
      }
    });
  }
  const declaration = (name: string) => { const node = source.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === name); assert.ok(node); return node; };
  const receiptType = declaration("WindowsJobReceipt"); assert.ok(ts.isIntersectionTypeNode(receiptType.type));
  const receiptBody = receiptType.type.types.find(ts.isTypeLiteralNode); assert.ok(receiptBody);
  const exitMember = receiptBody.members.find((node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(source) === "rootExitCode");
  assert.ok(exitMember?.type && ts.isUnionTypeNode(exitMember.type));
  assert.deepEqual(exitMember.type.types.map(node => node.kind === ts.SyntaxKind.NumberKeyword ? "number"
    : ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword ? "null" : "unreviewed").sort(), ["null", "number"]);
  const stopType = declaration("WindowsStopReason"); assert.ok(ts.isUnionTypeNode(stopType.type));
  assert.deepEqual(stopType.type.types.map(node => { assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)); return node.literal.text; }), stopReasons);
  let nativeIntegrity: Record<string, unknown> = { status: "NOT_APPLICABLE", platform: process.platform };
  if (process.platform === "win32") {
    const capability = windowsOwnedProcessCapability(); assert.ok(capability.status === "PASS");
    const native = capability.native, directory = path.dirname(native.executable), evidenceRoot = realpathSync(path.join(root, ".tmp-qa"));
    const nativeSource = readSource("scripts/lib/windows-owned-process.cs"), provenance = JSON.parse(readFileSync(native.provenance, "utf8")) as {
      sourceSha256: string; sourceSnapshot: string; executableSha256: string; compilerSha256: string; flags: string[] };
    assert.equal(native.sourceSha256, sha256(nativeSource)); assert.equal(readFileSync(native.sourceSnapshot, "utf8"), nativeSource);
    assert.equal(provenance.sourceSha256, native.sourceSha256); assert.equal(provenance.sourceSnapshot, native.sourceSnapshot);
    assert.equal(provenance.executableSha256, native.executableSha256); assert.equal(provenance.compilerSha256, native.compilerSha256);
    assert.equal(provenance.flags.at(-1), native.sourceSnapshot); assert.ok(!provenance.flags.includes(path.join(root, "scripts/lib/windows-owned-process.cs")));
    assert.equal(path.dirname(directory), evidenceRoot); assert.ok(path.basename(directory).startsWith("windows-native-build-"));
    assert.equal(realpathSync(native.executable), native.executable); assert.equal(lstatSync(native.executable).isFile(), true);
    assert.equal(Object.isFrozen(native), true); assert.equal(Object.isFrozen(native.frameworkReferences), true);
    assert.ok(native.frameworkReferences.length > 0 && native.frameworkReferences.every(reference => Object.isFrozen(reference)));
    const original = readFileSync(native.executable), originalHash = sha256(original), before = readdirSync(directory).sort();
    assert.equal(originalHash, native.executableSha256); assert.ok(original.length > 0);
    const changed = Buffer.from(original); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    let unexpected: ReturnType<typeof spawnWindowsOwnedProcess> | undefined;
    try {
      writeFileSync(native.executable, changed, { flag: "r+" });
      assert.throws(() => { unexpected = spawnWindowsOwnedProcess({ args: ["-e", "throw Error('integrity rejection must precede execution')"], cwd: directory,
        env: { NODE_ENV: "test" }, identityPath: path.join(directory, "integrity-must-not-start.identity.json"),
        receiptPath: path.join(directory, "integrity-must-not-start.receipt.json"), limitMs: 2_000 }); }, /Native executable changed during this invocation/u);
    } finally {
      writeFileSync(native.executable, original, { flag: "r+" });
      // An unexpected launch is a test failure; containment uses its retained helper handle only.
      if (unexpected && unexpected.child.exitCode === null && unexpected.child.signalCode === null) unexpected.child.kill();
    }
    assert.equal(unexpected, undefined); assert.deepEqual(readFileSync(native.executable), original); assert.equal(sha256(readFileSync(native.executable)), originalHash);
    assert.deepEqual(readdirSync(directory).sort(), before); assert.equal(windowsOwnedProcessCapability().status, "PASS");
    nativeIntegrity = { status: "PASS", immutableBuildAndFrameworkReferences: true, modifiedOwnedExecutableRejectedBeforeSpawn: true,
      originalExecutableRestored: true, executableSha256: originalHash, actualRootProcessesAllocated: 0 };
  } else if (process.platform === "linux") {
    const capability = windowsOwnedProcessCapability(); assert.equal(capability.status, "BLOCKED");
    nativeIntegrity = { status: "PASS", scope: "non_windows_platform_rejection_before_compiler_or_spawn", capabilityStatus: capability.status,
      platform: process.platform, nativeExecuted: false, compilerProcessesExecuted: 0, actualRootProcessesAllocated: 0 };
  }
  return { status: "PASS", scope: "imported_type_value_vectors_and_source_contracts_only", nativeRootProcessesAllocated: 0,
    identityMemberVectors: 3, receiptNumberAndNullVectors: 2, compilerNegativeVectorsDeclared: 3, compilerNegativeProof: "requires actual TypeScript check",
    sourceContracts: ["rootExitCode nullable number", "exact permitted stop reasons"], nativeIntegrity, nativeBuildPublication, nativeDeadlineValidation };
}

/** Independent retained PROCESS handles prove abrupt closure without retaining a JOB handle. */
async function verifyWindowsClosureAcceptanceControls() {
  if (process.platform !== "win32") return { status: "NOT_APPLICABLE", platform: process.platform };
  const directory = realpathSync(mkdtempSync(path.join(root, ".tmp-qa", "windows-closure-controls-")));
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"]) if (process.env[key] !== undefined) environment[key] = process.env[key];
  const { runOwnedVerificationChild } = await import("./lib/isolated-public-verification.mts");
  const sourceFile = ts.createSourceFile("verify-isolated-supabase.mts", readSource("scripts/verify-isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const shared = sourceFile.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "verifySharedChildControls");
  assert.ok(shared);
  const treeDeclarations: ts.VariableDeclaration[] = [];
  const findTree = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === "tree" && node.initializer && ts.isArrowFunction(node.initializer)
    && node.initializer.getText(sourceFile).includes("25_000")) treeDeclarations.push(node); ts.forEachChild(node, findTree); };
  findTree(shared); assert.equal(treeDeclarations.length, 1);
  // Reuse the actual existing finite detached root/child/grandchild fixture.
  const tree = new Function(ts.transpileModule("const " + treeDeclarations[0]!.getText(sourceFile) + ";", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return tree;")() as (onReady?: string) => string;
  type Identity = import("./lib/windows-owned-process.mts").WindowsJobIdentity;
  type FailedResult = { code: number | null; signal: NodeJS.Signals | null; helperExit?: { code: number | null; signal: NodeJS.Signals | null };
    nativeJobIdentity: Identity | null; nativeJobReceipt: unknown; cleanup: { status: string }; reason: string };
  type Observation = ReturnType<typeof startWindowsClosureObservation>;
  const children = new Set<ChildProcess>(), rawChildren = new Set<ChildProcess>(), observations = new Set<Observation>();
  const rawEvidence = new Map<ChildProcess, { name: string; stdout: string; stderr: string }>();
  const controllers = new Set<AbortController>(), outcomes: Promise<unknown>[] = [], proofs: Array<Record<string, unknown>> = [], completedControls: string[] = [];
  let currentContext: Record<string, unknown> = {}, primaryFailure: unknown;
  const context = { runDirectory: directory, sanitize: (value: string) => value, cleanEnvironment: () => ({ ...environment }) };
  const launch = (name: string, args: string[], limitMs = 20_000) => {
    const previous = new Set(children), controller = new AbortController(); controllers.add(controller);
    const pending = runOwnedVerificationChild({ sourceDirectory: directory, context, children, signal: controller.signal }, args, { ...environment }, name, limitMs);
    const outcome = pending.then(value => value, (error: unknown) => error); outcomes.push(outcome);
    const helper = [...children].find(child => !previous.has(child)); assert.ok(helper);
    return { name, helper, controller, outcome };
  };
  const close = (child: ChildProcess) => !child.pid || child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise<void>(done => child.once("close", () => done()));
  const retainRaw = (child: ChildProcess, name: string) => {
    rawChildren.add(child); const evidence = { name, stdout: "", stderr: "" }; rawEvidence.set(child, evidence);
    child.stdout!.on("data", (bytes: Buffer) => { evidence.stdout = (evidence.stdout + String(bytes)).slice(0, 131_072); });
    child.stderr!.on("data", (bytes: Buffer) => { evidence.stderr = (evidence.stderr + String(bytes)).slice(0, 131_072); });
  };
  const messages = (child: ChildProcess) => {
    let output = ""; const waiters = new Set<() => void>();
    const data = (bytes: Buffer) => { output += String(bytes); assert.ok(output.length <= 131_072, "Owned closure fixture output exceeded its bound."); for (const waiter of waiters) waiter(); };
    child.stdout!.on("data", data);
    return { next: (prefix: string) => new Promise<string>((done, reject) => {
      const finish = (error?: Error, line?: string) => { clearTimeout(timer); waiters.delete(read); child.off("close", closed); child.off("error", failed); if (error) reject(error); else done(line!); };
      const read = () => { const line = output.split("\n").slice(0, -1).find(row => row.startsWith(prefix)); if (line !== undefined) finish(undefined, line.slice(prefix.length)); };
      const closed = () => finish(Error("Owned closure fixture closed before its required message.")), failed = () => finish(Error("Owned closure fixture failed before readiness."));
      const timer = setTimeout(() => finish(Error("Owned closure fixture message exceeded its finite bound.")), 8_000);
      waiters.add(read); child.once("close", closed); child.once("error", failed); read();
    }), dispose: () => child.stdout!.off("data", data) };
  };
  const identity = (helper: ChildProcess): Identity => {
    const value = (helper as ChildProcess & { verificationWindowsIdentity(): Identity | null }).verificationWindowsIdentity(); assert.ok(value); return value;
  };
  const checkpoint = async (helper: ChildProcess) => {
    const value = await requestWindowsClosureCheckpoint(helper);
    assert.equal(value.checkpoint.membershipCompleteAtCapture, true); assert.equal(value.checkpoint.jobHandlesExported, 0);
    assert.equal(value.checkpoint.jobHandleNonInheritable, true); assert.equal(value.checkpoint.effectiveLimitFlags, 0x2000); return value;
  };
  const observe = (owner: Identity, checkpointPath: string, observationPath: string, deadlineMs = 6_000) => {
    const value = startWindowsClosureObservation({ identity: owner, checkpointPath, observationPath, deadlineMs, env: { ...environment } }); observations.add(value); return value;
  };
  const cancelled = async (job: ReturnType<typeof launch>) => {
    job.controller.abort(Error("Controlled final cleanup of this exact owned job"));
    const error = await job.outcome; assert.ok(error instanceof Error);
    const retained = (error as Error & { childResult: FailedResult }).childResult;
    assert.equal(retained.reason, "cancelled"); assert.equal(retained.cleanup.status, "PASS");
    const receipt = retained.nativeJobReceipt as import("./lib/windows-owned-process.mts").WindowsJobReceipt;
    assert.equal(receipt.cleanup.activeProcessesAfterCleanup, 0); assert.deepEqual(receipt.cleanup.activeProcessIdsAfterCleanup, []); return retained;
  };
  const control = async (name: string, run: () => Promise<void>) => {
    currentContext = { control: name, startedUtc: new Date().toISOString() };
    try {
      await run(); completedControls.push(name); cases.push("Windows closure acceptance " + name);
      writeFileSync(path.join(directory, "control-progress-" + completedControls.length + ".json"), JSON.stringify({ schema: 1, completedControls, proofs, currentContext }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    }
    catch (error) {
      try { writeFileSync(path.join(directory, "control-failure.json"), JSON.stringify({ control: name, message: error instanceof Error ? error.message : String(error),
        completedControls, proofs, currentContext, originalFailurePreserved: true }, null, 2) + "\n", { flag: "wx", mode: 0o600 }); }
      catch (evidenceError) { if (error instanceof Error) Object.defineProperty(error, "controlFailureEvidenceError", { value: evidenceError }); }
      throw error;
    }
  };
  let qualifiedInput: Parameters<typeof qualifyWindowsClosureEvidence>[0] | undefined;
  try {
    for (const kind of ["owner-death", "last-handle-close"] as const) await control(kind + " retains complete live native handles before closure and signals them within one deadline", async () => {
      const sentinel = spawn(process.execPath, ["-e", "process.stdin.setEncoding('utf8');process.stdin.on('data',v=>process.stdout.write('echo:'+v));process.stdout.write('sentinel-ready\\n');setTimeout(()=>process.exit(0),25000);"],
        { cwd: directory, env: { ...environment }, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }); retainRaw(sentinel, kind + "-sentinel");
      const sentinelMessages = messages(sentinel); await sentinelMessages.next("sentinel-ready");
      const jobB = launch(kind + "-independent-b", ["-e", tree()]), bMessages = messages(jobB.helper);
      const treeB = JSON.parse(await bMessages.next("tree:")) as { root: { pid: number }; middle: { pid: number }; leaf: { pid: number } };
      const bIdentity = identity(jobB.helper);
      let owner: ChildProcess | undefined, jobA: ReturnType<typeof launch> | undefined, ownerMessages: ReturnType<typeof messages>;
      let aIdentity: Identity, aCheckpoint: Awaited<ReturnType<typeof requestWindowsClosureCheckpoint>>;
      let treeA: { root: { pid: number }; middle: { pid: number }; leaf: { pid: number } };
      if (kind === "owner-death") {
        const ownerDirectory = realpathSync(mkdtempSync(path.join(directory, "nested-owner-"))), ownerHref = new URL("./lib/isolated-public-verification.mts", import.meta.url).href;
        const nativeHref = new URL("./lib/windows-owned-process.mts", import.meta.url).href;
        const code = `const{runOwnedVerificationChild}=await import(${JSON.stringify(ownerHref)});const{requestWindowsClosureCheckpoint}=await import(${JSON.stringify(nativeHref)});const env=${JSON.stringify(environment)},children=new Set();const pending=runOwnedVerificationChild({sourceDirectory:${JSON.stringify(directory)},context:{runDirectory:${JSON.stringify(ownerDirectory)},sanitize:v=>v,cleanEnvironment:()=>({...env})},children,signal:new AbortController().signal},['-e',${JSON.stringify(tree())}],env,'closure-owner-a',20000);pending.catch(()=>{});const child=[...children][0];let output='';await new Promise((done,reject)=>{child.stdout.on('data',v=>{process.stdout.write(v);output+=v;if(output.includes('tree:'))done();});child.once('error',reject);});const proof=await requestWindowsClosureCheckpoint(child);process.stdout.write('checkpoint:'+JSON.stringify(proof)+'\\n');setTimeout(()=>process.exit(17),22000);`;
        owner = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], { cwd: root, env: { ...environment }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); retainRaw(owner, "nested-owner");
        ownerMessages = messages(owner); aCheckpoint = JSON.parse(await ownerMessages.next("checkpoint:")) as typeof aCheckpoint;
        treeA = JSON.parse(await ownerMessages.next("tree:")) as typeof treeA;
        aIdentity = JSON.parse(readFileSync(path.join(ownerDirectory, "public-closure-owner-a.native-identity.json"), "utf8")) as Identity;
      } else {
        jobA = launch("closure-last-a", ["-e", tree()]); ownerMessages = messages(jobA.helper); treeA = JSON.parse(await ownerMessages.next("tree:")) as typeof treeA;
        aIdentity = identity(jobA.helper); aCheckpoint = await checkpoint(jobA.helper);
      }
      currentContext = { ...currentContext, nativeJobIdentity: aIdentity, checkpoint: aCheckpoint, fixtureTree: treeA, independentIdentity: bIdentity };
      assert.notEqual(aIdentity.jobToken, bIdentity.jobToken);
      assert.equal(aCheckpoint.checkpoint.activeProcesses, aCheckpoint.checkpoint.members.length);
      assert.equal(aCheckpoint.checkpoint.activeProcesses, aCheckpoint.checkpoint.processIds.length);
      assert.ok([treeA.root.pid, treeA.middle.pid, treeA.leaf.pid].every(pid => aCheckpoint.checkpoint.processIds.includes(pid)), "Every actual detached fixture member belongs to the complete native snapshot.");
      const observationPath = path.join(path.dirname(aCheckpoint.checkpointPath), kind + ".observation.json"), observer = observe(aIdentity, aCheckpoint.checkpointPath, observationPath);
      const ready = await observer.ready; currentContext = { ...currentContext, ready }; assert.equal(ready.allHandlesLive, true); assert.equal(ready.processHandlesOnly, true);
      const target = owner ?? jobA!.helper, targetClosed = close(target); assert.equal(target.kill(), true); await targetClosed;
      const trigger = { retainedChildPid: target.pid, code: target.exitCode, signal: target.signalCode, triggerUtc: new Date().toISOString() };
      currentContext = { ...currentContext, trigger };
      const closure = await observer.completed; currentContext = { ...currentContext, closure }; assert.equal(closure.status, "PASS"); assert.equal(closure.liveProcesses, 0); assert.equal(closure.jobQueriedAfterClosure, false);
      assert.equal(closure.certificate.observation.allMembersSignaled, true); assert.equal(closure.certificate.observation.helperSignaled, true);
      assert.deepEqual(closure.certificate.observation.members.map(member => member.pid).sort((a, b) => a - b), [...aCheckpoint.checkpoint.processIds].sort((a, b) => a - b));
      assert.equal(closure.certificate.jobHandlesRetained, 0); assert.equal(closure.certificate.allObservationHandlesClosed, true);
      assert.equal(closure.certificate.processAccessMask, 0x101000); assert.equal(closure.certificate.processHandlesInheritable, false);
      assert.equal(closure.certificate.observationHandleCount, aCheckpoint.checkpoint.members.length + 1);
      assert.equal(closure.certificate.closedObservationHandleCount, closure.certificate.observationHandleCount);
      qualifiedInput = { identity: aIdentity, checkpoint: aCheckpoint.checkpoint, ready, certificate: closure.certificate,
        observerExit: { code: observer.child.exitCode, signal: observer.child.signalCode } };
      assert.equal(qualifyWindowsClosureEvidence(qualifiedInput).status, "PASS");
      let executionEvidence: unknown;
      if (jobA) {
        const error = await jobA.outcome; assert.ok(error instanceof Error && /cleanup failed/u.test(error.message));
        const retained = (error as Error & { childResult: FailedResult }).childResult;
        currentContext = { ...currentContext, originalExecutionFailure: { message: error.message, childResult: retained } };
        assert.equal(retained.nativeJobReceipt, null); assert.equal(retained.cleanup.status, "FAIL"); assert.equal(retained.code, null); assert.equal(retained.signal, null);
        assert.deepEqual(retained.helperExit, { code: jobA.helper.exitCode, signal: jobA.helper.signalCode }); children.delete(jobA.helper); executionEvidence = retained;
      } else {
        const receiptPath = aCheckpoint.checkpointPath.replace(/\.native-identity\.json\.closure\.json$/u, ".native-result.json");
        let receipt: unknown = null; if (existsSync(receiptPath)) { try { receipt = JSON.parse(readFileSync(receiptPath, "utf8")); } catch { /* Original corrupt bytes remain in the owned evidence directory. */ } }
        executionEvidence = { nativeJobReceipt: receipt, rootExit: receipt === null ? { code: null, signal: null } : "retained in native receipt",
          nativeTerminalReceiptAvailable: receipt !== null, outerRunLostWithOwner: true, executionQualified: false };
      }
      // A fresh native capture after A closes proves independent B is still an actual live job.
      const bCheckpoint = await checkpoint(jobB.helper);
      assert.equal(bCheckpoint.checkpoint.activeProcesses, bCheckpoint.checkpoint.members.length);
      assert.equal(bCheckpoint.checkpoint.activeProcesses, bCheckpoint.checkpoint.processIds.length);
      assert.ok([treeB.root.pid, treeB.middle.pid, treeB.leaf.pid].every(pid => bCheckpoint.checkpoint.processIds.includes(pid)), "Independent B retains every fixture member within its complete native snapshot.");
      sentinel.stdin!.write(kind + "-after-a\n"); assert.equal(await sentinelMessages.next("echo:"), kind + "-after-a");
      assert.equal(sentinel.exitCode, null); assert.equal(sentinel.signalCode, null);
      const bResult = await cancelled(jobB);
      proofs.push({ control: kind, trigger, checkpoint: aCheckpoint, ready, closure, observationPath, executionEvidence,
        sentinel: { pid: sentinel.pid, respondedAfterClosure: true }, independentJob: { identity: bIdentity, checkpoint: bCheckpoint, result: bResult } });
      sentinelMessages.dispose(); bMessages.dispose(); ownerMessages.dispose(); const sentinelClosed = close(sentinel); sentinel.kill(); await sentinelClosed;
    });
    await control("actual observer timeout retains BLOCKED evidence while its owned job remains live", async () => {
      const job = launch("closure-observer-timeout", ["-e", tree()]), output = messages(job.helper); await output.next("tree:");
      const owner = identity(job.helper), captured = await checkpoint(job.helper), observationPath = path.join(directory, "observer-timeout.json");
      const observer = observe(owner, captured.checkpointPath, observationPath, 500); await observer.ready;
      const error = await observer.completed.then(value => value, (failure: unknown) => failure); currentContext = { ...currentContext, checkpoint: captured, observationPath,
        originalObserverFailure: error instanceof Error ? { message: error.message, observation: (error as Error & { closureObservation?: unknown }).closureObservation } : error }; assert.ok(error instanceof Error);
      const retained = (error as Error & { closureObservation: { certificate: { status: string }; observerExit: { code: number | null }; observationPath: string } }).closureObservation;
      assert.equal(retained.certificate.status, "BLOCKED"); assert.notEqual(retained.observerExit.code, 0); assert.equal(retained.observationPath, observationPath);
      assert.equal(job.helper.exitCode, null); assert.equal(job.helper.signalCode, null);
      const result = await cancelled(job); output.dispose(); proofs.push({ control: "observer_timeout", retained, result });
    });
    await control("breakaway is denied or the suspended candidate remains in the exact private ancestor job", async () => {
      const capability = windowsOwnedProcessCapability(); assert.ok(capability.status === "PASS");
      const readyPath = path.join(directory, "breakaway-ready.json"), releasePath = readyPath + ".release.json";
      const program = `const{spawnSync}=require('node:child_process');const p=spawnSync(${JSON.stringify(capability.native.executable)},['--probe-breakaway',process.execPath,${JSON.stringify(readyPath)}],{encoding:'utf8',windowsHide:true,timeout:8000});process.stdout.write('probe:'+JSON.stringify({status:p.status,signal:p.signal,stdout:p.stdout,stderr:p.stderr,error:p.error?{code:p.error.code,message:p.error.message}:null})+'\\n');setTimeout(()=>process.exit(p.status===0?0:19),10000);`;
      const job = launch("closure-breakaway-ancestor", ["-e", program]), output = messages(job.helper), deadline = performance.now() + 3000;
      let rawReady = "", ready: { schema: number; kind: string; challenge: string; createdSuspended: boolean; win32Code: number;
        candidatePid: number | null; candidateCreationTimeFileTime: string | null; probePid: number; probeCreationTimeFileTime: string; rootResumed: boolean;
        guard: { privateUnnamedJob: boolean; jobHandleNonInheritable: boolean; effectiveLimitFlags: number; ownerAssignedBeforeResume: boolean; jobHandlesExported: number } } | undefined;
      let captured: Awaited<ReturnType<typeof requestWindowsClosureCheckpoint>> | undefined, membershipFailure: unknown;
      try {
        while (!ready) {
          if (existsSync(readyPath)) {
            rawReady = readFileSync(readyPath, "utf8"); currentContext = { ...currentContext, readyPath, rawReady };
            try { ready = JSON.parse(rawReady) as typeof ready; } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
          }
          if (!ready) { assert.ok(performance.now() < deadline, "Native breakaway readiness exceeded its finite bound."); await new Promise<void>(done => setTimeout(done, 10)); }
        }
        currentContext = { ...currentContext, readiness: ready, nativeBuild: capability.native };
        assert.equal(ready.schema, 1); assert.equal(ready.kind, "windows-job-breakaway-ready"); assert.match(ready.challenge, /^[a-fA-F0-9-]{32,36}$/u);
        assert.equal(ready.rootResumed, false); assert.equal(ready.guard.privateUnnamedJob, true); assert.equal(ready.guard.jobHandleNonInheritable, true);
        assert.equal(ready.guard.effectiveLimitFlags, 0x2000); assert.equal(ready.guard.jobHandlesExported, 0);
        captured = await checkpoint(job.helper); currentContext = { ...currentContext, checkpoint: captured };
        const probeMember = captured.checkpoint.members.find(member => member.pid === ready!.probePid);
        assert.ok(probeMember); assert.equal(probeMember.creationTimeFileTime, ready.probeCreationTimeFileTime, "The native probe itself belongs to this exact private ancestor job.");
        if (ready.createdSuspended) {
          assert.equal(ready.win32Code, 0); assert.equal(ready.guard.ownerAssignedBeforeResume, true); assert.ok(ready.candidatePid && ready.candidateCreationTimeFileTime);
          const candidate = captured.checkpoint.members.find(member => member.pid === ready!.candidatePid);
          assert.ok(candidate, "The attempted breakaway candidate must remain in the exact owner's native job snapshot.");
          assert.equal(candidate.creationTimeFileTime, ready.candidateCreationTimeFileTime, "PID reuse or a different native creation cannot satisfy ancestor membership.");
        } else {
          assert.equal(ready.win32Code, 5); assert.equal(ready.candidatePid, null); assert.equal(ready.candidateCreationTimeFileTime, null); assert.equal(ready.guard.ownerAssignedBeforeResume, false);
        }
      } catch (error) { membershipFailure = error; currentContext = { ...currentContext, membershipFailure: error instanceof Error ? error.message : String(error) }; }
      finally {
        // Even a failed ancestor assertion releases only this exact probe's guard for disposal.
        if (ready && typeof ready.challenge === "string") writeFileSync(releasePath, JSON.stringify({ schema: 1, challenge: ready.challenge }) + "\n", { flag: "wx", mode: 0o600 });
      }
      const rawResponse = await output.next("probe:"); currentContext = { ...currentContext, rawResponse };
      const response = JSON.parse(rawResponse) as { status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; error: unknown };
      const probe = JSON.parse(response.stdout.trim()) as { schema: number; kind: string; status: string; expectedWin32Code: number; win32Code: number;
        createdSuspended: boolean; rootResumed: boolean; allProbeHandlesClosed: boolean; nativeFailure: unknown;
        challenge: string; candidatePid: number | null; candidateCreationTimeFileTime: string | null; probePid: number; probeCreationTimeFileTime: string;
        releaseObserved: boolean; readyWritten: boolean; ancestorContainmentQualified: boolean;
        releaseWait: { deadlineMs: number; elapsedMs: number; wallElapsedMs: number };
        guard: { processTreeVerified: boolean; activeProcessesAfterCleanup: number; activeProcessIdsAfterCleanup: number[]; jobHandleClosed: boolean } };
      currentContext = { ...currentContext, response, terminal: probe };
      const result = await cancelled(job); output.dispose(); currentContext = { ...currentContext, result };
      assert.equal(response.status, 0); assert.equal(response.signal, null); assert.equal(response.error, null);
      assert.equal(probe.schema, 1); assert.equal(probe.kind, "windows-job-breakaway-negative"); assert.equal(probe.expectedWin32Code, 5);
      assert.equal(probe.rootResumed, false); assert.equal(probe.allProbeHandlesClosed, true); assert.equal(probe.nativeFailure, null);
      assert.equal(probe.guard.processTreeVerified, true); assert.equal(probe.guard.activeProcessesAfterCleanup, 0); assert.deepEqual(probe.guard.activeProcessIdsAfterCleanup, []); assert.equal(probe.guard.jobHandleClosed, true);
      assert.ok(ready && captured); assert.equal(probe.createdSuspended, ready.createdSuspended); assert.equal(probe.win32Code, ready.win32Code);
      assert.equal(probe.challenge, ready.challenge); assert.equal(probe.candidatePid, ready.candidatePid); assert.equal(probe.candidateCreationTimeFileTime, ready.candidateCreationTimeFileTime);
      assert.equal(probe.probePid, ready.probePid); assert.equal(probe.probeCreationTimeFileTime, ready.probeCreationTimeFileTime);
      assert.equal(probe.readyWritten, true); assert.equal(probe.releaseObserved, true); assert.equal(probe.ancestorContainmentQualified, false);
      assert.equal(probe.releaseWait.deadlineMs, 2500); assert.ok(Number.isFinite(probe.releaseWait.elapsedMs) && probe.releaseWait.elapsedMs >= 0 && probe.releaseWait.elapsedMs <= 2500);
      assert.ok(Number.isFinite(probe.releaseWait.wallElapsedMs) && probe.releaseWait.wallElapsedMs >= 0 && probe.releaseWait.wallElapsedMs <= 2500);
      assert.equal(probe.status, ready.createdSuspended ? "OBSERVED_SUSPENDED" : "PASS");
      if (membershipFailure) throw membershipFailure;
      proofs.push({ control: "native_breakaway_private_ancestor", rawReady, readiness: ready, checkpoint: captured, response, probe, result,
        privateAncestorMembershipVerified: true, candidateAncestorMembershipVerified: ready.createdSuspended, deniedWithAccessDenied5: !ready.createdSuspended,
        disposalGuardIsNotAncestorEvidence: true, originalStrictError5FailureRetained: true,
        contractSources: ["https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs", "https://github.com/nodejs/node/blob/v24.14.0/deps/uv/src/win/process.c"] });
    });
    await control("corrupt ordinary native receipt remains an execution and cleanup failure", async () => {
      const job = launch("closure-corrupt-receipt", ["-e", "process.stdout.write('corrupt-ready\\n');setTimeout(()=>process.exit(0),1500);"]), output = messages(job.helper); await output.next("corrupt-ready");
      const receiptPath = path.join(directory, "public-closure-corrupt-receipt.native-result.json"); writeFileSync(receiptPath, "{", { flag: "wx", mode: 0o600 });
      const error = await job.outcome; assert.ok(error instanceof Error && /cleanup failed/u.test(error.message));
      const retained = (error as Error & { childResult: FailedResult }).childResult;
      currentContext = { ...currentContext, receiptPath, originalExecutionFailure: { message: error.message, childResult: retained } };
      assert.equal(retained.cleanup.status, "FAIL"); assert.equal(retained.nativeJobReceipt, null); assert.equal(retained.code, null); assert.equal(retained.signal, null);
      assert.equal(readFileSync(receiptPath, "utf8"), "{"); assert.ok(job.helper.exitCode !== null || job.helper.signalCode !== null); children.delete(job.helper);
      output.dispose(); proofs.push({ control: "corrupt_ordinary_receipt", expectedFailure: true, result: retained, receiptPath });
    });
    await control("actual closure qualifier rejects malformed stale incomplete and unbounded evidence", async () => {
      assert.ok(qualifiedInput); const original = structuredClone(qualifiedInput);
      const record = (value: unknown) => { assert.ok(value && typeof value === "object" && !Array.isArray(value)); return value as Record<string, unknown>; };
      const variants: Array<[string, (value: Parameters<typeof qualifyWindowsClosureEvidence>[0]) => void]> = [
        ["corrupt checkpoint", value => { value.checkpoint = null; }],
        ["mismatched creation identity", value => { record(value.checkpoint).rootCreationTimeFileTime = "100000000000000000"; }],
        ["inheritable job handle", value => { value.identity.jobHandleNonInheritable = false; }],
        ["breakaway enabled", value => { record(value.checkpoint).effectiveLimitFlags = 0x2800; }],
        ["missing closure certificate", value => { value.certificate = null; }],
        ["already dead at readiness", value => { record(value.ready).allHandlesLive = false; }],
        ["no independent readiness", value => { value.ready = null; }],
        ["helper exit not observed", value => { record(record(value.certificate).observation).helperSignaled = false; }],
        ["observer deadline exceeded", value => { record(record(value.certificate).observation).elapsedMs = 6001; }],
        ["UTC interval exceeded its deadline", value => { const observation = record(record(value.certificate).observation); observation.endedUtc = new Date(Date.parse(String(observation.startedUtc)) + 6001).toISOString().replace(/(\.\d{3})Z$/u, "$10000Z"); }],
        ["foreign job token", value => { record(value.certificate).jobToken = "11111111-1111-4111-8111-111111111111"; }],
        ["observer did not exit successfully", value => { value.observerExit = { code: null, signal: null }; }],
        ["observer retained job handle", value => { record(value.certificate).jobHandlesRetained = 1; }],
        ["observer requested termination rights", value => { record(value.certificate).processAccessMask = 0x1fffff; }],
        ["observer process handle is inheritable", value => { record(value.certificate).processHandlesInheritable = true; }],
        ["observer left a process handle open", value => { const certificate = record(value.certificate); certificate.closedObservationHandleCount = Number(certificate.observationHandleCount) - 1; }],
        ["member never signaled", value => { const observation = record(record(value.certificate).observation); const members = observation.members as Array<Record<string, unknown>>; members[0]!.signaled = false; }],
        ["coherent numeric helper FILETIME cannot replace native strings", value => { const checkpoint = record(value.checkpoint), certificate = record(value.certificate);
          checkpoint.helperCreationTimeFileTime = Number(checkpoint.helperCreationTimeFileTime); certificate.helperCreationTimeFileTime = checkpoint.helperCreationTimeFileTime; }],
        ["coherent numeric member FILETIME cannot replace native strings", value => { const members = record(value.checkpoint).members as Array<Record<string, unknown>>;
          const member = members.find(row => row.pid !== value.identity.rootPid); assert.ok(member); member.creationTimeFileTime = Number(member.creationTimeFileTime);
          const observed = record(record(value.certificate).observation).members as Array<Record<string, unknown>>;
          const same = observed.find(row => row.pid === member.pid); assert.ok(same); same.creationTimeFileTime = member.creationTimeFileTime; }],
        ["numeric capture UTC cannot be coerced into native time", value => { record(value.checkpoint).capturedUtc = 0; }],
        ["parseable noncanonical capture UTC is rejected", value => { const checkpoint = record(value.checkpoint); checkpoint.capturedUtc = new Date(String(checkpoint.capturedUtc)).toUTCString(); }],
        ["parseable noncanonical certificate UTC is rejected", value => { const observation = record(record(value.certificate).observation); observation.startedUtc = new Date(String(observation.startedUtc)).toUTCString(); }],
      ];
      for (const [name, mutate] of variants) { const value = structuredClone(original); mutate(value); assert.throws(() => qualifyWindowsClosureEvidence(value), error => error instanceof Error, name); }
      assert.deepEqual(qualifiedInput, original); assert.equal(qualifyWindowsClosureEvidence(original).status, "PASS");
      const checkpointPath = (proofs[0]!.checkpoint as Awaited<ReturnType<typeof requestWindowsClosureCheckpoint>>).checkpointPath;
      for (const deadlineMs of [49, 6001, Number.NaN]) assert.throws(() => startWindowsClosureObservation({ identity: original.identity, checkpointPath,
        observationPath: path.join(path.dirname(checkpointPath), "must-not-allocate.json"), deadlineMs, env: { ...environment } }), /finite bounded deadline/u);
      assert.throws(() => requestWindowsClosureCheckpoint({} as ChildProcess), /registered native child/u);
      proofs.push({ control: "actual_qualifier_negative_vectors", scope: "pure_input_qualification_vectors", nativeLifecycleClaimed: false,
        positive: 2, negative: variants.map(([name]) => name), invalidDeadlineNoAllocation: 3, unregisteredChildNoAllocation: true });
    });
    await control("actual observer declaration rejects its deadline even when the retained child never closes", async () => {
      assert.ok(qualifiedInput);
      const nativeFile = "scripts/lib/windows-owned-process.mts", nativeSource = ts.createSourceFile(nativeFile, readSource(nativeFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const actual = ["closureFileTime", "closureUtcMillis", "closureCheckpoint", "startWindowsClosureObservation"].map(name => {
        const node = nativeSource.statements.find((row): row is ts.FunctionDeclaration => ts.isFunctionDeclaration(row) && row.name?.text === name);
        assert.ok(node); return node.getText(nativeSource).replace(/^export /u, "");
      }).join("\n");
      let kills = 0, allocations = 0, serial = 0;
      const timers = new Map<number, { run: () => void; delay: number }>();
      const fake = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null, signalCode: null,
        kill: () => { kills++; return true; } });
      const checkpointPath = path.join(directory, "controlled-checkpoint-no-file.json"), observationPath = path.join(directory, "controlled-observation-no-file.json");
      const ports = { assert, dirname: path.dirname, resolve: path.resolve,
        nativeBuild: () => ({ executable: "controlled-native-no-allocation.exe" }),
        readFileSync: (file: string) => { assert.equal(file, checkpointPath); return JSON.stringify(qualifiedInput!.checkpoint); },
        lstatSync: (file: string) => { assert.equal(file, checkpointPath); return { isFile: () => true }; },
        existsSync: (file: string) => { assert.equal(file, observationPath); return false; }, realpathSync: (file: string) => file,
        spawn: (executable: string, args: string[]) => { allocations++; assert.equal(executable, "controlled-native-no-allocation.exe"); assert.deepEqual(args, ["--observe-close", checkpointPath, observationPath, "50"]); return fake; },
        qualifyWindowsClosureEvidence,
        setTimeout: (run: () => void, delay: number) => { const id = ++serial; timers.set(id, { run, delay }); return id; },
        clearTimeout: (id: number) => { timers.delete(id); } };
      const actualStart = new Function(...Object.keys(ports), ts.transpileModule(actual, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
        + ";return startWindowsClosureObservation;")(...Object.values(ports)) as typeof startWindowsClosureObservation;
      const observer = actualStart({ identity: qualifiedInput.identity, checkpointPath, observationPath, deadlineMs: 50, env: { NODE_ENV: "test" } });
      fake.stdout.emit("data", Buffer.from(JSON.stringify(qualifiedInput.ready) + "\n")); await observer.ready;
      const outcome = observer.completed.then(value => value, (error: unknown) => error);
      const timer = [...timers.values()].find(value => value.delay === 2050); assert.ok(timer); timer.run();
      let wall: ReturnType<typeof setTimeout> | undefined;
      try {
        const error = await Promise.race([outcome, new Promise<never>((_, reject) => { wall = setTimeout(() => reject(Error("Controlled actual observer deadline did not settle.")), 1000); })]);
        assert.ok(error instanceof Error && /independent deadline/u.test(error.message));
        const retained = (error as Error & { closureObservation: { cleanupPending: boolean; observerExit: { code: number | null; signal: NodeJS.Signals | null } } }).closureObservation;
        assert.equal(retained.cleanupPending, true); assert.deepEqual(retained.observerExit, { code: null, signal: null }); assert.equal(kills, 1);
      } finally { if (wall) clearTimeout(wall); }
      const cancelled = observer.cancel(), cancellation = assert.rejects(cancelled, /cancellation did not close/u);
      const cancellationTimer = [...timers.values()].find(value => value.delay === 2000); assert.ok(cancellationTimer); cancellationTimer.run(); await cancellation;
      assert.equal(kills, 2); assert.equal(allocations, 1); assert.equal(timers.size, 0);
      proofs.push({ control: "actual_observer_no_close_deadline", deadlineRejected: true, cleanupPendingPreserved: true, cancellationBoundRejected: true,
        retainedHandleKillAttempts: kills, operatingSystemAllocations: 0, copiedRuntimeImplementation: false });
    });
    const result = { status: "PASS", scope: "affected_native_handle_closure_acceptance_only", directory, controls: completedControls.length, cases: completedControls, proofs,
      pidAbsenceUsedAsClosureProof: false, nativeJobHandlesRetainedByObserver: 0, originalExecutionReceiptsRemainRequired: true };
    writeFileSync(path.join(directory, "acceptance-results.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 }); return result;
  } catch (error) { primaryFailure = error; throw error; }
  finally {
    for (const controller of controllers) if (!controller.signal.aborted) controller.abort(Error("Final cleanup of owned acceptance fixture"));
    for (const child of rawChildren) if (child.exitCode === null && child.signalCode === null) child.kill();
    await Promise.allSettled(outcomes); await Promise.allSettled([...rawChildren].map(close));
    await Promise.allSettled([...observations].map(observer => observer.cancel()));
    try {
      for (const evidence of rawEvidence.values()) for (const stream of ["stdout", "stderr"] as const)
        writeFileSync(path.join(directory, evidence.name + "." + stream + ".log"), evidence[stream], { flag: "wx", mode: 0o600 });
      writeFileSync(path.join(directory, "control-final-progress.json"), JSON.stringify({ schema: 1, completedControls, proofs, currentContext,
        primaryFailure: primaryFailure instanceof Error ? primaryFailure.message : null }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    } catch (evidenceError) { if (primaryFailure instanceof Error) Object.defineProperty(primaryFailure, "finalProgressEvidenceError", { value: evidenceError }); else throw evidenceError; }
  }
}

async function verifyIsolatedCliInputContracts(errorType: typeof import("./lib/isolated-supabase.mts").IsolatedSupabaseError) {
  const source = readSource("scripts/qa-isolated-supabase.mts");
  const tree = ts.createSourceFile("scripts/qa-isolated-supabase.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics, []);
  const options = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "options");
  const dispatch = tree.statements.filter(ts.isTryStatement); assert.ok(options?.body); assert.equal(dispatch.length, 1);
  const body = ts.transpileModule(options.getText(tree) + "\nasync function dispatchActualCli(){" + dispatch[0]!.getText(tree) + "}", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const names: string[] = [];
  const invoke = async (args: string[]) => {
    const calls: Array<{ name: string; input: unknown }> = []; let stdout = "", stderr = "";
    const processPort = { argv: [process.execPath, path.join(root, "scripts/qa-isolated-supabase.mts"), ...args], exitCode: 0,
      stdout: { write(value: string) { stdout += value; } }, stderr: { write(value: string) { stderr += value; } } };
    const route = (name: string) => async (input: unknown) => { calls.push({ name, input }); return { controlledRoute: name }; };
    const handoff = () => { throw Error("CLI parser controls must not enter an application handoff."); };
    const ports = { assert, resolve: path.resolve, runApplicationHandoff: handoff, IsolatedSupabaseError: errorType, process: processPort,
      connectionLifecycleProof: route("connectionLifecycleProof"), finalPublicProof: route("finalPublicProof"),
      buildContractsProof: route("buildContractsProof"), mediaUploadLimitProof: route("mediaUploadLimitProof"),
      heroCompatibilityProof: route("heroCompatibilityProof"), runIsolatedSupabase: route("runIsolatedSupabase") };
    const api = new Function(...Object.keys(ports), body + ";return {options,dispatchActualCli};")(...Object.values(ports)) as {
      options(args: string[]): import("./lib/isolated-supabase.mts").IsolatedSupabaseOptions; dispatchActualCli(): Promise<void> };
    await api.dispatchActualCli(); return { api, calls, stdout, stderr, exitCode: processPort.exitCode, handoff };
  };
  const output = path.join(root, ".tmp-qa", "controlled-cli-no-allocation");
  const ordinary = await invoke(["--output", output, "--platform-only", "--pg-port", "56065", "--rest-port", "56066", "--storage-port", "56067", "--api-port", "56068"]);
  assert.equal(ordinary.exitCode, 0); assert.equal(ordinary.stderr, ""); assert.equal(ordinary.calls.length, 1);
  assert.equal(ordinary.calls[0]!.name, "runIsolatedSupabase");
  const parsed = ordinary.calls[0]!.input as import("./lib/isolated-supabase.mts").IsolatedSupabaseOptions;
  assert.equal(parsed.artifactDir, output); assert.equal(parsed.handoff, undefined); assert.equal(parsed.cleanupOnly, false);
  assert.deepEqual([parsed.pgPort, parsed.restPort, parsed.storagePort, parsed.apiPort], [56065, 56066, 56067, 56068]);
  const application = ordinary.api.options(["--output", output]); assert.equal(application.handoff, ordinary.handoff);
  assert.equal(ordinary.api.options(["--output", output, "--platform-only", "--cleanup-only"]).cleanupOnly, true);
  assert.equal(ordinary.api.options(["--output", output, "--inject-failure", "before-handoff"]).failureInjection, "before-handoff");
  names.push("actual options preserve ordinary handoff platform cleanup and fixed port representations without invoking owners");
  const routes = [["--connection-lifecycle-only", "connectionLifecycleProof"], ["--final-public-proof", "finalPublicProof"],
    ["--build-contracts-proof", "buildContractsProof"], ["--media-upload-limit-proof", "mediaUploadLimitProof"],
    ["--hero-compatibility-proof", "heroCompatibilityProof"]] as const;
  for (const [flag, name] of routes) {
    const args = ["--output", output, flag], result = await invoke(args);
    assert.equal(result.exitCode, 0); assert.equal(result.stderr, "");
    assert.deepEqual(result.calls, [{ name, input: ["--output", output] }]);
    assert.deepEqual(JSON.parse(result.stdout), { controlledRoute: name }); names.push("actual dispatcher selects " + flag);
  }
  const invalid: Array<[string, string[], string]> = [
    ["missing output", [], "OUTPUT_REQUIRED"], ["unknown argument", ["--output", output, "--unknown"], "INVALID_ARGUMENT"],
    ["missing output value", ["--output"], "INVALID_ARGUMENT"], ["next flag is not a value", ["--output", "--platform-only"], "INVALID_ARGUMENT"],
    ["duplicate output", ["--output", output, "--output", output], "INVALID_ARGUMENT"],
    ["duplicate boolean", ["--output", output, "--platform-only", "--platform-only"], "DUPLICATE_ARGUMENT"],
    ["unknown failure injection", ["--output", output, "--inject-failure", "unqualified"], "INVALID_FAILURE_INJECTION"],
    ["retained proof outside its mode", ["--output", output, "--retained-proof", "unqualified"], "UNCLASSIFIED_FAILURE"],
  ];
  for (let left = 0; left < routes.length; left++) for (let right = left; right < routes.length; right++)
    invalid.push(["duplicate or conflicting proof modes " + routes[left]![0] + " " + routes[right]![0],
      ["--output", output, routes[left]![0], routes[right]![0]], "UNCLASSIFIED_FAILURE"]);
  for (const [name, args, code] of invalid) {
    const result = await invoke(args); assert.equal(result.exitCode, 1); assert.deepEqual(result.calls, []); assert.equal(result.stdout, "");
    assert.deepEqual(JSON.parse(result.stderr), { status: "needs_attention", stage: "cli", code }); names.push(name + " rejects before every allocation/proof port");
  }
  assert.equal(readSource("scripts/qa-isolated-supabase.mts"), source);
  cases.push(...names.map(name => "Actual CLI input: " + name));
  return { status: "PASS", source: "scripts/qa-isolated-supabase.mts", sourceSha256: sha256(source), names,
    actualParserAndDispatcher: true, actualResourceAllocations: 0, dockerExecuted: false, databaseCalls: 0 };
}

/** Actual owned Node children exercise the shared lifecycle without Browser/DB transports. */
async function verifySharedChildControls(options?: { admissionOnly?: boolean }) {
  const launchWindows = (options: Parameters<typeof spawnWindowsOwnedProcess>[0]) => {
    const launched = spawnWindowsOwnedProcess(options);
    const child = launched.child as ChildProcess & { verificationWindowsIdentity?: unknown; verificationWindowsReceipt?: unknown };
    assert.equal(child.verificationWindowsIdentity, launched.readIdentity); assert.equal(child.verificationWindowsReceipt, launched.readReceipt);
    assert.equal(typeof launched.native.executableSha256, "string"); assert.equal(typeof launched.native.sourceSha256, "string"); return launched;
  };
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = ["ownedPath", "receipt", "stopChild", "localVerificationCommandSteps", "runOwnedVerificationChild", "ownedProcessCleanupQualification", "verifyOwnedProcessReadiness"].map(name => {
    const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, "Missing shared owned-child lifecycle declaration: " + name); return declaration.getText(file).replace(/^export /u, "");
  });
  const code = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const buildApi = (write: typeof writeFileSync = writeFileSync, launch: typeof spawn = spawn) => new Function("assert", "isAbsolute", "resolve", "sep", "spawn", "writeFileSync", "existsSync", "readFileSync", "readdirSync", "lstatSync", "windowsOwnedProcessCapability", "spawnWindowsOwnedProcess", "dirname", "join", "realpathSync", "mkdirSync", "digest", code + ";return {run:runOwnedVerificationChild,stop:stopChild,verifyOwnedProcessReadiness,ownedProcessCleanupQualification};")(
    assert, path.isAbsolute, path.resolve, path.sep, launch, write, existsSync, readFileSync, readdirSync, lstatSync, windowsOwnedProcessCapability, launchWindows, path.dirname, path.join, realpathSync, mkdirSync, sha256) as {
      run: typeof import("./lib/isolated-public-verification.mts").runOwnedVerificationChild;
      verifyOwnedProcessReadiness: typeof import("./lib/isolated-public-verification.mts").verifyOwnedProcessReadiness;
      ownedProcessCleanupQualification: typeof import("./lib/isolated-public-verification.mts").ownedProcessCleanupQualification;
      stop(child: ChildProcess, environment: NodeJS.ProcessEnv): Promise<Awaited<ReturnType<typeof import("./lib/isolated-public-verification.mts").runOwnedVerificationChild>>["cleanup"]>;
    };
  const api = buildApi(), runtimeProofs: Array<Record<string, unknown>> = [{ control: "windows_imported_type_and_source_contracts", ...verifyWindowsOwnedProcessContracts() }];
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "venisia-owned-child-controls-"))), children = new Set<ChildProcess>();
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"]) if (process.env[key] !== undefined) environment[key] = process.env[key];
  const context = { runDirectory: directory, sanitize: (value: string) => value.replaceAll("private-sentinel", "[redacted]"), cleanEnvironment: () => ({ ...environment }) };
  const run = (name: string, args: string[], signal = new AbortController().signal, limitMs = 10_000, sourceDirectory = directory) =>
    api.run({ sourceDirectory, context, children, signal }, args, { ...environment }, name, limitMs);
  const control = async (name: string, execute: () => Promise<void>) => {
    try { await execute(); } catch (error) {
      const assertion = error as { actual?: unknown; expected?: unknown; operator?: unknown };
      const primitive = (value: unknown) => value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) ? value
        : typeof value === "string" && value.length <= 256 ? context.sanitize(value) : "<nonprimitive or oversized value omitted>";
      try { writeFileSync(path.join(directory, "control-failure.json"), JSON.stringify({ schema: 1, control: name,
        errorName: error instanceof Error ? error.name : "UnknownThrownValue", message: error instanceof Error ? context.sanitize(error.message).slice(0, 512) : "Non-Error failure",
        operator: primitive(assertion?.operator), actual: primitive(assertion?.actual), expected: primitive(assertion?.expected), originalFailurePreserved: true }, null, 2) + "\n", { flag: "wx", mode: 0o600 }); }
      catch (evidenceError) { if (error instanceof Error) Object.defineProperty(error, "controlFailureEvidenceError", { value: evidenceError }); }
      console.error("FAIL shared owned child " + name); throw error;
    }
    cases.push("shared owned child " + name);
  };
  try {
    const lifecycleOwner = await import("./lib/isolated-supabase.mts");
    const lifecycleSource = readSource("scripts/lib/isolated-supabase.mts");
    const lifecycleTree = ts.createSourceFile("isolated-supabase.mts", lifecycleSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const lifecycleDeclaration = lifecycleTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "runIsolatedSupabase");
    assert.ok(lifecycleDeclaration?.body);
    const actualVariable = (statements: ts.NodeArray<ts.Statement>, name: string) => {
      const matches = statements.filter((node): node is ts.VariableStatement => ts.isVariableStatement(node)
        && node.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === name));
      assert.equal(matches.length, 1, "The environment boundary requires its actual unique declaration: " + name);
      return matches[0]!.getText(lifecycleTree);
    };
    const actualRequire = lifecycleTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "requireThat");
    assert.ok(actualRequire);
    const bridgeSetupStatements: ts.TryStatement[] = [];
    const findBridgeSetup = (node: ts.Node) => {
      if (ts.isTryStatement(node) && node.tryBlock.statements.some(statement => {
        if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)
          || statement.expression.left.getText(lifecycleTree) !== "hostBridge") return false;
        const right = ts.isAsExpression(statement.expression.right) ? statement.expression.right.expression : statement.expression.right;
        return ts.isAwaitExpression(right) && ts.isCallExpression(right.expression)
          && right.expression.expression.getText(lifecycleTree) === "startHostAccessBridge";
      })) bridgeSetupStatements.push(node);
      ts.forEachChild(node, findBridgeSetup);
    };
    findBridgeSetup(lifecycleDeclaration); assert.equal(bridgeSetupStatements.length, 1);
    const bridgeBoundarySource = [actualVariable(lifecycleTree.statements, "fail"), actualRequire.getText(lifecycleTree),
      actualVariable(lifecycleTree.statements, "object"), ...["transportCodes", "ownerTransportCodes", "asSafeError"]
        .map(name => actualVariable(lifecycleDeclaration.body!.statements, name))].join("\n");
    type SetupBridge = { close(): Promise<void>; snapshot(): Record<string, unknown> };
    type SetupPorts = { signal?: AbortSignal; ports: Record<string, number>; env: NodeJS.ProcessEnv; dockerBinary: string; dockerHost: string;
      assertOwnedTransport(): Promise<string> };
    const buildBridgeBoundary = (ports: { start(options: SetupPorts): Promise<SetupBridge>; preparation?: { signal: AbortSignal };
      lifetimeAbort: AbortController; safeRecord(stage: string, values: Record<string, unknown>): void; recordFile(name: string, value: unknown): void }) => {
      const ownership: string[] = [], bridgeId = "a".repeat(64);
      const body = ts.transpileModule(bridgeBoundarySource + "\nreturn {asSafeError, setup:async()=>{let hostBridge;"
        + bridgeSetupStatements[0]!.getText(lifecycleTree) + ";return hostBridge;}};", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      const projected = new Function("IsolatedSupabaseError", "IsolatedSupabaseCliError", "classifyOwnedPgConnectMessage", "startHostAccessBridge",
        "cleanChildEnvironment", "safeRecord", "recordFile", "run", "dockerBinary", "dockerHost", "preparation", "lifetimeAbort",
        "interrupted", "cleaning", "serviceResource", "inspectCaptured", body)(lifecycleOwner.IsolatedSupabaseError, class extends Error {},
        () => { assert.fail("These actual adapter cases must not use a database-connect classifier."); }, ports.start,
        () => ({ NODE_ENV: "test" }), ports.safeRecord, ports.recordFile,
        { pgPort: 57641, restPort: 57642, storagePort: 57643, apiPort: 57644 }, "controlled-docker-never-executed", "npipe:////./pipe/dockerDesktopLinuxEngine",
        ports.preparation, ports.lifetimeAbort, false, false,
        (service: string) => { ownership.push(service); return { identity: { id: bridgeId } }; },
        async (resource: { identity: { id: string } }) => { assert.equal(resource.identity.id, bridgeId); ownership.push("inspected"); }) as {
          asSafeError(error: unknown, stage: string): InstanceType<typeof lifecycleOwner.IsolatedSupabaseError>;
          setup(): Promise<SetupBridge>;
        };
      return { ...projected, ownership, bridgeId };
    };
    const noSetupEffects = () => buildBridgeBoundary({ lifetimeAbort: new AbortController(),
      start: async () => { assert.fail("The error-classification control must not create a bridge."); },
      safeRecord: () => { assert.fail("No setup receipt is expected."); }, recordFile: () => { assert.fail("No setup file is expected."); } });
    const diagnostic = Object.freeze({ schema: 1, code: "QA_TRANSPORT_LISTEN_FAILED", phase: "listen", service: "rest", listenerIndex: 1,
      address: "127.0.0.1", port: 57642, causeCode: "EADDRINUSE", syscall: "listen", originalMetadataComplete: true, originalErrorRetainedPrivately: true,
      cause: Object.freeze({ code: "EADDRINUSE", syscall: "listen", address: "127.0.0.1", port: 57642, phase: "listen" }) });
    const transportError = () => Object.assign(new Error("QA_TRANSPORT_LISTEN_FAILED", { cause: diagnostic.cause }), { diagnostic });
    await control("actual environment adapter retains the exact sanitized transport wrapper as a nonenumerable cause", async () => {
      const original = transportError(), actual = noSetupEffects().asSafeError(original, "postgres-platform");
      assert.ok(actual instanceof lifecycleOwner.IsolatedSupabaseError); assert.equal(actual.code, "QA_TRANSPORT_LISTEN_FAILED");
      assert.equal(actual.stage, "postgres-platform"); assert.equal(actual.cause, original); assert.equal((actual.cause as Error).cause, diagnostic.cause);
      assert.equal(Object.getOwnPropertyDescriptor(actual, "cause")?.enumerable, false);
      assert.equal(JSON.stringify(actual).includes("EADDRINUSE"), false);
      assert.equal(noSetupEffects().asSafeError(actual, "another-stage"), actual);
    });
    await control("actual environment adapter keeps cancellation and setup deadline codes and original safe cause", async () => {
      for (const code of ["QA_TRANSPORT_CANCELLED", "QA_TRANSPORT_SETUP_TIMEOUT"]) {
        const original = new Error(code), actual = noSetupEffects().asSafeError(original, "postgres-platform");
        assert.equal(actual.code, code); assert.equal(actual.cause, original);
        assert.equal(Object.getOwnPropertyDescriptor(actual, "cause")?.enumerable, false);
      }
    });
    await control("actual environment adapter never retains arbitrary PostgreSQL credential error details", async () => {
      const original = Object.assign(new Error("postgres://private-user:private-password@private-host/private-database"), { code: "ECONNRESET" });
      const actual = noSetupEffects().asSafeError(original, "application-query");
      assert.equal(actual.code, "ECONNRESET"); assert.equal(Object.hasOwn(actual, "cause"), false);
      assert.equal(JSON.stringify(actual).includes("private-"), false); assert.equal(actual.message.includes("private-"), false);
    });
    await control("actual bridge setup forwards preparation or lifetime signal and the original owned transport ports", async () => {
      for (const withPreparation of [true, false]) {
        const lifetimeAbort = new AbortController(), preparation = withPreparation ? { signal: new AbortController().signal } : undefined;
        const bridge: SetupBridge = { close: async () => undefined, snapshot: () => ({ controlled: true }) };
        const projected: ReturnType<typeof buildBridgeBoundary> = buildBridgeBoundary({ lifetimeAbort, preparation, start: async received => {
          assert.equal(received.signal, preparation?.signal ?? lifetimeAbort.signal);
          assert.deepEqual(received.ports, { db: 57641, rest: 57642, storage: 57643, "api-gw": 57644 });
          assert.deepEqual(received.env, { NODE_ENV: "test" }); assert.equal(received.dockerBinary, "controlled-docker-never-executed");
          assert.equal(received.dockerHost, "npipe:////./pipe/dockerDesktopLinuxEngine");
          assert.equal(await received.assertOwnedTransport(), projected.bridgeId); return bridge;
        }, safeRecord: () => { assert.fail("Successful bridge setup does not write the failure stage."); },
        recordFile: () => { assert.fail("Successful bridge setup does not write a failure file."); } });
        assert.equal(await projected.setup(), bridge); assert.deepEqual(projected.ownership, ["qa-transport", "inspected"]);
      }
    });
    await control("actual bridge failure receipt retains first listener and bounded original native diagnostic", async () => {
      const original = transportError(), receipts: Array<{ stage: string; values: Record<string, unknown> }> = [], files: Array<{ name: string; value: unknown }> = [];
      const projected = buildBridgeBoundary({ lifetimeAbort: new AbortController(), start: async () => { throw original; },
        safeRecord: (stage, values) => { receipts.push({ stage, values }); }, recordFile: (name, value) => { files.push({ name, value }); } });
      await assert.rejects(projected.setup(), error => error === original);
      assert.deepEqual(receipts, [{ stage: "host-access-setup-failed", values: { code: "QA_TRANSPORT_LISTEN_FAILED", phase: "listen", service: "rest",
        listenerIndex: 1, listenerPort: 57642, causeCode: "EADDRINUSE", metadataComplete: true } }]);
      assert.deepEqual(files, [{ name: "host-access-setup-failure.json", value: { schema: 1, diagnostic,
        rawErrorRetained: false, originalErrorKeptByTransportOwner: true } }]);
      assert.equal(original.cause, diagnostic.cause); assert.equal(Object.hasOwn(original, "receiptFailure"), false);
    });
    await control("actual bridge receipt never invents original native error retention when metadata is absent", async () => {
      const absent = { code: "QA_TRANSPORT_SETUP_TIMEOUT", phase: "listen", service: "db", listenerIndex: 0, port: 57641 };
      const original = Object.assign(new Error("QA_TRANSPORT_SETUP_TIMEOUT"), { diagnostic: absent });
      const files: unknown[] = [];
      const projected = buildBridgeBoundary({ lifetimeAbort: new AbortController(), start: async () => { throw original; },
        safeRecord: (_stage, values) => { assert.equal(values.causeCode, "UNKNOWN"); assert.equal(values.metadataComplete, false); },
        recordFile: (_name, value) => { files.push(value); } });
      await assert.rejects(projected.setup(), error => error === original);
      assert.deepEqual(files, [{ schema: 1, diagnostic: absent, rawErrorRetained: false, originalErrorKeptByTransportOwner: false }]);
      assert.equal(Object.hasOwn(original, "cause"), false);
    });
    await control("actual bridge secondary receipt failure preserves frozen and already annotated original errors", async () => {
      for (const variant of ["frozen", "already-annotated"] as const) {
        const original = transportError();
        if (variant === "frozen") Object.freeze(original);
        else Object.defineProperty(original, "receiptFailure", { value: "EARLIER_RECEIPT_FAILURE" });
        const projected = buildBridgeBoundary({ lifetimeAbort: new AbortController(), start: async () => { throw original; },
          safeRecord: () => { throw Error("secondary write failure"); }, recordFile: () => { assert.fail("First receipt failure must stop later writes."); } });
        await assert.rejects(projected.setup(), error => error === original);
        assert.equal(original.cause, diagnostic.cause);
        assert.equal(Object.getOwnPropertyDescriptor(original, "receiptFailure")?.value, variant === "frozen" ? undefined : "EARLIER_RECEIPT_FAILURE");
        assert.equal(projected.asSafeError(original, "postgres-platform").cause, original);
      }
    });
    for (const failedPort of ["safeRecord", "recordFile"] as const) await control("actual bridge original failure survives secondary " + failedPort + " fault", async () => {
      const original = transportError(), secondary = Error("private secondary diagnostic must not be serialized"), writes: string[] = [];
      const projected = buildBridgeBoundary({ lifetimeAbort: new AbortController(), start: async () => { throw original; },
        safeRecord: () => { writes.push("safeRecord"); if (failedPort === "safeRecord") throw secondary; },
        recordFile: () => { writes.push("recordFile"); if (failedPort === "recordFile") throw secondary; } });
      await assert.rejects(projected.setup(), error => error === original);
      assert.deepEqual(writes, failedPort === "safeRecord" ? ["safeRecord"] : ["safeRecord", "recordFile"]);
      assert.equal(original.cause, diagnostic.cause); assert.equal(Object.getOwnPropertyDescriptor(original, "receiptFailure")?.value, "RECEIPT_WRITE_FAILED");
      assert.equal(Object.getOwnPropertyDescriptor(original, "receiptFailure")?.enumerable, false);
      assert.equal(JSON.stringify(original).includes(secondary.message), false);
      assert.equal(projected.asSafeError(original, "postgres-platform").cause, original);
    });
    runtimeProofs.push({ control: "actual_environment_transport_adapter", sourceOwnerSha256: sha256(lifecycleSource),
      actualSourceProjection: true, declarationSha256: sha256(bridgeBoundarySource), setupStatementSha256: sha256(bridgeSetupStatements[0]!.getText(lifecycleTree)),
      sanitizedTransportCauseRetained: true, arbitraryPgErrorNotRetained: true, firstListenerDiagnosticRetained: true,
      secondaryReceiptFaultsPreserveOriginal: ["safeRecord", "recordFile"], setupSignalsForwarded: ["preparation", "lifetime"],
      controlledPortsOnly: true, dockerExecuted: false, databaseCalls: 0, operatingSystemAllocations: 0 });
    const lockEvidenceDirectory = path.join(directory, "release-lock-inputs"); mkdirSync(lockEvidenceDirectory);
    const inputArtifacts: Array<{ file: string; sha256: string }> = [];
    runtimeProofs.push({ control: "actual_release_lock_input", ...verifyReleaseLockInputContracts(lifecycleOwner, (file, bytes) => {
      const name = path.basename(file); assert.match(name, /^lock-[1-9][0-9]*\.json$/u);
      const archived = path.join(lockEvidenceDirectory, name); writeFileSync(archived, bytes, { flag: "wx", mode: 0o600 });
      assert.equal(sha256(readFileSync(archived)), sha256(bytes)); inputArtifacts.push({ file: "release-lock-inputs/" + name, sha256: sha256(bytes) });
    }), inputArtifacts });
    runtimeProofs.push({ control: "actual_cli_parser_dispatcher", ...await verifyIsolatedCliInputContracts(lifecycleOwner.IsolatedSupabaseError) });
    await control("actual registered transport QA leaf executes once with complete owned cleanup and no Docker dispatch", async () => {
      const result = await run("transport-contracts", [path.join(root, "scripts/qa-isolated-supabase-transport.mjs")], undefined, 30_000);
      assert.equal(result.code, 0); assert.deepEqual(result.rawExit, { code: 0, signal: null }); assert.equal(result.cleanup.status, "PASS");
      assert.equal(result.cleanup.liveProcesses, 0); assert.equal(result.stderr, "");
      const proof = JSON.parse(result.stdout) as { status: string; checks: number; cases: string[]; dockerExecuted: boolean; productionAccess: boolean; externalConnections: boolean };
      assert.equal(proof.status, "PASS"); assert.ok(Array.isArray(proof.cases) && proof.cases.length > 0);
      assert.equal(proof.checks, proof.cases.length); assert.equal(new Set(proof.cases).size, proof.cases.length);
      assert.equal(proof.dockerExecuted, false); assert.equal(proof.productionAccess, false); assert.equal(proof.externalConnections, false);
      runtimeProofs.push({ control: "actual_owned_transport_leaf", entry: "scripts/qa-isolated-supabase-transport.mjs", ...proof,
        rawExit: result.rawExit, cleanup: result.cleanup, actualResult: result, ownedLoopbackTrafficExecuted: true });
    });
    await control("actual registered CLI entry rejects missing output before any application allocation", async () => {
      const result = await run("cli-missing-output", ["--experimental-strip-types", path.join(root, "scripts/qa-isolated-supabase.mts")], undefined, 30_000);
      assert.equal(result.code, 1); assert.deepEqual(result.rawExit, { code: 1, signal: null }); assert.equal(result.stdout, "");
      assert.equal(result.cleanup.status, "PASS"); assert.equal(result.cleanup.liveProcesses, 0);
      const failures = result.stderr.split(/\r?\n/u).filter(line => line.trim().startsWith("{")).map(line => JSON.parse(line));
      assert.deepEqual(failures, [{ status: "needs_attention", stage: "cli", code: "OUTPUT_REQUIRED" }]);
      runtimeProofs.push({ control: "actual_cli_no_allocation_rejection", entry: "scripts/qa-isolated-supabase.mts", rawExit: result.rawExit,
        failure: failures[0], stderrSha256: sha256(result.stderr), cleanup: result.cleanup, actualResult: result, applicationOutputSupplied: false });
    });
    if (!options?.admissionOnly) {
    // Project the actual private observer with controlled file/clock ports; these fixtures grant no live authority.
    const childOwner = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
      && node.name?.text === "runOwnedVerificationChild");
    assert.ok(childOwner?.body);
    const timingDeclarations: ts.VariableStatement[] = [];
    const findTiming = (node: ts.Node) => {
      if (ts.isVariableStatement(node) && node.declarationList.declarations.some(value => ts.isIdentifier(value.name)
        && value.name.text === "gate57Timing")) timingDeclarations.push(node);
      ts.forEachChild(node, findTiming);
    };
    findTiming(childOwner); assert.equal(timingDeclarations.length, 1);
    const commandOwner = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
      && node.name?.text === "localVerificationCommandSteps");
    assert.ok(commandOwner?.body);
    const pathOwner = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ownedPath");
    assert.ok(pathOwner?.body);
    const timingCode = ts.transpileModule(pathOwner.getText(file) + "\n" + commandOwner.getText(file).replace(/^export /u, "") + "\n"
      + timingDeclarations[0]!.getText(file) + "\nreturn gate57Timing;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    type TimingReference = NonNullable<Awaited<ReturnType<typeof api.run>>["timingEvidence"]>;
    type TimingFacts = { code: number | null; reason: string | null; stdout: string | null; stderr: string | null;
      cleanup: { status: "PASS"; liveProcesses: number; processTreeVerified: boolean }; nativeJobIdentity: null; nativeJobReceipt: null };
    type TimingProjection = { environment: Record<string, string>; observe(stream: "stdout" | "stderr", chunk: string): void;
      beginDeadline(): void; finish(facts: TimingFacts): TimingReference };
    type TimingReceipt = { status: string; enabled: boolean; child: { code: number | null; reason: string | null };
      files: Array<{ file: string; bytes: number; sha256: string }>;
      timings: Array<{ script: string; commandInclusiveWallMs: number }>; issues: string[]; qualificationGranted: boolean;
      nativePassGranted: boolean; gatePassGranted: boolean; releaseEvidence: boolean;
      source: { packageSha256: string; invocationPreorder: Array<{ id: number; script: string; parentId: number | null }>; invocationPostorder: number[] };
      observations: { starts: Array<{ script: string; planId: number | null; nominalRemainingMs: number | null }>;
        ends: Array<{ script: string | null; timingFileMatched: boolean }>; unobservedOrUnfinished: unknown[] };
      clockOrigins: { ownerTimeoutReferenceMonotonicMs: number | null; nominalRemainingIsExactNativeRemaining: boolean } };
    let timingFixtureNumber = 0;
    const timingFixture = (options: { package?: { name: string; version: string; scripts: Record<string, string> };
      npmVersion?: string; ports?: Record<string, unknown>; args?: string[] } = {}) => {
      const base = realpathSync(mkdtempSync(path.join(directory, "timing-unit-"))), sourceDirectory = path.join(base, "package");
      const proofDirectory = path.join(base, "proof"), nodeDirectory = path.join(base, "runtime"), executable = path.join(nodeDirectory, "node.exe");
      const npmRoot = path.join(nodeDirectory, "node_modules", "npm"), npmCli = path.join(npmRoot, "bin", "npm-cli.js");
      mkdirSync(sourceDirectory); mkdirSync(proofDirectory); mkdirSync(nodeDirectory);
      const put = (file: string, bytes: string) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes, { flag: "wx" }); };
      put(executable, "controlled Node bytes; not an executable capability");
      put(path.join(npmRoot, "package.json"), JSON.stringify({ version: options.npmVersion ?? "11.9.0" }));
      put(npmCli, "controlled npm CLI bytes; not executed");
      for (const relative of ["lib/npm.js", "lib/utils/timers.js", "lib/utils/display.js", "lib/utils/log-file.js", "lib/commands/run.js",
        "node_modules/@npmcli/run-script/lib/run-script-pkg.js", "node_modules/proc-log/lib/index.js"]) put(path.join(npmRoot, relative), "controlled format source " + relative);
      const pkg = options.package ?? JSON.parse(readSource("package.json")) as { name: string; version: string; scripts: Record<string, string> };
      const packageFile = path.join(sourceDirectory, "package.json"); put(packageFile, JSON.stringify(pkg));
      const name = "timing-unit-" + (++timingFixtureNumber), stdoutPath = path.join(proofDirectory, `public-${name}.stdout.log`);
      const stderrPath = path.join(proofDirectory, `public-${name}.stderr.log`);
      const fixtureContext = { ...context, runDirectory: proofDirectory }, fixtureProcess = { execPath: executable, version: process.version,
        versions: { v8: process.versions.v8, modules: process.versions.modules }, platform: "linux", arch: process.arch, execArgv: [] };
      const ports = { assert, args: options.args ?? [npmCli, "run", "verify:admin-runtime"], name, limitMs: 1_800_000,
        sourceDirectory, context: fixtureContext, stdoutPath, stderrPath, started: performance.now(), performance, Date, process: fixtureProcess,
        dirname: path.dirname, join: path.join, resolve: path.resolve, sep: path.sep, existsSync, lstatSync, realpathSync,
        readFileSync, readdirSync, mkdirSync, writeFileSync, digest: sha256, isAbsolute: path.isAbsolute, ...options.ports };
      const projected = new Function(...Object.keys(ports), timingCode)(...Object.values(ports)) as TimingProjection | undefined;
      const preorder: string[] = [], postorder: string[] = [];
      const visit = (script: string) => { preorder.push(script); for (const step of pkg.scripts[script]!.split("&&")) {
        const nested = /^npm run ([a-zA-Z0-9:_-]+)$/u.exec(step.trim()); if (nested) visit(nested[1]!);
      } postorder.push(script); };
      visit("verify:admin-runtime");
      const timingDirectory = path.join(proofDirectory, `public-${name}-npm-timing`);
      const members = new Map<string, string>(), durations = new Map(postorder.map((script, index) => [script, index + 1]));
      const populate = () => { for (const [index, script] of postorder.entries()) {
        const id = `2026-11-03T00_00_00_${String(index).padStart(3, "0")}Z`, file = path.join(timingDirectory, id + "-timing.json");
        put(file, JSON.stringify({ metadata: { id, command: ["run", script], version: "11.9.0", logfiles: [] },
          timers: { npm: durations.get(script)! + 5, "command:run": durations.get(script)! }, unfinishedTimers: {} })); members.set(script, file);
      } };
      const headers = preorder.map(script => `> ${pkg.name}@${pkg.version} ${script}\n`);
      const completions = postorder.map(script => `npm timing command:run Completed in ${durations.get(script)}ms\n`);
      const observe = (starts = headers, ends = completions) => { assert.ok(projected); projected.beginDeadline();
        for (const value of starts) { projected.observe("stdout", value.slice(0, 3)); projected.observe("stdout", value.slice(3)); }
        for (const value of ends) { projected.observe("stderr", value.slice(0, 7)); projected.observe("stderr", value.slice(7)); }
      };
      const facts: TimingFacts = { code: 0, reason: null, stdout: headers.join(""), stderr: completions.join(""),
        cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true }, nativeJobIdentity: null, nativeJobReceipt: null };
      const receiptFile = path.join(proofDirectory, `public-${name}.npm-timing.json`);
      const finish = (patch: Partial<TimingFacts> = {}) => { assert.ok(projected); const finalFacts = { ...facts, ...patch };
        writeFileSync(stdoutPath, finalFacts.stdout ?? "", { flag: "wx" }); writeFileSync(stderrPath, finalFacts.stderr ?? "", { flag: "wx" });
        const reference = projected.finish(finalFacts), bytes = readFileSync(receiptFile);
        assert.equal(reference.sha256, sha256(bytes)); return { reference, value: JSON.parse(bytes.toString()) as TimingReceipt }; };
      const rewrite = (script: string, edit: (value: { metadata: { version: string; command: string[] }; timers: Record<string, number>;
        unfinishedTimers: Record<string, number[]> }) => void) => { const at = members.get(script); assert.ok(at);
        const value = JSON.parse(readFileSync(at, "utf8")); edit(value); writeFileSync(at, JSON.stringify(value)); };
      return { base, sourceDirectory, executable, npmRoot, packageFile, proofDirectory, timingDirectory, projected, pkg, members, args: ports.args,
        preorder, postorder, headers, completions, populate, observe, facts, finish, rewrite, receiptFile };
    };
    const assertDiagnosticOnly = (value: TimingReceipt) => {
      assert.equal(value.qualificationGranted, false); assert.equal(value.nativePassGranted, false);
      assert.equal(value.gatePassGranted, false); assert.equal(value.releaseEvidence, false);
      assert.equal(value.clockOrigins.nominalRemainingIsExactNativeRemaining, false);
    };
    await control("Gate57 timing source graph covers every literal verify and qa invocation without a fixed count", async () => {
      const fixture = timingFixture(); fixture.populate(); fixture.observe(); const { reference, value } = fixture.finish();
      assert.equal(reference.status, "COMPLETE_DIAGNOSTIC_ONLY"); assert.equal(value.status, reference.status); assert.deepEqual(value.issues, []);
      assert.deepEqual(value.source.invocationPreorder.map(row => row.script), fixture.preorder);
      assert.deepEqual(value.source.invocationPostorder.map(id => fixture.preorder[id]), fixture.postorder);
      assert.deepEqual(value.observations.starts.map(row => row.script), fixture.preorder);
      assert.deepEqual(value.observations.ends.map(row => row.script), fixture.postorder);
      assert.ok(value.observations.ends.every(row => row.timingFileMatched)); assert.equal(value.files.length, fixture.preorder.length);
      assert.ok(fixture.preorder.includes("qa:cinematic-admin") && fixture.preorder.includes("qa:taxonomy-form-revision"));
      assert.equal(value.source.packageSha256, sha256(readFileSync(fixture.packageFile))); assertDiagnosticOnly(value);
      runtimeProofs.push({ control: "controlled_source_graph_timing", invocationCount: fixture.preorder.length,
        packageSha256: value.source.packageSha256, sourceDerivedCount: true, liveAdmissionGranted: false, actualNpmExecuted: false });
    });
    await control("Gate57 timing keeps independent cross-pipe delivery and bounded unrelated lines", async () => {
      const fixture = timingFixture(); fixture.populate(); assert.ok(fixture.projected); fixture.projected.beginDeadline();
      fixture.projected.observe("stdout", "x".repeat(5_000) + "\n");
      for (const value of fixture.completions) fixture.projected.observe("stderr", value);
      for (const value of fixture.headers) fixture.projected.observe("stdout", "\u001b[32m" + value.replace("\n", "\u001b[0m\r\n"));
      const { value } = fixture.finish(); assert.equal(value.status, "COMPLETE_DIAGNOSTIC_ONLY"); assertDiagnosticOnly(value);
      assert.ok(value.observations.starts.every(row => typeof row.nominalRemainingMs === "number"));
    });
    const partialCases: Array<[string, (fixture: ReturnType<typeof timingFixture>) => void, string]> = [
      ["missing start", fixture => fixture.observe(fixture.headers.slice(1)), "START_PREORDER_MISMATCH"],
      ["missing end", fixture => fixture.observe(fixture.headers, fixture.completions.slice(0, -1)), "INCOMPLETE_OR_INTERRUPTED_NPM_OBSERVATIONS"],
      ["wrong start order", fixture => { const rows = [...fixture.headers]; [rows[0], rows[1]] = [rows[1]!, rows[0]!]; fixture.observe(rows); }, "START_PREORDER_MISMATCH"],
      ["unexpected banner", fixture => fixture.observe(["> " + fixture.pkg.name + "@" + fixture.pkg.version + " unbound\n", ...fixture.headers]), "UNEXPECTED_SCRIPT_BANNER"],
      ["wrong completion order", fixture => { const rows = [...fixture.completions]; [rows[0], rows[1]] = [rows[1]!, rows[0]!]; fixture.observe(fixture.headers, rows); }, "END_FILE_SEQUENCE_OR_DURATION_AMBIGUOUS"],
      ["duplicate end", fixture => fixture.observe(fixture.headers, [...fixture.completions, fixture.completions[0]!]), "INVALID_OR_EXCESS_END_EVENT"],
      ["missing timing file", fixture => { unlinkSync(fixture.members.get(fixture.postorder[0]!)!); fixture.observe(); }, "END_FILE_SEQUENCE_OR_DURATION_AMBIGUOUS"],
      ["unexpected timing file name", fixture => { unlinkSync(fixture.members.get(fixture.postorder[0]!)!); writeFileSync(path.join(fixture.timingDirectory, "unbound.txt"), "opaque"); fixture.observe(); }, "UNEXPECTED_TIMING_FILE_NAME"],
      ["corrupt timing JSON", fixture => { writeFileSync(fixture.members.get(fixture.postorder[0]!)!, "{negative fixture"); fixture.observe(); }, "MALFORMED_TIMING_JSON"],
      ["wrong npm metadata version", fixture => { fixture.rewrite(fixture.postorder[0]!, value => { value.metadata.version = "0.0.0"; }); fixture.observe(); }, "UNQUALIFIED_TIMING_METADATA_OR_WALL_CLOCK"],
      ["unknown timing command", fixture => { fixture.rewrite(fixture.postorder[0]!, value => { value.metadata.command = ["run", "unbound"]; }); fixture.observe(); }, "UNQUALIFIED_TIMING_METADATA_OR_WALL_CLOCK"],
      ["duplicate timing command", fixture => { fixture.rewrite(fixture.postorder[1]!, value => { value.metadata.command[1] = fixture.postorder[0]!; }); fixture.observe(); }, "DUPLICATE_TIMING_COMMAND"],
      ["wrong timing duration", fixture => { fixture.rewrite(fixture.postorder[0]!, value => { value.timers["command:run"] = 0; }); fixture.observe(); }, "END_FILE_SEQUENCE_OR_DURATION_AMBIGUOUS"],
      ["negative npm wall duration", fixture => fixture.observe(fixture.headers, ["npm timing command:run Completed in -1ms\n", ...fixture.completions.slice(1)]), "NEGATIVE_NPM_WALL_DURATION"],
      ["unfinished wall timer", fixture => { fixture.rewrite(fixture.postorder[0]!, value => { value.unfinishedTimers = { active: [1, 2] }; }); fixture.observe(); }, "UNQUALIFIED_TIMING_METADATA_OR_WALL_CLOCK"],
      ["unterminated stream", fixture => { fixture.observe(); fixture.projected!.observe("stderr", "npm timing command:run"); }, "UNTERMINATED_STREAM_LINE"],
    ];
    for (const [label, alter, issue] of partialCases) await control("Gate57 timing " + label + " stays diagnostic PARTIAL", async () => {
      const fixture = timingFixture(); fixture.populate(); alter(fixture); const { value } = fixture.finish();
      assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY"); assert.ok(value.issues.includes(issue)); assert.ok(value.observations.ends.every(row => row.script === null && !row.timingFileMatched)); assertDiagnosticOnly(value);
    });
    await control("Gate57 timing unsupported npm protocol adds no npm environment or false completeness", async () => {
      const fixture = timingFixture({ npmVersion: "99.0.0" }); assert.equal(fixture.projected, undefined);
      assert.equal(existsSync(fixture.timingDirectory), false); assert.equal(existsSync(fixture.receiptFile), false);
    });
    await control("Gate57 timing backwards delivery UTC is diagnostic PARTIAL without a clock tolerance", async () => {
      let utc = Date.now(); const ControlledDate = class extends Date { constructor(value?: number) { super(value ?? (utc -= 1_000)); } };
      const fixture = timingFixture({ ports: { Date: ControlledDate } }); fixture.populate(); fixture.observe(); const { value } = fixture.finish();
      assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY"); assert.ok(value.issues.includes("DELIVERY_UTC_MOVED_BACKWARDS_WITH_MONOTONIC_PROGRESS")); assertDiagnosticOnly(value);
    });
    await control("Gate57 timing fractional clock deltas are retained without an invented drift threshold", async () => {
      let tick = 0; const fixture = timingFixture({ ports: { performance: { now: () => (tick += 0.125) }, started: 0 } });
      fixture.populate(); fixture.observe(); const { value } = fixture.finish(); assert.equal(value.status, "COMPLETE_DIAGNOSTIC_ONLY"); assertDiagnosticOnly(value);
    });
    for (const shape of ["unsupported", "lifecycle", "repeated"] as const) await control("Gate57 timing " + shape + " source graph remains ambiguous diagnostic data", async () => {
      const pkg: { name: string; version: string; scripts: Record<string, string> } = { name: "controlled", version: "0.0.0", scripts: { "verify:admin-runtime": shape === "unsupported" ? "echo unmodeled"
        : shape === "repeated" ? "npm run verify:leaf && npm run verify:leaf" : "npm run verify:leaf", "verify:leaf": "node leaf.mjs",
        ...(shape === "lifecycle" ? { "preverify:leaf": "node hidden.mjs" } : {}) } };
      const fixture = timingFixture({ package: pkg }); fixture.populate(); fixture.observe(); const { value } = fixture.finish();
      assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY"); assert.ok(value.issues.includes(shape === "unsupported" ? "UNSUPPORTED_BOUND_COMMAND_OR_PACKAGE"
        : shape === "lifecycle" ? "UNMODELED_NPM_LIFECYCLE_SCRIPT" : "REPEATED_SCRIPT_INVOCATION_AMBIGUOUS")); assertDiagnosticOnly(value);
    });
    await control("Gate57 timing unrelated argv touches no new runtime or filesystem port", async () => {
      const forbidden = () => { throw Error("Unrelated timing path touched a forbidden port."); };
      const fixture = timingFixture({ args: ["--experimental-strip-types", "unchanged.mts"], ports: { process: { get execPath() { return forbidden(); } }, existsSync: forbidden } });
      assert.equal(fixture.projected, undefined); assert.equal(existsSync(fixture.timingDirectory), false);
    });
    for (const reason of ["nonzero_exit", "timeout", "cancelled"] as const) await control("Gate57 timing preserves original " + reason + " facts without granting a gate result", async () => {
      const fixture = timingFixture(); fixture.populate(); fixture.observe(); const code = reason === "nonzero_exit" ? 7 : null;
      const { value } = fixture.finish({ code, reason }); assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY");
      assert.equal(value.child.code, code); assert.equal(value.child.reason, reason); assertDiagnosticOnly(value);
    });
    const integrityCases: Array<[string, (fixture: ReturnType<typeof timingFixture>) => void]> = [
      ["source drift", fixture => writeFileSync(fixture.packageFile, readFileSync(fixture.packageFile, "utf8") + " ")],
      ["argv drift", fixture => { fixture.args[2] = "changed-command"; }],
      ["runtime drift", fixture => writeFileSync(fixture.executable, "changed controlled runtime bytes")],
      ["npm source drift", fixture => writeFileSync(path.join(fixture.npmRoot, "lib", "npm.js"), "changed format source")],
    ];
    for (const [label, alter] of integrityCases) await control("Gate57 timing " + label + " preserves secondary integrity failure", async () => {
      const fixture = timingFixture(); fixture.populate(); fixture.observe(); alter(fixture);
      assert.throws(() => fixture.finish(), error => error instanceof assert.AssertionError);
      const value = JSON.parse(readFileSync(fixture.receiptFile, "utf8")) as TimingReceipt;
      assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY"); assert.ok(value.issues.includes("TIMING_EVIDENCE_INTEGRITY_OR_IO_FAILURE")); assertDiagnosticOnly(value);
    });
    for (const kind of ["link", "hardlink", "escape", "membership"] as const) await control("Gate57 timing " + kind + " cannot qualify physical raw files", async () => {
      let directoryReads = 0;
      const fixture = timingFixture({ ports: {
        lstatSync: (at: Parameters<typeof lstatSync>[0]) => { const stat = lstatSync(at); return typeof at === "string" && at.endsWith("-timing.json")
          ? { ...stat, isFile: () => true, isSymbolicLink: () => kind === "link", nlink: kind === "hardlink" ? 2 : stat.nlink } : stat; },
        realpathSync: (at: Parameters<typeof realpathSync>[0]) => typeof at === "string" && at.endsWith("-timing.json") && kind === "escape"
          ? path.join(directory, "outside-timing-file") : realpathSync(at),
        readdirSync: (at: Parameters<typeof readdirSync>[0]) => { const names = readdirSync(at); if (typeof at === "string" && at.endsWith("-npm-timing")
          && kind === "membership" && ++directoryReads === 2) return [...names, "unbound-timing.json"]; return names; },
      } });
      fixture.populate(); fixture.observe(); assert.throws(() => fixture.finish(), error => error instanceof assert.AssertionError);
      const value = JSON.parse(readFileSync(fixture.receiptFile, "utf8")) as TimingReceipt;
      assert.ok(value.issues.includes("TIMING_EVIDENCE_INTEGRITY_OR_IO_FAILURE")); assertDiagnosticOnly(value);
    });
    await control("Gate57 timing raw read failure retains exact secondary error and interrupted child facts", async () => {
      const failure = Error("Controlled timing read failure");
      const fixture = timingFixture({ ports: { readFileSync: (at: Parameters<typeof readFileSync>[0], options?: unknown) => {
        if (typeof at === "string" && at.endsWith("-timing.json")) throw failure; return readFileSync(at, options as BufferEncoding); } } });
      fixture.populate(); fixture.observe(); assert.throws(() => fixture.finish({ code: null, reason: "timeout" }), error => error === failure);
      const value = JSON.parse(readFileSync(fixture.receiptFile, "utf8")) as TimingReceipt;
      assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY"); assertDiagnosticOnly(value);
    });
    await control("Gate57 timing raw byte drift after capture cannot qualify its initial hash", async () => {
      const reads = new Map<string, number>();
      const fixture = timingFixture({ ports: { readFileSync: (at: Parameters<typeof readFileSync>[0], options?: unknown) => {
        const bytes = readFileSync(at, options as BufferEncoding);
        if (typeof at === "string" && at.endsWith("-timing.json")) { const count = (reads.get(at) ?? 0) + 1; reads.set(at, count);
          if (count > 1) return Buffer.from(bytes.toString() + " "); } return bytes; } } });
      fixture.populate(); fixture.observe(); assert.throws(() => fixture.finish(), error => error instanceof assert.AssertionError);
      const value = JSON.parse(readFileSync(fixture.receiptFile, "utf8")) as TimingReceipt;
      assert.ok(value.issues.includes("TIMING_EVIDENCE_INTEGRITY_OR_IO_FAILURE")); assertDiagnosticOnly(value);
    });
    await control("Gate57 timing generated credential projection refuses receipt publication", async () => {
      const fixture = timingFixture({ package: { name: "controlled", version: "0.0.0", scripts: { "verify:admin-runtime": "node private-sentinel.mjs" } } });
      fixture.populate(); fixture.observe(); assert.throws(() => fixture.finish(), error => error instanceof assert.AssertionError && /generated credential/u.test(error.message));
      assert.equal(existsSync(fixture.receiptFile), false);
    });
    // Actual short npm processes use the existing Native child owner. Only their package workspace is disposable.
    const npmCli = [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
      path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
      path.resolve(path.dirname(process.execPath), "../share/nodejs/npm/bin/npm-cli.js")].find(at => existsSync(at) && lstatSync(at).isFile());
    assert.ok(npmCli, "The controlled npm timing probe requires the current installed npm CLI.");
    const actualNpmVersion = (JSON.parse(readFileSync(path.join(path.resolve(path.dirname(npmCli), ".."), "package.json"), "utf8")) as { version: string }).version;
    const actualNpmTimingSupported = actualNpmVersion === "11.9.0";
    const npmFixtureDirectory = realpathSync(mkdtempSync(path.join(directory, "timing-package-")));
    const npmPackage = { name: "venisia-owned-timing-control", version: "0.0.0", private: true, scripts: {
      "verify:admin-runtime": "npm run verify:timing-branch && npm run qa:timing-leaf",
      "verify:timing-baseline": "npm run verify:timing-branch && npm run qa:timing-leaf",
      "verify:timing-branch": "npm run verify:timing-leaf", "verify:timing-leaf": "node leaf.mjs", "qa:timing-leaf": "node leaf.mjs",
    } };
    writeFileSync(path.join(npmFixtureDirectory, "package.json"), JSON.stringify(npmPackage), { flag: "wx" });
    writeFileSync(path.join(npmFixtureDirectory, "leaf.mjs"), "process.stdout.write('timing-leaf:' + process.env.npm_lifecycle_event + '\\n');process.stdout.write('timing-enabled:'+(process.env.npm_config_timing==='true')+'\\n');\n"
      + "if(process.env.VENESIA_TIMING_CONTROL_HOLD==='1'){process.stdout.write('timing-controlled-ready\\n');setInterval(()=>{},1000);}\n", { flag: "wx" });
    const npmEnvironment = { ...environment, CI: "1", npm_config_update_notifier: "false", npm_config_audit: "false", npm_config_fund: "false",
      npm_config_userconfig: path.join(npmFixtureDirectory, "user.npmrc"), npm_config_globalconfig: path.join(npmFixtureDirectory, "global.npmrc"),
      npm_config_cache: path.join(npmFixtureDirectory, "cache") };
    writeFileSync(npmEnvironment.npm_config_userconfig, "", { flag: "wx" }); writeFileSync(npmEnvironment.npm_config_globalconfig, "", { flag: "wx" });
    const npmSourceProof = path.join(directory, "npm-timing-fixture-source"); mkdirSync(npmSourceProof);
    const npmSourceFiles = ["package.json", "leaf.mjs", "user.npmrc", "global.npmrc"].map(member => {
      const original = path.join(npmFixtureDirectory, member), preserved = path.join(npmSourceProof, member), bytes = readFileSync(original);
      writeFileSync(preserved, bytes, { flag: "wx", mode: 0o600 }); return { original, preserved, bytes: bytes.length, sha256: sha256(bytes) };
    });
    const actualNpm = (name: string, script: string, hold: boolean, signal = new AbortController().signal, limitMs = 30_000) =>
      api.run({ sourceDirectory: npmFixtureDirectory, context, children, signal }, [npmCli, "run", script],
        { ...npmEnvironment, ...(hold ? { VENESIA_TIMING_CONTROL_HOLD: "1" } : {}) }, name, limitMs);
    const readTiming = (reference: TimingReference) => { const at = path.join(directory, reference.file), bytes = readFileSync(at);
      assert.equal(sha256(bytes), reference.sha256); const value = JSON.parse(bytes.toString()) as TimingReceipt;
      for (const row of value.files) { assert.ok(row.file.startsWith(realpathSync(directory) + path.sep));
        const bytes = readFileSync(row.file); assert.equal(bytes.length, row.bytes); assert.equal(sha256(bytes), row.sha256); }
      assertDiagnosticOnly(value); return value; };
    try {
      await control("actual short npm paired aliases retain diagnostic overhead without a release speedup claim", async () => {
        const baseline = await actualNpm("npm-timing-baseline", "verify:timing-baseline", false);
        assert.equal(baseline.code, 0); assert.equal(baseline.timingEvidence, undefined); assert.match(baseline.stdout, /timing-enabled:false/u);
        const measured = await actualNpm("npm-timing-measured", "verify:admin-runtime", false);
        assert.equal(measured.code, 0);
        if (actualNpmTimingSupported) {
          assert.ok(measured.timingEvidence); assert.match(measured.stdout, /timing-enabled:true/u);
          const value = readTiming(measured.timingEvidence); assert.equal(value.enabled, true);
          assert.equal(value.status, "COMPLETE_DIAGNOSTIC_ONLY"); assert.deepEqual(value.issues, []);
          assert.equal(value.source.packageSha256, sha256(readFileSync(path.join(npmFixtureDirectory, "package.json"))));
          assert.deepEqual(value.source.invocationPreorder.map(row => row.script), ["verify:admin-runtime", "verify:timing-branch", "verify:timing-leaf", "qa:timing-leaf"]);
        } else { assert.equal(measured.timingEvidence, undefined); assert.match(measured.stdout, /timing-enabled:false/u); }
        for (const result of [baseline, measured]) { assert.equal(result.cleanup.status, "PASS"); assert.equal(result.cleanup.liveProcesses, 0); }
        const proof = { control: "actual_short_npm_timing_probe", actualNpmVersion, actualNpmTimingSupported, baseline, measured, signedDurationDifferenceMs: measured.durationMs - baseline.durationMs,
          comparisonBoundary: "One sequential pair with different root npm argv/lifecycle names; no causal overhead threshold or production speedup inference",
          canonicalGate57Executed: false, releaseEvidence: false, automaticRetries: 0 };
        writeFileSync(path.join(directory, "npm-timing-paired-proof.json"), JSON.stringify(proof, null, 2) + "\n", { flag: "wx", mode: 0o600 }); runtimeProofs.push(proof);
      });
      for (const reason of ["timeout", "cancelled"] as const) await control("actual short npm " + reason + " keeps partial timing and Native cleanup", async () => {
        const controller = new AbortController();
        const pending = actualNpm("npm-timing-" + reason, "verify:admin-runtime", true, controller.signal, reason === "timeout" ? 1_500 : 20_000);
        const outcome = pending.then(value => value, (error: unknown) => error);
        try { if (reason === "cancelled") {
          const child = [...children][0]; assert.ok(child?.stdout);
          await new Promise<void>((done, reject) => {
            let observed = ""; const timer = setTimeout(() => { controller.abort(); reject(Error("Controlled npm did not reach its fixed readiness marker.")); }, 10_000);
            const receive = (chunk: unknown) => { observed = (observed + String(chunk)).slice(-1_024);
              if (observed.includes("timing-controlled-ready\n")) { clearTimeout(timer); child.stdout!.off("data", receive); done(); } };
            child.stdout!.on("data", receive); child.once("error", () => { clearTimeout(timer); reject(Error("Controlled npm failed before readiness.")); });
          });
          controller.abort(Error("Controlled npm timing cancellation"));
        } } catch (error) { controller.abort(); await outcome; throw error; }
        const error = await outcome; assert.ok(error instanceof Error); assert.match(error.message, /aborted or exceeded its bound/u);
        const retained = (error as Error & { childResult: Awaited<ReturnType<typeof api.run>> & { reason: string } }).childResult;
        assert.equal(retained.reason, reason); assert.equal(retained.cleanup.status, "PASS"); assert.equal(retained.cleanup.liveProcesses, 0); assert.equal(children.size, 0);
        if (actualNpmTimingSupported) { assert.ok(retained.timingEvidence); const value = readTiming(retained.timingEvidence); assert.equal(value.status, "PARTIAL_DIAGNOSTIC_ONLY"); }
        else assert.equal(retained.timingEvidence, undefined);
        if (process.platform === "win32") { assert.equal(retained.nativeJobReceipt?.reason, reason); assert.equal(retained.nativeJobReceipt?.cleanup.activeProcessesAfterCleanup, 0); }
        const proof = { control: "actual_short_npm_" + reason, actualNpmVersion, actualNpmTimingSupported, originalFailureClass: error.name, originalChildResult: retained,
          canonicalGate57Executed: false, canonicalDeadlineChanged: false, releaseEvidence: false, automaticRetries: 0 };
        writeFileSync(path.join(directory, "npm-timing-" + reason + "-proof.json"), JSON.stringify(proof, null, 2) + "\n", { flag: "wx", mode: 0o600 }); runtimeProofs.push(proof);
      });
    } finally {
      assert.equal(children.size, 0, "Close actual controlled npm jobs before deleting only their package workspace.");
      assert.equal(realpathSync(npmFixtureDirectory), npmFixtureDirectory);
      assert.ok(path.basename(npmFixtureDirectory).startsWith("timing-package-") && path.dirname(npmFixtureDirectory) === directory);
      for (const row of npmSourceFiles) { assert.equal(sha256(readFileSync(row.original)), row.sha256); assert.equal(sha256(readFileSync(row.preserved)), row.sha256); }
      writeFileSync(path.join(directory, "npm-timing-fixture-source-binding.json"), JSON.stringify({ schema: 1, sourceDirectory: npmFixtureDirectory,
        files: npmSourceFiles, actualControlledPackage: true, canonicalGate57Executed: false, releaseEvidence: false }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      rmSync(npmFixtureDirectory, { recursive: true, force: true }); assert.equal(existsSync(npmFixtureDirectory), false);
    }
    const applicationOwner = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
      && node.name?.text === "runOwnedPublicVerification");
    assert.ok(applicationOwner?.body);
    const applicationVariables = ["nativeApplications", "stopNativeApplication"].map(name => {
      const declaration = applicationOwner.body!.statements.find((node): node is ts.VariableStatement => ts.isVariableStatement(node)
        && node.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === name));
      assert.ok(declaration, "Use the actual application lifecycle declaration: " + name); return declaration.getText(file);
    });
    const appBlocks: ts.Block[] = [];
    const findAppBlock = (node: ts.Node) => {
      if (ts.isBlock(node) && node.statements.some(statement => ts.isVariableStatement(statement)
        && statement.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === "appArgs"))) appBlocks.push(node);
      ts.forEachChild(node, findAppBlock);
    };
    findAppBlock(applicationOwner); assert.equal(appBlocks.length, 1);
    const appStatements = appBlocks[0]!.statements;
    const appStart = appStatements.findIndex(node => ts.isVariableStatement(node)
      && node.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === "appArgs"));
    const appEnd = appStatements.findIndex(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
      && node.expression.expression.getText(file) === "assert.ok" && node.expression.arguments[0]?.getText(file) === "ready");
    assert.ok(appStart >= 0 && appEnd > appStart);
    const applicationBody = appStatements.slice(appStart, appEnd + 1).map(node => node.getText(file)).join("\n");
    type ApplicationProjection = { ready: Promise<void>; children: Set<ChildProcess>; stop(): Promise<void>;
      states: Map<ChildProcess, { failure?: unknown; stopping: boolean; windows: ReturnType<typeof spawnWindowsOwnedProcess> }> };
    const applicationCode = ts.transpileModule(applicationVariables.join("\n") + "\nreturn {start:()=>{const ready=(async()=>{"
      + applicationBody + "})();ready.catch(()=>undefined);return {ready,children,states:nativeApplications,stop:async()=>{for(const state of nativeApplications.values())await stopNativeApplication(state);}};}};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const buildApplication = (ports: { directory: string; name: string; port: number; signal?: AbortSignal; platform?: string;
      environment?: NodeJS.ProcessEnv; measurement?: { study?: string; controlDirectory: string }; coreFault?: boolean;
      write?: typeof writeFileSync; launch?: typeof spawn; native?: typeof spawnWindowsOwnedProcess; }) => {
      const appContext = { ...context, runDirectory: ports.directory };
      const projected = new Function("assert", "process", "spawnWindowsOwnedProcess", "spawn", "stopChild", "ownedPath", "receipt", "writeFileSync", "join", "resolve",
        "context", "sourceDirectory", "ROOT", "gate", "appPort", "childEnvironment", "measurement", "coreFault", "coreControl", "adoption", "signal", "fetch",
        "const children=new Set();let appFailed=false,gateApp;" + applicationCode)(assert, { platform: ports.platform ?? process.platform, execPath: process.execPath },
        ports.native ?? launchWindows, ports.launch ?? spawn, api.stop, (value: { runDirectory: string }, name: string) => path.join(value.runDirectory, name),
        (value: { runDirectory: string }, name: string, data: unknown) => (ports.write ?? writeFileSync)(path.join(value.runDirectory, name), JSON.stringify(data), { flag: "wx", mode: 0o600 }),
        ports.write ?? writeFileSync, path.join, path.resolve, appContext, ports.directory, root, { name: ports.name, limitMs: 10_000 }, ports.port,
        { ...environment, ...ports.environment }, ports.measurement, ports.coreFault ?? false, ports.coreFault ? path.join(ports.directory, "core-control.json") : null,
        false, ports.signal ?? new AbortController().signal, fetch) as { start(): ApplicationProjection };
      return projected.start();
    };
    await control("application source preserves all five Linux selectors arguments environment and spawn options", async () => {
      for (const name of ["public-e2e", "admin-interactions", "admin-adoption", "media-upload-limit", "hero-compatibility"]) {
        let observedArgs: readonly string[] | undefined, observedOptions: unknown;
        const coreFault = name === "admin-adoption", measurement = name === "admin-interactions" ? { study: "heavy-editor-performance", controlDirectory: directory } : undefined;
        const fake = new EventEmitter() as ChildProcess;
        Object.assign(fake, { stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null, signalCode: null, pid: 1 });
        const launch = ((executable: string, args: readonly string[], options: unknown) => { assert.equal(executable, process.execPath);
          observedArgs = args; observedOptions = options; return fake; }) as typeof spawn;
        const controller = new AbortController(); controller.abort(Error("Controlled pre-readiness stop"));
        const projected = buildApplication({ directory, name, port: 1, platform: "linux", coreFault, measurement, launch,
          signal: controller.signal, native: (() => { assert.fail("Linux must preserve its existing direct spawn path."); }) as typeof spawnWindowsOwnedProcess });
        await assert.rejects(projected.ready, /Controlled pre-readiness stop/u);
        const expectedArgs = [...(coreFault ? ["--require", path.join(directory, "scripts/fixtures/admin-core-command-cache-fault.cjs")] : []),
          ...(measurement ? ["--require", path.join(root, "scripts/fixtures/admin-interaction-server-trace.cjs")] : []),
          path.join(directory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "1"];
        assert.deepEqual(observedArgs, expectedArgs);
        assert.deepEqual(observedOptions, { cwd: directory, env: measurement ? { ...environment,
          QA_ADMIN_SERVER_TRACE_PATH: path.join(directory, "admin-server-trace.jsonl"), QA_ADMIN_TRACE_CONTROL_PATH: path.join(directory, "server-trace-mode.json") }
          : coreFault ? { ...environment, QA_ADMIN_CORE_CACHE_CONTROL: path.join(directory, "core-control.json") } : environment,
          windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        assert.equal(projected.states.size, 0); projected.children.clear();
      }
      const ownerText = applicationOwner.getText(file);
      assert.ok(ownerText.indexOf('context.record("public-gate-pass", { gate: gate.name });\n      if (gateApp && !nativeApplications.has(gateApp)) await stopChild') >= 0);
    });
    if (process.platform === "win32") {
      const makeApplication = async (name: string, mode: string, overrides: Partial<Parameters<typeof buildApplication>[0]> = {}) => {
        const appDirectory = path.join(directory, "application-" + name); mkdirSync(appDirectory);
        const target = path.join(appDirectory, "node_modules/next/dist/bin"); mkdirSync(target, { recursive: true });
        writeFileSync(path.join(target, "next"), "const http=require('node:http');const mode=process.env.QA_OWNED_HTTP_MODE;"
          + "if(mode==='exit-zero')process.exit(0);if(mode==='exit-seven')process.exit(7);"
          + "const port=Number(process.argv[process.argv.indexOf('--port')+1]);"
          + "const server=http.createServer((req,res)=>{res.statusCode=200;res.end('owned');});"
          + "if(mode!=='never-ready')server.listen(port,'127.0.0.1',()=>process.stdout.write('ready private-sentinel'));"
          + "process.stderr.write('server private-sentinel');setInterval(()=>{},1000);", { flag: "wx" });
        const port = await new Promise<number>((done, reject) => { const server = createNetServer(); server.once("error", reject);
          server.listen(0, "127.0.0.1", () => { const port = (server.address() as AddressInfo).port; server.close(error => error ? reject(error) : done(port)); }); });
        const projected = buildApplication({ directory: appDirectory, name, port, environment: { NODE_ENV: "test", QA_OWNED_HTTP_MODE: mode }, ...overrides });
        return { projected, appDirectory };
      };
      await control("actual adopted native application serves HTTP and intentional stop proves root helper and terminal cleanup separately", async () => {
        let requestedLimit = 0;
        const { projected, appDirectory } = await makeApplication("http", "ready", { native: options => {
          requestedLimit = options.limitMs; return launchWindows(options);
        } });
        try {
          await projected.ready; const state = [...projected.states.values()][0]!;
          const identity = state.windows.readIdentity(); assert.ok(identity?.rootPid && identity.ownerJobAssignedBeforeResume);
          assert.equal(state.windows.readReceipt(), null); assert.equal(requestedLimit, 120_000 + 10_000 + 20_000);
          await projected.stop(); const terminal = state.windows.readReceipt()!;
          assert.equal(terminal.reason, "owner_shutdown"); assert.equal(terminal.cleanup.activeProcessesAfterCleanup, 0);
          assert.equal(terminal.cleanup.retainedOwnedHandlesSignaled, true); assert.equal(state.windows.child.exitCode, 0);
          assert.equal(projected.children.size, 0);
          assert.match(readFileSync(path.join(appDirectory, "public-server.log"), "utf8"), /ready \[redacted\]/u);
          runtimeProofs.push({ control: "actual_adopted_native_application", sourceProjectionSha256: sha256(applicationBody), requestedLimit,
            identity, terminal, helperExit: state.windows.child.exitCode, applicationDirectory: path.basename(appDirectory) });
        } finally { await projected.stop(); }
      });
      for (const [mode, code] of [["exit-zero", 0], ["exit-seven", 7]] as const) await control("adopted native application rejects unexpected already-closed root " + code, async () => {
        const { projected } = await makeApplication(mode, mode);
        await assert.rejects(projected.ready, /Owned application exited/u);
        await assert.rejects(projected.stop(), /Owned application exited/u);
        const state = [...projected.states.values()][0]!, terminal = state.windows.readReceipt()!;
        assert.equal(terminal.rootExitCode, code); assert.equal(state.windows.child.exitCode, 0);
        assert.equal(terminal.reason, "completed"); assert.equal(terminal.cleanup.activeProcessesAfterCleanup, 0);
      });
      await control("adopted native application cancellation and actual timeout still drain their known owned handles", async () => {
        const controller = new AbortController(), aborted = await makeApplication("cancel", "ready", { signal: controller.signal });
        await aborted.projected.ready; controller.abort(Error("Original driver cancellation")); await aborted.projected.stop();
        assert.equal([...aborted.projected.states.values()][0]!.windows.readReceipt()!.cleanup.activeProcessesAfterCleanup, 0);
        const timed = await makeApplication("timeout", "never-ready", { native: options => launchWindows({ ...options, limitMs: 1_500 }) });
        await assert.rejects(timed.projected.ready, /Owned application exited/u);
        await assert.rejects(timed.projected.stop(), /Owned application exited/u);
        assert.equal([...timed.projected.states.values()][0]!.windows.readReceipt()!.reason, "timeout");
      });
      await control("actual adopted application keeps native setup failure when its log writer also fails", async () => {
        const original = Error("Original native helper startup failure"), secondary = Error("Secondary server log failure");
        const launch = ((options: Parameters<typeof spawnWindowsOwnedProcess>[0]) => {
          const fake = new EventEmitter() as ChildProcess; Object.assign(fake, { stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null, signalCode: null });
          Object.defineProperty(fake, "verificationWindowsCleanup", { value: async () => { throw secondary; } });
          queueMicrotask(() => fake.emit("error", original));
          return { child: fake, readIdentity: () => null, readReceipt: () => null, native: { sourceSha256: sha256(String(options.limitMs)) } } as unknown as ReturnType<typeof spawnWindowsOwnedProcess>;
        });
        const { projected } = await makeApplication("startup-error", "ready", { native: launch, write: (() => { throw secondary; }) as typeof writeFileSync });
        await assert.rejects(projected.ready, error => error === original); await assert.rejects(projected.stop(), error => error === original);
        assert.equal(Object.getOwnPropertyDescriptor(original, "applicationCleanupFailure")?.value, secondary);
      });
      await control("actual adopted application rejects completed root despite intentional-stop flag racing close", async () => {
        const terminal = JSON.parse(readFileSync(path.join(directory, "application-exit-zero/public-exit-zero-server.native-result.json"), "utf8"));
        const identity = JSON.parse(readFileSync(path.join(directory, "application-exit-zero/public-exit-zero-server.native-identity.json"), "utf8"));
        const child = { exitCode: 0, signalCode: null, verificationWindowsCleanup: async () => ({ status: "PASS" }) } as unknown as ChildProcess;
        const state = { child, name: "completed-race", windows: { readIdentity: () => identity, readReceipt: () => terminal }, stopping: false, closed: Promise.resolve() };
        const body = ts.transpileModule(applicationVariables[1]!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
        const stop = new Function("stopChild", "context", "assert", "receipt", body + ";return stopNativeApplication;")(api.stop, context, assert, () => undefined) as (value: typeof state) => Promise<void>;
        await assert.rejects(stop(state), /before its intentional shutdown/u); assert.equal(state.stopping, true);
      });
      await control("actual application stop rejects missing identity missing terminal and corrupt stop reason", async () => {
        const body = ts.transpileModule(applicationVariables[1]!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
        const identity = JSON.parse(readFileSync(path.join(directory, "application-http/public-http-server.native-identity.json"), "utf8"));
        const terminal = JSON.parse(readFileSync(path.join(directory, "application-http/public-http-server.native-result.json"), "utf8"));
        for (const missing of ["identity", "terminal", "reason"]) {
          const stop = new Function("stopChild", "context", "assert", "receipt", body + ";return stopNativeApplication;")(
            async () => ({ status: "PASS" }), context, assert, () => { assert.fail("Missing evidence cannot publish a lifecycle PASS."); }) as (value: unknown) => Promise<void>;
          const changed = structuredClone(terminal); if (missing === "reason") delete changed.reason;
          const state = { child: { exitCode: 0, signalCode: null }, name: "missing", stopping: false, closed: Promise.resolve(),
            windows: { readIdentity: () => missing === "identity" ? null : identity, readReceipt: () => missing === "terminal" ? null : changed } };
          await assert.rejects(stop(state), missing === "reason" ? /before its intentional shutdown/u : /identity and terminal evidence are required/u);
        }
      });
      await control("actual public cleanup boundary preserves the first driver error and retains secondary cleanup privately", async () => {
        const mainTry = applicationOwner.body!.statements.find((node): node is ts.TryStatement => ts.isTryStatement(node) && Boolean(node.finallyBlock));
        const cleanupTry = mainTry?.finallyBlock?.statements.find((node): node is ts.TryStatement => ts.isTryStatement(node));
        assert.ok(cleanupTry?.catchClause);
        const catchCode = ts.transpileModule("try { throw secondary; } " + cleanupTry.catchClause.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
        const original = Error("Original driver assertion"), secondary = Error("Secondary cleanup failure");
        const settle = new Function("publicFailure", "secondary", "context", "const publicFailed=true;" + catchCode);
        settle(original, secondary, { record: () => { throw Error("Secondary receipt failure"); } });
        assert.equal(Object.getOwnPropertyDescriptor(original, "publicCleanupFailure")?.value, secondary);
        assert.equal(Object.keys(original).includes("publicCleanupFailure"), false);
        const frozen = Object.freeze(Error("Frozen original driver failure"));
        assert.doesNotThrow(() => settle(frozen, secondary, { record: () => { throw secondary; } }));
      });
      await control("actual pending-driver rejection preserves the already observed native application failure", async () => {
        const callbacks: ts.ArrowFunction[] = [];
        const findDriverCatch = (node: ts.Node) => {
          if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "catch"
            && ts.isCallExpression(node.expression.expression) && node.expression.expression.expression.getText(file) === "runChild") {
            const callback = node.arguments[0]; assert.ok(callback && ts.isArrowFunction(callback)); callbacks.push(callback);
          }
          ts.forEachChild(node, findDriverCatch);
        };
        findDriverCatch(applicationOwner); assert.equal(callbacks.length, 1);
        const original = Error("Earlier application root exit"), later = Error("Later driver timeout"), gateApp = {};
        const body = ts.transpileModule("const onFailure=" + callbacks[0]!.getText(file) + ";", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
        const onFailure = new Function("gateApp", "nativeApplications", body + ";return onFailure;")(gateApp,
          new Map([[gateApp, { failure: original }]])) as (error: Error) => never;
        assert.throws(() => onFailure(later), error => error === original);
        assert.equal(Object.getOwnPropertyDescriptor(original, "applicationDriverFailure")?.value, later);
        assert.equal(Object.keys(original).includes("applicationDriverFailure"), false);
      });
    }
    await control("Full E cleanup qualification requires the current platform ownership capability", async () => {
      const verifyQualification = (ownerApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "ownedProcessCleanupQualification">) => {
        const qualification = ownerApi.ownedProcessCleanupQualification();
        assert.equal(qualification.fullEProcessCleanupQualified, process.platform === "linux" || process.platform === "win32");
        assert.equal(qualification.status, process.platform === "linux" || process.platform === "win32" ? "PASS" : "BLOCKED");
        if (process.platform === "win32") assert.equal(windowsOwnedProcessCapability().status, "PASS");
      };
      verifyQualification(api);
    });
    await control("actual CLI and direct Full E admission reject unqualified root-exit cleanup before their owned allocation boundaries", async () => {
      const qualification = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ownedProcessCleanupQualification");
      const direct = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "runOwnedPublicVerification");
      assert.ok(qualification && direct);
      const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      const project = (platform: string) => new Function("process", "windowsOwnedProcessCapability", compile(qualification.getText(file).replace(/^export /u, ""))
        + ";return ownedProcessCleanupQualification;")({ platform }, () => ({ status: "BLOCKED", missingProof: "controlled_native_capability_unavailable" })) as typeof api.ownedProcessCleanupQualification;
      const windows = project("win32"), supported = project("linux"), finalHead = "b".repeat(40);
      const cliTree = ts.createSourceFile("qa-isolated-supabase.mts", readSource("scripts/qa-isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const cli = cliTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "heroCompatibilityProof");
      const lifecycleTree = ts.createSourceFile("isolated-supabase.mts", readSource("scripts/lib/isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const errorClass = lifecycleTree.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === "IsolatedSupabaseError");
      assert.ok(cli && errorClass);
      const IsolatedError = new Function(compile(errorClass.getText(lifecycleTree).replace(/^export /u, "")) + ";return IsolatedSupabaseError;")() as new (code: string, stage: string) => Error & { code: string };
      let inputs = 0, recorders = 0, allocations = 0, ownershipReads = 0;
      const stop = Error("controlled inputs boundary; no resources allocated");
      const buildCli = (predicate: typeof windows) => new Function("assert", "execFileSync", "root", "ownedProcessCleanupQualification", "IsolatedSupabaseError", "proofInputs", "createProofRecorder", "runIsolatedSupabase",
        compile(cli.getText(cliTree)) + ";return heroCompatibilityProof;")(assert, () => finalHead + "\n", root, predicate, IsolatedError,
        () => { inputs++; throw stop; }, () => { recorders++; throw stop; }, () => { allocations++; throw stop; }) as (args: string[]) => Promise<unknown>;
      await assert.rejects(buildCli(windows)(["--final-quality-head", finalHead]), error => error instanceof IsolatedError && error.code === "FINAL_QUALITY_PROCESS_CLEANUP_UNQUALIFIED");
      assert.equal(inputs, 0); assert.equal(recorders, 0); assert.equal(allocations, 0);
      await assert.rejects(buildCli(windows)([]), error => error === stop);
      await assert.rejects(buildCli(supported)(["--final-quality-head", finalHead]), error => error === stop);
      assert.equal(inputs, 2); assert.equal(recorders, 0); assert.equal(allocations, 0);
      const directQualification = { status: "PASS" } as import("./lib/isolated-public-verification.mts").LocalVerificationAdmissionQualification;
      const directFloor = { checks: [] }, directInvocations = new WeakMap([[directQualification,
        { sha256: sha256(JSON.stringify(directQualification)), sourceFloor: directFloor, sourceFloorSha256: sha256(JSON.stringify(directFloor)) }]]);
      const operationalDeadline = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "localVerificationOperationalDeadlineMs"); assert.ok(operationalDeadline);
      const buildDirect = new Function("assert", "digest", "localVerificationAdmissionInvocations", "ownedProcessCleanupQualification", compile(operationalDeadline.getText(file).replace(/^export /u, "") + "\n" + direct.getText(file).replace(/^export /u, ""))
        + ";return runOwnedPublicVerification;")(assert, sha256, directInvocations, windows) as typeof import("./lib/isolated-public-verification.mts").runOwnedPublicVerification;
      const directContext: Parameters<typeof buildDirect>[0] = { ...context, apiPort: 0, anonKey: "controlled-noncredential",
        serviceKey: "controlled-noncredential", assertOwned: async () => { ownershipReads++; throw stop; }, record: () => { throw stop; } };
      await assert.rejects(buildDirect(directContext,
        { additionalSourceFiles: [], finalQualityGate: true, admissionQualification: directQualification }, new AbortController().signal, async () => undefined),
      error => error instanceof Error && "code" in error && error.code === "FINAL_QUALITY_PROCESS_CLEANUP_UNQUALIFIED");
      assert.equal(ownershipReads, 0);
      runtimeProofs.push({ control: "full_quality_admission", cliBeforeInputsRecorderAndResources: true, directBeforeGateOwnershipRead: true,
        boundedCliAdmissionPreserved: true, supportedProjectionReachesOnlyControlledInputs: true, actualResourcesAllocated: 0 });
    });
    await control("success preserves sanitized stdout stderr duration and cleanup", async () => {
      const result = await run("success", ["-e", "process.stdout.write('ok private-sentinel');process.stderr.write('warning private-sentinel');"]);
      assert.equal(result.code, 0); assert.equal(result.stdout, "ok [redacted]"); assert.equal(result.stderr, "warning [redacted]");
      assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0); assert.equal(children.size, 0);
      assert.equal(readFileSync(path.join(directory, "public-success.stdout.log"), "utf8"), result.stdout);
      assert.equal(readFileSync(path.join(directory, "public-success.stderr.log"), "utf8"), result.stderr);
      assert.equal(result.cleanup.status, "PASS"); assert.equal(result.cleanup.liveProcesses, 0);
      assert.equal(result.cleanup.processTreeVerified, process.platform === "linux" || process.platform === "win32");
      assert.deepEqual(result.rawExit, { code: 0, signal: null });
      assert.equal(result.identity.ppid, process.platform === "win32" ? result.helperIdentity?.pid : process.pid);
      assert.ok(Number.isSafeInteger(result.identity.pid) && Number.isFinite(Date.parse(result.identity.spawnedAtUtc)));
      if (process.platform === "win32") {
        assert.equal(result.cleanup.method, "windows-private-job"); assert.equal(result.cleanup.residualProcessesAfterExit, 0);
        assert.equal(result.nativeJobReceipt?.cleanup.activeProcessesAfterCleanup, 0);
      }
    });
    await control("duplicate evidence names reject before execution and preserve both original logs", async () => {
      const before = readdirSync(directory).sort(), output = readFileSync(path.join(directory, "public-success.stdout.log")), errors = readFileSync(path.join(directory, "public-success.stderr.log"));
      await assert.rejects(run("success", ["-e", "throw Error('duplicate must not execute')"]), /evidence already exists/u);
      assert.equal(children.size, 0); assert.deepEqual(readdirSync(directory).sort(), before);
      assert.deepEqual(readFileSync(path.join(directory, "public-success.stdout.log")), output);
      assert.deepEqual(readFileSync(path.join(directory, "public-success.stderr.log")), errors);
    });
    await control("invalid deadlines reject before process or evidence allocation", async () => {
      const before = readdirSync(directory).sort();
      for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, 2_147_483_648]) await assert.rejects(run("invalid-deadline", ["-e", "throw Error('must not execute')"], new AbortController().signal, limit), /deadline must be a finite timer-safe positive integer/u);
      assert.equal(children.size, 0); assert.deepEqual(readdirSync(directory).sort(), before);
    });
    await control("ownership marker is fresh for the child and redacted from every retained log", async () => {
      const result = await run("marker", ["-e", "const marker=process.env.VENESIA_QA_OWNED_CHILD;if(!/^[a-f0-9-]{36}$/.test(marker||''))throw Error('missing ownership');process.stdout.write(marker);process.stderr.write(marker);"]);
      assert.equal(result.stdout, "[REDACTED_CHILD_OWNERSHIP]"); assert.equal(result.stderr, "[REDACTED_CHILD_OWNERSHIP]");
      assert.equal(readFileSync(path.join(directory, "public-marker.stdout.log"), "utf8"), result.stdout);
      assert.equal(readFileSync(path.join(directory, "public-marker.stderr.log"), "utf8"), result.stderr);
      assert.equal(environment.VENESIA_QA_OWNED_CHILD, undefined); assert.equal(children.size, 0);
    });
    await control("nonzero status retains actual output duration and cleanup", async () => {
      const result = await run("nonzero", ["-e", "process.stdout.write('partial');process.stderr.write('failure');process.exitCode=7;"]);
      assert.equal(result.code, 7); assert.equal(result.stdout, "partial"); assert.equal(result.stderr, "failure");
      assert.deepEqual(result.rawExit, { code: 7, signal: null });
      runtimeProofs.push({ scope: "abnormal_nonzero_exit", rawExit: result.rawExit, identity: result.identity, cleanup: result.cleanup });
      assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0); assert.equal(children.size, 0);
    });
    await control("sanitizer failure rejects instead of escaping the close callback", async () => {
      const failure = new Error("Controlled sanitizer failure");
      const failingContext = { ...context, sanitize: (): string => { throw failure; } };
      await assert.rejects(api.run({ sourceDirectory: directory, context: failingContext, children, signal: new AbortController().signal },
        ["-e", "process.stdout.write('private-sentinel');"], { ...environment }, "sanitize-failure", 10_000), (error: unknown) => error === failure);
      assert.equal(children.size, 0);
      assert.equal(existsSync(path.join(directory, "public-sanitize-failure.stdout.log")), false);
      assert.equal(existsSync(path.join(directory, "public-sanitize-failure.stderr.log")), false);
    });
    await control("log-write failure rejects and retains the already sanitized output", async () => {
      const failure = new Error("Controlled stderr-log write failure");
      const failingWrite: typeof writeFileSync = (file, data, options) => {
        if (typeof file === "string" && file.endsWith("public-write-failure.stderr.log")) throw failure;
        writeFileSync(file, data, options);
      };
      await assert.rejects(buildApi(failingWrite).run({ sourceDirectory: directory, context, children, signal: new AbortController().signal },
        ["-e", "process.stdout.write('partial private-sentinel');process.stderr.write('failure private-sentinel');"], { ...environment }, "write-failure", 10_000),
      (error: unknown) => error === failure);
      assert.equal(children.size, 0);
      assert.equal(readFileSync(path.join(directory, "public-write-failure.stdout.log"), "utf8"), "partial [redacted]");
      assert.equal(existsSync(path.join(directory, "public-write-failure.stderr.log")), false);
    });
    await control("timeout remains the primary failure when sanitization also fails", async () => {
      const failure = new Error("Secondary sanitizer failure");
      const failingContext = { ...context, sanitize: (): string => { throw failure; } };
      await assert.rejects(api.run({ sourceDirectory: directory, context: failingContext, children, signal: new AbortController().signal },
        ["-e", "setInterval(()=>{},1000)"], { ...environment }, "timeout-sanitize-failure", process.platform === "win32" ? 1_500 : 100),
      (error: unknown) => error instanceof Error && /aborted or exceeded its bound/u.test(error.message) && error.cause === failure);
      assert.equal(children.size, 0);
    });
    await control("timeout rejects and removes the owned process", async () => {
      const deadlineMs = process.platform === "win32" ? 1_500 : 100;
      await assert.rejects(run("timeout", ["-e", "setInterval(()=>{},1000)"], new AbortController().signal, deadlineMs), (error: unknown) => {
        assert.ok(error instanceof Error && /aborted or exceeded its bound/u.test(error.message));
        const retained = (error as Error & { childResult: { reason: string; durationMs: number;
          nativeJobReceipt?: import("./lib/windows-owned-process.mts").WindowsJobReceipt | null; cleanup: { status: string; liveProcesses: number } } }).childResult;
        assert.equal(retained.reason, "timeout"); assert.ok(retained.durationMs >= deadlineMs);
        assert.equal(retained.cleanup.status, "PASS"); assert.equal(retained.cleanup.liveProcesses, 0);
        if (process.platform === "win32") {
          assert.equal(retained.nativeJobReceipt?.resumeSucceeded, true); assert.equal(retained.nativeJobReceipt?.cleanup.activeProcessesAfterCleanup, 0);
          runtimeProofs.push({ control: "windows_native_timeout_fixture_budget", priorDeadlineMs: 100, deadlineMs,
            reason: "allow managed-helper startup while still proving an actually resumed root times out", originalReason: retained.reason,
            nativeJobReceipt: retained.nativeJobReceipt, automaticRetries: 0 });
        }
        return true;
      });
      assert.equal(children.size, 0); assert.ok(existsSync(path.join(directory, "public-timeout.stdout.log")));
      assert.ok(existsSync(path.join(directory, "public-timeout.stderr.log")));
    });
    await control("abort stops an actually started owned process", async () => {
      const controller = new AbortController(), pending = run("abort", ["-e", "process.stdout.write('ready');setInterval(()=>{},1000)"], controller.signal);
      const child = [...children][0]; assert.ok(child?.stdout);
      const rejected = assert.rejects(pending, /aborted or exceeded its bound/u);
      await new Promise<void>((done, reject) => {
        const timer = setTimeout(() => reject(Error("Owned control child did not become ready.")), 5_000);
        child.stdout!.once("data", () => { clearTimeout(timer); done(); });
        child.once("error", () => { clearTimeout(timer); reject(Error("Owned control child failed before readiness.")); });
      });
      controller.abort(Error("Owned control abort")); await rejected;
      assert.equal(children.size, 0); assert.equal(readFileSync(path.join(directory, "public-abort.stdout.log"), "utf8"), "ready");
    });
    await control("pre-aborted admission starts no child and writes no logs", async () => {
      const controller = new AbortController(); controller.abort(Error("Pre-aborted control"));
      const before = readdirSync(directory).sort();
      await assert.rejects(run("pre-aborted", ["-e", "throw Error('must not execute')"], controller.signal), /Pre-aborted control/u);
      assert.equal(children.size, 0); assert.deepEqual(readdirSync(directory).sort(), before);
    });
    const verifyActualReadiness = async (ownerApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "verifyOwnedProcessReadiness">) => {
      await control("process readiness proves actual live-tree cancellation and preserves identities and exclusive evidence", async () => {
        const result = await ownerApi.verifyOwnedProcessReadiness({ sourceDirectory: directory, context, signal: new AbortController().signal });
        assert.equal(result.status, "PASS"); assert.equal(result.scope, "self-owned-live-tree-cancellation");
        if (process.platform === "linux") assert.equal(result.rootIdentity.ppid, process.pid);
        else assert.ok(Number.isSafeInteger(result.rootIdentity.ppid) && result.rootIdentity.ppid > 0);
        assert.equal(result.descendantIdentity.ppid, result.rootIdentity.pid);
        assert.equal(result.cleanup.status, "PASS"); assert.equal(result.cleanup.processTreeVerified, true); assert.equal(result.cleanup.liveProcesses, 0);
        assert.ok(result.durationMs > 0 && result.limitations.length > 0);
        assert.equal(result.cleanupQualification.status, "PASS");
        assert.equal(result.cleanupQualification.rootExitTreeSupported, process.platform === "linux" || process.platform === "win32");
        assert.equal(result.cleanupQualification.fullEProcessCleanupQualified, process.platform === "linux" || process.platform === "win32");
        runtimeProofs.push({ ...result, control: "preallocation_readiness" });
        assert.equal(JSON.parse(readFileSync(path.join(directory, "process-readiness.json"), "utf8")).status, "PASS");
        const original = readFileSync(path.join(directory, "public-process-readiness.stdout.log"));
        await assert.rejects(ownerApi.verifyOwnedProcessReadiness({ sourceDirectory: directory, context, signal: new AbortController().signal }), /did not start its child/u);
        assert.deepEqual(readFileSync(path.join(directory, "public-process-readiness.stdout.log")), original);
      });
      await control("pre-aborted readiness starts no probe and writes no evidence", async () => {
        const controller = new AbortController(); controller.abort(Error("Pre-aborted readiness control"));
        const before = readdirSync(directory).sort();
        await assert.rejects(ownerApi.verifyOwnedProcessReadiness({ sourceDirectory: directory, context, signal: controller.signal }), /Pre-aborted readiness control/u);
        assert.deepEqual(readdirSync(directory).sort(), before);
      });
    };
    await verifyActualReadiness(api);
    if (process.platform === "win32") {
      const nativeFile = "scripts/lib/windows-owned-process.mts", nativeText = readSource(nativeFile);
      const nativeTree = ts.createSourceFile(nativeFile, nativeText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const nativeSpawn = nativeTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "spawnWindowsOwnedProcess");
      assert.ok(nativeSpawn?.body);
      const cleanupNodes = nativeSpawn.body.statements.filter((node): node is ts.VariableStatement => ts.isVariableStatement(node)
        && node.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === "verifiedCleanup"));
      assert.equal(cleanupNodes.length, 1, "Use the actual unique native receipt qualifier.");
      const cleanupSource = cleanupNodes[0]!.getText(nativeTree);
      const cleanupCode = ts.transpileModule(cleanupSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      type Identity = import("./lib/windows-owned-process.mts").WindowsJobIdentity;
      type Receipt = import("./lib/windows-owned-process.mts").WindowsJobReceipt;
      const qualify = (identity: Identity, result: Receipt) => new Function("assert", "readIdentity", "readReceipt", "child", cleanupCode + ";return verifiedCleanup;")(
        assert, () => identity, () => result, { pid: identity.helperPid, exitCode: 0 }) as () => { status: string; liveProcesses: number };
      const actualZeroIdentity = JSON.parse(readFileSync(path.join(directory, "public-success.native-identity.json"), "utf8")) as Identity;
      const actualZero = JSON.parse(readFileSync(path.join(directory, "public-success.native-result.json"), "utf8")) as Receipt;
      const actualHeldIdentity = JSON.parse(readFileSync(path.join(directory, "public-timeout.native-identity.json"), "utf8")) as Identity;
      const actualHeld = JSON.parse(readFileSync(path.join(directory, "public-timeout.native-result.json"), "utf8")) as Receipt;
      await control("actual native cleanup qualifier accepts zero-retained and actually terminated retained-root receipts", async () => {
        assert.equal(actualZero.cleanup.retainedOwnedProcessHandles, 0); assert.deepEqual(actualZero.cleanup.retainedOwnedProcessIds, []);
        assert.equal(actualHeld.cleanup.retainedOwnedProcessHandles, 1); assert.deepEqual(actualHeld.cleanup.retainedOwnedProcessIds, [actualHeldIdentity.rootPid]);
        assert.equal(qualify(actualZeroIdentity, actualZero)().status, "PASS");
        assert.equal(qualify(actualHeldIdentity, actualHeld)().liveProcesses, 0);
      });
      const rejected: string[] = [];
      const rejectReceipt = async (name: string, mutate: (value: Receipt) => void) => {
        await control("actual native cleanup qualifier rejects " + name, async () => {
          const changed = structuredClone(actualHeld); mutate(changed);
          assert.throws(qualify(actualHeldIdentity, changed), /termination of every retained owned process handle/u);
          assert.deepEqual(actualHeld, JSON.parse(readFileSync(path.join(directory, "public-timeout.native-result.json"), "utf8")));
          rejected.push(name);
        });
      };
      const member = (value: Receipt) => {
        const found = value.residualMemberEvidence?.members?.find(row => row.pid === actualHeldIdentity.rootPid);
        assert.ok(found); return found;
      };
      await rejectReceipt("legacy missing retained-handle evidence", value => {
        delete value.cleanup.retainedOwnedHandlesSignaled; delete value.cleanup.retainedOwnedProcessHandles; delete value.cleanup.retainedOwnedProcessIds;
      });
      await rejectReceipt("missing retained termination flag", value => { delete value.cleanup.retainedOwnedHandlesSignaled; });
      await rejectReceipt("false retained termination flag", value => { value.cleanup.retainedOwnedHandlesSignaled = false; });
      await rejectReceipt("retained count and ID mismatch", value => { value.cleanup.retainedOwnedProcessHandles = 2; });
      await rejectReceipt("foreign retained PID", value => { value.cleanup.retainedOwnedProcessIds = [actualHeldIdentity.rootPid === 1 ? 2 : 1]; });
      await rejectReceipt("duplicate retained PIDs", value => { value.cleanup.retainedOwnedProcessHandles = 2; value.cleanup.retainedOwnedProcessIds = [actualHeldIdentity.rootPid, actualHeldIdentity.rootPid]; });
      await rejectReceipt("zero retained PID", value => { value.cleanup.retainedOwnedProcessIds = [0]; });
      await rejectReceipt("out-of-DWORD retained PID", value => { value.cleanup.retainedOwnedProcessIds = [0x1_0000_0000]; });
      await rejectReceipt("fractional retained PID", value => { value.cleanup.retainedOwnedProcessIds = [actualHeldIdentity.rootPid + 0.5]; });
      await rejectReceipt("missing retained member identity", value => { delete value.residualMemberEvidence; });
      await rejectReceipt("foreign retained member identity", value => { member(value).pid = actualHeldIdentity.rootPid === 1 ? 2 : 1; });
      await rejectReceipt("duplicate retained member identity", value => { value.residualMemberEvidence!.members!.push(structuredClone(member(value))); });
      await rejectReceipt("unqualified exact-Job membership", value => { member(value).inExactJob = false; });
      await rejectReceipt("unknown retained member birth", value => { member(value).creationTimeFileTime = "UNKNOWN"; });
      await rejectReceipt("known retained member not signaled", value => { member(value).signaledAfterCleanup = false; });
      await rejectReceipt("known retained member handle not closed", value => { member(value).processHandleClosed = false; });
      await rejectReceipt("omitted known retained member with a false terminal state", value => {
        value.cleanup.retainedOwnedProcessHandles = 0; value.cleanup.retainedOwnedProcessIds = []; member(value).signaledAfterCleanup = false;
      });
      runtimeProofs.push({ control: "actual_native_retained_handle_receipt_qualification", sourceOwnerSha256: sha256(nativeText),
        declarationSha256: sha256(cleanupSource), actualSourceProjection: true,
        originalPositiveInputs: ["public-success.native-result.json", "public-timeout.native-result.json"],
        positiveRetainedCounts: [0, 1], rejected, additionalNativeProcessesExecuted: 0 });
    }
    await control("spawn failure rejects and drains its owned child registration", async () => {
      const pending = run("spawn-error", ["-e", "throw Error('must not execute')"], new AbortController().signal, 10_000, path.join(directory, "absent-owned-cwd"));
      const child = [...children][0]; assert.ok(child);
      const closed = new Promise<void>(done => child.once("close", () => done()));
      await assert.rejects(pending, (error: unknown) => {
        assert.ok(error instanceof Error && /process failed/u.test(error.message));
        assert.deepEqual(error.cause, { code: "ENOENT" }); return true;
      }); await closed; assert.equal(children.size, 0);
    });
    await control("spawn failure remains primary when its close callback cannot write logs", async () => {
      const failure = new Error("Secondary spawn log-write failure");
      const failingWrite: typeof writeFileSync = () => { throw failure; };
      const pending = buildApi(failingWrite).run({ sourceDirectory: path.join(directory, "absent-owned-cwd"), context, children,
        signal: new AbortController().signal }, ["-e", "throw Error('must not execute')"], { ...environment }, "spawn-write-failure", 10_000);
      const child = [...children][0]; assert.ok(child);
      const closed = new Promise<void>(done => child.once("close", () => done()));
      await assert.rejects(pending, /process failed/u); await closed; assert.equal(children.size, 0);
      assert.equal(existsSync(path.join(directory, "public-spawn-write-failure.stdout.log")), false);
    });
    if (process.platform === "win32") {
      runtimeProofs.push({ control: "windows_native_independent_closure_acceptance", ...await verifyWindowsClosureAcceptanceControls() });
      const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; } };
      type NativeIdentity = import("./lib/windows-owned-process.mts").WindowsJobIdentity;
      type NativeReceipt = import("./lib/windows-owned-process.mts").WindowsJobReceipt;
      type Tree = { root: { pid: number; ppid: number }; middle: { pid: number; ppid: number }; leaf: { pid: number; ppid: number } };
      type NativeChild = ChildProcess & { verificationWindowsIdentity?(): NativeIdentity | null; verificationWindowsReceipt?(): NativeReceipt | null };
      const ready = (child: ChildProcess, prefix = "tree:") => new Promise<string>((done, reject) => {
        let output = "";
        const finish = (error?: Error, line?: string) => { clearTimeout(timer); child.stdout!.off("data", data); child.off("error", failed); child.off("close", closed); if (error) reject(error); else done(line!); };
        const data = (value: Buffer) => { output += String(value); const line = output.split("\n").find(row => row.startsWith(prefix)); if (line !== undefined) finish(undefined, line.slice(prefix.length)); };
        const failed = () => finish(Error("Owned Windows fixture failed before readiness."));
        const closed = () => finish(Error("Owned Windows fixture closed before readiness."));
        const timer = setTimeout(() => finish(Error("Owned Windows fixture readiness exceeded its bound.")), 8_000);
        child.stdout!.on("data", data); child.once("error", failed); child.once("close", closed);
      });
      const absent = async (pids: readonly number[]) => {
        const deadline = performance.now() + 8_000;
        while (pids.some(alive) && performance.now() < deadline) await new Promise<void>(done => setTimeout(done, 20));
        assert.ok(pids.every(pid => !alive(pid)), "Native ownership left a known contained process live.");
      };
      const native = (value: { nativeJobIdentity?: NativeIdentity | null; nativeJobReceipt?: NativeReceipt | null;
        cleanup: { status: string; method: string; processTreeVerified: boolean; liveProcesses: number | null } }, reason: string, allowUnresumed = false) => {
        const identity = value.nativeJobIdentity, receipt = value.nativeJobReceipt;
        assert.ok(identity && receipt); assert.equal(identity.ownerJobAssignedBeforeResume, true); assert.equal(identity.effectiveLimitFlags, 0x2000);
        assert.equal((identity as NativeIdentity & { jobHandleNonInheritable: boolean }).jobHandleNonInheritable, true);
        assert.equal(receipt.jobToken, identity.jobToken); assert.equal(receipt.helperPid, identity.helperPid); assert.equal(receipt.rootPid, identity.rootPid);
        assert.equal(identity.rootPpid, identity.helperPid); assert.equal(receipt.status, "PASS"); assert.equal(receipt.reason, reason);
        if (!allowUnresumed) assert.equal(receipt.resumeSucceeded, true);
        assert.equal(receipt.nativeFailure, null); assert.equal(receipt.cleanup.rootHandleExited, true); assert.equal(receipt.cleanup.jobHandleClosed, true);
        assert.equal(receipt.cleanup.processTreeVerified, true); assert.equal(receipt.cleanup.activeProcessesAfterCleanup, 0);
        assert.deepEqual(receipt.cleanup.activeProcessIdsAfterCleanup, []); assert.equal(value.cleanup.status, "PASS");
        assert.equal(value.cleanup.method, "windows-private-job"); assert.equal(value.cleanup.processTreeVerified, true); assert.equal(value.cleanup.liveProcesses, 0);
        return { identity, receipt };
      };
      const tree = (onReady = "") => {
        const expiresAt = Date.now() + 25_000, expiry = `setTimeout(()=>process.exit(0),Math.max(1,${expiresAt}-Date.now()));`;
        const leaf = expiry + "process.stdout.write(JSON.stringify({pid:process.pid,ppid:process.ppid})+'\\n');setInterval(()=>{},1000);";
        const middle = expiry + `const {spawn}=require('node:child_process');const leaf=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{detached:true,windowsHide:true,stdio:['ignore','pipe','ignore']});leaf.stdout.once('data',data=>{process.stdout.write(JSON.stringify({middle:{pid:process.pid,ppid:process.ppid},leaf:JSON.parse(String(data))})+'\\n');leaf.stdout.destroy();leaf.unref();});setInterval(()=>{},1000);`;
        return expiry + `const {spawn}=require('node:child_process');const middle=spawn(process.execPath,['-e',${JSON.stringify(middle)}],{detached:true,windowsHide:true,stdio:['ignore','pipe','ignore']});middle.stdout.once('data',data=>{process.stdout.write('tree:'+JSON.stringify({root:{pid:process.pid,ppid:process.ppid},...JSON.parse(String(data))})+'\\n',()=>{${onReady}});middle.stdout.destroy();middle.unref();});setInterval(()=>{},1000);`;
      };
      const treeProof = async (identities: Tree, identity: NativeIdentity) => {
        assert.equal(identities.root.pid, identity.rootPid); assert.equal(identities.root.ppid, identity.helperPid);
        assert.equal(identities.middle.ppid, identities.root.pid); assert.equal(identities.leaf.ppid, identities.middle.pid);
        await absent([identities.root.pid, identities.middle.pid, identities.leaf.pid]);
      };
      const failedResult = async (outcome: Promise<unknown>, reason: string) => {
        const error = await outcome; assert.ok(error instanceof Error && /aborted or exceeded its bound/u.test(error.message));
        const retained = (error as Error & { childResult: { reason: string; code: number | null; signal: NodeJS.Signals | null;
          nativeJobIdentity?: NativeIdentity | null; nativeJobReceipt?: NativeReceipt | null;
          cleanup: { status: string; method: string; processTreeVerified: boolean; liveProcesses: number | null } } }).childResult;
        assert.equal(retained.reason, reason); const proof = native(retained, reason); assert.equal(retained.code, proof.receipt.rootExitCode);
        assert.equal(retained.signal, null); return { retained, ...proof };
      };
      for (const exitCode of [0, 9]) await control(`Windows native exited root ${exitCode} drains detached child and grandchild`, async () => {
        const result = await run(`windows-native-exit-${exitCode}`, ["-e", tree(`process.exit(${exitCode});`)]);
        const identities = JSON.parse(result.stdout.trim().slice("tree:".length)) as Tree, proof = native(result, "completed");
        assert.equal(result.code, exitCode); assert.deepEqual(result.rawExit, { code: exitCode, signal: null }); assert.equal(proof.receipt.rootExitCode, exitCode);
        assert.equal(proof.receipt.cleanup.rootExitedBeforeCleanup, true); assert.ok(proof.receipt.cleanup.totalProcesses >= 3);
        assert.ok(proof.receipt.cleanup.activeProcessesBeforeCleanup >= 2); assert.equal(proof.receipt.cleanup.forcedTermination, true);
        assert.equal(proof.receipt.cleanup.retainedOwnedHandlesSignaled, true);
        for (const pid of [identities.middle.pid, identities.leaf.pid]) {
          assert.ok(proof.receipt.cleanup.retainedOwnedProcessIds?.includes(pid), "Retain the actual live descendant handle through Job termination.");
          const members = proof.receipt.residualMemberEvidence?.members?.filter(member => member.pid === pid);
          assert.equal(members?.length, 1); assert.equal(members![0]!.inExactJob, true);
          assert.match(members![0]!.creationTimeFileTime!, /^[1-9][0-9]*$/u);
          assert.equal(members![0]!.signaledAfterCleanup, true); assert.equal(members![0]!.processHandleClosed, true);
        }
        await treeProof(identities, proof.identity); assert.equal(children.size, 0);
        runtimeProofs.push({ control: "windows_native_exited_root", exitCode, identities, result });
      });
      await control("Windows native abnormal root crash preserves DWORD exit and cleans detached descendants", async () => {
        const result = await run("windows-native-crash", ["-e", tree("process.abort();")]);
        const identities = JSON.parse(result.stdout.trim().slice("tree:".length)) as Tree, proof = native(result, "completed");
        assert.ok(result.code > 0 && result.code !== 9); assert.equal(result.rawExit.code, result.code); assert.equal(result.rawExit.signal, null);
        assert.equal(proof.receipt.rootExitCode, result.code); assert.match(result.stderr, /abort|native stack|assertion/iu);
        await treeProof(identities, proof.identity); runtimeProofs.push({ control: "windows_native_abnormal_crash", identities, result });
      });
      for (const reason of ["timeout", "cancelled"] as const) await control(`Windows native ${reason} drains an actual detached three-process tree`, async () => {
        const controller = new AbortController(), pending = run(`windows-native-${reason}`, ["-e", tree()], controller.signal, reason === "timeout" ? 3_000 : 15_000);
        const child = [...children][0]; assert.ok(child); const outcome = pending.then(value => value, (error: unknown) => error);
        const identities = JSON.parse(await ready(child)) as Tree;
        assert.ok([identities.root.pid, identities.middle.pid, identities.leaf.pid].every(alive));
        if (reason === "cancelled") controller.abort(Error("Controlled native job cancellation"));
        const proof = await failedResult(outcome, reason); await treeProof(identities, proof.identity); assert.equal(children.size, 0);
        runtimeProofs.push({ control: "windows_native_" + reason, identities, result: proof.retained });
      });
      await control("Windows native immediate cancellation preserves setup-race evidence and zero active members", async () => {
        const controller = new AbortController(), pending = run("windows-native-early-cancel", ["-e", tree()], controller.signal, 15_000);
        const outcome = pending.then(value => value, (error: unknown) => error); controller.abort(Error("Controlled cancellation immediately after native launch"));
        const error = await outcome; assert.ok(error instanceof Error && /aborted or exceeded its bound/u.test(error.message));
        const retained = (error as Error & { childResult: { reason: string; code: number | null; signal: NodeJS.Signals | null;
          nativeJobIdentity: NativeIdentity | null; nativeJobReceipt: NativeReceipt | null;
          cleanup: { status: string; method: string; processTreeVerified: boolean; observedProcesses: number; liveProcesses: number } } }).childResult;
        assert.equal(retained.reason, "cancelled"); assert.equal(retained.cleanup.status, "PASS"); assert.equal(retained.cleanup.liveProcesses, 0);
        if (retained.nativeJobIdentity) native(retained, "cancelled", true);
        else {
          const receipt = retained.nativeJobReceipt; assert.ok(receipt); assert.equal(receipt.status, "PASS"); assert.equal(receipt.reason, "cancelled");
          assert.equal(receipt.nativeFailure, null); assert.equal(receipt.rootPid, null); assert.equal(receipt.rootExitCode, null); assert.equal(receipt.resumeSucceeded, false);
          assert.equal(receipt.cleanup.activeProcessesAfterCleanup, 0); assert.deepEqual(receipt.cleanup.activeProcessIdsAfterCleanup, []);
          assert.equal(receipt.cleanup.totalProcesses, 0); assert.equal(retained.code, null); assert.equal(retained.signal, null);
          assert.equal(retained.cleanup.method, "windows-private-job-no-root"); assert.equal(retained.cleanup.processTreeVerified, false); assert.equal(retained.cleanup.observedProcesses, 0);
        }
        assert.equal(children.size, 0); runtimeProofs.push({ control: "windows_native_early_cancel", result: retained });
      });
      await control("Windows native setup failure preserves original spawn error and leaves no contained root", async () => {
        const before = [...children];
        const pending = run("windows-native-setup-failure", ["-e", "throw Error('must not execute')"], new AbortController().signal, 10_000, path.join(directory, "missing-native-cwd"));
        const outcome = pending.then(value => value, (error: unknown) => error), launched = [...children].find(child => !before.includes(child));
        const error = await outcome; assert.ok(error instanceof Error); assert.match(error.message, /process failed|cleanup failed/u);
        const retained = (error as Error & { childResult: { code: number | null; cleanup: { status: string }; nativeJobIdentity: NativeIdentity | null; nativeJobReceipt: NativeReceipt | null } }).childResult;
        assert.ok(retained); assert.deepEqual(error.cause, { code: "ENOENT" }); assert.equal(retained.code, null); assert.equal(retained.nativeJobIdentity, null); assert.equal(retained.nativeJobReceipt, null);
        assert.equal(retained.cleanup.status, "PASS"); if (launched) assert.equal(launched.pid, undefined);
        assert.equal(children.size, 0); runtimeProofs.push({ control: "windows_native_setup_failure", result: retained, allocatedRoot: false });
      });
      await control("Windows native owner death closes the control pipe and drains its private job", async () => {
        const runDirectory = realpathSync(mkdtempSync(path.join(directory, "owner-death-"))), ownerSource = new URL("./lib/isolated-public-verification.mts", import.meta.url).href;
        const ownerCode = `const {runOwnedVerificationChild}=await import(${JSON.stringify(ownerSource)});const children=new Set();const env=${JSON.stringify(environment)};const pending=runOwnedVerificationChild({sourceDirectory:${JSON.stringify(directory)},context:{runDirectory:${JSON.stringify(runDirectory)},sanitize:value=>value,cleanEnvironment:()=>({...env})},children,signal:new AbortController().signal},['-e',${JSON.stringify(tree())}],env,'owner-death',20000);pending.catch(()=>{});const child=[...children][0];child.stdout.on('data',value=>process.stdout.write(value));setTimeout(()=>process.exit(17),22000);`;
        const owner = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", ownerCode], { cwd: root, env: { ...environment }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const closed = new Promise<void>(done => owner.once("close", () => done()));
        try {
          const identities = JSON.parse(await ready(owner)) as Tree;
          const identity = JSON.parse(readFileSync(path.join(runDirectory, "public-owner-death.native-identity.json"), "utf8")) as NativeIdentity;
          assert.ok(owner.pid && alive(owner.pid)); assert.ok(alive(identity.helperPid)); assert.equal(identity.ownerJobAssignedBeforeResume, true);
          assert.equal((identity as NativeIdentity & { jobHandleNonInheritable: boolean }).jobHandleNonInheritable, true);
          assert.equal(owner.kill(), true); await closed;
          const receiptPath = path.join(runDirectory, "public-owner-death.native-result.json"), deadline = performance.now() + 12_000;
          while (!existsSync(receiptPath) && alive(identity.helperPid) && performance.now() < deadline) await new Promise<void>(done => setTimeout(done, 20));
          let receipt: NativeReceipt | null = null;
          if (existsSync(receiptPath)) { try { receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as NativeReceipt; } catch { /* Abrupt helper death cannot qualify a partial receipt. Original bytes are archived. */ } }
          if (receipt) native({ nativeJobIdentity: identity, nativeJobReceipt: receipt,
            cleanup: { status: receipt.cleanup.status, method: receipt.cleanup.method, processTreeVerified: receipt.cleanup.processTreeVerified, liveProcesses: receipt.cleanup.activeProcessesAfterCleanup } }, "owner_lost");
          else {
            assert.equal(alive(identity.helperPid), false, "Missing receipt cannot substitute for a still-live native owner.");
            assert.equal(identity.effectiveLimitFlags, 0x2000); assert.equal(identity.rootPpid, identity.helperPid);
          }
          await treeProof(identities, identity); await absent([identity.helperPid]);
          runtimeProofs.push({ control: "windows_native_owner_death", ownerPid: owner.pid, identities, nativeJobIdentity: identity, nativeJobReceipt: receipt,
            proofBoundary: receipt ? "native_eof_zero_membership_receipt" : "kernel_last_handle_close_known_contained_process_absence",
            zeroMembershipReceiptAvailable: receipt !== null, knownContainedProcessesAbsent: true });
        } finally { if (owner.exitCode === null && owner.signalCode === null) { owner.kill(); await closed; } }
      });
      await control("Windows native last job handle close contains descendants and missing receipt stays failure", async () => {
        const pending = run("windows-native-last-close", ["-e", tree()], new AbortController().signal, 15_000);
        const helper = [...children][0] as NativeChild; assert.ok(helper); const outcome = pending.then(value => value, (error: unknown) => error);
        const identities = JSON.parse(await ready(helper)) as Tree, identity = helper.verificationWindowsIdentity?.(); assert.ok(identity);
        assert.equal(identity.ownerJobAssignedBeforeResume, true); assert.equal(identity.effectiveLimitFlags, 0x2000);
        assert.equal((identity as NativeIdentity & { jobHandleNonInheritable: boolean }).jobHandleNonInheritable, true);
        assert.equal(helper.kill(), true); const error = await outcome; assert.ok(error instanceof Error && /cleanup failed/u.test(error.message));
        const retained = (error as Error & { childResult: { code: number | null; signal: NodeJS.Signals | null;
          helperExit: { code: number | null; signal: NodeJS.Signals | null }; nativeJobReceipt: NativeReceipt | null; cleanup: { status: string };
          cleanupFailure: { stage: string; name: string; code: string | null; exitCode: number | null; nativeReceipt: string } } }).childResult;
        assert.equal(retained.nativeJobReceipt, null); assert.equal(retained.cleanup.status, "FAIL");
        assert.deepEqual(retained.helperExit, { code: helper.exitCode, signal: helper.signalCode });
        assert.equal(retained.code, null); assert.equal(retained.signal, null); await treeProof(identities, identity);
        assert.deepEqual(retained.cleanupFailure, { stage: "owned-child-cleanup", name: "AssertionError", code: "ERR_ASSERTION",
          exitCode: null, nativeReceipt: "unavailable" });
        assert.ok(error.cause instanceof assert.AssertionError);
        assert.equal(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable, false);
        assert.equal(JSON.stringify(error).includes("Native job cleanup evidence is missing."), false);
        await absent([identity.helperPid]); children.delete(helper);
        runtimeProofs.push({ control: "windows_native_last_handle_close", identities, nativeJobIdentity: identity, result: retained,
          knownContainedProcessesAbsent: true, zeroMembershipReceiptAvailable: false, expectedMissingReceiptRejected: true });
      });
      await control("Windows native job cleanup preserves an unrelated live retained child", async () => {
        const sentinel = spawn(process.execPath, ["-e", "process.stdout.write('sentinel\\n');setTimeout(()=>process.exit(0),20000);setInterval(()=>{},1000)"], { env: { ...environment }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const closed = new Promise<void>(done => sentinel.once("close", () => done()));
        try {
          await ready(sentinel, "sentinel"); assert.ok(sentinel.pid && alive(sentinel.pid));
          const result = await run("windows-native-sentinel-isolation", ["-e", tree("process.exit(0);")]), proof = native(result, "completed");
          await treeProof(JSON.parse(result.stdout.trim().slice("tree:".length)) as Tree, proof.identity);
          assert.equal(alive(sentinel.pid), true); runtimeProofs.push({ control: "windows_native_unrelated_sentinel", sentinelPid: sentinel.pid, unrelatedProcessPreserved: true, result });
        } finally { if (sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill(); await closed; }
      });
      await control("Windows native concurrent jobs retain independent handles and cancellation boundaries", async () => {
        const first = new AbortController(), second = new AbortController();
        const pendingA = run("windows-native-concurrent-a", ["-e", tree()], first.signal, 15_000), helperA = [...children][0]; assert.ok(helperA);
        const outcomeA = pendingA.then(value => value, (error: unknown) => error), readyA = ready(helperA);
        const pendingB = run("windows-native-concurrent-b", ["-e", tree()], second.signal, 15_000), helperB = [...children].find(child => child !== helperA); assert.ok(helperB);
        const outcomeB = pendingB.then(value => value, (error: unknown) => error);
        const [identitiesA, identitiesB] = await Promise.all([readyA, ready(helperB)]).then(values => values.map(value => JSON.parse(value) as Tree));
        assert.ok(identitiesA && identitiesB); first.abort(Error("Cancel only first private job"));
        const proofA = await failedResult(outcomeA, "cancelled"); await treeProof(identitiesA, proofA.identity);
        assert.ok([identitiesB.root.pid, identitiesB.middle.pid, identitiesB.leaf.pid].every(alive));
        second.abort(Error("Final cleanup second private job")); const proofB = await failedResult(outcomeB, "cancelled"); await treeProof(identitiesB, proofB.identity);
        assert.notEqual(proofA.identity.jobToken, proofB.identity.jobToken); assert.notEqual(proofA.identity.helperPid, proofB.identity.helperPid); assert.equal(children.size, 0);
        runtimeProofs.push({ control: "windows_native_concurrent_jobs", independentlyCancelled: true, first: proofA.retained, second: proofB.retained });
      });
      await control("Windows native immediate root exit retains assignment-before-resume and zero active job evidence", async () => {
        const result = await run("windows-native-fast-exit", ["-e", "process.exit(0)"]), proof = native(result, "completed");
        assert.deepEqual(result.rawExit, { code: 0, signal: null });
        assert.deepEqual(proof.identity.jobBeforeResume, { totalProcesses: 1, activeProcesses: 1, processIds: [proof.identity.rootPid] });
        assert.deepEqual(proof.receipt.jobBeforeResume, proof.identity.jobBeforeResume);
        assert.ok(proof.receipt.cleanup.totalProcesses >= proof.identity.jobBeforeResume.totalProcesses);
        assert.equal(proof.receipt.cleanup.activeProcessesAfterCleanup, 0); assert.equal(proof.receipt.cleanup.rootExitedBeforeCleanup, true);
        assert.equal(children.size, 0); runtimeProofs.push({ control: "windows_native_fast_exit_zero_job", result });
      });
      const nativeEvidence: Array<{ file: string; sha256: string; rawJson: string; validJson: boolean }> = [];
      const collect = (at: string) => { for (const name of readdirSync(at)) { const file = path.join(at, name), stat = lstatSync(file);
        assert.equal(stat.isSymbolicLink(), false); if (stat.isDirectory()) collect(file);
        else if (/\.native-(?:identity|result)\.json$/u.test(name)) { const rawJson = readFileSync(file, "utf8"); let validJson = true;
          try { JSON.parse(rawJson); } catch { validJson = false; }
          nativeEvidence.push({ file: path.relative(directory, file).replaceAll("\\", "/"), sha256: sha256(rawJson), rawJson, validJson }); }
      } };
      collect(directory); assert.ok(nativeEvidence.length >= 24); runtimeProofs.push({ control: "windows_native_original_evidence", files: nativeEvidence });
    }
    if (process.platform === "linux") {
      await control("Linux immediate zero-exit child retains an inspectable root identity and leaves no live process", async () => {
        const result = await run("linux-fast-exit", ["-e", "process.exit(0)"]);
        assert.equal(result.code, 0); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
        assert.equal(result.cleanup.processTreeVerified, true); assert.equal(result.cleanup.observedProcesses, 1);
        assert.equal(result.cleanup.liveProcesses, 0); assert.equal(result.cleanup.residualProcessesAfterExit, 0); assert.equal(children.size, 0);
      });
      const processAlive = (pid: number) => {
        try { const raw = readFileSync(`/proc/${pid}/stat`, "utf8"), state = raw.slice(raw.lastIndexOf(")") + 2).split(" ")[0]; return !["Z", "X", "x"].includes(state!); }
        catch (error) { if (["ENOENT", "ESRCH"].includes(String((error as NodeJS.ErrnoException).code))) return false; throw error; }
      };
      const readyLine = (child: ChildProcess, prefix: string) => new Promise<string>((done, reject) => {
        let output = "";
        const timer = setTimeout(() => { child.stdout!.off("data", data); reject(Error("Owned Linux tree readiness exceeded its bound.")); }, 8_000);
        const data = (value: Buffer) => {
          output += String(value);
          const line = output.split("\n").find(line => line.startsWith(prefix));
          if (line) { clearTimeout(timer); child.stdout!.off("data", data); done(line.slice(prefix.length)); }
        };
        child.stdout!.on("data", data);
        child.once("error", () => { clearTimeout(timer); child.stdout!.off("data", data); reject(Error("Owned Linux tree failed before readiness.")); });
      });
      const leaf = "process.on('SIGTERM',()=>{});process.stdout.write(String(process.pid)+'\\n');setInterval(()=>{},1000);";
      const middle = `const {spawn}=require('node:child_process');process.on('SIGTERM',()=>{});const leaf=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{detached:true,stdio:['ignore','pipe','pipe']});leaf.stdout.once('data',data=>process.stdout.write(JSON.stringify([process.pid,Number(String(data).trim())])+'\\n'));setInterval(()=>{},1000);`;
      const tree = `const {spawn}=require('node:child_process');process.on('SIGTERM',()=>{});const middle=spawn(process.execPath,['-e',${JSON.stringify(middle)}],{detached:true,stdio:['ignore','pipe','pipe']});middle.stdout.once('data',data=>process.stdout.write('tree-ready:'+JSON.stringify([process.pid,...JSON.parse(String(data))])+'\\n'));setInterval(()=>{},1000);`;
      for (const kind of ["timeout", "cancelled"] as const) await control(`Linux ${kind} kills TERM-ignoring detached descendants and preserves an unrelated live child`, async () => {
        let sentinel: ChildProcess | undefined;
        try {
          const controller = new AbortController(), pending = run(`linux-tree-${kind}`, ["-e", tree], controller.signal, kind === "timeout" ? 3_000 : 15_000);
          const child = [...children][0]; assert.ok(child);
          const outcome = pending.then(() => assert.fail("A terminated owned tree must not PASS."), (error: unknown) => error);
          const pids = JSON.parse(await readyLine(child, "tree-ready:")) as number[];
          assert.equal(pids.length, 3); assert.ok(pids.every(pid => Number.isSafeInteger(pid) && pid > 1 && processAlive(pid)));
          sentinel = spawn(process.execPath, ["-e", "process.stdout.write('sentinel\\n');setInterval(()=>{},1000)"], { env: { ...environment }, stdio: ["ignore", "pipe", "pipe"] });
          await readyLine(sentinel, "sentinel"); assert.ok(sentinel.pid && processAlive(sentinel.pid));
          const identity = (pid: number) => { const raw = readFileSync(`/proc/${pid}/stat`, "utf8"); return raw.slice(raw.lastIndexOf(")") + 2).trim().split(/\s+/u); };
          assert.equal(lstatSync(`/proc/${sentinel.pid}`).uid, process.getuid!());
          assert.ok(BigInt(identity(sentinel.pid)[19]!) >= BigInt(identity(pids[0]!)[19]!), "Unrelated sentinel must reach the same-user newer-process discovery filter.");
          if (kind === "cancelled") controller.abort(Error("Controlled Linux tree cancellation"));
          const error = await outcome;
          assert.ok(error instanceof Error && /aborted or exceeded its bound/u.test(error.message));
          const retained = (error as Error & { childResult: { reason: string; cleanup: { status: string; forcedTermination: boolean; processTreeVerified: boolean; observedProcesses: number; liveProcesses: number } } }).childResult;
          assert.equal(retained.reason, kind); assert.equal(retained.cleanup.status, "PASS");
          assert.equal(retained.cleanup.forcedTermination, true); assert.equal(retained.cleanup.processTreeVerified, true);
          assert.ok(retained.cleanup.observedProcesses >= 3); assert.equal(retained.cleanup.liveProcesses, 0);
          assert.ok(pids.every(pid => !processAlive(pid))); assert.equal(children.size, 0);
          assert.ok(processAlive(sentinel.pid), "Owned cleanup must preserve an unrelated newly created live process.");
        } finally { if (sentinel) await api.stop(sentinel, environment); }
      });
      await control("Linux zero-exit parent still drains a detached orphan and reports the residual instead of hiding it", async () => {
        const orphan = `const {spawn}=require('node:child_process');const orphan=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{detached:true,stdio:['ignore','pipe','pipe']});orphan.stdout.once('data',data=>{process.stdout.write('orphan:'+String(data));orphan.stdout.destroy();orphan.stderr.destroy();orphan.unref();process.exit(0);});`;
        const result = await run("linux-orphan", ["-e", orphan]);
        const pid = Number(result.stdout.trim().replace(/^orphan:/u, "")); assert.ok(Number.isSafeInteger(pid) && pid > 1);
        assert.equal(result.code, 0); assert.equal(result.cleanup.status, "PASS"); assert.equal(result.cleanup.processTreeVerified, true);
        assert.equal(result.cleanup.forcedTermination, true); assert.ok(result.cleanup.residualProcessesAfterExit !== null && result.cleanup.residualProcessesAfterExit >= 1);
        assert.ok(result.cleanup.observedProcesses >= 2); assert.equal(result.cleanup.liveProcesses, 0);
        assert.equal(processAlive(pid), false); assert.equal(children.size, 0);
      });
    }
    }
  } finally {
    const stopped = await Promise.allSettled([...children].map(child => api.stop(child, environment)));
    if (process.platform === "win32" || options?.admissionOnly || existsSync(path.join(directory, "npm-timing-fixture-source"))) {
      const evidenceRoot = path.join(root, ".tmp-qa"); mkdirSync(evidenceRoot, { recursive: true }); assert.equal(realpathSync(evidenceRoot), evidenceRoot);
      const nativeEvidenceDirectory = realpathSync(mkdtempSync(path.join(evidenceRoot, "owned-process-controls-")));
      const evidence: Array<{ file: string; sha256: string; bytes: number }> = [];
      const archive = (at: string) => { for (const name of readdirSync(at)) { const file = path.join(at, name), stat = lstatSync(file);
        assert.equal(stat.isSymbolicLink(), false); if (stat.isDirectory()) archive(file);
        else { assert.ok(stat.isFile()); const relative = path.relative(directory, file); assert.ok(!relative.startsWith("..") && !path.isAbsolute(relative));
          const target = path.join(nativeEvidenceDirectory, relative); mkdirSync(path.dirname(target), { recursive: true });
          const bytes = readFileSync(file); writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
          evidence.push({ file: relative.replaceAll("\\", "/"), sha256: sha256(bytes), bytes: bytes.length }); }
      } };
      archive(directory); writeFileSync(path.join(nativeEvidenceDirectory, "evidence-index.json"), JSON.stringify({ schema: 1,
        originalNativeEvidenceRetained: true, finalCleanup: stopped.map(value => value.status), files: evidence }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      runtimeProofs.push({ control: process.platform === "win32" ? "windows_native_evidence_archive" : "owned_child_evidence_archive", directory: nativeEvidenceDirectory, files: evidence });
      console.error(JSON.stringify({ ownedNativeEvidenceDirectory: nativeEvidenceDirectory, retainedFiles: evidence.length }));
    }
    assert.equal(realpathSync(directory), directory);
    assert.ok(path.basename(directory).startsWith("venisia-owned-child-controls-") && path.dirname(directory) === realpathSync(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
    assert.ok(stopped.every(result => result.status === "fulfilled")); assert.equal(children.size, 0); assert.equal(existsSync(directory), false);
  }
  return runtimeProofs;
}

/** Execute the existing planner's actual parser controls without copying or relocating their assertions. */
function verifyRegisteredNodeEntryControls() {
  const ownerFile = "scripts/lib/isolated-public-verification.mts", ownerSource = readSource(ownerFile);
  const owner = ts.createSourceFile(ownerFile, ownerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = (name: string) => { const found = owner.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(found?.body); return found.getText(owner).replace(/^export /u, ""); };
  type Api = Pick<typeof import("./lib/isolated-public-verification.mts"), "localVerificationCommandSteps" | "registeredVerificationNodeEntries">;
  const actual = new Function("assert", "sourceIncluded", ts.transpileModule(["localVerificationCommandSteps", "registeredVerificationNodeEntries"].map(statement).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + ";return {localVerificationCommandSteps,registeredVerificationNodeEntries};")(assert, sourceIncluded) as Api;
  const verifierSource = readSource("scripts/verify-isolated-supabase.mts"), verifier = ts.createSourceFile("verify-isolated-supabase.mts", verifierSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const planner = verifier.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "verifyLocalRiskVerificationPlan"); assert.ok(planner?.body);
  const calls = (at: ts.Node) => { const values: ts.CallExpression[] = []; const visit = (node: ts.Node) => { if (ts.isCallExpression(node)) values.push(node); ts.forEachChild(node, visit); }; visit(at); return values; };
  const selected: ts.Statement[] = planner.body.statements.filter(node => {
    if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression) || node.expression.expression.getText(verifier) !== "check") return false;
    const expressions = calls(node).map(call => call.expression.getText(verifier));
    return expressions.includes("api.localVerificationCommandSteps") && expressions.includes("api.registeredVerificationNodeEntries")
      || expressions.includes("ts.transform") && expressions.includes("api.registeredVerificationNodeEntries");
  });
  assert.equal(selected.length, 4);
  const declaration = (name: string) => { const found = planner.body!.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(value => value.name.getText(verifier) === name)); assert.ok(found); return found; };
  const unsafe = planner.body.statements.filter(node => ts.isForOfStatement(node) && node.expression.getText(verifier) === "unsafeChains"); assert.equal(unsafe.length, 1);
  selected.push(declaration("coverageEntry"), declaration("unsafeChains"), unsafe[0]!);
  selected.sort((left, right) => left.getStart(verifier) - right.getStart(verifier));
  const events: Array<Record<string, unknown>> = [], completed: string[] = []; let activeCase = "";
  let mutant: { actualRejected: boolean; removedGuardOutput: string[] } | null = null;
  const capture = <T,>(method: string, commands: Readonly<Record<string, string>>, name: string, run: () => T): T => {
    const observation = { case: activeCase, method, command: name, rootOwn: Object.hasOwn(commands, name), rootType: typeof commands[name] };
    try { const result = run(); events.push({ ...observation, outcome: result === undefined ? "UNSUPPORTED" : "RETURNED", result: result ?? null }); return result; }
    catch (error) { events.push({ ...observation, outcome: "REJECTED", errorName: error instanceof Error ? error.name : "NonError" }); throw error; }
  };
  const api: Api = {
    localVerificationCommandSteps: (commands, name) => capture("localVerificationCommandSteps", commands, name, () => actual.localVerificationCommandSteps(commands, name)),
    registeredVerificationNodeEntries: (commands, name) => capture("registeredVerificationNodeEntries", commands, name, () => actual.registeredVerificationNodeEntries(commands, name)),
  };
  const assertionPort = new Proxy(assert, { get(target, property, receiver) {
    if (property !== "deepEqual") return Reflect.get(target, property, receiver);
    return (observed: unknown, expected: unknown, message?: string) => {
      assert.deepEqual(observed, expected, message);
      if (activeCase.startsWith("removing the actual registered-entry assertion") && Array.isArray(observed)
        && observed.length === 1 && observed[0] === "scripts/../private/coverage.mjs") mutant = { actualRejected: true, removedGuardOutput: [...observed] as string[] };
    };
  } });
  const checkPort = (name: string, execute: () => void) => { activeCase = name; check(name, execute); completed.push(name); activeCase = ""; };
  const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;
  const code = ts.transpileModule(selected.map(node => node.getText(verifier)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("assert", "ts", "api", "scripts", "statement", "sourceIncluded", "check", code)(assertionPort, ts, api, scripts, statement, sourceIncluded, checkPort);
  assert.equal(completed.length, 23); assert.ok(mutant);
  return { status: "PASS", sourceOwnerSha256: sha256(ownerSource), sourceVerifierSha256: sha256(verifierSource),
    actualSourceProjection: true, originalPlannerAssertionsRetained: true, cases: completed, events, mutant,
    selectedStatements: selected.map(node => ({ kind: ts.SyntaxKind[node.kind], text: node.getText(verifier), sha256: sha256(node.getText(verifier)) })),
    operatingSystemAllocations: 0, copiedAssertionBodies: false };
}

/** Pure adversarial inputs to the actual public qualifier; no receipt or platform lifecycle is fabricated. */
function verifyInputObservationValidationControls(raw: LocalVerificationInputObservations) {
  const ownerFile = "scripts/lib/isolated-public-verification.mts", source = readSource(ownerFile);
  const tree = ts.createSourceFile(ownerFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const node = tree.statements.find((value): value is ts.FunctionDeclaration => ts.isFunctionDeclaration(value) && value.name?.text === "validateLocalVerificationInputObservations"); assert.ok(node?.body);
  const api: Pick<typeof import("./lib/isolated-public-verification.mts"), "validateLocalVerificationInputObservations"> = {
    validateLocalVerificationInputObservations: new Function("assert", "ts", "digest", ts.transpileModule(node.getText(tree).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      + ";return validateLocalVerificationInputObservations;")(assert, ts, sha256),
  };
  const validationOutcomes: Array<{ context: string; status: string; failures: string[]; coverageFiles: string[] }> = [];
  const mutationWitnesses: Array<{ file: string; declaration: string; beforeSha256: string; afterSha256: string }> = [];
  let validationContext = "actual_raw_positive";
  const validate: typeof api.validateLocalVerificationInputObservations = input => { const result = api.validateLocalVerificationInputObservations(input);
    validationOutcomes.push({ context: validationContext, status: result.status, failures: result.failures, coverageFiles: result.coverage.map(row => row.file) }); return result; };
  try {
  const sources = new Map(raw.sources.map(row => [row.file, readSource(row.file)]));
  const actual = api.validateLocalVerificationInputObservations({ sources, observations: raw });
  validationOutcomes.push({ context: validationContext, status: actual.status, failures: actual.failures, coverageFiles: actual.coverage.map(row => row.file) });
  assert.equal(actual.status, "PASS"); assert.equal(actual.coverage.length, 4);
  const names: string[] = [];
  const reject = (name: string, mutate: (value: LocalVerificationInputObservations, files: Map<string, string>) => void) => {
    const value = structuredClone(raw), files = new Map(sources); mutate(value, files);
    // Renew integrity metadata deliberately: these negatives must fail semantics, not a stale hash.
    value.sources = value.sources.map(row => ({ file: row.file, sha256: sha256(files.get(row.file)!) }));
    value.sourceWitnesses = value.sourceWitnesses.map(witness => {
      const file = witness.file as string, declaration = witness.declaration as string;
      const parsed = ts.createSourceFile(file, files.get(file)!, ts.ScriptTarget.Latest, true, /\.[cm]?ts$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      const actual = declaration === "$module" ? parsed : declaration === "$dispatch" ? parsed.statements.find(ts.isTryStatement)
        : parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === declaration); assert.ok(actual);
      const calls: Array<{ expression: string; arguments: string[]; position: number }> = [];
      const visit = (node: ts.Node) => { if (ts.isCallExpression(node)) calls.push({ expression: node.expression.getText(parsed), arguments: node.arguments.map(argument => argument.getText(parsed)), position: node.getStart(parsed) }); ts.forEachChild(node, visit); };
      visit(actual); return { file, declaration, kind: ts.SyntaxKind[actual.kind], text: actual.getText(parsed), sha256: sha256(actual.getText(parsed)), calls };
    });
    validationContext = name;
    const result = validate({ sources: files, observations: value }); assert.equal(result.status, "BLOCKED", name); assert.deepEqual(result.coverage, []); names.push(name);
  };
  const edit = (files: Map<string, string>, file: string, before: string, after: string, declaration = "verifyReleaseLockInputContracts") => {
    const source = files.get(file)!, parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const matches = declaration === "$module" ? [parsed] : declaration === "$dispatch" ? parsed.statements.filter(ts.isTryStatement)
      : parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === declaration);
    assert.equal(matches.length, 1); const target = matches[0]!, original = target.getText(parsed);
    assert.equal(original.split(before).length, 2, "A negative must mutate one occurrence in its actual declaration.");
    const changed = original.replace(before, after); assert.notEqual(changed, original);
    files.set(file, source.slice(0, target.getStart(parsed)) + changed + source.slice(target.end));
    mutationWitnesses.push({ file, declaration, beforeSha256: sha256(original), afterSha256: sha256(changed) });
  };
  const transportLeaf = "scripts/qa-isolated-supabase-transport.mjs";
  const editTransportTerminal = (value: LocalVerificationInputObservations, mutate: (cases: string[]) => void) => {
    const proofs = value.observations.runtimeProofs as Array<Record<string, unknown>>;
    const proof = proofs.find(row => row.control === "actual_owned_transport_leaf")!;
    const actual = proof.actualResult as Record<string, unknown>, terminal = JSON.parse(String(actual.stdout)) as { cases: string[]; checks: number };
    mutate(terminal.cases); terminal.checks = terminal.cases.length; proof.cases = [...terminal.cases]; proof.checks = terminal.checks;
    actual.stdout = JSON.stringify(terminal, null, 2) + "\n";
    const digest = sha256(String(actual.stdout)), archive = proofs.find(row => row.control === "windows_native_evidence_archive" || row.control === "owned_child_evidence_archive")!;
    const files = archive.files as Array<{ file: string; sha256: string }>, archived = files.filter(row => row.file === "public-transport-contracts.stdout.log");
    assert.equal(archived.length, 1); archived[0]!.sha256 = digest;
    const artifacts = value.artifacts.filter(row => row.path.endsWith("/public-transport-contracts.stdout.log"));
    assert.equal(artifacts.length, 1); artifacts[0]!.sha256 = digest;
  };
  reject("owned raw stream cannot borrow an unchanged archive fingerprint", value => {
    const proof = (value.observations.runtimeProofs as Array<Record<string, unknown>>).find(row => row.control === "actual_owned_transport_leaf")!;
    const result = proof.actualResult as Record<string, unknown>; result.stdout = String(result.stdout) + " ";
  });
  reject("missing original transport case rejects after raw archive metadata is retied", value => editTransportTerminal(value, cases => { cases.splice(0, 1); }));
  reject("duplicate transport case rejects after raw archive metadata is retied", value => editTransportTerminal(value, cases => { cases[1] = cases[0]!; }));
  reject("reordered transport cases reject after raw archive metadata is retied", value => editTransportTerminal(value, cases => { [cases[0], cases[1]] = [cases[1]!, cases[0]!]; }));
  reject("unregistered transport case rejects after raw archive metadata is retied", value => editTransportTerminal(value, cases => { cases.push("unregistered transport receipt case"); }));
  reject("conditional transport registration cannot borrow live receipt evidence", (_value, files) => edit(files, transportLeaf,
    "cases.push('cleanup releases every owned listener');", "if (false) cases.push('cleanup releases every owned listener');", "$module"));
  reject("dynamic transport case emission cannot replace a literal registration", (_value, files) => edit(files, transportLeaf,
    "cases.push('all four ports can be bound after cleanup');", "cases.push(String('all four ports can be bound after cleanup'));", "$module"));
  reject("transport helper cannot record a case without executing its actual callback", (_value, files) => edit(files, transportLeaf,
    "run();", "void run;", "check"));
  reject("new transport helper cannot record an unexecuted asynchronous callback", (_value, files) => edit(files, transportLeaf,
    "await run();", "void run;", "transportSetupCase"));
  const transportStatement = (files: Map<string, string>, helper: string) => {
    const source = files.get(transportLeaf)!, tree = ts.createSourceFile(transportLeaf, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const statement = tree.statements.find(node => ts.isExpressionStatement(node) && (() => {
      const expression = ts.isAwaitExpression(node.expression) ? node.expression.expression : node.expression;
      return ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === helper;
    })());
    assert.ok(statement && ts.isExpressionStatement(statement));
    const expression = ts.isAwaitExpression(statement.expression) ? statement.expression.expression : statement.expression;
    assert.ok(ts.isCallExpression(expression)); const label = expression.arguments[0]; assert.ok(label && ts.isStringLiteral(label));
    return { text: statement.getText(tree), name: label.text };
  };
  reject("missing new transport case rejects with renewed raw stdout and archive metadata", (value, files) => {
    const target = transportStatement(files, "transportSetupCase"); editTransportTerminal(value, cases => {
      const index = cases.indexOf(target.name); assert.ok(index >= 0); cases.splice(index, 1);
    });
  });
  for (const helper of ["check", "transportSetupCase"]) reject("whole " + helper + " vector deletion cannot shrink its own transport obligations", (value, files) => {
    const target = transportStatement(files, helper); edit(files, transportLeaf, target.text, "", "$module");
    editTransportTerminal(value, cases => { const index = cases.indexOf(target.name); assert.ok(index >= 0); cases.splice(index, 1); });
  });
  const verifier = "scripts/verify-isolated-supabase.mts";
  reject("genuine JSON assertion deletion with count replacement", (_value, files) => edit(files, verifier, "assert.deepEqual(actual, expected)", "assert.equal(true, true)"));
  reject("same-count changed JSON assertion operator", (_value, files) => edit(files, verifier, "assert.deepEqual(actual, expected)", "assert.notDeepEqual(actual, expected)"));
  reject("dead meaningful JSON assertion", (_value, files) => edit(files, verifier, "assert.deepEqual(actual, expected)", "if (false) assert.deepEqual(actual, expected)"));
  reject("early return before meaningful JSON assertion", (_value, files) => edit(files, verifier, "const actual = read(input); assert.deepEqual(actual, expected)", "const actual = read(input); return {}; assert.deepEqual(actual, expected)"));
  reject("swapped JSON mutation retains its old vector name and count", (_value, files) => edit(files, verifier, 'value.release.commit = "0".repeat(40)', 'value.release.sourceBaseUrl = "https://example.invalid/"'));
  reject("dropped JSON mutation cannot be compensated by its retained label", (_value, files) => edit(files, verifier, "value.files = []", "Object.assign(value, {})"));
  reject("JSON rejection operator contract cannot borrow another error code", (_value, files) => edit(files, verifier, '["schema drift", "UNAPPROVED_RELEASE"', '["schema drift", "INCOMPLETE_RELEASE_LOCK"'));
  reject("uninvoked admission entry retains a helper name", (_value, files) => edit(files, verifier, "await verifySharedChildControls({ admissionOnly: true })", "await (false ? verifySharedChildControls({ admissionOnly: true }) : Promise.resolve([]))", "admissionQualificationOnly"));
  reject("CLI loader substitutes cached source for actual options", (_value, files) => edit(files, verifier, "options.getText(tree) +", '"cached unrelated parser" +', "verifyIsolatedCliInputContracts"));
  reject("changed actual CLI dispatcher cannot borrow old observations", (_value, files) => edit(files, "scripts/qa-isolated-supabase.mts", "runIsolatedSupabase(options(args))", "runIsolatedSupabase({})", "$dispatch"));
  reject("C# compiler source snapshot substitution", (_value, files) => edit(files, "scripts/lib/windows-owned-process.mts", '"/r:" + reference.file), sourceSnapshot]', '"/r:" + reference.file), "unowned.cs"]', "nativeBuild"));
  reject("corrupt actual child raw exit", value => { const proof = (value.observations.runtimeProofs as Array<Record<string, unknown>>).find(row => row.control === "actual_owned_transport_leaf")!;
    (proof.actualResult as Record<string, unknown>).rawExit = { code: 9, signal: null }; });
  reject("missing JSON negative artifact", value => { value.artifacts = value.artifacts.filter(row => !row.path.endsWith("release-lock-inputs/lock-2.json")); });
  reject("native cleanup zero cannot be replaced by PID absence", value => { const proof = (value.observations.runtimeProofs as Array<Record<string, unknown>>).find(row => row.control === "actual_owned_transport_leaf")!;
    const result = proof.actualResult as Record<string, unknown>, cleanup = result.cleanup as Record<string, unknown>; cleanup.processTreeVerified = false; });
  const linux = structuredClone(raw), proofs = linux.observations.runtimeProofs as Array<Record<string, unknown>>;
  (linux.observations.runtime as Record<string, unknown>).platform = "linux";
  linux.observations.native = { status: "BLOCKED", missingProof: "windows_native_job_launch_unavailable" };
  const native = proofs.find(row => row.control === "windows_imported_type_and_source_contracts")!;
  native.nativeIntegrity = { status: "PASS", scope: "non_windows_platform_rejection_before_compiler_or_spawn", capabilityStatus: "BLOCKED", platform: "linux", nativeExecuted: false, compilerProcessesExecuted: 0, actualRootProcessesAllocated: 0 };
  const archive = proofs.find(row => row.control === "windows_native_evidence_archive" || row.control === "owned_child_evidence_archive")!; archive.control = "owned_child_evidence_archive";
  for (const proof of proofs.filter(row => row.control === "actual_owned_transport_leaf" || row.control === "actual_cli_no_allocation_rejection")) {
    const result = proof.actualResult as Record<string, unknown>, cleanup: Record<string, unknown> = { ...(result.cleanup as Record<string, unknown>), platform: "linux", method: "linux-marker-and-process-identity", processTreeVerified: true };
    delete cleanup.nativeJobReceipt; result.cleanup = cleanup; proof.cleanup = cleanup;
    delete result.nativeJobReceipt; delete result.nativeJobIdentity; delete result.nativeCapability;
  }
  validationContext = "controlled_linux_platform_positive";
  const linuxResult = validate({ sources, observations: linux }); assert.equal(linuxResult.status, "PASS"); assert.equal(linuxResult.nativeExecuted, false);
  assert.equal(linuxResult.nativeAcceptanceStatus, "PLATFORM_REJECTION_AND_SOURCE_CONTRACT_ONLY");
  const forged = structuredClone(linux); (forged.observations.native as Record<string, unknown>).status = "PASS";
  validationContext = "controlled_linux_native_claim_rejected"; assert.equal(validate({ sources, observations: forged }).status, "BLOCKED");
  const windowsWithoutNative = structuredClone(linux); (windowsWithoutNative.observations.runtime as Record<string, unknown>).platform = "win32";
  validationContext = "windows_without_actual_native_rejected"; assert.equal(validate({ sources, observations: windowsWithoutNative }).status, "BLOCKED");
  if (actual.nativeAcceptancePlatform === "win32") { assert.equal(actual.nativeExecuted, true); assert.equal(actual.nativeAcceptanceStatus, "ACTUAL_NATIVE_EXECUTION"); }
  return { status: "PASS", sourceOwnerSha256: sha256(source), actualQualifierExecuted: true, actualPlatformPositive: actual.nativeAcceptancePlatform,
    controlledLinuxPlatformOnlyPositive: true, controlledLinuxNativeClaimRejected: true, windowsWithoutActualNativeRejected: true, negatives: names, operatingSystemAllocations: 0,
    controlledPlatformVectorsAreNotLifecycleEvidence: true, validationOutcomes, mutationWitnesses };
  } catch (error) { if (error instanceof Error) Object.defineProperty(error, "inputValidationOutcomes", { value: validationOutcomes }); throw error; }
}

/** Raw observations only. The public execution owner independently qualifies these facts. */
function verificationInputSourceObservations() {
  const witnesses: Record<string, unknown>[] = [], observed = new Map<string, string>();
  const declaration = (file: string, names: string[]) => {
    const source = readSource(file); observed.set(file, source);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, /\.[cm]?ts$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    assert.deepEqual((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics, []);
    for (const name of names) {
      const matches = name === "$module" ? [tree] : name === "$dispatch" ? tree.statements.filter(ts.isTryStatement)
        : tree.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
      assert.equal(matches.length, 1, "Input observation requires one actual declaration: " + file + "#" + name);
      const node = matches[0]!, calls: Array<{ expression: string; arguments: string[]; position: number }> = [];
      const visit = (part: ts.Node) => { if (ts.isCallExpression(part)) calls.push({ expression: part.expression.getText(tree),
        arguments: part.arguments.map(argument => argument.getText(tree)), position: part.getStart(tree) }); ts.forEachChild(part, visit); };
      visit(node); const text = node.getText(tree);
      witnesses.push({ file, declaration: name, kind: ts.SyntaxKind[node.kind], text, sha256: sha256(text), calls });
    }
  };
  declaration("scripts/verify-isolated-supabase.mts", ["readSource", "verifyReleaseLockInputContracts", "verifyIsolatedCliInputContracts", "verifyWindowsOwnedProcessContracts",
    "verifySharedChildControls", "verifyRegisteredNodeEntryControls", "verifyInputObservationValidationControls", "verifyAdoptionDeadlineControls", "admissionQualificationOnly"]);
  declaration("scripts/lib/isolated-supabase.mts", ["sourcePath", "requireThat", "readReleaseLock", "runIsolatedSupabase"]);
  declaration("scripts/lib/windows-owned-process.mts", ["nativeBuild", "windowsOwnedProcessCapability", "spawnWindowsOwnedProcess"]);
  declaration("scripts/lib/isolated-public-verification.mts", ["localVerificationCommandSteps", "registeredVerificationNodeEntries", "localVerificationQualityPrefixDeadlineMs", "localVerificationOperationalDeadlineMs", "runOwnedVerificationChild", "stopChild"]);
  declaration("scripts/qa-isolated-supabase.mts", ["options", "$dispatch"]);
  declaration("scripts/qa-isolated-supabase-transport.mjs", ["$module"]);
  const graph = collectExecutableSourceGraph({ root, entrySourceFiles: [...observed.keys()], symbolAware: false, nativeEagerImports: true });
  // The existing graph caches parsed modules; raw evidence must reread every
  // current dependency so its before/after check cannot reuse cached bytes.
  for (const file of graph.keys()) observed.set(file, readSource(file));
  const lockFile = "scripts/fixtures/isolated-supabase/stack.lock.json", lockSource = readSource(lockFile), lock = JSON.parse(lockSource) as StackLock;
  observed.set(lockFile, lockSource);
  for (const file of ["scripts/lib/windows-owned-process.cs", lock.compose.path, lock.transport.path, "package.json", "package-lock.json", "tsconfig.json"])
    observed.set(file, readSource(file));
  return { sourceWitnesses: witnesses, sources: [...observed].map(([file, source]) => ({ file, sha256: sha256(source) })).sort((left, right) => left.file.localeCompare(right.file)) };
}

async function admissionQualificationOnly() {
  assert.deepEqual(process.argv.slice(2), ["--admission-qualification-only"], "Admission observations accept exactly their one registered-entry flag.");
  const nonce = process.env.VENESIA_QA_ADMISSION_NONCE;
  assert.ok(nonce && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(nonce), "Admission observations require their owner's fresh UUID nonce.");
  const installedLock = path.join(root, "node_modules/.package-lock.json");
  const runtimeSnapshot = () => ({ node: process.version, v8: process.versions.v8, modules: process.versions.modules, platform: process.platform, arch: process.arch,
    executable: process.execPath, executableSha256: sha256(readFileSync(process.execPath)), execArgv: process.execArgv,
    installedLockSha256: existsSync(installedLock) ? sha256(readFileSync(installedLock)) : null });
  const runtime = runtimeSnapshot();
  const before = verificationInputSourceObservations();
  const adoptionDeadline = await verifyAdoptionDeadlineControls();
  const registeredEntries = verifyRegisteredNodeEntryControls();
  const runtimeProofs = await verifySharedChildControls({ admissionOnly: true });
  runtimeProofs.push({ control: "adoption_deadline", ...adoptionDeadline });
  runtimeProofs.push({ control: "registered_node_entries", ...registeredEntries });
  const after = verificationInputSourceObservations(); assert.deepEqual(after, before, "Input observation source closure changed during execution.");
  const archived = runtimeProofs.find(row => row.control === "windows_native_evidence_archive" || row.control === "owned_child_evidence_archive") as {
    directory: string; files: Array<{ file: string; sha256: string }> } | undefined;
  const artifacts: Array<{ path: string; sha256: string }> = [];
  const artifact = (absolute: string, expected?: string) => {
    assert.equal(realpathSync(absolute), absolute); assert.equal(lstatSync(absolute).isFile(), true);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    assert.ok(relative.startsWith(".tmp-qa/") && !relative.split("/").includes(".."));
    const sha = sha256(readFileSync(absolute)); if (expected !== undefined) assert.equal(sha, expected);
    assert.equal(artifacts.some(row => row.path === relative), false); artifacts.push({ path: relative, sha256: sha });
  };
  if (archived) {
    for (const row of archived.files) artifact(path.join(archived.directory, row.file), row.sha256);
    artifact(path.join(archived.directory, "evidence-index.json"));
  }
  const native = windowsOwnedProcessCapability();
  if (native?.status === "PASS") for (const file of [native.native.sourceSnapshot, native.native.provenance, native.native.executable]) artifact(file);
  assert.deepEqual(runtimeSnapshot(), runtime, "Input observation runtime inputs changed during execution.");
  const raw: LocalVerificationInputObservations = { schema: 1, kind: "verification-input-observations", nonce,
    entry: "scripts/verify-isolated-supabase.mts", executionScope: "affected_input_controls", sources: before.sources,
    sourceWitnesses: before.sourceWitnesses, artifacts,
    observations: { status: "PASS", checks: cases.length, cases, runtimeProofs, native,
      runtime, runtimeInputsUnchanged: true,
      actualOwnedChildrenExecuted: true, originalFinallyExecuted: true, sourceInputsUnchanged: true, dockerExecuted: false,
      databaseCalls: 0, externalNetworkRequests: 0, ownedLoopbackTransportExecuted: true, unrelatedNativeLifecycleReexecuted: false,
      automaticQualificationClaimed: false } };
  assert.ok(archived, "Admission observations require their original owned evidence archive.");
  writeFileSync(path.join(archived.directory, "input-observations-before-validation.json"), JSON.stringify(raw, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  try { raw.observations.qualificationValidatorControls = verifyInputObservationValidationControls(raw); }
  catch (error) {
    const controlled = error as { actual?: unknown; expected?: unknown; operator?: unknown; inputValidationOutcomes?: unknown };
    const primitive = (value: unknown) => value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string" ? value : "<nonprimitive omitted>";
    try { writeFileSync(path.join(archived.directory, "input-observations-validation-failure.json"), JSON.stringify({ schema: 1,
      stage: "input_observation_validation_controls", originalFailurePreserved: true,
      error: { name: error instanceof Error ? error.name : "NonError", message: error instanceof Error ? error.message : "Non-Error thrown value",
        stack: error instanceof Error ? error.stack : null, actual: primitive(controlled.actual), expected: primitive(controlled.expected), operator: primitive(controlled.operator) },
      validationOutcomes: controlled.inputValidationOutcomes ?? [] }, null, 2) + "\n", { flag: "wx", mode: 0o600 }); }
    catch (evidenceError) { if (error instanceof Error) Object.defineProperty(error, "inputValidationEvidenceError", { value: evidenceError }); }
    throw error;
  }
  if (archived) writeFileSync(path.join(archived.directory, "input-observations.json"), JSON.stringify(raw, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: "PASS", rawObservations: raw }, null, 2));
}

async function ownedChildControlsOnly() {
  const runtimeProofs = await verifySharedChildControls();
  console.log(JSON.stringify({ status: "PASS", checks: cases.length, cases, platform: process.platform,
    runtimeProofs, actualOwnedChildrenExecuted: true, tempFixtureCleanupVerified: true, browserExecuted: false, databaseCalls: 0,
    dockerResourcesAllocated: 0, ownedLoopbackTransportExecuted: true, externalNetworkRequests: 0,
    windowsExitedRootDescendantsQualified: process.platform === "win32", windowsNativeAcceptanceCases: process.platform === "win32" ? 12 : 0 }, null, 2));
}

/** Execute the actual Admission data/authority declarations with bounded in-memory ports only. */
async function verifyAdmissionQualificationControls() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const tree = ts.createSourceFile("owner.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = (name: string) => {
    const node = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name
      || ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(tree) === name));
    assert.ok(node, "Missing actual Admission declaration: " + name); return node.getText(tree).replace(/^export /u, "");
  };
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const memoryRoot = path.join(root, ".tmp-qa", "controlled-admission-no-files");
  const memory = (files: Map<string, Buffer>, links = new Set<string>(), linkTargets = new Map<string, string>()) => {
    const directories = new Set<string>();
    let indexedSize = -1;
    const refresh = () => { if (indexedSize === files.size) return; indexedSize = files.size;
      for (const file of files.keys()) for (let at = path.dirname(file); at !== path.dirname(at); at = path.dirname(at)) directories.add(at); };
    const missing = (file: string) => Object.assign(Error("Missing controlled file: " + file), { code: "ENOENT" });
    return {
      exists(file: string) { refresh(); return files.has(file) || directories.has(file); },
      read(file: string, encoding?: string) { const value = files.get(file); if (!value) throw missing(file); return encoding ? value.toString("utf8") : value; },
      write(file: string, value: string | Buffer) { files.set(file, Buffer.isBuffer(value) ? value : Buffer.from(value)); },
      list(directory: string) { refresh(); const prefix = directory + path.sep;
        return [...new Set([...files.keys(), ...directories].filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length).split(path.sep)[0]!))]; },
      stat(file: string) { refresh(); if (!files.has(file) && !directories.has(file)) throw missing(file);
        return { isFile: () => files.has(file), isDirectory: () => directories.has(file), isSymbolicLink: () => links.has(file) }; },
      real(file: string) { return linkTargets.has(file) ? path.resolve(path.dirname(file), linkTargets.get(file)!)
        : links.has(file) ? path.join(memoryRoot, "outside", path.basename(file)) : file; },
      readlink(file: string) { const value = linkTargets.get(file); if (value === undefined) throw missing(file); return value; },
      mkdir(directory: string) { directories.add(directory); },
    };
  };
  type RuntimeApi = Pick<typeof import("./lib/isolated-public-verification.mts"), "localVerificationInstalledRuntimePackages" | "localVerificationAdmissionRuntimeIdentity">;
  const runtimeCode = compile(declaration("localVerificationInstalledRuntimePackages") + "\n" + declaration("localVerificationAdmissionRuntimeIdentity"));
  const runtimeFixture = () => {
    const files = new Map<string, Buffer>(), links = new Set<string>(), linkTargets = new Map<string, string>(), fs = memory(files, links, linkTargets), directory = path.join(memoryRoot, "node_modules");
    const put = (file: string, value: unknown) => files.set(file, Buffer.from(typeof value === "string" ? value : JSON.stringify(value)));
    const manifests: Record<string, object> = { typescript: {}, pkg: { dependencies: { dep: "1" }, optionalDependencies: { "@img/addon": "1", absent: "1" },
      peerDependencies: { peer: "1", optionalPeer: "1" }, peerDependenciesMeta: { optionalPeer: { optional: true } } }, dep: {}, peer: {}, "@img/addon": { exports: { "./native": "./addon.node" } } };
    const installed: Record<string, Record<string, unknown>> = {};
    for (const [name, fields] of Object.entries(manifests)) {
      put(path.join(directory, name, "package.json"), { name, version: "1.0.0", ...fields }); put(path.join(directory, name, name === "@img/addon" ? "addon.node" : "index.js"), "controlled bytes " + name);
      installed["node_modules/" + name] = { version: "1.0.0", resolved: "https://registry.invalid/" + name, integrity: "controlled-integrity" };
    }
    put(path.join(directory, ".package-lock.json"), { packages: installed }); put(path.join(memoryRoot, "package-lock.json"), { packages: installed });
    const executable = path.join(memoryRoot, "node.exe"); put(executable, "controlled-node-1");
    let outside = false;
    const resolver = Object.assign((name: string) => {
      if (outside) return path.join(memoryRoot, "outside", name, "index.js");
      if (name === "@img/addon") throw Object.assign(Error("Root export is restricted"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
      const entry = path.join(directory, name, "index.js"); if (!files.has(entry)) throw Object.assign(Error("Missing optional controlled package"), { code: "MODULE_NOT_FOUND" }); return entry;
    }, { paths: () => [directory] });
    const api = new Function("assert", "ROOT", "join", "dirname", "sep", "nodeModule", "existsSync", "readFileSync", "readdirSync", "lstatSync", "readlinkSync", "realpathSync", "digest", "process",
      runtimeCode + ";return {localVerificationInstalledRuntimePackages,localVerificationAdmissionRuntimeIdentity};")(
      assert, memoryRoot, path.join, path.dirname, path.sep, { createRequire: () => ({ resolve: resolver }) }, fs.exists, fs.read, fs.list, fs.stat, fs.readlink, fs.real, sha256,
      { version: "controlled-node-version", versions: { v8: "controlled-v8", modules: "controlled-abi" }, platform: "win32", arch: "x64", execPath: executable, execArgv: ["--experimental-strip-types"] }) as RuntimeApi;
    return { api, files, links, linkTargets, installed, directory, executable, put, fs, outside: () => { outside = true; } };
  };
  const verifyRuntime = (api: RuntimeApi) => {
    const original = api.localVerificationInstalledRuntimePackages(["pkg"]);
    assert.deepEqual(original.map(row => row.root), ["node_modules/dep", "node_modules/pkg"]);
    const expanded = api.localVerificationInstalledRuntimePackages(["pkg"], true);
    assert.deepEqual(expanded.map(row => row.root), ["node_modules/@img/addon", "node_modules/dep", "node_modules/peer", "node_modules/pkg"]);
    assert.ok(expanded.every(row => row.files > 0 && row.bytes > 0 && /^[a-f0-9]{64}$/u.test(row.sha256)));
    const identity = api.localVerificationAdmissionRuntimeIdentity(["pkg", "typescript"]);
    assert.equal(identity.node, "controlled-node-version"); assert.equal(identity.v8, "controlled-v8"); assert.equal(identity.modules, "controlled-abi");
    assert.equal(identity.installedDependenciesMatchProjectLock, true); assert.equal(identity.packages.length, 5);
    assert.deepEqual(identity.execArgv, ["--experimental-strip-types"]); assert.match(identity.executableSha256, /^[a-f0-9]{64}$/u);
    return identity;
  };
  check("actual Admission runtime closure preserves dependency-only policy and binds installed optional/native-subpath and peer bytes", () => verifyRuntime(runtimeFixture().api));
  check("actual Admission runtime fingerprint changes for package and executable bytes", () => {
    const fixture = runtimeFixture(), before = verifyRuntime(fixture.api);
    fixture.put(path.join(fixture.directory, "pkg", "index.js"), "changed package bytes");
    const changed = fixture.api.localVerificationAdmissionRuntimeIdentity(["pkg", "typescript"]); assert.notDeepEqual(changed.packages, before.packages);
    fixture.put(fixture.executable, "controlled-node-2"); assert.notEqual(fixture.api.localVerificationAdmissionRuntimeIdentity(["pkg", "typescript"]).executableSha256, before.executableSha256);
  });
  check("actual Admission runtime closure rejects missing required peers links outside roots and byte-budget overflow", () => {
    const missing = runtimeFixture(); for (const file of [...missing.files.keys()]) if (file.startsWith(path.join(missing.directory, "peer") + path.sep)) missing.files.delete(file);
    assert.throws(() => missing.api.localVerificationInstalledRuntimePackages(["pkg"], true), (error: unknown) => error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND");
    for (const target of ["pkg", path.join("pkg", "index.js")]) { const fixture = runtimeFixture(); fixture.links.add(path.join(fixture.directory, target));
      assert.throws(() => fixture.api.localVerificationInstalledRuntimePackages(["pkg"], true), /unqualified link/u); }
    const escaped = runtimeFixture(); escaped.outside(); assert.throws(() => escaped.api.localVerificationInstalledRuntimePackages(["pkg"], true), /escaped the installed project/u);
    assert.throws(() => escaped.api.localVerificationInstalledRuntimePackages(["../foreign"], true), /literal installed package names/u);
    const tooLarge = runtimeFixture(); tooLarge.files.set(path.join(tooLarge.directory, "pkg", "oversized.bin"), { length: 96 * 1024 * 1024 + 1 } as Buffer);
    assert.throws(() => tooLarge.api.localVerificationInstalledRuntimePackages(["pkg"], true), /bounded read budget/u);
    const tooMany = runtimeFixture(), empty = Buffer.alloc(0);
    for (let index = 0; index <= 10_000; index++) tooMany.files.set(path.join(tooMany.directory, "pkg", "entry-" + index + ".js"), empty);
    assert.throws(() => tooMany.api.localVerificationInstalledRuntimePackages(["pkg"], true), /bounded read budget/u);
  });
  check("actual Admission runtime identity rejects absent and mismatched installed project or package metadata", () => {
    const missing = runtimeFixture(); missing.files.delete(path.join(missing.directory, ".package-lock.json")); assert.throws(() => missing.api.localVerificationAdmissionRuntimeIdentity(["pkg"]), /Missing controlled file/u);
    const absent = runtimeFixture(); delete absent.installed["node_modules/typescript"]; absent.put(path.join(absent.directory, ".package-lock.json"), { packages: absent.installed });
    assert.throws(() => absent.api.localVerificationAdmissionRuntimeIdentity(["pkg"]), assert.AssertionError);
    const mismatch = runtimeFixture(); mismatch.put(path.join(memoryRoot, "package-lock.json"), { packages: {} });
    assert.throws(() => mismatch.api.localVerificationAdmissionRuntimeIdentity(["pkg"]), /differs from the current package lock/u);
    const version = runtimeFixture(); version.put(path.join(version.directory, "pkg", "package.json"), { name: "pkg", version: "9.0.0" });
    assert.throws(() => version.api.localVerificationAdmissionRuntimeIdentity(["pkg"]), /version differs from the installed lock/u);
  });
  const runtimeBinFixture = () => {
    const fixture = runtimeFixture(), modules = path.join(fixture.directory, "pkg", "node_modules");
    const packageDirectory = path.join(modules, "semver"), target = path.join(packageDirectory, "bin", "semver.js");
    const link = path.join(modules, ".bin", "semver"), linkTarget = "../semver/bin/semver.js";
    const manifestFile = path.join(packageDirectory, "package.json"), packageKey = "node_modules/pkg/node_modules/semver";
    const manifest = { name: "semver", version: "7.8.5", bin: { semver: "bin/semver.js" } };
    fixture.put(manifestFile, manifest); fixture.put(target, "controlled semver bin bytes");
    fixture.put(link, ""); fixture.links.add(link); fixture.linkTargets.set(link, linkTarget);
    fixture.installed[packageKey] = { version: "7.8.5", resolved: "https://registry.invalid/semver", integrity: "controlled-semver-integrity", bin: manifest.bin };
    const syncLocks = () => { fixture.put(path.join(fixture.directory, ".package-lock.json"), { packages: fixture.installed });
      fixture.put(path.join(memoryRoot, "package-lock.json"), { packages: fixture.installed }); };
    syncLocks();
    return { ...fixture, modules, packageDirectory, target, link, linkTarget, manifestFile, packageKey, manifest, syncLocks };
  };
  check("actual Admission alone qualifies the exact lock-bound npm nested semver bin link and charges target bytes", () => {
    const fixture = runtimeBinFixture();
    assert.throws(() => fixture.api.localVerificationInstalledRuntimePackages(["pkg"]), /unqualified link/u);
    const identity = fixture.api.localVerificationAdmissionRuntimeIdentity(["pkg", "typescript"]);
    const bound = identity.packages.find(row => row.root === "node_modules/pkg")!;
    const entries = [...fixture.files].filter(([file]) => file.startsWith(path.join(fixture.directory, "pkg") + path.sep));
    assert.equal(bound.files, entries.length);
    assert.equal(bound.bytes, entries.reduce((sum, [, bytes]) => sum + bytes.length, 0)
      + fixture.files.get(fixture.target)!.length + Buffer.byteLength(fixture.linkTarget));
    fixture.put(fixture.target, "changed semver command bytes");
    assert.notDeepEqual(fixture.api.localVerificationAdmissionRuntimeIdentity(["pkg", "typescript"]).packages, identity.packages);
  });
  check("actual Admission npm bin identity changes when the uniquely declared command link changes", () => {
    const fixture = runtimeBinFixture(), before = fixture.api.localVerificationInstalledRuntimePackages(["pkg"], true);
    const renamed = path.join(fixture.modules, ".bin", "semver-command");
    fixture.files.delete(fixture.link); fixture.links.delete(fixture.link); fixture.linkTargets.delete(fixture.link);
    fixture.put(renamed, ""); fixture.links.add(renamed); fixture.linkTargets.set(renamed, fixture.linkTarget);
    fixture.put(fixture.manifestFile, { ...fixture.manifest, bin: { "semver-command": "bin/semver.js" } });
    fixture.installed[fixture.packageKey].bin = { "semver-command": "bin/semver.js" }; fixture.syncLocks();
    assert.notDeepEqual(fixture.api.localVerificationInstalledRuntimePackages(["pkg"], true), before);
  });
  for (const target of ["/outside/semver.js", "../../semver/bin/semver.js", "../semver/../escape.js", "../semver/bin/./semver.js",
    "../semver//bin/semver.js", "..\\semver\\bin\\semver.js", "../semver/bin/%2e%2e/semver.js"]) {
    check("actual Admission rejects noncanonical npm bin target " + target, () => {
      const fixture = runtimeBinFixture(); fixture.linkTargets.set(fixture.link, target);
      assert.throws(() => fixture.api.localVerificationInstalledRuntimePackages(["pkg"], true), /Runtime bin/u);
    });
  }
  const binMutations: Array<[string, (fixture: ReturnType<typeof runtimeBinFixture>) => void]> = [
    ["ordinary package link", fixture => { const file = path.join(fixture.directory, "pkg", "linked.js"); fixture.put(file, ""); fixture.links.add(file); fixture.linkTargets.set(file, fixture.linkTarget); }],
    ["linked nested modules ancestor", fixture => fixture.links.add(fixture.modules)],
    ["linked bin directory", fixture => fixture.links.add(path.dirname(fixture.link))],
    ["linked target package", fixture => fixture.links.add(fixture.packageDirectory)],
    ["linked target ancestor", fixture => fixture.links.add(path.dirname(fixture.target))],
    ["chained or cyclic target", fixture => { fixture.links.add(fixture.target); fixture.linkTargets.set(fixture.target, "../../.bin/semver"); }],
    ["linked target manifest", fixture => fixture.links.add(fixture.manifestFile)],
    ["linked installed lock", fixture => fixture.links.add(path.join(fixture.directory, ".package-lock.json"))],
    ["linked project lock", fixture => fixture.links.add(path.join(memoryRoot, "package-lock.json"))],
    ["missing target", fixture => fixture.files.delete(fixture.target)],
    ["directory target", fixture => { fixture.files.delete(fixture.target); fixture.put(path.join(fixture.target, "child.js"), "directory"); }],
    ["wrong package name", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, name: "other" })],
    ["wrong package version", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, version: "9.0.0" })],
    ["missing bin mapping", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, bin: undefined })],
    ["wrong command name", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, bin: { other: "bin/semver.js" } })],
    ["wrong declared target", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, bin: { semver: "other.js" } })],
    ["ambiguous command mapping", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, bin: { ...fixture.manifest.bin, other: "bin/semver.js" } })],
    ["unsupported string bin", fixture => fixture.put(fixture.manifestFile, { ...fixture.manifest, bin: "bin/semver.js" })],
    ["missing installed package", fixture => { delete fixture.installed[fixture.packageKey]; fixture.syncLocks(); }],
    ["linked lock package", fixture => { fixture.installed[fixture.packageKey].link = true; fixture.syncLocks(); }],
    ["mismatched project bin", fixture => { const locked = structuredClone(fixture.installed); locked[fixture.packageKey].bin = { semver: "other.js" }; fixture.put(path.join(memoryRoot, "package-lock.json"), { packages: locked }); }],
    ["mismatched installed bin", fixture => { fixture.installed[fixture.packageKey].bin = { other: "bin/semver.js" }; fixture.syncLocks(); }],
    ["mismatched package integrity", fixture => { const locked = structuredClone(fixture.installed); locked[fixture.packageKey].integrity = "different"; fixture.put(path.join(memoryRoot, "package-lock.json"), { packages: locked }); }],
  ];
  for (const [name, mutate] of binMutations) check("actual Admission npm bin rejects " + name, () => {
    const fixture = runtimeBinFixture(); mutate(fixture);
    assert.throws(() => fixture.api.localVerificationInstalledRuntimePackages(["pkg"], true), /unqualified link|Runtime bin|Missing controlled file/u);
  });
  for (const file of ["target", "metadata"] as const) check("actual Admission npm bin bounds " + file + " reads", () => {
    const fixture = runtimeBinFixture(); fixture.files.set(file === "target" ? fixture.target : path.join(fixture.directory, ".package-lock.json"), { length: 96 * 1024 * 1024 + 1 } as Buffer);
    assert.throws(() => fixture.api.localVerificationInstalledRuntimePackages(["pkg"], true), /bounded read budget/u);
  });
  type Qualification = import("./lib/isolated-public-verification.mts").LocalVerificationAdmissionQualification;
  type Binding = { baselineHead: string; finalHead: string; sourceSha256: string };
  type Inputs = import("./lib/isolated-public-verification.mts").LocalVerificationInputs;
  type InputRequest = import("./lib/isolated-public-verification.mts").PublicGateRequest;
  type InputImpact = import("./lib/isolated-public-verification.mts").LocalVerificationImpact;
  type PrivateDiscovery = Binding & { additionalSourceFiles: readonly string[]; changes: Inputs["changes"]; changeImpact: NonNullable<Inputs["changeImpact"]> };
  type ControlledInvocation = { sourceDiscovery?: PrivateDiscovery; sourceDiscoverySha256: string;
    sourceFloor: { checks: Array<{ limitMs: number; result: { code: number } }> }; sourceFloorSha256: string };
  const executorCode = compile(orderedSourceFloorControlSource(tree) + "\n" + ["localVerificationAdmissionInvocations", "localVerificationCommandSteps", "registeredVerificationNodeEntries",
    "assertLocalVerificationAdmissionQualification", "qualifyLocalVerificationAdmission", "readLocalVerificationInputs"].map(declaration).join("\n"));
  const executorFixture = (options: { raw?: "wrong-nonce" | "missing-schema" | "corrupt"; nonzero?: boolean; nativeFailure?: boolean; validatorFailure?: boolean;
    childFailure?: boolean; cleanupFailure?: boolean; floorTypeScriptFailure?: boolean; budgetAncestorFailure?: boolean;
    governance?: "qualified" | "unqualified" | "missing" | "failed" | "missing-marker";
    qualifiedTargets?: ReturnType<typeof import("./lib/isolated-public-verification.mts").qualifyLocalVerificationTargets>; mutateAdditional?: () => void } = {}) => {
    const files = new Map<string, Buffer>(), links = new Set<string>(), fs = memory(files, links), baselineHead = "a".repeat(40);
    const entries = ["scripts/verify-admin-form-system.mts", "scripts/verify-page-block-editor-presentation.mts", "scripts/verify-isolated-supabase.mts"];
    const sources = new Map<string, Buffer>(entries.map(entry => [entry, Buffer.from('import value from "jiti"; export const controlled = value;')]));
    sources.set("scripts/lib/windows-owned-process.cs", Buffer.from("controlled native source"));
    sources.set("package.json", Buffer.from(JSON.stringify({ scripts: { lint: "eslint --max-warnings=0", typecheck: "tsc --noEmit",
      ...Object.fromEntries(entries.map((entry, index) => ["verify:controlled-" + index, "node --experimental-strip-types " + entry])) } })));
    for (const [file, bytes] of sources) files.set(path.join(memoryRoot, file), bytes);
    const selected = [...sources.keys()].sort(), runtime = { node: "controlled-node", dependencySha256: "d".repeat(64) };
    let head = "b".repeat(40), inspections = 0, coldDiscoveries = 0;
    const changedFiles: string[] = [], coverageRequests: string[] = [];
    const sourceSha = () => sha256(JSON.stringify(selected.map(file => ({ file, sha256: sha256(files.get(path.join(memoryRoot, file))!) }))));
    const binding = (): Binding => ({ baselineHead, finalHead: head, sourceSha256: sourceSha() });
    const discovered: NonNullable<Inputs["changeImpact"]> = { proofBoundary: "source_discovery_only", sourceSha256: sourceSha(), deltaSha256: sha256("[]"),
      changes: [], obligations: [], protections: [], qaQuality: [] };
    const launches: Array<{ args: string[]; limitMs: number }> = [], floorLaunches: string[] = [], stops: string[] = [], observedPackages: string[][] = [], gitCalls: string[][] = [];
    const nativePath = path.join(memoryRoot, ".tmp-qa", "admission-qualification-controlled", "input.native-result.json");
    const api = new Function("assert", "ROOT", "digest", "process", "execFileSync", "inspectLocalVerificationChangeImpact", "selectSourceInventory", "sourceIncluded", "safeSourcePath",
      "existsSync", "lstatSync", "realpathSync", "readFileSync", "collectExecutableSourceGraph", "ts", "nodeModule", "localVerificationAdmissionRuntimeIdentity", "resolve", "join", "sep",
      "mkdirSync", "mkdtempSync", "runOwnedVerificationChild", "validateLocalVerificationAssertionRelocations", "validateLocalVerificationInputObservations", "stopChild", "readdirSync", "receipt",
      "localVerificationNativeGate", "localVerificationCoverage", "deriveLocalVerificationSourceImpact",
      executorCode + ";return {qualifyLocalVerificationAdmission,assertQualified:assertLocalVerificationAdmissionQualification,readInputs:readLocalVerificationInputs,privateInvocation:value=>localVerificationAdmissionInvocations.get(value),privateInvocations:localVerificationAdmissionInvocations};")(
      assert, memoryRoot, sha256, { platform: "win32", env: {}, execPath: "controlled-node", version: "controlled-node-version", versions: { v8: "controlled-v8" }, execArgv: [] }, (_command: string, args: string[]) => {
        gitCalls.push(args);
        if (args[0] === "ls-files") return Buffer.from(selected.join("\0") + "\0");
        if (args[0] === "rev-parse") return Buffer.from(args.includes("--verify") ? baselineHead : head);
        if (args[0] === "merge-base") {
          if (options.budgetAncestorFailure && args[2] === "9edaf02f4cd476315d71b306d5f786f3d8d1efd0") throw Error("Controlled operational scope ancestor mismatch");
          return Buffer.alloc(0);
        }
        if (args[0] === "ls-tree") return Buffer.from(selected.join("\0") + "\0");
        if (args[0] === "diff") return Buffer.from(changedFiles.length ? changedFiles.join("\0") + "\0" : "");
        if (args[0] === "show") { const bytes = sources.get(args[1]!.slice(41)); assert.ok(bytes); return bytes; }
        throw Error("Unexpected controlled Git operation.");
      }, () => { inspections++; return { ...binding(), changeImpact: discovered, fast: { correspondence: [{ protected: true }] }, actualDelta: [],
        ...(options.qualifiedTargets ? { qualifiedTargets: structuredClone(options.qualifiedTargets) } : options.governance ? { qualifiedTargets: {
          selections: [{ family: "controlled-source-guard", selected: true, qualified: !["unqualified", "missing"].includes(options.governance), reason: options.governance }],
          blocking: ["unqualified", "missing"].includes(options.governance) ? ["controlled_unqualified_effect"] : [],
          targets: ["unqualified", "missing"].includes(options.governance) ? [] : [{ kind: "source_guard", step: "node --experimental-strip-types scripts/controlled-governance.mts", limitMs: 180_000, successMarker: "GOVERNANCE_CONTROL_PASS" }],
        } } : {}) }; },
      () => selected, (file: string) => entries.includes(file), (file: string) => path.join(memoryRoot, file), fs.exists, fs.stat, fs.real, fs.read,
      () => new Map(entries.map(entry => [entry, ts.createSourceFile(entry, sources.get(entry)!.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)])),
      ts, { isBuiltin }, (names: Iterable<string>) => { observedPackages.push([...names].sort()); return { ...runtime }; }, path.resolve, path.join, path.sep,
      fs.mkdir, (prefix: string) => { const directory = prefix + "controlled"; fs.mkdir(directory); return directory; },
      async (ports: { children: Set<ChildProcess> }, args: string[], env: Record<string, string>, name: string, limitMs: number) => {
        if (name.startsWith("ordered-")) {
          assert.ok(name === "ordered-1-eslint" || name === "ordered-2-typescript" || options.governance && name === "ordered-3-governance");
          floorLaunches.push(name);
          const code = options.floorTypeScriptFailure && name === "ordered-2-typescript" ? 2 : options.governance === "failed" && name === "ordered-3-governance" ? 9 : 0;
          return { code, rawExit: { code, signal: null }, stdout: name === "ordered-3-governance" && options.governance !== "missing-marker" ? "GOVERNANCE_CONTROL_PASS" : "",
            cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true } };
        }
        launches.push({ args, limitMs }); const entry = args[1]!, nonce = options.raw === "wrong-nonce" ? "old-nonce" : env.VENESIA_QA_ADMISSION_NONCE;
        if (launches.length === 1) options.mutateAdditional?.();
        const raw = { schema: options.raw === "missing-schema" ? undefined : 1, kind: entry === entries[2] ? "verification-input-observations" : "assertion-relocation-observations",
          nonce, consumer: entry, entry, artifacts: [] as Array<{ path: string; sha256: string }> };
        files.set(nativePath, Buffer.from("controlled native cleanup PASS"));
        if (entry === entries[2]) raw.artifacts.push({ path: path.relative(memoryRoot, nativePath).replaceAll("\\", "/"), sha256: sha256(files.get(nativePath)!) });
        const stdout = options.raw === "corrupt" ? "{bad-json" : entry === entries[2] ? JSON.stringify({ status: "PASS", rawObservations: raw }) : JSON.stringify(raw) + "\n";
        const code = options.nonzero || options.childFailure ? 7 : 0;
        const native = { jobToken: "controlled-job", rootPid: 42, status: "PASS", reason: "completed", rootExitCode: code, nativeFailure: null,
          cleanup: { activeProcessesAfterCleanup: options.nativeFailure ? 1 : 0, activeProcessIdsAfterCleanup: options.nativeFailure ? [42] : [], rootHandleExited: true, jobHandleClosed: true } };
        const value = { code, rawExit: { code, signal: null }, stdout, stderr: "", cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true }, helperExit: { code: 0, signal: null },
          nativeJobIdentity: { rootPid: 42, jobToken: "controlled-job", ownerJobAssignedBeforeResume: true, jobHandleNonInheritable: true, effectiveLimitFlags: 0x2000, jobBeforeResume: { processIds: [42] } },
          nativeJobReceipt: native, nativeCapability: { sourceSha256: sha256(sources.get("scripts/lib/windows-owned-process.cs")!) } };
        for (const [extension, bytes] of [["stdout.log", stdout], ["stderr.log", ""], ["native-result.json", JSON.stringify(native)]] as const)
          files.set(path.join(memoryRoot, ".tmp-qa", "admission-qualification-controlled", "public-" + name + "." + extension), Buffer.from(bytes));
        if (options.childFailure) {
          ports.children.add(new EventEmitter() as ChildProcess);
          throw Object.assign(Error("Controlled owned-child failure"), { childResult: value });
        }
        return value;
      }, () => ({ status: options.validatorFailure ? "BLOCKED" : "PASS", relocations: [], providers: [] }), () => ({ status: "PASS", coverage: [] }),
      async (_child: unknown, _env: unknown, reason: string) => { stops.push(reason); if (options.cleanupFailure) throw Error("Controlled owned-child cleanup failure"); }, fs.list,
      (context: { runDirectory: string }, name: string, value: unknown) => fs.write(path.join(context.runDirectory, name), JSON.stringify(value)),
      (request: InputRequest) => request.selection === "admin-adoption" ? { name: "admin-adoption", script: "scripts/qa-admin-adoption-journeys.mjs", args: [], limitMs: 900_000 } : undefined,
      (_scripts: unknown, _impact: unknown, _manifest: unknown, request: InputRequest) => { coverageRequests.push(request.selection ?? "default"); return []; },
      () => { coldDiscoveries++; return structuredClone(discovered); }) as {
        qualifyLocalVerificationAdmission: typeof import("./lib/isolated-public-verification.mts").qualifyLocalVerificationAdmission;
        assertQualified(value: Qualification, binding: Binding): void;
        readInputs(context: { cleanEnvironment(): NodeJS.ProcessEnv }, impact: InputImpact, manifest: Array<{ file: string; sha256: string }>, additional: readonly string[], request: InputRequest, previous?: Inputs): Inputs;
        privateInvocation(value: Qualification): ControlledInvocation;
        privateInvocations: WeakMap<Qualification, ControlledInvocation>;
      };
    const manifest = () => selected.map(file => ({ file, sha256: sha256(files.get(path.join(memoryRoot, file))!) }));
    const readQualified = (value: Qualification, additional: string[] = [], request: Partial<InputRequest> = {}, previous?: Inputs) =>
      api.readInputs({ cleanEnvironment: () => ({ NODE_ENV: "test" }) }, { ...binding(), changes: [] }, manifest(), additional,
        { additionalSourceFiles: additional, admissionQualification: value, ...request }, previous);
    return { api, binding, files, links, nativePath, runtime, launches, floorLaunches, stops, observedPackages, gitCalls, discovered, changedFiles, selected, manifest, readQualified,
      coverageRequests, coldDiscoveries: () => coldDiscoveries, head: (value: string) => { head = value; }, inspections: () => inspections };
  };
  const qualify = (api: Pick<typeof import("./lib/isolated-public-verification.mts"), "qualifyLocalVerificationAdmission">, signal = new AbortController().signal) =>
    api.qualifyLocalVerificationAdmission({ baselineHead: "a".repeat(40) }, signal);
  const control = async (name: string, run: () => Promise<void>) => { try { await run(); } catch (error) { console.error("FAIL " + name); throw error; } cases.push(name); };
  await control("actual Admission executor seals only its unique completed source-bound profiles and live authority", async () => {
    const fixture = executorFixture(), value = await qualify(fixture.api); assert.equal(value.status, "PASS"); fixture.api.assertQualified(value, fixture.binding());
    assert.deepEqual(fixture.floorLaunches, ["ordered-1-eslint", "ordered-2-typescript"]);
    assert.equal(fixture.launches.length, 3); assert.equal(new Set(fixture.launches.map(row => row.args.join(" "))).size, 3);
    assert.ok(fixture.launches.every(row => Number.isSafeInteger(row.limitMs) && row.limitMs > 0 && row.limitMs <= 2_147_483_647));
    assert.ok(fixture.observedPackages.every(names => ["typescript", "react", "react-dom", "jiti"].every(name => names.includes(name))));
    assert.equal(value.behavioralPass, false); assert.equal(value.releaseEvidence, false); assert.equal(value.failures.length, 0);
    assert.equal(Object.hasOwn(value, "operationalBudget"), false); assert.ok(fixture.launches.every(row => row.limitMs === 300_000));
    assert.throws(() => fixture.api.assertQualified(JSON.parse(JSON.stringify(value)) as Qualification, fixture.binding()), /live qualified execution/u);
  });
  await control("actual Admission binds the exact temporary operational scope to fresh floor profiles ancestry and immutable live receipt", async () => {
    const fixture = executorFixture({ governance: "qualified" }), operationalBudget = "pr229-20261103-double-operational" as const;
    const value = await fixture.api.qualifyLocalVerificationAdmission({ baselineHead: "a".repeat(40), operationalBudget }, new AbortController().signal);
    assert.equal(value.status, "PASS"); assert.equal(value.operationalBudget, operationalBudget); fixture.api.assertQualified(value, fixture.binding());
    assert.ok(fixture.gitCalls.some(args => JSON.stringify(args) === JSON.stringify(["merge-base", "--is-ancestor", "9edaf02f4cd476315d71b306d5f786f3d8d1efd0", "HEAD"])));
    assert.deepEqual(fixture.api.privateInvocation(value).sourceFloor.checks.map(row => row.limitMs), [3_600_000, 3_600_000, 360_000]);
    assert.deepEqual(fixture.launches.map(row => row.limitMs), [600_000, 600_000, 600_000]);
    delete value.operationalBudget; assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /altered after qualification/u);
    value.operationalBudget = "unapproved" as typeof operationalBudget; assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /altered after qualification/u);
    // Re-insertion changes the exact serialized receipt order; restoring the value
    // alone must not revive an invocation whose sealed bytes were altered.
    value.operationalBudget = operationalBudget;
    assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /altered after qualification/u);
    assert.throws(() => fixture.api.assertQualified(JSON.parse(JSON.stringify(value)) as Qualification, fixture.binding()), /live qualified execution/u);
    const ordinary = executorFixture(), normal = await qualify(ordinary.api); normal.operationalBudget = operationalBudget;
    assert.throws(() => ordinary.api.assertQualified(normal, ordinary.binding()), /altered after qualification/u);
  });
  await control("actual Admission rejects a foreign operational scope or ancestry before source discovery and child allocation", async () => {
    const foreign = executorFixture();
    await assert.rejects(foreign.api.qualifyLocalVerificationAdmission({ operationalBudget: "unapproved" as Qualification["operationalBudget"] }, new AbortController().signal), /Unknown temporary operational budget/u);
    assert.equal(foreign.inspections(), 0); assert.deepEqual(foreign.launches, []); assert.deepEqual(foreign.floorLaunches, []);
    const ancestry = executorFixture({ budgetAncestorFailure: true });
    await assert.rejects(ancestry.api.qualifyLocalVerificationAdmission({ operationalBudget: "pr229-20261103-double-operational" }, new AbortController().signal), /Controlled operational scope ancestor mismatch/u);
    assert.equal(ancestry.inspections(), 0); assert.deepEqual(ancestry.launches, []); assert.deepEqual(ancestry.floorLaunches, []);
  });
  await control("actual Admission TypeScript failure prevents every heavy profile and preserves the source-floor exit", async () => {
    const fixture = executorFixture({ floorTypeScriptFailure: true }), value = await qualify(fixture.api);
    assert.equal(value.status, "BLOCKED"); assert.deepEqual(value.executions, []); assert.deepEqual(fixture.launches, []);
    assert.deepEqual(fixture.floorLaunches, ["ordered-1-eslint", "ordered-2-typescript"]);
    assert.ok(value.failures.some(failure => failure.includes("Ordered typescript check failed")));
    const saved = JSON.parse(fixture.files.get(path.join(memoryRoot, ".tmp-qa", "admission-qualification-controlled", "ordered-source-floor-failure.json"))!.toString()) as { childResult: { code: number; rawExit: { code: number; signal: null } } };
    assert.equal(saved.childResult.code, 2); assert.deepEqual(saved.childResult.rawExit, { code: 2, signal: null });
    assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /live qualified execution/u);
  });
  await control("actual Admission records qualified Governance before executing its selected leaf and profiles", async () => {
    const fixture = executorFixture({ governance: "qualified" }), value = await qualify(fixture.api);
    assert.equal(value.status, "PASS"); fixture.api.assertQualified(value, fixture.binding());
    assert.deepEqual(fixture.floorLaunches, ["ordered-1-eslint", "ordered-2-typescript", "ordered-3-governance"]); assert.equal(fixture.launches.length, 3);
    const evidence = JSON.parse(fixture.files.get(path.join(value.runDirectory, "governance-qualification.json"))!.toString()) as Binding & { status: string; selections: Array<{ qualified: boolean }> };
    assert.equal(evidence.status, "PASS"); assert.equal(evidence.selections[0]!.qualified, true);
    assert.equal(evidence.finalHead, value.finalHead); assert.equal(evidence.sourceSha256, value.sourceSha256);
  });
  for (const governance of ["unqualified", "missing", "failed", "missing-marker"] as const) {
    await control("actual Admission refuses " + governance + " Governance without starting profiles or granting live authority", async () => {
      const fixture = executorFixture({ governance }), value = await qualify(fixture.api);
      assert.equal(value.status, "BLOCKED"); assert.deepEqual(value.executions, []); assert.deepEqual(fixture.launches, []);
      assert.equal(fixture.floorLaunches.includes("ordered-3-governance"), governance === "failed" || governance === "missing-marker");
      assert.ok(value.failures.length > 0); assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /live qualified execution/u);
      const evidence = JSON.parse(fixture.files.get(path.join(value.runDirectory, "governance-qualification.json"))!.toString()) as { status: string };
      assert.equal(evidence.status, governance === "unqualified" || governance === "missing" ? "BLOCKED" : "PASS");
    });
  }
  const selectorApi = new Function("assert", compile(declaration("localVerificationCommandSteps") + "\n" + declaration("qualifyLocalVerificationTargets"))
    + ";return {qualifyLocalVerificationTargets};")(assert) as Pick<typeof import("./lib/isolated-public-verification.mts"), "qualifyLocalVerificationTargets">;
  const repositoryScripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;
  const selectionAnalysis: NonNullable<Inputs["changeImpact"]> = { proofBoundary: "source_discovery_only", sourceSha256: "a".repeat(64), deltaSha256: "b".repeat(64),
    ownerBindings: [], obligations: [], protections: [], changes: [{ file: "scripts/fixtures/controlled-runtime-context.mts", owners: [], capabilities: [], consumers: [], contracts: [],
      candidateChecks: ["verify:executable-governance", "verify:verification-infrastructure"], unresolved: [], semanticChange: true, presentationOnly: false }] };
  const retiredAlpineEffects = {
    "scripts/verify-executable-governance.mts": "f5f8d2bdd3b5bc3fc9970c8635e481ce2d3577783adec7d474fd46e73e899dee",
    "scripts/verify-verification-infrastructure.mts": "96c02fd6676dfc6140a75f618fb240613091cf63bf27d8ff0c6c1a52ceaaba33",
  };
  for (const [name, effects] of [["unknown", Object.fromEntries(Object.keys(retiredAlpineEffects).map(entry => [entry, "f".repeat(64)]))],
    ["retired Alpine", retiredAlpineEffects]] as const) {
    await control("actual rejected " + name + " selector stops Admission before Governance or profiles and preserves the failure", async () => {
      const targets = selectorApi.qualifyLocalVerificationTargets(repositoryScripts, selectionAnalysis,
        sha256(readSource("scripts/qa-admin-form-guarded-navigation.mts").replaceAll("\r\n", "\n")), effects);
      assert.deepEqual(targets.targets, []); assert.equal(targets.selections.filter(row => row.selected && !row.qualified).length, 2);
      const fixture = executorFixture({ qualifiedTargets: targets }), value = await qualify(fixture.api);
      assert.equal(value.status, "BLOCKED"); assert.deepEqual(value.executions, []); assert.deepEqual(fixture.launches, []);
      assert.deepEqual(fixture.floorLaunches, ["ordered-1-eslint", "ordered-2-typescript"]);
      assert.ok(value.failures.length > 0); assert.equal(fixture.api.privateInvocation(value), undefined);
      assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /live qualified execution/u);
      const evidence = JSON.parse(fixture.files.get(path.join(value.runDirectory, "governance-qualification.json"))!.toString()) as { status: string; blocking: string[] };
      assert.equal(evidence.status, "BLOCKED"); assert.deepEqual(evidence.blocking, targets.blocking);
      const failure = JSON.parse(fixture.files.get(path.join(value.runDirectory, "ordered-source-floor-failure.json"))!.toString()) as {
        status: string; completed: Array<{ stage: string; code: number }>; childResult: unknown; dependentVerificationStarted: boolean };
      assert.equal(failure.status, "BLOCKED"); assert.equal(failure.dependentVerificationStarted, false); assert.equal(failure.childResult, null);
      assert.deepEqual(failure.completed.map(row => [row.stage, row.code]), [["eslint", 0], ["typescript", 0]]);
      assert.ok(value.artifacts.some(row => row.path.endsWith("/ordered-source-floor-failure.json")));
    });
  }
  await control("actual Admission authority rejects mutated receipts stale bindings runtime dependencies and altered native artifacts", async () => {
    const fixture = executorFixture(), value = await qualify(fixture.api); assert.equal(value.status, "PASS");
    const invocation = fixture.api.privateInvocation(value), sourceCode = invocation.sourceFloor.checks[0].result.code;
    invocation.sourceFloor.checks[0].result.code = 99;
    assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /Private ordered source floor was altered/u);
    invocation.sourceFloor.checks[0].result.code = sourceCode;
    for (const key of ["nonce", "sourceSha256", "baselineHead", "finalHead"] as const) {
      const prior = value[key]; value[key] = "altered"; assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /altered after qualification/u); value[key] = prior;
    }
    for (const key of ["baselineHead", "finalHead", "sourceSha256"] as const) assert.throws(() => fixture.api.assertQualified(value, { ...fixture.binding(), [key]: "0".repeat(key === "sourceSha256" ? 64 : 40) }), /stale source or baseline/u);
    fixture.runtime.dependencySha256 = "e".repeat(64); assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /runtime or dependency bytes changed/u); fixture.runtime.dependencySha256 = "d".repeat(64);
    fixture.runtime.node = "other-node"; assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /runtime or dependency bytes changed/u); fixture.runtime.node = "controlled-node";
    fixture.head("c".repeat(40)); assert.throws(() => fixture.api.assertQualified(value, { ...fixture.binding(), finalHead: "b".repeat(40) })); fixture.head("b".repeat(40));
    const raw = fixture.files.get(fixture.nativePath)!; fixture.files.set(fixture.nativePath, Buffer.from("altered native cleanup"));
    assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /missing or corrupt/u); fixture.files.set(fixture.nativePath, raw);
    fixture.files.delete(fixture.nativePath); assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /Missing controlled file/u); fixture.files.set(fixture.nativePath, raw);
    fixture.links.add(fixture.nativePath); assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /cannot traverse links/u);
  });
  await control("actual reader reuses only privately cloned preallocation facts while deriving current request coverage and native selection", async () => {
    const fixture = executorFixture(), value = await qualify(fixture.api); assert.equal(value.status, "PASS");
    fixture.discovered.deltaSha256 = "e".repeat(64);
    const first = fixture.readQualified(value);
    assert.equal(first.changeImpact!.deltaSha256, sha256("[]"), "Mutation of the inspector's returned object cannot alter the private clone.");
    (first.changeImpact as { deltaSha256: string }).deltaSha256 = "f".repeat(64);
    const second = fixture.readQualified(value, [], { selection: "admin-adoption" });
    assert.equal(second.changeImpact!.deltaSha256, sha256("[]"), "Mutation of a returned reader fact cannot alter the private clone.");
    assert.equal(first.verificationNativeGate, undefined); assert.equal(second.verificationNativeGate?.name, "admin-adoption");
    assert.deepEqual(fixture.coverageRequests, ["default", "admin-adoption"]); assert.equal(fixture.coldDiscoveries(), 0);
    assert.throws(() => fixture.readQualified(value, [], { selection: "admin-adoption" }, first), /selected native tail/u);
    assert.throws(() => fixture.readQualified(JSON.parse(JSON.stringify(value)) as Qualification), /live qualified execution/u);
    assert.equal(fixture.coldDiscoveries(), 0);
  });
  await control("actual reader rejects missing corrupt and mismatched private discovery without falling back to cold analysis", async () => {
    for (const failure of ["missing", "corrupt", "baselineHead", "finalHead", "sourceSha256"] as const) {
      const fixture = executorFixture(), value = await qualify(fixture.api), invocation = fixture.api.privateInvocation(value);
      assert.ok(invocation.sourceDiscovery);
      if (failure === "missing") delete invocation.sourceDiscovery;
      else if (failure === "corrupt") invocation.sourceDiscovery.changeImpact.deltaSha256 = "f".repeat(64);
      else {
        invocation.sourceDiscovery[failure] = "f".repeat(failure === "sourceSha256" ? 64 : 40);
        invocation.sourceDiscoverySha256 = sha256(JSON.stringify(invocation.sourceDiscovery));
      }
      assert.throws(() => fixture.readQualified(value), /private preallocation source discovery/iu);
      assert.equal(fixture.coldDiscoveries(), 0); assert.equal(fixture.coverageRequests.length, 0);
    }
  });
  await control("actual reader rejects explicit tracked-file and exact Git delta changes under an otherwise identical manifest", async () => {
    const fixture = executorFixture(), value = await qualify(fixture.api), manifestBefore = fixture.manifest();
    assert.throws(() => fixture.readQualified(value, [fixture.selected[0]!]), /explicit additional files/u);
    assert.deepEqual(fixture.manifest(), manifestBefore);
    fixture.changedFiles.push(fixture.selected[0]!);
    assert.throws(() => fixture.readQualified(value), /exact Git and explicit-file delta/u);
    assert.equal(fixture.coldDiscoveries(), 0); assert.equal(fixture.coverageRequests.length, 0);
  });
  await control("actual Admission snapshots explicit input identity before asynchronous profile execution", async () => {
    const additional: string[] = [];
    const fixture = executorFixture({ mutateAdditional: () => { additional.push("scripts/verify-admin-form-system.mts"); } });
    const value = await fixture.api.qualifyLocalVerificationAdmission({ baselineHead: "a".repeat(40), additionalSourceFiles: additional }, new AbortController().signal);
    assert.equal(value.status, "PASS"); assert.equal(additional.length, 1);
    assert.deepEqual(fixture.api.privateInvocation(value).sourceDiscovery?.additionalSourceFiles, []);
    assert.equal(fixture.readQualified(value).changeImpact?.proofBoundary, "source_discovery_only");
    assert.throws(() => fixture.readQualified(value, additional), /explicit additional files/u);
    assert.equal(fixture.coldDiscoveries(), 0);
  });
  await control("actual live Final Quality admission rejects absent preallocation qualification without adding a bounded-source gate", async () => {
    let ownershipReads = 0;
    const stop = Error("Controlled ownership boundary; no resource allocation");
    const qualificationFixture = executorFixture(), qualified = await qualify(qualificationFixture.api);
    const run = new Function("assert", "digest", "localVerificationAdmissionInvocations", "ownedProcessCleanupQualification", "assertLocalVerificationAdmissionQualification", compile(declaration("localVerificationOperationalDeadlineMs") + "\n" + declaration("runOwnedPublicVerification")) + ";return runOwnedPublicVerification;")(
      assert, sha256, qualificationFixture.api.privateInvocations, () => ({ fullEProcessCleanupQualified: true }), qualificationFixture.api.assertQualified) as typeof import("./lib/isolated-public-verification.mts").runOwnedPublicVerification;
    const context: Parameters<typeof run>[0] = { runDirectory: root, apiPort: 57100,
      anonKey: "controlled-anon", serviceKey: "controlled-service",
      cleanEnvironment: () => ({ NODE_ENV: "test" }), sanitize: value => value,
      record: () => { throw stop; }, assertOwned: async () => { ownershipReads++; throw stop; } };
    const invoke = (request: Partial<InputRequest>) => run(context, { additionalSourceFiles: [], localVerification: {} as InputImpact, ...request }, new AbortController().signal, async () => undefined);
    await assert.rejects(invoke({ finalQualityGate: true }), /fresh live source qualification/u); assert.equal(ownershipReads, 0);
    await assert.rejects(invoke({}), /fresh live source qualification/u); assert.equal(ownershipReads, 0);
    await assert.rejects(invoke({ admissionQualification: JSON.parse(JSON.stringify(qualified)) as Qualification }), /live source qualification/u); assert.equal(ownershipReads, 0);
    const privateFloor = qualificationFixture.api.privateInvocation(qualified).sourceFloor, priorCode = privateFloor.checks[0].result.code;
    privateFloor.checks[0].result.code = 99;
    await assert.rejects(invoke({ admissionQualification: qualified }), /Private ordered source floor was altered/u); assert.equal(ownershipReads, 0);
    privateFloor.checks[0].result.code = priorCode;
    await assert.rejects(invoke({ admissionQualification: qualified }), error => error === stop); assert.equal(ownershipReads, 1);
  });
  await control("actual Admission executor retains missing corrupt stale nonzero and undrained-native failures without sealing", async () => {
    for (const options of [{ raw: "wrong-nonce" }, { raw: "missing-schema" }, { raw: "corrupt" }, { nonzero: true }, { nativeFailure: true }, { validatorFailure: true },
      { childFailure: true }, { childFailure: true, cleanupFailure: true }] as const) {
      const fixture = executorFixture(options), value = await qualify(fixture.api); assert.equal(value.status, "BLOCKED"); assert.ok(value.failures.length > 0);
      assert.throws(() => fixture.api.assertQualified(value, fixture.binding()), /live qualified execution/u);
      if ("validatorFailure" in options) assert.equal(fixture.launches.length, 3); else assert.equal(fixture.launches.length, 1);
      if ("nonzero" in options) assert.equal((value.executions[0]!.result as { rawExit: { code: number } }).rawExit.code, 7);
      if ("childFailure" in options) { assert.deepEqual(fixture.stops, ["owner_shutdown"]); assert.equal((value.executions[0]!.result as { rawExit: { code: number } }).rawExit.code, 7); }
      if ("cleanupFailure" in options) assert.ok(value.failures.some(failure => failure.includes("cleanup failure")) && value.failures.some(failure => failure.includes("undrained")));
    }
    const fixture = executorFixture(), controller = new AbortController(), original = Error("Pre-aborted Admission"); controller.abort(original);
    await assert.rejects(qualify(fixture.api, controller.signal), error => error === original); assert.equal(fixture.inspections(), 0); assert.equal(fixture.launches.length, 0);
  });
  // Prepare a fresh actual-executor control fixture after every adversary. Keep its
  // private authority in this process; it is not a current runtime Admission receipt.
  const requestFixture = executorFixture(), requestQualification = await qualify(requestFixture.api);
  assert.equal(requestQualification.status, "PASS"); requestFixture.api.assertQualified(requestQualification, requestFixture.binding());
  return { status: "PASS", actualOsProcessesExecuted: false, actualFilesWritten: false, sourceOwnerSha256: sha256(source),
    requestGuardAdmission: { qualification: requestQualification, privateInvocations: requestFixture.api.privateInvocations } };
}

/** Actual deadline/child declarations with controlled ports; no native process or filesystem allocation. */
async function verifyAdoptionDeadlineControls() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = (name: string) => {
    const node = file.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
    assert.ok(node?.body, "Missing actual deadline owner declaration: " + name); return node;
  };
  const budgetNode = declaration("localVerificationQualityPrefixDeadlineMs");
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadBudget = (text = budgetNode.getText(file)) => new Function(compile(text.replace(/^export /u, ""))
    + ";return localVerificationQualityPrefixDeadlineMs;")() as () => number;
  const budgetApi = { localVerificationQualityPrefixDeadlineMs: loadBudget() };
  const operationalBudgetNode = declaration("localVerificationOperationalDeadlineMs");
  const operationalApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "localVerificationOperationalDeadlineMs"> = {
    localVerificationOperationalDeadlineMs: new Function("assert", compile(operationalBudgetNode.getText(file).replace(/^export /u, ""))
      + ";return localVerificationOperationalDeadlineMs;")(assert) as typeof import("./lib/isolated-public-verification.mts").localVerificationOperationalDeadlineMs,
  };
  const operationalDeadline = operationalApi.localVerificationOperationalDeadlineMs;
  const approvedOperationalBudget = "pr229-20261103-double-operational" as const;
  const requireActualBudget = (api: Pick<typeof import("./lib/isolated-public-verification.mts"), "localVerificationQualityPrefixDeadlineMs">) => {
    const value = api.localVerificationQualityPrefixDeadlineMs();
    assert.equal(value, 1_800_000, "Adoption consumes the unchanged canonical quality-prefix budget.");
    assert.ok(Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647);
    return value;
  };
  check("actual Adoption deadline is the finite timer-safe existing quality-prefix budget", () => {
    requireActualBudget(budgetApi);
    const returned = budgetNode.body!.statements.find(ts.isReturnStatement); assert.ok(returned?.expression);
    const original = budgetNode.getText(file), offset = returned.expression.getStart(file) - budgetNode.getStart(file);
    for (const replacement of ["180_000", "2_220_000", "Number.POSITIVE_INFINITY", "0.5"]) {
      const mutant = original.slice(0, offset) + replacement + original.slice(offset + returned.expression.getWidth(file));
      assert.notEqual(mutant, original);
      assert.throws(() => requireActualBudget({ localVerificationQualityPrefixDeadlineMs: loadBudget(mutant) }), assert.AssertionError);
    }
  });
  check("actual temporary operational budget doubles only its exact explicit scope and rejects invalid inputs or timer overflow", () => {
    assert.equal(operationalApi.localVerificationOperationalDeadlineMs(1_800_000), 1_800_000);
    assert.equal(operationalApi.localVerificationOperationalDeadlineMs(1_800_000, approvedOperationalBudget), 3_600_000);
    for (const limit of [1, 17, 300_000, 900_000, requireActualBudget(budgetApi), 2_220_000, 1_073_741_823]) {
      assert.equal(operationalApi.localVerificationOperationalDeadlineMs(limit), limit);
      assert.equal(operationalApi.localVerificationOperationalDeadlineMs(limit, approvedOperationalBudget), limit * 2);
    }
    assert.equal(operationalApi.localVerificationOperationalDeadlineMs(2_147_483_647), 2_147_483_647);
    for (const scope of ["", "pr229-20261103-double-operational-extra", "PR229-20261103-DOUBLE-OPERATIONAL", "pr229-20261103-double-operational ", null, 2, true, {}])
      assert.throws(() => operationalApi.localVerificationOperationalDeadlineMs(17, scope as typeof approvedOperationalBudget), assert.AssertionError);
    for (const scope of [undefined, approvedOperationalBudget]) {
      for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, 2_147_483_648])
        assert.throws(() => operationalApi.localVerificationOperationalDeadlineMs(limit, scope), assert.AssertionError);
    }
    for (const limit of [1_073_741_824, 2_147_483_647])
      assert.throws(() => operationalApi.localVerificationOperationalDeadlineMs(limit, approvedOperationalBudget), assert.AssertionError);
  });
  const run = declaration("runOwnedPublicVerification"), body = run.body!.statements.find(ts.isTryStatement); assert.ok(body);
  const prefix = body.tryBlock.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .find(node => node.name.getText(file) === "qualityPrefix"); assert.ok(prefix?.initializer);
  const prefixText = prefix.initializer.getText(file);
  const projectPrefix = (text = prefixText) => new Function("qualityScripts", "localVerificationQualityPrefixDeadlineMs", "localVerificationOperationalDeadlineMs", "operationalBudget", compile("return (" + text + ");")) as
    (checks: string[], budget: () => number, deadline: typeof operationalDeadline, scope?: typeof approvedOperationalBudget) => Array<{ qualityScript: string; limitMs: number }>;
  const project = projectPrefix();
  const gates = file.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(row => row.name.getText(file) === "GATES")); assert.ok(gates);
  const plan = new Function("assert", compile(gates.getText(file) + "\n" + declaration("finalQualityScriptNames").getText(file).replace(/^export /u, ""))
    + ";return finalQualityScriptNames;")(assert) as (scripts: Record<string, string>) => string[];
  const actualChecks = plan(JSON.parse(readSource("package.json")).scripts as Record<string, string>);
  assert.equal(actualChecks.filter(script => script === "verify:admin-runtime").length, 1);
  const requireProjection = (candidate: ReturnType<typeof projectPrefix>) => {
    const lookalikes = ["verify:admin-runtime-extra", "prefixverify:admin-runtime", "VERIFY:ADMIN-RUNTIME", "verify:admin-runtime ", "verify:admin-runtime:other"];
    for (const checks of [actualChecks, [...actualChecks].reverse(), ["verify:admin-runtime", ...actualChecks.filter(script => script !== "verify:admin-runtime")],
      [...lookalikes, "verify:admin-runtime"], ["verify:consumer-capability-adoption", "verify:executable-governance"], []]) {
      for (const scope of [undefined, approvedOperationalBudget]) for (const defaultBudget of [requireActualBudget(budgetApi), 731]) {
        let calls = 0;
        const rows = candidate(checks, () => { calls++; return defaultBudget; }, operationalDeadline, scope);
        assert.deepEqual(rows.map(row => row.qualityScript), checks);
        assert.equal(calls, checks.filter(script => script !== "verify:admin-runtime").length);
        assert.deepEqual(rows.map(row => row.limitMs), checks.map(script => (script === "verify:admin-runtime" ? 2_220_000 : defaultBudget) * (scope === undefined ? 1 : 2)),
          "Exact Admin Runtime and default owner budgets stay unchanged unless the explicit operational scope doubles their external allowance once.");
      }
    }
  };
  check("actual canonical quality-prefix projection preserves default deadlines and applies the exact operational scope once across every current check and reordered or lookalike inputs", () => {
    requireProjection(project);
    for (const mutant of [
      prefixText.replace('script === "verify:admin-runtime"', "index === " + actualChecks.indexOf("verify:admin-runtime")),
      prefixText.replace('script === "verify:admin-runtime"', 'script.startsWith("verify:admin-runtime")'),
      prefixText.replace('script === "verify:admin-runtime"', 'script.includes("verify:admin-runtime")'),
      prefixText.replace('script === "verify:admin-runtime"', 'script.trim().toLowerCase() === "verify:admin-runtime"'),
      prefixText.replace("2_220_000", "1_800_000"),
      prefixText.replace("localVerificationQualityPrefixDeadlineMs()", "1_800_000"),
      prefixText.replace(", operationalBudget)", ", undefined)"),
      prefixText.replace(", operationalBudget)", ', "pr229-20261103-double-operational")'),
      prefixText.replace(", operationalBudget)", ", operationalBudget) * 2"),
    ]) {
      assert.notEqual(mutant, prefixText);
      assert.throws(() => requireProjection(projectPrefix(mutant)), assert.AssertionError);
    }
    assert.throws(() => project(actualChecks, () => requireActualBudget(budgetApi), operationalDeadline, "unapproved" as typeof approvedOperationalBudget), assert.AssertionError);
  });
  const adminRuntimeDeadlineMs = project(["verify:admin-runtime"], () => requireActualBudget(budgetApi), operationalDeadline)[0]!.limitMs;
  const scopedDeadlines = project(["verify:consumer-capability-adoption", "verify:admin-runtime"], () => requireActualBudget(budgetApi), operationalDeadline, approvedOperationalBudget);
  const scopedAdoptionDeadlineMs = scopedDeadlines[0]!.limitMs, scopedAdminRuntimeDeadlineMs = scopedDeadlines[1]!.limitMs;
  type ControlledChild = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; pid: number; exitCode: number | null; signalCode: NodeJS.Signals | null };
  const code = compile(["ownedPath", "runOwnedVerificationChild"].map(name => declaration(name).getText(file).replace(/^export /u, "")).join("\n"));
  const proofs: Array<Record<string, unknown>> = [];
  const fixture = (fault?: { cleanupFailure?: Error; receiptFailure?: Error; missingReceipt?: boolean }) => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), pid: 701,
      exitCode: null as number | null, signalCode: null as NodeJS.Signals | null }) as ControlledChild;
    const writes = new Map<string, string>(), children = new Set<ChildProcess>(), scheduled: Array<{ callback: () => void; delay: number }> = [];
    const cleared: unknown[] = [], stopped: Array<string | null> = [], launches: Array<Record<string, unknown>> = [];
    const nativeState = { reason: "completed", rootExitCode: 0 };
    const cleanup = { status: "PASS" as const, platform: "controlled-native-port", method: "controlled-owned-cleanup",
      processTreeVerified: true, forcedTermination: false, observedProcesses: 1, liveProcesses: 0, residualProcessesAfterExit: 0 };
    const forbidden = () => assert.fail("Controlled deadline declaration must not allocate an OS resource.");
    const run = new Function("assert", "isAbsolute", "resolve", "sep", "existsSync", "spawn", "spawnWindowsOwnedProcess", "stopChild",
      "writeFileSync", "setTimeout", "clearTimeout", "process", code + ";return runOwnedVerificationChild;")(
      assert, path.isAbsolute, path.resolve, path.sep, () => false, forbidden,
      (options: Record<string, unknown>) => { launches.push(options); return { child,
        readIdentity: () => ({ rootPid: 702, rootPpid: child.pid, rootCreationTimeUtc: "2026-10-30T00:00:00.0000000Z" }),
        readReceipt: () => { if (fault?.receiptFailure) throw fault.receiptFailure; return fault?.missingReceipt ? null : { ...nativeState }; },
        native: { executable: "controlled-no-native-executable" } }; },
      async (_child: unknown, _environment: unknown, reason?: string) => { assert.equal(_child, child); stopped.push(reason ?? null);
        if (fault?.cleanupFailure) throw fault.cleanupFailure; return cleanup; },
      (name: string, text: string) => { assert.equal(writes.has(name), false); writes.set(name, text); },
      (callback: () => void, delay: number) => { const timer = { callback, delay }; scheduled.push(timer); return timer; },
      (timer: unknown) => cleared.push(timer), { platform: "win32", pid: process.pid }) as typeof import("./lib/isolated-public-verification.mts").runOwnedVerificationChild;
    const context = { runDirectory: path.join(root, ".tmp-qa", "controlled-deadline-no-files"), sanitize: (value: string) => value,
      cleanEnvironment: (): NodeJS.ProcessEnv => ({ NODE_ENV: "test" }) };
    const invoke = (signal = new AbortController().signal, limitMs = requireActualBudget(budgetApi)) => run({ sourceDirectory: root, context, children, signal },
      ["--experimental-strip-types", "scripts/verify-admin-row-actions-capability.mts", "--consumer-capability-audit"], { NODE_ENV: "test" }, "controlled-adoption", limitMs);
    const close = (rootCode: number, reason = "completed", helperCode = 0) => { nativeState.rootExitCode = rootCode; nativeState.reason = reason;
      child.exitCode = helperCode; child.emit("close", helperCode); };
    return { invoke, close, child, writes, children, scheduled, cleared, stopped, launches };
  };
  const bounded = async <T,>(pending: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Controlled deadline promise exceeded its test bound.")), 1_000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const control = async (name: string, execute: () => Promise<void>) => {
    try { await execute(); } catch (error) { console.error("FAIL " + name); throw error; } cases.push(name);
  };
  for (const budget of [
    { name: "Adoption", limitMs: requireActualBudget(budgetApi), control: "adoption_owner_budget_ports" },
    { name: "exact Admin Runtime projection", limitMs: adminRuntimeDeadlineMs, control: "admin_runtime_projected_budget_ports" },
    { name: "scoped Adoption projection", limitMs: scopedAdoptionDeadlineMs, control: "scoped_adoption_projected_budget_ports" },
    { name: "scoped Admin Runtime projection", limitMs: scopedAdminRuntimeDeadlineMs, control: "scoped_admin_runtime_projected_budget_ports" },
    { name: "unscaled direct tiny child", limitMs: 17, control: "direct_tiny_child_budget_not_rescaled" },
  ]) await control("actual child receives the " + budget.name + " budget in both native and JS timer ports without profiling", async () => {
    const value = fixture(), pending = value.invoke(undefined, budget.limitMs);
    assert.equal(value.launches.length, 1); assert.equal(value.launches[0]!.limitMs, budget.limitMs);
    assert.equal(value.scheduled.length, 1); assert.equal(value.scheduled[0]!.delay, budget.limitMs);
    assert.deepEqual(value.launches[0]!.args, ["--experimental-strip-types", "scripts/verify-admin-row-actions-capability.mts", "--consumer-capability-audit"]);
    value.child.stdout.emit("data", "controlled source audit PASS"); value.close(0);
    const result = await bounded(pending); assert.equal(result.code, 0); assert.deepEqual(result.rawExit, { code: 0, signal: null });
    assert.equal(value.children.size, 0); assert.deepEqual(value.cleared, [value.scheduled[0]]); assert.equal(value.writes.size, 2);
    proofs.push({ control: budget.control, deadlineMs: value.scheduled[0]!.delay, nativeDeadlineMs: value.launches[0]!.limitMs,
      rawExit: result.rawExit, helperExit: result.helperExit, cleanup: result.cleanup, actualNativeProcessExecuted: false });
  });
  await control("actual child preserves a nonzero test exit independently of deadline and cancellation", async () => {
    const value = fixture(), pending = value.invoke(); value.child.stderr.emit("data", "AssertionError: controlled test failure"); value.close(7);
    const result = await bounded(pending); assert.equal(result.code, 7); assert.deepEqual(result.rawExit, { code: 7, signal: null });
    assert.equal(result.stderr, "AssertionError: controlled test failure"); assert.deepEqual(value.stopped, [null]); assert.equal(value.children.size, 0);
    proofs.push({ control: "nonzero_is_not_timeout", rawExit: result.rawExit, helperExit: result.helperExit, cleanup: result.cleanup });
  });
  for (const budget of [
    { limitMs: requireActualBudget(budgetApi), suffix: "", controlSuffix: "" },
    { limitMs: adminRuntimeDeadlineMs, suffix: " at the projected Admin Runtime budget", controlSuffix: "_admin_runtime_budget" },
    { limitMs: scopedAdoptionDeadlineMs, suffix: " at the scoped Adoption budget", controlSuffix: "_scoped_adoption_budget" },
    { limitMs: scopedAdminRuntimeDeadlineMs, suffix: " at the scoped Admin Runtime budget", controlSuffix: "_scoped_admin_runtime_budget" },
    { limitMs: 17, suffix: " at an unscaled direct tiny child budget", controlSuffix: "_direct_tiny_child_budget" },
  ]) for (const reason of ["timeout", "cancelled"] as const) await control("actual child retains " + reason + " plus original root exit and complete controlled cleanup" + budget.suffix, async () => {
    const value = fixture(), controller = new AbortController(), pending = value.invoke(controller.signal, budget.limitMs);
    assert.equal(value.launches.length, 1); assert.equal(value.launches[0]!.limitMs, budget.limitMs);
    assert.equal(value.scheduled.length, 1); assert.equal(value.scheduled[0]!.delay, budget.limitMs);
    const rejected = bounded(pending).then(() => assert.fail("Termination must remain a rejected failure."), error => error as Error & {
      childResult: { code: number | null; signal: NodeJS.Signals | null; reason: string; cleanup: { status: string; liveProcesses: number }; helperExit: { code: number | null; signal: NodeJS.Signals | null } } });
    if (reason === "timeout") value.scheduled[0]!.callback(); else controller.abort(Error("Controlled deadline cancellation"));
    value.close(37, reason); const error = await rejected;
    assert.ok(error instanceof Error && /aborted or exceeded its bound/u.test(error.message));
    assert.equal(error.childResult.reason, reason); assert.equal(error.childResult.code, 37); assert.equal(error.childResult.signal, null);
    assert.deepEqual(error.childResult.helperExit, { code: 0, signal: null }); assert.equal(error.childResult.cleanup.status, "PASS"); assert.equal(error.childResult.cleanup.liveProcesses, 0);
    assert.deepEqual(value.stopped, [reason]); assert.equal(value.children.size, 0); assert.deepEqual(value.cleared, [value.scheduled[0]]);
    proofs.push({ control: "owned_" + reason + budget.controlSuffix, originalRootExit: { code: error.childResult.code, signal: error.childResult.signal },
      helperExit: error.childResult.helperExit, cleanup: error.childResult.cleanup, actualNativeProcessExecuted: false });
  });
  type CleanupDiagnostic = { stage: string; name: string; code: string | null; exitCode: number | null; nativeReceipt: string };
  type CleanupRejection = Error & { childResult: { code: number | null; signal: NodeJS.Signals | null; reason: string | null;
    cleanup: { status: string; processTreeVerified: boolean }; cleanupFailure: CleanupDiagnostic;
    helperExit: { code: number | null; signal: NodeJS.Signals | null }; nativeJobReceipt: unknown } };
  const privateDetail = "postgres://private-user:private-password@private-host/private-database";
  const originalAssertion = new assert.AssertionError({ message: "Native job cleanup evidence is missing." });
  const malformedReceipt = new SyntaxError("Malformed native receipt contains " + privateDetail);
  const hostile = Object.assign(new Error(privateDetail, { cause: { code: privateDetail, exitCode: privateDetail } }),
    { name: privateDetail, code: privateDetail, stack: privateDetail });
  let getterReads = 0;
  const noGetter = () => { getterReads++; throw Error("Private cleanup getter must never run."); };
  const hostileGetters = new Error(privateDetail);
  hostileGetters.stack = privateDetail;
  Object.defineProperties(hostileGetters, { name: { get: noGetter }, code: { get: noGetter }, cause: { get: noGetter } });
  const causeGetters = new Error(privateDetail, { cause: Object.defineProperties({}, { code: { get: noGetter }, exitCode: { get: noGetter } }) });
  const diagnosticCases: Array<{ name: string; error: Error; expected: Omit<CleanupDiagnostic, "stage">; receiptFailure?: Error; missingReceipt?: boolean }> = [
    { name: "direct cause-less native receipt assertion", error: originalAssertion, missingReceipt: true,
      expected: { name: "AssertionError", code: "ERR_ASSERTION", exitCode: null, nativeReceipt: "unavailable" } },
    { name: "direct cause-less cleanup error", error: new Error("Native job owner exceeded its independent cleanup bound."), missingReceipt: true,
      expected: { name: "Error", code: null, exitCode: null, nativeReceipt: "unavailable" } },
    { name: "original malformed native receipt SyntaxError", error: malformedReceipt, receiptFailure: malformedReceipt,
      expected: { name: "SyntaxError", code: null, exitCode: null, nativeReceipt: "unavailable" } },
    { name: "existing safe cause code and exit", error: new Error(privateDetail, { cause: { code: "ECONNRESET", exitCode: 37 } }),
      expected: { name: "Error", code: "ECONNRESET", exitCode: 37, nativeReceipt: "present" } },
    { name: "direct safe code takes precedence over cause code", error: Object.assign(new TypeError(privateDetail, { cause: { code: "EPIPE", exitCode: 0 } }), { code: "ERR_DIRECT" }),
      expected: { name: "TypeError", code: "ERR_DIRECT", exitCode: 0, nativeReceipt: "present" } },
    { name: "safe code retains its exact 64-character boundary", error: Object.assign(new RangeError(privateDetail), { code: "E".repeat(64) }),
      expected: { name: "RangeError", code: "E".repeat(64), exitCode: null, nativeReceipt: "present" } },
    { name: "oversized code and nonfinite exit are omitted", error: Object.assign(new Error(privateDetail, { cause: { exitCode: Number.POSITIVE_INFINITY } }), { code: "E".repeat(65) }),
      expected: { name: "Error", code: null, exitCode: null, nativeReceipt: "present" } },
    { name: "hostile name code message stack and cause strings stay private", error: hostile,
      expected: { name: "Error", code: null, exitCode: null, nativeReceipt: "present" } },
    { name: "hostile error accessors never execute", error: hostileGetters,
      expected: { name: "Error", code: null, exitCode: null, nativeReceipt: "present" } },
    { name: "hostile cause accessors never execute", error: causeGetters,
      expected: { name: "Error", code: null, exitCode: null, nativeReceipt: "present" } },
  ];
  for (const item of diagnosticCases) await control("actual child cleanup diagnostic preserves " + item.name, async () => {
    const value = fixture({ cleanupFailure: item.error, receiptFailure: item.receiptFailure, missingReceipt: item.missingReceipt });
    const pending = value.invoke(), rejected = bounded(pending).then(() => assert.fail("Cleanup failure must reject."), error => error as CleanupRejection);
    value.close(37); const error = await rejected;
    assert.ok(error instanceof Error && /cleanup failed/u.test(error.message));
    assert.equal(error.cause, item.error); assert.equal(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable, false);
    assert.deepEqual(error.childResult.cleanupFailure, { stage: "owned-child-cleanup", ...item.expected });
    assert.equal(error.childResult.cleanup.status, "FAIL"); assert.equal(error.childResult.cleanup.processTreeVerified, false);
    assert.deepEqual(error.childResult.helperExit, { code: 0, signal: null });
    assert.equal(error.childResult.code, item.expected.nativeReceipt === "present" ? 37 : null); assert.equal(error.childResult.signal, null);
    assert.equal(error.childResult.reason, item.expected.nativeReceipt === "present" ? "nonzero_exit" : null);
    assert.deepEqual(value.stopped, [null]); assert.equal(value.children.size, 1); assert.equal(value.launches.length, 1);
    assert.equal(value.scheduled.length, 1); assert.deepEqual(value.cleared, [value.scheduled[0]]); assert.equal(value.writes.size, 2);
    assert.equal(JSON.stringify(error).includes(privateDetail), false); assert.equal(JSON.stringify(error.childResult).includes("Malformed native receipt"), false);
    assert.equal([...value.writes.values()].some(text => text.includes(privateDetail)), false); assert.equal(getterReads, 0);
    proofs.push({ control: "cleanup_diagnostic_" + item.name, cleanupFailure: error.childResult.cleanupFailure,
      cleanup: error.childResult.cleanup, rawPrivateErrorRetained: error.cause === item.error, actualNativeProcessExecuted: false });
  });
  for (const reason of ["timeout", "cancelled"] as const) await control("actual child retains primary " + reason + " when native cleanup evidence is unavailable", async () => {
    const original = new assert.AssertionError({ message: "Native job cleanup evidence is missing." });
    const value = fixture({ cleanupFailure: original, missingReceipt: true }), controller = new AbortController();
    const pending = value.invoke(controller.signal), rejected = bounded(pending).then(() => assert.fail("Termination and cleanup failure must reject."), error => error as CleanupRejection);
    if (reason === "timeout") value.scheduled[0]!.callback(); else controller.abort(Error("Controlled deadline cancellation"));
    value.close(37, reason, 5); const error = await rejected;
    assert.ok(error instanceof Error && /aborted or exceeded its bound/u.test(error.message));
    assert.equal(error.childResult.reason, reason); assert.equal(error.cause, original);
    assert.equal(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable, false);
    assert.deepEqual(error.childResult.cleanupFailure, { stage: "owned-child-cleanup", name: "AssertionError", code: "ERR_ASSERTION",
      exitCode: null, nativeReceipt: "unavailable" });
    assert.equal(error.childResult.nativeJobReceipt, null); assert.equal(error.childResult.code, null); assert.equal(error.childResult.signal, null);
    assert.equal(error.childResult.cleanup.status, "FAIL"); assert.equal(error.childResult.cleanup.processTreeVerified, false);
    assert.deepEqual(error.childResult.helperExit, { code: 5, signal: null });
    assert.deepEqual(value.stopped, [reason]); assert.equal(value.children.size, 1); assert.equal(value.launches.length, 1);
    assert.equal(value.scheduled.length, 1); assert.deepEqual(value.cleared, [value.scheduled[0]]); assert.equal(value.writes.size, 2);
    proofs.push({ control: "primary_" + reason + "_with_missing_native_receipt", cleanupFailure: error.childResult.cleanupFailure,
      primaryReason: error.childResult.reason, actualNativeProcessExecuted: false });
  });
  await control("actual child rejects pre-cancellation and every timer-unsafe budget before allocation", async () => {
    const preaborted = fixture(), controller = new AbortController(), original = Error("Controlled pre-cancelled Adoption"); controller.abort(original);
    await assert.rejects(bounded(preaborted.invoke(controller.signal)), error => error === original);
    const noAllocation = (value: ReturnType<typeof fixture>) => {
      assert.equal(value.launches.length, 0); assert.equal(value.scheduled.length, 0); assert.equal(value.writes.size, 0); assert.equal(value.stopped.length, 0); assert.equal(value.children.size, 0);
    };
    noAllocation(preaborted);
    for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, 2_147_483_648]) {
      const value = fixture();
      await assert.rejects(bounded(value.invoke(undefined, limit)), /deadline must be a finite timer-safe positive integer/u); noAllocation(value);
    }
    proofs.push({ control: "before_allocation_rejection", preCancelled: true, invalidBudgetCount: 6, childAllocations: 0, evidenceWrites: 0, timerAllocations: 0 });
  });
  return { status: "PASS", deadlineMs: requireActualBudget(budgetApi), proofs, actualNativeProcessExecuted: false, sourceOwnerSha256: sha256(source) };
}

async function verifyQualifiedSelectionControls() {
  check("actual canonical CLI factory reaches native ports and rejects either omitted binding before allocation", () => {
    const verifier = ts.createSourceFile("verify-isolated-supabase.mts", readSource("scripts/verify-isolated-supabase.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const cli = verifier.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "changeImpactOnly");
    assert.ok(cli?.body); const body = cli.body.statements.find(ts.isTryStatement); assert.ok(body);
    const statement = body.tryBlock.statements.find((node): node is ts.VariableStatement => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(verifier) === "api"));
    const declaration = statement?.declarationList.declarations.find(row => row.name.getText(verifier) === "api"); assert.ok(declaration?.initializer);
    const expression = ts.isAsExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer;
    assert.ok(ts.isCallExpression(expression) && ts.isNewExpression(expression.expression));
    const constructor = expression.expression; assert.ok(constructor.arguments);
    const code = "function inspectLocalVerificationChangeImpact(){return windowsOwnedProcessCapability();} function executeLocalVerificationTargets(input){return spawnWindowsOwnedProcess(input);} function qualifyLocalVerificationAdmission(){return windowsOwnedProcessCapability();}";
    let forbiddenCalls = 0, capabilityCalls = 0, nativeLaunchCalls = 0;
    const forbidden = () => { forbiddenCalls++; throw Error("Canonical factory probe reached an allocation or external operation."); };
    const capability = Object.freeze({ status: "PASS", probe: "actual_factory_capability_binding" }), native = Object.freeze({ probe: "actual_factory_launch_binding_no_process" });
    const input = Object.freeze({ args: [], controlledNoAllocationProbe: true });
    const bindings = { assert, root, code, ts, path, createHash, fileURLToPath, sha256: forbidden, execFileSync: forbidden, selectSourceInventory: forbidden, sourceIncluded: forbidden,
      existsSync: forbidden, lstatSync: forbidden, readlinkSync: forbidden, realpathSync: forbidden, readFileSync: forbidden, collectExecutableSourceGraph: forbidden,
      spawn: forbidden, mkdtempSync: forbidden, mkdirSync: forbidden, writeFileSync: forbidden, rmSync: forbidden, readdirSync: forbidden,
      createRequire: forbidden, isBuiltin: forbidden,
      windowsOwnedProcessCapability: () => { capabilityCalls++; return capability; },
      spawnWindowsOwnedProcess: (value: unknown) => { nativeLaunchCalls++; assert.equal(value, input); return native; } };
    const project = (actual: ts.Expression) => {
      const source = "const api=" + ts.createPrinter().printNode(ts.EmitHint.Expression, actual, verifier) + ";return api;";
      return new Function(...Object.keys(bindings), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings)) as {
        inspectLocalVerificationChangeImpact(): unknown; executeLocalVerificationTargets(value: unknown): unknown;
      };
    };
    const api = project(expression); assert.equal(api.inspectLocalVerificationChangeImpact(), capability); assert.equal(api.executeLocalVerificationTargets(input), native);
    for (const missing of ["windowsOwnedProcessCapability", "spawnWindowsOwnedProcess"]) {
      const mutated = ts.factory.updateCallExpression(expression, ts.factory.updateNewExpression(constructor, constructor.expression, constructor.typeArguments,
        constructor.arguments.filter(argument => !ts.isStringLiteral(argument) || argument.text !== missing)), expression.typeArguments,
      expression.arguments.filter(argument => argument.getText(verifier) !== missing));
      const incomplete = project(mutated), invoke = missing === "windowsOwnedProcessCapability"
        ? () => incomplete.inspectLocalVerificationChangeImpact() : () => incomplete.executeLocalVerificationTargets(input);
      assert.throws(invoke, (error: unknown) => error instanceof ReferenceError && error.message === missing + " is not defined");
    }
    assert.equal(capabilityCalls, 1); assert.equal(nativeLaunchCalls, 1); assert.equal(forbiddenCalls, 0);
  });
  const file = ts.createSourceFile("owner.mts", readSource("scripts/lib/isolated-public-verification.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = ["qualifyLocalVerificationTargets", "localVerificationCommandSteps", "localVerificationSourceGuardEffects"].map(name => {
    const node = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
    assert.ok(node); return node.getText(file).replace(/^export /u, "");
  });
  const loadSelectionApi = (read: typeof readFileSync = readFileSync) => new Function("assert", "collectExecutableSourceGraph", "ROOT", "digest", "ts", "process", "readFileSync", "existsSync", "join", "nodeModule", "readdirSync", "lstatSync", "dirname", "resolve", "sep",
    ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    + ";return {qualifyLocalVerificationTargets,localVerificationSourceGuardEffects};")(
    assert, collectExecutableSourceGraph, root, sha256, ts, process, read, existsSync, path.join, { createRequire, isBuiltin }, readdirSync, lstatSync, path.dirname, path.resolve, path.sep) as {
      qualifyLocalVerificationTargets: typeof import("./lib/isolated-public-verification.mts").qualifyLocalVerificationTargets;
      localVerificationSourceGuardEffects: typeof import("./lib/isolated-public-verification.mts").localVerificationSourceGuardEffects;
    };
  const { qualifyLocalVerificationTargets: qualify, localVerificationSourceGuardEffects: effects } = loadSelectionApi();
  type Analysis = import("./lib/isolated-public-verification.mts").LocalVerificationSourceImpact;
  const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;
  const entry = "scripts/qa-admin-form-guarded-navigation.mts", step = "node --experimental-strip-types " + entry + " --save-cache-only";
  const fixtureHash = sha256(readFileSync(path.join(root, entry), "utf8").replaceAll("\r\n", "\n"));
  const owner = "src/components/admin/ui/AdminFormRuntime.tsx", manifest = "src/lib/admin/interaction-system/adoption-manifest.ts";
  const analysis = (): Analysis => ({ proofBoundary: "source_discovery_only", sourceSha256: "a".repeat(64), deltaSha256: "b".repeat(64),
    ownerBindings: [{ owner: "AdminFormRuntime", capability: "form_runtime", files: [owner], manifest }], obligations: [], protections: [],
    changes: [{ file: owner, owners: ["AdminFormRuntime"], capabilities: ["form_runtime"], consumers: ["src/lib/admin/form-system/adoption-manifest.ts#controlled-consumer"],
      contracts: [manifest], candidateChecks: ["verify:admin-query-save-failure-contracts"], unresolved: [], semanticChange: true, presentationOnly: false }] });
  check("qualified shared Form change selects one actual registered leaf with owner/contract/consumer reasons", () => {
    const result = qualify(scripts, analysis(), fixtureHash); assert.equal(result.targets.length, 1); assert.equal(result.targets[0]!.step, step);
    assert.deepEqual(result.targets[0]!.owners, ["AdminFormRuntime"]); assert.deepEqual(result.targets[0]!.capabilities, ["form_runtime"]);
    assert.equal(result.targets[0]!.consumers.length, 1); assert.equal(result.targets[0]!.nativePersistenceVerified, false);
    assert.equal(result.targets[0]!.businessConsumerAdoptionVerified, false); assert.equal(result.unqualifiedRemainUnderExistingGates, true);
  });
  check("qualified fixture maintenance selects its actual behavior family rather than claiming business consumer adoption", () => {
    const value = analysis(); value.changes = [{ ...value.changes[0]!, file: entry, capabilities: [], consumers: [] }];
    assert.equal(qualify(scripts, value, fixtureHash).targets.length, 1);
  });
  check("simple presentation and unchanged inputs never execute the Form family", () => {
    const value = analysis(); value.changes = [{ ...value.changes[0]!, presentationOnly: true }]; assert.equal(qualify(scripts, value, fixtureHash).targets.length, 0);
    value.changes = [{ ...value.changes[0]!, presentationOnly: false, semanticChange: false }]; assert.equal(qualify(scripts, value, fixtureHash).targets.length, 0);
  });
  check("an unrelated functional change does not inherit a Form leaf from a broad wrapper", () => {
    const value = analysis(); value.changes = [{ ...value.changes[0]!, file: "src/lib/unrelated.ts", owners: ["other"], capabilities: [], contracts: [], consumers: [] }];
    assert.equal(qualify(scripts, value, fixtureHash).targets.length, 0);
  });
  check("Form contract changes keep eligible behavior alongside all existing contract and adoption gates", () => {
    const value = analysis(); value.changes = [{ ...value.changes[0]!, file: "src/lib/admin/form-system/adoption-manifest.ts", capabilities: [] }];
    assert.equal(qualify(scripts, value, fixtureHash).targets.length, 1); assert.equal(qualify(scripts, value, fixtureHash).unqualifiedRemainUnderExistingGates, true);
  });
  check("unknown fixture bytes cannot silently renew their own effect qualification", () => {
    const result = qualify(scripts, analysis(), "f".repeat(64)); assert.equal(result.targets.length, 0); assert.ok(result.blockers.includes("qualified_fixture_bytes_changed_review_effect_contract"));
    const previous = qualify(scripts, analysis(), "26d296745885d0d590e03bf1e0db37d6484871d8c26ba9545ed38eba8f133142");
    assert.equal(previous.targets.some(target => target.family === "admin-form-save-cache"), false);
    assert.ok(previous.blockers.includes("qualified_fixture_bytes_changed_review_effect_contract"));
  });
  check("missing current owner evidence blocks qualification rather than copying a registry", () => {
    const value = analysis(); value.ownerBindings = []; const result = qualify(scripts, value, fixtureHash);
    assert.equal(result.targets.length, 0); assert.ok(result.blockers.includes("missing_current_manifest_form_runtime_owner"));
  });
  check("unsupported shell or redirected canonical entry cannot authorize execution", () => {
    const unsafe = { ...scripts, "verify:admin-query-save-failure-contracts": step + " && echo unsafe" };
    assert.equal(qualify(unsafe, analysis(), fixtureHash).targets.length, 0);
    assert.equal(qualify({ ...scripts, "verify:admin-query-save-failure-contracts": step.replace("--save-cache-only", "--unknown-mode") }, analysis(), fixtureHash).targets.length, 0);
  });
  check("overlapping wrappers and repeated leaf occurrences execute the same family only once", () => {
    const value = analysis(); value.changes = [{ ...value.changes[0]!, candidateChecks: ["qa:qualified-control", "verify:admin-query-save-failure-contracts"] }];
    assert.equal(qualify({ ...scripts, "qa:qualified-control": step + " && " + step }, value, fixtureHash).targets.length, 1);
  });
  const sourceGuardHashes = { "scripts/verify-executable-governance.mts": "b803957f15b95977eb4b3403ba1437b66dd6de2559115f4e1c2e243cebce434f" };
  const qualityAnalysis = () => {
    const value = analysis(); value.changes = [{ ...value.changes[0]!, file: "scripts/fixtures/phase06-vector.mts", owners: ["existing-fixture"],
      capabilities: [], consumers: [], contracts: [], candidateChecks: ["verify:executable-governance", "verify:verification-infrastructure"] }];
    return value;
  };
  const verifyActualSourceGuardQualification = (ownerApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "qualifyLocalVerificationTargets">) => {
  const nativePortEffects = { ...sourceGuardHashes,
    "scripts/verify-verification-infrastructure.mts": "cf94c6af79418b32c7953a4e5f4e88a6463844d26b3f185ec270e627a3d15c46" };
  const nativePortAnalysis = (file: string, semanticChange = true): Analysis => {
    const value = qualityAnalysis(); value.changes = [{ ...value.changes[0]!, file, semanticChange }]; return value;
  };
  for (const file of ["scripts/lib/windows-owned-process.mts", "scripts/lib/windows-owned-process.cs"]) {
    check("actual native execution port " + file + " selects Form and both quality guards once", () => {
      const result = ownerApi.qualifyLocalVerificationTargets(scripts, nativePortAnalysis(file), fixtureHash, nativePortEffects);
      assert.deepEqual(result.blocking, []); assert.equal(result.targets.length, 3); assert.equal(result.selections.filter(row => row.selected).length, 3);
      assert.equal(result.targets.filter(target => target.kind === "browser_behavior").length, 1);
      const form = result.targets.find(target => target.entry === entry); assert.ok(form); assert.equal(form.step, step);
      assert.ok(form.canonicalChecks.length > 0); assert.deepEqual(form.reasons.map(reason => reason.file), [file]);
      assert.equal(form.nativePersistenceVerified, false); assert.equal(form.businessConsumerAdoptionVerified, false);
      assert.equal(new Set(result.targets.map(target => target.step)).size, 3); assert.equal(result.unqualifiedRemainUnderExistingGates, true);
    });
  }
  check("native filename lookalikes unrelated documentation and nonsemantic deltas cannot borrow Form execution", () => {
    for (const file of ["docs/windows-owned-process.cs.md", "scripts/fixtures/windows-owned-process.cs", "src/lib/windows-owned-process.mts"]) {
      const result = ownerApi.qualifyLocalVerificationTargets(scripts, nativePortAnalysis(file), fixtureHash, nativePortEffects);
      assert.equal(result.targets.some(target => target.entry === entry), false);
      assert.equal(result.selections.find(row => row.family === "admin-form-save-cache")?.selected, false);
      assert.equal(result.unqualifiedRemainUnderExistingGates, true);
    }
    const unchanged = ownerApi.qualifyLocalVerificationTargets(scripts, nativePortAnalysis("scripts/lib/windows-owned-process.mts", false), fixtureHash, nativePortEffects);
    assert.deepEqual(unchanged.targets, []); assert.equal(unchanged.applicable, false);
  });
  check("native execution deltas retain stale-fingerprint rejection and overlapping-leaf deduplication", () => {
    const value = nativePortAnalysis("scripts/lib/windows-owned-process.cs");
    const staleFixture = ownerApi.qualifyLocalVerificationTargets(scripts, value, "f".repeat(64), nativePortEffects);
    assert.equal(staleFixture.targets.some(target => target.entry === entry), false);
    assert.ok(staleFixture.selections.some(row => row.family === "admin-form-save-cache" && row.selected && !row.qualified));
    assert.ok(staleFixture.blocking.includes("qualified_fixture_bytes_changed_review_effect_contract"));
    const staleEffect = ownerApi.qualifyLocalVerificationTargets(scripts, value, fixtureHash,
      { ...nativePortEffects, "scripts/verify-executable-governance.mts": "f".repeat(64) });
    assert.ok(staleEffect.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:scripts/verify-executable-governance.mts"));
    assert.equal(staleEffect.targets.some(target => target.entry === "scripts/verify-executable-governance.mts"), false);
    const overlap = ownerApi.qualifyLocalVerificationTargets({ ...scripts, "qa:native-owned-form-overlap": step + " && " + step }, value, fixtureHash, nativePortEffects);
    assert.equal(overlap.targets.length, 3); assert.equal(new Set(overlap.targets.map(target => target.step)).size, 3);
  });
  check("QA quality qualification preserves two required selections while executing only the reviewed complete closure", () => {
    const value = qualityAnalysis(), result = ownerApi.qualifyLocalVerificationTargets(scripts, value, fixtureHash, sourceGuardHashes);
    assert.equal(result.selections.filter(row => row.selected).length, 2); assert.equal(result.targets.length, 1);
    assert.ok(result.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:scripts/verify-verification-infrastructure.mts"));
    assert.equal(new Set(result.targets.map(target => target.step)).size, 1);
    for (const target of result.targets) {
      assert.equal(target.kind, "source_guard"); assert.equal(target.proofLevel, "source_guard_execution");
      assert.ok(target.step === "node --experimental-strip-types " + target.entry);
      assert.ok(!target.effects.includes("browser") && !target.effects.includes("database"));
      assert.equal(target.nativePersistenceVerified, false); assert.equal(target.businessConsumerAdoptionVerified, false);
    }
    assert.equal(result.unqualifiedRemainUnderExistingGates, true);
    const repeated = ownerApi.qualifyLocalVerificationTargets({ ...scripts, "verify:phase06-source-alias": scripts["verify:executable-governance"] }, value, fixtureHash, sourceGuardHashes);
    assert.equal(repeated.selections.filter(row => row.selected).length, 2, "Both required quality guards remain selected.");
    assert.equal(repeated.targets.length, 1, "Wrapper overlap must not execute any source leaf again.");
  });
  check("stale source guard effect bytes and changed helper dependencies block automatic source execution", () => {
    const stale = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash,
      { ...sourceGuardHashes, "scripts/verify-executable-governance.mts": "f".repeat(64) });
    assert.ok(stale.blocking.some(reason => reason.startsWith("qualified_source_guard_bytes_changed_review_effect_contract:")));
    const dependency = qualityAnalysis(); dependency.changes = [...dependency.changes,
      { ...dependency.changes[0]!, file: "scripts/lib/verification-module-loader.mjs" }];
    const changed = ownerApi.qualifyLocalVerificationTargets(scripts, dependency, fixtureHash, { ...sourceGuardHashes, "scripts/verify-executable-governance.mts": "e".repeat(64) });
    assert.equal(changed.targets.length, 0); assert.ok(changed.blocking.some(reason => reason.startsWith("qualified_source_guard_bytes_changed_review_effect_contract:")));
    const redirected = ownerApi.qualifyLocalVerificationTargets({ ...scripts, "verify:executable-governance": "node scripts/unqualified-quality.mjs" }, qualityAnalysis(), fixtureHash, sourceGuardHashes);
    assert.ok(redirected.blocking.includes("missing_exact_registered_source_guard:scripts/verify-executable-governance.mts"));
  });
  check("both reviewed direct quality leaves qualify once while invented hashes and markers leave Infrastructure blocked", () => {
    const actual = { ...sourceGuardHashes, "scripts/verify-verification-infrastructure.mts": "cf94c6af79418b32c7953a4e5f4e88a6463844d26b3f185ec270e627a3d15c46" };
    const selected = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash, actual);
    assert.equal(selected.targets.length, 2); assert.deepEqual(selected.blocking, []);
    assert.equal(new Set(selected.targets.map(target => target.step)).size, 2);
    assert.ok(selected.targets.every(target => target.kind === "source_guard" && target.proofLevel === "source_guard_execution"
      && target.nativePersistenceVerified === false && target.businessConsumerAdoptionVerified === false));
    const previousEffect = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash,
      { ...actual, "scripts/verify-verification-infrastructure.mts": "6658ae1b1aac5a1e092e9dfeed514d66f87ec42880d89df0d10ebd1d21357230" });
    assert.equal(previousEffect.targets.some(target => target.entry === "scripts/verify-verification-infrastructure.mts"), false);
    assert.ok(previousEffect.selections.some(row => row.family === "scripts/verify-verification-infrastructure.mts" && row.selected && !row.qualified));
    assert.ok(previousEffect.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:scripts/verify-verification-infrastructure.mts"));
    for (const invented of ["b5f55231c35b155658dbae826595e980c74230b0d51b364710bf1a579c9af1c2", "UNQUALIFIED_DYNAMIC_EXECUTION_CLOSURE", "PASS verification infrastructure:", "a".repeat(64)]) {
      const rejected = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash,
        { ...actual, "scripts/verify-verification-infrastructure.mts": invented });
      assert.equal(rejected.targets.some(target => target.entry === "scripts/verify-verification-infrastructure.mts"), false);
      assert.ok(rejected.selections.some(row => row.family === "scripts/verify-verification-infrastructure.mts" && row.selected && !row.qualified));
      assert.ok(rejected.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:scripts/verify-verification-infrastructure.mts"));
    }
  });
  const linuxSourceGuardHashes = {
    "scripts/verify-executable-governance.mts": "790abdafab8c3f07a7be31e533e5fba2237f121a65e54a367f33fe16758ed759",
    "scripts/verify-verification-infrastructure.mts": "1dc7b9131ac32554129437c7709e60dbc1cb793b49e6eaf73782c71fd808eeec",
  };
  const retiredAlpineSourceGuardHashes = {
    "scripts/verify-executable-governance.mts": "f5f8d2bdd3b5bc3fc9970c8635e481ce2d3577783adec7d474fd46e73e899dee",
    "scripts/verify-verification-infrastructure.mts": "96c02fd6676dfc6140a75f618fb240613091cf63bf27d8ff0c6c1a52ceaaba33",
  };
  check("the retired Alpine context cannot authorize either current primary source guard", () => {
    const result = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash, retiredAlpineSourceGuardHashes);
    assert.deepEqual(result.targets, []); assert.equal(result.selections.filter(row => row.selected).length, 2);
    for (const entry of Object.keys(retiredAlpineSourceGuardHashes)) {
      assert.equal(result.selections.find(row => row.family === entry)?.qualified, false);
      assert.ok(result.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:" + entry));
    }
    assert.equal(result.unqualifiedRemainUnderExistingGates, true);
  });
  check("two unknown current source guard contexts retain both mandatory blocked selections", () => {
    const supplied = Object.fromEntries(Object.keys(linuxSourceGuardHashes).map(entry => [entry, "f".repeat(64)]));
    const result = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash, supplied);
    assert.deepEqual(result.targets, []); assert.equal(result.selections.filter(row => row.selected && !row.qualified).length, 2);
    for (const entry of Object.keys(supplied)) assert.ok(result.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:" + entry));
    assert.equal(result.unqualifiedRemainUnderExistingGates, true);
  });
  check("the reviewed Linux context selects both actual source leaves with their matching supplied fingerprints", () => {
    const result = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash, linuxSourceGuardHashes);
    assert.deepEqual(result.blocking, []); assert.equal(result.targets.length, 2);
    assert.equal(result.selections.filter(row => row.selected && row.qualified).length, 2);
    assert.equal(new Set(result.targets.map(target => target.step)).size, 2);
    for (const [entry, fingerprint] of Object.entries(linuxSourceGuardHashes)) {
      const target = result.targets.find(row => row.entry === entry); assert.ok(target);
      assert.equal(target.fixtureSha256, fingerprint); assert.equal(target.step, "node --experimental-strip-types " + entry);
      assert.equal(target.kind, "source_guard"); assert.equal(target.proofLevel, "source_guard_execution");
      assert.equal(target.nativePersistenceVerified, false); assert.equal(target.businessConsumerAdoptionVerified, false);
    }
    assert.equal(result.unqualifiedRemainUnderExistingGates, true);
  });
  for (const [name, mixed] of [
    ["Windows Governance with Linux Infrastructure", { ...nativePortEffects, "scripts/verify-verification-infrastructure.mts": linuxSourceGuardHashes["scripts/verify-verification-infrastructure.mts"] }],
    ["Linux Governance with Windows Infrastructure", { ...linuxSourceGuardHashes, "scripts/verify-verification-infrastructure.mts": nativePortEffects["scripts/verify-verification-infrastructure.mts"] }],
  ] as const) check("recognized mixed source guard contexts cannot authorize execution: " + name, () => {
    const result = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash, mixed);
    assert.deepEqual(result.targets, []); assert.equal(result.selections.filter(row => row.selected).length, 2);
    for (const entry of Object.keys(linuxSourceGuardHashes)) {
      const selection = result.selections.find(row => row.family === entry); assert.ok(selection);
      assert.equal(selection.selected, true); assert.equal(selection.qualified, false); assert.equal(selection.reason, "effect_contract_blocked");
      assert.ok(result.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:" + entry));
    }
    assert.equal(result.unqualifiedRemainUnderExistingGates, true);
  });
  for (const [context, reviewed] of [["Windows", nativePortEffects], ["Linux", linuxSourceGuardHashes]] as const) {
    for (const unknownEntry of Object.keys(linuxSourceGuardHashes)) check(context + " retains only its known source leaf when the other fingerprint is unknown: " + unknownEntry, () => {
      const supplied = { ...reviewed, [unknownEntry]: "f".repeat(64) };
      const result = ownerApi.qualifyLocalVerificationTargets(scripts, qualityAnalysis(), fixtureHash, supplied);
      assert.equal(result.targets.length, 1); assert.equal(result.selections.filter(row => row.selected).length, 2);
      assert.equal(result.targets.some(row => row.entry === unknownEntry), false);
      assert.equal(result.selections.find(row => row.family === unknownEntry)?.qualified, false);
      assert.ok(result.blocking.includes("qualified_source_guard_bytes_changed_review_effect_contract:" + unknownEntry));
      const known = result.targets[0]!; assert.equal(known.fixtureSha256, supplied[known.entry as keyof typeof supplied]);
      assert.equal(result.selections.find(row => row.family === known.entry)?.qualified, true);
      assert.equal(result.unqualifiedRemainUnderExistingGates, true);
    });
  }
  };
  verifyActualSourceGuardQualification({ qualifyLocalVerificationTargets: qualify });
  check("complete native closure includes unused eager imports re-exports and transitive owners while preserving default graph behavior", () => {
    const entry = "scripts/phase06-effect-entry.mts", hidden = "scripts/fixtures/phase06-effect-unused.mts", side = "scripts/fixtures/phase06-effect-side.mts",
      nested = "scripts/fixtures/phase06-effect-nested.mts", forwarded = "scripts/fixtures/phase06-effect-export.mts";
    const lock = JSON.stringify({ packages: { "node_modules/typescript": { version: "fixture", integrity: "fixture-integrity" } } });
    const sources = new Map<string, string>([[entry, 'import { unusedBinding } from "./fixtures/phase06-effect-unused.mts"; import "./fixtures/phase06-effect-side.mts"; export { value } from "./fixtures/phase06-effect-export.mts";'],
      [hidden, "export const unusedBinding = 1;"], [side, 'import { unusedNested } from "./phase06-effect-nested.mts";'],
      [nested, "export const unusedNested = 1;"], [forwarded, "export const value = 1;"], ["package.json", "{}"], ["package-lock.json", lock], ["tsconfig.json", "{}"]]);
    const runtime = { node: "fixture-node", v8: "fixture-v8", modules: "fixture-modules", platform: "fixture-platform", arch: "fixture-arch",
      executableSha256: "a".repeat(64), installedLockSha256: sha256(lock), execArgv: ["--experimental-strip-types"] };
    const original = effects(entry, sources, runtime, lock); assert.deepEqual(original.unresolved, []); assert.ok(original.fingerprint);
    for (const [name, changedRuntime] of [["Node version", { ...runtime, node: "fixture-node-changed" }],
      ["executable bytes", { ...runtime, executableSha256: "b".repeat(64) }]] as const) {
      check("source guard effect identity cannot reuse qualification after changed " + name, () => {
        const changed = effects(entry, sources, changedRuntime, lock);
        assert.deepEqual(changed.unresolved, []); assert.notEqual(changed.fingerprint, original.fingerprint);
        assert.deepEqual(changed.closure, original.closure); assert.deepEqual(changed.inputs, original.inputs);
      });
    }
    check("source guard effect identity binds raw installed lock bytes even when parsed JSON is identical", () => {
      const changedLock = JSON.stringify(JSON.parse(lock), null, 2) + "\n";
      assert.deepEqual(JSON.parse(changedLock), JSON.parse(lock)); assert.notEqual(sha256(changedLock), runtime.installedLockSha256);
      const changed = effects(entry, sources, { ...runtime, installedLockSha256: sha256(changedLock) }, changedLock);
      assert.deepEqual(changed.unresolved, []); assert.notEqual(changed.fingerprint, original.fingerprint);
      assert.deepEqual(changed.closure, original.closure); assert.deepEqual(changed.inputs, original.inputs);
      const stale = effects(entry, sources, runtime, changedLock);
      assert.equal(stale.fingerprint, null); assert.ok(stale.unresolved.includes("installed_dependencies_do_not_match_current_lock"));
    });
    assert.deepEqual(original.closure.map(row => row.file).sort(), [entry, hidden, side, nested, forwarded].sort());
    const ordinary = collectExecutableSourceGraph({ root, entrySourceFiles: [entry], sourceOverrides: sources, symbolAware: false });
    assert.equal(ordinary.has(hidden), false); assert.equal(ordinary.has(nested), false);
    assert.throws(() => collectExecutableSourceGraph({ root, entrySourceFiles: [entry], sourceOverrides: sources, nativeEagerImports: true }), /complete module graph/u);
    const tampered = new Map(sources); tampered.set(hidden, "globalThis.__unexecutedClosureMutation = true; export const unusedBinding = 1;");
    const changed = effects(entry, tampered, runtime, lock); assert.notEqual(changed.fingerprint, original.fingerprint);
    assert.equal((globalThis as Record<string, unknown>).__unexecutedClosureMutation, undefined, "Effect discovery must never execute a helper, even when it already exists in the baseline.");
    assert.notEqual(effects(entry, sources, { ...runtime, execArgv: ["--experimental-strip-types", "--jitless"] }, lock).fingerprint, original.fingerprint);
    const unlocked = new Map(sources); unlocked.set("package-lock.json", JSON.stringify({ packages: { "node_modules/typescript": { version: "changed" } } }));
    assert.ok(effects(entry, unlocked, runtime, lock).unresolved.includes("installed_dependencies_do_not_match_current_lock"));
    for (const source of ['import "./missing-phase06-effect.mts";', 'export { value } from "./missing-phase06-effect.mts";', 'const value = import("./missing-phase06-effect.mts");',
      'const module = import(dynamicModule);', 'const value = new Function("return 1")();', 'import { createRequire as requireModule } from "node:module"; requireModule(import.meta.url)(dynamicModule);']) {
      const unresolved = new Map(sources); unresolved.set(entry, source);
      const result = effects(entry, unresolved, runtime, lock); assert.equal(result.fingerprint, null); assert.ok(result.unresolved.length > 0);
    }
  });
  check("dependency or tooling changes require effect review before automatic execution", () => {
    const value = analysis(); value.changes = [...value.changes, { ...value.changes[0]!, file: "package-lock.json" }];
    const result = qualify(scripts, value, fixtureHash); assert.equal(result.targets.length, 0); assert.ok(result.blockers.includes("dependency_or_command_contract_changed"));
  });
  check("reviewed Infrastructure footprint binds actual generated fragments Jiti recipes and installed dependency bytes", () => {
    const paths = selectSourceInventory(execFileSync("git", ["-c", "core.fsmonitor=false", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, timeout: 10_000 })
      .toString("utf8").split("\0").filter(Boolean));
    const sources = new Map(paths.map(file => [file, readFileSync(path.join(root, file))]));
    const lock = readFileSync(path.join(root, "node_modules/.package-lock.json"), "utf8");
    const runtime = { node: process.version, v8: process.versions.v8, modules: process.versions.modules, platform: process.platform, arch: process.arch,
      executableSha256: sha256(readFileSync(process.execPath)), installedLockSha256: sha256(lock), execArgv: ["--experimental-strip-types"] };
    const entry = "scripts/verify-verification-infrastructure.mts", original = effects(entry, sources, runtime, lock);
    assert.deepEqual(original.unresolved, []); assert.match(original.fingerprint!, /^[a-f0-9]{64}$/u);
    const governanceEntry = "scripts/verify-executable-governance.mts", governance = effects(governanceEntry, sources, runtime, lock);
    assert.deepEqual(governance.unresolved, []); assert.match(governance.fingerprint!, /^[a-f0-9]{64}$/u);
    const actualSourceGuardHashes: Record<string, string> = { [governanceEntry]: governance.fingerprint!, [entry]: original.fingerprint! };
    const actualSelection = qualify(scripts, qualityAnalysis(), fixtureHash, actualSourceGuardHashes);
    assert.deepEqual(actualSelection.blocking, []); assert.equal(actualSelection.targets.length, 2);
    assert.equal(actualSelection.selections.filter(row => row.selected && row.qualified).length, 2);
    for (const target of actualSelection.targets) {
      assert.equal(target.fixtureSha256, actualSourceGuardHashes[target.entry]);
      assert.equal(target.kind, "source_guard"); assert.equal(target.step, "node --experimental-strip-types " + target.entry);
    }
    assert.equal(original.generated?.producers.length, 4); assert.equal(original.generated?.dynamicSourceEntries.length, 17);
    assert.equal(original.generated?.fragments.filter(row => row.selector === "actual_assertion_statement").length, 4);
    assert.ok(original.generated?.fragments.some(row => row.selector === "actual_controlled_fixture_loop"));
    assert.ok(original.generated?.runtimePackages.some(row => row.root === "node_modules/js-yaml" && row.files > 0));
    assert.equal(original.generated?.fragments.find(row => row.selector === "read_only_adopter_source" && row.file === "scripts/verify-isolated-application-cli-pulse.mjs")?.sha256,
      "0f6c7d258f8acb1c43e6e3c84c6b826ba6d224b20d20467cd9d401967d315b94", "The reviewed observer diagnostic port must remain bound to its actual Infrastructure input.");
    for (const [file, mutate] of [
      ["scripts/lib/verification-module-loader.mjs", (source: string) => source.replace('createRequire(file)(dependency.target)', 'createRequire(file)("unreviewed-package")')],
      ["scripts/fixtures/verification-text-contract.mjs", (source: string) => source.replace("const guard = new Function(", "const guard = Reflect.construct(Function, [")],
      ["scripts/fixtures/admin-core-query-presentation-plan.mjs", (source: string) => source.replace("'../../src/lib/admin/'+modulePath+'.ts'", "dynamicContractPath")],
      ["scripts/verify-verification-infrastructure.mts", (source: string) => source.replace('export const answer = 42;', 'globalThis.unreviewedScratchEffect=true;export const answer = 42;')],
      ["scripts/verify-admin-core-query-fixture-contract.mjs", (source: string) => source.replace("fixtureSource=normalizeVerificationText(fixtureSource);", "process.exitCode=7;fixtureSource=normalizeVerificationText(fixtureSource);")],
      ["scripts/fixtures/admin-core-query-presentation-fixtures.mts", (source: string) => source.replace("for(const spec of plan){", "for(const spec of plan){globalThis.unreviewedFixtureEffect=true;")],
      ["scripts/fixtures/verification-text-adopters.json", (source: string) => source.replace("[", '["../../private-input",')],
      ["src/lib/admin/projects/entity-list-contract.ts", (source: string) => source + '\nimport "./unreviewed-dynamic-helper";'],
    ] as const) {
      const changed = new Map(sources), before = changed.get(file)!.toString(), after = mutate(before);
      assert.notEqual(after, before, file + " must mutate its actual executed input"); changed.set(file, Buffer.from(after));
      const rejected = effects(entry, changed, runtime, lock); assert.notEqual(rejected.fingerprint, original.fingerprint, file);
    }
    const altered = ((file: Parameters<typeof readFileSync>[0], options?: Parameters<typeof readFileSync>[1]) => {
      const content = readFileSync(file, options);
      if (typeof file !== "string" || path.resolve(file) !== path.join(root, "node_modules/js-yaml/index.js")) return content;
      return typeof content === "string" ? content + "\n/* controlled unexecuted package byte mutation */" : Buffer.concat([content, Buffer.from("\n/* controlled unexecuted package byte mutation */")]);
    }) as typeof readFileSync;
    const dependencyChanged = loadSelectionApi(altered).localVerificationSourceGuardEffects(entry, sources, runtime, lock);
    assert.notEqual(dependencyChanged.fingerprint, original.fingerprint, "Installed package metadata alone cannot hide changed executable package bytes.");
    assert.notEqual(effects(entry, sources, { ...runtime, execArgv: [...runtime.execArgv, "--jitless"] }, lock).fingerprint, original.fingerprint);
    const missing = new Map(sources); missing.delete("scripts/fixtures/admin-core-query-presentation-fixtures.mts");
    assert.equal(effects(entry, missing, runtime, lock).fingerprint, null, "A missing generated input never inherits producer availability.");
  });
  check("qualified execution source keeps immutable snapshot/selector checks and actual terminal behavior requirements", () => {
    const node = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "executeLocalVerificationTargets"); assert.ok(node);
    const source = node.getText(file);
    for (const required of ["Targeted execution has a stale source snapshot.", "Targeted selector is stale or incomplete.", "inspectLocalVerificationChangeImpact({ baselineHead: options.baselineHead, automatic: true })", "never supplied impact analysis", "runOwnedVerificationChild", "scenariosCompleted", "businessConsumerAdoptionVerified", "cleanupFailurePreserved"])
      assert.ok(source.includes(required), required);
    assert.ok(readSource(entry).includes("installSaveCacheNetworkFence"));
  });
  check("actual qualified owner API accepts the current fixture and rejects changed effect bytes", () => {
    const assertActualQualification = (ownerApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "qualifyLocalVerificationTargets">) => {
      const eligible = ownerApi.qualifyLocalVerificationTargets(scripts, analysis(), fixtureHash);
      assert.equal(eligible.targets.length, 1); assert.equal(eligible.targets[0]!.step, step);
      const changedFixtureHash = sha256("unapproved controlled fixture bytes"); assert.notEqual(changedFixtureHash, fixtureHash);
      const blocked = ownerApi.qualifyLocalVerificationTargets(scripts, analysis(), changedFixtureHash);
      assert.deepEqual(blocked.targets, []); assert.ok(blocked.blockers.includes("qualified_fixture_bytes_changed_review_effect_contract"));
    };
    assertActualQualification({ qualifyLocalVerificationTargets: qualify });
  });
  const executorNode = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "executeLocalVerificationTargets");
  assert.ok(executorNode);
  const inspectorRequests: Array<{ baselineHead: string; automatic: boolean }> = [], reachedExecutionPorts: string[] = [];
  const baselineHead = "a".repeat(40), qualifiedTargets = qualify(scripts, analysis(), fixtureHash);
  type AdmissionSnapshot = { status: string; exitCode: number; qualifiedTargets?: typeof qualifiedTargets; changeImpact?: Analysis };
  let snapshot: AdmissionSnapshot = { status: "DRIFT", exitCode: 2 };
  const inspector = (options: { baselineHead: string; automatic: boolean }) => { inspectorRequests.push(options); return snapshot; };
  const executionPorts = ["execFileSync", "selectSourceInventory", "safeSourcePath", "existsSync", "lstatSync", "realpathSync", "readFileSync", "digest",
    "qualifyLocalVerificationTargets", "resolve", "mkdirSync", "mkdtempSync", "join", "runOwnedVerificationChild", "stopChild", "readdirSync", "rmSync",
    "ownedPath", "receipt", "localVerificationFamilyReceipt", "localVerificationFailureClassification"];
  const execute = new Function("assert", "ts", "inspectLocalVerificationChangeImpact", "process", ...executionPorts,
    ts.transpileModule(orderedSourceFloorControlSource(file) + "\n" + executorNode.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      + ";return executeLocalVerificationTargets;")(assert, ts, inspector, { env: {}, platform: "offline-admission" }, ...executionPorts.map(name => () => {
        reachedExecutionPorts.push(name); throw Error("Executor admission reached forbidden execution port: " + name);
      })) as typeof import("./lib/isolated-public-verification.mts").executeLocalVerificationTargets;
  const admissionCase = "actual qualified executor rejects caller selectors and blocks incomplete source admission before execution";
  try {
    const assertActualExecutorAdmission = async (ownerApi: Pick<typeof import("./lib/isolated-public-verification.mts"), "executeLocalVerificationTargets">) => {
      const signal = new AbortController().signal;
      const callerSelector = { baselineHead, qualifiedTargets }, callerImpact = { baselineHead, changeImpact: analysis() };
      await assert.rejects(ownerApi.executeLocalVerificationTargets(callerSelector, signal), /only an immutable baseline, never supplied impact analysis/u);
      await assert.rejects(ownerApi.executeLocalVerificationTargets(callerImpact, signal), /only an immutable baseline, never supplied impact analysis/u);
      assert.deepEqual(inspectorRequests, []); assert.deepEqual(reachedExecutionPorts, []);
      for (const input of [
        { status: "DRIFT", exitCode: 2 },
        { status: "PASS_AUTOMATIC_SOURCE_PROTECTION", exitCode: 0, changeImpact: analysis() },
        { status: "PASS_AUTOMATIC_SOURCE_PROTECTION", exitCode: 0, qualifiedTargets },
        { status: "PASS_AUTOMATIC_SOURCE_PROTECTION", exitCode: 1, qualifiedTargets, changeImpact: analysis() },
      ]) {
        snapshot = input; const requestsBefore: number = inspectorRequests.length;
        const result = await ownerApi.executeLocalVerificationTargets({ baselineHead }, signal);
        assert.equal(result.status, "BLOCKED"); assert.equal(result.exitCode, 1); assert.equal(result.sourceReport, snapshot);
        assert.equal(result.executedCommands, 0); assert.equal(result.commandAttempts, 0); assert.equal(result.browserExecuted, false);
        assert.equal(result.attempt, 0); assert.equal(result.retry, 0); assert.equal(result.flakyStatus, "NOT_RUN"); assert.equal(result.fullGatesPreserved, true);
        assert.deepEqual(result.results, []); assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0);
        assert.equal(inspectorRequests.length, requestsBefore + 1); assert.deepEqual(inspectorRequests.at(-1), { baselineHead, automatic: true });
        assert.deepEqual(reachedExecutionPorts, []);
      }
    };
    await assertActualExecutorAdmission({ executeLocalVerificationTargets: execute });
  } catch (error) { console.error("FAIL " + admissionCase); throw error; }
  cases.push(admissionCase);
  const rawExitCase = "actual qualified executor preserves resolved SIGABRT raw exit identity and counts failed spawn only as attempted";
  try {
    const classifyNode = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "localVerificationFailureClassification"); assert.ok(classifyNode);
    const classify = new Function(ts.transpileModule(classifyNode.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      + ";return localVerificationFailureClassification;")() as typeof import("./lib/isolated-public-verification.mts").localVerificationFailureClassification;
    const sourceBytes = new Map([["package.json", Buffer.from(JSON.stringify({ scripts }))], ["bound-source.mts", Buffer.from("bound-source")],
      [entry, Buffer.from("bound-fixture")]]);
    const manifest = [...sourceBytes].map(([file, bytes]) => ({ file, sha256: sha256(bytes) }));
    const sourceSha256 = sha256(JSON.stringify(manifest)), finalHead = "b".repeat(40);
    const currentAnalysis = { ...analysis(), sourceSha256 }, selected = qualify(scripts, currentAnalysis, fixtureHash);
    assert.equal(selected.targets.length, 1);
    const closureEffects = ["scripts/verify-executable-governance.mts", "scripts/verify-verification-infrastructure.mts"].map(entry => ({ entry, fingerprint: null }));
    const sourceReport = { status: "PASS_AUTOMATIC_SOURCE_PROTECTION", exitCode: 0, finalHead, sourceSha256, changeImpact: currentAnalysis, actualDelta: [],
      qualifiedTargets: selected, sourceGuardEffects: closureEffects, timings: {} };
    const identity = { pid: 23456, ppid: 12345, spawnedAtUtc: "2026-01-01T00:00:00.000Z" };
    const fatal = "FATAL ERROR: Check failed: jit_page_->allocations_.erase(addr) == 1.\n";
    const cleanup = { status: "PASS", liveProcesses: 0, processTreeVerified: true };
    for (const kind of ["resolved-abort", "failed-spawn", "typescript-failure"] as const) {
      const saved: Array<{ name: string; value: Record<string, unknown> }> = [], directories = new Set<string>();
      let targetedChildren = 0;
      const ports: Record<string, unknown> = {
        ROOT: root,
        execFileSync: (_command: string, args: string[]) => Buffer.from(args[0] === "rev-parse" ? finalHead : [...sourceBytes.keys()].join("\0") + "\0"),
        selectSourceInventory: () => [...sourceBytes.keys()], safeSourcePath: (file: string) => file,
        existsSync: (file: string) => sourceBytes.has(file) || directories.has(file),
        lstatSync: () => ({ isFile: () => true, isDirectory: () => true, isSymbolicLink: () => false }), realpathSync: (file: string) => file,
        readFileSync: (file: string, encoding?: string) => { const bytes = sourceBytes.get(file); assert.ok(bytes); return encoding ? bytes.toString() : bytes; },
        digest: sha256, qualifyLocalVerificationTargets: () => selected,
        localVerificationSourceGuardEffects: (entry: string) => closureEffects.find(effect => effect.entry === entry),
        resolve: path.resolve, join: path.join, sep: path.sep,
        mkdirSync: (file: string) => { directories.add(file); }, mkdtempSync: (prefix: string) => prefix + "controlled",
        writeFileSync: () => assert.fail("Controlled executor must use its receipt owner"),
        runOwnedVerificationChild: async (_ports: unknown, _args: unknown, _environment: unknown, name: string) => {
          if (name.startsWith("ordered-")) {
            assert.ok(name === "ordered-1-eslint" || name === "ordered-2-typescript");
            const code = kind === "typescript-failure" && name === "ordered-2-typescript" ? 2 : 0;
            return { code, rawExit: { code, signal: null }, cleanup: { status: "PASS", liveProcesses: 0, processTreeVerified: true } };
          }
          targetedChildren++;
          if (kind === "resolved-abort") return { code: -1, rawExit: { code: null, signal: "SIGABRT" }, identity, stdout: "", stderr: fatal, durationMs: 2, cleanup };
          const error = new Error("Owned child could not spawn");
          Object.defineProperty(error, "childResult", { value: { code: null, signal: null, identity: { ...identity, pid: null }, reason: "process_failure",
            durationMs: 1, stdout: "", stderr: "", cleanup } }); throw error;
        },
        verifyOwnedProcessReadiness: async () => ({ status: "PASS" }), stopChild: () => assert.fail("No controlled child is left registered"),
        readdirSync: () => [], rmSync: (file: string) => { directories.delete(file); },
        ownedPath: (context: { runDirectory: string }, name: string) => path.join(context.runDirectory, name),
        receipt: (_context: unknown, name: string, value: Record<string, unknown>) => { saved.push({ name, value: JSON.parse(JSON.stringify(value)) }); },
        localVerificationFamilyReceipt: () => assert.fail("A nonzero native exit cannot proceed to family receipt admission"),
        localVerificationFailureClassification: classify,
      };
      const names = Object.keys(ports);
      const executeActual = new Function("assert", "ts", "inspectLocalVerificationChangeImpact", "process", ...names,
        ts.transpileModule(orderedSourceFloorControlSource(file) + "\n" + executorNode.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
        + ";return executeLocalVerificationTargets;")(assert, ts, () => sourceReport, { env: {}, platform: "win32", execPath: "controlled-node", version: "controlled-version", versions: { v8: "controlled-v8" }, execArgv: [] }, ...names.map(name => ports[name])) as typeof execute;
      const result = await executeActual({ baselineHead }, new AbortController().signal);
      if (kind === "typescript-failure") {
        assert.equal(result.status, "BLOCKED"); assert.equal(result.commandAttempts, 0); assert.equal(result.executedCommands, 0);
        assert.equal(targetedChildren, 0); assert.deepEqual(result.results, []);
        assert.ok("originalChildResult" in result && result.originalChildResult && typeof result.originalChildResult === "object" && "code" in result.originalChildResult);
        assert.equal(result.originalChildResult.code, 2); continue;
      }
      assert.equal(result.status, "FAIL"); assert.equal(result.commandAttempts, 1); assert.equal(result.executedCommands, kind === "resolved-abort" ? 1 : 0);
      const leaf = saved.find(row => row.name.endsWith("-result.json"))!.value;
      assert.equal(leaf.exitCode, null); assert.equal(result.results[0]!.exitCode, null);
      const outcome = leaf.childOutcome as { rawExit: { code: number | null; signal: string | null }; identity: typeof identity };
      assert.equal(outcome.rawExit.code, null); assert.deepEqual(outcome.identity, kind === "resolved-abort" ? identity : { ...identity, pid: null });
      if (kind === "resolved-abort") {
        assert.equal(outcome.rawExit.signal, "SIGABRT");
        assert.equal((leaf.cause as { category: string }).category, "Runtime Crash");
        assert.equal((leaf.originalCause as { evidenceSha256: string }).evidenceSha256, sha256(fatal));
      }
      assert.equal(saved.filter(row => row.name === "targeted-result.json").length, 1);
    }
  } catch (error) { console.error("FAIL " + rawExitCase); throw error; }
  cases.push(rawExitCase);
}

async function localRiskVerificationOnly() {
  verifyFinalQualityGatePlan(); const plan = verifyLocalRiskVerificationPlan(); await verifyLocalRiskExecutionControls(plan.prefix);
  await verifyLocalRiskControlLeaseAdmission(); await verifyQualifiedFormHarnessControls(); await verifySharedChildControls(); await verifyAdoptionDeadlineControls(); await verifyAdmissionQualificationControls(); await verifyQualifiedSelectionControls(); verifyQualifiedResultControls(); verifyAdminMeasurementRestartPolicy();
  console.log(JSON.stringify({ status: "PASS", scope: "local-risk-verification-only", checks: cases.length, cases,
    canonicalPlannerExecuted: true, diagnosticPerformance: qualifiedFormDiagnosticCost,
    browserExecuted: false, dockerExecuted: false, databaseCalls: 0, networkRequests: null, externalNetworkRequests: 0, ownedLoopbackTransportExecuted: true,
    fullQualityGateExecuted: false, retainedPassUsedForAffectedChecks: false }, null, 2));
}

/** Existing verifier adapter; source mode reads only, explicit qualified mode delegates one canonical leaf. */
function verifyQualifiedResultControls() {
  const file = ts.createSourceFile("owner.mts", readSource("scripts/lib/isolated-public-verification.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const node = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "localVerificationFailureClassification");
  assert.ok(node);
  const classify = new Function(ts.transpileModule(node.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    + ";return localVerificationFailureClassification;")() as typeof import("./lib/isolated-public-verification.mts").localVerificationFailureClassification;
  const receiptNode = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "localVerificationFamilyReceipt"); assert.ok(receiptNode);
  const parse = new Function("assert", ts.transpileModule(receiptNode.getText(file).replace(/^export /u, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    + ";return localVerificationFamilyReceipt;")(assert) as typeof import("./lib/isolated-public-verification.mts").localVerificationFamilyReceipt;
  check("terminal receipt parsing accepts one actual family and rejects missing or duplicate PASS/FAIL evidence", () => {
    const pass = JSON.stringify({ family: "admin-form-save-cache", status: "PASS" });
    const fail = JSON.stringify({ family: "admin-form-save-cache", status: "FAIL" });
    assert.equal(parse("ordinary output\n" + pass, "admin-form-save-cache").status, "PASS");
    assert.throws(() => parse("ordinary output", "admin-form-save-cache"), /exactly one/u);
    assert.throws(() => parse(fail + "\n" + pass, "admin-form-save-cache"), /exactly one/u);
    assert.throws(() => parse(pass + "\n" + pass, "admin-form-save-cache"), /exactly one/u);
    assert.equal(parse(JSON.stringify({ family: "other", status: "FAIL" }) + "\n" + pass, "admin-form-save-cache").status, "PASS");
  });
  check("classification supports the complete taxonomy without guessing a Product cause from labels", () => {
    assert.ok(node.getText(file).includes('["Product", "QA / Test", "Fixture", "Harness", "Environment", "UNKNOWN"]'));
    for (const label of ["Product data lost", "flaky test", "Fixture timeout", "Harness failure", "Environment ENOSPC"]) {
      const result = classify({ stage: "execution", error: Error(label), exitCode: 1 });
      assert.equal(result.category, "UNKNOWN"); assert.equal(result.osCode, null);
    }
  });
  check("classification uses an actual operating-system error code and preserves its evidence", () => {
    for (const code of ["ENOSPC", "EACCES", "EROFS", "ENOENT", "EPERM"]) {
      const error = Object.assign(Error("Controlled evidence write"), { code });
      const result = classify({ stage: "evidence", error }); assert.equal(result.category, "Environment"); assert.equal(result.osCode, code);
    }
    assert.equal(classify({ stage: "evidence", error: { code: "ENOSPC" } }).category, "UNKNOWN");
    assert.equal(classify({ stage: "evidence", error: Object.assign(Error("unknown"), { code: "FAKE" }) }).category, "UNKNOWN");
  });
  check("only a zero-exit invalid terminal family receipt establishes a fixture protocol failure", () => {
    assert.equal(classify({ stage: "terminal_receipt", exitCode: 0, error: Error("Required receipt invalid") }).category, "Fixture");
    for (const exitCode of [null, 1, undefined]) assert.equal(classify({ stage: "terminal_receipt", exitCode }).category, "UNKNOWN");
    assert.equal(classify({ stage: "execution", exitCode: 0 }).category, "UNKNOWN");
  });
  check("timeouts and cancellation retain UNKNOWN rather than declaring flakiness or hiding a failure", () => {
    for (const childReason of ["timeout", "cancelled", "output_limit", "nonzero_exit"]) {
      const result = classify({ stage: "execution", childReason }); assert.equal(result.category, "UNKNOWN"); assert.ok(result.technicalKind.endsWith(childReason));
    }
  });
  check("native crash classification requires the actual fatal plus native abort and retained evidence hash", () => {
    const stderr = "# Check failed: jit_page_->allocations_.erase(addr) == 1.\n";
    const nativeEvidence = { stderr, stderrSha256: "a".repeat(64) };
    const actual = classify({ stage: "execution", exitCode: 2147483651, nativeEvidence });
    assert.equal(actual.category, "Runtime Crash"); assert.equal(actual.failureClass, "Node/V8 Runtime Crash");
    assert.equal(actual.rootCause, "UNKNOWN"); assert.equal(actual.confidence, "native_fatal_and_exit");
    for (const facts of [
      { exitCode: 0, nativeEvidence }, { exitCode: 1, nativeEvidence },
      { exitCode: 2147483651, nativeEvidence: { ...nativeEvidence, stderr: "Product V8 failure label" } },
      { exitCode: 2147483651, nativeEvidence: { ...nativeEvidence, stderrSha256: "missing" } },
    ]) assert.equal(classify({ stage: "execution", ...facts }).category, "UNKNOWN");
  });
  check("database transport and termination disposition remain separate from unproved causal attribution", () => {
    const actual = classify({ stage: "execution", error: Object.assign(Error("redacted"), { code: "APPLICATION_CLIENT_DISCONNECTED" }) });
    assert.equal(actual.failureClass, "Database Transport Failure"); assert.equal(actual.rootCause, "UNKNOWN");
    assert.equal(classify({ stage: "execution", error: Error("APPLICATION_CLIENT_DISCONNECTED") }).category, "UNKNOWN");
    assert.equal(classify({ stage: "execution", error: { code: "APPLICATION_CLIENT_DISCONNECTED" } }).category, "UNKNOWN");
    for (const [childReason, disposition] of [["timeout", "Timeout"], ["cancelled", "Cancellation"]]) {
      const result = classify({ stage: "execution", childReason });
      assert.equal(result.category, "UNKNOWN"); assert.equal(result.failureClass, disposition); assert.equal(result.rootCause, "UNKNOWN");
    }
  });
  check("qualified receipts retain run identity, first attempt, no retry, cleanup and sanitized log hashes", () => {
    const execute = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "executeLocalVerificationTargets"); assert.ok(execute);
    const source = execute.getText(file);
    for (const fragment of ["globalThis.crypto.randomUUID()", "runId: invocationId", "NOT_ASSESSED_SINGLE_ATTEMPT", "attempts:", "childOutcome:",
      "stdoutSha256: digest(stdout)", "stderrSha256: digest(stderr)", "cleanupFailurePreserved", "originalAttempt:", "A qualified leaf cannot execute twice in one path."])
      assert.ok(source.includes(fragment), "Missing retained execution invariant: " + fragment);
    assert.equal(source.includes("retry: 1"), false);
  });
}

async function changeImpactOnly() {
  try {
    const args = process.argv.slice(2);
    const ciMode = args.includes("--ci-change-impact");
    const executeMode = args.includes("--execute-qualified-impact");
    assert.equal(args.filter(argument => ["--change-impact-only", "--ci-change-impact", "--execute-qualified-impact"].includes(argument)).length, 1);
    assert.ok(ciMode ? args.length === 1 : args.every(argument => argument === "--change-impact-only" || argument === "--execute-qualified-impact" || /^--(?:impact-baseline|impact-record|additional-source)=.+$/u.test(argument)),
      "Change-impact inspection accepts only explicit baseline, review record and additional source arguments.");
    const one = (prefix: string) => {
      const values = args.filter(argument => argument.startsWith(prefix)); assert.ok(values.length <= 1, "Duplicate impact argument: " + prefix);
      return values[0]?.slice(prefix.length);
    };
    const recordPath = one("--impact-record=");
    assert.ok(!executeMode || !recordPath && !args.some(argument => argument.startsWith("--additional-source=")),
      "Qualified execution uses tracked source and an explicit baseline, never an approval record or untracked entry.");
    let impact: import("./lib/isolated-public-verification.mts").LocalVerificationImpact | undefined;
    if (recordPath) {
      const record = path.resolve(recordPath), evidenceRoot = path.resolve(root, ".tmp-qa") + path.sep;
      assert.ok(record.toLowerCase().startsWith(evidenceRoot.toLowerCase()) && record.endsWith(".json") && !/\.private\.|(?:^|[\\/])\.env(?:[.\\/]|$)/iu.test(record),
        "Impact review must be an explicit nonprivate JSON evidence file under this workspace's .tmp-qa directory.");
      assert.ok(lstatSync(record).isFile() && realpathSync(record) === record, "Impact review cannot traverse a symlink or junction.");
      try { impact = JSON.parse(readFileSync(record, "utf8")) as import("./lib/isolated-public-verification.mts").LocalVerificationImpact; }
      catch { throw Error("Invalid reviewed impact JSON; record values are not echoed."); }
      assert.ok(impact && typeof impact === "object" && !Array.isArray(impact), "Impact review JSON must contain an explicit reviewed record object.");
    }
    const baselineHead = one("--impact-baseline=") ?? impact?.baselineHead;
    assert.ok(ciMode || baselineHead, "Supply --impact-baseline=<40sha> or an explicit --impact-record=<path>; no baseline is inferred.");
    let ci: { eventName: string; event: unknown; githubSha: string } | undefined;
    if (ciMode) {
      const eventPath = process.env.GITHUB_EVENT_PATH, eventName = process.env.GITHUB_EVENT_NAME, githubSha = process.env.GITHUB_SHA;
      assert.ok(eventPath && eventName && githubSha, "CI source selection requires immutable GITHUB_EVENT_PATH, GITHUB_EVENT_NAME and GITHUB_SHA.");
      const eventFile = path.resolve(eventPath);
      assert.ok(lstatSync(eventFile).isFile() && realpathSync(eventFile) === eventFile, "CI event must be a regular immutable event file.");
      let event: unknown;
      try { event = JSON.parse(readFileSync(eventFile, "utf8")); } catch { throw Error("Invalid immutable CI event JSON; values are not echoed."); }
      ci = { eventName, event, githubSha };
    }
    const parsed = ts.createSourceFile("isolated-public-verification.mts", readSource("scripts/lib/isolated-public-verification.mts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const names = ["GATES", "localVerificationQualityPrefixDeadlineMs", "localVerificationOperationalDeadlineMs", "runLocalVerificationSourceFloor", "localVerificationAdmissionInvocations", "assertLocalVerificationAdmissionQualification", "qualifyLocalVerificationAdmission",
      "localVerificationAssertionRelocationRequired", "validateLocalVerificationAssertionRelocations", "validateLocalVerificationInputObservations", "localVerificationInstalledRuntimePackages", "localVerificationAdmissionRuntimeIdentity",
      "finalQualityScriptNames", "localVerificationSemanticSource", "localVerificationPresentationSource", "deriveLocalVerificationSourceImpact", "deriveLocalVerificationSourceCoherence", "resolveLocalVerificationCiBaseline", "localVerificationCiDiagnostic", "localVerificationSourceGuardEffects", "qualifyLocalVerificationTargets", "assertLocalVerificationProtectionMaintenance",
      "localVerificationCommandSteps", "planLocalVerification", "registeredVerificationNodeEntries", "localVerificationCoverage", "readLocalVerificationInputs", "inspectLocalVerificationChangeImpact", "safeSourcePath",
      "localVerificationFamilyReceipt", "localVerificationFailureClassification", "executeLocalVerificationTargets", "ownedPath", "receipt", "stopChild", "runOwnedVerificationChild", "ownedProcessCleanupQualification", "verifyOwnedProcessReadiness"];
    const declarations = names.map(name => {
      const found = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name
        || ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(parsed) === name));
      assert.ok(found, "Missing canonical source impact declaration: " + name); return found.getText(parsed).replace(/^export /u, "");
    });
    const code = ts.transpileModule(adminAdoptionControlSource(parsed) + "\n" + declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const api = new Function("assert", "execFileSync", "ROOT", "digest", "selectSourceInventory", "sourceIncluded", "existsSync", "lstatSync", "readlinkSync", "realpathSync", "readFileSync", "resolve", "dirname", "isAbsolute", "ts", "collectExecutableSourceGraph",
      "spawn", "mkdtempSync", "mkdirSync", "writeFileSync", "rmSync", "readdirSync", "join", "sep", "nodeModule", "windowsOwnedProcessCapability", "spawnWindowsOwnedProcess", "fileURLToPath", "createHash", code + ";return {inspectLocalVerificationChangeImpact,executeLocalVerificationTargets,qualifyLocalVerificationAdmission};")(
      assert, execFileSync, root, sha256, selectSourceInventory, sourceIncluded, existsSync, lstatSync, readlinkSync, realpathSync, readFileSync, path.resolve, path.dirname, path.isAbsolute, ts, collectExecutableSourceGraph,
      spawn, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, path.join, path.sep, { createRequire, isBuiltin }, windowsOwnedProcessCapability, spawnWindowsOwnedProcess, fileURLToPath, createHash) as
      Pick<typeof import("./lib/isolated-public-verification.mts"), "inspectLocalVerificationChangeImpact" | "executeLocalVerificationTargets" | "qualifyLocalVerificationAdmission">;
    if (executeMode) {
      const { sourceReport: report, ...targetedExecution } = await api.executeLocalVerificationTargets({ baselineHead: baselineHead! }, new AbortController().signal);
      const combined = { ...report, sourceStatus: report.status, status: targetedExecution.status, targetedExecution,
        qualifiedBehavioralPass: "qualifiedBehavioralPass" in targetedExecution && targetedExecution.qualifiedBehavioralPass === true, candidateCommandsExecuted: targetedExecution.executedCommands,
        browserExecuted: targetedExecution.browserExecuted, sourceNetworkRequests: report.networkRequests, networkRequests: targetedExecution.commandAttempts ? null : 0,
        exitCode: targetedExecution.exitCode, behavioralPass: false, releaseEvidence: false };
      console.log(JSON.stringify(combined, null, 2)); process.exitCode = combined.exitCode; return;
    }
    const discovery = ciMode ? api.inspectLocalVerificationChangeImpact({ automatic: true, ci }) : undefined;
    const qualificationNeeded = discovery && "changeImpact" in discovery && discovery.changeImpact?.qaQuality?.some(row => row.failures.length);
    const admissionQualification = qualificationNeeded ? await api.qualifyLocalVerificationAdmission({ ci }, new AbortController().signal) : undefined;
    const report = api.inspectLocalVerificationChangeImpact({ baselineHead, impact, automatic: ciMode, ci,
      ...(admissionQualification?.status === "PASS" ? { admissionQualification } : {}),
      additionalSourceFiles: args.filter(argument => argument.startsWith("--additional-source=")).map(argument => argument.slice("--additional-source=".length)) });
    const combined = admissionQualification?.status === "BLOCKED" ? { ...report, status: "BLOCKED_ADMISSION_QUALIFICATION", exitCode: 1, admissionQualification } : report;
    console.log(JSON.stringify(combined, null, 2)); process.exitCode = combined.exitCode;
  } catch (error) {
    console.log(JSON.stringify({ status: "BLOCKED_SOURCE_CONSISTENCY", releaseEvidence: false, checksExecuted: 0, browserExecuted: false,
      databaseCalls: 0, networkRequests: 0, diagnostic: error instanceof Error ? error.message.split(/\r?\n/u)[0] : "Invalid impact inspection input." }, null, 2));
    process.exitCode = 1;
  }
}

async function verifyMigrationToolPlatforms(lock: StackLock) {
  const cli = await import("./lib/isolated-supabase-cli.mts");
  check("migration tool selection preserves the exact existing Windows lock", () => {
    assert.equal(cli.selectApplicationMigrationTool(lock, "win32", "x64"), lock.applicationMigrationTool);
    assert.equal(lock.applicationMigrationTool.executableSha256, "5ccda93866ff48a3ec4a580679d71a44b9ee41150fb6143bdd4a6a57d3ecef1a");
  });
  check("Linux migration tool matches the independently verified npm package pin", () => {
    const tool = cli.selectApplicationMigrationTool(lock, "linux", "x64");
    const packageLock = JSON.parse(readSource("package-lock.json"));
    const npm = packageLock.packages["node_modules/@supabase/cli-linux-x64"];
    assert.equal(tool.packageIntegrity, npm.integrity);
    assert.equal(tool.version, npm.version);
    assert.equal(tool.executableSha256, "3cfb10e8cb7b8cb4d6807117865a2a39891178ec83f4d0c86ac49f633d2c43f4");
    assert.equal(tool.executablePathInPackage, "package/bin/supabase");
  });
  for (const [platform, architecture] of [["darwin", "x64"], ["linux", "arm64"], ["win32", "arm64"]] as const) {
    check("migration tool rejects unsupported host " + platform + "-" + architecture, () => {
      assert.throws(() => cli.selectApplicationMigrationTool(lock, platform, architecture), { code: "UNSUPPORTED_CLI_PLATFORM" });
    });
  }
  check("Linux selection cannot fall back to a Windows pin", () => {
    assert.throws(() => cli.selectApplicationMigrationTool({ ...lock, applicationMigrationToolLinuxX64: lock.applicationMigrationTool }, "linux", "x64"), { code: "CLI_PLATFORM_LOCK_MISMATCH" });
  });
  check("Linux tool rejects a cross-platform package or executable path", () => {
    for (const bad of [{ package: "@supabase/cli-windows-x64" }, { executablePathInPackage: "package/bin/supabase.exe" }]) {
      assert.throws(() => cli.assertApplicationMigrationTool({ ...lock.applicationMigrationToolLinuxX64, ...bad }), { code: "INVALID_MIGRATION_TOOL_LOCK" });
    }
  });
}

async function verifyRestoreAclPolicy() {
  const { planPublicSchemaUsageRestore } = await import("./lib/isolated-application-restore-verification.mts");
  type Acl = import("./lib/isolated-application-restore-verification.mts").PublicSchemaAcl;
  const publicGrant = { grantor: "pg_database_owner", grantee: "PUBLIC", privilege_type: "USAGE", is_grantable: false };
  const before: Acl = { owner: "pg_database_owner", acl: [publicGrant,
    { ...publicGrant, grantee: "pg_database_owner", privilege_type: "CREATE" },
    { ...publicGrant, grantee: "pg_database_owner" }, { ...publicGrant, grantee: "anon" }] };
  const after: Acl = { ...before, acl: before.acl.filter(row => row.grantee !== "PUBLIC") };
  const security = [{ kind: "schema", name: "public", fingerprint: "a".repeat(32) },
    { kind: "relation", name: "topics", fingerprint: "b".repeat(32) },
    { kind: "default-acl", name: "postgres.public.r", fingerprint: "c".repeat(32) }];
  const rawSecurity = security.map(row => row.kind === "schema" ? { ...row, fingerprint: "d".repeat(32) } : row);
  check("restore ACL skips unchanged captured security", () => assert.deepEqual(planPublicSchemaUsageRestore(security, security, before, before), { restorePublicUsage: false }));
  check("restore ACL permits only captured original PUBLIC USAGE", () => assert.deepEqual(planPublicSchemaUsageRestore(security, rawSecurity, before, after), { restorePublicUsage: true, recordedGrant: publicGrant }));
  const reject = (name: string, first: Acl, second: Acl, earlier = security, later = rawSecurity) =>
    check("restore ACL rejects " + name, () => assert.throws(() => planPublicSchemaUsageRestore(earlier, later, first, second)));
  reject("different original owner", { ...before, owner: "postgres" }, after);
  reject("changed restored owner", before, { ...after, owner: "postgres" });
  reject("missing unrelated role", before, { ...before, acl: before.acl.filter(row => row.grantee !== "anon") });
  reject("PUBLIC CREATE instead of captured USAGE", { ...before, acl: before.acl.map(row => row.grantee === "PUBLIC" ? { ...row, privilege_type: "CREATE" } : row) }, after);
  reject("different original grantor", { ...before, acl: before.acl.map(row => row.grantee === "PUBLIC" ? { ...row, grantor: "postgres" } : row) }, after);
  reject("original grant option", { ...before, acl: before.acl.map(row => row.grantee === "PUBLIC" ? { ...row, is_grantable: true } : row) }, after);
  reject("no original PUBLIC grant", after, after);
  reject("an extra missing grant", before, { ...after, acl: after.acl.filter(row => row.grantee !== "anon") });
  reject("an added privilege", before, { ...after, acl: [...after.acl, { ...publicGrant, privilege_type: "CREATE" }] });
  reject("another object's owner or ACL", before, after, security, rawSecurity.map(row => row.kind === "relation" ? { ...row, fingerprint: "e".repeat(32) } : row));
  reject("default privilege drift", before, after, security, rawSecurity.map(row => row.kind === "default-acl" ? { ...row, fingerprint: "e".repeat(32) } : row));
  reject("object membership loss", before, after, security, rawSecurity.filter(row => row.kind !== "relation"));
  reject("duplicate ACL tuple", { ...before, acl: [...before.acl, publicGrant] }, after);
  reject("expanded ACL disagrees with equal fingerprints", before, after, security, security);
  reject("duplicate security object", before, after, security, [...rawSecurity, rawSecurity[0]]);
  check("restore keeps exact other DDL and transactional ACL guards", () => {
    const source = readSource("scripts/lib/isolated-application-restore-verification.mts");
    const securityCheck = source.indexOf("assert.deepEqual(transactionSecurity, beforeSecurity");
    const expandedCheck = source.indexOf("assert.deepEqual(transactionAcl.acl, beforePublicAcl.acl");
    const commit = source.indexOf('await handle.query("commit")');
    assert.ok(securityCheck >= 0 && expandedCheck >= 0 && commit >= 0);
    assert.ok(securityCheck < commit && expandedCheck < commit);
    assert.ok(source.includes('await handle.query("rollback")'));
    assert.ok(source.includes('assert.equal(normalizeSchema(schemaAfter, after.identity), normalizeSchema(schemaBefore, before.identity)'));
    assert.equal(source.includes('replace("REVOKE USAGE'), false);
  });
}

async function restoreAclOnly() {
  await verifyRestoreAclPolicy();
  console.log(JSON.stringify({ status: "PASS", scope: "strict captured restore ACL policy", checks: cases.length, cases, dockerExecuted: false, databaseCalls: 0, networkRequests: 0 }, null, 2));
}

async function main() {
  await verifyOrderedLocalVerificationControls();
  await verifyOwnedAdminFixtureDelivery();
  const closure = await verifyApplicationClosureCheckpointsOffline();
  cases.push(...closure.cases);
  await verifyRestoreAclPolicy();
  verifyFinalQualityGatePlan();
  const riskPlan = verifyLocalRiskVerificationPlan();
  await verifyLocalRiskExecutionControls(riskPlan.prefix);
  await verifyLocalRiskControlLeaseAdmission();
  await verifyQualifiedFormHarnessControls();
  await verifySharedChildControls();
  await verifyAdoptionDeadlineControls();
  const admissionControls = await verifyAdmissionQualificationControls();
  await verifyQualifiedSelectionControls();
  verifyQualifiedResultControls();
  await verifyRetainedFinalQualityAdmissionControls(admissionControls); await verifyRetainedFinalQualityWorkerControls();
  await verifyOwnedPublicImageConfig();
  verifyScanner();
  const provenance = verifyReleaseLock();
  const sources = ["scripts/lib/isolated-supabase.mts", "scripts/qa-isolated-supabase.mts", "scripts/lib/isolated-public-application.mts", "scripts/lib/isolated-supabase-cli.mts"];
  const hashes: Record<string, string> = {};
  for (const filename of sources) {
    const source = readSource(filename);
    hashes[filename] = sha256(source);
    check(`canonical source boundary: ${filename}`, () => assert.deepEqual(sourceFailures(source, filename), []));
  }

  // Importing the lifecycle owner must be passive. Only pure exported guards are
  // invoked below; run/start/cleanup, Docker, SQL and environment loaders are not.
  const owner = await import("./lib/isolated-supabase.mts");
  verifyExistingResourcePreservationComparison(owner);
  await verifyMigrationToolPlatforms(provenance.lock);
  await verifyAdminMeasurementControlLease(owner);
  verifyAdminMeasurementRestartPolicy();
  verifyImageIdentity(owner, provenance.lock.images.db);
  const password = "offline-unit-secret-not-a-credential";
  const target = { port: 55965, database: "postgres" as const, username: "postgres" as const };
  const url = `postgres://postgres:${password}@127.0.0.1:55965/postgres`;
  function rejectsSafely(name: string, call: () => void) {
    check(name, () => assert.throws(call, error => {
      assert.ok(error instanceof owner.IsolatedSupabaseError);
      assert.match(error.code, /^[A-Z0-9_]+$/u);
      assert.ok(!error.message.includes(password), "Error must not disclose credentials.");
      return true;
    }));
  }
  for (const protocol of ["postgres:", "postgresql:"]) {
    for (const username of ["postgres", "supabase_admin"] as const) {
      check(`target accepts exact owned loopback ${protocol}/${username}`, () => owner.assertLoopbackDatabaseTarget(`${protocol}//${username}:${password}@127.0.0.1:55965/postgres`, { ...target, username }));
    }
  }
  const invalidTargets: Array<[string, string]> = [
    ["remote host", url.replace("127.0.0.1", "example.supabase.co")],
    ["DNS localhost", url.replace("127.0.0.1", "localhost")],
    ["unspecified host", url.replace("127.0.0.1", "0.0.0.0")],
    ["different port", url.replace(":55965", ":55445")],
    ["different database", url.replace("/postgres", "/production")],
    ["different role", url.replace("//postgres:", "//service_role:")],
    ["query options", `${url}?host=remote.example`],
    ["URL fragment", `${url}#override`],
    ["wrong protocol", url.replace("postgres:", "https:")],
    ["short password", url.replace(password, "short")],
    ["missing authority", "postgres:postgres"],
  ];
  for (const [name, value] of invalidTargets) rejectsSafely(`target rejects ${name}`, () => owner.assertLoopbackDatabaseTarget(value, target));
  for (const port of [0, 1024, 65536, Number.NaN, 55965.5]) rejectsSafely(`target rejects invalid expected port ${port}`, () => owner.assertLoopbackDatabaseTarget(url, { ...target, port }));
  rejectsSafely("target rejects a JavaScript caller forging the expected role allowlist", () => owner.assertLoopbackDatabaseTarget(url.replace("//postgres:", "//authenticator:"), { ...target, username: "authenticator" as typeof target.username }));

  for (const [name, candidate] of [["null", null], ["plain object", {}], ["frozen spoof", Object.freeze({ identity: { database: "postgres", host: "127.0.0.1", port: 55965 }, query() { throw Error("must not execute"); } })], ["array", []]] as const) {
    rejectsSafely(`handoff rejects ${name}`, () => owner.assertOwnedLocalHandle(candidate));
  }

  const runId = "a".repeat(32), projectName = `venisia-qa-${runId}`;
  const identity: Parameters<typeof owner.assertOwnedResource>[1] = {
    kind: "container", id: "b".repeat(64), name: `${projectName}-db-1`, runId, projectName,
    imageId: "sha256:" + "c".repeat(64), createdAt: "2026-01-01T00:00:00Z",
    mounts: [{ type: "volume", name: `${projectName}-database`, destination: "/var/lib/postgresql/data" }],
    networkIdentity: { id: "d".repeat(64), name: `${projectName}-isolated` },
  };
  check("cleanup guard accepts the exact owned container snapshot", () => owner.assertOwnedResource(structuredClone(identity), identity));
  for (const kind of ["network", "volume"] as const) {
    const resource = { kind, id: kind === "volume" ? `${projectName}-database` : "d".repeat(64), name: `${projectName}-${kind}`, runId, projectName };
    check(`cleanup guard accepts the exact owned ${kind} snapshot`, () => owner.assertOwnedResource(structuredClone(resource), resource));
    rejectsSafely(`cleanup guard rejects a replaced ${kind} ID`, () => owner.assertOwnedResource({ ...resource, id: "unrelated-resource" }, resource));
  }
  const changed: Array<[string, Partial<typeof identity>]> = [
    ["id", { id: "e".repeat(64) }], ["name", { name: "another-db" }], ["kind", { kind: "network" }],
    ["run", { runId: "f".repeat(32) }], ["project", { projectName: "old-project" }],
    ["image", { imageId: "sha256:" + "f".repeat(64) }], ["creation", { createdAt: "2025-01-01T00:00:00Z" }],
    ["mounts", { mounts: [] }], ["network", { networkIdentity: { id: "e".repeat(64) } }],
  ];
  for (const [name, delta] of changed) rejectsSafely(`cleanup guard rejects changed ${name}`, () => owner.assertOwnedResource({ ...identity, ...delta }, identity));
  rejectsSafely("cleanup guard rejects malformed expected run", () => owner.assertOwnedResource(identity, { ...identity, runId: "old" }));
  rejectsSafely("cleanup guard rejects unrelated expected project", () => owner.assertOwnedResource(identity, { ...identity, projectName: "old-project" }));
  rejectsSafely("cleanup guard rejects abbreviated expected ID", () => owner.assertOwnedResource(identity, { ...identity, id: "b".repeat(12) }));

  check("child environment excludes supplied Production, Auth and Docker overrides", () => {
    const env = owner.cleanChildEnvironment({ PATH: "offline-tool-path", DATABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: password, ADMIN_SESSION_SECRET: password, NODE_OPTIONS: "--require untrusted.cjs", DOCKER_HOST: "tcp://remote.invalid:2375" });
    assert.equal(env.PATH, "offline-tool-path");
  for (const key of ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET", "NODE_OPTIONS", "DOCKER_HOST"]) assert.equal(env[key], undefined);
  });

  const { compose, run: composeRun } = offlineComposeFixture(owner, provenance.lock);
  type Compose = typeof compose;
  check("compose guard accepts a resolved owned offline fixture with pinned read-only input", () => owner.validateComposeConfig(compose, provenance.lock, composeRun));
  const badCompose: Array<[string, (config: Compose) => void]> = [
    ["different project", config => { config.name = "old-project"; }],
    ["missing ownership label", config => { delete config.services.db.labels["com.venisia.qa.run"]; }],
    ["unlocked image", config => { config.services.db.image = "supabase/postgres:latest"; }],
    ["automatic restart", config => { config.services.db.restart = "always"; }],
    ["privileged service", config => { config.services.db.privileged = true; }],
    ["host network", config => { config.services.db.network_mode = "host"; }],
    ["external env file", config => { config.services.db.env_file = ".env.local"; }],
    ["local image build", config => { config.services.db.build = "."; }],
    ["non-loopback binding", config => { config.services.db.ports = [{ host_ip: "0.0.0.0", published: "55965", target: 5432 }]; }],
    ["Docker loopback publishing", config => { config.services.db.ports = [{ host_ip: "127.0.0.1", published: "55445", target: 5432 }]; }],
    ["reused external volume", config => { config.volumes.database.external = true; }],
    ["unowned named volume", config => { config.volumes.database.name = "old-volume"; }],
    ["external network", config => { config.networks.isolated.external = true; }],
    ["network egress", config => { config.networks.isolated.internal = false; }],
    ["unowned service network", config => { config.services.db.networks = { old: {} }; }],
    ["writable source bind", config => { config.services.db.volumes![0].read_only = false; }],
    ["unlocked source bind", config => { config.services.db.volumes![0].source = path.join(composeRun.upstreamRoot, "unlocked.sql"); }],
    ["old volume mount", config => { config.services.db.volumes![1].source = "old-volume"; }],
  ];
  for (const [name, mutate] of badCompose) rejectsSafely(`compose guard rejects ${name}`, () => {
    const candidate = structuredClone(compose); mutate(candidate); owner.validateComposeConfig(candidate, provenance.lock, composeRun);
  });
  rejectsSafely("compose guard rejects an additional workload", () => owner.validateComposeConfig({ ...compose, services: { ...compose.services, unknown: compose.services.db } }, provenance.lock, composeRun));

  const app = await import("./lib/isolated-public-application.mts");
  let queryCalls = 0, recordCalls = 0;
  const forgedHandle: Parameters<typeof app.runApplicationHandoff>[0] = {
    identity: { runId, projectName, database: "postgres", host: "127.0.0.1", port: 55965, databaseContainerId: identity.id },
    async query() { queryCalls++; return { rows: [], rowCount: 0 }; },
    async renewDatabaseControlConnection() { throw Error("Unowned handle must not renew its control connection."); },
    async generateDatabaseTypes() { throw Error("Unowned handle must not generate database types."); },
    async callDataApiRpc() { throw Error("Unowned handle must not invoke the Data API."); },
    async readDataApi() { throw Error("Unowned handle must not read the Data API."); },
    async withDatabaseConnection() { throw Error("Unowned handle must not open a database connection."); },
    async pushApplicationMigrations() { throw Error("Unowned handle must not reach the CLI."); },
    async runEntitySeoBackfill() { throw Error("Unowned handle must not reach the backfill."); },
    async preparePublicVerification() { throw Error("Unowned handle must not prepare Public verification."); },
    async prepareAdminInteractions() { throw Error("Unowned handle must not prepare Admin measurement fixtures."); },
    async runPublicVerification() { throw Error("Unowned handle must not run Public verification."); },
    record() { recordCalls++; },
  };
  await assert.rejects(app.runApplicationHandoff(forgedHandle), error => error instanceof owner.IsolatedSupabaseError && error.code === "UNOWNED_OR_EXPIRED_HANDLE");
  check("application handoff rejects forged ownership before any SQL or recorder call", () => { assert.equal(queryCalls, 0); assert.equal(recordCalls, 0); });

  for (const filename of sources) assert.equal(sha256(readSource(filename)), hashes[filename], "Owner source changed during verification.");
  assert.equal(sha256(readSource("scripts/fixtures/isolated-supabase/stack.lock.json")), provenance.hash);
  console.log(JSON.stringify({ status: "PASS", checks: cases.length, cases, sourceHashes: hashes, lockSha256: provenance.hash, dockerExecuted: false,
    networkRequests: null, externalNetworkRequests: 0, ownedLoopbackTransportExecuted: true, databaseCalls: 0, environmentLoaded: false, integrationReadinessClaimed: false }, null, 2));
}

async function cliDiagnosticsOnly() {
  const { parseApplicationMigrationCliResult, applicationMigrationChildEnvironment } = await import("./lib/isolated-supabase-cli.mts");
  const lock = JSON.parse(readSource("scripts/fixtures/isolated-supabase/stack.lock.json"));
  const request = { mode: "dry-run" as const, stage: { files: [], corpusSha256: "a".repeat(64) } };
  const secret = "sensitive-example-that-must-never-be-returned";
  const examples = [
    ["The server does not support SSL connections", "ssl_not_supported"],
    ["SELF_SIGNED_CERT_IN_CHAIN", "tls_rejected"],
    ["connect ECONNREFUSED", "connection_refused"],
    ["connect ETIMEDOUT", "connection_timeout"],
    ["password authentication failed (SQLSTATE 28P01)", "authentication_failed"],
    ["ERROR: blocked (SQLSTATE 42501)", "sql_error"],
    ["unknown failure", "unclassified"],
  ];
  for (const [message, failureClass] of examples) check(`CLI diagnostics classify ${failureClass} without returning sensitive text`, () => {
    const stdout = JSON.stringify({ _tag: "Error", error: { code: "LegacyDbConnectError", message, detail: secret } });
    const result = parseApplicationMigrationCliResult({ exitCode: 1, stdout, stderr: secret }, request, lock.applicationMigrationTool);
    assert.equal(result.failureClass, failureClass);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.deepEqual(result.pendingFiles, []);
  });
  check("successful CLI result retains a null failure category", () => {
    const result = parseApplicationMigrationCliResult({ exitCode: 0,
      stdout: JSON.stringify({ upToDate: true, dryRun: true, migrations: [], seeds: [], roles: [] }), stderr: "" }, request, lock.applicationMigrationTool);
    assert.equal(result.failureClass, null);
  });
  check("owned CLI transport explicitly matches local server SSL without inheriting connection overrides", () => {
    const env = applicationMigrationChildEnvironment("E:\\owned\\home", "E:\\owned\\stage", secret,
      { PGHOST: "remote.invalid", PGPORT: "5432", PGSERVICE: "external", PGSSLMODE: "require", PGSSLROOTCERT: "external", SUPABASE_DB_URL: "external" });
    assert.equal(env.PGSSLMODE, "disable");
    assert.equal(env.PGPASSWORD, secret);
    for (const key of ["PGHOST", "PGPORT", "PGSERVICE", "PGSSLROOTCERT", "SUPABASE_DB_URL"]) assert.equal(env[key], undefined);
  });
  console.log(JSON.stringify({ status: "PASS", scope: "CLI sanitized diagnostics only", checks: cases.length, cases,
    cliExecuted: false, databaseCalls: 0, networkRequests: 0, retainedNavigationGatesReexecuted: false }, null, 2));
}

async function closureCheckpointsOnly() {
  console.log(JSON.stringify(await verifyApplicationClosureCheckpointsOffline(), null, 2));
}

function verifyRetainedFinalQualityReconciliationSourceControls(seed: {
  impact: Parameters<typeof import("./lib/isolated-public-verification.mts").assertRetainedFinalQualitySource>[0];
  retained: { invocationHeadSha: string; sourceSha256: string; manifest: Array<{ file: string; sha256: string }> };
  candidate: { invocationHeadSha: string; sourceSha256: string; manifest: Array<{ file: string; sha256: string }> };
  lifecycleAuthority: { owners: Record<string, string>; sourceSha256: string };
}) {
  type Source = typeof seed.retained;
  type Impact = typeof seed.impact;
  type Owner = NonNullable<Impact["ledgerReconciliation"]>["owners"][number];
  type Rule = { beforeSha256: string; beforeStatementsSha256: string; afterSha256: string | null; afterStatementsSha256: string; role: string };
  type Authority = { sourceHead: string; sourceSha256: string; previousImpactSha256: string; owners: Record<string, Rule>;
    reportPaths: string[]; entryAdditions: string[]; absentListboxInsertion: string; proofFunctionSha256: string; correctionTypeSha256: string;
    authorizationNavigation: { path: string; role: string; beforeElement: string; afterElement: string };
    historicalQualificationGuards: Array<{ path: string; export: string; declarationSha256: string }> };
  const publicPath = "scripts/lib/isolated-public-verification.mts";
  const manifestPath = "src/lib/admin/interaction-system/adoption-manifest.ts";
  const ownerSource = readSource(publicPath);
  const parse = (file: string, source: string) => {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0);
    return tree;
  };
  const nodeName = (node: ts.Statement) => ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) ? node.name?.text
    : ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 && ts.isIdentifier(node.declarationList.declarations[0].name)
      ? node.declarationList.declarations[0].name.text : undefined;
  const named = (source: string, name: string) => {
    const tree = parse(publicPath, source), nodes = tree.statements.filter(node => nodeName(node) === name);
    assert.equal(nodes.length, 1); return { tree, node: nodes[0] };
  };
  const declarationText = (source: string, name: string) => { const { tree, node } = named(source, name); return node.getText(tree).replace(/\r\n/gu, "\n"); };
  const statementsHash = (file: string, source: string) => { const tree = parse(file, source); return sha256(tree.statements.map(node => node.getText(tree).replace(/\r\n/gu, "\n")).join("\n")); };
  const replaceConstant = (source: string, name: string, value: unknown) => {
    const { tree, node } = named(source, name); assert.ok(ts.isVariableStatement(node));
    const init = node.declarationList.declarations[0].initializer;
    assert.ok(init && ts.isCallExpression(init) && init.expression.getText(tree) === "Object.freeze" && init.arguments.length === 1);
    return source.slice(0, init.arguments[0].getStart(tree)) + JSON.stringify(value) + source.slice(init.arguments[0].getEnd());
  };
  const constantNode = named(ownerSource, "RETAINED_QUALITY_RECONCILIATION_BASELINE"); assert.ok(ts.isVariableStatement(constantNode.node));
  const constantInit = constantNode.node.declarationList.declarations[0].initializer;
  assert.ok(constantInit && ts.isCallExpression(constantInit) && constantInit.arguments.length === 1);
  const declared = JSON.parse(constantInit.arguments[0].getText(constantNode.tree)) as Authority;
  // Normalize only this controlled fixture's manifest and insertion; production raw authority stays exact.
  declared.absentListboxInsertion = declared.absentListboxInsertion.replace(/\r\n/gu, "\n");
  declared.authorizationNavigation.beforeElement = declared.authorizationNavigation.beforeElement.replace(/\r\n/gu, "\n");
  declared.authorizationNavigation.afterElement = declared.authorizationNavigation.afterElement.replace(/\r\n/gu, "\n");
  const paths = Object.keys(declared.owners).sort();
  // Fixture data ports only. Neither historical source files nor QA artifacts are read.
  const prior = structuredClone(seed), previousImpact = prior.impact, previous = prior.candidate, retained = prior.retained;
  const oldAuthority = prior.lifecycleAuthority, oldCorrection = previousImpact.qualityLifecycleCorrection!;
  const baseline = oldCorrection.baselineSource; baseline.manifest = structuredClone(baseline.manifest);
  const oldPublic = oldCorrection.owners.find(row => row.path === publicPath)!; assert.ok(oldPublic);
  oldPublic.beforeSha256 = sha256(oldPublic.beforeSource); oldAuthority.owners[publicPath] = oldPublic.beforeSha256;
  for (const source of [retained, baseline]) source.manifest.find(row => row.file === publicPath)!.sha256 = oldPublic.beforeSha256;
  // Historical authorization eligibility is a controlled source fixture. Current
  // Product presentation is not the reviewed historical seam or retained proof.
  const authorizationSource = "export function HistoricalAuthorizationFixture(item: { key: string; connectionId?: string }) {\n  return (" + declared.authorizationNavigation.afterElement + ");\n}\n";
  const after = new Map(paths.map(file => [file, file === declared.authorizationNavigation.path ? authorizationSource
    : file === manifestPath ? readSource(file).replace(/\r\n/gu, "\n") : readSource(file)]));
  const before = new Map<string, string>();
  for (const file of paths) {
    const old = oldCorrection.owners.find(row => row.path === file);
    const raw = after.get(file)!;
    const text = old?.afterSource ?? (file === manifestPath ? raw.replace(declared.absentListboxInsertion, "") : file === declared.authorizationNavigation.path ? raw.replace(declared.authorizationNavigation.afterElement, declared.authorizationNavigation.beforeElement) : "export const fixtureBefore = " + JSON.stringify(file) + ";\n");
    if (file === manifestPath) { assert.equal(raw.split(declared.absentListboxInsertion).length, 2); assert.notEqual(text, raw); }
    if (file === declared.authorizationNavigation.path) { assert.equal(raw.split(declared.authorizationNavigation.afterElement).length, 2); assert.equal(text.split(declared.authorizationNavigation.beforeElement).length, 2); assert.notEqual(text, raw); }
    before.set(file, text);
    if (!old) for (const source of [retained, baseline, previous]) source.manifest.push({ file, sha256: sha256(text) });
  }
  for (const file of [...declared.reportPaths, "docs/reports/unrelated-fixture.md", "package.json", "next.config.ts", "sql/migrations/fixture.sql"]) {
    assert.equal(previous.manifest.some(row => row.file === file), false);
    for (const source of [retained, baseline, previous]) source.manifest.push({ file, sha256: sha256("unchanged fixture " + file) });
  }
  for (const source of [retained, baseline]) {
    source.manifest.sort((a, b) => a.file.localeCompare(b.file)); source.sourceSha256 = sha256(JSON.stringify(source.manifest));
  }
  oldAuthority.sourceSha256 = baseline.sourceSha256;
  oldPublic.afterSource = replaceConstant(oldPublic.afterSource, "RETAINED_QUALITY_LIFECYCLE_BASELINE", oldAuthority);
  before.set(publicPath, oldPublic.afterSource);
  for (const row of oldCorrection.owners) {
    row.afterSha256 = sha256(row.afterSource); previous.manifest.find(item => item.file === row.path)!.sha256 = row.afterSha256;
  }
  previous.manifest.sort((a, b) => a.file.localeCompare(b.file)); previous.sourceSha256 = sha256(JSON.stringify(previous.manifest));
  previousImpact.retained.sourceSha256 = retained.sourceSha256; previousImpact.candidate.sourceSha256 = previous.sourceSha256;
  oldCorrection.baselineReportImpact.retained.sourceSha256 = retained.sourceSha256;
  oldCorrection.baselineReportImpact.candidate.sourceSha256 = baseline.sourceSha256;
  const originalMap = new Map(retained.manifest.map(row => [row.file, row.sha256]));
  previousImpact.changes = previous.manifest.filter(row => row.sha256 !== originalMap.get(row.file)).map(row => ({ path: row.file,
    beforeSha256: originalMap.get(row.file) ?? null, afterSha256: row.sha256,
    role: row.file === ".env.example" ? "preexisting-tracked-public-environment-template" : "exact-quality-lifecycle-correction" })).sort((a, b) => a.path.localeCompare(b.path));
  const added = ["RetainedQualityReconciliationCorrection", "RETAINED_QUALITY_RECONCILIATION_BASELINE", "assertRetainedFinalQualityReconciliationSource"];
  const publicTree = parse(publicPath, ownerSource);
  const publicBody = publicTree.statements.filter(node => !added.includes(nodeName(node) ?? "")).map(node => {
    let text = node.getText(publicTree).replace(/\r\n/gu, "\n");
    if (nodeName(node) === "assertRetainedFinalQualitySource") for (const addition of declared.entryAdditions) { assert.equal(text.split(addition).length, 2); text = text.replace(addition, ""); }
    return text;
  }).join("\n");
  const authority: Authority = { ...structuredClone(declared), sourceHead: previous.invocationHeadSha, sourceSha256: previous.sourceSha256,
    previousImpactSha256: sha256(JSON.stringify(previousImpact)), owners: {} };
  for (const file of paths) authority.owners[file] = { beforeSha256: sha256(before.get(file)!), beforeStatementsSha256: statementsHash(file, before.get(file)!),
    afterSha256: file === publicPath ? null : sha256(after.get(file)!), afterStatementsSha256: file === publicPath ? sha256(publicBody) : statementsHash(file, after.get(file)!), role: declared.owners[file].role };
  // CI may check out CRLF or LF. Historical declarations here are controlled fixture
  // identities; production continues using its reviewed literal byte authorities.
  for (const expected of authority.historicalQualificationGuards) {
    const { tree, node } = named(after.get(expected.path)!, expected.export); expected.declarationSha256 = sha256(node.getText(tree));
  }
  after.set(publicPath, replaceConstant(ownerSource, "RETAINED_QUALITY_RECONCILIATION_BASELINE", authority));
  const owners: Owner[] = paths.map(file => ({ path: file, beforeSource: before.get(file)!, afterSource: after.get(file)!,
    beforeSha256: sha256(before.get(file)!), afterSha256: sha256(after.get(file)!) }));
  const candidate: Source = { ...structuredClone(previous), invocationHeadSha: "d".repeat(40) };
  for (const row of owners) candidate.manifest.find(item => item.file === row.path)!.sha256 = row.afterSha256;
  const impact: Impact = { status: "ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION_SOURCE_IMPACT", retained: structuredClone(previousImpact.retained),
    candidate: { ...structuredClone(previousImpact.candidate), sourceHead: candidate.invocationHeadSha }, changes: [], retainedBehaviorRelabelled: false,
    retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false, ledgerReconciliation: { previousSource: previous,
      previousImpactSource: JSON.stringify(previousImpact), owners, reviewStatus: "ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION" } };
  type Snapshot = { impact: Impact; candidate: Source };
  const reseal = (value: Snapshot) => {
    value.candidate.sourceSha256 = sha256(JSON.stringify(value.candidate.manifest)); value.impact.candidate.sourceSha256 = value.candidate.sourceSha256;
    value.impact.candidate.sourceHead = value.candidate.invocationHeadSha;
    const oldRoles = new Map(previousImpact.changes.map(row => [row.path, row.role]));
    value.impact.changes = [...new Set([...originalMap.keys(), ...value.candidate.manifest.map(row => row.file)])].sort().flatMap(file => {
      const next = value.candidate.manifest.find(row => row.file === file)?.sha256;
      return originalMap.get(file) === next ? [] : [{ path: file, beforeSha256: originalMap.get(file) ?? null, afterSha256: next ?? "0".repeat(64),
        role: authority.reportPaths.includes(file) ? "non-executable-closure-report" : authority.owners[file]?.role ?? oldRoles.get(file) ?? "reviewed-verification-ledger-reconciliation" }];
    });
  };
  reseal({ impact, candidate });
  const inventory = readSource("scripts/lib/verification-source-inventory.mts"), inventoryTree = parse("inventory.mts", inventory);
  const inventoryNodes = inventoryTree.statements.filter(node => ["EXCLUDED_PART", "PRIVATE_FILE", "sourceIncluded"].includes(nodeName(node) ?? "")); assert.equal(inventoryNodes.length, 3);
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/^export /gm, "");
  const sourceIncluded = new Function(compile(inventoryNodes.map(node => node.getText(inventoryTree)).join("\n")) + ";return sourceIncluded;")() as (file: string) => boolean;
  const guardCode = ["assertRetainedFinalQualitySource", "assertRetainedFinalQualityLifecycleSource", "assertRetainedFinalQualityReconciliationSource"].map(name => declarationText(ownerSource, name)).join("\n");
  const guard = new Function("assert", "ts", "digest", "sourceIncluded", "RETAINED_QUALITY_LIFECYCLE_BASELINE", "RETAINED_QUALITY_RECONCILIATION_BASELINE",
    compile(guardCode) + ";return assertRetainedFinalQualitySource;")(assert, ts, sha256, sourceIncluded, oldAuthority, authority) as
    (impact: Impact, retained: Source, candidate: Source) => { originalSourceHead: string; currentSourceSha256: string };
  const original = { impact, candidate };
  const pass = (name: string, run: () => void) => check("reconciliation " + name, run);
  const negative = (name: string, mutate: (value: Snapshot) => void) => pass(name, () => { const value = structuredClone(original); mutate(value); assert.throws(() => guard(value.impact, retained, value.candidate)); });
  const changeOwner = (value: Snapshot, file: string, change: (source: string) => string) => {
    const row = value.impact.ledgerReconciliation!.owners.find(row => row.path === file); assert.ok(row); const changed = change(row.afterSource); assert.notEqual(changed, row.afterSource);
    row.afterSource = changed; row.afterSha256 = sha256(changed); value.candidate.manifest.find(row => row.file === file)!.sha256 = row.afterSha256; reseal(value);
  };
pass('controlled exact finite owner set positive',()=>{const result=guard(original.impact,retained,original.candidate);assert.equal(result.originalSourceHead,retained.invocationHeadSha);assert.equal(result.currentSourceSha256,original.candidate.sourceSha256);});
pass('old lifecycle proof remains canonical with portable predecessor',()=>{assert.equal(guard(previousImpact,retained,previous).currentSourceSha256,previous.sourceSha256);});
pass('old report-only path still exact and supported',()=>{const source={...retained},impact={status:'ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT',retained:original.impact.retained,candidate:{...original.impact.retained},changes:[],retainedBehaviorRelabelled:false,retainedBehaviorReexecuted:false,automaticCoverage:[],globalClosed:false};assert.equal(guard(impact,retained,source).currentSourceSha256,retained.sourceSha256);});
for(const [label,path] of [['Product','src/app/page.tsx'],['migration',original.candidate.manifest.find(r=>r.file.startsWith('sql/migrations/'))!.file],['package','package.json'],['config','next.config.ts'],['public-template','.env.example']])negative('resealed unreviewed '+label,v=>{const row=v.candidate.manifest.find(r=>r.file===path);assert.ok(row);row.sha256='f'.repeat(64);reseal(v);});
negative('unknown scripts owner cannot enter inventory',v=>{v.candidate.manifest.push({file:'scripts/unreviewed.mjs',sha256:'a'.repeat(64)});reseal(v);});negative('private environment source rejected',v=>{v.candidate.manifest.push({file:'.env.local',sha256:'a'.repeat(64)});reseal(v);});negative('source deletion rejected',v=>{v.candidate.manifest.splice(2,1);reseal(v);});negative('duplicate manifest identity rejected',v=>{v.candidate.manifest.push(v.candidate.manifest[4]);reseal(v);});negative('missing correction owner rejected',v=>v.impact.ledgerReconciliation!.owners.pop());negative('duplicate correction owner rejected',v=>v.impact.ledgerReconciliation!.owners.push(v.impact.ledgerReconciliation!.owners[0]));negative('wrong before bytes rejected',v=>v.impact.ledgerReconciliation!.owners[0].beforeSource+='\n');negative('wrong before digest rejected',v=>v.impact.ledgerReconciliation!.owners[0].beforeSha256='e'.repeat(64));negative('wrong after bytes rejected',v=>v.impact.ledgerReconciliation!.owners[0].afterSource+='\n');negative('different frozen fixture criteria rejected',v=>changeOwner(v,'scripts/fixtures/admin-core-query-presentation-journeys.mjs',x=>x.replace('assert.equal','assert.notEqual')));negative('different maintained controls rejected',v=>changeOwner(v,'scripts/verify-isolated-supabase.mts',x=>x.replace('assert.equal','assert.notEqual')));
for(const [label,from,to] of [['loader assertion','assert.equal(admission.status, "ROOT_REVIEWED_FINAL_BEHAVIOR_READY_FOR_QUALITY")','assert.notEqual(admission.status, "ROOT_REVIEWED_FINAL_BEHAVIOR_READY_FOR_QUALITY")'],['GATES owner','limitMs: 900_000','limitMs: 900_001'],['worker request limit','const RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS = 300_000','const RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS = 300_001'],['old lifecycle body','assert.equal(correction.reviewStatus, "ROOT_REVIEWED_EXACT_POST151_LIFECYCLE_CORRECTION")','assert.notEqual(correction.reviewStatus, "ROOT_REVIEWED_EXACT_POST151_LIFECYCLE_CORRECTION")'],['new proof body',"assert.equal(impact.globalClosed,false)","assert.notEqual(impact.globalClosed,false)"],['entry dispatch','return assertRetainedFinalQualityReconciliationSource(impact, retained, candidate);','return assertRetainedFinalQualityReconciliationSource(impact, candidate, retained);']])negative('resealed public '+label+' drift rejected',v=>changeOwner(v,publicPath,x=>{assert.ok(x.includes(from),label);return x.replace(from,to);}));
negative('self authority hash substitution rejected',v=>changeOwner(v,publicPath,x=>x.replace(authority.previousImpactSha256,'a'.repeat(64))));
negative('public unapproved extra statement rejected',v=>changeOwner(v,publicPath,x=>x+'\nconst unapprovedVerificationOwner = true;\n'));
negative('additional applicability declaration rejected',v=>changeOwner(v,'src/lib/admin/interaction-system/adoption-manifest.ts',x=>x.replace('state: "not_applicable"','state: "adopted"')));
negative('prior impact bytes changed rejected',v=>v.impact.ledgerReconciliation!.previousImpactSource+='\n');negative('recursive prior authority rejected',v=>{const prior=JSON.parse(v.impact.ledgerReconciliation!.previousImpactSource);prior.ledgerReconciliation={};v.impact.ledgerReconciliation!.previousImpactSource=JSON.stringify(prior);});negative('prior HEAD substitution rejected',v=>v.impact.ledgerReconciliation!.previousSource.invocationHeadSha='f'.repeat(40));negative('prior source inventory substitution rejected',v=>v.impact.ledgerReconciliation!.previousSource.manifest.pop());negative('current source SHA substitution rejected',v=>v.candidate.sourceSha256='0'.repeat(64));negative('current HEAD binding substitution rejected',v=>v.candidate.invocationHeadSha='e'.repeat(40));negative('omitted impact change rejected',v=>v.impact.changes.pop());negative('duplicate impact change rejected',v=>v.impact.changes.push(v.impact.changes[0]));negative('wrong exact delta role rejected',v=>v.impact.changes[0].role='Product');negative('automatic credit rejected',v=>v.impact.automaticCoverage=['busy']);negative('relabelled retained behavior rejected',v=>v.impact.retainedBehaviorRelabelled=true);negative('reexecuted retained behavior rejected',v=>v.impact.retainedBehaviorReexecuted=true);negative('global closure claim rejected',v=>v.impact.globalClosed=true);
pass('same already-tracked report-only final checkpoint delta accepted for a new candidate gate',()=>{const v=structuredClone(original),report=v.candidate.manifest.find(r=>r.file==='docs/reports/ADMIN_CORE_HELD37_FINAL52_BOUNDED_CLOSURE_STOP_2026-10-04.json');assert.ok(report);report.sha256='9'.repeat(64);reseal(v);assert.equal(guard(v.impact,retained,v.candidate).currentSourceSha256,v.candidate.sourceSha256);});

for(const run of[158,159,161])negative('historical partial'+run+' guard byte drift rejected',v=>changeOwner(v,'scripts/fixtures/admin-core-domain-form-journeys.mjs',source=>{const tree=ts.createSourceFile('owner.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),fn=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='assertCoreControlPartial'+run+'Completion');assert.ok(fn);const old=fn.getText(tree),next=old.replace('assert.equal','assert.notEqual');assert.notEqual(next,old);return source.slice(0,fn.getStart(tree))+next+source.slice(fn.getEnd());}));
negative('historical manifest role mismatch cannot be bypassed',v=>changeOwner(v,publicPath,source=>{const old='if (ref.path !== role.path || ref.sha256 !== role.historicalSha256)';assert.ok(source.includes(old));return source.replace(old,'if (ref.path !== role.path && ref.sha256 !== role.historicalSha256)');}));
negative('pre-round public owner rejected',v=>changeOwner(v,publicPath,()=>before.get(publicPath)!));
negative('approved CI original identity guard drift rejected',v=>changeOwner(v,'scripts/verify-admin-adoption-closure.mjs',source=>{const old="assert.equal(row.jobId,old.jobId)";assert.ok(source.includes(old));return source.replace(old,"assert.notEqual(row.jobId,old.jobId)");}));
negative('another existing report path cannot enter this round',v=>{const row=v.candidate.manifest.find(value=>value.file.startsWith('docs/reports/')&&!value.file.includes('ADMIN_CORE_HELD37_FINAL52_BOUNDED_CLOSURE_STOP_2026-10-04'));assert.ok(row);row.sha256='1'.repeat(64);reseal(v);});
pass('second fixed checkpoint Markdown remains an explicit allowed report input',()=>{const v=structuredClone(original),row=v.candidate.manifest.find(r=>r.file==='docs/reports/ADMIN_CORE_HELD37_FINAL52_BOUNDED_CLOSURE_STOP_2026-10-04.md');assert.ok(row);row.sha256='8'.repeat(64);reseal(v);assert.equal(guard(v.impact,retained,v.candidate).currentSourceSha256,v.candidate.sourceSha256);});


  const reviewedProductPath = "src/app/admin/pages-blocks/pages/[id]/PageLayoutManager.tsx";
  pass("actual reviewed PageLayoutManager TSX parses and remains exact", () => {
    assert.ok(paths.includes(reviewedProductPath));
    const source = after.get(reviewedProductPath)!;
    const tree = parse(reviewedProductPath, source);
    assert.equal(tree.languageVariant, ts.LanguageVariant.JSX);
    assert.ok(source.includes("setRegions"));
    assert.equal(guard(original.impact, retained, original.candidate).currentSourceSha256, original.candidate.sourceSha256);
  });
  negative("malformed reviewed Product TSX is rejected", value => changeOwner(value, reviewedProductPath, source => source + "\nconst malformedTsx = <div>;\n"));
  negative("same-path unreviewed Product statement is rejected", value => changeOwner(value, reviewedProductPath, source => source + "\nconst unauthorizedProductDelta = true;\n"));
  negative("reviewed Product role cannot become generic Verification", value => {
    const row = value.impact.changes.find(row => row.path === reviewedProductPath); assert.ok(row);
    row.role = "reviewed-verification-ledger-reconciliation";
  });

  const authorization = declared.authorizationNavigation;
  pass("authorization Product change is exactly the reviewed two-tag inverse", () => {
    assert.equal(authorization.path, "src/components/admin/integrations/IntegrationConnectionWizard.tsx");
    assert.equal(authority.owners[authorization.path].role, "exact-integration-authorization-native-navigation-correction");
    assert.equal(authorization.afterElement.replace(/^<a/u, "<Link").replace(/<\/a>$/u, "</Link>"), authorization.beforeElement);
    assert.equal(after.get(authorization.path)!.replace(authorization.afterElement, authorization.beforeElement), before.get(authorization.path));
    assert.equal(parse(authorization.path, after.get(authorization.path)!).languageVariant, ts.LanguageVariant.JSX);
    assert.equal(guard(original.impact, retained, original.candidate).currentSourceSha256, original.candidate.sourceSha256);
  });
  negative("authorization automatic Link restoration rejected", value => changeOwner(value, authorization.path, source => source.replace(authorization.afterElement, authorization.beforeElement)));
  negative("authorization prefetch-only workaround rejected", value => changeOwner(value, authorization.path, source => source.replace(authorization.afterElement, authorization.beforeElement.replace("<Link", "<Link prefetch={false}"))));
  negative("authorization native href drift rejected", value => changeOwner(value, authorization.path, source => source.replace("/authorize", "/changed-endpoint")));
  negative("authorization unrelated Product statement rejected", value => changeOwner(value, authorization.path, source => source + "\nconst unauthorizedWizardChange = true;\n"));
  negative("authorization Product role cannot become generic Verification", value => { const row = value.impact.changes.find(row => row.path === authorization.path); assert.ok(row); row.role = "reviewed-verification-ledger-reconciliation"; });
}

async function verifyRetainedFinalQualityWorkerControls() {
  const { Worker: NativeWorker } = await import("node:worker_threads");
  const { pathToFileURL } = await import("node:url");
  const ownerText = readSource("scripts/lib/isolated-public-verification.mts");
  const ownerFile = ts.createSourceFile("isolated-public-verification.mts", ownerText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = ["RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS", "RETAINED_QUALITY_WORKER_SOURCE", "loadRetainedFinalQualityAdmissionAsync"];
  const selected = ownerFile.statements.filter(statement => ts.isFunctionDeclaration(statement)
    ? names.includes(statement.name?.text ?? "")
    : ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)));
  assert.equal(selected.length, 3);
  const original = selected.map(statement => statement.getText(ownerFile)).join("\n");
  assert.equal((original.match(/import\.meta\.url/g) ?? []).length, 1);
  assert.match(original, /RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS = 300_000/);
  // Only the fixed owner URL is substituted for a controlled worker module; the
  // original bootstrap, sequencing, failure and cleanup implementation execute.
  const javascript = ts.transpileModule(original.replace("import.meta.url", "ownerFixtureUrl"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText.replace(/^export /gm, "");
  type Admission = { receipt: { marker: string; threadId: number }; readonly workerStopped: boolean; verify(): Promise<void>; close(): Promise<void> };
  type Expected = { invocationHeadSha: string; sourceSha256: string; manifest: { path: string; sha256: string } };
  type Load = (sha: string, expected: Expected, signal: AbortSignal) => Promise<Admission>;
  const directory = mkdtempSync(path.join(tmpdir(), "retained-quality-worker-controls-"));
  const modulePath = path.join(directory, "controlled-owner.mjs");
  const statePath = path.join(directory, "controlled-bytes.json");
  const workers: Array<InstanceType<typeof NativeWorker> & { exitObserved: boolean; terminateCalls: number; terminated: boolean }> = [];
  class TrackedWorker extends NativeWorker {
    exitObserved = false; terminateCalls = 0; terminated = false;
    constructor(...args: ConstructorParameters<typeof NativeWorker>) {
      const options = args[1];
      assert.equal(options?.eval, true); assert.equal(options?.stdout, true); assert.equal(options?.stderr, true);
      assert.deepEqual(options?.env, {}); assert.deepEqual(options?.execArgv, ["--experimental-strip-types"]);
      assert.deepEqual(Object.keys(options?.workerData ?? {}).sort(), ["admissionSha256", "expected", "ownerUrl"]);
      super(...args); workers.push(this); this.once("exit", () => { this.exitObserved = true; });
    }
    override terminate() { this.terminateCalls++; return super.terminate().then(code => { this.terminated = true; return code; }); }
  }
  writeFileSync(modulePath, String.raw`import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parentPort, threadId } from "node:worker_threads";
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export function loadRetainedFinalQualityAdmission(sha, expected) {
  assert.equal(sha, "a".repeat(64)); assert.equal(expected.invocationHeadSha, "b".repeat(40));
  assert.equal(expected.sourceSha256, "c".repeat(64));
  const original = readFileSync(expected.manifest.path), config = JSON.parse(original);
  assert.equal(createHash("sha256").update(original).digest("hex"), expected.manifest.sha256);
  pause(config.loadDelay ?? 0);
  if (config.mode === "load-throw") throw Error("controlled canonical load failure");
  if (config.mode === "load-exit") process.exit(0);
  if (config.mode === "bad-sequence") { parentPort.postMessage({sequence:99,kind:"loaded",receipt:{}}); pause(100); }
  if (config.mode === "extra-key") { parentPort.postMessage({sequence:1,kind:"loaded",receipt:{},unexpected:true}); pause(100); }
  if (config.mode === "output") { process.stdout.write("x".repeat(70_000)); pause(100); }
  if (config.mode === "late-frame") setTimeout(() => parentPort.postMessage({sequence:99,kind:"verified"}), 30);
  if (config.mode === "late-exit") setTimeout(() => process.exit(0), 30);
  return { receipt: {marker:"controlled canonical receipt",threadId}, verify() {
    pause(config.verifyDelay ?? 0);
    if (config.mode === "verify-throw") throw Error("controlled canonical verify failure");
    assert.equal(createHash("sha256").update(readFileSync(expected.manifest.path)).digest("hex"), expected.manifest.sha256, "controlled evidence bytes changed");
  }};
}
`);
  const build = (timeoutPort: typeof setTimeout = setTimeout): Load => new Function("assert", "Worker", "ownerFixtureUrl", "setTimeout", "clearTimeout",
    javascript + "\nreturn loadRetainedFinalQualityAdmissionAsync;")(assert, TrackedWorker, pathToFileURL(modulePath).href, timeoutPort, clearTimeout) as Load;
  const prepare = (mode = "normal", loadDelay = 0, verifyDelay = 0) => {
    const bytes = JSON.stringify({ mode, loadDelay, verifyDelay }); writeFileSync(statePath, bytes);
    return { invocationHeadSha: "b".repeat(40), sourceSha256: "c".repeat(64), manifest: { path: statePath, sha256: sha256(bytes) } };
  };
  const settled = () => {
    for (const worker of workers) { assert.equal(worker.exitObserved, true); assert.equal(worker.terminated, true); assert.equal(worker.terminateCalls, 1); }
  };
  const control = async (name: string, run: () => Promise<void>) => {
    try { await run(); settled(); cases.push(name); } catch (error) { console.error(`FAIL ${name}`); throw error; }
  };
  const load = build();
  try {
    await control("retained worker returns exact receipt and rechecks in one persistent worker", async () => {
      const before = workers.length, admission = await load("a".repeat(64), prepare(), new AbortController().signal);
      assert.equal(admission.receipt.marker, "controlled canonical receipt"); assert.ok(admission.receipt.threadId > 0);
      assert.equal(admission.workerStopped, false); await admission.verify(); await admission.verify();
      assert.equal(workers.length, before + 1); await admission.close(); await admission.close(); assert.equal(admission.workerStopped, true);
      await assert.rejects(admission.verify(), /closed/);
    });
    await control("retained worker rejects changed bytes on a later full verify and awaits failure cleanup", async () => {
      const admission = await load("a".repeat(64), prepare(), new AbortController().signal); await admission.verify();
      writeFileSync(statePath, "changed exact evidence"); await assert.rejects(admission.verify(), /evidence bytes changed/);
      await assert.rejects(admission.close(), /evidence bytes changed/); assert.equal(admission.workerStopped, true);
    });
    await control("retained worker rejects overlapping checks without admitting a second request", async () => {
      const admission = await load("a".repeat(64), prepare("normal", 0, 100), new AbortController().signal);
      const first = admission.verify(); await assert.rejects(admission.verify(), /Only one exact evidence check/); await first;
      await admission.verify(); await admission.close(); assert.equal(admission.workerStopped, true);
    });
    for (const [mode, pattern] of [["load-throw", /canonical load failure/], ["load-exit", /exited before disposal/],
      ["bad-sequence", /99/], ["extra-key", /unexpected/], ["output", /output exceeded/]] as const) {
      await control(`retained worker fails closed and disposes on ${mode}`, async () => {
        await assert.rejects(load("a".repeat(64), prepare(mode), new AbortController().signal), pattern);
      });
    }
    await control("retained worker propagates canonical verify failure after awaited disposal", async () => {
      const admission = await load("a".repeat(64), prepare("verify-throw"), new AbortController().signal);
      await assert.rejects(admission.verify(), /canonical verify failure/); await assert.rejects(admission.close(), /canonical verify failure/);
      assert.equal(admission.workerStopped, true);
    });
    await control("retained worker starts no thread when already aborted", async () => {
      const before = workers.length, controller = new AbortController(); controller.abort(Error("controlled pre-abort"));
      await assert.rejects(load("a".repeat(64), prepare(), controller.signal), /controlled pre-abort/); assert.equal(workers.length, before);
    });
    await control("retained worker abort during load awaits its terminated worker", async () => {
      const controller = new AbortController(), pending = load("a".repeat(64), prepare("normal", 500), controller.signal);
      const rejected = assert.rejects(pending, /controlled load abort/); controller.abort(Error("controlled load abort")); await rejected;
    });
    await control("retained worker abort during verify disposes and preserves abort failure", async () => {
      const controller = new AbortController(), admission = await load("a".repeat(64), prepare("normal", 0, 500), controller.signal);
      const rejected = assert.rejects(admission.verify(), /controlled verify abort/); controller.abort(Error("controlled verify abort"));
      await rejected; await assert.rejects(admission.close(), /controlled verify abort/); assert.equal(admission.workerStopped, true);
    });
    await control("retained worker close during verify rejects unfinished proof and awaits disposal", async () => {
      const admission = await load("a".repeat(64), prepare("normal", 0, 500), new AbortController().signal);
      const rejected = assert.rejects(admission.verify(), /unfinished check/); await assert.rejects(admission.close(), /unfinished check/); await rejected;
      assert.equal(admission.workerStopped, true);
    });
    for (const [mode, pattern] of [["late-frame", /Unexpected evidence worker response/], ["late-exit", /exited before disposal/]] as const) {
      await control(`retained worker rejects ${mode} even during otherwise idle disposal`, async () => {
        const admission = await load("a".repeat(64), prepare(mode), new AbortController().signal);
        await new Promise(resolve => setTimeout(resolve, 100)); await assert.rejects(admission.close(), pattern); assert.equal(admission.workerStopped, true);
      });
    }
    await control("retained worker request bound terminates an unfinished check", async () => {
      // Only the timer duration port is shortened; production constant and failure path are unchanged.
      const boundedTimer = ((callback: (...args: unknown[]) => void, milliseconds?: number, ...args: unknown[]) => {
        assert.equal(milliseconds, 300_000); return setTimeout(callback, 50, ...args);
      }) as typeof setTimeout;
      await assert.rejects(build(boundedTimer)("a".repeat(64), prepare("normal", 500), new AbortController().signal), /exceeded its worker bound/);
    });
    await control("retained worker leaves parent heartbeat responsive through synchronous load and verify", async () => {
      let phase = "load", loadTicks = 0, verifyTicks = 0;
      const timer = setInterval(() => { if (phase === "load") loadTicks++; else verifyTicks++; }, 10);
      let admission: Admission | undefined;
      try {
        admission = await load("a".repeat(64), prepare("normal", 160, 160), new AbortController().signal);
        phase = "verify"; await admission.verify(); assert.ok(loadTicks >= 3); assert.ok(verifyTicks >= 3);
      } finally { clearInterval(timer); if (admission) await admission.close(); }
      assert.equal(admission.workerStopped, true);
    });
  } finally {
    await Promise.allSettled(workers.filter(worker => !worker.exitObserved).map(worker => worker.terminate()));
    assert.ok(workers.every(worker => worker.exitObserved));
    assert.ok(directory.startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(directory, { recursive: true, force: true });
  }

function verifyRetainedPublicControlEligibility(source: string) {
  const parsed = ts.createSourceFile("isolated-supabase.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const handlers: ts.ArrowFunction[] = [];
  const visitHandler = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(parsed) === "runPublicVerification" && ts.isArrowFunction(node.initializer)) handlers.push(node.initializer);
    ts.forEachChild(node, visitHandler);
  };
  visitHandler(parsed); assert.equal(handlers.length, 1);
  const renewals: ts.CallExpression[] = [];
  const visitRenewal = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === "applicationLease.renewIfDue") renewals.push(node);
    ts.forEachChild(node, visitRenewal);
  };
  visitRenewal(handlers[0]); assert.equal(renewals.length, 1); assert.equal(renewals[0].arguments.length, 1);
  const argument = renewals[0].arguments[0].getText(parsed);
  const evaluateEligibility = new Function("request", "publicContext", "isOwnedLocalVerificationActive", ts.transpileModule("return (" + argument + ");", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText) as (request: Record<string, unknown>, context: object, active: (context: object) => boolean) => boolean;
  const eligible = (request: Record<string, unknown>) => evaluateEligibility(request, {}, () => false);
  const valid = { finalQualityGate: true, retainedAdminBehaviorAdmissionSha256: "a".repeat(64), additionalSourceFiles: [] };
  assert.equal(eligible(valid), true); cases.push("retained Quality heartbeat renews only through the existing lease argument");
  for (const selection of ["admin-interactions", "admin-adoption"]) {
    assert.equal(eligible({ selection }), true); cases.push("unchanged legacy lease eligibility: " + selection);
  }
  const rejected: Array<[string, Record<string, unknown>]> = [
    ["missing final Quality", { ...valid, finalQualityGate: undefined }],
    ["false final Quality", { ...valid, finalQualityGate: false }],
    ["truthy nonboolean final Quality", { ...valid, finalQualityGate: "true" }],
    ["build subset", { ...valid, selection: "build-contracts" }],
    ["foreign selector", { ...valid, selection: "foreign" }],
    ["null selector", { ...valid, selection: null }],
    ["absent admission", { ...valid, retainedAdminBehaviorAdmissionSha256: undefined }],
    ["null admission", { ...valid, retainedAdminBehaviorAdmissionSha256: null }],
    ["nonstring admission", { ...valid, retainedAdminBehaviorAdmissionSha256: 123 }],
    ["short admission", { ...valid, retainedAdminBehaviorAdmissionSha256: "a".repeat(63) }],
    ["long admission", { ...valid, retainedAdminBehaviorAdmissionSha256: "a".repeat(65) }],
    ["uppercase admission", { ...valid, retainedAdminBehaviorAdmissionSha256: "A".repeat(64) }],
    ["nonhex admission", { ...valid, retainedAdminBehaviorAdmissionSha256: "g".repeat(64) }],
    ["cohort", { ...valid, adoptionCohort: "domain-forms" }],
    ["scope", { ...valid, adoptionScope: "core-closure" }],
    ["journey subset", { ...valid, adoptionJourneySelection: "domain-forms-update-followup" }],
    ["measurement", { ...valid, adminMeasurement: {} }],
    ["null measurement", { ...valid, adminMeasurement: null }],
    ["additional source", { ...valid, additionalSourceFiles: ["scripts/foreign.mts"] }],
    ["missing source list", { ...valid, additionalSourceFiles: undefined }],
    ["array-like source list", { ...valid, additionalSourceFiles: { length: 0 } }],
    ["string source list", { ...valid, additionalSourceFiles: "" }],
    ["ordinary Public job", { additionalSourceFiles: [] }],
  ];
  for (const [name, request] of rejected) { assert.equal(eligible(request), false, name); cases.push("retained lease rejects " + name); }
  const handler = handlers[0].getText(parsed);
  assert.ok(handler.indexOf("applicationLease.renewIfDue") < handler.indexOf("await publicContext.assertOwned()"));
  assert.ok(handler.indexOf("await publicContext.assertOwned()") < handler.indexOf('query("select 1 as owned_public_job_heartbeat")'));
  assert.ok(handler.includes("}, 20_000)")); cases.push("existing serialized ownership and20second heartbeat order remains intact");
  const markerResets: ts.IfStatement[] = [];
  const collectMarkerResets = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.thenStatement.getText(parsed) === "publicJob = undefined;") markerResets.push(node);
    ts.forEachChild(node, collectMarkerResets);
  };
  collectMarkerResets(handlers[0]);
  assert.equal(markerResets.length, 1, "Only the existing public-job completion boundary may clear its marker.");
  const clearsMarker = new Function("request", "return (" + markerResets[0].expression.getText(parsed) + ");") as (request: Record<string, unknown>) => boolean;
  for (const selection of ["admin-interactions", "admin-adoption", "media-upload-limit", "hero-compatibility"]) {
    assert.equal(clearsMarker({ selection }), true, selection);
  }
  for (const request of [valid, { selection: "build-contracts" }, { additionalSourceFiles: [] }, { selection: "foreign" }]) {
    assert.equal(clearsMarker(request), false, "One-shot Public/retained Quality must keep its completed job marker.");
  }
  cases.push("retained Quality does not clear the one-shot public job marker");
}

  verifyRetainedPublicControlEligibility(readSource("scripts/lib/isolated-supabase.mts"));

  // The source guard executes with a controlled finite authority. All executable
  // assertion bodies and transformation rules come from the maintained owner.
  {
    type Source = { invocationHeadSha: string; sourceSha256: string; manifest: Array<{ file: string; sha256: string }> };
    type Impact = Parameters<typeof import("./lib/isolated-public-verification.mts").assertRetainedFinalQualitySource>[0];
    type Owner = { path: string; beforeSource: string; afterSource: string; beforeSha256: string; afterSha256: string };
    type Authority = { sourceHead: string; sourceSha256: string; owners: Record<string, string>; workerStatementsSha256: string;
      proofFunctionSha256: string; lifecycleBeforeLfSha256: string; lifecycleAfterLfSha256: string; controlsAfterSha256: string; navigationAfterSha256: string; inventoryAfterSha256: string; infrastructureAfterSha256: string; cliPulseAfterSha256: string;
      publicTemplate: { path: string; gitSha256: string; workingTreeSha256: string } };
    const nodeName = (node: ts.Statement) => ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) ? node.name?.text
      : ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 && ts.isIdentifier(node.declarationList.declarations[0].name)
        ? node.declarationList.declarations[0].name.text : undefined;
    const declaration = (name: string) => { const value = ownerFile.statements.find(node => nodeName(node) === name); assert.ok(value); return value; };
    const text = (name: string) => {
      let value = declaration(name).getText(ownerFile).replace(/\r\n/gu, "\n");
      if (name === "assertRetainedFinalQualitySource") {
        const constant = declaration("RETAINED_QUALITY_RECONCILIATION_BASELINE"); assert.ok(ts.isVariableStatement(constant));
        const init = constant.declarationList.declarations[0].initializer; assert.ok(init && ts.isCallExpression(init));
        const additions = JSON.parse(init.arguments[0].getText(ownerFile)).entryAdditions as string[];
        for (const addition of additions) { assert.equal(value.split(addition).length, 2); value = value.replace(addition, ""); }
      }
      return value;
    };
    const proofNode = declaration("assertRetainedFinalQualityLifecycleSource");
    const transformations: Array<{ from: string; to: string }> = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "exactReplace"
        && node.arguments.length >= 3 && ts.isStringLiteralLike(node.arguments[1]) && ts.isStringLiteralLike(node.arguments[2]))
        transformations.push({ from: node.arguments[1].text, to: node.arguments[2].text });
      ts.forEachChild(node, visit);
    };
    visit(proofNode); assert.equal(transformations.length, 19);
    const undo = (source: string) => transformations.reduce((value, row) => value.split(row.to).join(row.from), source);
    const p = "scripts/lib/isolated-public-verification.mts", l = "scripts/lib/isolated-supabase.mts", c = "scripts/verify-isolated-supabase.mts", n = "scripts/verify-admin-core-navigation-permission-join.mjs";
    const i = "scripts/lib/verification-source-inventory.mts", f = "scripts/verify-verification-infrastructure.mts", q = "scripts/verify-isolated-application-cli-pulse.mjs";
    const workerNames = ["RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS", "RETAINED_QUALITY_WORKER_SOURCE", "loadRetainedFinalQualityAdmissionAsync"];
    // This controlled source fixture exercises the historical async correction,
    // whose finite authority predates Native application ownership, cleanup and archive preservation.
    const currentRunSource = text("runOwnedPublicVerification");
    const run = declaration("runOwnedPublicVerification"); assert.ok(ts.isFunctionDeclaration(run) && run.body);
    const runTries = run.body.statements.filter(ts.isTryStatement); assert.equal(runTries.length, 1);
    const nativeFinally = runTries[0].finallyBlock; assert.ok(nativeFinally); assert.equal(nativeFinally.statements.length, 1);
    const cleanupTry = nativeFinally.statements[0]; assert.ok(ts.isTryStatement(cleanupTry) && cleanupTry.catchClause && !cleanupTry.finallyBlock);
    const cleanupStatements = cleanupTry.tryBlock.statements;
    const nativeCleanup = cleanupStatements.filter(node => ts.isVariableStatement(node)
      && node.declarationList.declarations.some(value => value.name.getText(ownerFile) === "[workerCleanup, childCleanup, applicationCleanup]"));
    assert.equal(nativeCleanup.length, 1);
    assert.equal(nativeCleanup[0].getText(ownerFile).replace(/\r\n/gu, "\n"), 'const [workerCleanup, childCleanup, applicationCleanup] = await Promise.all([\n      Promise.allSettled(retainedAdmission ? [retainedAdmission.close()] : []),\n      Promise.allSettled([...children].filter(child => !nativeApplications.has(child)).map(child => stopChild(child, context.cleanEnvironment()))),\n      Promise.allSettled([...nativeApplications.values()].map(stopNativeApplication)),\n    ]);');
    const applicationCleanup = cleanupStatements.filter(node => ts.isForOfStatement(node) && node.expression.getText(ownerFile) === "applicationCleanup");
    assert.equal(applicationCleanup.length, 1);
    assert.equal(applicationCleanup[0].getText(ownerFile), 'for (const settled of applicationCleanup) if (settled.status === "rejected") throw settled.reason;');
    const cleanupRule = transformations.filter(row => row.from === "    const childCleanup = await Promise.allSettled([...children].map(child => stopChild(child, context.cleanEnvironment())));");
    assert.equal(cleanupRule.length, 1);
    const archivePreservationStatements = [
      'let preservationFailed = false, preservationFailure: unknown;',
      'try { await preserveClosedNativeArchives(); } catch (error) { preservationFailed = true; preservationFailure = error; }',
      'if (preservationFailed) throw preservationFailure;',
    ].map(source => {
      const matches = cleanupStatements.filter(node => node.getText(ownerFile).replace(/\r\n/gu, "\n") === source);
      assert.equal(matches.length, 1); return matches[0];
    });
    const historicalFinally = "{\n    " + cleanupStatements.filter(node => node !== applicationCleanup[0] && !archivePreservationStatements.includes(node)).map(node => node === nativeCleanup[0]
      ? cleanupRule[0].to.trimStart() : node.getText(ownerFile).replace(/\r\n/gu, "\n")).join("\n    ") + "\n  }";
    const nativeFinallySource = nativeFinally.getText(ownerFile).replace(/\r\n/gu, "\n");
    assert.equal(currentRunSource.split(nativeFinallySource).length, 2);
    const historicalRunSource = currentRunSource.replace(nativeFinallySource, historicalFinally);
    assert.equal(historicalRunSource.split(cleanupRule[0].to).length, 2);
    const terminalRule = transformations.filter(row => row.from === "otherResourcesTouched: false });\n  }\n  const result = { status:");
    assert.equal(terminalRule.length, 1); assert.equal(historicalRunSource.split(terminalRule[0].to).length, 2);
    const priorPublic = [undo(text("isolatedPublicImageConfigSource")), undo(text("assertRetainedFinalQualitySource")), text("loadRetainedFinalQualityAdmission"), undo(historicalRunSource), text("GATES")].join("\n\n");
    const oldMetadata = "memoryOnlyArtifacts: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0";
    const newMetadata = "memoryOnlyArtifacts: false, tempFixtureCleanupVerified: true, realWorkers: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0";
    const priorControls = 'function retainedAssertion() { assert.equal("preserved", "preserved"); }\n'
      + 'async function main() { await verifyRetainedFinalQualityAdmissionControls(); }\n'
      + 'async function retainedFinalQualityOnly() { await verifyRetainedFinalQualityAdmissionControls(); console.log({' + oldMetadata + '}); }';
    const nextControls = priorControls.replaceAll("await verifyRetainedFinalQualityAdmissionControls();", "await verifyRetainedFinalQualityAdmissionControls(); await verifyRetainedFinalQualityWorkerControls();")
      .replace(oldMetadata, newMetadata) + '\nasync function verifyRetainedFinalQualityWorkerControls() { return; }';
    const priorLifecycle = 'export function healthyLease() { return "existing contract"; }\n';
    const nextLifecycle = 'export function healthyLease() { return "reviewed exact retained eligibility"; }\n';
    // This finite fixture exercises the earlier exact CRLF correction. Reconstruct
    // its reviewed comparison shape without changing the current CLI proof owner.
    const currentCliPulse = readSource(q).replace(/\r\n/gu, "\n");
    const normalizationImport = 'import { normalizeVerificationText } from "./lib/verification-text.mjs";\n';
    assert.equal(currentCliPulse.split(normalizationImport).length, 2);
    assert.equal(currentCliPulse.split("normalizeVerificationText(source)").length, 2);
    const nextCliPulse = currentCliPulse.replace(normalizationImport, "")
      .replace("normalizeVerificationText(source)", "source.replace(/\\r\\n/gu,'\\n')");
    const priorCliPulse = undo(nextCliPulse);
    assert.notEqual(nextCliPulse, priorCliPulse);
    const currentNavigation = readSource(n);
    // Recover only the controlled old lifecycle seed; the current round still reads actual navigation bytes.
    const navigationReconciliationTransforms: Array<{ before: string; after: string }> = [
      {
        "before": "import {CORE_DOWNLOAD_MEDIA_HREF} from './fixtures/admin-core-download-media-adoption.mjs';",
        "after": "import {CORE_DOWNLOAD_MEDIA_HREF} from './fixtures/admin-core-download-media-adoption.mjs';\nimport {coreDescendantCheckpointPhases} from './fixtures/admin-core-descendant-presentation-plan.mjs';"
      },
      {
        "before": "const partition=new Function('assert','assertOwnedLocalHandle','states',partitionJs+';return partitionCoreDescendantNativeCheckpoints;')(assert,own,descendantStates);",
        "after": "const partition=new Function('assert','assertOwnedLocalHandle','states','coreDescendantCheckpointPhases',partitionJs+';return partitionCoreDescendantNativeCheckpoints;')(assert,own,descendantStates,coreDescendantCheckpointPhases);"
      },
      {
        "before": " const state={cleaned:true,plan:[{preferenceId:null}],proofs};descendantStates.set(f.handle,state);",
        "after": " const plan=[{preferenceId:null}],state={cleaned:true,plan,readPlan:plan,mode:'presentation',proofs};descendantStates.set(f.handle,state);"
      }
    ];
    let nextNavigation = currentNavigation.replace(/\r\n/gu, "\n");
    assert.equal(nextNavigation.split(normalizationImport).length, 2);
    assert.equal(nextNavigation.split("normalizeVerificationText(sourceBytes.toString('utf8'))").length, 2);
    nextNavigation = nextNavigation.replace(normalizationImport, "")
      .replace("normalizeVerificationText(sourceBytes.toString('utf8'))", "sourceBytes.toString('utf8').replace(/\\r\\n/gu,'\\n')");
    for (const change of [...navigationReconciliationTransforms].reverse()) {
      assert.equal(nextNavigation.split(change.after).length, 2);
      nextNavigation = nextNavigation.replace(change.after, change.before);
    }
    assert.equal(sha256(nextNavigation), "765824e551d06e0879fc6dc1d2830bcde30bed1b77854749b89bf8567816f64c");
    const priorNavigation = undo(nextNavigation);
    assert.notEqual(nextNavigation, priorNavigation);
    const nextInventory = readSource(i), priorInventory = undo(nextInventory.replace(/\r\n/gu, "\n"));
    const nextInfrastructure = readSource(f), priorInfrastructure = undo(nextInfrastructure.replace(/\r\n/gu, "\n"));
    assert.notEqual(nextInventory.replace(/\r\n/gu, "\n"), priorInventory);
    assert.notEqual(nextInfrastructure.replace(/\r\n/gu, "\n"), priorInfrastructure);
    const templatePath = ".env.example", gitSource = "# Public template fixture\nPUBLIC_EXAMPLE=example\n", workingTreeSource = gitSource.replace(/\n/gu, "\r\n");
    const baselineManifest = [{ file: p, sha256: sha256(priorPublic) }, { file: l, sha256: sha256(priorLifecycle) },
      { file: c, sha256: sha256(priorControls) }, { file: n, sha256: sha256(priorNavigation) },
      { file: i, sha256: sha256(priorInventory) }, { file: f, sha256: sha256(priorInfrastructure) }, { file: q, sha256: sha256(priorCliPulse) }, { file: "src/app/page.tsx", sha256: "e".repeat(64) }].sort((a, b) => a.file.localeCompare(b.file));
    const authority: Authority = { sourceHead: "b".repeat(40), sourceSha256: sha256(JSON.stringify(baselineManifest)),
      owners: { [p]: sha256(priorPublic), [l]: sha256(priorLifecycle), [c]: sha256(priorControls), [n]: sha256(priorNavigation), [i]: sha256(priorInventory), [f]: sha256(priorInfrastructure), [q]: sha256(priorCliPulse) },
      workerStatementsSha256: sha256(workerNames.map(text).join("\n")), proofFunctionSha256: sha256(text("assertRetainedFinalQualityLifecycleSource")),
      lifecycleBeforeLfSha256: sha256(priorLifecycle), lifecycleAfterLfSha256: sha256(nextLifecycle), controlsAfterSha256: sha256(nextControls), navigationAfterSha256: sha256(nextNavigation),
      inventoryAfterSha256: sha256(nextInventory), infrastructureAfterSha256: sha256(nextInfrastructure), cliPulseAfterSha256: sha256(nextCliPulse),
      publicTemplate: { path: templatePath, gitSha256: sha256(gitSource), workingTreeSha256: sha256(workingTreeSource) } };
    const nextPublic = ['import { Worker } from "node:worker_threads";', 'import ts from "typescript";', ...workerNames.map(text),
      text("RetainedQualityLifecycleCorrection"), text("assertRetainedFinalQualityLifecycleSource"),
      "const RETAINED_QUALITY_LIFECYCLE_BASELINE = Object.freeze(" + JSON.stringify(authority) + ");",
      text("isolatedPublicImageConfigSource"), text("assertRetainedFinalQualitySource"), text("loadRetainedFinalQualityAdmission"), historicalRunSource, text("GATES")].join("\n\n");
    const owners: Owner[] = [[p, priorPublic, nextPublic], [l, priorLifecycle, nextLifecycle], [c, priorControls, nextControls], [n, priorNavigation, nextNavigation], [i, priorInventory, nextInventory], [f, priorInfrastructure, nextInfrastructure], [q, priorCliPulse, nextCliPulse]]
      .map(([file, beforeSource, afterSource]) => ({ path: file, beforeSource, afterSource, beforeSha256: sha256(beforeSource), afterSha256: sha256(afterSource) }));
    const retained: Source = { invocationHeadSha: "a".repeat(40), sourceSha256: authority.sourceSha256, manifest: baselineManifest };
    const baseline: Source = { ...retained, invocationHeadSha: authority.sourceHead };
    const candidate: Source = { invocationHeadSha: "c".repeat(40), sourceSha256: "", manifest: [...structuredClone(baselineManifest), { file: templatePath, sha256: sha256(workingTreeSource) }].sort((a, b) => a.file.localeCompare(b.file)) };
    const ref = (name: string) => ({ path: ".tmp-qa/core-final-closure/" + name, sha256: "f".repeat(64) });
    const binding = (source: Source, name: string) => ({ sourceHead: source.invocationHeadSha, sourceSha256: source.sourceSha256, sourceManifest: ref(name) });
    const impact: Impact = { status: "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT", retained: binding(retained, "retained.json"),
      candidate: binding(candidate, "candidate.json"), changes: [], retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false,
      qualityLifecycleCorrection: { baselineSource: baseline, baselineReportImpact: { status: "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT",
        retained: binding(retained, "retained.json"), candidate: binding(baseline, "baseline.json"), changes: [],
        retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false },
        reviewStatus: "ROOT_REVIEWED_EXACT_POST151_LIFECYCLE_CORRECTION", owners,
        trackedPublicEnvironmentTemplate: { path: templatePath, retainedGit: { head: retained.invocationHeadSha, sha256: sha256(gitSource) },
          baselineGit: { head: baseline.invocationHeadSha, sha256: sha256(gitSource) }, candidateGit: { head: candidate.invocationHeadSha, sha256: sha256(gitSource) },
          gitSource, workingTreeSource, workingTreeSha256: sha256(workingTreeSource) } } };
    const reseal = (value: { impact: Impact; candidate: Source }) => {
      const entries = value.impact.qualityLifecycleCorrection!.owners;
      for (const row of entries) { row.afterSha256 = sha256(row.afterSource); const item = value.candidate.manifest.find(item => item.file === row.path); if (item) item.sha256 = row.afterSha256; }
      value.candidate.sourceSha256 = sha256(JSON.stringify(value.candidate.manifest)); value.impact.candidate.sourceSha256 = value.candidate.sourceSha256;
      const prior = new Map(retained.manifest.map(row => [row.file, row.sha256]));
      value.impact.changes = [...new Set([...prior.keys(), ...value.candidate.manifest.map(row => row.file)])].sort().flatMap(file => {
        const next = value.candidate.manifest.find(row => row.file === file)?.sha256;
        return prior.get(file) === next ? [] : [{ path: file, beforeSha256: prior.get(file) ?? null, afterSha256: next ?? "0".repeat(64),
          role: Object.hasOwn(authority.owners, file) ? "exact-quality-lifecycle-correction" : file === templatePath ? "preexisting-tracked-public-environment-template" : "non-executable-closure-report" }];
      });
    };
    reseal({ impact, candidate });
    const guardCode = [text("assertRetainedFinalQualitySource"), text("assertRetainedFinalQualityLifecycleSource")].join("\n");
    const guardJs = ts.transpileModule(guardCode, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/^export /gm, "");
    const inventoryText = readSource("scripts/lib/verification-source-inventory.mts");
    const inventoryFile = ts.createSourceFile("verification-source-inventory.mts", inventoryText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const inventoryNames = ["EXCLUDED_PART", "PRIVATE_FILE", "sourceIncluded"];
    const inventoryNodes = inventoryFile.statements.filter(node => inventoryNames.includes(nodeName(node) ?? ""));
    assert.equal(inventoryNodes.length, 3);
    const inventoryCode = ts.transpileModule(inventoryNodes.map(node => node.getText(inventoryFile)).join("\n"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
    }).outputText.replace(/^export /gm, "");
    const canonicalSourceIncluded = new Function(inventoryCode + ";return sourceIncluded;")() as (file: string) => boolean;
    const guard = new Function("assert", "digest", "sourceIncluded", "ts", "RETAINED_QUALITY_LIFECYCLE_BASELINE", guardJs + ";return assertRetainedFinalQualitySource;")
      (assert, sha256, canonicalSourceIncluded, ts, authority) as (impact: Impact, retained: Source, candidate: Source) => unknown;
    check("retained lifecycle source admits only the exact reviewed async correction", () => guard(impact, retained, candidate));
    const rejectSource = (name: string, mutate: (value: { impact: Impact; candidate: Source }) => void) => check(name, () => {
      const value = structuredClone({ impact, candidate }); mutate(value); reseal(value); assert.throws(() => guard(value.impact, retained, value.candidate));
    });
    const edit = (value: { impact: Impact; candidate: Source }, file: string, from: string, to: string) => {
      const row = value.impact.qualityLifecycleCorrection!.owners.find(row => row.path === file)!; assert.ok(row.afterSource.includes(from)); row.afterSource = row.afterSource.replace(from, to);
    };
    const editGenerator = (value: { impact: Impact; candidate: Source }, from: string, to: string) => {
      const originalGenerator = text("isolatedPublicImageConfigSource"); assert.ok(originalGenerator.includes(from));
      edit(value, p, originalGenerator, originalGenerator.replace(from, to));
    };
    rejectSource("retained lifecycle source rejects after-only Native cleanup adoption despite resealed fixture manifests", value => edit(value, p, historicalRunSource, currentRunSource));
    rejectSource("retained source rejects missing exact CLI pulse owner evidence", value => { value.impact.qualityLifecycleCorrection!.owners = value.impact.qualityLifecycleCorrection!.owners.filter(row => row.path !== q); });
    rejectSource("retained source rejects reverting the CLI CRLF correction", value => edit(value, q, "assert.ok(source.replace(/\\r\\n/gu,'\\n').includes('cliJobAbort?.abort();\\n        if (handle) activeHandles.delete(handle)'));", "assert.ok(source.includes('cliJobAbort?.abort();\\n        if (handle) activeHandles.delete(handle)'));"));
    rejectSource("retained source rejects broader CLI newline normalization", value => edit(value, q, "source.replace(/\\r\\n/gu,'\\n').includes", "source.replace(/\\r\\n?/gu,'\\n').includes"));
    rejectSource("retained source rejects normalizing the raw CLI source read", value => edit(value, q, "readFileSync('scripts/lib/isolated-supabase.mts','utf8')", "readFileSync('scripts/lib/isolated-supabase.mts','utf8').replace(/\\r\\n/gu,'\\n')"));
    rejectSource("retained source rejects dropping the CLI cleanup-order assertion", value => edit(value, q, "assert.ok(drain<cleaning&&drain<database);", "void drain;"));
    rejectSource("retained source rejects dropping a CLI cleanup negative control", value => edit(value, q, "assert.throws(()=>assertCleanupDrain(mutant));", "void mutant;"));
    rejectSource("retained source rejects altering the controlled CLI timeout", value => edit(value, q, "CLI_TIMEOUT_MS:180_000", "CLI_TIMEOUT_MS:900_000"));
    rejectSource("retained source rejects an extra unreviewed CLI statement", value => { value.impact.qualityLifecycleCorrection!.owners.find(row => row.path === q)!.afterSource += "\nexport const unrelated = true;"; });
    rejectSource("retained source rejects missing tracked template provenance", value => { delete (value.impact.qualityLifecycleCorrection! as Partial<NonNullable<Impact["qualityLifecycleCorrection"]>>).trackedPublicEnvironmentTemplate; });
    rejectSource("retained source rejects a missing template inventory row", value => { value.candidate.manifest = value.candidate.manifest.filter(row => row.file !== templatePath); });
    rejectSource("retained source rejects a duplicate template inventory row", value => { value.candidate.manifest.push({ file: templatePath, sha256: sha256(workingTreeSource) }); });
    rejectSource("retained source rejects template provenance path substitution", value => { value.impact.qualityLifecycleCorrection!.trackedPublicEnvironmentTemplate.path = ".env.local"; });
    for (const key of ["retainedGit", "baselineGit", "candidateGit"] as const) {
      rejectSource("retained source rejects template " + key + " head substitution", value => { value.impact.qualityLifecycleCorrection!.trackedPublicEnvironmentTemplate[key].head = "d".repeat(40); });
      rejectSource("retained source rejects template " + key + " blob substitution", value => { value.impact.qualityLifecycleCorrection!.trackedPublicEnvironmentTemplate[key].sha256 = "d".repeat(64); });
    }
    rejectSource("retained source rejects changed template Git text", value => { value.impact.qualityLifecycleCorrection!.trackedPublicEnvironmentTemplate.gitSource += "# changed\n"; });
    rejectSource("retained source rejects changed template bytes even with resealed raw hash", value => { const template = value.impact.qualityLifecycleCorrection!.trackedPublicEnvironmentTemplate; template.workingTreeSource += "# changed\r\n"; template.workingTreeSha256 = sha256(template.workingTreeSource); value.candidate.manifest.find(row => row.file === templatePath)!.sha256 = template.workingTreeSha256; });
    rejectSource("retained source rejects an additional private environment source", value => { value.candidate.manifest.push({ file: ".env.local", sha256: "d".repeat(64) }); });
    rejectSource("retained source rejects an additional ordinary source", value => { value.candidate.manifest.push({ file: "scripts/unreviewed.ts", sha256: "d".repeat(64) }); });
    rejectSource("retained source rejects widened template path eligibility", value => edit(value, i, 'file === ".env.example"', 'file.startsWith(".env")'));
    rejectSource("retained source rejects removed tracked-only template assertion", value => edit(value, i, 'assert.notEqual(file, ".env.example", "The public environment template must be Git tracked.");', 'void file;'));
    rejectSource("retained source rejects removing private path exclusion", value => edit(value, i, 'PRIVATE_FILE.test(part)', 'false'));
    rejectSource("retained source rejects removing maintained template negative controls", value => edit(value, f, 'assert.throws(() => selectSourceInventory(required, [".env.example"]), /must be Git tracked/u);', 'void required;'));
    rejectSource("retained source rejects an unmanifested template copy exception", value => edit(value, p, 'name === ".env.example" && manifest.some(row => row.file === name)', 'name === ".env.example"'));
    rejectSource("retained source rejects false environment-copy metadata", value => edit(value, p, 'privateEnvironmentFilesCopied: false, publicEnvironmentTemplateCopied: manifest.some(row => row.file === ".env.example")', 'environmentFilesCopied: false'));
    rejectSource("retained source rejects the prior banned generated binding", value => editGenerator(value, "const transpiledConfig = await", "const module = await"));
    rejectSource("retained source rejects a different generated binding rename", value => editGenerator(value, "const transpiledConfig = await", "const arbitraryConfig = await"));
    rejectSource("retained source rejects a partial generated reference rename", value => editGenerator(value, "transpiledConfig.default ?? transpiledConfig", "module.default ?? module"));
    rejectSource("retained source rejects changed generated normalization", value => editGenerator(value, "transpiledConfig.default ?? transpiledConfig", "transpiledConfig.default || transpiledConfig"));
    rejectSource("retained source rejects a widened generated image boundary", value => editGenerator(value, "/storage/v1/object/public/cms-images/**", "/**"));
    rejectSource("retained source rejects a removed generated source digest assertion", value => editGenerator(value, "assert.equal(createHash", "void(createHash"));
    rejectSource("retained source rejects normalizing the Navigation evidence byte hash", value => edit(value, n, ".update(sourceBytes)", ".update(source)"));
    rejectSource("retained source rejects dropping the Navigation mutation assertion", value => edit(value, n, "assert.notEqual(bad,source);", "void bad;"));
    rejectSource("retained source rejects dropping the Navigation behavioral rejection", value => edit(value, n, "assert.throws(()=>proveWiring(partitionFixture(true),bad));", "void bad;"));
    rejectSource("retained source rejects unreviewed Navigation newline conversion", value => edit(value, n, ".replace(/\\r\\n/gu,'\\n')", ".replace(/\\r/gu,'')"));
    rejectSource("retained source rejects additional Navigation statements", value => edit(value, n, "const checks=[];", "const checks=[]; const unreviewed = true;"));
    rejectSource("retained source rejects missing exact Navigation owner evidence", value => { value.impact.qualityLifecycleCorrection!.owners = value.impact.qualityLifecycleCorrection!.owners.filter(row => row.path !== n); });
    rejectSource("retained source rejects a seventh unreviewed Verification owner", value => { value.impact.qualityLifecycleCorrection!.owners.push({ ...structuredClone(value.impact.qualityLifecycleCorrection!.owners.find(row => row.path === n)!), path: "scripts/verify-admin-core-form-permission-replay.mjs" }); });
    rejectSource("retained lifecycle source rejects changed canonical loader despite resealed manifests", value => edit(value, p, '"Retained Quality admission changed during execution."', '"weakened verifier"'));
    rejectSource("retained lifecycle source rejects changed gate contract", value => edit(value, p, 'name: "normal-build"', 'name: "changed-build"'));
    rejectSource("retained lifecycle source rejects removed awaited full verification", value => edit(value, p, "await retainedAdmission?.verify();", "void retainedAdmission?.verify();"));
    rejectSource("retained lifecycle source rejects changed worker body", value => edit(value, p, "admission.verify();", "void admission;"));
    rejectSource("retained lifecycle source rejects changed correction checker", value => edit(value, p, '"ROOT_REVIEWED_EXACT_POST151_LIFECYCLE_CORRECTION"', '"weakened review"'));
    rejectSource("retained lifecycle source rejects changed lease implementation", value => edit(value, l, "reviewed exact retained eligibility", "arbitrary reconnect"));
    rejectSource("retained lifecycle source rejects removed legacy controls", value => edit(value, c, 'assert.equal("preserved", "preserved");', "return;"));
    rejectSource("retained lifecycle source rejects added Product delta", value => { value.candidate.manifest.find(row => row.file === "src/app/page.tsx")!.sha256 = "d".repeat(64); });
    rejectSource("retained lifecycle source rejects deleted source", value => { value.candidate.manifest = value.candidate.manifest.filter(row => row.file !== "src/app/page.tsx"); });
    rejectSource("retained lifecycle source rejects missing owner proof", value => { value.impact.qualityLifecycleCorrection!.owners.pop(); });
    rejectSource("retained lifecycle source rejects duplicate owner proof", value => { value.impact.qualityLifecycleCorrection!.owners.push(structuredClone(value.impact.qualityLifecycleCorrection!.owners[0])); });
    rejectSource("retained lifecycle source rejects foreign owner proof", value => { value.impact.qualityLifecycleCorrection!.owners[0].path = "scripts/lib/isolated-supabase-transport.mjs"; });
    rejectSource("retained lifecycle source rejects substituted before bytes", value => { value.impact.qualityLifecycleCorrection!.owners[0].beforeSource += "\n"; });
    rejectSource("retained lifecycle source rejects recursive predecessor status", value => { value.impact.qualityLifecycleCorrection!.baselineReportImpact.status = "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT"; });
    rejectSource("retained lifecycle source rejects nested predecessor correction", value => { Object.assign(value.impact.qualityLifecycleCorrection!.baselineReportImpact, { qualityLifecycleCorrection: {} }); });
    rejectSource("retained lifecycle source rejects relabeling behavior", value => { value.impact.retainedBehaviorRelabelled = true; });
    rejectSource("retained lifecycle source rejects unreviewed declaration", value => { value.impact.qualityLifecycleCorrection!.owners[0].afterSource += "\nexport const arbitraryRelaxation = true;"; });
    verifyRetainedFinalQualityReconciliationSourceControls({ impact, retained, candidate, lifecycleAuthority: authority });
  }

  // Lint the complete generated config with the same effective repository rules
  // and pathname as a real owned source snapshot; no rule overrides or ignores.
  {
    const { ESLint } = await import("eslint");
    const builder = ownerFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "isolatedPublicImageConfigSource");
    assert.ok(builder);
    const code = ts.transpileModule(builder.getText(ownerFile).replace(/^export /u, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const build = new Function("assert", code + ";return isolatedPublicImageConfigSource;")(assert) as (port: number, sha: string) => string;
    const generated = build(57604, sha256(readFileSync(path.join(root, "next.config.ts"))));
    const eslint = new ESLint({ cwd: root }), filePath = path.join(root, "next.config.mjs");
    const config = await eslint.calculateConfigForFile(filePath);
    assert.ok(config); assert.equal(config.rules["@next/next/no-assign-module-variable"][0], 2);
    cases.push("full generated config uses the effective enabled Next banned-module ESLint rule");
    const result = await eslint.lintText(generated, { filePath, warnIgnored: true });
    assert.equal(result.length, 1); assert.equal(result[0].errorCount, 0); assert.equal(result[0].warningCount, 0); assert.deepEqual(result[0].messages, []);
    cases.push("full generated owned Next config passes actual repository ESLint with zero warnings");
    assert.equal(generated.split("const transpiledConfig = await").length - 1, 1);
    assert.equal(generated.split("transpiledConfig.default ?? transpiledConfig").length - 1, 1);
    const original = generated.replace("const transpiledConfig = await", "const module = await")
      .replace("transpiledConfig.default ?? transpiledConfig", "module.default ?? module");
    const rejected = await eslint.lintText(original, { filePath, warnIgnored: true });
    assert.equal(rejected.length, 1); assert.equal(rejected[0].errorCount, 1); assert.equal(rejected[0].warningCount, 0);
    assert.deepEqual(rejected[0].messages.map(row => row.ruleId), ["@next/next/no-assign-module-variable"]);
    cases.push("the original full generated config reproduces exactly the banned-module lint failure");
  }
}

async function retainedFinalQualityOnly() {
  verifyFinalQualityGatePlan(); const admissionControls = await verifyAdmissionQualificationControls();
  await verifyRetainedFinalQualityAdmissionControls(admissionControls); await verifyRetainedFinalQualityWorkerControls();
  console.log(JSON.stringify({ status: "PASS", checks: cases.length, cases, memoryOnlyArtifacts: false, tempFixtureCleanupVerified: true, realWorkers: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0 }, null, 2));
}

const verification = process.argv.includes("--ci-change-impact") || process.argv.includes("--change-impact-only") ? changeImpactOnly : process.argv.includes("--local-risk-verification-only") ? localRiskVerificationOnly : process.argv.includes("--retained-final-quality-only") ? retainedFinalQualityOnly : process.argv.includes("--public-image-config-only") ? async () => console.log(JSON.stringify(await verifyOwnedPublicImageConfig(true), null, 2)) : process.argv.includes("--cli-control-pulse-only") ? async () => console.log(JSON.stringify(await verifyIsolatedApplicationCliPulse(), null, 2)) : process.argv.includes("--closure-checkpoints-only") ? closureCheckpointsOnly : process.argv.includes("--restore-acl-only") ? restoreAclOnly : process.argv.includes("--admin-control-lease-only") ? adminControlLeaseOnly : process.argv.includes("--cli-diagnostics-only") ? cliDiagnosticsOnly : process.argv.includes("--network-boundary-only") ? networkBoundaryOnly : process.argv.includes("--current-infrastructure-only") ? currentInfrastructureOnly : process.argv.includes("--image-identity-only") ? imageIdentityOnly : main;
const selectedVerification = process.argv.includes("--admission-qualification-only") ? admissionQualificationOnly
  : process.argv.includes("--owned-child-controls-only") ? ownedChildControlsOnly : verification;
(process.argv.includes("--execute-qualified-impact") ? changeImpactOnly : selectedVerification)().catch((error: unknown) => {
  if (process.argv.includes("--current-infrastructure-only") || selectedVerification === main && !process.argv.includes("--execute-qualified-impact")) {
    const currentInfrastructure = process.argv.includes("--current-infrastructure-only");
    const scope = currentInfrastructure ? "current-infrastructure-only" : "source/offline";
    if (!currentInfrastructure) console.error("FAIL isolated Supabase source/offline contract verification; raw error details suppressed.");
    // Keep the original rejection and the first failing location. Never print
    // arbitrary messages, stack text, actual/expected strings or connection data.
    try {
      const value = error instanceof Error ? error : undefined;
      const data = (key: string) => value && Object.getOwnPropertyDescriptor(value, key)?.value;
      const scalar = (input: unknown): unknown => typeof input === "boolean" || input === null ? input
        : typeof input === "number" && Number.isFinite(input) ? input
        : typeof input === "string" ? { type: "string", length: input.length, sha256: sha256(input) }
        : Array.isArray(input) ? { type: "array", length: input.length }
        : { type: typeof input };
      const message = data("message"), stack = value?.stack;
      const locations = typeof stack === "string" ? stack.split("\n").slice(1).flatMap(line => {
        const owned = /verify-isolated-supabase\.mts:(\d+):(\d+)/u.exec(line);
        const projected = /<anonymous>:(\d+):(\d+)/u.exec(line);
        return owned ? [{ source: "scripts/verify-isolated-supabase.mts", line: Number(owned[1]), column: Number(owned[2]) }]
          : projected ? [{ source: currentInfrastructure ? "projected-current-owner" : "projected-owned-control", line: Number(projected[1]), column: Number(projected[2]) }] : [];
      }).slice(0, 6) : [];
      const operator = data("operator"), code = data("code");
      console.error(JSON.stringify({ status: "FAIL", scope, completedControls: cases.length,
        lastCompletedControl: currentInfrastructure ? cases.at(-1) ?? null : scalar(cases.at(-1)),
        error: { name: value instanceof assert.AssertionError ? "AssertionError" : value instanceof ReferenceError ? "ReferenceError"
          : value instanceof TypeError ? "TypeError" : value instanceof SyntaxError ? "SyntaxError" : "Error",
          code: code === "ERR_ASSERTION" ? code : null,
          operator: typeof operator === "string" && /^(?:strictEqual|notStrictEqual|deepStrictEqual|notDeepStrictEqual|==|!=|throws|rejects|match|doesNotMatch)$/u.test(operator) ? operator : null,
          actual: scalar(data("actual")), expected: scalar(data("expected")), locations,
          message: scalar(message), safeMessage: currentInfrastructure && value instanceof ReferenceError && message === "drainControlPulse is not defined" ? message : null },
        rawDetailsSuppressed: true }));
    } catch {
      console.error(JSON.stringify({ status: "FAIL", scope, completedControls: cases.length,
        diagnosticProjectionFailed: true, rawDetailsSuppressed: true }));
    }
  } else console.error("FAIL isolated Supabase source/offline contract verification; raw error details suppressed.");
  process.exitCode = 1;
});
