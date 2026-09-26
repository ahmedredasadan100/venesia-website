import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { readCoreMediaCheckpoint } from "./verify-admin-core-media-isolated.mts";

type Row = Record<string, unknown>;
type Scenario = "lease" | "finalize" | "missing";
type Holder = { pid: number; backendStart: string; finished: boolean; released: boolean; release: () => void; settled: Promise<void>; failure?: unknown; timer?: ReturnType<typeof setTimeout> };
type Live = { token: string; scenario: Scenario; assetId: string; articleId: number; deadline: number; phase: "armed" | "switched" | "cancelled"; storage?: Holder; holder: Holder; baselineTitle: string };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const positive = (value: unknown) => { const n = Number(value); assert.ok(Number.isSafeInteger(n) && n > 0); return n; };
const relation = (schema: string, name: string) => '("' + schema + '"|' + schema + ')[[:space:]]*\\.[[:space:]]*("' + name + '"|' + name + ')';
const syncSignature = relation("public", "replace_media_references_for_entity") + "[[:space:]]*\\(";
const finalizeSignature = relation("public", "finalize_media_asset_deletion") + "[[:space:]]*\\(";
const storageSignature = 'DELETE[[:space:]]+FROM[[:space:]]+(' + relation("storage", "objects") + '|"?objects"?)[[:space:]]';
const committedTitle = "QA Media Recovery committed title";

/** Fixed server-registered synthetic Media fixture; no caller-selected SQL or resource identity. */
export function createOwnedCoreMediaRecoveryProof(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  let live: Live | undefined, closed = false, cleanupFailure: unknown;
  const used = new Set<string>(), records: Row[] = [];
  async function state() {
    const media = await readCoreMediaCheckpoint(handle, { id: randomUUID(), kind: "media-library-state" });
    assert.ok(media.assets.length <= 3, "Recovery admits only three UI uploads, including tombstones.");
    for (const row of media.assets) assert.ok(["lease", "finalize", "missing"].some(scenario => row.display_name === media.namespace + "-" + scenario + ".png"));
    const ids = media.assets.map(row => row.id);
    const addition = await handle.withDatabaseConnection(async connection => {
      await connection.query("begin isolation level repeatable read read only");
      let committed = false;
      try {
        await connection.query("set local statement_timeout='15000ms'");
        const leases = (await connection.query("select id,lease_token,asset_id,domain_key,entity_type,entity_identity,status,resolved_at::text,completed_at::text,expires_at::text,updated_at::text,failure_code,failure_metadata->'domainWriteCommitted' domain_write_committed from public.media_reference_write_leases where asset_id=any($1::uuid[]) order by id limit 17", [ids])).rows;
        const reservations = (await connection.query("select id,asset_id,status,started_at::text,updated_at::text,finished_at::text,failure_code from public.media_delete_reservations where asset_id=any($1::uuid[]) order by id limit 9", [ids])).rows;
        assert.ok(leases.length <= 16 && reservations.length <= 8);
        const targets = [...ids, ...leases.map(row => row.lease_token), ...reservations.map(row => row.id)];
        const audits = (await connection.query("select id,action,entity_type,actor_admin_user_id,metadata->>'operation' operation,metadata->>'targetKind' target_kind,metadata->>'targetId' target_id,metadata->>'outcome' outcome,metadata->>'failureCode' failure_code from public.admin_audit_logs where entity_type='media_asset' and metadata->>'targetId'=any($1::text[]) order by id limit 65", [targets])).rows;
        assert.ok(audits.length <= 64);
        for (const row of audits) assert.equal(Number(row.actor_admin_user_id), media.qaActorId);
        await connection.query("commit"); committed = true;
        return { leases, reservations, recoveryAudits: audits };
      } finally { if (!committed) await connection.query("rollback"); }
    });
    return { ...media, ...addition, automaticCoverage: [], globalClosed: false };
  }
  async function hold(sql: string, params: unknown[]): Promise<Holder> {
    let release!: () => void, resolve!: () => void, reject!: (error: unknown) => void;
    const released = new Promise<void>(done => { release = done; });
    const ready = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    const holder: Holder = { pid: 0, backendStart: "", finished: false, released: false,
      release: () => { holder.released = true; release(); }, settled: Promise.resolve() };
    holder.settled = handle.withDatabaseConnection(async connection => {
      let began = false;
      try {
        await connection.query("begin"); began = true;
        await connection.query("set local statement_timeout='5000ms'");
        await connection.query("set local idle_in_transaction_session_timeout='90000ms'");
        const identity = (await connection.query("select pg_backend_pid() pid,current_database() database,current_user role,backend_start::text from pg_stat_activity where pid=pg_backend_pid()")).rows[0];
        assert.equal(identity.database, "postgres"); assert.equal(identity.role, "postgres");
        holder.pid = positive(identity.pid); holder.backendStart = String(identity.backend_start);
        assert.ok(Number.isFinite(Date.parse(holder.backendStart)));
        assert.equal((await connection.query(sql, params)).rows.length, 1, "Exactly one fixed owned row is locked.");
        holder.timer = setTimeout(() => {
          holder.failure ??= new Error("Owned Recovery holder expired.");
          cleanupFailure ??= holder.failure; holder.release();
        }, 60_000);
        resolve(); await released;
      } catch (error) { holder.failure ??= error; reject(error); }
      finally {
        if (began) try { await connection.query("rollback"); } catch (error) { holder.failure ??= error; cleanupFailure ??= error; }
      }
    }).catch(error => { holder.failure ??= error; reject(error); }).then(() => {
      holder.finished = true;
      if (!holder.released) { clearTimeout(holder.timer); holder.failure ??= new Error("Recovery holder ended before explicit release."); cleanupFailure ??= holder.failure; reject(holder.failure); }
    });
    try { await ready; return holder; } catch (error) { clearTimeout(holder.timer); holder.release(); await holder.settled; throw error; }
  }
  async function release(holder?: Holder) {
    if (!holder) return;
    clearTimeout(holder.timer); holder.release(); await holder.settled;
    if (holder.failure) throw holder.failure;
  }
  async function clear(current: Live) {
    const outcomes = await Promise.allSettled([release(current.storage), release(current.holder)]);
    for (const outcome of outcomes) if (outcome.status === "rejected") cleanupFailure ??= outcome.reason;
    if (cleanupFailure) throw cleanupFailure;
  }
  function currentFor(request: Row) {
    assert.ok(live && live.token === request.token && live.scenario === request.scenario);
    assert.ok(Date.now() < live.deadline && !live.holder.finished && !live.holder.failure);
    return live;
  }
  async function blocked(holder: Holder, role: "authenticator" | "supabase_storage_admin", signature: string, cancel: boolean, deadline: number) {
    assert.ok(!holder.finished && !holder.released && !holder.failure);
    return handle.withDatabaseConnection(async connection => {
      while (true) {
        assert.ok(Date.now() < deadline && !holder.finished && !holder.released && !holder.failure, "No live bounded statement reached the exact owned lock.");
        await connection.query("select pg_stat_clear_snapshot()");
        const rows = (await connection.query(
          "select pid,backend_start::text,query_start::text,usename,datname,state,backend_type,wait_event_type,"
          + "pg_blocking_pids(pid) blockers,md5(query) query_fingerprint,(query ~* $2::text) signature_matches "
          + "from pg_stat_activity where $1::integer=any(pg_blocking_pids(pid)) and pid<>pg_backend_pid() order by pid", [holder.pid, signature])).rows;
        assert.ok(rows.length <= 1, "Never attribute multiple blocked statements to one intent.");
        if (rows.length === 0) { await wait(100); continue; }
        const row = rows[0], pid = positive(row.pid);
        assert.equal(row.usename, role); assert.equal(row.datname, "postgres"); assert.equal(row.state, "active");
        assert.equal(row.backend_type, "client backend"); assert.equal(row.wait_event_type, "Lock");
        assert.equal(row.signature_matches, true); assert.deepEqual(row.blockers, [holder.pid]);
        assert.ok(Number.isFinite(Date.parse(String(row.backend_start))) && Number.isFinite(Date.parse(String(row.query_start))));
        assert.match(String(row.query_fingerprint), /^[a-f0-9]{32}$/u);
        const bound = { backendPid: pid, backendStartedAt: row.backend_start, queryStartedAt: row.query_start, queryFingerprint: row.query_fingerprint,
          backendRole: role, exactBlockers: row.blockers, fixedSignatureMatched: true, holderPid: holder.pid, holderBackendStart: holder.backendStart };
        if (!cancel) return { ...bound, cancellationAcknowledged: false };
        assert.ok(!holder.finished && !holder.released && !holder.failure && Date.now() < deadline);
        await connection.query("select pg_stat_clear_snapshot()");
        const result = (await connection.query(
          "select pg_cancel_backend(a.pid) cancelled from pg_stat_activity a "
          + "where a.pid=$1::integer and a.backend_start=$2::timestamptz and a.query_start=$3::timestamptz and md5(a.query)=$4 "
          + "and a.usename=$8 and a.datname=current_database() and a.state='active' and a.backend_type='client backend' and a.wait_event_type='Lock' "
          + "and pg_blocking_pids(a.pid)=array[$5::integer] and a.query ~* $6::text "
          + "and exists(select 1 from pg_stat_activity h where h.pid=$5::integer and h.backend_start=$7::timestamptz "
          + "and h.usename='postgres' and h.datname=current_database() and h.backend_type='client backend' and h.state='idle in transaction') "
          + "and (select count(*) from pg_stat_activity b where $5::integer=any(pg_blocking_pids(b.pid)))=1",
        [pid, row.backend_start, row.query_start, row.query_fingerprint, holder.pid, signature, holder.backendStart, role])).rows;
        assert.equal(result.length, 1); assert.equal(result[0].cancelled, true);
        return { ...bound, cancellationAcknowledged: true,
          boundary: "Live blocked statement and holder were rechecked immediately before PID cancellation; final Browser/native outcome is independently required." };
      }
    });
  }
  async function arm(request: Row) {
    assert.equal(live, undefined); assert.ok(!used.has(String(request.token))); used.add(String(request.token));
    const snapshot = await state(), scenario = request.scenario as Scenario;
    const assets = snapshot.assets.filter(row => row.display_name === snapshot.namespace + "-" + scenario + ".png");
    assert.equal(assets.length, 1); const asset = assets[0]; assert.equal(asset.status, "active");
    assert.equal(snapshot.objects.filter(row => row.bucket_id === asset.bucket && row.name === asset.object_key).length, 1);
    let holder: Holder;
    if (scenario === "lease") {
      assert.equal(snapshot.article.image, asset.public_url);
      const refs = snapshot.references.filter(row => row.asset_id === asset.id && row.domain_key === "topics" && String(row.entity_identity) === String(snapshot.articleId) && row.field_key === "image");
      assert.equal(refs.length, 1);
      holder = await hold("select id from public.media_references where id=$1 and asset_id=$2::uuid and domain_key='topics' and entity_identity=$3 and field_key='image' for update", [refs[0].id, asset.id, String(snapshot.articleId)]);
    } else {
      assert.equal(snapshot.references.some(row => row.asset_id === asset.id), false);
      assert.equal(snapshot.reservations.some(row => row.asset_id === asset.id && ["reserved", "recovery_required"].includes(String(row.status))), false);
      holder = await hold("select id from storage.objects where bucket_id=$1 and name=$2 for update", [asset.bucket, asset.object_key]);
    }
    live = { token: String(request.token), scenario, assetId: String(asset.id), articleId: snapshot.articleId,
      deadline: Date.now() + 55_000, phase: "armed", holder, baselineTitle: String(snapshot.article.title) };
    return { status: "pass", phase: live.phase, assetId: live.assetId, articleId: live.articleId, holderPid: holder.pid, holderBackendStart: holder.backendStart };
  }
  async function switchDelete(request: Row) {
    const current = currentFor(request); assert.ok(current.scenario !== "lease"); assert.equal(current.phase, "armed");
    const storageWait = await blocked(current.holder, "supabase_storage_admin", storageSignature, false, Math.min(current.deadline - 10_000, Date.now() + 20_000));
    const reservations = (await handle.query("select id,status from public.media_delete_reservations where asset_id=$1::uuid and status='reserved'", [current.assetId])).rows;
    assert.equal(reservations.length, 1, "The real safe-delete reservation must already be committed.");
    const assetHolder = await hold("select id from public.media_assets where id=$1::uuid and status='deleting' for update", [current.assetId]);
    current.storage = current.holder; current.holder = assetHolder;
    await release(current.storage); current.storage = undefined; current.phase = "switched";
    return { status: "pass", phase: current.phase, assetId: current.assetId, reservationId: reservations[0].id, storageWait, storageLockRolledBack: true };
  }
  async function cancel(request: Row) {
    const current = currentFor(request);
    assert.equal(current.phase, current.scenario === "lease" ? "armed" : "switched");
    const signature = current.scenario === "lease" ? syncSignature : finalizeSignature;
    const proof = await blocked(current.holder, "authenticator", signature, true, Math.min(current.deadline - 5_000, Date.now() + 20_000));
    if (current.scenario === "lease") {
      const rows = (await handle.query("select title,image from public.topics where id=$1 and slug='qa-core-media-article'", [current.articleId])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].title, committedTitle); assert.notEqual(rows[0].title, current.baselineTitle);
      const assets = (await handle.query("select public_url from public.media_assets where id=$1::uuid", [current.assetId])).rows;
      assert.equal(assets.length, 1); assert.equal(rows[0].image, assets[0].public_url);
    }
    current.phase = "cancelled";
    return { status: "pass", phase: current.phase, assetId: current.assetId, ...proof, domainCommitVerified: current.scenario === "lease" };
  }
  async function handleRequest(input: unknown): Promise<Row> {
    assertOwnedLocalHandle(handle); assert.equal(closed, false); assert.ok(input && typeof input === "object" && !Array.isArray(input));
    const request = input as Row; assert.match(String(request.id), UUID);
    if (request.kind === "media-recovery-state") {
      assert.deepEqual(Object.keys(request).sort(), ["id", "kind"]); assert.equal(live, undefined, "No snapshot while a deliberately blocked writer is active.");
      return { ...(await state()), id: request.id, kind: request.kind, status: "pass" };
    }
    assert.deepEqual(Object.keys(request).sort(), ["id", "kind", "scenario", "token"]);
    assert.match(String(request.token), UUID); assert.ok(["lease", "finalize", "missing"].includes(String(request.scenario)));
    assert.ok(["media-recovery-fault-arm", "media-recovery-fault-switch", "media-recovery-fault-cancel", "media-recovery-fault-release"].includes(String(request.kind)));
    let outcome: Row;
    try {
      if (request.kind === "media-recovery-fault-arm") outcome = await arm(request);
      else if (request.kind === "media-recovery-fault-switch") outcome = await switchDelete(request);
      else if (request.kind === "media-recovery-fault-cancel") outcome = await cancel(request);
      else {
        const current = currentFor(request), cancellationAcknowledged = current.phase === "cancelled";
        await clear(current); live = undefined; outcome = { status: "pass", phase: "released", cancellationAcknowledged, activeLocks: 0, ownedTransactionsRolledBack: true };
      }
    } catch (error) {
      if (live) { const current = live; try { await clear(current); } finally { live = undefined; } }
      throw error;
    }
    const record = { id: request.id, kind: request.kind, scenario: request.scenario, token: request.token, ...outcome }; records.push(record); return record;
  }
  async function close() {
    assertOwnedLocalHandle(handle); assert.equal(closed, false); closed = true;
    if (live) { const current = live; try { await clear(current); } finally { live = undefined; } }
    if (cleanupFailure) throw cleanupFailure;
    return { status: "closed", activeLocks: 0, records, automaticCoverage: [] };
  }
  return { handleRequest, close };
}
