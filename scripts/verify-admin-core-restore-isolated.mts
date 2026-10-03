import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { verifyOwnedApplicationRestore } from "./lib/isolated-application-restore-verification.mts";

/** Continue the existing strict restore proof with an actual Browser command receipt. */
export async function verifyCoreBrowserCommandRestore(handle: OwnedLocalHandle, artifactDir: string) {
  assertOwnedLocalHandle(handle);
  const browser = JSON.parse(readFileSync(join(artifactDir, "admin-adoption-browser.json"), "utf8"));
  const journey = browser.evidence.find((row: {id:string;status:string}) => row.id === "topics-native-commit-deferred-cache-failure-authenticated-recovery" && row.status === "pass");
  assert.ok(journey, "Restore extension requires the real authenticated deferred-recovery journey.");
  const detail = journey;
  assert.match(detail.commandId, /^[a-f0-9-]{36}$/i);
  const receipts = async () => (await handle.query("select id,actor_admin_user_id,metadata->'command' as command from public.admin_audit_logs where metadata->'command'->>'id'=$1 order by id", [detail.commandId])).rows;
  const before = await receipts(); assert.equal(before.length, 1);
  const original = before[0];
  assert.ok(original.actor_admin_user_id);
  const command = original.command as { id:string;actorId:number;intent:{action:string;ids:number[]};result:Record<string,unknown> };
  assert.equal(command.id, detail.commandId); assert.equal(Number(command.actorId), Number(original.actor_admin_user_id)); assert.equal(command.result.commandId, command.id); assert.ok(["feature","unfeature"].includes(command.intent.action));
  assert.deepEqual(command.intent.ids.map(Number), [Number(detail.topicId)]); assert.equal(command.result.ok,true);
  const strictRestore = await verifyOwnedApplicationRestore(handle,join(artifactDir,"core-strict-restore"));
  assert.deepEqual(await receipts(),before,"Atomic Browser command receipt must survive the real dump/loss/restore intact.");
  // The existing restore owner's independent mutation smoke test runs first.
  // Replay must preserve that current state, rather than reapply the old intent.
  const current = async () => (await handle.query("select to_jsonb(t) row from public.topics t where id=$1",[detail.topicId])).rows;
  const stateBeforeReplay = await current(); assert.equal(stateBeforeReplay.length,1);
  const countBefore = (await handle.query("select count(*)::int count from public.admin_audit_logs")).rows[0].count;
  const replay = await handle.withDatabaseConnection(async connection => {
    await connection.query("begin");
    try {
      await connection.query("set local role service_role");
      const result = (await connection.query("select public.admin_mutate_topics_batch_atomically($1,$2,$3::bigint[],null,null,$4::uuid) result",[original.actor_admin_user_id,command.intent.action,command.intent.ids,command.id])).rows[0].result;
      await connection.query("commit"); return result;
    } catch (error) { await connection.query("rollback"); throw error; }
  });
  assert.deepEqual(replay,command.result,"Restored same-command replay must return the original immutable result.");
  assert.deepEqual(await current(),stateBeforeReplay,"Restored replay must not alter the current row or its revision.");
  assert.deepEqual(await receipts(),before);
  assert.equal((await handle.query("select count(*)::int count from public.admin_audit_logs")).rows[0].count,countBefore,"Restored replay must not append an extra audit.");
  const report={status:"pass",strictRestore,commandId:command.id,topicId:detail.topicId,originalAuditId:original.id,immutableReceiptRestored:true,replayedOriginalResult:true,domainStateAndRevisionUnchanged:true,noExtraAudit:true,
    scope:"Actual authenticated command survives strict isolated public/registry restore; no hosted Auth, Storage bytes, role memberships, PITR or retention claim."};
  writeFileSync(join(artifactDir,"core-browser-command-restore.json"),JSON.stringify(report,null,2)+"\n");return report;
}
