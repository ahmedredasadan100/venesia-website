import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";
import { TOPIC_CONTROL_KINDS, TOPIC_CONTROL_PHASES, TOPIC_CONTROL_ASSET_KEYS, coreSelectedTopicControlKinds, coreTopicControlFixtureSlug, validateTopicControlsRequest, assertTopicControlsProjection } from "./fixtures/admin-core-topic-controls-contract.mjs";

type Row = Record<string, unknown>;
type Fixture = { topics: Array<{id:number;kind:string;title:string;slug:string;editPath:string}>; assets:Array<{id:string;objectKey:string;publicUrl:string;displayName:string}>;category:{id:number;name:string;slug:string};otherCategory:{id:number;name:string;slug:string};series:{id:number;name:string;slug:string} };
type State = { actorId:number;fixtures:Fixture;originals:Map<string,Row>;expectedTopics:Row[];assets:Row[];phases:Map<string,number>;auditHeads:Map<string,number>;saved:Map<string,Row>;nativeReads:number;writes:number };
const states=new WeakMap<OwnedLocalHandle,State>();
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const topics=async(handle:OwnedLocalHandle)=>(await handle.query("select * from public.topics order by id")).rows;
const assets=async(handle:OwnedLocalHandle)=>(await handle.query("select * from public.media_assets order by id")).rows;
const identity=(row:Row)=>({id:Number(row.id),name:String(row.name),slug:String(row.slug)});

/** Fixed, unpublished synthetic rows only. Called by the existing opt-in fixture owner. */
export async function prepareCoreTopicControlsFixtures(handle:OwnedLocalHandle,credentials:{username:string}) {
  assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);
  const actor=(await handle.query("select id from public.admin_users where username=$1 and is_active",[credentials.username])).rows;assert.equal(actor.length,1);
  const categories=(await handle.query("select id,name,slug from public.topic_categories where slug=any($1::text[]) and status='published' and deleted_at is null order by slug",[["qa-admin-category-1","qa-admin-category-2"]])).rows;assert.equal(categories.length,2);
  const series=(await handle.query("select id,name,slug from public.topic_series where slug='qa-admin-series' and status='published' and deleted_at is null and category_id=$1",[categories[0].id])).rows;assert.equal(series.length,1);
  const assetRows=(await handle.query("select id,object_key,public_url,display_name from public.admin_media_assets_catalog where object_key=any($1::text[]) and provider='filesystem' and bucket='public' and status='active' and reconciliation_state='synced'",[TOPIC_CONTROL_ASSET_KEYS])).rows;
  assert.equal(assetRows.length,TOPIC_CONTROL_ASSET_KEYS.length,"Use existing canonical files; do not create substitute Storage objects.");
  const fixtures:Fixture={topics:[],assets:TOPIC_CONTROL_ASSET_KEYS.map(key=>{const matches=assetRows.filter(row=>row.object_key===key);assert.equal(matches.length,1);const row=matches[0];assert.equal(row.public_url,"/"+key);return{id:String(row.id),objectKey:key,publicUrl:String(row.public_url),displayName:String(row.display_name)};}),category:identity(categories[0]),otherCategory:identity(categories[1]),series:identity(series[0])};
  const seo=loadEntitySeoPersistenceOwner();
  await handle.withDatabaseConnection(async connection=>{
    await connection.query("begin");let committed=false;
    try {
      const source=(await connection.query("select * from public.topics where slug='isolated-public-property-ownership' and deleted_at is null")).rows;assert.equal(source.length,1);
      const columns=(await connection.query("select attname from pg_catalog.pg_attribute where attrelid='public.topics'::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='' and attname<>'id' order by attnum")).rows.map(row=>String(row.attname));
      assert.ok(columns.length>10&&columns.every(column=>/^[a-z_][a-z0-9_]*$/u.test(column)));
      const projection=columns.map(column=>'"'+column+'"').join(",");
      for(const kind of TOPIC_CONTROL_KINDS){
        const slug=coreTopicControlFixtureSlug(kind),title="عناصر نموذج المحتوى "+kind;
        assert.equal((await connection.query("select id from public.topics where slug=$1",[slug])).rows.length,0,"Never overwrite existing fixture identity.");
        const row:Row={...source[0],slug,title,content_type:kind,status:"unpublished",published_at:null,published_by:null,date_label:null,deleted_at:null,
          image:"",image_alt:"",og_image:null,og_image_alt:"",canonical_url:null,media_project:null,faq:[],is_featured:false,is_popular:false,
          media_payload:kind==="video"?{kind:"video",provider:"youtube",video_url:"",thumbnail:null,duration:null}:kind==="gallery"?{kind:"gallery",images:[]}:null,
          category_id:fixtures.category.id,category:fixtures.category.name,category_slug:fixtures.category.slug,series_id:null,series:null,series_slug:null,
          created_at:"2026-01-01T00:00:00.000Z",updated_at:"2026-01-01T00:00:00.000Z",created_by:Number(actor[0].id),updated_by:Number(actor[0].id)};
        Object.assign(row,seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as TopicSeoSource)));
        const id=Number((await connection.query("insert into public.topics("+projection+") select "+projection+" from jsonb_populate_record(null::public.topics,$1::jsonb) returning id",[JSON.stringify(row)])).rows[0].id);
        fixtures.topics.push({id,kind,title,slug,editPath:"/admin/content/topics/"+id});
      }
      await connection.query("commit");committed=true;
    } finally {if(!committed)await connection.query("rollback");}
  });
  const allTopics=await topics(handle),originals=new Map(fixtures.topics.map(item=>[item.kind,allTopics.find(row=>Number(row.id)===item.id)!]));
  assert.ok([...originals.values()].every(Boolean));
  states.set(handle,{actorId:Number(actor[0].id),fixtures,originals,expectedTopics:allTopics,assets:await assets(handle),phases:new Map(TOPIC_CONTROL_KINDS.map(kind=>[kind,0])),auditHeads:new Map(),saved:new Map(),nativeReads:0,writes:0});
  return fixtures;
}
export async function readCoreTopicControlsCheckpoint(handle:OwnedLocalHandle,input:unknown){
  assertOwnedLocalHandle(handle);const request=validateTopicControlsRequest(input) as {id:string;kind:string;recipe:string;phase:string};
  const s=states.get(handle);assert.ok(s);const {recipe:kind,phase}=request;
  assert.equal(phase,TOPIC_CONTROL_PHASES[s.phases.get(kind)!],"Fixed phases cannot be skipped/replayed.");
  const target=s.fixtures.topics.find(row=>row.kind===kind)!;const all=await topics(handle),current=all.find(row=>Number(row.id)===target.id),original=s.originals.get(kind)!;assert.ok(current);
  assert.deepEqual(all.filter(row=>Number(row.id)!==target.id),s.expectedTopics.filter(row=>Number(row.id)!==target.id),"Other content must remain unchanged.");
  assert.deepEqual(await assets(handle),s.assets,"Selecting existing files never edits the Catalog.");
  const references=(await handle.query("select * from public.media_references where domain_key='topics' and entity_type='topic' and entity_identity=$1 order by id",[String(target.id)])).rows;
  // Current Topics owner does not adopt legacy filesystem identities. Managed
  // Supabase-reference behavior has its own Media cohort and is not claimed here.
  assert.equal(references.length,0,"Do not manufacture a managed reference for legacy filesystem-only fields.");
  if(phase==="baseline")s.auditHeads.set(kind,Number((await handle.query("select coalesce(max(id),0)::bigint id from public.admin_audit_logs")).rows[0].id));
  const audit=(await handle.query("select id,actor_admin_user_id,action,entity_type,entity_id,entity_label,metadata from public.admin_audit_logs where id>$1 and entity_type='topic' and entity_id=$2 order by id",[s.auditHeads.get(kind),target.id])).rows;
  if(["baseline","draft","negative","serverRejected"].includes(phase)){assert.deepEqual(current,original);assert.equal(audit.length,0,"Rejected/unsaved UI cannot record a save.");}
  else{
    assertTopicControlsProjection(kind,current,original,s.fixtures,s.actorId);
    const seo=loadEntitySeoPersistenceOwner(),expectedSeo=seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(current as TopicSeoSource));
    for(const[key,value]of Object.entries(expectedSeo))assert.deepEqual(current[key],value,"Persisted SEO follows actual content fields: "+key);
    if(phase==="saved"){
      assert.equal(audit.length,1);assert.equal(audit[0].action,"topic.update");assert.equal(Number(audit[0].actor_admin_user_id),s.actorId);assert.equal(audit[0].entity_label,original.title);
      assert.equal((audit[0].metadata as Row).slug,target.slug);assert.equal((audit[0].metadata as Row).status,"unpublished");
      s.saved.set(kind,current);s.auditHeads.set(kind,Number(audit[0].id));s.expectedTopics=all;s.writes++;
    }else{assert.deepEqual(current,s.saved.get(kind));assert.equal(audit.length,0,"Reload cannot repeat the save.");}
  }
  s.phases.set(kind,s.phases.get(kind)!+1);s.nativeReads++;
  return {...request,status:"pass",rowHash:hash(current),otherRowsHash:hash(all.filter(row=>Number(row.id)!==target.id)),auditCount:audit.length,actorBound:true,published:false,legacyFilesystemReferenceCount:0,managedReferenceProofClaimed:false};
}
export function assertCoreTopicControlsCompleted(handle:OwnedLocalHandle, selection: string | null = null){
  assertOwnedLocalHandle(handle);const s=states.get(handle);assert.ok(s);
  const selected = coreSelectedTopicControlKinds(selection);
  for(const kind of TOPIC_CONTROL_KINDS)assert.equal(s.phases.get(kind),selected.includes(kind)?TOPIC_CONTROL_PHASES.length:0,"Selected recipes must finish; retained recipes must not replay: "+kind);
  assert.equal(s.writes,selected.length);assert.equal(s.nativeReads,selected.length*TOPIC_CONTROL_PHASES.length);
  return {status:"pass",recipes:s.writes,exactWrites:s.writes,nativeCheckpoints:s.nativeReads,actorBound:true,allRemainUnpublished:true,managedReferenceProofClaimed:false,automaticAxisCoverage:[],globalClosed:false,cleanupRequired:true};
}
