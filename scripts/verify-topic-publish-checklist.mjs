import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const categorySelect = read("src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx");
const checklist = read("src/components/admin/content-workflow/TopicPublishChecklistPanel.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const basicPanel = read("src/components/admin/content/editors/article/TopicBasicDataPanel.tsx");
const helpers = read("src/app/admin/content/topics/article-actions/helpers.ts");

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

console.log(`verify:topic-publish-checklist passed (${passed} assertions)`);
