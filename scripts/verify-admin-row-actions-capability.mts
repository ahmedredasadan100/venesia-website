import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_ROW_ACTION_MORE_ORDER,
  ADMIN_ROW_ACTION_PRIMARY_ORDER,
} from "../src/lib/admin/interaction-system/admin-row-actions-capability.ts";
import {
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,
  ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
  type AdminRowActionsGovernedAction,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (sourceFile: string) =>
  readFileSync(join(ROOT, sourceFile), "utf8");

let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function sameOrderedValues(
  actual: readonly string[],
  expected: readonly string[],
) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameValueSet(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((value) => actual.includes(value))
  );
}

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(target);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [target] : [];
  });
}

function relativeSourceFile(sourceFile: string) {
  return relative(ROOT, sourceFile).replaceAll("\\", "/");
}

function extractRegistryEntities(source: string) {
  const registry = source.match(
    /adminEntityListAdapterRegistry\s*=\s*\{([\s\S]*?)\}\s*as const/,
  )?.[1];
  if (!registry) return [];

  return Array.from(
    registry.matchAll(/^\s*([a-z][a-zA-Z0-9_]*)\s*:/gm),
    (match) => match[1],
  );
}

const expectedEntities = [
  "topics",
  "categories",
  "series",
  "pages",
  "projects",
] as const;
const expectedRowActionEntities = [...expectedEntities, "redirects"] as const;
const expectedPrimaryOrder = ["edit", "preview", "more"] as const;
const expectedMoreOrder = [
  "information",
  "copyPublicLink",
  "visibility",
  "featured",
  "duplicate",
  "archive",
  "delete",
] as const;
const governedActionOrder = [
  "edit",
  "preview",
  ...expectedMoreOrder,
] as const satisfies readonly AdminRowActionsGovernedAction[];
const mutatingActions = [
  "visibility",
  "featured",
  "duplicate",
  "archive",
  "delete",
] as const satisfies readonly AdminRowActionsGovernedAction[];
const dangerousActions = [
  "archive",
  "delete",
] as const satisfies readonly AdminRowActionsGovernedAction[];

const paths = {
  registry: "src/lib/admin/entity-list/data-engine/registry.ts",
  capability:
    "src/lib/admin/interaction-system/admin-row-actions-capability.ts",
  renderer: "src/components/admin/ui/AdminDataGridRowActions.tsx",
  dataGrid: "src/components/admin/ui/AdminDataGrid.tsx",
  entityListSurface:
    "src/components/admin/entity-list/AdminEntityListSurface.tsx",
  entityList: "src/components/admin/entity-list/AdminEntityList.tsx",
  entityListTable:
    "src/components/admin/entity-list/AdminEntityListTable.tsx",
  confirmation: "src/components/admin/ui/AdminConfirmDialog.tsx",
  floatingLayer:
    "src/components/admin/entity-list/AdminFloatingLayerContext.tsx",
  floatingPosition:
    "src/components/admin/ui/useAdminFloatingMenuPosition.ts",
  instantMutation:
    "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
  topics: "src/components/admin/content/UnifiedContentRowActions.tsx",
  topicsList: "src/components/admin/content/TopicsListClient.tsx",
  topicsColumns: "src/components/admin/content/unified-content-columns.tsx",
  categories: "src/app/admin/content/categories/CategoryRowActions.tsx",
  categoriesList:
    "src/app/admin/content/categories/CategoriesListClient.tsx",
  categoriesColumns:
    "src/app/admin/content/categories/categories-columns.tsx",
  series: "src/app/admin/content/series/series-columns.tsx",
  seriesList: "src/app/admin/content/series/SeriesTableClient.tsx",
  pages: "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
  projectsList: "src/app/admin/projects/ProjectsTableClient.tsx",
  projects:
    "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
  redirects: "src/app/admin/seo/redirects/RedirectsClient.tsx",
  pagesConfig: "src/lib/admin/pages/pages-list-config.ts",
  pagesPreferences:
    "src/app/admin/pages-blocks/pages/page-actions/column-preferences.ts",
  pagination: "src/components/admin/ui/AdminTablePagination.tsx",
  pageExperience: "src/components/admin/ui/AdminPageExperience.tsx",
} as const;

for (const [id, sourceFile] of Object.entries(paths)) {
  check(`${id} canonical source exists`, existsSync(join(ROOT, sourceFile)));
}

const registryEntities = extractRegistryEntities(read(paths.registry));
const manifestEntries = ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities;
const manifestEntities = manifestEntries.map((entry) => entry.entity);
const sharedCapabilitiesModule = ADMIN_INTERACTION_MODULES.find(
  (module) => module.id === "shared_capabilities",
);

check(
  "Shared Capabilities inventory registers the Row Actions contract and renderer",
  [paths.capability, paths.renderer].every((sourceFile) =>
    sharedCapabilitiesModule?.sourceFiles.includes(sourceFile),
  ),
);
check(
  "Admin Interaction System records truthful Collection adoption blockers",
  ADMIN_INTERACTION_SYSTEM.globalClosed === false &&
    ADMIN_INTERACTION_SYSTEM.globalClosureBlockers.includes(
      "Full Collection Runtime adoption remains incomplete outside the current reference consumers.",
    ) &&
    !ADMIN_INTERACTION_SYSTEM.globalClosureBlockers.some((blocker) =>
      blocker.includes(
        "Category and Series collection interactions still have declared Collection Runtime gaps",
      ),
    ),
);

check(
  "Entity List registry contains exactly the five Foundation entities",
  sameValueSet(registryEntities, expectedEntities),
);
check(
  "Row Actions adoption ledger covers Entity List plus the generic Redirect collection",
  sameValueSet(manifestEntities, expectedRowActionEntities) &&
    registryEntities.every((entity) =>
      new Set<string>(manifestEntities).has(entity),
    ),
);
check(
  "Row Actions adoption ledger entity IDs are unique",
  new Set(manifestEntities).size === manifestEntities.length,
);
check(
  "generic adoption remains open only for authenticated final Browser QA",
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosed === false &&
    sameOrderedValues(
      ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosureBlockers,
      [
        "Authenticated Browser QA for the final working tree is still required before global closure.",
      ],
    ),
);
check(
  "none of the generic collections claims Manual Order support",
  manifestEntries.every((entry) => entry.manualOrder === false),
);

check(
  "primary row-action order is Edit, Preview, More",
  sameOrderedValues(ADMIN_ROW_ACTION_PRIMARY_ORDER, expectedPrimaryOrder) &&
    sameOrderedValues(
      ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.canonicalOrders.primary,
      expectedPrimaryOrder,
    ),
);
check(
  "More order is Information, Copy Public Link, Visibility, Featured, Duplicate, Archive, Delete",
  sameOrderedValues(ADMIN_ROW_ACTION_MORE_ORDER, expectedMoreOrder) &&
    sameOrderedValues(
      ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.canonicalOrders.more,
      expectedMoreOrder,
    ),
);

const dataGridSource = read(paths.dataGrid);
const rendererSource = read(paths.renderer);
check(
  "DataGrid primitive publishes the same fixed primary order",
  /actionOrder:\s*\[\s*["']edit["']\s*,\s*["']preview["']\s*,\s*["']more["']\s*\]/m.test(
    dataGridSource,
  ),
);
check(
  "shared renderer resolves More items only through the canonical order",
  rendererSource.includes("ADMIN_ROW_ACTION_MORE_ORDER.map") &&
    rendererSource.includes('label: "نسخ الرابط العام"') &&
    dataGridSource.includes('| "copy-link"'),
);
check(
  "More uses the existing floating-layer infrastructure with viewport collision",
  rendererSource.includes("useAdminFloatingLayer") &&
    rendererSource.includes("useAdminFloatingMenuPosition") &&
    rendererSource.includes("createPortal(") &&
    rendererSource.includes("max-w-[calc(100vw-24px)]") &&
    rendererSource.includes('dir="rtl"'),
);
check(
  "More exposes the shared keyboard and focus contract",
  ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Tab"].every(
    (key) => rendererSource.includes(`"${key}"`),
  ) &&
    rendererSource.includes("event.shiftKey") &&
    rendererSource.includes("focusAdjacentToTrigger") &&
    rendererSource.includes("const wrapped = backwards") &&
    rendererSource.includes("next ?? wrapped ?? fallback") &&
    rendererSource.includes("focus-visible:outline"),
);
check(
  "More focuses its requested enabled item during layout without a cancellable frame race",
  rendererSource.includes("type PanelFocusIntent") &&
    rendererSource.includes("useLayoutEffect(() => {") &&
    rendererSource.includes("const focusIntent = panelFocusIntentRef.current") &&
    rendererSource.includes("document.activeElement === focusTarget") &&
    rendererSource.includes("panelFocusIntentRef.current = null") &&
    !rendererSource.includes("focusMenuOnOpenRef"),
);
check(
  "new Row Actions focus sessions supersede stale restoration callbacks across rows and unmount",
  rendererSource.includes("type ResolvedFocusRestoreHandle") &&
    rendererSource.includes("let activeResolvedFocusRestore") &&
    rendererSource.includes("function cancelPendingResolvedFocus") &&
    rendererSource.includes("activeResolvedFocusRestore !== handle") &&
    rendererSource.includes("focusRestoreHandleRef.current") &&
    /function openWithFocus[\s\S]{0,500}cancelPendingResolvedFocus\(\);[\s\S]{0,500}setIsOpen\(true\)/.test(
      rendererSource,
    ) &&
    rendererSource.includes("window.cancelAnimationFrame") &&
    rendererSource.includes("const pendingRestore = focusRestoreHandleRef.current") &&
    rendererSource.includes("pendingRestore?.isPending()") &&
    rendererSource.includes("pendingRestore?.cancel()") &&
    rendererSource.includes("activeElement !== document.body") &&
    rendererSource.includes("const immediateFocusTarget = resolveReturnFocus()"),
);
check(
  "Information focus and return use explicit targets with a visible title fallback",
  rendererSource.includes('"information-panel"') &&
    rendererSource.includes('"information-menu-item"') &&
    rendererSource.includes("informationBackRef.current") &&
    rendererSource.includes("informationTitleRef.current") &&
    rendererSource.includes('data-admin-row-actions-information-title=""') &&
    rendererSource.includes("tabIndex={-1}") &&
    rendererSource.includes(
      '[data-admin-row-action-menu-item="information"]:not([aria-disabled="true"])',
    ),
);
check(
  "Escape, outside close, and removed-row cleanup share a visible non-body focus resolver",
  rendererSource.includes("const createReturnFocusResolver = useCallback") &&
    rendererSource.includes("closeAndReturnFocus();") &&
    rendererSource.includes("const immediateFocusTarget = resolveReturnFocus()") &&
    rendererSource.includes("restoreResolvedFocus(resolveReturnFocus)") &&
    rendererSource.includes("firstVisibleMore") &&
    rendererSource.includes("isVisibleFocusTarget(surface)") &&
    rendererSource.includes("const needsImmediateFallback") &&
    rendererSource.includes("if (!needsImmediateFallback) return") &&
    !rendererSource.includes("document.body.focus"),
);
check(
  "shared presentation exposes disabled and pending semantics",
  rendererSource.includes("aria-disabled={!enabled}") &&
    rendererSource.includes("aria-busy={target.pending || undefined}") &&
    rendererSource.includes('data-admin-row-action-state') &&
    rendererSource.includes("disabled={!enabled}"),
);

const expectedConsumerFiles = new Map<string, string>([
  ["topics", paths.topics],
  ["categories", paths.categories],
  ["series", paths.series],
  ["pages", paths.pages],
  ["projects", paths.projects],
  ["redirects", paths.redirects],
]);

for (const entry of manifestEntries) {
  const expectedConsumer = expectedConsumerFiles.get(entry.entity);
  check(
    `${entry.entity} declares its approved consumer boundary`,
    entry.consumerSourceFile === expectedConsumer,
  );
  check(
    `${entry.entity} relevant sources all exist`,
    entry.sourceFiles.length >= (entry.entity === "redirects" ? 2 : 3) &&
      entry.sourceFiles.every((sourceFile) =>
        existsSync(join(ROOT, sourceFile)),
      ),
  );

  const consumer = read(entry.consumerSourceFile);
  check(
    `${entry.entity} imports and renders the shared Row Actions capability`,
    consumer.includes("AdminDataGridRowActions") &&
      /<AdminDataGridRowActions\b/.test(consumer),
  );
  check(
    `${entry.entity} declares every governed action exactly once`,
    sameValueSet(Object.keys(entry.actions), governedActionOrder),
  );
  const staticHiddenActions = governedActionOrder.filter((action) =>
    new RegExp(
      `\\b${action}\\s*:\\s*\\{\\s*access\\s*:\\s*["']hidden["']\\s*\\}`,
      "m",
    ).test(consumer),
  );
  const manifestHiddenActions = governedActionOrder.filter(
    (action) => entry.actions[action] === "hidden",
  );
  check(
    `${entry.entity} manifest matches its statically hidden actions`,
    sameValueSet(staticHiddenActions, manifestHiddenActions),
  );
  check(
    `${entry.entity} delegates to the existing shared owners`,
    entry.owners.presentation ===
      ADMIN_ROW_ACTIONS_EXISTING_OWNERS.presentation &&
      (entry.owners.data === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.data ||
        entry.owners.data === "domain_action_adapter") &&
      entry.owners.feedback === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.feedback &&
      entry.owners.confirmation ===
        ADMIN_ROW_ACTIONS_EXISTING_OWNERS.confirmation &&
      entry.owners.audit === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.audit,
  );

  const supportedMutations = mutatingActions.filter(
    (action) => entry.actions[action] !== "hidden",
  );
  check(
    `${entry.entity} declares Audit ownership for every supported mutation`,
    sameValueSet(entry.auditedActions, supportedMutations),
  );

  const supportedDangerousActions = dangerousActions.filter(
    (action) => entry.actions[action] !== "hidden",
  );
  check(
    `${entry.entity} declares Confirmation ownership for every dangerous action`,
    sameValueSet(entry.confirmationActions, supportedDangerousActions),
  );

  const relevantSource = entry.sourceFiles.map(read).join("\n");
  check(
    `${entry.entity} retains server-side Audit integration in its domain sources`,
    relevantSource.includes("recordCmsAdminAudit"),
  );
  const sharedConfirmationDeclaration =
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']shared["']/.test(
      consumer,
    );
  const delegatedConfirmationDeclaration =
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']delegated["'][\s\S]{0,240}?owner\s*:\s*["']confirmation_runtime["']/.test(
      consumer,
    );
  check(
    `${entry.entity} uses the shared Confirmation owner and no native confirm`,
    (sharedConfirmationDeclaration || delegatedConfirmationDeclaration) &&
      !relevantSource.includes("window.confirm"),
  );
  check(
    `${entry.entity} keeps pending and duplicate-click protection with its declared Data owner`,
    entry.owners.data === "data_runtime"
      ? relevantSource.includes("useAdminEntityInstantMutation") &&
          relevantSource.includes(
            "instant.rowPending !== null || instant.bulkPending !== null",
          ) &&
          consumer.includes("mutationBusy")
      : consumer.includes("pendingRowId") &&
          consumer.includes("if (pendingRowId !== null) return") &&
          relevantSource.includes("toggleRedirectStatusAction") &&
          relevantSource.includes("deleteRedirectAction"),
  );
  if (entry.actions.delete === "adopted") {
    check(
      `${entry.entity} rejects failed shared-confirmation commands after publishing feedback`,
      entry.entity === "redirects"
        ? consumer.includes("onSelect: () => input.onDelete(row)")
        : consumer.includes("throw "),
    );
  }
}

const ownerSourceFiles = Object.values(
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.ownerSourceFiles,
).flat();
check(
  "all declared Row Actions owner sources exist",
  ownerSourceFiles.every((sourceFile) => existsSync(join(ROOT, sourceFile))),
);
check(
  "owner source declarations are unique within each responsibility",
  Object.values(ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.ownerSourceFiles).every(
    (sourceFiles) => new Set(sourceFiles).size === sourceFiles.length,
  ),
);

const topicsSource = read(paths.topics);
check(
  "Topics row path has no local mutation transition or refresh owner",
  !topicsSource.includes("useTransition") &&
    !topicsSource.includes("pendingRef") &&
    !/\brouter\s*\.\s*refresh\s*\(/.test(topicsSource),
);

const pagesSource = read(paths.pages);
check(
  "Pages has no local AdminNotice feedback owner",
  !/<AdminNotice\b|\buseAdminFeedback\b|\bsetFeedback\b/.test(pagesSource),
);
check(
  "Pages duplicate is not a direct server-action form",
  !/\baction\s*=\s*\{\s*duplicatePage\s*\}/.test(pagesSource),
);

const sharedCoreSource = [
  read(paths.capability),
  rendererSource,
  dataGridSource,
].join("\n");
const entityLiteralPattern =
  /["'`](?:topics|categories|series|pages|projects|redirects)["'`]/i;
const entityRoutePattern =
  /\/(?:admin\/content|admin\/pages-blocks|admin\/projects|topics|projects)(?:\/|\?|["'`])/i;
check(
  "shared Row Actions core contains no registered-entity hardcoding",
  !entityLiteralPattern.test(sharedCoreSource) &&
    !entityRoutePattern.test(sharedCoreSource),
);

const capabilityAndRendererSource = [
  read(paths.capability),
  rendererSource,
].join("\n");
check(
  "shared capability owns no mutation, feedback, or audit runtime and delegates confirmation",
  !capabilityAndRendererSource.includes("useAdminEntityInstantMutation") &&
    !capabilityAndRendererSource.includes("recordCmsAdminAudit") &&
    !capabilityAndRendererSource.includes("AdminFeedbackProvider") &&
    rendererSource.includes("AdminConfirmDialog") &&
    !capabilityAndRendererSource.includes("window.confirm") &&
    !/<form\b/.test(capabilityAndRendererSource),
);

const instantMutationSource = read(paths.instantMutation);
check(
  "existing Data Runtime owns optimism, duplicate-click protection, rollback, and targeted invalidation",
  instantMutationSource.includes("request.optimistic(helpers)") &&
    instantMutationSource.includes("inFlightRef.current") &&
    instantMutationSource.includes("restoreSnapshot(context.snapshot)") &&
    instantMutationSource.includes("invalidateQueries({") &&
    instantMutationSource.includes("adminEntityListQueryKeys.entity(entity)"),
);
const confirmationSource = read(paths.confirmation);
check(
  "existing Confirmation Runtime owns focus trapping and pending invocation lock",
  confirmationSource.includes("FOCUSABLE_SELECTOR") &&
    confirmationSource.includes("invokingRef.current") &&
    confirmationSource.includes("returnFocusRef") &&
    confirmationSource.includes('aria-modal="true"'),
);

const entityListSurfaceSource = read(paths.entityListSurface);
const entityListSource = read(paths.entityList);
const entityListTableSource = read(paths.entityListTable);
const floatingLayerSource = read(paths.floatingLayer);
const floatingPositionSource = read(paths.floatingPosition);
const topicsColumnsSource = read(paths.topicsColumns);
const categoriesListSource = read(paths.categoriesList);
const categoriesColumnsSource = read(paths.categoriesColumns);
const seriesColumnsSource = read(paths.series);
const projectsColumnsSource = read(paths.projects);

check(
  "shared Row Actions geometry fixes three compact buttons at 144px",
  dataGridSource.includes("buttonCount: 3") &&
    dataGridSource.includes("buttonPx: 40") &&
    dataGridSource.includes("gapPx: 4") &&
    dataGridSource.includes("cellInlinePaddingPx: 6") &&
    dataGridSource.includes("borderSafetyPx: 4") &&
    dataGridSource.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH") &&
    dataGridSource.includes("cellInlinePaddingPx * 2") &&
    dataGridSource.includes("borderSafetyPx"),
);
check(
  "actions header, body, and colgroup share width/minWidth/maxWidth",
  dataGridSource.includes("getAdminDataGridFixedColumnStyle") &&
    dataGridSource.includes("minWidth: width") &&
    dataGridSource.includes("maxWidth: width") &&
    entityListTableSource.includes(
      "getAdminDataGridFixedColumnStyle(actionsColumnWidth)",
    ) &&
    entityListTableSource.includes(
      "<AdminDataGridStickyActionsHeaderCell",
    ) &&
    entityListTableSource.includes("<AdminDataGridStickyActionsCell"),
);
check(
  "fixed table tracks do not absorb remaining viewport width",
  entityListTableSource.includes("const flexibleColumnKey = columns.find") &&
    entityListTableSource.includes("function getColumnBaseWidth") &&
    entityListTableSource.includes("const tableMinWidth =") &&
    entityListTableSource.includes('className="w-full table-fixed') &&
    entityListTableSource.includes("column.key === flexibleColumnKey") &&
    entityListTableSource.includes(
      'width: flexibleColumnKey === undefined ? tableMinWidth : "100%"',
    ) &&
    !entityListTableSource.includes("w-max min-w-full table-fixed"),
);
check(
  "shared actions cells own equal 6px logical inline padding",
  dataGridSource.includes('actionCellInlinePadding: "px-1.5"') &&
    dataGridSource.includes("ADMIN_DATA_GRID_RULES.actionCellInlinePadding") &&
    dataGridSource.includes("p-0 transition group-hover"),
);

const geometryConsumers = [
  topicsColumnsSource,
  categoriesColumnsSource,
  seriesColumnsSource,
  pagesSource,
  projectsColumnsSource,
  read(paths.redirects),
];
check(
  "all generic consumers use the shared actions width without local constants",
  [
    topicsColumnsSource,
    categoriesColumnsSource,
    seriesColumnsSource,
    projectsColumnsSource,
    pagesSource,
    read(paths.redirects),
  ].every((source) =>
    source.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH"),
  ) &&
    geometryConsumers.every(
      (source) =>
        !/(?:ACTION|ACTIONS)[A-Z0-9_]*_COLUMN_WIDTH\s*=\s*(?:132|144|156)\b/.test(
          source,
        ),
    ),
);
check(
  "Pages delegates padded sticky action placement to AdminEntityListTable",
  pagesSource.includes("<AdminEntityList<") &&
    pagesSource.includes('sticky: "end"') &&
    pagesSource.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH") &&
    !pagesSource.includes("AdminDataGridActionsHeaderCell") &&
    !pagesSource.includes("flushInlineEnd"),
);

check(
  "shared primary-column contract budgets 200px before ellipsis",
  dataGridSource.includes("textBudgetPx: 200") &&
    dataGridSource.includes("ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS") &&
    dataGridSource.includes("textOnly:") &&
    dataGridSource.includes("compactIcon:") &&
    dataGridSource.includes("standardIcon:"),
);
check(
  "Topics, Series, Projects, and Pages consume shared primary presets",
  topicsColumnsSource.includes(
    "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.compactIcon",
  ) &&
    seriesColumnsSource.includes(
      "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon",
    ) &&
    projectsColumnsSource.includes(
      "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon",
    ) &&
    pagesSource.includes("ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly"),
);
check(
  "Categories derives one hierarchy-aware width from maximum visible depth",
  dataGridSource.includes("getAdminDataGridHierarchyPrimaryColumnWidth") &&
    dataGridSource.includes("hierarchyDepthStepPx: 28") &&
    categoriesColumnsSource.includes(
      "getAdminDataGridHierarchyPrimaryColumnWidth(maxVisibleDepth)",
    ) &&
    categoriesListSource.includes("const maxVisibleDepth = pageRows.reduce") &&
    categoriesListSource.includes("{ maxVisibleDepth }") &&
    !categoriesColumnsSource.includes("width: row.depth"),
);

const listConsumerSources = [
  read(paths.topicsList),
  categoriesListSource,
  read(paths.seriesList),
  pagesSource,
  read(paths.projectsList),
  read(paths.redirects),
];
check(
  "all generic consumers removed local Surface spacing",
  listConsumerSources.every(
    (source) =>
      !/<AdminEntityListSurface\b[^>]*className\s*=\s*["'][^"']*space-y-4/.test(
        source,
      ),
  ),
);
check(
  "shared list parents own the single 28px top-level cadence",
  entityListSurfaceSource.includes("AdminEntityListPrimarySection") &&
    entityListSurfaceSource.includes('SURFACE_LAYOUT_CLASSES = "flex flex-col gap-7"') &&
    !entityListSurfaceSource.includes("mt-3") &&
    entityListSurfaceSource.includes("AdminEntityListPageLayout") &&
    entityListSurfaceSource.includes("gap-7") &&
    entityListSource.includes("AdminEntityListPrimarySection") &&
    entityListSource.includes('className="scroll-mt-6 flex flex-col gap-7"') &&
    !entityListSource.includes("primary-section]:mt-") &&
    !read(paths.pagination).includes('className={`mt-4') &&
    read(paths.pageExperience).includes("flex flex-col gap-7"),
);
check(
  "Pages uses shared page cadence, columns persistence, and Entity List",
  pagesSource.includes("<AdminEntityListPageLayout") &&
    pagesSource.includes("<AdminEntityListPrimarySection") &&
    pagesSource.includes("enableColumnManagement") &&
    pagesSource.includes("savePagesTablePreferences") &&
    read(paths.pagesConfig).includes("PAGES_PREFERENCE_COLUMN_KEYS") &&
    read(paths.pagesPreferences).includes("saveAdminColumnPreferences") &&
    !pagesSource.includes("ADMIN_LIST_PAGE.wrapper"),
);

const collectionSurfaces = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces;
const collectionIds = collectionSurfaces.map((surface) => surface.id);
const classifiedPresentationSources = collectionSurfaces.flatMap((surface) =>
  surface.presentationSourceFiles.map((sourceFile) => ({
    id: surface.id,
    sourceFile,
  })),
);
const presentationSourceCounts = new Map<string, number>();
for (const { sourceFile } of classifiedPresentationSources) {
  presentationSourceCounts.set(
    sourceFile,
    (presentationSourceCounts.get(sourceFile) ?? 0) + 1,
  );
}
const scannedCollectionPresentationSources = [
  ...collectTsxFiles(join(ROOT, "src/app/admin")),
  ...collectTsxFiles(join(ROOT, "src/components/admin")),
]
  .filter((sourceFile) => {
    const source = readFileSync(sourceFile, "utf8");
    return /<AdminEntityList(?:\s|<)|<AdminDataGrid(?:\s|>)|<table(?:\s|>)/.test(
      source,
    );
  })
  .map(relativeSourceFile)
  .filter(
    (sourceFile) =>
      sourceFile !==
      "src/components/admin/entity-list/AdminEntityListTable.tsx",
  )
  .sort();

check(
  "Collection inventory IDs and concrete presentation ownership are unique",
  new Set(collectionIds).size === collectionIds.length &&
    [...presentationSourceCounts.values()].every((count) => count === 1),
);
check(
  "every inventoried Collection page and presentation source exists",
  collectionSurfaces.every((surface) =>
    [...surface.pageSourceFiles, ...surface.presentationSourceFiles].every(
      (sourceFile) => existsSync(join(ROOT, sourceFile)),
    ),
  ),
);
check(
  "every AdminEntityList, AdminDataGrid, or native table surface is classified exactly once",
  scannedCollectionPresentationSources.every(
    (sourceFile) => presentationSourceCounts.get(sourceFile) === 1,
  ),
);
check(
  "all generic Collection routes are adopted with shared Row Actions and layout owners",
  collectionSurfaces
    .filter((surface) => surface.generic)
    .every(
      (surface) =>
        surface.classification === "adopted" &&
        surface.rowActionsOwner === "shared_admin_row_actions" &&
        surface.layoutOwner.includes("AdminEntityList") &&
        surface.routes.length > 0,
    ) &&
    !collectionSurfaces.some(
      (surface) => String(surface.classification) === "legacy_generic_gap",
    ) &&
    ADMIN_COLLECTION_SURFACE_ADOPTION.legacyGenericGaps.length === 0,
);
check(
  "optional generic columns use the shared owner and fixed Redirect columns are explicit",
  collectionSurfaces
    .filter(
      (surface) =>
        surface.generic && surface.id !== "seo-redirects",
    )
    .every(
      (surface) =>
        surface.columnVisibility === "shared_optional_columns",
    ) &&
    collectionSurfaces.find((surface) => surface.id === "seo-redirects")
      ?.columnVisibility === "fixed_no_optional_columns",
);
check(
  "Collection global closure remains truthful until authenticated Browser QA",
  ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed === false &&
    ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosureBlockers.length === 1 &&
    ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosureBlockers[0].includes(
      "Authenticated Browser QA",
    ),
);
check(
  "Project Residential and Commercial routes share one consumer and action declaration",
  collectionSurfaces.find(
    (surface) => surface.id === "projects-residential-commercial",
  )?.routes.join("|") ===
    "/admin/projects/residential|/admin/projects/commercial" &&
    collectionSurfaces.find(
      (surface) => surface.id === "projects-residential-commercial",
    )?.presentationSourceFiles.join("|") === paths.projectsList &&
    projectsColumnsSource.includes("copyPublicLink:") &&
    projectsColumnsSource.includes('visibility: { access: "hidden" }') &&
    projectsColumnsSource.includes("onToggleFeatured") &&
    projectsColumnsSource.includes("onDuplicate") &&
    projectsColumnsSource.includes('archive: { access: "hidden" }'),
);

check(
  "primary header/body de-stick at and below 640px only",
  (entityListTableSource.match(/max-\[640px\]:static/g)?.length ?? 0) >= 2 &&
    (entityListTableSource.match(/min-\[641px\]:sticky/g)?.length ?? 0) >= 2 &&
    !entityListTableSource.includes("max-sm:static"),
);
check(
  "checkbox and actions remain logical-edge sticky while primary de-sticks",
  entityListTableSource.includes("sticky start-0") &&
    dataGridSource.includes('data-admin-grid-sticky={sticky ? "inline-start"') &&
    dataGridSource.includes('data-admin-grid-sticky="inline-end"') &&
    dataGridSource.includes("sticky end-0"),
);

check(
  "Information and More use separate initial height estimates",
  rendererSource.includes("ROW_ACTION_MENU_ESTIMATED_HEIGHT") &&
    rendererSource.includes("ROW_ACTION_INFORMATION_ESTIMATED_HEIGHT") &&
    /panelView\s*===\s*["']information["'][\s\S]{0,160}?ROW_ACTION_INFORMATION_ESTIMATED_HEIGHT[\s\S]{0,120}?ROW_ACTION_MENU_ESTIMATED_HEIGHT/.test(
      rendererSource,
    ),
);
check(
  "floating position remeasures panel content and all viewport/scroll changes",
  floatingPositionSource.includes("floating.scrollHeight") &&
    floatingPositionSource.includes("ResizeObserver") &&
    floatingPositionSource.includes("observer.observe(anchor)") &&
    floatingPositionSource.includes("repositionKey") &&
    floatingPositionSource.includes(
      'window.addEventListener("scroll", updatePosition, true)',
    ) &&
    floatingPositionSource.includes(
      'window.addEventListener("resize", updatePosition)',
    ) &&
    floatingPositionSource.includes(
      'window.visualViewport?.addEventListener("resize", updatePosition)',
    ) &&
    floatingPositionSource.includes(
      'window.visualViewport?.addEventListener("scroll", updatePosition)',
    ),
);
check(
  "floating position measures the rendered border box without integer-rounding underflow",
  floatingPositionSource.includes("styles.borderTopWidth") &&
    floatingPositionSource.includes("styles.borderBottomWidth") &&
    floatingPositionSource.includes(
      "floating.getBoundingClientRect().height - floating.clientHeight",
    ) &&
    floatingPositionSource.includes(
      "Math.ceil(floating.scrollHeight + boxAdjustment)",
    ) &&
    !floatingPositionSource.includes(
      "floating.offsetHeight - floating.clientHeight",
    ),
);
check(
  "Information slides fully inside the viewport before enabling one panel scroll",
  floatingPositionSource.includes("requestedHeight <= viewportHeight") &&
    floatingPositionSource.includes("maxHeight: requestedHeight") &&
    floatingPositionSource.includes("const top = clamp(") &&
    floatingPositionSource.includes("const bottom = clamp(") &&
    floatingPositionSource.includes("top: viewportPadding") &&
    floatingPositionSource.includes("maxHeight: viewportHeight"),
);
check(
  "floating position closes safely when its anchor is no longer renderable",
  floatingPositionSource.includes("!anchor.isConnected") &&
    floatingPositionSource.includes("anchor.getClientRects().length === 0") &&
    floatingPositionSource.includes("onAnchorInvalid?.()") &&
    floatingPositionSource.includes("new MutationObserver") &&
    rendererSource.includes("onAnchorInvalid: closeAndReturnFocus"),
);
check(
  "Information uses the system scrollbar and prevents page scroll chaining",
  rendererSource.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") &&
    rendererSource.includes("overscroll-contain") &&
    rendererSource.includes('document.body.style.overflow = "hidden"') &&
    rendererSource.includes("document.body.style.overflow = previousOverflow") &&
    !rendererSource.includes("max-h-[min(340px"),
);

check(
  "shared confirmation snapshots the allowed command above row lifetime",
  floatingLayerSource.includes("AdminEntityListConfirmationSnapshot") &&
    floatingLayerSource.includes("openConfirmation") &&
    floatingLayerSource.includes("<AdminConfirmDialog") &&
    rendererSource.includes("const snapshot: AdminEntityListConfirmationSnapshot") &&
    rendererSource.includes("onConfirm: target.onSelect") &&
    rendererSource.includes("floating.openConfirmation(snapshot)") &&
    !rendererSource.includes("confirmingTarget") &&
    !rendererSource.includes("setConfirmingKind"),
);
check(
  "bulk confirmation uses the same owner and fails closed when unavailable",
  entityListSource.includes("getBulkConfirmation") &&
    entityListSource.includes("floating.openConfirmation({") &&
    entityListSource.includes("onConfirm: () => executeBulk(action, ids)") &&
    entityListSource.includes("لم يبدأ الإجراء") &&
    entityListSource.indexOf("floating.openConfirmation({") <
      entityListSource.indexOf("onConfirm: () => executeBulk(action, ids)") &&
    !entityListSource.includes("if (!confirmation || !floating)"),
);
check(
  "shared confirmation closes only after success and remains retryable after failure",
  floatingLayerSource.includes("await activeConfirmation.onConfirm()") &&
    floatingLayerSource.includes("current === activeConfirmation ? null : current") &&
    confirmationSource.includes("invokingRef.current") &&
    confirmationSource.includes("if (failed)") &&
    confirmationSource.includes("data-admin-confirm-submit") &&
    confirmationSource.includes("Keep the dialog open"),
);
check(
  "confirmation restores focus through a connected target after optimistic row removal",
  rendererSource.includes("createReturnFocusResolver") &&
    rendererSource.includes(
      "trigger?.isConnected && isDocumentTabbable(trigger)",
    ) &&
    rendererSource.includes("firstVisibleMore") &&
    confirmationSource.includes("configuredReturnFocusResolver") &&
    confirmationSource.includes("focusTarget?.isConnected"),
);
check(
  "Row Actions correction creates no native or parallel mutation runtime",
  ![
    rendererSource,
    floatingLayerSource,
    floatingPositionSource,
    entityListSurfaceSource,
  ].some((source) => source.includes("window.confirm")) &&
    !floatingLayerSource.includes("useAdminEntityInstantMutation") &&
    !rendererSource.includes("useAdminEntityInstantMutation"),
);

check(
  "Category delete is the only declared specialized Row Actions adapter",
  manifestEntries.flatMap((entry) =>
    Object.entries(entry.actions)
      .filter(([, state]) => state === "specialized_adapter")
      .map(([action]) => `${entry.entity}:${action}`),
  ).join(",") === "categories:delete",
);

console.log(`Admin Row Actions capability verification passed (${passed} checks).`);
