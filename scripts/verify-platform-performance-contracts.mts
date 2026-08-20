import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

import { parseTypeScriptSource } from "./lib/typescript-executable-graph.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parse(sourceFile: string) {
  return parseTypeScriptSource(
    sourceFile,
    readFileSync(resolve(root, sourceFile), "utf8"),
  );
}

function findVariable(source: ts.SourceFile, name: string) {
  let result: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (result) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      result = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (result) return result;
  assert.fail(`${source.fileName} must declare ${name}`);
}

function findFunction(source: ts.SourceFile, name: string) {
  const declaration = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration?.body, `${source.fileName} must declare ${name}`);
  return declaration;
}

function descendants(node: ts.Node) {
  const result: ts.Node[] = [];
  const visit = (current: ts.Node) => {
    result.push(current);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return result;
}

function propertyAssignment(
  object: ts.ObjectLiteralExpression,
  name: string,
) {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === name) ||
        (ts.isStringLiteral(property.name) && property.name.text === name)),
  );
}

function runtimeImports(source: ts.SourceFile) {
  return source.statements
    .filter(ts.isImportDeclaration)
    .filter((declaration) => !declaration.importClause?.isTypeOnly)
    .map((declaration) => {
      assert.ok(ts.isStringLiteral(declaration.moduleSpecifier));
      return declaration.moduleSpecifier.text;
    });
}

function jsxElementNames(source: ts.SourceFile) {
  return new Set(
    descendants(source)
      .filter(
        (
          node,
        ): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement =>
          ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
      )
      .map((element) =>
        ts.isIdentifier(element.tagName) ? element.tagName.text : null,
      )
      .filter((name): name is string => name !== null),
  );
}

const rootLayout = parse("src/app/layout.tsx");
const ibmArabic = findVariable(rootLayout, "ibmArabic");
assert.ok(
  ibmArabic.initializer && ts.isCallExpression(ibmArabic.initializer),
  "The Arabic font owner must execute localFont",
);
const fontConfig = ibmArabic.initializer.arguments[0];
assert.ok(
  fontConfig && ts.isObjectLiteralExpression(fontConfig),
  "The Arabic font owner must expose an explicit config",
);
const preload = propertyAssignment(fontConfig, "preload");
assert.ok(
  preload && preload.initializer.kind === ts.SyntaxKind.FalseKeyword,
  "The multi-weight Arabic font must explicitly disable global preload",
);

const hero = parse("src/components/sections/DynamicHeroSection.tsx");
const transparentFallback = findVariable(hero, "TRANSPARENT_IMAGE_FALLBACK");
assert.ok(
  transparentFallback.initializer && ts.isStringLiteral(transparentFallback.initializer),
  "The art-directed hero must own an explicit transparent fallback",
);
const heroNodes = descendants(hero);
assert.ok(
  heroNodes.some(
    (node) =>
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "src" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "TRANSPARENT_IMAGE_FALLBACK",
  ),
  "Art-directed hero images must execute the transparent fallback binding",
);
const common = findVariable(hero, "common");
assert.ok(common.initializer && ts.isObjectLiteralExpression(common.initializer));
for (const propertyName of ["fetchPriority", "loading"] as const) {
  const property = propertyAssignment(common.initializer, propertyName);
  assert.ok(
    property && ts.isConditionalExpression(property.initializer),
    `Hero ${propertyName} intent must be an explicit runtime branch`,
  );
}
assert.ok(
  heroNodes.some(
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "preparedSlideIndexes" &&
      node.expression.name.text === "has",
  ),
  "Home hero must execute its explicit prepared-slide set",
);
assert.ok(
  !heroNodes.some(
    (node) =>
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Math" &&
      node.name.text === "abs",
  ),
  "Home hero must not infer preparation from numeric index distance",
);

const adminAccess = parse("src/components/admin/AdminAccessLayout.tsx");
const authenticatedLayout = findVariable(adminAccess, "AdminAuthenticatedLayout");
assert.ok(
  authenticatedLayout.initializer && ts.isCallExpression(authenticatedLayout.initializer),
  "Admin access must bind its authenticated owner through dynamic()",
);
const [loader, dynamicOptions] = authenticatedLayout.initializer.arguments;
assert.ok(
  loader &&
    ts.isArrowFunction(loader) &&
    ts.isCallExpression(loader.body) &&
    loader.body.expression.kind === ts.SyntaxKind.ImportKeyword &&
    loader.body.arguments[0] &&
    ts.isStringLiteral(loader.body.arguments[0]) &&
    loader.body.arguments[0].text === "./AdminAuthenticatedLayout",
  "Admin access must dynamically bind AdminAuthenticatedLayout",
);
assert.ok(dynamicOptions && ts.isObjectLiteralExpression(dynamicOptions));
const ssr = propertyAssignment(dynamicOptions, "ssr");
assert.ok(
  ssr && ssr.initializer.kind === ts.SyntaxKind.FalseKeyword,
  "The authenticated Admin graph must explicitly disable SSR at its access boundary",
);
const accessImports = runtimeImports(adminAccess);
for (const forbidden of [
  "./AdminShell",
  "./AdminFeedbackProvider",
  "./entity-list/AdminEntityListQueryProvider",
]) {
  assert.ok(
    !accessImports.includes(forbidden),
    `Admin access must not statically import ${forbidden}`,
  );
}

const adminAuthenticated = parse(
  "src/components/admin/AdminAuthenticatedLayout.tsx",
);
const authenticatedOwners = jsxElementNames(adminAuthenticated);
for (const owner of [
  "AdminEntityListQueryProvider",
  "AdminFeedbackProvider",
  "AdminShell",
]) {
  assert.ok(
    authenticatedOwners.has(owner),
    `Authenticated Admin routes must execute ${owner}`,
  );
}

for (const sourceFile of [
  "src/app/admin/error.tsx",
  "src/app/admin/loading.tsx",
  "src/app/admin/not-found.tsx",
]) {
  const boundaryImports = runtimeImports(parse(sourceFile));
  assert.ok(
    !boundaryImports.includes("../../components/admin/ui"),
    `${sourceFile} must not execute the Admin UI barrel`,
  );
  assert.ok(
    boundaryImports.includes("../../components/admin/ui/AdminPageContextHeader") &&
      boundaryImports.includes("../../components/admin/ui/AdminPageExperience"),
    `${sourceFile} must explicitly bind the lightweight Admin boundary owners`,
  );
}

const projects = parse("src/lib/projects/load-published-projects.ts");
const aggregateSelector = findFunction(projects, "selectPublicProjectAggregate");
assert.ok(
  descendants(aggregateSelector).some(
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "select" &&
      node.arguments[0] &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === "PUBLIC_PROJECT_AGGREGATE_COLUMNS",
  ),
  "Project detail reads must execute the aggregate column owner",
);
const aggregateMapper = findFunction(projects, "mapLoadedProjectAggregate");
const mapperNodes = descendants(aggregateMapper);
const mappedProjectRelations = new Set(
  mapperNodes
    .filter(
      (node): node is ts.PropertyAccessExpression =>
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "project",
    )
    .map((node) => node.name.text),
);
for (const relation of [
  "governorate",
  "city",
  "main_area",
  "sub_area",
  "location_points",
  "features",
  "floor_plans",
  "delivery_items",
  "media",
  "videos",
]) {
  assert.ok(
    mappedProjectRelations.has(relation),
    `Project aggregate mapping must execute ${relation}`,
  );
}
assert.ok(
  !mapperNodes.some(
    (node) =>
      ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "Promise" &&
        node.expression.name.text === "all") ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "from")),
  ),
  "Project detail mapping must not execute child reads",
);

console.log("Executable platform performance contracts passed.");
