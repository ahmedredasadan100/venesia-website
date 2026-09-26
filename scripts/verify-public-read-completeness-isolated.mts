import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { runIsolatedSupabase, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { runApplicationHandoff } from "./lib/isolated-public-application.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import { verifyPublicReadCompleteness, verifyProjectMappingAndGrouping, verifyPublicProjectCollectionCompleteness } from "./verify-public-read-completeness.mts";
import type { TopicSeoSource, ProjectSeoSource, PageSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";
import type { Database } from "../src/lib/database.types.ts";
import type { PublicProjectRootRow, PublicProjectLocationRow } from "../src/lib/projects/map-public-project.ts";

const ROOT = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const mapper = nativeRequire(resolve(ROOT, "src/lib/projects/map-public-project.ts")) as typeof import("../src/lib/projects/map-public-project.ts");
const { isReservedPublicPath } = nativeRequire(resolve(ROOT, "src/lib/pages/reserved-public-paths.ts")) as typeof import("../src/lib/pages/reserved-public-paths.ts");
const ProjectsMapSection = (nativeRequire(resolve(ROOT, "src/components/projects/ProjectsMapSection.tsx")) as typeof import("../src/components/projects/ProjectsMapSection.tsx")).default;
const { createElement } = nativeRequire("react") as typeof import("react");
const { renderToStaticMarkup } = nativeRequire("react-dom/server") as typeof import("react-dom/server");
const size = 2507;
export async function verifyOwnedPublicReadCompleteness(handle: OwnedLocalHandle, artifactDir: string, options: { publicFixturePrepared?: boolean } = {}) {
  const report: Record<string, unknown> = { sizePerSource: size, productionAccess: false, cacheBoundary: "pass-through; persistent cache behavior is outside this enumeration proof" };
  await assert.rejects(handle.readDataApi("https://example.com/rest/v1/topics"), { code: "INVALID_DATA_API_PATH" });
  await assert.rejects(handle.readDataApi("/rest/v1/topics/../rpc/foo"), { code: "INVALID_DATA_API_PATH" });
  await assert.rejects(handle.readDataApi("/rest/v1/topics", { Authorization: "example" }), { code: "INVALID_DATA_API_HEADER" });
  report.opaqueTransportGuards = "external origin, RPC traversal, and credential header rejected";
  const registry = (await handle.query("select count(*)::int count,max(version) head from supabase_migrations.schema_migrations")).rows[0];
  assert.ok(Number(registry.count) >= 112);
  const critical = (await handle.query("select public.admin_mutate_topics_batch_atomically(-1,'feature',array[1]::bigint[],null,null) result")).rows[0].result;
  assert.deepEqual(critical, { ok: false, code: "unauthorized_actor" });
  report.application = { registry, critical112ActorRejection: critical };
  if (!options.publicFixturePrepared) await handle.preparePublicVerification();
  // The clean application corpus deliberately has no published Project. Use
  // the existing complete fixture owner and the real publication command.
  const fixtures = await handle.prepareAdminInteractions();
  const fixtureProject = fixtures.project as { id: number };
  assert.ok(Number.isSafeInteger(fixtureProject.id));
  const actor = (await handle.query("select id from public.admin_users where is_active order by id limit 1")).rows[0];
  assert.ok(actor);
  const readiness = (await handle.query("select * from public.project_publishing_readiness($1)", [fixtureProject.id])).rows[0];
  assert.equal(readiness.ready, true, "Existing complete Project fixture must pass canonical publication readiness.");
  await handle.query("select * from public.set_project_publication_admin_entry($1,true,$2)", [fixtureProject.id, actor.id]);
  const publishedFixture = (await handle.query("select publication_status,published_at from public.projects where id=$1", [fixtureProject.id])).rows[0];
  assert.equal(publishedFixture.publication_status, "published");
  assert.ok(publishedFixture.published_at);
  report.projectFixture = { id: fixtureProject.id, readiness, published: true, owner: "prepareAdminInteractions + set_project_publication_admin_entry" };
  const seo = loadEntitySeoPersistenceOwner();
  const templateRows: Record<string, Record<string, unknown>> = {};
  const syntheticCleanupTargets: Record<"topics" | "projects" | "pages" | "project_locations", number[]> = { topics: [], projects: [], pages: [], project_locations: [] };
  for (const table of ["topics", "projects", "pages"] as const) {
    const state = table === "projects" ? "publication_status='published'" : "status='published'";
    const template = (await handle.query(`select to_jsonb(t) row from public.${table} t where ${state} order by id limit 1`)).rows[0]?.row as Record<string, unknown> | undefined;
    assert.ok(template, `${table} must have an existing canonical valid fixture`);
    templateRows[table] = template;
    const locationIds = table === "projects" ? (await handle.query("insert into public.project_locations(level,parent_id,name_ar) select 'sub_area',$1,'Audit distinct location ' || value from generate_series(1,$2::int) value returning id", [template.main_area_id, size])).rows.map(row => Number(row.id)).sort((a, b) => a - b) : [];
    if (table === "projects") assert.equal(new Set(locationIds).size, size);
    syntheticCleanupTargets.project_locations.push(...locationIds);
    const maxId = Number((await handle.query(`select coalesce(max(id),0) id from public.${table}`)).rows[0].id);
    const columns = (await handle.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' order by ordinal_position", [table])).rows.map(row => String(row.column_name));
    assert.ok(columns.every(column => /^[a-z_][a-z0-9_]*$/u.test(column)));
    const names = columns.map(column => `"${column}"`).join(",");
    for (let offset = 0; offset < size; offset += 100) {
      const rows = Array.from({ length: Math.min(100, size - offset) }, (_, index) => {
        const id = maxId + 1000 + offset + index;
        const row = { ...template, id, slug: `audit2-${table}-${id}`, canonical_url: null, robots_index: true,
          created_at: "2026-09-26T00:00:00+00:00", updated_at: "2026-09-26T00:00:00+00:00" };
        if (table === "topics") Object.assign(row, { title: `موضوع الاختبار ${id}`, status: "published", deleted_at: null, content_type: index % 2 ? "article" : "site_update" });
        if (table === "projects") Object.assign(row, { arabic_name: `مشروع الاختبار ${id}`, english_name: `Audit project ${id}`, code: `AUDIT${id}`, sub_area_id: locationIds[offset + index], publication_status: "published", homepage_order: id, show_on_homepage: false, featured: false });
        if (table === "pages") Object.assign(row, { title: `صفحة الاختبار ${id}`, path: `/audit2-cms-${id}`, status: "published", is_system: false, page_type: "static" });
        const input = table === "topics" ? seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)
          : table === "projects" ? seo.toProjectSeoScoreInput(row as unknown as ProjectSeoSource)
            : seo.toPageSeoScoreInput(row as unknown as PageSeoSource);
        return { ...row, ...seo.deriveEntitySeoScore(input) };
      });
      await handle.query(`insert into public.${table} (${names}) select ${names} from jsonb_populate_recordset(null::public.${table},$1::jsonb)`, [JSON.stringify(rows)]);
      syntheticCleanupTargets[table].push(...rows.map(row => row.id));
    }
    console.log(`SEEDED ${table} ${size}`);
    await handle.renewDatabaseControlConnection();
  }
  // Source seeding just renewed the healthy control lease. Long read-only HTTP
  // phases still need that owner alive: renew between requests, well before its
  // unchanged 60s idle bound. Concurrent SDK reads share one maintenance promise.
  let lastControlRenewal = Date.now();
  let pendingControlRenewal: Promise<void> | undefined;
  let controlRenewals = 0;
  const maintainControl = async (force = false): Promise<void> => {
    if (pendingControlRenewal) return pendingControlRenewal;
    if (!force && Date.now() - lastControlRenewal < 20_000) return;
    pendingControlRenewal = (async () => {
      await handle.renewDatabaseControlConnection();
      lastControlRenewal = Date.now();
      controlRenewals += 1;
    })();
    try { await pendingControlRenewal; } finally { pendingControlRenewal = undefined; }
  };
  const requests: Record<string, number> = {};
  const client = createClient<Database>("http://127.0.0.1:1", "owned-test-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
      await maintainControl();
      const url = new URL(String(input));
      assert.equal(url.hostname, "127.0.0.1");
      const table = url.pathname.split("/").at(-1)!;
      requests[table] = (requests[table] ?? 0) + 1;
      assert.ok(!init?.method || init.method === "GET");
      const headers = new Headers();
      const incoming = new Headers(init?.headers);
      for (const name of ["accept", "prefer", "range", "range-unit"]) {
        const value = incoming.get(name);
        if (value !== null) headers.set(name, value);
      }
      return handle.readDataApi(url.pathname + url.search, headers);
    } },
  });
  const controls: Record<string, number> = {};
  for (const table of ["topics", "projects", "pages"] as const) {
    const result = await client.from(table).select("id");
    assert.equal(result.error, null);
    assert.equal(result.data?.length, 1000, "The original real PostgREST cap must remain unchanged");
    controls[table] = result.data.length;
  }
  const topicRows = (await handle.query("select id,robots_index from public.topics where status='published' and deleted_at is null and slug not like 'e2e-test%' and content_type in ('article','news','press','site_update','video','gallery') order by id")).rows;
  const projectRows = (await handle.query("select slug,robots_index from public.projects where publication_status='published' order by updated_at desc,id desc")).rows;
  const pageRows = (await handle.query("select id,path from public.pages where status='published' and path is not null and robots_index is distinct from false order by id")).rows;
  report.enumeration = await verifyPublicReadCompleteness(client, {
    topicIds: topicRows.map(row => Number(row.id)), sitemapTopicIds: topicRows.filter(row => row.robots_index !== false).map(row => Number(row.id)),
    projectSlugs: projectRows.map(row => String(row.slug)), sitemapProjectSlugs: projectRows.filter(row => row.robots_index !== false).map(row => String(row.slug)),
    pageIds: pageRows.filter(row => String(row.path).startsWith("/") && !isReservedPublicPath(String(row.path).trim())).map(row => Number(row.id)),
  });
  const completeProjects = (await handle.query("select id,governorate_id,city_id,main_area_id,sub_area_id from public.projects where publication_status='published' order by updated_at desc,id desc")).rows;
  assert.ok(new Set(completeProjects.map(row => row.sub_area_id).filter(Boolean)).size > 2_000);
  await maintainControl(true);
  report.projectCollection = await verifyPublicProjectCollectionCompleteness(client, completeProjects.map(row => ({
    id: Number(row.id), locationIds: [row.governorate_id, row.city_id, row.main_area_id, row.sub_area_id].map(value => value == null ? null : Number(value)),
  })));
  for (const count of Object.values(requests)) assert.ok(count > 3);
  report.singleResponseControls = controls;
  report.transportRequests = requests;
  report.mapping = verifyProjectMappingAndGrouping();
  const specialNames = ["__proto__", "constructor", "toString", "حي عربي"];
  const accepted: PublicProjectLocationRow[] = [];
  for (const name of specialNames) {
    const row = (await handle.query("insert into public.project_locations(level,parent_id,name_ar) values('sub_area',$1,$2) returning id,level,parent_id,name_ar,name_en", [templateRows.projects.main_area_id, name])).rows[0];
    accepted.push({ ...row, id: Number(row.id), parent_id: Number(row.parent_id) } as PublicProjectLocationRow);
    syntheticCleanupTargets.project_locations.push(Number(row.id));
  }
  const selected = [accepted[0], accepted[1], accepted[2], accepted[3], accepted[0], accepted[3]];
  const realRows = selected.map((location, index) => ({ ...templateRows.projects, id: index + 1, sub_area_id: location.id }) as PublicProjectRootRow);
  const projected = mapper.mapProjectRowsToPublicProjects(realRows, accepted);
  const rendered = renderToStaticMarkup(createElement(ProjectsMapSection, { projects: projected, mapPins: [] }));
  const groups = [...rendered.matchAll(/<span class="text-white\/70">([^<]*)<\/span><span class="text-\[#D8B87A\]">(\d+) مشروع<\/span>/gu)].map(match => [match[1], Number(match[2])]);
  assert.deepEqual(groups, [["__proto__", 2], ["constructor", 1], ["toString", 1], ["حي عربي", 2]]);
  report.acceptedDatabaseNamesRendered = groups;
  report.syntheticCleanupTargets = syntheticCleanupTargets;
  report.plannedHealthyControlRenewals = controlRenewals;
  writeFileSync(resolve(artifactDir, "public-read-completeness.json"), JSON.stringify(report, null, 2));
  console.log("PASS real PostgREST full-schema enumeration, complete generator, and SQL-accepted Location names");
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifactDir = resolve(ROOT, process.argv[2] ?? `.tmp-qa/public-read-completeness-${Date.now()}`);
  const port = Number(process.argv[3] ?? 57601);
  assert.ok(artifactDir.startsWith(resolve(ROOT, ".tmp-qa") + "/") || artifactDir.startsWith(resolve(ROOT, ".tmp-qa") + "\\"));
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65532);
  await runIsolatedSupabase({
    lockPath: resolve(ROOT, "scripts/fixtures/isolated-supabase/stack.lock.json"), artifactDir,
    cliBinary: resolve(ROOT, "node_modules/@supabase/cli-windows-x64/bin/supabase.exe"),
    pgPort: port, restPort: port + 1, storagePort: port + 2, apiPort: port + 3,
    handoff: async handle => {
      await runApplicationHandoff(handle);
      const report = await verifyOwnedPublicReadCompleteness(handle, artifactDir);
      console.log(JSON.stringify({ status: "complete", artifactDir, ...report }, null, 2));
    },
  });
}
