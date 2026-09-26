import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';
import { buildCoreDomainCommandPlan } from './admin-core-domain-command-journeys.mjs';

async function native(output, request) {
  const id = randomUUID(), temporary = join(output, 'core-native-request-' + id + '.tmp');
  writeFileSync(temporary, JSON.stringify({ id, ...request })); renameSync(temporary, join(output, 'core-native-request-' + id + '.json'));
  const response = join(output, 'core-native-response-' + id + '.json'), deadline = Date.now() + 30_000;
  while (!existsSync(response)) { if (Date.now() >= deadline) throw new Error('The fixed domain write-fault protocol did not answer.'); await new Promise(resolve => setTimeout(resolve, 50)); }
  const result = JSON.parse(readFileSync(response, 'utf8'));
  assert.equal(result.id, id); assert.equal(result.kind, request.kind); assert.equal(result.entity, request.entity); assert.equal(result.status, 'pass');
  if (request.token) assert.equal(result.token, request.token);
  return result;
}

/** Run before the ordinary visibility cycle so its later audit interval remains exact. */
export async function runCoreDomainPersistenceFailureJourneys(ctx) {
  const { page, origin, output, fixtures, run, observe, actionResponse, assertActionAcknowledged } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const manifest = await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const location = await jiti.import('../../src/lib/admin/projects/location-management-contract.ts');
  const tracking = await jiti.import('../../src/lib/admin/projects/tracking-contract.ts');
  const plan = buildCoreDomainCommandPlan({ rowActions: manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION, fixtures, paths: { ...location, ...tracking } });
  const outcomes = [];
  for (const recipe of plan) await run('domain-' + recipe.entity + '-native-statement-rejection-explicit-retry', [], async () => {
    const startedAt = new Date().toISOString();
    await observe('persistence-open-' + recipe.entity, () => page.goto(origin + recipe.path + '?q=' + encodeURIComponent(recipe.label), { waitUntil: 'domcontentloaded' }));
    const visibility = page.locator('[data-admin-row-action="visibility"][data-admin-entity-id="' + recipe.id + '"] button');
    const dialog = page.locator('[data-admin-confirm-dialog]');
    await expect(visibility).toHaveCount(1, { timeout: 60_000 }); await expect(visibility).toBeEnabled({ timeout: 60_000 });
    const original = await visibility.getAttribute('aria-pressed'); assert.ok(original === 'true' || original === 'false');
    const originalState = recipe.values[original === 'true' ? 0 : 1];
    const probe = () => native(output, { kind: 'terminal-domain-state', entity: recipe.entity, ids: [recipe.id], startedAt });
    const before = await probe(); assert.equal(before.rows.length, 1); assert.equal(before.rows[0][recipe.state], originalState);
    const token = randomUUID();
    const fault = kind => native(output, { kind: 'domain-write-fault-' + kind, entity: recipe.entity, token });
    const armed = await fault('arm'); assert.equal(armed.state, 'armed'); assert.equal(armed.fixtureId, recipe.id); assert.equal(armed.table, recipe.table);
    let released = false, producerFailed = false, cancellation, deniedStatus, posts = 0;
    const requests = request => { if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === new URL(recipe.path, origin).pathname) posts++; };
    page.on('request', requests);
    try {
      try {
        if (recipe.confirmVisibility) { await visibility.click(); await expect(dialog).toHaveCount(1); }
        const requestStarted = page.waitForRequest(request => request.method() === 'POST' && Boolean(request.headers()['next-action'])
          && new URL(request.url()).pathname === new URL(recipe.path, origin).pathname, { timeout: 25_000 });
        const response = actionResponse(); response.catch(() => {}); requestStarted.catch(() => {});
        const click = (recipe.confirmVisibility ? dialog.locator('[data-admin-confirm-submit]') : visibility).click(); click.catch(() => {});
        await requestStarted;
        try { cancellation = await fault('cancel'); } catch (error) { producerFailed = true; throw error; }
        assert.equal(cancellation.cancelledOneStatement, true); assert.equal(cancellation.fixedMutationSignatureMatched, true);
        deniedStatus = (await response).status(); await click;
        assert.ok(deniedStatus === 200 || deniedStatus >= 400, 'A persistence fault must not masquerade as an Auth redirect.');
        await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible({ timeout: 25_000 });
        await expect(visibility).toHaveAttribute('aria-pressed', original);
        if (recipe.confirmVisibility) { await expect(dialog).toHaveCount(1); await expect(dialog.locator('[data-admin-confirm-submit]')).toBeEnabled(); }
        else await expect(visibility).toBeEnabled();
        assert.equal(posts, 1, 'The cancelled statement cannot authorize an automatic domain-command replay.');
      } finally {
        // A failing producer operation releases its matching token itself. Every
        // Browser-side failure still explicitly releases the successfully armed holder.
        if (!producerFailed) { const release = await fault('release'); assert.equal(release.ownedLockRolledBack, true); released = true; }
      }
      assert.equal(released, true);
      const rejected = await probe(); assert.deepEqual(rejected.rows, before.rows); assert.deepEqual(rejected.audit, before.audit);
      const checkpoints = [];
      for (const [index, expected] of [[0, original === 'true' ? 'false' : 'true'], [1, original]]) {
        if (recipe.confirmVisibility && index === 1) { await visibility.click(); await expect(dialog).toHaveCount(1); }
        const response = actionResponse(); response.catch(() => {});
        await observe('persistence-explicit-' + (index === 0 ? 'retry' : 'restore') + '-' + recipe.entity,
          () => (recipe.confirmVisibility ? dialog.locator('[data-admin-confirm-submit]') : visibility).click());
        assertActionAcknowledged(await response);
        if (recipe.confirmVisibility) await expect(dialog).toHaveCount(0, { timeout: 60_000 });
        await expect(visibility).toHaveAttribute('aria-pressed', expected, { timeout: 60_000 }); await expect(visibility).toBeEnabled({ timeout: 60_000 });
        await page.reload({ waitUntil: 'domcontentloaded' }); await expect(visibility).toHaveAttribute('aria-pressed', expected, { timeout: 60_000 });
        const state = await probe(); assert.equal(state.rows.length, 1); assert.equal(state.rows[0][recipe.state], recipe.values[expected === 'true' ? 0 : 1]);
        assert.ok(state.audit.length > rejected.audit.length); checkpoints.push(state);
      }
      assert.equal(posts, 3, 'Only one cancelled attempt, one explicit retry, and one separate restoration command may execute.');
      const restored = checkpoints[1], appended = restored.audit.filter(row => !before.audit.some(prior => Number(prior.id) === Number(row.id)));
      assert.equal(appended.length, recipe.entity === 'topics' ? 3 : 2, 'The successful retry/restoration must append only their expected current-domain audits.');
      assert.ok(appended.every(row => Number.isSafeInteger(Number(row.actor_admin_user_id)) && Number(row.actor_admin_user_id) > 0));
      if (recipe.entity === 'topics') assert.equal(appended.filter(row => row.metadata?.command).length, 2);
      const result = { entity: recipe.entity, id: recipe.id, startedAt, ownedFaultToken: token, nativeBefore: before.id, nativeRejected: rejected.id,
        nativeRetried: checkpoints[0].id, nativeRestored: restored.id, fault: cancellation, deniedHttpStatus: deniedStatus,
        noCommitOnRejection: true, stateRevisionAndAuditUnchangedOnRejection: true, explicitRetryCommitted: true, restoredVisibleState: originalState,
        actualCommandPosts: posts, successfulAuditDelta: appended.length,
        boundary: 'Native cancellation of one exactly attributed statement, real UI rejection/rollback, native unchanged proof, then two separate authenticated commands. No Auth/grant/schema change.' };
      outcomes.push(result); return result;
    } finally { page.off('request', requests); }
  });
  return { outcomes, expectedDomains: plan.map(row => row.entity),
    boundary: 'Immediate native checkpoints carry these exact per-command audit intervals. Run before ordinary visibility journeys; later audit histories are not recounted as this phase.' };
}
