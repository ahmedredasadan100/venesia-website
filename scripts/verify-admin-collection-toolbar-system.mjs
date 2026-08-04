/**
 * Static and pure-behavior guardrails for the shared Admin Collection
 * Toolbar/Search/Filter System. Live interaction remains Browser QA owned.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let assertionCount = 0;

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(label, condition) {
  assertionCount += 1;
  if (!condition) failures.push(label);
}

function loadPureTypeScriptModule(path) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", output)(commonJsModule.exports, commonJsModule);
  return commonJsModule.exports;
}

const toolbar = read(
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
);
const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const searchInput = read("src/components/admin/ui/AdminSearchInput.tsx");
const urlState = read("src/lib/admin/entity-list/url-state.ts");
const topicsAdapter = read(
  "src/components/admin/content/UnifiedContentFilters.tsx",
);

check(
  "Shared owner renders Toolbar, Context Row, Filter Modal, and Suggestions",
  toolbar.includes('data-admin-collection-toolbar-owner=""') &&
    toolbar.includes('data-admin-collection-context-row=""') &&
    toolbar.includes("<VenesiaModal") &&
    toolbar.includes('data-admin-search-suggestions=""'),
);
check(
  "Toolbar source order is Search, Filter, then Columns",
  toolbar.indexOf("<AdminSearchInput") <
    toolbar.indexOf('data-admin-filter-trigger=""') &&
    toolbar.indexOf('data-admin-filter-trigger=""') <
      toolbar.indexOf('data-admin-toolbar-columns=""'),
);
check(
  "Context Row gives bulk actions priority over applied filter chips",
  toolbar.includes('data-admin-context-mode={contextOverrideActive ? "bulk" : "filters"}') &&
    toolbar.includes("contextOverrideActive ? (") &&
    toolbar.includes("appliedFilters.map"),
);
check(
  "Filter modal keeps draft separate and performs one shared apply",
  toolbar.includes("draftFilters") &&
    toolbar.includes("cancelFilters") &&
    toolbar.includes("clearDraftFilters") &&
    toolbar.includes("applyDraftFilters") &&
    toolbar.includes('navigate(patch, "push")'),
);
check(
  "Search owns 350ms default debounce, immediate Enter/Clear, and abortable suggestions",
  toolbar.includes("search.debounceMs ?? 350") &&
    toolbar.includes("commitSearch(draftSearch)") &&
    toolbar.includes('commitSearch("")') &&
    toolbar.includes("new AbortController()") &&
    searchInput.includes('event.key === "Enter"'),
);
check(
  "Search suggestions prevent stale results and expose keyboard semantics",
  toolbar.includes("controller.signal.aborted") &&
    toolbar.includes("suggestionsQuery === trimmedSearch") &&
    toolbar.includes('event.key === "ArrowDown"') &&
    toolbar.includes('event.key === "ArrowUp"') &&
    searchInput.includes('role="combobox"'),
);
check(
  "Shared URL patch resets page and supports push/replace history behavior",
  urlState.includes("next.delete(resetPageParam)") &&
    toolbar.includes('type HistoryBehavior = "push" | "replace"') &&
    toolbar.includes('router[behavior](href, { scroll: false })'),
);
check(
  "AdminEntityList composes one toolbar owner with columns and bulk context",
  entityList.includes("<AdminEntityListFilters") &&
    entityList.includes("columnsControl={columnsControl}") &&
    entityList.includes("contextOverride={bulkBar}") &&
    entityList.includes('className={toolbar ? "!rounded-t-none !border-t-0" : undefined}'),
);

const normalizer = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/search-normalization.ts",
);
check(
  "Arabic normalizer covers alif variants, ya, marks, spaces, and digits",
  normalizer.normalizeAdminCollectionSearchText("  آإأا ـ فَتَى ١۲  ") ===
    "اااا فتي 12",
);
check(
  "Arabic normalizer deliberately keeps taa marbuta distinct from haa",
  normalizer.normalizeAdminCollectionSearchText("مدرسة") !==
    normalizer.normalizeAdminCollectionSearchText("مدرسه"),
);
check(
  "Arabic-aware bounded matching uses the same canonical normalizer",
  normalizer.adminCollectionSearchIncludes("فتى ١٢", "فتي 12") === true,
);

const entityListAdopters = [
  "src/components/admin/content/UnifiedContentList.tsx",
  "src/app/admin/content/categories/CategoriesListClient.tsx",
  "src/app/admin/content/series/SeriesTableClient.tsx",
  "src/app/admin/projects/ProjectsTableClient.tsx",
  "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
  "src/app/admin/seo/redirects/RedirectsClient.tsx",
  "src/app/admin/activity-log/ActivityLogClient.tsx",
  "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  "src/app/admin/users-roles/UsersManagementClient.tsx",
];
check(
  "Every server-page Entity List adopter delegates layout to toolbar props",
  entityListAdopters.every((path) => read(path).includes("toolbar=")),
);
check(
  "Topics declares suggestions in its domain adapter without local UI runtime",
  topicsAdapter.includes("suggestions") &&
    topicsAdapter.includes("minLength: 2") &&
    topicsAdapter.includes("maxResults: 8") &&
    topicsAdapter.includes("{ signal") &&
    !topicsAdapter.includes("<AdminSearchInput") &&
    !topicsAdapter.includes("<VenesiaModal"),
);

const boundedAdopters = [
  "src/components/admin/media/MediaLibraryCore.tsx",
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
];
check(
  "Every bounded or specialized adopter uses the shared toolbar owner",
  boundedAdopters.every((path) =>
    read(path).includes("<AdminEntityListFilters"),
  ),
);
check(
  "Eligible bounded adopters do not rebuild local search inputs",
  boundedAdopters.every((path) => !read(path).includes('<input type="search"')),
);
check(
  "Bounded adopters filter before the shared pagination slice",
  [
    "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
    "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
    "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
    "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
    "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
  ].every((path) => {
    const source = read(path);
    return source.includes("useAdminBoundedClientPagination") &&
      /rows:\s*filtered(?:Rows|Users|Heroes)/.test(source);
  }),
);
check(
  "Media keeps Folder and Smart Views outside its one kind filter",
  read("src/components/admin/media/MediaLibraryCore.tsx").includes(
    "MEDIA_LIBRARY_FILTERS",
  ) &&
    !toolbar.includes("SMART_VIEWS") &&
    !toolbar.includes("initialFolder"),
);
check(
  "Media search maps every declared field before pagination",
  ["displayName", "originalFilename", "objectKey", "defaultAltText"].every(
    (field) => read("src/lib/admin/media-catalog/catalog.ts").includes(`asset.${field}`),
  ) &&
    read("src/lib/admin/media-catalog/catalog.ts").includes(
      "adminCollectionSearchIncludes",
    ),
);
check(
  "Pages exposes a truthful disabled search pending Read Model support",
  read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx").includes(
    "البحث غير متاح قبل تحديث Read Model",
  ) &&
    read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx").includes(
      "disabled: true",
    ),
);

if (failures.length) {
  console.error("verify-admin-collection-toolbar-system FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `verify-admin-collection-toolbar-system passed (${assertionCount} assertions).`,
);
