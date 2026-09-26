import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createJiti } from "jiti";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { PRESENTATION_CONTROL_KINDS, PRESENTATION_CONTROL_PHASES, PRESENTATION_CONTROL_TABLES, PRESENTATION_CONTROL_ASSETS, validatePresentationControlsRequest, presentationControlForm, loadPresentationControlBuilders, assertPresentationControlsConfig, assertPresentationControlsRow } from "./fixtures/admin-core-presentation-controls-contract.mjs";
type Row=Record<string,unknown>;
type Kind="hero"|"content";
type Fixtures={templates:Array<{kind:Kind;id:number;name:string;slug:string;editPath:string}>;assets:Array<{id:string;objectKey:string;publicUrl:string;displayName:string}>};
type State={actorId:number;fixtures:Fixtures;originals:Record<Kind,Row[]>;expected:Record<Kind,Row[]>;assignments:Row[];assets:Row[];configs:Record<Kind,unknown>;phases:Record<Kind,number>;auditHeads:Partial<Record<Kind,number>>;saved:Partial<Record<Kind,Row>>;nativeReads:number;writes:number};
const states=new WeakMap<OwnedLocalHandle,State>();
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tables=async(handle:OwnedLocalHandle)=>{const result={} as Record<Kind,Row[]>;for(const kind of PRESENTATION_CONTROL_KINDS as Kind[])result[kind]=(await handle.query("select * from public."+PRESENTATION_CONTROL_TABLES[kind]+" order by id")).rows;return result;};
const assignments=async(handle:OwnedLocalHandle)=>(await handle.query("select * from public.page_composition_assignments order by kind,id")).rows;
const assets=async(handle:OwnedLocalHandle)=>(await handle.query("select * from public.media_assets order by id")).rows;
/** Read-only registration of two already-seeded, physically unused templates. */
export async function prepareCorePresentationControlsFixtures(handle:OwnedLocalHandle,credentials:{username:string}){
 assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);
 const actor=(await handle.query("select id from public.admin_users where username=$1 and is_active",[credentials.username])).rows;assert.equal(actor.length,1);
 const original=await tables(handle),links=await assignments(handle),templates:Fixtures["templates"]=[];
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});const {getContentModuleEditorKey}=await jiti.import<typeof import("../src/lib/page-blocks/module-edit-registry.ts")>("../src/lib/page-blocks/module-edit-registry.ts");
 for(const kind of PRESENTATION_CONTROL_KINDS as Kind[]){const rows=original[kind].filter(row=>row.slug==="qa-admin-page-interaction-"+kind+"-8");assert.equal(rows.length,1);const row=rows[0],id=Number(row.id);assert.ok(Number.isSafeInteger(id)&&id>0);assert.equal(row.status,"published");assert.equal(links.some(link=>link.kind===kind&&Number(link.template_id)===id),false,"Use the existing unused template, never mutate assignments to make a fixture.");
  if(kind==="hero")assert.equal(row.variant,"internal-page");else assert.equal(getContentModuleEditorKey(String(row.slug),String(row.variant??"")),"generic");
  templates.push({kind,id,name:String(row.name),slug:String(row.slug),editPath:"/admin/pages-blocks/blocks/"+kind+"/"+id});
 }
 const catalog=(await handle.query("select id,object_key,public_url,display_name from public.admin_media_assets_catalog where object_key=any($1::text[]) and provider='filesystem' and bucket='public' and status='active' and reconciliation_state='synced'",[PRESENTATION_CONTROL_ASSETS])).rows;
 const fixtureAssets=PRESENTATION_CONTROL_ASSETS.map(key=>{const rows=catalog.filter(row=>row.object_key===key);assert.equal(rows.length,1);assert.equal(rows[0].public_url,"/"+key);return{id:String(rows[0].id),objectKey:key,publicUrl:String(rows[0].public_url),displayName:String(rows[0].display_name)};});
 const fixtures={templates,assets:fixtureAssets},builder=await loadPresentationControlBuilders(),configs={} as Record<Kind,unknown>;
 for(const kind of PRESENTATION_CONTROL_KINDS as Kind[]){configs[kind]=builder.build(kind,presentationControlForm(kind,fixtures));assertPresentationControlsConfig(kind,configs[kind],fixtures);}
 states.set(handle,{actorId:Number(actor[0].id),fixtures,originals:original,expected:original,assignments:links,assets:await assets(handle),configs,phases:{hero:0,content:0},auditHeads:{},saved:{},nativeReads:0,writes:0});return fixtures;
}
export async function readCorePresentationControlsCheckpoint(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);const request=validatePresentationControlsRequest(input) as {id:string;kind:string;recipe:Kind;phase:string};const s=states.get(handle);assert.ok(s);const{recipe,phase}=request;assert.equal(phase,PRESENTATION_CONTROL_PHASES[s.phases[recipe]],"No phase may be skipped, repeated or promoted out of order.");
 const target=s.fixtures.templates.find(row=>row.kind===recipe)!,currentTables=await tables(handle),current=currentTables[recipe].find(row=>Number(row.id)===target.id),original=s.originals[recipe].find(row=>Number(row.id)===target.id);assert.ok(current&&original);
 for(const kind of PRESENTATION_CONTROL_KINDS as Kind[])assert.deepEqual(currentTables[kind].filter(row=>kind!==recipe||Number(row.id)!==target.id),s.expected[kind].filter(row=>kind!==recipe||Number(row.id)!==target.id),"Every other Hero/Content template remains unchanged.");
 assert.deepEqual(await assignments(handle),s.assignments,"No public composition assignment changes.");assert.deepEqual(await assets(handle),s.assets,"Media picker linkage does not upload or mutate Catalog/Storage.");
 if(phase==="baseline")s.auditHeads[recipe]=Number((await handle.query("select coalesce(max(id),0)::bigint id from public.admin_audit_logs")).rows[0].id);
 const audit=(await handle.query("select id,actor_admin_user_id,action,entity_type,entity_id,entity_label,metadata from public.admin_audit_logs where id>$1 and entity_type='content_block_template' and entity_id=$2 order by id",[s.auditHeads[recipe],target.id])).rows;
 if(["baseline","draft","negative","serverRejected"].includes(phase)){assert.deepEqual(current,original,"Draft, semantic rejection and cancelled database statement leave the complete physical row unchanged.");assert.equal(audit.length,0);}
 else{
  assertPresentationControlsRow(recipe,current,original,s.configs[recipe]);assertPresentationControlsConfig(recipe,current.config,s.fixtures);
  if(phase==="saved"){
   assert.equal(audit.length,1);assert.equal(audit[0].action,"content_block_template.update");assert.equal(Number(audit[0].actor_admin_user_id),s.actorId);assert.equal(audit[0].entity_label,original.name);const meta=audit[0].metadata as Row;assert.equal(meta.slug,target.slug);if(recipe==="hero")assert.equal(meta.blockType,"hero");else{assert.equal(meta.variant,current.variant);assert.equal(meta.projects_hub,false);}
   s.auditHeads[recipe]=Number(audit[0].id);s.saved[recipe]=current;s.expected=currentTables;s.writes++;
  }else{assert.equal(audit.length,0);assert.deepEqual(current,s.saved[recipe],"Reload is read-only and preserves the exact committed row.");}
 }
 s.phases[recipe]++;s.nativeReads++;return{...request,status:"pass",rowHash:hash(current),allTemplatesHash:hash(currentTables),auditCount:audit.length,actorBound:true,assignmentGraphUnchanged:true,catalogUnchanged:true};
}
export function assertCorePresentationControlsCompleted(handle:OwnedLocalHandle){assertOwnedLocalHandle(handle);const s=states.get(handle);assert.ok(s);for(const kind of PRESENTATION_CONTROL_KINDS as Kind[])assert.equal(s.phases[kind],PRESENTATION_CONTROL_PHASES.length);assert.equal(s.writes,2);assert.equal(s.nativeReads,12);return{status:"pass",recipes:2,exactWrites:2,nativeCheckpoints:12,actorBound:true,publicAssignmentsUnchanged:true,catalogUnchanged:true,automaticAxisCoverage:[],globalClosed:false,cleanupRequired:true};}
