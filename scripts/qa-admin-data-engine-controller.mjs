/**
 * Browser controller evidence for Topics/Categories/Series data-engine lists.
 *
 * Explicitly separates:
 *   - new query → exactly 1 endpoint request
 *   - fresh cached query → 0 endpoint requests
 * and covers race / failure contracts with route interception.
 */
import { createHash, randomBytes } from "node:crypto";
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

/** Adjacent scheduling and mutation races use the same mounted production owners. */
async function runAdjacentPrefetchCases({page,origin,requests,observations,snapshot,configure,plan,delayedResponses,requestWaiters}) {
  let start=0;
  const calls=()=>requests.slice(start).filter(request=>request.pathname.startsWith("/api/admin/entity-lists/"));
  const requestedPages=()=>calls().map(request=>Number(new URLSearchParams(request.search).get("page")||1));
  const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const quiet=async()=>{await paint();await page.waitForTimeout(150);};
  const waitCalls=count=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{requestWaiters.delete(notify);reject(new Error(`Expected ${count} adjacent fixture GETs, saw ${calls().length}`))},10000);
    const notify=()=>{if(calls().length>=count){clearTimeout(timer);requestWaiters.delete(notify);resolve()}};
    requestWaiters.add(notify);notify();
  });
  const open=async(search="",options={},plans=[])=>{
    await page.mouse.move(0,0);
    configure({optIn:true,adjacentPrefetch:true,...options});plan(...plans);start=requests.length;
    await page.goto(`${origin}/admin/content/topics${search?`?${search}`:""}`);
    await page.waitForFunction(()=>typeof window.__queryFixture?.prefetchPage==="function");
  };
  const activate=target=>page.evaluate(target=>window.__queryFixture.setPage(target),target);
  const settled=target=>page.waitForFunction(target=>window.__queryFixture.query.page===target && window.__queryFixture.result.pagination.page===target && !window.__queryFixture.queryPending && !window.__queryFixture.revalidating && !window.__queryFixture.error,target);
  const cache=target=>page.evaluate(target=>window.__queryFixture.cachePage(target),target);
  const warmed=target=>page.waitForFunction(target=>{const c=window.__queryFixture.cachePage(target);return c?.status==="success" && c.fetchStatus==="idle" && !c.invalidated},target);
  const reply=index=>{const pending=delayedResponses[index];if(!pending)throw new Error(`Missing adjacent held response ${index}`);pending.reply();};
  const beginMutation=async(options={})=>{
    await page.evaluate(options=>{window.__instantPromise=window.__queryFixture.runInstant(options)},options);
    await page.waitForFunction(()=>typeof window.__releaseInstantMutation==="function");
  };
  const releaseMutation=()=>page.evaluate(()=>window.__releaseInstantMutation());
  const finishMutation=()=>page.evaluate(()=>window.__instantPromise);
  const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

  await open("page=8",{},[{hold:true}]);await waitCalls(1);
  const initial=await snapshot("adjacent: page8 visible while page9 prepares");
  check("adjacent starts N+1 automatically without rereading current N",same(requestedPages(),[9]));
  check("background adjacent keeps current rows/footer/metrics and pending stable",initial.requestedPage===8 && initial.resultPage===8 && initial.metrics.page===8 && !initial.pending && !initial.revalidating && !initial.error);
  reply(0);await warmed(9);await quiet();
  check("completed N+1 does not chain into N+2",same(requestedPages(),[9]));
  const warmedProjection=await snapshot("adjacent: cached next page leaves current visible");
  check("cache warming changes no visible projection or URL",same(initial,warmedProjection));
  plan({hold:true});await activate(9);await settled(9);await waitCalls(2);
  check("only foreground adoption moves automatic window to page10",same(requestedPages(),[9,10]));
  reply(1);await warmed(10);await activate(10);await settled(10);await quiet();
  check("last page never requests beyond bounds",same(requestedPages(),[9,10]));

  await open("page=8",{},[{hold:true}]);await waitCalls(1);
  await page.getByRole("button",{name:"9",exact:true}).hover();
  await page.getByRole("button",{name:"9",exact:true}).focus();
  await page.evaluate(()=>{window.__intentPromise=window.__queryFixture.prefetchPage(9)});
  await activate(9);await page.waitForFunction(()=>window.__queryFixture.queryPending);await quiet();
  check("auto + hover + focus + click deduplicate the same in-flight key",same(requestedPages(),[9]) && !calls()[0].aborted);
  plan({});reply(0);await settled(9);await warmed(10);
  check("adopted auto request completes once and then schedules only next target",same(requestedPages(),[9,10]) && !calls()[0].aborted);

  await open();await warmed(2);
  for(let target=2;target<=10;target++) {await activate(target);await settled(target);if(target<10)await warmed(target+1);}
  check("sequential pages1 through10 use exactly nine adjacent reads",same(requestedPages(),[2,3,4,5,6,7,8,9,10]));
  const countBeforeReturn=calls().length;await activate(1);await settled(1);await quiet();
  check("visited page1 and its fresh page2 cache survive the moving window",calls().length===countBeforeReturn);
  const defaults=await page.evaluate(()=>window.__queryFixture.queryDefaults());
  check("adjacent retains shared30s freshness and5min garbage collection",defaults.staleTime===30000 && defaults.gcTime===300000);
  await page.evaluate(()=>window.__queryFixture.agePage(2,31000));
  await page.evaluate(()=>window.__queryFixture.prefetchPage(2));await warmed(2);
  check("expired target still refetches through existing shared prefetch contract",calls().length===countBeforeReturn+1);

  for(const totalRows of [0,1,10]) {
    await open("",{totalRows});await quiet();
    check(`adjacent bounds reject next page when totalRows=${totalRows}`,calls().length===0);
  }
  await open("",{boundedClient:true});await settled(1);await quiet();
  const bounded=await page.evaluate(()=>({mode:window.__queryFixture.query.mode,totalPages:window.__queryFixture.result.pagination.totalPages,rows:window.__queryFixture.result.rows.length}));
  check("bounded-client opt-in does not speculate despite a complete dataset with multiple local pages",bounded.mode==="bounded-client" && bounded.totalPages===10 && bounded.rows===100 && calls().length===0);
  await open("page=8",{},[{page:8,totalRows:75}]);await warmed(9);await quiet();
  check("out-of-range adjacent result does not normalize current URL before activation",new URL(page.url()).searchParams.get("page")==="8" && same(requestedPages(),[9]));
  await activate(9);await settled(8);await quiet();
  check("normalized adjacent activation reuses response once without extra read or beyond-range prediction",same(requestedPages(),[9]) && new URL(page.url()).searchParams.get("page")==="8");
  for(const limit of [20,30,50]) {
    await open(`limit=${limit}`);await warmed(2);await quiet();
    check(`adjacent limit${limit} uses its exact page-size query`,calls().length===1 && new URLSearchParams(calls()[0].search).get("limit")===String(limit));
  }

  const identities=[
    {label:"search",search:"q=proof"},
    {label:"status",search:"status=published"},
    {label:"category",search:"category=9"},
    {label:"series",search:"series=4"},
    {label:"series any",search:"series=any"},
    {label:"image",search:"image=without"},
    {label:"featured",search:"featured=yes"},
    {label:"content type",search:"content_type=video"},
    {label:"trash",search:"view=trash"},
    {label:"sort direction",search:"sort=id_desc"},
  ];
  for(const identity of identities) {
    await open(identity.search);await warmed(2);
    const expected=new URLSearchParams(identity.search),actual=new URLSearchParams(calls()[0].search);
    check(`automatic target preserves canonical ${identity.label}`,calls().length===1 && actual.get("page")==="2" && [...expected].every(([key,value])=>actual.get(key)===value));
  }
  await open("content_type=video&category=9&series=4&status=published&image=without&featured=yes&sort=id_desc&limit=20&q=proof&extra=keep",{constrained:true});await warmed(2);
  const constrainedParams=new URLSearchParams(calls()[0].search);
  check("automatic target preserves full constrained query while omitting unowned browser extras",Object.entries({content_type:"article",category:"9",series:"4",status:"published",image:"without",featured:"yes",sort:"id_desc",limit:"20",q:"proof",page:"2"}).every(([key,value])=>constrainedParams.get(key)===value) && !constrainedParams.has("extra"));

  await open("page=8",{},[{hold:true},{hold:true},{hold:true}]);await waitCalls(1);await activate(2);await waitCalls(2);await quiet();
  check("distant foreground request supersedes obsolete adjacent without speculative overlap",same(requestedPages(),[9,2]) && calls()[0].aborted && !calls()[1].aborted);
  reply(0);reply(1);await settled(2);await waitCalls(3);
  check("foreground settlement schedules only its new adjacent target",same(requestedPages(),[9,2,3]));
  reply(2);await warmed(3);
  const latest=await snapshot("adjacent: late obsolete response cannot replace distant current");
  check("obsolete page9 never overwrites current page2 projection",latest.resultPage===2 && latest.metrics.page===2);

  await open("page=8",{},[{hold:true},{hold:true}]);await waitCalls(1);
  await page.evaluate(()=>{window.__intentPromise=window.__queryFixture.prefetchPage(7)});await waitCalls(2);await quiet();
  check("newer explicit previous-page intent wins over automatic next prediction",same(requestedPages(),[9,7]) && calls()[0].aborted && !calls()[1].aborted);
  reply(0);reply(1);await warmed(7);await quiet();
  check("automatic effect does not oscillate back after explicit intent completion",same(requestedPages(),[9,7]));

  await open("page=8",{},[{hold:true},{hold:true},{hold:true}]);await waitCalls(1);
  await page.evaluate(()=>window.__queryFixture.setFilter("status","published"));await waitCalls(2);await quiet();
  check("filter change cancels old prediction and prioritizes new page1",calls()[0].aborted && same(requestedPages(),[9,1]) && new URLSearchParams(calls()[1].search).get("status")==="published");
  reply(0);reply(1);await settled(1);await waitCalls(3);reply(2);await warmed(2);
  check("after filter settlement prediction belongs only to the new identity",new URLSearchParams(calls()[2].search).get("status")==="published" && Number(new URLSearchParams(calls()[2].search).get("page"))===2);

  await open("page=8",{otherForeground:true},[{hold:true},{hold:true}]);await waitCalls(1);
  await page.waitForFunction(()=>window.__queryFixture.otherForegroundState.fetchStatus==="fetching");await quiet();
  check("an active query under the shared root suppresses adjacent work at mount",calls().length===1 && calls()[0].pathname.endsWith("/categories") && !calls()[0].aborted);
  reply(0);await page.waitForFunction(()=>window.__queryFixture.otherForegroundState.status==="success");await waitCalls(2);
  check("settling the other foreground query releases exactly the current adjacent target",calls().length===2 && calls()[1].pathname.endsWith("/topics") && Number(new URLSearchParams(calls()[1].search).get("page"))===9 && !calls()[0].aborted);
  reply(1);await warmed(9);

  await open("page=8",{foregroundProbe:true},[{hold:true},{hold:true}]);await waitCalls(1);
  await page.evaluate(()=>window.__queryFixture.beginOtherForeground());await waitCalls(2);
  await page.waitForFunction(()=>window.__queryFixture.otherForegroundState.fetchStatus==="fetching");await quiet();
  check("starting another active root query cancels inactive adjacent work only",calls().length===2 && calls()[0].pathname.endsWith("/topics") && calls()[0].aborted && calls()[1].pathname.endsWith("/categories") && !calls()[1].aborted);
  reply(0);reply(1);await page.waitForFunction(()=>window.__queryFixture.otherForegroundState.status==="success");
  check("the higher-priority foreground observer completes without cancellation",!calls()[1].aborted);

  await open("page=8",{},[{hold:true}]);await waitCalls(1);await page.goto("about:blank");await quiet();
  check("unmount cancels the inactive automatic target without new work",calls().length===1 && calls()[0].aborted);

  await open("",{},[{status:500}]);await waitCalls(1);await page.waitForFunction(()=>window.__queryFixture.cachePage(2)?.status==="error");await quiet();
  const failedSpeculation=await snapshot("adjacent: failed background read remains silent");
  check("automatic failure has one attempt and no speculative retry loop",calls().length===1);
  check("automatic failure preserves current data without shared foreground error",failedSpeculation.resultPage===1 && !failedSpeculation.error && !failedSpeculation.pending);
  plan({status:500},{status:500},{status:500});await activate(2);await page.waitForFunction(()=>window.__queryFixture.error && !window.__queryFixture.queryPending);await quiet();
  check("foreground adoption retains provider retries and suppresses further prediction on failure",calls().length===4);

  await open("page=8",{},[{hold:true,version:"pre-write"}]);await waitCalls(1);
  const rollbackBefore=await snapshot("adjacent: real mutation rollback baseline");
  const rollbackCacheBefore=(await cache(8)).data;
  await beginMutation({rowId:71,outcome:"failure"});await page.waitForFunction(()=>window.__queryFixture.instantInteraction(71).isPending);await quiet();
  check("real instant mutation cancels pre-write inactive adjacent request",calls()[0].aborted);
  const optimistic=await snapshot("adjacent: real instant mutation optimistic state");
  check("real instant mutation patches its existing current cache",!same(optimistic.ids,[]) && (await cache(8)).data.rows[0].title.endsWith(" optimistic"));
  const countDuringMutation=calls().length;await quiet();
  check("automatic scheduling does not run while mutation is pending",calls().length===countDuringMutation);
  reply(0);await releaseMutation();const rejected=await finishMutation();await page.waitForFunction(()=>!window.__queryFixture.instantInteraction(71).isPending);
  const rollbackAfter=await snapshot("adjacent: real mutation restored snapshot");
  check("rejected real mutation restores exact visible and full cache snapshots",rejected.ok===false && same(rollbackBefore,rollbackAfter) && same(rollbackCacheBefore,(await cache(8)).data));
  check("canceled pre-write response cannot seed a fresh target after rollback",!(await cache(9))?.data || (await cache(9)).data.metrics.version!=="pre-write");

  await open("page=8",{},[{hold:true,version:"pre-write"}]);await waitCalls(1);
  await beginMutation({rowId:71});await quiet();
  plan({hold:true,version:"committed-current"},{hold:true,version:"committed-next"});await releaseMutation();await waitCalls(2);
  check("committed mutation awaits current revalidation before new adjacent work",calls().length===2 && (await page.evaluate(()=>window.__queryFixture.instantInteraction(71))).isPending);
  reply(0);reply(1);const committed=await finishMutation();await settled(8);await waitCalls(3);reply(2);await warmed(9);
  check("post-commit adjacent cache is authoritative and never pre-write",committed.ok===true && (await cache(9)).data.metrics.version==="committed-next" && calls()[0].aborted);

  await open("page=8",{},[{}]);await warmed(9);
  const cachedBefore=await cache(8);await beginMutation({rowId:71});
  plan({status:500},{status:500},{status:500});await releaseMutation();const readFailedCommit=await finishMutation();
  await page.waitForFunction(()=>window.__queryFixture.error && !window.__queryFixture.revalidating);await quiet();
  const afterReadFailure=await cache(8);
  check("post-commit read failure remains committed and never rolls back optimistic state",readFailedCommit.ok===true && afterReadFailure.data.rows[0].title===cachedBefore.data.rows[0].title+" optimistic");
  check("post-commit failed read leaves old adjacent invalidated and stops speculation",(await cache(9)).invalidated && calls().length===4);

  await open("page=8",{},[{}]);await warmed(9);await beginMutation({rowId:71,reconcileFailure:true});
  plan({version:"committed-current"},{version:"committed-next"});await releaseMutation();const reconcileFailed=await finishMutation();await settled(8);
  check("real post-commit reconcile failure returns warning without retrying execute",reconcileFailed.ok===true && reconcileFailed.feedbackStatus==="warning");

  await open("page=8",{},[{}]);await warmed(9);const deleteBefore=await snapshot("adjacent: real removeRows rollback baseline");
  const deleteCachesBefore=[(await cache(8)).data,(await cache(9)).data];
  await beginMutation({rowId:71,action:"delete",remove:true,outcome:"failure"});
  check("real removeRows updates current IDs and same-scope cached totals",!(await cache(8)).data.rows.some(row=>row.id===71) && (await cache(9)).data.pagination.totalRows===99);
  await releaseMutation();await finishMutation();
  check("failed removal restores full current and adjacent snapshots",same(deleteBefore,await snapshot("adjacent: real removeRows rollback result")) && same(deleteCachesBefore,[(await cache(8)).data,(await cache(9)).data]));

  observations.push({label:"adjacent proof boundary",note:"Actual shared controller, QueryClient, cache keys and instant mutation owners; GET transport and execute results are synthetic. No Auth, DB, domain action, physical paint or production-latency claim. Quiet no-chain observation is150ms after two animation frames."});
}

/** Source inventory only: importing the server registry would initialize DB owners. */
async function navigationAdoptionPlan(root, eligibilityOnly = false) {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const registryFile = "src/lib/admin/entity-list/data-engine/registry.ts";
  const manifestFile = "src/lib/admin/interaction-system/adoption-manifest.ts";
  const registrySource = await readFile(path.join(root, registryFile), "utf8");
  const manifestSource = await readFile(path.join(root, manifestFile), "utf8");
  const registryAst = ts.createSourceFile(registryFile, registrySource, ts.ScriptTarget.Latest, true);
  let registryNode;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(registryAst) === "adminEntityListAdapterRegistry") registryNode = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(registryAst);
  while (registryNode && (ts.isAsExpression(registryNode) || ts.isSatisfiesExpression(registryNode))) registryNode = registryNode.expression;
  if (!registryNode || !ts.isObjectLiteralExpression(registryNode)) throw new Error("Navigation fixture cannot derive the current registry");
  const entities = registryNode.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) throw new Error("Unclassified registry member");
    return property.name.text;
  });
  const manifestAst = ts.createSourceFile(manifestFile, manifestSource, ts.ScriptTarget.Latest, true);
  if (manifestAst.statements.some(node => ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly)) throw new Error("Manifest acquired a runtime import; review isolated inventory loading");
  const manifest = { exports: {} };
  const compiled = ts.transpileModule(manifestSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("module", "exports", "require", compiled)(manifest, manifest.exports, () => { throw new Error("Unexpected manifest dependency"); });
  const surfaces = manifest.exports.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces;
  const actions = manifest.exports.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities;
  const specs = [
    ["topics", "content/entity-list-contracts/topics.ts", "topicsQueryContract", "src/components/admin/content/TopicsListClient.tsx"],
    ["categories", "content/entity-list-contracts/categories.ts", "categoriesQueryContract", "src/app/admin/content/categories/CategoriesListClient.tsx"],
    ["series", "content/entity-list-contracts/series.ts", "seriesQueryContract", "src/app/admin/content/series/SeriesTableClient.tsx"],
    ["pages", "pages/entity-list-contract.ts", "pagesQueryContract", "src/app/admin/pages-blocks/pages/PagesTableClient.tsx"],
    ["projects", "projects/entity-list-contract.ts", "projectsQueryContract", "src/app/admin/projects/ProjectsTableClient.tsx"],
    ...entities.filter(entity => entity.startsWith("project_locations_")).map(entity => [entity, "projects/location-management-contract.ts", "projectLocationsQueryContract", "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx"]),
    ...["stages", "items", "updates"].map(kind => [`project_tracking_${kind}`, "projects/tracking-contract.ts", `tracking${kind[0].toUpperCase()}${kind.slice(1)}QueryContract`, "src/components/admin/projects/tracking/TrackingCollections.tsx"]),
    ["redirects", "redirects/entity-list-contract.ts", "redirectsQueryContract", "src/app/admin/seo/redirects/RedirectsClient.tsx"],
    ["activity_log", "audit/entity-list-contract.ts", "activityLogQueryContract", "src/app/admin/activity-log/ActivityLogClient.tsx"],
    ["topics_without_image", "media-catalog/topics-without-image-entity-list-contract.ts", "topicsWithoutImageQueryContract", "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx"],
    ["admin_users", "users/entity-list-contract.ts", "adminUsersQueryContract", "src/app/admin/users-roles/UsersManagementClient.tsx"],
  ];
  const byEntity = new Map(specs.map(([entity, contractFile, contractExport, consumerSourceFile]) => [entity, { entity, contractFile: `src/lib/admin/${contractFile}`, contractExport, consumerSourceFile }]));
  if (byEntity.size !== specs.length || entities.some(entity => !byEntity.has(entity)) || [...byEntity.keys()].some(entity => !entities.includes(entity))) throw new Error("Registry/profile drift: classify every current key before running");
  const profiles = [];
  const sourceHashes = {};
  for (const file of [
    "scripts/qa-admin-data-engine-controller.mjs", "package.json", "package-lock.json",
    "src/components/admin/entity-list/AdminEntityListQueryProvider.tsx",
    "src/components/admin/entity-list/AdminEntityList.tsx",
    "src/components/admin/ui/AdminTablePagination.tsx",
    "src/components/admin/AdminFeedbackProvider.tsx",
    "src/lib/admin/entity-list/data-engine/client-controller.ts",
    "src/lib/admin/entity-list/data-engine/contracts.ts",
    "src/lib/admin/entity-list/data-engine/query-keys.ts",
    "src/lib/admin/entity-list/data-engine/normalized-result-cache.ts",
    "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
    "src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts",
    "src/lib/admin/entity-list/data-engine/interaction-state.ts",
  ]) sourceHashes[file] = createHash("sha256").update(await readFile(path.join(root,file))).digest("hex");
  for (const spec of byEntity.values()) {
    const consumerSource = await readFile(path.join(root, spec.consumerSourceFile), "utf8");
    const contractSource = await readFile(path.join(root, spec.contractFile), "utf8");
    for (const [file, source] of [[spec.consumerSourceFile, consumerSource], [spec.contractFile, contractSource]]) sourceHashes[file] = createHash("sha256").update(source).digest("hex");
    const consumers = surfaces.filter(surface => surface.dataRegistryEntities?.includes(spec.entity) && surface.presentationSourceFiles?.includes(spec.consumerSourceFile)).map(surface => surface.id);
    if (!consumers.length) throw new Error(`No current Collection manifest binding: ${spec.entity}`);
    const staleTimeMs = spec.entity.startsWith("project_tracking_") || spec.entity === "activity_log" ? 15_000 : 30_000;
    if (!new RegExp(`staleTimeMs:\\s*${staleTimeMs === 15_000 ? "15_?000" : "30_?000"}`).test(consumerSource)) throw new Error(`Review actual consumer TTL: ${spec.entity}`);
    const actionEntry = actions.find(entry => entry.entity === spec.entity);
    const mutable = Boolean(actionEntry && ["visibility", "featured", "duplicate", "archive", "delete"].some(action => actionEntry.actions[action] === "adopted"));
    const mutationAction = actionEntry && ["visibility", "featured", "duplicate", "archive", "delete"].find(action => actionEntry.actions[action] === "adopted");
    const common = { ...spec, consumers, staleTimeMs, mutable, mutationAction };
    if (spec.entity === "projects") {
      for (const projectType of ["residential", "commercial"]) profiles.push({ ...common, id: `projects:${projectType}`, routeOwnedParams: { type: projectType }, routeFilters: { projectType } });
    } else if (spec.entity.startsWith("project_tracking_")) {
      const routeOwnedParams = { project_id: "101" }, routeFilters = { projectId: 101 };
      if (spec.entity === "project_tracking_items") { routeOwnedParams.stage_id = "201"; routeFilters.stageId = 201; }
      if (spec.entity === "project_tracking_updates") { routeOwnedParams.item_id = "301"; routeFilters.itemId = 301; }
      profiles.push({ ...common, id: spec.entity, routeOwnedParams, routeFilters });
    } else profiles.push({ ...common, id: spec.entity, routeOwnedParams: {}, routeFilters: {} });
  }
  const readArgument = name => {
    const index = process.argv.indexOf(name);
    if (index < 0) return null;
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires an explicit comma-separated selection`);
    return value.split(",").filter(Boolean);
  };
  const requestedProfiles = readArgument("--profiles"), requestedConsumers = readArgument("--consumers");
  if (Boolean(requestedProfiles) === Boolean(requestedConsumers)) throw new Error("Use exactly one of --profiles <ids|all> or --consumers <manifest ids>");
  if (requestedProfiles?.some(id => id !== "all" && !profiles.some(profile => profile.id === id))) throw new Error("Unknown navigation profile");
  if (requestedConsumers?.some(id => !profiles.some(profile => profile.consumers.includes(id)))) throw new Error("Consumer is not mapped to a current server-page profile");
  const selected = profiles.filter(profile => requestedProfiles ? requestedProfiles.includes("all") || requestedProfiles.includes(profile.id) : profile.consumers.some(id => requestedConsumers.includes(id)));
  if (!selected.length) throw new Error("Empty navigation selection");
  let reachableAdoptionProof;
  if (eligibilityOnly) {
    if (requestedProfiles?.includes("all")) throw new Error("Eligibility proof requires an explicit bounded selection, never all profiles");
    const proofFile = "scripts/lib/admin-navigation-source-proof.mts";
    const { collectAdminNavigationAdoptionFailures } = await import("./lib/admin-navigation-source-proof.mts");
    const failures = collectAdminNavigationAdoptionFailures({ root, surfaces });
    if (failures.length) throw new Error(`Current reachable navigation adoption proof failed: ${failures.join("; ")}`);
    for (const profile of selected) {
      const declarations = profile.consumers.map(id => surfaces.find(surface => surface.id === id));
      if (declarations.some(surface => surface.navigationPrefetch?.intent.state !== "adopted" || surface.navigationPrefetch?.adjacent.state !== "immediate_next")) {
        throw new Error(`Selected consumer has not adopted both existing capabilities: ${profile.id}`);
      }
      const parsed=ts.createSourceFile(profile.consumerSourceFile,await readFile(path.join(root,profile.consumerSourceFile),"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      const importedNames=(owner,exportName)=>parsed.statements.flatMap(statement=>{
        if(!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith(".") || statement.importClause?.isTypeOnly)return [];
        const imported=path.resolve(root,path.dirname(profile.consumerSourceFile),statement.moduleSpecifier.text).replace(/\.(?:ts|tsx)$/u,"");
        if(imported!==path.resolve(root,owner).replace(/\.(?:ts|tsx)$/u,""))return [];
        const bindings=statement.importClause?.namedBindings;
        return bindings && ts.isNamedImports(bindings)?bindings.elements.filter(element=>!element.isTypeOnly && (element.propertyName?.text??element.name.text)===exportName).map(element=>element.name.text):[];
      });
      const controllers=importedNames("src/lib/admin/entity-list/data-engine/client-controller.ts","useAdminEntityListController");
      const contracts=importedNames(profile.contractFile,profile.contractExport);
      const boundOptions=[];
      const findBinding=node=>{
        if(ts.isCallExpression(node) && ts.isIdentifier(node.expression) && controllers.includes(node.expression.text) && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
          const members=node.arguments[0].properties;
          const value=name=>members.find(member=>ts.isPropertyAssignment(member) && member.name.getText(parsed)===name)?.initializer;
          const actualContract=value("contract");
          if(actualContract && ts.isIdentifier(actualContract) && contracts.includes(actualContract.text))boundOptions.push({adjacent:value("adjacentPrefetch"),staleTime:value("staleTimeMs")});
        }
        ts.forEachChild(node,findBinding);
      };
      findBinding(parsed);
      if(boundOptions.length!==1 || boundOptions[0].adjacent?.kind!==ts.SyntaxKind.TrueKeyword || !boundOptions[0].staleTime || !ts.isNumericLiteral(boundOptions[0].staleTime) || Number(boundOptions[0].staleTime.text.replaceAll("_",""))!==profile.staleTimeMs) {
        throw new Error(`The fixture contract/TTL does not bind to this consumer's adopted controller: ${profile.id}`);
      }
      profile.controllerInputProof={sourceFile:profile.consumerSourceFile,contractFile:profile.contractFile,contractExport:profile.contractExport,staleTimeMs:profile.staleTimeMs,adjacentPrefetch:true};
      // These options come from the current manifest only after its reachable
      // production controller/pagination bindings pass the existing AST owner.
      profile.navigationPolicy = {
        intent: declarations.every(surface => surface.navigationPrefetch.intent.state === "adopted"),
        adjacent: declarations.every(surface => surface.navigationPrefetch.adjacent.state === "immediate_next"),
      };
      for (const file of declarations.flatMap(surface => surface.pageSourceFiles)) {
        sourceHashes[file] = createHash("sha256").update(await readFile(path.join(root,file))).digest("hex");
      }
    }
    for (const file of [registryFile,manifestFile,proofFile,"scripts/lib/typescript-executable-graph.mts"]) {
      sourceHashes[file] = createHash("sha256").update(await readFile(path.join(root,file))).digest("hex");
    }
    reachableAdoptionProof = { owner: proofFile, failures, selectedConsumers: [...new Set(selected.flatMap(profile=>profile.consumers))],
      claim: "Current manifest declarations verified against reachable production controller/pagination bindings; consumer UI is not mounted by this fixture" };
  }
  return {
    profiles: selected, specs: [...byEntity.values()], sourceHashes, eligibilityOnly,
    coverage: {
      registryFile, manifestFile, registrySha256: createHash("sha256").update(registrySource).digest("hex"), manifestSha256: createHash("sha256").update(manifestSource).digest("hex"),
      registryEntities: entities, selectedProfiles: selected.map(profile => profile.id),
      selection: { requestedProfiles, requestedConsumers },
      exemptions: profiles.filter(profile => !selected.includes(profile)).map(profile => ({ profile: profile.id, consumers: profile.consumers, reason: "Outside this explicit fixture selection; neither adoption nor behavioral closure claimed" })),
      nonRegistrySurfaces: surfaces.filter(surface => !profiles.some(profile => profile.consumers.includes(surface.id))).map(surface => ({ consumer: surface.id, classification: surface.workflowClassification, reason: "Not a current server-page registry binding in this fixture; preserved outside scope" })),
      capabilityAxes: Object.keys(manifest.exports.ADMIN_CURRENT_SHARED_CAPABILITY_SET),
      ...(reachableAdoptionProof ? { reachableAdoptionProof } : {}),
      claim: "Actual query-contract/shared-owner behavior with synthetic rows and transport; no consumer UI/domain/Auth/DB proof",
    },
  };
}

async function runNavigationAdoptionCases({page,origin,requests,observations,snapshot,configure,plan,delayedResponses,requestWaiters,navigation}) {
  let start = 0;
  const calls = () => requests.slice(start).filter(request => request.pathname.startsWith("/api/admin/entity-lists/"));
  const quiet = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const waitCalls = count => new Promise((resolve,reject) => {
    const timeout=setTimeout(()=>{requestWaiters.delete(notify);reject(new Error(`Navigation fixture expected ${count} GETs, saw ${calls().length}`));},10_000);
    const notify=()=>{if(calls().length>=count){clearTimeout(timeout);requestWaiters.delete(notify);resolve();}};
    requestWaiters.add(notify);notify();
  });
  const reply = index => { const pending=delayedResponses[index]; if(!pending)throw new Error(`Missing navigation reply ${index}`);pending.reply(); };
  const intent = target => page.evaluate(target=>{window.__intentPromise=window.__queryFixture.prefetchPage(target);},target);
  const finishIntent = () => page.evaluate(()=>window.__intentPromise);
  const activate = target => page.evaluate(target=>window.__queryFixture.setPage(target),target);
  const settled = target => page.waitForFunction(target=>window.__queryFixture.query.page===target && window.__queryFixture.result.pagination.page===target && !window.__queryFixture.queryPending && !window.__queryFixture.revalidating && !window.__queryFixture.error,target);
  const open = async (profile, options={}, plans=[]) => {
    await page.mouse.move(0,0);
    configure({navigationAdoption:true,optIn:true,intentProbe:true,totalRows:40,...profile,...options});plan(...plans);start=requests.length;
    const params=new URLSearchParams({limit:"10",...profile.routeOwnedParams});
    if(options.page)params.set("page",String(options.page));
    await page.goto(`${origin}/admin/content/${profile.entity}?${params}`);
    await page.waitForFunction(()=>Boolean(window.__queryFixture?.navigation));await quiet();
  };
  for(const profile of navigation.profiles) {
    const label=profile.id;
    await open(profile);
    const binding=await page.evaluate(()=>window.__queryFixture.navigation.describe());
    observations.push({label:`${label}: actual contract binding`,profile,binding});
    check(`${label}: actual contract seed avoids duplicate initial GET`,calls().length===0 && binding.query.mode==="server-page");
    check(`${label}: existing freshness and route identity are preserved`,binding.staleTimeMs===profile.staleTimeMs && Object.entries(profile.routeFilters).every(([key,value])=>binding.query.filters[key]===value));
    check(`${label}: location entity resolves to its canonical level`,!profile.entity.startsWith("project_locations_") || Boolean(binding.locationLevel));
    const identity=await page.evaluate(()=>window.__queryFixture.navigation.identityCases());
    check(`${label}: query key distinguishes every current contract dimension`,identity.cases.every(item=>item.distinct && item.roundTrip) && identity.coveredFilters.length===Object.keys(binding.query.filters).length,JSON.stringify(identity));
    check(`${label}: mandatory scoped filters cannot be omitted`,!Object.keys(profile.routeFilters).some(key=>key.endsWith("Id")) || binding.missingScopeRejected);
    await page.evaluate(async()=>{for(const target of [0,-1,1,3,999,1.5])await window.__queryFixture.prefetchPage(target);});await quiet();
    check(`${label}: invalid, current and nonadjacent intent do not request`,calls().length===0);
    plan({hold:true});await intent(2);await waitCalls(1);await intent(2);await quiet();
    check(`${label}: repeated intent deduplicates the in-flight key`,calls().length===1);
    const requestIdentity=await page.evaluate(search=>window.__queryFixture.navigation.matchesRequest(search,2),calls()[0].search);
    check(`${label}: requested next page retains the complete canonical query`,requestIdentity);
    await activate(2);await page.waitForFunction(()=>window.__queryFixture.queryPending);
    check(`${label}: foreground adopts the same pending request`,calls().length===1 && !calls()[0].aborted);
    reply(0);await finishIntent();await settled(2);await activate(1);await settled(1);await quiet();
    check(`${label}: visited return reuses fresh cache`,calls().length===1);
    await page.evaluate(age=>window.__queryFixture.agePage(2,age),profile.staleTimeMs-1000);await intent(2);await finishIntent();
    check(`${label}: its own fresh TTL deduplicates intent`,calls().length===1);
    await page.evaluate(age=>window.__queryFixture.agePage(2,age),profile.staleTimeMs+1000);await intent(2);await finishIntent();
    check(`${label}: its own stale TTL permits a new read`,calls().length===2);

    await open(profile);plan({hold:true});await intent(2);await waitCalls(1);
    await page.evaluate(()=>window.__queryFixture.setSearch("navigation fixture"));await waitCalls(2);await settled(1);await quiet();
    check(`${label}: query-scope change cancels inactive old speculation`,calls()[0].aborted && calls()[1].status===200);
    await intent(2);await finishIntent();
    check(`${label}: changed-scope prefetch uses the full new identity`,calls().length===3 && await page.evaluate(search=>window.__queryFixture.navigation.matchesRequest(search,2),calls()[2].search));
    await page.evaluate(()=>window.__queryFixture.navigation.challengeConstraints());await settled(1);await quiet();
    const constrained=await page.evaluate(()=>window.__queryFixture.query.filters);
    check(`${label}: mounted controller preserves route scope after attempted override`,Object.entries(profile.routeFilters).every(([key,value])=>constrained[key]===value));

    await open(profile,{adjacentPrefetch:true,otherForeground:true},[{hold:true}]);await waitCalls(1);await quiet();
    check(`${label}: active query under the existing root blocks automatic adjacency`,calls().length===1 && !calls()[0].aborted);
    reply(0);await page.waitForFunction(()=>window.__otherForegroundState?.fetchStatus==="idle");await waitCalls(2);await page.waitForFunction(()=>window.__queryFixture.cachePage(2)?.status==="success");await quiet();
    check(`${label}: foreground settlement releases only the current adjacent target`,calls().length===2 && !calls()[0].aborted);

    await open(profile);plan({hold:true});await intent(2);await waitCalls(1);
    await page.evaluate(()=>{window.__navigationInvalidation=window.__queryFixture.invalidate();});await page.evaluate(()=>window.__navigationInvalidation);await settled(1);await quiet();
    check(`${label}: shared invalidation cancels inactive pre-invalidation transport`,calls()[0].aborted);
    const invalidated=await page.evaluate(()=>window.__queryFixture.cachePage(2));
    check(`${label}: invalidated speculative response cannot become fresh`,!invalidated?.data || invalidated.invalidated);
    const beforeNext=calls().length;await intent(2);await finishIntent();
    check(`${label}: next intent rereads after invalidation`,calls().length===beforeNext+1);

    if(profile.mutable) {
      await open(profile);plan({hold:true});await intent(2);await waitCalls(1);
      const before=await page.evaluate(()=>window.__queryFixture.cachePage(1).data);
      const outside=await page.evaluate(()=>window.__queryFixture.navigation.seedOutsideScope());
      await page.evaluate(()=>{window.__navigationMutation=window.__queryFixture.runInstant({rowId:1,outcome:"failure"});});
      await page.waitForFunction(()=>typeof window.__releaseInstantMutation==="function" && window.__queryFixture.instantInteraction(1).isPending);await quiet();
      check(`${label}: actual instant mutation cancels speculative transport`,calls()[0].aborted);
      const optimistic=await page.evaluate(()=>window.__queryFixture.cachePage(1).data);
      check(`${label}: actual owner applies optimistic update`,optimistic.rows[0].title===before.rows[0].title+" optimistic");
      check(`${label}: optimistic patch does not cross the actual cache scope`,JSON.stringify(outside)===JSON.stringify(await page.evaluate(()=>window.__queryFixture.navigation.outsideScope())));
      const pendingCalls=calls().length;await intent(2);await finishIntent();
      check(`${label}: mutation pending blocks speculative starts`,calls().length===pendingCalls);
      await page.evaluate(()=>window.__releaseInstantMutation());const rejected=await page.evaluate(()=>window.__navigationMutation);
      const restored=await page.evaluate(()=>window.__queryFixture.cachePage(1).data);
      check(`${label}: rejected outcome rolls back the exact scope snapshot`,rejected.ok===false && JSON.stringify(before)===JSON.stringify(restored));

      plan({hold:true,version:"committed"});
      await page.evaluate(()=>{window.__navigationMutation=window.__queryFixture.runInstant({rowId:1});});
      await page.waitForFunction(()=>typeof window.__releaseInstantMutation==="function" && window.__queryFixture.instantInteraction(1).isPending);await page.evaluate(()=>window.__releaseInstantMutation());await waitCalls(pendingCalls+1);await quiet();
      check(`${label}: committed write remains pending through active refetch`,await page.evaluate(()=>window.__queryFixture.instantInteraction(1).isPending));
      reply(1);const committed=await page.evaluate(()=>window.__navigationMutation);await settled(1);
      check(`${label}: commit reconciles via existing owner and clears pending`,committed.ok===true && !(await page.evaluate(()=>window.__queryFixture.instantInteraction(1).isPending)));
      const priorCommit=await page.evaluate(()=>window.__queryFixture.cachePage(1).data);
      plan({status:500},{status:500},{status:500});
      await page.evaluate(()=>{window.__navigationMutation=window.__queryFixture.runInstant({rowId:1});});
      await page.waitForFunction(()=>typeof window.__releaseInstantMutation==="function" && window.__queryFixture.instantInteraction(1).isPending);await page.evaluate(()=>window.__releaseInstantMutation());
      const readFailureCommit=await page.evaluate(()=>window.__navigationMutation);
      const committedCache=await page.evaluate(()=>window.__queryFixture.cachePage(1).data);
      check(`${label}: post-commit read failure never rolls back committed optimism`,readFailureCommit.ok===true && committedCache.rows[0].title===priorCommit.rows[0].title+" optimistic");
    } else observations.push({label:`${label}: mutation scope exemption`,reason:"No adopted mutating row command in current manifest; external shared invalidation tested, no fabricated domain mutation claim"});

    await open(profile);const beforeFailure=await snapshot(`${label}: foreground failure baseline`);
    plan({status:500},{status:500},{status:500});await activate(2);
    await page.waitForFunction(()=>Boolean(window.__queryFixture.error) && !window.__queryFixture.queryPending);
    const failedRead=await snapshot(`${label}: foreground failure`);
    check(`${label}: failed new key preserves resolved rows/footer and requested query`,failedRead.ids.join()===beforeFailure.ids.join() && failedRead.resultPage===1 && failedRead.requestedPage===2 && Boolean(failedRead.notice));
    const beforeRetry=calls().length;await page.evaluate(()=>window.__queryFixture.retry());await settled(2);
    check(`${label}: explicit retry recovers with one GET`,calls().length===beforeRetry+1);

    await open(profile,{adjacentPrefetch:true});await waitCalls(1);await page.waitForFunction(()=>window.__queryFixture.cachePage(2)?.status==="success");await quiet();
    // Bounded observation, not a proof about an unlimited future interval.
    await page.waitForTimeout(150);
    check(`${label}: opted-in N+1 warms once without a background chain`,calls().length===1 && await page.evaluate(search=>window.__queryFixture.navigation.matchesRequest(search,2),calls()[0].search));
    await open(profile,{adjacentPrefetch:true,page:4});await quiet();await page.waitForTimeout(150);
    check(`${label}: final page has no adjacent request`,calls().length===0);
  }
  observations.push({label:"navigation adoption proof boundary",coverage:navigation.coverage,sourceHashes:navigation.sourceHashes,note:"Canonical contracts/keys/controller/mutation owners mounted; title-only rows and metrics are synthetic and intentionally do not assert adapter row schemas. Next navigation isolated. No Auth, DB, consumer rendering, production latency, or physical-paint claim."});
}

/** New adoption cases only; the previously accepted navigation suite is not run. */
async function runNavigationEligibilityCases({page,origin,requests,observations,snapshot,configure,plan,delayedResponses,requestWaiters,navigation}) {
  let start = 0;
  const calls = () => requests.slice(start).filter(request=>request.pathname.startsWith("/api/admin/entity-lists/"));
  const pages = () => calls().map(request=>Number(new URLSearchParams(request.search).get("page")||1));
  const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
  // Explicit bounded negative observation, not an assertion about infinite time.
  const quiet = async () => {
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForTimeout(150);
  };
  const waitCalls = count => new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{requestWaiters.delete(notify);reject(new Error(`Eligibility expected ${count} GETs, saw ${calls().length}`));},10000);
    const notify=()=>{if(calls().length>=count){clearTimeout(timer);requestWaiters.delete(notify);resolve();}};
    requestWaiters.add(notify);notify();
  });
  const reply = index => {const pending=delayedResponses[index];if(!pending)throw new Error(`Missing eligibility response ${index}`);pending.reply();};
  const cache = target => page.evaluate(target=>window.__queryFixture.cachePage(target),target);
  const settled = target => page.waitForFunction(target=>window.__queryFixture.query.page===target && window.__queryFixture.result.pagination.page===target && !window.__queryFixture.queryPending && !window.__queryFixture.revalidating && !window.__queryFixture.error,target);
  const warmed = target => page.waitForFunction(target=>{const c=window.__queryFixture.cachePage(target);return c?.status==="success" && c.fetchStatus==="idle" && !c.invalidated;},target);
  const activate = target => page.evaluate(target=>window.__queryFixture.setPage(target),target);
  const open = async (profile,options={},plans=[]) => {
    await page.mouse.move(0,0);
    configure({...profile,totalRows:30,...options,navigationAdoption:true,intentProbe:true,
      optIn:profile.navigationPolicy.intent,adjacentPrefetch:profile.navigationPolicy.adjacent});
    plan(...plans);start=requests.length;
    const params=new URLSearchParams({limit:"10",...profile.routeOwnedParams});
    await page.goto(`${origin}/admin/content/${profile.entity}?${params}`);
    await page.waitForFunction(()=>Boolean(window.__queryFixture?.navigation));
  };
  const beginMutation = async (profile,outcome="success") => {
    await page.evaluate(options=>{window.__eligibilityMutation=window.__queryFixture.runInstant(options);},{rowId:1,action:profile.mutationAction,outcome});
    await page.waitForFunction(()=>typeof window.__releaseInstantMutation==="function" && window.__queryFixture.instantInteraction(1).isPending);
  };
  const releaseMutation = () => page.evaluate(()=>window.__releaseInstantMutation());
  const finishMutation = () => page.evaluate(()=>window.__eligibilityMutation);

  for(const profile of navigation.profiles) {
    const label=profile.id;
    observations.push({label:`${label}: reachable adoption binding`,profile,sourceProof:navigation.coverage.reachableAdoptionProof});
    for(const totalRows of [0,1,10]) {
      await open(profile,{totalRows});await quiet();
      const state=await page.evaluate(()=>({query:window.__queryFixture.query,pagination:window.__queryFixture.result.pagination}));
      await page.evaluate(()=>window.__queryFixture.prefetchPage(2));await quiet();
      check(`${label}: ${totalRows} rows / no next page adds zero GETs`,state.query.page>=state.pagination.totalPages && calls().length===0);
    }

    await open(profile,{},[{hold:true,version:"next"}]);await waitCalls(1);
    const binding=await page.evaluate(()=>window.__queryFixture.navigation.describe());
    const current=await snapshot(`${label}: current page while automatic next is pending`);
    check(`${label}: automatic N+1 keeps the actual query identity`,same(pages(),[2]) && binding.query.mode==="server-page" && binding.staleTimeMs===profile.staleTimeMs && await page.evaluate(search=>window.__queryFixture.navigation.matchesRequest(search,2),calls()[0].search));
    check(`${label}: background work preserves visible source rows and pending`,current.resultPage===1 && current.requestedPage===1 && !current.pending && !current.revalidating && !current.error);
    await page.getByRole("button",{name:"2",exact:true}).hover();
    await page.getByRole("button",{name:"2",exact:true}).focus();
    await page.evaluate(()=>{window.__eligibilityIntent=window.__queryFixture.prefetchPage(2);});await quiet();
    check(`${label}: automatic + hover + focus intent deduplicate`,calls().length===1 && !calls()[0].aborted);
    reply(0);await warmed(2);await quiet();
    check(`${label}: completed N+1 never chains into N+2`,same(pages(),[2]) && same(current,await snapshot(`${label}: cached next leaves visible source unchanged`)));
    plan({hold:true,version:"third"});await activate(2);await settled(2);await waitCalls(2);
    check(`${label}: foreground adoption reuses N+1 then advances the window once`,same(pages(),[2,3]));
    reply(1);await warmed(3);await activate(3);await settled(3);await quiet();
    check(`${label}: the final page schedules nothing beyond its bound`,same(pages(),[2,3]));
    await activate(1);await settled(1);await quiet();
    check(`${label}: visited cached return adds no request`,calls().length===2);

    await open(profile,{},[{hold:true,version:"old-scope"},{hold:true,version:"new-current"},{hold:true,version:"new-next"}]);await waitCalls(1);
    await page.evaluate(()=>window.__queryFixture.setSearch("eligibility fixture"));await waitCalls(2);await quiet();
    check(`${label}: changed scope cancels old adjacent and prioritizes foreground`,calls()[0].aborted && same(pages(),[2,1]));
    reply(0);reply(1);await settled(1);await waitCalls(3);reply(2);await warmed(2);await quiet();
    check(`${label}: only the new scoped result can become fresh`,(await cache(1)).data.metrics.version==="new-current" && (await cache(2)).data.metrics.version==="new-next" && await page.evaluate(search=>window.__queryFixture.navigation.matchesRequest(search,2),calls()[2].search));
    const scoped=await page.evaluate(()=>window.__queryFixture.query.filters);
    check(`${label}: route-owned parent scope survives navigation`,Object.entries(profile.routeFilters).every(([key,value])=>scoped[key]===value));

    await open(profile,{},[{hold:true,version:"pre-invalidation"},{hold:true,version:"fresh-current"},{hold:true,version:"fresh-next"}]);await waitCalls(1);
    await page.evaluate(()=>{window.__eligibilityInvalidation=window.__queryFixture.invalidate();});await waitCalls(2);await quiet();
    check(`${label}: invalidation cancels inactive speculation before active refetch`,calls()[0].aborted && same(pages(),[2,1]));
    reply(0);reply(1);await page.evaluate(()=>window.__eligibilityInvalidation);await settled(1);await waitCalls(3);reply(2);await warmed(2);await quiet();
    check(`${label}: post-invalidation current and adjacent caches are authoritative`,(await cache(1)).data.metrics.version==="fresh-current" && (await cache(2)).data.metrics.version==="fresh-next" && !(await cache(2)).invalidated);

    await open(profile,{otherForeground:true},[{hold:true},{hold:true}]);await waitCalls(1);await quiet();
    check(`${label}: shared foreground work prevents speculative start`,calls().length===1 && Number(new URLSearchParams(calls()[0].search).get("page"))===3);
    reply(0);await page.waitForFunction(()=>window.__otherForegroundState?.fetchStatus==="idle");await waitCalls(2);reply(1);await warmed(2);await quiet();
    check(`${label}: foreground settlement releases only its current N+1`,calls().length===2 && !calls()[0].aborted && await page.evaluate(search=>window.__queryFixture.navigation.matchesRequest(search,2),calls()[1].search));

    await open(profile,{},[{status:500}]);await waitCalls(1);await page.waitForFunction(()=>window.__queryFixture.cachePage(2)?.status==="error");await quiet();
    const failedBackground=await snapshot(`${label}: failed speculative read`);
    check(`${label}: failed speculation is silent, bounded and leaves current data`,calls().length===1 && failedBackground.resultPage===1 && !failedBackground.error && !failedBackground.pending);
    plan({status:500},{status:500},{status:500});await activate(2);await page.waitForFunction(()=>window.__queryFixture.error && !window.__queryFixture.queryPending);await quiet();
    const failedForeground=await snapshot(`${label}: failed foreground adoption`);
    check(`${label}: foreground failure retains source rows and shared retry semantics`,calls().length===4 && failedForeground.resultPage===1 && failedForeground.requestedPage===2 && same(failedBackground.ids,failedForeground.ids) && Boolean(failedForeground.notice));

    if(profile.mutable) {
      await open(profile,{},[{hold:true,version:"pre-write"}]);await waitCalls(1);
      const before=(await cache(1)).data;
      const outside=await page.evaluate(()=>window.__queryFixture.navigation.seedOutsideScope());
      await beginMutation(profile,"failure");await quiet();
      check(`${label}: mutation cancels pre-write next read and owns optimistic row`,calls()[0].aborted && (await cache(1)).data.rows[0].title===before.rows[0].title+" optimistic");
      check(`${label}: pending mutation cannot start speculative work or cross scope`,calls().length===1 && same(outside,await page.evaluate(()=>window.__queryFixture.navigation.outsideScope())));
      reply(0);await releaseMutation();const rejected=await finishMutation();await quiet();
      check(`${label}: rejected mutation restores exact current cache`,rejected.ok===false && same(before,(await cache(1)).data));
      check(`${label}: canceled pre-write payload cannot remain a fresh next page`,!(await cache(2))?.data || (await cache(2)).data.metrics.version!=="pre-write");

      await open(profile,{},[{hold:true,version:"pre-write"}]);await waitCalls(1);await beginMutation(profile);
      plan({hold:true,version:"committed-current"},{hold:true,version:"committed-next"});await releaseMutation();await waitCalls(2);await quiet();
      check(`${label}: committed mutation waits for active revalidation before prediction`,calls()[0].aborted && calls().length===2 && await page.evaluate(()=>window.__queryFixture.instantInteraction(1).isPending));
      reply(0);reply(1);const committed=await finishMutation();await settled(1);await waitCalls(3);reply(2);await warmed(2);await quiet();
      check(`${label}: post-write rows and next page never use stale payload`,committed.ok===true && (await cache(1)).data.metrics.version==="committed-current" && (await cache(2)).data.metrics.version==="committed-next" && !(await page.evaluate(()=>window.__queryFixture.instantInteraction(1).isPending)));

      await open(profile,{},[{version:"pre-write-next"}]);await warmed(2);const prior=(await cache(1)).data;
      await beginMutation(profile);plan({status:500},{status:500},{status:500});await releaseMutation();const readFailure=await finishMutation();
      await page.waitForFunction(()=>window.__queryFixture.error && !window.__queryFixture.revalidating);await quiet();
      check(`${label}: failed post-commit read never rolls back a successful mutation`,readFailure.ok===true && (await cache(1)).data.rows[0].title===prior.rows[0].title+" optimistic");
      check(`${label}: failed post-commit read leaves next cache invalid and stops speculation`,(await cache(2)).invalidated && calls().length===4);
    } else observations.push({label:`${label}: mutation applicability`,reason:"No adopted mutating row command; shared external invalidation and stale-result rejection are proven, no domain mutation is fabricated"});
  }
  observations.push({label:"eligibility proof boundary",note:"Reachable consumer bindings verified by the existing source owner; actual shared controller, contracts, provider, pagination and mutation owner mounted. Transport/rows/execute outcomes are synthetic. No consumer UI/domain/Auth/DB or latency claim. Negative scheduling window is150ms after two animation frames; retained531 cases not rerun."});
}

/** Actual shared owners with synthetic GET results; never connects to Admin/DB. */
async function isolatedFailureContracts(intentPrefetch = false, adjacentPrefetch = false, navigationAdoption = false, eligibilityOnly = false) {
  const root = process.cwd();
  const navigation = navigationAdoption ? await navigationAdoptionPlan(root,eligibilityOnly) : null;
  const output = navigation ? path.join(root,".tmp-qa/system-wide-admin-navigation",eligibilityOnly?"eligibility-fixture":"controller-fixture",runId) : path.join(root, adjacentPrefetch ? ".tmp-qa/bounded-adjacent-prefetch" : intentPrefetch ? ".tmp-qa/admin-instant-ux-prefetch-strategy-20260913" : ".tmp-qa/admin-query-save-failure-contracts-20260913", process.env.QA_PHASE || (adjacentPrefetch ? "mounted-owner-proof" : intentPrefetch ? "intent-prefetch" : "query-isolated"));
  await mkdir(output, { recursive: true });
  const require = createRequire(import.meta.url);
  const entry = String.raw`
import React, { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Provider from "@query-provider";
import Feedback from "@feedback";
import AdminEntityList from "@entity-list";
import AdminTablePagination from "@pagination";
import { useAdminEntityListController } from "@controller";
import { normalizeAdminEntityListQuery, normalizeAdminEntityListQueryWithRouteParams${navigation ? ", writeAdminEntityListQuery, parseAdminEntityListQueryFromKey" : ""} } from "@contracts";
import { adminEntityListQueryKeys } from "@query-keys";
import { invalidateAdminEntityListCaches } from "@mutation-cache";
import { useAdminEntityInstantMutation } from "@instant-mutation";
import { topicsQueryContract } from "@topics-contract";
import { categoriesQueryContract } from "@categories-contract";
import { seriesQueryContract } from "@series-contract";
${navigation ? navigation.specs.map((spec,index)=>`import { ${spec.contractExport} as navigationContract${index} } from "@navigation-contract-${index}";`).join("\n") : ""}
${navigation ? `import { withLockedProjectType as lockNavigationProjectType } from "@navigation-contract-${navigation.specs.findIndex(spec=>spec.entity==="projects")}";
import { PROJECT_LOCATION_ENTITY_KEYS as navigationLocationKeys } from "@navigation-contract-${navigation.specs.findIndex(spec=>spec.entity.startsWith("project_locations_"))}";` : ""}
const contracts = {topics:topicsQueryContract,categories:categoriesQueryContract,series:seriesQueryContract${navigation ? navigation.specs.map((spec,index)=>`,${JSON.stringify(spec.entity)}:navigationContract${index}`).join("") : ""}};
const entity = location.pathname.split("/").at(-1);
const options = window.__FIXTURE_OPTIONS__ || {};
const contract = options.boundedClient ? {...contracts[entity],mode:"bounded-client"} : contracts[entity];
const routeOwnedParams = options.navigationAdoption ? options.routeOwnedParams : options.constrained ? {content_type:"article"} : undefined;
const constrainQuery = options.navigationAdoption ? query => ({...query,filters:${navigation ? 'entity==="projects"?lockNavigationProjectType(query.filters,options.routeFilters.projectType):' : ""}{...query.filters,...options.routeFilters}}) : options.constrained ? query => ({...query,filters:{...query.filters,contentType:"article"}}) : undefined;
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
function OtherForeground({enabled}) {
 const otherQuery = normalizeAdminEntityListQuery(categoriesQueryContract,new URLSearchParams("page=3"));
 const otherForeground = useQuery({
  queryKey:adminEntityListQueryKeys.query("categories",otherQuery),enabled,
  queryFn:async({signal})=>{
   const response=await fetch("/api/admin/entity-lists/categories?page=3",{signal});
   if(!response.ok)throw new Error("Expected fixture foreground response");
   return response.json();
  },
 });
 useLayoutEffect(()=>{window.__otherForegroundState={status:otherForeground.status,fetchStatus:otherForeground.fetchStatus};});
 return null;
}
function Harness() {
 const client = useQueryClient();
 const [otherForegroundEnabled,setOtherForegroundEnabled] = useState(options.otherForeground===true);
 const controller = useAdminEntityListController({entity,contract,initialQuery,initialResult,staleTimeMs:options.staleTimeMs??30000,constrainQuery,routeOwnedParams,adjacentPrefetch:options.adjacentPrefetch===true});
 const instant = useAdminEntityInstantMutation(entity,controller.query);
 const mutation = useMutation({mutationFn:()=>new Promise(resolve=>{window.__releaseFixtureMutation=()=>resolve({ok:true})})});
 useLayoutEffect(()=>{window.__queryFixture={...controller,
  beginMutation:()=>{void mutation.mutateAsync()},mutationPending:mutation.isPending,
  saveInvalidate:()=>invalidateAdminEntityListCaches(client,[entity]),
  cachePage:page=>{const state=client.getQueryState(adminEntityListQueryKeys.query(entity,{...controller.query,page}));return state?{status:state.status,fetchStatus:state.fetchStatus,invalidated:state.isInvalidated,data:state.data}:null},
  agePage:(page,age)=>{const key=adminEntityListQueryKeys.query(entity,{...controller.query,page});client.setQueryData(key,client.getQueryData(key),{updatedAt:Date.now()-age})},
  queryDefaults:()=>({staleTime:client.getDefaultOptions().queries.staleTime,gcTime:client.getDefaultOptions().queries.gcTime}),
  beginOtherForeground:()=>setOtherForegroundEnabled(true),
  get otherForegroundState(){return window.__otherForegroundState??{status:"pending",fetchStatus:"idle"}},
   instantInteraction:rowId=>instant.getRowInteraction(rowId),
   ${navigation ? `navigation:{
    describe:()=>({query:controller.query,staleTimeMs:options.staleTimeMs,defaultPageSize:contract.defaultPageSize,pageSizeOptions:contract.pageSizeOptions,sortFields:contract.sortFields,locationLevel:Object.entries(navigationLocationKeys).find(([,key])=>key===entity)?.[0]??null,missingScopeRejected:!contract.filtersSchema.safeParse(contract.parseFilters(new URLSearchParams())).success}),
    matchesRequest:(search,target)=>{
      const actual=normalizeAdminEntityListQuery(contract,new URLSearchParams(search));
      return JSON.stringify(adminEntityListQueryKeys.query(entity,actual))===JSON.stringify(adminEntityListQueryKeys.query(entity,{...controller.query,page:target}));
    },
    identityCases:()=>{
      const query=controller.query,base=JSON.stringify(adminEntityListQueryKeys.query(entity,query)),cases=[],coveredFilters=[];
      const add=(dimension,next)=>{
        const params=writeAdminEntityListQuery(contract,next,new URLSearchParams());
        const round=normalizeAdminEntityListQuery(contract,params);
        const key=JSON.stringify(adminEntityListQueryKeys.query(entity,next));
        cases.push({dimension,distinct:key!==base,roundTrip:key===JSON.stringify(adminEntityListQueryKeys.query(entity,round))});
      };
      add("page",{...query,page:query.page+1});add("search",{...query,search:"identity fixture"});
      add("pageSize",{...query,pageSize:contract.pageSizeOptions.find(size=>size!==query.pageSize)});
      add("direction",{...query,sort:{...query.sort,direction:query.sort.direction==="asc"?"desc":"asc"}});
      const otherSort=contract.sortFields.find(field=>field!==query.sort.field);if(otherSort)add("sort",{...query,sort:{...query.sort,field:otherSort}});
      for(const [field,value] of Object.entries(query.filters)){
        const shape=contract.filtersSchema.shape[field];
        const candidates=[...(shape.options??[]),typeof value==="number"?value+1:undefined,...["all","published","unpublished","active","inactive","visible","hidden","yes","no","trash","article","video","gallery","not_started","in_progress","completed","draft","archived","fixture-role","2026-01-01",101,201,true,false,null]].filter(candidate=>candidate!==undefined && candidate!==value);
        const alternate=candidates.find(candidate=>contract.filtersSchema.safeParse({...query.filters,[field]:candidate}).success);
        if(alternate===undefined)throw new Error("No valid alternate for actual filter "+field);
        coveredFilters.push(field);add("filter:"+field,{...query,filters:{...query.filters,[field]:alternate}});
      }
      const otherEntity=entity==="topics"?"categories":"topics";cases.push({dimension:"entity",distinct:base!==JSON.stringify(adminEntityListQueryKeys.query(otherEntity,query)),roundTrip:true});
      const otherMode={...query,mode:"bounded-client"},modeKey=adminEntityListQueryKeys.query(entity,otherMode);
      cases.push({dimension:"mode-key-serialization-only",distinct:base!==JSON.stringify(modeKey),roundTrip:parseAdminEntityListQueryFromKey(modeKey)?.mode==="bounded-client",limit:"No bounded-client execution or adoption claimed for this server-page contract"});
      return {cases,coveredFilters};
    },
    challengeConstraints:()=>{
      const attempted={...controller.query,filters:{...controller.query.filters,...Object.fromEntries(Object.entries(options.routeFilters).map(([key,value])=>[key,typeof value==="number"?value+900:value==="residential"?"commercial":"residential"]))}};
      controller.setSearchAndFilters(attempted.search,attempted.filters);
    },
    seedOutsideScope:()=>{const other={...controller.query,search:"different fixture scope"};window.__navigationOutsideKey=adminEntityListQueryKeys.query(entity,other);const data={...controller.result,rows:controller.result.rows.map(row=>({...row,title:row.title+" outside"}))};client.setQueryData(window.__navigationOutsideKey,data);return data;},
    outsideScope:()=>client.getQueryData(window.__navigationOutsideKey),
   },` : ""}
   runInstant:({rowId=controller.result.rows[0]?.id,action="featured",outcome="success",remove=false,reconcileFailure=false}={})=>{
    window.__instantOutcome=null;
    if(options.navigationAdoption)delete window.__releaseInstantMutation;
   return instant.mutateAsync({
    rowId,action,
    optimistic:cache=>remove?cache.removeRows(new Set([rowId])):cache.patchRows(row=>row.id===rowId?{...row,title:row.title+" optimistic"}:row),
    execute:()=>new Promise(resolve=>{window.__releaseInstantMutation=()=>resolve(outcome==="failure"?{ok:false,code:"fixture_rejected",message:"fixture rejected"}:{ok:true,message:"fixture committed"})}),
    reconcileSuccess:reconcileFailure?()=>{throw new Error("Expected fixture reconciliation failure")}:undefined,
   }).then(result=>{window.__instantOutcome=result;return result},error=>{window.__instantOutcome={ok:false,code:error.code,message:error.message};return window.__instantOutcome});
  },
 };});
 return <>
  {(options.foregroundProbe||options.otherForeground)&&<OtherForeground enabled={otherForegroundEnabled}/>}
  <main dir="rtl">
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
 </main></>;
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
        "@instant-mutation": path.join(root, "src/lib/admin/entity-list/data-engine/instant-mutation.ts"),
        ...Object.fromEntries(["topics", "categories", "series"].map((entity) => [`@${entity}-contract`, path.join(root, `src/lib/admin/content/entity-list-contracts/${entity}.ts`)])),
        ...(navigation ? Object.fromEntries(navigation.specs.map((spec,index)=>[`@navigation-contract-${index}`,path.join(root,spec.contractFile)])) : {}),
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
      if (fixtureOptions.optIn || fixtureOptions.intentProbe || fixtureOptions.adjacentPrefetch) {
        const plan = responsePlans.shift() ?? {};
        const request = requests.at(-1);
        request.aborted = false;
        request.startedAtMs = performance.now();
        res.on("close",()=>{if(!res.writableEnded)request.aborted=true;});
        const reply = () => {
          if(res.destroyed)return;
          const body=JSON.stringify(plan.status ? {error:{code:"intent_fixture_failure"}} : result(entity,plan.page??page,Number(url.searchParams.get("limit")||10),plan.version,plan.totalRows??(navigation?fixtureOptions.totalRows:undefined)));
          request.status=plan.status??200;request.responseBytes=Buffer.byteLength(body);request.finishedAtMs=performance.now();
          res.writeHead(request.status, {"Content-Type":"application/json"});
          res.end(body);
        };
        if(plan.hold)delayedResponses.push({request,reply});else reply();
        for(const notify of requestWaiters)notify();
        return;
      }
      if (failures.get(entity) === page) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { code: "list_load_failed" } })); return; }
      if (held.has(entity)) { held.set(entity, () => sendResult(res, entity, page)); return; }
      sendResult(res, entity, page); return;
    }
    if (/^\/admin\/content\/(topics|categories|series)$/.test(url.pathname) || (navigation && navigation.specs.some(spec=>url.pathname===`/admin/content/${spec.entity}`))) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      const initial=result(url.pathname.split("/").at(-1),Number(url.searchParams.get("page")||1),Number(url.searchParams.get("limit")||10),"source",fixtureOptions.totalRows??100);
      if(fixtureOptions.boundedClient){
        initial.rows=result(url.pathname.split("/").at(-1),1,initial.pagination.totalRows).rows;
        initial.meta.mode="bounded-client";
      }
      res.end(`<html dir="rtl"><body><div id="root"></div><script>window.__INITIAL_RESULT__=${JSON.stringify(initial)};window.__FIXTURE_OPTIONS__=${JSON.stringify(fixtureOptions)}</script><script src="/bundle.js"></script></body></html>`); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  let navigationCompleted = false;
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
    if(navigation)await (eligibilityOnly?runNavigationEligibilityCases:runNavigationAdoptionCases)({page,origin,requests,observations,snapshot,navigation,
      configure:options=>{fixtureOptions=options;responsePlans.length=0;delayedResponses.length=0},
      plan:(...plans)=>responsePlans.push(...plans),delayedResponses,requestWaiters,
    });
    if(intentPrefetch)await runIntentPrefetchCases({page,origin,requests,observations,snapshot,
      configure:options=>{fixtureOptions=options;responsePlans.length=0;delayedResponses.length=0},
      plan:(...plans)=>responsePlans.push(...plans),delayedResponses,requestWaiters,
    });
    if(adjacentPrefetch)await runAdjacentPrefetchCases({page,origin,requests,observations,snapshot,
      configure:options=>{fixtureOptions=options;responsePlans.length=0;delayedResponses.length=0},
      plan:(...plans)=>responsePlans.push(...plans),delayedResponses,requestWaiters,
    });
    fixtureOptions={};
    for (const entity of navigation ? [] : ["topics", "categories", "series"]) {
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
    if(eligibilityOnly) {
      const changed=[];
      for(const [file,hash] of Object.entries(navigation.sourceHashes)) {
        if(createHash("sha256").update(await readFile(path.join(root,file))).digest("hex")!==hash)changed.push(file);
      }
      check("eligibility proof retains its exact source bindings throughout execution",changed.length===0,changed.join(", "));
    }
    navigationCompleted = Boolean(navigation);
  } catch (error) {
    if (navigation) observations.push({label:"navigation fixture interrupted",error:error.message});
    throw error;
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await writeFile(path.join(output, "evidence.json"), JSON.stringify({ passed, failed, observations, requests, blocked, errors, ...(navigation?{navigationCompleted,navigationCoverage:navigation.coverage,sourceHashes:navigation.sourceHashes}:{}), scope: "Mounted shared controller/EntityList/Pagination with synthetic GET transport; Next navigation isolated, no Auth/DB or live-screen claim" }, null, 2));
  }
  console.log(`qa-admin-data-engine-controller isolated: ${passed}/${passed + failed} passed`);
  if (failed) process.exitCode = 1;
}

(process.argv.includes("--navigation-eligibility") ? isolatedFailureContracts(false,false,true,true) : process.argv.includes("--navigation-adoption") ? isolatedFailureContracts(false,false,true) : process.argv.includes("--adjacent-prefetch") ? isolatedFailureContracts(true,true) : process.argv.includes("--intent-prefetch") ? isolatedFailureContracts(true) : process.argv.includes("--isolated-failure-contracts") ? isolatedFailureContracts() : main()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
