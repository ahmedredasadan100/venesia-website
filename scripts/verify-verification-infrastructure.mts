import { verifyVerificationTextContract } from "./fixtures/verification-text-contract.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentArchitectureBoundaryFiles, evaluateArchitectureBoundaries } from "./lib/architecture-boundary-guard.mts";
import { assertFreshMeasurementControl, createAdminMeasurementRestoreTransition, readCompletedRestoreReceipt } from "./fixtures/admin-measurement-restore-transition.mjs";
import { classifyVerificationImport, loadVerificationOwner } from "./lib/verification-module-loader.mjs";
import { selectSourceInventory, sourceIncluded } from "./lib/verification-source-inventory.mts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const required = ["package.json", "package-lock.json", "tsconfig.json"];
assert.deepEqual(selectSourceInventory([...required, "new-root-config.mjs", "src/new-owner.ts"]),
  [...required, "new-root-config.mjs", "src/new-owner.ts"].sort(), "A valid new tracked source must enter the snapshot automatically.");
assert.throws(() => selectSourceInventory(required.slice(1)), /Required tracked build input is missing: package.json/u);
assert.equal(sourceIncluded(".env.example"), true, "The exact public template is eligible verification input.");
assert.deepEqual(selectSourceInventory([...required, ".env.example"]), [...required, ".env.example"].sort(),
  "Only the exact tracked template must enter the snapshot.");
assert.deepEqual(selectSourceInventory(required), required.slice().sort(), "The template must not be synthesized when absent from Git.");
assert.throws(() => selectSourceInventory(required, [".env.example"]), /must be Git tracked/u);
assert.throws(() => selectSourceInventory([...required, ".env.example"], [".env.example"]), /must be Git tracked/u);
for (const file of [".env", ".env.local", ".env.production", ".env.production.local", ".ENV.example", ".env.EXAMPLE",
  "nested/.env.example", "src/.env.example", ".env.example.local", ".env.example/child", "./.env.example", "../.env.example",
  "/.env.example", "C:/.env.example", "C:\\.env.example", ".env.example\0", "private/.env.example"]) {
  assert.equal(sourceIncluded(file), false, `Private or aliased template path must stay excluded: ${file}`);
  assert.equal(selectSourceInventory([...required, file]).includes(file), false);
  assert.throws(() => selectSourceInventory(required, [file]), /Unsafe additional source/u);
}
assert.equal(sourceIncluded(".env.local"), false);
assert.equal(sourceIncluded("scripts/private/secret.ts"), false);
assert.equal(sourceIncluded("docs/new-contract.md"), true);

const scratch = mkdtempSync(join(tmpdir(), "venisia-verification-loader-"));
try {
  mkdirSync(join(scratch, "src"));
  writeFileSync(join(scratch, "src", "helper.ts"), "export const answer = 42;\n");
  writeFileSync(join(scratch, "entry.ts"), `import { createHash } from "node:crypto";
import { answer } from "./src/helper";
import { answer as aliasAnswer } from "@/helper";
export const result = [createHash("sha256").update("x").digest("hex").length, answer, aliasAnswer];\n`);
  const entry = join(scratch, "entry.ts");
  assert.deepEqual(loadVerificationOwner(entry, scratch).result, [64, 42, 42],
    "A Node builtin, a local module and a source alias must resolve without treating the builtin as a file.");
  assert.equal(classifyVerificationImport("typescript", entry, scratch).kind, "package");
  assert.equal(classifyVerificationImport("node:fs", entry, scratch).kind, "builtin");
  assert.throws(() => classifyVerificationImport("../foreign", entry, scratch), /escapes the source root/u);
} finally {
  rmSync(scratch, { recursive: true });
}

const files = currentArchitectureBoundaryFiles(root);
assert.deepEqual(evaluateArchitectureBoundaries(root, files), [], "Current canonical owners must satisfy architecture direction.");
const readOwner = "src/lib/admin/projects/project-entry-data.ts";
const invalidReadOwner = evaluateArchitectureBoundaries(root, [readOwner], new Map([
  [readOwner, 'import { createSupabaseFetch } from "../../supabase-fetch"; export const read = createSupabaseFetch;'],
]));
assert.equal(invalidReadOwner.length, 1, "A read owner importing transport internals must fail.");
assert.match(invalidReadOwner[0].contract, /timing callbacks/u);
assert.deepEqual(evaluateArchitectureBoundaries(root, [readOwner], new Map([
  [readOwner, "export function read(onTiming: (stage: string) => void) { onTiming('read'); }"],
])), [], "Coordinator supplied callbacks must remain allowed.");
const shared = "src/components/admin/entity-list/AdminEntityList.tsx";
assert.equal(evaluateArchitectureBoundaries(root, [shared], new Map([
  [shared, 'import { getSupabaseAdmin } from "../../../lib/supabase-admin"; export { getSupabaseAdmin };'],
])).length, 1, "A shared component bypassing its data owner must fail.");
const publicConsumers = [
  ["src/app/(site)/topics/page.tsx", "../../../lib"],
  ["src/components/page-composition/PageSlotLayout.tsx", "../../lib"],
] as const;
for (const [source, lib] of publicConsumers) {
  assert.equal(evaluateArchitectureBoundaries(root, [source], new Map([
    [source, `import { getSupabaseAdmin } from "${lib}/supabase-admin"; export { getSupabaseAdmin };`],
  ])).length, 1, "A public template or presenter bypassing its public data owner must fail.");
  assert.equal(evaluateArchitectureBoundaries(root, [source], new Map([
    [source, 'import { createClient } from "@supabase/supabase-js"; export { createClient };'],
  ])).length, 1, "A public template or presenter creating a parallel Supabase client must fail.");
  assert.equal(evaluateArchitectureBoundaries(root, [source], new Map([
    [source, 'import { unstable_cache } from "next/cache"; export { unstable_cache };'],
  ])).length, 1, "A public template or presenter creating a parallel cache must fail.");
  assert.deepEqual(evaluateArchitectureBoundaries(root, [source], new Map([
    [source, `import { loadPublicContentCollection } from "${lib}/content/public-content-read/owner"; export { loadPublicContentCollection };`],
  ])), [], "A public consumer adopting the existing read owner must pass.");
}
const runtime = "src/lib/admin/entity-list/data-engine/fixture.ts";
assert.equal(evaluateArchitectureBoundaries(root, [runtime], new Map([
  [runtime, 'import { loadProjectEntry } from "../../projects/project-entry-data"; export { loadProjectEntry };'],
])).length, 1, "A generic runtime importing an entity owner must fail.");

const identity = { runId: "11111111-1111-4111-8111-111111111111", phase: "before",
  sourceSha256: "a".repeat(64), fixtureSha256: "b".repeat(64), baselineSha256: "c".repeat(64) };
const mutated = { id: "sample-1", stateEffect: "state-mutating", steps: [{ op: "click" }] };
const restore = { id: "restore-1", stateEffect: "restore", restoresJobId: "sample-1",
  steps: [{ op: "fill" }, { op: "assert" }] };
const next = { id: "sample-2", stateEffect: "state-mutating", steps: [{ op: "click" }] };
const readOnly = { id: "read-1", stateEffect: "read-only", steps: [{ op: "goto" }, { op: "assert" }] };
const scenarioSha = "d".repeat(64);
const pass = (job: { id: string }) => ({ id: job.id, status: "pass", scenarioSha256: scenarioSha, finishedAt: 1000 });
const restoreArtifact = JSON.stringify(pass(restore));
const resultSha = createHash("sha256").update(restoreArtifact).digest("hex");
const pendingRestore = (bound = identity) => {
  const transition = createAdminMeasurementRestoreTransition(bound);
  transition.authorize(mutated);
  transition.complete(mutated, pass(mutated), scenarioSha, resultSha);
  assert.equal(transition.state, "RESTORE_REQUIRED");
  transition.authorize(restore);
  return transition;
};
const completeRestore = (bound = identity) => {
  const transition = pendingRestore(bound);
  const receipt = transition.complete(restore, pass(restore), scenarioSha, resultSha);
  assert.equal(transition.state, "RESTORE_SUCCEEDED");
  return { transition, receipt };
};
{
  const { transition, receipt } = completeRestore();
  transition.authorize(next, receipt);
  assert.equal(transition.state, "BASELINE_READY");
  transition.complete(next, pass(next), scenarioSha, resultSha);
  assert.equal(transition.state, "RESTORE_REQUIRED");
}
{
  const transition = createAdminMeasurementRestoreTransition(identity);
  transition.authorize(mutated);
  transition.complete(mutated, pass(mutated), scenarioSha, resultSha);
  assert.throws(() => transition.authorize(next), /Restore is required/u);
  assert.throws(() => transition.finish(), /successful restore is required/u);
}
{
  const transition = pendingRestore();
  assert.throws(() => transition.complete(restore, { ...pass(restore), status: "fail" }, scenarioSha, resultSha), /abort this run/u);
  assert.throws(() => transition.authorize(next), /no longer clean/u);
}
{
  const previousRun = completeRestore().receipt;
  const differentRun = completeRestore({ ...identity, runId: "22222222-2222-4222-8222-222222222222" });
  assert.throws(() => differentRun.transition.authorize(next, previousRun), /does not match this run/u);
  const differentBaseline = completeRestore({ ...identity, baselineSha256: "e".repeat(64) });
  assert.throws(() => differentBaseline.transition.authorize(next, previousRun), /does not match this run/u);
  const differentFixture = completeRestore({ ...identity, fixtureSha256: "f".repeat(64) });
  assert.throws(() => differentFixture.transition.authorize(next, previousRun), /does not match this run/u);
}
{
  const { transition, receipt } = completeRestore();
  assert.throws(() => transition.authorize(next), /receipt is missing/u);
  assert.throws(() => transition.authorize(next, { ...receipt, success: false }), /does not match this run/u);
  transition.authorize(next, receipt);
}
{
  const directory = mkdtempSync(join(tmpdir(), "venisia-restore-receipt-"));
  try {
    const control = join(directory, "control"), output = join(directory, "output");
    mkdirSync(control); mkdirSync(output);
    const { transition, receipt } = completeRestore();
    const artifact = join(output, "job-restore-1.json");
    writeFileSync(artifact, restoreArtifact);
    writeFileSync(join(control, "before-result-restore-1.json"), JSON.stringify({ status: "pass", path: artifact }));
    const receiptFile = join(control, "before-restore-receipt-restore-1.json");
    writeFileSync(receiptFile, JSON.stringify(receipt));
    assert.deepEqual(readCompletedRestoreReceipt(control, output, "before", "restore-1"), receipt);
    transition.authorize(next, readCompletedRestoreReceipt(control, output, "before", "restore-1"));
    writeFileSync(artifact, "corrupted result");
    assert.throws(() => readCompletedRestoreReceipt(control, output, "before", "restore-1"), /no longer matches/u);
    writeFileSync(artifact, restoreArtifact);
    writeFileSync(join(control, "before-result-restore-1.json"), JSON.stringify({ status: "pass", path: join(directory, "foreign.json") }));
    assert.throws(() => readCompletedRestoreReceipt(control, output, "before", "restore-1"), /must identify this run/u);
  } finally {
    rmSync(directory, { recursive: true });
  }
}
{
  const transition = createAdminMeasurementRestoreTransition(identity);
  transition.authorize(readOnly);
  transition.complete(readOnly, pass(readOnly), scenarioSha, resultSha);
  transition.finish();
  assert.throws(() => createAdminMeasurementRestoreTransition(identity).authorize({ ...readOnly, steps: [{ op: "click" }] }), /can change fixture state/u);
  assert.throws(() => createAdminMeasurementRestoreTransition(identity).authorize({ ...readOnly, stateEffect: undefined }), /requires explicit stateEffect/u);
}
assertFreshMeasurementControl(["before-job-sample-1.json", "after-result-old.json"], "before");
for (const stale of ["before-current-job.json", "before-ready.json", "before-result-sample-1.json", "before-restore-receipt-restore-1.json"])
  assert.throws(() => assertFreshMeasurementControl([stale], "before"), /cannot resume/u);

/** Protect the existing CI integration; this is not another runner or release profile. */
function assertQualityChangeImpactWorkflow(source: string, scripts: Readonly<Record<string, string>>) {
  const yaml = createRequire(import.meta.url)("js-yaml") as { load(value: string): unknown };
  const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
  const workflow = yaml.load(source);
  assert.ok(record(workflow) && record(workflow.jobs));
  assert.deepEqual(workflow.on, { pull_request: { branches: ["main"] }, push: { branches: ["main"] } }, "Keep the existing event boundary; never use pull_request_target for candidate source.");
  const names: Readonly<Record<string, string>> = {
    "quality-gate": "Lint · Typecheck · Verify · Build",
    "topic-view-postgres": "Metrics and Publishing Integrity · PostgreSQL 17",
    "media-coordination-postgres": "Media Coordination · PostgreSQL 17",
    "topics-bulk-publish-postgres": "Topics Bulk Publish · PostgreSQL 17",
    "taxonomy-consistency-postgres": "Taxonomy Consistency · PostgreSQL 17 · PostgREST",
    "dashboard-truth-postgres": "Dashboard Truth · PostgreSQL 17",
    "reports-analytics-postgres": "Reports Analytics · PostgreSQL 17",
    "audit-root-cause-postgres": "Command Recovery and Public Read Integrity · Full Supabase",
  };
  assert.deepEqual(Object.keys(workflow.jobs).sort(), Object.keys(names).sort(), "Preserve existing job identities without a parallel QA job.");
  const active = (value: Record<string, unknown>) => !Object.hasOwn(value, "if") && (!Object.hasOwn(value, "continue-on-error") || value["continue-on-error"] === false);
  for (const [id, job] of Object.entries(workflow.jobs)) {
    assert.ok(record(job) && active(job), `${id}: existing job must propagate failure without a new condition`);
    assert.equal(job.name, names[id], `${id}: preserve its existing check identity`);
    if (id !== "quality-gate" && id !== "audit-root-cause-postgres") {
      assert.ok(record(job.services) && record(job.services.postgres), `${id}: retain isolated PostgreSQL service`);
      assert.equal(job.services.postgres.image, "postgres:17-alpine", `${id}: PostgreSQL 17 remains distinct from PGlite`);
      if (id === "taxonomy-consistency-postgres") {
        assert.ok(record(job.services.postgrest));
        assert.equal(job.services.postgrest.image, "postgrest/postgrest:v16.2");
      }
    }
  }
  const job = workflow.jobs["quality-gate"];
  assert.ok(record(job) && Array.isArray(job.steps));
  assert.ok(job.steps.every(record));
  const steps = job.steps as Record<string, unknown>[];
  const exactly = (predicate: (step: Record<string, unknown>) => boolean, label: string) => {
    const matches = steps.filter(predicate); assert.equal(matches.length, 1, label); return matches[0]!;
  };
  const checkout = exactly(step => step.uses === "actions/checkout@v5", "Use the existing full-history checkout once");
  assert.ok(active(checkout) && record(checkout.with));
  assert.equal(checkout.with["fetch-depth"], 0, "Event baselines require full history");
  assert.equal(checkout.with["persist-credentials"], false, "Source consistency uses local Git history without retaining checkout credentials");
  const install = exactly(step => step.run === "npm ci", "Keep canonical dependency installation once");
  const impact = exactly(step => step.id === "qa-change-impact", "The existing primary job must run source consistency once");
  assert.ok(active(install) && active(impact));
  assert.equal(impact.run, 'npm run --silent verify:isolated-supabase -- --ci-change-impact > "$RUNNER_TEMP/qa-change-impact.json"', "Run only the existing source consistency adapter; event values never become shell commands");
  assert.equal(scripts["verify:isolated-supabase"], "node --experimental-strip-types scripts/verify-isolated-supabase.mts", "Keep the canonical verifier owner");
  const emptySecrets = { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" };
  assert.deepEqual(impact.env, emptySecrets, "Source-only inspection must not inherit database credentials or override event provenance");
  const artifact = exactly(step => step.uses === "actions/upload-artifact@v4" && record(step.with) && step.with.name === "qa-change-impact-${{ github.run_id }}-${{ github.run_attempt }}", "Preserve the exact sanitized report for this attempt");
  assert.equal(typeof artifact.if, "string");
  assert.equal((artifact.if as string).replace(/\s+/gu, ""), "${{always()&&steps.qa-change-impact.outcome!='skipped'&&steps.qa-change-impact.outcome!=''}}", "Publish after success/failure/cancellation only when the source step started");
  assert.ok(!Object.hasOwn(artifact, "continue-on-error") || artifact["continue-on-error"] === false);
  assert.ok(record(artifact.with));
  assert.equal(artifact.with.path, "${{ runner.temp }}/qa-change-impact.json", "Do not upload the source workspace, private files or unrelated proof");
  assert.equal(artifact.with["if-no-files-found"], "error");
  assert.ok(!Object.hasOwn(artifact.with, "overwrite") || artifact.with.overwrite === false);
  const browser = exactly(step => step.run === "npx playwright install --with-deps chromium", "Preserve the existing browser installation");
  const gate = exactly(step => step.run === "npm run ci:check", "Preserve the complete canonical required gate once");
  assert.ok(active(browser) && active(gate));
  assert.equal(steps.indexOf(impact), steps.indexOf(install) + 1, "Inspect source before expensive browser setup");
  assert.equal(steps.indexOf(artifact), steps.indexOf(impact) + 1, "Keep failed source evidence before later steps");
  assert.ok(steps.indexOf(browser) > steps.indexOf(artifact) && steps.indexOf(gate) > steps.indexOf(browser), "Source consistency does not replace Browser or the full required gate");
}

{
  const yaml = createRequire(import.meta.url)("js-yaml") as { load(value: string): unknown; dump(value: unknown, options?: { lineWidth: number }): string };
  const source = readFileSync(join(root, ".github/workflows/quality-gate.yml"), "utf8");
  const scripts = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;
  type Workflow = { on: Record<string, unknown>; jobs: Record<string, { name: string; steps: Array<Record<string, unknown>>; services?: Record<string, unknown>; [key: string]: unknown }> };
  const current = yaml.load(source) as Workflow;
  assertQualityChangeImpactWorkflow(source, scripts);
  assertQualityChangeImpactWorkflow(yaml.dump(current, { lineWidth: -1 }), scripts);
  const primary = (value: Workflow) => value.jobs["quality-gate"]!;
  const impact = (value: Workflow) => primary(value).steps.find(step => step.id === "qa-change-impact")!;
  const artifact = (value: Workflow) => primary(value).steps.find(step => step.uses === "actions/upload-artifact@v4")!;
  const gate = (value: Workflow) => primary(value).steps.find(step => step.run === "npm run ci:check")!;
  const negatives: Array<[string, (value: Workflow) => void]> = [
    ["missing fast integration", value => { primary(value).steps = primary(value).steps.filter(step => step.id !== "qa-change-impact"); }],
    ["ignored fast failure", value => { impact(value)["continue-on-error"] = true; }],
    ["conditional fast step", value => { impact(value).if = false; }],
    ["wrong source mode", value => { impact(value).run = String(impact(value).run).replace("--ci-change-impact", "--change-impact-only"); }],
    ["failure bypass", value => { impact(value).run = String(impact(value).run) + " || true"; }],
    ["untrusted event shell interpolation", value => { impact(value).run = String(impact(value).run) + " ${{ github.event.pull_request.title }}"; }],
    ["inherited database credentials", value => { delete (impact(value).env as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY; }],
    ["restored database secret", value => { (impact(value).env as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY = "${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"; }],
    ["forged event environment", value => { (impact(value).env as Record<string, unknown>).GITHUB_EVENT_PATH = "candidate-event.json"; }],
    ["shallow checkout", value => { (primary(value).steps.find(step => step.uses === "actions/checkout@v5")!.with as Record<string, unknown>)["fetch-depth"] = 1; }],
    ["retained checkout credential", value => { (primary(value).steps.find(step => step.uses === "actions/checkout@v5")!.with as Record<string, unknown>)["persist-credentials"] = true; }],
    ["missing source report", value => { primary(value).steps = primary(value).steps.filter(step => step.uses !== "actions/upload-artifact@v4"); }],
    ["success-only evidence", value => { artifact(value).if = "success()"; }],
    ["missing-report skip", value => { (artifact(value).with as Record<string, unknown>)["if-no-files-found"] = "ignore"; }],
    ["broad evidence upload", value => { (artifact(value).with as Record<string, unknown>).path = "."; }],
    ["overwritten attempt", value => { (artifact(value).with as Record<string, unknown>).overwrite = true; }],
    ["late source inspection", value => { const selected = impact(value); primary(value).steps = primary(value).steps.filter(step => step !== selected); primary(value).steps.push(selected); }],
    ["missing full gate", value => { primary(value).steps = primary(value).steps.filter(step => step.run !== "npm run ci:check"); }],
    ["ignored full gate failure", value => { gate(value)["continue-on-error"] = true; }],
    ["conditional full gate", value => { gate(value).if = false; }],
    ["duplicate full gate", value => { primary(value).steps.push({ run: "npm run ci:check" }); }],
    ["missing specialized job", value => { delete value.jobs["topic-view-postgres"]; }],
    ["renamed required check", value => { value.jobs["reports-analytics-postgres"]!.name = "Different Reports Check"; }],
    ["parallel QA job", value => { value.jobs["parallel-qa"] = { name: "Parallel QA", steps: [] }; }],
    ["conditional specialized job", value => { value.jobs["reports-analytics-postgres"]!.if = false; }],
    ["missing isolated service", value => { delete value.jobs["topic-view-postgres"]!.services; }],
    ["privileged PR event", value => { value.on.pull_request_target = {}; }],
  ];
  for (const [label, mutate] of negatives) {
    const changed = structuredClone(current); mutate(changed);
    assert.throws(() => assertQualityChangeImpactWorkflow(yaml.dump(changed, { lineWidth: -1 }), scripts), label);
  }
  assert.throws(() => assertQualityChangeImpactWorkflow(source, { ...scripts, "verify:isolated-supabase": "node scripts/parallel-qa.mjs" }), "Canonical source driver cannot be redirected");
  assert.throws(() => assertQualityChangeImpactWorkflow("jobs: [", scripts), "Malformed workflow must fail closed");
  console.log(`PASS existing QA change-impact workflow: 2 positive forms and ${negatives.length + 2} rejection controls; no workflow or integration runtime is executed.`);
}

console.log("PASS verification infrastructure: source, loader, owner boundaries and restore transition positive/negative controls.");

await verifyVerificationTextContract(root);
