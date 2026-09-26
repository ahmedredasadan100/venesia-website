import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';

// Verification recipes are checked against the current authoritative manifest.
// They do not declare Product capabilities or replace any mutation owner.
const recipes = {
  topics: { table: 'topics', state: 'status', values: ['published', 'unpublished'], audit: 'topic' },
  categories: { table: 'topic_categories', state: 'status', values: ['published', 'unpublished'], audit: 'topic_category' },
  series: { table: 'topic_series', state: 'status', values: ['published', 'unpublished'], audit: 'topic_series' },
  pages: { table: 'pages', state: 'status', values: ['published', 'unpublished'], audit: 'page' },
  projects: { table: 'projects', state: 'publication_status', values: ['published', 'unpublished'], audit: 'project' },
  project_locations_governorate: { table: 'project_locations', state: 'is_active', values: [true, false], audit: 'project_location', confirmVisibility: true },
  project_locations_city: { table: 'project_locations', state: 'is_active', values: [true, false], audit: 'project_location', confirmVisibility: true },
  project_locations_main_area: { table: 'project_locations', state: 'is_active', values: [true, false], audit: 'project_location', confirmVisibility: true },
  project_locations_sub_area: { table: 'project_locations', state: 'is_active', values: [true, false], audit: 'project_location', confirmVisibility: true },
  project_tracking_stages: { table: 'project_tracking_stages', state: 'is_visible', values: [true, false], audit: 'project_tracking_stage' },
  project_tracking_items: { table: 'project_tracking_items', state: 'is_visible', values: [true, false], audit: 'project_tracking_item' },
  project_tracking_updates: { table: 'project_tracking_updates', state: 'publication_status', values: ['published', 'draft'], audit: 'project_tracking_update' },
  redirects: { table: 'url_redirects', state: 'status', values: ['active', 'inactive'], audit: 'redirect', preDispatchFailure: true },
  admin_users: { table: 'admin_users', state: 'is_active', values: [true, false], audit: 'admin_user', confirmVisibility: true },
};

export function buildCoreDomainCommandPlan({ rowActions, fixtures, paths }) {
  assert.ok(Array.isArray(rowActions.entities));
  const entities = rowActions.entities.filter(row => Object.entries(row.actions).some(([kind, state]) =>
    ['visibility', 'featured', 'duplicate', 'archive', 'delete'].includes(kind) && state === 'adopted'));
  assert.deepEqual(entities.map(row => row.entity).sort(), Object.keys(recipes).sort(), 'Every current mutating Data/RowActions domain needs an explicit verification recipe.');
  const closure = fixtures.commandClosure;
  assert.ok(closure && Array.isArray(closure.locations) && closure.tracking && closure.redirect && closure.adminUser, 'Owned command fixtures are required.');
  const tracking = closure.tracking;
  const source = {
    topics: { ...fixtures.topic, label: fixtures.topic.title, path: '/admin/content/topics' },
    categories: { ...fixtures.category, label: fixtures.category.name, path: '/admin/content/categories' },
    series: { ...fixtures.series, label: fixtures.series.name, path: '/admin/content/series' },
    pages: { id: fixtures.pages.pageId, label: fixtures.pages.title, path: '/admin/pages-blocks/pages' },
    projects: { ...fixtures.project, label: fixtures.project.title, path: fixtures.project.listPath },
    project_tracking_stages: { ...tracking.stage, path: paths.trackingProjectPath(tracking.projectId) },
    project_tracking_items: { ...tracking.item, path: paths.trackingStagePath(tracking.projectId, tracking.stage.id) },
    project_tracking_updates: { ...tracking.update, path: paths.trackingItemPath(tracking.projectId, tracking.item.id) },
    redirects: { ...closure.redirect, path: '/admin/seo/redirects' },
    admin_users: { ...closure.adminUser, path: '/admin/users-roles' },
  };
  assert.equal(closure.locations.length, Object.keys(recipes).filter(key => key.startsWith('project_locations_')).length);
  for (const location of closure.locations) {
    assert.equal(location.entity, 'project_locations_' + location.level);
    assert.ok(recipes[location.entity] && !source[location.entity], 'Location fixtures must name one distinct supported level.');
    source[location.entity] = { ...location, path: paths.projectLocationManagementPath(location.level) };
  }
  const physical = new Set();
  return entities.map(declaration => {
    const fixture = source[declaration.entity], recipe = recipes[declaration.entity];
    assert.equal(declaration.actions.visibility, 'adopted');
    assert.ok(fixture && Number.isSafeInteger(Number(fixture.id)) && Number(fixture.id) > 0);
    assert.ok(typeof fixture.label === 'string' && fixture.label.trim());
    assert.ok(typeof fixture.path === 'string' && fixture.path.startsWith('/admin/'));
    const identity = recipe.table + ':' + fixture.id;
    assert.ok(!physical.has(identity), 'Each domain proof must identify its own native fixture row.'); physical.add(identity);
    return { entity: declaration.entity, ...recipe, ...fixture, id: Number(fixture.id),
      declaredMutations: Object.entries(declaration.actions).filter(([kind, state]) => ['visibility', 'featured', 'duplicate', 'archive', 'delete'].includes(kind) && state === 'adopted').map(([kind]) => kind),
      declaredConfirmations: declaration.confirmationActions };
  });
}

export async function runCoreDomainCommandJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const manifest = await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const location = await jiti.import('../../src/lib/admin/projects/location-management-contract.ts');
  const tracking = await jiti.import('../../src/lib/admin/projects/tracking-contract.ts');
  const plan = buildCoreDomainCommandPlan({ rowActions: manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION, fixtures,
    paths: { projectLocationManagementPath: location.projectLocationManagementPath, trackingProjectPath: tracking.trackingProjectPath,
      trackingStagePath: tracking.trackingStagePath, trackingItemPath: tracking.trackingItemPath } });
  const outcomes = [];
  for (const recipe of plan) await run('domain-' + recipe.entity + '-visibility-command-reload-audit', [], async () => {
    const startedAt = new Date().toISOString();
    await observe('domain-open-' + recipe.entity, () => page.goto(origin + recipe.path + '?q=' + encodeURIComponent(recipe.label), { waitUntil: 'domcontentloaded' }));
    const visibility = page.locator('[data-admin-row-action="visibility"][data-admin-entity-id="' + recipe.id + '"] button');
    await expect(visibility).toHaveCount(1, { timeout: 60_000 }); await expect(visibility).toBeEnabled({ timeout: 60_000 });
    const original = await visibility.getAttribute('aria-pressed');
    assert.ok(original === 'true' || original === 'false');
    const originalState = recipe.values[original === 'true' ? 0 : 1];
    const dialog = page.locator('[data-admin-confirm-dialog]');
    const posts = [];
    const trackPost = request => {
      if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === recipe.path) posts.push(request.url());
    };
    page.on('request', trackPost);
    let confirmationCancelled = false, rollbackRetried = false, pendingDedup = false;
    try {
      if (recipe.confirmVisibility) {
        await observe('domain-confirmation-cancel', async () => {
          await visibility.click(); await expect(dialog).toHaveCount(1);
          await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0);
          await expect(visibility).toBeFocused(); await expect(visibility).toHaveAttribute('aria-pressed', original);
          assert.equal(posts.length, 0, 'Cancelled confirmation must not dispatch a command.'); confirmationCancelled = true;
        });
      }
      if (recipe.preDispatchFailure) {
        let aborted = 0;
        const rejectBeforeDispatch = async route => {
          const request = route.request();
          if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === recipe.path) {
            aborted++; await route.abort('failed');
          } else await route.fallback();
        };
        await page.route('**/*', rejectBeforeDispatch);
        try {
          await observe('domain-real-client-pre-dispatch-failure', () => visibility.click());
          await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible({ timeout: 60_000 });
          await expect(visibility).toHaveAttribute('aria-pressed', original); await expect(visibility).toBeEnabled();
          assert.equal(aborted, 1, 'Exactly one actual request must be rejected before it reaches the server.');
        } finally { await page.unrouteAll({ behavior: 'wait' }); }
        rollbackRetried = true;
      }
      for (const [index, expected] of [[0, original === 'true' ? 'false' : 'true'], [1, original]]) {
        // The first actual request is held before dispatch so pending ownership
        // and disabled duplicate activation are observed without fake responses.
        let release, signalHeld, signalContinued, intercepted = 0;
        const gate = new Promise(resolve => { release = resolve; });
        const held = new Promise(resolve => { signalHeld = resolve; });
        const continued = new Promise(resolve => { signalContinued = resolve; });
        let routeFailure;
        const holdRequest = async route => {
          const request = route.request();
          if (request.method() !== 'POST' || !request.headers()['next-action'] || new URL(request.url()).pathname !== recipe.path) { await route.fallback(); return; }
          intercepted++; signalHeld(); await gate;
          try { await route.fallback(); } catch (error) { routeFailure = error; } finally { signalContinued(); }
        };
        if (index === 0) await page.route('**/*', holdRequest);
        let timer;
        try {
          const response = actionResponse();
          response.catch(() => {});
          if (recipe.confirmVisibility) { await visibility.click(); await expect(dialog).toHaveCount(1); }
          const trigger = recipe.confirmVisibility ? dialog.locator('[data-admin-confirm-submit]') : visibility;
          const click = trigger.click();
          click.catch(() => {});
          if (index === 0) {
            await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The real domain command did not reach its owned request hold.')), 30_000); })]);
            await expect(trigger).toBeDisabled();
            await trigger.evaluate(button => button.click());
            assert.equal(intercepted, 1, 'A disabled pending trigger must not dispatch a duplicate.');
            release(); await continued; if (routeFailure) throw routeFailure; pendingDedup = true;
          }
          const acknowledged = await response; assertActionAcknowledged(acknowledged); await click;
          if (recipe.confirmVisibility) await expect(dialog).toHaveCount(0, { timeout: 60_000 });
          await expect(visibility).toBeEnabled({ timeout: 60_000 }); await expect(visibility).toHaveAttribute('aria-pressed', expected);
          if (index === 0) assert.equal(intercepted, 1);
        } finally {
          clearTimeout(timer); release();
          if (index === 0) await page.unrouteAll({ behavior: 'wait' });
        }
        await observe('domain-reload-' + recipe.entity + '-' + index, () => page.reload({ waitUntil: 'domcontentloaded' }));
        await expect(visibility).toHaveAttribute('aria-pressed', expected, { timeout: 60_000 });
      }
      assert.equal(posts.length, recipe.preDispatchFailure ? 3 : 2, 'Only the measured failure and two explicit visibility commands may execute.');
      const auditActions = recipe.audit.startsWith('project_tracking_') ? ['project_children.update']
        : recipe.audit === 'admin_user' ? ['admin_user.activated', 'admin_user.deactivated']
          : [recipe.audit + '.publish', recipe.audit + '.unpublish'];
      databaseReadback.push({ table: recipe.table, id: recipe.id, expected: { [recipe.state]: originalState },
        auditEntityType: recipe.audit, auditActions, auditEntityLabel: ['categories', 'series', 'pages'].includes(recipe.entity) ? null : recipe.label,
        auditSince: startedAt, exactAuditCount: recipe.entity === 'topics' ? 3 : 2,
        ...(recipe.entity === 'topics' ? { exactCommandReceiptCount: 2 } : {}) });
      const outcome = { entity: recipe.entity, table: recipe.table, id: recipe.id, startedAt, finalState: originalState,
        visibleStateChangeAndRestore: true, realRequests: posts.length, freshReloads: 2, confirmationCancelled,
        pendingDuplicateBlocked: pendingDedup, preDispatchFailureRollbackAndRetry: rollbackRetried,
        coveredCommands: ['visibility'], remainingDeclaredCommands: recipe.declaredMutations.filter(kind => kind !== 'visibility'),
        nativeAuditReadbackRequired: true,
        boundary: 'Actual authenticated visibility cycle with pending protection and durable readback expectation; other commands and complete capability axes remain open.' };
      outcomes.push(outcome); return outcome;
    } finally { page.off('request', trackPost); }
  });
  return { outcomes, domainInventory: plan.map(row => ({ entity: row.entity, declaredMutations: row.declaredMutations })),
    proofBoundary: 'One complete visibility command family across the current mutating inventory; terminal commands and permission outcomes are not inferred.' };
}
