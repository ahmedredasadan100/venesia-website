import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function actualArticleDisplaySlot(source: string, mode: "create" | "edit") {
  const tree = ts.createSourceFile("ArticleDisplay.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const unwrap = (node: ts.Expression | undefined): ts.Expression | undefined => {
    while (node && ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  const canonicalImport = (name: string, module: string, defaultImport = false) => tree.statements.filter(node =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === module &&
    node.importClause && !node.importClause.isTypeOnly && (defaultImport ? node.importClause.name?.text === name :
      node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(binding => binding.name.text === name && !binding.propertyName && !binding.isTypeOnly))).length === 1;
  if (!canonicalImport("ContentDisplaySettings", "./ContentDisplaySettings", true) ||
      !canonicalImport("ContentEditorShell", "./ContentEditorShell", true) ||
      !canonicalImport("AdminPageExperience", "../../ui") ||
      !canonicalImport("applyTopicFormDraftFields", "./content-form-definition")) return null;
  const declarations = tree.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === (mode === "create" ? "ArticleCreateEditor" : "ArticleEditor"));
  const editor = declarations[0];
  if (declarations.length !== 1 || !editor?.body || !editor.modifiers?.some(node => node.kind === ts.SyntaxKind.ExportKeyword) ||
      !editor.modifiers.some(node => node.kind === ts.SyntaxKind.DefaultKeyword)) return null;
  const ownReturns = (body: ts.Block) => {
    const returns: ts.ReturnStatement[] = [];
    const visit = (node: ts.Node) => { if (node !== body && ts.isFunctionLike(node)) return; if (ts.isReturnStatement(node)) returns.push(node); ts.forEachChild(node, visit); };
    visit(body); return returns;
  };
  const editorReturns = ownReturns(editor.body), root = unwrap(editorReturns[0]?.expression);
  if (editorReturns.length !== 1 || editorReturns[0]?.parent !== editor.body || !root ||
      !ts.isJsxElement(root) || root.openingElement.tagName.getText(tree) !== "AdminPageExperience") return null;
  const shells = root.children.filter((node): node is ts.JsxSelfClosingElement =>
    ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "ContentEditorShell");
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer;
  if (shells.length !== 1 || shells[0]!.attributes.properties.filter(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "tabs").length !== 1 ||
      attribute(shells[0]!, "tabs")?.getText(tree) !== "{renderTabs}" ||
      shells[0]!.attributes.properties.some(ts.isJsxSpreadAttribute)) return null;
  const renderers = editor.body.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "renderTabs");
  const renderer = renderers[0], model = renderer?.parameters[0];
  if (renderers.length !== 1 || !renderer?.body || renderer.parameters.length !== 1 || !model || !ts.isIdentifier(model.name) || model.name.text !== "model") return null;
  const returns = ownReturns(renderer.body), returned = unwrap(returns[0]?.expression);
  if (returns.length !== 1 || returns[0]?.parent !== renderer.body || !returned || !ts.isArrayLiteralExpression(returned)) return null;
  const property = (node: ts.ObjectLiteralExpression, name: string) => {
    const values = node.properties.filter((row): row is ts.PropertyAssignment => ts.isPropertyAssignment(row) && row.name.getText(tree) === name);
    return values.length === 1 && !node.properties.some(ts.isSpreadAssignment) ? values[0]!.initializer : undefined;
  };
  const tabs = returned.elements;
  if (tabs.length !== 5 || !tabs.every(ts.isObjectLiteralExpression) ||
      !["basic", "display", "faq", "seo", "publish"].every((id, index) => {
        const value = property(tabs[index] as ts.ObjectLiteralExpression, "id"); return value && ts.isStringLiteral(value) && value.text === id;
      })) return null;
  const content = property(tabs[1] as ts.ObjectLiteralExpression, "content");
  if (!content) return null;
  const projectedName = mode === "create" ? "values" : "effectiveTopic", sourceName = mode === "create" ? "defaultValues" : "topic";
  const directDeclarations = (body: ts.Block, name: string) => body.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .filter(node => ts.isIdentifier(node.name) && node.name.text === name);
  const projected = directDeclarations(renderer.body, projectedName), initial = mode === "create" ? directDeclarations(editor.body, sourceName)[0] : undefined;
  const initializer = projected[0]?.initializer, projectedStatement = projected[0]?.parent.parent;
  if (projected.length !== 1 || !initializer || !ts.isCallExpression(initializer) || initializer.expression.getText(tree) !== "applyTopicFormDraftFields" ||
      initializer.arguments.map(node => node.getText(tree)).join("|") !== sourceName + '|model.recoveryFields|"article"' ||
      !projectedStatement || !ts.isVariableStatement(projectedStatement) || projectedStatement.end >= returns[0]!.getStart(tree)) return null;
  const topic = editor.parameters[0]?.name;
  const topicBinding = topic && ts.isObjectBindingPattern(topic) ? topic.elements.find(node => ts.isIdentifier(node.name) && node.name.text === "topic" && !node.propertyName && !node.dotDotDotToken) : undefined;
  if (mode === "create" ? !initial?.initializer || directDeclarations(editor.body, sourceName).length !== 1 ||
      !ts.isVariableStatement(initial.parent.parent) || initial.parent.parent.end >= editorReturns[0]!.getStart(tree) : !topicBinding) return null;
  const tracked = new Set(["ContentDisplaySettings", "ContentEditorShell", "AdminPageExperience", "applyTopicFormDraftFields", "renderTabs", "model", projectedName, sourceName]);
  const permitted = new Set<ts.Node>([renderer, model, projected[0]!, ...(initial ? [initial] : []), ...(topicBinding ? [topicBinding] : [])]);
  const baseIdentifier = (node: ts.Expression): string | null => {
    while (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
    return ts.isIdentifier(node) ? node.text : null;
  };
  let safe = true;
  const visit = (node: ts.Node) => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node) || ts.isFunctionExpression(node)) &&
        node.name && ts.isIdentifier(node.name) && tracked.has(node.name.text) && !permitted.has(node)) safe = false;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        tracked.has(baseIdentifier(node.left) ?? "")) safe = false;
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && tracked.has(baseIdentifier(node.operand) ?? "")) safe = false;
    if (ts.isDeleteExpression(node) && tracked.has(baseIdentifier(node.expression) ?? "")) safe = false;
    ts.forEachChild(node, visit);
  };
  visit(editor);
  const direct = unwrap(content);
  return safe ? { tree, content, unconditional: Boolean(direct && ts.isJsxSelfClosingElement(direct) && direct.tagName.getText(tree) === "ContentDisplaySettings") } : null;
}

function hasVisibleSafeArticleDisplayDefaults(create: string, edit: string, shared: string) {
  const parse = (source: string) => ts.createSourceFile("display.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bindings = [
    ["showTitle", "show_title_on_page"],
    ["showImage", "show_image_on_page"],
    ["showCategory", "show_category_on_page"],
    ["showSeries", "show_series_on_page"],
    ["showExcerpt", "show_excerpt_on_page"],
    ["showDate", "show_date_on_page"],
    ["showIntroCard", "show_intro_card_on_page"],
  ] as const;
  const elements = (tree: ts.SourceFile, tag: string) => {
    const result: ts.JsxOpeningLikeElement[] = [];
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === tag) result.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return result;
  };
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => {
    const value = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name)?.initializer;
    return value && ts.isStringLiteral(value) ? value.text : value && ts.isJsxExpression(value) ? value.expression?.getText() : undefined;
  };
  const [createTree, editTree, sharedTree] = [create, edit, shared].map(parse);
  const createUses = elements(createTree!, "ContentDisplaySettings"), editUses = elements(editTree!, "ContentDisplaySettings"), controls = elements(sharedTree!, "TopicFormSwitch");
  const canonical = [createTree!, editTree!].every((tree) => tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./ContentDisplaySettings" && node.importClause?.name?.text === "ContentDisplaySettings" && !node.importClause.isTypeOnly));
  const definition = sharedTree!.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ContentDisplaySettings");
  const params = definition?.parameters[0]?.name;
  const recoveryProjection = (tree: ts.SourceFile, name: string, original: string) => {
    const canonicalImport = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./content-form-definition" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => binding.name.text === "applyTopicFormDraftFields" && !binding.propertyName));
    let projected = false;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer && ts.isCallExpression(node.initializer)) {
        projected = node.initializer.expression.getText(tree) === "applyTopicFormDraftFields" && node.initializer.arguments.map(argument => argument.getText(tree)).join("|") === `${original}|model.recoveryFields|"article"`;
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return canonicalImport && projected;
  };
  const defaultValues = createTree!.statements.flatMap(node => ts.isFunctionDeclaration(node) && node.body ? [...node.body.statements] : [])
    .flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .find(node => node.name.getText(createTree) === "defaultValues")?.initializer;
  const createDisplayDefaultsOmitted = defaultValues && ts.isObjectLiteralExpression(defaultValues) && !defaultValues.properties.some(node => ts.isSpreadAssignment(node) || (ts.isPropertyAssignment(node) && bindings.some(([, field]) => node.name.getText(createTree) === field)));
  const activeCreate = actualArticleDisplaySlot(create, "create"), activeEdit = actualArticleDisplaySlot(edit, "edit");
  return Boolean(activeCreate?.unconditional && activeEdit?.unconditional) && canonical && createUses.length === 1 && editUses.length === 1 && controls.length === bindings.length && Boolean(params && ts.isObjectBindingPattern(params) && bindings.every(([prop, field]) => params.elements.some((node) => node.name.getText(sharedTree) === prop && node.initializer?.kind === ts.SyntaxKind.TrueKeyword) && controls.filter((node) => attribute(node, "name") === field && attribute(node, "defaultChecked") === `${prop} !== false`).length === 1)) &&
    createDisplayDefaultsOmitted && recoveryProjection(createTree!, "values", "defaultValues") && recoveryProjection(editTree!, "effectiveTopic", "topic") &&
    createUses[0]!.attributes.properties.every((node) => ts.isJsxAttribute(node) && ["columns", "introCardSpan", "presentation", "sectionHeading", ...bindings.map(([prop]) => prop)].includes(node.name.getText(createTree))) &&
    bindings.every(([prop, field]) => attribute(createUses[0]!, prop) === `values.${field}`) &&
    [createUses[0]!, editUses[0]!].every((node) => attribute(node, "sectionHeading") === "إعدادات العرض" && attribute(node, "introCardSpan") === "1") &&
    editUses[0]!.attributes.properties.every(ts.isJsxAttribute) && bindings.every(([prop, field]) => attribute(editUses[0]!, prop) === `effectiveTopic.${field}`);
}

/** Execute selected real source owners; presentation dependencies are opaque React element types. */
function executeArticleDisplayProjection(create: string, edit: string, shared: string) {
  const nativeRequire = createRequire(import.meta.url);
  const cache = new Map<string, Record<string, unknown>>();
  const loadSource = (file: string): Record<string, unknown> => {
    const absolute = resolve(root, file);
    const cached = cache.get(absolute);
    if (cached) return cached;
    const sourceModule = { exports: {} as Record<string, unknown> };
    cache.set(absolute, sourceModule.exports);
    const requireSource = (specifier: string) => {
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(absolute), specifier);
        const source = [target, `${target}.ts`, `${target}.tsx`].find(candidate => existsSync(candidate));
        if (source) return loadSource(source);
      }
      return nativeRequire(specifier);
    };
    const compiled = ts.transpileModule(readFileSync(absolute, "utf8"), { fileName: absolute, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    new Function("require", "module", "exports", compiled.outputText)(requireSource, sourceModule, sourceModule.exports);
    return sourceModule.exports;
  };
  const hydrate = loadSource("src/components/admin/content/editors/content-form-definition.ts").applyTopicFormDraftFields as (values: Record<string, unknown>, fields: Record<string, string[]> | null, type: string) => Record<string, unknown>;
  const tree = ts.createSourceFile("display.tsx", shared, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ContentDisplaySettings");
  assert.ok(owner, "The real shared display function must be present");
  const compiled = ts.transpileModule(owner.getText(tree), { fileName: "display.tsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const displayModule = { exports: {} as Record<string, unknown> };
  const dependencies = ["AdminFormGrid", "AdminFormGridItem", "AdminCard", "AdminModuleSectionHeader", "AdminModuleTabIcon", "TopicFormSwitch"];
  new Function("require", "module", "exports", ...dependencies, "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", compiled.outputText)(nativeRequire, displayModule, displayModule.exports, ...dependencies, "canonical-header-token");
  const display = displayModule.exports.default as (props: Record<string, unknown>) => unknown;
  const propsFromActualConsumer = (source: string, mode: "create" | "edit", values: Record<string, unknown>) => {
    const selected = actualArticleDisplaySlot(source, mode);
    assert.ok(selected, "Display projection must use the actual returned canonical tab and unshadowed hydration bindings");
    const compiled = ts.transpileModule("export const element = (" + selected.content.getText(selected.tree) + ");", {
      fileName: "actual-display-content.tsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    const exports: { element?: { type?: unknown; props?: Record<string, unknown> } | null | false } = {};
    new Function("require", "exports", "ContentDisplaySettings", "values", "effectiveTopic", compiled.outputText)(nativeRequire, exports, display, values, values);
    const element = exports.element;
    assert.ok(element && element.type === display && element.props, "The actual Display content must mount the canonical shared owner for this hydrated state");
    return element.props;
  };
  const controls = (value: unknown): Record<string, boolean> => {
    const result: Record<string, boolean> = {};
    const visit = (node: unknown) => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object" || !("props" in node)) return;
      const element = node as { type: unknown; props: Record<string, unknown> };
      if (element.type === "TopicFormSwitch") result[String(element.props.name)] = Boolean(element.props.defaultChecked);
      visit(element.props.children);
    };
    visit(value);
    return result;
  };
  const nativeFields = Object.keys(controls(display({})));
  return {
    freshCreate: controls(display(propsFromActualConsumer(create, "create", hydrate({}, null, "article")))),
    recoveredCreate: controls(display(propsFromActualConsumer(create, "create", hydrate({}, Object.fromEntries(nativeFields.map(field => [field, []])), "article")))),
    savedEdit: controls(display(propsFromActualConsumer(edit, "edit", hydrate(Object.fromEntries(nativeFields.map(field => [field, false])), null, "article")))),
    recoveredEdit: controls(display(propsFromActualConsumer(edit, "edit", hydrate(Object.fromEntries(nativeFields.map(field => [field, false])), Object.fromEntries(nativeFields.map(field => [field, ["on"]])), "article")))),
  };
}

const fields = [
  "show_date_on_page",
  "show_category_on_page",
  "show_series_on_page",
  "show_intro_card_on_page",
] as const;

const [
  migration,
  displaySettings,
  articleCreate,
  articleEdit,
  review,
  articleHelpers,
  articleTypes,
  articleValidation,
  batchImport,
  publicLoader,
  publicContentOwner,
  topicsPage,
  topicsListing,
  featuredCard,
  featuredContract,
  pageBlockConfigs,
  topicCard,
  topicDetail,
  topicTypes,
  architectureManifest,
  mediaEditor,
  mediaHelpers,
  mediaTypes,
  mediaValidation,
  mediaEditRoute,
  mediaPublicTypes,
  mediaAdapter,
  mediaProvider,
  mediaDetailPage,
  mediaDetailArticle,
  mediaSidebarAdapter,
  mediaSidebar,
  mediaRenderConsumers,
] = await Promise.all([
  read("sql/migrations/20260809120000_topic_display_controls_navigation.sql"),
  read("src/components/admin/content/editors/ContentDisplaySettings.tsx"),
  read("src/components/admin/content/editors/ArticleCreateEditor.tsx"),
  read("src/components/admin/content/editors/ArticleEditor.tsx"),
  read("src/components/admin/content-workflow/ContentReviewPanel.tsx"),
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/article-actions/types.ts"),
  read("src/app/admin/content/topics/article-actions/validation.ts"),
  read("src/app/admin/content/topics/article-actions/batch-import.ts"),
  read("src/lib/topics/load-public-topics.ts"),
  read("src/lib/content/public-content-read/owner.ts"),
  read("src/app/(site)/topics/page.tsx"),
  read("src/components/topics/TopicsListingContent.tsx"),
  read("src/components/featured/FeaturedContentCard.tsx"),
  read("src/lib/featured-modules/contract.ts"),
  read("src/lib/page-blocks/configs.ts"),
  read("src/components/topics/TopicCard.tsx"),
  read("src/app/(site)/topics/[slug]/page.tsx"),
  read("src/lib/topics/types.ts"),
  read("src/lib/admin/content/content-editor-adoption-manifest.ts"),
  read("src/components/admin/content/editors/media/MediaContentForm.tsx"),
  read("src/app/admin/content/topics/media-actions/helpers.ts"),
  read("src/app/admin/content/topics/media-actions/types.ts"),
  read("src/app/admin/content/topics/media-actions/validation.ts"),
  read("src/app/admin/content/topics/[id]/page.tsx"),
  read("src/lib/media-center/types.ts"),
  read("src/lib/media-center/adapt-topic-row.ts"),
  read("src/lib/media-center/unified-provider.ts"),
  read("src/components/media-center/MediaDetailPage.tsx"),
  read("src/components/media-center/MediaDetailArticle.tsx"),
  read("src/lib/media-sidebar-modules/resolve-widget-items.ts"),
  read("src/components/media-center/MediaSidebar.tsx"),
  Promise.all(
    [
      "../sections/DynamicHeroSection.tsx",
      "MediaCenterHubFeatured.tsx",
      "MediaCenterHubGallery.tsx",
      "MediaCenterHubPress.tsx",
      "MediaCenterHubTimeline.tsx",
      "MediaCenterHubVideos.tsx",
      "MediaContentCard.tsx",
      "RelatedMediaRail.tsx",
    ].map((file) => read(`src/components/media-center/${file}`)),
  ).then((sources) => sources.join("\n")),
]);

check(
  "the existing public.topics source of truth gains four backward-compatible controls",
  fields.every((field) =>
    migration.includes(`${field} boolean not null default true`),
  ) && migration.includes("alter table public.topics"),
);

check(
  "the current shared display owner renders one unconditional seven-field contract",
  architectureManifest.includes(
    'displaySettingsOwner: "src/components/admin/content/editors/ContentDisplaySettings.tsx"',
  ) &&
    fields.every(
      (field) =>
        displaySettings.match(new RegExp(`name="${field}"`, "g"))?.length === 1,
    ) &&
    !displaySettings.includes("topicMetadata") &&
    !architectureManifest.includes("topic_display_controls"),
);

check(
  "Article create and edit adopt the extension from the same owner with visible-safe defaults",
  hasVisibleSafeArticleDisplayDefaults(articleCreate, articleEdit, displaySettings),
);

check(
  "Article display defaults reject hidden create values, lost persisted values, changed shared defaults and parallel ownership",
  !hasVisibleSafeArticleDisplayDefaults(articleCreate.replace("<ContentDisplaySettings", "<ContentDisplaySettings showDate={false}"), articleEdit, displaySettings) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate, articleEdit.replace("showDate={effectiveTopic.show_date_on_page}", "showDate={true}"), displaySettings) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate, articleEdit, displaySettings.replace("showDate = true", "showDate = false")) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate, articleEdit, displaySettings.replace("defaultChecked={showDate !== false}", "defaultChecked={true}")) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate.replace('from "./ContentDisplaySettings"', 'from "./ParallelDisplaySettings"'), articleEdit, displaySettings) &&
    !hasVisibleSafeArticleDisplayDefaults(`${articleCreate}\nconst duplicate = <ContentDisplaySettings />;`, articleEdit, displaySettings),
);


function moveArticleDisplayDeclarationAfterReturn(source: string, mode: "create" | "edit", initialDefaults = false) {
  const tree = ts.createSourceFile("DisplayDeclarationOrder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const editor = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) &&
    node.name?.text === (mode === "create" ? "ArticleCreateEditor" : "ArticleEditor"));
  assert.ok(editor?.body);
  const renderer = editor.body.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "renderTabs");
  const body = initialDefaults ? editor.body : renderer?.body;
  assert.ok(body);
  const name = initialDefaults ? "defaultValues" : mode === "create" ? "values" : "effectiveTopic";
  const statement = body.statements.find((node): node is ts.VariableStatement => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name));
  const returned = body.statements.find(ts.isReturnStatement);
  assert.ok(statement && returned && statement.end < returned.getStart(tree));
  return source.slice(0, statement.getStart(tree)) + source.slice(statement.end, returned.end) + "\n" +
    statement.getText(tree) + source.slice(returned.end);
}

const displayActivityMutations: { label: string; mode: "create" | "edit"; source: string; bindingRejected?: boolean }[] = [];
for (const [mode, original] of [["create", articleCreate], ["edit", articleEdit]] as const) {
  const selected = actualArticleDisplaySlot(original, mode);
  assert.ok(selected);
  const slot = selected.content.getText(selected.tree), replaceSlot = (replacement: string) =>
    original.slice(0, selected.content.getStart(selected.tree)) + replacement + original.slice(selected.content.end);
  displayActivityMutations.push(
    { label: mode + " inactive actual content", mode, source: replaceSlot("(false && " + slot + ")") },
    { label: mode + " conditional missing controls", mode, source: replaceSlot("((false as boolean) ? " + slot + " : null)") },
    { label: mode + " detached actual tab producer", mode, source: original.replace("tabs={renderTabs}", "tabs={() => []}") },
    { label: mode + " earlier actual renderer return", mode, source: original.replace("function renderTabs(model: ContentEditorModel) {", "function renderTabs(model: ContentEditorModel) { if (true) return [];") },
    { label: mode + " local canonical owner shadow", mode, source: original.replace("function renderTabs(model: ContentEditorModel) {", "function renderTabs(model: ContentEditorModel) { const ContentDisplaySettings = () => null;") },
    { label: mode + " parallel imported Display owner", mode, source: original.replace('from "./ContentDisplaySettings"', 'from "./ParallelDisplaySettings"') },
    { label: mode + " projected values initialized after returned tabs", mode, bindingRejected: true, source: moveArticleDisplayDeclarationAfterReturn(original, mode) },
    { label: mode + " late duplicate tabs override", mode, bindingRejected: true, source: original.replace("tabs={renderTabs}", "tabs={renderTabs} tabs={() => []}") },
    { label: mode + " local class value shadow", mode, bindingRejected: true, source: original.replace("function renderTabs(model: ContentEditorModel) {", "function renderTabs(model: ContentEditorModel) { class ContentDisplaySettings {}") },
    { label: mode + " local enum value shadow", mode, bindingRejected: true, source: original.replace("function renderTabs(model: ContentEditorModel) {", "function renderTabs(model: ContentEditorModel) { enum ContentDisplaySettings {}") },
    { label: mode + " named expression shadow in actual content", mode, bindingRejected: true, source: replaceSlot("(function ContentDisplaySettings() { return " + slot + "; })()") },
  );
}
displayActivityMutations.push({ label: "create initial defaults initialized after editor return", mode: "create", bindingRejected: true,
  source: moveArticleDisplayDeclarationAfterReturn(articleCreate, "create", true) });
for (const mutation of displayActivityMutations) {
  const original = mutation.mode === "create" ? articleCreate : articleEdit;
  assert.notEqual(mutation.source, original, "Display activity negative changes the actual owner: " + mutation.label);
  const parsed = ts.createSourceFile("DisplayActivityNegative.tsx", mutation.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0, "Syntactically valid Display activity negative: " + mutation.label);
  if (mutation.bindingRejected) assert.equal(actualArticleDisplaySlot(mutation.source, mutation.mode), null, "Actual returned-slot resolver rejects lost binding: " + mutation.label);
  const create = mutation.mode === "create" ? mutation.source : articleCreate, edit = mutation.mode === "edit" ? mutation.source : articleEdit;
  check("Display activity rejects " + mutation.label, !hasVisibleSafeArticleDisplayDefaults(create, edit, displaySettings));
  assert.throws(() => executeArticleDisplayProjection(create, edit, displaySettings), "Actual native projection rejects " + mutation.label);
}

const actualDisplayProjection = executeArticleDisplayProjection(articleCreate, articleEdit, displaySettings);
check(
  "the real shared display function keeps fresh Create visible and restores explicit unchecked draft controls",
  Object.keys(actualDisplayProjection.freshCreate).length > 0 &&
    Object.values(actualDisplayProjection.freshCreate).every(Boolean) &&
    Object.values(actualDisplayProjection.recoveredCreate).every(value => value === false) &&
    Object.keys(actualDisplayProjection.freshCreate).join("|") === Object.keys(actualDisplayProjection.recoveredCreate).join("|"),
);
check(
  "the real hydration adapter and Edit JSX preserve saved false values and restore explicit checked draft controls",
  Object.values(actualDisplayProjection.savedEdit).every(value => value === false) &&
    Object.values(actualDisplayProjection.recoveredEdit).every(Boolean) &&
    Object.keys(actualDisplayProjection.savedEdit).join("|") === Object.keys(actualDisplayProjection.freshCreate).join("|"),
);
check(
  "display adoption rejects hidden Create defaults, disconnected recovery projections and missing explicit recovered props",
  !hasVisibleSafeArticleDisplayDefaults(articleCreate.replace("{ content: defaultContent }", "{ content: defaultContent, show_date_on_page: false }"), articleEdit, displaySettings) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate.replace("defaultValues, model.recoveryFields", "defaultValues, null"), articleEdit, displaySettings) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate, articleEdit.replace("topic, model.recoveryFields", "topic, null"), displaySettings) &&
    !hasVisibleSafeArticleDisplayDefaults(articleCreate.replace("showDate={values.show_date_on_page}", ""), articleEdit, displaySettings),
);

check(
  "the shared review consumer always reads and reports the complete seven-control contract",
  fields.every((field) => review.includes(`checked(form, "${field}"`)) &&
    review.includes("7 خيارات") &&
    !review.includes("hasTopicMetadataDisplay"),
);

check(
  "all five media Admin types adopt the same seven-field owner and persistence contract",
  ["showDate", "showCategory", "showSeries", "showIntroCard"].every((field) =>
    mediaEditor.includes(`${field}={effectiveValues.show_`),
  ) &&
    fields.every(
      (field) =>
        mediaEditor.includes(field) &&
        mediaHelpers.includes(`getBoolean(formData, "${field}")`) &&
        mediaHelpers.includes(`${field}: payload.`) &&
        mediaTypes.includes(`${field}: boolean | null`) &&
        mediaValidation.includes(field) &&
        mediaEditRoute.includes(`${field}: topic.${field}`),
    ) &&
    ["news", "press", "site_update", "video", "gallery"].every((contentType) =>
      architectureManifest.includes(`contentType: "${contentType}"`),
    ),
);

check(
  "the Article persistence adapter reads and writes all four fields without another save owner",
  fields.every(
    (field) =>
      articleHelpers.includes(`getBoolean(formData, "${field}")`) &&
      articleHelpers.includes(`${field}: payload.`) &&
      articleTypes.includes(`${field}?: boolean | null`) &&
      articleValidation.includes(field),
  ),
);

check(
  "the existing SEO batch adapter preserves old visible behavior for the new controls",
  fields.every((field) =>
    batchImport.includes(`setBoolean(formData, "${field}", true)`),
  ),
);

check(
  "the canonical public Topic output defaults legacy rows to visible and carries every control",
  fields.every((field) => publicContentOwner.includes(field)) &&
    [
      "showDateOnPage: item.display.date",
      "showCategoryOnPage: item.display.category",
      "showSeriesOnPage: item.display.series",
      "showIntroCardOnPage: item.display.introCard",
    ].every((token) => publicLoader.includes(token)) &&
    [
      "showDateOnPage",
      "showCategoryOnPage",
      "showSeriesOnPage",
      "showIntroCardOnPage",
    ].every((field) => topicTypes.includes(`${field}?: boolean`)),
);

check(
  "the canonical public Media output carries and visible-defaults the same seven-field contract",
  [
    "showTitleOnPage",
    "showImageOnPage",
    "showExcerptOnPage",
    "showDateOnPage",
    "showCategoryOnPage",
    "showSeriesOnPage",
    "showIntroCardOnPage",
  ].every((field) => mediaPublicTypes.includes(`${field}: boolean`)) &&
    fields.every((field) => publicContentOwner.includes(field)) &&
    ["PUBLIC_CONTENT_COLLECTION_SELECT", "PUBLIC_CONTENT_DETAIL_SELECT"].every(
      (token) => publicContentOwner.includes(token),
    ) &&
    mediaAdapter.includes("item.display.date") &&
    mediaProvider.includes("loadPublicContentCollection"),
);

check(
  "Media detail keeps one Hero-owned title while preserving metadata display controls",
  mediaDetailPage.includes("showTitle={item.showTitleOnPage !== false}") &&
    mediaDetailPage.includes(
      "showHeroImage={item.showImageOnPage !== false}",
    ) &&
    mediaDetailPage.includes(
      "showSubtitle={item.showExcerptOnPage !== false}",
    ) &&
    mediaDetailPage.includes("{item.showTitleOnPage === false ? (") &&
    mediaDetailPage.includes('<h1 className="sr-only">{item.title}</h1>') &&
    mediaDetailArticle.includes(
      "{item.showIntroCardOnPage && hasIntroMetadata ? (",
    ) &&
    [
      "item.showDateOnPage",
      "item.showCategoryOnPage",
      "item.showSeriesOnPage",
    ].every((token) => mediaDetailArticle.includes(token)) &&
    !mediaDetailArticle.includes("<h1") &&
    !mediaDetailArticle.includes("MediaDetailHeroImage") &&
    !mediaDetailArticle.includes("item.showTitleOnPage") &&
    !mediaDetailArticle.includes("item.showImageOnPage") &&
    !mediaDetailArticle.includes("item.showExcerptOnPage"),
);

check(
  "Media listing hub related and sidebar metadata consumers respect date category and series controls",
  ["showDateOnPage", "showCategoryOnPage", "showSeriesOnPage"].every(
    (field) => mediaRenderConsumers.includes(field),
  ) &&
    mediaSidebarAdapter.includes("resolveContentItemDisplay") &&
    ["date", "category", "series"].every(
      (field) => mediaSidebar.includes(`item.display.${field}`),
    ),
);

const filterOwner = publicContentOwner.slice(
  publicContentOwner.indexOf("function applyPublicFilters"),
  publicContentOwner.indexOf("function buildCollectionQuery"),
);
const featuredItemDisplayResolver = featuredContract.slice(
  featuredContract.indexOf("export function resolveFeaturedItemDisplay("),
  featuredContract.indexOf("export type FeaturedEditorItem"),
);
check(
  "one Unified Content public filter owner applies publication, category, and series contracts",
  filterOwner.includes('.eq("status", "published")') &&
    filterOwner.includes('.in("category_slug", input.categorySlugs)') &&
    filterOwner.includes('.eq("series_slug", input.seriesSlug)') &&
    publicContentOwner.includes("applyPublicFilters(selected, input)"),
);

check(
  "the /topics query, pagination, sort, and cache contract carry the series filter",
  topicsPage.includes("series?: string") &&
    topicsListing.includes(
      "firstParam(searchParams.series)?.trim()",
    ) &&
    topicsListing.includes("seriesSlug: seriesSlug || undefined") &&
    topicsListing.includes("if (seriesSlug) query.series = seriesSlug") &&
    topicsListing.includes(
      'buildTopicsQuery("latest", categorySlug, seriesSlug)',
    ) &&
    topicsListing.includes(
      'buildTopicsQuery("oldest", categorySlug, seriesSlug)',
    ) &&
    topicsListing.includes("query={pageQuery}") &&
    publicLoader.includes("seriesSlug?: string") &&
    publicLoader.includes("seriesSlug: params.seriesSlug") &&
    publicContentOwner.includes('.eq("series_slug", input.seriesSlug)'),
);

check(
  "Topic cards keep item visibility while Featured owns current-module item visibility with real taxonomy values",
  [featuredCard, topicCard].every(
    (source) =>
      source.includes("/topics?category=${encodeURIComponent(") &&
      source.includes("/topics?series=${encodeURIComponent("),
  ) &&
    featuredCard.includes("resolveFeaturedItemDisplay(display, item)") &&
    featuredItemDisplayResolver.includes("resolveContentItemDisplay(") &&
    ["title", "image", "excerpt", "date", "category", "series"].every(
      (field) => featuredItemDisplayResolver.includes(`${field}: true`),
    ) &&
    pageBlockConfigs.includes(
      "display[field] && itemDisplay[field] && Boolean(values[field])",
    ) &&
    ["title", "image", "excerpt", "date", "category", "series"].every(
      (field) => featuredContract.includes(`${field}: item.${field}`),
    ) &&
    topicCard.includes("showDateOnPage") &&
    topicCard.includes("showCategoryOnPage") &&
    topicCard.includes("showSeriesOnPage"),
);

check(
  "the Topic detail intro card has one complete visibility gate and respects every item control",
  topicDetail.includes("{topic.showIntroCardOnPage ? (") &&
    topicDetail.includes("topic.showImageOnPage ? (") &&
    topicDetail.includes("topic.showTitleOnPage ? (") &&
    topicDetail.includes("topic.showExcerptOnPage ? (") &&
    topicDetail.includes("topic.showDateOnPage") &&
    topicDetail.includes("topic.showCategoryOnPage") &&
    topicDetail.includes("topic.showSeriesOnPage") &&
    topicDetail.includes(
      "/topics?category=${encodeURIComponent(topic.categorySlug)}",
    ) &&
    topicDetail.includes(
      "/topics?series=${encodeURIComponent(topic.seriesSlug)}",
    ),
);

check(
  "Article body and closed rich-text typography remain outside the display-control delta",
  topicDetail.includes("<RichTextContent") &&
    topicDetail.includes("value={topic.content}") &&
    topicDetail.includes('className="article-rich-text"'),
);

console.log(
  `verify:topic-display-controls-navigation passed (${passed} assertions)`,
);
