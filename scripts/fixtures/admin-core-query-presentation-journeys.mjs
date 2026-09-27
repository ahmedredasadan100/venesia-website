import {registerCorePageRoute} from './admin-core-form-permission-context.mjs';
import assert from 'node:assert/strict';
import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption,observeCoreModalCleanReturn,validateCoreRenderedAdoptionBindings} from './admin-core-rendered-adoption.mjs';
import { randomUUID } from 'node:crypto';
import { expect } from 'playwright/test';
import { loadCoreQueryPresentationPlan, CORE_QUERY_SEARCH_SCENARIOS,coreQueryStaleOwner,coreQueryStaleRequestMatches,coreQueryViewScenarios, coreQueryExtraFilterCases } from './admin-core-query-presentation-plan.mjs';

export function assertCoreQueryProjection(receipt,payload){
 assert.deepEqual(payload.rows.map(row=>Number(row.id)),receipt.expectedIds,'API must return the exact native ordered page.');
 assert.deepEqual(payload.pagination,receipt.pagination,'API count/page/clamp must equal the native complete fixture set.');
 assert.equal(new Set(payload.rows.map(row=>Number(row.id))).size,payload.rows.length);
}
export function assertCoreQueryLocation(spec,fixture,receipt,actualUrl,origin){
 const url=new URL(actualUrl);assert.equal(url.origin,origin);assert.equal(url.pathname,receipt.route);
 const actual=spec.normalizeQuery(url.searchParams,fixture),expected=spec.normalizeQuery(new URLSearchParams(receipt.query),fixture);
 // Match current route-owned query normalization and the real server's bounded page clamp.
 actual.page=Math.min(actual.page,receipt.pagination.totalPages);expected.page=receipt.pagination.page;
 assert.deepEqual(actual,expected,'Browser URL semantics must match the native page, sort, filters, query and size.');
}
export async function assertCoreQueryInformation(spec,row,info){
 await expect(info).toBeVisible();await expect(info).toHaveAttribute('data-admin-entity-id',String(row.id));
 if(spec.entity==='topics'){
  assert.ok(Number.isSafeInteger(row.information?.viewCount)&&row.information.viewCount>=0,'Native Topic view count is required.');
  await expect(info.locator('[data-admin-row-actions-information-title]')).toHaveText('معلومات نشاط المحتوى');
  await expect(info).toContainText('عدد المشاهدات:');
  await expect(info.getByText(row.information.viewCount.toLocaleString('en-US')+' مشاهدة',{exact:true})).toHaveCount(1);
  return {kind:'information',nativeEntityId:row.id,nativeViewCount:row.information.viewCount,actualActivityPanel:true};
 }
 if(spec.entity==='pages'){
  assert.ok(Number.isSafeInteger(row.id)&&row.id>0,'Native Page identity is required.');
  assert.ok(typeof row.publicPath==='string'&&row.publicPath.startsWith('/')&&!row.publicPath.startsWith('//'),'Native canonical Page path is required.');
  await expect(info.locator('[data-admin-row-actions-information-title]')).toHaveText('معلومات الصفحة');
  const nativeId=info.locator('dt').filter({hasText:/^المعرف$/u}).locator('..').locator('dd');
  const nativePath=info.locator('dt').filter({hasText:/^المسار$/u}).locator('..').locator('dd');
  await expect(nativeId).toBeVisible();await expect(nativeId).toHaveText(String(row.id));
  await expect(nativePath).toBeVisible();await expect(nativePath).toHaveText(row.publicPath);
  return {kind:'information',nativeEntityId:row.id,nativePublicPath:row.publicPath,actualPageInformation:true};
 }
 await expect(info).toContainText(row.label);return {kind:'information',nativeEntityId:row.id,nativeLabel:row.label};
}
/** Current B1 context bindings come from its source-derived plan and canonical cells. */
export function buildCoreQueryRenderedPlan(spec,route,requiredCases){
 assert.ok(typeof spec.key==='string'&&typeof spec.consumerId==='string');assert.ok(route.startsWith('/admin/'));
 const bindings=[{boundary:'collection',consumer:spec.consumerId,surface:route}];
 validateCoreRenderedAdoptionBindings({requiredCases,bindings,axis:'scrollbar',pathname:route});
 const modal=requiredCases.some(row=>row.boundary==='collection'&&row.consumer===spec.consumerId&&row.axis==='modal'&&row.scenario==='complete_applicable_capability_behavior');
 if(modal)validateCoreRenderedAdoptionBindings({requiredCases,bindings,axis:'modal',pathname:route});
 return{bindings,modal,gridId:'query-'+spec.key+'-grid-scroll',modalFocusId:'query-'+spec.key+'-edit-focus',modalReturnId:'query-'+spec.key+'-edit-return',modalScrollId:'query-'+spec.key+'-edit-scroll'};
}

/** Holds one exact actual registered read. No request headers, bodies or
 * fabricated responses are persisted; the original GET response is forwarded. */
export async function observeCoreQueryStaleRead({page,origin,spec,fixture,search,held,current,assertPage,readIds}){
 const pattern=origin+'/api/admin/entity-lists/'+spec.entity+'?*',events={},sourceOwner=coreQueryStaleOwner();let sequence=0,request=null,response=null,strictRequestCount=0,posts=0,terminal=null,failure=null,responseDelivered=false,handlerError=null,heldResponseIds=null,removeRoute=null;
 let readyResolve,readyReject,releaseResolve,handlerResolve;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;}),release=new Promise(resolve=>{releaseResolve=resolve;}),handlerDone=new Promise(resolve=>{handlerResolve=resolve;});
 void ready.catch(()=>{}); const bounded=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Timed out: '+label)),60000);})]);}finally{clearTimeout(timer);}};
 const count=value=>{if(value.method()==='POST'&&new URL(value.url()).origin===origin&&value.headers()['next-action'])posts++;};
 const failed=value=>{if(value===request){terminal='aborted';failure=value.failure()?.errorText??null;events.terminal=++sequence;}};
 const finished=value=>{if(value===request){terminal='completed';responseDelivered=true;events.terminal=++sequence;}};
 const inFlight=new Set();const gateBody=async route=>{
  let matches;try{matches=coreQueryStaleRequestMatches(spec,fixture,route.request().url(),origin);}catch(error){handlerError=error;readyReject(error);try{await route.abort('aborted');}finally{handlerResolve();}return;}
  if(!matches){await route.fallback();return;}
  try{strictRequestCount++;assert.equal(strictRequestCount,1);request=route.request();assert.equal(request.method(),'GET');response=await route.fetch();assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);assert.equal(response.headers()['x-admin-entity-list'],spec.entity);const payload=await response.json();assertCoreQueryProjection(held,payload);heldResponseIds=payload.rows.map(row=>Number(row.id));events.held=++sequence;readyResolve();await release;
   try{await route.fulfill({response});}catch(error){if(!(terminal==='aborted'&&failure==='net::ERR_ABORTED'))throw error;}
  }catch(error){handlerError=error;readyReject(error);try{await route.abort('aborted');}catch{/* Original error remains fatal; an already-terminal request needs no second abort. */}}finally{handlerResolve();}
 };
 const gate=route=>{const task=gateBody(route);inFlight.add(task);void task.then(()=>inFlight.delete(task),()=>inFlight.delete(task));return task;};
 page.on('request',count);page.on('requestfailed',failed);page.on('requestfinished',finished);
 try{
  removeRoute=await registerCorePageRoute(page,pattern,gate);
  await search.fill(new URLSearchParams(held.query).get('q'));await search.press('Enter');await bounded(ready,'actual older GET/native response');assert.equal(handlerError,null);
  await search.fill(fixture.search);await search.press('Enter');await assertPage(spec,current);const beforeReleaseIds=await readIds();events.currentSettled=++sequence;
  events.released=++sequence;releaseResolve();await bounded(handlerDone,'older GET completion');assert.equal(handlerError,null);await expect.poll(()=>terminal,{timeout:60000}).not.toBe(null);assert.ok(['aborted','completed'].includes(terminal));if(terminal==='aborted')assert.equal(failure,'net::ERR_ABORTED');
  await assertPage(spec,current);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await assertPage(spec,current);const afterReleaseIds=await readIds();assert.equal(posts,0);
  return{sourceOwner,heldNativeId:held.id,currentNativeId:current.id,beforeReleaseIds,afterReleaseIds,heldResponseIds,heldResponseStatus:response.status(),strictRequestCount,posts,actualSearchInteraction:true,currentQueryRetained:true,method:'GET',pathname:new URL(request.url()).pathname,events,terminal,failure,responseDelivered,automaticCoverage:[],globalClosed:false};
 }finally{releaseResolve();try{if(removeRoute)await removeRoute();if(request||handlerError)await bounded(handlerDone,'owned gate cleanup');const finished=await bounded(Promise.allSettled([...inFlight]),'all intercepted read callbacks');assert.ok(finished.every(row=>row.status==='fulfilled'),'Every owned read callback must finish before teardown.');}finally{page.off('request',count);page.off('requestfailed',failed);page.off('requestfinished',finished);if(response)await response.dispose();}}
}

export async function runCoreQueryPresentationJourneys(ctx){
 const {page,origin,fixtures,run,observe,nativeCheckpoint,actionResponse,assertActionAcknowledged,requiredCases}=ctx;
 const context=ctx.context??page.context();
 assert.equal(new URL(origin).hostname,'127.0.0.1');assert.equal(typeof nativeCheckpoint,'function');
 const plan=await loadCoreQueryPresentationPlan();assert.deepEqual(Object.keys(fixtures.queryClosure.contexts).sort(),plan.map(row=>row.key).sort());
 const outcomes=[],nativeIds=new Map();
 const checkpoint=async(spec,scenario)=>{
  const request={id:randomUUID(),kind:'query-presentation-state',routeKey:spec.key,scenario};
  const result=await nativeCheckpoint(request);assert.equal(result.id,request.id);assert.equal(result.status,'pass');assert.ok(result.ownedRunId);assert.equal(result.kind,request.kind);assert.equal(result.routeKey,spec.key);assert.equal(result.scenario,scenario);assert.ok(Number.isSafeInteger(result.actorId)&&result.actorId>0);const ids=nativeIds.get(spec.key)??[];ids.push(result.id);nativeIds.set(spec.key,ids);return result;
 };
 const ids=()=>page.locator('tbody tr[data-entity-row-id]').evaluateAll(rows=>rows.map(row=>Number(row.getAttribute('data-entity-row-id'))));
 async function assertPage(spec,receipt){
  await expect.poll(ids,{timeout:60000}).toEqual(receipt.expectedIds);
  const response=await context.request.get(origin+'/api/admin/entity-lists/'+spec.entity+'?'+receipt.query,{maxRedirects:0});
  assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);assert.equal(response.headers()['x-admin-entity-list'],spec.entity);
  assertCoreQueryProjection(receipt,await response.json());
  assertCoreQueryLocation(spec,fixtures.queryClosure.contexts[spec.key],receipt,page.url(),origin);
 }
 async function open(receipt){await observe('b1-owned-route',()=>page.goto(origin+receipt.route+'?'+receipt.query,{waitUntil:'domcontentloaded'}));}
 for(const spec of plan)await run('core-query-presentation-'+spec.key,[],async()=>{
  const renderedAdoption=[];
  const first=await checkpoint(spec,'first'),empty=await checkpoint(spec,'empty');assert.equal(first.completeIds.length,spec.rowCount);assert.equal(empty.pagination.totalRows,0);
  await open(empty);await assertPage(spec,empty);
  const toolbar=page.locator('[data-admin-collection-toolbar-owner]'),search=toolbar.locator('input').first();
  await expect(search).toBeVisible();await search.fill(fixtures.queryClosure.contexts[spec.key].search);await assertPage(spec,first);
  const renderedPlan=buildCoreQueryRenderedPlan(spec,first.route,requiredCases),renderedBase={page,origin,requiredCases,bindings:renderedPlan.bindings};
  const grid=page.locator('[data-admin-data-grid-scroll]'),farCell=page.locator('tbody tr[data-entity-row-id="'+first.expectedIds[0]+'"]').locator('td[data-admin-column-key]:not([data-admin-grid-sticky])').last();
  renderedAdoption.push(await observeCoreScrollbarAdoption({...renderedBase,id:renderedPlan.gridId,container:grid,target:farCell,axis:'x',containment:'overscroll-contain'}));
  const searchObservations=[];
  for(const scenario of CORE_QUERY_SEARCH_SCENARIOS){
   const receipt=await checkpoint(spec,scenario),requested=new URLSearchParams(receipt.query).get('q')??'';
   if(scenario==='search-cleared'){
    await search.fill(fixtures.queryClosure.contexts[spec.key].search);await search.press('Enter');await assertPage(spec,first);
    await toolbar.getByRole('button',{name:'مسح',exact:true}).click();await expect(search).toHaveValue('');
   }else{await search.fill(requested);await search.press('Enter');}
   await assertPage(spec,receipt);
   if(scenario.startsWith('search-literal-'))assert.equal(receipt.completeIds.length,0,'Literal punctuation is absent from this exact fixture namespace; wildcard widening must fail.');
   if(scenario==='search-restored')assert.deepEqual(receipt.completeIds,first.completeIds);
   searchObservations.push({scenario,requested,normalizedSearch:receipt.searchProjection.normalizedSearch,nativeId:receipt.id,actualInputInteraction:true,actualClearButton:scenario==='search-cleared',registeredRouteScopeVerified:true});
  }
  const searchBoundary={observations:searchObservations,automaticCoverage:[],globalClosed:false,boundary:'Actual registered literal punctuation, contract-derived one-character search, clear and restored namespace joined to native route rows. Stale-response ordering remains separate pending proof.'};
  const held=await checkpoint(spec,'stale-held'),current=await checkpoint(spec,'stale-restored');const staleReadEvidence=await observeCoreQueryStaleRead({page,origin,spec,fixture:fixtures.queryClosure.contexts[spec.key],search,held,current,assertPage,readIds:ids});
  const pages=[first];
  for(const [scenario,text]of [['second','2'],['third','3']]){
   const receipt=await checkpoint(spec,scenario);await page.locator('[data-admin-pagination-slot="page"]').filter({hasText:new RegExp('^'+text+'$')}).click();await assertPage(spec,receipt);pages.push(receipt);
  }
  const union=pages.flatMap(row=>row.expectedIds);assert.equal(new Set(union).size,union.length);assert.deepEqual(union,first.completeIds);
  await page.goBack({waitUntil:'domcontentloaded'});await assertPage(spec,pages[1]);await page.reload({waitUntil:'domcontentloaded'});await assertPage(spec,pages[1]);
  const clamp=await checkpoint(spec,'clamp');await open(clamp);await assertPage(spec,clamp);assert.equal(clamp.pagination.page,3);
  await open(first);await assertPage(spec,first);
  const wide=await checkpoint(spec,'wide');await page.locator('[data-admin-table-pagination] button[aria-haspopup="listbox"]').click();
  await page.locator('[data-admin-table-pagination-menu]').getByRole('option',{name:String(wide.pagination.pageSize),exact:true}).click();await assertPage(spec,wide);
  await open(first);await assertPage(spec,first);
  const descending=await checkpoint(spec,'descending'),activeSort=page.locator('th[aria-sort="ascending"] button');
  let sortBoundary;
  if(await activeSort.count()===1){await activeSort.click();await assertPage(spec,descending);sortBoundary='actual-visible-header-and-native-descending-page';}
  else {assert.equal(await activeSort.count(),0);await open(descending);await assertPage(spec,descending);sortBoundary='API-and-URL-sort-only-no-active-sort-header-exposed';}
  await open(first);await assertPage(spec,first);
  let filterBoundary='source-contract-has-no-filter-recipe',dateFilterEvidence=null;
  if(spec.filter){
   const filtered=await checkpoint(spec,'filtered');assert.ok(filtered.pagination.totalRows>0&&filtered.pagination.totalRows<first.pagination.totalRows,'Filter fixture must split the real complete set.');
   await page.locator('[data-admin-filter-trigger]').click();const field=page.locator('[data-admin-filter-modal-fields]').getByRole('group',{name:spec.filter.label,exact:true});
   await field.getByRole('option',{name:spec.filter.optionLabel,exact:true}).click();await page.getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();await assertPage(spec,filtered);
   if(spec.entity==='activity_log'){
    const observations=[];
    for(const [key,id,emptyValue]of [['dateFrom','activity-date-from','2026-01-04'],['dateTo','activity-date-to','2026-01-02']]){
     const prefix=key==='dateFrom'?'date-from':'date-to',seed='2026-01-03';
     await page.locator('[data-admin-filter-trigger]').click();const owner=page.locator('[data-admin-filter-modal-fields]'),date=owner.locator('[data-admin-filter-field="'+id+'"] input[data-admin-date-picker]');
     await expect(date).toHaveAttribute('type','date');await expect(date).toBeEnabled();await date.fill(seed);await date.focus();await expect(date).toBeFocused();
     await date.press('ArrowUp');await expect(date).not.toHaveValue(seed);const keyboardChanged=await date.inputValue();assert.match(keyboardChanged,/^\d{4}-\d{2}-\d{2}$/u);
     await date.press('ArrowDown');await expect(date).toHaveValue(seed);await date.press('ControlOrMeta+A');await date.press('Backspace');await expect(date).toHaveValue('');
     await date.fill(seed);await page.getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();const included=await checkpoint(spec,prefix+'-included');await assertPage(spec,included);assert.deepEqual(included.completeIds,filtered.completeIds);
     await page.locator('[data-admin-filter-trigger]').click();await expect(date).toHaveValue(seed);await date.fill(emptyValue);await page.getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();const excluded=await checkpoint(spec,prefix+'-empty');await assertPage(spec,excluded);assert.equal(excluded.pagination.totalRows,0);
     await page.locator('[data-admin-filter-trigger]').click();await expect(date).toHaveValue(emptyValue);await date.focus();await date.press('ControlOrMeta+A');await date.press('Backspace');await expect(date).toHaveValue('');await page.getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();const cleared=await checkpoint(spec,prefix+'-cleared');await assertPage(spec,cleared);assert.deepEqual(cleared.completeIds,filtered.completeIds);
     assert.equal(new URL(page.url()).searchParams.has(key),false);assert.equal(new URL(page.url()).searchParams.get('entityType'),spec.filter.value);
     observations.push({field:key,sourceControlId:id,type:'date',focused:true,seed,keyboardChanged,keyboardRestored:seed,clearedValue:'',emptyValue,appliedValues:[seed,emptyValue,''],nativeCheckpointIds:[included.id,excluded.id,cleared.id],unrelatedQuerySortEntityTypePreserved:true,appliedClearRemovedParam:true});
    }
    dateFilterEvidence={observations,automaticCoverage:[],globalClosed:false,boundary:'Native keyboard/change/clear and existing UTC date filters against labelled synthetic read fixtures only; no audited Product-write or popup-calendar proof.'};
   }
   await page.getByRole('button',{name:'مسح كل الفلاتر',exact:true}).click();await assertPage(spec,first);filterBoundary={key:spec.filter.key,actualFilterAndClear:true,filteredRows:filtered.pagination.totalRows,otherDeclaredFilterKeysRemainUnproven:Object.keys(spec.contract.rawFilterSchemas).filter(key=>key!==spec.filter.key&&!(dateFilterEvidence&&['dateFrom','dateTo'].includes(key)))};
  }
  const extraFilterObservations=[],extraFilterCases=coreQueryExtraFilterCases(spec,fixtures.queryClosure.contexts[spec.key]);
  for(let ordinal=0;ordinal<extraFilterCases.length;ordinal+=2){
   const appliedCase=extraFilterCases[ordinal],clearedCase=extraFilterCases[ordinal+1];assert.equal(appliedCase.phase,'applied');assert.equal(clearedCase.phase,'cleared');
   const trigger=page.locator('[data-admin-filter-trigger]'),field=page.locator('[data-admin-filter-modal-fields] [data-admin-filter-field="'+appliedCase.fieldId+'"]'),option=field.getByRole('option',{name:appliedCase.optionLabel,exact:true});
   await trigger.click();await expect(field).toHaveCount(1);await expect(option).toHaveCount(1);await expect(option).toHaveAttribute('aria-selected','false');await option.click();
   await page.locator('[data-venesia-modal]').getByRole('button',{name:'إلغاء',exact:true}).click();await expect(trigger).toBeFocused();await assertPage(spec,first);
   await trigger.click();await expect(option).toHaveAttribute('aria-selected','false');await option.click();await page.getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();
   const applied=await checkpoint(spec,appliedCase.scenario);await assertPage(spec,applied);await page.reload({waitUntil:'domcontentloaded'});await assertPage(spec,applied);
   extraFilterObservations.push({...appliedCase,nativeId:applied.id,actualOptionInteraction:true,cancelPreservedQuery:true,cancelRestoredTriggerFocus:true,reloadPreservedAppliedQuery:true,querySortSizePreserved:true,actualChipClear:false});
   await page.getByRole('button',{name:'إزالة فلتر '+appliedCase.label,exact:true}).click();const cleared=await checkpoint(spec,clearedCase.scenario);await assertPage(spec,cleared);assert.deepEqual(cleared.completeIds,first.completeIds);assert.equal(new URL(page.url()).searchParams.has(appliedCase.key),false);
   extraFilterObservations.push({...clearedCase,nativeId:cleared.id,actualOptionInteraction:true,cancelPreservedQuery:true,cancelRestoredTriggerFocus:true,reloadPreservedAppliedQuery:true,querySortSizePreserved:true,actualChipClear:true});
  }
  const extraFilterEvidence={observations:extraFilterObservations,automaticCoverage:[],globalClosed:false,boundary:'Existing modal options only; each cancelled draft, accepted query, reload and chip clear independently compared with native rows. No full toolbar-axis credit.'};

  let viewLinkEvidence=null;
  if(coreQueryViewScenarios(spec).length){
   const nativeIds=[],trash=await checkpoint(spec,'view-trash-before');nativeIds.push(trash.id);let posts=0;const count=request=>{if(request.method()==='POST'&&new URL(request.url()).origin===origin&&request.headers()['next-action'])posts++;};page.on('request',count);
   try{const link=page.locator('a[href="'+spec.viewLink.href+'"]').filter({hasText:spec.viewLink.label});await expect(link).toHaveCount(1);const clickedHref=await link.getAttribute('href');assert.equal(clickedHref,spec.viewLink.href);await link.click();await assertPage(spec,trash);await expect(page.getByRole('heading',{name:'المحذوفات',exact:true})).toBeVisible();assert.equal(new URL(page.url()).searchParams.get('q'),null);
    await page.reload({waitUntil:'domcontentloaded'});await assertPage(spec,trash);const after=await checkpoint(spec,'view-trash-after');nativeIds.push(after.id);await assertPage(spec,after);
    await page.goBack({waitUntil:'domcontentloaded'});const active=await checkpoint(spec,'view-active-restored');nativeIds.push(active.id);await assertPage(spec,active);assert.deepEqual(active.completeIds,first.completeIds);assert.equal(posts,0);
    viewLinkEvidence={sourceLink:spec.viewLink,nativeIds,trashCompleteIds:trash.completeIds,activeCompleteIds:active.completeIds,clickedHref,actualLinkClicked:true,actualTrashHeader:true,reloadPreserved:true,backRestoredPriorQuery:true,priorRowsRestored:true,canonicalDefaultsObserved:true,posts,activeControl:'browser-history-back',automaticCoverage:[],globalClosed:false};
   }finally{page.off('request',count);}
  }
  assert.equal(spec.columnVisibility,'shared_optional_columns');
  const beforeColumns=await page.locator('thead th[data-admin-column-key]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-admin-column-key')));
  const columnsTrigger=page.locator('[data-admin-toolbar-columns] button');await expect(columnsTrigger).toHaveCount(1);await columnsTrigger.click();
  const menu=page.locator('[data-admin-column-menu]'),toggle=menu.locator('input[type="checkbox"]:checked:not(:disabled)').first();await expect(toggle).toHaveCount(1);
  const toggleName=await toggle.getAttribute('aria-label');assert.ok(toggleName?.startsWith('إخفاء عمود '));const showName=toggleName.replace('إخفاء عمود ','إظهار عمود ');
  const save=actionResponse();await toggle.click();assertActionAcknowledged(await save);await page.keyboard.press('Escape');
  const afterColumns=await page.locator('thead th[data-admin-column-key]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-admin-column-key')));
  const removed=beforeColumns.filter(key=>!afterColumns.includes(key));assert.equal(removed.length,1);
  const changed=await checkpoint(spec,'preferences');assert.ok(changed.preference);assert.ok(!changed.preference.visibleColumns.includes(removed[0]));
  await page.reload({waitUntil:'domcontentloaded'});await assertPage(spec,first);await expect(page.locator('thead th[data-admin-column-key="'+removed[0]+'"]')).toHaveCount(0);
  await columnsTrigger.click();const restore=actionResponse();await menu.getByRole('checkbox',{name:showName,exact:true}).click();assertActionAcknowledged(await restore);await page.keyboard.press('Escape');
  await page.reload({waitUntil:'domcontentloaded'});await assertPage(spec,first);
  assert.deepEqual(await page.locator('thead th[data-admin-column-key]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-admin-column-key'))),beforeColumns);
  const restored=await checkpoint(spec,'preferences');assert.ok(restored.preference.visibleColumns.includes(removed[0]));
  // Mandatory columns may be omitted by the preference serializer. Compare the
  // exact persisted baseline only when it existed; absent rows are restored to
  // equivalent rendered preferences through the Product's save owner.
  if(first.preference)assert.deepEqual([...restored.preference.visibleColumns].sort(),[...first.preference.visibleColumns].sort());
  const row=first.rows[0],rowRoot=page.locator('tr[data-entity-row-id="'+row.id+'"]'),rowEvidence=[];
  if(spec.rowActions?.information==='adopted'){
   const more=rowRoot.locator('[data-admin-row-action="more"] button');await more.click();await page.locator('[data-admin-row-actions-menu][data-admin-entity-id="'+row.id+'"]').locator('[data-admin-row-action-menu-item="information"]').click();
   const info=page.locator('[data-admin-row-actions-information][data-admin-entity-id="'+row.id+'"]');const informationEvidence=await assertCoreQueryInformation(spec,row,info);await page.keyboard.press('Escape');await expect(more).toBeFocused();rowEvidence.push({...informationEvidence,focusReturned:true});
  }
  if(spec.rowActions?.copyPublicLink==='adopted'){
   assert.ok(typeof row.publicPath==='string'&&row.publicPath.startsWith('/'));
   await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
   try{
    await rowRoot.locator('[data-admin-row-action="more"] button').click();
    const copy=page.locator('[data-admin-row-actions-menu][data-admin-entity-id="'+row.id+'"]').locator('[data-admin-row-action-menu-item="copyPublicLink"]');
    await expect(copy).toBeEnabled();await copy.click();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());const destination=new URL(copied,origin);
    assert.ok(['http:','https:'].includes(destination.protocol)&&!destination.username&&!destination.password);assert.equal(destination.pathname,row.publicPath);
    rowEvidence.push({kind:'copyPublicLink',copiedPath:destination.pathname,origin:destination.origin,mode:'actual-clipboard-only-no-navigation'});
   }finally{await context.clearPermissions();}
  }
  for(const kind of ['preview','edit'])if(spec.rowActions?.[kind]==='adopted'){
   const target=rowRoot.locator('[data-admin-row-action="'+kind+'"]');await expect(target).toHaveCount(1);
   const link=target.locator('a[href]');
   if(await link.count()){
    const href=await link.getAttribute('href'),url=new URL(href,origin);assert.ok(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password);
    if(url.origin!==origin){rowEvidence.push({kind,href,mode:'canonical-link-text-only-not-navigated'});continue;}
    const destination=await context.newPage();try{const response=await destination.goto(url.href,{waitUntil:'domcontentloaded'});assert.ok(response&&response.status()<400);assert.equal(new URL(destination.url()).origin,origin);assert.ok(!new URL(destination.url()).pathname.includes('/login'));rowEvidence.push({kind,href,mode:'owned-destination-http-and-document'});}finally{await destination.close();}
   }else{
    const button=target.locator('button');await expect(button).toHaveCount(1);
    if(await button.isDisabled()){assert.ok(await button.getAttribute('title')||await target.getAttribute('title'));rowEvidence.push({kind,mode:'disabled-current-state'});continue;}
    if(kind==='edit'){
     await button.click();const dialog=page.locator('[data-venesia-modal]');await expect(dialog).toBeVisible();assert.equal(renderedPlan.modal,true,'Actual modal requires its existing applicable consumer binding.');
     const form=dialog.locator('form[data-admin-form-runtime]'),cancel=form.getByRole('button',{name:'إلغاء',exact:true});await expect(form).toHaveCount(1);await expect(form).toHaveAttribute('data-admin-form-dirty','false');
     renderedAdoption.push(await observeCoreModalFocusAdoption({...renderedBase,id:renderedPlan.modalFocusId,dialog}));
     renderedAdoption.push(await observeCoreModalCleanReturn({...renderedBase,id:renderedPlan.modalReturnId,dialog,form,trigger:button,cancel}));
     const modalBody=dialog.locator(':scope > div').filter({has:page.locator('form[data-admin-form-runtime]')});
     renderedAdoption.push(await observeCoreScrollbarAdoption({...renderedBase,id:renderedPlan.modalScrollId,container:modalBody,target:cancel,axis:'y',containment:'modal-lock'}));
     await cancel.click();await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();await assertPage(spec,first);
     rowEvidence.push({kind,mode:'actual-existing-edit-modal-clean-cancel',exactRowTriggerFocusRestored:true,sourceEscapePolicy:'retained'});
    }
    else throw new Error('New non-link Preview requires a reviewed bounded destination recipe.');
   }
  }
  const after=await checkpoint(spec,'first');assert.equal(after.fixtureFingerprint,first.fixtureFingerprint);assert.equal(after.actorId,first.actorId);
  const outcome={renderedAdoption,nativeCheckpointIds:[...nativeIds.get(spec.key)],routeKey:spec.key,consumerId:spec.consumerId,entity:spec.entity,nativeActorId:first.actorId,querySearchEmptyNonempty:true,pageUnion:union.length,backAndReload:true,outOfRangeClamped:true,pageSizeChanged:true,sortBoundary,filterBoundary,dateFilterEvidence,searchBoundary,staleReadEvidence,viewLinkEvidence,extraFilterEvidence,optionalColumn:{key:removed[0],persistedAndReloaded:true,semanticBaselineRestored:true,physicalInitialAbsenceRestored:first.preference!==null},rowEvidence,domainFingerprintUnchanged:true,remaining:['Other registered filters not listed above','No full capability-axis promotion from this receipt alone']};outcomes.push(outcome);return outcome;
 });
 return {status:outcomes.length===plan.length?'pass':'fail',outcomes,scope:'Actual registered query/presentation and bounded nonmutating row information, joined to same-run native fixture projections. Each missing sub-invariant remains explicit.'};
}
