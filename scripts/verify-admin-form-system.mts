import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  dirname,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_FORM_CONFIRM_DEBT,
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
  ADMIN_FORM_SYSTEM_CLOSURE,
  type AdminFormAdoptionClassification,
} from "../src/lib/admin/form-system/adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const normalizePath = (value: string) => value.replaceAll("\\", "/");
const absolutePath = (sourceFile: string) => join(ROOT, sourceFile);
const read = (sourceFile: string) =>
  readFileSync(absolutePath(sourceFile), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function occurrenceCount(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

function collectTsxFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

function sourcePathsFor(classification: AdminFormAdoptionClassification) {
  return ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
    (entry) => entry.classification === classification,
  ).flatMap((entry) => entry.sourceFiles);
}

const entriesById = new Map(
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map((entry) => [entry.id, entry]),
);
const manifestSourceFiles = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.flatMap(
  (entry) => entry.sourceFiles,
);
const manifestSourceFileSet = new Set<string>(manifestSourceFiles);

check(
  "closure claim is limited to reference consumers",
  ADMIN_FORM_SYSTEM_CLOSURE.scope === "reference_consumers" &&
    ADMIN_FORM_SYSTEM_CLOSURE.allowedClaim === "reference_consumer_closed",
);
check(
  "global Admin Form System closure is explicitly forbidden",
  ADMIN_FORM_SYSTEM_CLOSURE.globalClosed === false &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers.length >= 2,
);
check(
  "manifest entry IDs are unique",
  entriesById.size === ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.length,
);
check(
  "each source file has exactly one manifest owner",
  new Set(manifestSourceFiles).size === manifestSourceFiles.length,
);
check(
  "every manifest source exists",
  manifestSourceFiles.every((sourceFile) => existsSync(absolutePath(sourceFile))),
);

const expectedClassifications: Record<
  AdminFormAdoptionClassification,
  readonly string[]
> = {
  shared_reference: [
    "topic-article-create-edit",
    "topic-category-create-edit",
    "topic-series-create-edit",
  ],
  legacy_generic_gap: [
    "topic-media-create-edit",
    "projects-create",
    "projects-edit",
    "pages-quick-create",
    "redirects-create-edit",
  ],
  specialized_exception: [
    "page-composition-and-seo",
    "block-template-builders-and-editors",
    "menu-builder",
    "footer-builder",
    "global-seo-settings",
    "company-identity-settings",
    "security-settings",
    "users-and-roles",
  ],
  explicit_exception: [
    "maintenance-immediate-setting",
    "authentication-login",
    "list-bulk-row-one-shot-actions",
    "activity-sitemap-media-commands",
  ],
};

for (const [classification, expectedIds] of Object.entries(
  expectedClassifications,
) as Array<[AdminFormAdoptionClassification, readonly string[]]>) {
  const actualIds = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
    (entry) => entry.classification === classification,
  ).map((entry) => entry.id);
  const actualIdSet = new Set<string>(actualIds);
  check(
    `${classification} inventory remains complete`,
    actualIds.length === expectedIds.length &&
      expectedIds.every((id) => actualIdSet.has(id)),
  );
}

check(
  "remaining generic adoption gaps prevent a global closure claim",
  sourcePathsFor("legacy_generic_gap").length > 0 &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosed === false,
);

const formMutationOwnerSources = [
  ...collectTsxFiles(join(ROOT, "src/app/admin")),
  ...collectTsxFiles(join(ROOT, "src/components/admin")),
  absolutePath("src/app/maintenance/MaintenanceLoginForm.tsx"),
]
  .filter((sourceFile) => {
    const source = readFileSync(sourceFile, "utf8");
    return source.includes("<form") || source.includes("new FormData");
  })
  .map((sourceFile) => normalizePath(relative(ROOT, sourceFile)))
  .filter(
    (sourceFile) =>
      sourceFile !== "src/components/admin/ui/AdminFormRuntime.tsx",
  );
const unclassifiedFormMutationOwners = formMutationOwnerSources.filter(
  (sourceFile) => !manifestSourceFileSet.has(sourceFile),
);
check(
  "every Admin raw-form or imperative FormData owner is classified in the adoption manifest",
  unclassifiedFormMutationOwners.length === 0,
);

const sharedReferenceSources = sourcePathsFor("shared_reference");
check(
  "all reference consumers delegate their only form to AdminFormRuntime",
  sharedReferenceSources.every((sourceFile) => {
    const source = read(sourceFile);
    return (
      occurrenceCount(source, /<AdminFormRuntime\b/g) === 1 &&
      occurrenceCount(source, /<AdminFormActions\b/g) === 1 &&
      !source.includes("<form")
    );
  }),
);

const articleCreate = read(
  "src/components/admin/content/editors/ArticleCreateEditor.tsx",
);
const articleEdit = read(
  "src/components/admin/content/editors/ArticleEditor.tsx",
);
const categoryForm = read("src/app/admin/content/categories/CategoryForm.tsx");
const seriesForm = read("src/app/admin/content/series/SeriesForm.tsx");
const topicFormDefinition = read(
  "src/components/admin/content/editors/article/topic-form-definition.ts",
);
const topicCategorySelect = read(
  "src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx",
);
const topicSeriesSelect = read(
  "src/components/admin/content/editors/article/TopicSeriesFields.tsx",
);
const adminListboxSelect = read(
  "src/components/admin/ui/AdminListboxSelect.tsx",
);
check(
  "Topic Article create and edit share the unified action and mode contract",
  articleCreate.includes("action={saveTopicForm}") &&
    articleCreate.includes('mode="create"') &&
    articleEdit.includes("action={saveTopicForm}") &&
    articleEdit.includes('mode="edit"'),
);
check(
  "Topic Article editors no longer reference the parallel SaveBar engine",
  !articleCreate.includes("SaveBar") && !articleEdit.includes("SaveBar"),
);
check(
  "Topic taxonomy errors target stable visible inline-listbox controls",
  topicFormDefinition.includes(
    'category_slug: { tabId: "basic", targetId: "topic-category-listbox" }',
  ) &&
    topicFormDefinition.includes(
      'series_id: { tabId: "basic", targetId: "topic-series-listbox" }',
    ) &&
    topicCategorySelect.includes('id="topic-category"') &&
    topicSeriesSelect.includes('id="topic-series"') &&
    adminListboxSelect.includes('id={`${controlId}-listbox`}') &&
    adminListboxSelect.includes('role="listbox"'),
);
check(
  "CategoryForm wires create and edit modes to their correct shared-runtime actions",
  [
    'mode: "create" | "edit"',
    'const isEdit = mode === "edit"',
    "createCategoryForm,",
    "updateCategoryForm,",
    "const action = isEdit ? updateCategoryForm : createCategoryForm",
    "action={action}",
    "mode={mode}",
    'entityKey="category"',
  ].every((marker) => categoryForm.includes(marker)),
);
check(
  "SeriesForm wires create and edit modes to their correct shared-runtime actions",
  [
    'mode: "create" | "edit"',
    'const isEdit = mode === "edit"',
    "createSeriesForm,",
    "updateSeriesForm,",
    "const action = isEdit ? updateSeriesForm : createSeriesForm",
    "action={action}",
    "mode={mode}",
    'entityKey="series"',
  ].every((marker) => seriesForm.includes(marker)),
);

const runtime = read("src/components/admin/ui/AdminFormRuntime.tsx");
const actionsSource = runtime.slice(runtime.indexOf("export function AdminFormActions"));
const runtimeActionMarkers = [
  ...actionsSource.matchAll(/data-admin-form-action="([^"]+)"/g),
].map((match) => match[1]);
check(
  "shared action bar exposes exactly Save and Close",
  occurrenceCount(actionsSource, /<button\b/g) === 2 &&
    runtimeActionMarkers.length === 2 &&
    runtimeActionMarkers[0] === "save" &&
    runtimeActionMarkers[1] === "close",
);
check(
  "shared runtime owns pending state, dirty guard, feedback, and create-to-edit handoff",
  [
    "useActionState",
    "useAdminUnsavedChangesGuard",
    'window.addEventListener("beforeunload"',
    "publishFeedback",
    "state.editHref",
    "router.replace",
    "markClean(",
    "disabled={pending}",
    'aria-live="polite"',
  ].every((marker) => runtime.includes(marker)),
);
check(
  "shared runtime locks every consumer field while a save or handoff is pending",
  /<fieldset\s+[\s\S]*?disabled=\{pending\}[\s\S]*?data-admin-form-fields=""[\s\S]*?>[\s\S]*?\{typeof children[\s\S]*?<\/fieldset>/.test(
    runtime,
  ),
);

const feedbackProvider = read(
  "src/components/admin/AdminFeedbackProvider.tsx",
);
const adminNotice = read("src/components/admin/AdminNotice.tsx");
check(
  "pass-through feedback preserves pointer access for repair links and controls",
  feedbackProvider.includes("pointer-events-none") &&
    feedbackProvider.includes("[&_a]:pointer-events-auto") &&
    feedbackProvider.includes("[&_button]:pointer-events-auto") &&
    adminNotice.includes("href={action.href}"),
);

const markdownEditor = read(
  "src/components/admin/content/editors/article/TopicMarkdownEditor.tsx",
);
check(
  "successful shared saves clear the Topic local draft through one runtime event",
  runtime.includes('new CustomEvent("admin-form-saved"') &&
    markdownEditor.includes(
      'form.addEventListener("admin-form-saved", clearSavedDraft)',
    ) &&
    markdownEditor.includes(
      'form.removeEventListener("admin-form-saved", clearSavedDraft)',
    ) &&
    markdownEditor.includes(
      "window.localStorage.removeItem(draftKeyRef.current)",
    ),
);

const publishingOptions = read(
  "src/components/admin/content/editors/article/TopicPublishingOptions.tsx",
);
check(
  "Topic publication is an optional field capability inside the shared save",
  [
    'name="is_featured"',
    'name="is_popular"',
    'name="is_published"',
    "TopicDateLabelField",
  ].every((marker) => publishingOptions.includes(marker)) &&
    !publishingOptions.includes("SaveBar"),
);

const unifiedActionPath =
  "src/app/admin/content/topics/article-actions/save.ts";
const unifiedAction = read(unifiedActionPath);
const preflightIndex = unifiedAction.indexOf(
  "const publishErrors = validateTopicFields(",
);
const uploadIndex = unifiedAction.indexOf("await uploadTopicImage(");
const insertIndex = unifiedAction.indexOf(".insert({");
const updateIndex = unifiedAction.indexOf(".update({");
check(
  "Topic Article has one unified create/edit action owner",
  existsSync(absolutePath(unifiedActionPath)) &&
    !existsSync(
      absolutePath("src/app/admin/content/topics/article-actions/create.ts"),
    ) &&
    !existsSync(
      absolutePath("src/app/admin/content/topics/article-actions/update.ts"),
    ) &&
    !existsSync(
      absolutePath("src/app/admin/content/topics/article-actions/status.ts"),
    ) &&
    unifiedAction.includes("export async function saveTopicForm"),
);
check(
  "publish preflight runs before Storage and database writes",
  preflightIndex >= 0 &&
    uploadIndex > preflightIndex &&
    insertIndex > uploadIndex &&
    updateIndex > uploadIndex,
);
check(
  "unified Topic save returns structured state without redirecting",
  unifiedAction.includes("AdminFormActionState") &&
    unifiedAction.includes("editHref:") &&
    unifiedAction.includes("fieldErrors") &&
    !unifiedAction.includes("redirect("),
);
check(
  "obsolete Topic SaveBar and Previous button components are removed",
  !existsSync(absolutePath("src/components/admin/SaveBar.tsx")) &&
    !existsSync(
      absolutePath(
        "src/components/admin/content/editors/article/TopicPreviousTabButton.tsx",
      ),
    ),
);

const actualConfirmDebt = [
  ...collectTsxFiles(join(ROOT, "src/app/admin")),
  ...collectTsxFiles(join(ROOT, "src/components/admin")),
]
  .filter((sourceFile) => readFileSync(sourceFile, "utf8").includes("window.confirm"))
  .map((sourceFile) => normalizePath(relative(ROOT, sourceFile)))
  .sort();
const declaredConfirmDebt = [...ADMIN_FORM_CONFIRM_DEBT].sort();
check(
  "native confirm debt outside the reference scope stays explicit",
  actualConfirmDebt.length === declaredConfirmDebt.length &&
    declaredConfirmDebt.every(
      (sourceFile, index) => sourceFile === actualConfirmDebt[index],
    ),
);

console.log(`verify:admin-form-system passed (${passed} assertions)`);
