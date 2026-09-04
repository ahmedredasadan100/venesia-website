import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const fields = [
  "show_date_on_page",
  "show_category_on_page",
  "show_series_on_page",
  "show_intro_card_on_page",
] as const;

const [
  migration,
  displaySettings,
  articleCreate,
  articleEdit,
  review,
  articleHelpers,
  articleTypes,
  articleValidation,
  batchImport,
  publicLoader,
  publicContentOwner,
  topicsPage,
  featuredCard,
  featuredContract,
  pageBlockConfigs,
  topicCard,
  topicDetail,
  topicTypes,
  architectureManifest,
  mediaEditor,
  mediaHelpers,
  mediaTypes,
  mediaValidation,
  mediaEditRoute,
  mediaPublicTypes,
  mediaAdapter,
  mediaProvider,
  mediaDetailPage,
  mediaDetailArticle,
  mediaSidebarAdapter,
  mediaSidebar,
  mediaRenderConsumers,
] = await Promise.all([
  read("sql/migrations/20260809120000_topic_display_controls_navigation.sql"),
  read("src/components/admin/content/editors/ContentDisplaySettings.tsx"),
  read("src/components/admin/content/editors/ArticleCreateEditor.tsx"),
  read("src/components/admin/content/editors/ArticleEditor.tsx"),
  read("src/components/admin/content-workflow/ContentReviewPanel.tsx"),
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/article-actions/types.ts"),
  read("src/app/admin/content/topics/article-actions/validation.ts"),
  read("src/app/admin/content/topics/article-actions/batch-import.ts"),
  read("src/lib/topics/load-public-topics.ts"),
  read("src/lib/content/public-content-read/owner.ts"),
  read("src/app/(site)/topics/page.tsx"),
  read("src/components/featured/FeaturedContentCard.tsx"),
  read("src/lib/featured-modules/contract.ts"),
  read("src/lib/page-blocks/configs.ts"),
  read("src/components/topics/TopicCard.tsx"),
  read("src/app/(site)/topics/[slug]/page.tsx"),
  read("src/lib/topics/types.ts"),
  read("src/lib/admin/content/content-editor-adoption-manifest.ts"),
  read("src/components/admin/content/editors/media/MediaContentForm.tsx"),
  read("src/app/admin/content/topics/media-actions/helpers.ts"),
  read("src/app/admin/content/topics/media-actions/types.ts"),
  read("src/app/admin/content/topics/media-actions/validation.ts"),
  read("src/app/admin/content/topics/[id]/page.tsx"),
  read("src/lib/media-center/types.ts"),
  read("src/lib/media-center/adapt-topic-row.ts"),
  read("src/lib/media-center/unified-provider.ts"),
  read("src/components/media-center/MediaDetailPage.tsx"),
  read("src/components/media-center/MediaDetailArticle.tsx"),
  read("src/lib/media-sidebar-modules/resolve-widget-items.ts"),
  read("src/components/media-center/MediaSidebar.tsx"),
  Promise.all(
    [
      "../sections/DynamicHeroSection.tsx",
      "MediaCenterHubFeatured.tsx",
      "MediaCenterHubGallery.tsx",
      "MediaCenterHubPress.tsx",
      "MediaCenterHubTimeline.tsx",
      "MediaCenterHubVideos.tsx",
      "MediaContentCard.tsx",
      "RelatedMediaRail.tsx",
    ].map((file) => read(`src/components/media-center/${file}`)),
  ).then((sources) => sources.join("\n")),
]);

check(
  "the existing public.topics source of truth gains four backward-compatible controls",
  fields.every((field) =>
    migration.includes(`${field} boolean not null default true`),
  ) && migration.includes("alter table public.topics"),
);

check(
  "the current shared display owner renders one unconditional seven-field contract",
  architectureManifest.includes(
    'displaySettingsOwner: "src/components/admin/content/editors/ContentDisplaySettings.tsx"',
  ) &&
    fields.every(
      (field) =>
        displaySettings.match(new RegExp(`name="${field}"`, "g"))?.length === 1,
    ) &&
    !displaySettings.includes("topicMetadata") &&
    !architectureManifest.includes("topic_display_controls"),
);

check(
  "Article create and edit adopt the extension from the same owner with visible-safe defaults",
  articleCreate.includes("<ContentDisplaySettings />") &&
    ["showDate", "showCategory", "showSeries", "showIntroCard"].every((field) =>
      articleEdit.includes(`${field}={topic.`),
    ),
);

check(
  "the shared review consumer always reads and reports the complete seven-control contract",
  fields.every((field) => review.includes(`checked(form, "${field}"`)) &&
    review.includes("7 خيارات") &&
    !review.includes("hasTopicMetadataDisplay"),
);

check(
  "all five media Admin types adopt the same seven-field owner and persistence contract",
  ["showDate", "showCategory", "showSeries", "showIntroCard"].every((field) =>
    mediaEditor.includes(`${field}={values?.show_`),
  ) &&
    fields.every(
      (field) =>
        mediaEditor.includes(field) &&
        mediaHelpers.includes(`getBoolean(formData, "${field}")`) &&
        mediaHelpers.includes(`${field}: payload.`) &&
        mediaTypes.includes(`${field}: boolean | null`) &&
        mediaValidation.includes(field) &&
        mediaEditRoute.includes(`${field}: topic.${field}`),
    ) &&
    ["news", "press", "site_update", "video", "gallery"].every((contentType) =>
      architectureManifest.includes(`contentType: "${contentType}"`),
    ),
);

check(
  "the Article persistence adapter reads and writes all four fields without another save owner",
  fields.every(
    (field) =>
      articleHelpers.includes(`getBoolean(formData, "${field}")`) &&
      articleHelpers.includes(`${field}: payload.`) &&
      articleTypes.includes(`${field}?: boolean | null`) &&
      articleValidation.includes(field),
  ),
);

check(
  "the existing SEO batch adapter preserves old visible behavior for the new controls",
  fields.every((field) =>
    batchImport.includes(`setBoolean(formData, "${field}", true)`),
  ),
);

check(
  "the canonical public Topic output defaults legacy rows to visible and carries every control",
  fields.every((field) => publicContentOwner.includes(field)) &&
    [
      "showDateOnPage: item.display.date",
      "showCategoryOnPage: item.display.category",
      "showSeriesOnPage: item.display.series",
      "showIntroCardOnPage: item.display.introCard",
    ].every((token) => publicLoader.includes(token)) &&
    [
      "showDateOnPage",
      "showCategoryOnPage",
      "showSeriesOnPage",
      "showIntroCardOnPage",
    ].every((field) => topicTypes.includes(`${field}?: boolean`)),
);

check(
  "the canonical public Media output carries and visible-defaults the same seven-field contract",
  [
    "showTitleOnPage",
    "showImageOnPage",
    "showExcerptOnPage",
    "showDateOnPage",
    "showCategoryOnPage",
    "showSeriesOnPage",
    "showIntroCardOnPage",
  ].every((field) => mediaPublicTypes.includes(`${field}: boolean`)) &&
    fields.every((field) => publicContentOwner.includes(field)) &&
    ["PUBLIC_CONTENT_COLLECTION_SELECT", "PUBLIC_CONTENT_DETAIL_SELECT"].every(
      (token) => publicContentOwner.includes(token),
    ) &&
    mediaAdapter.includes("item.display.date") &&
    mediaProvider.includes("loadPublicContentCollection"),
);

check(
  "all shared Media detail consumers respect the intro gate and every individual field",
  mediaDetailPage.includes("showTitle={item.showTitleOnPage !== false}") &&
    mediaDetailPage.includes(
      "showHeroImage={item.showImageOnPage !== false}",
    ) &&
    mediaDetailPage.includes(
      "showSubtitle={item.showExcerptOnPage !== false}",
    ) &&
    mediaDetailArticle.includes("{item.showIntroCardOnPage ? (") &&
    [
      "item.showTitleOnPage",
      "item.showImageOnPage",
      "item.showExcerptOnPage",
      "item.showDateOnPage",
      "item.showCategoryOnPage",
      "item.showSeriesOnPage",
    ].every((token) => mediaDetailArticle.includes(token)),
);

check(
  "Media listing hub related and sidebar metadata consumers respect date category and series controls",
  ["showDateOnPage", "showCategoryOnPage", "showSeriesOnPage"].every(
    (field) => mediaRenderConsumers.includes(field),
  ) &&
    mediaSidebarAdapter.includes("resolveContentItemDisplay") &&
    ["date", "category", "series"].every(
      (field) => mediaSidebar.includes(`item.display.${field}`),
    ),
);

const filterOwner = publicContentOwner.slice(
  publicContentOwner.indexOf("function applyPublicFilters"),
  publicContentOwner.indexOf("function buildCollectionQuery"),
);
const featuredItemDisplayResolver = featuredContract.slice(
  featuredContract.indexOf("export function resolveFeaturedItemDisplay("),
  featuredContract.indexOf("export type FeaturedEditorItem"),
);
check(
  "one Unified Content public filter owner applies publication, category, and series contracts",
  filterOwner.includes('.eq("status", "published")') &&
    filterOwner.includes('.in("category_slug", input.categorySlugs)') &&
    filterOwner.includes('.eq("series_slug", input.seriesSlug)') &&
    publicContentOwner.includes("applyPublicFilters(selected, input)"),
);

check(
  "the /topics query, pagination, sort, and cache contract carry the series filter",
  topicsPage.includes("series?: string") &&
    topicsPage.includes("seriesSlug: seriesSlug || undefined") &&
    topicsPage.includes("seriesSlug={seriesSlug}") &&
    publicLoader.includes("seriesSlug?: string") &&
    publicLoader.includes("seriesSlug: params.seriesSlug") &&
    publicContentOwner.includes('.eq("series_slug", input.seriesSlug)'),
);

check(
  "Topic cards keep item visibility while Featured owns current-module item visibility with real taxonomy values",
  [featuredCard, topicCard].every(
    (source) =>
      source.includes("/topics?category=${encodeURIComponent(") &&
      source.includes("/topics?series=${encodeURIComponent("),
  ) &&
    featuredCard.includes("resolveFeaturedItemDisplay(display, item)") &&
    featuredItemDisplayResolver.includes("resolveContentItemDisplay(") &&
    ["title", "image", "excerpt", "date", "category", "series"].every(
      (field) => featuredItemDisplayResolver.includes(`${field}: true`),
    ) &&
    pageBlockConfigs.includes(
      "display[field] && itemDisplay[field] && Boolean(values[field])",
    ) &&
    ["title", "image", "excerpt", "date", "category", "series"].every(
      (field) => featuredContract.includes(`${field}: item.${field}`),
    ) &&
    topicCard.includes("showDateOnPage") &&
    topicCard.includes("showCategoryOnPage") &&
    topicCard.includes("showSeriesOnPage"),
);

check(
  "the Topic detail intro card has one complete visibility gate and respects every item control",
  topicDetail.includes("{topic.showIntroCardOnPage ? (") &&
    topicDetail.includes("topic.showImageOnPage ? (") &&
    topicDetail.includes("topic.showTitleOnPage ? (") &&
    topicDetail.includes("topic.showExcerptOnPage ? (") &&
    topicDetail.includes("topic.showDateOnPage") &&
    topicDetail.includes("topic.showCategoryOnPage") &&
    topicDetail.includes("topic.showSeriesOnPage") &&
    topicDetail.includes(
      "/topics?category=${encodeURIComponent(topic.categorySlug)}",
    ) &&
    topicDetail.includes(
      "/topics?series=${encodeURIComponent(topic.seriesSlug)}",
    ),
);

check(
  "Article body and closed rich-text typography remain outside the display-control delta",
  topicDetail.includes("<RichTextContent") &&
    topicDetail.includes("value={topic.content}") &&
    topicDetail.includes('className="article-rich-text"'),
);

console.log(
  `verify:topic-display-controls-navigation passed (${passed} assertions)`,
);
