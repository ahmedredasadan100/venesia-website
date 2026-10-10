import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {expect} from 'playwright/test';

export async function verifyDeleteAndResponsiveHero({page,origin,api,ownerFixtures}) {
  assert.equal(new URL(origin).hostname,'127.0.0.1');
  const folder='images/qa-delete-responsive';
  const post=data=>page.request.post(origin+api,{data});
  assert.equal((await post({operation:'create_folder',folder})).status(),201);
  const assets=[];
  for(let index=0;index<12;index++){
    const buffer=await sharp({create:{width:48,height:64,channels:3,background:{r:20+index*15,g:80,b:130}}}).jpeg().toBuffer();
    const prepared=await post({operation:'prepare_upload',folder,kind:'image',file:{name:`qa-delete-responsive-${index}.jpg`,type:'image/jpeg',size:buffer.length}});
    assert.equal(prepared.status(),200,await prepared.text());const pending=await prepared.json();
    assert.equal(new URL(pending.signedUrl).hostname,'127.0.0.1');
    const uploaded=await page.request.put(pending.signedUrl,{multipart:{'':{name:'image.jpg',mimeType:'image/jpeg',buffer}}});assert.ok(uploaded.ok(),await uploaded.text());
    const completed=await post({operation:'complete_upload',receipt:pending.receipt});assert.equal(completed.status(),201,await completed.text());assets.push((await completed.json()).asset);
  }
  const heroPath='/admin/pages-blocks/blocks/hero/900003';
  async function saveHero(desktop,mobile){
    await page.goto(origin+heroPath);await page.locator('[data-admin-tab-id="media"]').click();
    // Exercise the real saved-form contract; picker interaction is independently covered in this same owner.
    await page.locator('form').filter({has:page.locator('[name="images"]')}).evaluate((form,values)=>{
      form.addEventListener('formdata',event=>{event.formData.set('images',values[0].join('\n'));event.formData.set('mobile_images',values[1].join('\n'));});
    },[desktop,mobile]);
    await page.getByRole('button',{name:'حفظ الهيرو',exact:true}).click();await page.waitForURL(url=>url.searchParams.has('saved'));
    await page.goto(origin+heroPath);await page.locator('[data-admin-tab-id="media"]').click();
    assert.deepEqual((await page.locator('[name="images"]').inputValue()).split('\n').filter(Boolean),desktop);
    assert.deepEqual((await page.locator('[name="mobile_images"]').inputValue()).split('\n').filter(Boolean),mobile);
  }
  const urls=assets.map(asset=>asset.publicUrl),heroCases=[];
  for(const [desktop,mobile] of [[urls.slice(0,2),urls.slice(2,12)],[urls.slice(0,5),[]],[[urls[0]],[urls[1]]],[[],urls.slice(2,12)]]){
    await saveHero(desktop,mobile);
    for(const [width,height,expected] of [[1440,900,desktop],[390,844,mobile.length?mobile:desktop]]){
      await page.setViewportSize({width,height});await page.goto(origin+'/qa-isolated-hero');
      const hero=page.locator('[data-hero-variant="home-cinematic"]');await expect(hero).toBeVisible();
      await expect(hero.locator('.hero-slide-fade')).toHaveCount(expected.length);
      for(let index=0;index<expected.length;index++){
        if(expected.length>1)await hero.getByRole('button',{name:`الشريحة ${index+1}`,exact:true}).click();
        const slide=hero.locator('.hero-slide-fade').nth(index);
        await expect.poll(async()=>slide.locator('img').evaluate(img=>decodeURIComponent(img.currentSrc||img.src))).toContain(expected[index]);
      }
      const rendered=await hero.locator('img').evaluateAll(images=>images.map(img=>decodeURIComponent(img.currentSrc||img.src)));
      assert.ok(rendered.every(src=>expected.some(url=>src.includes(url))));
      const label=`${desktop.length}-${mobile.length}-${width}`;
      await page.screenshot({path:path.join(process.env.QA_ADMIN_OUTPUT,`hero-${label}.png`)});
      heroCases.push({desktop:desktop.length,mobile:mobile.length,width,count:expected.length,sources:rendered});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await saveHero([urls[0],urls[1]],[urls[2]]);
  await page.goto(origin+'/admin/projects/'+ownerFixtures.project.id);
  const sharedUrl=await page.locator('[name="image"]').inputValue();assert.ok(sharedUrl);
  async function deleteUi(rows,folderMode=false) {
    await page.goto(origin+'/admin/media-library?view=all&kind=image&pageSize=100'+(folderMode?'&folder='+encodeURIComponent(folder):''));
    await page.waitForLoadState('networkidle');
    const pageSize=page.getByRole('button',{name:'10',exact:true});
    if(await pageSize.count()){await pageSize.click();await page.getByRole('option',{name:'100',exact:true}).click();}
    if(folderMode) await page.getByRole('button',{name:'حذف المجلد',exact:true}).click();
    else {
      for(const asset of rows) await page.locator('[data-media-library-mode="manage"] button[aria-pressed]').filter({hasText:asset.displayName}).click();
      await page.getByRole('button',{name:'حذف آمن ('+rows.length+')',exact:true}).click();
    }
    const dialog=page.getByRole('dialog');await expect(dialog.locator('[data-media-delete-preview]')).toBeVisible();
    const confirm=dialog.getByRole('button',{name:'حذف رغم الاستخدام',exact:true});await expect(confirm).toBeEnabled();
    await page.screenshot({path:path.join(process.env.QA_ADMIN_OUTPUT,'delete-'+(folderMode?'folder':rows.length)+'-confirmation.png')});
    const response=page.waitForResponse(r=>r.url()===origin+api&&r.request().method()==='DELETE');
    await confirm.click();const result=await response;assert.equal(result.status(),200);
    await expect(dialog).toHaveCount(0,{timeout:120000});
    const state=await post({operation:'reference_state',assets:rows.map(asset=>asset.publicUrl)});
    assert.equal(state.status(),200);const deleted=(await state.json()).deleted;
    assert.deepEqual([...deleted].sort(),rows.map(asset=>asset.publicUrl).sort());
    return rows.map(asset=>({asset:asset.publicUrl,deleted:true,evidence:'Completed confirmation and read-only Catalog tombstone; native Storage/audit verified after journey'}));
  }
  const preview=await post({operation:'preview_delete',assets:[sharedUrl]});assert.equal(preview.status(),200);const usage=await preview.json();
  assert.equal(usage.checks[0].state,'in_use');assert.ok(usage.checks[0].references.length>=3);
  const denied=await page.request.delete(origin+api,{data:{asset:sharedUrl,confirmReferenced:false}});assert.ok(!((await denied.json()).deleted));
  await deleteUi([usage.checks[0].asset]);
  assert.notEqual((await page.request.get(sharedUrl)).status(),200);
  const ownerSaves=[];
  for(const [route,tabName,fieldName] of [[`/admin/projects/${ownerFixtures.project.id}`,'basic','image'],[`/admin/content/topics/${ownerFixtures.topic.id}`,'basic','image'],['/admin/pages-blocks/blocks/hero/900002','media','images']]){
    await page.goto(origin+route);await page.locator(`[data-admin-tab-id="${tabName}"]`).click();
    const field=page.locator(`[name="${fieldName}"]`);assert.ok((await field.inputValue()).includes(sharedUrl));
    await expect(page.locator('[data-admin-deleted-media-count]').first()).toBeVisible();
    const editTab=route.includes('/hero/')?'content':'basic';
    await page.locator('[data-admin-tab-id="'+editTab+'"]').click();
    const titleField=page.locator('[name="'+(route.includes('/projects/')?'arabic_name':'title')+'"]');
    const changedTitle=(await titleField.inputValue())+' QA retained save';
    await titleField.fill(changedTitle);
    const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===route);
    await page.locator('form').filter({has:field}).locator('button[type="submit"]').click();assert.ok((await response).ok());
    await page.waitForLoadState('networkidle');await page.goto(origin+route);await page.locator(`[data-admin-tab-id="${tabName}"]`).click();
    assert.ok((await field.inputValue()).includes(sharedUrl));
    await page.locator('[data-admin-tab-id="'+editTab+'"]').click();await expect(titleField).toHaveValue(changedTitle);
    ownerSaves.push(route);
  }
  await page.goto(origin+'/qa-isolated-hero');await expect(page.locator('.hero-slide-fade')).toHaveCount(2);
  const bulk=await deleteUi([assets[0],assets[4]]);
  // Warm cached Public media must change after deletion before any consumer save.
  await page.goto(origin+'/qa-isolated-hero');await expect(page.locator('.hero-slide-fade')).toHaveCount(1);
  // Retain a deleted value while adding a live image: real Save must succeed.
  await saveHero([urls[0],urls[1],urls[3]],[urls[2]]);
  await page.goto(origin+'/qa-isolated-hero');await expect(page.locator('.hero-slide-fade')).toHaveCount(2);
  const renderedAfter=await page.locator('[data-hero-variant] img').evaluateAll(images=>images.map(img=>decodeURIComponent(img.currentSrc||img.src)));
  assert.ok(renderedAfter.every(src=>src.includes(urls[1])||src.includes(urls[3])));
  const folderPreview=await post({operation:'preview_delete',folder});assert.equal(folderPreview.status(),200);
  const remaining=assets.filter((_,index)=>index!==0&&index!==4);
  const folderResults=await deleteUi(remaining,true);
  await page.goto(origin+'/qa-isolated-hero');await expect(page.locator('.hero-slide-fade')).toHaveCount(0);
  await saveHero([urls[0],urls[1],urls[3]],[urls[2]]);
  await page.goto(origin+'/qa-isolated-hero');await expect(page.locator('.hero-slide-fade')).toHaveCount(0);
  const proof={status:'pass',heroCases,sharedUrl,ownerSaves,usage:usage.checks[0],bulk,folderResults,assets:assets.map(({id,objectKey,publicUrl})=>({id,objectKey,publicUrl})),storedDeletedReferencesRetained:true,productionAccess:false};
  writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT,'media-delete-responsive-proof.json'),JSON.stringify(proof,null,2));return proof;
}
