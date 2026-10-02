import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {expect} from 'playwright/test';
import {selectCoreTemplatePresentationPlan,loadCoreTemplatePresentationPlan,assertCoreTemplateSearchIds,assertCoreTemplateSearchObservation} from './admin-core-template-library-presentation-plan.mjs';
import {observeCoreScrollbarAdoption} from './admin-core-rendered-adoption.mjs';
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');


export function selectCoreLinkPreviewAction(manifest,worker,{buildMetadata,projectDirectory=process.cwd(),recordProjection=()=>{},exportedName="resolveAdminLinkAjax"}={}){
 assert.ok(['resolveAdminLinkAjax','browseAdminLinksAjax'].includes(exportedName));
 assert.ok(manifest&&manifest.node&&typeof worker==='string');assert.ok(buildMetadata&&typeof buildMetadata.appDir==='string');
 const project=realpathSync(projectDirectory),app=resolve(buildMetadata.appDir);assert.equal(app,project,'Compiled metadata must belong to this exact owned build project.');
 const config=buildMetadata.config;assert.ok(config&&typeof config.outputFileTracingRoot==='string');const root=realpathSync(config.turbopack?.root??config.outputFileTracingRoot);assert.equal(resolve(config.outputFileTracingRoot),root,'Compiled tracing and bundler roots must agree.');
 const relativeProject=relative(root,project),segments=relativeProject.split(/[\\/]/u);assert.equal(isAbsolute(relativeProject),false);assert.equal(segments.includes('..'),false,'The owned project must remain inside the compiled workspace root.');assert.equal(typeof buildMetadata.relativeAppDir,'string');assert.equal(buildMetadata.relativeAppDir.replaceAll('\\','/'),relativeProject.replaceAll('\\','/'));
 const owner='src/lib/admin/links/actions.ts',physicalOwner=resolve(project,owner);assert.equal(realpathSync(physicalOwner),physicalOwner,'The canonical resolver source must be owned by this build project.');
 const filenames=[...new Set([owner,relative(root,physicalOwner).replaceAll('\\','/')])],entries=Object.entries(manifest.node),matches=entries.filter(([,row])=>filenames.includes(row.filename)&&row.exportedName===exportedName&&Object.hasOwn(row.workers??{},worker));
 // Persist only this public identity projection before admission; never emit the manifest or encryption key.
 recordProjection({owner,exportedName,worker,allowedFilenames:filenames,sourceSha256:createHash('sha256').update(readFileSync(physicalOwner)).digest('hex'),candidates:entries.filter(([,row])=>row.exportedName===exportedName||filenames.includes(row.filename)).map(([id,row])=>({actionIdSha256:createHash('sha256').update(id).digest('hex'),filename:typeof row.filename==='string'?row.filename:null,exportedName:typeof row.exportedName==='string'?row.exportedName:null,workerPresent:Object.hasOwn(row.workers??{},worker)})),matches:matches.length});
 assert.equal(matches.length,1,'Only the actual compiled resolver export for this exact edit worker may be admitted.');assert.match(matches[0][0],/^[a-f0-9]{40,64}$/u);return matches[0][0];
}

export function assertCoreReadOnlyEditRequests(requests,{origin,pathname,actionId,expectedValues}){
 assert.ok(Array.isArray(requests)&&Array.isArray(expectedValues));if(expectedValues.length)assert.match(actionId,/^[a-f0-9]{40,64}$/u);else assert.equal(actionId,null);const expected=expectedValues.map(value=>JSON.stringify([value])).sort(),actual=[];
 for(const request of requests){assert.equal(request.method,'POST');const url=new URL(request.url);assert.equal(url.origin,origin);assert.equal(url.pathname,pathname);assert.equal(request.actionId,actionId);assert.match(request.contentType,/^text\/plain(?:;|$)/iu);assert.ok(typeof request.body==='string'&&request.body.length<=16384);actual.push(JSON.stringify(JSON.parse(request.body)));}
 assert.deepEqual(actual.sort(),expected,'No extra, missing, duplicate, foreign Action or mutated payload is a read-only resolver call.');
 return{owner:'src/lib/admin/links/actions.ts#resolveAdminLinkAjax',count:requests.length,payloadSha256:expected.map(value=>createHash('sha256').update(value).digest('hex')),actionIdSha256:actionId===null?null:createHash('sha256').update(actionId).digest('hex')};
}


/** Read/presentation extension of the existing nine library recipes. No
 * mutation receipt, full capability axis or whole-cohort pass is inferred. */
export async function runCoreTemplateLibraryPresentationJourneys(ctx){
 const {page,origin,fixtures,run,observe,nativeCheckpoint,actionResponse,assertActionAcknowledged,requiredCases}=ctx;
 assert.equal(new URL(origin).hostname,'127.0.0.1');assert.ok(Array.isArray(requiredCases));const fullPlan=await loadCoreTemplatePresentationPlan(),plan=selectCoreTemplatePresentationPlan(fullPlan,ctx.journeySelection);
 assert.deepEqual(Object.keys(fixtures.templateLibraryPresentation.contexts).sort(),fullPlan.map(spec=>spec.kind).sort());
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
  let posts=0,editing=false;const editRequests=[],editResponses=new Map();const responseObserved=response=>{if(editRequests.some(entry=>entry.request===response.request()))editResponses.set(response.request(),response);};const count=request=>{if(request.method()==='POST'&&request.headers()['next-action']&&new URL(request.url()).origin===origin){if(editing)editRequests.push({request,method:request.method(),url:request.url(),actionId:request.headers()['next-action'],contentType:request.headers()['content-type']??'',body:request.postData()});else posts++;}};page.on('request',count);page.on('response',responseObserved);
  try{
   const base=new URLSearchParams({q:fixture.search});await go(spec,base);await expect(grid).toHaveCount(1);await assertIds(first.orderedIds.slice(0,spec.pageSize));
   const renderedAdoption=[];
   if(requiredCases.some(row=>row.boundary==='collection'&&row.consumer===spec.consumer&&row.axis==='scrollbar'&&row.scenario==='complete_applicable_capability_behavior')){
    const cells=rows.first().locator(':scope > *'),target=cells.nth((await cells.count())-2);
    renderedAdoption.push(await observeCoreScrollbarAdoption({page,origin,requiredCases,bindings:[{boundary:'collection',consumer:spec.consumer,surface:spec.route}],container:grid,target,axis:'x',containment:'overscroll-contain',id:'template-library-'+spec.kind+'-scrollbar'}));
   }
   const searchEvidence={mode:first.search.mode,minLength:first.search.minLength,sourceHashes:first.search.sourceHashes,cases:[],posts:0,automaticCoverage:[],globalClosed:false};
   const searchInput=page.locator('input[type="search"][role="combobox"]');await expect(searchInput).toHaveCount(1);const searchLimit=Math.max(...spec.pageSizeOptions);await limit(searchLimit);
   for(const scenario of first.search.cases){
    if(scenario.id==='clear')await searchInput.locator('..').getByRole('button',{name:'مسح',exact:true}).click();else{await searchInput.fill(scenario.query);await searchInput.press('Enter');}
    await expect(searchInput).toHaveValue(scenario.query);await expect.poll(()=>new URL(page.url()).searchParams.get('q'),{timeout:60000}).toBe(scenario.query||null);await expect.poll(()=>new URL(page.url()).searchParams.get('page')).toBe(null);
    const firstPageParam=new URL(page.url()).searchParams.get('page'),count=scenario.groups.flat().length,searchPages=[];
    for(let index=0;index<Math.max(1,Math.ceil(count/searchLimit));index++){
     if(index){await page.locator('[data-admin-pagination-slot="page"]').filter({hasText:new RegExp('^'+(index+1)+'$')}).click();await expect.poll(()=>new URL(page.url()).searchParams.get('page')).toBe(String(index+1));}
     const expectedCount=Math.min(searchLimit,count-index*searchLimit);await expect.poll(async()=>{try{assertCoreTemplateSearchIds(scenario.groups,await visibleIds(),{offset:index*searchLimit,count:expectedCount});return true;}catch{return false;}},{timeout:60000}).toBe(true);searchPages.push(await visibleIds());
    }
    assertCoreTemplateSearchIds(scenario.groups,searchPages.flat());const params=new URL(page.url()).searchParams;
    searchEvidence.cases.push({id:scenario.id,query:scenario.query,inputValue:await searchInput.inputValue(),queryParam:params.get('q'),firstPageParam,limit:Number(params.get('limit')),unrelatedParams:[...params].filter(([key])=>!['q','page','limit'].includes(key)),clearClicked:scenario.id==='clear',enterPressed:scenario.id!=='clear',pages:searchPages});
   }
   searchEvidence.posts=posts;assert.equal(posts,0,'Actual literal, one-character, clear and restore search must perform no Server Action.');await go(spec,base);await assertIds(first.orderedIds.slice(0,spec.pageSize));
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
   // Read only the compiled export projection; never persist the manifest's encryption key.
   const actionId=nativeRow.linkPreviewValues.length?selectCoreLinkPreviewAction(JSON.parse(readFileSync(resolve(process.cwd(),'.next/server/server-reference-manifest.json'),'utf8')),'app'+spec.route+'/[id]/page',{buildMetadata:JSON.parse(readFileSync(resolve(process.cwd(),'.next/required-server-files.json'),'utf8')),recordProjection:projection=>console.log('core-template-link-preview-projection '+JSON.stringify(projection))}):null;editing=true;
   await edit.click();await expect.poll(()=>new URL(page.url()).pathname,{timeout:60000}).toBe(target.pathname);await expect(page.locator('main [name="name"]')).toHaveValue(nativeRow.name,{timeout:60000});
   await expect.poll(()=>editRequests.length,{timeout:60000}).toBe(nativeRow.linkPreviewValues.length);
   await expect.poll(()=>editRequests.every(entry=>editResponses.has(entry.request)),{timeout:60000}).toBe(true);
   for(const entry of editRequests)assertActionAcknowledged(editResponses.get(entry.request));
   assert.equal(posts,2);await go(spec,base);await assertIds(pages[0]);
   const after=await checkpoint('after');assert.equal(after.fingerprint,first.fingerprint);assert.equal(posts,2);editing=false;
   searchEvidence.binding={beforeCheckpointId:first.id,afterCheckpointId:after.id,actorId:first.actorId,ownedRunId:first.ownedRunId,moduleKind:spec.kind,consumer:spec.consumer};assertCoreTemplateSearchObservation(spec,first.search,searchEvidence,searchEvidence.binding);
   const readOnlyEdit=assertCoreReadOnlyEditRequests(editRequests,{origin,pathname:target.pathname,actionId,expectedValues:nativeRow.linkPreviewValues});
   const result={moduleKind:spec.kind,consumer:spec.consumer,nativeActorId:first.actorId,nativeCheckpointIds,searchEvidence,pages,sorts,preferencePosts:posts,readOnlyEdit,backAndReload:true,pageSizeChanged:true,outOfRangeClamped:true,optionalHeaderAndCellsRestored:true,informationNativeFields:true,ownedEditNavigation:true,domainAndAuditUnchanged:true,copyPublicLink:'hidden-by-current-contract',renderedAdoption,automaticCoverage:[],globalClosed:false,
    boundary:'All current visible sort keys and selected declared pagination/column/information/edit behavior; exact original preferences require the separate native finally cleanup. No automatic full-axis or whole-cohort credit.'};results.push(result);return result;
  }finally{page.off('request',count);page.off('response',responseObserved);}
 });
 return{outcomes:results,automaticCoverage:[],globalClosed:false};
}
