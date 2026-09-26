import assert from "node:assert/strict";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runIsolatedSupabase } from "./lib/isolated-supabase.mts";
import { runApplicationHandoff } from "./lib/isolated-public-application.mts";
import { verifyMenuResourceIntegrity } from "./verify-menu-resource-integrity-isolated.mts";
import { verifyTopicCommandCompletion } from "./verify-topic-command-completion-isolated.mts";
import { verifyOwnedPublicReadCompleteness } from "./verify-public-read-completeness-isolated.mts";
import { verifyOwnedApplicationRestore } from "./lib/isolated-application-restore-verification.mts";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
assert.equal(args.length, 2); assert.equal(args[0], "--cli-binary");
const artifactDir = resolve(root, ".tmp-qa/audit2-root-cause-ci");
mkdirSync(artifactDir, { recursive: true });
const report: { status: string; steps: Array<{ name: string; durationMs: number; value: unknown }>; cleanup?: unknown; error?: unknown } = { status: "running", steps: [] };
const record = () => writeFileSync(resolve(artifactDir, "root-cause-result.json"), JSON.stringify(report, null, 2) + "\n");
async function step<T>(name: string, run: () => Promise<T>) {
  const start = Date.now(); const value = await run();
  report.steps.push({ name, durationMs: Date.now() - start, value }); record(); console.log(`PASS ${name}`); return value;
}
try {
  await runIsolatedSupabase({
    lockPath: resolve(root, "scripts/fixtures/isolated-supabase/stack.lock.json"), artifactDir,
    cliBinary: resolve(args[1]), pgPort: 57601, restPort: 57602, storagePort: 57603, apiPort: 57604,
    handoff: async handle => {
      await step("fresh-application", () => runApplicationHandoff(handle));
      await handle.renewDatabaseControlConnection();
      await step("menu-target-reference-integrity", () => verifyMenuResourceIntegrity(handle));
      await handle.renewDatabaseControlConnection();
      await step("topic-command-completion", () => verifyTopicCommandCompletion(handle));
      await handle.renewDatabaseControlConnection();
      await step("public-enumeration-mapping-rendering", () => verifyOwnedPublicReadCompleteness(handle, artifactDir));
      await handle.renewDatabaseControlConnection();
      await step("application-schema-data-acl-restore", () => verifyOwnedApplicationRestore(handle, resolve(artifactDir, "restore")));
    },
  });
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  const failure = error as { name?: string; code?: string; stage?: string; message?: string };
  // Detailed native diagnostics remain in the owned lifecycle logs. The CI
  // summary never serializes SQL, connection configuration, or credentials.
  report.error = { name: failure.name, code: failure.code, stage: failure.stage, message: failure.message?.slice(0, 1000) };
  process.exitCode = 1;
} finally {
  const cleanup = resolve(artifactDir, "cleanup.json");
  if (existsSync(cleanup)) report.cleanup = JSON.parse(readFileSync(cleanup, "utf8"));
  record(); console.log(`Audit root-cause native matrix ${report.status}`);
}
