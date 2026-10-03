import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createJiti} from 'jiti';
import { classifyCorePermissionDenial } from './fixtures/admin-core-domain-permission-journeys.mjs';
const origin = 'http://127.0.0.1:3000';
const checks = [];
for (const status of [301,302,303,307,308]) {
  const proof = classifyCorePermissionDenial(status, { location: '/admin/login?next=%2Fadmin%2Fcontent%2Ftopics' }, origin);
  assert.equal(proof.destination, '/admin/login'); assert.equal(proof.contract, 'existing-proxy-revoked-session-rejection');
  checks.push('Known login redirect HTTP ' + status);
}
assert.equal(classifyCorePermissionDenial(200, { 'x-action-redirect': origin + '/admin/login;replace' }, origin).destination, '/admin/login');
checks.push('Actual Next action redirect header targets only owned login');
for (const [status, headers, name] of [
  [200, {}, 'An acknowledged command without Auth evidence'],
  [200, { location: '/admin/login' }, 'An ordinary Location header on a successful response'],
  [401, {}, 'A status code without the measured login contract'],
  [500, { 'x-action-redirect': '/admin/login' }, 'An unrelated server failure'],
  [307, { location: 'https://example.invalid/admin/login' }, 'An external origin'],
  [307, { location: 'http://127.0.0.1:3001/admin/login' }, 'A different local service'],
  [307, { location: '/admin/login-extra' }, 'A neighboring pathname'],
  [307, { location: '/admin' }, 'An ordinary Admin navigation'],
  [307, { location: '/topics' }, 'A public route'],
]) { assert.equal(classifyCorePermissionDenial(status, headers, origin), null, name); checks.push('Reject ' + name); }

// Execute the three actual current Tracking callback bodies. This isolates the
// consumer result bridge; real HTTP denial/native equality remains a Browser gate.
const trackingSource=readFileSync(new URL('../src/components/admin/projects/tracking/TrackingCollections.tsx',import.meta.url),'utf8');
const actionOwner=await createJiti(import.meta.url,{fsCache:false,moduleCache:false}).import('../src/lib/admin/admin-action-result.ts');
function trackingCallbacks(source) {
 const tree=ts.createSourceFile('TrackingCollections.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),callbacks=[];
 function visit(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&['toggleVisibility','togglePublicationVisibility'].includes(node.name.text)&&node.initializer&&ts.isCallExpression(node.initializer)){const fn=node.initializer.arguments[0];assert.ok(ts.isArrowFunction(fn));callbacks.push(fn.getText(tree));}ts.forEachChild(node,visit);}visit(tree);assert.equal(callbacks.length,3);
 const helpers=tree.statements.filter(node=>ts.isFunctionDeclaration(node)&&['toInstantMutationResult','publishTrackingVisibilityFailure'].includes(node.name?.text)).map(node=>node.getText(tree)).join('\n');
 return callbacks.map(body=>deps=>new Function('deps','const {instant,controller,projectId,stageId,itemId,setTrackingStageVisibilityAction,setTrackingItemVisibilityAction,setTrackingUpdatePublicationVisibilityAction,adminActionFailure,withAdminActionSettledResult}=deps;'+ts.transpileModule(helpers+'\nconst callback='+body+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+'return callback;')(deps));
}
async function exerciseTrackingCallbacks(source, expectMissingFeedback=false) {
 const results=[];
 for(const [index,create]of trackingCallbacks(source).entries()){
  async function invoke(mode,{sink=true,sinkThrows=false}={}){
   let executed=0,sinkAttempts=0;const emitted=[],transport=Object.assign(new Error('private transport detail'),{code:'E394'}),domain={ok:false,feedbackStatus:'error',title:'رفض',message:'current domain rejection',code:'resource_in_use'},accepted={ok:true,feedbackStatus:'success',title:'حفظ',message:'saved',code:'saved'},warning={ok:true,feedbackStatus:'warning',title:'تنبيه أصلي',message:'saved warning',code:'saved_with_media_sync_warning'};
   const selected=mode==='domain'?domain:mode==='warning'?warning:accepted;
   const execute=async()=>{executed++;if(mode==='transport')throw transport;if(mode==='non-error')throw 'private non-error';return selected;};
   const instant={mutateAsync:async request=>{const value=await request.execute();if(!value.ok)throw Object.assign(new Error(value.message),value);return{...value,message:mode==='settled-warning'?'confirmed save, read failed':value.message,feedbackStatus:mode==='settled-warning'?'warning':value.feedbackStatus};}};
   const callback=create({...actionOwner,instant,controller:{query:{filters:{visibility:'all',publication:'all'}}},projectId:4,stageId:5,itemId:6,setTrackingStageVisibilityAction:execute,setTrackingItemVisibilityAction:execute,setTrackingUpdatePublicationVisibilityAction:execute});
   let caught;try{await callback({id:7,is_visible:true,publication_status:'published',name:'fixed',title:'fixed'},sink?value=>{sinkAttempts++;if(sinkThrows&&(sinkThrows===true||sinkAttempts===1))throw new Error('sink failure');emitted.push(value);}:undefined);}catch(error){caught=error;}
   assert.equal(executed,1,'The result bridge must never replay a mutation.');return{emitted,caught,transport,domain,accepted,warning,sinkAttempts};
  }
  if(expectMissingFeedback){const value=await invoke('transport');assert.equal(value.caught,value.transport);assert.deepEqual(value.emitted,[]);results.push('original callback '+index+' reproduces silent rejected promise');continue;}
  for(const mode of ['transport','non-error']){const value=await invoke(mode);assert.equal(value.caught,undefined);assert.equal(value.emitted.length,1);const result=value.emitted[0];assert.equal(result.ok,false);assert.equal(result.feedbackStatus,'error');assert.equal(result.completion,undefined);assert.equal(result.code,undefined);assert.ok(result.message.includes('قبل إعادة المحاولة'));assert.ok(!JSON.stringify(result).includes('private'));results.push(index+': '+mode+' one canonical failure without leaked details or persistence claim');}
  {const value=await invoke('domain');assert.equal(value.caught,undefined);assert.deepEqual(value.emitted,[value.domain]);results.push(index+': domain rejection retained exactly once');}
  {const value=await invoke('success');assert.equal(value.caught,undefined);assert.deepEqual(value.emitted,[value.accepted]);results.push(index+': accepted result retained');}
  {const value=await invoke('warning');assert.equal(value.caught,undefined);assert.deepEqual(value.emitted,[value.warning]);results.push(index+': existing domain warning retained');}
  {const value=await invoke('settled-warning');assert.equal(value.caught,undefined);assert.equal(value.emitted.length,1);assert.equal(value.emitted[0].ok,true);assert.equal(value.emitted[0].feedbackStatus,'warning');assert.equal(value.emitted[0].code,'committed_reconciliation_pending');results.push(index+': confirmed save read warning retained');}
  {const value=await invoke('transport',{sink:false});assert.equal(value.caught,value.transport);assert.deepEqual(value.emitted,[]);results.push(index+': absent result sink does not silently consume the exception');}
  {const value=await invoke('transport',{sinkThrows:true});assert.equal(value.caught?.message,'sink failure');assert.deepEqual(value.emitted,[]);results.push(index+': publisher failure cannot claim delivered feedback');}
  for(const mode of ['success','warning','settled-warning']){const value=await invoke(mode,{sinkThrows:'once'});assert.equal(value.caught?.message,'sink failure');assert.equal(value.sinkAttempts,1);assert.deepEqual(value.emitted,[]);results.push(index+': '+mode+' publisher exception propagated once, never retried as mutation failure');}
 }
 return results;
}
checks.push(...await exerciseTrackingCallbacks(trackingSource));

console.log(JSON.stringify({ status: 'pass', cases: checks.length, checks, scope: 'HTTP denial classification and actual three Tracking visibility callback result bridging; authenticated Browser and native equality remain separate required gates.' }, null, 2));
