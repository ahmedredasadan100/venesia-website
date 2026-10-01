import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertOwnedLocalHandle,type OwnedLocalHandle} from './lib/isolated-supabase.mts';
import {assertCoreDownloadJoin,CORE_DOWNLOAD_MEDIA_KEY,CORE_DOWNLOAD_MEDIA_HREF} from './fixtures/admin-core-download-media-adoption.mjs';
export type DownloadAsset={id:string;objectKey:string;publicUrl:string;displayName:string;catalogRegistered:boolean;fileSha256:string;sizeBytes:number};
const states=new WeakMap<OwnedLocalHandle,{asset:DownloadAsset;assetsHash:string;records:Array<Record<string,unknown>>}>(),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const binary=()=>{const bytes=readFileSync(resolve(process.cwd(),'public',CORE_DOWNLOAD_MEDIA_KEY));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');return {fileSha256:createHash('sha256').update(bytes).digest('hex'),sizeBytes:bytes.length};};
const assets=async(handle:OwnedLocalHandle)=>(await handle.query('select * from public.media_assets order by id')).rows;
/** Existing read-only deployment PDF; prepare its supported legacy catalog identity only inside owned QA before snapshots. */
export async function prepareCoreDownloadMediaFixture(handle:OwnedLocalHandle){
 assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);const file=binary(),originalAssets=await assets(handle),originalFolders=(await handle.query('select * from public.media_folders order by normalized_path')).rows;
 const matching=originalAssets.filter(row=>row.provider==='filesystem'&&row.bucket==='public'&&row.object_key===CORE_DOWNLOAD_MEDIA_KEY);assert.ok(matching.length<=1);let row=matching[0];
 if(!row){
  const actors=(await handle.query("select id from public.admin_users where username='qa_admin_interaction' and is_active")).rows;assert.equal(actors.length,1);const actorId=Number(actors[0].id);assert.ok(Number.isSafeInteger(actorId)&&actorId>0);
  row=await handle.withDatabaseConnection(async connection=>{await connection.query('begin');try{
   for(const [folder,parent,label]of [['files',null,'المستندات'],['files/projects','files','projects']]){
    const existing=(await connection.query('select normalized_path,parent_path from public.media_folders where normalized_path=$1',[folder])).rows;assert.ok(existing.length<=1);
    if(existing.length)assert.equal(existing[0].parent_path,parent);else await connection.query("insert into public.media_folders(normalized_path,parent_path,display_name,created_by,reconciliation_state) values($1,$2,$3,$4,'synced')",[folder,parent,label,actorId]);
   }
   const inserted=await connection.query("insert into public.media_assets(provider,bucket,object_key,public_url,original_filename,display_name,media_kind,mime_type,extension,byte_size,checksum,folder_path,status,uploaded_by,reconciliation_state,missing_object,metadata) values('filesystem','public',$1,$2,$3,$3,'document','application/pdf','pdf',$4,$5,'files/projects','active',$6,'synced',false,$7::jsonb) returning *",[CORE_DOWNLOAD_MEDIA_KEY,CORE_DOWNLOAD_MEDIA_HREF,CORE_DOWNLOAD_MEDIA_KEY.split('/').at(-1)!,file.sizeBytes,file.fileSha256,actorId,JSON.stringify({qaFixture:'existing-deployment-pdf',ownedRunId:handle.identity.runId,sourceFileSha256:file.fileSha256,uploadClaim:false})]);assert.equal(inserted.rows.length,1);const insertedRow=inserted.rows[0];
   assert.deepEqual((await connection.query('select * from public.media_assets where id<>$1 order by id',[insertedRow.id])).rows,originalAssets,'Fixture registration cannot rewrite any prior catalog asset.');
   const folders=(await connection.query('select * from public.media_folders order by normalized_path')).rows;assert.deepEqual(folders.filter(value=>originalFolders.some(old=>old.id===value.id)),originalFolders,'Existing folder metadata must remain unchanged.');assert.ok(folders.filter(value=>!originalFolders.some(old=>old.id===value.id)).every(value=>['files','files/projects'].includes(String(value.normalized_path))));
   assert.deepEqual(binary(),file);await connection.query('commit');return insertedRow;
  }catch(error){await connection.query('rollback');throw error;}});
  handle.record('core-download-fixture-prepared',{assetId:String(row.id),fileSha256:file.fileSha256,sizeBytes:file.sizeBytes,source:'existing-deployment-file',catalogRegistered:true,uploadClaim:false});
 }
 const registered=(await handle.query('select * from public.media_assets where provider=$1 and bucket=$2 and object_key=$3',['filesystem','public',CORE_DOWNLOAD_MEDIA_KEY])).rows;assert.equal(registered.length,1);assert.deepEqual(registered[0],row);row=registered[0];
 assert.ok(row);assert.equal(row.extension,'pdf');assert.equal(row.original_filename,CORE_DOWNLOAD_MEDIA_KEY.split('/').at(-1));assert.equal(row.provider,'filesystem');assert.equal(row.bucket,'public');assert.equal(row.object_key,CORE_DOWNLOAD_MEDIA_KEY);assert.equal(row.public_url,CORE_DOWNLOAD_MEDIA_HREF);assert.equal(row.status,'active');assert.equal(row.reconciliation_state,'synced');assert.equal(row.missing_object,false);assert.equal(row.media_kind,'document');assert.equal(row.mime_type,'application/pdf');assert.equal(row.folder_path,'files/projects');assert.equal(row.checksum,file.fileSha256);assert.equal(Number(row.byte_size),file.sizeBytes);
 const asset:DownloadAsset={id:String(row.id),objectKey:CORE_DOWNLOAD_MEDIA_KEY,publicUrl:CORE_DOWNLOAD_MEDIA_HREF,displayName:String(row.display_name),catalogRegistered:true,...file};assert.match(asset.id,/^[a-f0-9-]{36}$/iu);
 states.set(handle,{asset,assetsHash:hash(await assets(handle)),records:[]});return asset;
}

export async function assertCoreDownloadMediaUnchanged(handle:OwnedLocalHandle){assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);assert.deepEqual(binary(),{fileSha256:state.asset.fileSha256,sizeBytes:state.asset.sizeBytes});assert.equal(hash(await assets(handle)),state.assetsHash,'PDF selection may change domain references but cannot upload/register/overwrite/mutate asset rows.');return {status:'pass',asset:state.asset,catalogAssetsSha256:state.assetsHash,fileUnchanged:true,catalogRowsUnchanged:true};}
export function coreDownloadFixture(handle:OwnedLocalHandle){assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);return state.asset;}

export function recordCoreDownloadCheckpoint<T extends Record<string,unknown>>(handle:OwnedLocalHandle,record:T):T {assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);assert.ok(!state.records.some(row=>row.id===record.id));state.records.push(structuredClone(record));return record;}
export async function verifyCoreDownloadMediaCompletion(handle:OwnedLocalHandle,browser:unknown,native:unknown,sourceSha256:string){
 assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);
 const proof=await assertCoreDownloadMediaUnchanged(handle),b=browser as Record<string,unknown>,n=native as {status:string;ownedRunId:string;records:Array<Record<string,unknown>>};
 assert.equal(n.status,'pass');assert.equal(n.ownedRunId,handle.identity.runId);
 return {...assertCoreDownloadJoin({browser:b,nativeRecords:n.records,ownedRecords:state.records,asset:state.asset,sourceSha256}),proof};
}

