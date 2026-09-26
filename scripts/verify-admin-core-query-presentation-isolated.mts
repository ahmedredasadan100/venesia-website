import assert from 'node:assert/strict';
import { assertOwnedLocalHandle, type OwnedLocalHandle } from './lib/isolated-supabase.mts';
import { readCoreFixedQaActor } from './verify-admin-core-domain-readback-isolated.mts';
import { parseAdminEntityListRequestQuery, type AdminEntityListQueryContract } from '../src/lib/admin/entity-list/data-engine/contracts.ts';
import { loadCoreQueryPresentationPlan, coreQueryScenario } from './fixtures/admin-core-query-presentation-plan.mjs';

type Row=Record<string,unknown>;
export type CoreQueryFixture={ search:string; ids:number[]; projectId?:number; stageId?:number; itemId?:number };
export type CoreQueryFixtures={ queryClosure:{ contexts:Record<string,CoreQueryFixture> } };
type Plan=Array<{key:string;entity:string;consumerId:string;table:string;labelColumn:string;sortField:string;viewKey:string;type:string|null;level:string|null;kind:string|null;rowCount:number;filter:{key:string;value:string}|null;contract:AdminEntityListQueryContract<Record<string,unknown>,string>;publicPathFor(row:Record<string,unknown>):string|null;routeFor(fixture:CoreQueryFixture):string}>;
type NativeProof={id:string;routeKey:string;scenario:string;actorId:number;ownedRunId:string;fixtureFingerprint:string;preference:unknown};
const state=new WeakMap<OwnedLocalHandle,{fixtures:CoreQueryFixtures;plan:Plan;fingerprints:Map<string,string>;proofs:Map<string,NativeProof>}>();
function positive(value:unknown){assert.ok(typeof value==='number'&&Number.isSafeInteger(value)&&value>0);return value;}
function identifier(value:string){assert.match(value,/^[a-z][a-z0-9_]*$/);return '"'+value+'"';}
export function validateCoreQueryRequest(input:unknown){
 assert.ok(input&&typeof input==='object'&&!Array.isArray(input));const row=input as Row;
 assert.deepEqual(Object.keys(row).sort(),['id','kind','routeKey','scenario']);
 assert.match(String(row.id),/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);assert.equal(row.kind,'query-presentation-state');
 assert.ok(typeof row.routeKey==='string'&&row.routeKey.length<=80);assert.ok(typeof row.scenario==='string');
 return row as {id:string;kind:string;routeKey:string;scenario:string};
}
/** Fixed verification-only read model. Browser cannot submit SQL, IDs, fields,
 * actors, arbitrary query values or preference values. All come from owner fixtures. */
export async function readCoreQueryPresentationCheckpoint(handle:OwnedLocalHandle,input:unknown,fixtures:CoreQueryFixtures){
 assertOwnedLocalHandle(handle);const request=validateCoreQueryRequest(input);
 let current=state.get(handle);
 if(!current){
  const plan=await loadCoreQueryPresentationPlan() as Plan;assert.deepEqual(Object.keys(fixtures.queryClosure.contexts).sort(),plan.map(spec=>spec.key).sort());
  for(const spec of plan){const f=fixtures.queryClosure.contexts[spec.key];assert.match(f.search,/^qa-b1-[a-z0-9-]+$/);assert.equal(f.ids.length,spec.rowCount);assert.equal(new Set(f.ids.map(positive)).size,f.ids.length);if(spec.kind)positive(f.projectId);if(spec.kind==='items')positive(f.stageId);if(spec.kind==='updates')positive(f.itemId);}
  current={fixtures,plan,fingerprints:new Map(),proofs:new Map()};state.set(handle,current);
 }
 assert.equal(current.fixtures,fixtures,'Fixed fixture binding cannot change during the owned lifecycle.');
 assert.equal(current.proofs.has(request.id),false,'A native checkpoint ID cannot be replayed.');
 const spec=current.plan.find(row=>row.key===request.routeKey);assert.ok(spec,'Unknown registered route context.');
 const fixture=fixtures.queryClosure.contexts[spec.key],params=coreQueryScenario(spec,fixture,request.scenario);
 const query=parseAdminEntityListRequestQuery(spec.contract as AdminEntityListQueryContract<Record<string,unknown>,string>,params);
 const table=identifier(spec.table),label=identifier(spec.labelColumn),sort=identifier(spec.sortField);
 const base:string[]=[`${label} like $1`],values:unknown[]=[`%${fixture.search}%`];
 if(['topics','topic_categories','topic_series'].includes(spec.table))base.push('deleted_at is null');
 if(spec.entity==='topics_without_image')base.push("coalesce(image,'')=''");
 if(spec.type){values.push(spec.type);base.push(`type=$${values.length}`);}
 if(spec.level){values.push(spec.level);base.push(`level=$${values.length}`);}
 if(spec.kind==='stages'){values.push(fixture.projectId);base.push(`project_id=$${values.length}`);}
 if(spec.kind==='items'){values.push(fixture.stageId);base.push(`stage_id=$${values.length}`);}
 if(spec.kind==='updates'){values.push(fixture.itemId);base.push(`item_id=$${values.length}`);}
 const fullPredicate=base.join(' and '),filtered=[...base];
 if(request.scenario==='empty')filtered.push('false');
 if(request.scenario==='filtered'){
  assert.ok(spec.filter);
  const clauses:Record<string,string>={topics:"status='unpublished'",categories:"status='unpublished'",series:"status='unpublished'",projects:"publication_status='unpublished'",redirects:"status='inactive'",activity_log:"entity_type='topic'",topics_without_image:"content_type='article'",admin_users:'is_active=false',project_tracking_stages:'is_visible=false',project_tracking_items:'is_visible=false',project_tracking_updates:"publication_status='draft'"};
  const clause=spec.level?'is_active=false':clauses[spec.entity];assert.ok(clause);filtered.push(clause);
 }
 const direction=query.sort.direction==='asc'?'asc':'desc';
 const idDirection=['topics','categories','series','pages','projects','project_tracking_stages','project_tracking_items'].includes(spec.entity)?'asc':direction;
 return handle.withDatabaseConnection(async connection=>{
  await connection.query('begin isolation level repeatable read read only');
  try{
   const actorId=await readCoreFixedQaActor(connection);
   // One bounded set query and one independent complete fixture identity/hash.
   const cohort=(await connection.query(`select coalesce(jsonb_agg(id order by id),'[]'::jsonb) ids, md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) fingerprint from public.${table} t where ${fullPredicate}`,values)).rows[0];
   assert.deepEqual(cohort.ids,[...fixture.ids].sort((a,b)=>a-b),'Native complete search set must equal the pre-registered fixture IDs.');
   const fingerprint=String(cohort.fingerprint),previous=current.fingerprints.get(spec.key);
   if(previous)assert.equal(fingerprint,previous,'Read-only query/row information journeys must not mutate their domain rows.');
   const rows=(await connection.query(`select id,${label} label${spec.entity==='projects'?',slug':spec.entity==='pages'?',path':''} from public.${table} where ${filtered.join(' and ')} order by ${sort} ${direction} nulls last,id ${idDirection}`,values)).rows;
   assert.ok(rows.length<=spec.rowCount);const ids=rows.map(row=>Number(row.id));
   const totalPages=Math.max(1,Math.ceil(rows.length/query.pageSize)),page=Math.min(query.page,totalPages),start=(page-1)*query.pageSize;
   const preferences=(await connection.query('select preferences from public.admin_user_preferences where admin_user_id=$1 and view_key=$2',[actorId,spec.viewKey])).rows;
   assert.ok(preferences.length<=1);
   await connection.query('commit');current.fingerprints.set(spec.key,fingerprint);
   current.proofs.set(request.id,{id:request.id,routeKey:spec.key,scenario:request.scenario,actorId,ownedRunId:handle.identity.runId,fixtureFingerprint:fingerprint,preference:preferences[0]?.preferences??null});
   return {status:"pass" as const,ownedRunId:handle.identity.runId,id:request.id,kind:request.kind,routeKey:spec.key,scenario:request.scenario,entity:spec.entity,consumerId:spec.consumerId,actorId,route:spec.routeFor(fixture),query:params.toString(),
    expectedIds:ids.slice(start,start+query.pageSize),completeIds:ids,rows:rows.slice(start,start+query.pageSize).map(row=>({id:Number(row.id),label:String(row.label),publicPath:spec.publicPathFor(row)})),
    pagination:{page,pageSize:query.pageSize,totalRows:rows.length,totalPages},fixtureFingerprint:fingerprint,preference:preferences[0]?.preferences??null,
    proofBoundary:'Native table order, complete isolated search set and same-run QA preference projection; no domain audit or unrelated capability proof is inferred.'};
  }catch(error){await connection.query('rollback');throw error;}
 });
}

/** Same-handle aggregate join, after the Browser gate; no new query or inferred coverage. */
export function verifyCoreQueryPresentationCompletion(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);assert.ok(input&&typeof input==='object');const browser=input as Row;
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.cohort,'query-presentation');assert.deepEqual(browser.errors,[]);
 const result=browser.queryPresentation as Row;assert.ok(result&&result.status==='pass'&&Array.isArray(result.outcomes));assert.ok(Array.isArray(browser.evidence));
 const current=state.get(handle);assert.ok(current,'No native query checkpoints ran on this owned handle.');
 const outcomes=result.outcomes as Row[],evidence=browser.evidence as Row[];
 assert.deepEqual(outcomes.map(row=>row.routeKey).sort(),current.plan.map(row=>row.key).sort(),'Every current route context must complete exactly once.');
 const used:string[]=[],actors=new Set<number>(),summaries:Row[]=[];
 for(const spec of current.plan){
  const outcome=outcomes.find(row=>row.routeKey===spec.key)!;assert.equal(outcome.consumerId,spec.consumerId);assert.equal(outcome.entity,spec.entity);
  const receipts=evidence.filter(row=>row.id==='core-query-presentation-'+spec.key);assert.equal(receipts.length,1);assert.equal(receipts[0].status,'pass');
  for(const[key,value]of Object.entries(outcome))assert.deepEqual(receipts[0][key],value,'Outcome must match its final successful Browser receipt.');
  assert.ok(Array.isArray(outcome.nativeCheckpointIds));const ids=outcome.nativeCheckpointIds as string[];
  const sequence=['first','empty','second','third','clamp','wide','descending',...(spec.filter?['filtered']:[]),'preferences','preferences','first'];
  assert.equal(ids.length,sequence.length);assert.equal(new Set(ids).size,ids.length);
  const proofs:NativeProof[]=ids.map((id:string):NativeProof=>{const proof:NativeProof|undefined=current.proofs.get(id);assert.ok(proof,'Browser cannot invent a native checkpoint.');assert.equal(proof.routeKey,spec.key);assert.equal(proof.ownedRunId,handle.identity.runId);assert.equal(proof.actorId,outcome.nativeActorId);actors.add(proof.actorId);return proof;});
  assert.deepEqual(proofs.map(row=>row.scenario),sequence,'Every planned native scenario must be joined in its actual order.');
  assert.ok(proofs.every(row=>row.fixtureFingerprint===proofs[0].fixtureFingerprint));
  const column=outcome.optionalColumn as Row;assert.ok(column&&typeof column.key==='string');
  const preferences=proofs.filter(row=>row.scenario==='preferences').map(row=>row.preference as Row);assert.ok(preferences.every(row=>row&&Array.isArray(row.visibleColumns)));
  assert.equal((preferences[0].visibleColumns as string[]).includes(column.key),false);assert.equal((preferences[1].visibleColumns as string[]).includes(column.key),true);
  const baseline=proofs[0].preference as Row|null;
  if(baseline)assert.deepEqual([...(preferences[1].visibleColumns as string[])].sort(),[...(baseline.visibleColumns as string[])].sort());
  for(const key of ['querySearchEmptyNonempty','backAndReload','outOfRangeClamped','pageSizeChanged','domainFingerprintUnchanged'])assert.equal(outcome[key],true);
  assert.equal(outcome.pageUnion,spec.rowCount);assert.equal(column.persistedAndReloaded,true);assert.equal(column.semanticBaselineRestored,true);
  assert.equal(column.physicalInitialAbsenceRestored,baseline!==null);assert.ok(Array.isArray(outcome.rowEvidence)&&Array.isArray(outcome.remaining));
  used.push(...ids);summaries.push({routeKey:spec.key,consumerId:spec.consumerId,nativeCheckpoints:proofs.length,actorId:outcome.nativeActorId,fixtureFingerprint:proofs[0].fixtureFingerprint,sortBoundary:outcome.sortBoundary,filterBoundary:outcome.filterBoundary,remaining:outcome.remaining});
 }
 assert.equal(actors.size,1,'All route contexts must use the same exact native QA account.');assert.equal(new Set(used).size,used.length);
 assert.deepEqual([...used].sort(),[...current.proofs.keys()].sort(),'No native query checkpoint may be orphaned or substituted.');
 return {status:'pass' as const,ownedRunId:handle.identity.runId,contexts:summaries.length,nativeCheckpoints:used.length,actorId:[...actors][0],summaries,automaticCoverage:[],globalClosed:false,boundary:'All planned query/presentation journeys and native scenarios joined; explicit per-route partial capability limits remain.'};
}
