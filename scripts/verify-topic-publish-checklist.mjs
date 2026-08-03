import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const categorySelect = read("src/components/admin/content/editors/ContentCategorySelect.tsx");
const checklist = read("src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const basicPanel = read("src/components/admin/content/editors/ContentBasicDataPanel.tsx");
const helpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
const publishingOptions = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const faqEditor = read("src/components/admin/content/editors/article/FaqEditor.tsx");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("category submits through one real select field", categorySelect.match(/<select\b/g)?.length === 1 && categorySelect.includes('name="category_id"') && !categorySelect.includes('type="hidden" name="category_id"'));
check("shared basic owner mounts one category control", basicPanel.match(/<ContentCategorySelect\b/g)?.length === 1);
check("article create and edit each mount one shared basic owner", [createEditor, editEditor].every((source) => source.match(/<ContentBasicDataPanel\b/g)?.length === 1));
check("checklist queries the category_id select explicitly", checklist.includes('form.querySelector(\'select[name="category_id"]\')'));
check("checklist validates category control type and selected option", checklist.includes("categoryControl instanceof HTMLSelectElement") && checklist.includes("selectedOptions.item(0)") && !checklist.includes("selectedOptions[0]"));
check("checklist form helpers narrow named controls safely", checklist.includes("item instanceof HTMLInputElement") && checklist.includes("item instanceof HTMLTextAreaElement") && checklist.includes("item instanceof HTMLSelectElement"));
check("category changes notify the mounted checklist", categorySelect.includes('dispatchEvent(new Event("change", { bubbles: true }))'));
check("category correction targets the unified visible listbox", checklist.includes('category: { tabId: "basic", targetId: "content-category-listbox" }') && categorySelect.includes('triggerId="content-category-listbox"'));
check("article save payload binds the category ID contract", helpers.includes('getString(formData, "category_id")') && helpers.includes("categoryId:"));

check("checklist reads live publication date and status", checklist.includes('publishedAt: field(form, "published_at", seed.publishedAt)') && checklist.includes('field(form, "status", seed.published ? "published" : "draft")') && checklist.includes('const publishDate = dateLabel || input.publishedAt || "غير محدد"'));
check("create and edit embed review inside the shared publishing owner", [createEditor, editEditor].every((source) => /<ContentPublishingOptions\b[\s\S]*?<TopicPublishChecklistPanel\b[\s\S]*?<\/ContentPublishingOptions>/.test(source)) && checklist.includes('data-topic-publish-review-presentation="embedded"'));
check("review keeps blockers, tasks, improvements, and summary", ["data-topic-publish-blockers", "data-topic-publishing-tasks", "data-topic-publish-improvements", "data-topic-publish-summary"].every((marker) => checklist.includes(marker)));
check("review keeps semantic status headers", checklist.match(/<ReviewCardHeader/g)?.length === 4 && checklist.includes("data-topic-publish-card-header") && checklist.includes("data-topic-publish-card-status"));
check("shared publishing owns one status control and optional article fields", /<AdminFormListboxSelect[\s\S]*?name="status"/.test(publishingOptions) && publishingOptions.match(/name="is_featured"/g)?.length === 1 && publishingOptions.match(/name="is_popular"/g)?.length === 1 && publishingOptions.includes("TopicDateLabelField"));
check("shared publishing does not duplicate FAQ visibility", !publishingOptions.includes('name="show_faq_on_page"') && faqEditor.match(/name="show_faq_on_page"/g)?.length === 1);
check("FAQ remains live and read-only inside review", checklist.includes('faqVisible: checked(form, "show_faq_on_page", seed.faqVisible)') && checklist.includes("input.faqVisible"));
check("create defaults and edit hydration use the same publishing owner", createEditor.includes('<ContentPublishingOptions\n                  status="draft"') && editEditor.includes("<ContentPublishingOptions") && editEditor.includes("featured={Boolean(topic.is_featured)}") && editEditor.includes("popular={Boolean(topic.is_popular)}") && editEditor.includes("publishedAt={topic.published_at}"));

console.log(`verify:topic-publish-checklist passed (${passed} assertions)`);
