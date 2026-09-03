import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

import { PGlite } from "@electric-sql/pglite";
import { createJiti } from "jiti";
import ts from "typescript";

import type {
  FeedModuleConfig,
  TopicsFeedType,
} from "../src/lib/feed-modules/types";

type CommonJsModule = { exports: Record<string, unknown> };
type CommonJsFactory = (
  require: (specifier: string) => unknown,
  targetModule: CommonJsModule,
  exports: Record<string, unknown>,
  filename: string,
  dirname: string,
) => void;

const nativeRequire = createRequire(import.meta.url);

function loadTranspiledModule(
  filename: string,
  overrides: Record<string, unknown> = {},
) {
  const source = readFileSync(filename, "utf8").replace(/^\uFEFF/u, "");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const targetModule: CommonJsModule = { exports: {} };
  const wrapper = new vm.Script(
    `(function (require, module, exports, __filename, __dirname) { ${compiled}\n})`,
    { filename },
  );
  const factory = wrapper.runInThisContext() as CommonJsFactory;
  factory(
    (specifier) =>
      Object.prototype.hasOwnProperty.call(overrides, specifier)
        ? overrides[specifier]
        : nativeRequire(specifier),
    targetModule,
    targetModule.exports,
    filename,
    path.dirname(filename),
  );
  return targetModule.exports;
}

const jiti = createJiti(import.meta.url);
const moduleEditRegistry = await jiti.import<Record<string, unknown>>(
  "../src/lib/page-blocks/module-edit-registry.ts",
);
const pageBlockConfigs = await jiti.import<Record<string, unknown>>(
  "../src/lib/page-blocks/configs.ts",
);
const categoryHierarchy = await jiti.import<Record<string, unknown>>(
  "../src/lib/admin/content/category-hierarchy.ts",
);
const adminUtils = loadTranspiledModule("src/lib/page-blocks/admin-utils.ts", {
  "../admin/content/content-status-metadata": {
    getContentStatusMetadata: () => ({}),
  },
  "./module-edit-registry": moduleEditRegistry,
});
const feedTypes = loadTranspiledModule("src/lib/feed-modules/types.ts");
const feedConfigContract = loadTranspiledModule(
  "src/lib/feed-modules/parse-feed-config.ts",
  {
    "../page-blocks/admin-utils": adminUtils,
    "../page-blocks/configs": pageBlockConfigs,
    "./types": feedTypes,
  },
);

const buildFeedModuleConfig = feedConfigContract.buildFeedModuleConfig as (
  formData: FormData,
  feedType: TopicsFeedType,
) => FeedModuleConfig;
const parseFeedModuleConfig = feedConfigContract.parseFeedModuleConfig as (
  raw: Record<string, unknown> | null | undefined,
  feedType: TopicsFeedType,
) => FeedModuleConfig;
const isPersistedFeedModuleConfigEqual =
  feedConfigContract.isPersistedFeedModuleConfigEqual as (
    raw: unknown,
    expected: FeedModuleConfig,
  ) => boolean;
const isPublishedPageBlockStatus = adminUtils.isPublishedPageBlockStatus as (
  value: string | null | undefined,
) => boolean;
const isPageModulePubliclyVisible = adminUtils.isPageModulePubliclyVisible as (
  assignmentVisible: unknown,
  templateStatus: string | null | undefined,
) => boolean;
const normalizeBoolean = adminUtils.normalizeBoolean as (
  value: unknown,
  fallback?: boolean,
) => boolean;
const parseFormStatus = adminUtils.parseFormStatus as (
  formData: FormData,
  key?: string,
) => "published" | "unpublished";
const topicFilterOptionsContract = loadTranspiledModule(
  "src/lib/feed-modules/load-topic-filter-options.ts",
  {
    "server-only": {},
    "../supabase-admin": { getSupabaseAdmin: () => ({}) },
    "../logging": { logError: () => undefined },
    "../admin/content/category-hierarchy": categoryHierarchy,
  },
);
const getSeriesOptionsForCategories = topicFilterOptionsContract.getSeriesOptionsForCategories as (
  options: {
    seriesByCategorySlug: Record<string, Array<{ id: number; slug: string; name: string; categoryId: number }>>;
  },
  categorySlugs: readonly string[],
) => Array<{ id: number; slug: string }>;
const filterSeriesSlugsForCategories = topicFilterOptionsContract.filterSeriesSlugsForCategories as (
  options: Parameters<typeof getSeriesOptionsForCategories>[0],
  categorySlugs: readonly string[],
  seriesSlugs: readonly string[],
) => string[];

const seriesFilterFixture = {
  seriesByCategorySlug: {
    "bait-al-watan": [{ id: 1, slug: "district-guide", name: "دليل الحي", categoryId: 10 }],
    "real-estate": [
      { id: 1, slug: "district-guide", name: "دليل الحي", categoryId: 10 },
      { id: 2, slug: "buying-guide", name: "دليل الشراء", categoryId: 20 },
    ],
  },
};
assert.deepEqual(
  getSeriesOptionsForCategories(seriesFilterFixture, ["bait-al-watan", "real-estate"]).map((item) => item.slug),
  ["district-guide", "buying-guide"],
);
assert.deepEqual(
  filterSeriesSlugsForCategories(
    seriesFilterFixture,
    ["bait-al-watan", "real-estate"],
    ["buying-guide", "district-guide", "missing", "buying-guide"],
  ),
  ["buying-guide", "district-guide"],
);
assert.deepEqual(filterSeriesSlugsForCategories(seriesFilterFixture, [], ["district-guide"]), []);

const checkedStatusForm = new FormData();
checkedStatusForm.append("status", "unpublished");
checkedStatusForm.append("status", "published");
assert.equal(parseFormStatus(checkedStatusForm), "published");

const uncheckedStatusForm = new FormData();
uncheckedStatusForm.append("status", "unpublished");
assert.equal(parseFormStatus(uncheckedStatusForm), "unpublished");

function createFeedForm() {
  const formData = new FormData();
  formData.set("widget_title", "أحدث الموضوعات");
  formData.set("limit", "3");
  formData.set("eyebrow", "مختارات");
  return formData;
}

const enabledForm = createFeedForm();
enabledForm.append("show_image", "false");
enabledForm.append("show_image", "true");
enabledForm.append("show_date", "false");
enabledForm.append("show_date", "true");
enabledForm.append("show_excerpt", "false");
enabledForm.append("show_excerpt", "true");
const enabledConfig = buildFeedModuleConfig(enabledForm, "latest");
assert.equal(enabledConfig.presentation.showImage, true);
assert.equal(enabledConfig.presentation.showDate, true);
assert.equal(enabledConfig.presentation.showExcerpt, true);

const disabledForm = createFeedForm();
disabledForm.set("show_image", "false");
disabledForm.set("show_date", "false");
disabledForm.set("show_excerpt", "false");
const disabledConfig = buildFeedModuleConfig(disabledForm, "latest");
assert.equal(disabledConfig.presentation.showImage, false);
assert.equal(disabledConfig.presentation.showDate, false);
assert.equal(disabledConfig.presentation.showExcerpt, false);

const seriesForm = createFeedForm();
seriesForm.set("link_text", "عرض السلسلة");
seriesForm.set("show_image", "false");
seriesForm.set("show_date", "true");
seriesForm.set("show_excerpt", "true");
const seriesConfig = buildFeedModuleConfig(seriesForm, "series");
assert.equal(seriesConfig.presentation.showImage, false);
assert.equal(seriesConfig.presentation.showDate, false);
assert.equal(seriesConfig.presentation.showExcerpt, true);
assert.equal(seriesConfig.presentation.linkText, "عرض السلسلة");

const categoryConfig = buildFeedModuleConfig(createFeedForm(), "categories");
assert.equal(categoryConfig.presentation.showImage, false);
assert.equal(categoryConfig.presentation.showDate, false);
assert.equal(categoryConfig.presentation.showExcerpt, false);

const multiCategoryForm = createFeedForm();
multiCategoryForm.append("category_slugs", "bait-al-watan");
multiCategoryForm.append("category_slugs", "real-estate");
multiCategoryForm.append("category_slugs", "bait-al-watan");
const multiCategoryConfig = buildFeedModuleConfig(multiCategoryForm, "latest");
assert.deepEqual(multiCategoryConfig.query.categorySlugs, ["bait-al-watan", "real-estate"]);

const multiSeriesForm = createFeedForm();
multiSeriesForm.append("category_slugs", "bait-al-watan");
multiSeriesForm.append("series_slugs", "district-guide");
multiSeriesForm.append("series_slugs", "market-updates");
multiSeriesForm.append("series_slugs", "district-guide");
const multiSeriesConfig = buildFeedModuleConfig(multiSeriesForm, "latest");
assert.deepEqual(multiSeriesConfig.query.seriesSlugs, ["district-guide", "market-updates"]);

const legacyCategoryForm = createFeedForm();
legacyCategoryForm.set("category_slug", "bait-al-watan");
assert.deepEqual(
  buildFeedModuleConfig(legacyCategoryForm, "latest").query.categorySlugs,
  ["bait-al-watan"],
);

const invalidLimitForm = createFeedForm();
invalidLimitForm.set("limit", "0");
assert.throws(
  () => buildFeedModuleConfig(invalidLimitForm, "latest"),
  /عدد العناصر المعروضة/u,
);
const missingTitleForm = createFeedForm();
missingTitleForm.set("widget_title", " ");
assert.throws(
  () => buildFeedModuleConfig(missingTitleForm, "latest"),
  /عنوان القسم مطلوب/u,
);

const legacyConfig = parseFeedModuleConfig(
  {
    presentation: {
      title: "قراءة آمنة",
      showImage: "false",
      showDate: "true",
      showExcerpt: "invalid",
    },
    query: { limit: "invalid", categorySlug: "bait-al-watan" },
  },
  "latest",
);
assert.equal(legacyConfig.presentation.showImage, false);
assert.equal(legacyConfig.presentation.showDate, true);
assert.equal(legacyConfig.presentation.showExcerpt, false);
assert.equal(legacyConfig.query.limit, 3);
assert.deepEqual(legacyConfig.query.categorySlugs, ["bait-al-watan"]);
assert.deepEqual(
  parseFeedModuleConfig(
    { query: { categorySlugs: ["bait-al-watan", "real-estate", "bait-al-watan"] } },
    "latest",
  ).query.categorySlugs,
  ["bait-al-watan", "real-estate"],
);
assert.deepEqual(
  parseFeedModuleConfig(
    { query: { seriesSlugs: ["district-guide", "market-updates", "district-guide"] } },
    "latest",
  ).query.seriesSlugs,
  ["district-guide", "market-updates"],
);
assert.deepEqual(
  parseFeedModuleConfig({ query: { seriesSlug: "legacy-series" } }, "latest").query.seriesSlugs,
  ["legacy-series"],
);
assert.deepEqual(
  parseFeedModuleConfig(
    { query: { seriesSlugs: [], seriesSlug: "legacy-series" } },
    "latest",
  ).query.seriesSlugs,
  [],
);
assert.equal(isPersistedFeedModuleConfigEqual(disabledConfig, disabledConfig), true);
assert.equal(
  isPersistedFeedModuleConfigEqual(
    { ...disabledConfig, presentation: { ...disabledConfig.presentation, showImage: "false" } },
    disabledConfig,
  ),
  false,
);
assert.equal(isPublishedPageBlockStatus("published"), true);
assert.equal(isPublishedPageBlockStatus("unpublished"), false);
assert.equal(isPublishedPageBlockStatus(null), false);
assert.equal(isPageModulePubliclyVisible(true, "published"), true);
assert.equal(isPageModulePubliclyVisible(false, "published"), false);
assert.equal(isPageModulePubliclyVisible(true, "unpublished"), false);
assert.equal(isPageModulePubliclyVisible(false, "unpublished"), false);
assert.equal(normalizeBoolean("false", true), false);

const db = await PGlite.create();
try {
  await db.exec(`
    create table feed_module_templates (
      id bigint generated always as identity primary key,
      feed_type text not null,
      config jsonb not null
    );
  `);
  const inserted = await db.query<{ id: number; config: unknown }>(
    "insert into feed_module_templates(feed_type,config) values ($1,$2::jsonb) returning id,config",
    ["latest", JSON.stringify(enabledConfig)],
  );
  const id = Number(inserted.rows[0]?.id);
  assert.ok(id > 0);
  assert.equal(
    isPersistedFeedModuleConfigEqual(inserted.rows[0]?.config, enabledConfig),
    true,
  );

  const updated = await db.query<{ config: unknown }>(
    "update feed_module_templates set config=$1::jsonb where id=$2 returning config",
    [JSON.stringify(disabledConfig), id],
  );
  assert.equal(
    isPersistedFeedModuleConfigEqual(updated.rows[0]?.config, disabledConfig),
    true,
  );
  assert.deepEqual(
    parseFeedModuleConfig(
      updated.rows[0]?.config as Record<string, unknown>,
      "latest",
    ),
    disabledConfig,
  );
} finally {
  await db.close();
}

type CategoryResolverRow = {
  id: number;
  name: string | null;
  slug: string | null;
  status: string;
  topics_count: Array<{ count: number | string | null }>;
  topics?: Array<{
    status: string;
    content_type: string;
    deleted_at: string | null;
    series_slug: string | null;
  }>;
};

type SeriesResolverRow = {
  slug: string;
  status: string;
  category_id: number | null;
};

type ResolverQueryResult = {
  data: unknown;
  error: Error | null;
};

const resolverFixture: {
  categories: CategoryResolverRow[];
  series: SeriesResolverRow[];
  categoryError: Error | null;
  categoryFilters: Array<[string, unknown]>;
} = {
  categories: [],
  series: [],
  categoryError: null,
  categoryFilters: [],
};

class ResolverQueryMock implements PromiseLike<ResolverQueryResult> {
  private readonly table: string;
  private readonly filters: Array<[string, unknown]> = [];
  private resultLimit: number | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    if (this.table === "topic_categories") {
      resolverFixture.categoryFilters.push([column, value]);
    }
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.filters.push([column, [...values]]);
    if (this.table === "topic_categories") {
      resolverFixture.categoryFilters.push([column, [...values]]);
    }
    return this;
  }

  is(column: string, value: unknown) {
    if (column.includes(".")) {
      this.filters.push([column, value]);
    }
    if (this.table === "topic_categories") {
      resolverFixture.categoryFilters.push([column, value]);
    }
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.resultLimit = value;
    return this;
  }

  async maybeSingle() {
    const rows = this.applyFilters(
      this.table === "topic_series" ? resolverFixture.series : [],
    );
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = ResolverQueryResult, TResult2 = never>(
    onfulfilled?: ((value: ResolverQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = this.resolveResult();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private applyFilters<T extends object>(rows: T[]) {
    return this.filters.reduce((filtered, [column, value]) =>
      column.includes(".")
        ? filtered
        : filtered.filter((row) =>
            Array.isArray(value)
              ? value.includes((row as Record<string, unknown>)[column])
              : (row as Record<string, unknown>)[column] === value,
          ), [...rows]);
  }

  private resolveResult(): ResolverQueryResult {
    if (this.table === "topic_categories" && resolverFixture.categoryError) {
      return { data: null, error: resolverFixture.categoryError };
    }

    const sourceRows: object[] = this.table === "topic_categories"
      ? resolverFixture.categories
      : this.table === "topic_series"
        ? resolverFixture.series
        : [];
    const rows = this.applyFilters(sourceRows).map((row) => {
      if (this.table !== "topic_categories") return row;

      const category = row as CategoryResolverRow;
      if (!category.topics) return category;

      const topics = this.filters.reduce((filtered, [column, value]) => {
        if (!column.startsWith("topics.")) return filtered;
        const topicColumn = column.slice("topics.".length);
        return filtered.filter((topic) =>
          Array.isArray(value)
            ? value.includes(topic[topicColumn as keyof typeof topic])
            : topic[topicColumn as keyof typeof topic] === value,
        );
      }, category.topics);

      return { ...category, topics_count: [{ count: topics.length }] };
    });
    return {
      data: this.resultLimit === null ? rows : rows.slice(0, this.resultLimit),
      error: null,
    };
  }
}

const publicCollectionInputs: Array<Record<string, unknown>> = [];
const resolverContract = loadTranspiledModule(
  "src/lib/feed-modules/resolve-topics-feed.ts",
  {
    "server-only": {},
    "../supabase-admin": {
      getSupabaseAdmin: () => ({
        from: (table: string) => new ResolverQueryMock(table),
      }),
    },
    "../content/public-content-read/owner": {
      loadPublicContentCollection: async (input: Record<string, unknown>) => {
        publicCollectionInputs.push(input);
        return { items: [] };
      },
    },
    "../logging": { logError: () => undefined },
    "../content-dates": { formatArabicContentDate: () => "" },
    "../media/resolve-local-public-image": {
      resolveLocalPublicImage: (value: unknown, fallback: string) =>
        typeof value === "string" && value ? value : fallback,
    },
  },
);
const resolveTopicsFeedModule = resolverContract.resolveTopicsFeedModule as (
  template: { feed_type: TopicsFeedType },
  config: FeedModuleConfig,
) => Promise<{
  kind: string;
  items: Array<{ name: string; href: string; count: number }>;
}>;

publicCollectionInputs.length = 0;
await resolveTopicsFeedModule(
  { feed_type: "latest" },
  {
    ...enabledConfig,
    query: {
      ...enabledConfig.query,
      categorySlugs: ["bait-al-watan"],
      seriesSlugs: ["district-guide", "market-updates"],
    },
  },
);
assert.deepEqual(publicCollectionInputs.at(-1)?.seriesSlugs, [
  "district-guide",
  "market-updates",
]);
assert.deepEqual(publicCollectionInputs.at(-1)?.categorySlugs, ["bait-al-watan"]);
assert.equal(publicCollectionInputs.at(-1)?.pageSize, enabledConfig.query.limit);

resolverFixture.categories = [
  { id: 1, name: "ØªØµÙ†ÙŠÙ Ø¢Ø®Ø±", slug: "other", status: "published", topics_count: [{ count: 4 }] },
  { id: 2, name: "Ø¨ÙŠØª Ø§Ù„ÙˆØ·Ù†", slug: "bait-al-watan", status: "published", topics_count: [{ count: "260" }] },
];
resolverFixture.categoryFilters = [];
const selectedCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: { ...categoryConfig.query, limit: 20, categorySlugs: ["bait-al-watan"] },
  },
);
assert.deepEqual(selectedCategoryPayload, {
  kind: "categories",
  items: [{ name: "Ø¨ÙŠØª Ø§Ù„ÙˆØ·Ù†", href: "/topics?category=bait-al-watan", count: 20 }],
});

resolverFixture.categories = [
  { id: 2, name: "بيت الوطن", slug: "bait-al-watan", status: "published", topics_count: [{ count: 10 }] },
];
const belowLimitCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: { ...categoryConfig.query, limit: 20, categorySlugs: ["bait-al-watan"] },
  },
);
assert.deepEqual(belowLimitCategoryPayload.items, [
  { name: "بيت الوطن", href: "/topics?category=bait-al-watan", count: 10 },
]);
assert.ok(
  resolverFixture.categoryFilters.some(
    ([column, value]) => column === "slug" && Array.isArray(value) && value.includes("bait-al-watan"),
  ),
  "category filter must be applied by the source query before limit",
);
for (const [column, value] of [
  ["topics.status", "published"],
  ["topics.content_type", "article"],
  ["topics.deleted_at", null],
] as const) {
  assert.ok(
    resolverFixture.categoryFilters.some(
      ([actualColumn, actualValue]) => actualColumn === column && actualValue === value,
    ),
    `public category counters must filter ${column}`,
  );
}

resolverFixture.categories = [
  { id: 1, name: "تصنيف آخر", slug: "other", status: "published", topics_count: [{ count: 4 }] },
  { id: 2, name: "بيت الوطن", slug: "bait-al-watan", status: "published", topics_count: [{ count: "260" }] },
  { id: 3, name: "غير مختار", slug: "unselected", status: "published", topics_count: [{ count: 7 }] },
];
resolverFixture.categoryFilters = [];
const multiCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: { ...categoryConfig.query, limit: 20, categorySlugs: ["other", "bait-al-watan"] },
  },
);
assert.deepEqual(multiCategoryPayload.items, [
  { name: "تصنيف آخر", href: "/topics?category=other", count: 4 },
  { name: "بيت الوطن", href: "/topics?category=bait-al-watan", count: 20 },
]);
assert.ok(
  resolverFixture.categoryFilters.some(
    ([column, value]) =>
      column === "slug" &&
      Array.isArray(value) &&
      value.includes("other") &&
      value.includes("bait-al-watan"),
  ),
  "multiple categories must be applied as one OR source filter before limit",
);

resolverFixture.categories = [{
  id: 2,
  name: "بيت الوطن",
  slug: "bait-al-watan",
  status: "published",
  topics_count: [{ count: 6 }],
  topics: [
    { status: "published", content_type: "article", deleted_at: null, series_slug: "district-guide" },
    { status: "published", content_type: "article", deleted_at: null, series_slug: "district-guide" },
    { status: "published", content_type: "article", deleted_at: null, series_slug: "market-updates" },
    { status: "published", content_type: "article", deleted_at: null, series_slug: "other-series" },
    { status: "unpublished", content_type: "article", deleted_at: null, series_slug: "district-guide" },
    { status: "published", content_type: "video", deleted_at: null, series_slug: "district-guide" },
  ],
}];
resolverFixture.series = [
  { slug: "district-guide", status: "published", category_id: 2 },
  { slug: "market-updates", status: "published", category_id: 2 },
];
resolverFixture.categoryFilters = [];
const allSeriesCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: { ...categoryConfig.query, limit: 20, categorySlugs: ["bait-al-watan"], seriesSlugs: [] },
  },
);
assert.equal(allSeriesCategoryPayload.items[0]?.count, 4);

resolverFixture.categoryFilters = [];
const oneSeriesCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: {
      ...categoryConfig.query,
      limit: 20,
      categorySlugs: ["bait-al-watan"],
      seriesSlugs: ["district-guide"],
    },
  },
);
assert.equal(oneSeriesCategoryPayload.items[0]?.count, 2);

resolverFixture.categoryFilters = [];
const multipleSeriesCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: {
      ...categoryConfig.query,
      limit: 20,
      categorySlugs: ["bait-al-watan"],
      seriesSlugs: ["district-guide", "market-updates"],
    },
  },
);
assert.equal(multipleSeriesCategoryPayload.items[0]?.count, 3);
assert.ok(
  resolverFixture.categoryFilters.some(
    ([column, value]) =>
      column === "topics.series_slug" &&
      Array.isArray(value) &&
      value.includes("district-guide") &&
      value.includes("market-updates"),
  ),
  "category counters must apply the selected series to the embedded topics aggregate",
);

resolverFixture.categories = [
  { id: 3, name: "  ", slug: "blank-label", status: "published", topics_count: [{ count: 1 }] },
  { id: 2, name: " Ø¨ÙŠØª Ø§Ù„ÙˆØ·Ù† ", slug: "bait-al-watan", status: "published", topics_count: [{ count: 2 }] },
];
const guardedCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  { ...categoryConfig, query: { ...categoryConfig.query, limit: 2 } },
);
assert.deepEqual(guardedCategoryPayload.items, [
  { name: "Ø¨ÙŠØª Ø§Ù„ÙˆØ·Ù†", href: "/topics?category=bait-al-watan", count: 2 },
]);

resolverFixture.categoryError = new Error("category query failed");
const categoryFailurePayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  categoryConfig,
);
assert.deepEqual(categoryFailurePayload, { kind: "categories", items: [] });
resolverFixture.categoryError = null;

resolverFixture.series = [
  { slug: "hidden-series", status: "unpublished", category_id: 2 },
];
const unpublishedSeriesPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: { ...categoryConfig.query, seriesSlugs: ["hidden-series"] },
  },
);
assert.deepEqual(unpublishedSeriesPayload, { kind: "categories", items: [] });

const editor = readFileSync(
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "utf8",
);
const filters = readFileSync(
  "src/components/admin/page-blocks/FeedModuleFilterFields.tsx",
  "utf8",
);
const actions = readFileSync(
  "src/app/admin/pages-blocks/blocks/feed/actions.ts",
  "utf8",
);
const loader = readFileSync("src/lib/feed-modules/load-feed-modules.ts", "utf8");
const resolver = readFileSync("src/lib/feed-modules/resolve-topics-feed.ts", "utf8");
const publicContentReadOwner = readFileSync(
  "src/lib/content/public-content-read/owner.ts",
  "utf8",
);
const adminUtilsSource = readFileSync("src/lib/page-blocks/admin-utils.ts", "utf8");
const blockLoader = readFileSync("src/lib/page-blocks/load-page-blocks.ts", "utf8");
const compositionLoader = readFileSync("src/lib/page-blocks/load-page-composition.ts", "utf8");
const heroLoader = readFileSync("src/lib/load-hero-section.ts", "utf8");
const adminAssignmentLoader = readFileSync("src/lib/page-blocks/admin-queries.ts", "utf8");
const moduleAssignmentLoader = readFileSync("src/lib/page-blocks/module-assignments-query.ts", "utf8");
const mediaHubLoader = readFileSync(
  "src/lib/media-hub-modules/load-media-hub-modules.ts",
  "utf8",
);
const mediaSidebarLoader = readFileSync(
  "src/lib/media-sidebar-modules/load-media-sidebar-modules.ts",
  "utf8",
);
const mediaSidebarResolver = readFileSync(
  "src/lib/media-sidebar-modules/resolve-widget-items.ts",
  "utf8",
);
const section = readFileSync("src/components/feed-modules/FeedModuleSection.tsx", "utf8");
const latest = readFileSync(
  "src/components/sidebar-feeds/SidebarLatestArticlesWidget.tsx",
  "utf8",
);
const popular = readFileSync(
  "src/components/sidebar-feeds/SidebarMostReadWidget.tsx",
  "utf8",
);
const series = readFileSync(
  "src/components/sidebar-feeds/SidebarSeriesWidget.tsx",
  "utf8",
);
const pageLayout = readFileSync(
  "src/components/page-composition/PageSlotLayout.tsx",
  "utf8",
);
const legacyStack = readFileSync(
  "src/components/feed-modules/FeedModulesStack.tsx",
  "utf8",
);

for (const label of ["عرض الصورة", "عرض التاريخ", "عرض الوصف", "نوع موديول المحتوى"]) {
  assert.ok(editor.includes(label), `missing Arabic Feed editor label: ${label}`);
}
for (const staleLabel of ["Show Image", "Show Date", "Show Excerpt", "Feed Type", "Series Link Text"]) {
  assert.equal(editor.includes(staleLabel), false, `stale English Feed editor label: ${staleLabel}`);
}
assert.equal((editor.match(/uncheckedValue="false"/gu) ?? []).length, 3);
assert.ok(editor.includes("FEED_MODULE_PRESENTATION_SUPPORT[feedType]"));
assert.ok(editor.includes("عدد العناصر المعروضة"));
assert.equal(editor.includes("عدد النتائج"), false);
for (const label of ["نطاق المحتوى", "التصنيفات", "السلاسل", "كل السلاسل"]) {
  assert.ok(filters.includes(label), `missing Feed content-scope label: ${label}`);
}
for (const removedCopy of [
  "تصفية حسب التصنيفات",
  "اختر تصنيفًا أو أكثر. عدم اختيار أي تصنيف يعرض كل التصنيفات.",
  "يُحمَّل من Topics Series Admin ضمن التصنيف المختار.",
]) {
  assert.equal(filters.includes(removedCopy), false, `stale Feed filter copy: ${removedCopy}`);
}
assert.ok(filters.includes('name="category_slugs"'));
assert.ok(filters.includes('name="series_slugs"'));
assert.ok(filters.includes("AdminFormSwitch"));
assert.ok(filters.includes("AdminCheckbox"));
assert.equal(filters.includes('type="checkbox"'), false);
assert.ok(filters.includes("lg:grid-cols-4"));
assert.ok(filters.includes("checked={seriesSlugs.length === 0}"));
assert.equal(filters.includes('type="hidden" name="series_slugs"'), false);
assert.equal(filters.includes("AdminFormListboxSelect"), false);
assert.equal(filters.includes('name="category_slug"'), false);

assert.ok(actions.includes('.select("id,config")'));
assert.ok(actions.includes("isPersistedFeedModuleConfigEqual"));
assert.ok(actions.includes("filterSeriesSlugsForCategories"));
assert.ok(actions.includes("if (!feedType)"));
assert.equal(actions.includes('? (feedType as TopicsFeedType) : "latest"'), false);
assert.ok(
  actions.indexOf("isPersistedFeedModuleConfigEqual(coordinated.value.config, config)") <
    actions.indexOf("redirect(withModuleEditorReturnContextFromForm("),
  "saved=1 must follow exact config readback",
);

assert.ok(loader.includes("parseFeedModuleConfig(template.config, template.feed_type)"));
assert.ok(loader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)"));
assert.equal(loader.includes("isPublishedPageBlockStatus"), false);
assert.equal(loader.includes("function isPublishedTemplate"), false);
assert.ok(resolver.includes('.select("id, name, slug, description, status, sort_order, category_id")'));
assert.ok(resolver.includes('subtitle: row.description ?? ""'));
assert.ok(resolver.includes('categoriesQuery = categoriesQuery.in("slug", config.query.categorySlugs)'));
assert.ok(resolver.includes('.eq("topics.status", "published")'));
assert.ok(resolver.includes('.eq("topics.content_type", "article")'));
assert.ok(resolver.includes('.is("topics.deleted_at", null)'));
assert.ok(resolver.includes('categoriesQuery = categoriesQuery.in("topics.series_slug", config.query.seriesSlugs)'));
assert.ok(resolver.includes("count: Math.min(filteredCount, config.query.limit)"));
assert.ok(resolver.includes("categorySlugs: config.query.categorySlugs"));
assert.ok(resolver.includes("seriesSlugs: config.query.seriesSlugs"));
assert.ok(
  publicContentReadOwner.includes(
    'if (input.seriesSlugs.length) next = next.in("series_slug", input.seriesSlugs)',
  ),
  "Public Content Read must apply the Feed seriesSlugs array without a duplicate Feed reader",
);
assert.ok(resolver.includes('query = query.in("category_id", categoryIds)'));
assert.ok(resolver.includes('query = query.in("slug", config.query.seriesSlugs)'));
assert.ok(resolver.includes('if (!name || !slug) return []'));
assert.ok(adminUtilsSource.includes("export function isPageModulePubliclyVisible"));
assert.ok(blockLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)"));
assert.equal(blockLoader.includes("function isPublishedTemplate"), false);
assert.ok(mediaHubLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)"));
assert.equal(mediaHubLoader.includes("isPublishedPageBlockStatus"), false);
assert.ok(mediaSidebarLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)"));
assert.equal(mediaSidebarLoader.includes("isPublishedPageBlockStatus"), false);
assert.ok(
  mediaSidebarResolver.includes(
    'if (!widget.isVisible || !isContentConfig(config))',
  ) &&
    mediaSidebarResolver.indexOf(
      'if (!widget.isVisible || !isContentConfig(config))',
    ) < mediaSidebarResolver.indexOf("loadPublicContentCollection({"),
  "Hidden Media Sidebar assignments must not trigger public content reads",
);
for (const aggregateSource of [heroLoader, blockLoader, loader, mediaHubLoader, mediaSidebarLoader]) {
  assert.ok(
    aggregateSource.includes("sourceStatus === \"error\"") ||
      aggregateSource.includes('sourceStatus: "error"') ||
      aggregateSource.includes("hasCompositionError: true") ||
      aggregateSource.includes('visibility: "error"'),
    "Every Page Composition read family must preserve database failure as error truth",
  );
}
for (const aggregateMember of [
  "heroState.hasAnyAssignmentRows",
  "blockState.hasAnyAssignmentRows",
  "feedState.hasAnyAssignmentRows",
  "mediaHubModules?.hasAnyAssignmentRows",
  "mediaSidebarModules.hasAnyAssignmentRows",
]) {
  assert.ok(
    compositionLoader.includes(aggregateMember),
    `Page Composition aggregate presence is missing ${aggregateMember}`,
  );
}
for (const renderableMember of [
  'heroState.visibility === "visible"',
  "blockState.hasRenderableModules",
  "feedState.modules.length > 0",
  "mediaHubModules?.hasRenderableModules",
  "mediaSidebarModules.hasRenderableModules",
]) {
  assert.ok(
    compositionLoader.includes(renderableMember),
    `Page Composition renderable truth is missing ${renderableMember}`,
  );
}
assert.ok(compositionLoader.includes("assignmentId: heroState.assignmentId"));
assert.ok(compositionLoader.includes('heroState.visibility === "error"'));
assert.ok(heroLoader.includes('HeroSectionVisibility = "visible" | "hidden" | "none" | "error"'));
assert.ok(heroLoader.includes("assignmentId: assignedTemplate.assignmentId"));
assert.ok(adminAssignmentLoader.includes("results.find((result) => result.error)"));
assert.ok(adminAssignmentLoader.includes("Page Composition assignment read failed"));
assert.ok(moduleAssignmentLoader.includes("Module assignment read failed"));
assert.ok(moduleAssignmentLoader.includes("Hero assignment read failed"));
assert.ok(section.includes("showImage={presentation.showImage}"));
assert.ok(section.includes("showDate={presentation.showDate}"));
assert.ok(section.includes("showExcerpt={presentation.showExcerpt}"));
assert.ok(latest.includes("eyebrow={eyebrow ?? undefined}"));
assert.ok(popular.includes("showDate && item.date"));
assert.ok(series.includes("showImage ? ("));
assert.ok(series.includes("showExcerpt && item.subtitle"));
assert.ok(pageLayout.includes("<FeedModuleSection"));
assert.ok(legacyStack.includes("<FeedModuleSection"));

console.log(
  "Feed Module contract integrity proof passed (schema, editor serialization, save/readback, failure paths, and public consumers).",
);
