import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';

// Test recipes bind the current manifest to its existing presentation owners.
// These are not additional Product capabilities or a second domain registry.
const recipes = {
  content: { table: 'content_block_templates', filterId: 'content-blocks-status' },
  hero: { table: 'hero_templates', filterId: 'hero-status' },
  breadcrumb: { table: 'breadcrumb_block_templates', filterId: null },
  cards: { table: 'cards_block_templates', filterId: null },
  cta: { table: 'cta_block_templates', filterId: null },
  feed: { table: 'feed_module_templates', filterId: null },
  featured: { table: 'featured_module_templates', filterId: null },
  'media-hub': { table: 'media_hub_module_templates', filterId: 'media-hub-template-status' },
  'media-sidebar': { table: 'media_sidebar_module_templates', filterId: 'media-sidebar-template-status' },
};
const mediaKinds = new Set(['media-hub', 'media-sidebar']);
const visibilitySelector = id => '[data-admin-row-action="visibility"][data-admin-entity-id="' + id + '"] button';
const moreSelector = id => '[data-admin-row-action="more"][data-admin-entity-id="' + id + '"] button';

export function buildCoreTemplateLibraryPlan({ collectionAdoption, rowActions, fixtures }) {
  const surface = collectionAdoption.surfaces.find(row => row.id === 'block-template-libraries');
  assert.ok(surface && surface.queryMode === 'bounded-client');
  assert.deepEqual(surface.consumerAdoptionEvidence.map(row => row.id.replace(/-template-library$/, '')).sort(), Object.keys(recipes).sort(), 'Every current template library needs its own verification recipe.');
  const templates = fixtures?.pages?.templates;
  assert.ok(Array.isArray(templates));
  const bindings = rowActions.inlineStatusExtension.consumers.filter(row => row.dataMode === 'bounded-client');
  const identities = new Set();
  return surface.consumerAdoptionEvidence.map(declaration => {
    const kind = declaration.id.replace(/-template-library$/, ''), recipe = recipes[kind];
    assert.equal(declaration.route, '/admin/pages-blocks/blocks/' + kind);
    const binding = bindings.filter(row => row.entity === recipe.table);
    assert.equal(binding.length, 1); assert.equal(binding[0].publicationField, 'status');
    assert.equal(binding[0].consumerSourceFile, declaration.presentationOwner);
    const unused = templates.filter(row => row.kind === kind && row.assigned === false);
    const assigned = templates.filter(row => row.kind === kind && row.assigned === true);
    assert.ok(unused.length >= 2, 'Reserve a separate existing unused row after the Form fixture.');
    assert.equal(assigned.length, 1);
    const source = unused[1];
    for (const row of [source, assigned[0]]) {
      assert.ok(Number.isSafeInteger(row.id) && row.id > 0 && typeof row.name === 'string' && row.name && typeof row.slug === 'string' && row.slug);
      const identity = recipe.table + ':' + row.id;
      assert.ok(!identities.has(identity), 'Each physical template fixture must be distinct.'); identities.add(identity);
    }
    const terminal = !mediaKinds.has(kind);
    if (!terminal) assert.ok(declaration.genuineExceptions.some(value => /duplicate, and delete are not supported/.test(value)));
    return { kind, ...recipe, consumer: declaration.id, route: declaration.route, source, assigned: assigned[0], terminal,
      filterBoundary: recipe.filterId ? 'actual-status-filter' : 'disabled-no-filter-contract',
      knownSourceAuditGap: kind === 'content' ? ['publish', 'unpublish', 'duplicate', 'delete'] : [] };
  });
}

/** Selected library behavior only; every native audit expectation stays mandatory. */
export async function runCoreTemplateLibraryJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, nativeCheckpoint } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.ok(Array.isArray(databaseReadback) && typeof nativeCheckpoint === 'function');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const manifest = await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const plan = buildCoreTemplateLibraryPlan({ collectionAdoption: manifest.ADMIN_COLLECTION_SURFACE_ADOPTION,
    rowActions: manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION, fixtures });
  const outcomes = [], dialog = page.locator('[data-admin-confirm-dialog]');
  const isAction = request => request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).origin === origin;
  // Null-label commands need a concrete kind because template tables share
  // numeric IDs and the audit entity type. Missing content audit remains a gap.
  const metadata = recipe => ({ blockType: recipe.kind });
  async function navigate(recipe, query = recipe.source.name) {
    const leave = async nativeDialog => nativeDialog.type() === 'beforeunload' ? nativeDialog.accept() : nativeDialog.dismiss();
    page.on('dialog', leave);
    try { await observe('template-library-navigation', () => page.goto(origin + recipe.route + '?q=' + encodeURIComponent(query), { waitUntil: 'domcontentloaded' })); }
    finally { page.off('dialog', leave); }
  }
  const reload = () => observe('template-library-reload', () => page.reload({ waitUntil: 'domcontentloaded' }));
  async function menu(id, kind) {
    const more = page.locator(moreSelector(id)); await expect(more).toHaveCount(1, { timeout: 60_000 });
    if (await more.getAttribute('aria-expanded') !== 'true') await more.click();
    return page.locator('[data-admin-row-actions-menu][data-admin-entity-id="' + id + '"] [data-admin-row-action-menu-item="' + kind + '"]');
  }
  async function heldCommand(click, pendingProof) {
    const path = new URL(page.url()).pathname;
    let release, heldResolve, timer, routeError, requests = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const held = new Promise(resolve => { heldResolve = resolve; });
    const handler = async route => {
      const request = route.request();
      if (!isAction(request) || new URL(request.url()).pathname !== path) { await route.fallback(); return; }
      requests++; heldResolve(); await gate;
      try { await route.fallback(); } catch (error) { routeError = error; }
    };
    await page.route('**/*', handler);
    const response = actionResponse(); response.catch(() => {});
    const clicked = click(); clicked.catch(() => {});
    try {
      await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Template command did not reach its real request hold.')), 30_000); })]);
      await pendingProof(); assert.equal(requests, 1, 'Pending control must not dispatch a second command.'); release();
      assertActionAcknowledged(await response); await clicked;
    } finally { clearTimeout(timer); release(); await page.unrouteAll({ behavior: 'wait' }); }
    if (routeError) throw routeError;
    assert.equal(requests, 1); return requests;
  }
  async function statusFilter(recipe, label) {
    const trigger = page.locator('[data-admin-filter-trigger]'); await expect(trigger).toBeEnabled(); await trigger.click();
    const field = page.locator('[data-admin-filter-field="' + recipe.filterId + '"]'); await expect(field).toHaveCount(1);
    await field.getByRole('option', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click();
    await expect(field).toHaveCount(0);
  }
  async function confirmDelete(id, { cancelOnly = false } = {}) {
    const open = async () => { const item = await menu(id, 'delete'); await expect(item).toBeEnabled(); await item.click(); await expect(dialog).toHaveCount(1); };
    await open(); await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0);
    if (cancelOnly) return;
    await open();
    await heldCommand(() => dialog.locator('[data-admin-confirm-submit]').click(), async () => {
      const button = dialog.locator('[data-admin-confirm-submit]'); await expect(button).toBeDisabled();
      await expect(dialog.locator('[data-admin-confirm-cancel]')).toBeDisabled(); await button.evaluate(node => node.click());
    });
    await expect(dialog).toHaveCount(0, { timeout: 60_000 });
  }

  for (const recipe of plan) await run('template-library-' + recipe.kind + '-query-selection-visibility', [], async () => {
    const { source } = recipe, startedAt = new Date().toISOString(); let postCount = 0;
    const count = request => { if (isAction(request)) postCount++; }; page.on('request', count);
    try {
      await navigate(recipe);
      const visibility = page.locator(visibilitySelector(source.id)); await expect(visibility).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
      const search = page.locator('main input[type="search"]'); await expect(search).toHaveCount(1);
      await search.fill('no-template-match-' + randomUUID()); await expect(visibility).toHaveCount(0, { timeout: 60_000 });
      await search.fill(source.name); await expect(visibility).toHaveCount(1, { timeout: 60_000 });
      const checkbox = page.getByRole('checkbox', { name: 'تحديد ' + source.name, exact: true }); await checkbox.check();
      const bar = page.locator('[data-admin-bulk-action-bar]'); await expect(bar).toHaveCount(1);
      assert.deepEqual(await bar.locator('input[name="ids"]').evaluateAll(nodes => nodes.map(node => Number(node.value))), [source.id]);
      await bar.getByRole('button', { name: 'إلغاء التحديد', exact: true }).click(); await expect(checkbox).not.toBeChecked(); await expect(bar).toHaveCount(0);
      if (!recipe.filterId) await expect(page.locator('[data-admin-filter-trigger]')).toBeDisabled();
      if (!recipe.terminal) {
        await expect(await menu(source.id, 'duplicate')).toHaveCount(0); await expect(await menu(source.id, 'delete')).toHaveCount(0); await page.keyboard.press('Escape');
      }
      assert.equal(postCount, 0, 'Search, selection and declared unavailable controls must not dispatch writes.');
      await heldCommand(() => visibility.click(), async () => { await expect(visibility).toBeDisabled(); await visibility.evaluate(button => button.click()); });
      await expect(visibility).toHaveAttribute('aria-pressed', 'false'); await reload();
      await expect(visibility).toHaveAttribute('aria-pressed', 'false', { timeout: 60_000 });
      if (recipe.filterId) {
        await statusFilter(recipe, 'منشور'); await expect(visibility).toHaveCount(0, { timeout: 60_000 });
        await statusFilter(recipe, 'غير منشور'); await expect(visibility).toHaveCount(1, { timeout: 60_000 });
        await statusFilter(recipe, 'الكل'); await expect(visibility).toHaveCount(1);
      }
      await heldCommand(() => visibility.click(), async () => { await expect(visibility).toBeDisabled(); await visibility.evaluate(button => button.click()); });
      await expect(visibility).toHaveAttribute('aria-pressed', 'true'); await reload();
      await expect(visibility).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
      assert.equal(postCount, 2);
      databaseReadback.push({ table: recipe.table, id: source.id, expected: { name: source.name, status: 'published' },
        auditEntityType: 'content_block_template', auditEntityLabel: null, auditActions: ['content_block_template.publish', 'content_block_template.unpublish'],
        auditMetadata: metadata(recipe), auditSince: startedAt, exactAuditCount: 2 });
      const result = { consumer: recipe.consumer, kind: recipe.kind, id: source.id, queryExcludedAndRestored: true,
        exactSelectionCleared: true, filterBoundary: recipe.filterBoundary, statusFilterExcludedAndIncluded: Boolean(recipe.filterId),
        twoActualWrites: postCount, pendingDuplicateBlocked: true, freshReloads: 2, nativeAuditRequired: true,
        knownSourceAuditGap: recipe.knownSourceAuditGap.filter(action => ['publish', 'unpublish'].includes(action)),
        boundary: 'Selected collection/row behavior; selection does not prove bulk execution and unavailable filters do not prove filtering.' };
      outcomes.push(result); return result;
    } finally { page.off('request', count); }
  });

  for (const recipe of plan.filter(row => row.terminal)) await run('template-library-' + recipe.kind + '-duplicate-delete', [], async () => {
    const startedAt = new Date().toISOString(); await navigate(recipe);
    const ids = () => page.locator('[data-admin-row-action="more"][data-admin-entity-id]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-admin-entity-id'))).sort((a, b) => a - b));
    await expect(page.locator(moreSelector(recipe.source.id))).toHaveCount(1, { timeout: 60_000 });
    const before = await ids(); assert.deepEqual(before, [recipe.source.id], 'The reserved source name must identify exactly one physical row.');
    const duplicate = await menu(recipe.source.id, 'duplicate'); await expect(duplicate).toBeEnabled();
    await heldCommand(() => duplicate.click(), async () => {
      const pending = await menu(recipe.source.id, 'duplicate'); await expect(pending).toBeDisabled(); await pending.evaluate(button => button.click()); await page.keyboard.press('Escape');
    });
    await reload(); await expect.poll(async () => (await ids()).filter(id => !before.includes(id)).length, { timeout: 60_000 }).toBe(1);
    const cloneId = (await ids()).find(id => !before.includes(id)); assert.ok(Number.isSafeInteger(cloneId) && cloneId > 0);
    const cloneName = recipe.source.name + ' - نسخة';
    await expect(page.getByRole('link', { name: cloneName, exact: true })).toHaveAttribute('href', recipe.route + '/' + cloneId);
    await expect(page.locator(visibilitySelector(cloneId))).toHaveAttribute('aria-pressed', 'false');
    let deletePosts = 0; const count = request => { if (isAction(request)) deletePosts++; }; page.on('request', count);
    try { await confirmDelete(cloneId); assert.equal(deletePosts, 1, 'Cancel plus one confirmed delete may dispatch exactly once.'); }
    finally { page.off('request', count); }
    await reload(); await expect(page.locator(moreSelector(cloneId))).toHaveCount(0);
    await expect(page.locator(moreSelector(recipe.source.id))).toHaveCount(1);
    databaseReadback.push({ table: recipe.table, id: cloneId, deleted: true, expected: {}, auditEntityType: 'content_block_template',
      auditEntityLabel: cloneName, auditActions: ['content_block_template.duplicate'], auditMetadata: { ...metadata(recipe), sourceId: recipe.source.id }, auditSince: startedAt, exactAuditCount: 1 });
    databaseReadback.push({ table: recipe.table, id: cloneId, deleted: true, expected: {}, auditEntityType: 'content_block_template',
      auditEntityLabel: null, auditActions: ['content_block_template.delete'], auditMetadata: metadata(recipe), auditSince: startedAt, exactAuditCount: 1 });
    const result = { consumer: recipe.consumer, sourceId: recipe.source.id, cloneId, cloneName,
      onePhysicalCloneAfterReload: true, cloneUnpublished: true, deleteCancelledThenConfirmed: true,
      pendingDuplicateBlocked: true, deletedCloneAbsentAfterReload: true, originalPreserved: true, nativeAuditRequired: true,
      knownSourceAuditGap: recipe.knownSourceAuditGap.filter(action => ['duplicate', 'delete'].includes(action)),
      boundary: 'Only the newly created unassigned clone is deleted; no assigned cascade or global delete is attempted.' };
    outcomes.push(result); return result;
  });

  await run('template-library-assigned-delete-cancellation-preserves-native-state', [], async () => {
    const correlationId = randomUUID();
    async function fingerprint(phase) {
      const request = { id: randomUUID(), kind: 'form-permission-fingerprint', correlationId, phase };
      const result = await nativeCheckpoint(request);
      for (const key of ['id', 'kind', 'correlationId', 'phase']) assert.equal(result[key], request[key]);
      assert.equal(result.status, 'pass'); assert.ok(typeof result.ownedRunId === 'string' && result.ownedRunId);
      assert.ok(result.publicTableCount > 0 && result.adminAuditIncluded && result.adminUsersIncluded);
      for (const key of ['publicTableInventorySha256', 'publicDataSha256']) assert.match(result[key], /^[a-f0-9]{64}$/);
      return result;
    }
    const before = await fingerprint('before'); let posts = 0;
    const count = request => { if (isAction(request)) posts++; }; page.on('request', count);
    const cancelled = [];
    try {
      for (const recipe of plan.filter(row => row.terminal)) {
        await navigate(recipe, recipe.assigned.name); await expect(page.locator(moreSelector(recipe.assigned.id))).toHaveCount(1, { timeout: 60_000 });
        await confirmDelete(recipe.assigned.id, { cancelOnly: true });
        await reload(); await expect(page.locator(moreSelector(recipe.assigned.id))).toHaveCount(1, { timeout: 60_000 });
        cancelled.push({ kind: recipe.kind, id: recipe.assigned.id });
      }
      assert.equal(posts, 0);
    } finally { page.off('request', count); }
    const after = await fingerprint('after');
    for (const key of ['ownedRunId', 'publicTableCount', 'publicTableInventorySha256', 'publicDataSha256']) assert.equal(after[key], before[key]);
    const result = { cancelled, posts, nativeBefore: before.id, nativeAfter: after.id, completePublicStateUnchanged: true,
      boundary: 'Cancellation preserves assigned templates and all public rows. Existing cascade deletion is not an in-use rejection contract.' };
    outcomes.push(result); return result;
  });
  return { outcomes, consumers: plan.map(row => ({ id: row.consumer, filterBoundary: row.filterBoundary, terminalSupported: row.terminal })),
    globalClosed: false, nativeAuditReadbackRequired: true,
    boundary: 'Actual selected template-library journeys only. Native audits, unsupported filters, server rejection, bulk execution and complete capability axes remain separately qualified.' };
}
