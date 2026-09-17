import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { runIsolatedSupabase } from "./lib/isolated-supabase.mts";
import { applyCanonicalApplicationVerificationPrefix } from "./lib/isolated-public-application.mts";
import { captureRlsMigration86Snapshot, assertFreshRlsMigration86Transition, assertRlsMigration86SourceContract } from "./lib/rls-migration86-verification.mts";
import { captureDatabaseSecurityCatalog, loadDatabaseSecurityContract } from "./lib/database-rls-security-contract.mts";

const root = resolve(import.meta.dirname, "..");
const options = new Map<string, string>();
let auditSearch = false;
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (key === "--audit-search") { assert.equal(auditSearch, false); auditSearch = true; continue; }
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
save("source-identities.json", { corpusSha256: sourceIdentity, migrations: migrations.map(({ file, sql }) => ({ file, sha256: hash(sql) })) });
await assertRlsMigration86SourceContract(migrations);
let stage = "bootstrap";
try {
  await runIsolatedSupabase({
    lockPath: resolve(root, "scripts/fixtures/isolated-supabase/stack.lock.json"),
    artifactDir: resolve(output, "runtime"), cliBinary: resolve(options.get("--cli-binary")!),
    dockerHost: options.get("--docker-host"),
    async handoff(handle) {
      if (auditSearch) {
        stage = "search-predecessor-prefix";
        save("prefix-before-search.json", await applyCanonicalApplicationVerificationPrefix(handle, "20260828233733"));
        const capture = async () => {
          const counts: Record<string, unknown> = {};
          for (const table of ["pages", "hero_templates", "breadcrumb_block_templates", "content_block_templates",
            "hero_assignments", "page_breadcrumb_block_assignments", "page_content_block_assignments", "admin_audit_logs"]) {
            counts[table] = (await handle.query(`select count(*)::int as count,
              encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text,'UTF8')),'hex') as rows_sha256
              from public.${table} t`)).rows[0];
          }
          const pages = (await handle.query(`select expected.slug,count(p.id)::int as matches,
            coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'path',p.path,'status',p.status,'page_type',p.page_type)
              order by p.id) filter(where p.id is not null),'[]'::jsonb) as identities
            from (values (1,'topics'),(2,'media-center-news'),(3,'media-center-press'),(4,'media-center-site-updates'),
              (5,'media-center-videos'),(6,'media-center-gallery'),(7,'search')) expected(position,slug)
            left join public.pages p on p.slug=expected.slug group by expected.position,expected.slug order by expected.position`)).rows;
          const registry = (await handle.query(`select count(*)::int as count,max(version) as head,
            encode(sha256(convert_to(jsonb_agg(to_jsonb(m) order by version)::text,'UTF8')),'hex') as rows_sha256
            from supabase_migrations.schema_migrations m`)).rows[0];
          return { counts, pages, registry };
        };
        stage = "capture-before-search";
        const before = await capture(); save("before-search.json", before);
        stage = "apply-search-original";
        let rejected = false;
        try { await applyCanonicalApplicationVerificationPrefix(handle, "20260830232134"); }
        catch { rejected = true; }
        assert.equal(rejected, true, "The known original Search failure did not reproduce.");
        const stages = JSON.parse(readFileSync(resolve(output, "runtime/stages.json"), "utf8")) as Array<Record<string, unknown>>;
        const cliFailure = stages.findLast(item => item.stage === "application-cli-result" && item.mode === "apply");
        assert.equal(cliFailure?.exitCode, 1);
        assert.equal(cliFailure?.sqlState, "P0002");
        assert.equal(cliFailure?.failedFile, "20260830232134_search_platform_module.sql");
        stage = "capture-search-rollback";
        const after = await capture(); save("after-search.json", after);
        assert.deepEqual(after, before, "Search failure changed transactional rows or prior registry.");
        save("search-failure-proof.json", { sqlState: cliFailure.sqlState, originalSourceSha256: hash(migrations.find(m => m.version === "20260830232134")!.sql),
          before, transactionalRowsUnchanged: true, registryUnchanged: true,
          sequenceRollbackClaimed: false, correctionApplied: false, productionRead: false, productionWrite: false });
        save("outcome.json", { status: "search-platform-decision-evidence", correctionApplied: false });
        return;
      }
      stage = "prefix-before86";
      save("prefix-before86.json", await applyCanonicalApplicationVerificationPrefix(handle, "20260819040000"));
      stage = "capture-before86";
      const before = await captureRlsMigration86Snapshot(handle, migrations);
      save("before86.json", before);
      stage = "apply86";
      const execution = await applyCanonicalApplicationVerificationPrefix(handle, "20260819041808");
      save("execution86.json", execution);
      stage = "verify86";
      const after = await captureRlsMigration86Snapshot(handle, migrations);
      save("after86.json", after);
      save("proof86.json", await assertFreshRlsMigration86Transition(before, after, migrations, execution));
      process.stdout.write(JSON.stringify({ stage: "migration86-verified", registry: after.registry.length }) + "\n");
      stage = "suffix-before-seo";
      save("suffix.json", await applyCanonicalApplicationVerificationPrefix(handle, "20260912224809"));
      stage = "capture-suffix-catalog";
      // Capture all current tables; an accepted historical contract cannot silently classify later tables.
      const contract = loadDatabaseSecurityContract(migrations, { throughVersion: "20260819040000" });
      save("suffix-security-catalog.json", await captureDatabaseSecurityCatalog(handle, contract));
      save("suffix-registry.json", (await handle.query(`select version,name,cardinality(statements) as statement_count,
        encode(sha256(convert_to(to_json(statements)::text,'UTF8')),'hex') as statements_sha256
        from supabase_migrations.schema_migrations order by version`)).rows);
      assert.equal(hash(JSON.stringify(corpus())), sourceIdentity, "Applied source changed during proof.");
      save("outcome.json", { status: "migration86-and-suffix-verified", productionRead: false, productionWrite: false });
    },
  });
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code : "MIGRATION86_PROOF_STOP";
  const queryId = typeof error === "object" && error !== null && "queryId" in error && typeof error.queryId === "string"
    && /^[a-z0-9-]+$/u.test(error.queryId) ? error.queryId : null;
  save("outcome.json", { status: "stopped", stage, code, queryId, productionRead: false, productionWrite: false });
  process.stderr.write(JSON.stringify({ stage: "stopped", at: stage, code }) + "\n");
  process.exitCode = 1;
}
