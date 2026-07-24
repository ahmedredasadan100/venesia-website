import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [];

async function read(path) {
  return readFile(resolve(root, path), "utf8");
}

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
}

const [
  contentTypes,
  newPage,
  createEditor,
  editEditor,
  typeControl,
  basicPanel,
  tabs,
  slugInput,
  imageField,
  categorySelect,
  seriesFields,
  helpers,
  validation,
  migration,
  publicLoader,
  publicPage,
  publicLayout,
  publicPath,
  listbox,
  markdownEditor,
  displaySettings,
  faqEditor,
  formRuntime,
] = await Promise.all([
  read("src/lib/admin/content/content-types.ts"),
  read("src/app/admin/content/topics/new/page.tsx"),
  read("src/components/admin/content/editors/ArticleCreateEditor.tsx"),
  read("src/components/admin/content/editors/ArticleEditor.tsx"),
  read("src/components/admin/content/editors/TopicContentTypeControl.tsx"),
  read("src/components/admin/content/editors/article/TopicBasicDataPanel.tsx"),
  read("src/components/admin/page-blocks/AdminModuleTabs.tsx"),
  read("src/components/admin/content/editors/article/TopicSlugInput.tsx"),
  read("src/components/admin/content/editors/article/TopicImageField.tsx"),
  read("src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx"),
  read("src/components/admin/content/editors/article/TopicSeriesFields.tsx"),
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/article-actions/validation.ts"),
  read("sql/migrations/20260721143000_topics_page_display_settings.sql"),
  read("src/lib/topics/load-public-topics.ts"),
  read("src/app/(site)/topics/[slug]/page.tsx"),
  read("src/components/InternalPageLayout.tsx"),
  read("src/lib/content/public-content-path.ts"),
  read("src/components/admin/ui/AdminListboxSelect.tsx"),
  read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx"),
  read("src/components/admin/content/editors/article/TopicDisplaySettings.tsx"),
  read("src/components/admin/content/editors/article/FaqEditor.tsx"),
  read("src/components/admin/ui/AdminFormRuntime.tsx"),
]);

for (const value of ["article", "news", "press", "site_update", "video", "gallery"]) {
  check(`content type ${value} remains available`, contentTypes.includes(`value: "${value}"`));
}
check("content type UI is one select backed by current options", typeControl.includes("<select") && typeControl.includes("CONTENT_TYPE_OPTIONS.map") && typeControl.match(/<option/g)?.length === 1);
check("legacy content-type cards and helper are removed", !typeControl.includes("radiogroup") && !typeControl.includes("TYPE_ICONS") && !typeControl.includes("نوع المحتوى ثابت بعد الإنشاء"));
check("edit content type stays locked without helper text", typeControl.includes('disabled={mode === "edit"}') && !typeControl.includes("<p"));

check("/new defaults to article editor", newPage.includes('query.type : "article"'));
check("create and edit share TopicBasicDataPanel", createEditor.includes("<TopicBasicDataPanel") && editEditor.includes("<TopicBasicDataPanel"));
check("shared runtime centrally owns the literal form element", formRuntime.includes("<form") && formRuntime.includes("id={formId}"));
check(
  "create editor delegates its full tab form to the shared runtime",
  createEditor.includes("<AdminFormRuntime") &&
    createEditor.includes('mode="create"') &&
    createEditor.includes('formId="topic-create-form"') &&
    createEditor.includes("action={saveTopicForm}") &&
    createEditor.indexOf("<AdminFormRuntime") < createEditor.indexOf("<TopicEditTabs") &&
    !createEditor.includes("<form"),
);
check(
  "edit editor delegates its full tab form to the shared runtime",
  editEditor.includes("<AdminFormRuntime") &&
    editEditor.includes('mode="edit"') &&
    editEditor.includes('formId="topic-edit-form"') &&
    editEditor.includes("action={saveTopicForm}") &&
    editEditor.indexOf("<AdminFormRuntime") < editEditor.indexOf("<TopicEditTabs") &&
    !editEditor.includes("<form"),
);
check(
  "each editor exposes one shared Save and Close action row without SaveBar",
  [createEditor, editEditor].every(
    (source) => source.match(/<AdminFormActions\s*\/>/g)?.length === 1 && !source.includes("SaveBar"),
  ),
);

for (const label of ["المحتوى الأساسي", "الأسئلة الشائعة", "SEO والتحليل", "المراجعة والنشر"]) {
  check(`four-tab shell includes ${label}`, createEditor.includes(`label: "${label}"`) && editEditor.includes(`label: "${label}"`));
}
check("legacy content tab is removed", !createEditor.includes('id: "content"') && !editEditor.includes('id: "content"'));
check("the current content editor moved into the basic panel", basicPanel.includes("contentEditor") && createEditor.match(/<TopicMarkdownEditor/g)?.length === 1 && editEditor.match(/<TopicMarkdownEditor/g)?.length === 1);
check("category and series use in-flow list interfaces", categorySelect.includes("inline />") && seriesFields.includes("inline />") && listbox.includes("inline?: boolean"));
check("lower content analysis and portal slot are removed", !basicPanel.includes("data-topic-content-analysis-slot") && !markdownEditor.includes("data-topic-content-analysis") && !markdownEditor.includes("analysisPortalTarget") && !markdownEditor.includes("createPortal"));

for (const field of ["title", "slug", "category_slug", "series_id", "excerpt", "image", "image_alt"]) {
  check(`basic data retains ${field}`, [basicPanel, slugInput, imageField, categorySelect, seriesFields].some((source) => source.includes(`name="${field}"`) || source.includes(`name = "${field}"`)));
}

check("tab panels stay mounted while hidden", tabs.includes("tabs.map((tab) =>") && tabs.includes("hidden={tab.id !== activeId}"));
check("basic panel owns one image field", basicPanel.match(/<TopicImageField/g)?.length === 1);
check("slug keeps automatic and manual editing behavior", slugInput.includes("setIsManual(false)") && slugInput.includes("setIsManual(true)") && slugInput.includes("slugify(titleInput?.value"));
check("slug helper and public-path preview are removed", !slugInput.includes("resolvePublicContentPath") && !slugInput.includes("يتم توليده تلقائيًا من العنوان") && !slugInput.includes("↗"));
check("desktop first row uses a small type column and equal title/slug columns", basicPanel.includes("lg:grid-cols-[minmax(150px,0.55fr)_minmax(0,1fr)_minmax(0,1fr)]") && basicPanel.indexOf("<TopicContentTypeControl") < basicPanel.indexOf('name="title"') && basicPanel.indexOf('name="title"') < basicPanel.indexOf("<TopicSlugInput"));
check("slug generation action is inside the field at its left edge", slugInput.includes("data-topic-slug-field") && slugInput.includes("absolute bottom-1 left-1 top-1") && slugInput.includes("pl-[7.25rem]") && !slugInput.includes("grid-cols-[minmax(0,1fr)_auto]"));
check("general display settings use two columns without FAQ controls", displaySettings.includes("grid grid-cols-2") && !displaySettings.includes('name="show_faq_on_page"') && !basicPanel.includes("showFaq="));
check("FAQ tab owns one source for each FAQ display value", faqEditor.match(/name="show_faq_on_page"/g)?.length === 1 && faqEditor.match(/name="show_faq_title_on_page"/g)?.length === 1);
check("upload instructions match server constraints", imageField.includes("JPG، PNG، WEBP، GIF، AVIF") && imageField.includes("5MB") && imageField.includes("1600 × 900"));

for (const field of ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"]) {
  check(`${field} is additive with true default`, migration.includes(`${field} boolean not null default true`));
  check(`${field} is parsed and persisted`, helpers.includes(`getBoolean(formData, "${field}")`) && helpers.includes(`${field}:`));
  check(`${field} is loaded for edit`, validation.includes(field));
}

for (const field of ["show_faq_on_page", "show_faq_title_on_page"]) {
  check(`${field} is additive with true default`, migration.includes(`${field} boolean not null default true`));
  check(`${field} is parsed and persisted`, helpers.includes(`getBoolean(formData, "${field}")`) && helpers.includes(`${field}:`));
  check(`${field} is loaded for edit`, validation.includes(field));
}

check("public topic loader defaults legacy rows to visible", publicLoader.includes("topic.show_title_on_page !== false") && publicLoader.includes("topic.show_image_on_page !== false") && publicLoader.includes("topic.show_excerpt_on_page !== false"));
check("public topic detail uses the saved image alt", publicLoader.includes("imageAlt: topic.image_alt") && publicPage.includes("alt={topic.imageAlt}"));
check("public topic page honors all display settings", publicPage.includes("topic.showTitleOnPage") && publicPage.includes("topic.showImageOnPage") && publicPage.includes("topic.showExcerptOnPage") && publicPage.includes("topic.showFaqTitleOnPage"));
check("shared public layout can hide hero elements", publicLayout.includes("showHeroImage") && publicLayout.includes("showSubtitle") && publicLayout.includes("showTitle"));
check("public resolver maps article and media routes", publicPath.includes('article: "/topics"') && publicPath.includes('site_update: "/media-center/site-updates"') && publicPath.includes('gallery: "/media-center/gallery"'));

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  throw new Error(`${failed.length} topic editor basic-data checks failed`);
}

console.log(`verify:topic-editor-basic-data passed (${checks.length} assertions)`);
