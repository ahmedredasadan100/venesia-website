import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

// Actual Tracking Actions/preparation/provider and cache owners; native SQL.
// Auth, SDK transport, Storage URL metadata and Next delivery are isolated ports.
export async function verifyTrackingTransferActions({ok, query, check}) {
 const root=process.cwd(),require=createRequire(import.meta.url),modules=new Map(),events=[],cache=new Map();
 let drop=false,blockReceipt=false,blockAfterDrop=false,rejectCache=false,generation=0,mutationCalls=0,scanCalls=0;
 const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
 const tables=['projects','project_tracking_stages','project_tracking_items','project_tracking_updates','project_tracking_update_media','admin_audit_logs'];
 function from(table){assert.ok(tables.includes(table),table);let single=false,columns='',filters=[],orders=[],range=null,opts={};
  const chain={select(c,o={}){columns=c;opts=o;return chain;},eq(k,v){filters.push([k,v]);return chain;},in(k,v){filters.push([k,v]);return chain;},contains(k,v){filters.push([k,v]);return chain;},order(k,o={}){orders.push([k,o.ascending!==false]);return chain;},range(a,b){range=[a,b];return chain;},maybeSingle(){single=true;return chain;},
   async then(yes,no){try{
    if(table==='admin_audit_logs'&&blockReceipt)throw Error('receipt unavailable');
    const state=JSON.parse(await ok('select jsonb_build_object('+tables.map(t=>quote(t)+`,coalesce((select jsonb_agg(to_jsonb(r)) from public.${t} r),'[]'::jsonb)`).join(',')+')'));
    let rows=state[table].map(row=>{
      if(table==='project_tracking_stages'&&columns.includes('project_tracking_items('))return {...row,project_tracking_items:state.project_tracking_items.filter(i=>i.stage_id===row.id&&i.is_visible)};
      if(table==='project_tracking_items')return {...row,project_tracking_updates:[{count:state.project_tracking_updates.filter(u=>u.item_id===row.id&&u.publication_status==='published').length}]};
      if(table==='project_tracking_updates'){const i=state.project_tracking_items.find(i=>i.id===row.item_id);return {...row,project_tracking_items:{...i,project_tracking_stages:state.project_tracking_stages.find(s=>s.id===i?.stage_id)}};}
      return row;
    });
    for(const[k,v]of filters){if(k==='project_tracking_items.is_visible'||k==='project_tracking_updates.publication_status')continue;
      rows=rows.filter(row=>k==='metadata'?row.metadata?.command?.id===v.command.id:Array.isArray(v)?v.map(String).includes(String(row[k])):String(k.split('.').reduce((r,p)=>r?.[p],row))===String(v));}
    rows.sort((a,b)=>{for(const[k,asc]of orders){const delta=a[k]<b[k]?-1:a[k]>b[k]?1:0;if(delta)return asc?delta:-delta;}return 0;});
    const count=rows.length;if(range)rows=rows.slice(range[0],range[1]+1);return yes({data:opts.head?null:single?rows[0]??null:rows,error:null,count});
   }catch(error){return no?no(error):Promise.reject(error);}}
  };return chain;
 }
 const allowedRpc=new Set(['read_project_tracking_transfer_snapshot','transfer_project_tracking_items','project_tracking_public_detail_v1']);
 function rpc(name,args={}){
  const promise=(async()=>{
   if(name==='read_public_cache_generation')return{data:String(generation),error:null};
   if(name==='advance_public_cache_generation'){events.push('generation');return rejectCache?{data:null,error:{code:'fixture'}}:{data:String(++generation),error:null};}
   assert.ok(allowedRpc.has(name),name);
   const value=v=>v===null?'null':Array.isArray(v)&&v.every(x=>typeof x==='number')?`ARRAY[${v}]::bigint[]`:typeof v==='object'?quote(JSON.stringify(v))+'::jsonb':typeof v==='number'?String(v):quote(v);
   if(name==='transfer_project_tracking_items')mutationCalls++;
   const response=await query(`select public.${name}(${Object.entries(args).map(([k,v])=>k+'=>'+value(v)).join(',')})`).done;
   if(response.code)return{data:null,error:{code:response.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'P0001',message:response.stderr}};
   const data=JSON.parse(response.stdout.trim());
   if(drop&&name==='transfer_project_tracking_items'){drop=false;blockReceipt=blockAfterDrop;throw Error('ack lost after commit');}
   return{data,error:null};
  })();promise.throwOnError=async()=>{const r=await promise;if(r.error)throw r.error;return r;};return promise;
 }
 const ports=new Map([
  ['src/lib/supabase-admin.ts',{getSupabaseAdmin:()=>({from,rpc})}],
  ['src/lib/admin/auth/require-admin-session.ts',{requireAdminSession:async()=>({id:1})}],
  ['src/lib/admin/audit-log.ts',{recordCmsAdminAudit:()=>{throw Error('No postcommit receipt');}}],
  ['src/lib/admin/audit/cms-audit-actions.ts',{}],
  ['src/lib/admin/projects/project-media-reference-rebind.ts',{}],
  ['src/lib/page-blocks/admin-queries.ts',{}],
  ['src/lib/admin/content/content-types.ts',{}],
  ['src/lib/content/public-content-path.ts',{}],
  ['src/lib/admin/seo/entity-seo-persistence.ts',{PERSISTED_ENTITY_SEO_FIELDS:[],TOPIC_SEO_SOURCE_COLUMNS:[],PROJECT_SEO_SOURCE_COLUMNS:[],PAGE_SEO_SOURCE_COLUMNS:[]}],
  ['src/lib/admin/media-catalog/synchronization.ts',{synchronizeMediaReferenceWriteScopesAfterDomainMutation:()=>{throw Error('Postcommit Media sync forbidden');}}],
  ['src/lib/admin/media-catalog/domain-write-coordination.ts',{}],
  ['src/lib/admin/media-catalog/deleted-reference-state.ts',{readUnavailableManagedValues:async()=>[]}],
  ['src/lib/projects/load-published-projects.ts',{}],
  ['src/lib/logging/index.ts',{logError(){},logWarnWithError(){}}],
  ['src/lib/storage/upload-cms-asset.ts',{parseManagedStorageAsset:value=>load('src/lib/admin/media-storage-adapter.ts').parseManagedMediaUrl(value,[{bucket:'images',kind:'image',root:'images',origin:'https://fixture.invalid',pathname:'/storage/v1/object/public/images/'}])}],
  ['src/lib/admin/media-catalog/catalog.ts',{getCatalogAssetIdentityMapForSynchronization:async()=>{
    const assets=JSON.parse(await ok('select jsonb_agg(to_jsonb(a)) from media_assets a'));
    return new Map(assets.map(a=>[load('src/lib/admin/media-catalog/identity.ts').getCanonicalMediaIdentityKey({provider:a.provider,bucket:a.bucket,objectKey:a.object_key}),{id:a.id}]));
  }}],
 ]);
 const allowed=new Set(['src/app/admin/projects/tracking-actions.ts','src/lib/admin/projects/tracking-contract.ts','src/lib/admin/projects/tracking-media-coordination.ts','src/lib/projects/tracking/contract.ts','src/lib/projects/tracking/public-read.ts','src/lib/admin/entity-list/pagination.ts','src/lib/admin/admin-action-result.ts','src/lib/cache/public-cache-generation.ts','src/lib/cache/revalidate-public-cache-tags.ts','src/lib/admin/media-catalog/reference-providers.ts','src/lib/admin/media-catalog/identity.ts','src/lib/admin/media-storage-adapter.ts','src/lib/admin/media-catalog/write-lease.ts']);
 function load(file){if(ports.has(file))return ports.get(file);if(modules.has(file))return modules.get(file).exports;assert.ok(allowed.has(file),file);
  const loadedModule={exports:{}};modules.set(file,loadedModule);const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',js)(id=>{
   if(id==='server-only')return{};if(id==='react')return{cache:fn=>fn};if(id==='next/navigation')return{unstable_rethrow(){}};
   if(id==='next/cache')return {revalidatePath:path=>events.push(path),revalidateTag:(tag,profile)=>{events.push([tag,profile]);if(profile!=='max')cache.clear();},unstable_cache:(fn,keys)=>async(...args)=>{const key=JSON.stringify([keys,args]);if(!cache.has(key))cache.set(key,await fn(...args));return cache.get(key);}};
   if(!id.startsWith('.')){assert.ok(['zod','node:crypto','node:util','path'].includes(id),id);return require(id);}
   const base=resolve(dirname(resolve(file)),id);const target=[base,base+'.ts',resolve(base,'index.ts')].find(p=>existsSync(p)&&statSync(p).isFile());return load(relative(root,target).replaceAll('\\','/'));
  },loadedModule,loadedModule.exports);
  if(file==='src/lib/admin/media-storage-adapter.ts')loadedModule.exports.resolveMediaStorageRuntimeContext=()=>({provider:'supabase',environment:'local',identity:'isolated'});
  if(file==='src/lib/admin/media-catalog/reference-providers.ts'){const original=loadedModule.exports.getMediaReferenceProvider;loadedModule.exports.getMediaReferenceProvider=key=>{scanCalls++;return original(key);};}
  return loadedModule.exports;
 }
 const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldVercel=process.env.VERCEL;
 process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321';delete process.env.VERCEL;
 try{
  const actions=load('src/app/admin/projects/tracking-actions.ts'),reader=load('src/lib/projects/tracking/public-read.ts');
  const input={projectId:1,sourceStageId:2,targetStageId:1,operation:'copy',ids:[1,2]};
  const preview=await actions.previewTrackingTransferAction(input);assert.equal(preview.ok,true);assert.equal(preview.updateCount,3);assert.equal(preview.imageCount,2);assert.equal(mutationCalls,0);check('actual preview is read-only and includes complete update/image counts');
  const prior=await reader.loadProjectTrackingDetail('published-project');assert.equal(prior.status,'ready');
  const cmd=randomUUID();drop=true;const result=await actions.transferTrackingItemsAction(input,preview.revision,cmd);
  assert.equal(result.completion,'committed',JSON.stringify(result));assert.equal(result.ok,true);assert.equal(mutationCalls,1);assert.ok(scanCalls>0);
  assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='project-tracking'&&e[1]!=='max'));assert.ok(events.includes('/track-your-project/published-project'));assert.ok(generation>0);
  const latest=await reader.loadProjectTrackingDetail('published-project');assert.equal(latest.status,'ready');assert.notDeepEqual(latest,prior);check('actual Action + provider + native RPC recover lost acknowledgement; next public read changes with immediate invalidation');
  const replay=await actions.transferTrackingItemsAction(input,preview.revision,cmd);assert.equal(replay.ok,true);assert.equal(mutationCalls,1);
  const mismatch=await actions.transferTrackingItemsAction({...input,operation:'move'},preview.revision,cmd);assert.equal(mismatch.code,'command_conflict');assert.equal(mutationCalls,1);check('Action replays canonical receipt before preflight and rejects changed intent without new RPC');
  const preview2=await actions.previewTrackingTransferAction(input),cmd2=randomUUID();drop=true;blockAfterDrop=true;
  const unknown=await actions.transferTrackingItemsAction(input,preview2.revision,cmd2);assert.equal(unknown.completion,'unknown');assert.equal(unknown.ok,false);
  blockReceipt=false;blockAfterDrop=false;const beforeRecovery=mutationCalls;
  assert.equal((await actions.recoverTrackingTransferAction(cmd2)).completion,'committed');assert.equal(mutationCalls,beforeRecovery);check('receipt outage preserves unknown result; later recovery is read-only');
  const preview3=await actions.previewTrackingTransferAction(input),cmd3=randomUUID();rejectCache=true;
  const warning=await actions.transferTrackingItemsAction(input,preview3.revision,cmd3);assert.equal(warning.ok,true);assert.equal(warning.feedbackStatus,'warning');assert.equal(warning.completion,'committed');
  rejectCache=false;const beforeCacheRecovery=mutationCalls;assert.equal((await actions.recoverTrackingTransferAction(cmd3)).feedbackStatus,'success');assert.equal(mutationCalls,beforeCacheRecovery);check('cache failure preserves confirmed commit; recovery retries invalidation only');
  assert.equal((await actions.previewTrackingTransferAction({...input,targetStageId:3})).ok,false);check('actual Action rejects cross-project target');
 }finally{if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=oldVercel;}
}