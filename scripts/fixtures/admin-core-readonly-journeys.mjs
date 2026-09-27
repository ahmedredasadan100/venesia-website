import {randomUUID} from "node:crypto";
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
    let nativeBefore=null,mutationFeedbackAbsence=null;const unsafeMethods=[];
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
    }finally{await removeFailedRoute();}
    const retried=page.waitForResponse(value=>matches(value,missing));await page.locator("[data-admin-entity-list-query-error]").getByRole("button",{name:"إعادة المحاولة",exact:true}).click();
    const retry=await retried;assert.equal(retry.status(),200);const empty=await retry.json();assert.equal(empty.pagination.totalRows,0);assert.deepEqual(empty.rows,[]);
    await expect(page.locator("[data-admin-entity-list-query-error]")).toHaveCount(0);await expect(page.getByRole("row").filter({hasText:spec.label})).toHaveCount(0);
      if(mark)await mark("retry-success-visible");
    };
    if(selected)mutationFeedbackAbsence=await observeCoreMutationFeedbackAbsence({page,perform:queryFailureAndRetry});
    else await queryFailureAndRetry(null);
    const invalid=await context.request.get(origin+endpoint+"?page=0",{maxRedirects:0});assert.equal(invalid.status(),400);assert.equal((await invalid.json()).error.code,"invalid_query");
    const anonymous=await request.newContext({baseURL:origin});try{const deniedRead=await anonymous.get(endpoint,{maxRedirects:0});assert.equal(deniedRead.status(),401);assert.deepEqual(await deniedRead.json(),{error:"Unauthorized"});}finally{await anonymous.dispose();}
    await search.fill(spec.label);await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    await observe("readonly-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(search).toHaveValue(spec.label);await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    let readonlyProof;
    if(selected){const nativeAfter=await checkpoint('after');assert.deepEqual(unsafeMethods,[]);readonlyProof={sourceSha256,routePathname:spec.path,nativeBefore:nativeBefore.id,nativeAfter:nativeAfter.id,correlationId,requestWindow:'after-login-through-readonly-reload',...(activityFixture?{activityFixture}:{}),unsafeRequestMethods:[...unsafeMethods],mutationFeedbackAbsence,allPublicRowsAndAuditUnchanged:true,automaticCoverage:[],globalClosed:false};assertCoreReadonlyNoWritePair({entity:spec.entity,readonlyProof},nativeBefore,nativeAfter,nativeBefore.ownedRunId,sourceSha256);}
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
 assertCoreMutationFeedbackAbsence(proof.mutationFeedbackAbsence,sourceSha256);return proof;
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
 return{status:'readonly-query-proof-joined',selection:'readonly-query-proof',selectedJourneyIds:ids,sourceSha256,ownedRunId,nativeCheckpointIds:native.records.map(row=>row.id),projections,pendingCells,activityFixture,zeroWrites:true,mutationFeedbackAbsentInQueryWindow:true,queryErrorAndRetryPreserved:true,wholeCohortExecuted:false,automaticCoverage:[],globalClosed:false};
}

export function assertCoreReadonlyActivityFixture(fixture,ownedRunId=fixture?.ownedRunId){
 assert.ok(fixture);for(const key of ['id','actorId','entityId'])assert.ok(Number.isSafeInteger(fixture[key])&&fixture[key]>0);
 assert.equal(fixture.actorUsername,'qa_admin_interaction');assert.equal(fixture.action,'qa.readonly.fixture');assert.equal(fixture.entityType,'topic');assert.ok(typeof fixture.entityLabel==='string'&&fixture.entityLabel.length>0);
 assert.equal(fixture.verificationFixture,true);assert.equal(fixture.purpose,'readonly-query-proof');assert.equal(fixture.domainMutationEvidence,false);assert.ok(typeof ownedRunId==='string'&&ownedRunId);assert.equal(fixture.ownedRunId,ownedRunId);assert.equal(Object.hasOwn(fixture,'command'),false);return fixture;
}
export function assertCoreReadonlyActivityProjection(rows,fixture){
 assertCoreReadonlyActivityFixture(fixture);assert.deepEqual(rows,[{id:fixture.id,actor_admin_user_id:fixture.actorId,action:'qa.readonly.fixture',entity_type:'topic',entity_id:fixture.entityId,entity_label:fixture.entityLabel}]);return rows;
}
