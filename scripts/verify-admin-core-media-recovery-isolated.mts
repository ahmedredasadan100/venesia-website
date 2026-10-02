import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { readCoreMediaCheckpoint } from "./verify-admin-core-media-isolated.mts";

type Row = Record<string, unknown>;
type Scenario = "lease" | "finalize" | "missing" | "cancel";
type Holder = { pid: number; backendStart: string; finished: boolean; released: boolean; release: () => void; settled: Promise<void>; failure?: unknown; timer?: ReturnType<typeof setTimeout> };
type Live = { token: string; scenario: Scenario; assetId: string; articleId: number; deadline: number; phase: "armed" | "switched" | "cancelled"; storage?: Holder; holder: Holder; baselineTitle: string };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const positive = (value: unknown) => { const n = Number(value); assert.ok(Number.isSafeInteger(n) && n > 0); return n; };
const relation = (schema: string, name: string) => '("' + schema + '"|' + schema + ')[[:space:]]*\\.[[:space:]]*("' + name + '"|' + name + ')';
const syncSignature = relation("public", "replace_media_references_for_entity") + "[[:space:]]*\\(";
const finalizeSignature = relation("public", "finalize_media_asset_deletion") + "[[:space:]]*\\(";
const storageSignature = 'DELETE[[:space:]]+FROM[[:space:]]+(' + relation("storage", "objects") + '|"?objects"?)[[:space:]]';
const compensationSignature = relation("public", "cancel_media_asset_deletion") + "[[:space:]]*\\(";
const exactStorageDeleteSignature = '^[[:space:]]*DELETE[[:space:]]+FROM[[:space:]]+storage\\.objects[[:space:]]+WHERE[[:space:]]+bucket_id[[:space:]]*=[[:space:]]*\\$1[[:space:]]+AND[[:space:]]+"name"[[:space:]]*=[[:space:]]*ANY[[:space:]]*\\(\\$2\\)([[:space:]]+AND[[:space:]]+archived_at[[:space:]]+IS[[:space:]]+NULL)?[[:space:]]+RETURNING[[:space:]]+\\*[[:space:]]*$';
const committedTitle = "QA Media Recovery committed title";
const completionReceipts = new WeakMap<OwnedLocalHandle, { records: Map<string, string>; cleanup: string | null }>();
const receiptHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Fixed server-registered synthetic Media fixture; no caller-selected SQL or resource identity. */
export function createOwnedCoreMediaRecoveryProof(handle: OwnedLocalHandle, selection: string | null = null) {
  assert.ok(selection === null || selection === "media-recovery-followup");
  assertOwnedLocalHandle(handle);
  assert.equal(completionReceipts.has(handle), false, "One Recovery producer per owned lifecycle.");
  const completion = { records: new Map<string, string>(), cleanup: null as string | null };
  completionReceipts.set(handle, completion);
  const bind = (record: Row) => {
    const id = String(record.id); assert.equal(completion.records.has(id), false);
    completion.records.set(id, receiptHash(record)); return record;
  };
  let live: Live | undefined, closed = false, cleanupFailure: unknown;
  let setupStarted = false, setupCompleted = false;
  const used = new Set<string>(), records: Row[] = [];
  async function state() {
    const media = await readCoreMediaCheckpoint(handle, { id: randomUUID(), kind: "media-library-state" });
    assert.ok(media.assets.length <= 4, "Recovery admits only four UI uploads, including tombstones.");
    for (const row of media.assets) assert.ok(["lease", "finalize", "missing", "cancel"].some(scenario => row.display_name === media.namespace + "-" + scenario + ".png"));
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
        const observedAt = String((await connection.query("select clock_timestamp()::text observed_at")).rows[0]?.observed_at);
        assert.ok(Number.isFinite(Date.parse(observedAt)));
        await connection.query("commit"); committed = true;
        return { leases, reservations, recoveryAudits: audits, observedAt };
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
  async function blocked(holder: Holder, role: "authenticator" | "supabase_storage_admin", signature: string, cancel: boolean, deadline: number, expected?: Row) {
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
        if (expected) for (const key of ["backendPid", "backendStartedAt", "queryStartedAt", "queryFingerprint", "backendRole", "holderPid", "holderBackendStart"]) assert.equal(bound[key as keyof typeof bound], expected[key], "The originally observed statement lifetime changed.");
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
    const storagePattern = current.scenario === "cancel" ? exactStorageDeleteSignature : storageSignature;
    const storageWait = await blocked(current.holder, "supabase_storage_admin", storagePattern, false, Math.min(current.deadline - 10_000, Date.now() + 20_000));
    const reservations = (await handle.query("select id,status from public.media_delete_reservations where asset_id=$1::uuid and status='reserved'", [current.assetId])).rows;
    assert.equal(reservations.length, 1, "The real safe-delete reservation must already be committed.");
    const assetHolder = await hold("select id from public.media_assets where id=$1::uuid and status='deleting' for update", [current.assetId]);
    current.storage = current.holder; current.holder = assetHolder;
    const storageCancelled = current.scenario === "cancel"
      ? await blocked(current.storage, "supabase_storage_admin", exactStorageDeleteSignature, true, Math.min(current.deadline - 10_000, Date.now() + 15_000), storageWait)
      : null;
    await release(current.storage); current.storage = undefined; current.phase = "switched";
    return { status: "pass", phase: current.phase, assetId: current.assetId, reservationId: reservations[0].id, storageWait, storageCancelled, storageLockRolledBack: true };
  }
  async function cancel(request: Row) {
    const current = currentFor(request);
    assert.equal(current.phase, current.scenario === "lease" ? "armed" : "switched");
    const signature = current.scenario === "lease" ? syncSignature : current.scenario === "cancel" ? compensationSignature : finalizeSignature;
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
  async function prepareFollowup(): Promise<Row> {
    assert.equal(selection, "media-recovery-followup");
    assert.equal(setupStarted, false, "The uncredited prerequisite is one-shot, including failures.");
    assert.equal(live, undefined); assert.equal(used.size, 0); setupStarted = true;
    const before = await state();
    assert.equal(before.assets.length, 4); assert.equal(before.references.length, 0);
    assert.equal(before.leases.length, 0); assert.equal(before.reservations.length, 0);
    const { createJiti } = await import("jiti");
    const { resolve } = await import("node:path");
    const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: { "server-only": resolve("node_modules/next/dist/compiled/server-only/empty.js") } });
    const storage = await jiti.import<typeof import("../src/lib/admin/media-storage-adapter.ts")>("../src/lib/admin/media-storage-adapter.ts");
    const providers = await jiti.import<typeof import("../src/lib/admin/media-catalog/reference-providers.ts")>("../src/lib/admin/media-catalog/reference-providers.ts");
    const routes = await jiti.import<typeof import("../src/lib/content/public-content-path.ts")>("../src/lib/content/public-content-path.ts");
    const { loadEntitySeoPersistenceOwner } = await import("./backfill-entity-seo-scores.mts");
    const { coreMediaSyntheticPng } = await import("./fixtures/admin-core-media-journeys.mjs");
    const seo = loadEntitySeoPersistenceOwner(), expectedChecksum = createHash("sha256").update(coreMediaSyntheticPng()).digest("hex");
    const response = await handle.readDataApi("/rest/v1/media_assets?select=id&limit=1");
    let origin: string;
    try {
      assert.equal(response.ok, true); const url = new URL(response.url);
      assert.equal(url.protocol, "http:"); assert.equal(url.hostname, "127.0.0.1"); assert.ok(url.port);
      assert.equal(url.pathname, "/rest/v1/media_assets"); assert.equal(url.username + url.password, ""); origin = url.origin;
    } finally { await response.body?.cancel(); }
    const context = storage.resolveMediaStorageRuntimeContext({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: origin });
    const registryVersion = providers.MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION, runtime = before.runtime as Row;
    assert.ok(context.identity); assert.equal(runtime.state, "synced"); assert.deepEqual(runtime.warnings, []);
    for (const [key, value] of Object.entries({ provider: context.provider, environment: context.environment, environmentKey: context.identity, providerRegistryVersion: registryVersion })) assert.equal(runtime[key], value);
    assert.ok(runtime.lastSuccessfulReconciliationRunIdentity); assert.ok(Number.isFinite(Date.parse(String(runtime.lastSuccessfulReconciliationAt))));
    for (const key of ["storageAssetCount", "catalogAssetCount"]) assert.ok(Number.isSafeInteger(runtime[key]) && Number(runtime[key]) >= 0);
    assert.equal(runtime.storageAssetCount, runtime.catalogAssetCount);
    const roles = ["lease", "finalize", "missing", "cancel"];
    for (const role of roles) {
      const rows = before.assets.filter(row => row.display_name === before.namespace + "-" + role + ".png"); assert.equal(rows.length, 1);
      const asset = rows[0]; assert.equal(asset.status, "active"); assert.equal(asset.missing_object, false);
      assert.equal(asset.bucket, "cms-images"); assert.equal(asset.provider, context.provider); assert.equal(Number(asset.uploaded_by), before.qaActorId);
      assert.equal(asset.folder_path, "images/" + before.namespace); assert.equal(asset.checksum, expectedChecksum);
      assert.equal(before.objects.filter(row => row.bucket_id === asset.bucket && row.name === asset.object_key).length, 1);
      const binaries = before.binaries.filter(row => row.publicUrl === asset.public_url); assert.equal(binaries.length, 1);
      assert.equal(binaries[0].status, 200); assert.equal(binaries[0].sha256, expectedChecksum);
    }
    const asset = before.assets.find(row => row.display_name === before.namespace + "-lease.png")!;
    const originals = (await handle.query("select * from public.topics where id=$1 and slug='qa-core-media-article' and content_type='article' and status='unpublished' and deleted_at is null", [before.articleId])).rows;
    assert.equal(originals.length, 1); const original = originals[0]; assert.equal(original.image, "");
    assert.deepEqual(providers.extractMediaCandidateValues([original.image, original.excerpt, original.content, original.media_payload, original.og_image]), [], "Never drop any preexisting media candidate from the fixture.");
    assert.equal((await handle.query("select id from public.media_references where domain_key='topics' and entity_type='topic' and entity_identity=$1", [String(before.articleId)])).rows.length, 0);
    const finalRow = { ...original, title: committedTitle, image: asset.public_url } as Row & import("../src/lib/admin/seo/entity-seo-persistence.ts").TopicSeoSource;
    const tuple = seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(finalRow)); Object.assign(finalRow, tuple);
    const targets = [{ provider: asset.provider, bucket: asset.bucket, objectKey: asset.object_key, domainKey: "topics", entityType: "topic", entityIdentity: String(before.articleId) }];
    const requestIdentity = "qa-recovery-prerequisite:" + handle.identity.runId; assert.ok(requestIdentity.length <= 160);
    const leases = (await handle.query("select * from public.acquire_media_reference_write_lease($1::jsonb,$2::bigint,$3::text,180,$4::text,$5::text,$6::text,$7::text)", [JSON.stringify(targets), before.qaActorId, requestIdentity, context.provider, context.environment, context.identity, registryVersion])).rows;
    assert.equal(leases.length, 1); const acquired = leases[0]; assert.match(String(acquired.lease_token), UUID); assert.equal(Number(acquired.leased_asset_count), 1);
    for (const key of ["lease_started_at", "lease_expires_at"]) assert.ok(Number.isFinite(new Date(String(acquired[key])).valueOf()));
    const reference = { assetId: asset.id, entityType: "topic", entityIdentity: String(before.articleId), entityLabel: finalRow.title, fieldKey: "image", editHref: "/admin/content/topics/" + before.articleId, publicHref: routes.resolvePublicContentPath("article", String(finalRow.slug)), referenceState: "draft", restorable: false, metadata: {} };
    await handle.withDatabaseConnection(async connection => {
      await connection.query("begin"); let committed = false;
      try {
        await connection.query("set local statement_timeout='15000ms'");
        const locked = (await connection.query("select * from public.topics where id=$1 for update", [before.articleId])).rows;
        assert.deepEqual(locked, [original]);
        const updated = (await connection.query("update public.topics set title=$2,image=$3,seo_score=$4,seo_score_version=$5,seo_score_input_hash=$6 where id=$1 returning *", [before.articleId, finalRow.title, finalRow.image, tuple.seo_score, tuple.seo_score_version, tuple.seo_score_input_hash])).rows;
        assert.deepEqual(updated, [finalRow]);
        const replaced = (await connection.query("select public.replace_media_references_for_entity('topics','topic',$1::text,$2::jsonb,$3::uuid,$1::text) inserted", [String(before.articleId), JSON.stringify([reference]), acquired.lease_token])).rows;
        assert.equal(replaced.length, 1); assert.equal(replaced[0].inserted, 1);
        await connection.query("commit"); committed = true;
      } finally { if (!committed) await connection.query("rollback"); }
    });
    const committedArticle = (await handle.query("select * from public.topics where id=$1", [before.articleId])).rows; assert.deepEqual(committedArticle, [finalRow]);
    const actualReferences = (await handle.query("select asset_id,domain_key,entity_type,entity_identity,entity_label,field_key,edit_href,public_href,reference_state,restorable,metadata from public.media_references where domain_key='topics' and entity_type='topic' and entity_identity=$1", [String(before.articleId)])).rows;
    assert.deepEqual(actualReferences, [{ asset_id: asset.id, domain_key: "topics", entity_type: "topic", entity_identity: String(before.articleId), entity_label: finalRow.title, field_key: "image", edit_href: reference.editHref, public_href: reference.publicHref, reference_state: "draft", restorable: false, metadata: {} }]);
    const failure = (await handle.query("select public.fail_media_reference_write_lease($1::uuid,$2::text,'qa_owned_followup_prerequisite',$3::jsonb,true) affected", [acquired.lease_token, String(before.articleId), JSON.stringify({ purpose: "uncredited owned fixture prerequisite", ownedRunId: handle.identity.runId })])).rows;
    assert.equal(failure.length, 1); assert.equal(failure[0].affected, 1);
    const after = await state(); assert.equal(after.leases.length, 1); const failed = after.leases[0];
    assert.equal(failed.lease_token, acquired.lease_token); assert.equal(failed.asset_id, asset.id); assert.equal(failed.status, "failed"); assert.equal(failed.resolved_at, null); assert.equal(failed.domain_write_committed, true); assert.ok(Number.isFinite(Date.parse(String(failed.completed_at))));
    const actorRows = (await handle.query("select actor_id from public.media_reference_write_leases where lease_token=$1::uuid", [acquired.lease_token])).rows; assert.equal(actorRows.length, 1); assert.equal(Number(actorRows[0].actor_id), before.qaActorId);
    assert.equal(after.reservations.length, 0); assert.deepEqual(after.assets, before.assets); assert.deepEqual(after.objects, before.objects); assert.deepEqual(after.audits, before.audits); assert.deepEqual(after.binaries, before.binaries); assert.equal(after.references.length, 1);
    return { ownedRunId: handle.identity.runId, namespace: before.namespace, articleId: before.articleId, qaActorId: before.qaActorId, purpose: "uncredited-owned-fixture-prerequisite", selection, uiCredit: false, context, registryVersion, assets: before.assets, binaries: after.binaries, acquired, reference: actualReferences[0], article: finalRow, seoSourceFingerprint: seo.sourceFingerprint, failedLease: failed, observedAt: after.observedAt, automaticCoverage: [], globalClosed: false };
  }

  async function handleRequest(input: unknown): Promise<Row> {
    assertOwnedLocalHandle(handle); assert.equal(closed, false); assert.ok(input && typeof input === "object" && !Array.isArray(input));
    const request = input as Row; assert.match(String(request.id), UUID);
    if (request.kind === "media-recovery-followup-prepare") {
      assert.deepEqual(Object.keys(request).sort(), ["id", "kind"]);
      const result = bind({ ...(await prepareFollowup()), id: request.id, kind: request.kind, status: "pass" }); setupCompleted = true; return result;
    }
    if (selection === "media-recovery-followup") assert.equal(setupCompleted, true, "Actual fixed prerequisite must complete before follow-up state or fault commands.");
    if (request.kind === "media-recovery-state") {
      assert.deepEqual(Object.keys(request).sort(), ["id", "kind"]); assert.equal(live, undefined, "No snapshot while a deliberately blocked writer is active.");
      return bind({ ...(await state()), id: request.id, kind: request.kind, status: "pass" });
    }
    assert.deepEqual(Object.keys(request).sort(), ["id", "kind", "scenario", "token"]);
    assert.match(String(request.token), UUID); assert.ok(["lease", "finalize", "missing", "cancel"].includes(String(request.scenario)));
    if (selection === "media-recovery-followup") assert.notEqual(request.scenario, "lease", "Retained lease-failure UI is not replayed.");
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
    const record = { id: request.id, kind: request.kind, scenario: request.scenario, token: request.token, ...outcome }; records.push(record); return bind(record);
  }
  async function close() {
    assertOwnedLocalHandle(handle); assert.equal(closed, false); closed = true;
    if (live) { const current = live; try { await clear(current); } finally { live = undefined; } }
    if (cleanupFailure) throw cleanupFailure;
    const result = { status: "closed", activeLocks: 0, records, automaticCoverage: [] };
    completion.cleanup = receiptHash(result); return result;
  }
  return { handleRequest, close };
}

/** Closed producer receipts, including fault identities, must join the same owned lifecycle exactly. */
export function assertOwnedCoreMediaRecoveryCompletion(handle: OwnedLocalHandle, records: Row[], cleanup: Row) {
  assertOwnedLocalHandle(handle);
  const expected = completionReceipts.get(handle); assert.ok(expected?.cleanup, "Recovery must finish owned cleanup first.");
  assert.equal(receiptHash(cleanup), expected.cleanup, "Cleanup must match the actual closed producer.");
  assert.equal(records.length, expected.records.size);
  const seen = new Set<string>();
  for (const row of records) {
    const id = String(row.id); assert.match(id, UUID); assert.equal(seen.has(id), false); seen.add(id);
    assert.equal(row.status, "pass");
    assert.equal(receiptHash(row), expected.records.get(id), "Recovery checkpoint must match its private native receipt.");
  }
  return { checkpoints: seen.size, automaticCoverage: [], globalClosed: false };
}
