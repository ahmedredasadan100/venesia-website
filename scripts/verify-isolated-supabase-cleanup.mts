import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { assertAbruptRecoveryEvidence, IsolatedSupabaseError, observeApplicationClient } from "./lib/isolated-supabase.mts";

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
console.log(JSON.stringify({ status: "PASS", controls, dockerCalls: 0, databaseCalls: 0, productionAccess: false }));
