import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect} from 'playwright/test';

export async function verifyMediaRelocations({page,origin,api,assets,heroId=900001,injectFailure=false,folderRoot='images/home',ownerFixtures=null}) {
  const results=[];const current=new Map(assets.map(asset=>[asset.id,{...asset}]));
  const used=assets.find(a=>a.originalFilename==='scope-slide-jpg.jpg');
  const unused=assets.find(a=>a.originalFilename==='scope-library.jpg');
  assert.ok(used&&unused);
  let shared;
  if (ownerFixtures) {
    await page.goto(origin+'/admin/projects/'+ownerFixtures.project.id);
    const url=await page.locator('[name="image"]').inputValue();
    const catalog=await page.request.get(origin+api+'?view=all&kind=image&pageSize=100');
    assert.equal(catalog.status(),200); shared=(await catalog.json()).assets.find(asset=>asset.publicUrl===url);
    assert.ok(shared);current.set(shared.id,{...shared});
  }
  const folders=[folderRoot+'/relocate-a',folderRoot+'/relocate-b',folderRoot+'/relocate-bulk'];
  for(const folder of folders){const r=await page.request.post(origin+api,{data:{operation:'create_folder',folder}});assert.equal(r.status(),201,await r.text());}
  async function choose(ids){
    await page.goto(origin+'/admin/media-library?view=all&kind=image&pageSize=100');
    for(const id of ids)await page.locator('[data-media-library-mode="manage"] button[aria-pressed]').filter({hasText:current.get(id).displayName}).click();
    await page.getByRole('button',{name:ids.length===1?'نقل / إعادة تسمية':'نقل إلى…',exact:true}).click();
  }
  async function stage(ids,destination,filename){
    await choose(ids);const form=page.locator('[data-media-relocation-form]');
    await form.getByRole('combobox',{name:'مجلد الوجهة',exact:true}).click();
    await expect(page.getByRole('option',{name:'files',exact:true})).toHaveCount(0);
    await page.getByRole('option',{name:destination,exact:true}).click();
    if(filename!==undefined)await form.getByRole('textbox',{name:'اسم الملف الفعلي الجديد',exact:true}).fill(filename);
    if(ids.length>1)await expect(form.locator('[name=targetFilename]')).toHaveCount(0);
    await form.getByRole('button',{name:'مراجعة العملية',exact:true}).click();
    const dialog=page.getByRole('dialog');await expect(dialog.locator('[data-media-relocation-preview]')).toBeVisible();
    for(const id of ids)await expect(dialog).toContainText(current.get(id).objectKey);
    return dialog;
  }
  async function proveOwners(asset) {
    const cases=[
      {path:'/admin/projects/'+ownerFixtures.project.id,field:'image',tab:'basic'},
      {path:'/admin/content/topics/'+ownerFixtures.topic.id,field:'image',tab:'basic'},
      {path:'/admin/pages-blocks/blocks/hero/'+(ownerFixtures.heroId??900002),field:'images',tab:'media'},
    ];
    for(const item of cases){
      await page.goto(origin+item.path);
      const tab=page.locator('[data-admin-tab-id="'+item.tab+'"]');await page.waitForLoadState('networkidle');await expect(tab).toBeVisible();await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
      const field=page.locator('[name="'+item.field+'"]');assert.ok((await field.inputValue()).includes(asset.publicUrl));
      const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===item.path);
      await page.locator('form').filter({has:field}).locator('button[type="submit"]').click();
      assert.ok((await response).ok());
      await page.waitForLoadState('networkidle');await page.goto(origin+item.path);
      await page.waitForLoadState('networkidle');await expect(tab).toBeVisible();await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
      assert.ok((await field.inputValue()).includes(asset.publicUrl));
      const images=page.locator('img').filter({visible:true});
      await expect.poll(async()=>images.evaluateAll((rows,url)=>rows.some(img=>(img.src.includes(encodeURIComponent(url))||img.src.includes(url))&&img.complete&&img.naturalWidth>0),asset.publicUrl)).toBe(true);
    }
  }
  async function run(ids,destination,filename){
    const dialog=await stage(ids,destination,filename);const completed=[];
    const listener=async response=>{if(response.url()===origin+api&&response.request().method()==='PATCH'&&response.request().postDataJSON()?.operation==='move_asset'){const payload=await response.json();completed.push({status:response.status(),payload,id:response.request().postDataJSON().assetId});}};
    page.on('response',listener);await dialog.getByRole('button',{name:/^تأكيد (النقل|إعادة التسمية)/,exact:true}).click();await expect(dialog).toHaveCount(0,{timeout:180000});page.off('response',listener);assert.equal(completed.length,ids.length);
    for(const entry of completed){if(entry.status!==200)continue;const before=current.get(entry.id),after=entry.payload.asset;assert.equal(after.id,before.id);assert.equal(after.folderPath,destination);assert.equal((await page.request.get(after.publicUrl)).status(),200);assert.notEqual((await page.request.get(before.publicUrl)).status(),200);current.set(after.id,after);}
    writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT, "media-relocation-last-response.json"), JSON.stringify(completed,null,2));
    results.push(...completed.map(item=>({id:item.id,status:item.status,operation:item.payload.operation,updated:item.payload.rebind?.appliedCount,error:item.payload.error})));
    return completed;
  }
  assert.equal((await run([unused.id],unused.folderPath,'scope-unused-renamed.jpg'))[0].status,200);
  assert.equal((await run([unused.id],folders[0]))[0].status,200);
  assert.equal((await run([used.id],folders[0]))[0].status,200);
  assert.equal((await run([used.id],folders[0],'scope-used-renamed.jpg'))[0].status,200);
  assert.equal((await run([used.id],folders[1],'scope-used-final.jpg'))[0].status,200);
  const negatives=[];
  for(const change of [{targetFolder:'files'},{targetFolder:folders[0],targetFilename:'../evil.jpg'},{targetFolder:folders[0],targetFilename:'image.pdf'},{targetFolder:folders[0],targetFilename:'scope-unused-renamed.jpg'}]){
    const r=await page.request.patch(origin+api,{data:{operation:'move_asset',assetId:used.id,...change}});assert.ok([400,409].includes(r.status()),await r.text());negatives.push({change,status:r.status(),code:(await r.json()).code});
  }
  if(shared){
    for(const [destination,filename] of [[folders[0],undefined],[folders[0],'qa-multi-owner-renamed.png']]){
      const response=(await run([shared.id],destination,filename))[0];assert.equal(response.status,200);assert.ok(response.payload.rebind.appliedCount>=3);
      await proveOwners(current.get(shared.id));
    }
  }
  let injected=false;
  if(injectFailure)await page.route('**/api/admin/media-library',async route=>{const req=route.request();if(req.method()==='PATCH'&&req.postDataJSON()?.operation==='move_asset'&&req.postDataJSON().assetId===used.id&&!injected){injected=true;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'QA controlled asset conflict'})});}else await route.continue();});
  const bulk=await run([used.id,unused.id,...(shared?[shared.id]:[])],folders[2]);
  if(injectFailure){assert.equal(bulk.filter(r=>r.status===200).length,shared?2:1);await expect(page.locator('button[aria-pressed="true"]').filter({hasText:used.displayName})).toHaveCount(1);await page.unroute('**/api/admin/media-library');
    // Retry operates only on the retained failed selection, without reselecting successes.
    const form=page.locator('[data-media-relocation-form]');await form.getByRole('button',{name:'مراجعة الفاشل فقط وإعادة المحاولة',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('تم تحديد 1 صور');const response=page.waitForResponse(r=>r.url()===origin+api&&r.request().postDataJSON()?.operation==='move_asset');await dialog.getByRole('button',{name:/^تأكيد (النقل|إعادة التسمية)/,exact:true}).click();const r=await response;assert.equal(r.status(),200,await r.text());current.set(used.id,(await r.json()).asset);await expect(dialog).toHaveCount(0);
  }else assert.ok(bulk.every(r=>r.status===200));
  await page.goto(origin+'/admin/pages-blocks/blocks/hero/'+heroId);await page.locator('[data-admin-tab-id="media"]').click();const field=page.locator('[data-hero-media-section="desktop"] [name=images]');assert.ok((await field.inputValue()).includes(current.get(used.id).publicUrl));assert.ok(!(await field.inputValue()).includes(used.publicUrl));
  await page.getByRole('button',{name:'حفظ الهيرو',exact:true}).click();await page.waitForURL(url=>url.searchParams.has('saved'));await page.goto(origin+'/admin/pages-blocks/blocks/hero/'+heroId);await page.locator('[data-admin-tab-id="media"]').click();assert.ok((await field.inputValue()).includes(current.get(used.id).publicUrl));
  if(shared)await proveOwners(current.get(shared.id));
  const proof={multiOwnerSaveReload:Boolean(shared),ownerFixtures,status:'pass',results,negatives,bulkFailureRetry:injectFailure,assets:[...current.values()],folders,heroId,saveReload:true};writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT,'media-relocation-browser-proof.json'),JSON.stringify(proof,null,2));return proof;
}
