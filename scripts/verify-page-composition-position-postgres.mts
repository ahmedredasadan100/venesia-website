import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL(
    "../sql/migrations/20260827122828_page_composition_media_position_adoption.sql",
    import.meta.url,
  ),
  "utf8",
);

const db = new PGlite();
await db.exec(`
  create schema if not exists public;

  create table public.page_media_hub_module_assignments (
    id bigint primary key,
    slot text not null default 'main'
      constraint page_media_hub_module_assignments_slot_check check (slot = 'main')
  );

  create table public.page_media_sidebar_module_assignments (
    id bigint primary key,
    slot text not null default 'sidebar'
      constraint page_media_sidebar_module_assignments_slot_check check (slot = 'sidebar')
  );

  insert into public.page_media_hub_module_assignments (id, slot) values (1, 'main');
  insert into public.page_media_sidebar_module_assignments (id, slot) values (1, 'sidebar');
`);

await db.exec(migration);

const legacyConstraints = await db.query<{ count: number }>(`
  select count(*)::integer as count
  from pg_constraint
  where conname in (
    'page_media_hub_module_assignments_slot_check',
    'page_media_sidebar_module_assignments_slot_check'
  )
`);
assert.equal(legacyConstraints.rows[0]?.count, 0);

const defaults = await db.query<{ table_name: string; column_default: string | null }>(`
  select table_name, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'page_media_hub_module_assignments',
      'page_media_sidebar_module_assignments'
    )
    and column_name = 'slot'
  order by table_name
`);
assert.equal(defaults.rows.length, 2);
assert.ok(defaults.rows.every((row) => row.column_default === null));

for (const position of ["main", "sidebar", "bottom", "footer", "hero"]) {
  await db.query(
    "update public.page_media_hub_module_assignments set slot = $1 where id = 1",
    [position],
  );
  await db.query(
    "update public.page_media_sidebar_module_assignments set slot = $1 where id = 1",
    [position],
  );
}

const preserved = await db.query<{ hub_count: number; sidebar_count: number }>(`
  select
    (select count(*)::integer from public.page_media_hub_module_assignments) as hub_count,
    (select count(*)::integer from public.page_media_sidebar_module_assignments) as sidebar_count
`);
assert.deepEqual(preserved.rows[0], { hub_count: 1, sidebar_count: 1 });

await db.close();
console.log(
  "PASS Page Composition Media Position migration: legacy visual-slot constraints/defaults retired, existing Assignments preserved, and every platform Region accepted.",
);
