/**
 * Static and pure-behavior guardrails for the Unified Content Engine.
 *
 * This intentionally avoids network access so it can run in CI. Live schema
 * contracts are covered separately by verify-unified-content-database.mjs.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
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

function containsAll(source, values) {
  return values.every((value) => source.includes(value));
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
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

function parseTypeScriptSource(path) {
  return ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function getImportSource(path, localName) {
  const sourceFile = parseTypeScriptSource(path);
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const clause = statement.importClause;
    if (clause.name?.text === localName) {
      return statement.moduleSpecifier.text;
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      const match = clause.namedBindings.elements.find(
        (element) => element.name.text === localName,
      );
      if (match) return statement.moduleSpecifier.text;
    }
  }
  return null;
}

function getJsxAttributeValue(path, componentName, attributeName) {
  const sourceFile = parseTypeScriptSource(path);
  let value = null;
  function visit(node) {
    if (
      value === null &&
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === componentName
    ) {
      const attribute = node.attributes.properties.find(
        (property) =>
          ts.isJsxAttribute(property) &&
          property.name.getText(sourceFile) === attributeName,
      );
      if (attribute && ts.isJsxAttribute(attribute)) {
        value = attribute.initializer?.getText(sourceFile) ?? "present";
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return value;
}

function getColumnFactoryContract(path, functionName) {
  const sourceFile = parseTypeScriptSource(path);
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
  if (!declaration || !ts.isFunctionDeclaration(declaration) || !declaration.body) {
    return { keys: [], defaultKeys: [] };
  }
  const returnStatement = declaration.body.statements.find(ts.isReturnStatement);
  const array = returnStatement?.expression;
  if (!array || !ts.isArrayLiteralExpression(array)) {
    return { keys: [], defaultKeys: [] };
  }
  const rows = array.elements
    .filter(ts.isObjectLiteralExpression)
    .map((object) => {
      const keyProperty = object.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(sourceFile) === "key",
      );
      const defaultProperty = object.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(sourceFile) === "defaultVisible",
      );
      const key =
        keyProperty &&
        ts.isPropertyAssignment(keyProperty) &&
        ts.isStringLiteral(keyProperty.initializer)
          ? keyProperty.initializer.text
          : null;
      const defaultVisible =
        defaultProperty &&
        ts.isPropertyAssignment(defaultProperty) &&
        defaultProperty.initializer.kind === ts.SyntaxKind.TrueKeyword;
      return { key, defaultVisible };
    })
    .filter((row) => row.key !== null);
  return {
    keys: rows.map((row) => row.key),
    defaultKeys: rows.filter((row) => row.defaultVisible).map((row) => row.key),
  };
}

function getNumericObjectLiteral(path, variableName) {
  const sourceFile = parseTypeScriptSource(path);
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find(
      (item) => ts.isIdentifier(item.name) && item.name.text === variableName,
    );
    if (!declaration?.initializer || !ts.isAsExpression(declaration.initializer)) {
      continue;
    }
    const object = declaration.initializer.expression;
    if (!ts.isObjectLiteralExpression(object)) continue;
    return Object.fromEntries(
      object.properties
        .filter(ts.isPropertyAssignment)
        .map((property) => [
          property.name.getText(sourceFile),
          ts.isNumericLiteral(property.initializer)
            ? Number(property.initializer.text)
            : null,
        ]),
    );
  }
  return {};
}

function getNumericConst(path, variableName) {
  const sourceFile = parseTypeScriptSource(path);
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find(
      (item) => ts.isIdentifier(item.name) && item.name.text === variableName,
    );
    if (declaration?.initializer && ts.isNumericLiteral(declaration.initializer)) {
      return Number(declaration.initializer.text);
    }
  }
  return null;
}

function findIfElseBranches(source, path, expectedCondition) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const normalizeCondition = (value) => value.replace(/\s+/g, "");
  let branches = null;

  function visit(node) {
    if (
      !branches &&
      ts.isIfStatement(node) &&
      node.elseStatement &&
      normalizeCondition(node.expression.getText(sourceFile)) ===
        normalizeCondition(expectedCondition)
    ) {
      branches = {
        then: node.thenStatement.getText(sourceFile),
        else: node.elseStatement.getText(sourceFile),
      };
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return branches ?? { then: "", else: "" };
}

const requiredRoutes = [
  "src/app/admin/content/topics/page.tsx",
  "src/app/admin/content/topics/new/page.tsx",
  "src/app/admin/content/topics/[id]/page.tsx",
  "src/app/admin/content/topics/[id]/preview/page.tsx",
  "src/app/admin/content/categories/page.tsx",
  "src/app/admin/content/series/page.tsx",
];
requiredRoutes.forEach((path) => check(`Missing canonical route: ${path}`, existsSync(resolve(ROOT, path))));

for (const legacyRoot of [
  "src/app/admin/topics",
  "src/app/admin/content/articles",
  "src/app/admin/content/media",
  "src/app/admin/media-center",
]) {
  check(
    `Legacy admin engine still has files: ${legacyRoot}`,
    walk(resolve(ROOT, legacyRoot)).length === 0,
  );
}

const adminShell = read("src/components/admin/AdminShell.tsx");
const adminNavigationRegistry = read("src/config/admin/navigation.ts");
check(
  "Admin navigation must expose the three canonical content links",
  containsAll(adminNavigationRegistry, [
    'href: "/admin/content/topics"',
    'href: "/admin/content/categories"',
    'href: "/admin/content/series"',
  ]),
);
check(
  "Admin navigation must not expose an independent Media Center",
  !adminNavigationRegistry.includes("/admin/media-center") &&
    !adminNavigationRegistry.includes("/admin/content/media") &&
    !adminShell.includes("/admin/media-center"),
);

const contentTypes = loadPureTypeScriptModule("src/lib/admin/content/content-types.ts");
check(
  "Unified registry must contain every supported content_type exactly once",
  JSON.stringify(contentTypes.CONTENT_TYPES) ===
    JSON.stringify(["article", "news", "press", "site_update", "video", "gallery"]),
);
check("Article must resolve to the article editor", contentTypes.resolveContentEditor("article") === "article");
check("News must resolve to the text media editor", contentTypes.resolveContentEditor("news") === "text-media");
check("Press must resolve to the text media editor", contentTypes.resolveContentEditor("press") === "text-media");
check("Site updates must resolve to the text media editor", contentTypes.resolveContentEditor("site_update") === "text-media");
check("Video must resolve to the video editor", contentTypes.resolveContentEditor("video") === "video");
check("Gallery must resolve to the gallery editor", contentTypes.resolveContentEditor("gallery") === "gallery");
check("Unknown content types must not fall back to an editor", contentTypes.resolveContentEditor("unknown") === null);

const contentStatuses = loadPureTypeScriptModule(
  "src/lib/admin/content/content-status-metadata.ts",
);
const expectedStatusMetadata = {
  published: { label: "منشور", tone: "green" },
  unpublished: { label: "غير منشور", tone: "gold" },
};
for (const [status, expected] of Object.entries(expectedStatusMetadata)) {
  check(
    `Content status ${status} must retain its semantic label and tone`,
    JSON.stringify(contentStatuses.getContentStatusMetadata(status)) ===
      JSON.stringify(expected),
  );
}
check(
  "Unknown content statuses must fail safely to unpublished metadata",
  JSON.stringify(contentStatuses.getContentStatusMetadata("unknown")) ===
    JSON.stringify(expectedStatusMetadata.unpublished),
);

const actionFeedback = loadPureTypeScriptModule(
  "src/lib/admin/admin-action-feedback.ts",
);
const transientSuccessFeedback = actionFeedback.mapAdminActionResultToFeedback({
  ok: true,
  title: "Saved",
  message: "Done",
});
const validationFeedback = actionFeedback.mapAdminActionResultToFeedback(
  { ok: false, title: "Invalid", message: "Fix it" },
  { kind: "action_validation", action: { label: "Fix", href: "/admin/fix" } },
);
const criticalFeedback = actionFeedback.mapAdminActionResultToFeedback(
  { ok: false, title: "Unavailable", message: "Try later" },
  { kind: "critical_system" },
);
check(
  "Action feedback must remain visible and dismissible until the user closes it",
  transientSuccessFeedback.variant === "success" &&
    transientSuccessFeedback.dismissible === true &&
    transientSuccessFeedback.lifecycle === "manual" &&
    transientSuccessFeedback.autoDismissMs === undefined,
);
check(
  "Action validation feedback must retain its repair action",
  validationFeedback.variant === "danger" &&
    validationFeedback.dismissible === true &&
    validationFeedback.lifecycle === "manual" &&
    validationFeedback.action?.href === "/admin/fix",
);
check(
  "Critical system feedback must remain stacked, persistent, and dismissible",
  criticalFeedback.layout === "stacked" &&
    criticalFeedback.lifecycle === "persistent" &&
    criticalFeedback.dismissible === true,
);

const editorRoute = read("src/app/admin/content/topics/[id]/page.tsx");
check(
  "Unified editor route must resolve by content_type",
  editorRoute.includes("resolveContentEditor(topic.content_type)"),
);
check(
  "Unified editor route must not resolve by category slug",
  !/resolveContentEditor\s*\([^)]*category/i.test(editorRoute),
);

const hierarchy = loadPureTypeScriptModule("src/lib/admin/content/category-hierarchy.ts");
const hierarchyFixture = [
  { id: 1, name: "Root", slug: "root", parent_id: null, sort_order: 1, is_active: true },
  { id: 2, name: "Child", slug: "child", parent_id: 1, sort_order: 1, is_active: true },
  { id: 3, name: "Grandchild", slug: "grandchild", parent_id: 2, sort_order: 1, is_active: true },
  { id: 4, name: "Other", slug: "other", parent_id: null, sort_order: 2, is_active: true },
];
check(
  "Parent category filtering must include all descendants",
  JSON.stringify(hierarchy.getCategoryAndDescendantIds(hierarchyFixture, 1).sort()) ===
    JSON.stringify([1, 2, 3]),
);
check(
  "Child category filtering must remain scoped to its own branch",
  JSON.stringify(hierarchy.getCategoryAndDescendantIds(hierarchyFixture, 3)) === JSON.stringify([3]),
);
check(
  "Category hierarchy must retain arbitrary depth",
  hierarchy.flattenAdminCategoryTree(hierarchy.buildAdminCategoryTree(hierarchyFixture))[2]?.depth === 2,
);

const loader = read("src/lib/admin/content/load-unified-content.ts");
check("Unified query must use the admin read model", loader.includes('.from("admin_content_topics")'));
check(
  "Search must target title only",
  loader.includes('.ilike("title"') &&
    !loader.includes('.ilike("slug"') &&
    !loader.includes('.ilike("excerpt"') &&
    !loader.includes('.ilike("category_name"'),
);
check(
  "Hierarchical filter must resolve descendant IDs",
  loader.includes("getCategoryAndDescendantIds(categories, filters.categoryId)"),
);
check(
  "Sorting must happen before pagination",
  loader.indexOf("applySort(") < loader.indexOf(").range(from, to)"),
);
check(
  "Sort values must be explicitly allow-listed",
  containsAll(loader, [
    '"id_asc"',
    '"id_desc"',
    '"title_asc"',
    '"title_desc"',
    '"content_type_asc"',
    '"content_type_desc"',
    '"category_asc"',
    '"category_desc"',
    '"series_asc"',
    '"series_desc"',
    '"featured_asc"',
    '"featured_desc"',
    '"seo_asc"',
    '"seo_desc"',
    '"views_asc"',
    '"views_desc"',
    '"created_at_asc"',
    '"created_at_desc"',
    '"updated_at_asc"',
    '"updated_at_desc"',
    '"created_by_asc"',
    '"created_by_desc"',
    '"status_asc"',
    '"status_desc"',
  ]),
);
check(
  "Derived SEO sorting must reuse the existing score owner over the complete filtered server dataset before pagination",
  loader.includes("isSeoContentSortValue(filters.sort)") &&
    loader.includes("(seoSourceRows ?? []).map(toUnifiedContentRow)") &&
    loader.includes("sortUnifiedContentRowsBySeo(") &&
    loader.includes('.select(CONTENT_LIST_SELECT, { count: "exact" })') &&
    loader.includes("while (seoSourceRows.length < totalCount)") &&
    !loader.includes("const batchSize = 500") &&
    loader.includes(".slice(from, to + 1)") &&
    loader.includes("seo_score: getUnifiedContentSeoScore(source)"),
);
check(
  "Metrics must derive active summaries and SEO average from one complete Topics scan",
  loader.includes('supabase.from("topics")') &&
    loader.includes('.select(CONTENT_METRICS_SELECT, { count: "exact" })') &&
    loader.includes('.is("deleted_at", null)') &&
    loader.includes("while (!activeError && activeRows.length < activeCount)") &&
    loader.includes('row.status === "published"') &&
    loader.includes('row.status === "unpublished"') &&
    !loader.includes("const base = () =>"),
);
check(
  "Unified Content SEO inputs narrow generated FAQ and keyword contracts without partial coercion",
  loader.includes("faq: Json | null") &&
    loader.includes("seo_keywords: string[] | null") &&
    loader.includes("parseTopicFaq(row.faq ?? null) ?? []") &&
    loader.includes('value.every((item) => typeof item === "string")') &&
    !loader.includes("value.map(String)") &&
    !loader.includes("function normalizeFaq"),
);

const filters = read("src/components/admin/content/UnifiedContentFilters.tsx");
const sharedCollectionToolbar = read(
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
);
const sharedSearchInput = read("src/components/admin/ui/AdminSearchInput.tsx");
const sharedUrlState = read("src/lib/admin/entity-list/url-state.ts");
const searchRoute = read("src/app/admin/content/topics/search/route.ts");
check("Search debounce must be 300–400ms", filters.includes("debounceMs: 350"));
check("Autocomplete requests must be abortable", sharedCollectionToolbar.includes("new AbortController()") && filters.includes("{ signal"));
check("Enter must apply search immediately", sharedCollectionToolbar.includes("commitSearch(draftSearch)"));
check("Autocomplete must support keyboard navigation", containsAll(sharedCollectionToolbar, ['event.key === "ArrowDown"', 'event.key === "ArrowUp"']) && sharedSearchInput.includes('event.key === "Enter"'));
check("Escape must close autocomplete", sharedCollectionToolbar.includes("onEscape={() =>") && sharedSearchInput.includes('event.key === "Escape"'));
check("Filters apply once and reset pagination", sharedCollectionToolbar.includes('navigate(patch, "push")') && sharedUrlState.includes("next.delete(resetPageParam)"));
check("Topics delegates every unified filter to the shared owner", containsAll(filters, ['"content_type"', '"category"', '"series"', '"status"', '"featured"']) && !filters.includes("<AdminSearchInput"));
check(
  "Autocomplete payload must not expose slugs",
  searchRoute.includes('.select("id,title,category_name")') && !searchRoute.includes("slug,"),
);

const columns = read("src/components/admin/content/unified-content-columns.tsx");
const unifiedRowActions = read(
  "src/components/admin/content/UnifiedContentRowActions.tsx",
);
const featuredColumnSource =
  columns.match(/key: "featured"[\s\S]*?key: "seo"/)?.[0] ?? "";
const columnsPath = "src/components/admin/content/unified-content-columns.tsx";
const columnFactoryContract = getColumnFactoryContract(
  columnsPath,
  "createUnifiedContentColumns",
);
const compactColumnWidths = getNumericObjectLiteral(
  columnsPath,
  "TOPICS_COMPACT_COLUMN_WIDTHS",
);
const topicsTitleMinWidth = getNumericConst(
  columnsPath,
  "TOPICS_TITLE_MIN_WIDTH",
);
const topicsAdapter = read(
  "src/lib/admin/content/entity-list-adapters/topics.ts",
);
const topicsSortContract = read(
  "src/lib/admin/content/entity-list-contracts/topics.ts",
);
const topicsListConfig = read("src/lib/admin/content/topics-list-config.ts");
check(
  "Required optional columns must be available",
  containsAll(columns, ['key: "id"', 'key: "views"', 'key: "created_at"', 'key: "updated_at"', 'key: "created_by"']),
);
check(
  "Title and actions columns must be fixed",
  /key: "title"[\s\S]*?hideable: false/.test(columns) &&
    /key: "actions"[\s\S]*?hideable: false[\s\S]*?sortable: false[\s\S]*?minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH[\s\S]*?width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH[\s\S]*?sticky: "end"/.test(
      columns,
    ),
);
check(
  "The title must stay a single-line ellipsis link",
  containsAll(columns, ["min-w-0", "flex-1", "truncate", "whitespace-nowrap"]) &&
    columns.includes("adminContentTopicPath(row.id"),
);
check(
  "Topics columns must be produced by the entity-list column factory",
  columns.includes("export function createUnifiedContentColumns") &&
    columns.includes("AdminEntityColumnDef"),
);
check("The list must not render topic slugs", !columns.includes("row.slug"));
check(
  "Topics default columns must use the actual requested render order",
  JSON.stringify(columnFactoryContract.defaultKeys) ===
    JSON.stringify([
      "title",
      "status",
      "content_type",
      "category",
      "series",
      "featured",
      "seo",
      "actions",
    ]),
);
check(
  "Topics compact columns must stay fixed while the title absorbs remaining width",
  /key: "title"[\s\S]*?flexible: true/.test(columns) &&
    containsAll(columns, [
      "TOPICS_COMPACT_COLUMN_WIDTHS.status",
      "TOPICS_COMPACT_COLUMN_WIDTHS.contentType",
      "TOPICS_COMPACT_COLUMN_WIDTHS.category",
      "TOPICS_COMPACT_COLUMN_WIDTHS.featured",
    ]) &&
    JSON.stringify(compactColumnWidths) ===
      JSON.stringify({
        status: 100,
        contentType: 88,
        category: 112,
        series: 180,
        featured: 72,
        seo: 84,
      }) &&
    topicsTitleMinWidth === 152,
);
check(
  "Logical Topics columns must declare shared Asc/Desc sort keys while Actions remains non-sortable",
  [
    ["title", "title"],
    ["status", "status"],
    ["content_type", "content_type"],
    ["category", "category"],
    ["series", "series"],
    ["featured", "featured"],
    ["seo", "seo"],
  ].every(([key, sortKey]) =>
    new RegExp(`key: "${key}"[\\s\\S]*?sortable: true[\\s\\S]*?sortKey: "${sortKey}"`).test(columns),
  ) &&
    ["title", "status", "content_type", "category", "series", "featured", "seo"].every((field) =>
      topicsSortContract.includes(`"${field}"`),
    ) &&
    /key: "actions"[\s\S]*?sortable: false/.test(columns),
);
check(
  "Featured delegates the shared inline Star contract, pending state, mutation, and feedback to existing owners",
  featuredColumnSource.includes("<UnifiedContentRowActions") &&
    featuredColumnSource.includes('display="featured"') &&
    !featuredColumnSource.includes("<button") &&
    !featuredColumnSource.includes("AdminDataGridActionIcon") &&
    unifiedRowActions.includes('display?: "menu" | "visibility" | "featured"') &&
    unifiedRowActions.includes('pendingAction === "featured"') &&
    unifiedRowActions.includes("handlers.onFeatured(row)") &&
    unifiedRowActions.includes("onMutationResult?.(resolved)"),
);
check(
  "Topics rows and metrics must expose one official SEO score through the current owner contract",
  containsAll(loader, [
    "analyzeEntitySeo",
    'profile: row.content_type === "article" ? "article" : "entity"',
    "}).score",
    "seo_score: getUnifiedContentSeoScore(source)",
    "getUnifiedContentSeoScore(row)",
    '.from("admin_content_topics")',
    ".select(CONTENT_LIST_SELECT)",
  ]) &&
    !loader.includes("analyzeTopicSeo") &&
    !loader.includes(".seoScore") &&
    !loader.includes(".overallScore") &&
    topicsAdapter.includes("seo_score: z.number().int().min(0).max(100)") &&
    topicsListConfig.includes('"seo"'),
);

const list = read("src/components/admin/content/UnifiedContentList.tsx");
const topicsPagePath = "src/app/admin/content/topics/page.tsx";
const topicsClientPath = "src/components/admin/content/TopicsListClient.tsx";
const topicsClient = read(topicsClientPath);
const unifiedListPath = "src/components/admin/content/UnifiedContentList.tsx";
const entityListPath = "src/components/admin/entity-list/AdminEntityList.tsx";
const dataEngineClient = read(
  "src/lib/admin/entity-list/data-engine/client-controller.ts",
);
const topicsPage = read(topicsPagePath);
const preferences = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx");
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const rowActions = read("src/components/admin/content/UnifiedContentRowActions.tsx");
const sharedRowActions = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const activityCore = read("src/components/admin/ui/AdminActivityPopover.tsx");
const actions = read("src/app/admin/content/topics/actions.ts");
const topicsFeedback = read("src/lib/admin/content/topics-action-feedback.ts");
const confirmDialog = read("src/components/admin/ui/AdminConfirmDialog.tsx");
const columnMenu = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx");
const floatingMenuPosition = read(
  "src/components/admin/ui/useAdminFloatingMenuPosition.ts",
);
const floatingMenuStyle = read(
  "src/components/admin/ui/admin-floating-position.ts",
);
const pagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const entityListTable = read("src/components/admin/entity-list/AdminEntityListTable.tsx");
const prefsAdapter = read("src/lib/admin/preferences/admin-column-preferences.ts");
const columnPrefs = read("src/lib/admin/entity-list/column-preferences.ts");
const feedbackProvider = read("src/components/admin/AdminFeedbackProvider.tsx");
check(
  "Topics list must consume the shared Admin Entity List System",
  list.includes("AdminEntityList") &&
    entityList.includes("AdminEntityListTable") &&
    entityListTable.includes("<table") &&
    entityListTable.includes("AdminDataGridStickyActionsCell"),
);
check(
  "Topics production route must reach the rendered column factory through the real consumer chain",
  getImportSource(topicsPagePath, "TopicsListClient") ===
    "../../../../components/admin/content/TopicsListClient" &&
    getJsxAttributeValue(
      topicsPagePath,
      "TopicsListClient",
      "initialVisibleColumns",
    ) === "{visibleColumns}" &&
    getImportSource(topicsClientPath, "UnifiedContentList") ===
      "./UnifiedContentList" &&
    getJsxAttributeValue(
      topicsClientPath,
      "UnifiedContentList",
      "initialVisibleColumns",
    ) === "{initialVisibleColumns}" &&
    getImportSource(unifiedListPath, "createUnifiedContentColumns") ===
      "./unified-content-columns" &&
    getJsxAttributeValue(unifiedListPath, "AdminEntityList", "columns") ===
      "{columns}" &&
    getJsxAttributeValue(
      unifiedListPath,
      "AdminEntityList",
      "defaultVisibleColumns",
    ) === "{DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS}" &&
    getImportSource(entityListPath, "AdminEntityListTable") ===
      "./AdminEntityListTable" &&
    getJsxAttributeValue(
      entityListPath,
      "AdminEntityListTable",
      "columns",
    ) === "{visibleColumnDefs}",
);
check(
  "Topics preference reads and writes must honor the current column contract version",
  topicsPage.includes("readAdminColumnPreferences") &&
    topicsPage.includes("contractVersion: TOPICS_COLUMN_CONTRACT_VERSION") &&
    !topicsPage.includes('.from("admin_user_preferences")') &&
    actions.includes("contractVersion: TOPICS_COLUMN_CONTRACT_VERSION") &&
    topicsListConfig.includes("TOPICS_COLUMN_CONTRACT_VERSION = 2") &&
    prefsAdapter.includes("columnContractVersion") &&
    prefsAdapter.includes("contractMatches"),
);
check(
  "Rendered entity columns must expose stable runtime keys for Production UI verification",
  entityListTable.includes("data-admin-column-key={column.key}") &&
    dataGrid.includes("data-admin-column-key={columnKey}") &&
    entityListTable.includes("columnKey={column.key}"),
);
check(
  "Table overflow must remain inside its shared container",
  entityListTable.includes("<AdminDataGrid") && dataGrid.includes("overflow-x-auto"),
);
check(
  "Comfortable Topics geometry must preserve the shared horizontal-scroll and sticky-actions boundary",
  entityListTable.includes(
    "sizingStrategy: AdminEntityListSizingStrategy<TKey>",
  ) &&
    entityListTable.includes('sizingStrategy.mode === "flexible"') &&
    entityListTable.includes("column.key === flexibleColumnKey") &&
    entityListTable.includes("function getColumnMinimumWidth") &&
    entityListTable.includes("return column.minWidth") &&
    entityListTable.includes("const constrainedMinimumWidths = new Map") &&
    46 +
      topicsTitleMinWidth +
      compactColumnWidths.status +
      compactColumnWidths.contentType +
      compactColumnWidths.category +
      compactColumnWidths.series +
      compactColumnWidths.featured +
      compactColumnWidths.seo +
      144 <=
      980 &&
    entityListTable.includes("AdminDataGridStickyActionsCell"),
);
check(
  "Shared Entity List sorting must remain declarative and sort-key typed for every adopter",
  entityListTable.includes("type SortMode<TSortKey extends string>") &&
    entityListTable.includes("onToggle: (sortKey: TSortKey) => void") &&
    entityListTable.includes("sortMode?: SortMode<TSortKey>") &&
    entityListTable.includes("column.sortable") &&
    entityListTable.includes("column.sortKey"),
);
check(
  "Topics sorting must use the current instant query owner without a full reload",
  topicsClient.includes("controller.setSort(") &&
    dataEngineClient.includes('behavior === "replace" ? "replaceState" : "pushState"') &&
    !dataEngineClient.includes("location.reload(") &&
    !dataEngineClient.includes("router.refresh("),
);
check(
  "Bulk actions must use the shared Admin listbox select",
  list.includes("AdminListboxSelect") &&
    entityList.includes("AdminListboxSelect") &&
    !list.includes("<select") &&
    !entityList.includes("<select"),
);
check(
  "Column preferences must persist through the shared menu contract",
  list.includes("onPersistColumns={saveContentTablePreferences}") &&
    preferences.includes("onPersist(next)"),
);
check(
  "Actions must use the shared row action shell and sticky grid capability",
  rowActions.includes("<AdminDataGridRowActions") &&
    sharedRowActions.includes("<AdminDataGridActionsCell") &&
    entityListTable.includes("AdminDataGridStickyActionsCell"),
);
check(
  "Information metadata must be click-only through the shared More menu",
  rowActions.includes("information:") &&
    sharedRowActions.includes('selectedItem.kind === "information"') &&
    sharedRowActions.includes("<AdminActivityContent") &&
    !sharedRowActions.includes("onMouseEnter") &&
    !sharedRowActions.includes("onMouseLeave"),
);
check(
  "Column management must use a viewport-colliding fixed portal",
  columnMenu.includes("createPortal(") &&
    columnMenu.includes("style={menuPosition.style}") &&
    columnMenu.includes("collisionPadding: 12") &&
    columnMenu.includes("estimatedHeight: 458") &&
    !columnMenu.includes("absolute left-0 top-full") &&
    floatingMenuPosition.includes("createAdminFloatingMenuStyle") &&
    floatingMenuStyle.includes('position: "fixed"') &&
    floatingMenuStyle.includes('placement === "bottom" ? top : undefined') &&
    floatingMenuStyle.includes('placement === "top" ? bottom : undefined'),
);
check(
  "Bounded admin surfaces must compose the shared scrollbar visuals",
  columnMenu.includes("scrollAreaClassName") &&
    activityCore.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") &&
    pagination.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES"),
);
check(
  "Publish failures must use shared global entity-list feedback with an editor action",
  !entityList.includes("AdminFeedbackChannelViewport") &&
    entityList.includes("publishFeedback(nextFeedback") &&
    entityList.includes('placement: "global"') &&
    feedbackProvider.includes("data-admin-feedback-viewport") &&
    feedbackProvider.includes('entry.placement === "global"') &&
    feedbackProvider.includes("<AdminNotice") &&
    feedbackProvider.includes("data-admin-feedback-viewport") &&
    list.includes("mapTopicsActionResultToFeedback") &&
    !list.includes('feedback.code === "publish_validation"') &&
    topicsFeedback.includes("mapAdminActionResultToFeedback") &&
    topicsFeedback.includes('result.code === "publish_validation"') &&
    topicsFeedback.includes("adminContentTopicPath(result.entityId") &&
    topicsFeedback.includes("returnTo: context.currentListPath") &&
    actions.includes('"تعذر نشر المحتوى"'),
);
check(
  "Topics deletion must use the shared accessible confirmation dialog",
  rowActions.includes('mode: "shared"') &&
    sharedRowActions.includes("<AdminConfirmDialog") &&
    !rowActions.includes("window.confirm") &&
    confirmDialog.includes('role="dialog"') &&
    confirmDialog.includes('aria-modal="true"') &&
    confirmDialog.includes("FOCUSABLE_SELECTOR") &&
    confirmDialog.includes('event.key === "Escape"') &&
    confirmDialog.includes("returnFocusRef"),
);
check(
  "Preferences must use the generic adapter with Topics view key config",
  actions.includes("saveAdminColumnPreferences") &&
    actions.includes("TOPICS_LIST_VIEW_KEY") &&
    prefsAdapter.includes("admin_user_id: actor.id") &&
    prefsAdapter.includes("view_key: input.viewKey") &&
    !prefsAdapter.includes("content-topics") &&
    !prefsAdapter.includes("Topics"),
);
check(
  "Fixed columns must survive preference sanitization in shared core",
  columnPrefs.includes("!column.hideable") &&
    columnPrefs.includes("visible.push(fixed.key)") &&
    columnPrefs.includes("sanitizeVisibleColumnKeys"),
);

const categoryActions = read("src/app/admin/content/categories/actions.ts");
const colorPicker = read("src/components/admin/content/CategoryColorPicker.tsx");
check("Category colors must be persisted", categoryActions.includes("color_token"));
check("Category color picker must use semantic tones", colorPicker.includes("ADMIN_TONE_PALETTE"));
const tonePalette = loadPureTypeScriptModule("src/lib/admin/content/admin-tone-palette.ts");
check(
  "Database and UI semantic tone allowlists must stay aligned",
  tonePalette.ADMIN_TONE_TOKENS.every((token) =>
    migrationTokenSource().includes(`'${token}'`),
  ),
);

const articleSave = read("src/app/admin/content/topics/article-actions/save.ts");
const articleCreate = read("src/app/admin/content/topics/article-actions/create-domain.ts");
const mediaSave = read("src/app/admin/content/topics/media-actions/save.ts");
const articleModeBranches = findIfElseBranches(
  articleSave,
  "src/app/admin/content/topics/article-actions/save.ts",
  'mode === "create"',
);
const mediaModeBranches = findIfElseBranches(
  mediaSave,
  "src/app/admin/content/topics/media-actions/save.ts",
  'mode === "create"',
);
check(
  "Article create branch must insert both stable creator and updater actor IDs",
  articleModeBranches.then.includes("createArticleDomainRecord({") &&
  containsAll(articleCreate, [
    '.from("topics")',
    ".insert({",
    "created_by: input.actorId",
    "updated_by: input.actorId",
  ]) &&
    !articleModeBranches.then.includes(".update({") &&
    !articleCreate.includes(".update({"),
);
check(
  "Article update branch must update only the stable updater actor ID",
  containsAll(articleModeBranches.else, [
    '.from("topics")',
    ".update({",
    "updated_by: actor.id",
  ]) &&
    !articleModeBranches.else.includes("created_by: actor.id") &&
    !articleModeBranches.else.includes(".insert({"),
);
check(
  "Media create action must insert both stable creator and updater actor IDs",
  containsAll(mediaModeBranches.then, [
    '.from("topics")',
    ".insert({",
    "created_by: actor.id",
    "updated_by: actor.id",
  ]) && !mediaModeBranches.then.includes(".update({"),
);
check(
  "Media update action must update only the stable updater actor ID",
  containsAll(mediaModeBranches.else, [
    '.from("topics")',
    ".update(",
    "updated_by: actor.id",
  ]) &&
    !mediaModeBranches.else.includes("created_by: actor.id") &&
    !mediaModeBranches.else.includes(".insert({"),
);
check(
  "Draft saves must not assign a publisher",
  articleCreate.includes('input.status === "published" ? input.actorId : null') &&
    mediaSave.includes('payload.status === "published" ? actor.id : null'),
);

const migration = read("sql/migrations/20260717070000_unified_content_engine_foundation.sql");
check(
  "Migration must define category colors, actors, preferences, read model, and view counter",
  containsAll(migration, [
    "color_token",
    "created_by",
    "updated_by",
    "published_by",
    "views_count",
    "admin_user_preferences",
    "admin_content_topics",
    "increment_topic_view",
  ]),
);
check("Views must be non-negative", migration.includes("check (views_count >= 0)"));
check(
  "View increments must be atomic and published-only",
  migration.includes("set views_count = views_count + 1") &&
    migration.includes("status = 'published'") &&
    migration.includes("deleted_at is null"),
);

const viewRoute = read("src/app/api/content/topics/[id]/view/route.ts");
const viewTracker = read("src/components/content/TopicViewTracker.tsx");
check("Public view route must accept only a topic ID", viewRoute.includes('rpc("increment_topic_view"'));
check(
  "Client view tracking must deduplicate by session",
  viewTracker.includes("window.sessionStorage.getItem") &&
    viewTracker.includes("window.sessionStorage.setItem"),
);
check(
  "Blocked session storage must not suppress a valid public view",
  !viewTracker.includes("catch {\n      return;"),
);
check(
  "Admin and preview routes must not mount view tracking",
  !editorRoute.includes("TopicViewTracker") &&
    !read("src/app/admin/content/topics/[id]/preview/page.tsx").includes("TopicViewTracker"),
);

const presets = read("src/lib/admin/content-workflow/content-template-presets.ts");
check("Article series must not appear as templates", !presets.includes("من حقك تفهم") && !presets.includes("حكاية بيت"));

const mediaValidation = read("src/app/admin/content/topics/media-actions/validation.ts");
check(
  "Existing inactive media categories must remain editable",
  mediaValidation.includes("currentCategoryId?: number | null") &&
    mediaValidation.includes("normalizedId !== currentCategoryId") &&
    mediaSave.includes("currentTopic?.category_id"),
);
check(
  "Existing inactive article categories must remain editable",
  editorRoute.includes("category.id === topic.category_id") &&
    editorRoute.includes("{ ...category, is_active: true }"),
);

check(
  "Unified bulk action matrix must remain implemented",
  containsAll(actions, [
    'action === "publish"',
    'action === "unpublish"',
    'action === "delete"',
    'action === "move_category"',
    'action === "feature"',
    'action === "unfeature"',
  ]) && !actions.includes('action === "archive"'),
);

const oldAdminRoutePattern = /\/admin\/(?:topics|content\/articles|content\/media|media-center)(?:[/?#"'`]|\b)/;
for (const file of walk(resolve(ROOT, "src"))) {
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)) continue;
  if (oldAdminRoutePattern.test(readFileSync(file, "utf8"))) {
    failures.push(`Old admin route reference in ${relative(ROOT, file).split(sep).join("/")}`);
  }
}

if (failures.length) {
  console.error("FAIL: Unified Content Engine guardrails failed.");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("OK: Unified Content Engine architecture and behavior guardrails passed.");

function migrationTokenSource() {
  return read("sql/migrations/20260717070000_unified_content_engine_foundation.sql");
}
