import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import {
  decisionCardElement,
  decisionCardElementCount,
  inspectReviewDecisionCard,
} from "./lib/review-decision-card-structure.mjs";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  (module as NodeModule & { _compile(source: string, filename: string): void })._compile(
    output,
    filename,
  );
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const sharedPanel = read("src/components/admin/review/AdminEntityReviewPanel.tsx");
const sharedContract = read("src/lib/admin/review/entity-review-presentation.ts");
const contentAdapter = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const projectAdapter = read("src/components/admin/projects/ProjectPublishChecklistPanel.tsx");
const contentCapability = read("src/lib/admin/content-workflow/content-review-capability.ts");
const projectContract = read("src/lib/admin/projects/project-entry-contract.ts");
const projectPublishing = read("src/lib/admin/projects/project-publishing-capability.ts");
const contentShell = read("src/components/admin/content/editors/ContentEditorShell.tsx");
const projectForm = read("src/app/admin/projects/ProjectEditForm.tsx");
const projectSeo = read("src/components/admin/projects/entry/ProjectSeoPanel.tsx");
const moduleTabs = read("src/components/admin/ui/AdminModuleTabs.tsx");
const contentPublishing = read(
  "src/components/admin/content/editors/ContentPublishingOptions.tsx",
);
const {
  assessProjectEntryPayload,
  createEmptyProjectEntry,
  PROJECT_ENTRY_VALIDATION_FIELDS,
} = require("../src/lib/admin/projects/project-entry-contract.ts") as typeof import("../src/lib/admin/projects/project-entry-contract.ts");
const { getProjectPublishingReadiness } = require("../src/lib/admin/projects/project-publishing-capability.ts") as typeof import("../src/lib/admin/projects/project-publishing-capability.ts");
const { getEntityReviewScore } = require("../src/lib/admin/review/entity-review-presentation.ts") as typeof import("../src/lib/admin/review/entity-review-presentation.ts");
const contentPublicationCard = inspectReviewDecisionCard(
  contentPublishing,
  "ContentPublishingOptions.tsx",
  "publication-schedule",
);
const projectPublicationCard = inspectReviewDecisionCard(
  projectAdapter,
  "ProjectPublishChecklistPanel.tsx",
  "publication-schedule",
);

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check(
  "one neutral shared Entity Review Presentation owns the dashboard",
  sharedPanel.includes("export default function AdminEntityReviewPanel") &&
    sharedPanel.includes("AdminEntityReviewDecisionCard") &&
    sharedPanel.includes("AdminEntityReviewCorrectionButton") &&
    sharedPanel.includes('data-admin-entity-review-presentation="dashboard"'),
);
check(
  "Content and Project both adopt the one shared presentation",
  [contentAdapter, projectAdapter].every(
    (source) => source.match(/<AdminEntityReviewPanel\b/g)?.length === 1,
  ) &&
    contentAdapter.includes('entityKey="content"') &&
    projectAdapter.includes('entityKey="project"'),
);
check(
  "the shared owner keeps the established four-unit decisions and analysis geometry",
  sharedPanel.includes("lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)]") &&
    sharedPanel.includes("lg:grid-cols-3") &&
    sharedPanel.includes("data-admin-entity-review-validation-row") &&
    sharedPanel.includes("md:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)_auto]"),
);
check(
  "decision cards start immediately without a duplicate heading contract",
  ![sharedPanel, contentAdapter, projectAdapter].some((source) =>
    [
      "decisionTitle",
      "قرارات سريعة",
      "حالة المحتوى والعرض",
      "حالة المشروع والعرض",
      "تبقى هذه القرارات مكشوفة دائمًا.",
    ].some((token) => source.includes(token)),
  ) && sharedPanel.includes("data-admin-entity-review-decisions"),
);
check(
  "analysis details expand inline and retain Severity and Fix",
  sharedPanel.includes("aria-expanded={expanded}") &&
    sharedPanel.includes("data-admin-entity-review-severity") &&
    sharedPanel.includes("<AdminEntityReviewCorrectionButton") &&
    !["Drawer", "Dialog", "window.location"].some((token) => sharedPanel.includes(token)),
);
check(
  "Fix dispatches each existing domain navigation event to AdminModuleTabs",
  sharedPanel.includes("new CustomEvent(navigationEventName") &&
    contentAdapter.includes("CONTENT_EDITOR_NAVIGATION_EVENT") &&
    projectAdapter.includes("PROJECT_ENTRY_NAVIGATION_EVENT") &&
    moduleTabs.includes("scrollIntoView") &&
    moduleTabs.includes("focus({ preventScroll: true })"),
);
check(
  "Content keeps its existing review capability as its domain adapter",
  contentAdapter.includes("buildContentReviewChecks(input)") &&
    contentCapability.includes("buildContentReviewChecks") &&
    !projectAdapter.includes("content-review-capability"),
);
check(
  "Project maps a complete assessment from the existing Validation Truth and publishing readiness",
  projectAdapter.includes("assessProjectEntryPayload(payload)") &&
    projectAdapter.includes("getProjectPublishingReadiness") &&
    projectAdapter.includes("snapshot.readiness.checks.map") &&
    projectContract.includes("PROJECT_ENTRY_VALIDATION_FIELDS.map") &&
    projectPublishing.includes("validationChecks:") &&
    projectPublishing.includes("checks: ProjectPublishingCheck[]") &&
    !projectAdapter.includes("function validate") &&
    !projectAdapter.includes("new Validator"),
);
check(
  "Project keeps shared Entity SEO without a parallel SEO review engine",
  projectSeo.includes("<AdminEntitySeoPanel") &&
    projectSeo.includes("ENTITY_SEO_FIELD_NAMES") &&
    projectAdapter.includes('title: "تحليل SEO"') &&
    !projectAdapter.includes("analyzeSeo") &&
    !projectAdapter.includes("scoreSeo"),
);
check(
  "Project groups status with first-publish date and exposes only existing featured and public-path contracts",
  ["publication_status", "published_at", "featured", "slug"].every((field) =>
    projectAdapter.includes(field),
  ) &&
    ["publication-schedule", "featured", "public-display"].every((id) =>
      projectAdapter.includes(`id=\"${id}\"`),
    ) &&
    !projectAdapter.includes('id="publication-date"') &&
    projectAdapter.match(/initial\.project\.published_at/g)?.length === 1 &&
    !projectAdapter.includes("popular") &&
    !projectAdapter.includes("display-settings"),
);
check(
  "Content and Project publication cards have one structural status indicator with no badge drift",
  [contentPublicationCard, projectPublicationCard].every(
    (card) =>
      card.title === "حالة النشر والتاريخ" &&
      !card.hasBadge &&
      decisionCardElementCount(card, "AdminFormSwitch") === 1 &&
      decisionCardElementCount(card, "AdminStatusPill") === 0,
  ) &&
    decisionCardElement(contentPublicationCard, "AdminFormSwitch", {
      name: "content_publication_toggle",
    })?.attributes.id === "content-status" &&
    decisionCardElement(projectPublicationCard, "AdminFormSwitch", {
      name: "publication_status",
    })?.attributes.id === "project-publication-status",
);
const contentStatusSwitch = decisionCardElement(
  contentPublicationCard,
  "AdminFormSwitch",
);
const contentDateField = decisionCardElement(
  contentPublicationCard,
  "TopicDateLabelField",
);
const contentStatusHelper = decisionCardElement(contentPublicationCard, "p", {
  id: "content-publication-hint",
});
const projectStatusSwitch = decisionCardElement(
  projectPublicationCard,
  "AdminFormSwitch",
);
const projectFirstPublish = decisionCardElement(
  projectPublicationCard,
  "ProjectDecision",
  { label: "تاريخ أول نشر" },
);
const projectStatusHelper = decisionCardElement(projectPublicationCard, "p", {
  id: "project-publication-hint",
});
check(
  "the symmetric publication cards keep control then domain date then helper hierarchy",
  Boolean(
    contentStatusSwitch &&
      contentDateField &&
      contentStatusHelper &&
      contentStatusSwitch.start < contentDateField.start &&
      contentDateField.start < contentStatusHelper.start &&
      projectStatusSwitch &&
      projectFirstPublish &&
      projectStatusHelper &&
      projectStatusSwitch.start < projectFirstPublish.start &&
      projectFirstPublish.start < projectStatusHelper.start,
  ),
);
check(
  "remaining decision composition differences are limited to declared domain contracts",
  decisionCardElementCount(contentPublicationCard, "TopicDateLabelField") === 1 &&
    decisionCardElementCount(projectPublicationCard, "TopicDateLabelField") === 0 &&
    decisionCardElementCount(projectPublicationCard, "ProjectDecision") === 1 &&
    (projectPublicationCard.sourceText.match(/initial\.project\.published_at/g) ?? [])
      .length === 1 &&
    contentPublishing.includes('name="is_popular"') &&
    !projectAdapter.includes("popular") &&
    projectAdapter.includes('id="public-display"') &&
    !contentPublishing.includes('id="public-display"'),
);
check(
  "Content and Project use the same official analysis titles with domain detail in descriptions",
  [contentAdapter, projectAdapter].every((source) =>
    ["جاهزية المحتوى", "جاهزية الصور وAlt", "تحليل SEO"].every((title) =>
      source.includes(`title: \"${title}\"`),
    ),
  ) &&
    projectAdapter.includes("Hero وGallery وMedia"),
);
check(
  "Validation copy and blocking semantics have one shared truthful presentation contract",
  sharedContract.includes(
    "يعرض موانع النشر المعروفة من بيانات النموذج، ويتحقق الخادم نهائيًا من القيود الحية عند الحفظ.",
  ) &&
    sharedPanel.includes("ADMIN_ENTITY_REVIEW_VALIDATION_DESCRIPTION") &&
    sharedPanel.includes('item.blocksPublish && item.status === "fail"') &&
    ![contentAdapter, projectAdapter].some((source) =>
      source.includes("validationDescription="),
    ),
);
check(
  "Content and Project share the official Review and Publish tab label",
  sharedContract.includes('ADMIN_ENTITY_REVIEW_TAB_LABEL = "المراجعة والنشر"') &&
    [contentShell, projectForm].every((source) =>
      source.includes("ADMIN_ENTITY_REVIEW_TAB_LABEL"),
    ),
);
check(
  "legacy parallel review presentation files are retired",
  [
    "src/components/admin/content-workflow/PublishChecklist.tsx",
    "src/lib/admin/content-workflow/publish-checklist-types.ts",
    "src/components/admin/content/editors/ContentCorrectionButton.tsx",
  ].every((path) => !existsSync(resolve(ROOT, path))),
);
check(
  "the adoption adds no Runtime Capability Engine or navigation owner",
  !sharedContract.includes("Runtime") &&
    !sharedContract.includes("Engine") &&
    projectContract.includes('PROJECT_ENTRY_NAVIGATION_EVENT = "admin-project-entry:navigate"') &&
    contentAdapter.includes("CONTENT_EDITOR_NAVIGATION_EVENT") &&
    !sharedPanel.includes('entityKey === "content"') &&
    !sharedPanel.includes('entityKey === "project"') &&
    !sharedPanel.includes("content-review-capability") &&
    !sharedPanel.includes("project-publishing-capability"),
);

const emptyProject = createEmptyProjectEntry();
const emptyValidation = assessProjectEntryPayload(emptyProject);
const emptyReadiness = getProjectPublishingReadiness({
  validationChecks: emptyValidation.checks,
  seoTitle: emptyProject.project.seo_title,
  seoDescription: emptyProject.project.seo_description,
});
check(
  "an incomplete Project exposes the complete stable matrix and can never score 100 from an empty issue list",
  emptyReadiness.checks.length === PROJECT_ENTRY_VALIDATION_FIELDS.length + 2 &&
    new Set(emptyReadiness.checks.map((item) => item.id)).size ===
      emptyReadiness.checks.length &&
    emptyReadiness.checks.some((item) => item.status === "fail") &&
    emptyReadiness.checks.some((item) => item.status === "warn") &&
    getEntityReviewScore(emptyReadiness.checks as never) < 100 &&
    getEntityReviewScore([]) === 0,
);

const validProject = createEmptyProjectEntry();
Object.assign(validProject.project, {
  arabic_name: "مشروع صالح",
  english_name: "Valid Project",
  slug: "valid-project",
  general_description: "وصف عام صالح للمشروع",
  short_description: "وصف مختصر صالح للمشروع",
  image: "/images/project-card.jpg",
  image_alt: "صورة بطاقة المشروع",
  hero_image: "/images/project-hero.jpg",
  hero_image_alt: "صورة واجهة المشروع",
  small_box_image: "/images/project-small.jpg",
  small_box_image_alt: "صورة المشروع المصغرة",
  governorate_id: 1,
  city_id: 2,
  main_area_id: 3,
  location_label: "القاهرة الجديدة",
  google_maps_url: "https://maps.example.com/project",
  latitude: "30.012345",
  longitude: "31.123456",
  map_zoom: "15",
  overview_title: "نظرة عامة",
  overview_body: "<p>تفاصيل المشروع</p>",
  overview_media_type: "image",
  overview_main_image: "/images/project-overview.jpg",
  overview_main_image_alt: "صورة النظرة العامة",
  delivery_title: "التنفيذ والتسليم",
  delivery_body: "<p>تفاصيل التنفيذ والتسليم</p>",
  seo_title: "عنوان SEO مخصص للمشروع",
  seo_description: "وصف SEO مخصص للمشروع",
});
const validValidation = assessProjectEntryPayload(validProject);
const validReadiness = getProjectPublishingReadiness({
  validationChecks: validValidation.checks,
  seoTitle: validProject.project.seo_title,
  seoDescription: validProject.project.seo_description,
});
check(
  "Project score reaches 100 only after every evaluated check passes",
  Object.keys(validValidation.fieldErrors).length === 0 &&
    validReadiness.checks.every((item) => item.status === "pass") &&
    getEntityReviewScore(validReadiness.checks as never) === 100,
);

console.log(`verify:shared-entity-review-presentation passed (${passed} assertions)`);
