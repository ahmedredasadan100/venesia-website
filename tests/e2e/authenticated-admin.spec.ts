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
