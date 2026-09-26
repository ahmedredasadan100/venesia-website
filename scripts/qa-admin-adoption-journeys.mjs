import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium, expect } from "playwright/test";

// This is a fixed verifier consumed by the existing owned Supabase lifecycle.
// It has no database key, custom auth route, reusable session artifact or product hook.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.env.QA_ADMIN_OUTPUT || join(root, ".tmp-qa/admin-adoption-inventory"));
mkdirSync(output, { recursive: true });
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const forms = await jiti.import(join(root, "src/lib/admin/form-system/adoption-manifest.ts"));
const collections = await jiti.import(join(root, "src/lib/admin/interaction-system/adoption-manifest.ts"));
const axes = Object.keys(collections.ADMIN_CURRENT_SHARED_CAPABILITY_SET);
const inventory = [
  ...forms.ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map(entry => ({ boundary: "form", id: entry.id, surfaces: entry.surfaces })),
  ...collections.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(surface =>
    surface.consumerAdoptionEvidence.length
      ? surface.consumerAdoptionEvidence.map(consumer => ({ boundary: "collection", id: consumer.id, surfaces: [consumer.route] }))
      : [{ boundary: "collection", id: surface.id, surfaces: surface.routes }]),
];
const startedAt = new Date().toISOString();
const evidence = [], databaseReadback = [], readOnlyReadback = [], menuIntegrityReadback = [], requiredCases = [], expectedBlockedRequests = [];
const inventoryOnly = process.argv.includes("--inventory-only");
const coreClosure = process.argv.includes("--core-closure");
const coreCohort = process.argv.find(arg => arg.startsWith("--core-cohort="))?.slice("--core-cohort=".length) ?? "preview-recovery-templates";
assert.ok(["preview-recovery-templates", "domain-forms", "domain-commands", "page-composition", "template-libraries", "readonly-hubs", "recovery-templates", "specialized-settings"].includes(coreCohort));
let driverCompleted = false, activeCase = "bootstrap";
let specializedSettingsResult = null;
const progress = [];
const previewMatrix = collections.ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.flatMap(consumer =>
  ["published", "unpublished", "deleted"].flatMap(publication => ["authorized", "revoked"].map(session => ({
    consumer: consumer.id, publication, session, status: "open", evidence: null,
  }))));
const previewNonApplicability = [
  { consumer: "topic-media-edit-preview", behavior: "public-view", reason: "The actual Media editor declares internal-preview only." },
  { consumer: "topic-category-collection-preview", behavior: "internal-preview", reason: "The actual Category builder declares the public listing route only, with publication policy always." },
  { consumer: "topic-series-collection-preview", behavior: "public-view", reason: "The actual Series builder declares the authenticated filtered Admin list only." },
  ...collections.ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.map(consumer => ({ consumer: consumer.id, behavior: "disabled-access", reason: "Current concrete builders declare allowed/hidden actions; no role-derived disabled state is supplied by these consumers." })),
];
const sourceFiles = ["src/lib/admin/form-system/adoption-manifest.ts", "src/lib/admin/interaction-system/adoption-manifest.ts", "scripts/verify-admin-row-actions-capability.mts"];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, createHash("sha256").update(readFileSync(join(root, file))).digest("hex")]));
const write = (file, value) => writeFileSync(join(output, file), JSON.stringify(value, null, 2) + "\n");
const errors = [];
function checkpoint(step, phase, details = {}) {
  progress.push({ case: activeCase, step, phase, at: new Date().toISOString(), ...details });
  write("admin-adoption-progress.json", { startedAt, sourceSha256: process.env.QA_ADMIN_SOURCE_SHA256 ?? null, steps: progress });
}
async function observe(step, task) {
  checkpoint(step, "begin");
  try { const value = await task(); checkpoint(step, "complete"); return value; }
  catch (error) {
    checkpoint(step, "failed");
    if (activeCase === "bootstrap") { errors.push({ id: "bootstrap", message: "Bootstrap stage failed: " + step }); write("admin-adoption-browser.json", receipt()); }
    throw error;
  }
}
function receipt() {
  const evidenceIdCounts = new Map();
  for (const row of evidence) evidenceIdCounts.set(row.id, (evidenceIdCounts.get(row.id) ?? 0) + 1);
  const failedIds = new Set(errors.map(row => row.id));
  const eligibleEvidence = evidence.filter(row => row.status === "pass" && evidenceIdCounts.get(row.id) === 1 && !failedIds.has(row.id));
  const eligibleIds = new Set(eligibleEvidence.map(row => row.id));
  const covered = new Map(eligibleEvidence.flatMap(row => row.coverage.map(key => [key, row.id])));
  const settledPreviewMatrix = previewMatrix.map(row => row.status === "behavior_verified" && eligibleIds.has(row.evidence)
    ? row : { ...row, status: "open", evidence: null });
  const cases = requiredCases.map(row => ({ ...row, status: covered.has(row.key) ? "behavior_verified" : "open", evidence: covered.get(row.key) ?? null }));
  return {
    status: errors.length ? "fail" : inventoryOnly || driverCompleted ? "pass" : "running",
    inventoryOnly, driverCompleted, scope: coreClosure ? "core-closure" : "audit2-selected", cohort: coreClosure ? coreCohort : null, proofBoundary: inventoryOnly ? "applicability inventory only; no browser execution" : "owned local production Next and real authenticated application persistence",
    globalClosed: driverCompleted && errors.length === 0 && cases.length > 0 && cases.every(row => row.status === "behavior_verified") && inventory.every(row => row.domainJourneyInventoryComplete) && settledPreviewMatrix.every(row => row.status === "behavior_verified"),
    inventorySource: sourceHashes, sourceSha256: process.env.QA_ADMIN_SOURCE_SHA256 ?? null,
    startedAt, specializedSettings: specializedSettingsResult, inventory, coverageModel: "Canonical applicable capability cells and generic shared Form lifecycle only; specialized and Collection domain journeys remain unclassified/open.", requiredCases: cases, evidence, databaseReadback, readOnlyReadback, menuIntegrityReadback, previewMatrix: settledPreviewMatrix, previewNonApplicability, errors, expectedBlockedRequests: typeof expectedBlockedRequests === "undefined" ? [] : expectedBlockedRequests,
    limitations: ["Unexecuted applicability cells remain open; successful representative journeys do not close the full inventory.",
      "Database readback expectations require the owning parent to verify through its opaque owned handle.",
      "This verifier does not claim production, Vercel delivery, or every permission and failure state."],
  };
}
// Reuse the canonical preflight's decisions, rather than reproduce its applicability algorithm.
const preflight = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/verify-admin-row-actions-capability.mts",
  "--consumer-capability-audit", "--all", "--phase", "applicability", "--json"],
  { cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 4_000_000, windowsHide: true,
    env: { ...process.env, QA_ADMIN_USERNAME: "", QA_ADMIN_PASSWORD: "" } });
assert.equal(preflight.status, 0, "Canonical applicability preflight failed: " + (preflight.stderr || preflight.stdout));
const canonical = JSON.parse(preflight.stdout.split(/\r?\n/).find(line => line.startsWith('{"phase":')));
assert.deepEqual(canonical.capabilities, axes);
assert.equal(canonical.consumers.length, inventory.length);
for (const consumer of inventory) {
  const match = canonical.consumers.find(row => row.id === consumer.id && row.boundary === consumer.boundary);
  assert.ok(match, "Canonical preflight omitted current consumer " + consumer.id);
  consumer.applicability = match.decisions;
  const genericForm = consumer.boundary === "form" && consumer.applicability.form_runtime?.state === "adopted";
  consumer.domainJourneyInventoryComplete = genericForm;
  consumer.behaviorInventoryBoundary = genericForm ? "shared_form_lifecycle" : "specialized_or_collection_domain_journeys_still_require_case_inventory";
  if (genericForm) for (const surface of consumer.surfaces) {
    for (const scenario of ["save_reload", "failure_preserves_input", "retry", "rollback", "permission_denied"]) {
      requiredCases.push({ key: [consumer.boundary, consumer.id, surface, scenario].join(":"), consumer: consumer.id, boundary: consumer.boundary, surface, scenario });
    }
  }
  for (const [axis, decision] of Object.entries(consumer.applicability)) if (decision.state !== "not_applicable") {
    requiredCases.push({ key: [consumer.boundary, consumer.id, "capability", axis].join(":"), consumer: consumer.id, boundary: consumer.boundary, axis, scenario: decision.state === "approved_exception" ? "approved_exception_contract_behavior" : "complete_applicable_capability_behavior", declaration: decision.state });
  }
}
for (const preview of collections.ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION) requiredCases.push({ key: "preview:" + preview.id, consumer: preview.id, boundary: "preview", scenario: "actual_destination" });
write("admin-adoption-browser.json", receipt());
if (inventoryOnly) {
  console.log(JSON.stringify({ inventoryOnly: true, consumers: inventory.length, axes: axes.length, requiredCases: requiredCases.length, globalClosed: false }));
  process.exit(0);
}
assert.match(process.env.QA_ADMIN_SOURCE_SHA256 ?? "", /^[a-f0-9]{64}$/u, "Authenticated journeys require the owning frozen-source manifest digest.");
const origin = new URL(process.env.E2E_BASE_URL).origin;
assert.equal(new URL(origin).hostname, "127.0.0.1", "Only the owned loopback app is permitted.");
assert.ok(process.env.QA_ADMIN_USERNAME && process.env.QA_ADMIN_PASSWORD, "The owned lifecycle must supply its private local account.");
const fixtures = JSON.parse(readFileSync(process.env.QA_ADMIN_FIXTURES, "utf8"));
const allowedStorage = JSON.parse(process.env.QA_ADMIN_STORAGE_PUBLIC_PREFIXES || "[]");
assert.ok(allowedStorage.every(value => new URL(value).hostname === "127.0.0.1"));
const browser = await observe("browser-launch", () => chromium.launch({ headless: true }));
const context = await observe("context-create", () => browser.newContext({ viewport: { width: 1440, height: 1000 } }));
const page = await observe("page-create", () => context.newPage());
page.setDefaultTimeout(25_000);
let coreFormPermission = null;
const externalRequests = [];
let expectedLogoutDestination = null;
const ownedNetworkOnly = async route => {
  const url = route.request().url();
  if (url.startsWith(origin + "/") || allowedStorage.some(prefix => url.startsWith(prefix)) || /^(?:data|blob):/.test(url)) await route.continue();
  else {
    const parsed = new URL(url), request = route.request();
    const logout = expectedLogoutDestination === url && request.isNavigationRequest();
    const projectMap = coreClosure && activeCase.startsWith("core-project-") && parsed.origin === "https://maps.google.com" && parsed.pathname === "/maps"
      && request.resourceType() === "document" && request.frame().parentFrame() !== null;
    if (logout || projectMap) expectedBlockedRequests.push({ case: activeCase, reason: logout ? "configured-logout-navigation" : "existing-project-map-iframe", origin: parsed.origin, pathname: parsed.pathname, networkAllowed: false });
    else externalRequests.push(parsed.origin);
    await route.abort("blockedbyclient");
  }
};
await observe("owned-network-guard", () => context.route("**/*", ownedNetworkOnly));
const formKey = (id, surface, scenario) => ["form", id, surface, scenario].join(":");
const saveButton = () => page.locator('[data-admin-form-action="save"]');
const feedback = variant => page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="' + variant + '"]');
class UnacknowledgedActionError extends Error {}
const actionResponse = (target = page) => observe("action-headers", async () => {
  try { return await target.waitForResponse(response => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]), { timeout: 60_000 }); }
  catch { throw new UnacknowledgedActionError("Action HTTP acknowledgement was not observed within 60000ms."); }
});
// Next Flight resolves the action model before stream EOF. This is only the
// HTTP acknowledgement; canonical UI outcomes, reloads and native readback follow.
function assertActionAcknowledged(response) {
  if (response.status() >= 400) throw new UnacknowledgedActionError("Action HTTP acknowledgement failed.");
  checkpoint("action-acknowledgement", "received", { httpStatus: response.status(), proofBoundary: "http_acknowledgement_only" });
}

async function diagnosticWithin(task, fallback) {
  let timer;
  try { return await Promise.race([task(), new Promise(resolve => { timer = setTimeout(() => resolve(fallback), 1_000); })]); }
  catch { return fallback; }
  finally { clearTimeout(timer); }
}
async function failureScreenshot(id) {
  const safe = await diagnosticWithin(async () => new URL(page.url()).pathname !== "/admin/login" && await page.locator('input[type="password"]:visible').count() === 0, false);
  if (safe) await observe("failure-screenshot", () => page.screenshot({ path: join(output, id + "-failure.png"), fullPage: true, timeout: 5_000 })).catch(() => {});
}

async function saveForm({ rejectedField = null } = {}) {
  const pending = actionResponse();
  await observe("save-click", () => saveButton().click());
  const response = await pending;
  assertActionAcknowledged(response);
  await observe("save-enabled", () => expect(saveButton()).toBeEnabled({ timeout: 60_000 }));
  await observe("save-feedback", async () => {
    if (rejectedField !== null) {
      assert.equal(rejectedField, "slug", "The selected rejection contract is the exact taxonomy slug field.");
      await expect(page.locator('[name="slug"]')).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator('[name="slug"]')).toHaveAttribute("aria-describedby", "admin-slug-error");
      await expect(page.locator("#admin-slug-error")).toBeVisible();
      await expect(page.locator("#admin-slug-error")).toHaveText("اختر Slug مختلفًا.");
    } else await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible();
  });
}
async function run(id, coverage, task) {
  activeCase = id; checkpoint("case", "begin");
  const startedAt = new Date().toISOString();
  try {
    const details = await task();
    const domainIdentity = details?.id === undefined ? {} : { entityId: details.entityId ?? details.id };
    const previewTargets = new Set();
    const previewUpdates = (details?.previewCells ?? []).map(cell => {
      const target = previewMatrix.find(row => row.consumer === cell.consumer && row.publication === cell.publication && row.session === cell.session);
      assert.ok(target, "Preview evidence must name a current canonical cell.");
      assert.ok(!previewTargets.has(target), "One journey cannot report the same Preview cell twice.");
      previewTargets.add(target);
      return { target, cell };
    });
    evidence.push({ ...details, ...domainIdentity, id, status: "pass", coverage, startedAt, finishedAt: new Date().toISOString() });
    for (const { target, cell } of previewUpdates) Object.assign(target, { ...cell, status: "behavior_verified", evidence: id });
  } catch (error) {
    errors.push({ id, message: String(error?.message ?? error) });
    evidence.push({ id, status: "fail", coverage: [], startedAt, finishedAt: new Date().toISOString() });
    checkpoint("case", "failed");
    write("admin-adoption-browser.json", receipt());
    await failureScreenshot(id);
    if (error instanceof UnacknowledgedActionError) throw error;
  }
  checkpoint("case", "end");
  write("admin-adoption-browser.json", receipt());
}
async function reloadField(name, expected) {
  await observe("page-page-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
  await expect(page.locator('[name="' + name + '"]').first()).toHaveValue(expected);
}
async function selectListbox(label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function popupProof(link, expected, expectedText) {
  const caller = page.url();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  assert.equal(new URL(href, origin).pathname + new URL(href, origin).search, expected);
  const popupPromise = context.waitForEvent("page");
  await link.click();
  const popup = await popupPromise;
  try {
    await observe("popup-document-ready", () => popup.waitForLoadState("domcontentloaded"));
    await expect(popup.locator("body")).not.toContainText("Internal Server Error");
    await expect(popup.locator("main").first()).toBeVisible();
    await expect(popup.locator("h1").first()).toBeVisible();
    assert.equal(new URL(popup.url()).pathname + new URL(popup.url()).search, expected);
    if (expectedText) await expect(popup.getByText(expectedText, { exact: false }).first()).toBeVisible();
    assert.notEqual(new URL(popup.url()).pathname, "/admin/login");
    return { destination: expected, trustedClick: true, authenticatedDestination: expected.startsWith("/admin/"), usableDocument: true };
  } finally { await observe("popup-close", () => popup.close()); await page.bringToFront(); assert.equal(page.url(), caller); }
}
async function revokeSession() {
  const retainedSession = await context.storageState();
  assert.ok(retainedSession.cookies.some(cookie => cookie.httpOnly), "Revocation proof requires a previously valid signed cookie.");
  await observe("logout-dashboard", () => page.goto(origin + "/admin", { waitUntil: "domcontentloaded" }));
  const destination = await page.locator('a[title="الانتقال للموقع"]').first().getAttribute("href");
  assert.ok(destination);
  expectedLogoutDestination = new URL(destination, origin).href;
  const endpoint = origin + "/api/admin/auth/logout";
  let matchedRequests = 0;
  const countOriginalLogout = request => {
    if (request.url() === endpoint && request.method() === "POST") matchedRequests++;
  };
  page.on("request", countOriginalLogout);
  try {
    const [response] = await observe("existing-logout-acknowledgement", () => Promise.all([
      page.waitForResponse(response => response.request().url() === endpoint && response.request().method() === "POST", { timeout: 25_000 }),
      page.getByRole("button", { name: "خروج", exact: true }).click(),
    ]));
    assert.equal(matchedRequests, 1, "Revocation must execute exactly one original logout request.");
    assert.equal(response.status(), 200, "The real logout request must be acknowledged successfully.");
  } finally {
    page.off("request", countOriginalLogout);
  }
  // AdminShell consumes fetch acknowledgement, then navigates without reading
  // JSON. Body/EOF is not this consumer's settlement contract. HTTP200 alone
  // is not revocation proof: the caller must reject this retained signed cookie
  // at every declared protected Preview target before promoting a cell.
  return retainedSession;
}

try {
  activeCase = "login";
  await observe("page-page-navigation", () => page.goto(origin + "/admin/login", { waitUntil: "domcontentloaded" }));
  await observe("login-fields", async () => {
    await page.locator('input[name="username"]').fill(process.env.QA_ADMIN_USERNAME);
    await page.locator('input[name="password"]').fill(process.env.QA_ADMIN_PASSWORD);
  });
  await observe("login-submit-redirect", () => Promise.all([page.waitForURL(url => url.pathname === "/admin", { timeout: 60_000 }), page.locator('button[type="submit"]').click()]));
  const coreLogin = coreClosure ? { username: process.env.QA_ADMIN_USERNAME, password: process.env.QA_ADMIN_PASSWORD } : null;
  delete process.env.QA_ADMIN_USERNAME; delete process.env.QA_ADMIN_PASSWORD;
  const dashboardHeading = page.getByRole("heading", { name: /^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u, level: 1 });
  await observe("dashboard-ready", () => expect(dashboardHeading).toBeVisible({ timeout: 60_000 }));
  evidence.push({ id: "existing-auth-login", status: "pass", coverage: [], authenticated: true,
    dashboardState: (await dashboardHeading.textContent()).trim(), sessionArtifactWritten: false });
  write("admin-adoption-browser.json", receipt());
  checkpoint("login", "complete");

  if (coreClosure) {
   if (coreCohort === "preview-recovery-templates" || coreCohort === "recovery-templates") {
    if (coreCohort === "preview-recovery-templates") {
    const { runCorePreviewJourneys } = await import("./fixtures/admin-core-preview-journeys.mjs");
    try {
      await runCorePreviewJourneys({ browser, context, page, origin, fixtures, run, observe, popupProof, ownedNetworkOnly, revokeSession, previewMatrix });
    } catch (error) {
      if (!errors.some(row => row.id.startsWith("core-preview-"))) throw error;
      checkpoint("preview-cohort-incomplete", "failed", { independentJourneysContinue: true });
    }
    await observe("core-new-session-after-preview-revocation", async () => {
      await page.goto(origin + "/admin/login", { waitUntil: "domcontentloaded" });
      if (new URL(page.url()).pathname === "/admin/login") {
        await page.locator('input[name="username"]').fill(coreLogin.username);
        await page.locator('input[name="password"]').fill(coreLogin.password);
        await Promise.all([page.waitForURL(url => url.pathname === "/admin", { timeout: 60_000 }), page.locator('button[type="submit"]').click()]);
      }
      coreLogin.username = ""; coreLogin.password = "";
      await expect(dashboardHeading).toBeVisible({ timeout: 60_000 });
    });
    }
    const { runCoreCreateRecoveryJourney } = await import("./fixtures/admin-core-create-recovery-journeys.mjs");
    await runCoreCreateRecoveryJourney({ page, context, origin, output, run, observe, saveForm, saveButton, feedback, databaseReadback });
    const { runCoreCommandRecoveryJourney } = await import("./fixtures/admin-core-command-recovery-journeys.mjs");
    await runCoreCommandRecoveryJourney({ page, origin, output, fixtures, run, observe, feedback, databaseReadback });
    const { runCoreTemplateFormJourneys } = await import("./fixtures/admin-core-form-journeys.mjs");
    await runCoreTemplateFormJourneys({ page, context, origin, fixtures, run, observe, saveButton, feedback, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases });
   } else if (coreCohort === "domain-forms") {
    const { runCoreProjectCreateJourneys } = await import("./fixtures/admin-core-project-create-journeys.mjs");
    await runCoreProjectCreateJourneys({ page, context, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases });
    const { createCoreFormPermissionContext } = await import("./fixtures/admin-core-form-permission-context.mjs");
    coreFormPermission = createCoreFormPermissionContext({page,origin,output,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,requiredCases});
    const { runCoreDomainFormJourneys } = await import("./fixtures/admin-core-domain-form-journeys.mjs");
    await runCoreDomainFormJourneys({ page, context, origin, fixtures, run, observe, saveButton, feedback, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases, permissionReplay:coreFormPermission });
    coreFormPermission.close();coreFormPermission=null;
    const { runCoreOperationalFormJourneys } = await import("./fixtures/admin-core-operational-form-journeys.mjs");
    await runCoreOperationalFormJourneys({ page, context, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases });
    const { runCoreSettingsAndMenuJourneys } = await import("./fixtures/admin-core-settings-journeys.mjs");
    await runCoreSettingsAndMenuJourneys({ page, origin, run, observe, actionResponse, assertActionAcknowledged, databaseReadback, requiredCases });
   } else if (coreCohort === "specialized-settings") {
    const { createCoreNativeCheckpoint } = await import("./fixtures/admin-core-form-permission-context.mjs");
    const { runCoreSpecializedSettingsJourneys } = await import("./fixtures/admin-core-specialized-settings-journeys.mjs");
    try {
      specializedSettingsResult = await runCoreSpecializedSettingsJourneys({page,browser,origin,fixtures,run,observe,ownedNetworkOnly,login:coreLogin,nativeCheckpoint:createCoreNativeCheckpoint({origin,output})});
      assert.equal(specializedSettingsResult.status,"pass","Every selected specialized journey must complete.");
    } finally { coreLogin.username="";coreLogin.password=""; }
   } else if (coreCohort === "template-libraries" || coreCohort === "readonly-hubs") {
    const { createCoreNativeCheckpoint } = await import("./fixtures/admin-core-form-permission-context.mjs");
    const ctx = {page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,databaseReadback,nativeCheckpoint:createCoreNativeCheckpoint({origin,output})};
    if (coreCohort === "template-libraries") {
      const { runCoreTemplateLibraryJourneys } = await import("./fixtures/admin-core-template-library-journeys.mjs");
      await runCoreTemplateLibraryJourneys(ctx);
    } else {
      const { runCoreReadonlyHubJourneys } = await import("./fixtures/admin-core-readonly-hubs-journeys.mjs");
      await runCoreReadonlyHubJourneys(ctx);
    }
   } else if (coreCohort === "page-composition") {
    const { createCoreNativeCheckpoint } = await import("./fixtures/admin-core-form-permission-context.mjs");
    const { runCorePageCompositionJourneys } = await import("./fixtures/admin-core-page-composition-journeys.mjs");
    await runCorePageCompositionJourneys({page,origin,fixtures,run,observe,actionResponse,assertActionAcknowledged,requiredCases,compositionCheckpoint:createCoreNativeCheckpoint({origin,output})});
   } else {
    const { runCoreDomainPersistenceFailureJourneys } = await import("./fixtures/admin-core-domain-persistence-failure-journeys.mjs");
    await runCoreDomainPersistenceFailureJourneys({ page, origin, output, fixtures, run, observe, actionResponse, assertActionAcknowledged });
    const { runCoreDomainCommandJourneys } = await import("./fixtures/admin-core-domain-command-journeys.mjs");
    await runCoreDomainCommandJourneys({ page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback });
    const { runCoreReadonlyJourneys } = await import("./fixtures/admin-core-readonly-journeys.mjs");
    await runCoreReadonlyJourneys({ page, context, origin, fixtures, run, observe, readOnlyReadback });
    const { runCoreDomainTerminalJourneys, runCoreEmptyTrashSuccessJourneys } = await import("./fixtures/admin-core-domain-terminal-journeys.mjs");
    const terminalContext = { page, context, origin, output, fixtures, run, observe, actionResponse, assertActionAcknowledged, databaseReadback };
    await runCoreDomainTerminalJourneys(terminalContext);
    await runCoreEmptyTrashSuccessJourneys(terminalContext);
    const { runCoreDomainPermissionJourneys } = await import("./fixtures/admin-core-domain-permission-journeys.mjs");
    await runCoreDomainPermissionJourneys({ browser, context, origin, output, fixtures, run, observe, ownedNetworkOnly, revokeSession });
   }
  } else {
  const suffix = Date.now().toString(36);
  for (const kind of ["category", "series"]) {
    const plural = kind === "category" ? "categories" : "series";
    const id = "topic-" + kind + "-create-edit";
    await run(kind + "-create-reject-retry-edit-reload", [formKey(id, "create", "save_reload"), formKey(id, "create", "failure_preserves_input"), formKey(id, "create", "retry"), formKey(id, "edit", "save_reload")], async () => {
      await observe("page-page-navigation", () => page.goto(origin + "/admin/content/" + plural + "/new", { waitUntil: "domcontentloaded" }));
      const name = "QA Audit " + kind + " " + suffix;
      const slug = "qa-audit-" + kind + "-" + suffix;
      await page.locator('input[name="name"]').fill(name);
      if (kind === "series") await selectListbox("التصنيف *", fixtures.category.name);
      await page.locator('input[name="slug"]').fill(fixtures[kind].slug);
      await saveForm({ rejectedField: "slug" });
      await expect(page.locator('input[name="name"]')).toHaveValue(name);
      await expect(page.locator('input[name="slug"]')).toHaveValue(fixtures[kind].slug);
      await page.locator('input[name="slug"]').fill(slug);
      await saveForm();
      await observe("page-expected-route", () => page.waitForURL(url => new RegExp("^/admin/content/" + plural + "/[0-9]+$").test(url.pathname)));
      const createdId = Number(new URL(page.url()).pathname.split("/").at(-1));
      await reloadField("name", name);
      const edited = name + " saved";
      await page.locator('input[name="name"]').fill(edited);
      await saveForm();
      await reloadField("name", edited);
      databaseReadback.push({ table: kind === "category" ? "topic_categories" : "topic_series", id: createdId, expected: { name: edited, slug } });
      return { createdId, conflictRejected: true, retryPersisted: true, editPersistedAfterReload: true };
    });
  }

  await run("category-transport-failure-preserves-retries", [formKey("topic-category-create-edit", "edit", "failure_preserves_input"), formKey("topic-category-create-edit", "edit", "retry")], async () => {
    const path = "/admin/content/categories/" + fixtures.category.id;
    await observe("page-page-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" }));
    const original = await page.locator('input[name="name"]').inputValue();
    const desired = original + " Audit saved";
    await page.locator('input[name="name"]').fill(desired);
    let blocked = 0;
    const failBeforeSend = async route => {
      if (!blocked && route.request().method() === "POST" && route.request().headers()["next-action"]) { blocked++; await route.abort("failed"); }
      else await route.fallback();
    };
    await page.route("**/*", failBeforeSend);
    await saveButton().click();
    await expect(feedback("danger").first()).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue(desired);
    assert.equal(blocked, 1);
    await page.unroute("**/*", failBeforeSend);
    const observer = await observe("context-page-create", () => context.newPage());
    await observe("observer-page-navigation", () => observer.goto(origin + path, { waitUntil: "domcontentloaded" }));
    await expect(observer.locator('input[name="name"]')).toHaveValue(original);
    await observe("observer-close", () => observer.close());
    await saveForm(); await reloadField("name", desired);
    await page.locator('input[name="name"]').fill(original);
    await saveForm(); await reloadField("name", original);
    databaseReadback.push({ table: "topic_categories", id: Number(fixtures.category.id), expected: { name: original } });
    return { blockedRequests: blocked, unsavedFieldsPreserved: true, independentReadUnchanged: true, retryPersisted: true, fixtureRestored: true };
  });

  await run("topic-editor-save-reload", [formKey("topic-article-create-edit", "edit", "save_reload")], async () => {
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/topics/" + fixtures.topic.id, { waitUntil: "domcontentloaded" }));
    const title = await page.locator('[name="title"]').inputValue();
    await page.locator('[name="title"]').fill(title + " Audit saved");
    await saveForm(); await reloadField("title", title + " Audit saved");
    await page.locator('[name="title"]').fill(title);
    await saveForm(); await reloadField("title", title);
    databaseReadback.push({ table: "topics", id: Number(fixtures.topic.id), expected: { title } });
    return { savedAndRestoredThroughActualEditor: true };
  });
  await run("article-preview-public-destinations", ["preview:topic-article-edit-preview-public"], async () => {
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/topics/" + fixtures.topic.id, { waitUntil: "domcontentloaded" }));
    const internal = await popupProof(page.locator('a[data-admin-entity-preview-action="internal-preview"]'), "/admin/content/topics/" + fixtures.topic.id + "/preview", fixtures.topic.title);
    const link = page.locator('a[data-admin-entity-preview-action="public-view"]');
    const href = await link.getAttribute("href");
    assert.ok(href && href.startsWith("/topics/"));
    const published = await popupProof(link, href, fixtures.topic.title);
    return { destinations: [internal, published], previewCells: [{ consumer: "topic-article-edit-preview-public", publication: "published", session: "authorized" }] };
  });
  await run("media-draft-create-preview", [formKey("topic-media-create-edit", "news:create", "save_reload"), "preview:topic-media-edit-preview"], async () => {
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/topics/new?type=news", { waitUntil: "domcontentloaded" }));
    const title = "QA Audit media " + suffix;
    await page.locator('[name="title"]').fill(title);
    await page.locator('#content-category-listbox').click();
    await page.getByRole("option", { name: fixtures.category.name, exact: true }).click();
    await saveForm();
    await observe("page-expected-route", () => page.waitForURL(url => /^\/admin\/content\/topics\/[0-9]+$/.test(url.pathname)));
    const id = Number(new URL(page.url()).pathname.split("/").at(-1));
    await reloadField("title", title);
    const destination = await popupProof(page.locator('a[data-admin-entity-preview-action="internal-preview"]'), "/admin/content/topics/" + id + "/preview", title);
    databaseReadback.push({ table: "topics", id, expected: { title, content_type: "news", status: "unpublished" } });
    return { createdId: id, destination, previewCells: [{ consumer: "topic-media-edit-preview", publication: "unpublished", session: "authorized" }] };
  });
  await run("category-preview-destination", ["preview:topic-category-collection-preview"], async () => {
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/categories", { waitUntil: "domcontentloaded" }));
    const expected = "/topics?category=" + encodeURIComponent(fixtures.category.slug);
    const destination = await popupProof(page.locator('a[href="' + expected + '"]').first(), expected, null);
    return { destination, previewCells: [{ consumer: "topic-category-collection-preview", publication: "published", session: "authorized" }] };
  });
  await run("series-preview-destination", ["preview:topic-series-collection-preview"], async () => {
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/series", { waitUntil: "domcontentloaded" }));
    const expected = "/admin/content/topics?series=" + fixtures.series.id;
    const destination = await popupProof(page.locator('a[href="' + expected + '"]').first(), expected, fixtures.topic.title);
    return { destination, previewCells: [{ consumer: "topic-series-collection-preview", publication: "published", session: "authorized" }] };
  });
  await run("topic-feature-row-command-reload", [], async () => {
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/topics?q=" + encodeURIComponent(fixtures.topic.title), { waitUntil: "domcontentloaded" }));
    const button = page.locator('[data-admin-row-action="featured"][data-admin-entity-id="' + fixtures.topic.id + '"] button');
    await expect(button).toBeEnabled();
    const original = await button.getAttribute("aria-label");
    assert.ok(original && /تمييز/.test(original));
    const response = actionResponse(); await button.click(); assertActionAcknowledged(await response);
    await expect(button).not.toHaveAttribute("aria-label", original);
    await observe("page-page-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    await expect(button).not.toHaveAttribute("aria-label", original);
    const changed = await button.getAttribute("aria-label");
    const resetResponse = actionResponse(); await button.click(); assertActionAcknowledged(await resetResponse);
    await observe("page-page-reload", () => page.reload({ waitUntil: "domcontentloaded" })); await expect(button).toHaveAttribute("aria-label", original);
    databaseReadback.push({ table: "topics", id: Number(fixtures.topic.id), expected: { is_featured: original.startsWith("إلغاء") } });
    return { original, changed, commandSettled: true, reloadedConfirmed: true, fixtureRestored: true };
  });
  await run("menu-stale-selection-after-topic-purge", [], async () => {
    // The browser holds real stale UI state; native lock-order concurrency is
    // separately verified by verify-menu-resource-integrity-isolated.mts.
    const title = "QA Audit stale menu target " + suffix;
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/topics/new?type=news", { waitUntil: "domcontentloaded" }));
    await page.locator('[name="title"]').fill(title);
    await page.locator('#content-category-listbox').click();
    await page.getByRole("option", { name: fixtures.category.name, exact: true }).click();
    await saveForm();
    await observe("page-expected-route", () => page.waitForURL(url => /^\/admin\/content\/topics\/[0-9]+$/.test(url.pathname)));
    const topicId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await reloadField("title", title);
    await observe("page-page-navigation", () => page.goto(origin + "/admin/pages-blocks/menus", { waitUntil: "domcontentloaded" }));
    await page.getByRole("button", { name: "إضافة منيو", exact: true }).click();
    const create = page.getByRole("dialog");
    await create.locator('input[name="name"]').fill("QA Audit stale menu " + suffix);
    await create.locator('input[name="slug"]').fill("qa-audit-stale-menu-" + suffix);
    await create.getByRole("combobox", { name: "مكان الاستخدام", exact: true }).click();
    await page.getByRole("option", { name: "Custom", exact: true }).click();
    const menuCreateResponse = actionResponse();
    await create.getByRole("button", { name: "إنشاء وفتح القائمة", exact: true }).click();
    assertActionAcknowledged(await menuCreateResponse);
    await observe("page-expected-route", () => page.waitForURL(url => /^\/admin\/pages-blocks\/menus\/[0-9]+$/.test(url.pathname)));
    const menuId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await page.getByRole("tab", { name: "إضافة عنصر", exact: true }).click();
    await page.locator('input[name="label"]').fill("QA stale reference");
    await page.getByRole("button", { name: "اختيار الرابط", exact: true }).click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("button", { name: "Topics", exact: true }).click();
    await picker.getByPlaceholder("ابحث داخل Topics...").fill(title);
    await picker.getByRole("button").filter({ hasText: title }).first().click();
    await picker.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
    await expect(page.locator('input[name="menu_link_linked_id"]')).toHaveValue(String(topicId));
    const topics = await observe("context-page-create", () => context.newPage());
    try {
      const row = topics.locator('[data-admin-row-action="more"][data-admin-entity-id="' + topicId + '"] button');
      const command = async label => {
        await expect(row).toBeVisible(); await row.click();
        await topics.locator('[data-admin-row-action-menu-item="delete"]').click();
        const confirmation = topics.getByRole("dialog");
        const response = actionResponse(topics);
        await confirmation.getByRole("button", { name: label, exact: true }).click();
        const result = await response; assertActionAcknowledged(result);
        await expect(row).toHaveCount(0, { timeout: 60_000 });
      };
      await observe("topics-page-navigation", () => topics.goto(origin + "/admin/content/topics?q=" + encodeURIComponent(title), { waitUntil: "domcontentloaded" }));
      await command("نقل إلى المحذوفات");
      await observe("topics-page-navigation", () => topics.goto(origin + "/admin/content/topics?view=trash&q=" + encodeURIComponent(title), { waitUntil: "domcontentloaded" }));
      await command("حذف نهائي");
      await observe("topics-page-reload", () => topics.reload({ waitUntil: "domcontentloaded" })); await expect(row).toHaveCount(0);
      await expect(page.locator('input[name="menu_link_linked_id"]')).toHaveValue(String(topicId));
      const response = actionResponse();
      await page.getByRole("button", { name: "إضافة", exact: true }).click();
      const result = await response; assertActionAcknowledged(result);
      const message = "لم يعد هدف الرابط الداخلي موجودًا. حدّث الاختيار ثم احفظ القائمة.";
      await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get("message"), message);
      await observe("page-page-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
      await expect(page.getByRole("cell", { name: "QA stale reference", exact: true })).toHaveCount(0);
      menuIntegrityReadback.push({ topicId, menuId, expectedItems: 0 });
      return { topicId, menuId, staleSelectionRetainedAcrossPages: true, purgeConfirmedAfterReload: true,
        actualMenuActionRejected: true, noBrowserInjectedActionOrSql: true, nativeConcurrencyClaim: false };
    } finally { await observe("topics-close", () => topics.close()); }
  });
  const collectionPath = (plural, name, trash = false) => "/admin/content/" + plural + "?q=" + encodeURIComponent(name) + (trash ? "&view=trash" : "");
  const collectionCommand = async (plural, id, name, command, confirmLabel, trash = false) => {
    await observe("page-page-navigation", () => page.goto(origin + collectionPath(plural, name, trash), { waitUntil: "domcontentloaded" }));
    const row = page.locator('[data-admin-row-action="more"][data-admin-entity-id="' + id + '"] button');
    await expect(row).toBeVisible(); await row.click();
    await page.locator('[data-admin-row-action-menu-item="' + command + '"]').click();
    const response = actionResponse();
    await page.getByRole("dialog").getByRole("button", { name: confirmLabel, exact: true }).click();
    assertActionAcknowledged(await response); await expect(row).toHaveCount(0, { timeout: 60_000 });
  };
  const visibility = async (id, title, visible) => {
    await observe("page-page-navigation", () => page.goto(origin + collectionPath("topics", title), { waitUntil: "domcontentloaded" }));
    const button = page.locator('[data-admin-row-action="visibility"][data-admin-entity-id="' + id + '"] button');
    await expect(button).toHaveAttribute("aria-label", (visible ? "إظهار " : "إخفاء ") + title);
    const response = actionResponse(); await button.click(); assertActionAcknowledged(await response);
    await expect(button).toHaveAttribute("aria-label", (visible ? "إخفاء " : "إظهار ") + title, { timeout: 60_000 });
  };
  const deletedTopicDestinations = async id => {
    const outcomes = [];
    for (const path of ["/admin/content/topics/" + id, "/admin/content/topics/" + id + "/preview"]) {
      const response = await observe("page-page-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" }));
      await expect(page.getByRole("heading", { name: "صفحة الإدارة غير موجودة", exact: true })).toBeVisible();
      await expect(page.locator('[data-admin-entity-preview-action]')).toHaveCount(0);
      outcomes.push({ path, status: response.status(), missingRecordUi: true });
    }
    return outcomes;
  };
  await run("article-preview-unpublished-and-deleted", [], async () => {
    const id = Number(fixtures.topic.id), title = fixtures.topic.title;
    await visibility(id, title, false);
    await observe("page-page-navigation", () => page.goto(origin + "/admin/content/topics/" + id, { waitUntil: "domcontentloaded" }));
    await expect(page.locator('[data-admin-entity-preview-action="public-view"]')).toHaveCount(0);
    const unpublished = await popupProof(page.locator('a[data-admin-entity-preview-action="internal-preview"]'), "/admin/content/topics/" + id + "/preview", title);
    await collectionCommand("topics", id, title, "delete", "نقل إلى المحذوفات");
    const deleted = await deletedTopicDestinations(id);
    await collectionCommand("topics", id, title, "archive", "استعادة", true);
    await visibility(id, title, true);
    const expected = databaseReadback.find(row => row.table === "topics" && row.id === id && Object.hasOwn(row.expected, "title"));
    assert.ok(expected); expected.expected.status = "published";
    return { unpublished, deleted, restoredPublished: true, previewCells: [
      { consumer: "topic-article-edit-preview-public", publication: "unpublished", session: "authorized", publicView: "hidden", internalPreview: "usable" },
      { consumer: "topic-article-edit-preview-public", publication: "deleted", session: "authorized", consumerAndInternalDestination: "missing-record UI" },
    ] };
  });
  await run("media-preview-deleted", [], async () => {
    const media = databaseReadback.find(row => row.expected.content_type === "news"); assert.ok(media);
    await collectionCommand("topics", media.id, media.expected.title, "delete", "نقل إلى المحذوفات");
    const deleted = await deletedTopicDestinations(media.id);
    await collectionCommand("topics", media.id, media.expected.title, "archive", "استعادة", true);
    return { deleted, restoredUnpublished: true, previewCells: [{ consumer: "topic-media-edit-preview", publication: "deleted", session: "authorized", consumerAndInternalDestination: "missing-record UI" }] };
  });
  await run("taxonomy-preview-unpublished-and-deleted", [], async () => {
    const outcomes = [], previewCells = [];
    for (const [table, plural, consumer] of [["topic_categories", "categories", "topic-category-collection-preview"], ["topic_series", "series", "topic-series-collection-preview"]]) {
      const entity = databaseReadback.find(row => row.table === table && Object.hasOwn(row.expected, "slug")); assert.ok(entity);
      const expected = table === "topic_categories" ? "/topics?category=" + encodeURIComponent(entity.expected.slug) : "/admin/content/topics?series=" + entity.id;
      await observe("page-page-navigation", () => page.goto(origin + collectionPath(plural, entity.expected.name), { waitUntil: "domcontentloaded" }));
      const unpublished = await popupProof(page.locator('a[href="' + expected + '"]').first(), expected, null);
      await collectionCommand(plural, entity.id, entity.expected.name, "delete", "نقل إلى المحذوفات");
      await observe("page-page-navigation", () => page.goto(origin + collectionPath(plural, entity.expected.name, true), { waitUntil: "domcontentloaded" }));
      await expect(page.locator('[data-admin-row-action="more"][data-admin-entity-id="' + entity.id + '"]')).toBeVisible();
      await expect(page.locator('a[href="' + expected + '"]')).toHaveCount(0);
      await collectionCommand(plural, entity.id, entity.expected.name, "archive", "استعادة", true);
      outcomes.push({ consumer, unpublished, deletedConsumerPreview: "hidden", restored: true });
      previewCells.push({ consumer, publication: "unpublished", session: "authorized", destination: "usable" },
        { consumer, publication: "deleted", session: "authorized", consumerPreview: "hidden", detailDestinationNotApplicable: "This capability targets a collection route rather than a deleted resource detail." });
    }
    return { outcomes, previewCells };
  });
  await run("preview-revoked-real-session", [], async () => {
    const retainedSession = await revokeSession();
    const stale = await observe("browser-context-create", () => browser.newContext({ storageState: retainedSession }));
    await stale.route("**/*", ownedNetworkOnly);
    const tab = await observe("stale-page-create", () => stale.newPage());
    const media = databaseReadback.find(row => row.expected.content_type === "news"); assert.ok(media);
    const checks = [
      { consumer: "topic-article-edit-preview-public", publication: "published", paths: ["/admin/content/topics/" + fixtures.topic.id, "/admin/content/topics/" + fixtures.topic.id + "/preview"] },
      { consumer: "topic-media-edit-preview", publication: "unpublished", paths: ["/admin/content/topics/" + media.id, "/admin/content/topics/" + media.id + "/preview"] },
      { consumer: "topic-category-collection-preview", publication: "published", paths: ["/admin/content/categories"] },
      { consumer: "topic-series-collection-preview", publication: "published", paths: ["/admin/content/series", "/admin/content/topics?series=" + fixtures.series.id] },
    ];
    const outcomes = [];
    try {
      for (const check of checks) for (const path of check.paths) {
        await observe("tab-page-navigation", () => tab.goto(origin + path, { waitUntil: "domcontentloaded" }));
        await observe("tab-expected-route", () => tab.waitForURL(url => url.pathname === "/admin/login"));
        await expect(tab.locator('input[name="username"]')).toBeVisible();
        outcomes.push({ consumer: check.consumer, path, rejectedToExistingLogin: true });
      }
      // Public-view destinations remain public; a revoked Admin cookie grants
      // nothing and is not required to read them.
      for (const path of ["/topics/" + fixtures.topic.slug, "/topics?category=" + encodeURIComponent(fixtures.category.slug)]) {
        const response = await observe("tab-page-navigation", () => tab.goto(origin + path, { waitUntil: "domcontentloaded" }));
        assert.equal(response.status(), 200); await expect(tab.locator("h1").first()).toBeVisible();
        outcomes.push({ path, publicViewStillPublic: true });
      }
    } finally { await observe("stale-close", () => stale.close()); }
    return { outcomes, existingLogoutRevokedRetainedSignedCookie: true, cookieArtifactsWritten: false,
      previewCells: checks.map(check => ({ consumer: check.consumer, publication: check.publication, session: "revoked", protectedConsumerAndDestination: "redirect to login" })) };
  });
  }
  assert.deepEqual(externalRequests, [], "The browser attempted an unowned network destination.");
  driverCompleted = true; checkpoint("driver", "complete");
} catch (error) {
  const failure = { id: "driver", message: String(error?.message ?? error), pathname: new URL(page.url()).pathname };
  errors.push(failure);
  checkpoint("driver", "failed");
  write("admin-adoption-browser.json", receipt());
  const visibleHeadings = await diagnosticWithin(async () => (await page.locator("h1:visible").allTextContents()).slice(0, 10).map(value => value.trim().slice(0, 500)), null);
  if (visibleHeadings !== null) { failure.visibleHeadings = visibleHeadings; write("admin-adoption-browser.json", receipt()); }
  await failureScreenshot("driver");
} finally {
  coreFormPermission?.close();
  delete process.env.QA_ADMIN_USERNAME; delete process.env.QA_ADMIN_PASSWORD;
  write("admin-adoption-browser.json", receipt());
  await observe("context-close", () => context.close()); await observe("browser-close", () => browser.close());
  write("admin-adoption-browser.json", receipt());
}
console.log(JSON.stringify({ status: receipt().status, passed: evidence.filter(row => row.status === "pass").length,
  failed: errors.length, globalClosed: receipt().globalClosed, requiredCases: requiredCases.length, output: join(output, "admin-adoption-browser.json") }));
assert.deepEqual(errors, [], "Every selected authenticated journey must pass; unexecuted inventory cells remain open.");
