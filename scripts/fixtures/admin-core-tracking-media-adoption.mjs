import assert from 'node:assert/strict';
import {validateCoreJourneySelection} from './admin-core-domain-form-journeys.mjs';
import {randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';
import {chooseCoreImageAsset} from './admin-core-direct-image-adoption.mjs';
import {PRESENTATION_CONTROL_ASSETS} from './admin-core-presentation-controls-contract.mjs';
const paths=PRESENTATION_CONTROL_ASSETS.map(key=>'/'+key);
const videoUrl=phase=>'https://example.invalid/core-tracking-video'+(phase==='edit'?'-edited':'');
export function coreTrackingMediaExpected(phase,key){assert.ok(['create','edit'].includes(phase));assert.match(key,/^[a-f0-9-]{36}$/iu);return[
 {media_kind:'image',public_url:paths[1],poster_url:null,title:null,sort_order:0},
 {media_kind:'image',public_url:paths[phase==='create'?0:2],poster_url:null,title:null,sort_order:1},
 {media_kind:'video',public_url:videoUrl(phase),poster_url:paths[phase==='create'?2:0],title:'QA Core Tracking video '+phase,sort_order:2,client_key:key},
];}
export async function assertCoreTrackingMediaUI(form,proof){
 const images=form.locator('[name="image_urls"]');await expect(images).toHaveCount(1);await expect(images).toHaveValue(proof.expectedMedia.filter(row=>row.media_kind==='image').map(row=>row.public_url).join('\n'));
 const videos=JSON.parse(await form.locator('[name="videos_json"]').inputValue()),expected=proof.expectedMedia.find(row=>row.media_kind==='video');assert.equal(videos.length,1);assert.deepEqual(videos[0],{client_key:expected.client_key,url:expected.public_url,poster_url:expected.poster_url,title:expected.title});
 const gallery=form.locator('[data-admin-media-gallery-mode="paths"]').filter({has:form.page().locator('[name="image_urls"]')});await expect(gallery.locator('[data-admin-media-gallery-card="image"]')).toHaveCount(2);
 await expect(gallery.locator('[data-admin-media-gallery-card="image"]').first().locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled();await expect(gallery.locator('[data-admin-media-gallery-card="image"]').last().locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
}
export function assertCoreTrackingPreservedFields(snapshot){
 const names=['title','body','occurred_on','publication_status'];assert.deepEqual(snapshot.entries.map(row=>row[0]),names);
 for(const[,values]of snapshot.entries.slice(0,3)){assert.equal(values.length,1);assert.equal(typeof values[0],'string');}
 assert.equal(snapshot.publicationControls.length,2);const[hidden,toggle]=snapshot.publicationControls;
 assert.deepEqual(hidden,{tag:'INPUT',type:'hidden',value:'draft',role:null,checked:null,disabled:false});
 assert.equal(typeof toggle.checked,'boolean');assert.deepEqual(toggle,{tag:'INPUT',type:'checkbox',value:'published',role:'switch',checked:toggle.checked,disabled:false});
 assert.deepEqual(snapshot.entries[3][1],toggle.checked?['draft','published']:['draft']);return snapshot;
}
export async function readCoreTrackingPreservedFields(form){
 const snapshot=await form.evaluate(node=>{const names=['title','body','occurred_on','publication_status'],data=new FormData(node);return{entries:names.map(name=>[name,data.getAll(name)]),publicationControls:[...node.querySelectorAll('[name="publication_status"]')].map(control=>({tag:control.tagName,type:control.type,value:control.value,role:control.getAttribute('role'),checked:control.type==='checkbox'?control.checked:null,disabled:control.disabled}))};});
 return assertCoreTrackingPreservedFields(snapshot);
}
export async function authorCoreTrackingMedia({page,origin,form,phase,prior=null}){
 assert.ok(['create','edit'].includes(phase));assert.equal(Boolean(prior),phase==='edit');
 const gallery=form.locator('[data-admin-media-gallery-mode="paths"]').filter({has:page.locator('[name="image_urls"]')}),images=form.locator('[name="image_urls"]'),videoOwner=form.locator('[data-project-tracking-video-fields]'),serialized=videoOwner.locator('[name="videos_json"]');
 await expect(gallery).toHaveCount(1);await expect(videoOwner).toHaveCount(1);
 const readPreserved=()=>readCoreTrackingPreservedFields(form);
 const preserved=await readPreserved(),assets=[],operations=[];
 const cards=()=>gallery.locator('[data-admin-media-gallery-card="image"]');
 const choose=async(trigger,index,cancel=false)=>{const before=await images.inputValue(),videoBefore=await serialized.inputValue(),asset=await chooseCoreImageAsset({page,origin,trigger,key:PRESENTATION_CONTROL_ASSETS[index],cancel});assets.push(asset);if(cancel){await expect(images).toHaveValue(before);await expect(serialized).toHaveValue(videoBefore);}assert.deepEqual(await readPreserved(),preserved);return asset;};
 if(phase==='create'){
  await expect(images).toHaveValue('');assert.deepEqual(JSON.parse(await serialized.inputValue()),[]);
  await choose(gallery.locator('[data-admin-media-gallery-action="add"]'),0,true);operations.push('gallery-cancel-original');
  await choose(gallery.locator('[data-admin-media-gallery-action="add"]'),0);await choose(gallery.locator('[data-admin-media-gallery-action="add"]'),1);operations.push('gallery-add-two');
  await cards().nth(1).locator('[data-admin-media-gallery-action="move-up"]').click();await expect(images).toHaveValue(paths[1]+'\n'+paths[0]);operations.push('gallery-reorder');
  await choose(cards().nth(0).locator('[data-admin-media-gallery-action="replace"]'),2,true);operations.push('gallery-cancel-replace');
  await choose(cards().nth(1).locator('[data-admin-media-gallery-action="replace"]'),2);await expect(images).toHaveValue(paths[1]+'\n'+paths[2]);await choose(cards().nth(1).locator('[data-admin-media-gallery-action="replace"]'),0);operations.push('gallery-replace-restore');
  await videoOwner.getByRole('button',{name:'إضافة فيديو',exact:true}).click();
 }else{
  await assertCoreTrackingMediaUI(form,prior);await cards().nth(1).locator('[data-admin-media-gallery-action="remove"]').click();await expect(images).toHaveValue(paths[1]);operations.push('gallery-remove-persisted');
  await choose(gallery.locator('[data-admin-media-gallery-action="add"]'),2);await expect(images).toHaveValue(paths[1]+'\n'+paths[2]);operations.push('gallery-add-replacement');
 }
 const videos=JSON.parse(await serialized.inputValue());assert.equal(videos.length,1);const key=videos[0].client_key;assert.match(key,/^[a-f0-9-]{36}$/iu);if(prior)assert.equal(key,prior.videoClientKey);
 const poster=videoOwner.locator('[data-admin-media-image-field="poster_'+key+'"]'),videoCard=poster.locator('xpath=../..');await expect(videoCard.locator('input[type="url"]')).toHaveCount(1);
 await videoCard.getByLabel('رابط الفيديو',{exact:true}).fill(videoUrl(phase));await videoCard.getByLabel('عنوان اختياري',{exact:true}).fill('QA Core Tracking video '+phase);operations.push(phase==='create'?'video-create':'video-edit-retains-client-key');
 const choosePoster=async(index,cancel=false)=>{const before=await poster.locator('input[name="poster_'+key+'"]').inputValue(),asset=await chooseCoreImageAsset({page,origin,trigger:poster.getByRole('button').first(),key:PRESENTATION_CONTROL_ASSETS[index],cancel});assets.push(asset);await expect(poster.locator('input[name="poster_'+key+'"]')).toHaveValue(cancel?before:asset.publicUrl);assert.deepEqual(await readPreserved(),preserved);};
 await choosePoster(0,true);await choosePoster(0);await choosePoster(1);await choosePoster(2,true);await poster.getByRole('button',{name:'إزالة',exact:true}).click();await expect(poster.locator('input[name="poster_'+key+'"]')).toHaveValue('');assert.equal(JSON.parse(await serialized.inputValue())[0].poster_url,'');await choosePoster(phase==='create'?2:0);operations.push('poster-cancel-select-replace-cancel-remove-select');
 await videoOwner.getByRole('button',{name:'إضافة فيديو',exact:true}).click();const temporary=JSON.parse(await serialized.inputValue());assert.equal(temporary.length,2);const extra=videoOwner.locator('[data-admin-media-image-field="poster_'+temporary[1].client_key+'"]').locator('xpath=../..');await extra.getByRole('button',{name:'إزالة',exact:true}).click();operations.push('video-remove-unsaved');
 const proof={receiptId:randomUUID(),sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,surface:'update-'+phase,phase,routePathname:new URL(page.url()).pathname,videoClientKey:key,expectedMedia:coreTrackingMediaExpected(phase,key),catalogAssets:assets,operations,unrelatedFieldsPreserved:true,actualCatalogApi:true,exactTriggerReturn:true,reloaded:false,automaticCoverage:[],globalClosed:false,requiresNativeSaveAndReload:true};
 await assertCoreTrackingMediaUI(form,proof);assert.deepEqual(await readPreserved(),preserved);return proof;
}
export function assertCoreTrackingMediaCompletion({browser,native,sourceSha256,ownedRunId,actorId,formManifest,collectionManifest,fixtures}){
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'domain-forms');assert.ok(browser.journeySelection==null||validateCoreJourneySelection({scope:browser.scope,cohort:browser.cohort,selection:browser.journeySelection})==="domain-forms-final-six-followup");assert.deepEqual(browser.errors,[]);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(browser.sourceSha256,sourceSha256);assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.ok(Number.isSafeInteger(actorId)&&actorId>0);
 const consumer='project-tracking-create-edit',forms=formManifest.filter(row=>row.id===consumer);assert.equal(forms.length,1);assert.ok(forms[0].sourceFiles.includes('src/components/admin/projects/tracking/TrackingForms.tsx'));for(const surface of['update-create','update-edit'])assert.ok(forms[0].surfaces.includes(surface));
 const declarations=collectionManifest.surfaces.flatMap(row=>row.consumerAdoptionEvidence?.length?row.consumerAdoptionEvidence:[row]),collections=declarations.filter(row=>row.id==='project-tracking-updates');assert.equal(collections.length,1);assert.ok(collections[0].executableBindings.some(row=>row.sourceFile==='src/components/admin/projects/tracking/TrackingCollections.tsx'&&row.exportNames.includes('TrackingUpdatesCollection')));
 const cases=['form:'+consumer+':capability:media','collection:project-tracking-updates:capability:media'];for(const key of cases)assert.equal(browser.requiredCases.filter(row=>row.key===key&&row.axis==='media').length,1);
 const matches=browser.evidence.filter(row=>row.id==='core-operational-update-form-roundtrip');assert.equal(matches.length,1);const journey=matches[0];assert.equal(journey.status,'pass');assert.equal(journey.consumer,consumer);assert.deepEqual(journey.surfaces,['update-create','update-edit']);assert.equal(journey.ids.length,1);const id=journey.ids[0];assert.ok(Number.isSafeInteger(id)&&id>0);assert.equal(journey.mediaEvidence.length,2);
 const receipts=[],children=[];
 for(const[index,proof]of journey.mediaEvidence.entries()){
  const phase=index===0?'create':'edit',surface='update-'+phase,caseId='core-operational-update-'+surface;
  assert.equal(proof.phase,phase);assert.equal(proof.surface,surface);assert.match(proof.receiptId,/^[a-f0-9-]{36}$/iu);assert.equal(proof.sourceSha256,sourceSha256);assert.equal(proof.routePathname,'/admin/projects/'+fixtures.commandClosure.tracking.projectId+'/tracking/items/'+fixtures.commandClosure.tracking.item.id);
  assert.deepEqual(proof.expectedMedia,coreTrackingMediaExpected(phase,proof.videoClientKey));for(const name of['unrelatedFieldsPreserved','actualCatalogApi','exactTriggerReturn','reloaded','requiresNativeSaveAndReload'])assert.equal(proof[name],true);assert.deepEqual(proof.automaticCoverage,[]);assert.equal(proof.globalClosed,false);
  assert.deepEqual(proof.operations,phase==='create'?['gallery-cancel-original','gallery-add-two','gallery-reorder','gallery-cancel-replace','gallery-replace-restore','video-create','poster-cancel-select-replace-cancel-remove-select','video-remove-unsaved']:['gallery-remove-persisted','gallery-add-replacement','video-edit-retains-client-key','poster-cancel-select-replace-cancel-remove-select','video-remove-unsaved']);
  const indices=phase==='create'?[0,0,1,2,2,0,0,0,1,2,2]:[2,0,0,1,2,0];assert.equal(proof.catalogAssets.length,indices.length);for(const[i,asset]of proof.catalogAssets.entries()){assert.equal(asset.objectKey,PRESENTATION_CONTROL_ASSETS[indices[i]]);assert.equal(asset.publicUrl,paths[indices[i]]);assert.match(asset.id,/^[a-f0-9-]{36}$/iu);assert.ok(typeof asset.displayName==='string'&&asset.displayName.length>0);}
  const permissions=journey.permissionEvidence.filter(row=>row.caseId===caseId);assert.equal(permissions.length,1);const permission=permissions[0];for(const[key,value]of Object.entries({status:'pass',formConsumer:consumer,surface,sourceSha256,ownedRunId,originalUiSuccessVerified:true,originalNativeSaveVerified:true,originalProjectionCount:1}))assert.equal(permission[key],value);
  const saves=native.records.filter(row=>row.id===permission.originalNativeSaveReceipt&&row.caseId===caseId);assert.equal(saves.length,1);const save=saves[0];assert.equal(save.kind,'form-save-native');assert.equal(save.status,'partial-not-global-pass');assert.equal(save.formConsumer,consumer);assert.equal(save.surface,surface);assert.equal(save.writes.length,1);const write=save.writes[0];assert.equal(write.table,'project_tracking_updates');assert.equal(write.id,id);assert.equal(write.deleted,false);assert.equal(write.expectedActorId,actorId);assert.equal(write.actual.item_id,fixtures.commandClosure.tracking.item.id);assert.equal(write.actual.publication_status,'draft');assert.equal(write.audit.length,1);const audit=write.audit[0];assert.equal(audit.action,'project_children.'+(phase==='create'?'create':'update'));assert.equal(audit.entity_type,'project_tracking_update');assert.equal(Number(audit.entity_id),id);assert.equal(Number(audit.actor_admin_user_id),actorId);assert.equal(audit.entity_label,write.actual.title);
  const media=write.trackingMedia;assert.ok(media);assert.equal(media.rows.length,3);assert.equal(media.referenceRows,0);assert.equal(media.catalogIdentityCount,phase==='create'?3:3);assert.equal(new Set(media.rows.map(row=>String(row.client_key))).size,3);
  for(const[i,row]of media.rows.entries()){assert.equal(Number(row.update_id),id);assert.ok(Number.isSafeInteger(Number(row.id))&&Number(row.id)>0);assert.match(String(row.client_key),/^[a-f0-9-]{36}$/iu);for(const[key,wanted]of Object.entries(proof.expectedMedia[i]))assert.deepEqual(key==='sort_order'?Number(row[key]):row[key],wanted);}
  if(index===0){assert.deepEqual(media.priorAssociationIds,[]);assert.deepEqual(media.removedAssociationIds,[]);}else{const before=children[0];assert.equal(proof.videoClientKey,journey.mediaEvidence[0].videoClientKey);assert.deepEqual(media.priorAssociationIds,before.map(row=>Number(row.id)));assert.deepEqual(media.removedAssociationIds,[Number(before[1].id)]);for(const keep of[0,2]){assert.equal(String(media.rows[keep].id),String(before[keep].id));assert.equal(media.rows[keep].client_key,before[keep].client_key);}assert.ok(!before.some(row=>String(row.id)===String(media.rows[1].id)||row.client_key===media.rows[1].client_key));}
  receipts.push(save.id);children.push(media.rows);
 }
 assert.equal(new Set(receipts).size,2);assert.equal(new Set(journey.mediaEvidence.map(row=>row.receiptId)).size,2);
 return{status:'partial-not-global-pass',candidateRequiredCases:cases,nativeSaveReceipts:receipts,fields:['image_urls','videos_json','video.poster_url'],exactWrites:2,legacyReferenceBoundary:'Existing Tracking provider does not adopt filesystem references; zero manufactured managed references verified for current and removed association identities.',automaticCoverage:[],globalClosed:false};
}
