import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'playwright/test';

export async function runCoreCommandRecoveryJourney(ctx) {
  const { page, origin, output, fixtures, run, observe, feedback, databaseReadback } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const controlPath = join(output, 'admin-core-cache-control.json');
  const eventsPath = join(output, 'admin-core-cache-events.jsonl');
  assert.equal(JSON.parse(readFileSync(controlPath, 'utf8')).mode, 'off');
  const events = () => readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const installed = events().filter(row => row.type === 'installed');
  assert.equal(installed.length, 1, 'The real owned Next server must install exactly one bounded backend observer.');
  const setControl = value => {
    const temporary = controlPath + '.tmp'; writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, ...value }));
    renameSync(temporary, controlPath);
  };
  await run('topics-native-commit-deferred-cache-failure-authenticated-recovery', [], async () => {
    const topicId = Number(fixtures.topic.id), token = randomUUID(), startedAt = new Date().toISOString();
    const topicPath = origin + '/admin/content/topics?q=' + encodeURIComponent(fixtures.topic.title);
    await observe('cache-recovery-open-topics', () => page.goto(topicPath, { waitUntil: 'domcontentloaded' }));
    const featured = page.locator('[data-admin-row-action="featured"][data-admin-entity-id="' + topicId + '"] button');
    await expect(featured).toBeVisible({ timeout: 60_000 });
    const originalLabel = await featured.getAttribute('aria-label');
    assert.ok(originalLabel?.includes('تمييز'));
    const originalFeatured = originalLabel.startsWith('إلغاء');
    const scopedEvents = () => events().filter(row => row.token === token);
    const nativeProbe = async commandId => {
      const id = randomUUID();
      const temporary = join(output, 'core-native-request-' + id + '.tmp');
      writeFileSync(temporary, JSON.stringify({ id, kind: 'topic-command-durable', topicId, commandId, startedAt }));
      renameSync(temporary, join(output, 'core-native-request-' + id + '.json'));
      const destination = join(output, 'core-native-response-' + id + '.json');
      const deadline = Date.now() + 30_000;
      while (!existsSync(destination)) {
        if (Date.now() >= deadline) throw new Error('Native Topics command evidence did not arrive.');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const result = JSON.parse(readFileSync(destination, 'utf8'));
      assert.equal(result.id, id); assert.equal(result.kind, 'topic-command-durable'); assert.equal(result.status, 'pass');
      assert.equal(result.commandId, commandId); assert.equal(result.topicId, topicId);
      assert.equal(result.rows.length, 1); assert.equal(result.audit.length, 1);
      assert.equal(Number(result.rows[0].id), topicId); assert.equal(result.rows[0].is_featured, !originalFeatured);
      assert.ok(result.audit[0].actor_admin_user_id !== null);
      assert.equal(result.audit[0].command.id, commandId); assert.equal(result.audit[0].command.result.ok, true);
      assert.equal(result.commandAuditCount, 1);
      return result;
    };
    const recovery = page.getByRole('button', { name: 'استعادة نتيجة العملية', exact: true });
    setControl({ mode: 'armed', token, topicId, expectedFeatured: !originalFeatured });
    let before, after, commandId;
    try {
      // Do not reinterpret HTTP acknowledgement as commit proof: the backend is
      // failed only after the actual RPC clone proves a persisted command identity.
      await observe('cache-fault-real-feature-command', () => featured.click());
      await expect.poll(() => scopedEvents().filter(row => row.type === 'rpc-committed').length, { timeout: 60_000 }).toBe(1);
      commandId = scopedEvents().find(row => row.type === 'rpc-committed').commandId;
      await expect(recovery).toBeVisible({ timeout: 60_000 });
      await expect(recovery).toBeEnabled({ timeout: 60_000 });
      const failed = scopedEvents().filter(row => row.type === 'backend-failed');
      assert.ok(failed.some(row => row.proof === 'validated-rpc-ack'));
      assert.ok(failed.some(row => row.proof === 'atomic-receipt-read'), 'The first automatic recovery must also remain unresolved at the real cache backend.');
      assert.equal(scopedEvents().filter(row => row.type === 'domain-rpc-attempt').length, 1);
      before = await nativeProbe(commandId);
      setControl({ mode: 'recover', token, topicId, expectedFeatured: !originalFeatured });
      await observe('cache-fault-explicit-read-only-recovery', () => recovery.click());
      await expect(recovery).toHaveCount(0, { timeout: 60_000 });
      await expect(feedback('success').filter({ hasText: 'تم استرداد نتيجة العملية' }).first()).toBeVisible({ timeout: 60_000 });
      await expect.poll(() => scopedEvents().filter(row => row.type === 'backend-settled' && row.proof === 'atomic-receipt-read').length, { timeout: 60_000 }).toBeGreaterThan(0);
      after = await nativeProbe(commandId);
      assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.audit, before.audit);
      assert.equal(after.commandAuditCount, before.commandAuditCount);
      assert.equal(scopedEvents().filter(row => row.type === 'domain-rpc-attempt').length, 1, 'Recovery must not replay the domain RPC.');
      assert.ok(scopedEvents().filter(row => row.type === 'receipt-read').length >= 2);
      setControl({ mode: 'off' });
      await observe('cache-recovery-reload-durable-feature', () => page.reload({ waitUntil: 'domcontentloaded' }));
      await expect(featured).not.toHaveAttribute('aria-label', originalLabel, { timeout: 60_000 });
      // Restoring the fixture is an explicitly separate normal command, after
      // the original command/receipt equality and no-replay proof are captured.
      await observe('cache-recovery-restore-fixture', () => featured.click());
      await expect(featured).toHaveAttribute('aria-label', originalLabel, { timeout: 60_000 });
      await observe('cache-recovery-reload-restored-fixture', () => page.reload({ waitUntil: 'domcontentloaded' }));
      await expect(featured).toHaveAttribute('aria-label', originalLabel, { timeout: 60_000 });
      databaseReadback.push({ table: 'topics', id: topicId, expected: { is_featured: originalFeatured } });
      return { commandId, topicId, nativeBefore: before.id, nativeAfter: after.id, domainRpcAttempts: 1,
        durableCommandReceipts: 1, originalCommandRetained: true, actualDeferredBackendFailure: true,
        recovery: 'Authenticated Server Action reads immutable receipt, settles actual Next backend, no domain replay',
        installedBackend: installed[0], events: scopedEvents(), restoredFixture: true,
        limit: 'Same running owned local Next server; no restart or Hosted cache claim.' };
    } finally { setControl({ mode: 'off' }); }
  });
}
