import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption,observeCoreModalCleanReturn,observeCoreModalPendingDismissal} from "./admin-core-rendered-adoption.mjs";
import {exerciseCoreDownloadField,CORE_DOWNLOAD_MEDIA_HREF} from './admin-core-download-media-adoption.mjs';
import { runCoreDescendantPresentationJourneys } from './admin-core-descendant-presentation-journeys.mjs';
import assert from "node:assert/strict";
import { observeCoreAcceptedFormFeedback, observeCoreVisibleAcceptedFeedback, runCoreFormPermissionIntent } from "./admin-core-domain-form-journeys.mjs";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

const families = ["pages-quick-create", "menu-quick-create", "menu-builder", "footer-builder", "page-composition-and-seo"];
export function buildCoreNavigationSettingsPlan({ manifest, collections, requiredCases, fixtures }) {
  const forms = families.map(id => { const matches = manifest.filter(row => row.id === id); assert.equal(matches.length, 1); return matches[0]; });
  assert.deepEqual(forms.slice(0, 2).map(row => row.classification), ["shared_adopter", "shared_adopter"]);
  for (const form of forms.slice(2)) assert.equal(form.classification, "specialized_exception");
  assert.deepEqual(forms[0].surfaces, ["create"]); assert.deepEqual(forms[1].surfaces, ["menu-create"]);
  assert.deepEqual(forms[2].surfaces, ["menu-edit", "item-edit", "ordering", "row-command"]);
  assert.deepEqual(forms[3].surfaces, ["footer-compose", "footer-link-edit", "ordering"]); assert.ok(forms[4].surfaces.includes("seo"));
  for (const id of ["menus-list", "menu-items", "footer-fixed-slots", "footer-manual-links"]) assert.equal(collections.filter(row => row.id === id).length, 1);
  assert.equal(fixtures.recipe.page.path, "/qa-core-navigation-page"); assert.equal(fixtures.recipe.menu.slug, "qa-core-navigation-menu");
  assert.ok(fixtures.duplicatePagePath.startsWith("/") && fixtures.duplicateMenuSlug); assert.match(fixtures.originalFooterHash, /^[a-f0-9]{64}$/u);
  const coverage = id => ["save_reload", "failure_preserves_input", "retry"].map(scenario => {
    const surface = forms.find(row => row.id === id).surfaces[0];
    const matches = requiredCases.filter(row => row.boundary === "form" && row.consumer === id && row.surface === surface && row.scenario === scenario);
    assert.equal(matches.length, 1); return matches[0].key;
  });
  return { consumers: forms.map(row => ({ consumer: row.id, classification: row.classification, surfaces: row.id === "page-composition-and-seo" ? ["seo"] : [...row.surfaces] })), pageCoverage: coverage(families[0]), menuCoverage: coverage(families[1]), specializedAutomaticCoverage: [], globalClosed: false,
    remaining: ["Composition/layout and Media fields other than the declared PDF link selection remain outside this cohort.", "Menu bulk operations belong to the separate bulk cohort.", "No generic pending, responsive or complete capability closure is inferred from these selected journeys.", "Existing native stale-target concurrency proof is not relabelled as this cohort's Browser coverage."] };
}

/** Real isolated UI only. Finite native checkpoints own all expected values and actor attribution. */
export async function runCoreNavigationSettingsJourneys(ctx) {
  const { page, origin, fixtures, run, observe, nativeCheckpoint, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); assert.equal(new URL(origin).protocol, "http:");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../../src/lib/admin/interaction-system/adoption-manifest.ts");
  const plan = buildCoreNavigationSettingsPlan({ manifest, collections: ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces, requiredCases, fixtures: fixtures.navigationSettings });
  const f = fixtures.navigationSettings, r = f.recipe, completed = [], checkpoints = [], permissionEvidence = [], downloadMedia = [];
  const checkpoint = async (entity, phase) => {
    const request = { id: randomUUID(), kind: "navigation-settings-state", entity, phase };
    const result = await nativeCheckpoint(request); for (const key of Object.keys(request)) assert.equal(result[key], request[key]); assert.equal(result.status, "pass"); checkpoints.push(result); return result;
  };
  const goto = path => observe("navigation-settings-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" }));
  const action = async trigger => {
    const [response] = await observe("navigation-settings-action", () => Promise.all([page.waitForResponse(response => response.request().method() === "POST" && response.request().headers()["next-action"] && new URL(response.url()).origin === origin), trigger()]));
    assert.ok(response.status() < 400, "HTTP acknowledgement is followed by canonical UI outcome and native assertions; Flight EOF is not required.");
  };
  const select = async (scope, name, label) => { await scope.getByRole("combobox", { name, exact: true }).click(); await page.getByRole("option", { name: label, exact: true }).click(); };
  const switchTo = async (scope, name, value) => { const input = scope.getByRole("switch", { name, exact: true }); if (await input.isChecked() !== value) await input.locator("xpath=ancestor::label[1]").click(); await expect(input).toBeChecked({ checked: value }); };
  const tab = async id => { await page.locator(`[data-admin-tab-id="${id}"]`).click(); };
  const confirm = () => page.locator("[data-admin-confirm-submit]");
  const cancel = () => page.locator("[data-admin-confirm-cancel]");
  const rowById = (type, id) => page.locator("article").filter({ has: page.locator(`[data-admin-entity-type="${type}"][data-admin-entity-id="${id}"]`) });
  const rowByLabel = label => page.locator("article").filter({ has: page.getByText(label, { exact: true }) });
  const more = async (row, kind) => { await row.locator('[data-admin-row-action="more"] button').click(); await page.locator(`[data-admin-row-action-menu-item="${kind}"]`).click(); };
  const assertInverseVisibility=async(row,label)=>{const trigger=row.locator('[data-admin-row-action="more"] button');await trigger.click();const menu=page.locator('[data-admin-row-actions-menu]');await expect(menu.locator('[data-admin-row-action-menu-item="visibility"]')).toHaveText(label);await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();};
  const feedback = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first();
  const externalLink = async (scope, href) => {
    await scope.getByRole("button", { name: "اختيار الرابط", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "اختيار رابط", exact: true });
    await picker.getByRole("button", { name: "External", exact: true }).click();
    await picker.getByLabel("الرابط", { exact: true }).fill(href);
    await switchTo(picker, "فتح في تبويب جديد", true);
    await picker.getByRole("button", { name: "اعتماد الرابط", exact: true }).click(); await expect(picker).toBeHidden();
  };
  let renderedAdoption=[],renderedOpened=new Set();
  const renderedBase=(consumer,surface,collections,axis)=>({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:"form",consumer,surface},...(axis==="modal"?collections.map(consumer=>({boundary:"collection",consumer,surface:new URL(page.url()).pathname})):[])]});
  async function observeNavigationOpening({id,consumer,surface,collections,dialog,target,form=null,trigger=null}) {
    if(renderedOpened.has(id))return;
    const common=renderedBase(consumer,surface,collections,"modal");
    if(form){assert.ok(trigger);renderedAdoption.push(await observeCoreModalCleanReturn({...common,id:id+"-return",dialog,form,trigger,cancel:form.getByRole("button",{name:"إلغاء",exact:true})}));}
    renderedAdoption.push(await observeCoreModalFocusAdoption({...common,id:id+"-focus",dialog}));
    const body=dialog.locator(":scope > div").filter({has:page.locator("[data-admin-feedback-modal-host]")});
    renderedAdoption.push(await observeCoreScrollbarAdoption({...renderedBase(consumer,surface,collections,"scrollbar"),id:id+"-scroll",container:body,target,axis:"y",containment:"modal-lock"}));
    renderedOpened.add(id);
  }
  async function observePageCreatePending(form) {
    const dialog=page.getByRole("dialog",{name:"إضافة صفحة جديدة",exact:true});
    renderedAdoption.push(await observeCoreModalPendingDismissal({...renderedBase("pages-quick-create","create",["pages"],"modal"),id:"navigation-page-create-pending",dialog,form}));
  }
  const rowActionObservations=[];
  async function inspectRow({type,id,label,information,preview}) {
    const row=rowById(type,id),path=new URL(page.url()).pathname,posts=[];
    await expect(row).toHaveCount(1);await expect(row).toBeVisible();
    const listener=request=>{if(request.method()==='POST'&&new URL(request.url()).origin===origin)posts.push(request);};page.on('request',listener);
    try {
      const previewOwner=row.locator('[data-admin-row-action="preview"]');
      if(preview.access==='disabled') {await expect(previewOwner.locator('button')).toBeDisabled();await expect(previewOwner.locator('button')).toHaveAttribute('title',preview.reason);await expect(previewOwner.locator('a')).toHaveCount(0);}
      else {const anchor=previewOwner.locator('a');await expect(anchor).toHaveAttribute('href',preview.href);await expect(anchor).toHaveAttribute('target','_blank');await expect(anchor).toHaveAttribute('rel','noreferrer');}
      const trigger=row.locator('[data-admin-row-action="more"] button');await trigger.click();
      const menu=page.locator('[data-admin-row-actions-menu]');await expect(menu).toHaveAttribute('data-admin-entity-type',type);await expect(menu).toHaveAttribute('data-admin-entity-id',String(id));
      await expect(menu.locator('[data-admin-row-action-menu-item="copyPublicLink"]')).toHaveCount(0);
      await menu.locator('[data-admin-row-action-menu-item="information"]').click();
      const info=page.locator('[data-admin-row-actions-information]');await expect(info).toHaveAttribute('data-admin-entity-type',type);await expect(info).toHaveAttribute('data-admin-entity-id',String(id));await expect(info).toHaveAttribute('aria-label','معلومات '+label);
      for(const [key,value]of Object.entries(information)){const field=info.locator('dl > div').filter({has:page.locator('dt').filter({hasText:new RegExp('^'+key+'$','u')})});await expect(field).toHaveCount(1);await expect(field.locator('dd')).toHaveText(value);}
      await info.getByRole('button',{name:'رجوع',exact:true}).click();await expect(menu).toBeVisible();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(new URL(page.url()).pathname,path);assert.equal(posts.length,0);
      return{type,id:String(id),label,routePathname:path,information,preview,copyHidden:true,informationReturnedFocus:true,actionRequests:0,externalDestinationFollowed:false};
    } finally {page.off('request',listener);}
  }
  const existingOnly=isCoreNavigationExistingSelection(ctx.journeySelection),graphFooterOnly=ctx.journeySelection===CORE_NAVIGATION_GRAPH_FOOTER_SELECTION,menuFooterOnly=graphFooterOnly||ctx.journeySelection===CORE_NAVIGATION_MENU_FOOTER_SELECTION;assert.equal(f.selection??null,ctx.journeySelection??null);
  let pageId=existingOnly?f.prepared.pageId:undefined,menuId=existingOnly?f.prepared.menuId:undefined,itemIds;
  if(existingOnly){assert.equal(f.prepared.kind,'owned-fixture-preparation');for(const id of[pageId,menuId])assert.ok(Number.isSafeInteger(id)&&id>0);}
  if (!isCoreNavigationFollowupSelection(ctx.journeySelection)) await runCoreDescendantPresentationJourneys(ctx,"navigation");
  if(!existingOnly) await run("core-navigation-page-create-rejection-retry-reload", plan.pageCoverage, async () => {
    renderedAdoption=[];renderedOpened=new Set();
    await goto("/admin/pages-blocks/pages"); await checkpoint("page", "baseline");
    await page.getByRole("button", { name: "إضافة صفحة", exact: true }).click(); const form = page.locator("#create-page-form");
    await observeNavigationOpening({id:"navigation-page-create",consumer:"pages-quick-create",surface:"create",collections:["pages"],dialog:page.getByRole("dialog",{name:"إضافة صفحة جديدة",exact:true}),form,trigger:page.getByRole("button",{name:"إضافة صفحة",exact:true}),target:form.getByRole("button",{name:"إنشاء وفتح المحرر",exact:true})});
    await form.locator('[name="path"]').fill(f.duplicatePagePath);
    await action(() => form.getByRole("button", { name: "إنشاء وفتح المحرر", exact: true }).click());
    await expect(form.locator('[name="title"]')).toBeEnabled();
    await expect(form.locator('[name="title"]')).toHaveAttribute("aria-invalid", "true");
    await expect(form.locator('#title-error')).toHaveText("اسم الصفحة مطلوب.");
    await expect(form.locator('[name="title"]')).toHaveValue("");
    assert.equal(await form.locator('[name="title"]').evaluate(input => input.validity.valueMissing), true);
    await form.locator('[name="title"]').fill(r.page.title);
    await action(() => form.getByRole("button", { name: "إنشاء وفتح المحرر", exact: true }).click());
    await expect(form.locator('[name="path"]')).toHaveAttribute("aria-invalid", "true");
    await expect(form.locator('[name="title"]')).toHaveValue(r.page.title); await expect(form.locator('[name="path"]')).toHaveValue(f.duplicatePagePath);
    await checkpoint("page", "rejected");
    await form.locator('[name="path"]').fill(r.page.path);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-navigation-page-create-accepted-save",journeyId:"core-navigation-page-create-rejection-retry-reload",formConsumer:"pages-quick-create",surface:"create"},form,submit:form.locator('button[type="submit"]'),dirtyNavigation:"close",observePending:()=>observePageCreatePending(form),
      discardDirty:{trigger:form.getByRole('button',{name:'إلغاء',exact:true}),destination:{kind:'closed',pathname:'/admin/pages-blocks/pages'},reopenAndRefill:async()=>{await page.getByRole('button',{name:'إضافة صفحة',exact:true}).click();await form.locator('[name="title"]').fill(r.page.title);await form.locator('[name="path"]').fill(r.page.path);}},
      assertDraft:async()=>{await expect(form.locator('[name="title"]')).toHaveValue(r.page.title);await expect(form.locator('[name="path"]')).toHaveValue(r.page.path);},
      cancelDirty:async()=>{const original=page.url(),trigger=form.getByRole("button",{name:"إلغاء",exact:true});await trigger.click();const dialog=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});await expect(dialog).toBeVisible();renderedAdoption.push(await observeCoreModalFocusAdoption({...renderedBase("pages-quick-create","create",["pages"],"modal"),id:"navigation-page-create-dirty-focus",dialog,state:"dirty-confirmation",escape:"not-exercised"}));await dialog.locator("[data-admin-confirm-cancel]").click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(page.url(),original);await expect(form).toBeVisible();},
    });
    let acceptedFeedback;
    await runCoreFormPermissionIntent({permissionReplay:ctx.permissionReplay,mapping:{caseId:"core-navigation-page-create-accepted-save",formConsumer:"pages-quick-create",surface:"create"},permissionEvidence,perform:async()=>{
    acceptedFeedback=await observeCoreAcceptedFormFeedback({form,consumer:"pages-quick-create",surface:"create",entityKey:"page-quick-create",routePrefix:"/admin/pages-blocks/pages",requiredCases,perform:async()=>{
    await action(() => form.getByRole("button", { name: "إنشاء وفتح المحرر", exact: true }).click());
    await expect(page).toHaveURL(url => /^\/admin\/pages-blocks\/pages\/\d+$/u.test(url.pathname));
    pageId = Number(new URL(page.url()).pathname.split("/").at(-1));return{entityId:pageId,routePathname:new URL(page.url()).pathname};}});
    await goto(`/admin/pages-blocks/pages/${pageId}`); await expect(page.getByRole("heading", { name: `إدارة صفحة ${r.page.title}`, exact: true })).toBeVisible();
    assert.equal((await checkpoint("page", "created")).pageId, pageId);
      return {nativeWrites:[{table:"pages",id:pageId,expected:{title:r.page.title,path:r.page.path,slug:r.page.slug,status:"unpublished",page_type:"static"},auditEntityType:"page",auditEntityLabel:r.page.title,auditActions:["page.create"]}]};
    }});
    completed.push("page-create");
    return {acceptedFeedback,consumer:"pages-quick-create",surface:"create",permissionEvidence:[...permissionEvidence],renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  assert.ok(pageId, "Page creation must finish before dependent metadata work.");
  if(!menuFooterOnly) await run("core-navigation-page-seo-validation-save-reload", [], async () => {
    const path = `/admin/pages-blocks/pages/${pageId}?tab=seo`;
    const fillSeo = async canonical => {
      for (const [name, value] of Object.entries({ seo_title: r.page.seoTitle, seo_description: r.page.seoDescription, focus_keyword: r.page.focusKeyword, canonical_url: canonical })) await page.locator(`[name="${name}"]`).fill(value);
      const tags = page.locator("[data-admin-tags-field]").filter({ has: page.locator('[name="seo_keywords"]') });
      for (const word of r.page.seoKeywords) { await tags.getByPlaceholder("اكتب كلمة مفتاحية ثم Enter أو , أو ;", { exact: true }).fill(word); await tags.getByPlaceholder("اكتب كلمة مفتاحية ثم Enter أو , أو ;", { exact: true }).press("Enter"); }
      await expect(tags.locator('[name="seo_keywords"]')).toHaveValue(r.page.seoKeywords.join(", "));
      await select(page, "الفهرسة", "Noindex"); await select(page, "تتبع الروابط", "Nofollow");
    };
    await goto(path); await fillSeo("ftp://example.invalid/rejected");
    await action(() => page.getByRole("button", { name: "حفظ إعدادات السيو", exact: true }).click());
    await expect(page).toHaveURL(url => url.searchParams.has("seo_error")); await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();
    await checkpoint("page", "seo-rejected");
    await goto(path); await fillSeo(r.page.canonicalUrl); await action(() => page.getByRole("button", { name: "حفظ إعدادات السيو", exact: true }).click());
    await expect(page).toHaveURL(url => url.searchParams.get("seo_notice") === "saved"); await goto(path);
    await expect(page.locator('[name="seo_title"]')).toHaveValue(r.page.seoTitle); await expect(page.locator('[name="canonical_url"]')).toHaveValue(r.page.canonicalUrl);
    await checkpoint("page", "seo-saved"); completed.push("page-seo");
  });
  if(!existingOnly) await run("core-navigation-menu-create-rejection-retry-reload", plan.menuCoverage, async () => {
    renderedAdoption=[];renderedOpened=new Set();
    await goto("/admin/pages-blocks/menus"+(existingOnly?"?q="+encodeURIComponent(r.menu.slug):"")); await checkpoint("menu", "baseline");
    await page.getByRole("button", { name: "إضافة منيو", exact: true }).click(); const form = page.locator("#create-menu-form");
    await observeNavigationOpening({id:"navigation-menu-create",consumer:"menu-quick-create",surface:"menu-create",collections:["menus-list"],dialog:page.getByRole("dialog",{name:"إضافة قائمة جديدة",exact:true}),form,trigger:page.getByRole("button",{name:"إضافة منيو",exact:true}),target:form.getByRole("button",{name:"إنشاء وفتح القائمة",exact:true})});
    await form.locator('[name="name"]').fill(r.menu.name); await form.locator('[name="slug"]').fill(f.duplicateMenuSlug); await select(form, "مكان الاستخدام", "Custom");
    await action(() => form.getByRole("button", { name: "إنشاء وفتح القائمة", exact: true }).click());
    await expect(form.locator('[name="slug"]')).toHaveAttribute("aria-invalid", "true"); await expect(form.locator('[name="name"]')).toHaveValue(r.menu.name); await expect(form.locator('[name="slug"]')).toHaveValue(f.duplicateMenuSlug);
    await checkpoint("menu", "rejected"); await form.locator('[name="slug"]').fill(r.menu.slug);
    const acceptedFeedback=await observeCoreAcceptedFormFeedback({form,consumer:"menu-quick-create",surface:"menu-create",entityKey:"menu-quick-create",routePrefix:"/admin/pages-blocks/menus",requiredCases,perform:async()=>{
    await action(() => form.getByRole("button", { name: "إنشاء وفتح القائمة", exact: true }).click());
    await expect(page).toHaveURL(url => /^\/admin\/pages-blocks\/menus\/\d+$/u.test(url.pathname)); menuId = Number(new URL(page.url()).pathname.split("/").at(-1));return{entityId:menuId,routePathname:new URL(page.url()).pathname};}});
    await goto(`/admin/pages-blocks/menus/${menuId}`); await tab("menu-settings"); await expect(page.locator('input[name="name"]')).toHaveValue(r.menu.name);
    const acceptedNative=await checkpoint("menu", "created");assert.equal(acceptedNative.menuId, menuId); completed.push("menu-create");
    return {acceptedFeedback,acceptedNativeId:acceptedNative.id,renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  assert.ok(menuId, "Menu creation must finish before dependent graph work.");
  await run("core-navigation-menu-metadata-item-graph-commands", [], async () => {
    renderedAdoption=[];renderedOpened=new Set();
    const path = '/admin/pages-blocks/menus/'+menuId;
    await goto('/admin/pages-blocks/menus'+(existingOnly?'?q='+encodeURIComponent(r.menu.slug):''));
    const menuObservation=await inspectRow({type:'menu',id:menuId,label:r.menu.name,information:{Slug:r.menu.slug,'الموقع':'Custom','عدد العناصر':'0','الحالة':'ظاهرة'},preview:{access:'disabled',reason:'القائمة لا تملك مسار معاينة عامًا خاصًا بها.'}});
    const menuEdit=rowById('menu',menuId).locator('[data-admin-row-action="edit"] a');await expect(menuEdit).toHaveAttribute('href',path);await menuEdit.click();await expect(page).toHaveURL(origin+path);await tab('menu-settings');await expect(page.locator('input[name="name"]')).toHaveValue(r.menu.name);
    rowActionObservations.push({...menuObservation,edit:{mode:'navigation',pathname:path,opened:true},nativeCheckpointId:(await checkpoint('menu','created-row-inspected')).id});
    await goto(path); await tab("menu-settings"); await page.locator('input[name="name"]').fill(r.menu.editedName);
    await action(() => page.getByRole("button", { name: "حفظ بيانات القائمة", exact: true }).click()); await expect(page).toHaveURL(url => url.pathname === "/admin/pages-blocks/menus"); await checkpoint("menu", "metadata-saved");
    const add = async (label, parent, href, phase) => {
      await goto(path); await tab("add-item"); const form = page.locator("form").filter({ has: page.locator('input[name="label"]') });
      await form.locator('[name="label"]').fill(label); await form.locator('[name="sort_order"]').fill("100");
      if (parent) await select(form, "Parent", parent);
      if (href) await externalLink(form, href); else await switchTo(form, "عنصر أب بدون رابط (Parent)", true);
      await action(() => form.getByRole("button", { name: "إضافة", exact: true }).click()); await expect(page).toHaveURL(url => url.searchParams.has("message"));
      await goto(path); await expect(rowByLabel(label)).toBeVisible(); itemIds = (await checkpoint("menu", phase)).itemIds;
    };
    await add(r.menu.a, null, null, "item-a"); await add(r.menu.b, null, null, "item-b"); await add(r.menu.c, r.menu.a, r.menu.href, "item-c");
    const parentObservation=await inspectRow({type:'menu_item',id:itemIds.a,label:r.menu.a,information:{'الرابط':'#','الحالة':'ظاهر'},preview:{access:'disabled',reason:'لا يملك العنصر مسارًا عامًا مستقلاً يمكن معاينته من هنا.'}});
    const childObservation=await inspectRow({type:'menu_item',id:itemIds.c,label:r.menu.c,information:{'الرابط':r.menu.href,'الحالة':'ظاهر'},preview:{access:'allowed',href:r.menu.href}});
    const itemInspection=await checkpoint('menu','items-inspected');
    rowActionObservations.push({...parentObservation,nativeCheckpointId:itemInspection.id});
    let cycleFeedbackVariant;
    const edit = async (id, change, phase, negative = false) => {
      await goto(path); const row = rowById("menu_item", id); await row.locator('[data-admin-row-action="edit"] button').click();
      const dialog = page.getByRole("dialog", { name: "تعديل عنصر القائمة", exact: true });
      await observeNavigationOpening({id:"navigation-menu-item-edit",consumer:"menu-builder",surface:"item-edit",collections:["menu-items","menu-editor-shell"],dialog,target:dialog.getByRole("button",{name:"حفظ",exact:true})});
      if(phase==='item-edited'){await expect(dialog.locator('[name="label"]')).toHaveValue(r.menu.c);await expect(dialog.locator('[name="menu_link_link_href"]')).toHaveValue(r.menu.href);rowActionObservations.push({...childObservation,edit:{mode:'dialog',opened:true},nativeCheckpointId:itemInspection.id});}
      await change(dialog);
      await action(() => dialog.getByRole("button", { name: "حفظ", exact: true }).click()); await expect(page).toHaveURL(url => url.searchParams.has("message")); await goto(new URL(page.url()).pathname + new URL(page.url()).search); await expect(dialog).toBeHidden();
      if (negative) { const rejection = page.locator('[data-admin-feedback-entry]').filter({ hasText: "menu_item_cycle_forbidden" }); await expect(rejection).toBeVisible(); cycleFeedbackVariant = await rejection.getAttribute("data-admin-feedback-variant"); }
      await checkpoint("menu", phase);
    };
    await edit(itemIds.c, async dialog => { await dialog.locator('[name="label"]').fill(r.menu.editedC); await dialog.locator('[name="css_class"]').fill(r.menu.css); await select(dialog, "Style Preset", "gold-card"); await externalLink(dialog, r.menu.editedHref);
      downloadMedia.push(await exerciseCoreDownloadField({page,origin,owner:dialog,asset:f.downloadMedia,field:'menu_link',originalHref:r.menu.editedHref,assertCurrent:async(href,kind)=>{
        await expect(dialog.locator('[name="menu_link_link_href"]')).toHaveValue(href);await expect(dialog.locator('[name="menu_link_link_kind"]')).toHaveValue(kind);await expect(dialog.locator('[name="menu_link_link_target"]')).toHaveValue(kind==='none'?'_self':'_blank');
      }}));
    }, "item-edited");
    await goto(path);await rowById('menu_item',itemIds.c).locator('[data-admin-row-action="edit"] button').click();
    const reopened=page.getByRole('dialog',{name:'تعديل عنصر القائمة',exact:true});
    await expect(reopened.locator('[name="menu_link_link_href"]')).toHaveValue(CORE_DOWNLOAD_MEDIA_HREF);
    // Menu's physical schema may project Download as custom/legacy; persisted target must still survive editing.
    await expect(reopened.locator('[name="menu_link_link_target"]')).toHaveValue('_blank');
    await reopened.getByRole('button',{name:'إغلاق',exact:true}).click();await expect(reopened).toBeHidden();
    await edit(itemIds.c, dialog => select(dialog, "Parent", r.menu.b), "reparented");
    await goto(path); await action(() => rowById("menu_item", itemIds.b).getByRole("button", { name: "تحريك لأعلى", exact: true }).click()); await expect(feedback()).toBeVisible(); await checkpoint("menu", "reordered");
    await goto(path); await action(() => more(rowById("menu_item", itemIds.c), 'visibility')); await expect(rowById("menu_item",itemIds.c).getByText("مخفي",{exact:true})).toBeVisible();await assertInverseVisibility(rowById("menu_item",itemIds.c),"إظهار"); await checkpoint("menu", "hidden");
    await edit(itemIds.b, dialog => select(dialog, "Parent", r.menu.editedC), "cycle-rejected", true);
    await goto(path); await more(rowById("menu_item", itemIds.b), "delete"); await expect(confirm()).toBeVisible(); await cancel().click(); await expect(confirm()).toBeHidden(); await checkpoint("menu", "delete-cancelled");
    await more(rowById("menu_item", itemIds.b), "delete"); await action(() => confirm().click()); await expect(rowById("menu_item", itemIds.b)).toHaveCount(0); await expect(rowById("menu_item", itemIds.c)).toHaveCount(0); await checkpoint("menu", "subtree-deleted"); assert.equal(cycleFeedbackVariant, "danger", "A rejected cycle must not be displayed as a successful save."); completed.push("menu-graph");
    return {rowActionObservations:rowActionObservations.filter(row=>row.type!=="footer_manual_link"),renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  if(!graphFooterOnly) await run("core-navigation-menu-visibility-duplicate-delete", [], async () => {
    await goto("/admin/pages-blocks/menus"+(existingOnly?"?q="+encodeURIComponent(r.menu.slug):"")); const acceptedFeedback=await observeCoreVisibleAcceptedFeedback({page,channel:"menu-builder:list",perform:()=>action(() => more(rowById("menu", menuId), 'visibility'))});
    await expect(rowById("menu",menuId).getByText("مخفية",{exact:true})).toBeVisible();await assertInverseVisibility(rowById("menu",menuId),"إظهار"); const acceptedNative=await checkpoint("menu", "menu-hidden");
    await more(rowById("menu", menuId), "duplicate"); await expect(page).toHaveURL(url => /^\/admin\/pages-blocks\/menus\/\d+$/u.test(url.pathname) && !url.pathname.endsWith(`/${menuId}`));
    const duplicateId = Number(new URL(page.url()).pathname.split("/").at(-1)); assert.equal((await checkpoint("menu", "duplicated")).duplicateMenuId, duplicateId);
    await goto("/admin/pages-blocks/menus"+(existingOnly?"?q="+encodeURIComponent(r.menu.slug):"")); await more(rowById("menu", duplicateId), "delete"); await cancel().click(); await expect(confirm()).toBeHidden(); await checkpoint("menu", "duplicate-delete-cancelled");
    await more(rowById("menu", duplicateId), "delete"); await action(() => confirm().click()); await expect(rowById("menu", duplicateId)).toHaveCount(0); await checkpoint("menu", "duplicate-deleted");
    await goto("/admin/pages-blocks/menus"+(existingOnly?"?q="+encodeURIComponent(r.menu.slug):"")); await action(() => more(rowById("menu", menuId), 'visibility')); await expect(rowById("menu",menuId).getByText("ظاهرة",{exact:true})).toBeVisible();await assertInverseVisibility(rowById("menu",menuId),"إخفاء"); await checkpoint("menu", "menu-shown"); completed.push("menu-list");return{acceptedFeedback,acceptedNativeId:acceptedNative.id,menuId};
  });
  assert.ok((graphFooterOnly?completed.includes("menu-graph"):completed.includes("menu-list")) && (menuFooterOnly?existingOnly&&pageId===f.prepared.pageId:completed.includes("page-seo")), "Footer references only a completed owned Menu recipe.");
  await run("core-navigation-footer-aggregate-slots-manual-links-rejection-retry", [], async () => {
    renderedAdoption=[];renderedOpened=new Set();
    await goto("/admin/pages-blocks/footer"); await checkpoint("footer", "baseline");
    const panel = () => page.getByRole("tabpanel");
    const types = ["نص / براند", "روابط", "قائمة", "تواصل"];
    for (let i = 0; i < 4; i++) {
      await tab(`column-${i + 1}`); await switchTo(page, "تفعيل العمود", true);
      // A deliberate UI type transition resets only this synthetic draft through its existing owner.
      await select(page, "نوع البلوك", types[i] === "تواصل" ? "نص / براند" : "تواصل"); await select(page, "نوع البلوك", types[i]);
      await panel().getByPlaceholder("يُترك فارغًا لإخفاء التسمية الذهبية", { exact: true }).fill(r.footer.headings[i]);
      if (i === 0) { await panel().getByPlaceholder("يُترك فارغًا لإخفاء العنوان الرئيسي", { exact: true }).fill(r.footer.title); await panel().getByRole("textbox", { name: "النص / Tagline", exact: true }).fill(r.footer.body); await switchTo(page, "إظهار أيقونة البراند", false); await switchTo(page, "تفعيل العمود", false); await expect(panel().getByRole("textbox", { name: "النص / Tagline", exact: true })).toHaveCount(0); await switchTo(page, "تفعيل العمود", true); await expect(panel().getByRole("textbox", { name: "النص / Tagline", exact: true })).toHaveValue(r.footer.body); }
      if (i === 2) { await select(page, "مصدر القائمة", "قائمة محددة بالمعرّف"); await select(page, "القائمة", `${r.menu.editedName} (custom)`); }
      if (i === 3) { await select(page, "مصدر بيانات التواصل", "مخصص لهذا العمود"); await panel().getByLabel("التسمية", { exact: true }).fill(r.footer.contactLabel); await panel().getByLabel("القيمة", { exact: true }).fill(r.footer.contactValue); }
    }
    await tab("column-2");
    const linkModal = () => page.getByRole("dialog", { name: /^(إضافة رابط|تعديل رابط)$/u });
    for (let i = 0; i < r.footer.links.length; i++) {
      await page.getByRole("button", { name: "+ إضافة رابط", exact: true }).click(); const dialog = linkModal();
      await observeNavigationOpening({id:"navigation-footer-link-create",consumer:"footer-builder",surface:"footer-link-edit",collections:["footer-manual-links","footer-builder-shell","footer-fixed-slots"],dialog,target:dialog.getByRole("button",{name:"اختيار الرابط",exact:true})});
      await dialog.getByLabel("اسم العنصر", { exact: true }).fill(r.footer.links[i]); await externalLink(dialog, r.footer.hrefs[i]); await dialog.getByRole("button", { name: "حفظ", exact: true }).click(); await expect(dialog).toBeHidden();
    }
    await checkpoint("footer", "draft");
    await rowByLabel(r.footer.links[1]).locator('[data-admin-row-action="edit"] button').click(); const dialog = linkModal();
    await observeNavigationOpening({id:"navigation-footer-link-edit",consumer:"footer-builder",surface:"footer-link-edit",collections:["footer-manual-links","footer-builder-shell","footer-fixed-slots"],dialog,target:dialog.getByRole("button",{name:"اختيار الرابط",exact:true})});
    await dialog.getByLabel("اسم العنصر", { exact: true }).fill(r.footer.editedLink); await externalLink(dialog, r.footer.editedHref);
    downloadMedia.push(await exerciseCoreDownloadField({page,origin,owner:dialog,asset:f.downloadMedia,field:'footer_manual_link',originalHref:r.footer.editedHref,assertCurrent:async(href,kind)=>{
      await expect(dialog.getByText(href || 'لم يتم اختيار رابط بعد.',{exact:true})).toBeVisible();
      if(kind==='download')await expect(dialog.getByText('تنزيل',{exact:true})).toBeVisible();
    }}));
    await dialog.getByRole("button", { name: "حفظ", exact: true }).click(); await expect(dialog).toBeHidden();
    await rowByLabel(r.footer.editedLink).getByRole("button", { name: "تحريك لأعلى", exact: true }).click();
    await more(rowByLabel(r.footer.links[2]), "delete"); await cancel().click(); await expect(confirm()).toBeHidden(); await expect(rowByLabel(r.footer.links[2])).toBeVisible(); await checkpoint("footer", "delete-cancelled");
    await more(rowByLabel(r.footer.links[2]), "delete"); await confirm().click(); await expect(rowByLabel(r.footer.links[2])).toHaveCount(0);
    await tab("column-1"); await page.getByRole("button", { name: "تحريك للخلف", exact: true }).click();
    await expect(rowByLabel(r.footer.editedLink)).toBeVisible(); await checkpoint("footer", "draft-final");
    await rowByLabel(r.footer.editedLink).locator('[data-admin-row-action="visibility"] button').click();await expect(rowByLabel(r.footer.editedLink).getByRole('button',{name:'إظهار '+r.footer.editedLink,exact:true})).toBeVisible();await checkpoint('footer','visibility-draft');
    await tab("social-legal");
    const labels = panel().getByLabel("التسمية", { exact: true }); const existing = await labels.count(); assert.ok(existing > 0 && existing < 30);
    for (let i = 0; i < existing; i++) await page.getByRole("button", { name: "حذف", exact: true }).first().click();
    await panel().getByLabel("Copyright", { exact: true }).fill(r.footer.copyright); await panel().getByLabel("Legal Tagline", { exact: true }).fill(r.footer.tagline);
    await action(() => page.getByRole("button", { name: "حفظ الفوتر", exact: true }).click());
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').filter({ hasText: "أضف رابط سوشيال واحدًا على الأقل." })).toBeVisible();
    await expect(panel().getByLabel("Copyright", { exact: true })).toHaveValue(r.footer.copyright); await checkpoint("footer", "rejected");
    await select(page, "المنصة", "Facebook"); await panel().getByLabel("التسمية", { exact: true }).fill(r.footer.socialLabel); await panel().getByLabel("الرابط", { exact: true }).fill(r.footer.socialHref);
    await action(() => page.getByRole("button", { name: "حفظ الفوتر", exact: true }).click()); await expect(feedback()).toContainText("تم حفظ إعدادات الفوتر بنجاح."); await checkpoint("footer", "saved");
    await goto("/admin/pages-blocks/footer"); await tab("column-1"); await expect(rowByLabel(r.footer.editedLink)).toBeVisible(); await expect(rowByLabel(r.footer.links[0])).toBeVisible(); await expect(rowByLabel(r.footer.links[2])).toHaveCount(0);
    await expect(rowByLabel(r.footer.editedLink).getByRole('button',{name:'إظهار '+r.footer.editedLink,exact:true})).toBeVisible();
    await rowByLabel(r.footer.editedLink).locator('[data-admin-row-action="edit"] button').click();
    await expect(linkModal().getByText(CORE_DOWNLOAD_MEDIA_HREF,{exact:true})).toBeVisible();await expect(linkModal().getByText('تنزيل',{exact:true})).toBeVisible();
    await linkModal().getByRole('button',{name:'إلغاء',exact:true}).click();await expect(linkModal()).toBeHidden();
    await tab("column-2"); await expect(panel().getByRole("textbox", { name: "النص / Tagline", exact: true })).toHaveValue(r.footer.body); await tab("social-legal"); await expect(panel().getByLabel("Copyright", { exact: true })).toHaveValue(r.footer.copyright); const hiddenReload=await checkpoint("footer", "reloaded");await tab('column-1');
    const footerObservation=await inspectRow({type:'footer_manual_link',id:'0:'+r.footer.editedLink,label:r.footer.editedLink,information:{'الرابط':CORE_DOWNLOAD_MEDIA_HREF,'الهدف':'نفس النافذة','الحالة':'مخفي'},preview:{access:'allowed',href:CORE_DOWNLOAD_MEDIA_HREF}});
    rowActionObservations.push({...footerObservation,edit:{mode:'dialog-reloaded',opened:true},nativeCheckpointId:hiddenReload.id});
    await tab('column-1');await rowByLabel(r.footer.editedLink).locator('[data-admin-row-action="visibility"] button').click();await expect(rowByLabel(r.footer.editedLink).getByRole('button',{name:'إخفاء '+r.footer.editedLink,exact:true})).toBeVisible();await checkpoint('footer','visibility-shown-draft');
    await action(()=>page.getByRole('button',{name:'حفظ الفوتر',exact:true}).click());await expect(feedback()).toContainText('تم حفظ إعدادات الفوتر بنجاح.');await checkpoint('footer','shown-saved');
    await goto('/admin/pages-blocks/footer');await tab('column-1');await expect(rowByLabel(r.footer.editedLink).getByRole('button',{name:'إخفاء '+r.footer.editedLink,exact:true})).toBeVisible();await checkpoint('footer','shown-reloaded');completed.push("footer-aggregate");
    return {rowActionObservations:rowActionObservations.filter(row=>row.type==='footer_manual_link'),manualVisibility:{hiddenSavedReloaded:true,shownSavedReloaded:true,extraAcceptedSaves:1,nativePhases:['visibility-draft','saved','reloaded','visibility-shown-draft','shown-saved','shown-reloaded']},renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  await run('core-navigation-footer-default-restore-confirm-reject-retry', [], async () => {
    assert.ok(completed.includes('footer-aggregate')); assert.deepEqual(f.footerRestore,{key:'footer.slots'});
    await goto('/admin/pages-blocks/footer');
    const dialog=()=>page.getByRole('dialog',{name:'استعادة الفوتر الافتراضي',exact:true});
    const open=()=>page.getByRole('button',{name:'استعادة الافتراضي',exact:true}).click();
    const posts=[],listener=request=>{if(request.method()==='POST'&&request.headers()['next-action']&&new URL(request.url()).origin===origin)posts.push(request);};
    page.on('request',listener);
    try {
      await open(); await expect(dialog()).toBeVisible(); await dialog().locator('[data-admin-confirm-cancel]').click();
      await expect(dialog()).toHaveCount(0); assert.equal(posts.length,0); await checkpoint('footer','restore-cancelled');
      const pending=async cancelled=>{
        const token=randomUUID(),fault=async operation=>{const request={id:randomUUID(),kind:'domain-write-fault-'+operation,entity:'footer_restore',token};const result=await nativeCheckpoint(request);for(const key of Object.keys(request))assert.equal(result[key],request[key]);assert.equal(result.status,'pass');return result;};
        let armed=false,responsePromise;const start=posts.length;
        try {
          await fault('arm'); armed=true;
          responsePromise=page.waitForResponse(response=>response.request().method()==='POST'&&response.request().headers()['next-action']&&new URL(response.url()).origin===origin);void responsePromise.catch(()=>{});
          await dialog().locator('[data-admin-confirm-submit]').click();
          const first=await fault('observe-blocked');assert.equal(first.observedOneStatement,true);
          await expect(dialog().locator('[data-admin-confirm-submit]')).toBeDisabled();await expect(dialog().locator('[data-admin-confirm-cancel]')).toBeDisabled();
          await page.keyboard.press('Escape');await expect(dialog()).toBeVisible();await page.keyboard.press('Enter');await page.keyboard.press('Enter');
          const second=await fault('observe-blocked');for(const key of ['backendPid','backendStartedAt','queryStartedAt','queryFingerprint','holderPid'])assert.equal(second[key],first[key]);assert.equal(posts.length,start+1);
          if(cancelled)assert.equal((await fault('cancel')).cancelledOneStatement,true);
          const released=await fault('release');armed=false;assert.equal(released.ownedLockRolledBack,true);assert.equal(released.cancellationObserved,cancelled);
          const response=await responsePromise;if(cancelled)assert.equal(response.status(),500);else assert.ok(response.status()<400);return{token,actionRequests:posts.length-start,sameNativeStatementObservedTwice:true,actualStatementCancelled:cancelled,ownedLockReleased:true};
        } finally { try{if(armed)await fault('release');}finally{if(responsePromise)await Promise.allSettled([responsePromise]);} }
      };
      await open();const rejection=await pending(true);
      await expect(dialog()).toBeVisible();await expect(dialog().locator('[data-admin-confirm-submit]')).toBeEnabled();
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();await checkpoint('footer','restore-rejected');
      const retry=await pending(false);await expect(dialog()).toHaveCount(0);await expect(feedback()).toContainText('تمت استعادة تخطيط الفوتر الافتراضي بنجاح.');await checkpoint('footer','restored');
      await goto('/admin/pages-blocks/footer');await checkpoint('footer','restore-reloaded');assert.equal(posts.length,2);
      completed.push('footer-default-restore');return{confirmationCancelled:true,cancelledActionRequests:0,rejection,retry,actionRequests:2,explicitRetry:true,nativePhases:['restore-cancelled','restore-rejected','restored','restore-reloaded'],otherThreeRowsAndTimestampsUnchanged:true,automaticCoverage:[],globalClosed:false};
    } finally {page.off('request',listener);}
  });
  assert.deepEqual(completed,graphFooterOnly?['menu-graph','footer-aggregate','footer-default-restore']:menuFooterOnly?['menu-graph','menu-list','footer-aggregate','footer-default-restore']:existingOnly?['page-seo','menu-graph','menu-list','footer-aggregate','footer-default-restore']:['page-create','page-seo','menu-create','menu-graph','menu-list','footer-aggregate','footer-default-restore']);
  return { status: "pass", completed, plan, checkpoints, permissionEvidence, downloadMedia, permissionCandidateKeys:permissionEvidence.map(row=>row.candidateRequiredCase), requiresOwnedCleanupBeforePromotion: true, globalClosed: false };
}

export const CORE_NAVIGATION_FOLLOWUP_SELECTION = "navigation-settings-followup";
export const CORE_NAVIGATION_FOLLOWUP_IDS = [
  "core-navigation-page-create-rejection-retry-reload",
  "core-navigation-page-seo-validation-save-reload",
  "core-navigation-menu-create-rejection-retry-reload",
  "core-navigation-menu-metadata-item-graph-commands",
  "core-navigation-menu-visibility-duplicate-delete",
  "core-navigation-footer-aggregate-slots-manual-links-rejection-retry",
  "core-navigation-footer-default-restore-confirm-reject-retry"
];
export const CORE_NAVIGATION_EXISTING_SELECTION='navigation-settings-existing-followup';
export const CORE_NAVIGATION_MENU_FOOTER_SELECTION='navigation-settings-menu-footer-followup';
export const CORE_NAVIGATION_GRAPH_FOOTER_SELECTION='navigation-settings-graph-footer-followup';
export function isCoreNavigationExistingSelection(selection){return [CORE_NAVIGATION_EXISTING_SELECTION,CORE_NAVIGATION_MENU_FOOTER_SELECTION,CORE_NAVIGATION_GRAPH_FOOTER_SELECTION].includes(selection);}
export function isCoreNavigationFollowupSelection(selection){return selection===CORE_NAVIGATION_FOLLOWUP_SELECTION||isCoreNavigationExistingSelection(selection);}
export function coreNavigationSelectedIds(selection){assert.ok(isCoreNavigationFollowupSelection(selection));const excluded=['core-navigation-page-create-rejection-retry-reload','core-navigation-menu-create-rejection-retry-reload',...([CORE_NAVIGATION_MENU_FOOTER_SELECTION,CORE_NAVIGATION_GRAPH_FOOTER_SELECTION].includes(selection)?['core-navigation-page-seo-validation-save-reload']:[]),...(selection===CORE_NAVIGATION_GRAPH_FOOTER_SELECTION?['core-navigation-menu-visibility-duplicate-delete']:[])];return isCoreNavigationExistingSelection(selection)?CORE_NAVIGATION_FOLLOWUP_IDS.filter(id=>!excluded.includes(id)):[...CORE_NAVIGATION_FOLLOWUP_IDS];}
export function assertCoreNavigationFollowupReceipt(browser, requiredCases) {
  const selected=coreNavigationSelectedIds(browser.journeySelection);
  assert.equal(browser.scope, "core-closure"); assert.equal(browser.cohort, "navigation-settings");
  assert.ok(isCoreNavigationFollowupSelection(browser.journeySelection));
  assert.equal(browser.status, "pass"); assert.equal(browser.driverCompleted, true);
  assert.equal(browser.inventoryOnly, false); assert.equal(browser.wholeCohortExecuted, false);
  assert.deepEqual(browser.errors, []); assert.equal(browser.globalClosed, false);
  assert.deepEqual(browser.requiredCases, requiredCases);
  assert.deepEqual(browser.selectedJourneyIds, selected);
  assert.deepEqual(browser.executedJourneyIds, selected);
  const evidence = browser.evidence.filter(row => row.id !== "existing-auth-login");
  assert.deepEqual(evidence.map(row => row.id), selected);
  assert.ok(evidence.every(row => row.status === "pass"));
  return { status: "pass", selection: browser.journeySelection, automaticCoverage: [], selectedJourneyIds: [...selected], executedJourneyIds: [...selected], retainedDescendantsReplayed: false, wholeCohortExecuted: false, globalClosed: false };
}
