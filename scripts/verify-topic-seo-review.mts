import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const moduleLoader = require("node:module") as {
  _load(request: string, parent: NodeModule | null, isMain: boolean): unknown;
};
const loadModule = moduleLoader._load;
moduleLoader._load = (request, parent, isMain) =>
  request === "server-only" ? {} : loadModule(request, parent, isMain);

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  (module as NodeModule & { _compile(source: string, filename: string): void })._compile(output, filename);
};

const { getGlobalSeoDefaults } = require("../src/lib/seo/global-seo-defaults.ts") as typeof import("../src/lib/seo/global-seo-defaults.ts");
const { resolveSeoMetadata } = require("../src/lib/seo/resolve-seo-metadata.ts") as typeof import("../src/lib/seo/resolve-seo-metadata.ts");
const { buildMetadataFromResolved } = require("../src/lib/seo/build-metadata-from-resolved.ts") as typeof import("../src/lib/seo/build-metadata-from-resolved.ts");
const { buildTopicPublishChecklist } = require("../src/lib/admin/content-workflow/topic-publish-validation.ts") as typeof import("../src/lib/admin/content-workflow/topic-publish-validation.ts");
const { getPayload, buildTopicWritePayload } = require("../src/app/admin/content/topics/article-actions/helpers.ts") as typeof import("../src/app/admin/content/topics/article-actions/helpers.ts");

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
const validation = read("src/app/admin/content/topics/article-actions/validation.ts");
const seoPanel = read("src/components/admin/SeoPanel.tsx");
const navigation = read("src/components/admin/page-blocks/AdminModuleTabs.tsx");
const correctionButton = read("src/components/admin/content/editors/article/TopicCorrectionButton.tsx");
const publishingOptions = read("src/components/admin/content/editors/article/TopicPublishingOptions.tsx");
const publishingDateField = read("src/components/admin/content/editors/article/TopicDateLabelField.tsx");
const formSwitch = read("src/components/admin/content/editors/article/TopicFormSwitch.tsx");
const sharedFormSwitch = read("src/components/admin/ui/AdminFormSwitch.tsx");
const displaySettings = read("src/components/admin/content/editors/article/TopicDisplaySettings.tsx");
const review = read("src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const previewCapability = read("src/lib/admin/interaction-system/entity-preview-capability.ts");
const contentPreviewCapability = read("src/lib/admin/content/entity-preview-capabilities.ts");
const previewActions = read("src/components/admin/ui/AdminEntityPreviewActions.tsx");
const publicLoader = read("src/lib/topics/load-public-topics.ts");
const publicPage = read("src/app/(site)/topics/[slug]/page.tsx");
const newMigration = read("sql/migrations/20260722120000_topics_seo_overrides.sql");
const lockedMigration = read("sql/migrations/20260721143000_topics_page_display_settings.sql");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function visibleJsxText(source: string) {
  return source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const global = {
  ...getGlobalSeoDefaults(),
  siteName: "Global Site",
  defaultTitle: "Global fallback title",
  defaultDescription: "Global fallback description",
  defaultOgImage: "/images/global-og.jpg",
  defaultOgImageAlt: "Global OG image",
  defaultTwitterImage: "/images/global-twitter.jpg",
  defaultRobotsIndex: true,
  defaultRobotsFollow: true,
  siteUrl: "https://global.example",
  canonicalBaseUrl: "https://global.example",
};

const topicResolved = resolveSeoMetadata(
  {
    path: "/topics/topic-slug",
    entitySeo: {
      title: "Topic SEO title",
      description: "Topic SEO description",
      canonical: "https://canonical.example/topic",
      robotsIndex: false,
      robotsFollow: false,
      image: "/images/topic-og.jpg",
      imageAlt: "Topic OG image",
    },
    type: "article",
  },
  global,
);
const topicMetadata = buildMetadataFromResolved(topicResolved);

check("topic canonical override resolves and reaches Metadata", topicResolved.canonical === "https://canonical.example/topic" && topicMetadata.alternates?.canonical === "https://canonical.example/topic");
check("topic noindex override resolves and reaches Metadata", topicResolved.robots.index === false && typeof topicMetadata.robots === "object" && topicMetadata.robots?.index === false);
check("topic nofollow override resolves and reaches Metadata", topicResolved.robots.follow === false && typeof topicMetadata.robots === "object" && topicMetadata.robots?.follow === false);
check("topic SEO title and description drive public metadata", topicMetadata.title === "Topic SEO title" && topicMetadata.description === "Topic SEO description");
check("topic image drives Open Graph override", topicResolved.image === "/images/topic-og.jpg" && topicMetadata.openGraph?.title === "Topic SEO title");

const fallbackResolved = resolveSeoMetadata(
  {
    path: "/topics/fallback-topic",
    entitySeo: {
      canonical: null,
      robotsIndex: null,
      robotsFollow: null,
      image: null,
    },
  },
  global,
);
const fallbackMetadata = buildMetadataFromResolved(fallbackResolved);

check("missing canonical override uses generated topic URL", fallbackResolved.canonical === "https://global.example/topics/fallback-topic" && fallbackMetadata.alternates?.canonical === fallbackResolved.canonical);
check("missing robots overrides inherit global index/follow", fallbackResolved.robots.index === true && fallbackResolved.robots.follow === true);
check("missing topic SEO values use global title/description/image fallbacks", fallbackResolved.title === global.defaultTitle && fallbackResolved.description === global.defaultDescription && fallbackResolved.image === global.defaultOgImage);

const overrideForm = new FormData();
overrideForm.set("title", "SEO persistence topic");
overrideForm.set("slug", "seo-persistence-topic");
overrideForm.set("category_slug", "qa-category");
overrideForm.set("canonical_url", "https://canonical.example/persisted-topic");
overrideForm.set("robots_index", "false");
overrideForm.set("robots_follow", "true");
const overridePayload = getPayload(overrideForm);
const overrideWrite = buildTopicWritePayload(
  overridePayload,
  { id: 1, name: "QA category", slug: "qa-category" },
  null,
  "draft",
  "2026-07-22T12:00:00.000Z",
  null,
);
check("form parsing and write payload preserve noindex/follow exactly", overridePayload.robotsIndex === false && overridePayload.robotsFollow === true && overrideWrite.robots_index === false && overrideWrite.robots_follow === true);
check("form parsing and write payload preserve canonical exactly", overridePayload.canonicalUrl === "https://canonical.example/persisted-topic" && overrideWrite.canonical_url === overridePayload.canonicalUrl);

const inheritPayload = getPayload(new FormData());
check("omitted robots overrides persist as inherit null", inheritPayload.robotsIndex === null && inheritPayload.robotsFollow === null);

for (const field of ["canonical_url", "robots_index", "robots_follow"]) {
  check(`${field} is added only by the new migration`, newMigration.includes(`add column if not exists ${field}`) && !lockedMigration.includes(field));
  check(`${field} is selected for edit/duplicate retrieval`, validation.match(new RegExp(field, "g"))?.length === 2);
  check(`${field} is mapped into the topic write payload`, helpers.includes(`${field}: payload.`));
  check(`${field} reaches the public topic model`, publicLoader.includes(field));
}
check("robots parser preserves true, false, and inherit null", helpers.includes('if (value === "true") return true') && helpers.includes('if (value === "false") return false') && helpers.includes("return null"));
check("canonical and robots UI offer per-topic override plus global inheritance", seoPanel.includes('name="canonical_url"') && seoPanel.includes('name="robots_index"') && seoPanel.includes('name="robots_follow"') && seoPanel.includes("استخدام الإعداد العام"));
check("edit retrieval hydrates canonical and robots controls", editEditor.includes("canonicalUrl={topic.canonical_url") && editEditor.includes("robotsIndex={topic.robots_index") && editEditor.includes("robotsFollow={topic.robots_follow"));
check("public topic metadata consumes canonical and robots overrides", publicPage.includes("canonical: topic.canonicalUrl") && publicPage.includes("robotsIndex: topic.robotsIndex") && publicPage.includes("robotsFollow: topic.robotsFollow"));
check("Open Graph uses the real topic image only and can fall back globally", publicPage.includes("image: topic.metadataImage || undefined") && !publicPage.includes("image: topic.image,\n    imageAlt"));

check("correction button is non-submitting and dispatches current tab event", correctionButton.includes('type="button"') && correctionButton.includes("navigateTopicEditor") && !correctionButton.includes("window.location"));
check("tab navigation accepts tab and target without reload", navigation.includes("AdminModuleNavigationDetail") && navigation.includes("setActiveId(tabId)") && navigation.includes("scrollIntoView") && navigation.includes("focus({ preventScroll: true })") && !navigation.includes("location.reload"));
check("SEO issues have explicit correction targets", seoPanel.includes("SEO_CORRECTION_TARGETS") && seoPanel.includes('targetId: "topic-seo-title"') && seoPanel.includes('targetId: "topic-content-markdown"') && seoPanel.includes('targetId: "topic-image-alt"'));
check("review issues map to basic, FAQ, and SEO targets", review.includes("CHECKLIST_CORRECTION_TARGETS") && review.includes('tabId: "basic"') && review.includes('tabId: "faq"') && review.includes('tabId: "seo"'));

check("topic switches are a thin adapter over the one shared switch DOM contract", formSwitch.match(/<AdminFormSwitch\b/g)?.length === 1 && !formSwitch.includes("<input") && !formSwitch.includes('role="switch"') && ["id={id}", "name={name}", "label={label}", "defaultChecked={defaultChecked}", "surface={surface}", "disabled={disabled}"].every((marker) => formSwitch.includes(marker)) && formSwitch.includes("ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME"));
check("the shared switch alone owns checkbox and controlled or uncontrolled semantics", sharedFormSwitch.match(/<input\b/g)?.length === 1 && ["id={id}", 'type="checkbox"', 'role="switch"', "name={name}", "defaultChecked={checked === undefined ? defaultChecked : undefined}", "checked={checked}", "onChange={onChange}", "disabled={disabled}", "value={value}", "aria-describedby={describedBy}"].every((marker) => sharedFormSwitch.includes(marker)));
check("publishing and display switches preserve field parity through TopicFormSwitch", !publishingOptions.includes("<AdminFormSwitch") && !displaySettings.includes("<AdminFormSwitch") && ["is_featured", "is_popular", "is_published"].every((name) => publishingOptions.includes(`name="${name}"`)) && /<TopicFormSwitch[\s\S]*?id="topic-published-switch"[\s\S]*?name="is_published"/.test(publishingOptions) && !publishingOptions.includes('<div id="topic-published-switch"') && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.includes(`name="${name}"`)));
check("publishing actions keep four balanced responsive controls", publishingOptions.includes("data-topic-publishing-actions-row") && publishingOptions.includes("sm:grid-cols-2") && publishingOptions.includes("xl:grid-cols-4") && publishingOptions.includes('name="is_featured"') && publishingOptions.includes('name="is_popular"') && publishingOptions.includes('name="is_published"') && publishingOptions.includes("TopicDateLabelField"));
const dateLabelTrigger = publishingDateField.match(/<button\b(?=[^>]*data-topic-date-picker-trigger="label")[\s\S]*?<\/button>/)?.[0] ?? "";
const dateInputMarkerIndex = publishingDateField.indexOf('data-topic-date-picker-input=""');
const dateInputStart = publishingDateField.lastIndexOf("<input", dateInputMarkerIndex);
const dateInputEnd = publishingDateField.indexOf("/>", dateInputMarkerIndex);
const dateInput = dateInputMarkerIndex >= 0 && dateInputStart >= 0 && dateInputEnd >= 0
  ? publishingDateField.slice(dateInputStart, dateInputEnd + 2)
  : "";
const dateLabelVisibleText = visibleJsxText(dateLabelTrigger);
check("publishing date exposes one visible label trigger with a shared icon marker", dateLabelTrigger.includes('data-topic-date-picker-trigger="label"') && dateLabelTrigger.includes('data-topic-date-picker-icon=""') && dateLabelTrigger.includes("onClick={openCalendar}") && dateLabelVisibleText.includes("تاريخ النشر") && !dateLabelVisibleText.includes("فتح التقويم"));
check("publishing date input keeps its native picker without changing its submitted name", dateInput.includes('id="topic-published-at"') && dateInput.includes('data-topic-date-picker-input=""') && dateInput.includes('type="date"') && dateInput.includes('name="published_at"') && !dateInput.includes("onClick={openCalendar}") && publishingDateField.includes("input.click()") && publishingDateField.match(/name="published_at"/g)?.length === 1);
check("publishing date preserves saved and fallback date semantics", publishingDateField.includes("openCalendar") && publishingDateField.includes("publishedDateValue") && publishingDateField.includes("defaultIsDate") && publishingDateField.includes("getTodayInputValue()") && publishingDateField.includes('name="date_label"') && !publishingDateField.includes("التاريخ المعروض للزائر"));
check("legacy publication label is preserved by a hidden field without manual label UI", publishingDateField.includes("preservedLegacyLabel") && publishingDateField.includes('<input type="hidden" name="date_label" value={preservedLegacyLabel} />') && !publishingDateField.includes("data-topic-publish-label-field") && !publishingDateField.includes("setManualLabel"));
check("topic preview actions use the shared capability resolver and renderer", previewCapability.includes("export type AdminEntityPreviewCapability") && previewCapability.includes("export function resolveAdminEntityPreviewActions") && contentPreviewCapability.includes("export function buildAdminContentPreviewCapability") && previewActions.includes("resolveAdminEntityPreviewActions") && previewActions.includes("capability"));
check("edit preview actions render outside the form and publishing options contain no preview transport", editEditor.includes("<AdminEntityPreviewActions capability={previewCapability}") && editEditor.indexOf("<AdminEntityPreviewActions capability={previewCapability}") < editEditor.indexOf("<AdminFormRuntime") && ["next/link", "topicId", "slug", "data-topic-preview-links", "/preview", "/topics/", "previewLinkClassName"].every((marker) => !publishingOptions.includes(marker)));
check("create and edit use one shared Save action with no parallel SaveBar", [createEditor, editEditor].every((source) => source.includes("<AdminFormRuntime") && source.includes("action={saveTopicForm}") && source.match(/<AdminFormActions\s*\/>/g)?.length === 1 && !source.includes("SaveBar")));
check("publishing actions render before review in create and edit", [createEditor, editEditor].every((source) => source.indexOf("<TopicPublishingOptions") < source.indexOf("<TopicPublishChecklistPanel")));
check("review uses three desktop columns", review.includes("data-topic-publish-review-grid") && review.includes("xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"));
check("mobile DOM order is blockers, tasks, improvements, summary", review.indexOf("data-topic-publish-blockers") < review.indexOf("data-topic-publishing-tasks") && review.indexOf("data-topic-publishing-tasks") < review.indexOf("data-topic-publish-improvements") && review.indexOf("data-topic-publish-improvements") < review.indexOf("data-topic-publish-summary"));
check("summary uses real topic metrics", ["نوع المحتوى", "حالة النشر", "التصنيف", "السلسلة", "عدد الكلمات", "تاريخ النشر", "حالة SEO", "الأسئلة الشائعة"].every((label) => review.includes(label)) && review.includes("words(input.content)") && review.includes("faqCount"));
check("publishing tasks do not repeat blocker hints verbatim", review.includes("راجع التنبيهات") && review.includes("TaskRows") && !review.includes("<TaskRows items={blockers}"));

const checklist = buildTopicPublishChecklist({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image: "",
  imageAlt: "",
  categorySlug: "",
  seoTitle: "",
  seoDescription: "",
  focusKeyword: "",
  faq: [],
});
const checklistById = new Map(checklist.map((item) => [item.id, item.status]));
check("publish checklist required-field rules remain active", checklistById.get("title") === "fail" && checklistById.get("slug") === "fail" && checklistById.get("category") === "fail" && checklistById.get("image") === "fail");
check("publish checklist SEO rules remain active", checklistById.get("seo-title") === "fail" && checklistById.get("seo-description") === "fail" && checklistById.get("focus-keyword") === "fail");
check("publish checklist optional recommendation rules remain active", checklistById.get("faq") === "info" && checklistById.get("internal-links") === "info");

console.log(`verify:topic-seo-review passed (${passed} assertions)`);
