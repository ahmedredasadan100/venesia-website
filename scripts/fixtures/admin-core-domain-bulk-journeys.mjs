import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption,resolveCoreScrollbarTerminalTarget} from "./admin-core-rendered-adoption.mjs";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createJiti } from 'jiti';
import ts from 'typescript';
import { expect } from 'playwright/test';
import { registerCorePageRoute } from './admin-core-form-permission-context.mjs';

// Verification recipes checked against current adoption claims and concrete
// options. They grant no Product capability and are never imported by Product.
const recipes = {
 'content-topics': {entity:'topics',table:'topics',audit:'topic',source:'src/components/admin/content/UnifiedContentList.tsx',route:'/admin/content/topics',active:['publish','unpublish','move_to_trash','move_category','feature','unfeature'],trash:['restore','permanent_delete'],steps:['unpublish','publish','feature','unfeature','move_category','move_to_trash','restore','move_to_trash','permanent_delete']},
 'content-series': {entity:'series',table:'topic_series',audit:'topic_series',source:'src/app/admin/content/series/SeriesTableClient.tsx',route:'/admin/content/series',active:['publish','hide','delete'],trash:['restore','permanent_delete'],steps:['hide','publish','delete','restore','delete','permanent_delete']},
 'content-categories': {entity:'categories',table:'topic_categories',audit:'topic_category',source:'src/app/admin/content/categories/CategoriesListClient.tsx',route:'/admin/content/categories',active:[],trash:['restore','permanent_delete'],steps:['restore','permanent_delete']},
 pages: {entity:'pages',table:'pages',audit:'page',source:'src/app/admin/pages-blocks/pages/PagesTableClient.tsx',route:'/admin/pages-blocks/pages',active:['delete'],trash:[],steps:['delete']},
};
function positive(value){assert.ok(Number.isSafeInteger(value)&&value>0);return value;}
function literalValues(array,ast){
 while(array&&(ts.isAsExpression(array)||ts.isParenthesizedExpression(array)))array=array.expression;
 assert.ok(array&&ts.isArrayLiteralExpression(array));
 return array.elements.map(row=>{assert.ok(ts.isObjectLiteralExpression(row));const prop=row.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(ast)==='value');assert.ok(prop&&ts.isStringLiteral(prop.initializer));return prop.initializer.text;});
}
export function inspectCoreBulkOptions(source,entity){
 const ast=ts.createSourceFile('consumer.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),arrays=new Map();let binding;
 function visit(node){
  if(ts.isVariableDeclaration(node)&&['BULK_OPTIONS','TRASH_BULK_OPTIONS'].includes(node.name.getText(ast)))arrays.set(node.name.getText(ast),literalValues(node.initializer,ast));
  if(ts.isJsxAttribute(node)&&node.name.getText(ast)==='bulkOptions'){assert.equal(binding,undefined);assert.ok(node.initializer&&ts.isJsxExpression(node.initializer));binding=node.initializer.expression;}
  ts.forEachChild(node,visit);
 }visit(ast);assert.ok(binding,'The consumer must pass actual bulkOptions to its shared list.');
 if(entity==='pages')return {active:literalValues(binding,ast),trash:[]};
 assert.ok(ts.isConditionalExpression(binding));assert.equal(binding.whenTrue.getText(ast),'TRASH_BULK_OPTIONS');
 assert.match(binding.condition.getText(ast),/^(?:isTrashView|trashView)$/);
 const active=entity==='categories'?literalValues(binding.whenFalse,ast):(assert.equal(binding.whenFalse.getText(ast),'BULK_OPTIONS'),arrays.get('BULK_OPTIONS'));
 return {active,trash:arrays.get('TRASH_BULK_OPTIONS')};
}
export function buildCoreDomainBulkPlan({claims,fixtures,sources}){
 assert.ok(Array.isArray(claims));const selected=claims.filter(row=>row.contracts.bulk==='adopted');
 assert.equal(new Set(claims.map(row=>row.surfaceId)).size,claims.length);
 assert.deepEqual(selected.map(row=>row.surfaceId).sort(),Object.keys(recipes).sort(),'Changed applicable claims require an explicit executable recipe.');
 const fixture=fixtures.bulkClosure;assert.ok(fixture&&/^qa-b2-[a-f0-9]{8}$/.test(fixture.namespace));positive(fixture.actorId);
 const destination=fixture.destination;positive(destination.id);assert.equal(destination.label,fixture.namespace+' destination');
 return selected.map(claim=>{
  const recipe=recipes[claim.surfaceId],observed=inspectCoreBulkOptions(sources[claim.surfaceId],recipe.entity);
  assert.deepEqual(observed,{active:recipe.active,trash:recipe.trash},'Option drift must not silently reduce executed operations.');
  const targets=fixture[recipe.entity];assert.ok(Array.isArray(targets)&&targets.length===2);const ids=targets.map(row=>positive(row.id)).sort((a,b)=>a-b);assert.notEqual(ids[0],ids[1]);
  for(const [index,row]of targets.entries()){assert.equal(row.label,fixture.namespace+' '+recipe.entity+' '+index);assert.equal(row.slug,fixture.namespace+'-'+recipe.entity+'-'+index);}
  const original=recipe.entity==='topics'?fixtures.topic.id:recipe.entity==='categories'?fixtures.category.id:recipe.entity==='series'?fixtures.series.id:fixtures.pages.pageId;
  assert.ok(!ids.includes(positive(original)),'Destructive bulk fixtures cannot borrow original rows.');
  if(recipe.entity==='categories')assert.ok(!ids.includes(destination.id));
  return {...recipe,consumer:claim.surfaceId,targets:[...targets].sort((a,b)=>a.id-b.id),ids,query:fixture.namespace+' '+recipe.entity,actorId:fixture.actorId,destination};
 });
}
export async function loadCoreDomainBulkPlan(fixtures){
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}),manifest=await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
 const sources=Object.fromEntries(Object.entries(recipes).map(([key,row])=>[key,readFileSync(new URL('../../'+row.source,import.meta.url),'utf8')]));
 return {plan:buildCoreDomainBulkPlan({claims:manifest.ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS,fixtures,sources}),
  sourceOnlyNotApplicable:manifest.ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS.filter(row=>row.contracts.bulk==='not_required').map(row=>({surface:row.surfaceId,proof:'Current manifest no-bulk contract only; no Browser behavior claim.'}))};
}
export function coreDomainBulkStep(recipe,action,ordinal){
 assert.equal(recipe.steps[ordinal],action);const trash=['restore','permanent_delete'].includes(action),deleted=action==='permanent_delete'||recipe.entity==='pages';
 const confirmation=recipe.entity==='pages'||action==='permanent_delete'||recipe.entity==='series'&&['delete','restore'].includes(action)||recipe.entity==='categories'||action==='move_to_trash';
 const verb=action==='hide'?'unpublish':action==='delete'&&recipe.entity==='series'||action==='move_to_trash'?'delete':['feature','unfeature','move_category'].includes(action)?'update':recipe.entity==='pages'?'delete':action;
 const fields={};if(!deleted){
  fields.status=['publish','feature','unfeature','move_category'].includes(action)?'published':'unpublished';
  if(recipe.entity==='topics'){fields.is_featured=action==='feature';if(ordinal>=4)fields.category_id=recipe.destination.id;}
  if(recipe.entity==='categories')fields.is_active=false;
 }
 const metadata=recipe.entity==='topics'?{atomic:true,topic_ids:recipe.ids,count:recipe.ids.length}
  :recipe.entity==='pages'?{persistence_owner:'mutate_page_composition',atomic:true}
  :recipe.entity==='series'&&['hide','publish'].includes(action)?{bulk_action:action,ids:recipe.ids}
  :{bulk:true,bulk_action:action==='delete'?'move_to_trash':action,[recipe.entity==='categories'?'category_ids':'series_ids']:recipe.ids,count:recipe.ids.length};
 return {action,ordinal,trash,deleted,confirmation,verb,fields,metadata,trashed:action==='move_to_trash'||recipe.entity==='series'&&action==='delete'};
}
export function coreDomainBulkDescriptors(recipe,step,startedAt,checkpoint){
 assert.equal(checkpoint.kind,'terminal-domain-state');assert.equal(checkpoint.entity,recipe.entity);assert.equal(checkpoint.status,'pass');assert.equal(checkpoint.expectedActorId,recipe.actorId);
 assert.deepEqual(checkpoint.rows.map(row=>Number(row.id)).sort((a,b)=>a-b),step.deleted?[]:recipe.ids);
 assert.equal(checkpoint.audit.length,recipe.entity==='pages'?2:recipe.entity==='topics'&&step.action==='publish'?3:1,'Unexpected missing or extra current-step domain audit.');
 assert.equal(new Set(checkpoint.audit.map(row=>Number(row.id))).size,checkpoint.audit.length);
 for(const row of checkpoint.audit)assert.equal(Number(row.actor_admin_user_id),recipe.actorId);
 for(const row of checkpoint.rows){if(recipe.entity!=='pages'){
  if(step.trashed)assert.ok(typeof row.deleted_at==='string'&&Number.isFinite(Date.parse(row.deleted_at)));else assert.equal(row.deleted_at,null);
 }for(const [key,value]of Object.entries(step.fields))if(Object.hasOwn(row,key))assert.deepEqual(row[key],value);}
 return recipe.targets.map(row=>({table:recipe.table,id:row.id,deleted:step.deleted,expected:step.deleted?{}:{[recipe.entity==='topics'?'title':'name']:row.label,...step.fields,deleted_at:checkpoint.rows.find(item=>Number(item.id)===row.id).deleted_at},
  auditEntityType:recipe.audit,auditEntityLabel:recipe.entity==='pages'?row.label:null,auditActions:[recipe.audit+'.'+step.verb],auditMetadata:{...step.metadata,...(recipe.entity==='pages'?{slug:row.slug,path:'/'+row.slug}:{})},auditSince:startedAt,exactAuditCount:1,...(recipe.entity==='topics'?{exactCommandReceiptCount:1}:{})}));
}
export function assertCoreDomainBulkNative(result,recipe,step){
 assert.equal(result.kind,'form-save-native');assert.equal(result.status,'partial-not-global-pass');assert.equal(result.caseId,'domain-bulk-'+recipe.entity);assert.equal(result.formConsumer,recipe.consumer);assert.equal(result.surface,'bulk');
 assert.equal(result.writes.length,2);assert.deepEqual(result.writes.map(row=>Number(row.id)).sort((a,b)=>a-b),recipe.ids);const ids=new Set();
 for(const row of result.writes){assert.equal(row.table,recipe.table);assert.equal(row.deleted,step.deleted);assert.equal(row.expectedActorId,recipe.actorId);assert.equal(row.audit.length,1);
  const audit=row.audit[0];assert.equal(Number(audit.actor_admin_user_id),recipe.actorId);assert.equal(audit.entity_type,recipe.audit);assert.equal(audit.entity_label,recipe.entity==='pages'?recipe.targets.find(target=>target.id===row.id).label:null);assert.equal(audit.action,recipe.audit+'.'+step.verb);
  assert.equal(Number.isSafeInteger(audit.entity_id)?audit.entity_id:audit.entity_id===null?null:Number(audit.entity_id),recipe.entity==='pages'?row.id:null);ids.add(positive(Number(audit.id)));
  if(recipe.entity==='topics')assert.equal(row.commandReceiptCount,1);
  if(!step.deleted)for(const [key,value]of Object.entries(step.fields))assert.deepEqual(row.actual[key],value);
 }
 assert.equal(ids.size,recipe.entity==='pages'?2:1,'Audit cardinality follows the actual per-row or aggregate owner.');
}


/** Only ephemeral command UUIDs are returned; raw Action bodies are never persisted. */
export function readCoreBulkCommandIdentity(body){
 assert.equal(typeof body,'string');const ids=[...new Set(body.match(/\b[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\b/gi)??[])];
 assert.equal(ids.length,1,'A fixed Topics request must carry one unambiguous command UUID.');return ids[0].toLowerCase();
}

/** Row presence is independent of whether this view permits bulk selection. */
export async function assertCoreBulkTarget(page,target,{visible=true,timeout=60_000}={}){
 positive(target.id);assert.equal(typeof target.label,'string');assert.ok(target.label.length>0);
 const row=page.locator('tr[data-entity-row-id="'+target.id+'"]');
 if(visible){await expect(row).toHaveCount(1,{timeout});await expect(row).toBeVisible({timeout});await expect(row).toContainText(target.label,{timeout});}
 else await expect(row).toHaveCount(0,{timeout});
}

/** Actual bulk UI on independent targets. Global Empty Trash is never invoked. */
export async function runCoreDomainBulkJourneys(ctx){
 const {page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,nativeCheckpoint,databaseReadback,requiredCases}=ctx;
 assert.equal(new URL(origin).hostname,'127.0.0.1');const {plan,sourceOnlyNotApplicable}=await loadCoreDomainBulkPlan(fixtures);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}),{ADMIN_BULK_ACTION_LABELS:labels}=await jiti.import('../../src/lib/admin/entity-list/bulk-action-labels.ts');
 const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import('../../src/lib/admin/form-system/adoption-manifest.ts');
 let renderedAdoption=[],renderedConfirmed=false;
 const oneShotBase=()=>({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:'list-bulk-row-one-shot-actions',surface:'bulk-command'}]});
 const names={publish:labels.showSelected,unpublish:labels.hideSelected,hide:labels.hideSelected,delete:labels.deleteSelected,move_to_trash:labels.deleteSelected,restore:labels.restoreSelected,permanent_delete:labels.permanentlyDeleteSelected,move_category:'نقل لتصنيف',feature:'تعيين كمميز',unfeature:'إلغاء التمييز'};
 const bar=page.locator('[data-admin-bulk-action-bar]'),dialog=page.locator('[data-admin-confirm-dialog]'),outcomes=[];
 const actionRequest=(request,recipe)=>request.method()==='POST'&&Boolean(request.headers()['next-action'])&&new URL(request.url()).origin===origin&&new URL(request.url()).pathname===recipe.route;
 const selection=target=>page.getByRole('checkbox',{name:'تحديد '+target.label,exact:true});
 async function navigate(recipe,trash){await observe('domain-bulk-open-'+recipe.entity,()=>page.goto(origin+recipe.route+'?q='+encodeURIComponent(recipe.query)+(trash?'&view=trash':''),{waitUntil:'domcontentloaded'}));for(const target of recipe.targets)await assertCoreBulkTarget(page,target);}
 async function fingerprint(correlationId,phase){const value=await nativeCheckpoint({id:randomUUID(),kind:'form-permission-fingerprint',correlationId,phase});assert.equal(value.status,'pass');assert.equal(value.correlationId,correlationId);assert.equal(value.phase,phase);assert.equal(value.adminAuditIncluded,true);assert.ok(value.publicTableCount>0);return value;}
 function unchanged(before,after){for(const key of ['ownedRunId','publicTableCount','publicTableInventorySha256','publicDataSha256'])assert.equal(after[key],before[key]);}
 async function select(recipe,step){
  for(const target of recipe.targets)await selection(target).check();await expect(bar).toHaveCount(1);
  assert.deepEqual((await bar.locator('input[name="ids"]').evaluateAll(nodes=>nodes.map(node=>Number(node.value)))).sort((a,b)=>a-b),recipe.ids);
  await bar.getByRole('combobox').first().click();await page.getByRole('option',{name:names[step.action],exact:true}).click();await expect(bar.locator('input[name="bulk_action"]')).toHaveValue(step.action);
  if(step.action==='move_category'){await page.locator('#content-topics-bulk-category-trigger').click();await page.getByRole('option',{name:recipe.destination.label,exact:true}).click();}
 }
 async function openConfirm(step){if(step.confirmation){await bar.getByRole('button',{name:'تنفيذ',exact:true}).click();await expect(dialog).toHaveCount(1);}}
 async function cancelConfirmation(recipe,step){
  if(!step.confirmation)return null;const correlation=randomUUID(),before=await fingerprint(correlation,'before');let posts=0;const count=request=>{if(actionRequest(request,recipe))posts++;};page.on('request',count);
  try{await openConfirm(step);if(!renderedConfirmed){renderedAdoption.push(await observeCoreModalFocusAdoption({...oneShotBase(),id:'domain-bulk-'+recipe.entity+'-confirm-focus',dialog,state:'dirty-confirmation',escape:'not-exercised'}));renderedConfirmed=true;}await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);await expect(bar.getByRole('button',{name:'تنفيذ',exact:true})).toBeFocused();assert.equal(posts,0);}finally{page.off('request',count);}
  const after=await fingerprint(correlation,'after');unchanged(before,after);for(const target of recipe.targets)await expect(selection(target)).toBeChecked();return {before:before.id,after:after.id};
 }
 async function rejectUnknownTopicDelivery(recipe,step){
  assert.equal(recipe.entity,'topics');assert.equal(step.confirmation,false);const correlation=randomUUID(),before=await fingerprint(correlation,'before');
  let commandId,mutationAction,recoveryAction,attempts=0,recoveryRequests=0;
  const remove=await registerCorePageRoute(page,'**/*',async route=>{
   const request=route.request();if(!actionRequest(request,recipe)){await route.fallback();return;}
   const identity=readCoreBulkCommandIdentity(request.postData()),action=request.headers()['next-action'];
   if(!commandId){commandId=identity;mutationAction=action;attempts++;await route.abort('failed');return;}
   assert.equal(identity,commandId,'Automatic and explicit receipt recovery must retain the authored command identity.');
   assert.notEqual(action,mutationAction,'A lost reply must never replay the original mutation.');
   if(recoveryAction===undefined)recoveryAction=action;else assert.equal(action,recoveryAction,'Automatic and manual recovery must use the same actual receipt Action.');recoveryRequests++;assert.ok(recoveryRequests<=2);await route.fallback();
  });
  const recovery=page.getByRole('button',{name:'استعادة نتيجة العملية',exact:true});
  try{
   await bar.getByRole('button',{name:'تنفيذ',exact:true}).click();await expect(recovery).toBeEnabled({timeout:30_000});
   await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
   assert.equal(attempts,1);assert.equal(recoveryRequests,1);for(const target of recipe.targets)await expect(selection(target)).toBeChecked();
   const response=actionResponse();response.catch(()=>{});await recovery.click();assertActionAcknowledged(await response);await expect(recovery).toBeEnabled({timeout:30_000});
   await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
   assert.equal(attempts,1);assert.equal(recoveryRequests,2);for(const target of recipe.targets)await expect(selection(target)).toBeChecked();
  }finally{await remove();}
  const after=await fingerprint(correlation,'after');unchanged(before,after);
  // With no durable receipt the existing contract stays unknown. A full reload
  // ends that mounted scope; the ordinary schedule below authors a NEW command.
  await page.reload({waitUntil:'domcontentloaded'});await expect(recovery).toHaveCount(0);await select(recipe,step);
  return {before:before.id,after:after.id,attempts,commandId,recoveryRequests,sameRecoveryAction:true,originalMutationReplayed:false,unresolvedAfterRead:true,nextCommandScope:'explicit-new-command-after-full-reload',classification:'Pre-delivery abort plus same-identity receipt reads; no receipt exists. No rollback, resolved result or same-command retry claim.'};
 }
 async function rejectBeforeDelivery(recipe,step){
  if(recipe.entity==='topics')return rejectUnknownTopicDelivery(recipe,step);
  const correlation=randomUUID(),before=await fingerprint(correlation,'before');await openConfirm(step);let count=0;
  const remove=await registerCorePageRoute(page,'**/*',async route=>{if(actionRequest(route.request(),recipe)){count++;await route.abort('failed');}else await route.fallback();});
  try{await (step.confirmation?dialog.locator('[data-admin-confirm-submit]'):bar.getByRole('button',{name:'تنفيذ',exact:true})).click();
   await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible({timeout:30_000});assert.equal(count,1);
   if(step.confirmation){await expect(dialog).toHaveCount(0);await expect(bar.getByRole('button',{name:'تنفيذ',exact:true})).toBeFocused();}
   await expect(bar.getByRole('button',{name:'تنفيذ',exact:true})).toBeEnabled();for(const target of recipe.targets)await expect(selection(target)).toBeChecked();
  }finally{await remove();}
  const after=await fingerprint(correlation,'after');unchanged(before,after);return {before:before.id,after:after.id,attempts:count,classification:'Pre-delivery transport rejection; no database-failure or commit-loss claim.'};
 }
 async function held(recipe,trigger,confirmation=true,bulk=true){
  let release,seen,timer,count=0;const gate=new Promise(resolve=>{release=resolve;}),observed=new Promise(resolve=>{seen=resolve;});
  const remove=await registerCorePageRoute(page,'**/*',async route=>{if(!actionRequest(route.request(),recipe)){await route.fallback();return;}count++;seen();await gate;await route.fallback();});
  const response=actionResponse();response.catch(()=>{});const clicked=trigger.click();clicked.catch(()=>{});
  try{await Promise.race([observed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Bulk command did not reach its real request boundary.')),25_000);})]);
   if(bulk){await expect(bar).toHaveCount(1);await expect(bar).toHaveAttribute('aria-busy','true');await expect(bar.locator('button[type="submit"]')).toBeDisabled();}
   if(confirmation){await expect(dialog.locator('[data-admin-confirm-submit]')).toBeDisabled();await expect(dialog.locator('[data-admin-confirm-cancel]')).toBeDisabled();}
   await trigger.evaluate(button=>button.click());assert.equal(count,1);release();assertActionAcknowledged(await response);await clicked;assert.equal(count,1);
  }finally{clearTimeout(timer);release();await remove();}return count;
 }
 async function probe(recipe,startedAt){return nativeCheckpoint({id:randomUUID(),kind:'terminal-domain-state',entity:recipe.entity,ids:recipe.ids,startedAt});}
 async function reTrashCategories(recipe){
  await navigate(recipe,false);const prepared=[];
  for(const target of recipe.targets){const startedAt=new Date().toISOString(),more=page.locator('[data-admin-row-action="more"][data-admin-entity-id="'+target.id+'"] button');await more.click();
   await page.locator('[data-admin-row-actions-menu][data-admin-entity-id="'+target.id+'"] [data-admin-row-action-menu-item="delete"]').click();await expect(dialog).toHaveCount(1);
   await held(recipe,dialog.locator('[data-admin-confirm-submit]'),true,false);await expect(dialog).toHaveCount(0);await assertCoreBulkTarget(page,target,{visible:false});
   const request={table:'topic_categories',id:target.id,expected:{name:target.label,status:'unpublished',is_active:false},auditEntityType:'topic_category',auditEntityLabel:target.label,auditActions:['topic_category.delete'],auditMetadata:{bulk:false,bulk_action:'move_to_trash',category_ids:[target.id],count:1},auditSince:startedAt,exactAuditCount:1};
   const result=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'domain-bulk-categories-prepare',formConsumer:recipe.consumer,surface:'row-preparation',startedAt,descriptors:[request]});
   assert.equal(result.status,'partial-not-global-pass');assert.equal(result.writes.length,1);assert.equal(result.writes[0].expectedActorId,recipe.actorId);prepared.push(result.id);
  }return prepared;
 }
 for(const recipe of plan)await run('domain-bulk-'+recipe.entity+'-registered-options',[],async()=>{
  renderedAdoption=[];renderedConfirmed=false;
  const actual=[],preparations=[];let rejection;
  for(const [ordinal,action]of recipe.steps.entries()){
   const step=coreDomainBulkStep(recipe,action,ordinal);if(recipe.entity==='categories'&&ordinal===1)preparations.push(...await reTrashCategories(recipe));
   await navigate(recipe,step.trash);await select(recipe,step);
   if(ordinal===0){const container=page.locator('[data-admin-data-grid-scroll]');await expect(container).toHaveCount(1);const row=container.locator('tr[data-entity-row-id="'+recipe.targets[0].id+'"]');const target=row.locator('td[data-admin-column-key]:not([data-admin-grid-sticky])').last();renderedAdoption.push(await observeCoreScrollbarAdoption({...oneShotBase(),id:'domain-bulk-'+recipe.entity+'-selected-grid-scroll',container,target,axis:'x',containment:'overscroll-contain'}));}
   const cancelled=await cancelConfirmation(recipe,step);
   if(ordinal===0)rejection=await rejectBeforeDelivery(recipe,step);
   await openConfirm(step);const startedAt=new Date().toISOString(),trigger=step.confirmation?dialog.locator('[data-admin-confirm-submit]'):bar.locator('button[type="submit"]');
   const requests=await held(recipe,trigger,step.confirmation);await expect(dialog).toHaveCount(0);await expect(bar).toHaveCount(0,{timeout:60_000});
   await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"]').first()).toBeVisible({timeout:30_000});
   await page.reload({waitUntil:'domcontentloaded'});
   for(const target of recipe.targets)await assertCoreBulkTarget(page,target,{visible:!(step.deleted||step.trash||step.trashed)});
   const state=await probe(recipe,startedAt),descriptors=coreDomainBulkDescriptors(recipe,step,startedAt,state);
   let nativeCommandId;
   if(recipe.entity==='topics'){
    const receipts=state.audit.filter(row=>row.metadata?.command);assert.equal(receipts.length,1);
    nativeCommandId=receipts[0].metadata.command.id;assert.match(nativeCommandId,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    if(ordinal===0)assert.notEqual(nativeCommandId,rejection.commandId,'The explicit command after reload must use a new native receipt identity.');
   }
   const saved=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'domain-bulk-'+recipe.entity,formConsumer:recipe.consumer,surface:'bulk',startedAt,descriptors});assertCoreDomainBulkNative(saved,recipe,step);
   // Publication retains per-topic domain audits in addition to the aggregate
   // immutable receipt. Both kinds remain mandatory, separately attributed.
   let publicationAudit=null;if(recipe.entity==='topics'&&action==='publish'){
    const rows=recipe.targets.map(row=>({table:'topics',id:row.id,expected:{title:row.label,status:'published'},auditEntityType:'topic',auditEntityLabel:row.label,auditActions:['topic.publish'],auditMetadata:{operation:'bulk_publish',atomic:true},auditSince:startedAt,exactAuditCount:1,exactCommandReceiptCount:0}));
    const result=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'domain-bulk-topics-publication',formConsumer:recipe.consumer,surface:'bulk-publication-audit',startedAt,descriptors:rows});assert.equal(result.writes.length,2);for(const row of result.writes)assert.equal(row.expectedActorId,recipe.actorId);publicationAudit=result.id;
   }
   actual.push({action,ordinal,requests,nativeState:state.id,nativeWrite:saved.id,publicationAudit,cancelled,...(nativeCommandId?{commandId:nativeCommandId}:{})});if(ordinal===recipe.steps.length-1)databaseReadback.push(...descriptors);
  }
  const result={renderedAdoption,entity:recipe.entity,consumer:recipe.consumer,targetIds:recipe.ids,actualCommands:actual,preparationNativeIds:preparations,rejection,pendingDuplicateBlocked:true,selectionRetainedOnFailure:true,selectionClearedAfterSuccess:true};outcomes.push(result);return result;
 });
 return {status:outcomes.length===plan.length?'pass':'incomplete',outcomes,expectedConsumers:plan.length,sourceOnlyNotApplicable,automaticCoverage:[],globalClosed:false,
  boundary:'Only named current bulk commands on disposable rows; no global Empty Trash, permission outage, persistence fault, mixed protected-page batch, or complete capability-axis claim.'};
}



/** A fresh observation of the shared floating Information panel, not a trapped Modal. */
export async function observeCoreAtomicInformationScroll({page,origin,requiredCases,formManifest,consumer,nativeEntityId,information,trigger,id}){
 assert.equal(consumer,'topics');positive(nativeEntityId);assert.equal(id,'atomic-topics-information-scroll');
 await expect(information).toHaveCount(1);await expect(information).toHaveAttribute('data-admin-entity-id',String(nativeEntityId));await expect(information).toHaveAttribute('role','dialog');await expect(trigger).toHaveCount(1);await expect(trigger.locator('xpath=ancestor::*[@data-admin-row-action="more"][1]')).toHaveAttribute('data-admin-entity-id',String(nativeEntityId));
 const receipt=await observeCoreScrollbarAdoption({page,origin,requiredCases,formManifest,bindings:[{boundary:'form',consumer:'list-bulk-row-one-shot-actions',surface:'row-command'}],id,container:information,target:({container,axis})=>resolveCoreScrollbarTerminalTarget({container,axis,candidates:[information.getByRole('button',{name:'رجوع',exact:true}),information.locator('[data-admin-row-actions-information-content]').locator('p,dd').last()]}),axis:'y',containment:'overscroll-contain'});
 await page.keyboard.press('Escape');await expect(information).toHaveCount(0);await expect(trigger).toBeFocused();
 return {renderedAdoption:[receipt],nativeEntityId,closed:true,exactTriggerFocusReturned:true,acceptedCommand:false,automaticCoverage:[],globalClosed:false};
}

export function assertCoreAtomicCancellationNative(before,after){
 for(const row of [before,after]){assert.equal(row.kind,'form-permission-fingerprint');assert.equal(row.status,'pass');assert.equal(row.adminAuditIncluded,true);assert.ok(row.publicTableCount>0);assert.match(row.id,/^[a-f0-9-]{36}$/u);assert.match(row.correlationId,/^[a-f0-9-]{36}$/u);assert.ok(typeof row.ownedRunId==='string'&&row.ownedRunId.length>0);for(const key of ['publicTableInventorySha256','publicDataSha256'])assert.match(row[key],/^[a-f0-9]{64}$/u);}
 assert.equal(before.phase,'before');assert.equal(after.phase,'after');assert.notEqual(before.id,after.id);assert.equal(after.correlationId,before.correlationId);
 for(const key of ['ownedRunId','publicTableCount','publicTableInventorySha256','publicDataSha256'])assert.equal(after[key],before[key]);
 return {before:before.id,after:after.id};
}

/** Observe only the existing Topics delete confirmation and cancel without delivery. */
export async function runCoreAtomicConfirmationJourney(ctx){
 const {page,origin,fixtures,run,observe,nativeCheckpoint,requiredCases}=ctx;assert.equal(new URL(origin).hostname,'127.0.0.1');
 const {plan}=await loadCoreDomainBulkPlan(fixtures),recipe=plan.find(row=>row.entity==='topics');assert.ok(recipe);const action='move_to_trash',step=coreDomainBulkStep(recipe,action,recipe.steps.indexOf(action));assert.equal(step.confirmation,true);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}),{ADMIN_BULK_ACTION_LABELS:labels}=await jiti.import('../../src/lib/admin/entity-list/bulk-action-labels.ts'),{ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:formManifest}=await jiti.import('../../src/lib/admin/form-system/adoption-manifest.ts');
 return run('core-atomic-confirmation-cancel',[],async()=>{
  const correlationId=randomUUID(),checkpoint=async phase=>{const request={id:randomUUID(),kind:'form-permission-fingerprint',correlationId,phase},value=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(value[key],request[key]);return value;};
  await observe('atomic-owned-topics',()=>page.goto(origin+recipe.route+'?q='+encodeURIComponent(recipe.query),{waitUntil:'domcontentloaded'}));for(const target of recipe.targets)await assertCoreBulkTarget(page,target);
  const before=await checkpoint('before'),target=recipe.targets[0],selection=page.getByRole('checkbox',{name:'تحديد '+target.label,exact:true}),bar=page.locator('[data-admin-bulk-action-bar]'),dialog=page.locator('[data-admin-confirm-dialog]');let posts=0;const count=r=>{if(r.method()==='POST'&&r.headers()['next-action']&&new URL(r.url()).origin===origin)posts++;};page.on('request',count);
  try{
   await selection.check();await expect(bar).toHaveCount(1);assert.deepEqual(await bar.locator('input[name="ids"]').evaluateAll(nodes=>nodes.map(n=>Number(n.value))),[target.id]);await bar.getByRole('combobox').first().click();await page.getByRole('option',{name:labels.deleteSelected,exact:true}).click();await expect(bar.locator('input[name="bulk_action"]')).toHaveValue(action);
   const trigger=bar.getByRole('button',{name:'تنفيذ',exact:true});await trigger.click();await expect(dialog).toHaveCount(1);
   const rendered=await observeCoreModalFocusAdoption({page,origin,requiredCases,formManifest,bindings:[{boundary:'form',consumer:'list-bulk-row-one-shot-actions',surface:'bulk-command'}],id:'atomic-existing-bulk-confirmation-focus',dialog,state:'dirty-confirmation',escape:'not-exercised'});
   await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(selection).toBeChecked();assert.equal(posts,0);await bar.getByRole('button',{name:'إلغاء التحديد',exact:true}).click();await expect(bar).toHaveCount(0);
   const after=await checkpoint('after'),native=assertCoreAtomicCancellationNative(before,after);return {consumer:'list-bulk-row-one-shot-actions',targetId:target.id,route:recipe.route,renderedAdoption:[rendered],nativeIds:[native.before,native.after],cancelled:true,accepted:false,writes:0,automaticCoverage:[],globalClosed:false};
  }finally{page.off('request',count);}
 });
}
