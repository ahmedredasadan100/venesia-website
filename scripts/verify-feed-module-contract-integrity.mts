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
  transform: (source: string) => string = (source) => source,
) {
  const source = transform(
    readFileSync(filename, "utf8").replace(/^\uFEFF/u, ""),
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
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
const itemLimitContract = await jiti.import<Record<string, unknown>>(
  "../src/lib/collection-modules/item-limit.ts",
);
const collectionItemLimitMax = Number(
  itemLimitContract.COLLECTION_ITEM_LIMIT_MAX,
);
const feedConfigContract = loadTranspiledModule(
  "src/lib/feed-modules/parse-feed-config.ts",
  {
    "../collection-modules/item-limit": itemLimitContract,
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
enabledForm.append("show_article_title", "false");
enabledForm.append("show_article_title", "true");
enabledForm.set("article_title_bold", "true");
enabledForm.set("article_title_alignment", "center");
enabledForm.append("show_article_date", "false");
enabledForm.append("show_article_date", "true");
enabledForm.set("article_date_bold", "true");
enabledForm.set("article_date_alignment", "left");
enabledForm.append("show_article_excerpt", "false");
enabledForm.append("show_article_excerpt", "true");
enabledForm.set("article_excerpt_bold", "true");
enabledForm.set("article_excerpt_alignment", "right");
const enabledConfig = buildFeedModuleConfig(enabledForm, "latest");
assert.equal(enabledConfig.presentation.showImage, true);
assert.equal(enabledConfig.presentation.showDate, true);
assert.equal(enabledConfig.presentation.showExcerpt, true);
assert.deepEqual(enabledConfig.presentation.articleCard, {
  showTitle: true,
  titleBold: true,
  titleAlignment: "center",
  showExcerpt: true,
  excerptBold: true,
  excerptAlignment: "right",
  showDate: true,
  dateBold: true,
  dateAlignment: "left",
});

const disabledForm = createFeedForm();
disabledForm.set("show_image", "false");
disabledForm.set("show_article_title", "false");
disabledForm.set("show_article_date", "false");
disabledForm.set("show_article_excerpt", "false");
const disabledConfig = buildFeedModuleConfig(disabledForm, "latest");
assert.equal(disabledConfig.presentation.showImage, false);
assert.equal(disabledConfig.presentation.showDate, false);
assert.equal(disabledConfig.presentation.showExcerpt, false);
assert.equal(disabledConfig.presentation.articleCard?.showTitle, false);
assert.equal(disabledConfig.presentation.articleCard?.showDate, false);
assert.equal(disabledConfig.presentation.articleCard?.showExcerpt, false);

const seriesForm = createFeedForm();
seriesForm.set("link_text", "عرض السلسلة");
seriesForm.set("show_image", "false");
seriesForm.set("show_series", "true");
seriesForm.set("series_bold", "false");
seriesForm.set("series_alignment", "center");
seriesForm.set("show_description", "true");
seriesForm.set("description_bold", "true");
seriesForm.set("description_alignment", "left");
seriesForm.set("show_details", "true");
seriesForm.set("details_bold", "true");
seriesForm.set("details_alignment", "right");
const seriesConfig = buildFeedModuleConfig(seriesForm, "series");
assert.equal(seriesConfig.presentation.showImage, false);
assert.equal(seriesConfig.presentation.showDate, false);
assert.equal(seriesConfig.presentation.showExcerpt, true);
assert.equal(seriesConfig.presentation.linkText, "عرض السلسلة");
assert.deepEqual(seriesConfig.presentation.seriesCard, {
  showSeries: true,
  seriesBold: false,
  seriesAlignment: "center",
  showDescription: true,
  descriptionBold: true,
  descriptionAlignment: "left",
  showDetails: true,
  detailsBold: true,
  detailsAlignment: "right",
});

const hiddenSeriesCardForm = createFeedForm();
hiddenSeriesCardForm.set("show_image", "false");
hiddenSeriesCardForm.set("show_series", "false");
hiddenSeriesCardForm.set("show_description", "false");
hiddenSeriesCardForm.set("show_details", "false");
const hiddenSeriesCardConfig = buildFeedModuleConfig(hiddenSeriesCardForm, "series");
assert.equal(hiddenSeriesCardConfig.presentation.showImage, false);
assert.equal(hiddenSeriesCardConfig.presentation.seriesCard?.showSeries, false);
assert.equal(hiddenSeriesCardConfig.presentation.seriesCard?.showDescription, false);
assert.equal(hiddenSeriesCardConfig.presentation.seriesCard?.showDetails, false);

const categoryForm = createFeedForm();
categoryForm.set("show_category", "true");
categoryForm.set("category_bold", "true");
categoryForm.set("category_alignment", "center");
categoryForm.set("show_count", "false");
categoryForm.set("count_bold", "true");
categoryForm.set("count_alignment", "left");
const categoryConfig = buildFeedModuleConfig(categoryForm, "categories");
assert.equal(categoryConfig.presentation.showImage, true);
assert.equal(categoryConfig.presentation.showDate, false);
assert.equal(categoryConfig.presentation.showExcerpt, false);
assert.deepEqual(categoryConfig.presentation.categoryCard, {
  showCategory: true,
  categoryBold: true,
  categoryAlignment: "center",
  showCount: false,
  countBold: true,
  countAlignment: "left",
});

const preservedVariantForm = createFeedForm();
preservedVariantForm.set("show_image", "false");
preservedVariantForm.set("show_article_title", "false");
preservedVariantForm.set("article_title_bold", "true");
preservedVariantForm.set("article_title_alignment", "left");
preservedVariantForm.set("show_article_excerpt", "true");
preservedVariantForm.set("article_excerpt_bold", "true");
preservedVariantForm.set("article_excerpt_alignment", "center");
preservedVariantForm.set("show_article_date", "false");
preservedVariantForm.set("article_date_bold", "true");
preservedVariantForm.set("article_date_alignment", "right");
preservedVariantForm.set("show_category", "false");
preservedVariantForm.set("category_bold", "true");
preservedVariantForm.set("category_alignment", "center");
preservedVariantForm.set("show_count", "true");
preservedVariantForm.set("count_bold", "true");
preservedVariantForm.set("count_alignment", "right");
preservedVariantForm.set("show_series", "true");
preservedVariantForm.set("series_bold", "false");
preservedVariantForm.set("series_alignment", "left");
preservedVariantForm.set("show_description", "true");
preservedVariantForm.set("description_bold", "true");
preservedVariantForm.set("description_alignment", "center");
preservedVariantForm.set("show_details", "false");
preservedVariantForm.set("details_bold", "true");
preservedVariantForm.set("details_alignment", "right");
preservedVariantForm.set("link_text", "نص السلسلة المحفوظ");

const latestVariantConfig = buildFeedModuleConfig(preservedVariantForm, "latest");
const categoryVariantConfig = buildFeedModuleConfig(preservedVariantForm, "categories");
const seriesVariantConfig = buildFeedModuleConfig(preservedVariantForm, "series");
for (const config of [latestVariantConfig, categoryVariantConfig, seriesVariantConfig]) {
  assert.deepEqual(config.presentation.articleCard, latestVariantConfig.presentation.articleCard);
  assert.deepEqual(config.presentation.categoryCard, latestVariantConfig.presentation.categoryCard);
  assert.deepEqual(config.presentation.seriesCard, latestVariantConfig.presentation.seriesCard);
  assert.equal(config.presentation.linkText, "نص السلسلة المحفوظ");
  assert.equal(config.presentation.showImage, false);
}
assert.equal(latestVariantConfig.presentation.showExcerpt, true);
assert.equal(latestVariantConfig.presentation.showDate, false);
assert.equal(categoryVariantConfig.presentation.showExcerpt, false);
assert.equal(categoryVariantConfig.presentation.showDate, false);
assert.equal(seriesVariantConfig.presentation.showExcerpt, true);
assert.equal(seriesVariantConfig.presentation.showDate, false);

const latestConfigReparsedAsSeries = parseFeedModuleConfig(
  latestVariantConfig as unknown as Record<string, unknown>,
  "series",
);
assert.deepEqual(
  latestConfigReparsedAsSeries.presentation.articleCard,
  latestVariantConfig.presentation.articleCard,
);
assert.deepEqual(
  latestConfigReparsedAsSeries.presentation.categoryCard,
  latestVariantConfig.presentation.categoryCard,
);
assert.deepEqual(
  latestConfigReparsedAsSeries.presentation.seriesCard,
  latestVariantConfig.presentation.seriesCard,
);
assert.equal(latestConfigReparsedAsSeries.presentation.showExcerpt, true);

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
const aboveMaximumLimitForm = createFeedForm();
aboveMaximumLimitForm.set("limit", String(collectionItemLimitMax + 1));
assert.throws(
  () => buildFeedModuleConfig(aboveMaximumLimitForm, "latest"),
  /عدد العناصر المعروضة/u,
);
assert.equal(
  parseFeedModuleConfig(
    { query: { limit: collectionItemLimitMax + 1 } },
    "latest",
  ).query.limit,
  collectionItemLimitMax,
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
assert.deepEqual(legacyConfig.presentation.articleCard, {
  showTitle: true,
  titleBold: false,
  titleAlignment: "right",
  showExcerpt: false,
  excerptBold: false,
  excerptAlignment: "right",
  showDate: true,
  dateBold: false,
  dateAlignment: "right",
});
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
const legacySeriesPresentation = parseFeedModuleConfig(
  {
    presentation: {
      title: "سلاسل المحتوى",
      linkText: "عرض كل الموضوعات",
      showImage: true,
      showExcerpt: true,
    },
  },
  "series",
);
assert.equal(legacySeriesPresentation.presentation.seriesCard?.showSeries, true);
assert.equal(legacySeriesPresentation.presentation.seriesCard?.showDescription, true);
assert.equal(legacySeriesPresentation.presentation.seriesCard?.showDetails, true);
assert.equal(legacySeriesPresentation.presentation.seriesCard?.detailsAlignment, "left");
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

  const insertedSeries = await db.query<{ id: number; config: unknown }>(
    "insert into feed_module_templates(feed_type,config) values ($1,$2::jsonb) returning id,config",
    ["series", JSON.stringify(seriesConfig)],
  );
  assert.equal(
    isPersistedFeedModuleConfigEqual(
      insertedSeries.rows[0]?.config,
      seriesConfig,
    ),
    true,
  );
  assert.deepEqual(
    parseFeedModuleConfig(
      insertedSeries.rows[0]?.config as Record<string, unknown>,
      "series",
    ).presentation.seriesCard,
    seriesConfig.presentation.seriesCard,
  );

  const insertedVariantState = await db.query<{ id: number; config: unknown }>(
    "insert into feed_module_templates(feed_type,config) values ($1,$2::jsonb) returning id,config",
    ["latest", JSON.stringify(latestVariantConfig)],
  );
  const variantStateId = Number(insertedVariantState.rows[0]?.id);
  const savedAsCategory = await db.query<{ config: unknown }>(
    "update feed_module_templates set feed_type=$1,config=$2::jsonb where id=$3 returning config",
    ["categories", JSON.stringify(categoryVariantConfig), variantStateId],
  );
  assert.equal(
    isPersistedFeedModuleConfigEqual(savedAsCategory.rows[0]?.config, categoryVariantConfig),
    true,
  );
  assert.deepEqual(
    parseFeedModuleConfig(
      savedAsCategory.rows[0]?.config as Record<string, unknown>,
      "categories",
    ).presentation.seriesCard,
    latestVariantConfig.presentation.seriesCard,
  );
  const savedAsSeries = await db.query<{ config: unknown }>(
    "update feed_module_templates set feed_type=$1,config=$2::jsonb where id=$3 returning config",
    ["series", JSON.stringify(seriesVariantConfig), variantStateId],
  );
  assert.equal(
    isPersistedFeedModuleConfigEqual(savedAsSeries.rows[0]?.config, seriesVariantConfig),
    true,
  );
  assert.deepEqual(
    parseFeedModuleConfig(
      savedAsSeries.rows[0]?.config as Record<string, unknown>,
      "series",
    ).presentation.articleCard,
    latestVariantConfig.presentation.articleCard,
  );
} finally {
  await db.close();
}

type FeedArticleFixture = {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  image: string;
  imageAlt: string;
  href: string;
  category: string;
  series: string;
  viewsCount: number;
};

type FeedCategoryFixture = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

type FeedSeriesFixture = {
  id: number;
  name: string;
  slug: string;
  description: string;
  categoryId: number | null;
  representative: { image: string; imageAlt: string } | null;
};

const publicCollectionInputs: Array<Record<string, unknown>> = [];
const publicFeedCategoryInputs: Array<Record<string, unknown>> = [];
const publicFeedSeriesInputs: Array<Record<string, unknown>> = [];
let publicCollectionItems: FeedArticleFixture[] = [];
let publicFeedCategories: FeedCategoryFixture[] = [];
let publicFeedSeries: FeedSeriesFixture[] = [];
let publicFeedCategoryFailure: Error | null = null;
const resolverContract = loadTranspiledModule(
  "src/lib/feed-modules/resolve-topics-feed.ts",
  {
    "server-only": {},
    "../content/public-content-read/owner": {
      loadPublicContentCollection: async (input: Record<string, unknown>) => {
        publicCollectionInputs.push(input);
        return { items: publicCollectionItems };
      },
      loadPublicContentFeedCategories: async (input: Record<string, unknown>) => {
        publicFeedCategoryInputs.push(input);
        if (publicFeedCategoryFailure) throw publicFeedCategoryFailure;
        return publicFeedCategories;
      },
      loadPublicContentFeedSeries: async (input: Record<string, unknown>) => {
        publicFeedSeriesInputs.push(input);
        return publicFeedSeries;
      },
    },
    "../media/resolve-local-public-image": {
      resolveLocalPublicImage: (value: unknown, fallback: string) =>
        typeof value === "string" && value ? value : fallback,
    },
  },
);
const resolveTopicsFeedModule = resolverContract.resolveTopicsFeedModule as (
  template: { feed_type: TopicsFeedType },
  config: FeedModuleConfig,
  excludeContentIds?: readonly number[],
) => Promise<{
  kind: string;
  items: Array<Record<string, unknown>>;
}>;

publicCollectionInputs.length = 0;
publicCollectionItems = [
  {
    id: 71,
    title: "Latest article",
    excerpt: "Latest excerpt",
    date: "11 September 2026",
    image: "/latest.jpg",
    imageAlt: "Latest authored alt",
    href: "/topics/latest-article",
    category: "Parent category",
    series: "Series 71",
    viewsCount: 17,
  },
];
const latestPayload = await resolveTopicsFeedModule(
  { feed_type: "latest" },
  {
    ...enabledConfig,
    query: {
      ...enabledConfig.query,
      categorySlugs: ["bait-al-watan"],
      seriesSlugs: ["district-guide", "market-updates"],
    },
  },
  [901, 902],
);
assert.deepEqual(publicCollectionInputs.at(-1)?.seriesSlugs, [
  "district-guide",
  "market-updates",
]);
assert.deepEqual(publicCollectionInputs.at(-1)?.categorySlugs, ["bait-al-watan"]);
assert.equal(publicCollectionInputs.at(-1)?.pageSize, enabledConfig.query.limit);
assert.equal(publicCollectionInputs.at(-1)?.sort, "newest");
assert.deepEqual(publicCollectionInputs.at(-1)?.excludeIds, [901, 902]);
assert.deepEqual(latestPayload.items, publicCollectionItems);

publicCollectionItems = [
  {
    id: 81,
    title: "Most viewed",
    excerpt: "First by real views",
    date: "11 September 2026",
    image: "/most-viewed.jpg",
    imageAlt: "Most viewed authored alt",
    href: "/topics/most-viewed",
    category: "Parent category",
    series: "Series 81",
    viewsCount: 900,
  },
  {
    id: 82,
    title: "Second most viewed",
    excerpt: "Second by real views",
    date: "10 September 2026",
    image: "/second-most-viewed.jpg",
    imageAlt: "Second authored alt",
    href: "/topics/second-most-viewed",
    category: "Child category",
    series: "Series 82",
    viewsCount: 450,
  },
];
const popularPayload = await resolveTopicsFeedModule(
  { feed_type: "popular" },
  enabledConfig,
);
assert.equal(publicCollectionInputs.at(-1)?.sort, "most-viewed");
assert.equal("popularOnly" in (publicCollectionInputs.at(-1) ?? {}), false);
assert.deepEqual(
  popularPayload.items.map((item) => [item.id, item.viewsCount]),
  [[81, 900], [82, 450]],
);

publicFeedCategories = [
  { id: 2, name: "بيت الوطن", slug: "bait-al-watan", count: 260 },
];
publicFeedCategoryInputs.length = 0;
const selectedCategoryPayload = await resolveTopicsFeedModule(
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
assert.deepEqual(selectedCategoryPayload, {
  kind: "categories",
  items: [{ name: "بيت الوطن", href: "/topics?category=bait-al-watan", count: 260 }],
});
assert.ok(
  publicFeedCategoryInputs.at(-1)?.limit === 20 &&
    JSON.stringify(publicFeedCategoryInputs.at(-1)?.categorySlugs) ===
      JSON.stringify(["bait-al-watan"]) &&
    JSON.stringify(publicFeedCategoryInputs.at(-1)?.seriesSlugs) ===
      JSON.stringify(["district-guide", "market-updates"]),
  "Category Feed must delegate its full scope to Public Content Read",
);

publicFeedCategoryFailure = new Error("category source failed");
await assert.rejects(
  () => resolveTopicsFeedModule({ feed_type: "categories" }, categoryConfig),
  /category source failed/u,
);
publicFeedCategoryFailure = null;

publicFeedSeries = [
  {
    id: 61,
    name: "Series after sixty",
    slug: "series-61",
    description: "Representative resolved independently",
    categoryId: 2,
    representative: {
      image: "/series-61.jpg",
      imageAlt: "Authored alt for series 61",
    },
  },
  {
    id: 62,
    name: "Series after sixty-two",
    slug: "series-62",
    description: "Second independent representative",
    categoryId: 3,
    representative: {
      image: "/series-62.jpg",
      imageAlt: "Authored alt for series 62",
    },
  },
];
publicFeedSeriesInputs.length = 0;
const seriesPayload = await resolveTopicsFeedModule(
  { feed_type: "series" },
  {
    ...seriesConfig,
    query: {
      ...seriesConfig.query,
      limit: 2,
      categorySlugs: ["parent"],
      seriesSlugs: ["series-61", "series-62"],
    },
  },
);
assert.deepEqual(publicFeedSeriesInputs.at(-1), {
  limit: 2,
  categorySlugs: ["parent"],
  seriesSlugs: ["series-61", "series-62"],
});
assert.deepEqual(
  seriesPayload.items.map((item) => ({
    slug: item.slug,
    image: item.image,
    imageAlt: item.imageAlt,
  })),
  [
    {
      slug: "series-61",
      image: "/series-61.jpg",
      imageAlt: "Authored alt for series 61",
    },
    {
      slug: "series-62",
      image: "/series-62.jpg",
      imageAlt: "Authored alt for series 62",
    },
  ],
);

const latestWidgetContract = loadTranspiledModule(
  "src/components/sidebar-feeds/SidebarLatestArticlesWidget.tsx",
  {
    "next/image": { default: () => null },
    "next/link": { default: () => null },
    "../../hooks/use-auto-carousel": { useAutoCarousel: () => ({}) },
    "../../lib/feed-modules/types": feedTypes,
    "../../lib/page-blocks/configs": pageBlockConfigs,
    "../feed-modules/FeedCarouselDots": { default: () => null },
    "./SidebarFeedPanel": { SidebarFeedPanel: () => null },
  },
  (source) => source.replace(
    "function chunkItems(",
    "export function chunkItems(",
  ),
);
const chunkLatestItems = latestWidgetContract.chunkItems as (
  items: Array<{ id: number }>,
) => Array<Array<{ id: number }>>;
const latestSlides = chunkLatestItems(
  Array.from({ length: 7 }, (_, index) => ({ id: index + 1 })),
);
assert.deepEqual(latestSlides.map((slide) => slide.length), [3, 3, 1]);
assert.deepEqual(
  latestSlides.flat().map((item) => item.id),
  [1, 2, 3, 4, 5, 6, 7],
);

const mediaSidebarContract = loadTranspiledModule(
  "src/components/media-center/MediaSidebar.tsx",
  {
    "next/image": { default: () => null },
    "next/link": { default: () => null },
    "next/navigation": { usePathname: () => "/media-center/news" },
    "../../hooks/use-auto-carousel": { useAutoCarousel: () => ({}) },
    "../../lib/media-sidebar-modules/parse-config": {
      MEDIA_SIDEBAR_DEFAULT_MENU_PARENT: null,
    },
    "../PublicNavigationProvider": { usePublicNavigation: () => ({}) },
    "../feed-modules/FeedCarouselDots": { default: () => null },
    "../sidebar-feeds/SidebarFeedPanel": { SidebarFeedPanel: () => null },
  },
  (source) => source.replace(
    "function chunkSidebarMediaItems(",
    "export function chunkSidebarMediaItems(",
  ),
);
const chunkMediaSidebarItems = mediaSidebarContract.chunkSidebarMediaItems as (
  items: Array<{ id: number }>,
) => Array<Array<{ id: number }>>;
const mediaSidebarSlides = chunkMediaSidebarItems(
  Array.from({ length: 7 }, (_, index) => ({ id: index + 1 })),
);
assert.deepEqual(mediaSidebarSlides.map((slide) => slide.length), [3, 3, 1]);
assert.deepEqual(
  mediaSidebarSlides.flat().map((item) => item.id),
  [1, 2, 3, 4, 5, 6, 7],
);

const mediaHubConfigContract = await jiti.import<Record<string, unknown>>(
  "../src/lib/media-hub-modules/parse-config.ts",
);
const mediaHubDefaults = mediaHubConfigContract.MEDIA_HUB_SECTION_DEFAULTS as Record<
  string,
  { config: Record<string, unknown> }
>;
const mediaHubReads: Array<[string | undefined, number]> = [];
const mediaHubContract = loadTranspiledModule(
  "src/lib/media-hub-modules/resolve-hub-section-data.ts",
  {
    "server-only": {},
    "../media-center": {
      getMediaItems: async (type: string | undefined, limit: number) => {
        mediaHubReads.push([type, limit]);
        return Array.from({ length: limit }, (_, index) => ({ id: index + 1 }));
      },
    },
    "./parse-config": mediaHubConfigContract,
  },
);
const enrichMediaHubModules = mediaHubContract.enrichMediaHubModules as (
  state: Record<string, unknown>,
) => Promise<{
  modules: Array<{
    assignmentId: number;
    sectionData?: { items?: unknown[] } | null;
  }>;
}>;
function mediaHubModule(
  assignmentId: number,
  sectionKey: string,
  itemLimit: number,
  isVisible = true,
) {
  return {
    assignmentId,
    sectionKey,
    slot: "main",
    sortOrder: assignmentId,
    isVisible,
    title: sectionKey,
    templateSlug: `fixture-${sectionKey}-${assignmentId}`,
    config: {
      ...mediaHubDefaults[sectionKey]?.config,
      placement: "hub",
      itemLimit,
    },
  };
}
const enrichedMediaHub = await enrichMediaHubModules({
  modules: [
    mediaHubModule(1, "videos", 7),
    mediaHubModule(2, "videos", 3),
    mediaHubModule(3, "gallery", 5),
    mediaHubModule(4, "press", collectionItemLimitMax, false),
    mediaHubModule(5, "featured", 4),
  ],
  sourceStatus: "database",
  sourceIssues: [],
  hasAnyAssignmentRows: true,
  hasRenderableModules: true,
});
assert.deepEqual(mediaHubReads, [["video", 7], ["gallery", 5]]);
assert.equal(
  enrichedMediaHub.modules.find((module) => module.assignmentId === 1)
    ?.sectionData?.items?.length,
  7,
);
assert.equal(
  enrichedMediaHub.modules.find((module) => module.assignmentId === 2)
    ?.sectionData?.items?.length,
  3,
);
assert.equal(
  enrichedMediaHub.modules.find((module) => module.assignmentId === 3)
    ?.sectionData?.items?.length,
  5,
);

const editor = readFileSync(
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "utf8",
);
const feedConfigSource = readFileSync(
  "src/lib/feed-modules/parse-feed-config.ts",
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
const publicContentReadContract = readFileSync(
  "src/lib/content/public-content-read/contract.ts",
  "utf8",
);
const contentFeedTypes = readFileSync(
  "src/lib/content-feeds/types.ts",
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
const mediaHubDataResolver = readFileSync(
  "src/lib/media-hub-modules/resolve-hub-section-data.ts",
  "utf8",
);
const mediaFacade = readFileSync("src/lib/media-center.ts", "utf8");
const unifiedMediaProvider = readFileSync(
  "src/lib/media-center/unified-provider.ts",
  "utf8",
);
const mediaListingModule = readFileSync(
  "src/components/media-center/MediaListingModule.tsx",
  "utf8",
);
const mediaHubRenderer = readFileSync(
  "src/components/media-center/renderMediaHubSections.tsx",
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
const categories = readFileSync(
  "src/components/sidebar-feeds/SidebarCategoriesWidget.tsx",
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

for (const label of [
  "نوع موديول المحتوى",
  "تنسيق عناصر الـFeed",
  "الصورة",
  "عنوان الموضوع",
  "المقتطف",
  "التاريخ",
  "اسم التصنيف",
  "عدد الموضوعات",
  "اسم السلسلة",
  "الوصف",
  "زر عرض كل الموضوعات",
  "نص زر عرض كل الموضوعات",
]) {
  assert.ok(editor.includes(label), `missing Arabic Feed editor label: ${label}`);
}
assert.ok(editor.includes("FEED_MODULE_DISPLAY_FORMATTING_CAPABILITY.variants[feedType]"));
assert.deepEqual(feedTypes.TOPICS_FEED_TYPES, ["latest", "popular", "categories", "series"]);
assert.ok(editor.includes("value={feedType}"));
assert.ok(editor.includes("setFeedType(nextFeedType as TopicsFeedType)"));
assert.ok(editor.includes('feedType === "latest" || feedType === "popular"'));
assert.ok(editor.includes('feedType === "categories"'));
assert.ok(editor.includes('feedType === "series"'));
assert.ok(editor.includes('showName="show_article_title"'));
assert.ok(editor.includes('showName="show_article_excerpt"'));
assert.ok(editor.includes('showName="show_article_date"'));
assert.ok(editor.includes('showName="show_category"'));
assert.ok(editor.includes('showName="show_count"'));
assert.ok(editor.includes('showName="show_series"'));
assert.ok(editor.includes('showName="show_description"'));
assert.ok(editor.includes('showName="show_details"'));
assert.ok(
  editor.includes('className={isSeriesVariant ? "self-start" : "hidden"}'),
  "Series description formatting must stay compact beside the taller action control",
);
for (const variantVisibility of [
  'className={isArticleVariant ? "" : "hidden"}',
  'className={isCategoryVariant ? "" : "hidden"}',
  'className={isSeriesVariant ? "" : "hidden"}',
]) {
  assert.ok(
    editor.includes(variantVisibility),
    `Feed editor must retain hidden variant state while showing only matching controls: ${variantVisibility}`,
  );
}
for (const persistedCardBuilder of [
  "const articleCard = buildArticleCardPresentation(formData);",
  "const categoryCard = buildCategoryCardPresentation(formData);",
  "const seriesCard = buildSeriesCardPresentation(formData);",
]) {
  assert.ok(
    feedConfigSource.includes(persistedCardBuilder),
    `Feed save must preserve every variant card contract: ${persistedCardBuilder}`,
  );
}
for (const staleLabel of ["Show Image", "Show Date", "Show Excerpt", "Feed Type", "Series Link Text"]) {
  assert.equal(editor.includes(staleLabel), false, `stale English Feed editor label: ${staleLabel}`);
}
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
assert.ok(resolver.includes("loadPublicContentFeedCategories"));
assert.ok(resolver.includes("loadPublicContentFeedSeries"));
assert.equal(resolver.includes("getSupabaseAdmin"), false);
assert.equal(resolver.includes("Math.min"), false);
assert.equal(resolver.includes("catch ("), false);
assert.ok(
  resolver.includes('sort: feedType === "popular" ? "most-viewed" : "newest"'),
  "Most Read must express real view ordering through Public Content Read",
);
assert.equal(
  resolver.includes("popularOnly"),
  false,
  "Most Read must not redefine the editorial is_popular flag",
);
assert.ok(resolver.includes("excludeIds: excludeContentIds"));
assert.ok(resolver.includes("categorySlugs: config.query.categorySlugs"));
assert.ok(resolver.includes("seriesSlugs: config.query.seriesSlugs"));
assert.ok(
  publicContentReadOwner.includes(
    'if (input.seriesSlugs.length) next = next.in("series_slug", input.seriesSlugs)',
  ),
  "Public Content Read must apply the Feed seriesSlugs array without a duplicate Feed reader",
);
assert.ok(
  publicContentReadContract.includes('sort?: "newest" | "oldest" | "most-viewed"') &&
    publicContentReadContract.includes("isPopular: boolean") &&
    publicContentReadContract.includes("viewsCount: number"),
  "Public Content Read keeps editorial popularity separate from real view order",
);
assert.ok(
  publicContentReadOwner.includes('if (input.sort === "most-viewed")') &&
    publicContentReadOwner.includes('.order("views_count", { ascending: false })') &&
    publicContentReadOwner.includes("isPopular: Boolean(row.is_popular)") &&
    publicContentReadOwner.includes("viewsCount: Math.max(0, Number(row.views_count) || 0)"),
  "Most Read orders by views_count while preserving is_popular as authored data",
);
assert.ok(
  publicContentReadOwner.includes("loadPublicContentFeedCategories") &&
    publicContentReadOwner.includes("getCategoryAndDescendantIds") &&
    /\.select\("id",\s*\{\s*count:\s*"exact",\s*head:\s*true\s*\}\)/u.test(
      publicContentReadOwner,
    ) &&
    publicContentReadOwner.includes("count: await countPublicArticlesForCategory("),
  "Category Feed counts the exact public Article total across descendants",
);
assert.ok(
  publicContentReadOwner.includes("loadPublicContentFeedSeries") &&
    publicContentReadOwner.includes("seriesSlug: row.slug") &&
    publicContentReadOwner.includes("pageSize: 1") &&
    !publicContentReadOwner.includes("loadTopicImagesBySeriesSlug"),
  "each Series resolves one representative independently of a global content cap",
);
for (const field of ["id: number", "imageAlt: string", "category: string", "series: string", "viewsCount: number"]) {
  assert.ok(
    contentFeedTypes.includes(field),
    `Feed item contract must retain ${field}`,
  );
}
assert.ok(
  loader.includes("throw new FeedModuleLoadFailure") &&
    loader.includes("return await unstable_cache(") &&
    loader.indexOf("return await unstable_cache(") < loader.indexOf("} catch (error)") &&
    loader.includes("hasCompositionError: true"),
  "Feed source failure is shaped only outside the cache and cannot be cached as Empty",
);
assert.ok(
  compositionLoader.includes("const featuredStatePromise") &&
    compositionLoader.includes("loadFeedModuleStateForPageSlug(") &&
    compositionLoader.includes("module.items.map((item) => item.id)"),
  "Feed reads exclude Featured identities before applying their limit",
);
assert.ok(
  mediaHubRenderer.includes("excludeContentIds={listingContext.excludeContentIds}") &&
    mediaListingModule.includes("excludeIds: searchQuery ? [] : excludeContentIds") &&
    mediaFacade.includes("excludeIds?: readonly number[]") &&
    unifiedMediaProvider.includes("excludeIds: params.excludeIds"),
  "Media Listing delegates Featured exclusion to Public Content Read before pagination",
);
assert.ok(
  mediaHubDataResolver.includes("new Map<MediaContentType, number>()") &&
    mediaHubDataResolver.includes("Math.max(currentLimit, itemLimit)") &&
    mediaHubDataResolver.includes("getMediaItems(type, itemLimit)") &&
    mediaFacade.includes("limit: number") &&
    unifiedMediaProvider.includes("pageSize: limit") &&
    !mediaHubDataResolver.includes("getMediaItems(type)"),
  "Media Hub requests the exact largest visible module limit for each content type",
);
assert.ok(
  mediaSidebarResolver.includes(
    'sort: widget.widgetKey === "popular" ? "most-viewed" : "newest"',
  ) && !mediaSidebarResolver.includes("popularOnly"),
  "Media Sidebar Most Read follows real views without changing editorial popularity",
);
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
  "mediaHubModules.hasAnyAssignmentRows",
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
  "mediaHubModules.hasRenderableModules",
  "mediaSidebarModules.hasRenderableModules",
]) {
  assert.ok(
    compositionLoader.includes(renderableMember),
    `Page Composition renderable truth is missing ${renderableMember}`,
  );
}
assert.ok(
  compositionLoader.includes('mediaHubModules.sourceStatus === "error"'),
  "Route-neutral Media Hub composition must aggregate its non-optional error truth",
);
assert.equal(
  compositionLoader.includes("mediaHubModules?."),
  false,
  "Route-neutral Media Hub composition must not regress to an optional route-gated aggregate",
);
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
assert.ok(section.includes('if (payload.kind === "categories")'));
assert.ok(section.includes("<SidebarCategoriesWidget"));
assert.ok(section.includes('if (payload.kind === "series")'));
assert.ok(section.includes("<SidebarSeriesWidget"));
assert.ok(section.includes('if (feedType === "popular")'));
assert.ok(section.includes("<SidebarMostReadWidget"));
assert.ok(section.includes("<SidebarLatestArticlesWidget"));
assert.equal(
  (section.match(/cardFormatting=\{presentation\.articleCard\}/gu) ?? []).length,
  2,
);
assert.ok(section.includes("cardFormatting={presentation.categoryCard}"));
assert.ok(section.includes("cardFormatting={presentation.seriesCard}"));
assert.ok(latest.includes("eyebrow={eyebrow ?? undefined}"));
for (const articlePresenter of [latest, popular]) {
  assert.ok(articlePresenter.includes("resolvedCardFormatting.showTitle"));
  assert.ok(articlePresenter.includes("resolvedCardFormatting.showDate"));
  assert.ok(articlePresenter.includes("resolvedCardFormatting.showExcerpt"));
  assert.ok(articlePresenter.includes("alt={item.imageAlt}"));
  assert.ok(articlePresenter.includes("pageBlockTextAlignClass"));
  assert.ok(articlePresenter.includes("data-feed-article-title"));
  assert.ok(articlePresenter.includes("data-feed-article-date"));
  assert.ok(articlePresenter.includes("data-feed-article-excerpt"));
}
assert.ok(popular.includes("data-feed-article-views={item.viewsCount}"));
assert.ok(latest.includes("if (!hasRenderableItems) return null"));
assert.ok(categories.includes("resolvedCardFormatting.showCategory"));
assert.ok(categories.includes("resolvedCardFormatting.showCount"));
assert.ok(categories.includes("data-feed-category-name"));
assert.ok(categories.includes("data-feed-category-count"));
assert.ok(series.includes("showImage ? image"));
assert.ok(series.includes("alt={item.imageAlt}"));
assert.ok(series.includes("resolvedCardFormatting.showDescription"));
assert.ok(series.includes("resolvedCardFormatting.showSeries"));
assert.ok(series.includes("resolvedCardFormatting.showDetails"));
assert.ok(series.includes("pageBlockTextAlignClass"));
assert.ok(series.includes('data-feed-series-card=""'));
assert.ok(series.includes('data-feed-series-title=""'));
assert.ok(series.includes('data-feed-series-description=""'));
assert.ok(series.includes('data-feed-series-image-frame=""'));
assert.ok(series.includes('data-feed-series-navigation=""'));
assert.ok(series.includes('data-feed-series-action-bar=""'));
assert.ok(series.includes('data-feed-series-details=""'));
assert.ok(series.includes("!showImage && !hasContent && !showDetails && !canAdvance"));
const seriesImageFrameIndex = series.indexOf('data-feed-series-image-frame=""');
const seriesImageControlsMountIndex = series.indexOf(
  "{carouselControls}",
  seriesImageFrameIndex,
);
const seriesActionBarIndex = series.indexOf('data-feed-series-action-bar=""');
assert.ok(
  seriesImageFrameIndex >= 0 &&
    seriesImageControlsMountIndex > seriesImageFrameIndex &&
    seriesImageControlsMountIndex < seriesActionBarIndex,
  "Series navigation must render over the image before the separate action bar",
);
assert.equal(series.includes("min-h-44"), false);
assert.equal(series.includes("mt-auto"), false);
assert.ok(series.includes("absolute inset-x-0 top-1/2"));
assert.ok(series.includes("translate-x-1/2"));
assert.ok(series.includes("-translate-x-1/2"));
assert.equal(series.includes("group relative overflow-hidden rounded-2xl"), false);
assert.ok(pageLayout.includes("<FeedModuleSection"));
assert.ok(legacyStack.includes("<FeedModuleSection"));

console.log(
  "Feed Module contract integrity proof passed (schema, editor serialization, save/readback, failure paths, and public consumers).",
);
