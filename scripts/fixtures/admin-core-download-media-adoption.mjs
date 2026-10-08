import {coreTemplateControlKinds} from './admin-core-template-controls-contract.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {expect} from 'playwright/test';

export const CORE_DOWNLOAD_MEDIA_KEY='files/projects/download-contract.pdf';
/** Deterministic owned PDF fixture; never a deployed content dependency. */
export function createCoreDownloadPdfFixture(){
 const stream='BT /F1 12 Tf 20 50 Td (Owned download contract fixture) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((body,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${body}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}
export const CORE_DOWNLOAD_MEDIA_HREF='/'+CORE_DOWNLOAD_MEDIA_KEY;
export const CORE_DOWNLOAD_LINK=Object.freeze({link_kind:'download',linked_type:null,linked_id:null,href:CORE_DOWNLOAD_MEDIA_HREF,anchor:null,target:'_blank',meta:null});
export const CORE_DOWNLOAD_OPERATIONS=Object.freeze(['nested-cancel-original','outer-cancel-after-selection','replace-external-with-pdf','cancel-existing-pdf','clear','reselect-final-pdf']);
export function assertCoreDownloadAsset(asset,expected){
 assert.ok(asset&&expected);assert.equal(expected.objectKey,CORE_DOWNLOAD_MEDIA_KEY);assert.equal(expected.publicUrl,CORE_DOWNLOAD_MEDIA_HREF);assert.match(expected.fileSha256,/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(expected.sizeBytes)&&expected.sizeBytes>0);
 for(const key of ['id','objectKey','publicUrl','displayName','catalogRegistered'])assert.equal(asset[key],expected[key]);assert.equal(asset.provider,'filesystem');assert.equal(asset.bucket,'public');assert.equal(asset.kind,'document');assert.equal(asset.mimeType,'application/pdf');assert.equal(asset.sizeBytes,expected.sizeBytes);assert.equal(asset.missingObject,false);
 if(expected.catalogRegistered)assert.match(asset.id,/^[a-f0-9-]{36}$/iu);else assert.equal(asset.id,'unmanaged:'+CORE_DOWNLOAD_MEDIA_HREF);
 return {id:asset.id,objectKey:asset.objectKey,publicUrl:asset.publicUrl,displayName:asset.displayName,catalogRegistered:asset.catalogRegistered,provider:asset.provider,bucket:asset.bucket,kind:asset.kind,mimeType:asset.mimeType,sizeBytes:asset.sizeBytes,missingObject:asset.missingObject};
}
/** Actual Download -> nested PDF picker, not an external Link proxy. No upload or direct hidden-field authoring. */
export async function exerciseCoreDownloadField({page,origin,owner,asset,assertCurrent,clearLabel='مسح الرابط',originalHref,field}){
 const base=new URL(origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);assert.equal(new URL(page.url()).origin,origin);assert.match(originalHref,/^https:\/\/example\.invalid\//u);assert.ok(['primary_cta','item_0','manual_item_0','menu_link','footer_manual_link'].includes(field));
 const fileResponse=await page.request.get(new URL(CORE_DOWNLOAD_MEDIA_HREF,origin).href,{maxRedirects:0});assert.equal(fileResponse.status(),200);const fileBytes=await fileResponse.body(),contentType=fileResponse.headers()['content-type']?.split(';')[0].trim();assert.equal(contentType,'application/pdf');assert.equal(fileBytes.subarray(0,5).toString(),'%PDF-');assert.equal(fileBytes.length,asset.sizeBytes);assert.equal(createHash('sha256').update(fileBytes).digest('hex'),asset.fileSha256);const servedFile={status:200,href:CORE_DOWNLOAD_MEDIA_HREF,contentType,sha256:asset.fileSha256,sizeBytes:asset.sizeBytes};
 const trigger=owner.getByRole('button',{name:'اختيار الرابط',exact:true}),outer=()=>page.getByRole('dialog',{name:'اختيار رابط',exact:true}),nested=()=>page.getByRole('dialog',{name:'اختيار مستند من المكتبة',exact:true});await expect(trigger).toHaveCount(1);const selected=[];
 const matches=response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==='/api/admin/media-library'&&response.request().method()==='GET';};
 async function open(){await trigger.click();await expect(outer()).toBeVisible();await outer().getByRole('button',{name:'Download',exact:true}).click();}
 async function choose(cancel){const download=outer().getByPlaceholder('/files/projects/brochure.pdf',{exact:true}),before=await download.inputValue(),pick=outer().getByRole('button',{name:'اختر من المكتبة',exact:true});await expect(download).toHaveAttribute('readonly','');const[initial]=await Promise.all([page.waitForResponse(matches),pick.click()]);assert.equal(initial.status(),200);await expect(nested()).toBeVisible();const payload=await initial.json(),roots=payload.folders.filter(row=>row.path==='files');assert.equal(roots.length,1);
  await nested().getByRole('navigation',{name:'مجلدات الوسائط',exact:true}).getByRole('button').filter({has:page.getByText(roots[0].displayName,{exact:true})}).click();const[found]=await Promise.all([page.waitForResponse(response=>matches(response)&&new URL(response.url()).searchParams.get('q')===CORE_DOWNLOAD_MEDIA_KEY&&new URL(response.url()).searchParams.get('folder')==='files'),nested().getByPlaceholder('ابحث بالاسم أو المسار أو الوصف البديل…',{exact:true}).fill(CORE_DOWNLOAD_MEDIA_KEY)]);assert.equal(found.status(),200);const data=await found.json();assert.equal(data.assets.length,1);selected.push(assertCoreDownloadAsset(data.assets[0],asset));const choice=nested().locator('button[aria-pressed]').filter({has:page.getByText(asset.displayName,{exact:true})});await expect(choice).toHaveCount(1);await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');await expect(download).toHaveValue(before);await nested().getByRole('button',{name:cancel?'إلغاء':'تأكيد الاختيار',exact:true}).click();await expect(nested()).toHaveCount(0);await expect(pick).toBeFocused();await expect(download).toHaveValue(cancel?before:CORE_DOWNLOAD_MEDIA_HREF);
 }
 const cancelOuter=async()=>{await outer().getByRole('button',{name:'إلغاء',exact:true}).click();await expect(outer()).toHaveCount(0);await expect(trigger).toBeFocused();};
 const acceptOuter=async()=>{await outer().getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await expect(outer()).toHaveCount(0);await expect(trigger).toBeFocused();};
 await assertCurrent(originalHref,'external');await open();await choose(true);await assertCurrent(originalHref,'external');await cancelOuter();await assertCurrent(originalHref,'external');
 await open();await choose(false);await assertCurrent(originalHref,'external');await cancelOuter();await assertCurrent(originalHref,'external');
 await open();await choose(false);await assertCurrent(originalHref,'external');await acceptOuter();await assertCurrent(CORE_DOWNLOAD_MEDIA_HREF,'download');
 await open();await choose(true);await cancelOuter();await assertCurrent(CORE_DOWNLOAD_MEDIA_HREF,'download');
 await owner.getByRole('button',{name:clearLabel,exact:true}).click();await assertCurrent('','none');await open();await choose(false);await acceptOuter();await assertCurrent(CORE_DOWNLOAD_MEDIA_HREF,'download');
 return {receiptId:randomUUID(),sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,field,routePathname:new URL(page.url()).pathname,asset,servedFile,selected,operations:[...CORE_DOWNLOAD_OPERATIONS],nestedPdfMode:true,selectionBeforeOuterConfirmationPreserved:true,exactNestedFocusReturn:true,exactOuterFocusReturn:true,unmanagedFileUnmodifiedRequired:true,originalHref,finalHref:CORE_DOWNLOAD_MEDIA_HREF,finalTarget:'_blank',distinctPdfReplacement:false,limitation:'One owned fixture PDF; replacement is existing external destination to this PDF, not two distinct PDF assets.',automaticCoverage:[],globalClosed:false,requiresNativeSaveReload:true};
}
export function assertCoreDownloadReceipt(row,{field,routePathname,asset,sourceSha256}){
 assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(row.sourceSha256,sourceSha256);assert.match(row.receiptId,/^[a-f0-9-]{36}$/iu);assert.equal(row.field,field);assert.equal(row.routePathname,routePathname);assert.deepEqual(row.asset,asset);assert.deepEqual(row.servedFile,{status:200,href:CORE_DOWNLOAD_MEDIA_HREF,contentType:'application/pdf',sha256:asset.fileSha256,sizeBytes:asset.sizeBytes});assert.deepEqual(row.operations,CORE_DOWNLOAD_OPERATIONS);assert.equal(row.selected.length,5);for(const selected of row.selected)assertCoreDownloadAsset(selected,asset);for(const key of ['nestedPdfMode','selectionBeforeOuterConfirmationPreserved','exactNestedFocusReturn','exactOuterFocusReturn','unmanagedFileUnmodifiedRequired','requiresNativeSaveReload'])assert.equal(row[key],true);assert.equal(row.finalHref,CORE_DOWNLOAD_MEDIA_HREF);assert.equal(row.finalTarget,'_blank');assert.equal(row.distinctPdfReplacement,false);assert.ok(row.limitation.length);assert.deepEqual(row.automaticCoverage,[]);assert.equal(row.globalClosed,false);return {status:'partial-not-global-pass',field,routePathname,automaticCoverage:[],globalClosed:false};
}

/** Exact same-run Browser/native join. Named Media fragments remain partial, never a full axis claim. */
export function assertCoreDownloadJoin({browser,nativeRecords,ownedRecords,asset,sourceSha256}) {
 assert.equal(browser.status,'pass');assert.equal(browser.globalClosed,false);assert.equal(browser.sourceSha256,sourceSha256);
 assert.ok(['template-controls','navigation-settings'].includes(browser.cohort));assert.ok(Array.isArray(nativeRecords)&&Array.isArray(ownedRecords));assert.ok(ownedRecords.length);
 const kind=browser.cohort==='template-controls'?'template-controls-state':'navigation-settings-state';
 assert.deepEqual(nativeRecords.filter(row=>row.kind===kind),ownedRecords,'Saved native artifacts must match every fixed checkpoint captured by the owned verifier.');
 for(const row of ownedRecords){assert.equal(row.status,'pass');assert.equal(row.downloadMedia.status,'pass');assert.deepEqual(row.downloadMedia.asset,asset);assert.equal(row.downloadMedia.fileUnchanged,true);assert.equal(row.downloadMedia.catalogRowsUnchanged,true);assert.match(row.downloadMedia.catalogAssetsSha256,/^[a-f0-9]{64}$/u);}
 const specs=browser.cohort==='template-controls'
 ? [['cards','item_0','block-template-cards-editor'],['breadcrumb','manual_item_0','block-template-breadcrumb-editor'],['cta','primary_cta','block-template-cta-editor']].filter(([kind])=>coreTemplateControlKinds(browser.journeySelection??null).includes(kind))
 : (browser.journeySelection==='navigation-settings-footer-followup'?[['footer','footer_manual_link','footer-builder']]:[['menu','menu_link','menu-builder'],['footer','footer_manual_link','footer-builder']]);
 const results=[];
 for(const [entity,field,consumer]of specs){
  const records=ownedRecords.filter(row=>browser.cohort==='template-controls'?row.recipe===entity:row.entity===entity);
  const saved=records.filter(row=>row.phase===(entity==='menu'?'item-edited':'saved'));assert.equal(saved.length,1);
  let receipt,routePathname,journeyId;
  if(browser.cohort==='template-controls'){
   const outcomes=browser.templateControls.outcomes.filter(row=>row.kind===entity);assert.equal(outcomes.length,1);receipt=outcomes[0].downloadMedia;
   assert.deepEqual(records.map(row=>row.phase),['baseline','draft','negative','saved','reloaded']);assert.equal(saved[0].auditCount,1);assert.equal(saved[0].actorBound,true);
   assert.equal(records.at(-1).auditCount,0);assert.equal(records.at(-1).rowHash,saved[0].rowHash);assert.ok(records.every(row=>row.templateId===saved[0].templateId));
   routePathname='/admin/pages-blocks/blocks/'+entity+'/'+saved[0].templateId;journeyId='core-template-controls-'+entity;
  }else{
   const receipts=browser.navigationSettings.downloadMedia.filter(row=>row.field===field);assert.equal(receipts.length,1);receipt=receipts[0];
   assert.ok(saved[0].actorBoundAuditCount>0);
   if(entity==='menu'){assert.equal(records.filter(row=>row.phase==='reparented').length,1);routePathname='/admin/pages-blocks/menus/'+saved[0].menuId;journeyId='core-navigation-menu-metadata-item-graph-commands';}
   else{assert.equal(records.filter(row=>row.phase==='reloaded').length,1);routePathname='/admin/pages-blocks/footer';journeyId='core-navigation-footer-aggregate-slots-manual-links-rejection-retry';}
  }
  const evidence=browser.evidence.filter(row=>row.id===journeyId);assert.equal(evidence.length,1);assert.equal(evidence[0].status,'pass');
  const joined=assertCoreDownloadReceipt(receipt,{field,routePathname,asset,sourceSha256});
  const consumers=[['form',consumer],...(entity==='menu'?[['collection','menu-editor-shell'],['collection','menu-items']]:entity==='footer'?[['collection','footer-builder-shell'],['collection','footer-fixed-slots'],['collection','footer-manual-links']]:[])];
  const bindings=consumers.map(([boundary,id])=>{const found=browser.requiredCases.filter(row=>row.boundary===boundary&&row.consumer===id&&row.axis==='media');assert.equal(found.length,1,'Existing canonical Media identity must remain present.');return{boundary,consumer:id,key:found[0].key};});
  results.push({...joined,consumer,bindings,journeyId,nativeCheckpointIds:records.map(row=>row.id),originalFileUnchanged:true,catalogRowsUnchanged:true});
 }
 const receipts=browser.cohort==='template-controls'?browser.templateControls.outcomes.filter(row=>row.downloadMedia).map(row=>row.downloadMedia):browser.navigationSettings.downloadMedia;
 assert.equal(receipts.length,specs.length);assert.equal(new Set(receipts.map(row=>row.receiptId)).size,receipts.length);
 return {status:'partial-not-global-pass',observations:results,fieldCount:specs.length,namedMediaCells:results.reduce((n,row)=>n+row.bindings.length,0),automaticCoverage:[],globalClosed:false,distinctPdfReplacement:false};
}

