import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const databaseUrl = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!databaseUrl || !supabaseUrl || !serviceRole) {
  throw new Error("Supabase database and service credentials are required.");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  const functionResult = await client.query(`
    select
      p.oid::regprocedure::text as signature,
      p.provolatile,
      p.prosecdef,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_list_pages'
    order by 1
  `);
  assert.deepEqual(functionResult.rows, [{
    signature: "admin_list_pages(integer,integer,text,text,text)",
    provolatile: "s",
    prosecdef: false,
    anon_execute: false,
    authenticated_execute: false,
    service_execute: true,
  }]);

  const sampleResult = await client.query(`
    with sample as (
      select slug from public.pages where nullif(slug, '') is not null order by id limit 1
    )
    select
      sample.slug,
      (select count(*)::integer from public.pages) as page_count,
      public.admin_list_pages(1, 30, 'id', 'asc') as compatible_result,
      public.admin_list_pages(1, 30, 'id', 'asc', sample.slug) as search_result,
      public.admin_list_pages(999, 30, 'id', 'asc', sample.slug) as normalized_search_result,
      public.admin_list_pages(1, 30, 'id', 'asc', '__pages_search_no_match__') as empty_search_result,
      public.admin_list_pages(1, 30, 'id', 'asc', '%') as literal_wildcard_result,
      (
        select count(*)::integer
        from public.pages p
        where strpos(lower(coalesce(p.title, '')), '%') > 0
          or strpos(lower(coalesce(p.slug, '')), '%') > 0
          or strpos(lower(coalesce(p.path, '')), '%') > 0
          or strpos(lower(coalesce(p.page_type, '')), '%') > 0
          or strpos(lower(coalesce(p.status, '')), '%') > 0
      ) as literal_wildcard_count
    from sample
  `);
  assert.equal(sampleResult.rowCount, 1, "Pages search proof requires one persisted Page slug.");
  const sample = sampleResult.rows[0];
  assert.equal(sample.compatible_result.total_count, sample.page_count);
  assert.equal(sample.normalized_search_result.page, 1);
  assert.equal(sample.normalized_search_result.total_count, sample.search_result.total_count);
  assert.deepEqual(sample.empty_search_result, { rows: [], total_count: 0, page: 1 });
  assert.equal(sample.literal_wildcard_result.total_count, sample.literal_wildcard_count);
  assert.ok(sample.search_result.total_count >= 1);
  assert.ok(sample.search_result.rows.every((row) =>
    [row.title, row.slug, row.path, row.page_type, row.status]
      .some((value) => String(value ?? "").toLowerCase().includes(sample.slug.toLowerCase()))
  ));

  const rest = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const restResult = await rest.rpc("admin_list_pages", {
    p_page: 1,
    p_page_size: 30,
    p_sort_field: "id",
    p_sort_direction: "asc",
    p_search: sample.slug,
  });
  assert.equal(restResult.error, null, restResult.error?.message);
  assert.equal(restResult.data.total_count, sample.search_result.total_count);

  console.log("PASS Admin Pages Search Read Model DB proof");
  console.log(` - one five-argument service-role RPC; old four-argument owner absent.`);
  console.log(` - PostgREST schema cache accepts p_search; ${sample.search_result.total_count}/${sample.page_count} Page rows matched ${sample.slug}.`);
  console.log(" - the optional default preserves existing four-parameter callers without a parallel function.");
} finally {
  await client.end();
}
