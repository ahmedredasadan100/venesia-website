import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {expect} from 'playwright/test';

export async function verifyPickerUploads({page,origin,api,transfers}) {
  const json=data=>page.request.post(origin+api,{data});
  const assets=[];
  const small=await sharp({create:{width:64,height:64,channels:3,background:'#456789'}}).png().toBuffer();
  for(const folder of ['files/home','images/home']) {
    const result=await json({operation:'create_folder',folder,displayName:'home'});
    assert.equal(result.status(),201,await result.text());
  }
  const wrong=await json({operation:'prepare_upload',folder:'files/home',kind:'image',file:{name:'slide-1.jpg',type:'image/jpeg',size:small.length}});
  assert.equal(wrong.status(),400);assert.match((await wrong.json()).error,/نوع الملف لا يطابق/);
  async function upload(scope,name,mimeType,buffer) {
    const pending=page.waitForResponse(r=>r.url()===origin+api && r.request().postDataJSON()?.operation==='complete_upload');
    await scope.locator('input[type="file"][multiple]').setInputFiles({name,mimeType,buffer});
    const response=await pending;assert.equal(response.status(),201,await response.text());
    const asset=(await response.json()).asset;
    const stored=await page.request.get(asset.publicUrl);assert.equal(stored.status(),200);assert.deepEqual(await stored.body(),buffer);
    assets.push(asset);return asset;
  }
  await page.goto(origin+'/admin/pages-blocks/blocks/hero/900001');
  await page.locator('[data-admin-tab-id="media"]').click();
  const desktop=page.locator('[data-hero-media-section="desktop"]');
  for(const [ext,mime] of [['jpg','image/jpeg'],['png','image/png'],['webp','image/webp']]) {
    await desktop.locator('[data-admin-media-gallery-action="add"]').click();
    const picker=page.getByRole('dialog',{name:'اختيار صورة من المكتبة',exact:true});
    await expect(picker.locator('[data-media-folder-path="images/home"]')).toBeVisible();
    await expect(picker.locator('[data-media-folder-path^="files"]')).toHaveCount(0);
    assert.ok(!(await picker.locator('input[type="file"][multiple]').getAttribute('accept')).includes('pdf'));
    await picker.locator('[data-media-folder-path="images/home"]').click();
    const buffer=await sharp(small).toFormat(ext==='jpg'?'jpeg':ext).toBuffer();
    const asset=await upload(picker,'scope-slide-'+ext+'.'+ext,mime,buffer);
    assert.ok(asset.objectKey.startsWith('images/home/'));
    await picker.locator('button[aria-pressed]').filter({hasText:asset.displayName}).click();
    await picker.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
    await expect(picker).toHaveCount(0);
  }
  await page.getByRole('button',{name:'حفظ الهيرو',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.has('saved'));
  await page.reload();await page.locator('[data-admin-tab-id="media"]').click();
  const saved=await desktop.locator('[name="images"]').inputValue();
  for(const asset of assets)assert.ok(saved.includes(asset.publicUrl));
  await desktop.locator('[data-admin-media-gallery-action="add"]').click();
  const picker=page.getByRole('dialog',{name:'اختيار صورة من المكتبة',exact:true});const before=transfers.length;
  await picker.locator('input[type="file"][multiple]').setInputFiles({name:'wrong.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4')});
  await expect(picker.getByText(/امتداد غير مدعوم/).first()).toBeVisible();assert.equal(transfers.length,before);
  await picker.getByRole('button',{name:'إلغاء',exact:true}).click();
  await page.goto(origin+'/admin/media-library?folder=files/home&kind=document');
  const library=page.locator('[data-media-library-mode="manage"]');
  await expect(library.locator('[data-media-folder-path="files/home"]')).toBeVisible();
  const image=await upload(library,'scope-library.jpg','image/jpeg',await sharp(small).jpeg().toBuffer());
  assert.ok(image.objectKey.startsWith('images/'));
  await expect(library.locator('[data-media-folder-path="images"]')).toHaveAttribute('aria-current','page');
  await page.goto(origin+'/admin/media-library?folder=files/home');
  const pdf=await upload(library,'scope-library.pdf','application/pdf',Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'));
  assert.ok(pdf.objectKey.startsWith('files/home/'));
  writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT,'slider-upload-browser-proof.json'),JSON.stringify({status:'pass',assets,saveReload:true,imagePickerRejectsPdf:true,wrongFolderServerRejected:true,productionAccess:false},null,2));
}
