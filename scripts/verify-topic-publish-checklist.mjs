import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  decisionCardElement,
  decisionCardElementCount,
  inspectReviewDecisionCard,
} from "./lib/review-decision-card-structure.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const sharedReview = read("src/components/admin/review/AdminEntityReviewPanel.tsx");
const reviewContract = read("src/lib/admin/review/entity-review-presentation.ts");
const capability = read("src/lib/admin/content-workflow/content-review-capability.ts");
const publishing = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const display = read("src/components/admin/content/editors/ContentDisplaySettings.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const mediaEditor = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
const mediaHelpers = read("src/app/admin/content/topics/media-actions/helpers.ts");
const publicContentOwner = read("src/lib/content/public-content-read/owner.ts");
const mediaDetail = read("src/components/media-center/MediaDetailPage.tsx");
const publicationDecision = inspectReviewDecisionCard(
  publishing,
  "ContentPublishingOptions.tsx",
  "publication-schedule",
);

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("one content Review owner serves article and all media editors", [createEditor, editEditor, mediaEditor].every((source) => source.match(/<ContentReviewPanel\b/g)?.length === 1));
check("Review composes the shared publishing owner once through its dashboard slot", [createEditor, editEditor, mediaEditor].every((source) => /<ContentReviewPanel\b[\s\S]*?publishingOptions=\{[\s\S]*?<ContentPublishingOptions\b/.test(source)));
check("retired content Review owners are absent", !existsSync(new URL("../src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx", import.meta.url)) && !existsSync(new URL("../src/components/admin/content-workflow/MediaPublishChecklistPanel.tsx", import.meta.url)));
check("Review starts directly with shared decision cards and retains advisory score wording", ["مراجعة قبل النشر", "تحقق من جاهزية المحتوى قبل نشره.", "نشر الآن", "حفظ المسودة", "إجراءات أخرى"].every((token) => !review.includes(token)) && ["قرارات سريعة", "حالة المحتوى والعرض", "حالة المشروع والعرض", "تبقى هذه القرارات مكشوفة دائمًا.", "decisionTitle"].every((token) => !sharedReview.includes(token) && !review.includes(token)) && ["درجة جاهزية النشر", "الدرجة إرشادية ولا تمنع النشر وحدها."].every((token) => sharedReview.includes(token)));
check("Review adopts the shared card dashboard with no page-wide accordion", review.includes("<AdminEntityReviewPanel") && review.includes('entityKey="content"') && sharedReview.includes('data-admin-entity-review-presentation="dashboard"') && ![review, sharedReview].some((source) => source.includes("AdminSingleOpenAccordion")));
check("the four analyses are independent cards with inline-only details", ["content", "image", "seo"].every((id) => review.includes(`id: "${id}"`)) && review.includes("جاهزية المحتوى") && review.includes("جاهزية الصور وAlt") && review.includes("تحليل SEO") && sharedReview.includes('id: "validation"') && sharedReview.includes("التحقق العام (Validation)") && sharedReview.includes("data-admin-entity-review-expanded") && sharedReview.includes("aria-expanded={expanded}") && !sharedReview.includes("Drawer") && !sharedReview.includes("Dialog"));
check("guidance analyses use one equal three-column row while Validation owns the full row below", sharedReview.includes("lg:grid-cols-3") && sharedReview.includes("data-admin-entity-review-guidance-grid") && sharedReview.includes("data-admin-entity-review-validation-row") && sharedReview.includes('variant="guidance"') && sharedReview.includes('variant="validation"'));
check("Validation presentation distinguishes blocking state without a new engine", ["تحقق مانع للنشر", "النشر ممنوع", "النشر مسموح", "مشكلة مانعة تحتاج إصلاحًا"].every((token) => sharedReview.includes(token)) && sharedReview.includes('item.blocksPublish && item.status === "fail"') && sharedReview.includes("items={blockingIssues}"));
check("quick decisions resolve to four declarative visual units", review.includes('id="display-settings"') && ["publication-schedule", "featured-popular"].every((id) => publishing.includes(`id="${id}"`)) && sharedReview.includes('data-admin-entity-review-decision="score"') && sharedReview.includes("lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)]"));
check("readiness priority exposes status counts and analysis navigation without aggregating issues", ["النشر متاح", "النشر يتطلب إصلاحًا", "المشكلات", "التحسينات", "data-admin-entity-review-score-details", "document.getElementById(analysisId)"].every((token) => sharedReview.includes(token)) && !sharedReview.includes("all-issues"));
check("display settings correction uses the shared navigation contract", review.includes('targetId="content-display-settings"') && review.includes('label="تعديل الإعدادات"') && display.includes('id="content-display-settings"'));
check("general notes and the read-only status summary are separate cards", sharedReview.includes("ملاحظات عامة") && sharedReview.includes("ملخص الحالة") && !sharedReview.includes("سجل المراجعة") && sharedReview.includes("data-admin-entity-review-notes") && sharedReview.includes("data-admin-entity-review-status-summary"));
check("expanded analysis issues expose severity and the shared Fix action", sharedReview.includes("data-admin-entity-review-issue") && sharedReview.includes("data-admin-entity-review-severity") && sharedReview.includes("<AdminEntityReviewCorrectionButton"));
check("every actionable Review issue delegates to the shared Fix button", sharedReview.includes("AdminEntityReviewCorrectionButton") && sharedReview.includes("إصلاح") && !existsSync(new URL("../src/components/admin/content/editors/ContentCorrectionButton.tsx", import.meta.url)));
const legacyWarningCta = ["راجع", "التنبيهات"].join(" ");
check("forbidden legacy warning CTA is absent", !review.includes(legacyWarningCta) && !capability.includes(legacyWarningCta));
check("one correction registry covers common SEO FAQ video and gallery targets", ["content-title", "content-category-listbox", "content-seo-title", "topic-faq-editor", "video_url", "gallery_image_url", "gallery_image_alt"].every((target) => capability.includes(target)));
check("one analysis owner contains common checks plus typed rich-media checks", ["buildContentReviewChecks", 'input.contentType === "video"', 'input.contentType === "gallery"', 'input.contentType === "article"'].every((token) => capability.includes(token)));
check("publish blocking is explicit and independent from presentation severity", reviewContract.includes("blocksPublish: boolean") && capability.includes("getContentPublishBlockingChecks") && capability.includes('item.blocksPublish && item.status === "fail"') && capability.includes("blocksPublish: false"));
check("publishing UX is a binary switch while preserving the status field contract", publishing.includes('name="content_publication_toggle"') && publishing.includes('type="hidden"') && publishing.includes('name="status"') && publishing.includes('published ? "published" : "unpublished"') && !publishing.includes("AdminFormListboxSelect"));
check("Content publication composition exposes one switch and no duplicate status badge", publicationDecision.title === "حالة النشر والتاريخ" && !publicationDecision.hasBadge && decisionCardElementCount(publicationDecision, "AdminStatusPill") === 0 && decisionCardElementCount(publicationDecision, "AdminFormSwitch") === 1 && decisionCardElement(publicationDecision, "AdminFormSwitch", { name: "content_publication_toggle" })?.attributes.describedBy === "content-publication-hint" && decisionCardElementCount(publicationDecision, "TopicDateLabelField") === 1);
check("legacy publication choices are absent from the binary editor", !publishing.includes('"draft"') && !publishing.includes('"archived"') && !publishing.includes("AdminFormListboxSelect"));
check("featured popular and visible date render for every content type", ["is_featured", "is_popular", "TopicDateLabelField"].every((token) => publishing.includes(token)) && mediaEditor.includes("popular={Boolean(values?.is_popular)}") && mediaEditor.includes("publishedAt={values?.published_at}"));
check("one display settings owner is mounted by article and media", [createEditor, editEditor, mediaEditor].every((source) => source.includes("<ContentDisplaySettings")) && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => display.includes(`name="${name}"`)));
check("media persistence saves the full shared publishing and display contract", ["is_popular: payload.isPopular", "date_label: payload.dateLabel", "formPublishedDate: payload.publishedAt", "show_title_on_page: payload.showTitleOnPage", "show_image_on_page: payload.showImageOnPage", "show_excerpt_on_page: payload.showExcerptOnPage"].every((token) => mediaHelpers.includes(token)));
check("Unified Content public detail selects all display flags", ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((field) => publicContentOwner.includes(field)));
check("media public detail applies all display flags", ["showTitle={item.showTitleOnPage !== false}", "showHeroImage={item.showImageOnPage !== false}", "showSubtitle={item.showExcerptOnPage !== false}"].every((token) => mediaDetail.includes(token)));

console.log(`verify:topic-publish-checklist passed (${passed} assertions)`);
