/**
 * Authenticated/unauthenticated coverage for /api/admin/entity-lists/[entity].
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
const adminUsername = `__QA_AIDE_${runId}__`;
const adminEmail = `qa-aide-${runId}@venesia.local`;

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

async function main() {
  const probe = await fetch(`${baseUrl}/admin/login`).catch(() => null);
  if (!probe?.ok) {
    throw new Error(`Server required at ${baseUrl}`);
  }

  const unauth = await fetch(`${baseUrl}/api/admin/entity-lists/topics`);
  check(
    "Unauthenticated request is 401",
    unauth.status === 401,
    String(unauth.status),
  );

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
  try {
    const page = await browser.newPage();
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

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    async function get(entity, query = "") {
      return fetch(
        `${baseUrl}/api/admin/entity-lists/${entity}${query ? `?${query}` : ""}`,
        { headers: { Cookie: cookieHeader, Accept: "application/json" } },
      );
    }

    const unknownAuthed = await get("not-a-real-entity");
    check("Unknown entity after auth is 404", unknownAuthed.status === 404);

    // Strict raw-request boundary: invalid input is rejected with 400,
    // never silently normalized into defaults.
    const invalidQueries = [
      ["invalid page", "topics", "page=abc"],
      ["zero page", "topics", "page=0"],
      ["negative page", "topics", "page=-2"],
      ["invalid pageSize", "topics", "limit=abc"],
      ["unsupported pageSize", "topics", "limit=15"],
      ["oversized pageSize", "topics", "limit=9999"],
      ["invalid sort field", "topics", "sort=not_a_field_asc"],
      ["invalid sort direction", "topics", "sort=title_up"],
      ["invalid status", "topics", "status=bogus"],
      ["malformed category id", "topics", "category=-1"],
      ["non-numeric category id", "topics", "category=abc"],
      ["malformed series id", "topics", "series=1;DROP"],
      ["unknown filter param", "topics", "table=admin_users"],
      ["invalid categories status", "categories", "status=archived"],
      ["invalid series category id", "series", "category=abc"],
    ];
    for (const [label, entity, queryString] of invalidQueries) {
      const response = await get(entity, queryString);
      const body = await response.json().catch(() => null);
      check(
        `400 for ${label} (${entity}?${queryString})`,
        response.status === 400 && body?.error?.code === "invalid_query",
        `status=${response.status} code=${body?.error?.code ?? "none"}`,
      );
    }

    const omitted = await get("topics");
    const omittedBody = await omitted.json().catch(() => null);
    check(
      "Omitted params resolve to canonical defaults",
      omitted.status === 200 &&
        omittedBody?.pagination?.page === 1 &&
        omittedBody?.pagination?.pageSize === 10,
      `status=${omitted.status} page=${omittedBody?.pagination?.page} pageSize=${omittedBody?.pagination?.pageSize}`,
    );

    for (const entity of ["topics", "categories", "series"]) {
      const response = await get(entity, "page=1&limit=10");
      const body = await response.json().catch(() => null);
      check(
        `${entity} valid query returns 200`,
        response.status === 200,
        String(response.status),
      );
      check(
        `${entity} response has private cache headers`,
        /no-store/i.test(response.headers.get("cache-control") || ""),
        response.headers.get("cache-control") || "",
      );
      check(
        `${entity} response envelope has rows and pagination`,
        Array.isArray(body?.rows) &&
          Number.isInteger(body?.pagination?.page) &&
          Number.isInteger(body?.pagination?.totalRows),
      );
      check(
        `${entity} response does not expose arbitrary table access knobs`,
        !("table" in (body || {})) && !("column" in (body || {})),
      );
    }

    const errorBody = await unknownAuthed.json().catch(() => null);
    check(
      "Error normalization uses code/message object",
      typeof errorBody?.error?.code === "string" &&
        typeof errorBody?.error?.message === "string",
      JSON.stringify(errorBody?.error || null),
    );
  } finally {
    await browser.close();
    await cleanup();
  }

  console.log(
    `qa-admin-data-engine-endpoint: ${passed}/${passed + failed} passed`,
  );
  if (failed) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
