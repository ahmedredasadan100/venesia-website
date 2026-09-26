import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

/** Caller provides its own active synthetic Topic; this helper proves existing Admin deletion remains supported. */
export async function verifyAdminCommandActorDeletion(handle: OwnedLocalHandle, topicId: number) {
  assertOwnedLocalHandle(handle);
  assert.ok(Number.isSafeInteger(topicId) && topicId > 0);
  const commandId = randomUUID();
  const username = `audit2-deleted-actor-${commandId}`;
  const actor = (await handle.query("insert into public.admin_users(email,username,password_hash,full_name,role,is_active) values($1,$2,'isolated-non-login-fixture','Synthetic command actor','admin',true) returning id", [`${username}@example.invalid`, username])).rows[0];
  const actorId = Number(actor.id);
  try {
    const result = (await handle.query("select public.admin_mutate_topics_batch_atomically($1,'feature',$2::bigint[],null,null,$3::uuid) result", [actorId, [topicId], commandId])).rows[0].result as { ok: boolean; commandId: string };
    assert.equal(result.ok, true);
    assert.equal(result.commandId, commandId);
    const receipt = (await handle.query("select to_jsonb(a) row from public.admin_audit_logs a where actor_admin_user_id=$1 and metadata->'command'->>'id'=$2", [actorId, commandId])).rows[0].row as Record<string, unknown>;
    assert.ok(receipt);
    const metadata = receipt.metadata as { command: { actorId: number; result: unknown } };
    assert.equal(Number(metadata.command.actorId), actorId);
    await assert.rejects(handle.query("update public.admin_audit_logs set actor_admin_user_id=null where id=$1", [receipt.id]), { code: "23514" });
    await assert.rejects(handle.query("update public.admin_audit_logs set metadata='{}' where id=$1", [receipt.id]), { code: "23514" });
    await handle.query("delete from public.admin_users where id=$1", [actorId]);
    const retained = (await handle.query("select to_jsonb(a) row from public.admin_audit_logs a where id=$1", [receipt.id])).rows[0]?.row as Record<string, unknown> | undefined;
    assert.ok(retained);
    assert.deepEqual(retained, { ...receipt, actor_admin_user_id: null });
    await assert.rejects(handle.query("delete from public.admin_audit_logs where id=$1", [receipt.id]), { code: "23514" });
    assert.equal(Number((await handle.query("select count(*) count from public.admin_users where id=$1", [actorId])).rows[0].count), 0);
    return { status: "complete", realCommandCommitted: true, adminDeletionSucceeded: true, immutableReceiptRetained: true, originalActorIdentityRetained: true, directNullificationRejected: true, metadataTamperingRejected: true, receiptDeletionRejected: true };
  } finally {
    await handle.query("delete from public.admin_users where id=$1", [actorId]);
  }
}
