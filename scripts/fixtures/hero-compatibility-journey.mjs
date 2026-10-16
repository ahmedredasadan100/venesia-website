import assert from "node:assert/strict";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const origin = process.env.E2E_BASE_URL;
assert.equal(new URL(origin).hostname, "127.0.0.1");
const fixtures = JSON.parse(readFileSync(process.env.QA_HERO_FIXTURES, "utf8"));
const control = process.env.QA_HERO_CONTROL;
const output = process.env.QA_ADMIN_OUTPUT;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
context.setDefaultTimeout(25_000);
context.setDefaultNavigationTimeout(60_000);
const page = await context.newPage();
const errors = [];
const evidence = [];
let expectedInvalid = false;
page.on("pageerror", error => {
  if (!(expectedInvalid && error.message.includes("Hero id, name and slug are required"))) errors.push(error.message);
});
async function checkpoint(id) {
  const request = path.join(control, id + ".request.json");
  writeFileSync(request + ".tmp", JSON.stringify({ id }), { flag: "wx" });
  renameSync(request + ".tmp", request);
  const response = path.join(control, id + ".response.json");
  await expect.poll(() => existsSync(response), { timeout: 30000 }).toBe(true);
  const result = JSON.parse(readFileSync(response, "utf8"));
  assert.equal(result.status, "pass", JSON.stringify(result));
  evidence.push({ checkpoint: id, nativeReadback: true, seeded: result.seeded });
  return result;
}
const route = kind => "/admin/pages-blocks/blocks/" + (kind === "hub" ? "content/" : "hero/") + fixtures[kind].id;
async function editor(kind) {
  await page.goto(origin + route(kind));
  await expect(page.locator('[name="name"]')).toBeVisible();
  await page.locator('[data-admin-tab-id="content"]').click();
  await expect(page.locator('[name="description_alignment"]')).toHaveValue("justify");
}
async function submit(kind, expectedName) {
  const response = page.waitForResponse(value => value.request().method() === "POST" && Boolean(value.request().headers()["next-action"]));
  await page.getByRole("button", { name: kind === "hub" ? "حفظ الموديول" : "حفظ الهيرو", exact: true }).first().click();
  // Flight settles the action model before stream EOF; prove the visible save outcome.
  const settled = await response;
  assert.ok(settled.status() >= 200 && settled.status() < 400, "Hero save must acknowledge the command.");
  await page.waitForURL(url => url.searchParams.has("saved"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('form[data-admin-form-runtime]')).toBeVisible();
  if (expectedName) await expect(page.locator('[name="name"]')).toHaveValue(expectedName);
}
async function saveOtherField(kind, suffix) {
  const name = "QA Hero " + kind + " " + suffix;
  await page.locator('[name="name"]').fill(name);
  await submit(kind, name);
}
async function preview(kind, { rich = false, description, alignment = "justify", actions } = {}) {
  await page.goto(origin + "/qa-isolated-hero-compatibility?kind=" + kind);
  const root = page.locator('[data-qa-hero-kind="' + kind + '"]');
  await expect(root).toBeVisible(); await expect(root).toHaveAttribute("dir", "rtl");
  const config = JSON.parse(await root.getAttribute("data-qa-hero-config"));
  assert.equal(config.descriptionAlignment, alignment);
  const descriptionNode = rich
    ? root.locator("strong").filter({ hasText: "منسق محفوظ" })
    : root.getByText(description ?? "QA وصف مختصر مكتمل", { exact: true }).first();
  await expect(descriptionNode).toBeVisible();
  await expect(descriptionNode).toHaveCSS("text-align", alignment);
  if (rich) {
    assert.equal(config.description, fixtures.richDescription);
    await expect(root.locator("strong").filter({ hasText: "منسق محفوظ" })).toBeVisible();
    await expect(root.locator('a[href="/contact"]').filter({ hasText: "رابط التواصل" })).toBeVisible();
    await expect(root.locator("br")).toHaveCount(1);
  }
  if (description) await expect(root.getByText(description, { exact: true })).toBeVisible();
  if (actions) {
    assert.deepEqual(await root.locator("[data-project-hero-action]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-project-hero-action"))), actions);
    if (actions.length) await expect(root.locator("[data-hero-cta-alignment]")).toHaveAttribute("data-hero-cta-alignment", "left");
  }
  return config;
}
async function views(kind, options) {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await preview(kind, options);
    await page.screenshot({ path: path.join(output, "hero-compatibility-" + kind + "-public-" + width + ".png") });
    await page.goto(origin + route(kind));
    await page.locator('[data-admin-tab-id="content"]').click();
    const controlRow = page.locator("[data-module-editor-control-row]").filter({ has: page.locator('[name="description_alignment"]') }).first();
    await expect(controlRow).toBeVisible();
    await controlRow.scrollIntoViewIfNeeded();
    const box = await controlRow.boundingBox(); assert.ok(box && box.width > 0 && box.width <= width);
    await page.screenshot({ path: path.join(output, "hero-compatibility-" + kind + "-admin-" + width + ".png") });
    evidence.push({ kind, width, rtl: true, adminControlsVisible: true, actualPublicRenderer: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function chooseRight() {
  const row = page.locator("[data-module-editor-control-row]").filter({ has: page.locator('[name="description_alignment"]') }).first();
  await row.locator('[data-admin-text-alignment="right"]').click();
  await expect(page.locator('[name="description_alignment"]')).toHaveValue("right");
}
const ctaCard = slot => page.locator('[data-module-editor-cta-card="' + slot + '"]');
const ctaField = slot => ctaCard(slot).locator("[data-admin-link-field]");
async function openCtaEditor(kind) {
  await page.goto(origin + route(kind));
  await page.locator('[data-admin-tab-id="buttons"]').click();
  await expect(ctaCard("primary")).toBeVisible();
  await expect(ctaCard("secondary")).toBeVisible();
}
async function selectCtaLink(slot) {
  const fixture = fixtures.cta[slot];
  const field = ctaField(slot);
  const trigger = field.getByRole("button", { name: "اختيار الرابط", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "اختيار رابط", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Static Routes", exact: true }).click();
  await dialog.getByPlaceholder("ابحث داخل Static Routes...").fill(fixture.href);
  const result = dialog.getByRole("button").filter({ has: page.getByText(fixture.title, { exact: true }) });
  await expect(result).toHaveCount(1);
  await result.click();
  await dialog.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await field.getByLabel("Anchor (اختياري)", { exact: true }).fill("#" + fixture.anchor);
  await expect(field.locator('[name="' + slot + '_cta_link_anchor"]')).toHaveValue(fixture.anchor);
}
async function expectCtaFields({ primary = true, secondary = true, shown = true, bold = true, alignment = "left" } = {}) {
  for (const [slot, hasLink] of [["primary", primary], ["secondary", secondary]]) {
    const fixture = fixtures.cta[slot];
    const card = ctaCard(slot);
    const field = ctaField(slot);
    await expect(card.locator('[name="' + slot + '_cta_label"]')).toHaveValue(fixture.label);
    const fields = {
      link_kind: hasLink ? "static_route" : "none", linked_type: hasLink ? "static_routes" : "", linked_id: "",
      link_href: hasLink ? fixture.href : "", link_anchor: hasLink ? fixture.anchor : "", link_target: "_self",
      link_route_key: hasLink ? fixture.routeKey : "",
    };
    for (const [suffix, value] of Object.entries(fields)) {
      const input = field.locator('[name="' + slot + '_cta_' + suffix + '"]');
      await expect(input).toHaveCount(1);
      await expect(input).toHaveValue(value);
    }
    if (hasLink) {
      await expect(field.locator("[data-admin-link-destination]")).toContainText(fixture.title);
      await expect(field.locator('[data-admin-link-destination] [dir="ltr"]')).toHaveText(fixture.href + "#" + fixture.anchor);
      await expect(field.getByLabel("Anchor (اختياري)", { exact: true })).toHaveValue(fixture.anchor);
      await expect(field.getByRole("button", { name: "مسح", exact: true })).toBeEnabled();
    } else {
      await expect(field.locator("[data-admin-link-destination]")).toHaveText("لم يتم اختيار رابط بعد.");
      await expect(field.getByLabel("Anchor (اختياري)", { exact: true })).toHaveCount(0);
      await expect(field.getByRole("button", { name: "مسح", exact: true })).toHaveCount(0);
    }
    await expect(card.getByRole("switch")).toBeChecked({ checked: shown });
    await expect(card.locator('[data-admin-text-alignment="' + alignment + '"]')).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator("[data-admin-text-format-bold]")).toHaveAttribute("aria-pressed", String(bold));
  }
  for (const [name, value] of Object.entries({ show_cta: String(shown), cta_alignment: alignment, cta_bold: String(bold) })) {
    await expect(page.locator('[name="' + name + '"]')).toHaveCount(1);
    await expect(page.locator('[name="' + name + '"]')).toHaveValue(value);
  }
}
async function setCtaFormat(slot, enabled) {
  const card = ctaCard(slot);
  const visible = card.getByRole("switch");
  if (await visible.isChecked() !== enabled) await visible.locator("xpath=ancestor::label").click();
  await card.locator('[data-admin-text-alignment="' + (enabled ? "left" : "center") + '"]').click();
  const bold = card.locator("[data-admin-text-format-bold]");
  if ((await bold.getAttribute("aria-pressed") === "true") !== enabled) await bold.click();
}
async function ctaPublic(kind, { primary = true, secondary = true, shown = true, bold = true, alignment = "left" } = {}) {
  const config = await preview(kind, kind === "home"
    ? { description: fixtures.editedDescription, alignment: "right" } : { rich: true });
  assert.equal(config.showCta, shown); assert.equal(config.ctaBold, bold); assert.equal(config.ctaAlignment, alignment);
  const root = page.locator('[data-qa-hero-kind="' + kind + '"]');
  for (const [slot, hasLink] of [["primary", primary], ["secondary", secondary]]) {
    const fixture = fixtures.cta[slot];
    const link = root.locator("a").filter({ hasText: fixture.label });
    assert.equal(config[slot + "CtaLabel"], fixture.label);
    if (hasLink) assert.equal(config[slot + "CtaHref"], fixture.href + "#" + fixture.anchor);
    else assert.equal(config[slot + "CtaLink"], null);
    if (hasLink && shown) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", fixture.href + "#" + fixture.anchor);
      await expect(link).toHaveCSS("font-weight", bold ? "700" : "500");
      await expect(link.locator("xpath=..")).toHaveCSS("justify-content", alignment === "left" ? "flex-end" : "center");
    } else await expect(link).not.toBeVisible();
  }
}
async function saveCtaCheckpoint(kind, stage, expected) {
  await submit(kind);
  await page.locator('[data-admin-tab-id="buttons"]').click();
  await expectCtaFields(expected);
  await checkpoint(kind + "-cta-" + stage);
  await ctaPublic(kind, expected);
}
async function ctaPersistence(kind) {
  await openCtaEditor(kind);
  for (const slot of ["primary", "secondary"]) {
    await ctaCard(slot).locator('[name="' + slot + '_cta_label"]').fill(fixtures.cta[slot].label);
    await selectCtaLink(slot);
  }
  await setCtaFormat("primary", true);
  await expectCtaFields();
  await saveCtaCheckpoint(kind, "selected", {});

  await openCtaEditor(kind);
  await ctaField("primary").getByRole("button", { name: "مسح", exact: true }).click();
  await setCtaFormat("secondary", false);
  const primaryCleared = { primary: false, shown: false, bold: false, alignment: "center" };
  await expectCtaFields(primaryCleared);
  await saveCtaCheckpoint(kind, "primary-cleared", primaryCleared);

  await openCtaEditor(kind);
  await ctaField("secondary").getByRole("button", { name: "مسح", exact: true }).click();
  const bothCleared = { ...primaryCleared, secondary: false };
  await expectCtaFields(bothCleared);
  await saveCtaCheckpoint(kind, "secondary-cleared", bothCleared);

  await openCtaEditor(kind);
  for (const slot of ["primary", "secondary"]) await selectCtaLink(slot);
  await setCtaFormat("secondary", true);
  await saveCtaCheckpoint(kind, "restored", {});
  evidence.push({ kind, ctaPickerSelectClearRestore: true, ctaTextLinkAnchorSaveReload: true,
    ctaVisibilityAlignmentBold: true, exactNativeReadback: true, actualPublicRenderer: true, keyboardPickerAndFocusReturn: true });
}
try {
  await page.goto(origin + "/admin/login");
  await page.locator('[name="username"]').fill(process.env.QA_ADMIN_USERNAME);
  await page.locator('[name="password"]').fill(process.env.QA_ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => url.pathname !== "/admin/login");

  await checkpoint("home-baseline"); await editor("home");
  await expect(page.locator('input[name="description"]')).toHaveValue(fixtures.richDescription);
  await page.locator('[name="description_editor"]').fill("مسودة غير محفوظة");
  await checkpoint("home-unsaved");
  page.once("dialog", dialog => dialog.accept()); await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('input[name="description"]')).toHaveValue(fixtures.richDescription);
  await page.locator('[name="name"]').fill(" ");
  expectedInvalid = true;
  const rejected = page.waitForResponse(value => value.request().method() === "POST" && Boolean(value.request().headers()["next-action"]));
  await page.getByRole("button", { name: "حفظ الهيرو", exact: true }).first().click();
  await rejected;
  await expect(page.getByText("تعذر حفظ البيانات", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "حفظ الهيرو", exact: true }).first()).toBeEnabled();
  await expect(page.locator('form[data-admin-form-runtime]')).not.toHaveAttribute("aria-busy", "true");
  await checkpoint("home-invalid"); expectedInvalid = false;
  // Retry the same live editor through its canonical action after a rejected input.
  await saveOtherField("home", "preserved"); await checkpoint("home-preserved");
  await views("home", { rich: true });
  await editor("home"); await page.locator('[name="description_editor"]').fill(fixtures.editedDescription);
  await submit("home"); await checkpoint("home-edited");
  await preview("home", { description: fixtures.editedDescription });
  await editor("home"); await chooseRight(); await submit("home"); await checkpoint("home-right");
  await preview("home", { description: fixtures.editedDescription, alignment: "right" });

  await editor("internal"); await saveOtherField("internal", "preserved"); await checkpoint("internal-preserved");
  await views("internal", { rich: true });
  await checkpoint("detail-legacy-baseline"); await preview("detail", { actions: [] });
  await editor("detail"); await saveOtherField("detail", "legacy"); await checkpoint("detail-legacy-saved");
  await preview("detail", { actions: [] });
  for (const [scenario, actions] of [["partial", ["tracking"]], ["snake", ["reservation"]], ["modern", ["reservation", "download"]]]) {
    await checkpoint("detail-" + scenario + "-seed");
    await preview("detail", { actions });
    await editor("detail"); await saveOtherField("detail", scenario);
    await checkpoint("detail-" + scenario + "-saved");
    await preview("detail", { actions });
  }
  await views("detail", { actions: ["reservation", "download"] });
  await editor("detail"); await chooseRight(); await submit("detail"); await checkpoint("detail-right");
  await preview("detail", { actions: ["reservation", "download"], alignment: "right" });
  await editor("hub"); await saveOtherField("hub", "preserved"); await checkpoint("hub-preserved");
  await views("hub", {});
  await ctaPersistence("home");
  await ctaPersistence("internal");
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, "hero-compatibility-browser-proof.json"), JSON.stringify({ status: "pass", sourceSha256: process.env.QA_ADMIN_SOURCE_SHA256,
    evidence, pageErrors: errors, failurePaths: ["unsaved-draft-unchanged", "invalid-save-unchanged", "successful-retry"],
    actualAdminSaveReload: true, actualPublicRender: true, productionAccess: false }, null, 2));
  console.log(JSON.stringify({ status: "pass", checkpoints: fixtures.checkpoints.length, viewportChecks: 8, productionAccess: false }));
} catch (error) {
  await page.screenshot({ path: path.join(output, "hero-compatibility-failure.png"), fullPage: true }).catch(() => undefined);
  writeFileSync(path.join(output, "hero-compatibility-failure.txt"), String(error) + "\n" + await page.locator("body").innerText().catch(() => ""));
  throw error;
} finally { await context.close(); await browser.close(); }
