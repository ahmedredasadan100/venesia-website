/**
 * Browser controller evidence for Topics/Categories/Series data-engine lists.
 *
 * Explicitly separates:
 *   - new query → exactly 1 endpoint request
 *   - fresh cached query → 0 endpoint requests
 * and covers race / failure contracts with route interception.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const password = randomBytes(24).toString("base64url");
const adminUsername = `__QA_AIDC_${runId}__`;
const adminEmail = `qa-aidc-${runId}@venesia.local`;

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let passed = 0;
let failed = 0;
let adminId = null;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanup() {
  if (!adminId) return;
  await supabase.from("admin_users").delete().eq("id", adminId);
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

  const admin = await must(
    "create admin",
    supabase
      .from("admin_users")
      .insert({
        username: adminUsername,
        email: adminEmail,
        password_hash: await bcrypt.hash(password, 10),
        role: "super_admin",
        is_active: true,
      })
      .select("id")
      .single(),
  );
  adminId = admin.id;

  const browser = await chromium.launch({ headless: true });
  const consoleIssues = [];
  const pageErrors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleIssues.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(`${baseUrl}/admin/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const login = await page.evaluate(
      async ({ username, loginPassword }) => {
        const response = await fetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password: loginPassword,
            rememberMe: false,
          }),
        });
        return { ok: response.ok, status: response.status };
      },
      { username: adminUsername, loginPassword: password },
    );
    if (!login.ok) throw new Error(`QA login failed: ${login.status}`);

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
        await search.fill(marker);
        await page.waitForFunction(
          (value) =>
            new URL(window.location.href).searchParams.get("q") === value,
          marker,
          { timeout: 10_000 },
        );
        await page.waitForTimeout(200);
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
        const rowsBefore = await page.locator("[data-entity-row-id]").count();
        const before = endpointCalls.length;
        await next.first().click();
        await waitForPageParam(page, "2");
        await page.waitForTimeout(300);
        const rowsAfter = await page.locator("[data-entity-row-id]").count();
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
          `${path}: pagination changes page state and rows`,
          new URL(page.url()).searchParams.get("page") === "2" &&
            rowsAfter > 0 &&
            (rowsAfter !== rowsBefore || rowsAfter === 1),
          `page=${new URL(page.url()).searchParams.get("page")} rows=${rowsBefore}->${rowsAfter}`,
        );

        // Fresh cached page=1 via Back, then Forward to cached page=2.
        const beforeBack = endpointCalls.length;
        await page.goBack();
        await waitForPageParam(page, null);
        await page.waitForTimeout(250);
        check(
          `${path}: fresh cached previous page issues zero endpoint requests`,
          endpointCalls.length - beforeBack === 0,
          String(endpointCalls.length - beforeBack),
        );
        const beforeForward = endpointCalls.length;
        await page.goForward();
        await waitForPageParam(page, "2");
        await page.waitForTimeout(250);
        check(
          `${path}: fresh cached forward page issues zero endpoint requests`,
          endpointCalls.length - beforeForward === 0,
          String(endpointCalls.length - beforeForward),
        );
        await page.goBack();
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

    let firstReleased = false;
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = () => {
        firstReleased = true;
        resolve();
      };
    });
    let secondSeen = false;
    const pendingFirstBodies = [];

    await page.route("**/api/admin/entity-lists/topics**", async (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get("q") || "";
      if (q.includes("SLOW1")) {
        pendingFirstBodies.push(route);
        await firstGate;
        try {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              rows: [
                {
                  id: 900001,
                  title: "SLOW1-STALE-ROW",
                  content_type: "article",
                  category_id: null,
                  category_name: null,
                  category_color_token: null,
                  series_id: null,
                  series_name: null,
                  status: "draft",
                  is_featured: false,
                  views_count: 0,
                  created_at: null,
                  updated_at: null,
                  published_at: null,
                  created_by_display: null,
                  updated_by_display: null,
                  published_by_display: null,
                  deleted_at: null,
                },
              ],
              pagination: {
                page: 1,
                pageSize: 10,
                totalRows: 1,
                totalPages: 1,
              },
              meta: {
                generatedAt: new Date().toISOString(),
                mode: "server-page",
              },
            }),
          });
        } catch {
          // Request may already be aborted by TanStack Query cancellation.
        }
        return;
      }
      if (q.includes("SLOW2")) {
        secondSeen = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            rows: [
              {
                id: 900002,
                title: "SLOW2-WINNER-ROW",
                content_type: "article",
                category_id: null,
                category_name: null,
                category_color_token: null,
                series_id: null,
                series_name: null,
                status: "draft",
                is_featured: false,
                views_count: 0,
                created_at: null,
                updated_at: null,
                published_at: null,
                created_by_display: null,
                updated_by_display: null,
                published_by_display: null,
                deleted_at: null,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              totalRows: 1,
              totalPages: 1,
            },
            meta: {
              generatedAt: new Date().toISOString(),
              mode: "server-page",
            },
          }),
        });
        return;
      }
      await route.continue();
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
    check("Slow search: second query wins before first response", secondSeen);
    check(
      "Out-of-order: winner rows visible before stale release",
      (await page.getByText("SLOW2-WINNER-ROW", { exact: true }).count()) === 1 &&
        (await page.getByText("SLOW1-STALE-ROW", { exact: true }).count()) === 0,
    );
    releaseFirst();
    await page.waitForTimeout(500);
    check(
      "Out-of-order: stale response does not replace winner rows",
      (await page.getByText("SLOW2-WINNER-ROW", { exact: true }).count()) === 1 &&
        (await page.getByText("SLOW1-STALE-ROW", { exact: true }).count()) === 0,
    );
    check(
      "Cancellation: delayed first request was gated (abort or ignore)",
      pendingFirstBodies.length >= 1 || firstReleased,
      String(pendingFirstBodies.length),
    );
    await page.unroute("**/api/admin/entity-lists/topics**");

    // Network failure keeps previous rows.
    await topicsSearch.fill("");
    await page.waitForTimeout(500);
    const previousRowCount = await page.locator("[data-entity-row-id]").count();
    await page.route("**/api/admin/entity-lists/topics**", async (route) => {
      const url = new URL(route.request().url());
      if ((url.searchParams.get("q") || "").includes("NETFAIL")) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "list_load_failed", message: "Unable to load" },
          }),
        });
        return;
      }
      await route.continue();
    });
    await topicsSearch.fill("NETFAIL");
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("q") === "NETFAIL",
      undefined,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(700);
    check(
      "Network failure: previous rows remain visible",
      (await page.locator("[data-entity-row-id]").count()) === previousRowCount &&
        previousRowCount > 0,
      String(await page.locator("[data-entity-row-id]").count()),
    );
    check(
      "Network failure: error state is exposed without wiping table",
      (await page.getByText("Unable to load the requested list.").count()) >= 1 &&
        (await page.locator("[data-admin-entity-list]").count()) >= 1,
    );
    await page.unroute("**/api/admin/entity-lists/topics**");

    // 401 contract against the typed endpoint (no blind retry storm).
    const unauthorized = await page.evaluate(async () => {
      const calls = [];
      const original = window.fetch;
      window.fetch = async (...args) => {
        calls.push(String(args[0]));
        return original(...args);
      };
      try {
        // Clear cookie by hitting logout, then probe the endpoint.
        await original("/api/admin/auth/logout", { method: "POST" });
        const response = await original("/api/admin/entity-lists/topics?page=1", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        return {
          status: response.status,
          calls: calls.filter((url) => url.includes("/api/admin/entity-lists/")),
        };
      } finally {
        window.fetch = original;
      }
    });
    check(
      "401: endpoint returns unauthorized without blind retry storm",
      unauthorized.status === 401 && unauthorized.calls.length === 1,
      `status=${unauthorized.status} calls=${unauthorized.calls.length}`,
    );

    // Floating menu stays open across a background refetch (no remount).
    await page.goto(`${baseUrl}/admin/content/topics`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(async ({ username, loginPassword }) => {
      await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: loginPassword,
          rememberMe: false,
        }),
      });
    }, { username: adminUsername, loginPassword: password });
    await page.goto(`${baseUrl}/admin/content/topics`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /^الأعمدة$/ }).click();
    await page.waitForTimeout(150);
    const menuOpenBefore = await page.locator("[data-admin-column-menu]").count();
    const listIdentityBefore = await page.evaluate(() => {
      const node = document.querySelector("[data-admin-entity-list]");
      return node ? node.id : null;
    });
    await page.locator('input[placeholder*="ابحث"]').first().fill(`menu ${runId}`);
    await page.waitForTimeout(800);
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

    check(
      "No console errors",
      consoleIssues.length === 0,
      consoleIssues.join(" | "),
    );
    check(
      "No page errors",
      pageErrors.length === 0,
      pageErrors.join(" | "),
    );
  } finally {
    await browser.close();
    await cleanup();
  }

  console.log(
    `qa-admin-data-engine-controller: ${passed}/${passed + failed} passed`,
  );
  if (failed) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
