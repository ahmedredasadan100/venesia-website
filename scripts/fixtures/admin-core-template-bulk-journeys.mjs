import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';
import { buildCoreTemplateLibraryPlan } from './admin-core-template-library-journeys.mjs';

export function buildCoreTemplateBulkPlan(input) {
  return buildCoreTemplateLibraryPlan(input).map(recipe => {
    const unused = input.fixtures.pages.templates.filter(row => row.kind === recipe.kind && row.assigned === false);
    assert.ok(unused.length >= 8, 'Bulk verification reserves the final two of eight independent unassigned fixtures.');
    const targets = unused.slice(-2);
    assert.ok(targets.every(row => row.name.startsWith('QA ' + recipe.kind + ' Unused ') && row.slug.startsWith('qa-admin-page-interaction-' + recipe.kind + '-')));
    assert.ok(targets.every(row => Number.isSafeInteger(row.id) && row.id > 0));
    assert.notEqual(targets[0].id, targets[1].id);
    assert.ok(targets.every(row => row.id !== recipe.source.id && row.id !== recipe.assigned.id));
    return {...recipe, targets, query: 'QA ' + recipe.kind + ' Unused ', ids: targets.map(row => row.id).sort((a,b) => a-b)};
  });
}

export function assertCoreTemplateBulkNative(result, recipe, action) {
  assert.equal(result.kind, 'form-save-native'); assert.equal(result.status, 'partial-not-global-pass');
  assert.equal(result.writes.length, recipe.targets.length);
  assert.deepEqual(result.writes.map(row => Number(row.id)).sort((a,b)=>a-b), recipe.ids);
  const actionName = 'content_block_template.' + (action === 'hide' ? 'unpublish' : action);
  const auditIds = new Set();
  for (const row of result.writes) {
    assert.equal(row.table, recipe.table); assert.equal(row.deleted, action === 'delete');
    if (action !== 'delete') assert.equal(row.actual.status, action === 'publish' ? 'published' : 'unpublished');
    assert.equal(row.audit.length, 1); assert.equal(row.audit[0].entity_id, null);
    assert.equal(row.audit[0].entity_label, recipe.table); assert.equal(row.audit[0].action, actionName);
    assert.ok(Number.isSafeInteger(Number(row.audit[0].actor_admin_user_id)) && Number(row.audit[0].actor_admin_user_id) > 0);
    auditIds.add(Number(row.audit[0].id));
  }
  assert.equal(auditIds.size, 1, 'Two target rows must share one exact aggregate command audit.');
}

/** Actual current bulk controls; original assigned templates are never selected. */
export async function runCoreTemplateBulkJourneys(ctx) {
  const {page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,nativeCheckpoint,databaseReadback} = ctx;
  assert.equal(new URL(origin).hostname,'127.0.0.1');
  const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
  const manifest=await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
  const {ADMIN_BULK_ACTION_LABELS:labels}=await jiti.import('../../src/lib/admin/entity-list/bulk-action-labels.ts');
  const plan=buildCoreTemplateBulkPlan({collectionAdoption:manifest.ADMIN_COLLECTION_SURFACE_ADOPTION,rowActions:manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,fixtures});
  const outcomes=[],bar=page.locator('[data-admin-bulk-action-bar]'),dialog=page.locator('[data-admin-confirm-dialog]');
  const visible=id=>page.locator('[data-admin-row-action="visibility"][data-admin-entity-id="'+id+'"] button');
  const isAction=request=>request.method()==='POST' && Boolean(request.headers()['next-action']) && new URL(request.url()).origin===origin;
  async function fingerprint(correlationId,phase){
    const result=await nativeCheckpoint({id:randomUUID(),kind:'form-permission-fingerprint',correlationId,phase});
    assert.equal(result.status,'pass');assert.equal(result.correlationId,correlationId);assert.equal(result.phase,phase);
    assert.equal(result.adminAuditIncluded,true);assert.ok(result.publicTableCount>0);return result;
  }
  function unchanged(before,after){for(const key of ['ownedRunId','publicTableCount','publicTableInventorySha256','publicDataSha256'])assert.equal(after[key],before[key]);}
  async function select(recipe,action){
    for(const row of recipe.targets)await page.getByRole('checkbox',{name:'تحديد '+row.name,exact:true}).check();
    await expect(bar).toHaveCount(1);
    assert.deepEqual((await bar.locator('input[name="ids"]').evaluateAll(nodes=>nodes.map(node=>Number(node.value)))).sort((a,b)=>a-b),recipe.ids);
    await bar.getByRole('combobox').click();
    await page.getByRole('option',{name:action==='hide'?labels.hideSelected:action==='publish'?labels.showSelected:labels.deleteSelected,exact:true}).click();
    await expect(bar.locator('input[name="bulk_action"]')).toHaveValue(action);
  }
  async function nativeSave(recipe,action,startedAt){
    const descriptors=recipe.targets.map(row=>({table:recipe.table,id:row.id,deleted:action==='delete',expected:action==='delete'?{}:{name:row.name,status:action==='publish'?'published':'unpublished'},
      auditEntityType:'content_block_template',auditEntityLabel:recipe.table,auditActions:['content_block_template.'+(action==='hide'?'unpublish':action)],
      auditMetadata:{blockType:recipe.kind,action,ids:recipe.ids,count:recipe.ids.length},auditSince:startedAt,exactAuditCount:1}));
    const result=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'template-bulk-'+recipe.kind,formConsumer:recipe.consumer,surface:'bulk',startedAt,descriptors});
    assertCoreTemplateBulkNative(result,recipe,action);return {result,descriptors};
  }
  for(const recipe of plan)await run('template-library-'+recipe.kind+'-actual-bulk-transport-retry-confirmation',[],async()=>{
    await observe('template-bulk-open',()=>page.goto(origin+recipe.route+'?q='+encodeURIComponent(recipe.query),{waitUntil:'domcontentloaded'}));
    for(const row of recipe.targets)await expect(visible(row.id)).toHaveAttribute('aria-pressed','true',{timeout:60_000});
    await select(recipe,'hide');
    // Fail the actual request before delivery; native proof distinguishes this
    // transport rejection from a database cancellation or a committed lost reply.
    const correlationId=randomUUID(),before=await fingerprint(correlationId,'before');let aborted=0;
    const reject=async route=>{if(isAction(route.request())&&new URL(route.request().url()).pathname===recipe.route){aborted++;await route.abort('failed');}else await route.fallback();};
    const removeRejectedRoute=await registerCorePageRoute(page,'**/*',reject);
    try{
      await bar.getByRole('button',{name:'تنفيذ',exact:true}).click();
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible({timeout:30_000});
      await expect(bar.getByRole('button',{name:'تنفيذ',exact:true})).toBeEnabled();assert.equal(aborted,1);
      for(const row of recipe.targets){await expect(visible(row.id)).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('checkbox',{name:'تحديد '+row.name,exact:true})).toBeChecked();}
    }finally{await removeRejectedRoute();}
    const rejected=await fingerprint(correlationId,'after');unchanged(before,rejected);
    const actual=[];
    for(const action of recipe.terminal?['hide','publish','delete']:['hide','publish']){
      if(action!=='hide')await select(recipe,action);
      let cancelledNative=null;
      if(action==='delete'){
        const cancelCorrelation=randomUUID(),prior=await fingerprint(cancelCorrelation,'before');let posts=0;
        const count=request=>{if(isAction(request))posts++;};page.on('request',count);
        try{
          await bar.getByRole('button',{name:'تنفيذ',exact:true}).click();await expect(dialog).toHaveCount(1);
          await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);
          await expect(bar.getByRole('button',{name:'تنفيذ',exact:true})).toBeFocused();assert.equal(posts,0);
        }finally{page.off('request',count);}
        const next=await fingerprint(cancelCorrelation,'after');unchanged(prior,next);cancelledNative={before:prior.id,after:next.id};
        await bar.getByRole('button',{name:'تنفيذ',exact:true}).click();await expect(dialog).toHaveCount(1);
      }
      const startedAt=new Date().toISOString();let release,heldResolve,requests=0,timer;
      const gate=new Promise(resolve=>{release=resolve;}),held=new Promise(resolve=>{heldResolve=resolve;});
      const hold=async route=>{if(!isAction(route.request())||new URL(route.request().url()).pathname!==recipe.route){await route.fallback();return;}requests++;heldResolve();await gate;await route.fallback();};
      const removeHeldRoute=await registerCorePageRoute(page,'**/*',hold);const response=actionResponse();response.catch(()=>{});
      const trigger=action==='delete'?dialog.locator('[data-admin-confirm-submit]'):bar.locator('button[type="submit"]');
      const clicked=trigger.click();clicked.catch(()=>{});
      try{
        await Promise.race([held,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actual bulk request was not observed.')),25_000);})]);
        await expect(bar).toHaveAttribute('aria-busy','true');await expect(bar.locator('button[type="submit"]')).toBeDisabled();
        if(action==='delete'){await expect(dialog.locator('[data-admin-confirm-submit]')).toBeDisabled();await expect(dialog.locator('[data-admin-confirm-cancel]')).toBeDisabled();}
        await trigger.evaluate(node=>node.click());assert.equal(requests,1);release();assertActionAcknowledged(await response);await clicked;
      }finally{clearTimeout(timer);release();await removeHeldRoute();}
      await expect(bar).toHaveCount(0,{timeout:60_000});await expect(dialog).toHaveCount(0);
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"]').first()).toBeVisible({timeout:30_000});
      await page.reload({waitUntil:'domcontentloaded'});
      for(const row of recipe.targets){if(action==='delete')await expect(visible(row.id)).toHaveCount(0);else await expect(visible(row.id)).toHaveAttribute('aria-pressed',action==='publish'?'true':'false',{timeout:60_000});}
      const native=await nativeSave(recipe,action,startedAt);actual.push({action,requests,native:native.result.id,cancelledNative});
      if(action===(recipe.terminal?'delete':'publish'))databaseReadback.push(...native.descriptors);
    }
    const result={consumer:recipe.consumer,kind:recipe.kind,targetIds:recipe.ids,actualCommands:actual,transportRejectedBeforeDelivery:true,nativeUnchangedAfterRejection:{before:before.id,after:rejected.id},
      pendingDuplicateBlocked:true,selectionRetainedOnFailure:true,selectionClearedAfterSuccess:true,nativeAggregateAuditPerCommand:1,
      terminal:recipe.terminal?'Only two dedicated unassigned synthetic templates deleted.':'No terminal command is declared; both original synthetic rows restored published.',
      boundary:'Actual bulk controls and pre-delivery transport failure. No database outage, server-side persistence rejection, unknown commit, or complete capability-axis claim.'};
    outcomes.push(result);return result;
  });
  return {outcomes,expectedLibraries:plan.length,globalClosed:false};
}
