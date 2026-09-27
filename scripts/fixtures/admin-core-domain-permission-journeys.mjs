import {selectCoreDomainPermissionPlan} from './admin-core-domain-terminal-journeys.mjs';
import {createCoreDomainVisibilityControl} from './admin-core-domain-visibility-control.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';
import { buildCoreDomainCommandPlan, coreDomainVisibilityRequiresConfirmation } from './admin-core-domain-command-journeys.mjs';

export function classifyCorePermissionDenial(status, headers, origin) {
  const destination = headers.location ?? headers['x-action-redirect']?.split(';')[0];
  if (typeof destination !== 'string') return null;
  const url = new URL(destination, origin);
  if (url.origin !== origin || url.pathname !== '/admin/login') return null;
  if (![301, 302, 303, 307, 308].includes(status) && !(status === 200 && headers['x-action-redirect'])) return null;
  return { status, destination: url.pathname, contract: 'existing-proxy-revoked-session-rejection' };
}

async function checkpoint(output, recipe, startedAt) {
  const id = randomUUID(), request = { id, kind: 'terminal-domain-state', entity: recipe.entity, ids: [recipe.id], startedAt };
  const temporary = join(output, 'core-native-request-' + id + '.tmp'), target = join(output, 'core-native-request-' + id + '.json');
  writeFileSync(temporary, JSON.stringify(request)); renameSync(temporary, target);
  const response = join(output, 'core-native-response-' + id + '.json'), deadline = Date.now() + 30_000;
  while (!existsSync(response)) {
    if (Date.now() >= deadline) throw new Error('The fixed permission native checkpoint did not arrive.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const result = JSON.parse(readFileSync(response, 'utf8'));
  assert.equal(result.id, id); assert.equal(result.kind, request.kind); assert.equal(result.entity, recipe.entity); assert.equal(result.status, 'pass');
  assert.equal(result.rows.length, 1); assert.equal(Number(result.rows[0].id), recipe.id);
  return result;
}

/** Real mounted controls retain a formerly valid cookie while the ordinary logout revokes it. */
export async function runCoreDomainPermissionJourneys(ctx) {
  const { browser, context, origin, output, fixtures, run, observe, ownedNetworkOnly, revokeSession } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.equal(typeof ownedNetworkOnly, 'function'); assert.equal(typeof revokeSession, 'function');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const manifest = await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const location = await jiti.import('../../src/lib/admin/projects/location-management-contract.ts');
  const tracking = await jiti.import('../../src/lib/admin/projects/tracking-contract.ts');
  const plan = selectCoreDomainPermissionPlan(buildCoreDomainCommandPlan({ rowActions: manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION, fixtures, paths: { ...location, ...tracking } }), ctx.journeySelection ?? null);
  const signedState = await context.storageState();
  assert.ok(signedState.cookies.some(cookie => cookie.name === 'venesia_admin_session' && cookie.httpOnly && cookie.value.length > 0));
  // The cookie is kept only in process memory and is never written to a receipt.
  const stale = await browser.newContext({ storageState: signedState, viewport: { width: 1440, height: 1000 } });
  const mounted = [], outcomes = [];
  try {
    await stale.route('**/*', ownedNetworkOnly);
    for (const recipe of plan) {
      const page = await stale.newPage(); page.setDefaultTimeout(25_000);
      await observe('permission-mount-' + recipe.entity, () => page.goto(origin + recipe.path + '?q=' + encodeURIComponent(recipe.label), { waitUntil: 'domcontentloaded' }));
      const visibility = createCoreDomainVisibilityControl({page,recipe});
      await visibility.expectEnabled();
      assert.notEqual(new URL(page.url()).pathname, '/admin/login');
      const original = await visibility.readState(); assert.ok(original === 'true' || original === 'false');
      mounted.push({ recipe, page, visibility, original });
    }
    await observe('permission-real-session-revocation', () => revokeSession());
    const retained = await stale.cookies(origin);
    const originalCookie = signedState.cookies.find(cookie => cookie.name === 'venesia_admin_session');
    assert.ok(retained.find(cookie => cookie.name === 'venesia_admin_session')?.value === originalCookie.value, 'The mounted context must present the original signed cookie, not a cleared or fabricated token.');
    for (const { recipe, page, visibility, original } of mounted) await run('domain-' + recipe.entity + '-mounted-revoked-session-rejection', [], async () => {
      const startedAt = new Date().toISOString(), before = await checkpoint(output, recipe, startedAt);
      const dialog = page.locator('[data-admin-confirm-dialog]'),confirmationRequired=coreDomainVisibilityRequiresConfirmation(recipe,original);
      let posts = 0;
      const requests = request => { if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === new URL(recipe.path, origin).pathname) posts++; };
      page.on('request', requests);
      try {
        await visibility.expectState(original);
        if (confirmationRequired) {
          await visibility.invoke(); await expect(dialog).toHaveCount(1);
          await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0);
          await visibility.expectReturnedFocus();await visibility.expectState(original);
          assert.equal(posts, 0, 'Confirmation cancellation after revocation must still dispatch nothing.');
          await visibility.invoke(); await expect(dialog).toHaveCount(1);
        }
        const response = page.waitForResponse(value => value.request().method() === 'POST'
          && Boolean(value.request().headers()['next-action']) && new URL(value.request().url()).pathname === new URL(recipe.path, origin).pathname, { timeout: 30_000 });
        response.catch(() => {});
        await observe('permission-dispatch-' + recipe.entity, () => confirmationRequired ? dialog.locator('[data-admin-confirm-submit]').click() : visibility.invoke());
        const actual = await response;
        const denial = classifyCorePermissionDenial(actual.status(), await actual.allHeaders(), origin);
        assert.ok(denial, 'The actual command HTTP response must identify the existing login-denial destination.');
        // Retain the actual denied-command native pair even if a later UI assertion fails.
        const after = await checkpoint(output, recipe, startedAt);
        assert.deepEqual(after.rows, before.rows, 'A revoked-session command changed persisted state or revision.');
        assert.deepEqual(after.audit, before.audit, 'A revoked-session command appended or changed domain audit.');
        await expect.poll(async () => {
          if (new URL(page.url()).pathname === '/admin/login') return 'login';
          if (await page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').count()) return 'retained-rejected-or-unknown';
          return 'pending';
        }, { timeout: 30_000 }).not.toBe('pending');
        assert.equal(posts, 1, 'Exactly one real denied command may leave the mounted target.');

        const outcome = { entity: recipe.entity, id: recipe.id, mountedBeforeRevocation: true, retainedOriginalSignedCookie: true,
          confirmationCancelled: Boolean(confirmationRequired), deniedRealCommandPosts: posts, denial,
          nativeBefore: before.id, nativeAfter: after.id, persistedStateRevisionAndAuditUnchanged: true,
          visibleOutcome: new URL(page.url()).pathname === '/admin/login' ? 'login-navigation' : 'existing-rejected-or-unknown-feedback',
          boundary: 'Actual Auth/Proxy HTTP rejection of an already-mounted command; no claim that the domain Action ran or that role authorization policies changed.' };
        outcomes.push(outcome); return outcome;
      } catch (error) {
        // The driver's generic failure image belongs to its control page; capture this mounted target.
        const diagnostic={entity:recipe.entity,path:new URL(page.url()).pathname,expectedPath:new URL(recipe.path,origin).pathname,commandPosts:posts,
          loginFields:await page.locator('input[name="username"]').count(),feedbackEntries:await page.locator('[data-admin-feedback-entry]').count(),
          deniedFeedbackEntries:await page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').count(),
          beforeNativeId:before.id,proofBoundary:'Failure diagnostics only; neither screenshot nor selector counts establish persistence or acceptance.'};
        writeFileSync(join(output,'permission-target-'+recipe.entity+'-failure.json'),JSON.stringify(diagnostic,null,2));
        await page.screenshot({path:join(output,'permission-target-'+recipe.entity+'-failure.png'),fullPage:true});
        throw error;
      } finally { page.off('request', requests); }
    });
    return { outcomes, expectedDomains: plan.map(row => row.entity), sessionState: 'revoked',
      boundary: 'Control session is now logged out. Any authorized retry requires the existing real login owner; no credentials, roles or permissions are replaced.' };
  } finally { await stale.close(); }
}
