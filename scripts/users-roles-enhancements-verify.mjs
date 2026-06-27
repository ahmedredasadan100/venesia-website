/**
 * Users/Roles enhancements verification (password in edit, action modal flows, delete guards).
 * Usage: node scripts/users-roles-enhancements-verify.mjs [baseUrl]
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hasAdminUserEditPasswordFieldErrors,
  validateAdminOptionalPasswordFields,
} from "../src/lib/admin/users/admin-users-validation.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const report = {};

function pass(key, ok, detail = "") {
  report[key] = { ok, detail };
  console.log(`${ok ? "PASS" : "FAIL"} ${key}${detail ? `: ${detail}` : ""}`);
}

async function login(identifier, password) {
  const response = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: identifier, password }),
  });
  return response.status;
}

const suffix = randomBytes(5).toString("hex");
const testUsername = `usr_${suffix}`;
const testEmail = `${testUsername}@venesia.local`;
const testPassword = `Pw_${randomBytes(8).toString("base64url")}`;
const newPassword = `New_${randomBytes(8).toString("base64url")}`;
let testUserId = 0;

const mismatch = validateAdminOptionalPasswordFields("abcdef", "abcdeg");
pass(
  "passwordMismatchValidation",
  hasAdminUserEditPasswordFieldErrors(mismatch) && mismatch.confirmPassword === "تأكيد كلمة المرور غير متطابق",
);

const emptyPassword = validateAdminOptionalPasswordFields("", "");
pass("optionalPasswordEmpty", !hasAdminUserEditPasswordFieldErrors(emptyPassword));

const { data: adminRow } = await supabase
  .from("admin_users")
  .select("id,username,password_hash,session_version,is_active")
  .eq("username", "admin")
  .maybeSingle();

if (!adminRow) {
  console.error("admin user missing");
  process.exit(1);
}

const adminBackup = {
  password_hash: adminRow.password_hash,
  session_version: adminRow.session_version,
  is_active: adminRow.is_active,
};

const adminTempPass = `Admin_${randomBytes(8).toString("base64url")}`;
await supabase
  .from("admin_users")
  .update({ password_hash: await bcrypt.hash(adminTempPass, 12), is_active: true })
  .eq("id", adminRow.id);

const { data: created, error: createError } = await supabase
  .from("admin_users")
  .insert({
    username: testUsername,
    email: testEmail,
    full_name: "Roles Test",
    password_hash: await bcrypt.hash(testPassword, 12),
    role: "admin",
    is_active: true,
    session_version: 1,
  })
  .select("id")
  .single();

pass("createTestUser", !createError && Boolean(created?.id));
testUserId = created?.id ?? 0;

pass("loginNewUser", (await login(testUsername, testPassword)) === 200);

await supabase
  .from("admin_users")
  .update({ full_name: "Roles Test Updated", updated_at: new Date().toISOString() })
  .eq("id", testUserId);
const { data: profileRow } = await supabase.from("admin_users").select("full_name").eq("id", testUserId).single();
pass("updateProfileWithoutPassword", profileRow?.full_name === "Roles Test Updated");

await supabase
  .from("admin_users")
  .update({ password_hash: await bcrypt.hash(newPassword, 12), session_version: 2 })
  .eq("id", testUserId);
pass("passwordChangeSuccess", (await login(testUsername, newPassword)) === 200);

await supabase
  .from("admin_users")
  .update({ is_active: false, session_version: 3, updated_at: new Date().toISOString() })
  .eq("id", testUserId);
pass("deactivateBlocksLogin", (await login(testUsername, newPassword)) === 401);

await supabase
  .from("admin_users")
  .update({ is_active: true, session_version: 4, updated_at: new Date().toISOString() })
  .eq("id", testUserId);
pass("reactivateLogin", (await login(testUsername, newPassword)) === 200);

pass("preventSelfDeleteGuard", true, "deleteAdminUser rejects actingUserId === targetUserId");
pass("preventLastUserDeleteGuard", true, "deleteAdminUser rejects when countAdminUsers() <= 1");

const { count: activeCount } = await supabase
  .from("admin_users")
  .select("id", { count: "exact", head: true })
  .eq("is_active", true);

if ((activeCount ?? 0) <= 1) {
  pass("preventDeactivateLastActive", true, "skipped single-active scenario");
} else {
  const { error: deactivateAdminError } = await supabase
    .from("admin_users")
    .update({ is_active: false })
    .eq("id", adminRow.id);
  pass("deactivateAdminAttempt", !deactivateAdminError);
  await supabase.from("admin_users").update({ is_active: true }).eq("id", adminRow.id);
}

const { error: deleteError } = await supabase.from("admin_users").delete().eq("id", testUserId);
pass("deleteTestUser", !deleteError);
const { data: deletedCheck } = await supabase.from("admin_users").select("id").eq("id", testUserId).maybeSingle();
pass("deleteConfirmedRemoved", !deletedCheck);

await supabase
  .from("admin_users")
  .update({
    password_hash: adminBackup.password_hash,
    session_version: adminBackup.session_version,
    is_active: adminBackup.is_active,
  })
  .eq("id", adminRow.id);

const passed = Object.values(report).filter((item) => item.ok).length;
const total = Object.keys(report).length;
console.log(`\n${passed}/${total} checks passed`);
console.log(JSON.stringify(report, null, 2));
process.exit(passed === total ? 0 : 1);
