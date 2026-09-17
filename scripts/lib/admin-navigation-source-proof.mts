import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as ts from "typescript";
import type { AdminCollectionSurfaceInventoryEntry } from "../../src/lib/admin/interaction-system/adoption-manifest.ts";
import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
  parseTypeScriptSource,
  type ExecutableSourceGraph,
  type SourceOverrides,
} from "./typescript-executable-graph.mts";

const CONTROLLER = "src/lib/admin/entity-list/data-engine/client-controller.ts";
const PAGINATION = "src/components/admin/ui/AdminTablePagination.tsx";
const REGISTRY = "src/lib/admin/entity-list/data-engine/registry.ts";
type JsxElement = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
type FunctionBody = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrap(node.expression) : node;
}

function property(object: ts.ObjectLiteralExpression, name: string) {
  const member = object.properties.find((entry) => ts.isPropertyAssignment(entry) && entry.name.getText() === name);
  return member && ts.isPropertyAssignment(member) ? unwrap(member.initializer) : undefined;
}

function enclosingFunction(node: ts.Node): FunctionBody | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isArrowFunction(parent)) return parent;
  }
}

function jsxAttribute(element: JsxElement, name: string) {
  const attribute = element.attributes.properties.find((entry) => ts.isJsxAttribute(entry) && entry.name.getText() === name);
  return attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)
    ? attribute.initializer.expression : undefined;
}

function returnedElements(fn: FunctionBody): JsxElement[] {
  const elements: JsxElement[] = [];
  const collect = (expression: ts.Node) => walk(expression, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
  });
  if (!fn.body) return elements;
  if (!ts.isBlock(fn.body)) collect(fn.body);
  else {
    const visit = (node: ts.Node) => {
      if (ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) collect(node.expression);
      else ts.forEachChild(node, visit);
    };
    ts.forEachChild(fn.body, visit);
  }
  return elements;
}

function pageFiles(root: string): string[] {
  const visit = (directory: string): string[] => readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const name = `${directory}/${entry.name}`;
    return entry.isDirectory() ? visit(name) : /^page\.(?:tsx?|jsx?)$/.test(entry.name) ? [name] : [];
  });
  return visit("src/app/admin");
}

/** Static adoption proof only. It neither imports adapters nor reads live data. */
export function collectAdminNavigationAdoptionFailures(input: {
  root: string;
  surfaces: readonly AdminCollectionSurfaceInventoryEntry[];
  sourceOverrides?: SourceOverrides;
  pageSourceFiles?: readonly string[];
}): string[] {
  const failures: string[] = [];
  const read = (file: string) => input.sourceOverrides?.get(file) ?? readFileSync(join(input.root, file), "utf8");
  const parse = (file: string) => parseTypeScriptSource(file, read(file));
  const registry = parse(REGISTRY);
  let registryEntities: string[] = [];
  walk(registry, (node) => {
    if (!ts.isVariableDeclaration(node) || node.name.getText() !== "adminEntityListAdapterRegistry" || !node.initializer) return;
    const value = unwrap(node.initializer);
    if (ts.isObjectLiteralExpression(value)) registryEntities = value.properties.map((entry) =>
      entry.name && (ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)) ? entry.name.text : "");
  });
  const surfaces = input.surfaces.filter((surface) => surface.queryMode === "server-page" && surface.dataRegistryEntities.length > 0);
  const sameSet = (left: readonly string[], right: readonly string[]) =>
    [...new Set(left)].sort().join("\n") === [...new Set(right)].sort().join("\n");
  if (!registryEntities.length || !sameSet(registryEntities, surfaces.flatMap((surface) => surface.dataRegistryEntities))) failures.push("navigation:registry_coverage");
  for (const surface of input.surfaces) {
    const declaration = surface.navigationPrefetch;
    if (!surfaces.includes(surface)) {
      if (declaration) failures.push(`${surface.id}:navigation_not_applicable`);
      continue;
    }
    if (!declaration) {
      failures.push(`${surface.id}:navigation_declaration_missing`);
      continue;
    }
    if (declaration.intent.state === "deferred" && !declaration.intent.reason.trim()) failures.push(`${surface.id}:intent_deferred_reason`);
    if (declaration.adjacent.state === "deferred" && !declaration.adjacent.reason.trim()) failures.push(`${surface.id}:adjacent_deferred_reason`);
    if (declaration.adjacent.state === "immediate_next" && declaration.intent.state !== "adopted") failures.push(`${surface.id}:adjacent_requires_intent`);
  }

  const resolveImport = (from: string, specifier: string) => {
    if (!specifier.startsWith(".")) return undefined;
    const base = relative(input.root, resolve(input.root, dirname(from), specifier)).replaceAll("\\", "/");
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
      .find((file) => input.sourceOverrides?.has(file) || existsSync(join(input.root, file)));
  };
  function staticStrings(expression: ts.Expression, scope: ts.Node, parsed: ts.SourceFile, seen = new Set<string>(), selectedMember?: string): string[] | undefined {
    const value = unwrap(expression);
    if (ts.isStringLiteral(value)) return selectedMember === undefined ? [value.text] : undefined;
    if (ts.isObjectLiteralExpression(value)) {
      if (selectedMember !== undefined) {
        const member = value.properties.find((entry) => ts.isPropertyAssignment(entry) &&
          (ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)) && entry.name.text === selectedMember);
        return member && ts.isPropertyAssignment(member) ? staticStrings(member.initializer, scope, parsed, seen) : undefined;
      }
      const values = value.properties.map((entry) => ts.isPropertyAssignment(entry) ? staticStrings(entry.initializer, scope, parsed, seen) : undefined);
      return values.every((entry) => entry !== undefined) ? values.flat() as string[] : undefined;
    }
    if (ts.isPropertyAccessExpression(value)) return selectedMember === undefined
      ? staticStrings(value.expression, scope, parsed, seen, value.name.text) : undefined;
    if (ts.isElementAccessExpression(value)) return selectedMember === undefined
      ? staticStrings(value.expression, scope, parsed, seen, ts.isStringLiteral(value.argumentExpression) ? value.argumentExpression.text : undefined) : undefined;
    if (!ts.isIdentifier(value)) return undefined;
    const identity = `${parsed.fileName}:${value.text}`;
    if (seen.has(identity)) return undefined;
    const nextSeen = new Set([...seen, identity]);
    let initializer: ts.Expression | undefined;
    walk(scope, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === value.text) initializer = node.initializer;
    });
    if (initializer) return staticStrings(initializer, scope, parsed, nextSeen, selectedMember);
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const binding = bindings.elements.find((entry) => entry.name.text === value.text);
      if (!binding) continue;
      const file = resolveImport(parsed.fileName, statement.moduleSpecifier.text);
      if (!file) return undefined;
      const imported = parse(file);
      const name = ts.factory.createIdentifier(binding.propertyName?.text ?? binding.name.text);
      return staticStrings(name, imported, imported, nextSeen, selectedMember);
    }
  }

  const emptySource = parseTypeScriptSource("empty.ts", "");
  const pages = input.pageSourceFiles ?? pageFiles(input.root);
  const seenPages = new Set<string>();
  for (const page of pages) {
    const graph = collectExecutableSourceGraph({ root: input.root, entrySourceFiles: [page], sourceOverrides: input.sourceOverrides,
      traversalBoundarySourceFiles: [CONTROLLER, PAGINATION, REGISTRY], symbolAware: true });
    const bindingCache = new Map<string, boolean>();
    // Retain the actual function context: a fabricated import/call would erase
    // parameter/local shadows and dead branches. Sibling exports cannot supply
    // this consumer's proof; a private wrapper retains its real caller as well.
    const contextUsesCanonicalImport = (file: string, parsed: ts.SourceFile, localName: string, owner: string, exportedName: string, functions: readonly FunctionBody[]) => {
      const key = `${file}:${localName}:${owner}:${functions.map((fn) => `${fn.pos}:${fn.end}`).join(",")}`;
      if (bindingCache.has(key)) return bindingCache.get(key)!;
      const importName = localName.split(".")[0];
      const importNode = parsed.statements.find((node) => ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly &&
        (node.importClause?.name?.text === importName || (node.importClause?.namedBindings &&
          (ts.isNamespaceImport(node.importClause.namedBindings) ? node.importClause.namedBindings.name.text === importName :
            node.importClause.namedBindings.elements.some((entry) => !entry.isTypeOnly && entry.name.text === importName)))));
      if (!importNode || !ts.isImportDeclaration(importNode) || !importNode.importClause) return false;
      const clause = importNode.importClause;
      const bindings = clause.namedBindings;
      const selectedBindings = bindings && (ts.isNamespaceImport(bindings)
        ? bindings.name.text === importName ? bindings : undefined
        : ts.factory.updateNamedImports(bindings, bindings.elements.filter((entry) => entry.name.text === importName)));
      const selectedImport = ts.factory.updateImportDeclaration(importNode, importNode.modifiers,
        ts.factory.updateImportClause(clause, clause.isTypeOnly, clause.name?.text === importName ? clause.name : undefined, selectedBindings),
        importNode.moduleSpecifier, importNode.attributes);
      const contextStatements = new Set<ts.Statement>();
      for (const fn of functions) {
        let statement: ts.Node = fn;
        while (statement.parent && !ts.isSourceFile(statement.parent)) statement = statement.parent;
        if (ts.isStatement(statement) && parsed.statements.includes(statement)) contextStatements.add(statement);
      }
      if (!contextStatements.size) return false;
      const context = ts.factory.updateSourceFile(parsed, [selectedImport,
        ...parsed.statements.filter((statement) => contextStatements.has(statement))]);
      const isolated: ExecutableSourceGraph = new Map([...graph].map(([name]) => [name, name === file ? context : emptySource]));
      const result = graphUsesExecutableBinding({ root: input.root, graph: isolated, sourceOverrides: input.sourceOverrides,
        bindings: [{ sourceFile: owner, exportNames: [exportedName] }] });
      bindingCache.set(key, result);
      return result;
    };
    const matches = surfaces.filter((surface) => surface.pageSourceFiles.includes(page));
    let controllerCount = 0;
    for (const [file, parsed] of graph) {
      if (file === CONTROLLER) continue;
      walk(parsed, (node) => {
        if (!ts.isCallExpression(node) || (!ts.isIdentifier(node.expression) && !ts.isPropertyAccessExpression(node.expression))) return;
        const fn = enclosingFunction(node);
        if (!fn || !contextUsesCanonicalImport(file, parsed, node.expression.getText(parsed), CONTROLLER, "useAdminEntityListController", [fn])) return;
        controllerCount += 1;
        if (matches.length !== 1) { failures.push(`${page}:unregistered_navigation_consumer`); return; }
        const surface = matches[0];
        const prefix = `${surface.id}:${page}:${file}`;
        const declaration = node.parent;
        const options = node.arguments[0] && unwrap(node.arguments[0]);
        if (!fn || !ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name) || !options || !ts.isObjectLiteralExpression(options)) {
          failures.push(`${prefix}:explicit_controller_binding`); return;
        }
        if (!surface.presentationSourceFiles.includes(file)) failures.push(`${prefix}:presentation_owner`);
        const grouped = surface.consumerAdoptionEvidence.filter((consumer) => consumer.pageSourceFile === page);
        const expectedEntities = grouped.length ? grouped.flatMap((consumer) => consumer.dataRegistryEntities) : surface.dataRegistryEntities;
        if (surface.consumerAdoptionEvidence.length && (grouped.length !== 1 || !grouped[0].executableBindings.some((binding) =>
          binding.sourceFile === file && fn.name && binding.exportNames.includes(fn.name.getText(parsed))))) failures.push(`${prefix}:grouped_consumer_binding`);
        const entity = property(options, "entity");
        const actualEntities = entity && staticStrings(entity, fn, parsed);
        if (!actualEntities || !sameSet(actualEntities, expectedEntities)) failures.push(`${prefix}:controller_entity_scope`);
        const policy = surface.navigationPrefetch;
        if (!policy) return;
        const adjacent = property(options, "adjacentPrefetch");
        if (policy.adjacent.state === "immediate_next" ? adjacent?.kind !== ts.SyntaxKind.TrueKeyword : adjacent && adjacent.kind !== ts.SyntaxKind.FalseKeyword) {
          failures.push(`${prefix}:adjacent_owner_option`);
        }
        const controller = declaration.name.text;
        const method = (expression: ts.Expression | undefined, name: string) => expression && ts.isPropertyAccessExpression(unwrap(expression)) &&
          (unwrap(expression) as ts.PropertyAccessExpression).expression.getText(parsed) === controller &&
          (unwrap(expression) as ts.PropertyAccessExpression).name.text === name;
        const candidates: Map<string, ts.Expression>[] = [];
        for (const element of returnedElements(fn)) {
          const tag = element.tagName.getText(parsed);
          if (contextUsesCanonicalImport(file, parsed, tag, PAGINATION, "default", [fn])) {
            candidates.push(new Map(["onPageChange", "onPageSizeChange", "onPageIntent"].flatMap((name) => {
              const value = jsxAttribute(element, name); return value ? [[name, value] as const] : [];
            })));
            continue;
          }
          const wrapper = parsed.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === tag);
          if (!wrapper || !ts.isFunctionDeclaration(wrapper)) continue;
          const parameters = wrapper.parameters[0]?.name;
          if (!parameters || !ts.isObjectBindingPattern(parameters)) continue;
          const forwards = new Map(parameters.elements.filter((entry) => ts.isIdentifier(entry.name)).map((entry) =>
            [entry.name.getText(parsed), entry.propertyName?.getText(parsed) ?? entry.name.getText(parsed)]));
          for (const inner of returnedElements(wrapper)) {
            if (!contextUsesCanonicalImport(file, parsed, inner.tagName.getText(parsed), PAGINATION, "default", [fn, wrapper])) continue;
            const props = new Map<string, ts.Expression>();
            for (const name of ["onPageChange", "onPageSizeChange", "onPageIntent"]) {
              const forwarded = jsxAttribute(inner, name);
              const outerName = forwarded && ts.isIdentifier(forwarded) ? forwards.get(forwarded.text) : undefined;
              const value = outerName && jsxAttribute(element, outerName);
              if (value) props.set(name, value);
            }
            candidates.push(props);
          }
        }
        if (candidates.length !== 1) failures.push(`${prefix}:canonical_pagination_count`);
        for (const props of candidates) {
          if (!method(props.get("onPageChange"), "setPage")) failures.push(`${prefix}:pagination_page_binding`);
          if (!method(props.get("onPageSizeChange"), "setPageSize")) failures.push(`${prefix}:pagination_size_binding`);
          if (policy.intent.state === "adopted" ? !method(props.get("onPageIntent"), "prefetchPage") : props.has("onPageIntent")) failures.push(`${prefix}:pagination_intent_binding`);
        }
        walk(fn, (child) => {
          if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) &&
            (child.expression.name.text === "prefetchQuery" || method(child.expression, "prefetchPage"))) failures.push(`${prefix}:consumer_prediction_owner`);
          if (ts.isNewExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === "QueryClient") failures.push(`${prefix}:consumer_query_client`);
        });
      });
    }
    if (controllerCount) seenPages.add(page);
    if (matches.length && controllerCount !== 1) failures.push(`${page}:registered_controller_count`);
  }
  for (const surface of surfaces) for (const page of surface.pageSourceFiles) {
    // The existing manifest also records shared RSC composition helpers here;
    // only real Next page entries must independently mount a controller.
    if (/(?:^|\/)page\.(?:tsx?|jsx?)$/.test(page) && !seenPages.has(page)) failures.push(`${surface.id}:${page}:controller_unreachable`);
  }
  return [...new Set(failures)];
}
