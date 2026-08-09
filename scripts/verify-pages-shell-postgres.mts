import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  "sql/migrations/20260810010000_page_delete_hero_assignment_integrity.sql",
  "utf8",
).replace(/^\uFEFF/u, "");

const db = await PGlite.create();
try {
  async function count(sql: string) {
    return Number((await db.query<{ count: number }>(sql)).rows[0]?.count ?? -1);
  }

  await db.exec(`
    create table public.pages (
      id bigint primary key,
      title text not null
    );
    create table public.hero_templates (
      id bigint primary key,
      name text not null
    );
    create table public.hero_assignments (
      id bigint primary key,
      hero_id bigint not null references public.hero_templates(id),
      target_type text not null,
      target_id bigint not null
    );

    create or replace function public.mutate_page_composition(
      p_page_id bigint,
      p_operation text,
      p_payload jsonb default '{}'::jsonb,
      p_actor_admin_user_id bigint default null,
      p_actor_username text default null
    ) returns jsonb
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $function$
    begin
      if p_operation = 'noop' then
        return '{}'::jsonb;
      elsif p_operation = 'delete_page' then
        delete from public.pages where id = p_page_id;
        return jsonb_build_object('deleted_page_id', p_page_id);
      elsif p_operation = 'replace_hero_template' then
        return '{}'::jsonb;
      end if;
      raise exception 'unsupported_operation';
    end;
    $function$;
  `);

  await db.exec(migration);

  const remoteDefinition = String((await db.query<{ definition: string }>(
    "select pg_get_functiondef('public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure) as definition",
  )).rows[0]?.definition ?? "");
  assert.match(
    remoteDefinition,
    /delete from public\.hero_assignments\s+where target_type = 'page' and target_id = p_page_id;\s+delete from public\.pages where id = p_page_id;/u,
  );

  await db.exec(`
    insert into public.hero_templates(id,name) values (10,'Shared Hero');
    insert into public.pages(id,title) values (1,'Delete succeeds'),(2,'Delete fails');
    insert into public.hero_assignments(id,hero_id,target_type,target_id) values
      (101,10,'page',1),
      (102,10,'route',1),
      (201,10,'page',2);
  `);

  await db.query(
    "select public.mutate_page_composition($1,'delete_page','{}'::jsonb,null,'fixture')",
    [1],
  );
  assert.equal(await count("select count(*)::integer as count from public.pages where id=1"), 0);
  assert.equal(await count("select count(*)::integer as count from public.hero_assignments where target_type='page' and target_id=1"), 0);
  assert.equal(await count("select count(*)::integer as count from public.hero_assignments where target_type='route' and target_id=1"), 1);
  assert.equal(await count("select count(*)::integer as count from public.hero_templates where id=10"), 1);

  await db.exec(`
    create function public.reject_fixture_page_delete() returns trigger
    language plpgsql as $trigger$
    begin
      if old.id = 2 then
        raise exception 'fixture_page_delete_blocked';
      end if;
      return old;
    end;
    $trigger$;
    create trigger reject_fixture_page_delete
      before delete on public.pages
      for each row execute function public.reject_fixture_page_delete();
  `);

  await assert.rejects(
    db.query(
      "select public.mutate_page_composition($1,'delete_page','{}'::jsonb,null,'fixture')",
      [2],
    ),
    /fixture_page_delete_blocked/u,
  );
  assert.equal(await count("select count(*)::integer as count from public.pages where id=2"), 1);
  assert.equal(await count("select count(*)::integer as count from public.hero_assignments where target_type='page' and target_id=2"), 1);

  const deletedAtColumnCount = await count(`
    select count(*)::integer as count
    from information_schema.columns
    where table_schema='public' and table_name='pages' and column_name='deleted_at'
  `);
  assert.equal(deletedAtColumnCount, 0);

  console.log("Pages Shell isolated Postgres proof passed (scoped cleanup, hard delete, and atomic rollback).\n");
} finally {
  await db.close();
}
