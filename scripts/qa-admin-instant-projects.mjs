/**
 * Browser acceptance for the residential/commercial instant projects lists.
 * Run against one server at http://localhost:3000 (dev or production-like).
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const baseUrl = process.env.ADMIN_PROJECTS_QA_BASE_URL || "http://localhost:3000";
const outputDir = process.env.ADMIN_PROJECTS_QA_OUTPUT_DIR || "";
const routeDelayMs = Number(process.env.ADMIN_PROJECTS_QA_DELAY_MS ?? "250");
const qaTarget = process.env.ADMIN_PROJECTS_QA_TARGET || "full";
const runId = Date.now().toString(36);
const adminUsername = `__QA_PROJECTS_${runId}__`;
const adminEmail = `qa-projects-${runId}@venesia.local`;
const password = randomBytes(24).toString("base64url");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(root, ".env.local"));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const checks = [];
const browserIssues = [];
const measurements = [];
let adminId = null;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function cleanup() {
  if (!adminId) return;
  await supabase.from("admin_user_preferences").delete().eq("admin_user_id", adminId);
  await supabase.from("admin_audit_logs").delete().eq("actor_admin_user_id", adminId);
  await supabase.from("admin_users").delete().eq("id", adminId);
}

async function login(page) {
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const result = await page.evaluate(
    async ({ username, loginPassword }) => {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password: loginPassword, rememberMe: false }),
      });
      return { ok: response.ok, status: response.status };
    },
    { username: adminUsername, loginPassword: password },
  );
  if (!result.ok) throw new Error(`QA login failed: ${result.status}`);
}

async function readStoredColumns(viewKey) {
  const { data, error } = await supabase
    .from("admin_user_preferences")
    .select("preferences")
    .eq("admin_user_id", adminId)
    .eq("view_key", viewKey)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.preferences?.visibleColumns)
    ? data.preferences.visibleColumns
    : null;
}

async function waitForStoredColumns(viewKey, expected, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const columns = await readStoredColumns(viewKey);
    if (JSON.stringify(columns) === JSON.stringify(expected)) return columns;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${viewKey}: ${JSON.stringify(await readStoredColumns(viewKey))}`);
}

async function waitForListIdle(page) {
  const rootLocator = page.locator('[data-admin-entity-list-consumer="projects"]');
  await rootLocator.waitFor({ timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-admin-entity-list-consumer="projects"]')?.getAttribute("data-admin-entity-list-pending") === "false",
    undefined,
    { timeout: 30_000 },
  );
  return rootLocator;
}

async function directBackendTimings(type, viewKey) {
  const rpcStarted = performance.now();
  const { error: rpcError } = await supabase.rpc("admin_list_projects", {
    p_page: 1,
    p_page_size: 10,
    p_sort_field: "homepage_order",
    p_sort_direction: "asc",
    p_project_type: type,
    p_search: "",
    p_publication_status: "all",
    p_implementation_status: "all",
    p_featured: "all",
    p_list_mode: "all",
  });
  const rpcMs = performance.now() - rpcStarted;
  if (rpcError) throw rpcError;

  const preferencesStarted = performance.now();
  const { error: preferencesError } = await supabase
    .from("admin_user_preferences")
    .select("preferences")
    .eq("admin_user_id", adminId)
    .eq("view_key", viewKey)
    .maybeSingle();
  const preferencesMs = performance.now() - preferencesStarted;
  if (preferencesError) throw preferencesError;
  return { rpcMs, preferencesMs };
}

async function assertLayout(page, type, viewportName) {
  const region = page.locator('[data-admin-data-grid-scroll]');
  const row = region.locator("article").first();
  const actions = row.locator('[data-admin-grid-actions="sticky"]');
  const actionsHeader = region.locator('[data-admin-grid-actions-header="sticky"]');
  await region.waitFor();
  if (viewportName !== "wide") {
    await region.evaluate((element) => {
      element.scrollLeft = -element.scrollWidth;
    });
  }
  const regionBox = await region.boundingBox();
  const actionBox = await actions.boundingBox();
  const actionHeaderBox = await actionsHeader.boundingBox();
  const buttonBoxes = await actions.locator("a, button").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    }),
  );
  const actionsVisible = Boolean(
    regionBox &&
      actionBox &&
      actionBox.x >= regionBox.x - 1 &&
      actionBox.x + actionBox.width <= regionBox.x + regionBox.width + 1 &&
      buttonBoxes.every((box) => box.left >= actionBox.x - 1 && box.right <= actionBox.x + actionBox.width + 1),
  );
  check(`${type} ${viewportName}: actions are not clipped`, actionsVisible, JSON.stringify({ regionBox, actionBox, buttonBoxes }));
  check(
    `${type} ${viewportName}: actions stay at the visual far left in RTL`,
    Boolean(regionBox && actionBox && Math.abs(actionBox.x - regionBox.x) <= 2),
    JSON.stringify({ regionBox, actionBox }),
  );
  check(
    `${type} ${viewportName}: actions header aligns with rows`,
    Boolean(actionBox && actionHeaderBox && Math.abs(actionHeaderBox.x - actionBox.x) <= 2 && Math.abs(actionHeaderBox.width - actionBox.width) <= 2),
    JSON.stringify({ actionHeaderBox, actionBox }),
  );
  check(`${type} ${viewportName}: table header remains visible`, await region.locator("[class*='border-b']").first().isVisible());

  if (viewportName === "wide") {
    const actionContracts = await actions.locator("a, button").evaluateAll((elements) =>
      elements.map((element) => ({
        label: element.getAttribute("aria-label") || element.getAttribute("title") || "",
        className: element.className,
      })),
    );
    const expectedToneClasses = type === "residential"
      ? [
          "bg-[#D8B87A]/10",
          "bg-white/[0.075]",
          "bg-emerald-500/14",
          "bg-sky-500/10",
          "bg-white/[0.075]",
          "bg-red-500/85",
        ]
      : [
          "bg-[#D8B87A]/10",
          "bg-emerald-500/14",
          "bg-white/[0.075]",
          "bg-red-500/85",
        ];
    check(
      `${type}: row actions use shared action tone contracts`,
      actionContracts.length === expectedToneClasses.length &&
        expectedToneClasses.every((token, index) => actionContracts[index]?.className.includes(token)),
      JSON.stringify(actionContracts),
    );
    check(
      `${type}: legacy in-grid project summary is absent`,
      (await page.getByText(/\d+ مشروع — \d+ منشور/).count()) === 0,
    );
  }

  if (viewportName !== "wide") {
    const scrollPositions = await region.evaluate((element) => {
      element.scrollLeft = 0;
      const origin = element.scrollLeft;
      element.scrollLeft = -element.scrollWidth;
      const negative = element.scrollLeft;
      element.scrollLeft = element.scrollWidth;
      const positive = element.scrollLeft;
      return { origin, negative, positive, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
    });
    check(
      `${type} ${viewportName}: RTL horizontal content is reachable`,
      scrollPositions.scrollWidth <= scrollPositions.clientWidth || scrollPositions.negative !== scrollPositions.origin || scrollPositions.positive !== scrollPositions.origin,
      JSON.stringify(scrollPositions),
    );
    await region.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
}

async function assertBulkBar(page, type, viewportName) {
  const rowCheckbox = page.locator('[data-admin-data-grid-scroll] article input[type="checkbox"]').first();
  await rowCheckbox.check();
  const bar = page.locator('[data-admin-bulk-action-bar]');
  await bar.waitFor();
  const visual = await bar.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      width: box.width,
      flexDirection: getComputedStyle(element).flexDirection,
    };
  });
  check(`${type} ${viewportName}: bulk bar appears after selection`, await bar.isVisible());
  check(
    `${type} ${viewportName}: bulk bar remains within the page width`,
    visual.left >= 0 && visual.right <= (await page.evaluate(() => document.documentElement.clientWidth)) + 1,
    JSON.stringify(visual),
  );
  check(
    `${type} ${viewportName}: bulk bar uses shared responsive layout`,
    viewportName === "mobile" ? visual.flexDirection === "column" : visual.flexDirection === "row",
    JSON.stringify(visual),
  );
  await bar.getByRole("button", { name: "إلغاء التحديد", exact: true }).click();
  await bar.waitFor({ state: "detached" });
  check(`${type} ${viewportName}: clearing selection hides bulk bar`, (await bar.count()) === 0);
}

async function assertActionFeedback(page, type) {
  const row = page.locator('[data-admin-data-grid-scroll] article').first();
  const hideLabel = type === "residential" ? "إخفاء من الموقع" : "إخفاء";
  const publishLabel = type === "residential" ? "نشر في الموقع" : "نشر";
  const initialToggle = row.locator(`button[aria-label="${hideLabel}"], button[aria-label="${publishLabel}"]`).first();
  const initialLabel = await initialToggle.getAttribute("aria-label");
  await initialToggle.click();
  await waitForListIdle(page);

  const notice = page.locator('[data-admin-notice-layout="inline"]');
  await notice.waitFor();
  check(`${type}: action notice uses shared inline layout`, await notice.isVisible());
  const dismiss = notice.getByRole("button", { name: "إغلاق الإشعار", exact: true });
  check(`${type}: action notice exposes dismiss button`, (await dismiss.count()) === 1);
  await dismiss.click();
  await notice.waitFor({ state: "detached" });
  check(`${type}: action notice dismiss button works`, (await notice.count()) === 0);

  const reverseLabel = initialLabel === hideLabel ? publishLabel : hideLabel;
  const reverseToggle = row.locator(`button[aria-label="${reverseLabel}"]`).first();
  await reverseToggle.click();
  await waitForListIdle(page);
  const restoredNotice = page.locator('[data-admin-notice-layout="inline"]');
  await restoredNotice.waitFor();
  check(`${type}: reverse visibility action restores the original state`, await restoredNotice.isVisible());
  await restoredNotice.getByRole("button", { name: "إغلاق الإشعار", exact: true }).click();
}

async function assertBulkExecution(page, type) {
  const hideLabel = type === "residential" ? "إخفاء من الموقع" : "إخفاء";
  const publishedRow = page.locator('[data-admin-data-grid-scroll] article', {
    has: page.locator(`button[aria-label="${hideLabel}"]`),
  }).first();
  const rowCheckbox = publishedRow.locator('input[type="checkbox"]');
  await rowCheckbox.check();
  const bar = page.locator('[data-admin-bulk-action-bar]');
  await bar.waitFor();
  await bar.getByRole("button", { name: "تنفيذ", exact: true }).click();
  await waitForListIdle(page);
  await bar.waitFor({ state: "detached" });
  check(`${type}: bulk action executes and clears selection`, (await bar.count()) === 0);
  const notice = page.locator('[data-admin-notice-layout="inline"]');
  await notice.waitFor();
  check(`${type}: bulk action reports through shared notice`, await notice.isVisible());
  await notice.getByRole("button", { name: "إغلاق الإشعار", exact: true }).click();
}

async function assertArchiveRestore(page, type) {
  const hideLabel = type === "residential" ? "إخفاء من الموقع" : "إخفاء";
  const publishedRow = page.locator('[data-admin-data-grid-scroll] article', {
    has: page.locator(`button[aria-label="${hideLabel}"]`),
  }).first();
  const editHref = await publishedRow.locator('a[href^="/admin/projects/"]').first().getAttribute("href");
  if (!editHref) throw new Error(`${type}: published project row has no edit href`);

  await publishedRow.getByRole("button", { name: "أرشفة المشروع", exact: true }).click();
  await waitForListIdle(page);
  const archivedRow = page.locator('[data-admin-data-grid-scroll] article', {
    has: page.locator(`a[href="${editHref}"]`),
  });
  await archivedRow.getByRole("button", { name: "استعادة كمسودة", exact: true }).click();
  await waitForListIdle(page);
  const restoredRow = page.locator('[data-admin-data-grid-scroll] article', {
    has: page.locator(`a[href="${editHref}"]`),
  });
  await restoredRow.getByRole("button", {
    name: type === "residential" ? "نشر في الموقع" : "نشر",
    exact: true,
  }).click();
  await waitForListIdle(page);
  check(`${type}: archive and restore actions complete`, true);
  const notice = page.locator('[data-admin-notice-layout="inline"]');
  await notice.waitFor();
  await notice.getByRole("button", { name: "إغلاق الإشعار", exact: true }).click();
}

async function measureInteraction(page, network, label, action, { expectOldRows = false, allowCacheHit = false } = {}) {
  const listBefore = network.listRequests;
  const documentsBefore = network.documentRequests;
  const durationsBefore = network.listDurations.length;
  const rowsBefore = await page.locator('[data-admin-data-grid-scroll] article').count();
  const started = performance.now();
  await action();
  if (expectOldRows) {
    await page.waitForFunction(
      () => document.querySelector('[data-admin-entity-list-consumer="projects"]')?.getAttribute("data-admin-entity-list-pending") === "true",
      undefined,
      { timeout: 10_000 },
    );
    check(`${label}: old rows remain during pending`, (await page.locator('[data-admin-data-grid-scroll] article').count()) === rowsBefore);
  }
  await waitForListIdle(page);
  const durationMs = performance.now() - started;
  const requestDelta = network.listRequests - listBefore;
  const documentDelta = network.documentRequests - documentsBefore;
  const networkMs = network.listDurations.slice(durationsBefore).at(-1) ?? null;
  check(
    `${label}: no duplicate list requests`,
    allowCacheHit ? requestDelta <= 1 : requestDelta === 1,
    `requests=${requestDelta}${allowCacheHit && requestDelta === 0 ? " (cache hit)" : ""}`,
  );
  check(`${label}: no full reload`, documentDelta === 0, `documents=${documentDelta}`);
  measurements.push({ label, perceivedMs: durationMs, networkMs, requestCount: requestDelta, fullReloadCount: documentDelta });
}

async function hideAllOptionalColumns(page, type) {
  const viewKey = `projects-${type}`;
  await page.getByRole("button", { name: "الأعمدة", exact: true }).click();
  const menu = page.locator("[data-admin-column-menu]");
  await menu.waitFor();
  while ((await menu.locator('input[type="checkbox"]:not(:disabled):checked').count()) > 0) {
    await menu.locator('input[type="checkbox"]:not(:disabled):checked').first().click();
  }
  await waitForStoredColumns(viewKey, []);
  const locked = type === "residential" ? ["selection", "project", "actions"] : ["selection", "code", "actions"];
  check(`${type}: only locked columns remain`, (await page.locator('[data-admin-projects-columns]').getAttribute("data-admin-projects-columns")) === locked.join(","));

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForListIdle(page);
  check(`${type}: empty preference survives refresh`, (await page.locator('[data-admin-projects-columns]').getAttribute("data-admin-projects-columns")) === locked.join(","));

  await page.getByRole("button", { name: "الأعمدة", exact: true }).click();
  await menu.waitFor();
  await menu.locator("button[data-default-columns]").click();
  const defaults = type === "residential"
    ? ["code", "featured", "publication_status", "updated_at"]
    : ["location", "featured", "publication_status", "updated_at"];
  await waitForStoredColumns(viewKey, defaults);
  check(`${type}: Restore Defaults restores optional columns`, (await page.locator('[data-admin-projects-columns]').getAttribute("data-admin-projects-columns")) !== locked.join(","));
}

async function auditPage(browser, type) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const network = { listRequests: 0, documentRequests: 0, listStarts: new Map(), listDurations: [] };
  page.on("request", (request) => {
    if (request.resourceType() === "document") network.documentRequests += 1;
    if (request.url().includes("/api/admin/entity-lists/projects")) {
      network.listRequests += 1;
      network.listStarts.set(request, performance.now());
    }
  });
  page.on("requestfinished", (request) => {
    const started = network.listStarts.get(request);
    if (started == null) return;
    network.listDurations.push(performance.now() - started);
    network.listStarts.delete(request);
  });
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || (message.type() === "warning" && /react|hydrat|server rendered|did not match/i.test(text))) {
      browserIssues.push({ type, source: `console:${message.type()}`, text });
    }
  });
  page.on("pageerror", (error) => browserIssues.push({ type, source: "pageerror", text: String(error) }));
  await page.route("**/api/admin/entity-lists/projects**", async (route) => {
    if (routeDelayMs > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, routeDelayMs));
    }
    await route.continue();
  });

  await login(page);
  const documentsBefore = network.documentRequests;
  const listsBefore = network.listRequests;
  const started = performance.now();
  const response = await page.goto(`${baseUrl}/admin/projects/${type}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const documentMs = performance.now() - started;
  await waitForListIdle(page);
  const firstRowMs = performance.now() - started;
  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry ? {
      ttfbMs: entry.responseStart - entry.requestStart,
      domContentLoadedMs: entry.domContentLoadedEventEnd,
      loadMs: entry.loadEventEnd,
    } : null;
  });
  const backend = await directBackendTimings(type, `projects-${type}`);
  check(`${type}: document response succeeds`, response?.status() === 200, `status=${response?.status()}`);
  check(`${type}: zero client list requests after RSC hydration`, network.listRequests - listsBefore === 0, `requests=${network.listRequests - listsBefore}`);
  check(`${type}: one initial document navigation`, network.documentRequests - documentsBefore === 1);
  measurements.push({ type, documentMs, firstRowMs, clientRenderMs: navigation ? firstRowMs - navigation.ttfbMs : null, ...navigation, ...backend });

  for (const text of [
    "Residential Projects Manager",
    "Commercial Projects Manager",
    "Projects / Published / Featured",
    "Location / Area",
    "Last Updated",
    "Actions",
  ]) {
    check(`${type}: English UI string absent (${text})`, (await page.getByText(text, { exact: true }).count()) === 0);
  }

  await assertLayout(page, type, "wide");
  await assertBulkBar(page, type, "wide");
  await assertActionFeedback(page, type);
  await assertBulkExecution(page, type);
  await assertArchiveRestore(page, type);
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    await page.screenshot({ path: resolve(outputDir, `${type}-wide.png`), fullPage: true });
  }

  const search = page.getByPlaceholder("ابحث في المشاريع");
  await measureInteraction(page, network, `${type} search`, () => search.fill(`qa-no-results-${runId}`), { expectOldRows: true });
  await measureInteraction(page, network, `${type} reset`, () => page.locator("[data-admin-clear-filters]").click(), { allowCacheHit: true });

  const publicationTrigger = page.locator("#projects-publication-filter-trigger");
  await publicationTrigger.click();
  await measureInteraction(page, network, `${type} filter`, () => page.getByRole("option", { name: "منشور", exact: true }).click(), { expectOldRows: true });
  await measureInteraction(page, network, `${type} filter reset`, () => page.locator("[data-admin-clear-filters]").click(), { allowCacheHit: true });

  const sortLabel = type === "residential" ? "المشروع" : "الكود";
  await measureInteraction(page, network, `${type} sort`, () => page.getByRole("button", { name: new RegExp(`^${sortLabel}`) }).first().click(), { expectOldRows: true });

  const pageTwo = page.locator('[data-admin-pagination-slot="page"]', { hasText: /^2$/ });
  if ((await pageTwo.count()) > 0) {
    await measureInteraction(page, network, `${type} pagination`, () => pageTwo.first().click(), { expectOldRows: true });
  } else {
    measurements.push({ label: `${type} pagination`, skipped: "dataset has one page" });
  }

  await hideAllOptionalColumns(page, type);
  await page.setViewportSize({ width: 1024, height: 900 });
  await assertLayout(page, type, "medium");
  await assertBulkBar(page, type, "medium");
  if (outputDir) await page.screenshot({ path: resolve(outputDir, `${type}-medium.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await assertLayout(page, type, "mobile");
  await assertBulkBar(page, type, "mobile");
  check(`${type} mobile: selection remains reachable`, await page.getByRole("checkbox", { name: "تحديد الكل" }).isVisible());
  if (outputDir) {
    await page.screenshot({ path: resolve(outputDir, `${type}-mobile.png`), fullPage: true });
    await page.locator('[data-admin-data-grid-scroll]').evaluate((element) => {
      element.scrollLeft = -element.scrollWidth;
    });
    await page.screenshot({ path: resolve(outputDir, `${type}-mobile-actions.png`), fullPage: true });
  }
  await context.close();
}

async function auditUrlNoticeCleanup(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || (message.type() === "warning" && /react|hydrat|server rendered|did not match/i.test(text))) {
      browserIssues.push({ type: "url-notice-cleanup", source: `console:${message.type()}`, text });
    }
  });
  page.on("pageerror", (error) => browserIssues.push({ type: "url-notice-cleanup", source: "pageerror", text: String(error) }));

  await login(page);
  const response = await page.goto(`${baseUrl}/admin/projects/residential?notice=updated`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const notice = page.locator('[data-admin-notice-layout="inline"]');
  const dismiss = page.getByRole("button", { name: "إغلاق الإشعار", exact: true });
  check("url notice cleanup: document response succeeds", response?.status() === 200, `status=${response?.status()}`);
  check("url notice cleanup: updated notice appears", await notice.getByText("تم تحديث المشروع بنجاح.", { exact: true }).isVisible());
  check("url notice cleanup: dismiss control is available", (await dismiss.count()) === 1);

  await dismiss.click();
  await page.waitForFunction(() => {
    const params = new URL(window.location.href).searchParams;
    return !params.has("notice") && !params.has("error");
  });
  const dismissedUrl = new URL(page.url());
  check("url notice cleanup: notice and error params are removed", !dismissedUrl.searchParams.has("notice") && !dismissedUrl.searchParams.has("error"), dismissedUrl.href);

  await page.reload({ waitUntil: "domcontentloaded" });
  check("url notice cleanup: old notice stays dismissed after refresh", (await page.getByText("تم تحديث المشروع بنجاح.", { exact: true }).count()) === 0);
  await context.close();
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from("admin_users")
    .insert({ username: adminUsername, email: adminEmail, password_hash: passwordHash, role: "super_admin", is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  adminId = data.id;

  const browser = await chromium.launch({ headless: true });
  try {
    if (qaTarget === "url-notice-cleanup") {
      await auditUrlNoticeCleanup(browser);
    } else {
      await auditPage(browser, "residential");
      await auditPage(browser, "commercial");
    }
  } finally {
    await browser.close();
    await cleanup();
  }

  check("No React, hydration, console, or page errors", browserIssues.length === 0, browserIssues.map((issue) => issue.text).join(" | "));
  console.log(JSON.stringify({ measurements, browserIssues }, null, 2));
  const failed = checks.filter((item) => !item.ok);
  if (failed.length) throw new Error(`${failed.length} browser acceptance checks failed`);
  console.log(`qa:admin-instant-projects passed (${checks.length} browser assertions)`);
}

main().catch(async (error) => {
  await cleanup();
  console.error(error);
  process.exitCode = 1;
});
