import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { expect } from 'playwright/test';

// Only the Server Action transport and database are isolated; the actual Tracking form,
// its nested Modal, Gallery, Picker, Media Library and Form Runtime all execute.
export const trackingActionTransport = String.raw`
export async function updateTrackingUpdateAction(previous, form) {
  const response = await fetch('/qa/tracking/save', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(form))});
  const saved = await response.json();
  return {status:saved.error?'error':'success', mode:'edit', revision:previous.revision+1, title:saved.error?'لم يتم الحفظ':'تم الحفظ', message:saved.error||'تم حفظ الصور', ...(saved.error?{}:{savedRevision:String(previous.revision+1)})};
}
export const createTrackingUpdateAction = updateTrackingUpdateAction;
const unused = () => {throw new Error('Unexpected non-update Tracking mutation');};
export {unused as createTrackingItemAction, unused as createTrackingStageAction, unused as saveTrackingProfileAction, unused as updateTrackingItemAction, unused as updateTrackingStageAction, unused as browseAdminLinksAjax, unused as browseMenusPickerAjax, unused as browseMenuItemsPickerAjax, unused as browseTopicCategoriesPickerAjax, unused as resolveAdminLinkAjax};
`;

export const trackingSelectionEntry = String.raw`
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import AdminFeedbackProvider from '@admin-feedback-provider';
import AdminFormRuntime from '@admin-form-runtime';
import AdminMediaImageField from '@admin-media-image-field';
import {TrackingUpdateFormModal} from '@tracking-forms';
const root = createRoot(document.getElementById('root'));
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
let generation = 0;
function Harness({paths, single=false}) {
  const [open,setOpen] = React.useState(false);
  const update = {id:1,title:'QA update',body:'QA description',occurred_at:'2026-10-15T00:00:00Z',publication_status:'draft',media:paths.map((public_url,sort_order)=>({id:sort_order+1,client_key:String(sort_order),media_kind:'image',public_url,sort_order}))};
  return <QueryClientProvider client={client}><AdminFeedbackProvider>
    {single ? <AdminFormRuntime action={async previous=>previous} mode="edit" entityKey="qa-single" formId="qa-single"><AdminMediaImageField name="single_image" label="صورة منفردة"/></AdminFormRuntime> : <>
      <button type="button" onClick={()=>setOpen(true)}>تعديل تحديث التنفيذ</button>
      <TrackingUpdateFormModal open={open} onClose={()=>setOpen(false)} projectId={1} itemId={1} update={update}/>
    </>}
  </AdminFeedbackProvider></QueryClientProvider>;
}
window.mountTrackingSelection=(paths=[],single=false)=>root.render(<Harness key={++generation} paths={paths} single={single}/>);
window.mountTrackingSelection(['/images/a.png']);
`;

export async function runTrackingSelection(page, baseUrl, check) {
  const db=new PGlite({extensions:{pgcrypto}});
  const mutations=[];
  const unexpected=[];
  let saveFails=true;
  let libraryFails=false;
  let updateId=null;
  const image=(id)=>({id,provider:'supabase',bucket:'cms-images',objectKey:`images/${id}.png`,publicUrl:`/images/${id}.png`,displayName:`Image ${id.toUpperCase()}`,originalFilename:`${id}.png`,kind:'image',mimeType:'image/png',extension:'png',sizeBytes:68,width:1,height:1,folderPath:'images',status:'active',missingObject:false,catalogRegistered:true,source:'catalog_storage',reconciliationState:'synced',referenceCount:0,createdAt:'2026-10-15T00:00:00Z',updatedAt:'2026-10-15T00:00:00Z'});
  const assets=['a','b','c','d'].map(image);
  const readPaths=async()=> (await db.query('select public_url from project_tracking_update_media where update_id=$1 order by sort_order',[updateId])).rows.map(row=>row.public_url);
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table admin_users(id bigserial primary key,is_active boolean not null default true);
      create table projects(id bigserial primary key,slug text not null unique,code text,type text default 'residential',arabic_name text,english_name text,location_label text,hero_image text,hero_image_alt text,publication_status text default 'draft');
      insert into admin_users default values;insert into projects(slug,arabic_name) values('qa-tracking','QA');`);
    await db.exec(await readFile('sql/migrations/20260817170332_project_construction_tracking_detail.sql','utf8'));
    const stage=(await db.query(`select mutate_project_tracking_stage(1,1,'create',null,$1::jsonb) as value`,[{name:'QA stage',is_visible:true}])).rows[0].value;
    const item=(await db.query(`select mutate_project_tracking_item(1,$1,1,'create',null,$2::jsonb) as value`,[stage.id,{name:'QA item',status:'not_started',is_visible:true}])).rows[0].value;
    await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(url.origin!==baseUrl){unexpected.push(request.url());return route.abort();}
      if(url.pathname==='/api/admin/media-library'){
        if(request.method()==='GET' && libraryFails)return route.fulfill({contentType:'application/json',body:'{'});
        if(request.method()==='GET')return json({assets,folders:[],page:1,pageSize:20,total:assets.length,totalPages:1,catalogState:'available',warning:null,summary:{assetCount:4,folderCount:0,imageCount:4,documentCount:0,totalBytes:272,catalogRegisteredCount:4,unreconciledAssetCount:0,usageUnknownCount:0,missingObjectCount:0},readiness:{safeDeleteReady:false,usageResultsAuthoritative:true,reasons:[],warnings:[]}});
        if(request.method()==='POST' && request.postDataJSON().operation==='reference_state'){
          // Keep read completion observably separate from input and selection changes.
          await new Promise(resolve=>setTimeout(resolve,150));
          return json({deleted:[],missing:[],originals:[]});
        }
      }
      if(url.pathname==='/api/admin/media-usage' && request.method()==='GET')return json({hits:[],scanComplete:true,unusedAuthoritative:true});
      if(url.pathname==='/qa/tracking/save' && request.method()==='POST'){
        const payload=request.postDataJSON();mutations.push(payload);
        // Preserve form state on failure, then use the actual Tracking aggregate RPC in memory.
        if(saveFails){saveFails=false;return json({error:'Controlled save failure'});}
        const paths=String(payload.image_urls).split('\n').map(x=>x.trim()).filter(Boolean);
        const media=paths.map((public_url,sort_order)=>({client_key:randomUUID(),media_kind:'image',public_url,poster_url:'',title:'',sort_order}));
        const saved=(await db.query(`select mutate_project_tracking_update(1,$1,1,$2,$3,$4::jsonb) as value`,[item.id,updateId?'update':'create',updateId,{title:'QA update',body:'QA description',occurred_at:'2026-10-15T00:00:00Z',publication_status:'draft',media}])).rows[0].value;
        updateId=saved.id;return json({paths:await readPaths()});
      }
      if(url.pathname.startsWith('/images/') && request.method()==='GET')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk1sAAAAASUVORK5CYII=','base64')});
      if(request.method()==='GET' && ['/harness','/shared-gallery-authoring.bundle.js'].includes(url.pathname))return route.continue();
      unexpected.push(request.method()+' '+url.pathname);return route.abort();
    });
    await page.goto(baseUrl+'/harness');
    const form=()=>page.getByRole('dialog',{name:'تعديل تحديث التنفيذ',exact:true});
    const picker=()=>page.getByRole('dialog',{name:/اختيار صور(?:ة)? من المكتبة/});
    const choice=id=>picker().getByRole('button',{name:new RegExp('^Image '+id.toUpperCase())});
    const confirm=()=>picker().getByRole('button',{name:'إضافة الصور المحددة',exact:true});
    const value=()=>page.locator('input[name="image_urls"]');
    const paths=async expected=>{
      await expect(value()).toHaveValue(expected.map(id=>`/images/${id}.png`).join('\n'));
      // Gallery previews appear only after the actual Catalog reference read settles.
      await expect(form().locator('[data-admin-media-gallery-index] img')).toHaveCount(expected.length);
    };
    const add=()=>form().locator('[data-admin-media-gallery-action="add"]');
    const openForm=async()=>{await page.getByRole('button',{name:'تعديل تحديث التنفيذ',exact:true}).click();await expect(form()).toBeVisible();};
    const open=async()=>{await add().click();await expect(choice('a')).toBeVisible();};
    await openForm();await paths(['a']);await open();
    await expect(picker().locator('[data-media-library-mode]')).toHaveAttribute('data-media-library-mode','select-many');
    await expect(picker().locator('[data-media-library-mode]')).toHaveAttribute('dir','rtl');
    await expect(confirm()).toBeDisabled();await expect(choice('a')).toBeDisabled();
    for(const [index,id] of ['b','c','d'].entries()) {
      await choice(id).click();
      await expect(picker()).toBeVisible();await expect(form()).toBeVisible();
      for(const selected of ['b','c','d'].slice(0,index+1))await expect(choice(selected)).toHaveAttribute('aria-pressed','true');
      await expect(picker().getByRole('status')).toHaveText('تم تحديد '+(index+1));
      // Let a real library refresh settle between clicks; do not hide reset races with fast clicks.
      const refreshed=page.waitForResponse(r=>r.url().includes('/api/admin/media-library?'));
      const referencesRefreshed=page.waitForResponse(r=>r.url()===baseUrl+'/api/admin/media-library' && r.request().method()==='POST');
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      const responses=await Promise.all([refreshed,referencesRefreshed]);
      await Promise.all(responses.map(response=>response.finished()));
      await expect(choice(id)).toHaveAttribute('aria-pressed','true');
    }
    await choice('c').focus();await page.keyboard.press('Space');
    await expect(choice('c')).toHaveAttribute('aria-pressed','false');
    await expect(picker().getByRole('status')).toHaveText('تم تحديد 2');
    await confirm().focus();await page.keyboard.press('Enter');await paths(['a','b','d']);
    await expect(picker()).toHaveCount(0);await expect(form()).toBeVisible();
    await expect(form().locator('form')).toHaveAttribute('data-admin-form-dirty','true');
    check('Actual Tracking modal: three consecutive selections survive refresh, deselect one, confirm two without closing the form',true);
    await open();for(const id of ['a','b','d'])await expect(choice(id)).toBeDisabled();
    await expect(confirm()).toBeDisabled();await page.keyboard.press('Escape');
    await expect(picker()).toHaveCount(0);await expect(form()).toBeVisible();await expect(add()).toBeFocused();await paths(['a','b','d']);
    check('Nested picker Escape preserves the Tracking form and prevents duplicate additions',true);
    await form().getByRole('button',{name:'حفظ',exact:true}).click();
    await expect(form().getByText('Controlled save failure')).toBeVisible();await paths(['a','b','d']);assert.equal(updateId,null);
    await form().getByRole('button',{name:'حفظ',exact:true}).click();await expect(form()).toHaveCount(0);
    const saved=await readPaths();assert.deepEqual(saved,['a','b','d'].map(id=>`/images/${id}.png`));
    await page.evaluate(paths=>window.mountTrackingSelection(paths),saved);await openForm();await paths(['a','b','d']);
    await expect(form().locator('form')).toHaveAttribute('data-admin-form-dirty','false');assert.equal(mutations.length,2);
    check('Actual Tracking form save failure preserves images; retry and reopen restore unique images from isolated Tracking RPC',true);
    await open();await choice('c').click();await picker().getByRole('button',{name:'إلغاء',exact:true}).click();await paths(['a','b','d']);
    await open();await choice('c').click();await confirm().click();await paths(['a','b','d','c']);
    check('One-image addition and cancel retain their behavior in the actual consumer',true);
    await form().locator('[data-admin-media-gallery-index="3"] [data-admin-media-gallery-action="move-up"]').click();await paths(['a','b','c','d']);
    await form().locator('[data-admin-media-gallery-index="3"] [data-admin-media-gallery-action="remove"]').click();await paths(['a','b','c']);
    await form().locator('[data-admin-media-gallery-index="0"] [data-admin-media-gallery-action="replace"]').click();
    await expect(picker().locator('[data-media-library-mode]')).toHaveAttribute('data-media-library-mode','select-one');
    await expect(choice('b')).toBeDisabled();await choice('d').click();
    await picker().getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await paths(['d','b','c']);
    check('Tracking reorder/remove and single replacement remain intact without duplicates',true);
    await page.evaluate(()=>window.mountTrackingSelection([],true));
    await page.getByRole('button',{name:'اختيار صورة',exact:true}).click();
    await expect(picker().locator('[data-media-library-mode]')).toHaveAttribute('data-media-library-mode','select-one');
    await choice('a').click();await choice('b').click();
    await expect(choice('a')).toHaveAttribute('aria-pressed','false');await expect(choice('b')).toHaveAttribute('aria-pressed','true');
    await picker().getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
    await expect(page.locator('input[name="single_image"]')).toHaveValue('/images/b.png');
    // A selected value precedes Catalog readiness; do not unmount its in-flight read.
    await expect(page.locator('[data-admin-media-image-preview-trigger]')).toBeVisible();
    check('Actual AdminMediaImageField retains single selection and its original confirmation behavior',true);
    libraryFails=true;
    await page.evaluate(()=>window.mountTrackingSelection([]));await openForm();await add().click();
    await expect(picker().getByText(/JSON/)).toBeVisible();await expect(confirm()).toBeDisabled();
    await page.keyboard.press('Escape');await paths([]);
    assert.deepEqual(unexpected,[]);
    check('Library read failure cannot be confirmed; no external requests, uploads, file deletion or Production writes',true);
  } finally {await page.unroute('**/*');await db.close();}
}
