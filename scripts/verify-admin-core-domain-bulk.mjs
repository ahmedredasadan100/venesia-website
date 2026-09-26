import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import * as helper from './fixtures/admin-core-domain-bulk-journeys.mjs';

const require=createRequire(import.meta.url),checks=[];
async function test(name,work){await work();checks.push(name);}
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}),manifest=await jiti.import('../src/lib/admin/interaction-system/adoption-manifest.ts');
const namespace='qa-b2-1234abcd',fixture={topic:{id:1},category:{id:1},series:{id:1},pages:{pageId:1},bulkClosure:{namespace,actorId:7,destination:{id:99,label:namespace+' destination',slug:namespace+'-destination'}}};
for(const entity of ['topics','categories','series','pages'])fixture.bulkClosure[entity]=[0,1].map(index=>({id:index+10,label:namespace+' '+entity+' '+index,slug:namespace+'-'+entity+'-'+index}));
const {plan}=await helper.loadCoreDomainBulkPlan(fixture),sources=Object.fromEntries(plan.map(row=>[row.consumer,readFileSync(row.source,'utf8')]));
const input={claims:manifest.ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS,fixtures:fixture,sources};
await test('Current claims and real JSX options derive four exact recipes, including trash-only Category bulk',()=>{
 assert.equal(plan.length,4);assert.equal(plan.reduce((count,row)=>count+row.steps.length,0),18);assert.deepEqual(plan.find(row=>row.entity==='categories').active,[]);
 assert.deepEqual(plan.find(row=>row.entity==='topics').active,['publish','unpublish','move_to_trash','move_category','feature','unfeature']);
});
for(const [name,change]of [
 ['missing-claim',x=>x.claims.pop()&&x.claims.shift()],
 ['duplicate-claim',x=>x.claims.push(x.claims[0])],
 ['unreviewed-capability',x=>x.claims.find(row=>row.contracts.bulk==='not_required').contracts.bulk='adopted'],
 ['missing-fixture',x=>delete x.fixtures.bulkClosure],
 ['foreign-namespace',x=>x.fixtures.bulkClosure.namespace='production'],
 ['duplicate-target',x=>x.fixtures.bulkClosure.topics[1].id=10],
 ['original-target',x=>x.fixtures.bulkClosure.topics[1].id=1],
 ['destination-target',x=>x.fixtures.bulkClosure.destination.id=10],
 ['foreign-label',x=>x.fixtures.bulkClosure.pages[0].label='Real page'],
 ['foreign-slug',x=>x.fixtures.bulkClosure.series[0].slug='real-series'],
 ['unknown-option',x=>x.sources['content-topics']=x.sources['content-topics'].replace('value: "feature"','value: "invented"')],
 ['removed-option',x=>x.sources['content-series']=x.sources['content-series'].replace('{ value: "hide", label: ADMIN_BULK_ACTION_LABELS.hideSelected },','')],
 ['unwired-trash',x=>x.sources['content-categories']=x.sources['content-categories'].replace('isTrashView ? TRASH_BULK_OPTIONS : []','isTrashView ? [] : []')],
])await test(name+' fails plan',()=>{const candidate=structuredClone(input);change(candidate);assert.throws(()=>helper.buildCoreDomainBulkPlan(candidate));});

let active=true;const handle={identity:{runId:'owned-b2-controlled'},renewDatabaseControlConnection:async()=>assert.ok(active)};
function compile(file,ports){const output=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file.replace(/\.mts$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',output)(specifier=>{if(Object.hasOwn(ports,specifier))return ports[specifier];assert.ok(specifier.startsWith('node:'));return require(specifier);},loaded,loaded.exports);return loaded.exports;}
const ownership={assertOwnedLocalHandle:candidate=>{assert.equal(candidate,handle);assert.ok(active);}};
const completion=compile(resolve('scripts/verify-admin-core-domain-bulk-isolated.mts'),{'./lib/isolated-supabase.mts':ownership,'./fixtures/admin-core-domain-bulk-journeys.mjs':helper});
const candidate=process.argv.includes('--candidate-readback'),readbackFile=resolve(candidate?'.tmp-qa/core-final-closure/b2-domain-bulk-patch/files/scripts/verify-admin-core-domain-readback-isolated.mts':'scripts/verify-admin-core-domain-readback-isolated.mts');
const db=new PGlite();let scopes=0;const statements=[];
handle.withDatabaseConnection=async work=>{scopes++;try{return await work({query:async(sql,values)=>{assert.ok(active);statements.push(sql);const result=await db.query(sql,values);return {rows:result.rows,rowCount:result.rows.length};}});}finally{scopes--;}};
handle.renewDatabaseControlConnection=async()=>{assert.equal(scopes,0);assert.ok(active);};
const readback=compile(readbackFile,{'./lib/isolated-supabase.mts':ownership});
const since='2026-01-01T00:00:00Z',stamp='2026-01-02T00:00:00Z';
let nextAudit=100;const records=[],outcomes=[],evidence=[];
function record(value){const row={id:randomUUID(),...value};records.push(row);return row;}
function pair(){const correlationId=randomUUID(),base={kind:'form-permission-fingerprint',status:'pass',ownedRunId:handle.identity.runId,correlationId,adminAuditIncluded:true,adminUsersIncluded:true,publicTableCount:4,publicTableInventorySha256:'a'.repeat(64),publicDataSha256:'b'.repeat(64)};return {before:record({...base,phase:'before'}).id,after:record({...base,phase:'after'}).id};}
async function insertAudit({id,type,entity=null,label=null,action,metadata,actor=7}){await db.query('insert into public.admin_audit_logs values($1,$2,$3,$4,$5,$6,$7,$8)',[id,action,type,entity,label,actor,JSON.stringify(metadata),stamp]);}
try{
 await db.exec("create table admin_users(id bigint,username text,email text,role text,is_active boolean);insert into admin_users values(7,'qa_admin_interaction','qa-admin-interaction@example.invalid','admin',true);create table admin_audit_logs(id bigint,action text,entity_type text,entity_id bigint,entity_label text,actor_admin_user_id bigint,metadata jsonb,created_at timestamptz);create table topics(id bigint,title text,status text,deleted_at timestamptz,is_featured boolean,category_id bigint,updated_at timestamptz);create table topic_categories(id bigint,name text,status text,deleted_at timestamptz,is_active boolean,updated_at timestamptz);create table topic_series(id bigint,name text,status text,deleted_at timestamptz,updated_at timestamptz);create table pages(id bigint,title text,status text,updated_at timestamptz);");
 for(const recipe of plan){
  const operations=[],preparations=[],rejection={...pair(),attempts:1};
  for(const [ordinal,action]of recipe.steps.entries()){
   const step=helper.coreDomainBulkStep(recipe,action,ordinal);await db.exec('delete from '+recipe.table+';delete from admin_audit_logs;');
   if(!step.deleted)for(const target of recipe.targets){
    const row={id:target.id,[recipe.entity==='topics'?'title':'name']:target.label,...step.fields,deleted_at:step.trashed?stamp:null,updated_at:stamp};if(recipe.entity==='topics'&&!Object.hasOwn(row,'category_id'))row.category_id=1;
    const columns=Object.keys(row);await db.query('insert into '+recipe.table+'('+columns.join(',')+') values('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
   }
   const aggregateId=nextAudit++;
   for(const target of recipe.entity==='pages'?recipe.targets:[null]){
    const commandId=randomUUID(),metadata={...step.metadata,...(recipe.entity==='topics'?{command:{id:commandId,actorId:7,result:{ok:true,commandId}}}:{})};
    await insertAudit({id:target?nextAudit++:aggregateId,type:recipe.audit,entity:target?.id??null,action:recipe.audit+'.'+step.verb,metadata});
   }
   if(recipe.entity==='topics'&&action==='publish')for(const target of recipe.targets)await insertAudit({id:nextAudit++,type:'topic',entity:target.id,label:target.label,action:'topic.publish',metadata:{operation:'bulk_publish',atomic:true}});
   const state=record(await readback.readCoreDomainCheckpoint(handle,{id:randomUUID(),kind:'terminal-domain-state',entity:recipe.entity,ids:recipe.ids,startedAt:since}));
   const descriptors=helper.coreDomainBulkDescriptors(recipe,step,since,state);
   const saved=record({kind:'form-save-native',caseId:'domain-bulk-'+recipe.entity,formConsumer:recipe.consumer,surface:'bulk',...await readback.verifyCoreExecutedWriteProjections(handle,{status:'in-progress',startedAt:since,databaseReadback:descriptors})});
   helper.assertCoreDomainBulkNative(saved,recipe,step);
   let publicationAudit=null;if(recipe.entity==='topics'&&action==='publish'){
    const writes=recipe.targets.map(row=>({table:'topics',id:row.id,expected:{title:row.label,status:'published'},auditEntityType:'topic',auditEntityLabel:row.label,auditActions:['topic.publish'],auditMetadata:{operation:'bulk_publish',atomic:true},auditSince:since,exactAuditCount:1,exactCommandReceiptCount:0}));
    publicationAudit=record({kind:'form-save-native',caseId:'domain-bulk-topics-publication',formConsumer:recipe.consumer,surface:'bulk-publication-audit',...await readback.verifyCoreExecutedWriteProjections(handle,{status:'in-progress',startedAt:since,databaseReadback:writes})}).id;
   }
   operations.push({action,ordinal,requests:1,nativeState:state.id,nativeWrite:saved.id,publicationAudit,cancelled:step.confirmation?pair():null});
   await test(recipe.entity+'/'+action+'/'+ordinal+' actual SQL projects current state and exact domain audit shape',()=>{assert.equal(saved.writes.length,2);});
  }
  if(recipe.entity==='categories')for(const target of recipe.targets){
   await db.exec('delete from topic_categories;delete from admin_audit_logs;');await db.query("insert into topic_categories values($1,$2,'unpublished',$3,false,$3)",[target.id,target.label,stamp]);
   await insertAudit({id:nextAudit++,type:'topic_category',entity:target.id,label:target.label,action:'topic_category.delete',metadata:{bulk:false,bulk_action:'move_to_trash',category_ids:[target.id],count:1}});
   const descriptor={table:'topic_categories',id:target.id,expected:{name:target.label,status:'unpublished',is_active:false},auditEntityType:'topic_category',auditEntityLabel:target.label,auditActions:['topic_category.delete'],auditMetadata:{bulk:false,bulk_action:'move_to_trash',category_ids:[target.id],count:1},auditSince:since,exactAuditCount:1};
   preparations.push(record({kind:'form-save-native',caseId:'domain-bulk-categories-prepare',formConsumer:recipe.consumer,surface:'row-preparation',...await readback.verifyCoreExecutedWriteProjections(handle,{status:'in-progress',startedAt:since,databaseReadback:[descriptor]})}).id);
  }
  const outcome={entity:recipe.entity,consumer:recipe.consumer,targetIds:recipe.ids,actualCommands:operations,preparationNativeIds:preparations,rejection,pendingDuplicateBlocked:true,selectionRetainedOnFailure:true,selectionClearedAfterSuccess:true};outcomes.push(outcome);evidence.push({...outcome,id:'domain-bulk-'+recipe.entity+'-registered-options',status:'pass'});
 }
 const browser={status:'pass',driverCompleted:true,inventoryOnly:false,cohort:'domain-bulk',errors:[],domainBulk:{status:'pass',expectedConsumers:plan.length,outcomes},evidence},broker={status:'pass',ownedRunId:handle.identity.runId,records};
 await test('Complete actual SQL readback joins all ordered recipe checkpoints without inferred coverage',async()=>{const result=await completion.verifyCoreDomainBulkCompletion(handle,browser,fixture,broker);assert.equal(result.bulkCommands,18);assert.equal(result.nativeCheckpoints,67);assert.equal(result.distinctAuditEvents,23);assert.equal(result.publicationAudits,2);assert.equal(result.rowPreparations,2);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);});
 for(const [name,change]of [
  ['failed-browser',(b)=>b.status='fail'],['incomplete-driver',b=>b.driverCompleted=false],['inventory-only',b=>b.inventoryOnly=true],['wrong-cohort',b=>b.cohort='templates'],
  ['missing-consumer',b=>b.domainBulk.outcomes.pop()],['duplicate-receipt',b=>b.evidence.push({...b.evidence[0]})],['mixed-status-receipt',b=>b.evidence.push({...b.evidence[0],status:'fail'})],
  ['failed-case',b=>b.evidence[0].status='fail'],['incomplete-command',b=>{b.domainBulk.outcomes[0].actualCommands.pop();b.evidence[0].actualCommands=b.domainBulk.outcomes[0].actualCommands;}],
  ['wrong-owned-run',(_b,n)=>n.ownedRunId='another-run'],['failed-broker',(_b,n)=>n.status='fail'],['duplicate-native',(_b,n)=>n.records.push({...n.records[0]})],
  ['orphan-native',(_b,n)=>n.records.push({...n.records[0],id:randomUUID()})],['missing-native',(_b,n)=>n.records.pop()],
  ['wrong-positive-actor',(_b,n)=>n.records.find(r=>r.kind==='form-save-native').writes[0].audit[0].actor_admin_user_id=8],
  ['rejection-mutated-data',(_b,n)=>n.records.find(r=>r.phase==='after').publicDataSha256='c'.repeat(64)],
  ['wrong-fingerprint-run',(_b,n)=>n.records.find(r=>r.kind==='form-permission-fingerprint').ownedRunId='another-run'],
  ['missing-audit',(_b,n)=>n.records.find(r=>r.kind==='form-save-native').writes[0].audit=[]],
  ['unmatched-state-audit',(_b,n)=>n.records.find(r=>r.kind==='terminal-domain-state').audit[0].id=999999],
  ['unexpected-domain-event',(_b,n)=>n.records.find(r=>r.kind==='terminal-domain-state').audit.push({...n.records.find(r=>r.kind==='terminal-domain-state').audit[0],id:999999})],
 ])await test(name+' denied by final join',async()=>{const b=structuredClone(browser),n=structuredClone(broker);change(b,n);await assert.rejects(completion.verifyCoreDomainBulkCompletion(handle,b,fixture,n));});
 // Exercise both real Series metadata keys through the actual SQL owner, and
 // prove that unrelated metadata cannot satisfy target attribution.
 const series=plan.find(row=>row.entity==='series'),step=helper.coreDomainBulkStep(series,'hide',0);
 await db.exec("delete from topic_series;delete from admin_audit_logs;");
 for(const target of series.targets)await db.query("insert into topic_series values($1,$2,'unpublished',null,$3)",[target.id,target.label,stamp]);
 const state={kind:'terminal-domain-state',entity:'series',status:'pass',expectedActorId:7,rows:series.targets.map(row=>({id:row.id,status:'unpublished',deleted_at:null})),audit:[{id:777,actor_admin_user_id:7}]};
 const descriptors=helper.coreDomainBulkDescriptors(series,step,since,state);
 for(const [name,metadata,actor]of [
  ['ids-alias',{bulk_action:'hide',ids:series.ids},7],['wrong-ids',{bulk_action:'hide',ids:[901,902]},7],['missing-ids',{bulk_action:'hide'},7],['wrong-positive-actor',{bulk_action:'hide',ids:series.ids},8],
  ['wrong-key',{bulk_action:'hide',topic_ids:series.ids},7],['extra-target',{bulk_action:'hide',ids:[...series.ids,903]},7],
 ]){
  await db.exec('delete from admin_audit_logs;');await insertAudit({id:777,type:'topic_series',action:'topic_series.unpublish',metadata,actor});
  await test('Actual native Series aggregate '+name,async()=>{
   const read=()=>readback.verifyCoreDomainWrites(handle,{status:'pass',startedAt:since,databaseReadback:descriptors});
   if(name==='ids-alias')assert.equal((await read()).length,2);else {await assert.rejects(read());assert.equal(statements.at(-1),'rollback');}
  });
 }
 await test('Expired owned handle fails completion before proof publication',async()=>{active=false;await assert.rejects(completion.verifyCoreDomainBulkCompletion(handle,browser,fixture,broker));active=true;});
 assert.equal(scopes,0);
 console.log(JSON.stringify({status:'pass',checks:checks.length,cases:checks,candidateReadback:candidate,boundary:'Current source/manifest, actual exported guards and PGlite SQL attribution. Full native PostgreSQL and authenticated Browser bulk execution remain pending.'},null,2));
}finally{await db.close();}

