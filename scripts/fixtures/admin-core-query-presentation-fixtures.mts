import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createJiti } from 'jiti';
import { assertOwnedLocalHandle,type OwnedLocalHandle } from '../lib/isolated-supabase.mts';
import { loadEntitySeoPersistenceOwner } from '../backfill-entity-seo-scores.mts';
import { readCoreFixedQaActor } from '../verify-admin-core-domain-readback-isolated.mts';
import { loadCoreQueryPresentationPlan } from './admin-core-query-presentation-plan.mjs';
import type { CoreQueryFixture } from '../verify-admin-core-query-presentation-isolated.mts';
import type { TopicSeoSource,ProjectSeoSource,PageSeoSource } from '../../src/lib/admin/seo/entity-seo-persistence.ts';

type Row=Record<string,unknown>;
/** Explicit opt-in of the existing Admin fixture owner, only in its owned DB. */
export async function prepareCoreQueryPresentationFixtures(handle:OwnedLocalHandle,fixtures:{topic:{id:number};category:{id:number};series:{id:number};project:{id:number};commercialProject:{id:number};pages:{pageId:number}}){
 assertOwnedLocalHandle(handle);const plan=await loadCoreQueryPresentationPlan(),seo=loadEntitySeoPersistenceOwner();
 const root=resolve(import.meta.dirname,'../..'),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{'server-only':resolve(root,'node_modules/next/dist/compiled/server-only/empty.js')}});
 const password=await jiti.import<typeof import('../../src/lib/admin/auth/password.ts')>(resolve(root,'src/lib/admin/auth/password.ts'));
 const duplicate=await jiti.import<typeof import('../../src/lib/admin/projects/project-duplicate-seo.ts')>(resolve(root,'src/lib/admin/projects/project-duplicate-seo.ts'));
 const passwordHash=await password.hashPassword(randomBytes(32).toString('base64url'));
 const actorId=await readCoreFixedQaActor(handle),namespace='qa-b1-'+randomUUID().slice(0,8),contexts:Record<string,CoreQueryFixture>={};
 const columns=new Map<string,string[]>();
 const source=async(table:string,id:number)=>{assert.ok(Number.isSafeInteger(id)&&id>0);const row=(await handle.query(`select to_jsonb(t) value from public.${table} t where id=$1`,[id])).rows[0]?.value as Row;assert.ok(row);return row;};
 const topic=await source('topics',fixtures.topic.id),category=await source('topic_categories',fixtures.category.id),series=await source('topic_series',fixtures.series.id),page=await source('pages',fixtures.pages.pageId);
 const projectSources={residential:await source('projects',fixtures.project.id),commercial:await source('projects',fixtures.commercialProject.id)};
 // Per-context closed scopes bound fixture duration and use planned healthy
 // connection renewal. Failures do not retry an ambiguous committed write.
 for(const spec of plan){
  const search=namespace+'-'+spec.key.replaceAll('_','-')+'-rows',ids:number[]=[];
  assert.equal((await handle.query(`select count(*)::int count from public.${spec.table} where "${spec.labelColumn}" like $1`,['%'+search+'%'])).rows[0].count,0);
  const count=spec.rowCount,stamp=(index:number)=>new Date(Date.UTC(2026,0,3,0,Math.floor(index/2))).toISOString();
  const label=(index:number)=>search+' '+String(Math.floor(index/2)).padStart(3,'0'),slug=(index:number)=>search+'-'+String(index).padStart(3,'0');
  for(let chunk=0;chunk<(spec.entity==='projects'?count:1);chunk++){
  await handle.withDatabaseConnection(async db=>{
   await db.query('begin');
   try{
    // A local query adapter keeps all writes on this explicit transaction.
    const transaction={query:db.query};
    if(spec.entity==='projects'){
     const original=projectSources[spec.type as 'residential'|'commercial'];
     const existing=(await db.query('select slug from public.projects where slug like $1',[String(original.slug)+'-copy%'])).rows.map(row=>String(row.slug));
     const copyNumber=Array.from({length:1000},(_,i)=>i+1).find(n=>!existing.includes(duplicate.projectDuplicateSlug(String(original.slug),n)));assert.ok(copyNumber);
     for(let i=chunk;i<chunk+1;i++){
      const proof=duplicate.buildProjectDuplicateSeoProof(original as unknown as Parameters<typeof duplicate.buildProjectDuplicateSeoProof>[0],copyNumber);
      const id=Number((await db.query('select * from public.duplicate_project_admin_entry($1,$2::jsonb)',[original.id,JSON.stringify(proof)])).rows[0].project_id);ids.push(id);
      const row={...original,arabic_name:label(i),english_name:slug(i),slug:slug(i)},score=seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(row as ProjectSeoSource));
      await db.query('update public.projects set arabic_name=$2,english_name=$3,slug=$3,code=$3,seo_score=$4,seo_score_version=$5,seo_score_input_hash=$6 where id=$1',[id,row.arabic_name,row.slug,score.seo_score,score.seo_score_version,score.seo_score_input_hash]);
      if(i%2===0){const readiness=(await db.query('select * from public.project_publishing_readiness($1)',[id])).rows[0];assert.equal(readiness.ready,true);await db.query('select * from public.set_project_publication_admin_entry($1,true,$2)',[id,actorId]);}
     }
    }else if(spec.level){
     const original=projectSources.residential;const parent=spec.level==='governorate'?null:spec.level==='city'?original.governorate_id:spec.level==='main_area'?original.city_id:original.main_area_id;
     for(let i=0;i<count;i++)ids.push(Number((await db.query('insert into public.project_locations(client_key,level,parent_id,name_ar,name_en,sort_order,is_active) values($1,$2,$3,$4,$4,$5,$6) returning id',[randomUUID(),spec.level,parent,label(i),Math.floor(i/2),i%2===0])).rows[0].id));
    }else if(spec.kind){
     const projectId=contexts['projects-residential'].ids[0];
     const stageId=contexts.project_tracking_stages?.ids[0],itemId=contexts.project_tracking_items?.ids[0];
     for(let i=0;i<count;i++){
      const sql=spec.kind==='stages'?'insert into public.project_tracking_stages(project_id,name,sort_order,is_visible) values($1,$2,$3,$4) returning id':spec.kind==='items'?"insert into public.project_tracking_items(stage_id,name,sort_order,is_visible,status) values($1,$2,$3,$4,'not_started') returning id":"insert into public.project_tracking_updates(item_id,title,occurred_at,publication_status,body) values($1,$2,$3,$4,'QA B1 authored fixture') returning id";
      const values=spec.kind==='updates'?[itemId,label(i),stamp(i),i%2===0?'unpublished':'draft']:[spec.kind==='stages'?projectId:stageId,label(i),Math.floor(i/2),i%2===0];
      ids.push(Number((await db.query(sql,values)).rows[0].id));
     }
     contexts[spec.key]={search,ids,projectId,...(spec.kind==='items'?{stageId}:spec.kind==='updates'?{itemId}:{})};
    }else if(spec.entity==='admin_users'){
     for(let i=0;i<count;i++)ids.push(Number((await db.query("insert into public.admin_users(email,username,password_hash,full_name,role,is_active,session_version,created_at) values($1,$2,$3,$4,'admin',$5,1,$6) returning id",[slug(i)+'@example.invalid',slug(i),passwordHash,label(i),i%2===0,stamp(i)])).rows[0].id));
    }else if(spec.entity==='redirects'){
     for(let i=0;i<count;i++)ids.push(Number((await db.query("insert into public.url_redirects(source_path,destination_path,redirect_type,status,updated_at) values($1,'/topics','302',$2,$3) returning id",['/'+slug(i),i%2===0?'active':'inactive',stamp(i)])).rows[0].id));
    }else if(spec.entity==='activity_log'){
     for(let i=0;i<count;i++)ids.push(Number((await db.query("insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_label,metadata,created_at) values($1,'qa_admin_interaction',$2,$3,$4,'{\"verificationFixture\":true}'::jsonb,$5) returning id",[actorId,i%2===0?'topic.update':'page.update',i%2===0?'topic':'page',label(i),stamp(i)])).rows[0].id));
    }else{
     const rows=Array.from({length:count},(_,i)=>{
      const original=spec.table==='topics'?topic:spec.table==='topic_categories'?category:spec.table==='topic_series'?series:page;
      const row:Row={...original,slug:slug(i),[spec.labelColumn]:label(i),deleted_at:null,created_at:stamp(i),updated_at:stamp(i),status:i%2===0?'published':'unpublished'};
      if(spec.table==='topics'){
       Object.assign(row,{series_id:null,series:null,series_slug:null,is_featured:false,content_type:spec.entity==='topics_without_image'&&i%2?'news':'article'});
       if(spec.entity==='topics_without_image')Object.assign(row,{image:'',image_alt:null,status:'unpublished',published_at:null});
       Object.assign(row,seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)));
      }else if(spec.table==='topic_categories')Object.assign(row,{parent_id:null,is_active:i%2===0,show_in_menu:false});
      else if(spec.table==='pages'){Object.assign(row,{path:'/'+slug(i),is_system:false,page_type:'static'});Object.assign(row,seo.deriveEntitySeoScore(seo.toPageSeoScoreInput(row as unknown as PageSeoSource)));}
      return row;
     });
     // Resolve the real table columns once; insert only through this scope.
     let names=columns.get(spec.table);if(!names){names=(await transaction.query("select attname from pg_catalog.pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='' and attname<>'id' order by attnum",['public.'+spec.table])).rows.map(row=>String(row.attname));assert.ok(names.length&&names.every(name=>/^[a-z_][a-z0-9_]*$/.test(name)));columns.set(spec.table,names);}
     const selection=names.map(name=>'"'+name+'"').join(',');ids.push(...(await db.query(`insert into public.${spec.table}(${selection}) select ${selection} from jsonb_populate_recordset(null::public.${spec.table},$1::jsonb) returning id`,[JSON.stringify(rows)])).rows.map(row=>Number(row.id)));
    }
    await db.query('commit');
   }catch(error){await db.query('rollback');throw error;}
  });
  if(spec.entity==='projects'&&chunk%4===3)await handle.renewDatabaseControlConnection();
  }
  assert.equal(ids.length,count);assert.equal(new Set(ids).size,count);contexts[spec.key]??={search,ids};await handle.renewDatabaseControlConnection();
 }
 // Keep synthetic audit rows labelled as read fixtures, never domain-write proof.
 return {contexts,namespace,scope:'Read-model fixtures only; Activity Log entries are synthetic fixtures, not evidence of audited Product mutations.'};
}
