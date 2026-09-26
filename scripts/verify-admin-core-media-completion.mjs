import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const sourceDirectory=path.resolve("scripts"),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[];
const active=new WeakSet(),own=handle=>assert.ok(active.has(handle),'Unowned control handle');
function compile(file,dependencies={},bridge='') {const source=fs.readFileSync(path.join(sourceDirectory,file),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const compiledModule={exports:{}};new Function('require','module','exports',js+'\n'+bridge)(id=>dependencies[id]??(id.startsWith('node:')?require(id):{}),compiledModule,compiledModule.exports);return compiledModule.exports;}
const media=compile('verify-admin-core-media-isolated.mts',{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own}},'exports.__seed=(h,r)=>checkpointReceipts.set(h,new Map(r.map(x=>[String(x.id),hash(JSON.stringify(x))])));');
const recovery=compile('verify-admin-core-media-recovery-isolated.mts',{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own}},'exports.__seed=(h,r,c)=>completionReceipts.set(h,{records:new Map(r.map(x=>[String(x.id),receiptHash(x)])),cleanup:receiptHash(c)});');
const aggregate=compile('verify-admin-adoption-readback-isolated.mts',{'./lib/isolated-supabase.mts':{assertOwnedLocalHandle:own},'./verify-admin-core-media-isolated.mts':media,'./verify-admin-core-media-recovery-isolated.mts':recovery});
const mediaGroups=['readiness','folders','upload-validation-retry','catalog-query','metadata-failure-retry','preview','picker-use','in-use-delete','physical-move','replace-references','detach-delete','permission'];
const recoveryGroups=['prepare','queue-fetch-retry','committed-lease-warning','resolve-lease','produce-existing-object-reservation','produce-finalize','repair-finalize','produce-missing','repair-missing','repair-existing-object-reservation','permission'];
function sourceGroups(file) {const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),groups=[];
function value(n,env){if(ts.isStringLiteral(n))return n.text;if(ts.isIdentifier(n))return env[n.text];if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken)return value(n.left,env)+value(n.right,env);throw Error('Unclassified group expression');}
function visit(node,env={}){if(ts.isForOfStatement(node)&&ts.isArrayLiteralExpression(node.expression)&&ts.isVariableDeclarationList(node.initializer)){const name=node.initializer.declarations[0].name.getText(ast);for(const element of node.expression.elements){if(!ts.isStringLiteral(element)){ts.forEachChild(node,n=>visit(n,env));return;}visit(node.statement,{...env,[name]:element.text});}return;}if(ts.isCallExpression(node)&&node.expression.getText(ast)==='group'){groups.push(value(node.arguments[0],env));return;}ts.forEachChild(node,n=>visit(n,env));}visit(ast);return groups;}
assert.deepEqual(sourceGroups('scripts/fixtures/admin-core-media-journeys.mjs'),mediaGroups);assert.deepEqual(sourceGroups('scripts/fixtures/admin-core-media-recovery-journeys.mjs'),recoveryGroups);checks.push('expected-group-sets-derived-from-actual-helper-call-sites');
function fixture(isRecovery=false){const handle={identity:{runId:'owned-control-run'}};active.add(handle);const groups=isRecovery?recoveryGroups:mediaGroups,kind=isRecovery?'media-recovery-state':'media-library-state',consumer=isRecovery?'media-recovery-queue':'media-library',field=isRecovery?'name':'group',prefix=isRecovery?'core-media-recovery-':'core-media-';
const completed=groups.map(name=>({[field]:name,consumer,automaticCoverage:[],asserted:true}));
const states=[0,1].map(()=>({id:crypto.randomUUID(),kind,status:'pass',ownedRunId:handle.identity.runId,namespace:'qa-core-media-0123456789abcdef',qaActorId:7,articleId:91,automaticCoverage:[]}));
const faults=[];if(isRecovery)for(const scenario of ['lease','cancel','finalize','missing']){const token=crypto.randomUUID();for(const step of scenario==='lease'?['arm','cancel','release']:['arm','switch','cancel','release'])faults.push({id:crypto.randomUUID(),kind:'media-recovery-fault-'+step,status:'pass',scenario,token,...(step==='release'?{activeLocks:0,ownedTransactionsRolledBack:true,cancellationAcknowledged:true}:{})});}
const native={status:'pass',records:[...states,...faults]},cleanup=isRecovery?{status:'closed',activeLocks:0,records:faults,automaticCoverage:[]}:undefined;
const result={completed,checkpoints:states.map((r,i)=>({id:r.id,label:'checkpoint-'+i})),automaticCoverage:[],globalClosed:false};
const browser={status:'pass',driverCompleted:true,errors:[],scope:'core-closure',cohort:isRecovery?'media-recovery':'media-library',evidence:completed.map(r=>({id:prefix+r[field],status:'pass',coverage:[],...r})),[isRecovery?'mediaRecovery':'media']:result};
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
'duplicate-checkpoint':f=>{f.result.checkpoints.push({...f.result.checkpoints[0]})},
'foreign-checkpoint':f=>{const id=crypto.randomUUID();f.result.checkpoints[0].id=id;f.native.records[0].id=id},
'native-value-tampering':f=>{f.native.records[0].qaActorId=9},
'native-record-omitted-with-browser':f=>{f.result.checkpoints.pop();f.native.records.splice(1,1)},
'native-record-added-with-browser':f=>{const row={...f.native.records[0],id:crypto.randomUUID()};f.result.checkpoints.push({id:row.id,label:'extra'});f.native.records.splice(2,0,row)},
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
const sources=['verify-admin-core-media-isolated.mts','verify-admin-core-media-recovery-isolated.mts','verify-admin-adoption-readback-isolated.mts'];const result={status:'pass',count:checks.length,checks,sourceSha256:Object.fromEntries(sources.map(p=>["scripts/"+p,hash(fs.readFileSync(path.join(sourceDirectory,p)))])),helperSources:Object.fromEntries(['scripts/fixtures/admin-core-media-journeys.mjs','scripts/fixtures/admin-core-media-recovery-journeys.mjs'].map(p=>[p,hash(fs.readFileSync(p))])),boundary:'Actual canonical aggregate and private receipt-completion functions, executed with controlled ports and test-only private capture setup. No native database/browser proof or capability coverage.',automaticCoverage:[],globalClosed:false};const output=path.resolve('.tmp-qa/core-final-closure/media-completion-controls.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,count:result.count}));
