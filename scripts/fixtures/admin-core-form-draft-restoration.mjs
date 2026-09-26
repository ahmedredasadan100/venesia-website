import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const identifier=/^[a-z0-9][a-z0-9:_-]{0,179}$/u;
const hash=/^[a-f0-9]{64}$/u;
const same=(a,b,message)=>assert.ok(JSON.stringify(a)===JSON.stringify(b),message);
function fingerprint(value,request){
 assert.ok(value&&value.status==='pass'&&value.kind==='form-permission-fingerprint');
 for(const key of ['id','correlationId','phase'])assert.equal(value[key],request[key]);
 assert.ok(typeof value.ownedRunId==='string'&&value.ownedRunId.length>0);
 assert.ok(Number.isSafeInteger(value.publicTableCount)&&value.publicTableCount>0);
 assert.equal(value.adminAuditIncluded,true);assert.equal(value.adminUsersIncluded,true);
 for(const key of ['publicTableInventorySha256','publicDataSha256'])assert.match(value[key],hash);
 return value;
}
function unchanged(before,after){
 assert.notEqual(before.id,after.id);
 for(const key of ['ownedRunId','publicTableCount','publicTableInventorySha256','publicDataSha256'])assert.equal(after[key],before[key],'Native public state or run changed after the pre-delivery rejection.');
}

/** Private control values exist only for this one attempt and never enter its receipt. */
async function privateDraft(form){
 return form.evaluate(element=>{
  const controls=Array.from(element.elements).filter(node=>['INPUT','TEXTAREA','SELECT'].includes(node.tagName)).map(node=>{
   const base={tag:node.tagName,name:node.getAttribute('name')??'',type:node.getAttribute('type')??''};
   if(node.tagName==='SELECT')return{...base,selected:Array.from(node.options,option=>({value:option.value,selected:option.selected}))};
   if(node.type==='file')return{...base,files:Array.from(node.files??[],file=>({name:file.name,size:file.size,type:file.type,lastModified:file.lastModified}))};
   return{...base,value:node.value,...(node.tagName==='INPUT'?{checked:node.checked,indeterminate:node.indeterminate}:{})};
  });
  return{controls,editable:Array.from(element.querySelectorAll('[contenteditable="true"]'),node=>node.innerHTML),nonemptyFileControls:controls.filter(control=>control.files?.length).length};
 });
}

/** One known pre-delivery rejection, native no-write and submitted-draft proof; never SQL rollback. */
export async function verifyCoreFormDraftRestoration({page,origin,sourceSha256,requiredCases,nativeCheckpoint,registerPageRoute,mapping,form,submit,assertDraft,cancelDirty,dirtyNavigation,dirtyNavigationLimit}){
 let phase='input-validation',release,removeRoute,timer,requestFailure,clicking;let attempted=false,aborted=0,matching=0,observed=0,routeFailure;
 let snapshot=null;const requests=[];
 const inputKeys=['caseId','journeyId','formConsumer','surface'];
 try{
  const base=new URL(origin);assert.equal(base.origin,origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);assert.match(sourceSha256,hash);
  assert.deepEqual(Object.keys(mapping).sort(),inputKeys.sort());for(const key of inputKeys)assert.match(mapping[key],identifier);
  const cells=requiredCases.filter(row=>row.boundary==='form'&&row.consumer===mapping.formConsumer&&row.surface===mapping.surface&&row.scenario==='rollback');assert.equal(cells.length,1);assert.equal(typeof cells[0].key,'string');
  assert.ok(['close','navigation','not-declared'].includes(dirtyNavigation));
  if(dirtyNavigation==='not-declared'){assert.equal(cancelDirty,undefined);assert.ok(typeof dirtyNavigationLimit==='string'&&dirtyNavigationLimit.length>0&&dirtyNavigationLimit.length<=300);}
  else{assert.equal(typeof cancelDirty,'function');assert.equal(dirtyNavigationLimit,undefined);}
  assert.equal(typeof nativeCheckpoint,'function');assert.equal(typeof registerPageRoute,'function');assert.ok(assertDraft===undefined||typeof assertDraft==='function');
  const originalUrl=page.url(),url=new URL(originalUrl);assert.equal(url.origin,origin);assert.ok(url.pathname.startsWith('/admin/')&&!['/admin/login','/admin/forgot-password'].includes(url.pathname));
  await expect(form).toHaveCount(1);await expect(form).toHaveAttribute('data-admin-form-runtime','');await expect(form).toHaveAttribute('data-admin-form-dirty','true');await expect(submit).toBeEnabled();
  const entity=await form.getAttribute('data-admin-form-entity');assert.ok(entity&&/^[a-zA-Z0-9:_-]+$/u.test(entity));
  const feedback=page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="form:'+entity+'"][data-admin-feedback-variant="danger"]');
  phase='private-draft-capture';snapshot=await privateDraft(form);assert.ok(snapshot.controls.length>0);if(assertDraft)await assertDraft();
  const correlationId=randomUUID(),native=async step=>{const request={id:randomUUID(),kind:'form-permission-fingerprint',correlationId,phase:step};return fingerprint(await nativeCheckpoint(request),request);};
  phase='native-before';const before=await native('before');
  let held;const seen=new Promise(resolve=>{held=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const isAction=request=>request.method()==='POST'&&Boolean(request.headers()['next-action'])&&new URL(request.url()).origin===origin&&new URL(request.url()).pathname===url.pathname;
  const listener=request=>{if(isAction(request)){observed++;requests.push(request);}};
  phase='route-registration';removeRoute=await registerPageRoute(page,'**/*',async route=>{
   const request=route.request();if(!isAction(request)){await route.fallback();return;}
   matching++;held();await gate;
   try{assert.match(request.headers()['next-action'],/^[a-f0-9]{40,64}$/u);await route.abort('failed');aborted++;}catch{routeFailure=true;throw Error('Submitted-draft controlled route did not abort.');}
  });
  page.on('request',listener);
  try{
   requestFailure=page.waitForEvent('requestfailed',{predicate:request=>requests.includes(request)&&isAction(request),timeout:25_000});void requestFailure.catch(()=>{});
   phase='dispatch';attempted=true;clicking=submit.click();void clicking.catch(()=>{});
   await Promise.race([seen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No exact submitted Action reached the owned interceptor.')),25_000);})]);
   phase='pending';await expect(form).toHaveAttribute('aria-busy','true');await expect(form.locator('fieldset[data-admin-form-fields]')).toHaveJSProperty('disabled',true);await expect(submit).toBeDisabled();assert.equal(matching,1);assert.equal(observed,1);
   release();phase='actual-transport-failure';const failed=await requestFailure;assert.ok(failed.failure()?.errorText);await clicking;assert.equal(routeFailure,undefined);assert.equal(aborted,1);assert.equal(matching,1);assert.equal(observed,1);
   phase='settled-error';await expect(submit).toBeEnabled();await expect(form).not.toHaveAttribute('aria-busy','true');await expect(form.locator('fieldset[data-admin-form-fields]')).toHaveJSProperty('disabled',false);await expect(feedback).toHaveCount(1);await expect(feedback).toBeVisible();await expect(form).toHaveAttribute('data-admin-form-dirty','true');assert.equal(page.url(),originalUrl);
   phase='restored-draft';same(await privateDraft(form),snapshot,'Submitted private controls changed after rejection.');if(assertDraft)await assertDraft();
   phase='dirty-cancellation';if(cancelDirty)await cancelDirty();assert.equal(page.url(),originalUrl);await expect(form).toHaveAttribute('data-admin-form-dirty','true');same(await privateDraft(form),snapshot,'Submitted private controls changed during dirty cancellation.');if(assertDraft)await assertDraft();
   phase='route-cleanup';await removeRoute();removeRoute=undefined;assert.equal(routeFailure,undefined);assert.equal(matching,1);assert.equal(observed,1);assert.equal(aborted,1);
   phase='native-after';const after=await native('after');unchanged(before,after);
   return{status:'submitted-draft-restored-known-no-write',...mapping,receiptId:randomUUID(),candidateRequiredCase:cells[0].key,sourceSha256,ownedRunId:before.ownedRunId,routePathname:url.pathname,nativeBefore:before.id,nativeAfter:after.id,nativeCorrelationId:correlationId,actionRequests:observed,interceptedActions:matching,abortedActions:aborted,matchingActionForwarded:false,actualRequestFailed:true,nativePublicStateUnchanged:true,adminAuditIncluded:true,submittedControlsRestored:true,dirtyStateRetained:true,dirtyNavigation,dirtyNavigationVerified:Boolean(cancelDirty),...(dirtyNavigationLimit?{dirtyNavigationLimit}:{}),fileBoundary:snapshot.nonemptyFileControls?'File metadata retained; binary upload/Storage restoration is not claimed.':'No authored FileList restoration claim.',secretsOrDraftArtifactsWritten:false,automaticCoverage:[],globalClosed:false,proofBoundary:'Exactly one actual Action aborted before forwarding, full owned public state including audit unchanged, and submitted Form draft retained. No SQL transaction rollback, unknown-commit recovery or later retry success is inferred.'};
  }finally{page.off('request',listener);}
 }catch{throw Error('Submitted-draft restoration proof failed at '+phase+'. No restoration coverage granted.');}
 finally{
  clearTimeout(timer);release?.();
  try{if(removeRoute)await removeRoute();}catch{throw Error('Submitted-draft route cleanup failed. No restoration coverage granted.');}
  finally{if(attempted)await Promise.allSettled([requestFailure,clicking].filter(Boolean));snapshot=null;requests.length=0;}
 }
}

/** Same-run join only; qualified candidates remain separate from automatic axis credit. */
export function assertCoreFormDraftRestorationJoin({artifact,browser,native,ownedRunId,sourceSha256}){
 assert.ok(artifact&&Array.isArray(artifact.receipts)&&artifact.receipts.length>0);assert.equal(artifact.status,'partial-not-global-pass');assert.equal(artifact.sourceSha256,sourceSha256);assert.match(sourceSha256,hash);assert.equal(browser.sourceSha256,sourceSha256);assert.equal(native.ownedRunId,ownedRunId);assert.ok(Array.isArray(native.records));assert.equal(new Set(native.records.map(row=>row.id)).size,native.records.length,'Duplicate native identity is not new proof.');
 const keys=new Set(),ids=new Set(),qualified=[];
 for(const receipt of artifact.receipts){
  assert.equal(receipt.status,'submitted-draft-restored-known-no-write');assert.equal(receipt.sourceSha256,sourceSha256);assert.equal(receipt.ownedRunId,ownedRunId);assert.match(receipt.receiptId,uuid);assert.equal(ids.has(receipt.receiptId),false);ids.add(receipt.receiptId);assert.equal(keys.has(receipt.candidateRequiredCase),false);keys.add(receipt.candidateRequiredCase);
  const cell=browser.requiredCases.filter(row=>row.key===receipt.candidateRequiredCase);assert.equal(cell.length,1);assert.equal(cell[0].boundary,'form');assert.equal(cell[0].scenario,'rollback');assert.equal(cell[0].consumer,receipt.formConsumer);assert.equal(cell[0].surface,receipt.surface);
  const journey=browser.evidence.filter(row=>row.id===receipt.journeyId);assert.equal(journey.length,1);assert.equal(journey[0].status,'pass');assert.equal(browser.errors.some(row=>row.id===receipt.journeyId),false);
  for(const key of ['actualRequestFailed','nativePublicStateUnchanged','adminAuditIncluded','submittedControlsRestored','dirtyStateRetained'])assert.equal(receipt[key],true);for(const key of ['actionRequests','interceptedActions','abortedActions'])assert.equal(receipt[key],1);assert.equal(receipt.matchingActionForwarded,false);assert.equal(receipt.secretsOrDraftArtifactsWritten,false);assert.deepEqual(receipt.automaticCoverage,[]);assert.equal(receipt.globalClosed,false);
  for(const key of ['nativeBefore','nativeAfter','nativeCorrelationId'])assert.match(receipt[key],uuid);assert.ok(native.records.findIndex(row=>row.id===receipt.nativeBefore)<native.records.findIndex(row=>row.id===receipt.nativeAfter),'Native before/after order must be retained.');
  const matches=native.records.filter(row=>row.correlationId===receipt.nativeCorrelationId);assert.equal(matches.length,2);const before=matches.find(row=>row.id===receipt.nativeBefore),after=matches.find(row=>row.id===receipt.nativeAfter);fingerprint(before,{id:receipt.nativeBefore,correlationId:receipt.nativeCorrelationId,phase:'before'});fingerprint(after,{id:receipt.nativeAfter,correlationId:receipt.nativeCorrelationId,phase:'after'});unchanged(before,after);assert.equal(before.ownedRunId,ownedRunId);
  if(receipt.dirtyNavigation==='not-declared'){assert.equal(receipt.dirtyNavigationVerified,false);assert.ok(receipt.dirtyNavigationLimit);}else{assert.ok(['close','navigation'].includes(receipt.dirtyNavigation));assert.equal(receipt.dirtyNavigationVerified,true);}
  qualified.push({key:receipt.candidateRequiredCase,receiptId:receipt.receiptId,journeyId:receipt.journeyId,nativeBefore:receipt.nativeBefore,nativeAfter:receipt.nativeAfter,dirtyNavigation:receipt.dirtyNavigation});
 }
 return{status:'partial-not-global-pass',browserStatus:browser.status,nativeStatus:native.status,qualified,automaticCoverage:[],globalClosed:false,scope:'Only exact completed submitted-draft restoration candidates joined to this owned run; no full cohort, alias or SQL rollback promotion.'};
}
