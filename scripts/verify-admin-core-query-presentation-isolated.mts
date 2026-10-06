import {createHash} from 'node:crypto';
import {assertCoreQueryBusyReceipt} from './fixtures/admin-core-query-presentation-journeys.mjs';
import {assertCoreRenderedAdoptionJoin} from './fixtures/admin-core-rendered-adoption.mjs';
import assert from 'node:assert/strict';
import { assertOwnedLocalHandle, type OwnedLocalHandle } from './lib/isolated-supabase.mts';
import { readCoreFixedQaActor } from './verify-admin-core-domain-readback-isolated.mts';
import { parseAdminEntityListRequestQuery, type AdminEntityListQueryContract } from '../src/lib/admin/entity-list/data-engine/contracts.ts';
import { CORE_QUERY_BUSY_SELECTION, CORE_QUERY_BUSY_SCENARIOS, assertCoreQueryBusySequence, selectCoreQueryPresentationPlan, loadCoreQueryPresentationPlan, coreQueryScenario, CORE_ACTIVITY_DATE_SCENARIOS, assertCoreActivityDateReceipts, CORE_QUERY_SEARCH_SCENARIOS, CORE_QUERY_STALE_SCENARIOS, assertCoreQueryStaleReceipts, coreQueryViewScenarios, assertCoreQueryViewReceipts, coreQuerySearchColumns, assertCoreQuerySearchReceipts, coreQueryExtraFilterCases, assertCoreQueryExtraFilterReceipts, coreQueryPreferenceScenario, assertCoreQueryColumnSortReceipts } from './fixtures/admin-core-query-presentation-plan.mjs';

type Row=Record<string,unknown>;
export type CoreQueryFixture={ search:string; ids:number[]; projectId?:number; stageId?:number; itemId?:number; filterOptions?:{category:{id:number;name:string};series?:{id:number;name:string}} };
export type CoreQueryFixtures={ queryClosure:{ contexts:Record<string,CoreQueryFixture> } };
type Plan=Array<{viewLink:{href:string;label:string;pageSourceSha256:string}|null;key:string;entity:string;consumerId:string;table:string;labelColumn:string;sortField:string;viewKey:string;type:string|null;level:string|null;kind:string|null;rowCount:number;filter:{key:string;value:string}|null;contract:AdminEntityListQueryContract<Record<string,unknown>,string>;publicPathFor(row:Record<string,unknown>):string|null;routeFor(fixture:CoreQueryFixture):string}>;
type NativeProof={id:string;routeKey:string;scenario:string;actorId:number;ownedRunId:string;fixtureFingerprint:string;preference:unknown;query:string;completeIds:number[];dateFilterProjection:unknown;searchProjection:unknown;extraFilterProjection:unknown;viewProjection:unknown;projectPublicationRows?:Row[]|null;busyReadOnlyFingerprint?:string;kind?:string;status?:string;route?:string;expectedIds?:number[];rows?:Row[]};
const state=new WeakMap<OwnedLocalHandle,{fixtures:CoreQueryFixtures;plan:Plan;mode:'full'|'busy';fingerprints:Map<string,string>;proofs:Map<string,NativeProof>;busyResponses:Map<string,Row>}>();
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
  current={fixtures,plan,mode:CORE_QUERY_BUSY_SCENARIOS.includes(request.scenario)?'busy':'full',fingerprints:new Map(),proofs:new Map(),busyResponses:new Map()};state.set(handle,current);
 }
 assert.equal(current.fixtures,fixtures,'Fixed fixture binding cannot change during the owned lifecycle.');
 assert.equal(current.proofs.has(request.id),false,'A native checkpoint ID cannot be replayed.');
 const spec=current.plan.find(row=>row.key===request.routeKey);assert.ok(spec,'Unknown registered route context.');
 const busy=CORE_QUERY_BUSY_SCENARIOS.includes(request.scenario);assert.equal(current.mode,busy?'busy':'full','A Busy-only handle cannot mix or borrow full matrix checkpoints.');if(busy)assertCoreQueryBusySequence(current.plan,[...current.proofs.values()],request);
 const fixture=fixtures.queryClosure.contexts[spec.key],scenario=busy?(request.scenario==='busy-before'||request.scenario==='busy-restored'?'first':'stale-held'):request.scenario,params=coreQueryScenario(spec,fixture,scenario);
 const query=parseAdminEntityListRequestQuery(spec.contract as AdminEntityListQueryContract<Record<string,unknown>,string>,params);
 const nativeSortField=request.scenario==='preferences-default'?query.sort.field:spec.sortField;
 if(request.scenario==='preferences-default'){assert.equal(spec.entity,'project_tracking_updates');assert.ok(spec.contract.sortFields.includes(nativeSortField));assert.deepEqual(query.sort,spec.contract.defaultSort);}
 const table=identifier(spec.table),label=identifier(spec.labelColumn),sort=identifier(nativeSortField);
 const base:string[]=[`${label} like $1`],values:unknown[]=[`%${fixture.search}%`];
 if(['topics','topic_categories','topic_series'].includes(spec.table))base.push('deleted_at is null');
 if(spec.entity==='topics_without_image')base.push("coalesce(image,'')=''");
 if(spec.type){values.push(spec.type);base.push(`type=$${values.length}`);}
 if(spec.level){values.push(spec.level);base.push(`level=$${values.length}`);}
 if(spec.kind==='stages'){values.push(fixture.projectId);base.push(`project_id=$${values.length}`);}
 if(spec.kind==='items'){values.push(fixture.stageId);base.push(`stage_id=$${values.length}`);}
 if(spec.kind==='updates'){values.push(fixture.itemId);base.push(`item_id=$${values.length}`);}
 const fullPredicate=base.join(' and '),filtered=[...base];
 const viewScenario=request.scenario.startsWith('view-'),viewTrash=viewScenario&&request.scenario!=='view-active-restored';if(viewTrash){assert.ok(['topics','categories','series'].includes(spec.entity));filtered.splice(0,filtered.length,'$1::text is not null','deleted_at is not null');}
 if(request.scenario==='empty')filtered.push('false');
 if(request.scenario==='filtered'||Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,request.scenario)){
  assert.ok(spec.filter);
  const clauses:Record<string,string>={topics:"status='unpublished'",categories:"status='unpublished'",series:"status='unpublished'",projects:"publication_status='unpublished'",redirects:"status='inactive'",activity_log:"entity_type='topic'",topics_without_image:"content_type='article'",admin_users:'is_active=false',project_tracking_stages:'is_visible=false',project_tracking_items:'is_visible=false',project_tracking_updates:"publication_status='draft'"};
  const clause=spec.level?'is_active=false':clauses[spec.entity];assert.ok(clause);filtered.push(clause);
 }
 const filteredValues=[...values];
 if(Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,request.scenario)){
  assert.equal(spec.entity,'activity_log');for(const[key,operator,time]of [['dateFrom','>=','T00:00:00.000Z'],['dateTo','<=','T23:59:59.999Z']]){
   const value=query.filters[key];if(value){assert.equal(typeof value,'string');filteredValues.push(value+time);filtered.push('created_at '+operator+' $'+filteredValues.length+'::timestamptz');}
  }
 }
 const searchScenario=CORE_QUERY_SEARCH_SCENARIOS.includes(scenario)||CORE_QUERY_STALE_SCENARIOS.includes(scenario);
 if(searchScenario){
  // Keep the independently registered fixture fingerprint query unchanged.
  // Search clear/short uses the complete canonical route scope, not the namespace subset.
  filtered.splice(0,filtered.length,'$1::text is not null',...base.slice(1));
  const columns=coreQuerySearchColumns(spec);
  if(query.search){
   const terms=spec.entity==='topics'?query.search.split(' ').filter(Boolean):[query.search];
   for(const term of terms){filteredValues.push(term);const parameter='$'+filteredValues.length+'::text';filtered.push('('+columns.map((column:string)=>"strpos(lower(coalesce("+identifier(column)+",'')),lower("+parameter+")) > 0").join(' or ')+')');}
  }
 }
 const extraFilterCase=request.scenario.startsWith('extra-filter-')?coreQueryExtraFilterCases(spec,fixture).find(row=>row.scenario===request.scenario):null;
 if(extraFilterCase?.phase==='applied'){
  const key=extraFilterCase.key,value=extraFilterCase.value;
  // Request values are derived from the fixed plan and owned fixture metadata,
  // never accepted from Browser input. Category descendants follow active taxonomy.
  if(key==='category'){
   assert.ok(['topics','series'].includes(spec.entity));filteredValues.push(Number(value));const parameter='$'+filteredValues.length;
   filtered.push('category_id in (with recursive selected(id) as (select id from public.topic_categories where id='+parameter+' and deleted_at is null union select child.id from public.topic_categories child join selected parent on child.parent_id=parent.id where child.deleted_at is null) select id from selected)');
  }else if(spec.entity==='topics'&&key==='series'){if(value==='any')filtered.push('series_id is not null');else{assert.match(value,/^[1-9]\d{0,8}$/u);assert.equal(Number(value),fixture.filterOptions?.series?.id);filteredValues.push(Number(value));filtered.push('series_id=$'+filteredValues.length);}}
  else if(spec.entity==='topics'&&key==='image'){assert.equal(value,'without');filtered.push("coalesce(image,'')=''");}
  else{
   const columns:Record<string,Record<string,string>>={topics:{content_type:'content_type',featured:'is_featured'},projects:{featured:'featured'},redirects:{type:'redirect_type'},activity_log:{actor:'actor_username',action:'action'},topics_without_image:{status:'status'},admin_users:{role:'role'},project_tracking_items:{status:'status'}};
   const column=columns[spec.entity]?.[key];assert.ok(column,'Unreviewed fixed native filter');filteredValues.push(key==='featured'?value==='yes':value);filtered.push(identifier(column)+'=$'+filteredValues.length);
  }
 }



 const direction=query.sort.direction==='asc'?'asc':'desc';
 const idDirection=spec.entity==='projects'?'desc':['topics','categories','series','pages','project_tracking_stages','project_tracking_items'].includes(spec.entity)?'asc':direction;
 return handle.withDatabaseConnection(async connection=>{
  await connection.query('begin isolation level repeatable read read only');
  try{
   const actorId=await readCoreFixedQaActor(connection);
   // One bounded set query and one independent complete fixture identity/hash.
   const cohort=(await connection.query(`select coalesce(jsonb_agg(id order by id),'[]'::jsonb) ids, md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) fingerprint from public.${table} t where ${fullPredicate}`,values)).rows[0];
   assert.deepEqual(cohort.ids,[...fixture.ids].sort((a,b)=>a-b),'Native complete search set must equal the pre-registered fixture IDs.');
   const fingerprint=String(cohort.fingerprint),previous=current.fingerprints.get(spec.key);
   if(previous)assert.equal(fingerprint,previous,'Read-only query/row information journeys must not mutate their domain rows.');
   let rows=(await connection.query(`select id,${label} label${spec.entity==='projects'?',slug,publication_status':spec.entity==='pages'?',path':spec.entity==='topics'?',views_count':spec.entity==='activity_log'?',created_at':''} from public.${table} where ${filtered.join(' and ')} order by ${sort} ${direction} nulls last,id ${idDirection}`,filteredValues)).rows;
   if(viewTrash&&spec.entity==='categories'){
    // Reuse the actual stable taxonomy tree reader. Independently reject any
    // missing, duplicate or active member against raw native trash membership.
    const rawById=new Map(rows.map(row=>[Number(row.id),row])),ordered:typeof rows=[];assert.equal(rawById.size,rows.length);assert.ok(rows.length<=5000);
    for(let page=1;page<=Math.max(1,Math.ceil(rows.length/query.pageSize));page++){
     const result=(await connection.query("select public.admin_list_categories($1,$2,'tree','asc','','all','trash') value",[page,query.pageSize])).rows[0].value as {rows:Row[];total_count:number;page:number};assert.equal(Number(result.total_count),rows.length);assert.equal(Number(result.page),page);assert.ok(Array.isArray(result.rows));for(const row of result.rows){assert.notEqual(row.deleted_at,null);const raw=rawById.get(Number(row.id));assert.ok(raw);ordered.push(raw);}
    }
    assert.equal(new Set(ordered.map(row=>Number(row.id))).size,rows.length);assert.deepEqual(ordered.map(row=>Number(row.id)).sort((a,b)=>a-b),[...rawById.keys()].sort((a,b)=>a-b));rows=ordered;
   }
   let viewProjection:Row|null=null;if(viewScenario){const domain=(await connection.query("select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) fingerprint from public."+table+' t')).rows[0],audit=(await connection.query("select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) fingerprint from public.admin_audit_logs a")).rows[0];viewProjection={scope:viewTrash?'full-current-trash':'active-namespace-restored',domainAuditFingerprint:String(domain.fingerprint)+':'+String(audit.fingerprint),completeIds:rows.map(row=>Number(row.id))};}
   assert.ok(rows.length<=((searchScenario||viewTrash)?5000:spec.rowCount),"Bounded isolated native route result exceeded its verification limit.");const ids=rows.map(row=>Number(row.id));
   const searchProjection=searchScenario?{scenario:request.scenario,normalizedSearch:query.search,columns:coreQuerySearchColumns(spec),scope:'full-registered-route',completeIds:ids}:null;
   const extraFilterProjection=extraFilterCase?{key:extraFilterCase.key,value:extraFilterCase.phase==='applied'?extraFilterCase.value:null,phase:extraFilterCase.phase,scope:'registered-fixture-namespace',completeIds:ids}:null;
   let dateFilterProjection=null;
   if(Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,request.scenario)){
    const dateFrom=String(query.filters.dateFrom??''),dateTo=String(query.filters.dateTo??''),lower=dateFrom?dateFrom+'T00:00:00.000Z':null,upper=dateTo?dateTo+'T23:59:59.999Z':null;
    const timestamps=rows.map(row=>({id:Number(row.id),createdAt:new Date(String(row.created_at)).toISOString()}));
    for(const row of timestamps){const instant=Date.parse(row.createdAt);assert.ok(Number.isFinite(instant));if(lower)assert.ok(instant>=Date.parse(lower));if(upper)assert.ok(instant<=Date.parse(upper));}
    dateFilterProjection={dateFrom,dateTo,lower,upper,timestamps};
   }
   let busyReadOnlyFingerprint:string|undefined;if(busy){const domain=(await connection.query("select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) fingerprint from public."+table+' t')).rows[0],audit=(await connection.query("select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) fingerprint from public.admin_audit_logs a")).rows[0];assert.match(String(domain.fingerprint),/^[a-f0-9]{32}$/u);assert.match(String(audit.fingerprint),/^[a-f0-9]{32}$/u);busyReadOnlyFingerprint=createHash('sha256').update(JSON.stringify({table:spec.table,domain:domain.fingerprint,audit:audit.fingerprint})).digest('hex');const prior=[...current.proofs.values()].find(row=>row.routeKey===spec.key);if(prior)assert.equal(busyReadOnlyFingerprint,prior.busyReadOnlyFingerprint,'Busy read and Information observation must preserve the complete registered domain and audit.');}
   const totalPages=Math.max(1,Math.ceil(rows.length/query.pageSize)),page=Math.min(query.page,totalPages),start=(page-1)*query.pageSize;
   const preferences=(await connection.query('select preferences from public.admin_user_preferences where admin_user_id=$1 and view_key=$2',[actorId,spec.viewKey])).rows;
   assert.ok(preferences.length<=1);
   const projectPublicationRows=spec.entity==='projects'?rows.slice(start,start+query.pageSize).map(row=>({id:Number(row.id),publicPath:spec.publicPathFor(row),publicationStatus:String(row.publication_status)})):null;
   if(projectPublicationRows)for(const row of projectPublicationRows)assert.ok(['published','unpublished'].includes(row.publicationStatus),'Native Project publication state must be canonical.');
   await connection.query('commit');current.fingerprints.set(spec.key,fingerprint);
   current.proofs.set(request.id,{id:request.id,routeKey:spec.key,scenario:request.scenario,actorId,ownedRunId:handle.identity.runId,fixtureFingerprint:fingerprint,preference:preferences[0]?.preferences??null,query:params.toString(),completeIds:ids,dateFilterProjection,searchProjection,extraFilterProjection,viewProjection,projectPublicationRows});
   const result={status:"pass" as const,ownedRunId:handle.identity.runId,id:request.id,kind:request.kind,routeKey:spec.key,scenario:request.scenario,entity:spec.entity,consumerId:spec.consumerId,actorId,route:spec.routeFor(fixture),query:params.toString(),
    expectedIds:ids.slice(start,start+query.pageSize),completeIds:ids,rows:rows.slice(start,start+query.pageSize).map(row=>({id:Number(row.id),label:String(row.label),publicPath:spec.publicPathFor(row),...(spec.entity==='projects'?{publicationStatus:String(row.publication_status)}:{}),...(spec.entity==='topics'?{information:{viewCount:Number(row.views_count??0)}}:{})})),
    pagination:{page,pageSize:query.pageSize,totalRows:rows.length,totalPages},dateFilterProjection,searchProjection,extraFilterProjection,viewProjection,fixtureFingerprint:fingerprint,preference:preferences[0]?.preferences??null,
    proofBoundary:busy?'Actual held registered read; complete registered domain and audit plus fixed QA preferences unchanged. No mutation or whole-axis credit.':'Native table order, complete isolated search set and same-run QA preference projection; no domain audit or unrelated capability proof is inferred.'};
   if(busy){assert.ok(busyReadOnlyFingerprint);const fields={busyReadOnlyFingerprint,kind:result.kind,status:result.status,route:result.route,expectedIds:result.expectedIds,rows:result.rows};Object.assign(current.proofs.get(request.id)!,fields);const response={...result,busyReadOnlyFingerprint};current.busyResponses.set(request.id,structuredClone(response));return response;}return result;
  }catch(error){await connection.query('rollback');throw error;}
 });
}

export function assertCoreProjectCopyPublicLinkCompletion(spec:{entity:string},outcome:Row,proofs:NativeProof[]){
 if(spec.entity!=='projects')return null;
 const rows=proofs[0]?.projectPublicationRows;assert.ok(Array.isArray(rows)&&rows.length>0,'Private native Project publication projection is required.');
 assert.deepEqual(proofs.at(-1)?.projectPublicationRows,rows,'Publication and path identities must remain unchanged after row actions.');
 assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
 for(const row of rows){assert.ok(Number.isSafeInteger(row.id)&&Number(row.id)>0);assert.ok(['published','unpublished'].includes(String(row.publicationStatus)));assert.ok(typeof row.publicPath==='string'&&row.publicPath.startsWith('/projects/'));}
 const unpublished=rows.find(row=>row.publicationStatus==='unpublished'),published=rows.find(row=>row.publicationStatus==='published');assert.ok(unpublished&&published);
 assert.ok(Array.isArray(outcome.rowEvidence));const copies=(outcome.rowEvidence as Row[]).filter(row=>row.kind==='copyPublicLink');assert.equal(copies.length,2,'Exactly the disabled and actual published copy observations are required.');
 assert.deepEqual(copies[0],{kind:'copyPublicLink',nativeEntityId:unpublished.id,publicationStatus:'unpublished',mode:'disabled-current-publication-state',disabledReason:'انشر المشروع أولًا قبل نسخ الرابط العام.'});
 const origin=copies[1].origin;assert.equal(typeof origin,'string');const url=new URL(String(origin));assert.ok(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password);assert.equal(url.origin,origin);
 assert.deepEqual(copies[1],{kind:'copyPublicLink',nativeEntityId:published.id,publicationStatus:'published',mode:'actual-clipboard-only-no-navigation',copiedPath:published.publicPath,origin});
 return{status:'pass',unpublishedEntityId:unpublished.id,publishedEntityId:published.id,copiedPath:published.publicPath,domainPublicationUnchanged:true};
}

/** Same-handle aggregate join, after the Browser gate; no new query or inferred coverage. */
export function verifyCoreQueryPresentationCompletion(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);assert.ok(input&&typeof input==='object');const browser=input as Row;
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.cohort,'query-presentation');assert.deepEqual(browser.errors,[]);
 const result=browser.queryPresentation as Row;assert.ok(result&&result.status==='pass'&&Array.isArray(result.outcomes));assert.ok(Array.isArray(browser.evidence));
 const current=state.get(handle);assert.ok(current,'No native query checkpoints ran on this owned handle.');
 const outcomes=result.outcomes as Row[],evidence=browser.evidence as Row[];
 const selectedPlan=selectCoreQueryPresentationPlan(current.plan,browser.journeySelection??null) as Plan;
 assert.deepEqual(outcomes.map(row=>row.routeKey).sort(),selectedPlan.map(row=>row.key).sort(),'Every selected current route context must complete exactly once.');
 const used:string[]=[],actors=new Set<number>(),summaries:Row[]=[];
 for(const spec of selectedPlan){
  const outcome=outcomes.find(row=>row.routeKey===spec.key)!;assert.equal(outcome.consumerId,spec.consumerId);assert.equal(outcome.entity,spec.entity);
  const receipts=evidence.filter(row=>row.id==='core-query-presentation-'+spec.key);assert.equal(receipts.length,1);assert.equal(receipts[0].status,'pass');
  for(const[key,value]of Object.entries(outcome))assert.deepEqual(receipts[0][key],value,'Outcome must match its final successful Browser receipt.');
  assert.ok(Array.isArray(outcome.nativeCheckpointIds));const ids=outcome.nativeCheckpointIds as string[];
  const column=outcome.optionalColumn as Row;assert.ok(column&&typeof column.key==='string');
  const transition=column.sortTransition as Row;assert.ok(transition);
  const preferenceScenario=coreQueryPreferenceScenario(spec,column.key,transition.activeHeadersBefore);
  const sequence:string[]=['first','empty',...CORE_QUERY_SEARCH_SCENARIOS,...CORE_QUERY_STALE_SCENARIOS,'second','third','clamp','wide','descending',...(spec.filter?['filtered']:[]),...(spec.entity==='activity_log'?Object.keys(CORE_ACTIVITY_DATE_SCENARIOS):[]),...coreQueryExtraFilterCases(spec,current.fixtures.queryClosure.contexts[spec.key]).map(row=>row.scenario),...coreQueryViewScenarios(spec),preferenceScenario,preferenceScenario,'first'];
  assert.equal(ids.length,sequence.length);assert.equal(new Set(ids).size,ids.length);
  const proofs:NativeProof[]=ids.map((id:string):NativeProof=>{const proof:NativeProof|undefined=current.proofs.get(id);assert.ok(proof,'Browser cannot invent a native checkpoint.');assert.equal(proof.routeKey,spec.key);assert.equal(proof.ownedRunId,handle.identity.runId);assert.equal(proof.actorId,outcome.nativeActorId);actors.add(proof.actorId);return proof;});
  assert.deepEqual(proofs.map(row=>row.scenario),sequence,'Every planned native scenario must be joined in its actual order.');
  assert.ok(proofs.every(row=>row.fixtureFingerprint===proofs[0].fixtureFingerprint));
  const searchBoundary=assertCoreQuerySearchReceipts(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key]);
  const staleRead=assertCoreQueryStaleReceipts(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key]);
  const viewLinks=assertCoreQueryViewReceipts(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key]);
  const extraFilters=assertCoreQueryExtraFilterReceipts(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key]);
  const datePicker=assertCoreActivityDateReceipts(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key]);
  const columnSort=assertCoreQueryColumnSortReceipts(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key]);
  const preferences=proofs.filter(row=>['preferences','preferences-default'].includes(row.scenario)).map(row=>row.preference as Row);assert.ok(preferences.every(row=>row&&Array.isArray(row.visibleColumns)));
  assert.equal((preferences[0].visibleColumns as string[]).includes(column.key),false);assert.equal((preferences[1].visibleColumns as string[]).includes(column.key),true);
  const baseline=proofs[0].preference as Row|null;
  if(baseline)assert.deepEqual([...(preferences[1].visibleColumns as string[])].sort(),[...(baseline.visibleColumns as string[])].sort());
  for(const key of ['querySearchEmptyNonempty','backAndReload','outOfRangeClamped','pageSizeChanged','domainFingerprintUnchanged'])assert.equal(outcome[key],true);
  assert.equal(outcome.pageUnion,spec.rowCount);assert.equal(column.persistedAndReloaded,true);assert.equal(column.semanticBaselineRestored,true);
  assert.equal(column.physicalInitialAbsenceRestored,baseline!==null);assert.ok(Array.isArray(outcome.rowEvidence)&&Array.isArray(outcome.remaining));
  const projectCopyPublicLink=assertCoreProjectCopyPublicLinkCompletion(spec,outcome,proofs);
  used.push(...ids);summaries.push({routeKey:spec.key,consumerId:spec.consumerId,nativeCheckpoints:proofs.length,actorId:outcome.nativeActorId,fixtureFingerprint:proofs[0].fixtureFingerprint,sortBoundary:outcome.sortBoundary,filterBoundary:outcome.filterBoundary,datePicker,searchBoundary,staleRead,viewLinks,extraFilters,projectCopyPublicLink,columnSort,remaining:outcome.remaining});
 }
 assert.equal(actors.size,1,'All route contexts must use the same exact native QA account.');assert.equal(new Set(used).size,used.length);
 assert.deepEqual([...used].sort(),[...current.proofs.keys()].sort(),'No native query checkpoint may be orphaned or substituted.');
 return {status:'pass' as const,ownedRunId:handle.identity.runId,contexts:summaries.length,nativeCheckpoints:used.length,actorId:[...actors][0],summaries,automaticCoverage:[],globalClosed:false,boundary:'All planned query/presentation journeys and native scenarios joined; explicit per-route partial capability limits remain.'};
}

/** Same handle, opt-in Busy-only completion; full matrix remains a separate branch. */
export function verifyCoreQueryBusyCompletion(handle:OwnedLocalHandle,input:unknown,nativeInput:unknown,formManifest:unknown){
 assertOwnedLocalHandle(handle);assert.ok(input&&typeof input==='object');const browser=input as Row,current=state.get(handle);assert.ok(current&&current.mode==='busy');
 assert.ok(nativeInput&&typeof nativeInput==='object');const native=nativeInput as Row;assert.equal(native.status,'pass');assert.equal(native.ownedRunId,handle.identity.runId);assert.ok(Array.isArray(native.records));assert.deepEqual([...current.busyResponses.keys()],[...current.proofs.keys()]);assert.deepEqual(native.records,[...current.busyResponses.values()],'The raw native artifact must equal every full same-handle Busy response in actual order.');
 assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'query-presentation');assert.equal(browser.journeySelection,CORE_QUERY_BUSY_SELECTION);assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);assert.deepEqual(browser.errors,[]);assert.match(String(browser.sourceSha256),/^[a-f0-9]{64}$/u);
 const result=browser.queryPresentation as Row;assert.ok(result&&result.status==='pass'&&Array.isArray(result.outcomes));assert.equal(result.wholeCohortExecuted,false);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);const outcomes=result.outcomes as Row[],evidence=browser.evidence as Row[];assert.ok(Array.isArray(evidence));
 const ids=current.plan.map(spec=>'core-query-busy-'+spec.key);assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);assert.deepEqual(result.selectedJourneyIds,ids);assert.deepEqual(outcomes.map(row=>row.routeKey),current.plan.map(spec=>spec.key));assert.deepEqual(evidence.map(row=>row.id),['existing-auth-login',...ids]);assert.ok(evidence.every(row=>row.status==='pass'&&Array.isArray(row.coverage)&&row.coverage.length===0));
 const login=evidence[0];assert.equal(login.authenticated,true);assert.equal(login.sessionArtifactWritten,false);assert.match(String(login.dashboardState),/^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
 const used:string[]=[],actors=new Set<number>(),summaries:Row[]=[];
 for(const [index,spec]of current.plan.entries()){
  const outcome=outcomes[index];for(const[key,value]of Object.entries(outcome))assert.deepEqual(evidence[index+1][key],value);assert.equal(outcome.ownedRunId,handle.identity.runId);assert.ok(Array.isArray(outcome.nativeCheckpointIds));const nativeIds=outcome.nativeCheckpointIds as string[];
  const proofs=nativeIds.map(id=>{const proof=current.proofs.get(id);assert.ok(proof,'Busy outcome cannot invent a native checkpoint.');assert.equal(proof.ownedRunId,handle.identity.runId);actors.add(proof.actorId);return proof;});
  const summary=assertCoreQueryBusyReceipt(outcome,proofs,spec,current.fixtures.queryClosure.contexts[spec.key],browser.sourceSha256);used.push(...nativeIds);summaries.push(summary);
 }
 assert.equal(actors.size,1);assert.equal(new Set(used).size,used.length);assert.deepEqual(used,[...current.proofs.keys()],'All native Busy requests must be consumed once in exact execution order.');assert.equal(used.length,current.plan.length*CORE_QUERY_BUSY_SCENARIOS.length);
 const topics=current.plan.find(spec=>spec.key==='topics');assert.ok(topics);const renderedAdoption=assertCoreRenderedAdoptionJoin({browser,sourceSha256:browser.sourceSha256,formManifest,expected:[{journeyId:'core-query-busy-topics',observationId:'atomic-topics-information-scroll',axis:'scrollbar',bindings:[{boundary:'form',consumer:'list-bulk-row-one-shot-actions',surface:'row-command'}],routePathname:topics.routeFor(current.fixtures.queryClosure.contexts.topics)}]});
 return {status:'pass' as const,ownedRunId:handle.identity.runId,selection:CORE_QUERY_BUSY_SELECTION,contexts:summaries.length,nativeCheckpoints:used.length,actorId:[...actors][0],summaries,renderedAdoption,automaticCoverage:[],globalClosed:false,boundary:'Only actual held registered reads and Topics shared Information scrollbar; native complete registered domain plus audit remained unchanged. No full query matrix or lifecycle credit.'};
}
