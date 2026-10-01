import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';

const hash=/^[a-f0-9]{64}$/u,identifier=/^[a-z0-9][a-z0-9:_-]{0,179}$/u;
const viewports=[{name:'desktop',width:1280,height:900},{name:'narrow',width:390,height:760}];

/** Bind observations to the live inventory; this is not a capability registry. */
export function validateCoreRenderedAdoptionBindings({requiredCases,bindings,axis,pathname,formManifest}){
 assert.ok(['scrollbar','modal'].includes(axis));assert.ok(Array.isArray(requiredCases));assert.ok(Array.isArray(bindings)&&bindings.length>0&&bindings.length<=4);
 const keys=new Set();return bindings.map(binding=>{
  assert.deepEqual(Object.keys(binding).sort(),['boundary','consumer','surface']);assert.ok(['form','collection'].includes(binding.boundary));assert.match(binding.consumer,identifier);
  const cells=requiredCases.filter(row=>row.boundary===binding.boundary&&row.consumer===binding.consumer&&row.axis===axis&&row.scenario==='complete_applicable_capability_behavior');
  assert.equal(cells.length,1,'The exact applicable capability cell must exist once.');const cell=cells[0];assert.ok(['adopted','specialized_exception'].includes(cell.declaration));assert.equal(cell.key,`${binding.boundary}:${binding.consumer}:capability:${axis}`);assert.equal(keys.has(cell.key),false);keys.add(cell.key);
  if(binding.boundary==='collection')assert.equal(binding.surface,pathname,'Collection observation must use its actual recipe route.');
  else{
   assert.match(binding.surface,identifier);
   if(formManifest!==undefined){assert.ok(Array.isArray(formManifest));const entries=formManifest.filter(row=>row.id===binding.consumer);assert.equal(entries.length,1,'Canonical Form entry must be unique.');assert.ok(Array.isArray(entries[0].surfaces)&&entries[0].surfaces.includes(binding.surface),'Observation must target the actual declared Form surface.');}
   else assert.ok(requiredCases.some(row=>row.boundary==='form'&&row.consumer===binding.consumer&&row.surface===binding.surface),'Without the canonical Form manifest, a concrete lifecycle surface is required.');
  }
  return{key:cell.key,...binding};
 });
}
function scope(input,axis){
 const {page,origin,requiredCases,bindings,id}=input,sourceSha256=input.sourceSha256??process.env.QA_ADMIN_SOURCE_SHA256;
 const base=new URL(origin),current=new URL(page.url());assert.equal(base.origin,origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);assert.equal(current.origin,origin);assert.ok((current.pathname==='/admin'||current.pathname.startsWith('/admin/'))&&!current.pathname.startsWith('/admin/login'));assert.match(sourceSha256,hash);assert.match(id,identifier);
 return{receiptId:randomUUID(),id,axis,sourceSha256,routePathname:current.pathname,bindings:validateCoreRenderedAdoptionBindings({requiredCases,bindings,axis,pathname:current.pathname,formManifest:input.formManifest}),automaticCoverage:[],globalClosed:false};
}
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function remember(page,container){
 const viewport=page.viewportSize(),active=await page.evaluateHandle(()=>document.activeElement),documentPosition=await page.evaluate(()=>({x:scrollX,y:scrollY}));
 const position=container?await container.evaluate(node=>({x:node.scrollLeft,y:node.scrollTop})):undefined;
 return async()=>{try{if(viewport)await page.setViewportSize(viewport);if(container&&await container.count()===1)await container.evaluate((node,pos)=>node.scrollTo(pos.x,pos.y),position);await page.evaluate(pos=>scrollTo(pos.x,pos.y),documentPosition);await active.evaluate(node=>{if(node instanceof HTMLElement&&node.isConnected)node.focus({preventScroll:true});});await frames(page);}finally{await active.dispose();}};
}

async function actuallyReachable(container,target){
 const owner=await container.elementHandle(),child=await target.elementHandle();assert.ok(owner&&child);
 try{return await container.page().evaluate(({owner,child})=>{const a=child.getBoundingClientRect(),b=owner.getBoundingClientRect(),left=Math.max(0,a.left,b.left),right=Math.min(innerWidth,a.right,b.right),top=Math.max(0,a.top,b.top),bottom=Math.min(innerHeight,a.bottom,b.bottom);if(right-left<2||bottom-top<2)return false;for(const fraction of [0.5,0.2,0.8]){const hit=document.elementFromPoint(left+(right-left)*fraction,top+(bottom-top)*0.5);if(hit&&child.contains(hit))return true;}return false;},{owner,child});}finally{await owner.dispose();await child.dispose();}
}

/** Failure-only geometry, captured before restoration. No DOM writes, content, or changed assertions. */
export function snapshotCoreScrollbarFailure({owner,child,axis}){
 const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const describe=node=>{const style=getComputedStyle(node);return{tag:node.tagName,owner:node===owner,rect:rect(node),overflowX:style.overflowX,overflowY:style.overflowY,position:style.position,visibility:style.visibility,display:style.display,extent:axis==='x'?node.scrollWidth:node.scrollHeight,client:axis==='x'?node.clientWidth:node.clientHeight,scroll:axis==='x'?node.scrollLeft:node.scrollTop};};
 const a=rect(child),b=rect(owner),left=Math.max(0,a.left,b.left),right=Math.min(innerWidth,a.right,b.right),top=Math.max(0,a.top,b.top),bottom=Math.min(innerHeight,a.bottom,b.bottom),hits=[];
 if(right-left>=2&&bottom-top>=2)for(const fraction of [0.5,0.2,0.8]){const x=left+(right-left)*fraction,y=top+(bottom-top)*0.5,hit=document.elementFromPoint(x,y);hits.push({x,y,tag:hit?.tagName??null,insideTarget:!!hit&&child.contains(hit),insideOwner:!!hit&&owner.contains(hit)});}
 const ancestors=[];let node=child.parentElement;for(;node&&ancestors.length<12;node=node.parentElement)ancestors.push(describe(node));
 const section=child.closest('section');return{axis,viewport:{width:innerWidth,height:innerHeight},documentX:scrollX,documentY:scrollY,owner:describe(owner),target:describe(child),ownerContainsTarget:owner.contains(child),intersection:{left,right,top,bottom},hits,ancestors,ancestorsTruncated:!!node,mediaUsageLoading:section?[...section.querySelectorAll('p')].some(p=>p.textContent?.trim()==='جارٍ البحث عن الاستخدامات…'):null};
}
async function captureScrollbarFailureGeometry(container,target,axis){
 let owner,child;try{owner=await container.elementHandle({timeout:1000});child=await target.elementHandle({timeout:1000});if(!owner||!child)return{available:false};return await container.page().evaluate(snapshotCoreScrollbarFailure,{owner,child,axis});}
 finally{if(owner)await owner.dispose();if(child)await child.dispose();}
}

function parentScrollState(node,axis){const rows=[];let current=node.parentElement,depth=0;while(current){const style=getComputedStyle(current),extent=axis==='x'?current.scrollWidth:current.scrollHeight,client=axis==='x'?current.clientWidth:current.clientHeight;if(extent-client>2&&['auto','scroll'].includes(axis==='x'?style.overflowX:style.overflowY))rows.push({depth,extent,client,position:axis==='x'?current.scrollLeft:current.scrollTop});current=current.parentElement;depth++;if(depth>32)throw Error('Unexpected scroll ancestor depth.');}return{ancestors:rows,documentX:scrollX,documentY:scrollY};}
async function retainParentScroll(container){const snapshot=await container.evaluateHandle(node=>{const rows=[];for(let parent=node.parentElement;parent;parent=parent.parentElement)rows.push({element:parent,x:parent.scrollLeft,y:parent.scrollTop});return rows;});return async()=>{try{await snapshot.evaluate(rows=>{for(const row of rows)row.element.scrollTo(row.x,row.y);});}finally{await snapshot.dispose();}};}
function validateParentChaining(row){assert.equal(row.containmentNotClaimed,true);assert.equal(row.computedBrowserDefaultChaining,true);assert.equal(row.backgroundPositionRetained,undefined);assert.equal(row.parentChaining.policy,'browser-default');assert.equal(row.parentChaining.wheelBoundaryExercised,row.state==='overflow-observed');for(const snapshot of[row.parentChaining.before,row.parentChaining.after]){assert.ok(Number.isFinite(snapshot.documentX)&&Number.isFinite(snapshot.documentY));assert.ok(Array.isArray(snapshot.ancestors)&&snapshot.ancestors.length<=32);for(const parent of snapshot.ancestors){assert.deepEqual(Object.keys(parent).sort(),['client','depth','extent','position']);assert.ok(Number.isSafeInteger(parent.depth)&&parent.depth>=0);assert.ok(Number.isFinite(parent.extent)&&Number.isFinite(parent.client)&&parent.client>=0&&parent.extent-parent.client>2&&Number.isFinite(parent.position));}}assert.deepEqual(row.parentChaining.before.ancestors.map(({depth,extent,client})=>({depth,extent,client})),row.parentChaining.after.ancestors.map(({depth,extent,client})=>({depth,extent,client})));assert.equal(row.parentChaining.positionChanged,JSON.stringify(row.parentChaining.before)!==JSON.stringify(row.parentChaining.after));if(row.state==='overflow-observed'){assert.equal(row.targetReachabilityPhase,'inner-boundary-before-parent-wheel');assert.equal(typeof row.targetReachableAfterParentWheel,'boolean');}}
/** Real wheel movement and real content only; no style/content mutation to create overflow. */
export async function observeCoreScrollbarAdoption(input){
 const receipt=scope(input,'scrollbar'),{page,container,target,axis,containment}=input;
 assert.ok(['x','y'].includes(axis));assert.ok(['overscroll-contain','modal-lock','default-chaining'].includes(containment));await expect(container).toHaveCount(1);await expect(container).toBeVisible();await expect(target).toHaveCount(1);
 const handle=await target.elementHandle();assert.ok(handle);try{assert.equal(await container.evaluate((node,child)=>node.contains(child),handle),true);}finally{await handle.dispose();}
 const restore=await remember(page,container),restoreParents=containment==='default-chaining'?await retainParentScroll(container):async()=>{},observations=[];let wheelDiagnostic=null;
 try{for(const viewport of viewports){
  wheelDiagnostic=null;await page.setViewportSize({width:viewport.width,height:viewport.height});await frames(page);await expect(container).toBeVisible();await target.scrollIntoViewIfNeeded();
  const measure=()=>container.evaluate((node,axis)=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return{extent:axis==='x'?node.scrollWidth:node.scrollHeight,client:axis==='x'?node.clientWidth:node.clientHeight,position:axis==='x'?node.scrollLeft:node.scrollTop,direction:style.direction,overflow:axis==='x'?style.overflowX:style.overflowY,overscroll:axis==='x'?style.overscrollBehaviorX:style.overscrollBehaviorY,scrollbarWidth:style.scrollbarWidth,visible:rect.width>0&&rect.height>0,documentX:scrollX,documentY:scrollY,bodyOverflow:getComputedStyle(document.body).overflow,htmlOverflow:getComputedStyle(document.documentElement).overflow};},axis);
  const before=await measure();assert.ok(['auto','scroll'].includes(before.overflow),'Observe the actual overflow owner.');assert.equal(before.scrollbarWidth,'thin','Canonical thin scrollbar must be computed on the owner.');assert.ok(before.visible&&before.client>0);
  if(containment==='overscroll-contain')assert.ok(['contain','none'].includes(before.overscroll));else if(containment==='default-chaining')assert.equal(before.overscroll,'auto','Only the existing browser-default owner policy may use this observation.');else assert.equal(before.bodyOverflow==='hidden'&&before.htmlOverflow==='hidden',true,'Modal background must actually be locked.');
  await container.evaluate((node,axis)=>axis==='x'?node.scrollTo(0,node.scrollTop):node.scrollTo(node.scrollLeft,0),axis);await frames(page);
  const start=await measure(),overflow=start.extent-start.client>2,parentBefore=containment==='default-chaining'?await container.evaluate(parentScrollState,axis):null;
  if(overflow){
   const box=await container.boundingBox();assert.ok(box);const pointer={x:Math.max(1,Math.min(viewport.width-2,box.x+box.width/2)),y:Math.max(1,Math.min(viewport.height-2,box.y+Math.min(box.height/2,100)))};await page.mouse.move(pointer.x,pointer.y);wheelDiagnostic={viewport:viewport.name,axis,start,pointer,hit:await container.evaluate((owner,{x,y,axis})=>{const hit=document.elementFromPoint(x,y),chain=[];for(let node=hit;node&&chain.length<12;node=node.parentElement){const style=getComputedStyle(node);chain.push({tag:node.tagName,role:node.getAttribute('role'),owner:node===owner,overflow:axis==='x'?style.overflowX:style.overflowY,extent:axis==='x'?node.scrollWidth:node.scrollHeight,client:axis==='x'?node.clientWidth:node.clientHeight});if(node===owner)break;}return{insideOwner:!!hit&&owner.contains(hit),chain};},{...pointer,axis})};
   const delta=axis==='x'&&start.direction==='rtl'?-Math.max(1200,start.extent*2):Math.max(1200,start.extent*2);
   await page.mouse.wheel(axis==='x'?delta:0,axis==='y'?delta:0);await expect.poll(async()=>Math.abs((await measure()).position-start.position),{timeout:3000}).toBeGreaterThan(2);
   await expect.poll(async()=>Math.abs((await measure()).position),{timeout:3000}).toBeGreaterThanOrEqual(start.extent-start.client-2);
   const end=await measure();if(containment==='default-chaining')assert.equal(await actuallyReachable(container,target),true,'Far content must be reachable before legitimate parent chaining.');await page.mouse.wheel(axis==='x'?delta:0,axis==='y'?delta:0);await frames(page);
   const contained=await measure(),defaultChaining=containment==='default-chaining';
   if(!defaultChaining){assert.equal(contained.documentX,start.documentX);assert.equal(contained.documentY,start.documentY);assert.equal(await actuallyReachable(container,target),true,'Actual far content must be visible and hit-test reachable inside its owner and viewport.');}
   const parentAfter=defaultChaining?await container.evaluate(parentScrollState,axis):null;
   const chaining=defaultChaining?{containmentNotClaimed:true,computedBrowserDefaultChaining:true,targetReachabilityPhase:'inner-boundary-before-parent-wheel',targetReachableAfterParentWheel:await actuallyReachable(container,target),parentChaining:{policy:'browser-default',wheelBoundaryExercised:true,before:parentBefore,after:parentAfter,positionChanged:JSON.stringify(parentBefore)!==JSON.stringify(parentAfter)}}:{backgroundPositionRetained:true};
   observations.push({viewport:viewport.name,width:viewport.width,height:viewport.height,state:'overflow-observed',axis,extent:start.extent,client:start.client,actualWheelMoved:true,farBoundaryReached:Math.abs(end.position)>=start.extent-start.client-2,targetReachable:true,targetHitTestPassed:true,...chaining,computedCanonicalThin:true});
  }else{
   assert.equal(await actuallyReachable(container,target),true,'Non-overflow cannot excuse hidden or occluded content.');
   const chaining=containment==='default-chaining'?{containmentNotClaimed:true,computedBrowserDefaultChaining:true,parentChaining:{policy:'browser-default',wheelBoundaryExercised:false,before:parentBefore,after:await container.evaluate(parentScrollState,axis),positionChanged:false}}:{};
   observations.push({...chaining,viewport:viewport.name,width:viewport.width,height:viewport.height,state:'non-overflow-observed',axis,extent:start.extent,client:start.client,targetReachable:true,targetHitTestPassed:true,computedCanonicalThin:true,limitation:'Real fixture content does not overflow here. Wheel/overflow behavior is not proved at this viewport.'});
  }
 }}catch(error){if(error instanceof Error){if(wheelDiagnostic)error.message+="\nPre-wheel diagnostic: "+JSON.stringify(wheelDiagnostic);try{error.message+="\nFailure-time geometry: "+JSON.stringify(await captureScrollbarFailureGeometry(container,target,axis));}catch{error.message+="\nFailure-time geometry unavailable.";}}throw error;}finally{try{await restoreParents();}finally{await restore();}}
 return{...receipt,status:'rendered-fragments-observed',observations,containment,proofBoundary:'Actual rendered surface and wheel interaction where real content overflows. No complete capability credit or invented non-applicability.'};
}

// This predicate is only a verification probe; the application retains its own modal owner.
function focusState(node,command){
 const controls=[...node.querySelectorAll('button,a[href],input,select,textarea,[contenteditable],[tabindex]')].filter(item=>item instanceof HTMLElement&&item.tabIndex>=0&&!item.matches(':disabled')&&item.getAttribute('aria-disabled')!=='true'&&!item.closest('[hidden],[aria-hidden="true"],[inert]')&&getComputedStyle(item).display!=='none'&&getComputedStyle(item).visibility!=='hidden'&&item.getClientRects().length);
 if(command==='first')controls[0]?.focus();if(command==='last')controls.at(-1)?.focus();
 return{count:controls.length,inside:node.contains(document.activeElement),first:document.activeElement===controls[0],last:document.activeElement===controls.at(-1)};
}
/** Actual keyboard traversal on the currently open consumer modal. */
export async function observeCoreModalFocusAdoption(input){
 const receipt=scope(input,'modal'),{page,dialog,state='editable',escape='retained'}=input;assert.ok(['editable','dirty-confirmation','pending'].includes(state));assert.ok(['retained','not-exercised'].includes(escape));
 await expect(dialog).toHaveCount(1);await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('role','dialog');await expect(dialog).toHaveAttribute('aria-modal','true');assert.equal(await dialog.evaluate(node=>node.matches('[data-venesia-modal],[data-admin-confirm-dialog]')),true);
 const restore=await remember(page),observations=[];
 try{for(const viewport of viewports){
  await page.setViewportSize({width:viewport.width,height:viewport.height});await frames(page);
  const start=await dialog.evaluate(focusState);assert.ok(start.count>0&&start.count<=100);assert.equal(start.inside,true,'The mounted modal must own current focus.');
  await dialog.evaluate(focusState,'last');await page.keyboard.press('Tab');assert.equal((await dialog.evaluate(focusState)).first,true,'Forward Tab must wrap inside this dialog.');
  await page.keyboard.press('Shift+Tab');assert.equal((await dialog.evaluate(focusState)).last,true,'Backward Tab must wrap inside this dialog.');
  for(let index=0;index<start.count+1;index++){await page.keyboard.press('Tab');assert.equal((await dialog.evaluate(focusState)).inside,true,'Focus escaped the active modal.');}
  if(escape==='retained'){await page.keyboard.press('Escape');await expect(dialog).toBeVisible();assert.equal((await dialog.evaluate(focusState)).inside,true);}
  observations.push({viewport:viewport.name,width:viewport.width,height:viewport.height,state,focusableCount:start.count,initialFocusContained:true,forwardWrap:true,backwardWrap:true,fullTraversalContained:true,escapeRetained:escape==='retained',escapeBoundary:escape});
 }}finally{await restore();}
 return{...receipt,status:'rendered-fragments-observed',observations,proofBoundary:'Real current modal keyboard containment at desktop/narrow. Trigger restoration, dirty cancellation and pending dismissal are separate observations; no axis promotion.'};
}

/** While the existing owned request gate is held, dismissal must not discard the pending Form. */
export async function observeCoreModalPendingDismissal(input){
 const receipt=scope(input,'modal'),{page,dialog,form}=input;await expect(dialog).toHaveCount(1);await expect(form).toHaveAttribute('aria-busy','true');await expect(form.locator('fieldset[data-admin-form-fields]')).toHaveJSProperty('disabled',true);
 const root=page.locator('[data-venesia-modal-root]').filter({has:dialog}),backdrop=root.locator(':scope > button[aria-label="إغلاق النافذة"]');await expect(backdrop).toHaveCount(1);
 const restore=await remember(page),observations=[];
 try{for(const viewport of viewports){
  await page.setViewportSize({width:viewport.width,height:viewport.height});await frames(page);
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(form).toHaveAttribute('aria-busy','true');
  await backdrop.click({position:{x:2,y:2}});await expect(dialog).toBeVisible();await expect(form).toHaveAttribute('aria-busy','true');await expect(form.locator('fieldset[data-admin-form-fields]')).toHaveJSProperty('disabled',true);
  observations.push({viewport:viewport.name,width:viewport.width,height:viewport.height,state:'pending',escapeRetained:true,backdropRetained:true,actualBusyAndDisabledRetained:true});
 }}finally{await restore();}
 return{...receipt,status:'rendered-fragments-observed',observations,proofBoundary:'Dismissal blocked while the existing actual request is held. Its enclosing restoration receipt independently proves exactly one unforwarded request and unchanged native state.'};
}

/** Actual clean Cancel closes and returns focus to the mounted trigger; reopen uses the same control. */
export async function observeCoreModalCleanReturn(input){
 const receipt=scope(input,'modal'),{page,dialog,form,trigger,cancel}=input;await expect(form).toHaveAttribute('data-admin-form-dirty','false');await expect(trigger).toHaveCount(1);await expect(cancel).toHaveCount(1);
 // Snapshot only the modal's genuine initial focus; an opener captured before its frame would be restored behind the reopened modal.
 await expect.poll(()=>dialog.evaluate(node=>node.contains(document.activeElement)),{message:'The clean modal must own initial focus before the observer snapshot.'}).toBe(true);
 const originalUrl=page.url(),restore=await remember(page),observations=[];
 try{for(const viewport of viewports){
  await page.setViewportSize({width:viewport.width,height:viewport.height});await frames(page);await expect(form).toHaveAttribute('data-admin-form-dirty','false');await cancel.click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(page.url(),originalUrl);
  await trigger.click();await expect(dialog).toBeVisible();await expect(form).toHaveAttribute('data-admin-form-dirty','false');await frames(page);assert.equal(await dialog.evaluate(node=>node.contains(document.activeElement)),true);
  observations.push({viewport:viewport.name,width:viewport.width,height:viewport.height,state:'clean',actualCancelClosed:true,exactTriggerFocusRestored:true,sameTriggerReopened:true,reopenedFocusContained:true,routeRetained:true});
 }}finally{await restore();}
 return{...receipt,status:'rendered-fragments-observed',observations,proofBoundary:'Actual clean cancellation and exact trigger focus restoration/reopen. No mutation or discarded dirty-draft claim.'};
}

/** Exact completed-journey join only; this never promotes an entire capability axis. */
export function assertCoreRenderedAdoptionJoin({browser,sourceSha256,expected,formManifest=undefined}){
 assert.match(sourceSha256,hash);assert.equal(browser.sourceSha256,sourceSha256);assert.equal(browser.inventoryOnly,false);assert.equal(browser.driverCompleted,true);assert.ok(Array.isArray(expected)&&expected.length>0&&expected.length<=1000);assert.ok(Array.isArray(browser.requiredCases)&&Array.isArray(browser.evidence)&&Array.isArray(browser.errors));
 const login=browser.evidence.filter(row=>row.id==='existing-auth-login');assert.equal(login.length,1);assert.equal(login[0].status,'pass');assert.equal(login[0].authenticated,true);assert.equal(browser.errors.some(row=>row.id==='existing-auth-login'),false);
 const identities=new Set(),receipts=new Set(),qualified=[];
 for(const plan of expected){
  assert.deepEqual(Object.keys(plan).sort(),['axis','bindings','journeyId','observationId','routePathname']);assert.match(plan.journeyId,identifier);assert.match(plan.observationId,identifier);assert.equal(identities.has(plan.observationId),false);identities.add(plan.observationId);
  const journey=browser.evidence.filter(row=>row.id===plan.journeyId);assert.equal(journey.length,1);assert.equal(journey[0].status,'pass');assert.equal(browser.errors.some(row=>row.id===plan.journeyId),false);
  const found=journey[0].renderedAdoption?.filter(row=>row.id===plan.observationId);assert.equal(found?.length,1);const value=found[0];assert.equal(value.status,'rendered-fragments-observed');assert.equal(value.sourceSha256,sourceSha256);assert.equal(value.axis,plan.axis);assert.equal(value.routePathname,plan.routePathname);assert.match(value.receiptId,/^[a-f0-9-]{36}$/u);assert.equal(receipts.has(value.receiptId),false);receipts.add(value.receiptId);assert.deepEqual(value.automaticCoverage,[]);assert.equal(value.globalClosed,false);
  assert.deepEqual(value.bindings,validateCoreRenderedAdoptionBindings({requiredCases:browser.requiredCases,bindings:plan.bindings,axis:plan.axis,pathname:plan.routePathname,formManifest}));assert.equal(value.observations.length,viewports.length);
  for(const [index,view]of viewports.entries()){
   const row=value.observations[index];for(const key of ['width','height'])assert.equal(row[key],view[key]);assert.equal(row.viewport,view.name);
   if(plan.axis==='scrollbar'){
    assert.ok(['overflow-observed','non-overflow-observed'].includes(row.state));assert.equal(row.targetReachable,true);assert.equal(row.targetHitTestPassed,true);assert.equal(row.computedCanonicalThin,true);assert.ok(Number.isFinite(row.extent)&&Number.isFinite(row.client)&&row.client>0);
    if(row.state==='overflow-observed'){assert.ok(row.extent-row.client>2);for(const key of ['actualWheelMoved','farBoundaryReached'])assert.equal(row[key],true);if(value.containment!=='default-chaining')assert.equal(row.backgroundPositionRetained,true);}
    else{assert.ok(row.extent-row.client<=2);assert.equal(row.actualWheelMoved,undefined);assert.ok(typeof row.limitation==='string'&&row.limitation.length>0);}
    assert.ok(['overscroll-contain','modal-lock','default-chaining'].includes(value.containment));if(value.containment==='default-chaining')validateParentChaining(row);else{assert.equal(row.containmentNotClaimed,undefined);assert.equal(row.parentChaining,undefined);}
   }else if(row.state==='clean'){for(const key of ['actualCancelClosed','exactTriggerFocusRestored','sameTriggerReopened','reopenedFocusContained','routeRetained'])assert.equal(row[key],true);}
   else if(row.state==='pending'&&row.actualBusyAndDisabledRetained){assert.equal(row.escapeRetained,true);assert.equal(row.backdropRetained,true);}
   else{assert.ok(['editable','dirty-confirmation','pending'].includes(row.state));assert.ok(Number.isSafeInteger(row.focusableCount)&&row.focusableCount>0);for(const key of ['initialFocusContained','forwardWrap','backwardWrap','fullTraversalContained'])assert.equal(row[key],true);assert.ok(['retained','not-exercised'].includes(row.escapeBoundary));assert.equal(row.escapeRetained,row.escapeBoundary==='retained');}
  }
  qualified.push({journeyId:plan.journeyId,observationId:plan.observationId,receiptId:value.receiptId,bindings:value.bindings,observations:value.observations});
 }
 return{status:'partial-not-global-pass',browserStatus:browser.status,sourceSha256,qualified,automaticCoverage:[],globalClosed:false,requiresNativeCohortQualification:true,scope:'Exact rendered fragments joined to successful authenticated same-source journeys. Final complete-axis qualification and any related native persistence joins remain separate.'};
}
