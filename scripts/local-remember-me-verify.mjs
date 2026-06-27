/**
 * Local-only Remember Me verification (no secrets logged).
 * Temporarily swaps admin password hash, runs tests, restores original state.
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
const report = { rememberMe: {}, logout: {}, sessionVersion: {}, redirect: {}, restored: false };

const { data: user, error: userErr } = await supabase
  .from("admin_users")
  .select("id,username,password_hash,session_version")
  .eq("username", "admin")
  .maybeSingle();

if (userErr || !user) {
  console.error("No admin user");
  process.exit(1);
}

const backup = { password_hash: user.password_hash, session_version: user.session_version };
const tempPass = randomBytes(24).toString("base64url");
const tempHash = await bcrypt.hash(tempPass, 12);

await supabase
  .from("admin_users")
  .update({ password_hash: tempHash, updated_at: new Date().toISOString() })
  .eq("id", user.id);

function maxAgeFrom(setCookies) {
  const line = setCookies.find((c) => c.startsWith("venesia_admin_session="));
  if (!line) return null;
  const match = line.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function cookieHeaderFrom(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function login(rememberMe) {
  const response = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: user.username, password: tempPass, rememberMe }),
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  return { status: response.status, maxAge: maxAgeFrom(cookies), cookieHeader: cookieHeaderFrom(cookies) };
}

async function getAdmin(path, cookieHeader = "") {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

try {
  const noRemember = await login(false);
  report.rememberMe.without = {
    loginOk: noRemember.status === 200,
    maxAge: noRemember.maxAge,
    expected: 43200,
  };

  const projectsWithSession = await getAdmin("/admin/projects", noRemember.cookieHeader);
  report.redirect.withoutRemember = {
    status: projectsWithSession.status,
    ok: projectsWithSession.status === 200,
  };

  const logoutRes = await fetch(`${base}/api/admin/auth/logout`, {
    method: "POST",
    headers: { cookie: noRemember.cookieHeader },
  });
  const logoutCookies = logoutRes.headers.getSetCookie?.() ?? [];
  const cleared = logoutCookies.some(
    (c) => c.startsWith("venesia_admin_session=") && (c.includes("Max-Age=0") || /venesia_admin_session=;/.test(c)),
  );
  const afterLogout = await getAdmin("/admin/projects", noRemember.cookieHeader);
  report.logout = {
    status: logoutRes.status,
    cookieCleared: cleared,
    guardAfterLogout: afterLogout.status === 307 || afterLogout.status === 302,
    tokenReuseBlocked: afterLogout.status === 307 || afterLogout.status === 302,
  };

  const withRemember = await login(true);
  report.rememberMe.with = {
    loginOk: withRemember.status === 200,
    maxAge: withRemember.maxAge,
    expected: 2592000,
  };

  const adminHome = await getAdmin("/admin", withRemember.cookieHeader);
  report.redirect.withRemember = { status: adminHome.status, ok: adminHome.status === 200 };

  await supabase.from("admin_users").update({ session_version: user.session_version + 99 }).eq("id", user.id);
  const stale = await getAdmin("/admin", withRemember.cookieHeader);
  report.sessionVersion.invalidAfterBump = stale.status === 307 || stale.status === 302;
} finally {
  const { error } = await supabase
    .from("admin_users")
    .update({ ...backup, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  report.restored = !error;
}

const failed = [];
if (!report.rememberMe.without.loginOk || report.rememberMe.without.maxAge !== 43200) failed.push("rememberMe-off");
if (!report.rememberMe.with.loginOk || report.rememberMe.with.maxAge !== 2592000) failed.push("rememberMe-on");
if (!report.redirect.withoutRemember.ok) failed.push("redirect-off");
if (!report.redirect.withRemember.ok) failed.push("redirect-on");
if (!report.logout.cookieCleared || !report.logout.tokenReuseBlocked) failed.push("logout");
if (!report.sessionVersion.invalidAfterBump) failed.push("session_version");
if (!report.restored) failed.push("restore");

console.log(JSON.stringify({ ok: failed.length === 0, failed, report }, null, 2));
process.exit(failed.length ? 1 : 0);
