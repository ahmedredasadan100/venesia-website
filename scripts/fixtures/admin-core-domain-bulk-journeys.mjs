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
 pages: {entity:'pages',table:'pages',audit:'page_composition',source:'src/app/admin/pages-blocks/pages/PagesTableClient.tsx',route:'/admin/pages-blocks/pages',active:['delete'],trash:[],steps:['delete']},
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
 const verb=action==='hide'?'unpublish':action==='delete'&&recipe.entity==='series'||action==='move_to_trash'?'delete':['feature','unfeature','move_category'].includes(action)?'update':recipe.entity==='pages'?'delete_page':action;
 const fields={};if(!deleted){
  fields.status=['publish','feature','unfeature','move_category'].includes(action)?'published':'unpublished';
  if(recipe.entity==='topics'){fields.is_featured=action==='feature';if(ordinal>=4)fields.category_id=recipe.destination.id;}
  if(recipe.entity==='categories')fields.is_active=false;
 }
 const metadata=recipe.entity==='topics'?{atomic:true,topic_ids:recipe.ids,count:recipe.ids.length}
  :recipe.entity==='pages'?{operation:'delete_page',persistence_owner:'mutate_page_composition',atomic:true}
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
  auditEntityType:recipe.audit,auditEntityLabel:null,auditActions:[recipe.audit+'.'+step.verb],auditMetadata:step.metadata,auditSince:startedAt,exactAuditCount:1,...(recipe.entity==='topics'?{exactCommandReceiptCount:1}:{})}));
}
export function assertCoreDomainBulkNative(result,recipe,step){
 assert.equal(result.kind,'form-save-native');assert.equal(result.status,'partial-not-global-pass');assert.equal(result.caseId,'domain-bulk-'+recipe.entity);assert.equal(result.formConsumer,recipe.consumer);assert.equal(result.surface,'bulk');
 assert.equal(result.writes.length,2);assert.deepEqual(result.writes.map(row=>Number(row.id)).sort((a,b)=>a-b),recipe.ids);const ids=new Set();
 for(const row of result.writes){assert.equal(row.table,recipe.table);assert.equal(row.deleted,step.deleted);assert.equal(row.expectedActorId,recipe.actorId);assert.equal(row.audit.length,1);
  const audit=row.audit[0];assert.equal(Number(audit.actor_admin_user_id),recipe.actorId);assert.equal(audit.entity_type,recipe.audit);assert.equal(audit.entity_label,null);assert.equal(audit.action,recipe.audit+'.'+step.verb);
  assert.equal(Number.isSafeInteger(audit.entity_id)?audit.entity_id:audit.entity_id===null?null:Number(audit.entity_id),recipe.entity==='pages'?row.id:null);ids.add(positive(Number(audit.id)));
  if(recipe.entity==='topics')assert.equal(row.commandReceiptCount,1);
  if(!step.deleted)for(const [key,value]of Object.entries(step.fields))assert.deepEqual(row.actual[key],value);
 }
 assert.equal(ids.size,recipe.entity==='pages'?2:1,'Audit cardinality follows the actual per-row or aggregate owner.');
}


/** Actual bulk UI on independent targets. Global Empty Trash is never invoked. */
export async function runCoreDomainBulkJourneys(ctx){
 const {page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,nativeCheckpoint,databaseReadback}=ctx;
 assert.equal(new URL(origin).hostname,'127.0.0.1');const {plan,sourceOnlyNotApplicable}=await loadCoreDomainBulkPlan(fixtures);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}),{ADMIN_BULK_ACTION_LABELS:labels}=await jiti.import('../../src/lib/admin/entity-list/bulk-action-labels.ts');
 const names={publish:labels.showSelected,unpublish:labels.hideSelected,hide:labels.hideSelected,delete:labels.deleteSelected,move_to_trash:labels.deleteSelected,restore:labels.restoreSelected,permanent_delete:labels.permanentlyDeleteSelected,move_category:'نقل لتصنيف',feature:'تعيين كمميز',unfeature:'إلغاء التمييز'};
 const bar=page.locator('[data-admin-bulk-action-bar]'),dialog=page.locator('[data-admin-confirm-dialog]'),outcomes=[];
 const actionRequest=(request,recipe)=>request.method()==='POST'&&Boolean(request.headers()['next-action'])&&new URL(request.url()).origin===origin&&new URL(request.url()).pathname===recipe.route;
 const selection=target=>page.getByRole('checkbox',{name:'تحديد '+target.label,exact:true});
 async function navigate(recipe,trash){await observe('domain-bulk-open-'+recipe.entity,()=>page.goto(origin+recipe.route+'?q='+encodeURIComponent(recipe.query)+(trash?'&view=trash':''),{waitUntil:'domcontentloaded'}));for(const target of recipe.targets)await expect(selection(target)).toBeVisible({timeout:60_000});}
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
  try{await openConfirm(step);await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);await expect(bar.getByRole('button',{name:'تنفيذ',exact:true})).toBeFocused();assert.equal(posts,0);}finally{page.off('request',count);}
  const after=await fingerprint(correlation,'after');unchanged(before,after);for(const target of recipe.targets)await expect(selection(target)).toBeChecked();return {before:before.id,after:after.id};
 }
 async function rejectBeforeDelivery(recipe,step){
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
   await held(recipe,dialog.locator('[data-admin-confirm-submit]'),true,false);await expect(dialog).toHaveCount(0);await expect(selection(target)).toHaveCount(0,{timeout:60_000});
   const request={table:'topic_categories',id:target.id,expected:{name:target.label,status:'unpublished',is_active:false},auditEntityType:'topic_category',auditEntityLabel:target.label,auditActions:['topic_category.delete'],auditMetadata:{bulk:false,bulk_action:'move_to_trash',category_ids:[target.id],count:1},auditSince:startedAt,exactAuditCount:1};
   const result=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'domain-bulk-categories-prepare',formConsumer:recipe.consumer,surface:'row-preparation',startedAt,descriptors:[request]});
   assert.equal(result.status,'partial-not-global-pass');assert.equal(result.writes.length,1);assert.equal(result.writes[0].expectedActorId,recipe.actorId);prepared.push(result.id);
  }return prepared;
 }
 for(const recipe of plan)await run('domain-bulk-'+recipe.entity+'-registered-options',[],async()=>{
  const actual=[],preparations=[];let rejection;
  for(const [ordinal,action]of recipe.steps.entries()){
   const step=coreDomainBulkStep(recipe,action,ordinal);if(recipe.entity==='categories'&&ordinal===1)preparations.push(...await reTrashCategories(recipe));
   await navigate(recipe,step.trash);await select(recipe,step);const cancelled=await cancelConfirmation(recipe,step);
   if(ordinal===0)rejection=await rejectBeforeDelivery(recipe,step);
   await openConfirm(step);const startedAt=new Date().toISOString(),trigger=step.confirmation?dialog.locator('[data-admin-confirm-submit]'):bar.locator('button[type="submit"]');
   const requests=await held(recipe,trigger,step.confirmation);await expect(dialog).toHaveCount(0);await expect(bar).toHaveCount(0,{timeout:60_000});
   await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"]').first()).toBeVisible({timeout:30_000});
   await page.reload({waitUntil:'domcontentloaded'});
   for(const target of recipe.targets)if(step.deleted||step.trash||step.trashed)await expect(selection(target)).toHaveCount(0);else await expect(selection(target)).toBeVisible({timeout:60_000});
   const state=await probe(recipe,startedAt),descriptors=coreDomainBulkDescriptors(recipe,step,startedAt,state);
   const saved=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'domain-bulk-'+recipe.entity,formConsumer:recipe.consumer,surface:'bulk',startedAt,descriptors});assertCoreDomainBulkNative(saved,recipe,step);
   // Publication retains per-topic domain audits in addition to the aggregate
   // immutable receipt. Both kinds remain mandatory, separately attributed.
   let publicationAudit=null;if(recipe.entity==='topics'&&action==='publish'){
    const rows=recipe.targets.map(row=>({table:'topics',id:row.id,expected:{title:row.label,status:'published'},auditEntityType:'topic',auditEntityLabel:row.label,auditActions:['topic.publish'],auditMetadata:{operation:'bulk_publish',atomic:true},auditSince:startedAt,exactAuditCount:1,exactCommandReceiptCount:0}));
    const result=await nativeCheckpoint({id:randomUUID(),kind:'form-save-native',caseId:'domain-bulk-topics-publication',formConsumer:recipe.consumer,surface:'bulk-publication-audit',startedAt,descriptors:rows});assert.equal(result.writes.length,2);for(const row of result.writes)assert.equal(row.expectedActorId,recipe.actorId);publicationAudit=result.id;
   }
   actual.push({action,ordinal,requests,nativeState:state.id,nativeWrite:saved.id,publicationAudit,cancelled});if(ordinal===recipe.steps.length-1)databaseReadback.push(...descriptors);
  }
  const result={entity:recipe.entity,consumer:recipe.consumer,targetIds:recipe.ids,actualCommands:actual,preparationNativeIds:preparations,rejection,pendingDuplicateBlocked:true,selectionRetainedOnFailure:true,selectionClearedAfterSuccess:true};outcomes.push(result);return result;
 });
 return {status:outcomes.length===plan.length?'pass':'incomplete',outcomes,expectedConsumers:plan.length,sourceOnlyNotApplicable,automaticCoverage:[],globalClosed:false,
  boundary:'Only named current bulk commands on disposable rows; no global Empty Trash, permission outage, persistence fault, mixed protected-page batch, or complete capability-axis claim.'};
}

