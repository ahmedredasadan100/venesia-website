/**
 * Browser acceptance for Admin Entity List consumers (Topics / Categories / Series).
 * Fail-hard: required controls must exist (no conditional soft-pass).
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "docs/qa/admin-entity-list-hardening");
const baseUrl = "http://127.0.0.1:3000";
const runId = Date.now().toString(36);
const prefix = `qa-entity-list-${runId}`;
const adminUsername = `__QA_ENTITY_LIST_${runId}__`;
const adminEmail = `${prefix}@venesia.local`;
const password = randomBytes(24).toString("base64url");
const fixtureSearch = `QA ${runId}`;

mkdirSync(OUT, { recursive: true });

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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const checks = [];
const consoleIssues = [];
const pageErrors = [];
let adminId;
let rootCategoryId;
let childCategoryIds = [];
let categoryIds = [];
let seriesIds = [];
let cleanupProof = null;

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function waitForQuery(page, expected, timeout = 15_000) {
  await page.waitForFunction(
    (query) => {
      const params = new URLSearchParams(window.location.search);
      return Object.entries(query).every(([key, value]) =>
        value === null ? !params.has(key) : params.get(key) === value,
      );
    },
    expected,
    { timeout },
  );
}

async function waitForStoredColumns(viewKey, predicate, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastColumns = null;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("admin_user_preferences")
      .select("preferences")
      .eq("admin_user_id", adminId)
      .eq("view_key", viewKey)
      .maybeSingle();
    if (error) throw error;
    lastColumns = Array.isArray(data?.preferences?.visibleColumns)
      ? data.preferences.visibleColumns
      : null;
    if (lastColumns && predicate(lastColumns)) return lastColumns;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(
    `Timed out waiting for ${viewKey} stored columns: ${JSON.stringify(lastColumns)}`,
  );
}

async function cleanup() {
  const errors = [];
  if (seriesIds.length) {
    const { error } = await supabase
      .from("topic_series")
      .delete()
      .in("id", seriesIds);
    if (error) errors.push(`series: ${error.message}`);
  }
  if (categoryIds.length) {
    const { error } = await supabase
      .from("topic_categories")
      .delete()
      .in("id", categoryIds);
    if (error) errors.push(`categories: ${error.message}`);
  }
  if (adminId) {
    const { error: preferencesError } = await supabase
      .from("admin_user_preferences")
      .delete()
      .eq("admin_user_id", adminId);
    if (preferencesError) errors.push(`preferences: ${preferencesError.message}`);
    const { error: auditError } = await supabase
      .from("admin_audit_logs")
      .delete()
      .eq("actor_admin_user_id", adminId);
    if (auditError) errors.push(`audit: ${auditError.message}`);
  }
  const { error: adminDeleteError } = await supabase
    .from("admin_users")
    .delete()
    .eq("username", adminUsername);
  if (adminDeleteError) errors.push(`admin: ${adminDeleteError.message}`);

  const [{ count: categoriesRemaining }, { count: seriesRemaining }, { count: adminsRemaining }] =
    await Promise.all([
      supabase
        .from("topic_categories")
        .select("id", { count: "exact", head: true })
        .in("id", categoryIds.length ? categoryIds : [-1]),
      supabase
        .from("topic_series")
        .select("id", { count: "exact", head: true })
        .in("id", seriesIds.length ? seriesIds : [-1]),
      supabase
        .from("admin_users")
        .select("id", { count: "exact", head: true })
        .eq("username", adminUsername),
    ]);
  cleanupProof = {
    categoriesCreated: categoryIds.length,
    seriesCreated: seriesIds.length,
    adminCreated: Boolean(adminId),
    categoriesRemaining: categoriesRemaining ?? -1,
    seriesRemaining: seriesRemaining ?? -1,
    adminsRemaining: adminsRemaining ?? -1,
    errors,
    ok:
      errors.length === 0 &&
      categoriesRemaining === 0 &&
      seriesRemaining === 0 &&
      adminsRemaining === 0,
  };
  return cleanupProof;
}

async function createIsolatedFixture() {
  const { data: root, error: rootError } = await supabase
    .from("topic_categories")
    .insert({
      name: `${fixtureSearch} Parent`,
      slug: `${prefix}-parent`,
      sort_order: 900_000,
      is_active: true,
      status: "published",
    })
    .select("id")
    .single();
  if (rootError) throw rootError;
  rootCategoryId = root.id;
  categoryIds.push(root.id);

  const childRows = [1, 2].map((index) => ({
    name: `${fixtureSearch} Child ${index}`,
    slug: `${prefix}-child-${index}`,
    parent_id: root.id,
    sort_order: index,
    is_active: true,
    status: "published",
  }));
  const { data: children, error: childrenError } = await supabase
    .from("topic_categories")
    .insert(childRows)
    .select("id");
  if (childrenError) throw childrenError;
  childCategoryIds = children.map((item) => item.id);
  categoryIds.push(...childCategoryIds);

  const standaloneRows = Array.from({ length: 8 }, (_, index) => ({
    name: `${fixtureSearch} Row ${index + 4}`,
    slug: `${prefix}-row-${index + 4}`,
    sort_order: 900_010 + index,
    is_active: index !== 7,
    status: index === 7 ? "hidden" : "published",
  }));
  const { data: standalone, error: standaloneError } = await supabase
    .from("topic_categories")
    .insert(standaloneRows)
    .select("id");
  if (standaloneError) throw standaloneError;
  categoryIds.push(...standalone.map((item) => item.id));

  const { data: seriesFixture, error: seriesError } = await supabase
    .from("topic_series")
    .insert([
      {
        name: `${fixtureSearch} Series Child 1`,
        slug: `${prefix}-series-child-1`,
        status: "published",
        sort_order: 900_000,
        category_id: childCategoryIds[0],
      },
      {
        name: `${fixtureSearch} Series Child 2`,
        slug: `${prefix}-series-child-2`,
        status: "unpublished",
        sort_order: 900_001,
        category_id: childCategoryIds[1],
      },
    ])
    .select("id");
  if (seriesError) throw seriesError;
  seriesIds = seriesFixture.map((item) => item.id);

  check("Fixture creates exactly 11 flattened category rows", categoryIds.length === 11);
  check("Fixture creates two descendant series", seriesIds.length === 2);
}

async function login(page) {
  await page.context().clearCookies();
  await page.goto(`${baseUrl}/admin/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const result = await page.evaluate(
    async ({ username, loginPassword }) => {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
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
  if (!result.ok) throw new Error(`QA login failed: ${result.status}`);
  const cookies = await page.context().cookies(baseUrl);
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === "venesia_admin_session",
  );
  const encodedPayload = sessionCookie?.value.split(".")[1];
  const sessionPayload = encodedPayload
    ? JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
    : null;
  check(
    "QA session is bound to isolated admin",
    sessionPayload?.id === adminId,
    `expected=${adminId} actual=${sessionPayload?.id ?? "none"}`,
  );
  if (sessionPayload?.id !== adminId) {
    throw new Error(
      `QA session identity mismatch: expected ${adminId}, received ${sessionPayload?.id ?? "none"}`,
    );
  }
  await page.goto(`${baseUrl}/admin/settings/security`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const serverIdentityMatches =
    (await page.getByText(adminUsername, { exact: true }).count()) === 1;
  check(
    "Server-rendered admin identity matches isolated admin",
    serverIdentityMatches,
    adminUsername,
  );
  if (!serverIdentityMatches) {
    throw new Error("Server-rendered QA admin identity does not match session");
  }
}

async function openColumnsMenu(page) {
  const columnsBtn = page.getByRole("button", { name: /^الأعمدة$/ });
  check("Columns button present", (await columnsBtn.count()) > 0);
  await columnsBtn.click();
  await page.waitForTimeout(150);
  return columnsBtn;
}

async function countAllStatusOptions(page) {
  return page.locator('[role="listbox"] [role="option"]', {
    hasText: "كل الحالات",
  }).count();
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .insert({
      username: adminUsername,
      email: adminEmail,
      password_hash: passwordHash,
      role: "super_admin",
      is_active: true,
    })
    .select("id")
    .single();
  if (adminError) throw adminError;
  adminId = admin.id;
  await createIsolatedFixture();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    const text = msg.text();
    const isRequiredWarning =
      msg.type() === "warning" && /\b(?:aria|hydration|hydrate)\b/i.test(text);
    if (msg.type() !== "error" && !isRequiredWarning) return;
    // Ignore known Chromium autofill noise on hidden inputs (caret-color injection).
    if (text.includes("caret-color") || text.includes("caretColor")) return;
    consoleIssues.push(text);
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  try {
    await login(page);

    // ── Categories ──────────────────────────────────────────────
    const fixtureCategoriesUrl = `${baseUrl}/admin/content/categories?q=${encodeURIComponent(fixtureSearch)}`;
    await page.goto(
      fixtureCategoriesUrl,
      {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
      },
    );
    await page.waitForTimeout(500);

    check(
      "Categories entity list present",
      (await page.locator("[data-admin-entity-list]").count()) > 0,
    );
    check(
      "Categories search placeholder",
      (await page.locator('input[placeholder="ابحث في التصنيفات"]').count()) > 0,
    );
    check(
      "Categories no native select",
      (await page.locator("form select, select").count()) === 0,
    );

    const statusTrigger = page.locator("#categories-status-filter-trigger");
    check("Categories status filter present", (await statusTrigger.count()) > 0);
    await statusTrigger.click();
    await page.waitForTimeout(150);
    const allStatusCount = await countAllStatusOptions(page);
    check(
      "Categories كل الحالات appears once",
      allStatusCount === 1,
      String(allStatusCount),
    );

    const listboxBeforeOutside = await page.locator('[role="listbox"]').count();
    check("Categories filter opens listbox", listboxBeforeOutside === 1);
    await page.mouse.click(8, 8);
    await page.waitForTimeout(120);
    check(
      "Categories outside click closes filter",
      (await page.locator('[role="listbox"]').count()) === 0,
    );

    await statusTrigger.click();
    await page.waitForTimeout(100);
    await statusTrigger.focus();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    check(
      "Categories Escape closes filter",
      (await page.locator('[role="listbox"]').count()) === 0,
    );
    const escapeFocusId = await page.evaluate(() => document.activeElement?.id ?? "");
    check(
      "Categories Escape returns focus",
      escapeFocusId === "categories-status-filter-trigger",
      escapeFocusId,
    );

    await statusTrigger.click();
    await page.waitForTimeout(100);
    const option = page.locator('[role="listbox"] [role="option"]', {
      hasText: "منشور",
    });
    await option.click();
    await page.waitForTimeout(300);
    check(
      "Categories selecting option closes filter",
      (await page.locator('[role="listbox"]').count()) === 0,
    );
    check(
      "Categories filter resets page to 1",
      !new URL(page.url()).searchParams.has("page") ||
        new URL(page.url()).searchParams.get("page") === "1",
    );

    // Wait for a stable Server Component payload before preference mutations.
    await page.goto(fixtureCategoriesUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    await openColumnsMenu(page);
    const menuMeta = await page.evaluate(() => {
      const menu = document.querySelector('[data-admin-column-menu]');
      return {
        parent: menu?.parentElement?.tagName ?? null,
        position: menu ? getComputedStyle(menu).position : null,
        text: menu?.textContent ?? "",
        checkboxLabels: menu
          ? Array.from(menu.querySelectorAll('input[type="checkbox"]')).map(
              (input) => input.getAttribute("aria-label"),
            )
          : [],
      };
    });
    check(
      "Categories columns portal fixed on body",
      menuMeta.parent === "BODY" && menuMeta.position === "fixed",
      JSON.stringify(menuMeta),
    );
    for (const label of [
      "ID",
      "التصنيف الأب",
      "الترتيب",
      "تاريخ الإنشاء",
      "آخر تعديل",
    ]) {
      check(
        `Categories columns menu has ${label}`,
        menuMeta.text.includes(label),
      );
    }

    // Toggle ID column on and persist
    const idCheckbox = page
      .locator('[data-admin-column-menu] input[type="checkbox"]')
      .nth(3);
    check(
      "Categories ID checkbox has accessible label",
      (await idCheckbox.getAttribute("aria-label"))?.includes("عمود ID"),
    );
    const beforeToggle = await idCheckbox.evaluate((input) => input.checked);
    const persistWait = page.waitForResponse(
      (response) =>
        response.url().includes("/admin/content/categories") &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    ).catch(() => null);
    await idCheckbox.evaluate((input) => input.click());
    const persistResponse = await persistWait;
    const idColumnHeader = page.locator("thead th").filter({ hasText: /^ID/ });
    await idColumnHeader.waitFor({ state: "visible", timeout: 5_000 });
    const afterToggle = (await idColumnHeader.count()) === 1;
    check(
      "Categories ID column toggled before reload",
      afterToggle !== beforeToggle && afterToggle === true,
      `before=${beforeToggle} after=${afterToggle} post=${persistResponse?.status() ?? "none"}`,
    );
    await page.keyboard.press("Escape");
    await page.goto(`${baseUrl}/admin/content/categories`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    await openColumnsMenu(page);
    const idCheckedAfterReload = await page.evaluate(() => {
      const inputs = document.querySelectorAll(
        '[data-admin-column-menu] input[type="checkbox"]',
      );
      return inputs[3]?.checked === true;
    });
    check(
      "Categories column prefs persist after reload",
      idCheckedAfterReload,
      `checked=${idCheckedAfterReload}`,
    );

    const categoriesRestoreButton = page.getByRole("button", {
      name: /استعادة الأعمدة الافتراضية/,
    });
    check(
      "Categories explicit default columns exclude ID",
      !(await categoriesRestoreButton.getAttribute("data-default-columns"))
        ?.split(",")
        .includes("id"),
      (await categoriesRestoreButton.getAttribute("data-default-columns")) ?? "",
    );
    const categoriesRestoreTimeOrigin = await page.evaluate(
      () => performance.timeOrigin,
    );
    const categoriesRestoreRequestPromise = page.waitForRequest(
      (request) => request.method() === "POST",
      { timeout: 15_000 },
    );
    await categoriesRestoreButton.click();
    const categoriesRestoreRequest = await categoriesRestoreRequestPromise;
    check(
      "Categories restore dispatches a server action request",
      Boolean(categoriesRestoreRequest),
    );
    await page
      .locator("[data-admin-column-menu]")
      .waitFor({ state: "hidden", timeout: 15_000 });
    await page.waitForFunction(
      () => document.activeElement?.textContent?.includes("الأعمدة") === true,
      undefined,
      { timeout: 5_000 },
    );
    check(
      "Categories restore closes column menu and returns focus",
      (await page.locator("[data-admin-column-menu]").count()) === 0 &&
        (await page.evaluate(() =>
          document.activeElement?.textContent?.includes("الأعمدة"),
        )) === true,
    );
    check(
      "Categories restore does not reload the document",
      (await page.evaluate(() => performance.timeOrigin)) ===
        categoriesRestoreTimeOrigin,
    );
    const storedCategoryColumns = await waitForStoredColumns(
      "content-categories",
      (columns) => !columns.includes("id"),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const categoriesRestoreHeaders = await page
      .locator("thead th")
      .allTextContents();
    await openColumnsMenu(page);
    const categoriesIdCheckedAfterRestore = await page.evaluate(() =>
      document.querySelectorAll(
        '[data-admin-column-menu] input[type="checkbox"]',
      )[3]?.checked === true,
    );
    check(
      "Categories restore defaults works",
      !categoriesIdCheckedAfterRestore &&
        !categoriesRestoreHeaders.some((label) => label.trim().startsWith("ID")),
      JSON.stringify({ storedCategoryColumns, categoriesRestoreHeaders }),
    );
    await page.keyboard.press("Escape");

    check(
      "Categories column title الموضوعات",
      (await page.getByRole("columnheader", { name: "الموضوعات" }).count()) > 0,
    );
    check(
      "Categories no العدد column header",
      (await page.getByRole("columnheader", { name: "العدد" }).count()) === 0,
    );
    check(
      "Categories activity clocks present",
      (await page.getByRole("button", { name: /معلومات النشاط/ }).count()) > 0,
    );
    check(
      "Categories preview actions present",
      (await page.locator('a[title="معاينة الموضوعات في الموقع"]').count()) > 0 ||
        (await page.locator('a[href*="/topics?category="]').count()) > 0,
    );

    await page.goto(fixtureCategoriesUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);

    const rootRow = page.locator(`[data-entity-row-id="${rootCategoryId}"]`);
    const folderToggle = rootRow.locator("[data-category-folder-toggle]");
    check("Category parent folder toggle is mandatory", (await folderToggle.count()) === 1);
    check("Category folder starts expanded", (await folderToggle.getAttribute("aria-expanded")) === "true");
    check(
      "Category children visible while expanded",
      (await page.locator(`[data-entity-row-id="${childCategoryIds[0]}"]`).count()) === 1 &&
        (await page.locator(`[data-entity-row-id="${childCategoryIds[1]}"]`).count()) === 1,
    );
    await page.screenshot({
      path: resolve(OUT, "categories-folder-open-1440.png"),
      fullPage: true,
    });

    await folderToggle.click();
    await page.waitForTimeout(150);
    check("Category folder closes without opening edit modal", (await page.getByRole("dialog").count()) === 0);
    check("Category folder exposes collapsed state", (await folderToggle.getAttribute("aria-expanded")) === "false");
    check(
      "Category children hidden while collapsed",
      (await page.locator(`[data-entity-row-id="${childCategoryIds[0]}"]`).count()) === 0 &&
        (await page.locator(`[data-entity-row-id="${childCategoryIds[1]}"]`).count()) === 0,
    );
    await page.screenshot({
      path: resolve(OUT, "categories-folder-closed-1440.png"),
      fullPage: true,
    });
    await folderToggle.click();
    await page.waitForTimeout(120);

    const nameEditTrigger = rootRow.locator("[data-category-edit-trigger]");
    check("Category name edit trigger is mandatory", (await nameEditTrigger.count()) === 1);
    check(
      "Category name has pointer cursor",
      (await nameEditTrigger.evaluate((element) => getComputedStyle(element).cursor)) === "pointer",
    );
    await nameEditTrigger.click();
    check("Category name opens edit modal", (await page.getByRole("dialog").count()) === 1);
    await page.getByRole("button", { name: "إغلاق", exact: true }).click();
    check("Category edit modal closes", (await page.getByRole("dialog").count()) === 0);

    const catRowCount = await page.locator("[data-entity-row-id]").count();
    const catSummary = await page.locator("text=/عرض .* من إجمالي/").first().textContent();
    check("Categories fixture page 1 has exactly 10 rows", catRowCount === 10, String(catRowCount));
    check(
      "Categories fixture page 1 exact summary",
      /عرض 1 إلى 10 من إجمالي 11/.test(catSummary ?? ""),
      catSummary ?? "",
    );
    const categoriesPagination = page.getByRole("navigation", {
      name: "ترقيم الصفحات",
    });
    const previousOnPage1 = categoriesPagination.getByText("السابق", {
      exact: true,
    });
    const nextOnPage1 = categoriesPagination.getByRole("link", {
      name: "التالي",
      exact: true,
    });
    check(
      "Categories previous disabled on page 1",
      (await previousOnPage1.evaluate((element) => element.tagName)) === "SPAN",
    );
    check("Categories next link is enabled on page 1", (await nextOnPage1.count()) === 1);
    const page2 = page.getByRole("link", { name: "2", exact: true });
    check("Categories page 2 link is mandatory", (await page2.count()) === 1);
    await page.screenshot({
      path: resolve(OUT, "categories-page-1-1440.png"),
      fullPage: true,
    });

    const timeOriginBeforePageChange = await page.evaluate(() => performance.timeOrigin);
    await nextOnPage1.click();
    await waitForQuery(page, { page: "2" });
    await page
      .locator("text=/عرض 11 إلى 11 من إجمالي 11/")
      .waitFor({ state: "visible", timeout: 15_000 });
    const page2Rows = await page.locator("[data-entity-row-id]").count();
    const page2Summary = await page.locator("text=/عرض .* من إجمالي/").first().textContent();
    check("Categories fixture page 2 has exactly 1 row", page2Rows === 1, String(page2Rows));
    check(
      "Categories fixture page 2 exact summary",
      /عرض 11 إلى 11 من إجمالي 11/.test(page2Summary ?? ""),
      page2Summary ?? "",
    );
    check(
      "Categories page 2 current marker",
      (await categoriesPagination.locator('[aria-current="page"]').filter({ hasText: /^2$/ }).count()) === 1,
    );
    const nextOnPage2 = categoriesPagination.getByText("التالي", { exact: true });
    const previousOnPage2 = categoriesPagination.getByRole("link", {
      name: "السابق",
      exact: true,
    });
    check(
      "Categories next disabled on page 2",
      (await nextOnPage2.evaluate((element) => element.tagName)) === "SPAN",
    );
    check("Categories previous link is enabled on page 2", (await previousOnPage2.count()) === 1);
    check(
      "Categories pagination uses client navigation",
      (await page.evaluate(() => performance.timeOrigin)) === timeOriginBeforePageChange,
    );
    await page.screenshot({
      path: resolve(OUT, "categories-page-2-1440.png"),
      fullPage: true,
    });

    await previousOnPage2.click();
    await waitForQuery(page, { page: null });
    await page
      .locator("text=/عرض 1 إلى 10 من إجمالي 11/")
      .waitFor({ state: "visible", timeout: 15_000 });
    check("Categories previous returns to page 1", (await page.locator("[data-entity-row-id]").count()) === 10);
    await page.getByRole("link", { name: "2", exact: true }).click();
    await waitForQuery(page, { page: "2" });

    const hiddenCategoryId = categoryIds.at(-1);
    const hiddenRow = page.locator(`[data-entity-row-id="${hiddenCategoryId}"]`);
    const hiddenVisibility = hiddenRow.getByRole("button", { name: "إظهار التصنيف" });
    check("Hidden category uses eye-off action", (await hiddenVisibility.count()) === 1);
    await hiddenVisibility.screenshot({ path: resolve(OUT, "visibility-eye-off-1440.png") });
    const hiddenPath = await hiddenVisibility.locator("svg path").first().getAttribute("d");

    await page.goto(fixtureCategoriesUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const visibleVisibility = page
      .locator(`[data-entity-row-id="${rootCategoryId}"]`)
      .getByRole("button", { name: "إخفاء التصنيف" });
    check("Published category uses open-eye action", (await visibleVisibility.count()) === 1);
    await visibleVisibility.screenshot({ path: resolve(OUT, "visibility-open-eye-1440.png") });
    const visiblePath = await visibleVisibility.locator("svg path").first().getAttribute("d");
    check("Visibility states use distinct SVG paths", Boolean(visiblePath && hiddenPath && visiblePath !== hiddenPath));

    const limitBtn = page.getByRole("button", { name: "10", exact: true });
    check("Categories page-size selector is mandatory", (await limitBtn.count()) === 1);
    await limitBtn.click();
    const limitOptions = await page.locator('[data-admin-table-pagination-menu] [role="option"]').allTextContents();
    check(
      "Categories page-size options are exactly 10/20/30/50",
      ["10", "20", "30", "50"].every((value) => limitOptions.some((item) => item.trim().startsWith(value))),
      JSON.stringify(limitOptions),
    );
    await page
      .locator('[data-admin-table-pagination-menu] [role="option"]', {
        hasText: /^20/,
      })
      .evaluate((option) => option.click());
    await waitForQuery(page, { limit: "20", page: null });
    const limitUrl = new URL(page.url());
    check(
      "Categories limit resets page and preserves search",
      !limitUrl.searchParams.has("page") &&
        limitUrl.searchParams.get("limit") === "20" &&
        limitUrl.searchParams.get("q") === fixtureSearch,
      limitUrl.search,
    );
    for (const nextLimit of ["30", "50", "10"]) {
      await page
        .getByRole("button", {
          name: nextLimit === "30" ? "20" : nextLimit === "50" ? "30" : "50",
          exact: true,
        })
        .click();
      await page
        .locator('[data-admin-table-pagination-menu] [role="option"]', {
          hasText: new RegExp(`^${nextLimit}`),
        })
        .evaluate((option) => option.click());
      await waitForQuery(page, {
        limit: nextLimit === "10" ? null : nextLimit,
        page: null,
        q: fixtureSearch,
      });
      check(
        `Categories page-size ${nextLimit} applies and preserves search`,
        new URL(page.url()).searchParams.get("q") === fixtureSearch,
        page.url(),
      );
    }

    await page.goto(`${fixtureCategoriesUrl}&page=2`, { waitUntil: "domcontentloaded" });
    const searchInput = page.locator('input[placeholder="ابحث في التصنيفات"]');
    await searchInput.fill(`${fixtureSearch} Row`);
    await waitForQuery(page, { q: `${fixtureSearch} Row`, page: null });
    check("Categories search resets page to 1", !new URL(page.url()).searchParams.has("page"), page.url());

    await page.goto(`${fixtureCategoriesUrl}&page=2`, { waitUntil: "domcontentloaded" });
    await page.locator("#categories-status-filter-trigger").click();
    await page
      .locator('[role="listbox"] [role="option"]', { hasText: "مخفي" })
      .evaluate((option) => option.click());
    await waitForQuery(page, { status: "hidden", page: null });
    check("Categories status filter resets page to 1", !new URL(page.url()).searchParams.has("page"), page.url());

    await page.goto(
      `${fixtureCategoriesUrl}&status=hidden&limit=20`,
      { waitUntil: "domcontentloaded" },
    );
    const categorySortUrl = page.url();
    const sortTimeOrigin = await page.evaluate(() => performance.timeOrigin);
    await page.getByRole("button", { name: /التصنيف/ }).first().click();
    await page.waitForTimeout(150);
    check(
      "Categories sort preserves filter and limit URL state",
      page.url() === categorySortUrl &&
        (await page.evaluate(() => performance.timeOrigin)) === sortTimeOrigin,
      page.url(),
    );

    // Shared mutual exclusion on Categories
    await page.goto(`${baseUrl}/admin/content/categories`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(300);
    await page.locator("#categories-status-filter-trigger").click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: /^الأعمدة$/ }).click();
    await page.waitForTimeout(150);
    check(
      "Opening columns closes filter",
      (await page.locator('[data-admin-filter-listbox]').count()) === 0 &&
        (await page.locator("[data-admin-column-menu]").count()) === 1,
    );
    await page.keyboard.press("Escape");

    // ── Series ──────────────────────────────────────────────────
    await page.goto(`${baseUrl}/admin/content/series`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(500);

    check(
      "Series search placeholder",
      (await page.locator('input[placeholder="ابحث في السلاسل"]').count()) > 0,
    );
    check(
      "Series status filter present",
      (await page.locator("#series-status-filter-trigger").count()) > 0,
    );
    check(
      "Series category filter present",
      (await page.locator("#series-category-filter-trigger").count()) > 0,
    );

    await page.locator("#series-category-filter-trigger").click();
    const categoryOptionTexts = await page
      .locator('[data-admin-filter-listbox] [role="option"]')
      .allTextContents();
    check(
      "Series category filter contains parent exactly once",
      categoryOptionTexts.filter((text) => text.includes(`${fixtureSearch} Parent`)).length === 1,
      JSON.stringify(categoryOptionTexts),
    );
    check(
      "Series category filter contains hierarchical children once",
      categoryOptionTexts.filter((text) => text.includes(`${fixtureSearch} Child 1`)).length === 1 &&
        categoryOptionTexts.filter((text) => text.includes(`${fixtureSearch} Child 2`)).length === 1 &&
        categoryOptionTexts.some((text) => text.includes(`— ${fixtureSearch} Child`)),
      JSON.stringify(categoryOptionTexts),
    );
    await page.keyboard.press("Escape");

    const seriesParentUrl = `${baseUrl}/admin/content/series?q=${encodeURIComponent(fixtureSearch)}&category=${rootCategoryId}`;
    await page.goto(seriesParentUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const parentSeriesRows = await page.locator("[data-entity-row-id]").count();
    check(
      "Series parent category includes directly assigned descendant series",
      parentSeriesRows === 2,
      String(parentSeriesRows),
    );
    const parentSeriesText = await page.locator("[data-admin-entity-list]").textContent();
    check(
      "Series parent result includes both child series",
      parentSeriesText?.includes(`${fixtureSearch} Series Child 1`) &&
        parentSeriesText?.includes(`${fixtureSearch} Series Child 2`),
      parentSeriesText ?? "",
    );
    await page.screenshot({
      path: resolve(OUT, "series-parent-filter-1440.png"),
      fullPage: true,
    });

    await page.goto(
      `${baseUrl}/admin/content/series?q=${encodeURIComponent(`${fixtureSearch} missing`)}&category=${rootCategoryId}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(350);
    const filteredEmptyText = await page.locator("[data-admin-entity-list]").textContent();
    check(
      "Series filtered-empty copy is mandatory",
      filteredEmptyText?.includes("لا توجد سلاسل مطابقة للبحث أو الفلاتر المحددة") &&
        !filteredEmptyText?.includes("ابدأ بإضافة أول سلسلة"),
      filteredEmptyText ?? "",
    );
    await page.screenshot({
      path: resolve(OUT, "series-filtered-empty-1440.png"),
      fullPage: true,
    });

    await page.goto(seriesParentUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const fixtureSeriesCheckbox = page.getByRole("checkbox", {
      name: `تحديد ${fixtureSearch} Series Child 1`,
    });
    check("Series row selection is mandatory", (await fixtureSeriesCheckbox.count()) === 1);
    await fixtureSeriesCheckbox.check();
    const bulkTrigger = page.locator("#content-series-table-bulk-action-trigger");
    check("Series bulk listbox trigger is mandatory", (await bulkTrigger.count()) === 1);

    await bulkTrigger.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(120);
    await bulkTrigger.click();
    await page.waitForTimeout(120);
    const bulkMenu = page.locator("[data-admin-listbox-menu]");
    check("Series bulk listbox opens", (await bulkMenu.count()) === 1);
    const bottomMeasurement = await page.evaluate(() => {
      const trigger = document.querySelector("#content-series-table-bulk-action-trigger");
      const menu = document.querySelector("[data-admin-listbox-menu]");
      if (!trigger || !menu) return null;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      return {
        placement: menu.getAttribute("data-placement"),
        gap: Math.abs(menuRect.top - triggerRect.bottom),
        triggerTop: triggerRect.top,
        menuTop: menuRect.top,
      };
    });
    check(
      "Series bulk bottom placement remains anchored",
      bottomMeasurement?.placement === "bottom" && bottomMeasurement.gap <= 10,
      JSON.stringify(bottomMeasurement),
    );
    const menuBeforeMouseMove = await bulkMenu.boundingBox();
    await page.mouse.move(1100, 700);
    await page.waitForTimeout(120);
    const menuAfterMouseMove = await bulkMenu.boundingBox();
    check(
      "Mousemove does not change bulk listbox position",
      Boolean(
        menuBeforeMouseMove &&
          menuAfterMouseMove &&
          Math.abs(menuBeforeMouseMove.x - menuAfterMouseMove.x) < 1 &&
          Math.abs(menuBeforeMouseMove.y - menuAfterMouseMove.y) < 1,
      ),
      JSON.stringify({ menuBeforeMouseMove, menuAfterMouseMove }),
    );
    const beforeScroll = await page.evaluate(() => {
      const trigger = document.querySelector("#content-series-table-bulk-action-trigger")?.getBoundingClientRect();
      const menu = document.querySelector("[data-admin-listbox-menu]")?.getBoundingClientRect();
      return trigger && menu ? { triggerTop: trigger.top, menuTop: menu.top } : null;
    });
    await page.evaluate(() => window.scrollBy(0, 80));
    await page.waitForTimeout(150);
    const afterScroll = await page.evaluate(() => {
      const trigger = document.querySelector("#content-series-table-bulk-action-trigger")?.getBoundingClientRect();
      const menu = document.querySelector("[data-admin-listbox-menu]")?.getBoundingClientRect();
      return trigger && menu
        ? {
            triggerTop: trigger.top,
            menuTop: menu.top,
            gap: Math.abs(menu.top - trigger.bottom),
          }
        : null;
    });
    check(
      "Bulk listbox re-aligns after scroll",
      Boolean(
        beforeScroll &&
          afterScroll &&
          afterScroll.gap <= 10 &&
          Math.abs(
            (afterScroll.menuTop - beforeScroll.menuTop) -
              (afterScroll.triggerTop - beforeScroll.triggerTop),
          ) <= 2,
      ),
      JSON.stringify({ beforeScroll, afterScroll }),
    );
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.waitForTimeout(150);
    const afterResize = await page.evaluate(() => {
      const trigger = document.querySelector("#content-series-table-bulk-action-trigger")?.getBoundingClientRect();
      const menu = document.querySelector("[data-admin-listbox-menu]");
      const menuRect = menu?.getBoundingClientRect();
      const placement = menu?.getAttribute("data-placement");
      if (!trigger || !menuRect || !placement) return null;
      return {
        placement,
        gap:
          placement === "top"
            ? Math.abs(trigger.top - menuRect.bottom)
            : Math.abs(menuRect.top - trigger.bottom),
      };
    });
    check(
      "Bulk listbox re-aligns after resize",
      Boolean(afterResize && afterResize.gap <= 10),
      JSON.stringify(afterResize),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, "series-bulk-listbox-bottom-1440.png") });
    await page.keyboard.press("Escape");
    check("Bulk Escape closes and returns focus", (await bulkMenu.count()) === 0 && (await bulkTrigger.evaluate((element) => document.activeElement === element)));

    await bulkTrigger.evaluate((element) => element.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(120);
    await bulkTrigger.click();
    await page.waitForTimeout(120);
    const topMeasurement = await page.evaluate(() => {
      const trigger = document.querySelector("#content-series-table-bulk-action-trigger");
      const menu = document.querySelector("[data-admin-listbox-menu]");
      if (!trigger || !menu) return null;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      return {
        placement: menu.getAttribute("data-placement"),
        gap: Math.abs(triggerRect.top - menuRect.bottom),
        triggerTop: triggerRect.top,
        menuBottom: menuRect.bottom,
      };
    });
    check(
      "Series bulk top placement remains anchored",
      topMeasurement?.placement === "top" && topMeasurement.gap <= 10,
      JSON.stringify(topMeasurement),
    );
    await page.screenshot({ path: resolve(OUT, "series-bulk-listbox-top-1440.png") });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    check("Bulk keyboard selection closes listbox", (await bulkMenu.count()) === 0);

    await bulkTrigger.click();
    await page.mouse.click(8, 8);
    await page.waitForTimeout(100);
    check("Bulk outside click closes listbox", (await bulkMenu.count()) === 0);
    await bulkTrigger.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    check("Bulk Space opens listbox", (await bulkMenu.count()) === 1);
    await page.getByRole("button", { name: /^الأعمدة$/ }).click();
    await page.waitForTimeout(120);
    check(
      "Opening Series columns closes bulk listbox",
      (await bulkMenu.count()) === 0 &&
        (await page.locator("[data-admin-column-menu]").count()) === 1,
    );
    await page.keyboard.press("Escape");

    await page.locator("#series-status-filter-trigger").click();
    await page.waitForTimeout(120);
    const seriesAllCount = await countAllStatusOptions(page);
    check(
      "Series كل الحالات appears once",
      seriesAllCount === 1,
      String(seriesAllCount),
    );
    await page.keyboard.press("Escape");

    await openColumnsMenu(page);
    const seriesMenuText = await page.evaluate(
      () => document.querySelector("[data-admin-column-menu]")?.textContent ?? "",
    );
    for (const label of [
      "ID",
      "Slug",
      "التصنيف",
      "الترتيب",
      "تاريخ الإنشاء",
      "آخر تعديل",
    ]) {
      check(`Series columns menu has ${label}`, seriesMenuText.includes(label));
    }
    const seriesIdToggle = page
      .locator('[data-admin-column-menu] input[type="checkbox"]')
      .nth(3);
    check(
      "Series ID checkbox has accessible label",
      (await seriesIdToggle.getAttribute("aria-label"))?.includes("عمود ID"),
    );
    await seriesIdToggle.evaluate((input) => input.click());
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await openColumnsMenu(page);
    const seriesIdCheckedAfterReload = await page.evaluate(() => {
      const inputs = document.querySelectorAll(
        '[data-admin-column-menu] input[type="checkbox"]',
      );
      return inputs[3]?.checked === true;
    });
    check(
      "Series column prefs persist after reload",
      seriesIdCheckedAfterReload,
    );
    await page
      .getByRole("button", { name: /استعادة الأعمدة الافتراضية/ })
      .click();
    const storedSeriesColumns = await waitForStoredColumns(
      "content-series",
      (columns) => !columns.includes("id"),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    check(
      "Series restore defaults works",
      (await page.locator("thead th").filter({ hasText: /^ID/ }).count()) === 0,
      JSON.stringify(storedSeriesColumns),
    );
    await page.keyboard.press("Escape");

    check(
      "Series column title الموضوعات",
      (await page.getByRole("columnheader", { name: "الموضوعات" }).count()) > 0,
    );
    check(
      "Series no العدد column header",
      (await page.getByRole("columnheader", { name: "العدد" }).count()) === 0,
    );
    check(
      "Series activity clocks present",
      (await page.getByRole("button", { name: /معلومات النشاط/ }).count()) > 0,
    );
    const previewLink = page.locator(
      'a[title="عرض موضوعات السلسلة"], a[href*="/admin/content/topics?series="]',
    );
    check("Series preview action present", (await previewLink.count()) > 0);
    const href = await previewLink.first().getAttribute("href");
    const target = await previewLink.first().getAttribute("target");
    check(
      "Series preview links to topics?series= in a new tab",
      Boolean(href && href.includes("/admin/content/topics?series=") && target === "_blank"),
      `${href ?? ""} target=${target ?? ""}`,
    );

    const seriesRowCount = await page.locator("[data-entity-row-id]").count();
    const seriesSummary = await page
      .locator("text=/عرض .* من إجمالي/")
      .first()
      .textContent()
      .catch(() => "");
    check("Series pagination summary present", Boolean(seriesSummary));
    check(
      "Series page rows <= 10 default",
      seriesRowCount <= 10,
      String(seriesRowCount),
    );

    // sticky actions smoke
    const stickyActions = await page.evaluate(() => {
      const cell = document.querySelector(
        "[data-entity-row-id] td:last-child, [data-entity-row-id] [class*='sticky']",
      );
      if (!cell) return null;
      return getComputedStyle(cell).position;
    });
    check(
      "Series actions sticky",
      stickyActions === "sticky",
      String(stickyActions),
    );

    await page.screenshot({
      path: resolve(OUT, "series-1440.png"),
      fullPage: true,
    });

    // ── Redirect action feedback policy ────────────────────────
    await page.goto(`${baseUrl}/admin/content/series?notice=updated`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(250);
    const noticeClose = page.getByRole("button", { name: "إغلاق الإشعار" });
    check("Action feedback close button is mandatory", (await noticeClose.count()) === 1);
    check(
      "Action feedback close button has pointer cursor",
      (await noticeClose.evaluate((element) => getComputedStyle(element).cursor)) === "pointer",
    );
    await page.screenshot({
      path: resolve(OUT, "feedback-dismissible-1440.png"),
      fullPage: true,
    });
    const feedbackTimeOrigin = await page.evaluate(() => performance.timeOrigin);
    await noticeClose.click();
    await page.waitForTimeout(250);
    check("Action feedback closes", (await noticeClose.count()) === 0);
    check(
      "Dismissing redirect feedback removes notice without reload",
      !new URL(page.url()).searchParams.has("notice") &&
        (await page.evaluate(() => performance.timeOrigin)) === feedbackTimeOrigin,
      page.url(),
    );
    check("Dismissed feedback does not immediately reappear", (await noticeClose.count()) === 0);

    // ── Topics surface + shared dropdown exclusivity ────────────
    await page.goto(`${baseUrl}/admin/content/topics`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(500);
    check(
      "Topics entity list present",
      (await page.locator("[data-admin-entity-list]").count()) > 0,
    );
    check(
      "Topics search placeholder",
      (await page.locator('input[placeholder="ابحث في الموضوعات"]').count()) >
        0,
    );
    check(
      "Topics no native select",
      (await page.locator("select").count()) === 0,
    );

    const topicsStatus = page.locator("#status-trigger");
    check("Topics status filter is mandatory", (await topicsStatus.count()) === 1);
    await topicsStatus.click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: /^الأعمدة$/ }).click();
    await page.waitForTimeout(120);
    check(
      "Topics opening columns closes filter",
      (await page.locator("[data-admin-filter-listbox]").count()) === 0,
    );
    await page.keyboard.press("Escape");

    const overflow = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    check(
      "No document horizontal overflow",
      overflow.sw <= overflow.cw + 1,
      JSON.stringify(overflow),
    );

    await page.screenshot({
      path: resolve(OUT, "topics-1440.png"),
      fullPage: true,
    });

    check(
      "No console errors",
      consoleIssues.length === 0,
      consoleIssues.join(" | "),
    );
    check("No page errors", pageErrors.length === 0, pageErrors.join(" | "));
  } finally {
    await browser.close();
    await cleanup();
  }

  check(
    "Isolated fixture cleanup succeeds with zero remaining records",
    cleanupProof?.ok === true,
    JSON.stringify(cleanupProof),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    fixture: {
      runId,
      search: fixtureSearch,
      rootCategoryId,
      childCategoryIds,
      categoryIds,
      seriesIds,
    },
    cleanupProof,
    checks,
    consoleIssues,
    pageErrors,
    evidence: [
      "categories-page-1-1440.png",
      "categories-page-2-1440.png",
      "categories-folder-open-1440.png",
      "categories-folder-closed-1440.png",
      "series-parent-filter-1440.png",
      "series-filtered-empty-1440.png",
      "series-bulk-listbox-bottom-1440.png",
      "series-bulk-listbox-top-1440.png",
      "feedback-dismissible-1440.png",
      "visibility-open-eye-1440.png",
      "visibility-eye-off-1440.png",
    ],
  };
  writeFileSync(
    resolve(OUT, "qa-admin-entity-list-hardening-report.json"),
    JSON.stringify(report, null, 2),
  );

  const failed = checks.filter((item) => !item.ok);
  console.log(
    `qa-admin-entity-list-consumers: ${checks.length - failed.length}/${checks.length} passed`,
  );
  if (failed.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
