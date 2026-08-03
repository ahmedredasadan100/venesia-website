import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const editor = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
const faq = read("src/components/admin/content/editors/article/FaqEditor.tsx");
const seo = read("src/components/admin/SeoPanel.tsx");
const sharedSeo = read("src/components/admin/seo/AdminEntitySeoPanel.tsx");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const publishing = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const create = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const edit = read("src/components/admin/content/editors/ArticleEditor.tsx");
const shell = read("src/components/admin/content/editors/ContentEditorShell.tsx");
const basic = read("src/components/admin/content/editors/ContentBasicDataPanel.tsx");
const helper = read("src/app/admin/content/topics/article-actions/helpers.ts");
const publicPage = read("src/app/(site)/topics/[slug]/page.tsx");
const migration = read("sql/migrations/20260721143000_topics_page_display_settings.sql");
const displaySettings = read("src/components/admin/content/editors/ContentDisplaySettings.tsx");
const topicSwitch = read("src/components/admin/content/editors/article/TopicFormSwitch.tsx");
const sharedSwitch = read("src/components/admin/ui/AdminFormSwitch.tsx");
const previewCapability = read("src/lib/admin/interaction-system/entity-preview-capability.ts");
const contentPreviewCapability = read("src/lib/admin/content/entity-preview-capabilities.ts");
const previewActions = read("src/components/admin/ui/AdminEntityPreviewActions.tsx");
const tabsOwner = read("src/components/admin/ui/AdminModuleTabs.tsx");
const navigationEvent = read("src/components/admin/content/editors/content-editor-navigation.ts");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

for (const label of ["فقرة", "H1", "H2", "H3", "Bold", "Italic", "قائمة نقطية", "قائمة رقمية", "رابط", "تراجع", "إعادة"]) {
  check(`content toolbar retains ${label}`, editor.includes(label));
}
check("numbered list continues on Enter", editor.includes("Number(ordered[1]) + 1"));
check("content toolbar has no retired duplicate add action", !editor.includes("إضافة محتوى") && !editor.includes('<ToolButton label="Quote"') && !editor.includes("addMenuOpen"));
check("content statistics retain heading and internal-link analysis", ["H1", "H2", "H3", "روابط داخلية"].every((label) => editor.includes(`label="${label}"`)) && editor.includes("markdownInternalLinks + htmlInternalLinks"));
check("keyword density remains in SEO rather than the body owner", !editor.includes("keywordDensity") && seo.includes("topicAnalysis.keywordDensity") && sharedSeo.includes("data-admin-entity-seo-metric={metric.id}"));

check("FAQ uses shared confirmation and drag reorder", faq.includes("AdminConfirmDialog") && !faq.includes("window.confirm") && faq.includes("draggable") && faq.includes("onDrop"));
check("FAQ owns its visibility fields once", faq.match(/name="show_faq_on_page"/g)?.length === 1 && faq.match(/name="show_faq_title_on_page"/g)?.length === 1 && !displaySettings.includes('name="show_faq_on_page"'));
check("FAQ visibility survives empty-list saves", helper.includes("faqEditorPresent") && helper.includes("!payload.faqEditorPresent"));
check("public FAQ obeys both display flags", publicPage.includes("topic.showFaqOnPage && topic.faq.length") && publicPage.includes("topic.showFaqTitleOnPage"));
check("FAQ migrations remain additive", migration.includes("show_faq_on_page boolean not null default true") && migration.includes("show_faq_title_on_page boolean not null default true"));

for (const field of ["seoTitle", "seoDescription", "focusKeyword", "seoKeywords", "canonicalUrl", "robotsIndex", "robotsFollow", "ogImage", "ogImageAlt"]) {
  check(`SEO field adapter retains ${field}`, seo.includes("ENTITY_SEO_FIELD_NAMES") && sharedSeo.includes(`fieldNames.${field}`));
}
check("SEO avoids duplicate slug and image-alt owners", !seo.includes('name="slug"') && !seo.includes('name="image_alt"'));
check("SEO adapter keeps the public article path", seo.includes('publicPathPrefix="/topics"'));
check("SEO adapter adds typed topic analysis to the shared panel", seo.includes("topicAnalysis.issues.seo.filter") && sharedSeo.includes("analysis.issues.map"));

check("publishing owns status, featured, popular and date without a save engine", publishing.includes('name="status"') && publishing.includes('name="is_featured"') && publishing.includes('name="is_popular"') && publishing.includes("TopicDateLabelField") && !publishing.includes("SaveBar"));
check("publishing and display switches delegate to the shared switch DOM", topicSwitch.match(/<AdminFormSwitch\b/g)?.length === 1 && !topicSwitch.includes("<input") && sharedSwitch.match(/type="checkbox"/g)?.length === 1 && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.includes(`name="${name}"`)));
check("review stays read-only and separates four typed analysis cards", ["جاهزية المحتوى", "جاهزية الصورة وAlt", "تحليل SEO", "التحقق العام (Validation)"].every((label) => review.includes(label)) && review.includes("ANALYSIS_CARDS") && !review.includes('<input type="hidden" name="status"') && !review.includes("AdminSingleOpenAccordion"));
check("article adapters slot the shared publishing owner into the shared dashboard", [create, edit].every((source) => /<ContentReviewPanel\b[\s\S]*?publishingOptions=\{[\s\S]*?<ContentPublishingOptions\b/.test(source)));

check("create and edit use exactly one unified shell", [create, edit].every((source) => source.match(/<ContentEditorShell\b/g)?.length === 1));
check("shell owns one shared tab renderer and one action row", shell.match(/<AdminModuleTabs\b/g)?.length === 1 && shell.match(/<AdminFormActions\s*\/>/g)?.length === 1);
check("shell binds tab navigation to one shared event", shell.includes("navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}") && navigationEvent.includes('"content-editor:navigate"'));
check("create and edit mount every article tab capability once", [create, edit].every((source) => ["ContentBasicDataPanel", "TopicMarkdownEditor", "FaqEditor", "SeoPanel", "ContentPublishingOptions", "ContentReviewPanel"].every((token) => source.match(new RegExp(`<${token}\\b`, "g"))?.length === 1)));
check("create and edit keep the same four tabs in order", [create, edit].every((source) => ["basic", "faq", "seo", "publish"].every((id, index, ids) => source.indexOf(`id: "${id}"`) >= 0 && (index === 0 || source.indexOf(`id: "${ids[index - 1]}"`) < source.indexOf(`id: "${id}"`)))));
check("tab content has no legacy fifth content tab", !create.includes('id: "content"') && !edit.includes('id: "content"'));
check("basic tab injects the canonical Markdown owner", basic.includes("contentEditor") && create.match(/<TopicMarkdownEditor/g)?.length === 1 && edit.match(/<TopicMarkdownEditor/g)?.length === 1);

check("shared tabs expose the editor preset", tabsOwner.includes('variant?: "pills" | "segmented" | "underline" | "editor"') && tabsOwner.includes("ADMIN_EDITOR_TAB_CONTAINER_CLASS_NAME") && tabsOwner.includes("ADMIN_EDITOR_TAB_CLASS_NAME"));
check("editor tabs keep a one-row overflow geometry", ["flex-nowrap", "overflow-x-auto", "shrink-0", "whitespace-nowrap"].every((token) => tabsOwner.includes(token)));
check("tab panels stay mounted while inactive", tabsOwner.includes("tabs.map((tab) =>") && tabsOwner.includes("hidden={tab.id !== activeId}"));
check("tab semantics and keyboard navigation remain accessible", ['role="tablist"', 'role="tab"', 'role="tabpanel"', "aria-selected={isActive}", "tabIndex={isActive ? 0 : -1}", 'event.key === "ArrowRight"', 'event.key === "ArrowLeft"'].every((token) => tabsOwner.includes(token)));
check("validation navigation activates and focuses the requested tab field", tabsOwner.includes("focusNavigationTarget(targetId)") && tabsOwner.includes("window.addEventListener(navigationEventName, navigate)"));

check("edit-only preview remains capability driven outside the shared shell", previewCapability.includes("resolveAdminEntityPreviewActions") && contentPreviewCapability.includes("buildAdminContentPreviewCapability") && previewActions.includes("resolveAdminEntityPreviewActions") && edit.match(/<AdminEntityPreviewActions\b/g)?.length === 1 && edit.indexOf("<AdminEntityPreviewActions capability={previewCapability}") < edit.indexOf("<ContentEditorShell") && !create.includes("AdminEntityPreviewActions") && !publishing.includes("next/link"));
check("retired topic-only tab and publishing owners are not referenced", ![create, edit, shell].some((source) => source.includes("TopicEditTabs") || source.includes("TopicPublishingOptions")));

console.log(`verify:topic-editor-tabs passed (${passed} assertions)`);
