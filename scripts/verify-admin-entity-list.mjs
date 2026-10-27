/**
 * Architecture acceptance gates for Admin Entity List System v1.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import { compile } from "@tailwindcss/node";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let assertionCount = 0;

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function appearsInOrder(source, tokens) {
  let cursor = -1;
  return tokens.every((token) => {
    cursor = source.indexOf(token, cursor + 1);
    return cursor >= 0;
  });
}

function check(label, condition) {
  assertionCount += 1;
  if (!condition) failures.push(label);
}

// This SSR transport consumes Next-only props before rendering a native anchor;
// production Link policy is asserted separately on the actual owner props.
function SsrNextLink({ prefetch, children, ...props }) {
  void prefetch;
  return React.createElement("a", props, children);
}

function findAdminEntityListConsumers(directory = resolve(ROOT, "src")) {
  const consumers = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      consumers.push(...findAdminEntityListConsumers(path));
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;

    const source = readFileSync(path, "utf8");
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const localEntityListNames = new Set(["AdminEntityList"]);
    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }
      for (const specifier of statement.importClause.namedBindings.elements) {
        if ((specifier.propertyName ?? specifier.name).text === "AdminEntityList") {
          localEntityListNames.add(specifier.name.text);
        }
      }
    }

    function visit(node) {
      const openingElement = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (
        openingElement &&
        localEntityListNames.has(openingElement.tagName.getText(sourceFile))
      ) {
        const sizingAttribute = openingElement.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) &&
            property.name.getText(sourceFile) === "sizingStrategy",
        );
        const position = sourceFile.getLineAndCharacterOfPosition(
          openingElement.getStart(sourceFile),
        );
        consumers.push({
          path,
          line: position.line + 1,
          sizingSource:
            sizingAttribute && ts.isJsxAttribute(sizingAttribute)
              ? sizingAttribute.initializer?.getText(sourceFile) ?? ""
              : "",
        });
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return consumers;
}

function collectPrimaryColumnPresentationDeclarations(
  source,
  sourcePath = "primary-column-presentation-fixture.tsx",
) {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations = [];

  function propertyAssignment(node, name) {
    return node.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(sourceFile) === name,
    );
  }

  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const primary = propertyAssignment(node, "primary");
      const presentation = propertyAssignment(node, "primaryPresentation");
      const declaresPrimary =
        primary?.initializer.kind === ts.SyntaxKind.TrueKeyword;
      if (declaresPrimary || presentation) {
        const position = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        declarations.push({
          sourcePath,
          line: position.line + 1,
          declaresPrimary,
          presentation:
            presentation && ts.isStringLiteral(presentation.initializer)
              ? presentation.initializer.text
              : null,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function findPrimaryColumnPresentationDeclarations(
  directory = resolve(ROOT, "src"),
) {
  const declarations = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      declarations.push(...findPrimaryColumnPresentationDeclarations(path));
      continue;
    }
    if (
      !entry.isFile() ||
      (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) ||
      entry.name.endsWith(".d.ts")
    ) {
      continue;
    }
    declarations.push(
      ...collectPrimaryColumnPresentationDeclarations(
        readFileSync(path, "utf8"),
        path,
      ),
    );
  }
  return declarations;
}

function findJsxUsages(componentName, directory = resolve(ROOT, "src")) {
  const usages = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      usages.push(...findJsxUsages(componentName, path));
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;
    const source = readFileSync(path, "utf8");
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      const openingElement = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const tagName = openingElement?.tagName.getText(sourceFile);
      if (tagName === componentName || tagName?.endsWith(`.${componentName}`)) {
        usages.push(path);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return usages;
}

function loadPureTypeScriptModule(path, dependencies = {}, source = read(path), globals = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", ...Object.keys(globals), output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier) => {
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unsupported dependency ${specifier} while loading ${path}`);
    },
    ...Object.values(globals),
  );
  return commonJsModule.exports;
}

function hasCanonicalDateColumn(source, key) {
  const file = ts.createSourceFile("date-columns.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  const visit = node => {
    if (ts.isObjectLiteralExpression(node)) {
      const property = name => node.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(file) === name)?.initializer;
      const columnKey = property("key"), render = property("renderCell");
      if (columnKey && ts.isStringLiteral(columnKey) && columnKey.text === key && render) {
        const findOwner = child => {
          if ((ts.isJsxSelfClosingElement(child) || ts.isJsxOpeningElement(child)) && child.tagName.getText(file) === "AdminDataGridDateTimeCell") {
            const value = child.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(file) === "value")?.initializer;
            if (value && ts.isJsxExpression(value) && value.expression && ts.isPropertyAccessExpression(value.expression) && value.expression.expression.getText(file) === "row" && value.expression.name.text === key) count += 1;
          }
          ts.forEachChild(child, findOwner);
        };
        findOwner(render);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file); return count === 1;
}

const coreFiles = [
  "src/lib/admin/entity-list/types.ts",
  "src/lib/admin/entity-list/column-preferences.ts",
  "src/lib/admin/entity-list/feedback-codes.ts",
  "src/lib/admin/entity-list/empty-state.ts",
  "src/lib/admin/entity-list/pagination.ts",
  "src/lib/admin/entity-list/url-state.ts",
  "src/lib/admin/entity-list/search-normalization.ts",
  "src/lib/admin/preferences/admin-column-preferences.ts",
  "src/components/admin/entity-list/AdminEntityList.tsx",
  "src/components/admin/entity-list/AdminEntityListTable.tsx",
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
  "src/components/admin/entity-list/AdminEntityListSurface.tsx",
  "src/components/admin/entity-list/AdminFloatingLayerContext.tsx",
  "src/components/admin/ui/AdminBulkActionBar.tsx",
  "src/components/admin/ui/AdminDataGrid.tsx",
  "src/components/admin/ui/AdminDataGridDateTimeCell.tsx",
  "src/components/admin/ui/AdminListEmptyState.tsx",
  "src/components/admin/ui/AdminListboxSelect.tsx",
  "src/components/admin/ui/admin-floating-position.ts",
  "src/components/admin/ui/useAdminFloatingMenuPosition.ts",
  "src/components/admin/ui/admin-scrollbar-styles.ts",
  "src/components/venesia-scrollbar-styles.ts",
];
coreFiles.forEach((path) =>
  check(`Missing entity-list core file: ${path}`, existsSync(resolve(ROOT, path))),
);

const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const entityTable = read("src/components/admin/entity-list/AdminEntityListTable.tsx");
const entityTypes = read("src/lib/admin/entity-list/types.ts");
const primaryPresentationContractSource = entityTypes.match(
  /ADMIN_ENTITY_PRIMARY_COLUMN_PRESENTATIONS\s*=\s*\[([\s\S]*?)\]\s*as const/u,
)?.[1] ?? "";
const PRIMARY_COLUMN_PRESENTATIONS = new Set(
  [...primaryPresentationContractSource.matchAll(/"([^"]+)"/gu)].map(
    (match) => match[1],
  ),
);
const entityFilters = read("src/components/admin/entity-list/AdminEntityListFilters.tsx");
const entitySurface = read("src/components/admin/entity-list/AdminEntityListSurface.tsx");
const metricCardsGrid = read("src/components/admin/ui/AdminMetricCardsGrid.tsx");
const prefsCore = read("src/lib/admin/entity-list/column-preferences.ts");
const paginationCore = read("src/lib/admin/entity-list/pagination.ts");
const prefsAdapter = read("src/lib/admin/preferences/admin-column-preferences.ts");
const listbox = read("src/components/admin/ui/AdminListboxSelect.tsx");
const bulkBar = read("src/components/admin/ui/AdminBulkActionBar.tsx");
const feedbackCodes = read("src/lib/admin/entity-list/feedback-codes.ts");
const feedbackPolicy = read("src/lib/admin/admin-action-feedback.ts");
const feedbackProvider = read("src/components/admin/AdminFeedbackProvider.tsx");
const noticeSource = read("src/components/admin/AdminNotice.tsx");
const noticeFrame = read("src/components/admin/AdminNoticeDismissibleFrame.tsx");
const floatingPosition = read("src/components/admin/ui/admin-floating-position.ts");
const floatingHook = read("src/components/admin/ui/useAdminFloatingMenuPosition.ts");
const columnMenu = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx");
const pagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const activity = read("src/components/admin/ui/AdminActivityPopover.tsx");
const emptyStateCore = read("src/lib/admin/entity-list/empty-state.ts");
const listEmptyState = read("src/components/admin/ui/AdminListEmptyState.tsx");
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const dataGridQueryStatus = read("src/components/admin/ui/AdminDataGridQueryStatus.tsx");
const primaryColumnPresentationDeclarations =
  findPrimaryColumnPresentationDeclarations();
const rowActions = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const scrollbarStyles = read(
  "src/components/admin/ui/admin-scrollbar-styles.ts",
);
const venesiaScrollbarStyles = read(
  "src/components/venesia-scrollbar-styles.ts",
);

const topicsList = read("src/components/admin/content/UnifiedContentList.tsx");
const topicsFilters = read("src/components/admin/content/UnifiedContentFilters.tsx");
const topicsClient = read("src/components/admin/content/TopicsListClient.tsx");
const topicsPage = read("src/app/admin/content/topics/page.tsx");
const categoriesPage = read("src/app/admin/content/categories/page.tsx");
const categoriesListOwner = read("src/lib/admin/content/load-categories-list.ts");
const categoriesListConfigModule = loadPureTypeScriptModule(
  "src/lib/admin/content/categories-list-config.ts",
);
const categoriesClient = read("src/app/admin/content/categories/CategoriesListClient.tsx");
const entityTrashHeader = read(
  "src/components/admin/entity-list/AdminEntityTrashHeader.tsx",
);
const categoriesColumns = read("src/app/admin/content/categories/categories-columns.tsx");
const categoriesActions = read("src/app/admin/content/categories/CategoryRowActions.tsx");
const seriesClient = read("src/app/admin/content/series/SeriesTableClient.tsx");
const trackingCollections = read("src/components/admin/projects/tracking/TrackingCollections.tsx");
const seriesPage = read("src/app/admin/content/series/page.tsx");
const seriesListOwner = read("src/lib/admin/content/load-series-list.ts");
const seriesListConfigModule = loadPureTypeScriptModule(
  "src/lib/admin/content/series-list-config.ts",
);
const seriesColumns = read("src/app/admin/content/series/series-columns.tsx");
const unifiedContentColumns = read(
  "src/components/admin/content/unified-content-columns.tsx",
);
const categoriesListConfig = read(
  "src/lib/admin/content/categories-list-config.ts",
);
const seriesListConfig = read("src/lib/admin/content/series-list-config.ts");
const pagesListConfig = read("src/lib/admin/pages/pages-list-config.ts");
const projectsListConfig = read(
  "src/lib/admin/projects/projects-list-config.ts",
);
const projectsListAdapter = read(
  "src/lib/admin/projects/entity-list-adapter.ts",
);
const residentialProjectsPage = read(
  "src/app/admin/projects/residential/page.tsx",
);
const commercialProjectsPage = read(
  "src/app/admin/projects/commercial/page.tsx",
);
const projectPublishingMigration = read(
  "sql/migrations/20260803120000_project_publishing_visibility_capability.sql",
);
const activityLogClient = read("src/app/admin/activity-log/ActivityLogClient.tsx");
const activityLogPage = read("src/app/admin/activity-log/page.tsx");
const activityLogPreferences = read(
  "src/app/admin/activity-log/column-preferences.ts",
);
const topicsWithoutImageClient = read(
  "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
);
const topicsWithoutImagePage = read(
  "src/app/admin/reports/topics-without-image/page.tsx",
);
const topicsWithoutImagePreferences = read(
  "src/app/admin/reports/topics-without-image/column-preferences.ts",
);
const collectionAdoptionManifest = read(
  "src/lib/admin/interaction-system/adoption-manifest.ts",
);
const pageCompositionColumnConfig = read(
  "src/lib/page-blocks/admin-collection-columns.ts",
);
const pageCompositionColumnActions = read(
  "src/app/admin/pages-blocks/column-preferences.ts",
);
const pageBlockAdminUtils = read("src/lib/page-blocks/admin-utils.ts");
const pagesClient = read(
  "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
);
const bulkActionLabels = read(
  "src/lib/admin/entity-list/bulk-action-labels.ts",
);
const menusClient = read(
  "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
);
const blockModuleManager = read(
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
);
const heroManager = read(
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
);
const contentBlocksClient = read(
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
);

check(
  "Topics/Categories/Series must consume AdminEntityList",
  topicsList.includes("AdminEntityList") &&
    categoriesClient.includes("AdminEntityList") &&
    seriesClient.includes("AdminEntityList"),
);

check(
  "Consumers must use AdminEntityListSurface + AdminEntityListFilters",
  topicsClient.includes("AdminEntityListSurface") &&
    topicsPage.includes("TopicsListClient") &&
    topicsFilters.includes("AdminEntityListFiltersProps") &&
    topicsList.includes("toolbar={toolbar}") &&
    categoriesClient.includes("AdminEntityListSurface") &&
    categoriesClient.includes("toolbar={{") &&
    seriesClient.includes("AdminEntityListSurface") &&
    seriesClient.includes("toolbar={{") &&
    entitySurface.includes("AdminFloatingLayerProvider") &&
    entityList.includes("<AdminEntityListFilters") &&
    entityFilters.includes("<VenesiaModal"),
);

check(
  "Shared metric cards wrap responsively while retaining compensated hover-glow bleed",
  metricCardsGrid.includes('data-admin-metric-cards-viewport=""') &&
    metricCardsGrid.includes("-mt-8") && metricCardsGrid.includes("pt-8") &&
    metricCardsGrid.includes("ADMIN_CINEMATIC_GOLD_V1.metric.gridClassName") &&
    !metricCardsGrid.includes("overflow-x-auto") &&
    !metricCardsGrid.includes("z-") &&
    !topicsClient.includes('className="min-w-[1146px]"') &&
    !topicsClient.includes(
      '<AdminEntityListPrimarySection className="overflow-x-auto',
    ),
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

const adminEntityListConsumers = findAdminEntityListConsumers();
const directEntityListTableUsages = findJsxUsages("AdminEntityListTable");
check(
  "Every AdminEntityList consumer declares a fail-closed sizing strategy",
  adminEntityListConsumers.length > 0 &&
    adminEntityListConsumers.every(({ sizingSource }) =>
      /mode:\s*"(?:flexible|fixed)"/.test(sizingSource),
    ) &&
    adminEntityListConsumers.every(({ sizingSource }) =>
      sizingSource.includes('mode: "fixed"')
        ? !sizingSource.includes("columnKey")
        : /mode:\s*"flexible"[\s\S]*columnKey:\s*(?:"[^"]+"|[A-Za-z_$][\w$]*)/.test(
            sizingSource,
          ),
    ) &&
    entityList.includes("assertAdminEntityListContracts") &&
    entityList.includes("flexibleColumns.length !== 1") &&
    entityList.includes(
      "flexibleColumns[0]?.key !== input.sizingStrategy.columnKey",
    ) &&
    entityList.includes("fixed sizing cannot declare a flexible column") &&
    entityList.includes("const visibleSizingStrategy:") &&
    entityList.includes(': { mode: "fixed" }') &&
    entityTable.includes("sizingStrategy: AdminEntityListSizingStrategy<TKey>") &&
    entityTable.includes('sizingStrategy.mode === "flexible"') &&
    !entityList.includes("implicitFlexibleColumn") &&
    !entityTable.includes("implicitFlexibleColumn"),
);

check(
  "AdminEntityListTable cannot be adopted outside the shared AdminEntityList owner",
  directEntityListTableUsages.length === 1 &&
    directEntityListTableUsages[0] ===
      resolve(ROOT, "src/components/admin/entity-list/AdminEntityList.tsx"),
);

check(
  "Entity List declarations execute without implicit Primary or width precedence",
  entityList.includes("exactly one primary column is required") &&
    entityList.includes(
      "the primary column must explicitly declare a supported primaryPresentation",
    ) &&
    entityList.includes(
      "only the primary column may declare primaryPresentation",
    ) &&
    entityList.includes('must explicitly declare sticky: "start"') &&
    entityList.includes("column keys must be unique") &&
    entityList.includes("sticky end-adjacent columns must form one contiguous tail") &&
    entityTable.indexOf("column.key === flexibleColumnKey") <
      entityTable.indexOf("column.primary && column.key !== flexibleColumnKey") &&
    !entityTable.includes('column.primary || column.sticky === "start"'),
);

check(
  "Sortable Entity List columns fail closed without sort state and behavior",
  entityList.includes("const hasSortableColumn =") &&
    entityList.includes("hasSortableColumn && !input.sortMode") &&
    entityList.includes(
      "sortable columns require an explicit sort mode",
    ),
);

check(
  "Entity List exposes opt-in surface fill through a presentation-only spacer track",
  entityTable.includes("fillAvailableWidth?: boolean") &&
    entityTable.includes("fillAvailableWidth = false") &&
    entityTable.includes(
      "const showFillSpacer = fillAvailableWidth && flexibleColumnKey === undefined",
    ) &&
    entityTable.includes("data-admin-table-fill-spacer") &&
    entityTable.includes("const fillsAvailableWidth =") &&
    entityTable.includes("availableTableWidth ?? preferredTableWidth") &&
    entityList.includes("fillAvailableWidth?: boolean") &&
    entityList.includes("fillAvailableWidth={fillAvailableWidth}"),
);

check(
  "Shared toolbar and Data Grid keep standalone surfaces while supporting an opt-in embedded surface",
  entityFilters.includes('surface?: "standalone" | "embedded"') &&
    entityFilters.includes('surface = "standalone"') &&
    entityFilters.includes('surface === "embedded"') &&
    entityFilters.includes("data-admin-collection-toolbar-surface={surface}") &&
    dataGrid.includes('surface?: "standalone" | "embedded"') &&
    dataGrid.includes('surface = "standalone"') &&
    dataGrid.includes("data-admin-data-grid-surface={surface}") &&
    dataGrid.includes('const embedded = surface === "embedded"'),
);

check(
  "Collection frame owns toolbar adjacency and the shared joined card seam",
  entitySurface.includes("export function AdminEntityListTableFrame") &&
    entitySurface.includes('toolbar ? "gap-0" : "gap-7"') &&
    appearsInOrder(entitySurface, ["data-admin-entity-list-table-frame", "{toolbar}", "{children}"]) &&
    entitySurface.includes('ADMIN_ENTITY_LIST_JOINED_TABLE_CLASS = "!rounded-t-none !border-t-0"') &&
    entityList.includes("<AdminEntityListTableFrame") &&
    entityList.includes("toolbar ? ADMIN_ENTITY_LIST_JOINED_TABLE_CLASS : undefined"),
);

const coreSources = [
  entityList,
  entityTable,
  entityFilters,
  entitySurface,
  prefsCore,
  paginationCore,
  listbox,
  feedbackCodes,
  floatingPosition,
  floatingHook,
  emptyStateCore,
  read("src/lib/admin/entity-list/types.ts"),
  read("src/lib/admin/entity-list/url-state.ts"),
];

check(
  "Shared core must not import Topics/Categories/Series/Supabase domain owners",
  coreSources.every(
    (source) =>
      !source.includes("topics/actions") &&
      !source.includes("UnifiedContent") &&
      !source.includes('from "@supabase') &&
      !source.includes("getSupabaseAdmin") &&
      !source.includes("content-topics") &&
      !source.includes("content-categories") &&
      !source.includes("content-series") &&
      !/\bTopics\b/.test(source) &&
      !/\bCategories\b/.test(source) &&
      !/\bSeries\b/.test(source) &&
      !source.includes("topic_categories") &&
      !source.includes("topic_series"),
  ),
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
  [listbox, columnMenu, pagination, activity].every(
    (source) =>
      source.includes("useAdminFloatingMenuPosition") &&
      /style=\{\w+\.style\}/.test(source),
  ) &&
    listbox.includes("ADMIN_FILTER_MENU_SCROLLBAR_CLASSES") &&
    listbox.includes('data-admin-listbox-scroll-viewport=""') &&
    listbox.includes("min-h-0 flex-1") &&
    listbox.includes("flex max-h-[calc(100dvh-24px)] flex-col") &&
    floatingPosition.includes('position: "fixed"') &&
    floatingPosition.includes('placement === "bottom" ? top : undefined') &&
    floatingPosition.includes('placement === "top" ? bottom : undefined') &&
    floatingPosition.includes("maxHeight"),
);

check(
  "Shared DataGrid owns one labelled horizontal-scroll and scrollbar contract",
  dataGrid.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") &&
    dataGrid.includes('scrollLabel = "منطقة بيانات الإدارة"') &&
    dataGrid.includes('role="region"') &&
    dataGrid.includes("tabIndex={0}") &&
    !dataGrid.includes("[scrollbar-width:thin]") &&
    scrollbarStyles.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") &&
    !scrollbarStyles.includes("[&::-webkit-scrollbar]:h-1.5") &&
    venesiaScrollbarStyles.includes('VENESIA_SCROLLBAR_VISUAL_CLASSES = "venesia-scrollbar"') &&
    entityTable.includes("scrollLabel?: string") &&
    entityTable.includes("scrollLabel={scrollLabel}") &&
    !entityTable.includes("max-w-full overflow-hidden"),
);

check(
  "Shared DataGrid owns compact cell geometry and default logical dividers once",
  dataGrid.includes(
    "cellInlinePaddingPx: ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.cellInlinePaddingPx",
  ) &&
    dataGrid.includes('cellInlinePadding: "px-1.5"') &&
    dataGrid.includes("ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES") &&
    dataGrid.includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES") &&
    dataGrid.includes("[&>*+*]:border-s") &&
    dataGrid.includes("[&>*+*]:border-[#D8B87A]/18") &&
    dataGrid.includes("[&>*+*]:border-white/8") &&
    entityTable.includes("ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES") &&
    entityTable.includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES") &&
    !entityTable.includes("whitespace-nowrap px-4 py-4") &&
    !entityTable.includes("border-b border-white/8 px-4 py-4"),
);

check(
  "Shared primary presentation contract owns logical inset independently from numeric width",
  entityTypes.includes("ADMIN_ENTITY_PRIMARY_COLUMN_PRESENTATIONS") &&
    entityTypes.includes('"text-only"') &&
    entityTypes.includes('"compact-icon"') &&
    entityTypes.includes('"standard-icon"') &&
    entityTypes.includes('"hierarchy"') &&
    entityTypes.includes(
      "primaryPresentation: AdminEntityPrimaryColumnPresentation",
    ) &&
    dataGrid.includes("textOnlyCellInlinePaddingPx: 20") &&
    dataGrid.includes(
      "ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textOnlyCellInlinePaddingPx * 2",
    ) &&
    dataGrid.includes("ADMIN_DATA_GRID_PRIMARY_PRESENTATION_CONTRACT") &&
    dataGrid.includes("getAdminDataGridPrimaryPresentationStyle") &&
    entityTable.includes("column.primaryPresentation") &&
    entityTable.includes("getAdminDataGridPrimaryPresentationStyle") &&
    entityTable.includes("if (!column.primary) return trackStyle") &&
    !entityTable.includes("usesTextOnlyPrimaryPreset") &&
    !entityTable.includes(
      "column.minWidth === ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS",
    ) &&
    !entityTable.includes(
      "column.width === ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS",
    ),
);

check(
  "Every primary-column consumer explicitly adopts one supported presentation",
  primaryColumnPresentationDeclarations.length > 0 &&
    primaryColumnPresentationDeclarations.every(
      (declaration) =>
        declaration.declaresPrimary &&
        PRIMARY_COLUMN_PRESENTATIONS.has(declaration.presentation),
    ),
);

const missingPrimaryPresentationFixture =
  collectPrimaryColumnPresentationDeclarations(
    'const columns = [{ primary: true, minWidth: 240, renderCell: () => null }];',
  );
const invalidPrimaryPresentationFixture =
  collectPrimaryColumnPresentationDeclarations(
    'const columns = [{ primary: true, primaryPresentation: "wide", minWidth: 240, renderCell: () => null }];',
  );
const nonPrimaryPresentationFixture =
  collectPrimaryColumnPresentationDeclarations(
    'const columns = [{ primaryPresentation: "text-only", minWidth: 240, renderCell: () => null }];',
  );

check(
  "Primary presentation guard rejects missing, invalid, and non-primary declarations",
  missingPrimaryPresentationFixture.length === 1 &&
    missingPrimaryPresentationFixture[0].presentation === null &&
    invalidPrimaryPresentationFixture.length === 1 &&
    !PRIMARY_COLUMN_PRESENTATIONS.has(
      invalidPrimaryPresentationFixture[0].presentation,
    ) &&
    nonPrimaryPresentationFixture.length === 1 &&
    !nonPrimaryPresentationFixture[0].declaresPrimary,
);

check(
  "Columns control is official whenever persistence is declared",
  entityList.includes("onPersistColumns ? (") &&
    !entityList.includes("enableColumnManagement && onPersistColumns") &&
    entityList.includes("official control is always rendered") &&
    columnMenu.includes('label = "الأعمدة"') &&
    columnMenu.includes("data-default-columns={defaultColumns.join(\",\")}"),
);

check(
  "Declarative columns expose logical alignment without entity coupling",
  read("src/lib/admin/entity-list/types.ts").includes(
    'AdminEntityColumnAlignment = "start" | "center" | "end"',
  ) &&
    entityTable.includes(
      "column.align ?? (column.primary ? \"start\" : \"center\")",
    ),
);

check(
  "Shared Row Actions uses the one vertical More icon and bounded scrollbar owner",
  dataGrid.includes('<circle cx="12" cy="5" r="1.7" />') &&
    dataGrid.includes('<circle cx="12" cy="12" r="1.7" />') &&
    dataGrid.includes('<circle cx="12" cy="19" r="1.7" />') &&
    !dataGrid.includes('<circle cx="5" cy="12"') &&
    !dataGrid.includes('<circle cx="19" cy="12"') &&
    rowActions.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") &&
    rowActions.includes("overflow-y-auto overflow-x-hidden overscroll-contain"),
);

check(
  "Shared Pagination auto-hides from the current page size and reuses the scrollbar owner",
  pagination.includes("totalCount > currentPageSize") &&
    !pagination.includes("getMinPageSize") &&
    !pagination.includes("forceShowSummary") &&
    pagination.includes("ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE_OPTIONS") &&
    pagination.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") &&
    pagination.includes("buildAdminEntityListHref"),
);
check(
  "Collection owner groups table and pagination while controls remain outside Busy state",
  entitySurface.includes("AdminEntityListTableRegion") &&
    entitySurface.includes('TABLE_REGION_LAYOUT_CLASSES = "flex flex-col gap-4"') &&
    pagination.includes("computePageRange") &&
    pagination.includes("buildAdminEntityListHref") &&
    !pagination.includes("pending?: boolean") &&
    !pagination.includes("disabled={pending") &&
    pagination.includes('data-admin-table-pagination-busy="false"') &&
    pagination.includes('data-admin-table-pagination=""') &&
    [topicsClient, categoriesClient, seriesClient].every(
      (source) =>
        source.includes("AdminEntityListTableRegion") &&
        !source.includes("pending={controller.queryPending}") &&
        !source.includes("pending: controller.queryPending"),
    ),
);
check(
  "Query feedback belongs inside DataGrid while TableRegion retains its original layout",
  dataGrid.includes('import AdminDataGridQueryStatus from "./AdminDataGridQueryStatus"') &&
    appearsInOrder(dataGrid, [
      'data-admin-data-grid-scroll=""',
      '{children}',
      '{queryPending ? <AdminDataGridQueryStatus /> : null}',
    ]) && appearsInOrder(dataGridQueryStatus, [
    'role="status"',
    'aria-live="polite"',
    'data-admin-data-grid-query-status=""',
    'data-admin-data-grid-query-indicator=""',
    "الصفوف والعدّادات المعروضة تخص النتائج السابقة.",
  ]) &&
    !entitySurface.includes('role="status"') &&
    !entitySurface.includes("queryPending") &&
    !/\b(?:inert|disabled|aria-busy)=/u.test(entitySurface),
);
check(
  "Retained query rows are distinguished through the existing shared table chain",
  [entityList, entityTable, topicsList].every(
    (source) => source.includes("queryPending?: boolean") && source.includes("queryPending={queryPending}"),
  ) &&
    entityTable.includes('<tbody className={queryPending ? "opacity-35" : undefined}>') &&
    [topicsClient, categoriesClient, seriesClient].every(
      (source) => source.includes("queryPending={controller.queryPending}"),
    ) &&
    (trackingCollections.match(/queryPending=\{controller\.queryPending\}/gu)?.length ?? 0) ===
      (trackingCollections.match(/<AdminEntityListTableRegion\b/gu)?.length ?? 0),
);

check(
  "Feedback notices resolve through shared contract",
  feedbackCodes.includes("resolveAdminNoticeFeedback") &&
    topicsPage.includes("resolveAdminNoticeFeedback") &&
    categoriesPage.includes("resolveAdminNoticeFeedback") &&
    seriesPage.includes("resolveAdminNoticeFeedback"),
);

check(
  "Feedback lifecycle keeps action outcomes visible until dismissal and system errors persistent",
  feedbackCodes.includes("getAdminFeedbackPolicy") &&
    feedbackCodes.includes('"transient_action"') &&
    feedbackCodes.includes('"action_validation"') &&
    feedbackPolicy.includes('lifecycle: "manual"') &&
    feedbackPolicy.includes('lifecycle: "persistent"') &&
    !feedbackPolicy.includes('lifecycle: "auto"') &&
    !feedbackPolicy.includes("autoDismissMs: 5_000") &&
    (feedbackPolicy.match(/dismissible: true/g)?.length ?? 0) === 3 &&
    noticeSource.includes("dismissible = true") &&
    noticeFrame.includes('data-admin-notice-dismissible="true"') &&
    noticeFrame.includes("const DEFAULT_DISMISS_SEARCH_PARAMS = [") &&
    ["notice", "message", "error"].every((param) =>
      noticeFrame.includes(`"${param}",`),
    ) &&
    noticeFrame.includes(
      "dismissSearchParams = DEFAULT_DISMISS_SEARCH_PARAMS",
    ) &&
    noticeFrame.includes("border-white/30") &&
    noticeFrame.includes("cursor-pointer") &&
    noticeFrame.includes("url.searchParams.delete(param)") &&
    noticeFrame.includes("window.history.replaceState") &&
    !noticeFrame.includes("window.setTimeout(dismiss") &&
    noticeFrame.includes('aria-label="إغلاق الإشعار"'),
);

function verifyNoticeDismissSpace(source, frameSource) {
  const Frame = loadPureTypeScriptModule(
    "src/components/admin/AdminNoticeDismissibleFrame.tsx",
    { react: { useCallback: callback => callback, useState: initial => [initial, () => {}] } },
    frameSource,
  ).default;
  const Notice = loadPureTypeScriptModule(
    "src/components/admin/AdminNotice.tsx",
    { "next/link": { default: SsrNextLink }, "./AdminNoticeDismissibleFrame": { default: Frame } },
    source,
  ).default;
  const message = "استُعيدت المسودة محليًا. راجع التغييرات ثم احفظها عند الاستعداد.";
  const noticeElement = props => {
    const element = Notice({ message, ...props });
    return element.type === Frame ? Frame(element.props) : element;
  };
  const closeButton = element => React.Children.toArray(element.props.children).find(child => React.isValidElement(child) && child.type === "button");
  for (const variant of ["success", "warning", "danger", "info"]) {
    const stacked = noticeElement({ variant });
    const button = closeButton(stacked);
    assert.ok(button, "Default stacked notice retains its native dismiss control");
    assert.match(stacked.props.className, /\brelative pl-14\b/u, "Stacked notice reserves physical left space for its physical left dismiss button");
    assert.doesNotMatch(stacked.props.className, /\b(?:ps|pe|pr)-14\b/u);
    assert.match(button.props.className, /\babsolute left-3 top-3\b/u);
    assert.match(button.props.className, /\bh-9 w-9\b/u);
    assert.equal(button.props.type, "button");
    assert.equal(button.props["aria-label"], "إغلاق الإشعار");
    const inline = noticeElement({ variant, layout: "inline" });
    assert.match(inline.props.className, /\bflex min-w-0 flex-nowrap\b/u);
    assert.doesNotMatch(inline.props.className, /\b(?:pl|ps|pe|pr)-14\b/u);
    assert.doesNotMatch(closeButton(inline).props.className, /\babsolute\b/u);
    const nondismissible = noticeElement({ variant, dismissible: false });
    assert.equal(closeButton(nondismissible), undefined);
    assert.doesNotMatch(nondismissible.props.className, /\b(?:relative|pl-14|ps-14)\b/u);
    assert.match(nondismissible.props.className, /\bpx-5 py-4\b/u);
  }
}
verifyNoticeDismissSpace(noticeSource, noticeFrame);
check("Actual Notice and Frame owners reserve matching physical-left stacked dismiss space while preserving inline and nondismissible controls", true);
const noticeSpaceMutations = [
  ["logical-start spacing in RTL", noticeSource.replace("relative pl-14", "relative ps-14"), noticeFrame],
  ["missing reserved close space", noticeSource.replace("relative pl-14", "relative"), noticeFrame],
  ["button moved away from reserved space", noticeSource, noticeFrame.replace("absolute left-3 top-3", "absolute right-3 top-3")],
  ["stacked padding leaked to inline", noticeSource.replace("flex min-w-0 flex-nowrap", "pl-14 flex min-w-0 flex-nowrap"), noticeFrame],
  ["dismiss padding leaked to nondismissible", noticeSource.replace(": stackedClassName;", ': `${stackedClassName} pl-14`;'), noticeFrame],
];
for (const [name, source, frame] of noticeSpaceMutations) {
  assert.ok(source !== noticeSource || frame !== noticeFrame, `Applied Notice mutation ${name}`);
  assert.throws(() => verifyNoticeDismissSpace(source, frame), { name: "AssertionError" });
  check(`Notice spacing negative rejects ${name}`, true);
}
function verifyNoticeComposedContent(source, frameSource) {
  const dismissWrites = [];
  let dismissCalls = 0;
  const Frame = loadPureTypeScriptModule(
    "src/components/admin/AdminNoticeDismissibleFrame.tsx",
    { react: { useCallback: callback => callback, useState: initial => [initial, value => dismissWrites.push(value)] } },
    frameSource,
  ).default;
  const Notice = loadPureTypeScriptModule(
    "src/components/admin/AdminNotice.tsx",
    { "next/link": { default: SsrNextLink }, "./AdminNoticeDismissibleFrame": { default: Frame } },
    source,
  ).default;
  const children = React.createElement("div", { "data-notice-composed": true },
    React.createElement("p", null, "مسودة محلية"), React.createElement("time", { dateTime: "2026-10-24T00:00:00.000Z" }, "24 أكتوبر"),
    React.createElement("button", { type: "button" }, "استعادة"), React.createElement("button", { type: "button" }, "تجاهل"));
  const element = Notice({ message: "Fallback message", children, dismissSearchParams: [], lifecycle: "manual", onDismiss: () => { dismissCalls++; } });
  assert.equal(element.type, Frame, "Composed content retains the canonical dismiss frame");
  assert.equal(element.props.children, children, "Composed content is forwarded without copying or losing actions");
  const rendered = Frame(element.props);
  const close = React.Children.toArray(rendered.props.children).find(child => React.isValidElement(child) && child.type === "button");
  assert.ok(close, "Only the existing Frame owns Close");
  close.props.onClick();
  assert.deepEqual(dismissWrites, [true]);
  assert.equal(dismissCalls, 1, "Canonical Close forwards the caller's UI-only dismissal");
  const plain = Notice({ message: "Fallback message", children, dismissible: false });
  assert.equal(plain.props.children, children);
  const fallback = Notice({ message: "Fallback message", title: "Existing title", dismissible: false, action: { href: "/admin/content", label: "Existing action" } });
  const html = renderToStaticMarkup(fallback);
  assert.ok(html.includes("Fallback message") && html.includes("Existing title") && html.includes("Existing action") && html.includes('href="/admin/content"'), "Omitted content keeps the existing message/title/link contract");
}
verifyNoticeComposedContent(noticeSource, noticeFrame);
check("Actual Notice composed content reuses canonical Close and leaves omitted/default message consumers unchanged", true);
for (const [label, from, to] of [
  ["composed content dropped", "const content = children ?? (", "const content = undefined ?? ("],
  ["composed dismissal callback disconnected", "onDismiss={onDismiss}", "onDismiss={undefined}"],
]) {
  assert.ok(noticeSource.includes(from), `Notice composition mutation must change actual source: ${label}`);
  assert.throws(() => verifyNoticeComposedContent(noticeSource.replace(from, to), noticeFrame), { name: "AssertionError" });
  check(`Notice composed content rejects ${label}`, true);
}

function verifyCompactNoticePresentation(source, frameSource) {
  const writes = [];
  let dismissals = 0;
  const Frame = loadPureTypeScriptModule(
    "src/components/admin/AdminNoticeDismissibleFrame.tsx",
    { react: { useCallback: callback => callback, useState: initial => [initial, value => writes.push(value)] } }, frameSource,
  ).default;
  const Notice = loadPureTypeScriptModule(
    "src/components/admin/AdminNotice.tsx",
    { "next/link": { default: SsrNextLink }, "./AdminNoticeDismissibleFrame": { default: Frame } }, source,
  ).default;
  const nodes = element => {
    const result = [];
    const visit = value => React.Children.forEach(value, child => {
      if (!React.isValidElement(child)) return;
      result.push(child); visit(child.props.children);
    });
    visit(element); return result;
  };
  const message = "توجد مسودة محلية لم تتخذ قرارًا بشأنها";
  const actions = React.createElement(React.Fragment, null,
    React.createElement("time", { dateTime: "2026-10-24T00:00:00.000Z" }, "24 أكتوبر"),
    React.createElement("button", { type: "button", "data-compact-action": true }, "تجاهل هذه المسودة"));
  const details = React.createElement("div", { "data-compact-conflict": true }, "تفاصيل التعارض");
  for (const variant of ["success", "warning", "danger", "info"]) {
    const element = Notice({ message, variant, presentation: "compact", actionContent: actions, children: details, dismissSearchParams: [], lifecycle: "manual", onDismiss: () => { dismissals++; } });
    assert.equal(element.type, Frame, "Compact notices reuse the current dismiss owner");
    const rendered = Frame(element.props), all = nodes(rendered);
    assert.equal(rendered.props["data-admin-notice-presentation"], "compact");
    assert.equal(rendered.props.role, variant === "danger" ? "alert" : "status");
    assert.match(rendered.props.className, /grid-cols-\[minmax\(0,1fr\)_auto\]/u);
    assert.doesNotMatch(rendered.props.className, /\bpl-14\b/u);
    const row = all.find(node => node.props["data-admin-notice-row"] !== undefined);
    const icon = all.find(node => node.props["data-admin-notice-icon"] !== undefined);
    const text = all.find(node => node.props["data-admin-notice-message"] !== undefined);
    const actionRow = all.find(node => node.props["data-admin-notice-actions"] !== undefined);
    const below = all.find(node => node.props["data-admin-notice-details"] !== undefined);
    assert.ok(row && icon && text && actionRow && below);
    assert.match(row.props.className, /flex-col.*lg:flex-row.*lg:items-center/u);
    assert.match(text.props.className, /min-w-0.*lg:truncate.*lg:whitespace-nowrap/u);
    assert.equal(text.props.title, message, "The complete message remains available when narrow Desktop truncates");
    assert.equal(icon.type, "svg"); assert.equal(icon.props["aria-hidden"], "true");
    assert.equal(icon.props["data-admin-notice-icon"], variant);
    assert.match(actionRow.props.className, /flex-wrap.*lg:flex-nowrap/u);
    assert.equal(actionRow.props.children[0], actions, "State-specific controls are passed intact into the shared row");
    assert.equal(below.props.children, details, "Conflict details stay below the compact status row");
    const close = React.Children.toArray(rendered.props.children).find(child => React.isValidElement(child) && child.type === "button");
    assert.ok(close); assert.doesNotMatch(close.props.className, /\babsolute\b/u);
    assert.equal(close.props.type, "button"); assert.equal(close.props["aria-label"], "إغلاق الإشعار");
    const html = renderToStaticMarkup(rendered);
    assert.ok(html.indexOf("data-admin-notice-icon") < html.indexOf("data-admin-notice-message") && html.indexOf("data-admin-notice-message") < html.indexOf("data-admin-notice-actions"));
    close.props.onClick();
    const bare = Frame(Notice({ message, presentation: "compact", dismissSearchParams: [] }).props);
    assert.ok(!nodes(bare).some(node => node.props["data-admin-notice-actions"] !== undefined), "Non-action states have no empty action rail");
  }
  assert.deepEqual(writes, [true, true, true, true]); assert.equal(dismissals, 4);
  const defaultNotice = Frame(Notice({ message }).props);
  assert.equal(defaultNotice.props["data-admin-notice-presentation"], undefined);
  assert.ok(!nodes(defaultNotice).some(node => node.props["data-admin-notice-row"] !== undefined), "Omitted presentation never adopts the compact row");
}
verifyCompactNoticePresentation(noticeSource, noticeFrame);
check("Actual opt-in compact Notice renders icon/message/actions/Close in one responsive owner and keeps details below without changing default consumers", true);
for (const [label, sourceFrom, sourceTo, frameFrom, frameTo] of [
  ["compact opt-in disabled", 'presentation === "compact"', "false", "", ""],
  ["status icon removed", 'data-admin-notice-icon={variant}', 'data-removed-status-icon={variant}', "", ""],
  ["desktop row stacks", "lg:flex-row lg:items-center lg:gap-3", "lg:flex-col lg:items-center lg:gap-3", "", ""],
  ["message wraps on desktop", "lg:truncate lg:whitespace-nowrap", "lg:whitespace-normal", "", ""],
  ["compact controls dropped", "{actionContent}", "{null}", "", ""],
  ["details dropped", '{children}</div> : null}', '{null}</div> : null}', "", ""],
  ["compact close becomes absolute", "", "", '"mt-0.5 flex h-9', '"absolute mt-0.5 flex h-9'],
]) {
  const changedSource = sourceFrom ? noticeSource.replace(sourceFrom, sourceTo) : noticeSource;
  const changedFrame = frameFrom ? noticeFrame.replace(frameFrom, frameTo) : noticeFrame;
  assert.ok(changedSource !== noticeSource || changedFrame !== noticeFrame, `Compact negative mutates current source: ${label}`);
  assert.throws(() => verifyCompactNoticePresentation(changedSource, changedFrame), { name: "AssertionError" });
  check(`Compact Notice rejects ${label}`, true);
}

check(
  "Entity-list feedback uses the shared global viewport without a reserved collection slot",
  feedbackProvider.includes("AdminFeedbackViewport") &&
    feedbackProvider.includes("AdminFeedbackChannelViewport") &&
    feedbackProvider.includes("data-admin-feedback-viewport") &&
    feedbackProvider.includes("data-admin-entity-feedback-slot") &&
    feedbackProvider.includes("fixed") &&
    feedbackProvider.includes('entry.placement === "global"') &&
    feedbackProvider.includes('placement?: "global" | "inline"') &&
    feedbackProvider.includes('return placement === "inline" ? (') &&
    !feedbackProvider.includes("data-admin-feedback-layout-stable") &&
    !feedbackProvider.includes("stabilizeLayout") &&
    !feedbackProvider.includes('h-[72px]') &&
    entityList.includes("useAdminFeedback") &&
    entityList.includes("publishFeedback(nextFeedback") &&
    entityList.includes('placement: "global"') &&
    !entityList.includes("AdminFeedbackChannelViewport") &&
    categoriesClient.includes("initialFeedback={initialFeedback}") &&
    seriesClient.includes("initialFeedback={initialFeedback}") &&
    topicsList.includes("initialFeedback={initialFeedback}") &&
    !categoriesPage.includes("{noticeFeedback ? (") &&
    !seriesPage.includes("{noticeFeedback ? (") &&
    !topicsPage.includes("{noticeFeedback ? ("),
);

check(
  "Entity-list feedback auto-reveal is visibility-aware, event-stable, and reduced-motion safe",
  feedbackProvider.includes("latestEntry?.reveal") &&
    feedbackProvider.includes("getBoundingClientRect") &&
    feedbackProvider.includes("rect.bottom > 0 && rect.top < window.innerHeight") &&
    feedbackProvider.includes("window.matchMedia") &&
    feedbackProvider.includes("(prefers-reduced-motion: reduce)") &&
    feedbackProvider.includes('behavior: prefersReducedMotion ? "auto" : "smooth"') &&
    feedbackProvider.includes('block: "nearest"') &&
    feedbackProvider.includes("focus({ preventScroll: true })"),
);

check(
  "Entity-list feedback reveals attention, bulk, and delete outcomes without pulling simple row successes",
  entityList.includes('feedback.variant === "danger"') &&
    entityList.includes('feedback.variant === "warning"') &&
    entityList.includes('feedback.lifecycle === "persistent"') &&
    entityList.includes("options.bulk === true") &&
    entityList.includes('result.code === "deleted"') &&
    entityList.includes("showFeedback(result, { bulk: true })"),
);

check(
  "Shared filters own modal draft/apply, chips, and context-row contracts",
  entityFilters.includes("clearableFilterKeys") &&
    entityFilters.includes("data-admin-collection-context-row") &&
    entityFilters.includes("data-admin-filter-modal-fields") &&
    entityFilters.includes("draftFilters") &&
    entityFilters.includes("applyDraftFilters") &&
    entityFilters.includes('navigate(patch, "push")') &&
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
  "Categories enable column management + real pagination + shared information",
  categoriesClient.includes("enableColumnManagement") &&
    !categoriesClient.includes("enableColumnManagement={false}") &&
    categoriesClient.includes("useAdminEntityListController") &&
    categoriesClient.includes("onPageChange") &&
    !categoriesClient.includes("pageSizeSelectorMode=\"never\"") &&
    !categoriesClient.includes("totalPages={1}") &&
    categoriesColumns.includes('label: "الموضوعات"') &&
    !categoriesColumns.includes('label: "العدد"') &&
    categoriesActions.includes("AdminDataGridRowActions") &&
    categoriesActions.includes("information:") &&
    categoriesListOwner.includes("published_at") &&
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
  "Categories default to identity, status, topics, creation date, and actions while retaining optional hierarchy and publication columns",
  JSON.stringify(categoriesListConfigModule.CATEGORIES_DEFAULT_COLUMN_KEYS) ===
    JSON.stringify(["name", "status", "count", "created_at", "actions"]) &&
    categoriesListConfigModule.CATEGORIES_PREFERENCE_COLUMN_KEYS.includes("parent") &&
    categoriesListConfigModule.CATEGORIES_PREFERENCE_COLUMN_KEYS.includes("sort_order") &&
    categoriesListConfigModule.CATEGORIES_PREFERENCE_COLUMN_KEYS.includes("published_at") &&
    /key:\s*"parent"[\s\S]*?defaultVisible:\s*false/.test(categoriesColumns) &&
    /key:\s*"sort_order"[\s\S]*?defaultVisible:\s*false/.test(categoriesColumns) &&
    /key:\s*"published_at"[\s\S]*?defaultVisible:\s*false/.test(categoriesColumns) &&
    /key:\s*"status"[\s\S]*?minWidth:\s*104[\s\S]*?width:\s*104/.test(categoriesColumns) &&
    /key:\s*"count"[\s\S]*?minWidth:\s*ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH[\s\S]*?width:\s*ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH/.test(categoriesColumns) &&
    /key:\s*"created_at"[\s\S]*?defaultVisible:\s*true[\s\S]*?minWidth:\s*ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH[\s\S]*?width:\s*ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH/.test(categoriesColumns) &&
    hasCanonicalDateColumn(categoriesColumns, "created_at") &&
    /key:\s*"actions"[\s\S]*?width:\s*ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH[\s\S]*?sticky:\s*"end"/.test(categoriesColumns) &&
    /key:\s*"name"[\s\S]*?flexible:\s*true/.test(categoriesColumns),
);

check(
  "Categories split full-page edit and folder interactions",
  categoriesColumns.includes("data-category-folder-toggle") &&
    categoriesColumns.includes("data-category-folder-static") &&
    categoriesColumns.includes("data-category-edit-link") &&
    categoriesColumns.includes("aria-expanded") &&
    categoriesClient.includes("collapsedCategoryIds") &&
    /\.rpc\(\s*"admin_list_categories"/.test(
      read("src/lib/admin/content/entity-list-adapters/categories.ts"),
    ),
);

check(
  "Series uses الموضوعات terminology and expanded columns",
  seriesColumns.includes('label: "الموضوعات"') &&
    seriesColumns.includes('key: "id"') &&
    seriesColumns.includes('key: "slug"') &&
    seriesColumns.includes('key: "category"') &&
    seriesColumns.includes('key: "created_at"') &&
    seriesColumns.includes("AdminDataGridRowActions") &&
    seriesColumns.includes("information:") &&
    seriesColumns.includes("resolveAdminEntityPreviewActions") &&
    read("src/lib/admin/content/entity-preview-capabilities.ts").includes(
      "/admin/content/topics?series=",
    ) &&
    seriesClient.includes("toolbar={{") &&
    seriesClient.includes("useAdminEntityListController") &&
    seriesClient.includes("onPageChange") &&
    seriesListOwner.includes("category_id") &&
    seriesListOwner.includes("created_at") &&
    seriesListOwner.includes("updated_at"),
);

check(
  "Series category read model includes selected parent descendants",
  read("src/lib/admin/content/category-hierarchy.ts").includes(
    "buildAdminCategoryFilterModel",
  ) &&
    /\.rpc\(\s*"admin_list_series"/.test(
      read("src/lib/admin/content/entity-list-adapters/series.ts"),
    ) &&
    seriesClient.includes("onQueryPatch") &&
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
  "Series defaults to identity, status, category, topics, creation date, and actions with intentional geometry",
  JSON.stringify(seriesListConfigModule.SERIES_DEFAULT_COLUMN_KEYS) ===
    JSON.stringify([
      "name",
      "status",
      "category",
      "topics_count",
      "created_at",
      "actions",
    ]) &&
    seriesListConfigModule.SERIES_PREFERENCE_COLUMN_KEYS.includes("sort_order") &&
    seriesClient.includes("onPersistColumns") &&
    seriesColumns.includes("flexible: true") &&
    seriesColumns.includes("ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH") &&
    seriesColumns.includes("ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH") &&
    seriesColumns.includes("ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH") &&
    hasCanonicalDateColumn(seriesColumns, "created_at") &&
    seriesColumns.includes('minWidth: 104') &&
    dataGrid.includes(
      "ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH = 112",
    ) &&
    dataGrid.includes("ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH = 160"),
);

check(
  "Admin content bulk actions adopt the shared formal Arabic labels",
  [
    'hideSelected: "إخفاء المحدد"',
    'showSelected: "إظهار المحدد"',
    'deleteSelected: "حذف المحدد"',
    'restoreSelected: "استعادة المحدد"',
    'permanentlyDeleteSelected: "حذف نهائي للمحدد"',
    'emptyTrash: "إفراغ المحذوفات"',
  ].every((label) => bulkActionLabels.includes(label)) &&
    [
      topicsList,
      categoriesClient,
      seriesClient,
      entityTrashHeader,
      pagesClient,
      menusClient,
      blockModuleManager,
      heroManager,
      contentBlocksClient,
    ].every((source) => source.includes("ADMIN_BULK_ACTION_LABELS")),
);

check(
  "Requested Entity List consumers declare their default column order",
  appearsInOrder(unifiedContentColumns, [
    'key: "title"',
    'key: "status"',
    'key: "content_type"',
    'key: "category"',
    'key: "series"',
    'key: "featured"',
    'key: "actions"',
  ]) &&
    appearsInOrder(categoriesListConfig, [
      '"name"',
      '"status"',
      '"count"',
      '"created_at"',
      '"actions"',
    ]) &&
    appearsInOrder(seriesListConfig, [
      '"name"',
      '"status"',
      '"category"',
      '"topics_count"',
      '"created_at"',
      '"actions"',
    ]) &&
    appearsInOrder(pagesListConfig, [
      'key: "page"',
      'key: "slug"',
      'key: "moduleCount"',
      'key: "status"',
      'key: "actions"',
    ]) &&
    appearsInOrder(projectsListConfig, [
      'key: "project"',
      'key: "publication_status"',
      'key: "featured"',
      'key: "city"',
      'key: "main_area"',
      'key: "sub_area"',
      'key: "actions"',
    ]),
);

check(
  "Entity List headers are Arabic and shared publication terminology is reused",
  [
    unifiedContentColumns,
    categoriesColumns,
    seriesColumns,
    pagesClient,
    activityLogClient,
    topicsWithoutImageClient,
  ].every(
    (source) =>
      !/label:\s*"(?:ID|Variant|IP|Name|Status|Type|Actions|Created|Updated|Order|Title)"/.test(
        source,
      ),
  ) &&
    unifiedContentColumns.includes('label: "المحتوى"') &&
    unifiedContentColumns.includes('label: "مميز"') &&
    seriesColumns.includes('label: "الرابط"') &&
    activityLogClient.includes('label: "عنوان IP"') &&
    pageBlockAdminUtils.includes("getContentStatusMetadata(status)") &&
    pagesClient.includes("getContentStatusMetadata(status)"),
);

check(
  "Activity and media-quality report adopt existing column preference owner",
  [activityLogClient, topicsWithoutImageClient].every(
    (source) =>
      source.includes("onPersistColumns=") &&
      !source.includes("enableColumnManagement={false}"),
  ) &&
    [activityLogPage, topicsWithoutImagePage].every((source) =>
      source.includes("readAdminColumnPreferences"),
    ) &&
    [activityLogPreferences, topicsWithoutImagePreferences].every(
      (source) =>
        source.includes("saveAdminColumnPreferences") &&
        source.includes("allowedColumns:"),
    ),
);

check(
  "Category, Series, Residential, and Commercial lists adopt the shared column preference owner",
  [
    categoriesPage,
    seriesPage,
    residentialProjectsPage,
    commercialProjectsPage,
  ].every(
    (source) =>
      source.includes("readAdminColumnPreferences") &&
      !source.includes('.from("admin_user_preferences")'),
  ),
);

check(
  "Project list delegates location labels and authoritative publication state to its RPC read model",
  projectsListAdapter.includes('rpc("admin_list_projects"') &&
    projectPublishingMigration.includes(
      "left join public.project_locations city on city.id = project.city_id",
    ) &&
    projectPublishingMigration.includes(
      "left join public.project_locations main_area on main_area.id = project.main_area_id",
    ) &&
    projectPublishingMigration.includes(
      "left join public.project_locations sub_area on sub_area.id = project.sub_area_id",
    ) &&
    projectPublishingMigration.includes(
      "project.featured, project.publication_status",
    ) &&
    projectsListConfig.includes('| "publication_status"') &&
    !collectionAdoptionManifest.includes(
      "PROJECT_STATUS_REQUIRES_DOMAIN_AND_MIGRATION_DECISION",
    ),
);

check(
  "Specialized DataGrid consumers adopt typed preferences through the shared persistence owner",
  ![
    "PAGE_COMPOSITION_TEMPLATE_LIST_REQUIRES_TYPED_COLUMN_PREFERENCES_ADAPTER",
    "MENU_LIST_REQUIRES_TYPED_COLUMN_PREFERENCES_ADAPTER",
    "MENU_ITEM_LIST_REQUIRES_TYPED_COLUMN_PREFERENCES_ADAPTER",
    "PAGE_COMPOSITION_ASSIGNMENT_LIST_REQUIRES_TYPED_COLUMN_PREFERENCES_ADAPTER",
    "IDENTITY_LIST_REQUIRES_TYPED_COLUMN_PREFERENCES_ADAPTER",
  ].some((gap) => collectionAdoptionManifest.includes(gap)) &&
    [
      "contentTemplates",
      "heroTemplates",
      "breadcrumbTemplates",
      "cardsTemplates",
      "ctaTemplates",
      "feedTemplates",
      "mediaHubTemplates",
      "mediaSidebarTemplates",
      "menus",
      "menuItems",
      "pageAssignments",
    ].every((id) => pageCompositionColumnConfig.includes(`${id}:`)) &&
    pageCompositionColumnActions.includes("saveAdminColumnPreferences") &&
    pageCompositionColumnActions.includes("allowedColumns:") &&
    collectionAdoptionManifest.includes(
      "ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS",
    ) &&
    collectionAdoptionManifest.includes(
      "ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS",
    ),
);

check(
  "Shared sort controls expose one keyboard-focus and accessible state contract",
  dataGrid.includes("announceState?: boolean") &&
    dataGrid.includes("aria-pressed={announceState ? active : undefined}") &&
    dataGrid.includes('aria-hidden="true"') &&
    dataGrid.includes('return "غير مرتب"') &&
    dataGrid.includes('"مرتب تصاعديًا"') &&
    dataGrid.includes('"مرتب تنازليًا"') &&
    (dataGrid.match(/focus-visible:outline/g) ?? []).length >= 2,
);

check(
  "Semantic entity tables expose native column and sort state without duplicate announcements",
  (entityTable.match(/scope="col"/g) ?? []).length >= 3 &&
    (entityTable.match(/aria-sort=\{ariaSort\}/g) ?? []).length === 2 &&
    (entityTable.match(/announceState=\{false\}/g) ?? []).length === 2 &&
    entityTable.includes('"ascending"') &&
    entityTable.includes('"descending"') &&
    entityTable.includes('"none"'),
);

check(
  "Shared bulk and empty-state interactions expose Busy and keyboard-focus presentation",
  bulkBar.includes("aria-busy={isBusy || undefined}") &&
    (bulkBar.match(/focus-visible:outline/g) ?? []).length >= 2 &&
    listEmptyState.includes("focus-visible:outline") &&
    listEmptyState.includes("focus-visible:outline-offset-2"),
);

check(
  "Series delete delegates to shared AdminConfirmDialog",
  seriesColumns.includes('mode: "shared"') &&
    rowActions.includes("AdminConfirmDialog"),
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
const emptyPageRange = paginationModule.computePageRange(1, 10, 0);
check(
  "shared page range reports a canonical empty interval",
  emptyPageRange.rangeStart === 0 && emptyPageRange.rangeEnd === 0,
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
    notice?.lifecycle === "manual" &&
    notice?.autoDismissMs === undefined &&
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
  "Critical system notice remains persistent, dismissible, and URL-cleaning",
  criticalNotice?.dismissible === true &&
    criticalNotice?.lifecycle === "persistent" &&
    criticalNotice?.dismissSearchParams?.includes("notice") &&
    criticalNotice?.dismissSearchParams?.includes("message") &&
    criticalNotice?.dismissSearchParams?.includes("error"),
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

check(
  "Retired consumer QA cannot restore a direct provider writer",
  !existsSync(resolve(ROOT, "scripts/qa-admin-entity-list-consumers.mjs")),
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

// Exercise the live measurement callback, including widths rounded up by clientWidth.
function verifyFractionalScrollportBudget(source) {
  const ast = ts.createSourceFile('AdminEntityListTable.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'updateAvailableWidth') callback = node.initializer?.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!callback) throw new Error('Missing canonical scrollport measurement');
  const compiled = ts.transpileModule(`const measure = ${callback}; measure();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const run = Function('scrollport','window','primaryStickyMedia','setPrimaryColumnsPinned','setAvailableTableWidth',compiled);
  for (const width of [330, 635.2, 978, 1135.2, 1531.6]) {
    for (const border of [0, 0.8, 1, 1.6]) {
      const available = width - border * 2;
      let actual = null;
      run({clientWidth: Math.round(available), getBoundingClientRect: () => ({width})},
        {getComputedStyle: () => ({borderLeftWidth: `${border}px`, borderRightWidth: `${border}px`})},
        {matches:true}, () => {}, update => { actual = update(null); });
      if (Math.abs(actual - available) > 0.00001) return false;
    }
  }
  return true;
}
check('Shared table preserves fractional scrollport space instead of allocating rounded clientWidth', verifyFractionalScrollportBudget(entityTable));
check('Fractional width regression rejects the previous integer measurement',
  !verifyFractionalScrollportBudget(entityTable.replace(
    /const nextWidth = scrollport\.getBoundingClientRect\(\)\.width[\s\S]*?;/u,
    'const nextWidth = scrollport.clientWidth;',
  )));


// Execute the canonical table's real derived budget and rendered JSX values.
// Geometry is exercised by the bounded Chromium regression; this gate keeps
// the policy, both render branches, and resize lifecycle reachable in CI.
function loadAdjacentPinningContract(source) {
  const ast = ts.createSourceFile('AdminEntityListTable.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  const rendered = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['ADMIN_ENTITY_LIST_MINIMUM_FLEXIBLE_TRACK_WIDTH','stickyStartWidth','scrollableTrackWidth','pinAdjacentColumns'].includes(node.name.text)) declarations.set(node.name.text, node.initializer?.getText(ast));
    if (ts.isJsxOpeningElement(node) && ['th','td'].includes(node.tagName.getText(ast))) {
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const marker = attrs.find(a => a.name.getText(ast) === 'data-admin-grid-sticky');
      if (marker && marker.initializer?.getText(ast).includes('inline-end-adjacent')) {
        const expression = marker.initializer && ts.isJsxExpression(marker.initializer) ? marker.initializer.expression : null;
        const style = attrs.find(a => a.name.getText(ast) === 'style')?.initializer;
        const object = style && ts.isJsxExpression(style) && style.expression && ts.isObjectLiteralExpression(style.expression) ? style.expression : null;
        const property = name => object?.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === name);
        const position = property('position'), zIndex = property('zIndex');
        if (!expression || !position || !zIndex) throw new Error('Missing actual adjacent marker/position/layer binding');
        const evaluate = text => Function('pinAdjacentColumns', `return (${text});`);
        rendered.push({ tag: node.tagName.getText(ast), marker: evaluate(expression.getText(ast)), position: evaluate(position.initializer.getText(ast)), zIndex: evaluate(zIndex.initializer.getText(ast)) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (declarations.size !== 4 || rendered.length !== 2 || rendered[0].tag !== 'th' || rendered[1].tag !== 'td') throw new Error('Missing canonical adjacent budget/header/body');
  const body = [...declarations].map(([name,value]) => `const ${name} = ${value};`).join('\n') + '\nreturn pinAdjacentColumns;';
  const output = ts.transpileModule(body, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const evaluate = Function('columns','allocatedColumnWidths','primaryColumnsPinned','nextStickyEndOffset','selectionWidth','availableTableWidth',output);
  return { evaluate, rendered };
}

const adjacentBudgetCases = [
  { name:'unmeasured waits without pinning', width:null, end:354, start:72, pinned:false, selection:0, expected:false },
  { name:'Stages narrow release', width:330, end:354, start:72, pinned:false, selection:0, expected:false },
  { name:'Items narrow keeps readable content', width:330, end:318, start:72, pinned:false, selection:0, expected:false },
  { name:'Pages selection reserves its width', width:330, end:232, start:240, pinned:false, selection:46, expected:false },
  { name:'Pages without selection releases for full text', width:330, end:232, start:240, pinned:false, selection:0, expected:false },
  { name:'hidden order still reserves actual Relations track', width:330, end:244, start:72, pinned:false, selection:0, expected:false },
  { name:'641 pinned primary budget releases cramped owner', width:530, end:354, start:72, pinned:true, selection:0, expected:false },
  { name:'641 primary static control', width:530, end:354, start:72, pinned:false, selection:0, expected:true },
  { name:'selection is counted at exact boundary', width:600, end:354, start:72, pinned:true, selection:46, expected:false },
  { name:'fit boundary retains pins', width:576, end:354, start:72, pinned:true, selection:0, expected:true },
  { name:'one below boundary releases', width:575, end:354, start:72, pinned:true, selection:0, expected:false },
  { name:'wide retains normal pins', width:1000, end:374, start:280, pinned:true, selection:46, expected:true },
];
function verifyAdjacentPinningContract(source) {
  const contract = loadAdjacentPinningContract(source);
  for (const sample of adjacentBudgetCases) {
    const columns = [{key:'primary',sticky:'start'},{key:'content'},{key:'actions',sticky:'end'}];
    const actual = contract.evaluate(columns,new Map([['primary',sample.start],['content',150],['actions',144]]),sample.pinned,sample.end,sample.selection,sample.width);
    if (actual !== sample.expected) throw new Error(sample.name);
  }
  for (const branch of contract.rendered) {
    if (branch.marker(true) !== 'inline-end-adjacent' || branch.marker(false) !== undefined || branch.position(true) !== 'sticky' || branch.position(false) !== 'static' || branch.zIndex(false) !== 'auto' || branch.zIndex(true) !== undefined) throw new Error(`${branch.tag} must expose actual pinning`);
  }
  return true;
}
check('Adjacent pinning executes exact current width budgets and both truthful render branches', verifyAdjacentPinningContract(entityTable));
const adjacentMutants = [
  entityTable.replace(/const pinAdjacentColumns =[^;]+;/u,'const pinAdjacentColumns = true;'),
  entityTable.replace('      stickyStartWidth +','      0 +'),
  entityTable.replace('      selectionWidth +','      0 +'),
  entityTable.replace('scrollableTrackWidth <=','0 <='),
  entityTable.replace('scrollableTrackWidth <=','scrollableTrackWidth >='),
  entityTable.replace('position: pinAdjacentColumns ? "sticky" : "static"','position: "sticky"'),
  entityTable.replaceAll('position: pinAdjacentColumns ? "sticky" : "static"','position: "static"'),
  entityTable.replace('pinAdjacentColumns ? "inline-end-adjacent" : undefined','"inline-end-adjacent"'),
  entityTable.replaceAll('zIndex: pinAdjacentColumns ? undefined : "auto"','zIndex: undefined'),
];
check('Adjacent budget guards reject exhausted content, missing selection/start widths and stale render branches', adjacentMutants.every(mutant => {
  if (mutant === entityTable) return false;
  try {verifyAdjacentPinningContract(mutant);return false;} catch {return true;}
}));
check('Actual primary pinning follows the existing responsive contract and removes its listener',
  entityTable.includes('window.matchMedia("(min-width: 641px)")') &&
  entityTable.includes('min-[641px]:sticky') &&
  entityTable.includes('setPrimaryColumnsPinned(primaryStickyMedia.matches)') &&
  entityTable.includes('primaryStickyMedia.addEventListener("change", updateAvailableWidth)') &&
  entityTable.includes('primaryStickyMedia.removeEventListener("change", updateAvailableWidth)') &&
  entityTable.includes('observer.disconnect()'));


// Execute the presentation owner, rather than accepting a consumer's icon tokens.
const metricCardPath = "src/components/admin/ui/AdminMetricCard.tsx";
const metricGridPath = "src/components/admin/ui/AdminMetricCardsGrid.tsx";
const metricTabsPath = "src/components/admin/ui/AdminModuleTabs.tsx";
const metricTokenDependencies = {
  "../../../lib/admin/admin-ui-styles": loadPureTypeScriptModule("src/lib/admin/admin-ui-styles.ts", {
    "../../components/venesia-scrollbar-styles": loadPureTypeScriptModule("src/components/venesia-scrollbar-styles.ts"),
  }),
};
function elements(node, predicate = () => true) {
  const result = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!React.isValidElement(value)) return;
    if (predicate(value)) result.push(value);
    visit(value.props.children);
  }
  visit(node);
  return result;
}
function actionGlyphContract(source = dataGrid) {
  const Link = ({ children, ...props }) => {
    const anchor = { ...props };
    delete anchor.prefetch;
    return React.createElement("a", anchor, children);
  };
  const gridModule = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", {
    ...metricTokenDependencies,
    "next/link": { default: Link },
    "./AdminCheckbox": { default: () => null },
    "./AdminDataGridQueryStatus": { default: () => null },
    "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" },
    "./AdminDataGridDateTimeCell": { default: () => null },
  }, source);
  const Button = gridModule.AdminDataGridActionButton;
  const Icon = gridModule.AdminDataGridActionIcon;
  const onClick = () => {};
  const onKeyDown = () => {};
  const buttonRef = { current: null };
  let cases = 0;
  for (const action of ["edit", "preview", "more", "visibility", "feature"]) {
    for (const size of ["default", "compact", "inline"]) {
      for (const state of [{}, { disabled: true }, { pending: true }, { disabled: true, pending: true }]) {
        const props = { action, size, ...state, href: "/admin/content/topics/7", onClick, onKeyDown, buttonRef, ariaExpanded: true, ariaHasPopup: "menu", ariaControls: "owned-menu", isCurrentlyHidden: true, active: true };
        const reference = Button(props);
        assert.equal(renderToStaticMarkup(reference), renderToStaticMarkup(Button({ ...props, iconSize: "sm" })), "Explicit small and omitted glyph scales retain identical default SSR");
        for (const iconSize of [undefined, "sm", "md", "lg"]) {
          const tree = Button({ ...props, iconSize });
          const { children, ...outer } = tree.props;
          const { children: referenceContent, ...referenceOuter } = reference.props;
          assert.equal(tree.type, reference.type, "Glyph scale must not change Link/button selection");
          assert.deepEqual(outer, referenceOuter, "Glyph scale must preserve geometry, focus classes, handlers, ARIA and state");
          assert.match(outer.className, /focus-visible:outline/u);
          assert.match(outer.className, size === "inline" ? /h-7 w-7/u : size === "compact" ? /h-10 w-10/u : /h-11 w-11/u);
          if (state.disabled || state.pending) {
            assert.equal(tree.type, "button");
            assert.equal(outer.disabled, true);
            assert.equal(outer.onClick, onClick);
            assert.equal(outer.onKeyDown, onKeyDown);
            assert.equal(outer.ref, buttonRef);
            assert.equal(outer["aria-busy"], state.pending || undefined);
            assert.equal(outer["aria-controls"], "owned-menu");
          } else {
            assert.equal(tree.type, Link);
            assert.equal(outer.prefetch, false);
            assert.equal(outer.href, props.href);
          }
          if (state.pending) assert.equal(renderToStaticMarkup(tree), renderToStaticMarkup(reference), "Pending spinner presentation must ignore glyph scale");
          else {
            assert.equal(children.type, Icon);
            assert.deepEqual({ ...children.props, size: undefined }, { ...referenceContent.props, size: undefined }, "Action identity, visibility and active state pass through unchanged");
            const glyph = Icon(children.props);
            assert.equal(glyph.props["aria-hidden"], "true");
            assert.equal(glyph.props.className, iconSize === "lg" ? "size-5.5 shrink-0" : iconSize === "md" ? "size-4.5 shrink-0" : "h-4 w-4 shrink-0");
          }
          cases += 1;
        }
      }
    }
  }
  const bare = { children: "إجراء نصي", size: "compact", onClick };
  assert.equal(renderToStaticMarkup(Button(bare)), renderToStaticMarkup(Button({ ...bare, iconSize: "lg" })), "Custom action content must not change when no semantic glyph is supplied");
  return cases;
}
function cinematicGridPresentationContract(source = dataGrid) {
  const owner = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", {
    ...metricTokenDependencies, "next/link": { default: SsrNextLink },
    "./AdminCheckbox": { default: "input" }, "./AdminDataGridQueryStatus": { default: () => null },
    "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" }, "./AdminDataGridDateTimeCell": { default: () => null },
  }, source);
  const children = React.createElement("table", { "data-owned-table": "" });
  const props = { children, queryPending: true, scrollLabel: "عرض تجريبي" };
  const omitted = owner.AdminDataGrid(props), standard = owner.AdminDataGrid({ ...props, presentation: "default" }), cinematic = owner.AdminDataGrid({ ...props, presentation: "cinematic" });
  assert.equal(renderToStaticMarkup(omitted), renderToStaticMarkup(standard), "Omitting presentation must preserve exact default markup");
  assert.equal(omitted.props["data-admin-data-grid-presentation"], "cinematic");
  assert.equal(cinematic.props["data-admin-data-grid-presentation"], "cinematic");
  assert.equal(cinematic.props.className, omitted.props.className, "Both compatibility names resolve the same official presentation");
  for (const tree of [omitted, cinematic]) {
    assert.equal(tree.props["data-admin-data-grid-query-pending"], "true");
    const scroll = elements(tree, node => "data-admin-data-grid-scroll" in node.props)[0];
    assert.equal(scroll.props.children, children); assert.equal(scroll.props.role, "region"); assert.equal(scroll.props["aria-label"], props.scrollLabel); assert.equal(scroll.props.dir, "rtl"); assert.equal(scroll.props.tabIndex, 0);
  }
  const onClick = () => {}, onKeyDown = () => {}, ref = { current: null };
  for (const state of [{}, { disabled: true }, { pending: true }]) {
    const actionProps = { action: "preview", href: "/admin/content/topics/71/preview", target: "_blank", onClick, onKeyDown, buttonRef: ref, ariaHasPopup: "menu", ariaControls: "existing-layer", ...state };
    const before = owner.AdminDataGridActionButton(actionProps), after = owner.AdminDataGridActionButton({ ...actionProps, presentation: "cinematic" });
    const { className: beforeClasses, ...beforeProps } = before.props, { className: afterClasses, ...afterProps } = after.props;
    assert.equal(after.type, before.type); assert.deepEqual(afterProps, beforeProps, "Presentation retains Link/button choice, callbacks, native state, ARIA, target and content");
    assert.ok(beforeClasses.includes("h-11 w-11") && afterClasses.includes("h-11 w-11")); assert.match(afterClasses, /focus-visible:outline/u);
  }
  return true;
}
check("Actual Cinematic Grid preserves default markup, query/accessibility semantics and action behavior", cinematicGridPresentationContract());
const cinematicGridMutants = [dataGrid.replaceAll('resolveAdminCollectionPresentation(requestedPresentation)', 'requestedPresentation'), dataGrid.replaceAll('data-admin-data-grid-presentation={presentation}', 'data-admin-data-grid-presentation={requestedPresentation}')];
check("Cinematic Grid negatives reject a legacy default alias and unresolved presentation metadata", cinematicGridMutants.every(source => { assert.notEqual(source, dataGrid); try { cinematicGridPresentationContract(source); return false; } catch { return true; } }));
function dashboardModuleHeaderAdoptionContract(source = read("src/components/admin/dashboard/AdminDashboardView.tsx")) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let header, actions;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "AdminPageContextHeader") header = node;
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "quickActions")) actions = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(header && actions, "Dashboard keeps the existing header and quick-actions owner composition");
  const Header = loadPureTypeScriptModule("src/components/admin/ui/AdminPageContextHeader.tsx", { ...metricTokenDependencies, "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" }, "./AdminModuleTabs": { AdminModuleTabIcon: ({ name }) => React.createElement("svg", { "data-header-owned-icon": name, "aria-hidden": "true" }) } }).default;
  const Button = loadPureTypeScriptModule("src/components/admin/ui/AdminActionButton.tsx", { ...metricTokenDependencies, "next/link": { default: SsrNextLink } }).default;
  const Icon = ({ name }) => React.createElement("svg", { "data-owned-module-icon": name, "aria-hidden": "true" });
  const isolated = 'export function renderDashboardModuleHeader(){' + actions.getText(ast) + '\nreturn (' + header.getText(ast) + ');}' ;
  const extracted = loadPureTypeScriptModule("DashboardModuleHeader.tsx", {}, isolated, { AdminPageContextHeader: Header, AdminActionButton: Button, AdminModuleTabIcon: Icon });
  const tree = extracted.renderDashboardModuleHeader();
  assert.equal(tree.type, Header); assert.equal(metricTokenDependencies["../../../lib/admin/admin-ui-styles"].resolveAdminCollectionPresentation(tree.props.presentation), "cinematic");
  assert.equal(tree.props.title, "لوحة التحكم"); assert.equal(tree.props.description, "نظرة شاملة على المحتوى والمشاريع وحالة مصادر النظام.");
  assert.equal(tree.props.icon.type, Icon); assert.equal(tree.props.icon.props.name, "statistics");
  assert.equal(tree.props.artwork, "statistics", "Dashboard selects the subtle optional statistics scene rather than the Topics document artwork");
  const buttons = React.Children.toArray(tree.props.actions);
  assert.equal(buttons.length, 3);
  const expected = [
    { href: "/admin/content/topics/new", variant: "primary", icon: "content", hint: "إضافة محتوى", label: "موضوع جديد" },
    { href: "/admin/content/categories/new", variant: "dark", icon: "specifications", hint: "تنظيم الشجرة", label: "تصنيف جديد" },
    { href: "/admin/settings/general", variant: "dark", icon: "settings", hint: "بيانات النظام", label: "الإعدادات" },
  ];
  buttons.forEach((button, index) => {
    const reference = expected[index]; assert.equal(button.type, Button);
    assert.equal(button.props.href, reference.href); assert.equal(button.props.variant, reference.variant); assert.equal(button.props.title, reference.hint); assert.equal(button.props.presentation, "cinematic");
    assert.equal(elements(button.props.children, node => node.type === Icon)[0]?.props.name, reference.icon);
    assert.equal(renderToStaticMarkup(Button(button.props)).replace(/<[^>]*>/gu, "").trim(), reference.label);
  });
  const rendered = Header(tree.props), moduleTokens = metricTokenDependencies["../../../lib/admin/admin-ui-styles"].ADMIN_CINEMATIC_GOLD_V1.module;
  assert.ok(rendered.props.className.includes(moduleTokens.root) && moduleTokens.root.split(/\s+/u).includes("py-3"));
  const watermark = elements(rendered, node => typeof node.props.className === "string" && node.props.className === moduleTokens.watermark);
  assert.equal(watermark.length, 1); assert.equal(watermark[0].props["aria-hidden"], "true");
  assert.equal(watermark[0].props["data-admin-header-artwork"], "statistics");
  const scene = watermark[0].props.children;
  assert.equal(scene.type, "svg"); assert.equal(scene.props.viewBox, "0 0 320 180"); assert.equal(scene.props.focusable, "false");
  assert.equal(elements(watermark[0], node => ["text", "button", "a"].includes(node.type)).length, 0, "Optional artwork has no invented figures or interactive controls");
  const fills = elements(scene, node => node.props.fillOpacity !== undefined).map(node => Number(node.props.fillOpacity));
  const strokes = elements(scene, node => node.props.strokeOpacity !== undefined).map(node => Number(node.props.strokeOpacity));
  assert.ok(fills.length >= 3 && fills.every(value => value > 0 && value <= 0.13), "Background bars keep the subtle document-like fill opacity");
  assert.ok(strokes.length >= 3 && strokes.every(value => value > 0 && value <= 0.42), "Background linework remains quieter than the identity icon");
  assert.equal(elements(rendered, node => node.type === Icon && node.props.name === "statistics").length, 1, "The Dashboard identity keeps its existing strong statistics glyph");
  const defaultProps = { title: "Default header", icon: tree.props.icon };
  assert.equal(renderToStaticMarkup(Header(defaultProps)), renderToStaticMarkup(Header({ ...defaultProps, presentation: "default" })), "Omitted header presentation preserves default output");
  assert.equal(elements(Header(defaultProps), node => node.props.className === moduleTokens.watermark).length, 1, "The official default adopts the shared icon fallback artwork");
  assert.equal(renderToStaticMarkup(Header({ ...defaultProps, artwork: "statistics" })), renderToStaticMarkup(Header({ ...defaultProps, presentation: "cinematic", artwork: "statistics" })), "Optional statistics artwork is equivalent through both official presentation aliases");
  const fallback = Header({ ...defaultProps, presentation: "cinematic" });
  assert.equal(elements(fallback, node => node.props.className === moduleTokens.watermark)[0]?.props.children, tree.props.icon, "Consumers without optional artwork retain the existing icon fallback");
  const topics = Header({ title: "Topics", presentation: "cinematic", artwork: "document", icon: React.createElement(Icon, { name: "content" }) });
  assert.equal(elements(topics, node => node.props["data-admin-header-artwork"] === "document").length, 1, "Topics keeps its separate document artwork");
  return true;
}
check("Actual Dashboard module header adopts shared cinematic chrome and optional statistics artwork while preserving all three actions and defaults", dashboardModuleHeaderAdoptionContract());
const dashboardHeaderSource = read("src/components/admin/dashboard/AdminDashboardView.tsx");
const dashboardHeaderMutants = [
  dashboardHeaderSource.replaceAll('AdminPageContextHeader', 'UnownedPageHeader'),
  dashboardHeaderSource.replace('name="statistics"', 'name="content"'),
  dashboardHeaderSource.replace('variant: "primary",', 'variant: "dark",'),
  dashboardHeaderSource.replace('href: "/admin/settings/general"', 'href: "/admin/content/topics"'),
  dashboardHeaderSource.replace('artwork="statistics"', 'artwork="document"'),
  dashboardHeaderSource.replace('artwork="statistics"', ''),
];
check("Dashboard adoption negatives reject default chrome, wrong artwork, lost priorities, changed links and a copied Topics scene", dashboardHeaderMutants.every(source => { assert.notEqual(source, dashboardHeaderSource); try { dashboardModuleHeaderAdoptionContract(source); return false; } catch { return true; } }));
function cinematicRowHoverPaletteContract(styles = metricTokenDependencies["../../../lib/admin/admin-ui-styles"]) {
  const tokens = styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.table.split(/\s+/u);
  const base = tokens.find(token => token.startsWith("[&_tbody_tr:hover>td]:bg-[var(--admin-grid-hover,"));
  const gradient = tokens.find(token => token.startsWith("[&_tbody_tr:hover>td]:bg-[linear-gradient("));
  assert.ok(base && gradient, "Hover continues across every cell in the full row");
  assert.equal(base, "[&_tbody_tr:hover>td]:bg-[var(--admin-grid-hover,#0D151D)]", "Outer paint refinement preserves the authored ordinary-row hover token exactly");
  assert.equal(gradient, "[&_tbody_tr:hover>td]:bg-[linear-gradient(180deg,rgba(216,176,104,0.035),rgba(216,176,104,0.008))]", "The existing warm hover overlay remains unchanged on both row parities");
  for (const token of ["[&_tbody_td]:bg-[#03080D]", "[&_tbody_tr:nth-child(even)>td]:bg-[#080E13]"]) assert.ok(tokens.includes(token), "Approved outer paint never recolors original normal/even rows: " + token);
  const hex = base.match(/var\(--admin-grid-hover,#([0-9a-f]{6})\)\]$/iu)?.[1]; assert.ok(hex);
  const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
  assert.ok(channels[2] >= channels[1] && channels[1] >= channels[0] && Math.max(...channels) <= 30, "Opaque hover base stays quiet dark navy rather than saturated brown");
  const alpha = [...gradient.matchAll(/rgba\(216,176,104,([0-9.]+)\)/gu)].map(match => Number(match[1]));
  assert.equal(alpha.length, 2); assert.ok(alpha[0] > 0 && alpha[0] <= 0.04 && alpha[1] > 0 && alpha[1] <= 0.01, "Warm gold remains a low-opacity light over the opaque row base");
  assert.ok(tokens.includes("[&_tbody_td]:duration-250"));
  return true;
}
check("Full-row hover keeps its 250ms opaque geometry and faint warm light over the shared dark-navy base", cinematicRowHoverPaletteContract());
const hoverPaletteStyles = metricTokenDependencies["../../../lib/admin/admin-ui-styles"];
const brownHoverMutant = { ...hoverPaletteStyles, ADMIN_CINEMATIC_GOLD_V1: { ...hoverPaletteStyles.ADMIN_CINEMATIC_GOLD_V1, dataGrid: { ...hoverPaletteStyles.ADMIN_CINEMATIC_GOLD_V1.dataGrid, table: hoverPaletteStyles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.table.replace("var(--admin-grid-hover,#0D151D)", "var(--admin-grid-hover,#10140F)") } } };
check("Hover palette negative rejects the former brown base without changing selection or focus semantics", (() => { try { cinematicRowHoverPaletteContract(brownHoverMutant); return false; } catch { return true; } })());
function cinematicGridRefinementContract(source = dataGrid, styles = metricTokenDependencies["../../../lib/admin/admin-ui-styles"]) {
  const tokens = styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid;
  const rowClasses = new Set(tokens.table.split(/\s+/u));
  assert.ok(rowClasses.has("[&_tbody_td]:duration-250"), "Cinematic rows keep the bounded 250ms color/light transition");
  assert.ok(rowClasses.has("motion-reduce:[&_tbody_td]:transition-none"), "Reduced motion stops the added cell transition");
  assert.match(tokens.table, /tr:has\(:focus-visible\)>td/u, "Keyboard row focus remains distinct from pointer hover");
  assert.match(tokens.table, /tr\[data-selected=true\]:hover>td/u, "Selected hover has an explicit higher-specificity state");
  assert.match(tokens.table, /tr\[data-selected=true\]>td:first-child\]:before:start-0/u, "The independent selection stripe stays at logical inline-start while keyboard focus uses cell shadows");
  assert.ok(rowClasses.has("[&_thead_th]:py-3") && rowClasses.has("[&_tbody_td]:py-3"), "Cinematic density is scoped to semantic table cells");
  assert.ok(rowClasses.has("[&_tbody_td]:bg-[#03080D]"), "Cells retain an opaque base under the subtle hover image and pinned controls");
  assert.ok([...rowClasses].some(token => token.startsWith("[&_tbody_tr:hover>td]:bg-[linear-gradient(")), "Hover uses the shared cell gradient");
  assert.ok(![...rowClasses].some(token => /:(?:translate|scale|rotate|animate)-/u.test(token)), "Table row presentation cannot borrow KPI lift or animation");
  const owner = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", {
    ...metricTokenDependencies, "../../../lib/admin/admin-ui-styles": styles, "next/link": { default: SsrNextLink },
    "./AdminCheckbox": { default: "input" }, "./AdminDataGridQueryStatus": { default: () => null },
    "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" }, "./AdminDataGridDateTimeCell": { default: () => null },
  }, source);
  const onClick = () => {}, onKeyDown = () => {}, ref = { current: null };
  let cases = 0;
  for (const tone of ["gold", "dark", "red", "green", "blue"]) for (const size of ["default", "compact", "inline"]) for (const state of [{}, { disabled: true }, { pending: true }]) {
    const props = { action: tone === "red" ? "delete" : "edit", tone, size, href: "/admin/content/topics/71", onClick, onKeyDown, buttonRef: ref, ...state };
    const before = owner.AdminDataGridActionButton(props), after = owner.AdminDataGridActionButton({ ...props, presentation: "cinematic" });
    assert.equal(renderToStaticMarkup(before), renderToStaticMarkup(owner.AdminDataGridActionButton({ ...props, presentation: "default" })), "Default tone presentation stays unchanged");
    const { className: beforeClasses, ...beforeProps } = before.props, { className: afterClasses, ...afterProps } = after.props;
    assert.equal(after.type, before.type); assert.deepEqual(afterProps, beforeProps, "Tone refinement preserves handlers, semantics, native disabled/pending state and content");
    assert.match(afterClasses, size === "inline" ? /h-7 w-7/u : size === "compact" ? /h-10 w-10/u : /h-11 w-11/u);
    assert.ok(afterClasses.split(/\s+/u).includes("duration-250") && afterClasses.includes("motion-reduce:transition-none"));
    if (["red", "green", "blue"].includes(tone)) {
      const classes = new Set(afterClasses.split(/\s+/u));
      assert.ok(beforeClasses.split(/\s+/u).every(token => !token || classes.has(token)), "Danger and visibility/state tones retain every original semantic style");
      assert.ok(!afterClasses.includes("bg-[linear-gradient("), "Dark cinematic gradients cannot cover danger or state fills");
      if (tone === "red") assert.ok(classes.has("bg-red-500/85") && classes.has("hover:bg-red-500"), "Danger remains red in rest and hover states");
    } else {
      assert.ok(afterClasses.includes("bg-[linear-gradient("), "Gold and dark controls use the bounded cinematic surface");
      assert.match(afterClasses, /hover:shadow-/u);
    }
    cases += 1;
  }
  return cases;
}
check("Cinematic DataGrid v1.1 keeps quiet distinct row states, density and all 45 action tone/size/state combinations", cinematicGridRefinementContract() === 45);
const refinementStyles = metricTokenDependencies["../../../lib/admin/admin-ui-styles"];
function cinematicCollectionFrameContract(source = entitySurface, styles = refinementStyles, topicsSource = topicsClient) {
  const owner = loadPureTypeScriptModule("src/components/admin/entity-list/AdminEntityListSurface.tsx", {
    react: React,
    "../../../lib/admin/admin-ui-styles": styles,
    "./AdminFloatingLayerContext": { AdminFloatingLayerProvider: ({ children }) => children },
  }, source);
  const children = [React.createElement("section", { key: "table", "data-owned-table": "" }), React.createElement("footer", { key: "footer", "data-owned-pagination": "" })];
  const props = { children, className: "consumer-class", "aria-label": "الموضوعات", "data-preserved-prop": "preserved" };
  const omitted = owner.AdminEntityListTableRegion(props), standard = owner.AdminEntityListTableRegion({ ...props, presentation: "default" }), cinematic = owner.AdminEntityListTableRegion({ ...props, presentation: "cinematic" });
  assert.equal(renderToStaticMarkup(omitted), renderToStaticMarkup(standard), "Omitted frame presentation preserves exact explicit default output");
  assert.equal(omitted.props.className, `admin-entity-list-primary-section ${styles.ADMIN_CINEMATIC_GOLD_V1.collection.frame} consumer-class`, "Existing region owns the official joined frame for every alias");
  assert.equal(omitted.props["data-admin-entity-list-table-region-presentation"], "cinematic");
  assert.equal(cinematic.props["data-admin-entity-list-table-region-presentation"], "cinematic");
  for (const tree of [omitted, cinematic]) {
    assert.equal(tree.type, "div"); assert.equal(tree.props.children, children);
    assert.equal(tree.props["aria-label"], props["aria-label"]); assert.equal(tree.props["data-preserved-prop"], "preserved");
    assert.equal(tree.props["data-admin-entity-list-primary-section"], ""); assert.equal(tree.props["data-admin-entity-list-table-region"], "");
  }
  const frame = styles.ADMIN_CINEMATIC_GOLD_V1.collection.frame;
  assert.ok(cinematic.props.className.includes(frame), "The existing region delegates the cinematic frame to canonical collection tokens");
  const classes = new Set(frame.split(/\s+/u));
  for (const token of ["border-[rgba(216,176,104,0.045)]", "bg-[linear-gradient(115deg,#131C25,#050C14_55%,#080F17)]", "shadow-[inset_0_2px_0_rgba(237,200,120,0.52),inset_0_6px_14px_rgba(216,176,104,0.035),0_12px_24px_rgba(0,0,0,0.55),0_28px_58px_rgba(0,0,0,0.42)]"]) assert.ok(classes.has(token), "Balanced Refined frame keeps the exact approved shared paint: " + token);
  assert.ok(!classes.has("[&_[data-admin-collection-toolbar-owner]]:bg-none"), "Joined frames must expose the actual Toolbar owner's approved background");
  assert.ok(styles.ADMIN_CINEMATIC_GOLD_V1.collection.toolbarSurface.split(/\s+/u).includes("bg-[linear-gradient(115deg,#131E29,#07111B)]"), "The canonical Toolbar surface owns its approved navy gradient");
  assert.ok(classes.has("overflow-visible") && classes.has("gap-0"));
  assert.ok(!classes.has("overflow-hidden") && !classes.has("overflow-clip"), "The outer frame must not clip scroll controls or floating layers");
  for (const marker of ["data-admin-collection-toolbar-owner", "data-admin-data-grid-presentation=cinematic", "data-admin-table-pagination"]) assert.ok(frame.includes(marker), "Frame joins every existing region without replacing its child owner");
  const ast = ts.createSourceFile("TopicsListClient.tsx", topicsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let adopted = false;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "AdminEntityListTableRegion") {
      const attribute = node.attributes.properties.find(entry => ts.isJsxAttribute(entry) && entry.name.getText(ast) === "presentation");
      adopted = !attribute || Boolean(ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer) && ["default", "cinematic"].includes(attribute.initializer.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(adopted, "Topics explicitly adopts the existing frame owner");
  return true;
}
check("Actual cinematic TableRegion joins existing owners without clipping or changing omitted defaults, children or consumer props", cinematicCollectionFrameContract());
const frameMutants = [
  () => cinematicCollectionFrameContract(entitySurface.replace('resolveAdminCollectionPresentation(requestedPresentation)', 'requestedPresentation')),
  () => cinematicCollectionFrameContract(entitySurface.replace('presentation === "cinematic"', 'false')),
  () => cinematicCollectionFrameContract(entitySurface, { ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, collection: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection, frame: refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection.frame.replace("overflow-visible", "overflow-hidden") } } }),
  () => cinematicCollectionFrameContract(entitySurface, refinementStyles, topicsClient.replaceAll('AdminEntityListTableRegion', 'AdminEntityListPrimarySection')),
  ...["border-[rgba(216,176,104,0.045)]", "bg-[linear-gradient(115deg,#131C25,#050C14_55%,#080F17)]", "inset_0_2px_0_rgba(237,200,120,0.52)", "inset_0_6px_14px_rgba(216,176,104,0.035)", "0_12px_24px_rgba(0,0,0,0.55)", "0_28px_58px_rgba(0,0,0,0.42)"].map(token => () => { const collection = refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection; assert.ok(collection.frame.includes(token), "Balanced Refined negative remains reachable: " + token); return cinematicCollectionFrameContract(entitySurface, { ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, collection: { ...collection, frame: collection.frame.replace(token, "fixture-unapproved-paint") } } }); }),
  () => cinematicCollectionFrameContract(entitySurface, { ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, collection: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection, frame: refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection.frame + " [&_[data-admin-collection-toolbar-owner]]:bg-none" } } }),
  () => cinematicCollectionFrameContract(entitySurface, { ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, collection: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection, toolbarSurface: refinementStyles.ADMIN_CINEMATIC_GOLD_V1.collection.toolbarSurface.replace("bg-[linear-gradient(115deg,#131E29,#07111B)]", "bg-none") } } }),
];
check("Frame negatives reject automatic adoption, ignored opt-in, clipped layers and a missing actual Topics opt-in", frameMutants.every(run => { try { run(); return false; } catch { return true; } }));
const withGridTokens = patch => ({ ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, dataGrid: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1.dataGrid, ...patch } } });
const refinementMutants = [
  () => cinematicGridRefinementContract(dataGrid.replace('(resolvedTone === "gold" || resolvedTone === "dark")', 'true')),
  () => cinematicGridRefinementContract(dataGrid, withGridTokens({ action: refinementStyles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.action + " bg-[linear-gradient(black,black)]" })),
  () => cinematicGridRefinementContract(dataGrid, withGridTokens({ table: refinementStyles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.table.replace("duration-250", "duration-0") })),
  () => cinematicGridRefinementContract(dataGrid, withGridTokens({ table: refinementStyles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.table.replaceAll(":has(:focus-visible)", ":focus-within") })),
];
check("DataGrid v1.1 negatives reject danger recoloring, covered semantic fills, abrupt motion and pointer-only focus styling", refinementMutants.every(run => { try { run(); return false; } catch { return true; } }));

function sharedSelectionContract(styles = refinementStyles, tableSource = entityTable) {
  const selection = styles.ADMIN_DATA_GRID_SELECTION;
  assert.ok(selection && styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.table.includes(selection.table), "Cinematic and standard tables use one shared selection token");
  assert.equal(styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.checkbox, selection.checkbox);
  assert.equal(styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.bulk, selection.bulk);
  const classes = new Set(selection.table.split(/\s+/u));
  for (const token of [
    "[&_tbody_tr[data-selected=true]>td]:bg-[var(--admin-grid-selected,#102033)]",
    "[&_tbody_tr[data-selected=true]:hover>td]:bg-[var(--admin-grid-selected-hover,#14283D)]",
    "[&_tbody_tr[data-selected=true]>td]:bg-[linear-gradient(180deg,rgba(120,189,250,0.035),rgba(120,189,250,0.012))]",
    "[&_tbody_tr[data-selected=true]:hover>td]:bg-[linear-gradient(180deg,rgba(120,189,250,0.035),rgba(120,189,250,0.012))]",
    "[&_tbody_tr[data-selected=true]>td:first-child]:before:start-0",
    "[&_tbody_tr[data-selected=true]>td:first-child]:before:w-0.5",
    "[&_tbody_tr[data-selected=true]>td:first-child]:before:pointer-events-none",
    "[&_tbody_tr[data-selected=true]>td:first-child]:before:bg-[var(--admin-accent,#D8B068)]",
    "[&_tbody_tr:has(:focus-visible)>td]:border-[var(--admin-grid-focus,#78BDFA)]/35",
    "motion-reduce:[&_tbody_td]:transition-none",
  ]) assert.ok(classes.has(token), `Shared selection preserves ${token}`);
  assert.ok(!/rgba\(216,176,104|#1C1A11|#242011/iu.test(selection.table), "Selected rows cannot restore the former brown fill or warm row-wide light");
  assert.match(selection.table, /:has\(:focus-visible\)>td\]:shadow-\[inset_0_1px_0_color-mix\(in_srgb,var\(--admin-grid-focus,#78BDFA\)/u, "Cool focus remains separate from the gold pseudo-element stripe");

  const ast = ts.createSourceFile("AdminEntityListTable.tsx", tableSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let tableClass;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "table") tableClass = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "className")?.initializer?.expression;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(tableClass);
  const evaluate = Function("presentation", "ADMIN_CINEMATIC_GOLD_V1", "ADMIN_DATA_GRID_SELECTION", `return (${tableClass.getText(ast)});`);
  for (const presentation of ["default", "cinematic"]) {
    const actual = evaluate(presentation, styles.ADMIN_CINEMATIC_GOLD_V1, selection);
    assert.ok(actual.startsWith("w-full table-fixed border-separate border-spacing-0 text-right "));
    assert.ok(actual.includes(selection.table), `${presentation} semantic tables adopt selection directly from its canonical owner`);
  }
  assert.match(tableSource, /data-selected=\{selection\?\.selectedSet\.has\(rowId\) \? "true" : undefined\}/u);
  const owner = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", {
    ...metricTokenDependencies, "../../../lib/admin/admin-ui-styles": styles, "next/link": { default: SsrNextLink },
    "./AdminCheckbox": { default: "input" }, "./AdminDataGridQueryStatus": { default: () => null },
    "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" }, "./AdminDataGridDateTimeCell": { default: () => null },
  });
  const onChange = () => {}, inputRef = { current: null };
  for (const presentation of [undefined, "default", "cinematic"]) {
    const checkbox = owner.AdminDataGridCheckbox({ presentation, checked: true, onChange, inputRef, label: "اختيار حالي" });
    assert.equal(checkbox.props.presentation, "native"); assert.equal(checkbox.props.checked, true);
    assert.equal(checkbox.props.onChange, onChange); assert.equal(checkbox.props.inputRef, inputRef);
    assert.equal(checkbox.props.className, selection.checkbox);
  }
  return true;
}
check("Semantic tables share navy selection, logical gold stripe, independent cool focus and native checkbox without changing table geometry", sharedSelectionContract());
const selectionMutant = patch => ({ ...refinementStyles, ADMIN_DATA_GRID_SELECTION: { ...refinementStyles.ADMIN_DATA_GRID_SELECTION, ...patch } });
const selectionMutants = [
  () => sharedSelectionContract(selectionMutant({ table: refinementStyles.ADMIN_DATA_GRID_SELECTION.table.replace("--admin-grid-selected,#102033)", "--admin-grid-brown,#1C1A11)") })),
  () => sharedSelectionContract(selectionMutant({ table: refinementStyles.ADMIN_DATA_GRID_SELECTION.table.replace(":before:start-0", ":before:right-0") })),
  () => sharedSelectionContract(selectionMutant({ table: refinementStyles.ADMIN_DATA_GRID_SELECTION.table.replaceAll(":has(:focus-visible)", ":focus-within") })),
  () => sharedSelectionContract(refinementStyles, entityTable.replace(": ADMIN_DATA_GRID_SELECTION.table", ': ""')),
];
check("Selection negatives reject diverging tokens, physical stripe placement, pointer focus and absent default adoption", selectionMutants.every(run => { try { run(); return false; } catch { return true; } }));

function officialGridFamilyContract(source = dataGrid, styles = refinementStyles, tableSource = entityTable) {
  for (const alias of [undefined, "default", "cinematic"]) assert.equal(styles.resolveAdminCollectionPresentation(alias), "cinematic");
  const owner = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", {
    ...metricTokenDependencies, "../../../lib/admin/admin-ui-styles": styles, "next/link": { default: SsrNextLink },
    "./AdminCheckbox": { default: "input" }, "./AdminDataGridQueryStatus": { default: () => null },
    "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" }, "./AdminDataGridDateTimeCell": { default: () => null },
  }, source);
  const child = React.createElement("span", { "data-existing-value": "" }, "قيمة قائمة");
  const row = owner.AdminDataGridRow({ columns: "46px 220px 144px", children: child, horizontalScroll: true, divided: true });
  assert.equal(row.type, "article"); assert.equal(row.props.children, child); assert.equal(row.props["data-admin-grid-row"], "");
  assert.equal(row.props.style.gridTemplateColumns, "46px 220px 144px"); assert.equal(row.props.style.columnGap, 0);
  assert.ok(row.props.className.includes(styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.legacyRow));
  assert.equal(elements(row, element => element.type === "input").length, 0, "Adoption never invents a selection input");
  const header = owner.AdminDataGridHeader({ columns: "46px 220px 144px", children: child, horizontalScroll: true });
  assert.ok(header.props.className.includes(styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.legacyHeader)); assert.equal(header.props.children, child);
  const checkboxCell = owner.AdminDataGridCheckboxCell({ children: child, sticky: true });
  assert.equal(checkboxCell.props["data-admin-grid-checkbox-cell"], ""); assert.equal(checkboxCell.props["data-admin-grid-sticky"], "inline-start");
  assert.match(styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.legacyRow, /:has\(>\[data-admin-grid-checkbox-cell\]_input:checked\)/u, "Legacy selection paint observes only an existing canonical selection cell");
  assert.match(styles.ADMIN_CINEMATIC_GOLD_V1.dataGrid.legacyRow, /first-child:not\(\[data-admin-grid-sticky\]\)\]:relative/u, "A selected row never releases an existing sticky checkbox");
  for (const alias of [undefined, "default", "cinematic"]) {
    const grid = owner.AdminDataGrid({ presentation: alias, children: child });
    assert.equal(grid.props["data-admin-data-grid-presentation"], "cinematic"); assert.equal(grid.props["data-admin-edge-motion"], "entry");
    assert.ok(grid.props.className.includes(styles.ADMIN_CINEMATIC_GOLD_V1.collection.frame));
  }
  const floor = tableSource.slice(tableSource.indexOf("    const safeFloor ="), tableSource.indexOf("    const reduction ="));
  assert.ok(floor.includes("sizingStrategy.preserveMinimumWidth") && !floor.includes('presentation ==='), "Responsive width policy is declared by sizing strategy, independently from presentation aliases");
  assert.match(topicsList, /sizingStrategy=\{\{ mode: "flexible", columnKey: "title", preserveMinimumWidth: true \}\}/u, "Topics retains its approved reading-width contract explicitly");
  assert.match(read("src/app/admin/projects/ProjectsTableClient.tsx"), /enableSelection=\{false\}/u, "Projects still has no selection or bulk capability added by presentation adoption");
  return true;
}
check("Official default and compatibility aliases adopt semantic, article and standalone grid families without new inputs or width-policy coupling", officialGridFamilyContract());
const officialGridMutants = [
  () => officialGridFamilyContract(dataGrid, { ...refinementStyles, resolveAdminCollectionPresentation: value => value ?? "default" }),
  () => officialGridFamilyContract(dataGrid.replace('${ADMIN_CINEMATIC_GOLD_V1.dataGrid.legacyRow}', "legacy-row-surface")),
  () => officialGridFamilyContract(dataGrid.replace('data-admin-edge-motion={embedded ? undefined : "entry"}', 'data-admin-edge-motion={undefined}')),
  () => officialGridFamilyContract(dataGrid, refinementStyles, entityTable.replace('sizingStrategy.preserveMinimumWidth', 'presentation === "cinematic"')),
];
check("Official grid negatives reject old-default leakage, a parallel article style, lost entry frame and presentation-coupled sizing", officialGridMutants.every(run => { try { run(); return false; } catch { return true; } }));

function sharedBulkPresentationContract(source = bulkBar) {
  const owner = loadPureTypeScriptModule("src/components/admin/ui/AdminBulkActionBar.tsx", {
    ...metricTokenDependencies,
    react: { ...React, useState: initial => [initial, () => {}], useRef: () => ({ current: null }) },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "./AdminConfirmDialog": { default: "owned-confirm-dialog" }, "./AdminListboxSelect": { default: "owned-listbox" },
  }, source).default;
  const onExecute = () => {}, onClearSelection = () => {};
  let cases = 0;
  const actions = [
    { value: "delete", danger: true },
    { value: "restore", danger: false },
    { value: "unrelated-command", tone: "danger", danger: true },
    { value: "move_to_trash", danger: false },
    { value: "permanent_delete", tone: "default", danger: false },
  ];
  for (const presentation of ["default", "cinematic"]) for (const action of actions) for (const isBusy of [false, true]) {
    const actionValue = action.value;
    const props = { presentation, selectedIds: [71, 72], entityLabel: "عنصر", options: [{ value: actionValue, label: "إجراء قائم", ...(action.tone ? { tone: action.tone } : {}) }], actionValue, isBusy, onExecute, onClearSelection, hiddenFields: { context: "retained" } };
    const tree = owner(props), token = refinementStyles.ADMIN_DATA_GRID_SELECTION;
    assert.equal(tree.type, "form"); assert.ok(tree.props.className.includes(token.bulk)); assert.equal(tree.props["aria-busy"], isBusy || undefined);
    const count = elements(tree, element => "data-admin-bulk-selected-count" in element.props)[0]; assert.equal(count.props.children, 2); assert.equal(count.props.className, token.bulkCount);
    const submit = elements(tree, element => element.type === "button" && element.props.type === "submit")[0];
    assert.equal(submit.props.disabled, isBusy); assert.equal(submit.props["data-admin-bulk-action-tone"], action.danger ? "danger" : "default");
    assert.ok(submit.props.className.includes(action.danger ? token.bulkDanger : refinementStyles.ADMIN_CINEMATIC_GOLD_V1.action.primary));
    const clear = elements(tree, element => element.type === "button" && element.props.type === "button")[0]; assert.equal(clear.props.onClick, onClearSelection); assert.equal(clear.props.disabled, isBusy);
    const actionControl = elements(tree, element => element.type === "owned-listbox")[0]; assert.equal(actionControl.props.disabled, isBusy); assert.equal(actionControl.props.value, actionValue);
    const fields = elements(tree, element => element.type === "input").map(element => [element.props.name, element.props.value]);
    assert.deepEqual(fields, [["context", "retained"], ["bulk_action", actionValue], ["ids", "71"], ["ids", "72"]]);
    cases += 1;
  }
  assert.equal(owner({ selectedIds: [], options: [], entityLabel: "عنصر", onClearSelection }), null);
  return cases;
}
check("Both Bulk presentations share the navy surface/count, preserve fields/pending, and use declared danger tone with only the existing delete fallback", sharedBulkPresentationContract() === 20);
const bulkPresentationMutants = [
  bulkBar.replace('resolvedOption?.tone === "danger" || resolvedAction === "delete"', 'resolvedAction === "delete"'),
  bulkBar.replace('resolvedOption?.tone === "danger" || resolvedAction === "delete"', 'resolvedOption?.tone === "danger"'),
  bulkBar.replace('resolvedOption?.tone === "danger" || resolvedAction === "delete"', 'resolvedOption?.tone === "danger" || resolvedAction.includes("delete") || resolvedAction === "move_to_trash"'),
  bulkBar.replace("${ADMIN_DATA_GRID_SELECTION.bulk}", "legacy-bulk-surface"),
  bulkBar.replace("disabled={isBusy}", "disabled={false}"),
  bulkBar.replace('name={idsFieldName}', 'name="unrelated_ids"'),
];
check("Bulk negatives reject lost danger semantics, a parallel surface, pending interaction and changed submitted IDs", bulkPresentationMutants.every(source => { assert.notEqual(source, bulkBar); try { sharedBulkPresentationContract(source); return false; } catch { return true; } }));

function bulkOptionPresentation(source, name) {
  const ast = ts.createSourceFile("consumer-bulk-options.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  ast.forEachChild(node => {
    if (ts.isVariableStatement(node)) declaration ??= node.declarationList.declarations.find(item => item.name.getText(ast) === name);
  });
  assert.ok(declaration?.initializer, `The existing ${name} declaration remains present`);
  const output = ts.transpileModule(`const ADMIN_BULK_ACTION_LABELS = {}; return (${declaration.initializer.getText(ast)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return Function(output)().map(({ value, tone }) => [value, tone]);
}
function declaredBulkDangerContract(topicSource = topicsList, categorySource = categoriesClient, seriesSource = seriesClient) {
  assert.deepEqual(bulkOptionPresentation(topicSource, "BULK_OPTIONS"), [["publish", undefined], ["unpublish", undefined], ["move_to_trash", "danger"], ["move_category", undefined], ["feature", undefined], ["unfeature", undefined]]);
  for (const source of [topicSource, categorySource, seriesSource]) assert.deepEqual(bulkOptionPresentation(source, "TRASH_BULK_OPTIONS"), [["restore", undefined], ["permanent_delete", "danger"]]);
  assert.deepEqual(bulkOptionPresentation(seriesSource, "BULK_OPTIONS"), [["publish", undefined], ["hide", undefined], ["delete", undefined]]);
  return true;
}
check("Topics and taxonomy declare existing destructive bulk choices as presentation metadata without changing action order or keys", declaredBulkDangerContract());
check("Consumer danger negatives reject lost metadata without inventing domain action inference", [
  () => declaredBulkDangerContract(topicsList.replace('tone: "danger"', 'tone: "default"')),
  () => declaredBulkDangerContract(topicsList, categoriesClient.replace('tone: "danger"', 'tone: "default"')),
  () => declaredBulkDangerContract(topicsList, categoriesClient, seriesClient.replace('tone: "danger"', 'tone: "default"')),
].every(run => { try { run(); return false; } catch { return true; } }));

check("Actual action Button keeps default SSR and 44/40/28px controls while opting into existing 18/22px glyphs", actionGlyphContract() === 240);
const actionGlyphMutants = [
  dataGrid.replace('iconSize = "sm"', 'iconSize = "lg"'),
  dataGrid.replace("size={iconSize}", 'size="sm"'),
  dataGrid.replace("disabled={disabled || pending}", "disabled={disabled}"),
  dataGrid.replaceAll("prefetch={false}", "prefetch={true}"),
];
check("Action glyph negatives reject changed defaults, ignored opt-in, pending interaction and prefetch regressions", actionGlyphMutants.every(source => {
  if (source === dataGrid) return false;
  try { actionGlyphContract(source); return false; } catch { return true; }
}));
function rowActionGlyphPassThrough(source = rowActions) {
  const ast = ts.createSourceFile("AdminDataGridRowActions.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "AdminDataGridRowActions");
  const parameter = owner?.parameters[0].name;
  assert.ok(parameter && ts.isObjectBindingPattern(parameter));
  const glyphSize = parameter.elements.find(node => node.name.getText(ast) === "iconSize");
  assert.equal(glyphSize?.initializer?.getText(ast), '"sm"', "Existing Row Actions consumers keep the small default glyph");
  const calls = [];
  function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(ast) === "AdminDataGridActionButton") {
      const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(ast) === "iconSize");
      assert.ok(attribute?.initializer && ts.isJsxExpression(attribute.initializer));
      assert.equal(attribute.initializer.expression?.getText(ast), "iconSize", "Every primary, status and More button must use the consumer's chosen glyph size");
      calls.push(attribute);
    }
    ts.forEachChild(node, visit);
  }
  visit(owner);
  assert.equal(calls.length, 3, "The actual primary, inline status and More button callsites remain reachable");
  return { ast, calls };
}
check("Shared Row Actions forwards one optional glyph size to actual primary, inline status and More buttons", Boolean(rowActionGlyphPassThrough()));
const rowGlyphCalls = rowActionGlyphPassThrough();
const rowGlyphMutants = [
  ...rowGlyphCalls.calls.map(attribute => rowActions.slice(0, attribute.getStart(rowGlyphCalls.ast)) + rowActions.slice(attribute.end)),
  rowActions.replace('iconSize = "sm"', 'iconSize = "lg"'),
];
check("Row glyph negatives reject omitted forwarding at each real button and changed shared defaults", rowGlyphMutants.every(source => {
  if (source === rowActions) return false;
  try { rowActionGlyphPassThrough(source); return false; } catch { return true; }
}));
function refinedMetricPaintContract(styles = refinementStyles) {
  const metric = styles.ADMIN_CINEMATIC_GOLD_V1.metric, classes = new Set(metric.surfaceClassName.split(/\s+/u));
  for (const token of ["border-[color:color-mix(in_srgb,var(--admin-metric-color)_25%,transparent)]", "shadow-[inset_0_2px_0_color-mix(in_srgb,var(--admin-metric-color)_60%,transparent),inset_0_8px_18px_color-mix(in_srgb,var(--admin-metric-color)_9%,transparent),0_0_18px_color-mix(in_srgb,var(--admin-metric-color)_8%,transparent),0_20px_45px_rgba(0,0,0,0.65)]", "hover:border-[color:color-mix(in_srgb,var(--admin-metric-color)_75%,transparent)]", "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_color-mix(in_srgb,var(--admin-metric-color)_12%,transparent)]"]) assert.ok(classes.has(token), "Premium Hybrid changes only approved normal paint and retains existing hover: " + token);
  assert.equal(metric.activeClassName, "ring-1 ring-[color:var(--admin-metric-color)] border-[color:var(--admin-metric-color)]", "Pressed KPI retains the full semantic ring and border independently of the normal shadow");
  for (const [tone, token] of Object.entries(styles.ADMIN_CINEMATIC_GOLD_V1.tones)) assert.match(token, /^\[--admin-metric-color:#[\da-f]{6}\]$/iu, "Every actual semantic tone supplies the production color variable: " + tone);
  for (const token of ["min-h-[132px]", "rounded-2xl", "p-3", "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-[#EDC878]"]) assert.ok(classes.has(token), "Premium Hybrid preserves geometry and keyboard focus: " + token);
  return true;
}
check("Premium Hybrid KPI normal paint uses all semantic colors with exact approved light/depth layers and preserved Hover/Pressed/Focus contracts", refinedMetricPaintContract());
const metricPaintMutants = ["_25%,transparent)", "_60%,transparent)", "_9%,transparent)", "_8%,transparent)", "0_20px_45px_rgba(0,0,0,0.65)", "hover:border-[color:color-mix(in_srgb,var(--admin-metric-color)_75%,transparent)]", "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_color-mix(in_srgb,var(--admin-metric-color)_12%,transparent)]"].map(value => () => { const metric = refinementStyles.ADMIN_CINEMATIC_GOLD_V1.metric; assert.ok(metric.surfaceClassName.includes(value), "Premium Hybrid negative remains reachable: " + value); return refinedMetricPaintContract({ ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, metric: { ...metric, surfaceClassName: metric.surfaceClassName.replace(value, "fixture-unapproved-paint") } } }); });
metricPaintMutants.push(() => refinedMetricPaintContract({ ...refinementStyles, ADMIN_CINEMATIC_GOLD_V1: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1, metric: { ...refinementStyles.ADMIN_CINEMATIC_GOLD_V1.metric, activeClassName: "border-transparent" } } }));
check("Premium Hybrid negatives reject each changed border/light/depth layer, lost existing hover and erased active ring", metricPaintMutants.every(run => { try { run(); return false; } catch { return true; } }));
function metricContract(source = read(metricCardPath)) {
  const Card = loadPureTypeScriptModule(metricCardPath, metricTokenDependencies, source).default;
  let calls = 0;
  const onClick = () => { calls += 1; };
  const icon = React.createElement("svg", { "data-metric-probe": "" });
  for (const presentation of [undefined, "default", "cinematic"]) for (const active of [false, true]) {
    const tree = Card({ label: "مقياس", value: 42, suffix: "/100", icon, active, onClick, ariaLabel: "تصفية المقياس", presentation });
    assert.equal(tree.type, "button");
    assert.equal(tree.props.type, "button");
    assert.equal(tree.props["aria-pressed"], active);
    assert.equal(tree.props["aria-label"], "تصفية المقياس");
    assert.equal(tree.props.onClick, onClick);
    assert.equal(tree.props["data-admin-metric-presentation"], "cinematic");
    assert.ok(tree.props.className.includes(metricTokenDependencies["../../../lib/admin/admin-ui-styles"].ADMIN_CINEMATIC_GOLD_V1.metric.surfaceClassName));
    tree.props.onClick();
    const content = elements(tree, element => "data-admin-metric-content" in element.props);
    const glyph = elements(tree, element => "data-admin-metric-icon" in element.props);
    assert.equal(content.length, 1);
    assert.equal(glyph.length, 1);
    assert.equal(glyph[0].props["aria-hidden"], "true");
    assert.equal(elements(glyph[0], element => element.type === "p").length, 0);
    const paragraphs = elements(content[0], element => element.type === "p");
    assert.equal(paragraphs.length, 2);
    assert.equal(renderToStaticMarkup(paragraphs[1]).replace(/<[^>]+>/gu, ""), "42/100");
    assert.equal(renderToStaticMarkup(paragraphs[0]).replace(/<[^>]+>/gu, ""), "مقياس");
    assert.equal(elements(content[0], element => "data-metric-probe" in element.props).length, 0);
  }
  assert.equal(calls, 6);
  const staticTree = Card({ label: "ثابت", value: 0 });
  assert.equal(staticTree.type, "div");
  assert.equal(staticTree.props.onClick, undefined);
  assert.equal(staticTree.props.type, undefined);
  assert.equal(staticTree.props["aria-pressed"], undefined);
  assert.equal(elements(staticTree, element => "data-admin-metric-icon" in element.props).length, 0);
  assert.equal(elements(staticTree, element => "data-admin-metric-content" in element.props).length, 1);
  assert.equal(staticTree.props.tabIndex, undefined);
  const labelled = Card({ label: "افتراضي", value: 1, onClick });
  assert.equal(labelled.props["aria-label"], "افتراضي");
  return Card;
}
const MetricCard = metricContract();
function metricDescriptionContract(source = read(metricCardPath), gridSource = read(metricGridPath)) {
  const Card = loadPureTypeScriptModule(metricCardPath, metricTokenDependencies, source).default;
  const Grid = loadPureTypeScriptModule(metricGridPath, { ...metricTokenDependencies, "./AdminMetricCard": { default: Card } }, gridSource).default;
  const props = { label: "إعدادات", value: 4 };
  const baseline = renderToStaticMarkup(Card(props));
  for (const description of [undefined, null, false]) assert.equal(renderToStaticMarkup(Card({ ...props, description })), baseline, "Omitted descriptions preserve every existing default byte");
  for (const tone of ["neutral", "red"]) for (const description of ["المعروض فقط؛ ليست إجماليًا عالميًا", 0]) {
    const tree = Card({ ...props, tone, description });
    assert.ok(tree.props.className.includes(metricTokenDependencies["../../../lib/admin/admin-ui-styles"].ADMIN_CINEMATIC_GOLD_V1.tones[tone]));
    const helper = elements(tree, node => "data-admin-metric-description" in node.props);
    assert.equal(helper.length, 1); assert.equal(helper[0].props.children, description);
    assert.equal(helper[0].props.className, metricTokenDependencies["../../../lib/admin/admin-ui-styles"].ADMIN_CINEMATIC_GOLD_V1.metric.descriptionClassName);
    assert.equal(tree.props.onClick, undefined, "Operational summaries remain read-only");
    const grid = Grid({ items: [{ ...props, tone, description }] });
    const card = elements(grid, node => node.type === Card)[0];
    assert.equal(card.props.description, description); assert.equal(card.props.tone, tone);
  }
  return true;
}
check("Shared Metric descriptions and neutral/red semantic tones preserve omitted defaults and Grid forwarding", metricDescriptionContract());
check("Metric helper regressions reject lost explanatory truth, lost canonical typography and dropped Grid forwarding", [
  [read(metricCardPath).replace('data-admin-metric-description=""', 'data-lost-description=""'), read(metricGridPath)],
  [read(metricCardPath).replace("className={cinematic.descriptionClassName}", 'className="text-xs"'), read(metricGridPath)],
  [read(metricCardPath), read(metricGridPath).replace("{...item}", "{...item} description={undefined}")],
].every(([cardSource, gridSource]) => { try { metricDescriptionContract(cardSource, gridSource); return false; } catch { return true; } }));
check("Actual Metric Card preserves value/label hierarchy, decorative icon isolation and button commands", Boolean(MetricCard));
const metricMutants = [
  read(metricCardPath).replace("resolveAdminCollectionPresentation(presentation)", "presentation"),
  read(metricCardPath).replace('data-admin-metric-presentation="cinematic"', 'data-admin-metric-presentation="default"'),
  read(metricCardPath).replaceAll('data-admin-metric-icon="" aria-hidden="true"', 'data-admin-metric-icon=""'),
  read(metricCardPath).replace('onClick ? "button" : "div"', '"div"'),
  read(metricCardPath).replace('            onClick,', '            onClick: () => {},'),
  read(metricCardPath).replace('"aria-pressed": active', '"aria-pressed": false'),
  read(metricCardPath).replace(/\{value\}\r?\n/u, '{label}\n'),
];
check("Metric owner negatives reject hidden semantics, swallowed actions, fixed active state and changed values", metricMutants.every(source => {
  if (source === read(metricCardPath)) return false;
  try { metricContract(source); return false; } catch { return true; }
}));
function metricArtworkContract(source = read(metricCardPath)) {
  const Card = loadPureTypeScriptModule(metricCardPath, metricTokenDependencies, source).default;
  const names = ["content", "published", "projects", "pages", "media", "taxonomy", "unpublished", "series", "featured", "seo"];
  const scenes = [];
  for (const artwork of names) {
    const props = { label: "مؤشر", value: 19, artwork };
    assert.equal(renderToStaticMarkup(Card(props)), renderToStaticMarkup(Card({ ...props, presentation: "default" })), "Legacy default and omitted presentation forward the same explicitly requested artwork");
    assert.equal(renderToStaticMarkup(Card(props)), renderToStaticMarkup(Card({ ...props, presentation: "cinematic" })), "Every presentation alias resolves to the same official visual owner");
    const tree = Card({ ...props, presentation: "cinematic" });
    const nodes = elements(tree, element => "data-admin-metric-artwork" in element.props);
    assert.equal(nodes.length, 1); const scene = nodes[0];
    assert.equal(scene.type, "svg"); assert.equal(scene.props["data-admin-metric-artwork"], artwork);
    assert.equal(scene.props["aria-hidden"], "true"); assert.equal(scene.props.focusable, "false");
    assert.ok(scene.props.className.includes("pointer-events-none"));
    assert.ok(elements(scene, element => element.type === "path").length > 0);
    assert.equal(elements(scene, element => element.type === "text" || element.type === "button" || element.type === "a").length, 0, "Decorative artwork has no invented data or interactive controls");
    scenes.push(elements(scene, element => element.type === "path").map(element => element.props.d).join("|"));
  }
  assert.equal(new Set(scenes).size, names.length, "Each optional semantic scene has distinct path geometry");
  assert.equal(elements(Card({ label: "بدون رسم", value: 0, presentation: "cinematic" }), element => "data-admin-metric-artwork" in element.props).length, 0, "Cinematic cards still require an explicit artwork choice");
  return names.length;
}
check("Actual Metric artwork remains ten explicit decorative scenes through the official default and aliases", metricArtworkContract() === 10);
const artworkMutants = [
  read(metricCardPath).replace("{artwork ? (", "{false ? ("),
  read(metricCardPath).replace(/            aria-hidden="true"(\r?\n)            focusable="false"/u, '            aria-hidden="false"$1            focusable="false"'),
  read(metricCardPath).replace('focusable="false"', 'focusable="true"'),
  read(metricCardPath).replace("ARTWORK_PATHS[artwork].map", "ARTWORK_PATHS.content.map"),
];
check("Metric artwork negatives reject lost adoption, exposed/focusable decoration and a repeated scene", artworkMutants.every(source => {
  if (source === read(metricCardPath)) return false;
  try { metricArtworkContract(source); return false; } catch { return true; }
}));
const MetricGrid = loadPureTypeScriptModule(metricGridPath, { ...metricTokenDependencies, "./AdminMetricCard": { default: MetricCard } }).default;
const gridItems = Array.from({ length: 7 }, (_, index) => ({ label: `مقياس ${index}`, value: index, active: index === 2, artwork: index % 2 ? "content" : undefined, onClick: index < 6 ? () => index : undefined }));
const gridTree = MetricGrid({ items: gridItems });
const actualCards = elements(gridTree, element => element.type === MetricCard);
check("Actual Metric Grid retains all seven ordered values, active state and exact callback identities", actualCards.length === gridItems.length && actualCards.every((element, index) => {
  const { label, value, active, onClick } = element.props;
  return label === gridItems[index].label && value === index && active === gridItems[index].active && onClick === gridItems[index].onClick;
}));
check("Actual metric viewport retains its bleed boundary without forcing a horizontal scrollport", "data-admin-metric-cards-viewport" in gridTree.props && !/\boverflow-x-(?:auto|scroll)\b/u.test(gridTree.props.className));
const cinematicGrid = MetricGrid({ items: gridItems, presentation: "cinematic", ariaLabel: "مؤشرات تجريبية" });
const cinematicCards = elements(cinematicGrid, element => element.type === MetricCard);
function metricGridDefaultContract(source = read(metricGridPath)) {
  const Grid = loadPureTypeScriptModule(metricGridPath, { ...metricTokenDependencies, "./AdminMetricCard": { default: MetricCard } }, source).default;
  for (const presentation of [undefined, "default", "cinematic"]) {
    const tree = Grid({ items: gridItems, presentation, ariaLabel: "مؤشرات تجريبية" });
    const section = elements(tree, element => element.type === "section")[0];
    assert.equal(section.props["data-admin-metric-grid-presentation"], "cinematic");
    assert.equal(section.props.className, metricTokenDependencies["../../../lib/admin/admin-ui-styles"].ADMIN_CINEMATIC_GOLD_V1.metric.gridClassName);
    assert.equal(section.props["aria-label"], "مؤشرات تجريبية");
    assert.deepEqual(section.props.style, { "--admin-metric-cols": 2, "--admin-metric-cols-md": 3, "--admin-metric-cols-xl": 6 });
    const cards = elements(tree, element => element.type === MetricCard);
    assert.equal(cards.length, gridItems.length);
    cards.forEach((element, index) => { assert.equal(element.props.presentation, "cinematic"); assert.equal(element.props.onClick, gridItems[index].onClick); assert.equal(element.props.artwork, gridItems[index].artwork); assert.equal(element.props.label, gridItems[index].label); assert.equal(element.props.value, gridItems[index].value); assert.equal(element.props.active, gridItems[index].active); });
  }
  for (const count of [0, 1, 3, 5, 6, 7]) {
    const tree = Grid({ items: gridItems.slice(0, count) }), section = elements(tree, element => element.type === "section")[0];
    const actualCount = Math.max(1, count);
    assert.deepEqual(section.props.style, { "--admin-metric-cols": Math.min(2, actualCount), "--admin-metric-cols-md": Math.min(3, actualCount), "--admin-metric-cols-xl": Math.min(6, actualCount) });
    assert.equal(elements(tree, element => element.type === MetricCard).length, count);
  }
  return true;
}
check("All Metric Grid default aliases forward official geometry, ordered items, exact commands, artwork and palette to the same Card owner", metricGridDefaultContract() && cinematicCards.length === gridItems.length && actualCards.every(element => element.props.presentation === "cinematic"));
check("Metric Grid negatives reject a legacy presentation fallback or lost official forwarding", [
  read(metricGridPath).replace("resolveAdminCollectionPresentation(presentation)", "presentation"),
  read(metricGridPath).replace("presentation={resolvedPresentation}", 'presentation="default"'),
  read(metricGridPath).replace("ADMIN_CINEMATIC_GOLD_V1.metric.gridClassName", '"grid grid-cols-1"'),
  read(metricGridPath).replace("Math.min(6, count)", "6"),
].every(source => { if (source === read(metricGridPath)) return false; try { metricGridDefaultContract(source); return false; } catch { return true; } }));

// Discover JSX consumers from actual imports, including renamed default/named
// bindings. The owner contract above applies to every omitted/default mount;
// a handpicked Categories assertion alone would miss the same recurrence.
function discoverMetricMounts(directory = resolve(ROOT, "src")) {
  const mounts = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) { mounts.push(...discoverMetricMounts(file)); continue; }
    if (!file.endsWith(".tsx")) continue;
    const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), names = new Map();
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) || !node.importClause || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const owner = node.moduleSpecifier.text.match(/(?:^|\/)(AdminMetricCardsGrid|AdminMetricCard)$/u)?.[1];
      if (owner && node.importClause.name) names.set(node.importClause.name.text, owner);
      if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) for (const item of node.importClause.namedBindings.elements) if (["AdminMetricCard", "AdminMetricCardsGrid"].includes((item.propertyName ?? item.name).text)) names.set(item.name.text, (item.propertyName ?? item.name).text);
    }
    const visit = node => { if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && names.has(node.tagName.getText(ast))) { const presentation = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(ast) === "presentation"); mounts.push({ file, owner: names.get(node.tagName.getText(ast)), line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, presentation: presentation?.initializer?.getText(ast) ?? "omitted" }); } ts.forEachChild(node, visit); };
    visit(ast);
  }
  return mounts;
}
const metricMounts = discoverMetricMounts();
check("Actual imported KPI JSX consumer discovery covers direct and Grid forwarding mounts with canonical default contracts", metricMounts.some(row => row.owner === "AdminMetricCard" && row.file.endsWith("AdminDashboardView.tsx")) && ["CategoriesListClient.tsx", "SeriesTableClient.tsx", "TopicsListClient.tsx", "construction-updates/page.tsx"].every(suffix => metricMounts.some(row => row.file.replaceAll("\\", "/").endsWith(suffix))) && metricMounts.every(row => row.owner === "AdminMetricCard" || row.owner === "AdminMetricCardsGrid") && metricGridDefaultContract());

function metricConsumerVisualContract({ sourceOverrides = {}, manifest = loadPureTypeScriptModule("src/lib/admin/interaction-system/adoption-manifest.ts") } = {}) {
  const contracts = manifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(surface => surface.visualPresentation?.metricCards ?? []);
  const actualConsumerFiles = [...new Set(metricMounts.map(row => row.file.replaceAll("\\", "/").replace(ROOT.replaceAll("\\", "/") + "/", "")).filter(file => file !== metricGridPath))].sort();
  assert.deepEqual(contracts.map(contract => contract.sourceFile).sort(), actualConsumerFiles, "Every actual canonical KPI consumer needs its own visual contract; shared component reach is insufficient");
  let items = 0;
  for (const contract of contracts) {
    const source = sourceOverrides[contract.sourceFile] ?? read(contract.sourceFile), ast = ts.createSourceFile(contract.sourceFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const property = (node, name) => node.properties.find(item => ts.isPropertyAssignment(item) && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name)?.initializer;
    const arrays = [];
    const visit = node => {
      if (ts.isArrayLiteralExpression(node) && node.elements.length && node.elements.every(ts.isObjectLiteralExpression)) {
        const labels = node.elements.map(item => property(item, "label"));
        if (labels.every(label => label && ts.isStringLiteral(label)) && node.elements.every(item => property(item, "value") && property(item, "icon"))) arrays.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    const candidates = arrays.filter(array => array.elements.some(item => contract.items.some(expected => property(item, "label")?.text === expected.label)));
    assert.equal(candidates.length, 1, `${contract.sourceFile} retains one real KPI item array`);
    const array = candidates[0];
    assert.deepEqual(array.elements.map(item => property(item, "label")?.text), contract.items.map(item => item.label), "Ordered original labels/card count remain consumer-owned");
    for (const [index, node] of array.elements.entries()) {
      const expected = contract.items[index], artwork = property(node, "artwork"), icon = property(node, "icon");
      assert.equal(expected.icon, "required", "Applicable foreground icons cannot be downgraded to optional metadata");
      assert.ok(icon && icon.kind !== ts.SyntaxKind.NullKeyword && icon.kind !== ts.SyntaxKind.FalseKeyword && icon.getText(ast) !== "undefined", `${expected.label} retains its actual foreground icon`);
      assert.ok(artwork && ts.isStringLiteral(artwork), `${expected.label} explicitly adopts its applicable semantic artwork`);
      assert.equal(artwork.text, expected.artwork, `${expected.label} uses its declared semantic scene`);
      const tree = MetricCard({ label: expected.label, value: 0, icon: React.createElement("svg", { "data-actual-consumer-icon-source": icon.getText(ast) }), artwork: artwork.text });
      assert.equal(elements(tree, element => element.props["data-admin-metric-artwork"] === expected.artwork).length, 1, "The declared visual atom reaches the real Card output");
      assert.equal(elements(tree, element => element.props["data-actual-consumer-icon-source"] === icon.getText(ast)).length, 1);
      assert.equal(elements(tree, element => element.type === "h1").length, 0);
      items += 1;
    }
  }
  return items;
}
check("Every actual canonical KPI consumer fulfills its own ordered label/icon/artwork contract and renders those atoms through the existing Card owner", metricConsumerVisualContract() > 0);
const metricVisualManifest = loadPureTypeScriptModule("src/lib/admin/interaction-system/adoption-manifest.ts");
const metricVisualRequirements = metricVisualManifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(surface => surface.visualPresentation?.metricCards ?? []);
const metricConsumerVisualMutants = metricVisualRequirements.flatMap(contract => {
  const source = read(contract.sourceFile), first = contract.items[0];
  const ast = ts.createSourceFile(contract.sourceFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let artwork, icon;
  const visit = node => {
    if (ts.isObjectLiteralExpression(node)) {
      const label = node.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(ast) === "label")?.initializer;
      if (label && ts.isStringLiteral(label) && label.text === first.label) {
        artwork = node.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(ast) === "artwork");
        icon = node.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(ast) === "icon")?.initializer;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(artwork && icon, "Product mutation targets a real applicable visual item");
  return [
    { sourceOverrides: { [contract.sourceFile]: source.slice(0, artwork.initializer.getStart(ast)) + '"' + (first.artwork === "content" ? "series" : "content") + '"' + source.slice(artwork.initializer.end) } },
    { sourceOverrides: { [contract.sourceFile]: source.slice(0, artwork.getStart(ast)) + source.slice(artwork.end).replace(/^\s*,/u, "") } },
    { sourceOverrides: { [contract.sourceFile]: source.slice(0, icon.getStart(ast)) + "null" + source.slice(icon.end) } },
  ];
});
const incompleteMetricManifest = loadPureTypeScriptModule("src/lib/admin/interaction-system/adoption-manifest.ts");
const firstMetricVisualSurface = incompleteMetricManifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(surface => surface.visualPresentation?.metricCards);
delete firstMetricVisualSurface.visualPresentation.metricCards;
metricConsumerVisualMutants.push({ manifest: incompleteMetricManifest });
check("Per-consumer visual negatives reject missing or incorrect artwork, lost foreground icons and an unregistered applicable KPI consumer despite canonical component use", metricConsumerVisualMutants.every(input => { try { metricConsumerVisualContract(input); return false; } catch { return true; } }));

function verifyRecoveryMetricTruth(source = read("src/app/admin/settings/media/MediaRecoveryCenter.tsx")) {
  const tree = ts.createSourceFile("MediaRecoveryCenter.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const mounts = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminMetricCardsGrid") mounts.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(mounts.length, 1);
  let projection = mounts[0].parent;
  while (projection && !ts.isJsxExpression(projection)) projection = projection.parent;
  assert.ok(projection?.expression, "The actual Recovery render condition owns its summary projection");
  const code = ts.transpileModule(`export function project(queue) { return ${projection.expression.getText(tree)}; }`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiled = {};
  new Function("React", "AdminMetricCardsGrid", "AdminModuleTabIcon", "exports", code)(React, MetricGrid, () => React.createElement("svg"), compiled);
  for (const queue of [null, { available: false, counts: null }]) assert.equal(Boolean(compiled.project(queue)), false, "Unavailable counts cannot render a zero-valued summary");
  const labels = ["عمليات حذف متوقفة", "أصول مفقودة أو غير مؤكدة", "عمليات حفظ غير محلولة"];
  for (const values of [[7, 0, 2], [0, 0, 0]]) for (const truncated of [false, true]) {
    const node = compiled.project({ available: true, truncated, counts: { stuckDeletes: values[0], missingOrUncertainAssets: values[1], unresolvedLeaseBatches: values[2] } });
    assert.equal(node.type, MetricGrid, "Recovery projects through the existing shared Grid");
    assert.deepEqual(node.props.items.map(item => item.value), values, "The displayed counts retain the authoritative available queue values including zero");
    assert.deepEqual(node.props.items.map(item => item.label), labels.map(label => label + (truncated ? " (المعروضة)" : "")), "A truncated queue names displayed counts explicitly");
  }
  return true;
}
check("Recovery shared Metric projection preserves availability, actual zero counts and truncated displayed-only labels", verifyRecoveryMetricTruth());
const recoveryMetricSource = read("src/app/admin/settings/media/MediaRecoveryCenter.tsx");
check("Recovery Metric truth rejects fabricated availability, changed counts and lost displayed-only labels", [
  recoveryMetricSource.replace(/queue\?\.available \? \((\s*<AdminMetricCardsGrid)/u, 'true ? ($1'),
  recoveryMetricSource.replace('value: queue.counts.stuckDeletes', 'value: 0'),
  recoveryMetricSource.replace('queue.truncated ? item.label + " (المعروضة)" : item.label', 'item.label'),
].every(source => {
  assert.notEqual(source, recoveryMetricSource, "The negative control changes the actual Recovery projection");
  assert.throws(() => verifyRecoveryMetricTruth(source));
  return true;
}));

// The neutral token resolves once to CSS; overflow remains a consumer concern.
async function verifyScrollbarUtility() {
  const tree = postcss.parse(read("src/app/globals.css"));
  const definitions = [];
  tree.walkAtRules("utility", node => { if (node.params === "venesia-scrollbar") definitions.push(node); });
  assert.equal(definitions.length, 1);
  const definition = definitions[0];
  const applies = definition.nodes.filter(node => node.type !== "comment");
  assert.equal(applies.length, 1);
  assert.equal(applies[0].name, "apply");
  const tokens = applies[0].params.split(/\s+/u);
  assert.ok(tokens.length > 0 && tokens.every(token => /scrollbar/u.test(token)));
  const adoption = [];
  tree.walkAtRules("apply", node => { if (node.params === "venesia-scrollbar") adoption.push(node); });
  assert.equal(adoption.length, 1);
  assert.deepEqual(adoption[0].parent.selectors, ["html:has([data-admin-shell])", "html:has([data-admin-shell]) body", ":where([data-admin-shell], [data-admin-shell] *)"]);
  assert.equal(adoption[0].parent.nodes.filter(node => node.type !== "comment").length, 1);
  const options = { base: ROOT, onDependency() {} };
  const direct = await compile('@import "tailwindcss";', options);
  const named = await compile('@import "tailwindcss";\n' + definition.toString(), options);
  function declarations(css) {
    const result = {};
    postcss.parse(css).walkDecls(decl => {
      const ancestors = [];
      for (let parent = decl.parent; parent; parent = parent.parent) ancestors.push(parent);
      if (!ancestors.some(parent => parent.type === "atrule" && parent.name === "layer" && parent.params === "utilities")) return;
      const selector = ancestors.filter(parent => parent.type === "rule").map(parent => parent.selector).join(" ");
      const pseudo = selector.includes("::-webkit-scrollbar-thumb") ? "thumb" : selector.includes("::-webkit-scrollbar-track") ? "track" : selector.includes("::-webkit-scrollbar") ? "scrollbar" : "element";
      const media = ancestors.filter(parent => parent.type === "atrule" && parent.name === "media").map(parent => parent.params).join("|");
      result[[pseudo, selector.includes(":hover"), media, decl.prop].join("|")] = decl.value;
    });
    return result;
  }
  const inlineDeclarations = declarations(direct.build(tokens));
  const namedDeclarations = declarations(named.build(["venesia-scrollbar"]));
  assert.deepEqual(namedDeclarations, inlineDeclarations);
  assert.equal(Object.keys(namedDeclarations).length, 9);
  for (const key of Object.keys(namedDeclarations)) {
    const [pseudo, , , property] = key.split("|");
    assert.ok(["scrollbar-width", "scrollbar-color", "border-radius", "background-color", "height", "width"].includes(property));
    if (["height", "width"].includes(property)) assert.equal(pseudo, "scrollbar");
  }
  return { declarations: namedDeclarations, selectors: adoption[0].parent.selectors };
}
const scrollbarUtility = await verifyScrollbarUtility();
check("Installed Tailwind compiles the single scoped scrollbar utility to the same nine visual declarations", Boolean(scrollbarUtility));
const tabDependencies = {
  react: React,
  "./AdminForm": {},
  "./AdminDataGrid": loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", {
    ...metricTokenDependencies,
    "next/link": { default: SsrNextLink },
    "./AdminCheckbox": { default: () => null },
    "./AdminDataGridQueryStatus": { default: () => null },
    "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: "" },
    "./AdminDataGridDateTimeCell": { default: () => null },
  }),
  "../../../lib/admin/admin-ui-styles": loadPureTypeScriptModule("src/lib/admin/admin-ui-styles.ts", {
    "../../components/venesia-scrollbar-styles": loadPureTypeScriptModule("src/components/venesia-scrollbar-styles.ts"),
  }),
};
const currentTabs = loadPureTypeScriptModule(metricTabsPath, tabDependencies);
const newGlyphs = ["database", "statistics"].map(name => renderToStaticMarkup(React.createElement(currentTabs.AdminModuleTabIcon, { name })));
check("Metric semantic glyphs are distinct decorative SVGs in the existing icon owner", newGlyphs.every(markup => markup.includes("<svg") && markup.includes('aria-hidden="true"')) && newGlyphs[0] !== newGlyphs[1]);
check("Existing editor and nowrap tab scrollports retain native scrolling without hidden-scrollbar overrides", !/scrollbar-width:none|webkit-scrollbar\]:hidden|-ms-overflow-style:none/u.test(read(metricTabsPath)) && read(metricTabsPath).includes("overflow-x-auto overscroll-x-contain"));

// Optional local receipt compares the phase's exact originals, never Git HEAD.
const baselineArgument = process.argv.find(argument => argument.startsWith("--baseline-file="));
if (baselineArgument) {
  const baselinePath = resolve(ROOT, baselineArgument.slice("--baseline-file=".length));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const hash = value => createHash("sha256").update(value).digest("hex");
  const before = path => {
    const entry = baseline.entries.find(item => item.path === path);
    assert.ok(entry, `Missing baseline ${path}`);
    const bytes = entry.content ? Buffer.from(entry.content, "base64") : readFileSync(resolve(dirname(baselinePath), "baseline", path));
    assert.equal(hash(bytes), entry.sha256.toLowerCase(), `Baseline hash ${path}`);
    return bytes.toString("utf8");
  };
  const parse = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const canonical = (sourceFile, transformer) => {
    const transformed = ts.transform(sourceFile, [transformer]);
    const structure = node => {
      const children = [];
      ts.forEachChild(node, child => { children.push(structure(child)); });
      return { kind: node.kind, text: !ts.isSourceFile(node) && typeof node.text === "string" ? (ts.isJsxText(node) ? node.text.replace(/\s+/gu, " ").trim() : node.text) : undefined, isTypeOnly: node.isTypeOnly, children };
    };
    try { return JSON.stringify(structure(transformed.transformed[0])); } finally { transformed.dispose(); }
  };
  const consumers = ["src/components/admin/content/TopicsListClient.tsx", "src/app/admin/content/categories/CategoriesListClient.tsx", "src/app/admin/content/series/SeriesTableClient.tsx", "src/app/admin/projects/construction-updates/page.tsx"];
  const consumerProof = consumers.map(path => {
    const original = before(path), current = read(path), oldAst = parse(path, original), ast = parse(path, current);
    const oldImports = new Set();
    for (const statement of oldAst.statements) if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) for (const item of statement.importClause.namedBindings.elements) oldImports.add(item.name.text);
    const arrays = [];
    function collect(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "metricItems" && node.initializer && ts.isArrayLiteralExpression(node.initializer)) arrays.push(node.initializer);
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "items" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isArrayLiteralExpression(node.initializer.expression)) arrays.push(node.initializer.expression);
      ts.forEachChild(node, collect);
    }
    collect(ast);
    assert.equal(arrays.length, 1);
    const items = new Set(arrays[0].elements);
    const labels = [], commands = [];
    for (const item of items) {
      assert.ok(ts.isObjectLiteralExpression(item));
      const property = name => item.properties.find(candidate => ts.isPropertyAssignment(candidate) && candidate.name.getText(ast) === name)?.initializer;
      const label = property("label"), icon = property("icon");
      assert.ok(label && ts.isStringLiteral(label)); labels.push(label.text);
      if (property("onClick")) commands.push(property("onClick").getText(ast));
      assert.ok(icon && ts.isJsxSelfClosingElement(icon));
      assert.ok(["AdminModuleTabIcon", "AdminDataGridActionIcon"].includes(icon.tagName.getText(ast)));
    }
    const normalize = context => {
      const visit = node => {
        if (items.has(node)) return ts.factory.updateObjectLiteralExpression(node, node.properties.filter(property => !(ts.isPropertyAssignment(property) && property.name.getText(ast) === "icon")));
        if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          const bindings = node.importClause.namedBindings;
          const retained = bindings.elements.filter(item => {
            if (oldImports.has(item.name.text)) return true;
            assert.ok(["AdminModuleTabIcon", "AdminDataGridActionIcon"].includes(item.name.text), `Unexpected added import ${item.name.text}`);
            assert.equal((item.propertyName ?? item.name).text, item.name.text);
            const owner = item.name.text === "AdminModuleTabIcon" ? "AdminModuleTabs" : "AdminDataGrid";
            assert.equal(resolve(ROOT, dirname(path), node.moduleSpecifier.text + ".tsx"), resolve(ROOT, `src/components/admin/ui/${owner}.tsx`));
            return false;
          });
          if (!retained.length && !node.importClause.name) return undefined;
          return ts.factory.updateImportDeclaration(node, node.modifiers, ts.factory.updateImportClause(node.importClause, node.importClause.isTypeOnly, node.importClause.name, ts.factory.updateNamedImports(bindings, retained)), node.moduleSpecifier, node.attributes);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return node => ts.visitNode(node, visit);
    };
    const normalizeBefore = context => {
      const visit = node => {
        if (path.endsWith("TopicsListClient.tsx") && (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(oldAst) === "AdminMetricCardsGrid") {
          const properties = node.attributes.properties.filter(property => {
            if (!ts.isJsxAttribute(property) || property.name.getText(oldAst) !== "className") return true;
            assert.ok(property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === "min-w-[1146px]");
            return false;
          });
          const attributes = ts.factory.updateJsxAttributes(node.attributes, properties);
          return ts.isJsxSelfClosingElement(node) ? ts.factory.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, attributes) : ts.factory.updateJsxOpeningElement(node, node.tagName, node.typeArguments, attributes);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return node => ts.visitNode(node, visit);
    };
    assert.equal(canonical(ast, normalize), canonical(oldAst, normalizeBefore), `Only approved icon additions and Topics min-width removal: ${path}`);
    return { path, count: labels.length, labels, commands, unchangedMetricFieldsAndRestOfSource: true, beforeSha256: hash(original), afterSha256: hash(current) };
  });
  const oldCard = loadPureTypeScriptModule(metricCardPath, metricTokenDependencies, before(metricCardPath)).default;
  const scrollbarPath = "src/components/venesia-scrollbar-styles.ts";
  const oldScrollbarToken = loadPureTypeScriptModule(scrollbarPath, {}, before(scrollbarPath)).VENESIA_SCROLLBAR_VISUAL_CLASSES;
  const currentScrollbarCss = postcss.parse(read("src/app/globals.css"));
  let scrollbarApply;
  currentScrollbarCss.walkAtRules("utility", node => { if (node.params === "venesia-scrollbar") scrollbarApply = node.nodes.find(child => child.type === "atrule" && child.name === "apply")?.params; });
  assert.equal(scrollbarApply, oldScrollbarToken, "The moved CSS visual definition retains the exact phase-baseline token declarations");
  let defaultCases = 0;
  for (const tone of ["gold", "blue", "green", "amber", "violet", "cyan"]) for (const compact of [false, true]) for (const align of ["start", "center"]) {
    const props = { label: "لوحة المعلومات", value: 124, suffix: "/100", tone, compact, align };
    const current = MetricCard(props), original = oldCard(props);
    assert.equal(current.type, original.type);
    for (const tree of [current, original]) {
      const text = renderToStaticMarkup(tree).replace(/<[^>]+>/gu, "");
      assert.ok(text.includes(props.label) && text.includes(`${props.value}${props.suffix}`));
      assert.equal(tree.props.onClick, undefined); assert.equal(tree.props["aria-pressed"], undefined);
    }
    assert.equal(current.props["data-admin-metric-presentation"], "cinematic");
    assert.equal(renderToStaticMarkup(current), renderToStaticMarkup(MetricCard({ ...props, presentation: "cinematic" })), "Authorized official geometry replaces historical visual parity without changing metric facts");
    defaultCases += 1;
  }
  const oldTabs = loadPureTypeScriptModule(metricTabsPath, tabDependencies, before(metricTabsPath));
  const currentTabAst = parse(metricTabsPath, read(metricTabsPath));
  const currentIconAlias = currentTabAst.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === "AdminModuleTabIconName");
  assert.ok(currentIconAlias && ts.isUnionTypeNode(currentIconAlias.type));
  assert.deepEqual(currentIconAlias.type.types.map(node => node.getText(currentTabAst)), ["ModuleEditorIconToken", '"database"', '"statistics"']);
  const oldNames = [...before(metricTabsPath).matchAll(/name === "([^"]+)"/gu)].map(match => match[1]);
  for (const name of [...oldNames, "unknown-fallback"]) assert.equal(renderToStaticMarkup(React.createElement(currentTabs.AdminModuleTabIcon, { name })), renderToStaticMarkup(React.createElement(oldTabs.AdminModuleTabIcon, { name })));
  function tabNormalization(context) {
    const visit = node => {
      if (ts.isTypeAliasDeclaration(node) && node.name.text === "AdminModuleTabIconName") return ts.factory.updateTypeAliasDeclaration(node, node.modifiers, node.name, node.typeParameters, ts.factory.createTypeReferenceNode("ModuleEditorIconToken"));
      if (ts.isConditionalExpression(node) && ts.isBinaryExpression(node.condition) && ts.isIdentifier(node.condition.left) && node.condition.left.text === "name" && ts.isStringLiteral(node.condition.right) && ["database", "statistics"].includes(node.condition.right.text)) return ts.visitNode(node.whenFalse, visit);
      if (ts.isStringLiteral(node) && node.text.includes("overflow-x-auto")) return ts.factory.createStringLiteral(node.text.replace(/\s+(?:\[-ms-overflow-style:none\]|\[scrollbar-width:none\]|\[&::-webkit-scrollbar\]:hidden)/gu, ""));
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }
  assert.equal(canonical(parse(metricTabsPath, read(metricTabsPath)), tabNormalization), canonical(parse(metricTabsPath, before(metricTabsPath)), tabNormalization), "Tab defaults, overflow and keyboard/mounted behavior only differ by approved glyph/hide changes");
  const headerPath = "src/components/admin/ui/AdminPageContextHeader.tsx";
  const headerDependencies = { ...metricTokenDependencies, "./AdminModuleTabs": { AdminModuleTabIcon: currentTabs.AdminModuleTabIcon }, "./admin-scrollbar-styles": loadPureTypeScriptModule("src/components/admin/ui/admin-scrollbar-styles.ts", { "../../venesia-scrollbar-styles": loadPureTypeScriptModule(scrollbarPath) }) };
  const oldHeader = loadPureTypeScriptModule(headerPath, headerDependencies, before(headerPath)).default;
  const Header = loadPureTypeScriptModule(headerPath, headerDependencies).default;
  let minimalHeaderCases = 0;
  for (const status of ["ready", "loading", "error", "empty", "under-construction"]) for (const withSlots of [false, true]) {
    const props = { variant: "minimal", status, title: "العنوان", ...(withSlots ? { eyebrow: "السياق", badge: "الحالة", description: "الوصف", breadcrumb: "المسار", meta: "البيانات", actions: React.createElement("button", { type: "button" }, "إجراء") } : {}) };
    const current = Header(props), original = oldHeader(props);
    assert.equal(current.props["data-admin-page-header-status"], status);
    assert.equal(current.props["data-admin-page-header-variant"], "minimal");
    assert.equal(current.props["data-admin-page-header-presentation"], "cinematic");
    assert.equal(current.props.className, metricTokenDependencies["../../../lib/admin/admin-ui-styles"].ADMIN_CINEMATIC_GOLD_V1.module.root);
    assert.equal(renderToStaticMarkup(current), renderToStaticMarkup(Header({ ...props, presentation: "cinematic" })), "Minimal Header keeps its semantic variant within the authorized official visual default");
    for (const tree of [current, original]) {
      assert.equal(elements(tree, node => node.type === "h1")[0].props.children, props.title);
      const text = renderToStaticMarkup(tree).replace(/<[^>]+>/gu, "");
      for (const field of ["title", "eyebrow", "badge", "description", "breadcrumb", "meta"]) if (props[field]) assert.ok(text.includes(props[field]), `Historical Header retains ${field}`);
      const buttons = elements(tree, node => node.type === "button"); assert.equal(buttons.length, withSlots ? 1 : 0);
      if (withSlots) assert.equal(buttons[0], props.actions, "Exact existing action identity remains in the same Header owner");
    }
    assert.equal(elements(current, node => "data-admin-header-artwork" in node.props).length, 0, "No artwork invented for historical utility states");
    minimalHeaderCases += 1;
  }
  assert.ok(newGlyphs.every(markup => markup.includes('<svg') && markup.includes('aria-hidden="true"')));
  assert.notEqual(newGlyphs[0], newGlyphs[1]);
  const owners = [metricCardPath, metricGridPath, metricTabsPath, headerPath, scrollbarPath, "src/app/globals.css"].map(path => ({ path, beforeSha256: hash(before(path)), afterSha256: hash(read(path)) }));
  const receipt = { status: "PASS", capturedAt: new Date().toISOString(), baseline: baselinePath, consumers: consumerProof, owners, defaultCardPreservedFactCases: defaultCases, minimalHeaderPreservedSemanticCases: minimalHeaderCases, authorizedOfficialDefaultGeometry: true, historicalExactVisualParitySuperseded: true, existingIconExactSsrCases: oldNames.length + 1, tabKeyboardMountedOverflowSourceParity: true, scrollbarBaselineTokenParity: true, newDecorativeGlyphs: ["database", "statistics"], scrollbarUtility, limitations: ["Source, SSR and callbacks only; responsive geometry, scroll behavior and visual acceptance require actual Browser evidence."] };
  const outputArgument = process.argv.find(argument => argument.startsWith("--output-file="));
  if (outputArgument) writeFileSync(resolve(ROOT, outputArgument.slice("--output-file=".length)), JSON.stringify(receipt, null, 2) + "\n");
  check("Phase baseline preserves consumer facts, utility Header semantics and existing glyphs while authorized official chrome replaces old visual parity", true);
}

// Date-cell acceptance executes the actual owner. The DOM ports provide measured
// rectangles and event scheduling only; they are not a layout engine or visual
// proof. Actual Browser clipping, focus and portal placement remain separate QA.
const dateCellPath = "src/components/admin/ui/AdminDataGridDateTimeCell.tsx";
const dateCellSource = read(dateCellPath);
const dateFormatter = loadPureTypeScriptModule("src/lib/content-dates.ts");
const dateCellCases = [
  { name: "full fits", content: { left: 30, right: 260 }, viewport: { left: 0, right: 300 }, obstacles: [], fullWidth: 196, expected: { compact: false, offset: 0, width: 230 } },
  { name: "narrow content", content: { left: 30, right: 150 }, viewport: { left: 0, right: 300 }, obstacles: [], fullWidth: 196, expected: { compact: true, offset: 0, width: 120 } },
  { name: "exact full fit", content: { left: 0, right: 133.425 }, viewport: { left: 0, right: 600 }, obstacles: [], fullWidth: 133.425, expected: { compact: false, offset: 0, width: 133.425 } },
  { name: "fraction below full fit", content: { left: 0, right: 133.424 }, viewport: { left: 0, right: 600 }, obstacles: [], fullWidth: 133.425, expected: { compact: true, offset: 0, width: 133.424 } },
  { name: "fractional scrollport clipping", content: { left: 100, right: 340 }, viewport: { left: 120.5, right: 300.25 }, obstacles: [], fullWidth: 196, expected: { compact: true, offset: 20.5, width: 179.75 } },
  { name: "both sticky rails", content: { left: 0, right: 400 }, viewport: { left: 0, right: 400 }, obstacles: [{ left: 0, right: 90 }, { left: 250, right: 400 }], fullWidth: 196, expected: { compact: true, offset: 90, width: 160 } },
  { name: "clipped old center can retain full in available gap", content: { left: 0, right: 164 }, viewport: { left: 0, right: 300 }, obstacles: [{ left: 141.687, right: 300 }], fullWidth: 133.425, expected: { compact: false, offset: 0, width: 141.687 } },
  { name: "inline-start overlay repositions full text", content: { left: 0, right: 230 }, viewport: { left: 0, right: 300 }, obstacles: [{ left: 0, right: 25 }], fullWidth: 196, expected: { compact: false, offset: 25, width: 205 } },
  { name: "overlapping rails are subtracted once", content: { left: 0, right: 400 }, viewport: { left: 0, right: 400 }, obstacles: [{ left: 0, right: 80 }, { left: 30, right: 90 }, { left: 250, right: 400 }], fullWidth: 196, expected: { compact: true, offset: 90, width: 160 } },
  { name: "largest uncovered interval", content: { left: 0, right: 400 }, viewport: { left: 0, right: 400 }, obstacles: [{ left: 70, right: 100 }, { left: 300, right: 340 }], fullWidth: 196, expected: { compact: false, offset: 100, width: 200 } },
  { name: "offscreen", content: { left: -200, right: -20 }, viewport: { left: 0, right: 300 }, obstacles: [], fullWidth: 196, expected: null },
  { name: "fully covered", content: { left: 30, right: 150 }, viewport: { left: 0, right: 300 }, obstacles: [{ left: 0, right: 300 }], fullWidth: 196, expected: null },
];

function dateCellFixture(source = dateCellSource) {
  const slots = [], frames = new Map(), observers = [], portals = [], positionCalls = [], scrollCalls = [];
  let index = 0, frameId = 0;
  const equal = (left, right) => left && right && left.length === right.length && left.every((value, i) => Object.is(value, right[i]));
  const hooks = {
    useRef(value) { return slots[index++] ??= { current: value }; },
    useId() { return `date-fixture-${index++}`; },
    useState(initial) { const slot = slots[index++] ??= { value: typeof initial === "function" ? initial() : initial }; return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
    useLayoutEffect(effect, deps) { const i = index++, previous = slots[i]; if (!previous || !equal(previous.deps, deps)) slots[i] = { effect, deps, pending: true, cleanup: previous?.cleanup }; },
  };
  const bounds = (left, right, top = 10, bottom = 30) => ({ left, right, top, bottom, width: right - left, height: bottom - top });
  class ElementPort extends EventTarget {
    constructor(rect, style = {}) { super(); this.rect = rect; this.style = style; this.children = []; this.listeners = new Map(); this.parentElement = null; }
    getBoundingClientRect() { return this.rect; }
    addEventListener(type, handler, options) { super.addEventListener(type, handler, options); const entries = this.listeners.get(type) ?? new Set(); entries.add(handler); this.listeners.set(type, entries); }
    removeEventListener(type, handler, options) { super.removeEventListener(type, handler, options); this.listeners.get(type)?.delete(handler); }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    focus() { document.activeElement = this; }
    count(type) { return this.listeners.get(type)?.size ?? 0; }
  }
  const scrollport = new ElementPort(bounds(0, 300), { borderLeftWidth: "0.8px", borderRightWidth: "0.8px" });
  const row = new ElementPort(bounds(0, 600)), cell = new ElementPort(bounds(24, 266), { position: "sticky" });
  const root = new ElementPort(bounds(30, 260)), full = new ElementPort(bounds(30, 226)), anchor = new ElementPort(bounds(40, 240)), tooltip = new ElementPort(bounds(0, 210));
  const startRail = new ElementPort(bounds(0, 25), { position: "sticky" }), endRail = new ElementPort(bounds(270, 300), { position: "sticky" });
  const unrelatedRowRail = new ElementPort(bounds(0, 300, 100, 130), { position: "sticky" });
  // Physical horizontal scrolling moves the ordinary row content, not its pinned
  // rails or the viewport. The owner supplies the direction and distance.
  scrollport.scrollBy = options => {
    assert.equal(Number.isFinite(options.left), true); scrollCalls.push({ ...options });
    for (const element of [row, cell, root, full, anchor]) {
      const rect = element.rect; element.rect = bounds(rect.left - options.left, rect.right - options.left, rect.top, rect.bottom);
    }
  };
  cell.children = [root]; row.children = [startRail, cell, endRail, unrelatedRowRail]; root.parentElement = cell; cell.parentElement = row;
  root.closest = selector => selector === "td" ? cell : selector === "[data-admin-data-grid-scroll]" ? scrollport : null;
  cell.closest = selector => selector === "tr" ? row : null;
  const document = { documentElement: { clientWidth: 300 }, body: {}, activeElement: null };
  const window = Object.assign(new ElementPort(bounds(0, 300)), { getComputedStyle: element => element.style, requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); } });
  class ResizeObserverPort {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(element) { this.targets.add(element); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    fire() { this.callback(); }
  }
  const loaded = loadPureTypeScriptModule(dateCellPath, {
    react: hooks,
    "react-dom": { createPortal(child, target) { assert.equal(target, document.body); portals.push(child); return child; } },
    "../../../lib/content-dates": dateFormatter,
    "./useAdminFloatingMenuPosition": { useAdminFloatingMenuPosition(isOpen, ref, options) { positionCalls.push({ isOpen, ref, options }); return isOpen ? { style: { position: "fixed", left: 8, top: 8 }, placement: "bottom" } : null; } },
  }, source, { document, window, ResizeObserver: ResizeObserverPort, fetch() { throw new Error("Date presentation must not fetch or mutate data"); } });
  let props = { value: "2026-12-01T12:53:00.000Z" }, tree;
  const elements = value => Array.isArray(value) ? value.flatMap(elements) : value && typeof value === "object" && "props" in value ? [value, ...elements(value.props.children)] : [];
  const render = (next = {}) => {
    props = { ...props, ...next }; index = 0; tree = loaded.default(props);
    for (const element of elements(tree)) if (element.props.ref) {
      element.props.ref.current = "data-admin-date-time" in element.props ? root : element.type === "button" ? anchor : element.props.role === "tooltip" ? tooltip : full;
    }
    for (const slot of slots) if (slot?.pending) { slot.pending = false; slot.cleanup?.(); slot.cleanup = slot.effect(); }
    return tree;
  };
  return { loaded, render, get tree() { return tree; }, elements, root, full, anchor, tooltip, row, cell, startRail, endRail, unrelatedRowRail, scrollport, window, document, observers, frames, portals, positionCalls, scrollCalls, bounds,
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); return render(); },
    cleanup() { slots.forEach(slot => slot?.cleanup?.()); },
    button() { return elements(tree).find(element => element.type === "button"); },
    visible() { return elements(tree).find(element => "data-admin-date-visible" in element.props)?.props.children; },
  };
}

function verifyDateLayout(source = dateCellSource) {
  const { loaded } = dateCellFixture(source);
  for (const sample of dateCellCases) assert.deepEqual(loaded.resolveAdminDataGridDateTimeLayout(sample), sample.expected, sample.name);
}
verifyDateLayout();
check("Date layout executes actual visible intervals, fractional fit, both rails and offscreen cases", true);

function verifyDateLifecycle(source = dateCellSource) {
  const fixture = dateCellFixture(source); fixture.render(); fixture.render();
  const fullValue = dateFormatter.formatAdminDateTime("2026-12-01T12:53:00.000Z"), dateValue = dateFormatter.formatAdminDateTime("2026-12-01T12:53:00.000Z", "date");
  assert.equal(fixture.visible(), fullValue); assert.equal(fixture.tree.props.dir, "ltr");
  assert.deepEqual([...fixture.observers[0].targets], [fixture.root, fixture.full, fixture.scrollport]);
  assert.equal(fixture.scrollport.count("scroll"), 1); assert.equal(fixture.window.count("resize"), 1);
  assert.equal(fixture.elements(fixture.tree).find(element => element.props["aria-hidden"] === "true")?.props.children, fullValue);
  fixture.endRail.rect = fixture.bounds(210, 300);
  fixture.observers[0].fire(); fixture.observers[0].fire(); assert.equal(fixture.frames.size, 1); fixture.flush();
  assert.equal(fixture.visible(), dateValue);
  fixture.endRail.rect = fixture.bounds(270, 300);
  fixture.scrollport.dispatchEvent(new Event("scroll")); assert.equal(fixture.frames.size, 1); fixture.flush(); assert.equal(fixture.visible(), fullValue);
  fixture.scrollport.rect = fixture.bounds(0, 160); fixture.window.dispatchEvent(new Event("resize")); fixture.flush();
  assert.equal(fixture.visible(), dateValue);
  const positioned = fixture.elements(fixture.tree).find(element => element.props.style?.width);
  assert.ok(Math.abs(positioned.props.style.width - 129.2) < 0.00001, "The actual effect deducts fractional scrollport borders");
  fixture.full.rect = fixture.bounds(30, 130); fixture.observers[0].fire(); fixture.flush(); assert.equal(fixture.visible(), fullValue);
  fixture.root.rect = fixture.bounds(-300, -100); fixture.scrollport.dispatchEvent(new Event("scroll")); fixture.flush();
  assert.equal(fixture.tree.props["data-presentation"], "date-time");
  fixture.observers[0].fire(); assert.equal(fixture.frames.size, 1); fixture.cleanup();
  assert.equal(fixture.observers[0].disconnected, true); assert.equal(fixture.frames.size, 0);
  assert.equal(fixture.scrollport.count("scroll"), 0); assert.equal(fixture.window.count("resize"), 0);
}
verifyDateLifecycle();
check("Actual Date cell measures full reference and rail overlap, resizes/reveals/recomputes and cleans up", true);

function verifyDateDisclosure(source = dateCellSource) {
  const fixture = dateCellFixture(source); fixture.render(); fixture.render();
  const value = dateFormatter.formatAdminDateTime("2026-12-01T12:53:00.000Z");
  const key = () => { const event = new Event("keydown", { cancelable: true, bubbles: true }); Object.defineProperty(event, "key", { value: "Escape" }); return event; };
  assert.equal(fixture.button().props.type, "button"); assert.equal(fixture.button().props.onClick, undefined); assert.equal(fixture.button().props["aria-label"], value);
  let event = key(); fixture.button().props.onKeyDown(event); assert.equal(event.defaultPrevented, false);
  for (const [open, close] of [["onFocus", "onBlur"], ["onMouseEnter", "onMouseLeave"]]) {
    fixture.anchor.focus(); fixture.button().props[open](); fixture.render();
    const tooltip = fixture.elements(fixture.tree).find(element => element.props.role === "tooltip"); assert.ok(tooltip);
    assert.equal(tooltip.props.children, value); assert.equal(tooltip.props.dir, "ltr"); assert.equal(fixture.button().props["aria-describedby"], tooltip.props.id);
    assert.equal(fixture.positionCalls.at(-1).ref.current, fixture.anchor); assert.equal(fixture.positionCalls.at(-1).options.floatingRef.current, fixture.tooltip);
    event = key(); fixture.button().props.onKeyDown(event); fixture.render();
    assert.equal(event.defaultPrevented, true); assert.equal(event.cancelBubble, true); assert.equal(fixture.document.activeElement, fixture.anchor);
    assert.equal(fixture.elements(fixture.tree).some(element => element.props.role === "tooltip"), false);
    event = key(); fixture.button().props.onKeyDown(event); assert.equal(event.defaultPrevented, false);
    fixture.button().props[close](); fixture.render(); fixture.button().props[open](); fixture.render();
    assert.ok(fixture.elements(fixture.tree).some(element => element.props.role === "tooltip"));
    fixture.button().props[close](); fixture.render(); assert.equal(fixture.elements(fixture.tree).some(element => element.props.role === "tooltip"), false);
  }
  fixture.cleanup();
}
verifyDateDisclosure();
check("Actual Date tooltip keeps full value for keyboard/hover, consumes only open Escape and retains focus", true);

function verifyDateFocusReveal(source = dateCellSource) {
  const visible = dateCellFixture(source); visible.render(); visible.render();
  visible.anchor.focus(); visible.button().props.onFocus(); visible.render();
  assert.equal(visible.frames.size, 1, "Focus revelation waits for the browser's native focus-scroll");
  visible.flush();
  assert.equal(visible.scrollCalls.length, 0, "A date already inside the unpinned band must not scroll on focus");
  visible.cleanup();

  const fixture = dateCellFixture(source);
  fixture.root.rect = fixture.bounds(8, 128);
  fixture.full.rect = fixture.bounds(8, 141.425);
  fixture.anchor.rect = fixture.bounds(32.55, 103.45);
  fixture.startRail.rect = fixture.bounds(0, 144);
  fixture.render(); fixture.render();
  const dateValue = dateFormatter.formatAdminDateTime("2026-12-01T12:53:00.000Z", "date");
  assert.equal(fixture.visible(), dateValue, "An entirely occluded 120px date retains its compact intrinsic fallback");
  assert.ok(fixture.anchor.rect.right < fixture.startRail.rect.right);
  fixture.anchor.focus(); fixture.button().props.onFocus(); fixture.render();
  assert.equal(fixture.scrollCalls.length, 0, "Focus revelation must not race the native synchronous focus-scroll");
  fixture.button().props.onFocus(); assert.equal(fixture.frames.size, 1, "Repeated focus coalesces its pending reveal frame");
  fixture.flush();
  assert.equal(fixture.scrollCalls.length, 1, "Focus must reveal the date behind pinned actions");
  assert.equal(fixture.scrollCalls[0].behavior, "instant");
  assert.ok(fixture.scrollCalls[0].left < 0, "The left-occluded date must move right into the visible band");
  assert.equal(fixture.startRail.rect.right, 144); assert.equal(fixture.endRail.rect.left, 270);
  assert.ok(fixture.root.rect.left >= 144 && fixture.root.rect.right <= 270, "The actual scroll request moves the date cell into the available band");
  assert.ok(fixture.anchor.rect.left >= 144 && fixture.anchor.rect.right <= 270, "The focused native control clears both pinned rails");
  assert.equal(fixture.visible(), dateValue); assert.equal(fixture.document.activeElement, fixture.anchor);
  assert.equal(fixture.button().props["aria-label"], dateFormatter.formatAdminDateTime("2026-12-01T12:53:00.000Z"));
  assert.ok(fixture.elements(fixture.tree).some(element => element.props.role === "tooltip"));
  fixture.button().props.onFocus(); fixture.flush();
  assert.equal(fixture.scrollCalls.length, 1, "Refocusing the revealed date must not scroll again");
  fixture.button().props.onFocus(); assert.equal(fixture.frames.size, 1); fixture.cleanup();
  assert.equal(fixture.frames.size, 0, "Cleanup cancels the owner's pending focus reveal frame");
  fixture.flush(); assert.equal(fixture.scrollCalls.length, 1);
}
verifyDateFocusReveal();
check("Actual Date focus reveals a pinned-rail occlusion once, retains compact fallback and leaves visible focus stationary", true);

for (const value of [null, undefined, "", "invalid", "2026-02-30", "2026-12-01"]) {
  const fixture = dateCellFixture(); const tree = fixture.render({ value, fallback: React.createElement("em", null, "لم يُنشر"), fallbackTitle: "حالة التاريخ", className: "date-probe" });
  const html = renderToStaticMarkup(tree); assert.equal(tree.props.title, "حالة التاريخ"); assert.equal(tree.props.className, "date-probe");
  assert.equal(fixture.observers.length, 0); assert.equal(fixture.window.count("resize"), 0); assert.equal(fixture.button(), undefined);
  assert.ok(value === "2026-12-01" ? html.includes("01 Dec 2026") : html.includes("لم يُنشر")); fixture.cleanup();
}
check("Empty, invalid and date-only cells retain exact fallback semantics without interactive timestamp controls", true);

const dateMutants = [
  ["ignore viewport", dateCellSource.replace("Math.max(content.left, viewport.left)", "content.left").replace("Math.min(content.right, viewport.right)", "content.right"), verifyDateLayout],
  ["ignore sticky rails", dateCellSource.replace("for (const obstacle of obstacles)", "for (const obstacle of [])"), verifyDateLayout],
  ["always compact", dateCellSource.replace("compact: fullWidth > width", "compact: true"), verifyDateLayout],
  ["invert fit", dateCellSource.replace("compact: fullWidth > width", "compact: fullWidth < width"), verifyDateLayout],
  ["ignore full reference width", dateCellSource.replace("full.getBoundingClientRect().width", "0"), verifyDateLifecycle],
  ["stale resize", dateCellSource.replace("new ResizeObserver(scheduleUpdate)", "new ResizeObserver(() => {})"), verifyDateLifecycle],
  ["stale scroll", dateCellSource.replace('scrollport?.addEventListener("scroll", scheduleUpdate, { passive: true });', ""), verifyDateLifecycle],
  ["missing observer cleanup", dateCellSource.replace("observer.disconnect();", ""), verifyDateLifecycle],
  ["short accessible value", dateCellSource.replace("aria-label={fullValue}", "aria-label={dateValue}"), verifyDateDisclosure],
  ["form submit control", dateCellSource.replace('type="button"', 'type="submit"'), verifyDateDisclosure],
  ["consuming closed Escape", dateCellSource.replace('event.key === "Escape" && isOpen', 'event.key === "Escape"'), verifyDateDisclosure],
  ["bypassed focus reveal", dateCellSource.replace("() => revealRef.current?.()", "() => {}"), verifyDateFocusReveal],
  ["reversed focus scroll direction", dateCellSource.replace("(geometry.content.left + geometry.content.right - left - right) / 2", "(left + right - geometry.content.left - geometry.content.right) / 2"), verifyDateFocusReveal],
  ["scrolling an already visible focus", dateCellSource.replace("if (target.left >= left && target.right <= right && target.width <= geometry.content.width) return;", ""), verifyDateFocusReveal],
  ["full timestamp fallback behind rails", dateCellSource.replace("compact: geometry.fullWidth > geometry.content.width", "compact: false"), verifyDateFocusReveal],
  ["focus reveal before native focus scroll", dateCellSource.replace("focusFrameRef.current = window.requestAnimationFrame(() => revealRef.current?.());", "revealRef.current?.();"), verifyDateFocusReveal],
  ["uncancelled focus reveal frame", dateCellSource.replace("window.cancelAnimationFrame(focusFrameRef.current);", ""), verifyDateFocusReveal],
];
for (const [name, source, proof] of dateMutants) {
  assert.notEqual(source, dateCellSource, `Applied Date mutation ${name}`); assert.throws(() => proof(source), { name: "AssertionError" });
  check(`Date negative rejects ${name}`, true);
}
const dateReexport = ts.createSourceFile("AdminDataGrid.tsx", dataGrid, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements.some(node => ts.isExportDeclaration(node) && node.moduleSpecifier?.text === "./AdminDataGridDateTimeCell" && node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(item => item.name.text === "AdminDataGridDateTimeCell"));
check("Date cell remains the exported existing AdminDataGrid presentation family", dateReexport);
const dateEvidenceArgument = process.argv.find(argument => argument.startsWith("--date-output-file="));
if (dateEvidenceArgument && !failures.length) writeFileSync(resolve(ROOT, dateEvidenceArgument.slice("--date-output-file=".length)), JSON.stringify({ status: "pass", capturedAt: new Date().toISOString(), sources: [dateCellPath, "src/components/admin/ui/AdminDataGrid.tsx", "src/lib/content-dates.ts"].map(path => ({ path, sha256: createHash("sha256").update(read(path)).digest("hex") })), geometryCases: dateCellCases.map(row => row.name), negativeCases: dateMutants.map(([name]) => name), callbackCases: ["measured full reference", "fractional borders", "self sticky and vertically unrelated rail excluded", "ResizeObserver targets", "RAF coalescing", "horizontal reveal", "window resize", "offscreen reset", "observer/listener/frame cleanup", "focus and hover full tooltip", "occluded narrow date compact fallback", "focus reveals date past sticky rails with physical scroll translation", "already visible focus does not scroll", "reveal callback cleanup", "open Escape consumed without focus movement", "closed Escape untouched", "blur and mouseleave dismissal", "native non-submitting button", "invalid/date-only fallback"], actualOwnerExecuted: true, transport: "Controlled React hooks, measured DOM ports, physical horizontal scroll translation and portal/floating-position transport; actual existing date formatter", dataWrites: 0, browserVerified: false, limitations: ["No browser CSS/layout, portal placement, real focus traversal or visual approval claim; these require actual affected consumers."] }, null, 2) + "\n");

if (failures.length) {
  console.error("verify-admin-entity-list FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `verify-admin-entity-list passed (${assertionCount} assertions; ${coreFiles.length} core files gated).`,
);
