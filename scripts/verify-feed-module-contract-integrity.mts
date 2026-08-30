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
const isSeriesAllowedForCategories = topicFilterOptionsContract.isSeriesAllowedForCategories as (
  options: Parameters<typeof getSeriesOptionsForCategories>[0],
  categorySlugs: readonly string[],
  seriesSlug: string | null,
) => boolean;

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
assert.equal(
  isSeriesAllowedForCategories(seriesFilterFixture, ["bait-al-watan", "real-estate"], "buying-guide"),
  true,
);
assert.equal(isSeriesAllowedForCategories(seriesFilterFixture, [], "buying-guide"), false);

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
  formData.set("series_slug", "__all__");
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
  /عدد النتائج/u,
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
    if (this.table !== "topic_categories") return { data: [], error: null };
    if (resolverFixture.categoryError) {
      return { data: null, error: resolverFixture.categoryError };
    }

    const rows = this.applyFilters(resolverFixture.categories);
    return {
      data: this.resultLimit === null ? rows : rows.slice(0, this.resultLimit),
      error: null,
    };
  }
}

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
      loadPublicContentCollection: async () => ({ items: [] }),
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

resolverFixture.categories = [
  { id: 1, name: "ØªØµÙ†ÙŠÙ Ø¢Ø®Ø±", slug: "other", status: "published", topics_count: [{ count: 4 }] },
  { id: 2, name: "Ø¨ÙŠØª Ø§Ù„ÙˆØ·Ù†", slug: "bait-al-watan", status: "published", topics_count: [{ count: "260" }] },
];
resolverFixture.categoryFilters = [];
const selectedCategoryPayload = await resolveTopicsFeedModule(
  { feed_type: "categories" },
  {
    ...categoryConfig,
    query: { ...categoryConfig.query, limit: 1, categorySlugs: ["bait-al-watan"] },
  },
);
assert.deepEqual(selectedCategoryPayload, {
  kind: "categories",
  items: [{ name: "Ø¨ÙŠØª Ø§Ù„ÙˆØ·Ù†", href: "/topics?category=bait-al-watan", count: 260 }],
});
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
    query: { ...categoryConfig.query, limit: 2, categorySlugs: ["other", "bait-al-watan"] },
  },
);
assert.deepEqual(multiCategoryPayload.items, [
  { name: "تصنيف آخر", href: "/topics?category=other", count: 4 },
  { name: "بيت الوطن", href: "/topics?category=bait-al-watan", count: 260 },
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
    query: { ...categoryConfig.query, seriesSlug: "hidden-series" },
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
assert.ok(filters.includes("تصفية حسب التصنيفات"));
assert.ok(filters.includes('label="تصفية حسب السلسلة"'));
assert.equal(filters.includes('label="All"'), false);
assert.ok(filters.includes('name="category_slugs"'));
assert.ok(filters.includes("AdminFormSwitch"));
assert.equal(filters.includes('name="category_slug"'), false);

assert.ok(actions.includes('.select("id,config")'));
assert.ok(actions.includes("isPersistedFeedModuleConfigEqual"));
assert.ok(actions.includes("isSeriesAllowedForCategories"));
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
assert.ok(resolver.includes("categorySlugs: config.query.categorySlugs"));
assert.ok(resolver.includes('query = query.in("category_id", categoryIds)'));
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
