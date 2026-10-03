import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";
import { verifyAdminCommandActorDeletion } from "./verify-admin-command-actor-deletion-isolated.mts";
import { verifyDeferredNextCommandRecovery, type ActualNextCache } from "./verify-deferred-next-command-recovery.mts";
import type { AdminActionResult } from "../src/lib/admin/admin-action-result.ts";

const ROOT = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
type Exports = Record<string, unknown>;

/** Actual action source + installed SDK + real PostgREST + full native schema.
 * Auth/session and Next cache delivery are explicit injected infrastructure
 * ports. This is not authenticated Browser or deployed-cache evidence. */
export async function verifyTopicCommandCompletion(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  // Loading actual cache owners now imports next/navigation. Next captures its
  // storage implementation at first import, so initialize the same native Node
  // runtime port used by the deferred-settlement verifier before loading Actions.
  const runtime = globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage };
  runtime.AsyncLocalStorage ??= AsyncLocalStorage;
  const actor = (await handle.query("select id,username from public.admin_users where is_active order by id limit 1")).rows[0];
  assert.ok(actor);
  const seo = loadEntitySeoPersistenceOwner();
  const records: Record<string, unknown>[] = [];
  let actualNextCache: ActualNextCache | null = null;
  let sequence = 0, rpcCalls = 0, cacheCalls = 0, mediaCalls = 0, appAuditCalls = 0;
  let dropNextResponse = false, blockReceiptAfterDrop = false, receiptReadsBlocked = false, cacheFails = false;
  let blockReceiptAfterConfirmedResponse = false, mediaThrows = false;
  const client = createClient("http://127.0.0.1:1", "owned-fixture-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      assert.equal(url.origin, "http://127.0.0.1:1");
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        rpcCalls++;
        const response = await handle.callDataApiRpc(url.pathname.split("/").at(-1)!, JSON.parse(String(init?.body)));
        if (dropNextResponse && response.ok) {
          const committed = await response.clone().json();
          assert.equal(committed.ok, true);
          dropNextResponse = false;
          receiptReadsBlocked = blockReceiptAfterDrop;
          // The real PostgREST transaction has committed and returned headers;
          // delivery is cut at the installed SDK fetch boundary.
          throw new TypeError("Injected acknowledgement loss after native commit");
        }
        if (blockReceiptAfterConfirmedResponse && response.ok) receiptReadsBlocked = true;
        return response;
      }
      const readMethod = (init?.method ?? "GET").toUpperCase();
      assert.ok(readMethod === "GET" || readMethod === "HEAD", "Recovery and action preflight must only read outside RPCs");
      if (receiptReadsBlocked && url.pathname.endsWith("/admin_audit_logs")) throw new TypeError("Injected receipt read outage");
      const headers = new Headers();
      for (const [key, value] of new Headers(init?.headers)) if (["accept", "prefer", "range", "range-unit"].includes(key)) headers.set(key, value);
      return handle.readDataApi(url.pathname + url.search, headers, readMethod);
    } },
  });
  const ports = new Map<string, Exports>([
    ["src/lib/supabase-admin.ts", { getSupabaseAdmin: () => client }],
    ["src/lib/admin/auth/require-admin-session.ts", { requireAdminSession: async () => actor }],
    ["src/lib/admin/audit-log.ts", { recordCmsAdminAudit: async () => { appAuditCalls++; } }],
    ["src/lib/admin/links/usage.ts", { getResourceLinkUsageCount: async () => 0 }],
    ["src/lib/admin/media-catalog/synchronization.ts", { synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => { mediaCalls++; if (mediaThrows) throw new Error("Injected unexpected media boundary rejection"); return { status: "synced" }; } }],
    ["src/lib/admin/media-catalog/domain-write-coordination.ts", { coordinateMediaReferenceEntityMutation: async () => { throw new Error("Unsafe duplicate is outside this receipt contract"); } }],
    ["src/lib/admin/media-catalog/write-lease.ts", { MediaReferenceWriteLeaseError: class extends Error {}, getMediaReferenceWriteLeaseUserMessage: () => "Fixture media lease" }],
    ["src/lib/admin/preferences/admin-column-preferences.ts", { saveAdminColumnPreferences: async () => { throw new Error("Preferences outside completion proof"); } }],
    ["src/lib/logging.ts", { logError() {}, logWarn() {}, logInfo() {} }],
  ]);
  const modules = new Map<string, { exports: Exports }>();
  const sourceFiles: string[] = [];
  function load(file: string): Exports {
    const absolute = resolve(ROOT, file), normalized = relative(ROOT, absolute).replaceAll("\\", "/");
    assert.ok(!normalized.startsWith(".."));
    if (ports.has(normalized)) return ports.get(normalized)!;
    if (modules.has(absolute)) return modules.get(absolute)!.exports;
    const loaded = { exports: {} as Exports }; modules.set(absolute, loaded); sourceFiles.push(normalized);
    const compiled = ts.transpileModule(readFileSync(absolute, "utf8"), { fileName: absolute, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", compiled)((specifier: string) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/cache") {
        const invalidate = () => { cacheCalls++; if (cacheFails) throw new Error("Injected cache backend failure"); };
        return {
          revalidatePath: (...args: Parameters<ActualNextCache["revalidatePath"]>) => actualNextCache ? actualNextCache.revalidatePath(...args) : invalidate(),
          revalidateTag: (...args: Parameters<ActualNextCache["revalidateTag"]>) => actualNextCache ? actualNextCache.revalidateTag(...args) : invalidate(),
          updateTag: (...args: Parameters<ActualNextCache["updateTag"]>) => actualNextCache ? actualNextCache.updateTag(...args) : invalidate(),
        };
      }
      if (!specifier.startsWith(".")) return require(specifier);
      const base = resolve(dirname(absolute), specifier);
      const dependency = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(dependency, `Unresolved actual dependency ${specifier}`);
      return load(relative(ROOT, dependency));
    }, loaded, loaded.exports);
    return loaded.exports;
  }
  const actions = load("src/app/admin/content/topics/actions.ts") as Record<string, (form: FormData) => Promise<AdminActionResult>> & { recoverUnifiedContentCommand: (id: string) => Promise<AdminActionResult> };
  const createTopic = async (trashed = false) => {
    const row = { slug: `audit2-command-${++sequence}`, title: "اختبار إتمام الأوامر واسترداد النتيجة المؤكدة", excerpt: "اختبار معزول لإتمام الأوامر دون تكرار التغيير بعد فقد الاستجابة.", content: "محتوى اختبار معزول لإثبات الحفظ والتعافي وسجل المراجعة. ".repeat(60), image: "/images/venesia-5.png", image_alt: "صورة الاختبار", content_type: "article", category: "اختبار", category_slug: "audit2", status: "unpublished", deleted_at: trashed ? "2026-09-26T00:00:00Z" : null, focus_keyword: "اختبار", seo_title: "اختبار إتمام الأوامر واسترداد النتيجة المؤكدة", seo_description: "اختبار معزول لإتمام الأوامر دون تكرار التغيير بعد فقد الاستجابة.", faq: [], seo_keywords: ["اختبار"] };
    const payload = { ...row, ...seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)) };
    const keys = Object.keys(payload), values = Object.values(payload).map((value, index) => ["faq"].includes(keys[index]) ? JSON.stringify(value) : value);
    return Number((await handle.query(`insert into public.topics(${keys.map(key => `"${key}"`).join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id`, values)).rows[0].id);
  };
  const form = (id: number, commandId: string, action: string) => { const f = new FormData(); f.set("id", String(id)); f.append("topic_ids", String(id)); f.set("bulk_action", action); f.set("command_id", commandId); f.set("confirm_permanent", "true"); return f; };
  const state = async (id: number) => (await handle.query("select id,is_featured,status,deleted_at,updated_at from public.topics where id=$1", [id])).rows[0];
  const receiptCount = async (id: string) => Number((await handle.query("select count(*) count from public.admin_audit_logs where actor_admin_user_id=$1 and metadata->'command'->>'id'=$2", [actor.id, id.toLowerCase()])).rows[0].count);
  const firstId = await createTopic(), firstCommand = randomUUID();
  dropNextResponse = true;
  const first = await actions.bulkUpdateUnifiedContent(form(firstId, firstCommand, "feature"));
  assert.equal(first.ok, true); assert.equal(first.completion, "committed"); assert.equal(first.commandId, firstCommand);
  assert.equal((await state(firstId)).is_featured, true); assert.equal(await receiptCount(firstCommand), 1);
  assert.equal(rpcCalls, 1); assert.ok(cacheCalls > 0); assert.equal(appAuditCalls, 0);
  records.push({ scenario: "native-commit-sdk-ack-loss-immediate-recovery", result: first, rpcCalls, cacheCalls });
  const beforeRecovery = rpcCalls;
  assert.equal((await actions.recoverUnifiedContentCommand(firstCommand)).completion, "committed");
  assert.equal(rpcCalls, beforeRecovery, "HTTP acknowledgement recovery must not issue a domain RPC");
  const oppositeCommand = randomUUID();
  assert.equal((await actions.bulkUpdateUnifiedContent(form(firstId, oppositeCommand, "unfeature"))).completion, "committed");
  const newState = await state(firstId), beforeReplay = rpcCalls;
  const replay = await actions.bulkUpdateUnifiedContent(form(firstId, firstCommand.toUpperCase(), "feature"));
  assert.equal(replay.completion, "committed"); assert.equal(replay.commandId, firstCommand);
  assert.deepEqual(await state(firstId), newState); assert.equal(rpcCalls, beforeReplay);
  const conflict = await actions.bulkUpdateUnifiedContent(form(firstId, firstCommand, "unfeature"));
  assert.equal(conflict.completion, "not_committed"); assert.equal(conflict.code, "command_conflict");
  records.push({ scenario: "same-command-replay-after-new-opposite-intent", replay, conflict, unchanged: true });
  const unresolvedCommand = randomUUID(); dropNextResponse = true; blockReceiptAfterDrop = true;
  const unknown = await actions.bulkUpdateUnifiedContent(form(firstId, unresolvedCommand, "feature"));
  assert.equal(unknown.ok, false); assert.equal(unknown.feedbackStatus, "warning"); assert.equal(unknown.completion, "unknown");
  receiptReadsBlocked = false; blockReceiptAfterDrop = false;
  const beforeLater = rpcCalls;
  assert.equal((await actions.recoverUnifiedContentCommand(unresolvedCommand)).completion, "committed"); assert.equal(rpcCalls, beforeLater);
  records.push({ scenario: "receipt-temporarily-unavailable-then-read-only-recovery", unknown });
  const cacheCommand = randomUUID(); cacheFails = true;
  const cacheResult = await actions.bulkUpdateUnifiedContent(form(firstId, cacheCommand, "unfeature"));
  assert.equal(cacheResult.ok, true); assert.equal(cacheResult.feedbackStatus, "warning"); assert.equal(cacheResult.completion, "committed");
  cacheFails = false; const cacheRpcCount = rpcCalls;
  assert.equal((await actions.recoverUnifiedContentCommand(cacheCommand)).feedbackStatus, "success"); assert.equal(rpcCalls, cacheRpcCount);
  records.push({ scenario: "committed-cache-warning-recovery", result: cacheResult });
  for (const action of ["restore", "permanent_delete", "empty_trash"] as const) {
    const id = await createTopic(true), commandId = randomUUID(), f = form(id, commandId, action);
    const before = (await handle.query("select title,slug,content_type,deleted_at from public.topics where id=$1", [id])).rows[0];
    f.set("expected_count", "1"); dropNextResponse = true;
    const result = action === "empty_trash" ? await actions.emptyUnifiedContentTrash(f) : await actions.bulkUpdateUnifiedContent(f);
    assert.equal(result.completion, "committed", JSON.stringify({ action, result }));
    assert.equal(result.ok, true); assert.equal(await receiptCount(commandId), 1);
    if (action === "restore") assert.equal((await state(id)).deleted_at, null); else assert.equal(await state(id), undefined);
    const audit = (await handle.query("select entity_label,metadata from public.admin_audit_logs where actor_admin_user_id=$1 and metadata->'command'->>'id'=$2", [actor.id, commandId])).rows[0];
    assert.equal(audit.entity_label, before.title, "Single-topic receipt preserves the searchable audit label after purge");
    const metadata = audit.metadata as Record<string, unknown>;
    assert.equal(metadata.slug, before.slug); assert.equal(metadata.content_type, before.content_type);
    if (action === "restore") {
      assert.equal(metadata.restored_status, "unpublished");
      assert.equal(Date.parse(String(metadata.previous_deleted_at)), Date.parse(String(before.deleted_at)));
    } else {
      assert.equal(metadata.permanent, true); assert.equal(metadata.slug_released, true);
      assert.equal(metadata.empty_trash, action === "empty_trash");
    }
    records.push({ scenario: `${action}-commit-loss-recovery`, result, auditEventIdentityPreserved: true, auditMetadataPreservedAfterPurge: action !== "restore" });
  }
  assert.ok(mediaCalls >= 2);
  const failureCommand = randomUUID(), failureBefore = await state(firstId);
  await handle.query(`create function public.audit2_fail_receipt() returns trigger language plpgsql as $f$ begin if new.metadata->'command'->>'id'='${failureCommand}' then raise exception using errcode='23514',message='injected_receipt_failure'; end if; return new; end; $f$; create trigger audit2_fail_receipt before insert on public.admin_audit_logs for each row execute function public.audit2_fail_receipt()`);
  try {
    const rejected = await actions.bulkUpdateUnifiedContent(form(firstId, failureCommand, "feature"));
    assert.equal(rejected.ok, false); assert.equal(rejected.completion, "not_committed");
    assert.deepEqual(await state(firstId), failureBefore); assert.equal(await receiptCount(failureCommand), 0);
    records.push({ scenario: "audit-receipt-write-failure-rolls-back-domain", result: rejected });
  } finally { await handle.query("drop trigger audit2_fail_receipt on public.admin_audit_logs; drop function public.audit2_fail_receipt()"); }
  await assert.rejects(handle.query("delete from public.admin_audit_logs where metadata->'command'->>'id'=$1", [firstCommand]), (error: { code?: string }) => error.code === "23514");
  const concurrentCommand = randomUUID();
  const knownCommitId = await createTopic(true), knownCommitCommand = randomUUID();
  const knownCommitRpcStart = rpcCalls;
  blockReceiptAfterConfirmedResponse = true; mediaThrows = true;
  const knownCommitResult = await actions.permanentlyDeleteUnifiedContent(form(knownCommitId, knownCommitCommand, "permanent_delete"));
  assert.equal(knownCommitResult.ok, true); assert.equal(knownCommitResult.completion, "committed");
  assert.equal(knownCommitResult.feedbackStatus, "warning"); assert.equal(knownCommitResult.commandId, knownCommitCommand);
  assert.equal(await state(knownCommitId), undefined); assert.equal(await receiptCount(knownCommitCommand), 1);
  assert.equal(rpcCalls, knownCommitRpcStart + 1);
  blockReceiptAfterConfirmedResponse = false; receiptReadsBlocked = false; mediaThrows = false;
  assert.equal((await actions.recoverUnifiedContentCommand(knownCommitCommand)).completion, "committed");
  assert.equal(rpcCalls, knownCommitRpcStart + 1);
  records.push({ scenario: "known-commit-survives-media-boundary-rejection-and-receipt-read-outage", result: knownCommitResult, noDomainReplay: true });
  const callNative = (db: { query: OwnedLocalHandle["query"] }, command: string, action = "feature") => db.query("select public.admin_mutate_topics_batch_atomically($1,$2,$3::bigint[],null,null,$4::uuid) result", [actor.id, action, [firstId], command]);
  await handle.withDatabaseConnection(async one => handle.withDatabaseConnection(async two => {
    const results = await Promise.all([callNative(one, concurrentCommand), callNative(two, concurrentCommand)]);
    assert.deepEqual(results[0].rows[0].result, results[1].rows[0].result); assert.equal(await receiptCount(concurrentCommand), 1);
    const conflictNative = (await callNative(one, concurrentCommand, "unfeature")).rows[0].result;
    assert.equal((conflictNative as { code: string }).code, "command_conflict");
  }));
  records.push({ scenario: "actor-delete-receipt-lifecycle", proof: await verifyAdminCommandActorDeletion(handle, firstId) });
  const deferredCommand = randomUUID();
  records.push({ scenario: "real-next-deferred-cache-settlement", proof: await verifyDeferredNextCommandRecovery({
    mutate: () => actions.bulkUpdateUnifiedContent(form(firstId, deferredCommand, "feature")),
    recover: () => actions.recoverUnifiedContentCommand(deferredCommand),
    snapshot: async () => ({ domain: await state(firstId), receipts: await receiptCount(deferredCommand), rpcCalls }),
    useNextCache: port => { actualNextCache = port; },
  }) });
  const publishId = await createTopic(), publishCommand = randomUUID();
  const revision = (await handle.query("select updated_at::text revision from public.topics where id=$1", [publishId])).rows[0].revision as string;
  const published = await handle.callDataApiRpc("admin_publish_topics_atomically", { p_actor_id: Number(actor.id), p_topics: [{ id: publishId, expected_updated_at: revision }], p_command_id: publishCommand });
  const publishResult = await published.json(); assert.equal(publishResult.ok, true, JSON.stringify(publishResult));
  const parsePublish = load("src/lib/admin/content/topics-bulk-publish.ts").parseTopicsBulkPublishRpcResult as (input: unknown) => unknown;
  assert.ok(parsePublish(publishResult));
  const publishReplay = await handle.callDataApiRpc("admin_publish_topics_atomically", { p_actor_id: Number(actor.id), p_topics: [{ id: publishId, expected_updated_at: revision }], p_command_id: publishCommand });
  assert.deepEqual(await publishReplay.json(), publishResult); assert.equal(await receiptCount(publishCommand), 1);
  const legacy = await handle.callDataApiRpc("admin_mutate_topics_batch_atomically", { p_actor_id: Number(actor.id), p_action: "unfeature", p_topic_ids: [firstId] }); assert.equal((await legacy.json()).ok, true);
  // New-code / old-schema is exercised against the real PostgREST resolver.
  // Replace only this fixture RPC temporarily; restore exact function source
  // and the same grants in finally. The migration registry is never rewritten.
  const currentFunction = (await handle.query("select pg_get_functiondef('public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid)'::regprocedure) definition, obj_description('public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid)'::regprocedure, 'pg_proc') comment")).rows[0];
  const currentDefinition = currentFunction.definition as string;
  const skewCommand = randomUUID(), skewBefore = await state(firstId);
  try {
    await handle.query("drop function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid)");
    await handle.query(readFileSync(resolve(ROOT, "sql/migrations/20260925200723_topics_batch_atomic_current_state.sql"), "utf8"));
    const skew = await actions.bulkUpdateUnifiedContent(form(firstId, skewCommand, "feature"));
    assert.equal(skew.ok, false); assert.equal(skew.completion, "not_committed");
    assert.deepEqual(await state(firstId), skewBefore); assert.equal(await receiptCount(skewCommand), 0);
    records.push({ scenario: "new-code-old-schema-explicit-argument-rejected-before-write", result: skew });
  } finally {
    await handle.query("drop function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer)");
    await handle.query(currentDefinition);
    const restoreComment = (await handle.query("select format('comment on function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid) is %L', $1::text) statement", [currentFunction.comment])).rows[0].statement as string;
    await handle.query(restoreComment);
    await handle.query("revoke all on function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid) from public,anon,authenticated,service_role; grant execute on function public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid) to service_role; notify pgrst, 'reload schema'");
    assert.equal((await handle.query("select pg_get_functiondef('public.admin_mutate_topics_batch_atomically(bigint,text,bigint[],bigint,integer,uuid)'::regprocedure) definition")).rows[0].definition, currentDefinition);
  }
  const acl = (await handle.query("select p.proname, pg_get_function_identity_arguments(p.oid) args, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') authenticated, has_function_privilege('service_role',p.oid,'execute') service_role from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('admin_mutate_topics_batch_atomically','admin_publish_topics_atomically') order by p.proname")).rows;
  assert.equal(acl.length, 2); assert.ok(acl.every(row => row.anon === false && row.authenticated === false && row.service_role === true));
  records.push({ scenario: "native-concurrent-same-identity-and-publish-replay", exactOneReceipt: true, preservedAcl: acl, legacyCallerCompatible: true, receiptImmutable: true });
  return { status: "passed", records, counters: { rpcCalls, cacheCalls, mediaCalls, appAuditCalls }, sourceFiles, infrastructurePorts: [...ports.keys()], limits: ["Session injection is not authenticated Browser evidence", "Next cache calls use injected infrastructure; remote deferred cache timing remains separate", "Duplicate/create and single status CAS do not use the batch receipt contract", "No cross-client product last-intent ordering claim"] };
}
