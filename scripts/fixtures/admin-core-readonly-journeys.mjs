import {randomUUID,createHash} from "node:crypto";
import {writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {observeCoreMutationFeedbackAbsence,assertCoreMutationFeedbackAbsence} from "./admin-core-domain-form-journeys.mjs";
import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
import assert from "node:assert/strict";
import { request, expect } from "playwright/test";

export function buildCoreReadonlyJourneyPlan(fixtures) {
  assert.ok(fixtures.readonlyClosure?.id&&fixtures.topic?.title);
  return [
    {entity:"activity_log",path:"/admin/activity-log",placeholder:"بحث في المستخدم أو الكيان...",label:fixtures.topic.title,fields:["id","actor_admin_user_id","action","entity_type","entity_id","entity_label"]},
    {entity:"topics_without_image",path:"/admin/reports/topics-without-image",placeholder:"بحث بالعنوان أو slug",label:fixtures.readonlyClosure.title,fields:["id","title","slug","status","contentType"]},
  ];
}

export async function runCoreReadonlyJourneys(ctx) {
  const {page,context,origin,fixtures,run,observe,readOnlyReadback}=ctx;
  const selected=ctx.journeySelection==="readonly-query-proof",sourceSha256=process.env.QA_ADMIN_SOURCE_SHA256;
  assert.equal(new URL(origin).hostname,"127.0.0.1");assert.ok(Array.isArray(readOnlyReadback));
  const plan=buildCoreReadonlyJourneyPlan(fixtures);
  for(const spec of plan)await run("core-readonly-"+spec.entity+"-query-failure-retry-auth",[],async()=>{
    const endpoint="/api/admin/entity-lists/"+spec.entity,missing="qa-core-absent-"+spec.entity+"-"+Date.now();
    const correlationId=selected?randomUUID():null,activityFixture=selected&&spec.entity==='activity_log'?fixtures.readonlyClosure.activityFixture:null;
    if(activityFixture)assertCoreReadonlyActivityFixture(activityFixture);
    const checkpoint=async phase=>{const input={id:randomUUID(),kind:'form-permission-fingerprint',correlationId,phase},result=await ctx.nativeCheckpoint(input);for(const key of Object.keys(input))assert.equal(result[key],input[key]);assert.equal(result.status,'pass');return result;};
    let nativeBefore=null,mutationFeedbackAbsence=null,confirmationAbsence=null,confirmationObserver=null;const unsafeMethods=[];
    const onRequest=request=>{const method=request.method();if(!['GET','HEAD'].includes(method))unsafeMethods.push(method);};
    // The authorized login has already completed; only this journey's window is observed.
    if(selected){nativeBefore=await checkpoint('before');context.on('request',onRequest);}
    try{
    await observe("readonly-open",()=>page.goto(origin+spec.path,{waitUntil:"domcontentloaded"}));
    const search=page.getByPlaceholder(spec.placeholder,{exact:true});await expect(search).toBeVisible();
    const matches=(response,q)=>{const url=new URL(response.url());return url.origin===origin&&url.pathname===endpoint&&url.searchParams.get("q")===q&&response.request().method()==="GET";};
    const positive=page.waitForResponse(response=>matches(response,spec.label));await search.fill(spec.label);const response=await positive;
    assert.equal(response.status(),200);assert.match(response.headers()["cache-control"],/private.*no-store/);assert.equal(response.headers()["x-admin-entity-list"],spec.entity);
    const payload=await response.json();assert.ok(payload.rows.length>0);assert.ok(payload.pagination.totalRows>=payload.rows.length);
    if(spec.entity==="topics_without_image")assert.deepEqual(payload.rows.map(row=>row.id),[fixtures.readonlyClosure.id]);
    if(selected&&spec.entity==='activity_log')assertCoreReadonlyActivityProjection(payload.rows.map(row=>Object.fromEntries(spec.fields.map(field=>[field,row[field]]))),activityFixture);
    await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    const rows=payload.rows.map(row=>Object.fromEntries(spec.fields.map(field=>[field,row[field]])));
    let denied=0;
    const queryFailureAndRetry=async mark=>{
      const fail=async route=>{const url=new URL(route.request().url());if(url.origin===origin&&url.pathname===endpoint&&url.searchParams.get("q")===missing){denied++;await route.abort("failed");}else await route.fallback();};
    const removeFailedRoute=await registerCorePageRoute(page,"**/*",fail);
    try{
      await search.fill(missing);const error=page.locator("[data-admin-entity-list-query-error]");await expect(error).toBeVisible({timeout:60000});
      assert.ok(denied>0&&denied<=3,"Current shared query owner permits the first attempt plus two retries.");
      await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();await expect(error).toContainText("النتائج السابقة");
      if(mark)await mark("query-error-visible");
      if(confirmationObserver)assert.equal(await confirmationObserver.evaluate(value=>value.mark("query-error-visible")),0);
    }finally{await removeFailedRoute();}
    const retried=page.waitForResponse(value=>matches(value,missing));await page.locator("[data-admin-entity-list-query-error]").getByRole("button",{name:"إعادة المحاولة",exact:true}).click();
    const retry=await retried;assert.equal(retry.status(),200);const empty=await retry.json();assert.equal(empty.pagination.totalRows,0);assert.deepEqual(empty.rows,[]);
    await expect(page.locator("[data-admin-entity-list-query-error]")).toHaveCount(0);await expect(page.getByRole("row").filter({hasText:spec.label})).toHaveCount(0);
      if(mark)await mark("retry-success-visible");
      if(confirmationObserver)assert.equal(await confirmationObserver.evaluate(value=>value.mark("retry-success-visible")),0);
    };
    if(selected){
      confirmationObserver=await page.evaluateHandle(createCoreReadonlyConfirmationObserver);
      try{mutationFeedbackAbsence=await observeCoreMutationFeedbackAbsence({page,perform:queryFailureAndRetry});
        assert.equal(new URL(page.url()).pathname,spec.path);
        confirmationAbsence={...await confirmationObserver.evaluate(value=>value.finish()),sourceSha256,routePathname:spec.path,scope:'mounted-query-error-and-retry',observedBeforeReload:true,automaticCoverage:[],globalClosed:false};
      }finally{try{await confirmationObserver.evaluate(value=>value.disconnect());}finally{await confirmationObserver.dispose();confirmationObserver=null;}}
    }
    else await queryFailureAndRetry(null);
    const invalid=await context.request.get(origin+endpoint+"?page=0",{maxRedirects:0});assert.equal(invalid.status(),400);assert.equal((await invalid.json()).error.code,"invalid_query");
    const anonymous=await request.newContext({baseURL:origin});try{const deniedRead=await anonymous.get(endpoint,{maxRedirects:0});assert.equal(deniedRead.status(),401);assert.deepEqual(await deniedRead.json(),{error:"Unauthorized"});}finally{await anonymous.dispose();}
    await search.fill(spec.label);await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    await observe("readonly-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(search).toHaveValue(spec.label);await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    let readonlyProof;
    if(selected){confirmationAbsence.reloadCount=await page.locator("[data-admin-confirm-dialog-root],[data-admin-confirm-dialog],[data-admin-confirm-submit]").count();assertCoreReadonlyConfirmationAbsence(confirmationAbsence,sourceSha256,spec.path);}
    if(selected){const nativeAfter=await checkpoint('after');assert.deepEqual(unsafeMethods,[]);readonlyProof={sourceSha256,routePathname:spec.path,nativeBefore:nativeBefore.id,nativeAfter:nativeAfter.id,correlationId,requestWindow:'after-login-through-readonly-reload',...(activityFixture?{activityFixture}:{}),unsafeRequestMethods:[...unsafeMethods],mutationFeedbackAbsence,confirmationAbsence,allPublicRowsAndAuditUnchanged:true,automaticCoverage:[],globalClosed:false};assertCoreReadonlyNoWritePair({entity:spec.entity,readonlyProof},nativeBefore,nativeAfter,nativeBefore.ownedRunId,sourceSha256);}
    readOnlyReadback.push({entity:spec.entity,rows});
    return {entity:spec.entity,authenticatedProjectionRows:rows.length,transportFailures:denied,previousRowsPreserved:true,explicitRetrySucceeded:true,invalidQueryRejected:true,anonymousApiRejected:true,reloaded:true,nativeReadbackRequired:true,mutatingCommands:"not-applicable-registered-read-owner",...(selected?{readonlyProof}:{})};
    }finally{if(selected)context.off("request",onRequest);}
  });
}

/** Existing all-public native fingerprints are bound to this exact readonly journey. */
export function assertCoreReadonlyNoWritePair(row,before,after,ownedRunId,sourceSha256){
 const routes={activity_log:'/admin/activity-log',topics_without_image:'/admin/reports/topics-without-image'};
 assert.ok(Object.hasOwn(routes,row.entity));const proof=row.readonlyProof;assert.ok(proof);
 assert.equal(proof.sourceSha256,sourceSha256);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.ok(typeof ownedRunId==='string'&&ownedRunId.length>0);
 assert.equal(proof.routePathname,routes[row.entity]);assert.equal(proof.requestWindow,'after-login-through-readonly-reload');assert.deepEqual(proof.unsafeRequestMethods,[]);
 assert.equal(proof.allPublicRowsAndAuditUnchanged,true);assert.deepEqual(proof.automaticCoverage,[]);assert.equal(proof.globalClosed,false);
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
 assert.match(proof.correlationId,uuid);assert.notEqual(before.id,after.id);
 for(const[record,phase]of [[before,'before'],[after,'after']]){
  assert.equal(record.status,'pass');assert.equal(record.kind,'form-permission-fingerprint');assert.equal(record.phase,phase);assert.equal(record.ownedRunId,ownedRunId);assert.equal(record.correlationId,proof.correlationId);assert.match(record.id,uuid);
  assert.equal(record.adminAuditIncluded,true);assert.equal(record.adminUsersIncluded,true);assert.ok(Number.isSafeInteger(record.publicTableCount)&&record.publicTableCount>0);
  for(const key of ['publicTableInventorySha256','publicDataSha256'])assert.match(record[key],/^[a-f0-9]{64}$/u);
 }
 assert.equal(proof.nativeBefore,before.id);assert.equal(proof.nativeAfter,after.id);
 for(const key of ['publicTableCount','publicTableInventorySha256','publicDataSha256'])assert.equal(after[key],before[key]);
 assertCoreMutationFeedbackAbsence(proof.mutationFeedbackAbsence,sourceSha256);assertCoreReadonlyConfirmationAbsence(proof.confirmationAbsence,sourceSha256,routes[row.entity]);return proof;
}
/** Final fixed SQL projections are required in addition to the broker's no-write pairs. */
export function assertCoreReadonlyQueryProofCompletion(browser,native,readOnly,ownedRunId,sourceSha256,canonicalRequiredCases,readonlyPlan){
 const entities=['activity_log','topics_without_image'],ids=entities.map(entity=>'core-readonly-'+entity+'-query-failure-retry-auth');
 assert.equal(readonlyPlan.selection,'readonly-query-proof');assert.deepEqual(readonlyPlan.readonly.map(row=>row.entity),entities);const activityFixture=readonlyPlan.readonly[0].activityFixture;assertCoreReadonlyActivityFixture(activityFixture,ownedRunId);
 assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'domain-commands');assert.equal(browser.journeySelection,'readonly-query-proof');assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.deepEqual(browser.errors,[]);assert.equal(browser.sourceSha256,sourceSha256);
 assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);assert.deepEqual(browser.evidence.map(row=>row.id),['existing-auth-login',...ids]);
 assert.ok(browser.evidence.every(row=>row.status==='pass'&&Array.isArray(row.coverage)&&row.coverage.length===0));
 const login=browser.evidence[0];assert.equal(login.authenticated,true);assert.equal(login.sessionArtifactWritten,false);assert.match(login.dashboardState,/^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
 const identity=rows=>{assert.ok(Array.isArray(rows)&&rows.length>0);assert.equal(new Set(rows.map(row=>row.key)).size,rows.length);return rows.map(row=>{const result={...row};delete result.status;delete result.evidence;return result;}).sort((a,b)=>a.key.localeCompare(b.key));};
 assert.deepEqual(identity(browser.requiredCases),identity(canonicalRequiredCases));assert.ok(browser.requiredCases.every(row=>row.status==='open'&&row.evidence===null));
 const pendingCells=['activity-log','topics-without-image-report'].map(consumer=>{const key='collection:'+consumer+':capability:feedback',found=browser.requiredCases.filter(row=>row.key===key);assert.equal(found.length,1);assert.equal(found[0].declaration,'not_applicable');assert.equal(found[0].disposition,'NOT_APPLICABLE_PENDING_PROOF');return key;});
 const pendingConfirmationCells=['activity-log','topics-without-image-report'].map(consumer=>{const key='collection:'+consumer+':capability:confirmation',found=browser.requiredCases.filter(row=>row.key===key);assert.equal(found.length,1);assert.equal(found[0].declaration,'not_applicable');assert.equal(found[0].disposition,'NOT_APPLICABLE_PENDING_PROOF');return key;});
 assert.deepEqual(browser.databaseReadback,[]);assert.deepEqual(browser.menuIntegrityReadback,[]);assert.ok(browser.previewMatrix.every(row=>row.status==='open'&&row.evidence===null));
 assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.equal(native.records.length,4);assert.equal(new Set(native.records.map(row=>row.id)).size,4);assert.equal(new Set(native.records.filter(row=>row.phase==='before').map(row=>row.correlationId)).size,2);
 assert.equal(readOnly.status,'pass');assert.deepEqual(readOnly.evidence.map(row=>row.entity),entities);assert.deepEqual(browser.readOnlyReadback.map(row=>row.entity),entities);
 const projections=entities.map((entity,index)=>{
  const row=browser.evidence[index+1],projection=browser.readOnlyReadback[index],actual=readOnly.evidence[index];assert.equal(row.entity,entity);
  assert.equal(row.authenticatedProjectionRows,projection.rows.length);assert.ok(projection.rows.length>0&&projection.rows.length<=50);
  const fields=entity==='activity_log'?['id','actor_admin_user_id','action','entity_type','entity_id','entity_label']:['id','title','slug','status','contentType'];
  for(const value of projection.rows)assert.deepEqual(Object.keys(value).sort(),fields.sort());
  const rowIds=projection.rows.map(value=>Number(value.id));assert.ok(rowIds.every(id=>Number.isSafeInteger(id)&&id>0));assert.equal(new Set(rowIds).size,rowIds.length);
  for(const key of ['previousRowsPreserved','explicitRetrySucceeded','invalidQueryRejected','anonymousApiRejected','reloaded','nativeReadbackRequired'])assert.equal(row[key],true);assert.ok(Number.isSafeInteger(row.transportFailures)&&row.transportFailures>0&&row.transportFailures<=3);assert.equal(row.mutatingCommands,'not-applicable-registered-read-owner');
  assertCoreReadonlyNoWritePair(row,native.records[index*2],native.records[index*2+1],ownedRunId,sourceSha256);
  if(entity==='activity_log'){assert.deepEqual(row.readonlyProof.activityFixture,activityFixture);assertCoreReadonlyActivityProjection(projection.rows,activityFixture);assertCoreReadonlyActivityProjection(actual.actual,activityFixture);}
  assert.equal(actual.nativeProjectionMatched,true);assert.deepEqual(actual.actual,[...projection.rows].sort((a,b)=>Number(a.id)-Number(b.id)));
  return{entity,rows:actual.actual.length,nativeProjectionMatched:true};
 });
 return{status:'readonly-query-proof-joined',selection:'readonly-query-proof',selectedJourneyIds:ids,sourceSha256,ownedRunId,nativeCheckpointIds:native.records.map(row=>row.id),projections,pendingCells,pendingConfirmationCells,activityFixture,zeroWrites:true,confirmationAbsentInMountedQueryWindow:true,mutationFeedbackAbsentInQueryWindow:true,queryErrorAndRetryPreserved:true,wholeCohortExecuted:false,automaticCoverage:[],globalClosed:false};
}

export function assertCoreReadonlyActivityFixture(fixture,ownedRunId=fixture?.ownedRunId){
 assert.ok(fixture);for(const key of ['id','actorId','entityId'])assert.ok(Number.isSafeInteger(fixture[key])&&fixture[key]>0);
 assert.equal(fixture.actorUsername,'qa_admin_interaction');assert.equal(fixture.action,'qa.readonly.fixture');assert.equal(fixture.entityType,'topic');assert.ok(typeof fixture.entityLabel==='string'&&fixture.entityLabel.length>0);
 assert.equal(fixture.verificationFixture,true);assert.equal(fixture.purpose,'readonly-query-proof');assert.equal(fixture.domainMutationEvidence,false);assert.ok(typeof ownedRunId==='string'&&ownedRunId);assert.equal(fixture.ownedRunId,ownedRunId);assert.equal(Object.hasOwn(fixture,'command'),false);return fixture;
}
export function assertCoreReadonlyActivityProjection(rows,fixture){
 assertCoreReadonlyActivityFixture(fixture);assert.deepEqual(rows,[{id:fixture.id,actor_admin_user_id:fixture.actorId,action:'qa.readonly.fixture',entity_type:'topic',entity_id:fixture.entityId,entity_label:fixture.entityLabel}]);return rows;
}

/** Observe existing Confirmation owner markers; query notices are not confirmation intents. */
export function createCoreReadonlyConfirmationObserver(){
 const attributes=['data-admin-confirm-dialog-root','data-admin-confirm-dialog','data-admin-confirm-submit'],selector=attributes.map(key=>'['+key+']').join(','),initialCount=document.querySelectorAll(selector).length;
 let observedEntries=0;const checkpoints=[],countNode=node=>node?.nodeType===1?Number(node.matches(selector))+node.querySelectorAll(selector).length:0;
 const inspect=records=>{for(const record of records){if(record.type==='childList')for(const node of [...record.addedNodes,...record.removedNodes])observedEntries+=countNode(node);else if(record.type==='attributes'&&attributes.includes(record.attributeName))observedEntries+=Math.max(countNode(record.target),Number(record.oldValue!==null));}};
 const observer=new MutationObserver(inspect);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:attributes});
 return{mark(label){inspect(observer.takeRecords());const count=document.querySelectorAll(selector).length;checkpoints.push({label,count});return count;},finish(){inspect(observer.takeRecords());const finalCount=document.querySelectorAll(selector).length;observer.disconnect();return{initialCount,finalCount,observedEntries,checkpoints,disconnected:true};},disconnect(){observer.disconnect();}};
}
export function assertCoreReadonlyConfirmationAbsence(proof,sourceSha256,routePathname){
 assert.ok(proof);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(proof.sourceSha256,sourceSha256);assert.ok(['/admin/activity-log','/admin/reports/topics-without-image'].includes(routePathname));assert.equal(proof.routePathname,routePathname);
 for(const key of ['initialCount','finalCount','observedEntries','reloadCount'])assert.equal(proof[key],0);
 assert.deepEqual(proof.checkpoints,[{label:'query-error-visible',count:0},{label:'retry-success-visible',count:0}]);assert.equal(proof.disconnected,true);assert.equal(proof.observedBeforeReload,true);assert.equal(proof.scope,'mounted-query-error-and-retry');assert.deepEqual(proof.automaticCoverage,[]);assert.equal(proof.globalClosed,false);return proof;
}

/** Exact missing Sitemap command/Table/scroll observation; no readonly-query or qualified lifecycle replay. */
export const CORE_SITEMAP_CLOSURE_SELECTION = "sitemap-closure-followup";
export const CORE_SITEMAP_CLOSURE_IDS = ["core-sitemap-bounded-command-table-scroll"];
export function assertCoreSitemapClosureReceipt(browser, requiredCases) {
 assert.equal(browser.journeySelection, CORE_SITEMAP_CLOSURE_SELECTION);assert.equal(browser.cohort,"domain-commands");assert.equal(browser.scope,"core-closure");
 assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.status,"pass");assert.deepEqual(browser.errors,[]);assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);
 assert.deepEqual(browser.selectedJourneyIds,CORE_SITEMAP_CLOSURE_IDS);assert.deepEqual(browser.executedJourneyIds,CORE_SITEMAP_CLOSURE_IDS);assert.deepEqual(browser.evidence.map(r=>r.id),["existing-auth-login",...CORE_SITEMAP_CLOSURE_IDS]);assert.ok(browser.evidence.every(r=>r.status==="pass"));
 assert.deepEqual(browser.requiredCases.map(r=>Object.fromEntries(Object.entries(r).filter(([key])=>!['status','evidence'].includes(key)))),requiredCases.map(r=>Object.fromEntries(Object.entries(r).filter(([key])=>!['status','evidence'].includes(key)))));assert.ok(browser.requiredCases.every(r=>r.status==="open"&&r.evidence===null));assert.deepEqual(browser.databaseReadback,[]);assert.deepEqual(browser.readOnlyReadback,[]);
 const row=browser.evidence[1];assert.equal(row.consumer,"activity-sitemap-media-commands");assert.equal(row.surface,"sitemap-check");assert.equal(row.actualCommandPosts,1);assert.equal(row.nativeWrites,0);assert.equal(row.nativeCheckpointIds.length,2);assert.equal(new Set(row.nativeCheckpointIds).size,2);assert.ok(row.effectiveSourceFields.length>0);assert.equal(new Set(row.effectiveSourceFields).size,row.effectiveSourceFields.length);assert.ok(row.effectiveSourceCells.every(r=>r.length===5));assert.equal(row.commandPayloadBound,true);assert.equal(row.nativeBefore.correlationId,row.nativeAfter.correlationId);for(const k of["publicTableCount","publicTableInventorySha256","publicDataSha256","ownedRunId"])assert.deepEqual(row.nativeBefore[k],row.nativeAfter[k]);assert.equal(row.nativeBefore.adminAuditIncluded,true);assert.equal(row.nativeAfter.adminAuditIncluded,true);assert.equal(row.nativeBefore.phase,"before");assert.equal(row.nativeAfter.phase,"after");assert.deepEqual(row.automaticCoverage,[]);assert.equal(row.globalClosed,false);
 return {selection:CORE_SITEMAP_CLOSURE_SELECTION,selectedJourneyIds:CORE_SITEMAP_CLOSURE_IDS,wholeCohortExecuted:false,automaticCoverage:[],globalClosed:false};
}
/** Capture one original Action response and forward its unmodified bytes. */
export async function captureCoreSitemapActionResponse(route, origin) {
 let response,failure;
 try {
  const request=route.request(),url=new URL(request.url());
  assert.equal(url.origin,origin);assert.equal(url.pathname,"/admin/seo/sitemap");assert.equal(url.search,"");assert.equal(request.method(),"POST");
  const action=request.headers()["next-action"];assert.ok(typeof action==="string"&&action.length>0);
  response=await route.fetch({maxRetries:0,maxRedirects:0});
  assert.equal(response.url(),request.url());assert.equal(response.status(),200);
  const headers=response.headers();assert.match(headers["content-type"]??"",/^text\/x-component(?:;|$)/iu);assert.equal(headers["x-action-redirect"],undefined);
  const bytes=await response.body();assert.ok(Buffer.isBuffer(bytes)&&bytes.length>0);
  await route.fulfill({response,body:bytes});
  return {pathname:url.pathname,method:"POST",actionIdSha256:createHash("sha256").update(action).digest("hex"),httpStatus:response.status(),contentType:headers["content-type"],cacheControl:headers["cache-control"]??null,hasActionRedirect:false,upstreamRequests:1,maxRetries:0,maxRedirects:0,byteLength:bytes.length,bodySha256:createHash("sha256").update(bytes).digest("hex"),bodyBase64:bytes.toString("base64"),fulfilledUnchanged:true};
 }catch(error){failure=error;try{await route.abort("failed");}catch{/* Preserve the original capture failure. */}throw error;}finally{if(response){try{await response.dispose();}catch(error){if(!failure)throw error;}}}
}

export async function runCoreSitemapClosureJourney(ctx) {
 const{page,origin,run,observe,nativeCheckpoint,requiredCases}=ctx;assert.equal(ctx.journeySelection,CORE_SITEMAP_CLOSURE_SELECTION);assert.equal(new URL(origin).hostname,"127.0.0.1");
 const{observeCoreScrollbarAdoption}=await import("./admin-core-rendered-adoption.mjs");
 return run(CORE_SITEMAP_CLOSURE_IDS[0],[],async()=>{
  await observe("sitemap-current-owner-open",()=>page.goto(origin+"/admin/seo/sitemap",{waitUntil:"domcontentloaded"}));await expect(page.getByRole("heading",{name:"لوحة صحة SEO العامة",exact:true})).toBeVisible();
  const grid=page.getByRole("region",{name:"Effective Source Contract",exact:true}),button=page.getByRole("button",{name:"تشغيل الفحص الكامل",exact:true});await expect(grid).toBeVisible();await expect(button).toBeEnabled();assert.ok(await grid.locator("article").count()>0);
  const correlationId=randomUUID(),checkpoint=async phase=>{const input={id:randomUUID(),kind:"form-permission-fingerprint",correlationId,phase},r=await nativeCheckpoint(input);for(const k of Object.keys(input))assert.equal(r[k],input[k]);assert.equal(r.status,"pass");return r;};
  const before=await checkpoint("before");let release,markHeld;const released=new Promise(r=>{release=r;}),held=new Promise(r=>{markHeld=r;});let posts=0;
  let responseCapture,captureError,completeCapture;const captured=new Promise(resolve=>{completeCapture=resolve;});
  const handler=async route=>{const request=route.request(),url=new URL(request.url());if(url.origin===origin&&url.pathname==="/admin/seo/sitemap"&&request.method()==="POST"&&request.headers()["next-action"]){try{posts++;assert.equal(posts,1);markHeld();await released;responseCapture=await captureCoreSitemapActionResponse(route,origin);}catch(error){captureError??=error;try{await route.abort("failed");}catch{/* Preserve the original request failure. */}}finally{completeCapture();}}else await route.fallback();};
  const removeRoute=await registerCorePageRoute(page,"**/*",handler);let snapshot,journeyFailure;
  try{
   await button.click();await observe("sitemap-owned-command-held",()=>held);await expect(page.getByRole("button",{name:"جارٍ الفحص...",exact:true})).toBeDisabled();await page.keyboard.press("Enter");assert.equal(posts,1);release();
   await captured;if(captureError)throw captureError;assert.ok(responseCapture);
   const output=process.env.QA_ADMIN_OUTPUT,sourceSha256=process.env.QA_ADMIN_SOURCE_SHA256;assert.ok(output);assert.match(sourceSha256??"",/^[a-f0-9]{64}$/u);writeFileSync(join(resolve(output),"core-sitemap-action-response.json"),JSON.stringify({status:"captured-original-sitemap-action-response-not-qualification",sourceSha256,ownedRunId:before.ownedRunId,correlationId,commandResponse:responseCapture},null,2)+"\n",{flag:"wx"});
   const models=Buffer.from(responseCapture.bodyBase64,"base64").toString("utf8").split("\n").flatMap(line=>{const index=line.indexOf(":");if(index<0)return[];try{return[JSON.parse(line.slice(index+1))];}catch{return[];}});const matching=models.filter(r=>r&&typeof r==="object"&&!Array.isArray(r)&&typeof r.checkedAt==="string"&&Array.isArray(r.effectiveSources)&&Array.isArray(r.checks));assert.equal(matching.length,1,"Actual action model must contain exactly one complete health snapshot");snapshot=matching[0];assert.ok(Number.isFinite(Date.parse(snapshot.checkedAt)));await expect(button).toBeEnabled();
  }catch(error){journeyFailure=error;throw error;}finally{release();try{await removeRoute();}catch(error){if(!journeyFailure)throw error;}}
  assert.equal(posts,1);const expected=snapshot.effectiveSources.map(r=>[r.field,({database:"Database",environment:"Environment",code_fallback:"Code fallback"})[r.source],r.persisted?"نعم":"لا",r.environmentKey,r.displayValue].map(String));assert.ok(expected.every(r=>r.length===5&&r[1]!=="undefined"));await expect(grid.locator("article")).toHaveCount(expected.length);
  const cells=await grid.locator("article").evaluateAll(rows=>rows.map(row=>[...row.children].map(cell=>(cell.textContent??"").trim())));assert.deepEqual(cells,expected,"Actual returned field/source/persistence/value must match the mounted table");
  const scroll=await observeCoreScrollbarAdoption({page,origin,requiredCases,id:"sitemap-effective-source-scroll",bindings:[{boundary:"collection",consumer:"sitemap-monitor",surface:"/admin/seo/sitemap"}],container:grid,target:grid.locator("article").last().locator(":scope > *").last(),axis:"x",containment:"overscroll-contain"});
  const after=await checkpoint("after");for(const k of["publicTableCount","publicTableInventorySha256","publicDataSha256","ownedRunId"])assert.deepEqual(before[k],after[k]);
  return{consumer:"activity-sitemap-media-commands",surface:"sitemap-check",actualCommandPosts:posts,nativeWrites:0,nativeBefore:before,nativeAfter:after,nativeCheckpointIds:[before.id,after.id],effectiveSourceFields:snapshot.effectiveSources.map(r=>r.field),effectiveSourceCells:cells,commandPayloadBound:true,commandResponse:responseCapture,checkedAt:snapshot.checkedAt,renderedAdoption:[scroll],healthDiagnosticStatus:snapshot.status,healthStatusIsNotClosureGate:true,automaticCoverage:[],globalClosed:false};
 });
}
