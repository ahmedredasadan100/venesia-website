/**
 * Data-correctness acceptance for admin content topic counts (Categories / Series).
 *
 * Guards the soft-delete counting contract:
 *   - topics with deleted_at IS NOT NULL never count toward a category or a series;
 *   - archived-but-not-deleted topics keep counting;
 *   - topics without category/series never enter the respective count;
 *   - counts stay correct on repeat loads and through the series AJAX fresh-rows
 *     mutation refresh path.
 *
 * Runs real integration assertions against Supabase with isolated fixtures
 * (unique prefix, deleted in finally with zero-count cleanup proof) plus a
 * browser phase against a server on 127.0.0.1:3000 with an isolated admin.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, ".tmp-qa/admin-soft-deleted-content-counts");
const baseUrl = "http://127.0.0.1:3000";
const runId = Date.now().toString(36);
const prefix = `qa-sdc-${runId}`;
const fixtureSearch = `QA SDC ${runId}`;
const adminUsername = `__QA_SDC_COUNTS_${runId}__`;
const adminEmail = `${prefix}@venesia.local`;
const password = randomBytes(24).toString("base64url");

mkdirSync(OUT, { recursive: true });

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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

/** Loads the real production TS module so assertions run against shipped code. */
function loadPureTypeScriptModule(path, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(resolve(ROOT, path), "utf8"), {
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

const seriesCountsModule = loadPureTypeScriptModule(
  "src/lib/admin/content/series-topic-counts.ts",
  { "../../supabase-admin": { getSupabaseAdmin: () => supabase } },
);

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function countTopics(build) {
  const { count, error } = await build(
    supabase.from("topics").select("id", { count: "exact", head: true }),
  );
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Ground-truth totals, independent of the production count paths. */
async function groundTruthTotals() {
  const [seriesActive, categoryActive] = await Promise.all([
    countTopics((q) => q.not("series_id", "is", null).is("deleted_at", null)),
    countTopics((q) => q.not("category_id", "is", null).is("deleted_at", null)),
  ]);
  return { seriesActive, categoryActive };
}

/** Same query shape the categories page uses (embedded count + soft-delete filter). */
async function loadCategoryNestedCounts() {
  const data = await must(
    "categories nested counts",
    supabase
      .from("topic_categories")
      .select("id, parent_id, topics_count:topics(count)")
      .is("topics.deleted_at", null)
      .order("id", { ascending: true }),
  );
  const own = new Map(
    data.map((row) => [row.id, row.topics_count?.[0]?.count ?? 0]),
  );
  // Same descendant rollup contract as buildCategoryTree (own + children totals).
  const children = new Map();
  for (const row of data) {
    if (!row.parent_id) continue;
    if (!children.has(row.parent_id)) children.set(row.parent_id, []);
    children.get(row.parent_id).push(row.id);
  }
  const totalOf = (id) =>
    (own.get(id) ?? 0) +
    (children.get(id) ?? []).reduce((sum, childId) => sum + totalOf(childId), 0);
  return { own, totalOf };
}

async function loadSeriesHelperCounts() {
  const { counts, error } = await seriesCountsModule.loadActiveSeriesTopicCounts();
  if (error) throw new Error(error.message);
  return counts;
}

const fixtures = {
  parentCategoryId: null,
  childCategoryId: null,
  seriesId: null,
  topicIds: [],
  adminId: null,
};
let cleanupProof = null;

async function cleanup() {
  const errors = [];
  const del = async (label, promise) => {
    const { error } = await promise;
    if (error) errors.push(`${label}: ${error.message}`);
  };
  await del("topics", supabase.from("topics").delete().like("slug", `${prefix}%`));
  if (fixtures.seriesId) {
    await del("series", supabase.from("topic_series").delete().eq("id", fixtures.seriesId));
  }
  await del(
    "categories",
    supabase.from("topic_categories").delete().like("slug", `${prefix}%`),
  );
  if (fixtures.adminId) {
    await del(
      "preferences",
      supabase.from("admin_user_preferences").delete().eq("admin_user_id", fixtures.adminId),
    );
    await del(
      "audit",
      supabase.from("admin_audit_logs").delete().eq("actor_admin_user_id", fixtures.adminId),
    );
  }
  await del("admin", supabase.from("admin_users").delete().eq("username", adminUsername));

  const [topicsRemaining, categoriesRemaining, seriesRemaining, adminsRemaining] =
    await Promise.all([
      countTopics((q) => q.like("slug", `${prefix}%`)),
      supabase
        .from("topic_categories")
        .select("id", { count: "exact", head: true })
        .like("slug", `${prefix}%`)
        .then(({ count }) => count ?? -1),
      supabase
        .from("topic_series")
        .select("id", { count: "exact", head: true })
        .like("slug", `${prefix}%`)
        .then(({ count }) => count ?? -1),
      supabase
        .from("admin_users")
        .select("id", { count: "exact", head: true })
        .eq("username", adminUsername)
        .then(({ count }) => count ?? -1),
    ]);
  cleanupProof = {
    errors,
    topicsRemaining,
    categoriesRemaining,
    seriesRemaining,
    adminsRemaining,
    ok:
      errors.length === 0 &&
      topicsRemaining === 0 &&
      categoriesRemaining === 0 &&
      seriesRemaining === 0 &&
      adminsRemaining === 0,
  };
  return cleanupProof;
}

async function createFixtures() {
  const parent = await must(
    "create parent category",
    supabase
      .from("topic_categories")
      .insert({
        name: `${fixtureSearch} Parent`,
        slug: `${prefix}-parent`,
        sort_order: 910_000,
        is_active: true,
        status: "published",
      })
      .select("id")
      .single(),
  );
  fixtures.parentCategoryId = parent.id;

  const child = await must(
    "create child category",
    supabase
      .from("topic_categories")
      .insert({
        name: `${fixtureSearch} Child`,
        slug: `${prefix}-child`,
        parent_id: parent.id,
        sort_order: 1,
        is_active: true,
        status: "published",
      })
      .select("id")
      .single(),
  );
  fixtures.childCategoryId = child.id;

  const series = await must(
    "create series",
    supabase
      .from("topic_series")
      .insert({
        name: `${fixtureSearch} Series`,
        slug: `${prefix}-series`,
        status: "published",
        sort_order: 910_000,
        category_id: child.id,
      })
      .select("id")
      .single(),
  );
  fixtures.seriesId = series.id;

  const now = new Date().toISOString();
  const common = {
    excerpt: "QA soft-delete counts fixture excerpt.",
    content: "QA soft-delete counts fixture content.",
    image: "/images/venesia-5.png",
    image_alt: "QA fixture image",
    category: `${fixtureSearch} Child`,
    category_slug: `${prefix}-child`,
    content_type: "article",
    created_at: now,
    updated_at: now,
  };
  const rows = [
    {
      ...common,
      slug: `${prefix}-t-active-both`,
      title: `${fixtureSearch} active both`,
      status: "draft",
      category_id: child.id,
      series_id: series.id,
    },
    {
      ...common,
      slug: `${prefix}-t-softdel-both`,
      title: `${fixtureSearch} soft-deleted both`,
      status: "draft",
      category_id: child.id,
      series_id: series.id,
      deleted_at: now,
    },
    {
      ...common,
      slug: `${prefix}-t-archived`,
      title: `${fixtureSearch} archived active`,
      status: "archived",
      category_id: child.id,
      series_id: series.id,
      deleted_at: null,
    },
    {
      ...common,
      slug: `${prefix}-t-series-only`,
      title: `${fixtureSearch} series only`,
      status: "draft",
      category_id: null,
      series_id: series.id,
    },
    {
      ...common,
      slug: `${prefix}-t-category-only`,
      title: `${fixtureSearch} category only`,
      status: "draft",
      category_id: child.id,
      series_id: null,
    },
  ];
  const seeded = await must(
    "seed fixture topics",
    supabase.from("topics").insert(rows).select("id"),
  );
  fixtures.topicIds = seeded.map((row) => row.id);
}

async function dataPhase() {
  // Pre-fixture parity between production count paths and ground truth.
  const baseline = await groundTruthTotals();
  const helperBefore = await loadSeriesHelperCounts();
  const helperBeforeSum = [...helperBefore.values()].reduce((a, b) => a + b, 0);
  check(
    "Series helper sum matches active series-linked topics (pre-fixture)",
    helperBeforeSum === baseline.seriesActive,
    `helper=${helperBeforeSum} truth=${baseline.seriesActive}`,
  );
  const nestedBefore = await loadCategoryNestedCounts();
  const nestedBeforeSum = [...nestedBefore.own.values()].reduce((a, b) => a + b, 0);
  check(
    "Categories nested sum matches active categorized topics (pre-fixture)",
    nestedBeforeSum === baseline.categoryActive,
    `nested=${nestedBeforeSum} truth=${baseline.categoryActive}`,
  );

  await createFixtures();
  const { seriesId, childCategoryId, parentCategoryId } = fixtures;

  // Ground truth for the fixture series/category (independent queries).
  const truthSeries = await countTopics((q) =>
    q.eq("series_id", seriesId).is("deleted_at", null),
  );
  const truthCategory = await countTopics((q) =>
    q.eq("category_id", childCategoryId).is("deleted_at", null),
  );
  check("Fixture ground truth: 3 active topics in series", truthSeries === 3, truthSeries);
  check(
    "Fixture ground truth: 3 active topics in child category",
    truthCategory === 3,
    truthCategory,
  );

  // Tripwire: the unfiltered legacy semantics MUST differ, proving the
  // fixture really contains a soft-deleted topic that a regression would count.
  const legacySeries = await countTopics((q) => q.eq("series_id", seriesId));
  check(
    "Tripwire: unfiltered series count includes the soft-deleted topic",
    legacySeries === 4,
    legacySeries,
  );

  // Case coverage through the production series count owner.
  const helper = await loadSeriesHelperCounts();
  check(
    "Series count excludes soft-deleted, keeps archived, skips no-series topic",
    helper.get(seriesId) === 3,
    `count=${helper.get(seriesId)}`,
  );

  // Case coverage through the categories page query shape.
  const nested = await loadCategoryNestedCounts();
  check(
    "Child category own count excludes soft-deleted, keeps archived, skips no-category topic",
    nested.own.get(childCategoryId) === 3,
    `own=${nested.own.get(childCategoryId)}`,
  );
  check(
    "Parent category direct count stays 0",
    nested.own.get(parentCategoryId) === 0,
    `own=${nested.own.get(parentCategoryId)}`,
  );
  check(
    "Parent descendant total is 3 (soft-deleted child topic never rolls up)",
    nested.totalOf(parentCategoryId) === 3,
    `total=${nested.totalOf(parentCategoryId)}`,
  );

  // The dual-linked topic counts once in each place, not twice anywhere.
  check(
    "Dual-linked topic counted once per dimension (3 series / 3 category, not 4+)",
    helper.get(seriesId) === 3 && nested.own.get(childCategoryId) === 3,
  );

  // Repeat load stability.
  const helperRepeat = await loadSeriesHelperCounts();
  const nestedRepeat = await loadCategoryNestedCounts();
  check(
    "Repeat load returns identical counts",
    helperRepeat.get(seriesId) === helper.get(seriesId) &&
      nestedRepeat.own.get(childCategoryId) === nested.own.get(childCategoryId),
  );

  // Global parity with fixtures present.
  const withFixtures = await groundTruthTotals();
  const helperSum = [...helper.values()].reduce((a, b) => a + b, 0);
  const nestedSum = [...nested.own.values()].reduce((a, b) => a + b, 0);
  check(
    "Series helper global sum matches ground truth (with fixtures)",
    helperSum === withFixtures.seriesActive,
    `helper=${helperSum} truth=${withFixtures.seriesActive}`,
  );
  check(
    "Categories nested global sum matches ground truth (with fixtures)",
    nestedSum === withFixtures.categoryActive,
    `nested=${nestedSum} truth=${withFixtures.categoryActive}`,
  );

  return baseline;
}

// Static wiring guard (supplementary to the integration assertions above):
// both series consumers must use the single count owner and no unfiltered
// topics fetch may reappear in the count paths.
function staticWiringPhase() {
  const seriesPage = readFileSync(
    resolve(ROOT, "src/app/admin/content/series/page.tsx"),
    "utf8",
  );
  const seriesActions = readFileSync(
    resolve(ROOT, "src/app/admin/content/series/actions.ts"),
    "utf8",
  );
  const categoriesPage = readFileSync(
    resolve(ROOT, "src/app/admin/content/categories/page.tsx"),
    "utf8",
  );
  check(
    "Series page and fresh-rows action both consume loadActiveSeriesTopicCounts",
    seriesPage.includes("loadActiveSeriesTopicCounts") &&
      seriesActions.includes("loadActiveSeriesTopicCounts"),
  );
  check(
    "No unfiltered topics->series_id fetch remains in series consumers",
    !seriesPage.includes('.from("topics").select("series_id")') &&
      !seriesActions.includes('.from("topics").select("series_id")'),
  );
  check(
    "Categories page filters the embedded topics count on deleted_at",
    categoriesPage.includes("topics_count:topics(count)") &&
      categoriesPage.includes('.is("topics.deleted_at", null)'),
  );
}

async function readRowCount(page, rowId) {
  const cell = page
    .locator(`[data-entity-row-id="${rowId}"]`)
    .locator(".tabular-nums")
    .first();
  return (await cell.textContent())?.trim() ?? null;
}

async function browserPhase() {
  const probe = await fetch(`${baseUrl}/admin/login`).catch(() => null);
  if (!probe || !probe.ok) {
    throw new Error(
      `Browser phase requires a server at ${baseUrl} (got ${probe?.status ?? "no response"}).`,
    );
  }

  const admin = await must(
    "create isolated admin",
    supabase
      .from("admin_users")
      .insert({
        username: adminUsername,
        email: adminEmail,
        password_hash: await bcrypt.hash(password, 10),
        role: "super_admin",
        is_active: true,
      })
      .select("id")
      .single(),
  );
  fixtures.adminId = admin.id;

  const consoleIssues = [];
  const pageErrors = [];
  const badResponses = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() !== "error" && !(msg.type() === "warning" && /hydration|hydrate/i.test(text))) {
        return;
      }
      if (text.includes("caret-color") || text.includes("caretColor")) return;
      consoleIssues.push(text);
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("response", (response) => {
      if (response.status() === 404 || response.status() >= 500) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const login = await page.evaluate(
      async ({ username, loginPassword }) => {
        const response = await fetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ username, password: loginPassword, rememberMe: false }),
        });
        return { ok: response.ok, status: response.status };
      },
      { username: adminUsername, loginPassword: password },
    );
    if (!login.ok) throw new Error(`QA login failed: ${login.status}`);

    // ── Series list: rendered count + summary metric ──
    const truth = await groundTruthTotals();
    const seriesUrl = `${baseUrl}/admin/content/series?q=${encodeURIComponent(fixtureSearch)}`;
    await page.goto(seriesUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(`[data-entity-row-id="${fixtures.seriesId}"]`, {
      timeout: 20_000,
    });
    check(
      "Series row shows 3 active topics",
      (await readRowCount(page, fixtures.seriesId)) === "3",
      await readRowCount(page, fixtures.seriesId),
    );
    const metricValue = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("section.grid > div"));
      const card = cards.find((item) =>
        item.querySelector("p:last-child")?.textContent?.trim() === "الموضوعات",
      );
      return card?.querySelector("p")?.textContent?.trim() ?? null;
    });
    check(
      "Series summary metric equals active series-linked topics",
      metricValue === String(truth.seriesActive),
      `metric=${metricValue} truth=${truth.seriesActive}`,
    );
    await page.screenshot({ path: resolve(OUT, "series-fixture-1440.png"), fullPage: true });

    // ── Series mutation refresh path (AJAX fresh rows) ──
    const row = page.locator(`[data-entity-row-id="${fixtures.seriesId}"]`);
    await row.locator('button[title="إخفاء"]').click();
    await row
      .locator('button[title="إظهار"]')
      .waitFor({ state: "visible", timeout: 20_000 });
    check(
      "Series count stays 3 after visibility toggle (fresh rows path)",
      (await readRowCount(page, fixtures.seriesId)) === "3",
      await readRowCount(page, fixtures.seriesId),
    );
    await page.screenshot({
      path: resolve(OUT, "series-after-toggle-1440.png"),
      fullPage: true,
    });

    // ── Reload stability ──
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-entity-row-id="${fixtures.seriesId}"]`, {
      timeout: 20_000,
    });
    check(
      "Series count stays 3 after reload",
      (await readRowCount(page, fixtures.seriesId)) === "3",
    );

    // ── Categories list: child + parent rollup ──
    const categoriesUrl = `${baseUrl}/admin/content/categories?q=${encodeURIComponent(fixtureSearch)}`;
    await page.goto(categoriesUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(`[data-entity-row-id="${fixtures.childCategoryId}"]`, {
      timeout: 20_000,
    });
    check(
      "Child category row shows 3 active topics",
      (await readRowCount(page, fixtures.childCategoryId)) === "3",
      await readRowCount(page, fixtures.childCategoryId),
    );
    check(
      "Parent category row shows descendant total 3",
      (await readRowCount(page, fixtures.parentCategoryId)) === "3",
      await readRowCount(page, fixtures.parentCategoryId),
    );
    await page.screenshot({
      path: resolve(OUT, "categories-fixture-1440.png"),
      fullPage: true,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-entity-row-id="${fixtures.childCategoryId}"]`, {
      timeout: 20_000,
    });
    check(
      "Category counts stable after reload",
      (await readRowCount(page, fixtures.childCategoryId)) === "3" &&
        (await readRowCount(page, fixtures.parentCategoryId)) === "3",
    );

    check("No console errors", consoleIssues.length === 0, consoleIssues.join(" | "));
    check("No page errors", pageErrors.length === 0, pageErrors.join(" | "));
    check("No 404/500 responses", badResponses.length === 0, badResponses.join(" | "));
  } finally {
    await browser.close();
  }
}

async function main() {
  let baseline = null;
  try {
    staticWiringPhase();
    baseline = await dataPhase();
    await browserPhase();
  } finally {
    await cleanup();
  }

  check(
    "Fixture cleanup leaves zero records",
    cleanupProof?.ok === true,
    JSON.stringify(cleanupProof),
  );
  if (baseline) {
    const after = await groundTruthTotals();
    check(
      "Baseline totals restored after cleanup",
      after.seriesActive === baseline.seriesActive &&
        after.categoryActive === baseline.categoryActive,
      `before=${JSON.stringify(baseline)} after=${JSON.stringify(after)}`,
    );
  }

  writeFileSync(
    resolve(OUT, "qa-admin-content-soft-delete-counts-report.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), runId, prefix, cleanupProof, checks },
      null,
      2,
    ),
  );

  const failed = checks.filter((item) => !item.ok);
  console.log(
    `qa-admin-content-soft-delete-counts: ${checks.length - failed.length}/${checks.length} passed`,
  );
  if (failed.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
