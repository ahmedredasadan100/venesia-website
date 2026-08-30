/**
 * Architecture acceptance gates for Admin Entity List System v1.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
  "src/lib/admin/entity-list/search-normalization.ts",
  "src/lib/admin/preferences/admin-column-preferences.ts",
  "src/components/admin/entity-list/AdminEntityList.tsx",
  "src/components/admin/entity-list/AdminEntityListTable.tsx",
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
  "src/components/admin/entity-list/AdminEntityListSurface.tsx",
  "src/components/admin/entity-list/AdminFloatingLayerContext.tsx",
  "src/components/admin/ui/AdminBulkActionBar.tsx",
  "src/components/admin/ui/AdminDataGrid.tsx",
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
  "Shared metric cards viewport owns horizontal scrolling and compensated hover-glow bleed",
  metricCardsGrid.includes('data-admin-metric-cards-viewport=""') &&
    metricCardsGrid.includes('"-mt-8 overflow-x-auto pt-8"') &&
    !metricCardsGrid.includes("z-") &&
    topicsClient.includes('className="min-w-[1146px]"') &&
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
    venesiaScrollbarStyles.includes("[&::-webkit-scrollbar]:h-1.5") &&
    venesiaScrollbarStyles.includes("[&::-webkit-scrollbar]:w-1.5") &&
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
    /key:\s*"created_at"[\s\S]*?defaultVisible:\s*true[\s\S]*?minWidth:\s*ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH[\s\S]*?width:\s*ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH[\s\S]*?dir="ltr"[\s\S]*?whitespace-nowrap/.test(categoriesColumns) &&
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
    seriesColumns.includes('dir="ltr"') &&
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

if (failures.length) {
  console.error("verify-admin-entity-list FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `verify-admin-entity-list passed (${assertionCount} assertions; ${coreFiles.length} core files gated).`,
);
