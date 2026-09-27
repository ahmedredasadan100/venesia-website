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
/** Read-only existing filesystem identity. Missing catalog means the actual read-through identity, never a fabricated registration. */
export async function prepareCoreDownloadMediaFixture(handle:OwnedLocalHandle){
 assertOwnedLocalHandle(handle);assert.equal(states.has(handle),false);const rows=(await handle.query("select id,object_key,public_url,display_name,media_kind,mime_type,byte_size,status,reconciliation_state from public.media_assets where provider='filesystem' and bucket='public' and object_key=$1",[CORE_DOWNLOAD_MEDIA_KEY])).rows;assert.ok(rows.length<=1);const file=binary();let asset:DownloadAsset;
 if(rows.length){const row=rows[0];assert.equal(row.public_url,CORE_DOWNLOAD_MEDIA_HREF);assert.equal(row.status,'active');assert.equal(row.reconciliation_state,'synced');assert.equal(row.media_kind,'document');assert.equal(row.mime_type,'application/pdf');assert.equal(Number(row.byte_size),file.sizeBytes);asset={id:String(row.id),objectKey:CORE_DOWNLOAD_MEDIA_KEY,publicUrl:CORE_DOWNLOAD_MEDIA_HREF,displayName:String(row.display_name),catalogRegistered:true,...file};}
 else asset={id:'unmanaged:'+CORE_DOWNLOAD_MEDIA_HREF,objectKey:CORE_DOWNLOAD_MEDIA_KEY,publicUrl:CORE_DOWNLOAD_MEDIA_HREF,displayName:CORE_DOWNLOAD_MEDIA_KEY.split('/').at(-1)!,catalogRegistered:false,...file};
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

