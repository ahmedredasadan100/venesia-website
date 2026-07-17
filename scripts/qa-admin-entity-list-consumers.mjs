/**
 * Browser smoke for Admin Entity List consumers (Topics / Categories / Series).
 * Uses disposable admin credentials and cleans up afterward.
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
const OUT = resolve(ROOT, "docs/qa/admin-entity-list");
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
    if (msg.type() === "error") consoleIssues.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  try {
    await login(page);

    for (const route of [
      "/admin/content/topics",
      "/admin/content/categories",
      "/admin/content/series",
    ]) {
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      check(`${route} HTTP 200`, response?.status() === 200, String(response?.status()));
      await page.waitForTimeout(400);
      check(
        `${route} entity list present`,
        (await page.locator("[data-admin-entity-list]").count()) > 0,
      );
      check(
        `${route} no native form select`,
        (await page.locator("form select").count()) === 0,
      );

      const columnsBtn = page.getByRole("button", { name: /الأعمدة/ });
      if ((await columnsBtn.count()) > 0) {
        const before = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          sh: document.documentElement.scrollHeight,
          cw: document.documentElement.clientWidth,
        }));
        await columnsBtn.click();
        await page.waitForTimeout(150);
        const after = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          sh: document.documentElement.scrollHeight,
          cw: document.documentElement.clientWidth,
          menuParent: document.querySelector('[role="menu"]')?.parentElement
            ?.tagName,
          menuPosition: document.querySelector('[role="menu"]')
            ? getComputedStyle(document.querySelector('[role="menu"]')).position
            : null,
        }));
        check(
          `${route} columns portal fixed on body`,
          after.menuParent === "BODY" && after.menuPosition === "fixed",
          JSON.stringify(after),
        );
        check(
          `${route} columns open keeps document scroll geometry`,
          before.sw === after.sw &&
            before.sh === after.sh &&
            before.cw === after.cw,
          JSON.stringify({ before, after }),
        );
        await page.keyboard.press("Escape");
      }

      await page.screenshot({
        path: resolve(OUT, `${route.replaceAll("/", "_").slice(1)}.png`),
        fullPage: true,
      });
    }

    await page.goto(`${baseUrl}/admin/content/categories`, {
      waitUntil: "domcontentloaded",
    });
    check(
      "Categories shared search placeholder",
      (await page.locator('input[placeholder="ابحث في التصنيفات..."]').count()) >
        0,
    );
    check(
      "Categories removed expand/collapse all",
      (await page.getByRole("button", { name: /فتح الكل|طي الكل/ }).count()) ===
        0,
    );
    check(
      "Categories removed slug labels",
      (await page.locator("text=slug:").count()) === 0,
    );

    await page.goto(`${baseUrl}/admin/content/series`, {
      waitUntil: "domcontentloaded",
    });
    check(
      "Series shows الموضوعات",
      (await page.getByText("الموضوعات", { exact: true }).count()) > 0,
    );
    check(
      "Series has columns button",
      (await page.getByRole("button", { name: /الأعمدة/ }).count()) > 0,
    );

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
