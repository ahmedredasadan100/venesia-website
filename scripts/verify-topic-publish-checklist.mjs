import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const capability = read("src/lib/admin/content-workflow/content-review-capability.ts");
const publishing = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const display = read("src/components/admin/content/editors/ContentDisplaySettings.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const mediaEditor = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
const mediaHelpers = read("src/app/admin/content/topics/media-actions/helpers.ts");
const mediaLoader = read("src/lib/media-center/unified-provider.ts");
const mediaDetail = read("src/components/media-center/MediaDetailPage.tsx");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("one content Review owner serves article and all media editors", [createEditor, editEditor, mediaEditor].every((source) => source.match(/<ContentReviewPanel\b/g)?.length === 1));
check("Review composes the shared publishing owner once through its dashboard slot", [createEditor, editEditor, mediaEditor].every((source) => /<ContentReviewPanel\b[\s\S]*?publishingOptions=\{[\s\S]*?<ContentPublishingOptions\b/.test(source)));
check("retired content Review owners are absent", !existsSync(new URL("../src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx", import.meta.url)) && !existsSync(new URL("../src/components/admin/content-workflow/MediaPublishChecklistPanel.tsx", import.meta.url)));
check("Review starts directly with quick decisions and retains advisory score wording", ["مراجعة قبل النشر", "تحقق من جاهزية المحتوى قبل نشره.", "نشر الآن", "حفظ المسودة", "إجراءات أخرى", "data-content-review-actions", "data-content-review-action"].every((token) => !review.includes(token)) && ["قرارات سريعة", "درجة جاهزية النشر", "الدرجة إرشادية ولا تمنع النشر وحدها."].every((token) => review.includes(token)));
check("Review is a card dashboard with no page-wide accordion", review.includes('data-content-review-presentation="dashboard"') && review.includes("data-content-review-decisions") && review.includes("data-content-review-analysis-grid") && !review.includes("AdminSingleOpenAccordion"));
check("the four analyses are independent cards with inline-only details", ["content", "image", "seo", "validation"].every((id) => review.includes(`id: "${id}"`)) && ["جاهزية المحتوى", "جاهزية الصورة وAlt", "تحليل SEO", "التحقق العام (Validation)"].every((label) => review.includes(label)) && review.includes("data-content-review-expanded") && review.includes("aria-expanded={expanded}") && review.includes("عرض التفاصيل") && !review.includes("Drawer") && !review.includes("Dialog"));
check("quick decisions resolve to four declarative visual units", ["score", "display-settings"].every((id) => review.includes(`data-content-review-decision="${id}"`)) && ["publication-schedule", "featured-popular"].every((id) => publishing.includes(`data-content-review-decision="${id}"`)) && review.includes("lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)]") && !["publication-status", "featured", "popular", "publish-date"].some((id) => publishing.includes(`data-content-review-decision="${id}"`)));
check("readiness priority exposes status counts and analysis navigation without aggregating issues", ["النشر متاح", "النشر يتطلب إصلاحًا", "المشكلات", "التحسينات", "data-content-review-score-details", 'aria-controls="content-review-analysis"', 'document.getElementById("content-review-analysis")'].every((token) => review.includes(token)) && !review.includes("data-content-review-all-issues"));
check("display settings correction uses the shared navigation contract", review.includes('targetId="content-display-settings"') && review.includes('label="تعديل الإعدادات"') && display.includes('id="content-display-settings"'));
check("general notes and the read-only review log are separate cards", review.includes("ملاحظات عامة") && review.includes("سجل المراجعة") && review.includes("data-content-review-notes") && review.includes("data-content-review-log") && review.includes("TimelineEntry"));
check("expanded analysis issues expose severity and the shared Fix action", review.includes("data-content-review-issue") && review.includes("data-content-review-severity") && review.includes("<ContentCorrectionButton"));
check("every actionable Review issue delegates to the shared Fix button", review.includes("<ContentCorrectionButton") && read("src/components/admin/content/editors/ContentCorrectionButton.tsx").includes("إصلاح"));
const legacyWarningCta = ["راجع", "التنبيهات"].join(" ");
check("forbidden legacy warning CTA is absent", !review.includes(legacyWarningCta) && !capability.includes(legacyWarningCta));
check("one correction registry covers common SEO FAQ video and gallery targets", ["content-title", "content-category-listbox", "content-seo-title", "topic-faq-editor", "video_url", "gallery-editor"].every((target) => capability.includes(target)));
check("one analysis owner contains common checks plus typed rich-media checks", ["buildContentReviewChecks", 'input.contentType === "video"', 'input.contentType === "gallery"', 'input.contentType === "article"'].every((token) => capability.includes(token)));
check("publishing UX is a binary switch while preserving the status field contract", publishing.includes('name="content_publication_toggle"') && publishing.includes('<input type="hidden" name="status"') && publishing.includes('published ? "published" : unpublishedStatus') && !publishing.includes("AdminFormListboxSelect"));
check("archive is outside the editor publication choice", publishing.includes("الأرشفة عملية مستقلة من إجراءات قائمة المحتوى") && !publishing.includes('{ value: "archived"'));
check("featured popular and visible date render for every content type", ["is_featured", "is_popular", "TopicDateLabelField"].every((token) => publishing.includes(token)) && mediaEditor.includes("popular={Boolean(values?.is_popular)}") && mediaEditor.includes("publishedAt={values?.published_at}"));
check("one display settings owner is mounted by article and media", [createEditor, editEditor, mediaEditor].every((source) => source.includes("<ContentDisplaySettings")) && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => display.includes(`name="${name}"`)));
check("media persistence saves the full shared publishing and display contract", ["is_popular: payload.isPopular", "date_label: payload.dateLabel", "formPublishedDate: payload.publishedAt", "show_title_on_page: payload.showTitleOnPage", "show_image_on_page: payload.showImageOnPage", "show_excerpt_on_page: payload.showExcerptOnPage"].every((token) => mediaHelpers.includes(token)));
check("media public detail read model selects all display flags", ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((field) => mediaLoader.includes(field)));
check("media public detail applies all display flags", ["showTitle={item.showTitleOnPage !== false}", "showHeroImage={item.showImageOnPage !== false}", "showSubtitle={item.showExcerptOnPage !== false}"].every((token) => mediaDetail.includes(token)));

console.log(`verify:topic-publish-checklist passed (${passed} assertions)`);
