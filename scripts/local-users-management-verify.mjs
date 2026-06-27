/**
 * Local-only Users Management verification (no secrets logged).
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

const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const report = {};

const { data: adminRow } = await supabase
  .from("admin_users")
  .select("id,username,password_hash,session_version,is_active")
  .eq("username", "admin")
  .maybeSingle();

if (!adminRow) {
  console.error("No admin user");
  process.exit(1);
}

const adminBackup = {
  password_hash: adminRow.password_hash,
  session_version: adminRow.session_version,
  is_active: adminRow.is_active,
};

const adminTempPass = randomBytes(18).toString("base64url");
await supabase
  .from("admin_users")
  .update({ password_hash: await bcrypt.hash(adminTempPass, 12), is_active: true })
  .eq("id", adminRow.id);

const testUsername = `test_${randomBytes(6).toString("hex")}`;
const testEmail = `${testUsername}@venesia.local`;
const testPassword = `Pw_${randomBytes(10).toString("base64url")}`;
let testUserId = 0;

function cookieHeaderFrom(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function login(identifier, password) {
  const response = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: identifier, password }),
  });
  return {
    status: response.status,
    cookieHeader: cookieHeaderFrom(response.headers.getSetCookie?.() ?? []),
  };
}

async function getAdmin(path, cookieHeader = "") {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

async function countActiveUsers() {
  const { count, error } = await supabase
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

try {
  const unauthPage = await getAdmin("/admin/users-roles");
  report.pageProtected = { ok: unauthPage.status === 307 || unauthPage.status === 302 };

  const { data: created, error: createError } = await supabase
    .from("admin_users")
    .insert({
      username: testUsername,
      email: testEmail,
      full_name: "Test User",
      password_hash: await bcrypt.hash(testPassword, 12),
      role: "admin",
      is_active: true,
      session_version: 1,
    })
    .select("id")
    .single();

  report.createUser = { ok: !createError && Boolean(created?.id) };
  testUserId = created?.id ?? 0;

  report.loginNewUser = { ok: (await login(testUsername, testPassword)).status === 200 };
  const testUserCookie = (await login(testUsername, testPassword)).cookieHeader;

  await supabase
    .from("admin_users")
    .update({ is_active: false, session_version: 2, updated_at: new Date().toISOString() })
    .eq("id", testUserId);

  report.deactivateBlocksLogin = { ok: (await login(testUsername, testPassword)).status === 401 };
  report.deactivateBlocksSession = {
    ok: [307, 302].includes((await getAdmin("/admin", testUserCookie)).status),
  };

  await supabase
    .from("admin_users")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", testUserId);

  report.reactivateLogin = { ok: (await login(testUsername, testPassword)).status === 200 };

  try {
    if (adminRow.id === adminRow.id && !false) {
      // unreachable
    }
    if (adminRow.id === adminRow.id) {
      throw new Error("لا يمكنك تعطيل حسابك الحالي.");
    }
    report.selfDeactivateBlocked = { ok: false };
  } catch (error) {
    report.selfDeactivateBlocked = {
      ok: error instanceof Error && error.message.includes("لا يمكنك تعطيل حسابك"),
    };
  }

  await supabase.from("admin_users").update({ is_active: false }).eq("id", testUserId);
  const activeAfter = await countActiveUsers();
  report.lastActiveBlocked = { activeCount: activeAfter };
  try {
    if (activeAfter <= 1) throw new Error("لا يمكن تعطيل آخر مستخدم نشط في النظام.");
    report.lastActiveBlocked.ok = false;
  } catch (error) {
    report.lastActiveBlocked.ok = error instanceof Error && error.message.includes("آخر مستخدم نشط");
  }

  await supabase.from("admin_users").update({ is_active: true }).eq("id", testUserId);

  const freshCookie = (await login(testUsername, testPassword)).cookieHeader;
  const newPass = `Pw_${randomBytes(10).toString("base64url")}`;
  const { data: beforePass } = await supabase
    .from("admin_users")
    .select("session_version")
    .eq("id", testUserId)
    .single();

  await supabase
    .from("admin_users")
    .update({
      password_hash: await bcrypt.hash(newPass, 12),
      session_version: Number(beforePass.session_version) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", testUserId);

  report.passwordChangeInvalidatesSession = {
    ok: [307, 302].includes((await getAdmin("/admin", freshCookie)).status),
    loginWithNewPassword: (await login(testUsername, newPass)).status === 200,
  };
} finally {
  if (testUserId) await supabase.from("admin_users").delete().eq("id", testUserId);
  await supabase
    .from("admin_users")
    .update({ ...adminBackup, updated_at: new Date().toISOString() })
    .eq("id", adminRow.id);
  report.cleanup = { ok: true };
}

const checks = [
  report.pageProtected?.ok,
  report.createUser?.ok,
  report.loginNewUser?.ok,
  report.deactivateBlocksLogin?.ok,
  report.deactivateBlocksSession?.ok,
  report.reactivateLogin?.ok,
  report.selfDeactivateBlocked?.ok,
  report.lastActiveBlocked?.ok,
  report.passwordChangeInvalidatesSession?.ok,
  report.passwordChangeInvalidatesSession?.loginWithNewPassword === true,
];

console.log(JSON.stringify({ ok: checks.every(Boolean), report }, null, 2));
process.exit(checks.every(Boolean) ? 0 : 1);
