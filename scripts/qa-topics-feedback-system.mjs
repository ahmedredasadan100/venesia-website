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
const baseUrl = "http://127.0.0.1:3000";
const runId = Date.now().toString(36);
const prefix = `qa-topics-feedback-${runId}`;
const username = `__QA_TOPICS_FEEDBACK_${runId}__`;
const password = randomBytes(24).toString("base64url");
const reportPath = resolve(OUTPUT, "topics-feedback-system-report.json");
const screenshots = {
  feature: resolve(OUTPUT, "topics-feedback-feature-success.png"),
  dialog: resolve(OUTPUT, "topics-delete-confirm-dialog.png"),
  delete: resolve(OUTPUT, "topics-feedback-delete-success.png"),
};

mkdirSync(OUTPUT, { recursive: true });
loadEnv(resolve(ROOT, ".env.local"));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const titles = {
  feature: `موضوع تمييز ${runId}`,
  deleteSuccess: `موضوع حذف ناجح ${runId}`,
  deleteFailure: `موضوع حذف فاشل ${runId}`,
  validation: `موضوع تحقق نشر ${runId}`,
};
const checks = [];
const consoleIssues = [];
const pageErrors = [];
const networkIssues = [];
const badResponses = [];
let browser;
let adminId;
let categoryId;
let topicIds = {};

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
  await supabase.from("topic_categories").delete().like("slug", `${prefix}%`);
  await supabase.from("admin_users").delete().eq("username", username);
}

async function login(page) {
  await page.goto(`${baseUrl}/admin/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const result = await page.evaluate(
    async ({ adminUsername, adminPassword }) => {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
          rememberMe: false,
        }),
      });
      return { ok: response.ok, status: response.status };
    },
    { adminUsername: username, adminPassword: password },
  );
  if (!result.ok) throw new Error(`QA login failed: ${result.status}`);
}

function topicRow(page, title) {
  return page
    .locator("#content-topics-table tbody tr")
    .filter({ hasText: title })
    .first();
}

function inlineNotice(page, title) {
  return page
    .locator(
      '#content-topics-table [data-admin-notice-layout="inline"]',
    )
    .filter({ hasText: title })
    .first();
}

async function assertSingleFeedback(page, notice, label) {
  await notice.waitFor({ state: "visible", timeout: 20_000 });
  const notices = page.locator(
    "#content-topics-table [data-admin-notice-layout]",
  );
  check(
    `${label} uses one non-conflicting feedback representation`,
    (await notices.count()) === 1,
    `count=${await notices.count()}`,
  );
  const closeButton = notice.getByRole("button", {
    name: "إغلاق الإشعار",
  });
  check(
    `${label} is inline and dismissible`,
    (await notice.getAttribute("data-admin-notice-layout")) === "inline" &&
      (await closeButton.count()) === 1,
  );
}

async function dismissWithoutNavigation(page, notice, label) {
  const marker = `${label}-${Date.now()}`;
  await page.evaluate((value) => {
    window.__feedbackDismissMarker = value;
  }, marker);
  const before = page.url();
  await notice
    .getByRole("button", { name: "إغلاق الإشعار" })
    .click();
  await notice.waitFor({ state: "hidden" });
  check(
    `${label} dismisses without reload or navigation`,
    page.url() === before &&
      (await page.evaluate(() => window.__feedbackDismissMarker)) === marker,
  );
}

function topicFixture({
  title,
  slug,
  imageAlt = "وصف صورة صالح للنشر",
}) {
  const now = new Date().toISOString();
  return {
    title,
    slug,
    excerpt: "هذا وصف مختصر مكتمل يزيد بوضوح عن عشرين حرفًا للنشر.",
    content: "محتوى مؤقت لاختبار نظام ملاحظات وإجراءات الإدارة المشترك.",
    image: "/images/venesia-5.png",
    image_alt: imageAlt,
    category: `تصنيف ملاحظات ${runId}`,
    category_slug: `${prefix}-category`,
    category_id: categoryId,
    content_type: "article",
    status: "draft",
    is_featured: false,
    is_popular: false,
    seo_title:
      "عنوان تجريبي متكامل لتحسين محركات البحث والتحقق من جاهزية النشر",
    seo_description:
      "وصف تجريبي متكامل لمحركات البحث مكتوب بطول كافٍ للتحقق من قواعد النشر في نظام إدارة المحتوى الموحد، مع تفاصيل إضافية واضحة تضمن استيفاء المتطلبات.",
    focus_keyword: "اختبار نظام ملاحظات الإدارة",
    seo_keywords: ["اختبار", "ملاحظات"],
    faq: [],
    created_by: adminId,
    updated_by: adminId,
    created_at: now,
    updated_at: now,
    views_count: 0,
  };
}

try {
  await cleanup();
  const admin = await must(
    "create temporary admin",
    supabase
      .from("admin_users")
      .insert({
        username,
        email: `${prefix}@venesia.local`,
        password_hash: await bcrypt.hash(password, 12),
        full_name: `Topics Feedback QA ${runId}`,
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
        name: `تصنيف ملاحظات ${runId}`,
        slug: `${prefix}-category`,
        sort_order: 9980,
        is_active: true,
        color_token: "gold",
      })
      .select("id")
      .single(),
  );
  categoryId = category.id;

  const topics = await must(
    "create feedback topics",
    supabase
      .from("topics")
      .insert([
        topicFixture({
          title: titles.feature,
          slug: `${prefix}-feature`,
        }),
        topicFixture({
          title: titles.deleteSuccess,
          slug: `${prefix}-delete-success`,
        }),
        topicFixture({
          title: titles.deleteFailure,
          slug: `${prefix}-delete-failure`,
        }),
        topicFixture({
          title: titles.validation,
          slug: `${prefix}-validation`,
          imageAlt: "",
        }),
      ])
      .select("id,title"),
  );
  topicIds = Object.fromEntries(
    topics.map((topic) => [
      Object.entries(titles).find(([, title]) => title === topic.title)?.[0],
      topic.id,
    ]),
  );

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  let actionPosts = 0;
  let delayNextActionPost = false;
  await page.route("**/admin/content/topics*", async (route) => {
    if (route.request().method() === "POST" && delayNextActionPost) {
      delayNextActionPost = false;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
    }
    await route.continue();
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/admin/content/topics"
    ) {
      actionPosts += 1;
    }
  });
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error" ||
      (message.type() === "warning" &&
        /hydration|rsc|chunk|aria-|inert|focus/i.test(text))
    ) {
      consoleIssues.push(`${message.type()}: ${text}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    if (failure !== "net::ERR_ABORTED") {
      networkIssues.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await login(page);
  const listUrl = `${baseUrl}/admin/content/topics?q=${encodeURIComponent(runId)}`;
  await page.goto(listUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator("#content-topics-table").waitFor({ state: "visible" });
  await topicRow(page, titles.feature).waitFor({ state: "visible" });

  await topicRow(page, titles.feature)
    .getByRole("button", { name: "تعيين كمميز" })
    .click();
  let notice = inlineNotice(page, "تم تحديث التمييز");
  await assertSingleFeedback(page, notice, "Feature success");
  check(
    "Feature success retains its existing title and message",
    (await notice.getByText("تم تعيين المحتوى كمميز.", { exact: true }).count()) ===
      1 &&
      (await notice.getByRole("link").count()) === 0,
  );
  await page.screenshot({ path: screenshots.feature, fullPage: true });
  await dismissWithoutNavigation(page, notice, "Feature success");

  const unfeatureButton = topicRow(page, titles.feature).getByRole("button", {
    name: "إلغاء التمييز",
  });
  await unfeatureButton.waitFor({ state: "visible", timeout: 20_000 });
  await unfeatureButton.click();
  notice = inlineNotice(page, "تم تحديث التمييز");
  await assertSingleFeedback(page, notice, "Unfeature success");
  check(
    "Unfeature success retains its existing message",
    (await notice.getByText("تم إلغاء تمييز المحتوى.", { exact: true }).count()) ===
      1,
  );
  await dismissWithoutNavigation(page, notice, "Unfeature success");

  await topicRow(page, titles.validation)
    .getByRole("button", { name: /محاولة النشر/ })
    .click();
  notice = inlineNotice(page, "تعذر نشر المحتوى");
  await assertSingleFeedback(page, notice, "Publish validation");
  const completionAction = notice.getByRole("link", {
    name: "استكمال البيانات",
  });
  const completionHref = await completionAction.getAttribute("href");
  check(
    "Publish validation exposes the real repair action and return URL",
    completionHref?.includes(
      `/admin/content/topics/${topicIds.validation}`,
    ) &&
      completionHref.includes("return_to=") &&
      completionHref.endsWith("#topic-image-alt"),
    completionHref ?? "",
  );
  await dismissWithoutNavigation(page, notice, "Publish validation");

  let postsBefore = actionPosts;
  let deleteTrigger = topicRow(page, titles.deleteSuccess).getByRole("button", {
    name: "حذف آمن",
  });
  await deleteTrigger.click();
  let dialog = page.getByRole("dialog", {
    name: "هل أنت متأكد من حذف المحتوى؟",
  });
  await dialog.waitFor({ state: "visible" });
  const dialogSnapshot = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      ariaModal: element.getAttribute("aria-modal"),
      describedBy: element.getAttribute("aria-describedby"),
      tone: element.getAttribute("data-tone"),
      centerDeltaX: Math.abs(box.left + box.width / 2 - window.innerWidth / 2),
      centerDeltaY: Math.abs(box.top + box.height / 2 - window.innerHeight / 2),
    };
  });
  check(
    "Delete opens the shared centered danger confirmation dialog",
    dialogSnapshot.ariaModal === "true" &&
      Boolean(dialogSnapshot.describedBy) &&
      dialogSnapshot.tone === "danger" &&
      dialogSnapshot.centerDeltaX < 2 &&
      dialogSnapshot.centerDeltaY < 2,
    JSON.stringify(dialogSnapshot),
  );
  check(
    "Dialog keeps the requested title, description, and controls",
    (await dialog
      .getByText(
        "سيتم حذف المحتوى حذفًا آمنًا وإزالته من القائمة.",
        { exact: true },
      )
      .count()) === 1 &&
      (await dialog.getByRole("button", { name: "إلغاء" }).count()) === 1 &&
      (await dialog
        .getByRole("button", { name: "تأكيد الحذف" })
        .count()) === 1,
  );
  await page.waitForFunction(
    () =>
      document.activeElement?.hasAttribute("data-admin-confirm-cancel") ===
      true,
  );
  check(
    "Initial dialog focus is on the safe cancel action",
    await page.evaluate(
      () =>
        document.activeElement?.hasAttribute("data-admin-confirm-cancel") ===
        true,
    ),
  );
  await page.keyboard.press("Shift+Tab");
  check(
    "Focus trap wraps backward to the confirm action",
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) ===
      "تأكيد الحذف",
  );
  await page.keyboard.press("Tab");
  check(
    "Focus trap wraps forward to the cancel action",
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) ===
      "إلغاء",
  );
  await page.screenshot({ path: screenshots.dialog, fullPage: true });
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForTimeout(100);
  check(
    "Cancel does not execute deletion and restores trigger focus",
    actionPosts === postsBefore &&
      (await deleteTrigger.evaluate(
        (element) => element === document.activeElement,
      )),
  );

  const afterCancel = await must(
    "verify cancel preserved topic",
    supabase
      .from("topics")
      .select("deleted_at")
      .eq("id", topicIds.deleteSuccess)
      .single(),
  );
  check("Cancel preserves the database row", afterCancel.deleted_at === null);

  await deleteTrigger.click();
  dialog = page.getByRole("dialog", {
    name: "هل أنت متأكد من حذف المحتوى؟",
  });
  await dialog.waitFor({ state: "visible" });
  postsBefore = actionPosts;
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page
    .waitForFunction(
      (expectedTitle) =>
        document.activeElement?.getAttribute("aria-label") === "حذف آمن" &&
        document.activeElement
          ?.closest("tr")
          ?.textContent?.includes(expectedTitle),
      titles.deleteSuccess,
      { timeout: 2_000 },
    )
    .catch(() => {});
  const escapeFocusRestored = await deleteTrigger.evaluate(
    (element) => element === document.activeElement,
  );
  check(
    "Escape closes without deletion and restores trigger focus",
    actionPosts === postsBefore && escapeFocusRestored,
    `posts=${actionPosts - postsBefore}; focus=${escapeFocusRestored}`,
  );

  await deleteTrigger.click();
  dialog = page.getByRole("dialog", {
    name: "هل أنت متأكد من حذف المحتوى؟",
  });
  await dialog.waitFor({ state: "visible" });
  postsBefore = actionPosts;
  delayNextActionPost = true;
  const confirmButton = dialog.getByRole("button", {
    name: "تأكيد الحذف",
  });
  await confirmButton.evaluate((button) => {
    button.click();
    button.click();
  });
  await page.waitForFunction(() => {
    const activeDialog = document.querySelector(
      "[data-admin-confirm-dialog]",
    );
    return activeDialog?.getAttribute("aria-busy") === "true";
  });
  check(
    "Pending state disables repeat confirmation",
    await dialog.getByRole("button", { name: /جارٍ التنفيذ/ }).isDisabled(),
  );
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  check(
    "Confirmed deletion executes exactly once",
    actionPosts - postsBefore === 1,
    `posts=${actionPosts - postsBefore}`,
  );
  await topicRow(page, titles.deleteSuccess).waitFor({
    state: "hidden",
    timeout: 20_000,
  });
  notice = inlineNotice(page, "تم حذف المحتوى");
  await assertSingleFeedback(page, notice, "Delete success");
  check(
    "Successful deletion closes the dialog, removes the row, and reports success",
    (await page.getByRole("dialog").count()) === 0 &&
      (await notice
        .getByText(
          "تم الحذف الآمن وإزالة المحتوى من القائمة.",
          { exact: true },
        )
        .count()) === 1,
  );
  await page.screenshot({ path: screenshots.delete, fullPage: true });
  await dismissWithoutNavigation(page, notice, "Delete success");

  deleteTrigger = topicRow(page, titles.deleteFailure).getByRole("button", {
    name: "حذف آمن",
  });
  await deleteTrigger.click();
  dialog = page.getByRole("dialog", {
    name: "هل أنت متأكد من حذف المحتوى؟",
  });
  await dialog.waitFor({ state: "visible" });
  await must(
    "invalidate deletion fixture",
    supabase
      .from("topics")
      .update({
        status: "archived",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", topicIds.deleteFailure),
  );
  await dialog.getByRole("button", { name: "تأكيد الحذف" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  notice = inlineNotice(page, "تعذر تنفيذ العملية");
  await assertSingleFeedback(page, notice, "Delete failure");
  check(
    "Failed deletion never reports success",
    (await page.getByText("تم حذف المحتوى", { exact: true }).count()) === 0 &&
      (await notice
        .getByText(
          "المحتوى غير موجود أو تم حذفه.",
          { exact: true },
        )
        .count()) === 1,
  );
  await dismissWithoutNavigation(page, notice, "Delete failure");

  const overflow = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  check(
    "Feedback and dialog create no page-level horizontal overflow",
    overflow.pageWidth <= overflow.viewportWidth + 1,
    JSON.stringify(overflow),
  );

  const legacyMessage = `ملاحظة نظام حرجة ${runId}`;
  await page.goto(
    `${baseUrl}/admin/content/topics?q=${encodeURIComponent(
      runId,
    )}&notice=error&message=${encodeURIComponent(legacyMessage)}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  const stackedNotice = page
    .locator('[data-admin-notice-layout="stacked"]')
    .filter({ hasText: legacyMessage });
  await stackedNotice.waitFor({ state: "visible" });
  check(
    "Critical stacked default remains unchanged and non-dismissible",
    (await stackedNotice.getAttribute("class"))?.includes("rounded-[22px]") &&
      (await stackedNotice.getAttribute("class"))?.includes("px-5") &&
      (await stackedNotice
        .getByRole("button", { name: "إغلاق الإشعار" })
        .count()) === 0,
  );
  check(
    "Console, hydration, RSC, chunk, focus, and ARIA issues are zero",
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
    screenshots: Object.fromEntries(
      Object.entries(screenshots).map(([key, path]) => [
        key,
        relative(ROOT, path).replaceAll("\\", "/"),
      ]),
    ),
    consoleIssues,
    pageErrors,
    networkIssues,
    badResponses,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const failures = checks.filter((entry) => !entry.ok);
  if (failures.length) {
    throw new Error(`${failures.length} focused feedback QA checks failed.`);
  }
  console.log(
    `OK: Focused Topics feedback-system QA passed (${checks.length} checks).`,
  );
} catch (error) {
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        checks,
        screenshots: Object.fromEntries(
          Object.entries(screenshots).map(([key, path]) => [
            key,
            relative(ROOT, path).replaceAll("\\", "/"),
          ]),
        ),
        consoleIssues,
        pageErrors,
        networkIssues,
        badResponses,
        fatalError:
          error instanceof Error ? error.stack || error.message : String(error),
      },
      null,
      2,
    )}\n`,
  );
  throw error;
} finally {
  if (browser) await browser.close();
  await cleanup();
}
