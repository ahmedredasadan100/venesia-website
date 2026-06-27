/**
 * Reset password for an existing admin_users row (updates password_hash only).
 *
 * Usage:
 *   node scripts/reset-admin-password.mjs --identifier admin --password '...'
 *   node scripts/reset-admin-password.mjs admin --password '...'
 *   node scripts/reset-admin-password.mjs admin@venesia.local --password '...'
 *
 * Env alternatives:
 *   ADMIN_RESET_IDENTIFIER, ADMIN_RESET_PASSWORD
 *
 * Production: set ALLOW_ADMIN_PASSWORD_RESET=true for one-time recovery only.
 * Password is never printed. Do not commit credentials.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 6;

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

function readFlag(argv, name) {
  const flagIndex = argv.indexOf(name);
  if (flagIndex === -1) return "";
  return argv[flagIndex + 1] ?? "";
}

function resolveIdentifier(argv) {
  const fromFlag = readFlag(argv, "--identifier");
  if (fromFlag) return fromFlag.trim();

  const fromEnv = process.env.ADMIN_RESET_IDENTIFIER?.trim() ?? "";
  if (fromEnv) return fromEnv;

  const positional = argv[2];
  if (positional && !positional.startsWith("--")) return positional.trim();

  return "";
}

function resolveNewPassword(argv) {
  const fromFlag = readFlag(argv, "--password");
  if (fromFlag) return fromFlag;

  const fromEnv = process.env.ADMIN_RESET_PASSWORD ?? "";
  if (fromEnv) return fromEnv;

  const positional = argv[3];
  if (positional && !positional.startsWith("--")) return positional;

  return "";
}

function printUsage() {
  console.error("Reset password for an existing admin user (password_hash only).");
  console.error("");
  console.error("Usage:");
  console.error("  node scripts/reset-admin-password.mjs --identifier <username|email> --password <new-password>");
  console.error("  node scripts/reset-admin-password.mjs <username|email> --password <new-password>");
  console.error("");
  console.error("Env alternatives: ADMIN_RESET_IDENTIFIER, ADMIN_RESET_PASSWORD");
  console.error("Production: ALLOW_ADMIN_PASSWORD_RESET=true required.");
  console.error("Do not commit credentials to the repository.");
}

const identifier = resolveIdentifier(process.argv);
const newPassword = resolveNewPassword(process.argv);

if (!identifier || !newPassword) {
  printUsage();
  process.exit(1);
}

if (newPassword.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowReset =
  process.env.ALLOW_ADMIN_PASSWORD_RESET === "true" || process.env.NODE_ENV !== "production";

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

if (!allowReset) {
  console.error("Password reset blocked in production. Set ALLOW_ADMIN_PASSWORD_RESET=true for one-time recovery.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

async function findAdminUser(login) {
  const { data: byUsername, error: usernameError } = await supabase
    .from("admin_users")
    .select("id,username,email,is_active")
    .eq("username", login)
    .maybeSingle();

  if (usernameError) {
    throw new Error(usernameError.message);
  }
  if (byUsername) return byUsername;

  if (!login.includes("@")) return null;

  const { data: byEmail, error: emailError } = await supabase
    .from("admin_users")
    .select("id,username,email,is_active")
    .eq("email", login.toLowerCase())
    .maybeSingle();

  if (emailError) {
    throw new Error(emailError.message);
  }
  return byEmail;
}

const user = await findAdminUser(identifier);
if (!user) {
  console.error(`No admin user found for identifier: ${identifier}`);
  process.exit(1);
}

if (!user.is_active) {
  console.error(`Admin user "${user.username}" is inactive. Activate the account before resetting password.`);
  process.exit(1);
}

const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
const { data: updatedRows, error: updateError } = await supabase
  .from("admin_users")
  .update({ password_hash: passwordHash })
  .eq("id", user.id)
  .select("id,username,email");

if (updateError) {
  console.error("Failed to update password_hash:", updateError.message);
  process.exit(1);
}

if (!updatedRows?.length) {
  console.error("Password update did not affect any row.");
  process.exit(1);
}

const verified = await bcrypt.compare(newPassword, passwordHash);
if (!verified) {
  console.error("Internal error: generated hash does not verify.");
  process.exit(1);
}

console.log(`OK password reset for admin user: ${user.username} (${user.email})`);
