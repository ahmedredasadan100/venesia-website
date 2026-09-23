import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

console.log("PASS verification infrastructure: source, loader, owner boundaries and restore transition positive/negative controls.");
