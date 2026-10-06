import {PROJECT_CONTROL_KINDS,projectControlSlug} from './admin-core-project-controls-contract.mjs';
import {createCoreDomainVisibilityControl} from './admin-core-domain-visibility-control.mjs';
import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
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
  projects: { confirmVisibleOnly: true, table: 'projects', state: 'publication_status', values: ['published', 'unpublished'], audit: 'project' },
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

export function coreDomainVisibilityRequiresConfirmation(recipe,pressed){
 assert.ok(pressed==='true'||pressed==='false','The actual mounted visibility state is required.');
 assert.ok(Object.hasOwn(recipes,recipe.entity));
 const current=recipes[recipe.entity];assert.equal(Boolean(recipe.confirmVisibility),Boolean(current.confirmVisibility));assert.equal(Boolean(recipe.confirmVisibleOnly),Boolean(current.confirmVisibleOnly));
 return Boolean(current.confirmVisibility)||(Boolean(current.confirmVisibleOnly)&&pressed==='true');
}
/** Two route contexts of the existing Projects declaration, not new entities. */
export function buildCoreProjectVisibilityGuardPlan({rowActions,fixtures}) {
  const declarations=rowActions.entities.filter(row=>row.entity==='projects');assert.equal(declarations.length,1);
  const declaration=declarations[0];assert.equal(declaration.actions.visibility,'adopted');
  assert.equal(declaration.consumerSourceFile,'src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx');
  assert.ok(Array.isArray(fixtures.projectControls?.projects));assert.equal(fixtures.projectControls.projects.length,PROJECT_CONTROL_KINDS.length);
  const plan=PROJECT_CONTROL_KINDS.map(projectKind=>{
    const fixture=projectKind==='residential'?fixtures.project:fixtures.commercialProject;
    assert.ok(fixture);assert.ok(Number.isSafeInteger(fixture.id)&&fixture.id>0);assert.ok(typeof fixture.title==='string'&&fixture.title.trim());
    assert.equal(fixture.slug,projectControlSlug(projectKind));assert.equal(fixture.listPath,'/admin/projects/'+projectKind);
    const owned=fixtures.projectControls.projects.filter(row=>row.kind===projectKind);assert.equal(owned.length,1);
    assert.equal(owned[0].id,fixture.id);assert.equal(owned[0].slug,fixture.slug);assert.equal(owned[0].editPath,'/admin/projects/'+fixture.id);
    return {entity:'projects',...recipes.projects,id:fixture.id,label:fixture.title,path:fixture.listPath,projectKind,initialState:'false',
      journeyId:'domain-projects-'+projectKind+'-hide-confirmation-reload-audit',
      declaredMutations:Object.entries(declaration.actions).filter(([kind,state])=>['visibility','featured','duplicate','archive','delete'].includes(kind)&&state==='adopted').map(([kind])=>kind),
      declaredConfirmations:declaration.confirmationActions};
  });
  assert.equal(new Set(plan.map(row=>row.id)).size,plan.length);return plan;
}

/** Cancel only the current guarded transition, before installing a request hold. */
export async function cancelCoreDomainVisibilityGuard({recipe,visibility,dialog,pressed,postCount,index}) {
  assert.ok(index===0||index===1);assert.equal(await visibility.readState(),pressed);
  if(!coreDomainVisibilityRequiresConfirmation(recipe,pressed))return null;
  const before=postCount();assert.ok(Number.isSafeInteger(before)&&before>=0);
  await visibility.invoke();await expect(dialog).toHaveCount(1);
  await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);
  await visibility.expectReturnedFocus();await visibility.expectState(pressed);await visibility.expectEnabled();
  assert.equal(postCount(),before,'Cancelled confirmation must not dispatch a command.');
  return {index,state:pressed,postsBefore:before,postsAfter:postCount(),returnedFocus:true};
}

/** Joined existing owned writes; editor saves and visibility commands stay distinct. */
export function assertCoreProjectVisibilityGuardReceipt({browser,rowActions,fixtures,sourceSha256,expectedActorId,writes}) {
  const plan=buildCoreProjectVisibilityGuardPlan({rowActions,fixtures});
  assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'project-controls');assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);
  assert.deepEqual(browser.errors,[]);assert.equal(browser.globalClosed,false);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(browser.sourceSha256,sourceSha256);
  assert.ok(Number.isSafeInteger(expectedActorId)&&expectedActorId>0);
  const result=browser.projectControls.visibility;assert.ok(result);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);
  assert.equal(result.outcomes.length,plan.length);assert.equal(browser.databaseReadback.length,plan.length);assert.equal(writes.length,plan.length);
  const ids=plan.map(recipe=>recipe.journeyId),editorIds=PROJECT_CONTROL_KINDS.map(kind=>'core-project-controls-'+kind);
  assert.deepEqual(browser.evidence.map(row=>row.id),['existing-auth-login',...editorIds,...ids]);
  assert.ok(browser.evidence.every(row=>row.status==='pass'&&Array.isArray(row.coverage)&&row.coverage.length===0));
  const login=browser.evidence[0];assert.equal(login.authenticated,true);assert.equal(login.sessionArtifactWritten,false);assert.match(login.dashboardState,/^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
  const auditIds=[];
  for(const[index,recipe]of plan.entries()){
    const outcome=result.outcomes[index],evidence=browser.evidence[1+editorIds.length+index];
    assert.equal(outcome.id,recipe.id);assert.equal(evidence.entityId,recipe.id);assert.equal(outcome.projectKind,recipe.projectKind);assert.equal(outcome.path,recipe.path);
    assert.equal(evidence.projectKind,recipe.projectKind);assert.equal(evidence.path,recipe.path);
    for(const row of[outcome,evidence]){
      assert.equal(row.entity,'projects');assert.equal(row.table,'projects');assert.equal(row.finalState,'unpublished');assert.equal(row.realRequests,2);assert.equal(row.freshReloads,2);
      for(const key of['visibleStateChangeAndRestore','confirmationCancelled','pendingDuplicateBlocked','nativeAuditReadbackRequired'])assert.equal(row[key],true);
      assert.equal(row.preDispatchFailureRollbackAndRetry,false);assert.deepEqual(row.coveredCommands,['visibility']);
      assert.deepEqual(row.confirmationCancellations,[{index:1,state:'true',postsBefore:1,postsAfter:1,returnedFocus:true}]);
    }
    const expected=browser.databaseReadback[index],native=writes[index];
    assert.equal(expected.table,'projects');assert.equal(expected.id,recipe.id);assert.deepEqual(expected.expected,{publication_status:'unpublished'});
    assert.equal(expected.auditEntityType,'project');assert.equal(expected.auditEntityLabel,recipe.label);assert.deepEqual(expected.auditActions,['project.publish','project.unpublish']);assert.equal(expected.exactAuditCount,2);
    assert.ok(Number.isFinite(Date.parse(outcome.startedAt)));assert.equal(expected.auditSince,outcome.startedAt);
    assert.equal(native.table,'projects');assert.equal(native.id,recipe.id);assert.equal(native.deleted,false);assert.deepEqual(native.actual,{publication_status:'unpublished'});assert.equal(native.auditSince,outcome.startedAt);assert.equal(native.expectedActorId,expectedActorId);
    assert.deepEqual(native.audit.map(row=>row.action),['project.publish','project.unpublish']);
    for(const audit of native.audit){assert.equal(audit.entity_type,'project');assert.equal(Number(audit.entity_id),recipe.id);assert.equal(audit.entity_label,recipe.label);assert.equal(Number(audit.actor_admin_user_id),expectedActorId);assert.ok(Number.isSafeInteger(Number(audit.id))&&Number(audit.id)>0);auditIds.push(Number(audit.id));}
  }
  assert.equal(new Set(auditIds).size,auditIds.length);
  return {status:'pass',contexts:plan.map(row=>row.projectKind),visibilityWrites:4,visibilityAudits:4,cancellations:2,successfulCommandsPerContext:2,automaticCoverage:[],globalClosed:false,
    boundary:'Two guarded hide cancellations and two visibility commands per current Project route; the four editor writes and eighteen editor checkpoints are verified separately.'};
}

export async function runCoreProjectVisibilityGuardJourneys(ctx) {
  const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
  const manifest=await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const plan=buildCoreProjectVisibilityGuardPlan({rowActions:manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,fixtures:ctx.fixtures});
  return {...await runCoreVisibilityPlan(ctx,plan),proofBoundary:'Only the two current Project route contexts; no other command family or whole capability is promoted.',automaticCoverage:[],globalClosed:false};
}

export async function runCoreDomainCommandJourneys(ctx) {
  const { fixtures } = ctx;
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const manifest = await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const location = await jiti.import('../../src/lib/admin/projects/location-management-contract.ts');
  const tracking = await jiti.import('../../src/lib/admin/projects/tracking-contract.ts');
  const plan = buildCoreDomainCommandPlan({ rowActions: manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION, fixtures,
    paths: { projectLocationManagementPath: location.projectLocationManagementPath, trackingProjectPath: tracking.trackingProjectPath,
      trackingStagePath: tracking.trackingStagePath, trackingItemPath: tracking.trackingItemPath } });
  return runCoreVisibilityPlan(ctx,plan);
}
async function runCoreVisibilityPlan(ctx,plan) {
  const {page,origin,run,observe,actionResponse,assertActionAcknowledged,databaseReadback}=ctx;
  assert.equal(new URL(origin).hostname,'127.0.0.1');
  const outcomes = [];
  for (const recipe of plan) await run(recipe.journeyId ?? ('domain-' + recipe.entity + '-visibility-command-reload-audit'), [], async () => {
    const startedAt = new Date().toISOString();
    await observe('domain-open-' + recipe.entity, () => page.goto(origin + recipe.path + '?q=' + encodeURIComponent(recipe.label), { waitUntil: 'domcontentloaded' }));
    const visibility = createCoreDomainVisibilityControl({page,recipe});
    await visibility.expectEnabled();
    const original = await visibility.readState();
    assert.ok(original === 'true' || original === 'false');
    if(recipe.initialState!==undefined)assert.equal(original,recipe.initialState);
    const originalState = recipe.values[original === 'true' ? 0 : 1];
    const dialog = page.locator('[data-admin-confirm-dialog]');
    const posts = [];
    const trackPost = request => {
      if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === recipe.path) posts.push(request.url());
    };
    page.on('request', trackPost);
    const confirmationCancellations=[];
    let confirmationCancelled = false, rollbackRetried = false, pendingDedup = false;
    try {
      if (recipe.preDispatchFailure) {
        let aborted = 0;
        const rejectBeforeDispatch = async route => {
          const request = route.request();
          if (request.method() === 'POST' && request.headers()['next-action'] && new URL(request.url()).pathname === recipe.path) {
            aborted++; await route.abort('failed');
          } else await route.fallback();
        };
        const removeRejectedRoute = await registerCorePageRoute(page, '**/*', rejectBeforeDispatch);
        try {
          await observe('domain-real-client-pre-dispatch-failure', () => visibility.invoke());
          await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible({ timeout: 60_000 });
          await visibility.expectState(original); await visibility.expectEnabled();
          assert.equal(aborted, 1, 'Exactly one actual request must be rejected before it reaches the server.');
        } finally { await removeRejectedRoute(); }
        rollbackRetried = true;
      }
      for (const [index, expected] of [[0, original === 'true' ? 'false' : 'true'], [1, original]]) {
        // The first actual request is held before dispatch so pending ownership
        // and disabled duplicate activation are observed without fake responses.
        const pressed=index===0?original:(original==='true'?'false':'true');
        const confirmationRequired=coreDomainVisibilityRequiresConfirmation(recipe,pressed);
        const cancellation=await observe('domain-confirmation-cancel-'+index,()=>cancelCoreDomainVisibilityGuard({recipe,visibility,dialog,pressed,postCount:()=>posts.length,index}));
        if(cancellation){confirmationCancellations.push(cancellation);confirmationCancelled=true;}
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
        const removeHeldRoute = (index === 0 || confirmationRequired) ? await registerCorePageRoute(page, '**/*', holdRequest) : null;
        let timer;
        try {
          const response = actionResponse();
          response.catch(() => {});
          if (confirmationRequired) { await visibility.invoke(); await expect(dialog).toHaveCount(1); }
          const trigger = confirmationRequired ? dialog.locator('[data-admin-confirm-submit]') : visibility;
          const click = confirmationRequired ? trigger.click() : visibility.invoke();
          click.catch(() => {});
          if (index === 0 || confirmationRequired) {
            await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The real domain command did not reach its owned request hold.')), 30_000); })]);
            if(confirmationRequired){await expect(trigger).toBeDisabled();await trigger.evaluate(button => button.click());}
            else await visibility.assertPendingDuplicateBlocked(()=>intercepted);
            assert.equal(intercepted, 1, 'A disabled pending trigger must not dispatch a duplicate.');
            release(); await continued; if (routeFailure) throw routeFailure; pendingDedup = true;
          }
          const acknowledged = await response; assertActionAcknowledged(acknowledged); await click;
          if (confirmationRequired) await expect(dialog).toHaveCount(0, { timeout: 60_000 });
          await visibility.expectEnabled(); await visibility.expectState(expected);
          if (index === 0 || confirmationRequired) assert.equal(intercepted, 1);
        } finally {
          clearTimeout(timer); release();
          if (removeHeldRoute) await removeHeldRoute();
        }
        await observe('domain-reload-' + recipe.entity + '-' + index, () => page.reload({ waitUntil: 'domcontentloaded' }));
        await visibility.expectState(expected);
      }
      assert.equal(posts.length, recipe.preDispatchFailure ? 3 : 2, 'Only the measured failure and two explicit visibility commands may execute.');
      const auditActions = recipe.audit.startsWith('project_tracking_') ? ['project_children.update']
        : recipe.audit === 'admin_user' ? ['admin_user.activated', 'admin_user.deactivated']
          : [recipe.audit + '.publish', recipe.audit + '.unpublish'];
      databaseReadback.push({ table: recipe.table, id: recipe.id, expected: { [recipe.state]: originalState },
        auditEntityType: recipe.audit, auditActions, auditEntityLabel: ['categories', 'series', 'pages'].includes(recipe.entity) ? null : recipe.label,
        auditSince: startedAt, exactAuditCount: 2,
        ...(recipe.entity === 'topics' ? { exactCommandReceiptCount: 0 } : {}) });
      const outcome = { entity: recipe.entity, table: recipe.table, id: recipe.id, startedAt, finalState: originalState,
        visibleStateChangeAndRestore: true, realRequests: posts.length, freshReloads: 2, confirmationCancelled, confirmationCancellations,
        ...(recipe.projectKind?{projectKind:recipe.projectKind,path:recipe.path}:{}),
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
