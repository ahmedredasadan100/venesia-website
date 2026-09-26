import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect, request as http } from "playwright/test";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const searchLabel = "ابحث بالاسم أو المسار أو الوصف البديل…";
const groupNames = ["readiness", "folders", "upload-validation-retry", "catalog-query", "metadata-failure-retry", "preview", "picker-use", "in-use-delete", "physical-move", "replace-references", "detach-delete", "permission"];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=", "base64");
export function coreMediaSyntheticPdf() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let data = "%PDF-1.4\n"; const offsets = [];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(data)); data += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; }
  const offset = Buffer.byteLength(data);
  data += "xref\n0 5\n0000000000 65535 f \n" + offsets.map(n => String(n).padStart(10, "0") + " 00000 n \n").join("");
  return Buffer.from(data + "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n" + offset + "\n%%EOF\n");
}
export function buildCoreMediaPlan({ fixtures, forms, collections, requiredCases }) {
  const fixture = fixtures.mediaClosure;
  assert.ok(fixture?.namespaceUnique === true && fixture.maximumAssets === 13);
  assert.match(fixture.namespace, /^qa-core-media-[a-f0-9]{16}$/u);
  assert.ok(Number.isSafeInteger(fixture.article?.id) && fixture.article.id > 0);
  assert.equal(fixture.article.slug, "qa-core-media-article");
  assert.equal(fixture.article.editPath, "/admin/content/topics/" + fixture.article.id);
  const form = forms.filter(row => row.id === "activity-sitemap-media-commands"); assert.equal(form.length, 1);
  for (const surface of ["media-command", "media-usage"]) assert.ok(form[0].surfaces.includes(surface));
  assert.equal(collections.filter(row => row.id === "media-library").length, 1);
  const relatedRequiredCases = requiredCases.filter(row => row.consumer === "media-library" || row.consumer === form[0].id).map(row => row.key);
  assert.ok(relatedRequiredCases.length > 0);
  return { ...fixture, groups: [...groupNames], relatedRequiredCases, automaticCoverage: [] };
}
export function assertCoreMediaReceipt(value, request, fixture) {
  assert.equal(value?.id, request.id); assert.equal(value.kind, "media-library-state"); assert.equal(value.status, "pass");
  assert.equal(value.namespace, fixture.namespace); assert.equal(value.articleId, fixture.article.id);
  assert.ok(Number.isSafeInteger(value.qaActorId) && value.qaActorId > 0 && typeof value.ownedRunId === "string" && value.ownedRunId);
  for (const key of ["assets", "objects", "folders", "references", "leases", "reservations", "audits", "binaries"]) assert.ok(Array.isArray(value[key]));
  assert.ok(value.assets.length <= 13);
  for (const row of value.audits) assert.equal(Number(row.actor_admin_user_id), value.qaActorId);
  assert.match(value.storageSha256, /^[a-f0-9]{64}$/u);
}
export function assertCoreMediaUnchanged(before, after, allPublic = false) {
  for (const key of ["ownedRunId", "qaActorId", "namespace", "articleId", "article", "assets", "objects", "folders", "references", "leases", "reservations", "audits", "storageSha256"]) assert.deepEqual(after[key], before[key], "Unexpected Media change: " + key);
  if (allPublic) { assert.match(before.publicDataSha256, /^[a-f0-9]{64}$/u); assert.equal(after.publicDataSha256, before.publicDataSha256); assert.equal(after.publicTableInventorySha256, before.publicTableInventorySha256); }
}
export function assertCoreMediaAsset(state, id, expected) {
  const rows = state.assets.filter(row => row.id === id); assert.equal(rows.length, 1); const asset = rows[0];
  assert.equal(asset.provider, "supabase"); assert.equal(Number(asset.uploaded_by), state.qaActorId);
  for (const [key, value] of Object.entries(expected)) assert.equal(asset[key], value, key);
  const objects = state.objects.filter(row => row.bucket_id === asset.bucket && row.name === asset.object_key);
  const binary = state.binaries.find(row => row.publicUrl === asset.public_url); assert.ok(binary);
  if (asset.status === "deleted") { assert.equal(objects.length, 0); assert.equal(binary.missing, true); }
  else { assert.equal(objects.length, 1); assert.equal(binary.status, 200); assert.equal(binary.missing, false); assert.equal(binary.bytes, Number(asset.byte_size)); assert.equal(binary.sha256, asset.checksum); }
  return asset;
}
export function assertCoreMediaAudit(before, after, action, predicate) {
  assert.equal(after.qaActorId, before.qaActorId);
  const previous = new Set(before.audits.map(row => String(row.id)));
  assert.deepEqual(after.audits.filter(row => previous.has(String(row.id))), before.audits);
  const rows = after.audits.filter(row => !previous.has(String(row.id)) && row.action === action && predicate(row));
  assert.equal(rows.length, 1, "One semantic audit for this exact intent."); assert.equal(Number(rows[0].actor_admin_user_id), after.qaActorId);
  return rows[0].id;
}
export function validateCoreMediaReplaySpecimen(origin, specimen) {
  const base = new URL(origin), target = new URL(specimen.url);
  assert.equal(base.protocol, "http:"); assert.equal(base.hostname, "127.0.0.1"); assert.ok(base.port);
  assert.equal(target.origin, origin); assert.equal(target.username + target.password + target.hash, "");
  assert.ok(["/api/admin/media-library", "/api/admin/media-usage"].includes(target.pathname));
  assert.ok(["GET", "POST", "PATCH", "DELETE"].includes(specimen.method));
  assert.ok(Buffer.isBuffer(specimen.body) && specimen.body.length <= 2 * 1024 * 1024);
  assert.equal(hash(specimen.body), specimen.bodySha256); assert.equal(specimen.acknowledged, true);
  assert.deepEqual(Object.keys(specimen.headers).sort(), specimen.method === "GET" ? [] : ["content-type", "origin"]);
  if (specimen.method !== "GET") { assert.equal(specimen.headers.origin, origin); assert.ok(specimen.headers["content-type"]); }
  if (target.pathname.endsWith("media-usage")) assert.equal(specimen.method, "GET");
}
export function assertCoreMediaPermissionPrerequisites(specimens, verifiedOperations) {
  for (const operation of ["upload", "create_folder", "reconcile", "update_metadata", "move_asset", "replace_all", "DELETE", "/api/admin/media-library", "/api/admin/media-usage"]) {
    assert.ok(specimens.some(row => row.operation === operation), "Missing acknowledged specimen: " + operation);
    assert.ok(verifiedOperations.has(operation), "Missing joined UI/native operation proof: " + operation);
  }
}
export function assertCoreMediaPermissionResponse(status, value) {
  assert.equal(status, 401, "Validation/500/redirect is not API Auth rejection.");
  assert.equal(value?.error, "Unauthorized");
}
export function matchesCoreMediaResponse(response, origin, method, { operation, path = "/api/admin/media-library", queryMatch = {} } = {}) {
  const request = response.request(), url = new URL(response.url());
  if (url.origin !== origin || url.pathname !== path || request.method() !== method) return false;
  if (!Object.entries(queryMatch).every(([key, value]) => url.searchParams.get(key) === value)) return false;
  if (!operation) return true;
  try { return request.postDataJSON().operation === operation; } catch { return false; }
}
export async function runCoreMediaJourneys(ctx) {
  const { page, origin, fixtures, run, observe, mediaCheckpoint, requiredCases, actionResponse, assertActionAcknowledged } = ctx;
  assert.equal(new URL(origin).origin, origin); assert.equal(new URL(origin).hostname, "127.0.0.1"); assert.equal(typeof mediaCheckpoint, "function");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: forms } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../../src/lib/admin/interaction-system/adoption-manifest.ts");
  const plan = buildCoreMediaPlan({ fixtures, forms, collections: ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces, requiredCases });
  const completed = [], checkpoints = [], specimens = [], uploaded = [], payloads = new Map(), verifiedOperations = new Set();
  let primaryId, currentId;
  const main = () => page.locator("main"), search = owner => owner.getByPlaceholder(searchLabel, { exact: true });
  const feedback = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="media-library"]');
  const imageField = () => page.locator('[data-admin-media-image-field="image"]');
  const assetButton = (owner, name) => owner.locator('button[aria-pressed]').filter({ has: page.getByText(name, { exact: true }) });
  async function snapshot(label) {
    const request = { id: randomUUID(), kind: "media-library-state" }, value = await observe("media-native-" + label, () => mediaCheckpoint(request));
    assertCoreMediaReceipt(value, request, plan); checkpoints.push({ label, receiptId: value.id }); return value;
  }
  async function navigate(path) {
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss(); page.on("dialog", leave);
    try { await observe("media-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); } finally { page.off("dialog", leave); }
  }
  function remember(response) {
    const req = response.request(), method = req.method(), url = new URL(req.url());
    if (url.origin !== origin || !["/api/admin/media-library", "/api/admin/media-usage"].includes(url.pathname) || response.status() < 200 || response.status() > 299) return;
    const body = req.postDataBuffer() ?? Buffer.alloc(0), headers = method === "GET" ? {} : { "content-type": req.headers()["content-type"], origin: req.headers().origin };
    const specimen = { url: req.url(), method, body: Buffer.from(body), headers, bodySha256: hash(body), acknowledged: true };
    validateCoreMediaReplaySpecimen(origin, specimen);
    const operation = method === "GET" ? url.pathname : method === "POST" && !headers["content-type"].includes("application/json") ? "upload" : (() => { try { const value = JSON.parse(body.toString()); return value.operation === "reconcile" && value.dryRun === true ? "reconcile_preview" : value.operation ?? method; } catch { return method; } })();
    if (specimens.some(row => row.operation === operation)) { specimen.body.fill(0); return; }
    specimens.push({ ...specimen, operation });
  }
  async function api(method, trigger, { operation, status = 200, path = "/api/admin/media-library", queryMatch = {} } = {}) {
    const wait = page.waitForResponse(response => matchesCoreMediaResponse(response, origin, method, { operation, path, queryMatch }), { timeout: 60_000 });
    const [response] = await Promise.all([wait, trigger()]); assert.equal(response.status(), status);
    const value = await response.json(); remember(response); return value;
  }
  async function library(query = plan.namespace) {
    await navigate("/admin/media-library?q=" + encodeURIComponent(query)); await expect(search(main())).toHaveValue(query);
    return api("GET", () => main().getByRole("button", { name: "كل الملفات", exact: true }).click(), { queryMatch: { q: query, folder: null } });
  }
  async function folder(root, child = false, owner = main()) {
    // Folder accessible names come from the actual Catalog response, never a guessed translation.
    const data = await api("GET", () => search(owner).fill(plan.namespace + "-folder-probe"), { queryMatch: { q: plan.namespace + "-folder-probe" } });
    const entry = data.folders.find(row => row.path === root); assert.ok(entry);
    await api("GET", () => owner.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ has: page.getByText(entry.displayName, { exact: true }) }).click(), { queryMatch: { folder: root, q: plan.namespace + "-folder-probe" } });
    if (child) await api("GET", () => owner.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ hasText: plan.namespace }).click(), { queryMatch: { folder: root + "/" + plan.namespace, q: plan.namespace + "-folder-probe" } });
    await api("GET", () => search(owner).fill(plan.namespace), { queryMatch: { q: plan.namespace, folder: child ? root + "/" + plan.namespace : root } });
  }
  async function selectAsset(asset) {
    const data = await library(asset.display_name); assert.ok(data.assets.some(row => row.id === asset.id));
    const button = assetButton(main(), asset.display_name); await expect(button).toHaveCount(1);
    await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(main().getByRole("heading", { name: asset.display_name, exact: true })).toBeVisible();
  }
  async function ready() {
    await navigate("/admin/settings/media");
    const value = await api("POST", () => main().getByRole("button", { name: "معاينة الفحص", exact: true }).click(), { operation: "reconcile" });
    assert.equal(value.dryRun, true); assert.equal(value.complete, true);
  }
  async function reconcile() {
    await ready(); await main().getByRole("button", { name: "تنفيذ الفحص والمزامنة", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "تنفيذ الفحص والمزامنة؟", exact: true });
    const value = await api("POST", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "reconcile" });
    assert.equal(value.dryRun, false); assert.equal(value.complete, true); await expect(dialog).toHaveCount(0);
  }
  async function openDelete() {
    await main().getByRole("button", { name: /^حذف آمن \(/u }).click();
    const dialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true }); await expect(dialog).toBeVisible(); return dialog;
  }
  async function upload(files, replacement = false) {
    const input = replacement ? main().locator("section").filter({ has: page.getByRole("heading", { name: "البيانات الوصفية", exact: true }) }).locator('input[type="file"]') : main().locator('input[type="file"][multiple]');
    const responses = [];
    const listener = response => { if (new URL(response.url()).pathname === "/api/admin/media-library" && response.request().method() === "POST") responses.push(response); };
    page.on("response", listener);
    try {
      await input.setInputFiles(files);
      if (replacement) await expect(page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true })).toBeVisible({ timeout: 60_000 });
      else { await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "success", { timeout: 60_000 }); await expect(main().getByRole("button", { name: "رفع ملفات", exact: true })).toBeEnabled(); }
      await expect.poll(() => responses.length, { timeout: 60_000 }).toBe(files.length);
      for (const [index, response] of responses.entries()) {
        assert.equal(response.status(), 201); const value = await response.json(); assert.ok(value.asset?.id);
        remember(response); uploaded.push(value.asset.id); assert.ok(uploaded.length <= 13);
        payloads.set(value.asset.id, { sha256: hash(files[index].buffer), size: files[index].buffer.length });
      }
      return (await responses.at(-1).json()).asset;
    } finally { page.off("response", listener); }
  }
  async function articleSave(expectedImage) {
    const form = page.locator("form[data-admin-form-runtime]");
    const [response] = await Promise.all([actionResponse(), form.locator('button[type="submit"]').click()]); assertActionAcknowledged(response);
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"],[data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible({ timeout: 60_000 });
    await page.reload({ waitUntil: "domcontentloaded" }); await form.locator('[data-admin-tab-id="basic"]').click();
    await expect(imageField().locator('input[name="image"]')).toHaveValue(expectedImage);
  }
  const details = (group, verified, extra = {}) => {
    const value = { group, consumer: "media-library", formConsumer: "activity-sitemap-media-commands", surfaces: ["media-command", "media-usage"], verified, automaticCoverage: [], ...extra };
    const operations = { readiness: ["reconcile"], folders: ["create_folder"], "upload-validation-retry": ["upload"],
      "catalog-query": ["/api/admin/media-library"], "metadata-failure-retry": ["update_metadata"], "picker-use": ["/api/admin/media-usage"],
      "physical-move": ["move_asset"], "replace-references": ["replace_all"], "detach-delete": ["DELETE"] };
    for (const operation of operations[group] ?? []) verifiedOperations.add(operation);
    completed.push(value); return value;
  };
  const group = (name, execute) => run("core-media-" + name, [], execute);
  try {
    await group("readiness", async () => {
      const before = await snapshot("readiness-before"); await ready();
      assertCoreMediaUnchanged(before, await snapshot("preview-readonly"), true);
      await main().getByRole("button", { name: "تنفيذ الفحص والمزامنة", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "تنفيذ الفحص والمزامنة؟", exact: true });
      await dialog.locator("[data-admin-confirm-cancel]").click(); await expect(dialog).toHaveCount(0);
      assertCoreMediaUnchanged(before, await snapshot("reconcile-cancel"), true);
      await reconcile(); const after = await snapshot("reconciled"); assert.equal(after.runtime?.state, "synced");
      assert.equal((await library()).readiness.usageResultsAuthoritative, true);
      return details("readiness", ["preview_readonly", "confirmation_cancel", "real_reconciliation"]);
    });
    await group("folders", async () => {
      for (const root of ["images", "files"]) {
        await library(); await folder(root); await main().getByRole("button", { name: "+ جديد", exact: true }).click();
        const before = await snapshot("folder-before-" + root); let posts = 0;
        const listener = req => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/admin/media-library") posts++; };
        page.on("request", listener);
        try { await main().getByRole("button", { name: "إنشاء داخل " + root, exact: true }).click(); }
        finally { page.off("request", listener); }
        assert.equal(posts, 0);
        await main().getByPlaceholder("اسم المجلد", { exact: true }).fill(plan.namespace);
        await api("POST", () => main().getByRole("button", { name: "إنشاء داخل " + root, exact: true }).click(), { operation: "create_folder", status: 201 });
        const after = await snapshot("folder-after-" + root);
        assert.ok(after.folders.some(row => row.normalized_path === root + "/" + plan.namespace));
        assertCoreMediaAudit(before, after, "media_folder.create", row => row.metadata.folder === root + "/" + plan.namespace);
      }
      return details("folders", ["empty_no_post", "create_native_actor_audit"]);
    });
    await group("upload-validation-retry", async () => {
      await library(); await folder("images", true);
      const before = await snapshot("upload-invalid-before"); let posts = 0;
      const listener = req => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/admin/media-library") posts++; };
      page.on("request", listener);
      try {
        await main().locator('input[type="file"][multiple]').setInputFiles({ name: plan.namespace + ".svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
        await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "warning"); await expect(feedback()).toContainText("SVG");
      } finally { page.off("request", listener); }
      assert.equal(posts, 0); assertCoreMediaUnchanged(before, await snapshot("upload-invalid-after"), true);
      await upload(Array.from({ length: 10 }, (_, index) => ({ name: plan.namespace + "-" + index + ".png", mimeType: "image/png", buffer: png })));
      primaryId = uploaded[0]; currentId = primaryId;
      await library(); await folder("files", true);
      await upload([{ name: plan.namespace + ".pdf", mimeType: "application/pdf", buffer: coreMediaSyntheticPdf() }]);
      const after = await snapshot("uploaded"); assert.equal(after.assets.length, 11);
      for (const id of uploaded) {
        const asset = assertCoreMediaAsset(after, id, { status: "active", reconciliation_state: "synced" });
        assert.equal(asset.checksum, payloads.get(id).sha256);
        assertCoreMediaAudit(before, after, "media_asset.create", row => row.metadata.objectKey === asset.object_key && row.metadata.bucket === asset.bucket);
      }
      return details("upload-validation-retry", ["invalid_zero_write", "busy_released", "valid_png_pdf_retry", "eleven_catalog_object_binary_audits"]);
    });
    await group("catalog-query", async () => {
      const state = await snapshot("query-baseline"); assert.equal(state.assets.length, 11);
      const first = await library(); assert.equal(first.assets.length, 10); assert.equal(first.total, 11);
      const selectedFirstPage = assetButton(main(), first.assets[0].displayName);
      await selectedFirstPage.click(); await expect(selectedFirstPage).toHaveAttribute("aria-pressed", "true");
      const second = await api("GET", () => main().locator("[data-admin-table-pagination]").getByRole("button", { name: "التالي", exact: true }).click(), { queryMatch: { page: "2" } }); assert.equal(second.assets.length, 1);
      await expect(main().locator('button[aria-pressed="true"]').filter({ hasNotText: /^(?:شبكة|قائمة)$/u })).toHaveCount(0);
      assert.deepEqual([...first.assets, ...second.assets].map(row => row.id).sort(), state.assets.map(row => row.id).sort());
      const again = await api("GET", () => main().locator("[data-admin-table-pagination]").getByRole("button", { name: "السابق", exact: true }).click(), { queryMatch: { page: "1" } });
      assert.deepEqual(again.assets.map(row => row.id), first.assets.map(row => row.id));
      await main().locator('[data-admin-table-pagination] button[aria-haspopup="listbox"]').click();
      const twenty = await api("GET", () => page.getByRole("option", { name: "20", exact: true }).click(), { queryMatch: { pageSize: "20" } }); assert.equal(twenty.assets.length, 11);
      await main().getByRole("button", { name: "قائمة", exact: true }).click();
      for (const asset of state.assets) await expect(assetButton(main(), asset.display_name)).toHaveCount(1);
      await main().getByRole("button", { name: "شبكة", exact: true }).click();
      const selected = assetButton(main(), first.assets[0].displayName); await selected.click(); await expect(selected).toHaveAttribute("aria-pressed", "true");
      await main().getByRole("button", { name: "مسح التحديد", exact: true }).click(); await expect(selected).toHaveAttribute("aria-pressed", "false");
      await main().getByRole("button", { name: /^الفلاتر/u }).click();
      const filter = page.getByRole("dialog", { name: "الفلاتر", exact: true });
      await filter.getByRole("option", { name: "PDF", exact: true }).click();
      const pdfOnly = await api("GET", () => filter.getByRole("button", { name: "تطبيق الفلاتر", exact: true }).click(), { queryMatch: { kind: "document" } }); assert.equal(pdfOnly.total, 1);
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).searchParams.get("kind"), "document"); await expect(search(main())).toHaveValue(plan.namespace);
      await library();
      const selectBeforeQuery = assetButton(main(), first.assets[0].displayName);
      await selectBeforeQuery.click(); await expect(selectBeforeQuery).toHaveAttribute("aria-pressed", "true");
      const empty = await api("GET", () => search(main()).fill(plan.namespace + "-absent"), { queryMatch: { q: plan.namespace + "-absent" } }); assert.equal(empty.total, 0);
      await expect(main()).toContainText("لا توجد ملفات مطابقة داخل هذا العرض.");
      await expect(main().locator('button[aria-pressed="true"]').filter({ hasNotText: /^(?:شبكة|قائمة)$/u })).toHaveCount(0);
      assertCoreMediaUnchanged(state, await snapshot("query-after"), true);
      return details("catalog-query", ["query_reload", "kind_filter", "selection_clear", "page_query_selection_reset", "grid_list", "pagination_disjoint_union", "page_size", "empty_result"]);
    });
    await group("metadata-failure-retry", async () => {
      const before = await snapshot("metadata-before"), asset = before.assets.find(row => row.id === primaryId); assert.ok(asset); await selectAsset(asset);
      const form = main().locator("form").filter({ has: page.locator('input[name="displayName"]') });
      const values = { displayName: plan.namespace + "-authored", defaultAltText: "QA synthetic pixel", defaultTitle: "QA media title", defaultCaption: "QA media caption" };
      for (const [name, value] of Object.entries(values)) await form.locator('[name="' + name + '"]').fill(value);
      let blocked = 0;
      const interceptor = async route => {
        const req = route.request();
        if (req.method() === "PATCH" && req.postDataJSON()?.operation === "update_metadata" && blocked === 0) { blocked++; await route.abort("failed"); }
        else await route.fallback();
      };
      const removeMetadataRoute = await registerCorePageRoute(page, origin + "/api/admin/media-library", interceptor);
      try { await form.getByRole("button", { name: "حفظ البيانات", exact: true }).click(); await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "danger"); }
      finally { await removeMetadataRoute(); }
      assert.equal(blocked, 1); await expect(form.getByRole("button", { name: "حفظ البيانات", exact: true })).toBeEnabled();
      for (const [name, value] of Object.entries(values)) await expect(form.locator('[name="' + name + '"]')).toHaveValue(value);
      assertCoreMediaUnchanged(before, await snapshot("metadata-failed"), true);
      await api("PATCH", () => form.getByRole("button", { name: "حفظ البيانات", exact: true }).click(), { operation: "update_metadata" });
      const after = await snapshot("metadata-saved");
      const saved = assertCoreMediaAsset(after, primaryId, { display_name: values.displayName, default_alt_text: values.defaultAltText, default_title: values.defaultTitle, default_caption: values.defaultCaption });
      assert.equal(saved.object_key, asset.object_key);
      assertCoreMediaAudit(before, after, "media_asset.update", row => row.metadata.assetId === primaryId && row.metadata.operation === "metadata");
      await selectAsset(saved); for (const [name, value] of Object.entries(values)) await expect(form.locator('[name="' + name + '"]')).toHaveValue(value);
      for (const query of [saved.display_name, saved.object_key, saved.default_alt_text]) {
        const found = await library(query); assert.deepEqual(found.assets.map(row => row.id), [primaryId]);
      }
      assertCoreMediaUnchanged(after, await snapshot("metadata-search-readonly"), true);
      return details("metadata-failure-retry", ["pre_delivery_failure", "typed_values_preserved", "busy_released", "real_retry_reload_native", "name_path_alt_search"]);
    });
    await group("preview", async () => {
      const state = await snapshot("preview"), image = assertCoreMediaAsset(state, primaryId, { status: "active" }); await selectAsset(image);
      const preview = main().locator("section").filter({ has: page.getByRole("heading", { name: image.display_name, exact: true }) }).locator("img");
      await expect(preview).toHaveCount(1);
      await expect.poll(() => preview.evaluate((element, ownedUrl) => {
        const source = new URL(element.currentSrc || element.src, location.origin);
        const actual = source.pathname === "/_next/image" ? source.searchParams.get("url") : source.href;
        return actual === ownedUrl && element.complete && element.naturalWidth === 1 && element.naturalHeight === 1;
      }, image.public_url)).toBe(true);
      const document = state.assets.find(row => row.media_kind === "document"); assert.ok(document); assertCoreMediaAsset(state, document.id, { status: "active" }); await selectAsset(document);
      await expect(main().getByTitle("معاينة " + document.display_name, { exact: true })).toHaveAttribute("src", document.public_url + "#page=1&view=FitH&toolbar=0&navpanes=0");
      return details("preview", ["loaded_image", "pdf_owned_iframe", "native_exact_binary_hashes"]);
    });
    await group("picker-use", async () => {
      const before = await snapshot("picker-before"), asset = before.assets.find(row => row.id === primaryId); assert.ok(asset);
      await navigate(plan.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
      await imageField().getByRole("button").first().click();
      let dialog = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true }); await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "إلغاء", exact: true }).click(); await expect(dialog).toHaveCount(0);
      assertCoreMediaUnchanged(before, await snapshot("picker-cancel"), true);
      await imageField().getByRole("button").first().click();
      dialog = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
      await folder("images", true, dialog); await search(dialog).fill(asset.display_name);
      await assetButton(dialog, asset.display_name).click();
      await dialog.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click(); await expect(dialog).toHaveCount(0);
      await page.locator('[name="image_alt"]').fill("QA synthetic image"); await articleSave(asset.public_url);
      const after = await snapshot("picker-saved"); assert.equal(after.article.image, asset.public_url);
      assert.ok(after.references.some(row => row.asset_id === primaryId && String(row.entity_identity) === String(plan.article.id) && row.field_key === "image"));
      assertCoreMediaAudit(before, after, "topic.update", row => String(row.entity_id) === String(plan.article.id));
      const usage = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/media-usage" && response.status() === 200);
      await selectAsset(asset); const usageResponse = await usage; remember(usageResponse);
      await expect(main().getByRole("link", { name: "فتح التحرير", exact: true })).toHaveAttribute("href", plan.article.editPath);
      await expect(main()).toContainText(plan.article.title);
      return details("picker-use", ["cancel_no_write", "actual_picker", "article_save_reload", "native_reference", "usage_edit_link"]);
    });
    await group("in-use-delete", async () => {
      const before = await snapshot("used-before"), asset = before.assets.find(row => row.id === currentId); assert.ok(asset);
      assert.ok(before.references.some(row => row.asset_id === asset.id)); await selectAsset(asset);
      let dialog = await openDelete(); await dialog.locator("[data-admin-confirm-cancel]").click();
      assertCoreMediaUnchanged(before, await snapshot("used-cancel"), true);
      dialog = await openDelete();
      const value = await api("DELETE", () => dialog.locator("[data-admin-confirm-submit]").click(), { status: 409 });
      assert.equal(value.code, "media_delete_in_use"); await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-admin-confirm-submit]")).toBeEnabled();
      await expect(feedback()).toContainText("لا يمكن حذف الملف قبل فك جميع مراجعه الحالية.");
      const after = await snapshot("used-rejected"); assertCoreMediaAsset(after, asset.id, { status: "active" });
      assert.deepEqual(after.references, before.references); assert.equal(after.article.image, before.article.image); assert.equal(after.storageSha256, before.storageSha256);
      await dialog.locator("[data-admin-confirm-cancel]").click();
      return details("in-use-delete", ["cancel_no_write", "real_conflict", "object_refs_preserved", "retryable_confirmation"]);
    });
    await group("physical-move", async () => {
      for (const [index, targetFolder] of ["images/" + plan.namespace, "images/" + plan.namespace + "/moved"].entries()) {
        const before = await snapshot("move-before-" + index), asset = before.assets.find(row => row.id === currentId); assert.ok(asset);
        await selectAsset(asset); await main().getByRole("button", { name: "نقل / إعادة تسمية", exact: true }).click();
        const form = main().locator("form").filter({ has: page.locator('input[name="targetFolder"]') });
        const filename = plan.namespace + "-renamed.png";
        await form.getByLabel("مجلد الوجهة", { exact: true }).fill(targetFolder); await form.getByLabel("اسم الملف الفعلي الجديد", { exact: true }).fill(filename);
        await form.getByRole("button", { name: "مراجعة العملية", exact: true }).click();
        let dialog = page.getByRole("dialog", { name: "تنفيذ تغيير فعلي لمسار التخزين؟", exact: true });
        await dialog.locator("[data-admin-confirm-cancel]").click(); await expect(form.getByLabel("مجلد الوجهة", { exact: true })).toHaveValue(targetFolder);
        assertCoreMediaUnchanged(before, await snapshot("move-cancel-" + index), true);
        await form.getByRole("button", { name: "مراجعة العملية", exact: true }).click();
        dialog = page.getByRole("dialog", { name: "تنفيذ تغيير فعلي لمسار التخزين؟", exact: true });
        await api("PATCH", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "move_asset" }); await expect(dialog).toHaveCount(0);
        const after = await snapshot("move-after-" + index);
        const changed = assertCoreMediaAsset(after, currentId, { object_key: targetFolder + "/" + filename, status: "active" });
        assert.equal(changed.checksum, asset.checksum); assert.equal(after.article.image, changed.public_url);
        const semanticReferences = rows => rows.map(({ asset_id, domain_key, entity_type, entity_identity, field_key, reference_state }) => ({ asset_id, domain_key, entity_type, entity_identity, field_key, reference_state })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        assert.deepEqual(semanticReferences(after.references), semanticReferences(before.references), "A physical move preserves this owned asset's semantic references; the canonical synchronization RPC may replace row IDs.");
        assert.equal(after.binaries.find(row => row.publicUrl === asset.public_url)?.missing, true);
        assertCoreMediaAudit(before, after, "media_asset.update", row => row.metadata.assetId === asset.id && row.metadata.operation === (index ? "move_physical_object" : "rename_physical_object"));
      }
      return details("physical-move", ["cancel_preserves_draft", "rename_move", "same_bytes", "old_object_absent", "reference_retargeted"]);
    });
    await group("replace-references", async () => {
      const before = await snapshot("replace-before"), asset = before.assets.find(row => row.id === currentId); assert.ok(asset);
      await selectAsset(asset); await upload([{ name: plan.namespace + "-replacement-cancel.png", mimeType: "image/png", buffer: png }], true);
      let dialog = page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true });
      const staged = await snapshot("replacement-staged"); assert.equal(staged.assets.length, before.assets.length + 1);
      await dialog.locator("[data-admin-confirm-cancel]").click();
      const cancelled = await snapshot("replacement-cancelled"); assertCoreMediaUnchanged(staged, cancelled, true); assert.equal(cancelled.article.image, asset.public_url);
      await selectAsset(asset);
      const next = await upload([{ name: plan.namespace + "-replacement-confirm.png", mimeType: "image/png", buffer: png }], true);
      const preConfirm = await snapshot("replacement-confirm-before");
      dialog = page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true });
      await api("PATCH", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "replace_all" }); await expect(dialog).toHaveCount(0);
      const after = await snapshot("replacement-confirmed");
      assert.equal(after.article.image, next.publicUrl); assert.equal(after.references.some(row => row.asset_id === asset.id), false);
      assertCoreMediaAsset(after, asset.id, { status: "active" }); assertCoreMediaAsset(after, next.id, { status: "active" });
      assertCoreMediaAudit(preConfirm, after, "media_asset.update", row => row.metadata.previousAssetId === asset.id && row.metadata.nextAssetId === next.id && row.metadata.operation === "replace_all_supported_references");
      currentId = next.id;
      return details("replace-references", ["stage_real_upload", "cancel_retains_new_object", "confirmed_rebind", "old_object_retained"]);
    });
    await group("detach-delete", async () => {
      await navigate(plan.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
      await imageField().getByRole("button", { name: "إزالة", exact: true }).click(); await articleSave("");
      await reconcile(); let before = await snapshot("detached"); assert.ok(!before.article.image); assert.equal(before.references.length, 0);
      for (const asset of before.assets.filter(row => row.status === "active")) {
        await selectAsset(asset); await expect(main()).toContainText("لا توجد استخدامات حالية لهذا الملف.");
        let dialog = await openDelete(); await dialog.locator("[data-admin-confirm-cancel]").click();
        assertCoreMediaUnchanged(before, await snapshot("delete-cancel"), true);
        dialog = await openDelete(); await api("DELETE", () => dialog.locator("[data-admin-confirm-submit]").click()); await expect(dialog).toHaveCount(0);
        const after = await snapshot("delete-complete"); assertCoreMediaAsset(after, asset.id, { status: "deleted" });
        assertCoreMediaAudit(before, after, "media_asset.delete", row => row.metadata.assetId === asset.id);
        assert.ok(after.reservations.some(row => row.asset_id === asset.id && row.status === "completed"));
        assert.equal(after.leases.some(row => row.asset_id === asset.id && (row.status === "active" || (["failed", "expired"].includes(row.status) && !row.resolved_at))), false);
        before = after;
        if (before.assets.some(row => row.status === "active")) { await reconcile(); before = await snapshot("delete-next-ready"); }
      }
      assert.equal(before.assets.filter(row => row.status !== "deleted").length, 0);
      return details("detach-delete", ["article_detach", "authoritative_unused", "cancel_no_write", "safe_delete_all_owned_files", "tombstone_binary_absence"]);
    });
    await group("permission", async () => {
      assertCoreMediaPermissionPrerequisites(specimens, verifiedOperations);
      const before = await snapshot("permission-before"), client = await http.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        for (const specimen of specimens) {
          validateCoreMediaReplaySpecimen(origin, specimen);
          const response = await client.fetch(specimen.url, { method: specimen.method, headers: specimen.headers, ...(specimen.method === "GET" ? {} : { data: specimen.body }), maxRedirects: 0, timeout: 30_000 });
          assertCoreMediaPermissionResponse(response.status(), await response.json()); await response.dispose();
        }
      } finally { await client.dispose(); }
      assertCoreMediaUnchanged(before, await snapshot("permission-after"), true);
      return details("permission", ["actual_cookie_free_HTTP_Auth_boundary", "all_public_storage_unchanged"], { operations: specimens.map(row => row.operation), proofLimit: "No UI denial or internal Action execution claim." });
    });
  } finally { for (const specimen of specimens) specimen.body.fill(0); }
  return { completed, checkpoints, relatedRequiredCases: plan.relatedRequiredCases, automaticCoverage: [], globalClosed: false,
    limits: ["Media only; sibling Activity/Sitemap remain separate.", "No Production, original assets, external provider or generic Form/Row Actions closure."] };
}
