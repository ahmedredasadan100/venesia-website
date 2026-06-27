/**
 * Ensures admin_users table has bootstrap row (dev/local helper).
 * Production: prefer sql/migrations/20250625600000_admin_users.sql in SQL editor.
 *
 * Usage:
 *   ADMIN_BOOTSTRAP_PASSWORD='...' node scripts/seed-initial-admin.mjs
 *   node scripts/seed-initial-admin.mjs --password '...'
 *
 * Password is never printed. Do not commit credentials.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function resolveBootstrapPassword(argv) {
  const flagIndex = argv.indexOf("--password");
  if (flagIndex !== -1) {
    const fromFlag = argv[flagIndex + 1];
    if (fromFlag) return fromFlag;
  }

  const positional = argv[2];
  if (positional && positional !== "--password") return positional;

  return process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
}

function printPasswordHelp() {
  console.error("Bootstrap password required.");
  console.error("Set ADMIN_BOOTSTRAP_PASSWORD or run:");
  console.error("  node scripts/seed-initial-admin.mjs --password <password>");
  console.error("Do not commit credentials to the repository.");
}

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

const bootstrapPassword = resolveBootstrapPassword(process.argv);
if (!bootstrapPassword) {
  printPasswordHelp();
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowBootstrap = process.env.ALLOW_ADMIN_BOOTSTRAP === "true" || process.env.NODE_ENV !== "production";

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

if (!allowBootstrap) {
  console.error("Bootstrap blocked in production. Set ALLOW_ADMIN_BOOTSTRAP=true for one-time setup only.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { count, error: countError } = await supabase
  .from("admin_users")
  .select("id", { count: "exact", head: true });

if (countError) {
  console.error("admin_users table missing. Apply sql/migrations/20250625600000_admin_users.sql first.");
  console.error(countError.message);
  process.exit(1);
}

if ((count ?? 0) > 0) {
  console.log("OK admin_users already seeded");
  process.exit(0);
}

const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
const { error } = await supabase.from("admin_users").insert({
  email: "admin@venesia.local",
  username: "admin",
  password_hash: passwordHash,
  full_name: "Administrator",
  role: "admin",
  is_active: true,
  session_version: 1,
});

if (error) {
  console.error("Failed to seed admin user:", error.message);
  process.exit(1);
}

console.log("OK seeded initial admin user (username: admin)");
