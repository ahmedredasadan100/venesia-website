import {exerciseCoreDownloadField,CORE_DOWNLOAD_MEDIA_HREF} from './admin-core-download-media-adoption.mjs';
import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption} from "./admin-core-rendered-adoption.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";
import { buildCoreTemplateControlsPlan, TEMPLATE_CONTROL_VALUES as values } from "./admin-core-template-controls-contract.mjs";

/** Only finite owned templates. No generic capability/axis is promoted here. */
export async function runCoreTemplateControlsJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, nativeCheckpoint, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const f = fixtures.templateControls; assert.ok(f);
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = buildCoreTemplateControlsPlan({ manifest, fixtures: f }), outcomes = [];
  let currentRecipe, renderedAdoption = [], renderedSeen = new Set();
  const input = (form, name) => form.locator('[name="' + name + '"]:not([type="hidden"])');
  const state = (form, name) => form.locator('[name="' + name + '"]');
  const formFor = id => page.locator("form").filter({ has: page.locator('input[name="id"][value="' + id + '"]') });
  const save = form => form.locator('button[type="submit"]');
  const checkpoint = async (recipe, phase) => { const request = { id: randomUUID(), kind: "template-controls-state", recipe, phase }; const result = await nativeCheckpoint(request); for (const key of Object.keys(request)) assert.equal(result[key], request[key]); assert.equal(result.status, "pass"); return result; };
  const tab = (form, name) => form.locator('[data-admin-tab-id="' + name + '"]').click();

  async function select(form, name, value) {
    const owner = form.locator('[data-admin-form-listbox]').filter({ has: page.locator('select[name="' + name + '"]') });
    await expect(owner).toHaveCount(1);
    const source = owner.locator("select"), combo = owner.getByRole("combobox");
    const choices = await source.locator("option").evaluateAll(options => options.filter(o => o.value && !o.disabled).map(o => ({ value: o.value, label: o.textContent })));
    const index = choices.findIndex(option => option.value === String(value));
    assert.ok(index >= 0, "The current control must actually expose " + name + "=" + value);
    // Actual installed listbox keyboard contract: Home, ArrowDown, Enter.
    await combo.press("Home");
    for (let i = 0; i < index; i++) await combo.press("ArrowDown");
    await combo.press("Enter");
    await expect(source).toHaveValue(String(value)); await expect(combo).toBeFocused();
  }
  async function setChecked(control, checked) {
    await expect(control).toHaveCount(1);
    if (await control.isChecked() !== checked) await control.locator("xpath=ancestor::label[1]").click();
    if (checked) await expect(control).toBeChecked(); else await expect(control).not.toBeChecked();
  }
  async function titleFormat(form) {
    const row = form.locator("[data-module-editor-control-row]").filter({ has: page.locator('input[name="title_alignment"]') });
    await expect(row).toHaveCount(1); await input(form, "title").fill(values.title);
    await setChecked(row.getByRole("switch"), false); await expect(state(form, "show_title")).toHaveValue("false");
    await setChecked(row.getByRole("switch"), true);
    const bold = row.locator("[data-admin-text-format-bold]");
    if (await bold.getAttribute("aria-pressed") !== "false") await bold.click();
    await row.locator('[data-admin-text-alignment="left"]').click();
    await row.locator('[data-admin-text-alignment="center"]').click();
    await expect(state(form, "title_bold")).toHaveValue("false");
    await expect(state(form, "title_alignment")).toHaveValue("center");
  }
  const linkOwner = (form, prefix) => state(form, prefix + "_link_kind").locator("xpath=..");
  async function chooseExternal(form, prefix, href, target, cancelOnly = false) {
    const owner = linkOwner(form, prefix), trigger = owner.getByRole("button", { name: "اختيار الرابط", exact: true });
    const before = await state(form, prefix + "_link_href").inputValue();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "اختيار رابط", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "External", exact: true }).click();
    await dialog.getByLabel("الرابط", { exact: true }).fill(href);
    await setChecked(dialog.getByRole("switch", { name: "فتح في تبويب جديد", exact: true }), target === "_blank");
    await expect(state(form, prefix + "_link_href")).toHaveValue(before);
    if(!renderedSeen.has('link:'+prefix)){
      const common={page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:currentRecipe.consumer,surface:currentRecipe.surface}]};
      renderedAdoption.push(await observeCoreModalFocusAdoption({...common,id:'template-controls-'+currentRecipe.kind+'-'+prefix+'-link-focus',dialog}));
      const body=dialog.locator(':scope > div').filter({has:page.getByLabel('الرابط',{exact:true})}),target=dialog.getByRole('switch',{name:'فتح في تبويب جديد',exact:true}).locator('xpath=ancestor::label[1]');
      renderedAdoption.push(await observeCoreScrollbarAdoption({...common,id:'template-controls-'+currentRecipe.kind+'-'+prefix+'-link-scroll',container:body,target,axis:'y',containment:'modal-lock'}));
      renderedSeen.add('link:'+prefix);
    }
    if (cancelOnly) {
      await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
      await expect(state(form, prefix + "_link_href")).toHaveValue(before);
    } else {
      await dialog.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
      await expect(state(form, prefix + "_link_href")).toHaveValue(href);
      await expect(state(form, prefix + "_link_target")).toHaveValue(target);
    }
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  }
  async function numericNegative(form, name, valid) {
    const posts = [], listener = request => { if (request.method() === "POST" && request.headers()["next-action"]) posts.push(request); };
    await input(form, name).fill("0"); page.on("request", listener);
    try {
      await save(form).click();
      assert.equal(await input(form, name).evaluate(control => control.validity.rangeUnderflow), true);
      await expect(input(form, name)).toBeFocused();
      assert.equal(posts.length, 0, "Native invalid numeric form must not dispatch an Action.");
    } finally { page.off("request", listener); }
    await input(form, name).fill(String(valid));
  }
  async function viewportProof(form) {
    const previous = page.viewportSize(); const observations = [];
    try {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await save(form).scrollIntoViewIfNeeded(); await expect(save(form)).toBeVisible();
        const layout = await form.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, pageScroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        assert.ok(layout.scroll <= layout.client + 1, "The reached editor form must not overflow horizontally.");
        assert.ok(layout.pageScroll <= layout.viewport + 1, "The reached editor must not cause page overflow.");
        observations.push({ width, saveReachable: true, horizontalOverflow: false });
      }
    } finally { if (previous) await page.setViewportSize(previous); }
    return observations;
  }
  async function authorCards(form) {
    while (await form.getByRole("button", { name: /^حذف البطاقة \d+$/u }).count() > 1) await form.getByRole("button", { name: /^حذف البطاقة \d+$/u }).last().click();
    await expect(form.getByRole("button", { name: "حذف البطاقة 1", exact: true })).toBeDisabled();
    await expect(form.getByRole("button", { name: "تحريك البطاقة 1 لأعلى", exact: true })).toBeDisabled();
    await select(form, "columns", "2"); await select(form, "columns", "4");
    for (let i = 0; i < 3; i++) {
      if (i) await form.getByRole("button", { name: "إضافة بطاقة", exact: true }).click();
      for (const key of ["icon", "title", "body"]) await input(form, "item_" + i + "_" + key).fill(values.cards[i][key]);
      if (i < 2) await chooseExternal(form, "item_" + i, values.hrefs[i], i ? "_self" : "_blank");
    }
    await form.getByRole("button", { name: "تحريك البطاقة 2 لأعلى", exact: true }).click();
    await expect(input(form, "item_0_title")).toHaveValue(values.cards[1].title);
    await expect(state(form, "item_0_link_href")).toHaveValue(values.hrefs[1]);
    await form.getByRole("button", { name: "حذف البطاقة 3", exact: true }).click();
    await expect(input(form, "item_2_title")).toHaveCount(0); await titleFormat(form);
  }
  async function authorBreadcrumb(form) {
    while (await form.getByRole("button", { name: /^حذف عنصر المسار \d+$/u }).count()) await form.getByRole("button", { name: /^حذف عنصر المسار \d+$/u }).last().click();
    await select(form, "source", "navigation"); await select(form, "source", "manual");
    await setChecked(input(form, "show_home"), true); await setChecked(input(form, "show_home"), false);
    await input(form, "current_label_override").fill(values.title);
    for (let i = 0; i < 3; i++) {
      await form.getByRole("button", { name: "إضافة عنصر مسار", exact: true }).click();
      await input(form, "manual_item_" + i + "_label").fill(values.breadcrumbs[i]);
      if (i < 2) await chooseExternal(form, "manual_item_" + i, values.hrefs[i], i ? "_self" : "_blank");
    }
    await form.getByRole("button", { name: "تحريك عنصر المسار 2 لأعلى", exact: true }).click();
    await expect(input(form, "manual_item_0_label")).toHaveValue(values.breadcrumbs[1]);
    await expect(state(form, "manual_item_0_link_href")).toHaveValue(values.hrefs[1]);
    await form.getByRole("button", { name: "حذف عنصر المسار 3", exact: true }).click();
    await expect(input(form, "manual_item_2_label")).toHaveCount(0);
  }
  async function authorCta(form) {
    await select(form, "background_style", "gold"); await select(form, "background_style", "gradient");
    await input(form, "primary_cta_label").fill(values.primaryLabel);
    await chooseExternal(form, "primary_cta", values.hrefs[0], "_blank");
    await chooseExternal(form, "primary_cta", values.hrefs[1], "_self");
    await input(form, "secondary_cta_label").fill(values.secondaryLabel);
    await chooseExternal(form, "secondary_cta", values.hrefs[0], "_blank");
    await linkOwner(form, "secondary_cta").getByRole("button", { name: "مسح", exact: true }).click();
    await input(form, "secondary_cta_label").fill("");
    await expect(state(form, "secondary_cta_link_kind")).toHaveValue("none");
    await expect(state(form, "secondary_cta_link_href")).toHaveValue(""); await titleFormat(form);
  }
  async function authorFeed(form) {
    const categories = form.locator('input[name="category_slugs"]');
    for (const control of await categories.all()) await setChecked(control, false);
    const category = form.locator('input[name="category_slugs"][value="' + f.category.slug + '"]');
    const other = form.locator('input[name="category_slugs"][value="' + f.otherCategory.slug + '"]');
    const series = form.locator('input[name="series_slugs"][value="' + f.series.slug + '"]');
    await setChecked(category, true); await setChecked(series, true);
    await setChecked(other, true); await setChecked(category, false);
    await expect(series).toHaveCount(0); await expect(form.locator("[data-feed-series-all]")).toBeChecked();
    await setChecked(category, true); await setChecked(other, false); await setChecked(series, true);
    await form.locator("[data-feed-series-all]").locator("xpath=ancestor::label[1]").click();
    await expect(series).not.toBeChecked(); await setChecked(series, true);
    for (const [kind, layout] of [["latest", "slider"], ["popular", "grid"], ["categories", "grid"], ["series", "list"]]) {
      await select(form, "feed_type", kind); await select(form, kind + "_layout", layout);
      if (kind === "latest") {
        await select(form, "latest_density", "2");
        await setChecked(input(form, "latest_show_arrows"), false); await setChecked(input(form, "latest_show_dots"), true);
      } else if (kind !== "series") await select(form, kind + "_columns", kind === "popular" ? "2" : "3");
      else {
        await input(form, "series_list_items_per_group").fill("2"); await input(form, "series_list_interval_seconds").fill("9");
        await setChecked(input(form, "series_list_show_dots"), false);
      }
    }
    await select(form, "feed_type", "latest"); await input(form, "limit").fill("7");
  }
  async function authorFeatured(form) {
    await select(form, "source_kind", "categories"); await select(form, "category_slug", f.category.slug);
    await select(form, "selection_mode", "manual");
    const manual=form.locator('[data-featured-manual-items-scroll]');await expect(manual).toHaveCount(1);
    renderedAdoption.push(await observeCoreScrollbarAdoption({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:currentRecipe.consumer,surface:currentRecipe.surface}],id:'template-controls-featured-manual-scroll',container:manual,target:manual.locator(':scope > label').last(),axis:'y',containment:'default-chaining'}));
    for (const remove of await form.locator("[data-featured-manual-remove]").all()) await remove.click();
    const article = form.getByRole("checkbox", { name: "اختيار " + f.article.title, exact: true });
    await setChecked(article, true); await setChecked(article, false); await setChecked(article, true);
    await expect(form.locator('[name="manual_topic_ids"]')).toHaveCount(1);
    await select(form, "source_kind", "media-center"); await select(form, "content_type", "news");
    await expect(form.locator('[data-featured-item-id="' + f.article.id + '"]')).toHaveAttribute("data-featured-resolution", "unresolved");
    await setChecked(form.getByRole("checkbox", { name: "اختيار " + f.news.title, exact: true }), true);
    assert.deepEqual(await form.locator('[name="manual_topic_ids"]').evaluateAll(nodes => nodes.map(node => Number(node.value))), [f.article.id, f.news.id]);
    await select(form, "source_kind", "categories");
    await expect(form.locator('[data-featured-item-id="' + f.news.id + '"]')).toHaveAttribute("data-featured-resolution", "unresolved");
    await form.locator('[data-featured-manual-remove="' + f.news.id + '"]').click();
    await input(form, "item_limit").fill("3");
    await tab(form, "presentation"); await select(form, "presentation_variant", "list"); await tab(form, "content");
  }
  async function authorSidebar(form) {
    await select(form, "widget_key", "sections"); await expect(input(form, "limit")).toHaveCount(0);
    await expect(form.locator('select[name="source_kind"]')).toHaveCount(0);
    await select(form, "widget_key", "latest"); await select(form, "source_kind", "categories"); await select(form, "category_slug", f.category.slug);
    await select(form, "source_kind", "media-center"); await select(form, "content_type", "video");
    await select(form, "widget_key", "popular"); await select(form, "presentation", "group-carousel");
    for (const [name, value] of Object.entries({ show_title: true, show_image: false, show_category: false, show_series: false, show_excerpt: true, show_date: false })) {
      const control = input(form, name + "_on_page");
      await setChecked(control, value);
    }
    await input(form, "limit").fill("7");
  }
  async function authorHub(form) {
    await select(form, "section_key", "videos"); await select(form, "section_key", "press");
    await expect(input(form, "title")).toHaveValue("البيانات الصحفية"); await titleFormat(form);
    await tab(form, "presentation"); await select(form, "collection_layout", "grid"); await select(form, "collection_layout", "list");
    await input(form, "item_limit").fill("5");
  }
  const author = { cards: authorCards, breadcrumb: authorBreadcrumb, cta: authorCta, feed: authorFeed, featured: authorFeatured, "media-sidebar": authorSidebar, "media-hub": authorHub };
  async function saveWithNativePending(recipe, form) {
    const token = randomUUID(), entity = "template_control_" + recipe.kind.replaceAll("-", "_");
    const fault = async operation => {
      const request = { id: randomUUID(), kind: "domain-write-fault-" + operation, entity, token };
      const result = await nativeCheckpoint(request);
      for (const key of Object.keys(request)) assert.equal(result[key], request[key]);
      assert.equal(result.status, "pass"); return result;
    };
    let armed = false, responsePromise;
    const posts = [], onRequest = request => {
      if (request.method() === "POST" && request.headers()["next-action"] && new URL(request.url()).origin === origin) posts.push(request);
    };
    try {
      await fault("arm"); armed = true;
      page.on("request", onRequest);
      responsePromise = actionResponse();
      // Observe the same promise immediately; the original rejection is still
      // awaited below, and finally drains it after releasing the owned lock.
      void responsePromise.catch(() => {});
      await save(form).click();
      const first = await fault("observe-blocked");
      assert.equal(first.observedOneStatement, true); assert.equal(first.cancelledOneStatement, false);
      const pending = form.locator("[data-admin-form-pending-fields]");
      await expect(pending).toHaveAttribute("aria-busy", "true");
      await expect(pending).toHaveAttribute("inert", "");
      await expect(save(form)).toBeDisabled(); await expect(input(form, "name")).toBeDisabled();
      // A normal keyboard repeat cannot activate the now-inert submit surface.
      // No forced click, dispatchEvent or hidden-field write is admitted.
      await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
      const second = await fault("observe-blocked");
      for (const key of ["backendPid", "backendStartedAt", "queryStartedAt", "queryFingerprint", "holderPid"]) assert.equal(second[key], first[key]);
      assert.equal(posts.length, 1, "Pending normal-keyboard repeats must not dispatch another Action.");
      const released = await fault("release"); armed = false;
      assert.equal(released.ownedLockRolledBack, true); assert.equal(released.cancellationObserved, false);
      const response = await responsePromise; assertActionAcknowledged(response);
      return { nativeBlockedStatementObservedTwice: true, sameStatementIdentity: true, fieldsDisabledAndInert: true,
        actionRequests: posts.length, keyboardRepeatDispatchedNoExtraAction: true, ownedLockReleased: true,
        closeControl: "not_declared_by_this_specialized_form", sharedFailureRetentionClaim: false };
    } finally {
      page.off("request", onRequest);
      try { if (armed) await fault("release"); }
      finally { if (responsePromise) await Promise.allSettled([responsePromise]); }
    }
  }


  async function checkReload(recipe, form) {
    const kind = recipe.kind;
    const field=({cards:"item_0",breadcrumb:"manual_item_0",cta:"primary_cta"})[kind];
    if(field){await expect(state(form,field+"_link_href")).toHaveValue(CORE_DOWNLOAD_MEDIA_HREF);await expect(state(form,field+"_link_kind")).toHaveValue("download");await expect(state(form,field+"_link_target")).toHaveValue("_blank");}
    if (kind === "cards") {
      await expect(form.locator('select[name="columns"]')).toHaveValue("4");
      for (let i = 0; i < 2; i++) {
        await expect(input(form, "item_" + i + "_title")).toHaveValue(values.cards[1 - i].title);
        await expect(state(form, "item_" + i + "_link_href")).toHaveValue(i ? values.hrefs[0] : CORE_DOWNLOAD_MEDIA_HREF);
      }
    } else if (kind === "breadcrumb") {
      await expect(form.locator('select[name="source"]')).toHaveValue("manual");
      await expect(input(form, "show_home")).not.toBeChecked();
      for (let i = 0; i < 2; i++) await expect(input(form, "manual_item_" + i + "_label")).toHaveValue(values.breadcrumbs[1 - i]);
    } else if (kind === "cta") {
      await expect(state(form, "primary_cta_link_href")).toHaveValue(CORE_DOWNLOAD_MEDIA_HREF);
      await expect(state(form, "secondary_cta_link_kind")).toHaveValue("none");
      await expect(input(form, "secondary_cta_label")).toHaveValue("");
    } else if (kind === "feed") {
      await expect(form.locator('select[name="feed_type"]')).toHaveValue("latest");
      await expect(input(form, "limit")).toHaveValue("7");
      await expect(form.locator('input[name="series_slugs"][value="' + f.series.slug + '"]')).toBeChecked();
    } else if (kind === "featured") {
      await expect(form.locator('[name="manual_topic_ids"]')).toHaveCount(1);
      await expect(form.locator('[name="manual_topic_ids"]')).toHaveValue(String(f.article.id));
      await tab(form, "presentation"); await expect(form.locator('select[name="presentation_variant"]')).toHaveValue("list");
    } else if (kind === "media-sidebar") {
      await expect(form.locator('select[name="widget_key"]')).toHaveValue("popular");
      await expect(form.locator('select[name="content_type"]')).toHaveValue("video");
      await expect(input(form, "limit")).toHaveValue("7");
    } else if (kind === "media-hub") {
      await expect(form.locator('select[name="section_key"]')).toHaveValue("press");
      await expect(input(form, "title")).toHaveValue(values.title);
      await tab(form, "presentation"); await expect(form.locator('select[name="collection_layout"]')).toHaveValue("list");
    }
  }
  for (const recipe of plan.recipes) await run("core-template-controls-" + recipe.kind, [], async () => {
    currentRecipe=recipe;renderedAdoption=[];renderedSeen=new Set();
    const path = "/admin/pages-blocks/blocks/" + recipe.kind + "/" + recipe.template.id;
    await observe("template-controls-open", () => page.goto(origin + path, { waitUntil: "domcontentloaded" }));
    const form = formFor(recipe.template.id); await expect(form).toHaveCount(1); await tab(form, "content");
    await checkpoint(recipe.kind, "baseline"); await author[recipe.kind](form);
    const downloadField=({cards:'item_0',breadcrumb:'manual_item_0',cta:'primary_cta'})[recipe.kind];
    const downloadMedia=downloadField ? await exerciseCoreDownloadField({page,origin,owner:linkOwner(form,downloadField),asset:f.downloadMedia,field:downloadField,originalHref:values.hrefs[1],clearLabel:recipe.kind==='cta'?'مسح':'مسح الرابط',assertCurrent:async(href,kind)=>{
      await expect(state(form,downloadField+'_link_href')).toHaveValue(href);await expect(state(form,downloadField+'_link_kind')).toHaveValue(kind);
      await expect(state(form,downloadField+'_link_target')).toHaveValue(kind==='download'?'_blank':'_self');
    }}) : null;
    await checkpoint(recipe.kind, "draft");
    if (recipe.kind === "cards") await chooseExternal(form, "item_0", values.hrefs[0], "_blank", true);
    else if (recipe.kind === "breadcrumb") await chooseExternal(form, "manual_item_0", values.hrefs[0], "_blank", true);
    else if (recipe.kind === "cta") await chooseExternal(form, "primary_cta", values.hrefs[0], "_blank", true);
    else if (recipe.kind === "feed") await numericNegative(form, "limit", 7);
    else if (recipe.kind === "featured") await numericNegative(form, "item_limit", 3);
    else if (recipe.kind === "media-hub") await numericNegative(form, "item_limit", 5);
    else {
      await input(form, "limit").fill("0"); await expect(input(form, "limit")).toHaveValue("1");
      await input(form, "limit").fill("61"); await expect(input(form, "limit")).toHaveValue("60");
      await input(form, "limit").fill("7");
    }
    await checkpoint(recipe.kind, "negative");
    const viewports = await viewportProof(form);
    const pendingProof = await observe("template-controls-native-pending", () => saveWithNativePending(recipe, form));
    await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get("saved") === "1", { timeout: 60_000 });
    await expect(save(formFor(recipe.template.id))).toBeEnabled(); await checkpoint(recipe.kind, "saved");
    await observe("template-controls-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    const reloaded = formFor(recipe.template.id); await tab(reloaded, "content"); await checkReload(recipe, reloaded);
    await checkpoint(recipe.kind, "reloaded");
    const result = { renderedAdoption, consumer: recipe.consumer, surface: recipe.surface, kind: recipe.kind, observations: recipe.controls, viewports, pendingProof, downloadMedia,
      nativeCheckpoints: 5, genericCoverage: [], completeAxisCoverage: [], globalClosed: false };
    outcomes.push(result); return result;
  });
  return { planned: plan.recipes.length, completed: outcomes.length, outcomes, remainingBoundaries: plan.remainingBoundaries,
    nativeFinalityRequired: true, globalClosed: false };
}




