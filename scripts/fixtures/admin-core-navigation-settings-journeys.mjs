import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption,observeCoreModalCleanReturn,observeCoreModalPendingDismissal} from "./admin-core-rendered-adoption.mjs";
import {exerciseCoreDownloadField,CORE_DOWNLOAD_MEDIA_HREF} from './admin-core-download-media-adoption.mjs';
import { runCoreDescendantPresentationJourneys } from './admin-core-descendant-presentation-journeys.mjs';
import assert from "node:assert/strict";
import { runCoreFormPermissionIntent } from "./admin-core-domain-form-journeys.mjs";
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
  let pageId, menuId, itemIds;
  await runCoreDescendantPresentationJourneys(ctx,"navigation");
  await run("core-navigation-page-create-rejection-retry-reload", plan.pageCoverage, async () => {
    renderedAdoption=[];renderedOpened=new Set();
    await goto("/admin/pages-blocks/pages"); await checkpoint("page", "baseline");
    await page.getByRole("button", { name: "إضافة صفحة", exact: true }).click(); const form = page.locator("#create-page-form");
    await observeNavigationOpening({id:"navigation-page-create",consumer:"pages-quick-create",surface:"create",collections:["pages"],dialog:page.getByRole("dialog",{name:"إضافة صفحة جديدة",exact:true}),form,trigger:page.getByRole("button",{name:"إضافة صفحة",exact:true}),target:form.getByRole("button",{name:"إنشاء وفتح المحرر",exact:true})});
    await form.locator('[name="path"]').fill(f.duplicatePagePath);
    await form.getByRole("button", { name: "إنشاء وفتح المحرر", exact: true }).click();
    assert.equal(await form.locator('[name="title"]').evaluate(input => input.validity.valueMissing), true);
    await form.locator('[name="title"]').fill(r.page.title);
    await action(() => form.getByRole("button", { name: "إنشاء وفتح المحرر", exact: true }).click());
    await expect(form.locator('[name="path"]')).toHaveAttribute("aria-invalid", "true");
    await expect(form.locator('[name="title"]')).toHaveValue(r.page.title); await expect(form.locator('[name="path"]')).toHaveValue(f.duplicatePagePath);
    await checkpoint("page", "rejected");
    await form.locator('[name="path"]').fill(r.page.path);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-navigation-page-create-accepted-save",journeyId:"core-navigation-page-create-rejection-retry-reload",formConsumer:"pages-quick-create",surface:"create"},form,submit:form.getByRole("button",{name:"إنشاء وفتح المحرر",exact:true}),dirtyNavigation:"close",observePending:()=>observePageCreatePending(form),
      assertDraft:async()=>{await expect(form.locator('[name="title"]')).toHaveValue(r.page.title);await expect(form.locator('[name="path"]')).toHaveValue(r.page.path);},
      cancelDirty:async()=>{const original=page.url(),trigger=form.getByRole("button",{name:"إلغاء",exact:true});await trigger.click();const dialog=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});await expect(dialog).toBeVisible();renderedAdoption.push(await observeCoreModalFocusAdoption({...renderedBase("pages-quick-create","create",["pages"],"modal"),id:"navigation-page-create-dirty-focus",dialog,state:"dirty-confirmation",escape:"not-exercised"}));await dialog.locator("[data-admin-confirm-cancel]").click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(page.url(),original);await expect(form).toBeVisible();},
    });
    await runCoreFormPermissionIntent({permissionReplay:ctx.permissionReplay,mapping:{caseId:"core-navigation-page-create-accepted-save",formConsumer:"pages-quick-create",surface:"create"},permissionEvidence,perform:async()=>{
    await action(() => form.getByRole("button", { name: "إنشاء وفتح المحرر", exact: true }).click());
    await expect(page).toHaveURL(url => /^\/admin\/pages-blocks\/pages\/\d+$/u.test(url.pathname));
    pageId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await goto(`/admin/pages-blocks/pages/${pageId}`); await expect(page.getByRole("heading", { name: `إدارة صفحة ${r.page.title}`, exact: true })).toBeVisible();
    assert.equal((await checkpoint("page", "created")).pageId, pageId);
      return {nativeWrites:[{table:"pages",id:pageId,expected:{title:r.page.title,path:r.page.path,slug:r.page.slug,status:"unpublished",page_type:"static"},auditEntityType:"page",auditEntityLabel:r.page.title,auditActions:["page.create"]}]};
    }});
    completed.push("page-create");
    return {consumer:"pages-quick-create",surface:"create",permissionEvidence:[...permissionEvidence],renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  assert.ok(pageId, "Page creation must finish before dependent metadata work.");
  await run("core-navigation-page-seo-validation-save-reload", [], async () => {
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
  await run("core-navigation-menu-create-rejection-retry-reload", plan.menuCoverage, async () => {
    renderedAdoption=[];renderedOpened=new Set();
    await goto("/admin/pages-blocks/menus"); await checkpoint("menu", "baseline");
    await page.getByRole("button", { name: "إضافة منيو", exact: true }).click(); const form = page.locator("#create-menu-form");
    await observeNavigationOpening({id:"navigation-menu-create",consumer:"menu-quick-create",surface:"menu-create",collections:["menus-list"],dialog:page.getByRole("dialog",{name:"إضافة قائمة جديدة",exact:true}),form,trigger:page.getByRole("button",{name:"إضافة منيو",exact:true}),target:form.getByRole("button",{name:"إنشاء وفتح القائمة",exact:true})});
    await form.locator('[name="name"]').fill(r.menu.name); await form.locator('[name="slug"]').fill(f.duplicateMenuSlug); await select(form, "مكان الاستخدام", "Custom");
    await action(() => form.getByRole("button", { name: "إنشاء وفتح القائمة", exact: true }).click());
    await expect(form.locator('[name="slug"]')).toHaveAttribute("aria-invalid", "true"); await expect(form.locator('[name="name"]')).toHaveValue(r.menu.name); await expect(form.locator('[name="slug"]')).toHaveValue(f.duplicateMenuSlug);
    await checkpoint("menu", "rejected"); await form.locator('[name="slug"]').fill(r.menu.slug);
    await action(() => form.getByRole("button", { name: "إنشاء وفتح القائمة", exact: true }).click());
    await expect(page).toHaveURL(url => /^\/admin\/pages-blocks\/menus\/\d+$/u.test(url.pathname)); menuId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await goto(`/admin/pages-blocks/menus/${menuId}`); await tab("menu-settings"); await expect(page.locator('input[name="name"]')).toHaveValue(r.menu.name);
    assert.equal((await checkpoint("menu", "created")).menuId, menuId); completed.push("menu-create");
    return {renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  assert.ok(menuId, "Menu creation must finish before dependent graph work.");
  await run("core-navigation-menu-metadata-item-graph-commands", [], async () => {
    renderedAdoption=[];renderedOpened=new Set();
    const path = `/admin/pages-blocks/menus/${menuId}`;
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
    let cycleFeedbackVariant;
    const edit = async (id, change, phase, negative = false) => {
      await goto(path); const row = rowById("menu_item", id); await row.locator('[data-admin-row-action="edit"] button').click();
      const dialog = page.getByRole("dialog", { name: "تعديل عنصر القائمة", exact: true });
      await observeNavigationOpening({id:"navigation-menu-item-edit",consumer:"menu-builder",surface:"item-edit",collections:["menu-items","menu-editor-shell"],dialog,target:dialog.getByRole("button",{name:"حفظ",exact:true})});
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
    await reopened.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(reopened).toBeHidden();
    await edit(itemIds.c, dialog => select(dialog, "Parent", r.menu.b), "reparented");
    await goto(path); await action(() => rowById("menu_item", itemIds.b).getByRole("button", { name: "تحريك لأعلى", exact: true }).click()); await expect(feedback()).toBeVisible(); await checkpoint("menu", "reordered");
    await goto(path); await action(() => rowById("menu_item", itemIds.c).locator('[data-admin-row-action="visibility"] button').click()); await expect(rowById("menu_item", itemIds.c).getByRole("button", { name: `إظهار ${r.menu.editedC}`, exact: true })).toBeVisible(); await checkpoint("menu", "hidden");
    await edit(itemIds.b, dialog => select(dialog, "Parent", r.menu.editedC), "cycle-rejected", true);
    await goto(path); await more(rowById("menu_item", itemIds.b), "delete"); await expect(confirm()).toBeVisible(); await cancel().click(); await expect(confirm()).toBeHidden(); await checkpoint("menu", "delete-cancelled");
    await more(rowById("menu_item", itemIds.b), "delete"); await action(() => confirm().click()); await expect(rowById("menu_item", itemIds.b)).toHaveCount(0); await expect(rowById("menu_item", itemIds.c)).toHaveCount(0); await checkpoint("menu", "subtree-deleted"); assert.equal(cycleFeedbackVariant, "danger", "A rejected cycle must not be displayed as a successful save."); completed.push("menu-graph");
    return {renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  await run("core-navigation-menu-visibility-duplicate-delete", [], async () => {
    await goto("/admin/pages-blocks/menus"); await action(() => rowById("menu", menuId).locator('[data-admin-row-action="visibility"] button').click());
    await expect(rowById("menu", menuId).getByRole("button", { name: `إظهار ${r.menu.editedName}`, exact: true })).toBeVisible(); await checkpoint("menu", "menu-hidden");
    await more(rowById("menu", menuId), "duplicate"); await expect(page).toHaveURL(url => /^\/admin\/pages-blocks\/menus\/\d+$/u.test(url.pathname) && !url.pathname.endsWith(`/${menuId}`));
    const duplicateId = Number(new URL(page.url()).pathname.split("/").at(-1)); assert.equal((await checkpoint("menu", "duplicated")).duplicateMenuId, duplicateId);
    await goto("/admin/pages-blocks/menus"); await more(rowById("menu", duplicateId), "delete"); await cancel().click(); await expect(confirm()).toBeHidden(); await checkpoint("menu", "duplicate-delete-cancelled");
    await more(rowById("menu", duplicateId), "delete"); await action(() => confirm().click()); await expect(rowById("menu", duplicateId)).toHaveCount(0); await checkpoint("menu", "duplicate-deleted");
    await goto("/admin/pages-blocks/menus"); await action(() => rowById("menu", menuId).locator('[data-admin-row-action="visibility"] button').click()); await expect(rowById("menu", menuId).getByRole("button", { name: `إخفاء ${r.menu.editedName}`, exact: true })).toBeVisible(); await checkpoint("menu", "menu-shown"); completed.push("menu-list");
  });
  assert.ok(completed.includes("menu-list") && completed.includes("page-seo"), "Footer references only a completed owned Menu recipe.");
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
      if (i === 0) { await panel().getByPlaceholder("يُترك فارغًا لإخفاء العنوان الرئيسي", { exact: true }).fill(r.footer.title); await panel().getByLabel("النص / Tagline", { exact: true }).fill(r.footer.body); await switchTo(page, "إظهار أيقونة البراند", false); await switchTo(page, "تفعيل العمود", false); await expect(panel().getByLabel("النص / Tagline", { exact: true })).toHaveCount(0); await switchTo(page, "تفعيل العمود", true); await expect(panel().getByLabel("النص / Tagline", { exact: true })).toHaveValue(r.footer.body); }
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
    await rowByLabel(r.footer.editedLink).locator('[data-admin-row-action="edit"] button').click();
    await expect(linkModal().getByText(CORE_DOWNLOAD_MEDIA_HREF,{exact:true})).toBeVisible();await expect(linkModal().getByText('تنزيل',{exact:true})).toBeVisible();
    await linkModal().getByRole('button',{name:'إلغاء',exact:true}).click();await expect(linkModal()).toBeHidden();
    await tab("column-2"); await expect(panel().getByLabel("النص / Tagline", { exact: true })).toHaveValue(r.footer.body); await tab("social-legal"); await expect(panel().getByLabel("Copyright", { exact: true })).toHaveValue(r.footer.copyright); await checkpoint("footer", "reloaded"); completed.push("footer-aggregate");
    return {renderedAdoption:[...renderedAdoption],automaticCoverage:[]};
  });
  assert.equal(completed.length, 6);
  return { status: "pass", completed, plan, checkpoints, permissionEvidence, downloadMedia, permissionCandidateKeys:permissionEvidence.map(row=>row.candidateRequiredCase), requiresOwnedCleanupBeforePromotion: true, globalClosed: false };
}
