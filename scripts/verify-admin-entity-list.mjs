/**
 * Architecture acceptance gates for Admin Entity List System v1.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(label, condition) {
  if (!condition) failures.push(label);
}

function loadPureTypeScriptModule(path, dependencies = {}) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unsupported dependency ${specifier} while loading ${path}`);
    },
  );
  return commonJsModule.exports;
}

const coreFiles = [
  "src/lib/admin/entity-list/types.ts",
  "src/lib/admin/entity-list/column-preferences.ts",
  "src/lib/admin/entity-list/feedback-codes.ts",
  "src/lib/admin/entity-list/empty-state.ts",
  "src/lib/admin/entity-list/pagination.ts",
  "src/lib/admin/entity-list/url-state.ts",
  "src/lib/admin/preferences/admin-column-preferences.ts",
  "src/components/admin/entity-list/AdminEntityList.tsx",
  "src/components/admin/entity-list/AdminEntityListTable.tsx",
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
  "src/components/admin/entity-list/AdminEntityListSurface.tsx",
  "src/components/admin/entity-list/AdminFloatingLayerContext.tsx",
  "src/components/admin/ui/AdminListboxSelect.tsx",
  "src/components/admin/ui/AdminFilterListbox.tsx",
  "src/components/admin/ui/admin-floating-position.ts",
  "src/components/admin/ui/useAdminFloatingMenuPosition.ts",
];
coreFiles.forEach((path) =>
  check(`Missing entity-list core file: ${path}`, existsSync(resolve(ROOT, path))),
);

const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const entityTable = read("src/components/admin/entity-list/AdminEntityListTable.tsx");
const entityFilters = read("src/components/admin/entity-list/AdminEntityListFilters.tsx");
const entitySurface = read("src/components/admin/entity-list/AdminEntityListSurface.tsx");
const prefsCore = read("src/lib/admin/entity-list/column-preferences.ts");
const paginationCore = read("src/lib/admin/entity-list/pagination.ts");
const prefsAdapter = read("src/lib/admin/preferences/admin-column-preferences.ts");
const listbox = read("src/components/admin/ui/AdminListboxSelect.tsx");
const filterListbox = read("src/components/admin/ui/AdminFilterListbox.tsx");
const bulkBar = read("src/components/admin/ui/AdminBulkActionBar.tsx");
const feedbackCodes = read("src/lib/admin/entity-list/feedback-codes.ts");
const feedbackPolicy = read("src/lib/admin/admin-action-feedback.ts");
const noticeFrame = read("src/components/admin/AdminNoticeDismissibleFrame.tsx");
const floatingPosition = read("src/components/admin/ui/admin-floating-position.ts");
const floatingHook = read("src/components/admin/ui/useAdminFloatingMenuPosition.ts");
const columnMenu = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx");
const pagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const activity = read("src/components/admin/ui/AdminActivityPopover.tsx");
const emptyStateCore = read("src/lib/admin/entity-list/empty-state.ts");
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");

const topicsList = read("src/components/admin/content/UnifiedContentList.tsx");
const topicsFilters = read("src/components/admin/content/UnifiedContentFilters.tsx");
const topicsPage = read("src/app/admin/content/topics/page.tsx");
const categoriesPage = read("src/app/admin/content/categories/page.tsx");
const categoriesListOwner = read("src/lib/admin/content/load-categories-list.ts");
const categoriesClient = read("src/app/admin/content/categories/CategoriesListClient.tsx");
const categoriesColumns = read("src/app/admin/content/categories/categories-columns.tsx");
const categoriesActions = read("src/app/admin/content/categories/CategoryRowActions.tsx");
const seriesClient = read("src/app/admin/content/series/SeriesTableClient.tsx");
const seriesPage = read("src/app/admin/content/series/page.tsx");
const seriesListOwner = read("src/lib/admin/content/load-series-list.ts");
const seriesColumns = read("src/app/admin/content/series/series-columns.tsx");

check(
  "Topics/Categories/Series must consume AdminEntityList",
  topicsList.includes("AdminEntityList") &&
    categoriesClient.includes("AdminEntityList") &&
    seriesClient.includes("AdminEntityList"),
);

check(
  "Consumers must use AdminEntityListSurface + AdminEntityListFilters",
  topicsPage.includes("AdminEntityListSurface") &&
    topicsFilters.includes("AdminEntityListFilters") &&
    categoriesClient.includes("AdminEntityListSurface") &&
    categoriesClient.includes("AdminEntityListFilters") &&
    seriesClient.includes("AdminEntityListSurface") &&
    seriesClient.includes("AdminEntityListFilters") &&
    entitySurface.includes("AdminFloatingLayerProvider") &&
    entityFilters.includes("AdminFilterListbox"),
);

check(
  "Consumers must not rebuild a raw table structure",
  !topicsList.includes("<thead") &&
    !topicsList.includes("<tbody") &&
    !categoriesClient.includes("<thead") &&
    !categoriesClient.includes("<tbody") &&
    !seriesClient.includes("<thead") &&
    !seriesClient.includes("<tbody") &&
    entityTable.includes("<thead") &&
    entityTable.includes("<tbody"),
);

const coreSources = [
  entityList,
  entityTable,
  entityFilters,
  entitySurface,
  prefsCore,
  paginationCore,
  listbox,
  filterListbox,
  feedbackCodes,
  floatingPosition,
  floatingHook,
  emptyStateCore,
  read("src/lib/admin/entity-list/types.ts"),
  read("src/lib/admin/entity-list/url-state.ts"),
];

check(
  "Shared core must not import Topics/Categories/Series/Supabase/Venesia",
  coreSources.every(
    (source) =>
      !source.includes("topics/actions") &&
      !source.includes("UnifiedContent") &&
      !source.includes('from "@supabase') &&
      !source.includes("getSupabaseAdmin") &&
      !source.includes("content-topics") &&
      !source.includes("content-categories") &&
      !source.includes("content-series") &&
      !source.toLowerCase().includes("venesia") &&
      !/\bTopics\b/.test(source) &&
      !/\bCategories\b/.test(source) &&
      !/\bSeries\b/.test(source) &&
      !source.includes("topic_categories") &&
      !source.includes("topic_series"),
  ),
);

check(
  "Filter listbox dedupes allValue options",
  filterListbox.includes("withoutAllValue") &&
    filterListbox.includes("option.value !== allValue"),
);

check(
  "Preferences adapter is project infra and accepts viewKey",
  prefsAdapter.includes("view_key: input.viewKey") &&
    prefsAdapter.includes("allowedColumns") &&
    !prefsAdapter.includes("content-topics") &&
    !prefsAdapter.includes("content-series"),
);

check(
  "No native bulk select / window.confirm on the three consumers",
  !topicsList.includes("<select") &&
    !categoriesClient.includes("<select") &&
    !seriesClient.includes("<select") &&
    !bulkBar.includes("<select") &&
    bulkBar.includes("AdminListboxSelect") &&
    !topicsList.includes("window.confirm") &&
    !categoriesClient.includes("window.confirm") &&
    !seriesClient.includes("window.confirm") &&
    !categoriesPage.includes("window.confirm") &&
    !seriesPage.includes("window.confirm"),
);

check(
  "Floating consumers apply one complete shared style contract",
  [listbox, filterListbox, columnMenu, pagination, activity].every(
    (source) =>
      source.includes("useAdminFloatingMenuPosition") &&
      /style=\{\w+\.style\}/.test(source),
  ) &&
    floatingPosition.includes('position: "fixed"') &&
    floatingPosition.includes('placement === "bottom" ? top : undefined') &&
    floatingPosition.includes('placement === "top" ? bottom : undefined') &&
    floatingPosition.includes("maxHeight"),
);

check(
  "Feedback notices resolve through shared contract",
  feedbackCodes.includes("resolveAdminNoticeFeedback") &&
    topicsPage.includes("resolveAdminNoticeFeedback") &&
    categoriesPage.includes("resolveAdminNoticeFeedback") &&
    seriesPage.includes("resolveAdminNoticeFeedback"),
);

check(
  "Feedback lifecycle distinguishes auto success, manual action errors, and persistent system errors",
  feedbackCodes.includes("getAdminFeedbackPolicy") &&
    feedbackCodes.includes('"transient_action"') &&
    feedbackCodes.includes('"action_validation"') &&
    feedbackPolicy.includes('lifecycle: "auto"') &&
    feedbackPolicy.includes("autoDismissMs: 5_000") &&
    feedbackPolicy.includes('lifecycle: "manual"') &&
    feedbackPolicy.includes('lifecycle: "persistent"') &&
    noticeFrame.includes("window.setTimeout(dismiss, autoDismissMs)") &&
    noticeFrame.includes('aria-label="إغلاق الإشعار"'),
);

check(
  "Feedback renders in one shared slot after filters for every entity consumer",
  entityList.includes("data-admin-entity-feedback-slot") &&
    entityList.indexOf("data-admin-entity-feedback-slot") <
      entityList.lastIndexOf("AdminBulkActionBar") &&
    categoriesClient.includes("initialFeedback={initialFeedback}") &&
    seriesClient.includes("initialFeedback={initialFeedback}") &&
    topicsList.includes("initialFeedback={initialFeedback}") &&
    !categoriesPage.includes("{noticeFeedback ? (") &&
    !seriesPage.includes("{noticeFeedback ? (") &&
    !topicsPage.includes("{noticeFeedback ? ("),
);

check(
  "Shared filters own clear-filter and optimistic pending selection contracts",
  entityFilters.includes("clearableFilterKeys") &&
    entityFilters.includes("data-admin-clear-filters") &&
    entityFilters.includes("pendingFilterValues") &&
    entityFilters.includes("effectiveValues") &&
    entityFilters.includes("startTransition") &&
    !topicsFilters.includes("function resetFilters"),
);

check(
  "Categories no longer expose slug/description columns or expand-all controls",
  !categoriesClient.includes("CategoryTreeControls") &&
    !categoriesPage.includes("CategoryTreeControls") &&
    !categoriesPage.includes("data-category-search") &&
    !categoriesColumns.includes("row.slug") &&
    !categoriesColumns.includes("category.description") &&
    !categoriesColumns.includes('key: "description"') &&
    !categoriesColumns.includes('key: "slug"'),
);

check(
  "Categories enable column management + real pagination + activity",
  categoriesClient.includes("enableColumnManagement") &&
    !categoriesClient.includes("enableColumnManagement={false}") &&
    categoriesClient.includes("resolveClientPagination") &&
    !categoriesClient.includes("pageSizeSelectorMode=\"never\"") &&
    !categoriesClient.includes("totalPages={1}") &&
    categoriesColumns.includes('label: "الموضوعات"') &&
    !categoriesColumns.includes('label: "العدد"') &&
    categoriesActions.includes("AdminActivityPopover") &&
    categoriesListOwner.includes("created_at") &&
    categoriesListOwner.includes("updated_at") &&
    read("src/lib/admin/content/categories-list-config.ts").includes(
      "CATEGORIES_DEFAULT_COLUMN_KEYS",
    ) &&
    read("src/app/admin/content/categories/actions.ts").includes(
      "saveCategoriesTablePreferences",
    ),
);

check(
  "Categories split edit and folder interactions",
  categoriesColumns.includes("data-category-folder-toggle") &&
    categoriesColumns.includes("data-category-folder-static") &&
    categoriesColumns.includes("data-category-edit-trigger") &&
    categoriesColumns.includes("aria-expanded") &&
    categoriesClient.includes("collapsedCategoryIds") &&
    categoriesClient.includes("visibleIds.add(parentId)"),
);

check(
  "Series uses الموضوعات terminology and expanded columns",
  seriesColumns.includes('label: "الموضوعات"') &&
    seriesColumns.includes('key: "id"') &&
    seriesColumns.includes('key: "slug"') &&
    seriesColumns.includes('key: "category"') &&
    seriesColumns.includes('key: "created_at"') &&
    seriesColumns.includes("AdminActivityPopover") &&
    seriesColumns.includes("action=\"preview\"") &&
    seriesColumns.includes("/admin/content/topics?series=") &&
    seriesClient.includes("AdminEntityListFilters") &&
    seriesClient.includes("resolveClientPagination") &&
    seriesListOwner.includes("category_id") &&
    seriesListOwner.includes("created_at") &&
    seriesListOwner.includes("updated_at"),
);

check(
  "Series category adapter includes selected parent descendants",
  read("src/lib/admin/content/category-hierarchy.ts").includes(
    "buildAdminCategoryFilterModel",
  ) &&
    seriesPage.includes("categoryDescendantIdsByValue") &&
    seriesClient.includes("selectedCategoryIds.has(row.category_id)") &&
    !seriesClient.includes('String(row.category_id ?? "") === category'),
);

check(
  "Visibility action uses one explicit current-state contract",
  dataGrid.includes("isCurrentlyHidden?: boolean") &&
    !dataGrid.includes("hidden?: boolean") &&
    ![topicsList, categoriesActions, seriesColumns].some((source) =>
      /\bhidden=\{/.test(source),
    ),
);

check(
  "Series columns default contract",
  read("src/lib/admin/content/series-list-config.ts").includes(
    "SERIES_DEFAULT_COLUMN_KEYS",
  ) && seriesClient.includes("onPersistColumns"),
);

check(
  "Series delete uses AdminConfirmDialog",
  seriesColumns.includes("AdminConfirmDialog"),
);

const prefsModule = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/column-preferences.ts",
);
const sampleColumns = [
  { key: "title", defaultVisible: true, hideable: false },
  { key: "status", defaultVisible: true, hideable: true },
  { key: "id", defaultVisible: false, hideable: true },
  { key: "actions", defaultVisible: true, hideable: false },
];
const sanitized = prefsModule.sanitizeVisibleColumnKeys(sampleColumns, [
  "status",
  "bogus",
]);
check(
  "sanitizeVisibleColumnKeys keeps required columns and drops invalid keys",
  sanitized.includes("title") &&
    sanitized.includes("actions") &&
    sanitized.includes("status") &&
    !sanitized.includes("bogus"),
);

const paginationModule = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/pagination.ts",
);
const pageState = paginationModule.resolveClientPagination(11, 2, 10);
check(
  "resolveClientPagination computes real pages for 11/10",
  pageState.page === 2 &&
    pageState.totalPages === 2 &&
    pageState.rangeStart === 11 &&
    pageState.rangeEnd === 11 &&
    pageState.pageSize === 10,
);
const sliced = paginationModule.slicePageRows(
  Array.from({ length: 11 }, (_, index) => index + 1),
  1,
  10,
);
check(
  "slicePageRows returns current page only",
  sliced.length === 10 && sliced[0] === 1 && sliced[9] === 10,
);

const feedbackPolicyModule = loadPureTypeScriptModule(
  "src/lib/admin/admin-action-feedback.ts",
);
const noticeModule = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/feedback-codes.ts",
  { "../admin-action-feedback": feedbackPolicyModule },
);
const notice = noticeModule.resolveAdminNoticeFeedback(
  { created: { message: "ok" }, error: { message: "bad", variant: "danger" } },
  "created",
);
check(
  "resolveAdminNoticeFeedback maps codes",
  notice?.message === "ok" &&
    notice?.variant === "success" &&
    notice?.dismissible === true &&
    notice?.lifecycle === "auto" &&
    notice?.autoDismissMs === 5_000 &&
    notice?.dismissSearchParams?.includes("notice"),
);

const criticalNotice = noticeModule.resolveAdminNoticeFeedback(
  {
    unavailable: {
      message: "down",
      variant: "danger",
      kind: "critical_system",
    },
  },
  "unavailable",
);
check(
  "Critical system notice remains persistent",
  criticalNotice?.dismissible === false &&
    criticalNotice?.lifecycle === "persistent" &&
    criticalNotice?.dismissSearchParams === undefined,
);

const emptyStateModule = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/empty-state.ts",
);
check(
  "Generic empty-state resolver distinguishes system and filtered copy",
  emptyStateModule.resolveAdminEntityListEmptyState({
    mode: "system",
    systemEmpty: "system",
    filteredEmpty: "filtered",
  }) === "system" &&
    emptyStateModule.resolveAdminEntityListEmptyState({
      mode: "filtered",
      systemEmpty: "system",
      filteredEmpty: "filtered",
    }) === "filtered",
);

const floatingPositionModule = loadPureTypeScriptModule(
  "src/components/admin/ui/admin-floating-position.ts",
);
const topStyle = floatingPositionModule.createAdminFloatingMenuStyle({
  placement: "top",
  top: 100,
  bottom: 40,
  left: 20,
  width: 240,
  maxHeight: 300,
  zIndex: 9999,
});
const bottomStyle = floatingPositionModule.createAdminFloatingMenuStyle({
  placement: "bottom",
  top: 100,
  bottom: 40,
  left: 20,
  width: 240,
  maxHeight: 300,
  zIndex: 9999,
});
check(
  "Floating style never emits conflicting top and bottom",
  topStyle.top === undefined &&
    topStyle.bottom === 40 &&
    bottomStyle.top === 100 &&
    bottomStyle.bottom === undefined &&
    topStyle.maxHeight === 300 &&
    bottomStyle.position === "fixed",
);

const qaConsumers = read("scripts/qa-admin-entity-list-consumers.mjs");
check(
  "Consumer QA uses an unconditional isolated 11-row fixture",
  qaConsumers.includes("Fixture creates exactly 11 flattened category rows") &&
    qaConsumers.includes("Categories fixture page 1 has exactly 10 rows") &&
    qaConsumers.includes("Categories fixture page 2 has exactly 1 row") &&
    !qaConsumers.includes("if (totalCount > 10)") &&
    qaConsumers.includes("cleanupProof?.ok === true"),
);

const types = read("src/lib/admin/entity-list/types.ts");
check(
  "Portable contracts omit Venesia/entity brand copy",
  !types.toLowerCase().includes("venesia") &&
    !types.includes("Topics") &&
    !types.includes("Categories") &&
    !types.includes("Series") &&
    types.includes("AdminEntitySearchConfig") &&
    types.includes("AdminEntityFilterDef"),
);

if (failures.length) {
  console.error("verify-admin-entity-list FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(`verify-admin-entity-list passed (${coreFiles.length} core files gated).`);
