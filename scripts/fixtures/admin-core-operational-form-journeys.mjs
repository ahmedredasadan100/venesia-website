import assert from "node:assert/strict";
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
  const suffix = Date.now().toString(36), results = [];
  const form = () => page.locator("form[data-admin-form-runtime]");
  const input = name => form().locator(`[name="${name}"]`);
  const save = () => form().locator('button[type="submit"], [data-admin-users-edit-save]');
  const successful = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first();
  const row = label => page.getByRole("row").filter({ has: page.getByText(label, { exact: true }) });
  const proofBoundary = "Actual isolated current Form controls, structured rejection, preserved fields, retry and reload; joined native expectations required. Selected authored fields only, no complete capability-axis, permission, rollback, media-provider or optional child-field claim.";

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
  async function select(name, value) {
    const label = (await input(name).locator(`option[value="${value}"]`).textContent()).trim();
    await form().locator(`[data-admin-form-listbox]:has(select[name="${name}"])`).getByRole("combobox").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(input(name)).toHaveValue(value);
  }
  async function openCreate(path, label) {
    await navigate(path);
    const trigger = page.getByRole("button", { name: label, exact: true });
    // Empty lists may repeat the same create trigger in their empty state.
    await expect(trigger.first()).toBeVisible(); await trigger.first().click();
    await expect(form()).toHaveCount(1);
  }
  async function openEdit(path, label) {
    await navigate(path + "?q=" + encodeURIComponent(label));
    await expect(row(label)).toHaveCount(1, { timeout: 60_000 });
    const id = Number(await row(label).locator('[data-admin-row-action="more"]').getAttribute("data-admin-entity-id"));
    assert.ok(Number.isSafeInteger(id) && id > 0);
    await row(label).locator('[data-admin-row-action="edit"] button').click();
    await expect(form()).toHaveCount(1);
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
    await confirmation.locator("[data-admin-confirm-cancel]").click();
    await expect(confirmation).toHaveCount(0);
    await expect(form().getByRole("button", { name: "إلغاء", exact: true })).toBeFocused();
    await equal(values);
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
    databaseReadback.push({ table, id, expected, auditEntityType: entity, auditActions: [action], ...(label ? { auditEntityLabel: label } : {}), ...extra });
  }
  function complete(recipe, ids, fields, extra = {}) {
    const result = { consumer: recipe.consumer, surfaces: recipe.surfaces, ids, fields,
      verified: ["structured_validation_rejection", "field_preservation", "dirty_close_cancel", "retry", "save_reload"], proofBoundary, ...extra };
    results.push(result); return result;
  }

  for (const recipe of plan.recipes) await run(`core-operational-${recipe.kind}-form-roundtrip`, recipe.coverage, async () => {
    if (recipe.kind === "redirect") {
      const path = "/admin/seo/redirects", source = `/qa-core-redirect-${suffix}`;
      await openCreate(path, "إضافة تحويل");
      let values = { source_path: source, destination_path: `/qa-core-destination-${suffix}`, note: `QA redirect authored ${suffix}`, redirect_type: "302", status: "inactive" };
      await fill({ source_path: values.source_path, destination_path: values.destination_path, note: values.note });
      await select("redirect_type", values.redirect_type); await select("status", values.status);
      await dirtyCancel(values); await rejectField("source_path", "/admin/forbidden-core", values, "لا يمكن تحويل مسارات الإدارة أو النظام.");
      await accepted();
      const id = await openEdit(path, source); await equal(values);
      audit("url_redirects", id, "redirect", "redirect.create", source, {});
      values = { ...values, destination_path: `/qa-core-edited-destination-${suffix}`, note: `QA redirect edited ${suffix}`, redirect_type: "301" };
      await fill({ destination_path: values.destination_path, note: values.note }); await select("redirect_type", values.redirect_type);
      await dirtyCancel(values); await rejectField("source_path", "/admin/forbidden-core", values, "لا يمكن تحويل مسارات الإدارة أو النظام.");
      await accepted(); await openEdit(path, source); await equal(values); await closeUnchanged();
      audit("url_redirects", id, "redirect", "redirect.update", source, values);
      return complete(recipe, [id], Object.keys(values), { publication: "inactive" });
    }
    if (recipe.kind === "profile") {
      const projectId = plan.profileProjectId, path = `/admin/projects/${projectId}/tracking`;
      await openCreate(path, "تعديل بيانات الملف");
      const values = { contractor_name: `QA Core Contractor ${suffix}`, project_receipt_date: "2026-01-02", license_receipt_date: "2026-01-03" };
      await fill(values); await dirtyCancel(values);
      // A five-digit year is valid in the real native date control but is
      // rejected by this Domain's existing four-digit server date contract.
      await rejectField("project_receipt_date", "10000-01-01", values);
      await accepted(); await openCreate(path, "تعديل بيانات الملف"); await equal(values); await closeUnchanged();
      audit("project_tracking_profiles", projectId, "project_tracking_profile", "project_children.update", null, values);
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
        : { name: createdLabel, description: `QA authored ${kind} description ${suffix}` };
      await fill(values);
      if (kind === "stage") { await input("planned_duration_value").fill("3"); await select("planned_duration_unit", "week"); values = { ...values, planned_duration_value: "3", planned_duration_unit: "week" }; }
      if (kind === "item") { await select("status", "in_progress"); values.status = "in_progress"; }
      await dirtyCancel(values); await rejectField(config.labelField, "", values, config.error); await accepted();
      const id = await openEdit(config.path, createdLabel); await equal(values);
      audit(config.table, id, config.entity, "project_children.create", createdLabel, {});
      values = { ...values, [config.labelField]: editedLabel,
        ...(kind === "update" ? { body: `QA edited update body ${suffix}` } : { description: `QA edited ${kind} description ${suffix}` }) };
      await fill(kind === "update" ? { title: values.title, body: values.body } : { name: values.name, description: values.description });
      await dirtyCancel(values); await rejectField(config.labelField, "", values, config.error); await accepted();
      assert.equal(await openEdit(config.path, editedLabel), id); await equal(values); await closeUnchanged();
      const expected = kind === "stage" ? { ...values, planned_duration_value: 3, project_id: parent.projectId, is_visible: true }
        : kind === "item" ? { ...values, stage_id: parent.stage.id, is_visible: true }
          : { title: values.title, body: values.body, item_id: parent.item.id, occurred_at: `${values.occurred_on}T12:00:00Z`, publication_status: "draft" };
      audit(config.table, id, config.entity, "project_children.update", editedLabel, expected);
      return complete(recipe, [id], Object.keys(expected), { mediaBoundary: kind === "update" ? "Text-only draft; gallery/video selectors remain separate applicable work." : null });
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
    await accepted(); const id = await openEdit(path, username); await equal(values);
    audit("admin_users", id, "admin_user", "admin_user.created", username, {});
    await expect(input("password")).toHaveValue(""); await expect(input("confirmPassword")).toHaveValue("");
    values = { ...values, full_name: `QA Core User edited ${suffix}` };
    await input("full_name").fill(values.full_name); await dirtyCancel(values);
    await rejectField("username", "", values, "اسم المستخدم مطلوب.");
    await accepted(); assert.equal(await openEdit(path, username), id); await equal(values); await closeUnchanged();
    audit("admin_users", id, "admin_user", "admin_user.updated", username, { ...values, role: "admin", is_active: true });
    return complete(recipe, [id], Object.keys(values), { credentialBoundary: "Generated solely in private process memory; no credential artifact or password/hash readback. Separate existing command cohort owns synthetic status/delete." });
  });

  await run("core-operational-user-current-identity-protection", [], async () => {
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
    await expect(form().locator("#admin-user-self-status")).toHaveText("لا يمكنك تعطيل حسابك الحالي من هنا.");
    await expect(form().getByRole("switch")).toBeDisabled();
    await expect(input("password")).toHaveCount(0); await expect(input("confirmPassword")).toHaveCount(0);
    await closeUnchanged();
    return { consumer: "users-and-roles", surface: "identity-collection", verified: ["current_user_visibility_disabled", "current_user_delete_disabled", "current_user_edit_status_disabled", "self_password_controls_absent"], proofBoundary: "Read-only current authenticated synthetic identity UI restrictions; no denied server-command or complete Auth capability claim." };
  });
  return { planned: plan.recipes.length, completed: results.length, results };
}
