import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST,
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE,
} from "../src/lib/admin/seo/entity-seo-adoption-manifest.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sharedPath = "src/components/admin/seo/AdminEntitySeoPanel.tsx";
const topicPath = "src/components/admin/SeoPanel.tsx";
const projectPath =
  "src/components/admin/projects/entry/ProjectSeoPanel.tsx";
const shared = read(sharedPath);
const topic = read(topicPath);
const project = read(projectPath);
const topicCreate = read(
  "src/components/admin/content/editors/ArticleCreateEditor.tsx",
);
const topicEdit = read(
  "src/components/admin/content/editors/ArticleEditor.tsx",
);
const projectEditor = read("src/app/admin/projects/ProjectEditForm.tsx");
const accordion = read(
  "src/components/admin/ui/AdminSingleOpenAccordion.tsx",
);

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function occurrences(source: string, token: string) {
  return source.split(token).length - 1;
}

function block(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `Missing block ${start}`);
  return source.slice(startIndex, endIndex);
}

check(
  "Topic and Project adapters delegate Entity SEO presentation to one shared owner",
  topic.match(/<AdminEntitySeoPanel\b/g)?.length === 1 &&
    project.match(/<AdminEntitySeoPanel\b/g)?.length === 1 &&
    [topicCreate, topicEdit].every(
      (source) => source.match(/<SeoPanel\b/g)?.length === 1,
    ) &&
    projectEditor.match(/<ProjectSeoPanel\b/g)?.length === 1,
);

check(
  "the Topic adapter contains mappings and typed analysis only, not a parallel panel",
  topic.includes("AdminEntitySeoAnalysisExtension") &&
    topic.includes("analyzeTopicSeo") &&
    topic.includes("TOPIC_SEO_CORRECTION_TARGETS") &&
    topic.includes('mode: "entity_fallback"') &&
    ![
      "<AdminFormLayout",
      "<AdminSingleOpenAccordion",
      "<AdminMediaImageField",
      "<input",
      "<textarea",
      "function IssueRow",
      "function PreviewValue",
    ].some((token) => topic.includes(token)),
);

const terminology = [
  "عنوان صفحة محركات البحث (SEO Title)",
  "الوصف التعريفي لمحركات البحث (Meta Description)",
  "الكلمة المفتاحية الرئيسية (Focus Keyword)",
  "الكلمات المفتاحية الداعمة (SEO Keywords)",
  "الرابط الأساسي (Canonical URL)",
  "الفهرسة وتتبع الروابط (Robots)",
  "إعدادات المشاركة الاجتماعية (Open Graph)",
  "معاينة المشاركة الاجتماعية (Open Graph)",
] as const;

check(
  "one shared semantic owner defines and consumes the standard Entity SEO terminology",
  shared.includes("ADMIN_ENTITY_SEO_TERMINOLOGY") &&
    terminology.every(
      (label) =>
        occurrences(shared, label) === 1 &&
        !topic.includes(label) &&
        !project.includes(label),
    ),
);

check(
  "the shared Focus Keyword helper is exact and never falls back to the generic optional copy",
  occurrences(
    shared,
    "عبارة البحث الرئيسية التي تُحسب عليها الكثافة والتحليلات.",
  ) === 1 &&
    ![shared, topic, project].some((source) =>
      source.includes("قيمة اختيارية قابلة للتخصيص."),
    ),
);

const searchPreview = block(
  shared,
  "const searchResultPreviewContent",
  "const openGraphPreviewContent",
);
check(
  "the shared Search Result Preview resolves URL, title, description, Robots, and Links",
  searchPreview.includes("{canonical}") &&
    searchPreview.includes("{title}") &&
    searchPreview.includes("{description}") &&
    searchPreview.includes('label="Robots"') &&
    searchPreview.includes('label="Links"') &&
    ["الإعداد العام", "Index", "Noindex", "Follow", "Nofollow"].every(
      (value) => shared.includes(`"${value}"`),
    ),
);

const socialFields = block(
  shared,
  "const socialSharingFields",
  "const searchResultPreviewContent",
);
const socialPreview = block(
  shared,
  "const openGraphPreviewContent",
  "const liveSeoAnalysisContent",
);
check(
  "Social Settings own one optional override image pair while Preview stays read-only",
  occurrences(socialFields, "<AdminMediaImageField") === 1 &&
    occurrences(socialFields, "<input") === 1 &&
    socialFields.includes("name={social.fieldNames.image}") &&
    socialFields.includes("name={social.fieldNames.imageAlt}") &&
    socialFields.includes('social.mode === "editable_override"') &&
    socialFields.includes("data-admin-entity-seo-social-source") &&
    !["<input", "<textarea", "<AdminMediaImageField", "name="].some(
      (token) => socialPreview.includes(token),
    ),
);

check(
  "Project preserves explicit Open Graph overrides and Topic preserves its existing image fallback",
  project.includes('mode: "editable_override"') &&
    project.includes('image: "og_image"') &&
    project.includes('imageAlt: "og_image_alt"') &&
    topic.includes('mode: "entity_fallback"') &&
    topic.includes('image: "image"') &&
    topic.includes('imageAlt: "image_alt"') &&
    occurrences(topic, 'imageAlt: "image_alt"') === 1,
);

check(
  "Topic-specific rules extend the shared issue and metric contracts without local presentation",
  topic.includes("AdminEntitySeoAnalysisExtension<TopicSeoAnalysisState>") &&
    [
      '"keyword-intro"',
      '"image-alt-length"',
      '"keyword-alt"',
      '"keyword-density"',
      'issue.id === "faq"',
      'id: "faq-count"',
    ].every((token) => topic.includes(token)) &&
    shared.includes("readonly SeoIssue[]") &&
    shared.includes("readonly AdminEntitySeoAnalysisMetric[]"),
);

check(
  "the shared analysis presentation exposes stable code, severity, details, metrics, and empty state",
  [
    "data-admin-entity-seo-issue={issue.id",
    "data-admin-entity-seo-severity={issue.type}",
    "data-admin-entity-seo-issue-code",
    "<details",
    "data-admin-entity-seo-metrics",
    "لا توجد ملاحظات SEO متاحة حاليًا.",
  ].every((token) => shared.includes(token)),
);

check(
  "both adapters provide entity correction targets and the shared button dispatches navigation without submitting",
  [topic, project].every(
    (source) =>
      source.includes("correctionTargets=") &&
      source.includes('tabId: "seo"') &&
      source.includes('tabId: "basic"'),
  ) &&
    shared.includes('type="button"') &&
    shared.includes("new CustomEvent(navigationEventName") &&
    !shared.includes("window.location"),
);

check(
  "AdminSingleOpenAccordion is the sole Entity SEO disclosure owner",
  occurrences(shared, "<AdminSingleOpenAccordion") === 1 &&
    !topic.includes("AdminSingleOpenAccordion") &&
    !project.includes("AdminSingleOpenAccordion") &&
    accordion.includes("useState<string | null>") &&
    accordion.includes("aria-expanded={open}") &&
    accordion.includes('event.key === "ArrowDown"'),
);

check(
  "each shared submitted field binding is rendered once and previews own no save source",
  [
    "seoTitle",
    "seoDescription",
    "focusKeyword",
    "canonicalUrl",
    "robotsIndex",
    "robotsFollow",
  ].every((field) => occurrences(shared, `name={fieldNames.${field}}`) === 1) &&
    occurrences(shared, "name={fieldNames.seoKeywords}") === 2 &&
    occurrences(shared, "<AdminTagsField") === 1 &&
    !searchPreview.includes("name=") &&
    !socialPreview.includes("name=") &&
    !shared.includes("<form"),
);

const classifications = new Set(
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.map((entry) => entry.classification),
);
check(
  "the adoption manifest classifies every required surface family and every recorded source exists",
  [
    "shared_reference",
    "adopted",
    "legacy_generic_gap",
    "specialized_exception",
    "explicit_exception",
  ].every((classification) => classifications.has(classification as never)) &&
    [
      "entity_seo_editor",
      "global_seo_settings",
      "redirect_management",
      "sitemap_robots_utility",
      "specialized_exception",
    ].every((kind) =>
      ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some(
        (entry) => entry.surfaceKind === kind,
      ),
    ) &&
    ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.every((entry) =>
      entry.sourceFiles.every((sourceFile) => existsSync(sourceFile)),
    ),
);

check(
  "Global SEO capability remains explicitly open while entity-editor gaps remain recorded",
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.globalClosed === false &&
    ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.allowedClaim ===
      "topic_and_project_adoption_closed" &&
    ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.filter(
      (entry) => entry.classification === "legacy_generic_gap",
    ).length >= 2,
);

console.log(`\n${passed}/${passed} shared Entity SEO checks passed.`);
