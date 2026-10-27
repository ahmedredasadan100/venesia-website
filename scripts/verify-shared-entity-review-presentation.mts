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
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;
  (module as NodeModule & { _compile(source: string, filename: string): void })._compile(
    output,
    filename,
  );
};
require.extensions[".tsx"] = require.extensions[".ts"];

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
const mediaFormPath = "src/components/admin/content/editors/media/MediaContentForm.tsx";
const mediaForm = read(mediaFormPath);
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

function hasMediaReviewPanel(input: string) {
  const tree = ts.createSourceFile(mediaFormPath, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ? unwrap(node.expression) : node;
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => {
    const value = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer;
    return value && (ts.isJsxExpression(value) ? value.expression : value);
  };
  const staticValue = (node: ts.Expression | undefined, expected: string | undefined) => {
    if (!node) return false;
    node = unwrap(node);
    return expected === undefined ? ts.isIdentifier(node) && node.text === "undefined" : ts.isStringLiteral(node) && node.text === expected;
  };
  const imports = new Map<string, string>();
  for (const node of tree.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.name) {
      imports.set(node.importClause.name.text, resolve(dirname(resolve(ROOT, mediaFormPath)), `${node.moduleSpecifier.text}.tsx`));
    }
  }
  const owners = [
    ["ContentReviewPanel", "src/components/admin/content-workflow/ContentReviewPanel.tsx"],
    ["ContentPublishingOptions", "src/components/admin/content/editors/ContentPublishingOptions.tsx"],
  ];
  for (const [owner, path] of owners) {
    const calls = nodes.filter((node): node is ts.JsxOpeningLikeElement => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === owner);
    if (imports.get(owner!) !== resolve(ROOT, path!) || calls.length !== 1 || calls[0]!.attributes.properties.some(ts.isJsxSpreadAttribute) || !staticValue(attribute(calls[0]!, "presentation"), "panel")) return false;
  }
  const publishTabs = nodes.filter(ts.isObjectLiteralExpression).filter((node) => node.properties.some((property) =>
    ts.isPropertyAssignment(property) && property.name.getText(tree) === "id" && staticValue(property.initializer, "publish")));
  const header = publishTabs[0]?.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(tree) === "sectionHeaderPresentation");
  const shells = nodes.filter((node): node is ts.JsxOpeningLikeElement => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === "ContentEditorShell");
  return publishTabs.length === 1 && staticValue(header?.initializer, "premium") && shells.length === 1 &&
    attribute(shells[0]!, "mode")?.getText(tree) === "mode" && attribute(shells[0]!, "contentType")?.getText(tree) === "contentType";
}

check("All five Media Create/Edit consumers explicitly forward Panel to existing Review and Publishing owners and the Premium tab header", hasMediaReviewPanel(mediaForm));
for (const [label, mutated] of [
  ["record gate", mediaForm.replace(/(<ContentReviewPanel\s+)presentation="panel"/, '$1presentation={values?.id === 1639 ? "panel" : undefined}')],
  ["one type only", mediaForm.replace(/(<ContentReviewPanel\s+)presentation="panel"/, '$1presentation={contentType === "video" ? "panel" : undefined}')],
  ["dashboard fallback", mediaForm.replace(/(<ContentReviewPanel\s+)presentation="panel"/, '$1presentation="default"')],
  ["dropped forwarding", mediaForm.replace(/(<ContentReviewPanel\s+)presentation="panel"/, '$1')],
  ["lost header opt-in", mediaForm.replace('sectionHeaderPresentation: "premium" as const,', '')],
  ["parallel owner", mediaForm.replace('/content-workflow/ContentReviewPanel"', '/content-workflow/ParallelReviewPanel"')],
  ["lost Create mode", mediaForm.replaceAll('mode={mode}', 'mode="edit"')],
] as const) {
  check(`negative Media review fixture rejects ${label}`, mutated !== mediaForm && !hasMediaReviewPanel(mutated));
}

check(
  "one neutral shared Entity Review Presentation owns the dashboard",
  sharedPanel.includes("export default function AdminEntityReviewPanel") &&
    sharedPanel.includes("AdminEntityReviewDecisionCard") &&
    sharedPanel.includes("AdminEntityReviewCorrectionButton") &&
    sharedPanel.includes('data-admin-entity-review-presentation={panel ? "panel" : "dashboard"}') && sharedPanel.includes('presentation = "default"'),
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
  contentAdapter.includes("buildContentReviewChecks(reviewInput)") &&
    contentAdapter.includes("controlledValues ? { ...input, ...controlledValues } : input") &&
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
  code: "VALID-PROJECT",
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
  brochure_url: "https://example.com/valid-project-brochure.pdf",
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

const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const SharedReview = (require("../src/components/admin/review/AdminEntityReviewPanel.tsx") as typeof import("../src/components/admin/review/AdminEntityReviewPanel.tsx")).default;
const renderReview = (checks: readonly import("../src/lib/admin/review/entity-review-presentation.ts").EntityReviewCheck[], presentation?: "default" | "panel") => renderToStaticMarkup(React.createElement(SharedReview, {
  entityKey: "content", navigationEventName: "fixture:review", checks,
  guidanceCards: [
    { id: "content", title: "جاهزية المحتوى", description: "محتوى", group: "content" },
    { id: "image", title: "جاهزية الصور وAlt", description: "صورة", group: "image" },
    { id: "seo", title: "تحليل SEO", description: "بحث", group: "seo" },
  ], decisionCards: null, summaryEntries: [{ id: "save", title: "آخر حفظ", value: "لم يُحفظ بعد" }], ...(presentation ? { presentation } : {}),
}));
const allPass: import("../src/lib/admin/review/entity-review-presentation.ts").EntityReviewCheck[] = ["content", "image", "seo"].map((group, index) => ({ id: "pass-" + index, label: "فحص " + index, hint: "سليم", group: group as "content" | "image" | "seo", status: "pass", severity: "success", blocksPublish: true }));
const reviewStates = [
  { name: "empty", checks: [] },
  { name: "all-pass", checks: allPass },
  { name: "blocking-and-notes", checks: [{ ...allPass[0]!, status: "fail", severity: "error" }, { ...allPass[1]!, status: "warn", severity: "warning", blocksPublish: false }, { ...allPass[2]!, status: "info", severity: "info", blocksPublish: false }] },
] satisfies Array<{ name: string; checks: import("../src/lib/admin/review/entity-review-presentation.ts").EntityReviewCheck[] }>;
for (const state of reviewStates) {
  const omitted = renderReview(state.checks), explicit = renderReview(state.checks, "default"), panel = renderReview(state.checks, "panel");
  check(`actual ${state.name} Review keeps omitted and explicit default output identical`, omitted === explicit && omitted.includes('data-admin-entity-review-presentation="dashboard"') && !omitted.includes('data-admin-tab-section-presentation="premium"'));
  check(`actual ${state.name} panel retains production score and blocking/notes fallback semantics`, panel.includes('data-admin-entity-review-presentation="panel"') && panel.includes(`aria-label="درجة جاهزية النشر ${getEntityReviewScore(state.checks)} من 100"`) && panel.includes(state.checks.some(item => item.blocksPublish && item.status === "fail") ? "النشر ممنوع" : "النشر مسموح") && (state.checks.some(item => item.status === "warn" || item.status === "info") ? panel.includes("سليم") : panel.includes("لا توجد اقتراحات غير مانعة في الحالة الحالية.")) && !panel.includes('name="status"'));
  check(`actual ${state.name} panel removes only the top-issue heading and retains the real issue or healthy fallback`, omitted.includes("أهم مشكلة") && !panel.includes("أهم مشكلة") && (state.checks.some(item => item.status !== "pass") ? panel.includes("فحص 0") && panel.includes("سليم") : panel.includes("لا توجد مشكلات حالية.")));
}
const ContentReview = (require("../src/components/admin/content-workflow/ContentReviewPanel.tsx") as typeof import("../src/components/admin/content-workflow/ContentReviewPanel.tsx")).default;
const Publishing = (require("../src/components/admin/content/editors/ContentPublishingOptions.tsx") as typeof import("../src/components/admin/content/editors/ContentPublishingOptions.tsx")).default;
const renderContentReview = (presentation?: "default" | "panel", contentType: "article" | "video" = "article") => renderToStaticMarkup(React.createElement(ContentReview, {
  formId: "review-presentation-fixture", contentTypeLabel: contentType === "video" ? "فيديو" : "مقال", initial: { contentType, title: "", slug: "", excerpt: "", content: "", image: "", imageAlt: "", categorySlug: "", seoTitle: "", seoDescription: "", focusKeyword: "", canonicalUrl: "", ogImage: "", ogImageAlt: "" }, publishingOptions: React.createElement(Publishing, presentation ? { presentation } : {}), ...(presentation ? { presentation } : {}),
}));
const defaultContent = renderContentReview(), panelContent = renderContentReview("panel");
const removedPanelDescriptions = ["تحكم مباشر في المميز والشائع.", "حالة المحتوى وموعد ظهوره العام.", "اكتمال مادة المحتوى والمتطلبات الخاصة بنوعها.", "توفر الصورة ووصفها البديل للعرض وإتاحة الوصول.", "سلامة بيانات البحث والمشاركة والربط الداخلي.", "ما سيظهر داخل صفحة المحتوى.", "أهم مشكلة"];
check("actual Content adapter and Publishing preserve omitted default output, legacy descriptions and score advisory", defaultContent === renderContentReview("default") && removedPanelDescriptions.every(text => defaultContent.includes(text)) && defaultContent.includes("7 خيارات") && defaultContent.includes("الدرجة إرشادية ولا تمنع النشر وحدها."));
check("actual Content panel removes only requested descriptions and badge copy", removedPanelDescriptions.every(text => !panelContent.includes(text)) && !panelContent.includes("7 حالات") && !panelContent.includes("7 خيارات"));
check("actual Content panel removes the score advisory only while retaining validation truth and actual top issue", !panelContent.includes("الدرجة إرشادية ولا تمنع النشر وحدها.") && panelContent.includes("يعرض موانع النشر المعروفة") && panelContent.includes("أضف عنوانًا واضحًا للمحتوى.") && panelContent.includes("حالة النشر والتاريخ"));
check("actual Content panel retains seven read-only display entries and the existing edit action", panelContent.includes("تعديل الإعدادات") && (panelContent.match(/<dt[^>]*>إظهار [^<]*<\/dt>/g) ?? []).length === 7);
const videoDefault = renderContentReview(undefined, "video"), videoPanel = renderContentReview("panel", "video");
check("actual Video review preserves omitted defaults and canonical readiness, validation, navigation and native publishing contracts", videoDefault === renderContentReview("default", "video") &&
  videoPanel.includes('data-admin-entity-review-presentation="panel"') && videoPanel.includes("درجة جاهزية النشر") && videoPanel.includes("النشر ممنوع") &&
  videoPanel.includes('data-admin-entity-review-status-summary') && videoPanel.includes('md:grid-cols-3') && videoPanel.includes('data-admin-entity-review-notes') &&
  videoPanel.includes("حالة النشر والتاريخ") && videoPanel.includes('name="status"') && videoPanel.includes('name="published_at"') &&
  videoPanel.includes('name="is_featured"') && videoPanel.includes('name="is_popular"') && videoPanel.includes("تعديل الإعدادات") &&
  (videoPanel.match(/<dt[^>]*>إظهار [^<]*<\/dt>/g) ?? []).length === 7 && removedPanelDescriptions.every(text => !videoPanel.includes(text)));
console.log(`verify:shared-entity-review-presentation passed (${passed} assertions)`);
