import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {registerHooks} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {loadCoreTemplatePresentationPlan,assertCoreTemplatePresentationProjection} from './fixtures/admin-core-template-library-presentation-plan.mjs';

let controls=0;const positive=(body)=>{body();controls++;},negative=(body)=>{assert.throws(body);controls++;};
const plan=await loadCoreTemplatePresentationPlan();
positive(()=>assert.equal(new Set(plan.map(row=>row.consumer)).size,plan.length));
const fixtures=new Map();
for(const spec of plan){
 const rows=Array.from({length:spec.rowCount},(_,index)=>({id:index+101,name:'Name '+(spec.rowCount-index),slug:'slug-'+((index*7)%spec.rowCount+1),status:index%2?'published':'unpublished',updated_at:new Date(Date.UTC(2026,0,1,0,0,(index*5)%spec.rowCount)).toISOString(),variant:spec.variants[index%spec.variants.length]?.[0],feed_type:spec.variants[index%spec.variants.length]?.[0],config:{presentation:{variant:spec.variants[index%spec.variants.length]?.[0]}},...(spec.detailField?{[spec.detailField]:spec.detailValues[index%spec.detailValues.length]}:{})}));fixtures.set(spec.kind,rows);
 const observation={pages:Array.from({length:Math.ceil(rows.length/spec.pageSize)},(_,index)=>rows.slice(index*spec.pageSize,(index+1)*spec.pageSize).map(row=>row.id)),sorts:spec.sorts.map(sort=>({key:sort.key,ascending:spec.expectedIds(rows,sort.key,'asc'),descending:spec.expectedIds(rows,sort.key,'desc'),reset:spec.expectedIds(rows)}))};
 positive(()=>assertCoreTemplatePresentationProjection(spec,rows,observation));
 for(const key of ['ascending','descending','reset'])for(const sort of spec.sorts){const bad=structuredClone(observation),item=bad.sorts.find(row=>row.key===sort.key);[item[key][0],item[key][1]]=[item[key][1],item[key][0]];negative(()=>assertCoreTemplatePresentationProjection(spec,rows,bad));}
 for(const modify of [bad=>bad.sorts.pop(),bad=>bad.sorts.push(bad.sorts[0]),bad=>bad.sorts[0].key='unregistered',bad=>bad.pages.pop(),bad=>bad.pages[1][0]=bad.pages[0][0],bad=>bad.pages.reverse()]){const bad=structuredClone(observation);modify(bad);negative(()=>assertCoreTemplatePresentationProjection(spec,rows,bad));}
 const equalRows=rows.map(row=>({...row,status:'published'}));negative(()=>assertCoreTemplatePresentationProjection(spec,equalRows,observation));
 // Equal values must retain native sort_order, including descending. No new
 // ID tie-breaker can be substituted for the existing stable-sort contract.
 const status=observation.sorts.find(row=>row.key==='status'),groups=Map.groupBy(rows,row=>String(spec.sortValue(row,'status')));for(const group of groups.values())for(const direction of ['ascending','descending'])positive(()=>assert.deepEqual(status[direction].filter(id=>group.some(row=>row.id===id)),group.map(row=>row.id)));
}

// Exercise the real verifier SQL, request validation and exact finally cleanup
// against in-memory PostgreSQL-compatible SQL. This is explicitly not the owned
// native PostgreSQL or authenticated Product Browser proof.
const nativeUrl=new URL('./verify-admin-core-template-library-presentation-isolated.mts',import.meta.url).href;
const hooks=registerHooks({resolve(specifier,context,next){if(context.parentURL===nativeUrl&&specifier==='./lib/isolated-supabase.mts')return{url:'data:text/javascript,'+encodeURIComponent('import assert from "node:assert/strict"; export function assertOwnedLocalHandle(h){assert.equal(h.controlledVerifierPort,true)}'),shortCircuit:true};if(context.parentURL===nativeUrl&&specifier==='./verify-admin-core-domain-readback-isolated.mts')return{url:'data:text/javascript,'+encodeURIComponent('export async function readCoreFixedQaActor(connection){return Number((await connection.query("select 91::int id")).rows[0].id)}'),shortCircuit:true};return next(specifier,context);}});
const native=await import('./verify-admin-core-template-library-presentation-isolated.mts');hooks.deregister();
const request=(kind,phase)=>({id:randomUUID(),kind:'template-library-presentation-state',moduleKind:kind,phase});
positive(()=>native.validateCoreTemplatePresentationRequest(request(plan[0].kind,'before')));
for(const change of [row=>row.sql='delete',row=>row.id='bad',row=>row.kind='other',row=>row.phase='all',row=>row.actorId=1]){const row=request(plan[0].kind,'before');change(row);negative(()=>native.validateCoreTemplatePresentationRequest(row));}
const db=new PGlite();await db.exec('create table admin_user_preferences(admin_user_id bigint,view_key text,preferences jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(admin_user_id,view_key)); create table admin_audit_logs(id bigint primary key,action text); create table hero_assignments(id bigint,hero_id bigint);');
const templates=[];
for(const spec of plan){await db.exec(`create table ${spec.table}(id bigserial primary key,name text,slug text unique,status text,config jsonb,variant text,feed_type text,section_key text,widget_key text,sort_order integer,created_at timestamptz,updated_at timestamptz);`);const source=await db.query(`insert into ${spec.table}(name,slug,status,config,variant,sort_order) values('Native source','native-source','published','{"presentation":{"variant":"editorial"}}','default',1),('Native source two','native-source-two','published','{"presentation":{"variant":"editorial"}}','default',2) returning id`);templates.push(...source.rows.map(row=>({kind:spec.kind,id:Number(row.id),assigned:false})));}
const original={visibleColumns:['slug'],special:'preserve exact original'};await db.query('insert into admin_user_preferences values(91,$1,$2::jsonb,\'2026-01-01T00:00:00.123456Z\',\'2026-01-02T00:00:00.654321Z\')',[plan[0].viewKey,JSON.stringify(original)]);
const handle={controlledVerifierPort:true,identity:{runId:'control-run-unique'},withDatabaseConnection:async callback=>callback({query:(sql,values=[])=>db.query(sql,values)})};
try{
 const seeded=await native.seedOwnedCoreTemplatePresentationFixture(handle,{pages:{templates}});positive(()=>assert.deepEqual(Object.keys(seeded.templateLibraryPresentation.contexts).sort(),plan.map(row=>row.kind).sort()));
 const evidence=[];
 for(const spec of plan){
  const before=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'before'));controls++;
  await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'after')));controls++;
  await db.query(`update ${spec.table} set name='Unexpected mutation' where id=$1`,[before.rows[0].id]);await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-hidden')));controls++;
  await db.query(`update ${spec.table} set name=$1 where id=$2`,[before.rows[0].name,before.rows[0].id]);
  await db.query("insert into admin_audit_logs values(1,'unexpected')");await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-hidden')));controls++;await db.query('delete from admin_audit_logs where id=1');
  await db.query('update admin_user_preferences set preferences=$1::jsonb where admin_user_id=91 and view_key=$2',[JSON.stringify({visibleColumns:spec.defaults.filter(key=>key!=='status')}),spec.viewKey]);
  const hidden=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-hidden'));controls++;
  await db.query('update admin_user_preferences set preferences=$1::jsonb where admin_user_id=91 and view_key=$2',[JSON.stringify({visibleColumns:spec.defaults}),spec.viewKey]);
  const restored=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-restored')),after=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'after'));controls+=2;
  evidence.push({id:'core-template-presentation-'+spec.kind,status:'pass',moduleKind:spec.kind,consumer:spec.consumer,nativeActorId:91,nativeCheckpointIds:[before,hidden,restored,after].map(row=>row.id),pages:Array.from({length:Math.ceil(before.rows.length/spec.pageSize)},(_,index)=>before.orderedIds.slice(index*spec.pageSize,(index+1)*spec.pageSize)),sorts:before.sorts,preferencePosts:2,backAndReload:true,pageSizeChanged:true,outOfRangeClamped:true,optionalHeaderAndCellsRestored:true,informationNativeFields:true,ownedEditNavigation:true,domainAndAuditUnchanged:true,copyPublicLink:'hidden-by-current-contract',automaticCoverage:[]});
 }
 const sourceSha256='a'.repeat(64),requiredCases=plan.map(spec=>({key:'collection:'+spec.consumer+':capability:scrollbar',boundary:'collection',consumer:spec.consumer,axis:'scrollbar',scenario:'complete_applicable_capability_behavior',declaration:'adopted'}));
 for(const row of evidence){const spec=plan.find(value=>value.kind===row.moduleKind);row.renderedAdoption=[{id:'template-library-'+spec.kind+'-scrollbar',status:'rendered-fragments-observed',receiptId:randomUUID(),sourceSha256,axis:'scrollbar',routePathname:spec.route,bindings:[{key:'collection:'+spec.consumer+':capability:scrollbar',boundary:'collection',consumer:spec.consumer,surface:spec.route}],automaticCoverage:[],globalClosed:false,observations:[{viewport:'desktop',width:1280,height:900},{viewport:'narrow',width:390,height:760}].map(view=>({...view,state:'overflow-observed',targetReachable:true,targetHitTestPassed:true,computedCanonicalThin:true,extent:900,client:300,actualWheelMoved:true,farBoundaryReached:true,backgroundPositionRetained:true}))}];}
 evidence.unshift({id:'existing-auth-login',status:'pass',authenticated:true});
 const receipt={sourceSha256,requiredCases,status:'pass',driverCompleted:true,inventoryOnly:false,cohort:'template-libraries',errors:[],evidence};negative(()=>native.verifyCoreTemplatePresentationCompletion(handle,receipt));
 const restored=await native.restoreOwnedCoreTemplatePresentationPreferences(handle);positive(()=>assert.equal(restored.exactOriginalPreferenceRowsOrAbsenceRestored,plan.length));positive(()=>assert.equal(native.verifyCoreTemplatePresentationCompletion(handle,receipt).nativeCheckpoints,plan.length*4));

 const preserved=await db.query('select preferences,created_at::text,updated_at::text from admin_user_preferences');positive(()=>assert.equal(preserved.rows.length,1));positive(()=>assert.deepEqual(preserved.rows[0].preferences,original));positive(()=>assert.match(preserved.rows[0].created_at,/123456/));positive(()=>assert.match(preserved.rows[0].updated_at,/654321/));
 for(const change of [row=>row.evidence.pop(),row=>row.evidence.push(row.evidence[1]),row=>row.evidence[1].nativeCheckpointIds.reverse(),row=>row.evidence[1].nativeCheckpointIds[0]=randomUUID(),row=>row.evidence[1].nativeActorId=92,row=>row.evidence[1].optionalHeaderAndCellsRestored=false,row=>row.evidence[1].sorts.pop(),row=>row.evidence[1].preferencePosts=3,row=>row.evidence[1].automaticCoverage=['invented'],row=>row.status='running',row=>row.evidence[1].renderedAdoption=[],row=>row.evidence[1].renderedAdoption[0].sourceSha256='b'.repeat(64),row=>row.evidence[1].renderedAdoption[0].observations[0].targetHitTestPassed=false]){const bad=structuredClone(receipt);change(bad);negative(()=>native.verifyCoreTemplatePresentationCompletion(handle,bad));}
 await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(plan[0].kind,'before')));controls++;
}finally{await db.close();}
console.log(JSON.stringify({status:'pass',controls,libraries:plan.length,declaredVisibleSortKeys:plan.reduce((sum,spec)=>sum+spec.sorts.length,0),proofBoundary:'Canonical source-derived sort projection, meaningful negative controls and actual verifier SQL on controlled PGlite only; authenticated Browser and owned PostgreSQL remain pending.',globalClosed:false}));
