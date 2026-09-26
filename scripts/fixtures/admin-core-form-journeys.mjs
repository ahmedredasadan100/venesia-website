import assert from "node:assert/strict";
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

export async function runCoreTemplateFormJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1", "Only the owned local application may be exercised.");
  assert.ok(Array.isArray(databaseReadback));
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = buildCoreTemplateFormPlan({ formManifest: ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST, fixtures, requiredCases });
  const suffix = Date.now().toString(36);
  const pathFor = (kind, id = "") => `/admin/pages-blocks/blocks/${kind}${id ? `/${id}` : ""}`;
  const field = (form, name) => form.locator(`[name="${name}"]:not([type="hidden"])`);
  const editorForm = id => page.locator("form").filter({ has: page.locator(`input[name="id"][value="${id}"]`) });
  const submit = form => form.locator('button[type="submit"]');
  const outcomes = [];

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
    databaseReadback.push({ table: recipe.table, id, expected: { name },
      expectedJson: authored.map(({ path, value }) => ({ column: "config", path, value })),
      auditEntityType: "content_block_template", auditActions: ["content_block_template.update"],
      auditMetadata: recipe.kind === "content" ? {} : { blockType: recipe.kind }, auditEntityLabel: name });
    return { kind: recipe.kind, consumer: recipe.entry.id, surface: recipe.surface, id,
      metadataReloadVerified: true, authoredConfigReloadVerified: authored.map(({ path }) => path),
      validation: sharedRuntime ? "server_required_name_rejection_shared_form_preservation" : "native_required_name_rejection_no_action_request", preservedAuthoredFields: authored.map(({ name: fieldName }) => fieldName), retrySaved: true,
      dirtyCloseCancel: ["content", "hero"].includes(recipe.kind) ? "verified" : "not_declared_by_specialized_editor",
      proofBoundary: "Selected metadata and authored configuration fields; native readback required. No complete capability axis, template-command, server-failure rollback, or permission-denial claim." };
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
      const name = `QA Core ${recipe.kind} created ${suffix}`, slug = `qa-core-${recipe.kind}-${suffix}`;
      await field(form, "name").fill(name);
      if (recipe.kind !== "breadcrumb") await field(form, "slug").fill(slug);
      if (recipe.kind === "feed") await field(form, "widget_title").fill(`QA Feed ${suffix}`);
      // Only real rendered authored fields are allowed. The initial Cards modal
      // has none; its minimum-item rejection must remain a genuine failure.
      if (recipe.kind === "cards" && await field(form, "item_0_title").count()) {
        await field(form, "item_0_title").fill(`QA Card ${suffix}`);
        await field(form, "item_0_body").fill(`QA Card body ${suffix}`);
      }
      await observe("template-create-dirty-close-cancel", async () => {
        await form.getByRole("button", { name: "إلغاء", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
        await expect(dialog).toBeVisible();
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
        if (recipe.kind === "feed") await expect(field(form, "widget_title")).toHaveValue(`QA Feed ${suffix}`);
        await expect(submit(form)).toBeEnabled();
      });
      await field(form, "name").fill(name);
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
      const id = Number(new URL(page.url()).pathname.split("/").at(-1));
      await observe("template-created-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
      await expect(field(editorForm(id), "name")).toHaveValue(name);
      // The creation audit predates the authored edit and has its own label.
      databaseReadback.push({ table: recipe.table, id, expected: {}, auditEntityType: "content_block_template", auditActions: ["content_block_template.create"], auditEntityLabel: name, auditMetadata: recipe.kind === "content" ? { slug } : { blockType: recipe.kind } });
      const details = await editAndRead(recipe, id, `${name} saved`);
      outcomes.push(details);
      return { ...details, createServerValidation: "trimmed_required_name", createInputPreserved: true, createRetryHandoff: true, createDirtyCloseCancel: true };
    });
  }
  return { planned: plan.editors.length + plan.creates.length, completed: outcomes.length, outcomes, boundary: "Selected template-domain lifecycle; no template-command or complete capability-axis promotion." };
}
