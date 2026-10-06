import {createJiti} from 'jiti';
import {loadCoreResidualSearchContract,coreResidualSearchQueries,projectCoreResidualSearchRows,assertCoreResidualSearchFragments,bindCoreResidualSearchCells} from './admin-core-residual-search.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';
import {loadCoreDescendantPresentationPlan,bindCoreDescendantCells,assertCoreDescendantProjection,loadCoreDescendantFilterContract,coreDescendantFilterCases,assertCoreDescendantFilterReceipt,bindCoreDescendantClosureCells,assertCoreFooterEmptyReceipt} from './admin-core-descendant-presentation-plan.mjs';
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
   let searchFragments=null,searchNamedCellBindings=[];
   if(bounded){
    const contract=await loadCoreResidualSearchContract(spec.key);assert.equal(contract.sourceSha256,first.searchOwnerSha256);searchNamedCellBindings=bindCoreResidualSearchCells(contract,requiredCases);const observations=[];
    const search=page.locator('main input[type="search"]:visible');
    for(const query of coreResidualSearchQueries(fixture.search)){
     await search.fill(query.query);const expected=projectCoreResidualSearchRows(contract,first.searchRows,query.query);await assertIds(expected.slice(0,spec.pageSize));
     await expect.poll(()=>new URL(page.url()).searchParams.get('q')??'').toBe(query.query);assert.equal(new URL(page.url()).searchParams.get('page'),null);
     const actual=[...await visibleIds()];for(let pageIndex=2;pageIndex<=Math.ceil(expected.length/spec.pageSize);pageIndex++){await page.locator('[data-admin-pagination-slot="page"]:visible').filter({hasText:new RegExp('^'+pageIndex+'$')}).click();await assertIds(expected.slice((pageIndex-1)*spec.pageSize,pageIndex*spec.pageSize));actual.push(...await visibleIds());}
     observations.push({...query,ids:actual,uiExact:true,queryStateExact:true});
    }
    searchFragments=assertCoreResidualSearchFragments(contract,first.searchRows,fixture.search,observations);
    await navigate(fixture,params);await page.reload({waitUntil:'domcontentloaded'});await activate(fixture);await assertIds(pages[0]);await expect(search).toHaveValue(fixture.search);assert.equal(posts,0);
   }
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
   const result={key:spec.key,consumer:spec.consumer,route:fixture.route,namedCellBindings,nativeActorId:first.actorId,nativeCheckpointIds,pages,paginationMode:spec.paginationMode,pageSizeChanged:true,backAndReload,clamp,searchReset,localReloadReset,searchFragments,searchNamedCellBindings,searchNativeCheckpointIds:bounded?[first.id,after.id]:[],searchWrites:0,preferencePosts:posts,headerAndCellsPersisted,preferenceSemanticRestored,nativeRowsUnchanged:true,urlPagingClaimed:bounded,structuralSlotsPaged:false,renderedAdoption,automaticCoverage:[],globalClosed:false,boundary:'Exact mounted descendant behavior. Shell/fixed-slot entries bind this same source/route/native proof; no parent pagination UI is invented.'};assertCoreDescendantProjection(spec,first.ids,result);outcomes.push(result);return result;
  }finally{page.off('request',count);}
 });
 return {outcomes,automaticCoverage:[],globalClosed:false};
}

export async function observeCoreDescendantFilterSelection(ctx,key) {
 const {page,origin,fixtures,run,observe,requiredCases}=ctx;
 const scope=key==='assignments'?'composition':'navigation',spec=(await loadCoreDescendantPresentationPlan(scope)).find(r=>r.key===key);assert.ok(spec);
 const fixture=fixtures.descendantPresentation.contexts[key];assert.ok(fixture);
 return run('core-descendant-filter-selection-'+key,[],async()=>{
  const checkpoint=async phase=>{const request={id:randomUUID(),kind:'descendant-presentation-state',key,phase},value=await ctx.nativeCheckpoint(request);for(const field of Object.keys(request))assert.equal(value[field],request[field]);assert.equal(value.status,'pass');return value;};const before=await checkpoint('before');
  const contract=await loadCoreDescendantFilterContract(key,before.filterRows,before.regions);assert.equal(contract.sourceSha256,before.filterOwnerSha256);
  const grid=page.locator('[data-admin-data-grid-scroll]:visible'),rows=grid.locator(':scope > article'),trigger=page.locator('[data-admin-filter-trigger]:visible');
  const visible=()=>rows.locator('[data-admin-row-action="more"][data-admin-entity-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-admin-entity-id')));
  const modal=()=>page.getByRole('dialog',{name:'الفلاتر',exact:true});let posts=0;
  const count=r=>{if(r.method()==='POST'&&new URL(r.url()).origin===origin&&r.headers()['next-action'])posts++;};page.on('request',count);
  const activate=async()=>{if(fixture.tab)await page.locator('[data-admin-tab-id="'+fixture.tab+'"]').click();await expect(grid).toHaveCount(1);};
  const url=new URL(fixture.route,origin);url.searchParams.set('q',fixture.search);url.searchParams.set('limit',String(spec.pageSizeOptions.find(size=>size>=before.ids.length)));
  const restore=async()=>{await observe('descendant-filter-owned-route',()=>page.goto(url.href,{waitUntil:'domcontentloaded'}));await activate();await expect.poll(visible).toEqual(contract.project(fixture.search,{}));};
  const select=async(filter,option)=>{await trigger.click();await expect(modal()).toHaveCount(1);const field=modal().locator('[data-admin-filter-field="'+filter.id+'"]');await field.getByRole('option',{name:option.label,exact:true}).click();await expect(field.getByRole('option',{name:option.label,exact:true})).toHaveAttribute('aria-selected','true');};
  assert.equal(fixtures.descendantPresentation.mode,'closure');assert.equal(coreDescendantFilterCases(contract,fixture.search).length>0,true);const observations=[];try{
   await restore();const baseline=await visible();assert.ok(baseline.length>0);
   for(const filter of contract.filters){
    const options=[...(filter.options??[]),...(filter.groups??[]).flatMap(group=>group.options)].filter(row=>!row.disabled);assert.ok(options.length);const positive=options.find(option=>contract.project(fixture.search,{[filter.paramKey]:option.value}).length>0);assert.ok(positive,'Current declared filter must have a native positive.');
    await select(filter,positive);await modal().getByRole('button',{name:'إلغاء',exact:true}).click();await expect(modal()).toHaveCount(0);await expect(trigger).toBeFocused();await expect.poll(visible).toEqual(baseline);assert.equal(new URL(page.url()).searchParams.has(filter.paramKey),false);
    const alternate=options.find(option=>option.value!==positive.value&&JSON.stringify(contract.project(fixture.search,{[filter.paramKey]:option.value}))!==JSON.stringify(contract.project(fixture.search,{[filter.paramKey]:positive.value})));
    for(const option of [positive,...(alternate?[alternate]:[])]){
     await select(filter,option);await modal().getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();await expect(modal()).toHaveCount(0);
     const expected=contract.project(fixture.search,{[filter.paramKey]:option.value});await expect.poll(visible).toEqual(expected);await expect.poll(()=>new URL(page.url()).searchParams.get(filter.paramKey)).toBe(option.value);assert.equal(new URL(page.url()).searchParams.has('page'),false);
     await page.reload({waitUntil:'domcontentloaded'});await activate();await expect.poll(visible).toEqual(expected);
     await page.getByRole('button',{name:'إزالة فلتر '+filter.label,exact:true}).click();await expect.poll(visible).toEqual(baseline);assert.equal(new URL(page.url()).searchParams.has(filter.paramKey),false);
     observations.push({paramKey:filter.paramKey,value:option.value,ids:expected,cancelPreserved:true,reloadRetained:true,chipRemoved:true});
    }
   }
   const selectable=contract.selectableIds(baseline),selection=[];
   if(key==='items'){await expect(grid.getByRole('checkbox')).toHaveCount(0);}else{
    const candidates=rows.locator('input[type="checkbox"]:enabled');assert.equal(await candidates.count(),selectable.length);assert.ok(selectable.length>0);
    await candidates.first().check();await expect(page.locator('[data-admin-bulk-action-bar]:visible')).toHaveCount(1);await expect(candidates.first()).toBeChecked();assert.deepEqual(await page.locator('[data-admin-bulk-action-bar]:visible input[name="'+(key==='menus'?'menu_ids':'ids')+'"]').evaluateAll(nodes=>nodes.map(n=>String(n.value))),[selectable[0]]);
    await page.getByRole('button',{name:'إلغاء التحديد',exact:true}).click();await expect(candidates.first()).not.toBeChecked();await expect(page.locator('[data-admin-bulk-action-bar]:visible')).toHaveCount(0);
    const all=grid.locator(':scope > div').first().getByRole('checkbox');await all.check();for(const checkbox of await candidates.all())await expect(checkbox).toBeChecked();
    assert.deepEqual(await page.locator('[data-admin-bulk-action-bar]:visible input[name="'+(key==='menus'?'menu_ids':'ids')+'"]').evaluateAll(nodes=>nodes.map(n=>String(n.value))),selectable);await all.uncheck();for(const checkbox of await candidates.all())await expect(checkbox).not.toBeChecked();await expect(page.locator('[data-admin-bulk-action-bar]:visible')).toHaveCount(0);selection.push({ids:selectable,rowSelectClear:true,visibleAllSelectClear:true,commandsSubmitted:0});
   }
   await restore();const after=await checkpoint('after');assert.equal(after.fingerprint,before.fingerprint);assert.deepEqual(after.filterRows,before.filterRows);assert.deepEqual(after.ids,before.ids);assert.deepEqual(after.preference,before.preference);assert.equal(posts,0);
   const result={key,consumer:spec.consumer,route:fixture.route,namedCellBindings:bindCoreDescendantClosureCells(spec,requiredCases),filterOwnerSha256:contract.sourceSha256,nativeIds:[before.id,after.id],observations,selection,writes:0,restored:true,automaticCoverage:[],globalClosed:false};assertCoreDescendantFilterReceipt(contract,fixture.search,result);return result;
  }finally{page.off('request',count);}
 });
}

/** Fixed existing Footer column changed locally, observed empty, then discarded. */
export async function observeCoreFooterEmptyGrid(ctx){
 const {page,origin,fixtures,run,observe,requiredCases,nativeCheckpoint}=ctx;assert.equal(fixtures.descendantPresentation.mode,'closure');const spec=(await loadCoreDescendantPresentationPlan('navigation')).find(row=>row.key==='footer'),fixture=fixtures.descendantPresentation.contexts.footer;
 return run('core-descendant-footer-empty-grid',[],async()=>{
  const checkpoint=async phase=>{const request={id:randomUUID(),kind:'descendant-presentation-state',key:'footer',phase},value=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(value[key],request[key]);assert.equal(value.status,'pass');return value;};const before=await checkpoint('before');
  const {FOOTER_BLOCK_TYPE_LABELS:labels}=await createJiti(import.meta.url,{fsCache:false,moduleCache:false}).import('../../src/app/admin/pages-blocks/footer/footer-builder-labels.ts');let posts=0;const count=r=>{if(r.method()==='POST'&&r.headers()['next-action']&&new URL(r.url()).origin===origin)posts++;};page.on('request',count);
  try{
   await observe('footer-owned-empty-slot',()=>page.goto(origin+fixture.route,{waitUntil:'domcontentloaded'}));await page.locator('[data-admin-tab-id="column-2"]').click();const type=page.getByRole('combobox',{name:'نوع البلوك',exact:true});await expect(type).toHaveCount(1);await expect(type).toContainText(labels.text);const enabled=page.getByRole('switch',{name:'تفعيل العمود',exact:true});await expect(enabled).not.toBeChecked();await enabled.locator('xpath=ancestor::label[1]').click();await expect(enabled).toBeChecked();await type.click();await page.getByRole('option',{name:labels.custom_links,exact:true}).click();await expect(type).toContainText(labels.custom_links);
   const grid=page.locator('[data-admin-data-grid-scroll]:visible');await expect(grid).toHaveCount(1);await expect(grid.locator(':scope > article')).toHaveCount(0);await expect(grid.getByText('لا توجد روابط بعد.',{exact:true})).toBeVisible();await expect(page.locator('[data-admin-table-pagination]:visible')).toHaveCount(0);const headers=await grid.locator(':scope > div').first().locator(':scope > *').allTextContents();const normalized=headers.map(value=>value.trim());assert.deepEqual(normalized,['#','اسم العنصر','الرابط','الهدف','الحالة','الترتيب','الإجراءات']);
   await type.click();await page.getByRole('option',{name:labels.text,exact:true}).click();await expect(type).toContainText(labels.text);await enabled.locator('xpath=ancestor::label[1]').click();await expect(enabled).not.toBeChecked();await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-admin-tab-id="column-2"]').click();await expect(type).toContainText(labels.text);await expect(enabled).not.toBeChecked();await expect(page.locator('[data-admin-data-grid-scroll]:visible')).toHaveCount(0);assert.equal(posts,0);
   const after=await checkpoint('after');assert.equal(after.ownedRunId,before.ownedRunId);assert.equal(after.actorId,before.actorId);assert.equal(after.fingerprint,before.fingerprint);assert.deepEqual(after.ids,before.ids);const result={key:'footer',consumer:spec.consumer,route:fixture.route,namedCellBindings:bindCoreDescendantClosureCells(spec,requiredCases),emptySlot:2,originalType:'text',observedType:'custom_links',headers:normalized,emptyMessageVisible:true,paginationAbsent:true,restored:true,nativeUnchanged:true,visibleRows:0,writes:0,nativeIds:[before.id,after.id],automaticCoverage:[],globalClosed:false};assertCoreFooterEmptyReceipt(result);return result;
  }finally{page.off('request',count);}
 });
}
export async function runCoreDescendantClosureJourneys(ctx,scope){
 assert.ok(['navigation','composition'].includes(scope));assert.equal(ctx.fixtures.descendantPresentation.scope,scope);const plan=await loadCoreDescendantPresentationPlan(scope);assert.deepEqual(Object.keys(ctx.fixtures.descendantPresentation.contexts).sort(),plan.map(row=>row.key).sort());const outcomes=[];
 const selection=ctx.fixtures.descendantPresentation.journeySelection??null;assert.ok(selection===null||selection==='navigation-controls-followup');if(selection!==null){assert.equal(scope,'navigation');assert.equal(ctx.fixtures.descendantPresentation.mode,'closure');}const selected=selection===null?plan:plan.filter(spec=>spec.key==='footer');if(selection!==null)assert.deepEqual(selected.map(spec=>spec.key),['footer']);
 for(const spec of selected)outcomes.push(await(spec.key==='footer'?observeCoreFooterEmptyGrid(ctx):observeCoreDescendantFilterSelection(ctx,spec.key)));
 return{outcomes,automaticCoverage:[],globalClosed:false};
}
