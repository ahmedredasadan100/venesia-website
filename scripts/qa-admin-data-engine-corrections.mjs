import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const prefix = `qa-correction-${runId}`;
const ids = { categories: [], series: [], topics: [] };
const checks = [];

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function must(label, promise) {
  const { data, error, count } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return { data, count };
}

loadEnv(resolve(ROOT, ".env.local"));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function cleanup() {
  const errors = [];
  for (const [table, values] of [
    ["topics", ids.topics],
    ["topic_series", ids.series],
    ["topic_categories", [...ids.categories].reverse()],
  ]) {
    if (!values.length) continue;
    const { error } = await supabase.from(table).delete().in("id", values);
    if (error) errors.push(`${table}: ${error.message}`);
  }
  check("Fixture cleanup succeeds", errors.length === 0, errors.join(" | "));
}

function loadPaginationBuilder() {
  const path = resolve(ROOT, "src/components/admin/ui/AdminTablePagination.tsx");
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  const compiledModule = { exports };
  const stub = new Proxy(() => null, {
    get: () => stub,
    apply: () => null,
  });
  vm.runInNewContext(output, {
    exports,
    module: compiledModule,
    require: () => stub,
    URLSearchParams,
    console,
  });
  return compiledModule.exports.buildAdminPaginationItems;
}

async function main() {
  const buildItems = loadPaginationBuilder();
  const samples = [1, 2, 3, 4, 5, 9, 10, 50, 97, 98, 99, 100];
  const slotCounts = samples.map((page) => buildItems(page, 100).length);
  check(
    "Pagination keeps seven logical slots across boundaries",
    slotCounts.every((count) => count === 7),
    JSON.stringify(slotCounts),
  );
  check(
    "Pagination keeps first and last anchors",
    samples.every((page) => {
      const items = buildItems(page, 100);
      return items[0] === 1 && items.at(-1) === 100;
    }),
  );

  const categoryRows = [
    { name: `${prefix} series`, slug: `${prefix}-series`, is_active: false, status: "draft", sort_order: 990001 },
    { name: `${prefix} clean`, slug: `${prefix}-clean`, is_active: true, status: "published", sort_order: 990002 },
  ];
  const categories = (await must(
    "create categories",
    supabase.from("topic_categories").insert(categoryRows).select("id,name,slug"),
  )).data;
  ids.categories.push(...categories.map((row) => row.id));
  const guarded = categories[0];
  const clean = categories[1];

  const child = (await must(
    "create child category",
    supabase
      .from("topic_categories")
      .insert({ name: `${prefix} child`, slug: `${prefix}-child`, parent_id: guarded.id, is_active: true, status: "published" })
      .select("id")
      .single(),
  )).data;
  ids.categories.push(child.id);

  const series = (await must(
    "create series",
    supabase
      .from("topic_series")
      .insert({ name: `${prefix} series`, slug: `${prefix}-series`, category_id: guarded.id, status: "published", sort_order: 990001 })
      .select("id")
      .single(),
  )).data;
  ids.series.push(series.id);

  const now = new Date().toISOString();
  const common = {
    excerpt: "Correction QA excerpt",
    content: "Correction QA content",
    image: "/images/venesia-5.png",
    image_alt: "Correction QA",
    category: guarded.name,
    category_slug: guarded.slug,
    category_id: guarded.id,
    series_id: series.id,
    content_type: "article",
    status: "draft",
    created_at: now,
    updated_at: now,
  };
  const topics = (await must(
    "create topics",
    supabase.from("topics").insert([
      ...[1, 2, 3].map((index) => ({ ...common, slug: `${prefix}-topic-${index}`, title: `${prefix} topic ${index}` })),
      { ...common, slug: `${prefix}-topic-deleted`, title: `${prefix} deleted`, deleted_at: now },
    ]).select("id"),
  )).data;
  ids.topics.push(...topics.map((row) => row.id));

  const base = await must(
    "base series count",
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("series_id", series.id).is("deleted_at", null),
  );
  const view = await must(
    "view series count",
    supabase.from("admin_content_topics").select("id", { count: "exact", head: true }).eq("series_id", series.id).is("deleted_at", null),
  );
  const viewRows = (await must(
    "view series rows",
    supabase.from("admin_content_topics").select("id,series_id,series_name,deleted_at").eq("series_id", series.id).is("deleted_at", null),
  )).data;
  check("Topics and admin view agree on three active series rows", base.count === 3 && view.count === 3 && viewRows.length === 3, `topics=${base.count} view=${view.count} rows=${viewRows.length}`);
  check("View rows expose the requested series identity", viewRows.every((row) => row.series_id === series.id && row.series_name === `${prefix} series`));

  const [topicCount, seriesCount, childCount] = await Promise.all([
    must("topic dependency", supabase.from("topics").select("id", { count: "exact", head: true }).eq("category_id", guarded.id)),
    must("series dependency", supabase.from("topic_series").select("id", { count: "exact", head: true }).eq("category_id", guarded.id)),
    must("child dependency", supabase.from("topic_categories").select("id", { count: "exact", head: true }).eq("parent_id", guarded.id)),
  ]);
  check("Category dependency fixture covers topics, series, and children", topicCount.count === 4 && seriesCount.count === 1 && childCount.count === 1, `topics=${topicCount.count} series=${seriesCount.count} children=${childCount.count}`);

  const cleanDelete = await supabase.from("topic_categories").delete().eq("id", clean.id);
  check("Dependency-free category can be deleted", !cleanDelete.error);
  if (!cleanDelete.error) ids.categories = ids.categories.filter((id) => id !== clean.id);
}

try {
  await main();
} finally {
  await cleanup();
}

const failed = checks.filter((item) => !item.ok);
console.log(`qa-admin-data-engine-corrections: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
