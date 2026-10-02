import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { assertCoreRecoveryReservationAge, createCoreRecoveryQueueReadFault, assertCoreRecoveryReceipt, assertCoreRecoveryAudit, assertCoreRecoveryDomainUnchanged, assertCoreRecoveryQueue } from "./fixtures/admin-core-media-recovery-journeys.mjs";

const require = createRequire(import.meta.url), checks = [];
const check = async (name, execute) => { await execute(); checks.push({ name, status: "pass" }); };
const path = "scripts/verify-admin-core-media-recovery-isolated.mts";
const compiled = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, transformers:{before:[context=>{const visit=node=>ts.isMetaProperty(node)&&node.keywordToken===ts.SyntaxKind.ImportKeyword?context.factory.createIdentifier("__controlledImportMeta"):ts.visitEachChild(node,visit,context);return node=>ts.visitNode(node,visit);}]}}).outputText;
function fixture(changes = {}, selection = null) {
  const faults = { ...changes }, timers = new Map(), statements = [], signatures = [];
  let nextPid = 100, cancels = 0, active = 0, rollbacks = 0, ended = false, storageCandidates = 0;
  const namespace = "qa-core-media-0123456789abcdef", assetIds = ["lease", "finalize", "missing", "cancel"].map(() => randomUUID());
  const assets = assetIds.map((id, index) => ({ id, display_name: namespace + "-" + ["lease", "finalize", "missing", "cancel"][index] + ".png", status: "active", bucket: "cms-images", object_key: "images/" + namespace + "/" + index + ".png", public_url: "http://127.0.0.1:65123/" + index + ".png" }));
  const media = { status: "pass", namespace, qaActorId: 7, articleId: 91, article: { title: "original", image: assets[0].public_url },
    assets, objects: assets.map(row => ({ bucket_id: row.bucket, name: row.object_key })), references: [{ id: randomUUID(), asset_id: assets[0].id, domain_key: "topics", entity_identity: "91", field_key: "image" }] };
  const holderBackends = new Map(); let disconnect; const disconnected = new Promise((_, reject) => { disconnect = () => reject(Error("controlled-holder-ended")); }); disconnected.catch(() => {});
  const stamp = "2026-09-26 00:00:00.123456+00";
  const query = async (sql, params = [], pid = 999) => {
    statements.push(sql);
    assert.equal(params.length, Math.max(0, ...[...sql.matchAll(/\$(\d+)/gu)].map(row => Number(row[1]))), "Exact SQL parameter binding.");
    if (sql.includes("pg_backend_pid() pid")) return { rows: [{ pid, database: "postgres", role: faults.wrongHolder ? "service_role" : "postgres", backend_start: stamp }] };
    if (sql.includes(" for update")) {
      if (faults.lockFailure) throw Error("controlled-lock");
      holderBackends.set(pid, stamp); return { rows: faults.missingTarget ? [] : [{ id: "owned" }] };
    }
    if (sql === "select clock_timestamp()::text observed_at") return { rows: [{ observed_at: stamp }] };
    if (sql.startsWith("select pg_stat_clear_snapshot()")) return { rows: [] };
    if (sql.includes("from pg_stat_activity where $1")) {
      signatures.push(params[1]);
      const storageCandidate = String(params[1]).includes("DELETE"); if (storageCandidate) storageCandidates++;
      const row = { pid: 201, backend_start: stamp, query_start: faults.changedStorageLifetime && storageCandidates > 1 ? "2026-09-26 00:00:02.123456+00" : "2026-09-26 00:00:01.123456+00", usename: storageCandidate ? "supabase_storage_admin" : "authenticator",
        datname: "postgres", state: "active", backend_type: "client backend", wait_event_type: "Lock", blockers: [params[0]], query_fingerprint: "a".repeat(32), signature_matches: true, ...(faults.candidate ?? {}) };
      return { rows: faults.multiple ? [row, { ...row, pid: 202 }] : [row] };
    }
    if (sql.startsWith("select pg_cancel_backend")) {
      assert.equal(params[6], holderBackends.get(params[4]));
      assert.ok(sql.includes("a.backend_start=$2") && sql.includes("a.query_start=$3") && sql.includes("md5(a.query)=$4") && sql.includes("h.backend_start=$7"));
      if (!faults.cancelMissing) cancels++;
      return { rows: faults.cancelMissing ? [] : [{ cancelled: !faults.cancelRefused }] };
    }
    if (sql.startsWith("select title,image")) return { rows: [{ title: faults.domainNotCommitted ? "original" : "QA Media Recovery committed title", image: assets[0].public_url }] };
    if (sql.startsWith("select public_url")) return { rows: [{ public_url: assets[0].public_url }] };
    if (sql.startsWith("select id,status from public.media_delete_reservations")) return { rows: faults.reservationMissing ? [] : [{ id: randomUUID(), status: "reserved" }] };
    if (sql.includes("from public.media_reference_write_leases") || sql.includes("from public.media_delete_reservations") || sql.includes("from public.admin_audit_logs")) return { rows: [] };
    if (sql === "rollback") { rollbacks++; if (faults.rollbackFailure) throw Error("controlled-rollback"); return { rows: [] }; }
    assert.ok(sql === "begin" || sql === "commit" || sql === "begin isolation level repeatable read read only" || sql.startsWith("set local "), "Unexpected SQL " + sql.slice(0, 70));
    return { rows: [] };
  };
  const handle = { query: (sql, params) => query(sql, params), withDatabaseConnection: async execute => {
    active++; const pid = nextPid++;
    try { const execution = execute({ query: (sql, params) => query(sql, params, pid) }); return await (pid === 101 ? Promise.race([execution, disconnected]) : execution); } finally { active--; }
  }};
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "setTimeout", "clearTimeout", "__controlledImportMeta", compiled)((name) => {
    if (name === "./lib/isolated-supabase.mts") return { assertOwnedLocalHandle: value => { assert.equal(value, handle); assert.equal(ended, false); } };
    if (name === "./verify-admin-core-media-isolated.mts") return { readCoreMediaCheckpoint: async () => structuredClone(media) };
    assert.ok(["node:assert/strict", "node:crypto"].includes(name)); return require(name);
  }, loaded, loaded.exports, (callback, milliseconds) => { if (milliseconds === 60000) { const id = randomUUID(); timers.set(id, callback); return id; } return setTimeout(callback, milliseconds); }, id => { if (timers.has(id)) timers.delete(id); else clearTimeout(id); }, {url:pathToFileURL(resolve(path)).href});
  const broker = loaded.exports.createOwnedCoreMediaRecoveryProof(handle, selection), token = randomUUID();
  return { broker, faults, statements, signatures, media, request: (step, scenario = "lease", change = {}) => broker.handleRequest({ id: randomUUID(), kind: "media-recovery-fault-" + step, scenario, token, ...change }),
    disconnect, counts: () => ({ active, cancels, rollbacks }), expire: () => { for (const callback of [...timers.values()]) callback(); }, end: () => { ended = true; } };
}

await check('followup-refuses-state-and-fault-before-actual-prerequisite',async()=>{const f=fixture({},'media-recovery-followup');await assert.rejects(f.broker.handleRequest({id:randomUUID(),kind:'media-recovery-state'}));await assert.rejects(f.request('arm','cancel'));assert.deepEqual(f.counts(),{active:0,cancels:0,rollbacks:0});await f.broker.close();});
await check('default-producer-rejects-followup-setup',async()=>{const f=fixture();await assert.rejects(f.broker.handleRequest({id:randomUUID(),kind:'media-recovery-followup-prepare'}));assert.deepEqual(f.counts(),{active:0,cancels:0,rollbacks:0});await f.broker.close();});
await check('followup-setup-rejects-caller-selected-payload',async()=>{const f=fixture({},'media-recovery-followup');await assert.rejects(f.broker.handleRequest({id:randomUUID(),kind:'media-recovery-followup-prepare',articleId:91}));await f.broker.close();});
await check('failed-actual-prerequisite-is-one-shot-and-cannot-unlock-followup',async()=>{const f=fixture({},'media-recovery-followup');const request=()=>({id:randomUUID(),kind:'media-recovery-followup-prepare'});await assert.rejects(f.broker.handleRequest(request()));await assert.rejects(f.broker.handleRequest(request()),/one-shot/u);await assert.rejects(f.request('arm','finalize'));assert.equal(f.counts().active,0);await f.broker.close();});
await check('unknown-followup-selector-rejected',()=>assert.throws(()=>fixture({},'unregistered')));

for (const scenario of ["lease", "finalize", "missing", "cancel"]) await check("actual-producer-" + scenario, async () => {
  const f = fixture(); await f.request("arm", scenario);
  if (scenario !== "lease") await f.request("switch", scenario);
  const result = await f.request("cancel", scenario); assert.equal(result.cancellationAcknowledged, true);
  assert.equal(result.domainCommitVerified, scenario === "lease");
  await f.request("release", scenario); assert.equal(f.counts().active, 0); assert.equal(f.counts().cancels, scenario === "cancel" ? 2 : 1);
  assert.equal((await f.broker.close()).activeLocks, 0);
});
for (const candidate of [{ usename: "postgres" }, { datname: "production" }, { state: "idle" }, { backend_type: "parallel worker" }, { wait_event_type: "IO" }, { blockers: [100, 200] }, { signature_matches: false }, { backend_start: "bad" }, { query_fingerprint: "bad" }]) await check("refuse-foreign-candidate-" + checks.length, async () => {
  const f = fixture({ candidate }); await f.request("arm"); await assert.rejects(f.request("cancel")); assert.equal(f.counts().cancels, 0); assert.equal(f.counts().active, 0); await f.broker.close();
});
for (const fault of ["multiple", "cancelMissing", "cancelRefused", "domainNotCommitted"]) await check("refuse-" + fault, async () => {
  const f = fixture({ [fault]: true }); await f.request("arm"); await assert.rejects(f.request("cancel")); assert.equal(f.counts().active, 0); await f.broker.close();
});
for (const fault of ["missingTarget", "wrongHolder", "lockFailure"]) await check("arm-cleanup-" + fault, async () => {
  const f = fixture({ [fault]: true }); await assert.rejects(f.request("arm")); assert.equal(f.counts().active, 0); await f.broker.close();
});
await check("switch-refuses-uncommitted-reservation-and-releases-storage", async () => {
  const f = fixture({ reservationMissing: true }); await f.request("arm", "finalize"); await assert.rejects(f.request("switch", "finalize")); assert.equal(f.counts().active, 0); assert.equal(f.counts().cancels, 0); await f.broker.close();
});
await check("changed-first-Storage-statement-cannot-be-cancelled", async () => {
  const f = fixture({ changedStorageLifetime: true }); await f.request("arm", "cancel");
  await assert.rejects(f.request("switch", "cancel")); assert.equal(f.counts().cancels, 0); assert.equal(f.counts().active, 0); await f.broker.close();
});
await check("compensation-cancel-failure-releases-both-owned-holders", async () => {
  const f = fixture(); await f.request("arm", "cancel"); await f.request("switch", "cancel"); assert.equal(f.counts().cancels, 1);
  f.faults.cancelRefused = true; await assert.rejects(f.request("cancel", "cancel")); assert.equal(f.counts().active, 0); await f.broker.close();
});
await check("phase-identity-and-token-guards", async () => {
  for (const [step, scenario, change] of [["cancel", "finalize", {}], ["switch", "lease", {}], ["cancel", "lease", { token: randomUUID() }]]) {
    const f = fixture(); await f.request("arm", scenario); await assert.rejects(f.request(step, scenario, change)); assert.equal(f.counts().active, 0); await f.broker.close();
  }
});
await check("no-caller-resource-selector", async () => {
  const f = fixture(); await assert.rejects(f.request("arm", "lease", { assetId: randomUUID() })); assert.equal(f.statements.length, 0); await f.broker.close();
});
await check("ended-holder-cannot-authorize-cancellation", async () => {
  const f = fixture(); await f.request("arm"); f.disconnect(); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.request("cancel")); assert.equal(f.counts().cancels, 0); await assert.rejects(f.broker.close()); assert.equal(f.counts().active, 0);
});
await check("expiry-is-failed-cleanup-not-pass", async () => {
  const f = fixture(); await f.request("arm"); f.expire(); await assert.rejects(f.broker.close()); assert.equal(f.counts().active, 0); assert.equal(f.counts().cancels, 0);
});
await check("close-awaits-rollback-and-preserves-rollback-failure", async () => {
  const f = fixture(); await f.request("arm"); await f.broker.close(); assert.equal(f.counts().active, 0);
  const broken = fixture(); await broken.request("arm"); broken.faults.rollbackFailure = true; await assert.rejects(broken.broker.close()); assert.equal(broken.counts().active, 0);
});
await check("closed-and-expired-handle", async () => {
  const f = fixture(); await f.broker.close(); await assert.rejects(f.request("arm"));
  const ended = fixture(); ended.end(); await assert.rejects(ended.request("arm")); assert.equal(ended.statements.length, 0);
});
const db = new PGlite();
try {
  await check("PostgreSQL-signatures-exclude-neighboring-statements", async () => {
    const f = fixture(); await f.request("arm"); await f.request("cancel"); await f.request("release"); await f.broker.close();
    const d = fixture(); await d.request("arm", "finalize"); await d.request("switch", "finalize"); await d.request("cancel", "finalize"); await d.request("release", "finalize"); await d.broker.close();
    const cancelled = fixture(); await cancelled.request("arm", "cancel"); await cancelled.request("switch", "cancel"); await cancelled.request("cancel", "cancel"); await cancelled.request("release", "cancel"); await cancelled.broker.close();
    const pairs = [[cancelled.signatures[0], ' DELETE FROM storage.objects WHERE bucket_id = $1 AND "name" = ANY($2) RETURNING * '], [cancelled.signatures[0], 'DELETE FROM storage.objects WHERE bucket_id = $1 AND "name" = ANY($2) AND archived_at IS NULL RETURNING *'], [cancelled.signatures.at(-1), 'SELECT * FROM "public"."cancel_media_asset_deletion"($1,$2)'], [f.signatures[0], 'SELECT * FROM "public"."replace_media_references_for_entity"($1,$2)'], [d.signatures[0], 'delete from "objects" where "bucket_id"=$1'], [d.signatures[1], 'SELECT * FROM "public"."finalize_media_asset_deletion"($1,$2)']];
    for (const wrong of ['DELETE FROM storage.objects WHERE name = ANY($1) RETURNING *', 'DELETE FROM storage.objects WHERE bucket_id = $1 AND "name" = ANY($2) OR true RETURNING *', 'DELETE FROM storage.objects WHERE bucket_id = $1 AND "name" = ANY($2) RETURNING *; DELETE FROM storage.objects', 'select \'DELETE FROM storage.objects\'']) assert.equal((await db.query("select $1::text ~* $2::text ok", [wrong, cancelled.signatures[0]])).rows[0].ok, false);
    for (const [pattern, valid] of pairs) {
      assert.equal((await db.query("select $1::text ~* $2::text ok", [valid, pattern])).rows[0].ok, true);
      for (const wrong of ['SELECT * FROM "storage"."objects"', 'delete from "objects_backup" where id=$1', 'SELECT * FROM "public"."unrelated_rpc"($1)']) assert.equal((await db.query("select $1::text ~* $2::text ok", [wrong, pattern])).rows[0].ok, false);
    }
  });
} finally { await db.close(); }
const nativeReceipt = { id: randomUUID(), kind: "media-recovery-state", status: "pass", namespace: "owned", articleId: 91, ownedRunId: "owned-run", qaActorId: 7, observedAt: "2026-09-26T00:10:00.000Z",
  assets: [], objects: [], folders: [], references: [], leases: [], reservations: [], audits: [], binaries: [], recoveryAudits: [],
  storageSha256: "a".repeat(64), publicDataSha256: "b".repeat(64), publicTableInventorySha256: "c".repeat(64) };
const nativeFixture = { namespace: "owned", article: { id: 91 } };
await check("complete-native-receipt-required", () => assertCoreRecoveryReceipt(nativeReceipt, nativeReceipt, nativeFixture));
for (const field of ["id", "status", "namespace", "qaActorId", "objects", "recoveryAudits", "publicDataSha256", "observedAt"]) await check("receipt-rejects-" + field, () => assert.throws(() => assertCoreRecoveryReceipt({ ...nativeReceipt, [field]: null }, nativeReceipt, nativeFixture)));
const before = { qaActorId: 7, recoveryAudits: [], assets: [{ id: "owned" }], article: { title: "same" }, storageSha256: "stable", publicDataSha256: "public", publicTableInventorySha256: "inventory" };
const target = { kind: "asset", id: "owned" };
const audits = ["requested", "verified"].map((outcome, i) => ({ id: i + 1, operation: "retry_verification", target_id: target.id, target_kind: target.kind, outcome, actor_admin_user_id: 7 }));
await check("actual-browser-audit-and-domain-assertions", () => {
  const after = { ...before, recoveryAudits: audits }; assertCoreRecoveryAudit(before, after, target, "retry_verification", "verified"); assertCoreRecoveryDomainUnchanged(before, after);
  assertCoreRecoveryQueue({ available: true, truncated: false, counts: { stuckDeletes: 0, missingOrUncertainAssets: 1, unresolvedLeaseBatches: 0 }, items: [{ ...target, assetId: "owned", allowedActions: ["retry_verification"] }] }, before);
});
for (const change of [{ recoveryAudits: audits.slice(0, 1) }, { recoveryAudits: [...audits, audits[1]] }, { recoveryAudits: audits.map(row => ({ ...row, actor_admin_user_id: 8 })) }]) await check("audit-proof-negative-" + checks.length, () => assert.throws(() => assertCoreRecoveryAudit(before, { ...before, ...change }, target, "retry_verification", "verified")));
for (const key of ["assets", "article", "storageSha256"]) await check("readonly-rejects-" + key, () => assert.throws(() => assertCoreRecoveryDomainUnchanged(before, { ...before, [key]: "changed" })));
await check("cancel-rejects-extra-audit", () => assert.throws(() => assertCoreRecoveryDomainUnchanged(before, { ...before, recoveryAudits: audits }, true)));
await check("queue-truncation-remains-unproved", () => assert.throws(() => assertCoreRecoveryQueue({ available: true, truncated: true, items: [] }, before)));
await check("actual-queue-read-fault-is-exact-and-single-use", async () => {
  const fault = createCoreRecoveryQueueReadFault("http://127.0.0.1:65123"); let aborted = 0, fallback = 0;
  const route = (url, method = "GET") => ({ request: () => ({ url: () => url, method: () => method }), abort: async code => { assert.equal(code, "failed"); aborted++; }, fallback: async () => { fallback++; } });
  for (const [url, method] of [["http://127.0.0.1:65124/api/admin/media-library/recovery", "GET"], ["http://127.0.0.1:65123/api/admin/media-library/recovery?other=1", "GET"], ["http://127.0.0.1:65123/api/admin/media-library", "GET"], ["http://127.0.0.1:65123/api/admin/media-library/recovery", "POST"]]) await fault.handle(route(url, method));
  assert.equal(fallback, 4); assert.equal(aborted, 0); assert.throws(fault.assertConsumed);
  await fault.handle(route("http://127.0.0.1:65123/api/admin/media-library/recovery")); fault.assertConsumed(); assert.equal(aborted, 1);
  await assert.rejects(fault.handle(route("http://127.0.0.1:65123/api/admin/media-library/recovery"))); assert.equal(aborted, 1);
});
await check("queue-summary-cannot-contradict-current-targets", () => {
  const queue = { available: true, truncated: false, counts: { stuckDeletes: 1, missingOrUncertainAssets: 0, unresolvedLeaseBatches: 0 }, items: [] };
  assert.throws(() => assertCoreRecoveryQueue(queue, before));
});
await check("actual-native-clock-threshold-and-twelve-minute-bound", () => {
  const reservation = { started_at: "2026-09-26T00:00:00.000Z" };
  assert.equal(assertCoreRecoveryReservationAge(nativeReceipt, reservation, true), 600000);
  for (const observedAt of ["2026-09-26T00:09:59.999Z", "2026-09-26T00:12:00.001Z", "2026-09-25T23:59:59.999Z", "invalid"]) assert.throws(() => assertCoreRecoveryReservationAge({ ...nativeReceipt, observedAt }, reservation, true));
  assert.throws(() => assertCoreRecoveryReservationAge(nativeReceipt, { started_at: null }));
});
const paths = [path, "scripts/fixtures/admin-core-media-recovery-journeys.mjs", "scripts/verify-admin-core-media-recovery.mjs"];
const receipt = { status: "pass", count: checks.length, checks, sourceSha256: Object.fromEntries(paths.map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])), scope: "Actual producer control flow with scoped controlled SQL ports, PostgreSQL regex semantics, and actual Browser helper proof assertions. Native live locking, Storage deletion and Product Browser remain pending.", automaticCoverage: [], globalClosed: false };
writeFileSync(".tmp-qa/core-final-closure/media-recovery-controls.json", JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
