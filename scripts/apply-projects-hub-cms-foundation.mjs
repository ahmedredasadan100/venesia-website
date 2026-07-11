/**
 * Applies Projects Hub CMS foundation migration when SUPABASE_DB_URL or DATABASE_URL is set.
 * Usage: node scripts/apply-projects-hub-cms-foundation.mjs
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

const MIGRATION = "sql/migrations/20250712120000_projects_hub_cms_foundation.sql";

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL or DATABASE_URL in .env.local to apply migration SQL.");
  console.error(`Alternatively run ${MIGRATION} in Supabase SQL Editor.`);
  process.exit(1);
}

const sql = readFileSync(resolve(ROOT, MIGRATION), "utf8");
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);

const verify = await client.query(`
  select
    (select count(*)::int from public.pages where path = '/projects') as projects_pages,
    (select id::text from public.pages where slug = 'projects' limit 1) as projects_page_id,
    (select count(*)::int from public.content_block_templates
      where slug in ('projects-hub-hero','projects-hub-featured','projects-hub-listing','projects-hub-map')) as hub_templates,
    (select count(*)::int from public.page_content_block_assignments a
      join public.pages p on p.id = a.page_id
      where p.slug = 'projects') as hub_assignments,
    (select coalesce(array_agg(a.sort_order order by a.sort_order), '{}')
      from public.page_content_block_assignments a
      join public.pages p on p.id = a.page_id
      where p.slug = 'projects') as assignment_orders
`);

await client.end();
console.log(`Applied ${MIGRATION}`);
console.log(verify.rows[0]);
