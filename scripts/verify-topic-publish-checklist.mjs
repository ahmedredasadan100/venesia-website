import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const categorySelect = read("src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx");
const checklist = read("src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const basicPanel = read("src/components/admin/content/editors/article/TopicBasicDataPanel.tsx");
const helpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
const publishingOptions = read("src/components/admin/content/editors/article/TopicPublishingOptions.tsx");
const faqEditor = read("src/components/admin/content/editors/article/FaqEditor.tsx");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check(
  "category control submits through one select field",
  /<select[\s\S]*?name=\{name\}[\s\S]*?<\/select>/.test(categorySelect) &&
    categorySelect.match(/<select/g)?.length === 1 &&
    !categorySelect.includes('type="hidden" name={name}'),
);
check(
  "create editor owns one category control",
  createEditor.match(/<TopicBasicDataPanel/g)?.length === 1 &&
    basicPanel.match(/<ArticleTopicCategorySelect/g)?.length === 1,
);
check(
  "edit editor owns one category control",
  editEditor.match(/<TopicBasicDataPanel/g)?.length === 1 &&
    basicPanel.match(/<ArticleTopicCategorySelect/g)?.length === 1,
);
check(
  "checklist queries the category select explicitly",
  checklist.includes('form.querySelector(\'select[name="category_slug"]\')'),
);
check(
  "checklist verifies the runtime category control type",
  checklist.includes("categoryControl instanceof HTMLSelectElement"),
);
check(
  "checklist reads the selected option without array indexing",
  checklist.includes("selectedOptions.item(0)") &&
    !checklist.includes("selectedOptions[0]"),
);
check(
  "checklist form helpers reject unverified namedItem results",
  checklist.includes("item instanceof HTMLInputElement") &&
    checklist.includes("item instanceof HTMLTextAreaElement") &&
    checklist.includes("item instanceof HTMLSelectElement"),
);
check(
  "checklist reads the live named publication date into summary state",
  checklist.includes("publishedAt: string") &&
    checklist.includes('publishedAt: field(form, "published_at", seed.publishedAt)') &&
    checklist.includes('publishedAt: publishedAt?.slice(0, 10) ?? ""') &&
    checklist.includes('const publishDate = dateLabel || input.publishedAt || "غير محدد"') &&
    !checklist.includes("const publishDate = dateLabel || publishedAt?.slice"),
);
check(
  "category changes notify the mounted checklist",
  categorySelect.includes('dispatchEvent(new Event("change", { bubbles: true }))'),
);
check(
  "category slug remains bound to the existing save payload",
  helpers.includes('categorySlug: getString(formData, "category_slug")'),
);
check(
  "Create and Edit embed one shared review inside one shared publishing owner",
  [createEditor, editEditor].every((source) =>
    /<TopicPublishingOptions\b[\s\S]*?<TopicPublishChecklistPanel\b[\s\S]*?<\/TopicPublishingOptions>/.test(source),
  ) &&
    publishingOptions.includes("data-topic-publishing-review-slot") &&
    checklist.includes('data-topic-publish-review-presentation="embedded"') &&
    checklist.includes('className="grid gap-4 lg:grid-cols-2"') &&
    ![createEditor, editEditor, publishingOptions, checklist].some((source) =>
      /(?:^|[<\s])presentation="(?:embedded|integrated)"/m.test(source) ||
      source.includes('presentation?: "default"'),
    ),
);
check(
  "shared review keeps four coherent equal-height two-by-two cells",
  checklist.includes('const cardClassName = "flex h-full min-h-0 min-w-0 flex-col rounded-2xl bg-black/20 p-4"') &&
    checklist.match(/\$\{cardClassName\}/g)?.length === 4 &&
    checklist.match(/<ReviewCardHeader/g)?.length === 4 &&
    checklist.includes("data-topic-publish-card-header") &&
    checklist.includes("data-topic-publish-card-status") &&
    !checklist.includes("xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]") &&
    [
      "data-topic-publish-blockers",
      "data-topic-publishing-tasks",
      "data-topic-publish-improvements",
      "data-topic-publish-summary",
    ].every((marker) => checklist.includes(marker)),
);
check(
  "shared publishing keeps one balanced four-cell field source without FAQ ownership",
  publishingOptions.includes('className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch ${status ? "mt-5" : ""}`.trim()}') &&
    publishingOptions.match(/className="contents"/g)?.length === 2 &&
    ["is_featured", "is_popular", "is_published"].every((name) =>
      publishingOptions.match(new RegExp(`name="${name}"`, "g"))?.length === 1,
    ) &&
    publishingOptions.includes("TopicDateLabelField") &&
    publishingOptions.includes("الحالة: {status}") &&
    !publishingOptions.includes("إجراءات النشر") &&
    !publishingOptions.includes("تُطبّق حالة النشر مع باقي بيانات الموضوع عند الضغط على حفظ.") &&
    !publishingOptions.includes("presentation?:") &&
    !publishingOptions.includes("presentation ===") &&
    !publishingOptions.includes("data-topic-faq-visibility-slot") &&
    !publishingOptions.includes('name="show_faq_on_page"'),
);
check(
  "legitimate Create defaults and Edit hydration do not fork publishing presentation",
  createEditor.includes('<TopicPublishingOptions status="draft">') &&
    !createEditor.includes("featured={") &&
    !createEditor.includes("popular={") &&
    !createEditor.includes("publishedAt={topic.") &&
    !createEditor.includes("initialDisplay={{") &&
    editEditor.includes("featured={Boolean(topic.is_featured)}") &&
    editEditor.includes("popular={Boolean(topic.is_popular)}") &&
    editEditor.includes("publishedAt={topic.published_at}") &&
    editEditor.includes("initialDisplay={{"),
);
check(
  "FAQ visibility remains one FaqEditor-owned source in the FAQ tab and read-only in review",
  faqEditor.match(/name="show_faq_on_page"/g)?.length === 1 &&
    faqEditor.includes("{faqVisibilitySwitch}") &&
    !faqEditor.includes("createPortal") &&
    !faqEditor.includes("visibilityPortalTargetId") &&
    ![createEditor, editEditor].some((source) => source.includes("faqVisibilitySlotId")) &&
    checklist.includes('faqVisible: checked(form, "show_faq_on_page", seed.faqVisible)') &&
    checklist.includes("input.faqVisible") &&
    !publishingOptions.includes('name="show_faq_on_page"'),
);

console.log(`verify:topic-publish-checklist passed (${passed} assertions)`);
