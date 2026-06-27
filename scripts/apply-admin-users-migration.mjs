import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const migrationPath = path.join(root, "sql/migrations/20250625600000_admin_users.sql");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const sql = fs.readFileSync(migrationPath, "utf8");
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || "pmqsfqvvekrlujqgurcu";

if (!accessToken) {
  console.error("Apply this migration in Supabase SQL editor (Dashboard → SQL → New query):");
  console.error(migrationPath);
  console.error("");
  console.error("Or set SUPABASE_ACCESS_TOKEN and rerun:");
  console.error("  node scripts/apply-admin-users-migration.mjs");
  process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Management API failed (${response.status}):`, body);
  process.exit(1);
}

console.log("Applied migration via Supabase Management API:", path.basename(migrationPath));
