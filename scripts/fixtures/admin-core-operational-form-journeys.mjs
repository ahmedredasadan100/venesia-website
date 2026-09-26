import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption,observeCoreModalCleanReturn,observeCoreModalPendingDismissal} from "./admin-core-rendered-adoption.mjs";
import assert from "node:assert/strict";
import {authorCoreTrackingMedia,assertCoreTrackingMediaUI} from "./admin-core-tracking-media-adoption.mjs";
import { runCoreFormPermissionIntent } from "./admin-core-domain-form-journeys.mjs";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

const families = {
  "redirects-create-edit": ["create", "edit"],
  "project-tracking-create-edit": ["tracking-profile", "stage-create", "stage-edit", "item-create", "item-edit", "update-create", "update-edit"],
  "users-create-edit": ["user-create", "user-edit"],
};

export function buildCoreOperationalFormPlan({ manifest, requiredCases, fixtures }) {
  const entries = Object.fromEntries(Object.entries(families).map(([id, surfaces]) => {
    const matches = manifest.filter(entry => entry.id === id);
    assert.equal(matches.length, 1, `Missing or ambiguous canonical operational Form ${id}.`);
    assert.deepEqual([...matches[0].surfaces].sort(), [...surfaces].sort(), `Unclassified operational Form surface ${id}.`);
    return [id, matches[0]];
  }));
  const tracking = fixtures.commandClosure?.tracking;
  assert.ok(Number.isSafeInteger(fixtures.project?.id) && fixtures.project.id > 0);
  assert.ok(tracking && [tracking.projectId, tracking.stage?.id, tracking.item?.id].every(id => Number.isSafeInteger(id) && id > 0));
  const coverage = (id, surfaces) => surfaces.flatMap(surface => {
    assert.ok(entries[id].surfaces.includes(surface));
    return ["save_reload", "failure_preserves_input", "retry"].map(scenario => {
      const matches = requiredCases.filter(row => row.boundary === "form" && row.consumer === id && row.surface === surface && row.scenario === scenario);
      assert.equal(matches.length, 1, `Missing or ambiguous named operational case ${id}/${surface}/${scenario}.`);
      return matches[0].key;
    });
  });
  const recipes = [
    { kind: "redirect", consumer: "redirects-create-edit", surfaces: families["redirects-create-edit"] },
    { kind: "profile", consumer: "project-tracking-create-edit", surfaces: ["tracking-profile"] },
    ...["stage", "item", "update"].map(kind => ({ kind, consumer: "project-tracking-create-edit", surfaces: [`${kind}-create`, `${kind}-edit`] })),
    { kind: "user", consumer: "users-create-edit", surfaces: families["users-create-edit"] },
  ].map(recipe => ({ ...recipe, coverage: coverage(recipe.consumer, recipe.surfaces) }));
  return { recipes, tracking, profileProjectId: fixtures.project.id };
}

export async function runCoreOperationalFormJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.ok(Array.isArray(databaseReadback));
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = buildCoreOperationalFormPlan({ manifest, requiredCases, fixtures });
  const suffix = Date.now().toString(36), results = [], permissionEvidence = [], dateEvidence = [];
  let renderedRecipe, renderedSurface, renderedAdoption=[], renderedOpened=new Set(), renderedDirty=new Set();
  const permissionIntent = (recipe, surface, perform) => runCoreFormPermissionIntent({ permissionReplay: ctx.permissionReplay, mapping: { caseId: "core-operational-" + recipe.kind + "-" + surface, formConsumer: recipe.consumer, surface }, perform, permissionEvidence });
  const form = () => page.locator("form[data-admin-form-runtime]");
  const input = name => form().locator(`[name="${name}"]`);
  const save = () => form().locator('button[type="submit"], [data-admin-users-edit-save]');
  const successful = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first();
  const row = label => page.getByRole("row").filter({ has: page.getByText(label, { exact: true }) });
  const proofBoundary = "Actual isolated current Form controls, structured rejection, preserved fields, retry and reload; joined native expectations required. Selected authored fields only; optional cookie-free HTTP permission receipts follow exact native save/audit proof. No complete capability-axis, UI denial, rollback, media-provider or optional child-field claim.";

  async function navigate(path) {
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss();
    page.on("dialog", leave);
    try { await observe("operational-form-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); }
    finally { page.off("dialog", leave); }
  }
  async function fill(values) {
    for (const [name, value] of Object.entries(values)) await input(name).fill(String(value));
  }
  async function equal(values) {
    for (const [name, value] of Object.entries(values)) await expect(input(name)).toHaveValue(String(value));
  }
  async function trackingDates(recipe, surface, values) {
    const fields = coreTrackingDateFields(recipe.kind), observations = [];
    const unrelated = Object.fromEntries(Object.entries(values).filter(([name]) => !fields.includes(name)));
    const privateUnrelated = () => form().evaluate((node, excluded) => [...new FormData(node).entries()].filter(([name]) => !excluded.includes(name)).map(([name,value]) => [name,typeof value === "string" ? value : {name:value.name,size:value.size,type:value.type}]), fields);
    const beforeUnrelated = await privateUnrelated();
    for (const name of fields) {
      const date = input(name), seed = name === "completion_date" ? "2026-01-06" : "2026-01-04";
      await expect(date).toHaveAttribute("data-admin-date-picker", ""); await expect(date).toHaveAttribute("type", "date"); await expect(date).toBeEnabled();
      await date.fill(seed); await date.focus(); await expect(date).toBeFocused();
      await date.press("ArrowUp"); await expect(date).not.toHaveValue(seed); const changed = await date.inputValue(); assert.match(changed, /^\d{4}-\d{2}-\d{2}$/u);
      await date.press("ArrowDown"); await expect(date).toHaveValue(seed);
      await date.press("ControlOrMeta+A"); await date.press("Backspace"); await expect(date).toHaveValue("");
      const required = await date.evaluate(node => node.required), clearValidity = await date.evaluate(node => ({ valid: node.validity.valid, valueMissing: node.validity.valueMissing }));
      assert.equal(required, name === "occurred_on"); assert.deepEqual(clearValidity, {valid: !required, valueMissing: required});
      await equal(unrelated); assert.deepEqual(await privateUnrelated(), beforeUnrelated, "Date interaction changed unrelated draft fields.");
      const value = values[name]; assert.equal(typeof value, "string"); if (value) await date.fill(value); await expect(date).toHaveValue(value);
      observations.push({field:name,type:"date",focused:true,seed,keyboardChanged:changed,keyboardRestored:seed,clearedValue:"",clearValidity,required,finalValue:value,unrelatedFieldsPreserved:true});
    }
    await equal(values); assert.deepEqual(await privateUnrelated(), beforeUnrelated, "Date repair changed unrelated draft fields.");
    const result = {caseId:"core-operational-"+recipe.kind+"-"+surface,surface,fields:observations,reloaded:false}; dateEvidence.push(result); return result;
  }
  function bindTrackingDates(proof) {
    const matches = permissionEvidence.filter(row => row.caseId === proof.caseId); assert.equal(matches.length, 1);
    proof.nativeSaveReceipt = matches[0].originalNativeSaveReceipt; proof.sourceSha256 = matches[0].sourceSha256; proof.ownedRunId = matches[0].ownedRunId;
    assert.equal(proof.reloaded, true); return proof;
  }
  async function select(name, value) {
    const label = (await input(name).locator(`option[value="${value}"]`).textContent()).trim();
    await form().locator(`[data-admin-form-listbox]:has(select[name="${name}"])`).getByRole("combobox").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(input(name)).toHaveValue(value);
  }
  const renderedBase=surface=>({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:"form",consumer:renderedRecipe.consumer,surface}]});
  async function observeOpenedForm(trigger,surface) {
    renderedSurface=surface;if(renderedOpened.has(surface))return;
    const current=form(),dialog=page.getByRole("dialog").filter({has:page.locator("form[data-admin-form-runtime]")});
    const prefix="operational-"+renderedRecipe.kind+"-"+surface,common=renderedBase(surface);
    renderedAdoption.push(await observeCoreModalCleanReturn({...common,id:prefix+"-return",dialog,form:current,trigger,cancel:current.getByRole("button",{name:"إلغاء",exact:true})}));
    renderedAdoption.push(await observeCoreModalFocusAdoption({...common,id:prefix+"-focus",dialog}));
    const body=dialog.locator(":scope > div").filter({has:page.locator("form[data-admin-form-runtime]")});
    renderedAdoption.push(await observeCoreScrollbarAdoption({...common,id:prefix+"-scroll",container:body,target:save(),axis:"y",containment:"modal-lock"}));
    renderedOpened.add(surface);
  }
  async function observePendingForm(surface) {
    const dialog=page.getByRole("dialog").filter({has:page.locator("form[data-admin-form-runtime]")});
    renderedAdoption.push(await observeCoreModalPendingDismissal({...renderedBase(surface),id:"operational-"+renderedRecipe.kind+"-"+surface+"-pending",dialog,form:form()}));
  }
  async function openCreate(path, label) {
    await navigate(path);
    const trigger = page.getByRole("button", { name: label, exact: true });
    // Empty lists may repeat the same create trigger in their empty state.
    await expect(trigger.first()).toBeVisible(); await trigger.first().click();
    await expect(form()).toHaveCount(1);
    await observeOpenedForm(trigger.first(),renderedRecipe.surfaces[0]);
  }
  async function openEdit(path, label) {
    await navigate(path + "?q=" + encodeURIComponent(label));
    await expect(row(label)).toHaveCount(1, { timeout: 60_000 });
    const id = Number(await row(label).locator('[data-admin-row-action="more"]').getAttribute("data-admin-entity-id"));
    assert.ok(Number.isSafeInteger(id) && id > 0);
    await row(label).locator('[data-admin-row-action="edit"] button').click();
    await expect(form()).toHaveCount(1);
    await observeOpenedForm(row(label).locator('[data-admin-row-action="edit"] button'),renderedRecipe.surfaces.at(-1));
    return id;
  }
  async function closeUnchanged() {
    await form().getByRole("button", { name: "إلغاء", exact: true }).click();
    await expect(form()).toHaveCount(0);
  }
  async function dirtyCancel(values) {
    await form().getByRole("button", { name: "إلغاء", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
    await expect(confirmation).toBeVisible();
    if(!renderedDirty.has(renderedSurface)){renderedAdoption.push(await observeCoreModalFocusAdoption({...renderedBase(renderedSurface),id:"operational-"+renderedRecipe.kind+"-"+renderedSurface+"-dirty-focus",dialog:confirmation,state:"dirty-confirmation",escape:"not-exercised"}));renderedDirty.add(renderedSurface);}
    await confirmation.locator("[data-admin-confirm-cancel]").click();
    await expect(confirmation).toHaveCount(0);
    await expect(form().getByRole("button", { name: "إلغاء", exact: true })).toBeFocused();
    await equal(values);
  }
  async function restoreDraft(recipe, surface, values, assertPrivate = null) {
    const retainedUrl = page.url();
    await ctx.permissionReplay.restoreDraft({
      mapping: { caseId: "core-operational-" + recipe.kind + "-" + surface, journeyId: "core-operational-" + recipe.kind + "-form-roundtrip", formConsumer: recipe.consumer, surface },
      form: form(), submit: save(),
      assertDraft: async () => { await equal(values); if (assertPrivate) await assertPrivate(); },
      cancelDirty: async () => { await dirtyCancel(values); assert.equal(page.url(), retainedUrl, "Dirty-close cancellation must retain the current Form URL."); },
      dirtyNavigation: "close",
      observePending:()=>observePendingForm(surface),
    });
  }

  async function acknowledge() {
    const [response] = await observe("operational-form-action", () => Promise.all([actionResponse(), save().click()]));
    assertActionAcknowledged(response);
  }
  async function rejectField(name, invalid, values, message = null) {
    await input(name).fill(invalid);
    await expect(input(name)).toHaveValue(invalid);
    await acknowledge();
    await observe("operational-form-rejected-preserved", async () => {
      const error = form().locator(`[id="${name}-error"]`);
      await expect(error).toBeVisible();
      if (message) await expect(error).toHaveText(message); else await expect(error).not.toHaveText("");
      await expect(save()).toBeEnabled(); await expect(input(name)).toHaveValue(invalid);
      await equal(Object.fromEntries(Object.entries(values).filter(([key]) => key !== name)));
    });
    await input(name).fill(String(values[name]));
  }
  async function accepted() {
    await acknowledge();
    await observe("operational-form-settled-save", async () => {
      await expect(successful()).toBeVisible({ timeout: 60_000 });
      await expect(form()).toHaveCount(0, { timeout: 60_000 });
    });
  }
  function audit(table, id, entity, action, label, expected, extra = {}) {
    const descriptor = { table, id, expected, auditEntityType: entity, auditActions: [action], ...(label ? { auditEntityLabel: label } : {}), ...extra };
    databaseReadback.push(descriptor); return descriptor;
  }
  function complete(recipe, ids, fields, extra = {}) {
    const result = { renderedAdoption, consumer: recipe.consumer, surfaces: recipe.surfaces, ids, fields,
      verified: ["structured_validation_rejection", "field_preservation", "dirty_close_cancel", "retry", "save_reload"], proofBoundary, ...extra };
    result.permissionEvidence = permissionEvidence.filter(row => row.formConsumer === recipe.consumer && recipe.surfaces.includes(row.surface));
    if (recipe.consumer === "project-tracking-create-edit") result.dateEvidence = dateEvidence.filter(row => recipe.surfaces.includes(row.surface)).map(bindTrackingDates);
    results.push(result); return result;
  }

  for (const recipe of plan.recipes) await run(`core-operational-${recipe.kind}-form-roundtrip`, recipe.coverage, async () => {
    renderedRecipe=recipe;renderedSurface=null;renderedAdoption=[];renderedOpened=new Set();renderedDirty=new Set();
    if (recipe.kind === "redirect") {
      const path = "/admin/seo/redirects", source = `/qa-core-redirect-${suffix}`;
      await openCreate(path, "إضافة تحويل");
      let values = { source_path: source, destination_path: `/qa-core-destination-${suffix}`, note: `QA redirect authored ${suffix}`, redirect_type: "302", status: "inactive" };
      await fill({ source_path: values.source_path, destination_path: values.destination_path, note: values.note });
      await select("redirect_type", values.redirect_type); await select("status", values.status);
      await dirtyCancel(values); await rejectField("source_path", "/admin/forbidden-core", values, "لا يمكن تحويل مسارات الإدارة أو النظام.");
      await restoreDraft(recipe, "create", values);
      const id = await permissionIntent(recipe, "create", async () => {
        await accepted(); const createdId = await openEdit(path, source); await equal(values);
        const descriptor = audit("url_redirects", createdId, "redirect", "redirect.create", source, {});
        return { value: createdId, nativeWrites: [{ ...descriptor, expected: { ...values } }] };
      });
      values = { ...values, destination_path: `/qa-core-edited-destination-${suffix}`, note: `QA redirect edited ${suffix}`, redirect_type: "301" };
      await fill({ destination_path: values.destination_path, note: values.note }); await select("redirect_type", values.redirect_type);
      await dirtyCancel(values); await rejectField("source_path", "/admin/forbidden-core", values, "لا يمكن تحويل مسارات الإدارة أو النظام.");
      await restoreDraft(recipe, "edit", values);
      await permissionIntent(recipe, "edit", async () => {
        await accepted(); await openEdit(path, source); await equal(values); await closeUnchanged();
        return { nativeWrites: [audit("url_redirects", id, "redirect", "redirect.update", source, values)] };
      });
      return complete(recipe, [id], Object.keys(values), { publication: "inactive" });
    }
    if (recipe.kind === "profile") {
      const projectId = plan.profileProjectId, path = `/admin/projects/${projectId}/tracking`;
      await openCreate(path, "تعديل بيانات الملف");
      const values = { contractor_name: `QA Core Contractor ${suffix}`, project_receipt_date: "2026-01-02", license_receipt_date: "" };
      await fill(values); const dates = await trackingDates(recipe, "tracking-profile", values); await dirtyCancel(values);
      // A five-digit year is valid in the real native date control but is
      // rejected by this Domain's existing four-digit server date contract.
      await rejectField("project_receipt_date", "10000-01-01", values);
      await restoreDraft(recipe, "tracking-profile", values);
      await permissionIntent(recipe, "tracking-profile", async () => {
        await accepted(); await openCreate(path, "تعديل بيانات الملف"); await equal(values); dates.reloaded = true; await closeUnchanged();
        return { nativeWrites: [audit("project_tracking_profiles", projectId, "project_tracking_profile", "project_children.update", null, { ...values, license_receipt_date: null })] };
      });
      return complete(recipe, [projectId], Object.keys(values), { rejection: "native_date_value_rejected_by_existing_server_contract" });
    }
    if (["stage", "item", "update"].includes(recipe.kind)) {
      const kind = recipe.kind, parent = plan.tracking;
      const config = {
        stage: { path: `/admin/projects/${parent.projectId}/tracking`, trigger: "إضافة مرحلة", labelField: "name", error: "اسم المرحلة مطلوب.", table: "project_tracking_stages", entity: "project_tracking_stage" },
        item: { path: `/admin/projects/${parent.projectId}/tracking/stages/${parent.stage.id}`, trigger: "إضافة بند", labelField: "name", error: "اسم البند مطلوب.", table: "project_tracking_items", entity: "project_tracking_item" },
        update: { path: `/admin/projects/${parent.projectId}/tracking/items/${parent.item.id}`, trigger: "إضافة تحديث", labelField: "title", error: "عنوان التحديث مطلوب.", table: "project_tracking_updates", entity: "project_tracking_update" },
      }[kind];
      const createdLabel = `QA Core ${kind} ${suffix}`, editedLabel = `QA Core ${kind} edited ${suffix}`;
      await openCreate(config.path, config.trigger);
      let values = kind === "update" ? { title: createdLabel, body: `QA authored update body ${suffix}`, occurred_on: "2026-01-04" }
        : { name: createdLabel, description: `QA authored ${kind} description ${suffix}`, start_date: "2026-01-02", ...(kind === "item" ? {completion_date:""} : {}) };
      await fill(values);
      if (kind === "stage") { await input("planned_duration_value").fill("3"); await select("planned_duration_unit", "week"); values = { ...values, planned_duration_value: "3", planned_duration_unit: "week" }; }
      if (kind === "item") { await select("status", "in_progress"); values.status = "in_progress"; }
      const nativeValues = values => kind === "stage" ? { ...values, start_date: values.start_date || null, planned_duration_value: 3, project_id: parent.projectId, is_visible: true }
        : kind === "item" ? { ...values, start_date: values.start_date || null, completion_date: values.completion_date || null, stage_id: parent.stage.id, is_visible: true }
          : { title: values.title, body: values.body, item_id: parent.item.id, occurred_at: values.occurred_on + "T12:00:00Z", publication_status: "draft" };
      const createMedia=kind==="update"?await authorCoreTrackingMedia({page,origin,form:form(),phase:"create"}):null;
      const createDates = await trackingDates(recipe, kind + "-create", values);
      await dirtyCancel(values); await rejectField(config.labelField, "", values, config.error);
      await restoreDraft(recipe, kind + "-create", values,createMedia?()=>assertCoreTrackingMediaUI(form(),createMedia):null);
      const id = await permissionIntent(recipe, kind + "-create", async () => {
        await accepted(); const createdId = await openEdit(config.path, createdLabel); await equal(values); createDates.reloaded = true; if(createMedia){await assertCoreTrackingMediaUI(form(),createMedia);createMedia.reloaded=true;}
        const descriptor = audit(config.table, createdId, config.entity, "project_children.create", createdLabel, {});
        return { value: createdId, nativeWrites: [{ ...descriptor, expected: nativeValues(values),...(createMedia?{expectedTrackingMedia:createMedia.expectedMedia,auditMetadata:{media_count:createMedia.expectedMedia.length}}:{}) }] };
      });
      values = { ...values, [config.labelField]: editedLabel,
        ...(kind === "update" ? { body: `QA edited update body ${suffix}`, occurred_on: "2026-01-05" } : { description: `QA edited ${kind} description ${suffix}`, start_date: "" }) };
      await fill(kind === "update" ? { title: values.title, body: values.body } : { name: values.name, description: values.description });
      const editMedia=kind==="update"?await authorCoreTrackingMedia({page,origin,form:form(),phase:"edit",prior:createMedia}):null;
      const editDates = await trackingDates(recipe, kind + "-edit", values);
      await dirtyCancel(values); await rejectField(config.labelField, "", values, config.error);
      const expected = nativeValues(values);
      await restoreDraft(recipe, kind + "-edit", values,editMedia?()=>assertCoreTrackingMediaUI(form(),editMedia):null);
      await permissionIntent(recipe, kind + "-edit", async () => {
        await accepted(); assert.equal(await openEdit(config.path, editedLabel), id); await equal(values); editDates.reloaded = true; if(editMedia){await assertCoreTrackingMediaUI(form(),editMedia);editMedia.reloaded=true;} await closeUnchanged();
        return { nativeWrites: [audit(config.table, id, config.entity, "project_children.update", editedLabel, expected,editMedia?{expectedTrackingMedia:editMedia.expectedMedia,auditMetadata:{media_count:editMedia.expectedMedia.length}}:{})] };
      });
      return complete(recipe, [id], Object.keys(expected), { ...(kind === "update" ? {mediaEvidence:[createMedia,editMedia],mediaBoundary:"Actual local Catalog images and externally addressed video metadata only; native child identity/order/removal joined to original accepted saves. No Storage writes or external video availability claim."} : {}) });
    }
    assert.equal(recipe.kind, "user");
    const path = "/admin/users-roles", username = `qa.core.${suffix}`, password = `Qa!${randomUUID()}`;
    await openCreate(path, "إضافة مستخدم");
    let values = { username, email: `${username}@example.invalid`, full_name: `QA Core User ${suffix}` };
    await fill(values); await input("password").fill(password); await input("confirmPassword").fill(password);
    await dirtyCancel(values); await rejectField("username", "", values, "هذا الحقل مطلوب");
    // No credential string is included in an assertion diff, return value,
    // database expectation, stage name or receipt.
    assert.ok((await input("password").inputValue()) === password, "Private password must survive rejection.");
    assert.ok((await input("confirmPassword").inputValue()) === password, "Private password confirmation must survive rejection.");
    await restoreDraft(recipe, "user-create", values, async () => {
      assert.ok((await input("password").inputValue()) === password, "Private User create password must survive draft restoration.");
      assert.ok((await input("confirmPassword").inputValue()) === password, "Private User create confirmation must survive draft restoration.");
    });
    const id = await permissionIntent(recipe, "user-create", async () => {
      await accepted(); const createdId = await openEdit(path, username); await equal(values);
      const descriptor = audit("admin_users", createdId, "admin_user", "admin_user.created", username, {});
      return { value: createdId, nativeWrites: [{ ...descriptor, expected: { ...values, role: "admin", is_active: true } }] };
    });
    await expect(input("password")).toHaveValue(""); await expect(input("confirmPassword")).toHaveValue("");
    values = { ...values, full_name: `QA Core User edited ${suffix}` };
    await input("full_name").fill(values.full_name); await dirtyCancel(values);
    await rejectField("username", "", values, "اسم المستخدم مطلوب.");
    await restoreDraft(recipe, "user-edit", values, async () => {
      assert.ok((await input("password").inputValue()) === "", "Private User edit password must survive draft restoration.");
      assert.ok((await input("confirmPassword").inputValue()) === "", "Private User edit confirmation must survive draft restoration.");
    });
    await permissionIntent(recipe, "user-edit", async () => {
      await accepted(); assert.equal(await openEdit(path, username), id); await equal(values); await closeUnchanged();
      return { nativeWrites: [audit("admin_users", id, "admin_user", "admin_user.updated", username, { ...values, role: "admin", is_active: true })] };
    });
    return complete(recipe, [id], Object.keys(values), { credentialBoundary: "Generated solely in private process memory; no credential artifact or password/hash readback. Separate existing command cohort owns synthetic status/delete." });
  });

  await run("core-operational-user-current-identity-protection", [], async () => {
    renderedRecipe={kind:"identity",consumer:"users-and-roles",surfaces:["identity-collection"]};renderedAdoption=[];renderedOpened=new Set();renderedDirty=new Set();
    await navigate("/admin/users-roles");
    const identity = page.locator("p").filter({ hasText: /^المستخدم الحالي:/u });
    await expect(identity).toHaveCount(1);
    const currentName = (await identity.locator("span").textContent()).trim(); assert.ok(currentName);
    await navigate("/admin/users-roles?q=" + encodeURIComponent(currentName));
    await expect(row(currentName)).toHaveCount(1);
    const more = row(currentName).locator('[data-admin-row-action="more"]');
    const selfId = await more.getAttribute("data-admin-entity-id"); assert.match(selfId, /^[1-9][0-9]*$/u);
    await more.getByRole("button").click();
    const menu = page.locator('[data-admin-row-actions-menu][data-admin-entity-type="admin_user"][data-admin-entity-id="' + selfId + '"]');
    await expect(menu).toBeVisible();
    for (const [kind, reason] of [["visibility", "لا يمكنك تعطيل حسابك الحالي."], ["delete", "لا يمكنك حذف حسابك الحالي."]]) {
      const command = menu.locator('[data-admin-row-action-menu-item="' + kind + '"]');
      await expect(command).toBeDisabled(); await expect(command).toHaveAttribute("title", reason);
    }
    await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0); await expect(more.getByRole("button")).toBeFocused();
    await row(currentName).locator('[data-admin-row-action="edit"] button').click();
    await observeOpenedForm(row(currentName).locator('[data-admin-row-action="edit"] button'),"identity-collection");
    await expect(form().locator("#admin-user-self-status")).toHaveText("لا يمكنك تعطيل حسابك الحالي من هنا.");
    await expect(form().getByRole("switch")).toBeDisabled();
    await expect(input("password")).toHaveCount(0); await expect(input("confirmPassword")).toHaveCount(0);
    await closeUnchanged();
    return { renderedAdoption, consumer: "users-and-roles", surface: "identity-collection", verified: ["current_user_visibility_disabled", "current_user_delete_disabled", "current_user_edit_status_disabled", "self_password_controls_absent"], proofBoundary: "Read-only current authenticated synthetic identity UI restrictions; no denied server-command or complete Auth capability claim." };
  });
  return { planned: plan.recipes.length, completed: results.length, results, permissionEvidence, permissionCandidateKeys: permissionEvidence.map(row => row.candidateRequiredCase) };
}

/** Fixed test field inventory, source-checked against the canonical TrackingForms owner. */
export function coreTrackingDateFields(kind) {
  const fields = {profile:["project_receipt_date","license_receipt_date"],stage:["start_date"],item:["start_date","completion_date"],update:["occurred_on"]}[kind];
  assert.ok(fields, "Unknown Tracking date recipe."); return [...fields];
}

/** Pure receipt join: actual seven accepted saves plus exact child observations; no new runtime or inferred axis credit. */
export function assertCoreTrackingDateReceipts({browser,native,ownedRunId,sourceSha256,actorId,fixtures,formManifest,collectionManifest}) {
  assert.equal(browser.status,"pass"); assert.equal(browser.driverCompleted,true); assert.equal(browser.inventoryOnly,false); assert.equal(browser.scope,"core-closure"); assert.equal(browser.cohort,"domain-forms"); assert.ok(browser.journeySelection==null); assert.deepEqual(browser.errors,[]);
  assert.match(sourceSha256,/^[a-f0-9]{64}$/u); assert.equal(browser.sourceSha256,sourceSha256); assert.equal(native.status,"pass"); assert.equal(native.ownedRunId,ownedRunId); assert.ok(Number.isSafeInteger(actorId)&&actorId>0);
  const consumer="project-tracking-create-edit", entries=formManifest.filter(row=>row.id===consumer); assert.equal(entries.length,1);
  assert.deepEqual(entries[0].surfaces,families[consumer]); assert.ok(entries[0].sourceFiles.includes("src/components/admin/projects/tracking/TrackingForms.tsx"));
  const declarations=collectionManifest.surfaces.flatMap(row=>row.consumerAdoptionEvidence?.length?row.consumerAdoptionEvidence:[row]);
  const allRecords=native.records; assert.ok(Array.isArray(allRecords)); assert.equal(new Set(allRecords.map(row=>row.id)).size,allRecords.length);
  const claim=(id)=>{const matches=allRecords.filter(row=>row.id===id);assert.equal(matches.length,1);return matches[0];};
  const qualified=[],used=[];
  for(const kind of ["profile","stage","item","update"]){
    const expectedSurfaces=kind==="profile"?["tracking-profile"]:[kind+"-create",kind+"-edit"],journeyId="core-operational-"+kind+"-form-roundtrip";
    const matches=browser.evidence.filter(row=>row.id===journeyId);assert.equal(matches.length,1);const result=matches[0];assert.equal(result.status,"pass");assert.equal(result.consumer,consumer);assert.deepEqual(result.surfaces,expectedSurfaces);assert.equal(result.ids.length,1);const id=result.ids[0];assert.ok(Number.isSafeInteger(id)&&id>0);if(kind==="profile")assert.equal(id,fixtures.project.id);
    assert.deepEqual(result.dateEvidence.map(row=>row.surface),expectedSurfaces);assert.deepEqual(result.permissionEvidence.map(row=>row.surface),expectedSurfaces);
    for(const proof of result.dateEvidence){
      const caseId="core-operational-"+kind+"-"+proof.surface;assert.equal(proof.caseId,caseId);assert.equal(proof.sourceSha256,sourceSha256);assert.equal(proof.ownedRunId,ownedRunId);assert.equal(proof.reloaded,true);
      const permissions=result.permissionEvidence.filter(row=>row.caseId===caseId);assert.equal(permissions.length,1);const permission=permissions[0];
      for(const[key,value]of Object.entries({status:"pass",caseId,formConsumer:consumer,surface:proof.surface,sourceSha256,ownedRunId,originalUiSuccessVerified:true,originalNativeSaveVerified:true,originalProjectionCount:1}))assert.equal(permission[key],value);
      assert.equal(permission.originalNativeSaveReceipt,proof.nativeSaveReceipt);const saved=claim(proof.nativeSaveReceipt);used.push(saved.id);
      for(const[key,value]of Object.entries({kind:"form-save-native",caseId,formConsumer:consumer,surface:proof.surface,status:"partial-not-global-pass",globalClosed:false}))assert.equal(saved[key],value);
      assert.equal(saved.writes.length,1);const write=saved.writes[0],table="project_tracking_"+({profile:"profiles",stage:"stages",item:"items",update:"updates"}[kind]);assert.equal(write.table,table);assert.equal(write.id,id);assert.equal(write.deleted,false);assert.equal(write.expectedActorId,actorId);assert.deepEqual(write.json,[]);
      const action=proof.surface.endsWith("-create")?"project_children.create":"project_children.update";assert.equal(write.audit.length,1);const audit=write.audit[0];assert.equal(audit.action,action);assert.equal(audit.entity_type,"project_tracking_"+kind);assert.equal(Number(audit.entity_id),id);assert.equal(Number(audit.actor_admin_user_id),actorId);
      if(kind!=="profile")assert.equal(audit.entity_label,write.actual[kind==="update"?"title":"name"]);
      assert.deepEqual(proof.fields.map(row=>row.field),coreTrackingDateFields(kind));
      for(const field of proof.fields){
        assert.equal(field.type,"date");assert.equal(field.focused,true);assert.equal(field.seed,field.field==="completion_date"?"2026-01-06":"2026-01-04");assert.match(field.keyboardChanged,/^\d{4}-\d{2}-\d{2}$/u);assert.notEqual(field.keyboardChanged,field.seed);assert.equal(field.keyboardRestored,field.seed);assert.equal(field.clearedValue,"");assert.equal(field.unrelatedFieldsPreserved,true);
        const required=field.field==="occurred_on";assert.equal(field.required,required);assert.deepEqual(field.clearValidity,{valid:!required,valueMissing:required});
        const expected=kind==="profile"?(field.field==="project_receipt_date"?"2026-01-02":""):kind==="update"?(proof.surface==="update-create"?"2026-01-04":"2026-01-05"):field.field==="completion_date"||proof.surface.endsWith("-edit")?"":"2026-01-02";
        assert.equal(field.finalValue,expected);const key=required?"occurred_at":field.field;assert.ok(Object.hasOwn(write.actual,key));
        if(required){assert.equal(typeof write.actual[key],"string");assert.ok(Number.isFinite(Date.parse(write.actual[key])));assert.equal(Date.parse(write.actual[key]),Date.parse(expected+"T12:00:00Z"));}else assert.equal(write.actual[key],expected||null);
      }
      if(kind==="item")assert.equal(write.actual.status,"in_progress");
      qualified.push({journeyId,caseId,surface:proof.surface,nativeId:saved.id,actorId,ownedRunId,sourceSha256,fields:proof.fields.map(row=>row.field),automaticCoverage:[]});
    }
  }
  assert.equal(new Set(used).size,used.length);const nativeTracking=allRecords.filter(row=>row.kind==="form-save-native"&&row.formConsumer===consumer);assert.deepEqual(nativeTracking.map(row=>row.id),used,"No missing, duplicate, foreign or orphan Tracking save receipt.");
  const formCells=browser.requiredCases.filter(row=>row.key===`form:${consumer}:capability:date_picker`);assert.equal(formCells.length,1);
  const aliases=["stage","item","update"].map(kind=>{const id="project-tracking-"+({stage:"stages",item:"items",update:"updates"}[kind]),matches=declarations.filter(row=>row.id===id);assert.equal(matches.length,1);assert.ok(matches[0].executableBindings.some(row=>row.sourceFile==="src/components/admin/projects/tracking/TrackingCollections.tsx"&&row.exportNames.includes("Tracking"+({stage:"Stages",item:"Items",update:"Updates"}[kind])+"Collection")));const cells=browser.requiredCases.filter(row=>row.key===`collection:${id}:capability:date_picker`);assert.equal(cells.length,1);return {candidateRequiredCase:cells[0].key,childFormConsumer:consumer,childSurfaces:[kind+"-create",kind+"-edit"],nativeIds:qualified.filter(row=>row.surface.startsWith(kind+"-")).map(row=>row.nativeId)};});
  return {status:"pass",qualified,aliases,candidateRequiredCases:[formCells[0].key,...aliases.map(row=>row.candidateRequiredCase)],automaticCoverage:[],globalClosed:false,boundary:"Focused native date keyboard/change/clear and exact saved scalar or Tracking instant only; aliases bind their actual child Form, no full capability-axis or calendar-popup claim."};
}
