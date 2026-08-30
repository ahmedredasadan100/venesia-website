import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const migrationVersion = "20260810010000";
const migrationName = "page_delete_hero_assignment_integrity";
const migrationPath =
  "sql/migrations/20260810010000_page_delete_hero_assignment_integrity.sql";
const migrationSource = readFileSync(migrationPath, "utf8")
  .replace(/^\uFEFF/u, "")
  .replace(/\r\n?/gu, "\n");
const migrationSha256 = createHash("sha256")
  .update(migrationSource)
  .digest("hex");
const connectionString = process.env.SUPABASE_DB_URL;
assert.ok(connectionString, "SUPABASE_DB_URL is required.");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: "pages-shell-live-read-only-proof",
});

await client.connect();
await client.query("begin read only");
try {
  const functionDefinition = String((await client.query(
    "select pg_get_functiondef('public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure) as definition",
  )).rows[0]?.definition ?? "");
  const branchStart = functionDefinition.indexOf("elsif p_operation = 'delete_page'");
  const branchEnd = functionDefinition.indexOf(
    "elsif p_operation = 'replace_hero_template'",
    branchStart,
  );
  assert.ok(branchStart >= 0 && branchEnd > branchStart, "Remote delete_page branch is missing.");
  const deleteBranch = functionDefinition.slice(branchStart, branchEnd);
  const heroCleanup =
    "delete from public.hero_assignments\n    where target_type = 'page' and target_id = p_page_id;";
  const pageDelete = "delete from public.pages where id = p_page_id;";
  assert.ok(deleteBranch.includes(heroCleanup), "Remote Hero cleanup behavior is missing.");
  assert.ok(
    deleteBranch.indexOf(heroCleanup) < deleteBranch.indexOf(pageDelete),
    "Remote Page delete does not follow Hero cleanup.",
  );
  assert.equal((deleteBranch.match(/delete from public\.hero_assignments/gu) ?? []).length, 1);
  assert.doesNotMatch(deleteBranch, /delete from public\.hero_templates/iu);

  const registry = (await client.query(
    `select version,name,created_by,cardinality(statements) as statement_count,statements[1] as statement
     from supabase_migrations.schema_migrations where version=$1`,
    [migrationVersion],
  )).rows;
  assert.equal(registry.length, 1, "Migration registry row must exist exactly once.");
  assert.equal(registry[0]?.name, migrationName, "Migration registry name drifted.");
  assert.equal(Number(registry[0]?.statement_count), 1, "Migration registry payload must be atomic.");
  const registrySha256 = createHash("sha256")
    .update(String(registry[0]?.statement ?? ""))
    .digest("hex");
  assert.equal(registrySha256, migrationSha256, "Migration registry provenance drifted.");

  const deletedAtColumns = Number((await client.query(
    `select count(*)::integer as count
     from information_schema.columns
     where table_schema='public' and table_name='pages' and column_name='deleted_at'`,
  )).rows[0]?.count ?? -1);
  assert.equal(deletedAtColumns, 0, "Pages lifecycle drifted to deleted_at.");

  const orphanHeroAssignments = Number((await client.query(
    `select count(*)::integer as count
     from public.hero_assignments h
     left join public.pages p on p.id=h.target_id
     where h.target_type='page' and p.id is null`,
  )).rows[0]?.count ?? -1);
  assert.equal(orphanHeroAssignments, 0, "Orphan page-target Hero assignments remain.");

  const pagesReadModel = (await client.query(
    "select public.admin_list_pages(1,30,'id','asc','') as result",
  )).rows[0]?.result as {
    rows: Array<{ id: number; block_count: number }>;
    total_count: number;
  };
  const aggregateRows = (await client.query(`
    select page_id::bigint as page_id, count(*)::integer as module_count
    from (
      select page_id from public.page_content_block_assignments
      union all select page_id from public.page_cta_block_assignments
      union all select page_id from public.page_cards_block_assignments
      union all select page_id from public.page_breadcrumb_block_assignments
      union all select page_id from public.page_feed_module_assignments
      union all select page_id from public.page_featured_module_assignments
      union all select page_id from public.page_media_sidebar_module_assignments
      union all select page_id from public.page_media_hub_module_assignments
      union all
      select target_id as page_id from public.hero_assignments
      where target_type='page' and is_active=true
    ) assignments
    group by page_id
  `)).rows as Array<{ page_id: string; module_count: number }>;
  const aggregateByPage = new Map(
    aggregateRows.map((row) => [Number(row.page_id), Number(row.module_count)]),
  );
  assert.ok(
    pagesReadModel.rows.every(
      (row) => Number(row.block_count) === (aggregateByPage.get(Number(row.id)) ?? 0),
    ),
    "Remote Pages read-model module aggregate drifted.",
  );
  const pageFour = pagesReadModel.rows.find((row) => Number(row.id) === 4);
  assert.ok(pageFour, "Page Composition route /admin/pages-blocks/pages/4 is missing.");
  const pageFourModuleCount = Number(pageFour.block_count);
  assert.equal(pageFourModuleCount, 9, "Page 4 no longer has the verified 9 assignments.");
  const pageFourTotalPages = Math.max(1, Math.ceil(pageFourModuleCount / 10));
  const pageFourPaginationFooterVisible =
    pageFourModuleCount > 10 || pageFourTotalPages > 1;
  assert.equal(pageFourPaginationFooterVisible, false, "Shared footer must stay hidden at 9/10.");

  console.log(JSON.stringify({
    migrationFile: { version: migrationVersion, name: migrationName, sha256: migrationSha256 },
    remoteFunctionBehavior: {
      owner: "mutate_page_composition",
      operation: "delete_page",
      heroCleanupBeforeHardDelete: true,
      heroTemplatesDeleted: false,
      pagesDeletedAtColumn: false,
      orphanPageHeroAssignments: orphanHeroAssignments,
    },
    pagesOutputContract: {
      remoteRowsChecked: pagesReadModel.rows.length,
      existingAggregateMatchesEveryBlockCount: true,
      adapterOutputField: "moduleCount",
    },
    pageFourPagination: {
      assignmentCount: pageFourModuleCount,
      currentPageSize: 10,
      totalPages: pageFourTotalPages,
      footerVisible: pageFourPaginationFooterVisible,
    },
    migrationRegistryProvenance: {
      rowCount: registry.length,
      statementCount: Number(registry[0]?.statement_count),
      sha256: registrySha256,
      createdBy: registry[0]?.created_by ?? null,
    },
  }, null, 2));
} finally {
  await client.query("rollback").catch(() => undefined);
  await client.end();
}
