import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';
import { buildCoreDomainCommandPlan } from './admin-core-domain-command-journeys.mjs';

const trashEntities = new Set(['topics', 'categories', 'series']);
const moreSelector = id => '[data-admin-row-action="more"][data-admin-entity-id="' + id + '"] button';

async function nativeProbe(output, request) {
  const id = randomUUID(), temporary = join(output, 'core-native-request-' + id + '.tmp');
  writeFileSync(temporary, JSON.stringify({ id, ...request }));
  renameSync(temporary, join(output, 'core-native-request-' + id + '.json'));
  const destination = join(output, 'core-native-response-' + id + '.json'), deadline = Date.now() + 30_000;
  while (!existsSync(destination)) {
    if (Date.now() >= deadline) throw new Error('The fixed terminal native checkpoint did not arrive.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const result = JSON.parse(readFileSync(destination, 'utf8'));
  assert.equal(result.id, id); assert.equal(result.kind, request.kind); assert.equal(result.entity, request.entity); assert.equal(result.status, 'pass');
  return result;
}

export function buildCoreTerminalCommandPlan({ rowActions, fixtures, paths }) {
  assert.ok(fixtures.terminalClosure, 'Independent owned terminal fixtures protect prior command readbacks.');
  const plan = buildCoreDomainCommandPlan({ rowActions, fixtures: { ...fixtures, commandClosure: fixtures.terminalClosure }, paths });
  const priorPlan = buildCoreDomainCommandPlan({ rowActions, fixtures, paths });
  for (const row of plan.filter(recipe => !recipe.declaredMutations.includes('duplicate'))) {
    assert.notEqual(row.id, priorPlan.find(prior => prior.entity === row.entity).id, 'Terminal rows must be distinct before any destructive command.');
  }
  return plan;
}

async function terminalTools(ctx) {
  const { page, origin, output, fixtures, observe, actionResponse, assertActionAcknowledged } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const manifest = await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const location = await jiti.import('../../src/lib/admin/projects/location-management-contract.ts');
  const tracking = await jiti.import('../../src/lib/admin/projects/tracking-contract.ts');
  const plan = buildCoreTerminalCommandPlan({ rowActions: manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,
    fixtures, paths: { ...location, ...tracking } });
  const dialog = page.locator('[data-admin-confirm-dialog]');
  const pathname = () => new URL(page.url()).pathname;
  const navigate = async (recipe, trash = false) => observe('terminal-open-' + recipe.entity + (trash ? '-trash' : '-active'),
    () => page.goto(origin + recipe.path + '?q=' + encodeURIComponent(recipe.label) + (trash ? '&view=trash' : ''), { waitUntil: 'domcontentloaded' }));
  const probe = (recipe, ids, startedAt) => nativeProbe(output, { kind: 'terminal-domain-state', entity: recipe.entity, ids, startedAt });
  const trashSet = recipe => nativeProbe(output, { kind: 'terminal-trash-set', entity: recipe.entity });
  async function menu(recipe, id, kind) {
    const trigger = page.locator(moreSelector(id)); await expect(trigger).toHaveCount(1, { timeout: 60_000 });
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    const item = page.locator('[data-admin-row-actions-menu][data-admin-entity-id="' + id + '"] [data-admin-row-action-menu-item="' + kind + '"]');
    await expect(item).toHaveCount(1); return item;
  }
  async function confirmed(trigger, { cancelFirst = true, reject = false, retryRejected = false } = {}) {
    await trigger(); await expect(dialog).toHaveCount(1);
    if (cancelFirst) {
      let posts = 0;
      const count = request => { if (request.method() === 'POST' && request.headers()['next-action']) posts++; };
      page.on('request', count);
      try { await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0); assert.equal(posts, 0); }
      finally { page.off('request', count); }
      await trigger(); await expect(dialog).toHaveCount(1);
    }
    const attempts = reject && retryRejected ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      await heldCommand(() => dialog.locator('[data-admin-confirm-submit]').click(), async () => {
        const confirm = dialog.locator('[data-admin-confirm-submit]');
        await expect(confirm).toBeDisabled(); await expect(dialog.locator('[data-admin-confirm-cancel]')).toBeDisabled();
        await confirm.evaluate(button => button.click());
      });
      if (reject) {
        await expect(dialog).toHaveCount(1); await expect(dialog.locator('[data-admin-confirm-submit]')).toBeEnabled();
        await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();
      } else await expect(dialog).toHaveCount(0, { timeout: 60_000 });
    }
    if (reject) { await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0); }
    return { cancelledBeforeCommit: cancelFirst, pendingDuplicateBlocked: true, attempts, rejected: reject };
  }
  async function heldCommand(click, pendingProof) {
    const currentPath = pathname(); let release, sawHeld, timer, routeFailure, count = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const held = new Promise(resolve => { sawHeld = resolve; });
    const routeHandler = async route => {
      const request = route.request();
      if (request.method() !== 'POST' || !request.headers()['next-action'] || new URL(request.url()).pathname !== currentPath) { await route.fallback(); return; }
      count++; sawHeld(); await gate;
      try { await route.fallback(); } catch (error) { routeFailure = error; }
    };
    const removeRoute = await registerCorePageRoute(page, '**/*', routeHandler);
    const response = actionResponse(); response.catch(() => {});
    const clicking = click(); clicking.catch(() => {});
    try {
      await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The terminal action did not reach its actual request hold.')), 30_000); })]);
      await pendingProof(); assert.equal(count, 1, 'Pending activation must not submit a duplicate terminal command.'); release();
      const actual = await response; assertActionAcknowledged(actual); await clicking;
      if (routeFailure) throw routeFailure;
      assert.equal(count, 1);
    } finally { clearTimeout(timer); release(); await removeRoute(); }
  }
  async function rowCommand(recipe, id, kind, options) {
    return confirmed(async () => { const item = await menu(recipe, id, kind); await expect(item).toBeEnabled(); await item.click(); }, options);
  }
  async function duplicate(recipe, startedAt) {
    await navigate(recipe);
    const ids = async () => (await page.locator('[data-admin-row-action="more"][data-admin-entity-id]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-admin-entity-id'))))).sort((a, b) => a - b);
    await expect(page.locator(moreSelector(recipe.id))).toHaveCount(1, { timeout: 60_000 });
    const before = await ids(); assert.ok(before.length < 10, 'The authored clone source query must fit one visible page.');
    const item = await menu(recipe, recipe.id, 'duplicate'); await expect(item).toBeEnabled();
    await heldCommand(() => item.click(), async () => {
      const disabled = await menu(recipe, recipe.id, 'duplicate'); await expect(disabled).toBeDisabled();
      await disabled.evaluate(button => button.click()); await page.keyboard.press('Escape');
    });
    await observe('terminal-clone-reload', () => page.reload({ waitUntil: 'domcontentloaded' }));
    await expect.poll(async () => (await ids()).filter(id => !before.includes(id)).length, { timeout: 60_000 }).toBe(1);
    const id = (await ids()).find(value => !before.includes(value));
    assert.ok(id && id !== recipe.id);
    const persisted = await probe(recipe, [id], startedAt); assert.equal(persisted.rows.length, 1); assert.equal(Number(persisted.rows[0].id), id);
    const duplicateAction = recipe.entity === 'pages' ? 'page_composition.duplicate_page' : recipe.audit + '.duplicate';
    assert.equal(persisted.audit.filter(row => row.action === duplicateAction).length, 1);
    return { id, duplicateAction, native: persisted.id };
  }
  async function emptyCancel(recipe) {
    await navigate(recipe, true);
    const empty = page.getByRole('button', { name: 'إفراغ المحذوفات', exact: true });
    await expect(empty).toBeEnabled();
    const before = await trashSet(recipe);
    let posts = 0; const count = request => { if (request.method() === 'POST' && request.headers()['next-action']) posts++; };
    page.on('request', count);
    try {
      await empty.click(); await expect(dialog).toHaveCount(1); await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0);
      await expect(empty).toBeFocused(); assert.equal(posts, 0);
    } finally { page.off('request', count); }
    const after = await trashSet(recipe); assert.deepEqual(after.ids, before.ids);
    return { completeTrashCount: before.ids.length, confirmationCancelled: true, globalTrashSetPreserved: true };
  }
  return { plan, navigate, probe, trashSet, menu, rowCommand, duplicate, emptyCancel, heldCommand, confirmed, dialog };
}

export async function runCoreDomainTerminalJourneys(ctx) {
  const { page, run, observe, databaseReadback, fixtures } = ctx;
  const t = await terminalTools(ctx), outcomes = [];
  const cloneRecipes = t.plan.filter(recipe => recipe.declaredMutations.includes('duplicate'));
  assert.deepEqual(cloneRecipes.filter(recipe => recipe.declaredMutations.includes('archive')).map(row => row.entity).sort(), [...trashEntities].sort(), 'Every declared archive here is the actual Trash restore contract.');
  // The linked Category's lifecycle has an actual server-side relation guard.
  await run('terminal-category-linked-rejection-retry', [], async () => {
    const recipe = t.plan.find(row => row.entity === 'categories'), startedAt = new Date().toISOString();
    await t.navigate(recipe); const before = await t.probe(recipe, [recipe.id], startedAt);
    const confirmation = await t.rowCommand(recipe, recipe.id, 'delete', { reject: true, retryRejected: true });
    const after = await t.probe(recipe, [recipe.id], startedAt);
    assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.audit, before.audit);
    await observe('terminal-rejected-category-reload', () => page.reload({ waitUntil: 'domcontentloaded' }));
    await expect(page.locator(moreSelector(recipe.id))).toHaveCount(1);
    return { entity: recipe.entity, id: recipe.id, confirmation, nativeBefore: before.id, nativeAfter: after.id, dependencyRejectionPreservedRecordAndAudit: true };
  });
  for (const recipe of cloneRecipes) await run('terminal-' + recipe.entity + '-duplicate-lifecycle', [], async () => {
    const startedAt = new Date().toISOString(), copy = await t.duplicate(recipe, startedAt), actions = [copy.duplicateAction], steps = [copy];
    if (recipe.declaredMutations.includes('featured')) {
      const featured = page.locator('[data-admin-row-action="featured"][data-admin-entity-id="' + copy.id + '"] button');
      await expect(featured).toBeEnabled(); const original = await featured.getAttribute('aria-pressed'); assert.ok(['true', 'false'].includes(original));
      for (const expected of [original === 'true' ? 'false' : 'true', original]) {
        await t.heldCommand(() => featured.click(), async () => { await expect(featured).toBeDisabled(); await featured.evaluate(button => button.click()); });
        await observe('terminal-feature-reload', () => page.reload({ waitUntil: 'domcontentloaded' }));
        await expect(featured).toHaveAttribute('aria-pressed', expected, { timeout: 60_000 });
        const native = await t.probe(recipe, [copy.id], startedAt); assert.equal(native.rows[0][recipe.entity === 'topics' ? 'is_featured' : 'featured'], expected === 'true');
        steps.push({ operation: 'featured', native: native.id, expected: expected === 'true' }); actions.push(recipe.audit + '.update');
      }
    }
    if (trashEntities.has(recipe.entity)) {
      for (const operation of ['trash', 'restore', 'trash', 'purge']) {
        const inTrash = operation === 'restore' || operation === 'purge'; await t.navigate(recipe, inTrash);
        await t.rowCommand(recipe, copy.id, operation === 'restore' ? 'archive' : 'delete');
        await observe('terminal-lifecycle-reload', () => page.reload({ waitUntil: 'domcontentloaded' }));
        await expect(page.locator(moreSelector(copy.id))).toHaveCount(0);
        const native = await t.probe(recipe, [copy.id], startedAt);
        if (operation === 'purge') assert.equal(native.rows.length, 0);
        else {
          assert.equal(native.rows.length, 1); assert.equal(Boolean(native.rows[0].deleted_at), operation === 'trash');
          if (operation === 'restore') assert.equal(native.rows[0].status, 'unpublished');
        }
        const verb = operation === 'trash' ? 'delete' : operation === 'purge' ? 'permanent_delete' : 'restore';
        actions.push(recipe.audit + '.' + verb); steps.push({ operation, native: native.id });
        if (operation === 'trash' && steps.filter(step => step.operation === 'trash').length === 1) steps.push({ operation: 'empty-trash-cancel', ...await t.emptyCancel(recipe) });
      }
    } else {
      await t.navigate(recipe); await t.rowCommand(recipe, copy.id, 'delete');
      await observe('terminal-delete-reload', () => page.reload({ waitUntil: 'domcontentloaded' })); await expect(page.locator(moreSelector(copy.id))).toHaveCount(0);
      actions.push(recipe.audit + '.delete');
    }
    const final = await t.probe(recipe, [copy.id], startedAt); assert.equal(final.rows.length, 0);
    assert.deepEqual(final.audit.map(row => row.action).sort(), [...actions].sort());
    assert.ok(final.audit.every(row => row.actor_admin_user_id !== null));
    databaseReadback.push({ table: recipe.table, id: copy.id, deleted: true, expected: {}, auditSince: startedAt,
      auditEntityTypes: recipe.entity === 'pages' ? ['page', 'page_composition'] : [recipe.audit], auditActions: [...new Set(actions)], exactAuditCount: actions.length });
    const outcome = { entity: recipe.entity, sourceId: recipe.id, cloneId: copy.id, steps, nativeFinal: final.id, auditActions: actions,
      coveredCommands: recipe.declaredMutations.filter(kind => kind !== 'visibility'), originalPreserved: true, clonedTargetDeleted: true };
    outcomes.push(outcome); return outcome;
  });
  // Child safety is observed before success in the required deletion order.
  const direct = t.plan.filter(recipe => !recipe.declaredMutations.includes('duplicate'));
  for (const entity of ['project_tracking_stages', 'project_tracking_items']) await run('terminal-' + entity + '-child-guard', [], async () => {
    const recipe = direct.find(row => row.entity === entity), startedAt = new Date().toISOString();
    await t.navigate(recipe); const before = await t.probe(recipe, [recipe.id], startedAt);
    const disabled = await t.menu(recipe, recipe.id, 'delete'); await expect(disabled).toBeDisabled();
    let posts = 0; const count = request => { if (request.method() === 'POST' && request.headers()['next-action']) posts++; }; page.on('request', count);
    try { await disabled.evaluate(button => button.click()); assert.equal(posts, 0); await page.keyboard.press('Escape'); } finally { page.off('request', count); }
    const after = await t.probe(recipe, [recipe.id], startedAt); assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.audit, before.audit);
    return { entity, id: recipe.id, actualChildGuardDisabled: true, nativeBefore: before.id, nativeAfter: after.id };
  });
  const rank = entity => ({ project_tracking_updates: 0, project_tracking_items: 1, project_tracking_stages: 2 })[entity] ?? 3;
  for (const recipe of [...direct].sort((a, b) => rank(a.entity) - rank(b.entity))) await run('terminal-' + recipe.entity + '-delete', [], async () => {
    const startedAt = new Date().toISOString(); await t.navigate(recipe);
    const before = await t.probe(recipe, [recipe.id], startedAt); assert.equal(before.rows.length, 1);
    const confirmation = await t.rowCommand(recipe, recipe.id, 'delete');
    await observe('terminal-direct-delete-reload', () => page.reload({ waitUntil: 'domcontentloaded' })); await expect(page.locator(moreSelector(recipe.id))).toHaveCount(0);
    const after = await t.probe(recipe, [recipe.id], startedAt); assert.equal(after.rows.length, 0);
    const action = recipe.entity === 'admin_users' ? 'admin_user.deleted' : recipe.audit.startsWith('project_tracking_') ? 'project_children.delete' : recipe.audit + '.delete';
    assert.deepEqual(after.audit.map(row => row.action), [action]); assert.ok(after.audit[0].actor_admin_user_id !== null);
    databaseReadback.push({ table: recipe.table, id: recipe.id, deleted: true, expected: {}, auditEntityTypes: [recipe.audit], auditActions: [action], auditSince: startedAt, exactAuditCount: 1 });
    const outcome = { entity: recipe.entity, id: recipe.id, confirmation, nativeBefore: before.id, nativeAfter: after.id, domainDeleteCommitted: true,
      dependencyOrder: recipe.audit.startsWith('project_tracking_') ? 'update then item then stage, after guarded parents were observed' : null };
    outcomes.push(outcome); return outcome;
  });
  assert.equal(fixtures.terminalClosure.adminUser.id !== fixtures.commandClosure.adminUser.id, true, 'Terminal Auth fixture must be distinct from the prior visibility fixture.');
  return { outcomes, globalEmptyTrash: 'Only confirmation cancellation here; successful global command belongs to a separate complete-trash-set cohort.' };
}

/** Separate owned cohort: no Preview trash may be present or be silently scoped out. */
export async function runCoreEmptyTrashSuccessJourneys(ctx) {
  const { page, run, observe, databaseReadback } = ctx, t = await terminalTools(ctx), outcomes = [];
  for (const recipe of t.plan.filter(row => trashEntities.has(row.entity))) await run('terminal-' + recipe.entity + '-global-empty-trash', [], async () => {
    const startedAt = new Date().toISOString(), initial = await t.trashSet(recipe); assert.deepEqual(initial.ids, [], 'Success cohort must start with no pre-existing Trash rows.');
    const copies = [];
    for (let index = 0; index < 2; index++) {
      const copy = await t.duplicate(recipe, startedAt); copies.push(copy.id); await t.rowCommand(recipe, copy.id, 'delete');
      const native = await t.probe(recipe, [copy.id], startedAt); assert.equal(native.rows.length, 1); assert.ok(native.rows[0].deleted_at);
    }
    const complete = await t.trashSet(recipe); assert.deepEqual(complete.ids.map(Number).sort((a, b) => a - b), [...copies].sort((a, b) => a - b), 'Actual global trash set must exactly equal the owned disposable IDs.');
    const cancelled = await t.emptyCancel(recipe);
    const empty = page.getByRole('button', { name: 'إفراغ المحذوفات', exact: true });
    await empty.click(); await expect(t.dialog).toHaveCount(1);
    // The primary dialog has captured count=2. A second real authenticated tab
    // changes the actual complete trash set through the ordinary commands.
    const secondPage = await page.context().newPage();
    try {
      const second = await terminalTools({ ...ctx, page: secondPage, actionResponse: () => ctx.actionResponse(secondPage) });
      const third = await second.duplicate(recipe, startedAt); copies.push(third.id);
      await second.rowCommand(recipe, third.id, 'delete');
    } finally { await secondPage.close(); }
    const changed = await t.trashSet(recipe);
    assert.deepEqual(changed.ids.map(Number).sort((a, b) => a - b), [...copies].sort((a, b) => a - b));
    const beforeRejection = await t.probe(recipe, copies, startedAt);
    await t.heldCommand(() => t.dialog.locator('[data-admin-confirm-submit]').click(), async () => {
      const submit = t.dialog.locator('[data-admin-confirm-submit]'); await expect(submit).toBeDisabled(); await submit.evaluate(button => button.click());
    });
    await expect(t.dialog).toHaveCount(1); await expect(t.dialog.locator('[data-admin-confirm-submit]')).toBeEnabled();
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
    const afterRejection = await t.probe(recipe, copies, startedAt);
    assert.deepEqual(afterRejection.rows, beforeRejection.rows); assert.deepEqual(afterRejection.audit, beforeRejection.audit);
    await t.dialog.locator('[data-admin-confirm-cancel]').click(); await expect(t.dialog).toHaveCount(0);
    await t.navigate(recipe, true);
    await t.confirmed(() => empty.click(), { cancelFirst: false });
    await observe('global-empty-trash-reload', () => page.reload({ waitUntil: 'domcontentloaded' })); await expect(empty).toBeDisabled();
    const afterSet = await t.trashSet(recipe); assert.deepEqual(afterSet.ids, []);
    const after = await t.probe(recipe, copies, startedAt); assert.equal(after.rows.length, 0);
    // Batch audit identity is aggregate (entity_id may be null); native control
    // includes fixed topic/category/series ID-array metadata for these targets.
    const permanent = after.audit.filter(row => row.action === recipe.audit + '.permanent_delete');
    assert.equal(permanent.length, 1); assert.ok(permanent[0].actor_admin_user_id !== null);
    assert.deepEqual(after.audit.map(row => row.action).sort(), [...copies.flatMap(() => [recipe.audit + '.duplicate', recipe.audit + '.delete']), recipe.audit + '.permanent_delete'].sort());
    for (const id of copies) databaseReadback.push({ table: recipe.table, id, deleted: true, expected: {}, auditEntityTypes: [recipe.audit],
      auditActions: [recipe.audit + '.duplicate', recipe.audit + '.delete', recipe.audit + '.permanent_delete'], auditSince: startedAt,
      aggregateAuditIds: [permanent[0].id] });
    const outcome = { entity: recipe.entity, ownedIds: copies, nativeCompleteTrash: changed.id, initialTwoRowTrash: complete.id, cancellation: cancelled,
      staleCountRejected: true, nativeBeforeRejection: beforeRejection.id, nativeAfterRejection: afterRejection.id, freshCountRetrySucceeded: true,
      nativeEmptyTrash: afterSet.id, nativeRowsAndAudit: after.id, globalCommandReallyExecuted: true, expectedCount: copies.length };
    outcomes.push(outcome); return outcome;
  });
  return { outcomes, boundary: 'Real authenticated global EmptyTrash over a native-confirmed complete disposable set, with no Preview or unrelated trash present.' };
}
