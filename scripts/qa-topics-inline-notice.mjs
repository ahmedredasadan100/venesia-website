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
const prefix = `qa-topics-notice-${runId}`;
const username = `__QA_TOPICS_NOTICE_${runId}__`;
const password = randomBytes(24).toString("base64url");
const title = `موضوع ملاحظة النشر ${runId}`;
const screenshotPath = resolve(OUTPUT, "topics-inline-publish-notice.png");
const reportPath = resolve(OUTPUT, "topics-inline-notice-report.json");

mkdirSync(OUTPUT, { recursive: true });
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
let browser;
let adminId;
let categoryId;
let topicId;

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

function topicRow(page) {
  return page
    .locator("#content-topics-table tbody tr")
    .filter({ hasText: title })
    .first();
}

async function triggerPublishFailure(page) {
  await topicRow(page)
    .getByRole("button", { name: /محاولة النشر/ })
    .click();
  const notice = page
    .locator('[data-admin-notice-layout="inline"]')
    .filter({ hasText: "تعذر نشر المحتوى" });
  await notice.waitFor({ state: "visible", timeout: 20_000 });
  return notice;
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
        full_name: `Topics Notice QA ${runId}`,
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
        name: `تصنيف ملاحظة ${runId}`,
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
  const topic = await must(
    "create invalid draft topic",
    supabase
      .from("topics")
      .insert({
        title,
        slug: `${prefix}-draft`,
        excerpt: "هذا وصف مختصر مكتمل يزيد بوضوح عن عشرين حرفًا للنشر.",
        content: "محتوى مؤقت لاختبار الملاحظة المشتركة.",
        image: "/images/venesia-5.png",
        image_alt: "",
        category: `تصنيف ملاحظة ${runId}`,
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
        focus_keyword: "اختبار ملاحظة النشر",
        seo_keywords: ["اختبار", "ملاحظة"],
        faq: [],
        created_by: adminId,
        updated_by: adminId,
        created_at: now,
        updated_at: now,
        views_count: 0,
      })
      .select("id")
      .single(),
  );
  topicId = topic.id;

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    const text = message.text();
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
  await page.waitForTimeout(500);

  let notice = await triggerPublishFailure(page);
  const noticeLayout = await notice.evaluate((element) => {
    const computed = getComputedStyle(element);
    const titleNode = element.querySelector("p");
    const messageNode = element.querySelector("p[title]");
    const actionNode = element.querySelector("a");
    const closeNode = element.querySelector(
      'button[aria-label="إغلاق الإشعار"]',
    );
    return {
      display: computed.display,
      flexWrap: computed.flexWrap,
      height: element.getBoundingClientRect().height,
      className: element.className,
      titleBox: titleNode?.getBoundingClientRect().toJSON(),
      messageBox: messageNode?.getBoundingClientRect().toJSON(),
      actionBox: actionNode?.getBoundingClientRect().toJSON(),
      closeBox: closeNode?.getBoundingClientRect().toJSON(),
      messageOverflow: messageNode
        ? {
            overflow: getComputedStyle(messageNode).overflow,
            textOverflow: getComputedStyle(messageNode).textOverflow,
            whiteSpace: getComputedStyle(messageNode).whiteSpace,
          }
        : null,
    };
  });
  check(
    "Publish failure uses one-line inline shared notice",
    noticeLayout.display === "flex" &&
      noticeLayout.flexWrap === "nowrap" &&
      noticeLayout.height <= 64,
    JSON.stringify(noticeLayout),
  );
  check(
    "Inline title uses the danger semantic color",
    noticeLayout.className.includes("text-red-300"),
    noticeLayout.className,
  );
  check(
    "Description is adjacent, flexible, and ellipsis-safe",
    noticeLayout.messageOverflow?.overflow === "hidden" &&
      noticeLayout.messageOverflow?.textOverflow === "ellipsis" &&
      noticeLayout.messageOverflow?.whiteSpace === "nowrap",
    JSON.stringify(noticeLayout.messageOverflow),
  );
  check(
    "RTL order keeps title right and close control left",
    noticeLayout.titleBox &&
      noticeLayout.messageBox &&
      noticeLayout.actionBox &&
      noticeLayout.closeBox &&
      noticeLayout.titleBox.x > noticeLayout.messageBox.x &&
      noticeLayout.messageBox.x > noticeLayout.actionBox.x &&
      noticeLayout.actionBox.x > noticeLayout.closeBox.x,
    JSON.stringify(noticeLayout),
  );

  const action = notice.getByRole("link", { name: "استكمال البيانات" });
  const actionHref = await action.getAttribute("href");
  check(
    "Completion action preserves return URL and focus target",
    actionHref?.includes(`/admin/content/topics/${topicId}`) &&
      actionHref.includes("return_to=") &&
      actionHref.endsWith("#topic-image-alt"),
    actionHref ?? "",
  );
  const actionProbe = await context.newPage();
  const actionResponse = await actionProbe.goto(`${baseUrl}${actionHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  check(
    "Completion action resolves successfully",
    actionResponse?.status() === 200 &&
      new URL(actionProbe.url()).searchParams.has("return_to"),
    actionProbe.url(),
  );
  await actionProbe.close();

  await page.evaluate(() => {
    window.__noticeDismissMarker = "preserved";
  });
  const urlBeforeDismiss = page.url();
  await notice
    .getByRole("button", { name: "إغلاق الإشعار" })
    .click();
  await notice.waitFor({ state: "hidden" });
  check(
    "Dismiss hides immediately without reload or navigation",
    page.url() === urlBeforeDismiss &&
      (await page.evaluate(() => window.__noticeDismissMarker)) ===
        "preserved",
  );

  notice = await triggerPublishFailure(page);
  check(
    "A repeated publish failure shows a fresh notice",
    await notice.isVisible(),
  );
  const actionAfterReset = notice.getByRole("link", {
    name: "استكمال البيانات",
  });
  await actionAfterReset.focus();
  await page.keyboard.press("Tab");
  check(
    "Keyboard order reaches the dismiss button",
    (await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label"),
    )) === "إغلاق الإشعار",
  );
  await page.keyboard.press("Escape");
  check(
    "Escape leaves the notice and existing keyboard behavior intact",
    await notice.isVisible(),
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const legacyMessage = `ملاحظة قديمة ${runId}`;
  await page.goto(
    `${baseUrl}/admin/content/topics?q=${encodeURIComponent(
      runId,
    )}&notice=error&message=${encodeURIComponent(legacyMessage)}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  const legacyNotice = page
    .locator('[data-admin-notice-layout="stacked"]')
    .filter({ hasText: legacyMessage });
  await legacyNotice.waitFor({ state: "visible" });
  const legacySnapshot = await legacyNotice.evaluate((element) => ({
    className: element.className,
    display: getComputedStyle(element).display,
    closeButtons: element.querySelectorAll(
      'button[aria-label="إغلاق الإشعار"]',
    ).length,
  }));
  check(
    "Legacy stacked notice keeps its original default presentation",
    legacySnapshot.className.includes("rounded-[22px]") &&
      legacySnapshot.className.includes("px-5") &&
      legacySnapshot.className.includes("py-4") &&
      legacySnapshot.display === "block" &&
      legacySnapshot.closeButtons === 0,
    JSON.stringify(legacySnapshot),
  );

  const overflow = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  check(
    "Notice variants create no page-level horizontal overflow",
    overflow.pageWidth <= overflow.viewportWidth + 1,
    JSON.stringify(overflow),
  );
  check(
    "Console, hydration, RSC, chunk, and ARIA issues are zero",
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
    screenshot: relative(ROOT, screenshotPath).replaceAll("\\", "/"),
    consoleIssues,
    pageErrors,
    networkIssues,
    badResponses,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const failures = checks.filter((entry) => !entry.ok);
  if (failures.length) {
    throw new Error(`${failures.length} focused notice QA checks failed.`);
  }
  console.log(`OK: Focused inline notice QA passed (${checks.length} checks).`);
} catch (error) {
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        checks,
        screenshot: relative(ROOT, screenshotPath).replaceAll("\\", "/"),
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
