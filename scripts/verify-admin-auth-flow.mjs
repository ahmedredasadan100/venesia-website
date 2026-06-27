/**
 * Admin auth flow verification (no secrets printed).
 *
 * Usage:
 *   ADMIN_BOOTSTRAP_PASSWORD='...' node scripts/verify-admin-auth-flow.mjs [baseUrl] [username]
 *   node scripts/verify-admin-auth-flow.mjs [baseUrl] [username] [password] [rotatePassword]
 *
 * Optional rotate password: ADMIN_TEST_ROTATE_PASSWORD env or 4th CLI arg.
 * If omitted, a one-time random rotate password is generated (not logged).
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const bootstrapLogin = process.argv[3] ?? "admin";
const bootstrapPassword = process.argv[4] ?? process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const rotatedPassword =
  process.argv[5] ?? process.env.ADMIN_TEST_ROTATE_PASSWORD ?? `test-${randomBytes(12).toString("base64url")}`;

if (!bootstrapPassword) {
  console.error("Bootstrap password required.");
  console.error("Set ADMIN_BOOTSTRAP_PASSWORD or run:");
  console.error("  node scripts/verify-admin-auth-flow.mjs [baseUrl] [username] [password]");
  console.error("Do not commit credentials to the repository.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const report = {
  seedNeeded: false,
  seedExecuted: false,
  adminUserCount: 0,
  loginBootstrap: false,
  adminPanelOpens: false,
  securityPageOpens: false,
  passwordChanged: false,
  logoutOk: false,
  loginRotatedPassword: false,
  bootstrapPasswordRejected: false,
  passwordRevertedForDev: false,
};

function loadEnvSupabase() {
  if (!url || !serviceRoleKey) throw new Error("Missing Supabase env");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function login(identifier, password) {
  const response = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: identifier, password }),
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  return {
    status: response.status,
    cookieHeader: cookies.map((line) => line.split(";")[0]).join("; "),
  };
}

async function get(path, cookieHeader = "") {
  const response = await fetch(`${base}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    redirect: "manual",
  });
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

async function logout(cookieHeader) {
  const response = await fetch(`${base}/api/admin/auth/logout`, {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  return response.status;
}

const supabase = loadEnvSupabase();
const { count } = await supabase.from("admin_users").select("id", { count: "exact", head: true });
report.adminUserCount = count ?? 0;
report.seedNeeded = report.adminUserCount === 0;
report.seedExecuted = false;

const bootstrap = await login(bootstrapLogin, bootstrapPassword);
report.loginBootstrap = bootstrap.status === 200;

const adminPage = await get("/admin", bootstrap.cookieHeader);
report.adminPanelOpens = adminPage.status === 200;

const securityPage = await get("/admin/settings/security", bootstrap.cookieHeader);
report.securityPageOpens = securityPage.status === 200;

const { data: userRow } = await supabase.from("admin_users").select("*").eq("username", bootstrapLogin).single();
if (userRow) {
  const validBootstrap = await bcrypt.compare(bootstrapPassword, userRow.password_hash);
  if (validBootstrap) {
    const newHash = await bcrypt.hash(rotatedPassword, 12);
    const { error } = await supabase
      .from("admin_users")
      .update({
        password_hash: newHash,
        session_version: Number(userRow.session_version) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userRow.id);
    report.passwordChanged = !error;
  }
}

report.logoutOk = (await logout(bootstrap.cookieHeader)) === 200;

const oldAfterRotate = await login(bootstrapLogin, bootstrapPassword);
report.bootstrapPasswordRejected = oldAfterRotate.status === 401;

const newLogin = await login(bootstrapLogin, rotatedPassword);
report.loginRotatedPassword = newLogin.status === 200;

const revertHash = await bcrypt.hash(bootstrapPassword, 12);
const { data: latest } = await supabase.from("admin_users").select("session_version").eq("username", bootstrapLogin).single();
if (latest) {
  const { error } = await supabase
    .from("admin_users")
    .update({
      password_hash: revertHash,
      session_version: Number(latest.session_version) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("username", bootstrapLogin);
  report.passwordRevertedForDev = !error;
}

const finalLogin = await login(bootstrapLogin, bootstrapPassword);
report.finalBootstrapLoginRestored = finalLogin.status === 200;

console.log(JSON.stringify(report, null, 2));
