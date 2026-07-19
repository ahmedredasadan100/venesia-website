import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "docs/qa/topics-list-reference");
const baseUrl = "http://localhost:3000";
const runId = Date.now().toString(36);
const prefix = `qa-topics-reference-${runId}`;
const adminUsername = `__QA_TOPICS_REFERENCE_${runId}__`;
const adminEmail = `${prefix}@venesia.local`;
const password = randomBytes(24).toString("base64url");

mkdirSync(OUTPUT, { recursive: true });

const screenshots = {
  statuses: resolve(OUTPUT, "topics-status-tones.png"),
  featured: resolve(OUTPUT, "topics-featured-after-reload.png"),
  columns: resolve(OUTPUT, "topics-columns-scrollbar.png"),
  columnsMedium: resolve(OUTPUT, "topics-columns-medium-viewport.png"),
  columnsCompact: resolve(OUTPUT, "topics-columns-compact-viewport.png"),
  sortFailure: resolve(OUTPUT, "topics-sort-persistence-failure.png"),
  allColumns: resolve(OUTPUT, "topics-all-columns-sticky-actions.png"),
  minimumColumns: resolve(OUTPUT, "topics-minimum-columns-sticky-actions.png"),
  publishValidation: resolve(OUTPUT, "topics-publish-validation.png"),
  activity: resolve(OUTPUT, "topics-activity-popover.png"),
  bulkFailure: resolve(OUTPUT, "topics-bulk-publish-failure.png"),
};
const reportScreenshots = Object.fromEntries(
  Object.entries(screenshots).map(([key, path]) => [
    key,
    relative(ROOT, path).replaceAll("\\", "/"),
  ]),
);
const reportPath = resolve(OUTPUT, "topics-list-reference-report.json");

loadEnv(resolve(ROOT, ".env.local"));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const checks = [];
const consoleIssues = [];
const pageErrors = [];
const networkIssues = [];
const badResponses = [];
const expectedFailedRequests = new WeakSet();
let expectedPreferenceConsoleError = false;
let browser;
let adminId;
let categoryId;

const titles = {
  published: `01 منشور مرجعي ${runId}`,
  unpublished: `02 مخفي مرجعي ${runId}`,
  draft: `03 مسودة مرجعية ${runId}`,
  archived: `04 مؤرشف مرجعي ${runId}`,
  validDraft: `05 مسودة مكتملة ${runId}`,
};
const ids = new Map();

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

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function must(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
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
  await supabase.from("topics").delete().like("slug", `${prefix}%`);
  if (categoryId) {
    await supabase.from("topic_categories").delete().eq("id", categoryId);
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

async function openTopics(page, query = `q=${encodeURIComponent(runId)}`) {
  const response = await page.goto(
    `${baseUrl}/admin/content/topics${query ? `?${query}` : ""}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  check(
    `Topics route responds for ${query || "default state"}`,
    response?.status() === 200,
    String(response?.status()),
  );
  await page.locator("#content-topics-table").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
}

function rowByTitle(page, title) {
  return page
    .locator("#content-topics-table tbody tr")
    .filter({ hasText: title })
    .first();
}

async function openColumnsMenu(page) {
  const trigger = page.getByRole("button", { name: /الأعمدة/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  const menu = page.getByRole("menu");
  await menu.waitFor({ state: "visible" });
  return menu;
}

async function closeColumnsMenu(page) {
  const menu = page.getByRole("menu");
  if (await menu.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
  }
}

async function pageGeometrySnapshot(page) {
  return page.evaluate(() => {
    const tableSection = document.querySelector("#content-topics-table");
    const tableBox = tableSection?.getBoundingClientRect();
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      documentClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      tableBox: tableBox
        ? {
            x: tableBox.x,
            y: tableBox.y,
            width: tableBox.width,
            height: tableBox.height,
          }
        : null,
    };
  });
}

async function columnsOverlayGeometry(page, label) {
  await closeColumnsMenu(page);
  const trigger = page.getByRole("button", { name: /الأعمدة/ });
  await trigger.scrollIntoViewIfNeeded();
  const before = await pageGeometrySnapshot(page);
  const menu = await openColumnsMenu(page);
  await page.waitForTimeout(100);
  const after = await pageGeometrySnapshot(page);
  const panel = await menu.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    return {
      parent: element.parentElement?.tagName,
      position: computed.position,
      placement: element.getAttribute("data-placement"),
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    };
  });
  const stableTable =
    before.tableBox &&
    after.tableBox &&
    Math.abs(before.tableBox.x - after.tableBox.x) <= 0.5 &&
    Math.abs(before.tableBox.width - after.tableBox.width) <= 0.5;
  const stableDocument =
    before.documentScrollWidth === after.documentScrollWidth &&
    before.documentScrollHeight === after.documentScrollHeight &&
    before.documentClientWidth === after.documentClientWidth &&
    before.bodyScrollWidth === after.bodyScrollWidth &&
    before.bodyScrollHeight === after.bodyScrollHeight &&
    before.scrollX === after.scrollX &&
    before.scrollY === after.scrollY;
  const insideViewport =
    panel.left >= 11 &&
    panel.right <= after.viewportWidth - 11 &&
    panel.top >= 11 &&
    panel.bottom <= after.viewportHeight - 11;
  check(
    `${label}: columns portal does not alter page geometry`,
    panel.parent === "BODY" &&
      panel.position === "fixed" &&
      stableDocument &&
      stableTable &&
      after.documentScrollWidth <= after.viewportWidth + 1 &&
      insideViewport,
    JSON.stringify({ before, after, panel, stableDocument, stableTable }),
  );
  return { menu, before, after, panel };
}

async function saveVisibleColumns(columns) {
  await must(
    "save QA column preferences",
    supabase.from("admin_user_preferences").upsert(
      {
        admin_user_id: adminId,
        view_key: "content-topics",
        preferences: { visibleColumns: columns },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "admin_user_id,view_key" },
    ),
  );
}

async function readTopic(id, columns) {
  return must(
    `read topic ${id}`,
    supabase.from("topics").select(columns).eq("id", id).single(),
  );
}

async function waitForFeatureState(page, title, featured) {
  await page.waitForFunction(
    ({ rowTitle, pressed }) => {
      const row = [...document.querySelectorAll("#content-topics-table tbody tr")]
        .find((item) => item.textContent?.includes(rowTitle));
      const button = row?.querySelector('button[aria-pressed]');
      return button?.getAttribute("aria-pressed") === String(pressed) &&
        button.getAttribute("aria-busy") !== "true";
    },
    { rowTitle: title, pressed: featured },
    { timeout: 20_000 },
  );
}

async function stickyActionsSnapshot(page) {
  const container = page.locator("#content-topics-table table").locator("..");
  const sticky = page
    .locator(
      '#content-topics-table thead [data-admin-grid-sticky="inline-end"]',
    )
    .first();
  const [containerBox, stickyBox] = await Promise.all([
    container.boundingBox(),
    sticky.boundingBox(),
  ]);
  return {
    containerBox,
    stickyBox,
    pageOverflow: await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    })),
  };
}

async function smoke(page, path, expectedText) {
  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // force-dynamic pages stream their RSC payload after domcontentloaded,
  // so wait for the expected text instead of sampling innerText once.
  const textFound = expectedText
    ? await page
        .getByText(expectedText)
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false)
    : true;
  check(
    `Smoke ${path}`,
    response?.status() === 200 && textFound,
    `${response?.status()} ${page.url()}`,
  );
}

try {
  await cleanup();
  const admin = await must(
    "create temporary admin",
    supabase
      .from("admin_users")
      .insert({
        username: adminUsername,
        email: adminEmail,
        password_hash: await bcrypt.hash(password, 12),
        full_name: `Topics Reference QA ${runId}`,
        role: "admin",
        is_active: true,
        session_version: 1,
      })
      .select("id")
      .single(),
  );
  adminId = admin.id;

  const category = await must(
    "create temporary category",
    supabase
      .from("topic_categories")
      .insert({
        name: `تصنيف مرجعي ${runId}`,
        slug: `${prefix}-category`,
        sort_order: 9980,
        is_active: true,
        color_token: "gold",
      })
      .select("id")
      .single(),
  );
  categoryId = category.id;

  const now = new Date().toISOString();
  const common = {
    excerpt: "هذا وصف مختصر مكتمل يزيد بوضوح عن عشرين حرفًا للنشر.",
    content: "محتوى تجريبي مؤقت لاختبار الإغلاق المرجعي لقائمة الموضوعات.",
    image: "/images/venesia-5.png",
    image_alt: "وصف صورة تجريبية مكتمل",
    category: `تصنيف مرجعي ${runId}`,
    category_slug: `${prefix}-category`,
    category_id: categoryId,
    content_type: "article",
    is_featured: false,
    is_popular: false,
    seo_title:
      "عنوان تجريبي متكامل لتحسين محركات البحث والتحقق من جاهزية النشر",
    seo_description:
      "وصف تجريبي متكامل لمحركات البحث مكتوب بطول كافٍ للتحقق من قواعد النشر في نظام إدارة المحتوى الموحد، مع تفاصيل إضافية واضحة تضمن استيفاء المتطلبات.",
    focus_keyword: "اختبار قائمة الموضوعات",
    seo_keywords: ["اختبار", "موضوعات"],
    faq: [],
    created_by: adminId,
    updated_by: adminId,
    created_at: now,
    updated_at: now,
    views_count: 0,
  };
  const stateRows = [
    {
      ...common,
      slug: `${prefix}-published`,
      title: titles.published,
      status: "published",
      published_at: now,
      published_by: adminId,
    },
    {
      ...common,
      slug: `${prefix}-unpublished`,
      title: titles.unpublished,
      status: "unpublished",
      published_at: now,
      published_by: adminId,
    },
    {
      ...common,
      slug: `${prefix}-draft`,
      title: titles.draft,
      status: "draft",
      image_alt: "",
      published_at: null,
      published_by: null,
    },
    {
      ...common,
      slug: `${prefix}-archived`,
      title: titles.archived,
      status: "archived",
      published_at: null,
      published_by: null,
    },
    {
      ...common,
      slug: `${prefix}-valid-draft`,
      title: titles.validDraft,
      status: "draft",
      published_at: null,
      published_by: null,
    },
  ];
  const fillerRows = Array.from({ length: 10 }, (_, index) => ({
    ...common,
    slug: `${prefix}-filler-${index + 1}`,
    title: `${String(index + 6).padStart(2, "0")} موضوع ترقيم ${runId}`,
    status: "draft",
    published_at: null,
    published_by: null,
  }));
  const seeded = await must(
    "seed temporary topics",
    supabase
      .from("topics")
      .insert([...stateRows, ...fillerRows])
      .select("id,title"),
  );
  for (const row of seeded) ids.set(row.title, row.id);

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    const text = message.text();
    if (
      expectedPreferenceConsoleError &&
      /Failed to load resource:\s*net::ERR_FAILED/i.test(text)
    ) {
      expectedPreferenceConsoleError = false;
      return;
    }
    if (
      message.type() === "error" ||
      (message.type() === "warning" &&
        /hydration|rsc|chunk|aria-|inert/i.test(text))
    ) {
      consoleIssues.push(`${message.type()}: ${text}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (expectedFailedRequests.has(request)) return;
    const errorText = request.failure()?.errorText ?? "";
    if (errorText !== "net::ERR_ABORTED") {
      networkIssues.push(`${request.method()} ${request.url()} ${errorText}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await login(page);
  await openTopics(page);

  const statusExpectations = [
    [titles.published, "منشور", "text-emerald-300"],
    [titles.unpublished, "مخفي", "text-[#D8B87A]"],
    [titles.draft, "مسودة", "text-sky-300"],
    [titles.archived, "مؤرشف", "text-white/45"],
  ];
  const statusResults = [];
  for (const [title, label, expectedClass] of statusExpectations) {
    const pill = rowByTitle(page, title).getByText(label, { exact: true });
    const style = await pill.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        className: element.className,
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
      };
    });
    statusResults.push({ title, label, expectedClass, ...style });
    check(
      `${label} uses its semantic status tone`,
      style.className.includes(expectedClass) &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)",
      JSON.stringify(style),
    );
  }
  check(
    "Four status tones remain visually distinct",
    new Set(statusResults.map((item) => item.color)).size === 4,
    JSON.stringify(statusResults),
  );
  await page.screenshot({ path: screenshots.statuses, fullPage: true });

  const featureTitle = titles.validDraft;
  let featureButton = rowByTitle(page, featureTitle).getByRole("button", {
    name: "تعيين كمميز",
  });
  check(
    "Featured star starts outlined from row.is_featured",
    (await featureButton.getAttribute("aria-pressed")) === "false" &&
      (await featureButton.locator("path").getAttribute("fill")) === "none",
  );
  await page.evaluate(() => {
    window.__topicsQaMarker = "preserved";
  });
  await featureButton.click();
  check(
    "Only the current star exposes pending state",
    (await featureButton.getAttribute("aria-busy")) === "true" &&
      (await page.locator('[aria-busy="true"]').count()) === 1,
  );
  await waitForFeatureState(page, featureTitle, true);
  check(
    "Feature action remains AJAX and commits database state",
    (await readTopic(ids.get(featureTitle), "is_featured")).is_featured ===
      true &&
      (await page.evaluate(() => window.__topicsQaMarker)) === "preserved",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#content-topics-table").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await waitForFeatureState(page, featureTitle, true);
  featureButton = rowByTitle(page, featureTitle).getByRole("button", {
    name: "إلغاء التمييز",
  });
  check(
    "Filled gold star survives full reload",
    (await featureButton.getAttribute("aria-pressed")) === "true" &&
      (await featureButton.locator("path").getAttribute("fill")) ===
        "currentColor",
  );
  await page.screenshot({ path: screenshots.featured, fullPage: true });

  await openTopics(
    page,
    `q=${encodeURIComponent(runId)}&featured=yes&sort=title_asc`,
  );
  check(
    "Featured state survives search, filter, and sort",
    (await rowByTitle(page, featureTitle)
      .getByRole("button", { name: "إلغاء التمييز" })
      .getAttribute("aria-pressed")) === "true",
  );
  await openTopics(
    page,
    `q=${encodeURIComponent(runId)}&sort=id_asc&limit=10&page=2`,
  );
  check("Pagination reaches the second QA page", /[?&]page=2/.test(page.url()));
  await openTopics(
    page,
    `q=${encodeURIComponent(runId)}&sort=id_asc&limit=10&page=1`,
  );
  featureButton = rowByTitle(page, featureTitle).getByRole("button", {
    name: "إلغاء التمييز",
  });
  check(
    "Featured state survives pagination round-trip",
    (await featureButton.getAttribute("aria-pressed")) === "true",
  );
  await featureButton.click();
  await waitForFeatureState(page, featureTitle, false);
  check(
    "Unfeature restores outlined star from database state",
    (await readTopic(ids.get(featureTitle), "is_featured")).is_featured ===
      false &&
      (await rowByTitle(page, featureTitle)
        .getByRole("button", { name: "تعيين كمميز" })
        .locator("path")
        .getAttribute("fill")) === "none",
  );

  let columnsGeometry = await columnsOverlayGeometry(
    page,
    "1440x900 default columns",
  );
  let columnsMenu = columnsGeometry.menu;
  const scrollbar = await columnsMenu
    .locator("[data-admin-column-scroll-area]")
    .evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        scrollbarWidth: computed.scrollbarWidth,
        scrollbarColor: computed.scrollbarColor,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    });
  check(
    "Columns menu uses shared thin scrollbar without filter height",
    scrollbar.maxHeight === "340px" &&
      scrollbar.overflowY === "auto" &&
      scrollbar.scrollbarWidth === "thin" &&
      scrollbar.scrollHeight > scrollbar.clientHeight,
    JSON.stringify(scrollbar),
  );
  await page.screenshot({ path: screenshots.columns, fullPage: true });
  await closeColumnsMenu(page);

  for (const viewport of [
    {
      width: 1280,
      height: 800,
      label: "1280x800 medium viewport",
      screenshot: screenshots.columnsMedium,
    },
    {
      width: 970,
      height: 1024,
      label: "970x1024 reference viewport",
      screenshot: screenshots.columnsCompact,
    },
  ]) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    columnsGeometry = await columnsOverlayGeometry(page, viewport.label);
    await page.screenshot({ path: viewport.screenshot, fullPage: true });
    await closeColumnsMenu(page);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await openTopics(
    page,
    `q=${encodeURIComponent(runId)}&sort=category_asc&limit=10&page=2`,
  );
  let preferenceBlocked = false;
  await page.route("**/admin/content/topics**", async (route) => {
    const request = route.request();
    if (
      !preferenceBlocked &&
      request.method() === "POST" &&
      request.headers()["next-action"]
    ) {
      preferenceBlocked = true;
      expectedFailedRequests.add(request);
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await openColumnsMenu(page);
  expectedPreferenceConsoleError = true;
  await page.getByLabel(/عمود التصنيف$/).click();
  await page.waitForFunction(
    () => !new URL(location.href).searchParams.has("sort"),
    undefined,
    { timeout: 20_000 },
  );
  const persistenceError = page.getByText(
    "تعذر حفظ تفضيلات الأعمدة.",
    { exact: true },
  );
  await persistenceError.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(200);
  expectedPreferenceConsoleError = false;
  check(
    "Hidden active sort resets once despite persistence failure",
    preferenceBlocked &&
      !new URL(page.url()).searchParams.has("sort") &&
      new URL(page.url()).searchParams.get("page") === "2" &&
      !(await page
        .getByRole("columnheader", { name: /التصنيف/ })
        .isVisible()
        .catch(() => false)) &&
      (await persistenceError.innerText()).includes("تعذر حفظ"),
    page.url(),
  );
  await page.screenshot({ path: screenshots.sortFailure, fullPage: true });
  await page.unroute("**/admin/content/topics**");

  const optionalColumns = [
    "category",
    "id",
    "views",
    "created_at",
    "updated_at",
    "created_by",
    "content_type",
    "series",
    "status",
    "featured",
    "published_at",
  ];
  await saveVisibleColumns(optionalColumns);
  await openTopics(page);
  let sticky = await stickyActionsSnapshot(page);
  check(
    "All columns keep actions fixed at visual far left",
    sticky.containerBox &&
      sticky.stickyBox &&
      Math.abs(sticky.stickyBox.x - sticky.containerBox.x) <= 4 &&
      sticky.pageOverflow.width <= sticky.pageOverflow.viewport + 1,
    JSON.stringify(sticky),
  );
  await page.screenshot({ path: screenshots.allColumns, fullPage: true });
  await columnsOverlayGeometry(page, "All columns");
  await page
    .getByRole("button", { name: "استعادة الأعمدة الافتراضية" })
    .click();
  await page.waitForFunction(() => {
    const headers = [
      ...document.querySelectorAll("#content-topics-table thead th"),
    ]
      .map((item) =>
        (item.textContent || "").replace(/[↕↑↓]/g, "").trim(),
      )
      .filter(Boolean);
    return (
      JSON.stringify(headers) ===
      JSON.stringify(["العنوان", "التصنيف", "الحالة", "الإجراءات"])
    );
  });
  check(
    "Restore main columns returns the shared default configuration",
    (await page
      .getByRole("button", { name: "الأعمدة", exact: true })
      .getAttribute("aria-expanded")) === "true",
  );
  await page
    .getByRole("button", { name: "الأعمدة", exact: true })
    .locator(".animate-spin")
    .waitFor({ state: "detached", timeout: 20_000 });
  await closeColumnsMenu(page);

  await saveVisibleColumns([]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#content-topics-table").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  sticky = await stickyActionsSnapshot(page);
  const headers = await page
    .locator("#content-topics-table thead th")
    .evaluateAll((items) =>
      items
        .map((item) => (item.textContent || "").replace(/[↕↑↓]/g, "").trim())
        .filter(Boolean),
    );
  check(
    "Minimum columns preserve fixed title and actions positions",
    JSON.stringify(headers) === JSON.stringify(["العنوان", "الإجراءات"]) &&
      sticky.containerBox &&
      sticky.stickyBox &&
      Math.abs(sticky.stickyBox.x - sticky.containerBox.x) <= 4,
    JSON.stringify({ headers, sticky }),
  );
  await page.screenshot({
    path: screenshots.minimumColumns,
    fullPage: true,
  });
  await columnsOverlayGeometry(page, "Minimum columns");
  await closeColumnsMenu(page);

  const invalidRow = rowByTitle(page, titles.draft);
  const publishButton = invalidRow.getByRole("button", {
    name: /محاولة النشر/,
  });
  await publishButton.click();
  check(
    "Publish validation pending is local to its row action",
    (await publishButton.getAttribute("aria-busy")) === "true" &&
      (await page.locator('[aria-busy="true"]').count()) === 1,
  );
  await page
    .getByText("تعذر نشر المحتوى", { exact: true })
    .waitFor({ state: "visible" });
  check(
    "Publish validation persists without changing draft state",
    (await readTopic(ids.get(titles.draft), "status")).status === "draft" &&
      (await page
        .getByRole("link", { name: "استكمال البيانات" })
        .getAttribute("href"))
        ?.includes("return_to="),
  );
  await page.screenshot({
    path: screenshots.publishValidation,
    fullPage: true,
  });

  const activityButton = rowByTitle(page, titles.published).getByRole(
    "button",
    { name: "معلومات النشاط" },
  );
  await activityButton.hover();
  check(
    "Activity remains click-only",
    !(await page
      .getByRole("dialog", { name: "معلومات نشاط المحتوى" })
      .isVisible()
      .catch(() => false)),
  );
  await activityButton.click();
  const activity = page.getByRole("dialog", {
    name: "معلومات نشاط المحتوى",
  });
  await activity.waitFor({ state: "visible" });
  const activitySurface = await activity.evaluate((element) => {
    const computed = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      parent: element.parentElement?.tagName,
      position: computed.position,
      overflowY: computed.overflowY,
      scrollbarWidth: computed.scrollbarWidth,
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  check(
    "Activity uses the shared bounded portal and scrollbar system",
    activitySurface.parent === "BODY" &&
      activitySurface.position === "fixed" &&
      activitySurface.overflowY === "auto" &&
      activitySurface.scrollbarWidth === "thin" &&
      activitySurface.left >= 11 &&
      activitySurface.right <= activitySurface.viewportWidth - 11 &&
      activitySurface.top >= 11 &&
      activitySurface.bottom <= activitySurface.viewportHeight - 11,
    JSON.stringify(activitySurface),
  );
  await page.screenshot({ path: screenshots.activity, fullPage: true });
  await activityButton.click();
  check(
    "Activity closes from its trigger",
    !(await activity.isVisible().catch(() => false)),
  );
  await activityButton.click();
  await page.keyboard.press("Escape");
  check(
    "Activity closes with Escape",
    !(await activity.isVisible().catch(() => false)),
  );
  await activityButton.click();
  await page.locator("h1").first().click();
  check(
    "Activity closes on outside click",
    !(await activity.isVisible().catch(() => false)),
  );

  await rowByTitle(page, titles.archived).getByRole("checkbox").check();
  await rowByTitle(page, titles.validDraft).getByRole("checkbox").check();
  await page.locator("#content-topics-table-bulk-action-trigger").click();
  await page
    .locator("#content-topics-table-bulk-action-listbox")
    .getByRole("option", { name: "نشر", exact: true })
    .click();
  await page.getByRole("button", { name: "تنفيذ" }).click();
  check(
    "Bulk publish exposes only its execution pending state",
    await page
      .getByRole("button", { name: "جار التنفيذ..." })
      .isDisabled(),
  );
  await page
    .getByText("تعذر نشر المحتوى", { exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent?.trim() === "تنفيذ",
      );
      return button && !button.disabled;
    },
    undefined,
    { timeout: 20_000 },
  );
  const [archivedAfterFailure, draftAfterFailure] = await Promise.all([
    readTopic(ids.get(titles.archived), "status"),
    readTopic(ids.get(titles.validDraft), "status"),
  ]);
  check(
    "Bulk publish validates all rows before updates and retains selection on failure",
    archivedAfterFailure.status === "archived" &&
      draftAfterFailure.status === "draft" &&
      (await page.getByText(/تم تحديد 2 موضوع/).isVisible()) &&
      !(await page.getByRole("button", { name: "تنفيذ" }).isDisabled()),
  );
  await page.screenshot({ path: screenshots.bulkFailure, fullPage: true });
  await page.getByRole("button", { name: "إلغاء التحديد" }).click();

  await rowByTitle(page, titles.published).getByRole("checkbox").check();
  await rowByTitle(page, titles.unpublished).getByRole("checkbox").check();
  await page.locator("#content-topics-table-bulk-action-trigger").click();
  await page
    .locator("#content-topics-table-bulk-action-listbox")
    .getByRole("option", { name: "تعيين كمميز", exact: true })
    .click();
  await page.evaluate(() => {
    window.__topicsBulkMarker = "preserved";
  });
  await page.getByRole("button", { name: "تنفيذ" }).click();
  await page
    .getByText("تم تحديث المحتوى", { exact: true })
    .waitFor({ state: "visible" });
  const [publishedFeatured, hiddenFeatured] = await Promise.all([
    readTopic(ids.get(titles.published), "is_featured"),
    readTopic(ids.get(titles.unpublished), "is_featured"),
  ]);
  check(
    "Bulk success remains AJAX and clears selection only after success",
    publishedFeatured.is_featured === true &&
      hiddenFeatured.is_featured === true &&
      (await page.evaluate(() => window.__topicsBulkMarker)) === "preserved" &&
      !(await page.getByText(/تم تحديد .* موضوع/).isVisible().catch(() => false)),
  );

  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  check(
    "Topics page has no page-level horizontal overflow",
    overflow.width <= overflow.viewport + 1,
    JSON.stringify(overflow),
  );

  await smoke(page, "/admin/content/categories", "إدارة التصنيفات");
  await smoke(page, "/admin/content/series", "إدارة السلاسل");
  await smoke(page, "/admin/content/topics/new", null);
  await smoke(
    page,
    `/admin/content/topics/${ids.get(titles.published)}`,
    null,
  );
  await smoke(
    page,
    `/admin/content/topics/${ids.get(titles.published)}/preview`,
    titles.published,
  );

  await page.waitForTimeout(800);
  check(
    "Console, hydration, RSC, chunk, and ARIA errors are zero",
    consoleIssues.length === 0,
    consoleIssues.join("\n"),
  );
  check("Page errors are zero", pageErrors.length === 0, pageErrors.join("\n"));
  check(
    "Unexpected failed requests are zero",
    networkIssues.length === 0,
    networkIssues.join("\n"),
  );
  check(
    "404 and 500 responses are zero",
    badResponses.length === 0,
    badResponses.join("\n"),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks,
    screenshots: reportScreenshots,
    consoleIssues,
    pageErrors,
    networkIssues,
    badResponses,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const failures = checks.filter((entry) => !entry.ok);
  if (failures.length) {
    throw new Error(`${failures.length} Topics reference QA checks failed.`);
  }
  console.log(
    `OK: Topics reference browser QA passed (${checks.length} checks).`,
  );
} catch (error) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks,
    screenshots: reportScreenshots,
    consoleIssues,
    pageErrors,
    networkIssues,
    badResponses,
    fatalError: error instanceof Error ? error.stack || error.message : String(error),
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  if (browser) await browser.close();
  await cleanup();
}
