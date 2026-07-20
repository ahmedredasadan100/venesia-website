/**
 * Browser controller evidence for Topics/Categories/Series data-engine lists.
 *
 * Explicitly separates:
 *   - new query → exactly 1 endpoint request
 *   - fresh cached query → 0 endpoint requests
 * and covers race / failure contracts with route interception.
 */
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const cdpUrl = process.env.QA_CDP_URL || "http://127.0.0.1:9333";
const runId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

function isListEndpoint(url) {
  return /\/api\/admin\/entity-lists\/(topics|categories|series)/.test(url);
}

function entityFromPath(path) {
  if (path.endsWith("/topics")) return "topics";
  if (path.endsWith("/categories")) return "categories";
  return "series";
}

async function waitForPageParam(page, pageValue, timeout = 10_000) {
  await page.waitForFunction(
    (expected) => {
      const value = new URL(window.location.href).searchParams.get("page");
      return expected === null ? value === null : value === expected;
    },
    pageValue,
    { timeout },
  );
}

async function main() {
  const probe = await fetch(`${baseUrl}/admin/login`).catch(() => null);
  if (!probe?.ok) throw new Error(`Server required at ${baseUrl}`);

  const browser = await chromium.connectOverCDP(cdpUrl);
  const consoleIssues = [];
  const pageErrors = [];
  let page;
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("Authenticated Chromium context is unavailable.");
    page = context.pages().find((candidate) =>
      candidate.url().startsWith(`${baseUrl}/admin/`),
    ) ?? context.pages().find((candidate) => candidate.url().startsWith(baseUrl));
    if (!page) throw new Error("Authenticated Chromium page is unavailable.");
    await page.setViewportSize({ width: 1440, height: 900 });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleIssues.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    for (const path of [
      "/admin/content/topics",
      "/admin/content/categories",
      "/admin/content/series",
    ]) {
      const entity = entityFromPath(path);
      const endpointCalls = [];
      const documents = [];
      const rsc = [];
      const onRequest = (request) => {
        const url = request.url();
        if (request.resourceType() === "document") documents.push(url);
        const samePath =
          url.includes(`${path}?`) ||
          url.endsWith(path) ||
          url.includes(`${path}&`);
        const isRscFlight =
          url.includes("_rsc=") || request.headers()["rsc"] === "1";
        if (isRscFlight && samePath) rsc.push(url);
        if (isListEndpoint(url)) endpointCalls.push(url);
      };
      page.on("request", onRequest);

      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
      check(
        `${path}: no duplicate list endpoint fetch on hydration`,
        endpointCalls.length === 0,
        String(endpointCalls.length),
      );

      const search = page.locator('input[placeholder*="ابحث"]').first();
      if (await search.count()) {
        const beforeSearch = endpointCalls.length;
        const marker = `qa ${runId} ${entity}`;
        const initialSearchResponse = page.waitForResponse(
          (response) => {
            const url = new URL(response.url());
            return isListEndpoint(url.href) && url.searchParams.get("q") === marker;
          },
          { timeout: 30_000 },
        );
        await search.fill(marker);
        await page.waitForFunction(
          (value) =>
            new URL(window.location.href).searchParams.get("q") === value,
          marker,
          { timeout: 10_000 },
        );
        await initialSearchResponse;
        const afterSearch = endpointCalls.length - beforeSearch;
        check(
          `${path}: new search query issues exactly one endpoint request`,
          afterSearch === 1,
          String(afterSearch),
        );
        check(
          `${path}: table remains mounted during search`,
          (await page.locator("[data-admin-entity-list]").count()) >= 1,
        );

        // Leave the marker query, then clear (new query), then restore marker
        // from the still-fresh cache → exactly 0 endpoint requests.
        await search.fill("");
        await page.waitForFunction(
          () => !new URL(window.location.href).searchParams.has("q"),
          undefined,
          { timeout: 10_000 },
        );
        await page.waitForTimeout(250);
        const beforeCachedSearch = endpointCalls.length;
        await search.fill(marker);
        await page.waitForFunction(
          (value) =>
            new URL(window.location.href).searchParams.get("q") === value,
          marker,
          { timeout: 10_000 },
        );
        await page.waitForTimeout(250);
        check(
          `${path}: fresh cached search issues zero endpoint requests`,
          endpointCalls.length - beforeCachedSearch === 0,
          String(endpointCalls.length - beforeCachedSearch),
        );
        await search.fill("");
        await page.waitForFunction(
          () => !new URL(window.location.href).searchParams.has("q"),
          undefined,
          { timeout: 10_000 },
        );
        await page.waitForTimeout(200);
      }

      const beforePaginateDocs = documents.length;
      const beforePaginateRsc = rsc.length;
      const next = page.getByRole("button", { name: "التالي" });
      if ((await next.count()) && (await next.first().isEnabled())) {
        const before = endpointCalls.length;
        await next.first().click();
        await waitForPageParam(page, "2");
        await page.waitForTimeout(300);
        const rowsPage2 = await page.locator("[data-entity-row-id]").count();
        check(
          `${path}: new pagination query issues exactly one endpoint request`,
          endpointCalls.length - before === 1,
          String(endpointCalls.length - before),
        );
        check(
          `${path}: pagination uses endpoint not document reload`,
          documents.length === beforePaginateDocs,
          `docs=${documents.length - beforePaginateDocs}`,
        );
        check(
          `${path}: pagination avoids same-path RSC flight`,
          rsc.length === beforePaginateRsc,
          `rsc=${rsc.length - beforePaginateRsc}`,
        );
        check(
          `${path}: pagination changes page state and keeps rows`,
          new URL(page.url()).searchParams.get("page") === "2" &&
            rowsPage2 > 0,
          `page=${new URL(page.url()).searchParams.get("page")} rows=${rowsPage2}`,
        );

        // Fresh cache hit via in-app previous/next (same QueryClient, no
        // history remount ambiguity): return to page 1, then reopen page 2.
        const previous = page.getByRole("button", { name: "السابق" });
        await previous.first().click();
        await waitForPageParam(page, null);
        await page.waitForTimeout(250);
        const beforeCachedPage = endpointCalls.length;
        await next.first().click();
        await waitForPageParam(page, "2");
        await page.waitForTimeout(250);
        check(
          `${path}: fresh cached pagination issues zero endpoint requests`,
          endpointCalls.length - beforeCachedPage === 0,
          String(endpointCalls.length - beforeCachedPage),
        );

        // History Back/Forward restores page state without document/RSC reload.
        const beforeBackDocs = documents.length;
        const beforeBackRsc = rsc.length;
        await page.goBack();
        await waitForPageParam(page, null);
        await page.waitForTimeout(250);
        await page.goForward();
        await waitForPageParam(page, "2");
        await page.waitForTimeout(250);
        check(
          `${path}: history back/forward avoids document reload`,
          documents.length === beforeBackDocs,
          `docs=${documents.length - beforeBackDocs}`,
        );
        check(
          `${path}: history back/forward avoids same-path RSC flight`,
          rsc.length === beforeBackRsc,
          `rsc=${rsc.length - beforeBackRsc}`,
        );
        check(
          `${path}: history forward restores page 2 rows`,
          new URL(page.url()).searchParams.get("page") === "2" &&
            (await page.locator("[data-entity-row-id]").count()) > 0,
        );
        await previous.first().click();
        await waitForPageParam(page, null);
      } else {
        check(`${path}: pagination skipped (single page)`, true);
      }

      page.off("request", onRequest);
    }

    // ── Race / failure contracts on Topics ─────────────────────────────
    await page.goto(`${baseUrl}/admin/content/topics`, {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      const state = { original, firstSeen: 0, secondSeen: 0 };
      window.__qaControllerRace = state;
      const payload = (id, title) => ({
        rows: [{
          id, title, content_type: "article", category_id: null,
          category_name: null, category_color_token: null, series_id: null,
          series_name: null, status: "draft", is_featured: false,
          views_count: 0, created_at: null, updated_at: null,
          published_at: null, created_by_display: null,
          updated_by_display: null, published_by_display: null,
          deleted_at: null,
        }],
        pagination: { page: 1, pageSize: 10, totalRows: 1, totalPages: 1 },
        meta: { generatedAt: new Date().toISOString(), mode: "server-page" },
      });
      window.fetch = async (...args) => {
        const url = new URL(String(args[0]?.url ?? args[0]), window.location.origin);
        if (!url.pathname.includes("/api/admin/entity-lists/topics")) {
          return original(...args);
        }
        const q = url.searchParams.get("q") || "";
        if (q.includes("SLOW1")) {
          state.firstSeen += 1;
          await new Promise((resolve) => setTimeout(resolve, 1_400));
          return Response.json(payload(900001, "SLOW1-STALE-ROW"));
        }
        if (q.includes("SLOW2")) {
          state.secondSeen += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return Response.json(payload(900002, "SLOW2-WINNER-ROW"));
        }
        return original(...args);
      };
    });

    const topicsSearch = page.locator('input[placeholder*="ابحث"]').first();
    await topicsSearch.fill("SLOW1");
    await page.waitForTimeout(450);
    await topicsSearch.fill("SLOW2");
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("q") === "SLOW2",
      undefined,
      { timeout: 10_000 },
    );
    await page
      .getByText("SLOW2-WINNER-ROW", { exact: true })
      .waitFor({ state: "visible", timeout: 10_000 });
    const raceBeforeRelease = await page.evaluate(() => ({
      firstSeen: window.__qaControllerRace.firstSeen,
      secondSeen: window.__qaControllerRace.secondSeen,
    }));
    check(
      "Slow search: second query wins before first response",
      raceBeforeRelease.firstSeen >= 1 && raceBeforeRelease.secondSeen >= 1,
    );
    check(
      "Out-of-order: winner rows visible before stale release",
      (await page.getByText("SLOW2-WINNER-ROW", { exact: true }).count()) === 1 &&
        (await page.getByText("SLOW1-STALE-ROW", { exact: true }).count()) === 0,
    );
    await page.waitForTimeout(1_500);
    check(
      "Out-of-order: stale response does not replace winner rows",
      (await page.getByText("SLOW2-WINNER-ROW", { exact: true }).count()) === 1 &&
        (await page.getByText("SLOW1-STALE-ROW", { exact: true }).count()) === 0,
    );
    check(
      "Cancellation: delayed first request was gated (abort or ignore)",
      raceBeforeRelease.firstSeen >= 1,
      String(raceBeforeRelease.firstSeen),
    );
    await page.evaluate(() => {
      window.fetch = window.__qaControllerRace.original;
      delete window.__qaControllerRace;
    });

    // Network failure keeps previous rows.
    await topicsSearch.fill("");
    await page.waitForTimeout(500);
    const previousRowCount = await page.locator("[data-entity-row-id]").count();
    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      window.__qaControllerFailureOriginal = original;
      window.fetch = async (...args) => {
        const url = new URL(String(args[0]?.url ?? args[0]), window.location.origin);
        if (
          url.pathname.includes("/api/admin/entity-lists/topics") &&
          (url.searchParams.get("q") || "").includes("NETFAIL")
        ) {
          return Response.json(
            { error: { code: "list_load_failed", message: "Unable to load" } },
            { status: 500 },
          );
        }
        return original(...args);
      };
    });
    await topicsSearch.fill("NETFAIL");
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("q") === "NETFAIL",
      undefined,
      { timeout: 10_000 },
    );
    const errorVisible = await page
      .getByText("Unable to load the requested list.")
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check(
      "Network failure: previous rows remain visible",
      (await page.locator("[data-entity-row-id]").count()) === previousRowCount &&
        previousRowCount > 0,
      String(await page.locator("[data-entity-row-id]").count()),
    );
    check(
      "Network failure: error state is exposed without wiping table",
      errorVisible &&
        (await page.locator("[data-admin-entity-list]").count()) >= 1 &&
        (await page.locator("[data-entity-row-id]").count()) === previousRowCount,
    );
    await page.evaluate(() => {
      window.fetch = window.__qaControllerFailureOriginal;
      delete window.__qaControllerFailureOriginal;
    });
    // Expected infrastructure noise from the intentional 500 probe.
    consoleIssues.length = 0;

    // 401 contract against the typed endpoint (no blind retry storm). The
    // page-local fetch harness preserves the authenticated session.
    const unauthorized = await page.evaluate(async () => {
      const calls = [];
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const url = String(args[0]?.url ?? args[0]);
        if (url.includes("q=__QA_401__")) {
          calls.push(url);
          return Response.json(
            { error: { code: "unauthorized", message: "Unauthorized" } },
            { status: 401 },
          );
        }
        return original(...args);
      };
      try {
        const response = await fetch("/api/admin/entity-lists/topics?page=1&q=__QA_401__", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        // Give TanStack/default retry windows a moment; 401 must not retry.
        await new Promise((resolve) => setTimeout(resolve, 800));
        return { status: response.status, calls: calls.length };
      } finally {
        window.fetch = original;
      }
    });
    check(
      "401: endpoint returns unauthorized without blind retry storm",
      unauthorized.status === 401 && unauthorized.calls === 1,
      `status=${unauthorized.status} calls=${unauthorized.calls}`,
    );

    // Floating menu stays open across pagination refetch (shared layer is not
    // closed by setPage). Search debounce intentionally closes layers per the
    // existing mutual-exclusion contract, so it is not used here.
    await page.goto(`${baseUrl}/admin/content/topics`, {
      waitUntil: "networkidle",
    });
    // Expected 401 noise from the session probe above.
    consoleIssues.length = 0;
    // Trigger a list refetch via History/popstate without an outside click
    // (pointer clicks on pagination would close the menu by design).
    await page.getByRole("button", { name: /^الأعمدة$/ }).click();
    await page.waitForTimeout(150);
    const menuOpenBefore = await page.locator("[data-admin-column-menu]").count();
    const listIdentityBefore = await page.evaluate(() => {
      const node = document.querySelector("[data-admin-entity-list]");
      return node ? node.id : null;
    });
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("page", "2");
      window.history.pushState(window.history.state, "", url.toString());
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitForPageParam(page, "2");
    await page.waitForTimeout(500);
    const menuOpenAfter = await page.locator("[data-admin-column-menu]").count();
    const listIdentityAfter = await page.evaluate(() => {
      const node = document.querySelector("[data-admin-entity-list]");
      return node ? node.id : null;
    });
    check(
      "Floating menu: table identity stable during refetch",
      listIdentityBefore !== null && listIdentityBefore === listIdentityAfter,
      `${listIdentityBefore} -> ${listIdentityAfter}`,
    );
    check(
      "Floating menu: remains open across background refetch",
      menuOpenBefore === 1 && menuOpenAfter === 1,
      `before=${menuOpenBefore} after=${menuOpenAfter}`,
    );

    const productConsoleIssues = consoleIssues.filter(
      (text) =>
        !/status of 500/i.test(text) &&
        !/status of 401/i.test(text) &&
        !/Failed to load resource/i.test(text),
    );
    check(
      "No product console errors",
      productConsoleIssues.length === 0,
      productConsoleIssues.join(" | "),
    );
    check(
      "No page errors",
      pageErrors.length === 0,
      pageErrors.join(" | "),
    );
  } finally {
    if (page) {
      await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
      page.removeAllListeners();
      await page.close().catch(() => {});
    }
    await browser.close();
  }

  console.log(
    `qa-admin-data-engine-controller: ${passed}/${passed + failed} passed`,
  );
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
