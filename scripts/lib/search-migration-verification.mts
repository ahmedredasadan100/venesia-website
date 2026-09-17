import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";
import { assertMigrationSourceProvenance, loadMigrationHistoryCompatibility } from "./migration-provenance.mjs";
import type { SecurityMigrationSource } from "./database-rls-security-contract.mts";

export const SEARCH_MIGRATION_VERSION = "20260830232134";
export const SEARCH_PREDECESSOR_VERSION = "20260828233733";
const sourceName = "search_platform_module";
const affectedTables = ["pages", "hero_templates", "breadcrumb_block_templates", "content_block_templates",
  "hero_assignments", "page_breadcrumb_block_assignments", "page_content_block_assignments", "admin_audit_logs"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Json = Record<string, unknown>;
type RegistryReceipt = { version: string; name: string; statement_count: number; statements_sha256: string };
type SearchContract = ReturnType<typeof readSearchMigrationContract>;

export class SearchMigrationVerificationError extends Error {
  readonly code: string;
  readonly queryId: string;
  constructor(queryId: string, error: unknown) {
    assert.match(queryId, /^[a-z0-9-]+$/u);
    const candidate = error !== null && typeof error === "object" && "code" in error ? error.code : null;
    const code = typeof candidate === "string" && /^[A-Z0-9]{5}$/u.test(candidate) ? candidate : "SEARCH_QUERY_FAILED";
    super(`Search migration verification ${queryId} failed (${code}).`);
    this.name = "SearchMigrationVerificationError";
    this.code = code;
    this.queryId = queryId;
  }
}

async function query(handle: OwnedLocalHandle, id: string, sql: string, parameters?: unknown[]) {
  try { return await handle.query(sql, parameters); }
  catch (error) { throw new SearchMigrationVerificationError(id, error); }
}

export function readSearchMigrationContract() {
  const compatibility = loadMigrationHistoryCompatibility(SEARCH_MIGRATION_VERSION);
  assert.equal(compatibility.name, sourceName);
  const sql = readFileSync(new URL(`../../sql/migrations/${SEARCH_MIGRATION_VERSION}_${sourceName}.sql`, import.meta.url), "utf8")
    .replace(/\r\n?/gu, "\n");
  assertMigrationSourceProvenance({ version: SEARCH_MIGRATION_VERSION, name: sourceName, sql });
  const loop = /for v_row in\s+select \* from \(values([\s\S]*?)\) as assignments\(page_slug, template_slug\)/u.exec(compatibility.historicalSql);
  assert.ok(loop, "Historical Search assignment declaration is missing.");
  const launchers = [...loop[1].matchAll(/\('([a-z-]+)', '([a-z-]+)'\)/gu)]
    .map(match => ({ page: match[1], template: match[2] }));
  assert.equal(launchers.length, 6);
  assert.equal(new Set(launchers.map(item => item.page)).size, launchers.length);
  assert.equal(launchers.filter(item => item.page === "topics").length, 1);
  return { sql, historicalSql: compatibility.historicalSql, launchers,
    templateSlugs: ["search-platform", ...launchers.map(item => item.template)],
    sourceSha256: compatibility.correctedSourceSha256, historicalSourceSha256: compatibility.historicalSourceSha256 };
}

/** Only the outer transaction wrapper is withheld for rollback-only probes.
 * Every migration statement body remains unchanged; the official CLI alone
 * executes and records the actual fresh migration outside these probes. */
function rollbackStatementBody(sql: string) {
  const start = /^begin;[ \t]*$/mu.exec(sql);
  assert.ok(start, "Reviewed migration has no outer transaction start.");
  const body = sql.slice(start.index + start[0].length).replace(/\s*commit;\s*$/u, "");
  assert.notEqual(body, sql.slice(start.index + start[0].length), "Reviewed migration has no final transaction commit.");
  assert.doesNotMatch(body, /^\s*(?:begin|commit|rollback)\s*;/gmu, "Unexpected independent transaction statement.");
  return body;
}

export async function captureSearchMigration(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const rowDigests: Record<string, Json> = {};
  for (const table of affectedTables) {
    rowDigests[table] = (await query(handle, `digest-${table.replaceAll("_", "-")}`, `select count(*)::int as count,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text,'UTF8')),'hex') as rows_sha256
      from public.${table} t`)).rows[0];
  }
  const registry = (await query(handle, "registry", `select version,name,cardinality(statements) as statement_count,
    encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex') as statements_sha256
    from supabase_migrations.schema_migrations order by version collate "C"`)).rows as RegistryReceipt[];
  const topics = (await query(handle, "topics-identity", `select id::text as id,slug,path,status,page_type,
    encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') as row_sha256
    from public.pages p where slug='topics' or path='/topics' order by id`)).rows;
  const topicsAdoptionAuditCount = (await query(handle, "topics-adoption-audit-count", `select count(*)::int as count
    from public.admin_audit_logs log where log.entity_type in ('page','page_composition') and (
      log.metadata->>'slug'='topics' or log.metadata->>'page_slug'='topics' or log.metadata->>'target_slug'='topics'
      or log.metadata->>'path'='/topics' or log.metadata->>'public_path'='/topics'
      or log.metadata#>>'{result,slug}'='topics' or log.metadata#>>'{result,path}'='/topics'
      or log.entity_id in (select id from public.pages where slug='topics' or path='/topics'))`)).rows[0].count;
  assert.ok(typeof topicsAdoptionAuditCount === "number");
  return { rowDigests, registry, topics, topicsAdoptionAuditCount };
}

async function captureProjection(handle: OwnedLocalHandle, contract: SearchContract) {
  const pageSlugs = ["search", ...contract.launchers.map(item => item.page)];
  const pages = (await query(handle, "projection-pages", `select to_jsonb(p)-'id'-'created_at'-'updated_at' as row
    from public.pages p where slug=any($1::text[]) order by slug collate "C"`, [pageSlugs])).rows.map(row => row.row);
  const templates = (await query(handle, "projection-templates", `select to_jsonb(t)-'id'-'created_at'-'updated_at' as row
    from public.content_block_templates t where slug=any($1::text[]) order by slug collate "C"`, [contract.templateSlugs])).rows.map(row => row.row as Json);
  const hero = (await query(handle, "projection-hero", `select to_jsonb(t)-'id'-'created_at'-'updated_at' as row
    from public.hero_templates t where slug='hero-search'`)).rows.map(row => row.row);
  const breadcrumb = (await query(handle, "projection-breadcrumb", `select to_jsonb(t)-'id'-'created_at'-'updated_at' as row
    from public.breadcrumb_block_templates t where slug='breadcrumb-search'`)).rows.map(row => row.row);
  const assignments = (await query(handle, "projection-assignments", `select * from (
    select 'content'::text as kind,p.slug as page_slug,p.path as page_path,t.slug as template_slug,a.slot,a.sort_order,a.is_visible
    from public.page_content_block_assignments a join public.pages p on p.id=a.page_id
    join public.content_block_templates t on t.id=a.template_id where t.slug=any($1::text[])
    union all select 'breadcrumb',p.slug,p.path,t.slug,a.slot,a.sort_order,a.is_visible
    from public.page_breadcrumb_block_assignments a join public.pages p on p.id=a.page_id
    join public.breadcrumb_block_templates t on t.id=a.template_id where t.slug='breadcrumb-search'
    union all select 'hero',p.slug,p.path,t.slug,'hero',greatest(0,1000-a.priority),a.is_active
    from public.hero_assignments a join public.pages p on p.id=a.target_id and a.target_type='page'
    join public.hero_templates t on t.id=a.hero_id where t.slug='hero-search') projection
    order by kind collate "C",page_slug collate "C",template_slug collate "C",slot,sort_order`, [contract.templateSlugs])).rows;
  const audit = (await query(handle, "projection-adoption-audit", `select log.action,log.entity_type,p.slug as page_slug,
    log.entity_label,log.metadata from public.admin_audit_logs log join public.pages p on p.id=log.entity_id
    where log.action='search_platform.adopted' order by p.slug collate "C",log.id`)).rows;
  return { pages, templates, hero, breadcrumb, assignments, audit };
}

function assertProjection(projection: Awaited<ReturnType<typeof captureProjection>>, contract: SearchContract, topicsPresent: boolean) {
  assert.deepEqual(projection.templates.map(row => row.slug), [...contract.templateSlugs].sort());
  assert.ok(projection.templates.every(row => row.variant === "search-platform" && row.status === "published"));
  assert.equal(projection.hero.length, 1);
  assert.equal(projection.breadcrumb.length, 1);
  const search = projection.pages.find(row => (row as Json).slug === "search") as Json | undefined;
  assert.ok(search?.path === "/search" && search.status === "published");
  const searchAssignments = projection.assignments.filter(row => row.page_slug === "search");
  assert.deepEqual(searchAssignments.map(row => row.kind).sort(), ["breadcrumb", "content", "hero"]);
  assert.ok(searchAssignments.every(row => row.is_visible === true));
  for (const launcher of contract.launchers) {
    const rows = projection.assignments.filter(row => row.kind === "content" && row.template_slug === launcher.template);
    if (launcher.page === "topics" && !topicsPresent) { assert.deepEqual(rows, []); continue; }
    assert.equal(rows.length, 1);
    assert.equal(rows[0].page_slug, launcher.page);
    assert.equal(rows[0].slot, "sidebar");
    // The input requests zero; the existing atomic owner subsequently assigns
    // its canonical order. Historical equivalence below compares exact output.
    assert.ok(Number.isInteger(rows[0].sort_order) && Number(rows[0].sort_order) >= 0);
    assert.equal(rows[0].is_visible, true);
  }
  assert.equal(projection.audit.length, 1);
  assert.equal(projection.audit[0].page_slug, "search");
  assert.equal(projection.assignments.filter(row => row.template_slug === "topics-search").length, topicsPresent ? 1 : 0);
}

async function insertTopicsTestIdentity(handle: OwnedLocalHandle, status: "published" | "unpublished", slug = "topics", path = "/topics") {
  await query(handle, "historical-topics-input", `insert into public.pages(title,slug,path,page_type,status)
    values('هوية موضوعات لاختبار توافق معزول',$1,$2,'static',$3)`, [slug, path, status]);
}

/** Rollback-only historical and ambiguous fixtures; none become bootstrap data. */
export async function verifySearchMigrationCompatibility(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const contract = readSearchMigrationContract();
  const baseline = await captureSearchMigration(handle);
  assert.equal(baseline.registry.at(-1)?.version, SEARCH_PREDECESSOR_VERSION);
  assert.deepEqual(baseline.topics, [], "Historical probes require the proven fresh predecessor.");
  const results: Json[] = [];
  for (const status of ["published", "unpublished"] as const) {
    let original: Awaited<ReturnType<typeof captureProjection>> | undefined;
    for (const revision of ["historical", "corrected"] as const) {
      assert.equal(readSearchMigrationContract().sourceSha256, contract.sourceSha256);
      handle.record("search-verification-case", { scenario: `existing-topics-${status}`, revision, phase: "start" });
      await query(handle, "probe-begin", "begin");
      try {
        await insertTopicsTestIdentity(handle, status);
        const topicsBefore = (await captureSearchMigration(handle)).topics;
        await query(handle, `apply-${revision}-rollback-probe`, rollbackStatementBody(revision === "historical" ? contract.historicalSql : contract.sql));
        if (revision === "corrected") {
          const input = (await query(handle, "historical-input-classification",
            "select singleton,input_state,topics_id::text as topics_id from pg_temp.search_platform_migration_input")).rows;
          assert.deepEqual(input, [{ singleton: true, input_state: "existing-topics", topics_id: topicsBefore[0].id }]);
        }
        const projection = await captureProjection(handle, contract);
        assertProjection(projection, contract, true);
        assert.deepEqual((await captureSearchMigration(handle)).topics, topicsBefore, "Search changed existing Topics identity/status/fields.");
        if (revision === "historical") original = projection;
        else assert.deepEqual(projection, original, "Corrected Search differs from the original on valid existing Topics input.");
      } finally { await handle.query("rollback").catch(() => undefined); }
      assert.deepEqual(await captureSearchMigration(handle), baseline, "Historical probe changed persistent rows or migration history.");
      results.push({ scenario: `existing-topics-${status}`, revision, transactionRolledBack: true,
        registryUnchanged: true, topicsPreserved: true, sequenceRollbackClaimed: false });
      handle.record("search-verification-case", { scenario: `existing-topics-${status}`, revision, phase: "complete" });
    }
  }
  const cases: Array<{ name: string; expectedCode: string; expectedAssertion: string | null; prepare(): Promise<unknown> }> = [
    { name: "topics-slug-wrong-path", expectedCode: "P0001", expectedAssertion: "search_platform_topics_identity_conflict", prepare: () => insertTopicsTestIdentity(handle, "published", "topics", "/qa-search-wrong-path") },
    { name: "topics-path-wrong-slug", expectedCode: "P0001", expectedAssertion: "search_platform_topics_identity_conflict", prepare: () => insertTopicsTestIdentity(handle, "published", "qa-search-wrong-slug", "/topics") },
    { name: "topics-split-identity", expectedCode: "P0001", expectedAssertion: "search_platform_topics_identity_ambiguous", prepare: async () => {
      await insertTopicsTestIdentity(handle, "published", "topics", "/qa-search-wrong-path");
      await insertTopicsTestIdentity(handle, "published", "qa-search-wrong-slug", "/topics");
    } },
    { name: "required-media-page-missing", expectedCode: "P0002", expectedAssertion: null, prepare: async () => {
      await insertTopicsTestIdentity(handle, "published");
      const media = contract.launchers.find(item => item.page !== "topics"); assert.ok(media);
      const changed = await query(handle, "negative-media-identity", "update public.pages set slug='qa-search-required-media-missing' where slug=$1", [media.page]);
      assert.equal(changed.rowCount, 1);
    } },
    { name: "topics-template-residue-without-page", expectedCode: "P0001", expectedAssertion: "search_platform_residual_capability_artifacts", prepare: () => query(handle,
      "negative-topics-template", `insert into public.content_block_templates(name,slug,variant,status,config)
        values('QA Search residue','topics-search','search-platform','unpublished','{}'::jsonb)`) },
    { name: "partial-central-search-template", expectedCode: "P0001", expectedAssertion: "search_platform_residual_capability_artifacts", prepare: () => query(handle,
      "negative-central-search-template", `insert into public.content_block_templates(name,slug,variant,status,config)
        values('QA partial Search','search-platform','search-platform','unpublished','{"qa_partial_config":true}'::jsonb)`) },
    { name: "orphan-page-audit-residue", expectedCode: "P0001", expectedAssertion: "search_platform_topics_residual_adoption", prepare: () => query(handle,
      "negative-orphan-audit", `insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
        select null,'system:test','qa.search_orphan_page_probe','page',coalesce(max(id),0)+1,
          'Rollback-only QA evidence','{"qa_scenario":"search-ambiguous-input"}'::jsonb from public.pages`) },
  ];
  for (const test of cases) {
    if (test.expectedAssertion !== null) assert.ok(contract.sql.includes(`message='${test.expectedAssertion}'`),
      "Expected assertion is not a literal declared by the current Search migration.");
    handle.record("search-verification-case", { scenario: test.name, revision: "corrected", phase: "start" });
    await query(handle, "negative-begin", "begin");
    let code: string | null = null;
    try {
      await test.prepare();
      try { await query(handle, "negative-corrected-search", rollbackStatementBody(contract.sql)); }
      catch (error) { if (error instanceof SearchMigrationVerificationError) code = error.code; else throw error; }
    } finally { await handle.query("rollback").catch(() => undefined); }
    assert.equal(code, test.expectedCode, `Search fail-closed condition did not hold: ${test.name}`);
    assert.deepEqual(await captureSearchMigration(handle), baseline, "Negative Search probe changed persistent rows or history.");
    // The existing isolated connection deliberately retains SQLSTATE only.
    // Expected source labels are never reported as observed exception messages.
    results.push({ scenario: test.name, code, queryId: "negative-corrected-search", expectedSourceAssertion: test.expectedAssertion,
      observedAssertion: null, exactAssertionObserved: false, diagnosticBoundary: "owned-handle-sqlstate-only",
      transactionRolledBack: true, registryUnchanged: true, sequenceRollbackClaimed: false });
    handle.record("search-verification-case", { scenario: test.name, revision: "corrected", phase: "complete" });
  }
  return { originalSourceSha256: contract.historicalSourceSha256, correctedSourceSha256: contract.sourceSha256,
    cases: results, syntheticTopicsRetained: false, registryWritten: false, productionRead: false, productionWrite: false };
}

export async function verifyFreshSearchMigration(handle: OwnedLocalHandle,
  before: Awaited<ReturnType<typeof captureSearchMigration>>,
  execution: { throughVersion: string; applied: string[]; registered: number; corpusSha256: string },
  migrations: SecurityMigrationSource[]) {
  assertOwnedLocalHandle(handle);
  const contract = readSearchMigrationContract();
  const after = await captureSearchMigration(handle);
  assert.deepEqual(before.topics, []);
  assert.deepEqual(after.topics, [], "Fresh Search must not manufacture a Topics page identity.");
  assert.equal(before.topicsAdoptionAuditCount, 0);
  assert.equal(after.topicsAdoptionAuditCount, 0, "Fresh Search fabricated Topics adoption audit evidence.");
  assert.equal(execution.throughVersion, SEARCH_MIGRATION_VERSION);
  assert.deepEqual(execution.applied, [`${SEARCH_MIGRATION_VERSION}_${sourceName}.sql`]);
  assert.equal(after.registry.length, before.registry.length + 1);
  assert.equal(after.registry.length, execution.registered);
  assert.deepEqual(after.registry.slice(0, -1), before.registry);
  assert.equal(after.registry.at(-1)?.version, SEARCH_MIGRATION_VERSION);
  assert.equal(after.registry.at(-1)?.name, sourceName);
  const prefix = migrations.filter(item => item.version <= SEARCH_MIGRATION_VERSION);
  assert.equal(prefix.at(-1)?.version, SEARCH_MIGRATION_VERSION);
  assert.equal(prefix.at(-1)?.sql, contract.sql, "Executed Search source differs from the verified current revision.");
  assert.deepEqual(after.registry.map(row => row.version), prefix.map(item => item.version));
  assert.equal(execution.corpusSha256, hash(prefix.map(item => `${item.version}:${hash(item.sql)}`).join("\n")));
  const projection = await captureProjection(handle, contract);
  assertProjection(projection, contract, false);
  return { correctedSourceSha256: contract.sourceSha256, templates: projection.templates.length,
    searchComposition: 3, mediaLaunchers: contract.launchers.filter(item => item.page !== "topics").length,
    topicsPageCreated: false, topicsLauncherAdopted: false, topicsAdoptionAuditCreated: false, priorRegistryUnchanged: true,
    officialCliExecutionProvenanceVerified: true, canonicalWholeFileRegistryVerified: false,
    projection, after };
}

/** Current source proof only; no claim of a measured public HTTP response. */
export function readTopicsAbsentRouteSourceProof() {
  const files = ["src/app/(site)/topics/page.tsx", "src/lib/page-blocks/load-page-composition.ts",
    "src/lib/admin/links/static-routes.ts"];
  const sources = files.map(file => ({ file, source: readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n") }));
  const page = sources[0].source;
  assert.match(page, /getPublicPageRoute\("topics"\)/u);
  assert.match(page, /loadPageCompositionBySlug\(PAGE_IDENTITY\.cmsPageSlug\)/u);
  assert.match(page, /composition\.hasAnyAssignmentRows\s*\|\|\s*composition\.hasCompositionError/u);
  assert.match(page, /TopicsListingContent block=\{null\}/u);
  assert.doesNotMatch(page, /\bnotFound\(/u);
  return { sourceOnly: true, publicHttpVerified: false, absentCmsIdentityDoesNotCreateTopicsAdoption: true,
    files: sources.map(({ file, source }) => ({ file, sha256: hash(source) })) };
}
