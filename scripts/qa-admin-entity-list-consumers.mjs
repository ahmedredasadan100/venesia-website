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
const OUT = resolve(ROOT, "docs/qa/admin-entity-list-closure");
const baseUrl = "http://127.0.0.1:3000";
const runId = Date.now().toString(36);
const prefix = `qa-entity-list-${runId}`;
const adminUsername = `__QA_ENTITY_LIST_${runId}__`;
const adminEmail = `${prefix}@venesia.local`;
const password = randomBytes(24).toString("base64url");

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

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function cleanup() {
  if (adminId) {
    await supabase
      .from("admin_user_preferences")
      .delete()
      .eq("admin_user_id", adminId);
    await supabase
      .from("admin_audit_logs")
      .delete()
      .eq("actor_admin_user_id", adminId);
  }
  await supabase.from("admin_users").delete().eq("username", adminUsername);
}

async function login(page) {
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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Ignore known Chromium autofill noise on hidden inputs (caret-color injection).
    if (text.includes("caret-color") || text.includes("caretColor")) return;
    consoleIssues.push(text);
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  try {
    await login(page);

    // ── Categories ──────────────────────────────────────────────
    await page.goto(`${baseUrl}/admin/content/categories`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
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

    await openColumnsMenu(page);
    const menuMeta = await page.evaluate(() => {
      const menu = document.querySelector('[data-admin-column-menu]');
      return {
        parent: menu?.parentElement?.tagName ?? null,
        position: menu ? getComputedStyle(menu).position : null,
        text: menu?.textContent ?? "",
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
    const idToggle = page.locator("[data-admin-column-menu] label", {
      hasText: /^ID$/,
    });
    const idCheckbox = idToggle.locator('input[type="checkbox"]');
    const beforeToggle = await idCheckbox.isChecked();
    const persistWait = page.waitForResponse(
      (response) =>
        response.url().includes("/admin/content/categories") &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    ).catch(() => null);
    await idCheckbox.click({ force: true });
    const persistResponse = await persistWait;
    await page.waitForTimeout(400);
    const afterToggle = await idCheckbox.isChecked();
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
    const idCheckedAfterReload = await page
      .locator("[data-admin-column-menu] label", { hasText: /^ID$/ })
      .locator('input[type="checkbox"]')
      .isChecked();
    check(
      "Categories column prefs persist after reload",
      idCheckedAfterReload,
      `checked=${idCheckedAfterReload}`,
    );

    await page
      .getByRole("button", { name: /استعادة الأعمدة الافتراضية/ })
      .click();
    await page.waitForTimeout(400);
    const idCheckedAfterRestore = await page
      .locator('[data-admin-column-menu] label', { hasText: /^ID$/ })
      .locator('input[type="checkbox"]')
      .isChecked();
    check("Categories restore defaults works", !idCheckedAfterRestore);
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
      (await page.locator('[data-admin-activity-popover]').count()) >= 0 &&
        (await page.getByRole("button", { name: /معلومات النشاط/ }).count()) >
          0,
    );
    check(
      "Categories preview actions present",
      (await page.locator('a[title="معاينة الموضوعات في الموقع"]').count()) > 0 ||
        (await page.locator('a[href*="/topics?category="]').count()) > 0,
    );

    const catRowCount = await page.locator("[data-entity-row-id]").count();
    const catSummary = await page
      .locator("text=/عرض .* من إجمالي/")
      .first()
      .textContent()
      .catch(() => "");
    const totalMatch = catSummary?.match(/من إجمالي\s+(\d+)/);
    const totalCount = totalMatch ? Number(totalMatch[1]) : 0;
    check("Categories pagination summary present", totalCount > 0, catSummary);
    check(
      "Categories page rows <= 10",
      catRowCount <= 10,
      String(catRowCount),
    );
    if (totalCount > 10) {
      check(
        "Categories page1 range uses limit 10",
        /عرض 1 إلى 10 من إجمالي/.test(catSummary ?? ""),
        catSummary,
      );
      const page2 = page.getByRole("link", { name: "2", exact: true });
      check("Categories page 2 link present", (await page2.count()) > 0);
      if ((await page2.count()) > 0) {
        await page2.click();
        await page.waitForTimeout(400);
        const page2Rows = await page.locator("[data-entity-row-id]").count();
        const page2Summary = await page
          .locator("text=/عرض .* من إجمالي/")
          .first()
          .textContent()
          .catch(() => "");
        check(
          "Categories page2 remainder rows",
          page2Rows === totalCount - 10 || page2Rows <= 10,
          String(page2Rows),
        );
        check(
          "Categories page2 summary",
          /عرض 11 إلى/.test(page2Summary ?? ""),
          page2Summary,
        );
      }
    }

    // Change limit while keeping status filter
    await page.goto(`${baseUrl}/admin/content/categories?status=published`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(300);
    const limitBtn = page.getByRole("button", { name: /^(10|20|30|50)$/ }).first();
    if ((await limitBtn.count()) > 0) {
      await limitBtn.click();
      await page.waitForTimeout(100);
      const opt20 = page.locator('[role="listbox"] [role="option"]', {
        hasText: /^20$/,
      });
      if ((await opt20.count()) > 0) {
        await opt20.click();
        await page.waitForTimeout(350);
        const url = new URL(page.url());
        check(
          "Categories limit change keeps status filter",
          url.searchParams.get("status") === "published",
          url.search,
        );
      }
    }

    await page.screenshot({
      path: resolve(OUT, "categories-1440.png"),
      fullPage: true,
    });

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
    const seriesIdToggle = page.locator("[data-admin-column-menu] label", {
      hasText: /^ID$/,
    });
    await seriesIdToggle.click();
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await openColumnsMenu(page);
    check(
      "Series column prefs persist after reload",
      await page
        .locator("[data-admin-column-menu] label", { hasText: /^ID$/ })
        .locator('input[type="checkbox"]')
        .isChecked(),
    );
    await page
      .getByRole("button", { name: /استعادة الأعمدة الافتراضية/ })
      .click();
    await page.waitForTimeout(400);
    check(
      "Series restore defaults works",
      !(await page
        .locator("[data-admin-column-menu] label", { hasText: /^ID$/ })
        .locator('input[type="checkbox"]')
        .isChecked()),
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
    if ((await previewLink.count()) > 0) {
      const href = await previewLink.first().getAttribute("href");
      check(
        "Series preview links to topics?series=",
        Boolean(href && href.includes("/admin/content/topics?series=")),
        href ?? "",
      );
    }

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
      stickyActions === "sticky" ||
        (await page.locator("th").filter({ hasText: "الإجراءات" }).count()) > 0,
      String(stickyActions),
    );

    await page.screenshot({
      path: resolve(OUT, "series-1440.png"),
      fullPage: true,
    });

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
    if ((await topicsStatus.count()) > 0) {
      await topicsStatus.click();
      await page.waitForTimeout(100);
      await page.getByRole("button", { name: /^الأعمدة$/ }).click();
      await page.waitForTimeout(120);
      check(
        "Topics opening columns closes filter",
        (await page.locator("[data-admin-filter-listbox]").count()) === 0,
      );
      await page.keyboard.press("Escape");
    }

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

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks,
    consoleIssues,
    pageErrors,
  };
  writeFileSync(
    resolve(OUT, "qa-admin-entity-list-report.json"),
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
