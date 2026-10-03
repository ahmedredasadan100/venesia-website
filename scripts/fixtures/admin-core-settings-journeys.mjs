import { exerciseCoreImageField, CORE_DIRECT_IMAGE_VALUES } from "./admin-core-direct-image-adoption.mjs";
import assert from "node:assert/strict";
import { runCoreFormPermissionIntent } from "./admin-core-domain-form-journeys.mjs";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

export async function runCoreSettingsAndMenuJourneys(ctx) {
  const { page, origin, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const jiti = createJiti(import.meta.url, { fsCache:false, moduleCache:false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const coverage = (id,surface) => {
    const entry=manifest.find(row=>row.id===id); assert.ok(entry?.surfaces.includes(surface));
    return ["save_reload","failure_preserves_input","retry"].map(scenario=>{
      const rows=requiredCases.filter(row=>row.consumer===id&&row.surface===surface&&row.scenario===scenario);assert.equal(rows.length,1);return rows[0].key;
    });
  };
  for(const id of ["global-seo-settings","media-library-settings"])assert.ok(manifest.some(row=>row.id===id));
  const suffix=Date.now().toString(36), permissionEvidence=[];
  const permissionIntent=(formConsumer,surface,caseId,perform)=>runCoreFormPermissionIntent({permissionReplay:ctx.permissionReplay,mapping:{formConsumer,surface,caseId},perform,permissionEvidence});
  const cancelDirty=async trigger=>{const original=page.url();await expect(trigger).toHaveCount(1);await expect(trigger).toBeVisible();await trigger.click();const dialog=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});await expect(dialog).toBeVisible();await dialog.locator("[data-admin-confirm-cancel]").click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(page.url(),original);};
  const discard=async(trigger,refill,declaredClosePath=null)=>{const original=page.url(),href=declaredClosePath??await trigger.getAttribute('href');const destination=href?new URL(href,origin):new URL(original);assert.equal(destination.origin,origin);return{trigger,destination:{kind:href?'navigated':'closed',pathname:destination.pathname},reopenAndRefill:async()=>{if(href)await page.goto(original,{waitUntil:'domcontentloaded'});else await page.getByRole('button',{name:'إضافة منيو',exact:true}).click();await refill();}};};
  const permissionFor=consumer=>permissionEvidence.filter(row=>row.formConsumer===consumer);
  const nativeSetting=descriptor=>Object.fromEntries(Object.entries(descriptor).filter(([key])=>key!=="auditSince"));
  const form=entity=>page.locator('form[data-admin-form-entity="'+entity+'"]');
  const field=(scope,name)=>scope.locator('[name="'+name+'"]:not([type="hidden"])');
  const submit=scope=>scope.locator('button[type="submit"]');
  const acknowledge=async scope=>{const [response]=await Promise.all([actionResponse(),submit(scope).click()]);assertActionAcknowledged(response);};
  const saved=async scope=>{const entity=await scope.getAttribute("data-admin-form-entity");assert.ok(entity);await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="form:'+entity+'"][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-channel="form:'+entity+'"][data-admin-feedback-variant="warning"]').first()).toBeVisible({timeout:60000});await expect(submit(scope)).toBeEnabled();};
  const settingRead=(key,projections,since)=>{const descriptor={table:"site_settings",id:key,expected:{},expectedJson:projections.map(([path,value])=>({column:"value",path,value})),auditEntityType:"site_settings",auditEntityLabel:key,auditActions:["site_settings.update"],auditSince:since};databaseReadback.push(descriptor);return descriptor;};

  await run("core-company-settings-rejection-preservation-save-reload",coverage("company-identity-settings","singleton-settings"),async()=>{
    const since=new Date().toISOString(),name="QA Core Company "+suffix;
    await observe("company-open",()=>page.goto(origin+"/admin/settings/general",{waitUntil:"domcontentloaded"}));
    const current=form("admin-company-identity");await expect(current).toBeVisible();
    const originalLabel=await field(current,"adminLabel").inputValue();
    await field(current,"name").fill("   ");await expect(field(current,"name")).toHaveValue("   ");await acknowledge(current);
    await expect(field(current,"name")).toHaveAttribute("aria-invalid","true");await expect(current.locator("#name-error")).toBeVisible();
    await expect(field(current,"name")).toHaveValue("   ");await expect(field(current,"adminLabel")).toHaveValue(originalLabel);
    await field(current,"name").fill(name);
    const imageAdoption=[];
    for(const imageName of ["logoUrl","compactLogoUrl"])imageAdoption.push(await exerciseCoreImageField({page,origin,form:current,name:imageName,finalEmpty:imageName==="compactLogoUrl",preserveNames:["name","adminLabel"]}));
    const assertImages=async()=>{for(const imageName of ["logoUrl","compactLogoUrl"])await expect(current.locator('[name="'+imageName+'"]')).toHaveValue(CORE_DIRECT_IMAGE_VALUES[imageName]);};
    await assertImages();
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-company-settings-accepted-save",journeyId:"core-company-settings-rejection-preservation-save-reload",formConsumer:"company-identity-settings",surface:"singleton-settings"},form:current,submit:submit(current),dirtyNavigation:"close",assertDraft:async()=>{await expect(field(current,"name")).toHaveValue(name);await expect(field(current,"adminLabel")).toHaveValue(originalLabel);await assertImages();},cancelDirty:async()=>{await cancelDirty(current.locator('[data-admin-form-action="close"]'));},discardDirty:await discard(current.locator('[data-admin-form-action="close"]'),async()=>{await field(current,'name').fill(name);await field(current,'adminLabel').fill(originalLabel);for(const imageName of ['logoUrl','compactLogoUrl'])await exerciseCoreImageField({page,origin,form:current,name:imageName,finalEmpty:imageName==='compactLogoUrl',preserveNames:['name','adminLabel']});},'/admin')});
    await permissionIntent("company-identity-settings","singleton-settings","core-company-settings-accepted-save",async()=>{
      await acknowledge(current);await saved(current);
      await observe("company-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(field(current,"name")).toHaveValue(name);await expect(field(current,"adminLabel")).toHaveValue(originalLabel);
      await assertImages();return {nativeWrites:[nativeSetting(settingRead("admin.company",[[["name"],name],[["logoUrl"],CORE_DIRECT_IMAGE_VALUES.logoUrl],[["compactLogoUrl"],CORE_DIRECT_IMAGE_VALUES.compactLogoUrl]],since))]};
    });
    return {consumer:"company-identity-settings",imageAdoption,permissionEvidence:permissionFor("company-identity-settings"),serverValidation:true,unrelatedFieldPreserved:true,retrySaved:true,reloaded:true,nativeReadbackRequired:true};
  });
  await run("core-global-seo-settings-rejection-save-reload",[],async()=>{
    const since=new Date().toISOString(),title="QA Core Global SEO "+suffix;
    await observe("global-seo-open",()=>page.goto(origin+"/admin/seo/meta-manager",{waitUntil:"domcontentloaded"}));
    const current=form("global-seo-settings");await expect(current).toBeVisible();
    await field(current,"default_title").fill(title);
    await current.locator('[data-admin-tab-id="crawl"]').click();const canonical=field(current,"canonical_base_url"),old=await canonical.inputValue();
    await canonical.fill("not-a-url");await acknowledge(current);await expect(current.locator("#canonicalBaseUrl-error")).toBeVisible();
    await expect(canonical).toHaveValue("not-a-url");await expect(field(current,"default_title")).toHaveValue(title);
    const acceptedCanonical=old.trim()||"https://example.invalid/qa-core-permission";
    await canonical.fill(acceptedCanonical);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-global-seo-accepted-save",journeyId:"core-global-seo-settings-rejection-save-reload",formConsumer:"global-seo-settings",surface:"global-meta"},form:current,submit:submit(current),dirtyNavigation:"close",assertDraft:async()=>{await expect(field(current,"default_title")).toHaveValue(title);await expect(canonical).toHaveValue(acceptedCanonical);},cancelDirty:async()=>{await cancelDirty(current.locator('[data-admin-form-action="close"]'));},discardDirty:await discard(current.locator('[data-admin-form-action="close"]'),async()=>{await field(current,'default_title').fill(title);await current.locator('[data-admin-tab-id="crawl"]').click();await canonical.fill(acceptedCanonical);},'/admin')});
    await permissionIntent("global-seo-settings","global-meta","core-global-seo-accepted-save",async()=>{
      await acknowledge(current);await saved(current);
      await observe("global-seo-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(field(current,"default_title")).toHaveValue(title);
      await current.locator('[data-admin-tab-id="crawl"]').click();await expect(field(current,"canonical_base_url")).toHaveValue(acceptedCanonical);
      return {nativeWrites:[nativeSetting(settingRead("seo.global",[[["defaultTitle"],title],[["canonicalBaseUrl"],acceptedCanonical]],since))]};
    });
    return {consumer:"global-seo-settings",permissionEvidence:permissionFor("global-seo-settings"),serverUrlValidation:true,preservedTitle:true,retrySaved:true,reloaded:true,nativeReadbackRequired:true};
  });
  await run("core-media-settings-range-rejection-save-reload",[],async()=>{
    const since=new Date().toISOString();
    await observe("media-settings-open",()=>page.goto(origin+"/admin/settings/media",{waitUntil:"domcontentloaded"}));
    const current=form("media-settings");await expect(current).toBeVisible();const limit=field(current,"maxImageMb");
    const old=Number(await limit.inputValue()),value=old===1?2:1;assert.ok(value<=Number(await limit.getAttribute("max")));
    const document=await field(current,"maxDocumentMb").inputValue();await limit.fill("0");await acknowledge(current);
    await expect(limit).toHaveAttribute("aria-invalid","true");await expect(current.locator("#maxImageMb-error")).toBeVisible();
    await expect(limit).toHaveValue("0");await expect(field(current,"maxDocumentMb")).toHaveValue(document);
    await limit.fill(String(value));
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-media-policy-accepted-save",journeyId:"core-media-settings-range-rejection-save-reload",formConsumer:"media-library-settings",surface:"media-policy-settings"},form:current,submit:submit(current),dirtyNavigation:"navigation",assertDraft:async()=>{await expect(limit).toHaveValue(String(value));await expect(field(current,"maxDocumentMb")).toHaveValue(document);},cancelDirty:async()=>{await expect(current.locator('[data-admin-form-action="close"]')).toHaveCount(0);await cancelDirty(page.getByRole('navigation',{name:'الإدارة',exact:true}).locator('a[href="/admin"]'));},discardDirty:await discard(page.getByRole('navigation',{name:'الإدارة',exact:true}).locator('a[href="/admin"]'),async()=>{await limit.fill(String(value));await field(current,'maxDocumentMb').fill(document);})});
    await permissionIntent("media-library-settings","media-policy-settings","core-media-policy-accepted-save",async()=>{
      await acknowledge(current);await saved(current);await observe("media-settings-reload",()=>page.reload({waitUntil:"domcontentloaded"}));
      await expect(limit).toHaveValue(String(value));await expect(field(current,"maxDocumentMb")).toHaveValue(document);
      return {nativeWrites:[nativeSetting(settingRead("media.settings",[[["maxImageBytes"],value*1024*1024],[["maxDocumentBytes"],Number(document)*1024*1024]],since))]};
    });
    return {consumer:"media-library-settings",permissionEvidence:permissionFor("media-library-settings"),serverRangeValidation:true,unrelatedPolicyPreserved:true,retrySaved:true,reloaded:true,reconciliationInvoked:false,nativeReadbackRequired:true};
  });
  await run("core-menu-quick-create-rejection-preservation-retry",coverage("menu-quick-create","menu-create"),async()=>{
    const since=new Date().toISOString(),name="QA Core Menu "+suffix,slug="qa-authored-menu-"+suffix;
    await observe("menu-create-open",()=>page.goto(origin+"/admin/pages-blocks/menus",{waitUntil:"domcontentloaded"}));
    await page.getByRole("button",{name:"إضافة منيو",exact:true}).click();const current=page.locator("#create-menu-form");await expect(current).toBeVisible();
    await field(current,"name").fill(name);await expect(field(current,"slug")).toHaveValue("qa-core-menu-"+suffix);assert.notEqual(slug,"qa-core-menu-"+suffix);await field(current,"slug").fill(slug);await expect(field(current,"slug")).toHaveValue(slug);
    await current.getByRole("button",{name:"إلغاء",exact:true}).click();const confirm=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});
    await expect(confirm).toBeVisible();await confirm.locator("[data-admin-confirm-cancel]").click();await expect(current.getByRole("button",{name:"إلغاء",exact:true})).toBeFocused();await expect(field(current,"name")).toHaveValue(name);await expect(field(current,"slug")).toHaveValue(slug);
    await field(current,"name").fill("   ");await acknowledge(current);await expect(field(current,"name")).toHaveAttribute("aria-invalid","true");await expect(current.locator("#name-error")).toHaveText("اكتب اسم القائمة.");await expect(field(current,"slug")).toHaveValue(slug);
    await field(current,"name").fill(name);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-menu-quick-create-accepted-save",journeyId:"core-menu-quick-create-rejection-preservation-retry",formConsumer:"menu-quick-create",surface:"menu-create"},form:current,submit:submit(current),dirtyNavigation:"close",assertDraft:async()=>{await expect(field(current,"name")).toHaveValue(name);await expect(field(current,"slug")).toHaveValue(slug);},cancelDirty:async()=>{await cancelDirty(current.getByRole('button',{name:'إلغاء',exact:true}));},discardDirty:await discard(current.getByRole('button',{name:'إلغاء',exact:true}),async()=>{await field(current,'name').fill(name);await field(current,'slug').fill(slug);})});
    const id=await permissionIntent("menu-quick-create","menu-create","core-menu-quick-create-accepted-save",async()=>{
await acknowledge(current);await expect(page).toHaveURL(url=>/^\/admin\/pages-blocks\/menus\/[0-9]+$/.test(url.pathname),{timeout:60000});
    const id=Number(new URL(page.url()).pathname.split("/").at(-1));assert.ok(Number.isSafeInteger(id)&&id>0);
    await observe("menu-created-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(page.locator('[name="name"]').first()).toHaveValue(name);await expect(page.locator('[name="slug"]').first()).toHaveValue(slug);
    const descriptor={table:"menus",id,expected:{name,slug},auditEntityType:"menu",auditEntityLabel:name,auditActions:["menu.create"],auditSince:since};databaseReadback.push(descriptor);
    return {value:id,nativeWrites:[nativeSetting(descriptor)]};
    });
    return {consumer:"menu-quick-create",permissionEvidence:permissionFor("menu-quick-create"),id,dirtyCloseCancelled:true,serverValidation:true,preservedInput:true,retrySaved:true,reloaded:true,nativeReadbackRequired:true};
  });
  return {permissionEvidence,permissionCandidateKeys:permissionEvidence.map(row=>row.candidateRequiredCase),automaticCoverage:[]};
}
