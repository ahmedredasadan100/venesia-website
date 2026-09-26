import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { TEMPLATE_CONTROL_RECIPES, TEMPLATE_CONTROL_PHASES, validateTemplateControlsRequest, assertTemplateControlsProjection } from "./fixtures/admin-core-template-controls-contract.mjs";

type Row = Record<string, unknown>;
type Kind = keyof typeof TEMPLATE_CONTROL_RECIPES;
type PublicFixtures = {
  templates: Array<{kind: Kind;id:number;name:string;slug:string}>;
  category:{id:number;name:string;slug:string};otherCategory:{id:number;name:string;slug:string};
  series:{id:number;name:string;slug:string};article:{id:number;title:string};news:{id:number;title:string};
};
type State = { actorId:number;fixtures:PublicFixtures;tables:Record<Kind,Row[]>;assignmentRows:Row[];phases:Record<Kind,number>;auditHeads:Partial<Record<Kind,number>>;last:Partial<Record<Kind,Row>>;nativeReads:number;writes:number };
const states = new WeakMap<OwnedLocalHandle,State>();
const hash = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ids = (row:Row) => ({id:Number(row.id),name:String(row.name),slug:String(row.slug)});
const queryTable = async(handle:OwnedLocalHandle,kind:Kind) => (await handle.query("select * from public."+TEMPLATE_CONTROL_RECIPES[kind].table+" order by id")).rows;
const assignments = async(handle:OwnedLocalHandle) => (await handle.query("select * from public.page_composition_assignments order by kind,id")).rows;

/** Read-only opt-in after canonical Public/Admin fixtures. No new seed or credentials artifact. */
export async function prepareCoreTemplateControlsFixtures(handle:OwnedLocalHandle,credentials:{username:string}) {
  assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);
  const actor=(await handle.query("select id from public.admin_users where username=$1 and is_active",[credentials.username])).rows;
  assert.equal(actor.length,1);
  const categories=(await handle.query("select id,name,slug from public.topic_categories where slug=any($1::text[]) and status='published' and is_active order by slug",[["qa-admin-category-1","qa-admin-category-2"]])).rows;
  assert.equal(categories.length,2,"Canonical isolated categories must exist before B4.");
  const series=(await handle.query("select id,name,slug from public.topic_series where slug='qa-admin-series' and category_id=$1 and status='published'",[categories[0].id])).rows;
  assert.equal(series.length,1);
  const article=(await handle.query("select id,title from public.topics where slug='isolated-public-property-ownership' and category_id=$1 and content_type='article' and status='published' and deleted_at is null",[categories[0].id])).rows;
  assert.equal(article.length,1);
  const news=(await handle.query("select id,title from public.topics where content_type='news' and status='published' and deleted_at is null order by id limit 1")).rows;
  assert.equal(news.length,1,"Canonical published Media fixtures must exist before the source-switch recipe.");
  const templates:PublicFixtures["templates"]=[],tables={} as State["tables"],phases={} as State["phases"];
  const assignmentRows=await assignments(handle);
  for(const kind of Object.keys(TEMPLATE_CONTROL_RECIPES) as Kind[]){
    tables[kind]=await queryTable(handle,kind);
    const rows=tables[kind].filter(row=>row.slug==="qa-admin-page-interaction-"+kind+"-8");
    assert.equal(rows.length,1,"Reserve the existing eighth unused fixture for "+kind);
    const row=rows[0];assert.ok(!assignmentRows.some(item=>item.kind===kind.replaceAll("-","_")&&Number(item.template_id)===Number(row.id)),"Control fixture must be physically unassigned.");
    templates.push({kind,...ids(row)});phases[kind]=0;
  }
  const fixtures:PublicFixtures={templates,category:ids(categories[0]),otherCategory:ids(categories[1]),series:ids(series[0]),article:{id:Number(article[0].id),title:String(article[0].title)},news:{id:Number(news[0].id),title:String(news[0].title)}};
  states.set(handle,{actorId:Number(actor[0].id),fixtures,tables,assignmentRows,phases,auditHeads:{},last:{},nativeReads:0,writes:0});
  return fixtures;
}

export async function readCoreTemplateControlsCheckpoint(handle:OwnedLocalHandle,input:unknown){
  assertOwnedLocalHandle(handle);
  const request=validateTemplateControlsRequest(input) as {id:string;kind:string;recipe:Kind;phase:string};
  const s=states.get(handle);assert.ok(s);
  const {recipe:kind,phase}=request;
  assert.equal(phase,TEMPLATE_CONTROL_PHASES[s.phases[kind]],"No phase may be skipped, replayed or promoted out of order.");
  const target=s.fixtures.templates.find(row=>row.kind===kind)!;
  const rows=await queryTable(handle,kind),before=s.tables[kind],current=rows.find(row=>Number(row.id)===target.id),original=before.find(row=>Number(row.id)===target.id);
  assert.ok(current&&original);
  assert.deepEqual(rows.filter(row=>Number(row.id)!==target.id),before.filter(row=>Number(row.id)!==target.id),"Other templates in the same physical table must remain byte-equivalent.");
  assert.deepEqual(await assignments(handle),s.assignmentRows,"Template controls may not create or mutate public assignments.");
  if(phase==="baseline")s.auditHeads[kind]=Number((await handle.query("select coalesce(max(id),0)::bigint id from public.admin_audit_logs")).rows[0].id);
  const audit=(await handle.query("select id,actor_admin_user_id,action,entity_type,entity_id,entity_label,metadata from public.admin_audit_logs where id>$1 and entity_type='content_block_template' and entity_id=$2 order by id",[s.auditHeads[kind],target.id])).rows;
  if(["baseline","draft","negative"].includes(phase)){
    assert.deepEqual(current,original,"Unsaved, clamped, cancelled or rejected controls must not mutate persistence.");
    assert.equal(audit.length,0,"No phantom audit event for an uncommitted draft.");
  }else{
    const allowed=new Set(["config","updated_at",...(kind==="feed"?["feed_type"]:kind==="media-sidebar"?["widget_key"]:kind==="media-hub"?["section_key"]:[])]);
    assert.deepEqual(Object.fromEntries(Object.entries(current).filter(([key])=>!allowed.has(key))),Object.fromEntries(Object.entries(original).filter(([key])=>!allowed.has(key))),"Authored config update preserves physical identity and metadata.");
    assertTemplateControlsProjection(kind,current,s.fixtures);
    if(phase==="saved"){
      assert.equal(audit.length,1,"Exactly one authenticated canonical save must create exactly one audit row.");
      assert.equal(Number(audit[0].actor_admin_user_id),s.actorId);
      assert.equal(audit[0].action,"content_block_template.update");
      assert.equal(audit[0].entity_label,original.name);
      assert.equal((audit[0].metadata as Row)?.blockType,kind);
      s.writes++;s.auditHeads[kind]=Number(audit[0].id);s.last[kind]=current;
    }else{
      assert.equal(audit.length,0,"Reload is a read and must not manufacture another save.");
      assert.deepEqual(current,s.last[kind]);
    }
  }
  s.phases[kind]++;s.nativeReads++;
  return {id:request.id,kind:request.kind,recipe:kind,phase,status:"pass",rowHash:hash(current),otherRowsHash:hash(rows.filter(row=>Number(row.id)!==target.id)),auditCount:audit.length,actorBound:true,assignmentGraphUnchanged:true};
}

export function assertCoreTemplateControlsCompleted(handle:OwnedLocalHandle){
  assertOwnedLocalHandle(handle);const s=states.get(handle);assert.ok(s);
  const kinds=Object.keys(TEMPLATE_CONTROL_RECIPES) as Kind[];
  for(const kind of kinds)assert.equal(s.phases[kind],TEMPLATE_CONTROL_PHASES.length,"Incomplete concrete recipe cannot be promoted: "+kind);
  assert.equal(s.writes,kinds.length);assert.equal(s.nativeReads,kinds.length*TEMPLATE_CONTROL_PHASES.length);
  return {status:"pass",recipes:kinds.length,exactWrites:s.writes,nativeCheckpoints:s.nativeReads,actorBound:true,publicAssignmentsUnchanged:true,automaticAxisCoverage:[],globalClosed:false,cleanupBoundary:"No additional resources seeded; parent must still prove owned lifecycle cleanup."};
}

