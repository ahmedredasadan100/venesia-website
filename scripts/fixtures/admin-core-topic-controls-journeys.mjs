import {observeCoreScrollbarAdoption} from "./admin-core-rendered-adoption.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";
import { buildCoreTopicControlsPlan, TOPIC_CONTROL_VALUES as v, expectedTopicControlPayload } from "./admin-core-topic-controls-contract.mjs";

/** Concrete current controls only. No library upload, public navigation or global-axis promotion. */

/** Count the actual rendered selectable options, including a selectable empty value. */
export function resolveTopicControlOptionIndex(listboxId, options, value) {
  assert.equal(typeof listboxId, "string"); assert.ok(listboxId.endsWith("-listbox"));
  assert.ok(Array.isArray(options) && options.length > 0);
  const prefix = listboxId.slice(0, -"-listbox".length) + "-option-";
  assert.ok(options.every(option => typeof option.id === "string" && option.id.startsWith(prefix) && typeof option.disabled === "boolean"));
  assert.equal(new Set(options.map(option => option.id)).size, options.length);
  const selectable = options.filter(option => !option.disabled), target = prefix + String(value), index = selectable.findIndex(option => option.id === target);
  assert.ok(index >= 0, "The current rendered listbox must expose the requested selectable value.");
  return { index, target, first: selectable[0].id };
}

export async function runCoreTopicControlsJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, nativeCheckpoint, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); const f = fixtures.topicControls; assert.ok(f);
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = buildCoreTopicControlsPlan({ manifest, fixtures: f }), completed = [];
  let currentRecipe,renderedAdoption=[],renderedPickerObserved=false;
  const form = () => page.locator("form[data-admin-form-runtime]");
  const field = name => form().locator('[name="' + name + '"]');
  const save = () => form().locator('button[type="submit"]');
  const tab = id => form().locator('[data-admin-tab-id="' + id + '"]').click();
  const checkpoint = async (recipe, phase) => {
    const request = { id: randomUUID(), kind: "topic-controls-state", recipe, phase }, receipt = await nativeCheckpoint(request);
    for (const key of Object.keys(request)) assert.equal(receipt[key], request[key]); assert.equal(receipt.status, "pass"); return receipt;
  };
  async function checked(name, value) {
    const input = form().locator('input[type="checkbox"][name="' + name + '"]'); await expect(input).toHaveCount(1);
    if (await input.isChecked() !== value) await input.locator("xpath=ancestor::label[1]").click();
    if (value) await expect(input).toBeChecked(); else await expect(input).not.toBeChecked();
  }
  async function select(name, value) {
    const owner = form().locator('[data-admin-form-listbox]').filter({ has: page.locator('select[name="' + name + '"]') });
    const source = owner.locator("select"), combo = owner.getByRole("combobox");
    await combo.press("Home");
    const listboxId = await combo.getAttribute("aria-controls"); assert.ok(listboxId);
    const menu = page.getByRole("listbox").filter({ has: page.getByRole("option") }).and(page.locator('[id="' + listboxId + '"]'));
    await expect(menu).toBeVisible();
    const options = await menu.getByRole("option").evaluateAll(rows => rows.map(option => ({ id: option.id, disabled: option.hasAttribute("disabled") || option.getAttribute("aria-disabled") === "true" })));
    const { index, target, first } = resolveTopicControlOptionIndex(listboxId, options, value);
    await expect(combo).toHaveAttribute("aria-activedescendant", first);
    for (let n = 0; n < index; n++) await combo.press("ArrowDown");
    await expect(combo).toHaveAttribute("aria-activedescendant", target); await combo.press("Enter");
    await expect(source).toHaveValue(String(value)); await expect(combo).toBeFocused();
  }
  async function acknowledge() {
    const [response] = await Promise.all([actionResponse(), save().click()]); assertActionAcknowledged(response);
  }
  const imageOwner = name => form().locator('[data-admin-media-image-field="' + name + '"]');
  const modal = () => page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
  async function chooseAsset(trigger, asset, cancel = false) {
    const match = response => { const url = new URL(response.url()); return url.origin === origin && url.pathname === "/api/admin/media-library" && response.request().method() === "GET"; };
    const [initial] = await Promise.all([page.waitForResponse(match), trigger.click()]); assert.equal(initial.status(), 200);
    const data = await initial.json(), root = data.folders.find(row => row.path === "images"); assert.ok(root);
    const dialog = modal(); await expect(dialog).toBeVisible();
    const rootButton = dialog.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ has: page.getByText(root.displayName, { exact: true }) });
    await rootButton.click();
    const search = dialog.getByPlaceholder("ابحث بالاسم أو المسار أو الوصف البديل…", { exact: true });
    const [found] = await Promise.all([page.waitForResponse(response => match(response) && new URL(response.url()).searchParams.get("q") === asset.objectKey && new URL(response.url()).searchParams.get("folder") === "images"), search.fill(asset.objectKey)]);
    assert.equal(found.status(), 200); const catalog = await found.json();
    assert.deepEqual(catalog.assets.map(row => row.publicUrl), [asset.publicUrl]);
    const button = dialog.locator("button[aria-pressed]").filter({ has: page.getByText(asset.displayName, { exact: true }) });
    await expect(button).toHaveCount(1); await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
    // Selection is staged in the picker until explicit confirmation; no resource is mutated.
    if(!renderedPickerObserved){
      const container=dialog.locator('[data-media-picker-scroll]'),target=dialog.getByText('يُعاد التحقق من الارتباطات تلقائيًا قبل أي حذف.',{exact:true});
      renderedAdoption.push(await observeCoreScrollbarAdoption({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:currentRecipe.consumer,surface:currentRecipe.surface},{boundary:'collection',consumer:'content-editor-pages',surface:new URL(page.url()).pathname}],id:'topic-'+currentRecipe.kind+'-media-scroll',container,target,axis:'y',containment:'overscroll-contain'}));renderedPickerObserved=true;
    }
    await dialog.getByRole("button", { name: cancel ? "إلغاء" : "تأكيد الاختيار", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  }
  async function imageControls(name, finalIndex) {
    const owner = imageOwner(name), path = owner.locator('input[name="' + name + '"]');
    await chooseAsset(owner.getByRole("button").first(), f.assets[0]); await expect(path).toHaveValue(f.assets[0].publicUrl);
    await chooseAsset(owner.getByRole("button").first(), f.assets[1]); await expect(path).toHaveValue(f.assets[1].publicUrl);
    await chooseAsset(owner.getByRole("button").first(), f.assets[2], true); await expect(path).toHaveValue(f.assets[1].publicUrl);
    await owner.getByRole("button", { name: "إزالة", exact: true }).click(); await expect(path).toHaveValue("");
    await chooseAsset(owner.getByRole("button").first(), f.assets[finalIndex]); await expect(path).toHaveValue(f.assets[finalIndex].publicUrl);
  }
  async function galleryControls() {
    const owner = form().locator('[data-admin-media-gallery-mode="items"]'), rows = () => owner.locator('[data-admin-media-gallery-card="image"]');
    for (const index of [0, 1, 0]) await chooseAsset(owner.locator('[data-admin-media-gallery-action="add"]'), f.assets[index]);
    await expect(rows()).toHaveCount(3);
    const authored = [["وصف المعرض الأول", "تعليق المعرض الأول"], ["وصف المعرض الثاني", "تعليق المعرض الثاني"], ["وصف الصورة المكررة", "تعليق الصورة المكررة"]];
    for (const [index, values] of authored.entries()) {
      await rows().nth(index).locator('[name="gallery_image_alt"]').fill(values[0]);
      await rows().nth(index).locator('[name="gallery_image_caption"]').fill(values[1]);
    }
    await expect(rows().first().locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled();
    await expect(rows().last().locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
    await rows().nth(1).locator('[data-admin-media-gallery-action="move-up"]').click();
    await expect(rows().first().locator('[name="gallery_image_alt"]')).toHaveValue(authored[1][0]);
    await chooseAsset(rows().nth(1).locator('[data-admin-media-gallery-action="replace"]'), f.assets[2]);
    await expect(rows().nth(1).locator('[name="gallery_image_alt"]')).toHaveValue(authored[0][0]);
    await chooseAsset(owner.locator('[data-admin-media-gallery-action="add"]'), f.assets[2]); await expect(rows()).toHaveCount(4);
    await rows().last().locator('[data-admin-media-gallery-action="remove"]').click(); await expect(rows()).toHaveCount(3);
    await chooseAsset(rows().first().locator('[data-admin-media-gallery-action="replace"]'), f.assets[0], true);
    await assertGallery();
  }
  async function assertGallery() {
    const rows = form().locator('[data-admin-media-gallery-card="image"]'), expected = expectedTopicControlPayload("gallery", f).images;
    await expect(rows).toHaveCount(expected.length);
    for (const [index, item] of expected.entries()) for (const [name, value] of Object.entries({ gallery_image_url: item.url, gallery_image_alt: item.alt, gallery_image_caption: item.caption })) await expect(rows.nth(index).locator('[name="' + name + '"]')).toHaveValue(value);
  }
  async function faqControls() {
    await tab("faq"); const owner = form().locator("[data-topic-faq-editor]"), rows = () => owner.locator("[data-faq-item]");
    for (let index = 0; index < 3; index++) {
      await owner.getByRole("button", { name: "＋ إضافة سؤال جديد", exact: true }).click();
      await rows().last().locator('input[name="faq_question"]').fill(index < 2 ? v.faq[index].question : "سؤال محذوف");
      await rows().last().locator('textarea[name="faq_answer"]').fill(index < 2 ? v.faq[index].answer : "إجابة محذوفة");
    }
    await rows().nth(1).getByRole("button", { name: "تحريك السؤال لأعلى", exact: true }).click();
    await expect(rows().first().locator('[name="faq_question"]')).toHaveValue(v.faq[1].question);
    await rows().last().getByRole("button", { name: "حذف السؤال", exact: true }).click();
    let confirmation = page.getByRole("dialog", { name: "حذف السؤال؟", exact: true }); await confirmation.locator("[data-admin-confirm-cancel]").click(); await expect(rows()).toHaveCount(3);
    await rows().last().getByRole("button", { name: "حذف السؤال", exact: true }).click();
    confirmation = page.getByRole("dialog", { name: "حذف السؤال؟", exact: true }); await confirmation.locator("[data-admin-confirm-submit]").click(); await expect(rows()).toHaveCount(2);
    await checked("show_faq_on_page", false); await checked("show_faq_on_page", true); await checked("show_faq_title_on_page", false);
  }
  async function publishControls() {
    await tab("publish");
    await checked("is_featured", true); await checked("is_featured", false); await checked("is_featured", true);
    await checked("is_popular", true); await checked("is_popular", false); await checked("is_popular", true);
    const date = field("published_at"), trigger = form().getByRole("button", { name: "فتح تقويم تاريخ النشر الظاهر", exact: true });
    await expect(date).toBeEnabled(); await expect(date).toHaveAttribute("type", "date"); await trigger.click(); await page.keyboard.press("Escape");
    const original = await date.inputValue(); await date.press("ArrowUp"); await expect(date).not.toHaveValue(original);
    const changed = await date.inputValue(); await date.press("ArrowDown"); await expect(date).not.toHaveValue(changed);
    await date.press("ControlOrMeta+A"); await date.press("Backspace"); await expect(date).toHaveValue("");
    await expect(field("status")).toHaveValue("unpublished");
  }
  async function assertDraft(kind, persisted = false) {
    await tab("basic"); await expect(field("category_id")).toHaveValue(String(f.category.id)); await expect(field("series_id")).toHaveValue(String(f.series.id));
    await expect(field("image")).toHaveValue(f.assets[1].publicUrl); await expect(field("image_alt")).toHaveValue(v.imageAlt);
    for (const [name, value] of Object.entries(v.display)) { const input = form().locator('input[type="checkbox"][name="' + name + '"]'); if (value) await expect(input).toBeChecked(); else await expect(input).not.toBeChecked(); }
    if (kind === "gallery") await assertGallery();
    if (kind === "video") { await expect(field("video_url")).toHaveValue(persisted ? v.storedVideoUrl : v.videoUrl); await expect(field("video_duration")).toHaveValue(v.duration); await expect(field("video_thumbnail")).toHaveValue(f.assets[2].publicUrl); }
    if (!["video", "gallery"].includes(kind)) await expect(field("content")).toHaveValue(v.markdown);
  }
  async function semanticNegative(recipe) {
    await tab("basic");
    if (["video", "gallery"].includes(recipe.kind)) {
      const target = recipe.kind === "video" ? field("video_url") : field("gallery_image_alt").first();
      const prior = await target.inputValue(); await target.fill(recipe.kind === "video" ? "https://example.invalid/not-youtube" : "");
      await tab("publish"); await checked("content_publication_toggle", true); await acknowledge();
      await expect(form().locator(recipe.kind === "video" ? "#video_url-error" : "#gallery_image_alt-error")).toBeVisible(); await expect(save()).toBeEnabled();
      await target.fill(prior); await tab("publish"); await checked("content_publication_toggle", false);
    } else {
      await field("title").fill(""); await acknowledge(); await expect(form().locator("#title-error")).toBeVisible(); await expect(save()).toBeEnabled(); await field("title").fill(recipe.title);
    }
    await assertDraft(recipe.kind);
  }
  async function saveWithNativePending(recipe, cancel) {
    const token = randomUUID(), entity = "topic_control_" + recipe.kind;
    const fault = async operation => {
      const request = { id: randomUUID(), kind: "domain-write-fault-" + operation, entity, token }, result = await nativeCheckpoint(request);
      for (const key of Object.keys(request)) assert.equal(result[key], request[key]); assert.equal(result.status, "pass"); return result;
    };
    let armed = false, responsePromise;
    const posts = [], onRequest = request => { if (request.method() === "POST" && request.headers()["next-action"] && new URL(request.url()).origin === origin) posts.push(request); };
    try {
      await fault("arm"); armed = true; page.on("request", onRequest);
      responsePromise = actionResponse(); void responsePromise.catch(() => {});
      await save().click(); const first = await fault("observe-blocked"); assert.equal(first.observedOneStatement, true); assert.equal(first.cancelledOneStatement, false);
      const pending = form().locator("[data-admin-form-fields]"); await expect(form()).toHaveAttribute("aria-busy", "true"); await expect(pending).toBeDisabled();
      await expect(save()).toBeDisabled(); await expect(field("title")).toBeDisabled(); await expect(form().locator('[data-admin-form-action="close"]')).toBeDisabled();
      await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
      const second = await fault("observe-blocked"); for (const key of ["backendPid", "backendStartedAt", "queryStartedAt", "queryFingerprint", "holderPid"]) assert.equal(second[key], first[key]);
      assert.equal(posts.length, 1, "Pending keyboard repeats must not dispatch another Topic save.");
      if (cancel) assert.equal((await fault("cancel")).cancelledOneStatement, true);
      const release = await fault("release"); armed = false; assert.equal(release.ownedLockRolledBack, true); assert.equal(release.cancellationObserved, cancel);
      assertActionAcknowledged(await responsePromise); await expect(save()).toBeEnabled();
      await expect(form().locator('[data-admin-form-action="close"]')).toBeEnabled();
      return { sameNativeStatementObservedTwice: true, actionRequests: posts.length, normalKeyboardDedup: true, fieldsAndCloseDisabled: true, actualStatementCancelled: cancel, ownedLockReleased: true };
    } finally {
      page.off("request", onRequest);
      try { if (armed) await fault("release"); } finally { if (responsePromise) await Promise.allSettled([responsePromise]); }
    }
  }
  async function dirtyCloseCancel() {
    const close = form().locator('[data-admin-form-action="close"]'); await close.click();
    const dialog = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true }); await expect(dialog).toBeVisible();
    await dialog.locator("[data-admin-confirm-cancel]").click(); await expect(dialog).toHaveCount(0); await expect(close).toBeFocused();
  }
  for (const recipe of plan.recipes) await run("core-topic-controls-" + recipe.kind, [], async () => {
    currentRecipe=recipe;renderedAdoption=[];renderedPickerObserved=false;
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss(); page.on("dialog", leave);
    try { await observe("topic-controls-navigation", () => page.goto(origin + recipe.editPath, { waitUntil: "domcontentloaded" })); } finally { page.off("dialog", leave); }
    await expect(form()).toHaveCount(1); await checkpoint(recipe.kind, "baseline"); await tab("basic");
    await select("category_id", f.category.id); await select("series_id", f.series.id); await select("category_id", f.otherCategory.id); await expect(field("series_id")).toHaveValue("");
    await select("category_id", f.category.id); await select("series_id", f.series.id);
    for (const [name, value] of Object.entries(v.display)) { await checked(name, !value); await checked(name, value); }
    await imageControls("image", 1); await field("image_alt").fill(v.imageAlt);
    if (recipe.kind === "gallery") await galleryControls();
    else if (recipe.kind === "video") { await field("video_url").fill(v.videoUrl); await field("video_duration").fill(v.duration); await imageControls("video_thumbnail", 2); }
    else { const editor = form().locator('[data-topic-content-editor] [contenteditable="true"]'); await expect(editor).toHaveCount(1); await editor.fill(v.markdown); await expect(field("content")).toHaveValue(v.markdown); }
    if (["news", "site_update"].includes(recipe.kind)) await field("media_project").fill(v.mediaProject);
    if (recipe.kind === "article") await faqControls(); await publishControls(); await dirtyCloseCancel(); await assertDraft(recipe.kind);
    await checkpoint(recipe.kind, "draft"); await semanticNegative(recipe); await checkpoint(recipe.kind, "negative");
    const rejectedPending = await observe("topic-controls-native-rejection", () => saveWithNativePending(recipe, true));
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();
    await expect(field("title")).toHaveValue(recipe.title); await assertDraft(recipe.kind); await dirtyCloseCancel(); await checkpoint(recipe.kind, "serverRejected");
    const successfulPending = await observe("topic-controls-native-pending", () => saveWithNativePending(recipe, false));
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
    await expect(save()).toBeEnabled(); await checkpoint(recipe.kind, "saved");
    await page.reload({ waitUntil: "domcontentloaded" }); await tab("basic");
    // Canonical video normalization is expected only after persistence/reload.
    await assertDraft(recipe.kind, true);
    if (recipe.kind === "article") { await tab("faq"); const rows = form().locator("[data-faq-item]"); await expect(rows).toHaveCount(2); for (const [index, item] of [v.faq[1], v.faq[0]].entries()) { await expect(rows.nth(index).locator('[name="faq_question"]')).toHaveValue(item.question); await expect(rows.nth(index).locator('[name="faq_answer"]')).toHaveValue(item.answer); } }
    await expect(field("image")).toHaveValue(f.assets[1].publicUrl); await tab("publish"); await expect(field("status")).toHaveValue("unpublished");
    await checkpoint(recipe.kind, "reloaded");
    const result = { renderedAdoption, consumer: recipe.consumer, surface: recipe.surface, kind: recipe.kind, status: "pass", coverage: [], nativePhases: ["baseline", "draft", "negative", "serverRejected", "saved", "reloaded"], rejectedPending, successfulPending, currentControlsOnly: true, datePublicationPersistenceClaimed: false, managedReferencesClaimed: false }; completed.push(result); return result;
  });
  return { planned: plan.recipes.length, completed: completed.length, outcomes: completed, automaticAxisCoverage: [], globalClosed: false, explicitNonCapabilities: plan.explicitNonCapabilities, nativeFinalityRequired: true };
}

