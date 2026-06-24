/**
 * Applies hub migration SQL when SUPABASE_DB_URL or DATABASE_URL is set.
 * Usage: node scripts/apply-media-hub-migration.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");

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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL or DATABASE_URL in .env.local to apply migration SQL.");
  console.error("Alternatively run sql/migrations/20250625300000_media_hub_modules.sql in Supabase SQL Editor.");
  process.exit(1);
}

const sql = readFileSync(resolve(ROOT, "sql/migrations/20250625300000_media_hub_modules.sql"), "utf8");
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
await client.end();
console.log("Applied sql/migrations/20250625300000_media_hub_modules.sql");
