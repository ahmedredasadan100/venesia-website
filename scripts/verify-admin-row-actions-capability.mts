import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_ROW_ACTION_MORE_ORDER,
  ADMIN_ROW_ACTION_PRIMARY_ORDER,
} from "../src/lib/admin/interaction-system/admin-row-actions-capability.ts";
import {
  resolveClientPagination,
  slicePageRows,
} from "../src/lib/admin/entity-list/pagination.ts";
import { writeAdminBoundedClientPaginationParams } from "../src/lib/admin/entity-list/url-state.ts";
import {
  resolveAdminEntityListInteractionState,
  resolveAdminInstantMutationInteraction,
} from "../src/lib/admin/entity-list/data-engine/interaction-state.ts";
import {
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
  ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS,
  ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS,
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,
  ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
  type AdminCollectionFullAdoptionClaim,
  type AdminCollectionSurfaceInventoryEntry,
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

function closureStateIsConsistent(
  globalClosed: boolean,
  blockers: readonly string[],
) {
  return globalClosed ? blockers.length === 0 : blockers.length > 0;
}

function adoptionGapStateIsConsistent(
  globalClosed: boolean,
  gaps: readonly string[],
  partialSurfaceCount: number,
) {
  return globalClosed
    ? gaps.length === 0
    : gaps.length === partialSurfaceCount;
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

const collectionSurfaces = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces;
const declaredDataRegistryEntities = collectionSurfaces
  .filter((surface) => surface.generic)
  .flatMap((surface) => surface.dataRegistryEntities);
const expectedRowActionEntities = collectionSurfaces
  .filter(
    (surface) => surface.generic && surface.rowActionsState === "adopted",
  )
  .flatMap((surface) => surface.dataRegistryEntities);
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
  manifest: "src/lib/admin/interaction-system/adoption-manifest.ts",
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
  dataAdapter: "src/lib/admin/entity-list/data-engine/adapter.ts",
  dataController:
    "src/lib/admin/entity-list/data-engine/client-controller.ts",
  adminListSearch: "src/lib/admin/admin-list-search.ts",
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
  projectsAdapter: "src/lib/admin/projects/entity-list-adapter.ts",
  projectPublishing:
    "sql/migrations/20260803120000_project_publishing_visibility_capability.sql",
  projectLocations:
    "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
  redirects: "src/app/admin/seo/redirects/RedirectsClient.tsx",
  pagesConfig: "src/lib/admin/pages/pages-list-config.ts",
  pagesPreferences:
    "src/app/admin/pages-blocks/pages/page-actions/column-preferences.ts",
  pagination: "src/components/admin/ui/AdminTablePagination.tsx",
  boundedPagination:
    "src/lib/admin/entity-list/bounded-client-pagination.ts",
  pageAssignments:
    "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  pageAssignmentsGrid:
    "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
  pageAssignmentRow:
    "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
  pageActions: "src/app/admin/pages-blocks/pages/actions.ts",
  pageActionIndex:
    "src/app/admin/pages-blocks/pages/page-actions/index.ts",
  menuItems:
    "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  menuActions: "src/app/admin/pages-blocks/menus/actions.ts",
  menuActionIndex:
    "src/app/admin/pages-blocks/menus/menu-actions/index.ts",
  footerLinks:
    "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
  blockModuleManager:
    "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  contentBlockManager:
    "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  heroBlockManager:
    "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  blockTemplateSummary:
    "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
  pageExperience: "src/components/admin/ui/AdminPageExperience.tsx",
  pageHeader: "src/components/admin/ui/AdminPageContextHeader.tsx",
  shell: "src/components/admin/AdminShell.tsx",
  activityLog: "src/app/admin/activity-log/ActivityLogClient.tsx",
  topicsWithoutImage:
    "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  redirectsFilters: "src/app/admin/seo/redirects/RedirectsListFilters.tsx",
  redirectsActions: "src/app/admin/seo/redirects/actions.ts",
  redirectsAdapter: "src/lib/admin/redirects/entity-list-adapter.ts",
  activityAdapter: "src/lib/admin/audit/entity-list-adapter.ts",
  activityLoader: "src/lib/admin/audit/list-admin-audit-logs.ts",
  reportAdapter:
    "src/lib/admin/media-catalog/topics-without-image-entity-list-adapter.ts",
  reportQuery: "src/lib/admin/media-catalog/reports.ts",
  mediaRecovery:
    "src/app/admin/settings/media/MediaRecoveryCenter.tsx",
  usersRoles: "src/app/admin/users-roles/UsersManagementClient.tsx",
  usersForm: "src/app/admin/users-roles/AdminUserFormModal.tsx",
  usersActions: "src/app/admin/users-roles/actions.ts",
} as const;

for (const [id, sourceFile] of Object.entries(paths)) {
  check(`${id} canonical source exists`, existsSync(join(ROOT, sourceFile)));
}

const registryEntities = extractRegistryEntities(read(paths.registry));
const manifestEntries = ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities;
const manifestEntities = manifestEntries.map((entry) => entry.entity);
const manifestEntitySet = new Set<string>(manifestEntities);
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
  "Admin Interaction System publishes a fail-closed adoption state",
  ADMIN_INTERACTION_SYSTEM.globalClosed ===
    ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed &&
    closureStateIsConsistent(
      ADMIN_INTERACTION_SYSTEM.globalClosed,
      ADMIN_INTERACTION_SYSTEM.globalClosureBlockers,
    ),
);

check(
  "Entity List registry and manifest contain the same generic Data Runtime adopters",
  sameValueSet(registryEntities, declaredDataRegistryEntities) &&
    new Set(declaredDataRegistryEntities).size ===
      declaredDataRegistryEntities.length,
);
check(
  "Row Actions adoption ledger covers only generic collections with row commands",
  sameValueSet(manifestEntities, expectedRowActionEntities) &&
    manifestEntities.every((entity) =>
      new Set<string>(registryEntities).has(entity),
    ),
);
check(
  "Row Actions adoption ledger entity IDs are unique",
  new Set(manifestEntities).size === manifestEntities.length,
);
check(
  "generic Row Actions adoption is globally closed after authenticated Browser QA",
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosed === true &&
    ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosureBlockers.length === 0,
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
check(
  "More remains a menu trigger while pending stays scoped to its target command",
  rendererSource.includes("const menuItems = resolveMenuItems(capability)") &&
    !rendererSource.includes("const morePending") &&
    !/action="more"[\s\S]{0,500}pending=\{/u.test(rendererSource),
);

for (const entry of manifestEntries) {
  check(
    `${entry.entity} declares its consumer boundary in its governed source inventory`,
    entry.sourceFiles.some(
      (sourceFile) => sourceFile === entry.consumerSourceFile,
    ),
  );
  check(
    `${entry.entity} relevant sources all exist`,
    entry.sourceFiles.length >= (entry.auditedActions.length > 0 ? 3 : 1) &&
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
      entry.owners.data === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.data &&
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
  const sharedConfirmationDeclaration =
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']shared["']/.test(
      consumer,
    );
  const delegatedConfirmationDeclaration =
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']delegated["'][\s\S]{0,240}?owner\s*:\s*["']confirmation_runtime["']/.test(
      consumer,
    );
  if (supportedMutations.length > 0) {
    const retainsServerAuditIntegration =
      relevantSource.includes("recordCmsAdminAudit") ||
      relevantSource.includes("recordAdminAuditEvent");
    check(
      `${entry.entity} retains server-side Audit integration in its domain sources`,
      retainsServerAuditIntegration,
    );
    check(
      `${entry.entity} keeps action-targeted pending with its declared Data owner`,
      relevantSource.includes("useAdminEntityInstantMutation") &&
        relevantSource.includes("instant.getRowInteraction") &&
        consumer.includes("interaction.pendingAction") &&
        !consumer.includes("interaction.isBlocked"),
    );
  }
  if (supportedDangerousActions.length > 0) {
    check(
      `${entry.entity} uses the shared Confirmation owner and no native confirm`,
      (sharedConfirmationDeclaration || delegatedConfirmationDeclaration) &&
        !relevantSource.includes("window.confirm"),
    );
  }
  if (entry.actions.delete === "adopted") {
    check(
      `${entry.entity} rejects failed shared-confirmation commands after publishing feedback`,
      consumer.includes("if (!result.ok) throw") || consumer.includes("throw "),
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
  "existing Data Runtime owns optimism, row-scoped duplicate-click protection, safe sequencing, rollback, and targeted invalidation",
  instantMutationSource.includes("request.optimistic(helpers)") &&
    instantMutationSource.includes("pendingRowsRef.current.has(rowId)") &&
    instantMutationSource.includes("queueRef.current.then") &&
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
  "fixed data tracks stay fixed while opt-in presentation spacers can fill the remaining viewport width",
  entityListTableSource.includes("const flexibleColumnKey =") &&
    entityListTableSource.includes("const explicitFlexibleColumnKey =") &&
    entityListTableSource.includes("implicitFlexibleColumn?: boolean") &&
    entityListTableSource.includes("implicitFlexibleColumn = true") &&
    entityListTableSource.includes("explicitFlexibleColumnKey ??") &&
    entityListTableSource.includes("(implicitFlexibleColumn") &&
    entityListTableSource.includes("!column.primary") &&
    entityListTableSource.includes(": undefined);") &&
    entityListTableSource.includes("function getColumnBaseWidth") &&
    entityListTableSource.includes("const tableMinWidth =") &&
    entityListTableSource.includes('className="w-full table-fixed') &&
    entityListTableSource.includes("column.key === flexibleColumnKey") &&
    entityListTableSource.includes("fillAvailableWidth?: boolean") &&
    entityListTableSource.includes("fillAvailableWidth = false") &&
    entityListTableSource.includes(
      "const showFillSpacer = fillAvailableWidth && flexibleColumnKey === undefined",
    ) &&
    entityListTableSource.includes("data-admin-table-fill-spacer") &&
    entityListTableSource.includes(
      "flexibleColumnKey === undefined && !showFillSpacer",
    ) &&
    !entityListTableSource.includes("w-max min-w-full table-fixed"),
);
check(
  "shared grid cells own equal 6px logical inline padding",
  dataGridSource.includes('actionCellInlinePadding: "px-1.5"') &&
    dataGridSource.includes('cellInlinePadding: "px-1.5"') &&
    dataGridSource.includes(
      "cellInlinePaddingPx: ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.cellInlinePaddingPx",
    ) &&
    dataGridSource.includes("ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES") &&
    dataGridSource.includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES"),
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
    pagesSource.includes('sticky: "end-adjacent"') &&
    pagesSource.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH") &&
    entityListTableSource.includes('column.sticky === "end-adjacent"') &&
    entityListTableSource.includes("insetInlineEnd: actionsColumnWidth") &&
    entityListTableSource.includes(
      'data-admin-grid-sticky="inline-end-adjacent"',
    ) &&
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
  read(paths.activityLog),
  read(paths.topicsWithoutImage),
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
  "shared list parents attach Toolbar to Grid while preserving outer 28px and table-footer 16px cadence",
  entityListSurfaceSource.includes("AdminEntityListPrimarySection") &&
    entityListSurfaceSource.includes('SURFACE_LAYOUT_CLASSES = "flex flex-col gap-7"') &&
    entityListSurfaceSource.includes("AdminEntityListTableRegion") &&
    entityListSurfaceSource.includes(
      'TABLE_REGION_LAYOUT_CLASSES = "flex flex-col gap-4"',
    ) &&
    entityListSurfaceSource.includes(
      'data-admin-entity-list-table-region=""',
    ) &&
    !entityListSurfaceSource.includes("mt-3") &&
    entityListSurfaceSource.includes("AdminEntityListPageLayout") &&
    entityListSurfaceSource.includes("gap-7") &&
    entityListSource.includes("AdminEntityListPrimarySection") &&
    entityListSource.includes('toolbar ? "gap-0" : "gap-7"') &&
    entityListSource.includes("<AdminEntityListFilters") &&
    entityListSource.includes('toolbar ? "!rounded-t-none !border-t-0" : undefined') &&
    !entityListSource.includes("primary-section]:mt-") &&
    !read(paths.pagination).includes('className={`mt-4') &&
    read(paths.pagination).includes('data-admin-table-pagination=""') &&
    read(paths.pageExperience).includes("flex flex-col gap-7") &&
    listConsumerSources.every(
      (source) =>
        source.includes("AdminEntityListTableRegion") &&
        /<AdminEntityListTableRegion\b[\s\S]*?<AdminTablePagination\b[\s\S]*?<\/AdminEntityListTableRegion>/.test(
          source,
        ),
    ),
);

check(
  "More icon is vertical at the shared icon owner",
  dataGridSource.includes('<circle cx="12" cy="5" r="1.7" />') &&
    dataGridSource.includes('<circle cx="12" cy="12" r="1.7" />') &&
    dataGridSource.includes('<circle cx="12" cy="19" r="1.7" />') &&
    !dataGridSource.includes('<circle cx="5" cy="12"') &&
    !dataGridSource.includes('<circle cx="19" cy="12"'),
);
check(
  "Pages uses shared page cadence, columns persistence, and Entity List",
  pagesSource.includes("<AdminEntityListPageLayout") &&
    pagesSource.includes("<AdminEntityListTableRegion") &&
    pagesSource.includes("enableColumnManagement") &&
    pagesSource.includes("savePagesTablePreferences") &&
    read(paths.pagesConfig).includes("PAGES_PREFERENCE_COLUMN_KEYS") &&
    read(paths.pagesPreferences).includes("saveAdminColumnPreferences") &&
    !pagesSource.includes("ADMIN_LIST_PAGE.wrapper"),
);

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
    const relative = relativeSourceFile(sourceFile);
    const isTopLevelCardCatalog =
      relative.startsWith("src/app/admin/") &&
      relative.endsWith("/page.tsx") &&
      /<AdminCard\b/.test(source) &&
      /\.map\s*\(/.test(source);
    const isMappedCommandQueue =
      relative.startsWith("src/app/admin/") &&
      /<article\b/.test(source) &&
      /\ballowedActions\.map\s*\(/.test(source);
    return (
      /<AdminEntityList(?:\s|<)|<AdminDataGrid(?:\s|>)|<table(?:\s|>)/.test(
        source,
      ) ||
      isTopLevelCardCatalog ||
      isMappedCommandQueue
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
  "Collection inventory owns only concrete collection/list workflows",
  !Object.hasOwn(ADMIN_COLLECTION_SURFACE_ADOPTION, "outOfScopePages") &&
    collectionSurfaces.every(
      (surface) =>
        surface.routes.length > 0 &&
        surface.pageSourceFiles.length > 0 &&
        "workflowClassification" in surface,
    ),
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
  "every Collection entry declares the requested ownership and adoption axes",
  collectionSurfaces.every(
    (surface) =>
      surface.sourceOwner.trim().length > 0 &&
      (surface.workflowClassification === "auth_out_of_scope"
        ? surface.headerOwner === "not_applicable" &&
          surface.headerState === "auth_out_of_scope"
        : surface.headerOwner === "AdminPageContextHeader" &&
          surface.headerState === "adopted") &&
      ["adopted", "auth_out_of_scope"].includes(
        surface.pageChromeAdoption,
      ) &&
      ["adopted", "not_applicable"].includes(
        surface.collectionAdoption,
      ) &&
      "rowActionsState" in surface &&
      "paginationState" in surface &&
      "paginationOwner" in surface &&
      "gridOwner" in surface &&
      "feedbackOwner" in surface &&
      "confirmationOwner" in surface &&
      "reorderOwner" in surface &&
      "queryMode" in surface &&
      Array.isArray(surface.genuineExceptions) &&
      Array.isArray(surface.requiredAdoption) &&
      (surface.exceptionRationale === null ||
        surface.exceptionRationale.trim().length > 0),
  ),
);
check(
  "surface workflow classifications use only the approved six-value contract",
  collectionSurfaces.every((surface) =>
    [
      "full_collection_adoption",
      "partial_collection_adoption",
      "specialized_data_owner_shared_collection_presentation",
      "page_system_only",
      "fixed_structure_not_paginated",
      "auth_out_of_scope",
    ].includes(surface.workflowClassification),
  ) &&
    !read(paths.manifest).includes("specialized_exception"),
);
check(
  "Collection classifications resolve to a concrete shared grid owner",
  collectionSurfaces.every((surface) => {
    if (
      surface.workflowClassification === "full_collection_adoption" ||
      surface.workflowClassification === "partial_collection_adoption"
    ) {
      return (
        surface.collectionAdoption === "adopted" &&
        surface.gridOwner === "AdminEntityList"
      );
    }
    if (
      surface.workflowClassification ===
      "specialized_data_owner_shared_collection_presentation"
    ) {
      return (
        surface.collectionAdoption === "adopted" &&
        ["AdminDataGrid", "MediaCatalog"].includes(surface.gridOwner)
      );
    }
    return surface.collectionAdoption === "not_applicable";
  }),
);
check(
  "every generic list primitive, top-level card catalog, and mapped command queue is classified exactly once",
  scannedCollectionPresentationSources.every(
    (sourceFile) => presentationSourceCounts.get(sourceFile) === 1,
  ),
);
check(
  "generic inventory and Data Runtime registry cover the same consumers",
  sameValueSet(
    collectionSurfaces
      .filter((surface) => surface.generic)
      .flatMap((surface) => surface.dataRegistryEntities),
    registryEntities,
  ),
);
check(
  "generic headers render their declared uppercase Engine Label and no fourth context line remains",
  collectionSurfaces
    .filter((surface) => surface.generic)
    .every((surface) => {
      const source = [...surface.pageSourceFiles, ...surface.presentationSourceFiles]
        .map(read)
        .join("\n");
      return source.includes(`eyebrow="${surface.engineLabel}"`);
    }) &&
    !collectTsxFiles(join(ROOT, "src")).some((sourceFile) =>
      readFileSync(sourceFile, "utf8").includes("contextLine"),
    ) &&
    !read(paths.pageHeader).includes("contextLine") &&
    read(paths.shell).includes(
      'className="flex min-w-0 flex-1 flex-col gap-7 px-4 py-4 sm:px-6 lg:px-7"',
    ) &&
    !read(paths.shell).includes("admin-premium-card mb-5"),
);

const fullAdoptionSurfaces = collectionSurfaces.filter(
  (surface) => surface.workflowClassification === "full_collection_adoption",
);
const partialAdoptionSurfaces = collectionSurfaces.filter(
  (surface) => surface.workflowClassification === "partial_collection_adoption",
);
const fullAdoptionClaims: readonly AdminCollectionFullAdoptionClaim[] =
  ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS;

function hasExactFullAdoptionClaimCoverage(
  surfaces: readonly AdminCollectionSurfaceInventoryEntry[],
  claims: readonly AdminCollectionFullAdoptionClaim[],
) {
  const surfaceIds = surfaces.map((surface) => surface.id);
  const claimIds = claims.map((claim) => claim.surfaceId);
  return (
    sameValueSet(surfaceIds, claimIds) &&
    new Set(claimIds).size === claimIds.length
  );
}

function collectFullAdoptionContractFailures(
  surface: AdminCollectionSurfaceInventoryEntry,
  claim: AdminCollectionFullAdoptionClaim,
  options: {
    source?: string;
    registryEntities?: readonly string[];
  } = {},
) {
  const failures: string[] = [];
  const source =
    options.source ??
    [...surface.pageSourceFiles, ...surface.presentationSourceFiles]
      .map(read)
      .join("\n");
  const registeredEntities = options.registryEntities ?? registryEntities;
  const contractIds = Object.keys(claim.contracts);

  if (
    !sameValueSet(
      contractIds,
      ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS,
    )
  ) {
    failures.push("manifest_contract_axes");
  }

  for (const requiredContract of [
    "collection",
    "table",
    "toolbar",
    "header",
    "columns",
    "runtime",
    "data_registry",
  ] as const) {
    if (claim.contracts[requiredContract] !== "adopted") {
      failures.push(requiredContract);
    }
  }

  if (
    surface.collectionAdoption !== "adopted" ||
    !source.includes("AdminEntityListSurface") ||
    !source.includes("AdminEntityListTableRegion")
  ) {
    failures.push("collection");
  }

  if (
    surface.gridOwner !== "AdminEntityList" ||
    !/<AdminEntityList(?:\s|<)/u.test(source)
  ) {
    failures.push("table");
  }

  if (!surface.filtersOrToolbar || !source.includes("toolbar=")) {
    failures.push("toolbar");
  }

  if (
    surface.pageChromeAdoption !== "adopted" ||
    surface.headerOwner !== "AdminPageContextHeader" ||
    surface.headerState !== "adopted" ||
    typeof surface.engineLabel !== "string" ||
    (!source.includes("AdminPageContextHeader") &&
      !source.includes("AdminPageHeader")) ||
    !source.includes(`eyebrow="${surface.engineLabel}"`)
  ) {
    failures.push("header");
  }

  if (
    surface.columnVisibility !== "shared_optional_columns" ||
    !source.includes("columns=") ||
    !source.includes("enableColumnManagement") ||
    !source.includes("onPersistColumns=")
  ) {
    failures.push("columns");
  }

  if (claim.contracts.sort === "adopted") {
    if (!source.includes("sortMode=") || source.includes("sort={null}")) {
      failures.push("sort");
    }
  } else if (
    claim.contracts.sort !== "not_required" ||
    !source.includes("sort={null}") ||
    source.includes("sortable: true")
  ) {
    failures.push("sort");
  }

  if (claim.contracts.row_actions === "adopted") {
    if (
      surface.rowActionsState !== "adopted" ||
      surface.rowActionsOwner !== "shared_admin_row_actions" ||
      !surface.dataRegistryEntities.every((entity) =>
        manifestEntitySet.has(entity),
      )
    ) {
      failures.push("row_actions");
    }
  } else if (
    claim.contracts.row_actions !== "not_required" ||
    surface.rowActionsState !== "read_only_no_row_commands" ||
    surface.rowActionsOwner !== "not_applicable" ||
    surface.dataRegistryEntities.some((entity) =>
      manifestEntitySet.has(entity),
    )
  ) {
    failures.push("row_actions");
  }

  if (claim.contracts.bulk === "adopted") {
    if (
      !source.includes("bulkOptions=") ||
      !source.includes("onBulkExecute=") ||
      !source.includes("getBulkConfirmation=") ||
      source.includes("enableSelection={false}")
    ) {
      failures.push("bulk");
    }
  } else if (
    claim.contracts.bulk !== "not_required" ||
    !source.includes("enableSelection={false}") ||
    source.includes("bulkOptions=") ||
    source.includes("onBulkExecute=") ||
    source.includes("getBulkConfirmation=")
  ) {
    failures.push("bulk");
  }

  if (
    surface.queryMode !== "server-page" ||
    !source.includes("useAdminEntityListController") ||
    surface.paginationState !== "adopted" ||
    surface.paginationOwner !== "AdminTablePagination"
  ) {
    failures.push("runtime");
  }

  if (
    surface.dataRegistryEntities.length === 0 ||
    new Set(surface.dataRegistryEntities).size !==
      surface.dataRegistryEntities.length ||
    !surface.dataRegistryEntities.every((entity) =>
      registeredEntities.includes(entity),
    )
  ) {
    failures.push("data_registry");
  }

  if (
    surface.requiredAdoption.length > 0 ||
    surface.exceptionRationale !== null
  ) {
    failures.push("unresolved_adoption");
  }

  return [...new Set(failures)];
}

check(
  "Full Adoption classifications and executable claims have exact one-to-one coverage",
  hasExactFullAdoptionClaimCoverage(fullAdoptionSurfaces, fullAdoptionClaims) &&
    fullAdoptionClaims.every((claim) =>
      fullAdoptionSurfaces.some((surface) => surface.id === claim.surfaceId),
    ),
);

const fullAdoptionContractFailures = fullAdoptionClaims.flatMap((claim) => {
  const surface = fullAdoptionSurfaces.find(
    (candidate) => candidate.id === claim.surfaceId,
  );
  if (!surface) return [`${claim.surfaceId}:missing_surface`];
  return collectFullAdoptionContractFailures(surface, claim).map(
    (contract) => `${claim.surfaceId}:${contract}`,
  );
});

check(
  "every Full Adoption claim proves Collection, Table, Toolbar, Header, Columns, Sort, Row Actions, Bulk, Runtime, and Data Registry contracts",
  fullAdoptionContractFailures.length === 0,
);
check(
  "partial generic adopters cannot publish a Full Adoption claim",
  partialAdoptionSurfaces.every(
      (surface) =>
        surface.generic &&
        surface.collectionAdoption === "adopted" &&
        surface.requiredAdoption.length > 0 &&
        surface.exceptionRationale !== null &&
        !fullAdoptionClaims.some((claim) => claim.surfaceId === surface.id),
    ) &&
    collectionSurfaces
      .filter((surface) => surface.generic)
      .every((surface) =>
        ["full_collection_adoption", "partial_collection_adoption"].includes(
          surface.workflowClassification,
        ),
      ),
);

const fullAdoptionFailureClaim = fullAdoptionClaims.find(
  (claim) => claim.contracts.bulk === "not_required",
);
const fullAdoptionFailureFixture = fullAdoptionSurfaces.find(
  (surface) => surface.id === fullAdoptionFailureClaim?.surfaceId,
);
assert.ok(fullAdoptionFailureFixture && fullAdoptionFailureClaim);
const fullAdoptionFailureSource = [
  ...fullAdoptionFailureFixture.pageSourceFiles,
  ...fullAdoptionFailureFixture.presentationSourceFiles,
]
  .map(read)
  .join("\n");

check(
  "failure path rejects a Full Adoption claim with missing Toolbar evidence",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    { source: fullAdoptionFailureSource.replaceAll("toolbar=", "toolbarGap=") },
  ).includes("toolbar"),
);
check(
  "failure path rejects a Full Adoption claim with missing Column evidence",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    {
      source: fullAdoptionFailureSource.replaceAll(
        "enableColumnManagement",
        "columnManagementGap",
      ),
    },
  ).includes("columns"),
);
check(
  "failure path rejects a Full Adoption claim with Data Registry drift",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    {
      registryEntities: registryEntities.filter(
        (entity) => entity !== fullAdoptionFailureFixture.dataRegistryEntities[0],
      ),
    },
  ).includes("data_registry"),
);
check(
  "failure path rejects a false shared Bulk contract claim",
  collectFullAdoptionContractFailures(fullAdoptionFailureFixture, {
    ...fullAdoptionFailureClaim,
    contracts: {
      ...fullAdoptionFailureClaim.contracts,
      bulk: "adopted",
    },
  }).includes("bulk"),
);
check(
  "failure path rejects Manifest drift when a Full Adoption claim is missing",
  !hasExactFullAdoptionClaimCoverage(
    fullAdoptionSurfaces,
    fullAdoptionClaims.filter(
      (claim) => claim.surfaceId !== fullAdoptionFailureClaim.surfaceId,
    ),
  ),
);
check(
  "dashboard, card catalog, report, and recovery inventory states match their concrete commands",
  collectionSurfaces.find((surface) => surface.id === "dashboard-recent-content")
    ?.sourceOwner ===
      "src/lib/admin/dashboard/load-admin-dashboard.ts#loadAdminDashboard" &&
    collectionSurfaces.find((surface) => surface.id === "dashboard-recent-content")
      ?.presentationSourceFiles.includes(
        "src/components/admin/dashboard/AdminDashboardView.tsx",
      ) &&
    collectionSurfaces.find((surface) => surface.id === "dashboard-recent-content")
      ?.workflowClassification === "fixed_structure_not_paginated" &&
    collectionSurfaces.find((surface) => surface.id === "dashboard-recent-content")
      ?.rowActionsState === "not_applicable" &&
    collectionSurfaces.find((surface) => surface.id === "blocks-library-hub")
      ?.presentationSourceFiles.includes(
        "src/app/admin/pages-blocks/blocks/page.tsx",
      ) &&
    collectionSurfaces.find(
      (surface) => surface.id === "topics-without-image-report",
    )?.rowActionsState === "adopted" &&
    manifestEntities.includes("topics_without_image") &&
    collectionSurfaces.find((surface) => surface.id === "media-recovery-queue")
      ?.presentationSourceFiles.includes(paths.mediaRecovery) &&
    collectionSurfaces.find((surface) => surface.id === "media-recovery-queue")
      ?.workflowClassification === "page_system_only" &&
    collectionSurfaces.find((surface) => surface.id === "media-recovery-queue")
      ?.rowActionsState === "not_applicable",
);
check(
  "Collection global closure claim matches executable Full Adoption coverage",
  ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed ===
    (partialAdoptionSurfaces.length === 0 &&
      fullAdoptionContractFailures.length === 0) &&
    closureStateIsConsistent(
      ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed,
      ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosureBlockers,
    ) &&
    adoptionGapStateIsConsistent(
      ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed,
      ADMIN_COLLECTION_SURFACE_ADOPTION.genericAdoptionGaps,
      partialAdoptionSurfaces.length,
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
    projectsColumnsSource.includes("visibility:") &&
    projectsColumnsSource.includes("onVisibility") &&
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
  "specialized collection presentation and fixed surfaces declare pagination truthfully",
  collectionSurfaces.find((surface) => surface.id === "media-library")
    ?.workflowClassification ===
      "specialized_data_owner_shared_collection_presentation" &&
    collectionSurfaces.find((surface) => surface.id === "media-library")
      ?.paginationState === "adopted" &&
    collectionSurfaces.find((surface) => surface.id === "media-library")
      ?.paginationOwner === "AdminTablePagination" &&
    collectionSurfaces.find((surface) => surface.id === "media-library")
      ?.queryMode === "specialized" &&
    collectionSurfaces.find((surface) => surface.id === "projects-hub")
      ?.queryMode === "small-fixed" &&
    collectionSurfaces.find((surface) => surface.id === "dashboard-recent-content")
      ?.paginationState === "not_required" &&
    collectionSurfaces.find(
      (surface) => surface.id === "topics-without-image-report",
    )?.paginationOwner === "AdminTablePagination",
);
check(
  "nested eligible collections are separate from their specialized page shells",
  [
    "page-composition-shell",
    "page-block-assignments",
    "menu-editor-shell",
    "menu-items",
    "footer-builder-shell",
    "footer-fixed-slots",
    "footer-manual-links",
    "block-template-libraries",
    "block-template-editors",
  ].every((surfaceId) =>
    collectionSurfaces.some((surface) => surface.id === surfaceId),
  ) &&
    ["page-block-assignments", "menu-items", "footer-manual-links"].every(
      (surfaceId) => {
        const surface = collectionSurfaces.find(
          (candidate) => candidate.id === surfaceId,
        );
        return (
          surface?.collectionAdoption === "adopted" &&
          surface.rowActionsOwner === "shared_admin_row_actions" &&
          surface.paginationOwner === "AdminTablePagination"
        );
      },
    ),
);
check(
  "persisted reorder surfaces delegate to their atomic domain contracts",
  ["page-block-assignments", "menu-items"].every((surfaceId) => {
    const surface = collectionSurfaces.find(
      (candidate) => candidate.id === surfaceId,
    );
    return (
      surface?.reorderOwner === "domain_owned_atomic_reorder" &&
      surface.requiredAdoption.length === 0 &&
      surface.genuineExceptions.length === 0
    );
  }) &&
    collectionSurfaces.find((surface) => surface.id === "footer-manual-links")
      ?.reorderOwner === "domain_owned_atomic_reorder",
);
const pageAssignmentsSource = read(paths.pageAssignments);
const pageAssignmentsGridSource = read(paths.pageAssignmentsGrid);
const menuItemsSource = read(paths.menuItems);
const pageReorderPath = join(
  ROOT,
  "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
);
const menuReorderPath = join(
  ROOT,
  "src/app/admin/pages-blocks/menus/menu-actions/reorder.ts",
);
const pageReorderSource = readFileSync(pageReorderPath, "utf8");
const menuReorderSource = readFileSync(menuReorderPath, "utf8");
check(
  "Page and Menu reorder expose only their atomic aggregate mutation paths",
  !existsSync(
    join(
      ROOT,
      "src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-reorder.ts",
    ),
  ) &&
    existsSync(
      join(
        ROOT,
        "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
      ),
    ) &&
    existsSync(
      join(ROOT, "src/app/admin/pages-blocks/menus/menu-actions/reorder.ts"),
    ) &&
    pageReorderSource.includes('mutatePageComposition(pageId, "reorder"') &&
    menuReorderSource.includes('mutateMenuTree(menuId, "reorder"') &&
    [pageReorderSource, menuReorderSource].every(
      (source) =>
        !source.includes("getSupabaseAdmin") &&
        !source.includes(".from(") &&
        !source.includes("Promise.all"),
    ) &&
    pageAssignmentsSource.includes("reorderPageComposition(") &&
    menuItemsSource.includes("reorderMenuItems(") &&
    !menuItemsSource.includes("moveMenuItemSortOrder") &&
    !menuItemsSource.includes("requestSubmit") &&
    !read(paths.pageActions).includes("movePageBlockAssignment") &&
    !read(paths.pageActionIndex).includes("movePageBlockAssignment") &&
    !read(paths.menuActions).includes("moveMenuItemSortOrder") &&
    !read(paths.menuActionIndex).includes("moveMenuItemSortOrder") &&
    read(paths.pageActions).includes("reorderPageComposition") &&
    read(paths.pageActionIndex).includes("reorderPageComposition") &&
    read(paths.menuActions).includes("reorderMenuItems") &&
    read(paths.menuActionIndex).includes("reorderMenuItems"),
);
check(
  "Page Assignments adopts the shared bounded-client URL/history owner",
  collectionSurfaces.find((surface) => surface.id === "page-block-assignments")
    ?.queryMode === "bounded-client" &&
    pageAssignmentsSource.includes("useAdminBoundedClientPagination") &&
    pageAssignmentsSource.includes('mode: "bounded-client"') &&
    pageAssignmentsSource.includes("queryContract") &&
    pageAssignmentsSource.includes(
      "onQueryPatch={pagination.applyQueryPatch}",
    ) &&
    pageAssignmentsSource.includes("pagination.resetPage()") &&
    !pageAssignmentsGridSource.includes("summary={`${totalCount}") &&
    pageAssignmentsSource.includes("totalCount={pagination.totalCount}") &&
    !pageAssignmentsSource.includes("useSearchParams") &&
    !pageAssignmentsSource.includes("applyAdminEntityUrlPatch") &&
    !pageAssignmentsSource.includes("window.history") &&
    !pageAssignmentsSource.includes("const [currentPage") &&
    !pageAssignmentsSource.includes("Math.ceil(table.rows.length") &&
    !pageAssignmentsSource.includes("table.rows.slice(") &&
    read(paths.boundedPagination).includes("useSearchParams") &&
    read(paths.boundedPagination).includes("queryContract.matchesRow") &&
    read(paths.boundedPagination).includes("const applyQueryPatch = useCallback") &&
    read(paths.boundedPagination).includes('behavior === "replace" ? "replaceState" : "pushState"') &&
    read(paths.boundedPagination).includes("previousDatasetKey"),
);

const syntheticAssignmentRows = Array.from(
  { length: 23 },
  (_, index) => `assignment-${index + 1}`,
);
const initialAssignmentParams = new URLSearchParams(
  "tab=modules&seo_notice=saved&page=2",
);
const initialAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  initialAssignmentParams.get("page"),
  initialAssignmentParams.get("limit"),
);
const nextAssignmentParams = writeAdminBoundedClientPaginationParams(
  initialAssignmentParams,
  { page: 3, pageSize: initialAssignmentPagination.pageSize },
);
const previousAssignmentParams = writeAdminBoundedClientPaginationParams(
  nextAssignmentParams,
  { page: 2, pageSize: initialAssignmentPagination.pageSize },
);
const resizedAssignmentParams = writeAdminBoundedClientPaginationParams(
  previousAssignmentParams,
  { page: 1, pageSize: 20 },
);
const assignmentHistory = [
  initialAssignmentParams.toString(),
  nextAssignmentParams.toString(),
  previousAssignmentParams.toString(),
  resizedAssignmentParams.toString(),
];
const backAssignmentParams = new URLSearchParams(assignmentHistory.at(-2));
const forwardAssignmentParams = new URLSearchParams(assignmentHistory.at(-1));
const nextAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  nextAssignmentParams.get("page"),
  nextAssignmentParams.get("limit"),
);
const previousAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  previousAssignmentParams.get("page"),
  previousAssignmentParams.get("limit"),
);
const resizedAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  resizedAssignmentParams.get("page"),
  resizedAssignmentParams.get("limit"),
);
const backAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  backAssignmentParams.get("page"),
  backAssignmentParams.get("limit"),
);
const forwardAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  forwardAssignmentParams.get("page"),
  forwardAssignmentParams.get("limit"),
);
check(
  "bounded-client pagination changes next/previous/size rows and restores Back/Forward state",
  initialAssignmentPagination.page === 2 &&
    initialAssignmentPagination.pageSize === 10 &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        initialAssignmentPagination.page,
        initialAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(10, 20),
    ) &&
    nextAssignmentParams.get("page") === "3" &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        nextAssignmentPagination.page,
        nextAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(20, 23),
    ) &&
    previousAssignmentParams.get("page") === "2" &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        previousAssignmentPagination.page,
        previousAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(10, 20),
    ) &&
    resizedAssignmentParams.get("page") === null &&
    resizedAssignmentParams.get("limit") === "20" &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        resizedAssignmentPagination.page,
        resizedAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(0, 20),
    ) &&
    backAssignmentPagination.page === 2 &&
    backAssignmentPagination.pageSize === 10 &&
    forwardAssignmentPagination.page === 1 &&
    forwardAssignmentPagination.pageSize === 20 &&
    resizedAssignmentParams.get("tab") === "modules" &&
    resizedAssignmentParams.get("seo_notice") === "saved",
);
check(
  "shared Pagination delegates range and URL math without owning Busy state",
  read(paths.pagination).includes("computePageRange") &&
    read(paths.pagination).includes("buildAdminEntityListHref") &&
    read(paths.pagination).includes('data-admin-table-pagination-busy="false"') &&
    !read(paths.pagination).includes("pending?: boolean") &&
    !read(paths.pagination).includes("disabled={pending") &&
    !read(paths.pagination).includes("aria-busy={pending}"),
);
check(
  "AdminDataGrid owns one compact full-height divided cell surface for every Block Library family",
  read(paths.dataGrid).includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES") &&
    read(paths.dataGrid).includes("[&>*]:self-stretch") &&
    read(paths.dataGrid).includes("[&>*]:px-1.5") &&
    read(paths.dataGrid).includes("[&>*+*]:border-s") &&
    read(paths.dataGrid).includes("columnGap: 0") &&
    read(paths.renderer).includes("sticky = false") &&
    [
      paths.blockModuleManager,
      paths.contentBlockManager,
      paths.heroBlockManager,
      paths.blockTemplateSummary,
    ].every((sourceFile) =>
      read(sourceFile).includes("ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact"),
    ),
);
const redirectsClientSource = read(paths.redirects);
const redirectsActionsSource = read(paths.redirectsActions);
const activitySource = read(paths.activityLog);
const reportSource = read(paths.topicsWithoutImage);
check(
  "new server-page adopters normalize out-of-range pages at their thin adapters",
  [
    paths.redirectsAdapter,
    paths.activityLoader,
    paths.reportAdapter,
    paths.projectsAdapter,
  ].every((sourceFile) =>
    read(sourceFile).includes("loadNormalizedAdminEntityListPage"),
  ) &&
    read(paths.dataAdapter).includes("for (let attempt = 0;") &&
    read(paths.dataAdapter).includes("page <= totalPages") &&
    read(paths.dataAdapter).includes(
      "throw new AdminEntityListPageNormalizationError",
    ),
);
check(
  "legacy collection query, URL, and pager owners are removed",
  !redirectsActionsSource.includes("listRedirects(") &&
    !redirectsActionsSource.includes("redirectWithMessage") &&
    !redirectsActionsSource.includes('from "next/navigation"') &&
    !redirectsClientSource.includes("setRows(") &&
    !read(paths.redirectsFilters).includes("useRouter") &&
    !activitySource.includes("useRouter") &&
    !activitySource.includes("listAuditLogsAction") &&
    !existsSync(join(ROOT, "src/app/admin/activity-log/actions.ts")) &&
    !reportSource.includes("pageHref") &&
    !reportSource.includes('method="get"'),
);
check(
  "new Data Runtime adopters retain visible failure paths without false empty states",
  redirectsClientSource.includes("controller.error") &&
    activitySource.includes("controller.error") &&
    reportSource.includes("controller.error") &&
    !read("src/app/admin/seo/redirects/page.tsx").includes("catch(() => [])"),
);
check(
  "Data Runtime restores visible Back and Forward state for draft-filter adopters",
  read(paths.dataController).includes('addEventListener("popstate"') &&
    activitySource.includes("controller.query") &&
    reportSource.includes("controller.query") &&
    redirectsClientSource.includes("createRedirectsCollectionToolbar") &&
    redirectsClientSource.includes("search: controller.query.search") &&
    redirectsClientSource.includes("status: controller.query.filters.status") &&
    redirectsClientSource.includes(
      "redirectType: controller.query.filters.redirectType",
    ),
);
check(
  "route-locked Project queries reapply their invariant on every transition and Back or Forward restoration",
  read(paths.dataController).includes("constrainQuery?:") &&
    read(paths.dataController).includes(
      "const resolved = applyQueryConstraint(candidate)",
    ) &&
    read(paths.dataController).includes(
      "const restored = applyQueryConstraint(normalized)",
    ) &&
    read(paths.dataController).includes("window.history.replaceState") &&
    read(paths.projectsList).includes("withLockedProjectType") &&
    read(paths.projectsList).includes("constrainQuery,"),
);
check(
  "Activity Log server pagination uses a deterministic id tie-breaker",
  read(paths.activityLoader).includes(
    '.order("created_at", { ascending: filters.sortDirection === "asc" })',
  ) &&
    read(paths.activityLoader).includes(
      '.order("id", { ascending: filters.sortDirection === "asc" })',
    ),
);
check(
  "Redirects delegates filter presentation and query state to shared owners",
  read(paths.redirectsFilters).includes("AdminEntityListFilters") &&
    read(paths.redirectsFilters).includes("onQueryPatch") &&
    !read(paths.redirectsFilters).includes("useRouter"),
);
check(
  "server-page search consumers delegate escaping to their authoritative query owners",
  [
    paths.redirectsAdapter,
    paths.activityLoader,
    paths.reportQuery,
  ].every((sourceFile) =>
    read(sourceFile).includes("buildAdminListSearchOrFilter"),
  ) &&
    read(paths.projectsAdapter).includes("p_search: query.search") &&
    read(paths.projectPublishing).includes("v_search_pattern") &&
    read(paths.projectPublishing).includes("ilike v_search_pattern") &&
    read(paths.adminListSearch).includes('const pattern = `"%${escaped}%"`') &&
    read(paths.adminListSearch).includes("Invalid Admin list search field") &&
    !read(paths.redirectsAdapter).includes("sanitizeRedirectSearch") &&
    !read(paths.projectsAdapter).includes("sanitizeProjectSearch"),
);
check(
  "topics-without-image adapter delegates canonical sort direction to the domain read",
  read(paths.reportAdapter).includes("sortDirection: query.sort.direction") &&
    read(paths.reportQuery).includes(
      'const ascending = input.sortDirection === "asc"',
    ) &&
    read(paths.reportQuery).includes('.order("updated_at", { ascending,'),
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
  "shared confirmation owns live invocation pending independently of row snapshots",
  confirmationSource.includes("const busy = pending || invoking") &&
    confirmationSource.includes("invokingRef.current = true") &&
    confirmationSource.includes("await confirmRef.current()") &&
    confirmationSource.includes("disabled={busy || confirmDisabled}") &&
    rendererSource.includes("await activeConfirmation.onConfirm()") &&
    floatingLayerSource.includes("await activeConfirmation.onConfirm()"),
);
const usersRolesSource = read(paths.usersRoles);
const usersFormSource = read(paths.usersForm);
check(
  "Users collection and edit status changes adopt shared confirmation with pending, retry, and focus return",
  usersRolesSource.includes("<AdminEntityList<") &&
    usersRolesSource.includes("await setAdminUserActiveAction(row.id, nextActive)") &&
    usersRolesSource.includes("await deleteAdminUserAction(row.id)") &&
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']shared["']/.test(
      usersRolesSource,
    ) &&
    usersFormSource.includes("<AdminFormRuntime<AdminUserEntityListRow>") &&
    usersFormSource.includes("<AdminConfirmDialog") &&
    usersFormSource.includes("pending={pending}") &&
    usersFormSource.includes("data-admin-users-edit-save") &&
    usersFormSource.includes("resolveReturnFocus={() =>") &&
    usersFormSource.includes("getForm(formId)?.requestSubmit()") &&
    !usersRolesSource.includes("window.confirm") &&
    !usersFormSource.includes("window.confirm") &&
    !usersRolesSource.includes("/api/"),
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
  "No Row Actions consumer declares a specialized parallel adapter",
  manifestEntries.flatMap((entry) =>
    Object.entries(entry.actions)
      .filter(([, state]) => String(state) === "specialized_adapter")
      .map(([action]) => `${entry.entity}:${action}`),
  ).length === 0,
);

const instantInteraction =
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.instantMutationInteraction;
const directInstantConsumers = instantInteraction.directConsumers;
const domainOwnedRowLifecycleConsumers =
  instantInteraction.domainOwnedRowLifecycleConsumers;
const rowAScope = resolveAdminInstantMutationInteraction({
  rowId: 11,
  rowPendingActions: [{ rowId: 11, action: "visibility" }],
  bulkPendingAction: null,
});
const rowBScope = resolveAdminInstantMutationInteraction({
  rowId: 12,
  rowPendingActions: [{ rowId: 11, action: "visibility" }],
  bulkPendingAction: null,
});
const bulkScope = resolveAdminInstantMutationInteraction({
  rowId: 12,
  rowPendingActions: [],
  bulkPendingAction: "bulk-delete",
});
check(
  "Instant Mutation scopes pending to the active row while unrelated rows stay interactive",
  rowAScope.row.pendingAction === "visibility" &&
    rowAScope.row.isPending &&
    !rowBScope.row.isPending &&
    rowBScope.bulk.isBlocked,
);
check(
  "Bulk Mutation keeps busy state inside the Bulk interaction contract",
  bulkScope.bulk.isPending &&
    bulkScope.bulk.isBlocked &&
    !bulkScope.row.isPending &&
    bulkScope.row.pendingAction === null,
);
check(
  "same-query post-success reconciliation remains separate from Query pending",
  resolveAdminEntityListInteractionState({
    isPending: false,
    isPlaceholderData: false,
    isFetching: true,
  }).revalidating &&
    !resolveAdminEntityListInteractionState({
      isPending: false,
      isPlaceholderData: false,
      isFetching: true,
    }).queryPending &&
    resolveAdminEntityListInteractionState({
      isPending: false,
      isPlaceholderData: true,
      isFetching: true,
    }).queryPending,
);
check(
  "Instant Mutation inventory is unique, complete, and adopts the scoped owner contract",
  new Set(directInstantConsumers).size === directInstantConsumers.length &&
    directInstantConsumers.length === 15 &&
    directInstantConsumers.every((sourceFile) => {
      const source = read(sourceFile);
      return (
        source.includes("useAdminEntityInstantMutation") ||
        source.includes("useAdminBoundedClientInstantMutation")
      ) &&
        source.includes("getRowInteraction") &&
        !source.includes("pendingRowId") &&
        !source.includes("setPendingRowId");
    }),
);
check(
  "Menu tables keep atomic domain writes while adopting shared Busy, feedback, and fixed-column contracts",
  [
    "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  ].every((sourceFile) => {
    const source = read(sourceFile);
    return (
      source.includes("useAdminBoundedClientInstantMutation") &&
      source.includes("useAdminFeedback") &&
      source.includes("getRowInteraction") &&
      !source.includes("pendingRowId")
    );
  }) &&
    read("src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx").includes(
      "ADMIN_DATA_GRID_COLUMNS.statusCompact",
    ) &&
    !read("src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx").includes(
      "إعادة الترتيب متوقفة",
    ) &&
    read("src/app/admin/pages-blocks/menus/menu-actions/reorder.ts").includes(
      'mutateMenuTree(menuId, "reorder"',
    ),
);
check(
  "Collection controls never bind raw fetching, Query pending, or row mutation pending",
  [
    ...directInstantConsumers,
    ...domainOwnedRowLifecycleConsumers,
    "src/app/admin/activity-log/ActivityLogClient.tsx",
    "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  ].every((sourceFile) => {
    const source = read(sourceFile);
    return (
      !source.includes("controller.isFetching") &&
      !source.includes("pending: controller.queryPending") &&
      !source.includes("pending={controller.queryPending}") &&
      !/AdminTablePagination[\s\S]{0,500}pending=\{pendingRowId !== null\}/u.test(
        source,
      )
    );
  }) &&
    !read("src/lib/admin/entity-list/types.ts").includes("pending?: boolean") &&
    !read("src/components/admin/entity-list/AdminEntityListFilters.tsx").includes(
      "pending={search.pending}",
    ),
);
check(
  "legacy ambiguous mutation and query state contracts are removed",
  !instantMutationSource.includes("rowPending:") &&
    !instantMutationSource.includes("getRowPendingAction") &&
    !/return\s*\{[\s\S]{0,240}\browPendingActions\s*,/u.test(
      instantMutationSource,
    ) &&
    read(paths.dataController).includes("...interactionState") &&
    !/return\s*\{[\s\S]{0,300}\bisFetching:\s*request\.isFetching/u.test(
      read(paths.dataController),
    ) &&
    !/return\s*\{[\s\S]{0,300}\bisPlaceholderData:\s*request\.isPlaceholderData/u.test(
      read(paths.dataController),
    ),
);
check(
  "Admin table state owner no longer exposes a parallel mutation lifecycle",
  !read("src/components/admin/table-engine/useAdminTable.ts").includes(
    "useTransition",
  ) &&
    !read("src/components/admin/table-engine/useAdminTable.ts").includes(
      "runAction",
    ) &&
    !read("src/components/admin/table-engine/useAdminTable.ts").includes(
      "refreshRows",
    ),
);

console.log(`Admin Row Actions capability verification passed (${passed} checks).`);
