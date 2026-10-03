import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertOwnedLocalHandle,type OwnedLocalHandle } from '../lib/isolated-supabase.mts';
import { loadEntitySeoPersistenceOwner } from '../backfill-entity-seo-scores.mts';
import { readCoreFixedQaActor } from '../verify-admin-core-domain-readback-isolated.mts';
import type { TopicSeoSource,PageSeoSource } from '../../src/lib/admin/seo/entity-seo-persistence.ts';

type Row=Record<string,unknown>;
type Target={id:number;label:string;slug:string};
type SourceFixtures={topic:{id:number};category:{id:number};series:{id:number};pages:{pageId:number}};
/** Explicit existing-owner opt-in. Nine independent disposable domain rows. */
export async function prepareCoreDomainBulkFixtures(handle:OwnedLocalHandle,fixtures:SourceFixtures){
 assertOwnedLocalHandle(handle);const actorId=await readCoreFixedQaActor(handle),namespace='qa-b2-'+randomUUID().slice(0,8),seo=loadEntitySeoPersistenceOwner();
 const output:{namespace:string;actorId:number;destination:Target;topics:Target[];categories:Target[];series:Target[];pages:Target[]}={namespace,actorId,destination:{id:0,label:'',slug:''},topics:[],categories:[],series:[],pages:[]};
 await handle.withDatabaseConnection(async db=>{
  await db.query('begin');let committed=false;
  try{
   const category=(await db.query("insert into public.topic_categories(name,slug,status,is_active,show_in_menu) values($1,$2,'published',true,false) returning id",[namespace+' destination',namespace+'-destination'])).rows[0];
   output.destination={id:Number(category.id),label:namespace+' destination',slug:namespace+'-destination'};
   const entries=[['topics','topics',fixtures.topic.id],['categories','topic_categories',fixtures.category.id],['series','topic_series',fixtures.series.id],['pages','pages',fixtures.pages.pageId]] as const;
   for(const [entity,table,sourceId]of entries){
    assert.ok(Number.isSafeInteger(sourceId)&&sourceId>0);const original=(await db.query('select to_jsonb(t) value from public.'+table+' t where id=$1',[sourceId])).rows[0]?.value as Row;assert.ok(original);
    const columns=(await db.query("select attname from pg_catalog.pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='' and attname<>'id' order by attnum",['public.'+table])).rows.map(row=>String(row.attname));
    assert.ok(columns.length&&columns.every(name=>/^[a-z_][a-z0-9_]*$/.test(name)));
    for(let index=0;index<2;index++){
     const label=namespace+' '+entity+' '+index,slug=namespace+'-'+entity+'-'+index;
     const row:Row={...original,slug,[entity==='topics'||entity==='pages'?'title':'name']:label,status:'published',deleted_at:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
     if(entity==='topics'){
      Object.assign(row,{series_id:null,series:null,series_slug:null,is_featured:false,content_type:'article'});
      Object.assign(row,seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)));
     }else if(entity==='categories')Object.assign(row,{parent_id:null,is_active:false,status:'unpublished',show_in_menu:false,deleted_at:new Date().toISOString()});
     else if(entity==='series')Object.assign(row,{category_id:fixtures.category.id});
     else{
      Object.assign(row,{path:'/'+slug,is_system:false,page_type:'static',status:'unpublished'});
      Object.assign(row,seo.deriveEntitySeoScore(seo.toPageSeoScoreInput(row as unknown as PageSeoSource)));
     }
     const selection=columns.map(column=>'"'+column+'"').join(',');
     const inserted=(await db.query('insert into public.'+table+'('+selection+') select '+selection+' from jsonb_populate_record(null::public.'+table+',$1::jsonb) returning id',[JSON.stringify(row)])).rows[0];
     const id=Number(inserted.id);assert.ok(Number.isSafeInteger(id)&&id>0&&id!==sourceId);output[entity].push({id,label,slug});
    }
   }
   // No Topic is linked to the disposable Series or Categories. Their native
   // relation guards remain enabled; fixture preparation produces no audit claim.
   assert.equal((await db.query('select count(*)::int count from public.topics where category_id=any($1::bigint[]) or series_id=any($2::bigint[])',[output.categories.map(row=>row.id),output.series.map(row=>row.id)])).rows[0].count,0);
   await db.query('commit');committed=true;
  }finally{if(!committed)await db.query('rollback');}
 });
 assertOwnedLocalHandle(handle);return output;
}

