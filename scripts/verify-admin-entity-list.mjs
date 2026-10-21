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
    metricCardsGrid.includes("repeat(auto-fit,minmax(min(100%,") &&
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
function metricContract(source = read(metricCardPath)) {
  const Card = loadPureTypeScriptModule(metricCardPath, {}, source).default;
  let calls = 0;
  const onClick = () => { calls += 1; };
  const icon = React.createElement("svg", { "data-metric-probe": "" });
  for (const active of [false, true]) {
    const tree = Card({ label: "مقياس", value: 42, suffix: "/100", icon, active, onClick, ariaLabel: "تصفية المقياس" });
    assert.equal(tree.type, "button");
    assert.equal(tree.props.type, "button");
    assert.equal(tree.props["aria-pressed"], active);
    assert.equal(tree.props["aria-label"], "تصفية المقياس");
    assert.equal(tree.props.onClick, onClick);
    tree.props.onClick();
    const content = elements(tree, element => "data-admin-metric-content" in element.props);
    const glyph = elements(tree, element => "data-admin-metric-icon" in element.props);
    assert.equal(content.length, 1);
    assert.equal(glyph.length, 1);
    assert.equal(glyph[0].props["aria-hidden"], "true");
    assert.equal(elements(glyph[0], element => element.type === "p").length, 0);
    const paragraphs = elements(content[0], element => element.type === "p");
    assert.equal(paragraphs.length, 2);
    assert.equal(renderToStaticMarkup(paragraphs[0]).replace(/<[^>]+>/gu, ""), "42/100");
    assert.equal(renderToStaticMarkup(paragraphs[1]).replace(/<[^>]+>/gu, ""), "مقياس");
    assert.equal(elements(content[0], element => "data-metric-probe" in element.props).length, 0);
  }
  assert.equal(calls, 2);
  const staticTree = Card({ label: "ثابت", value: 0 });
  assert.equal(staticTree.type, "div");
  assert.equal(staticTree.props.onClick, undefined);
  assert.equal(staticTree.props.type, undefined);
  assert.equal(staticTree.props["aria-pressed"], undefined);
  assert.equal(elements(staticTree, element => "data-admin-metric-icon" in element.props || "data-admin-metric-content" in element.props).length, 0);
  const labelled = Card({ label: "افتراضي", value: 1, onClick });
  assert.equal(labelled.props["aria-label"], "افتراضي");
  return Card;
}
const MetricCard = metricContract();
check("Actual Metric Card preserves value/label hierarchy, decorative icon isolation and button commands", Boolean(MetricCard));
const metricMutants = [
  read(metricCardPath).replace('data-admin-metric-icon="" aria-hidden="true"', 'data-admin-metric-icon=""'),
  read(metricCardPath).replace('onClick ? "button" : "div"', '"div"'),
  read(metricCardPath).replace('            onClick,', '            onClick: () => {},'),
  read(metricCardPath).replace('"aria-pressed": active', '"aria-pressed": false'),
  read(metricCardPath).replace(/\{value\}\r?\n/u, '{label}\n'),
];
check("Metric owner negatives reject hidden semantics, swallowed actions, fixed active state and changed values", metricMutants.every(source => {
  if (source === read(metricCardPath)) return false;
  try { metricContract(source); return false; } catch { return true; }
}));
const MetricGrid = loadPureTypeScriptModule(metricGridPath, { "./AdminMetricCard": { default: MetricCard } }).default;
const gridItems = Array.from({ length: 7 }, (_, index) => ({ label: `مقياس ${index}`, value: index, active: index === 2, onClick: index < 6 ? () => index : undefined }));
const gridTree = MetricGrid({ items: gridItems });
const actualCards = elements(gridTree, element => element.type === MetricCard);
check("Actual Metric Grid retains all seven ordered values, active state and exact callback identities", actualCards.length === gridItems.length && actualCards.every((element, index) => {
  const { label, value, active, onClick } = element.props;
  return label === gridItems[index].label && value === index && active === gridItems[index].active && onClick === gridItems[index].onClick;
}));
check("Actual metric viewport retains its bleed boundary without forcing a horizontal scrollport", "data-admin-metric-cards-viewport" in gridTree.props && !/\boverflow-x-(?:auto|scroll)\b/u.test(gridTree.props.className));

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
const tabDependencies = { react: React, "./AdminForm": {} };
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
  const oldCard = loadPureTypeScriptModule(metricCardPath, {}, before(metricCardPath)).default;
  const scrollbarPath = "src/components/venesia-scrollbar-styles.ts";
  const oldScrollbarToken = loadPureTypeScriptModule(scrollbarPath, {}, before(scrollbarPath)).VENESIA_SCROLLBAR_VISUAL_CLASSES;
  const currentScrollbarCss = postcss.parse(read("src/app/globals.css"));
  let scrollbarApply;
  currentScrollbarCss.walkAtRules("utility", node => { if (node.params === "venesia-scrollbar") scrollbarApply = node.nodes.find(child => child.type === "atrule" && child.name === "apply")?.params; });
  assert.equal(scrollbarApply, oldScrollbarToken, "The moved CSS visual definition retains the exact phase-baseline token declarations");
  let defaultCases = 0;
  for (const tone of ["gold", "blue", "green", "amber", "violet", "cyan"]) for (const compact of [false, true]) for (const align of ["start", "center"]) {
    const props = { label: "لوحة المعلومات", value: 124, suffix: "/100", tone, compact, align };
    assert.equal(renderToStaticMarkup(React.createElement(MetricCard, props)), renderToStaticMarkup(React.createElement(oldCard, props)));
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
  const oldHeader = loadPureTypeScriptModule(headerPath, {}, before(headerPath)).default;
  const Header = loadPureTypeScriptModule(headerPath).default;
  let minimalHeaderCases = 0;
  for (const status of ["ready", "loading", "error", "empty", "under-construction"]) for (const withSlots of [false, true]) {
    const props = { variant: "minimal", status, title: "العنوان", ...(withSlots ? { eyebrow: "السياق", badge: "الحالة", description: "الوصف", breadcrumb: "المسار", meta: "البيانات", actions: React.createElement("button", { type: "button" }, "إجراء") } : {}) };
    assert.equal(renderToStaticMarkup(React.createElement(Header, props)), renderToStaticMarkup(React.createElement(oldHeader, props)));
    minimalHeaderCases += 1;
  }
  assert.ok(newGlyphs.every(markup => markup.includes('<svg') && markup.includes('aria-hidden="true"')));
  assert.notEqual(newGlyphs[0], newGlyphs[1]);
  const owners = [metricCardPath, metricGridPath, metricTabsPath, headerPath, scrollbarPath, "src/app/globals.css"].map(path => ({ path, beforeSha256: hash(before(path)), afterSha256: hash(read(path)) }));
  const receipt = { status: "PASS", capturedAt: new Date().toISOString(), baseline: baselinePath, consumers: consumerProof, owners, defaultCardExactSsrCases: defaultCases, minimalHeaderExactSsrCases: minimalHeaderCases, existingIconExactSsrCases: oldNames.length + 1, tabKeyboardMountedOverflowSourceParity: true, scrollbarBaselineTokenParity: true, newDecorativeGlyphs: ["database", "statistics"], scrollbarUtility, limitations: ["Source, SSR and callbacks only; responsive geometry, scroll behavior and visual acceptance require actual Browser evidence."] };
  const outputArgument = process.argv.find(argument => argument.startsWith("--output-file="));
  if (outputArgument) writeFileSync(resolve(ROOT, outputArgument.slice("--output-file=".length)), JSON.stringify(receipt, null, 2) + "\n");
  check("Exact phase baseline preserves all four consumer contracts, no-icon Card output and existing glyphs", true);
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
