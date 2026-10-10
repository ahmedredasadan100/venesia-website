import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export async function verifyMediaRelocationContract() {
  const source=fs.readFileSync('src/lib/admin/media-catalog/physical-move.ts','utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const base={id:'asset-1',provider:'supabase',bucket:'cms-images',objectKey:'images/source.jpg',publicUrl:'https://test.supabase.co/storage/v1/object/public/cms-images/images/source.jpg',folderPath:'images',extension:'.jpg',kind:'image',status:'active',missingObject:false,reconciliationState:'synced'};
  const key=a=>[a.provider,a.bucket,a.objectKey].join(':');
  for(const mode of ['unused','used','rename','move+rename','rebind-failure','catalog-failure','lease-conflict','copy-collision','unsupported','finalization-failure']) {
    const asset={...base};let catalog={...asset},refs=mode==='unused'?[]:[{identity:asset,publicValue:asset.publicUrl,domainKey:'hero_templates',entityType:'hero_template',entityIdentity:'1',fieldKey:'config'}];
    const target={targetFolder:mode==='rename'?'images':'images/destination',...(['rename','move+rename'].includes(mode)?{targetFilename:'renamed.jpg'}:{})};
    const targetKey=target.targetFolder+'/'+(target.targetFilename??'source.jpg'),targetUrl=base.publicUrl.replace(base.objectKey,targetKey);
    const storage=new Set([asset.publicUrl]);if(mode==='copy-collision')storage.add(targetUrl);
    const events=[];let journal=null,failure=null;
    const db={from:()=>{const q={update(v){if(v.failure_metadata)journal=v.failure_metadata;return q;},eq(){return q;},select(){return Promise.resolve({error:null,data:[{id:'lease-row'}]});}};return q;},rpc:async(name,args)=>{events.push(name);if(name==='record_media_relocation_journal'){journal=args.p_plan;return {error:null,data:1};}if(name==='transition_media_asset_identity_for_move'){if(mode==='catalog-failure')return {error:{message:'injected'}};catalog={...catalog,objectKey:args.p_next_object_key,publicUrl:args.p_next_public_url};}if(name==='rollback_media_asset_identity_move')catalog={...base};if(name==='finalize_media_asset_identity_move'&&mode==='finalization-failure')return {error:{message:'injected'}};return {error:null};}};
    // Error read-back intentionally cannot prove the transition/finalization; rollback/recovery must fence it.
    const from=db.from;db.from=table=>{if(table==='media_assets'){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{provider:catalog.provider,bucket:catalog.bucket,object_key:catalog.objectKey,public_url:catalog.publicUrl,reconciliation_state:mode==='finalization-failure'?'uncertain':'synced',missing_object:false},error:null})};return q;}return from(table);};
    class StorageError extends Error{constructor(code,message){super(message);this.code=code;}}
    const deps={
      'server-only':{},path:{default:path},
      '../../cache/revalidate-public-cache-tags':{PUBLIC_CACHE_TAG_GROUPS:{media:['media']},expirePublicCacheTags:async()=>{events.push('cache');assert.ok(storage.has(base.publicUrl));}},
      '../media-intelligence/cms-upload-policy':{isCmsUploadFolderCompatible:folder=>folder==='images'||folder.startsWith('images/')},
      '../media-library-paths':{normalizeMediaFolder:folder=>{if(folder.includes('..'))throw Error('invalid');return folder;}},
      '../media-storage-adapter':{MediaStorageError:StorageError,resolveMediaStorageRuntimeContext:()=>({identity:'test',provider:'supabase',environment:'local'})},
      '../../supabase-admin':{getSupabaseAdmin:()=>db},
      '../../storage/upload-cms-asset':{
        copyManagedStorageAsset:async()=>{events.push('copy');assert.ok(journal);assert.ok(storage.has(base.publicUrl));if(mode==='copy-collision')throw Error('collision');storage.add(targetUrl);return {provider:asset.provider,bucket:asset.bucket,objectKey:targetKey,publicUrl:targetUrl};},
        verifyManagedStorageAssetExists:async url=>({managed:true,exists:storage.has(url)}),
        createSupabaseCmsMediaStorageAdapter:()=>({deleteAsset:async url=>{events.push('delete:'+url);if(url===base.publicUrl){assert.ok(refs.every(ref=>ref.publicValue===targetUrl));assert.ok(events.includes('cache'));}storage.delete(url);}}),
      },
      './catalog':{listMediaCatalogSnapshot:async()=>({folders:[{path:'images'},{path:'images/destination'}]}),getCatalogAssetByIdentity:async()=>null,getMediaCatalogRuntimeState:async()=>({state:'synced',providerRegistryVersion:'1',environmentKey:'test',provider:'supabase',environment:'local'}),listCatalogReferences:async()=>refs.map(ref=>({...ref})),markCatalogAssetState:async()=>events.push('uncertain')},
      './identity':{getCanonicalMediaIdentityKey:key,getFolderPathFromObjectKey:path.posix.dirname,normalizeManagedObjectKey:x=>x},
      './reference-providers':{MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION:'1',getMediaReferenceProvider:()=>({supportsRebind:mode!=='unsupported'}),scanAllMediaReferenceProviders:async()=>({uncertainties:[],references:refs})},
      './synchronization':{rebindAllSupportedMediaReferences:async(previous,next,options)=>{events.push('rebind');assert.ok(storage.has(base.publicUrl)&&storage.has(targetUrl));assert.equal(options.externalLease.token,'lease');if(mode==='rebind-failure')return {ok:false,code:'injected_rebind',nextAssetRequired:false};refs=refs.map(ref=>({...ref,identity:next,publicValue:next.publicUrl}));return {ok:true,appliedCount:refs.length};}},
      './write-lease':{acquireMediaReferenceWriteLease:async()=>{events.push('lease');if(mode==='lease-conflict')throw Error('conflict');return {token:'lease',assetCount:1}},completeMediaReferenceWriteLease:async()=>events.push('complete'),failMediaReferenceWriteLease:async v=>{failure=v;events.push('failed');}},
    };
    const mod={exports:{}};Function('exports','module','require',output)(mod.exports,mod,id=>{if(!(id in deps))throw Error(id);return deps[id];});
    for(const bad of ['../evil.jpg','image.pdf','a/b.jpg','a\\b.jpg',' bad.jpg'])assert.throws(()=>mod.exports.validateMediaRelocationTarget(asset,{targetFolder:'images/destination',targetFilename:bad}));
    assert.throws(()=>mod.exports.validateMediaRelocationTarget(asset,{targetFolder:'files'}));
    if(['unused','used','rename','move+rename'].includes(mode)){
      const result=await mod.exports.moveCatalogMediaAsset(asset,target,6);assert.equal(result.asset.id,asset.id);assert.equal(result.asset.objectKey,targetKey);assert.equal(storage.has(base.publicUrl),false);assert.equal(storage.has(targetUrl),true);assert.equal(events.at(-1),'complete');assert.equal(result.rebind.appliedCount,refs.length);
    }else{
      await assert.rejects(()=>mod.exports.moveCatalogMediaAsset(asset,target,6));
      if(mode==='finalization-failure'){assert.equal(storage.has(targetUrl),true);assert.ok(failure.domainWriteCommitted);assert.ok(refs.every(ref=>ref.publicValue===targetUrl));}
      else {assert.equal(storage.has(base.publicUrl),true);assert.ok(refs.every(ref=>ref.publicValue===base.publicUrl));}
      if(mode==='copy-collision'){assert.equal(storage.has(targetUrl),true);assert.ok(!events.includes('rebind'));assert.ok(!events.some(e=>e.startsWith('delete:')));}
      if(mode==='unsupported'||mode==='lease-conflict')assert.ok(!events.includes('copy'));
    }
    if(mode==='finalization-failure'||mode==='copy-collision'){
      let receipt=null;
      const row={id:'lease-row',status:'failed',resolved_at:null,failure_metadata:failure.metadata,updated_at:'2026-10-10',failure_code:'failed'};
      const previousRpc=db.rpc;db.rpc=async(name,args)=>{if(name==='transition_media_relocation_repair'){receipt={failure_metadata:{...failure.metadata,relocationRepaired:args.p_action==='complete'}};return {error:null,data:1};}return previousRpc(name,args)};
      const previousFrom=db.from;db.from=table=>{
        if(table!=='media_reference_write_leases')return previousFrom(table);
        let changed=false;const q={select(){return q},eq(){return q},order(){return q},update(value){changed=true;receipt=value;return q},then(resolve,reject){return Promise.resolve({error:null,data:changed?[{id:row.id}]:[row]}).then(resolve,reject)}};return q;
      };
      if(mode==='finalization-failure'){
        const repaired=await mod.exports.repairFailedMediaRelocation('lease');assert.equal(repaired.reconciliationRequired,true);assert.equal(receipt.failure_metadata.relocationRepaired,true);assert.ok(storage.has(targetUrl));assert.ok(refs.every(ref=>ref.publicValue===targetUrl));
      }else{
        await assert.rejects(()=>mod.exports.repairFailedMediaRelocation('lease'),/storage_ownership_unproven/);assert.ok(storage.has(base.publicUrl)&&storage.has(targetUrl));assert.ok(!events.some(e=>e.startsWith('delete:')));
      }
    }
  }
  console.log('PASS relocation owner: identity-preserving move/rename, referenced copy-first ordering, strict targets, collision ambiguity, lease conflict, rebind/catalog compensation, finalization recovery fence');
}
