import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";
import { buildCoreProjectControlsPlan, PROJECT_CONTROL_VALUES as v, PROJECT_CONTROL_PHASES, projectGraphProjection, expectedProjectControlsProjection, projectPayloadGraph } from "./admin-core-project-controls-contract.mjs";

export async function runCoreProjectControlsJourneys(ctx) {
 const {page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,nativeCheckpoint}=ctx;
 assert.equal(new URL(origin).hostname,"127.0.0.1");const f=fixtures.projectControls;assert.ok(f);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
 const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
 const {projectEntryPayloadFromFormData}=await jiti.import("../../src/lib/admin/projects/project-entry-contract.ts");
 const plan=buildCoreProjectControlsPlan({manifest,fixtures:f}),outcomes=[];
 let current,originalUi;
 const form=()=>page.locator('form').filter({has:page.locator('input[name="id"][value="'+current.id+'"]')});
 const field=(name,scope=form())=>scope.locator('[name="'+name+'"]');
 const save=()=>form().locator('button[type="submit"]');
 const tab=name=>form().locator('[data-admin-tab-id="'+name+'"]').click();
 const repeater=name=>form().locator('[data-project-ordered-repeater="'+name+'"]');
 const repeatRows=name=>repeater(name).locator(':scope > div[draggable]');
 const plans=()=>form().locator('[data-project-floor-plans] > article');
 const details=plan=>field("floor_plan_detail_client_key",plan).locator('xpath=..');
 const media=section=>form().locator('[data-project-media-collection="'+section+'"]');
 const mediaRows=section=>media(section).locator('article');
 const videos=section=>form().locator('[data-project-video-collection="'+section+'"]');
 const videoRows=section=>videos(section).locator('article');
 const points=()=>form().locator('[data-project-location-points]');
 const pointGroups=()=>points().locator(':scope > section');
 const checkpoint=async phase=>{const request={id:randomUUID(),kind:"project-controls-state",recipe:current.kind,phase},response=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(response[key],request[key]);assert.equal(response.status,"pass");return response;};
 async function confirmDelete(trigger,title,label,cancel=false){
  await trigger.click();const dialog=page.getByRole("dialog",{name:title,exact:true});await expect(dialog).toBeVisible();
  if(cancel)await dialog.locator('[data-admin-confirm-cancel]').click();else await dialog.getByRole("button",{name:label,exact:true}).click();
  await expect(dialog).toHaveCount(0);if(cancel)await expect(trigger).toBeFocused();
 }
 async function checked(control,value){if(await control.isChecked()!==value)await control.locator('xpath=ancestor::label[1]').click();if(value)await expect(control).toBeChecked();else await expect(control).not.toBeChecked();}
 async function chooseAsset(owner,name,index,cancel=false){
  const before=await field(name,owner).inputValue(),trigger=owner.getByRole("button").first(),asset=f.assets[index];
  const match=response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==="/api/admin/media-library"&&response.request().method()==="GET";};
  const[initial]=await Promise.all([page.waitForResponse(match),trigger.click()]);assert.equal(initial.status(),200);const data=await initial.json(),root=data.folders.find(row=>row.path==="images");assert.ok(root);
  const dialog=page.getByRole("dialog",{name:"اختيار صورة من المكتبة",exact:true});await expect(dialog).toBeVisible();
  await dialog.getByRole("navigation",{name:"مجلدات الوسائط",exact:true}).getByRole("button").filter({has:page.getByText(root.displayName,{exact:true})}).click();
  const[found]=await Promise.all([page.waitForResponse(response=>match(response)&&new URL(response.url()).searchParams.get("q")===asset.objectKey&&new URL(response.url()).searchParams.get("folder")==="images"),dialog.getByPlaceholder("ابحث بالاسم أو المسار أو الوصف البديل…",{exact:true}).fill(asset.objectKey)]);
  assert.equal(found.status(),200);assert.deepEqual((await found.json()).assets.map(row=>row.publicUrl),[asset.publicUrl]);
  const choice=dialog.locator('button[aria-pressed]').filter({has:page.getByText(asset.displayName,{exact:true})});await expect(choice).toHaveCount(1);await choice.click();await expect(choice).toHaveAttribute("aria-pressed","true");
  await dialog.getByRole("button",{name:cancel?"إلغاء":"تأكيد الاختيار",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(field(name,owner)).toHaveValue(cancel?before:asset.publicUrl);
 }
 const imageOwner=(row,name)=>row.locator('[data-admin-media-image-field="'+name+'"]');
 async function readUi(){
  const entries=await form().evaluate(element=>Array.from(new FormData(element).entries()).map(([key,value])=>[key,String(value)]));
  const data=new FormData();for(const[key,value]of entries)data.append(key,value);const payload=projectEntryPayloadFromFormData(data);
  return{payload,graph:projectPayloadGraph(payload)};
 }
 async function assertDraft(empty=false){const value=await readUi();assert.deepEqual(projectGraphProjection(value.graph),expectedProjectControlsProjection(originalUi,f,empty));return value;}
 async function dirtyCloseCancel(){const close=form().locator('[data-admin-form-action="close"]');await close.click();const dialog=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});await expect(dialog).toBeVisible();await dialog.locator('[data-admin-confirm-cancel]').click();await expect(dialog).toHaveCount(0);await expect(close).toBeFocused();}
 async function authorPoints(){
  await tab("location");await expect(pointGroups()).toHaveCount(3);const transport=pointGroups().nth(0),road=pointGroups().nth(1),landmark=pointGroups().nth(2);
  const rows=owner=>field("location_point_client_key",owner).locator('xpath=..');
  for(const label of v.transport){await transport.getByRole("button",{name:"+ إضافة",exact:true}).click();await field("location_point_label",rows(transport).last()).fill(label);await field("location_point_distance_text",rows(transport).last()).fill(v.distance);}
  await expect(rows(transport).first().getByRole("button",{name:"تحريك لأعلى",exact:true})).toBeDisabled();await rows(transport).nth(1).getByRole("button",{name:"تحريك لأعلى",exact:true}).click();
  await field("location_point_label",road).fill(v.road);await field("location_point_distance_text",road).fill(v.distance);
  await confirmDelete(road.getByRole("button",{name:"حذف "+v.road,exact:true}),"حذف عنصر الموقع؟","حذف العنصر",true);await expect(rows(road)).toHaveCount(1);
  await landmark.getByRole("button",{name:"+ إضافة",exact:true}).click();await field("location_point_label",landmark).fill("معلم غير محفوظ");await confirmDelete(landmark.getByRole("button",{name:"حذف معلم غير محفوظ",exact:true}),"حذف عنصر الموقع؟","حذف العنصر");await expect(rows(landmark)).toHaveCount(0);
 }
 async function authorOrdered(name,tabName,values,label){
  await tab(tabName);const rows=()=>repeatRows(name);await field(name+"_body",rows().nth(0)).fill(values[0]);await field(name+"_body",rows().nth(1)).fill(values[1]);
  await expect(rows().first().getByRole("button",{name:"تحريك لأعلى",exact:true})).toBeDisabled();await expect(rows().last().getByRole("button",{name:"تحريك لأسفل",exact:true})).toBeDisabled();
  await rows().nth(1).getByRole("button",{name:"تحريك لأعلى",exact:true}).click();
  const removeIndex=name==="feature"?2:1;const trigger=()=>rows().nth(removeIndex).getByRole("button",{name:new RegExp("^حذف "+label+" ")});
  await confirmDelete(trigger(),"حذف "+label+"؟","حذف",true);await confirmDelete(trigger(),"حذف "+label+"؟","حذف");
  await repeater(name).getByRole("button",{name:"+ إضافة "+label,exact:true}).click();await field(name+"_body",rows().last()).fill(values[2]);
 }
 async function expand(plan){const button=plan.getByRole("button",{name:"فتح المخطط",exact:true});if(await button.count())await button.click();}
 async function authorPlans(){
  await tab("plans");await expect(plans()).toHaveCount(2);await expand(plans().first());
  await field("floor_plan_name",plans().first()).fill(v.plan);await field("floor_plan_area_text",plans().first()).fill(v.area);
  await checked(plans().first().getByRole("switch",{name:"مخطط مميز",exact:true}),false);
  for(let i=0;i<2;i++){await field("floor_plan_detail_label",details(plans().first()).nth(i)).fill(v.details[i].label);await field("floor_plan_detail_value",details(plans().first()).nth(i)).fill(v.details[i].value);}
  await details(plans().first()).nth(1).getByRole("button",{name:"تحريك لأعلى",exact:true}).click();
  await confirmDelete(details(plans().first()).nth(1).getByRole("button",{name:"حذف التفصيلة",exact:true}),"حذف التفصيلة؟","حذف",true);
  await confirmDelete(details(plans().first()).nth(1).getByRole("button",{name:"حذف التفصيلة",exact:true}),"حذف التفصيلة؟","حذف");
  await plans().first().getByRole("button",{name:"+ إضافة تفصيلة",exact:true}).click();await field("floor_plan_detail_label",details(plans().first()).last()).fill(v.details[2].label);await field("floor_plan_detail_value",details(plans().first()).last()).fill(v.details[2].value);
  const originalKeys=await field("floor_plan_detail_client_key",plans().first()).evaluateAll(rows=>rows.map(row=>row.value));
  await plans().first().getByRole("button",{name:"نسخ المخطط",exact:true}).click();await expect(plans()).toHaveCount(3);await expand(plans().nth(1));
  const copyKeys=await field("floor_plan_detail_client_key",plans().nth(1)).evaluateAll(rows=>rows.map(row=>row.value));assert.equal(copyKeys.length,2);assert.ok(copyKeys.every(key=>!originalKeys.includes(key)));assert.equal(await field("floor_plan_id",plans().nth(1)).inputValue(),"");
  await field("floor_plan_name",plans().nth(1)).fill(v.copy);await field("floor_plan_area_text",plans().nth(1)).fill(v.copyArea);await checked(plans().nth(1).getByRole("switch",{name:"مخطط مميز",exact:true}),true);
  await confirmDelete(plans().nth(2).getByRole("button",{name:"حذف المخطط",exact:true}),"حذف المخطط؟","حذف",true);await confirmDelete(plans().nth(2).getByRole("button",{name:"حذف المخطط",exact:true}),"حذف المخطط؟","حذف");
  await plans().nth(1).locator("header").getByRole("button",{name:"تحريك لأعلى",exact:true}).click();await expect(field("floor_plan_name",plans().first())).toHaveValue(v.copy);
 }
 async function authorMedia(){
  await tab("media");await expect(mediaRows("gallery")).toHaveCount(3);
  for(let i=0;i<2;i++)await field("media_alt_text",mediaRows("gallery").nth(i)).fill(v.galleryAlts[i]);
  await mediaRows("gallery").nth(1).getByRole("button",{name:"تحريك الصورة لأعلى",exact:true}).click();
  const third=()=>mediaRows("gallery").nth(2).getByRole("button",{name:"حذف الصورة 3",exact:true});await confirmDelete(third(),"حذف الصورة من المشروع؟","حذف الارتباط",true);await confirmDelete(third(),"حذف الصورة من المشروع؟","حذف الارتباط");
  await chooseAsset(imageOwner(mediaRows("gallery").nth(1),"media_image"),"media_image",1);await chooseAsset(imageOwner(mediaRows("gallery").nth(1),"media_image"),"media_image",2,true);
  await media("gallery").getByRole("button",{name:"+ إضافة صورة للمعرض",exact:true}).click();await chooseAsset(imageOwner(mediaRows("gallery").last(),"media_image"),"media_image",2);await field("media_alt_text",mediaRows("gallery").last()).fill(v.galleryAlts[2]);
  for(const url of [...v.videos,"https://example.invalid/removed-project-control"]){await videos("gallery").getByRole("button",{name:"+ إضافة فيديو",exact:true}).click();await field("video_url",videoRows("gallery").last()).fill(url);}
  await videoRows("gallery").nth(1).getByRole("button",{name:"تحريك الفيديو لأعلى",exact:true}).click();
  await chooseAsset(imageOwner(videoRows("gallery").first(),"video_poster_image"),"video_poster_image",2);await field("video_poster_alt",videoRows("gallery").first()).fill(v.posterAlt);
  await confirmDelete(videoRows("gallery").last().getByRole("button",{name:"حذف الفيديو",exact:true}),"حذف الفيديو من المشروع؟","حذف الفيديو",true);await confirmDelete(videoRows("gallery").last().getByRole("button",{name:"حذف الفيديو",exact:true}),"حذف الفيديو من المشروع؟","حذف الفيديو");
 }
 async function semanticNegative(){
  await tab("plans");await expand(plans().first());const value=field("floor_plan_detail_label",details(plans().first()).first());await value.fill("");
  const[response]=await Promise.all([actionResponse(),save().click()]);assertActionAcknowledged(response);await expect(form().locator("#floor_plan_detail_label-error")).toBeVisible();await expect(value).toHaveAttribute("aria-invalid","true");await expect(save()).toBeEnabled();
  await value.fill(v.details[1].label);await assertDraft();
 }
 async function savePending(cancel){
  const token=randomUUID(),entity=current.kind==="residential"?"projects":"project_control_commercial";const fault=async operation=>{const request={id:randomUUID(),kind:"domain-write-fault-"+operation,entity,token},result=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(result[key],request[key]);assert.equal(result.status,"pass");return result;};
  let armed=false,responsePromise;const posts=[],listener=request=>{if(request.method()==="POST"&&request.headers()["next-action"]&&new URL(request.url()).origin===origin)posts.push(request);};
  try{
   await fault("arm");armed=true;page.on("request",listener);responsePromise=actionResponse();void responsePromise.catch(()=>{});await save().click();
   const first=await fault("observe-blocked");assert.equal(first.observedOneStatement,true);const pending=form().locator('[data-admin-form-fields]');await expect(form()).toHaveAttribute("aria-busy","true");await expect(pending).toHaveJSProperty("disabled",true);await expect(save()).toBeDisabled();await expect(form().locator('[data-admin-form-action="close"]')).toBeDisabled();await expect(field("floor_plan_name").first()).toBeDisabled();
   await page.keyboard.press("Enter");await page.keyboard.press("Enter");const second=await fault("observe-blocked");for(const key of["backendPid","backendStartedAt","queryStartedAt","queryFingerprint","holderPid"])assert.equal(second[key],first[key]);assert.equal(posts.length,1);
   if(cancel)assert.equal((await fault("cancel")).cancelledOneStatement,true);const release=await fault("release");armed=false;assert.equal(release.ownedLockRolledBack,true);assert.equal(release.cancellationObserved,cancel);
   assertActionAcknowledged(await responsePromise);await expect(save()).toBeEnabled();return{sameNativeStatementObservedTwice:true,actionRequests:posts.length,normalKeyboardDedup:true,fieldsAndCloseDisabled:true,actualStatementCancelled:cancel,ownedLockReleased:true};
  }finally{page.off("request",listener);try{if(armed)await fault("release");}finally{if(responsePromise)await Promise.allSettled([responsePromise]);}}
 }
 async function emptyAll(){
  await tab("location");while(await field("location_point_client_key",points()).count()){const row=field("location_point_client_key",points()).first().locator('xpath=..');await confirmDelete(row.getByRole("button",{name:/^حذف /u}),"حذف عنصر الموقع؟","حذف العنصر");}
  for(const[name,tabName,label]of[["feature","overview","ميزة"],["delivery_item","delivery","بند"]]){await tab(tabName);while(await repeatRows(name).count())await confirmDelete(repeatRows(name).first().getByRole("button",{name:new RegExp("^حذف "+label+" ")}),"حذف "+label+"؟","حذف");}
  await tab("plans");while(await plans().count())await confirmDelete(plans().first().getByRole("button",{name:"حذف المخطط",exact:true}),"حذف المخطط؟","حذف");
  await tab("media");while(await mediaRows("gallery").count())await confirmDelete(mediaRows("gallery").first().getByRole("button",{name:"حذف الصورة 1",exact:true}),"حذف الصورة من المشروع؟","حذف الارتباط");
  while(await videoRows("gallery").count())await confirmDelete(videoRows("gallery").first().getByRole("button",{name:"حذف الفيديو",exact:true}),"حذف الفيديو من المشروع؟","حذف الفيديو");
  const draft=await assertDraft(true);for(const name of["location_point_ids","feature_ids","floor_plan_ids","delivery_item_ids","media_ids","video_ids"])assert.ok(draft.payload.deleted[name].length>0,"Existing child deletions must carry explicit IDs: "+name);
 }
 for(const recipe of plan.recipes)await run("core-project-controls-"+recipe.kind,[],async()=>{
  current=recipe;const leave=async dialog=>dialog.type()==="beforeunload"?dialog.accept():dialog.dismiss();page.on("dialog",leave);try{await observe("project-controls-navigation",()=>page.goto(origin+recipe.editPath,{waitUntil:"domcontentloaded"}));}finally{page.off("dialog",leave);}
  await expect(form()).toHaveCount(1);originalUi=(await readUi()).graph;await checkpoint("baseline");
  await authorPoints();await authorOrdered("feature","overview",v.features,"ميزة");await authorPlans();await authorOrdered("delivery_item","delivery",v.delivery,"بند");await authorMedia();await assertDraft();await dirtyCloseCancel();await checkpoint("draft");
  await semanticNegative();await checkpoint("negative");const rejectedPending=await observe("project-controls-native-rejection",()=>savePending(true));await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();await assertDraft();await dirtyCloseCancel();await checkpoint("serverRejected");
  const successfulPending=await observe("project-controls-native-pending",()=>savePending(false));await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();await checkpoint("saved");
  await page.reload({waitUntil:"domcontentloaded"});await assertDraft();await checkpoint("reloaded");await emptyAll();await dirtyCloseCancel();await checkpoint("emptyDraft");
  const[response]=await Promise.all([actionResponse(),save().click()]);assertActionAcknowledged(response);await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();await expect(save()).toBeEnabled();await checkpoint("emptySaved");
  await page.reload({waitUntil:"domcontentloaded"});await assertDraft(true);await checkpoint("emptyReloaded");
  const result={consumer:recipe.consumer,surface:recipe.surface,kind:recipe.kind,status:"pass",coverage:[],nativePhases:[...PROJECT_CONTROL_PHASES],rejectedPending,successfulPending,exactWrites:2,optionalGraphsEmpty:true,storageWrites:false,externalNavigation:false};outcomes.push(result);return result;
 });
 return{planned:plan.recipes.length,completed:outcomes.length,outcomes,automaticAxisCoverage:[],globalClosed:false,nativeFinalityRequired:true};
}
