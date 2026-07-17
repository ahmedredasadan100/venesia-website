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

const coreFiles = [
  "src/lib/admin/entity-list/types.ts",
  "src/lib/admin/entity-list/column-preferences.ts",
  "src/lib/admin/entity-list/feedback-codes.ts",
  "src/lib/admin/preferences/admin-column-preferences.ts",
  "src/components/admin/entity-list/AdminEntityList.tsx",
  "src/components/admin/entity-list/AdminEntityListTable.tsx",
  "src/components/admin/ui/AdminListboxSelect.tsx",
];
coreFiles.forEach((path) =>
  check(`Missing entity-list core file: ${path}`, existsSync(resolve(ROOT, path))),
);

const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const entityTable = read("src/components/admin/entity-list/AdminEntityListTable.tsx");
const prefsCore = read("src/lib/admin/entity-list/column-preferences.ts");
const prefsAdapter = read("src/lib/admin/preferences/admin-column-preferences.ts");
const listbox = read("src/components/admin/ui/AdminListboxSelect.tsx");
const bulkBar = read("src/components/admin/ui/AdminBulkActionBar.tsx");
const feedbackCodes = read("src/lib/admin/entity-list/feedback-codes.ts");

const topicsList = read("src/components/admin/content/UnifiedContentList.tsx");
const categoriesPage = read("src/app/admin/content/categories/page.tsx");
const categoriesClient = read("src/app/admin/content/categories/CategoriesListClient.tsx");
const seriesClient = read("src/app/admin/content/series/SeriesTableClient.tsx");
const seriesPage = read("src/app/admin/content/series/page.tsx");

check(
  "Topics/Categories/Series must consume AdminEntityList",
  topicsList.includes("AdminEntityList") &&
    categoriesClient.includes("AdminEntityList") &&
    seriesClient.includes("AdminEntityList"),
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

check(
  "Shared core must not import Topics/Categories/Series/Supabase",
  !entityList.includes("topics/actions") &&
    !entityList.includes("UnifiedContent") &&
    !entityList.includes("from \"@supabase") &&
    !entityList.includes("getSupabaseAdmin") &&
    !entityTable.includes("getSupabaseAdmin") &&
    !prefsCore.includes("getSupabaseAdmin") &&
    !prefsCore.includes("content-topics") &&
    !listbox.includes("topics") &&
    !feedbackCodes.includes("topics"),
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
  "Listbox uses portal + fixed positioning",
  listbox.includes("createPortal") &&
    listbox.includes('position: "fixed"') &&
    listbox.includes("useAdminFloatingMenuPosition"),
);

check(
  "Feedback notices resolve through shared contract",
  feedbackCodes.includes("resolveAdminNoticeFeedback") &&
    read("src/app/admin/content/topics/page.tsx").includes(
      "resolveAdminNoticeFeedback",
    ) &&
    categoriesPage.includes("resolveAdminNoticeFeedback") &&
    seriesPage.includes("resolveAdminNoticeFeedback"),
);

const categoryColumns = read(
  "src/app/admin/content/categories/categories-columns.tsx",
);
check(
  "Categories no longer expose slug/description columns or expand-all controls",
  !categoriesClient.includes("CategoryTreeControls") &&
    !categoriesPage.includes("CategoryTreeControls") &&
    !categoriesPage.includes("data-category-search") &&
    !categoryColumns.includes("row.slug") &&
    !categoryColumns.includes("category.description") &&
    !categoryColumns.includes('key: "description"') &&
    !categoryColumns.includes('key: "slug"'),
);

check(
  "Series uses الموضوعات terminology and column management",
  read("src/app/admin/content/series/series-columns.tsx").includes(
    'label: "الموضوعات"',
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
  read("src/app/admin/content/series/series-columns.tsx").includes(
    "AdminConfirmDialog",
  ),
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

const noticeModule = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/feedback-codes.ts",
);
const notice = noticeModule.resolveAdminNoticeFeedback(
  { created: { message: "ok" }, error: { message: "bad", variant: "danger" } },
  "created",
);
check(
  "resolveAdminNoticeFeedback maps codes",
  notice?.message === "ok" && notice?.variant === "success",
);

// Ensure no Venesia brand string inside portable contracts
const types = read("src/lib/admin/entity-list/types.ts");
check(
  "Portable contracts omit Venesia/entity brand copy",
  !types.toLowerCase().includes("venesia") &&
    !types.includes("Topics") &&
    !types.includes("Categories") &&
    !types.includes("Series"),
);

if (failures.length) {
  console.error("verify-admin-entity-list FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(`verify-admin-entity-list passed (${coreFiles.length} core files gated).`);
