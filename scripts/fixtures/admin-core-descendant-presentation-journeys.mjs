import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';
import {loadCoreDescendantPresentationPlan,bindCoreDescendantCells,assertCoreDescendantProjection} from './admin-core-descendant-presentation-plan.mjs';
import {observeCoreScrollbarAdoption} from './admin-core-rendered-adoption.mjs';

/** Only actual mounted descendants. Footer pagination is local form-session
 * state; URL history assertions are reserved for the three bounded owners. */
export async function runCoreDescendantPresentationJourneys(ctx,scope){
 const {page,origin,fixtures,run,observe,nativeCheckpoint,requiredCases,actionResponse,assertActionAcknowledged}=ctx;assert.equal(new URL(origin).hostname,'127.0.0.1');
 const plan=await loadCoreDescendantPresentationPlan(scope),fixtureSet=fixtures.descendantPresentation;assert.equal(fixtureSet.scope,scope);assert.deepEqual(Object.keys(fixtureSet.contexts).sort(),plan.map(row=>row.key).sort());
 const grid=page.locator('[data-admin-data-grid-scroll]:visible'),header=grid.locator(':scope > div').first(),rows=grid.locator(':scope > article'),paging=page.locator('[data-admin-table-pagination]:visible');
 const visibleIds=()=>rows.locator('[data-admin-row-action="more"][data-admin-entity-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-admin-entity-id')));
 const assertIds=ids=>expect.poll(visibleIds,{timeout:60000}).toEqual(ids);
 async function activate(fixture){if(fixture.tab)await page.locator('[data-admin-tab-id="'+fixture.tab+'"]').click();await expect(grid).toHaveCount(1);}
 async function navigate(fixture,params={}){const q=new URLSearchParams(params);await observe('descendant-presentation-owned-route',()=>page.goto(origin+fixture.route+(q.size?'?'+q:''),{waitUntil:'domcontentloaded'}));await activate(fixture);}
 async function limit(size){await paging.locator('button[aria-haspopup="listbox"]').click();await page.locator('[data-admin-table-pagination-menu]').getByRole('option',{name:String(size),exact:true}).click();}
 const outcomes=[];
 for(const spec of plan)await run('core-descendant-presentation-'+spec.key,[],async()=>{
  const fixture=fixtureSet.contexts[spec.key],nativeCheckpointIds=[],namedCellBindings=bindCoreDescendantCells(spec,requiredCases);
  const checkpoint=async phase=>{const request={id:randomUUID(),kind:'descendant-presentation-state',key:spec.key,phase};const result=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(result[key],request[key]);assert.equal(result.status,'pass');assert.ok(result.ownedRunId&&Number.isSafeInteger(result.actorId)&&result.actorId>0);nativeCheckpointIds.push(result.id);return result;};
  const first=await checkpoint('before');assert.deepEqual(first.ids,fixture.ids);let posts=0;const count=request=>{if(request.method()==='POST'&&request.headers()['next-action']&&new URL(request.url()).origin===origin)posts++;};page.on('request',count);
  try{
   const bounded=spec.paginationMode==='bounded-url-history',params=bounded?{q:fixture.search}:{};await navigate(fixture,params);await assertIds(first.ids.slice(0,spec.pageSize));
   const renderedAdoption=[],scrollBindings=[spec.consumer,...spec.aliases].filter(consumer=>requiredCases.some(row=>row.boundary==='collection'&&row.consumer===consumer&&row.axis==='scrollbar'&&row.scenario==='complete_applicable_capability_behavior')).map(consumer=>({boundary:'collection',consumer,surface:fixture.route}));
   if(scrollBindings.length){const cells=rows.first().locator(':scope > *');renderedAdoption.push(await observeCoreScrollbarAdoption({page,origin,requiredCases,bindings:scrollBindings,container:grid,target:cells.nth((await cells.count())-2),axis:'x',containment:'overscroll-contain',id:'descendant-'+spec.key+'-scrollbar'}));}
   const pages=[await visibleIds()];for(let index=2;index<=Math.ceil(spec.rowCount/spec.pageSize);index++){await page.locator('[data-admin-pagination-slot="page"]:visible').filter({hasText:new RegExp('^'+index+'$')}).click();await assertIds(first.ids.slice((index-1)*spec.pageSize,index*spec.pageSize));pages.push(await visibleIds());}
   let backAndReload=false,clamp=false,searchReset=false,localReloadReset=false;
   if(bounded){
    await page.goBack({waitUntil:'domcontentloaded'});await activate(fixture);await assertIds(pages[1]);await page.reload({waitUntil:'domcontentloaded'});await activate(fixture);await assertIds(pages[1]);backAndReload=true;
    await navigate(fixture,{...params,page:'999'});await assertIds(pages.at(-1));clamp=true;
    const search=page.locator('main input[type="search"]:visible');await expect(search).toHaveCount(1);await search.fill('no-descendant-match-'+randomUUID());await assertIds([]);await search.fill(fixture.search);await assertIds(pages[0]);assert.equal(new URL(page.url()).searchParams.get('page'),null);searchReset=true;
   }else{
    const before=new URL(page.url());assert.equal(before.searchParams.has('page'),false);await page.reload({waitUntil:'domcontentloaded'});await activate(fixture);await assertIds(pages[0]);localReloadReset=true;
   }
   const wide=spec.pageSizeOptions.find(size=>size>=spec.rowCount);assert.ok(wide);await limit(wide);await assertIds(first.ids);await expect(paging).toHaveCount(0);
   // Auto footer intentionally vanishes at23of30; reset through this owner's actual lifetime.
   if(bounded)await navigate(fixture,params);else{await page.reload({waitUntil:'domcontentloaded'});await activate(fixture);}await assertIds(pages[0]);assert.equal(posts,0);
   let headerAndCellsPersisted=false,preferenceSemanticRestored=false;
   if(spec.preferenceId){
    const statusHeader=header.getByText(spec.label,{exact:true});await expect(statusHeader).toHaveCount(1);const originalHeader=await header.locator(':scope > *').count(),originalCells=await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length));
    const trigger=page.locator('[data-admin-toolbar-columns]:visible button'),menu=page.locator('[data-admin-column-menu]');await trigger.click();const required=spec.columns.find(column=>!column.hideable&&['name','template'].includes(column.key));assert.ok(required);await expect(menu.getByRole('checkbox',{name:'إخفاء عمود '+required.label,exact:true})).toBeDisabled();
    const hiddenSave=actionResponse();await menu.getByRole('checkbox',{name:'إخفاء عمود '+spec.label,exact:true}).click();assertActionAcknowledged(await hiddenSave);await expect(trigger.locator('.animate-spin')).toHaveCount(0,{timeout:60000});await expect(menu.locator('[role="alert"]')).toHaveCount(0);await page.keyboard.press('Escape');await expect(statusHeader).toHaveCount(0);assert.equal(await header.locator(':scope > *').count(),originalHeader-1);assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length)),originalCells.map(value=>value-1));
    const hidden=await checkpoint('hidden');assert.equal(hidden.fingerprint,first.fingerprint);await page.reload({waitUntil:'domcontentloaded'});await activate(fixture);await assertIds(pages[0]);await expect(statusHeader).toHaveCount(0);assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length)),originalCells.map(value=>value-1));
    await trigger.click();const restoredSave=actionResponse();await menu.getByRole('button',{name:'استعادة الأعمدة الافتراضية',exact:true}).click();assertActionAcknowledged(await restoredSave);await expect(menu).toHaveCount(0,{timeout:60000});await page.reload({waitUntil:'domcontentloaded'});await activate(fixture);await assertIds(pages[0]);await expect(statusHeader).toHaveCount(1);assert.equal(await header.locator(':scope > *').count(),originalHeader);assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length)),originalCells);headerAndCellsPersisted=true;
    const restored=await checkpoint('restored');assert.equal(restored.fingerprint,first.fingerprint);assert.deepEqual([...restored.preference.visibleColumns].sort(),[...first.preference.visibleColumns].sort());preferenceSemanticRestored=true;assert.equal(posts,2);
   }
   const after=await checkpoint('after');assert.equal(after.fingerprint,first.fingerprint);assert.deepEqual(after.ids,first.ids);assert.equal(posts,spec.preferenceId?2:0);
   const result={key:spec.key,consumer:spec.consumer,route:fixture.route,namedCellBindings,nativeActorId:first.actorId,nativeCheckpointIds,pages,paginationMode:spec.paginationMode,pageSizeChanged:true,backAndReload,clamp,searchReset,localReloadReset,preferencePosts:posts,headerAndCellsPersisted,preferenceSemanticRestored,nativeRowsUnchanged:true,urlPagingClaimed:bounded,structuralSlotsPaged:false,renderedAdoption,automaticCoverage:[],globalClosed:false,boundary:'Exact mounted descendant behavior. Shell/fixed-slot entries bind this same source/route/native proof; no parent pagination UI is invented.'};assertCoreDescendantProjection(spec,first.ids,result);outcomes.push(result);return result;
  }finally{page.off('request',count);}
 });
 return {outcomes,automaticCoverage:[],globalClosed:false};
}
