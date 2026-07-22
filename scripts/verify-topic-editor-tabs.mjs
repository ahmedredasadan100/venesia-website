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

let passed = 0;
function check(label, condition) { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); }

for (const label of ["فقرة", "H1", "H2", "H3", "Bold", "Italic", "قائمة نقطية", "قائمة رقمية", "رابط", "تراجع", "إعادة", "إضافة محتوى"]) check(`content toolbar: ${label}`, editor.includes(label));
check("numbered list continues on Enter", editor.includes("Number(ordered[1]) + 1"));
check("internal link is deferred and disabled", editor.includes("رابط داخلي — قريبًا") && editor.includes("disabled"));
check("editor top cards include all heading counts and real internal-link count", ["H1", "H2", "H3", "روابط داخلية"].every((label) => editor.includes(`label="${label}"`)) && editor.includes("markdownInternalLinks + htmlInternalLinks") && editor.includes("stats.internalLinks"));
check("zero internal links use the light warning state", editor.includes("warning={stats.internalLinks === 0}"));
check("lower content analysis is fully removed", ["قراءة فنية سريعة", "تحليل مباشر", "data-topic-content-analysis", "AnalysisCard", "analysisPortalTarget"].every((token) => !editor.includes(token)));
check("Focus Keyword density exists only in SEO and reuses its analysis", !editor.includes("keywordDensity") && seo.includes("analysis.keywordDensity") && seo.includes("data-topic-seo-keyword-density"));
check("content tab excludes FAQ counter", !editor.includes("أسئلة FAQ"));
check("FAQ uses shared confirmation", faq.includes("AdminConfirmDialog") && !faq.includes("window.confirm"));
check("FAQ supports reorder", faq.includes("draggable") && faq.includes("onDrop"));
check("FAQ owns its two display controls with one form source each", !displaySettings.includes('name="show_faq_on_page"') && faq.match(/name="show_faq_on_page"/g)?.length === 1 && faq.match(/name="show_faq_title_on_page"/g)?.length === 1 && helper.includes("showFaqOnPage") && helper.includes("showFaqTitleOnPage"));
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
check("create and edit share the moved editor and remaining panels", [create, edit].every((source) => ["TopicMarkdownEditor", "FaqEditor", "SeoPanel", "TopicPublishChecklistPanel", "TopicPublishingOptions"].every((token) => source.includes(token))));
check("legacy content tab is absent", !create.includes('id: "content"') && !edit.includes('id: "content"'));
check("one content editor registration per form", create.match(/<TopicMarkdownEditor/g)?.length === 1 && edit.match(/<TopicMarkdownEditor/g)?.length === 1);
check("four tabs remain mounted by shared shell", create.includes('id: "basic"') && create.includes('id: "publish"') && edit.includes('id: "basic"') && edit.includes('id: "publish"'));

console.log(`\n${passed}/${passed} targeted topic editor checks passed.`);
