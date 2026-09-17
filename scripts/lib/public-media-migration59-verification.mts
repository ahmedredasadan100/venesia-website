import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertMigrationSourceProvenance } from "./migration-provenance.mjs";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";

export const PUBLIC_MEDIA_MIGRATION59_VERSION = "20260804180000";
const sourceUrl = new URL("../../sql/migrations/20260804180000_public_media_truth_closure.sql", import.meta.url);
const historicalTag = "20260804180000_public_media_truth_closure";
const scope = ["topics", "topic_categories", "media_items", "media_categories", "admin_audit_logs", "menus", "menu_items",
  "media_references", "hero_templates", "page_sections", "cta_block_templates", "content_block_templates",
  "cards_block_templates", "breadcrumb_block_templates", "site_settings", "media_hub_module_templates", "media_sidebar_module_templates"];
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function readPublicMediaMigration59(): string {
  const sql = readFileSync(sourceUrl, "utf8").replace(/\r\n?/gu, "\n");
  assertMigrationSourceProvenance({ version: PUBLIC_MEDIA_MIGRATION59_VERSION, name: "public_media_truth_closure", sql });
  return sql;
}

/** Snapshot only; SQL and classification remain owned by the migration. */
export async function capturePublicMedia59(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  await handle.query("begin transaction isolation level repeatable read read only");
  try {
    const relations = (await handle.query(`select c.oid::text as oid,c.relname,pg_get_userbyid(c.relowner) as owner,
      c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[]) order by c.relname`, [scope])).rows;
    const columns = (await handle.query(`select c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull,a.attidentity,a.attgenerated,a.attislocal,a.attinhcount,pg_get_expr(d.adbin,d.adrelid,false) as default_expression
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relname=any($1::text[]) and a.attnum>0 order by c.relname,a.attnum`, [scope])).rows;
    const constraints = (await handle.query(`select c.relname,k.oid::text as oid,to_jsonb(k) as catalog,pg_get_constraintdef(k.oid,false) as definition
      from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[]) order by c.relname,k.conname`, [scope])).rows;
    const indexes = (await handle.query(`select t.relname,pg_get_indexdef(i.indexrelid) as definition,to_jsonb(i) as catalog
      from pg_index i join pg_class t on t.oid=i.indrelid join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname=any($1::text[]) order by t.relname,i.indexrelid`, [scope])).rows;
    const triggers = (await handle.query(`select c.relname,t.tgname,to_jsonb(t) as catalog,pg_get_triggerdef(t.oid,false) as definition
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[]) order by c.relname,t.tgname`, [scope])).rows;
    const functions = (await handle.query(`select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,
      p.proacl::text as acl,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result,
      md5(pg_get_functiondef(p.oid)) as definition_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('global_seo_infrastructure_health','public_media_closure_provenance') order by p.proname`)).rows;
    const registry = (await handle.query("select version,name,statements from supabase_migrations.schema_migrations order by version")).rows.map(row => ({
      version: row.version, name: row.name, statementCount: Array.isArray(row.statements) ? row.statements.length : -1,
      statementsSha256: hash(row.statements),
    }));
    const rowDigests: Record<string, { count: number; sha256: string }> = {};
    for (const row of relations) {
      assert.ok(typeof row.relname === "string" && scope.includes(row.relname));
      const rows = (await handle.query(`select md5(to_jsonb(t)::text) as row_hash from public."${row.relname}" t order by 1`)).rows;
      rowDigests[row.relname] = { count: rows.length, sha256: hash(rows) };
    }
    const modules = (await handle.query(`select 'hub' as kind,id::text as id,config->>'source' as source,config->>'type' as type,null::text as widget_key
      from public.media_hub_module_templates union all select 'sidebar',id::text,config->>'source',null::text,widget_key
      from public.media_sidebar_module_templates order by kind,id`)).rows;
    await handle.query("commit");
    return { relations, columns, constraints, indexes, triggers, functions, registry, rowDigests, modules };
  } catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
}

/** Generated adversarial/reference data belongs ONLY to this disposable test fixture. */
export async function seedHistoricalMediaTestInput(handle: OwnedLocalHandle,
  options: { categories?: number; items?: number; overlong?: number; approvedSuffix?: boolean } = {}) {
  assertOwnedLocalHandle(handle);
  const { categories = 13, items = 28, overlong = 14, approvedSuffix = true } = options;
  assert.ok(Number.isInteger(categories) && categories >= 0 && categories <= 13);
  assert.ok(Number.isInteger(items) && items >= 0 && items <= 28);
  assert.ok(Number.isInteger(overlong) && overlong >= 0 && overlong <= items);
  const empty = (await handle.query("select (select count(*) from public.media_items)::int as items,(select count(*) from public.media_categories)::int as categories")).rows[0];
  assert.deepEqual(empty, { items: 0, categories: 0 });
  await handle.query(`insert into public.media_categories(id,name,slug,description,sort_order,created_at,updated_at)
    overriding system value select 800000+n,'تصنيف تحقق معزول '||n,'qa-contract-category-'||n,'بيانات اختبار مستقلة وليست بيانات إنتاج',n,
    '2026-01-01T00:00:00Z'::timestamptz,'2026-01-01T00:00:00Z'::timestamptz from generate_series(1,$1::int) n`, [categories]);
  await handle.query(`insert into public.media_items(id,slug,title,excerpt,content,image,image_alt,type,category,category_slug,status,
    seo_title,seo_description,published_at,created_at,updated_at) overriding system value
    select 810000+n,'qa-contract-item-'||n,'موضوع تحقق تاريخي معزول يحمل بيانات اختبار رقم '||n,
    'نص دلالي للاختبار المستقل للعقد دون الاعتماد على أي بيانات إنتاج أو استخدامها.',array['محتوى اختباري معزول للتحقق من النقل الذري.'],
    '/images/venesia-5.png','صورة اختبار للتحقق من نقل المحتوى','news','تصنيف تحقق معزول',
    case when $2::int>0 then 'qa-contract-category-'||((n-1)%$2::int+1) else null end,'draft',
    case when n<=$3::int then repeat('a',45)||case when $4::boolean then ' | فينيسيا للتطوير العقاري' else repeat('x',25) end
      else 'عنوان تحقق قصير رقم '||n end,'وصف تحسين ظهور اختباري معزول.',date '2026-01-01',
    '2026-01-01T00:00:00Z'::timestamptz,'2026-01-01T00:00:00Z'::timestamptz from generate_series(1,$1::int) n`,
    [items, categories, overlong, approvedSuffix]);
}

export async function verifyPublicMedia59Failures(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const source = readPublicMediaMigration59();
  const before = await capturePublicMedia59(handle);
  assert.equal(before.registry.length, 58);
  const cases: Array<{ name: string; prepare: () => Promise<unknown> }> = [
    { name: "partial-legacy-category-only", prepare: () => seedHistoricalMediaTestInput(handle, { categories: 1, items: 0, overlong: 0 }) },
    { name: "dangling-legacy-menu-reference", prepare: async () => {
      await handle.query("insert into public.menus(id,name,slug) values(890000,'قائمة تحقق معزولة','qa-contract-menu')");
      await handle.query("insert into public.menu_items(id,menu_id,label,linked_type,linked_id) values(890000,890000,'مرجع معلق للاختبار','media_items',899999)");
    } },
    { name: "historical-evidence-without-source", prepare: () => handle.query(`insert into public.admin_audit_logs
      (id,actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
      values(899999,null,'system:test','public_media.legacy_item_migrated','topic',899999,'QA negative evidence',jsonb_build_object('migration',$1::text))`, [historicalTag]) },
    { name: "ambiguous-preexisting-provenance-function", prepare: () => handle.query("create function public.public_media_closure_provenance() returns jsonb language sql as 'select null::jsonb'") },
    { name: "populated-wrong-seo-cardinality", prepare: () => seedHistoricalMediaTestInput(handle, { overlong: 13 }) },
    { name: "populated-invalid-normalization-suffix", prepare: () => seedHistoricalMediaTestInput(handle, { approvedSuffix: false }) },
  ];
  const results: Array<{ name: string; sqlState: string; rolledBack: boolean; fullUnmodifiedMigration: boolean }> = [];
  for (const test of cases) {
    assert.equal(readPublicMediaMigration59(), source);
    await handle.query("begin");
    let reachedMigration = false, sqlState: string | null = null;
    try {
      await test.prepare();
      reachedMigration = true;
      // Negative-only execution on the same owned connection. The unmodified
      // migration's BEGIN joins this transaction; its expected ERROR precedes
      // COMMIT. Unexpected success stops and requires full fixture disposal.
      await handle.query(source);
    } catch (error) {
      if (reachedMigration && typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") sqlState = error.code;
      else throw error;
    } finally { await handle.query("rollback").catch(() => undefined); }
    assert.equal(sqlState, "P0001", `Expected fail-closed migration failure: ${test.name}; discard fixture if the migration committed.`);
    assert.deepEqual(await capturePublicMedia59(handle), before, `Negative case changed persistent schema/data/history: ${test.name}`);
    results.push({ name: test.name, sqlState, rolledBack: true, fullUnmodifiedMigration: true });
    handle.record("migration59-negative-case", { name: test.name, sqlState, rolledBack: true });
  }
  return results;
}

export async function readPublicMedia59Closure(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const acl = (await handle.query(`select pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,
    p.pronargs,pg_get_function_result(p.oid) as result,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='public_media_closure_provenance'`)).rows;
  assert.equal(acl.length, 1);
  assert.equal(acl[0].owner, "postgres");
  assert.equal(acl[0].prosecdef, true);
  assert.equal(acl[0].provolatile, "s");
  assert.deepEqual(acl[0].proconfig, ['search_path=""']);
  assert.equal(acl[0].pronargs, 0);
  assert.equal(acl[0].result, "jsonb");
  assert.equal(acl[0].anon_execute, false);
  assert.equal(acl[0].authenticated_execute, false);
  assert.equal(acl[0].service_execute, true);
  await handle.query("begin transaction read only");
  try {
    await handle.query("set local role service_role");
    const provenance = (await handle.query("select public.public_media_closure_provenance() as proof")).rows[0].proof;
    const infrastructure = (await handle.query("select public.global_seo_infrastructure_health() as proof")).rows[0].proof;
    await handle.query("commit");
    return { acl: acl[0], provenance, infrastructure, serviceRoleReadVerified: true };
  } catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
}
