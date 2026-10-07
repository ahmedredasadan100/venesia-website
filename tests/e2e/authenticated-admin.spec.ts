import { expect, test } from "playwright/test";
import type { MediaCatalogAsset } from "../../src/lib/admin/media-catalog/types";

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
    test.setTimeout(300_000);
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
    async function removeAsset(asset: typeof owned[number]) {
      await library(asset);
      const button = page.getByRole("button", { name: /^حذف آمن \(/u });
      await expect(button).toBeEnabled();
      await button.click();
      const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/admin/media-library" && r.request().method() === "DELETE");
      await page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true }).locator("[data-admin-confirm-submit]").click();
      expect((await response).ok()).toBe(true);
      receipts.push({ operation: "safe_delete", assetId: asset.id });
    }
    // Readiness is a prerequisite, never silently repaired by this smoke test.
    const anonymous = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
    try {
      expect((await anonymous.post("/api/admin/media-library", { data: { operation: "prepare_upload" } })).status()).toBe(401);
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
      // The normal confirmation reaches the authoritative server guard.
      await page.getByRole("button", { name: /^حذف آمن \(/u }).click();
      const refused = page.waitForResponse(r => new URL(r.url()).pathname === "/api/admin/media-library" && r.request().method() === "DELETE");
      const deleteDialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true });
      await deleteDialog.locator("[data-admin-confirm-submit]").click();
      const refusal = await refused;
      expect(refusal.status()).toBe(409);
      expect((await refusal.json()).code).toMatch(/in_use/u);
      await deleteDialog.getByRole("button", { name: "إلغاء", exact: true }).click();
      receipts.push({ operation: "in_use_delete_blocked", assetId: original.id });
      const replacement = await upload(page.locator('main section').filter({ has: page.getByRole("heading", { name: "البيانات الوصفية", exact: true }) }).locator('input[type="file"]'), `${namespace}-replacement.png`);
      const replaced = page.waitForResponse(r => new URL(r.url()).pathname === "/api/admin/media-library" && r.request().method() === "PATCH" && r.request().postDataJSON()?.operation === "replace_all");
      await page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true }).locator("[data-admin-confirm-submit]").click();
      expect((await replaced).ok()).toBe(true);
      await page.goto(topicPath);
      await expect(imageField().locator('input[name="image"]')).toHaveValue(replacement.publicUrl);
      expect((await usage(original)).count).toBe(0);
      expect((await usage(replacement)).hits.some((hit: { editHref: string }) => hit.editHref === topicPath)).toBe(true);
      receipts.push({ operation: "picker_usage_replace", topicPath, originalId: original.id, replacementId: replacement.id });
      await removeAsset(original);
      await page.goto(topicPath);
      await imageField().getByRole("button", { name: "إزالة", exact: true }).click();
      await save();
      await page.reload();
      await expect(imageField().locator('input[name="image"]')).toHaveValue("");
      expect((await usage(replacement)).count).toBe(0);
      await removeAsset(replacement);
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
      await page.getByRole("dialog").locator("[data-admin-confirm-submit]").click();
      await expect(row).toHaveCount(0);
    }
  });
});
