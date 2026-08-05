import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is required.");

const migrationVersion = "20260805180000";
const migrationAuditKey = "20260805180000_global_truth_atomic_operations_closure";
const migrationPath = "sql/migrations/20260805180000_global_truth_atomic_operations_closure.sql";
const migrationSource = readFileSync(migrationPath, "utf8").replace(/^\uFEFF/u, "");
const migrationSha256 = createHash("sha256").update(migrationSource).digest("hex");
const failures: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: "global-truth-atomic-closure-read-only-proof",
});

await client.connect();
await client.query("begin read only");
try {
  const health = (await client.query(
    "select public.global_truth_atomic_closure_health() as health",
  )).rows[0]?.health as Record<string, unknown> | undefined;
  for (const flag of [
    "media_global_write_adoption_closed",
    "hardcoded_project_truth_closed",
    "menu_atomic_operations_closed",
    "page_composition_atomic_operations_closed",
  ]) {
    check(health?.[flag] === true, `Closure health flag is not true: ${flag}`);
  }

  const registry = (await client.query(
    `select version,name,cardinality(statements) as statement_count,statements[1] as statement
     from supabase_migrations.schema_migrations where version=$1`,
    [migrationVersion],
  )).rows;
  check(registry.length === 1, "Closure migration registry row must exist exactly once.");
  check(registry[0]?.name === "global_truth_atomic_operations_closure", "Closure migration registry name drifted.");
  check(Number(registry[0]?.statement_count) === 1, "Closure migration registry must contain one atomic statement payload.");
  const registryHash = registry[0]?.statement
    ? createHash("sha256").update(String(registry[0].statement)).digest("hex")
    : null;
  check(registryHash === migrationSha256, "Closure migration registry SQL does not match the repository migration.");

  const catalog = (await client.query(`
    select count(*)::integer as total,
           count(distinct code)::integer as unique_codes,
           count(distinct slug)::integer as unique_slugs,
           count(*) filter (where nullif(btrim(code),'') is null)::integer as missing_codes,
           count(*) filter (where image is null or hero_image is null)::integer as missing_root_media
    from public.projects
  `)).rows[0];
  check(Number(catalog.total) === 13, "Database Project catalog must contain exactly 13 transferred Projects.");
  check(Number(catalog.unique_codes) === 13 && Number(catalog.unique_slugs) === 13, "Project codes and slugs must be unique.");
  check(Number(catalog.missing_codes) === 0 && Number(catalog.missing_root_media) === 0, "Transferred Project identity/media is incomplete.");

  const preservedRoot = (await client.query(`
    select md5(coalesce(string_agg(
      id::text||':'||slug||':'||coalesce(arabic_name,'')||':'||coalesce(english_name,'')||':'||
      coalesce(image,'')||':'||coalesce(hero_image,''),'|' order by id),'')) as hash
    from public.projects where id=2
  `)).rows[0]?.hash;
  check(preservedRoot === "3cdb71a8d0896a399a6e04ded935d010", "Pre-existing Project root content changed during transfer.");

  const preservedChildren = await client.query(`
    select 'project_location_points' as object,count(*)::integer as rows,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) as hash from public.project_location_points t where project_id=2
    union all select 'project_features',count(*)::integer,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.project_features t where project_id=2
    union all select 'project_floor_plans',count(*)::integer,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.project_floor_plans t where project_id=2
    union all select 'project_floor_plan_details',count(*)::integer,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by t.id),'')) from public.project_floor_plan_details t join public.project_floor_plans p on p.id=t.floor_plan_id where p.project_id=2
    union all select 'project_delivery_items',count(*)::integer,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.project_delivery_items t where project_id=2
    union all select 'project_media',count(*)::integer,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.project_media t where project_id=2
    union all select 'project_videos',count(*)::integer,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.project_videos t where project_id=2
  `);
  const expectedChildProof = new Map([
    ["project_location_points", [5, "6baa91fe3507b4583152d3496f380aca"]],
    ["project_features", [4, "73c5cf498aff624faf06ec2bc989ae0a"]],
    ["project_floor_plans", [2, "57c3e77c7df15d6ba3d72bd23e4d319e"]],
    ["project_floor_plan_details", [2, "3de9f6781f1b930405efef92003edf60"]],
    ["project_delivery_items", [2, "776538e23d8b05879b4dd71fb23793e3"]],
    ["project_media", [3, "dfca38fac3266941b56ed9407950026e"]],
    ["project_videos", [0, "d41d8cd98f00b204e9800998ecf8427e"]],
  ]);
  for (const row of preservedChildren.rows) {
    const expected = expectedChildProof.get(String(row.object));
    check(Boolean(expected), `Unexpected preserved child relation: ${row.object}`);
    check(Number(row.rows) === expected?.[0] && row.hash === expected?.[1], `Pre-existing child content changed: ${row.object}`);
  }

  const requiredIndexes = [
    "projects_code_unique_idx",
    "projects_homepage_order_unique_idx",
    "projects_public_homepage_idx",
    "menu_items_menu_parent_order_unique_idx",
    "menu_items_parent_lookup_idx",
    "hero_assignments_page_template_unique_idx",
  ];
  const indexes = await client.query(
    `select indexname from pg_indexes where schemaname='public' and indexname=any($1)`,
    [requiredIndexes],
  );
  check(indexes.rows.length === requiredIndexes.length, "Required Project/Menu/Page indexes are missing.");

  const functionAcl = await client.query(`
    select p.oid::regprocedure::text as function_name,
           array_agg(distinct role.rolname order by role.rolname)
             filter (where acl.privilege_type='EXECUTE') as execute_roles
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    left join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl on true
    left join pg_roles role on role.oid=acl.grantee
    where n.nspname='public' and p.proname in (
      'mutate_menu_tree','mutate_page_composition','global_truth_atomic_closure_health',
      'save_project_admin_entry','save_project_admin_entry_core',
      'duplicate_project_admin_entry','duplicate_project_admin_entry_core'
    )
    group by p.oid order by function_name
  `);
  const aclByFunction = new Map(functionAcl.rows.map((row: { function_name: string; execute_roles: unknown }) => [row.function_name, row.execute_roles]));
  const normalizeAcl = (value: unknown) => String(value ?? "")
    .replace(/^\{|\}$/gu, "")
    .split(",")
    .filter(Boolean)
    .sort();
  for (const name of [
    "mutate_menu_tree(bigint,text,jsonb,bigint,text)",
    "mutate_page_composition(bigint,text,jsonb,bigint,text)",
    "global_truth_atomic_closure_health()",
    "save_project_admin_entry(bigint,jsonb)",
    "duplicate_project_admin_entry(bigint)",
  ]) {
    check(JSON.stringify(normalizeAcl(aclByFunction.get(name))) === JSON.stringify(["postgres", "service_role"]), `Public RPC ACL drifted: ${name}`);
  }
  for (const name of ["save_project_admin_entry_core(bigint,jsonb)", "duplicate_project_admin_entry_core(bigint)"]) {
    check(JSON.stringify(normalizeAcl(aclByFunction.get(name))) === JSON.stringify(["postgres"]), `Private core RPC ACL drifted: ${name}`);
  }

  const rls = await client.query(`
    select c.relname,c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1)
  `, [[
    "projects","menus","menu_items","pages","hero_assignments",
    "page_content_block_assignments","page_cta_block_assignments","page_cards_block_assignments",
    "page_breadcrumb_block_assignments","page_feed_module_assignments",
    "page_media_sidebar_module_assignments","page_media_hub_module_assignments",
  ]]);
  check(rls.rows.length === 12 && rls.rows.every((row: { relrowsecurity: boolean }) => row.relrowsecurity), "Affected tables must retain RLS.");
  const writePolicies = await client.query(`
    select count(*)::integer as count from pg_policies
    where schemaname='public' and tablename=any($1) and cmd <> 'SELECT'
  `, [rls.rows.map((row: { relname: string }) => row.relname)]);
  check(Number(writePolicies.rows[0]?.count) === 0, "Affected tables must expose no public write RLS policy.");

  const triggerCounts = await client.query(`
    select tgname,count(*)::integer as count from pg_trigger
    where not tgisinternal and tgname in ('menu_item_atomic_contract_guard','page_composition_atomic_guard')
    group by tgname
  `);
  const triggerMap = new Map(triggerCounts.rows.map((row: { tgname: string; count: number | string }) => [row.tgname, Number(row.count)]));
  check(triggerMap.get("menu_item_atomic_contract_guard") === 1, "Menu atomic trigger guard count drifted.");
  check(triggerMap.get("page_composition_atomic_guard") === 8, "Page Composition trigger guard count drifted.");

  const diagnostics = await client.query(`
    select
      to_regclass('public.page_sections') is null as page_sections_removed,
      to_regclass('public.page_composition_assignments') is not null as aggregate_view_present,
      (select count(*) from (select menu_id,parent_id,sort_order from public.menu_items group by menu_id,parent_id,sort_order having count(*)>1) d) as menu_duplicates,
      (select count(*) from (select page_id,slot,sort_order from public.page_composition_assignments where kind<>'hero' group by page_id,slot,sort_order having count(*)>1) d) as page_duplicates,
      (select count(*) from public.admin_audit_logs where metadata->>'migration'=$1 and entity_type='project') as project_transfer_audits,
      (select count(*) from public.admin_audit_logs where action='global_truth_atomic.closure_installed' and metadata->>'migration'=$1) as closure_audits
  `, [migrationAuditKey]);
  const proof = diagnostics.rows[0];
  check(proof.page_sections_removed && proof.aggregate_view_present, "Legacy Page owner removal or aggregate view proof failed.");
  check(Number(proof.menu_duplicates) === 0 && Number(proof.page_duplicates) === 0, "Atomic ordering contains duplicate owners.");
  check(Number(proof.project_transfer_audits) === 13 && Number(proof.closure_audits) === 1, "Migration Audit proof is incomplete.");

  if (failures.length) {
    console.error("Global truth/atomic PostgreSQL proof failed:\n");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("Global truth/atomic PostgreSQL proof passed.");
    console.log(JSON.stringify({
      migration_version: migrationVersion,
      migration_sha256: migrationSha256,
      ...health,
      database_proof: proof,
    }, null, 2));
  }
} finally {
  await client.query("rollback");
  await client.end();
}
