import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { runIsolatedSupabase } from "./lib/isolated-supabase.mts";
import { applyCanonicalApplicationVerificationPrefix } from "./lib/isolated-public-application.mts";
import { captureDatabaseSecurityCatalog, loadDatabaseSecurityContract } from "./lib/database-rls-security-contract.mts";
import { captureSearchMigration, readSearchMigrationContract, readTopicsAbsentRouteSourceProof,
  SEARCH_MIGRATION_VERSION, SEARCH_PREDECESSOR_VERSION,
  verifyFreshSearchMigration, verifySearchMigrationCompatibility } from "./lib/search-migration-verification.mts";

const root = resolve(import.meta.dirname, "..");
const options = new Map<string, string>();
let captureOnly = false;
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (key === "--capture-only") { assert.equal(captureOnly, false); captureOnly = true; continue; }
  assert.ok(["--output", "--cli-binary", "--docker-host"].includes(key)
    && !options.has(key) && process.argv[index + 1] && !process.argv[index + 1].startsWith("--"));
  options.set(key, process.argv[++index]);
}
assert.ok(options.has("--output") && options.has("--cli-binary"));
const output = resolve(options.get("--output")!);
assert.ok(output.startsWith(resolve(root, ".tmp-qa") + sep) && !existsSync(output));
mkdirSync(output, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function corpus() {
  return readdirSync(resolve(root, "sql/migrations")).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file)).sort()
    .map(file => ({ file, version: file.slice(0, 14), name: file.slice(15, -4),
      sql: readFileSync(resolve(root, "sql/migrations", file), "utf8").replace(/\r\n?/gu, "\n") }));
}
const migrations = corpus();
const sourceIdentity = hash(JSON.stringify(migrations));
const ownerFiles = ["scripts/qa-search-migration-compatibility.mts", "scripts/lib/search-migration-verification.mts",
  "scripts/lib/isolated-public-application.mts", "scripts/lib/isolated-supabase.mts", "scripts/lib/isolated-supabase-cli.mts",
  "scripts/lib/database-rls-security-contract.mts", "scripts/lib/migration-provenance.mjs", "scripts/lib/migration-history-compatibility.json"];
const ownerIdentities = () => ownerFiles.map(file => ({ file,
  sha256: hash(readFileSync(resolve(root, file), "utf8").replace(/\r\n?/gu, "\n")) }));
const ownerSource = ownerIdentities();
save("source-identities.json", { corpusSha256: sourceIdentity,
  migrations: migrations.map(({ file, sql }) => ({ file, sha256: hash(sql) })), owners: ownerSource });
if (!captureOnly) {
  const search = readSearchMigrationContract();
  save("search-source-contract.json", { originalSourceSha256: search.historicalSourceSha256,
    correctedSourceSha256: search.sourceSha256, launchers: search.launchers });
  save("topics-route-source-proof.json", readTopicsAbsentRouteSourceProof());
}
let stage = "bootstrap";
try {
  await runIsolatedSupabase({
    lockPath: resolve(root, "scripts/fixtures/isolated-supabase/stack.lock.json"),
    artifactDir: resolve(output, "runtime"), cliBinary: resolve(options.get("--cli-binary")!),
    dockerHost: options.get("--docker-host"),
    async handoff(handle) {
      stage = "search-predecessor-prefix";
      save("prefix-before-search.json", await applyCanonicalApplicationVerificationPrefix(handle, SEARCH_PREDECESSOR_VERSION));
      stage = "capture-search-registry";
      save("pre-search-registry.json", (await handle.query(`select version,name,cardinality(statements) as statement_count,
        encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex') as statements_sha256
        from supabase_migrations.schema_migrations order by version collate "C"`)).rows);
      stage = "capture-search-security";
      const security = loadDatabaseSecurityContract(migrations, { throughVersion: "20260819040000" });
      // Capture includes later unclassified tables; this is not an assertion
      // that the original declaration has adopted them.
      save("pre-search-security-catalog.json", await captureDatabaseSecurityCatalog(handle, security));
      if (!captureOnly) {
        stage = "search-historical-and-negative-probes";
        save("rollback-probes.json", await verifySearchMigrationCompatibility(handle));
        stage = "capture-before-fresh-search";
        const before = await captureSearchMigration(handle);
        save("before-search.json", before);
        stage = "apply-fresh-search-official-cli";
        const execution = await applyCanonicalApplicationVerificationPrefix(handle, SEARCH_MIGRATION_VERSION);
        save("search-execution.json", execution);
        stage = "verify-fresh-search";
        save("fresh-search-proof.json", await verifyFreshSearchMigration(handle, before, execution, migrations));
        stage = "suffix-before-seo";
        save("suffix.json", await applyCanonicalApplicationVerificationPrefix(handle, "20260912224809"));
        stage = "capture-suffix-security";
        save("suffix-security-catalog.json", await captureDatabaseSecurityCatalog(handle, security));
        save("suffix-registry.json", (await handle.query(`select version,name,cardinality(statements) as statement_count,
          encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex') as statements_sha256
          from supabase_migrations.schema_migrations order by version collate "C"`)).rows);
      }
      assert.equal(hash(JSON.stringify(corpus())), sourceIdentity, "Canonical source changed during Search capture.");
      assert.deepEqual(ownerIdentities(), ownerSource, "Search verification owner changed during execution.");
      save("outcome.json", { status: captureOnly ? "search-predecessor-captured" : "search-compatibility-and-suffix-verified",
        registryHead: captureOnly ? SEARCH_PREDECESSOR_VERSION : "20260912224809",
        searchExecuted: !captureOnly, securityClassificationClaimed: false, productionRead: false, productionWrite: false });
    },
  });
} catch (error) {
  const candidate = error !== null && typeof error === "object" && "code" in error ? error.code : null;
  const code = typeof candidate === "string" && /^[A-Z0-9_]+$/u.test(candidate) ? candidate : "SEARCH_PROOF_STOP";
  const id = error !== null && typeof error === "object" && "queryId" in error ? error.queryId : null;
  const queryId = typeof id === "string" && /^[a-z0-9-]+$/u.test(id) ? id : null;
  save("outcome.json", { status: "stopped", stage, code, queryId, productionRead: false, productionWrite: false });
  process.stderr.write(JSON.stringify({ stage: "stopped", at: stage, code }) + "\n");
  process.exitCode = 1;
}
