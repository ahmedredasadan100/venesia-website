import {createCoreDomainVisibilityControl} from './admin-core-domain-visibility-control.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';
import { registerCorePageRoute } from './admin-core-form-permission-context.mjs';
import { buildCoreDomainCommandPlan, coreDomainVisibilityRequiresConfirmation } from './admin-core-domain-command-journeys.mjs';

async function native(output, request) {
  const id = randomUUID(), temporary = join(output, 'core-native-request-' + id + '.tmp');
  writeFileSync(temporary, JSON.stringify({ id, ...request })); renameSync(temporary, join(output, 'core-native-request-' + id + '.json'));
  const response = join(output, 'core-native-response-' + id + '.json'), deadline = Date.now() + 30_000;
  while (!existsSync(response)) { if (Date.now() >= deadline) throw new Error('The fixed domain write-fault protocol did not answer.'); await new Promise(resolve => setTimeout(resolve, 50)); }
  const result = JSON.parse(readFileSync(response, 'utf8'));
  assert.equal(result.id, id); assert.equal(result.kind, request.kind); assert.equal(result.status, 'pass', 'The native producer rejected the fixed invariant; no passing result is available.'); assert.equal(result.entity, request.entity);
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
    const visibility = createCoreDomainVisibilityControl({page,recipe});
    const dialog = page.locator('[data-admin-confirm-dialog]');
    await visibility.expectEnabled();
    const original = await visibility.readState(); assert.ok(original === 'true' || original === 'false');
    const originalState = recipe.values[original === 'true' ? 0 : 1],initialConfirmation=coreDomainVisibilityRequiresConfirmation(recipe,original);
    const probe = () => native(output, { kind: 'terminal-domain-state', entity: recipe.entity, ids: [recipe.id], startedAt });
    const before = await probe(); assert.ok(Number.isSafeInteger(before.expectedActorId)&&before.expectedActorId>0); assert.equal(before.rows.length, 1); assert.equal(before.rows[0][recipe.state], originalState);
    const token = randomUUID();
    const fault = kind => native(output, { kind: 'domain-write-fault-' + kind, entity: recipe.entity, token });
    const armed = await fault('arm'); assert.equal(armed.state, 'armed'); assert.equal(armed.fixtureId, recipe.id); assert.equal(armed.table, recipe.table);
    let released = false, producerFailed = false, cancellation, deniedStatus, posts = 0;
    const requests = request => { if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === new URL(recipe.path, origin).pathname) posts++; };
    page.on('request', requests);
    try {
      try {
        if (initialConfirmation) { await visibility.invoke(); await expect(dialog).toHaveCount(1); }
        const requestStarted = page.waitForRequest(request => request.method() === 'POST' && Boolean(request.headers()['next-action'])
          && new URL(request.url()).pathname === new URL(recipe.path, origin).pathname, { timeout: 25_000 });
        const response = actionResponse(); response.catch(() => {}); requestStarted.catch(() => {});
        const click = initialConfirmation ? dialog.locator('[data-admin-confirm-submit]').click() : visibility.invoke(); click.catch(() => {});
        await requestStarted;
        try { cancellation = await fault('cancel'); } catch (error) { producerFailed = true; throw error; }
        assert.equal(cancellation.cancelledOneStatement, true); assert.equal(cancellation.fixedMutationSignatureMatched, true);
        deniedStatus = (await response).status(); await click;
        assert.ok(deniedStatus === 200 || deniedStatus >= 400, 'A persistence fault must not masquerade as an Auth redirect.');
        await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible({ timeout: 25_000 });
        await visibility.expectState(original);
        if (initialConfirmation && visibility.failedConfirmation==='retained') { await expect(dialog).toHaveCount(1); await expect(dialog.locator('[data-admin-confirm-submit]')).toBeEnabled(); }
        else {await expect(dialog).toHaveCount(0);await visibility.expectEnabled();}
        assert.equal(posts, 1, 'The cancelled statement cannot authorize an automatic domain-command replay.');
      } finally {
        // A failing producer operation releases its matching token itself. Every
        // Browser-side failure still explicitly releases the successfully armed holder.
        if (!producerFailed) { const release = await fault('release'); assert.equal(release.ownedLockRolledBack, true); released = true; }
      }
      assert.equal(released, true);
      const rejected = await probe(); assert.equal(rejected.expectedActorId,before.expectedActorId); assert.deepEqual(rejected.rows, before.rows); assert.deepEqual(rejected.audit, before.audit);
      const checkpoints = [];
      for (const [index, expected] of [[0, original === 'true' ? 'false' : 'true'], [1, original]]) {
        const confirmationRequired=coreDomainVisibilityRequiresConfirmation(recipe,index===0?original:(original==='true'?'false':'true'));
        // The actual User failure result settles and closes its confirmation. Reopen
        // it explicitly only after native unchanged proof, before the separate retry.
        if(confirmationRequired&&index===0&&visibility.failedConfirmation==='closed'){await visibility.invoke();await expect(dialog).toHaveCount(1);assert.equal(posts,1);}
        if (confirmationRequired && index === 1) {
          const postsBefore=posts;await visibility.invoke();await expect(dialog).toHaveCount(1);
          await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);await visibility.expectReturnedFocus();assert.equal(posts,postsBefore,'Cancelling restoration must dispatch nothing.');
          await visibility.invoke();await expect(dialog).toHaveCount(1);
        }
        const trigger=confirmationRequired?dialog.locator('[data-admin-confirm-submit]'):visibility;
        let release;const gate=new Promise(resolve=>{release=resolve;}),holdConfirmation=recipe.entity==='projects'&&confirmationRequired&&index===1;let intercepted=0;
        const removeHold=holdConfirmation?await registerCorePageRoute(page,'**/*',async route=>{
          const request=route.request();if(request.method()!=='POST'||!request.headers()['next-action']||new URL(request.url()).pathname!==new URL(recipe.path,origin).pathname){await route.fallback();return;}
          intercepted++;await gate;await route.fallback();
        }):null;
        try {
        const response = actionResponse(); response.catch(() => {});
        await observe('persistence-explicit-' + (index === 0 ? 'retry' : 'restore') + '-' + recipe.entity,
          () => confirmationRequired ? trigger.click() : visibility.invoke());
        if(holdConfirmation){await expect.poll(()=>intercepted,{timeout:25000}).toBe(1);await expect(trigger).toBeDisabled();await trigger.evaluate(button=>button.click());assert.equal(intercepted,1,'Disabled confirmation cannot dispatch a duplicate.');release();}
        assertActionAcknowledged(await response);
        if (confirmationRequired) await expect(dialog).toHaveCount(0, { timeout: 60_000 });
        await visibility.expectState(expected); await visibility.expectEnabled();
        await page.reload({ waitUntil: 'domcontentloaded' }); await visibility.expectState(expected);
        const state = await probe(); assert.equal(state.expectedActorId,before.expectedActorId); assert.equal(state.rows.length, 1); assert.equal(state.rows[0][recipe.state], recipe.values[expected === 'true' ? 0 : 1]);
        assert.ok(state.audit.length > rejected.audit.length); checkpoints.push(state);
        } finally {release();if(removeHold)await removeHold();}
      }
      assert.equal(posts, 3, 'Only one cancelled attempt, one explicit retry, and one separate restoration command may execute.');
      const restored = checkpoints[1], appended = restored.audit.filter(row => !before.audit.some(prior => Number(prior.id) === Number(row.id)));
      assert.equal(appended.length, 2, 'The successful retry/restoration must append only their expected current-domain audits.');
      assert.ok(appended.every(row => Number.isSafeInteger(Number(row.actor_admin_user_id)) && Number(row.actor_admin_user_id) === before.expectedActorId));
      if (recipe.entity === 'topics') {assert.equal(appended.filter(row => row.metadata?.command).length,0);assert.deepEqual(appended.map(row=>row.action).sort(),['topic.publish','topic.unpublish']);}
      const result = { entity: recipe.entity, id: recipe.id, startedAt, ownedFaultToken: token, nativeBefore: before.id, nativeRejected: rejected.id,
        nativeRetried: checkpoints[0].id, nativeRestored: restored.id, fault: cancellation, deniedHttpStatus: deniedStatus,
        noCommitOnRejection: true, stateRevisionAndAuditUnchangedOnRejection: true, explicitRetryCommitted: true, restoredVisibleState: originalState,
        nativeActorId:before.expectedActorId, actualCommandPosts: posts, successfulAuditDelta: appended.length,
        boundary: 'Native cancellation of one exactly attributed statement, real UI rejection/rollback, native unchanged proof, then two separate authenticated commands. No Auth/grant/schema change.' };
      outcomes.push(result); return result;
    } finally { page.off('request', requests); }
  });
  return { outcomes, expectedDomains: plan.map(row => row.entity),
    boundary: 'Immediate native checkpoints carry these exact per-command audit intervals. Run before ordinary visibility journeys; later audit histories are not recounted as this phase.' };
}
