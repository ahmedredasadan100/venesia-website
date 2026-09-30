import {observeCoreVisibleAcceptedFeedback} from "./admin-core-domain-form-journeys.mjs";
import { exerciseCoreImageField } from "./admin-core-direct-image-adoption.mjs";
import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption} from "./admin-core-rendered-adoption.mjs";
import { runCoreDescendantPresentationJourneys } from './admin-core-descendant-presentation-journeys.mjs';
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";
import { PAGE_SEO_PHASES, PAGE_SEO_RECIPE, PAGE_SEO_INVALID_CANONICAL, assertPageSeoScope, summarizePageSeoRejection } from "./admin-core-page-seo-contract.mjs";

export const CORE_PAGE_COMPOSITION_FOLLOWUP_SELECTION = "page-composition-followup";
export const CORE_PAGE_COMPOSITION_CONTENT_SEO_SELECTION = "page-composition-content-seo-followup";
export const isCorePageCompositionFollowupSelection = selection => [CORE_PAGE_COMPOSITION_FOLLOWUP_SELECTION, CORE_PAGE_COMPOSITION_CONTENT_SEO_SELECTION].includes(selection);
export async function loadCorePageCompositionFollowupIds(selection = CORE_PAGE_COMPOSITION_FOLLOWUP_SELECTION) {
  assert.ok(isCorePageCompositionFollowupSelection(selection));
  const registry = await createJiti(import.meta.url, {fsCache:false,moduleCache:false}).import("../../src/lib/page-composition/slot-module-registry.ts");
  const all = [...registry.REGISTERED_SLOT_MODULE_KINDS.filter(kind=>kind!=="hero").map(kind=>"core-page-composition-"+kind+"-assignment"),"core-page-composition-layout-reject-retry","core-page-composition-seo-reject-retry-reload"];
  const selected = selection === CORE_PAGE_COMPOSITION_CONTENT_SEO_SELECTION ? ["core-page-composition-content-assignment", "core-page-composition-seo-reject-retry-reload"] : all;
  assert.ok(selected.every(id => all.includes(id)));
  return selected;
}
export async function assertCorePageCompositionFollowupReceipt(browser,canonicalRequiredCases) {
  assert.equal(browser.scope,"core-closure");assert.equal(browser.cohort,"page-composition");assert.ok(isCorePageCompositionFollowupSelection(browser.journeySelection));
  const ids=await loadCorePageCompositionFollowupIds(browser.journeySelection);assert.equal(ids.length,browser.journeySelection===CORE_PAGE_COMPOSITION_CONTENT_SEO_SELECTION?2:10);assert.equal(new Set(ids).size,ids.length);
  assert.equal(browser.driverCompleted,true);assert.equal(browser.status,"pass");assert.deepEqual(browser.errors,[]);assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);
  assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);assert.deepEqual(browser.evidence.map(row=>row.id),["existing-auth-login",...ids]);assert.ok(browser.evidence.every(row=>row.status==="pass"));
  const identities=rows=>{assert.ok(Array.isArray(rows)&&rows.length>0);assert.equal(new Set(rows.map(row=>row.key)).size,rows.length);return rows.map(row=>{const copy={...row};delete copy.status;delete copy.evidence;return copy;}).sort((a,b)=>a.key.localeCompare(b.key));};
  assert.deepEqual(identities(browser.requiredCases),identities(canonicalRequiredCases));
  return {selection:browser.journeySelection,selectedJourneyIds:ids,executedJourneyIds:ids,wholeCohortExecuted:false,automaticCoverage:[],globalClosed:false};
}

const consumer = "page-composition-and-seo";
const collectionConsumers = ["page-block-assignments", "page-composition-shell"];
const identity = row => row.kind + ":" + row.id;
const number = value => { const n = Number(value); assert.ok(Number.isSafeInteger(n) && n > 0); return n; };

export function buildCorePageCompositionPlan({ fixtures, manifest, collections, kinds, positionCapabilities, getAssignablePositions, regions, requiredCases }) {
  const forms = manifest.filter(entry => entry.id === consumer);
  assert.equal(forms.length, 1);
  for (const surface of ["assignment", "composition", "layout", "seo"]) assert.ok(forms[0].surfaces.includes(surface));
  for (const id of collectionConsumers) assert.equal(collections.filter(entry => entry.id === id).length, 1);
  assert.equal(fixtures.pages.editorPath, "/admin/pages-blocks/pages/" + number(fixtures.pages.pageId));
  assert.ok(Array.isArray(kinds) && kinds.length > 0 && new Set(kinds).size === kinds.length);
  assert.deepEqual([...kinds].sort(), Object.keys(positionCapabilities).sort());
  assert.ok(Array.isArray(regions) && regions.length > 1 && new Set(regions.map(row => row.key)).size === regions.length);
  const templates = kinds.map(kind => {
    const matches = fixtures.pages.templates.filter(row => row.kind === kind && row.assigned === false
      && row.slug === fixtures.pages.slug + "-" + kind + "-3");
    assert.equal(matches.length, 1, "Each kind requires its reserved Unused 3 fixture.");
    number(matches[0].id);
    const slots = getAssignablePositions(kind, regions.map(row => row.key));
    assert.ok(slots.length > 0, "The current fixture layout must provide compatible positions.");
    return { ...matches[0], slots, fixed: positionCapabilities[kind].mode === "fixed" };
  });
  const relatedCases = requiredCases.filter(row => (row.boundary === "form" && row.consumer === consumer)
    || (row.boundary === "collection" && collectionConsumers.includes(row.consumer))).map(row => row.key);
  assert.ok(relatedCases.length > 0);
  return { templates, assignments: templates.filter(row => !row.fixed), fixed: templates.filter(row => row.fixed), relatedCases };
}

/** Exact no-write proof, including the page-bound audit set, after an actual cancel/rejection. */
export function assertPageCompositionUnchanged(before, after) {
  assert.equal(before.ownedRunId, after.ownedRunId); assert.equal(before.pageId, after.pageId);
  assert.equal(number(before.qaActorId), number(after.qaActorId), "The canonical QA actor must remain unchanged.");
  for (const key of ["page", "assignments", "layouts", "regions", "audit", "templates", "templateCopies"]) assert.deepEqual(after[key], before[key], "Unexpected composition change after cancel/rejection: " + key);
}

export function assertPageCompositionAudit(before, after, operation) {
  assert.equal(before.ownedRunId, after.ownedRunId); assert.equal(before.pageId, after.pageId);
  assert.equal(number(before.qaActorId), number(after.qaActorId), "The canonical QA actor must remain unchanged.");
  const previous = new Set(before.audit.map(row => String(row.id)));
  assert.deepEqual(after.audit.filter(row => previous.has(String(row.id))), before.audit, "Earlier immutable composition audit changed.");
  const added = after.audit.filter(row => !previous.has(String(row.id)));
  assert.equal(added.length, 1, "One concrete intent requires one composition audit.");
  const row = added[0];
  assert.equal(row.action, "page_composition." + operation);
  assert.equal(row.operation, operation); assert.equal(row.persistence_owner, "mutate_page_composition"); assert.equal(row.atomic, true);
  assert.equal(row.entity_type, "page_composition"); assert.equal(number(row.entity_id), before.pageId);
  assert.equal(number(row.actor_admin_user_id), number(before.qaActorId), "The new audit must belong to the canonical QA actor.");
  return row.id;
}


/** Existing RPC normalizes all ordinary assignment orders in each slot. */
function assertAssignmentOrderNormalization(beforeRows, afterRows, inserted) {
  const before=beforeRows.filter(row=>row.kind!=="hero"),slots=[...new Set(before.map(row=>row.slot))];
  for(const slot of slots){
    const rows=before.filter(row=>row.slot===slot);
    assert.equal(new Set(rows.map(row=>row.sort_order)).size,rows.length,"This fixed QA recipe requires distinct pre-intent orders; SQL tie collation is not inferred.");
    if(inserted?.slot===slot)rows.push(inserted);
    rows.sort((a,b)=>a.sort_order-b.sort_order);
    assert.equal(new Set(rows.map(row=>row.sort_order)).size,rows.length,"The inserted copy must have its own pre-normalization order.");
    rows.forEach((row,index)=>assert.equal(afterRows.find(value=>identity(value)===identity(row))?.sort_order,(index+1)*10));
  }
  for(const hero of beforeRows.filter(row=>row.kind==="hero"))assert.deepEqual(afterRows.find(row=>identity(row)===identity(hero)),hero);
  // The atomic guard stamps each updated row with clock_timestamp(), not one shared RPC timestamp.
  for (const row of afterRows.filter(value => value.kind !== "hero")) {
    const updated = Date.parse(row.updated_at);
    assert.ok(Number.isFinite(updated), "Every normalized assignment needs a valid timestamp.");
    const previous = beforeRows.find(value => identity(value) === identity(row));
    if (previous) assert.ok(updated > Date.parse(previous.updated_at), "Every normalized existing assignment must receive a newer timestamp.");
  }
}
/** Existing composition snapshots, exact actual UI intent; no capability promotion. */
export function assertPageAssignmentVisibility(before,after,assignmentKey,visible) {
  assert.equal(typeof visible,"boolean");
  for(const key of ["page","layouts","regions","templates","templateCopies"])assert.deepEqual(after[key],before[key]);
  assert.equal(after.assignments.length,before.assignments.length);
  const target=before.assignments.find(row=>identity(row)===assignmentKey);assert.ok(target&&target.kind!=="hero");assert.notEqual(target.is_visible,visible);
  for(const expected of before.assignments){const actual=after.assignments.find(row=>identity(row)===identity(expected));assert.ok(actual);assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());
    for(const key of Object.keys(expected).filter(key=>!["sort_order","updated_at"].includes(key)))assert.deepEqual(actual[key],key==="is_visible"&&identity(expected)===assignmentKey?visible:expected[key]);}
  assertAssignmentOrderNormalization(before.assignments,after.assignments);
  return assertPageCompositionAudit(before,after,"bulk");
}
export function assertPageAssignmentDuplicate(before,after,assignmentKey) {
  for(const key of ["page","layouts","regions","templates"])assert.deepEqual(after[key],before[key]);
  const source=before.assignments.find(row=>identity(row)===assignmentKey);assert.ok(source&&source.kind!=="hero");
  const prior=new Set(before.assignments.map(identity)),added=after.assignments.filter(row=>!prior.has(identity(row)));assert.equal(added.length,1);assert.equal(after.assignments.length,before.assignments.length+1);
  const clone=added[0];assert.equal(clone.kind,source.kind);assert.equal(number(clone.page_id),before.pageId);assert.notEqual(number(clone.template_id),number(source.template_id));assert.equal(clone.slot,source.slot);assert.equal(clone.is_visible,false);
  for(const row of before.assignments){const retained=after.assignments.find(candidate=>identity(candidate)===identity(row));assert.ok(retained);assert.deepEqual(Object.keys(retained).sort(),Object.keys(row).sort());for(const key of Object.keys(row).filter(key=>!["sort_order","updated_at"].includes(key)))assert.deepEqual(retained[key],row[key]);}
  assertAssignmentOrderNormalization(before.assignments,after.assignments,{...clone,sort_order:source.sort_order+1});
  assert.equal(after.templateCopies.length,before.templateCopies.length+1);assert.deepEqual(after.templateCopies.filter(row=>!(row.kind===source.kind.replaceAll("_","-")&&number(row.row.id)===number(clone.template_id))),before.templateCopies);
  const original=before.templates.find(row=>row.kind===source.kind.replaceAll("_","-")&&number(row.id)===number(source.template_id));assert.ok(original?.source_row);
  const copy=after.templateCopies.find(row=>row.kind===original.kind&&number(row.row.id)===number(clone.template_id));assert.ok(copy);assert.equal(number(copy.sourceTemplateId),number(source.template_id));
  const allowed=new Set(["id","name","slug","created_at","updated_at","status","is_visible"]);assert.deepEqual(Object.keys(copy.row).sort(),Object.keys(original.source_row).sort());for(const[key,value]of Object.entries(original.source_row))if(!allowed.has(key))assert.deepEqual(copy.row[key],value,"Copied authored field changed: "+key);
  assert.equal(copy.row.name,original.source_row.name+" — نسخة");assert.equal(copy.row.slug,original.source_row.slug+"-copy-"+copy.row.id);if(Object.hasOwn(copy.row,"status"))assert.equal(copy.row.status,"draft");if(Object.hasOwn(copy.row,"is_visible"))assert.equal(copy.row.is_visible,false);assert.ok(Number.isFinite(Date.parse(copy.row.created_at)));assert.equal(copy.row.created_at,copy.row.updated_at);
  return{assignment:clone,template:copy.row,auditId:assertPageCompositionAudit(before,after,"duplicate_assignment")};
}

/** One actual ordinary assignment, joined to its six current native snapshots. */
export function assertCorePageAssignmentRowActionsJoin(browser,native,context) {
  const {fixtures,formManifest,collectionManifest,kinds,positionCapabilities,getAssignablePositions,ownedRunId,actorId,sourceSha256}=context;
  assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'page-composition');assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.deepEqual(browser.errors,[]);assert.equal(browser.globalClosed,false);
  assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(browser.sourceSha256,sourceSha256);assert.ok(typeof ownedRunId==='string'&&ownedRunId);number(actorId);
  assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.ok(Array.isArray(native.records));assert.equal(new Set(native.records.map(row=>row.id)).size,native.records.length);
  assert.ok(browser.evidence.every(row=>row.status==='pass'));assert.equal(new Set(browser.evidence.map(row=>row.id)).size,browser.evidence.length);
  const logins=browser.evidence.filter(row=>row.id==='existing-auth-login');assert.equal(logins.length,1);assert.equal(logins[0].authenticated,true);assert.equal(logins[0].sessionArtifactWritten,false);assert.match(logins[0].dashboardState,/^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
  const initial=native.records.find(row=>row.kind==='page-composition-state');assert.ok(initial);
  assert.equal(initial.ownedRunId,ownedRunId);assert.equal(number(initial.qaActorId),actorId);assert.equal(initial.pageId,fixtures.pages.pageId);
  const plan=buildCorePageCompositionPlan({fixtures,manifest:formManifest,collections:collectionManifest.surfaces,kinds,positionCapabilities,getAssignablePositions,
    regions:initial.regions.filter(row=>number(row.layout_id)===number(initial.page.layout_id)),requiredCases:browser.requiredCases});
  const template=plan.assignments[0];assert.ok(template);
  const matches=browser.evidence.filter(row=>row.rowActionsEvidence!=null);assert.equal(matches.length,1,'Only the first manageable ordinary assignment owns this proof.');
  const row=matches[0],proof=row.rowActionsEvidence;assert.equal(row.id,'core-page-composition-'+template.kind+'-assignment');assert.equal(row.consumer,consumer);assert.deepEqual(row.coverage,[]);assert.deepEqual(row.automaticCoverage,[]);
  assert.equal(proof.kind,template.kind);assert.equal(proof.sourceTemplateId,template.id);assert.equal(row.templateId,template.id);assert.equal(number(row.assignmentId),number(proof.sourceAssignmentId));assert.deepEqual(proof.automaticCoverage,[]);assert.equal(proof.globalClosed,false);
  assert.deepEqual(proof.observations,['actual_information_back_and_focus','actual_edit_navigation_and_return','actual_current_public_link_opened','actual_visibility_cycle_reload_native','actual_duplicate_template_assignment_audit_handoff','unpublished_copy_visibility_disabled']);
  assert.ok(Array.isArray(proof.nativeIds));assert.equal(proof.nativeIds.length,6);assert.equal(new Set(proof.nativeIds).size,6);
  const indices=proof.nativeIds.map(id=>native.records.findIndex(record=>record.id===id));assert.ok(indices.every(index=>index>=0));assert.deepEqual(indices,indices.map((_,index)=>indices[0]+index),'Six row-action snapshots must retain actual broker order with no skipped observation.');
  const states=indices.map(index=>native.records[index]);
  for(const state of states){assert.equal(state.kind,'page-composition-state');assert.equal(state.status,'pass');assert.equal(state.ownedRunId,ownedRunId);assert.equal(number(state.qaActorId),actorId);assert.equal(state.pageId,fixtures.pages.pageId);assert.equal(number(state.page.id),fixtures.pages.pageId);assert.equal(state.page.slug,fixtures.pages.slug);assert.ok(Number.isFinite(Date.parse(state.startedAt)));assert.equal(state.startedAt,states[0].startedAt);assert.equal(state.seo,undefined);for(const entry of state.audit)assert.equal(number(entry.actor_admin_user_id),actorId);}
  const [before,readonly,hidden,shown,duplicate,reloaded]=states,key=template.kind.replaceAll('-','_')+':'+proof.sourceAssignmentId;
  const assignment=before.assignments.find(value=>identity(value)===key);assert.ok(assignment);assert.equal(number(assignment.template_id),template.id);assert.equal(assignment.is_visible,true);
  assertPageCompositionUnchanged(before,readonly);
  const audits=[assertPageAssignmentVisibility(readonly,hidden,key,false),assertPageAssignmentVisibility(hidden,shown,key,true)];
  const copied=assertPageAssignmentDuplicate(shown,duplicate,key);audits.push(copied.auditId);assertPageCompositionUnchanged(duplicate,reloaded);
  assert.equal(number(copied.assignment.id),proof.copyAssignmentId);assert.equal(number(copied.template.id),proof.copyTemplateId);assert.notEqual(proof.copyAssignmentId,proof.sourceAssignmentId);assert.notEqual(proof.copyTemplateId,proof.sourceTemplateId);
  assert.equal(new Set(audits.map(String)).size,3);
  return{status:'pass',kind:template.kind,pageId:fixtures.pages.pageId,sourceAssignmentId:proof.sourceAssignmentId,sourceTemplateId:template.id,copyAssignmentId:proof.copyAssignmentId,copyTemplateId:proof.copyTemplateId,
    ownedRunId,actorId,sourceSha256,nativeIds:[...proof.nativeIds],atomicAuditIds:audits,visibilityWrites:2,duplicateWrites:1,readOnlyTransitions:2,automaticCoverage:[],globalClosed:false,
    boundary:'Only the first actual manageable ordinary assignment and its six joined observations; no all-kind, Hero, generic Preview matrix or full-axis claim.'};
}

export async function runCorePageCompositionJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, requiredCases, compositionCheckpoint } = ctx;
  assert.equal(new URL(origin).origin, origin); assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.equal(typeof compositionCheckpoint, "function", "The bounded native composition checkpoint must be wired.");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../../src/lib/admin/interaction-system/adoption-manifest.ts");
  const { REGISTERED_SLOT_MODULE_KINDS: kinds } = await jiti.import("../../src/lib/page-composition/slot-module-registry.ts");
  const { MODULE_POSITION_CAPABILITIES: positionCapabilities, getAssignablePositions, comparePageAssignmentOrder } = await jiti.import("../../src/lib/page-composition/page-assignment-contract.ts");
  const { moduleKindLabel, moduleEditHref, MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM } = await jiti.import("../../src/lib/page-blocks/admin-utils.ts");
  const pageId = number(fixtures.pages.pageId), startedAt = new Date().toISOString();
  const layoutKey = "qa-core-layout-" + Date.now().toString(36);
  const templateRefs = kinds.map(kind => {
    const rows = fixtures.pages.templates.filter(row => row.kind === kind && row.assigned === false && row.slug === fixtures.pages.slug + "-" + kind + "-3");
    assert.equal(rows.length, 1); return { kind, id: number(rows[0].id) };
  });
  const checkpoints = [], results = [];
  async function snapshot(label, seoPhase) {
    const request = { id: randomUUID(), kind: "page-composition-state", pageId, startedAt, layoutKeys: [layoutKey], templateRefs, ...(seoPhase ? {seoPhase} : {}) };
    const value = await observe("composition-native-" + label, () => compositionCheckpoint(request));
    assert.equal(value?.id, request.id); assert.equal(value.kind, request.kind); assert.equal(value.status, "pass");
    assert.equal(value.pageId, pageId); assert.equal(value.startedAt, startedAt);
    assert.ok(typeof value.ownedRunId === "string" && value.ownedRunId.length > 0);
    for (const key of ["assignments", "layouts", "regions", "audit", "templates", "templateCopies"]) assert.ok(Array.isArray(value[key]));
    assert.equal(number(value.page.id), pageId); number(value.qaActorId);
    if(seoPhase){assert.equal(value.seo?.phase,seoPhase);assert.equal(value.seo?.status,"pass");}
    checkpoints.push({ label, receiptId: value.id });
    return value;
  }
  const followup = isCorePageCompositionFollowupSelection(ctx.journeySelection);
  const contentSeoOnly = ctx.journeySelection === CORE_PAGE_COMPOSITION_CONTENT_SEO_SELECTION;
  if (!followup) await runCoreDescendantPresentationJourneys({...ctx,nativeCheckpoint:compositionCheckpoint},"composition");
  const initial = await snapshot("initial");
  const originalLayoutId = number(initial.page.layout_id);
  const regions = initial.regions.filter(region => number(region.layout_id) === originalLayoutId);
  const plan = buildCorePageCompositionPlan({ fixtures, manifest, collections: ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces,
    kinds, positionCapabilities, getAssignablePositions, regions, requiredCases });
  // Assignment and duplicate actions add at most two rows to the initial fixture.
  // Use the existing bounded URL owner so row assertions include those rows.
  const { ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS } = await jiti.import("../../src/lib/admin/entity-list/pagination.ts");
  const assignmentPageSize = ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS.find(size => size >= initial.assignments.length + 2);
  assert.ok(assignmentPageSize, "The existing fixture must fit a supported assignment page size.");
  const table = () => page.locator("[data-page-composition-table-surface]");
  const assignedRow = template => table().locator("article").filter({ has: page.getByRole("link", { name: template.name, exact: true }) });
  const dialog = () => page.getByRole("dialog", { name: "ربط موديول بالصفحة", exact: true });
  const feedback = channel => page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="' + channel + '"]');
  async function navigate(tab = "modules") {
    await observe("composition-navigation", () => page.goto(origin + fixtures.pages.editorPath + "?tab=" + tab + (tab === "modules" ? "&limit=" + assignmentPageSize : ""), { waitUntil: "domcontentloaded" }));
    await expect(page.locator('[data-admin-tab-id="' + tab + '"]')).toHaveAttribute("aria-selected", "true");
  }
  async function reload(tab = "modules") {
    await observe("composition-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    await expect(page.locator('[data-admin-tab-id="' + tab + '"]')).toHaveAttribute("aria-selected", "true");
  }
  async function action(label, click) {
    await observe(label, async () => {
      const [response] = await Promise.all([actionResponse(), click()]);
      assertActionAcknowledged(response);
    });
  }
  async function select(owner, name, value) {
    const field = owner.locator('select[name="' + name + '"]');
    const option = field.locator('option[value="' + value + '"]');
    await expect(option).toHaveCount(1);
    const label = (await option.textContent()).trim();
    await owner.locator('[data-admin-form-listbox]:has(select[name="' + name + '"])').getByRole("combobox").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(field).toHaveValue(String(value));
  }
  let renderedAdoption=[],renderedAssignmentObserved=false;
  const compositionRenderedBase=(surface,axis)=>({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:"form",consumer,surface},...(axis==="modal"?collectionConsumers.map(consumer=>({boundary:"collection",consumer,surface:new URL(page.url()).pathname})):[])]});
  async function observeAssignmentModal(template) {
    if(renderedAssignmentObserved)return;
    const current=dialog(),prefix="composition-"+template.kind+"-assignment";
    renderedAdoption.push(await observeCoreModalFocusAdoption({...compositionRenderedBase("assignment","modal"),id:prefix+"-focus",dialog:current}));
    const body=current.locator(":scope > div").filter({has:page.locator("#assign-page-block-form")});
    const target=current.getByText("الربط الظاهر لا يكفي وحده",{exact:false});
    renderedAdoption.push(await observeCoreScrollbarAdoption({...compositionRenderedBase("assignment","scrollbar"),id:prefix+"-scroll",container:body,target,axis:"y",containment:"modal-lock"}));
    renderedAssignmentObserved=true;
  }
  async function observeRemovalModal(confirmation,template) {
    renderedAdoption.push(await observeCoreModalFocusAdoption({...compositionRenderedBase("composition","modal"),id:"composition-"+template.kind+"-remove-focus",dialog:confirmation,state:"dirty-confirmation",escape:"not-exercised"}));
  }
  async function openAssignment(template, slot, order) {
    await page.getByRole("button", { name: "إضافة موديول", exact: true }).click();
    await expect(dialog()).toBeVisible();
    await dialog().getByRole("combobox", { name: "نوع الموديول", exact: true }).click();
    await page.getByRole("option", { name: moduleKindLabel(template.kind), exact: true }).click();
    const templateField = dialog().locator('[data-admin-form-listbox]:has(select[name="template_id"])');
    await expect(templateField).toHaveAttribute("data-admin-form-listbox-state", template.fixed ? "empty" : "ready", { timeout: 60_000 });
    if (template.fixed) {await observeAssignmentModal(template);return;}
    const slotValues = await dialog().locator('select[name="slot"] option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
    assert.deepEqual(slotValues, template.slots, "The picker must expose exactly the current canonical compatible positions.");
    for (const existing of fixtures.pages.templates.filter(row => row.kind === template.kind && row.assigned)) {
      await expect(dialog().locator('select[name="template_id"] option[value="' + existing.id + '"]')).toHaveCount(0);
    }
    await select(dialog(), "template_id", template.id);
    await select(dialog(), "slot", slot);
    await dialog().locator('input[name="sort_order"]').fill(String(order));
    await observeAssignmentModal(template);
  }
  async function removal(template) {
    await assignedRow(template).locator('[data-admin-row-action="more"]').getByRole("button").click();
    await page.locator('[data-admin-row-action-menu-item="delete"]').click();
    const confirmation = page.getByRole("dialog", { name: "تأكيد الإزالة من الصفحة", exact: true });
    await expect(confirmation).toBeVisible(); await expect(confirmation).toContainText(template.name);
    return confirmation;
  }

  async function assignmentRowActions(template,assignment,state) {
    const key=identity(assignment),before=state,observations=[],receiptIds=[before.id],row=()=>assignedRow(template);
    await row().locator('[data-admin-row-action="more"] button').click();await page.locator('[data-admin-row-action-menu-item="information"]').click();
    const information=page.locator('[data-admin-row-actions-information]');await expect(information).toHaveAttribute('data-admin-entity-type','page_module_assignment');await expect(information).toHaveAttribute('data-admin-entity-id',template.kind+':'+assignment.id);await expect(information).toContainText('معلومات '+template.name);await expect(information).toContainText(moduleKindLabel(template.kind));
    if(template.kind!=='breadcrumb')await expect(information).toContainText(template.slug);
    await information.getByRole('button',{name:'رجوع',exact:true}).click();await expect(page.locator('[data-admin-row-action-menu-item="information"]')).toBeFocused();await page.keyboard.press('Escape');await expect(row().locator('[data-admin-row-action="more"] button')).toBeFocused();observations.push('actual_information_back_and_focus');
    const edit=row().locator('[data-admin-row-action="edit"] a'),href=await edit.getAttribute('href');assert.ok(href);const editUrl=new URL(href,origin),expectedEdit=new URL(moduleEditHref(template.kind,template.id,{returnPageId:pageId}),origin);assert.equal(editUrl.origin,origin);assert.equal(editUrl.pathname,expectedEdit.pathname);assert.equal(expectedEdit.searchParams.get(MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM),String(pageId));assert.equal(editUrl.searchParams.get(MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM),String(pageId));
    await edit.click();await expect(page).toHaveURL(url=>url.origin===origin&&url.pathname===expectedEdit.pathname);await navigate();await expect(row()).toHaveCount(1);observations.push('actual_edit_navigation_and_return');
    const preview=row().locator('[data-admin-row-action="preview"] a');await expect(preview).toHaveCount(1);const previewHref=await preview.getAttribute('href');assert.ok(previewHref);const previewUrl=new URL(previewHref,origin);assert.equal(previewUrl.origin,origin);assert.equal(previewUrl.pathname,before.page.path);await expect(preview).toHaveAttribute('target','_blank');
    const popupPromise=page.waitForEvent('popup');await preview.click();const popup=await popupPromise;try{await popup.waitForURL(url=>url.origin===origin&&url.pathname===previewUrl.pathname);observations.push('actual_current_public_link_opened');}finally{await popup.close();}
    let after=await snapshot(template.kind+'-row-readonly');receiptIds.push(after.id);assertPageCompositionUnchanged(before,after);
    const toggle=()=>row().locator('[data-admin-row-action="visibility"] button');await expect(toggle()).toHaveCount(1);await expect(toggle()).toHaveAttribute('aria-pressed','true');
    for(const visible of [false,true]){const prior=after;await action('composition-row-visibility-'+visible,()=>toggle().click());await expect(toggle()).toHaveAttribute('aria-pressed',String(visible));await reload();await expect(toggle()).toHaveAttribute('aria-pressed',String(visible));after=await snapshot(template.kind+'-visibility-'+visible);receiptIds.push(after.id);assertPageAssignmentVisibility(prior,after,key,visible);}observations.push('actual_visibility_cycle_reload_native');
    const preCopy=after;await row().locator('[data-admin-row-action="more"] button').click();await action('composition-row-duplicate',()=>page.locator('[data-admin-row-action-menu-item="duplicate"]').click());
    await expect(page).not.toHaveURL(url=>url.pathname===fixtures.pages.editorPath,{timeout:60_000});after=await snapshot(template.kind+'-duplicated');receiptIds.push(after.id);const copied=assertPageAssignmentDuplicate(preCopy,after,key),copyPath=new URL(moduleEditHref(template.kind,number(copied.template.id),{returnPageId:pageId}),origin).pathname;await expect(page).toHaveURL(url=>url.origin===origin&&url.pathname===copyPath);await navigate();
    const copyRow=table().locator('article').filter({has:page.getByRole('link',{name:copied.template.name,exact:true})});await expect(copyRow).toHaveCount(1);await expect(copyRow.locator('[data-admin-row-action="visibility"] button')).toBeDisabled();await reload();await expect(copyRow).toHaveCount(1);const reloaded=await snapshot(template.kind+'-duplicate-reloaded');receiptIds.push(reloaded.id);assertPageCompositionUnchanged(after,reloaded);observations.push('actual_duplicate_template_assignment_audit_handoff','unpublished_copy_visibility_disabled');
    return{state:reloaded,evidence:{sourceAssignmentId:number(assignment.id),sourceTemplateId:template.id,kind:template.kind,copyAssignmentId:number(copied.assignment.id),copyTemplateId:number(copied.template.id),observations,nativeIds:receiptIds,automaticCoverage:[],globalClosed:false,boundary:'One current ordinary manageable assignment exercises the shared exposed actions. Public-link destination only, not a Preview publication-matrix claim; no Hero duplicate or every-kind claim.'}};
  }

  const ordered = (state, slot) => state.assignments.filter(row => row.kind !== "hero" && row.slot === slot).sort((a, b) =>
    comparePageAssignmentOrder({ sortOrder: a.sort_order, moduleKind: a.kind.replaceAll("_", "-"), assignmentId: number(a.id) },
      { sortOrder: b.sort_order, moduleKind: b.kind.replaceAll("_", "-"), assignmentId: number(b.id) }));
  const result = (id, details) => {
    const value = { id, consumer, collectionConsumers, renderedAdoption:[...renderedAdoption], automaticCoverage: [], relatedRequiredCases: plan.relatedCases, ...details,
      proofBoundary: "Only these concrete current Page Composition and SEO UI/native journeys. No complete capability axis or generic SEO rollback claim." };
    results.push(value);renderedAdoption=[];renderedAssignmentObserved=false;return value;
  };

  for (const template of (followup ? [] : plan.fixed)) await run("core-page-composition-fixed-" + template.kind, [], async () => {
    renderedAdoption=[];renderedAssignmentObserved=false;
    await navigate(); const before = await snapshot(template.kind + "-before");
    assert.ok(before.assignments.some(row => row.kind === template.kind), "The fixed-kind exclusion requires its actual existing assignment.");
    await openAssignment(template);
    await expect(dialog().getByRole("button", { name: "ربط الموديول", exact: true })).toBeDisabled();
    await expect(dialog().locator('select[name="template_id"] option')).toHaveCount(1);
    await expect(dialog()).toContainText("هذه الصفحة مرتبطة بهيرو واحد بالفعل");
    await dialog().getByRole("button", { name: "إلغاء", exact: true }).click();
    await expect(dialog()).toHaveCount(0);
    const after = await snapshot(template.kind + "-after"); assertPageCompositionUnchanged(before, after);
    return result("fixed-" + template.kind, { verified: ["existing_fixed_assignment_blocks_second_picker"], checkpoints: [before.id, after.id] });
  });

  for (const template of plan.assignments.filter(row => !contentSeoOnly || row.kind === "content")) await run("core-page-composition-" + template.kind + "-assignment", [], async () => {
    renderedAdoption=[];renderedAssignmentObserved=false;
    await navigate(); let before = await snapshot(template.kind + "-before");
    const slot = template.slots.find(value => value !== "hero"); assert.ok(slot);
    const sortOrder = Math.max(0, ...ordered(before, slot).map(row => row.sort_order)) + 10;
    await openAssignment(template, slot, sortOrder);
    await dialog().getByRole("button", { name: "إلغاء", exact: true }).click();
    await expect(dialog()).toHaveCount(0);
    assertPageCompositionUnchanged(before, await snapshot(template.kind + "-add-cancel"));
    await openAssignment(template, slot, sortOrder);
    const acceptedFeedback=await observeCoreVisibleAcceptedFeedback({page,channel:"page-composition:"+pageId,perform:()=>action("composition-add", () => dialog().getByRole("button", { name: "ربط الموديول", exact: true }).click())});
    await expect(dialog()).toHaveCount(0, { timeout: 60_000 });
    await expect(assignedRow(template)).toHaveCount(1); await reload(); await expect(assignedRow(template)).toHaveCount(1);
    let after = await snapshot(template.kind + "-added");
    const added = after.assignments.filter(row => row.kind === template.kind.replaceAll("-", "_") && number(row.template_id) === template.id);
    assert.equal(added.length, 1); const assignment = added[0], assignmentKey = identity(assignment);
    assert.equal(assignment.slot, slot); assert.equal(assignment.is_visible, true); assert.equal(assignment.sort_order, sortOrder);
    assert.equal(after.assignments.length, before.assignments.length + 1);
    const auditIds = [assertPageCompositionAudit(before, after, "save_assignment")];
    assert.deepEqual(after.templates, before.templates);
    const priorOrder = ordered(after, slot).map(identity); assert.equal(priorOrder.at(-1), assignmentKey);
    const handle = assignedRow(template).locator("[data-admin-grid-reorder-handle]");
    await expect(handle).toBeEnabled(); assert.ok(Number(await handle.getAttribute("data-reorder-position")) > 0);
    before = after;
    await action("composition-keyboard-reorder", () => handle.press("Home"));
    await expect(handle).toHaveAttribute("data-reorder-position", "0");
    await reload(); await expect(assignedRow(template).locator("[data-admin-grid-reorder-handle]")).toHaveAttribute("data-reorder-position", "0");
    after = await snapshot(template.kind + "-reordered");
    assert.deepEqual(ordered(after, slot).map(identity), [assignmentKey, ...priorOrder.filter(key => key !== assignmentKey)]);
    auditIds.push(assertPageCompositionAudit(before, after, "reorder"));
    const destination = template.slots.find(value => value !== slot && value !== "hero"); assert.ok(destination);
    const destinationLabel = regions.find(region => region.key === destination).admin_label;
    await assignedRow(template).getByRole("combobox", { name: "موضع عرض " + template.name, exact: true }).click();
    before = after;
    await action("composition-position-change", () => page.getByRole("option", { name: destinationLabel, exact: true }).click());
    await expect(assignedRow(template).getByRole("combobox", { name: "موضع عرض " + template.name, exact: true })).toContainText(destinationLabel);
    await reload();
    after = await snapshot(template.kind + "-positioned");
    assert.equal(after.assignments.find(row => identity(row) === assignmentKey).slot, destination);
    auditIds.push(assertPageCompositionAudit(before, after, "save_assignment"));
    let rowActionsEvidence=null;
    if(template.kind===plan.assignments[0].kind){const exercised=await assignmentRowActions(template,assignment,after);after=exercised.state;rowActionsEvidence=exercised.evidence;}
    const confirmation = await removal(template);
    await observeRemovalModal(confirmation,template);
    await confirmation.locator("[data-admin-confirm-cancel]").click(); await expect(confirmation).toHaveCount(0);
    await expect(assignedRow(template)).toHaveCount(1);
    assertPageCompositionUnchanged(after, await snapshot(template.kind + "-remove-cancel"));
    const confirmed = await removal(template); before = after;
    await action("composition-remove", () => confirmed.locator("[data-admin-confirm-submit]").click());
    await expect(confirmed).toHaveCount(0); await expect(assignedRow(template)).toHaveCount(0);
    await reload(); await expect(assignedRow(template)).toHaveCount(0);
    after = await snapshot(template.kind + "-removed");
    assert.equal(after.assignments.some(row => identity(row) === assignmentKey), false);
    assert.equal(after.assignments.length, before.assignments.length - 1); assert.deepEqual(after.templates, before.templates);
    auditIds.push(assertPageCompositionAudit(before, after, "bulk"));
    return result("assignment-" + template.kind, { acceptedFeedback, templateId: template.id, assignmentId: number(assignment.id), auditIds, rowActionsEvidence,
      verified: ["compatible_picker", "existing_template_excluded", "add_cancel_no_write", "add_reload_native", "keyboard_reorder_native", "position_change_reload_native", "remove_cancel_no_write", "remove_confirm_template_retained"] });
  });

  if (!contentSeoOnly) await run("core-page-composition-layout-reject-retry", [], async () => {
    renderedAdoption=[];renderedAssignmentObserved=false;
    await navigate("layout"); const before = await snapshot("layout-before");
    const panel = page.locator("section").filter({ has: page.locator('select[name="layout_editor"]') }).last();
    await select(panel, "layout_editor", "new");
    const layoutName = "QA Core Layout " + layoutKey.slice("qa-core-layout-".length);
    const keyField = panel.getByLabel("المعرّف التقني", { exact: true });
    const names = () => panel.getByLabel("الاسم الإداري", { exact: true });
    const keys = () => panel.getByLabel("المعرّف", { exact: true });
    await keyField.fill(layoutKey); await names().first().fill(layoutName);
    await expect(keys()).toHaveCount(1); await expect(keys().first()).toHaveValue("main");
    await expect(panel.getByRole("switch")).toBeChecked();
    const save = panel.getByRole("button", { name: "حفظ التخطيط والمناطق", exact: true });
    await action("composition-layout-invalid", () => save.click());
    const layoutFeedback = feedback("page-layout:" + pageId);
    await expect(layoutFeedback).toHaveAttribute("data-admin-feedback-variant", "danger");
    await expect(layoutFeedback).toContainText("بعض موديولات الصفحة مرتبطة بمناطق غير موجودة فيه");
    await expect(keyField).toHaveValue(layoutKey); await expect(names().first()).toHaveValue(layoutName);
    await expect(keys()).toHaveCount(1); await expect(save).toBeEnabled();
    assertPageCompositionUnchanged(before, await snapshot("layout-rejected"));
    const desired = [...regions].sort((a, b) => a.sort_order - b.sort_order);
    assert.equal(desired[0].key, "main", "The current fixture layout needs an explicit alternative editor strategy if its first region changes.");
    await names().nth(1).fill(desired[0].admin_label);
    for (let index = 1; index < desired.length; index++) {
      await panel.getByRole("button", { name: "إضافة Region", exact: true }).click();
      await keys().nth(index).fill(desired[index].key); await names().nth(index + 1).fill(desired[index].admin_label);
    }
    await action("composition-layout-valid-retry", () => save.click());
    await expect(layoutFeedback).toHaveAttribute("data-admin-feedback-variant", /^(success|warning)$/u);
    await reload("layout");
    const saved = await snapshot("layout-saved"), selectedLayout = saved.layouts.find(layout => layout.key === layoutKey);
    assert.ok(selectedLayout); assert.equal(number(saved.page.layout_id), number(selectedLayout.id));
    assert.equal(selectedLayout.admin_label, layoutName);
    assert.deepEqual(saved.regions.filter(region => number(region.layout_id) === number(selectedLayout.id)).map(region => [region.key, region.admin_label, region.sort_order]),
      desired.map((region, index) => [region.key, region.admin_label, (index + 1) * 10]));
    const auditIds = [assertPageCompositionAudit(before, saved, "save_layout")];
    await expect(keyField).toHaveValue(layoutKey); await expect(keyField).toBeDisabled();
    // The owner explicitly forbids deleting a region referenced by current assignments.
    const used = desired.findIndex(region => saved.assignments.some(row => row.slot === region.key));
    assert.ok(used >= 0);
    const usedInput = keys().nth(used), usedRow = usedInput.locator("xpath=../..");
    await usedRow.getByRole("button", { name: "حذف", exact: true }).click();
    await action("composition-used-region-rejected", () => save.click());
    await expect(layoutFeedback).toHaveAttribute("data-admin-feedback-variant", "danger");
    await expect(layoutFeedback).toContainText("لا يمكن حذف منطقة مستخدمة حاليًا");
    await expect(keys()).toHaveCount(desired.length - 1); await expect(names().first()).toHaveValue(layoutName);
    assertPageCompositionUnchanged(saved, await snapshot("layout-used-region-rejected"));
    await reload("layout"); await expect(keys()).toHaveCount(desired.length);
    await select(panel, "page_layout_id", originalLayoutId);
    await action("composition-original-layout-restore", () => panel.getByRole("button", { name: "اختيار للصفحة", exact: true }).click());
    await expect(layoutFeedback).toHaveAttribute("data-admin-feedback-variant", /^(success|warning)$/u);
    await reload("layout");
    const restored = await snapshot("layout-restored");
    assert.equal(number(restored.page.layout_id), originalLayoutId); assert.deepEqual(restored.assignments, saved.assignments);
    auditIds.push(assertPageCompositionAudit(saved, restored, "select_layout"));
    return result("layout", { originalLayoutId, createdLayoutId: number(selectedLayout.id), layoutKey, auditIds,
      verified: ["incompatible_layout_reject_no_write", "draft_preserved", "compatible_retry_save_reload_native", "used_region_delete_reject_no_write", "original_layout_restored"] });
  });
  await run("core-page-composition-seo-reject-retry-reload", [], async () => {
    renderedAdoption=[];renderedAssignmentObserved=false;
    const scope = assertPageSeoScope(manifest);
    const seoOwner = await jiti.import("../../src/lib/seo/entity-seo-types.ts");
    await navigate("seo");
    const form = () => page.locator("form").filter({has:page.locator('input[name="page_id"][value="'+pageId+'"]')});
    const field = name => form().locator('[name="'+name+'"]');
    const save = () => form().getByRole("button",{name:"حفظ إعدادات السيو",exact:true});
    const seoFeedback = () => feedback("page-seo:"+pageId);
    async function readUi() {
      const entries=await form().evaluate(el=>Array.from(new FormData(el).entries()).map(([key,value])=>[key,String(value)]));
      const data=new FormData();for(const[key,value]of entries)data.append(key,value);
      return seoOwner.toEntitySeoPersistence(seoOwner.readEntitySeoFormData(data));
    }
    await expect(form()).toHaveCount(1);await expect(save()).toBeEnabled();
    const beforeUi=await readUi(), before=await snapshot("seo-before","before"),imageAdoption=[];
    async function author(canonical) {
      for(const name of ["seo_title","seo_description","focus_keyword"])await field(name).fill(PAGE_SEO_RECIPE[name]);
      const tags=form().locator('[data-admin-tags-field]').filter({has:page.locator('[name="seo_keywords"]')});
      // Use the owner's visible chip controls, never hidden-field injection.
      while(await tags.getByRole("button",{name:/^حذف /u}).count())await tags.getByRole("button",{name:/^حذف /u}).first().click();
      const input=tags.locator('input[type="text"]');
      for(const keyword of [...PAGE_SEO_RECIPE.seo_keywords,PAGE_SEO_RECIPE.seo_keywords[0],"كلمة محذوفة"]){await input.fill(keyword);await input.press("Enter");}
      await expect(tags.getByRole("button",{name:PAGE_SEO_RECIPE.seo_keywords[0],exact:true})).toHaveCount(1);
      await tags.getByRole("button",{name:"حذف كلمة محذوفة",exact:true}).click();
      await field("canonical_url").fill(canonical);
      for(const name of ["robots_index","robots_follow"])for(const value of ["true","false",""])await select(form(),name,value);
      await select(form(),"robots_index","false");
      imageAdoption.push(await exerciseCoreImageField({page,origin,form:form(),name:"og_image",altName:"og_image_alt",finalAlt:PAGE_SEO_RECIPE.og_image_alt,preserveNames:["seo_title","canonical_url"]}));
      const authored=await readUi();
      for(const [key,value] of Object.entries(PAGE_SEO_RECIPE))assert.deepEqual(authored[key],key==="canonical_url"?canonical:value);
      return authored;
    }
    const authored=await author(PAGE_SEO_INVALID_CANONICAL);
    await action("page-seo-canonical-rejection",()=>save().click());
    await expect(page).toHaveURL(url=>url.pathname===fixtures.pages.editorPath&&url.searchParams.has("seo_error"),{timeout:60_000});
    await expect(seoFeedback()).toHaveAttribute("data-admin-feedback-variant","danger");
    await expect(seoFeedback()).toContainText("الرابط الأساسي يجب أن يبدأ بـ http أو https.");
    await expect(save()).toBeEnabled();
    const rejectionUi=summarizePageSeoRejection(beforeUi,authored,await readUi());
    const rejected=await snapshot("seo-rejected","rejected");assertPageCompositionUnchanged(before,rejected);
    // The specialized redirect form has no generic rollback contract. Reopening is explicit,
    // and reauthoring cannot count as proof of retaining the rejected draft.
    await navigate("seo");await author(PAGE_SEO_RECIPE.canonical_url);
    const token=randomUUID(),faultReceipts=[];
    const fault=async operation=>{const request={id:randomUUID(),kind:"domain-write-fault-"+operation,entity:"pages",token},value=await compositionCheckpoint(request);for(const key of Object.keys(request))assert.equal(value[key],request[key]);assert.equal(value.status,"pass");faultReceipts.push(value.id);return value;};
    let armed=false,responsePromise;const posts=[],listener=request=>{if(request.method()==="POST"&&request.headers()["next-action"]&&new URL(request.url()).origin===origin)posts.push(request);};
    try {
      await fault("arm");armed=true;page.on("request",listener);responsePromise=actionResponse();void responsePromise.catch(()=>{});await save().click();
      const first=await fault("observe-blocked");assert.equal(first.observedOneStatement,true);
      const pending=form().locator("fieldset[data-admin-form-pending-fields]");await expect(pending).toBeDisabled();await expect(pending).toHaveAttribute("inert","");await expect(pending).toHaveAttribute("aria-busy","true");await expect(field("seo_title")).toBeDisabled();await expect(save()).toBeDisabled();
      await page.keyboard.press("Enter");await page.keyboard.press("Enter");
      const second=await fault("observe-blocked");for(const key of ["backendPid","backendStartedAt","queryStartedAt","queryFingerprint","holderPid"])assert.equal(second[key],first[key]);assert.equal(posts.length,1);
      const released=await fault("release");armed=false;assert.equal(released.ownedLockRolledBack,true);assert.equal(released.cancellationObserved,false);
      assertActionAcknowledged(await responsePromise);
      await expect(page).toHaveURL(url=>url.pathname===fixtures.pages.editorPath&&url.searchParams.get("seo_notice")==="saved",{timeout:60_000});
      await expect(seoFeedback()).toHaveAttribute("data-admin-feedback-variant","success");await expect(save()).toBeEnabled();assert.equal(posts.length,1);
    } finally {page.off("request",listener);try{if(armed)await fault("release");}finally{if(responsePromise)await Promise.allSettled([responsePromise]);}}
    async function assertSavedUi(){const value=await readUi();for(const[key,expected]of Object.entries(PAGE_SEO_RECIPE))assert.deepEqual(value[key],expected);}
    await assertSavedUi();const saved=await snapshot("seo-saved","saved");
    await reload("seo");await assertSavedUi();const reloaded=await snapshot("seo-reloaded","reloaded");
    return result("seo",{...scope,imageAdoption,nativePhases:[...PAGE_SEO_PHASES],nativeCheckpoints:4,exactWrites:1,rejectionUi,
      checkpoints:[before.id,rejected.id,saved.id,reloaded.id],faultToken:token,faultReceipts,
      pending:{nativeStatementObservedTwice:true,sameStatementIdentity:true,normalKeyboardDedup:true,actionRequests:1,fieldsDisabledAndInert:true,ownedLockReleased:true},
      verified:["authored_text_metadata","keywords_add_remove_deduplicate","robots_true_false_inherit","canonical_rejection_no_write","explicit_reauthor_retry","pending_dedup","saved_reload_native_score_actor_audit","og_picker_cancel_select_replace_clear_reauthor"],
      notClaimed:["generic_form_rollback","permission_replay","full_capability_axes"]});
  });

  return { results, checkpoints, relatedRequiredCases: plan.relatedCases, automaticCoverage: [], globalClosed: false };
}
