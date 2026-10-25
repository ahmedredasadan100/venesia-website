import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

import {
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST,
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE,
} from "../src/lib/admin/seo/entity-seo-adoption-manifest.ts";
import {
  ENTITY_SEO_FIELD_NAMES,
  readEntitySeoFormData,
  toEntitySeoPersistence,
  validateEntitySeoValues,
} from "../src/lib/seo/entity-seo-types.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const occurrences = (source: string, token: string) => source.split(token).length - 1;

// Inspect the preserved Premium rendering independently of explicit Panel
// adoption. This resolves only Panel branches; the Premium/default branches stay
// intact so the existing grouping and owner assertions still exercise both.
function withoutPanelBranches(input: string) {
  const tree = ts.createSourceFile("AdminEntitySeoPanel.tsx", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const render = (node: ts.Node): string => {
    if (ts.isConditionalExpression(node) && node.condition.getText(tree) === "panel") return render(node.whenFalse);
    const replacements: Array<{ start: number; end: number; text: string }> = [];
    ts.forEachChild(node, (child) => {
      const text = render(child);
      if (text !== child.getText(tree)) replacements.push({ start: child.getStart(tree), end: child.getEnd(), text });
    });
    let result = node.getText(tree);
    const start = node.getStart(tree);
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
      result = result.slice(0, replacement.start - start) + replacement.text + result.slice(replacement.end - start);
    }
    return result;
  };
  return render(tree);
}

const paths = {
  shared: "src/components/admin/seo/AdminEntitySeoPanel.tsx",
  contract: "src/lib/seo/entity-seo-types.ts",
  score: "src/lib/admin/seo-score.ts",
  loader: "src/lib/admin/content/load-unified-content.ts",
  topic: "src/components/admin/SeoPanel.tsx",
  project: "src/components/admin/projects/entry/ProjectSeoPanel.tsx",
  media: "src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx",
  mediaForm: "src/components/admin/content/editors/media/MediaContentForm.tsx",
  page: "src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx",
  mediaImage: "src/components/admin/media/AdminMediaImageField.tsx",
  mediaReference: "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
  migration: "sql/migrations/20260803153000_shared_entity_seo_capability.sql",
} as const;
const pageRoute = read("src/app/admin/pages-blocks/pages/[id]/page.tsx");
const pageClient = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const pageAdminQueries = read("src/lib/page-blocks/admin-queries.ts");
const seoResolver = read("src/lib/seo/resolve-seo-metadata.ts");
const seoUtils = read("src/lib/seo/seo-utils.ts");
const persistedSeoOwner = read("src/lib/admin/seo/entity-seo-persistence.ts");

const source = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, read(path)]),
) as Record<keyof typeof paths, string>;

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

if (process.argv.includes("--project-adapter")) {
  check("Project selects the canonical shared Panel adapter and every registered SEO adapter retains its declared owner", hasAllEligiblePremiumSeoPresentation());
  for (const presentation of ["premium", "default"]) {
    check(`Project adoption rejects ${presentation} and parallel-owner regressions`,
      !hasAllEligiblePremiumSeoPresentation({ [paths.project]: source.project.replace('presentation="panel"', `presentation="${presentation}"`) }) &&
      !hasAllEligiblePremiumSeoPresentation({ [paths.project]: source.project.replace("/seo/AdminEntitySeoPanel", "/seo/ParallelSeoPanel") }));
  }
  check("Project retains entity-native names, initial overrides, inherited sources and correction navigation", source.project.includes("fieldNames={PROJECT_SEO_FIELD_NAMES}") &&
    source.project.includes("ENTITY_SEO_FIELD_NAMES satisfies AdminEntitySeoFieldNames") && source.project.includes("fieldIds={PROJECT_SEO_FIELD_IDS}") &&
    source.project.includes("navigationEventName={PROJECT_ENTRY_NAVIGATION_EVENT}") && source.project.includes('mediaBrowseFolder: "images/projects/seo"') &&
    ["seoTitle: project.seo_title", "seoDescription: project.seo_description", "focusKeyword: project.focus_keyword", "canonicalUrl: project.canonical_url", "robotsIndex: project.robots_index", "robotsFollow: project.robots_follow", "ogImage: project.og_image", "ogImageAlt: project.og_image_alt"].every((binding) => source.project.includes(binding)));
  console.log(`Project SEO adapter verification passed (${passed} affected source/contract checks; no browser or save proof).`);
  process.exit(0);
}

if (process.argv.includes("--panel-composition")) {
  check("Panel SEO delegates field-only descendants to the neutral shared Section while retaining the original grids and independent media card", hasCanonicalPanelSeoSections(source.shared));
  check("Panel SEO rejects renewed nested Premium field wrappers, parallel neutral owners and local container chrome",
    !hasCanonicalPanelSeoSections(source.shared.replace('surface="neutral"', 'surface="panel"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replaceAll('<AdminFormSection surface="neutral">', '<AdminCard presentation="premium" className="p-3">').replaceAll('</AdminFormSection>', '</AdminCard>')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('AdminFormLayout, AdminFormSection', 'AdminFormLayout, ParallelFormSection')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('surface="neutral"', 'surface="neutral" className="rounded-2xl border bg-black/20 p-3"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/<AdminFormSection surface="neutral">(\s*\{socialImageAltField\})/u, '<AdminFormSection surface="panel">$1')));
  check("Panel SEO preserves original information order, retained group headers, 8:4 RTL spans and outer equal-height media composition",
    !hasCanonicalPanelSeoSections(source.shared.replace('span={8}', 'span={6}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('columns={12} presentation="equal-height-columns"', 'columns={12}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/<AdminModuleSectionHeader\b[^>]*sectionHeading="صورة المشاركة"[^>]*\/>/u, "")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{seoDescriptionField}', '{focusKeywordField}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{socialImageAltField}', '{canonicalField}')));
  check("Existing Premium and omitted SEO consumers retain their presentation owner, grouping and default policy",
    seoPresentationDefault(source.shared).valid && hasCanonicalPremiumSeoOwners(source.shared) &&
    hasApprovedPremiumSeoGrouping(source.shared) && hasFullPremiumSeoSectionHeaders(source.shared));
  check("All registered SEO adapters retain their existing native consumer and explicit presentation bindings", hasAllEligiblePremiumSeoPresentation());
  console.log(`Panel SEO composition verification passed (${passed} affected source/contract checks; no browser or save proof).`);
  process.exit(0);
}

const fieldNames = [
  "seoTitle",
  "seoDescription",
  "focusKeyword",
  "seoKeywords",
  "canonicalUrl",
  "robotsIndex",
  "robotsFollow",
  "ogImage",
  "ogImageAlt",
] as const;

check(
  "one existing Entity SEO module owns the final nine-field data and persistence contract",
  source.contract.includes("export const ENTITY_SEO_FIELD_NAMES") &&
    source.contract.includes("export type EntitySeoValues") &&
    source.contract.includes("export type EntitySeoPersistenceRecord") &&
    source.contract.includes("readEntitySeoFormData") &&
    source.contract.includes("toEntitySeoPersistence") &&
    source.contract.includes("validateEntitySeoValues") &&
    fieldNames.every((field) => source.contract.includes(`${field}:`)),
);

check(
  "one existing SEO Score owner exposes one input and one official output contract",
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.scoreContractOwner === paths.score &&
    source.score.includes("export type SeoScoreInput") &&
    source.score.includes("export type SeoScoreOutput") &&
    source.score.includes("export function analyzeEntitySeo(input: SeoScoreInput): SeoScoreOutput") &&
    source.score.includes("score: number") &&
    !source.score.includes("export function analyzeTopicSeo") &&
    !source.score.includes("export type EntitySeoScoreInput"),
);

check(
  "Editor, Entity List, and Metrics consume the same SEO Score contract and official score",
  source.shared.includes("analyzeEntitySeo(analysisInput)") &&
    source.shared.includes("resolveEntitySeoScoreInput({") &&
    persistedSeoOwner.includes("resolveEntitySeoScoreInput({") &&
    source.shared.includes("{analysis.score}") &&
    source.shared.includes("analysis.metrics.map") &&
    source.shared.includes("analysisExtension.resolveFaq(analysisState)") &&
    !source.shared.includes(".overallScore") &&
    !source.shared.includes(".seoScore") &&
    !source.shared.includes("analysisExtension?.analyze") &&
    persistedSeoOwner.includes("const analysis = analyzeEntitySeo(input)") &&
    persistedSeoOwner.includes("seo_score: analysis.score") &&
    source.loader.includes("seo_score: source.seo_score") &&
    source.loader.includes("seo_score_version !== ENTITY_SEO_SCORE_VERSION") &&
    source.loader.includes('"admin_content_topic_metrics"') &&
    !source.loader.includes("analyzeEntitySeo") &&
    !source.loader.includes("analyzeTopicSeo") &&
    !source.loader.includes(".overallScore") &&
    !source.loader.includes(".seoScore"),
);

check(
  "all eligible editor declarations submit the complete SEO Score input contract",
  source.topic.includes('profile: "article"') &&
    source.topic.includes("faq: props.faq ?? []") &&
    [source.project, source.media, source.page].every(
      (adapter) => adapter.includes('profile: "entity"') && adapter.includes("faq: []"),
    ),
);

check(
  "the migration makes Topic and Page schemas match the established Project SEO column contract",
  ["public.topics", "public.pages"].every((table) => source.migration.includes(`alter table ${table}`)) &&
    ["focus_keyword", "canonical_url", "robots_index", "robots_follow", "og_image", "og_image_alt"].every(
      (column) => source.migration.includes(column),
    ) &&
    occurrences(source.migration, "alter column seo_keywords type text[]") === 2 &&
    occurrences(source.migration, "char_length(seo_title) <= 60") === 2 &&
    occurrences(source.migration, "char_length(seo_description) <= 160") === 2 &&
    occurrences(source.migration, "og_image is null or btrim(og_image_alt) <> ''") === 2,
);

check(
  "Topic, Project, Media Topic, and Page adapters all delegate presentation to the same owner",
  [source.topic, source.project, source.media, source.page].every(
    (adapter) => occurrences(adapter, "<AdminEntitySeoPanel") === 1,
  ) &&
    source.mediaForm.includes("<MediaEntitySeoPanel") &&
    !source.mediaForm.includes('name="seo_title"') &&
    !source.page.includes('name="seo_title"'),
);

function seoPresentationDefault(input: string) {
  const tree = ts.createSourceFile(paths.shared, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const props = tree.statements.find((node): node is ts.TypeAliasDeclaration =>
    ts.isTypeAliasDeclaration(node) && node.name.text === "AdminEntitySeoPanelProps",
  );
  const property = props && ts.isTypeLiteralNode(props.type) ? props.type.members.find(
    (node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(tree) === "presentation",
  ) : undefined;
  const choices = property?.type && ts.isUnionTypeNode(property.type) ? property.type.types.map((node) =>
    ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? node.literal.text : null,
  ).sort() : [];
  const panel = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "AdminEntitySeoPanel",
  );
  const parameters = panel?.parameters[0]?.name;
  const initializer = parameters && ts.isObjectBindingPattern(parameters) ? parameters.elements.find(
    (node) => ts.isIdentifier(node.name) && node.name.text === "presentation",
  )?.initializer : undefined;
  const declarations = panel?.body?.statements.flatMap((node) =>
    ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [],
  ) ?? [];
  const selector = (name: string) => declarations.find((node) => ts.isIdentifier(node.name) && node.name.text === name)?.initializer;
  const explicitlySelects = (node: ts.Expression | undefined, value: string) => node && ts.isBinaryExpression(node) &&
    ts.isIdentifier(node.left) && node.left.text === "presentation" &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    ts.isStringLiteral(node.right) && node.right.text === value;
  const panelSelector = selector("panel");
  const premiumSelector = selector("premium");
  const selectorUsesExplicitOptIn = premiumSelector && ts.isBinaryExpression(premiumSelector) &&
    premiumSelector.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
    explicitlySelects(premiumSelector.left, "premium") && ts.isIdentifier(premiumSelector.right) && premiumSelector.right.text === "panel" &&
    explicitlySelects(panelSelector, "panel");
  return {
    tree,
    initializer,
    valid: Boolean(property?.questionToken) && choices.join("|") === "default|panel|premium" &&
      Boolean(initializer && ts.isStringLiteral(initializer) && initializer.text === "default") &&
      Boolean(selectorUsesExplicitOptIn),
  };
}

function seoAdapterPresentationCalls(file: string, input: string) {
  const tree = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Set<string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || !node.importClause?.name) continue;
    if (posix.normalize(posix.join(posix.dirname(file), `${node.moduleSpecifier.text}.tsx`)) === paths.shared) {
      owners.add(node.importClause.name.text);
    }
  }
  const calls: Array<{ presentation: string | null | undefined; hasSpread: boolean }> = [];
  const mediaForward = (value: ts.Expression | undefined) => {
    if (!value || !ts.isBinaryExpression(value) || value.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken || !ts.isIdentifier(value.left) || value.left.text !== "presentation") return false;
    const fallback = ts.isParenthesizedExpression(value.right) ? value.right.expression : value.right;
    return ts.isConditionalExpression(fallback) && ts.isBinaryExpression(fallback.condition) &&
      ts.isIdentifier(fallback.condition.left) && fallback.condition.left.text === "contentType" && fallback.condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isStringLiteral(fallback.condition.right) && fallback.condition.right.text === "video" &&
      ts.isStringLiteral(fallback.whenTrue) && fallback.whenTrue.text === "panel" && ts.isStringLiteral(fallback.whenFalse) && fallback.whenFalse.text === "premium";
  };
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && owners.has(node.tagName.getText(tree))) {
      const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "presentation",
      );
      calls.push({
        presentation: property ? property.initializer && ts.isStringLiteral(property.initializer) ? property.initializer.text :
          file === paths.media && property.initializer && ts.isJsxExpression(property.initializer) && property.initializer.expression &&
          mediaForward(property.initializer.expression) ? "forward;video:panel;other:premium" : null : undefined,
        hasSpread: node.attributes.properties.some(ts.isJsxSpreadAttribute),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return calls;
}

function hasAllEligiblePremiumSeoPresentation(overrides: Readonly<Record<string, string>> = {}) {
  const eligible = ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.filter((entry) =>
    entry.surfaceKind === "entity_seo_editor" && entry.classification === "adopted",
  );
  return eligible.length > 0 && eligible.every((entry) => {
    const calls = entry.sourceFiles.flatMap((file) => seoAdapterPresentationCalls(file, overrides[file] ?? read(file)));
    return calls.length === 1 && calls.every((call) => !call.hasSpread &&
      call.presentation === (entry.sourceFiles.some((file) => file === paths.topic || file === paths.page || file === paths.project) ? "panel" :
        entry.sourceFiles.some((file) => file === paths.media) ? "forward;video:panel;other:premium" : "premium"),
    );
  });
}

function hasScopedMediaSeoConsumer(input: string) {
  const tree = ts.createSourceFile(paths.mediaForm, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const property = (object: ts.ObjectLiteralExpression, name: string) => object.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === name)?.initializer;
  const selector = nodes.filter(ts.isVariableDeclaration).filter((node) => ts.isIdentifier(node.name) && node.name.text === "videoPanel");
  const predicate = selector[0]?.initializer;
  const scopedSelector = selector.length === 1 && predicate && ts.isBinaryExpression(predicate) && ts.isIdentifier(predicate.left) && predicate.left.text === "contentType" &&
    predicate.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(predicate.right) && predicate.right.text === "video";
  const canonicalImport = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.name?.text === "MediaEntitySeoPanel" &&
    posix.normalize(posix.join(posix.dirname(paths.mediaForm), `${node.moduleSpecifier.text}.tsx`)) === paths.media);
  const calls = nodes.filter((node): node is ts.JsxOpeningLikeElement => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === "MediaEntitySeoPanel");
  const contentType = calls[0]?.attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === "contentType")?.initializer;
  const seoTabs = nodes.filter(ts.isObjectLiteralExpression).filter((node) => {
    const id = property(node, "id");
    return id && ts.isStringLiteral(id) && id.text === "seo";
  });
  const panel = calls[0]?.attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === "presentation")?.initializer;
  return scopedSelector && canonicalImport && calls.length === 1 && !calls[0]!.attributes.properties.some(ts.isJsxSpreadAttribute) &&
    contentType && ts.isJsxExpression(contentType) && contentType.expression && ts.isIdentifier(contentType.expression) && contentType.expression.text === "contentType" &&
    panel && ts.isStringLiteral(panel) && panel.text === "panel" && seoTabs.length === 1 &&
    property(seoTabs[0]!, "sectionHeading") === undefined && property(seoTabs[0]!, "sectionDescription") === undefined;
}

function hasCanonicalPremiumSeoOwners(input: string) {
  input = withoutPanelBranches(input);
  const tree = ts.createSourceFile(paths.shared, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const requiredOwners = new Map([
    ["AdminCard", "src/components/admin/ui/AdminCard"],
    ["AdminActionButton", "src/components/admin/ui/AdminActionButton"],
    ["AdminFormControlHeader", "src/components/admin/ui/AdminForm"],
    ["AdminFormGrid", "src/components/admin/ui/AdminFormRuntime"],
    ["AdminModuleSectionHeader", "src/components/admin/ui/AdminModuleTabs"],
    ["AdminModuleTabIcon", "src/components/admin/ui/AdminModuleTabs"],
    ["AdminMediaImageField", "src/components/admin/media/AdminMediaImageField"],
    ["adminFormFieldClassName", "src/lib/admin/admin-ui-styles"],
    ["adminFormTextareaClassName", "src/lib/admin/admin-ui-styles"],
  ]);
  const bindings = new Map<string, string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const modulePath = posix.normalize(posix.join(posix.dirname(paths.shared), node.moduleSpecifier.text));
    const defaultName = node.importClause?.name?.text;
    if (defaultName && requiredOwners.get(defaultName) === modulePath) bindings.set(defaultName, defaultName);
    const named = node.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) for (const binding of named.elements) {
      const exported = (binding.propertyName ?? binding.name).text;
      if (requiredOwners.get(exported) === modulePath) bindings.set(binding.name.text, exported);
    }
  }
  const used = new Set<string>();
  let valid = true;
  const stringAttribute = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name,
    )?.initializer;
    return property && ts.isStringLiteral(property) ? property.text : null;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const owner = bindings.get(node.tagName.getText(tree));
      if (owner) used.add(owner);
      if (owner === "AdminCard" && stringAttribute(node, "presentation") !== "premium") valid = false;
      if (owner === "AdminFormControlHeader" && stringAttribute(node, "presentation") !== "leading-icon") valid = false;
      if (owner === "AdminActionButton" && stringAttribute(node, "type") !== "button") valid = false;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const owner = bindings.get(node.expression.text);
      if (owner) used.add(owner);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return valid && [...requiredOwners.keys()].every((owner) => used.has(owner));
}

function hasApprovedPremiumSeoGrouping(input: string) {
  input = withoutPanelBranches(input);
  const tree = ts.createSourceFile(paths.shared, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map<string, ts.Expression>();
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const nodes: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return nodes;
  };
  for (const declaration of find(tree, ts.isVariableDeclaration)) {
    if (ts.isIdentifier(declaration.name) && declaration.initializer) declarations.set(declaration.name.text, declaration.initializer);
  }
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const premiumBranch = (name: string) => {
    const value = declarations.get(name);
    const conditional = value && unwrap(value);
    return conditional && ts.isConditionalExpression(conditional) && conditional.condition.getText(tree) === "premium"
      ? unwrap(conditional.whenTrue) : undefined;
  };
  const refs = (node: ts.Node) => find(node, ts.isJsxExpression).flatMap((expression) =>
    expression.expression && ts.isIdentifier(expression.expression) ? [expression.expression.text] : [],
  );
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(tree) === name,
  )?.initializer;
  const panel = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminEntitySeoPanel");
  if (!panel) return false;
  const columns = find(panel, ts.isConditionalExpression).filter((node) => {
    const content = unwrap(node.whenTrue);
    if (node.condition.getText(tree) !== "premium" || !ts.isJsxElement(content) || content.openingElement.tagName.getText(tree) !== "AdminFormGrid") return false;
    const size = attribute(content.openingElement, "columns");
    const expectedRefs = "robotsCanonicalContent|socialSharingFields";
    return size && ts.isJsxExpression(size) && size.expression && ts.isNumericLiteral(size.expression) && size.expression.text === "2" &&
      refs(content).join("|") === expectedRefs && refs(node.whenFalse).join("|") === expectedRefs;
  });
  const robots = premiumBranch("robotsCanonicalContent");
  const social = premiumBranch("socialSharingFields");
  if (columns.length !== 1 || !robots || !social) return false;
  const cards = (node: ts.Node) => find(node, ts.isJsxElement).filter((element) => element.openingElement.tagName.getText(tree) === "AdminCard");
  const robotsCards = cards(robots);
  const socialCards = cards(social);
  const robotsGrids = find(robots, ts.isJsxElement).filter((element) => element.openingElement.tagName.getText(tree) === "AdminFormGrid");
  const gridColumns = (grid: ts.JsxElement) => {
    const size = attribute(grid.openingElement, "columns");
    return size && ts.isJsxExpression(size) && size.expression && ts.isNumericLiteral(size.expression) ? Number(size.expression.text) : undefined;
  };
  if (robotsCards.length !== 2 || robotsGrids.length !== 2 || gridColumns(robotsGrids[0]) !== 1 || gridColumns(robotsGrids[1]) !== 2) return false;
  const directGroups = robotsGrids[0].children.filter(ts.isJsxElement);
  if (attribute(robotsGrids[0].openingElement, "className") || directGroups.length !== 2 ||
    directGroups[0]!.openingElement.tagName.getText(tree) !== "section" || robotsCards[0]!.parent !== directGroups[0] || directGroups[1] !== robotsCards[1] ||
    attribute(robotsGrids[1].openingElement, "className") ||
    !find(robotsCards[0], ts.isJsxElement).includes(robotsGrids[1]) ||
    refs(robotsGrids[1]).join("|") !== "robotsIndexField|robotsFollowField") return false;
  return refs(robotsCards[0]).filter((name) => /Field$/u.test(name)).join("|") === "robotsIndexField|robotsFollowField" &&
    refs(robotsCards[1]).join("|") === "canonicalField" && socialCards.length === 1 &&
    refs(socialCards[0]).filter((name) => /Field$/u.test(name)).join("|") === "socialImageField|socialImageAltField";
}

function hasFullPremiumSeoSectionHeaders(input: string) {
  input = withoutPanelBranches(input);
  const tree = ts.createSourceFile(paths.shared, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const headers = new Set<string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) ||
      posix.normalize(posix.join(posix.dirname(paths.shared), node.moduleSpecifier.text)) !== "src/components/admin/ui/AdminModuleTabs") continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === "AdminModuleSectionHeader") headers.add(binding.name.text);
    }
  }
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const nodes: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return nodes;
  };
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(tree) === name,
  )?.initializer;
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = attribute(node, name);
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  return [
    ["robotsCanonicalContent", "fieldIds.robotsSection", "ADMIN_ENTITY_SEO_TERMINOLOGY.robots", "settings"],
    ["socialSharingFields", "social.fieldIds.imageSection", "ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettings", "media"],
  ].every(([name, id, heading, icon]) => {
    const declaration = find(tree, ts.isVariableDeclaration).find((node) => ts.isIdentifier(node.name) && node.name.text === name);
    const conditional = declaration?.initializer;
    if (!conditional || !ts.isConditionalExpression(conditional) || conditional.condition.getText(tree) !== "premium") return false;
    const branch = conditional.whenTrue;
    const calls = find(branch, ts.isJsxSelfClosingElement).filter((node) => headers.has(node.tagName.getText(tree)));
    if (calls.length !== 1) return false;
    const header = calls[0]!;
    const group = find(branch, ts.isJsxElement).find((node) => node.openingElement.tagName.getText(tree) === "section" && node.children.includes(header));
    const content = group?.children.filter((node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node));
    if (!content || content.length !== 2 || content[0] !== header || !ts.isJsxElement(content[1]!) || content[1]!.openingElement.tagName.getText(tree) !== "AdminCard") return false;
    const card = content[1]!;
    const fields = card.children.filter(ts.isJsxElement);
    if (fields.length !== 1 || find(card, ts.isJsxSelfClosingElement).some((node) => headers.has(node.tagName.getText(tree)))) return false;
    return value(header, "id") === id && value(header, "sectionHeading") === heading && value(header, "icon") === icon &&
      header.attributes.properties.every((node) => ts.isJsxAttribute(node) && ["id", "sectionHeading", "icon"].includes(node.name.getText(tree))) &&
      !find(branch, ts.isJsxOpeningElement).some((node) => node.tagName.getText(tree) === "h3") &&
      (name === "robotsCanonicalContent"
        ? fields[0]!.openingElement.tagName.getText(tree) === "AdminFormGrid" && !attribute(fields[0]!.openingElement, "className")
        : value(fields[0]!.openingElement, "className") === "ADMIN_FORM_STACK_CLASS_NAME" && value(card.openingElement, "className") === "p-3");
  });
}

function hasCanonicalPanelSeoSections(input: string) {
  const tree = ts.createSourceFile(paths.shared, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const nodes: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return nodes;
  };
  const imports = new Map<string, string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const path = posix.normalize(posix.join(posix.dirname(paths.shared), node.moduleSpecifier.text));
    if (node.importClause?.name) imports.set(node.importClause.name.text, `${path}|${node.importClause.name.text}`);
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      imports.set((binding.propertyName ?? binding.name).text, `${path}|${binding.name.text}`);
    }
  }
  if (imports.get("AdminModuleSectionHeader") !== "src/components/admin/ui/AdminModuleTabs|AdminModuleSectionHeader" ||
    imports.get("AdminCard") !== "src/components/admin/ui/AdminCard|AdminCard" ||
    imports.get("AdminFormSection") !== "src/components/admin/ui/AdminForm|AdminFormSection" ||
    imports.get("AdminFormGrid") !== "src/components/admin/ui/AdminFormRuntime|AdminFormGrid" ||
    imports.get("AdminFormGridItem") !== "src/components/admin/ui/AdminFormRuntime|AdminFormGridItem" ||
    imports.get("ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME") !== "src/lib/admin/admin-ui-styles|ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME") return false;
  const declarations = new Map(find(tree, ts.isVariableDeclaration).flatMap((node) =>
    ts.isIdentifier(node.name) && node.initializer ? [[node.name.text, node.initializer] as const] : [],
  ));
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name,
  )?.initializer;
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = attribute(node, name);
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  const refs = (node: ts.Node) => find(node, ts.isJsxExpression).flatMap((expression) =>
    expression.expression && ts.isIdentifier(expression.expression) ? [expression.expression.text] : [],
  );
  const cards = (node: ts.Node) => find(node, ts.isJsxElement).filter((element) => element.openingElement.tagName.getText(tree) === "AdminCard");
  const neutralSections = (node: ts.Node) => find(node, ts.isJsxElement).filter((element) => element.openingElement.tagName.getText(tree) === "AdminFormSection");
  const isNeutralSection = (node: ts.JsxElement) => value(node.openingElement, "surface") === "neutral" &&
    node.openingElement.attributes.properties.length === 1;
  const grids = (node: ts.Node) => find(node, ts.isJsxElement).filter((element) => element.openingElement.tagName.getText(tree) === "AdminFormGrid");
  const headerMatches = (header: ts.JsxSelfClosingElement, heading: string | undefined, icon: string | undefined) =>
    value(header, "sectionHeading") === heading && value(header, "icon") === icon &&
    value(header, "sectionHeaderPresentation") === "premium" && value(header, "sectionHeaderClassName") === "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME" &&
    header.attributes.properties.every((property) => ts.isJsxAttribute(property) && ["id", "sectionHeading", "icon", "sectionHeaderPresentation", "sectionHeaderClassName"].includes(property.name.getText(tree)));
  const contentOf = (node: ts.JsxElement) => node.children.filter((child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxExpression(child) && child.expression);
  const lowerGrids = grids(tree).filter((grid) => refs(grid).join("|") === "robotsCanonicalContent|socialSharingFields");
  if (lowerGrids.length !== 1 || value(lowerGrids[0]!.openingElement, "columns") !== "2" ||
    value(lowerGrids[0]!.openingElement, "className") !== "items-start") return false;
  const panelComposition = find(tree, ts.isConditionalExpression).filter((node) => node.condition.getText(tree) === "panel" && ts.isIdentifier(node.whenTrue) && node.whenTrue.text === "socialSharingFields");
  if (panelComposition.length !== 1 || !ts.isConditionalExpression(panelComposition[0]!.whenFalse) || panelComposition[0]!.whenFalse.condition.getText(tree) !== "premium" || !find(panelComposition[0]!.whenFalse.whenTrue, ts.isJsxElement).includes(lowerGrids[0]!) || refs(panelComposition[0]!.whenFalse.whenFalse).join("|") !== "robotsCanonicalContent|socialSharingFields") return false;
  const basicsGrid = declarations.get("seoBasicsGrid");
  if (!basicsGrid || grids(basicsGrid).length !== 1 || value(grids(basicsGrid)[0]!.openingElement, "columns") !== "1" ||
    attribute(grids(basicsGrid)[0]!.openingElement, "className") || cards(basicsGrid).length !== 0 ||
    neutralSections(basicsGrid).length !== 4 || !neutralSections(basicsGrid).every(isNeutralSection) ||
    refs(basicsGrid).join("|") !== "seoTitleField|seoTitleTemplate|seoDescriptionField|focusKeywordField|seoKeywordsField") return false;
  return [
    ["seoBasicsContent", "أساسيات تحسين محركات البحث", "seo"],
    ["robotsCanonicalContent", "ADMIN_ENTITY_SEO_TERMINOLOGY.robots", "settings"],
    ["socialSharingFields", "ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettings", "media"],
  ].every(([name, heading, icon]) => {
    const initializer = declarations.get(name!);
    const conditional = initializer && unwrap(initializer);
    if (!conditional || !ts.isConditionalExpression(conditional) || conditional.condition.getText(tree) !== "panel") return false;
    const branch = unwrap(conditional.whenTrue);
    const headers = find(branch, ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(tree) === "AdminModuleSectionHeader");
    const contentCards = cards(branch);
    const expectedCards = name === "robotsCanonicalContent" ? 2 : name === "socialSharingFields" ? 2 : 1;
    const expectedHeaders = name === "robotsCanonicalContent" ? 0 : name === "socialSharingFields" ? 2 : 1;
    if (headers.length !== expectedHeaders || contentCards.length !== expectedCards ||
      contentCards.some((card) => value(card.openingElement, "presentation") !== "premium" || value(card.openingElement, "className") !== "p-3" || attribute(card.openingElement, "style"))) return false;
    const card = contentCards[0]!;
    const content = contentOf(card);
    if (find(branch, ts.isJsxOpeningElement).some((node) => ["h2", "h3"].includes(node.tagName.getText(tree)))) return false;
    if (name === "robotsCanonicalContent") {
      const robotsGrids = grids(branch);
      const canonicalCard = contentCards[1]!;
      const canonicalContent = contentOf(canonicalCard);
      return content.length === 1 && content[0] === robotsGrids[1] &&
        robotsGrids.length === 2 && value(robotsGrids[0]!.openingElement, "columns") === "1" &&
        value(robotsGrids[1]!.openingElement, "columns") === "2" && robotsGrids.every((grid) => !attribute(grid.openingElement, "className") && !attribute(grid.openingElement, "presentation")) &&
        refs(card).join("|") === "robotsIndexField|robotsFollowField" &&
        canonicalContent.length === 1 && ts.isJsxExpression(canonicalContent[0]!) &&
        canonicalContent[0].expression?.getText(tree) === "canonicalField";
    }
    const header = headers[0]!;
    if (content[0] !== header || !headerMatches(header, heading, icon) ||
      attribute(header, "sectionDescription")) return false;
    if (name === "seoBasicsContent") return content.length === 2 && refs(card).filter((ref) => ref !== "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME").join("|") === "seoBasicsGrid";
    if (name === "socialSharingFields") {
      const socialGrids = grids(card);
      const grid = socialGrids[0];
      if (content.length !== 2 || socialGrids.length !== 2 || !grid || value(grid.openingElement, "columns") !== "12" ||
        value(grid.openingElement, "presentation") !== "equal-height-columns" || attribute(grid.openingElement, "className") || attribute(grid.openingElement, "style")) return false;
      const items = contentOf(grid);
      if (items.length !== 2 || !items.every(ts.isJsxElement)) return false;
      const info = items[0]!, image = items[1]!;
      const infoContent = contentOf(info);
      const imageContent = contentOf(image);
      const infoGrid = infoContent[0];
      const altSections = neutralSections(branch);
      if (altSections.length !== 1 || !isNeutralSection(altSections[0]!)) return false;
      const altSection = altSections[0]!, imageCard = contentCards[1]!;
      const altContent = contentOf(altSection), mediaContent = contentOf(imageCard);
      const mediaHeader = headers[1]!;
      if (infoContent.length !== 1 || !infoGrid || !ts.isJsxElement(infoGrid) || infoGrid !== socialGrids[1] || value(infoGrid.openingElement, "columns") !== "1" || attribute(infoGrid.openingElement, "className") || attribute(infoGrid.openingElement, "presentation")) return false;
      const infoRows = contentOf(infoGrid);
      return items.every((item) => item.openingElement.tagName.getText(tree) === "AdminFormGridItem" && !attribute(item.openingElement, "style")) &&
        !attribute(info.openingElement, "className") && value(image.openingElement, "className") === "grid grid-cols-1" &&
        value(info.openingElement, "span") === "8" && value(image.openingElement, "span") === "4" &&
        refs(info).filter((ref) => ref !== "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME").join("|") === "robotsCanonicalContent|socialImageAltField" &&
        refs(image).filter((ref) => ref !== "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME").join("|") === "socialImageField" &&
        infoRows.length === 2 && ts.isJsxExpression(infoRows[0]!) && infoRows[0].expression?.getText(tree) === "robotsCanonicalContent" && infoRows[1] === altSection &&
        altContent.length === 1 && ts.isJsxExpression(altContent[0]!) && altContent[0].expression?.getText(tree) === "socialImageAltField" &&
        imageContent.length === 1 && imageContent[0] === imageCard && mediaContent.length === 2 && mediaContent[0] === mediaHeader &&
        headerMatches(mediaHeader, "صورة المشاركة", "media") && value(mediaHeader, "id") === "`${social.fieldIds.imageSection}-media`" &&
        ts.isJsxElement(mediaContent[1]!) && value(mediaContent[1].openingElement, "id") === "social.fieldIds.imageSection" &&
        value(mediaContent[1].openingElement, "className") === "scroll-mt-28" &&
        mediaContent[1].openingElement.attributes.properties.every((property) => ts.isJsxAttribute(property) && ["id", "className"].includes(property.name.getText(tree)));
    }
    return false;
  });
}

function hasCanonicalPremiumSeoMedia(input: string, imageOwner = source.mediaImage, reference = source.mediaReference) {
  const tree = ts.createSourceFile(paths.shared, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map<string, ts.Expression>();
  const openings: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer);
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) openings.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const field = declarations.get("socialImageField");
  const unwrapped = field && ts.isParenthesizedExpression(field) ? field.expression : field;
  if (!unwrapped || !ts.isJsxSelfClosingElement(unwrapped) || unwrapped.tagName.getText(tree) !== "AdminMediaImageField") return false;
  const attributes = unwrapped.attributes.properties;
  const attribute = (name: string) => attributes.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === name)?.initializer;
  const expression = (name: string) => { const value = attribute(name); return value && ts.isJsxExpression(value) ? value.expression : undefined; };
  const variant = expression("variant");
  const canonicalVariant = variant && ts.isConditionalExpression(variant) && variant.condition.getText(tree) === "premium" &&
    ts.isStringLiteral(variant.whenTrue) && variant.whenTrue.text === "card" && ts.isIdentifier(variant.whenFalse) && variant.whenFalse.text === "undefined";
  const nativeAlt = openings.filter((node) => node.tagName.getText(tree) === "input").some((node) => {
    const value = (name: string) => node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer;
    const name = value("name"), initial = value("defaultValue");
    return name && ts.isJsxExpression(name) && name.expression?.getText(tree) === "fieldNames.ogImageAlt" &&
      initial && ts.isJsxExpression(initial) && initial.expression?.getText(tree) === "initial.ogImageAlt";
  });
  const imageTree = ts.createSourceFile(paths.mediaImage, imageOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const selectedActions: ts.ConditionalExpression[] = [];
  const imageVisit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "selectedActions" && node.initializer && ts.isConditionalExpression(node.initializer)) selectedActions.push(node.initializer);
    ts.forEachChild(node, imageVisit);
  };
  imageVisit(imageTree);
  const selected = selectedActions[0];
  const iconActions = selected && ts.isParenthesizedExpression(selected.whenTrue) ? selected.whenTrue.expression : selected?.whenTrue;
  const referenceCalls: ts.JsxSelfClosingElement[] = [];
  const referenceTree = ts.createSourceFile(paths.mediaReference, reference, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const referenceVisit = (node: ts.Node) => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(referenceTree) === "AdminMediaImageField") referenceCalls.push(node); ts.forEachChild(node, referenceVisit); };
  referenceVisit(referenceTree);
  const referenceUsesCard = referenceCalls.some((node) => node.attributes.properties.some((property) => ts.isJsxAttribute(property) &&
    property.name.getText(referenceTree) === "variant" && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === "card"));
  return Boolean(canonicalVariant && expression("name")?.getText(tree) === "fieldNames.ogImage" &&
    expression("defaultValue")?.getText(tree) === "initial.ogImage" && expression("browseFolder")?.getText(tree) === "social.mediaBrowseFolder" &&
    expression("onValueChange")?.getText(tree).replace(/\s+/gu, "") === "(ogImage)=>setObservedLive((current)=>({...current,ogImage}))" &&
    !attributes.some((node) => ts.isJsxSpreadAttribute(node) || ts.isJsxAttribute(node) && ["altName", "onAltValueChange", "allowRemove", "className", "style", "compactAspectClassName"].includes(node.name.getText(tree))) &&
    nativeAlt && selectedActions.length === 1 && selected?.condition.getText(imageTree) === "cardPresentation" &&
    iconActions && ts.isJsxSelfClosingElement(iconActions) && iconActions.tagName.getText(imageTree) === "AdminMediaImageActions" &&
    imageOwner.includes('const cardPresentation = variant === "card"') &&
    imageOwner.includes('<AdminActionButton {...replace} size="icon" variant="gold">') &&
    imageOwner.includes('<AdminActionButton {...remove} size="icon" variant="danger">') &&
    imageOwner.includes('<AdminDataGridActionIcon action="restore" size="md" />') &&
    imageOwner.includes('<AdminDataGridActionIcon action="delete" size="md" />') &&
    imageOwner.includes("data-admin-media-image-preview-trigger") && imageOwner.includes('open={previewOpen && presentation === "active"}') && referenceUsesCard);
}

function hasNativePageSeoFooter(input: string) {
  const tree = ts.createSourceFile(paths.page, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map<string, string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const owner = posix.normalize(posix.join(posix.dirname(paths.page), node.moduleSpecifier.text));
    if (node.importClause?.name) imports.set(node.importClause.name.text, owner);
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === binding.name.text) imports.set(binding.name.text, owner);
    }
  }
  const expected = new Map([
    ["AdminStickyFormBar", "src/components/admin/ui/AdminForm"],
    ["AdminActionButton", "src/components/admin/ui/AdminActionButton"],
    ["AdminFormPendingFields", "src/components/admin/ui/AdminFormRuntime"],
    ["ADMIN_FORM_STACK_CLASS_NAME", "src/components/admin/ui/AdminForm"],
    ["AdminModuleTabIcon", "src/components/admin/ui/AdminModuleTabs"],
    ["savePageSeoAction", "src/app/admin/pages-blocks/pages/page-seo-actions"],
  ]);
  if (![...expected].every(([name, owner]) => imports.get(name) === owner)) return false;
  const forms: ts.JsxElement[] = [], footers: ts.JsxElement[] = [], buttons: ts.JsxElement[] = [];
  let protectedFooter = false;
  const visit = (node: ts.Node, ancestors: readonly string[] = []) => {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(tree);
      if (name === "form") forms.push(node);
      if (name === "AdminStickyFormBar") { footers.push(node); protectedFooter = ancestors.includes("form") && ancestors.includes("AdminFormPendingFields"); }
      if (name === "AdminActionButton") buttons.push(node);
      ts.forEachChild(node, (child) => visit(child, [...ancestors, name]));
    } else ts.forEachChild(node, (child) => visit(child, ancestors));
  };
  visit(tree);
  if (forms.length !== 1 || footers.length !== 1 || buttons.length !== 1 || !protectedFooter || !footers[0]!.children.includes(buttons[0]!)) return false;
  const attribute = (node: ts.JsxElement, name: string) => node.openingElement.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name,
  )?.initializer;
  const action = attribute(forms[0]!, "action"), type = attribute(buttons[0]!, "type"), variant = attribute(buttons[0]!, "variant");
  const stack = footers[0]!.parent;
  if (!ts.isJsxElement(stack) || stack.openingElement.tagName.getText(tree) !== "div" || attribute(stack, "className")?.getText(tree) !== "{ADMIN_FORM_STACK_CLASS_NAME}") return false;
  const children = stack.children.filter((node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node));
  if (children.length !== 2 || children[1] !== footers[0] || !ts.isJsxSelfClosingElement(children[0]!) || children[0]!.tagName.getText(tree) !== "AdminEntitySeoPanel") return false;
  return Boolean(action && ts.isJsxExpression(action) && action.expression?.getText(tree) === "savePageSeoAction" &&
    type && ts.isStringLiteral(type) && type.text === "submit" && variant && ts.isStringLiteral(variant) && variant.text === "primary" &&
    attribute(footers[0]!, "title")?.getText(tree) === '"إجراءات النموذج"' && attribute(footers[0]!, "description")?.getText(tree) === "{null}" &&
    attribute(footers[0]!, "icon")?.getText(tree).replace(/\s+/gu, "") === '{<AdminModuleTabIconname="content"/>}' &&
    footers[0]!.openingElement.attributes.properties.every((node) => ts.isJsxAttribute(node) && ["title", "description", "icon"].includes(node.name.getText(tree))) &&
    buttons[0]!.openingElement.attributes.properties.every((node) => ts.isJsxAttribute(node) && ["type", "variant", "className"].includes(node.name.getText(tree))) &&
    !forms[0]!.openingElement.attributes.properties.some((node) => ts.isJsxSpreadAttribute(node) || ts.isJsxAttribute(node) && node.name.getText(tree) === "onSubmit"));
}

const preservedPremiumSeoSource = withoutPanelBranches(source.shared);
const defaultPresentationContract = seoPresentationDefault(source.shared);
check(
  "Entity SEO presentation is optional and omitted consumers retain the existing default",
  defaultPresentationContract.valid,
);
check(
  "manifest-derived SEO adapters retain defaults while the Media adapter forwards its explicit consumer presentation",
  hasAllEligiblePremiumSeoPresentation(),
);
check("All Media Create/Edit consumers forward Panel and their actual type to the canonical SEO adapter without duplicate outer headings", hasScopedMediaSeoConsumer(source.mediaForm));
check("negative Media SEO consumer fixtures reject a hardcoded type, a record gate, a duplicate outer heading and a missing Panel binding",
  !hasScopedMediaSeoConsumer(source.mediaForm.replaceAll('contentType={contentType}', 'contentType="video"')) &&
  !hasScopedMediaSeoConsumer(source.mediaForm.replace('const videoPanel = contentType === "video";', 'const videoPanel = values?.id === 1639;')) &&
  !hasScopedMediaSeoConsumer(source.mediaForm.replace('id: "seo",', 'id: "seo", sectionHeading: "تحسين محركات البحث والمشاركة",')) &&
  !hasScopedMediaSeoConsumer(source.mediaForm.replace(/(<MediaEntitySeoPanel\b[\s\S]*?)presentation="panel"/, '$1')));
check(
  "Premium Entity SEO renders the canonical existing card, header, grid, field, icon and non-submitting action owners",
  hasCanonicalPremiumSeoOwners(source.shared),
);
check(
  "Premium SEO groups Robots and independent Canonical before the single Open Graph image and alt card in the shared two-column grid",
  hasApprovedPremiumSeoGrouping(source.shared),
);
check(
  "negative Premium grouping fixtures reject a swapped column, a one-column Desktop layout and a split image-alt group",
  !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/\{robotsCanonicalContent\}(\s*)\{socialSharingFields\}/u, "{socialSharingFields}$1{robotsCanonicalContent}")) &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace('columns={2} className="items-start"', 'columns={1} className="items-start"')) &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace("{socialImageAltField}", '</AdminCard><AdminCard presentation="premium">{socialImageAltField}')),
);
check(
  "negative Robots grouping fixtures reject side-by-side Canonical, responsive grid overrides and a stacked Index-Follow Desktop row",
  !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/(const robotsCanonicalContent = premium \?[\s\S]*?<AdminFormGrid columns=)\{1\}/u, "$1{2}")) &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/(const robotsCanonicalContent = premium \?[\s\S]*?<AdminFormGrid columns=\{1\})/u, '$1 className="xl:grid-cols-2"')) &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/columns=\{2\}>(\s*\{robotsIndexField\})/u, 'columns={1}>$1')) &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/columns=\{2\}>(\s*\{robotsIndexField\})/u, 'columns={2} className="xl:grid-cols-1">$1')) &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/\{robotsIndexField\}(\s*)\{robotsFollowField\}/u, "{robotsFollowField}$1{robotsIndexField}")),
);
check(
  "Premium Robots fills its allocated grid columns through the existing full sizing contract while omitted consumers retain wide defaults",
  (source.shared.match(/sizing=\{premium \? "full" : "wide"\}/gu) ?? []).length === 2 &&
    !hasApprovedPremiumSeoGrouping(preservedPremiumSeoSource.replace(/columns=\{2\}>(\s*\{robotsIndexField\})/u, 'columns={2} className="w-fit">$1')),
);
check(
  "Premium Robots and Open Graph place the full Section Header before its sibling content Card with one owner-provided gap and no redundant description",
  hasFullPremiumSeoSectionHeaders(source.shared),
);
check(
  "negative full Section Header fixtures reject parallel owners, internal-header substitutes, nested Card headers, removed headings, redundant copy and duplicate spacing",
  !hasFullPremiumSeoSectionHeaders(preservedPremiumSeoSource.replace('AdminModuleSectionHeader, AdminModuleTabIcon', 'ParallelSectionHeader, AdminModuleTabIcon')) &&
    !hasFullPremiumSeoSectionHeaders(preservedPremiumSeoSource.replace('<AdminModuleSectionHeader', '<AdminFormControlHeader')) &&
    !hasFullPremiumSeoSectionHeaders(preservedPremiumSeoSource.replace(/(<AdminModuleSectionHeader\b[\s\S]*?\/>)(\s*)(<AdminCard[^>]*>)/u, '$3$2$1')) &&
    !hasFullPremiumSeoSectionHeaders(preservedPremiumSeoSource.replace('sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.robots}', 'sectionHeading={undefined}')) &&
    !hasFullPremiumSeoSectionHeaders(preservedPremiumSeoSource.replace('sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.robots}', 'sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.robots} sectionDescription="redundant"')) &&
    !hasFullPremiumSeoSectionHeaders(preservedPremiumSeoSource.replace(/columns=\{2\}>(\s*\{robotsIndexField\})/u, 'columns={2} className="mt-4">$1')),
);
check(
  "Panel SEO keeps neutral field-only Basics and Alt descendants beside the retained independent information and equal-height media groups",
  hasCanonicalPanelSeoSections(source.shared),
);
check(
  "negative Panel section fixtures reject unbound or parallel headers, changed chrome, duplicated copy, field reordering and grid changes",
  !hasCanonicalPanelSeoSections(source.shared.replace('AdminModuleSectionHeader, AdminModuleTabIcon', 'ParallelSectionHeader, AdminModuleTabIcon')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('sectionHeading="أساسيات تحسين محركات البحث"', 'sectionHeading="أساسيات تحسين محركات البحث" sectionDescription="redundant"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="premium" className="local-patch"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}', 'sectionHeaderClassName={parallelSurface}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/\{robotsIndexField\}(\s*)\{robotsFollowField\}/u, "{robotsFollowField}$1{robotsIndexField}")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('panel ? socialSharingFields : premium ?', 'panel ? <>{robotsCanonicalContent}{socialSharingFields}</> : premium ?')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('columns={2} className="items-start"', 'columns={1} className="items-start"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/columns=\{2\}>(\s*\{robotsIndexField\})/u, 'columns={1}>$1')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/\{robotsCanonicalContent\}(\s*)\{socialSharingFields\}/u, "{socialSharingFields}$1{robotsCanonicalContent}")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/(const seoBasicsGrid = \(\s*<AdminFormGrid columns=)\{1\}/u, "$1{2}")),
);
check(
  "negative Open Graph fixtures reject missing retained headers, restored inner headers, unsupported grid owners, wrong ratios and reversed RTL content",
  !hasCanonicalPanelSeoSections(source.shared.replace(/<AdminModuleSectionHeader\b[^>]*sectionHeading=\{ADMIN_ENTITY_SEO_TERMINOLOGY\.socialSettings\}[^>]*\/>/u, "")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{canonicalField}', '<AdminModuleSectionHeader sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.canonicalUrl} icon="link" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />{canonicalField}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{robotsIndexField}', '<AdminModuleSectionHeader sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.robots} icon="settings" />{robotsIndexField}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/\bAdminFormGridItem\b/u, "ParallelGridItem")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('columns={12}', 'columns={3}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('span={8}', 'span={6}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('span={4}', 'span={6}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{socialImageAltField}', '<AdminModuleSectionHeader sectionHeading="النص البديل لصورة المشاركة" icon="content" />{socialImageAltField}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/<AdminModuleSectionHeader\b[^>]*sectionHeading="صورة المشاركة"[^>]*\/>/u, "")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace("{robotsCanonicalContent}", "{socialImageAltField}")) &&
    !hasCanonicalPanelSeoSections(source.shared.replace(/(<AdminFormGridItem span=\{8\}>[\s\S]*?<\/AdminFormGridItem>)(\s*)(<AdminFormGridItem span=\{4\} className="grid grid-cols-1">[\s\S]*?<\/AdminFormGridItem>)/u, "$3$2$1")),
);
check(
  "negative Open Graph height fixtures reject missing outer stretch or constrained track, inner stretch, fixed height and reserved header space",
  !hasCanonicalPanelSeoSections(source.shared.replace('columns={12} presentation="equal-height-columns"', 'columns={12}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('span={4} className="grid grid-cols-1"', 'span={4}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('span={4} className="grid grid-cols-1"', 'span={4} className="grid"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('span={4} className="grid grid-cols-1"', 'span={4} className="grid grid-cols-1 h-[600px]"')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('className="scroll-mt-28">{socialImageField}', 'className="scroll-mt-28 h-full">{socialImageField}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{canonicalField}', '<div className="h-16" />{canonicalField}')) &&
    !hasCanonicalPanelSeoSections(source.shared.replace('{socialImageAltField}', '<div className="h-16" />{socialImageAltField}')),
);
check(
  "Panel SEO labels and helper copy explicitly use existing shared text-inset owners while Premium retains leading-icon labels",
  source.shared.includes('adminFormLabelClassName({ textInset: panel })') &&
    source.shared.includes('{panel ? <span data-admin-form-label-text>{label}</span> : premium ? <AdminFormControlHeader') &&
    source.shared.includes('${panel ? ADMIN_FORM.helperTextInset : ""}') &&
    (source.shared.match(/labelClassName=\{panel \? adminFormLabelClassName\(\{ textInset: true \}\) : undefined\}/gu) ?? []).length === 2 &&
    source.shared.includes('helperClassName={panel ? `mt-2 ${adminFormHintClassName({ textInset: true })}` : undefined}') &&
    source.shared.includes('guidanceClassName={panel ? adminFormHintClassName({ textInset: true }) : undefined}') &&
    source.shared.includes('originalDimensionsClassName={panel ? ADMIN_FORM.helperTextInset : undefined}') &&
    !source.shared.includes('panel-v2'),
);
check(
  "negative Premium owner fixtures reject unbound components, default surfaces and submitting correction actions",
  !hasCanonicalPremiumSeoOwners(source.shared.replace('import AdminCard from "../ui/AdminCard";', "")) &&
    !hasCanonicalPremiumSeoOwners(source.shared.replaceAll('presentation="premium"', 'presentation="default"')) &&
    !hasCanonicalPremiumSeoOwners(source.shared.replace(/(<AdminActionButton\s[^>]*?)type="button"/u, '$1type="submit"')),
);
const presentationInitializer = defaultPresentationContract.initializer;
const eligibleSeoAdapterFiles = [...new Set(ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.filter((entry) =>
  entry.surfaceKind === "entity_seo_editor" && entry.classification === "adopted",
).flatMap((entry) => entry.sourceFiles))].filter((file) => seoAdapterPresentationCalls(file, read(file)).length > 0);
check(
  "negative presentation fixtures reject changed shared defaults and missing, default or parallel-owner opt-ins for every eligible adapter",
  presentationInitializer &&
    !seoPresentationDefault(source.shared.slice(0, presentationInitializer.getStart(defaultPresentationContract.tree)) +
      '"premium"' + source.shared.slice(presentationInitializer.getEnd())).valid &&
    eligibleSeoAdapterFiles.length > 0 && eligibleSeoAdapterFiles.every((file) => {
      const adapter = read(file);
      const panelAdapter = file === paths.topic || file === paths.page || file === paths.project;
      const expected = panelAdapter ? 'presentation="panel"' : file === paths.media ? 'presentation={presentation ?? (contentType === "video" ? "panel" : "premium")}' : 'presentation="premium"';
      return !hasAllEligiblePremiumSeoPresentation({ [file]: adapter.replace(expected, "") }) &&
        !hasAllEligiblePremiumSeoPresentation({ [file]: adapter.replace(expected, 'presentation="default"') }) &&
        !hasAllEligiblePremiumSeoPresentation({ [file]: adapter.replace(expected, panelAdapter ? 'presentation="premium"' : 'presentation="panel"') }) &&
        !hasAllEligiblePremiumSeoPresentation({ [file]: adapter.replace("/seo/AdminEntitySeoPanel", "/seo/ParallelSeoPanel") });
    }),
);
check(
  "negative Media SEO fixtures reject changed defaults, inverted adoption, forced Panel scope and lost explicit forwarding",
  !hasAllEligiblePremiumSeoPresentation({ [paths.media]: source.media.replace('contentType === "video" ? "panel" : "premium"', 'contentType === "gallery" ? "panel" : "premium"') }) &&
    !hasAllEligiblePremiumSeoPresentation({ [paths.media]: source.media.replace('contentType === "video" ? "panel" : "premium"', 'contentType === "video" ? "premium" : "panel"') }) &&
    !hasAllEligiblePremiumSeoPresentation({ [paths.media]: source.media.replace('presentation={presentation ?? (contentType === "video" ? "panel" : "premium")}', 'presentation="panel"') }) &&
    !hasAllEligiblePremiumSeoPresentation({ [paths.media]: source.media.replace('presentation={presentation ?? (contentType === "video" ? "panel" : "premium")}', 'presentation={contentType === "video" ? "panel" : "premium"}') }),
);
check(
  "Premium SEO adopts the same canonical card media icon actions and preview owner as Blocks while retaining the standalone native Alt contract",
  hasCanonicalPremiumSeoMedia(source.shared),
);
check(
  "negative media fixtures reject legacy selected actions, local lifecycle overrides, coupled Alt clearing and a non-card Blocks reference",
  !hasCanonicalPremiumSeoMedia(source.shared.replace('variant={premium ? "card" : undefined}', 'variant={premium ? "compact" : undefined}')) &&
    !hasCanonicalPremiumSeoMedia(source.shared.replace('variant={premium ? "card" : undefined}', 'variant={premium ? "card" : undefined} allowRemove={false}')) &&
    !hasCanonicalPremiumSeoMedia(source.shared.replace('variant={premium ? "card" : undefined}', 'variant={premium ? "card" : undefined} altName={fieldNames.ogImageAlt}')) &&
    !hasCanonicalPremiumSeoMedia(source.shared.replace('setObservedLive((current) => ({ ...current, ogImage }))', 'setObservedLive((current) => ({ ...current, ogImage: "" }))')) &&
    !hasCanonicalPremiumSeoMedia(source.shared, source.mediaImage.replace('size="icon" variant="gold"', 'size="sm" variant="gold"')) &&
    !hasCanonicalPremiumSeoMedia(source.shared, source.mediaImage.replace('action="delete" size="md"', 'action="restore" size="md"')) &&
    !hasCanonicalPremiumSeoMedia(source.shared, source.mediaImage, source.mediaReference.replace('variant="card"', 'variant="compact"')),
);
check(
  "Page SEO uses the canonical presentation-only footer around its unchanged native submit action within the shared pending field scope",
  hasNativePageSeoFooter(source.page),
);
check(
  "negative Page footer fixtures reject parallel owners, changed save actions, non-submit buttons and an unprotected footer",
  !hasNativePageSeoFooter(source.page.replace('/ui/AdminForm"', '/ui/ParallelFormBar"')) &&
    !hasNativePageSeoFooter(source.page.replace("action={savePageSeoAction}", "action={parallelPageSave}")) &&
    !hasNativePageSeoFooter(source.page.replace('type="submit"', 'type="button"')) &&
    !hasNativePageSeoFooter(source.page.replace('type="submit"', 'type="submit" formAction={parallelPageSave}')) &&
    !hasNativePageSeoFooter(source.page.replace('<AdminFormPendingFields className="min-w-0">', '<div className="min-w-0">').replace("</AdminFormPendingFields>", "</div>")) &&
    !hasNativePageSeoFooter(source.page.replace('title="إجراءات النموذج"', 'title="حفظ إعدادات السيو"')) &&
    !hasNativePageSeoFooter(source.page.replace('icon={<AdminModuleTabIcon name="content" />}', 'icon={null}')) &&
    !hasNativePageSeoFooter(source.page.replace('<div className={ADMIN_FORM_STACK_CLASS_NAME}>', '<div className="contents">')),
);

check(
  "Page SEO adopts the shared Site Settings title template and current Page Composition copy",
  source.page.includes("seoTitleSuffix={props.titleSuffix}") &&
    source.page.includes('name="page_content" value={props.content}') &&
    source.page.includes("content: props.content") &&
    pageClient.includes("content={seo.content}") &&
    pageClient.includes("titleSuffix={seo.titleSuffix}") &&
    pageRoute.includes("getSeoTitleSuffix(globalSeo)") &&
    pageRoute.includes("assignmentsData.seoContent") &&
    pageAdminQueries.includes("extractPageBlockSeoText") &&
    pageAdminQueries.includes("isPageModulePubliclyVisible"),
);

check(
  "one SEO metadata owner composes the final title without a persisted parallel template",
  seoUtils.includes("export function getSeoTitleSuffix") &&
    seoUtils.includes("export function composeSeoTitle") &&
    seoResolver.includes("getSeoTitleSuffix(global)") &&
    seoResolver.includes("composeSeoTitle(") &&
    source.shared.includes("data-admin-seo-title-template") &&
    source.shared.includes("effectiveSeoTitle"),
);

check(
  "the historical entity-fallback presentation contract is removed",
  !source.shared.includes("entity_fallback") &&
    !source.topic.includes("entity_fallback") &&
    !source.shared.includes("data-admin-entity-seo-social-source") &&
    occurrences(source.shared, "<AdminMediaImageField") === 1 &&
    source.shared.includes("name={fieldNames.ogImage}") &&
    source.shared.includes("name={fieldNames.ogImageAlt}"),
);

check(
  "Open Graph preview uses explicit override, entity image, then the actual resolved fallback",
  source.shared.includes("const previewImage =") &&
    source.shared.includes("live.ogImage.trim()") &&
    source.shared.includes("live.image.trim()") &&
    source.shared.includes("resolvedFallback?.image") &&
    source.shared.includes("live.ogImageAlt.trim()") &&
    source.shared.includes("resolvedFallback?.imageAlt") &&
    source.shared.includes("url(${previewImage})") &&
    source.shared.includes("aria-label={previewImageAlt || title}"),
);

const persistenceFiles = [
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/media-actions/helpers.ts"),
  read("src/app/admin/pages-blocks/pages/page-seo-actions.ts"),
  read("src/lib/admin/projects/project-entry-contract.ts"),
];
check(
  "every save owner reads or validates the shared persistence contract without a parallel field parser",
  persistenceFiles.every((file) => file.includes("readEntitySeoFormData")) &&
    persistenceFiles.every((file) => file.includes("validateEntitySeoValues") || file.includes("toEntitySeoPersistence")) &&
    persistenceFiles.slice(0, 3).every((file) => file.includes("toEntitySeoPersistence")),
);

const resolver = read("src/lib/seo/resolve-seo-metadata.ts");
const generator = read("src/lib/seo/generate-public-metadata.ts");
check(
  "public metadata has one EntitySeoData contract and no Page-specific parallel resolver contract",
  !source.contract.includes("PageSeoData") &&
    !source.contract.includes("pageSeo?:") &&
    !resolver.includes("input.pageSeo") &&
    generator.includes("mergeEntitySeoData(input.entitySeo, pageSeo)") &&
    resolver.includes("const entityOgImage = pickString(input.entitySeo?.ogImage)") &&
    resolver.indexOf("const entityOgImage") < resolver.indexOf("const specificImage") &&
    resolver.includes("entityOgImage,"),
);

check(
  "Topic, Project, Page, and Media public routes expose explicit OG alt, canonical, and robots through the shared resolver",
  read("src/app/(site)/topics/[slug]/page.tsx").includes("ogImageAlt: topic.ogImage") &&
    read("src/app/(site)/projects/[slug]/page.tsx").includes("ogImageAlt: project.seo.ogImage?.alt") &&
    read("src/app/(site)/[...slug]/page.tsx").includes("entitySeoDataFromPersistence(page)") &&
    ["canonical: item.canonicalUrl", "robotsIndex: item.robotsIndex", "robotsFollow: item.robotsFollow", "ogImageAlt: item.ogImageAlt"].every(
      (token) => read("src/lib/media-center/generate-media-detail-metadata.ts").includes(token),
    ),
);

check(
  "the shared Search Preview still owns canonical, title, description, Index, and Follow presentation",
  ["{canonical}", "{title}", "{description}", 'label="Robots"', 'label="Links"'].every(
    (token) => source.shared.includes(token),
  ) && source.shared.includes('data-admin-seo-control-order="index-follow-canonical"'),
);

check(
  "the canonical 45-60 and 120-160 standards drive presentation and affected validation",
  source.contract.includes("min: 45, max: 60") &&
    source.contract.includes("min: 120, max: 160") &&
    read("src/lib/admin/seo-length-standards.ts").includes("ENTITY_SEO_LIMITS") &&
    !read("src/app/admin/content/topics/article-actions/save.ts").includes("> 70") &&
    !read("src/lib/admin/content-workflow/topic-publish-validation.ts").includes("<= 170"),
);

check(
  "the shared owner remains form-neutral and owns the one accordion preview/analysis disclosure",
  !source.shared.includes("<form") &&
    occurrences(source.shared, "<AdminSingleOpenAccordion") === 1 &&
    source.shared.includes("search-result-preview") &&
    source.shared.includes("open-graph-preview") &&
    source.shared.includes("live-seo-analysis"),
);

check(
  "correction buttons remain non-submitting and provide shared focus fallback after navigation",
  source.shared.includes('type="button"') &&
    source.shared.includes("new CustomEvent(navigationEventName") &&
    source.shared.includes("document.getElementById(target.targetId)") &&
    source.shared.includes("focus({ preventScroll: true })"),
);

check(
  "all eligible entity editors are closed while non-entity SEO utilities remain explicit exceptions",
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.globalClosed === true &&
    ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.allowedClaim === "eligible_entity_seo_capability_closed" &&
    !ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some((entry) => entry.classification === ("legacy_generic_gap" as never)) &&
    ["topic-article-seo", "project-seo", "page-seo", "media-topic-seo"].every((id) =>
      ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some((entry) => entry.id === id && entry.classification === "adopted"),
    ) &&
    ["global-seo-settings", "seo-redirects", "sitemap-monitor", "category-series-seo"].every((id) =>
      ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some((entry) => entry.id === id && entry.classification !== "adopted"),
    ),
);

check(
  "every recorded manifest source exists",
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.every((entry) =>
    entry.sourceFiles.every((sourceFile) => existsSync(sourceFile)),
  ),
);

const formData = new FormData();
formData.set(ENTITY_SEO_FIELD_NAMES.seoTitle, "  عنوان موحّد  ");
formData.set(ENTITY_SEO_FIELD_NAMES.seoDescription, "  وصف موحّد  ");
formData.set(ENTITY_SEO_FIELD_NAMES.focusKeyword, "  كلمة  ");
formData.set(ENTITY_SEO_FIELD_NAMES.seoKeywords, "alpha، beta, alpha");
formData.set(ENTITY_SEO_FIELD_NAMES.canonicalUrl, "https://example.com/entity");
formData.set(ENTITY_SEO_FIELD_NAMES.robotsIndex, "false");
formData.set(ENTITY_SEO_FIELD_NAMES.robotsFollow, "true");
formData.set(ENTITY_SEO_FIELD_NAMES.ogImage, "/images/entity-og.jpg");
formData.set(ENTITY_SEO_FIELD_NAMES.ogImageAlt, "  صورة المشاركة  ");
const parsed = readEntitySeoFormData(formData);
const persisted = toEntitySeoPersistence(parsed);
check(
  "the shared form and persistence contract normalizes all nine fields once",
  parsed.seoTitle === "عنوان موحّد" &&
    parsed.seoKeywords.join("|") === "alpha|beta" &&
    persisted.canonical_url === "https://example.com/entity" &&
    persisted.robots_index === false &&
    persisted.robots_follow === true &&
    persisted.og_image === "/images/entity-og.jpg" &&
    persisted.og_image_alt === "صورة المشاركة",
);

check(
  "the shared validator rejects invalid canonical and an OG override without alt text",
  validateEntitySeoValues({
    ...parsed,
    canonicalUrl: "/relative-path",
    ogImageAlt: "",
  }).some((issue) => issue.field === ENTITY_SEO_FIELD_NAMES.canonicalUrl) &&
    validateEntitySeoValues({
      ...parsed,
      canonicalUrl: "",
      ogImageAlt: "",
    }).some((issue) => issue.field === ENTITY_SEO_FIELD_NAMES.ogImageAlt),
);

const database = await PGlite.create();
try {
  await database.exec(`
    create schema if not exists public;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create table public.topic_categories (
      id bigint primary key,
      name text,
      slug text,
      color_token text
    );
    create table public.topic_series (
      id bigint primary key,
      name text,
      slug text
    );
    create table public.admin_users (
      id bigint primary key,
      full_name text,
      email text
    );
    create table public.topics (
      id bigint primary key,
      slug text,
      title text not null,
      excerpt text,
      content text,
      image text,
      image_alt text,
      category_id bigint,
      series_id bigint,
      content_type text,
      media_payload jsonb,
      status text,
      is_featured boolean,
      is_popular boolean,
      published_at timestamptz,
      created_at timestamptz,
      updated_at timestamptz,
      created_by bigint,
      updated_by bigint,
      published_by bigint,
      views_count bigint,
      deleted_at timestamptz,
      seo_title text,
      seo_description text,
      focus_keyword text,
      seo_keywords jsonb default '[]'::jsonb,
      canonical_url text,
      robots_index boolean,
      robots_follow boolean,
      faq jsonb,
      date_label text
    );
    create table public.pages (
      id bigint primary key,
      title text not null,
      seo_title text,
      seo_description text,
      seo_keywords jsonb default '[]'::jsonb
    );
    create view public.admin_content_topics
    with (security_invoker = true)
    as
    select topics.id, topics.slug, topics.title, topics.seo_keywords
    from public.topics topics;
    grant all on public.admin_content_topics to anon, authenticated, service_role;
    insert into public.topics (
      id, slug, title, image_alt, seo_title, seo_description, focus_keyword,
      seo_keywords, canonical_url, robots_index, robots_follow
    ) values (
      1, 'topic-fallback', 'Topic fallback', 'Topic image alt', repeat('T', 61),
      repeat('D', 161), null, '["alpha", "beta"]'::jsonb, '/invalid', null, false
    );
    insert into public.pages (id, title, seo_title, seo_description, seo_keywords)
    values (1, 'Page fallback', null, null, '["gamma"]'::jsonb);
  `);
  await database.exec(source.migration);

  const columns = await database.query<{ table_name: string; column_name: string; data_type: string }>(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('topics', 'pages')
      and column_name in ('seo_keywords', 'focus_keyword', 'canonical_url', 'robots_index', 'robots_follow', 'og_image', 'og_image_alt')
  `);
  const keywordColumns = columns.rows.filter((column) => column.column_name === "seo_keywords");
  const topic = await database.query<{
    seo_title: string;
    seo_description: string;
    seo_keywords: string[];
    canonical_url: string | null;
  }>("select seo_title, seo_description, seo_keywords, canonical_url from public.topics where id = 1");
  const page = await database.query<{ focus_keyword: string; seo_keywords: string[]; og_image_alt: string }>(
    "select focus_keyword, seo_keywords, og_image_alt from public.pages where id = 1",
  );
  const viewColumns = await database.query<{ column_name: string }>(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_content_topics'
  `);

  check(
    "the migration executes against the historical Topic and Page schemas and produces one SQL contract",
    keywordColumns.length === 2 &&
      keywordColumns.every((column) => column.data_type === "ARRAY") &&
      columns.rows.filter((column) => column.column_name !== "seo_keywords").length === 12 &&
      topic.rows[0]?.seo_title.length === 60 &&
      topic.rows[0]?.seo_description.length === 160 &&
      topic.rows[0]?.seo_keywords.join("|") === "alpha|beta" &&
      topic.rows[0]?.canonical_url === null &&
      page.rows[0]?.focus_keyword === "" &&
      page.rows[0]?.seo_keywords.join("|") === "gamma" &&
      page.rows[0]?.og_image_alt === "" &&
      ["seo_title", "seo_description", "focus_keyword", "seo_keywords", "canonical_url", "robots_index", "robots_follow", "og_image", "og_image_alt"].every(
        (column) => viewColumns.rows.some((viewColumn) => viewColumn.column_name === column),
      ),
  );

  await assert.rejects(
    database.exec("update public.pages set og_image = '/images/page.jpg', og_image_alt = '' where id = 1"),
  );
  check("the migrated database enforces paired Open Graph image alt text", true);
} finally {
  await database.close();
}

console.log(`\n${passed}/${passed} shared Entity SEO capability checks passed.`);
