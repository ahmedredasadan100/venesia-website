import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertOwnedLocalHandle, type OwnedLocalHandle } from './lib/isolated-supabase.mts';
import { readCoreDomainCheckpoint } from './verify-admin-core-domain-readback-isolated.mts';
import { createOwnedCoreDomainWriteFaults } from './verify-admin-core-domain-write-fault-isolated.mts';

/** PostgreSQL bigint fixture values may be exact decimal strings. */
export function normalizeOwnedFixtureTopicId(value: unknown): number {
  assert.ok(typeof value === 'number' || (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)), 'Fixture topic ID must be a positive exact decimal integer.');
  const id = Number(value);
  assert.ok(Number.isSafeInteger(id) && id > 0, 'Fixture topic ID must be a positive safe integer.');
  return id;
}

/** Existing owner callback only; no provisioning, credentials or production target. */
export async function verifyOwnedCoreDomainWriteFaultProducer(handle: OwnedLocalHandle, fixtures: { topic: { id: number | string } }) {
  assertOwnedLocalHandle(handle);
  const topicId = normalizeOwnedFixtureTopicId(fixtures.topic.id);
  const startedAt = new Date().toISOString(), token = randomUUID();
  const broker = createOwnedCoreDomainWriteFaults(handle, fixtures);
  const request = (kind: string) => broker.handleRequest({ id: randomUUID(), kind: 'domain-write-fault-' + kind, entity: 'topics', token });
  const checkpoint = () => readCoreDomainCheckpoint(handle, { id: randomUUID(), kind: 'terminal-domain-state', entity: 'topics', ids: [topicId], startedAt });
  let rpc: Promise<Response> | undefined, released = false, primaryFailure: unknown;
  try {
    const before = await checkpoint(); assert.ok('rows' in before); assert.equal(before.rows.length, 1);
    const actor = (await handle.query('select id from public.admin_users where is_active=true order by id limit 1')).rows[0]; assert.ok(actor);
    const commandId = randomUUID(), armed = await request('arm');
    assert.equal(armed.fixtureId, topicId);
    rpc = handle.callDataApiRpc('admin_mutate_topics_batch_atomically', { p_actor_id: Number(actor.id),
      p_action: before.rows[0].is_featured ? 'unfeature' : 'feature', p_topic_ids: [topicId], p_category_id: null, p_expected_deleted_count: null, p_command_id: commandId });
    rpc.catch(() => {});
    const cancelled = await request('cancel'); assert.equal(cancelled.cancelledOneStatement, true);
    const response = await rpc, payload = await response.json() as { code?: unknown };
    assert.equal(payload.code, '57014', 'The actual PostgREST transport must expose PostgreSQL statement cancellation, not a fabricated domain result.');
    assert.ok(response.status >= 400);
    await request('release'); released = true;
    const after = await checkpoint(); assert.ok('rows' in after); assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.audit, before.audit);
    return { status: 'pass', topicId, commandId, nativeStatementSqlState: payload.code, httpStatus: response.status, cancelled,
      before: before.id, after: after.id, originalStateRevisionAndAuditUnchanged: true,
      boundary: 'One actual owned PostgREST command reached the real row lock and returned native57014 with zero durable change. Browser command rejection/retry remains a separate proof.' };
  } catch (error) { primaryFailure = error; throw error; } finally {
    // close awaits the retained owned connection and always rolls its transaction
    // back. The actual HTTP request is also awaited before this callback ends.
    const cleanupErrors: unknown[] = [];
    try { await broker.close(); } catch (error) { cleanupErrors.push(error); }
    if (rpc && !released) try { await rpc; } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) throw new AggregateError(primaryFailure ? [primaryFailure, ...cleanupErrors] : cleanupErrors,
      'Owned fault proof failed and its awaited cleanup reported additional errors.');
  }
}
