import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { ProjectSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";
import { PROJECT_CONTROL_KINDS, PROJECT_CONTROL_PHASES, PROJECT_CONTROL_TABLES, PROJECT_CONTROL_ASSETS, projectControlSlug, validateProjectControlsRequest, assertProjectControlGraph } from "./fixtures/admin-core-project-controls-contract.mjs";

type Row=Record<string,unknown>;
type Tables=Record<string,Row[]>;
type ChildTable="project_location_points"|"project_features"|"project_floor_plans"|"project_floor_plan_details"|"project_delivery_items"|"project_media"|"project_videos";
const childTables=PROJECT_CONTROL_TABLES as ChildTable[];
type Graph={project:Row}&Record<ChildTable,Row[]>;
type Fixtures={projects:Array<{kind:string;id:number;slug:string;editPath:string}>;assets:Array<{id:string;objectKey:string;publicUrl:string;displayName:string}>};
type State={actorId:number;fixtures:Fixtures;originals:Map<string,Graph>;expected:Tables;assets:Row[];phases:Map<string,number>;auditHeads:Map<string,number>;saved:Map<string,Graph>;nativeReads:number;writes:number};
const states=new WeakMap<OwnedLocalHandle,State>();
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const readTables=async(handle:OwnedLocalHandle)=>{const rows:Tables={};for(const name of ["projects",...PROJECT_CONTROL_TABLES])rows[name]=(await handle.query("select * from public."+name+" order by id")).rows;return rows;};
const readAssets=async(handle:OwnedLocalHandle)=>(await handle.query("select * from public.media_assets order by id")).rows;
function graph(tables:Tables,id:number):Graph {
 const project=tables.projects.find(row=>Number(row.id)===id);assert.ok(project);const result={project} as Graph;
 const planIds=new Set(tables.project_floor_plans.filter(row=>Number(row.project_id)===id).map(row=>Number(row.id)));
 for(const table of childTables)result[table]=tables[table].filter(row=>table==="project_floor_plan_details"?planIds.has(Number(row.floor_plan_id)):Number(row.project_id)===id);
 return result;
}
function others(tables:Tables,id:number,planIds:Set<number>){return Object.fromEntries(Object.entries(tables).map(([table,rows])=>[table,rows.filter(row=>table==="projects"?Number(row.id)!==id:table==="project_floor_plan_details"?!planIds.has(Number(row.floor_plan_id)):Number(row.project_id)!==id)]));}
/** Read-only registration of the two existing unpublished canonical Projects. */
export async function prepareCoreProjectControlsFixtures(handle:OwnedLocalHandle,credentials:{username:string}) {
 assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);
 const actors=(await handle.query("select id from public.admin_users where username=$1 and is_active",[credentials.username])).rows;assert.equal(actors.length,1);
 const tables=await readTables(handle),projects:Fixtures["projects"]=[],originals=new Map<string,Graph>();
 for(const kind of PROJECT_CONTROL_KINDS){const rows=tables.projects.filter(row=>row.slug===projectControlSlug(kind));assert.equal(rows.length,1);const row=rows[0];assert.equal(row.type,kind);assert.equal(row.publication_status,"unpublished");
  const id=Number(row.id),g=graph(tables,id);assert.deepEqual(childTables.map(table=>g[table].length),[1,3,2,4,2,3,0],"Use the canonical initial aggregate, never reset a changed fixture.");
  assert.equal(g.project_location_points[0].kind,"road");assert.ok(g.project_media.every(row=>row.section==="gallery"));projects.push({kind,id,slug:String(row.slug),editPath:"/admin/projects/"+id});originals.set(kind,g);
 }
 const assetRows=(await handle.query("select id,object_key,public_url,display_name from public.admin_media_assets_catalog where object_key=any($1::text[]) and provider='filesystem' and bucket='public' and status='active' and reconciliation_state='synced'",[PROJECT_CONTROL_ASSETS])).rows;
 const assets=PROJECT_CONTROL_ASSETS.map(key=>{const rows=assetRows.filter(row=>row.object_key===key);assert.equal(rows.length,1);const row=rows[0];assert.equal(row.public_url,"/"+key);return{id:String(row.id),objectKey:key,publicUrl:String(row.public_url),displayName:String(row.display_name)};});
 const fixtures={projects,assets};states.set(handle,{actorId:Number(actors[0].id),fixtures,originals,expected:tables,assets:await readAssets(handle),phases:new Map(PROJECT_CONTROL_KINDS.map(kind=>[kind,0])),auditHeads:new Map(),saved:new Map(),nativeReads:0,writes:0});return fixtures;
}
export async function readCoreProjectControlsCheckpoint(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);const request=validateProjectControlsRequest(input) as {id:string;kind:string;recipe:string;phase:string};const s=states.get(handle);assert.ok(s);
 const{recipe,phase}=request;assert.equal(phase,PROJECT_CONTROL_PHASES[s.phases.get(recipe)!],"No skipped/replayed phase.");const target=s.fixtures.projects.find(row=>row.kind===recipe)!;
 const currentTables=await readTables(handle),current=graph(currentTables,target.id),original=s.originals.get(recipe)!;
 const planIds=new Set([...s.expected.project_floor_plans,...currentTables.project_floor_plans].filter(row=>Number(row.project_id)===target.id).map(row=>Number(row.id)));
 assert.deepEqual(others(currentTables,target.id,planIds),others(s.expected,target.id,planIds),"Every other Project and child graph remains unchanged.");
 assert.equal((await handle.query("select count(*)::int n from public.project_floor_plan_details d left join public.project_floor_plans p on p.id=d.floor_plan_id where p.id is null")).rows[0].n,0,"No orphan detail after aggregate deletion.");
 assert.deepEqual(await readAssets(handle),s.assets,"Selecting/removing links must not mutate Catalog assets or Storage.");
 if(phase==="baseline")s.auditHeads.set(recipe,Number((await handle.query("select coalesce(max(id),0)::bigint id from public.admin_audit_logs")).rows[0].id));
 const audit=(await handle.query("select id,actor_admin_user_id,action,entity_type,entity_id,entity_label,metadata from public.admin_audit_logs where id>$1 and entity_type='project' and entity_id=$2 order by id",[s.auditHeads.get(recipe),target.id])).rows;
 if(["baseline","draft","negative","serverRejected"].includes(phase)){assert.deepEqual(current,original);assert.equal(audit.length,0);}
 else if(phase==="emptyDraft"){assert.deepEqual(current,s.saved.get(recipe));assert.equal(audit.length,0,"Deletion remains a draft until explicit save.");}
 else {
  assertProjectControlGraph(current,original,s.fixtures,phase==="emptySaved"||phase==="emptyReloaded");
  const seo=loadEntitySeoPersistenceOwner(),derived=seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(current.project as ProjectSeoSource));for(const[key,value]of Object.entries(derived))assert.deepEqual(current.project[key],value,"Canonical persisted SEO: "+key);
  if(phase==="saved"||phase==="emptySaved"){
   assert.equal(audit.length,1,"Exactly one authenticated Action commits exactly one audit row.");assert.equal(audit[0].action,"project.update");assert.equal(Number(audit[0].actor_admin_user_id),s.actorId);assert.equal(audit[0].entity_label,original.project.arabic_name);
   const metadata=audit[0].metadata as Row;assert.equal(metadata.slug,target.slug);assert.equal(metadata.type,recipe);assert.equal(metadata.aggregateContract,"project_admin_entry_v2");assert.equal(metadata.mutationSource,"form_save");assert.equal(metadata.nextPublicationStatus,"unpublished");
   s.auditHeads.set(recipe,Number(audit[0].id));s.saved.set(recipe,current);s.expected=currentTables;s.writes++;
  }else{assert.deepEqual(current,s.saved.get(recipe));assert.equal(audit.length,0,"Reload cannot commit again.");}
 }
 s.phases.set(recipe,s.phases.get(recipe)!+1);s.nativeReads++;
 return{...request,status:"pass",graphHash:hash(current),otherGraphsHash:hash(others(currentTables,target.id,planIds)),childCounts:Object.fromEntries(childTables.map(table=>[table,current[table].length])),auditCount:audit.length,actorBound:true,published:false,storageWrites:false};
}
export function assertCoreProjectControlsCompleted(handle:OwnedLocalHandle){
 assertOwnedLocalHandle(handle);const s=states.get(handle);assert.ok(s);for(const kind of PROJECT_CONTROL_KINDS)assert.equal(s.phases.get(kind),PROJECT_CONTROL_PHASES.length,"Incomplete Project recipe: "+kind);
 assert.equal(s.writes,4);assert.equal(s.nativeReads,18);return{status:"pass",recipes:2,exactWrites:s.writes,nativeCheckpoints:s.nativeReads,actorBound:true,allRemainUnpublished:true,optionalGraphsEmpty:true,automaticAxisCoverage:[],globalClosed:false,cleanupRequired:true};
}
