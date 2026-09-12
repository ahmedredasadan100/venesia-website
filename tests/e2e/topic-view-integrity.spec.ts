import { expect, test } from "playwright/test";

// A registered service worker can bypass Playwright route interception.
// Keep these transport fixtures deterministic without changing app behavior.
test.use({ serviceWorkers: "block" });

// Public pages are read-only. Interception below proves the real mounted
// tracker protocol; real API/RPC/trigger semantics have separate isolated SQL
// proof in verify:metrics-publishing-integrity, including native contention.
for (const outcome of ["cookie", "cookies-blocked", "rate_limited", "unavailable", "localhost"] as const) {
  test(`topic view tracker preserves page reading: ${outcome}`, async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const requests: string[] = [];
    if (outcome !== "localhost") {
      await page.route("**/api/content/topics/*/view", async route => {
        const headers = await route.request().allHeaders();
        requests.push(headers.cookie ?? "");
        const needsCookie = outcome === "cookie" && requests.length === 1;
        const result = needsCookie || outcome === "cookies-blocked" ? "identity_required"
          : outcome === "cookie" ? "counted" : outcome;
        await route.fulfill({
          status: result === "identity_required" ? 202 : result === "rate_limited" ? 429 : result === "unavailable" ? 503 : 200,
          contentType: "application/json", body: JSON.stringify({ outcome: result }),
          headers: needsCookie ? { "Set-Cookie": "__Host-venesia_view_visitor=browser-fixture; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax" }
            : result === "rate_limited" ? { "Retry-After": "60" } : {},
        });
      });
    }
    await page.goto("/topics", { waitUntil: "domcontentloaded" });
    const link = page.locator('a[href^="/topics/"]').first();
    await expect(link).toBeVisible();
    const detail = await link.getAttribute("href");
    expect(detail).toBeTruthy();
    const recorded = page.waitForResponse(response => /\/api\/content\/topics\/\d+\/view$/.test(response.url()));
    await page.goto(detail!, { waitUntil: "domcontentloaded" });
    const response = await recorded;
    await expect(page.locator("h1")).toHaveCount(1);
    if (outcome === "localhost") {
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ outcome: "excluded" });
      expect(response.headers()["set-cookie"]).toBeUndefined();
    } else {
      const expected = outcome === "cookie" || outcome === "cookies-blocked" ? 2 : 1;
      await expect.poll(() => requests.length).toBe(expected);
      await page.waitForLoadState("networkidle");
      expect(requests).toHaveLength(expected);
      if (outcome === "cookie") {
        expect(requests[1]).toContain("__Host-venesia_view_visitor=browser-fixture");
        expect(await page.evaluate(() => document.cookie)).not.toContain("venesia_view_visitor");
        await page.reload({ waitUntil: "networkidle" });
        expect(requests).toHaveLength(3); // no browser history suppresses later server decisions
      }
      if (outcome === "cookies-blocked") expect(requests.every(value => !value.includes("venesia_view_visitor"))).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
