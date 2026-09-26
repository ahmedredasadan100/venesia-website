import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

const familyIds = ["topic-category-create-edit", "topic-series-create-edit", "topic-article-create-edit", "topic-media-create-edit", "projects-create-edit", "project-locations-create-edit"];
const lifecycle = ["save_reload", "failure_preserves_input", "retry"];
const locationSurface = { governorate: "governorate", city: "city", main_area: "district", sub_area: "sub-district" };

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
  const media = forms["topic-media-create-edit"].surfaces.filter(surface => surface.endsWith(":create")).map(surface => surface.split(":")[0]);
  assert.deepEqual([...media].sort(), ["gallery", "news", "press", "site_update", "video"]);
  const topics = ["article", ...media].map(kind => {
    const id = kind === "article" ? "topic-article-create-edit" : "topic-media-create-edit";
    const surfaces = kind === "article" ? ["create", "edit"] : [`${kind}:create`, `${kind}:edit`];
    return { kind, id, surfaces, coverage: coverage(id, surfaces) };
  });
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

/** One accepted current Form intent; the optional replay never precedes native save proof. */
export async function runCoreFormPermissionIntent({ permissionReplay, mapping, perform, permissionEvidence }) {
  const startedAt = new Date().toISOString();
  const capture = permissionReplay?.begin(mapping);
  try {
    const { value, nativeWrites } = await perform();
    if (!capture) return value;
    assert.equal(typeof permissionReplay.nativeSave, "function", "Original native save verification is required.");
    assert.ok(Array.isArray(nativeWrites) && nativeWrites.length > 0 && nativeWrites.length <= 4);
    assert.ok(nativeWrites.every(write => write.expected && Object.keys(write.expected).length > 0),
      "A midpoint create requires actual saved fields, not existence alone.");
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
      assert.equal(actual.deleted, false);
      assert.deepEqual(actual.actual, expected.expected, "Native save must prove every authored field.");
      assert.deepEqual(actual.json, (expected.expectedJson ?? []).map(projection => ({
        column: projection.column, path: projection.path, actual: projection.value,
      })), "Native save must prove every authored JSON projection.");
      assert.ok(Array.isArray(actual.audit) && actual.audit.length > 0
        && actual.audit.every(row => Number.isSafeInteger(Number(row.actor_admin_user_id)) && Number(row.actor_admin_user_id) > 0),
      "The original write requires its actor-bound native audit.");
      for (const action of expected.auditActions ?? []) assert.ok(actual.audit.some(row => row.action === action));
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
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { PROJECT_LOCATION_LEVEL_CONFIG: locationConfig } = await jiti.import("../../src/lib/admin/projects/location-management-contract.ts");
  const plan = buildCoreDomainFormPlan({ manifest, requiredCases, fixtures, locationConfig });
  const suffix = Date.now().toString(36), completed = [], permissionEvidence = [];
  const permissionIntent = (recipe, surface, caseId, perform) => runCoreFormPermissionIntent({
    permissionReplay: ctx.permissionReplay, mapping: { caseId, formConsumer: recipe.id, surface }, perform, permissionEvidence,
  });
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
  async function valuesEqual(form, fields) {
    for (const [name, value] of Object.entries(fields)) await expect(control(form, name)).toHaveValue(String(value));
  }
  async function dirtyCloseCancel(form, fields, modal = false) {
    const original = page.url();
    const close = modal ? form.getByRole("button", { name: "إلغاء", exact: true }) : form.locator('[data-admin-form-action="close"]');
    await close.click();
    const confirmation = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
    await expect(confirmation).toBeVisible();
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
    const result = { consumer: recipe.id, surfaces: recipe.surfaces, kind: recipe.kind ?? recipe.level, id,
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
    await permissionIntent(recipe, "edit", "core-" + recipe.kind + "-form-edit", async () => {
      await accepted(form);
      await reloadValues(editFields);
      const descriptor = audit(table, id, entity, edited, "update", { ...editFields, slug, status: "unpublished" });
      return { nativeWrites: [descriptor] };
    });
    return details(recipe, id, ["name", "slug", ...(recipe.kind === "series" ? ["category_id"] : [])]);
  });

  for (const recipe of plan.topics) await run(`core-${recipe.kind}-content-form-create-edit`, recipe.coverage, async () => {
    await navigate(`/admin/content/topics/new?type=${recipe.kind}`);
    let form = currentForm();
    const title = `QA Core ${recipe.kind} ${suffix}`, slug = `qa-core-content-${recipe.kind.replaceAll("_", "-")}-${suffix}`;
    const excerpt = `QA authored excerpt for ${recipe.kind} content ${suffix}.`;
    const markdown = !["video", "gallery"].includes(recipe.kind);
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
      await expect(editor.locator("p")).toHaveText(body);
      await expect(editor.locator("h1,h2,h3")).toHaveCount(0);
    }
    if (recipe.kind === "video") await control(form, "video_duration").fill("2:34");
    const createFields = { title, slug, excerpt, category_id: fixtures.category.id, ...(markdown ? { content: body } : {}), ...(recipe.kind === "video" ? { video_duration: "2:34" } : {}) };
    await valuesEqual(form, createFields);
    await dirtyCloseCancel(form, createFields);
    await rejectRequired(form, "title", createFields);
    const payloadAudit = recipe.kind === "video"
      ? { expectedJson: [{ column: "media_payload", path: ["kind"], value: "video" }, { column: "media_payload", path: ["duration"], value: "2:34" }] }
      : recipe.kind === "gallery" ? { expectedJson: [{ column: "media_payload", path: ["kind"], value: "gallery" }] } : {};
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
    const path = `/admin/projects/locations/${recipe.config.slug}`;
    await navigate(path, false);
    await page.getByRole("button", { name: `إضافة ${recipe.config.singularLabel}`, exact: true }).click();
    let form = page.locator(`#project-location-${recipe.level}-create`);
    const name = `QA Core ${recipe.level} ${suffix}`, english = `QA Location ${recipe.level} ${suffix}`;
    await control(form, "name_ar").fill(name);
    await control(form, "name_en").fill(english);
    await control(form, "sort_order").fill("7");
    if (recipe.parentId) await selectValue(form, "parent_id", recipe.parentId);
    const fields = { name_ar: name, name_en: english, sort_order: 7, ...(recipe.parentId ? { parent_id: recipe.parentId } : {}) };
    await dirtyCloseCancel(form, fields, true);
    await rejectRequired(form, "name_ar", fields);
    let row;
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
      await valuesEqual(form, fields);
      return { value: createdId, nativeWrites: [{ ...descriptor, expected: { ...fields, level: recipe.level, parent_id: recipe.parentId, is_active: true } }] };
    });
    const editFields = { ...fields, name_ar: `${name} saved`, name_en: `${english} saved`, sort_order: 9 };
    for (const key of ["name_ar", "name_en", "sort_order"]) await control(form, key).fill(String(editFields[key]));
    await dirtyCloseCancel(form, editFields, true);
    await rejectRequired(form, "name_ar", editFields);
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
