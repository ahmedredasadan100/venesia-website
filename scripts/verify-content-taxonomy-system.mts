import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  slugifyFromTitle,
  validateSlugFormat,
} from "../src/lib/admin/slug.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Check = {
  section: string;
  label: string;
  ok: boolean;
  detail?: string;
};

const checks: Check[] = [];

function read(path: string) {
  const absolutePath = resolve(ROOT, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function check(
  section: string,
  label: string,
  condition: unknown,
  detail?: string,
) {
  const ok = Boolean(condition);
  checks.push({ section, label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${section}] ${label}${detail ? `: ${detail}` : ""}`);
}

function occurrenceCount(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

function exportedFunctionSlice(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const paths = {
  runtimeCore: "src/lib/admin/form-runtime.ts",
  runtime: "src/components/admin/ui/AdminFormRuntime.tsx",
  formSwitch: "src/components/admin/ui/AdminFormSwitch.tsx",
  formListbox: "src/components/admin/ui/AdminFormListboxSelect.tsx",
  listbox: "src/components/admin/ui/AdminListboxSelect.tsx",
  feedbackProvider: "src/components/admin/AdminFeedbackProvider.tsx",
  noticeFrame: "src/components/admin/AdminNoticeDismissibleFrame.tsx",
  entityList: "src/components/admin/entity-list/AdminEntityList.tsx",
  categoryForm: "src/app/admin/content/categories/CategoryForm.tsx",
  categoryNew: "src/app/admin/content/categories/new/page.tsx",
  categoryEdit: "src/app/admin/content/categories/[id]/page.tsx",
  categoryClient: "src/app/admin/content/categories/CategoriesListClient.tsx",
  categoryColumns: "src/app/admin/content/categories/categories-columns.tsx",
  categoryRowActions:
    "src/app/admin/content/categories/CategoryRowActions.tsx",
  categoryActions: "src/app/admin/content/categories/actions.ts",
  taxonomyFormActions: "src/app/admin/content/taxonomy-form-actions.ts",
  taxonomyFormValidation:
    "src/lib/admin/content/taxonomy-form-validation.ts",
  seriesForm: "src/app/admin/content/series/SeriesForm.tsx",
  seriesNew: "src/app/admin/content/series/new/page.tsx",
  seriesEdit: "src/app/admin/content/series/[id]/page.tsx",
  seriesClient: "src/app/admin/content/series/SeriesTableClient.tsx",
  seriesColumns: "src/app/admin/content/series/series-columns.tsx",
  dataGrid: "src/components/admin/ui/AdminDataGrid.tsx",
  previewActions: "src/components/admin/ui/AdminEntityPreviewActions.tsx",
  previewAdapters: "src/lib/admin/content/entity-preview-capabilities.ts",
  interactionManifest:
    "src/lib/admin/interaction-system/adoption-manifest.ts",
  categoryAdapter:
    "src/lib/admin/content/entity-list-adapters/categories.ts",
  seriesAdapter: "src/lib/admin/content/entity-list-adapters/series.ts",
  taxonomyMutations: "src/lib/admin/content/taxonomy-mutations.ts",
  instantMutation:
    "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
  instantMutationCache:
    "src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts",
  migration:
    "sql/migrations/20260723040000_content_taxonomy_data_runtime.sql",
} as const;

for (const [key, path] of Object.entries(paths)) {
  check("files", `${key} canonical file exists`, existsSync(resolve(ROOT, path)), path);
}

const runtimeCore = read(paths.runtimeCore);
const runtime = read(paths.runtime);
const formSwitch = read(paths.formSwitch);
const formListbox = read(paths.formListbox);
const listbox = read(paths.listbox);
const feedbackProvider = read(paths.feedbackProvider);
const noticeFrame = read(paths.noticeFrame);
const entityList = read(paths.entityList);
const categoryForm = read(paths.categoryForm);
const categoryNew = read(paths.categoryNew);
const categoryEdit = read(paths.categoryEdit);
const categoryClient = read(paths.categoryClient);
const categoryColumns = read(paths.categoryColumns);
const categoryRowActions = read(paths.categoryRowActions);
const categoryActions = read(paths.categoryActions);
const taxonomyFormActions = read(paths.taxonomyFormActions);
const taxonomyFormValidation = read(paths.taxonomyFormValidation);
const seriesForm = read(paths.seriesForm);
const seriesNew = read(paths.seriesNew);
const seriesEdit = read(paths.seriesEdit);
const seriesClient = read(paths.seriesClient);
const seriesColumns = read(paths.seriesColumns);
const dataGrid = read(paths.dataGrid);
const previewActions = read(paths.previewActions);
const previewAdapters = read(paths.previewAdapters);
const interactionManifest = read(paths.interactionManifest);
const categoryAdapter = read(paths.categoryAdapter);
const seriesAdapter = read(paths.seriesAdapter);
const taxonomyMutations = read(paths.taxonomyMutations);
const instantMutation = read(paths.instantMutation);
const instantMutationCache = read(paths.instantMutationCache);
const migration = read(paths.migration);
const createCategory = exportedFunctionSlice(
  taxonomyFormActions,
  "createCategoryForm",
);
const createSeries = exportedFunctionSlice(
  taxonomyFormActions,
  "createSeriesForm",
);

// 1. Targeted shared Form Runtime contracts.
check(
  "form-runtime",
  "runtime exports the shared shell, grid, errors, actions, and dirty guard",
  runtime.includes("AdminFormRuntime") &&
    runtime.includes("AdminFormGrid") &&
    runtime.includes("AdminFormError") &&
    runtime.includes("AdminFormActions") &&
    runtime.includes("useAdminFormRuntime") &&
    runtime.includes("useAdminUnsavedChangesGuard"),
);
check(
  "form-runtime",
  "runtime exposes stable form, entity, dirty, and unsaved-dialog markers",
  runtime.includes("data-admin-form-runtime") &&
    runtime.includes("data-admin-form-entity") &&
    runtime.includes("data-admin-form-dirty") &&
    runtime.includes("data-admin-unsaved-dialog"),
);
check(
  "form-runtime",
  "dirty navigation uses the shared dialog and browser-unload protection without window.confirm",
  runtime.includes("AdminConfirmDialog") &&
    runtime.includes("beforeunload") &&
    !runtime.includes("window.confirm"),
);
check(
  "form-runtime",
  "shared grid owns responsive column behavior",
  runtime.includes("grid") &&
    /(?:sm|md|lg|xl):grid-cols/.test(runtime) &&
    !runtimeCore.toLowerCase().includes("categor") &&
    !runtimeCore.toLowerCase().includes("series"),
);
check(
  "form-runtime",
  "shared published-state control delegates to one switch primitive",
  formSwitch.includes("AdminFormSwitch") &&
    formSwitch.includes('role="switch"') &&
    formSwitch.includes('type="checkbox"') &&
    formSwitch.includes("peer-checked"),
);

// 2. Category Create/Edit parity.
check(
  "category-parity",
  "category create and edit pages consume the same CategoryForm",
  categoryNew.includes("<CategoryForm") &&
    categoryEdit.includes("<CategoryForm") &&
    categoryNew.includes('mode="create"') &&
    categoryEdit.includes('mode="edit"'),
);
check(
  "category-parity",
  "CategoryForm delegates its only form to AdminFormRuntime",
  occurrenceCount(categoryForm, /<form\b/g) === 0 &&
    occurrenceCount(categoryForm, /<AdminFormRuntime\b/g) === 1 &&
    occurrenceCount(runtime, /<form\b/g) === 1,
);
check(
  "category-parity",
  "CategoryForm uses the shared grid, switch, listbox, and actions",
  categoryForm.includes("AdminFormGrid") &&
    categoryForm.includes("AdminFormSwitch") &&
    categoryForm.includes("AdminFormListboxSelect") &&
    categoryForm.includes("AdminFormActions"),
);
check(
  "category-parity",
  "category sort order is removed from the form UI only",
  !categoryForm.includes('name="sort_order"') &&
    createCategory.includes("sort_order: 0") &&
    migration.includes("sort_order"),
);
check(
  "category-parity",
  "category editing navigates to the full edit page and no active modal consumer remains",
  categoryColumns.includes("/admin/content/categories/") &&
    !categoryClient.includes("CategoryEditModal") &&
    !categoryColumns.includes("CategoryEditModal"),
);

// 3. Series Create/Edit parity.
check(
  "series-parity",
  "series create and edit pages consume the same SeriesForm",
  seriesNew.includes("<SeriesForm") &&
    seriesEdit.includes("<SeriesForm") &&
    seriesNew.includes('mode="create"') &&
    seriesEdit.includes('mode="edit"'),
);
check(
  "series-parity",
  "SeriesForm delegates its only form to AdminFormRuntime",
  occurrenceCount(seriesForm, /<form\b/g) === 0 &&
    occurrenceCount(seriesForm, /<AdminFormRuntime\b/g) === 1 &&
    occurrenceCount(runtime, /<form\b/g) === 1,
);
check(
  "series-parity",
  "SeriesForm uses the same shared runtime primitives as CategoryForm",
  [
    "AdminFormGrid",
    "AdminFormSwitch",
    "AdminFormListboxSelect",
    "AdminFormActions",
  ].every((token) => categoryForm.includes(token) && seriesForm.includes(token)),
);
check(
  "series-parity",
  "series sort order is removed from the form UI only",
  !seriesForm.includes('name="sort_order"') &&
    createSeries.includes("sort_order: 0") &&
    migration.includes("sort_order"),
);

// 4. Shared Select single-source Form contract.
check(
  "select-single-source",
  "shared form listbox contains exactly one native select source",
  occurrenceCount(formListbox, /<select\b/g) === 1 &&
    formListbox.includes("name={name}") &&
    !formListbox.includes('type="hidden"') &&
    formListbox.includes("data-admin-form-listbox"),
);
check(
  "select-single-source",
  "shared form listbox owns RTL, search, and async states",
  [
    'dir = "rtl"',
    "dir={dir}",
    "search",
    "loading",
    "error",
    "disabled",
  ].every((token) => formListbox.toLowerCase().includes(token.toLowerCase())),
);
check(
  "select-single-source",
  "search is delegated to the shared open listbox instead of rendering as a permanent form field",
  !formListbox.includes('type="search"') &&
    formListbox.includes("searchable={searchable}") &&
    formListbox.includes("searchPlaceholder={searchPlaceholder}") &&
    listbox.includes('data-admin-listbox-popover=""') &&
    listbox.includes('data-admin-listbox-search=""') &&
    listbox.indexOf('data-admin-listbox-search=""') >
      listbox.indexOf('data-admin-listbox-popover=""'),
);
check(
  "select-single-source",
  "delegated listbox owns the required keyboard contract",
  [
    "ArrowDown",
    "ArrowUp",
    "Enter",
    "Escape",
  ].every((token) => listbox.includes(token)) &&
    formListbox.includes("AdminListboxSelect"),
);
check(
  "select-single-source",
  "taxonomy forms use the shared listbox without local native selects",
  categoryForm.includes("AdminFormListboxSelect") &&
    seriesForm.includes("AdminFormListboxSelect") &&
    !categoryForm.includes("<select") &&
    !seriesForm.includes("<select"),
);
check(
  "select-single-source",
  "relation validation focuses the visible listbox trigger and keeps it interactive",
    formListbox.includes("focusTargetId") &&
    formListbox.includes("triggerId={focusTargetId}") &&
    formListbox.includes("ariaInvalid={Boolean(error)}") &&
    formListbox.includes("const unavailable = options.length === 0") &&
    formListbox.includes("disabled={disabled || loading}") &&
    categoryForm.includes('focusTargetId="parent_id"') &&
    seriesForm.includes('focusTargetId="category_id"') &&
    taxonomyFormActions.includes("messages.length > 0") &&
    taxonomyFormActions.includes("{ parent_id: [parentError] }") &&
    taxonomyFormActions.includes("{ category_id: [categoryError] }"),
);
check(
  "select-single-source",
  "category keeps the empty parent option while both taxonomy consumers expose no local search input",
  categoryForm.includes('{ value: "", label: "بدون تصنيف أب" }') &&
    !categoryForm.includes('type="search"') &&
    !seriesForm.includes('type="search"'),
);

// 5. Slug create/edit lock contract, including pure input behavior.
const categoryAutoSlug = slugifyFromTitle("Sample Category");
check(
  "slug-policy",
  "category create derives a valid slug when the field is empty",
  categoryAutoSlug === "sample-category" &&
    validateSlugFormat(categoryAutoSlug) === null &&
    occurrenceCount(
      taxonomyFormValidation,
      /slug:\s*rawSlug\s*\|\|\s*slugifyFromTitle\(name\)/g,
    ) === 2,
  categoryAutoSlug,
);
const seriesManualSlug = "manual-series-slug";
check(
  "slug-policy",
  "series create preserves a valid manually edited slug",
  validateSlugFormat(seriesManualSlug) === null &&
    taxonomyFormValidation.includes("const rawSlug = taxonomyFormDataValue"),
);
check(
  "slug-policy",
  "shared validation rejects malformed slugs",
  validateSlugFormat("Bad Slug!") !== null &&
    taxonomyFormValidation.includes("validateSlugFormat(value)"),
);
check(
  "slug-policy",
  "both forms render edit slugs read-only",
  categoryForm.includes("readOnly") &&
    seriesForm.includes("readOnly") &&
    categoryForm.includes('mode === "edit"') &&
    seriesForm.includes('mode === "edit"'),
);
const updateCategory = exportedFunctionSlice(
  taxonomyFormActions,
  "updateCategoryForm",
);
const updateSeries = exportedFunctionSlice(
  taxonomyFormActions,
  "updateSeriesForm",
);
check(
  "slug-policy",
  "server update actions do not accept a replacement slug",
  updateCategory.length > 0 &&
    updateSeries.length > 0 &&
    updateCategory.includes("slug: current.slug") &&
    updateSeries.includes("slug: current.slug") &&
    !updateCategory.includes("slug: rawInput.slug") &&
    !updateSeries.includes("slug: rawInput.slug"),
);

// 6. Shared form viewport + inline entity-list feedback contract.
check(
  "feedback",
  "feedback provider exposes shared publisher, hook, and viewport, and the runtime publishes through it",
  feedbackProvider.includes("AdminFeedbackProvider") &&
    feedbackProvider.includes("AdminFeedbackViewport") &&
    feedbackProvider.includes("useAdminFeedback") &&
    feedbackProvider.includes("data-admin-feedback-viewport") &&
    runtime.includes("useAdminFeedback") &&
    !runtime.includes("useOptionalAdminFeedback") &&
    runtime.includes("publishFeedback"),
);
check(
  "feedback",
  "feedback viewport is fixed and success replacement is state-owned",
  feedbackProvider.includes("fixed") &&
    /set(?:Entries|Feedback|Items|Notices)/.test(feedbackProvider) &&
    feedbackProvider.includes('feedback.variant === "success"'),
);
check(
  "feedback",
  "feedback clears mobile sticky actions and returns to the desktop bottom rail",
  feedbackProvider.includes("top-4 bottom-auto") &&
    feedbackProvider.includes("sm:top-auto sm:bottom-6"),
);
check(
  "feedback",
  "feedback policies publish dismissible action outcomes without an auto-dismiss duration",
  !read("src/lib/admin/admin-action-feedback.ts").includes('lifecycle: "auto"') &&
    !read("src/lib/admin/admin-action-feedback.ts").includes("autoDismissMs: 5_000") &&
    noticeFrame.includes("ariaLive"),
);
check(
  "feedback",
  "form-level feedback stays global while field validation stays local",
  runtime.includes("useAdminFeedback") &&
    !runtime.includes("useOptionalAdminFeedback") &&
    runtime.includes("publishFeedback") &&
    runtime.includes("hasFieldErrors") &&
    runtime.includes('state.status === "error" && hasFieldErrors') &&
    categoryForm.includes("AdminFormError") &&
    seriesForm.includes("AdminFormError"),
);
check(
  "feedback",
  "entity lists publish through the shared runtime into its inline channel viewport",
  feedbackProvider.includes("AdminFeedbackChannelViewport") &&
    feedbackProvider.includes("data-admin-entity-feedback-slot") &&
    entityList.includes("useAdminFeedback") &&
    entityList.includes("publishFeedback(nextFeedback") &&
    entityList.includes("AdminFeedbackChannelViewport") &&
    entityList.indexOf("<AdminFeedbackChannelViewport") >
      entityList.lastIndexOf("<AdminBulkActionBar") &&
    entityList.indexOf("<AdminFeedbackChannelViewport") <
      entityList.indexOf("<AdminEntityListTable"),
);
check(
  "feedback",
  "feedback runtime owns inline smart reveal and reduced-motion focus",
  feedbackProvider.includes("latestEntry?.reveal") &&
    feedbackProvider.includes("getBoundingClientRect") &&
    feedbackProvider.includes("scrollIntoView") &&
    feedbackProvider.includes("prefers-reduced-motion: reduce") &&
    feedbackProvider.includes('prefersReducedMotion ? "auto" : "smooth"') &&
    feedbackProvider.includes("focus({ preventScroll: true })") &&
    entityList.includes("options.bulk === true") &&
    entityList.includes('result.code === "deleted"'),
);

// 7. Categories list query contract.
check(
  "categories-query",
  "categories adapter delegates to exactly one admin_list_categories RPC",
  /\.rpc\(\s*"admin_list_categories"/.test(categoryAdapter) &&
    occurrenceCount(categoryAdapter, /\.rpc\(/g) === 1 &&
    !categoryAdapter.includes("loadCategoriesListData") &&
    !categoryAdapter.includes(".slice("),
);
check(
  "categories-query",
  "categories read model owns search, filters, sorting, pagination, counts, and normalized page",
  [
    "admin_list_categories",
    "p_search",
    "p_status",
    "p_sort_field",
    "p_sort_direction",
    "p_page",
    "p_page_size",
    "total_count",
  ].every((token) => migration.includes(token)) &&
    migration.includes("normalized_state") &&
    migration.includes("'page'") &&
    migration.includes("metrics"),
);

// 8. Series list query contract.
check(
  "series-query",
  "series adapter delegates to exactly one admin_list_series RPC",
  /\.rpc\(\s*"admin_list_series"/.test(seriesAdapter) &&
    occurrenceCount(seriesAdapter, /\.rpc\(/g) === 1 &&
    !seriesAdapter.includes("loadSeriesListData") &&
    !seriesAdapter.includes(".slice("),
);
check(
  "series-query",
  "series read model owns search, status/category filters, sorting, pagination, counts, and normalized page",
  [
    "admin_list_series",
    "p_search",
    "p_status",
    "p_category_id",
    "p_sort_field",
    "p_sort_direction",
    "p_page",
    "p_page_size",
    "total_count",
  ].every((token) => migration.includes(token)) &&
    migration.includes("normalized_state") &&
    migration.includes("'page'") &&
    migration.includes("metrics"),
);

// 9. Mutation rollback / atomicity contracts.
for (const rpc of [
  "admin_update_topic_category",
  "admin_delete_topic_category",
  "admin_update_topic_series",
]) {
  check(
    "mutation-atomicity",
    `${rpc} is defined by the additive taxonomy migration`,
    migration.includes(`function public.${rpc}`),
  );
  check(
    "mutation-atomicity",
    `${rpc} is called by the taxonomy mutation DAL`,
    new RegExp(`\\.rpc\\(\\s*["']${rpc}["']`).test(taxonomyMutations),
  );
}
check(
  "mutation-atomicity",
  "atomic DAL contains no split client-side topics write",
  !taxonomyMutations.includes('.from("topics").update') &&
    !taxonomyMutations.includes('.from("topic_categories").update') &&
    !taxonomyMutations.includes('.from("topic_series").update'),
);
check(
  "mutation-atomicity",
  "category and series update actions delegate to atomic helpers",
  updateCategory.includes("updateTopicCategoryAtomically") &&
    updateSeries.includes("updateTopicSeriesAtomically") &&
    categoryActions.includes("deleteTopicCategoryAtomically"),
);
check(
  "mutation-rollback",
  "generic mutation runtime cancels requests and restores exact snapshots",
  instantMutation.includes("cancelQueries") &&
    instantMutation.includes("snapshot") &&
    instantMutation.includes("restoreSnapshot") &&
    instantMutation.includes("invalidateQueries"),
);
check(
  "mutation-rollback",
  "taxonomy list consumers use the shared scoped instant-mutation runtime",
  categoryClient.includes("useAdminEntityInstantMutation") &&
    seriesClient.includes("useAdminEntityInstantMutation") &&
    instantMutationCache.includes("setAdminEntityListCachesInScope") &&
    !categoryClient.includes("router.refresh") &&
    !seriesClient.includes("router.refresh"),
);
check(
  "collection-interaction",
  "pending presentation is scoped to rowId plus action without local pending owners",
  [categoryClient, seriesClient].every(
    (source) =>
      source.includes("rowPendingAction:") &&
      source.includes("instant.rowPending?.rowId ===") &&
      !source.includes(
        "instant.rowPending !== null || instant.bulkPending !== null",
      ),
  ) &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes('pendingAction === "visibility"') &&
        source.includes('pendingAction === "duplicate"') &&
        source.includes('pendingAction === "delete"') &&
        !source.includes("localPending"),
    ),
);
check(
  "collection-interaction",
  "Categories and Series delegate visibility icon, tone, label, accessibility, and pending presentation",
  dataGrid.includes('action === "visibility"') &&
    dataGrid.includes("resolveAdminDataGridVisibilityAction") &&
    dataGrid.includes('tone: "dark" as const') &&
    dataGrid.includes('tone: "green" as const') &&
    dataGrid.includes("resolvedAriaPressed") &&
    dataGrid.includes("data-admin-visibility-state") &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes('action="visibility"') &&
        source.includes("isCurrentlyHidden=") &&
        source.includes("visibilityEntityLabel=") &&
        !source.includes("title={isHidden") &&
        !source.includes("title={isActive") &&
        !source.includes("tone={isHidden") &&
        !source.includes("tone={isActive"),
    ),
);
check(
  "collection-interaction",
  "taxonomy collection outcomes use one shared feedback channel and no local notice engine",
  feedbackProvider.includes("AdminFeedbackChannelViewport") &&
    feedbackProvider.includes("entry.channel === channel") &&
    feedbackProvider.includes("entry.placement === placement") &&
    entityList.includes("publishFeedback(nextFeedback") &&
    entityList.includes('placement: "inline"') &&
    [categoryRowActions, seriesColumns].every(
      (source) => !source.includes("AdminNotice"),
    ),
);
check(
  "collection-interaction",
  "Category and Series Preview/Public use the shared capability entry point with only proven routes",
  previewActions.includes('presentation === "data-grid-compact"') &&
    previewAdapters.includes("buildAdminCategoryCollectionPreviewCapability") &&
    previewAdapters.includes("/topics?category=") &&
    previewAdapters.includes('publicViewPublicationPolicy: "always"') &&
    previewAdapters.includes("buildAdminSeriesCollectionPreviewCapability") &&
    previewAdapters.includes("/admin/content/topics?series=") &&
    previewAdapters.includes("publicView: null") &&
    categoryRowActions.includes("AdminEntityPreviewActions") &&
    seriesColumns.includes("AdminEntityPreviewActions") &&
    interactionManifest.includes('status: "adopted"') &&
    !categoryRowActions.includes("previewHref") &&
    !seriesColumns.includes("topicsPreviewHref"),
);

const sections = new Map<string, { passed: number; total: number }>();
for (const result of checks) {
  const current = sections.get(result.section) ?? { passed: 0, total: 0 };
  current.total += 1;
  if (result.ok) current.passed += 1;
  sections.set(result.section, current);
}

console.log("\nContent Taxonomy verification summary:");
for (const [section, result] of sections) {
  console.log(` - ${section}: ${result.passed}/${result.total}`);
}

const failures = checks.filter((result) => !result.ok);
if (failures.length) {
  throw new assert.AssertionError({
    message: `${failures.length} Content Taxonomy contract checks failed`,
    actual: failures.map((failure) => `[${failure.section}] ${failure.label}`),
    expected: [],
  });
}

console.log(`verify:content-taxonomy passed (${checks.length} assertions)`);
