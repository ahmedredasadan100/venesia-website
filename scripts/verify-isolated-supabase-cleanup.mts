import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { assertAbruptRecoveryBaseline, assertRecoveryCurrentInventory, assertRecoveryCleanupAuthorized, assertAbruptRecoveryArtifactLayout, assertAbruptRecoveryEvidence, assertTerminalRecoveryFailure, readReleaseLock, IsolatedSupabaseError, observeApplicationClient } from "./lib/isolated-supabase.mts";

let controls = 0;
const passed = () => { controls++; };
const client = new EventEmitter();
let receiptCount = 0;
const observed = observeApplicationClient(client, () => { receiptCount++; });
let finalized = false;
const pending = observed.run(() => new Promise<never>(() => undefined)).finally(() => { finalized = true; });
assert.doesNotThrow(() => client.emit("error", new Error("sensitive transport diagnostic must not escape")));
passed();
await assert.rejects(pending, error => error instanceof IsolatedSupabaseError
  && error.code === "APPLICATION_CLIENT_DISCONNECTED" && !error.message.includes("sensitive"));
assert.equal(finalized, true);
passed();
assert.doesNotThrow(() => client.emit("error", new Error("second socket failure")));
assert.equal(receiptCount, 1);
passed();
assert.throws(() => observed.assertHealthy(), IsolatedSupabaseError);
passed();

const receiptFailureClient = new EventEmitter();
const receiptFailure = observeApplicationClient(receiptFailureClient, () => { throw Error("receipt filesystem failure"); });
const pendingReceipt = receiptFailure.run(() => new Promise<never>(() => undefined));
assert.doesNotThrow(() => receiptFailureClient.emit("error", new Error("idle failure")));
await assert.rejects(pendingReceipt, error => error instanceof IsolatedSupabaseError && error.code === "APPLICATION_CLIENT_RECEIPT_FAILED");
passed();
const healthyClient = new EventEmitter();
const healthy = observeApplicationClient(healthyClient, () => undefined);
assert.equal(await healthy.run(async () => 42), 42);
passed();
const handoffFailure = new Error("existing handoff failure");
await assert.rejects(healthy.run(async () => { throw handoffFailure; }), error => error === handoffFailure);
passed();

type Evidence = Parameters<typeof assertAbruptRecoveryEvidence>[0];
const runId = "a".repeat(32), projectName = `venisia-qa-${runId}`;
const services = ["db", "storage", "rest", "imgproxy", "api-gw", "qa-transport"];
const owned = services.map((service, index) => ({ service, identity: { kind: "container", id: String(index + 1).repeat(64),
  name: `${projectName}-${service}-1`, projectName, runId, createdAt: "2026-09-16T09:42:47Z" } }));
const evidence: Evidence = { expectedRunId: runId, matchedRunnerCount: 0, unreadableNodeCount: 0,
  intent: { runId, projectName, cleanupOnly: false, applicationHandoffRequested: true, failureInjection: null },
  baseline: { originalUserResourcesExact: true, servicesStarted: false, cleanupRequiresExactOperationalIdentity: true,
    operationalInventory: { sha256: "b".repeat(64) } },
  owned: [...owned, ...["database", "database-config", "storage-data"].map(name => ({ identity: {
    kind: "volume", id: `${projectName}_${name}`, name: `${projectName}_${name}`, projectName, runId, createdAt: "2026-09-16T09:42:46Z" } })),
  { identity: { kind: "network", id: "f".repeat(64), name: `${projectName}_isolated`, projectName, runId, createdAt: "2026-09-16T09:42:46Z" } }],
};
assert.doesNotThrow(() => assertAbruptRecoveryEvidence(structuredClone(evidence)));
passed();
const mutations: Array<(value: Evidence) => void> = [
  value => { value.matchedRunnerCount = 1; },
  value => { value.unreadableNodeCount = 1; },
  value => { value.matchedRunnerCount = Number.NaN; },
  value => { value.expectedRunId = "c".repeat(32); },
  value => { value.intent.cleanupOnly = true; },
  value => { value.intent.applicationHandoffRequested = false; },
  value => { value.intent.failureInjection = "before-handoff"; },
  value => { value.baseline.originalUserResourcesExact = false; },
  value => { value.baseline.servicesStarted = true; },
  value => { value.baseline.cleanupRequiresExactOperationalIdentity = false; },
  value => { value.baseline.operationalInventory = {}; },
  value => { (value.owned as unknown[]).pop(); },
  value => { (value.owned as unknown[])[1] = (value.owned as unknown[])[0]; },
  value => { (value.owned as unknown[])[0] = null; },
  value => { (value.owned as typeof owned)[0].service = "foreign"; },
  value => { (value.owned as typeof owned)[0].identity.runId = "d".repeat(32); },
  value => { (value.owned as typeof owned)[0].identity.createdAt = "invalid"; },
];
for (const mutate of mutations) {
  const changed = structuredClone(evidence);
  mutate(changed);
  assert.throws(() => assertAbruptRecoveryEvidence(changed), IsolatedSupabaseError);
  passed();
}
const terminalFailure = {
  expectedRunId: runId,
  failure: { stage: "application-handoff", code: "APPLICATION_CLIENT_DISCONNECTED", rawErrorRetained: false },
  cleanup: { status: "blocked", code: "COMMAND_TIMEOUT", stage: "volume-inspect", complete: false },
  result: { status: "needs_attention", platformReady: true, applicationHandoffRequested: true,
    applicationHandoffComplete: false, failureInjection: null,
    failure: { code: "APPLICATION_CLIENT_DISCONNECTED", stage: "application-handoff" },
    cleanup: { status: "blocked", code: "COMMAND_TIMEOUT" },
    releaseCommit: readReleaseLock(resolve("scripts/fixtures/isolated-supabase/stack.lock.json")).release.commit,
    runId, retainedProofsReexecuted: false },
};
assert.doesNotThrow(() => assertTerminalRecoveryFailure(structuredClone(terminalFailure))); passed();
const terminalMutations: Array<["failure" | "cleanup" | "result", string, unknown]> = [
  ["failure", "stage", "ownership"], ["failure", "code", "UNEXPECTED_CONTAINER_MOUNT"],
  ["failure", "rawErrorRetained", true], ["cleanup", "status", "complete"],
  ["cleanup", "code", "UNCLASSIFIED_FAILURE"], ["cleanup", "stage", "owned-container-remove"],
  ["cleanup", "complete", true], ["result", "status", "complete"],
  ["result", "runId", "c".repeat(32)], ["result", "releaseCommit", "f".repeat(40)],
  ["result", "platformReady", false], ["result", "applicationHandoffRequested", false],
  ["result", "applicationHandoffComplete", true], ["result", "failureInjection", "before-handoff"],
  ["result", "retainedProofsReexecuted", true], ["result", "failure", null],
  ["result", "failure", { code: "APPLICATION_CLIENT_DISCONNECTED", stage: "application-query" }],
  ["result", "cleanup", { status: "complete" }],
  ["result", "cleanup", { status: "blocked", code: "FOREIGN_VOLUME_CONSUMER" }],
];
for (const [group, key, value] of terminalMutations) {
  const changed = structuredClone(terminalFailure);
  (changed[group] as Record<string, unknown>)[key] = value;
  assert.throws(() => assertTerminalRecoveryFailure(changed), error => error instanceof IsolatedSupabaseError
    && error.code === "UNAPPROVED_TERMINAL_FAILURE_RECOVERY" && error.stage === "cleanup-preflight"); passed();
}
for (const group of ["failure", "cleanup", "result"] as const) {
  assert.throws(() => assertTerminalRecoveryFailure({ ...terminalFailure, [group]: undefined }), IsolatedSupabaseError); passed();
}
assert.throws(() => assertTerminalRecoveryFailure({ ...terminalFailure, expectedRunId: "invalid" }), IsolatedSupabaseError); passed();
// Admitted terminal files do not replace the existing process, manifest and baseline gates.
assert.doesNotThrow(() => { assertTerminalRecoveryFailure(terminalFailure); assertAbruptRecoveryEvidence(structuredClone(evidence)); }); passed();
for (const mutate of mutations) { const changed = structuredClone(evidence); mutate(changed);
  assert.throws(() => { assertTerminalRecoveryFailure(terminalFailure); assertAbruptRecoveryEvidence(changed); }, IsolatedSupabaseError); passed(); }

const runnerPath = resolve(".tmp-qa/core-final-closure/run-browser-cohort.mts");
const directDir = resolve(".tmp-qa/core-final-closure/browser-r57");
const layoutInput = { runnerPath, runnerArgument: "browser-r57", artifactDir: directDir };
assert.doesNotThrow(() => assertAbruptRecoveryArtifactLayout({ ...layoutInput, artifactDir: resolve(directDir, "runtime") })); passed();
assert.doesNotThrow(() => assertAbruptRecoveryArtifactLayout({ ...layoutInput, artifactDir: resolve(directDir, "runtime"), artifactLayout: "nested-runtime" })); passed();
assert.doesNotThrow(() => assertAbruptRecoveryArtifactLayout({ ...layoutInput, artifactLayout: "direct-runner-argument" })); passed();
const badLayouts: Array<Parameters<typeof assertAbruptRecoveryArtifactLayout>[0]> = [
  layoutInput,
  { ...layoutInput, artifactLayout: "nested-runtime" },
  { ...layoutInput, artifactLayout: "direct-runner-argument", artifactDir: resolve(directDir, "runtime") },
  { ...layoutInput, artifactLayout: "direct-runner-argument", artifactDir: resolve(directDir, "..", "browser-r58") },
  { ...layoutInput, artifactLayout: "direct-runner-argument", artifactDir: resolve(directDir, "..", "..", "foreign", "browser-r57") },
  { ...layoutInput, artifactLayout: "direct-runner-argument", runnerArgument: "../browser-r57" },
  { ...layoutInput, artifactLayout: "direct-runner-argument", runnerArgument: "browser-r57/runtime" },
  { ...layoutInput, artifactLayout: "direct-runner-argument", runnerArgument: "browser-r57\\runtime" },
  { ...layoutInput, artifactLayout: "direct-runner-argument", runnerArgument: "" },
  { ...layoutInput, artifactLayout: "direct-runner-argument", runnerArgument: directDir },
  { ...layoutInput, artifactLayout: "direct-runner-argument", runnerPath: resolve(".tmp-qa/other/run-browser-cohort.mts") },
  { ...layoutInput, artifactLayout: "arbitrary" as "nested-runtime" },
];
for (const input of badLayouts) { assert.throws(() => assertAbruptRecoveryArtifactLayout(input), IsolatedSupabaseError); passed(); }
for (const [requested, authorized] of [[false, false], [false, true], [true, true]] as const) {
  assert.doesNotThrow(() => assertRecoveryCleanupAuthorized(requested, authorized)); passed();
}
assert.throws(() => assertRecoveryCleanupAuthorized(true, false), error => error instanceof IsolatedSupabaseError
  && error.code === "RECOVERY_CLEANUP_NOT_AUTHORIZED" && error.stage === "cleanup"); passed();

const oldInventoryHash = "a".repeat(64), currentInventoryHash = "b".repeat(64);
const transition = { priorOperationalSha256: oldInventoryHash, currentOperationalSha256: currentInventoryHash,
  reason: "observed-pre-recovery-inventory-change" as const };
assert.deepEqual(assertAbruptRecoveryBaseline(oldInventoryHash, oldInventoryHash),
  { historicalBaselineUnchanged: true, baselineChangedBeforeRecovery: false }); passed();
assert.throws(() => assertAbruptRecoveryBaseline(oldInventoryHash, currentInventoryHash),
  error => error instanceof IsolatedSupabaseError && error.code === "PRIOR_BASELINE_CHANGED"); passed();
assert.deepEqual(assertAbruptRecoveryBaseline(oldInventoryHash, currentInventoryHash, transition),
  { historicalBaselineUnchanged: false, baselineChangedBeforeRecovery: true }); passed();
for (const invalid of [
  { ...transition, priorOperationalSha256: "c".repeat(64) },
  { ...transition, currentOperationalSha256: "c".repeat(64) },
  { ...transition, priorOperationalSha256: "bad" },
  { ...transition, currentOperationalSha256: "bad" },
  { ...transition, reason: "assumed-engine-only" as typeof transition.reason },
]) { assert.throws(() => assertAbruptRecoveryBaseline(oldInventoryHash, currentInventoryHash, invalid), IsolatedSupabaseError); passed(); }
assert.throws(() => assertAbruptRecoveryBaseline(oldInventoryHash, oldInventoryHash,
  { ...transition, currentOperationalSha256: oldInventoryHash }), IsolatedSupabaseError); passed();
const unownedInventory = { containers: [{ id: "foreign-container", state: "exited", labels: {} }],
  volumes: [{ id: "foreign-volume", labels: {} }], networks: [{ id: "foreign-network", labels: {} }], imageIds: ["foreign-image"] };
const canonicalInventory = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalInventory).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalInventory(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const expectedInventoryHash = createHash("sha256").update(canonicalInventory(unownedInventory)).digest("hex");
assert.doesNotThrow(() => assertRecoveryCurrentInventory(expectedInventoryHash, unownedInventory, projectName)); passed();
const withOwned = structuredClone(unownedInventory);
withOwned.containers.push({ id: "owned-container", state: "exited", labels: { "com.venisia.qa.run": projectName } });
assert.doesNotThrow(() => assertRecoveryCurrentInventory(expectedInventoryHash, withOwned, projectName)); passed();
const inventoryMutations: Array<(value: typeof unownedInventory) => void> = [
  value => { value.containers[0].state = "running"; },
  value => { value.containers.push({ id: "new-foreign", state: "exited", labels: {} }); },
  value => { value.containers.pop(); },
  value => { value.volumes.push({ id: "new-foreign-volume", labels: {} }); },
  value => { value.volumes.pop(); },
  value => { value.networks[0].id = "changed-network"; },
  value => { value.networks.push({ id: "new-foreign-network", labels: {} }); },
  value => { value.imageIds.push("new-foreign-image"); },
  value => { value.imageIds.pop(); },
];
for (const mutate of inventoryMutations) { const changed = structuredClone(unownedInventory); mutate(changed);
  assert.throws(() => assertRecoveryCurrentInventory(expectedInventoryHash, changed, projectName),
    error => error instanceof IsolatedSupabaseError && error.code === "RECOVERY_CURRENT_INVENTORY_CHANGED"); passed(); }
assert.doesNotThrow(() => assertRecoveryCurrentInventory(undefined, withOwned, projectName)); passed();

console.log(JSON.stringify({ status: "PASS", controls, dockerCalls: 0, databaseCalls: 0, productionAccess: false }));
