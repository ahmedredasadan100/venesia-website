/**
 * Browser + database verification for the shared Topics featured mutation.
 * Creates isolated fixtures, exercises the real menu click and Server Action,
 * and removes every fixture in finally.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

import { loadEnvFile, requireEnv } from "../../scripts/lib/env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFile(resolve(root, ".env.local"));

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const username = `__QA_FEATURED_${runId}__`;
const password = randomBytes(24).toString("base64url");
const slug = `qa-featured-${runId}`;
const title = `QA Featured ${runId}`;
const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let adminId = null;
let topicId = null;
let passed = 0;

function check(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!condition) throw new Error(label);
  passed += 1;
}

async function setup() {
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .insert({
      username,
      email: `qa-featured-${runId}@example.test`,
      password_hash: await bcrypt.hash(password, 10),
      role: "super_admin",
      is_active: true,
    })
    .select("id")
    .single();
  if (adminError) throw new Error(adminError.message);
  adminId = admin.id;

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .insert({
      title,
      slug,
      excerpt: title,
      content: title,
      image: "",
      category: "QA",
      category_slug: "qa",
      content_type: "article",
      status: "published",
      is_featured: true,
      published_at: new Date().toISOString(),
      created_by: adminId,
      updated_by: adminId,
      published_by: adminId,
    })
    .select("id")
    .single();
  if (topicError) throw new Error(topicError.message);
  topicId = topic.id;
}

async function cleanup() {
  if (topicId) await supabase.from("topics").delete().eq("id", topicId);
  if (!adminId) return;
  await supabase.from("admin_user_preferences").delete().eq("admin_user_id", adminId);
  await supabase.from("admin_audit_logs").delete().eq("actor_admin_user_id", adminId);
  await supabase.from("admin_users").delete().eq("id", adminId);
}

let browser = null;

try {
  await setup();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
  const login = await page.evaluate(async ({ username, password }) => {
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password, rememberMe: false }),
    });
    return { ok: response.ok, status: response.status };
  }, { username, password });
  check("Admin fixture login succeeds", login.ok, String(login.status));

  await page.goto(`${baseUrl}/admin/content/topics?q=${encodeURIComponent(title)}`, {
    waitUntil: "networkidle",
  });
  const row = page.locator(`[data-entity-row-id="${topicId}"]`);
  await row.waitFor({ state: "visible" });
  const star = row.locator('[data-admin-row-action="featured"] button');
  check("Initial aria-pressed reflects featured database truth", (await star.getAttribute("aria-pressed")) === "true");
  check("Initial star is filled", (await star.locator("svg path").getAttribute("fill")) === "currentColor");

  let releaseAction;
  const releasePromise = new Promise((resolveRelease) => { releaseAction = resolveRelease; });
  let markIntercepted;
  const interceptedPromise = new Promise((resolveIntercepted) => { markIntercepted = resolveIntercepted; });
  let actionResponseStatus = null;

  await page.route("**/admin/content/topics*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) {
      return route.continue();
    }
    markIntercepted();
    await releasePromise;
    const response = await route.fetch();
    actionResponseStatus = response.status();
    await route.fulfill({ response });
  });

  await row.locator('[data-admin-row-action="more"] button').click();
  const unfeature = page.locator('[data-admin-row-action-menu-item="featured"]');
  await unfeature.waitFor({ state: "visible" });
  check("Menu exposes the unfeature command", (await unfeature.getAttribute("aria-label"))?.includes("إلغاء") === true);
  await unfeature.click();
  await interceptedPromise;

  await page.waitForFunction(
    ({ topicId }) => {
      const button = document.querySelector(`[data-admin-row-action="featured"][data-admin-entity-id="${topicId}"] button`);
      return button?.getAttribute("aria-pressed") === "false" && button.getAttribute("aria-busy") === "true";
    },
    { topicId },
    { timeout: 5_000 },
  );
  check("Optimistic update changes aria-pressed before Server Action completion", (await star.getAttribute("aria-pressed")) === "false");
  check("Spinner owns the pending interval", (await star.getAttribute("aria-busy")) === "true");
  check("Pending row exposes the shared spinner", (await star.locator("span.animate-spin").count()) === 1);

  const { data: pendingTopic, error: pendingError } = await supabase
    .from("topics")
    .select("is_featured")
    .eq("id", topicId)
    .single();
  if (pendingError) throw new Error(pendingError.message);
  check("Optimistic state does not replace database truth", pendingTopic.is_featured === true);

  releaseAction();
  await page.waitForFunction(
    ({ topicId }) => {
      const button = document.querySelector(`[data-admin-row-action="featured"][data-admin-entity-id="${topicId}"] button`);
      return button?.getAttribute("aria-busy") !== "true";
    },
    { topicId },
  );
  check("Server Action succeeds", actionResponseStatus === 200, String(actionResponseStatus));
  check("Spinner ends after reconcile and invalidation", (await star.getAttribute("aria-busy")) !== "true");
  check("Final aria-pressed remains reconciled", (await star.getAttribute("aria-pressed")) === "false");
  check("Final star is unfilled", (await star.locator("svg path").getAttribute("fill")) === "none");
  await page.getByText("تم إلغاء تمييز المحتوى.", { exact: true }).waitFor({ state: "visible" });
  check("Success feedback is published after the mutation lifecycle", true);

  const { data: finalTopic, error: finalError } = await supabase
    .from("topics")
    .select("is_featured")
    .eq("id", topicId)
    .single();
  if (finalError) throw new Error(finalError.message);
  check("Final database truth is unfeatured", finalTopic.is_featured === false);
  check("Visibility row action remains available", await row.locator('[data-admin-row-action="visibility"] button:not([disabled])').count() === 1);
  check("More row action remains available", await row.locator('[data-admin-row-action="more"] button:not([disabled])').count() === 1);

  console.log(`Featured toggle browser/database verification passed (${passed} checks).`);
} finally {
  if (browser) await browser.close();
  await cleanup();
}
