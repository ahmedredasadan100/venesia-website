import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (sourceFile: string) =>
  readFileSync(join(ROOT, sourceFile), "utf8");

let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function exportedFunction(source: string, name: string) {
  const ast = ts.createSourceFile("actions.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name + "Impl")
    ?? ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, "Missing action implementation " + name);
  return declaration.getText(ast);
}

function functionSection(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing boundary ${endMarker}`);
  return source.slice(start, end);
}

const contract = read(
  "src/lib/admin/content/entity-list-contracts/topics.ts",
);
const loader = read("src/lib/admin/content/load-unified-content.ts");
const actions = read("src/app/admin/content/topics/actions.ts");
const atomicSql = read("sql/migrations/20260926013216_topics_command_completion.sql");
const rowActions = read(
  "src/components/admin/content/UnifiedContentRowActions.tsx",
);
const listClient = read("src/components/admin/content/TopicsListClient.tsx");
const trashHeader = read(
  "src/components/admin/entity-list/AdminEntityTrashHeader.tsx",
);
const list = read("src/components/admin/content/UnifiedContentList.tsx");
const columns = read(
  "src/components/admin/content/unified-content-columns.tsx",
);
const topicsPage = read("src/app/admin/content/topics/page.tsx");
const sharedRowActions = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const auditActions = read("src/lib/admin/audit/cms-audit-actions.ts");
const bulkLabels = read(
  "src/lib/admin/entity-list/bulk-action-labels.ts",
);

const softDelete = exportedFunction(actions, "softDeleteUnifiedContent");
const restoreAction = exportedFunction(
  actions,
  "restoreUnifiedContent",
);
const purgeAction = exportedFunction(
  actions,
  "permanentlyDeleteUnifiedContent",
);
const emptyTrashAction = exportedFunction(
  actions,
  "emptyUnifiedContentTrash",
);
const bulkAction = exportedFunction(
  actions,
  "bulkUpdateUnifiedContent",
);
const restoreOwner = functionSection(
  actions,
  "async function restoreTopicsWithCanonicalOwner",
  "async function permanentlyDeleteTopicsWithCanonicalOwner",
);
const purgeOwner = functionSection(
  actions,
  "async function permanentlyDeleteTopicsWithCanonicalOwner",
  "async function restoreUnifiedContentImpl",
);
const metricItems = functionSection(
  listClient,
  "const metricItems:",
  "const trashCount",
);

check(
  "Topics owns an active/trash view in its existing query contract",
  contract.includes('view: "active" | "trash"') &&
    contract.includes('view === "trash" ? "trash" : "active"') &&
    contract.includes('params.set("view", "trash")'),
);
check(
  "The shared Topics loader separates active and deleted rows by deleted_at",
  loader.includes('filters.view === "trash"') &&
    loader.includes('query.not("deleted_at", "is", null)') &&
    loader.includes('query.is("deleted_at", null)'),
);
check(
  "Soft delete keeps the slug and stays an update mutation",
  softDelete.includes("runAtomicTopicsBatch") &&
    softDelete.includes('action: "delete"') &&
    atomicSql.includes("when p_action in ('delete', 'move_to_trash') then v_now") &&
    softDelete.includes("slug_retained: true") &&
    !softDelete.includes(".delete()"),
);
check(
  "Soft delete is presented as moving to Trash",
  rowActions.includes('label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات"') &&
    rowActions.includes("سيبقى الـSlug محجوزًا"),
);
check(
  "Restore only targets deleted Topics and restores them unpublished",
  restoreOwner.includes("loadDeletedTopics(input.ids)") &&
    restoreOwner.includes('action: "restore"') &&
    atomicSql.includes("p_action = 'restore' and topic.deleted_at is not null") &&
    atomicSql.includes("when p_action = 'restore' then null") &&
    atomicSql.includes("'unpublished' else topic.status end"),
);
check(
  "Restore blocks a conflicting active slug with a clear domain result",
  actions.includes("findActiveTopicSlugConflict(topics)") &&
    actions.includes('.is("deleted_at", null)') &&
    restoreOwner.includes("topicRestoreSlugConflict(topic.slug, topic.id)"),
);
check(
  "Permanent delete requires explicit confirmation and only targets Trash",
  purgeAction.includes('getString(formData, "confirm_permanent") !== "true"') &&
    purgeAction.includes("permanentlyDeleteTopicsWithCanonicalOwner") &&
    purgeOwner.includes("loadDeletedTopics(input.ids)") &&
    purgeOwner.includes('action: input.scope === "empty_trash" ? "empty_trash" : "permanent_delete"') &&
    atomicSql.includes("delete from public.topics as topic") &&
    atomicSql.includes("topic.deleted_at is not null"),
);
check(
  "Permanent delete releases the slug and delegates media cleanup",
  purgeOwner.includes("slug_released: true") &&
    purgeOwner.includes(
      "synchronizeMediaReferenceWriteScopesAfterDomainMutation",
    ),
);
check(
  "Single and bulk mutations delegate to the same restore and purge owners",
  restoreAction.includes("restoreTopicsWithCanonicalOwner") &&
    purgeAction.includes("permanentlyDeleteTopicsWithCanonicalOwner") &&
    bulkAction.includes("restoreTopicsWithCanonicalOwner") &&
    bulkAction.includes("permanentlyDeleteTopicsWithCanonicalOwner"),
);
check(
  "Bulk Trash mutations reject active or missing Topics before writing",
  restoreOwner.includes("topics.length !== input.ids.length") &&
    restoreOwner.includes("لم تتم استعادة أي Topic نشط") &&
    purgeOwner.includes("topics.length !== input.ids.length") &&
    purgeOwner.includes("لم يتم حذف أي Topic نشط"),
);
check(
  "Empty Trash counts and reloads deleted Topics before canonical purge",
  emptyTrashAction.includes("loadAllDeletedTopics()") &&
    emptyTrashAction.includes("topics.length !== expectedCount") &&
    emptyTrashAction.includes('scope: "empty_trash"') &&
    purgeOwner.includes("expectedTotalDeletedCount") &&
    atomicSql.includes("lock table public.topics in share row exclusive mode") &&
    atomicSql.includes("p_expected_deleted_count"),
);
check(
  "Restore and permanent delete use the existing Topic audit owner",
  actions.includes('action: "restore"') &&
    actions.includes('action: "permanent_delete"') &&
    actions.includes("recordCmsAdminAudit(") &&
    auditActions.includes('permanent_delete: "حذف نهائي"') &&
    auditActions.includes('restore: "استعادة"'),
);
check(
  "Trash actions use the shared confirmation runtime",
  rowActions.includes('mode: "shared"') &&
    rowActions.includes('title: "استعادة الموضوع؟"') &&
    rowActions.includes('title: "حذف الموضوع نهائيًا؟"') &&
    sharedRowActions.includes("AdminConfirmDialog"),
);
check(
  "The Topics header owns the explicit Trash entry instead of a metric card",
  topicsPage.includes('href={`${ADMIN_CONTENT_ROUTES.topics}?view=trash`}') &&
    topicsPage.includes("key={query.filters.view}") &&
    topicsPage.includes("المحذوفات") &&
    !metricItems.includes("المحذوفات"),
);
function matchingNodes<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T) {
  const matches: T[] = [];
  function visit(node: ts.Node) { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); }
  visit(root);
  return matches;
}
function objectProperty(node: ts.Node, name: string, tree: ts.SourceFile) {
  assert.ok(ts.isObjectLiteralExpression(node));
  return node.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(tree) === name)?.initializer;
}
function literalText(node: ts.Node | undefined) { assert.ok(node && ts.isStringLiteral(node)); return node.text; }
function metricSource(source: string) {
  const tree = ts.createSourceFile("TopicsListClient.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = matchingNodes(tree, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === "metricItems");
  assert.equal(declarations.length, 1);
  const rows = declarations[0].initializer;
  assert.ok(rows && ts.isArrayLiteralExpression(rows));
  return { tree, rows };
}
// The existing manifest records the approved six-card row; image=without remains a separate filter.
const metricManifest = ts.createSourceFile("adoption-manifest.ts", read("src/lib/admin/interaction-system/adoption-manifest.ts"), ts.ScriptTarget.Latest, true);
const topicDeclarations = matchingNodes(metricManifest, ts.isObjectLiteralExpression).filter(node => objectProperty(node, "id", metricManifest)?.getText(metricManifest) === '"content-topics"');
assert.equal(topicDeclarations.length, 1);
const visualContract = objectProperty(topicDeclarations[0], "visualPresentation", metricManifest);
assert.ok(visualContract);
const metricContracts = objectProperty(visualContract, "metricCards", metricManifest);
assert.ok(metricContracts && ts.isArrayLiteralExpression(metricContracts));
const topicMetricContracts = metricContracts.elements.filter(node => literalText(objectProperty(node, "sourceFile", metricManifest)) === "src/components/admin/content/TopicsListClient.tsx");
assert.equal(topicMetricContracts.length, 1);
const declaredItems = objectProperty(topicMetricContracts[0], "items", metricManifest);
assert.ok(declaredItems && ts.isArrayLiteralExpression(declaredItems));
const expectedMetricLabels = declaredItems.elements.map(node => literalText(objectProperty(node, "label", metricManifest)));

function assertTopicMetrics(source: string) {
  const { tree, rows } = metricSource(source);
  assert.deepEqual(rows.elements.map(node => literalText(objectProperty(node, "label", tree))), expectedMetricLabels, "Exact current manifest metric order");
  assert.ok(!source.includes('className="min-w-[1146px]"'), "Metric layout remains responsive");
  const gridImports = tree.statements.filter(ts.isImportDeclaration).filter(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../ui" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => !binding.isTypeOnly && binding.name.text === "AdminMetricCardsGrid" && !binding.propertyName));
  assert.equal(gridImports.length, 1, "Canonical shared Grid import");
  const grids = matchingNodes(tree, ts.isJsxSelfClosingElement).filter(node => node.tagName.getText(tree) === "AdminMetricCardsGrid");
  assert.equal(grids.length, 1);
  const items = grids[0].attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === "items")?.initializer;
  assert.ok(items && ts.isJsxExpression(items) && items.expression && ts.isIdentifier(items.expression) && items.expression.text === "metricItems", "Actual declared rows reach the canonical Grid");
  const preparation = ["metricsError", "seoAverage", "seoAverageUnavailable"].map(name => {
    const declarations = matchingNodes(tree, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === name);
    assert.equal(declarations.length, 1);
    return "const " + declarations[0].getText(tree) + ";";
  }).join("\n");
  const values = rows.elements.map(node => {
    const value = objectProperty(node, "value", tree), suffix = objectProperty(node, "suffix", tree);
    assert.ok(value);
    return `{value:(${value.getText(tree)}),suffix:(${suffix?.getText(tree) ?? "undefined"})}`;
  });
  const evaluate = new Function("controller", preparation + "return [" + values.join(",") + "];" ) as (controller: unknown) => Array<{ value: unknown; suffix: unknown }>;
  const ready = { total: 101, published: 23, unpublished: 78, withSeries: 17, featured: 9, withoutImage: 42, seoAverage: 86, error: null };
  assert.deepEqual(evaluate({ result: { metrics: ready } }).map(row => row.value), [ready.total, ready.published, ready.unpublished, ready.withSeries, ready.featured, ready.seoAverage], "Exact native metric value bindings");
  assert.deepEqual(evaluate({ result: { metrics: ready } }).map(row => row.suffix), [undefined, undefined, undefined, undefined, undefined, "/100"]);
  assert.deepEqual(evaluate({ result: { metrics: { ...ready, error: "unavailable" } } }).map(row => row.value), expectedMetricLabels.map(() => "—"));
  assert.deepEqual(evaluate({ result: {} }).map(row => row.value), [0, 0, 0, 0, 0, "—"]);
  assert.ok(evaluate({ result: {} }).every(row => row.suffix === undefined), "Unknown SEO has no fabricated denominator");
  const commands: unknown[][] = [];
  for (const item of rows.elements) {
    const onClick = objectProperty(item, "onClick", tree);
    if (!onClick) continue;
    const compiled = ts.transpileModule(`const callback = ${onClick.getText(tree)}; callback();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("controller", "resetToView", compiled)({ setFilter: (...args: unknown[]) => commands.push(args) }, (view: string) => commands.push(["view", view]));
  }
  assert.deepEqual(commands, [["view", "active"], ["status", "published"], ["status", "unpublished"], ["seriesId", "any"], ["featured", "yes"]], "Exact existing metric query commands");
  assert.ok(!objectProperty(rows.elements.at(-1)!, "onClick", tree), "SEO remains non-interactive");
}
assertTopicMetrics(listClient);
check("Current manifest Topic metrics retain exact order, native values and canonical responsive Grid", true);
check("Topic metric callbacks retain Reset and four native filters while SEO remains static", true);
const { tree: topicMetricAst, rows: topicMetricRows } = metricSource(listClient);
const replaceMetricRows = (rows: string[]) => listClient.slice(0, topicMetricRows.getStart(topicMetricAst)) + "[" + rows.join(",") + "]" + listClient.slice(topicMetricRows.end);
const originalMetricRows = topicMetricRows.elements.map(node => node.getText(topicMetricAst));
for (const [name, source] of [
  ["missing metric", replaceMetricRows(originalMetricRows.slice(1))],
  ["duplicate metric", replaceMetricRows([...originalMetricRows, originalMetricRows[0]])],
  ["reordered metrics", replaceMetricRows([originalMetricRows[1], originalMetricRows[0], ...originalMetricRows.slice(2)])],
  ["wrong native value", listClient.replace("controller.result.metrics?.total ?? 0", "controller.result.metrics?.published ?? 0")],
  ["wrong query command", listClient.replace('controller.setFilter("status", "published")', 'controller.setFilter("status", "unpublished")')],
  ["interactive SEO", replaceMetricRows([...originalMetricRows.slice(0, -1), originalMetricRows.at(-1)!.replace("compact: true", 'compact: true, onClick: () => controller.setFilter("image", "without")')])],
  ["disconnected Grid items", listClient.replace("items={metricItems}", "items={[]}")],
  ["parallel Grid import", listClient.replace('from "../ui";', 'from "./ParallelMetricGrid";')],
  ["fixed metric width", listClient.replace("<AdminMetricCardsGrid ", '<AdminMetricCardsGrid className="min-w-[1146px]" ')],
] as const) {
  assert.notEqual(source, listClient, "Effective negative probe " + name);
  assert.throws(() => assertTopicMetrics(source), name);
  check("Topic metric source proof rejects " + name, true);
}

const toolbarSource = read("src/components/admin/content/UnifiedContentFilters.tsx");
function assertIndependentImageFilter(consumer: string, toolbar: string, querySource: string) {
  const { tree } = metricSource(consumer);
  const calls = matchingNodes(tree, ts.isCallExpression).filter(node => ts.isIdentifier(node.expression) && node.expression.text === "useUnifiedContentToolbar");
  assert.equal(calls.length, 1);
  const input = calls[0].arguments[0], values = objectProperty(input, "values", tree);
  assert.ok(values);
  assert.equal(objectProperty(values, "image", tree)?.getText(tree), "controller.query.filters.image");
  assert.equal(objectProperty(input, "onQueryPatch", tree)?.getText(tree), "controller.applyQueryPatch");
  const toolbarTree = ts.createSourceFile("UnifiedContentFilters.tsx", toolbar, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hook = toolbarTree.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === "useUnifiedContentToolbar");
  assert.ok(hook?.body);
  const declarations = matchingNodes(hook, ts.isVariableDeclaration).filter(node => node.name.getText(toolbarTree) === "filters");
  assert.equal(declarations.length, 1);
  const memo = declarations[0].initializer;
  assert.ok(memo && ts.isCallExpression(memo) && ts.isIdentifier(memo.expression) && memo.expression.text === "useMemo");
  const factory = memo.arguments[0];
  assert.ok(factory && ts.isArrowFunction(factory) && ts.isArrayLiteralExpression(factory.body));
  const imageFilters = factory.body.elements.filter(node => objectProperty(node, "id", toolbarTree)?.getText(toolbarTree) === '"image"');
  assert.equal(imageFilters.length, 1);
  const imageFilter = new Function("return (" + imageFilters[0].getText(toolbarTree) + ");")();
  assert.deepEqual(imageFilter, { id: "image", paramKey: "image", label: "الصورة", placeholder: "الصورة", type: "boolean", options: [{ value: "without", label: "بدون صورة" }] });
  const returned = hook.body.statements.filter(ts.isReturnStatement);
  assert.equal(returned.length, 1);
  const props = returned[0].expression;
  assert.ok(props && ts.isObjectLiteralExpression(props));
  for (const name of ["filters", "onQueryPatch"]) assert.ok(props.properties.some(node => ts.isShorthandPropertyAssignment(node) && node.name.text === name), "Actual toolbar return retains " + name);
  const controlledValues = objectProperty(props, "values", toolbarTree);
  assert.ok(controlledValues);
  assert.equal(objectProperty(controlledValues, "image", toolbarTree)?.getText(toolbarTree), "values.image", "Returned toolbar keeps controlled native image state");
  const queryTree = ts.createSourceFile("topics.ts", querySource, ts.ScriptTarget.Latest, true);
  const methods = ["parseFilters", "writeFilters"].map(name => {
    const nodes = matchingNodes(queryTree, ts.isMethodDeclaration).filter(node => node.name.getText(queryTree) === name);
    assert.equal(nodes.length, 1);
    return nodes[0].getText(queryTree);
  });
  const compiled = ts.transpileModule(exportedFunction(querySource, "positiveId") + ";const query={" + methods.join(",") + "};", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const query = new Function(compiled + ";return query;")() as { parseFilters(params: URLSearchParams): { image: string }; writeFilters(filters: unknown, params: URLSearchParams): void };
  for (const view of ["active", "trash"]) {
    const filters = query.parseFilters(new URLSearchParams({ image: "without", view }));
    assert.equal(filters.image, "without");
    const params = new URLSearchParams();
    query.writeFilters(filters, params);
    assert.equal(params.get("image"), "without", "Native image filter survives both Topic views");
  }
}
assertIndependentImageFilter(listClient, toolbarSource, contract);
check("Without Image remains a controlled shared toolbar filter with native query round-trip in active and Trash views", true);
for (const [name, consumer, toolbar, query] of [
  ["missing Without Image option", listClient, toolbarSource.replace('value: "without"', 'value: "all"'), contract],
  ["disconnected image state", listClient.replace("image: controller.query.filters.image,", 'image: "all",'), toolbarSource, contract],
  ["disconnected query callback", listClient.replace("onQueryPatch: controller.applyQueryPatch,", "onQueryPatch: () => undefined,"), toolbarSource, contract],
  ["detached filter declarations", listClient, toolbarSource.replace("    filters,", "    filters: [],"), contract],
  ["detached returned image state", listClient, toolbarSource.replace("image: values.image,", 'image: "all",'), contract],
  ["detached returned query callback", listClient, toolbarSource.replace("    onQueryPatch,", "    onQueryPatch: () => undefined,"), contract],
  ["lost native image parsing", listClient, toolbarSource, contract.replace('image: image === "without" ? "without" : "all"', 'image: "all"')],
  ["lost native image serialization", listClient, toolbarSource, contract.replace('if (filters.image !== "all") params.set("image", filters.image);', "")],
] as const) {
  assert.ok(consumer !== listClient || toolbar !== toolbarSource || query !== contract, "Effective negative probe " + name);
  assert.throws(() => assertIndependentImageFilter(consumer, toolbar, query), name);
  check("Independent Topic image filter proof rejects " + name, true);
}
check(
  "Trash bulk selection exposes the formal restore and permanent-delete labels",
  bulkLabels.includes('restoreSelected: "استعادة المحدد"') &&
    bulkLabels.includes(
      'permanentlyDeleteSelected: "حذف نهائي للمحدد"',
    ) &&
    list.includes("ADMIN_BULK_ACTION_LABELS.restoreSelected") &&
    list.includes("ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected") &&
    list.includes("enableSelection") &&
    list.includes("getBulkConfirmation"),
);
check(
  "Permanent selected deletion confirms count and irreversibility",
  list.includes('action === "permanent_delete"') &&
    list.includes("ids.length") &&
    list.includes("لا يمكن التراجع عن هذا الإجراء") &&
    list.includes("ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected"),
);
check(
  "Empty Trash uses shared confirmation with a server-verified count",
  listClient.includes("AdminEntityTrashHeader") &&
    trashHeader.includes("floating.openConfirmation") &&
    bulkLabels.includes('emptyTrash: "إفراغ المحذوفات"') &&
    trashHeader.includes("ADMIN_BULK_ACTION_LABELS.emptyTrash") &&
    listClient.includes('formData.set("expected_count", String(expectedCount))') &&
    emptyTrashAction.includes('getString(formData, "confirm_permanent") !== "true"'),
);
check(
  "Featured state is read-only in Trash through the shared inline contract",
  columns.includes('display="featured"') &&
    !columns.includes('role="img"') &&
    rowActions.includes('display === "featured"') &&
    rowActions.includes('disabledReason: "عرض فقط داخل المحذوفات."') &&
    rowActions.includes("isFeatured: Boolean(row.is_featured)") &&
    sharedRowActions.includes('display?: "menu" | "visibility" | "featured"'),
);
check(
  "The Topics client adopts restore and purge through the instant mutation owner",
  listClient.includes('action: "restore"') &&
    listClient.includes('action: "permanent_delete"') &&
    listClient.includes("instant.mutateAsync({"),
);
check(
  "Topic Trash does not introduce ad-hoc browser mutation owners",
  !rowActions.includes("window.confirm") &&
    !listClient.includes("router.refresh") &&
    !listClient.includes("window.location.reload"),
);

console.log(`Topic Trash verification passed (${passed} checks).`);
