import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import { assertOwnedLocalHandle, type OwnedLocalHandle, type OwnedDatabaseConnection } from "./lib/isolated-supabase.mts";
import type { ApplicationClosureCheckpoint } from "./lib/isolated-public-application.mts";
import type { TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";

type Sql = Pick<OwnedDatabaseConnection, "query">;
type Kind = "batch" | "publish";
type RpcResult = { ok: boolean; code?: string; commandId?: string };
type Outcome = { ok: true; result: RpcResult } | { ok: false; code: string };
type TopicState = { id: string; status: string; is_featured: boolean; revision: string; seo_score: number; seo_score_version: string; seo_score_input_hash: string };

async function settle(operation: Promise<RpcResult>): Promise<Outcome> {
  try { return { ok: true, result: await operation }; }
  catch (error) { return { ok: false, code: String((error as { code?: unknown }).code ?? "unknown") }; }
}
async function topicStates(db: Sql, ids: number[]): Promise<TopicState[]> {
  return (await db.query("select id::text,status,is_featured,updated_at::text revision,seo_score,seo_score_version,seo_score_input_hash from public.topics where id=any($1::bigint[]) order by id", [ids])).rows as TopicState[];
}
async function createTopics(handle: OwnedLocalHandle, count: number) {
  const seo = loadEntitySeoPersistenceOwner(), ids: number[] = [];
  const identity = randomUUID();
  try {
    for (let index = 0; index < count; index++) {
      const row = { slug: "core-command-" + identity + "-" + index, title: "اختبار اتساق أمر المحتوى ونشره",
        excerpt: "بيانات اصطناعية لإثبات اتساق أوامر المحتوى بعد الترحيل.",
        content: "محتوى اصطناعي لاختبار ترتيب المعاملات وسلامة النشر. ".repeat(60),
        image: "/images/venesia-5.png", image_alt: "صورة الاختبار", content_type: "article",
        category: "اختبار", category_slug: "core-closure", status: "unpublished",
        focus_keyword: "اختبار", seo_title: "اختبار اتساق أمر المحتوى ونشره",
        seo_description: "بيانات اصطناعية لإثبات اتساق أوامر المحتوى بعد الترحيل.", faq: [], seo_keywords: ["اختبار"] };
      const payload = { ...row, ...seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)) };
      const keys = Object.keys(payload);
      const values = Object.values(payload).map((value, position) => keys[position] === "faq" ? JSON.stringify(value) : value);
      const created = await handle.query(
        "insert into public.topics(" + keys.map(key => '"' + key + '"').join(",") + ") values(" + keys.map((_, i) => "$" + (i + 1)).join(",") + ") returning id", values);
      ids.push(Number(created.rows[0].id));
    }
    return ids;
  } catch (error) {
    if (ids.length) await handle.query("delete from public.topics where id=any($1::bigint[])", [ids]);
    throw error;
  }
}
function argsFor(kind: Kind, actor: number, ids: number[], initial: TopicState[], command?: string) {
  const args: Record<string, unknown> = kind === "batch"
    ? { p_actor_id: actor, p_action: "feature", p_topic_ids: ids }
    : { p_actor_id: actor, p_topics: ids.map(id => ({ id, expected_updated_at: initial.find(row => Number(row.id) === id)!.revision })) };
  if (command) args.p_command_id = command;
  return args;
}
function rpcName(kind: Kind) {
  return kind === "batch" ? "admin_mutate_topics_batch_atomically" : "admin_publish_topics_atomically";
}
async function nativeCall(db: Sql, kind: Kind, actor: number, ids: number[], initial: TopicState[], command: string): Promise<RpcResult> {
  const result = kind === "batch"
    ? await db.query("select public.admin_mutate_topics_batch_atomically($1,'feature',$2::bigint[],null,null,$3::uuid) result", [actor, ids, command])
    : await db.query("select public.admin_publish_topics_atomically($1,$2::jsonb,$3::uuid) result", [actor, JSON.stringify(argsFor(kind, actor, ids, initial).p_topics), command]);
  return result.rows[0].result as RpcResult;
}
async function receipts(handle: OwnedLocalHandle, commandIds: string[]) {
  return (await handle.query("select actor_admin_user_id::text actor,metadata->'command'->>'id' command,metadata->'command'->'intent'->>'action' action from public.admin_audit_logs where metadata->'command'->>'id'=any($1::text[]) order by actor_admin_user_id,metadata->'command'->>'id'", [commandIds])).rows;
}

/** Observe the real schema at each canonical migration boundary; never swap SQL,
 * rewrite registry rows, grant privileges, or claim full client/cookie skew. */
export async function verifyTopicReleaseSkewCheckpoint(handle: OwnedLocalHandle, checkpoint: ApplicationClosureCheckpoint) {
  assertOwnedLocalHandle(handle);
  const expectedCount = { "20260925200723": 112, "20260926013156": 113, "20260926013216": 114 }[checkpoint.version];
  assert.equal(checkpoint.registered, expectedCount);
  const registry = (await handle.query("select count(*)::int count,max(version) head from supabase_migrations.schema_migrations")).rows[0];
  assert.deepEqual(registry, { count: expectedCount, head: checkpoint.version });
  const current = expectedCount === 114;
  const functions = (await handle.query("select p.proname,p.pronargs,p.pronargdefaults,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service_role from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('admin_mutate_topics_batch_atomically','admin_publish_topics_atomically') order by p.proname")).rows;
  assert.equal(functions.length, 2, "Each RPC must have one unambiguous deployed signature.");
  assert.ok(functions.every(row => !row.anon && !row.authenticated && row.service_role));
  assert.deepEqual(functions.map(row => Number(row.pronargs)), current ? [6, 3] : [5, 2]);
  const constraints = (await handle.query("select conname,convalidated,confdeltype from pg_constraint where conrelid='public.menu_items'::regclass and conname like 'menu_items_linked_%_fkey' order by conname")).rows;
  assert.equal(constraints.length, expectedCount === 112 ? 0 : 5);
  assert.ok(constraints.every(row => row.convalidated && row.confdeltype === "r"));
  const actor = Number((await handle.query("select id from public.admin_users where is_active order by id limit 1")).rows[0]?.id);
  assert.ok(Number.isSafeInteger(actor) && actor > 0, "Release checkpoint needs the existing active baseline actor.");
  // Only the invalid-actor preflight is repeated while PostgREST reloads its
  // schema cache. It cannot write a Topic or an audit receipt.
  let lookupAttempts = 0;
  for (const kind of ["batch", "publish"] as const) {
    const deadline = Date.now() + 10_000;
    while (true) {
      lookupAttempts++;
      const preflight = kind === "batch"
        ? { p_actor_id: -1, p_action: "feature", p_topic_ids: [1] }
        : { p_actor_id: -1, p_topics: [{ id: 1, expected_updated_at: "2026-01-01T00:00:00Z" }] };
      const response = await handle.callDataApiRpc(rpcName(kind), { ...preflight, ...(current ? { p_command_id: randomUUID() } : {}) });
      const body = await response.json() as RpcResult & { code?: string };
      if (response.ok) { assert.equal(body.ok, false); assert.equal(body.code, "unauthorized_actor"); break; }
      assert.equal(response.status, 404);
      assert.equal(body.code, "PGRST202");
      assert.ok(Date.now() < deadline, "PostgREST did not expose the canonical migration signature.");
      await new Promise(done => setTimeout(done, 100));
    }
  }
  const ids = await createTopics(handle, 4), records: Record<string, unknown>[] = [];
  try {
    for (const [index, kind] of (["batch", "publish"] as const).entries()) {
      const legacyIds = [ids[index]], legacyBefore = await topicStates(handle, legacyIds);
      const legacyResponse = await handle.callDataApiRpc(rpcName(kind), argsFor(kind, actor, legacyIds, legacyBefore));
      assert.equal(legacyResponse.ok, true);
      const legacy = await legacyResponse.json() as RpcResult;
      assert.equal(legacy.ok, true, "Legacy caller must remain compatible at each actual schema boundary.");
      const legacyAfter = await topicStates(handle, legacyIds);
      assert.equal(kind === "batch" ? legacyAfter[0].is_featured : legacyAfter[0].status === "published", true);

      const newIds = [ids[index + 2]], before = await topicStates(handle, newIds), command = randomUUID();
      const response = await handle.callDataApiRpc(rpcName(kind), argsFor(kind, actor, newIds, before, command));
      const value = await response.json() as RpcResult;
      if (!current) {
        assert.equal(response.status, 404);
        assert.equal(value.code, "PGRST202");
        assert.deepEqual(await topicStates(handle, newIds), before, "New explicit-UUID caller must fail before a write on old schema.");
        assert.deepEqual(await receipts(handle, [command]), []);
      } else {
        assert.equal(response.ok, true);
        assert.equal(value.ok, true);
        assert.equal(value.commandId, command);
        const after = await topicStates(handle, newIds);
        assert.equal(kind === "batch" ? after[0].is_featured : after[0].status === "published", true);
        const persisted = await receipts(handle, [command]);
        assert.equal(persisted.length, 1);
        assert.equal(Number(persisted[0].actor), actor);
      }
      records.push({ rpc: rpcName(kind), legacyCallerCommitted: true, explicitUuid: current ? "committed-with-one-receipt" : "rejected-before-write" });
    }
    return { status: "passed", ...checkpoint, records, signatures: functions, menuTargetConstraints: constraints.length,
      lookupAttempts, authBrowserProof: false, scope: "Actual112/113/114 schema with old/new RPC callers; no server-build, browser-action-reference, cookie, or Vercel skew claim" };
  } finally {
    await handle.query("delete from public.topics where id=any($1::bigint[])", [ids]);
  }
}

async function waitBlocked(handle: OwnedLocalHandle, waitingPid: number, blockingPid: number) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const row = (await handle.query("select wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1", [waitingPid])).rows[0];
    if (row?.wait_event_type === "Lock" && Array.isArray(row.blockers) && row.blockers.map(Number).includes(blockingPid)) return String(row.wait_event);
    await new Promise(done => setTimeout(done, 60));
  }
  assert.fail("The second RPC must be observed waiting on the first native transaction.");
}
async function begin(db: Sql, isolation: "read committed" | "repeatable read", ids: number[]) {
  await db.query("begin isolation level " + isolation);
  await db.query("set local statement_timeout='20s'; set local lock_timeout='15s'; set local role service_role");
  // Pin the snapshot before the first writer, especially for repeatable read.
  return topicStates(db, ids);
}

/** Only new cross-RPC/overlap/actor schedules. Closed C3 scenarios are separate.
 * Call after prepareAdminInteractions: this uses two existing active actors
 * and never creates identities or changes Auth/permissions. */
export async function verifyTopicCommandSchedules(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const actors = (await handle.query("select id from public.admin_users where is_active order by id limit 2")).rows.map(row => Number(row.id));
  assert.equal(actors.length, 2, "Prepare the existing Admin fixture before actor-scoped schedules.");
  const records: Record<string, unknown>[] = [];
  for (const isolation of ["read committed", "repeatable read"] as const) {
    for (const sharedCommand of [true, false]) {
      for (const firstKind of ["batch", "publish"] as const) {
        for (const release of ["commit", "rollback"] as const) {
          await handle.renewDatabaseControlConnection();
          const ids = await createTopics(handle, 2);
          const secondKind: Kind = firstKind === "batch" ? "publish" : "batch";
          const firstCommand = randomUUID(), secondCommand = sharedCommand ? firstCommand : randomUUID();
          try {
            await handle.withDatabaseConnection(async first => handle.withDatabaseConnection(async second => {
              const firstPid = Number((await first.query("select pg_backend_pid() pid")).rows[0].pid);
              const secondPid = Number((await second.query("select pg_backend_pid() pid")).rows[0].pid);
              let pending: Promise<Outcome> | undefined;
              try {
                const initial = await begin(first, isolation, ids);
                assert.deepEqual(await begin(second, isolation, ids), initial);
                const firstResult = await nativeCall(first, firstKind, actors[0], ids, initial, firstCommand);
                assert.equal(firstResult.ok, true);
                pending = settle(nativeCall(second, secondKind, actors[0], [...ids].reverse(), initial, secondCommand));
                const observedLock = await waitBlocked(handle, secondPid, firstPid);
                await first.query(release);
                const outcome = await pending;
                const serialization = isolation === "repeatable read" && release === "commit";
                const commandConflict = !serialization && release === "commit" && sharedCommand;
                const revisionConflict = !serialization && !sharedCommand && release === "commit" && firstKind === "batch";
                if (serialization) {
                  assert.deepEqual(outcome, { ok: false, code: "40001" });
                  await second.query("rollback");
                } else {
                  assert.equal(outcome.ok, true, JSON.stringify(outcome));
                  if (!outcome.ok) throw new Error("Expected a completed native RPC result.");
                  if (commandConflict || revisionConflict) {
                    assert.equal(outcome.result.ok, false);
                    assert.equal(outcome.result.code, commandConflict ? "command_conflict" : "revision_conflict");
                  } else assert.equal(outcome.result.ok, true);
                  await second.query("commit");
                }
                const secondCommitted = !serialization && !commandConflict && !revisionConflict;
                const committedKinds = [...(release === "commit" ? [firstKind] : []), ...(secondCommitted ? [secondKind] : [])];
                const after = await topicStates(handle, ids);
                assert.equal(after.length, ids.length);
                assert.ok(after.every(row => row.is_featured === committedKinds.includes("batch")));
                assert.ok(after.every(row => row.status === (committedKinds.includes("publish") ? "published" : "unpublished")));
                assert.deepEqual(after.map(({ seo_score, seo_score_version, seo_score_input_hash }) => [seo_score, seo_score_version, seo_score_input_hash]),
                  initial.map(({ seo_score, seo_score_version, seo_score_input_hash }) => [seo_score, seo_score_version, seo_score_input_hash]));
                const durable = await receipts(handle, [...new Set([firstCommand, secondCommand])]);
                const expectedCommands = [...(release === "commit" ? [firstCommand] : []), ...(secondCommitted ? [secondCommand] : [])];
                assert.deepEqual(durable.map(row => row.command).sort(), expectedCommands.sort());
                assert.ok(durable.every(row => Number(row.actor) === actors[0]));
                records.push({ isolation, sharedCommand, firstKind, secondKind, firstRelease: release, observedLock,
                  blockingPidVerified: true, reversedInputOrder: true, second: serialization ? "40001" : commandConflict ? "command_conflict" : revisionConflict ? "revision_conflict" : "committed",
                  durableReceipts: durable.length, seoPreserved: true });
              } finally {
                await first.query("rollback");
                if (pending) await pending;
                await second.query("rollback");
              }
            }));
          } finally {
            await handle.query("delete from public.topics where id=any($1::bigint[])", [ids]);
          }
        }
      }
    }
  }
  for (const firstKind of ["batch", "publish"] as const) {
    await handle.renewDatabaseControlConnection();
    const ids = await createTopics(handle, 2), command = randomUUID();
    const secondKind: Kind = firstKind === "batch" ? "publish" : "batch";
    try {
      await handle.withDatabaseConnection(async first => handle.withDatabaseConnection(async second => {
        try {
          const initial = await begin(first, "read committed", ids);
          await begin(second, "read committed", ids);
          assert.equal((await nativeCall(first, firstKind, actors[0], [ids[0]], initial, command)).ok, true);
          // Different actor, same UUID, disjoint target: completion while the
          // first transaction is still open proves the namespace is actor-scoped.
          assert.equal((await nativeCall(second, secondKind, actors[1], [ids[1]], initial, command)).ok, true);
          await second.query("commit");
          assert.equal((await receipts(handle, [command])).length, 1);
          await first.query("commit");
          const durable = await receipts(handle, [command]);
          assert.equal(durable.length, 2);
          assert.deepEqual(durable.map(row => Number(row.actor)).sort((a, b) => a - b), [...actors].sort((a, b) => a - b));
          records.push({ scenario: "actor-separated-same-uuid", firstKind, secondKind, disjointTargets: true, secondCommittedBeforeFirstReleased: true, durableReceipts: 2 });
        } finally {
          await first.query("rollback");
          await second.query("rollback");
        }
      }));
    } finally {
      await handle.query("delete from public.topics where id=any($1::bigint[])", [ids]);
    }
  }
  await handle.renewDatabaseControlConnection();
  return { status: "passed", cases: records.length, records, authBrowserProof: false, productionAccess: false,
    limits: ["Native current114 transaction semantics only", "No client last-intent order, hosted schedules, Auth mutation, or Cron execution claim"] };
}
