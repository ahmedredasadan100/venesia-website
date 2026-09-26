import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

const consumer = "page-composition-and-seo";
const collectionConsumers = ["page-block-assignments", "page-composition-shell"];
const identity = row => row.kind + ":" + row.id;
const number = value => { const n = Number(value); assert.ok(Number.isSafeInteger(n) && n > 0); return n; };

export function buildCorePageCompositionPlan({ fixtures, manifest, collections, kinds, positionCapabilities, getAssignablePositions, regions, requiredCases }) {
  const forms = manifest.filter(entry => entry.id === consumer);
  assert.equal(forms.length, 1);
  for (const surface of ["assignment", "composition", "layout"]) assert.ok(forms[0].surfaces.includes(surface));
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
  for (const key of ["page", "assignments", "layouts", "regions", "audit", "templates"]) assert.deepEqual(after[key], before[key], "Unexpected composition change after cancel/rejection: " + key);
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

export async function runCorePageCompositionJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, requiredCases, compositionCheckpoint } = ctx;
  assert.equal(new URL(origin).origin, origin); assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.equal(typeof compositionCheckpoint, "function", "The bounded native composition checkpoint must be wired.");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../../src/lib/admin/interaction-system/adoption-manifest.ts");
  const { REGISTERED_SLOT_MODULE_KINDS: kinds } = await jiti.import("../../src/lib/page-composition/slot-module-registry.ts");
  const { MODULE_POSITION_CAPABILITIES: positionCapabilities, getAssignablePositions, comparePageAssignmentOrder } = await jiti.import("../../src/lib/page-composition/page-assignment-contract.ts");
  const { moduleKindLabel } = await jiti.import("../../src/lib/page-blocks/admin-utils.ts");
  const pageId = number(fixtures.pages.pageId), startedAt = new Date().toISOString();
  const layoutKey = "qa-core-layout-" + Date.now().toString(36);
  const templateRefs = kinds.map(kind => {
    const rows = fixtures.pages.templates.filter(row => row.kind === kind && row.assigned === false && row.slug === fixtures.pages.slug + "-" + kind + "-3");
    assert.equal(rows.length, 1); return { kind, id: number(rows[0].id) };
  });
  const checkpoints = [], results = [];
  async function snapshot(label) {
    const request = { id: randomUUID(), kind: "page-composition-state", pageId, startedAt, layoutKeys: [layoutKey], templateRefs };
    const value = await observe("composition-native-" + label, () => compositionCheckpoint(request));
    assert.equal(value?.id, request.id); assert.equal(value.kind, request.kind); assert.equal(value.status, "pass");
    assert.equal(value.pageId, pageId); assert.equal(value.startedAt, startedAt);
    assert.ok(typeof value.ownedRunId === "string" && value.ownedRunId.length > 0);
    for (const key of ["assignments", "layouts", "regions", "audit", "templates"]) assert.ok(Array.isArray(value[key]));
    assert.equal(number(value.page.id), pageId); number(value.qaActorId);
    checkpoints.push({ label, receiptId: value.id });
    return value;
  }
  const initial = await snapshot("initial");
  const originalLayoutId = number(initial.page.layout_id);
  const regions = initial.regions.filter(region => number(region.layout_id) === originalLayoutId);
  const plan = buildCorePageCompositionPlan({ fixtures, manifest, collections: ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces,
    kinds, positionCapabilities, getAssignablePositions, regions, requiredCases });
  const table = () => page.locator("[data-page-composition-table-surface]");
  const assignedRow = template => table().locator("article").filter({ has: page.getByRole("link", { name: template.name, exact: true }) });
  const dialog = () => page.getByRole("dialog", { name: "ربط موديول بالصفحة", exact: true });
  const feedback = channel => page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="' + channel + '"]');
  async function navigate(tab = "modules") {
    await observe("composition-navigation", () => page.goto(origin + fixtures.pages.editorPath + "?tab=" + tab, { waitUntil: "domcontentloaded" }));
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
  async function openAssignment(template, slot, order) {
    await page.getByRole("button", { name: "إضافة موديول", exact: true }).click();
    await expect(dialog()).toBeVisible();
    await dialog().getByRole("combobox", { name: "نوع الموديول", exact: true }).click();
    await page.getByRole("option", { name: moduleKindLabel(template.kind), exact: true }).click();
    const templateField = dialog().locator('[data-admin-form-listbox]:has(select[name="template_id"])');
    await expect(templateField).toHaveAttribute("data-admin-form-listbox-state", template.fixed ? "empty" : "ready", { timeout: 60_000 });
    if (template.fixed) return;
    const slotValues = await dialog().locator('select[name="slot"] option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
    assert.deepEqual(slotValues, template.slots, "The picker must expose exactly the current canonical compatible positions.");
    for (const existing of fixtures.pages.templates.filter(row => row.kind === template.kind && row.assigned)) {
      await expect(dialog().locator('select[name="template_id"] option[value="' + existing.id + '"]')).toHaveCount(0);
    }
    await select(dialog(), "template_id", template.id);
    await select(dialog(), "slot", slot);
    await dialog().locator('input[name="sort_order"]').fill(String(order));
  }
  async function removal(template) {
    await assignedRow(template).locator('[data-admin-row-action="more"]').getByRole("button").click();
    await page.locator('[data-admin-row-action-menu-item="delete"]').click();
    const confirmation = page.getByRole("dialog", { name: "تأكيد الإزالة من الصفحة", exact: true });
    await expect(confirmation).toBeVisible(); await expect(confirmation).toContainText(template.name);
    return confirmation;
  }
  const ordered = (state, slot) => state.assignments.filter(row => row.kind !== "hero" && row.slot === slot).sort((a, b) =>
    comparePageAssignmentOrder({ sortOrder: a.sort_order, moduleKind: a.kind.replaceAll("_", "-"), assignmentId: number(a.id) },
      { sortOrder: b.sort_order, moduleKind: b.kind.replaceAll("_", "-"), assignmentId: number(b.id) }));
  const result = (id, details) => {
    const value = { id, consumer, collectionConsumers, automaticCoverage: [], relatedRequiredCases: plan.relatedCases, ...details,
      proofBoundary: "Only these concrete current Page Composition UI/native journeys. No complete capability axis or unchanged SEO claim." };
    results.push(value); return value;
  };

  for (const template of plan.fixed) await run("core-page-composition-fixed-" + template.kind, [], async () => {
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

  for (const template of plan.assignments) await run("core-page-composition-" + template.kind + "-assignment", [], async () => {
    await navigate(); let before = await snapshot(template.kind + "-before");
    const slot = template.slots.find(value => value !== "hero"); assert.ok(slot);
    const sortOrder = Math.max(0, ...ordered(before, slot).map(row => row.sort_order)) + 10;
    await openAssignment(template, slot, sortOrder);
    await dialog().getByRole("button", { name: "إلغاء", exact: true }).click();
    await expect(dialog()).toHaveCount(0);
    assertPageCompositionUnchanged(before, await snapshot(template.kind + "-add-cancel"));
    await openAssignment(template, slot, sortOrder);
    await action("composition-add", () => dialog().getByRole("button", { name: "ربط الموديول", exact: true }).click());
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
    const confirmation = await removal(template);
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
    return result("assignment-" + template.kind, { templateId: template.id, assignmentId: number(assignment.id), auditIds,
      verified: ["compatible_picker", "existing_template_excluded", "add_cancel_no_write", "add_reload_native", "keyboard_reorder_native", "position_change_reload_native", "remove_cancel_no_write", "remove_confirm_template_retained"] });
  });

  await run("core-page-composition-layout-reject-retry", [], async () => {
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
  return { results, checkpoints, relatedRequiredCases: plan.relatedCases, automaticCoverage: [], globalClosed: false };
}
