import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { expect } from 'playwright/test';
import { PRESENTATION_CONTROL_ASSETS } from './admin-core-presentation-controls-contract.mjs';

const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const CORE_DIRECT_IMAGE_VALUES=Object.freeze({logoUrl:'/'+PRESENTATION_CONTROL_ASSETS[2],compactLogoUrl:'',og_image:'/'+PRESENTATION_CONTROL_ASSETS[2],og_image_alt:'صورة معاينة الصفحة المختارة من المكتبة'});
export function assertCoreImageCatalogResult(payload,key){
 assert.ok(PRESENTATION_CONTROL_ASSETS.includes(key));assert.ok(payload&&Array.isArray(payload.assets));assert.equal(payload.assets.length,1,'An exact catalog search must identify only the owned existing asset.');
 const asset=payload.assets[0];assert.equal(asset.objectKey,key);assert.equal(asset.publicUrl,'/'+key);assert.match(asset.id,/^[a-f0-9-]{36}$/iu);assert.ok(typeof asset.displayName==='string'&&asset.displayName.length>0);return{id:asset.id,objectKey:key,publicUrl:asset.publicUrl,displayName:asset.displayName};
}
export async function chooseCoreImageAsset({page,origin,trigger,key,cancel=false}){
 const base=new URL(origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);assert.equal(new URL(page.url()).origin,origin);assert.match(new URL(page.url()).pathname,/^\/admin\//u);assert.ok(PRESENTATION_CONTROL_ASSETS.includes(key));await expect(trigger).toHaveCount(1);
 const match=response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==='/api/admin/media-library'&&response.request().method()==='GET';};
 const [initial]=await Promise.all([page.waitForResponse(match),trigger.click()]);assert.equal(initial.status(),200);const first=await initial.json(),root=first.folders.filter(row=>row.path==='images');assert.equal(root.length,1);
 const dialog=page.getByRole('dialog',{name:'اختيار صورة من المكتبة',exact:true});await expect(dialog).toHaveCount(1);await expect(dialog).toBeVisible();
 await dialog.getByRole('navigation',{name:'مجلدات الوسائط',exact:true}).getByRole('button').filter({has:page.getByText(root[0].displayName,{exact:true})}).click();
 const [found]=await Promise.all([page.waitForResponse(response=>match(response)&&new URL(response.url()).searchParams.get('q')===key&&new URL(response.url()).searchParams.get('folder')==='images'),dialog.getByPlaceholder('ابحث بالاسم أو المسار أو الوصف البديل…',{exact:true}).fill(key)]);
 assert.equal(found.status(),200);const asset=assertCoreImageCatalogResult(await found.json(),key),choice=dialog.locator('button[aria-pressed]').filter({has:page.getByText(asset.displayName,{exact:true})});await expect(choice).toHaveCount(1);await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
 await dialog.getByRole('button',{name:cancel?'إلغاء':'تأكيد الاختيار',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();return asset;
}
/** Real existing catalog controls only; no upload, hidden input injection or extra save. */
export async function exerciseCoreImageField({page,origin,form,name,altName,finalAlt='',finalEmpty=false,preserveNames=[]}){
 assert.ok(['logoUrl','compactLogoUrl','og_image'].includes(name));assert.equal(altName===undefined||altName==='og_image_alt',true);assert.equal(finalEmpty,name==='compactLogoUrl');assert.ok(preserveNames.every(key=>key!==name&&key!==altName));
 const owner=form.locator('[data-admin-media-image-field="'+name+'"]'),field=owner.locator('input[name="'+name+'"]'),alt=altName?form.locator('[name="'+altName+'"]'):null;await expect(owner).toHaveCount(1);await expect(field).toHaveCount(1);
 // SEO authors alt independently beside the image picker; removal must preserve that field.
 if(alt){await expect(alt).toHaveCount(1);await expect(owner.locator('[name="'+altName+'"]')).toHaveCount(0);}
 const readPreserved=async()=>{const values=[];for(const key of preserveNames){const input=form.locator('[name="'+key+'"]');await expect(input).toHaveCount(1);values.push([key,await input.inputValue()]);}return fingerprint(values);};
 const preserved=await readPreserved(),before=await field.inputValue(),beforeAlt=alt?await alt.inputValue():null,assets=[];
 const choose=async(index,cancel=false)=>{const value=await field.inputValue(),oldAlt=alt?await alt.inputValue():null,asset=await chooseCoreImageAsset({page,origin,trigger:owner.getByRole('button').first(),key:PRESENTATION_CONTROL_ASSETS[index],cancel});assets.push(asset);await expect(field).toHaveValue(cancel?value:asset.publicUrl);if(cancel&&alt)await expect(alt).toHaveValue(oldAlt);assert.equal(await readPreserved(),preserved);};
 await choose(0,true);await expect(field).toHaveValue(before);if(alt)await expect(alt).toHaveValue(beforeAlt);
 await choose(0);if(alt)await alt.fill('وصف مؤقت للصورة المختارة');await choose(1);await choose(2,true);
 const removalAlt=alt?await alt.inputValue():null;if(alt)assert.ok(removalAlt.length>0);
 await owner.getByRole('button',{name:'إزالة',exact:true}).click();await expect(field).toHaveValue('');if(alt)await expect(alt).toHaveValue(removalAlt);assert.equal(await readPreserved(),preserved);
 if(!finalEmpty){await choose(2);if(alt)await alt.fill(finalAlt);}
 const expected=CORE_DIRECT_IMAGE_VALUES[name];await expect(field).toHaveValue(expected);if(alt)await expect(alt).toHaveValue(finalAlt);assert.equal(await readPreserved(),preserved);
 return{receiptId:randomUUID(),sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,field:name,altField:altName??null,routePathname:new URL(page.url()).pathname,expected,expectedAlt:alt?finalAlt:null,operations:['cancel-original','select','replace','cancel-replace','remove',...(finalEmpty?[]:['select-final'])],catalogAssets:assets,actualCatalogApi:true,exactTriggerReturn:true,unrelatedFieldsPreserved:true,removeClearedAlt:alt?false:null,removePreservedAlt:alt?true:null,automaticCoverage:[],globalClosed:false,requiresNativeSaveAndReload:true};
}
export function assertCoreDirectImageReceipts(rows,expectedNames,sourceSha256){
 assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.deepEqual(rows.map(row=>row.field),expectedNames);assert.equal(new Set(rows.map(row=>row.receiptId)).size,rows.length);
 for(const row of rows){assert.match(row.receiptId,/^[a-f0-9-]{36}$/iu);assert.equal(row.sourceSha256,sourceSha256);assert.ok(Object.hasOwn(CORE_DIRECT_IMAGE_VALUES,row.field));assert.equal(row.expected,CORE_DIRECT_IMAGE_VALUES[row.field]);assert.deepEqual(row.operations,['cancel-original','select','replace','cancel-replace','remove',...(row.field==='compactLogoUrl'?[]:['select-final'])]);assert.equal(row.catalogAssets.length,row.field==='compactLogoUrl'?4:5);for(const[index,key]of[0,0,1,2,...(row.field==='compactLogoUrl'?[]:[2])].entries())assertCoreImageCatalogResult({assets:[row.catalogAssets[index]]},PRESENTATION_CONTROL_ASSETS[key]);for(const key of['actualCatalogApi','exactTriggerReturn','unrelatedFieldsPreserved','requiresNativeSaveAndReload'])assert.equal(row[key],true);assert.deepEqual(row.automaticCoverage,[]);assert.equal(row.globalClosed,false);if(row.field==='og_image'){assert.equal(row.altField,'og_image_alt');assert.equal(row.expectedAlt,CORE_DIRECT_IMAGE_VALUES.og_image_alt);assert.equal(row.removeClearedAlt,false);assert.equal(row.removePreservedAlt,true);}else{assert.equal(row.altField,null);assert.equal(row.expectedAlt,null);}}
 return{status:'partial-not-global-pass',fields:expectedNames,automaticCoverage:[],globalClosed:false,requiresNativeSaveAndReload:true};
}

/** Bind Company image controls to the existing accepted save, denial proof and exact native JSON. */
export function assertCoreCompanyImageCompletion(browser,native,ownedRunId){
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.cohort,'domain-forms');assert.equal(browser.journeySelection??null,null);assert.deepEqual(browser.errors,[]);assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);
 const found=browser.evidence.filter(row=>row.id==='core-company-settings-rejection-preservation-save-reload');assert.equal(found.length,1);const row=found[0];assert.equal(row.status,'pass');assert.equal(row.consumer,'company-identity-settings');assert.equal(row.reloaded,true);assert.equal(row.nativeReadbackRequired,true);
 const controls=assertCoreDirectImageReceipts(row.imageAdoption,['logoUrl','compactLogoUrl'],browser.sourceSha256);for(const proof of row.imageAdoption)assert.equal(proof.routePathname,'/admin/settings/general');
 const saves=native.records.filter(item=>item.kind==='form-save-native'&&item.caseId==='core-company-settings-accepted-save');assert.equal(saves.length,1);const saved=saves[0];assert.equal(saved.status,'partial-not-global-pass');assert.equal(saved.formConsumer,row.consumer);assert.equal(saved.surface,'singleton-settings');assert.equal(saved.writes.length,1);const write=saved.writes[0];assert.equal(write.table,'site_settings');assert.equal(write.id,'admin.company');assert.equal(write.deleted,false);
 for(const name of ['logoUrl','compactLogoUrl']){const value=write.json.filter(item=>item.column==='value'&&JSON.stringify(item.path)===JSON.stringify([name]));assert.equal(value.length,1);assert.equal(value[0].actual,CORE_DIRECT_IMAGE_VALUES[name]);}
 assert.equal(write.audit.length,1);const audit=write.audit[0];assert.equal(audit.action,'site_settings.update');assert.equal(audit.entity_type,'site_settings');assert.equal(audit.entity_label,'admin.company');assert.ok(Number.isSafeInteger(write.expectedActorId)&&write.expectedActorId>0);assert.equal(Number(audit.actor_admin_user_id),write.expectedActorId);
 const permission=row.permissionEvidence.filter(item=>item.caseId===saved.caseId);assert.equal(permission.length,1);assert.equal(permission[0].originalNativeSaveReceipt,saved.id);assert.equal(permission[0].ownedRunId,ownedRunId);assert.equal(permission[0].originalNativeSaveVerified,true);assert.equal(permission[0].status,'pass');
 for(const key of ['form:company-identity-settings:capability:media','collection:settings-pages:capability:media'])assert.equal(browser.requiredCases.filter(item=>item.key===key&&item.axis==='media').length,1);
 return{...controls,nativeSaveReceipt:saved.id,actorId:write.expectedActorId,ownedRunId,qualifyingNamedFragments:['form:company-identity-settings:capability:media','collection:settings-pages:capability:media'],automaticCoverage:[],globalClosed:false};
}
