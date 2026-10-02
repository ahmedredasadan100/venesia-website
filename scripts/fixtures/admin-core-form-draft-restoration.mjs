import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {selectCoreLinkPreviewAction} from './admin-core-template-library-presentation-journeys.mjs';
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

/** Failure-only public export labels; never persist the build manifest or secret fields. */
function describeDiscardReopenRequests(requests){
 try{
  const raw=readFileSync(new URL('../../.next/server/server-reference-manifest.json',import.meta.url)),manifest=JSON.parse(raw.toString('utf8'));
  return{manifestStatus:'read',manifestSha256:createHash('sha256').update(raw).digest('hex'),requests:requests.map(({method,actionId})=>{const entry=actionId?(manifest.node?.[actionId]??manifest.edge?.[actionId]):null;const name=entry?.exportedName,file=typeof entry?.filename==='string'?entry.filename.replaceAll('\\','/'):null,match=file?.match(/(?:^|\/)src\/(.+)$/u),filename=match?'src/'+match[1]:null;return{method,actionId,exportedName:typeof name==='string'&&/^[a-zA-Z_$][a-zA-Z0-9_$]{0,159}$/u.test(name)?name:null,filename:filename&&/^src\/[a-zA-Z0-9_./[\]()-]+\.tsx?$/u.test(filename)&&!filename.split('/').includes('..')?filename:null};})};
 }catch{return{manifestStatus:'unavailable',requests};}
}


const HERO_REOPEN_READ_WORKER='app/admin/pages-blocks/blocks/hero/[id]/page';
const HERO_REOPEN_READ_EXPORTS=Object.freeze(['browseAdminLinksAjax','resolveAdminLinkAjax']);
export function assertCoreHeroReopenReadReceipt(value,sourceSha256){
 assert.ok(value&&typeof value==='object');assert.equal(value.contract,'admin-links');assert.equal(value.sourceSha256,sourceSha256);assert.match(sourceSha256,hash);for(const key of ['manifestSha256','buildMetadataSha256','ownerSourceSha256'])assert.match(value[key],hash);assert.equal(value.ownerSourceSha256,createHash('sha256').update(readFileSync(new URL('../../src/lib/admin/links/actions.ts',import.meta.url))).digest('hex'));
 assert.equal(value.worker,HERO_REOPEN_READ_WORKER);assert.match(value.pathname,/^\/admin\/pages-blocks\/blocks\/hero\/[1-9][0-9]*$/u);assert.deepEqual(value.actions.map(r=>r.exportedName),HERO_REOPEN_READ_EXPORTS);assert.equal(new Set(value.actions.map(r=>r.actionIdSha256)).size,2);
 for(const a of value.actions){assert.deepEqual(Object.keys(a).sort(),['actionIdSha256','allowedFilenames','exportedName','filename','owner','worker']);assert.match(a.actionIdSha256,hash);assert.equal(a.owner,'src/lib/admin/links/actions.ts');assert.equal(a.worker,HERO_REOPEN_READ_WORKER);assert.ok(Array.isArray(a.allowedFilenames)&&a.allowedFilenames.length>=1&&a.allowedFilenames.length<=2);assert.equal(a.allowedFilenames[0],a.owner);for(const name of a.allowedFilenames){assert.equal(typeof name,'string');assert.equal(name.split('/').includes('..'),false);assert.ok(name===a.owner||/^\.tmp-qa\/core-final-closure\/browser-[a-z0-9-]+\/public-build-source\/src\/lib\/admin\/links\/actions\.ts$/u.test(name));}assert.ok(a.allowedFilenames.includes(a.filename));}
 assert.ok(Number.isSafeInteger(value.totalPosts)&&value.totalPosts>=0);assert.ok(Number.isSafeInteger(value.readPosts)&&value.readPosts>=0);assert.equal(value.forbiddenPosts,0);assert.equal(value.totalPosts,value.readPosts+value.forbiddenPosts);assert.equal(value.readActionIds.length,value.readPosts);for(const id of value.readActionIds)assert.ok(value.actions.some(a=>a.actionIdSha256===id));assert.equal(value.mutationCapableRequests,0);assert.equal(value.claimsZeroNetworkActions,false);return value;
}
function createHeroReopenReadCounter({origin,pathname,sourceSha256}){
 assert.equal(new URL(origin).origin,origin);assert.equal(new URL(origin).hostname,'127.0.0.1');assert.match(pathname,/^\/admin\/pages-blocks\/blocks\/hero\/[1-9][0-9]*$/u);assert.match(sourceSha256,hash);
 const manifestRaw=readFileSync(new URL('../../.next/server/server-reference-manifest.json',import.meta.url)),metadataRaw=readFileSync(new URL('../../.next/required-server-files.json',import.meta.url)),manifest=JSON.parse(manifestRaw.toString('utf8')),buildMetadata=JSON.parse(metadataRaw.toString('utf8')),projectDirectory=fileURLToPath(new URL('../../',import.meta.url)),actions=[],actionIds=[];let ownerSourceSha256;
 for(const exportedName of HERO_REOPEN_READ_EXPORTS){let projection;const id=selectCoreLinkPreviewAction(manifest,HERO_REOPEN_READ_WORKER,{buildMetadata,projectDirectory,exportedName,recordProjection:p=>{projection=p;}});assert.equal(projection.matches,1);assert.equal(projection.owner,'src/lib/admin/links/actions.ts');assert.equal(projection.exportedName,exportedName);assert.equal(projection.worker,HERO_REOPEN_READ_WORKER);const actionIdSha256=createHash('sha256').update(id).digest('hex'),matched=projection.candidates.filter(r=>r.actionIdSha256===actionIdSha256);assert.equal(matched.length,1);assert.equal(matched[0].workerPresent,true);if(ownerSourceSha256)assert.equal(projection.sourceSha256,ownerSourceSha256);ownerSourceSha256=projection.sourceSha256;actionIds.push(id);actions.push({actionIdSha256,exportedName,owner:projection.owner,worker:projection.worker,filename:matched[0].filename,allowedFilenames:projection.allowedFilenames});}
 const value={contract:'admin-links',sourceSha256,manifestSha256:createHash('sha256').update(manifestRaw).digest('hex'),buildMetadataSha256:createHash('sha256').update(metadataRaw).digest('hex'),ownerSourceSha256,worker:HERO_REOPEN_READ_WORKER,pathname,actions,totalPosts:0,readPosts:0,forbiddenPosts:0,readActionIds:[],mutationCapableRequests:0,claimsZeroNetworkActions:false};
 return{track(request){const url=new URL(request.url());assert.equal(request.method(),'POST');assert.equal(url.origin,origin);value.totalPosts++;const id=request.headers()['next-action'],allowed=url.pathname===pathname&&!url.search&&actionIds.includes(id);if(allowed){value.readPosts++;value.readActionIds.push(createHash('sha256').update(id).digest('hex'));}else{value.forbiddenPosts++;value.mutationCapableRequests++;}return allowed;},receipt(){return structuredClone(assertCoreHeroReopenReadReceipt(value,sourceSha256));}};
}

/** Shared accepted leave observation. Native no-write is settled before reauthoring. */
export async function observeCoreAcceptedDraftDiscard({page,origin,nativeCheckpoint,form,submit,assertDraft,discardDirty,priorNative,sourceSha256}){
 let phase='discard-input-validation';const diagnostic={reopenPosts:0,requests:[]};
 try{
  const base=new URL(origin);assert.equal(base.origin,origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);
  assert.equal(typeof nativeCheckpoint,'function');assert.ok(assertDraft===undefined||typeof assertDraft==='function');
  assert.deepEqual(Object.keys(discardDirty).sort(),['destination','reopenAndRefill','trigger',...(discardDirty.verifyReopen===undefined?[]:['verifyReopen']),...(discardDirty.reopenReadContract===undefined?[]:['reopenReadContract'])].sort());if(discardDirty.verifyReopen!==undefined)assert.equal(discardDirty.verifyReopen,true);if(discardDirty.reopenReadContract!==undefined){assert.equal(discardDirty.reopenReadContract,'admin-links');assert.equal(discardDirty.verifyReopen,true);}assert.equal(typeof discardDirty.trigger?.click,'function');assert.equal(typeof discardDirty.reopenAndRefill,'function');
  assert.deepEqual(Object.keys(discardDirty.destination).sort(),['kind','pathname']);assert.ok(['closed','navigated'].includes(discardDirty.destination.kind));assert.ok(typeof discardDirty.destination.pathname==='string'&&discardDirty.destination.pathname.startsWith('/admin')&&!discardDirty.destination.pathname.includes('?')&&!discardDirty.destination.pathname.includes('#'));
  const originalUrl=page.url(),url=new URL(originalUrl);assert.equal(url.origin,origin);assert.ok(url.pathname.startsWith('/admin/'));
  await expect(form).toHaveCount(1);await expect(form).toHaveAttribute('data-admin-form-runtime','');await expect(form).toHaveAttribute('data-admin-form-dirty','true');await expect(submit).toBeEnabled();if(assertDraft)await assertDraft();
  let acceptedDiscard;
    const discardCorrelationId=randomUUID(),readDiscard=async step=>{const request={id:randomUUID(),kind:'form-permission-fingerprint',correlationId:discardCorrelationId,phase:step};return fingerprint(await nativeCheckpoint(request),request);};
    phase='discard-native-before';const discardBefore=await readDiscard('before');if(priorNative)unchanged(priorNative,discardBefore);
    let discardPosts=0;const discardListener=request=>{if(request.method()==='POST'&&new URL(request.url()).origin===origin)discardPosts++;};page.on('request',discardListener);
    try {
     phase='discard-guard-open';await expect(form).toHaveAttribute('data-admin-form-dirty','true');await expect(discardDirty.trigger).toHaveCount(1);await expect(discardDirty.trigger).toBeEnabled();await discardDirty.trigger.click();
     await expect(page.locator('[data-admin-unsaved-dialog]')).toHaveCount(1);const dialog=page.getByRole('dialog',{name:'إغلاق دون حفظ؟',exact:true});await expect(dialog).toHaveCount(1);await expect(dialog).toBeVisible();
     const accept=dialog.locator('[data-admin-confirm-submit]');await expect(accept).toBeEnabled();await expect(accept).toHaveText('إغلاق دون حفظ');
     phase='discard-accepted';await accept.click();await expect(dialog).toHaveCount(0);
     if(discardDirty.destination.kind==='closed'){await expect(form).toHaveCount(0);assert.equal(page.url(),originalUrl);assert.equal(discardDirty.destination.pathname,url.pathname);}
     else{await expect(page).toHaveURL(current=>current.origin===origin&&current.pathname===discardDirty.destination.pathname);assert.notEqual(discardDirty.destination.pathname,url.pathname);}
     assert.equal(discardPosts,0,'Accepted discard must not deliver a mutation.');
     phase='discard-native-after';const discardAfter=await readDiscard('after');unchanged(discardBefore,discardAfter);assert.equal(discardPosts,0);
     acceptedDiscard={status:'discard-accepted-before-reauthor',kind:discardDirty.destination.kind,fromPathname:url.pathname,toPathname:discardDirty.destination.pathname,nativeBefore:discardBefore.id,nativeAfter:discardAfter.id,nativeCorrelationId:discardCorrelationId,actionRequests:0,nativePublicStateUnchanged:true,adminAuditIncluded:true,guardAccepted:true,observedDestination:true,acceptedBeforeReauthor:true};
    }finally{page.off('request',discardListener);}
    const reopenCorrelationId=randomUUID(),readReopen=async step=>{const request={id:randomUUID(),kind:'form-permission-fingerprint',correlationId:reopenCorrelationId,phase:step};return fingerprint(await nativeCheckpoint(request),request);};
    const reopenBefore=discardDirty.verifyReopen?await readReopen('before'):null;if(reopenBefore)unchanged(discardBefore,reopenBefore);
    const readCounter=discardDirty.reopenReadContract===undefined?null:createHeroReopenReadCounter({origin,pathname:url.pathname,sourceSha256});
    let reopenPosts=0;const reopenListener=request=>{if(request.method()==='POST'&&new URL(request.url()).origin===origin){diagnostic.reopenPosts++;if(!readCounter?.track(request))reopenPosts++;const action=request.headers()['next-action'];if(diagnostic.requests.length<32)diagnostic.requests.push({method:'POST',actionId:typeof action==='string'&&/^[a-f0-9]{40,64}$/u.test(action)?action:null});}};if(reopenBefore)page.on('request',reopenListener);
    try{phase='discard-reopen-reauthor';await discardDirty.reopenAndRefill();phase='discard-reopen-route';assert.equal(page.url(),originalUrl);phase='discard-reopen-form';await expect(form).toHaveCount(1);phase='discard-reopen-dirty';await expect(form).toHaveAttribute('data-admin-form-dirty','true');phase='discard-reopen-submit';await expect(submit).toBeEnabled();phase='discard-reopen-authored-ui';if(assertDraft)await assertDraft();
     if(reopenBefore){phase='discard-reopen-post-count-before-native';assert.equal(reopenPosts,0);if(readCounter)readCounter.receipt();phase='discard-reopen-native-after';const reopenAfter=await readReopen('after');unchanged(reopenBefore,reopenAfter);phase='discard-reopen-post-count-after-native';assert.equal(reopenPosts,0);acceptedDiscard.reopen={nativeBefore:reopenBefore.id,nativeAfter:reopenAfter.id,nativeCorrelationId:reopenCorrelationId,actionRequests:0,nativePublicStateUnchanged:true,draftReauthored:true,originalRouteRestored:true,...(readCounter?{readPosts:readCounter.receipt()}:{})};}
    }finally{if(reopenBefore)page.off('request',reopenListener);}
  return acceptedDiscard;
 }catch{throw Error('Accepted draft discard proof failed at '+phase+'. No discard coverage granted. Diagnostic: '+JSON.stringify({...diagnostic,...describeDiscardReopenRequests(diagnostic.requests)}));}
}

/** One known pre-delivery rejection, native no-write and submitted-draft proof; never SQL rollback. */
export async function verifyCoreFormDraftRestoration({page,origin,sourceSha256,requiredCases,nativeCheckpoint,registerPageRoute,mapping,form,submit,assertDraft,cancelDirty,dirtyNavigation,dirtyNavigationLimit,observePending,discardDirty}){
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
  if(discardDirty!==undefined){
   assert.ok(dirtyNavigation!=='not-declared');assert.deepEqual(Object.keys(discardDirty).sort(),['destination','reopenAndRefill','trigger',...(discardDirty.verifyReopen===undefined?[]:['verifyReopen'])].sort());if(discardDirty.verifyReopen!==undefined)assert.equal(discardDirty.verifyReopen,true);
   assert.equal(typeof discardDirty.trigger?.click,'function');assert.equal(typeof discardDirty.reopenAndRefill,'function');
   assert.deepEqual(Object.keys(discardDirty.destination).sort(),['kind','pathname']);assert.ok(['closed','navigated'].includes(discardDirty.destination.kind));
   assert.ok(typeof discardDirty.destination.pathname==='string'&&discardDirty.destination.pathname.startsWith('/admin')&&!discardDirty.destination.pathname.includes('?')&&!discardDirty.destination.pathname.includes('#'));
  }
  assert.equal(typeof nativeCheckpoint,'function');assert.equal(typeof registerPageRoute,'function');assert.ok(assertDraft===undefined||typeof assertDraft==='function');assert.ok(observePending===undefined||typeof observePending==='function');
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
   if(observePending)await observePending();
   release();phase='actual-transport-failure';const failed=await requestFailure;assert.ok(failed.failure()?.errorText);await clicking;assert.equal(routeFailure,undefined);assert.equal(aborted,1);assert.equal(matching,1);assert.equal(observed,1);
   phase='settled-error';await expect(submit).toBeEnabled();await expect(form).not.toHaveAttribute('aria-busy','true');await expect(form.locator('fieldset[data-admin-form-fields]')).toHaveJSProperty('disabled',false);await expect(feedback).toHaveCount(1);await expect(feedback).toBeVisible();await expect(form).toHaveAttribute('data-admin-form-dirty','true');assert.equal(page.url(),originalUrl);
   phase='restored-draft';same(await privateDraft(form),snapshot,'Submitted private controls changed after rejection.');if(assertDraft)await assertDraft();
   phase='dirty-cancellation';if(cancelDirty)await cancelDirty();assert.equal(page.url(),originalUrl);await expect(form).toHaveAttribute('data-admin-form-dirty','true');same(await privateDraft(form),snapshot,'Submitted private controls changed during dirty cancellation.');if(assertDraft)await assertDraft();
   phase='route-cleanup';await removeRoute();removeRoute=undefined;assert.equal(routeFailure,undefined);assert.equal(matching,1);assert.equal(observed,1);assert.equal(aborted,1);
   phase='native-after';const after=await native('after');unchanged(before,after);
   phase='discard-shared-observation';const acceptedDiscard=discardDirty?await observeCoreAcceptedDraftDiscard({page,origin,nativeCheckpoint,form,submit,assertDraft,discardDirty,priorNative:after}):undefined;
   return{status:'submitted-draft-restored-known-no-write',...mapping,receiptId:randomUUID(),candidateRequiredCase:cells[0].key,sourceSha256,ownedRunId:before.ownedRunId,routePathname:url.pathname,nativeBefore:before.id,nativeAfter:after.id,nativeCorrelationId:correlationId,actionRequests:observed,interceptedActions:matching,abortedActions:aborted,matchingActionForwarded:false,actualRequestFailed:true,nativePublicStateUnchanged:true,adminAuditIncluded:true,submittedControlsRestored:true,dirtyStateRetained:true,dirtyNavigation,dirtyNavigationVerified:Boolean(cancelDirty),...(dirtyNavigationLimit?{dirtyNavigationLimit}:{}),...(acceptedDiscard?{acceptedDiscard}:{}),fileBoundary:snapshot.nonemptyFileControls?'File metadata retained; binary upload/Storage restoration is not claimed.':'No authored FileList restoration claim.',secretsOrDraftArtifactsWritten:false,automaticCoverage:[],globalClosed:false,proofBoundary:'Exactly one actual Action aborted before forwarding, full owned public state including audit unchanged, and submitted Form draft retained. No SQL transaction rollback, unknown-commit recovery or later retry success is inferred.'};
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
 const keys=new Set(),ids=new Set(),nativeClaims=new Set(),correlations=new Set(),qualified=[];
 for(const receipt of artifact.receipts){
  assert.equal(receipt.status,'submitted-draft-restored-known-no-write');assert.equal(receipt.sourceSha256,sourceSha256);assert.equal(receipt.ownedRunId,ownedRunId);assert.match(receipt.receiptId,uuid);assert.equal(ids.has(receipt.receiptId),false);ids.add(receipt.receiptId);assert.equal(keys.has(receipt.candidateRequiredCase),false);keys.add(receipt.candidateRequiredCase);
  const cell=browser.requiredCases.filter(row=>row.key===receipt.candidateRequiredCase);assert.equal(cell.length,1);assert.equal(cell[0].boundary,'form');assert.equal(cell[0].scenario,'rollback');assert.equal(cell[0].consumer,receipt.formConsumer);assert.equal(cell[0].surface,receipt.surface);
  const journey=browser.evidence.filter(row=>row.id===receipt.journeyId);assert.equal(journey.length,1);assert.equal(journey[0].status,'pass');assert.equal(browser.errors.some(row=>row.id===receipt.journeyId),false);
  for(const key of ['actualRequestFailed','nativePublicStateUnchanged','adminAuditIncluded','submittedControlsRestored','dirtyStateRetained'])assert.equal(receipt[key],true);for(const key of ['actionRequests','interceptedActions','abortedActions'])assert.equal(receipt[key],1);assert.equal(receipt.matchingActionForwarded,false);assert.equal(receipt.secretsOrDraftArtifactsWritten,false);assert.deepEqual(receipt.automaticCoverage,[]);assert.equal(receipt.globalClosed,false);
  for(const key of ['nativeBefore','nativeAfter','nativeCorrelationId'])assert.match(receipt[key],uuid);assert.ok(native.records.findIndex(row=>row.id===receipt.nativeBefore)<native.records.findIndex(row=>row.id===receipt.nativeAfter),'Native before/after order must be retained.');
  for(const id of [receipt.nativeBefore,receipt.nativeAfter]){assert.equal(nativeClaims.has(id),false);nativeClaims.add(id);}assert.equal(correlations.has(receipt.nativeCorrelationId),false);correlations.add(receipt.nativeCorrelationId);
  const matches=native.records.filter(row=>row.correlationId===receipt.nativeCorrelationId);assert.equal(matches.length,2);const before=matches.find(row=>row.id===receipt.nativeBefore),after=matches.find(row=>row.id===receipt.nativeAfter);fingerprint(before,{id:receipt.nativeBefore,correlationId:receipt.nativeCorrelationId,phase:'before'});fingerprint(after,{id:receipt.nativeAfter,correlationId:receipt.nativeCorrelationId,phase:'after'});unchanged(before,after);assert.equal(before.ownedRunId,ownedRunId);
  if(receipt.dirtyNavigation==='not-declared'){assert.equal(receipt.dirtyNavigationVerified,false);assert.ok(receipt.dirtyNavigationLimit);}else{assert.ok(['close','navigation'].includes(receipt.dirtyNavigation));assert.equal(receipt.dirtyNavigationVerified,true);}
  if(receipt.acceptedDiscard!==undefined){
   const d=receipt.acceptedDiscard;assert.ok(receipt.dirtyNavigation!=='not-declared');assert.equal(d.status,'discard-accepted-before-reauthor');assert.ok(['closed','navigated'].includes(d.kind));assert.equal(d.fromPathname,receipt.routePathname);
   assert.ok(typeof d.toPathname==='string'&&d.toPathname.startsWith('/admin')&&!d.toPathname.includes('?')&&!d.toPathname.includes('#'));
   if(d.kind==='closed')assert.equal(d.toPathname,d.fromPathname);else assert.notEqual(d.toPathname,d.fromPathname);
   assert.equal(d.actionRequests,0);for(const key of ['nativePublicStateUnchanged','adminAuditIncluded','guardAccepted','observedDestination','acceptedBeforeReauthor'])assert.equal(d[key],true);
   for(const key of ['nativeBefore','nativeAfter','nativeCorrelationId'])assert.match(d[key],uuid);assert.notEqual(d.nativeCorrelationId,receipt.nativeCorrelationId);
   for(const id of [d.nativeBefore,d.nativeAfter]){assert.equal(nativeClaims.has(id),false);nativeClaims.add(id);}assert.equal(correlations.has(d.nativeCorrelationId),false);correlations.add(d.nativeCorrelationId);
   const pair=native.records.filter(row=>row.correlationId===d.nativeCorrelationId);assert.equal(pair.length,2);
   const db=pair.find(row=>row.id===d.nativeBefore),da=pair.find(row=>row.id===d.nativeAfter);fingerprint(db,{id:d.nativeBefore,correlationId:d.nativeCorrelationId,phase:'before'});fingerprint(da,{id:d.nativeAfter,correlationId:d.nativeCorrelationId,phase:'after'});unchanged(after,db);unchanged(db,da);
   const originalAfter=native.records.findIndex(row=>row.id===receipt.nativeAfter),discardBefore=native.records.findIndex(row=>row.id===d.nativeBefore),discardAfter=native.records.findIndex(row=>row.id===d.nativeAfter);assert.ok(originalAfter>=0&&discardBefore>originalAfter&&discardAfter>discardBefore);
   if(d.reopen){const r=d.reopen;assert.equal(r.actionRequests,0);for(const key of ['nativePublicStateUnchanged','draftReauthored','originalRouteRestored'])assert.equal(r[key],true);for(const key of ['nativeBefore','nativeAfter','nativeCorrelationId'])assert.match(r[key],uuid);assert.equal(correlations.has(r.nativeCorrelationId),false);correlations.add(r.nativeCorrelationId);for(const id of [r.nativeBefore,r.nativeAfter]){assert.equal(nativeClaims.has(id),false);nativeClaims.add(id);}const pair=native.records.filter(row=>row.correlationId===r.nativeCorrelationId);assert.equal(pair.length,2);assert.deepEqual(pair.map(row=>row.id),[r.nativeBefore,r.nativeAfter]);fingerprint(pair[0],{id:r.nativeBefore,correlationId:r.nativeCorrelationId,phase:'before'});fingerprint(pair[1],{id:r.nativeAfter,correlationId:r.nativeCorrelationId,phase:'after'});unchanged(da,pair[0]);unchanged(pair[0],pair[1]);assert.ok(native.records.indexOf(pair[0])>discardAfter);}
  }
  qualified.push({key:receipt.candidateRequiredCase,receiptId:receipt.receiptId,journeyId:receipt.journeyId,nativeBefore:receipt.nativeBefore,nativeAfter:receipt.nativeAfter,dirtyNavigation:receipt.dirtyNavigation,...(receipt.acceptedDiscard?{acceptedDiscard:receipt.acceptedDiscard}:{})});
 }
 return{status:'partial-not-global-pass',browserStatus:browser.status,nativeStatus:native.status,qualified,automaticCoverage:[],globalClosed:false,scope:'Only exact completed submitted-draft restoration candidates joined to this owned run; no full cohort, alias or SQL rollback promotion.'};
}
