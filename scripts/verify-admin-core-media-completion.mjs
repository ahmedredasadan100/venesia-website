import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url);
const sourceDirectory=path.resolve("scripts"),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[];
const active=new WeakSet(),own=handle=>assert.ok(active.has(handle),'Unowned control handle');
// Preserve native ESM metadata when executing actual source through the controlled CommonJS ports.
function compileSource(source, filename, dependencies = {}, bridge = '') {
 const metadata = Object.freeze({ url: pathToFileURL(filename).href, dirname: path.dirname(filename), filename });
 const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  transformers: { before: [context => {
   const visit = node => ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword
    ? context.factory.createIdentifier('__controlledImportMeta')
    : ts.visitEachChild(node, visit, context);
   return node => ts.visitNode(node, visit);
  }] },
 }).outputText;
 const compiledModule = { exports: {} };
 new Function('require', 'module', 'exports', '__controlledImportMeta', js + '\n' + bridge)(
  id => dependencies[id] ?? (id.startsWith('node:') ? require(id) : {}),
  compiledModule, compiledModule.exports, metadata,
 );
 return compiledModule.exports;
}
function compile(file, dependencies = {}, bridge = '') {
 const filename = path.join(sourceDirectory, file);
 return compileSource(fs.readFileSync(filename, 'utf8'), filename, dependencies, bridge);
}
const metadataFixture = 'export const location = { url: import.meta.url, dirname: import.meta.dirname, filename: import.meta.filename }; export const literal = "import.meta.url";';
const metadataFilename = path.join(sourceDirectory, 'controlled-esm-metadata.mts');
assert.deepEqual(compileSource(metadataFixture, metadataFilename), {
 location: { url: pathToFileURL(metadataFilename).href, dirname: sourceDirectory, filename: metadataFilename }, literal: 'import.meta.url',
});
checks.push('controlled-ESM-metadata-resolves-to-the-actual-source-file-and-preserves-literals');
const legacyMetadata = ts.transpileModule(metadataFixture, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
assert.throws(() => new Function(legacyMetadata), SyntaxError);
checks.push('legacy-CommonJS-loader-rejects-the-same-valid-ESM-metadata');
const media=compile('verify-admin-core-media-isolated.mts',{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own}},'exports.__seed=(h,r)=>checkpointReceipts.set(h,new Map(r.map(x=>[String(x.id),hash(JSON.stringify(x))])));');
const recovery=compile('verify-admin-core-media-recovery-isolated.mts',{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own}},'exports.__seed=(h,r,c)=>completionReceipts.set(h,{records:new Map(r.map(x=>[String(x.id),receiptHash(x)])),cleanup:receiptHash(c)});');
const recoverySelection=compile('fixtures/admin-core-media-recovery-journeys.mjs');
const mediaSelection=compile('fixtures/admin-core-media-journeys.mjs');
const aggregate=compile('verify-admin-adoption-readback-isolated.mts',{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own},'./verify-admin-core-media-isolated.mts':media,'./verify-admin-core-media-recovery-isolated.mts':recovery,'./fixtures/admin-core-media-recovery-journeys.mjs':recoverySelection,'./fixtures/admin-core-media-journeys.mjs':mediaSelection});
const mediaGroups=['readiness','folders','upload-validation-retry','catalog-query','metadata-failure-retry','preview','picker-use','in-use-delete','physical-move','replace-references','detach-delete','permission'];
const recoveryGroups=['prepare','queue-fetch-retry','committed-lease-warning','resolve-lease','produce-existing-object-reservation','produce-finalize','repair-finalize','produce-missing','repair-missing','repair-existing-object-reservation','permission'];
function sourceGroups(file) {const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),groups=[];
function value(n,env){if(ts.isStringLiteral(n))return n.text;if(ts.isIdentifier(n))return env[n.text];if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken)return value(n.left,env)+value(n.right,env);throw Error('Unclassified group expression');}
function visit(node,env={}){if(ts.isForOfStatement(node)&&ts.isArrayLiteralExpression(node.expression)&&ts.isVariableDeclarationList(node.initializer)){const name=node.initializer.declarations[0].name.getText(ast);for(const element of node.expression.elements){if(!ts.isStringLiteral(element)){ts.forEachChild(node,n=>visit(n,env));return;}visit(node.statement,{...env,[name]:element.text});}return;}if(ts.isCallExpression(node)&&node.expression.getText(ast)==='group'){groups.push(value(node.arguments[0],env));return;}ts.forEachChild(node,n=>visit(n,env));}visit(ast);return groups;}
assert.deepEqual(sourceGroups('scripts/fixtures/admin-core-media-journeys.mjs'),mediaGroups);assert.deepEqual(sourceGroups('scripts/fixtures/admin-core-media-recovery-journeys.mjs'),recoveryGroups);checks.push('expected-group-sets-derived-from-actual-helper-call-sites');

// Execute the actual producer push expressions instead of inventing receipt shapes.
function checkpointProducer(file){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),calls=[];function visit(node,inSnapshot=false){const nested=inSnapshot||(ts.isFunctionDeclaration(node)&&node.name?.text==='snapshot');if(nested&&ts.isCallExpression(node)&&node.expression.getText(ast)==='checkpoints.push')calls.push(node.getText(ast));ts.forEachChild(node,child=>visit(child,nested));}visit(ast);assert.equal(calls.length,1);const run=new Function('checkpoints','label','value',calls[0]+';return checkpoints;');return(label,value)=>{const records=run([],label,value);assert.equal(records.length,1);return records[0];};}
const actualCheckpointProducers=[checkpointProducer('scripts/fixtures/admin-core-media-journeys.mjs'),checkpointProducer('scripts/fixtures/admin-core-media-recovery-journeys.mjs')];
function checkpointShape(isRecovery,row,label){return actualCheckpointProducers[Number(isRecovery)](label,row);}
for(const isRecovery of [false,true]){const id=crypto.randomUUID(),row=checkpointShape(isRecovery,{id},'controlled');assert.deepEqual(row,isRecovery?{label:'controlled',id}:{label:'controlled',receiptId:id});checks.push((isRecovery?'recovery':'media')+'-receipt-shape-executed-from-actual-snapshot-producer');}

function fixture(isRecovery=false,followup=false){assert.ok(!followup||isRecovery);const handle={identity:{runId:'owned-control-run'}};active.add(handle);const groups=isRecovery?(followup?recoverySelection.coreSelectedMediaRecoveryGroups(recoverySelection.CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION):recoveryGroups):mediaGroups,kind=isRecovery?'media-recovery-state':'media-library-state',consumer=isRecovery?'media-recovery-queue':'media-library',field=isRecovery?'name':'group',prefix=isRecovery?'core-media-recovery-':'core-media-';
const completed=groups.map(name=>({[field]:name,consumer,automaticCoverage:[],asserted:true}));
const states=[0,1].map(()=>({id:crypto.randomUUID(),kind,status:'pass',ownedRunId:handle.identity.runId,namespace:'qa-core-media-0123456789abcdef',qaActorId:7,articleId:91,automaticCoverage:[]}));
const faults=[];if(isRecovery)for(const scenario of (followup?['cancel','finalize','missing']:['lease','cancel','finalize','missing'])){const token=crypto.randomUUID();for(const step of scenario==='lease'?['arm','cancel','release']:['arm','switch','cancel','release'])faults.push({id:crypto.randomUUID(),kind:'media-recovery-fault-'+step,status:'pass',scenario,token,...(step==='release'?{activeLocks:0,ownedTransactionsRolledBack:true,cancellationAcknowledged:true}:{})});}
const prerequisite=followup?{id:crypto.randomUUID(),kind:'media-recovery-followup-prepare',status:'pass',ownedRunId:handle.identity.runId,namespace:states[0].namespace,qaActorId:states[0].qaActorId,articleId:states[0].articleId,selection:recoverySelection.CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION,purpose:'uncredited-owned-fixture-prerequisite',uiCredit:false,automaticCoverage:[],globalClosed:false}:undefined;
const native={status:'pass',records:[...(prerequisite?[prerequisite]:[]),...states,...faults]},cleanup=isRecovery?{status:'closed',activeLocks:0,records:faults,automaticCoverage:[]}:undefined;
const result={...(prerequisite?{prerequisite}:{}),completed,checkpoints:states.map((r,i)=>checkpointShape(isRecovery,r,'checkpoint-'+i)),automaticCoverage:[],globalClosed:false};
const browser={...(followup?{journeySelection:recoverySelection.CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION}:{}),status:'pass',driverCompleted:true,errors:[],scope:'core-closure',cohort:isRecovery?'media-recovery':'media-library',evidence:completed.map(r=>({id:prefix+r[field],status:'pass',coverage:[],...r})),[isRecovery?'mediaRecovery':'media']:result};
if(isRecovery)recovery.__seed(handle,native.records,cleanup);else media.__seed(handle,native.records);
return {handle,browser,native,cleanup,result,check:()=>aggregate.assertCoreMediaCompletionReceipts(handle,browser,native,cleanup)};}
for(const isRecovery of [false,true]){const label=isRecovery?'recovery':'media';let f=fixture(isRecovery),r=f.check();assert.deepEqual(r.automaticCoverage,[]);assert.equal(r.globalClosed,false);assert.deepEqual(r.binding.automaticCoverage,[]);checks.push(label+'-positive-exact-controlled-join');
const negatives={
'missing-group-and-matching-evidence':f=>{f.result.completed.splice(2,1);f.browser.evidence.splice(2,1)},
'duplicate-group':f=>{f.result.completed[2]=f.result.completed[1];f.browser.evidence[2]=f.browser.evidence[1]},
'foreign-group':f=>{f.result.completed[2][isRecovery?'name':'group']='foreign'},
'failed-group-evidence':f=>{f.browser.evidence[2].status='fail'},
'foreign-consumer':f=>{f.result.completed[2].consumer='foreign';f.browser.evidence[2].consumer='foreign'},
'blanket-coverage':f=>{f.browser.evidence[2].coverage=['unexecuted-axis']},
'missing-checkpoint':f=>{f.result.checkpoints.pop()},
'missing-identity':f=>{delete f.result.checkpoints[0][isRecovery?'id':'receiptId']},
'wrong-cohort-identity-field':f=>{const r=f.result.checkpoints[0],field=isRecovery?'id':'receiptId',wrong=isRecovery?'receiptId':'id';r[wrong]=r[field];delete r[field]},
'dual-identity-fields':f=>{const r=f.result.checkpoints[0];r[isRecovery?'receiptId':'id']=r[isRecovery?'id':'receiptId']},
'malformed-identity':f=>{f.result.checkpoints[0][isRecovery?'id':'receiptId']='not-a-uuid'},
'reordered-checkpoints':f=>{f.result.checkpoints.reverse()},

'duplicate-checkpoint':f=>{f.result.checkpoints.push({...f.result.checkpoints[0]})},
'foreign-checkpoint':f=>{const id=crypto.randomUUID();f.result.checkpoints[0][isRecovery?'id':'receiptId']=id;f.native.records[0].id=id},
'native-value-tampering':f=>{f.native.records[0].qaActorId=9},
'native-record-omitted-with-browser':f=>{f.result.checkpoints.pop();f.native.records.splice(1,1)},
'native-record-added-with-browser':f=>{const row={...f.native.records[0],id:crypto.randomUUID()};f.result.checkpoints.push(checkpointShape(isRecovery,row,'extra'));f.native.records.splice(2,0,row)},
'incomplete-driver':f=>{f.browser.driverCompleted=false},
'collector-error':f=>{f.browser.errors.push({id:'failed'})},
'native-failure':f=>{f.native.status='fail'},
'foreign-live-handle':f=>{const original=f.handle;f.handle={identity:original.identity};active.add(f.handle);f.check=()=>aggregate.assertCoreMediaCompletionReceipts(f.handle,f.browser,f.native,f.cleanup)},
'unowned-handle':f=>{active.delete(f.handle)},
};
if(isRecovery)Object.assign(negatives,{
'missing-cancel-schedule':f=>{f.native.records=f.native.records.filter(r=>r.scenario!=='cancel');f.cleanup.records=f.cleanup.records.filter(r=>r.scenario!=='cancel')},
'duplicate-fault-step':f=>{f.cleanup.records.push({...f.cleanup.records[0]});f.native.records.push({...f.cleanup.records[0]})},
'fault-token-mismatch':f=>{f.native.records.find(r=>r.kind==='media-recovery-fault-cancel').token=crypto.randomUUID()},
'cleanup-tampering':f=>{f.cleanup.activeLocks=1},
'cleanup-native-mismatch':f=>{f.cleanup.records=structuredClone(f.cleanup.records);f.cleanup.records[0].token=crypto.randomUUID()},
'cancel-release-unacknowledged':f=>{f.native.records.find(r=>r.scenario==='cancel'&&r.kind.endsWith('-release')).cancellationAcknowledged=false}
});
for(const [name,mutate]of Object.entries(negatives)){f=fixture(isRecovery);mutate(f);assert.throws(f.check,name);checks.push(label+'-'+name);}}


// The actual new selector skips the three retained UI groups; setup is private prerequisite only.
{const f=fixture(true,true),r=f.check();assert.deepEqual(r.groups,recoveryGroups.slice(3));assert.equal(r.binding.checkpoints,15);assert.equal(r.nativeCheckpoints,2);assert.deepEqual(r.automaticCoverage,[]);assert.equal(r.globalClosed,false);checks.push('followup-eight-actual-private-join-keeps-setup-uncredited');}
for(const[name,mutate]of Object.entries({
 'missing-setup':f=>f.native.records.shift(),
 'duplicate-setup':f=>f.native.records.unshift({...f.native.records[0]}),
 'late-setup':f=>{const x=f.native.records.shift();f.native.records.splice(1,0,x);},
 'missing-browser-prerequisite':f=>{delete f.result.prerequisite;},
 'forged-prerequisite':f=>{f.result.prerequisite={...f.result.prerequisite,qaActorId:99};},
 'foreign-actor':f=>{f.native.records[1].qaActorId=99;},
 'foreign-article':f=>{f.native.records[1].articleId=99;},
 'foreign-namespace':f=>{f.native.records[1].namespace='foreign';},
 'setup-ui-credit':f=>{f.result.prerequisite.uiCredit=true;},
 'setup-coverage-credit':f=>{f.result.prerequisite.automaticCoverage.push('forbidden');},
 'setup-global-closed':f=>{f.result.prerequisite.globalClosed=true;},
 'retained-group-replay':f=>{f.result.completed.unshift({name:'prepare'});},
 'retained-lease-fault-replay':f=>{const row={...f.cleanup.records[0],id:crypto.randomUUID(),scenario:'lease'};f.native.records.push(row);f.cleanup.records.push(row);},
 'missing-fault':f=>{f.native.records.pop();f.cleanup.records.pop();},
 'unknown-native-record':f=>{const row={id:crypto.randomUUID(),kind:'foreign'};f.native.records.push(row);f.cleanup.records.push(row);},
 'unknown-selector':f=>{f.browser.journeySelection='invented';},
 'selector-missing-after-setup':f=>{delete f.browser.journeySelection;},
 'copied-unregistered-handle':f=>{f.handle={identity:f.handle.identity};active.add(f.handle);f.check=()=>aggregate.assertCoreMediaCompletionReceipts(f.handle,f.browser,f.native,f.cleanup);}
})){const f=fixture(true,true);mutate(f);assert.throws(f.check,name);checks.push('followup-eight-'+name);}

function heldMediaFixture() {
 const f=fixture(false),selection=mediaSelection.CORE_MEDIA_HELD_SELECTION;
 f.browser.journeySelection=selection;f.browser.inventoryOnly=false;f.browser.wholeCohortExecuted=false;f.browser.globalClosed=false;
 const ids=mediaSelection.coreSelectedMediaIds(selection);f.browser.selectedJourneyIds=ids;f.browser.executedJourneyIds=[...ids];
 f.requiredCases=[{key:'controlled-media-required',consumer:'media-library'}];f.browser.requiredCases=f.requiredCases.map(row=>({...row,status:'open',evidence:null}));
 f.result.completed=f.result.completed.slice(2);
 f.browser.evidence=[{id:'existing-auth-login',status:'pass',authenticated:true},...f.result.completed.map(row=>({id:'core-media-'+row.group,status:'pass',coverage:[],...row}))];
 const base={...f.native.records[0],article:{id:91},assets:[],objects:[],folders:[],references:[],leases:[],reservations:[],audits:[],binaries:[],
  storageSha256:'a'.repeat(64),publicDataSha256:'b'.repeat(64),publicTableInventorySha256:'c'.repeat(64),runtime:{state:'synced'}};
 const roots=['images/'+base.namespace,'files/'+base.namespace],states=Array.from({length:6},()=>({...structuredClone(base),id:crypto.randomUUID()}));
 const folder=(root)=>({id:root,normalized_path:root,parent_path:root.split('/')[0],display_name:base.namespace,created_by:base.qaActorId});
 const audit=(root,index)=>({id:index,action:'media_folder.create',actor_admin_user_id:base.qaActorId,metadata:{folder:root}});
 states[3].folders=[folder(roots[0])];states[3].audits=[audit(roots[0],1)];
 states[4].folders=structuredClone(states[3].folders);states[4].audits=structuredClone(states[3].audits);
 states[5].folders=roots.map(folder);states[5].audits=roots.map((root,index)=>audit(root,index+1));
 const labels=['prerequisite-reconcile-before','prerequisite-reconciled','prerequisite-folder-before-images','prerequisite-folder-after-images','prerequisite-folder-before-files','prerequisite-folder-after-files'];
 const points=states.map((row,index)=>checkpointShape(false,row,labels[index]));
 const requests=[{operation:'reconcile',dryRun:false},...roots.map(folder=>({operation:'create_folder',folder,displayName:base.namespace}))].map((body,index)=>{
  const text=JSON.stringify(body);return{url:'http://127.0.0.1:65431/api/admin/media-library',method:'POST',status:index?201:200,body:text,bodySha256:hash(text),acknowledged:true,provenance:'captured-current-request'};});
 f.result.prerequisite={selection,purpose:'uncredited-owned-fixture-prerequisite',uiCredit:false,globalClosed:false,automaticCoverage:[],
  ownedRunId:base.ownedRunId,namespace:base.namespace,articleId:base.articleId,qaActorId:base.qaActorId,
  operations:['reconcile','create_folder'],checkpoints:structuredClone(points),requests};
 f.native.records=[...states,...f.native.records];f.result.checkpoints=[...points,...f.result.checkpoints];media.__seed(f.handle,f.native.records);
 f.select=()=>mediaSelection.assertCoreMediaSelectionReceipt(f.browser,f.requiredCases);
 return f;
}
{
 const f=heldMediaFixture(),r=f.check(),selection=f.select();
 assert.deepEqual(r.groups,mediaGroups.slice(2));assert.equal(r.prerequisite.nativeCheckpointIds.length,6);assert.equal(r.prerequisite.uiCredit,false);
 assert.equal(r.binding.checkpoints,8);assert.equal(selection.selectedJourneyIds.length,10);assert.equal(selection.retainedTwoReplayed,false);
 assert.deepEqual(mediaSelection.coreSelectedMediaGroups(),mediaGroups);
 checks.push('held-media-ten-exact-native-prefix-and-selected-case-join-preserves-default-twelve');
}

for (const [name, mutate] of Object.entries({
 'missing-prerequisite':f=>{delete f.result.prerequisite;},
 'wrong-prerequisite-selection':f=>{f.result.prerequisite.selection='invented';},
 'retained-ui-credit':f=>{f.result.prerequisite.uiCredit=true;},
 'prerequisite-capability-credit':f=>{f.result.prerequisite.automaticCoverage=['unexecuted'];},
 'prerequisite-global-closure':f=>{f.result.prerequisite.globalClosed=true;},
 'foreign-prerequisite-run':f=>{f.result.prerequisite.ownedRunId='other';},
 'foreign-prerequisite-actor':f=>{f.result.prerequisite.qaActorId=9;},
 'foreign-prerequisite-namespace':f=>{f.result.prerequisite.namespace='qa-core-media-fedcba9876543210';},
 'wrong-prefix-order':f=>{f.result.prerequisite.checkpoints.reverse();},
 'missing-prerequisite-checkpoint':f=>{f.result.prerequisite.checkpoints.pop();},
 'borrowed-prerequisite-checkpoint':f=>{f.result.prerequisite.checkpoints[0].receiptId=f.native.records.at(-1).id;},
 'missing-acknowledged-request':f=>{f.result.prerequisite.requests.pop();},
 'replayed-request-provenance':f=>{f.result.prerequisite.requests[0].provenance='historical';},
 'unacknowledged-request':f=>{f.result.prerequisite.requests[0].acknowledged=false;},
 'non-successful-request':f=>{f.result.prerequisite.requests[1].status=500;},
 'body-digest-drift':f=>{f.result.prerequisite.requests[0].bodySha256='0'.repeat(64);},
 'wrong-canonical-body':f=>{const r=f.result.prerequisite.requests[0];r.body=JSON.stringify({operation:'reconcile',dryRun:true});r.bodySha256=hash(r.body);},
 'foreign-endpoint':f=>{f.result.prerequisite.requests[2].url='http://localhost:65431/api/admin/media-library';},
 'missing-operation-proof':f=>{f.result.prerequisite.operations.pop();},
 'drop-group-and-evidence':f=>{f.result.completed.pop();f.browser.evidence.pop();},
 'extra-retained-group':f=>{const row={group:'folders',consumer:'media-library',automaticCoverage:[]};f.result.completed.unshift(row);f.browser.evidence.splice(1,0,{...row,id:'core-media-folders',status:'pass',coverage:[]});},
 'selector-removed':f=>{delete f.browser.journeySelection;},
 'unknown-selector':f=>{f.browser.journeySelection='invented';},
})) { const f=heldMediaFixture();mutate(f);assert.throws(f.check,name);checks.push('held-media-'+name); }
for (const [name,mutate] of Object.entries({
 'dropped-selected-id':f=>{f.browser.selectedJourneyIds.pop();},
 'extra-executed-id':f=>{f.browser.executedJourneyIds.push('core-media-readiness');},
 'extra-retained-evidence':f=>{f.browser.evidence.push({id:'core-media-folders',status:'pass',coverage:[]});},
 'missing-login':f=>{f.browser.evidence.shift();},
 'unauthenticated-login':f=>{f.browser.evidence[0].authenticated=false;},
 'promoted-required-case':f=>{f.browser.requiredCases[0].status='behavior_verified';},
 'whole-cohort-claim':f=>{f.browser.wholeCohortExecuted=true;},
 'unknown-selection':f=>{f.browser.journeySelection='invented';},
 'blanket-coverage':f=>{f.browser.evidence[1].coverage.push('unexecuted');},
})) { const f=heldMediaFixture();mutate(f);assert.throws(f.select,name);checks.push('held-media-selection-'+name); }

{
 const file='scripts/fixtures/admin-core-media-journeys.mjs',source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),matches=[];
 const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='remember')matches.push(node);ts.forEachChild(node,visit);};visit(ast);assert.equal(matches.length,1);
 const origin='http://127.0.0.1:65431',specimens=[];
 const remember=new Function('origin','specimens','hash','validateCoreMediaReplaySpecimen',matches[0].getText(ast)+';return remember;')(origin,specimens,hash,mediaSelection.validateCoreMediaReplaySpecimen);
 const response=dryRun=>{const body=JSON.stringify({operation:'reconcile',dryRun});return{status:()=>200,request:()=>({url:()=>origin+'/api/admin/media-library',method:()=>'POST',postDataBuffer:()=>Buffer.from(body),headers:()=>({'content-type':'application/json',origin})})};};
 remember(response(true));remember(response(false));remember(response(false));
 assert.deepEqual(specimens.map(row=>row.operation),['reconcile_preview','reconcile']);
 const write=specimens.find(row=>row.operation==='reconcile'),confirmed=JSON.stringify({operation:'reconcile',dryRun:false});
 assert.equal(write.body.toString('utf8'),confirmed);assert.equal(write.bodySha256,hash(confirmed));
 assert.equal(JSON.parse(specimens[0].body.toString('utf8')).dryRun,true);
 mediaSelection.validateCoreMediaReplaySpecimen(origin,write);
 checks.push('actual-remember-preview-then-confirm-retains-distinct-acknowledged-write-body-without-dedup-drift');
}
{
 const admission=compile('fixtures/admin-core-domain-form-journeys.mjs').validateCoreJourneySelection;
 assert.equal(admission({scope:'core-closure',cohort:'media-library',selection:mediaSelection.CORE_MEDIA_HELD_SELECTION}),mediaSelection.CORE_MEDIA_HELD_SELECTION);
 assert.equal(admission({scope:'core-closure',cohort:'media-library'}),null);
 for(const value of [{scope:'audit2-selected',cohort:'media-library',selection:mediaSelection.CORE_MEDIA_HELD_SELECTION},{scope:'core-closure',cohort:'media-recovery',selection:mediaSelection.CORE_MEDIA_HELD_SELECTION},{scope:'core-closure',cohort:'media-library',selection:'invented'}])assert.throws(()=>admission(value));
 checks.push('actual-fixed-selector-admission-rejects-wrong-scope-cohort-and-invented-selection');
}

function finalThreeFixture() {
 const f=heldMediaFixture(),seed=f.result.prerequisite,states=f.native.records.slice(0,6),namespace=seed.namespace,origin='http://127.0.0.1:65431';
 const ids={primary:crypto.randomUUID(),document:crypto.randomUUID(),replacement:crypto.randomUUID()};
 const png=mediaSelection.coreMediaSyntheticPng(),pdf=mediaSelection.coreMediaSyntheticPdf();
 const asset=(id,name,kind,bytes)=>({id,provider:'supabase',uploaded_by:seed.qaActorId,bucket:kind==='document'?'cms-documents':'cms-images',object_key:(kind==='document'?'files/':'images/')+namespace+'/'+name,public_url:origin+'/storage/v1/object/public/'+(kind==='document'?'cms-documents/':'cms-images/')+(kind==='document'?'files/':'images/')+namespace+'/'+name,status:'active',byte_size:bytes.length,checksum:hash(bytes),media_kind:kind,display_name:name});
 let state=structuredClone(states[5]);
 const push=(label)=>{state={...structuredClone(state),id:crypto.randomUUID()};states.push(structuredClone(state));points.push(checkpointShape(false,state,label));};
 const points=structuredClone(seed.checkpoints);
 const addAudit=(action,metadata,entityId)=>state.audits.push({id:state.audits.length+1,actor_admin_user_id:seed.qaActorId,action,metadata,...(entityId?{entity_id:entityId}:{})});
 const refresh=()=>{state.objects=state.assets.filter(a=>a.status==='active').map(a=>({bucket_id:a.bucket,name:a.object_key}));state.binaries=state.assets.map(a=>({publicUrl:a.public_url,...(a.status==='deleted'?{missing:true}:{status:200,missing:false,bytes:a.byte_size,sha256:a.checksum})}));};
 state.assets=[asset(ids.primary,namespace+'.png','image',png),asset(ids.document,namespace+'.pdf','document',pdf)];
 for(const a of state.assets)addAudit('media_asset.create',{objectKey:a.object_key,bucket:a.bucket});refresh();push('prerequisite-uploaded');
 const named=()=>state.assets.find(a=>a.id===ids.primary);
 Object.assign(named(),{display_name:namespace+'-authored',default_alt_text:'QA synthetic pixel',default_title:'QA media title',default_caption:'QA media caption'});addAudit('media_asset.update',{assetId:ids.primary,operation:'metadata'});push('prerequisite-metadata');
 const oldUrl=named().public_url;
 state.article.image=oldUrl;state.references=[{asset_id:ids.primary,domain_key:'topic',entity_type:'article',entity_identity:String(seed.articleId),field_key:'image',reference_state:'active'}];addAudit('topic.update',{},seed.articleId);push('prerequisite-picker');push('prerequisite-usage');
 named().object_key='images/'+namespace+'/moved/'+namespace+'-renamed.png';named().public_url=origin+'/storage/v1/object/public/cms-images/'+named().object_key;state.article.image=named().public_url;refresh();state.binaries.push({publicUrl:oldUrl,missing:true});addAudit('media_asset.update',{assetId:ids.primary,operation:'move_physical_object'});push('prerequisite-moved');
 const replacement=asset(ids.replacement,namespace+'-replacement.png','image',png);state.assets.push(replacement);refresh();addAudit('media_asset.create',{objectKey:replacement.object_key,bucket:replacement.bucket});push('prerequisite-replacement-staged');
 state.article.image=replacement.public_url;state.references[0].asset_id=ids.replacement;addAudit('media_asset.update',{previousAssetId:ids.primary,nextAssetId:ids.replacement,operation:'replace_all_supported_references'});push('prerequisite-replaced');
 const request=(operation,method,body,url=origin+'/api/admin/media-library',contentType='application/json')=>{const bytes=Buffer.isBuffer(body)?body:Buffer.from(body===null?'':JSON.stringify(body));return{operation,method,url,headers:method==='GET'?{}:{'content-type':contentType,origin},body:bytes.toString('base64'),bodyEncoding:'base64',bodySha256:hash(bytes),acknowledged:true,status:['upload','create_folder'].includes(operation)?201:200,provenance:'captured-current-request'};};
 const specimens=[request('upload','POST',Buffer.concat([Buffer.from(namespace),png]),undefined,'multipart/form-data; boundary=controlled'),...seed.requests.slice(0,2).map(row=>request(JSON.parse(row.body).operation,'POST',JSON.parse(row.body))),request('update_metadata','PATCH',{operation:'update_metadata',assetId:ids.primary,displayName:namespace+'-authored',defaultAltText:'QA synthetic pixel',defaultTitle:'QA media title',defaultCaption:'QA media caption'}),request('move_asset','PATCH',{operation:'move_asset',assetId:ids.primary,targetFolder:'images/'+namespace+'/moved',targetFilename:namespace+'-renamed.png'}),request('replace_all','PATCH',{operation:'replace_all',previousAssetId:ids.primary,nextAssetId:ids.replacement}),request('/api/admin/media-library','GET',null,origin+'/api/admin/media-library?q='+namespace),request('/api/admin/media-usage','GET',null,origin+'/api/admin/media-usage?asset='+encodeURIComponent(oldUrl))];
 const selection=mediaSelection.CORE_MEDIA_FINAL_THREE_SELECTION,operations=['upload','create_folder','reconcile','update_metadata','move_asset','replace_all','/api/admin/media-library','/api/admin/media-usage'];
 f.result.prerequisite={selection,purpose:'uncredited-owned-fixture-prerequisite',uiCredit:false,automaticCoverage:[],globalClosed:false,seed,ownedRunId:seed.ownedRunId,namespace,articleId:seed.articleId,qaActorId:seed.qaActorId,origin,primaryId:ids.primary,documentId:ids.document,replacementId:ids.replacement,operations,checkpoints:structuredClone(points),specimens};
 push('preview');state.article.image='';state.references=[];addAudit('topic.update',{},seed.articleId);push('detached');
 const deletedUrl=state.assets[0].public_url;
 for(const [index,id]of state.assets.map(a=>a.id).entries()) {push('delete-cancel');state.assets.find(a=>a.id===id).status='deleted';refresh();state.reservations.push({asset_id:id,status:'completed'});addAudit('media_asset.delete',{assetId:id});push('delete-complete');if(index<2)push('delete-next-ready');}
 push('permission-before');push('permission-after');
 const allSpecimens=[...structuredClone(specimens),request('DELETE','DELETE',{asset:deletedUrl})];
 const completed=mediaSelection.coreSelectedMediaGroups(selection).map(group=>({group,consumer:'media-library',automaticCoverage:[],...(group==='permission'?{requestProof:{origin,specimens:allSpecimens,verifiedOperations:[...operations,'DELETE'],denials:allSpecimens.map(row=>({operation:row.operation,bodySha256:row.bodySha256,status:401,value:{error:'Unauthorized'}}))}}:{})}));
 f.result.completed=completed;f.result.checkpoints=points;f.native.records=states;f.browser.journeySelection=selection;
 f.browser.selectedJourneyIds=mediaSelection.coreSelectedMediaIds(selection);f.browser.executedJourneyIds=[...f.browser.selectedJourneyIds];
 f.browser.evidence=[{id:'existing-auth-login',status:'pass',authenticated:true},...completed.map(row=>({id:'core-media-'+row.group,status:'pass',coverage:[],...row}))];
 media.__seed(f.handle,states);f.guard=()=>mediaSelection.assertCoreMediaFinalThreePermission(f.result,f.native.records);f.select=()=>mediaSelection.assertCoreMediaSelectionReceipt(f.browser,f.requiredCases);
 return f;
}
{
 const f=finalThreeFixture(),r=f.check(),selected=f.select();assert.equal(r.nativeCheckpoints,25);assert.equal(r.prerequisite.nativeCheckpointIds.length,13);assert.equal(r.prerequisite.assets,3);assert.equal(r.prerequisite.uiCredit,false);assert.equal(f.guard().operations.length,9);
 assert.deepEqual(selected.selectedJourneyIds,['core-media-preview','core-media-detach-delete','core-media-permission']);assert.equal(selected.retainedSevenReplayed,false);assert.deepEqual(f.result.completed.map(row=>row.group),['preview','detach-delete','permission']);checks.push('final-three-exact-3-assets-13-uncredited-native-prefix-25-native-join-9-actual-permission-operations');
}
const rebody=(row,change)=>{const value=JSON.parse(Buffer.from(row.body,'base64').toString('utf8'));change(value);const bytes=Buffer.from(JSON.stringify(value));row.body=bytes.toString('base64');row.bodySha256=hash(bytes);};
for(const[name,mutate]of Object.entries({
 'missing-prerequisite':f=>{delete f.result.prerequisite;},
 'setup-ui-credit':f=>{f.result.prerequisite.uiCredit=true;},
 'setup-capability-credit':f=>{f.result.prerequisite.automaticCoverage.push('unexecuted');},
 'setup-global-closure':f=>{f.result.prerequisite.globalClosed=true;},
 'foreign-run':f=>{f.result.prerequisite.ownedRunId='foreign';},
 'foreign-actor':f=>{f.result.prerequisite.qaActorId=999;},
 'missing-setup-state':f=>{f.result.prerequisite.checkpoints.pop();},
 'missing-setup-request':f=>{f.result.prerequisite.specimens.pop();},
 'duplicate-setup-request':f=>{f.result.prerequisite.specimens.push(f.result.prerequisite.specimens[0]);},
 'uncaptured-request':f=>{f.result.prerequisite.specimens[0].provenance='constructed';},
 'unacknowledged-request':f=>{f.result.prerequisite.specimens[0].acknowledged=false;},
 'body-digest-drift':f=>{f.result.prerequisite.specimens[0].bodySha256='f'.repeat(64);},
 'wrong-metadata-values-rehashed':f=>{rebody(f.result.prerequisite.specimens.find(row=>row.operation==='update_metadata'),v=>{v.defaultTitle='foreign';});},
 'wrong-move-target-rehashed':f=>{rebody(f.result.prerequisite.specimens.find(row=>row.operation==='move_asset'),v=>{v.targetFolder='foreign';});},
 'wrong-replacement-rehashed':f=>{rebody(f.result.prerequisite.specimens.find(row=>row.operation==='replace_all'),v=>{v.nextAssetId=crypto.randomUUID();});},
 'wrong-catalog-query':f=>{f.result.prerequisite.specimens.find(row=>row.operation==='/api/admin/media-library').url='http://127.0.0.1:65431/api/admin/media-library?q=foreign';},
 'wrong-usage-asset':f=>{f.result.prerequisite.specimens.find(row=>row.operation==='/api/admin/media-usage').url='http://127.0.0.1:65431/api/admin/media-usage?asset=foreign';},
 'fourth-setup-asset':f=>{f.native.records[6].assets.push({...f.native.records[6].assets[0],id:crypto.randomUUID()});},
 'wrong-upload-bytes':f=>{f.native.records[6].assets[0].checksum='f'.repeat(64);},
 'missing-metadata-audit':f=>{f.native.records[7].audits.pop();},
 'missing-picker-reference':f=>{f.native.records[8].references=[];},
 'usage-mutated':f=>{f.native.records[9].article.image='foreign';},
 'missing-old-object-absence':f=>{f.native.records[10].binaries.pop();},
 'missing-replace-audit':f=>{f.native.records[12].audits.pop();},
 'missing-permission-proof':f=>{delete f.result.completed.at(-1).requestProof;},
 'missing-permission-request':f=>{f.result.completed.at(-1).requestProof.specimens.pop();},
 'missing-operation-native-proof':f=>{f.result.completed.at(-1).requestProof.verifiedOperations.pop();},
 'wrong-delete-asset-rehashed':f=>{const p=f.result.completed.at(-1).requestProof,row=p.specimens.find(r=>r.operation==='DELETE');rebody(row,v=>{v.asset='http://127.0.0.1:65431/foreign';});p.denials.find(r=>r.operation==='DELETE').bodySha256=row.bodySha256;},
 'wrong-permission-status':f=>{f.result.completed.at(-1).requestProof.denials[0].status=500;},
 'wrong-permission-response':f=>{f.result.completed.at(-1).requestProof.denials[0].value={error:'validation'};},
 'missing-denial':f=>{f.result.completed.at(-1).requestProof.denials.pop();},
 'reordered-delete-native':f=>{f.result.checkpoints[15].label='delete-complete';},
 'cancel-mutated':f=>{f.native.records[15].article.image='foreign';},
 'missing-delete-audit':f=>{f.native.records[16].audits.pop();},
 'active-delete-lease':f=>{const s=f.native.records[16];s.leases.push({asset_id:s.assets[0].id,status:'active'});},
 'missing-reservation':f=>{f.native.records[16].reservations=[];},
 'retained-readable-deleted-image':f=>{f.native.records[23].binaries[0].missing=false;},
 'permission-mutated-public':f=>{f.native.records[24].publicDataSha256='e'.repeat(64);},
})) {const f=finalThreeFixture();mutate(f);assert.throws(f.guard,name);checks.push('final-three-'+name);}
for(const[name,mutate]of Object.entries({
 'retained-group-replay':f=>{f.browser.evidence.push({id:'core-media-catalog-query',status:'pass',coverage:[]});},
 'wrong-selected-id':f=>{f.browser.selectedJourneyIds[0]='core-media-catalog-query';},
 'missing-actual-case':f=>{f.browser.evidence.pop();},
 'setup-case-credit':f=>{f.browser.evidence[1].coverage.push('uncredited-setup');},
})) {const f=finalThreeFixture();mutate(f);assert.throws(f.select,name);checks.push('final-three-selection-'+name);}
{
 const f=finalThreeFixture();f.native.records[6].qaActorId=999;assert.throws(f.check);checks.push('final-three-actual-private-native-receipt-rejects-tampering');
 const admission=compile('fixtures/admin-core-domain-form-journeys.mjs').validateCoreJourneySelection;
 assert.equal(admission({scope:'core-closure',cohort:'media-library',selection:mediaSelection.CORE_MEDIA_FINAL_THREE_SELECTION}),mediaSelection.CORE_MEDIA_FINAL_THREE_SELECTION);
 assert.throws(()=>admission({scope:'core-closure',cohort:'media-recovery',selection:mediaSelection.CORE_MEDIA_FINAL_THREE_SELECTION}));checks.push('final-three-exact-selection-only-media-library');
}

const canonicalAggregateSource=fs.readFileSync(path.join(sourceDirectory,'verify-admin-adoption-readback-isolated.mts'),'utf8'),currentField='const checkpointField = recovery ? "id" : "receiptId";';assert.equal(canonicalAggregateSource.split(currentField).length,2);
const oldAggregate=compileSource(canonicalAggregateSource.replace(currentField,'const checkpointField = "id";'),path.join(sourceDirectory,'verify-admin-adoption-readback-isolated.mts'),{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own},'./verify-admin-core-media-isolated.mts':media,'./verify-admin-core-media-recovery-isolated.mts':recovery,'./fixtures/admin-core-media-recovery-journeys.mjs':recoverySelection,'./fixtures/admin-core-media-journeys.mjs':mediaSelection});const actualLibraryReceipt=fixture(false),actualRecoveryReceipt=fixture(true);assert.throws(()=>oldAggregate.assertCoreMediaCompletionReceipts(actualLibraryReceipt.handle,actualLibraryReceipt.browser,actualLibraryReceipt.native));assert.equal(oldAggregate.assertCoreMediaCompletionReceipts(actualRecoveryReceipt.handle,actualRecoveryReceipt.browser,actualRecoveryReceipt.native,actualRecoveryReceipt.cleanup).binding.checkpoints,actualRecoveryReceipt.native.records.length);checks.push('old-id-only-assumption-rejects-actual-library-producer-but-preserves-recovery');

const sources=['verify-admin-core-media-isolated.mts','verify-admin-core-media-recovery-isolated.mts','verify-admin-adoption-readback-isolated.mts'];const result={status:'pass',count:checks.length,checks,sourceSha256:Object.fromEntries(sources.map(p=>["scripts/"+p,hash(fs.readFileSync(path.join(sourceDirectory,p)))])),helperSources:Object.fromEntries(['scripts/fixtures/admin-core-media-journeys.mjs','scripts/fixtures/admin-core-media-recovery-journeys.mjs'].map(p=>[p,hash(fs.readFileSync(p))])),boundary:'Actual canonical aggregate and private receipt-completion functions, executed with controlled ports and test-only private capture setup. No native database/browser proof or capability coverage.',automaticCoverage:[],globalClosed:false};const output=path.resolve('.tmp-qa/core-final-closure/media-completion-controls.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,count:result.count}));
