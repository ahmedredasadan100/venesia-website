import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

import { ADMIN_COLLECTION_SURFACE_ADOPTION } from "../src/lib/admin/interaction-system/adoption-manifest.ts";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n?/g, "\n");
const parseTsx = (path: string) =>
  ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
const importedBindings = (sourceFile: ts.SourceFile, moduleName: string) => {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName
    ) {
      continue;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const binding of namedBindings.elements) {
        if (!binding.isTypeOnly) bindings.add(binding.name.text);
      }
    }
  }
  return bindings;
};
const renderedJsxElements = (sourceFile: ts.SourceFile) => {
  const elements = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName)) elements.add(node.tagName.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return elements;
};
let passed = 0;
const check = (label: string, value: unknown) => {
  assert.ok(value, label);
  passed += 1;
  console.log(`PASS ${label}`);
};

const foundationMigrationPath =
  "sql/migrations/20260817170332_project_construction_tracking_detail.sql";
const paginationMigrationPath =
  "sql/migrations/20260818010000_project_tracking_public_pagination.sql";
check(
  "Tracking foundation and corrective pagination migrations exist",
  [foundationMigrationPath, paginationMigrationPath].every((path) =>
    existsSync(resolve(process.cwd(), path)),
  ),
);
const foundationMigration = read(foundationMigrationPath);
const paginationMigration = read(paginationMigrationPath);
const publicRoute = read("src/app/(site)/track-your-project/[slug]/page.tsx");
const publicRead = read("src/lib/projects/tracking/public-read.ts");
const publicContract = read("src/lib/projects/tracking/contract.ts");
const publicView = read("src/components/track/ProjectTrackingExperience.tsx");
const adminCollections = read(
  "src/components/admin/projects/tracking/TrackingCollections.tsx",
);
const adminForms = read(
  "src/components/admin/projects/tracking/TrackingForms.tsx",
);
const adminAdapter = read("src/lib/admin/projects/tracking-adapter.ts");
const trackingHub = read("src/lib/admin/projects/tracking-hub.ts");
const constructionUpdatesPage = parseTsx(
  "src/app/admin/projects/construction-updates/page.tsx",
);
const formManifest = read("src/lib/admin/form-system/adoption-manifest.ts");
const instantMutation = read(
  "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
);
const entityListTable = read(
  "src/components/admin/entity-list/AdminEntityListTable.tsx",
);
const publicPagination = read("src/components/Pagination.tsx");
const registry = read("src/lib/admin/entity-list/data-engine/registry.ts");
const actions = read("src/app/admin/projects/tracking-actions.ts");

check(
  "Tracking remains an independent graph and never mutates the Project aggregate schema",
  !/alter\s+table\s+(?:public\.)?projects\b/i.test(foundationMigration) &&
    !/create\s+table\s+(?:public\.)?projects\b/i.test(foundationMigration) &&
    [
      "project_tracking_stages",
      "project_tracking_items",
      "project_tracking_updates",
      "project_tracking_update_media",
    ].every((name) =>
      foundationMigration.includes(`create table public.${name}`),
    ),
);
check(
  "the existing public RPC is narrowed instead of introducing another Read Runtime",
  paginationMigration.includes(
    "create or replace function public.project_tracking_public_detail_v1",
  ) &&
    !paginationMigration.includes("create table") &&
    !paginationMigration.includes("create view") &&
    !paginationMigration.includes("'stages', coalesce") &&
    !paginationMigration.includes("jsonb_agg"),
);
check(
  "public child collections use independent stable server ranges",
  (publicRead.match(/\.range\(/g)?.length ?? 0) === 5 &&
    (publicRead.match(/\.order\("id"/g)?.length ?? 0) >= 5 &&
    publicRead.includes("projectTrackingReadInputSchema") &&
    publicRoute.includes("searchParams") &&
    publicRoute.includes("trackingReadInput"),
);
check(
  "public Item selection preserves the normalized item page",
  /activeStage\.items\.map[\s\S]{0,900}itemPage: detail\.pagination\.items\.page/u.test(
    publicView,
  ) && publicRoute.includes('itemPage: value("itemPage")'),
);
check(
  "public child ranges use normalized pages before bounded reads",
  [
    ["stagesPage", "stageRange"],
    ["itemsPage", "itemRange"],
    ["updatesPage", "updateRange"],
    ["mediaPage", "mediaRange"],
    ["historyPage", "historyRange"],
  ].every(([page, range]) => {
    const pageDeclaration = publicRead.indexOf(`const ${page} = pageInfo(`);
    const rangeDeclaration = publicRead.indexOf(
      `const ${range} = rangeFor(${page}.page, ${page}.pageSize);`,
    );
    return pageDeclaration >= 0 && rangeDeclaration > pageDeclaration;
  }) &&
    !/rangeFor\(input\.(?:stage|item|update|media|history)Page/u.test(
      publicRead,
    ),
);
check(
  "public response cannot embed every Stage, Item, Update, and Media row",
  publicContract.includes("pagination: z.object({") &&
    publicContract.includes("history: z.array") &&
    !publicRead.includes("updates_by_item") &&
    !publicRead.includes("media_by_update") &&
    !publicView.includes(".flatMap((stage) => stage.items)") &&
    !publicView.includes("TRACKING_UPDATES_PAGE_SIZE"),
);
check(
  "shared Pagination owns arbitrary page parameters while preserving selection query state",
  publicPagination.includes("pageParam?: string") &&
    publicPagination.includes("params.set(pageParam") &&
    publicView.includes('pageParam="stagePage"') &&
    publicView.includes('pageParam="itemPage"') &&
    publicView.includes('pageParam="updatePage"') &&
    publicView.includes('pageParam="mediaPage"') &&
    publicView.includes('pageParam="historyPage"'),
);
check(
  "Admin and Public use one Stage Status derivation owner",
  publicContract.includes("export function deriveProjectTrackingStageStatus") &&
    adminAdapter.includes("deriveProjectTrackingStageStatus") &&
    publicRead.includes("deriveProjectTrackingStageStatus") &&
    !adminAdapter.includes("function derivedStatus") &&
    !paginationMigration.includes("bool_and") &&
    !paginationMigration.includes("bool_or"),
);
check(
  "Tracking read owners use aggregate relation counts instead of loading child rows for counts",
  adminAdapter.includes("project_tracking_updates(count)") &&
    adminAdapter.includes(
      "project_tracking_items(status,project_tracking_updates(count))",
    ) &&
    trackingHub.includes(
      "project_tracking_stages(project_tracking_items(project_tracking_updates(count)))",
    ) &&
    !trackingHub.includes('.select("id,item_id")') &&
    !adminAdapter.includes('.select("id,item_id").in'),
);
check(
  "Stage and Item reorder adopt the existing Instant Mutation lifecycle",
  (adminCollections.match(/action: "reorder"/g)?.length ?? 0) === 2 &&
    (adminCollections.match(/bulk: true/g)?.length ?? 0) >= 2 &&
    (adminCollections.match(/transformActiveRows/g)?.length ?? 0) === 2 &&
    adminCollections.includes("instant.bulkInteraction.isBlocked") &&
    instantMutation.includes("transformActiveRows") &&
    !/reorderTracking(?:Stages|Items)Action[\s\S]{0,180}controller\.invalidate/u.test(
      adminCollections,
    ),
);
check(
  "Stage and Item sizing is explicit and their sticky-end tracks remain cumulative before Actions",
  (adminCollections.match(
    /key: "name"[\s\S]{0,320}primary: true[\s\S]{0,240}flexible: true/g,
  )?.length ?? 0) === 2 &&
    (adminCollections.match(
      /listId="project-tracking-(?:stages|items)"[\s\S]{0,140}sizingStrategy=\{\{ mode: "flexible", columnKey: "name" \}\}/g,
    )?.length ?? 0) === 2 &&
    (adminCollections.match(
      /key: "visibility"[\s\S]{0,180}sticky: "end-adjacent"/g,
    )?.length ?? 0) === 2 &&
    (adminCollections.match(/key: "order"[\s\S]{0,180}sticky: "end-adjacent"/g)
      ?.length ?? 0) === 2 &&
    entityListTable.includes('column.sticky === "end-adjacent"') &&
    entityListTable.includes("const stickyEndOffsets = new Map") &&
    entityListTable.includes(
      "nextStickyEndOffset += allocatedColumnWidths.get(column.key) ?? 0",
    ) &&
    entityListTable.includes("const constrainedMinimumWidths = new Map") &&
    entityListTable.includes("minimumTableWidth - availableTableWidth") &&
    entityListTable.includes("column.key === flexibleColumnKey") &&
    entityListTable.includes(
      "ADMIN_ENTITY_LIST_MINIMUM_FLEXIBLE_TRACK_WIDTH",
    ) &&
    entityListTable.includes("data-admin-table-width-budget") &&
    entityListTable.includes("stickyEndOffsets.get(column.key) ?? 0") &&
    !entityListTable.includes("insetInlineEnd: actionsColumnWidth"),
);
check(
  "Stage, Item, and Update primary columns adopt the explicit text-only presentation contract",
  (adminCollections.match(/primaryPresentation: "text-only"/g)?.length ?? 0) ===
    3 &&
    (adminCollections.match(
      /minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS\.textOnly/g,
    )?.length ?? 0) === 3 &&
    (adminCollections.match(
      /width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS\.textOnly/g,
    )?.length ?? 0) === 3 &&
    !adminCollections.includes("minWidth: 380") &&
    !adminCollections.includes("width: 440") &&
    entityListTable.includes("getAdminDataGridPrimaryPresentationStyle") &&
    entityListTable.includes("column.primaryPresentation") &&
    !entityListTable.includes("usesTextOnlyPrimaryPreset"),
);
check(
  "Construction Updates Hub is Specialized and excluded from the Full Collection claim",
  (() => {
    const hub = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(
      (surface) => surface.id === "construction-updates-hub",
    );
    const trackingCollection = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(
      (surface) => surface.id === "project-construction-tracking",
    );
    return (
      hub?.workflowClassification === "page_system_only" &&
      hub.generic === false &&
      hub.routes.length === 1 &&
      hub.routes[0] === "/admin/projects/construction-updates" &&
      hub.presentationSourceFiles.length === 1 &&
      hub.presentationSourceFiles[0] ===
        "src/app/admin/projects/construction-updates/page.tsx" &&
      hub.layoutOwner ===
        "AdminPageExperience with shared navigation and summary presentation" &&
      hub.requiredAdoption.length === 0 &&
      trackingCollection?.presentationSourceFiles.every(
        (sourceFile) => !sourceFile.includes("construction-updates"),
      ) === true &&
      !existsSync(
        resolve(
          process.cwd(),
          "src/app/admin/projects/construction-updates/ConstructionUpdatesClient.tsx",
        ),
      )
    );
  })(),
);
check(
  "Construction Updates Hub renders the existing shared page, summary, navigation, status, and empty presentation owners",
  (() => {
    const sharedImports = importedBindings(
      constructionUpdatesPage,
      "../../../../components/admin/ui",
    );
    const renderedElements = renderedJsxElements(constructionUpdatesPage);
    const requiredOwners = [
      "AdminActionButton",
      "AdminCard",
      "AdminListEmptyState",
      "AdminMetricCardsGrid",
      "AdminPageContextHeader",
      "AdminPageExperience",
      "AdminStatusPill",
    ];
    const hasClientDirective = constructionUpdatesPage.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === "use client",
    );
    return (
      requiredOwners.every(
        (owner) => sharedImports.has(owner) && renderedElements.has(owner),
      ) && !hasClientDirective
    );
  })(),
);
check(
  "each Tracking Collection consumer carries independent applicability and Source Proof",
  (() => {
    const tracking = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(
      (surface) => surface.id === "project-construction-tracking",
    );
    const expected = new Map([
      ["project-tracking-stages", "project_tracking_stages"],
      ["project-tracking-items", "project_tracking_items"],
      ["project-tracking-updates", "project_tracking_updates"],
    ]);
    return (
      tracking?.consumerAdoptionEvidence.length === expected.size &&
      tracking.consumerAdoptionEvidence.every(
        (consumer) =>
          consumer.applicability.phase === "capability_applicability" &&
          consumer.executableBindings.length > 0 &&
          consumer.dataRegistryEntities.length === 1 &&
          expected.get(consumer.id) === consumer.dataRegistryEntities[0],
      )
    );
  })(),
);
check(
  "Date and Calendar truth is owner_extension_required and no prohibited shared owner was introduced",
  formManifest.includes("date_picker: {") &&
    formManifest.includes('state: "owner_extension_required"') &&
    adminForms.includes('type="date"') &&
    !adminForms.includes("AdminDatePickerField") &&
    !existsSync(
      resolve(
        process.cwd(),
        "src/components/admin/ui/AdminDatePickerField.tsx",
      ),
    ),
);
check(
  "public read distinguishes pending schema, not-found, and unexpected failures",
  publicRead.includes('code === "PGRST202"') &&
    publicRead.includes('code === "PGRST205"') &&
    publicRead.includes('status: "unavailable"') &&
    publicRead.includes('status: "not_found"') &&
    publicRead.includes('status: "ready"') &&
    publicRoute.includes("notFound()") &&
    !publicRead.includes("catch(() => null)"),
);
check(
  "all three Tracking collections remain executable Data Registry consumers",
  [
    "trackingStagesEntityListAdapter",
    "trackingItemsEntityListAdapter",
    "trackingUpdatesEntityListAdapter",
  ].every((token) => registry.includes(token)),
);
check(
  "write RPC ownership, historical integrity, and Media coordination remain unchanged",
  foundationMigration.includes("must contain the exact Project Stage set") &&
    foundationMigration.includes("must contain the exact Stage Item set") &&
    actions.includes("coordinateTrackingUpdateSave") &&
    actions.includes("cleanupDeletedTrackingUpdateMedia") &&
    !actions.includes("deleteMediaAsset"),
);

console.log(`verify-project-tracking-detail OK (${passed} assertions)`);
