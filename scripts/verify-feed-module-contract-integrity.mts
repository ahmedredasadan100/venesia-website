import { verifyFeedCardEmptyMedia } from "./fixtures/feed-card-empty-media.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

import { PGlite } from "@electric-sql/pglite";
import { createJiti } from "jiti";
import ts from "typescript";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
const adminFormRuntime = await jiti.import<Record<string, unknown>>(
  "../src/lib/admin/form-runtime.ts",
);
const adminUtils = loadTranspiledModule("src/lib/page-blocks/admin-utils.ts", {
  "../admin/content/content-status-metadata": {
    getContentStatusMetadata: () => ({}),
  },
  "../admin/form-runtime": adminFormRuntime,
  "./module-edit-registry": moduleEditRegistry,
});
const feedTypes = loadTranspiledModule("src/lib/feed-modules/types.ts");
const groupedListContract = loadTranspiledModule(
  "src/components/feed-modules/feed-grouped-list-contract.ts",
);
const presentationLayoutContract = loadTranspiledModule(
  "src/components/feed-modules/feed-presentation-layout.ts",
);
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
const chunkFeedListItems = groupedListContract.chunkFeedListItems as <T>(
  items: readonly T[],
  itemsPerGroup: number,
) => T[][];
const resolveCompactFeedDotIndices = groupedListContract.resolveCompactFeedDotIndices as (
  count: number,
  activeIndex: number,
  maxVisible?: number,
) => number[];
const feedGridColumnsClass = presentationLayoutContract.feedGridColumnsClass as (
  columns: 1 | 2 | 3,
) => string;
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

// Exercise the existing editor's pure filter helpers against the save-owner contract.
const editorFilterHelpers = loadTranspiledModule(
  "src/components/admin/page-blocks/FeedModuleFilterFields.tsx",
  {},
  (source) => {
    const tree = ts.createSourceFile("FeedModuleFilterFields.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = ["getSeriesOptions", "getInitialSeriesSlugs"];
    const declarations = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && Boolean(node.name && names.includes(node.name.text)));
    assert.equal(declarations.length, names.length, "Use both actual editor filter helpers, never a copied filtering implementation");
    return declarations.map(node => node.getText(tree)).join("\n") + "\nexport { getSeriesOptions, getInitialSeriesSlugs };";
  },
);
const editorSeriesOptions = editorFilterHelpers.getSeriesOptions as (
  selectedCategories: readonly string[],
  seriesByCategorySlug: typeof seriesFilterFixture.seriesByCategorySlug,
) => Array<{ id: number; slug: string }>;
const editorInitialSeries = editorFilterHelpers.getInitialSeriesSlugs as (
  config: { query: { categorySlugs: string[]; seriesSlugs: string[] } },
  options: typeof seriesFilterFixture,
) => string[];
for (const selectedCategories of [[], ["bait-al-watan"], ["real-estate"], ["bait-al-watan", "real-estate"], ["missing"], ["real-estate", "bait-al-watan", "real-estate"]]) {
  assert.deepEqual(
    editorSeriesOptions(selectedCategories, seriesFilterFixture.seriesByCategorySlug),
    getSeriesOptionsForCategories(seriesFilterFixture, selectedCategories),
    "Editor category-to-series scope must preserve canonical ordering, ID deduplication and empty/unknown category semantics",
  );
  const selectedSeries = ["buying-guide", "district-guide", "missing"];
  assert.deepEqual(
    editorInitialSeries({ query: { categorySlugs: selectedCategories, seriesSlugs: selectedSeries } }, seriesFilterFixture),
    filterSeriesSlugsForCategories(seriesFilterFixture, selectedCategories, selectedSeries),
    "Editor initial scope must retain only selected series permitted by the save owner",
  );
}
assert.deepEqual(editorInitialSeries({ query: { categorySlugs: ["bait-al-watan"], seriesSlugs: [] } }, seriesFilterFixture), [], "All-series state remains an empty selection");

const checkedStatusForm = new FormData();
checkedStatusForm.append("status", "unpublished");
checkedStatusForm.append("status", "published");
assert.equal(parseFormStatus(checkedStatusForm), "published");

const uncheckedStatusForm = new FormData();
uncheckedStatusForm.append("status", "unpublished");
assert.equal(parseFormStatus(uncheckedStatusForm), "unpublished");

assert.deepEqual(chunkFeedListItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepEqual(resolveCompactFeedDotIndices(9, 0, 5), [0, 1, 2, 3, 4]);
assert.deepEqual(resolveCompactFeedDotIndices(9, 5, 5), [3, 4, 5, 6, 7]);
assert.deepEqual(resolveCompactFeedDotIndices(9, 8, 5), [4, 5, 6, 7, 8]);
assert.ok(feedGridColumnsClass(3).includes("@3xl/slot-module:grid-cols-3"));
assert.ok(feedGridColumnsClass(3).includes("[data-layout-slot=sidebar"));

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
assert.deepEqual(
  enabledConfig.presentation.variants,
  feedTypes.DEFAULT_FEED_PRESENTATION_VARIANTS,
);
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
preservedVariantForm.set("latest_layout", "grid");
preservedVariantForm.set("latest_density", "2");
preservedVariantForm.set("latest_show_arrows", "true");
preservedVariantForm.set("latest_show_dots", "false");
preservedVariantForm.set("latest_list_items_per_group", "4");
preservedVariantForm.set("latest_list_show_dots", "true");
preservedVariantForm.set("latest_list_interval_seconds", "6");
preservedVariantForm.set("popular_layout", "grid");
preservedVariantForm.set("popular_columns", "3");
preservedVariantForm.set("popular_list_items_per_group", "5");
preservedVariantForm.set("popular_list_show_dots", "false");
preservedVariantForm.set("popular_list_interval_seconds", "7");
preservedVariantForm.set("categories_layout", "grid");
preservedVariantForm.set("categories_columns", "2");
preservedVariantForm.set("categories_list_items_per_group", "6");
preservedVariantForm.set("categories_list_show_dots", "true");
preservedVariantForm.set("categories_list_interval_seconds", "9");
preservedVariantForm.set("series_layout", "list");
preservedVariantForm.set("series_columns", "3");
preservedVariantForm.set("series_show_arrows", "false");
preservedVariantForm.set("series_list_items_per_group", "2");
preservedVariantForm.set("series_list_show_dots", "false");
preservedVariantForm.set("series_list_interval_seconds", "12");

const latestVariantConfig = buildFeedModuleConfig(preservedVariantForm, "latest");
const popularVariantConfig = buildFeedModuleConfig(preservedVariantForm, "popular");
const categoryVariantConfig = buildFeedModuleConfig(preservedVariantForm, "categories");
const seriesVariantConfig = buildFeedModuleConfig(preservedVariantForm, "series");
for (const config of [latestVariantConfig, popularVariantConfig, categoryVariantConfig, seriesVariantConfig]) {
  assert.deepEqual(config.presentation.articleCard, latestVariantConfig.presentation.articleCard);
  assert.deepEqual(config.presentation.categoryCard, latestVariantConfig.presentation.categoryCard);
  assert.deepEqual(config.presentation.seriesCard, latestVariantConfig.presentation.seriesCard);
  assert.equal(config.presentation.linkText, "نص السلسلة المحفوظ");
  assert.equal(config.presentation.showImage, false);
  assert.deepEqual(config.presentation.variants, {
    latest: {
      layout: "grid",
      density: 2,
      showArrows: true,
      showDots: false,
      list: { itemsPerGroup: 4, showDots: true, intervalSeconds: 6 },
    },
    popular: {
      layout: "grid",
      columns: 3,
      list: { itemsPerGroup: 5, showDots: false, intervalSeconds: 7 },
    },
    categories: {
      layout: "grid",
      columns: 2,
      list: { itemsPerGroup: 6, showDots: true, intervalSeconds: 9 },
    },
    series: {
      layout: "list",
      columns: 3,
      showArrows: false,
      list: { itemsPerGroup: 2, showDots: false, intervalSeconds: 12 },
    },
  });
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

// Cover every supported layout with boundary capacities while inactive variant drafts remain serialized.
const adoptionLayouts: Record<TopicsFeedType, readonly string[]> = {
  latest: ["slider", "grid", "list"],
  popular: ["grid", "list"],
  categories: ["grid", "list"],
  series: ["slider", "grid", "list"],
};
let adoptionRoundTrips = 0;
for (const feedType of Object.keys(adoptionLayouts) as TopicsFeedType[]) {
  for (const layout of adoptionLayouts[feedType]) {
    for (const limit of [1, 9, collectionItemLimitMax]) {
      const authored = new FormData();
      for (const [name, value] of preservedVariantForm.entries()) authored.append(name, value);
      authored.set("widget_title", "عنوان *حرفي* <tag> &\nفقرة ثانية");
      authored.set("eyebrow", "تمهيد <literal> *علامة*");
      authored.set("link_text", "رابط & نص *حرفي*");
      authored.set("limit", String(limit));
      authored.set(feedType + "_layout", layout);
      authored.append("category_slugs", "bait-al-watan");
      authored.append("series_slugs", "district-guide");
      const built = buildFeedModuleConfig(authored, feedType);
      const reloaded = parseFeedModuleConfig(JSON.parse(JSON.stringify(built)), feedType);
      assert.deepEqual(reloaded, built, feedType + "/" + layout + " must retain exact configuration through serialization and readback");
      assert.equal(reloaded.presentation.variants[feedType].layout, layout);
      assert.equal(reloaded.query.limit, limit);
      assert.deepEqual(reloaded.query.categorySlugs, ["bait-al-watan"]);
      assert.deepEqual(reloaded.query.seriesSlugs, ["district-guide"]);
      assert.equal(reloaded.presentation.title, authored.get("widget_title"));
      assert.equal(reloaded.presentation.eyebrow, authored.get("eyebrow"));
      assert.equal(reloaded.presentation.linkText, authored.get("link_text"));
      for (const inactiveType of Object.keys(adoptionLayouts) as TopicsFeedType[]) {
        if (inactiveType !== feedType) assert.deepEqual(reloaded.presentation.variants[inactiveType], latestVariantConfig.presentation.variants[inactiveType]);
      }
      for (const card of ["articleCard", "categoryCard", "seriesCard"] as const) assert.deepEqual(reloaded.presentation[card], latestVariantConfig.presentation[card]);
      adoptionRoundTrips += 1;
    }
  }
  for (const invalidLimit of ["", "-1", "0", "1.5", "NaN", String(collectionItemLimitMax + 1)]) {
    const invalid = createFeedForm();
    invalid.set("limit", invalidLimit);
    assert.throws(() => buildFeedModuleConfig(invalid, feedType), /عدد العناصر المعروضة/u, feedType + " rejects invalid capacity " + invalidLimit);
  }
  for (const boundary of [1, 3]) {
    const boundaryForm = createFeedForm();
    boundaryForm.set(feedType === "latest" ? "latest_density" : feedType + "_columns", String(boundary));
    boundaryForm.set(feedType + "_list_items_per_group", String(boundary));
    boundaryForm.set(feedType + "_list_interval_seconds", boundary === 1 ? "3" : "60");
    const config = buildFeedModuleConfig(boundaryForm, feedType);
    const variant = config.presentation.variants[feedType];
    assert.equal("density" in variant ? variant.density : variant.columns, boundary);
    assert.equal(variant.list.itemsPerGroup, boundary);
    assert.equal(variant.list.intervalSeconds, boundary === 1 ? 3 : 60);
  }
  const invalidVariantForm = createFeedForm();
  invalidVariantForm.set(feedType + "_layout", "unsupported");
  invalidVariantForm.set(feedType === "latest" ? "latest_density" : feedType + "_columns", "4");
  invalidVariantForm.set(feedType + "_list_items_per_group", "0");
  invalidVariantForm.set(feedType + "_list_interval_seconds", "61");
  const normalized = buildFeedModuleConfig(invalidVariantForm, feedType).presentation.variants[feedType];
  const defaults = (feedTypes.DEFAULT_FEED_PRESENTATION_VARIANTS as FeedModuleConfig["presentation"]["variants"])[feedType];
  assert.equal(normalized.layout, defaults.layout);
  assert.equal("density" in normalized ? normalized.density : normalized.columns, "density" in defaults ? defaults.density : defaults.columns);
  assert.deepEqual(normalized.list, { itemsPerGroup: 3, showDots: true, intervalSeconds: 8 });
}
assert.equal(adoptionRoundTrips, 30);
for (const count of [1, 9, collectionItemLimitMax]) {
  const items = Array.from({ length: count }, (_, index) => index + 1);
  for (const groupSize of [1, 2, 3, collectionItemLimitMax + 1]) {
    const groups = chunkFeedListItems(items, groupSize);
    assert.deepEqual(groups.flat(), items, "Grouped presentation must retain every permitted item in order");
    assert.equal(groups.length, Math.ceil(count / groupSize));
  }
}

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
const productionPartialVariants = parseFeedModuleConfig(
  {
    presentation: {
      title: "Production compatibility",
      variants: {
        latest: {
          layout: "slider",
          density: 3,
          showDots: true,
          showArrows: false,
        },
        series: { layout: "slider", columns: 1, showArrows: true },
        popular: { layout: "grid", columns: 3 },
        categories: { layout: "list", columns: 1 },
      },
    },
    query: { limit: 30 },
  },
  "popular",
);
assert.equal(productionPartialVariants.presentation.variants.popular.layout, "grid");
assert.equal(productionPartialVariants.presentation.variants.popular.columns, 3);
assert.deepEqual(productionPartialVariants.presentation.variants.popular.list, {
  itemsPerGroup: 30,
  showDots: true,
  intervalSeconds: 8,
});
// A pre-existing over-limit row already reads canonically; adoption must not silently raise the shared limit.
const legacyOverLimitRaw = { query: { limit: 94 }, presentation: { title: "تصنيفات قديمة", variants: { categories: { layout: "list", columns: 1 } } } };
const legacyOverLimitRead = parseFeedModuleConfig(legacyOverLimitRaw, "categories");
assert.equal(legacyOverLimitRaw.query.limit, 94, "Reading must not mutate legacy stored data");
assert.equal(legacyOverLimitRead.query.limit, collectionItemLimitMax);
assert.deepEqual(legacyOverLimitRead.presentation.variants.categories.list, { itemsPerGroup: collectionItemLimitMax, showDots: true, intervalSeconds: 8 });
const legacyCanonicalSaveForm = createFeedForm();
legacyCanonicalSaveForm.set("widget_title", legacyOverLimitRead.presentation.title);
legacyCanonicalSaveForm.set("limit", String(legacyOverLimitRead.query.limit));
legacyCanonicalSaveForm.set("categories_layout", legacyOverLimitRead.presentation.variants.categories.layout);
const legacyCanonicalSave = buildFeedModuleConfig(legacyCanonicalSaveForm, "categories");
assert.equal(legacyCanonicalSave.query.limit, collectionItemLimitMax, "Saving the displayed canonical legacy capacity retains the established boundary");
assert.deepEqual(legacyCanonicalSave.presentation.variants.categories.list, legacyOverLimitRead.presentation.variants.categories.list);

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
    "../public/PublicMediaImage": loadTranspiledModule("src/components/public/PublicMediaImage.tsx"),
    "next/link": { default: () => null },
    "../../hooks/use-auto-carousel": { useAutoCarousel: () => ({}) },
    "../../lib/feed-modules/types": feedTypes,
    "../../lib/page-blocks/configs": pageBlockConfigs,
    "../feed-modules/FeedCarouselDots": { default: () => null },
    "../feed-modules/FeedCarouselNavigation": { default: () => null },
    "../feed-modules/FeedGroupedList": { default: () => null },
    "../feed-modules/feed-grouped-list-contract": groupedListContract,
    "../feed-modules/feed-presentation-layout": presentationLayoutContract,
    "./SidebarFeedPanel": { SidebarFeedPanel: () => null },
  },
  (source) => source.replace(
    "function chunkItems(",
    "export function chunkItems(",
  ),
);
const chunkLatestItems = latestWidgetContract.chunkItems as (
  items: Array<{ id: number }>,
  density: 1 | 2 | 3,
) => Array<Array<{ id: number }>>;
const latestSlides = chunkLatestItems(
  Array.from({ length: 7 }, (_, index) => ({ id: index + 1 })),
  3,
);
assert.deepEqual(latestSlides.map((slide) => slide.length), [3, 3, 1]);
assert.deepEqual(
  latestSlides.flat().map((item) => item.id),
  [1, 2, 3, 4, 5, 6, 7],
);

// Execute all ten public branches with the real widgets/grouped-list owner.
// Only external visual shells and the timer hook are probed; layout/timing decisions stay in product code.
type FeedCarouselProbeOptions = { itemCount: number; intervalMs?: number; enabled?: boolean; autoplay?: boolean };
const feedCarouselProbeInputs: FeedCarouselProbeOptions[] = [];
const feedCarouselProbeHook = {
  useAutoCarousel(options: FeedCarouselProbeOptions) {
    feedCarouselProbeInputs.push(options);
    return { activeIndex: 0, canAdvance: options.enabled !== false && options.itemCount > 1, containerRef: { current: null }, swipeHandlers: {}, goTo() {}, goToNext() {}, goToPrevious() {} };
  },
};
const probeDots = { __esModule: true, default: ({ count }: { count: number }) => createElement("nav", { "data-feed-probe-dots": count }) };
const probeNavigation = { __esModule: true, default: () => createElement("nav", { "data-feed-probe-arrows": "" }) };
const groupedListRuntime = loadTranspiledModule("src/components/feed-modules/FeedGroupedList.tsx", {
  "../../hooks/use-auto-carousel": feedCarouselProbeHook,
  "./FeedCarouselDots": probeDots,
  "./feed-grouped-list-contract": groupedListContract,
});
const feedPublicProbeOverrides = {
  "../public/PublicMediaImage": { __esModule: true, default: () => null },
  "next/link": { __esModule: true, default: ({ children, scroll, ...props }: { children?: ReactNode; scroll?: boolean; [name: string]: unknown }) => {
    void scroll;
    return createElement("a", props, children);
  } },
  "../../hooks/use-auto-carousel": feedCarouselProbeHook,
  "../../lib/feed-modules/types": feedTypes,
  "../../lib/page-blocks/configs": pageBlockConfigs,
  "../feed-modules/FeedCarouselDots": probeDots,
  "../feed-modules/FeedCarouselNavigation": probeNavigation,
  "../feed-modules/FeedGroupedList": groupedListRuntime,
  "../feed-modules/feed-grouped-list-contract": groupedListContract,
  "../feed-modules/feed-presentation-layout": presentationLayoutContract,
  "./SidebarFeedPanel": { SidebarFeedPanel: ({ children }: { children?: ReactNode }) => createElement("section", null, children) },
};
const feedPublicProbeFiles: Record<TopicsFeedType, string> = {
  latest: "SidebarLatestArticlesWidget",
  popular: "SidebarMostReadWidget",
  categories: "SidebarCategoriesWidget",
  series: "SidebarSeriesWidget",
};
const feedPublicProbeWidgets = Object.fromEntries(Object.entries(feedPublicProbeFiles).map(([feedType, filename]) => [
  feedType,
  loadTranspiledModule("src/components/sidebar-feeds/" + filename + ".tsx", feedPublicProbeOverrides).default,
])) as Record<TopicsFeedType, ComponentType<Record<string, unknown>>>;
const feedPublicProbeItems = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1, title: "عنوان " + index, name: "تصنيف " + index, subtitle: "وصف " + index,
  excerpt: "مقتطف " + index, date: "2026-10-18", count: 260 + index, viewsCount: 90 - index,
  slug: "item-" + index, href: "/topics/item-" + index, image: "", imageAlt: "",
}));
const feedPublicCardMarkers: Record<TopicsFeedType, string> = {
  latest: 'data-feed-article-card="latest"', popular: 'data-feed-article-card="popular"',
  categories: 'data-feed-category-card=""', series: 'data-feed-series-card=""',
};
let feedPublicRuntimeCases = 0;
for (const feedType of Object.keys(adoptionLayouts) as TopicsFeedType[]) {
  for (const layout of adoptionLayouts[feedType]) {
    for (const seconds of [3, 60]) {
      const authored = createFeedForm();
      authored.set("limit", "9");
      authored.set(feedType + "_layout", layout);
      authored.set(feedType === "latest" ? "latest_density" : feedType + "_columns", "3");
      authored.set(feedType + "_list_items_per_group", "4");
      authored.set(feedType + "_list_interval_seconds", String(seconds));
      authored.set(feedType + "_list_show_dots", String(seconds === 3));
      authored.set(feedType + "_show_dots", String(seconds === 3));
      authored.set(feedType + "_show_arrows", String(seconds === 3));
      const config = parseFeedModuleConfig(JSON.parse(JSON.stringify(buildFeedModuleConfig(authored, feedType))), feedType);
      feedCarouselProbeInputs.length = 0;
      const html = renderToStaticMarkup(createElement(feedPublicProbeWidgets[feedType], {
        items: feedPublicProbeItems, title: config.presentation.title, eyebrow: "", linkText: "التفاصيل", showImage: false,
        presentationVariant: config.presentation.variants[feedType],
      }));
      const context = feedType + "/" + layout + "/" + seconds;
      const visibleItems = layout === "list" ? 4 : layout === "grid" ? 9 : feedType === "latest" ? 3 : 1;
      assert.equal(html.split(feedPublicCardMarkers[feedType]).length - 1, visibleItems, context + " must render the mode's actual visible capacity");
      assert.ok(html.includes('data-feed-presentation="' + layout + '"'), context);
      assert.equal(html.includes("data-feed-probe-dots"), seconds === 3 && (layout === "list" || (feedType === "latest" && layout === "slider")), context + " dots applicability");
      assert.equal(html.includes("data-feed-probe-arrows"), seconds === 3 && layout === "slider", context + " arrows applicability");
      const activeTimers = feedCarouselProbeInputs.filter(options => options.enabled !== false);
      assert.equal(activeTimers.length, layout === "grid" ? 0 : 1, context + " active timer count");
      if (layout === "list") {
        assert.deepEqual(activeTimers[0], { itemCount: 3, intervalMs: seconds * 1000, autoplay: true }, context + " list duration/grouping reaches the canonical carousel hook");
      } else if (layout === "slider") {
        assert.deepEqual(activeTimers[0], { itemCount: feedType === "latest" ? 3 : 9, intervalMs: feedType === "latest" ? 7600 : 8200, enabled: true }, context + " slider retains its existing fixed timing independent of hidden list duration");
      }
      feedPublicRuntimeCases += 1;
    }
  }
}
assert.equal(feedPublicRuntimeCases, 20);
let categoryFormattingRuntimeCases = 0;
for (const layout of adoptionLayouts.categories) {
  for (const showName of [false, true]) {
    for (const showCount of [false, true]) {
      const authored = createFeedForm();
      authored.set("categories_layout", layout);
      authored.set("show_category", String(showName));
      authored.set("show_count", String(showCount));
      authored.set("category_bold", "true");
      authored.set("category_alignment", "center");
      authored.set("count_bold", "true");
      authored.set("count_alignment", "left");
      const config = parseFeedModuleConfig(JSON.parse(JSON.stringify(buildFeedModuleConfig(authored, "categories"))), "categories");
      const html = renderToStaticMarkup(createElement(feedPublicProbeWidgets.categories, {
        items: [feedPublicProbeItems[0]], title: config.presentation.title, eyebrow: "",
        presentationVariant: config.presentation.variants.categories, cardFormatting: config.presentation.categoryCard,
      }));
      assert.equal(html.includes('data-feed-category-name=""'), showName);
      assert.equal(html.includes('data-feed-category-count=""'), showCount);
      if (showName) assert.match(html, /class="font-bold !text-center[^"]*" data-feed-category-name=""/u);
      if (showCount) {
        assert.match(html, /font-bold !text-left[^"]*" data-feed-category-count=""/u);
        assert.ok(html.includes(">260</span>"), "Category topic count is source data, not query limit or group size");
      }
      if (!showName && !showCount) assert.equal(html, "");
      categoryFormattingRuntimeCases += 1;
    }
  }
}
assert.equal(categoryFormattingRuntimeCases, 8);

const mediaSidebarContract = loadTranspiledModule(
  "src/components/media-center/MediaSidebar.tsx",
  {
    "../public/PublicMediaImage": loadTranspiledModule("src/components/public/PublicMediaImage.tsx"),
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
const presentationEditor = readFileSync(
  "src/components/admin/page-blocks/FeedPresentationVariantFields.tsx",
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
const groupedList = readFileSync(
  "src/components/feed-modules/FeedGroupedList.tsx",
  "utf8",
);
const carouselDots = readFileSync(
  "src/components/feed-modules/FeedCarouselDots.tsx",
  "utf8",
);
const carouselNavigation = readFileSync(
  "src/components/feed-modules/FeedCarouselNavigation.tsx",
  "utf8",
);
const presentationLayout = readFileSync(
  "src/components/feed-modules/feed-presentation-layout.ts",
  "utf8",
);
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

// The approved family composition moves section headings into the existing metadata owner.
const feedMetadataOwner = await jiti.import<typeof import("../src/lib/page-composition/module-registry-metadata.ts")>("../src/lib/page-composition/module-registry-metadata.ts");
const feedSections = feedMetadataOwner.MODULE_KIND_METADATA.feed.editorSections!;
const adoptedFeedTabIds = ["content", "text", "presentation", "formatting", "pages"];
for (const [id, label] of [["content", "مصدر المحتوى"], ["text", feedMetadataOwner.MODULE_EDITOR_TAB_LABELS.text], ["presentation", "إعدادات العرض"], ["formatting", "تنسيق عناصر المحتوى"], ["pages", feedMetadataOwner.MODULE_EDITOR_TAB_LABELS.visibility]]) {
  assert.equal(feedSections[id].navigationLabelAr, label);
  const resolveTabId = adminUtils.resolveModuleEditorTabId as (value: string, ids: string[]) => string;
  assert.equal(resolveTabId(id, adoptedFeedTabIds), id);
}
for (const id of ["content", "presentation", "formatting", "pages"]) assert.ok(feedSections[id].sectionHeadingAr && feedSections[id].icon);
for (const id of ["content", "presentation", "formatting"]) assert.ok(feedSections[id].sectionDescriptionAr);
assert.equal(feedSections.text.sectionChrome, "implicit");
assert.equal(feedSections.text.sectionHeadingAr, null);
assert.equal(feedSections.text.sectionDescriptionAr, null);
for (const name of ["Feed محفوظ", "اسم محدّث"]) assert.equal(feedMetadataOwner.getModuleEditorHeaderMetadata("feed", undefined, name)?.titleAr, name);

function feedJsxSurface(source: string) {
  const tree = ts.createSourceFile("Feed.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const tagged = (tag: string) => nodes.filter(node => node.tagName.getText(tree) === tag);
  const attr = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => node.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(tree) === name);
  const value = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => attr(node, name)?.initializer?.getText(tree);
  return { tree, tagged, attr, value };
}
const feedEditorJsx = feedJsxSurface(editor);
assert.equal(feedEditorJsx.tagged("ModuleEditorTabs").length, 1);
const feedTabsInitializer = feedEditorJsx.attr(feedEditorJsx.tagged("ModuleEditorTabs")[0], "tabs")?.initializer;
assert.ok(feedTabsInitializer && ts.isJsxExpression(feedTabsInitializer) && feedTabsInitializer.expression && ts.isArrayLiteralExpression(feedTabsInitializer.expression));
const feedTabs = feedTabsInitializer.expression.elements.map(node => {
  assert.ok(ts.isObjectLiteralExpression(node));
  const id = node.properties.find((prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop) && prop.name.getText(feedEditorJsx.tree) === "id");
  assert.ok(id && ts.isStringLiteral(id.initializer));
  return { id: id.initializer.text, source: node.getText(feedEditorJsx.tree) };
});
assert.deepEqual(feedTabs.map(tab => tab.id), adoptedFeedTabIds);
const feedPanel = (id: string) => feedTabs.find(tab => tab.id === id)!.source;
for (const id of ["content", "presentation", "formatting", "pages"]) assert.ok(feedPanel(id).includes('sectionHeaderPresentation: "control"'));
assert.ok(feedPanel("content").includes('name="feed_type"') && feedPanel("content").includes("<FeedModuleFilterFields"));
assert.equal(feedEditorJsx.tagged("FeedModuleFilterFields").length, 1);
assert.equal(feedEditorJsx.tagged("FeedPresentationVariantFields").length, 1);
assert.ok(feedPanel("presentation").includes("<FeedPresentationVariantFields") && feedPanel("presentation").includes("variants={config.presentation.variants}") && feedPanel("presentation").includes("limit={config.query.limit}") && feedPanel("presentation").includes("maxLimit={COLLECTION_ITEM_LIMIT_MAX}"));
for (const field of ["widget_title", "eyebrow"]) assert.ok(feedPanel("text").includes('name="' + field + '"'));
assert.ok(feedPanel("text").includes("<AdminFormGrid columns={2}>"));
assert.ok(feedPanel("formatting").includes("<AdminFormGrid columns={2}>") && feedPanel("formatting").includes('name="link_text"'));
const feedFormatRows = feedEditorJsx.tagged("ModuleEditorVisibilityAlignRow");
assert.equal(feedFormatRows.length, 11);
assert.deepEqual(feedFormatRows.map(row => feedEditorJsx.value(row, "showName")), ["show_title", "show_eyebrow", "show_image", "show_article_title", "show_article_excerpt", "show_article_date", "show_category", "show_count", "show_series", "show_description", "show_details"].map(name => '"' + name + '"'));
for (const row of feedFormatRows) {
  assert.equal(feedEditorJsx.value(row, "presentation"), '"premium"');
  assert.ok(feedEditorJsx.attr(row, "icon"));
}
const feedImageRow = feedFormatRows.find(row => feedEditorJsx.value(row, "showName") === '"show_image"')!;
assert.equal(feedEditorJsx.value(feedImageRow, "controlMode"), '"visibility-only"');
assert.equal(feedEditorJsx.attr(feedImageRow, "boldName"), undefined);
assert.equal(feedEditorJsx.attr(feedImageRow, "alignmentName"), undefined);
for (const [name, expected] of [["id", "{block.id}"], ["slug", "{block.slug}"], ["description", '{block.description ?? ""}']]) {
  const input = feedEditorJsx.tagged("input").filter(node => feedEditorJsx.value(node, "name") === '"' + name + '"');
  assert.equal(input.length, 1);
  assert.equal(feedEditorJsx.value(input[0], "type"), '"hidden"');
  assert.equal(feedEditorJsx.value(input[0], "value"), expected);
}
const widgetTitle = feedEditorJsx.tagged("input").find(node => feedEditorJsx.value(node, "name") === '"widget_title"')!;
assert.ok(feedEditorJsx.attr(widgetTitle, "required"));
for (const owner of ["ModuleEditorHeader", "ModuleEditorIdentitySection", "ModuleEditorSaveArea", "AdminFormPendingFields", "ModuleEditorPagesTab", "form"]) assert.equal(feedEditorJsx.tagged(owner).length, 1);
assert.equal(feedEditorJsx.value(feedEditorJsx.tagged("form")[0], "action"), "{updateAction}");
assert.equal(feedEditorJsx.value(feedEditorJsx.tagged("ModuleEditorHeader")[0], "entityName"), "{block.name}");
assert.equal(feedEditorJsx.attr(feedEditorJsx.tagged("ModuleEditorHeader")[0], "moduleSlug"), undefined);
const feedPages = feedEditorJsx.tagged("ModuleEditorPagesTab")[0];
assert.equal(feedEditorJsx.value(feedPages, "presentation"), '"premium"');
assert.equal(feedEditorJsx.value(feedPages, "assignmentContext"), "{assignmentContext}");
assert.equal(feedEditorJsx.attr(feedPages, "showUsageBanner"), undefined, "Feed must retain multi-page warning and position details");
const feedSharedPresentation = readFileSync("src/components/admin/page-blocks/ModuleEditorPresentation.tsx", "utf8");
const feedSharedTabs = readFileSync("src/components/admin/ui/AdminModuleTabs.tsx", "utf8");
assert.ok(feedSharedPresentation.includes("showUsageBanner = true") && feedSharedPresentation.includes("assignments={assignmentContext.assignments}"));
assert.ok(feedSharedTabs.includes("hidden={tab.id !== activeId}") && feedSharedTabs.includes("{tab.content}"));
assert.equal(/block\.(?:id|slug)\s*={2,3}|\.module\.css|AdminRichTextEditor|AdminMediaImageField|AdminLinkField/.test(editor), false);
assert.equal(editor.includes("<ModuleEditorSectionHeading"), false, "Metadata owns the source, presentation and item-formatting headers once");
assert.equal(presentationEditor.includes("ModuleEditorSectionHeading"), false, "Presentation tab owns its section header once");
assert.equal(filters.includes('id="feed-content-scope-title"'), false, "The source tab replaces the duplicated local scope heading");

const filterJsx = feedJsxSurface(filters);
assert.equal(filterJsx.tagged("AdminCard").length, 2);
assert.equal(filterJsx.tagged("AdminFormControlHeader").length, 2);
assert.equal(filterJsx.tagged("AdminFormGrid").length, 2);
for (const card of filterJsx.tagged("AdminCard")) assert.equal(filterJsx.value(card, "presentation"), '"premium"');
for (const grid of filterJsx.tagged("AdminFormGrid")) assert.equal(filterJsx.value(grid, "columns"), "{4}");
assert.deepEqual(filterJsx.tagged("AdminFormControlHeader").map(header => filterJsx.value(header, "title")), ['{<span role="heading" aria-level={3}>التصنيفات</span>}', '{<span role="heading" aria-level={3}>السلاسل</span>}']);
for (const header of filterJsx.tagged("AdminFormControlHeader")) {
  assert.equal(filterJsx.value(header, "presentation"), '"leading-icon"');
  assert.ok(filterJsx.attr(header, "icon"));
}
assert.equal(filterJsx.tagged("AdminFormSwitch").length, 1);
assert.equal(filterJsx.tagged("AdminCheckbox").length, 2);
assert.ok(filters.includes('adminChoiceButtonClassName(seriesSlugs.length === 0, "gap-2 focus-within:ring-2') && filters.includes('adminChoiceButtonClassName(selected, "gap-2 focus-within:ring-2'));
assert.ok(filters.includes("onChange={(event) => toggleCategory(category.slug, event.currentTarget.checked)}"));
assert.ok(filters.includes("onChange={(event) => toggleSeries(event.currentTarget.value)}"));
assert.ok(filters.includes("seriesSlugs: current.seriesSlugs.filter((slug) => allowedSeriesSlugs.has(slug))"));
assert.ok(filters.includes("seriesSlugs: []"));
const variantJsx = feedJsxSurface(presentationEditor);
assert.equal(variantJsx.tagged("AdminCard").length, 6, "Each existing setting template owns one premium leaf card");
assert.equal(variantJsx.tagged("AdminFormControlHeader").length, 6, "Every setting card delegates its sole title to the shared header owner");
for (const card of variantJsx.tagged("AdminCard")) assert.equal(variantJsx.value(card, "presentation"), '"premium"');
for (const header of variantJsx.tagged("AdminFormControlHeader")) assert.equal(variantJsx.value(header, "presentation"), '"leading-icon"');
const settingTemplateControls = {
  NumberField: "input",
  DensityField: "AdminFormListboxSelect",
  SwitchField: "AdminFormSwitch",
  LatestFields: "AdminFormListboxSelect",
  StaticFields: "AdminFormListboxSelect",
  SeriesFields: "AdminFormListboxSelect",
} as const;
for (const [templateName, controlTag] of Object.entries(settingTemplateControls)) {
  const declaration = variantJsx.tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === templateName);
  assert.ok(declaration, "Existing setting template retained: " + templateName);
  const template = feedJsxSurface(declaration.getText(variantJsx.tree));
  const cards = template.tagged("AdminCard");
  const headers = template.tagged("AdminFormControlHeader");
  const controls = template.tagged(controlTag);
  assert.equal(cards.length, 1, templateName + " has one leaf card rather than nested surfaces");
  assert.equal(headers.length, 1, templateName + " has one visual title owner");
  assert.equal(controls.length, 1, templateName + " retains its original control");
  assert.equal(template.tagged("AdminFormGrid").length, 0, templateName + " leaves responsive placement to the shared master grid");
  assert.equal(template.tagged("label").length, templateName === "NumberField" ? 1 : 0, templateName + " must not wrap an already-labelled shared control in another label");
  for (const tag of ["h1", "h2", "h3", "h4"]) assert.equal(template.tagged(tag).length, 0, "The tab owns the section heading; setting titles remain label-safe");
  const assertNoDuplicateTitle = (node: ts.Node) => {
    if (ts.isJsxText(node)) assert.equal(node.text.trim(), "", templateName + " must not add a second text title outside the shared header");
    if (ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) && node.expression.text === "label" && ts.isJsxElement(node.parent)) {
      assert.fail(templateName + " duplicates its title outside the header/control label property");
    }
    ts.forEachChild(node, assertNoDuplicateTitle);
  };
  assertNoDuplicateTitle(template.tree);
  if (controlTag === "AdminFormListboxSelect") {
    const label = template.attr(controls[0], "label")?.initializer;
    assert.ok(label && ts.isJsxExpression(label) && label.expression === headers[0], templateName + " passes the single header through the existing accessible label slot");
    assert.equal(template.value(headers[0], "title"), templateName === "DensityField" ? "{label}" : '"النمط"');
  } else if (controlTag === "AdminFormSwitch") {
    const label = template.attr(controls[0], "label")?.initializer;
    assert.ok(label && ts.isJsxExpression(label) && label.expression === headers[0], "Embedded switch owns the single clickable label supplied by the shared header");
    assert.equal(template.value(headers[0], "title"), "{label}");
    assert.ok(template.attr(controls[0], "embedded"));
    assert.equal(template.attr(controls[0], "embedded")?.initializer, undefined, "Feed opts into the existing switch owner without changing its boolean contract");
    assert.equal(template.attr(controls[0], "className"), undefined, "No local switch frame or size override");
    assert.equal(template.attr(controls[0], "surface"), undefined, "Embedded appearance is explicit and leaves legacy surface defaults alone");
    assert.equal(template.value(cards[0], "className"), '"h-full p-3"');
    assert.equal(template.value(template.tagged("span")[0], "aria-hidden"), '"true"', "Helper description remains explicitly referenced without duplicating the switch accessible name");
    assert.equal(template.value(controls[0], "name"), "{name}");
    assert.equal(template.value(controls[0], "defaultChecked"), "{defaultChecked}");
    assert.equal(template.value(controls[0], "uncheckedValue"), '"false"');
    assert.equal(template.value(controls[0], "value"), '"true"');
    assert.equal(template.value(controls[0], "describedBy"), '{description ? `${name}-description` : undefined}');
  } else {
    assert.equal(template.value(headers[0], "title"), "{label}");
    for (const [name, expected] of Object.entries({ name: "{name}", "aria-label": "{label}", type: '"number"', min: "{min}", max: "{max}", defaultValue: "{defaultValue}" })) {
      assert.equal(template.value(controls[0], name), expected, "Number control preserves " + name);
    }
    assert.equal(template.value(controls[0], "aria-describedby"), '{description ? `${name}-description` : undefined}');
  }
  if (templateName === "NumberField" || templateName === "SwitchField") {
    assert.equal(template.tagged("span").length, 1);
    assert.equal(template.value(template.tagged("span")[0], "id"), '{`${name}-description`}', "Description association follows the existing unique field name");
  }
}
const headerPresentationOwner = readFileSync("src/components/admin/ui/AdminForm.tsx", "utf8");
const headerPresentationTree = feedJsxSurface(headerPresentationOwner).tree;
const sharedHeaderDeclaration = headerPresentationTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormControlHeader");
assert.ok(sharedHeaderDeclaration);
assert.equal(feedJsxSurface(sharedHeaderDeclaration.getText(headerPresentationTree)).tagged("label").length, 0, "Shared header stays label-safe when used by native or shared controls");
assert.equal(variantJsx.tagged("AdminFormGrid").length, 1, "All currently applicable controls share one responsive layout owner");
const presentationMasterGrid = variantJsx.tagged("AdminFormGrid")[0];
assert.equal(variantJsx.value(presentationMasterGrid, "columns"), "{3}");
for (let ancestor: ts.Node | undefined = presentationMasterGrid.parent; ancestor; ancestor = ancestor.parent) {
  if (ts.isJsxElement(ancestor)) assert.notEqual(ancestor.openingElement.tagName.getText(variantJsx.tree), "AdminCard", "Do not restore an unnecessary outer card around premium setting cards");
}
const presentationMasterGridSource = presentationMasterGrid.parent.getText(variantJsx.tree);
for (const tag of ["NumberField", "LatestFields", "StaticFields", "SeriesFields"]) assert.ok(presentationMasterGridSource.includes("<" + tag));
assert.ok(presentationMasterGridSource.includes('name="limit"'));
assert.equal(presentationEditor.includes("ModuleEditorField"), false, "Implicit 12-column spans must not create holes in the three-column control grid");
assert.equal(/(?:grid-cols-|col-span-|span=)/u.test(presentationEditor), false, "No parallel grid or inherited span overrides inside the shared control grid");
for (const select of variantJsx.tagged("AdminFormListboxSelect")) assert.equal(variantJsx.value(select, "sizing"), '"full"');
assert.equal(variantJsx.tagged("LatestFields").length, 1);
assert.equal(variantJsx.tagged("StaticFields").length, 2);
assert.equal(variantJsx.tagged("SeriesFields").length, 1);
assert.ok(presentationEditor.includes('className={active ? "contents" : "hidden"}') && presentationEditor.includes("{children}"));
assert.ok(presentationEditor.includes('className={visible ? "contents" : "hidden"}'));
assert.ok(presentationEditor.includes('className={layout !== "list" ? "contents" : "hidden"}'));
assert.ok(presentationEditor.includes('className={layout === "slider" ? "contents" : "hidden"}'));
assert.ok(presentationEditor.includes('className={layout === "grid" ? "contents" : "hidden"}'));
assert.equal(presentationEditor.includes("disabled="), false, "Inactive variants remain mounted and enabled in native FormData");
assert.ok(presentationEditor.includes('uncheckedValue="false"') && presentationEditor.includes('value="true"'));
assert.ok(presentationEditor.includes("min = 1") && presentationEditor.includes("min={3}") && presentationEditor.includes("max={60}") && presentationEditor.includes("max={maxLimit}"));
assert.ok(presentationEditor.includes("[1, 2, 3].map"));

for (const label of [
  "نوع موديول المحتوى",
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
assert.ok(editor.includes("<FeedPresentationVariantFields"));
for (const label of [
  "عدد العناصر المعروضة",
  "عدد العناصر في المجموعة",
  "مدة الانتقال بالثواني",
  "إظهار مؤشرات التنقل",
  "عدد الكروت الظاهرة",
  "عدد أعمدة الشبكة",
  "إظهار الأسهم",
  "إظهار النقاط",
]) {
  assert.ok(
    presentationEditor.includes(label),
    `missing Feed presentation editor label: ${label}`,
  );
}
for (const feedType of ["latest", "popular", "categories", "series"]) {
  assert.ok(
    presentationEditor.includes(`feedType="${feedType}"`) ||
      presentationEditor.includes(`feedType={feedType}`),
    `missing Feed presentation panel: ${feedType}`,
  );
}
assert.ok(presentationEditor.includes("data-feed-presentation-controls-active"));
assert.ok(feedConfigSource.includes("buildFeedPresentationVariants(formData, limit)"));
assert.ok(feedConfigSource.includes("parseFeedPresentationVariants(presentationRaw, limit)"));
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
assert.ok(presentationEditor.includes("عدد العناصر المعروضة"));
assert.equal(editor.includes("عدد النتائج"), false);
for (const label of ["التصنيفات", "السلاسل", "كل السلاسل"]) {
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
assert.equal(filters.includes("lg:grid-cols-4"), false, "The canonical AdminFormGrid columns=4 owns filter responsiveness");
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
  "create saved=1 must follow exact config readback",
);
const feedUpdate = actions.slice(actions.indexOf("export async function updateFeedModule"));
assert.ok(feedUpdate.replace(/\s+/gu, "").includes('saveModuleTemplateWithPageAssignments("feed"'));
assert.equal(feedUpdate.includes("isPersistedFeedModuleConfigEqual"), false, "update readback mismatch must fail inside PostgreSQL before commit");
const atomicMigration = readFileSync(path.join(process.cwd(), "sql/migrations/20260912224809_shared_composition_menu_atomic_completion.sql"), "utf8");
assert.ok(atomicMigration.includes("v_saved_template->'config' is distinct from p_payload->'template'->'config'"));
assert.ok(atomicMigration.indexOf("message='template_saved_config_mismatch'") < atomicMigration.lastIndexOf("delete from public.%I where template_id=$1"));

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
    publicContentReadOwner.includes('.rpc("public_feed_category_counts"') &&
    publicContentReadOwner.includes("p_categories: requested") &&
    publicContentReadOwner.includes("p_series_slugs: input.seriesSlugs") &&
    !publicContentReadOwner.includes("countPublicArticlesForCategory"),
  "Category Feed uses one grouped owner read for exact descendant counts",
);
assert.ok(
  publicContentReadOwner.includes("loadPublicContentFeedSeries") &&
    publicContentReadOwner.includes('.rpc("public_feed_series_representatives"') &&
    publicContentReadOwner.includes("p_series_slugs: data.map((row) => row.slug)") &&
    !publicContentReadOwner.includes("pageSize: 1") &&
    !publicContentReadOwner.includes("loadTopicImagesBySeriesSlug"),
  "Series Feed uses one grouped owner read for latest representatives",
);
for (const field of ["id: number", "imageAlt: string", "category: string", "series: string", "viewsCount: number"]) {
  assert.ok(
    contentFeedTypes.includes(field),
    `Feed item contract must retain ${field}`,
  );
}
assert.ok(
  loader.includes("throw new FeedModuleLoadFailure") &&
    loader.includes("return await cachePublicRead(") &&
    loader.indexOf("return await cachePublicRead(") < loader.indexOf("} catch (error)") &&
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
for (const variant of ["latest", "popular", "categories", "series"]) {
  assert.ok(
    section.includes(`presentationVariant={presentation.variants.${variant}}`),
    `Feed public adoption is missing presentation variant: ${variant}`,
  );
}
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
assert.ok(series.includes("const image = showImage ?"));
assert.ok(series.includes("alt={item.imageAlt}"));
assert.ok(series.includes("formatting.showDescription"));
assert.ok(series.includes("formatting.showSeries"));
assert.ok(series.includes("formatting.showDetails"));
assert.ok(series.includes("pageBlockTextAlignClass"));
assert.ok(series.includes('data-feed-series-card=""'));
assert.ok(series.includes('data-feed-series-title=""'));
assert.ok(series.includes('data-feed-series-description=""'));
assert.ok(series.includes('data-feed-series-image-frame=""'));
assert.ok(series.includes('data-feed-series-navigation=""'));
assert.ok(series.includes('data-feed-series-action-bar=""'));
assert.ok(series.includes('data-feed-series-details=""'));
assert.ok(series.includes("!showImage && !hasContent && !showDetails && !navigation"));
const seriesImageFrameIndex = series.indexOf('data-feed-series-image-frame=""');
const seriesImageControlsMountIndex = series.indexOf(
  "{navigation}",
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
assert.ok(carouselNavigation.includes("absolute inset-x-0 top-1/2"));
assert.ok(carouselNavigation.includes("translate-x-1/2"));
assert.ok(carouselNavigation.includes("-translate-x-1/2"));
assert.equal(series.includes("group relative overflow-hidden rounded-2xl"), false);
assert.ok(latest.includes('data-feed-presentation="slider"'));
assert.ok(latest.includes('data-feed-presentation="grid"'));
assert.ok(popular.includes('data-feed-presentation="grid"'));
assert.ok(categories.includes('data-feed-presentation="grid"'));
assert.ok(series.includes('data-feed-presentation="slider"'));
assert.ok(series.includes('data-feed-presentation="grid"'));
assert.ok(groupedList.includes('data-feed-presentation="list"'));
assert.ok(groupedList.includes("intervalSeconds * 1000"));
assert.ok(groupedList.includes("FEED_MAX_VISIBLE_DOTS"));
assert.ok(carouselDots.includes("resolveCompactFeedDotIndices"));
assert.ok(presentationLayout.includes("@container/slot-module") === false);
assert.ok(presentationLayout.includes("[data-layout-slot=sidebar"));
assert.ok(pageLayout.includes("<FeedModuleSection"));
assert.ok(legacyStack.includes("<FeedModuleSection"));

console.log(
  "Feed Module contract integrity proof passed (schema, editor serialization, save/readback, failure paths, and public consumers).",
);

await verifyFeedCardEmptyMedia();
