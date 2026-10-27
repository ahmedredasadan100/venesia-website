import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const moduleLoader = require("node:module") as {
  _load(request: string, parent: NodeModule | null, isMain: boolean): unknown;
};
const loadModule = moduleLoader._load;
moduleLoader._load = (request, parent, isMain) =>
  request === "server-only" ? {} : loadModule(request, parent, isMain);

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;
  (module as NodeModule & { _compile(source: string, filename: string): void })._compile(output, filename);
};

require.extensions[".tsx"] = require.extensions[".ts"];

const { getGlobalSeoDefaults } = require("../src/lib/seo/global-seo-defaults.ts") as typeof import("../src/lib/seo/global-seo-defaults.ts");
const { resolveSeoMetadata } = require("../src/lib/seo/resolve-seo-metadata.ts") as typeof import("../src/lib/seo/resolve-seo-metadata.ts");
const { buildMetadataFromResolved } = require("../src/lib/seo/build-metadata-from-resolved.ts") as typeof import("../src/lib/seo/build-metadata-from-resolved.ts");
const { composeSeoTitle, getSeoTitleSuffix, trimToSeoLength } = require("../src/lib/seo/seo-utils.ts") as typeof import("../src/lib/seo/seo-utils.ts");
const {
  buildTopicPublishChecklist,
  getTopicPublishOnlyValidationError,
} = require("../src/lib/admin/content-workflow/topic-publish-validation.ts") as typeof import("../src/lib/admin/content-workflow/topic-publish-validation.ts");
const { analyzeEntitySeo } = require("../src/lib/admin/seo-score.ts") as typeof import("../src/lib/admin/seo-score.ts");
const { extractPageBlockSeoText } = require("../src/lib/page-blocks/configs.ts") as typeof import("../src/lib/page-blocks/configs.ts");
const {
  SEO_LENGTH_STANDARDS,
  assessSeoLength,
} = require("../src/lib/admin/seo-length-standards.ts") as typeof import("../src/lib/admin/seo-length-standards.ts");
const { getPayload, buildTopicWritePayload } = require("../src/app/admin/content/topics/article-actions/helpers.ts") as typeof import("../src/app/admin/content/topics/article-actions/helpers.ts");

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
const saveAction = read("src/app/admin/content/topics/article-actions/save.ts");
const validation = read("src/app/admin/content/topics/article-actions/validation.ts");
const seoPanel = read("src/components/admin/SeoPanel.tsx");
const sharedSeoPanel = read("src/components/admin/seo/AdminEntitySeoPanel.tsx");
const formListbox = read("src/components/admin/ui/AdminFormListboxSelect.tsx");
const listbox = read("src/components/admin/ui/AdminListboxSelect.tsx");
const accordion = read("src/components/admin/ui/AdminSingleOpenAccordion.tsx");
const adminUiIndex = read("src/components/admin/ui/index.ts");
const seoScore = read("src/lib/admin/seo-score.ts");
const contentReviewCapability = read("src/lib/admin/content-workflow/content-review-capability.ts");
const seoStandards = read("src/lib/admin/seo-length-standards.ts");
const entitySeoContract = read("src/lib/seo/entity-seo-types.ts");
const navigation = read("src/components/admin/ui/AdminModuleTabs.tsx");
const sharedReview = read("src/components/admin/review/AdminEntityReviewPanel.tsx");
const publishingOptions = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const publishingDateField = read("src/components/admin/content/editors/article/TopicDateLabelField.tsx");
const formSwitch = read("src/components/admin/content/editors/article/TopicFormSwitch.tsx");
const sharedFormSwitch = read("src/components/admin/ui/AdminFormSwitch.tsx");
const sharedCheckbox = read("src/components/admin/ui/AdminCheckbox.tsx");
const sharedDataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const displaySettings = read("src/components/admin/content/editors/ContentDisplaySettings.tsx");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const { applyTopicFormDraftFields } = require("../src/components/admin/content/editors/content-form-definition.ts") as typeof import("../src/components/admin/content/editors/content-form-definition");
const { ENTITY_SEO_FIELD_NAMES: hydrationFieldNames } = require("../src/lib/seo/entity-seo-types.ts") as typeof import("../src/lib/seo/entity-seo-types");
type HydratedSeo = Pick<import("../src/lib/seo/entity-seo-types").EntitySeoValues, keyof typeof hydrationFieldNames>;
function topicSeoHydration(source: string, mode: "create" | "edit") {
  const tree = ts.createSourceFile("ArticleEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0, "hydration source parses");
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const result: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
    visit(root); return result;
  };
  const compact = (node: ts.Node) => node.getText(tree).replace(/\s+/gu, "");
  const imported = (module: string, name: string, isDefault = false) => tree.statements.filter(node => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== module || node.importClause?.isTypeOnly) return false;
    if (isDefault) return node.importClause?.name?.text === name;
    const bindings = node.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings) && bindings.elements.some(binding => !binding.isTypeOnly && binding.name.text === name && (binding.propertyName ?? binding.name).text === name);
  }).length === 1;
  assert.ok(imported("./content-form-definition", "applyTopicFormDraftFields") && imported("../../SeoPanel", "SeoPanel", true) && imported("./ContentEditorShell", "ContentEditorShell", true) && imported("../../ui", "AdminPageExperience"), "canonical hydration and native adapter imports");
  const ownReturns = (body: ts.Block) => {
    const nodes: ts.ReturnStatement[] = [];
    const visit = (node: ts.Node) => {
      if (node !== body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node)) nodes.push(node);
      ts.forEachChild(node, visit);
    };
    visit(body); return nodes;
  };
  const editor = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === (mode === "edit" ? "ArticleEditor" : "ArticleCreateEditor"));
  assert.ok(editor?.body && editor.modifiers?.some(node => node.kind === ts.SyntaxKind.DefaultKeyword), "actual exported editor function");
  const publicProps = editor.parameters[0]?.name;
  assert.ok(publicProps && ts.isObjectBindingPattern(publicProps), "actual public editor props");
  const publicTopic = publicProps.elements.filter(node => node.name.getText(tree) === "topic" || node.propertyName?.getText(tree) === "topic");
  if (mode === "edit") assert.ok(publicTopic.length === 1 && publicTopic[0]!.name.getText(tree) === "topic" && !publicTopic[0]!.propertyName && !publicTopic[0]!.initializer, "saved topic is the actual public prop");
  const editorReturns = ownReturns(editor.body);
  assert.equal(editorReturns.length, 1, "one active editor return");
  assert.equal(editorReturns[0]!.parent === editor.body, true, "editor return is unconditional");
  let editorRoot = editorReturns[0]!.expression;
  while (editorRoot && ts.isParenthesizedExpression(editorRoot)) editorRoot = editorRoot.expression;
  assert.ok(editorRoot && ts.isJsxElement(editorRoot) && editorRoot.openingElement.tagName.getText(tree) === "AdminPageExperience", "actual canonical returned editor surface");
  const shells = editorRoot.children.filter((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "ContentEditorShell");
  assert.equal(shells.length, 1, "active direct canonical editor shell");
  const shellAttribute = (name: string) => shells[0]!.attributes.properties.filter((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === name);
  assert.equal(shells[0]!.attributes.properties.every(ts.isJsxAttribute), true, "shell native bindings cannot be overridden by spreads");
  for (const [name, expected] of [["tabs", "{renderTabs}"], ["initialModelValue", "{initialModelValue}"], ["draftSession", "{draftSession}"]] as const) {
    const attributes = shellAttribute(name);
    assert.equal(attributes.length, 1, `one ${name} shell binding`);
    assert.equal(attributes[0]!.initializer && compact(attributes[0]!.initializer), expected, `active ${name} shell transport`);
  }
  const renderers = editor.body.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "renderTabs");
  assert.equal(renderers.length, 1, "one active tab producer");
  const renderer = renderers[0]!;
  assert.ok(renderer.body && renderer.parameters.length === 1 && renderer.parameters[0]!.name.getText(tree) === "model", "recovery model binding");
  const variable = (name: string) => {
    const declarations = find(renderer.body!, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === name);
    assert.equal(declarations.length, 1, `one ${name} projection`);
    const declaration = declarations[0]!;
    assert.equal(declaration.parent.parent.parent === renderer.body, true, `${name} is an unconditional direct projection`);
    return declaration;
  };
  const projectedName = mode === "edit" ? "effectiveTopic" : "values";
  const projection = variable(projectedName), keywords = variable("seoKeywords");
  assert.equal(projection.initializer && compact(projection.initializer), `applyTopicFormDraftFields(${mode === "edit" ? "topic" : "defaultValues"},model.recoveryFields,"article")`, "saved base and actual recovery fields reach the canonical owner");
  assert.equal(keywords.initializer && compact(keywords.initializer), mode === "edit" ? "getSeoKeywords(effectiveTopic.seo_keywords)" : "Array.isArray(values.seo_keywords)?values.seo_keywords.map(String):[]", "saved and restored keywords follow the projected source");
  const initialModels = editor.body.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).filter(node => node.name.getText(tree) === "initialModelValue");
  assert.equal(initialModels.length, 1, "one initial controlled model");
  const initialModel = initialModels[0]!.initializer;
  assert.ok(initialModel && ts.isObjectLiteralExpression(initialModel) && initialModel.properties.every(ts.isPropertyAssignment), "explicit canonical model initialization");
  for (const [prop, field] of [["seoTitle", "seo_title"], ["seoDescription", "seo_description"], ["focusKeyword", "focus_keyword"]] as const) {
    const values: ts.PropertyAssignment[] = initialModel.properties.filter((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === prop);
    assert.equal(values.length, 1, `one initial ${prop}`);
    assert.equal(compact(values[0]!.initializer), mode === "edit" ? `topic.${field}??""` : '""', `${prop} starts from saved Edit or blank Create state`);
  }
  const tracked = new Set(["applyTopicFormDraftFields", "SeoPanel", "AdminPageExperience", "ContentEditorShell", "model", "initialModelValue", "renderTabs", projectedName, "seoKeywords", ...(mode === "edit" ? ["getSeoKeywords", "topic"] : ["defaultValues"])]);
  const boundNames = (node: ts.BindingName): string[] => ts.isIdentifier(node) ? [node.text] : node.elements.flatMap(element => ts.isBindingElement(element) ? boundNames(element.name) : []);
  for (const node of find(editor, ts.isFunctionDeclaration)) {
    if (node === editor || node === renderer) continue;
    assert.equal(Boolean(node.name && tracked.has(node.name.text)), false, "local functions cannot replace hydration owners");
  }
  assert.equal(boundNames(publicProps).some(name => tracked.has(name) && !(mode === "edit" && name === "topic")), false, "public props cannot replace hydration owners");
  for (const node of find(editor, ts.isVariableDeclaration)) {
    if (node === projection || node === keywords || node === initialModels[0] || (mode === "create" && node.name.getText(tree) === "defaultValues" && node.parent.parent.parent === editor.body)) continue;
    assert.equal(boundNames(node.name).some(name => tracked.has(name)), false, "hydration bindings cannot be shadowed");
  }
  for (const node of find(editor, ts.isParameter)) {
    if (node === renderer.parameters[0] || node === editor.parameters[0]) continue;
    assert.equal(boundNames(node.name).some(name => tracked.has(name)), false, "hydration parameters cannot shadow owners");
  }
  for (const node of find(editor, ts.isBinaryExpression)) {
    if (node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      let target = node.left;
      while (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) target = target.expression;
      assert.equal(ts.isIdentifier(target) && tracked.has(target.text), false, "hydration identities and their input fields cannot be reassigned");
    }
  }
  const returned = ownReturns(renderer.body);
  assert.equal(returned.length, 1, "one active returned tab array");
  assert.equal(returned[0]!.parent === renderer.body, true, "tab array return is unconditional");
  assert.ok(returned[0]!.expression && ts.isArrayLiteralExpression(returned[0]!.expression), "actual returned tabs");
  const seoTabs = returned[0]!.expression.elements.filter((node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node) && node.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === "id" && ts.isStringLiteral(property.initializer) && property.initializer.text === "seo"));
  assert.equal(seoTabs.length, 1, "one returned SEO tab");
  const contents = seoTabs[0]!.properties.filter((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === "content");
  assert.equal(contents.length, 1, "one active SEO tab content");
  let content = contents[0]!.initializer;
  while (ts.isParenthesizedExpression(content)) content = content.expression;
  assert.ok(ts.isJsxSelfClosingElement(content) && content.tagName.getText(tree) === "SeoPanel", "active canonical native SEO adapter");
  assert.equal(content.attributes.properties.every(ts.isJsxAttribute), true, "native SEO bindings cannot be replaced by spreads");
  for (const [name, expected] of [["controlledValues", "{title:model.value.title,excerpt:model.value.excerpt,content:model.value.content,seoTitle:model.value.seoTitle,seoDescription:model.value.seoDescription,focusKeyword:model.value.focusKeyword,}"], ["onControlledValueChange", "model.setField"]] as const) {
    const attributes: ts.JsxAttribute[] = content.attributes.properties.filter((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === name);
    assert.equal(attributes.length, 1, `one ${name} native model binding`);
    const initial = attributes[0]!.initializer;
    assert.ok(initial && ts.isJsxExpression(initial) && initial.expression, `actual ${name} binding`);
    assert.equal(compact(initial.expression), expected, `${name} preserves canonical model state`);
  }
  const expressions: string[] = [];
  for (const [prop, field] of Object.entries(hydrationFieldNames)) {
    const attributes: ts.JsxAttribute[] = content.attributes.properties.filter((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === prop);
    assert.equal(attributes.length, 1, `${prop} has exactly one native binding`);
    const initial = attributes[0]!.initializer;
    assert.ok(initial && ts.isJsxExpression(initial) && initial.expression, `${prop} has an actual value`);
    const expected = prop === "seoKeywords" ? "seoKeywords" : `${projectedName}.${field}??${prop.startsWith("robots") ? "null" : '""'}`;
    assert.equal(compact(initial.expression), expected, `${prop} preserves explicit false, clear and inherited values`);
    expressions.push(`${prop}: ${initial.expression.getText(tree)}`);
  }
  const keywordHelper = mode === "edit" ? tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "getSeoKeywords") : undefined;
  if (mode === "edit") assert.ok(keywordHelper, "actual edit keyword normalizer");
  if (mode === "create") {
    const contentDefaults = editor.body.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).filter(node => node.name.getText(tree) === "defaultContent");
    assert.ok(contentDefaults.length === 1 && contentDefaults[0]!.initializer && ts.isStringLiteral(contentDefaults[0]!.initializer), "actual literal Create content base");
    const defaults = find(editor, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === "defaultValues");
    assert.equal(defaults.length, 1, "one blank create base");
    assert.equal(defaults[0]!.initializer && compact(defaults[0]!.initializer), "{content:defaultContent}", "Create does not invent persisted SEO overrides");
  }
  const output = ts.transpileModule(`return function(topic, recoveryFields) { const defaultValues = topic; const model = { recoveryFields }; ${keywordHelper?.getText(tree) ?? ""} const ${projection.getText(tree)}; const ${keywords.getText(tree)}; return { ${expressions.join(",")} }; }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function("applyTopicFormDraftFields", output)(applyTopicFormDraftFields) as (base: Record<string, unknown>, fields: import("../src/lib/admin/content/topic-revision").TopicFormDraftFields | null) => HydratedSeo;
}
function rejectsTopicSeoHydration(source: string, mode: "create" | "edit", before: string, after: string) {
  source = source.replaceAll("\r\n", "\n");
  const mutated = source.replaceAll(before, after);
  assert.notEqual(mutated, source, "hydration mutation changes actual source");
  const tree = ts.createSourceFile("hydration-negative.tsx", mutated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0, "hydration mutation remains syntax-valid");
  assert.throws(() => topicSeoHydration(mutated, mode), `changed ${mode} hydration contract must reject: ${before}`);
  return true;
}
function hasOneUnselectedTopicSeoAdapter(source: string) {
  const tree = ts.createSourceFile("ArticleEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(tree.statements.flatMap((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../SeoPanel" && node.importClause?.name ? [node.importClause.name.text] : []));
  const calls: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && names.has(node.tagName.getText(tree))) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return calls.length === 1 && calls[0]!.attributes.properties.every((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) !== "presentation");
}
function hasTopicSeoSectionHeadersOnly(source: string) {
  const tree = ts.createSourceFile("ArticleEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sections: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && node.properties.some((property) => ts.isPropertyAssignment(property) &&
      property.name.getText(tree) === "id" && ts.isStringLiteral(property.initializer) && property.initializer.text === "seo")) sections.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return sections.length === 1 && sections[0]!.properties.every((property) => ts.isPropertyAssignment(property) &&
    !["sectionHeading", "sectionDescription"].includes(property.name.getText(tree))) &&
    sections[0]!.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(tree) === "navigationLabel" &&
      ts.isStringLiteral(property.initializer) && property.initializer.text === "SEO");
}
function hasSupportedSeoPanelAccordion(input: string, owner: string) {
  const tree = ts.createSourceFile("AdminEntitySeoPanel.tsx", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ownerTree = ts.createSourceFile("AdminSingleOpenAccordion.tsx", owner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const nodes: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return nodes;
  };
  const props = ownerTree.statements.find((node): node is ts.TypeAliasDeclaration =>
    ts.isTypeAliasDeclaration(node) && node.name.text === "AdminSingleOpenAccordionProps",
  );
  const presentationProp = props && ts.isTypeLiteralNode(props.type) ? props.type.members.find((node): node is ts.PropertySignature =>
    ts.isPropertySignature(node) && node.name.getText(ownerTree) === "presentation",
  ) : undefined;
  const choices = presentationProp?.type && ts.isUnionTypeNode(presentationProp.type) ? presentationProp.type.types.map((node) =>
    ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? node.literal.text : null,
  ).sort() : [];
  const renderer = ownerTree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "AdminSingleOpenAccordion",
  );
  const parameters = renderer?.parameters[0]?.name;
  const initial = parameters && ts.isObjectBindingPattern(parameters) ? parameters.elements.find((node) =>
    ts.isIdentifier(node.name) && node.name.text === "presentation",
  )?.initializer : undefined;
  const tokens = ["ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME", "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME"];
  const imports = new Set(ownerTree.statements.flatMap((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== "../../../lib/admin/admin-ui-styles") return [];
    const bindings = node.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings) ? bindings.elements.filter((binding) =>
      (binding.propertyName ?? binding.name).text === binding.name.text,
    ).map((binding) => binding.name.text) : [];
  }));
  const controls = find(ownerTree, ts.isJsxOpeningElement).filter((node) => node.tagName.getText(ownerTree) === "button");
  const calls = find(tree, ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(tree) === "AdminSingleOpenAccordion");
  const call = calls[0];
  const callPresentation = call?.attributes.properties.find((node): node is ts.JsxAttribute =>
    ts.isJsxAttribute(node) && node.name.getText(tree) === "presentation",
  )?.initializer;
  return Boolean(presentationProp?.questionToken && choices.join("|") === "default|panel" && initial && ts.isStringLiteral(initial) && initial.text === "default" &&
    tokens.every((token) => imports.has(token) && find(ownerTree, ts.isIdentifier).filter((node) => node.text === token).length >= 2) &&
    controls.length === 1 && calls.length === 1 && callPresentation && ts.isJsxExpression(callPresentation) &&
    callPresentation.expression?.getText(tree) === 'panel ? "panel" : undefined' &&
    input.includes('from "../ui/AdminSingleOpenAccordion"') &&
    owner.includes('from "./AdminForm"') && owner.includes('from "./AdminModuleTabs"') &&
    owner.includes('presentation="leading-icon"') && owner.includes('name={item.icon ?? "section"}') &&
    owner.includes('data-admin-single-open-accordion-presentation={panel ? "panel" : undefined}') &&
    owner.includes('className={ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME}') &&
    ["overview", "media", "seo"].every((icon) => input.includes(`icon: "${icon}"`)));
}
const previewCapability = read("src/lib/admin/interaction-system/entity-preview-capability.ts");
const contentPreviewCapability = read("src/lib/admin/content/entity-preview-capabilities.ts");
const previewActions = read("src/components/admin/ui/AdminEntityPreviewActions.tsx");
const publicContentOwner = read("src/lib/content/public-content-read/owner.ts");
const publicPage = read("src/app/(site)/topics/[slug]/page.tsx");
const newMigration = read("sql/migrations/20260722120000_topics_seo_overrides.sql");
const finalMigration = read("sql/migrations/20260803153000_shared_entity_seo_capability.sql");
const lockedMigration = read("sql/migrations/20260721143000_topics_page_display_settings.sql");
// Expand all supported shared presentations from their actual rendered JSX.
// Keep omitted default and preserved Premium proof alongside Topic's Panel opt-in.
const seoPresentationTree = ts.createSourceFile("AdminEntitySeoPanel.tsx", sharedSeoPanel, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const seoPresentationDeclarations = new Map<string, ts.Expression>();
const collectSeoPresentationDeclarations = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    seoPresentationDeclarations.set(node.name.text, node.initializer);
  }
  ts.forEachChild(node, collectSeoPresentationDeclarations);
};
collectSeoPresentationDeclarations(seoPresentationTree);
const seoPremiumSelector = seoPresentationDeclarations.get("premium");
const seoPanelSelector = seoPresentationDeclarations.get("panel");
assert.ok(seoPremiumSelector && ts.isBinaryExpression(seoPremiumSelector) &&
  seoPremiumSelector.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
  ts.isBinaryExpression(seoPremiumSelector.left) && seoPremiumSelector.left.left.getText(seoPresentationTree) === "presentation" &&
  seoPremiumSelector.left.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
  ts.isStringLiteral(seoPremiumSelector.left.right) && seoPremiumSelector.left.right.text === "premium" &&
  ts.isIdentifier(seoPremiumSelector.right) && seoPremiumSelector.right.text === "panel" &&
  seoPanelSelector && ts.isBinaryExpression(seoPanelSelector) && seoPanelSelector.left.getText(seoPresentationTree) === "presentation" &&
  seoPanelSelector.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(seoPanelSelector.right) && seoPanelSelector.right.text === "panel",
"SEO branch inspection requires explicit Premium and Panel selectors with no default adoption.");
function isSeoJsxInitializer(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) ||
    ts.isParenthesizedExpression(node) && isSeoJsxInitializer(node.expression) ||
    ts.isConditionalExpression(node) && (isSeoJsxInitializer(node.whenTrue) || isSeoJsxInitializer(node.whenFalse));
}
type SeoPresentation = "default" | "premium" | "panel";
function defaultSeoFragment(node: ts.Node, expanding: readonly string[] = [], presentation: SeoPresentation = "default"): string {
  const start = node.getStart(seoPresentationTree);
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  const visit = (child: ts.Node) => {
    const condition = ts.isConditionalExpression(child) ? child.condition.getText(seoPresentationTree) : undefined;
    if (ts.isConditionalExpression(child) && (condition === "premium" || condition === "panel")) {
      const enabled = condition === "panel" ? presentation === "panel" : presentation !== "default";
      replacements.push({ start: child.getStart(seoPresentationTree), end: child.getEnd(), text: defaultSeoFragment(enabled ? child.whenTrue : child.whenFalse, expanding, presentation) });
      return;
    }
    if (ts.isJsxExpression(child) && child.expression && ts.isIdentifier(child.expression)) {
      const name = child.expression.text;
      const initializer = seoPresentationDeclarations.get(name);
      if (initializer && isSeoJsxInitializer(initializer) && !expanding.includes(name)) {
        replacements.push({ start: child.getStart(seoPresentationTree), end: child.getEnd(), text: defaultSeoFragment(initializer, [...expanding, name], presentation) });
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  let result = node.getText(seoPresentationTree);
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    result = result.slice(0, replacement.start - start) + replacement.text + result.slice(replacement.end - start);
  }
  return result;
}
const seoDefaultContent = (name: string, presentation: SeoPresentation = "default") => {
  const initializer = seoPresentationDeclarations.get(name);
  assert.ok(initializer, `Existing SEO presentation content is required: ${name}`);
  return defaultSeoFragment(initializer, [name], presentation);
};
const editorRobotsBlockStart = sharedSeoPanel.indexOf("const robotsCanonicalContent");
const editorRobotsBlockEnd = sharedSeoPanel.indexOf("const socialSharingFields", editorRobotsBlockStart);
const editorRobotsRender = seoDefaultContent("robotsCanonicalContent");
const editorRobotsIndexPosition = editorRobotsRender.indexOf("fieldIds.robotsIndexListbox");
const editorRobotsFollowPosition = editorRobotsRender.indexOf("fieldIds.robotsFollowListbox");
const editorCanonicalPosition = editorRobotsRender.indexOf("fieldIds.canonicalUrl");
const seoBasicsStart = sharedSeoPanel.indexOf("const seoBasicsContent");
const seoReturnStart = sharedSeoPanel.indexOf("  return (", seoBasicsStart);
const seoPrimaryRender = ["seoBasicsContent", "robotsCanonicalContent", "socialSharingFields"].map((name) => seoDefaultContent(name)).join("\n");
const seoPremiumPrimaryRender = ["seoBasicsContent", "robotsCanonicalContent", "socialSharingFields"].map((name) => seoDefaultContent(name, "premium")).join("\n");
const seoPremiumRobotsRender = seoDefaultContent("robotsCanonicalContent", "premium");
const seoPanelPrimaryRender = ["seoBasicsContent", "robotsCanonicalContent", "socialSharingFields"].map((name) => seoDefaultContent(name, "panel")).join("\n");
const seoPanelRobotsRender = seoDefaultContent("robotsCanonicalContent", "panel");
const seoHelperStart = sharedSeoPanel.indexOf("<AdminSingleOpenAccordion", seoReturnStart);
const seoHelperRender = sharedSeoPanel.slice(seoHelperStart);

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function visibleJsxText(source: string) {
  return source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const global = {
  ...getGlobalSeoDefaults(),
  siteName: "Global Site",
  defaultTitle: "Global fallback title",
  defaultDescription: "Global fallback description",
  defaultOgImage: "/images/global-og.jpg",
  defaultOgImageAlt: "Global OG image",
  defaultTwitterImage: "/images/global-twitter.jpg",
  defaultRobotsIndex: true,
  defaultRobotsFollow: true,
  siteUrl: "https://global.example",
  canonicalBaseUrl: "https://global.example",
};

const topicResolved = resolveSeoMetadata(
  {
    path: "/topics/topic-slug",
    entitySeo: {
      title: "Topic SEO title",
      description: "Topic SEO description",
      canonical: "https://canonical.example/topic",
      robotsIndex: false,
      robotsFollow: false,
      image: "/images/topic-og.jpg",
      imageAlt: "Topic OG image",
    },
    type: "article",
  },
  global,
);
const topicMetadata = buildMetadataFromResolved(topicResolved);
const globalTitleSuffix = getSeoTitleSuffix(global);
const expectedTopicTitle = composeSeoTitle("Topic SEO title", "", globalTitleSuffix);

check("topic canonical override resolves and reaches Metadata", topicResolved.canonical === "https://canonical.example/topic" && topicMetadata.alternates?.canonical === "https://canonical.example/topic");
check("topic noindex override resolves and reaches Metadata", topicResolved.robots.index === false && typeof topicMetadata.robots === "object" && topicMetadata.robots?.index === false);
check("topic nofollow override resolves and reaches Metadata", topicResolved.robots.follow === false && typeof topicMetadata.robots === "object" && topicMetadata.robots?.follow === false);
check("topic SEO segment and Site Settings template drive public metadata", topicResolved.title === expectedTopicTitle && topicMetadata.title === trimToSeoLength(expectedTopicTitle, 65) && topicMetadata.description === "Topic SEO description");
check("topic image drives Open Graph override with the same final title", topicResolved.image === "/images/topic-og.jpg" && topicMetadata.openGraph?.title === trimToSeoLength(expectedTopicTitle, 65));

const legacyBrandOnlyTitle = resolveSeoMetadata(
  {
    path: "/about",
    title: "من نحن",
    entitySeo: { title: globalTitleSuffix },
  },
  global,
);
check(
  "legacy brand-only Page SEO values fall back to the page segment without duplicating the site name",
  legacyBrandOnlyTitle.title === composeSeoTitle("من نحن", "", globalTitleSuffix),
);

const emptyLocalPageSeo = resolveSeoMetadata(
  {
    path: "/custom-page-without-route-seo",
    title: "اسم الصفحة",
    description: "وصف الصفحة",
    image: "/images/page.jpg",
    entitySeo: {},
  },
  global,
);
check(
  "an empty local SEO row preserves explicit consumer copy before Global SEO fallback",
  emptyLocalPageSeo.title === composeSeoTitle("اسم الصفحة", "", globalTitleSuffix) &&
    emptyLocalPageSeo.description === "وصف الصفحة" &&
    emptyLocalPageSeo.image === "/images/page.jpg",
);

const descriptionOnlyLocalPageSeo = resolveSeoMetadata(
  {
    path: "/custom-page-with-local-seo",
    title: "اسم الصفحة",
    entitySeo: { description: "وصف SEO محلي" },
  },
  global,
);
check(
  "local Page SEO composes the page name with the Site Settings title suffix centrally",
  descriptionOnlyLocalPageSeo.title === composeSeoTitle("", "اسم الصفحة", globalTitleSuffix) &&
    descriptionOnlyLocalPageSeo.description === "وصف SEO محلي",
);

const fallbackResolved = resolveSeoMetadata(
  {
    path: "/topics/fallback-topic",
    entitySeo: {
      canonical: null,
      robotsIndex: null,
      robotsFollow: null,
      image: null,
    },
  },
  global,
);
const fallbackMetadata = buildMetadataFromResolved(fallbackResolved);

check("missing canonical override uses generated topic URL", fallbackResolved.canonical === "https://global.example/topics/fallback-topic" && fallbackMetadata.alternates?.canonical === fallbackResolved.canonical);
check("missing robots overrides inherit global index/follow", fallbackResolved.robots.index === true && fallbackResolved.robots.follow === true);
check("missing topic SEO values use global title/description/image fallbacks", fallbackResolved.title === global.defaultTitle && fallbackResolved.description === global.defaultDescription && fallbackResolved.image === global.defaultOgImage);

const overrideForm = new FormData();
overrideForm.set("title", "SEO persistence topic");
overrideForm.set("slug", "seo-persistence-topic");
overrideForm.set("category_id", "1");
overrideForm.set("canonical_url", "https://canonical.example/persisted-topic");
overrideForm.set("robots_index", "false");
overrideForm.set("robots_follow", "true");
const overridePayload = getPayload(overrideForm);
const overrideWrite = buildTopicWritePayload(
  overridePayload,
  { id: 1, name: "QA category", slug: "qa-category" },
  null,
  "unpublished",
  "2026-07-22T12:00:00.000Z",
  null,
);
check("form parsing and write payload preserve noindex/follow exactly", overridePayload.robotsIndex === false && overridePayload.robotsFollow === true && overrideWrite.robots_index === false && overrideWrite.robots_follow === true);
check("form parsing and write payload preserve canonical exactly", overridePayload.canonicalUrl === "https://canonical.example/persisted-topic" && overrideWrite.canonical_url === overridePayload.canonicalUrl);

const inheritPayload = getPayload(new FormData());
check("omitted robots overrides persist as inherit null", inheritPayload.robotsIndex === null && inheritPayload.robotsFollow === null);

const rawSeoTitle = `س${" ".repeat(SEO_LENGTH_STANDARDS.title.min - 1)}`;
const rawSeoDescription = `${"ص".repeat(SEO_LENGTH_STANDARDS.description.min)} `;
const rawSeoForm = new FormData();
rawSeoForm.set("seo_title", rawSeoTitle);
rawSeoForm.set("seo_description", rawSeoDescription);
const rawSeoPayload = getPayload(rawSeoForm);
const rawSeoWrite = buildTopicWritePayload(
  rawSeoPayload,
  { id: 1, name: "QA category", slug: "qa-category" },
  null,
  "unpublished",
  "2026-07-24T12:00:00.000Z",
  null,
);
check(
  "SEO counter stays raw while parsing and persistence normalize edge whitespace",
  rawSeoPayload.seoTitle === rawSeoTitle.trim() &&
    rawSeoPayload.seoDescription === rawSeoDescription.trim() &&
    rawSeoWrite.seo_title === rawSeoTitle.trim() &&
    rawSeoWrite.seo_description === rawSeoDescription.trim() &&
    assessSeoLength(rawSeoTitle, SEO_LENGTH_STANDARDS.title).count ===
      SEO_LENGTH_STANDARDS.title.min &&
    assessSeoLength(rawSeoTitle, SEO_LENGTH_STANDARDS.title).meaningfulCount === 1 &&
    assessSeoLength(rawSeoTitle, SEO_LENGTH_STANDARDS.title).state === "warning" &&
    getTopicPublishOnlyValidationError({
      title: "عنوان صالح",
      slug: "normalized-seo",
      excerpt: "وصف مختصر مكتمل وجاهز للنشر",
      content: "محتوى صالح",
      image: "/images/seo.jpg",
      imageAlt: "صورة SEO",
      categorySlug: "qa-category",
      seoTitle: rawSeoPayload.seoTitle,
      seoDescription: rawSeoPayload.seoDescription,
      focusKeyword: "اختبار",
    }) !== null,
);

for (const field of ["canonical_url", "robots_index", "robots_follow"]) {
  check(`${field} is added only by the new migration`, newMigration.includes(`add column if not exists ${field}`) && !lockedMigration.includes(field));
  check(`${field} is selected for edit/duplicate retrieval`, validation.match(new RegExp(field, "g"))?.length === 2);
  check(`${field} is mapped through the shared topic write payload`, helpers.includes("toEntitySeoPersistence(payload)") && entitySeoContract.includes(`${field}:`));
  check(`${field} reaches the Unified Content public detail model`, publicContentOwner.includes(field));
}
check("robots parser preserves true, false, and inherit null", entitySeoContract.includes('if (value === "true") return true') && entitySeoContract.includes('if (value === "false") return false') && entitySeoContract.includes("return null"));
check("canonical and robots UI offer per-topic override plus global inheritance", seoPanel.includes("ENTITY_SEO_FIELD_NAMES") && ["canonicalUrl", "robotsIndex", "robotsFollow"].every((name) => sharedSeoPanel.includes(`fieldNames.${name}`)) && sharedSeoPanel.includes("الإعداد العام"));
check("Topic Create and Edit robots share one comfortably bounded form-listbox tri-state owner", sharedSeoPanel.match(/<AdminFormListboxSelect/g)?.length === 2 && !sharedSeoPanel.includes("function RobotsSelect") && !sharedSeoPanel.includes("<select") && seoPanel.includes('robotsIndexListbox: "content-robots-index-listbox"') && seoPanel.includes('robotsFollowListbox: "content-robots-follow-listbox"') && seoPanel.includes('robotsIndexFocusTarget: "content-robots-index"') && seoPanel.includes('robotsFollowFocusTarget: "content-robots-follow"') && editorRobotsRender.match(/sizing=(?:"wide"|\{\s*"wide"\s*\})/g)?.length === 2 && !sharedSeoPanel.includes("searchable="));
check("Topic Create and Edit enforce the shared Index, Follow, Canonical presentation order", editorRobotsBlockStart >= 0 && editorRobotsBlockEnd > editorRobotsBlockStart && editorRobotsIndexPosition >= 0 && editorRobotsIndexPosition < editorRobotsFollowPosition && editorRobotsFollowPosition < editorCanonicalPosition && editorRobotsRender.includes('data-admin-seo-control-order="index-follow-canonical"') && editorRobotsRender.includes("lg:grid-cols-[minmax(180px,.7fr)_minmax(180px,.7fr)_minmax(0,1.6fr)]") && !editorRobotsRender.includes("flex-wrap"));
check("Topic opts into the supported shared Panel presentation without exposing a second Create/Edit selector", seoPanel.match(/<AdminEntitySeoPanel\b/g)?.length === 1 && seoPanel.match(/\bpresentation="panel"/g)?.length === 1 && !/(?:^|\s)presentation\??:/.test(seoPanel) && !/(?:^|\s)presentation\s*===/.test(seoPanel));
check("Topic Premium renders every native SEO field and fills Index and Follow columns while keeping independent Canonical in order", ["seoTitle", "seoDescription", "focusKeyword", "seoKeywords", "robotsIndex", "robotsFollow", "canonicalUrl", "ogImage", "ogImageAlt"].every((field) => seoPremiumPrimaryRender.includes(`fieldNames.${field}`)) && seoPremiumRobotsRender.match(/sizing=(?:"full"|\{\s*"full"\s*\})/g)?.length === 2 && seoPremiumRobotsRender.indexOf("fieldIds.robotsIndexListbox") >= 0 && seoPremiumRobotsRender.indexOf("fieldIds.robotsIndexListbox") < seoPremiumRobotsRender.indexOf("fieldIds.robotsFollowListbox") && seoPremiumRobotsRender.indexOf("fieldIds.robotsFollowListbox") < seoPremiumRobotsRender.indexOf("fieldIds.canonicalUrl") && seoPremiumRobotsRender.includes('data-admin-seo-control-order="index-follow-canonical"') && !seoPremiumRobotsRender.includes('sizing="wide"'));
check("Topic Panel preserves every submitted SEO field, Index-Follow-Canonical order and the existing full-width Robots columns", ["seoTitle", "seoDescription", "focusKeyword", "seoKeywords", "robotsIndex", "robotsFollow", "canonicalUrl", "ogImage", "ogImageAlt"].every((field) => seoPanelPrimaryRender.includes(`fieldNames.${field}`)) && seoPanelRobotsRender.match(/sizing=(?:"full"|\{\s*"full"\s*\})/g)?.length === 2 && seoPanelRobotsRender.indexOf("fieldIds.robotsIndexListbox") >= 0 && seoPanelRobotsRender.indexOf("fieldIds.robotsIndexListbox") < seoPanelRobotsRender.indexOf("fieldIds.robotsFollowListbox") && seoPanelRobotsRender.indexOf("fieldIds.robotsFollowListbox") < seoPanelRobotsRender.indexOf("fieldIds.canonicalUrl") && seoPanelRobotsRender.includes('data-admin-seo-control-order="index-follow-canonical"'));
check("shared listbox defaults to a comfortable bounded width while preserving explicit sizing and one native form source", formListbox.includes('sizing?: AdminListboxSelectProps["sizing"]') && formListbox.includes('sizing = "content-relaxed"') && listbox.includes('sizing = "content-relaxed"') && listbox.includes('data-admin-listbox-sizing={sizing}') && listbox.includes('? "w-56 max-w-full ps-4 pe-4"') && listbox.includes('? "w-60 max-w-full ps-4 pe-4"') && listbox.includes('? "w-64 max-w-full ps-4 pe-4"') && formListbox.includes("<select") && formListbox.includes("name={name}") && formListbox.includes("<AdminListboxSelect") && formListbox.includes("sizing={sizing}") && formListbox.includes('sizing === "full" ? "w-full" : "max-w-full"'));
check("shared checkbox defaults to the premium control while dense Data Grids retain the compact native presentation", sharedCheckbox.includes('presentation = "premium"') && sharedCheckbox.includes('data-admin-checkbox-presentation={presentation}') && sharedDataGrid.includes('presentation="native"'));
check("shared compact listbox preserves RTL keyboard and measured below-first placement with no search by default", listbox.includes('searchable = false') && listbox.includes('dir = "rtl"') && listbox.includes('role="combobox"') && listbox.includes('role="listbox"') && listbox.includes('event.key === "ArrowDown"') && listbox.includes('event.key === "ArrowUp"') && listbox.includes('event.key === "Home"') && listbox.includes('event.key === "End"') && listbox.includes('event.key === "Enter"') && listbox.includes('event.key === "Escape"') && listbox.includes("useAdminFloatingMenuPosition"));
const editSeoHydration = topicSeoHydration(editEditor, "edit");
const createSeoHydration = topicSeoHydration(createEditor, "create");
const savedSeoRow = {
  seo_title: "Saved SEO title", seo_description: "Saved SEO description", focus_keyword: "Saved keyword", seo_keywords: ["saved", "keyword"],
  canonical_url: "https://example.com/saved-topic", robots_index: false, robots_follow: true, og_image: "/saved-seo.jpg", og_image_alt: "Saved image alt",
};
check("edit retrieval hydrates canonical and robots controls through the canonical recovered-field projection", editSeoHydration(savedSeoRow, null).canonicalUrl === savedSeoRow.canonical_url && editSeoHydration(savedSeoRow, null).robotsIndex === false && editSeoHydration(savedSeoRow, null).robotsFollow === true);
check("Create keeps blank or inherited SEO defaults while Edit hydrates the complete saved contract", Object.entries(hydrationFieldNames).every(([prop, field]) => {
  const blank = createSeoHydration({}, null)[prop as keyof HydratedSeo];
  const saved = editSeoHydration(savedSeoRow, null)[prop as keyof HydratedSeo];
  return prop === "seoKeywords" ? Array.isArray(blank) && blank.length === 0 && JSON.stringify(saved) === JSON.stringify(savedSeoRow[field as keyof typeof savedSeoRow]) : blank === (prop.startsWith("robots") ? null : "") && saved === savedSeoRow[field as keyof typeof savedSeoRow];
}));
for (const [mode, source] of [["create", createEditor], ["edit", editEditor]] as const) {
  const projected = mode === "edit" ? "effectiveTopic" : "values";
  const base = mode === "edit" ? "topic" : "defaultValues";
  const mutations = [
    ['from "./content-form-definition"', 'from "./parallel-form-definition"'],
    [`applyTopicFormDraftFields(${base}, model.recoveryFields, "article")`, `applyTopicFormDraftFields(${base}, null, "article")`],
    [`applyTopicFormDraftFields(${base}, model.recoveryFields, "article")`, `applyTopicFormDraftFields({}, model.recoveryFields, "article")`],
    [`applyTopicFormDraftFields(${base}, model.recoveryFields, "article")`, `applyTopicFormDraftFields(${base}, model.recoveryFields, "video")`],
    [`canonicalUrl={${projected}.canonical_url ?? ""}`, 'canonicalUrl=""'],
    [`robotsIndex={${projected}.robots_index ?? null}`, `robotsIndex={${projected}.robots_index || null}`],
    [`robotsFollow={${projected}.robots_follow ?? null}`, 'robotsFollow={null}'],
    ['tabs={renderTabs}', 'tabs={() => []}'],
    ['content: (\n          <SeoPanel', 'content: (\n          false && <SeoPanel'],
    ['const seoKeywords =', 'const { applyTopicFormDraftFields } = parallelOwner; const seoKeywords ='],
    ['function renderTabs(model: ContentEditorModel) {', 'function renderTabs(model: ContentEditorModel) { function applyTopicFormDraftFields() { return {}; }'],
    ['function renderTabs(model: ContentEditorModel) {', 'function renderTabs(model: ContentEditorModel) { function SeoPanel() { return null; }'],
    ['function renderTabs(model: ContentEditorModel) {', 'function renderTabs(model: ContentEditorModel) { model.recoveryFields = null;'],
    ['function renderTabs(model: ContentEditorModel) {', 'function renderTabs(model: ContentEditorModel) { if (true) return [];'],
    ['  const safeCategories = categories;', '  if (true) return null; const safeCategories = categories;'],
    ['  const templateContext =', '  initialModelValue.seoTitle = ""; const templateContext ='],
    ['onControlledValueChange={model.setField}', 'onControlledValueChange={undefined}'],
    ['seoTitle: model.value.seoTitle,', 'seoTitle: "",'],
  ] as const;
  check(`${mode} hydration rejects effective parsed owner, recovery, base, native, state, inactive and shadow mutations`, mutations.every(([before, after]) => rejectsTopicSeoHydration(source, mode, before, after)));
}
check("Edit hydration rejects detaching the public persisted topic binding", rejectsTopicSeoHydration(editEditor, "edit", "  topic,", "  topic: replacedTopic,"));
check("Create hydration rejects introducing a persisted Canonical default", rejectsTopicSeoHydration(createEditor, "create", "{ content: defaultContent }", '{ content: defaultContent, canonical_url: "https://example.com/unrequested" }'));
check("public topic metadata consumes canonical and robots overrides", publicPage.includes("canonical: topic.canonicalUrl") && publicPage.includes("robotsIndex: topic.robotsIndex") && publicPage.includes("robotsFollow: topic.robotsFollow"));
check("Open Graph uses the explicit Topic override before content-image and global fallbacks", publicPage.includes("ogImage: topic.ogImage || undefined") && publicPage.includes("ogImageAlt: topic.ogImage") && publicPage.includes("image: topic.metadataImage || undefined") && finalMigration.includes("add column if not exists og_image"));

check("correction button is non-submitting and dispatches the adopted navigation event", sharedReview.includes('type="button"') && sharedReview.includes("new CustomEvent(navigationEventName") && !sharedReview.includes("window.location"));
check("tab navigation accepts tab and target without reload", navigation.includes("AdminModuleNavigationDetail") && navigation.includes("setActiveId(tabId)") && navigation.includes("scrollIntoView") && navigation.includes("focus({ preventScroll: true })") && !navigation.includes("location.reload"));
check("SEO issues have explicit correction targets", seoPanel.includes("TOPIC_SEO_CORRECTION_TARGETS") && seoPanel.includes('targetId: "content-seo-title"') && seoPanel.includes('targetId: "topic-content-markdown"') && seoPanel.includes('targetId: "topic-image-alt"'));
check("Create and Edit adopt one shared two-column SEO presentation", [createEditor, editEditor].every(hasOneUnselectedTopicSeoAdapter) && !/(?:^|\s)presentation\??:/.test(seoPanel) && !/(?:^|\s)presentation\s*===/.test(seoPanel) && seoPanel.match(/<AdminEntitySeoPanel/g)?.length === 1 && seoPanel.match(/<AdminFormLayout/g)?.length === undefined && sharedSeoPanel.match(/<AdminFormLayout/g)?.length === 1 && sharedSeoPanel.match(/<AdminSingleOpenAccordion/g)?.length === 1 && sharedSeoPanel.includes('defaultOpenId="search-result-preview"') && ["search-result-preview", "open-graph-preview", "live-seo-analysis"].every((id) => sharedSeoPanel.includes(`id: "${id}"`)) && ["معاينة نتائج البحث", "معاينة المشاركة الاجتماعية (Open Graph)", "تحليل SEO المباشر"].every((label) => sharedSeoPanel.includes(label)) && ["الشكل المتوقع للرابط داخل نتائج محركات البحث.", "الشكل المتوقع للرابط عند مشاركته على المنصات الاجتماعية.", "الدرجة الإرشادية وملاحظات تحسين المحتوى."].every((description) => sharedSeoPanel.includes(description)) && !["seo-basics", "social-sharing", "analysis-preview"].some((id) => sharedSeoPanel.includes(`id: "${id}"`)));
check("negative Topic SEO adapter fixtures reject a second presentation selector, parallel imports and spread-provided selectors without blocking unrelated display presentation", [createEditor, editEditor].every((source) => !hasOneUnselectedTopicSeoAdapter(source.replace("<SeoPanel ", '<SeoPanel presentation="premium" ')) && !hasOneUnselectedTopicSeoAdapter(source.replace("<SeoPanel ", "<SeoPanel {...parallelPresentation} ")) && !hasOneUnselectedTopicSeoAdapter(source.replace('from "../../SeoPanel"', 'from "../../ParallelSeoPanel"'))));
check("Create and Edit retain SEO navigation while the shared Panel sections own all visible section headings", [createEditor, editEditor].every(hasTopicSeoSectionHeadersOnly));
check("negative Topic header fixtures reject redundant outer headings and missing SEO navigation", [createEditor, editEditor].every((source) => !hasTopicSeoSectionHeadersOnly(source.replace('id: "seo",', 'id: "seo", sectionHeading: "duplicate",')) && !hasTopicSeoSectionHeadersOnly(source.replace('navigationLabel: "SEO"', 'navigationLabel: ""'))));
check("retired native-robots and parallel Topic presentation paths are absent", !seoPanel.includes("function RobotsSelect") && !seoPanel.includes("<RobotsSelect") && !seoPanel.includes("<select") && !seoPanel.includes('presentation === "editor"') && !seoPanel.includes("AdminSingleOpenAccordion") && sharedSeoPanel.match(/<AdminSingleOpenAccordion/g)?.length === 1);
check("each Topic SEO submitted field uses the one shared field-name contract and render source", seoPanel.includes("ENTITY_SEO_FIELD_NAMES") && ["seoTitle", "seoDescription", "focusKeyword", "canonicalUrl", "robotsIndex", "robotsFollow", "ogImage", "ogImageAlt"].every((name) => sharedSeoPanel.includes(`fieldNames.${name}`)));
check("all Topic SEO editable fields remain always visible in the shared primary column", seoBasicsStart >= 0 && seoReturnStart > seoBasicsStart && seoHelperStart > seoReturnStart && ["seoTitle", "seoDescription", "focusKeyword", "seoKeywords", "robotsIndex", "robotsFollow", "canonicalUrl"].every((name) => seoPrimaryRender.includes(`fieldNames.${name}`) && !seoHelperRender.includes(`fieldNames.${name}`)) && seoHelperRender.includes("content: searchResultPreviewContent") && seoHelperRender.includes("content: openGraphPreviewContent") && seoHelperRender.includes("content: liveSeoAnalysisContent"));
check("shared accordion owns helper disclosure state, descriptions, target reveal, and accessibility", adminUiIndex.includes('from "./AdminSingleOpenAccordion"') && accordion.includes("description?: ReactNode") && accordion.includes("navigationEventName?: string") && accordion.includes("item.description") && accordion.includes("useState<string | null>") && accordion.includes("items[0]?.id ?? null") && accordion.includes("openId !== null") && accordion.includes("setOpenId((current) => (current === item.id ? null : item.id))") && accordion.includes('target?.closest<HTMLElement>("[data-admin-accordion-panel]")') && accordion.includes("setOpenId(itemId)") && accordion.includes('data-admin-single-open-accordion-active={resolvedOpenId ?? ""}') && accordion.includes('type="button"') && accordion.includes("aria-expanded={open}") && accordion.includes("aria-controls={panelId}") && accordion.includes('role="region"') && accordion.includes("aria-labelledby={triggerId}") && accordion.includes("hidden={!open}") && ["ArrowDown", "ArrowUp", "Home", "End"].every((key) => accordion.includes(`"${key}"`)) && accordion.includes("text-start") && seoHelperRender.includes("navigationEventName={navigationEventName}"));
check("SEO Panel previews adopt supported shared accordion chrome, semantic icons and canonical Premium tokens with default disclosure presentation unchanged", hasSupportedSeoPanelAccordion(sharedSeoPanel, accordion));
check("negative SEO accordion fixtures reject unsupported opt-ins, parallel owners or tokens and changed default adoption", !hasSupportedSeoPanelAccordion(sharedSeoPanel.replace('presentation={panel ? "panel" : undefined}', 'presentation="panel"'), accordion) && !hasSupportedSeoPanelAccordion(sharedSeoPanel.replace('from "../ui/AdminSingleOpenAccordion"', 'from "../ui/ParallelAccordion"'), accordion) && !hasSupportedSeoPanelAccordion(sharedSeoPanel, accordion.replace('presentation = "default"', 'presentation = "panel"')) && !hasSupportedSeoPanelAccordion(sharedSeoPanel, accordion.replace('from "../../../lib/admin/admin-ui-styles"', 'from "../../../lib/admin/parallel-ui-styles"')) && !hasSupportedSeoPanelAccordion(sharedSeoPanel, accordion.replace('className={ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME}', 'className="local-accent"')));
check("review issues map to shared basic, FAQ, rich-media, and SEO targets", review.includes("AdminEntityReviewPanel") && ["content-title", "topic-faq-editor", "video_url", "gallery_image_url", "gallery_image_alt", "content-seo-title"].every((target) => contentReviewCapability.includes(target)));
check("one Entity SEO contract owns the recommended title and description ranges", seoStandards.includes("ENTITY_SEO_LIMITS") && entitySeoContract.includes("min: 45, max: 60") && entitySeoContract.includes("min: 120, max: 160") && [sharedSeoPanel, seoScore].every((source) => source.includes("SEO_LENGTH_STANDARDS") && source.includes("assessSeoLength")) && contentReviewCapability.includes("ENTITY_SEO_LIMITS") && saveAction.includes("getPublishBlockingChecks"));
check("SEO fields expose one associated live count and recommended range without a typing cap", !sharedSeoPanel.includes("maxLength") && sharedSeoPanel.includes("data-seo-length-state") && sharedSeoPanel.includes("data-seo-length-count") && sharedSeoPanel.includes("data-seo-length-target") && sharedSeoPanel.includes("lengthFeedbackId") && sharedSeoPanel.includes('aria-live={assessment ? "polite" : undefined}') && sharedSeoPanel.includes("aria-describedby={describedBy}") && sharedSeoPanel.includes("حرف") && sharedSeoPanel.includes("المدى القياسي") && sharedSeoPanel.includes("formatSeoLengthRange") && !sharedSeoPanel.includes("describeSeoLength(assessment)"));
const rawCounterAssessment = assessSeoLength(` ${"س".repeat(SEO_LENGTH_STANDARDS.title.min)} `, SEO_LENGTH_STANDARDS.title);
check("SEO counter counts every typed character while standards ignore edge padding", rawCounterAssessment.count === SEO_LENGTH_STANDARDS.title.min + 2 && rawCounterAssessment.meaningfulCount === SEO_LENGTH_STANDARDS.title.min && rawCounterAssessment.state === "success");
check("publish validation enforces the final 60 and 160 ceilings through the shared contract", !contentReviewCapability.includes("> 70") && !contentReviewCapability.includes("> 170") && contentReviewCapability.includes("ENTITY_SEO_LIMITS.title.max") && contentReviewCapability.includes("ENTITY_SEO_LIMITS.description.max") && saveAction.includes("getPublishBlockingChecks(payload)") && saveAction.includes("getDraftBlockingChecks(payload)") && helpers.includes("readEntitySeoFormData(formData)"));

check("topic switches are a thin adapter over the one shared switch DOM contract", formSwitch.match(/<AdminFormSwitch\b/g)?.length === 1 && !formSwitch.includes("<input") && !formSwitch.includes('role="switch"') && !formSwitch.includes("uncheckedValue") && ["id={id}", "name={name}", "label={label}", "defaultChecked={defaultChecked}", "surface={surface}", "disabled={disabled}"].every((marker) => formSwitch.includes(marker)) && formSwitch.includes("ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME"));
check(
  "the shared switch alone owns checkbox and controlled or uncontrolled semantics",
  sharedFormSwitch.match(/type="checkbox"/g)?.length === 1 &&
    sharedFormSwitch.includes("name?: string") &&
    sharedFormSwitch.includes("{name && uncheckedValue !== undefined ? (") &&
    sharedFormSwitch.includes(
      '<input type="hidden" name={name} value={uncheckedValue} />',
    ) &&
    [
      "id={id}",
      'type="checkbox"',
      'role="switch"',
      "name={name}",
      "defaultChecked={checked === undefined ? defaultChecked : undefined}",
      "checked={checked}",
      "onChange={onChange}",
      "disabled={disabled}",
      "value={value}",
      "aria-describedby={describedBy}",
    ].every((marker) => sharedFormSwitch.includes(marker)),
);
check("the shared switch default owns the canonical card surface while explicit compact switches retain their branch", sharedFormSwitch.includes("surface = true") && sharedFormSwitch.includes('data-admin-form-switch-surface={surface ? "card" : "compact"}') && sharedFormSwitch.includes(': ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME'));
check("embedded switch presentation is explicit and leaves both legacy surface branches intact", sharedFormSwitch.includes("embedded?: boolean") && sharedFormSwitch.includes("embedded = false") && sharedFormSwitch.includes("if (embedded)") && sharedFormSwitch.includes('data-admin-form-switch-surface="embedded"') && sharedFormSwitch.includes('data-admin-form-switch-surface={surface ? "card" : "compact"}') && sharedFormSwitch.includes("{labelContent}") && sharedFormSwitch.includes("{switchControl}"));
const { createElement, cloneElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const TopicSeoPanelRuntime = (require("../src/components/admin/SeoPanel.tsx") as typeof import("../src/components/admin/SeoPanel")).default;
function seoRenderedIdentityContract(html: string) {
  const ids = Array.from(html.matchAll(/\sid="([^"]+)"/gu), (match) => match[1]!);
  if (new Set(ids).size !== ids.length) return false;
  const attributes = (tag: string) => new Map(Array.from(tag.matchAll(/\s([\w:-]+)="([^"]*)"/gu), (match) => [match[1]!, match[2]!]));
  const sections = Array.from(html.matchAll(/<header\b[^>]*>/gu), (match) => attributes(match[0]));
  const reviewedTargets = ["content-seo-overrides", "content-og-image"];
  if (!reviewedTargets.every((target) => ids.filter((id) => id === target).length === 1)) return false;
  if (!["content-og-image", "content-og-image-media"].every((target) => sections.filter((header) => header.get("data-admin-tab-section-heading") === target && !header.has("id")).length === 1)) return false;
  if (sections.some((header) => ["content-seo-overrides", "content-canonical-url-section", "content-og-image-alt-section"].includes(header.get("data-admin-tab-section-heading") ?? ""))) return false;
  const targets = ["content-seo-title", "content-seo-description", "content-focus-keyword", "content-seo-keywords", "content-canonical-url", "content-robots-index", "content-robots-follow", "content-og-image-alt"];
  if (!targets.every((target) => ids.filter((id) => id === target).length === 1)) return false;
  const triggers = Array.from(html.matchAll(/<button\b[^>]*>/gu), (match) => attributes(match[0]));
  const regions = Array.from(html.matchAll(/<div\b[^>]*data-admin-accordion-panel="[^"]+"[^>]*>/gu), (match) => ({ tag: match[0], attributes: attributes(match[0]) }));
  return regions.length === 3 && regions.every((region) => {
    const triggerId = region.attributes.get("aria-labelledby");
    const trigger = triggers.find((candidate) => candidate.get("id") === triggerId);
    const open = region.attributes.get("data-admin-accordion-panel") === "search-result-preview";
    return region.attributes.get("role") === "region" && trigger && trigger.get("type") === "button" &&
      trigger.get("aria-controls") === region.attributes.get("id") && trigger.get("aria-expanded") === String(open) &&
      /\shidden(?:=|\s|>)/u.test(region.tag) === !open;
  });
}
const topicSeoCreateFixture: Parameters<typeof TopicSeoPanelRuntime>[0] = {
  title: "", excerpt: "", slug: "", content: "", image: "", imageAlt: "",
  seoTitle: "", seoDescription: "", seoKeywords: [], focusKeyword: "", canonicalUrl: "",
  robotsIndex: null, robotsFollow: null, ogImage: "", ogImageAlt: "", faq: [],
};
const topicSeoEditFixture: Parameters<typeof TopicSeoPanelRuntime>[0] = {
  ...topicSeoCreateFixture,
  title: "عنوان الموضوع المحفوظ", excerpt: "وصف الموضوع المحفوظ", slug: "saved-seo-topic", content: "محتوى الموضوع المحفوظ",
  seoTitle: "عنوان محركات البحث المحفوظ", seoDescription: "الوصف التعريفي المحفوظ", seoKeywords: ["كلمة محفوظة"], focusKeyword: "عبارة محفوظة",
  canonicalUrl: "https://example.com/saved-seo-topic", robotsIndex: false, robotsFollow: true,
  ogImage: "/images/saved-seo.jpg", ogImageAlt: "وصف صورة المشاركة المحفوظ",
  controlledValues: {
    title: "عنوان الموضوع الحالي", excerpt: "وصف الموضوع الحالي", content: "محتوى الموضوع الحالي",
    seoTitle: "عنوان محركات البحث الحالي", seoDescription: "الوصف التعريفي الحالي", focusKeyword: "عبارة حالية",
  },
};
// Execute the actual editor projection expressions, then the actual native SEO
// owner; recover form values from its DOM before invoking the existing save parser.
function seoNativeForm(html: string) {
  const values = new FormData();
  const attributes = (tag: string) => new Map(Array.from(tag.matchAll(/\s([\w:-]+)="([^"]*)"/gu), match => [match[1]!, match[2]!]));
  const known = new Set<string>(Object.values(hydrationFieldNames));
  for (const match of html.matchAll(/<input\b[^>]*>|<textarea\b[^>]*>[\s\S]*?<\/textarea>|<select\b[^>]*>[\s\S]*?<\/select>/gu)) {
    const tag = match[0], attrs = attributes(tag.slice(0, tag.indexOf(">") + 1)), name = attrs.get("name");
    if (!name || !known.has(name)) continue;
    assert.equal(values.has(name), false, `${name} retains one native form source`);
    const value = tag.startsWith("<select") ? Array.from(tag.matchAll(/<option\b[^>]*>/gu)).find(option => /\sselected(?:=|\s|>)/u.test(option[0]))?.[0] : undefined;
    values.set(name, tag.startsWith("<textarea") ? tag.slice(tag.indexOf(">") + 1, tag.lastIndexOf("</textarea>")) : value ? attributes(value).get("value") ?? "" : attrs.get("value") ?? "");
  }
  assert.equal([...values.keys()].length, known.size, "all SEO fields retain their native form controls");
  return values;
}
const recoveredSeoFields = {
  seo_title: ["Recovered SEO title"], seo_description: ["Recovered SEO description"], focus_keyword: ["Recovered keyword"], seo_keywords: ["recovered, keyword"],
  canonical_url: ["https://example.com/recovered-topic"], robots_index: ["true"], robots_follow: ["false"], og_image: ["/recovered-seo.jpg"], og_image_alt: ["Recovered image alt"],
};
const recoveredSeoExpected: HydratedSeo = {
  seoTitle: "Recovered SEO title", seoDescription: "Recovered SEO description", focusKeyword: "Recovered keyword", seoKeywords: ["recovered", "keyword"],
  canonicalUrl: "https://example.com/recovered-topic", robotsIndex: true, robotsFollow: false, ogImage: "/recovered-seo.jpg", ogImageAlt: "Recovered image alt",
};
const hydratedSeoCases = [
  { name: "Create blank", project: createSeoHydration, base: {}, fields: null, expected: topicSeoCreateFixture },
  { name: "Edit saved", project: editSeoHydration, base: savedSeoRow, fields: null, expected: topicSeoEditFixture },
  ...[createSeoHydration, editSeoHydration].flatMap((project, index) => [
    { name: `${index ? "Edit" : "Create"} restored`, project, base: index ? savedSeoRow : {}, fields: recoveredSeoFields, expected: recoveredSeoExpected },
    { name: `${index ? "Edit" : "Create"} cleared and inherited`, project, base: index ? savedSeoRow : {}, fields: { ...recoveredSeoFields, canonical_url: [""], robots_index: [""], robots_follow: [""] }, expected: { ...recoveredSeoExpected, canonicalUrl: "", robotsIndex: null, robotsFollow: null } },
  ]),
];
for (const test of hydratedSeoCases) {
  const projected = test.project(test.base, test.fields);
  // Saved fixture text is intentionally independent of the projection fixture.
  const expected = test.name === "Edit saved" ? Object.fromEntries(Object.entries(hydrationFieldNames).map(([prop, field]) => [prop, savedSeoRow[field as keyof typeof savedSeoRow]])) : test.expected;
  const html = renderToStaticMarkup(createElement(TopicSeoPanelRuntime, { ...topicSeoCreateFixture, ...projected }));
  const form = seoNativeForm(html), payload = getPayload(form);
  const persisted = buildTopicWritePayload(payload, { id: 1, name: "QA category", slug: "qa-category" }, null, "unpublished", "2026-07-22T12:00:00.000Z", null);
  check(`${test.name} projection reaches actual native controls, FormData and canonical saved SEO payload`, Object.entries(hydrationFieldNames).every(([prop, field]) => {
    const expectedValue = expected[prop as keyof typeof expected];
    const value = projected[prop as keyof HydratedSeo], parsed = payload[prop as keyof typeof payload], saved = persisted[field as keyof typeof persisted];
    return JSON.stringify(value) === JSON.stringify(expectedValue) && JSON.stringify(parsed) === JSON.stringify(value) && JSON.stringify(saved) === JSON.stringify(value === "" && ["canonicalUrl", "ogImage"].includes(prop) ? null : value);
  }));
}
check("unrecognized and unrelated media draft fields cannot replace Article SEO values", [createSeoHydration, editSeoHydration].every(project => {
  const base = project === editSeoHydration ? savedSeoRow : {};
  return JSON.stringify(project(base, { unrecognized_seo_field: ["ignored"], video_url: ["ignored"], gallery_image_url: ["ignored"] })) === JSON.stringify(project(base, null));
}));
check("native hydration controls reject missing Canonical and changed Robots form bindings", hydratedSeoCases.every(test => {
  const html = renderToStaticMarkup(createElement(TopicSeoPanelRuntime, { ...topicSeoCreateFixture, ...test.project(test.base, test.fields) }));
  return ["canonical_url", "robots_index", "robots_follow"].every(name => {
    const mutated = html.replace(`name="${name}"`, 'name="unrelated_field"');
    assert.notEqual(mutated, html, "native mutation changes actual rendered source");
    assert.throws(() => seoNativeForm(mutated)); return true;
  });
}));
const topicSeoRenderedCases = [topicSeoCreateFixture, topicSeoEditFixture].map((props) => renderToStaticMarkup(createElement(TopicSeoPanelRuntime, props)));
check("actual Topic Panel Create and hydrated controlled Edit render unique DOM ids, original navigation targets and linked Accordion ARIA", topicSeoRenderedCases.every(seoRenderedIdentityContract));
check("negative actual Panel DOM fixtures reject duplicated Robots or Social identities and broken Accordion associations", topicSeoRenderedCases.every((html) =>
  !seoRenderedIdentityContract(`${html}<div id="content-seo-overrides"></div>`) &&
  !seoRenderedIdentityContract(html.replace('data-admin-tab-section-heading="content-og-image"', 'id="content-og-image" data-admin-tab-section-heading="content-og-image"')) &&
  !seoRenderedIdentityContract(html.replace(/(aria-controls=")[^"]+-search-result-preview-panel"/u, '$1missing-panel"')) &&
  !seoRenderedIdentityContract(html.replace('hidden="" data-admin-accordion-panel="open-graph-preview"', 'data-admin-accordion-panel="open-graph-preview"')),
));
check("actual Panel DOM retains the main and image Open Graph headers and rejects restoring any removed Robots, Canonical or Alt inner header", topicSeoRenderedCases.every((html) =>
  ["content-seo-overrides", "content-canonical-url-section", "content-og-image-alt-section"].every((target) =>
    !seoRenderedIdentityContract(`${html}<header data-admin-tab-section-heading="${target}"></header>`)),
));
check("Panel removes all three accordion descriptions while retaining Search, Open Graph and Live Analysis titles", topicSeoRenderedCases.every((html) =>
  !html.includes("الشكل المتوقع للرابط داخل نتائج محركات البحث.") && !html.includes("الدرجة الإرشادية وملاحظات تحسين المحتوى.") &&
  html.includes("معاينة نتائج البحث") && html.includes("تحليل SEO المباشر") &&
  html.includes("معاينة المشاركة الاجتماعية (Open Graph)") && !html.includes("الشكل المتوقع للرابط عند مشاركته على المنصات الاجتماعية."),
));
const { ENTITY_SEO_FIELD_NAMES: renderedSeoFieldNames } = require("../src/lib/seo/entity-seo-types.ts") as typeof import("../src/lib/seo/entity-seo-types");
check("actual Panel retains one native source for every SEO field and follows the requested RTL information-before-image reading order", topicSeoRenderedCases.every((html) =>
  Object.values(renderedSeoFieldNames).every((name) => (html.match(new RegExp(`\\sname="${name}"`, "gu")) ?? []).length === 1) &&
  html.indexOf('name="og_image_alt"') < html.indexOf('name="og_image"'),
));
check("the actual shared default and Premium owners retain all original preview and analysis descriptions", ["default", "premium"].every((presentation) => {
  const html = renderToStaticMarkup(cloneElement(TopicSeoPanelRuntime(topicSeoCreateFixture), { presentation }));
  return ["الشكل المتوقع للرابط داخل نتائج محركات البحث.", "الدرجة الإرشادية وملاحظات تحسين المحتوى.", "الشكل المتوقع للرابط عند مشاركته على المنصات الاجتماعية."].every((description) => html.includes(description)) &&
    html.indexOf('name="og_image"') < html.indexOf('name="og_image_alt"') && !html.includes('data-admin-tab-section-heading="content-canonical-url-section"');
}));
const sharedSwitchRuntime = require("../src/components/admin/ui/AdminFormSwitch.tsx") as typeof import("../src/components/admin/ui/AdminFormSwitch");
const SharedSwitch = sharedSwitchRuntime.default;
assert.equal(sharedSwitchRuntime.ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME, "h-8 min-w-20 justify-between border border-white/10 bg-white/[0.035] px-2.5 py-1.5");
assert.equal(sharedSwitchRuntime.ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME, "min-h-11 rounded-xl border border-white/10 bg-black/16 px-4 py-2.5");
function canonicalSwitchSurface(source: string) {
  const tree = ts.createSourceFile("AdminFormSwitch.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0);
  const declarations = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).filter(node => node.name.getText(tree) === "ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME");
  assert.equal(declarations.length, 1);
  const value = declarations[0]!.initializer;
  assert.ok(value && ts.isStringLiteral(value));
  assert.equal(value.text, "min-h-11 rounded-xl border border-white/10 bg-black/16 px-4 py-2.5");
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormSwitch");
  const bindings = owner?.parameters[0]?.name;
  assert.ok(bindings && ts.isObjectBindingPattern(bindings));
  const surface = bindings.elements.filter(node => node.name.getText(tree) === "surface");
  assert.equal(surface.length, 1);
  assert.equal(surface[0]!.initializer?.kind, ts.SyntaxKind.TrueKeyword);
}
canonicalSwitchSurface(sharedFormSwitch);
check("canonical Switch surface rejects reverting the approved 44px frame or default card ownership", [
  ["min-h-11 rounded-xl border border-white/10 bg-black/16 px-4 py-2.5", "rounded-xl border border-white/10 bg-black/16 px-4 py-3"],
  ["surface = true", "surface = false"],
].every(([before, after]) => {
  const mutated = sharedFormSwitch.replace(before!, after!);
  assert.notEqual(mutated, sharedFormSwitch);
  const tree = ts.createSourceFile("switch-negative.tsx", mutated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0);
  assert.throws(() => canonicalSwitchSurface(mutated)); return true;
}));
const switchPresentationCases = [
  { name: "compact", props: { surface: false } },
  { name: "card", props: {} },
  { name: "embedded", props: { embedded: true } },
] as const;
let switchRuntimeCases = 0;
for (const presentation of switchPresentationCases) {
  for (const controlled of [false, true]) {
    for (const checked of [false, true]) {
      for (const disabled of [false, true]) {
        const props = {
          id: "shared-switch-probe", name: "shared_switch_probe", label: "إظهار العناصر",
          uncheckedValue: "false", value: "true", describedBy: "shared-switch-description", disabled,
          ...presentation.props,
          ...(controlled ? { checked, defaultChecked: !checked, onChange() {} } : { defaultChecked: checked }),
        };
        const html = renderToStaticMarkup(createElement(SharedSwitch, props));
        const context = `${presentation.name}/${controlled ? "controlled" : "uncontrolled"}/${checked}/${disabled}`;
        const inputs = Array.from(html.matchAll(/<input\b[^>]*>/gu), match => match[0]);
        assert.equal(inputs.length, 2, context + " retains the fallback and native checkbox");
        assert.ok(inputs[0].includes('type="hidden"') && inputs[0].includes('name="shared_switch_probe"') && inputs[0].includes('value="false"'), context);
        assert.ok(inputs[1].includes('type="checkbox"') && inputs[1].includes('role="switch"') && inputs[1].includes('name="shared_switch_probe"') && inputs[1].includes('value="true"'), context);
        assert.equal(/\schecked(?:=|\s|>)/u.test(inputs[1]), checked, context + " native ON/OFF");
        assert.equal(/\sdisabled(?:=|\s|>)/u.test(inputs[1]), disabled, context + " native disabled state");
        assert.ok(inputs[1].includes('aria-describedby="shared-switch-description"'), context + " description association");
        assert.equal((html.match(/<label\b/gu) ?? []).length, 1, context + " one clickable label");
        assert.equal(html.split("إظهار العناصر").length - 1, 1, context + " one visible title");
        assert.ok(html.includes('class="relative inline-flex h-5 w-9 shrink-0"'), context + " existing 36x20 track");
        assert.ok(html.includes("top-0.5 size-4 rounded-full") && html.includes("rtl:peer-checked:-translate-x-4") && html.includes("peer-focus-visible:ring-2"), context + " existing thumb, RTL and focus contract");
        const labelTag = html.match(/^<label\b[^>]*>/u)?.[0];
        assert.ok(labelTag && labelTag.includes('data-admin-form-switch-surface="' + presentation.name + '"'), context);
        if (presentation.name === "embedded") {
          assert.equal(/\b(?:border(?:-|\s)|bg-)/u.test(labelTag), false, context + " has no inner frame or background");
          assert.ok(labelTag.includes("flex-col") && labelTag.includes("justify-between"), context + " separates the header from the existing small switch");
          assert.ok(html.includes('<span class="inline-flex min-h-11 items-center"><span class="relative inline-flex h-5 w-9 shrink-0">'), context + " centers the unchanged small track in the shared 44px control row");
        } else {
          const expectedSurface = presentation.name === "card" ? sharedSwitchRuntime.ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME : sharedSwitchRuntime.ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME;
          assert.ok(labelTag.includes(expectedSurface), context + " preserves the exact legacy frame");
          assert.equal(renderToStaticMarkup(createElement(SharedSwitch, { ...props, embedded: false })), html, context + " omitted opt-in equals explicit false");
          if (presentation.name === "card") assert.equal(renderToStaticMarkup(createElement(SharedSwitch, { ...props, surface: true })), html, context + " omitted surface equals the canonical card default");
        }
        switchRuntimeCases += 1;
      }
    }
  }
  for (const fallback of [{ name: undefined, uncheckedValue: "false" }, { name: "shared_switch_probe", uncheckedValue: undefined }]) {
    const html = renderToStaticMarkup(createElement(SharedSwitch, { ...presentation.props, ...fallback, label: "إظهار العناصر", value: "true" }));
    assert.equal((html.match(/<input\b/gu) ?? []).length, 1, "No fallback is invented when its existing name/value contract is absent");
    assert.equal(html.includes('type="hidden"'), false);
  }
}
check("shared switch preserves native semantics and exact default/card surfaces across 24 rendered controlled/uncontrolled cases", switchRuntimeCases === 24);
check("embedded switch reuses the original small track and conditional fallback while the thin Topic adapter only forwards shared presentation props", sharedFormSwitch.match(/type="checkbox"/g)?.length === 1 && sharedFormSwitch.match(/const switchControl =/g)?.length === 1 && sharedFormSwitch.includes('className="relative inline-flex h-5 w-9 shrink-0"') && formSwitch.includes("embedded={embedded}") && formSwitch.includes("embeddedLayout={embeddedLayout}") && !formSwitch.includes("<input") && !formSwitch.includes("useState"));

check("publishing and display controls preserve field parity through shared owners", publishingOptions.match(/<AdminFormSwitch\b/g)?.length === 1 && !/<AdminFormSwitch\b/.test(displaySettings) && ["is_featured", "is_popular"].every((name) => publishingOptions.includes(`name="${name}"`)) && publishingOptions.includes('name="status"') && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.includes(`name="${name}"`)));
check("publishing decisions form two grouped cards inside the four-unit responsive dashboard", ["publication-schedule", "featured-popular"].every((id) => publishingOptions.includes(`id="${id}"`)) && sharedReview.includes("md:grid-cols-2") && sharedReview.includes("lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)]") && publishingOptions.includes('name="status"') && publishingOptions.includes('name="is_featured"') && publishingOptions.includes('name="is_popular"') && publishingOptions.includes("TopicDateLabelField"));
const sharedDatePicker = read("src/components/admin/ui/AdminDatePicker.tsx");
const dateFieldTree = ts.createSourceFile("TopicDateLabelField.tsx", publishingDateField, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let dateLabelTrigger = "";
let dateInput = "";
function visitDateField(node: ts.Node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(dateFieldTree) === "button" &&
      node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(dateFieldTree) === "data-topic-date-picker-trigger")) dateLabelTrigger = node.getText(dateFieldTree);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(dateFieldTree) === "AdminDatePicker" &&
      node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(dateFieldTree) === "data-topic-date-picker-input")) dateInput = node.getText(dateFieldTree);
  ts.forEachChild(node, visitDateField);
}
visitDateField(dateFieldTree);
const dateLabelVisibleText = visibleJsxText(dateLabelTrigger);
check("publishing date exposes the exact visible-date label with a shared icon marker", dateLabelTrigger.includes('data-topic-date-picker-trigger="label"') && dateLabelTrigger.includes('data-topic-date-picker-icon=""') && dateLabelTrigger.includes("openAdminDatePicker(inputRef.current)") && dateLabelVisibleText.includes("تاريخ النشر الظاهر") && !dateLabelVisibleText.includes("فتح التقويم"));
check("publishing date input keeps its native picker without changing its submitted name", dateInput.includes('id="topic-published-at"') && dateInput.includes('data-topic-date-picker-input=""') && dateInput.includes('type="date"') && dateInput.includes('name="published_at"') && !dateInput.includes("onClick={openCalendar}") && sharedDatePicker.includes("input.click()") && sharedDatePicker.includes("input.showPicker()") && dateInput.includes("<AdminDatePicker") && publishingDateField.match(/name="published_at"/g)?.length === 1);
check("publishing date preserves saved and fallback date semantics", publishingDateField.includes("openAdminDatePicker") && publishingDateField.includes("publishedDateValue") && publishingDateField.includes("defaultIsDate") && publishingDateField.includes("getTodayInputValue()") && publishingDateField.includes('name="date_label"') && !publishingDateField.includes("التاريخ المعروض للزائر"));
check("legacy publication label is preserved by a hidden field without manual label UI", publishingDateField.includes("preservedLegacyLabel") && publishingDateField.includes('<input type="hidden" name="date_label" value={preservedLegacyLabel} />') && !publishingDateField.includes("data-topic-publish-label-field") && !publishingDateField.includes("setManualLabel"));
check("created and updated timestamps remain system-owned while published_at is the sole editable date", [createEditor, editEditor, publishingOptions, review].every((source) => !source.includes('name="created_at"') && !source.includes('name="updated_at"')) && publishingDateField.match(/name="published_at"/g)?.length === 1);
check("topic preview actions use the shared capability resolver and renderer", previewCapability.includes("export type AdminEntityPreviewCapability") && previewCapability.includes("export function resolveAdminEntityPreviewActions") && contentPreviewCapability.includes("export function buildAdminContentPreviewCapability") && previewActions.includes("resolveAdminEntityPreviewActions") && previewActions.includes("capability"));
check("edit preview actions render outside the form and publishing options contain no preview transport", editEditor.includes("<AdminEntityPreviewActions capability={previewCapability}") && editEditor.indexOf("<AdminEntityPreviewActions capability={previewCapability}") < editEditor.indexOf("<ContentEditorShell") && ["next/link", "topicId", "slug", "data-topic-preview-links", "/preview", "/topics/", "previewLinkClassName"].every((marker) => !publishingOptions.includes(marker)));
check("create and edit use one shared Save action with no parallel SaveBar", [createEditor, editEditor].every((source) => source.includes("<ContentEditorShell") && source.includes("action={saveContentForm}") && !source.includes("SaveBar")));
check("publishing fields are slotted into the dashboard in create and edit", [createEditor, editEditor].every((source) => source.indexOf("<ContentReviewPanel") < source.indexOf("<ContentPublishingOptions") && source.includes("publishingOptions={")));
check("Create and Edit review use one shared inline-expansion dashboard", review.includes("data-content-review-capability") && review.includes("<AdminEntityReviewPanel") && sharedReview.includes("data-admin-entity-review-analysis") && sharedReview.includes("data-admin-entity-review-issue") && sharedReview.includes("aria-expanded={expanded}") && ![review, sharedReview].some((source) => source.includes("AdminSingleOpenAccordion")));
check("review overview exposes grouped publishing, visibility, display, and score without owning submitted fields", ["publication-schedule", "featured-popular"].every((id) => publishingOptions.includes(`id="${id}"`)) && sharedReview.includes('data-admin-entity-review-decision="score"') && review.includes('id="display-settings"') && review.includes('checked(form, "is_featured"') && review.includes('checked(form, "is_popular"') && review.includes("updatedAt ? formatAdminDateTime(updatedAt)") && editEditor.includes("updatedAt={topic.updated_at}") && !review.includes('name="updated_at"') && !review.includes('name="created_at"'));
check("review keeps content, image, SEO, and Validation cards in semantic order", review.indexOf('id: "content"') < review.indexOf('id: "image"') && review.indexOf('id: "image"') < review.indexOf('id: "seo"') && sharedReview.includes('id: "validation"'));
check("review separates advisory geometry from blocking Validation geometry", sharedReview.includes('data-admin-entity-review-analysis-tier={') && sharedReview.includes("md:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)_auto]") && sharedReview.includes('item.blocksPublish && item.status === "fail"') && sharedReview.includes("items={blockingIssues}"));
check("review uses the exact Fix action and advisory-score wording", sharedReview.includes("إصلاح") && sharedReview.includes("الدرجة إرشادية ولا تمنع النشر وحدها."));
const legacyWarningCta = ["راجع", "التنبيهات"].join(" ");
check("the forbidden legacy warning CTA is absent", !review.includes(legacyWarningCta) && !contentReviewCapability.includes(legacyWarningCta));

const checklist = buildTopicPublishChecklist({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image: "",
  imageAlt: "",
  categorySlug: "",
  seoTitle: "",
  seoDescription: "",
  focusKeyword: "",
  faq: [],
});
const checklistById = new Map(checklist.map((item) => [item.id, item.status]));
check("publish checklist required-field rules remain active", checklistById.get("title") === "fail" && checklistById.get("slug") === "fail" && checklistById.get("category") === "fail" && checklistById.get("image") === "fail");
check("publish checklist SEO rules remain active", checklistById.get("seo-title") === "fail" && checklistById.get("seo-description") === "fail" && checklistById.get("focus-keyword") === "fail");
check("publish checklist optional recommendation rules remain active", checklistById.get("faq") === "pass" && checklistById.get("internal-links") === "warn");

const basePublishInput = {
  title: "عنوان موضوع صالح",
  slug: "seo-boundary-topic",
  excerpt: "وصف مختصر مكتمل وجاهز للنشر",
  content: "محتوى موضوع صالح للاختبار",
  image: "/images/seo-boundary.jpg",
  imageAlt: "صورة موضوع SEO",
  categorySlug: "qa-category",
  seoTitle: "س".repeat(SEO_LENGTH_STANDARDS.title.min),
  seoDescription: "ص".repeat(SEO_LENGTH_STANDARDS.description.min),
  focusKeyword: "اختبار",
  faq: [],
};

const articleScoreInput = {
  profile: "article" as const,
  title: "عقد SEO موحد",
  description: "وصف عقد SEO موحد يشرح المحتوى بصورة واضحة ومباشرة للزائر ومحرك البحث.",
  content: "# عقد SEO موحد\n\n## القسم الأول\n\nعقد SEO موحد داخل المحتوى.\n\n## القسم الثاني\n\nعقد SEO موحد مع رابط [داخلي](/topics/example).",
  slug: "unified-seo-contract",
  image: "/images/content.jpg",
  imageAlt: "صورة عقد SEO موحد داخل المحتوى",
  ogImage: "/images/seo.jpg",
  ogImageAlt: "صورة عقد SEO موحد للمشاركة الاجتماعية",
  seoTitle: "عقد SEO موحد لكل مستهلك داخل النظام الحالي",
  seoDescription: "وصف تعريفي يثبت أن عقد SEO الموحد يستخدم نفس المدخلات والدرجة الرسمية في المحرر والقائمة وبطاقة المتوسط دون أي مسار مواز.",
  seoKeywords: ["عقد SEO", "عقد SEO", "المستهلكون"],
  focusKeyword: "عقد SEO",
  faq: [{ question: " ما العقد الموحد؟ ", answer: " عقد واحد لكل المستهلكين. " }],
};
const articleScore = analyzeEntitySeo(articleScoreInput);
const effectiveOgScore = analyzeEntitySeo({
  ...articleScoreInput,
  image: articleScoreInput.ogImage,
  imageAlt: articleScoreInput.ogImageAlt,
  ogImage: "",
  ogImageAlt: "",
  seoKeywords: ["عقد SEO", "المستهلكون"],
  faq: [{ question: "ما العقد الموحد؟", answer: "عقد واحد لكل المستهلكين." }],
});
const arabicEntityScore = analyzeEntitySeo({
  ...articleScoreInput,
  profile: "entity",
  content: "مقدمة الصفحة\n<p>محتوى منسق داخل الموديول.</p>\nتعمل فينيسيا للتطوير العقاري على توثيق مراحل التنفيذ.",
  focusKeyword: "فينيسيا للتطوير العقارى",
});
check(
  "the SEO Score owner returns one official score after shared OG, keyword, and FAQ normalization",
  Number.isInteger(articleScore.score) &&
    articleScore.score === effectiveOgScore.score &&
    !Object.hasOwn(articleScore, "seoScore") &&
    !Object.hasOwn(articleScore, "overallScore") &&
    articleScore.metrics.some((metric) => metric.id === "keyword-density") &&
    articleScore.metrics.some((metric) => metric.id === "faq-count"),
);
check(
  "Arabic Entity SEO keyword matching normalizes ya and alef maqsura inside mixed Page Composition content",
  arabicEntityScore.issues.find((issue) => issue.id === "keyword-content")?.type === "success",
);
const unicodeArabicEntityScore = analyzeEntitySeo({
  ...articleScoreInput,
  profile: "entity",
  content: "تعمل فـيـنيسيا\u200f للتطوير العَقاري على توثيق التنفيذ",
  focusKeyword: "فينيسيا للتطوير العقاری",
});
check(
  "Arabic Entity SEO matching removes formatting marks, tatweel, diacritics, and Persian letter variants",
  unicodeArabicEntityScore.issues.find((issue) => issue.id === "keyword-content")?.type === "success",
);
const extractedVisiblePageCopy = extractPageBlockSeoText({
  title: "عنوان مخفي",
  showTitle: false,
  contacts: [{ label: "واتساب", value: "01000000000" }],
  currentLabelOverride: "من نحن",
});
check(
  "Page SEO content bridge includes visible labels and values while respecting show controls",
  !extractedVisiblePageCopy.includes("عنوان مخفي") &&
    extractedVisiblePageCopy.includes("واتساب") &&
    extractedVisiblePageCopy.includes("01000000000") &&
    extractedVisiblePageCopy.includes("من نحن"),
);
check(
  "the SEO Score owner shares each article Markdown render across visible-text and heading checks",
  (seoScore.match(/const renderedContent = renderMarkdown\(input\.content\)/g) ?? [])
    .length === 1 &&
    seoScore.includes("countHeadings(renderedContent, 1)") &&
    seoScore.includes("countHeadings(renderedContent, 2)") &&
    seoScore.includes("countHeadings(renderedContent, 3)") &&
    !seoScore.includes("countWords(visibleContent)") &&
    !seoScore.includes("countMatches(visibleContent"),
);

const whitespaceOnlySeoTitle = " ".repeat(SEO_LENGTH_STANDARDS.title.min);
const whitespaceOnlyAssessment = assessSeoLength(
  whitespaceOnlySeoTitle,
  SEO_LENGTH_STANDARDS.title,
);
check(
  "whitespace-only SEO keeps its actual count but remains empty and blocked",
  whitespaceOnlyAssessment.count === SEO_LENGTH_STANDARDS.title.min &&
    whitespaceOnlyAssessment.meaningfulCount === 0 &&
    whitespaceOnlyAssessment.state === "muted" &&
    getTopicPublishOnlyValidationError({
      ...basePublishInput,
      seoTitle: whitespaceOnlySeoTitle,
    }) !== null,
);

const lengthBoundaryCases = [
  { id: "empty", length: 0, state: "muted" },
  { id: "min-1", length: -1, state: "warning" },
  { id: "min", length: 0, state: "success" },
  { id: "max", length: 0, state: "success" },
  { id: "max+1", length: 1, state: "danger" },
  { id: "far-over", length: 50, state: "danger" },
] as const;

for (const field of [
  {
    id: "title",
    inputKey: "seoTitle",
    checklistId: "seo-title",
    issueId: "seo-title-length",
    standard: SEO_LENGTH_STANDARDS.title,
    publishMax: SEO_LENGTH_STANDARDS.title.max,
  },
  {
    id: "description",
    inputKey: "seoDescription",
    checklistId: "seo-description",
    issueId: "meta-description-length",
    standard: SEO_LENGTH_STANDARDS.description,
    publishMax: SEO_LENGTH_STANDARDS.description.max,
  },
] as const) {
  for (const boundary of lengthBoundaryCases) {
    const length =
      boundary.id === "empty"
        ? 0
        : boundary.id === "min-1"
          ? field.standard.min - 1
          : boundary.id === "min"
            ? field.standard.min
            : boundary.id === "max"
              ? field.standard.max
              : field.standard.max + boundary.length;
    const value = "س".repeat(length);
    const assessment = assessSeoLength(value, field.standard);
    const input = { ...basePublishInput, [field.inputKey]: value };
    const publishError = getTopicPublishOnlyValidationError(input);
    const checklistStatus = buildTopicPublishChecklist(input).find(
      (item) => item.id === field.checklistId,
    )?.status;
    const analysisIssue = analyzeEntitySeo({
      profile: "article",
      title: input.title,
      description: input.excerpt,
      slug: input.slug,
      content: input.content,
      image: input.image,
      imageAlt: input.imageAlt,
      ogImage: "",
      ogImageAlt: "",
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoKeywords: [],
      focusKeyword: input.focusKeyword,
      faq: input.faq,
    }).issues.find((issue) => issue.id === field.issueId);
    const expectedIssueType =
      boundary.state === "success"
        ? "success"
        : boundary.state === "danger"
          ? "error"
          : boundary.state;
    const publishReady = length >= field.standard.min && length <= field.publishMax;
    const expectedChecklistStatus = publishReady ? "pass" : "fail";

    check(
      `${field.id} ${boundary.id} keeps display and publish validation on the same final contract`,
      assessment.count === length &&
        assessment.meaningfulCount === length &&
        assessment.state === boundary.state &&
        analysisIssue?.type === expectedIssueType &&
        checklistStatus === expectedChecklistStatus &&
        (publishError === null) === publishReady,
    );
  }
}

console.log(`verify:topic-seo-review passed (${passed} assertions)`);
