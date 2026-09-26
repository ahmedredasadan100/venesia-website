import assert from "node:assert/strict";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";

/** One physical unpublished, imageless row for the registered read-only report. */
export async function seedCoreReadonlyFixture(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const slug="qa-core-readonly-without-image",title="QA Core Readonly Without Image";
  assert.equal((await handle.query("select id from public.topics where slug=$1",[slug])).rows.length,0);
  const source=(await handle.query("select * from public.topics where slug='isolated-public-property-ownership' and deleted_at is null")).rows[0];assert.ok(source);
  const columns=(await handle.query("select attname from pg_catalog.pg_attribute where attrelid='public.topics'::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='' and attname<>'id' order by attnum")).rows.map(row=>String(row.attname));
  assert.ok(columns.length>10&&columns.every(column=>/^[a-z_][a-z0-9_]*$/.test(column)));
  const row={...source,slug,title,status:"unpublished",published_at:null,image:"",image_alt:null,is_featured:false,deleted_at:null};
  const seo=loadEntitySeoPersistenceOwner();
  Object.assign(row,seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)));
  const select=columns.map(column=>'"'+column+'"').join(',');
  const inserted=(await handle.query(`insert into public.topics(${select}) select ${select} from jsonb_populate_record(null::public.topics,$1::jsonb) returning id`,[JSON.stringify(row)])).rows[0];
  return {id:Number(inserted.id),title,slug};
}

/** Fixed projections of actual API rows; no arbitrary table, column or query input. */
export async function verifyCoreReadonlyReadback(handle: OwnedLocalHandle,browser:{status:string;readOnlyReadback:unknown[]}) {
  assertOwnedLocalHandle(handle);assert.equal(browser.status,"pass");assert.ok(Array.isArray(browser.readOnlyReadback));
  assert.deepEqual(browser.readOnlyReadback.map(value=>(value as {entity:string}).entity).sort(),["activity_log","topics_without_image"]);
  const evidence=[];
  for(const input of browser.readOnlyReadback){
    const row=input as {entity:string;rows:Array<Record<string,unknown>>};assert.ok(Array.isArray(row.rows)&&row.rows.length>0&&row.rows.length<=50);
    const ids=row.rows.map(record=>Number(record.id));assert.ok(ids.every(id=>Number.isSafeInteger(id)&&id>0));assert.equal(new Set(ids).size,ids.length);
    const fields=row.entity==="activity_log"?["id","actor_admin_user_id","action","entity_type","entity_id","entity_label"]:["id","title","slug","status","contentType"];
    for(const record of row.rows)assert.deepEqual(Object.keys(record).sort(),[...fields].sort());
    const query=row.entity==="activity_log"?"select jsonb_build_object('id',id,'actor_admin_user_id',actor_admin_user_id,'action',action,'entity_type',entity_type,'entity_id',entity_id,'entity_label',nullif(entity_label,'')) value from public.admin_audit_logs where id=any($1::bigint[])":"select jsonb_build_object('id',id,'title',title,'slug',slug,'status',status,'contentType',content_type) value from public.topics where id=any($1::bigint[]) and deleted_at is null and (image is null or image='')";
    const actual=(await handle.query(query,[ids])).rows.map(value=>value.value as Record<string,unknown>).sort((a,b)=>Number(a.id)-Number(b.id));
    assert.deepEqual(actual,[...row.rows].sort((a,b)=>Number(a.id)-Number(b.id)),"Actual read-only API projection must equal its native source rows.");
    evidence.push({entity:row.entity,actual,nativeProjectionMatched:true});
  }
  return {status:"pass",evidence,scope:"Two registered read-only consumers: real authenticated API projections joined to native state; no mutation contract is inferred."};
}
