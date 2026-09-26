import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption} from "./admin-core-rendered-adoption.mjs";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createJiti} from "jiti";
import {expect} from "playwright/test";
import {buildCorePresentationControlsPlan,loadPresentationControlBuilders,presentationControlForm,assertPresentationControlsConfig,PRESENTATION_CONTROL_PHASES,PRESENTATION_CONTROL_VALUES as v} from "./admin-core-presentation-controls-contract.mjs";

/** Existing unused internal Hero/generic Content only; no public destination follows. */
export async function runCorePresentationControlsJourneys(ctx){
 const{page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,nativeCheckpoint,requiredCases}=ctx;
 assert.equal(new URL(origin).hostname,"127.0.0.1");const f=fixtures.presentationControls;assert.ok(f);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});const{ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
 const plan=buildCorePresentationControlsPlan({manifest,fixtures:f}),builders=await loadPresentationControlBuilders(),outcomes=[];let current,renderedAdoption=[],renderedSeen=new Set();
 const form=()=>page.locator('form[data-admin-form-runtime]').filter({has:page.locator('input[name="id"][value="'+current.id+'"]')});
 const field=(name,scope=form())=>scope.locator('[name="'+name+'"]');
 const save=()=>form().locator('button[type="submit"]');
 const tab=id=>form().locator('[data-admin-tab-id="'+id+'"]').click();
 const checkpoint=async phase=>{const request={id:randomUUID(),kind:"presentation-controls-state",recipe:current.kind,phase},result=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(result[key],request[key]);assert.equal(result.status,"pass");return result;};
 async function checked(control,value){await expect(control).toHaveCount(1);if(await control.isChecked()!==value)await control.locator('xpath=ancestor::label[1]').click();if(value)await expect(control).toBeChecked();else await expect(control).not.toBeChecked();}
 async function select(name,value){
  const owner=form().locator('[data-admin-form-listbox]').filter({has:page.locator('select[name="'+name+'"]')}),combo=owner.getByRole("combobox");await expect(owner).toHaveCount(1);await combo.press("Home");
  const id=await combo.getAttribute("aria-controls");assert.ok(id?.endsWith("-listbox"));const menu=page.getByRole("listbox").and(page.locator('[id="'+id+'"]'));await expect(menu).toBeVisible();
  const options=await menu.getByRole("option").evaluateAll(nodes=>nodes.filter(node=>!node.hasAttribute("disabled")&&node.getAttribute("aria-disabled")!=="true").map(node=>node.id));const target=id.slice(0,-8)+"-option-"+String(value),index=options.indexOf(target);assert.ok(index>=0);await expect(combo).toHaveAttribute("aria-activedescendant",options[0]);for(let n=0;n<index;n++)await combo.press("ArrowDown");await expect(combo).toHaveAttribute("aria-activedescendant",target);await combo.press("Enter");await expect(owner.locator("select")).toHaveValue(value);await expect(combo).toBeFocused();
 }
 async function format(name){
  const row=form().locator('[data-module-editor-control-row]').filter({has:page.locator('input[name="'+name+'_alignment"]')}),expected=v.format[name];await expect(row).toHaveCount(1);
  const switches=row.getByRole("switch"),bolds=row.locator('[data-admin-text-format-bold]');await expect(switches).toHaveCount(name==="cta"?2:1);
  await checked(switches.first(),!expected.visible);await checked(switches.first(),expected.visible);
  if(await bolds.first().getAttribute("aria-pressed")!==String(!expected.bold))await bolds.first().click();await bolds.first().click();
  for(const alignment of["left","center","right",expected.alignment])await row.locator('[data-admin-text-alignment="'+alignment+'"]').first().click();
  await expect(field("show_"+name)).toHaveValue(String(expected.visible));await expect(field(name+"_bold")).toHaveValue(String(expected.bold));await expect(field(name+"_alignment")).toHaveValue(expected.alignment);
  for(const control of await switches.all())if(expected.visible)await expect(control).toBeChecked();else await expect(control).not.toBeChecked();for(const bold of await bolds.all())await expect(bold).toHaveAttribute("aria-pressed",String(expected.bold));
 }
 const linkOwner=prefix=>field(prefix+"_link_kind").locator('xpath=..');
 async function link(prefix,href,target,cancel=false){
  const trigger=linkOwner(prefix).getByRole("button",{name:"اختيار الرابط",exact:true}),before=await field(prefix+"_link_href").inputValue();await trigger.click();const dialog=page.getByRole("dialog",{name:"اختيار رابط",exact:true});await expect(dialog).toBeVisible();await dialog.getByRole("button",{name:"External",exact:true}).click();await dialog.getByLabel("الرابط",{exact:true}).fill(href);await checked(dialog.getByRole("switch",{name:"فتح في تبويب جديد",exact:true}),target==="_blank");await expect(field(prefix+"_link_href")).toHaveValue(before);
  if(!renderedSeen.has('link:'+prefix)){
   const common={page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:current.consumer,surface:current.surface}]};
   renderedAdoption.push(await observeCoreModalFocusAdoption({...common,id:'presentation-'+current.kind+'-'+prefix+'-link-focus',dialog}));
   const body=dialog.locator(':scope > div').filter({has:page.getByLabel('الرابط',{exact:true})}),target=dialog.getByRole('switch',{name:'فتح في تبويب جديد',exact:true}).locator('xpath=ancestor::label[1]');
   renderedAdoption.push(await observeCoreScrollbarAdoption({...common,id:'presentation-'+current.kind+'-'+prefix+'-link-scroll',container:body,target,axis:'y',containment:'modal-lock'}));renderedSeen.add('link:'+prefix);
  }
  await dialog.getByRole("button",{name:cancel?"إلغاء":"اعتماد الرابط",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(field(prefix+"_link_href")).toHaveValue(cancel?before:href);if(!cancel)await expect(field(prefix+"_link_target")).toHaveValue(target);
 }
 const gallery=name=>form().locator('[data-admin-media-gallery-mode="paths"]').filter({has:page.locator('input[name="'+name+'"]')});
 const cards=name=>gallery(name).locator('[data-admin-media-gallery-card="image"]');
 async function chooseAsset(trigger,index,cancel=false){
  const asset=f.assets[index],match=response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==="/api/admin/media-library"&&response.request().method()==="GET";};
  const[initial]=await Promise.all([page.waitForResponse(match),trigger.click()]);assert.equal(initial.status(),200);const data=await initial.json(),root=data.folders.find(row=>row.path==="images");assert.ok(root);
  const dialog=page.getByRole("dialog",{name:"اختيار صورة من المكتبة",exact:true});await expect(dialog).toBeVisible();await dialog.getByRole("navigation",{name:"مجلدات الوسائط",exact:true}).getByRole("button").filter({has:page.getByText(root.displayName,{exact:true})}).click();
  const[found]=await Promise.all([page.waitForResponse(response=>match(response)&&new URL(response.url()).searchParams.get("q")===asset.objectKey&&new URL(response.url()).searchParams.get("folder")==="images"),dialog.getByPlaceholder("ابحث بالاسم أو المسار أو الوصف البديل…",{exact:true}).fill(asset.objectKey)]);assert.equal(found.status(),200);assert.deepEqual((await found.json()).assets.map(row=>row.publicUrl),[asset.publicUrl]);
  const choice=dialog.locator('button[aria-pressed]').filter({has:page.getByText(asset.displayName,{exact:true})});await expect(choice).toHaveCount(1);await choice.click();await expect(choice).toHaveAttribute("aria-pressed","true");
  if(!renderedSeen.has('media-picker')){
   const common={page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:current.consumer,surface:current.surface}]};
   renderedAdoption.push(await observeCoreModalFocusAdoption({...common,id:'presentation-'+current.kind+'-media-focus',dialog,escape:'not-exercised'}));
   const container=dialog.locator('[data-media-picker-scroll]'),target=dialog.getByText('يُعاد التحقق من الارتباطات تلقائيًا قبل أي حذف.',{exact:true});
   renderedAdoption.push(await observeCoreScrollbarAdoption({...common,id:'presentation-'+current.kind+'-media-scroll',container,target,axis:'y',containment:'overscroll-contain'}));renderedSeen.add('media-picker');
  }
  await dialog.getByRole("button",{name:cancel?"إلغاء":"تأكيد الاختيار",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 }
 async function authorMedia(){
  await tab("media");await select("image_composition","cover-center");await select("image_composition","cover-upper");
  await expect(cards("images")).toHaveCount(0);await expect(cards("mobile_images")).toHaveCount(0);
  for(const index of[0,1,2])await chooseAsset(gallery("images").locator('[data-admin-media-gallery-action="add"]'),index);
  await expect(cards("images").first().locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled();await expect(cards("images").last().locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
  await cards("images").nth(1).locator('[data-admin-media-gallery-action="move-up"]').click();await expect(field("images")).toHaveValue([f.assets[1].publicUrl,f.assets[0].publicUrl,f.assets[2].publicUrl].join("\n"));
  const before=await field("images").inputValue();await chooseAsset(cards("images").nth(1).locator('[data-admin-media-gallery-action="replace"]'),2,true);await expect(field("images")).toHaveValue(before);
  await chooseAsset(cards("images").nth(1).locator('[data-admin-media-gallery-action="replace"]'),2);await cards("images").last().locator('[data-admin-media-gallery-action="remove"]').click();await expect(field("images")).toHaveValue([f.assets[1].publicUrl,f.assets[2].publicUrl].join("\n"));
  await chooseAsset(gallery("mobile_images").locator('[data-admin-media-gallery-action="add"]'),0);await chooseAsset(cards("mobile_images").first().locator('[data-admin-media-gallery-action="replace"]'),1);await expect(field("mobile_images")).toHaveValue(f.assets[1].publicUrl);await cards("mobile_images").first().locator('[data-admin-media-gallery-action="remove"]').click();await expect(field("mobile_images")).toHaveValue("");await expect(cards("mobile_images")).toHaveCount(0);
 }
 async function assertUi(){
  const entries=await form().evaluate(el=>Array.from(new FormData(el).entries()).map(([key,value])=>[key,String(value)]));const data=new FormData();for(const[key,value]of entries)data.append(key,value);const actual=builders.build(current.kind,data);assert.deepEqual(actual,builders.build(current.kind,presentationControlForm(current.kind,f)));assertPresentationControlsConfig(current.kind,actual,f);await expect(field("name")).toHaveValue(current.name);await expect(field("slug")).toHaveValue(current.slug);
 }
 async function author(){
  await tab("content");for(const name of current.kind==="hero"?["eyebrow","title","highlight","subtitle","description"]:["eyebrow","title","subtitle","body"])await field(name).fill(v[name]);
  for(const name of current.kind==="hero"?["eyebrow","title","highlight","subtitle","description"]:["eyebrow","title","subtitle","description"])await format(name);
  if(current.kind==="hero"){
   await select("variant","home-cinematic");await select("variant","internal-page");await expect(form().locator('[data-admin-tab-id="order"]')).toHaveCount(0);
   await tab("buttons");await field("primary_cta_label").fill(v.primary);await link("primary_cta",v.hrefs[0],"_blank");await link("primary_cta",v.hrefs[1],"_self");await link("primary_cta",v.hrefs[0],"_blank",true);
   await field("secondary_cta_label").fill(v.secondary);await link("secondary_cta",v.hrefs[0],"_blank");await linkOwner("secondary_cta").getByRole("button",{name:"مسح",exact:true}).click();await field("secondary_cta_label").fill("");await expect(field("secondary_cta_link_kind")).toHaveValue("none");await format("cta");await authorMedia();
  }else{await expect(form().locator('[data-admin-tab-id="media"], [data-admin-tab-id="buttons"]')).toHaveCount(0);await expect(field("variant")).toHaveAttribute("type","hidden");await expect(field("style_preset")).toHaveAttribute("type","hidden");}
  await tab("content");await assertUi();
 }
 async function cancelDirtyBacklink(){const original=page.url(),trigger=page.locator('a[href="/admin/pages-blocks/blocks/'+current.kind+'"]').first();await expect(form()).toHaveAttribute("data-admin-form-dirty","true");await expect(trigger).toBeVisible();await trigger.click();const dialog=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});await expect(dialog).toBeVisible();if(!renderedSeen.has('dirty-confirmation')){renderedAdoption.push(await observeCoreModalFocusAdoption({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:current.consumer,surface:current.surface}],id:'presentation-'+current.kind+'-dirty-focus',dialog,state:'dirty-confirmation',escape:'not-exercised'}));renderedSeen.add('dirty-confirmation');}await dialog.locator("[data-admin-confirm-cancel]").click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(page.url(),original);await expect(form()).toHaveAttribute("data-admin-form-dirty","true");await assertUi();}
 async function semanticNegative(){await field("name").fill("");const[response]=await Promise.all([actionResponse(),save().click()]);assert.equal(response.status(),500,"Canonical current missing-name Action throws before its domain write.");await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();await expect(save()).toBeEnabled();await expect(field("title")).toHaveValue(v.title);await expect(field("name")).toHaveValue("");await field("name").fill(current.name);await assertUi();}
 async function pending(cancel){
  const token=randomUUID(),entity="presentation_control_"+current.kind;const fault=async operation=>{const request={id:randomUUID(),kind:"domain-write-fault-"+operation,entity,token},result=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(result[key],request[key]);assert.equal(result.status,"pass");return result;};let armed=false,responsePromise;const posts=[],listener=request=>{if(request.method()==="POST"&&request.headers()["next-action"]&&new URL(request.url()).origin===origin)posts.push(request);};
  try{await fault("arm");armed=true;page.on("request",listener);responsePromise=actionResponse();void responsePromise.catch(()=>{});await save().click();const first=await fault("observe-blocked");assert.equal(first.observedOneStatement,true);await expect(form()).toHaveAttribute("aria-busy","true");await expect(form().locator('fieldset[data-admin-form-fields]')).toBeDisabled();await expect(save()).toBeDisabled();await expect(field("name")).toBeDisabled();await expect(field("title")).toBeDisabled();await expect(form().locator('[data-admin-form-action="close"]')).toHaveCount(0);
   await page.keyboard.press("Enter");await page.keyboard.press("Enter");const second=await fault("observe-blocked");for(const key of["backendPid","backendStartedAt","queryStartedAt","queryFingerprint","holderPid"])assert.equal(second[key],first[key]);assert.equal(posts.length,1);if(cancel)assert.equal((await fault("cancel")).cancelledOneStatement,true);const released=await fault("release");armed=false;assert.equal(released.ownedLockRolledBack,true);assert.equal(released.cancellationObserved,cancel);const response=await responsePromise;if(cancel)assert.equal(response.status(),500);else assertActionAcknowledged(response);await expect(save()).toBeEnabled();return{nativeStatementObservedTwice:true,sameStatementIdentity:true,actionRequests:posts.length,normalKeyboardDedup:true,fieldsDisabled:true,closeControl:"not_declared",actualStatementCancelled:cancel,ownedLockReleased:true};
  }finally{page.off("request",listener);try{if(armed)await fault("release");}finally{if(responsePromise)await Promise.allSettled([responsePromise]);}}
 }
 for(const recipe of plan.recipes)await run("core-presentation-controls-"+recipe.kind,[],async()=>{
  current=recipe;renderedAdoption=[];renderedSeen=new Set();const leave=async dialog=>dialog.type()==="beforeunload"?dialog.accept():dialog.dismiss();page.on("dialog",leave);try{await observe("presentation-controls-navigation",()=>page.goto(origin+recipe.editPath,{waitUntil:"domcontentloaded"}));}finally{page.off("dialog",leave);}
  await expect(form()).toHaveCount(1);await checkpoint("baseline");await author();await checkpoint("draft");await semanticNegative();await checkpoint("negative");const rejected=await observe("presentation-controls-native-rejection",()=>pending(true));await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();await assertUi();await observe("presentation-controls-post-rejection-dirty-navigation",cancelDirtyBacklink);await checkpoint("serverRejected");
  const saved=await observe("presentation-controls-native-pending",()=>pending(false));await expect(page).toHaveURL(url=>url.pathname===recipe.editPath&&url.searchParams.get("saved")==="1",{timeout:60_000});await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();await assertUi();await checkpoint("saved");
  await observe("presentation-controls-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await tab("content");await assertUi();await checkpoint("reloaded");
  const result={renderedAdoption,kind:recipe.kind,consumer:recipe.consumer,surface:recipe.surface,nativeCheckpoints:6,nativePhases:[...PRESENTATION_CONTROL_PHASES],exactWrites:1,pendingRejection:rejected,pendingSave:saved,postRejectionDirtyNavigationCancelled:true,controls:recipe.kind==="hero"?["five_text_fields","visibility_bold_alignment","current_variant_selection_restored","image_composition","desktop_add_replace_cancel_order_remove","optional_mobile_add_replace_empty","primary_link_replace_target_cancel","secondary_link_clear","mirrored_cta_controls"]:["four_generic_text_fields","visibility_bold_alignment","hidden_identity_preserved"],automaticAxisCoverage:[],globalClosed:false};outcomes.push(result);return result;
 });
 return{planned:2,completed:outcomes.length,outcomes,nonCapabilities:plan.nonCapabilities,nativeFinalityRequired:true,globalClosed:false};
}
