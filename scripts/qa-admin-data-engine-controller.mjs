/**
 * Browser controller evidence for Topics/Categories/Series data-engine lists.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const password = randomBytes(24).toString("base64url");
const adminUsername = `__QA_AIDC_${runId}__`;
const adminEmail = `qa-aidc-${runId}@venesia.local`;

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
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let passed = 0;
let failed = 0;
let adminId = null;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanup() {
  if (!adminId) return;
  await supabase.from("admin_users").delete().eq("id", adminId);
}

function isListEndpoint(url) {
  return /\/api\/admin\/entity-lists\/(topics|categories|series)/.test(url);
}

async function main() {
  const probe = await fetch(`${baseUrl}/admin/login`).catch(() => null);
  if (!probe?.ok) throw new Error(`Server required at ${baseUrl}`);

  const admin = await must(
    "create admin",
    supabase
      .from("admin_users")
      .insert({
        username: adminUsername,
        email: adminEmail,
        password_hash: await bcrypt.hash(password, 10),
        role: "super_admin",
        is_active: true,
      })
      .select("id")
      .single(),
  );
  adminId = admin.id;

  const browser = await chromium.launch({ headless: true });
  const consoleIssues = [];
  const pageErrors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleIssues.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(`${baseUrl}/admin/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const login = await page.evaluate(
      async ({ username, loginPassword }) => {
        const response = await fetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    if (!login.ok) throw new Error(`QA login failed: ${login.status}`);

    for (const path of [
      "/admin/content/topics",
      "/admin/content/categories",
      "/admin/content/series",
    ]) {
      const endpointCalls = [];
      const documents = [];
      const rsc = [];
      const onRequest = (request) => {
        const url = request.url();
        if (request.resourceType() === "document") documents.push(url);
        // Count only same-path RSC flights (list navigation), not Link prefetch
        // for row/detail routes that may appear after the table rows change.
        const samePath =
          url.includes(`${path}?`) ||
          url.endsWith(path) ||
          url.includes(`${path}&`);
        const isRscFlight =
          url.includes("_rsc=") || request.headers()["rsc"] === "1";
        if (isRscFlight && samePath) {
          rsc.push(url);
        }
        if (isListEndpoint(url)) endpointCalls.push(url);
      };
      page.on("request", onRequest);

      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
      const initialEndpointCalls = endpointCalls.length;
      check(
        `${path}: no duplicate list endpoint fetch on hydration`,
        initialEndpointCalls === 0,
        String(initialEndpointCalls),
      );

      const search = page.locator('input[placeholder*="ابحث"]').first();
      if (await search.count()) {
        const beforeSearch = endpointCalls.length;
        await search.fill(`qa ${runId}`);
        await page.waitForTimeout(700);
        const afterSearch = endpointCalls.length - beforeSearch;
        check(
          `${path}: search issues at most one endpoint request`,
          afterSearch <= 1,
          String(afterSearch),
        );
        check(
          `${path}: table remains mounted during search`,
          (await page.locator("[data-admin-entity-list]").count()) >= 1,
        );
        await search.fill("");
        await page.waitForTimeout(700);
      }

      const beforePaginateDocs = documents.length;
      const beforePaginateRsc = rsc.length;
      const next = page.getByRole("button", { name: "التالي" });
      if ((await next.count()) && (await next.first().isEnabled())) {
        const before = endpointCalls.length;
        await next.first().click();
        await page.waitForTimeout(900);
        check(
          `${path}: pagination uses endpoint not document reload`,
          documents.length === beforePaginateDocs,
          `docs=${documents.length - beforePaginateDocs}`,
        );
        check(
          `${path}: pagination avoids RSC flight`,
          rsc.length === beforePaginateRsc,
          `rsc=${rsc.length - beforePaginateRsc}`,
        );
        check(
          `${path}: pagination issues one endpoint request`,
          endpointCalls.length - before === 1,
          String(endpointCalls.length - before),
        );
        await page.goBack();
        await page.waitForTimeout(700);
        const afterBack = endpointCalls.length;
        await page.goForward();
        await page.waitForTimeout(700);
        check(
          `${path}: forward after back does not spam duplicate fetches`,
          endpointCalls.length - afterBack <= 1,
          String(endpointCalls.length - afterBack),
        );
      } else {
        check(`${path}: pagination skipped (single page)`, true);
      }

      page.off("request", onRequest);
    }

    check(
      "No console errors",
      consoleIssues.length === 0,
      consoleIssues.join(" | "),
    );
    check(
      "No page errors",
      pageErrors.length === 0,
      pageErrors.join(" | "),
    );
  } finally {
    await browser.close();
    await cleanup();
  }

  console.log(
    `qa-admin-data-engine-controller: ${passed}/${passed + failed} passed`,
  );
  if (failed) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
