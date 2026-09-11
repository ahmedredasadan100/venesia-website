import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { verifyTopicViewIntegrity } from "./verify-topic-view-integrity.mts";

// Match the real Next Node runtime before loading its proxy test utilities.
createRequire(import.meta.url)("next/dist/server/node-environment-baseline");

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.resolve(root, file), "utf8").replace(/\r\n/g, "\n");
type Database = {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
};
const databaseUrl = process.env.TOPIC_VIEW_TEST_DATABASE_URL;
let db: Database;
let rpcDb: Database;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.equal(url.pathname, "/venesia_topic_view_test");
  assert.equal(process.env.TOPIC_VIEW_TEST_DATABASE_DISPOSABLE, "1");
  const { Pool, types } = createRequire(import.meta.url)("pg") as {
    Pool: new (options: object) => { query: Database["query"]; end(): Promise<void> };
    types: { setTypeParser(oid: number, parse: (value: string) => number): void };
  };
  types.setTypeParser(20, Number); // Fixture IDs/counters are all small integers.
  const connect = (options: object): Database => {
    const pool = new Pool({ connectionString: databaseUrl, max: 40, ...options });
    return { query: pool.query.bind(pool), exec: pool.query.bind(pool), close: () => pool.end() };
  };
  db = connect({});
  assert.equal((await db.query("select tablename from pg_tables where schemaname='public'")).rows.length, 0,
    "Refuse an existing database containing tables; fixtures require an empty disposable database");
  rpcDb = connect({ options: "-c role=service_role" });
} else {
  assert.notEqual(process.env.TOPIC_VIEW_TEST_DATABASE_REQUIRED, "1", "Native PostgreSQL URL is required for concurrency proof");
  db = await PGlite.create();
  rpcDb = db;
}
const stubs = new Map<string, unknown>();
const modules = new Map<string, { exports: unknown }>();
const stub = (file: string, value: unknown) => stubs.set(path.resolve(root, file), value);

// Run the actual TS action, helper, reload page, and public loader. Only external
// framework/auth/media effects and the database transport are substituted. RPC
// bodies, triggers, constraints, transactions and persisted reads execute in SQL.
function load(file: string): unknown {
  const filename = path.resolve(root, file);
  if (stubs.has(filename)) return stubs.get(filename);
  if (modules.has(filename)) return modules.get(filename)!.exports;
  const target = { exports: {} as unknown };
  modules.set(filename, target);
  const compiled = ts.transpileModule(read(filename), {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const nativeRequire = createRequire(filename);
  const localRequire = (specifier: string): unknown => {
    if (stubs.has(specifier)) return stubs.get(specifier);
    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), specifier);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
        if (stubs.has(candidate) || existsSync(candidate) && /\.tsx?$/.test(candidate)) return load(candidate);
      }
    }
    return nativeRequire(specifier);
  };
  const factory = new vm.Script(`(function(require,module,exports){${compiled}\n})`, { filename })
    .runInThisContext() as (require: typeof localRequire, module: typeof target, exports: unknown) => void;
  factory(localRequire, target, target.exports);
  return target.exports;
}

function section(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `SQL owner section missing: ${start}`);
  return source.slice(from, to + end.length);
}

type Result = { data: unknown; error: { message: string } | null };
let rpcCalls = 0;
let injectedRpc: (() => Promise<Result>) | undefined;
const transport = {
  async rpc(name: string, args: Record<string, unknown>): Promise<Result> {
    rpcCalls++;
    if (injectedRpc) return injectedRpc();
    try {
      if (name === "increment_topic_view") {
        const result = await rpcDb.query<{ value: unknown }>(
          "select public.increment_topic_view($1,$2,$3) as value", [args.p_topic_id, args.p_visitor_key, args.p_ip_key],
        );
        return { data: result.rows[0].value, error: null };
      }
      if (name === "prune_topic_view_state") {
        return { data: (await rpcDb.query<{ value: unknown }>("select public.prune_topic_view_state() as value")).rows[0].value, error: null };
      }
      assert.equal(name, "mutate_page_composition");
      const result = await db.query<{ value: unknown }>(
        "select public.mutate_page_composition($1,$2,$3::jsonb,$4,$5) as value",
        [args.p_page_id, args.p_operation, JSON.stringify(args.p_payload), args.p_actor_admin_user_id, args.p_actor_username],
      );
      return { data: result.rows[0].value, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
  from(table: string) {
    assert.ok(["hero_templates", "hero_assignments", "pages"].includes(table));
    const predicates: string[] = [];
    const values: unknown[] = [];
    let selection = "*";
    let maximum: number | undefined;
    let single = false;
    let update: Record<string, unknown> | undefined;
    const orders: string[] = [];
    const identifier = (value: string) => {
      assert.match(value, /^[a-z_]+$/);
      return value;
    };
    const filter = (column: string, operator: string, value: unknown) => {
      values.push(value);
      predicates.push(`t.${identifier(column)} ${operator} $${values.length}`);
      return query;
    };
    const query = {
      select(value: string) { selection = value; return query; },
      eq(column: string, value: unknown) { return filter(column, "=", value); },
      neq(column: string, value: unknown) { return filter(column, "<>", value); },
      in(column: string, value: unknown[]) {
        values.push(value); predicates.push(`t.${identifier(column)} = any($${values.length})`); return query;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orders.push(`t.${identifier(column)} ${options?.ascending === false ? "desc" : "asc"}`);
        return query;
      },
      limit(value: number) { maximum = value; return query; },
      update(value: Record<string, unknown>) { update = value; return query; },
      maybeSingle() { single = true; return query; },
      single() { single = true; return query; },
      async then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
        try {
          const where = predicates.length ? ` where ${predicates.join(" and ")}` : "";
          let sql: string;
          if (update) {
            const sets = Object.entries(update).map(([key, value]) => {
              values.push(value);
              return `${identifier(key)} = $${values.length}`;
            });
            sql = `update public.${table} t set ${sets.join(",")}${where} returning *`;
          } else {
            const columns = selection.includes("hero_templates(")
              ? "t.*, (select row_to_json(h) from public.hero_templates h where h.id=t.hero_id) as hero_templates"
              : "t.*";
            sql = `select ${columns} from public.${table} t${where}`;
            if (orders.length) sql += ` order by ${orders.join(",")}`;
            if (maximum !== undefined) sql += ` limit ${maximum}`;
          }
          const rows = (await db.query(sql, values)).rows;
          if (single) assert.ok(rows.length <= 1, "maybeSingle must not hide duplicate records");
          return resolve({ data: single ? rows[0] ?? null : rows, error: null });
        } catch (error) {
          if (reject && !(error instanceof Error)) return reject(error);
          return resolve({ data: null, error: { message: (error as Error).message } });
        }
      },
    };
    return query;
  },
};

try {
  await db.exec(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  end $$; grant usage on schema public to service_role;`);
  await db.exec(`
    create table public.topics (
      id bigint primary key, status text not null, deleted_at timestamptz,
      views_count bigint not null default 0 check (views_count >= 0),
      is_popular boolean not null default false, updated_at timestamptz default now()
    );
    create table public.pages (id bigint primary key, title text, slug text, path text, status text);
    create table public.hero_templates (
      id bigint primary key, name text not null, slug text unique not null,
      description text, variant text default 'internal-page', style_preset text default 'cinematic-gold',
      source_type text, source_slug text, limit_count integer, config jsonb default '{}',
      sort_order integer default 0, status text not null default 'unpublished'
        check (status in ('published','unpublished')), is_visible boolean not null default true,
      updated_at timestamptz default now()
    );
    create table public.hero_assignments (
      id bigint generated always as identity primary key,
      hero_id bigint references public.hero_templates(id), target_type text, target_id bigint,
      target_slug text, path text, is_active boolean, priority integer,
      created_at timestamptz, updated_at timestamptz
    );
    create table public.admin_audit_logs (
      id bigint generated always as identity primary key, actor_admin_user_id bigint,
      actor_username text, action text, entity_type text, entity_id bigint, entity_label text, metadata jsonb
    );
  `);
  for (const kind of ["content_block", "cta_block", "cards_block", "breadcrumb_block", "feed_module", "featured_module", "media_sidebar_module", "media_hub_module"]) {
    await db.exec(`create table public.page_${kind}_assignments (id bigint primary key, page_id bigint)`);
  }
  const foundation = read("sql/migrations/20260805180000_global_truth_atomic_operations_closure.sql");
  const publication = read("sql/migrations/20260807120000_system_publication_summary_cards_closure.sql");
  await db.exec(section(foundation, "create or replace function public.mutate_page_composition(", "\n$function$;"));
  // Apply every subsequent in-place rewrite of this owner, without executing
  // unrelated migrations or substituting a simplified RPC implementation.
  const rewriteStart = publication.lastIndexOf("do $$", publication.indexOf("select pg_get_functiondef('public.mutate_page_composition"));
  await db.exec(section(publication.slice(rewriteStart), "do $$", "\n$$;"));
  await db.exec(read("sql/migrations/20260810010000_page_delete_hero_assignment_integrity.sql"));
  await db.exec(section(read("sql/migrations/20260828233733_featured_page_composition_module.sql"),
    "do $extend_page_composition_owner$", "\n$extend_page_composition_owner$;"));
  await db.exec(section(publication, "create or replace function public.sync_hero_template_publication_compatibility()",
    "for each row execute function public.sync_hero_template_publication_compatibility();"));
  await db.exec(section(read("sql/migrations/20260717070000_unified_content_engine_foundation.sql"),
    "create or replace function public.increment_topic_view(", "\n$$;"));
  await db.exec("grant select,update on public.topics to service_role");
  await db.exec(`
    insert into public.topics(id,status,views_count,is_popular) values (1,'published',418,true),(2,'unpublished',19,false);
    insert into public.topics(id,status,views_count,deleted_at) values (3,'published',23,now());
    insert into public.pages values (1,'Fixture Page','fixture-page','/fixture-page','published');
    insert into public.hero_templates(id,name,slug,status,is_visible) values (10,'Fixture Hero','fixture-hero','unpublished',false);
  `);
  const existingCounters = (await db.query("select * from public.topics order by id")).rows;
  // Reproduce hosting defaults: new tables already grant service_role ALL.
  // The migration must establish the final ACL, not merely add SELECT to it.
  await db.exec(`alter default privileges in schema public grant all on tables to service_role;
    create table public.topic_view_default_acl_probe(id integer);`);
  assert.equal((await db.query<{ allowed: boolean }>(
    "select has_table_privilege('service_role','public.topic_view_default_acl_probe','UPDATE,DELETE') as allowed",
  )).rows[0].allowed, true);
  await db.exec("drop table public.topic_view_default_acl_probe");
  await db.exec(read("sql/migrations/20260911194004_topic_view_integrity.sql"));
  assert.deepEqual((await db.query("select * from public.topics order by id")).rows, existingCounters,
    "Migration application preserves pre-existing counters and every existing Topic field");

  stub("src/lib/supabase-admin.ts", { getSupabaseAdmin: () => transport });
  stub("src/lib/logging/index.ts", { logError: () => undefined });
  stubs.set("server-only", {});
  const revalidated: string[] = [];
  stubs.set("next/cache", {
    revalidatePath: (value: string) => revalidated.push(value),
    unstable_cache: (fn: unknown) => fn,
  });
  stubs.set("react", { ...React, cache: (fn: unknown) => fn });
  stubs.set("next/navigation", {
    redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
    notFound: () => { throw new Error("NOT_FOUND"); },
  });
  stub("src/lib/admin/auth/require-admin-session.ts", { requireAdminSession: async () => ({ id: 1, username: "isolated-fixture" }) });
  stub("src/lib/admin/audit-log.ts", { recordCmsAdminAudit: async () => undefined });
  stub("src/lib/admin/media-catalog/domain-write-coordination.ts", {
    coordinateMediaReferenceEntityMutation: async ({ mutate }: { mutate: () => Promise<unknown> }) => ({
      value: await mutate(), mediaSynchronization: { status: "synchronized" },
    }),
  });
  stub("src/lib/admin/media-catalog/synchronization.ts", {});
  stub("src/lib/cache/revalidate-public-cache-tags.ts", { revalidateHeroCache: () => revalidated.push("hero") });
  stub("src/lib/media-center/revalidate-public-paths.ts", { revalidateMediaCenterPublicPaths: () => undefined });
  stub("src/lib/page-blocks/block-module-registry.ts", { BLOCK_MODULE_REGISTRY: {} });
  stub("src/lib/page-blocks/module-assignments-query.ts", {
    getHeroAssignmentConflicts: async () => [], getHeroModuleAssignmentContext: async () => ({}),
  });
  stub("src/lib/admin/links/hero-config.ts", { resolveHeroConfigLinks: async (value: unknown) => value });
  stub("src/lib/pages/get-published-page-by-slug.ts", {
    getPublishedPageStateBySlug: async () => ({ page: (await db.query("select * from public.pages where id=1 and status='published'")).rows[0], sourceStatus: "ok" }),
  });
  stub("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx", { __esModule: true, default: () => null });

  await verifyTopicViewIntegrity({ db, rpcDb, native: Boolean(databaseUrl), load, stubs, read,
    rpcCalls: () => rpcCalls, inject: (value) => { injectedRpc = value; } });

  if (!process.argv.includes("--metrics-only")) {
  const actions = load("src/app/admin/pages-blocks/blocks/hero/actions.ts") as typeof import("../src/app/admin/pages-blocks/blocks/hero/actions.ts");
  const reload = load("src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx") as typeof import("../src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx");
  const publicOwner = load("src/lib/load-hero-section.ts") as typeof import("../src/lib/load-hero-section.ts");
  const form = (status: string, pageId = "1") => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ id: "10", name: "Fixture Hero", slug: "fixture-hero", variant: "internal-page", status, page_ids: pageId })) data.append(key, value);
    return data;
  };
  async function assertState(status: string) {
    const row = (await db.query("select status,is_visible from public.hero_templates where id=10")).rows[0];
    assert.deepEqual(row, { status, is_visible: status === "published" });
    const editor = await reload.default({ params: Promise.resolve({ id: "10" }) });
    assert.equal(editor.props.hero.status, status, "Admin reload must reflect committed status");
    const publicState = await publicOwner.getHeroSectionState("fixture-page");
    assert.equal(publicState.visibility, status === "published" ? "visible" : "hidden");
    assert.equal(publicState.hero !== null, status === "published");
    return publicState;
  }
  for (const status of ["unpublished", "published", "published", "unpublished"]) {
    const before = rpcCalls;
    await assert.rejects(actions.updateHeroTemplateDetails(form(status)), /REDIRECT:.*saved=1/);
    assert.equal(rpcCalls, before + 1, "the actual action must call the actual RPC helper");
    await assertState(status);
    assert.ok(revalidated.includes("hero") && revalidated.includes("/admin/pages-blocks/blocks/hero/10"));
    revalidated.length = 0;
  }
  for (const status of ["published", "unpublished"]) {
    const data = new FormData(); data.set("id", "10"); data.set("next_status", status);
    await actions.toggleHeroTemplate(data);
    await assertState(status);
  }
  const snapshot = async () => (await db.query(`select
    (select jsonb_agg(t) from public.hero_templates t) as templates,
    (select jsonb_agg(a order by id) from public.hero_assignments a) as assignments,
    (select count(*)::integer from public.admin_audit_logs) as audits`)).rows[0];
  const beforeFailure = await snapshot();
  // Valid anchor, invalid second assignment: failure occurs after template UPDATE.
  const invalidAssignments = form("published"); invalidAssignments.append("page_ids", "999");
  await assert.rejects(actions.updateHeroTemplateDetails(invalidAssignments), /hero_page_assignment_invalid/);
  assert.deepEqual(await snapshot(), beforeFailure, "RPC failure rolls back template, compatibility trigger, assignments and audit");
  await assertState("unpublished");
  await db.exec(`create function reject_hero_audit() returns trigger language plpgsql as $$
    begin raise exception 'fixture_audit_failure'; end $$;
    create trigger reject_hero_audit before insert on public.admin_audit_logs for each row execute function reject_hero_audit();`);
  await assert.rejects(actions.updateHeroTemplateDetails(form("published")), /fixture_audit_failure/);
  assert.deepEqual(await snapshot(), beforeFailure);
  await db.exec("drop trigger reject_hero_audit on public.admin_audit_logs");
  await assert.rejects(actions.updateHeroTemplateDetails(form("published")), /REDIRECT:.*saved=1/);
  await assertState("published");
  await db.exec("update public.hero_assignments set is_active=false where hero_id=10");
  const hidden = await publicOwner.getHeroSectionState("fixture-page");
  assert.equal(hidden.visibility, "hidden"); assert.equal(hidden.hero, null);
  assert.deepEqual((await db.query("select status,is_visible from public.hero_templates where id=10")).rows[0], { status: "published", is_visible: true });

  // Exercise the real rendering branch; unrelated module renderers have no
  // entries in this fixture. Hidden/error must never reactivate fallbackHero.
  for (const file of ["sections/DynamicHeroSection", "feed-modules/FeedModuleSection", "featured/FeaturedModuleSection"]) {
    stub(`src/components/${file}.tsx`, { __esModule: true, default: () => React.createElement("div", null, "fixture-hero") });
  }
  stub("src/components/media-center/MediaSidebar.tsx", { MediaSidebarWidget: () => null });
  stub("src/components/media-center/renderMediaHubSections.tsx", { renderMediaHubSections: () => [] });
  stub("src/components/page-composition/build-slot-render-plan.tsx", { buildSlotRenderPlan: () => [] });
  stub("src/components/page-composition/VenesiaThemeMediaHubLayout.tsx", { renderVenesiaThemeMediaHubNodes: () => [] });
  const layout = load("src/components/page-composition/PageSlotLayout.tsx") as typeof import("../src/components/page-composition/PageSlotLayout.tsx");
  const composition = { slots: { hero: [], main: [], sidebar: [], bottom: [], footer: [] }, heroVisibility: "hidden" } as unknown as import("../src/lib/page-blocks/page-composition-types.ts").PageComposition;
  for (const visibility of ["hidden", "error", "none"] as const) {
    composition.heroVisibility = visibility;
    const html = renderToStaticMarkup(React.createElement(layout.HeroSlotContent, { composition, fallbackHero: "fixture-fallback" }));
    assert.equal(html.includes("fixture-fallback"), visibility === "none");
  }
  console.log("PASS ADM-01: actual Admin action -> helper -> complete RPC + compatibility trigger -> committed SQL -> Admin reload/public loader; four edit transitions, status-only toggle, assignment hiding, two atomic rollback paths, no hidden/error Hero fallback. No Hero production change required.");
  } else {
    console.log("ADM-01: unchanged prior action/RPC/trigger/reload evidence retained; not rerun by --metrics-only.");
  }
} finally {
  if (rpcDb !== db) await rpcDb.close();
  if (databaseUrl) await db.exec("drop schema public cascade; create schema public");
  await db.close();
  console.log("CLEANUP: isolated fixtures removed/closed; no shared database, real records, auth users or media touched.");
}
