import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
    ["legacy bucket DDL", 'db.query("CREATE TABLE storage.buckets (id text)");', "local-storage-ddl"],
    ["legacy object DDL", 'db.query("ALTER TABLE storage.objects ADD COLUMN owner text");', "local-storage-ddl"],
    ["permission grant repair", 'db.query("GRANT CREATE ON DATABASE postgres TO postgres");', "local-permission-repair"],
    ["permission role repair", 'db.query("ALTER ROLE postgres SUPERUSER");', "local-permission-repair"],
    ["local Auth emulation", 'db.query("CREATE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT null $$ LANGUAGE SQL");', "local-auth-emulation"],
  ];
  for (const [name, source, expected] of negative) check(`source guard rejects ${name}`, () => assert.ok(sourceFailures(source, "negative.mts").includes(expected)));
  check("source guard allows canonical imports and read-only catalog queries", () => {
    assert.deepEqual(sourceFailures('import { value } from "./isolated-supabase.mts"; const sql = "select has_database_privilege(current_user, current_database(), \'CREATE\')";', "valid.mts"), []);
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

async function main() {
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

const verification = process.argv.includes("--cli-diagnostics-only") ? cliDiagnosticsOnly : process.argv.includes("--network-boundary-only") ? networkBoundaryOnly : process.argv.includes("--current-infrastructure-only") ? currentInfrastructureOnly : process.argv.includes("--image-identity-only") ? imageIdentityOnly : main;
verification().catch(() => { console.error("FAIL isolated Supabase source/offline contract verification; raw error details suppressed."); process.exitCode = 1; });
