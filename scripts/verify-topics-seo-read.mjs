import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Executes the real read owner and Entity List adapter against an in-memory
// query backend. This proves emitted requests and bounded read behavior; it
// does not claim a live PostgreSQL plan, network timing or browser result.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const moduleLoader = require("node:module");
const originalLoad = moduleLoader._load;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Network forbidden in Topics read proof"); };
let currentClient;
moduleLoader._load = (specifier, parent, isMain) => {
  if (specifier === "server-only") return {};
  if (specifier.endsWith("supabase-admin")) return { getSupabaseAdmin: () => currentClient };
  return originalLoad(specifier, parent, isMain);
};
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
const actual = (file) => require(path.join(root, file));
const scoreOwner = actual("src/lib/admin/seo-score.ts");
const version = scoreOwner.ENTITY_SEO_SCORE_VERSION;
const originalAnalyze = scoreOwner.analyzeEntitySeo;
let analysisCalls = 0;
scoreOwner.analyzeEntitySeo = () => { analysisCalls += 1; throw new Error("Read-time SEO analysis is forbidden"); };
const loader = actual("src/lib/admin/content/load-unified-content.ts");
const { loadTopicsEntityListResult, topicsEntityListAdapter } = actual("src/lib/admin/content/entity-list-adapters/topics.ts");
const { normalizeAdminEntityListQuery } = actual("src/lib/admin/entity-list/data-engine/contracts.ts");
const { topicsQueryContract } = actual("src/lib/admin/content/entity-list-contracts/topics.ts");
const categories = [
  { id: 1, name: "Root", slug: "root", parent_id: null, sort_order: 0, is_active: true },
  { id: 2, name: "Child", slug: "child", parent_id: 1, sort_order: 1, is_active: true },
  { id: 3, name: "Grandchild", slug: "grandchild", parent_id: 2, sort_order: 2, is_active: true },
  { id: 4, name: "Other", slug: "other", parent_id: null, sort_order: 3, is_active: true },
];
const rows = Array.from({ length: 28 }, (_, index) => {
  const id = index + 1;
  return {
    id, title: `${id % 2 ? "Alpha" : "Beta"} Guide ${id}`, content_type: id % 2 ? "article" : "news",
    category_id: id % 4 + 1, category_name: "Category", category_color_token: null,
    series_id: id % 3 ? null : 9, series_name: id % 3 ? null : "Series",
    status: id % 2 ? "published" : "unpublished", is_featured: id % 5 === 0,
    seo_score: id % 4 * 20, seo_score_version: version,
    seo_score_input_hash: "a".repeat(64), views_count: id,
    created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", published_at: null,
    created_by_display: "Editor", updated_by_display: null, published_by_display: null,
    deleted_at: id > 25 ? "2026-09-02T00:00:00.000Z" : null,
    image: id % 5 === 0 ? "" : "/images/topic.jpg",
    content: "<p>Forbidden full body transfer</p>".repeat(1000),
    excerpt: "Forbidden description transfer", faq: [{ question: "Question", answer: "Answer" }],
    seo_title: "SEO title", seo_description: "SEO description", focus_keyword: "Keyword",
  };
}).reverse();
const metrics = { total: 25, trashed: 3, published: 13, unpublished: 12, withoutImage: 5,
  withSeries: 8, featured: 5, seoAverage: 30, staleScores: 0 };
const baseFilters = { q: "", view: "active", contentType: "all", categoryId: null, seriesId: null,
  status: "all", featured: "all", image: "all", sort: "seo_asc", page: 1, pageSize: 10 };
const heavyFields = ["content", "excerpt", "faq", "seo_title", "seo_description", "seo_keywords", "focus_keyword", "media_payload", "og_image"];

function backend(options = {}) {
  const trace = [];
  const dataRows = structuredClone(options.rows ?? rows);
  const client = {
    from(table) {
      assert.ok(["admin_content_topics", "topic_categories"].includes(table), `Unexpected table scan: ${table}`);
      const request = { table, columns: "", options: {}, filters: [], orders: [], range: null, operations: [] };
      const query = {
        select(columns, selectOptions = {}) { request.columns = columns; request.options = selectOptions; request.operations.push("select"); return query; },
        is(column, value) { request.filters.push(["is", column, value]); return query; },
        not(column, operator, value) { request.filters.push(["not", column, value, operator]); return query; },
        eq(column, value) { request.filters.push(["eq", column, value]); return query; },
        in(column, values) { request.filters.push(["in", column, values]); return query; },
        ilike(column, value) { request.filters.push(["ilike", column, value]); return query; },
        or(value) { request.filters.push(["or", value]); return query; },
        order(column, orderOptions) { request.orders.push([column, orderOptions]); request.operations.push("order"); return query; },
        range(from, to) { request.range = [from, to]; request.operations.push("range"); return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            trace.push(request);
            if (table === "topic_categories") return options.categoryError
              ? { data: null, error: { message: "Category read failed" } } : { data: categories, error: null };
            const countRead = request.options.head === true;
            if (countRead && options.countError) return { count: null, data: null, error: { message: "Count failed" } };
            if (!countRead && options.pageError) return { data: null, error: { message: "Page failed" } };
            let selected = dataRows.filter((row) => request.filters.every(([operator, key, value]) => {
              if (operator === "is") return row[key] === value;
              if (operator === "not") return row[key] !== value;
              if (operator === "eq") return row[key] === value;
              if (operator === "in") return value.includes(row[key]);
              if (operator === "ilike") return String(row[key]).toLowerCase().includes(value.replaceAll("%", "").toLowerCase());
              assert.equal(key, "image.is.null,image.eq.");
              return row.image === null || row.image === "";
            }));
            if (countRead) return { data: null, count: selected.length, error: null };
            selected.sort((left, right) => {
              for (const [column, orderOptions] of request.orders) {
                const a = left[column]; const b = right[column];
                if (a === b) continue;
                if (a === null) return orderOptions.nullsFirst ? -1 : 1;
                if (b === null) return orderOptions.nullsFirst ? 1 : -1;
                return (a < b ? -1 : 1) * (orderOptions.ascending ? 1 : -1);
              }
              return 0;
            });
            if (request.range) selected = selected.slice(request.range[0], request.range[1] + 1);
            const projected = selected.map((row) => Object.fromEntries(request.columns.split(",").map((key) => [key, row[key]])));
            request.responseBytes = Buffer.byteLength(JSON.stringify(projected));
            request.responseRows = projected.length;
            return { data: projected, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      trace.push({ rpc: name, args });
      assert.equal(name, "admin_content_topic_metrics");
      assert.deepEqual(args, { p_seo_score_version: version });
      return options.metricsError ? { data: null, error: { message: "Metrics failed" } }
        : { data: options.metrics ?? metrics, error: null };
    },
  };
  currentClient = client;
  return { trace, dataRows };
}
function listQuery(values = {}) {
  return normalizeAdminEntityListQuery(topicsQueryContract, new URLSearchParams({ sort: "seo_asc", ...values }));
}
let passed = 0;
async function check(label, run) {
  await run();
  assert.equal(analysisCalls, 0);
  passed += 1;
  console.log(`PASS ${label}`);
}
try {
  await check("SEO ascending and descending order is requested from the backend before a bounded page with stable ties", async () => {
    for (const [sort, expected] of [
      ["seo_asc", [4, 8, 12, 16, 20, 24, 1, 5, 9, 13]],
      ["seo_desc", [3, 7, 11, 15, 19, 23, 2, 6, 10, 14]],
    ]) {
      const h = backend();
      const result = await loader.loadUnifiedContentList({ ...baseFilters, sort }, categories);
      assert.equal(result.error, null);
      assert.deepEqual(result.rows.map((row) => row.id), expected);
      assert.equal(result.totalCount, 25);
      assert.equal(h.trace.length, 2);
      assert.deepEqual(h.trace[0].options, { count: "exact", head: true });
      assert.equal(h.trace[0].columns, "id");
      assert.deepEqual(h.trace[1].orders, [["seo_score", { ascending: sort === "seo_asc", nullsFirst: false }], ["id", { ascending: true }]]);
      assert.deepEqual(h.trace[1].range, [0, 9]);
      assert.deepEqual(h.trace[1].operations.slice(-3), ["order", "order", "range"]);
      assert.equal(h.trace[1].responseRows, 10);
      assert.ok(h.trace[1].responseBytes < 12_000);
      for (const field of heavyFields) assert.ok(!h.trace[1].columns.split(",").includes(field), `Heavy column ${field}`);
      for (const row of result.rows) assert.ok(!Object.hasOwn(row, "seo_score_version"));
    }
  });
  await check("Adjacent SEO pages keep stable ties without duplicates or client sorting of the full dataset", async () => {
    backend();
    const first = await loader.loadUnifiedContentList(baseFilters, categories);
    const h = backend();
    const second = await loader.loadUnifiedContentList({ ...baseFilters, page: 2 }, categories);
    assert.deepEqual(second.rows.map((row) => row.id), [17, 21, 25, 2, 6, 10, 14, 18, 22, 3]);
    assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 20);
    assert.deepEqual(h.trace[1].range, [10, 19]);
    assert.equal(h.trace.length, 2);
  });
  await check("Out-of-range page is clamped using filtered count before fetching rows", async () => {
    const h = backend();
    const result = await loader.loadUnifiedContentList({ ...baseFilters, page: 999 }, categories);
    assert.equal(result.page, 3);
    assert.equal(result.totalPages, 3);
    assert.deepEqual(result.rows.map((row) => row.id), [7, 11, 15, 19, 23]);
    assert.deepEqual(h.trace[1].range, [20, 29]);
    assert.equal(h.trace[1].responseRows, 5);
  });
  await check("Count and page share title AND search and descendant-category filters", async () => {
    const h = backend();
    const result = await loader.loadUnifiedContentList({ ...baseFilters, q: "Alpha Guide", categoryId: 1 }, categories);
    assert.deepEqual(result.rows.map((row) => row.id), [1, 5, 9, 13, 17, 21, 25]);
    assert.equal(result.totalCount, 7);
    assert.deepEqual(h.trace[0].filters, h.trace[1].filters);
    assert.ok(h.trace[1].filters.some(([operator, key, value]) => operator === "in" && key === "category_id" && value.length === 3));
  });
  await check("Empty and trash views preserve pagination and visibility", async () => {
    backend({ rows: [] });
    const empty = await loader.loadUnifiedContentList({ ...baseFilters, page: 10 }, categories);
    assert.deepEqual([empty.rows.length, empty.totalCount, empty.page, empty.totalPages], [0, 0, 1, 1]);
    backend();
    const trash = await loader.loadUnifiedContentList({ ...baseFilters, view: "trash", sort: "id_asc" }, categories);
    assert.deepEqual(trash.rows.map((row) => row.id), [26, 27, 28]);
  });
  await check("Metrics execute one aggregate RPC without content-row transfer", async () => {
    const h = backend();
    const result = await loader.loadUnifiedContentMetrics();
    assert.equal(h.trace.length, 1);
    assert.ok(h.trace[0].rpc);
    const expected = { ...metrics, error: null };
    assert.deepEqual(result, expected);
  });
  await check("Count and page failures return no fabricated successful rows", async () => {
    for (const [failure, expectedRequests] of [["countError", 1], ["pageError", 2]]) {
      const h = backend({ [failure]: true });
      const result = await loader.loadUnifiedContentList(baseFilters, categories);
      assert.ok(result.error);
      assert.deepEqual(result.rows, []);
      assert.equal(h.trace.length, expectedRequests);
    }
  });
  await check("A partial, obsolete or invalid persisted score rejects the page without analysis fallback", async () => {
    for (const changes of [{ seo_score: null }, { seo_score_version: version + 1 }, { seo_score: -1 }, { seo_score: 101 }, { seo_score: 1.5 }]) {
      const badRows = structuredClone(rows);
      Object.assign(badRows.find((row) => row.id === 4), changes);
      backend({ rows: badRows });
      const result = await loader.loadUnifiedContentList({ ...baseFilters, sort: "id_asc" }, categories);
      assert.match(result.error, /درجات SEO.*غير مكتملة أو غير محدثة/);
      assert.deepEqual(result.rows, []);
    }
  });
  await check("EXPAND unresolved rows stay visible and sort last without fabricated scores or analysis", async () => {
    const transitionalRows = structuredClone(rows);
    Object.assign(transitionalRows.find((row) => row.id === 4), {
      seo_score: null, seo_score_version: null, seo_score_input_hash: null,
    });
    const h = backend({ rows: transitionalRows, metrics: { ...metrics, seoAverage: null, staleScores: 1 } });
    const result = await loadTopicsEntityListResult(listQuery({ sort: "id_asc" }), categories);
    assert.equal(result.rows.find((row) => row.id === 4).seo_score, null);
    assert.equal(result.metrics.total, metrics.total);
    assert.equal(result.metrics.seoAverage, null);
    assert.equal(result.metrics.staleScores, 1);
    assert.equal(result.metrics.error, null);
    assert.equal(topicsEntityListAdapter.resultSchema.safeParse(result).success, true);
    assert.equal(h.trace.length, 3);
    for (const sort of ["seo_asc", "seo_desc"]) {
      backend({ rows: transitionalRows });
      const lastPage = await loader.loadUnifiedContentList({ ...baseFilters, sort, page: 3 }, categories);
      assert.equal(lastPage.error, null);
      assert.equal(lastPage.rows.at(-1).id, 4);
      assert.equal(lastPage.rows.at(-1).seo_score, null);
    }
  });
  await check("Metrics preserve non-SEO counts while the score average is unresolved", async () => {
    backend({ metrics: { ...metrics, seoAverage: null, staleScores: 25 } });
    const result = await loader.loadUnifiedContentMetrics();
    assert.deepEqual(result, { ...metrics, seoAverage: null, staleScores: 25, error: null });
  });
  await check("Metrics reject malformed aggregates and RPC errors", async () => {
    for (const options of [{ metrics: { ...metrics, staleScores: -1 } }, { metrics: { ...metrics, seoAverage: 101 } }, { metrics: {} }, { metricsError: true }]) {
      const h = backend(options);
      const result = await loader.loadUnifiedContentMetrics();
      assert.ok(result.error);
      assert.equal(h.trace.length, 1);
      assert.equal(result.total, 0);
    }
  });
  await check("Entity List uses three read requests with provided categories and valid schema output", async () => {
    const h = backend();
    const result = await loadTopicsEntityListResult(listQuery(), categories);
    assert.equal(h.trace.length, 3);
    assert.equal(h.trace.filter((request) => request.rpc).length, 1);
    assert.equal(h.trace.filter((request) => request.table === "admin_content_topics").length, 2);
    assert.equal(topicsEntityListAdapter.resultSchema.safeParse(result).success, true);
  });
  await check("Queries without a category filter preserve supplied-hierarchy results with three reads and no hierarchy dependency", async () => {
    for (const values of [
      {}, { page: "2" }, { page: "999" }, { limit: "20" }, { limit: "30" }, { limit: "50" },
      { q: "Alpha Guide" }, { q: "No matching title" }, { status: "published" },
      { featured: "yes" }, { view: "trash" }, { content_type: "news" }, { series: "any" }, { image: "without" },
    ]) {
      const query = listQuery(values);
      backend();
      const supplied = await loadTopicsEntityListResult(query, categories);
      const h = backend({ categoryError: true });
      const omitted = await loadTopicsEntityListResult(query);
      assert.deepEqual(omitted.rows, supplied.rows);
      assert.deepEqual(omitted.pagination, supplied.pagination);
      assert.deepEqual(omitted.metrics, supplied.metrics);
      assert.equal(topicsEntityListAdapter.resultSchema.safeParse(omitted).success, true);
      assert.equal(h.trace.length, 3);
      assert.equal(h.trace.filter((request) => request.table === "topic_categories").length, 0);
      assert.equal(h.trace.filter((request) => request.rpc).length, 1);
      assert.equal(h.trace.filter((request) => request.table === "admin_content_topics").length, 2);
    }
  });
  await check("Category-filtered queries read the missing hierarchy once and preserve root and descendant membership", async () => {
    const query = listQuery({ category: "1", limit: "50" });
    backend();
    const supplied = await loadTopicsEntityListResult(query, categories);
    const h = backend();
    const omitted = await loadTopicsEntityListResult(query);
    assert.deepEqual(omitted.rows, supplied.rows);
    assert.deepEqual(omitted.pagination, supplied.pagination);
    assert.deepEqual(omitted.metrics, supplied.metrics);
    assert.equal(omitted.pagination.totalRows, 19);
    assert.deepEqual([...new Set(omitted.rows.map((row) => row.category_id))].sort(), [1, 2, 3]);
    assert.equal(h.trace.length, 4);
    assert.equal(h.trace.filter((request) => request.table === "topic_categories").length, 1);
    const contentReads = h.trace.filter((request) => request.table === "admin_content_topics");
    assert.deepEqual(contentReads[0].filters, contentReads[1].filters);
    assert.ok(contentReads[0].filters.some(([operator, key, value]) =>
      operator === "in" && key === "category_id" && value.join() === "1,2,3"));
  });
  await check("Entity List propagates category, page and malformed-metrics failure instead of successful empty data", async () => {
    for (const options of [{ categoryError: true }, { pageError: true }, { metrics: {} }]) {
      backend(options);
      await assert.rejects(loadTopicsEntityListResult(
        listQuery(options.categoryError ? { category: "1" } : {}),
        options.categoryError ? undefined : categories,
      ));
    }
  });
  console.log(`Topics persisted SEO read verified (${passed} checks; isolated query backend, no live DB timing).`);
} finally {
  moduleLoader._load = originalLoad;
  globalThis.fetch = originalFetch;
  scoreOwner.analyzeEntitySeo = originalAnalyze;
}
