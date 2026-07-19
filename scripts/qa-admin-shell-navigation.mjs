import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, ".tmp-qa/admin-shell");
const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const username = `__QA_SHELL_${runId}__`;
const password = randomBytes(24).toString("base64url");
const checks = [];
const issues = { console: [], page: [], failedRequests: [] };
let adminId = null;

mkdirSync(out, { recursive: true });

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

loadEnv(resolve(root, ".env.local"));
const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

async function setup() {
  const { data, error } = await supabase.from("admin_users").insert({
    username,
    email: `qa-shell-${runId}@example.test`,
    password_hash: await bcrypt.hash(password, 10),
    role: "super_admin",
    is_active: true,
  }).select("id").single();
  if (error) throw new Error(error.message);
  adminId = data.id;
}

async function cleanup() {
  if (!adminId) return;
  await supabase.from("admin_user_preferences").delete().eq("admin_user_id", adminId);
  await supabase.from("admin_audit_logs").delete().eq("actor_admin_user_id", adminId);
  await supabase.from("admin_users").delete().eq("id", adminId);
}

async function login(page) {
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  check("Auth page is excluded from Admin Shell", (await page.locator("[data-admin-shell]").count()) === 0);
  const result = await page.evaluate(async ({ username, password }) => {
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password, rememberMe: false }),
    });
    return { ok: response.ok, status: response.status };
  }, { username, password });
  if (!result.ok) throw new Error(`Login failed with ${result.status}`);
}

async function main() {
  const probe = await fetch(`${baseUrl}/admin/login`).catch(() => null);
  if (!probe?.ok) throw new Error(`Dev server required at ${baseUrl}`);
  await setup();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") issues.console.push(message.text()); });
  page.on("pageerror", (error) => issues.page.push(error.message));
  page.on("requestfailed", (request) => issues.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  try {
    await login(page);
    await page.goto(`${baseUrl}/admin/content/topics?q=shell`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("[data-admin-shell]").waitFor({ state: "visible", timeout: 20_000 });
    check("Admin Shell is mounted once", (await page.locator("[data-admin-shell]").count()) === 1);
    check("Page Header System resolves exactly one visible header", (await page.locator("[data-admin-page-header]:visible").count()) === 1);
    check("Company config source is explicit", Boolean(await page.locator("[data-admin-shell]").getAttribute("data-admin-company-source")));
    await page.locator("[data-admin-shell]").evaluate((node) => { node.dataset.qaShellIdentity = "persistent"; });

    const categoriesLink = page.locator('a[href="/admin/content/categories"]').first();
    await categoriesLink.hover();
    await categoriesLink.click();
    await page.waitForURL("**/admin/content/categories", { timeout: 60_000 });
    check("Navigation is a client transition with stable shell", (await page.locator('[data-admin-shell][data-qa-shell-identity="persistent"]').count()) === 1);
    check("Navigation pending state settles", (await page.locator("[data-admin-shell]").getAttribute("data-admin-navigation-pending")) === "false");
    check("Destination has unified header", (await page.locator("[data-admin-page-header]:visible").count()) === 1);

    await page.goBack({ waitUntil: "domcontentloaded" });
    check("Back navigation preserves search params", new URL(page.url()).searchParams.get("q") === "shell");
    await page.goForward();
    await page.waitForURL("**/admin/content/categories", { timeout: 30_000 });
    check("Forward navigation restores destination", new URL(page.url()).pathname === "/admin/content/categories");

    await page.goto(`${baseUrl}/admin/settings/general`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    check("General settings exposes company identity", (await page.locator("[data-admin-company-settings]").count()) === 1);
    check("Company media fields are available", (await page.locator('input[name="logoUrl"]').count()) === 1 && (await page.locator('input[name="compactLogoUrl"]').count()) === 1);
    await page.screenshot({ path: resolve(out, "desktop-admin-shell.png"), fullPage: true, caret: "initial" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/admin/content/topics`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "فتح القائمة" }).click();
    check("Mobile navigation opens as one dialog", (await page.getByRole("dialog", { name: "قائمة الإدارة" }).count()) === 1);
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    check("Mobile shell has no document overflow", !mobileOverflow);
    await page.screenshot({ path: resolve(out, "mobile-admin-shell.png"), fullPage: true, caret: "initial" });
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  await cleanup();
}

check("No browser page errors", issues.page.length === 0, issues.page.join(" | "));
check("No failed browser requests", issues.failedRequests.length === 0, issues.failedRequests.join(" | "));
const relevantConsole = issues.console.filter((message) => !message.includes("favicon"));
check("No relevant browser console errors", relevantConsole.length === 0, relevantConsole.join(" | "));
writeFileSync(resolve(out, "navigation-results.json"), JSON.stringify({ checks, issues }, null, 2));
const failed = checks.filter((item) => !item.ok);
console.log(`qa-admin-shell-navigation: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
