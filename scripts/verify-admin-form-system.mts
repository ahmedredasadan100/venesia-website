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
import { createJiti } from "jiti";

import {
  ADMIN_FORM_CONFIRM_DEBT,
  ADMIN_FORM_RUNTIME_MODULE,
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
  ADMIN_FORM_SYSTEM_CLOSURE,
  type AdminFormAdoptionClassification,
} from "../src/lib/admin/form-system/adoption-manifest.ts";
import {
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION,
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
  ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS,
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url);
const { resolveAdminEntityPreviewActions } = await jiti.import<
  typeof import("../src/lib/admin/interaction-system/entity-preview-capability.ts")
>("../src/lib/admin/interaction-system/entity-preview-capability.ts");
const {
  buildAdminContentPreviewCapability,
  buildAdminCategoryCollectionPreviewCapability,
  buildAdminSeriesCollectionPreviewCapability,
} = await jiti.import<
  typeof import("../src/lib/admin/content/entity-preview-capabilities.ts")
>("../src/lib/admin/content/entity-preview-capabilities.ts");
const { adminContentTopicPreviewPath } = await jiti.import<
  typeof import("../src/lib/admin/content-routes.ts")
>("../src/lib/admin/content-routes.ts");
const { resolvePublicContentPath } = await jiti.import<
  typeof import("../src/lib/content/public-content-path.ts")
>("../src/lib/content/public-content-path.ts");
const { resolveAdminFormNavigationDecision } = await jiti.import<
  typeof import("../src/lib/admin/form-runtime.ts")
>("../src/lib/admin/form-runtime.ts");
const { parseFormPublishedDate, resolveTopicPublishedAt } = await jiti.import<
  typeof import("../src/lib/content-dates.ts")
>("../src/lib/content-dates.ts");

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
  "Admin Interaction System is a governance/contracts umbrella, not a super-runtime",
  ADMIN_INTERACTION_SYSTEM.role === "governance_contracts_umbrella" &&
    ADMIN_INTERACTION_SYSTEM.ownsRuntime === false,
);
check(
  "Admin Interaction System remains explicitly open",
  ADMIN_INTERACTION_SYSTEM.globalClosed === false &&
    ADMIN_INTERACTION_SYSTEM.globalClosureBlockers.length >= 3,
);

const expectedInteractionModuleIds = [
  "form_runtime",
  "collection_runtime",
  "data_runtime",
  "feedback_runtime",
  "confirmation_runtime",
  "shared_capabilities",
] as const;
const interactionModulesById = new Map(
  ADMIN_INTERACTION_MODULES.map((module) => [module.id, module]),
);
check(
  "Form, Collection, Data, Feedback, Confirmation, and Shared Capabilities keep explicit owners",
  ADMIN_INTERACTION_MODULES.length === expectedInteractionModuleIds.length &&
    interactionModulesById.size === expectedInteractionModuleIds.length &&
    expectedInteractionModuleIds.every((id) => interactionModulesById.has(id)) &&
    expectedInteractionModuleIds
      .filter((id) => id !== "shared_capabilities")
      .every(
        (id) =>
          interactionModulesById.get(id)?.classification ===
          "independent_runtime",
      ) &&
    interactionModulesById.get("shared_capabilities")?.classification ===
      "shared_capability_layer",
);
check(
  "every declared Admin Interaction module owner exists",
  ADMIN_INTERACTION_MODULES.flatMap((module) => module.sourceFiles).every(
    (sourceFile) => existsSync(absolutePath(sourceFile)),
  ),
);
check(
  "Form adoption is scoped to the independent Form Runtime module",
  ADMIN_FORM_RUNTIME_MODULE.id === "form_runtime" &&
    ADMIN_FORM_RUNTIME_MODULE.governanceSystem ===
      "admin_interaction_system" &&
    ADMIN_FORM_RUNTIME_MODULE.role === "independent_runtime" &&
    ADMIN_FORM_RUNTIME_MODULE.ownsSharedCapabilities === false &&
    ADMIN_FORM_SYSTEM_CLOSURE.module === ADMIN_FORM_RUNTIME_MODULE.id,
);

const interactionFormReferenceIds = new Set<string>(
  ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.map((entry) => entry.id),
);
check(
  "Admin Interaction governance records the three Form Runtime reference consumers",
  interactionFormReferenceIds.size === 3 &&
    [
      "topic-article-create-edit",
      "topic-category-create-edit",
      "topic-series-create-edit",
    ].every((id) => interactionFormReferenceIds.has(id)) &&
    ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.every(
      (entry) =>
        entry.module === "form_runtime" &&
        entriesById.has(entry.id) &&
        entry.sourceFiles.every((sourceFile) =>
          new Set<string>(entriesById.get(entry.id)?.sourceFiles ?? []).has(
            sourceFile,
          ),
        ),
    ),
);

const previewCapabilityAdopter =
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find(
    (entry) => entry.id === "topic-article-edit-preview-public",
  );
const previewCapabilityGapIds = new Set<string>(
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.filter(
    (entry) => entry.status === "gap",
  ).map((entry) => entry.id),
);
const previewCapabilityAdoptionIds = new Set<string>(
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.map((entry) => entry.id),
);
check(
  "Topic Article Edit is the shared Preview/Public reference adopter",
  previewCapabilityAdopter?.status === "adopted" &&
    previewCapabilityAdopter.capabilityOwner === "shared_capabilities" &&
    previewCapabilityAdopter.consumerBoundary ===
      "form_runtime_reference_consumer" &&
    previewCapabilityAdopter.sourceFiles.includes(
      "src/components/admin/content/editors/ArticleEditor.tsx",
    ),
);
check(
  "Preview/Public adoption IDs are unique and all capabilities keep their shared owner",
  previewCapabilityAdoptionIds.size ===
    ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.length &&
    ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.every(
      (entry) => entry.capabilityOwner === "shared_capabilities",
    ),
);
check(
  "Media Topic remains the only explicit Preview/Public gap in this scope",
  previewCapabilityGapIds.size === 1 &&
    previewCapabilityGapIds.has("topic-media-edit-preview"),
);

check(
  "Category and Series collections adopt the shared Preview/Public capability",
  [
    "topic-category-collection-preview",
    "topic-series-collection-preview",
  ].every(
    (id) =>
      ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find(
        (entry) => entry.id === id,
      )?.status === "adopted",
  ),
);

check(
  "Category and Series Collection Runtime interaction gaps are closed",
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS.length === 0,
);
check(
  "every declared Admin Interaction adopter and gap source exists",
  [
    ...ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS,
    ...ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION,
    ...ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
  ].every((entry) =>
    entry.sourceFiles.every((sourceFile) =>
      existsSync(absolutePath(sourceFile)),
    ),
  ),
);

check(
  "Form Runtime closure claim is limited to reference consumers",
  ADMIN_FORM_SYSTEM_CLOSURE.scope === "reference_consumers" &&
    ADMIN_FORM_SYSTEM_CLOSURE.allowedClaim === "reference_consumer_closed",
);
check(
  "global Form Runtime closure is explicitly forbidden",
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
  "remaining generic adoption gaps prevent a global Form Runtime closure claim",
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
const formRuntimeContract = read("src/lib/admin/form-runtime.ts");
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
  "Close decision blocks pending, navigates clean, and confirms dirty forms",
  resolveAdminFormNavigationDecision({ pending: true, dirty: true }) ===
    "blocked_pending" &&
    resolveAdminFormNavigationDecision({ pending: false, dirty: false }) ===
      "navigate" &&
    resolveAdminFormNavigationDecision({ pending: false, dirty: true }) ===
      "confirm_discard",
);
check(
  "Form Runtime stays form-only and does not own Preview/Public capabilities",
  [runtime, formRuntimeContract].every(
    (source) =>
      !source.includes("AdminEntityPreview") &&
      !source.includes("internal-preview") &&
      !source.includes("public-view") &&
      !source.includes("previewCapability"),
  ) &&
    !actionsSource.includes("Preview") &&
    !actionsSource.includes("Public View") &&
    !actionsSource.includes("معاينة داخلية") &&
    !actionsSource.includes("النسخة العامة"),
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
const formDomPreservation = read(
  "src/lib/admin/form-dom-preservation.ts",
);
check(
  "shared runtime wires central DOM snapshot restoration; React timing remains Browser QA",
  runtime.includes("captureAdminFormControls(form)") &&
    runtime.includes("restoreAdminFormControls(form, snapshot)") &&
    runtime.includes("useLayoutEffect(() =>") &&
    formDomPreservation.includes("form.elements") &&
    formDomPreservation.includes("entry.element.form !== form") &&
    formDomPreservation.includes("new DataTransfer()"),
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
  "Form feedback uses the required provider, publishes initial route errors, and keeps the newest channel visible",
  runtime.includes("useAdminFeedback") &&
    !runtime.includes("useOptionalAdminFeedback") &&
    runtime.includes("clearFormFeedback") &&
    runtime.includes("onNavigate: clearFormFeedback") &&
    articleCreate.includes("createAdminFormErrorState") &&
    articleEdit.includes("createAdminFormErrorState") &&
    feedbackProvider.includes("data-admin-feedback-channel") &&
    feedbackProvider.includes("[...globalEntries].reverse().map") &&
    feedbackProvider.includes("inlineEntries.map"),
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
const articleSaveHelpers = read(
  "src/app/admin/content/topics/article-actions/helpers.ts",
);
const publicationForm = new FormData();
publicationForm.set("published_at", "2026-08-15");
const submittedPublicationDate = parseFormPublishedDate(publicationForm);
const firstPublishedAt = resolveTopicPublishedAt({
  formPublishedDate: submittedPublicationDate,
  currentPublishedAt: null,
  status: "published",
  nowIso: "2026-08-15T08:00:00.000Z",
});
check(
  "submitted first-publication date persists and survives unpublish or republish",
  articleSaveHelpers.includes(
    "publishedAt: parseFormPublishedDate(formData)",
  ) &&
    articleSaveHelpers.includes("published_at: resolveTopicPublishedAt({") &&
    publishingOptions.includes(
      "disabled={pending || Boolean(publishedAt)}",
    ) &&
    submittedPublicationDate === "2026-08-15" &&
    firstPublishedAt === "2026-08-15T12:00:00.000Z" &&
    resolveTopicPublishedAt({
      formPublishedDate: "2026-09-01",
      currentPublishedAt: firstPublishedAt,
      status: "published",
      nowIso: "2026-09-01T08:00:00.000Z",
    }) === firstPublishedAt &&
    resolveTopicPublishedAt({
      formPublishedDate: submittedPublicationDate,
      currentPublishedAt: firstPublishedAt,
      status: "unpublished",
      nowIso: "2026-09-01T08:00:00.000Z",
    }) === firstPublishedAt &&
    resolveTopicPublishedAt({
      formPublishedDate: submittedPublicationDate,
      currentPublishedAt: null,
      status: "draft",
      nowIso: "2026-08-15T08:00:00.000Z",
    }) === null,
);
check(
  "Topic PublishingOptions cannot reintroduce local Preview/Public ownership",
  [
    'from "next/link"',
    "AdminEntityPreviewActions",
    "AdminEntityPreviewCapability",
    "buildAdminContentPreviewCapability",
    "resolveAdminEntityPreviewActions",
    "previewCapability",
    "internal-preview",
    "public-view",
    "topicId",
    "previewLinkClassName",
    "data-topic-preview-links",
    "/admin/content/topics/${",
    "/topics/${",
    "معاينة داخلية",
    "النسخة العامة",
  ].every((marker) => !publishingOptions.includes(marker)) &&
    !/<(?:Link|a)\b/.test(publishingOptions) &&
    !/\bhref\s*=/.test(publishingOptions) &&
    !/\bslug\b/.test(publishingOptions),
);

const entityPreviewContract = read(
  "src/lib/admin/interaction-system/entity-preview-capability.ts",
);
const contentPreviewCapability = read(
  "src/lib/admin/content/entity-preview-capabilities.ts",
);
const entityPreviewActions = read(
  "src/components/admin/ui/AdminEntityPreviewActions.tsx",
);
check(
  "shared Preview/Public contract owns safe resolution and publication visibility",
  entityPreviewContract.includes("AdminEntityPreviewCapability") &&
    entityPreviewContract.includes("resolveAdminEntityPreviewActions") &&
    entityPreviewContract.includes("resolveSafeInternalPath") &&
    entityPreviewContract.includes(
      'capability.publicationStatus === "published"',
    ),
);
const draftPreviewActions = resolveAdminEntityPreviewActions({
  entityType: "topic",
  entityId: 42,
  publicationStatus: "draft",
  routes: {
    internalPreview: "/admin/content/topics/42/preview",
    publicView: "/topics/reference-topic",
  },
  access: {
    "internal-preview": "allowed",
    "public-view": "allowed",
  },
});
const publishedPreviewActions = resolveAdminEntityPreviewActions({
  entityType: "topic",
  entityId: 42,
  publicationStatus: "published",
  routes: {
    internalPreview: "/admin/content/topics/42/preview",
    publicView: "/topics/reference-topic",
  },
  access: {
    "internal-preview": "disabled",
    "public-view": "allowed",
  },
});
check(
  "shared Preview/Public resolver behavior rejects unsafe or invalid declarations",
  resolveAdminEntityPreviewActions({
    entityType: "topic",
    entityId: 0,
    publicationStatus: "published",
    routes: {
      internalPreview: "/admin/content/topics/0/preview",
      publicView: "/topics/invalid",
    },
    access: {
      "internal-preview": "allowed",
      "public-view": "allowed",
    },
  }).length === 0 &&
    resolveAdminEntityPreviewActions({
      entityType: "topic",
      entityId: 42,
      publicationStatus: "published",
      routes: {
        internalPreview: "//example.com/preview",
        publicView: "https://example.com/topics/reference-topic",
      },
      access: {
        "internal-preview": "allowed",
        "public-view": "allowed",
      },
    }).length === 0,
);
check(
  "shared Preview/Public resolver behavior owns publication visibility and disabled state",
  draftPreviewActions.length === 1 &&
    draftPreviewActions[0]?.kind === "internal-preview" &&
    draftPreviewActions[0]?.disabled === false &&
    publishedPreviewActions.length === 2 &&
    publishedPreviewActions[0]?.kind === "internal-preview" &&
    publishedPreviewActions[0]?.disabled === true &&
    publishedPreviewActions[1]?.kind === "public-view" &&
    publishedPreviewActions[1]?.disabled === false,
);
check(
  "content Preview/Public adapter uses canonical route builders",
  contentPreviewCapability.includes("buildAdminContentPreviewCapability") &&
    contentPreviewCapability.includes("adminContentTopicPreviewPath") &&
    contentPreviewCapability.includes("resolvePublicContentPath") &&
    !contentPreviewCapability.includes("AdminFormRuntime"),
);
const resolvedContentCapability = buildAdminContentPreviewCapability({
  entityType: "topic",
  id: 42,
  contentType: "article",
  slug: "reference-topic",
  publicationStatus: "published",
});
check(
  "content Preview/Public adapter behavior delegates to canonical route builders",
  resolvedContentCapability.routes.internalPreview ===
    adminContentTopicPreviewPath(42) &&
    resolvedContentCapability.routes.publicView ===
      resolvePublicContentPath("article", "reference-topic"),
);
const resolvedCategoryCapability =
  buildAdminCategoryCollectionPreviewCapability({
    id: 7,
    slug: "reference-category",
    isActive: true,
  });
const resolvedSeriesCapability = buildAdminSeriesCollectionPreviewCapability({
  id: 9,
});
const hiddenCategoryActions = resolveAdminEntityPreviewActions(
  buildAdminCategoryCollectionPreviewCapability({
    id: 8,
    slug: "hidden-category",
    isActive: false,
  }),
);
check(
  "taxonomy collection Preview/Public adapters declare only proven routes",
  resolvedCategoryCapability.routes.internalPreview === null &&
    resolvedCategoryCapability.routes.publicView ===
      "/topics?category=reference-category" &&
    resolvedSeriesCapability.routes.internalPreview ===
      "/admin/content/topics?series=9" &&
    resolvedSeriesCapability.routes.publicView === null &&
    hiddenCategoryActions.length === 1 &&
    hiddenCategoryActions[0]?.kind === "public-view" &&
    hiddenCategoryActions[0]?.href === "/topics?category=hidden-category",
);
check(
  "shared Preview/Public renderer owns labels, new-tab safety, and action presentation",
  entityPreviewActions.includes("resolveAdminEntityPreviewActions") &&
    entityPreviewActions.includes("data-admin-entity-preview-actions") &&
    entityPreviewActions.includes('target="_blank"') &&
    entityPreviewActions.includes('rel="noopener noreferrer"') &&
    entityPreviewActions.includes("معاينة داخلية") &&
    entityPreviewActions.includes("النسخة العامة") &&
    !entityPreviewActions.includes("AdminFormRuntime"),
);
const topicPreviewActionIndex = articleEdit.indexOf(
  "<AdminEntityPreviewActions",
);
const topicFormRuntimeIndex = articleEdit.indexOf("<AdminFormRuntime");
const topicFormRuntimeEndIndex = articleEdit.lastIndexOf("</AdminFormRuntime>");
check(
  "Topic Article mounts the shared Preview/Public adopter outside Form Runtime",
  articleEdit.includes("buildAdminContentPreviewCapability") &&
    articleEdit.includes("const previewCapability") &&
    articleEdit.includes(
      "<AdminEntityPreviewActions capability={previewCapability} />",
    ) &&
    occurrenceCount(articleEdit, /<AdminEntityPreviewActions\b/g) === 1 &&
    topicPreviewActionIndex >= 0 &&
    topicPreviewActionIndex < topicFormRuntimeIndex &&
    topicFormRuntimeEndIndex > topicFormRuntimeIndex &&
    !articleEdit
      .slice(topicFormRuntimeIndex, topicFormRuntimeEndIndex)
      .includes("AdminEntityPreviewActions"),
);

const categoryRowActions = read(
  "src/app/admin/content/categories/CategoryRowActions.tsx",
);
const seriesColumns = read(
  "src/app/admin/content/series/series-columns.tsx",
);
const categoryListClient = read(
  "src/app/admin/content/categories/CategoriesListClient.tsx",
);
const seriesTableClient = read(
  "src/app/admin/content/series/SeriesTableClient.tsx",
);
check(
  "Category and Series collection Preview/Public actions use the shared entry point",
  categoryRowActions.includes("AdminEntityPreviewActions") &&
    categoryRowActions.includes(
      "buildAdminCategoryCollectionPreviewCapability",
    ) &&
    seriesColumns.includes("AdminEntityPreviewActions") &&
    seriesColumns.includes("buildAdminSeriesCollectionPreviewCapability") &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes('presentation="data-grid-compact"') &&
        !source.includes("previewHref") &&
        !source.includes("topicsPreviewHref"),
    ),
);
check(
  "Category and Series collections consume action-scoped pending and shared feedback",
  [categoryListClient, seriesTableClient].every(
    (source) =>
      source.includes("rowPendingAction:") &&
      source.includes("instant.rowPending?.rowId ===") &&
      !source.includes(
        "instant.rowPending !== null || instant.bulkPending !== null",
      ) &&
      !source.includes("router.refresh"),
  ) &&
    read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      "AdminFeedbackChannelViewport",
    ) &&
    read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      "publishFeedback(nextFeedback",
    ),
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
