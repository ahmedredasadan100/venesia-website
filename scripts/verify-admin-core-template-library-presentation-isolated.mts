import {createJiti} from 'jiti';
const productLoader=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
const {asCardsConfig}=productLoader('../src/lib/page-blocks/configs.ts') as typeof import('../src/lib/page-blocks/configs.ts');
const {linkDefaultFromContainer}=productLoader('../src/lib/admin/links/link-defaults.ts') as typeof import('../src/lib/admin/links/link-defaults.ts');
const {deserializeAdminLink}=productLoader('../src/lib/admin/links/serialize.ts') as typeof import('../src/lib/admin/links/serialize.ts');
import { assertCoreRenderedAdoptionJoin } from './fixtures/admin-core-rendered-adoption.mjs';
import assert from 'node:assert/strict';
import { formatAdminDateTime } from '../src/lib/content-dates.ts';
import { createHash } from 'node:crypto';
import { assertOwnedLocalHandle, type OwnedLocalHandle } from './lib/isolated-supabase.mts';
import { readCoreFixedQaActor } from './verify-admin-core-domain-readback-isolated.mts';
import { loadCoreTemplatePresentationPlan, assertCoreTemplatePresentationProjection, buildCoreTemplateSearchProjection, assertCoreTemplateSearchObservation } from './fixtures/admin-core-template-library-presentation-plan.mjs';

type Row=Record<string,unknown>;
type Sort={key:string;columnKey:string;label:string};
type SearchProjection={mode:string;minLength:number;sourceHashes:Record<string,string>;cases:Array<{id:string;query:string;groups:number[][]}>};
type Spec={pageSizeOptions:number[];searchMinLength:number;searchSourceHashes:Record<string,string>;searchProjection(rows:Row[],query:string):number[][];kind:string;consumer:string;route:string;table:string;viewKey:string;defaults:string[];rowCount:number;pageSize:number;sorts:Sort[];variants:string[][];detailField:string|null;detailValues:string[];expectedIds(rows:Row[],key?:string|null,direction?:string):number[];sortValue(row:Row,key:string):unknown;statusLabel(value:string):{label:string}};
type Fixture={search:string;ids:number[]};
type Proof={id:string;moduleKind:string;phase:string;actorId:number;ownedRunId:string;fingerprint:string;preference:Row;rows:Row[];search:SearchProjection};
type State={plan:Spec[];actorId:number;fixtures:Record<string,Fixture>;original:Map<string,Row|null>;proofs:Map<string,Proof>;baseline:Map<string,string>;cleaned:boolean};
export function coreTemplateLinkPreviewValues(kind:string,row:Row){return kind==='cards'?(asCardsConfig(row.config).items??[]).map(item=>deserializeAdminLink(linkDefaultFromContainer(item as Record<string,unknown>))).filter(value=>value.link_kind!=='none'):[];}
const states=new WeakMap<OwnedLocalHandle,State>();
const identifier=(value:string)=>{assert.match(value,/^[a-z][a-z0-9_]*$/);return '"'+value+'"';};
export function validateCoreTemplatePresentationRequest(input:unknown){
 assert.ok(input&&typeof input==='object'&&!Array.isArray(input));const row=input as Row;assert.deepEqual(Object.keys(row).sort(),['id','kind','moduleKind','phase']);
 assert.match(String(row.id),/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);assert.equal(row.kind,'template-library-presentation-state');
 assert.ok(typeof row.moduleKind==='string');assert.ok(['before','columns-hidden','columns-restored','after'].includes(String(row.phase)));
 return row as {id:string;kind:string;moduleKind:string;phase:string};
}

/** Explicit fixture opt-in, only for the already-owned template-library cohort.
 * Template clones remain in the disposable DB; only the nine QA preferences
 * are restored to their exact pre-fixture state by the matching cleanup. */
export async function seedOwnedCoreTemplatePresentationFixture(handle:OwnedLocalHandle,fixtures:Row){
 assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);const plan=await loadCoreTemplatePresentationPlan() as Spec[];
 const pages=fixtures.pages as {templates:Array<{kind:string;id:number;assigned:boolean}>};assert.ok(Array.isArray(pages?.templates));
 const namespace='qa-library-presentation-'+createHash('sha256').update(handle.identity.runId).digest('hex').slice(0,12);
 const current:State={plan,actorId:0,fixtures:{},original:new Map(),proofs:new Map(),baseline:new Map(),cleaned:false};
 await handle.withDatabaseConnection(async connection=>{
  await connection.query('begin');try{
   current.actorId=await readCoreFixedQaActor(connection);
   for(const spec of plan){
    const sources=pages.templates.filter(row=>row.kind===spec.kind&&!row.assigned);assert.ok(sources.length>=2);const source=sources[1];assert.ok(Number.isSafeInteger(source.id)&&source.id>0);
    const search=namespace+'-'+spec.kind,table=identifier(spec.table);
    assert.equal((await connection.query(`select count(*)::int count from public.${table} where name like $1`,['%'+search+'%'])).rows[0].count,0);
    const columnRows=(await connection.query('select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated=\'\' and attname<>\'id\' order by attnum',['public.'+spec.table])).rows;
    const columns=columnRows.map(row=>String(row.attname)),quoted=columns.map(identifier).join(',');
    const patches=Array.from({length:spec.rowCount},(_,index)=>{
     const ordinal=index+1,variant=spec.variants.length?spec.variants[index%spec.variants.length][0]:undefined;
     const patch:Row={name:search+' Name '+String(spec.rowCount+1-ordinal).padStart(2,'0'),slug:search+'-slug-'+String((index*7)%spec.rowCount+1).padStart(2,'0'),status:index%2?'published':'unpublished',sort_order:900000+ordinal,
      created_at:'2026-01-01T00:00:00.000Z',updated_at:new Date(Date.UTC(2026,0,1,0,0,(index*5)%spec.rowCount)).toISOString()};
     if(columns.includes('variant')&&variant!==undefined)patch.variant=variant;
     if(spec.kind==='feed')patch.feed_type=variant;
     if(spec.detailField)patch[spec.detailField]=spec.detailValues[index%spec.detailValues.length];
     if(spec.kind==='featured')patch.presentationVariant=variant;
     return patch;
    });
    // Clone only the fixed native source row. Dynamic identifiers derive from
    // the checked canonical source plan and the actual owned table catalog.
    const result=await connection.query(`insert into public.${table} (${quoted}) select ${columns.map(column=>'r.'+identifier(column)).join(',')} from public.${table} source cross join jsonb_array_elements($2::jsonb) patch cross join lateral jsonb_populate_record(null::public.${table},to_jsonb(source)||(patch-'presentationVariant')||case when patch ? 'presentationVariant' then jsonb_build_object('config',jsonb_set(source.config,'{presentation,variant}',patch->'presentationVariant',true)) else '{}'::jsonb end) r where source.id=$1 returning id,name,sort_order`,[source.id,JSON.stringify(patches)]);
    assert.equal(result.rows.length,spec.rowCount);current.fixtures[spec.kind]={search,ids:result.rows.sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).map(row=>Number(row.id))};
    const original=(await connection.query('select to_jsonb(p) value from public.admin_user_preferences p where admin_user_id=$1 and view_key=$2',[current.actorId,spec.viewKey])).rows;assert.ok(original.length<=1);current.original.set(spec.kind,(original[0]?.value??null) as Row|null);
    await connection.query('insert into public.admin_user_preferences(admin_user_id,view_key,preferences) values($1,$2,$3::jsonb) on conflict(admin_user_id,view_key) do update set preferences=excluded.preferences',[current.actorId,spec.viewKey,JSON.stringify({visibleColumns:spec.defaults})]);
   }
   await connection.query('commit');
  }catch(error){await connection.query('rollback');throw error;}
 });
 states.set(handle,current);return {templateLibraryPresentation:{namespace,contexts:current.fixtures,rowsPerLibrary:plan[0].rowCount,originalPreferencesCleanupRequired:true}};
}

export async function readCoreTemplatePresentationCheckpoint(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);const request=validateCoreTemplatePresentationRequest(input),current=states.get(handle);assert.ok(current&&!current.cleaned,'Opted-in fixture must exist and remain active.');
 assert.equal(current.proofs.has(request.id),false);const spec=current.plan.find(row=>row.kind===request.moduleKind);assert.ok(spec);const fixture=current.fixtures[spec.kind];
 const sequence=['before','columns-hidden','columns-restored','after'];const completed=[...current.proofs.values()].filter(row=>row.moduleKind===spec.kind);assert.equal(request.phase,sequence[completed.length],'Native phases cannot be skipped, repeated or reordered.');
 return handle.withDatabaseConnection(async connection=>{
  await connection.query('begin isolation level repeatable read read only');try{
   const actorId=await readCoreFixedQaActor(connection);assert.equal(actorId,current.actorId);
   const table=identifier(spec.table),all=(await connection.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) fingerprint from public.${table} t`)).rows[0];
   const audit=(await connection.query("select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) fingerprint from public.admin_audit_logs a")).rows[0];
   const fingerprint=String(all.fingerprint)+':'+String(audit.fingerprint);if(current.baseline.has(spec.kind))assert.equal(fingerprint,current.baseline.get(spec.kind),'Information, sort, pagination, edit navigation and preferences cannot mutate templates or audit.');
   const rows=(await connection.query(`select to_jsonb(t) value from public.${table} t where name like $1 order by sort_order,id`,['%'+fixture.search+'%'])).rows.map(row=>row.value as Row);assert.deepEqual(rows.map(row=>Number(row.id)),fixture.ids);
   // Full bounded dataset is read in the same readonly snapshot. Only IDs and
   // source-derived matching groups leave this owner; full row values stay private.
   const boundedRows=(await connection.query('select to_jsonb(t) value from public.'+table+' t order by sort_order,id')).rows.map(row=>row.value as Row);
   const search=buildCoreTemplateSearchProjection(spec,boundedRows,fixture.search) as SearchProjection;
   if(spec.kind==='hero')assert.equal((await connection.query('select count(*)::int count from public.hero_assignments where hero_id=any($1::bigint[])',[fixture.ids])).rows[0].count,0);
   for(const sort of spec.sorts)assert.ok(new Set(rows.map(row=>String(spec.sortValue(row,sort.key)))).size>1,'Native fixture must distinguish every currently rendered sort.');
   const preferences=(await connection.query('select preferences from public.admin_user_preferences where admin_user_id=$1 and view_key=$2',[actorId,spec.viewKey])).rows;assert.equal(preferences.length,1);const preference=preferences[0].preferences as Row;
   assert.deepEqual(Object.keys(preference),['visibleColumns']);assert.deepEqual([...(preference.visibleColumns as string[])].sort(),spec.defaults.filter((key:string)=>request.phase!=='columns-hidden'||key!=='status').sort());
   await connection.query('commit');current.baseline.set(spec.kind,fingerprint);const proof:Proof={id:request.id,moduleKind:spec.kind,phase:request.phase,actorId,ownedRunId:handle.identity.runId,fingerprint,preference,rows,search};current.proofs.set(request.id,proof);
   // Return only authored fixture fields needed for the current displayed sort
   // and information assertions; full-table content stays inside the owner.
   return {status:'pass',kind:request.kind,id:request.id,moduleKind:spec.kind,phase:request.phase,ownedRunId:handle.identity.runId,actorId,fingerprint,preference,search,
    rows:rows.map(row=>({linkPreviewValues:coreTemplateLinkPreviewValues(spec.kind,row),id:Number(row.id),name:String(row.name),slug:String(row.slug),status:String(row.status),updated_at:String(row.updated_at??''),sortValues:Object.fromEntries(spec.sorts.map(sort=>[sort.key,spec.sortValue(row,sort.key)])),statusLabel:spec.statusLabel(String(row.status)).label,...(spec.kind==='content'?{formattedUpdatedAt:formatAdminDateTime(String(row.updated_at))}:{}),...(spec.kind==='hero'?{assignedPageCount:0}:{})})),
    orderedIds:fixture.ids,sorts:spec.sorts.map(sort=>({...sort,ascending:spec.expectedIds(rows,sort.key,'asc'),descending:spec.expectedIds(rows,sort.key,'desc'),reset:spec.expectedIds(rows)}))};
  }catch(error){await connection.query('rollback');throw error;}
 });
}

/** Must run in the existing runner's finally, even if Browser fails. */
export async function restoreOwnedCoreTemplatePresentationPreferences(handle:OwnedLocalHandle){
 assertOwnedLocalHandle(handle);const current=states.get(handle);assert.ok(current&&!current.cleaned);
 await handle.withDatabaseConnection(async connection=>{await connection.query('begin');try{
  for(const spec of current.plan){const original=current.original.get(spec.kind);assert.notEqual(original,undefined);
   await connection.query('delete from public.admin_user_preferences where admin_user_id=$1 and view_key=$2',[current.actorId,spec.viewKey]);
   if(original)await connection.query('insert into public.admin_user_preferences select * from jsonb_populate_record(null::public.admin_user_preferences,$1::jsonb)',[JSON.stringify(original)]);
   const after:Row[]=(await connection.query('select to_jsonb(p) value from public.admin_user_preferences p where admin_user_id=$1 and view_key=$2',[current.actorId,spec.viewKey])).rows;assert.deepEqual(after.map(row=>row.value),original?[original]:[]);
  }await connection.query('commit');current.cleaned=true;
 }catch(error){await connection.query('rollback');throw error;}});
 return {status:'pass',ownedRunId:handle.identity.runId,actorId:current.actorId,exactOriginalPreferenceRowsOrAbsenceRestored:current.plan.length};
}

export function verifyCoreTemplatePresentationCompletion(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);const current=states.get(handle);assert.ok(current&&current.cleaned,'Exact preference cleanup must complete before final promotion.');const browser=input as Row;
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.cohort,'template-libraries');assert.deepEqual(browser.errors,[]);assert.ok(Array.isArray(browser.evidence));
 const evidence=(browser.evidence as Row[]).filter(row=>String(row.id).startsWith('core-template-presentation-'));assert.deepEqual(evidence.map(row=>row.moduleKind).sort(),current.plan.map(row=>row.kind).sort());const used:string[]=[];
 for(const spec of current.plan){const row=evidence.find(value=>value.moduleKind===spec.kind)!;assert.equal(row.id,'core-template-presentation-'+spec.kind);assert.equal(row.status,'pass');assert.equal(row.consumer,spec.consumer);assert.equal(row.nativeActorId,current.actorId);assert.ok(Array.isArray(row.nativeCheckpointIds));const ids=row.nativeCheckpointIds as string[];assert.equal(ids.length,4);
  const proofs:Proof[]=ids.map((id):Proof=>{const proof:Proof|undefined=current.proofs.get(id);assert.ok(proof);assert.equal(proof.moduleKind,spec.kind);assert.equal(proof.actorId,current.actorId);assert.equal(proof.ownedRunId,handle.identity.runId);return proof;});assert.deepEqual(proofs.map(proof=>proof.phase),['before','columns-hidden','columns-restored','after']);assert.ok(proofs.every(proof=>proof.fingerprint===proofs[0].fingerprint));
  assert.deepEqual(proofs[3].search,proofs[0].search,'Search projections must remain unchanged across the entire Browser journey.');
  assertCoreTemplateSearchObservation(spec,proofs[0].search,row.searchEvidence,{beforeCheckpointId:proofs[0].id,afterCheckpointId:proofs[3].id,actorId:current.actorId,ownedRunId:handle.identity.runId,moduleKind:spec.kind,consumer:spec.consumer});
  assertCoreTemplatePresentationProjection(spec,proofs[0].rows,row);assert.equal(row.preferencePosts,2);
  const read=row.readOnlyEdit as {owner:string;count:number;payloadSha256:string[];actionIdSha256:string|null};assert.ok(read);assert.equal(read.owner,'src/lib/admin/links/actions.ts#resolveAdminLinkAjax');if(read.count)assert.match(read.actionIdSha256!,/^[a-f0-9]{64}$/u);else assert.equal(read.actionIdSha256,null);
  const expected=coreTemplateLinkPreviewValues(spec.kind,proofs[0].rows[0]).map(value=>JSON.stringify([value])).sort();assert.equal(read.count,expected.length);assert.deepEqual(read.payloadSha256,expected.map(value=>createHash('sha256').update(value).digest('hex')));
  for(const key of ['backAndReload','pageSizeChanged','outOfRangeClamped','optionalHeaderAndCellsRestored','informationNativeFields','ownedEditNavigation','domainAndAuditUnchanged'])assert.equal(row[key],true);assert.equal(row.copyPublicLink,'hidden-by-current-contract');assert.deepEqual(row.automaticCoverage,[]);used.push(...ids);
 }
 assert.equal(new Set(used).size,used.length);assert.deepEqual([...used].sort(),[...current.proofs.keys()].sort());const renderedAdoption=assertCoreRenderedAdoptionJoin({browser,sourceSha256:browser.sourceSha256,expected:current.plan.map(spec=>({journeyId:'core-template-presentation-'+spec.kind,observationId:'template-library-'+spec.kind+'-scrollbar',axis:'scrollbar',bindings:[{boundary:'collection',consumer:spec.consumer,surface:spec.route}],routePathname:spec.route}))});return {status:'pass',renderedAdoption,libraries:current.plan.length,sortKeys:current.plan.reduce((sum,spec)=>sum+spec.sorts.length,0),nativeCheckpoints:used.length,searchObservations:current.plan.reduce((sum,spec)=>sum+[...current.proofs.values()].find(proof=>proof.moduleKind===spec.kind&&proof.phase==='before')!.search.cases.length,0),actorId:current.actorId,exactPreferenceCleanup:true,automaticCoverage:[],globalClosed:false};
}
