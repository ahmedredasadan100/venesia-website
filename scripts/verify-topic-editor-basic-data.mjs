import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const [
  contentTypes,
  newPage,
  editPage,
  createEditor,
  editEditor,
  shell,
  basicPanel,
  formDefinition,
  categorySelect,
  seriesFields,
  typeControl,
  slugInput,
  imageField,
  markdownEditor,
  displaySettings,
  faqEditor,
  publishingOptions,
  helpers,
  validation,
  publicLoader,
  publicPage,
  publicLayout,
  publicPath,
  migration,
] = await Promise.all([
  read("src/lib/admin/content/content-types.ts"),
  read("src/app/admin/content/topics/new/page.tsx"),
  read("src/app/admin/content/topics/[id]/page.tsx"),
  read("src/components/admin/content/editors/ArticleCreateEditor.tsx"),
  read("src/components/admin/content/editors/ArticleEditor.tsx"),
  read("src/components/admin/content/editors/ContentEditorShell.tsx"),
  read("src/components/admin/content/editors/ContentBasicDataPanel.tsx"),
  read("src/components/admin/content/editors/content-form-definition.ts"),
  read("src/components/admin/content/editors/ContentCategorySelect.tsx"),
  read("src/components/admin/content/editors/article/TopicSeriesFields.tsx"),
  read("src/components/admin/content/editors/TopicContentTypeControl.tsx"),
  read("src/components/admin/content/editors/article/TopicSlugInput.tsx"),
  read("src/components/admin/content/editors/article/TopicImageField.tsx"),
  read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx"),
  read("src/components/admin/content/editors/ContentDisplaySettings.tsx"),
  read("src/components/admin/content/editors/article/FaqEditor.tsx"),
  read("src/components/admin/content/editors/ContentPublishingOptions.tsx"),
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/article-actions/validation.ts"),
  read("src/lib/topics/load-public-topics.ts"),
  read("src/app/(site)/topics/[slug]/page.tsx"),
  read("src/components/InternalPageLayout.tsx"),
  read("src/lib/content/public-content-path.ts"),
  read("sql/migrations/20260721143000_topics_page_display_settings.sql"),
]);

for (const value of ["article", "news", "press", "site_update", "video", "gallery"]) {
  check(`content type ${value} remains registered`, contentTypes.includes(`"${value}",`) && contentTypes.includes(`${value}: {`));
}

check("new route selects the article create adapter", newPage.includes('<ArticleCreateEditor') && newPage.includes('contentType === "article"'));
check("edit route selects the article edit adapter", editPage.includes('<ArticleEditor') && editPage.includes('editorKind === "article"'));
check("article create and edit each delegate to one shared shell", [createEditor, editEditor].every((source) => source.match(/<ContentEditorShell\b/g)?.length === 1 && !source.includes("<form")));
check("shared shell exclusively owns the form runtime and actions", shell.match(/<AdminFormRuntime\b/g)?.length === 1 && shell.match(/<AdminFormActions\s*\/>/g)?.length === 1 && !shell.includes("<form"));
check("shared shell owns typed form identity", shell.includes('name="content_type"') && shell.includes('name="id"') && shell.includes('entityKey={`content:${contentType}`}'));
check("article modes and shared save action stay explicit", createEditor.includes('mode="create"') && editEditor.includes('mode="edit"') && [createEditor, editEditor].every((source) => source.includes("action={saveContentForm}")));
check("article create-to-edit form IDs remain stable", createEditor.includes('formId="topic-create-form"') && editEditor.includes('formId="topic-edit-form"'));
check("article editors preserve the media-catalog save signal", [createEditor, editEditor].every((source) => source.match(/<TopicMediaCatalogSyncSignal\b/g)?.length === 1));

for (const id of ["basic", "faq", "seo", "publish"]) {
  check(`article create and edit retain the ${id} tab`, [createEditor, editEditor].every((source) => source.match(new RegExp(`id: "${id}"`, "g"))?.length === 1));
}
check("shared shell renders declarative editor tabs through its shared presentation layer", shell.includes("<AdminModuleTabs") && shell.includes('variant="editor"') && shell.includes("tabs={presentedTabs}") && shell.includes("tabs.map((tab) =>"));
check("legacy content tab remains absent", !createEditor.includes('id: "content"') && !editEditor.includes('id: "content"'));

check("article adapters mount every article-specific capability once", [createEditor, editEditor].every((source) => ["ContentBasicDataPanel", "TopicMarkdownEditor", "FaqEditor", "SeoPanel", "ContentPublishingOptions", "ContentReviewPanel"].every((owner) => source.match(new RegExp(`<${owner}\\b`, "g"))?.length === 1)));
check("shared basic owner keeps title, excerpt, slug, image, category, series and injected body", basicPanel.includes('name="title"') && basicPanel.includes('name="excerpt"') && basicPanel.includes("<TopicSlugInput") && basicPanel.includes("<TopicImageField") && basicPanel.includes("<ContentCategorySelect") && basicPanel.includes("<TopicSeriesFields") && basicPanel.match(/\{contentEditor\}/g)?.length === 1);
check("content type remains display-only inside the common identity", basicPanel.includes("<TopicContentTypeControl") && !typeControl.includes("name="));
check("category submits a single stable category_id control", categorySelect.match(/<select\b/g)?.length === 1 && categorySelect.includes('name="category_id"') && categorySelect.includes('triggerId="content-category-listbox"'));
check("inactive current category remains selectable only for its record", categorySelect.includes("category.is_active === false") && categorySelect.includes("String(category.id) !== initialValue"));
check("series retains a single series_id input owner and stable target", seriesFields.match(/<input\b[^>]*name="series_id"/g)?.length === 1 && seriesFields.includes('triggerId="content-series-listbox"'));
check("slug keeps automatic and manual modes", slugInput.includes("setIsManual(false)") && slugInput.includes("setIsManual(true)") && slugInput.includes("slugify(titleInput?.value"));
check("image owner preserves one image and alt submission contract", imageField.match(/<AdminMediaImageField/g)?.length === 1 && imageField.match(/<textarea\b[^>]*name="image_alt"/g)?.length === 1);
check("Markdown adapter is the sole article content field owner", markdownEditor.match(/<AdminRichTextEditor\b/g)?.length === 1 && markdownEditor.includes('name="content"') && markdownEditor.includes('storageFormat="markdown"') && !/<textarea[^>]*name="content"/.test(markdownEditor));
check("FAQ retains one owner for each visibility setting", faqEditor.match(/name="show_faq_on_page"/g)?.length === 1 && faqEditor.match(/name="show_faq_title_on_page"/g)?.length === 1);
check("shared display controls stay injectable at the shared basic boundary", basicPanel.includes("displaySettings?: ReactNode") && basicPanel.includes("{displaySettings ? (") && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.match(new RegExp(`name="${name}"`, "g"))?.length === 1));

check("navigation maps shared and typed validation failures", ['category_id: { tabId: "basic", targetId: "content-category-listbox" }', 'series_id: { tabId: "basic", targetId: "content-series-listbox" }', 'status: { tabId: "publish", targetId: "content-status" }'].every((marker) => formDefinition.includes(marker)));
check("publishing uses one status contract plus shared publishing options", publishingOptions.includes('name="status"') && publishingOptions.includes('name="is_featured"') && publishingOptions.includes('name="is_popular"') && publishingOptions.includes("TopicDateLabelField") && !publishingOptions.includes('name="is_published"'));
check("article payload reads category_id while the shared publishing owner submits status", helpers.includes('getString(formData, "category_id")') && publishingOptions.includes('name="status"'));
check("article validation loads category_id and excludes soft-deleted rows", validation.includes("category_id") && validation.includes('.is("deleted_at", null)'));

for (const field of ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page", "show_faq_on_page", "show_faq_title_on_page"]) {
  check(`${field} remains additive and persisted`, migration.includes(`${field} boolean not null default true`) && helpers.includes(`getBoolean(formData, "${field}")`) && validation.includes(field));
}

check("public topic loader defaults legacy display settings safely", publicLoader.includes("topic.show_title_on_page !== false") && publicLoader.includes("topic.show_image_on_page !== false") && publicLoader.includes("topic.show_excerpt_on_page !== false"));
check("public article output retains image-alt and display controls", publicPage.includes("alt={topic.imageAlt}") && publicPage.includes("topic.showTitleOnPage") && publicPage.includes("topic.showImageOnPage") && publicPage.includes("topic.showExcerptOnPage") && publicPage.includes("topic.showFaqTitleOnPage"));
check("shared public layout can hide hero elements", publicLayout.includes("showHeroImage") && publicLayout.includes("showSubtitle") && publicLayout.includes("showTitle"));
check("public path resolver maps article and media detail roots", publicPath.includes('article: "/topics"') && publicPath.includes('site_update: "/media-center/site-updates"') && publicPath.includes('gallery: "/media-center/gallery"'));

for (const retired of [
  "src/components/admin/content/editors/article/TopicBasicDataPanel.tsx",
  "src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx",
  "src/components/admin/content/editors/article/TopicEditTabs.tsx",
  "src/components/admin/content/editors/article/TopicPublishingOptions.tsx",
]) {
  check(`retired parallel owner is absent: ${retired}`, !existsSync(resolve(root, retired)));
}

console.log(`verify:topic-editor-basic-data passed (${passed} assertions)`);
