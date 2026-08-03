import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  "Project maps only existing Validation Truth and publishing readiness",
  projectAdapter.includes("validateProjectEntryPayload(payload)") &&
    projectAdapter.includes("getProjectPublishingReadiness") &&
    projectPublishing.includes("fieldErrors: Record<string, string[]>") &&
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
  "Project decision cards expose only existing status date path and featured contracts",
  ["publication_status", "published_at", "featured", "slug"].every((field) =>
    projectAdapter.includes(field),
  ) &&
    !projectAdapter.includes("popular") &&
    !projectAdapter.includes("display-settings"),
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
    contentAdapter.includes("CONTENT_EDITOR_NAVIGATION_EVENT"),
);

console.log(`verify:shared-entity-review-presentation passed (${passed} assertions)`);
