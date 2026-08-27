import { expect, test } from "playwright/test";

test.describe("public and unauthenticated browser foundation", () => {
  test("rejects unauthenticated Admin page and API access", async ({ page }) => {
    await page.goto("/admin/content/topics");

    const destination = new URL(page.url());
    expect(destination.pathname).toBe("/admin/login");
    expect(destination.searchParams.get("next")).toBe("/admin/content/topics");

    const response = await page.request.get("/api/admin/entity-lists/topics", {
      maxRedirects: 0,
    });
    const status = response.status();
    expect([401, 503]).toContain(status);
    expect(await response.json()).toEqual(
      status === 401
        ? { error: "Unauthorized" }
        : { error: "Admin auth is not configured." },
    );
  });

  test("login validation, pending state, RTL and keyboard focus are observable", async ({ page }) => {
    await page.route("**/api/admin/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_credentials" }),
      });
    });

    await page.goto("/admin/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const username = page.locator('input[name="username"]');
    const password = page.locator('input[name="password"]');
    const remember = page.locator('input[name="rememberMe"]');
    const submit = page.locator('button[type="submit"]');

    await page.keyboard.press("Tab");
    await expect(username).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(remember).toBeFocused();

    await submit.click();
    await expect(username).toBeFocused();

    await username.fill("browser-foundation-user");
    await password.fill("not-a-real-password");
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test("public Topics pages expose one logical H1 and ordered article headings", async ({ page }) => {
    test.setTimeout(60_000);
    await page.route("**/api/content/topics/*/view", async (route) => {
      await route.fulfill({ status: 204 });
    });

    const listingResponse = await page.goto("/topics", { waitUntil: "domcontentloaded" });
    expect(listingResponse?.ok()).toBeTruthy();
    await expect(page.locator("h1")).toHaveCount(1);

    const firstTopicHref = await page
      .locator('a[href^="/topics/"]')
      .first()
      .getAttribute("href");
    test.skip(!firstTopicHref, "No published Topic is available for read-only detail coverage.");

    const detailResponse = await page.goto(firstTopicHref!, { waitUntil: "domcontentloaded" });
    expect(detailResponse?.ok()).toBeTruthy();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("article .article-rich-text h1")).toHaveCount(0);
    expect(await page.locator("article .article-rich-text h2, article .article-rich-text h3, article .article-rich-text h4").count()).toBeGreaterThan(0);
  });

  test("shared public search owns an unclipped floating listbox in Topics and Media Center", async ({ page }) => {
    test.setTimeout(90_000);

    async function verifyConsumer(basePath: string) {
      const query = basePath === "/topics" ? "\u0645\u0644\u0643\u064a\u0629" : "\u0627";
      let input = page.locator('input[role="combobox"]');
      let listbox = page.locator('[data-public-content-search-listbox]');
      await page.goto(`${basePath}?q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded" });
      input = page.locator('input[role="combobox"]');
      await expect(input).toBeVisible();
      const documentHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
      await input.focus();
      listbox = page.locator('[data-public-content-search-listbox]');

      await expect
        .poll(
          async () => {
            await input.press("ArrowDown");
            return listbox.count();
          },
          { timeout: 15_000 },
        )
        .toBe(1);
      await expect(listbox).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(documentHeightBefore);
      const floatingTruth = await listbox.evaluate((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const sampleYs = [rect.top + 8, rect.top + rect.height / 2, rect.bottom - 8]
          .filter((value) => value >= 0 && value <= window.innerHeight - 1);
        return {
          parentIsBody: element.parentElement === document.body,
          position: getComputedStyle(element).position,
          insideViewport:
            rect.left >= 0 &&
            rect.right <= window.innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight,
          ownsHitTargets: sampleYs.every((y) => {
            const target = document.elementFromPoint(rect.left + rect.width / 2, y);
            return Boolean(target && element.contains(target));
          }),
        };
      });
      expect(floatingTruth).toEqual({
        parentIsBody: true,
        position: "fixed",
        insideViewport: true,
        ownsHitTargets: true,
      });

      const activeDescendant = await input.getAttribute("aria-activedescendant");
      expect(activeDescendant).toBeTruthy();
      const activeOption = page.locator('[role="option"][aria-selected="true"]');
      await expect(activeOption).toHaveAttribute("id", activeDescendant!);

      await input.press("Escape");
      await expect(listbox).toHaveCount(0);
      await expect(input).toBeFocused();

      await input.press("ArrowDown");
      await expect(page.locator('[data-public-content-search-listbox]')).toBeVisible();
      await page.locator("h1").click();
      await expect(page.locator('[data-public-content-search-listbox]')).toHaveCount(0);

      await input.focus();
      await expect(page.locator('[data-public-content-search-listbox]')).toBeVisible();
      const firstOption = page.locator('[data-public-content-search-listbox] [role="option"]').first();
      const targetHref = await firstOption.evaluate((option) =>
        (option as HTMLButtonElement).textContent?.trim() ?? "",
      );
      expect(targetHref).toBeTruthy();
      const sourceUrl = page.url();
      await firstOption.click();
      await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(sourceUrl);
    }

    await verifyConsumer("/topics");
    await verifyConsumer("/media-center/news");
  });

  test("public mobile rendering remains RTL and free of document overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/topics", { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBeFalsy();
  });

  test("sitemap route returns unique canonical URLs", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/xml");

    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://www.venesia-developments.net"))).toBeTruthy();
  });
});
