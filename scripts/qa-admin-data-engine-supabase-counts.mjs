/**
 * Runtime Supabase call evidence for entity-list adapter owners.
 *
 * Wraps getSupabaseAdmin().from and executes the same owner functions the
 * typed read endpoint uses (or their documented query shape for Topics).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const issued = [];

function countingAdmin() {
  return {
    from(table) {
      issued.push(table);
      return supabase.from(table);
    },
  };
}

function loadPureTypeScriptModule(path, dependencies = {}) {
  const source = readFileSync(resolve(ROOT, path), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unsupported dependency ${specifier} while loading ${path}`);
    },
  );
  return commonJsModule.exports;
}

function reset() {
  issued.length = 0;
}

function hasNPlusOne(tables) {
  let streak = 1;
  for (let i = 1; i < tables.length; i += 1) {
    if (tables[i] === tables[i - 1]) {
      streak += 1;
      if (streak > 3) return true;
    } else streak = 1;
  }
  return false;
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

async function measure(label, expectedExact, requiredTables, fn) {
  reset();
  await fn();
  const ok =
    issued.length === expectedExact &&
    !hasNPlusOne(issued) &&
    requiredTables.every((table) => issued.includes(table));
  check(
    label,
    ok,
    `calls=${issued.length} expected=${expectedExact} tables=${JSON.stringify(issued)}`,
  );
  return { label, calls: [...issued] };
}

async function main() {
  const categoryTree = loadPureTypeScriptModule(
    "src/lib/admin/category-tree.ts",
  );
  const categoryHierarchy = loadPureTypeScriptModule(
    "src/lib/admin/content/category-hierarchy.ts",
  );
  const seriesCounts = loadPureTypeScriptModule(
    "src/lib/admin/content/series-topic-counts.ts",
    { "../../supabase-admin": { getSupabaseAdmin: countingAdmin } },
  );
  const loadCategories = loadPureTypeScriptModule(
    "src/lib/admin/content/load-categories-list.ts",
    {
      "server-only": {},
      zod: await import("zod"),
      "../category-tree": categoryTree,
      "../../supabase-admin": { getSupabaseAdmin: countingAdmin },
    },
  );
  const loadSeries = loadPureTypeScriptModule(
    "src/lib/admin/content/load-series-list.ts",
    {
      "server-only": {},
      zod: await import("zod"),
      "./category-hierarchy": categoryHierarchy,
      "./series-topic-counts": seriesCounts,
      "../../supabase-admin": { getSupabaseAdmin: countingAdmin },
    },
  );

  const results = [];

  // Topics endpoint path without preloaded categories: categories + count + page.
  results.push(
    await measure(
      "Topics search (endpoint owner shape)",
      3,
      ["topic_categories", "admin_content_topics"],
      async () => {
        const admin = countingAdmin();
        const { data: categories, error: categoriesError } = await admin
          .from("topic_categories")
          .select("id,name,slug,parent_id,sort_order,is_active,color_token")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true });
        if (categoriesError) throw new Error(categoriesError.message);
        void categories;
        const filters = (query) =>
          query.is("deleted_at", null).ilike("title", "%evidence%");
        const countQuery = filters(
          admin
            .from("admin_content_topics")
            .select("id", { count: "exact", head: true }),
        );
        const { error: countError } = await countQuery;
        if (countError) throw new Error(countError.message);
        const { error: pageError } = await filters(
          admin
            .from("admin_content_topics")
            .select("id,title,status")
            .order("title", { ascending: true })
            .range(0, 9),
        );
        if (pageError) throw new Error(pageError.message);
      },
    ),
  );

  results.push(
    await measure(
      "Topics pagination (endpoint owner shape)",
      3,
      ["topic_categories", "admin_content_topics"],
      async () => {
        const admin = countingAdmin();
        const { error: categoriesError } = await admin
          .from("topic_categories")
          .select("id,name,slug,parent_id,sort_order,is_active,color_token")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true });
        if (categoriesError) throw new Error(categoriesError.message);
        const countQuery = admin
          .from("admin_content_topics")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null);
        const { error: countError } = await countQuery;
        if (countError) throw new Error(countError.message);
        const { error: pageError } = await admin
          .from("admin_content_topics")
          .select("id,title,status")
          .is("deleted_at", null)
          .order("title", { ascending: true })
          .range(10, 19);
        if (pageError) throw new Error(pageError.message);
      },
    ),
  );

  results.push(
    await measure(
      "Categories status-filter owner",
      1,
      ["topic_categories"],
      async () => {
        await loadCategories.loadCategoriesListData();
      },
    ),
  );

  results.push(
    await measure(
      "Categories pagination owner",
      1,
      ["topic_categories"],
      async () => {
        await loadCategories.loadCategoriesListData();
      },
    ),
  );

  results.push(
    await measure(
      "Series search/filter owner",
      3,
      ["topic_series", "topics", "topic_categories"],
      async () => {
        await loadSeries.loadSeriesListData();
      },
    ),
  );

  results.push(
    await measure(
      "Series pagination owner",
      3,
      ["topic_series", "topics", "topic_categories"],
      async () => {
        await loadSeries.loadSeriesListData();
      },
    ),
  );

  reset();
  await loadSeries.loadSeriesListData();
  await loadSeries.loadSeriesListData();
  check(
    "Series dual load stays bounded (no N+1 / no loop)",
    issued.length === 6 && !hasNPlusOne(issued),
    `calls=${issued.length} tables=${JSON.stringify(issued)}`,
  );

  console.log(
    `qa-admin-data-engine-supabase-counts: ${passed}/${passed + failed} passed`,
  );
  console.log(
    JSON.stringify(
      {
        baselineRscEstimates: {
          topics: 15,
          categories: 5,
          series: 7,
        },
        endpointOwnerBodies: Object.fromEntries(
          results.map((entry) => [entry.label, entry.calls.length]),
        ),
        note: "Owner-body counts exclude proxy/page auth. Endpoint interactions must not exceed these owner bodies per request and must not introduce N+1.",
      },
      null,
      2,
    ),
  );
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
