import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {expect} from 'playwright/test';

async function verifyHeroImagePresentation(page, variant) {
  const previous = page.viewportSize();
  const cases = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const device of ['desktop', 'mobile']) {
      const field = page.locator('[data-hero-media-section="' + device + '"]');
      await expect(field.locator('[data-media-slot]')).toHaveCount(0);
      assert.doesNotMatch(await field.innerText(), /100vh|768px|767px|cover|crop|قائمة مستقلة|الحركة|الطبقات|موضع القص|نسبة العرض|المقاس الموصى/u);
      const cards = field.locator('[data-admin-media-gallery-card="image"]');
      const count = await cards.count();
      for (let index = 0; index < count; index++) {
        const card = cards.nth(index);
        const original = card.locator('[data-media-original]');
        await expect(original).toHaveText('الأبعاد الأصلية: 64 × 64 px');
        const image = card.locator('img');
        await expect(image).toBeVisible();
        const imageBox = await image.boundingBox();
        const originalBox = await original.boundingBox();
        assert(imageBox && originalBox);
        const gap = originalBox.y - imageBox.y - imageBox.height;
        assert(gap >= 0 && gap <= 16, 'Original dimensions immediately follow the image');
      }
      cases.push({ variant, width, device, images: count, guidance: 0, originalDimensions: '64 × 64 px', status: 'pass' });
    }
    await page.locator('[data-hero-media-sections]').screenshot({ path: path.join(process.env.QA_ADMIN_OUTPUT, 'hero-image-presentation-' + variant + '-' + width + '.png') });
  }
  await page.setViewportSize(previous);
  writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT, 'hero-image-presentation-' + variant + '.json'), JSON.stringify({ status: 'pass', cases, productionAccess: false }, null, 2));
}

async function verifyHomeStoryImagePresentation(page, origin, assets) {
  await page.goto(origin + '/admin/pages-blocks/blocks/content');
  await page.getByRole('button', { name: 'إضافة بلوك', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'إضافة بلوك جديد', exact: true });
  await create.locator('[name="name"]').fill('QA Home Story guidance');
  await create.locator('[name="slug"]').fill('home-story');
  await create.getByRole('button', { name: 'إنشاء وفتح', exact: true }).click();
  await page.waitForURL(/\/content\/\d+/);
  const editPath = new URL(page.url()).pathname;
  async function reopen() { await page.goto(origin + editPath); await page.locator('[data-admin-tab-id="images"]').click(); }
  async function save() { await page.getByRole('button', { name: 'حفظ الموديول', exact: true }).click(); await page.waitForURL(url => url.searchParams.has('saved')); await reopen(); }
  await reopen();
  async function select(name, asset, folder) {
    const field = page.locator('[data-admin-media-image-field="' + name + '"]');
    await field.getByRole('button').first().click();
    const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true });
    await picker.locator('[data-media-folder-path="' + folder + '"]').click();
    await picker.locator('button[aria-pressed]').filter({ hasText: asset.displayName }).click();
    await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click();
    await expect(field.locator('[name="' + name + '"]')).toHaveValue(asset.publicUrl);
  }
  await select('image_main', assets[0], 'images/home');
  await select('image_secondary', assets[1], 'images/home');
  await save();
  await select('image_main', assets[2], 'images/home/nested');
  await save();
  const cases = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, expected] of [['image_main', assets[2]], ['image_secondary', assets[1]]]) {
      const field = page.locator('[data-admin-media-image-field="' + name + '"]');
      await expect(field.locator('[name="' + name + '"]')).toHaveValue(expected.publicUrl);
      await expect(field.locator('[data-media-slot]')).toHaveCount(0);
      await expect(field.locator('[data-media-original]')).toHaveText('الأبعاد الأصلية: 64 × 64 px');
      assert.doesNotMatch(await field.innerText(), /صورتان متداخلتان|تملأ الصورة الحاوية|قد تُقص|نسبة موحدة|أبعاد ملف مطلوبة/u);
      const imageBox = await field.locator('img').boundingBox();
      const dimensionsBox = await field.locator('[data-media-original]').boundingBox();
      assert(imageBox && dimensionsBox);
      const gap = dimensionsBox.y - imageBox.y - imageBox.height;
      assert(gap >= 0 && gap <= 20);
      cases.push({ width, name, guidance: 0, originalDimensions: '64 × 64 px', pickerReplaceSaveReload: true });
    }
    await page.screenshot({ path: path.join(process.env.QA_ADMIN_OUTPUT, 'home-story-image-presentation-' + width + '.png'), fullPage: true });
  }
  writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT, 'home-story-image-presentation.json'), JSON.stringify({ status: 'pass', cases, productionAccess: false }, null, 2));
  // Keep the later relocation journey's original reference fixture unchanged.
  for (const name of ['image_main', 'image_secondary']) await page.locator('[data-admin-media-image-field="' + name + '"]').getByRole('button', { name: 'إزالة', exact: true }).click();
  await save();
  await page.setViewportSize({ width: 1440, height: 900 });
}

export async function verifyPickerUploads({page,origin,api,transfers}) {
  const json=data=>page.request.post(origin+api,{data});
  async function saveHero() {
    const saved=page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname===new URL(page.url()).pathname);
    await page.getByRole('button',{name:'حفظ الهيرو',exact:true}).click();
    const response=await saved;assert.ok(response.ok());
    await page.waitForURL(url=>url.searchParams.has("saved"));
  }
  const assets=[];
  const small=await sharp({create:{width:64,height:64,channels:3,background:'#456789'}}).png().toBuffer();
  for(const folder of ['files/home','images/home','images/home/nested']) {
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
    const destination=ext==='webp'?'images/home/nested':'images/home';
    await picker.locator('[data-media-folder-path="'+destination+'"]').click();
    await expect(picker.locator('[data-media-upload-destination]')).toHaveAttribute('data-media-upload-destination',destination);
    const buffer=await sharp(small).toFormat(ext==='jpg'?'jpeg':ext, ext==='webp' ? {lossless:true} : {}).toBuffer();
    const asset=await upload(picker,'scope-slide-'+ext+'.'+ext,mime,buffer);
    assert.equal(asset.folderPath,destination);assert.ok(asset.objectKey.startsWith(destination+'/'));
    await picker.locator('button[aria-pressed]').filter({hasText:asset.displayName}).click();
    await picker.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
    await expect(picker).toHaveCount(0);
  }
  await page.getByRole('button',{name:'حفظ الهيرو',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.has('saved'));
  await page.goto(origin+new URL(page.url()).pathname);await page.locator('[data-admin-tab-id="media"]').click();
  const saved=await desktop.locator('[name="images"]').inputValue();
  const mobile=page.locator('[data-hero-media-section="mobile"]');
  await mobile.locator('[data-admin-media-gallery-action="add"]').click();
  const existingPicker=page.getByRole('dialog',{name:'اختيار صورة من المكتبة',exact:true});
  await existingPicker.locator('[data-media-folder-path="images/home/nested"]').click();
  await expect(existingPicker.locator('[data-media-upload-destination]')).toHaveAttribute('data-media-upload-destination','images/home/nested');
  await existingPicker.locator('button[aria-pressed]').filter({hasText:assets[2].displayName}).click();
  await existingPicker.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
  await saveHero();await page.goto(origin+new URL(page.url()).pathname);await page.locator('[data-admin-tab-id="media"]').click();
  assert.ok((await mobile.locator('[name="mobile_images"]').inputValue()).includes(assets[2].publicUrl));
  for(const asset of assets)assert.ok(saved.includes(asset.publicUrl));
  await verifyHeroImagePresentation(page, 'cinematic');
  await desktop.locator('[data-admin-media-gallery-action="add"]').click();
  const picker=page.getByRole('dialog',{name:'اختيار صورة من المكتبة',exact:true});const before=transfers.length;
  const created=await json({operation:'create_folder',folder:'images/new-dynamic-folder',displayName:'New Dynamic Folder'});assert.equal(created.status(),201);
  await picker.getByRole('button',{name:'تحديث المجلدات',exact:true}).click();
  await expect(picker.locator('[data-media-folder-path="images/new-dynamic-folder"]')).toBeVisible();
  await picker.locator('[data-media-folder-path="images/home/nested"]').click();
  await picker.getByRole('button',{name:'المجلد الأعلى',exact:true}).click();
  await expect(picker.locator('[data-media-upload-destination]')).toHaveAttribute('data-media-upload-destination','images/home');
  await expect(picker.locator('button[aria-pressed]').filter({hasText:assets[2].displayName})).toHaveCount(0);
  await picker.locator('input[type="file"][multiple]').setInputFiles({name:'wrong.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4')});
  await expect(picker.getByText(/امتداد غير مدعوم/).first()).toBeVisible();assert.equal(transfers.length,before);
  await picker.getByRole('button',{name:'إلغاء',exact:true}).click();
  await page.goto(origin+'/admin/pages-blocks/blocks/hero');
  await page.getByRole('button',{name:'إضافة هيرو',exact:true}).click();
  const create=page.getByRole('dialog');await create.locator('[name=name]').fill('QA Folder Aware Internal Hero');await create.locator('[name=slug]').fill('qa-folder-aware-internal');
  await create.getByRole('combobox',{name:'نمط العرض',exact:true}).click();await page.getByRole('option',{name:'صفحة داخلية',exact:true}).click();
  assert.equal(await create.locator('input[type=hidden][name=status]').inputValue(),'unpublished');
  await create.getByRole('button',{name:'إنشاء وفتح',exact:true}).click();await page.waitForURL(/\/hero\/\d+/);
  await page.locator('[data-admin-tab-id="media"]').click();
  await page.locator('[data-hero-media-section="desktop"] [data-admin-media-gallery-action="add"]').click();
  const internalPicker=page.getByRole('dialog',{name:'اختيار صورة من المكتبة',exact:true});
  await internalPicker.locator('[data-media-folder-path="images/home/nested"]').click();
  await internalPicker.locator('button[aria-pressed]').filter({hasText:assets[2].displayName}).click();
  await internalPicker.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
  await saveHero();await page.goto(origin+new URL(page.url()).pathname);await page.locator('[data-admin-tab-id="media"]').click();
  assert.ok((await page.locator('[data-hero-media-section="desktop"] [name="images"]').inputValue()).includes(assets[2].publicUrl));
  await verifyHeroImagePresentation(page, 'internal');
  await verifyHomeStoryImagePresentation(page, origin, assets);
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
