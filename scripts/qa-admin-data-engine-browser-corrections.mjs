import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, ".tmp-qa", "admin-data-engine-corrections");
const baseUrl = "http://localhost:3000";
const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const prefix = `qa-correction-browser-${runId}`;
const username = `__QA_CORRECTION_${runId}__`;
const password = randomBytes(24).toString("base64url");
const checks = [];
const issues = { console: [], page: [], failedRequests: [] };
const ids = { admin: null, categories: [], series: [], topics: [] };

mkdirSync(OUT, { recursive: true });

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

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

loadEnv(resolve(ROOT, ".env.local"));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function cleanup() {
  const errors = [];
  for (const [table, values] of [["topics", ids.topics], ["topic_series", ids.series], ["topic_categories", [...ids.categories].reverse()]]) {
    if (!values.length) continue;
    const { error } = await supabase.from(table).delete().in("id", values);
    if (error) errors.push(`${table}: ${error.message}`);
  }
  if (ids.admin) {
    await supabase.from("admin_user_preferences").delete().eq("admin_user_id", ids.admin);
    await supabase.from("admin_audit_logs").delete().eq("actor_admin_user_id", ids.admin);
    const { error } = await supabase.from("admin_users").delete().eq("id", ids.admin);
    if (error) errors.push(`admin_users: ${error.message}`);
  }
  check("Browser fixture cleanup succeeds", errors.length === 0, errors.join(" | "));
}

async function waitForCategoryState(id, expected) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const { data } = await supabase.from("topic_categories").select("is_active").eq("id", id).maybeSingle();
    if (Boolean(data?.is_active) === expected) return true;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  return false;
}

async function setup() {
  const admin = await must("create admin", supabase.from("admin_users").insert({ username, email: `${prefix}@venesia.local`, password_hash: await bcrypt.hash(password, 10), role: "super_admin", is_active: true }).select("id").single());
  ids.admin = admin.id;
  const categories = await must("create action categories", supabase.from("topic_categories").insert([
    { name: `${prefix} hidden`, slug: `${prefix}-hidden`, is_active: false, status: "draft", sort_order: 995001 },
    { name: `${prefix} guarded`, slug: `${prefix}-guarded`, is_active: true, status: "published", sort_order: 995002 },
    { name: `${prefix} clean`, slug: `${prefix}-clean`, is_active: true, status: "published", sort_order: 995003 },
  ]).select("id,name,slug"));
  ids.categories.push(...categories.map((row) => row.id));
  const [hidden, guarded, clean] = categories;
  const geometry = await must("create geometry categories", supabase.from("topic_categories").insert(Array.from({ length: 105 }, (_, index) => ({ name: `${prefix} geometry ${String(index + 1).padStart(3, "0")}`, slug: `${prefix}-geometry-${index + 1}`, is_active: true, status: "published", sort_order: 996000 + index }))).select("id"));
  ids.categories.push(...geometry.map((row) => row.id));
  const child = await must("create child", supabase.from("topic_categories").insert({ name: `${prefix} child`, slug: `${prefix}-child`, parent_id: guarded.id, is_active: true, status: "published" }).select("id").single());
  ids.categories.push(child.id);
  const series = await must("create guarded series", supabase.from("topic_series").insert({ name: `${prefix} series`, slug: `${prefix}-series`, category_id: guarded.id, status: "published" }).select("id").single());
  ids.series.push(series.id);
  const now = new Date().toISOString();
  const topic = await must("create guarded topic", supabase.from("topics").insert({ slug: `${prefix}-topic`, title: `${prefix} topic`, excerpt: "QA", content: "QA", image: "/images/venesia-5.png", image_alt: "QA", category: guarded.name, category_slug: guarded.slug, category_id: guarded.id, series_id: series.id, content_type: "article", status: "draft", created_at: now, updated_at: now }).select("id").single());
  ids.topics.push(topic.id);
  return { hidden, guarded, clean };
}

async function login(page) {
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const result = await page.evaluate(async ({ username, password }) => {
    const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ username, password, rememberMe: false }) });
    return { ok: response.ok, status: response.status };
  }, { username, password });
  if (!result.ok) throw new Error(`login failed: ${result.status}`);
}

async function geometry(page, pageNumber) {
  await page.goto(`${baseUrl}/admin/content/categories?q=${encodeURIComponent(prefix)}&page=${pageNumber}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('[data-admin-pagination-nav]').waitFor({ state: "visible", timeout: 20_000 });
  return page.locator('[data-admin-pagination-nav]').evaluate((nav) => ({
    page: new URL(location.href).searchParams.get("page") ?? "1",
    nav: nav.getBoundingClientRect().toJSON(),
    slots: Array.from(nav.querySelectorAll('[data-admin-pagination-slot]')).map((node) => ({ kind: node.getAttribute('data-admin-pagination-slot'), text: node.textContent?.trim(), rect: node.getBoundingClientRect().toJSON() })),
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
}

async function main() {
  const fixture = await setup();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) issues.console.push(`${message.type()}: ${message.text()}`); });
  page.on("pageerror", (error) => issues.page.push(error.message));
  page.on("requestfailed", (request) => issues.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  try {
    await login(page);
    await page.goto(`${baseUrl}/admin/content/categories?q=${encodeURIComponent(prefix)}&limit=50`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const hiddenRow = page.locator(`[data-entity-row-id="${fixture.hidden.id}"]`);
    await hiddenRow.waitFor({ state: "visible", timeout: 20_000 });
    const show = hiddenRow.getByRole("button", { name: "إظهار التصنيف", exact: true });
    check("Hidden category exposes one show action", (await show.count()) === 1);
    await show.click();
    check("Hidden → shown persists in DB", await waitForCategoryState(fixture.hidden.id, true));
    await hiddenRow.getByRole("button", { name: "إخفاء التصنيف", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    check("Shown success notice is exact", (await page.getByText("تم إظهار التصنيف بنجاح.", { exact: true }).count()) === 1);
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedRow = page.locator(`[data-entity-row-id="${fixture.hidden.id}"]`);
    check("Refresh preserves shown state", (await reloadedRow.getByRole("button", { name: "إخفاء التصنيف", exact: true }).count()) === 1);
    await reloadedRow.getByRole("button", { name: "إخفاء التصنيف", exact: true }).click();
    check("Shown → hidden persists in DB", await waitForCategoryState(fixture.hidden.id, false));
    await reloadedRow.getByRole("button", { name: "إظهار التصنيف", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    check("Hidden success notice is exact", (await page.getByText("تم إخفاء التصنيف بنجاح.", { exact: true }).count()) === 1);

    await supabase.from("topic_categories").delete().eq("id", fixture.hidden.id);
    ids.categories = ids.categories.filter((id) => id !== fixture.hidden.id);
    await reloadedRow.getByRole("button", { name: "إظهار التصنيف", exact: true }).click();
    check("Forced visibility failure shows no success", (await page.getByText("تم إظهار التصنيف بنجاح.", { exact: true }).count()) === 0);
    const failureNotice = page.getByText("التصنيف غير موجود.", { exact: true });
    await failureNotice.waitFor({ state: "visible", timeout: 20_000 });
    check("Forced visibility failure uses shared danger notice", (await failureNotice.count()) === 1);

    const guardedRow = page.locator(`[data-entity-row-id="${fixture.guarded.id}"]`);
    await guardedRow.getByRole("button", { name: "حذف التصنيف", exact: true }).click();
    const expectedBlock = "لا يمكن حذف التصنيف لأنه مرتبط بـ 1 موضوعات و1 سلسلة محتوى و1 تصنيفات فرعية. انقل العناصر المرتبطة إلى تصنيف آخر أولًا.";
    await page.getByText(expectedBlock, { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    const [{ count: guardedCategories }, { count: guardedSeries }, { count: guardedTopics }] = await Promise.all([
      supabase.from("topic_categories").select("id", { count: "exact", head: true }).eq("id", fixture.guarded.id),
      supabase.from("topic_series").select("id", { count: "exact", head: true }).eq("category_id", fixture.guarded.id),
      supabase.from("topics").select("id", { count: "exact", head: true }).eq("category_id", fixture.guarded.id),
    ]);
    check("Blocked delete changes no persistent rows", guardedCategories === 1 && guardedSeries === 1 && guardedTopics === 1, `category=${guardedCategories} series=${guardedSeries} topics=${guardedTopics}`);
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByText("إغلاق", { exact: true }).click();

    const geometryRows = [];
    for (const pageNumber of [1, 2, 3, 4, 5, 9, 10, 11]) geometryRows.push(await geometry(page, pageNumber));
    writeFileSync(resolve(OUT, "pagination-geometry.json"), JSON.stringify(geometryRows, null, 2));
    const widths = geometryRows.map((entry) => Math.round(entry.nav.width * 100) / 100);
    check("Pagination container geometry stays fixed", new Set(widths).size === 1, JSON.stringify(widths));
    check("Every rendered pagination slot is 36×36", geometryRows.every((entry) => entry.slots.length === 7 && entry.slots.every((slot) => Math.round(slot.rect.width) === 36 && Math.round(slot.rect.height) === 36)));
    check("Pagination creates no document horizontal overflow", geometryRows.every((entry) => !entry.documentOverflow));

    await page.goto(`${baseUrl}/admin/content/series`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const overflow = await page.evaluate(() => ({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, fixedPortals: Array.from(document.body.children).filter((node) => getComputedStyle(node).position === "fixed").length }));
    check("Series extra scrollbar observation not reproduced", !overflow.documentOverflow, JSON.stringify(overflow));
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  await cleanup();
  writeFileSync(resolve(OUT, "runtime-issues.json"), JSON.stringify(issues, null, 2));
}

check("No page errors", issues.page.length === 0, issues.page.join(" | "));
check("No failed requests", issues.failedRequests.length === 0, issues.failedRequests.join(" | "));
const relevantConsole = issues.console.filter((message) => !message.includes("webpack-hmr") && !message.includes("Fast Refresh"));
check("No relevant console errors", relevantConsole.length === 0, relevantConsole.join(" | "));
const failed = checks.filter((item) => !item.ok);
console.log(`qa-admin-data-engine-browser-corrections: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
