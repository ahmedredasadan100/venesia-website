import assert from "node:assert/strict";
import { observeCoreScrollbarAdoption, observeCoreModalFocusAdoption, observeCoreModalPendingDismissal, observeCoreModalCleanReturn } from "./admin-core-rendered-adoption.mjs";
import { observeCoreAcceptedFormFeedback, runCoreFormPermissionIntent, validateCoreJourneySelection, observeCoreControlDraft, observeCoreBooleanControl, observeCoreListboxControl, acceptCoreControlSave } from "./admin-core-domain-form-journeys.mjs";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

// Verification recipes, not a Product capability registry. Resolve every kind
// against the authoritative Form manifest before any browser interaction.
const recipes = {
  content: { table: "content_block_templates", fields: [["title", ["title"]], ["body", ["body"]]] },
  hero: { table: "hero_templates", fields: [["title", ["title"]], ["subtitle", ["subtitle"]]] },
  breadcrumb: { table: "breadcrumb_block_templates", fields: [["current_label_override", ["currentLabelOverride"]]] },
  cards: { table: "cards_block_templates", fields: [["title", ["title"]], ["item_0_title", ["items", "0", "title"]], ["item_0_body", ["items", "0", "body"]]] },
  cta: { table: "cta_block_templates", fields: [["title", ["title"]], ["description", ["description"]]] },
  feed: { table: "feed_module_templates", fields: [["widget_title", ["presentation", "title"]], ["eyebrow", ["presentation", "eyebrow"]]] },
  featured: { table: "featured_module_templates", tab: "presentation", fields: [["title", ["presentation", "title"]], ["presentation_description", ["presentation", "description"]]] },
  "media-sidebar": { table: "media_sidebar_module_templates", fields: [["limit", ["limit"], 7]] },
  "media-hub": { table: "media_hub_module_templates", fields: [["title", ["presentation", "title"]], ["presentation_description", ["presentation", "description"]]] },
};

export const CORE_TEMPLATE_FORM_CREATES_SELECTION = "template-form-creates";
export const CORE_TEMPLATE_FORM_CREATES_FOLLOWUP_SELECTION = "template-form-creates-followup";
export function isCoreTemplateCreateSelection(selection) { return selection === CORE_TEMPLATE_FORM_CREATES_SELECTION || selection === CORE_TEMPLATE_FORM_CREATES_FOLLOWUP_SELECTION; }
export function selectCoreTemplateCreateRecipes(creates, selection) {
  assert.ok(isCoreTemplateCreateSelection(selection));
  if (selection === CORE_TEMPLATE_FORM_CREATES_SELECTION) return creates;
  const kinds = Object.keys(recipes).filter(kind => !["media-sidebar", "media-hub"].includes(kind));
  assert.deepEqual(creates.map(row => row.kind).sort(), [...kinds].sort(), "Follow-up requires the complete canonical create plan before selection.");
  return creates.filter(row => ["content", "breadcrumb", "cards", "featured"].includes(row.kind));
}
export function coreTemplateCreateJourneyId(recipe) { return `core-template-${recipe.kind}-create-reject-retry`; }
export function coreSelectedTemplateCreates(manifest, selection = CORE_TEMPLATE_FORM_CREATES_SELECTION) {
  const entries = manifest.filter(entry => entry.id === "block-template-create-modals"); assert.equal(entries.length, 1);
  const entry = entries[0], kinds = Object.keys(recipes).filter(kind => !["media-sidebar", "media-hub"].includes(kind));
  assert.deepEqual([...entry.surfaces].sort(), kinds.map(kind => `${kind}:create`).sort(), "Selection must match all current declared quick-create surfaces exactly.");
  return selectCoreTemplateCreateRecipes(entry.surfaces.map(surface => { const kind = surface.split(":")[0]; return { entry, kind, surface, ...recipes[kind] }; }), selection);
}
export function selectCoreTemplateFormPlan(plan, selection) {
  if (selection === null || selection === undefined) return plan;
  validateCoreJourneySelection({ scope: "core-closure", cohort: "recovery-templates", selection });
  assert.ok(isCoreTemplateCreateSelection(selection));
  return { ...plan, editors: [], creates: selectCoreTemplateCreateRecipes(plan.creates, selection) };
}
/** Fixed selection never changes the canonical universe or promotes an unexecuted editor/recovery. */
/**
 * @param {{globalClosed:boolean,automaticCoverage:unknown[],qualified:Array<{journeyId:string,nativeBefore:string,nativeAfter:string,acceptedDiscard?:{nativeBefore:string,nativeAfter:string}}>}|null} draftRestoration
 * @param {{native:{status:string,ownedRunId:string,records:Array<object>},ownedRunId:string,sourceSha256:string,expectedActorId:number}|null} nativeContext
 */
export function assertCoreTemplateSelectionReceipt(browser, manifest, canonicalRequiredCases, draftRestoration = null, nativeContext = null) {
  assert.ok(isCoreTemplateCreateSelection(validateCoreJourneySelection({ scope: browser.scope, cohort: browser.cohort, selection: browser.journeySelection })));
  const identities = rows => {
    assert.ok(Array.isArray(rows) && rows.length > 0); assert.ok(rows.every(row => typeof row.key === "string" && row.key.length > 0));
    assert.equal(new Set(rows.map(row => row.key)).size, rows.length);
    return rows.map(row => { const identity = { ...row }; delete identity.status; delete identity.evidence; return identity; }).sort((a,b) => a.key.localeCompare(b.key));
  };
  assert.deepEqual(identities(browser.requiredCases), identities(canonicalRequiredCases));
  const selected = coreSelectedTemplateCreates(manifest, browser.journeySelection), ids = selected.map(coreTemplateCreateJourneyId), allowed = new Set();
  assert.equal(browser.status, "pass"); assert.equal(browser.driverCompleted, true); assert.equal(browser.inventoryOnly, false); assert.deepEqual(browser.errors, []);
  assert.equal(browser.globalClosed, false); assert.equal(browser.wholeCohortExecuted, false);
  assert.deepEqual(browser.selectedJourneyIds, ids); assert.deepEqual(browser.executedJourneyIds, ids);
  assert.deepEqual(browser.evidence.map(row => row.id), ["existing-auth-login", ...ids]); assert.ok(browser.evidence.every(row => row.status === "pass"));
  assert.deepEqual(browser.evidence[0].coverage, []);
  assert.equal(browser.evidence[0].authenticated, true); assert.equal(browser.evidence[0].sessionArtifactWritten, false);
  assert.match(browser.evidence[0].dashboardState, /^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
  const physical = new Set();
  for (const [index, recipe] of selected.entries()) {
    const row = browser.evidence[index+1]; assert.equal(row.kind, recipe.kind); assert.equal(row.consumer, recipe.entry.id); assert.equal(row.surface, recipe.surface);
    assert.ok(Number.isSafeInteger(row.entityId) && row.entityId > 0);
    const identity = `${recipe.table}:${row.entityId}`; assert.equal(physical.has(identity), false); physical.add(identity);
    for (const key of ["createInputPreserved","createRetryHandoff","createDirtyCloseCancel","metadataReloadVerified","retrySaved"]) assert.equal(row[key], true);
    assert.equal(row.createServerValidation, "trimmed_required_name");
    assert.deepEqual(row.authoredConfigReloadVerified, recipe.fields.map(field => field[1]));
    const keys = ["save_reload","failure_preserves_input","retry"].map(scenario => {
      const cells = browser.requiredCases.filter(cell => cell.boundary === "form" && cell.consumer === recipe.entry.id && cell.surface === recipe.surface && cell.scenario === scenario);
      assert.equal(cells.length, 1); assert.equal(cells[0].status, "behavior_verified"); assert.equal(cells[0].evidence, ids[index]); allowed.add(cells[0].key); return cells[0].key;
    }); assert.deepEqual(row.coverage, keys);
    const writes = browser.databaseReadback.filter(write => write.table === recipe.table && write.id === row.entityId); assert.equal(writes.length, 2);
    assert.ok(writes.every(write => write.auditEntityType === "content_block_template"));
    assert.deepEqual(writes.map(write => write.auditActions), [["content_block_template.create"],["content_block_template.update"]]);
    assert.deepEqual(writes[0].expected, {}); assert.deepEqual(writes[0].expectedJson, []);
    assert.equal(typeof writes[0].auditEntityLabel, "string"); assert.ok(writes[0].auditEntityLabel.trim());
    assert.equal(writes[1].expected.name, `${writes[0].auditEntityLabel} saved`); assert.equal(writes[1].auditEntityLabel, writes[1].expected.name);
    assert.deepEqual(writes[1].expectedJson.map(p => ({ column:p.column,path:p.path })), recipe.fields.map(field => ({column:"config",path:field[1]})));
    assert.ok(writes[1].expectedJson.every(p => typeof p.value === "string" && p.value.trim()));
    for (const write of writes) if (recipe.kind !== "content") assert.equal(write.auditMetadata.blockType, recipe.kind);
  }
  assert.equal(browser.databaseReadback.length, selected.length*2);
  for (const cell of browser.requiredCases) if (!allowed.has(cell.key)) { assert.equal(cell.status, "open"); assert.equal(cell.evidence, null); }
  if (draftRestoration !== null) {
    assert.equal(draftRestoration.globalClosed, false); assert.deepEqual(draftRestoration.automaticCoverage, []);
    assert.deepEqual(draftRestoration.qualified.map(row => row.journeyId), ids);
  }
  if (nativeContext !== null) {
    assert.ok(draftRestoration); const { native, ownedRunId, sourceSha256, expectedActorId } = nativeContext;
    assert.equal(native.status,"pass"); assert.equal(native.ownedRunId,ownedRunId); assert.ok(typeof ownedRunId === "string" && ownedRunId);
    assert.match(sourceSha256,/^[a-f0-9]{64}$/u); assert.equal(browser.sourceSha256,sourceSha256); assert.ok(Number.isSafeInteger(expectedActorId) && expectedActorId>0);
    assert.equal(new Set(native.records.map(row=>row.id)).size,native.records.length); const claimed=new Set();
    const claim=(id,kind)=>{ assert.equal(typeof id,"string"); assert.equal(claimed.has(id),false); const matches=native.records.filter(row=>row.id===id); assert.equal(matches.length,1); assert.equal(matches[0].kind,kind); claimed.add(id); return matches[0]; };
    for (const proof of draftRestoration.qualified) { claim(proof.nativeBefore,"form-permission-fingerprint"); claim(proof.nativeAfter,"form-permission-fingerprint"); if(proof.acceptedDiscard){claim(proof.acceptedDiscard.nativeBefore,"form-permission-fingerprint");claim(proof.acceptedDiscard.nativeAfter,"form-permission-fingerprint");} }
    for (const [index, recipe] of selected.entries()) {
      const row=browser.evidence[index+1], proofs=row.permissionEvidence; assert.equal(proofs.length,1); const proof=proofs[0];
      assert.equal(proof.status,"pass"); assert.equal(proof.caseId,ids[index]); assert.equal(proof.formConsumer,recipe.entry.id); assert.equal(proof.surface,recipe.surface);
      const permissionCells=browser.requiredCases.filter(cell=>cell.boundary==="form"&&cell.consumer===recipe.entry.id&&cell.surface===recipe.surface&&cell.scenario==="permission_denied"); assert.equal(permissionCells.length,1); assert.equal(proof.candidateRequiredCase,permissionCells[0].key);
      assert.equal(proof.sourceSha256,sourceSha256); assert.equal(proof.ownedRunId,ownedRunId); assert.equal(proof.originalProjectionCount,1);
      for(const key of ["originalUiSuccessVerified","originalNativeSaveVerified","replayCookieFree","publicDomainAuditDependentsUnchanged"])assert.equal(proof[key],true);
      assert.equal(proof.replayCount,1); assert.equal(proof.replayRedirectsFollowed,0); assert.deepEqual(proof.automaticCoverage,[]); assert.equal(proof.bodyOrCookieArtifactsWritten,false);
      assert.equal(proof.routePathname, `/admin/pages-blocks/blocks/${recipe.kind}`); assert.match(proof.actionSha256,/^[a-f0-9]{64}$/u);
      assert.ok(Number.isSafeInteger(proof.originalActionHttpStatus) && proof.originalActionHttpStatus >= 200 && proof.originalActionHttpStatus < 400);
      assert.equal(proof.denial.actionBodyExecutionProven,false);
      if(proof.denial.kind === "http-unauthorized") {
        assert.equal(proof.denial.httpStatus,401); assert.equal(proof.denial.enforcementLayer,"not-determined-by-http"); assert.equal(Object.hasOwn(proof.denial,"destination"),false);
      } else {
        assert.equal(proof.denial.kind,"owned-admin-login-denial"); assert.ok([200,301,302,303,307,308].includes(proof.denial.httpStatus));
        assert.equal(proof.denial.destination,"/admin/login"); assert.equal(proof.denial.enforcementLayer,"admin-http-boundary-proxy-or-action-redirect");
      }
      const save=claim(proof.originalNativeSaveReceipt,"form-save-native"); assert.ok(native.records.findIndex(record=>record.id===draftRestoration.qualified[index].nativeAfter)<native.records.indexOf(save)); assert.equal(save.status,"partial-not-global-pass"); assert.equal(save.globalClosed,false);
      for(const key of ["caseId","formConsumer","surface"])assert.equal(save[key],proof[key]); assert.equal(save.writes.length,1);
      const write=save.writes[0]; assert.equal(write.table,recipe.table); assert.equal(write.id,row.entityId); assert.equal(write.deleted,false); assert.equal(write.expectedActorId,expectedActorId);
      const expected=browser.databaseReadback.find(item=>item.table===recipe.table&&item.id===row.entityId); assert.equal(write.actual.name,expected.auditEntityLabel);
      assert.deepEqual(Object.keys(write.actual).sort(),(recipe.kind==="breadcrumb"?["name"]:["name","slug"]).sort());
      if(recipe.kind!=="breadcrumb") { assert.equal(typeof write.actual.slug,"string"); assert.ok(write.actual.slug.trim()); }
      const createFields=recipe.fields.filter(([name])=>recipe.kind==="feed"?name==="widget_title":recipe.kind==="cards"?["item_0_title","item_0_body"].includes(name):false);
      assert.deepEqual(write.json.map(p=>({column:p.column,path:p.path})),createFields.map(field=>({column:"config",path:field[1]}))); assert.ok(write.json.every(p=>typeof p.actual==="string"&&p.actual.trim()));
      assert.ok(write.audit.length>0); for(const audit of write.audit){assert.equal(Number(audit.actor_admin_user_id),expectedActorId);assert.equal(audit.entity_type,"content_block_template");assert.equal(Number(audit.entity_id),row.entityId);}
      assert.ok(write.audit.some(audit=>audit.action==="content_block_template.create"&&audit.entity_label===write.actual.name));
      const before=claim(proof.nativeBefore,"form-permission-fingerprint"),after=claim(proof.nativeAfter,"form-permission-fingerprint");
      assert.equal(before.phase,"before"); assert.equal(after.phase,"after"); assert.equal(before.correlationId,after.correlationId);
      for(const value of [before,after]){assert.equal(value.status,"pass");assert.equal(value.ownedRunId,ownedRunId);assert.equal(value.adminAuditIncluded,true);assert.equal(value.adminUsersIncluded,true);assert.ok(value.publicTableCount>0);for(const key of ["publicTableInventorySha256","publicDataSha256"])assert.match(value[key],/^[a-f0-9]{64}$/u);}
      for(const key of ["publicTableCount","publicTableInventorySha256","publicDataSha256"])assert.equal(before[key],after[key]);
      assert.ok(native.records.indexOf(save)<native.records.indexOf(before)); assert.ok(native.records.indexOf(before)<native.records.indexOf(after));
    }
    assert.equal(claimed.size,native.records.length,"No recovery, unrelated or unjoined native checkpoint may be borrowed by this selection.");
  }
  return {selection:browser.journeySelection,selectedJourneyIds:ids,executedJourneyIds:[...browser.executedJourneyIds],wholeCohortExecuted:false,automaticCoverage:[],globalClosed:false};
}

export function buildCoreTemplateFormPlan({ formManifest, fixtures, requiredCases }) {
  assert.ok(Array.isArray(formManifest) && Array.isArray(requiredCases));
  const declaredEditors = formManifest.filter(entry => entry.registryModuleKind);
  assert.deepEqual(declaredEditors.map(entry => entry.registryModuleKind).sort(), Object.keys(recipes).sort(), "Every registered template editor needs a verification recipe.");
  const create = formManifest.find(entry => entry.id === "block-template-create-modals");
  assert.ok(create, "The authoritative quick-create Form entry is required.");
  assert.equal(new Set(create.surfaces).size, create.surfaces.length);
  const coverage = (entry, surface, scenarios) => scenarios.map(scenario => {
    const rows = requiredCases.filter(row => row.boundary === "form" && row.consumer === entry.id && row.surface === surface && row.scenario === scenario);
    assert.equal(rows.length, 1, `Missing or ambiguous declared Form case: ${entry.id}/${surface}/${scenario}`);
    return rows[0].key;
  });
  const templates = fixtures?.pages?.templates;
  assert.ok(Array.isArray(templates), "The existing owned page/template fixture is required.");
  const editors = declaredEditors.map(entry => {
    const kind = entry.registryModuleKind, surface = `${kind}:template-edit`;
    assert.ok(entry.surfaces.includes(surface));
    const template = templates.find(row => row.kind === kind && row.assigned === false);
    assert.ok(template && Number.isSafeInteger(template.id) && template.id > 0 && template.name && template.slug, `Missing unused physical ${kind} template.`);
    // Specialized editors have no generic Form lifecycle cells. Domain results
    // are supplemental evidence, never proof of a complete capability axis.
    const generic = requiredCases.some(row => row.consumer === entry.id && row.surface === surface && row.scenario === "save_reload");
    return { entry, kind, surface, template, ...recipes[kind], coverage: generic ? coverage(entry, surface, ["save_reload", "failure_preserves_input", "retry"]) : [] };
  });
  const creates = create.surfaces.map(surface => {
    const [kind, operation] = surface.split(":");
    assert.equal(operation, "create");
    assert.ok(recipes[kind] && !["media-sidebar", "media-hub"].includes(kind), `Unexpected quick-create kind ${kind}.`);
    return { entry: create, kind, surface, ...recipes[kind], coverage: coverage(create, surface, ["save_reload", "failure_preserves_input", "retry"]) };
  });
  assert.equal(new Set(editors.map(row => `${row.table}:${row.template.id}`)).size, editors.length);
  return { editors, creates };
}

/** Exact authored create projection only; generated identity/default config are not claims. */
export function buildCoreTemplateCreateReadback(kind, id, name, slug, authored) {
  const recipe=recipes[kind];assert.ok(recipe&&!['media-sidebar','media-hub'].includes(kind));assert.ok(Number.isSafeInteger(id)&&id>0);assert.ok(typeof name==='string'&&name.trim());
  if(kind!=='breadcrumb')assert.ok(typeof slug==='string'&&slug.trim());
  const fields=recipe.fields.filter(([fieldName])=>kind==='feed'?fieldName==='widget_title':kind==='cards'?['item_0_title','item_0_body'].includes(fieldName):false);
  assert.deepEqual(authored.map(row=>row.name),fields.map(row=>row[0]),'Every actually authored create config field must be accounted for exactly once.');
  for(const [index,row]of authored.entries()){assert.deepEqual(row.path,fields[index][1]);assert.ok(typeof row.value==='string'&&row.value.trim());}
  return {table:recipe.table,id,expected:{name,...(kind==='breadcrumb'?{}:{slug})},expectedJson:authored.map(({path,value})=>({column:'config',path,value})),auditEntityType:'content_block_template',auditActions:['content_block_template.create'],auditEntityLabel:name,auditMetadata:kind==='content'?{slug}:{blockType:kind}};
}

export async function runCoreTemplateFormJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1", "Only the owned local application may be exercised.");
  assert.ok(Array.isArray(databaseReadback));
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = selectCoreTemplateFormPlan(buildCoreTemplateFormPlan({ formManifest: ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST, fixtures, requiredCases }), ctx.journeySelection);
  const suffix = Date.now().toString(36);
  const pathFor = (kind, id = "") => `/admin/pages-blocks/blocks/${kind}${id ? `/${id}` : ""}`;
  const field = (form, name) => form.locator(`[name="${name}"]:not([type="hidden"])`);
  const editorForm = id => page.locator("form").filter({ has: page.locator(`input[name="id"][value="${id}"]`) });
  const submit = form => form.locator('button[type="submit"]');
  const outcomes = [], permissionEvidence = [];

  async function navigate(path) {
    // Discard only the preceding independent synthetic case's unsaved draft.
    // This is cleanup, not rollback or dirty-close behavioral evidence.
    const leaveFixture = async dialog => {
      if (dialog.type() === "beforeunload") await dialog.accept();
      else await dialog.dismiss();
    };
    page.on("dialog", leaveFixture);
    try { await observe("template-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); }
    finally { page.off("dialog", leaveFixture); }
  }

  async function acknowledge(form, expectedServerRejection = false) {
    await expect(submit(form)).toHaveCount(1);
    await observe("template-action-acknowledgement", async () => {
      const [response] = await Promise.all([actionResponse(), submit(form).click()]);
      if (expectedServerRejection) {
        // Installed Next emits 500 for these pre-write action throws. Exact
        // shared Form feedback and preserved controls remain mandatory below.
        assert.equal(response.status(), 500, "Expected the installed Next rejected-action response.");
      } else assertActionAcknowledged(response);
    });
  }

  async function contentTab(form, recipe) {
    await form.locator(`[data-admin-tab-id="${recipe.tab ?? "content"}"]`).click();
  }
  async function authorSidebar(form) {
    const control = form.locator('[data-admin-form-listbox]:has(select[name="widget_key"])');
    await expect(control).toHaveCount(1);
    await control.getByRole("combobox").click();
    await page.getByRole("option", { name: "الأحدث", exact: true }).click();
    await expect(field(form, "limit")).toBeVisible();
  }
  const authoredFields = (recipe, tag) => recipe.fields.map(([name, path, fixed]) => ({ name, path, value: fixed ?? `QA ${tag} ${name}` }));
  async function assertFields(form, values) {
    for (const value of values) await expect(field(form, value.name)).toHaveValue(String(value.value));
  }
  async function cancelDirtyNavigation(form, recipe, name) {
    const original = page.url();
    const trigger = page.locator(`a[href="${pathFor(recipe.kind)}"]`).first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.locator("[data-admin-confirm-cancel]").click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    assert.equal(page.url(), original);
    await expect(field(form, "name")).toHaveValue(name);
  }

  async function editAndRead(recipe, id, name) {
    let form = editorForm(id);
    await expect(form).toHaveCount(1);
    await contentTab(form, recipe);
    if (recipe.kind === "media-sidebar") await authorSidebar(form);
    const authored = authoredFields(recipe, `${recipe.kind} ${id} ${suffix}`);
    await field(form, "name").fill(name);
    for (const value of authored) await field(form, value.name).fill(String(value.value));
    if (["content", "hero"].includes(recipe.kind)) await observe("template-dirty-navigation-cancel", () => cancelDirtyNavigation(form, recipe, name));
    // Shared Form uses noValidate and catches the real server rejection;
    // specialized forms retain their actual native required-name constraint.
    const sharedRuntime = ["content", "hero"].includes(recipe.kind);
    await observe("template-required-name-rejection", async () => {
      await field(form, "name").fill("");
      await expect(field(form, "name")).toHaveValue("");
      if (sharedRuntime) {
        await acknowledge(form, true);
        await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();
        await expect(page.getByText("تعذر إكمال الحفظ. احتُفظ ببيانات النموذج؛ راجعها وحاول مرة أخرى.", { exact: true })).toBeVisible();
        await expect(submit(form)).toBeEnabled();
        await expect(field(form, "name")).toHaveValue("");
        await assertFields(form, authored);
        await field(form, "name").fill(name);
        return;
      }
      const posts = [];
      const recordPost = request => {
        if (request.method() === "POST" && request.headers()["next-action"]) posts.push(request.url());
      };
      page.on("request", recordPost);
      try {
        await submit(form).click();
        assert.equal(await field(form, "name").evaluate(input => input.validity.valueMissing), true);
        await expect(field(form, "name")).toBeFocused();
        await assertFields(form, authored);
        assert.equal(posts.length, 0, "Invalid native form must not dispatch a mutation.");
      } finally { page.off("request", recordPost); }
      await field(form, "name").fill(name);
    });
    const caseId = `core-template-${recipe.kind}-existing-edit`;
    const permissionReplay = sharedRuntime && recipe.entry.registryModuleKind ? ctx.permissionReplay : undefined;
    if(sharedRuntime && recipe.entry.registryModuleKind){
      const original=page.url(),trigger=page.locator('a[href="'+pathFor(recipe.kind)+'"]').first();
      await ctx.permissionReplay.restoreDraft({mapping:{caseId,journeyId:caseId,formConsumer:recipe.entry.id,surface:recipe.surface},form,submit:submit(form),dirtyNavigation:'navigation',assertDraft:async()=>{await expect(field(form,'name')).toHaveValue(name);await assertFields(form,authored);},cancelDirty:()=>cancelDirtyNavigation(form,recipe,name),discardDirty:{trigger,destination:{kind:'navigated',pathname:pathFor(recipe.kind)},reopenAndRefill:async()=>{await navigate(new URL(original).pathname+new URL(original).search);await contentTab(form,recipe);await field(form,'name').fill(name);for(const value of authored)await field(form,value.name).fill(String(value.value));}}});
    }
    const value = await runCoreFormPermissionIntent({ permissionReplay, mapping: {caseId,formConsumer:recipe.entry.id,surface:recipe.surface}, permissionEvidence, perform: async () => {
    await acknowledge(form);
    await observe("template-canonical-save-outcome", async () => {
      await expect(page).toHaveURL(url => url.pathname === pathFor(recipe.kind, id) && url.searchParams.get("saved") === "1", { timeout: 60_000 });
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
      await expect(submit(editorForm(id))).toBeEnabled();
    });
    await observe("template-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    form = editorForm(id);
    await contentTab(form, recipe);
    await expect(field(form, "name")).toHaveValue(name);
    await assertFields(form, authored);
    if (recipe.kind === "media-sidebar") await expect(form.locator('select[name="widget_key"]')).toHaveValue("latest");
    const descriptor = { table: recipe.table, id, expected: { name },
      expectedJson: authored.map(({ path, value }) => ({ column: "config", path, value })),
      auditEntityType: "content_block_template", auditActions: ["content_block_template.update"],
      auditMetadata: recipe.kind === "content" ? {} : { blockType: recipe.kind }, auditEntityLabel: name };
    databaseReadback.push(descriptor);
    return { value: { kind: recipe.kind, consumer: recipe.entry.id, surface: recipe.surface, id,
      metadataReloadVerified: true, authoredConfigReloadVerified: authored.map(({ path }) => path),
      validation: sharedRuntime ? "server_required_name_rejection_shared_form_preservation" : "native_required_name_rejection_no_action_request", preservedAuthoredFields: authored.map(({ name: fieldName }) => fieldName), retrySaved: true,
      dirtyCloseCancel: ["content", "hero"].includes(recipe.kind) ? "verified" : "not_declared_by_specialized_editor",
      proofBoundary: "Selected metadata and authored configuration fields; native readback required. No complete capability axis, template-command, server-failure rollback claim. Optional permission evidence proves only the cookie-free HTTP boundary after native save."}, nativeWrites: [descriptor] };
    }});
    return {...value, permissionEvidence: permissionEvidence.filter(row=>row.caseId===caseId)};
  }

  // Existing unused templates keep all nine edit cases independent of any
  // quick-create failure. The owner joins each successful case to native reads.
  for (const recipe of plan.editors) {
    await run(`core-template-${recipe.kind}-existing-edit`, recipe.coverage, async () => {
      await navigate(pathFor(recipe.kind, recipe.template.id));
      const details = await editAndRead(recipe, recipe.template.id, `QA Core ${recipe.kind} saved ${suffix}`);
      outcomes.push(details);
      return details;
    });
  }
  for (const recipe of plan.creates) {
    await run(`core-template-${recipe.kind}-create-reject-retry`, recipe.coverage, async () => {
      await navigate(pathFor(recipe.kind));
      await page.getByRole("button", { name: recipe.kind === "hero" ? "إضافة هيرو" : "إضافة بلوك", exact: true }).click();
      const form = page.locator(recipe.kind === "hero" ? "#create-hero-template-form" : `#create-${recipe.kind}-block-form`);
      await expect(form).toBeVisible();
      const renderedAdoption=[], modal=page.locator('[data-venesia-modal]').filter({has:form});
      const bindings=[{boundary:'form',consumer:recipe.entry.id,surface:recipe.surface},{boundary:'collection',consumer:recipe.kind+'-template-library',surface:pathFor(recipe.kind)}];
      const observationBase={page,origin,requiredCases,bindings};
      renderedAdoption.push(await observeCoreModalCleanReturn({...observationBase,id:'template-'+recipe.kind+'-clean-return',dialog:modal,form,trigger:page.getByRole('button',{name:recipe.kind==='hero'?'إضافة هيرو':'إضافة بلوك',exact:true}),cancel:form.getByRole('button',{name:'إلغاء',exact:true})}));
      renderedAdoption.push(await observeCoreModalFocusAdoption({...observationBase,id:'template-'+recipe.kind+'-create-focus',dialog:modal}));
      const modalBody=modal.locator(':scope > div').filter({has:form});
      renderedAdoption.push(await observeCoreScrollbarAdoption({...observationBase,bindings:[bindings[0]],id:'template-'+recipe.kind+'-create-scroll',container:modalBody,target:submit(form),axis:'y',containment:'modal-lock'}));
      const name = `QA Core ${recipe.kind} created ${suffix}`, slug = `qa-core-${recipe.kind}-${suffix}`;
      await field(form, "name").fill(name);
      if (recipe.kind !== "breadcrumb") await field(form, "slug").fill(slug);
      const createAuthored=[];
      const createFields=recipe.fields.filter(([fieldName])=>recipe.kind==='feed'?fieldName==='widget_title':recipe.kind==='cards'?['item_0_title','item_0_body'].includes(fieldName):false);
      for(const [fieldName,path]of createFields){
        const value=fieldName==='widget_title'?`QA Feed ${suffix}`:fieldName==='item_0_title'?`QA Card ${suffix}`:`QA Card body ${suffix}`;
        // Missing rendered fields remain a real failure; never fabricate default cards.
        await expect(field(form,fieldName)).toHaveCount(1);await field(form,fieldName).fill(value);createAuthored.push({name:fieldName,path,value});
      }
      await observe("template-create-dirty-close-cancel", async () => {
        await form.getByRole("button", { name: "إلغاء", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
        await expect(dialog).toBeVisible();
        renderedAdoption.push(await observeCoreModalFocusAdoption({...observationBase,id:'template-'+recipe.kind+'-dirty-confirmation-focus',dialog,state:'dirty-confirmation',escape:'not-exercised'}));
        await dialog.locator("[data-admin-confirm-cancel]").click();
        await expect(dialog).toHaveCount(0);
        await expect(form.getByRole("button", { name: "إلغاء", exact: true })).toBeFocused();
        await expect(field(form, "name")).toHaveValue(name);
      });
      await field(form, "name").fill("   ");
      await expect(field(form, "name")).toHaveValue("   ");
      await acknowledge(form);
      await observe("template-create-server-name-rejection", async () => {
        await expect(field(form, "name")).toHaveAttribute("aria-invalid", "true");
        await expect(form.locator("#name-error")).toBeVisible();
        await expect(form.locator("#name-error")).toHaveText(recipe.kind === "hero" ? "اسم الهيرو مطلوب." : ["feed", "featured"].includes(recipe.kind) ? "اسم الموديول مطلوب." : "اسم البلوك مطلوب.");
        await expect(field(form, "name")).toHaveValue("   ");
        if (recipe.kind !== "breadcrumb") await expect(field(form, "slug")).toHaveValue(slug);
        await assertFields(form,createAuthored);
        await expect(submit(form)).toBeEnabled();
      });
      await field(form, "name").fill(name);
      const caseId = `core-template-${recipe.kind}-create-reject-retry`;
      await ctx.permissionReplay.restoreDraft({
        mapping:{caseId,journeyId:caseId,formConsumer:recipe.entry.id,surface:recipe.surface},form,submit:submit(form),dirtyNavigation:"close",
        discardDirty:{trigger:form.getByRole('button',{name:'إلغاء',exact:true}),destination:{kind:'closed',pathname:pathFor(recipe.kind)},reopenAndRefill:async()=>{
          await page.getByRole('button',{name:recipe.kind==='hero'?'إضافة هيرو':'إضافة بلوك',exact:true}).click();await expect(form).toBeVisible();
          await field(form,'name').fill(name);if(recipe.kind!=='breadcrumb')await field(form,'slug').fill(slug);for(const value of createAuthored)await field(form,value.name).fill(String(value.value));
        }},
        observePending:async()=>{renderedAdoption.push(await observeCoreModalPendingDismissal({...observationBase,id:'template-'+recipe.kind+'-pending-dismissal',dialog:modal,form}));},
        assertDraft:async()=>{await expect(field(form,"name")).toHaveValue(name);if(recipe.kind!=="breadcrumb")await expect(field(form,"slug")).toHaveValue(slug);await assertFields(form,createAuthored);},
        cancelDirty:async()=>{const original=page.url(),trigger=form.getByRole("button",{name:"إلغاء",exact:true});await trigger.click();const dialog=page.getByRole("dialog",{name:"إغلاق دون حفظ؟",exact:true});await expect(dialog).toBeVisible();await dialog.locator("[data-admin-confirm-cancel]").click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();assert.equal(page.url(),original);await expect(form).toBeVisible();},
      });
      let acceptedFeedback;
      const id = await runCoreFormPermissionIntent({permissionReplay:ctx.permissionReplay,mapping:{caseId,formConsumer:recipe.entry.id,surface:recipe.surface},permissionEvidence,perform:async()=>{
      acceptedFeedback=await observeCoreAcceptedFormFeedback({form,consumer:recipe.entry.id,surface:recipe.surface,entityKey:recipe.kind==="hero"?"hero-template-quick-create":recipe.kind+"-block-quick-create",routePrefix:pathFor(recipe.kind),requiredCases,perform:async()=>{
      await acknowledge(form);
      await observe("template-create-to-edit-handoff", async () => {
        const expectedPath = new RegExp(`^${pathFor(recipe.kind)}/[0-9]+$`, "u");
        // A newly returned error is a real failure, not a successful negative
        // test. Preserve the Cards minimum-item error if its UI is still absent.
        await expect.poll(async () => {
          if (expectedPath.test(new URL(page.url()).pathname)) return "edit";
          const alerts = await form.getByRole("alert").allTextContents();
          return alerts.find(text => !text.includes("اسم") && text.trim()) ?? "pending";
        }, { timeout: 60_000 }).not.toBe("pending");
        assert.match(new URL(page.url()).pathname, expectedPath, `Quick-create rejected after valid retry: ${(await form.getByRole("alert").allTextContents()).join(" ")}`);
      });
      return{entityId:Number(new URL(page.url()).pathname.split("/").at(-1)),routePathname:new URL(page.url()).pathname};}});
      const id = acceptedFeedback.entityId;
      await observe("template-created-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
      const createdForm=editorForm(id);
      await expect(field(createdForm,"name")).toHaveValue(name);
      // The editor carries its persisted immutable slug in a hidden input.
      if(recipe.kind!=='breadcrumb')await expect(createdForm.locator('input[name="slug"]')).toHaveValue(slug);
      if(createAuthored.length){await contentTab(createdForm,recipe);await assertFields(createdForm,createAuthored);}
      const descriptor=buildCoreTemplateCreateReadback(recipe.kind,id,name,slug,createAuthored);
      // Immediate native save proves create values before editAndRead authors new
      // config. The final read retains only this earlier creation audit contract.
      databaseReadback.push({...descriptor,expected:{},expectedJson:[]});
      return {value:id,nativeWrites:[descriptor]};
      }});
      const details = await editAndRead(recipe, id, `${name} saved`);
      outcomes.push(details);
      return { ...details,acceptedFeedback, renderedAdoption, createServerValidation: "trimmed_required_name", createInputPreserved: true, createRetryHandoff: true, createDirtyCloseCancel: true, permissionEvidence: permissionEvidence.filter(row=>row.caseId===caseId) };
    });
  }
  return { planned: plan.editors.length + plan.creates.length, completed: outcomes.length, outcomes, boundary: "Selected template-domain lifecycle; no template-command or complete capability-axis promotion." };
}

/** Only the six currently exposed create selectors and Hero's create status. */
export async function runCoreTemplateCreateControlFollowup(ctx) {
  assert.equal(validateCoreJourneySelection({scope:'core-closure',cohort:'recovery-templates',selection:ctx.journeySelection}),'template-create-controls-followup');
  const{page,origin,run}=ctx,results=[];
  for(const kind of['content','hero','cta','cards','feed','featured'])await run('core-control-template-create-'+kind,[],async()=>{
    const path='/admin/pages-blocks/blocks/'+kind,name='QA selected '+kind+' '+Date.now().toString(36),slug=name.toLowerCase().replaceAll(' ','-');await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:kind==='hero'?'إضافة هيرو':'إضافة بلوك',exact:true}).click();const form=page.locator(kind==='hero'?'#create-hero-template-form':'#create-'+kind+'-block-form');await expect(form).toBeVisible();await form.locator('[name="name"]').fill(name);await form.locator('[name="slug"]').fill(slug);
    const field=kind==='feed'?'feed_type':'variant',source=form.locator('select[name="'+field+'"]'),before=await source.inputValue(),options=await source.locator('option').evaluateAll(nodes=>nodes.filter(node=>!node.disabled&&node.value).map(node=>node.value));
    const alternative=options.find(value=>value!==before&&!['project-detail','projects-hub'].includes(value));assert.ok(alternative,'An exposed alternative must exist; hidden/default values are not an interaction.');
    const authored=[];for(const[fieldName,jsonPath]of recipes[kind].fields.filter(([key])=>kind==='feed'?key==='widget_title':kind==='cards'?['item_0_title','item_0_body'].includes(key):false)){const value='QA selected '+fieldName;await form.locator('[name="'+fieldName+'"]').fill(value);authored.push({name:fieldName,path:jsonPath,value});}
    const draft=await observeCoreControlDraft(ctx,async()=>({listbox:await observeCoreListboxControl({page,form,name:field,value:alternative}),...(kind==='hero'?{boolean:await observeCoreBooleanControl({form,name:'status',target:true})}:{})}));let id;
    const native=await acceptCoreControlSave(ctx,{form,ownedRunId:draft.noWrite.ownedRunId,mapping:{caseId:'core-control-template-create-'+kind,formConsumer:'block-template-create-modals',surface:kind+':create'},descriptor:()=>{const value=buildCoreTemplateCreateReadback(kind,id,name,slug,authored);value.expected={...value.expected,...(kind==='featured'?{}:{[field]:alternative}),status:kind==='hero'?'published':'unpublished'};if(kind==='featured')value.expectedJson.push({column:'config',path:['presentation','variant'],value:alternative});return value;},reopen:async()=>{await expect(page).toHaveURL(url=>new RegExp('^'+path+'/[0-9]+$','u').test(url.pathname));id=Number(new URL(page.url()).pathname.split('/').at(-1));await page.reload({waitUntil:'domcontentloaded'});const editor=page.locator('form').filter({has:page.locator('input[name="id"][value="'+id+'"]')});await expect(editor.locator('[name="name"]')).toHaveValue(name);if(kind==='featured')await editor.locator('[data-admin-tab-id="presentation"]').click();await expect(editor.locator('[name="'+(kind==='featured'?'presentation_variant':field)+'"]')).toHaveValue(alternative);if(kind==='hero')await expect(editor.locator('input[type="checkbox"][name="status"]')).toBeChecked();}});
    const result={...native,controls:draft.value,noWrite:draft.noWrite,kind};results.push(result);return result;
  });return{selection:ctx.journeySelection,results,automaticCoverage:[],globalClosed:false};
}
