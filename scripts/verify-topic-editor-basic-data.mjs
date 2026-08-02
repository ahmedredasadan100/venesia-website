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
  editPage,
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
  floatingHook,
  characterField,
  fieldCounter,
  scrollbarStyles,
  adminForm,
  adminSwitch,
  markdownEditor,
  displaySettings,
  faqEditor,
  formRuntime,
  mediaSyncSignal,
] = await Promise.all([
  read("src/lib/admin/content/content-types.ts"),
  read("src/app/admin/content/topics/new/page.tsx"),
  read("src/app/admin/content/topics/[id]/page.tsx"),
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
  read("src/components/admin/ui/useAdminFloatingMenuPosition.ts"),
  read("src/components/admin/content/editors/article/TopicCharacterField.tsx"),
  read("src/components/admin/content/editors/article/TopicFieldCounter.tsx"),
  read("src/components/admin/ui/admin-scrollbar-styles.ts"),
  read("src/components/admin/ui/AdminForm.tsx"),
  read("src/components/admin/ui/AdminFormSwitch.tsx"),
  read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx"),
  read("src/components/admin/content/editors/article/TopicDisplaySettings.tsx"),
  read("src/components/admin/content/editors/article/FaqEditor.tsx"),
  read("src/components/admin/ui/AdminFormRuntime.tsx"),
  read("src/components/admin/content/editors/article/TopicMediaCatalogSyncSignal.tsx"),
]);

for (const value of ["article", "news", "press", "site_update", "video", "gallery"]) {
  check(`content type ${value} remains available`, contentTypes.includes(`value: "${value}"`));
}
check("content type UI keeps one control per presentation backed by current options", typeControl.includes("<select") && typeControl.includes("<AdminListboxSelect") && typeControl.includes("CONTENT_TYPE_OPTIONS") && typeControl.match(/<option/g)?.length === 1 && !typeControl.includes("name="));
check("legacy content-type cards and helper are removed", !typeControl.includes("radiogroup") && !typeControl.includes("TYPE_ICONS") && !typeControl.includes("نوع المحتوى ثابت بعد الإنشاء"));
check("edit content type stays locked and opts into the relaxed shared content-width listbox", typeControl.includes('disabled={mode === "edit"}') && typeControl.includes('sizing="content-relaxed"') && listbox.includes('sizing?: "full" | "content" | "content-relaxed" | "medium" | "wide"') && listbox.includes('sizing === "content-relaxed"') && listbox.includes("min-w-32 w-fit max-w-full ps-4 pe-4") && !typeControl.includes("<p"));
check("shared listbox owns measured logical placement and Topic leaves search disabled", listbox.includes("const menuRef = useRef<HTMLDivElement>(null)") && listbox.includes("floatingRef: menuRef") && listbox.includes('align: dir === "rtl" ? "right" : "left"') && /fitsBelow\s*\?\s*"bottom"\s*:\s*fitsAbove\s*\?\s*"top"/.test(floatingHook) && ![typeControl, categorySelect, seriesFields].some((source) => source.includes("searchable=")));
check("shared listbox exposes the valid empty Series option as an active descendant", listbox.includes("const resolvedActiveValue = selectableOptions[activeIndex]?.value;") && listbox.includes("resolvedActiveValue === undefined") && (listbox.match(/resolvedActiveValue !== undefined/g)?.length ?? 0) >= 3);
check("compact dropdown presets wrap long Arabic menu labels instead of truncating them", listbox.includes('const compactSized = sizing !== "full"') && listbox.includes('whitespace-normal break-words text-start leading-5'));

check("/new defaults to and mounts the sole Article Create editor branch", newPage.includes('query.type : "article"') && /if \(contentType === "article"\) \{\s*return \(\s*<ArticleCreateEditor\b/.test(newPage) && newPage.match(/<ArticleCreateEditor\b/g)?.length === 1);
check("/[id] mounts the sole Article Edit editor branch", /if \(editorKind === "article"\) \{\s*return \(\s*<ArticleEditor\b/.test(editPage) && editPage.match(/<ArticleEditor\b/g)?.length === 1);
check("create and edit each adopt one TopicBasicDataPanel", [createEditor, editEditor].every((source) => source.match(/<TopicBasicDataPanel\b/g)?.length === 1));
check("create and edit preserve one media-catalog save signal", [createEditor, editEditor].every((source) => source.match(/<TopicMediaCatalogSyncSignal\b/g)?.length === 1) && mediaSyncSignal.includes('form.addEventListener("admin-form-saved"') && mediaSyncSignal.includes("window.localStorage.setItem("));
check("mode-only hidden identity fields stay unique", createEditor.match(/name="content_type"/g)?.length === 1 && !createEditor.includes('name="id"') && editEditor.match(/name="content_type"/g)?.length === 1 && editEditor.match(/name="id"/g)?.length === 1 && !typeControl.includes("name="));
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
check("Topic Create and Edit share one closed taxonomy dropdown interaction", [categorySelect, seriesFields].every((source) => source.includes("<AdminListboxSelect") && !source.includes("inline=") && !source.includes("presentation")) && ![typeControl, categorySelect, seriesFields].some((source) => source.includes("searchable=")));
check("closed taxonomy triggers preserve stable validation targets", categorySelect.includes('triggerId="topic-category-listbox"') && seriesFields.includes('triggerId="topic-series-listbox"'));
check("all three Topic modes use one asymmetric compact Select geometry", basicPanel.includes('presentation="compact"') && categorySelect.includes('sizing="medium"') && seriesFields.includes('sizing="wide"') && typeControl.includes('sizing="content-relaxed"') && listbox.includes('sizing === "content-relaxed"') && listbox.includes('"min-w-32 w-fit max-w-full ps-4 pe-4"') && listbox.includes('sizing === "medium"') && listbox.includes('"w-60 max-w-full ps-4 pe-4"') && listbox.includes('sizing === "wide"') && listbox.includes('"w-64 max-w-full ps-4 pe-4"') && [typeControl, categorySelect, seriesFields].every((source) => source.includes("AdminListboxSelect")));
check("empty taxonomy controls use neutral trigger placeholders without removing the series clear option", categorySelect.includes('placeholder="اختر التصنيف"') && seriesFields.includes('placeholder="اختر السلسلة"') && seriesFields.includes('label: "بدون سلسلة"') && seriesFields.includes("showPlaceholderForEmptyValue") && listbox.includes("showPlaceholderForEmptyValue"));
check("Topic basic presentation has no mode-derived visual branch", basicPanel.includes('data-topic-basic-presentation="editor"') && basicPanel.includes("mode={contentTypeMode}") && !basicPanel.includes("editorPresentation") && !basicPanel.includes('contentTypeMode === "edit"') && !characterField.includes("presentation") && !imageField.includes("counterPlacement") && !displaySettings.includes("presentation"));
check("lower content analysis and portal slot are removed", !basicPanel.includes("data-topic-content-analysis-slot") && !markdownEditor.includes("data-topic-content-analysis") && !markdownEditor.includes("analysisPortalTarget") && !markdownEditor.includes("createPortal"));
check("the existing detailed Markdown implementation is declared as the canonical public-content owner", markdownEditor.includes("export function AdminPublicRichContentEditor") && markdownEditor.includes("export default AdminPublicRichContentEditor") && !markdownEditor.includes("AdminRichTextEditor"));

for (const field of ["title", "slug", "category_slug", "series_id", "excerpt", "image", "image_alt"]) {
  check(`basic data retains ${field}`, [basicPanel, slugInput, imageField, categorySelect, seriesFields].some((source) => source.includes(`name="${field}"`) || source.includes(`name = "${field}"`)));
}

check("shared basic submitted-field owners remain unique", basicPanel.match(/name="title"/g)?.length === 1 && basicPanel.match(/name="excerpt"/g)?.length === 1 && slugInput.match(/<input\b(?=[^>]*\bname="slug")/g)?.length === 1 && categorySelect.match(/<select\b(?=[^>]*\bname=\{name\})/g)?.length === 1 && categorySelect.match(/name = "category_slug"/g)?.length === 1 && seriesFields.match(/<input\b(?=[^>]*\bname="series_id")/g)?.length === 1 && imageField.match(/<AdminMediaImageField/g)?.length === 1 && imageField.match(/<textarea[^>]*name="image_alt"/g)?.length === 1 && markdownEditor.match(/<input\b(?=[^>]*\btype="hidden")(?=[^>]*\bname="content")/g)?.length === 1 && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.match(new RegExp(`name="${name}"`, "g"))?.length === 1));

check("tab panels stay mounted while hidden", tabs.includes("tabs.map((tab) =>") && tabs.includes("hidden={tab.id !== activeId}"));
check("basic panel owns one image field", basicPanel.match(/<TopicImageField/g)?.length === 1);
check("slug keeps automatic and manual editing behavior", slugInput.includes("setIsManual(false)") && slugInput.includes("setIsManual(true)") && slugInput.includes("slugify(titleInput?.value"));
check("slug helper and public-path preview are removed", !slugInput.includes("resolvePublicContentPath") && !slugInput.includes("يتم توليده تلقائيًا من العنوان") && !slugInput.includes("↗"));
check("Topic Create and Edit row one contains only Title and Slug", basicPanel.includes("grid gap-5 lg:grid-cols-2") && /\{titleField\}\s*\{slugField\}\s*<\/div>/.test(basicPanel) && !basicPanel.includes("lg:grid-cols-[minmax(150px"));
check("Topic Create and Edit row two keeps External Description as plain excerpt text", basicPanel.includes('label="الوصف الخارجي (المقتطف)"') && /<TopicCharacterField[^>]*as="textarea"[^>]*name="excerpt"/.test(basicPanel) && basicPanel.indexOf("{excerptField}") > basicPanel.indexOf("{slugField}"));
check("Topic Create and Edit character counters share the label relationship", characterField.includes("<TopicFieldCounter count={count} />") && characterField.includes("inline-flex items-center gap-2") && !characterField.includes("grid-cols-[minmax(0,1fr)_auto]") && !fieldCounter.includes("placement") && fieldCounter.includes("shrink-0 whitespace-nowrap"));
check("Topic Create and Edit External Description uses the shared tall Venesia scrollbar", characterField.includes("min-h-40") && characterField.includes("overflow-y-auto") && characterField.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") && !characterField.includes("min-h-20") && scrollbarStyles.includes("[scrollbar-width:thin]") && scrollbarStyles.includes("[&::-webkit-scrollbar-thumb]:bg-[#D8B87A]/35"));
check("Topic Create and Edit row three groups unequal Content Type, Category, and Series controls without equal columns", basicPanel.includes("data-topic-compact-select-row") && basicPanel.includes("flex flex-wrap items-end gap-5 lg:flex-nowrap") && basicPanel.includes('inline-grid min-w-0 max-w-full shrink-0') && /\{contentTypeField\}\s*\{categoryField\}\s*\{seriesField\}/.test(basicPanel) && !/data-topic-compact-select-row[^>]*grid/.test(basicPanel));
check("Topic Create and Edit consume shared form surfaces with equal-height information and image cards", basicPanel.includes("<AdminFormLayout") && basicPanel.match(/<AdminFormSection/g)?.length === 4 && basicPanel.includes('className="items-stretch" asideClassName="h-full"') && (basicPanel.match(/className="h-full min-w-0/g)?.length ?? 0) >= 2 && basicPanel.includes('className="space-y-7"'));
check("slug generation action is inside the field at its left edge", slugInput.includes("data-topic-slug-field") && slugInput.includes("absolute bottom-1 left-1 top-1") && slugInput.includes("pl-[7.25rem]") && !slugInput.includes("grid-cols-[minmax(0,1fr)_auto]"));
check("Topic Create and Edit share one image Alt counter beside its label", imageField.match(/<TopicFieldCounter\b/g)?.length === 1 && imageField.includes("inline-flex items-center gap-2") && imageField.includes('name="image_alt"') && !imageField.includes("counterPlacement") && !imageField.includes("grid-cols-[minmax(0,1fr)_auto]"));
check("Topic Create and Edit display settings use one equal compact three-cell owner", displaySettings.includes('<AdminFormSwitchGroup layout="equal-grid">') && displaySettings.match(/<TopicFormSwitch/g)?.length === 3 && displaySettings.match(/\ssurface\s/g)?.length === 3 && !displaySettings.includes("grid grid-cols-2") && !displaySettings.includes("presentation") && adminSwitch.includes('layout?: "flow" | "equal-grid"') && adminSwitch.includes("grid gap-4 sm:grid-flow-col sm:auto-cols-fr") && !displaySettings.includes('name="show_faq_on_page"') && !basicPanel.includes("showFaq="));
check("Topic Create and Edit place Display Settings in one compact full-width shared card", basicPanel.includes('title="إعدادات العرض داخل صفحة الموضوع"') && basicPanel.includes('density="compact"') && adminForm.includes('density?: "default" | "compact"') && adminForm.includes('`${ADMIN_FORM_SECTION_SURFACE_CLASSES} px-6 py-4`') && basicPanel.indexOf("{displaySection}", basicPanel.indexOf("</AdminFormLayout>")) > basicPanel.indexOf("</AdminFormLayout>") && basicPanel.indexOf("{displaySection}", basicPanel.indexOf("</AdminFormLayout>")) < basicPanel.indexOf("{contentSection}", basicPanel.indexOf("</AdminFormLayout>")));
check("Topic content keeps one injected visible editor and one submitted content owner", basicPanel.match(/\{contentEditor\}/g)?.length === 1 && markdownEditor.match(/type="hidden" name="content"/g)?.length === 1 && markdownEditor.match(/id="topic-content-markdown"/g)?.length === 1 && !/<textarea[^>]*name="content"/.test(markdownEditor));
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
