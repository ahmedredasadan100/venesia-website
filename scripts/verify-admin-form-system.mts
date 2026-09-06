import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

import {
  ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT,
  ADMIN_FORM_CONFIRM_DEBT,
  ADMIN_FORM_BEHAVIOR_PROOF_LEDGER,
  ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS,
  ADMIN_FORM_RUNTIME_MODULE,
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
  ADMIN_FORM_SYSTEM_CLOSURE,
  type AdminBlockEditorFeedbackAdoptionDebt,
  type AdminFormAdoptionClassification,
} from "../src/lib/admin/form-system/adoption-manifest.ts";
import {
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION,
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
  ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS,
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
  PRODUCT_SURFACE_IDENTITIES,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { ADMIN_INTERACTION_SYSTEM_CLOSURE } from "../src/lib/admin/interaction-system/governance-closure.ts";
import { PAGE_MODULE_KINDS } from "../src/lib/page-blocks/types.ts";
import { collectExecutableSourceGraph } from "./lib/typescript-executable-graph.mts";

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
const {
  ADMIN_DATE_ONLY_PATTERN,
  ADMIN_DATE_TIME_PATTERN,
  ADMIN_TIME_ZONE,
  formatAdminDateOnly,
  formatAdminDateTime,
  parseFormPublishedDate,
  resolveTopicPublishedAt,
} = await jiti.import<typeof import("../src/lib/content-dates.ts")>(
  "../src/lib/content-dates.ts",
);

const normalizePath = (value: string) => value.replaceAll("\\", "/");
const absolutePath = (sourceFile: string) => join(ROOT, sourceFile);
const read = (sourceFile: string) =>
  readFileSync(absolutePath(sourceFile), "utf8");
const maintenanceSettingsPage = read("src/app/admin/settings/general/page.tsx");
const maintenanceSettingsPanel = read(
  "src/app/admin/settings/general/MaintenanceModePanel.tsx",
);
const maintenanceSettingsAction = read(
  "src/app/admin/settings/general/actions.ts",
);

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function closureStateIsConsistent(
  globalClosed: boolean,
  blockers: readonly unknown[],
) {
  return globalClosed ? blockers.length === 0 : blockers.length > 0;
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
const manifestExecutableGraphs = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map(
  (entry) =>
    collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: entry.sourceFiles,
      symbolAware: true,
    }),
);

function blockEditorKindFromProductIdentity(
  identity: (typeof PRODUCT_SURFACE_IDENTITIES)[number],
) {
  const prefix = "/admin/pages-blocks/blocks/";
  const suffix = "/[id]";
  if (
    identity.productSurfaceKind !== "builder" ||
    identity.workflowOwner !== "block_template_domain" ||
    !identity.route?.startsWith(prefix) ||
    !identity.route.endsWith(suffix)
  ) {
    return null;
  }
  const moduleKind = identity.route.slice(prefix.length, -suffix.length);
  return PAGE_MODULE_KINDS.includes(
    moduleKind as (typeof PAGE_MODULE_KINDS)[number],
  )
    ? moduleKind
    : null;
}

function collectBlockEditorCoverageFailures(input: {
  canonicalModuleKinds: readonly string[];
  formModuleKinds: readonly string[];
  productModuleKinds: readonly string[];
}) {
  const failures: string[] = [];
  const axes = [
    ["form", input.formModuleKinds],
    ["product", input.productModuleKinds],
  ] as const;
  for (const moduleKind of input.canonicalModuleKinds) {
    for (const [axis, values] of axes) {
      if (!values.includes(moduleKind)) {
        failures.push(`${moduleKind}:missing_${axis}_registration`);
      }
    }
  }
  for (const [axis, values] of axes) {
    for (const moduleKind of values) {
      if (!input.canonicalModuleKinds.includes(moduleKind)) {
        failures.push(`${moduleKind}:stale_${axis}_registration`);
      }
      if (values.filter((candidate) => candidate === moduleKind).length !== 1) {
        failures.push(`${moduleKind}:duplicate_${axis}_registration`);
      }
    }
  }
  return [...new Set(failures)];
}

function collectCapabilityDecisionIdentityFailures(
  entries: readonly {
    id: string;
    decisions: Readonly<Record<string, object>>;
  }[],
) {
  const firstOwnerByDecision = new Map<object, string>();
  const failures: string[] = [];
  for (const entry of entries) {
    for (const [capability, decision] of Object.entries(entry.decisions)) {
      const firstOwner = firstOwnerByDecision.get(decision);
      if (firstOwner) {
        failures.push(
          `${entry.id}:${capability}:shares_nested_decision_with:${firstOwner}`,
        );
      } else {
        firstOwnerByDecision.set(decision, `${entry.id}:${capability}`);
      }
    }
  }
  return failures;
}

const blockEditorEntries = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
  (
    entry,
  ): entry is (typeof ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST)[number] & {
    registryModuleKind: (typeof PAGE_MODULE_KINDS)[number];
  } => "registryModuleKind" in entry,
);
const blockEditorFeedbackDebtByKind = new Map<
  string,
  AdminBlockEditorFeedbackAdoptionDebt
>(
  ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.map((debt) => [
    debt.moduleKind,
    debt,
  ]),
);
const feedbackOwnerBoundarySourceFiles =
  ADMIN_CURRENT_SHARED_CAPABILITY_SET.feedback.sourceFiles;
const adminNoticeSourceFile = "src/components/admin/AdminNotice.tsx";
const blockEditorFeedbackTruthFailures = blockEditorEntries.flatMap(
  (entry) => {
    const ownershipGraph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: entry.sourceFiles,
      traversalBoundarySourceFiles: feedbackOwnerBoundarySourceFiles,
      symbolAware: true,
    });
    const debt = blockEditorFeedbackDebtByKind.get(entry.registryModuleKind);
    const feedbackOverride = entry.capabilityAudit.overrides.feedback;
    const ownsDirectNoticePath = ownershipGraph.has(adminNoticeSourceFile);
    const failures: string[] = [];
    if (ownsDirectNoticePath !== Boolean(debt)) {
      failures.push(`${entry.id}:direct_notice_debt_mismatch`);
    }
    if (debt && feedbackOverride?.state !== "missing_adoption") {
      failures.push(`${entry.id}:direct_notice_not_declared_missing`);
    }
    if (!debt && feedbackOverride?.state === "missing_adoption") {
      failures.push(`${entry.id}:stale_feedback_debt`);
    }
    if (
      debt &&
      (!debt.blocksGlobalClosure ||
        debt.owner !== "feedback_runtime" ||
        debt.sourceFiles.length === 0 ||
        debt.sourceFiles.some((sourceFile) =>
          !existsSync(absolutePath(sourceFile)),
        ) ||
        debt.requiredProof.length === 0 ||
        !debt.risk.trim() ||
        !debt.plannedPhase.trim())
    ) {
      failures.push(`${entry.id}:invalid_feedback_debt_contract`);
    }
    return failures;
  },
);
const formBlockEditorKinds = blockEditorEntries.flatMap((entry) =>
  entry.registryModuleKind ? [entry.registryModuleKind] : [],
);
const productBlockEditorKinds = PRODUCT_SURFACE_IDENTITIES.flatMap(
  (identity) => {
    const moduleKind = blockEditorKindFromProductIdentity(identity);
    return moduleKind ? [moduleKind] : [];
  },
);
const blockEditorCoverageFailures = collectBlockEditorCoverageFailures({
  canonicalModuleKinds: PAGE_MODULE_KINDS,
  formModuleKinds: formBlockEditorKinds,
  productModuleKinds: productBlockEditorKinds,
});
const blockEditorDecisionIdentityFailures =
  collectCapabilityDecisionIdentityFailures(
    blockEditorEntries.map((entry) => ({
      id: entry.id,
      decisions: entry.capabilityAudit.decisions,
    })),
  );
const futureBlockEditorFixture = "future-block-editor-fixture";
const unregisteredBlockEditorFailures = collectBlockEditorCoverageFailures({
  canonicalModuleKinds: [...PAGE_MODULE_KINDS, futureBlockEditorFixture],
  formModuleKinds: formBlockEditorKinds,
  productModuleKinds: [...productBlockEditorKinds, futureBlockEditorFixture],
});
const sharedNestedDecisionFixture = {
  state: "not_applicable",
  rationale: "Negative fixture for a shallow-shared nested decision.",
} as const;
const shallowSharedDecisionProfileFixture = {
  fixture_capability: sharedNestedDecisionFixture,
};
const shallowSharedDecisionIdentityFailures =
  collectCapabilityDecisionIdentityFailures([
    {
      id: "shallow-shared-decision-fixture-a",
      decisions: { ...shallowSharedDecisionProfileFixture },
    },
    {
      id: "shallow-shared-decision-fixture-b",
      decisions: { ...shallowSharedDecisionProfileFixture },
    },
  ]);

check(
  "Admin Interaction System is a governance/contracts umbrella, not a super-runtime",
  ADMIN_INTERACTION_SYSTEM.role === "governance_contracts_umbrella" &&
    ADMIN_INTERACTION_SYSTEM.ownsRuntime === false,
);
check(
  "Admin Interaction System closure state fails closed when adoption blockers exist",
  Object.keys(ADMIN_INTERACTION_SYSTEM_CLOSURE.components).length ===
    ADMIN_INTERACTION_MODULES.length &&
    ADMIN_INTERACTION_MODULES.every(
      (module) => module.id in ADMIN_INTERACTION_SYSTEM_CLOSURE.components,
    ) &&
    ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosed ===
    Object.values(ADMIN_INTERACTION_SYSTEM_CLOSURE.components).every(
      (component) => component.globalClosed,
    ) &&
    ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosureBlockers.length ===
      Object.values(ADMIN_INTERACTION_SYSTEM_CLOSURE.components).reduce(
        (total, component) =>
          total + component.globalClosureBlockers.length,
        0,
      ) &&
    closureStateIsConsistent(
      ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosed,
      ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosureBlockers,
    ),
);

const interactionModulesById = new Map(
  ADMIN_INTERACTION_MODULES.map((module) => [module.id, module]),
);
check(
  "the canonical Admin Interaction module inventory has unique explicit owners and no inferred module count",
  ADMIN_INTERACTION_MODULES.length > 0 &&
    interactionModulesById.size === ADMIN_INTERACTION_MODULES.length &&
    ADMIN_INTERACTION_MODULES.every(
      (module) =>
        module.responsibility.trim().length > 0 &&
        module.sourceFiles.length > 0 &&
        (module.id === "shared_capabilities"
          ? module.classification === "shared_capability_layer"
          : module.classification === "independent_runtime"),
    ),
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
    ADMIN_FORM_RUNTIME_MODULE.governanceSystem === "admin_interaction_system" &&
    ADMIN_FORM_RUNTIME_MODULE.role === "independent_runtime" &&
    ADMIN_FORM_RUNTIME_MODULE.ownsSharedCapabilities === false &&
    ADMIN_FORM_SYSTEM_CLOSURE.module === ADMIN_FORM_RUNTIME_MODULE.id,
);

const interactionFormReferenceIds = new Set<string>(
  ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.map((entry) => entry.id),
);
check(
  "Admin Interaction Form references and Form shared-reference adopters match bidirectionally",
  interactionFormReferenceIds.size ===
    ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.length &&
    ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.every(
      (entry) =>
        entry.module === "form_runtime" &&
        entriesById.has(entry.id) &&
        entry.sourceFiles.every((sourceFile) =>
          new Set<string>(entriesById.get(entry.id)?.sourceFiles ?? []).has(
            sourceFile,
          ),
        ),
    ) &&
    ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
      (entry) => entry.classification === "shared_reference",
    ).every((entry) => interactionFormReferenceIds.has(entry.id)),
);

const previewCapabilityAdopter = ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find(
  (entry) => entry.id === "topic-article-edit-preview-public",
);
const previewCapabilityGapIds = new Set<string>(
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.filter(
    (entry) => String(entry.status) === "gap",
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
  "Media Topic closes the remaining Preview/Public adoption gap",
  previewCapabilityGapIds.size === 0 &&
    ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find(
      (entry) => entry.id === "topic-media-edit-preview",
    )?.status === "adopted",
);

check(
  "Category and Series collections adopt the shared Preview/Public capability",
  [
    "topic-category-collection-preview",
    "topic-series-collection-preview",
  ].every(
    (id) =>
      ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find((entry) => entry.id === id)
        ?.status === "adopted",
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
  "Form Runtime closure claim includes the bounded shared legacy adoption",
  ADMIN_FORM_SYSTEM_CLOSURE.scope ===
    "reference_consumers_and_in_scope_generic_legacy_forms" &&
    ADMIN_FORM_SYSTEM_CLOSURE.allowedClaim ===
      "shared_legacy_form_adoption_closed",
);
check(
  "global Form Runtime closure is derived open from owner, adoption, exception, and behavioral-proof blockers",
  ADMIN_FORM_SYSTEM_CLOSURE.globalClosed ===
    (ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS.length === 0) &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers ===
      ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers.length > 0,
);
check(
  "source-only Form evidence remains distinct from Behavioral Proof and blocks global closure",
  ADMIN_FORM_BEHAVIOR_PROOF_LEDGER.some(
    (proof) =>
      proof.requiredForGlobalClosure && proof.state === "source_proven_only",
  ) &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers.some((blocker) =>
      blocker.id.startsWith("form-behavior:"),
    ),
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
  manifestSourceFiles.every((sourceFile) =>
    existsSync(absolutePath(sourceFile)),
  ),
);
check(
  "every canonical Block Editor has one independent Form identity and one bidirectionally matching Product Surface identity",
  blockEditorCoverageFailures.length === 0 &&
    new Set(
      blockEditorEntries.map((entry) => entry.capabilityAudit.decisions),
    ).size === blockEditorEntries.length &&
    blockEditorDecisionIdentityFailures.length === 0 &&
    blockEditorEntries.every(
      (entry) =>
        entry.sourceFiles.length === 1 &&
        entry.sourceFiles[0] ===
          `src/app/admin/pages-blocks/blocks/${entry.registryModuleKind}/[id]/page.tsx`,
    ),
);
check(
  "direct Block Editor action feedback is declared as blocking debt instead of hidden behind not_applicable",
  blockEditorFeedbackDebtByKind.size ===
    ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.length &&
    blockEditorFeedbackTruthFailures.length === 0 &&
    ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.every((debt) =>
      ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS.some(
        (blocker) =>
          blocker.id ===
          `form-missing-adoption:block-template-${debt.moduleKind}-editor:feedback`,
      ),
    ),
);
check(
  "a shallow-shared nested Block Editor decision fails the identity proof",
  shallowSharedDecisionIdentityFailures.length > 0,
);
check(
  "a canonical Block Editor added without its Form adoption identity fails closed",
  unregisteredBlockEditorFailures.includes(
    `${futureBlockEditorFixture}:missing_form_registration`,
  ),
);

check(
  "Form classifications are complete records from the canonical manifest rather than a copied consumer list",
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.every(
    (entry) =>
      entry.id.trim().length > 0 &&
      entry.label.trim().length > 0 &&
      entry.rationale.trim().length > 0 &&
      entry.sourceFiles.length > 0 &&
      (entry.classification === "specialized_exception" ||
      entry.classification === "explicit_exception"
        ? entry.exceptionContract.knownDebt.length > 0 &&
          entry.exceptionContract.reviewTrigger.trim().length > 0
        : !("exceptionContract" in entry)),
  ),
);

check(
  "in-scope generic adoption gaps are closed without claiming global Form Runtime closure",
  sourcePathsFor("legacy_generic_gap").length === 0 &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosed === false,
);

check(
  "Maintenance setting mutation stays unavailable until its current value is read successfully",
  !maintenanceSettingsPage.includes(".catch(() => false)") &&
    maintenanceSettingsPage.includes('status: "unavailable" as const') &&
    maintenanceSettingsPage.includes("initialReadState={maintenanceSetting}") &&
    maintenanceSettingsPanel.includes('role="alert"') &&
    maintenanceSettingsPanel.includes(
      "disabled={pending || refreshPending || !readAvailable}",
    ) &&
    maintenanceSettingsPanel.includes(
      "open={readAvailable && confirmNextEnabled !== null}",
    ) &&
    maintenanceSettingsAction.indexOf("await getMaintenanceModeSetting();") >=
      0 &&
    maintenanceSettingsAction.indexOf("await getMaintenanceModeSetting();") <
      maintenanceSettingsAction.indexOf(
        "await setMaintenanceModeSetting(enabled);",
      ),
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
  (sourceFile) =>
    !manifestSourceFileSet.has(sourceFile) &&
    !manifestExecutableGraphs.some((graph) => graph.has(sourceFile)),
);
check(
  "every Admin raw-form or imperative FormData owner is classified in the adoption manifest",
  unclassifiedFormMutationOwners.length === 0,
);
const sharedReferenceSources = sourcePathsFor("shared_reference");
const contentEditorShell = read(
  "src/components/admin/content/editors/ContentEditorShell.tsx",
);
check(
  "all reference consumers delegate their only form to AdminFormRuntime",
  sharedReferenceSources.every((sourceFile) => {
    const source = read(sourceFile);
    const delegatesDirectly =
      occurrenceCount(source, /<AdminFormRuntime\b/g) === 1 &&
      occurrenceCount(source, /<AdminFormActions\b/g) === 1;
    const delegatesThroughContentShell =
      occurrenceCount(source, /<ContentEditorShell\b/g) === 1;
    return (
      (delegatesDirectly || delegatesThroughContentShell) &&
      !source.includes("<form")
    );
  }) &&
    occurrenceCount(contentEditorShell, /<AdminFormRuntime\b/g) === 1 &&
    occurrenceCount(contentEditorShell, /<AdminFormActions\b/g) === 1 &&
    !contentEditorShell.includes("<form"),
);

const articleCreate = read(
  "src/components/admin/content/editors/ArticleCreateEditor.tsx",
);
const articleEdit = read(
  "src/components/admin/content/editors/ArticleEditor.tsx",
);
const categoryForm = read("src/app/admin/content/categories/CategoryForm.tsx");
const seriesForm = read("src/app/admin/content/series/SeriesForm.tsx");
const adminFormPresentation = read("src/components/admin/ui/AdminForm.tsx");
const adminPageExperience = read(
  "src/components/admin/ui/AdminPageExperience.tsx",
);
const mediaContentForm = read(
  "src/components/admin/content/editors/media/MediaContentForm.tsx",
);
const redirectForm = read("src/app/admin/seo/redirects/RedirectFormModal.tsx");
const createPageModal = read(
  "src/app/admin/pages-blocks/pages/CreatePageModal.tsx",
);
const topicFormDefinition = read(
  "src/components/admin/content/editors/content-form-definition.ts",
);
const topicCategorySelect = read(
  "src/components/admin/content/editors/ContentCategorySelect.tsx",
);
const topicSeriesSelect = read(
  "src/components/admin/content/editors/article/TopicSeriesFields.tsx",
);
const topicTabs = read(
  "src/components/admin/content/editors/ContentEditorShell.tsx",
);
const topicBasicPanel = read(
  "src/components/admin/content/editors/ContentBasicDataPanel.tsx",
);
const topicContentTypeControl = read(
  "src/components/admin/content/editors/TopicContentTypeControl.tsx",
);
const topicPreview = read("src/app/admin/content/topics/[id]/preview/page.tsx");
const projectPreview = read("src/app/admin/projects/[id]/preview/page.tsx");
const menuBuilderPage = read("src/app/admin/pages-blocks/menus/[id]/page.tsx");
const topicSeoPanel = read("src/components/admin/SeoPanel.tsx");
const sharedEntitySeoPanel = read(
  "src/components/admin/seo/AdminEntitySeoPanel.tsx",
);
const topicPublishingOptions = read(
  "src/components/admin/content/editors/ContentPublishingOptions.tsx",
);
const topicPublishChecklist = read(
  "src/components/admin/content-workflow/ContentReviewPanel.tsx",
);
const sharedEntityReviewPanel = read(
  "src/components/admin/review/AdminEntityReviewPanel.tsx",
);
const topicMediaSyncSignal = read(
  "src/components/admin/content/editors/article/TopicMediaCatalogSyncSignal.tsx",
);
const adminListboxSelect = read(
  "src/components/admin/ui/AdminListboxSelect.tsx",
);
const adminFormListboxSelect = read(
  "src/components/admin/ui/AdminFormListboxSelect.tsx",
);
const inlineListboxHandlerStart = adminListboxSelect.indexOf(
  "function handleInlineKeyDown",
);
const inlineListboxHandlerEnd = adminListboxSelect.indexOf(
  "\n  const menu =",
  inlineListboxHandlerStart,
);
const inlineListboxHandler = adminListboxSelect.slice(
  inlineListboxHandlerStart,
  inlineListboxHandlerEnd,
);
check(
  "Topic Article create and edit share the unified action and mode contract",
  articleCreate.includes("action={saveContentForm}") &&
    articleCreate.includes('mode="create"') &&
    articleEdit.includes("action={saveContentForm}") &&
    articleEdit.includes('mode="edit"'),
);
check(
  "Topic Article Create and Edit mount one shared editor identity",
  [articleCreate, articleEdit].every((source) =>
    [
      "ContentEditorShell",
      "ContentBasicDataPanel",
      "TopicMarkdownEditor",
      "FaqEditor",
      "SeoPanel",
      "ContentPublishingOptions",
      "ContentReviewPanel",
    ].every(
      (owner) => occurrenceCount(source, new RegExp(`<${owner}\\b`, "g")) === 1,
    ),
  ) &&
    topicTabs.includes('variant="editor"') &&
    topicBasicPanel.includes('data-content-basic-presentation="editor"') &&
    occurrenceCount(topicSeoPanel, /<AdminEntitySeoPanel/g) === 1 &&
    occurrenceCount(topicSeoPanel, /<AdminFormLayout/g) === 0 &&
    occurrenceCount(topicSeoPanel, /<AdminSingleOpenAccordion/g) === 0 &&
    occurrenceCount(sharedEntitySeoPanel, /<AdminFormLayout/g) === 1 &&
    occurrenceCount(sharedEntitySeoPanel, /<AdminSingleOpenAccordion/g) === 1 &&
    sharedEntitySeoPanel.includes('defaultOpenId="search-result-preview"') &&
    sharedEntitySeoPanel.includes(
      'data-admin-seo-control-order="index-follow-canonical"',
    ) &&
    topicPublishingOptions.includes("data-content-publishing-options") &&
    topicPublishChecklist.includes("data-content-review-capability") &&
    topicPublishChecklist.includes(
      'data-content-review-presentation="dashboard"',
    ) &&
    topicPublishChecklist.includes("<AdminEntityReviewPanel") &&
    sharedEntityReviewPanel.includes(
      'data-admin-entity-review-presentation="dashboard"',
    ) &&
    ![topicPublishChecklist, sharedEntityReviewPanel].some((source) =>
      source.includes("AdminSingleOpenAccordion"),
    ),
);
check(
  "retired Topic presentation branches cannot fork Create from Edit",
  !topicTabs.includes("variant?:") &&
    !topicBasicPanel.includes("editorPresentation") &&
    !topicSeoPanel.includes("presentation?:") &&
    !topicSeoPanel.includes("presentation ===") &&
    !topicPublishingOptions.includes("presentation?:") &&
    !topicPublishingOptions.includes("presentation ===") &&
    !topicPublishChecklist.includes("presentation?:") &&
    !topicPublishChecklist.includes("presentation ===") &&
    ![articleCreate, articleEdit].some(
      (source) =>
        source.includes('variant="editor"') ||
        source.includes('presentation="editor"') ||
        source.includes('presentation="integrated"') ||
        source.includes('presentation="embedded"'),
    ),
);
check(
  "Topic content type uses one shared listbox contract without a retired native branch",
  topicContentTypeControl.includes("AdminListboxSelect") &&
    !topicContentTypeControl.includes("<select") &&
    !topicContentTypeControl.includes("presentation") &&
    !topicBasicPanel.includes('presentation="compact"'),
);
check(
  "scoped preview and builder routes adopt shared header and domain status owners directly",
  [topicPreview, projectPreview, menuBuilderPage].every((source) =>
    source.includes("components/admin/ui"),
  ) &&
    topicPreview.includes("getContentStatusMetadata") &&
    projectPreview.includes("getProjectPublicationMetadata") &&
    !existsSync(absolutePath("src/components/admin/AdminPageHeader.tsx")) &&
    !existsSync(absolutePath("src/components/admin/AdminStatusBadge.tsx")),
);
check(
  "Topic mode identity, Preview, and media-signal differences remain declarative and unique",
  occurrenceCount(contentEditorShell, /name="content_type"/g) === 1 &&
    occurrenceCount(contentEditorShell, /name="id"/g) === 1 &&
    articleCreate.includes('mode="create"') &&
    articleCreate.includes('contentType="article"') &&
    !articleCreate.includes("entityId=") &&
    articleEdit.includes('mode="edit"') &&
    articleEdit.includes('contentType="article"') &&
    articleEdit.includes("entityId={topic.id}") &&
    occurrenceCount(articleCreate, /<AdminEntityPreviewActions\b/g) === 0 &&
    occurrenceCount(articleEdit, /<AdminEntityPreviewActions\b/g) === 1 &&
    [articleCreate, articleEdit].every(
      (source) =>
        occurrenceCount(source, /<TopicMediaCatalogSyncSignal\b/g) === 1,
    ) &&
    topicMediaSyncSignal.includes('form.addEventListener("admin-form-saved"') &&
    topicMediaSyncSignal.includes("window.localStorage.setItem("),
);
check(
  "Topic Article editors no longer reference the parallel SaveBar engine",
  !articleCreate.includes("SaveBar") && !articleEdit.includes("SaveBar"),
);
check(
  "Topic taxonomy errors target one stable visible dropdown presentation",
  topicFormDefinition.includes(
    'category_id: { tabId: "basic", targetId: "content-category-listbox" }',
  ) &&
    topicFormDefinition.includes(
      'series_id: { tabId: "basic", targetId: "content-series-listbox" }',
    ) &&
    topicCategorySelect.includes('id="content-category-popover"') &&
    topicCategorySelect.includes('focusTargetId="content-category-listbox"') &&
    topicSeriesSelect.includes('id="content-series-popover"') &&
    topicSeriesSelect.includes('focusTargetId="content-series-listbox"') &&
    ![topicCategorySelect, topicSeriesSelect].some(
      (source) =>
        /(?:^|[<\s])presentation=/m.test(source) ||
        /(?:^|\s)presentation\??:/.test(source) ||
        /(?:^|\s)presentation\s*===/.test(source) ||
        source.includes("inline="),
    ) &&
    adminFormListboxSelect.includes("triggerId={focusTargetId}") &&
    adminListboxSelect.includes("id={`${controlId}-listbox`}") &&
    adminListboxSelect.includes('role="listbox"'),
);
check(
  "Shared inline listbox skips disabled options and exposes only selectable active descendants",
  inlineListboxHandlerStart >= 0 &&
    inlineListboxHandlerEnd > inlineListboxHandlerStart &&
    inlineListboxHandler.includes("if (!selectableOptions.length) return") &&
    inlineListboxHandler.includes("selectableOptions.findIndex") &&
    !inlineListboxHandler.includes("visibleOptions") &&
    adminListboxSelect.includes(
      "onKeyDown={(event) => handleInlineKeyDown(event, option.value)}",
    ) &&
    adminListboxSelect.includes("const inlineTabStopValue =") &&
    adminListboxSelect.includes("selectableOptions[0]?.value") &&
    adminListboxSelect.includes(
      "tabIndex={option.value === inlineTabStopValue ? 0 : -1}",
    ) &&
    occurrenceCount(adminListboxSelect, /aria-activedescendant=\{/g) === 3 &&
    occurrenceCount(
      adminListboxSelect,
      /aria-activedescendant=\{[\s\S]{0,120}resolvedActiveValue/g,
    ) === 3 &&
    !/aria-activedescendant=\{[\s\S]{0,120}visibleOptions/.test(
      adminListboxSelect,
    ),
);
check(
  "Shared Admin listbox owns the category-tree indentation presentation contract",
  adminListboxSelect.includes("depth?: number;") &&
    occurrenceCount(adminListboxSelect, /repeat\(option\.depth\)/g) === 2,
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
check(
  "full-page reference forms adopt one shared presentation cadence and page surface",
  adminFormPresentation.includes(
    'export const ADMIN_FORM_STACK_CLASS_NAME = "space-y-5"',
  ) &&
    adminFormPresentation.includes("grid gap-6 xl:grid-cols") &&
    adminFormPresentation.includes("`${ADMIN_FORM_SECTION_SURFACE_CLASSES} p-5`") &&
    adminFormPresentation.includes('compactHeader ? "mb-4" : "mb-5"') &&
    adminPageExperience.includes(
      'data-admin-page-surface-owner="AdminPageExperience"',
    ) &&
    adminPageExperience.includes("flex flex-col gap-6") &&
    [articleCreate, articleEdit].every(
      (source) =>
        source.includes("<AdminPageExperience") &&
        !source.includes('<main className="space-y-7">'),
    ) &&
    contentEditorShell.includes("className={ADMIN_FORM_STACK_CLASS_NAME}") &&
    [categoryForm, seriesForm].every((source) =>
      source.includes("className={ADMIN_FORM_STACK_CLASS_NAME}"),
    ),
);
check(
  "Media Topic Create and Edit delegate lifecycle and presentation to the unified content owners",
  [
    "<ContentEditorShell",
    "<ContentBasicDataPanel",
    "<ContentPublishingOptions",
    "<ContentReviewPanel",
    "<MediaEntitySeoPanel",
  ].every((marker) => mediaContentForm.includes(marker)) &&
    !mediaContentForm.includes("<form") &&
    !mediaContentForm.includes("<AdminStickyFormBar") &&
    !mediaContentForm.includes(
      'className="w-full rounded-2xl border border-white/10 bg-black/30',
    ),
);
check(
  "Redirect and Page quick-create forms adopt the existing shared field presentation owners",
  redirectForm.includes("<AdminFormField") &&
    redirectForm.includes("<AdminFormGrid") &&
    redirectForm.includes("<AdminFormListboxSelect") &&
    !redirectForm.includes("adminFormLabelClassName") &&
    !redirectForm.includes("<select") &&
    createPageModal.includes("<AdminFormField") &&
    !createPageModal.includes("adminFormLabelClassName"),
);

const runtime = read("src/components/admin/ui/AdminFormRuntime.tsx");
check(
  "shared Admin form grids use the dense but comfortable 16px rhythm",
  runtime.includes("grid gap-4") && !runtime.includes("grid gap-5"),
);
const formRuntimeContract = read("src/lib/admin/form-runtime.ts");
const actionsSource = runtime.slice(
  runtime.indexOf("export function AdminFormActions"),
);
const createEditHandoffStart = runtime.indexOf(
  'if (state.mode === "create" && state.editHref)',
);
const createEditHandoffReplace = runtime.indexOf(
  "router.replace(editHref, { scroll: false })",
  createEditHandoffStart,
);
const createEditHandoffEnd = runtime.indexOf(
  "\n    const submittedBaseline =",
  createEditHandoffReplace,
);
const createEditHandoff = runtime.slice(
  createEditHandoffStart,
  createEditHandoffEnd,
);
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
  "Form Runtime source exposes the pending, dirty-guard, feedback, and create-to-edit bindings without claiming mounted behavior",
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
  "create-to-edit source contract orders target validation, clean-state marking, callback, and replace",
  createEditHandoffStart >= 0 &&
    createEditHandoffReplace > createEditHandoffStart &&
    createEditHandoffEnd > createEditHandoffReplace &&
    runtime.includes("Boolean(state.editHref)") &&
    createEditHandoff.includes('resolveSafeInternalPath(state.editHref, "")') &&
    createEditHandoff.includes("markClean(submittedBaseline)") &&
    createEditHandoff.includes("onSuccess?.(state)") &&
    occurrenceCount(
      runtime,
      /router\.replace\(editHref, \{ scroll: false \}\)/g,
    ) === 1 &&
    createEditHandoff.indexOf("markClean(submittedBaseline)") <
      createEditHandoff.indexOf(
        "router.replace(editHref, { scroll: false })",
      ) &&
    createEditHandoff.indexOf("onSuccess?.(state)") <
      createEditHandoff.indexOf("router.replace(editHref, { scroll: false })"),
);
const formDomPreservation = read("src/lib/admin/form-dom-preservation.ts");
check(
  "shared runtime restores submitted DOM while successful RSC revisions stay server-owned",
  runtime.includes("captureAdminFormControls(form)") &&
    runtime.includes("restoreAdminFormControls(form, snapshot, {") &&
    runtime.includes("preserveServerOwned:") &&
    runtime.includes("useLayoutEffect(() =>") &&
    formDomPreservation.includes("form.elements") &&
    formDomPreservation.includes("serverOwnedNames") &&
    formDomPreservation.includes("!serverOwnedNames.has(name)") &&
    formDomPreservation.includes("entry.element.form !== form") &&
    formDomPreservation.includes(
      'hasAttribute("data-admin-form-server-owned")',
    ) &&
    contentEditorShell.includes('data-admin-form-server-owned=""') &&
    formDomPreservation.includes("new DataTransfer()"),
);
check(
  "Form Runtime source delegates pending field disabling to its shared fieldset boundary",
  /<fieldset\s+[\s\S]*?disabled=\{pending\}[\s\S]*?data-admin-form-fields=""[\s\S]*?>[\s\S]*?\{typeof children[\s\S]*?<\/fieldset>/.test(
    runtime,
  ),
);

const feedbackProvider = read("src/components/admin/AdminFeedbackProvider.tsx");
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
  "src/components/admin/content/editors/ContentPublishingOptions.tsx",
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
    'name="status"',
    "TopicDateLabelField",
  ].every((marker) => publishingOptions.includes(marker)) &&
    !publishingOptions.includes("SaveBar"),
);
const articleSaveHelpers = read(
  "src/app/admin/content/topics/article-actions/helpers.ts",
);
check(
  "Shared Date and Time owner fixes Admin presentation without changing the stored instant",
  ADMIN_DATE_TIME_PATTERN === "DD MMM YYYY, hh:mm A" &&
    ADMIN_DATE_ONLY_PATTERN === "DD MMM YYYY" &&
    ADMIN_TIME_ZONE === "Africa/Cairo" &&
    formatAdminDateTime("2026-08-06T23:24:00.000Z") ===
      "07 Aug 2026, 02:24 AM" &&
    formatAdminDateTime("2026-08-07") === "07 Aug 2026" &&
    formatAdminDateOnly("2026-08-07") === "07 Aug 2026" &&
    formatAdminDateOnly("2026-02-30") === "—",
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
    publishingOptions.includes("disabled={Boolean(publishedAt)}") &&
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
      status: "unpublished",
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
const unpublishedPreviewActions = resolveAdminEntityPreviewActions({
  entityType: "topic",
  entityId: 42,
  publicationStatus: "unpublished",
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
  unpublishedPreviewActions.length === 1 &&
    unpublishedPreviewActions[0]?.kind === "internal-preview" &&
    unpublishedPreviewActions[0]?.disabled === false &&
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
const topicFormRuntimeIndex = articleEdit.indexOf("<ContentEditorShell");
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
    occurrenceCount(articleEdit, /<ContentEditorShell\b/g) === 1,
);

const categoryRowActions = read(
  "src/app/admin/content/categories/CategoryRowActions.tsx",
);
const seriesColumns = read("src/app/admin/content/series/series-columns.tsx");
const categoryListClient = read(
  "src/app/admin/content/categories/CategoriesListClient.tsx",
);
const seriesTableClient = read(
  "src/app/admin/content/series/SeriesTableClient.tsx",
);
check(
  "Category and Series collection Preview/Public actions resolve through the shared capability before Row Actions presentation",
  categoryRowActions.includes("AdminDataGridRowActions") &&
    categoryRowActions.includes(
      "buildAdminCategoryCollectionPreviewCapability",
    ) &&
    seriesColumns.includes("AdminDataGridRowActions") &&
    seriesColumns.includes("buildAdminSeriesCollectionPreviewCapability") &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes("resolveAdminEntityPreviewActions") &&
        !source.includes("previewHref") &&
        !source.includes("topicsPreviewHref"),
    ),
);
check(
  "Category and Series collections consume action-scoped pending and shared feedback",
  [categoryListClient, seriesTableClient].every(
    (source) =>
      source.includes("rowInteraction: instant.getRowInteraction") &&
      !source.includes("instant.rowPending") &&
      !source.includes("instant.bulkPending") &&
      !source.includes("router.refresh"),
  ) &&
    !read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      "AdminFeedbackChannelViewport",
    ) &&
    read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      "publishFeedback(nextFeedback",
    ) &&
    read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      'placement: "global"',
    ),
);

const unifiedActionPath =
  "src/app/admin/content/topics/article-actions/save.ts";
const unifiedAction = read(unifiedActionPath);
const articleCreateDomain = read(
  "src/app/admin/content/topics/article-actions/create-domain.ts",
);
const preflightIndex = unifiedAction.indexOf(
  "const publishErrors = validateTopicFields(",
);
const uploadIndex = unifiedAction.indexOf("await uploadTopicImage(");
const createDelegateIndex = unifiedAction.indexOf(
  "await createArticleDomainRecord({",
);
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
    unifiedAction.includes("export async function saveArticleContentAdapter") &&
    read("src/app/admin/content/topics/editor-actions/save.ts").includes(
      "export async function saveContentForm",
    ),
);
check(
  "publish preflight runs before Storage and database writes",
  preflightIndex >= 0 &&
    uploadIndex > preflightIndex &&
    createDelegateIndex > uploadIndex &&
    articleCreateDomain.includes(".insert({") &&
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
  "Topic Create alone receives the safe shared-runtime Edit handoff target",
  /\.\.\.\(mode === "create"\s*\?\s*\{\s*editHref: `\/admin\/content\/topics\/\$\{entityId\}`\s*\}\s*:\s*\{\}\s*\)/.test(
    unifiedAction,
  ) &&
    occurrenceCount(unifiedAction, /editHref:/g) === 1 &&
    articleCreate.includes('mode="create"') &&
    articleEdit.includes('mode="edit"') &&
    !articleCreate.includes("router.replace") &&
    !articleEdit.includes("router.replace"),
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
  .filter((sourceFile) =>
    readFileSync(sourceFile, "utf8").includes("window.confirm"),
  )
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
