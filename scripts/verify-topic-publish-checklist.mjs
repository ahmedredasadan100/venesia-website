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
check("Review is embedded once inside the shared publishing owner", [createEditor, editEditor, mediaEditor].every((source) => /<ContentPublishingOptions\b[\s\S]*?<ContentReviewPanel\b[\s\S]*?<\/ContentPublishingOptions>/.test(source)));
check("retired content Review owners are absent", !existsSync(new URL("../src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx", import.meta.url)) && !existsSync(new URL("../src/components/admin/content-workflow/MediaPublishChecklistPanel.tsx", import.meta.url)));
check("Review exposes an advisory score and the exact non-blocking guidance", review.includes("درجة جاهزية المحتوى") && review.includes("الدرجة إرشادية ولا تمنع النشر وحدها."));
check("Review uses the shared single-open accordion and severity issue cards", review.includes("<AdminSingleOpenAccordion") && review.includes("data-content-review-issue") && review.includes("data-content-review-severity"));
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
