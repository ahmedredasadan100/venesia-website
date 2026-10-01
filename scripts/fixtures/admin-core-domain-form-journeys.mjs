import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption,observeCoreModalCleanReturn,observeCoreModalPendingDismissal} from "./admin-core-rendered-adoption.mjs";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

/** A cursor paragraph is not authored content; the entire stored projection must still match. */
export function assertCorePlainParagraphSnapshot(snapshot, expected, toMarkdown) {
  assert.equal(typeof expected, "string"); assert.ok(expected.trim().length > 0);
  assert.ok(Array.isArray(snapshot.paragraphs) && snapshot.paragraphs.every(value => typeof value === "string"));
  assert.deepEqual(snapshot.paragraphs.filter(value => value.trim().length > 0), [expected], "Exactly one authored paragraph is required; extra nonempty paragraphs cannot be ignored.");
  assert.equal(snapshot.headings, 0, "The paragraph toolbar must remove the seeded heading.");
  assert.equal(toMarkdown(snapshot.html), expected, "The entire editor HTML must project to the exact canonical Markdown body.");
  assert.equal(snapshot.markdown, expected, "The submitted Markdown must equal the whole-editor projection.");
}

const familyIds = ["topic-category-create-edit", "topic-series-create-edit", "topic-article-create-edit", "topic-media-create-edit", "projects-create-edit", "project-locations-create-edit"];
const lifecycle = ["save_reload", "failure_preserves_input", "retry"];
const locationSurface = { governorate: "governorate", city: "city", main_area: "district", sub_area: "sub-district" };

/** Fixed affected-journey selectors; omission preserves each existing full cohort. */
export function validateCoreJourneySelection({ scope, cohort, selection }) {
  if (selection === undefined || selection === null) return null;
  assert.equal(scope, "core-closure");
  if (selection === "domain-command-tail" || selection === "tracking-permissions" || selection === "readonly-query-proof") assert.equal(cohort, "domain-commands");
  else if (selection === "page-composition-followup" || selection === "page-composition-content-seo-followup" || selection === "page-composition-seo-followup") assert.equal(cohort, "page-composition");
  else if (selection === "template-controls-followup") assert.equal(cohort, "template-controls");
  else if (selection === "topic-controls-followup") assert.equal(cohort, "topic-controls");
  else if (selection === "project-editors-followup") assert.equal(cohort, "project-controls");
  else if (selection === "navigation-settings-followup") assert.equal(cohort, "navigation-settings");
  else if (selection === "template-hero-bulk-followup") assert.equal(cohort, "template-bulk");
  else if (selection === "specialized-settings-followup") assert.equal(cohort, "specialized-settings");
  else if (selection === "readonly-hubs-followup") assert.equal(cohort, "readonly-hubs");
  else if (selection === "template-cards-presentation") assert.equal(cohort, "template-libraries");
  else if (selection === "query-layout-followup") assert.equal(cohort, "query-presentation");
  else if (selection === "template-form-creates" || selection === "template-form-creates-followup") assert.equal(cohort, "recovery-templates");
  else { assert.equal(cohort, "domain-forms"); assert.equal(selection, "text-topic-forms", "Unknown affected journey selection."); }
  return selection;
}
function isTextTopic(recipe) { return !["video", "gallery"].includes(recipe.kind); }
function buildCoreTopicFormRecipes(manifest, coverage) {
  const forms = Object.fromEntries(["topic-article-create-edit", "topic-media-create-edit"].map(id => {
    const matches = manifest.filter(row => row.id === id); assert.equal(matches.length, 1); return [id, matches[0]];
  }));
  const media = forms["topic-media-create-edit"].surfaces.filter(surface => surface.endsWith(":create")).map(surface => surface.split(":")[0]);
  assert.deepEqual([...media].sort(), ["gallery", "news", "press", "site_update", "video"]);
  return ["article", ...media].map(kind => {
    const id = kind === "article" ? "topic-article-create-edit" : "topic-media-create-edit";
    const surfaces = kind === "article" ? ["create", "edit"] : [`${kind}:create`, `${kind}:edit`];
    return { kind, id, surfaces, coverage: coverage(id, surfaces) };
  });
 }
export function coreSelectedTopicRecipes(selection, manifest) {
  if (selection === null) return [];
  validateCoreJourneySelection({ scope: "core-closure", cohort: "domain-forms", selection });
  return buildCoreTopicFormRecipes(manifest, () => []).filter(isTextTopic);
}
export function selectCoreDomainFormPlan(plan, selection) {
  if (selection === null || selection === undefined) return plan;
  validateCoreJourneySelection({ scope: "core-closure", cohort: "domain-forms", selection });
  return { ...plan, taxonomy: [], topics: plan.topics.filter(isTextTopic), projectEdits: [], locations: [], pending: [] };
}
export function coreTopicJourneyId(recipe) { return "core-" + recipe.kind + "-content-form-create-edit"; }
/** Reject invented execution and full-cohort promotion before native database access.
 * @param {object} browser
 * @param {ReadonlyArray<object>} manifest
 * @param {ReadonlyArray<object>|null} canonicalRequiredCases
 * @param {{globalClosed:boolean,automaticCoverage:unknown[],qualified:Array<{journeyId:string,key:string}>}|null} draftRestoration
 */
export function assertCoreJourneySelectionReceipt(browser, manifest, canonicalRequiredCases, draftRestoration = null) {
  const selection = validateCoreJourneySelection({ scope: browser.scope, cohort: browser.cohort, selection: browser.journeySelection });
  if (selection === null) return null;
  const identities = rows => {
    assert.ok(Array.isArray(rows) && rows.length > 0);
    assert.ok(rows.every(row => typeof row.key === "string" && row.key.length > 0));
    assert.equal(new Set(rows.map(row => row.key)).size, rows.length, "Canonical case identities must be unique.");
    return rows.map(row => { const identity = { ...row }; delete identity.status; delete identity.evidence; return identity; }).sort((a, b) => a.key.localeCompare(b.key));
  };
  assert.deepEqual(identities(browser.requiredCases), identities(canonicalRequiredCases), "Selected verification must retain the entire current canonical required-case universe.");
  const recipes = coreSelectedTopicRecipes(selection, manifest), ids = recipes.map(coreTopicJourneyId);
  assert.equal(browser.driverCompleted, true); assert.equal(browser.status, "pass"); assert.deepEqual(browser.errors, []);
  assert.equal(browser.globalClosed, false); assert.equal(browser.wholeCohortExecuted, false);
  assert.deepEqual(browser.selectedJourneyIds, ids); assert.deepEqual(browser.executedJourneyIds, ids);
  assert.deepEqual(browser.evidence.map(row => row.id), ["existing-auth-login", ...ids]);
  assert.ok(browser.evidence.every(row => row.status === "pass"));
  const expectedKeys = [];
  for (const [index, recipe] of recipes.entries()) {
    const row = browser.evidence[index + 1]; assert.equal(row.kind, recipe.kind); assert.equal(row.consumer, recipe.id);
    assert.deepEqual(row.surfaces, recipe.surfaces); assert.equal(row.bodyBoundary, "authored_markdown_roundtrip");
    assert.ok(Number.isSafeInteger(row.entityId) && row.entityId > 0);
    const keys = recipe.surfaces.flatMap(surface => lifecycle.map(scenario => {
      const cells = browser.requiredCases.filter(cell => cell.boundary === "form" && cell.consumer === recipe.id && cell.surface === surface && cell.scenario === scenario);
      assert.equal(cells.length, 1); assert.equal(cells[0].status, "behavior_verified"); assert.equal(cells[0].evidence, ids[index]); return cells[0].key;
    }));
    assert.deepEqual(row.coverage, keys); expectedKeys.push(...keys);
    const writes = browser.databaseReadback.filter(write => write.id === row.entityId); assert.equal(writes.length, 2);
    assert.ok(writes.every(write => write.table === "topics" && write.auditEntityType === "topic"));
    assert.deepEqual(writes.map(write => write.auditActions), [["topic.create"], ["topic.update"]]);
    assert.equal(writes[1].expected.content_type, recipe.kind); assert.equal(typeof writes[1].expected.content, "string"); assert.ok(writes[1].expected.content.length > 0);
  }
  assert.equal(new Set(browser.evidence.slice(1).map(row => row.entityId)).size, recipes.length);
  assert.equal(browser.databaseReadback.length, recipes.length * 2);
  const allowed = new Set(expectedKeys);
  for (const cell of browser.requiredCases) if (!allowed.has(cell.key)) { assert.equal(cell.status, "open"); assert.equal(cell.evidence, null); }
  if (draftRestoration !== null) {
    assert.equal(draftRestoration.globalClosed, false); assert.deepEqual(draftRestoration.automaticCoverage, []);
    const expectedDrafts=recipes.flatMap(recipe=>recipe.surfaces.map(surface=>({journeyId:coreTopicJourneyId(recipe),key:browser.requiredCases.find(row=>row.boundary==='form'&&row.consumer===recipe.id&&row.surface===surface&&row.scenario==='rollback')?.key})));
    assert.deepEqual(draftRestoration.qualified.map(row=>({journeyId:row.journeyId,key:row.key})),expectedDrafts);
  }
  return { selection, selectedJourneyIds: ids, executedJourneyIds: [...browser.executedJourneyIds], wholeCohortExecuted: false, globalClosed: false };
}

export function buildCoreDomainFormPlan({ manifest, requiredCases, fixtures, locationConfig }) {
  assert.ok(Array.isArray(manifest) && Array.isArray(requiredCases));
  const forms = Object.fromEntries(familyIds.map(id => {
    const matches = manifest.filter(entry => entry.id === id);
    assert.equal(matches.length, 1, `Missing canonical Form family ${id}.`);
    return [id, matches[0]];
  }));
  const coverage = (id, surfaces) => surfaces.flatMap(surface => {
    assert.ok(forms[id].surfaces.includes(surface), `Undeclared Form surface ${id}/${surface}.`);
    return lifecycle.map(scenario => {
      const matches = requiredCases.filter(row => row.boundary === "form" && row.consumer === id && row.surface === surface && row.scenario === scenario);
      assert.equal(matches.length, 1, `Missing or ambiguous generic Form case ${id}/${surface}/${scenario}.`);
      return matches[0].key;
    });
  });
  assert.ok(Number.isSafeInteger(fixtures?.category?.id) && fixtures.category.name);
  const taxonomy = ["category", "series"].map(kind => {
    const id = `topic-${kind}-create-edit`;
    return { kind, id, surfaces: ["create", "edit"], coverage: coverage(id, ["create", "edit"]) };
  });
  const topics = buildCoreTopicFormRecipes(manifest, coverage);
  const projectEdits = ["residential", "commercial"].map(kind => {
    const fixture = kind === "residential" ? fixtures.project : fixtures.commercialProject;
    assert.ok(Number.isSafeInteger(fixture?.id) && fixture.editorPath === `/admin/projects/${fixture.id}`);
    return { kind, id: "projects-create-edit", fixture, surfaces: [`${kind}:edit`], coverage: coverage("projects-create-edit", [`${kind}:edit`]) };
  });
  const parentIds = fixtures.project.locationIds;
  assert.ok(Array.isArray(parentIds) && parentIds.length === Object.keys(locationConfig).length && parentIds.every(id => Number.isSafeInteger(id) && id > 0));
  assert.deepEqual(Object.keys(locationConfig).sort(), Object.keys(locationSurface).sort());
  const locations = Object.entries(locationConfig).map(([level, config]) => {
    const index = Object.keys(locationConfig).indexOf(level);
    const id = "project-locations-create-edit", surface = locationSurface[level];
    const surfaces = [`${surface}:create`, `${surface}:edit`];
    return { level, id, config, parentId: config.parentLevel ? parentIds[index - 1] : null, surfaces, coverage: coverage(id, surfaces) };
  });
  return { taxonomy, topics, projectEdits, locations,
    pending: forms["projects-create-edit"].surfaces.filter(surface => surface.endsWith(":create")).map(surface => ({ consumer: "projects-create-edit", surface, status: "unexecuted_actionable", reason: "Requires the current full Project create UI: media selection, hierarchy/maps, overview and delivery. Existing edits do not prove create." })) };
}

/** Canonical native settings projections and the one normalized Tracking instant; no generic empty-save allowance. */
export function assertCoreFormPermissionNativeDescriptor(write, mapping) {
  assert.ok(write?.expected && typeof write.expected === "object" && !Array.isArray(write.expected));
  if (Object.keys(write.expected).length) return;
  const canonical = {
    "company-identity-settings": ["singleton-settings", "admin.company"],
    "global-seo-settings": ["global-meta", "seo.global"],
    "media-library-settings": ["media-policy-settings", "media.settings"],
  }[mapping.formConsumer];
  assert.ok(canonical && mapping.surface === canonical[0] && write.table === "site_settings" && write.id === canonical[1], "Empty scalar fields require the exact canonical settings consumer/key.");
  assert.ok(Array.isArray(write.expectedJson) && write.expectedJson.length > 0 && write.expectedJson.length <= 32);
  const paths = new Set();
  for (const projection of write.expectedJson) {
    assert.equal(projection.column, "value"); assert.ok(Array.isArray(projection.path) && projection.path.length > 0);
    assert.ok(projection.path.every(key => typeof key === "string" && /^(?:[a-zA-Z_][a-zA-Z0-9_]*|0|[1-9][0-9]*)$/u.test(key) && !["__proto__", "constructor", "prototype"].includes(key)));
    assert.ok(Object.hasOwn(projection, "value") && projection.value !== undefined);
    const key = JSON.stringify(projection.path); assert.equal(paths.has(key), false); paths.add(key);
  }
}
export function assertCoreFormPermissionNativeWrite(expected, actual, mapping) {
  assertCoreFormPermissionNativeDescriptor(expected, mapping);
  assert.equal(actual.deleted, false);
  if (Object.keys(expected.expected).length === 0) assert.deepEqual(actual.actual, { key: expected.id }, "JSON-only settings must retain the canonical native key projection.");
  else if (expected.table === "project_tracking_updates" && Object.hasOwn(expected.expected, "occurred_at")) {
    assert.ok(actual.actual && Object.hasOwn(actual.actual, "occurred_at"));
    assert.equal(typeof expected.expected.occurred_at, "string"); assert.equal(typeof actual.actual.occurred_at, "string");
    const wanted = Date.parse(expected.expected.occurred_at), observed = Date.parse(actual.actual.occurred_at);
    assert.ok(Number.isFinite(wanted) && Number.isFinite(observed)); assert.equal(observed, wanted, "Tracking authored instant changed.");
    assert.deepEqual({ ...actual.actual, occurred_at: wanted }, { ...expected.expected, occurred_at: wanted });
  } else assert.deepEqual(actual.actual, expected.expected, "Native save must prove every authored field.");
  assert.deepEqual(actual.json, (expected.expectedJson ?? []).map(projection => ({ column: projection.column, path: projection.path, actual: projection.value })), "Native save must prove every authored JSON projection.");
  assert.ok(Number.isSafeInteger(actual.expectedActorId) && actual.expectedActorId > 0, "Canonical native QA actor is required.");
  assert.ok(Array.isArray(actual.audit) && actual.audit.length > 0 && actual.audit.every(row => Number(row.actor_admin_user_id) === actual.expectedActorId), "The original write requires its exact canonical QA actor audit.");
  for (const action of expected.auditActions ?? []) assert.ok(actual.audit.some(row => row.action === action));
}

/** One accepted current Form intent; the optional replay never precedes native save proof. */
export async function runCoreFormPermissionIntent({ permissionReplay, mapping, perform, permissionEvidence }) {
  const startedAt = new Date().toISOString();
  const capture = permissionReplay?.begin(mapping);
  try {
    const { value, nativeWrites } = await perform();
    if (!capture) return value;
    assert.equal(typeof permissionReplay.nativeSave, "function", "Original native save verification is required.");
    assert.ok(Array.isArray(nativeWrites) && nativeWrites.length > 0 && nativeWrites.length <= 4);
    for (const write of nativeWrites) assertCoreFormPermissionNativeDescriptor(write, mapping);
    const native = await permissionReplay.nativeSave(nativeWrites, { ...mapping, startedAt });
    assert.equal(native?.kind, "form-save-native");
    assert.equal(native.status, "partial-not-global-pass");
    assert.equal(native.globalClosed, false);
    assert.match(native.id, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);
    for (const key of ["caseId", "formConsumer", "surface"]) assert.equal(native[key], mapping[key], "Native save receipt belongs to another intent.");
    assert.ok(Array.isArray(native.writes) && native.writes.length === nativeWrites.length);
    for (const expected of nativeWrites) {
      const matches = native.writes.filter(write => write.table === expected.table && write.id === expected.id);
      assert.equal(matches.length, 1, "Native save must cover exactly this persisted row.");
      const actual = matches[0];
      assertCoreFormPermissionNativeWrite(expected, actual, mapping);
    }
    const receipt = await capture.verifyAfterSuccessfulUI({ canonicalUiSuccessVerified: true, nativeSaveVerified: true });
    assert.equal(receipt.status, "pass");
    for (const key of ["caseId", "formConsumer", "surface"]) assert.equal(receipt[key], mapping[key]);
    assert.deepEqual(receipt.automaticCoverage, []);
    permissionEvidence.push({ ...receipt, originalNativeSaveReceipt: native.id, originalProjectionCount: nativeWrites.length });
    return value;
  } finally {
    capture?.discard();
  }
}

export async function runCoreDomainFormJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.ok(Array.isArray(databaseReadback));
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { richTextHtmlToMarkdown } = await jiti.import("../../src/lib/rich-text/html-utils.ts");
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { PROJECT_LOCATION_LEVEL_CONFIG: locationConfig } = await jiti.import("../../src/lib/admin/projects/location-management-contract.ts");
  const plan = selectCoreDomainFormPlan(buildCoreDomainFormPlan({ manifest, requiredCases, fixtures, locationConfig }), ctx.journeySelection ?? null);
  const suffix = Date.now().toString(36), completed = [], permissionEvidence = [];
  const permissionIntent = (recipe, surface, caseId, perform) => runCoreFormPermissionIntent({
    permissionReplay: ctx.permissionReplay, mapping: { caseId, formConsumer: recipe.id, surface }, perform, permissionEvidence,
  });
  let locationRendered=null;
  const currentForm = () => page.locator("form[data-admin-form-runtime]");
  const control = (form, name) => form.locator(`[name="${name}"]`);
  const save = form => form.locator('button[type="submit"]');
  const successfulFeedback = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first();
  const ownedBoundary = "Real current Form UI and reload; parent native readback required. Optional permission evidence proves only the cookie-free HTTP boundary after native save verification. No complete capability, UI permission-state, rollback, publication, or media-provider coverage.";

  async function navigate(path, expectsForm = true) {
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss();
    page.on("dialog", leave);
    try { await observe("domain-form-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); }
    finally { page.off("dialog", leave); }
    if (expectsForm) await expect(currentForm()).toHaveCount(1);
  }
  async function acknowledge(form) {
    await expect(save(form)).toHaveCount(1);
    await observe("domain-form-action", async () => {
      const [response] = await Promise.all([actionResponse(), save(form).click()]);
      assertActionAcknowledged(response);
    });
  }
  async function selectValue(form, name, value) {
    const source = form.locator(`select[name="${name}"]`);
    await expect(source.locator(`option[value="${value}"]`)).toHaveCount(1);
    const label = (await source.locator(`option[value="${value}"]`).textContent()).trim();
    const owner = form.locator(`[data-admin-form-listbox]:has(select[name="${name}"])`);
    await owner.getByRole("combobox").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(source).toHaveValue(String(value));
  }
  async function acceptedClose(form, destinationPathname, refill, verifyReopen = false) {
    const original=page.url(),trigger=form.locator('[data-admin-form-action="close"]'),target=new URL(destinationPathname,origin);assert.equal(target.origin,origin);
    return{trigger,destination:{kind:'navigated',pathname:target.pathname},...(verifyReopen?{verifyReopen:true}:{}),reopenAndRefill:async()=>{await navigate(new URL(original).pathname+new URL(original).search);await refill();}};
  }
  async function valuesEqual(form, fields) {
    for (const [name, value] of Object.entries(fields)) await expect(control(form, name)).toHaveValue(String(value));
  }
  const locationBase=surface=>({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:"form",consumer:locationRendered.recipe.id,surface}]});
  async function observeLocationOpening(form,trigger,surface) {
    locationRendered.surface=surface;if(locationRendered.opened.has(surface))return;
    const dialog=page.getByRole("dialog").filter({has:page.locator("form[data-admin-form-runtime]")}),common=locationBase(surface),prefix="location-"+locationRendered.recipe.level+"-"+surface;
    locationRendered.observations.push(await observeCoreModalCleanReturn({...common,id:prefix+"-return",dialog,form,trigger,cancel:form.getByRole("button",{name:"إلغاء",exact:true})}));
    locationRendered.observations.push(await observeCoreModalFocusAdoption({...common,id:prefix+"-focus",dialog}));
    const body=dialog.locator(":scope > div").filter({has:page.locator("form[data-admin-form-runtime]")});
    locationRendered.observations.push(await observeCoreScrollbarAdoption({...common,id:prefix+"-scroll",container:body,target:save(form),axis:"y",containment:"modal-lock"}));
    locationRendered.opened.add(surface);
  }
  async function observeLocationPending(form,surface) {
    const dialog=page.getByRole("dialog").filter({has:page.locator("form[data-admin-form-runtime]")});
    locationRendered.observations.push(await observeCoreModalPendingDismissal({...locationBase(surface),id:"location-"+locationRendered.recipe.level+"-"+surface+"-pending",dialog,form}));
  }
  async function dirtyCloseCancel(form, fields, modal = false) {
    const original = page.url();
    const close = modal ? form.getByRole("button", { name: "إلغاء", exact: true }) : form.locator('[data-admin-form-action="close"]');
    await close.click();
    const confirmation = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
    await expect(confirmation).toBeVisible();
    if(modal&&locationRendered&&!locationRendered.dirty.has(locationRendered.surface)){locationRendered.observations.push(await observeCoreModalFocusAdoption({...locationBase(locationRendered.surface),id:"location-"+locationRendered.recipe.level+"-"+locationRendered.surface+"-dirty-focus",dialog:confirmation,state:"dirty-confirmation",escape:"not-exercised"}));locationRendered.dirty.add(locationRendered.surface);}
    await confirmation.locator("[data-admin-confirm-cancel]").click();
    await expect(confirmation).toHaveCount(0);
    await expect(close).toBeFocused();
    assert.equal(page.url(), original);
    await valuesEqual(form, fields);
  }
  async function rejectRequired(form, name, fields) {
    await observe("domain-required-field-rejection", async () => {
      await control(form, name).fill("");
      await expect(control(form, name)).toHaveValue("");
      await acknowledge(form);
      await expect(form.locator(`#${name}-error`)).toBeVisible();
      await expect(form.locator(`#${name}-error`)).not.toHaveText("");
      await expect(save(form)).toBeEnabled();
      await expect(control(form, name)).toHaveValue("");
      await valuesEqual(form, Object.fromEntries(Object.entries(fields).filter(([key]) => key !== name)));
      await control(form, name).fill(String(fields[name]));
    });
  }
  async function accepted(form) {
    await acknowledge(form);
    await observe("domain-form-canonical-outcome", async () => {
      await expect(successfulFeedback()).toBeVisible({ timeout: 60_000 });
      await expect(save(currentForm())).toBeEnabled({ timeout: 60_000 });
    });
  }
  async function reloadValues(fields, tab = null) {
    await observe("domain-form-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    if (tab) await currentForm().locator(`[data-admin-tab-id="${tab}"]`).click();
    await valuesEqual(currentForm(), fields);
  }
  function audit(table, id, entity, label, verb, expected, extra = {}) {
    const descriptor = { table, id, expected, auditEntityType: entity, auditActions: [`${entity}.${verb}`], auditEntityLabel: label, ...extra };
    databaseReadback.push(descriptor);
    return descriptor;
  }
  function details(recipe, id, fields, extra = {}) {
    const result = { ...(recipe.id==="project-locations-create-edit"?{renderedAdoption:locationRendered.observations}:{}), consumer: recipe.id, surfaces: recipe.surfaces, kind: recipe.kind ?? recipe.level, id,
      verified: ["required_server_validation", "input_preservation", "retry", "save_reload", "dirty_close_cancel"], fields, proofBoundary: ownedBoundary, ...extra };
    const permissions = permissionEvidence.filter(item => item.formConsumer === recipe.id && recipe.surfaces.includes(item.surface));
    if (permissions.length) result.permissionEvidence = permissions;
    completed.push(result); return result;
  }

  for (const recipe of plan.taxonomy) await run(`core-${recipe.kind}-form-create-edit`, recipe.coverage, async () => {
    const plural = recipe.kind === "category" ? "categories" : "series", table = recipe.kind === "category" ? "topic_categories" : "topic_series";
    const entity = recipe.kind === "category" ? "topic_category" : "topic_series";
    await navigate(`/admin/content/${plural}/new`);
    let form = currentForm();
    const name = `QA Core ${recipe.kind} ${suffix}`, slug = `qa-core-form-${recipe.kind}-${suffix}`;
    await control(form, "name").fill(name);
    await control(form, "slug").fill(slug);
    if (recipe.kind === "series") await selectValue(form, "category_id", fixtures.category.id);
    const createFields = { name, slug, ...(recipe.kind === "series" ? { category_id: fixtures.category.id } : {}) };
    await dirtyCloseCancel(form, createFields);
    await rejectRequired(form, "name", createFields);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-"+recipe.kind+"-form-create",journeyId:"core-"+recipe.kind+"-form-create-edit",formConsumer:recipe.id,surface:"create"},form,submit:save(form),assertDraft:()=>valuesEqual(form,createFields),cancelDirty:()=>dirtyCloseCancel(form,createFields),dirtyNavigation:'close',discardDirty:await acceptedClose(form,'/admin/content/'+plural,async()=>{await control(form,'name').fill(name);await control(form,'slug').fill(slug);if(recipe.kind==='series')await selectValue(form,'category_id',fixtures.category.id);})});
    const id = await permissionIntent(recipe, "create", "core-" + recipe.kind + "-form-create", async () => {
      await accepted(form);
      await expect(page).toHaveURL(url => new RegExp("^/admin/content/" + plural + "/[0-9]+$", "u").test(url.pathname));
      const createdId = Number(new URL(page.url()).pathname.split("/").at(-1));
      await reloadValues({ name });
      const descriptor = audit(table, createdId, entity, name, "create", {});
      return { value: createdId, nativeWrites: [{ ...descriptor, expected: { ...createFields, status: "unpublished" } }] };
    });
    form = currentForm();
    const edited = `${name} saved`;
    await control(form, "name").fill(edited);
    const editFields = { name: edited, ...(recipe.kind === "series" ? { category_id: fixtures.category.id } : {}) };
    await dirtyCloseCancel(form, editFields);
    await rejectRequired(form, "name", editFields);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-"+recipe.kind+"-form-edit",journeyId:"core-"+recipe.kind+"-form-create-edit",formConsumer:recipe.id,surface:"edit"},form,submit:save(form),assertDraft:()=>valuesEqual(form,editFields),cancelDirty:()=>dirtyCloseCancel(form,editFields),dirtyNavigation:'close',discardDirty:await acceptedClose(form,'/admin/content/'+plural,async()=>{await control(form,'name').fill(edited);if(recipe.kind==='series')await selectValue(form,'category_id',fixtures.category.id);})});
    await permissionIntent(recipe, "edit", "core-" + recipe.kind + "-form-edit", async () => {
      await accepted(form);
      await reloadValues(editFields);
      const descriptor = audit(table, id, entity, edited, "update", { ...editFields, slug, status: "unpublished" });
      return { nativeWrites: [descriptor] };
    });
    return details(recipe, id, ["name", "slug", ...(recipe.kind === "series" ? ["category_id"] : [])]);
  });

  for (const recipe of plan.topics) await run(coreTopicJourneyId(recipe), recipe.coverage, async () => {
    await navigate(`/admin/content/topics/new?type=${recipe.kind}`);
    let form = currentForm();
    const title = `QA Core ${recipe.kind} ${suffix}`, slug = `qa-core-content-${recipe.kind.replaceAll("_", "-")}-${suffix}`;
    const excerpt = `QA authored excerpt for ${recipe.kind} content ${suffix}.`;
    const markdown = isTextTopic(recipe);
    const body = `Authored core content for ${recipe.kind.replaceAll("_", " ")} ${suffix}.`;
    await form.locator('[data-admin-tab-id="basic"]').click();
    await control(form, "title").fill(title);
    await control(form, "slug").fill(slug);
    await control(form, "excerpt").fill(excerpt);
    await selectValue(form, "category_id", fixtures.category.id);
    if (markdown) {
      const editor = form.getByRole("textbox", { name: "نص المقال", exact: true });
      await editor.fill(body);
      // The seeded create document starts with a heading; author a paragraph
      // explicitly through the current toolbar before testing plain Markdown.
      await form.getByRole("button", { name: "فقرة", exact: true }).click();
      // StarterKit may retain an empty trailing cursor paragraph after converting a heading.
      // Check every authored paragraph and the entire canonical projection, not the first node.
      await expect(control(form, "content")).toHaveValue(body);
      await expect.poll(async () => richTextHtmlToMarkdown(await editor.innerHTML())).toBe(body);
      const snapshot = await editor.evaluate(element => ({
        paragraphs: Array.from(element.querySelectorAll("p"), paragraph => paragraph.textContent ?? ""),
        headings: element.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
        html: element.innerHTML,
      }));
      assertCorePlainParagraphSnapshot({ ...snapshot, markdown: await control(form, "content").inputValue() }, body, richTextHtmlToMarkdown);
    }
    if (recipe.kind === "video") await control(form, "video_duration").fill("2:34");
    const createFields = { title, slug, excerpt, category_id: fixtures.category.id, ...(markdown ? { content: body } : {}), ...(recipe.kind === "video" ? { video_duration: "2:34" } : {}) };
    await valuesEqual(form, createFields);
    await dirtyCloseCancel(form, createFields);
    await rejectRequired(form, "title", createFields);
    const payloadAudit = recipe.kind === "video"
      ? { expectedJson: [{ column: "media_payload", path: ["kind"], value: "video" }, { column: "media_payload", path: ["duration"], value: "2:34" }] }
      : recipe.kind === "gallery" ? { expectedJson: [{ column: "media_payload", path: ["kind"], value: "gallery" }] } : {};
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-"+recipe.kind+"-content-create",journeyId:"core-"+recipe.kind+"-content-form-create-edit",formConsumer:recipe.id,surface:recipe.surfaces[0]},form,submit:save(form),assertDraft:()=>valuesEqual(form,createFields),cancelDirty:()=>dirtyCloseCancel(form,createFields),dirtyNavigation:'close',discardDirty:await acceptedClose(form,'/admin/content/topics',async()=>{
      await form.locator('[data-admin-tab-id="basic"]').click();await control(form,'title').fill(title);await control(form,'slug').fill(slug);await control(form,'excerpt').fill(excerpt);await selectValue(form,'category_id',fixtures.category.id);
      if(markdown){const editor=form.getByRole('textbox',{name:'نص المقال',exact:true});await editor.fill(body);await form.getByRole('button',{name:'فقرة',exact:true}).click();await expect(control(form,'content')).toHaveValue(body);}
      if(recipe.kind==='video')await control(form,'video_duration').fill('2:34');
    })});
    const id = await permissionIntent(recipe, recipe.surfaces[0], "core-" + recipe.kind + "-content-create", async () => {
      await accepted(form);
      await expect(page).toHaveURL(url => /^\/admin\/content\/topics\/[0-9]+$/u.test(url.pathname));
      const createdId = Number(new URL(page.url()).pathname.split("/").at(-1));
      await reloadValues(createFields, "basic");
      const descriptor = audit("topics", createdId, "topic", title, "create", {});
      return { value: createdId, nativeWrites: [{ ...descriptor,
        expected: { title, slug, excerpt, category_id: fixtures.category.id, content_type: recipe.kind, status: "unpublished", ...(markdown ? { content: body } : {}) },
        ...payloadAudit }] };
    });
    form = currentForm();
    const edited = `${title} saved`, editedExcerpt = `${excerpt} Saved update.`;
    await control(form, "title").fill(edited);
    await control(form, "excerpt").fill(editedExcerpt);
    const editFields = { ...createFields, title: edited, excerpt: editedExcerpt };
    await dirtyCloseCancel(form, editFields);
    await rejectRequired(form, "title", editFields);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-"+recipe.kind+"-content-edit",journeyId:"core-"+recipe.kind+"-content-form-create-edit",formConsumer:recipe.id,surface:recipe.surfaces[1]},form,submit:save(form),assertDraft:()=>valuesEqual(form,editFields),cancelDirty:()=>dirtyCloseCancel(form,editFields),dirtyNavigation:'close',discardDirty:await acceptedClose(form,'/admin/content/topics',async()=>{
      await form.locator('[data-admin-tab-id="basic"]').click();await control(form,'title').fill(edited);await control(form,'excerpt').fill(editedExcerpt);
    },true)});
    await permissionIntent(recipe, recipe.surfaces[1], "core-" + recipe.kind + "-content-edit", async () => {
      await accepted(form);
      await reloadValues(editFields, "basic");
      const descriptor = audit("topics", id, "topic", edited, "update", { title: edited, slug, excerpt: editedExcerpt, category_id: fixtures.category.id, content_type: recipe.kind, status: "unpublished", ...(markdown ? { content: body } : {}) }, payloadAudit);
      return { nativeWrites: [descriptor] };
    });
    return details(recipe, id, Object.keys(editFields), { publication: "unpublished", bodyBoundary: markdown ? "authored_markdown_roundtrip" : recipe.kind === "video" ? "authored_duration_and_draft_video_kind_only" : "draft_gallery_kind_only_no_media_selection_claim" });
  });

  for (const recipe of plan.projectEdits) await run(`core-project-${recipe.kind}-existing-form-edit`, recipe.coverage, async () => {
    await navigate(recipe.fixture.editorPath);
    let form = currentForm();
    await form.locator('[data-admin-tab-id="basic"]').click();
    const name = `QA Core ${recipe.kind} project ${suffix}`, description = `QA retained complete fixture with authored ${recipe.kind} description ${suffix}.`;
    await control(form, "arabic_name").fill(name);
    await control(form, "general_description").fill(description);
    const fields = { arabic_name: name, general_description: description };
    await dirtyCloseCancel(form, fields);
    await rejectRequired(form, "arabic_name", fields);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-project-"+recipe.kind+"-form-edit",journeyId:"core-project-"+recipe.kind+"-existing-form-edit",formConsumer:recipe.id,surface:recipe.surfaces[0]},form,submit:save(form),assertDraft:()=>valuesEqual(form,fields),cancelDirty:()=>dirtyCloseCancel(form,fields),dirtyNavigation:'close',discardDirty:await acceptedClose(form,'/admin/projects/'+recipe.kind,async()=>{
      await form.locator('[data-admin-tab-id="basic"]').click();await control(form,'arabic_name').fill(name);await control(form,'general_description').fill(description);
    },true)});
    await permissionIntent(recipe, recipe.surfaces[0], "core-project-" + recipe.kind + "-form-edit", async () => {
      await accepted(form);
      await reloadValues(fields, "basic");
      form = currentForm();
      await expect(control(form, "type")).toHaveValue(recipe.kind);
      const descriptor = audit("projects", recipe.fixture.id, "project", name, "update", { ...fields, type: recipe.kind, slug: recipe.fixture.slug });
      return { nativeWrites: [descriptor] };
    });
    return details(recipe, recipe.fixture.id, Object.keys(fields), { existingCompleteFixture: true, createNotCovered: true });
  });

  for (const recipe of plan.locations) await run(`core-location-${recipe.level}-form-create-edit`, recipe.coverage, async () => {
    locationRendered={recipe,surface:null,opened:new Set(),dirty:new Set(),observations:[]};
    const path = `/admin/projects/locations/${recipe.config.slug}`;
    await navigate(path, false);
    await page.getByRole("button", { name: `إضافة ${recipe.config.singularLabel}`, exact: true }).click();
    let form = page.locator(`#project-location-${recipe.level}-create`);
    await observeLocationOpening(form,page.getByRole("button",{name:`إضافة ${recipe.config.singularLabel}`,exact:true}),recipe.surfaces[0]);
    const name = `QA Core ${recipe.level} ${suffix}`, english = `QA Location ${recipe.level} ${suffix}`;
    await control(form, "name_ar").fill(name);
    await control(form, "name_en").fill(english);
    await control(form, "sort_order").fill("7");
    if (recipe.parentId) await selectValue(form, "parent_id", recipe.parentId);
    const fields = { name_ar: name, name_en: english, sort_order: 7, ...(recipe.parentId ? { parent_id: recipe.parentId } : {}) };
    await dirtyCloseCancel(form, fields, true);
    await rejectRequired(form, "name_ar", fields);
    let row;
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-location-"+recipe.level+"-form-create",journeyId:"core-location-"+recipe.level+"-form-create-edit",formConsumer:recipe.id,surface:recipe.surfaces[0]},form,submit:save(form),assertDraft:()=>valuesEqual(form,fields),cancelDirty:()=>dirtyCloseCancel(form,fields,true),dirtyNavigation:'close',observePending:()=>observeLocationPending(form,recipe.surfaces[0]),discardDirty:{trigger:form.getByRole('button',{name:'إلغاء',exact:true}),destination:{kind:'closed',pathname:path},reopenAndRefill:async()=>{await page.getByRole('button',{name:'إضافة '+recipe.config.singularLabel,exact:true}).click();for(const key of ['name_ar','name_en','sort_order'])await control(form,key).fill(String(fields[key]));if(recipe.parentId)await selectValue(form,'parent_id',recipe.parentId);}}});
    const id = await permissionIntent(recipe, recipe.surfaces[0], "core-location-" + recipe.level + "-form-create", async () => {
      await acknowledge(form);
      await expect(form).toHaveCount(0, { timeout: 60_000 });
      await expect(successfulFeedback()).toBeVisible();
      await observe("location-list-reload", () => page.goto(origin + path + "?q=" + encodeURIComponent(name), { waitUntil: "domcontentloaded" }));
      row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toHaveCount(1);
      const createdId = Number(await row.locator('[data-admin-row-action="more"]').getAttribute("data-admin-entity-id"));
      assert.ok(Number.isSafeInteger(createdId) && createdId > 0);
      const descriptor = audit("project_locations", createdId, "project_location", name, "create", {});
      await row.locator('[data-admin-row-action="edit"]').getByRole("button").click();
      form = page.locator("#project-location-" + recipe.level + "-edit");
      await observeLocationOpening(form,row.locator('[data-admin-row-action="edit"]').getByRole("button"),recipe.surfaces[1]);
      await valuesEqual(form, fields);
      return { value: createdId, nativeWrites: [{ ...descriptor, expected: { ...fields, level: recipe.level, parent_id: recipe.parentId, is_active: true } }] };
    });
    const editFields = { ...fields, name_ar: `${name} saved`, name_en: `${english} saved`, sort_order: 9 };
    for (const key of ["name_ar", "name_en", "sort_order"]) await control(form, key).fill(String(editFields[key]));
    await dirtyCloseCancel(form, editFields, true);
    await rejectRequired(form, "name_ar", editFields);
    await ctx.permissionReplay.restoreDraft({mapping:{caseId:"core-location-"+recipe.level+"-form-edit",journeyId:"core-location-"+recipe.level+"-form-create-edit",formConsumer:recipe.id,surface:recipe.surfaces[1]},form,submit:save(form),assertDraft:()=>valuesEqual(form,editFields),cancelDirty:()=>dirtyCloseCancel(form,editFields,true),dirtyNavigation:'close',observePending:()=>observeLocationPending(form,recipe.surfaces[1]),discardDirty:{trigger:form.getByRole('button',{name:'إلغاء',exact:true}),destination:{kind:'closed',pathname:path},reopenAndRefill:async()=>{await row.locator('[data-admin-row-action="edit"]').getByRole('button').click();for(const key of ['name_ar','name_en','sort_order'])await control(form,key).fill(String(editFields[key]));}}});
    await permissionIntent(recipe, recipe.surfaces[1], "core-location-" + recipe.level + "-form-edit", async () => {
      await acknowledge(form);
      await expect(form).toHaveCount(0, { timeout: 60_000 });
      await expect(successfulFeedback()).toBeVisible();
      await observe("location-edited-reload", () => page.goto(origin + path + "?q=" + encodeURIComponent(editFields.name_ar), { waitUntil: "domcontentloaded" }));
      row = page.getByRole("row").filter({ hasText: editFields.name_ar });
      await expect(row).toHaveCount(1);
      await row.locator('[data-admin-row-action="edit"]').getByRole("button").click();
      form = page.locator("#project-location-" + recipe.level + "-edit");
      await valuesEqual(form, editFields);
      await form.getByRole("button", { name: "إلغاء", exact: true }).click();
      await expect(form).toHaveCount(0);
      const descriptor = audit("project_locations", id, "project_location", editFields.name_ar, "update", { ...editFields, level: recipe.level, parent_id: recipe.parentId, is_active: true });
      return { nativeWrites: [descriptor] };
    });
    return details(recipe, id, Object.keys(editFields), { actualLevel: recipe.level, parentId: recipe.parentId });
  });
  return { planned: plan.taxonomy.length + plan.topics.length + plan.projectEdits.length + plan.locations.length, completed: completed.length, results: completed, pending: plan.pending, permissionEvidence, permissionCandidateKeys: [...new Set(permissionEvidence.map(item => item.candidateRequiredCase))], proofBoundary: ownedBoundary };
}

// Publication and rendered handoff are separate observations: the saved event
// alone cannot prove that the persistent Feedback viewport displayed the result.
export function assertCoreFormFeedbackPublicationSource(source){
 const begin=source.indexOf('    if (state.status === "idle" || handledResultRef.current === state) return;');assert.ok(begin>=0);
 const effect=source.slice(begin,source.indexOf('  }, [',begin));
 const publication=effect.indexOf('publishFeedback(nextFeedback, {'),error=effect.indexOf('if (state.status === "error")'),saved=effect.indexOf('new CustomEvent("admin-form-saved"'),success=effect.indexOf('onSuccess?.(state)'),navigation=effect.indexOf('router.replace(editHref');
 assert.ok(publication>=0&&error>publication&&saved>error&&success>saved&&navigation>success);
 assert.ok(effect.slice(error,saved).includes('return;'));
 const mapper=source.slice(source.indexOf('function formFeedback('),source.indexOf('function formFeedback(')+1300);
 assert.ok(mapper.includes('state.status === "success"')&&mapper.includes('state.status === "warning"')&&mapper.includes('dismissible: true'));
 return{path:'src/components/admin/ui/AdminFormRuntime.tsx',sha256:createHash('sha256').update(source).digest('hex'),publicationBeforeSavedEvent:true,savedEventBeforeHandoff:true};
}
export function assertCoreAcceptedFormFeedback(proof,{consumer,surface,entityId,entityKey,routePrefix,requiredCases,sourceSha256,sourceBinding}){
 assert.equal(requiredCases.filter(row=>row.boundary==='form'&&row.consumer===consumer&&row.surface===surface&&row.scenario==='save_reload').length,1);
 assert.equal(proof.consumer,consumer);assert.equal(proof.surface,surface);assert.equal(proof.entityId,entityId);assert.ok(Number.isSafeInteger(entityId)&&entityId>0);
 assert.equal(proof.sourceSha256,sourceSha256);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.deepEqual(proof.sourceBinding,sourceBinding);
 assert.equal(proof.events.length,1);assert.deepEqual(proof.events[0],{type:'admin-form-saved',entityId,targetIsForm:true,formConnected:true});
 assert.equal(proof.mode,'create');assert.equal(proof.entityKey,entityKey);assert.equal(proof.routePathname,routePrefix+'/'+entityId);assert.equal(proof.channel,'form:'+proof.entityKey);
 assert.equal(proof.publicationOrderObserved,true);assert.equal(proof.renderedRegionObserved,true);assert.equal(proof.postUnmountPersistenceRequired,true);assert.equal(proof.globalClosed,false);assert.deepEqual(proof.automaticCoverage,[]);
 assertCoreVisibleAcceptedFeedback(proof.visibleFeedback,proof.channel,sourceSha256);
 assert.equal(proof.visibleFeedback.routePathname,proof.routePathname);assert.equal(proof.visibleFeedback.createFormDetached,true);assert.equal(proof.visibleFeedback.placement,'global');assert.equal(proof.visibleFeedback.lifecycle,'manual');assert.equal(proof.visibleFeedback.dismissed,true);
 return proof;
}
export async function observeCoreAcceptedFormFeedback({form,consumer,surface,entityKey,routePrefix,requiredCases,perform}){
 await expect(form).toHaveCount(1);await expect(form).toBeVisible();await expect(form).toHaveAttribute('data-admin-form-mode','create');await expect(form).toHaveAttribute('data-admin-form-entity',entityKey);
 const sourceBinding=assertCoreFormFeedbackPublicationSource(readFileSync(new URL('../../src/components/admin/ui/AdminFormRuntime.tsx',import.meta.url),'utf8'));
 const observer=await form.evaluateHandle(node=>{const events=[];const handler=event=>{events.push({type:event.type,entityId:Number(event.detail?.entityId),targetIsForm:event.target===node,formConnected:node.isConnected});};node.addEventListener('admin-form-saved',handler);return{events,entityKey:node.getAttribute('data-admin-form-entity'),mode:node.getAttribute('data-admin-form-mode'),isConnected:()=>node.isConnected,dispose:()=>node.removeEventListener('admin-form-saved',handler)};});
 try{
  const page=form.page(),channel='form:'+entityKey;let accepted;
  const rendered=await observeCoreVisibleAcceptedFeedback({page,channel,perform:async()=>{
   accepted=await perform();assert.ok(Number.isSafeInteger(accepted.entityId)&&accepted.entityId>0);assert.equal(accepted.routePathname,routePrefix+'/'+accepted.entityId);
   await expect(page).toHaveURL(url=>url.pathname===accepted.routePathname);
   await expect.poll(()=>observer.evaluate(value=>value.isConnected())).toBe(false);
  }});
  const entry=page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="'+channel+'"]');
  await expect(page.locator('[data-admin-feedback-viewport][data-admin-feedback-placement="global"]').filter({has:entry})).toBeVisible();
  await expect(entry.locator('[data-admin-notice-lifecycle="manual"]')).toBeVisible();
  await entry.getByRole('button',{name:'إغلاق الإشعار',exact:true}).click();await expect(entry).toHaveCount(0);
  const visibleFeedback={...rendered,routePathname:new URL(page.url()).pathname,createFormDetached:true,placement:'global',lifecycle:'manual',dismissed:true};
  const observed=await observer.evaluate(value=>({events:value.events,entityKey:value.entityKey,mode:value.mode}));
  const proof={...observed,consumer,surface,entityId:accepted.entityId,channel:'form:'+observed.entityKey,routePathname:accepted.routePathname,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,sourceBinding,publicationOrderObserved:true,renderedRegionObserved:true,postUnmountPersistenceRequired:true,visibleFeedback,automaticCoverage:[],globalClosed:false};
  return assertCoreAcceptedFormFeedback(proof,{consumer,surface,entityId:accepted.entityId,entityKey,routePrefix,requiredCases,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,sourceBinding});
 }finally{await observer.evaluate(value=>value.dispose());await observer.dispose();}
}
export function assertCoreVisibleAcceptedFeedback(proof,channel,sourceSha256){
 assert.equal(proof.channel,channel);assert.equal(proof.sourceSha256,sourceSha256);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.ok(['success','warning'].includes(proof.variant));assert.equal(proof.visibleCount,1);assert.equal(proof.nonemptyMessage,true);assert.equal(proof.priorEntryDetached,true);assert.equal(proof.renderedRegionObserved,true);assert.equal(proof.observedBeforeReload,true);assert.deepEqual(proof.automaticCoverage,[]);assert.equal(proof.globalClosed,false);return proof;
}
export async function observeCoreVisibleAcceptedFeedback({page,channel,perform}){
 const entry=page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="'+channel+'"]');const priorCount=await entry.count();assert.ok(priorCount<=1);const previous=priorCount===1?await entry.elementHandle():null;
 try{await perform();await expect(entry).toHaveCount(1);await expect(entry).toBeVisible();await expect(entry).toHaveAttribute('data-admin-feedback-variant',/^(success|warning)$/u);if(previous)await expect.poll(()=>previous.evaluate(node=>node.isConnected)).toBe(false);assert.ok((await entry.innerText()).trim().length>0);
  return assertCoreVisibleAcceptedFeedback({channel,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,variant:await entry.getAttribute('data-admin-feedback-variant'),visibleCount:1,nonemptyMessage:true,priorEntryDetached:true,renderedRegionObserved:true,observedBeforeReload:true,automaticCoverage:[],globalClosed:false},channel,process.env.QA_ADMIN_SOURCE_SHA256);
 }finally{await previous?.dispose();}
}

/** Observe the existing Provider's actual DOM during a mounted read/error/retry window. */
export function createCoreMutationFeedbackAbsenceObserver() {
 const selector='[data-admin-feedback-entry]',initialCount=document.querySelectorAll(selector).length;
 let observedEntries=0,disconnected=false;const checkpoints=[];
 const countNode=node=>node?.nodeType===1?Number(node.matches(selector))+node.querySelectorAll(selector).length:0;
 const inspect=records=>{for(const record of records){if(record.type==='childList'){for(const node of [...record.addedNodes,...record.removedNodes])observedEntries+=countNode(node);}else if(record.type==='attributes'&&record.attributeName==='data-admin-feedback-entry'){observedEntries+=Math.max(countNode(record.target),Number(record.oldValue!==null));}}};
 const observer=new MutationObserver(inspect);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['data-admin-feedback-entry']});
 return {
  mark(label){inspect(observer.takeRecords());const count=document.querySelectorAll(selector).length;checkpoints.push({label,count});return count;},
  finish(){inspect(observer.takeRecords());const finalCount=document.querySelectorAll(selector).length;observer.disconnect();disconnected=true;return{initialCount,finalCount,observedEntries,checkpoints,disconnected};},
  disconnect(){observer.disconnect();disconnected=true;},
 };
}
export function assertCoreMutationFeedbackAbsence(proof,sourceSha256){
 assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(proof.sourceSha256,sourceSha256);
 for(const key of ['initialCount','finalCount','observedEntries'])assert.equal(proof[key],0);
 assert.deepEqual(proof.checkpoints,[{label:'query-error-visible',count:0},{label:'retry-success-visible',count:0}]);
 for(const key of ['disconnected','renderedRegionObserved','sameDocumentWindow','observedBeforeReload'])assert.equal(proof[key],true);
 assert.equal(proof.scope,'mounted-query-error-and-retry');assert.equal(proof.mutationResultFeedbackClaimed,false);assert.deepEqual(proof.automaticCoverage,[]);assert.equal(proof.globalClosed,false);return proof;
}
export async function observeCoreMutationFeedbackAbsence({page,perform}){
 const sourceSha256=process.env.QA_ADMIN_SOURCE_SHA256;assert.match(sourceSha256,/^[a-f0-9]{64}$/u);
 const pathname=new URL(page.url()).pathname,observer=await page.evaluateHandle(createCoreMutationFeedbackAbsenceObserver);
 try{
  await perform(async label=>{assert.equal(await observer.evaluate((value,marker)=>value.mark(marker),label),0);});
  assert.equal(new URL(page.url()).pathname,pathname);
  const observed=await observer.evaluate(value=>value.finish());
  return assertCoreMutationFeedbackAbsence({...observed,sourceSha256,renderedRegionObserved:true,sameDocumentWindow:true,observedBeforeReload:true,scope:'mounted-query-error-and-retry',mutationResultFeedbackClaimed:false,automaticCoverage:[],globalClosed:false},sourceSha256);
 }finally{try{await observer.evaluate(value=>value.disconnect());}finally{await observer.dispose();}}
}
