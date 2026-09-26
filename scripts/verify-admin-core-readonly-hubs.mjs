import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createJiti} from 'jiti';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {buildCoreReadonlyHubPlan} from './fixtures/admin-core-readonly-hubs-journeys.mjs';
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}), require=createRequire(import.meta.url);
const collection=await jiti.import('../src/lib/admin/interaction-system/adoption-manifest.ts');
const forms=await jiti.import('../src/lib/admin/form-system/adoption-manifest.ts');
const reports=await jiti.import('../src/lib/admin/reports/reports-information-architecture.ts');
const integrations=await jiti.import('../src/lib/admin/integrations/integrations-contract.ts');
const base={collectionAdoption:collection.ADMIN_COLLECTION_SURFACE_ADOPTION,formManifest:forms.ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
 reportDefinitions:reports.ADMIN_REPORT_DEFINITIONS,integrationDefinitions:integrations.INTEGRATION_DEFINITIONS};
const checks=[];async function test(name,body){await body();checks.push({name,status:'pass'});}
let plan;
await test('current-canonical-plan-preserves-remaining-security-and-media',()=>{plan=buildCoreReadonlyHubPlan(base);assert.ok(plan.selected.length&&plan.reports.length&&plan.integrations.length);assert.ok(plan.remaining.some(r=>r.id==='security-settings'));assert.ok(plan.remaining.some(r=>r.state==='remaining-specialized-media-behavior'));});
for(const change of ['missing-hub','duplicate-hub','unknown-route','generic-owner','missing-command-surface','duplicate-report','foreign-report','report-no-filter','duplicate-integration','unknown-integration-category','missing-security-inventory']){
 const value=structuredClone(base);
 if(change==='missing-hub')value.collectionAdoption.surfaces=value.collectionAdoption.surfaces.filter(r=>r.id!=='projects-hub');
 if(change==='duplicate-hub')value.collectionAdoption.surfaces.push(value.collectionAdoption.surfaces.find(r=>r.id==='projects-hub'));
 if(change==='unknown-route')value.collectionAdoption.surfaces.find(r=>r.id==='projects-hub').routes=[];
 if(change==='generic-owner')value.collectionAdoption.surfaces.find(r=>r.id==='projects-hub').generic=true;
 if(change==='missing-command-surface')value.formManifest.find(r=>r.id==='activity-sitemap-media-commands').surfaces=[];
 if(change==='duplicate-report')value.reportDefinitions.push(value.reportDefinitions[0]);
 if(change==='foreign-report')value.reportDefinitions[0].href='/admin/foreign';
 if(change==='report-no-filter')value.reportDefinitions[0].filters=[{id:'all'}];
 if(change==='duplicate-integration')value.integrationDefinitions.push(value.integrationDefinitions[0]);
 if(change==='unknown-integration-category')value.integrationDefinitions[0].category='unknown';
 if(change==='missing-security-inventory')value.formManifest=value.formManifest.filter(r=>r.id!=='security-settings');
 await test('plan-rejects-'+change,()=>assert.throws(()=>buildCoreReadonlyHubPlan(value)));
}
const nativePath='scripts/verify-admin-core-readonly-hubs-isolated.mts',nativeSource=readFileSync(nativePath,'utf8');
const compiled=ts.transpileModule(nativeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const db=new PGlite();let statements=[],opened=0,closed=0,owned=0,fault=null;
const handle={identity:{runId:'controlled-owned'},withDatabaseConnection:async callback=>{opened++;try{return await callback({query:async(sql,args)=>{statements.push(sql);if(fault==='query'&&sql.startsWith('select jsonb'))throw Error('controlled query error');const result=await db.query(sql,args);if(fault==='wrong-db'&&sql.startsWith('select current_database()'))result.rows[0].database='foreign';return result;}});}finally{closed++;}}};
const loaded={exports:{}};
new Function('require','module','exports',compiled)(name=>{
 if(name==='./lib/isolated-supabase.mts')return {assertOwnedLocalHandle:value=>{assert.equal(value,handle);owned++;if(fault==='expired-before'||(fault==='expired-after'&&owned===2))throw Error('expired owned handle');}};
 assert.equal(name,'node:assert/strict');return require(name);
},loaded,loaded.exports);
const call=loaded.exports.readCoreReadonlyHubCheckpoint;
const request=(entity,fields={})=>({id:randomUUID(),kind:'readonly-hub-state',entity,...fields});
function reset(){statements=[];opened=closed=owned=0;fault=null;}
try{
 await db.exec(`create table public.projects(id bigint primary key,arabic_name text,type text);
 create table public.project_tracking_stages(id bigint primary key,project_id bigint);
 create table public.project_tracking_items(id bigint primary key,stage_id bigint);
 create table public.project_tracking_updates(id bigint primary key,item_id bigint);
 create table public.analytics_provider_read_models(period_key text,compare_key text);
 create function public.admin_dashboard_truth_v1() returns jsonb language sql as $$select '{"recentTopics":[{"id":41,"title":"Current one","status":"published","privateField":"not exported"},{"id":40,"title":"Current two","status":"unpublished"}]}'::jsonb$$;
 insert into projects values(1,'Owned A','residential'),(2,'Owned B','commercial'),(3,'Owned C','residential');
 insert into project_tracking_stages values(10,1),(11,1),(12,2);
 insert into project_tracking_items values(20,10),(21,11),(22,12);
 insert into project_tracking_updates values(30,20),(31,20),(32,21),(33,22);
 insert into analytics_provider_read_models values('last_30_days','none'),('last_30_days','previous_period');`);
 for(const [entity,fields,expected] of [
 ['projects',{}, {residential:2,commercial:1}],
 ['tracking',{projectId:1},{id:1,title:'Owned A',stageCount:2,updateCount:3}],
 ['dashboard',{},[{id:41,title:'Current one',status:'published'},{id:40,title:'Current two',status:'unpublished'}]],
 ['analytics',{period:'last_90_days',compare:'previous_period'},{period:'last_90_days',compare:'previous_period',storedReadModelCount:0}],
 ['analytics',{period:'last_30_days',compare:'none'},{period:'last_30_days',compare:'none',storedReadModelCount:1}],
 ]) await test('actual-projection-'+entity+'-'+JSON.stringify(fields),async()=>{reset();const input=request(entity,fields),result=await call(handle,input);assert.equal(result.id,input.id);assert.deepEqual(result.value,expected);assert.equal(owned,2);assert.equal(opened,1);assert.equal(closed,1);assert.equal(statements[0],'begin isolation level repeatable read read only');assert.equal(statements.at(-1),'commit');});
 for(const [name,input] of [
 ['null',null],['array',[]],['bad-id',request('projects',{id:'no'})],['coerced-id',request('projects',{id:{toString:()=>randomUUID()}})],
 ['unknown-kind',request('projects',{kind:'other'})],['unknown-entity',request('admin_users')],['coerced-entity',request({toString:()=> 'projects'})],
 ['sql',request('projects',{sql:'select secret'})],['bad-project',request('tracking',{projectId:0})],['string-project',request('tracking',{projectId:'1'})],
 ['unsafe-project',request('tracking',{projectId:9007199254740992})],['missing-project',request('tracking')],
 ['bad-period',request('analytics',{period:'all',compare:'none'})],['coerced-period',request('analytics',{period:{toString:()=> 'last_30_days'},compare:'none'})],
 ['bad-compare',request('analytics',{period:'last_30_days',compare:'all'})],['coerced-compare',request('analytics',{period:'last_30_days',compare:{toString:()=> 'none'}})],
 ['extra-key',request('analytics',{period:'last_30_days',compare:'none',schema:'auth'})]
 ]) await test('fixed-request-rejects-'+name,async()=>{reset();await assert.rejects(call(handle,input));assert.equal(opened,0);assert.equal(statements.length,0);});
 for(const name of ['query','wrong-db','expired-before','expired-after']) await test('scope-failure-'+name,async()=>{reset();fault=name;await assert.rejects(call(handle,request('projects')));assert.equal(opened,closed);if(name==='query'||name==='wrong-db')assert.equal(statements.at(-1),'rollback');if(name==='expired-before')assert.equal(opened,0);if(name==='expired-after')assert.equal(statements.at(-1),'commit');});
 await test('missing-project-fails-and-rolls-back',async()=>{reset();await assert.rejects(call(handle,request('tracking',{projectId:999})));assert.equal(statements.at(-1),'rollback');assert.equal(opened,closed);});
 await test('actual-readonly-transaction-rejects-write',async()=>{await db.exec('begin isolation level repeatable read read only');try{await assert.rejects(db.query("insert into projects values(999,'must not persist','residential')"),e=>e.code==='25006');}finally{await db.exec('rollback');}assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,3);});
 const sources=[nativePath,'scripts/fixtures/admin-core-readonly-hubs-journeys.mjs'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
 const result={status:'pass',cases:checks.length,checks,plan,sources,boundary:'Canonical current manifests plus actual helper control flow and SQL executed in disposable PGlite. Ownership port is controlled; installed full-Supabase/native Browser proof remains pending. Dashboard truth function returns a test projection; no claim of its full production RPC behavior.'};
 console.log(JSON.stringify({status:result.status,cases:checks.length,hubs:plan.selected.length,reports:plan.reports.length,integrations:plan.integrations.length,checks,sources,boundary:result.boundary},null,2));
}finally{await db.close();}
