import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect } from 'playwright/test';
import { loadCoreQueryPresentationPlan } from './admin-core-query-presentation-plan.mjs';

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
export async function runCoreQueryPresentationJourneys(ctx){
 const {page,origin,fixtures,run,observe,nativeCheckpoint,actionResponse,assertActionAcknowledged}=ctx;
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
  const first=await checkpoint(spec,'first'),empty=await checkpoint(spec,'empty');assert.equal(first.completeIds.length,spec.rowCount);assert.equal(empty.pagination.totalRows,0);
  await open(empty);await assertPage(spec,empty);
  const toolbar=page.locator('[data-admin-collection-toolbar-owner]'),search=toolbar.locator('input').first();
  await expect(search).toBeVisible();await search.fill(fixtures.queryClosure.contexts[spec.key].search);await assertPage(spec,first);
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
  let filterBoundary='source-contract-has-no-filter-recipe';
  if(spec.filter){
   const filtered=await checkpoint(spec,'filtered');assert.ok(filtered.pagination.totalRows>0&&filtered.pagination.totalRows<first.pagination.totalRows,'Filter fixture must split the real complete set.');
   await page.locator('[data-admin-filter-trigger]').click();const field=page.locator('[data-admin-filter-modal-fields]').getByRole('group',{name:spec.filter.label,exact:true});
   await field.getByRole('option',{name:spec.filter.optionLabel,exact:true}).click();await page.getByRole('button',{name:'تطبيق الفلاتر',exact:true}).click();await assertPage(spec,filtered);
   await page.getByRole('button',{name:'مسح كل الفلاتر',exact:true}).click();await assertPage(spec,first);filterBoundary={key:spec.filter.key,actualFilterAndClear:true,filteredRows:filtered.pagination.totalRows,otherDeclaredFilterKeysRemainUnproven:Object.keys(spec.contract.rawFilterSchemas).filter(key=>key!==spec.filter.key)};
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
   const info=page.locator('[data-admin-row-actions-information][data-admin-entity-id="'+row.id+'"]');await expect(info).toBeVisible();await expect(info).toContainText(row.label);await page.keyboard.press('Escape');await expect(more).toBeFocused();rowEvidence.push({kind:'information',nativeLabel:row.label,focusReturned:true});
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
    if(kind==='edit'){await button.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);rowEvidence.push({kind,mode:'actual-existing-edit-modal-open-close'});}
    else throw new Error('New non-link Preview requires a reviewed bounded destination recipe.');
   }
  }
  const after=await checkpoint(spec,'first');assert.equal(after.fixtureFingerprint,first.fixtureFingerprint);assert.equal(after.actorId,first.actorId);
  const outcome={nativeCheckpointIds:[...nativeIds.get(spec.key)],routeKey:spec.key,consumerId:spec.consumerId,entity:spec.entity,nativeActorId:first.actorId,querySearchEmptyNonempty:true,pageUnion:union.length,backAndReload:true,outOfRangeClamped:true,pageSizeChanged:true,sortBoundary,filterBoundary,optionalColumn:{key:removed[0],persistedAndReloaded:true,semanticBaselineRestored:true,physicalInitialAbsenceRestored:first.preference!==null},rowEvidence,domainFingerprintUnchanged:true,remaining:['Other registered filters not listed above','No full capability-axis promotion from this receipt alone']};outcomes.push(outcome);return outcome;
 });
 return {status:outcomes.length===plan.length?'pass':'fail',outcomes,scope:'Actual registered query/presentation and bounded nonmutating row information, joined to same-run native fixture projections. Each missing sub-invariant remains explicit.'};
}
