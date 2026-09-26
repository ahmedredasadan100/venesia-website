import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';
import {loadCoreTemplatePresentationPlan} from './admin-core-template-library-presentation-plan.mjs';
import {observeCoreScrollbarAdoption} from './admin-core-rendered-adoption.mjs';
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** Read/presentation extension of the existing nine library recipes. No
 * mutation receipt, full capability axis or whole-cohort pass is inferred. */
export async function runCoreTemplateLibraryPresentationJourneys(ctx){
 const {page,origin,fixtures,run,observe,nativeCheckpoint,actionResponse,assertActionAcknowledged,requiredCases}=ctx;
 assert.equal(new URL(origin).hostname,'127.0.0.1');assert.ok(Array.isArray(requiredCases));const plan=await loadCoreTemplatePresentationPlan();
 assert.deepEqual(Object.keys(fixtures.templateLibraryPresentation.contexts).sort(),plan.map(spec=>spec.kind).sort());
 const grid=page.locator('[data-admin-data-grid-scroll]'),header=grid.locator(':scope > div').first(),rows=grid.locator(':scope > article');
 const visibleIds=()=>rows.locator('[data-admin-row-action="more"][data-admin-entity-id]').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('data-admin-entity-id'))));
 const assertIds=expected=>expect.poll(visibleIds,{timeout:60000}).toEqual(expected);
 const pagination=page.locator('[data-admin-table-pagination]');
 async function limit(value){await pagination.locator('button[aria-haspopup="listbox"]').click();await page.locator('[data-admin-table-pagination-menu]').getByRole('option',{name:String(value),exact:true}).click();}
 async function go(spec,query){await observe('template-presentation-owned-route',()=>page.goto(origin+spec.route+'?'+query,{waitUntil:'domcontentloaded'}));}
 const results=[];
 for(const spec of plan)await run('core-template-presentation-'+spec.kind,[],async()=>{
  const fixture=fixtures.templateLibraryPresentation.contexts[spec.kind],nativeCheckpointIds=[];
  const checkpoint=async phase=>{const request={id:randomUUID(),kind:'template-library-presentation-state',moduleKind:spec.kind,phase};const result=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(result[key],request[key]);assert.equal(result.status,'pass');assert.ok(result.ownedRunId);assert.ok(Number.isSafeInteger(result.actorId)&&result.actorId>0);nativeCheckpointIds.push(result.id);return result;};
  const first=await checkpoint('before');assert.deepEqual(first.orderedIds,fixture.ids);assert.equal(first.rows.length,spec.rowCount);assert.deepEqual(first.sorts.map(sort=>sort.key),spec.sorts.map(sort=>sort.key));
  let posts=0;const count=request=>{if(request.method()==='POST'&&request.headers()['next-action']&&new URL(request.url()).origin===origin)posts++;};page.on('request',count);
  try{
   const base=new URLSearchParams({q:fixture.search});await go(spec,base);await expect(grid).toHaveCount(1);await assertIds(first.orderedIds.slice(0,spec.pageSize));
   const renderedAdoption=[];
   if(requiredCases.some(row=>row.boundary==='collection'&&row.consumer===spec.consumer&&row.axis==='scrollbar'&&row.scenario==='complete_applicable_capability_behavior')){
    const cells=rows.first().locator(':scope > *'),target=cells.nth((await cells.count())-2);
    renderedAdoption.push(await observeCoreScrollbarAdoption({page,origin,requiredCases,bindings:[{boundary:'collection',consumer:spec.consumer,surface:spec.route}],container:grid,target,axis:'x',containment:'overscroll-contain',id:'template-library-'+spec.kind+'-scrollbar'}));
   }
   const pages=[await visibleIds()];
   for(let index=2;index<=Math.ceil(spec.rowCount/spec.pageSize);index++){
    await page.locator('[data-admin-pagination-slot="page"]').filter({hasText:new RegExp('^'+index+'$')}).click();await assertIds(first.orderedIds.slice((index-1)*spec.pageSize,index*spec.pageSize));pages.push(await visibleIds());
   }
   assert.deepEqual(pages.flat(),first.orderedIds);assert.equal(new Set(pages.flat()).size,spec.rowCount);
   await page.goBack({waitUntil:'domcontentloaded'});await assertIds(pages[1]);await page.reload({waitUntil:'domcontentloaded'});await assertIds(pages[1]);
   await go(spec,new URLSearchParams({q:fixture.search,page:'999'}));await assertIds(pages.at(-1));
   const wide=spec.pageSizeOptions.find(size=>size>=spec.rowCount);assert.ok(wide);await limit(wide);await assertIds(first.orderedIds);
   const sorts=[];
   for(const nativeSort of first.sorts){
    const button=header.getByRole('button',{name:new RegExp('^'+escape(nativeSort.label)+'(?:\\s|$)')});await expect(button).toHaveCount(1);await expect(button).toHaveAttribute('aria-pressed','false');
    await button.click();await expect(button).toHaveAttribute('aria-pressed','true');await expect(button).toContainText('مرتب تصاعديًا');await assertIds(nativeSort.ascending);const ascending=await visibleIds();
    await button.click();await expect(button).toContainText('مرتب تنازليًا');await assertIds(nativeSort.descending);const descending=await visibleIds();
    await button.click();await expect(button).toHaveAttribute('aria-pressed','false');await assertIds(first.orderedIds);sorts.push({key:nativeSort.key,ascending,descending,reset:await visibleIds()});
   }
   // The actual auto footer disappears when all23rows fit. Restore the default
   // through the existing bounded URL owner; there is no hidden control to click.
   await expect(pagination).toHaveCount(0);await go(spec,base);await assertIds(pages[0]);assert.equal(posts,0,'Pagination, every declared sort and scrollbar observations are read-only.');
   const statusSort=spec.sorts.find(sort=>sort.key==='status'),statusHeader=header.getByRole('button',{name:new RegExp('^'+escape(statusSort.label)+'(?:\\s|$)')});
   const originalHeaderCells=await header.locator(':scope > *').count(),originalRowCells=await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length));
   await expect(statusHeader).toHaveCount(1);await expect(rows.locator('[data-admin-row-action="visibility"]')).toHaveCount(pages[0].length);
   const trigger=page.locator('[data-admin-toolbar-columns] button'),menu=page.locator('[data-admin-column-menu]');await trigger.click();
   await expect(menu.getByRole('checkbox',{name:'إخفاء عمود '+spec.columns.find(column=>column.key==='name').label,exact:true})).toBeDisabled();
   const saved=actionResponse();await menu.getByRole('checkbox',{name:'إخفاء عمود الحالة',exact:true}).click();assertActionAcknowledged(await saved);await expect(trigger.locator('.animate-spin')).toHaveCount(0,{timeout:60000});await expect(menu.locator('[role="alert"]')).toHaveCount(0);await page.keyboard.press('Escape');
   await expect(statusHeader).toHaveCount(0);await expect(rows.locator('[data-admin-row-action="visibility"]')).toHaveCount(0);assert.equal(await header.locator(':scope > *').count(),originalHeaderCells-1);assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length)),originalRowCells.map(value=>value-1));
   const hidden=await checkpoint('columns-hidden');assert.equal(hidden.fingerprint,first.fingerprint);await page.reload({waitUntil:'domcontentloaded'});await assertIds(pages[0]);await expect(statusHeader).toHaveCount(0);await expect(rows.locator('[data-admin-row-action="visibility"]')).toHaveCount(0);
   await trigger.click();const restoredSave=actionResponse();await menu.getByRole('button',{name:'استعادة الأعمدة الافتراضية',exact:true}).click();assertActionAcknowledged(await restoredSave);await expect(menu).toHaveCount(0,{timeout:60000});await expect(trigger.locator('.animate-spin')).toHaveCount(0);await page.reload({waitUntil:'domcontentloaded'});await assertIds(pages[0]);
   await expect(statusHeader).toHaveCount(1);assert.equal(await header.locator(':scope > *').count(),originalHeaderCells);assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(node=>node.children.length)),originalRowCells);await expect(rows.locator('[data-admin-row-action="visibility"]')).toHaveCount(pages[0].length);
   const restored=await checkpoint('columns-restored');assert.equal(restored.fingerprint,first.fingerprint);assert.deepEqual([...restored.preference.visibleColumns].sort(),[...first.preference.visibleColumns].sort());assert.equal(posts,2);
   const nativeRow=first.rows[0],row=rows.filter({has:page.locator('[data-admin-row-action="more"][data-admin-entity-id="'+nativeRow.id+'"]')}),more=row.locator('[data-admin-row-action="more"] button');await expect(row).toHaveCount(1);await more.click();
   const actionMenu=page.locator('[data-admin-row-actions-menu][data-admin-entity-id="'+nativeRow.id+'"]');await expect(actionMenu.locator('[data-admin-row-action-menu-item="copyPublicLink"]')).toHaveCount(0);
   if(['media-hub','media-sidebar'].includes(spec.kind))for(const kind of ['duplicate','delete'])await expect(actionMenu.locator('[data-admin-row-action-menu-item="'+kind+'"]')).toHaveCount(0);
   await actionMenu.locator('[data-admin-row-action-menu-item="information"]').click();const info=page.locator('[data-admin-row-actions-information][data-admin-entity-id="'+nativeRow.id+'"]');await expect(info).toBeVisible();await expect(info).toContainText(nativeRow.name);await expect(info).toContainText(nativeRow.statusLabel);
   for(const key of ['slug','variant','detail'])if(spec.sorts.some(sort=>sort.key===key))await expect(info).toContainText(String(nativeRow.sortValues[key]));
   if(spec.kind==='content')await expect(info).toContainText(nativeRow.formattedUpdatedAt);if(spec.kind==='hero'){assert.equal(nativeRow.assignedPageCount,0);await expect(info).toContainText('الصفحات المربوطة');await expect(info).toContainText('0');}
   await page.keyboard.press('Escape');await expect(info).toHaveCount(0);await expect(more).toBeFocused();
   const edit=row.locator('[data-admin-row-action="edit"] a[href]');await expect(edit).toHaveCount(1);const target=new URL(await edit.getAttribute('href'),origin);assert.equal(target.origin,origin);assert.equal(target.pathname,spec.route+'/'+nativeRow.id);
   await edit.click();await expect.poll(()=>new URL(page.url()).pathname,{timeout:60000}).toBe(target.pathname);await expect(page.locator('main [name="name"]')).toHaveValue(nativeRow.name,{timeout:60000});assert.equal(posts,2);await go(spec,base);await assertIds(pages[0]);
   const after=await checkpoint('after');assert.equal(after.fingerprint,first.fingerprint);assert.equal(posts,2);
   const result={moduleKind:spec.kind,consumer:spec.consumer,nativeActorId:first.actorId,nativeCheckpointIds,pages,sorts,preferencePosts:posts,backAndReload:true,pageSizeChanged:true,outOfRangeClamped:true,optionalHeaderAndCellsRestored:true,informationNativeFields:true,ownedEditNavigation:true,domainAndAuditUnchanged:true,copyPublicLink:'hidden-by-current-contract',renderedAdoption,automaticCoverage:[],globalClosed:false,
    boundary:'All current visible sort keys and selected declared pagination/column/information/edit behavior; exact original preferences require the separate native finally cleanup. No automatic full-axis or whole-cohort credit.'};results.push(result);return result;
  }finally{page.off('request',count);}
 });
 return{outcomes:results,automaticCoverage:[],globalClosed:false};
}
