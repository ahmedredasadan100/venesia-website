import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, type IncomingMessage } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { verifyIsolatedApplicationCliPulse } from "./verify-isolated-application-cli-pulse.mjs";
import { verifyApplicationClosureCheckpointsOffline } from "./verify-application-closure-checkpoints.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const cases: string[] = [];

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
  for (const candidate of ["../private.json", "C:/private.json", ".tmp-qa/old/bootstrap.sql", "node_modules/hidden.sql", ".env.local", "debug.log"]) {
    check(`lock rejects unsafe artifact path ${candidate}`, () => assert.throws(() => assertLockedArtifactPath(candidate)));
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

async function currentInfrastructureOnly() {
  const sources = ["scripts/lib/isolated-supabase.mts", "scripts/qa-isolated-supabase.mts", "scripts/lib/isolated-public-application.mts", "scripts/lib/isolated-supabase-cli.mts", "scripts/verify-isolated-supabase.mts", "scripts/fixtures/isolated-supabase/stack.lock.json", "scripts/fixtures/isolated-supabase/compose.test.yml"];
  const texts = Object.fromEntries(sources.map(file => [file, readSource(file)]));
  const sourceHashes = Object.fromEntries(sources.map(file => [file, sha256(texts[file])]));
  for (const file of sources.slice(0, 4)) check(`current canonical source safety: ${file}`, () => assert.deepEqual(sourceFailures(texts[file], file), []));
  const owner = await import("./lib/isolated-supabase.mts");
  const cli = await import("./lib/isolated-supabase-cli.mts");
  const lock = owner.readReleaseLock(path.join(root, "scripts/fixtures/isolated-supabase/stack.lock.json"));
  check("actual lifecycle lock binds the official CLI tool contract", () => cli.assertApplicationMigrationTool(lock.applicationMigrationTool));
  verifyDockerMountNormalization(owner);
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
    function inspect(node: ts.Node) { if (ts.isCallExpression(node)) assert.ok(allowed.has(node.expression.getText(file)), "Unexpected cleanup-only operation."); ts.forEachChild(node, inspect); }
    inspect(cleanupBranch.thenStatement);
    assert.ok(cleanupBranch.elseStatement.getText(file).includes('currentStage = "upstream-provenance"'));
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
    assert.ok(helper.includes('PGPASSWORD: password') && !helper.includes("context.password}@"));
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

async function verifyAdminMeasurementControlLease(owner: typeof import("./lib/isolated-supabase.mts")) {
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
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let policy: ts.IfStatement | undefined;
  let driverLaunches = 0;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "runChild") driverLaunches++;
    if (ts.isIfStatement(node) && ts.isBlock(node.thenStatement)
      && node.thenStatement.statements.some(statement => ts.isExpressionStatement(statement)
        && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(file) === "receipt"
        && statement.expression.arguments[1]?.getText(file) === '"admin-driver-restart-rejected.json"')) policy = node;
    ts.forEachChild(node, visit);
  };
  visit(file); assert.ok(policy, "Admin measurement failure must reject reuse at the canonical owner.");
  assert.equal(driverLaunches, 1, "A failed measurement driver cannot launch a repair child against the same fixture.");
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
  const png = readFileSync(path.join(root, "public/images/venesia-5.png"));
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
    const verifySnapshot = new Function("manifest", "digest", "readFileSync", "sourcePath", "join", "sourceDirectory", "imageConfig", "readdirSync", "assert", verifyCode + ";return verify;")(
      [{ file: "next.config.ts", sha256: originalSha256 }], sha256, readFileSync, () => path.join(beforeDirectory, "next.config.ts"),
      path.join, afterDirectory, { file: "next.config.mjs", sha256: generatedConfigSha256 }, readdirSync, assert);
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
async function verifyRetainedFinalQualityAdmissionControls() {
  const source = readSource("scripts/lib/isolated-public-verification.mts");
  const file = ts.createSourceFile("isolated-public-verification.mts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = (name: string) => {
    const rows = file.statements.filter(node => ts.isFunctionDeclaration(node) ? node.name?.text === name : ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === name));
    assert.equal(rows.length, 1, name); return rows[0];
  };
  const compile = (value: string) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const constants = ["FINAL_QUALITY_ACCOUNTING", "FINAL_QUALITY_READINESS", "RETAINED_FINAL_QUALITY_AUTHORITY"].map(name => statement(name).getText(file)).join("\n");
  const config = new Function(compile(constants) + ";return {base:FINAL_QUALITY_ACCOUNTING,admission:FINAL_QUALITY_READINESS,authority:RETAINED_FINAL_QUALITY_AUTHORITY};")() as {
    base: string; admission: string; authority: { operationIdentitySha256: string; caseIdentitySha256: string; priorAccounting: { path: string; sha256: string }; final27Plan: { path: string; sha256: string } };
  };
  assert.equal(config.authority.operationIdentitySha256, "15721c1324f7123bcdbb6d72669ff81cf34229ff748e0e04ffbd39709f42d517");
  assert.equal(config.authority.caseIdentitySha256, "f8a774a6e85c6ab9ec0bce374a5e18f286e8b840ed5b46349714ee00dae44d71");
  assert.equal(config.authority.priorAccounting.sha256, "34f9f296582055191d68b8415f44324587b68a77d29169317f159c84d3f573ab");
  assert.ok(!statement("loadRetainedFinalQualityAdmission").getText(file).includes("process.env"));
  const { sourceIncluded } = await import("./lib/verification-source-inventory.mts");
  type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
  const memoryRoot = path.resolve(tmpdir(), "venisia-memory-only-quality-contract");
  const base = ".tmp-qa/core-final-closure/", b = config.base, h = "b".repeat(40), oldHead = "a".repeat(40);
  const operationIds = [...Array.from({ length: 73 }, (_, index) => "retained-" + index), ...Array.from({ length: 10 }, (_, index) => "media-" + index), ...Array.from({ length: 27 }, (_, index) => "final-" + index), "footer-na"];
  const caseKeys = Array.from({ length: 959 }, (_, index) => "case-" + String(index).padStart(3, "0"));
  const rolePaths: Record<string, string> = { admission: config.admission, candidate: b + "final-source-manifest.json", ledger: b + "final-current-accounting-successor.json", operations: b + "final-111-reconciliation.json", integrity: b + "final-evidence-integrity.json", impact: b + "source-impact-current-to-final.json", producer: b + "final-accounting-producer-execution.json", review: b + "final-accounting-root-review.json", parent: config.authority.priorAccounting.path,
    progress: base + "final-accounting-interim/progress-73-retained-1-na-0-hard-37-held-after-hard-open-2026-10-03.json", old: b + "retained-qualification.json", media7: b + "r144-partial/partial-qualification.json", media3: b + "browser-r145-qualified-observations.json", final: b + "browser-r146-qualified-observations.json", owner: path.posix.dirname(config.authority.priorAccounting.path) + "/materialize.mjs", blocker: b + "domain-blocker.json", na: b + "footer-disposition.json", proof: b + "scoped-proof.json", log: base + "browser-r146/public-admin-adoption.stdout.log", product: "src/app/page.tsx", package: "package.json" };
  for (const name of ["public-source-manifest.json", "public-and-admin-adoption-gates.json", "admin-adoption-browser.json", "admin-adoption-database-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json", "selected-journey-canonical-inventory/admin-adoption-browser.json"]) rolePaths[name] = base + "browser-r146/" + name;
  Object.assign(rolePaths, { partial: b + "browser-r148-qualified-observations.json", composition: b + "final27-composite-qualification.json", compositeImpact: b + "source-impact-partial148-to-final-six.json", originalPlan: config.authority.final27Plan.path, verifyowner: "scripts/verify-admin-core-date-controls.mjs" });
  for (const name of ["public-source-manifest.json", "admin-adoption-browser.json", "partial-native-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json", "public-normal-build.json", "public-product-surface-build.json", "public-platform-contracts.json", "public-admin-adoption.json"]) rolePaths["partial-" + name] = base + "browser-r148/" + name;
  for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) for (const stream of ["stdout", "stderr"]) rolePaths["partial-public-" + name + "." + stream + ".log"] = base + "browser-r148/public-" + name + "." + stream + ".log";
  Object.assign(rolePaths, { middle: b + "browser-r149-qualified-observations.json", compositeUpdateImpact: b + "source-impact-partial148-to-final-update.json", residualImpact: b + "source-impact-partial149-to-final-update.json" });
  for (const [role, file] of Object.entries(rolePaths)) if (role.startsWith("partial-")) rolePaths["middle-" + role.slice("partial-".length)] = file.replace("browser-r148/", "browser-r149/");
  const marker = (role: string): Json => ({ fixtureRef: role });
  const fixture = (mutate?: (edit: (role: string, keys: Array<string | number>, value: Json | undefined) => void) => void, composite: boolean | "three" = false) => {
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
    put("admission", { status: "ROOT_REVIEWED_FINAL_BEHAVIOR_READY_FOR_QUALITY", sourceHead: h, sourceManifest: marker("candidate"), accounting: marker("ledger"), operations: marker("operations"), integrity: marker("integrity"), sourceCompatibility: marker("impact"), accountingOwner: ownerRef, producerExecution: marker("producer"), closureEligible: false, closureBlockers: [marker("blocker")], final27: { qualification: marker("final"), sourceManifest: marker("public-source-manifest.json"), gateReceipt: marker("public-and-admin-adoption-gates.json"), originalHookRun: "browser-r52", ...(composite ? { composition: marker("composition") } : {}) }, operationCounts: counts, namedCellCounts, remainingPredicates: 3, incompleteDomainInventories: 1, openPreviewStates: 1, cleanup: { remainingOwnedResources: 0, remainingOwnedProcesses: 0 }, automaticCoverage: [], globalClosed: false });
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
    const authority = { operationIdentitySha256: sha256(JSON.stringify([...operationIds].sort())), caseIdentitySha256: sha256(JSON.stringify(caseKeys)), priorAccounting: priorAuthority, final27Plan: composite ? seal("originalPlan") : config.authority.final27Plan };
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
  const guard = new Function("assert", "prepared", "adminCredentials", "CORE_PREVIEW_PUBLIC_IMPACT_SELECTION", "validateCorePreviewPublicImpactSelection", "validateCoreJourneySelection", compile("return async function(request) { const context={assertOwned:async()=>{}}; " + requestCode + ";return {adoption,retainedQuality}; }"))(assert, { get: () => ({}) }, { get: () => ({}) }, "preview-public-impact", () => undefined, () => undefined) as (request: Record<string, unknown>) => Promise<{ adoption: boolean; retainedQuality: boolean }>;
  const requests = { retained: { additionalSourceFiles: [], finalQualityGate: true, retainedAdminBehaviorAdmissionSha256: "f".repeat(64) }, legacy: { additionalSourceFiles: [], finalQualityGate: true, selection: "admin-adoption", adoptionScope: "core-closure", adoptionCohort: "domain-forms" } };
  assert.deepEqual(await guard(requests.retained), { adoption: false, retainedQuality: true }); assert.deepEqual(await guard(requests.legacy), { adoption: true, retainedQuality: false });
  for (const patch of [{ finalQualityGate: undefined }, { selection: "admin-adoption" }, { selection: "build-contracts" }, { adoptionCohort: "domain-forms" }, { additionalSourceFiles: ["scripts/foreign.mts"] }, { retainedAdminBehaviorAdmissionSha256: "bad" }]) await assert.rejects(guard({ ...requests.retained, ...patch }));
  await assert.rejects(guard({ additionalSourceFiles: [], finalQualityGate: true }));
  cases.push("actual request guard preserves legacy combined Quality and rejects mixed retained/subset/measurement admission");
  const gateDeclaration = run.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => row.name.getText(file) === "gates")); assert.ok(gateDeclaration);
  const gates = new Function("request", "adoption", "measurement", compile(statement("GATES").getText(file) + "\n" + gateDeclaration.getText(file)) + ";return gates;") as (request: object, adoption: boolean, measurement?: unknown) => Array<{ name: string }>;
  assert.deepEqual(gates(requests.retained, false).map(row => row.name), ["normal-build", "product-surface-build", "platform-contracts", "public-e2e"]);
  assert.deepEqual(gates(requests.legacy, true).map(row => row.name), ["normal-build", "product-surface-build", "platform-contracts", "public-e2e", "admin-adoption"]);
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
  assert.ok(gates && planner);
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
  const closure = await verifyApplicationClosureCheckpointsOffline();
  cases.push(...closure.cases);
  await verifyRestoreAclPolicy();
  verifyFinalQualityGatePlan();
  await verifyRetainedFinalQualityAdmissionControls(); await verifyRetainedFinalQualityWorkerControls();
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
  console.log(JSON.stringify({ status: "PASS", checks: cases.length, cases, sourceHashes: hashes, lockSha256: provenance.hash, dockerExecuted: false, networkRequests: 0, databaseCalls: 0, environmentLoaded: false, integrationReadinessClaimed: false }, null, 2));
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
  const eligible = new Function("request", ts.transpileModule("return (" + argument + ");", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText) as (request: Record<string, unknown>) => boolean;
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
  assert.ok(handler.includes('if (request.selection === "admin-interactions" || request.selection === "admin-adoption") publicJob = undefined;'));
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
      proofFunctionSha256: string; lifecycleBeforeLfSha256: string; lifecycleAfterLfSha256: string; controlsAfterSha256: string };
    const nodeName = (node: ts.Statement) => ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) ? node.name?.text
      : ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 && ts.isIdentifier(node.declarationList.declarations[0].name)
        ? node.declarationList.declarations[0].name.text : undefined;
    const declaration = (name: string) => { const value = ownerFile.statements.find(node => nodeName(node) === name); assert.ok(value); return value; };
    const text = (name: string) => declaration(name).getText(ownerFile).replace(/\r\n/gu, "\n");
    const proofNode = declaration("assertRetainedFinalQualityLifecycleSource");
    const transformations: Array<{ from: string; to: string }> = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "exactReplace"
        && node.arguments.length >= 3 && ts.isStringLiteralLike(node.arguments[1]) && ts.isStringLiteralLike(node.arguments[2]))
        transformations.push({ from: node.arguments[1].text, to: node.arguments[2].text });
      ts.forEachChild(node, visit);
    };
    visit(proofNode); assert.equal(transformations.length, 11);
    const undo = (source: string) => transformations.reduce((value, row) => value.split(row.to).join(row.from), source);
    const p = "scripts/lib/isolated-public-verification.mts", l = "scripts/lib/isolated-supabase.mts", c = "scripts/verify-isolated-supabase.mts";
    const workerNames = ["RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS", "RETAINED_QUALITY_WORKER_SOURCE", "loadRetainedFinalQualityAdmissionAsync"];
    const priorPublic = [undo(text("isolatedPublicImageConfigSource")), undo(text("assertRetainedFinalQualitySource")), text("loadRetainedFinalQualityAdmission"), undo(text("runOwnedPublicVerification")), text("GATES")].join("\n\n");
    const oldMetadata = "memoryOnlyArtifacts: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0";
    const newMetadata = "memoryOnlyArtifacts: false, tempFixtureCleanupVerified: true, realWorkers: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0";
    const priorControls = 'function retainedAssertion() { assert.equal("preserved", "preserved"); }\n'
      + 'async function main() { await verifyRetainedFinalQualityAdmissionControls(); }\n'
      + 'async function retainedFinalQualityOnly() { await verifyRetainedFinalQualityAdmissionControls(); console.log({' + oldMetadata + '}); }';
    const nextControls = priorControls.replaceAll("await verifyRetainedFinalQualityAdmissionControls();", "await verifyRetainedFinalQualityAdmissionControls(); await verifyRetainedFinalQualityWorkerControls();")
      .replace(oldMetadata, newMetadata) + '\nasync function verifyRetainedFinalQualityWorkerControls() { return; }';
    const priorLifecycle = 'export function healthyLease() { return "existing contract"; }\n';
    const nextLifecycle = 'export function healthyLease() { return "reviewed exact retained eligibility"; }\n';
    const baselineManifest = [{ file: p, sha256: sha256(priorPublic) }, { file: l, sha256: sha256(priorLifecycle) },
      { file: c, sha256: sha256(priorControls) }, { file: "src/app/page.tsx", sha256: "e".repeat(64) }].sort((a, b) => a.file.localeCompare(b.file));
    const authority: Authority = { sourceHead: "b".repeat(40), sourceSha256: sha256(JSON.stringify(baselineManifest)),
      owners: { [p]: sha256(priorPublic), [l]: sha256(priorLifecycle), [c]: sha256(priorControls) },
      workerStatementsSha256: sha256(workerNames.map(text).join("\n")), proofFunctionSha256: sha256(text("assertRetainedFinalQualityLifecycleSource")),
      lifecycleBeforeLfSha256: sha256(priorLifecycle), lifecycleAfterLfSha256: sha256(nextLifecycle), controlsAfterSha256: sha256(nextControls) };
    const nextPublic = ['import { Worker } from "node:worker_threads";', 'import ts from "typescript";', ...workerNames.map(text),
      text("RetainedQualityLifecycleCorrection"), text("assertRetainedFinalQualityLifecycleSource"),
      "const RETAINED_QUALITY_LIFECYCLE_BASELINE = Object.freeze(" + JSON.stringify(authority) + ");",
      text("isolatedPublicImageConfigSource"), text("assertRetainedFinalQualitySource"), text("loadRetainedFinalQualityAdmission"), text("runOwnedPublicVerification"), text("GATES")].join("\n\n");
    const owners: Owner[] = [[p, priorPublic, nextPublic], [l, priorLifecycle, nextLifecycle], [c, priorControls, nextControls]]
      .map(([file, beforeSource, afterSource]) => ({ path: file, beforeSource, afterSource, beforeSha256: sha256(beforeSource), afterSha256: sha256(afterSource) }));
    const retained: Source = { invocationHeadSha: "a".repeat(40), sourceSha256: authority.sourceSha256, manifest: baselineManifest };
    const baseline: Source = { ...retained, invocationHeadSha: authority.sourceHead };
    const candidate: Source = { invocationHeadSha: "c".repeat(40), sourceSha256: "", manifest: structuredClone(baselineManifest) };
    const ref = (name: string) => ({ path: ".tmp-qa/core-final-closure/" + name, sha256: "f".repeat(64) });
    const binding = (source: Source, name: string) => ({ sourceHead: source.invocationHeadSha, sourceSha256: source.sourceSha256, sourceManifest: ref(name) });
    const impact: Impact = { status: "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT", retained: binding(retained, "retained.json"),
      candidate: binding(candidate, "candidate.json"), changes: [], retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false,
      qualityLifecycleCorrection: { baselineSource: baseline, baselineReportImpact: { status: "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT",
        retained: binding(retained, "retained.json"), candidate: binding(baseline, "baseline.json"), changes: [],
        retainedBehaviorRelabelled: false, retainedBehaviorReexecuted: false, automaticCoverage: [], globalClosed: false },
        reviewStatus: "ROOT_REVIEWED_EXACT_POST151_LIFECYCLE_CORRECTION", owners } };
    const reseal = (value: { impact: Impact; candidate: Source }) => {
      const entries = value.impact.qualityLifecycleCorrection!.owners;
      for (const row of entries) { row.afterSha256 = sha256(row.afterSource); const item = value.candidate.manifest.find(item => item.file === row.path); if (item) item.sha256 = row.afterSha256; }
      value.candidate.sourceSha256 = sha256(JSON.stringify(value.candidate.manifest)); value.impact.candidate.sourceSha256 = value.candidate.sourceSha256;
      const prior = new Map(retained.manifest.map(row => [row.file, row.sha256]));
      value.impact.changes = [...new Set([...prior.keys(), ...value.candidate.manifest.map(row => row.file)])].sort().flatMap(file => {
        const next = value.candidate.manifest.find(row => row.file === file)?.sha256;
        return prior.get(file) === next ? [] : [{ path: file, beforeSha256: prior.get(file) ?? null, afterSha256: next ?? "0".repeat(64),
          role: Object.hasOwn(authority.owners, file) ? "exact-quality-lifecycle-correction" : "non-executable-closure-report" }];
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
    rejectSource("retained source rejects the prior banned generated binding", value => editGenerator(value, "const transpiledConfig = await", "const module = await"));
    rejectSource("retained source rejects a different generated binding rename", value => editGenerator(value, "const transpiledConfig = await", "const arbitraryConfig = await"));
    rejectSource("retained source rejects a partial generated reference rename", value => editGenerator(value, "transpiledConfig.default ?? transpiledConfig", "module.default ?? module"));
    rejectSource("retained source rejects changed generated normalization", value => editGenerator(value, "transpiledConfig.default ?? transpiledConfig", "transpiledConfig.default || transpiledConfig"));
    rejectSource("retained source rejects a widened generated image boundary", value => editGenerator(value, "/storage/v1/object/public/cms-images/**", "/**"));
    rejectSource("retained source rejects a removed generated source digest assertion", value => editGenerator(value, "assert.equal(createHash", "void(createHash"));
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
  verifyFinalQualityGatePlan(); await verifyRetainedFinalQualityAdmissionControls(); await verifyRetainedFinalQualityWorkerControls();
  console.log(JSON.stringify({ status: "PASS", checks: cases.length, cases, memoryOnlyArtifacts: false, tempFixtureCleanupVerified: true, realWorkers: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0 }, null, 2));
}

const verification = process.argv.includes("--retained-final-quality-only") ? retainedFinalQualityOnly : process.argv.includes("--public-image-config-only") ? async () => console.log(JSON.stringify(await verifyOwnedPublicImageConfig(true), null, 2)) : process.argv.includes("--cli-control-pulse-only") ? async () => console.log(JSON.stringify(await verifyIsolatedApplicationCliPulse(), null, 2)) : process.argv.includes("--closure-checkpoints-only") ? closureCheckpointsOnly : process.argv.includes("--restore-acl-only") ? restoreAclOnly : process.argv.includes("--admin-control-lease-only") ? adminControlLeaseOnly : process.argv.includes("--cli-diagnostics-only") ? cliDiagnosticsOnly : process.argv.includes("--network-boundary-only") ? networkBoundaryOnly : process.argv.includes("--current-infrastructure-only") ? currentInfrastructureOnly : process.argv.includes("--image-identity-only") ? imageIdentityOnly : main;
verification().catch(() => { console.error("FAIL isolated Supabase source/offline contract verification; raw error details suppressed."); process.exitCode = 1; });
