import assert from "node:assert/strict";
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
  const suffix=Date.now().toString(36);
  const form=entity=>page.locator('form[data-admin-form-entity="'+entity+'"]');
  const field=(scope,name)=>scope.locator('[name="'+name+'"]:not([type="hidden"])');
  const submit=scope=>scope.locator('button[type="submit"]');
  const acknowledge=async scope=>{const [response]=await Promise.all([actionResponse(),submit(scope).click()]);assertActionAcknowledged(response);};
  const saved=async scope=>{const entity=await scope.getAttribute("data-admin-form-entity");assert.ok(entity);await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="form:'+entity+'"][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-channel="form:'+entity+'"][data-admin-feedback-variant="warning"]').first()).toBeVisible({timeout:60000});await expect(submit(scope)).toBeEnabled();};
  const settingRead=(key,path,value,since)=>databaseReadback.push({table:"site_settings",id:key,expected:{},expectedJson:[{column:"value",path,value}],auditEntityType:"site_settings",auditEntityLabel:key,auditActions:["site_settings.update"],auditSince:since});

  await run("core-company-settings-rejection-preservation-save-reload",coverage("company-identity-settings","singleton-settings"),async()=>{
    const since=new Date().toISOString(),name="QA Core Company "+suffix;
    await observe("company-open",()=>page.goto(origin+"/admin/settings/general",{waitUntil:"domcontentloaded"}));
    const current=form("admin-company-identity");await expect(current).toBeVisible();
    const originalLabel=await field(current,"adminLabel").inputValue();
    await field(current,"name").fill("   ");await expect(field(current,"name")).toHaveValue("   ");await acknowledge(current);
    await expect(field(current,"name")).toHaveAttribute("aria-invalid","true");await expect(current.locator("#name-error")).toBeVisible();
    await expect(field(current,"name")).toHaveValue("   ");await expect(field(current,"adminLabel")).toHaveValue(originalLabel);
    await field(current,"name").fill(name);await acknowledge(current);await saved(current);
    await observe("company-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(field(current,"name")).toHaveValue(name);await expect(field(current,"adminLabel")).toHaveValue(originalLabel);
    settingRead("admin.company",["name"],name,since);
    return {consumer:"company-identity-settings",serverValidation:true,unrelatedFieldPreserved:true,retrySaved:true,reloaded:true,nativeReadbackRequired:true};
  });
  await run("core-global-seo-settings-rejection-save-reload",[],async()=>{
    const since=new Date().toISOString(),title="QA Core Global SEO "+suffix;
    await observe("global-seo-open",()=>page.goto(origin+"/admin/seo/meta-manager",{waitUntil:"domcontentloaded"}));
    const current=form("global-seo-settings");await expect(current).toBeVisible();
    await field(current,"default_title").fill(title);
    await current.locator('[data-admin-tab-id="crawl"]').click();const canonical=field(current,"canonical_base_url"),old=await canonical.inputValue();
    await canonical.fill("not-a-url");await acknowledge(current);await expect(current.locator("#canonicalBaseUrl-error")).toBeVisible();
    await expect(canonical).toHaveValue("not-a-url");await expect(field(current,"default_title")).toHaveValue(title);
    await canonical.fill(old);await acknowledge(current);await saved(current);
    await observe("global-seo-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(field(current,"default_title")).toHaveValue(title);
    settingRead("seo.global",["defaultTitle"],title,since);
    return {consumer:"global-seo-settings",serverUrlValidation:true,preservedTitle:true,retrySaved:true,reloaded:true,nativeReadbackRequired:true};
  });
  await run("core-media-settings-range-rejection-save-reload",[],async()=>{
    const since=new Date().toISOString();
    await observe("media-settings-open",()=>page.goto(origin+"/admin/settings/media",{waitUntil:"domcontentloaded"}));
    const current=form("media-settings");await expect(current).toBeVisible();const limit=field(current,"maxImageMb");
    const old=Number(await limit.inputValue()),value=old===1?2:1;assert.ok(value<=Number(await limit.getAttribute("max")));
    const document=await field(current,"maxDocumentMb").inputValue();await limit.fill("0");await acknowledge(current);
    await expect(limit).toHaveAttribute("aria-invalid","true");await expect(current.locator("#maxImageMb-error")).toBeVisible();
    await expect(limit).toHaveValue("0");await expect(field(current,"maxDocumentMb")).toHaveValue(document);
    await limit.fill(String(value));await acknowledge(current);await saved(current);await observe("media-settings-reload",()=>page.reload({waitUntil:"domcontentloaded"}));
    await expect(limit).toHaveValue(String(value));await expect(field(current,"maxDocumentMb")).toHaveValue(document);
    settingRead("media.settings",["maxImageBytes"],value*1024*1024,since);
    return {consumer:"media-library-settings",serverRangeValidation:true,unrelatedPolicyPreserved:true,retrySaved:true,reloaded:true,reconciliationInvoked:false,nativeReadbackRequired:true};
  });
  await run("core-menu-quick-create-rejection-preservation-retry",coverage("menu-quick-create","menu-create"),async()=>{
    const since=new Date().toISOString(),name="QA Core Menu "+suffix,slug="qa-authored-menu-"+suffix;
    await observe("menu-create-open",()=>page.goto(origin+"/admin/pages-blocks/menus",{waitUntil:"domcontentloaded"}));
    await page.getByRole("button",{name:"إضافة منيو",exact:true}).click();const current=page.locator("#create-menu-form");await expect(current).toBeVisible();
    await field(current,"name").fill(name);await expect(field(current,"slug")).toHaveValue("qa-core-menu-"+suffix);assert.notEqual(slug,"qa-core-menu-"+suffix);await field(current,"slug").fill(slug);await expect(field(current,"slug")).toHaveValue(slug);
    await current.getByRole("button",{name:"إلغاء",exact:true}).click();const confirm=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});
    await expect(confirm).toBeVisible();await confirm.locator("[data-admin-confirm-cancel]").click();await expect(current.getByRole("button",{name:"إلغاء",exact:true})).toBeFocused();await expect(field(current,"name")).toHaveValue(name);await expect(field(current,"slug")).toHaveValue(slug);
    await field(current,"name").fill("   ");await acknowledge(current);await expect(field(current,"name")).toHaveAttribute("aria-invalid","true");await expect(current.locator("#name-error")).toHaveText("اكتب اسم القائمة.");await expect(field(current,"slug")).toHaveValue(slug);
    await field(current,"name").fill(name);await acknowledge(current);await expect(page).toHaveURL(url=>/^\/admin\/pages-blocks\/menus\/[0-9]+$/.test(url.pathname),{timeout:60000});
    const id=Number(new URL(page.url()).pathname.split("/").at(-1));assert.ok(Number.isSafeInteger(id)&&id>0);
    await observe("menu-created-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(page.locator('[name="name"]').first()).toHaveValue(name);await expect(page.locator('[name="slug"]').first()).toHaveValue(slug);
    databaseReadback.push({table:"menus",id,expected:{name,slug},auditEntityType:"menu",auditEntityLabel:name,auditActions:["menu.create"],auditSince:since});
    return {consumer:"menu-quick-create",id,dirtyCloseCancelled:true,serverValidation:true,preservedInput:true,retrySaved:true,reloaded:true,nativeReadbackRequired:true};
  });
}
