import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

const imageFields = ["image", "hero_image", "small_box_image", "overview_main_image"];
const locationFields = ["governorate_id", "city_id", "main_area_id", "sub_area_id"];
const sourceFields = ["general_description", "short_description", ...imageFields, ...imageFields.map(name => `${name}_alt`), ...locationFields,
  "location_label", "location_description", "google_maps_url", "latitude", "longitude", "map_zoom"];

export function buildCoreProjectCreatePlan({ manifest, requiredCases, fixtures }) {
  const entries = manifest.filter(entry => entry.id === "projects-create-edit");
  assert.equal(entries.length, 1);
  const entry = entries[0];
  const surfaces = entry.surfaces.filter(surface => surface.endsWith(":create"));
  assert.deepEqual([...surfaces].sort(), ["commercial:create", "residential:create"]);
  return surfaces.map(surface => {
    const kind = surface.split(":")[0];
    const fixture = kind === "residential" ? fixtures.project : fixtures.commercialProject;
    assert.ok(Number.isSafeInteger(fixture?.id) && fixture.id > 0 && fixture.editorPath === `/admin/projects/${fixture.id}`);
    assert.ok(Array.isArray(fixture.locationIds) && fixture.locationIds.length === locationFields.length && fixture.locationIds.every(id => Number.isSafeInteger(id) && id > 0));
    const coverage = ["save_reload", "failure_preserves_input", "retry"].map(scenario => {
      const matches = requiredCases.filter(row => row.boundary === "form" && row.consumer === entry.id && row.surface === surface && row.scenario === scenario);
      assert.equal(matches.length, 1, `Missing or ambiguous Project create case ${surface}/${scenario}.`);
      return matches[0].key;
    });
    return { kind, fixture, consumer: entry.id, surface, coverage };
  });
}

export async function runCoreProjectCreateJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.ok(Array.isArray(databaseReadback));
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = buildCoreProjectCreatePlan({ manifest, requiredCases, fixtures });
  const suffix = Date.now().toString(36), completed = [];
  const form = () => page.locator('form[data-admin-form-runtime][data-admin-form-entity="project-entry"]');
  const field = name => form().locator(`[name="${name}"]`);
  const tab = id => form().locator(`[data-admin-tab-id="${id}"]`).click();
  const save = () => form().locator('[data-admin-form-action="save"]');

  async function navigate(path) {
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss();
    page.on("dialog", leave);
    try { await observe("project-create-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); }
    finally { page.off("dialog", leave); }
    await expect(form()).toHaveCount(1);
  }
  async function assertValues(values) {
    for (const [name, value] of Object.entries(values)) await expect(field(name)).toHaveValue(String(value));
  }
  async function selectLocation(name, id) {
    const source = field(name), option = source.locator(`option[value="${id}"]`);
    await expect(option).toHaveCount(1);
    const label = (await option.textContent()).trim();
    await form().locator(`[data-admin-form-listbox]:has(select[name="${name}"])`).getByRole("combobox").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(source).toHaveValue(String(id));
  }
  async function chooseImage(name, value) {
    assert.match(value, /^\/images\/projects\/[a-zA-Z0-9_./-]+$/u, "Fixture image must be an existing owned public Project catalog object.");
    assert.ok(!value.includes(".."));
    const owner = form().locator(`[data-admin-media-image-field="${name}"]`);
    await expect(owner).toHaveCount(1);
    await owner.getByRole("button", { name: "اختيار صورة", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
    await expect(picker).toBeVisible();
    // The real shared picker starts at images/projects. Navigate its folder UI,
    // then select the exact object-key row; never write its hidden value.
    const segments = value.slice("/images/projects/".length).split("/");
    for (const segment of segments.slice(0, -1)) {
      const button = picker.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ has: page.getByText(`⌞ ${segment}`, { exact: true }) });
      await expect(button).toHaveCount(1, { timeout: 60_000 });
      await button.click();
    }
    await picker.getByRole("button", { name: "قائمة", exact: true }).click();
    await picker.getByPlaceholder("ابحث بالاسم أو المسار أو الوصف البديل…", { exact: true }).fill(segments.at(-1));
    const row = picker.locator("button[aria-pressed]").filter({ has: page.getByText(value.slice(1), { exact: true }) });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toBeEnabled();
    await row.click();
    await expect(row).toHaveAttribute("aria-pressed", "true");
    await expect(field(name)).toHaveValue("");
    await picker.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(field(name)).toHaveValue(value);
  }
  async function writeRichText(name, text) {
    const editor = form().locator(`[id="${name}-editor"][role="textbox"]`);
    await expect(editor).toBeVisible();
    await editor.fill(text);
    await expect(editor).toHaveText(text);
    await expect(field(name)).not.toHaveValue("");
    const submittedHtml = await field(name).inputValue();
    // Capture the canonical client serialization only after the actual visible
    // edit; native readback and the refreshed editor must retain this value.
    const projectedText = await field(name).evaluate(input => new DOMParser().parseFromString(input.value, "text/html").body.textContent);
    assert.equal(projectedText, text);
    return submittedHtml;
  }
  async function acknowledge() {
    const [response] = await observe("project-create-action", () => Promise.all([actionResponse(), save().click()]));
    assertActionAcknowledged(response);
  }

  for (const recipe of plan) await run(`core-project-${recipe.kind}-full-create`, recipe.coverage, async () => {
    await navigate(recipe.fixture.editorPath);
    const source = {};
    for (const name of sourceFields) source[name] = await field(name).inputValue();
    assert.deepEqual(locationFields.map(name => Number(source[name])), recipe.fixture.locationIds);
    for (const name of imageFields) assert.ok(source[name] && source[`${name}_alt`]);
    for (const name of ["general_description", "short_description", "location_label", "google_maps_url", "latitude", "longitude", "map_zoom"]) assert.ok(source[name], `Incomplete owned source fixture ${name}.`);
    await navigate(`/admin/projects/new?type=${recipe.kind}`);
    const title = `QA Core ${recipe.kind} created ${suffix}`;
    const values = {
      arabic_name: title, english_name: `QA Core ${recipe.kind} ${suffix}`,
      code: `QA-CORE-${recipe.kind.slice(0, 3).toUpperCase()}-${suffix.toUpperCase()}`,
      slug: `qa-core-created-${recipe.kind}-${suffix}`, type: recipe.kind,
      general_description: source.general_description, short_description: source.short_description,
    };
    await tab("basic");
    for (const name of ["arabic_name", "english_name", "code", "slug", "general_description", "short_description"]) await field(name).fill(values[name]);
    for (const name of ["hero_image", "small_box_image", "image"]) {
      await observe(`project-create-picker-${name}`, () => chooseImage(name, source[name]));
      await field(`${name}_alt`).fill(source[`${name}_alt`]);
      values[name] = source[name]; values[`${name}_alt`] = source[`${name}_alt`];
    }
    await tab("location");
    for (const name of locationFields) {
      await selectLocation(name, Number(source[name]));
      values[name] = Number(source[name]);
    }
    for (const name of ["location_label", "location_description", "google_maps_url", "latitude", "longitude", "map_zoom"]) {
      await field(name).fill(source[name]); values[name] = source[name];
    }
    // The existing iframe may attempt a third-party map preview. The parent
    // retains its network deny policy; this journey never opens that provider.
    await expect(form().locator('iframe[title="معاينة موقع المشروع على الخريطة"]')).toHaveAttribute("src", new RegExp("^https://maps\\.google\\.com/maps\\?", "u"));
    await tab("overview");
    values.overview_title = `QA ${recipe.kind} overview ${suffix}`;
    await field("overview_title").fill(values.overview_title);
    values.overview_body = await writeRichText("overview_body", `Authored ${recipe.kind} project overview ${suffix}.`);
    await observe("project-create-picker-overview", () => chooseImage("overview_main_image", source.overview_main_image));
    await field("overview_main_image_alt").fill(source.overview_main_image_alt);
    values.overview_main_image = source.overview_main_image;
    values.overview_main_image_alt = source.overview_main_image_alt;
    await tab("delivery");
    values.delivery_title = `QA ${recipe.kind} delivery ${suffix}`;
    await field("delivery_title").fill(values.delivery_title);
    values.delivery_body = await writeRichText("delivery_body", `Authored ${recipe.kind} delivery specification ${suffix}.`);
    await tab("basic");
    await assertValues(values);
    await form().locator('[data-admin-form-action="close"]').click();
    const confirmation = page.getByRole("dialog", { name: "إغلاق دون حفظ؟", exact: true });
    await expect(confirmation).toBeVisible();
    await confirmation.locator("[data-admin-confirm-cancel]").click();
    await expect(confirmation).toHaveCount(0);
    await assertValues(values);
    await field("arabic_name").fill("");
    await acknowledge();
    await observe("project-create-real-validation-preservation", async () => {
      await expect(form().locator("#arabic_name-error")).toHaveText("اسم المشروع بالعربية مطلوب.");
      await expect(save()).toBeEnabled();
      await expect(field("arabic_name")).toHaveValue("");
      await assertValues(Object.fromEntries(Object.entries(values).filter(([name]) => name !== "arabic_name")));
    });
    await field("arabic_name").fill(title);
    await acknowledge();
    await expect(page).toHaveURL(url => /^\/admin\/projects\/[0-9]+$/u.test(url.pathname), { timeout: 60_000 });
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
    const id = Number(new URL(page.url()).pathname.split("/").at(-1));
    await observe("project-created-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    await assertValues(values);
    await tab("overview");
    await expect(form().locator('[id="overview_body-editor"][role="textbox"]')).toHaveText(`Authored ${recipe.kind} project overview ${suffix}.`);
    await tab("delivery");
    await expect(form().locator('[id="delivery_body-editor"][role="textbox"]')).toHaveText(`Authored ${recipe.kind} delivery specification ${suffix}.`);
    databaseReadback.push({ table: "projects", id, expected: { ...values, latitude: Number(values.latitude), longitude: Number(values.longitude), map_zoom: Number(values.map_zoom), publication_status: "unpublished" },
      auditEntityType: "project", auditActions: ["project.create"], auditEntityLabel: title });
    const result = { consumer: recipe.consumer, surface: recipe.surface, id, kind: recipe.kind,
      verified: ["four_existing_catalog_images_selected_and_confirmed", "four_level_location_selection", "maps_authored_values", "overview_delivery_rich_text", "server_required_name_rejection", "all_authored_input_preserved", "dirty_close_cancel", "retry_create_to_edit", "reload"],
      fields: Object.keys(values), publication: "unpublished", sourceFixtureId: recipe.fixture.id,
      proofBoundary: "Actual full valid root Project create through current Form controls and shared picker; parent native readback required. No complete capability-axis, publication, provider availability, optional child repeaters, or rollback/permission claim." };
    completed.push(result); return result;
  });
  return { planned: plan.length, completed: completed.length, results: completed };
}
