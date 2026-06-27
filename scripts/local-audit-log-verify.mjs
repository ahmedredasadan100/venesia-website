/**
 * Local Audit Log Phase 1 verification (no secrets logged).
 * Requires: dev server on base URL, admin_audit_logs table, .env.local
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
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|cookie|session|hash|authorization|api[_-]?key|credential)/i;

function loadActionIds(relativeManifestPath, names) {
  const manifestPath = resolve(ROOT, relativeManifestPath);
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing server action manifest: ${relativeManifestPath} (start dev server first)`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const out = {};
  for (const [id, entry] of Object.entries(manifest.node ?? {})) {
    if (names.includes(entry.exportedName)) out[entry.exportedName] = id;
  }
  for (const name of names) {
    if (!out[name]) throw new Error(`Action not found in manifest: ${name}`);
  }
  return out;
}

const usersActions = loadActionIds(
  ".next/dev/server/app/admin/users-roles/page/server-reference-manifest.json",
  [
    "createAdminUserAction",
    "updateAdminUserAction",
    "setAdminUserActiveAction",
    "setAdminUserPasswordAction",
  ],
);
const securityActions = loadActionIds(
  ".next/dev/server/app/admin/settings/security/page/server-reference-manifest.json",
  ["changeAdminPasswordAction", "changeAdminEmailAction", "revokeAllAdminSessionsAction"],
);

function cookieHeaderFrom(setCookies, existing = "") {
  const jar = new Map();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(identifier, password, cookieHeader = "") {
  const response = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ username: identifier, password }),
  });
  const nextCookie = cookieHeaderFrom(response.headers.getSetCookie?.() ?? [], cookieHeader);
  return { status: response.status, cookieHeader: nextCookie };
}

async function logout(cookieHeader) {
  const response = await fetch(`${base}/api/admin/auth/logout`, {
    method: "POST",
    headers: { cookie: cookieHeader },
  });
  return { status: response.status, cookieHeader: cookieHeaderFrom(response.headers.getSetCookie?.() ?? [], cookieHeader) };
}

async function callServerAction(pagePath, actionId, args, cookieHeader) {
  const payload = Array.isArray(args) ? args : [args];
  const response = await fetch(`${base}${pagePath}`, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      "next-action": actionId,
      cookie: cookieHeader,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (response.status >= 400) {
    throw new Error(`Server action failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return {
    status: response.status,
    cookieHeader: cookieHeaderFrom(response.headers.getSetCookie?.() ?? [], cookieHeader),
  };
}

async function getAdmin(path, cookieHeader = "") {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

async function waitForAction(action, actorUsername, afterIso, attempts = 15) {
  for (let i = 0; i < attempts; i += 1) {
    let query = supabase
      .from("admin_audit_logs")
      .select("*")
      .eq("action", action)
      .eq("actor_username", actorUsername)
      .gte("created_at", afterIso)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data } = await query;
    if (data?.[0]) return data[0];
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  }
  return null;
}

function sanitizeAuditMetadata(metadata) {
  if (!metadata) return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function collectMetadataKeys(value, prefix = "") {
  const keys = [];
  if (value == null || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const item of value) keys.push(...collectMetadataKeys(item, prefix));
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    keys.push(...collectMetadataKeys(nested, fullKey));
  }
  return keys;
}

function metadataHasSensitive(metadata) {
  const bannedKeyPattern =
    /(^|\.)(password|confirmpassword|password_hash|token|cookie|secret|authorization|api[_-]?key|credential)($|\.)/i;
  return collectMetadataKeys(metadata).some((key) => bannedKeyPattern.test(key));
}

const report = {
  migration: {},
  events: {},
  security: {},
  ui: {},
  recordsCreated: 0,
};

const { error: tableError } = await supabase.from("admin_audit_logs").select("id").limit(1);
if (tableError) {
  console.error("admin_audit_logs table missing. Apply sql/migrations/20250625700000_admin_audit_logs.sql first.");
  console.error(tableError.message);
  process.exit(2);
}

const { count: rowsBefore } = await supabase.from("admin_audit_logs").select("id", { count: "exact", head: true });
report.migration = { applied: true, tableReady: true, rowsBefore: rowsBefore ?? 0 };

const { data: adminRow } = await supabase
  .from("admin_users")
  .select("id,username,email,password_hash,session_version,is_active")
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
  email: adminRow.email,
};
let adminTempPass = randomBytes(18).toString("base64url");
await supabase
  .from("admin_users")
  .update({ password_hash: await bcrypt.hash(adminTempPass, 12), is_active: true })
  .eq("id", adminRow.id);

const testUsername = `audit_${randomBytes(5).toString("hex")}`;
const testEmail = `${testUsername}@venesia.local`;
const testPassword = `Pw_${randomBytes(8).toString("base64url")}`;
let testUserId = 0;
const testStartIso = new Date().toISOString();

try {
  report.ui.pageProtectedWithoutSession = (await getAdmin("/admin/activity-log")).status;

  await login("admin", "wrong-password-xyz");
  report.events.loginFailed = Boolean(await waitForAction("auth.login.failed", "admin", testStartIso));

  let session = await login("admin", adminTempPass);
  report.events.loginSuccess = Boolean(await waitForAction("auth.login.success", "admin", testStartIso));

  await logout(session.cookieHeader);
  report.events.logout = Boolean(await waitForAction("auth.logout", "admin", testStartIso));

  session = await login("admin", adminTempPass);

  const newAdminPass = `Pw_${randomBytes(8).toString("base64url")}`;
  const passChange = await callServerAction(
    "/admin/settings/security",
    securityActions.changeAdminPasswordAction,
    [adminTempPass, newAdminPass],
    session.cookieHeader,
  );
  session.cookieHeader = passChange.cookieHeader;
  report.events.passwordChanged = Boolean(await waitForAction("auth.password.changed", "admin", testStartIso));

  const tempEmail = `audit_admin_${randomBytes(4).toString("hex")}@venesia.local`;
  await callServerAction(
    "/admin/settings/security",
    securityActions.changeAdminEmailAction,
    [newAdminPass, tempEmail],
    session.cookieHeader,
  );
  report.events.emailChanged = Boolean(await waitForAction("auth.email.changed", "admin", testStartIso));

  await supabase.from("admin_users").update({ email: adminBackup.email }).eq("id", adminRow.id);

  await callServerAction(
    "/admin/settings/security",
    securityActions.revokeAllAdminSessionsAction,
    [newAdminPass],
    session.cookieHeader,
  );
  report.events.sessionsRevoked = Boolean(await waitForAction("auth.sessions.revoked", "admin", testStartIso));

  session = await login("admin", newAdminPass);
  adminTempPass = newAdminPass;

  await callServerAction(
    "/admin/users-roles",
    usersActions.createAdminUserAction,
    {
      username: testUsername,
      email: testEmail,
      full_name: "Audit Test",
      password: testPassword,
      confirmPassword: testPassword,
    },
    session.cookieHeader,
  );
  const createdUser = await supabase.from("admin_users").select("id").eq("username", testUsername).maybeSingle();
  testUserId = createdUser.data?.id ?? 0;
  report.events.userCreated = Boolean(await waitForAction("admin_user.created", "admin", testStartIso));

  await callServerAction(
    "/admin/users-roles",
    usersActions.updateAdminUserAction,
    {
      id: testUserId,
      username: testUsername,
      email: testEmail,
      full_name: "Audit Test Updated",
      is_active: true,
    },
    session.cookieHeader,
  );
  report.events.userUpdated = Boolean(await waitForAction("admin_user.updated", "admin", testStartIso));

  await callServerAction(
    "/admin/users-roles",
    usersActions.setAdminUserActiveAction,
    [testUserId, false],
    session.cookieHeader,
  );
  report.events.userDeactivated = Boolean(await waitForAction("admin_user.deactivated", "admin", testStartIso));

  await callServerAction(
    "/admin/users-roles",
    usersActions.setAdminUserActiveAction,
    [testUserId, true],
    session.cookieHeader,
  );
  report.events.userActivated = Boolean(await waitForAction("admin_user.activated", "admin", testStartIso));

  const resetPass = `Pw_${randomBytes(8).toString("base64url")}`;
  await callServerAction(
    "/admin/users-roles",
    usersActions.setAdminUserPasswordAction,
    { userId: testUserId, password: resetPass, confirmPassword: resetPass },
    session.cookieHeader,
  );
  report.events.userPasswordReset = Boolean(await waitForAction("admin_user.password.reset", "admin", testStartIso));

  const sanitizeUnit = sanitizeAuditMetadata({
    password: "x",
    confirmPassword: "y",
    password_hash: "z",
    token: "t",
    cookie: "c",
    secret: "s",
    safe: "ok",
  });
  report.security.sanitizeUnit = sanitizeUnit.safe === "ok" && Object.keys(sanitizeUnit).length === 1;

  const { data: testLogs } = await supabase
    .from("admin_audit_logs")
    .select("metadata")
    .gte("created_at", testStartIso);
  report.security.noSensitiveInMetadata = !(testLogs ?? []).some((row) => metadataHasSensitive(row.metadata));
  report.security.sampleCount = (testLogs ?? []).length;

  const unauthActivity = await getAdmin("/admin/activity-log");
  report.ui.pageProtectedWithoutSessionOk = [307, 302].includes(unauthActivity.status);

  const authActivity = await getAdmin("/admin/activity-log", session.cookieHeader);
  report.ui.pageWithSessionStatus = authActivity.status;
  report.ui.pageWithSessionOk = authActivity.status === 200;

  const filterRes = await getAdmin("/admin/activity-log?action=auth.login.success&page=1", session.cookieHeader);
  report.ui.filtersOk = filterRes.status === 200;

  const page2Res = await getAdmin("/admin/activity-log?page=2", session.cookieHeader);
  report.ui.paginationOk = page2Res.status === 200;

  const { count: rowsAfter } = await supabase.from("admin_audit_logs").select("id", { count: "exact", head: true });
  report.recordsCreated = (rowsAfter ?? 0) - (rowsBefore ?? 0);
} finally {
  if (testUserId) {
    await supabase.from("admin_audit_logs").delete().eq("entity_id", testUserId);
    await supabase.from("admin_users").delete().eq("id", testUserId);
  }
  await supabase
    .from("admin_users")
    .update({
      password_hash: adminBackup.password_hash,
      session_version: adminBackup.session_version,
      is_active: adminBackup.is_active,
      email: adminBackup.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", adminRow.id);
}

const checks = [
  report.migration.tableReady,
  report.events.loginFailed,
  report.events.loginSuccess,
  report.events.logout,
  report.events.passwordChanged,
  report.events.sessionsRevoked,
  report.events.emailChanged,
  report.events.userCreated,
  report.events.userUpdated,
  report.events.userDeactivated,
  report.events.userActivated,
  report.events.userPasswordReset,
  report.security.sanitizeUnit,
  report.security.noSensitiveInMetadata,
  report.ui.pageProtectedWithoutSessionOk,
  report.ui.pageWithSessionOk,
  report.ui.filtersOk,
  report.ui.paginationOk,
];

console.log(JSON.stringify({ ok: checks.every(Boolean), report }, null, 2));
process.exit(checks.every(Boolean) ? 0 : 1);
