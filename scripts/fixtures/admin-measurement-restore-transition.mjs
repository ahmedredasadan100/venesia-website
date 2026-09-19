import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha256 = /^[a-f0-9]{64}$/u;
const jobId = /^[a-z0-9-]+$/u;
const readOnlyOperations = new Set(["goto", "back", "reload", "settle-network", "assert", "snapshot"]);

// The existing control job owns stateEffect. A restore job also names the
// immediately pending mutated job with restoresJobId; no filename infers either.

export function readCompletedRestoreReceipt(control, output, phase, id) {
  assert.ok(phase === "before" || phase === "after");
  assert.match(id, jobId);
  const receipt = JSON.parse(readFileSync(join(control, `${phase}-restore-receipt-${id}.json`), "utf8"));
  const pointer = JSON.parse(readFileSync(join(control, `${phase}-result-${id}.json`), "utf8"));
  const artifact = join(output, `job-${id}.json`);
  assert.deepEqual(pointer, { status: "pass", path: artifact }, "Restore result pointer must identify this run's completed job.");
  assert.equal(createHash("sha256").update(readFileSync(artifact)).digest("hex"), receipt.restoreResultSha256,
    "Restore receipt no longer matches the completed job artifact.");
  return receipt;
}

export function assertFreshMeasurementControl(files, phase) {
  assert.ok(phase === "before" || phase === "after");
  assert.ok(!files.some(file => file === `${phase}-current-job.json`
    || file === `${phase}-ready.json`
    || file.startsWith(`${phase}-result-`)
    || file.startsWith(`${phase}-restore-receipt-`)),
  "An interrupted or completed measurement cannot resume from existing control receipts; start a fresh owned fixture lifecycle.");
}

export function createAdminMeasurementRestoreTransition(identity) {
  assert.match(identity.runId, /^[a-f0-9-]{36}$/u);
  assert.ok(identity.phase === "before" || identity.phase === "after");
  for (const key of ["sourceSha256", "fixtureSha256", "baselineSha256"]) assert.match(identity[key], sha256);
  let state = "BASELINE_READY";
  let pending = null;
  let active = null;
  let successfulRestore = null;
  let successfulRestoreSha256 = null;

  const verifyReceipt = receipt => {
    assert.ok(receipt && successfulRestore, "Successful restore receipt is missing.");
    assert.deepEqual(receipt, successfulRestore, "Restore receipt does not match this run, baseline, fixture and completed restore job.");
    assert.equal(digest(receipt), successfulRestoreSha256, "Restore receipt provenance changed.");
    assert.equal(receipt.completed, true);
    assert.equal(receipt.success, true);
  };

  return {
    get state() { return state; },
    get restoreReceiptJobId() { return successfulRestore?.restoreJobId ?? null; },
    authorize(job, receipt) {
      assert.equal(active, null, "A measurement job is still active.");
      assert.match(job.id, jobId);
      assert.ok(["read-only", "state-mutating", "restore"].includes(job.stateEffect),
        `Job ${job.id} requires explicit stateEffect: read-only, state-mutating or restore.`);
      assert.ok(Array.isArray(job.steps) && job.steps.length <= 150);
      if (job.stateEffect === "read-only") {
        assert.ok(job.steps.every(step => readOnlyOperations.has(step.op)),
          `Read-only job ${job.id} contains an action that can change fixture state.`);
      } else if (job.stateEffect === "restore") {
        const changedAt = job.steps.findIndex(step => !readOnlyOperations.has(step.op));
        assert.ok(changedAt >= 0 && job.steps.slice(changedAt + 1).some(step => step.op === "assert"
          || (step.op === "snapshot" && step.formAssertions)),
        `Restore job ${job.id} must change state and then assert the restored fixture.`);
      }
      if (state === "RESTORE_SUCCEEDED") {
        verifyReceipt(receipt);
        state = "BASELINE_READY";
        pending = null;
        successfulRestore = null;
        successfulRestoreSha256 = null;
      }
      if (state === "RESTORE_REQUIRED") {
        assert.equal(job.stateEffect, "restore", `Restore is required before job ${job.id}.`);
        assert.equal(job.restoresJobId, pending.id, "Restore job does not identify the pending mutated job.");
      } else {
        assert.equal(state, "BASELINE_READY", "Measurement run is no longer clean.");
        assert.notEqual(job.stateEffect, "restore", "Restore has no pending mutated job.");
        assert.equal(job.restoresJobId, undefined, "Only a restore job may declare restoresJobId.");
      }
      active = job.id;
    },
    complete(job, result, scenarioSha256, resultArtifactSha256) {
      assert.equal(active, job.id, "Completion must match the active job.");
      active = null;
      if (result.status !== "pass") {
        state = "ABORTED";
        throw new Error(`Measurement job ${job.id} failed; abort this run without continuation.`);
      }
      assert.match(scenarioSha256, sha256);
      assert.match(resultArtifactSha256, sha256);
      assert.equal(result.id, job.id);
      assert.equal(result.scenarioSha256, scenarioSha256);
      assert.ok(Number.isFinite(result.finishedAt), "Job completion time is required for restore provenance.");
      if (job.stateEffect === "state-mutating") {
        state = "STATE_MUTATED";
        pending = { id: job.id, scenarioSha256 };
        state = "RESTORE_REQUIRED";
      } else if (job.stateEffect === "restore") {
        assert.equal(state, "RESTORE_REQUIRED");
        successfulRestore = {
          kind: "admin-measurement-restore", ...identity,
          mutatedJobId: pending.id, mutatedScenarioSha256: pending.scenarioSha256,
          restoreJobId: job.id, restoreScenarioSha256: scenarioSha256,
          restoreResultSha256: resultArtifactSha256,
          completedAt: result.finishedAt, completed: true, success: true,
        };
        successfulRestoreSha256 = digest(successfulRestore);
        state = "RESTORE_SUCCEEDED";
        return successfulRestore;
      }
      return null;
    },
    finish(receipt) {
      assert.equal(active, null);
      if (state === "RESTORE_SUCCEEDED") {
        verifyReceipt(receipt);
        state = "BASELINE_READY";
      }
      assert.equal(state, "BASELINE_READY", "A successful restore is required before completing this measurement run.");
    },
  };
}
