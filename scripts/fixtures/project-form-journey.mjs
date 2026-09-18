import assert from "node:assert/strict";

export const PROJECT_FORM_JOURNEY_ENTRY = String.raw`
import React from 'react';
import {createRoot} from 'react-dom/client';
import AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';
import Project from '@src/app/admin/projects/ProjectEditForm';
import {createEmptyProjectEntry,projectEntryPayloadFromFormData} from '@src/lib/admin/projects/project-entry-contract';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const bundle=createEmptyProjectEntry('residential');
Object.assign(bundle.project,{id:40,arabic_name:'مشروع الاختبار',english_name:'Journey project',code:'J-40',slug:'journey-project',general_description:'Description before edit',short_description:'Short description',overview_title:'Overview title',overview_body:'<p>Existing overview content</p>',delivery_title:'Delivery title',delivery_body:'<p>Existing delivery content</p>',plans_title:'Existing plans',gallery_title:'Existing gallery',governorate_id:1,city_id:2,main_area_id:3,sub_area_id:4});
bundle.schemaReady=true;bundle.schemaMessage=null;
bundle.locations=['governorate','city','main_area','sub_area'].map((level,index)=>({id:index+1,level,parentId:index||null,nameAr:'Location '+level,nameEn:'Location '+level,isActive:true}));
bundle.features=Array.from({length:12},(_,i)=>({id:100+i,client_key:'feature-'+i,body:'Existing feature '+i}));
bundle.delivery_items=Array.from({length:6},(_,i)=>({id:200+i,client_key:'delivery-'+i,body:'Existing delivery '+i}));
bundle.floor_plans=Array.from({length:12},(_,i)=>({id:300+i,client_key:'plan-'+i,name:'Existing plan '+i,area_text:'100',featured:false,architectural_image:'',architectural_image_alt:'',furnishing_image:'',furnishing_image_alt:'',details:Array.from({length:4},(_,j)=>({id:400+i*4+j,client_key:'detail-'+i+'-'+j,label:'Existing detail '+j,value:'100'}))}));
bundle.media=Array.from({length:12},(_,i)=>({id:500+i,client_key:'media-'+i,section:'gallery',image:'',alt_text:'Existing gallery image '+i}));
window.bundle=bundle;window.proofNavigations=[];window.calls=0;window.payloads=[];window.formDataReads=[];
window.action=async(previous,data)=>{window.calls++;window.payloads.push([...data.entries()]);const payload=projectEntryPayloadFromFormData(data);const reconciled={...bundle,...payload,features:payload.features.map((feature,index)=>({...feature,id:feature.id??900+index})),project:{...bundle.project,...payload.project,id:40,updated_at:'2026-09-17T05:00:00Z'}};return new Promise(resolve=>window.finish=()=>resolve({status:'success',mode:'edit',revision:previous.revision+1,title:'Saved fixture',entityId:40,savedRevision:'40:next',result:{reconciledBundle:reconciled,mediaSynchronizationStatus:'synced',publicationStatus:'unpublished'}}));};
const root=createRoot(document.getElementById('root')),client=new QueryClient();
window.mount=kind=>{bundle.project.type=kind?.endsWith('commercial')?'commercial':'residential';window.mountStart=performance.now();root.render(<QueryClientProvider client={client}><AdminFeedbackProvider><Project bundle={bundle} closeHref={'/admin/projects/'+bundle.project.type+'?q=journey&page=2&pageSize=20&type='+bundle.project.type}/></AdminFeedbackProvider></QueryClientProvider>);};
`;

export async function verifyProjectFormJourney(page, {projectType='residential'}={}) {
  await page.waitForFunction(()=>document.querySelectorAll('[contenteditable=true]').length===2&&document.querySelector('input[name=arabic_name]')?.value==='مشروع الاختبار'&&!document.querySelector('form fieldset[disabled]'));
  assert.equal(await page.locator('[role=tabpanel]').count(),8);
  assert.equal(await page.locator('input[name=floor_plan_name]').count(),12);
  assert.equal(await page.locator('input[name=floor_plan_detail_label]').count(),48);
  const initial = await page.evaluate(()=>({mountMs:performance.now()-window.mountStart,controls:document.querySelector('form').elements.length,hiddenEditors:[...document.querySelectorAll('[contenteditable=true]')].filter(editor=>editor.closest('[role=tabpanel]')?.hidden).length}));
  for(const tab of ['basic','location','overview','plans','delivery','media','seo','review']) {
    await page.locator(`[data-admin-tab-id=${tab}]`).click();
    assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
    assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-admin-tab-id'),tab);
    if(tab==='overview'||tab==='delivery') {
      const editor=page.locator(`#${tab}_body-editor`);
      assert.equal(await editor.isVisible(),true);
      assert.equal(await editor.getAttribute('contenteditable'),'true');
      assert.equal(await editor.innerText(),`Existing ${tab==='overview'?'overview':'delivery'} content`);
    }
    if(tab==='location') {
      for(const name of ['governorate_id','city_id','main_area_id','sub_area_id']) assert.notEqual(await page.locator(`[name=${name}]`).inputValue(),'');
    }
  }
  await page.locator('[data-admin-tab-id=location]').click();
  await page.getByRole('tab',{selected:true}).press('ArrowLeft');
  assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-admin-tab-id'),'overview');
  await page.locator('input[name=overview_title]').fill('Saved overview title');
  await page.locator('input[name=feature_body]').first().fill('Saved feature');
  await page.getByRole('button',{name:'+ إضافة ميزة',exact:true}).click();
  await page.locator('input[name=feature_body]').last().fill('New feature awaiting identity');
  assert.equal(await page.locator('input[name=feature_id]').last().inputValue(),'');
  await page.locator('[data-admin-tab-id=delivery]').click();
  await page.locator('input[name=delivery_title]').fill('Saved delivery title');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('admin-project-entry:navigate',{detail:{tabId:'overview',targetId:'overview_title'}})));
  await page.locator('input[name=overview_title]').waitFor({state:'visible'});
  assert.equal(await page.locator('input[name=overview_title]').inputValue(),'Saved overview title');
  const before = await page.evaluate(()=>({tab:document.querySelector('[role=tab][aria-selected=true]')?.dataset.adminTabId,data:[...new FormData(document.querySelector('form')).entries()]}));
  await page.locator('form').evaluate(form=>{form.noValidate=true;form.requestSubmit();});
  await page.waitForFunction(()=>window.calls===1);
  assert.equal(await page.locator('input[name=overview_title]').isDisabled(),true);
  await page.locator('button[type=submit]').evaluate(button=>button.click());
  assert.equal(await page.evaluate(()=>window.calls),1);
  await page.evaluate(()=>window.finish());
  await page.waitForFunction(()=>document.querySelector('input[name=overview_title]')?.value==='Saved overview title'&&!document.querySelector('form fieldset[disabled]')&&document.querySelector('[data-admin-feedback-entry]'));
  assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-admin-tab-id'),'overview','successful edit reconciliation must retain the selected tab');
  assert.equal(await page.locator('input[name=feature_body]').first().inputValue(),'Saved feature');
  assert.equal(await page.locator('input[name=feature_id]').last().inputValue(),'912','reconciled server-generated identity is adopted');
  assert.equal(await page.locator('input[name=delivery_title]').inputValue(),'Saved delivery title');
  assert.equal(await page.locator('[contenteditable=true]').count(),2);
  const after = await page.evaluate(()=>({tab:document.querySelector('[role=tab][aria-selected=true]')?.dataset.adminTabId,data:[...new FormData(document.querySelector('form')).entries()]}));
  for (const name of ['feature_body','floor_plan_id','floor_plan_name','floor_plan_detail_id','floor_plan_detail_label','floor_plan_detail_value','delivery_item_id','delivery_item_body','media_id','media_section','media_alt_text','overview_body','delivery_body']) {
    assert.ok(before.data.some(([key])=>key===name),'fixture exercises aggregate '+name);
    assert.deepEqual(after.data.filter(([key])=>key===name),before.data.filter(([key])=>key===name),'accepted reconciliation retains aggregate '+name);
  }
  await page.getByRole('button',{name:'إغلاق',exact:true}).click();
  await page.waitForFunction(()=>window.proofNavigations.length===1);
  assert.equal(await page.getByRole('alertdialog').count(),0,'saved accepted revision is clean');
  assert.deepEqual(await page.evaluate(()=>window.proofNavigations),[`/admin/projects/${projectType}?q=journey&page=2&pageSize=20&type=${projectType}`]);
  return {initial,selectedTab:after.tab,aggregateControlsRetained:true,generatedIdentityAdopted:true,cleanCloseQueryRetained:true,claims:['actual eight-panel Project form, populated aggregate and TipTap owners','keyboard and correction-event tab navigation','accepted edit revision keeps selected panel, reconciled aggregate, generated identity and hidden draft values','pending blocks duplicate submission; clean Close preserves query']};
}
