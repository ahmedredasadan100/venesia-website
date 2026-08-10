import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

import { PGlite } from "@electric-sql/pglite";
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

const adminUtils = loadTranspiledModule("src/lib/page-blocks/admin-utils.ts", {
  "../admin/content/content-status-metadata": {
    getContentStatusMetadata: () => ({}),
  },
});
const feedTypes = loadTranspiledModule("src/lib/feed-modules/types.ts");
const feedConfigContract = loadTranspiledModule(
  "src/lib/feed-modules/parse-feed-config.ts",
  {
    "../page-blocks/admin-utils": adminUtils,
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

function createFeedForm() {
  const formData = new FormData();
  formData.set("widget_title", "أحدث الموضوعات");
  formData.set("limit", "3");
  formData.set("category_slug", "__all__");
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
    query: { limit: "invalid" },
  },
  "latest",
);
assert.equal(legacyConfig.presentation.showImage, false);
assert.equal(legacyConfig.presentation.showDate, true);
assert.equal(legacyConfig.presentation.showExcerpt, false);
assert.equal(legacyConfig.query.limit, 3);
assert.equal(isPersistedFeedModuleConfigEqual(disabledConfig, disabledConfig), true);
assert.equal(
  isPersistedFeedModuleConfigEqual(
    { ...disabledConfig, presentation: { ...disabledConfig.presentation, showImage: "false" } },
    disabledConfig,
  ),
  false,
);

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
assert.ok(filters.includes('label="تصفية حسب التصنيف"'));
assert.ok(filters.includes('label="تصفية حسب السلسلة"'));
assert.equal(filters.includes('label="All"'), false);

assert.ok(actions.includes('.select("id,config")'));
assert.ok(actions.includes("isPersistedFeedModuleConfigEqual"));
assert.ok(actions.includes("if (!feedType)"));
assert.equal(actions.includes('? (feedType as TopicsFeedType) : "latest"'), false);
assert.ok(
  actions.indexOf("isPersistedFeedModuleConfigEqual(coordinated.value.config, config)") <
    actions.indexOf("redirect(`/admin/pages-blocks/blocks/feed/${id}?saved=1"),
  "saved=1 must follow exact config readback",
);

assert.ok(loader.includes("parseFeedModuleConfig(template.config, template.feed_type)"));
assert.ok(resolver.includes('.select("id, name, slug, description, status, sort_order, category_id")'));
assert.ok(resolver.includes('subtitle: row.description ?? ""'));
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
