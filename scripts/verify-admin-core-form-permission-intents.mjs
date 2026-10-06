import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createJiti } from 'jiti';
import ts from 'typescript';


/** Exact current producer protocol; incomplete, duplicate or failed output is never applicability evidence. */
export function parseCoreCanonicalApplicability(result) {
  assert.ifError(result.error);assert.equal(result.signal ?? null,null,'Canonical applicability child was terminated.');
  assert.equal(result.status,0,'Current canonical applicability preflight failed.');
  assert.equal(typeof result.stdout,'string');const lines=result.stdout.split(/\r?\n/).map(line=>line.trim());
  const payloads=lines.filter(line=>line.startsWith('{'));assert.equal(payloads.length,1,'Expected one complete canonical applicability JSON payload.');
  let value;try{value=JSON.parse(payloads[0]);}catch{throw new Error('Canonical applicability JSON was truncated or malformed.');}
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),['capabilities','consumers','phase']);
  assert.equal(value.phase,'applicability');assert.ok(Array.isArray(value.capabilities)&&value.capabilities.length>0&&value.capabilities.every(key=>typeof key==='string'&&key.length>0));
  assert.equal(new Set(value.capabilities).size,value.capabilities.length);assert.ok(Array.isArray(value.consumers)&&value.consumers.length>0);
  const identities=new Set();for(const row of value.consumers){assert.ok(row&&typeof row.id==='string'&&row.id.length>0&&['form','collection'].includes(row.boundary));const key=row.boundary+':'+row.id;assert.equal(identities.has(key),false);identities.add(key);assert.ok(row.decisions&&typeof row.decisions==='object'&&!Array.isArray(row.decisions));assert.deepEqual(Object.keys(row.decisions).sort(),[...value.capabilities].sort());}
  assert.equal(lines.filter(line=>line==='Phase: applicability').length,1);assert.equal(lines.filter(line=>line==='Consumer Capability Adoption Audit passed.').length,1);
  assert.equal(lines.filter(Boolean).at(-1),'Consumer Capability Adoption Audit passed.','Canonical applicability completion marker is missing.');
  return value;
}

// Execute current source contracts with controlled ports; this never promotes Browser coverage.
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const dir=path.join(root,'.tmp-qa/core-final-closure');fs.mkdirSync(dir,{recursive:true});
const sourceFiles=['scripts/fixtures/admin-core-domain-form-journeys.mjs','scripts/fixtures/admin-core-operational-form-journeys.mjs','scripts/fixtures/admin-core-settings-journeys.mjs','scripts/fixtures/admin-core-navigation-settings-journeys.mjs','scripts/verify-admin-adoption-readback-isolated.mts'];
const source=fs.readFileSync(sourceFiles[0],'utf8'),ast=ts.createSourceFile('actual-helper.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),names=['assertCoreFormPermissionNativeDescriptor','assertCoreFormPermissionNativeWrite','runCoreFormPermissionIntent'];
const definitions=names.map(name=>{const found=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.equal(found.length,1);return found[0].getText(ast).replace(/^export /,'');}).join('\n');const funcs=new Function('assert',definitions+';return {'+names.join(',')+'};')(assert),checks=[];
const check=(name,task)=>{task();checks.push(name);};const mapping={caseId:'owned-case',formConsumer:'company-identity-settings',surface:'singleton-settings'};
function setting(){const expected={table:'site_settings',id:'admin.company',expected:{},expectedJson:[{column:'value',path:['name'],value:'Authored'}],auditActions:['site_settings.update']};const actual={table:expected.table,id:expected.id,deleted:false,actual:{key:expected.id},json:[{column:'value',path:['name'],actual:'Authored'}],expectedActorId:7,audit:[{action:'site_settings.update',actor_admin_user_id:7}]};return{expected,actual};}
for(const [consumer,surface,key]of [['company-identity-settings','singleton-settings','admin.company'],['global-seo-settings','global-meta','seo.global'],['media-library-settings','media-policy-settings','media.settings']])check('canonical-json-settings-'+key,()=>{const f=setting();f.expected.id=key;f.actual.id=key;f.actual.actual.key=key;funcs.assertCoreFormPermissionNativeWrite(f.expected,f.actual,{...mapping,formConsumer:consumer,surface});});
const invalid={ 'foreign-settings-key':f=>f.expected.id='secret.integration','foreign-table':f=>f.expected.table='topics','empty-json':f=>f.expected.expectedJson=[],'wrong-json-column':f=>f.expected.expectedJson[0].column='config','empty-json-path':f=>f.expected.expectedJson[0].path=[],'prototype-json-path':f=>f.expected.expectedJson[0].path=['__proto__'],'missing-json-value':f=>delete f.expected.expectedJson[0].value,'duplicate-json-path':f=>f.expected.expectedJson.push({...f.expected.expectedJson[0]}),'wrong-native-key':f=>f.actual.actual.key='media.settings','wrong-native-json':f=>f.actual.json[0].actual='Other','missing-native-json':f=>f.actual.json=[],'wrong-audit-actor':f=>f.actual.audit[0].actor_admin_user_id=8,'missing-actor-owner':f=>delete f.actual.expectedActorId,'missing-audit':f=>f.actual.audit=[],'wrong-audit-action':f=>f.actual.audit[0].action='other','deleted-save':f=>f.actual.deleted=true};
for(const [name,mutate]of Object.entries(invalid))check('reject-'+name,()=>{const f=setting();mutate(f);assert.throws(()=>funcs.assertCoreFormPermissionNativeWrite(f.expected,f.actual,mapping));});
for(const patch of [{formConsumer:'other'},{surface:'other'}])check('reject-settings-mapping-'+Object.keys(patch)[0],()=>{const f=setting();assert.throws(()=>funcs.assertCoreFormPermissionNativeWrite(f.expected,f.actual,{...mapping,...patch}));});
function tracking(){return{expected:{table:'project_tracking_updates',id:9,expected:{title:'Authored',occurred_at:'2026-01-04T12:00:00Z'},auditActions:['project_children.create']},actual:{table:'project_tracking_updates',id:9,deleted:false,actual:{title:'Authored',occurred_at:'2026-01-04T12:00:00+00:00'},json:[],expectedActorId:7,audit:[{action:'project_children.create',actor_admin_user_id:7}]}};}
check('canonical-tracking-equivalent-instant',()=>{const f=tracking();funcs.assertCoreFormPermissionNativeWrite(f.expected,f.actual,mapping);});
for(const [name,mutate]of Object.entries({'different-instant':f=>f.actual.actual.occurred_at='2026-01-04T12:00:01Z','invalid-expected':f=>f.expected.expected.occurred_at='invalid','invalid-actual':f=>f.actual.actual.occurred_at='invalid','numeric-expected':f=>f.expected.expected.occurred_at=0,'numeric-actual':f=>f.actual.actual.occurred_at=0,'different-table':f=>{f.expected.table='topics';f.actual.table='topics'},'changed-other-field':f=>f.actual.actual.title='Other','extra-native-field':f=>f.actual.actual.extra='not-authored'}))check('reject-tracking-'+name,()=>{const f=tracking();mutate(f);assert.throws(()=>funcs.assertCoreFormPermissionNativeWrite(f.expected,f.actual,mapping));});
// Reuse the actual driver's current inventory and lifecycle generator, including its applicability decisions.
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
const forms=await jiti.import(path.resolve('src/lib/admin/form-system/adoption-manifest.ts'));
const collections=await jiti.import(path.resolve('src/lib/admin/interaction-system/adoption-manifest.ts'));
const formManifest=forms.ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST;
const driverFile='scripts/qa-admin-adoption-journeys.mjs',driverText=fs.readFileSync(driverFile,'utf8'),driverAst=ts.createSourceFile(driverFile,driverText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const inventoryNode=driverAst.statements.filter(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(row=>row.name.getText(driverAst)==='inventory'));assert.equal(inventoryNode.length,1);
const inventoryLoops=driverAst.statements.filter(node=>ts.isForOfStatement(node)&&['inventory','collections.ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION'].includes(node.expression.getText(driverAst))&&node.getText(driverAst).includes('requiredCases.push'));assert.equal(inventoryLoops.length,2);
const preflight=spawnSync(process.execPath,['--experimental-strip-types','scripts/verify-admin-row-actions-capability.mts','--consumer-capability-audit','--all','--phase','applicability','--json'],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4000000,windowsHide:true,env:{...process.env,QA_ADMIN_USERNAME:'',QA_ADMIN_PASSWORD:''}});
const applicability=parseCoreCanonicalApplicability(preflight);

// The current payload is the positive fixture; controlled corruptions must never become applicability evidence.
const protocolOutput=value=>({status:0,signal:null,stdout:'Phase: applicability\n'+JSON.stringify(value)+'\nConsumer Capability Adoption Audit passed.\n'});
check('canonical-applicability-complete-lf',()=>assert.deepEqual(parseCoreCanonicalApplicability(protocolOutput(applicability)),applicability));
check('canonical-applicability-complete-crlf',()=>{const output=protocolOutput(applicability);output.stdout=output.stdout.replaceAll('\n','\r\n');assert.deepEqual(parseCoreCanonicalApplicability(output),applicability);});
const protocolCorruptions={
  'child-error':output=>{output.error=new Error('controlled spawn failure');},
  'child-signal':output=>{output.signal='SIGTERM';},
  'nonzero-exit':output=>{output.status=1;},
  'missing-output':output=>{delete output.stdout;},
  'missing-json':output=>{output.stdout='Phase: applicability\nConsumer Capability Adoption Audit passed.\n';},
  'duplicate-json':output=>{output.stdout=output.stdout.replace('Phase: applicability\n','Phase: applicability\n'+JSON.stringify(applicability)+'\n');},
  'truncated-json':output=>{output.stdout='Phase: applicability\n'+JSON.stringify(applicability).slice(0,-1);},
  'missing-footer':output=>{output.stdout=output.stdout.replace('Consumer Capability Adoption Audit passed.\n','');},
  'duplicate-footer':output=>{output.stdout+='Consumer Capability Adoption Audit passed.\n';},
  'nonfinal-footer':output=>{output.stdout+='Unfinished diagnostic\n';},
  'missing-phase-marker':output=>{output.stdout=output.stdout.replace('Phase: applicability\n','');},
  'duplicate-phase-marker':output=>{output.stdout='Phase: applicability\n'+output.stdout;},
};
for(const[name,mutate]of Object.entries(protocolCorruptions))check('reject-applicability-'+name,()=>{const output=protocolOutput(applicability);mutate(output);assert.throws(()=>parseCoreCanonicalApplicability(output));});
const payloadCorruptions={
  'wrong-phase':value=>{value.phase='source_proof';},
  'extra-root-key':value=>{value.extra=true;},
  'empty-capabilities':value=>{value.capabilities=[];},
  'duplicate-capability':value=>{value.capabilities.push(value.capabilities[0]);},
  'empty-consumers':value=>{value.consumers=[];},
  'duplicate-consumer':value=>{value.consumers.push(value.consumers[0]);},
  'unknown-boundary':value=>{value.consumers[0].boundary='unclassified';},
  'missing-identity':value=>{delete value.consumers[0].id;},
  'missing-decision-axis':value=>{delete value.consumers[0].decisions[value.capabilities[0]];},
  'extra-decision-axis':value=>{value.consumers[0].decisions.unclassified={state:'applicable'};},
};
for(const[name,mutate]of Object.entries(payloadCorruptions))check('reject-applicability-'+name,()=>{const value=structuredClone(applicability);mutate(value);assert.throws(()=>parseCoreCanonicalApplicability(protocolOutput(value)));});
check('truncated-applicability-has-bounded-diagnostic',()=>{const output=protocolOutput(applicability);protocolCorruptions['truncated-json'](output);assert.throws(()=>parseCoreCanonicalApplicability(output),{message:'Canonical applicability JSON was truncated or malformed.'});});

assert.deepEqual(applicability.capabilities,Object.keys(collections.ADMIN_CURRENT_SHARED_CAPABILITY_SET));
const currentInventory=new Function('forms','collections','canonical','assert',inventoryNode[0].getText(driverAst)+';const requiredCases=[];'+inventoryLoops.map(node=>node.getText(driverAst)).join('\n')+';return {inventory,requiredCases};')(forms,collections,applicability,assert);
assert.equal(applicability.consumers.length,currentInventory.inventory.length);const requiredCases=currentInventory.requiredCases;
assert.equal(new Set(requiredCases.map(row=>row.key)).size,requiredCases.length);
const canonical=requiredCases.filter(row=>row.scenario==='permission_denied');
const targets=[...['create','edit'].map(surface=>['redirects-create-edit',surface]),...['tracking-profile','stage-create','stage-edit','item-create','item-edit','update-create','update-edit'].map(surface=>['project-tracking-create-edit',surface]),...['user-create','user-edit'].map(surface=>['users-create-edit',surface]),['menu-quick-create','menu-create'],['company-identity-settings','singleton-settings'],['global-seo-settings','global-meta'],['media-library-settings','media-policy-settings'],['pages-quick-create','create']];assert.equal(targets.length,16);for(const[consumer,surface]of targets)assert.equal(canonical.filter(r=>r.boundary==='form'&&r.consumer===consumer&&r.surface===surface).length,1);checks.push('exact-sixteen-targets-derived-from-current-driver-and-applicability');
async function orderControl(kind){const calls=[],permissionEvidence=[],f=setting(),metadata={...mapping};let discarded=0,verify=0,native=0;const permissionReplay={begin:map=>{assert.deepEqual(map,mapping);calls.push('capture');return{discard:()=>{discarded++},verifyAfterSuccessfulUI:async flags=>{verify++;calls.push('replay');assert.deepEqual(flags,{canonicalUiSuccessVerified:true,nativeSaveVerified:true});return{status:'pass',...mapping,automaticCoverage:[]};}}},nativeSave:async(writes,map)=>{native++;calls.push('native');assert.deepEqual(writes,[f.expected]);assert.ok(Number.isFinite(Date.parse(map.startedAt)));assert.equal(map.caseId,metadata.caseId);if(kind==='native-failure')throw Error('controlled native failure');return{id:crypto.randomUUID(),kind:'form-save-native',status:'partial-not-global-pass',globalClosed:false,...mapping,writes:[{...f.actual,...(kind==='wrong-actor'?{audit:[{action:'site_settings.update',actor_admin_user_id:8}]}:{})}]};}};
const task=()=>funcs.runCoreFormPermissionIntent({permissionReplay,mapping,permissionEvidence,perform:async()=>{calls.push('accepted-save-and-reload');if(kind==='perform-failure')throw Error('controlled UI failure');return{value:91,nativeWrites:[f.expected]};}});
if(kind==='pass'){assert.equal(await task(),91);assert.deepEqual(calls,['capture','accepted-save-and-reload','native','replay']);assert.equal(permissionEvidence.length,1);assert.equal(permissionEvidence[0].originalProjectionCount,1);}else{await assert.rejects(task);assert.equal(verify,0);assert.equal(permissionEvidence.length,0);}assert.equal(discarded,1);if(kind==='perform-failure')assert.equal(native,0);checks.push('accepted-intent-order-'+kind);}
(async()=>{for(const kind of ['pass','perform-failure','native-failure','wrong-actor'])await orderControl(kind);
for(const [consumer,surface] of targets){const rows=formManifest.filter(row=>row.id===consumer);assert.equal(rows.length,1);assert.ok(rows[0].surfaces.includes(surface));}
checks.push('all-sixteen-targets-in-actual-current-form-manifest');
const operationalText=fs.readFileSync(sourceFiles[1],'utf8'),operationalAst=ts.createSourceFile('operational.mjs',operationalText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const familiesNode=operationalAst.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(row=>row.name.getText(operationalAst)==='families'));
const planNode=operationalAst.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildCoreOperationalFormPlan');assert.ok(familiesNode&&planNode);
const buildPlan=new Function('assert',familiesNode.getText(operationalAst)+';'+planNode.getText(operationalAst).replace(/^export /,'')+';return buildCoreOperationalFormPlan;')(assert);
const inputs={manifest:formManifest,requiredCases,fixtures:{project:{id:1},commandClosure:{tracking:{projectId:2,stage:{id:3},item:{id:4}}}}};
const plan=buildPlan(inputs);assert.deepEqual(plan.recipes.flatMap(recipe=>recipe.surfaces.map(surface=>[recipe.consumer,surface])),targets.slice(0,11));checks.push('actual-operational-plan-derives-exact-eleven-permission-targets');
assert.throws(()=>buildPlan({...inputs,manifest:formManifest.map(row=>row.id==='users-create-edit'?{...row,surfaces:[...row.surfaces,'unclassified']}:row)}));checks.push('operational-plan-rejects-unclassified-surface');

const parsed=[...sourceFiles,driverFile,'src/lib/admin/form-system/adoption-manifest.ts','src/lib/admin/interaction-system/adoption-manifest.ts'].map(file=>{const content=fs.readFileSync(file,'utf8'),node=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,/\.(?:mts|ts)$/.test(file)?ts.ScriptKind.TS:ts.ScriptKind.JS);assert.equal(node.parseDiagnostics.length,0,file);return[file,crypto.createHash('sha256').update(content).digest('hex')];});
const result={status:'pass',count:checks.length,checks,sourceSha256:Object.fromEntries(parsed),targetCells:targets.map(([consumer,surface])=>canonical.find(r=>r.consumer===consumer&&r.surface===surface).key),boundary:'Actual canonical native assertion and accepted-intent functions with controlled ports; exact canonical mappings. No Browser/native live evidence or automatic permission credit.',automaticCoverage:[]};fs.writeFileSync(path.join(dir,'form-permission-intent-controls.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,count:result.count,targetCells:result.targetCells.length}));})().catch(error=>{console.error(error);process.exitCode=1;});
