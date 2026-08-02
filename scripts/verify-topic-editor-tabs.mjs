import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const editor = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
const faq = read("src/components/admin/content/editors/article/FaqEditor.tsx");
const seo = read("src/components/admin/SeoPanel.tsx");
const review = read("src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx");
const publishingOptions = read("src/components/admin/content/editors/article/TopicPublishingOptions.tsx");
const create = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const edit = read("src/components/admin/content/editors/ArticleEditor.tsx");
const helper = read("src/app/admin/content/topics/article-actions/helpers.ts");
const publicPage = read("src/app/(site)/topics/[slug]/page.tsx");
const migration = read("sql/migrations/20260721143000_topics_page_display_settings.sql");
const displaySettings = read("src/components/admin/content/editors/article/TopicDisplaySettings.tsx");
const topicSwitch = read("src/components/admin/content/editors/article/TopicFormSwitch.tsx");
const sharedSwitch = read("src/components/admin/ui/AdminFormSwitch.tsx");
const previewCapability = read("src/lib/admin/interaction-system/entity-preview-capability.ts");
const contentPreviewCapability = read("src/lib/admin/content/entity-preview-capabilities.ts");
const previewActions = read("src/components/admin/ui/AdminEntityPreviewActions.tsx");
const tabsOwner = read("src/components/admin/page-blocks/AdminModuleTabs.tsx");
const topicEditTabs = read("src/components/admin/content/editors/article/TopicEditTabs.tsx");

let passed = 0;
function check(label, condition) { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); }

for (const label of ["فقرة", "H1", "H2", "H3", "Bold", "Italic", "قائمة نقطية", "قائمة رقمية", "رابط", "تراجع", "إعادة"]) check(`content toolbar: ${label}`, editor.includes(label));
check("numbered list continues on Enter", editor.includes("Number(ordered[1]) + 1"));
check("redundant add-content and quote-content toolbar actions are absent", !editor.includes("إضافة محتوى") && !editor.includes("اقتباس المحتوى") && !editor.includes('<ToolButton label="Quote"') && !editor.includes("addMenuOpen") && !editor.includes("رابط داخلي — قريبًا"));
check("editor top cards include all heading counts and real internal-link count", ["H1", "H2", "H3", "روابط داخلية"].every((label) => editor.includes(`label="${label}"`)) && editor.includes("markdownInternalLinks + htmlInternalLinks") && editor.includes("stats.internalLinks"));
check("zero internal links use the light warning state", editor.includes("warning={stats.internalLinks === 0}"));
check("lower content analysis is fully removed", ["قراءة فنية سريعة", "تحليل مباشر", "data-topic-content-analysis", "AnalysisCard", "analysisPortalTarget"].every((token) => !editor.includes(token)));
check("Focus Keyword density exists only in SEO and reuses its analysis", !editor.includes("keywordDensity") && seo.includes("analysis.keywordDensity") && seo.includes("data-topic-seo-keyword-density"));
check("content tab excludes FAQ counter", !editor.includes("أسئلة FAQ"));
check("FAQ uses shared confirmation", faq.includes("AdminConfirmDialog") && !faq.includes("window.confirm"));
check("FAQ supports reorder", faq.includes("draggable") && faq.includes("onDrop"));
check("FAQ owns its two display controls with one form source each", !displaySettings.includes('name="show_faq_on_page"') && faq.match(/name="show_faq_on_page"/g)?.length === 1 && faq.match(/name="show_faq_title_on_page"/g)?.length === 1 && helper.includes("showFaqOnPage") && helper.includes("showFaqTitleOnPage"));
check("FAQ display switches inherit shared card geometry without a local alignment override", faq.includes("<AdminFormSwitch") && faq.includes("surface") && !faq.includes('className="w-full justify-between"') && sharedSwitch.includes('surface ? "grid grid-cols-[minmax(0,1fr)_auto] gap-3"'));
check("Create and Edit keep the sole FAQ visibility source in the FAQ tab", [create, edit].every((source) => source.match(/<FaqEditor\b/g)?.length === 1) && faq.includes("{faqVisibilitySwitch}") && !faq.includes("createPortal") && !faq.includes("visibilityPortalTargetId") && ![create, edit].some((source) => source.includes("faqVisibilitySlotId")) && !publishingOptions.includes("data-topic-faq-visibility-slot") && !publishingOptions.includes('name="show_faq_on_page"'));
check("FAQ matches list plus settings and preview sidebar", faq.includes("data-topic-faq-list") && faq.includes("data-topic-faq-settings") && faq.includes("data-topic-faq-preview") && faq.includes("xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.45fr)]"));
check("FAQ rows use only the red trash icon", faq.includes("<TrashIcon />") && faq.includes('aria-label="حذف السؤال"') && faq.includes('title="حذف السؤال"') && !faq.includes(">حذف</button>"));
check("empty FAQ deletion is preserved as empty", helper.includes("faqEditorPresent") && helper.includes("!payload.faqEditorPresent"));
check("public FAQ honors visibility", publicPage.includes("topic.showFaqOnPage && topic.faq.length"));
check("FAQ migration is additive and defaults visible", migration.includes("show_faq_on_page boolean not null default true"));
check("FAQ title visibility is additive and honored publicly", migration.includes("show_faq_title_on_page boolean not null default true") && publicPage.includes("topic.showFaqTitleOnPage"));
for (const name of ["seo_title", "seo_description", "focus_keyword", "seo_keywords"]) check(`SEO field: ${name}`, seo.includes(`name=\"${name}\"`));
check("SEO excludes duplicate inputs", !seo.includes('name="slug"') && !seo.includes('name="image_alt"'));
check("SEO shows public topic path", seo.includes("/topics/${live.slug.trim()"));
check("SEO only renders SEO issues", seo.includes("analysis.issues.seo") && !seo.includes("analysis.issues.content") && !seo.includes("analysis.issues.readiness"));
check("review separates blockers", review.includes("التنبيهات") || review.includes("تنبيه مانع"));
check("review separates optional improvements", review.includes("تحسينات اختيارية"));
check("review includes read-only summary", review.includes("ملخص الموضوع") && review.includes("حالة SEO") && review.includes("الأسئلة الشائعة"));
check("publish date exists in the top publishing actions", publishingOptions.includes("TopicDateLabelField") && !review.includes("TopicDateLabelField"));
check("Create and Edit compose the same integrated publishing parent", [create, edit].every((source) => /<TopicPublishingOptions\b[\s\S]*?<TopicPublishChecklistPanel\b[\s\S]*?<\/TopicPublishingOptions>/.test(source)) && publishingOptions.includes('data-topic-publishing-presentation="integrated"') && publishingOptions.includes("data-topic-publishing-simple-options") && publishingOptions.includes("data-topic-publishing-decision-options") && publishingOptions.includes("data-topic-publishing-review-slot") && ![publishingOptions, review, create, edit].some((source) => /(?:^|[<\s])presentation="(?:embedded|integrated)"/m.test(source)));
check("topic switch consumers preserve one shared DOM and field contract", topicSwitch.match(/<AdminFormSwitch\b/g)?.length === 1 && !topicSwitch.includes("<input") && topicSwitch.includes("id={id}") && sharedSwitch.match(/<input\b/g)?.length === 1 && ["id={id}", 'type="checkbox"', 'role="switch"', "name={name}", "checked={checked}", "onChange={onChange}", "disabled={disabled}"].every((marker) => sharedSwitch.includes(marker)) && ["is_featured", "is_popular", "is_published"].every((name) => publishingOptions.includes(`name="${name}"`)) && /<TopicFormSwitch[\s\S]*?id="topic-published-switch"[\s\S]*?name="is_published"/.test(publishingOptions) && !publishingOptions.includes('<div id="topic-published-switch"') && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.includes(`name="${name}"`)));
check("Edit-only preview remains capability driven outside the shared form identity", previewCapability.includes("export type AdminEntityPreviewCapability") && previewCapability.includes("export function resolveAdminEntityPreviewActions") && contentPreviewCapability.includes("export function buildAdminContentPreviewCapability") && previewActions.includes("resolveAdminEntityPreviewActions") && edit.match(/<AdminEntityPreviewActions\b/g)?.length === 1 && edit.indexOf("<AdminEntityPreviewActions capability={previewCapability}") < edit.indexOf("<AdminFormRuntime") && !create.includes("AdminEntityPreviewActions") && !create.includes("buildAdminContentPreviewCapability") && ["next/link", "topicId", "slug", "data-topic-preview-links", "/preview", "/topics/", "previewLinkClassName"].every((marker) => !publishingOptions.includes(marker)));
check("publishing is a switch committed by the single shared Save action", publishingOptions.includes('name="is_published"') && [create, edit].every((source) => source.includes("action={saveTopicForm}") && source.match(/<AdminFormActions\s*\/>/g)?.length === 1 && !source.includes("SaveBar")));
check("create and edit share the moved editor and remaining panels", [create, edit].every((source) => ["TopicMarkdownEditor", "FaqEditor", "SeoPanel", "TopicPublishChecklistPanel", "TopicPublishingOptions"].every((token) => source.includes(token))));
check("create and edit mount each shared tab consumer exactly once", [create, edit].every((source) => ["TopicEditTabs", "TopicMarkdownEditor", "FaqEditor", "SeoPanel", "TopicPublishingOptions", "TopicPublishChecklistPanel"].every((token) => source.match(new RegExp(`<${token}\\b`, "g"))?.length === 1)));
check("create and edit delegate the literal form to AdminFormRuntime", [create, edit].every((source) => source.includes("<AdminFormRuntime") && !source.includes("<form")));
check("legacy content tab is absent", !create.includes('id: "content"') && !edit.includes('id: "content"'));
check("one content editor registration per form", create.match(/<TopicMarkdownEditor/g)?.length === 1 && edit.match(/<TopicMarkdownEditor/g)?.length === 1);
check("the same exact four tabs remain mounted in the same order", [create, edit].every((source) => (source.match(/^\s+id: "(?:basic|faq|seo|publish)",$/gm)?.length ?? 0) === 4 && (source.match(/^\s+id: "/gm)?.length ?? 0) === 4 && ["basic", "faq", "seo", "publish"].every((id, index, ids) => source.indexOf(`id: "${id}"`) >= 0 && (index === 0 || source.indexOf(`id: "${ids[index - 1]}"`) < source.indexOf(`id: "${id}"`)))));
check(
  "shared tabs owner exposes one declarative editor preset",
  tabsOwner.includes('variant?: "pills" | "segmented" | "underline" | "editor"') &&
    tabsOwner.includes("ADMIN_EDITOR_TAB_CONTAINER_CLASS_NAME") &&
    tabsOwner.includes("ADMIN_EDITOR_TAB_CLASS_NAME"),
);
check(
  "editor preset owns fixed one-row content-width overflow geometry",
  [
    "flex-nowrap",
    "overflow-x-auto",
    "h-14",
    "shrink-0",
    "whitespace-nowrap",
    "ps-6 pe-6",
    "gap-2",
    "size-5",
    "text-[15px]",
  ].every((token) => tabsOwner.includes(token)) &&
    !tabsOwner.includes("grid-cols-7"),
);
check(
  "editor preset owns the restrained active treatment and logical bottom indicator",
  tabsOwner.includes('border-[#D8B87A]/20 bg-[#D8B87A]/[0.08] text-[#E6C98D]') &&
    tabsOwner.includes("bottom-0 start-6 end-6 h-0.5") &&
    tabsOwner.includes("className={ADMIN_EDITOR_TAB_ACTIVE_INDICATOR_CLASS_NAME}") &&
    tabsOwner.includes('isActive && variant === "segmented" ? <span aria-hidden className="me-2">✓</span> : null') &&
    tabsOwner.match(/✓/g)?.length === 1,
);
check(
  "one Topic tabs adapter makes the editor preset mandatory for Create and Edit",
  topicEditTabs.includes("TopicEditorTabIcon") &&
    topicEditTabs.includes('variant="editor"') &&
    topicEditTabs.includes("const configuredTabs = tabs.map") &&
    !topicEditTabs.includes("variant?:") &&
    !topicEditTabs.includes("segmented") &&
    [create, edit].every((source) => source.match(/<TopicEditTabs\b/g)?.length === 1 && !source.includes('variant="editor"')),
);
check("retired Topic-only presentation flags cannot split Create from Edit", ![create, edit, topicEditTabs, seo, publishingOptions, review].some((source) => source.includes('presentation?: "default"') || source.includes('presentation === "editor"') || source.includes('presentation === "embedded"') || source.includes('presentation === "integrated"')));
check(
  "shared tab navigation and accessibility contracts remain present",
  [
    'role="tablist"',
    'role="tab"',
    'role="tabpanel"',
    "aria-selected={isActive}",
    "tabIndex={isActive ? 0 : -1}",
    'event.key === "ArrowRight"',
    'event.key === "ArrowLeft"',
    "focusNavigationTarget(targetId)",
  ].every((token) => tabsOwner.includes(token)),
);

console.log(`\n${passed}/${passed} targeted topic editor checks passed.`);
