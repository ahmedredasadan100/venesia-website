import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Current read/revalidation owners; isolated transport and cache only. No DB/Auth/UI proof. */
export function createPageBlockPerformanceHarness(root, { delayMs = 0, fixtureRows = {} } = {}) {
  const nativeRequire = createRequire(import.meta.url);
  const files = new Set();
  const state = { reads: [], cache: [], events: [], failTable: "", failTables: [], errorMessages: {}, publicFailure: false };
  const wait = () => delayMs ? new Promise(resolve => setTimeout(resolve, delayMs)) : Promise.resolve();
  const pages = [
    { id: 1, title: "Home", path: "/", slug: "home" },
    { id: 2, title: "Detached", path: "/detached-custom", slug: "detached-custom" },
    { id: 3, title: "Assigned", path: "/assigned-custom", slug: "assigned-custom" },
  ];
  const template = { id: 501, name: "Template", slug: "sample", status: "published", variant: "default", config: { text: "Authored copy ".repeat(200) }, feed_type: "latest", widget_key: "sections", section_key: "featured" };
  const rows = {
    pages,
    topic_categories: [
      { id: 1, name: "Root", slug: "root", parent_id: null, sort_order: 0, status: "published", is_active: true, deleted_at: null },
      { id: 2, name: "Child", slug: "child", parent_id: 1, sort_order: 1, status: "published", is_active: true, deleted_at: null },
      { id: 3, name: "Hidden", slug: "hidden", parent_id: null, sort_order: 2, status: "unpublished", is_active: true, deleted_at: null },
    ],
    topic_series: [{ id: 9, name: "Child series", slug: "child-series", category_id: 2, status: "published", deleted_at: null }],
    ...fixtureRows,
  };
  function projectRow(row, fields) {
    if (fields === "*") return structuredClone(row);
    return Object.fromEntries(fields.split(/,(?![^()]*\))/).map(field => {
      const relation = /^([a-z_]+)\(([^()]+)\)$/.exec(field);
      if (!relation) return [field, structuredClone(row[field])];
      const relatedRows = rows[relation[1]] ?? [template];
      const related = relatedRows.find(candidate => candidate.id === (row.template_id ?? row.hero_id));
      return [relation[1], related ? projectRow(related, relation[2]) : null];
    }));
  }
  function from(table) {
    assert.ok(table in rows || /(?:_assignments|_templates)$/.test(table), `Unexpected transport table ${table}`);
    let selected = rows[table] ?? (table.endsWith("_templates") ? [template] : table === "page_content_block_assignments" ? [
      { id: 101, page_id: 1, template_id: 501, slot: "main", sort_order: 0, is_visible: true, updated_at: "2026-09-17" },
      { id: 103, page_id: 3, template_id: 501, slot: "main", sort_order: 0, is_visible: true, updated_at: "2026-09-17" },
    ] : []);
    let fields = "*", single = false;
    const query = {
      select(value) { fields = value; return query; }, order() { return query; },
      eq(key, value) { selected = selected.filter(row => row[key] === value); return query; },
      is(key, value) { selected = selected.filter(row => (row[key] ?? null) === value); return query; },
      in(key, values) { selected = selected.filter(row => values.includes(row[key])); return query; },
      not(key, operator, value) { assert.equal(operator, "is"); selected = selected.filter(row => (row[key] ?? null) !== value); return query; },
      maybeSingle() { single = true; return query; },
      then(resolve, reject) {
        const read = { table, fields, responseBytes: 0 };
        state.reads.push(read); state.events.push(`start:${table}`);
        return wait().then(() => {
          state.events.push(`end:${table}`);
          if (state.failTable === table || state.failTables.includes(table)) return { data: null, error: { message: state.errorMessages[table] ?? "isolated_read_failure" } };
          const result = selected.map(row => projectRow(row, fields));
          const data = single ? result[0] ?? null : result;
          read.responseBytes = Buffer.byteLength(JSON.stringify(data));
          return { data, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  }
  const record = kind => (...args) => state.cache.push({ kind, args });
  const ports = new Map([
    ["server-only", {}],
    ["next/cache", { revalidatePath: record("path"), revalidateTag: record("tag"), updateTag: record("update") }],
    ["src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from }) }],
    ["src/lib/logging", { logError() {} }],
    ["src/lib/content/public-content-read/owner", { async loadPublicContentCollection(query) {
      state.reads.push({ table: "public-content", fields: query }); state.events.push(`start:public:${query.contentTypes[0]}:${query.page}`);
      await wait(); state.events.push(`end:public:${query.contentTypes[0]}:${query.page}`);
      if (state.publicFailure) throw new Error("isolated_public_failure");
      return { totalPages: 2, items: [{ id: query.page, contentType: query.contentTypes[0], title: "Published item", categorySlug: "child", publishedAt: "2026-09-17" }] };
    } }],
  ]);
  const modules = new Map();
  function load(relativeFile) {
    const file = path.resolve(root, relativeFile);
    if (modules.has(file)) return modules.get(file).exports;
    assert.ok(file.startsWith(path.resolve(root, "src") + path.sep), "Only source owners can load");
    files.add(path.relative(root, file).replaceAll("\\", "/"));
    const mod = { exports: {} }; modules.set(file, mod);
    const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const require = specifier => {
      if (ports.has(specifier)) return ports.get(specifier);
      if (!specifier.startsWith(".")) {
        assert.ok(["react", "zod"].includes(specifier), `Undeclared package ${specifier}`);
        return nativeRequire(specifier);
      }
      const base = path.resolve(path.dirname(file), specifier);
      const relative = path.relative(root, base).replaceAll("\\", "/");
      if (ports.has(relative)) return ports.get(relative);
      const target = [base, base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(target, `Unresolved ${specifier}`);
      return load(target);
    };
    new Function("require", "module", "exports", output)(require, mod, mod.exports);
    return mod.exports;
  }
  return {
    files, state,
    registry: load("src/lib/page-blocks/block-module-registry.ts"),
    revalidation: load("src/lib/page-blocks/admin-revalidate.ts"),
    assignment: load("src/lib/page-blocks/admin-queries.ts"),
    references: load("src/lib/feed-modules/load-topic-filter-options.ts"),
    featured: load("src/lib/featured-modules/load-editor-options.ts"),
    reset() { state.reads.length = 0; state.cache.length = 0; state.events.length = 0; state.failTable = ""; state.failTables.length = 0; state.errorMessages = {}; state.publicFailure = false; },
  };
}

export function createPageCompositionProjectionFixture() {
  const kinds = ["content", "cta", "cards", "breadcrumb", "feed", "featured", "hero", "media_sidebar", "media_hub"];
  const rows = {};
  kinds.forEach((kind, kindIndex) => {
    const templateTable = kind === "hero" ? "hero_templates" : `${kind}_${["content", "cta", "cards", "breadcrumb"].includes(kind) ? "block" : "module"}_templates`;
    const assignmentTable = kind === "hero" ? "hero_assignments" : `page_${kind}_${["content", "cta", "cards", "breadcrumb"].includes(kind) ? "block" : "module"}_assignments`;
    rows[templateTable] = Array.from({ length: 9 }, (_, index) => ({
      id: index + 501, name: `${kind} ${index}`, slug: `qa-${kind}-${index}`, status: "published", variant: "default",
      feed_type: "latest", widget_key: "sections", section_key: "featured",
      config: { title: `Saved ${kind}`, text: index === 0 ? `Assigned ${kind} copy` : "Unused authored catalog content. ".repeat(512), presentation: { variant: "split" } },
    }));
    rows[assignmentTable] = [{ id: kindIndex + 1, page_id: 1, template_id: 501, hero_id: 501, target_type: "page", target_id: 1, priority: 1000, slot: "main", sort_order: kindIndex * 10, is_visible: true, is_active: true, updated_at: "2026-09-17" }];
  });
  return rows;
}

export async function verifyPageBlockReadAndRevalidationContract(root) {
  const h = createPageBlockPerformanceHarness(root);
  const canonicalCalls = calls => [...new Set(calls.map(call => JSON.stringify(call)))].sort();
  const moduleKinds = [...Object.keys(h.registry.BLOCK_MODULE_REGISTRY), "media-hub", "media-sidebar"];
  for (const moduleKind of moduleKinds) {
    // Compare the prior composed operations with the batch through the actual
    // current owner. The individual page command remains supported separately.
    h.reset();
    await Promise.all([2, 3].map(h.revalidation.revalidatePageBlocksPath));
    await h.revalidation.revalidateBlockModulePaths(moduleKind);
    const previousCoverage = canonicalCalls(h.state.cache);
    const priorReadCount = h.state.reads.length;
    h.reset();
    await h.revalidation.revalidateBlockModulePaths(moduleKind, [2, 3, 3]);
    assert.deepEqual(canonicalCalls(h.state.cache), previousCoverage, `${moduleKind}: exact path/tag/update coverage, including detached pages`);
    assert.equal(h.state.reads.length, priorReadCount - 2, "Affected pages must join the existing batch read");
    assert.equal(h.state.reads.filter(row => row.table === "pages").length, 1, "One page-path read across assignments and affected pages");
    assert.equal(h.state.cache.filter(call => call.kind === "path" && call.args[0] === "/admin/pages-blocks/pages/3").length, 1, "Duplicate affected IDs must not repeat invalidation");
    assert.ok(h.state.cache.some(call => call.kind === "path" && call.args[0] === "/detached-custom"));
    const action = readFileSync(path.join(root, `src/app/admin/pages-blocks/blocks/${moduleKind}/actions.ts`), "utf8");
    assert.ok(action.includes(`revalidateBlockModulePaths("${moduleKind}", coordinated.value.affectedPageIds)`), `${moduleKind}: adopt shared batch`);
    assert.ok(!action.includes("affectedPageIds.map(revalidatePageBlocksPath)"), `${moduleKind}: reject duplicate per-page save reload`);

    h.reset(); h.state.failTable = h.registry.ALL_ASSIGNMENT_TABLES[0];
    await Promise.all([2, 3].map(h.revalidation.revalidatePageBlocksPath));
    await assert.rejects(() => h.revalidation.revalidateBlockModulePaths(moduleKind), /isolated_read_failure/);
    const previousFailureCoverage = canonicalCalls(h.state.cache);
    h.reset(); h.state.failTable = h.registry.ALL_ASSIGNMENT_TABLES[0];
    await assert.rejects(() => h.revalidation.revalidateBlockModulePaths(moduleKind, [2, 3, 3]), /isolated_read_failure/);
    assert.deepEqual(canonicalCalls(h.state.cache), previousFailureCoverage, `${moduleKind}: unrelated read failure retains known affected literal/SEO paths`);
    assert.equal(h.state.reads.filter(row => row.table === "pages").length, 1, "Failure fallback reads affected pages in one deduplicated batch");
  }
  h.reset(); h.state.failTable = h.registry.ALL_ASSIGNMENT_TABLES[0];
  await assert.rejects(() => h.revalidation.revalidateBlockModulePaths("content", [2]), /isolated_read_failure/);
  h.reset(); h.state.failTable = "pages";
  await assert.rejects(() => h.revalidation.revalidateBlockModulePaths("content", [2]), /isolated_read_failure/);
  h.reset(); h.state.failTables.push(h.registry.ALL_ASSIGNMENT_TABLES[0], "pages");
  await assert.rejects(() => h.revalidation.revalidateBlockModulePaths("content", [2]), error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 2, "Both the broad lookup and fallback failures remain observable");
    assert.equal(error.cause, error.errors[0], "The original failure remains the primary cause");
    assert.match(error.errors[0].message, /Assignment path read failed/);
    assert.match(error.errors[1].message, /Assigned page path read failed/);
    return true;
  });
  h.reset();
  const composition = await h.assignment.getPageModuleAssignmentsForAdmin(1);
  assert.equal(composition.assignments.length, 1);
  assert.ok(composition.seoContent.includes("Authored copy"), "Saved visible SEO text still comes from full server config");
  for (const templates of Object.values(composition.templates)) {
    assert.ok(templates.length > 0, "Fixture covers every template kind");
    for (const template of templates) assert.deepEqual(Object.keys(template).sort(), ["id", "name", "slug", "status"], "Picker payload must only carry declared summary fields");
  }
  h.reset(); h.state.failTable = "breadcrumb_block_templates";
  await assert.rejects(() => h.assignment.getPageModuleAssignmentsForAdmin(1), /isolated_read_failure/);
  const projectionRows = createPageCompositionProjectionFixture();
  const projection = createPageBlockPerformanceHarness(root, { fixtureRows: projectionRows });
  const page = await projection.assignment.getPageModuleAssignmentsForAdmin(1);
  const projectionReads = structuredClone(projection.state.reads);
  assert.equal(page.assignments.length, 9, "Every assigned module kind remains present");
  assert.equal(page.assignments.find(row => row.module_kind === "featured").template_variant, "split");
  for (const kind of ["hero", "content", "cta", "cards", "breadcrumb"]) {
    assert.ok(page.seoContent.includes(`Assigned ${kind} copy`), "Assigned authored config feeds SEO");
  }
  assert.ok(!page.seoContent.includes("Unused authored"));
  assert.equal(projectionReads.length, 18, "Keep independent parallel reads without adding a second config round trip");
  assert.equal(projectionReads.filter(read => read.fields.includes("(config)")).length, 6);
  for (const read of projectionReads.filter(read => read.table.endsWith("_templates"))) {
    assert.ok(!read.fields.split(",").includes("config"), "Catalog config must not scale the editor payload");
  }
  const payloadBytes = projectionReads.reduce((sum, read) => sum + read.responseBytes, 0);
  for (const [table, rows] of Object.entries(projectionRows)) {
    if (table.endsWith("_templates")) for (const row of rows.slice(1)) row.config.text = "Unrelated large draft. ".repeat(4096);
  }
  projection.reset();
  assert.deepEqual(await projection.assignment.getPageModuleAssignmentsForAdmin(1), page, "Unassigned config changes cannot affect current page output");
  assert.equal(projection.state.reads.reduce((sum, read) => sum + read.responseBytes, 0), payloadBytes, "Unassigned config growth must not increase transport bytes");
  for (const { table } of projectionReads) {
    projection.reset(); projection.state.failTable = table; projection.state.errorMessages[table] = `failed:${table}`;
    await assert.rejects(() => projection.assignment.getPageModuleAssignmentsForAdmin(1), error => error.message === `Page Composition assignment read failed: failed:${table}`);
  }
  projection.reset(); projection.state.failTables = projectionReads.map(read => read.table);
  projection.state.errorMessages = Object.fromEntries(projectionReads.map(read => [read.table, `failed:${read.table}`]));
  await assert.rejects(() => projection.assignment.getPageModuleAssignmentsForAdmin(1), error => error.message === `Page Composition assignment read failed: failed:${projectionReads[0].table}`);
  const retiredRows = createPageCompositionProjectionFixture();
  retiredRows.content_block_templates[0].slug = "project-details-presentation";
  const retired = await createPageBlockPerformanceHarness(root, { fixtureRows: retiredRows }).assignment.getPageModuleAssignmentsForAdmin(1);
  assert.equal(retired.assignments.length, 8);
  assert.ok(!retired.seoContent.includes("Assigned content copy"));
  assert.equal(retired.templates.content.length, 8, "Retired content stays absent from the picker");
  return { moduleKinds: moduleKinds.length, sourceFiles: [...h.files] };
}

export async function verifyFeaturedReferenceReadContract(root) {
  const h = createPageBlockPerformanceHarness(root);
  const full = await h.references.loadTopicFilterOptionsForAdmin();
  assert.deepEqual(full.categories.map(row => row.slug), ["root", "child"]);
  assert.equal(full.seriesByCategorySlug.root[0].slug, "child-series", "Default Feed series inheritance stays available");
  h.reset();
  const categoriesOnly = await h.references.loadTopicFilterOptionsForAdmin({ includeSeries: false });
  assert.deepEqual(categoriesOnly.categories, full.categories, "Category projection preserves topology/order/published filter");
  assert.deepEqual(categoriesOnly.series, []);
  assert.deepEqual(categoriesOnly.seriesByCategorySlug, {});
  assert.equal(h.state.reads.length, 1);
  assert.equal(h.state.reads[0].table, "topic_categories");
  h.reset();
  const options = await h.featured.loadFeaturedEditorOptions();
  assert.deepEqual(options.categories[0].scopeSlugs, ["root", "child"]);
  assert.ok(options.items.length > 0);
  const itemTypes = [...new Set(options.items.map(item => item.contentType))];
  assert.equal(options.items.length, itemTypes.length * 2, "All canonical content types and pages remain available");
  assert.equal(h.state.reads.filter(row => row.table === "topic_series").length, 0, "Featured does not consume series");
  const firstReferenceEnd = h.state.events.indexOf("end:topic_categories");
  assert.ok(firstReferenceEnd >= 0);
  for (const type of itemTypes) assert.ok(h.state.events.indexOf(`start:public:${type}:1`) < firstReferenceEnd, "Independent public content reads must start before references finish");
  for (const file of [
    "src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx",
    "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
    "src/app/admin/pages-blocks/blocks/content/actions.ts",
    "src/app/admin/pages-blocks/blocks/featured/actions.ts",
  ]) assert.ok(readFileSync(path.join(root, file), "utf8").includes("loadTopicFilterOptionsForAdmin({ includeSeries: false })"), `${file}: category-only adoption`);
  h.reset(); h.state.publicFailure = true;
  await assert.rejects(() => h.featured.loadFeaturedEditorOptions(), /isolated_public_failure/);
  h.reset(); h.state.failTable = "topic_categories";
  const failedCategories = await h.references.loadTopicFilterOptionsForAdmin({ includeSeries: false });
  assert.deepEqual(failedCategories.categories, [], "Existing logged category failure fallback is retained");
  return { itemTypes: itemTypes.length, sourceFiles: [...h.files] };
}
