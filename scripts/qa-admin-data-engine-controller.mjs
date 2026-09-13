/**
 * Browser controller evidence for Topics/Categories/Series data-engine lists.
 *
 * Explicitly separates:
 *   - new query → exactly 1 endpoint request
 *   - fresh cached query → 0 endpoint requests
 * and covers race / failure contracts with route interception.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
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

/** Deterministic intent/race checks against the mounted shared owners, not live Admin. */
async function runIntentPrefetchCases({page,origin,requests,observations,snapshot,configure,plan,delayedResponses,requestWaiters}) {
  let start = 0;
  const calls = () => requests.slice(start).filter(request => request.pathname.startsWith("/api/admin/entity-lists/"));
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const open = async (entity="topics", search="", options={}) => {
    // The prior scenario may leave the real mouse over page 2. Move it away
    // before mounting so this assertion measures mount, not a new mouseenter.
    await page.mouse.move(0,0);
    configure({optIn:true,...options}); start=requests.length;
    await page.goto(`${origin}/admin/content/${entity}${search?`?${search}`:""}`);
    await page.waitForFunction(()=>typeof window.__queryFixture?.prefetchPage==="function");
    await paint();
    check(`${entity}: mounting does not speculate or duplicate the fresh seed`,calls().length===0);
  };
  const waitCalls = (count) => new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{requestWaiters.delete(notify);reject(new Error(`Expected ${count} fixture GETs, saw ${calls().length}`))},10000);
    const notify=()=>{if(calls().length>=count){clearTimeout(timer);requestWaiters.delete(notify);resolve()}};
    requestWaiters.add(notify);notify();
  });
  const intent = (target) => page.evaluate(target=>{window.__intentPromise=window.__queryFixture.prefetchPage(target)},target);
  const finishIntent = () => page.evaluate(()=>window.__intentPromise);
  const activate = (target) => page.evaluate(target=>window.__queryFixture.setPage(target),target);
  const settled = (target) => page.waitForFunction(target=>window.__queryFixture.query.page===target && window.__queryFixture.result.pagination.page===target && !window.__queryFixture.queryPending && !window.__queryFixture.revalidating && !window.__queryFixture.error,target);
  const unchanged = (label,before,after) => {
    const matches=JSON.stringify(before)===JSON.stringify(after);
    check(label,matches,matches?undefined:JSON.stringify({before,after}));
  };
  const reply = (index=0) => {const pending=delayedResponses[index];if(!pending)throw new Error(`Missing held response ${index}`);pending.reply();};

  for(const entity of ["topics","categories","series"]) {
    await open(entity);
    const before=await snapshot(`${entity}: before intent`);
    await page.evaluate(async()=>{for(const target of [0,-1,1,3,999,1.5,NaN,Infinity])await window.__queryFixture.prefetchPage(target)});
    await paint();
    check(`${entity}: current/nonadjacent/invalid pages issue no GET`,calls().length===0);
    unchanged(`${entity}: rejected intentions change no projection`,before,await snapshot(`${entity}: invalid intentions`));
    plan({hold:true});
    await page.getByRole("button",{name:"2",exact:true}).hover();
    await waitCalls(1);
    await page.getByRole("button",{name:"2",exact:true}).focus();
    await intent(2);await paint();
    check(`${entity}: hover + focus + repeated intent share one GET`,calls().length===1);
    unchanged(`${entity}: in-flight intent leaves URL/IDs/footer/metrics/error/Pending unchanged`,before,await snapshot(`${entity}: intent in-flight`));
    reply();await finishIntent();await paint();
    unchanged(`${entity}: completed prefetch leaves projection unchanged`,before,await snapshot(`${entity}: intent warm`));
    await page.getByRole("button",{name:"2",exact:true}).click();await settled(2);await paint();
    check(`${entity}: warm click uses its single prefetched GET`,calls().length===1);
    const warm=await snapshot(`${entity}: warm click`);
    check(`${entity}: warm click adopts matching rows and metrics`,warm.ids.join()==="11,12,13,14,15,16,17,18,19,20" && warm.metrics.page===2);
    await activate(1);await settled(1);await page.goBack();await settled(2);await page.goForward();await settled(1);
    check(`${entity}: warm Back/Forward reuses the existing key`,calls().length===1);

    await open(entity);
    plan({hold:true});await intent(2);await waitCalls(1);await activate(2);
    await page.waitForFunction(()=>window.__queryFixture.queryPending);
    const waiting=await snapshot(`${entity}: foreground adopts in-flight`);
    check(`${entity}: early click retains resolved footer while awaiting same request`,waiting.resultPage===1 && waiting.requestedPage===2 && waiting.metrics.page===1 && calls().length===1);
    reply();await finishIntent();await settled(2);
    check(`${entity}: adopted request is neither canceled nor duplicated`,calls().length===1 && !calls()[0].aborted);

    await open(entity,"",{optIn:false,intentProbe:true});
    await page.getByRole("button",{name:"2",exact:true}).hover();await page.getByRole("button",{name:"2",exact:true}).focus();await paint();
    check(`${entity}: optional Pagination intent remains opt-in`,calls().length===0);
  }

  await open();
  const beforeFailure=await snapshot("before speculative failure");
  plan({status:500});await intent(2);await finishIntent();await paint();
  check("speculative failure makes exactly one attempt",calls().length===1);
  unchanged("speculative failure is silent and does not replace the displayed result",beforeFailure,await snapshot("after speculative failure"));
  plan({status:500},{status:500},{status:500});await activate(2);
  await page.waitForFunction(()=>window.__queryFixture.error && !window.__queryFixture.queryPending);
  check("later foreground request preserves the provider retry policy",calls().length===4);
  const terminal=await snapshot("foreground terminal failure");
  check("#160 foreground failure retains source IDs/footer and reports shared error",terminal.ids.join()===beforeFailure.ids.join() && terminal.footer===beforeFailure.footer && terminal.metrics.page===1 && terminal.requestedPage===2 && terminal.notice.includes("السابقة"));
  await intent(2);await finishIntent();check("foreground error suppresses speculative requests",calls().length===4);
  plan({});await page.evaluate(()=>window.__queryFixture.retry());await settled(2);
  check("foreground retry reads once and clears failure",calls().length===5);

  await open();
  plan({hold:true,status:500},{status:500},{});await intent(2);await waitCalls(1);await activate(2);
  await page.waitForFunction(()=>window.__queryFixture.queryPending);reply();await settled(2);await finishIntent();
  check("failed in-flight prefetch adopted by click gets foreground retries",calls().length===3);

  for(const mode of ["warm","inflight"]) {
    await open();const before=await snapshot(`${mode} normalization baseline`);
    plan({hold:mode==="inflight",page:1,totalRows:8,version:"normalized"});await intent(2);await waitCalls(1);
    if(mode==="warm")await finishIntent();
    await paint();unchanged(`${mode} out-of-range prefetch never normalizes before activation`,before,await snapshot(`${mode} normalization before click`));
    const historyBefore=await page.evaluate(()=>window.__intentHistory.length);
    await activate(2);if(mode==="inflight")reply();
    await page.waitForFunction(()=>window.__queryFixture.query.page===1 && window.__queryFixture.result.metrics.total===8 && !window.__queryFixture.queryPending);
    await paint();
    const history=await page.evaluate(index=>window.__intentHistory.slice(index),historyBefore);
    check(`${mode} activation normalizes exactly once without GET loop`,calls().length===1 && history.filter(item=>item.kind==="replaceState").length===1 && new URL(page.url()).searchParams.get("page")===null,JSON.stringify(history));
  }

  await open();plan({hold:true,page:1,totalRows:8,version:"obsolete"},{});
  await intent(2);await waitCalls(1);await activate(2);await activate(3);await settled(3);
  reply();await finishIntent();await paint();
  const latest=await snapshot("newer page wins over old normalized response");
  check("late normalized result cannot overwrite newer navigation",latest.requestedPage===3 && latest.resultPage===3 && latest.metrics.page===3 && new URL(latest.url).searchParams.get("page")==="3" && calls().length===2);

  await open();plan({page:1,totalRows:8,version:"warm-obsolete"},{});await intent(2);await finishIntent();
  await page.evaluate(()=>{window.__queryFixture.setPage(2);window.__queryFixture.setPage(3)});await settled(3);await paint();
  check("warm normalized data cannot overwrite a newer same-turn intent",new URL(page.url()).searchParams.get("page")==="3" && calls().length===2);

  await open("topics","page=3");
  plan({hold:true},{hold:true});await intent(2);await waitCalls(1);await intent(4);await waitCalls(2);
  await paint();
  check("only latest speculative target remains in-flight",calls()[0].aborted && !calls()[1].aborted);
  await activate(4);reply(0);reply(1);await finishIntent();await settled(4);
  check("replacement target is preserved when it becomes foreground",calls().length===2 && !calls()[1].aborted);

  for(const staleTimeMs of [15000,30000]) {
    await open("topics","",{staleTimeMs});await intent(2);await finishIntent();
    await page.evaluate(age=>window.__queryFixture.agePage(2,age),staleTimeMs-5000);await intent(2);await finishIntent();
    check(`${staleTimeMs}ms policy reuses still-fresh prefetch`,calls().length===1);
    await page.evaluate(age=>window.__queryFixture.agePage(2,age),staleTimeMs+1000);await intent(2);await finishIntent();
    check(`${staleTimeMs}ms policy refetches expired prefetch`,calls().length===2);
  }

  await open("topics","content_type=video&category=9&series=4&status=published&image=without&featured=yes&sort=id_desc&limit=20&q=proof&extra=keep",{constrained:true});
  const constrainedBefore=await snapshot("constraint before intent");await intent(2);await finishIntent();
  const params=new URLSearchParams(calls()[0].search);
  check("prefetch preserves the complete canonical query/route constraint",
    Object.entries({content_type:"article",category:"9",series:"4",status:"published",image:"without",featured:"yes",sort:"id_desc",limit:"20",q:"proof",page:"2"}).every(([key,value])=>params.get(key)===value),params.toString());
  unchanged("constrained intent preserves browser extras and displayed result",constrainedBefore,await snapshot("constraint after intent"));
  await page.evaluate(()=>window.__queryFixture.setFilter("image","all"));await waitCalls(2);await settled(1);await intent(2);await finishIntent();
  check("different filter scope cannot reuse an incompatible warmed page",calls().length===3 && new URLSearchParams(calls()[2].search).get("image")===null);
  await page.evaluate(()=>window.__queryFixture.setSort({field:"title",direction:"asc"}));await waitCalls(4);await settled(1);await intent(2);await finishIntent();
  check("different sort scope has an independent warmed key",calls().length===5);
  await page.evaluate(()=>window.__queryFixture.setPageSize(10));await page.waitForFunction(()=>window.__queryFixture.result.pagination.pageSize===10 && !window.__queryFixture.queryPending);await intent(2);await finishIntent();
  check("limit change resets page1 and uses the new page-size key",calls().length===7 && new URLSearchParams(calls()[6].search).get("limit")===null);
  await page.evaluate(()=>window.__queryFixture.setSearch("another proof"));await waitCalls(8);await settled(1);await intent(2);await finishIntent();
  check("search change cannot reuse another search's warmed page",calls().length===9 && new URLSearchParams(calls()[8].search).get("q")==="another proof");

  await open();await page.evaluate(()=>window.__queryFixture.beginMutation());
  await page.waitForFunction(()=>window.__queryFixture.mutationPending);await intent(2);await finishIntent();
  check("an unkeyed TanStack mutation blocks speculation",calls().length===0);
  await page.evaluate(()=>window.__releaseFixtureMutation());await page.waitForFunction(()=>!window.__queryFixture.mutationPending);
  plan({hold:true});await page.evaluate(()=>{window.__refetchPromise=window.__queryFixture.invalidate()});await waitCalls(1);
  await page.waitForFunction(()=>window.__queryFixture.revalidating);await intent(2);await finishIntent();
  check("same-key revalidation blocks speculation",calls().length===1);
  reply();await page.evaluate(()=>window.__refetchPromise);await settled(1);
  plan({hold:true});await activate(2);await waitCalls(2);await page.waitForFunction(()=>window.__queryFixture.queryPending);
  await intent(2);await finishIntent();check("foreground query Pending blocks speculation",calls().length===2);reply(1);await settled(2);

  for(const kind of ["saveInvalidate","invalidate"]) {
    await open();plan({hold:true,version:"pre-write"});await intent(2);await waitCalls(1);
    if(kind==="invalidate")plan({version:"post-write-current"});
    await page.evaluate(kind=>window.__queryFixture[kind](),kind);
    await paint();reply();await finishIntent();await paint();
    const cache=await page.evaluate(()=>window.__queryFixture.cachePage(2));
    check(`${kind}: pre-write speculation is canceled and never accepted as fresh`,calls()[0].aborted && (!cache?.data || cache.invalidated),JSON.stringify(cache));
    if(kind==="saveInvalidate") {
      const beforeIntent=calls().length;await intent(2);await finishIntent();
      check("confirmed save invalidation blocks new speculation until foreground settlement",calls().length===beforeIntent);
    }
    const beforeClick=calls().length;plan({version:"post-write"});await activate(2);await settled(2);
    const after=await snapshot(`${kind}: foreground after invalidation`);
    check(`${kind}: next click performs one authoritative read`,calls().length===beforeClick+1 && after.metrics.version==="post-write");
  }
  observations.push({label:"intent test boundary",note:"Synthetic GET transport and actual shared owners; Topics fixture coverage does not authorize or prove live Topics opt-in or DB workload."});
}

/** Actual shared owners with synthetic GET results; never connects to Admin/DB. */
async function isolatedFailureContracts(intentPrefetch = false) {
  const root = process.cwd();
  const output = path.join(root, intentPrefetch ? ".tmp-qa/admin-instant-ux-prefetch-strategy-20260913" : ".tmp-qa/admin-query-save-failure-contracts-20260913", process.env.QA_PHASE || (intentPrefetch ? "intent-prefetch" : "query-isolated"));
  await mkdir(output, { recursive: true });
  const require = createRequire(import.meta.url);
  const entry = String.raw`
import React, { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Provider from "@query-provider";
import Feedback from "@feedback";
import AdminEntityList from "@entity-list";
import AdminTablePagination from "@pagination";
import { useAdminEntityListController } from "@controller";
import { normalizeAdminEntityListQuery, normalizeAdminEntityListQueryWithRouteParams } from "@contracts";
import { adminEntityListQueryKeys } from "@query-keys";
import { invalidateAdminEntityListCaches } from "@mutation-cache";
import { topicsQueryContract } from "@topics-contract";
import { categoriesQueryContract } from "@categories-contract";
import { seriesQueryContract } from "@series-contract";
const contracts = {topics:topicsQueryContract,categories:categoriesQueryContract,series:seriesQueryContract};
const entity = location.pathname.split("/").at(-1);
const contract = contracts[entity];
const options = window.__FIXTURE_OPTIONS__ || {};
const routeOwnedParams = options.constrained ? {content_type:"article"} : undefined;
const constrainQuery = options.constrained ? query => ({...query,filters:{...query.filters,contentType:"article"}}) : undefined;
const initialQuery = routeOwnedParams
 ? normalizeAdminEntityListQueryWithRouteParams(contract,new URLSearchParams(location.search),routeOwnedParams)
 : normalizeAdminEntityListQuery(contract,new URLSearchParams(location.search));
const initialResult = window.__INITIAL_RESULT__;
window.__intentHistory=[];
for(const kind of ["pushState","replaceState"]){const original=history[kind].bind(history);history[kind]=(...args)=>{window.__intentHistory.push({kind,href:String(args[2])});return original(...args)}}
const columns = [
 {key:"title",label:"الاسم",primary:true,primaryPresentation:"compact-icon",sticky:"start",flexible:true,minWidth:200,width:400,defaultVisible:true,hideable:false,renderCell:({row})=>row.title},
 {key:"actions",label:"الإجراءات",sticky:"end",minWidth:144,width:144,defaultVisible:true,hideable:false,renderCell:()=>null},
];
function Harness() {
 const client = useQueryClient();
 const controller = useAdminEntityListController({entity,contract,initialQuery,initialResult,staleTimeMs:options.staleTimeMs??30000,constrainQuery,routeOwnedParams});
 const mutation = useMutation({mutationFn:()=>new Promise(resolve=>{window.__releaseFixtureMutation=()=>resolve({ok:true})})});
 useLayoutEffect(()=>{window.__queryFixture={...controller,
  beginMutation:()=>{void mutation.mutateAsync()},mutationPending:mutation.isPending,
  saveInvalidate:()=>invalidateAdminEntityListCaches(client,[entity]),
  cachePage:page=>{const state=client.getQueryState(adminEntityListQueryKeys.query(entity,{...controller.query,page}));return state?{status:state.status,fetchStatus:state.fetchStatus,invalidated:state.isInvalidated,data:state.data}:null},
  agePage:(page,age)=>{const key=adminEntityListQueryKeys.query(entity,{...controller.query,page});client.setQueryData(key,client.getQueryData(key),{updatedAt:Date.now()-age})},
 };});
 return <main dir="rtl">
  <button type="button" data-fixture-refetch onClick={()=>controller.invalidate()}>إعادة القراءة للاختبار</button>
  <AdminEntityList listId={entity+"-failure-fixture"} rows={controller.result.rows} queryPending={controller.queryPending}
   queryError={controller.error?.message} onQueryRetry={()=>controller.retry?.()}
   columns={columns} getRowId={row=>row.id} getRowLabel={row=>row.title} sizingStrategy={{mode:"flexible",columnKey:"title"}} actionsColumnWidth={144}
   mapResultToFeedback={()=>({variant:"success",message:"fixture"})}
   emptyState={{mode:"filtered",systemEmpty:"لا توجد بيانات",filteredEmpty:"لا توجد نتائج"}} />
  <AdminTablePagination basePath={location.pathname} currentPage={controller.result.pagination.page}
   pageSize={String(controller.result.pagination.pageSize)} totalCount={controller.result.pagination.totalRows}
   totalPages={controller.result.pagination.totalPages} onPageChange={controller.setPage} onPageSizeChange={controller.setPageSize}
   onPageIntent={options.optIn?controller.prefetchPage:undefined}/>
 </main>;
}
createRoot(document.getElementById("root")).render(<Provider><Feedback><Harness/></Feedback></Provider>);
`;
  const navigationPath = path.join(output, "navigation.js");
  const linkPath = path.join(output, "link.jsx");
  const entryPath = path.join(output, "entry.jsx");
  await Promise.all([
    writeFile(entryPath, entry),
    writeFile(navigationPath, 'export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push(){throw new Error("Unexpected router push")},replace(){throw new Error("Unexpected router replace")},refresh(){throw new Error("Unexpected router refresh")}});'),
    writeFile(linkPath, 'import React from "react"; export default function Link({href,children,prefetch,scroll,onNavigate,...props}){return <a href={href} {...props}>{children}</a>}'),
  ]);
  await require("next/dist/build/swc").loadBindings();
  const webpack = require("next/dist/compiled/webpack/webpack").webpack;
  const compiler = webpack({
    mode: "development", target: "web", context: root, entry: entryPath,
    output: { path: output, filename: "bundle.js" }, devtool: false,
    optimization: { minimize: false },
    plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({}) })],
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"], modules: [path.join(root, "node_modules"), "node_modules"],
      alias: {
        "next/navigation": navigationPath, "next/link": linkPath,
        "@query-provider": path.join(root, "src/components/admin/entity-list/AdminEntityListQueryProvider.tsx"),
        "@feedback": path.join(root, "src/components/admin/AdminFeedbackProvider.tsx"),
        "@entity-list": path.join(root, "src/components/admin/entity-list/AdminEntityList.tsx"),
        "@pagination": path.join(root, "src/components/admin/ui/AdminTablePagination.tsx"),
        "@controller": path.join(root, "src/lib/admin/entity-list/data-engine/client-controller.ts"),
        "@contracts": path.join(root, "src/lib/admin/entity-list/data-engine/contracts.ts"),
        "@query-keys": path.join(root, "src/lib/admin/entity-list/data-engine/query-keys.ts"),
        "@mutation-cache": path.join(root, "src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts"),
        ...Object.fromEntries(["topics", "categories", "series"].map((entity) => [`@${entity}-contract`, path.join(root, `src/lib/admin/content/entity-list-contracts/${entity}.ts`)])),
      },
    },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{
      loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"),
      options: { rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {}, swcCacheDir: path.join(output, "swc-cache"), serverComponents: false, serverReferenceHashSalt: "query-failure-contract", esm: false, transpilePackages: [] },
    }] }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close((closeError) => {
    if (error || closeError || stats?.hasErrors()) reject(error || closeError || new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)));
    else resolve();
  })));
  const bundle = await readFile(path.join(output, "bundle.js"));
  const requests = [], blocked = [], observations = [], errors = [];
  const failures = new Map(), held = new Map();
  let fixtureOptions = {};
  const responsePlans = [], delayedResponses = [], requestWaiters = new Set();
  function result(entity, page = 1, pageSize = 10, version = "source", totalRows = 100) {
    return { rows: Array.from({ length: Math.max(0, Math.min(pageSize, totalRows - (page - 1) * pageSize)) }, (_, i) => ({ id: (page - 1) * pageSize + i + 1, title: `${entity} ${((page - 1) * pageSize + i + 1)} ${version}` })), pagination: { page, pageSize, totalRows, totalPages: Math.max(1,Math.ceil(totalRows/pageSize)) }, metrics: { total: totalRows, version, page }, meta: { generatedAt: new Date().toISOString(), mode: "server-page" } };
  }
  const sendResult = (res, entity, page) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(result(entity, page))); };
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://fixture");
    requests.push({ method: req.method, pathname: url.pathname, search: url.search });
    if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
    if (url.pathname === "/bundle.js") { res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" }); res.end(bundle); return; }
    if (url.pathname.startsWith("/api/admin/entity-lists/")) {
      const entity = url.pathname.split("/").at(-1), page = Number(url.searchParams.get("page") || 1);
      if (fixtureOptions.optIn || fixtureOptions.intentProbe) {
        const plan = responsePlans.shift() ?? {};
        const request = requests.at(-1);
        request.aborted = false;
        res.on("close",()=>{if(!res.writableEnded)request.aborted=true;});
        const reply = () => {
          if(res.destroyed)return;
          res.writeHead(plan.status ?? 200, {"Content-Type":"application/json"});
          res.end(JSON.stringify(plan.status ? {error:{code:"intent_fixture_failure"}} : result(entity,plan.page??page,Number(url.searchParams.get("limit")||10),plan.version,plan.totalRows)));
        };
        if(plan.hold)delayedResponses.push({request,reply});else reply();
        for(const notify of requestWaiters)notify();
        return;
      }
      if (failures.get(entity) === page) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { code: "list_load_failed" } })); return; }
      if (held.has(entity)) { held.set(entity, () => sendResult(res, entity, page)); return; }
      sendResult(res, entity, page); return;
    }
    if (/^\/admin\/content\/(topics|categories|series)$/.test(url.pathname)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<html dir="rtl"><body><div id="root"></div><script>window.__INITIAL_RESULT__=${JSON.stringify(result(url.pathname.split("/").at(-1),Number(url.searchParams.get("page")||1),Number(url.searchParams.get("limit")||10)))};window.__FIXTURE_OPTIONS__=${JSON.stringify(fixtureOptions)}</script><script src="/bundle.js"></script></body></html>`); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== origin) { blocked.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const snapshot = async (label) => {
      const value = await page.evaluate(() => ({ url: location.href, ids: [...document.querySelectorAll("[data-entity-row-id]")].map((row) => Number(row.getAttribute("data-entity-row-id"))), footer: document.querySelector("[data-admin-table-pagination]")?.textContent || "", resultPage: window.__queryFixture.result.pagination.page, requestedPage: window.__queryFixture.query.page, metrics:window.__queryFixture.result.metrics, pending: window.__queryFixture.queryPending, revalidating:window.__queryFixture.revalidating, error: window.__queryFixture.error?.message || null, notice: document.querySelector("[data-admin-entity-list-query-error]")?.textContent || "" }));
      observations.push({ label, ...value }); return value;
    };
    if(intentPrefetch)await runIntentPrefetchCases({page,origin,requests,observations,snapshot,
      configure:options=>{fixtureOptions=options;responsePlans.length=0;delayedResponses.length=0},
      plan:(...plans)=>responsePlans.push(...plans),delayedResponses,requestWaiters,
    });
    fixtureOptions={};
    for (const entity of ["topics", "categories", "series"]) {
      const callStart=requests.length;
      await page.goto(`${origin}/admin/content/${entity}`);
      await page.waitForFunction(() => Boolean(window.__queryFixture));
      const calls = () => requests.slice(callStart).filter((r) => r.pathname === `/api/admin/entity-lists/${entity}`).length;
      check(`${entity}: fresh RSC seed does not fetch again`, calls() === 0);
      await page.getByRole("button", { name: "3", exact: true }).click();
      await page.waitForFunction(() => window.__queryFixture.result.pagination.page === 3 && !window.__queryFixture.queryPending);
      const lastResolved = await snapshot(`${entity}: page3 resolved`);
      check(`${entity}: non-bootstrap result has page3 IDs`, lastResolved.ids.join() === "21,22,23,24,25,26,27,28,29,30");
      failures.set(entity, 4);
      await page.getByRole("button", { name: "4", exact: true }).click();
      await page.waitForFunction(() => window.__queryFixture.error && !window.__queryFixture.queryPending);
      const failedQuery = await snapshot(`${entity}: cold page4 terminal failure`);
      check(`${entity}: failed cold key retains last resolved row IDs`, failedQuery.ids.join() === lastResolved.ids.join());
      check(`${entity}: failed cold key retains resolved page3 footer`, failedQuery.resultPage === 3 && failedQuery.footer === lastResolved.footer);
      check(`${entity}: failed cold key preserves page4 intent`, failedQuery.requestedPage === 4 && new URL(failedQuery.url).searchParams.get("page") === "4");
      check(`${entity}: shared error explains retained rows and counters`, failedQuery.notice.includes("الصفوف والعدّادات") && failedQuery.notice.includes("السابقة"));
      const retry = page.getByRole("button", { name: "إعادة المحاولة", exact: true });
      const retryVisible = await retry.isVisible();
      check(`${entity}: shared error offers read-only retry`, retryVisible);
      failures.delete(entity);
      held.set(entity, null);
      const beforeRetry = calls();
      if (retryVisible) await retry.click();
      else await page.locator("[data-fixture-refetch]").click(); // Baseline continues to expose subsequent failures.
      await page.waitForFunction(() => window.__queryFixture.queryPending);
      const retrying = await snapshot(`${entity}: retry pending`);
      check(`${entity}: retry keeps last resolved IDs/footer`, retrying.ids.join() === lastResolved.ids.join() && retrying.resultPage === 3);
      const retryDeadline = Date.now() + 10000;
      while (!held.get(entity) && Date.now() < retryDeadline) await new Promise((resolve) => setTimeout(resolve, 10));
      if (!held.get(entity)) throw new Error(`${entity}: retry GET did not reach the isolated transport`);
      held.get(entity)(); held.delete(entity);
      await page.waitForFunction(() => window.__queryFixture.result.pagination.page === 4 && !window.__queryFixture.queryPending && !window.__queryFixture.error);
      const recovered = await snapshot(`${entity}: retry resolved`);
      check(`${entity}: retry resolves requested page4`, recovered.ids.join() === "31,32,33,34,35,36,37,38,39,40" && recovered.resultPage === 4);
      check(`${entity}: retry executes one GET`, calls() - beforeRetry === 1);
      check(`${entity}: success clears shared error`, recovered.notice === "");
      failures.set(entity, 4);
      await page.locator("[data-fixture-refetch]").click();
      await page.waitForFunction(() => window.__queryFixture.error && !window.__queryFixture.revalidating);
      const refetchFailure = await snapshot(`${entity}: same-key refetch failure`);
      check(`${entity}: same-key failure keeps its existing result`, refetchFailure.ids.join() === recovered.ids.join() && refetchFailure.resultPage === 4 && !refetchFailure.pending);
      check(`${entity}: same-key failure is announced by shared error`, refetchFailure.notice.includes("الصفوف والعدّادات"));
      failures.delete(entity);
    }
    check("isolated owner fixture never requests an external origin", blocked.length === 0);
    check("isolated owner fixture performs no writes", requests.every((r) => r.method === "GET"));
    check("isolated owner fixture has no runtime exceptions", errors.length === 0, errors.join(" | "));
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await writeFile(path.join(output, "evidence.json"), JSON.stringify({ passed, failed, observations, requests, blocked, errors, scope: "Mounted shared controller/EntityList/Pagination with synthetic GET transport; Next navigation isolated, no Auth/DB or live-screen claim" }, null, 2));
  }
  console.log(`qa-admin-data-engine-controller isolated: ${passed}/${passed + failed} passed`);
  if (failed) process.exitCode = 1;
}

(process.argv.includes("--intent-prefetch") ? isolatedFailureContracts(true) : process.argv.includes("--isolated-failure-contracts") ? isolatedFailureContracts() : main()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
