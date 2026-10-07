import { expect, test } from "playwright/test";

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
