import { observeCoreVisibleAcceptedFeedback, validateCoreJourneySelection } from "./admin-core-domain-form-journeys.mjs";
import { buildCoreReadonlyJourneyPlan } from "./admin-core-readonly-journeys.mjs";
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

/** PostgreSQL bigint audit IDs enter this fixed browser producer as decimal strings. */
export function normalizeCoreTerminalAuditId(value) {
  assert.ok(typeof value === 'number' || (typeof value === 'string' && /^[1-9][0-9]*$/u.test(value)), 'Audit identity must be a positive decimal integer.');
  const id = Number(value);
  assert.ok(Number.isSafeInteger(id) && id > 0, 'Audit identity must fit the strict native readback contract.');
  return id;
}

export const CORE_DOMAIN_COMMAND_TAIL_SELECTION = 'domain-command-tail';
export const CORE_TRACKING_PERMISSION_SELECTION = 'tracking-permissions';
/** Fixed affected subset of the existing canonical domain command plan.
 * @param {string|null|undefined} selection
 */
export function selectCoreDomainPermissionPlan(plan, selection = null) {
  if (selection === null || selection === undefined) return plan;
  validateCoreJourneySelection({scope:'core-closure',cohort:'domain-commands',selection});
  if (selection === CORE_DOMAIN_COMMAND_TAIL_SELECTION) return plan;
  assert.equal(selection, CORE_TRACKING_PERMISSION_SELECTION);
  const selected = plan.filter(recipe => recipe.entity.startsWith('project_tracking_'));
  assert.deepEqual(selected.map(recipe=>recipe.entity), ['project_tracking_stages','project_tracking_items','project_tracking_updates']);
  return selected;
}
export function buildCoreTrackingPermissionPlan(input) {
  const permissions = selectCoreDomainPermissionPlan(buildCoreDomainCommandPlan(input), CORE_TRACKING_PERMISSION_SELECTION);
  return {selection:CORE_TRACKING_PERMISSION_SELECTION,trash:[],readonly:[],permissions,journeyIds:permissions.map(recipe=>'domain-'+recipe.entity+'-mounted-revoked-session-rejection')};
}

export function buildCoreDomainCommandTailPlan(input) {
  const trash = buildCoreTerminalCommandPlan(input).filter(recipe => trashEntities.has(recipe.entity));
  assert.deepEqual(trash.map(recipe=>recipe.entity).sort(), [...trashEntities].sort());
  const permissions = buildCoreDomainCommandPlan(input);
  const readonly = buildCoreReadonlyJourneyPlan(input.fixtures);
  const journeyIds = [...trash.map(recipe=>'terminal-'+recipe.entity+'-global-empty-trash'), ...readonly.map(recipe=>'core-readonly-'+recipe.entity+'-query-failure-retry-auth'), ...permissions.map(recipe=>'domain-'+recipe.entity+'-mounted-revoked-session-rejection')];
  assert.equal(new Set(journeyIds).size, journeyIds.length);
  return {readonly, trash, permissions, journeyIds};
}
/** Fixed affected tail; every borrowed prefix, native phase or coverage claim is rejected. */
/**
 * @param {{native:{status:string,ownedRunId:string,records:Array<object>},ownedRunId:string,sourceSha256:string,expectedActorId:number}|null} nativeContext
 */
export function assertCoreDomainCommandTailReceipt(browser, plan, canonicalRequiredCases, nativeContext = null) {
  const selection=validateCoreJourneySelection({scope:browser.scope,cohort:browser.cohort,selection:browser.journeySelection});
  assert.ok(selection===CORE_DOMAIN_COMMAND_TAIL_SELECTION||selection===CORE_TRACKING_PERMISSION_SELECTION);
  assert.equal(plan.selection ?? CORE_DOMAIN_COMMAND_TAIL_SELECTION, selection, "The fixed plan must bind the selected journey family.");
  if(selection===CORE_TRACKING_PERMISSION_SELECTION){assert.deepEqual(plan.trash,[]);assert.deepEqual(plan.readonly,[]);assert.deepEqual(plan.permissions.map(recipe=>recipe.entity),['project_tracking_stages','project_tracking_items','project_tracking_updates']);}
  assert.ok(plan && Array.isArray(plan.trash) && Array.isArray(plan.permissions));
  const ids=[...plan.trash.map(recipe=>'terminal-'+recipe.entity+'-global-empty-trash'),...plan.readonly.map(recipe=>'core-readonly-'+recipe.entity+'-query-failure-retry-auth'),...plan.permissions.map(recipe=>'domain-'+recipe.entity+'-mounted-revoked-session-rejection')];
  assert.deepEqual(plan.journeyIds,ids);assert.equal(new Set(ids).size,ids.length);
  const identities=rows=>{assert.ok(Array.isArray(rows)&&rows.length>0);assert.ok(rows.every(row=>typeof row.key==='string'&&row.key));assert.equal(new Set(rows.map(row=>row.key)).size,rows.length);return rows.map(row=>{const copy={...row};delete copy.status;delete copy.evidence;return copy;}).sort((a,b)=>a.key.localeCompare(b.key));};
  assert.deepEqual(identities(browser.requiredCases),identities(canonicalRequiredCases));
  assert.ok(browser.requiredCases.every(row=>row.status==='open'&&row.evidence===null),'Tail evidence does not automatically classify capability/lifecycle cells.');
  assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.deepEqual(browser.errors,[]);
  assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);
  assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);
  assert.deepEqual(browser.evidence.map(row=>row.id),['existing-auth-login',...ids]);assert.ok(browser.evidence.every(row=>row.status==='pass'&&Array.isArray(row.coverage)&&row.coverage.length===0));
  assert.equal(browser.evidence[0].authenticated,true);assert.equal(browser.evidence[0].sessionArtifactWritten,false);
  assert.match(browser.evidence[0].dashboardState,/^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
  assert.deepEqual(browser.readOnlyReadback.map(row=>row.entity),plan.readonly.map(row=>row.entity));assert.deepEqual(browser.menuIntegrityReadback,[]);
  for(const[index,recipe]of plan.readonly.entries()){
    const row=browser.evidence[plan.trash.length+index+1],projection=browser.readOnlyReadback[index];assert.equal(row.entity,recipe.entity);assert.equal(row.authenticatedProjectionRows,projection.rows.length);assert.ok(projection.rows.length>0&&projection.rows.length<=50);for(const value of projection.rows)assert.deepEqual(Object.keys(value).sort(),[...recipe.fields].sort());
    for(const key of ['previousRowsPreserved','explicitRetrySucceeded','invalidQueryRejected','anonymousApiRejected','reloaded','nativeReadbackRequired'])assert.equal(row[key],true);assert.ok(Number.isSafeInteger(row.transportFailures)&&row.transportFailures>0&&row.transportFailures<=3);assert.equal(row.mutatingCommands,'not-applicable-registered-read-owner');
  }
  assert.ok(browser.previewMatrix.every(row=>row.status==='open'&&row.evidence===null));
  const deleted=[];
  for(const[index,recipe]of plan.trash.entries()){
    const row=browser.evidence[index+1];assert.equal(row.entity,recipe.entity);assert.equal(row.expectedCount,3);
    assert.ok(Array.isArray(row.ownedIds)&&row.ownedIds.length===row.expectedCount&&row.ownedIds.every(id=>Number.isSafeInteger(id)&&id>0&&id!==recipe.id));assert.equal(new Set(row.ownedIds).size,row.ownedIds.length);
    for(const key of ['staleCountRejected','freshCountRetrySucceeded','globalCommandReallyExecuted'])assert.equal(row[key],true);
    assert.equal(row.cancellation.completeTrashCount,2);assert.equal(row.cancellation.confirmationCancelled,true);assert.equal(row.cancellation.globalTrashSetPreserved,true);
    for(const id of row.ownedIds){const found=browser.databaseReadback.filter(write=>write.table===recipe.table&&write.id===id);assert.equal(found.length,1);const write=found[0];assert.equal(write.deleted,true);assert.deepEqual(write.expected,{});assert.deepEqual(write.auditEntityTypes,[recipe.audit]);assert.deepEqual(write.auditActions,[recipe.audit+'.duplicate',recipe.audit+'.delete',recipe.audit+'.permanent_delete']);assert.ok(Number.isFinite(Date.parse(write.auditSince)));assert.ok(Array.isArray(write.aggregateAuditIds)&&write.aggregateAuditIds.length===1);deleted.push(write);}
  }
  assert.equal(browser.databaseReadback.length,deleted.length);
  for(const[index,recipe]of plan.permissions.entries()){
    const row=browser.evidence[plan.readonly.length+plan.trash.length+index+1];assert.equal(row.entity,recipe.entity);assert.equal(row.entityId,recipe.id);
    for(const key of ['mountedBeforeRevocation','retainedOriginalSignedCookie','persistedStateRevisionAndAuditUnchanged'])assert.equal(row[key],true);
    assert.equal(typeof row.confirmationCancelled,'boolean');assert.equal(row.deniedRealCommandPosts,1);assert.equal(row.denial.destination,'/admin/login');assert.equal(row.denial.contract,'existing-proxy-revoked-session-rejection');assert.ok([200,301,302,303,307,308].includes(row.denial.status));
    assert.ok(['login-navigation','existing-rejected-or-unknown-feedback'].includes(row.visibleOutcome));
  }
  if(nativeContext!==null){
    const {native,ownedRunId,sourceSha256,expectedActorId}=nativeContext;
    assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.ok(typeof ownedRunId==='string'&&ownedRunId);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(browser.sourceSha256,sourceSha256);assert.ok(Number.isSafeInteger(expectedActorId)&&expectedActorId>0);
    assert.ok(Array.isArray(native.records));assert.equal(new Set(native.records.map(row=>row.id)).size,native.records.length);
    // These are the existing global-trash recipe's actual fixed checkpoints:
    // initial set; clone/delete reads; count/cancel sets; third clone; stale CAS;
    // final empty set and audit. They are not a second operation registry.
    const phaseKinds=['trash','state','state','state','state','trash','trash','trash','state','trash','state','state','trash','state'];
    assert.equal(native.records.length,plan.trash.length*phaseKinds.length+plan.permissions.length*2);
    const sorted=values=>values.map(Number).sort((a,b)=>a-b);
    const check=(record,entity,kind)=>{assert.equal(record.entity,entity);assert.equal(record.kind,kind);assert.equal(record.status,'pass');assert.match(record.id,/^[a-f0-9-]{36}$/iu);assert.ok(Number.isFinite(Date.parse(record.observedAt)));if(kind==='terminal-domain-state'){assert.equal(record.expectedActorId,expectedActorId);assert.ok(Array.isArray(record.rows)&&Array.isArray(record.audit));for(const audit of record.audit)assert.equal(Number(audit.actor_admin_user_id),expectedActorId);}else assert.ok(Array.isArray(record.ids));};
    for(const[index,recipe]of plan.trash.entries()){
      const row=browser.evidence[index+1],records=native.records.slice(index*phaseKinds.length,(index+1)*phaseKinds.length),copies=row.ownedIds;
      for(const[position,kind]of phaseKinds.entries())check(records[position],recipe.entity,kind==='trash'?'terminal-trash-set':'terminal-domain-state');
      for(const[position,wanted]of [[0,[]],[5,copies.slice(0,2)],[6,copies.slice(0,2)],[7,copies.slice(0,2)],[9,copies],[12,[]]])assert.deepEqual(sorted(records[position].ids),sorted(wanted));
      for(const[position,id,deleted]of [[1,copies[0],false],[2,copies[0],true],[3,copies[1],false],[4,copies[1],true],[8,copies[2],false]]){assert.equal(records[position].rows.length,1);assert.equal(Number(records[position].rows[0].id),id);assert.equal(Boolean(records[position].rows[0].deleted_at),deleted);}
      assert.deepEqual(sorted(records[10].rows.map(item=>item.id)),sorted(copies));assert.ok(records[10].rows.every(item=>item.deleted_at));
      assert.deepEqual(records[11].rows,records[10].rows);assert.deepEqual(records[11].audit,records[10].audit);assert.deepEqual(records[13].rows,[]);
      for(const[key,position]of Object.entries({initialTwoRowTrash:5,nativeCompleteTrash:9,nativeBeforeRejection:10,nativeAfterRejection:11,nativeEmptyTrash:12,nativeRowsAndAudit:13}))assert.equal(row[key],records[position].id);
      const audit=records[13].audit;assert.deepEqual(audit.map(item=>item.action).sort(),[...copies.flatMap(()=>[recipe.audit+'.duplicate',recipe.audit+'.delete']),recipe.audit+'.permanent_delete'].sort());
      const permanent=audit.filter(item=>item.action===recipe.audit+'.permanent_delete');assert.equal(permanent.length,1);const aggregateKey=recipe.entity==='topics'?'topic_ids':recipe.entity==='categories'?'category_ids':'series_ids';assert.deepEqual(sorted(permanent[0].metadata[aggregateKey]),sorted(copies));
      for(const id of copies){for(const action of ['duplicate','delete'])assert.equal(audit.filter(item=>Number(item.entity_id)===id&&item.action===recipe.audit+'.'+action).length,1);const write=deleted.find(item=>item.table===recipe.table&&item.id===id);assert.deepEqual(write.aggregateAuditIds.map(String),[String(permanent[0].id)]);}
    }
    for(const[index,recipe]of plan.permissions.entries()){
      const row=browser.evidence[plan.readonly.length+plan.trash.length+index+1],offset=plan.trash.length*phaseKinds.length+index*2,before=native.records[offset],after=native.records[offset+1];
      check(before,recipe.entity,'terminal-domain-state');check(after,recipe.entity,'terminal-domain-state');assert.equal(row.nativeBefore,before.id);assert.equal(row.nativeAfter,after.id);
      assert.equal(before.rows.length,1);assert.equal(Number(before.rows[0].id),recipe.id);assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.audit,before.audit);
    }
  }
  return{selection,selectedJourneyIds:ids,executedJourneyIds:[...browser.executedJourneyIds],wholeCohortExecuted:false,globalClosed:false,automaticCoverage:[]};
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
  async function confirmed(trigger, { cancelFirst = true, reject = false, retryRejected = false, rejectBeforeDelivery = false } = {}) {
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
      }, { rejectBeforeDelivery });
      if (reject) {
        await expect(dialog).toHaveCount(1); await expect(dialog.locator('[data-admin-confirm-submit]')).toBeEnabled();
        await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();
      } else await expect(dialog).toHaveCount(0, { timeout: 60_000 });
    }
    if (reject) { await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0); }
    return { cancelledBeforeCommit: cancelFirst, pendingDuplicateBlocked: true, attempts, rejected: reject, rejectionBoundary: rejectBeforeDelivery ? "owned-pre-delivery-abort" : null };
  }
  async function heldCommand(click, pendingProof, { rejectBeforeDelivery = false } = {}) {
    const currentPath = pathname(); let release, sawHeld, timer, routeFailure, count = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const held = new Promise(resolve => { sawHeld = resolve; });
    const routeHandler = async route => {
      const request = route.request();
      if (request.method() !== 'POST' || !request.headers()['next-action'] || new URL(request.url()).pathname !== currentPath) { await route.fallback(); return; }
      count++; sawHeld(); await gate;
      try { if (rejectBeforeDelivery) await route.abort("failed"); else await route.fallback(); } catch (error) { routeFailure = error; }
    };
    const removeRoute = await registerCorePageRoute(page, '**/*', routeHandler);
    const response = rejectBeforeDelivery ? page.waitForEvent("requestfailed", { predicate: request => request.method() === "POST" && Boolean(request.headers()["next-action"]) && new URL(request.url()).origin === origin && new URL(request.url()).pathname === currentPath, timeout: 30_000 }) : actionResponse(); response.catch(() => {});
    const clicking = click(); clicking.catch(() => {});
    try {
      await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The terminal action did not reach its actual request hold.')), 30_000); })]);
      await pendingProof(); assert.equal(count, 1, 'Pending activation must not submit a duplicate terminal command.'); release();
      const actual = await response;
      if (rejectBeforeDelivery) assert.ok(actual.failure()?.errorText, "The exact intercepted Action must actually fail transport.");
      else assertActionAcknowledged(actual);
      await clicking;
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
    if(recipe.entity==='projects')assert.match(recipe.path,new RegExp('^/admin/projects/(residential|commercial)$','u'));const channel=({projects:'entity-list:'+recipe.path.split('/').at(-1)+'-projects-table',topics:'entity-list:content-topics-table',categories:'entity-list:content-categories-table',series:'entity-list:content-series-table',pages:'entity-list:pages-table'})[recipe.entity];assert.ok(channel);
    const acceptedFeedback=await observeCoreVisibleAcceptedFeedback({page,channel,perform:()=>heldCommand(() => item.click(), async () => {
      const disabled = await menu(recipe, recipe.id, 'duplicate'); await expect(disabled).toBeDisabled();
      await disabled.evaluate(button => button.click()); await page.keyboard.press('Escape');
    })});
    await observe('terminal-clone-reload', () => page.reload({ waitUntil: 'domcontentloaded' }));
    await expect.poll(async () => (await ids()).filter(id => !before.includes(id)).length, { timeout: 60_000 }).toBe(1);
    const id = (await ids()).find(value => !before.includes(value));
    assert.ok(id && id !== recipe.id);
    const persisted = await probe(recipe, [id], startedAt); assert.equal(persisted.rows.length, 1); assert.equal(Number(persisted.rows[0].id), id);
    const duplicateAction = recipe.entity === 'pages' ? 'page_composition.duplicate_page' : recipe.audit + '.duplicate';
    assert.equal(persisted.audit.filter(row => row.action === duplicateAction).length, 1);
    return { id, duplicateAction, native: persisted.id,acceptedFeedback };
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
    let rejected = null, permissionCapture = null, permissionEvidence = [];
    if (recipe.entity === 'admin_users') {
      const attempt = await t.rowCommand(recipe, recipe.id, 'delete', { reject: true, rejectBeforeDelivery: true });
      const unchanged = await t.probe(recipe, [recipe.id], startedAt);
      assert.deepEqual(unchanged.rows, before.rows, 'The rejected Users delete must preserve the current native identity projection.');
      assert.deepEqual(unchanged.audit, before.audit, 'The rejected Users delete must append no identity audit.');
      await expect(page.locator(moreSelector(recipe.id))).toHaveCount(1);
      rejected = { ...attempt, nativeRejected: unchanged.id, optimisticRowRestored: true, nativeIdentityProjectionAndAuditUnchanged: true };
      assert.equal(typeof ctx.permissionReplay?.begin, 'function', 'Users delete requires the existing permission collector.');
      permissionCapture = ctx.permissionReplay.begin({ caseId: 'terminal-admin_users-delete', formConsumer: 'users-and-roles', surface: 'delete-command' });
    }
    try {
    const confirmation = await t.rowCommand(recipe, recipe.id, 'delete');
    await observe('terminal-direct-delete-reload', () => page.reload({ waitUntil: 'domcontentloaded' })); await expect(page.locator(moreSelector(recipe.id))).toHaveCount(0);
    const after = await t.probe(recipe, [recipe.id], startedAt); assert.equal(after.rows.length, 0);
    const action = recipe.entity === 'admin_users' ? 'admin_user.deleted' : recipe.audit.startsWith('project_tracking_') ? 'project_children.delete' : recipe.audit + '.delete';
    assert.deepEqual(after.audit.map(row => row.action), [action]); assert.ok(after.audit[0].actor_admin_user_id !== null);
    if (permissionCapture) {
      const proof = await permissionCapture.verifyAfterSuccessfulUI({ canonicalUiSuccessVerified: true, nativeSaveVerified: true });
      assert.equal(proof.caseId, 'terminal-admin_users-delete');assert.equal(proof.surface, 'delete-command');assert.deepEqual(proof.automaticCoverage, []);
      permissionEvidence.push({...proof, originalNativeSaveReceipt: after.id, originalProjectionCount: 1, originalNativeOperation: 'delete'});
    }
    databaseReadback.push({ table: recipe.table, id: recipe.id, deleted: true, expected: {}, auditEntityTypes: [recipe.audit], auditActions: [action], auditSince: startedAt, exactAuditCount: 1 });
    const outcome = { entity: recipe.entity, id: recipe.id, confirmation, rejected, permissionEvidence, nativeBefore: before.id, nativeAfter: after.id, domainDeleteCommitted: true,
      dependencyOrder: recipe.audit.startsWith('project_tracking_') ? 'update then item then stage, after guarded parents were observed' : null };
    outcomes.push(outcome); return outcome;
    } finally { permissionCapture?.discard(); }
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
      aggregateAuditIds: [normalizeCoreTerminalAuditId(permanent[0].id)] });
    const outcome = { entity: recipe.entity, ownedIds: copies, nativeCompleteTrash: changed.id, initialTwoRowTrash: complete.id, cancellation: cancelled,
      staleCountRejected: true, nativeBeforeRejection: beforeRejection.id, nativeAfterRejection: afterRejection.id, freshCountRetrySucceeded: true,
      nativeEmptyTrash: afterSet.id, nativeRowsAndAudit: after.id, globalCommandReallyExecuted: true, expectedCount: copies.length };
    outcomes.push(outcome); return outcome;
  });
  return { outcomes, boundary: 'Real authenticated global EmptyTrash over a native-confirmed complete disposable set, with no Preview or unrelated trash present.' };
}
