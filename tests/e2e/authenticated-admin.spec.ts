import { expect, test } from "playwright/test";
import type { MediaCatalogAsset, MediaDeleteEligibility } from "../../src/lib/admin/media-catalog/types";

const storageState = process.env.E2E_ADMIN_STORAGE_STATE?.trim();

if (storageState) {
  test.use({ storageState });
}

test.describe("authenticated Admin browser foundation", () => {
  test("opens the authenticated Admin shell without mutating data", async ({ page }) => {
    test.skip(
      !storageState,
      "E2E_ADMIN_STORAGE_STATE is required; credentials and cookies never belong in the repository.",
    );

    const response = await page.goto("/admin/content/topics", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("[data-admin-shell]")).toHaveCount(1);
    await expect(page.locator("[data-admin-page-header]:visible")).toHaveCount(1);
  });
});

// Shared geometry contract: fractional display scaling must not manufacture overflow.
// Use the same authenticated, read-only owner for representative table consumers.
test.use({ launchOptions: { args: ["--force-device-scale-factor=1.25"] } });

test.describe("Admin table responsive width contract", () => {
  test.use({ deviceScaleFactor: 1.25 });
  for (const route of ["/admin/pages-blocks/pages", "/admin/content/topics", "/admin/content/categories"]) {
    test(`fractional widths and necessary narrow overflow: ${route}`, async ({ page }) => {
      test.skip(!storageState, "A trusted Admin storage state is required for read-only geometry proof.");
      await page.goto(route);
      const tables = page.locator("table[data-admin-table-width-budget]");
      await expect(tables.first()).toBeVisible();
      for (const width of [1536, 1440, 1280, 768, 390]) {
        await page.setViewportSize({ width, height: 760 });
        await expect.poll(async () => tables.evaluateAll((nodes) => nodes.every((node) => {
          const table = node as HTMLTableElement;
          const scrollport = table.parentElement!;
          const style = getComputedStyle(scrollport);
          const available = scrollport.getBoundingClientRect().width
            - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
          return Math.abs(Number(table.dataset.adminTableWidthBudget) - available) < 0.02;
        }))).toBe(true);
        const geometry = await tables.evaluateAll((nodes) => nodes.map((node) => {
          const table = node as HTMLTableElement;
          const scrollport = table.parentElement!;
          const style = getComputedStyle(scrollport);
          const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
          return {
            available: scrollport.getBoundingClientRect().width - borderX,
            minimum: Number(table.dataset.adminTableConstrainedMinWidth),
            tableWidth: table.getBoundingClientRect().width,
            scrollbar: scrollport.offsetHeight - scrollport.clientHeight - borderY,
            overflow: style.overflowX,
          };
        }));
        for (const item of geometry) {
          expect(item.overflow).toBe("auto");
          if (item.available + 0.02 >= item.minimum) {
            expect(item.tableWidth).toBeLessThanOrEqual(item.available + 0.02);
            expect(item.scrollbar).toBeLessThan(1);
          } else {
            expect(item.tableWidth).toBeGreaterThan(item.available);
            expect(item.tableWidth).toBeGreaterThanOrEqual(item.minimum - 0.02);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    });
  }
});


test.describe("Admin global Footer shared layout", () => {
  test.use({ deviceScaleFactor: 1.25 });
  test("adopts the Footer across lists, create, settings and Page Blocks editing", async ({ page }) => {
    test.skip(!storageState, "A trusted Admin session is required; this proof never saves data.");
    test.setTimeout(90_000);
    await page.goto("/admin/pages-blocks/pages");
    const editLink = page.locator('table a[href^="/admin/pages-blocks/pages/"]').first();
    await expect(editLink).toBeVisible();
    const editorHref = await editLink.getAttribute("href");
    expect(editorHref).toBeTruthy();
    const routes = ["/admin/pages-blocks/pages", "/admin/content/series/new", "/admin/settings/media", editorHref!];
    for (const route of routes) {
      await page.goto(route);
      const footer = page.locator("[data-admin-shell-footer]");
      await expect(footer).toHaveCount(1);
      const companyName = await page.locator("[data-admin-shell-header] span[aria-label]").first().getAttribute("aria-label");
      const year = await page.evaluate(() => new Date().getFullYear());
      await expect(footer).toHaveText(`© ${year} ${companyName}. جميع الحقوق محفوظة.`);
      for (const width of [1536, 1920, 390]) {
        await page.setViewportSize({ width, height: 760 });
        const geometry = await footer.evaluate(node => {
          const content = document.querySelector("[data-admin-route-content]")!;
          const main = node.parentElement!;
          const style = getComputedStyle(node);
          return { position:style.position, direction:style.direction,
            top:node.getBoundingClientRect().top, contentBottom:content.getBoundingClientRect().bottom,
            width:document.documentElement.scrollWidth, viewport:innerWidth,
            mainHeight:main.getBoundingClientRect().height, viewportHeight:innerHeight,
            last:main.lastElementChild===node };
        });
        expect(geometry.position).toBe("static");
        expect(geometry.direction).toBe("rtl");
        expect(geometry.last).toBe(true);
        expect(geometry.top).toBeGreaterThanOrEqual(geometry.contentBottom - 0.02);
        expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
        expect(geometry.mainHeight).toBeGreaterThanOrEqual(geometry.viewportHeight - 0.02);
      }
    }
    // Give the real content more than enough height: the same owner must keep
    // a short page balanced without introducing a page-height scrollbar.
    await page.goto("/admin/pages-blocks/pages");
    await expect(page.locator("[data-admin-shell-footer]")).toBeVisible();
    const roomyHeight = await page.evaluate(() => document.documentElement.scrollHeight + 300);
    await page.setViewportSize({ width:1536, height:roomyHeight });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const bottom = await page.locator("[data-admin-shell-footer]").evaluate(node => ({
      footer:node.getBoundingClientRect().bottom,
      expected:innerHeight - parseFloat(getComputedStyle(node.parentElement!).paddingBottom),
    }));
    expect(Math.abs(bottom.footer - bottom.expected)).toBeLessThan(1);
  });
});


test.describe("Admin collection shared table surface", () => {
  test.use({ deviceScaleFactor: 1.25 });
  test("standalone and specialized collections adopt the same frame contract", async ({ page }) => {
    test.skip(!storageState, "A trusted Admin session is required for read-only surface proof.");
    test.setTimeout(90_000);
    await page.goto("/admin/pages-blocks/pages");
    const link = page.locator('table a[href^="/admin/pages-blocks/pages/"]').first();
    await expect(link).toBeVisible();
    const editorHref = await link.getAttribute("href");
    expect(editorHref).toBeTruthy();
    const reference = new Map<number, unknown>();
    for (const route of ["/admin/pages-blocks/pages", `${editorHref!.split("?")[0]}?tab=modules`]) {
      await page.goto(route);
      const frame = page.locator("[data-admin-entity-list-table-frame]").first();
      await expect(frame).toBeVisible();
      await expect(frame.locator('[data-admin-data-grid-surface="standalone"]')).toHaveCount(1);
      await expect(frame.locator('[data-admin-collection-toolbar-surface="standalone"]')).toHaveCount(1);
      for (const width of [1536, 1920, 1440, 1280, 768, 390]) {
        await page.setViewportSize({ width, height: 760 });
        const result = await frame.evaluate(node => {
          const toolbar = node.querySelector("[data-admin-collection-toolbar-surface]")!;
          const grid = node.querySelector("[data-admin-data-grid-surface]")!;
          const scroll = grid.querySelector("[data-admin-data-grid-scroll]")!;
          const properties = ["borderTopLeftRadius", "borderBottomLeftRadius", "borderTopWidth", "borderLeftWidth", "borderColor", "backgroundColor", "paddingTop", "paddingLeft", "boxShadow", "overflowX"] as const;
          const styles = (element: Element) => {
            const css = getComputedStyle(element);
            return Object.fromEntries(properties.map(key => [key, css[key]]));
          };
          const rect = scroll.getBoundingClientRect();
          const css = getComputedStyle(scroll);
          return {
            surface: { toolbar: styles(toolbar), grid: styles(grid), scroll: styles(scroll), gap: getComputedStyle(node).rowGap },
            seam: Math.abs(toolbar.getBoundingClientRect().bottom - grid.getBoundingClientRect().top),
            aligned: Math.abs(toolbar.getBoundingClientRect().left - grid.getBoundingClientRect().left),
            scrollOwner: css.overflowX,
            scrollbar: (scroll as HTMLElement).offsetHeight - scroll.clientHeight - parseFloat(css.borderTopWidth) - parseFloat(css.borderBottomWidth),
            innerWidth: rect.width - parseFloat(css.borderLeftWidth) - parseFloat(css.borderRightWidth),
            viewport: innerWidth, document: document.documentElement.scrollWidth,
            zoom: visualViewport?.scale,
            frameOverflow: getComputedStyle(node).overflowX,
          };
        });
        expect(result.zoom).toBe(1);
        expect(result.seam).toBeLessThan(0.02);
        expect(result.aligned).toBeLessThan(0.02);
        expect(result.scrollOwner).toBe("auto");
        expect(result.frameOverflow).toBe("visible");
        expect(result.document).toBeLessThanOrEqual(result.viewport);
        // The requested laptop baseline must fit; narrower widths retain real overflow.
        if (width === 1536 || width === 1920) expect(result.scrollbar).toBeLessThan(1);
        if (reference.has(width)) expect(result.surface).toEqual(reference.get(width));
        else reference.set(width, result.surface);
      }
    }
  });
});


test.describe("Managed Media ownership lifecycle", () => {
  test("Signed Upload, picker save, usage, replacement and safe deletion", async ({ page, request, playwright }, testInfo) => {
    test.skip(!storageState || process.env.E2E_MEDIA_LIFECYCLE !== "1",
      "Explicit authorization and a trusted Admin session are required for disposable media/content fixtures.");
    test.setTimeout(600_000);
    const { randomUUID } = await import("node:crypto");
    const { default: sharp } = await import("sharp");
    const namespace = `qa-managed-media-${randomUUID()}`;
    const buffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#245670" } }).png().toBuffer();
    const owned: MediaCatalogAsset[] = [];
    let topicPath: string | null = null;
    const search = "ابحث بالاسم أو المسار أو الوصف البديل…";
    const receipts: object[] = [];
    const responseFor = (operation: string) => page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/admin/media-library" &&
      response.request().method() === "POST" &&
      response.request().headers()["content-type"]?.includes("application/json") === true &&
      response.request().postDataJSON()?.operation === operation);
    const imageField = () => page.locator('[data-admin-media-image-field="image"]');
    async function upload(input: ReturnType<typeof page.locator>, name: string) {
      const prepared = responseFor("prepare_upload");
      const completed = responseFor("complete_upload");
      const storage = page.waitForResponse(response => response.url().includes("/storage/v1/object/upload/sign/") && ["PUT", "POST"].includes(response.request().method()));
      await input.setInputFiles({ name, mimeType: "image/png", buffer });
      const preparation = await prepared;
      expect(preparation.ok()).toBe(true);
      const stored = await storage;
      expect(stored.ok()).toBe(true);
      const response = await completed;
      const result = await response.json();
      expect(response.status(), JSON.stringify(result)).toBe(201);
      expect(result.asset.provider).toBe("supabase");
      expect(result.asset.status).toBe("active");
      expect(result.asset.reconciliationState).toBe("synced");
      owned.push(result.asset);
      receipts.push({ operation: "signed_upload", assetId: result.asset.id, storageStatus: stored.status(), catalogStatus: response.status() });
      const object = await request.get(result.asset.publicUrl);
      expect(object.ok()).toBe(true);
      expect(await object.body()).toEqual(buffer);
      return result.asset as typeof owned[number];
    }
    async function library(asset?: typeof owned[number]) {
      await page.goto(`/admin/media-library?q=${encodeURIComponent(asset?.displayName ?? namespace)}`);
      if (asset) {
        const button = page.locator('main button[aria-pressed]').filter({ has: page.getByText(asset.displayName, { exact: true }) });
        await expect(button).toHaveCount(1);
        await button.click();
        await expect(page.getByRole("heading", { name: asset.displayName, exact: true })).toBeVisible();
      }
    }
    async function usage(asset: typeof owned[number]) {
      const response = await request.get(`/api/admin/media-usage?asset=${encodeURIComponent(asset.publicUrl)}`);
      expect(response.ok()).toBe(true);
      const result = await response.json();
      expect(result.authoritative).toBe(true);
      expect(result.catalogRegistered).toBe(true);
      return result;
    }
    async function save() {
      await page.locator('form[data-admin-form-runtime] button[type="submit"]').click();
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"]').first()).toBeVisible({ timeout: 60_000 });
    }
    async function inspectDeletion(trigger: ReturnType<typeof page.getByRole>) {
      // A complete usage scan is asynchronous; assert its response before the
      // resulting confirmation UI instead of racing the default assertion timer.
      const preview = responseFor("preview_delete");
      await trigger.click();
      const response = await preview;
      const result = await response.json();
      expect(response.ok(), JSON.stringify(result)).toBe(true);
      expect(Array.isArray(result.checks)).toBe(true);
    }
    async function removeAsset(asset: typeof owned[number]) {
      await library(asset);
      const button = page.getByRole("button", { name: /^حذف آمن \(/u });
      await expect(button).toBeEnabled();
      await inspectDeletion(button);
      const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/admin/media-library" && r.request().method() === "DELETE");
      await page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true }).locator("[data-admin-confirm-submit]").click();
      const deletedResponse = await response;
      const { readMediaDeleteResults } = await import("../../src/lib/admin/media-catalog/delete-saga");
      const settled: { deleted: boolean }[] = [];
      const warnings = await readMediaDeleteResults(new Response(await deletedResponse.text(), { status: deletedResponse.status() }), result => settled.push(result));
      expect(settled).toHaveLength(1);
      expect(settled[0].deleted).toBe(true);
      expect(warnings).toEqual([]);
      await expect(page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true })).not.toBeVisible();
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"]').first()).toBeVisible();
      receipts.push({ operation: "safe_delete", assetId: asset.id, referenced: deletedResponse.request().postDataJSON().assets[0].confirmReferenced === true });
    }
    // Readiness is a prerequisite, never silently repaired by this smoke test.
    const anonymous = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
    try {
      expect((await anonymous.post("/api/admin/media-library", { data: { operation: "prepare_upload" } })).status()).toBe(401);
      expect((await anonymous.delete("/api/admin/media-library", { data: { asset: "https://invalid.example/image.png", confirmReferenced: true } })).status()).toBe(401);
      for (const operation of ["preview_delete", "delete_folder"]) {
        expect((await anonymous.post("/api/admin/media-library", { data: { operation, folder: "images/unauthorized" } })).status()).toBe(401);
      }
    } finally { await anonymous.dispose(); }
    const initial = await request.get("/api/admin/media-library");
    const initialState = await initial.json();
    expect(initialState.readiness.usageResultsAuthoritative).toBe(true);
    try {
      await library();
      const original = await upload(page.locator('main input[type="file"][multiple]'), `${namespace}-original.png`);
      await page.goto("/admin/content/topics/new");
      await page.locator('input[name="title"]').fill(namespace);
      await page.locator('input[name="slug"]').fill(namespace);
      await page.getByRole("combobox", { name: "اختر التصنيف", exact: true }).click();
      await page.locator('[role="option"]:not([aria-disabled="true"])').first().click();
      await imageField().getByRole("button").first().click();
      const picker = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
      // Topic pickers start in their consumer folder; search the uploaded root explicitly.
      await picker.getByRole("button", { name: "images", exact: true }).click();
      await picker.getByPlaceholder(search).fill(original.displayName);
      await picker.locator('button[aria-pressed]').filter({ has: page.getByText(original.displayName, { exact: true }) }).click();
      await picker.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click();
      await save();
      await expect(page).toHaveURL(/\/admin\/content\/topics\/\d+/u);
      topicPath = new URL(page.url()).pathname;
      await page.reload();
      await expect(imageField().locator('input[name="image"]')).toHaveValue(original.publicUrl);
      const used = await usage(original);
      expect(used.hits.some((hit: { editHref: string }) => hit.editHref === topicPath)).toBe(true);
      await library(original);
      // Usage is a warning. Cancelling must never call DELETE or change Storage.
      await inspectDeletion(page.getByRole("button", { name: /^حذف آمن \(/u }));
      const deleteDialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true });
      await expect(deleteDialog.getByRole("button", { name: "حذف رغم الاستخدام", exact: true })).toBeEnabled();
      await expect(deleteDialog.locator('[data-media-delete-preview]')).toContainText("سيترك هذه المراجع بدون أصل صالح");
      await expect(deleteDialog.locator(`a[href="${topicPath}"]`)).toBeVisible();
      await deleteDialog.getByRole("button", { name: "إلغاء", exact: true }).click();
      await expect(deleteDialog).not.toBeVisible();
      expect((await request.get(original.publicUrl)).ok()).toBe(true);
      const unconfirmed = await request.delete("/api/admin/media-library", { data: { asset: original.publicUrl } });
      expect(unconfirmed.status()).toBe(409);
      expect((await unconfirmed.json()).code).toMatch(/in_use/u);
      receipts.push({ operation: "referenced_warning_cancel_and_unconfirmed_refusal", assetId: original.id });
      const replacement = await upload(page.locator('main section').filter({ has: page.getByRole("heading", { name: "البيانات الوصفية", exact: true }) }).locator('input[type="file"]'), `${namespace}-replacement.png`);
      const replaced = page.waitForResponse(r => new URL(r.url()).pathname === "/api/admin/media-library" && r.request().method() === "PATCH" && r.request().postDataJSON()?.operation === "replace_all");
      await page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true }).locator("[data-admin-confirm-submit]").click();
      expect((await replaced).ok()).toBe(true);
      await page.goto(topicPath);
      await expect(imageField().locator('input[name="image"]')).toHaveValue(replacement.publicUrl);
      expect((await usage(original)).count).toBe(0);
      expect((await usage(replacement)).hits.some((hit: { editHref: string }) => hit.editHref === topicPath)).toBe(true);
      receipts.push({ operation: "picker_usage_replace", topicPath, originalId: original.id, replacementId: replacement.id });
      // Establish a real baseline containing the owned fixtures, so deletion
      // proves ordinary baseline members work as well as new upload extensions.
      const baseline = await request.post("/api/admin/media-library", { data: { operation: "reconcile", dryRun: false } });
      const baselineResult = await baseline.json();
      expect(baseline.ok(), JSON.stringify(baselineResult)).toBe(true);
      expect(baselineResult.complete).toBe(true);
      await removeAsset(original);
      // Confirmed used deletion preserves the authored value until manual editing.
      await removeAsset(replacement);
      await page.goto(topicPath);
      await expect(imageField().locator('input[name="image"]')).toHaveValue(replacement.publicUrl);
      receipts.push({ operation: "confirmed_referenced_delete_content_unchanged", assetId: replacement.id, topicPath });
      await imageField().getByRole("button", { name: "إزالة", exact: true }).click();
      await save();
      await page.reload();
      await expect(imageField().locator('input[name="image"]')).toHaveValue("");
      expect((await usage(replacement)).count).toBe(0);

      // Mixed bulk usage and folder adoption share exactly the same preview and
      // per-asset deletion API. A transport failure must leave a retryable result.
      const ownedFolder = `images/${namespace}`;
      const folderCreated = await request.post("/api/admin/media-library", { data: { operation: "create_folder", folder: ownedFolder, displayName: namespace } });
      expect(folderCreated.ok()).toBe(true);
      await page.goto(`/admin/media-library?folder=${encodeURIComponent(ownedFolder)}`);
      const bulkUsed = await upload(page.locator('main input[type="file"][multiple]'), `${namespace}-bulk-used.png`);
      const bulkUnused = await upload(page.locator('main input[type="file"][multiple]'), `${namespace}-bulk-unused.png`);
      const folderAsset = await upload(page.locator('main input[type="file"][multiple]'), `${namespace}-folder.png`);
      await page.goto(topicPath);
      await imageField().getByRole("button").first().click();
      const bulkPicker = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
      await bulkPicker.getByRole("button", { name: "images", exact: true }).click();
      await bulkPicker.getByPlaceholder(search).fill(bulkUsed.displayName);
      await bulkPicker.locator('button[aria-pressed]').filter({ has: page.getByText(bulkUsed.displayName, { exact: true }) }).click();
      await bulkPicker.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click();
      await save();
      await page.goto(`/admin/media-library?folder=${encodeURIComponent(ownedFolder)}`);
      for (const asset of [bulkUsed, bulkUnused]) {
        await page.locator('main button[aria-pressed]').filter({ has: page.getByText(asset.displayName, { exact: true }) }).click();
      }
      let injectedFailure = false;
      await page.route("**/api/admin/media-library", async route => {
        const targets = route.request().method() === "DELETE" ? route.request().postDataJSON()?.assets : null;
        if (!injectedFailure && Array.isArray(targets) && targets.some((item: { asset: string }) => item.asset === bulkUnused.publicUrl)) {
          injectedFailure = true;
          const response = await route.fetch({ postData: { assets: targets.filter((item: { asset: string }) => item.asset !== bulkUnused.publicUrl) } });
          // Isolate one target's transport failure while the others use the real
          // shared server batch. Keep its Storage object for the retry assertion.
          const failure = JSON.stringify({ type: "result", asset: bulkUnused.publicUrl, deleted: false, error: "تعذر حذف ملف الاختبار: فشل نقل معزول" }) + "\n";
          await route.fulfill({ response, body: failure + await response.text() });
        } else await route.continue();
      });
      await inspectDeletion(page.getByRole("button", { name: /^حذف آمن \(/u }));
      const bulkDialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true });
      await expect(bulkDialog).toContainText("غير مستخدمة حاليًا");
      await bulkDialog.getByRole("button", { name: "حذف رغم الاستخدام", exact: true }).click();
      await expect(bulkDialog.locator('[data-media-delete-results]')).toContainText("Completed: 1 / Failed: 1 / Remaining: 0", { timeout: 60_000 });
      await expect(bulkDialog).toContainText("فشل نقل معزول");
      expect(injectedFailure).toBe(true);
      await page.unroute("**/api/admin/media-library");
      await inspectDeletion(bulkDialog.getByRole("button", { name: "إعادة الفحص", exact: true }));
      await bulkDialog.getByRole("button", { name: "تأكيد الحذف", exact: true }).click();
      await expect(bulkDialog).not.toBeVisible({ timeout: 60_000 });
      await expect(page.locator('main button[aria-pressed]').filter({ has: page.getByText(bulkUnused.displayName, { exact: true }) })).toHaveCount(0);
      receipts.push({ operation: "mixed_bulk_confirmed_usage_and_retry_after_injected_failure", assetIds: [bulkUsed.id, bulkUnused.id] });
      await inspectDeletion(page.getByRole("button", { name: "حذف المجلد", exact: true }));
      await bulkDialog.getByRole("button", { name: "تأكيد الحذف", exact: true }).click();
      await expect(bulkDialog).not.toBeVisible({ timeout: 60_000 });
      const afterFolder = await (await request.get("/api/admin/media-library")).json();
      expect(afterFolder.folders.some((item: { path: string }) => item.path === ownedFolder)).toBe(false);
      expect(afterFolder.readiness.safeDeleteReady).toBe(true);
      receipts.push({ operation: "folder_delete", folder: ownedFolder, assetId: folderAsset.id });
      await page.goto(topicPath);
      await expect(imageField().locator('input[name="image"]')).toHaveValue(bulkUsed.publicUrl);
      await imageField().getByRole("button", { name: "إزالة", exact: true }).click();
      await save();
    } finally {
      // Persist identifiers on failure so cleanup always targets only this run's fixtures.
      await testInfo.attach("managed-media-lifecycle", { body: JSON.stringify({ namespace, topicPath, assets: owned.map(a => ({ id: a.id, publicUrl: a.publicUrl })), receipts }), contentType: "application/json" });
    }
    // Remove only this run's disposable draft through the existing row-action owner.
    for (const trash of [false, true]) {
      await page.goto(`/admin/content/topics?q=${encodeURIComponent(namespace)}${trash ? "&view=trash" : ""}`);
      const row = page.getByRole("row").filter({ has: page.getByText(namespace, { exact: true }) });
      await expect(row).toHaveCount(1);
      await row.locator('[aria-haspopup="menu"]').click();
      await page.getByRole("menuitem", { name: trash ? "حذف نهائي" : "نقل إلى المحذوفات", exact: true }).click();
      // Row removal is optimistic. Wait for the server action to finish before
      // navigating to trash, otherwise navigation aborts its response/read-back.
      const mutation = page.waitForResponse(response =>
        new URL(response.url()).pathname === "/admin/content/topics" &&
        response.request().method() === "POST" &&
        Boolean(response.request().headers()["next-action"]));
      await page.getByRole("dialog").locator("[data-admin-confirm-submit]").click();
      expect((await mutation).ok()).toBe(true);
      await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"]').first()).toBeVisible();
      await expect(row).toHaveCount(0);
    }
  });
});


test.describe("Managed Media delete throughput", () => {
  test("measures the official delete contract with disposable managed fixtures", async ({ request }, testInfo) => {
    const mode = process.env.E2E_MEDIA_DELETE_THROUGHPUT;
    test.skip(!storageState || !["single", "batch"].includes(mode ?? ""), "Explicit throughput fixture authorization required.");
    test.setTimeout(300_000);
    const { randomUUID } = await import("node:crypto");
    const { default: sharp } = await import("sharp");
    const namespace = `qa-delete-throughput-${randomUUID()}`;
    const buffer = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#346789" } }).png().toBuffer();
    const assets: MediaCatalogAsset[] = [];
    const deleted = new Set<string>();
    const timings: { operation: string; ms: number; count: number }[] = [];
    try {
      for (let index = 0; index < 3; index++) {
        const name = `${namespace}-${index}.png`;
        const preparation = await request.post("/api/admin/media-library", { data: { operation: "prepare_upload", folder: "images", kind: "image", file: { name, type: "image/png", size: buffer.length } } });
        expect(preparation.ok()).toBe(true);
        const signed = await preparation.json();
        const stored = await request.put(signed.signedUrl, { multipart: { cacheControl: "3600", "": { name, mimeType: "image/png", buffer } } });
        expect(stored.ok()).toBe(true);
        const completed = await request.post("/api/admin/media-library", { data: { operation: "complete_upload", receipt: signed.receipt } });
        expect(completed.status()).toBe(201);
        assets.push((await completed.json()).asset);
      }
      // Include the fixtures in a real baseline to measure ordinary assets,
      // rather than only the special additive-upload dataset case.
      const reconciled = await request.post("/api/admin/media-library", { data: { operation: "reconcile", dryRun: false } });
      expect((await reconciled.json()).complete).toBe(true);
      const previewAt = Date.now();
      const preview = await request.post("/api/admin/media-library", { data: { operation: "preview_delete", assets: assets.map(asset => asset.publicUrl) } });
      expect((await preview.json()).checks.every((check: MediaDeleteEligibility) => check.state === "safe_to_delete")).toBe(true);
      timings.push({ operation: "preview", ms: Date.now() - previewAt, count: assets.length });
      const deleteAt = Date.now();
      if (mode === "single") {
        for (const asset of assets) {
          const startedAt = Date.now();
          const response = await request.delete("/api/admin/media-library", { data: { asset: asset.publicUrl, confirmReferenced: false } });
          expect((await response.json()).deleted).toBe(true);
          deleted.add(asset.publicUrl);
          timings.push({ operation: "single", ms: Date.now() - startedAt, count: 1 });
        }
      } else {
        const response = await request.delete("/api/admin/media-library", { data: { assets: assets.map(asset => ({ asset: asset.publicUrl, confirmReferenced: false })) } });
        const { readMediaDeleteResults } = await import("../../src/lib/admin/media-catalog/delete-saga");
        const warnings = await readMediaDeleteResults(new Response(await response.text(), { status: response.status() }), event => {
          expect(event.deleted, event.error).toBe(true); deleted.add(event.asset);
        });
        expect(warnings).toEqual([]);
      }
      timings.push({ operation: mode!, ms: Date.now() - deleteAt, count: assets.length });
      expect(deleted.size).toBe(assets.length);
      const after = await (await request.get("/api/admin/media-library")).json();
      expect(after.readiness.safeDeleteReady).toBe(true);
    } finally {
      await testInfo.attach("media-delete-throughput", { body: JSON.stringify({ namespace, mode, assets: assets.map(asset => ({ id: asset.id, publicUrl: asset.publicUrl })), timings }), contentType: "application/json" });
      for (const asset of assets) if (!deleted.has(asset.publicUrl)) {
        const cleanup = await request.delete("/api/admin/media-library", { data: { asset: asset.publicUrl, confirmReferenced: false } });
        expect((await cleanup.json()).deleted).toBe(true);
      }
    }
  });
});
