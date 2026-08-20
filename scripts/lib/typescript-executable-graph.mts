import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import * as ts from "typescript";

export type SourceOverrides = ReadonlyMap<string, string>;

export type ExecutableSourceGraph = ReadonlyMap<string, ts.SourceFile>;

export type ExecutableBinding = {
  sourceFile: string;
  exportNames: readonly string[];
};

export type LocalImplementationKind =
  | "native_form"
  | "native_table"
  | "native_search_input"
  | "native_select"
  | "native_switch"
  | "native_checkbox"
  | "native_date_input"
  | "native_file_input"
  | "native_dialog"
  | "window_confirm"
  | "window_alert"
  | "local_scrollbar_style";

const parsedModuleCache = new Map<string, ts.SourceFile>();
const moduleResolutionCache = new Map<string, string | null>();
const exportBindingCache = new Map<string, boolean>();
const executableExportPathCache = new Map<string, readonly string[]>();

function normalizeSourcePath(sourceFile: string) {
  return sourceFile.replaceAll("\\", "/");
}

function scriptKind(sourceFile: string) {
  if (sourceFile.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (sourceFile.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (sourceFile.endsWith(".mts")) return ts.ScriptKind.TS;
  if (sourceFile.endsWith(".mjs")) return ts.ScriptKind.JS;
  return sourceFile.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

export function parseTypeScriptSource(sourceFile: string, source: string) {
  const parsed = ts.createSourceFile(
    sourceFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(sourceFile),
  );
  const diagnostics =
    (parsed as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const details = diagnostics
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      )
      .join("; ");
    throw new Error(`${sourceFile}: ${details}`);
  }
  return parsed;
}

function parseWorkspaceModule(root: string, sourceFile: string) {
  const normalizedSourceFile = normalizeSourcePath(sourceFile);
  const cacheKey = `${resolve(root)}:${normalizedSourceFile}`;
  const cached = parsedModuleCache.get(cacheKey);
  if (cached) return cached;
  const parsed = parseTypeScriptSource(
    normalizedSourceFile,
    readFileSync(join(root, normalizedSourceFile), "utf8"),
  );
  parsedModuleCache.set(cacheKey, parsed);
  return parsed;
}

function resolveModule(
  root: string,
  importer: string,
  moduleSpecifier: string,
  sourceOverrides?: SourceOverrides,
) {
  if (!moduleSpecifier.startsWith(".")) return null;
  const cacheKey = sourceOverrides
    ? null
    : `${resolve(root)}:${normalizeSourcePath(importer)}:${moduleSpecifier}`;
  if (cacheKey && moduleResolutionCache.has(cacheKey)) {
    return moduleResolutionCache.get(cacheKey) ?? null;
  }
  const absoluteBase = resolve(root, dirname(importer), moduleSpecifier);
  const candidates = extname(absoluteBase)
    ? [absoluteBase]
    : [
        `${absoluteBase}.ts`,
        `${absoluteBase}.tsx`,
        `${absoluteBase}.mts`,
        `${absoluteBase}.js`,
        `${absoluteBase}.jsx`,
        `${absoluteBase}.mjs`,
        join(absoluteBase, "index.ts"),
        join(absoluteBase, "index.tsx"),
        join(absoluteBase, "index.mts"),
        join(absoluteBase, "index.js"),
      ];
  for (const candidate of candidates) {
    const relativeCandidate = normalizeSourcePath(relative(root, candidate));
    if (sourceOverrides?.has(relativeCandidate) || existsSync(candidate)) {
      if (cacheKey) moduleResolutionCache.set(cacheKey, relativeCandidate);
      return relativeCandidate;
    }
  }
  if (cacheKey) moduleResolutionCache.set(cacheKey, null);
  return null;
}

function importLocalNames(node: ts.ImportDeclaration) {
  if (node.importClause?.isTypeOnly) return [];
  const names: string[] = [];
  if (node.importClause?.name) names.push(node.importClause.name.text);
  const bindings = node.importClause?.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings))
    names.push(bindings.name.text);
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      if (!element.isTypeOnly) names.push(element.name.text);
    }
  }
  return names;
}

function nodeContainsRuntimeIdentifier(
  node: ts.Node,
  names: ReadonlySet<string>,
) {
  let found = false;
  const isRuntimeReference = (identifier: ts.Identifier) => {
    for (
      let ancestor: ts.Node | undefined = identifier.parent;
      ancestor;
      ancestor = ancestor.parent
    ) {
      if (ts.isTypeNode(ancestor)) return false;
      if (ts.isStatement(ancestor) || ts.isSourceFile(ancestor)) break;
    }

    const parent = identifier.parent;
    if (
      (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
      ((ts.isPropertyAssignment(parent) ||
        ts.isMethodDeclaration(parent) ||
        ts.isPropertyDeclaration(parent) ||
        ts.isPropertySignature(parent) ||
        ts.isMethodSignature(parent)) &&
        parent.name === identifier) ||
      (ts.isBindingElement(parent) && parent.propertyName === identifier) ||
      (ts.isJsxAttribute(parent) && parent.name === identifier) ||
      (ts.isLabeledStatement(parent) && parent.label === identifier) ||
      (ts.isBreakOrContinueStatement(parent) && parent.label === identifier)
    ) {
      return false;
    }

    return true;
  };
  const visit = (current: ts.Node) => {
    if (found) return;
    if (
      ts.isIdentifier(current) &&
      names.has(current.text) &&
      isRuntimeReference(current)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function importIsExecutable(
  parsed: ts.SourceFile,
  declaration: ts.ImportDeclaration,
) {
  if (!declaration.importClause) return true;
  const names = new Set(importLocalNames(declaration));
  if (names.size === 0) return false;
  return parsed.statements.some(
    (statement) =>
      statement !== declaration &&
      nodeContainsRuntimeIdentifier(statement, names),
  );
}

function declarationExportsName(statement: ts.Statement, exportedName: string) {
  if (
    exportedName === "default" &&
    (ts.isExportAssignment(statement) ||
      ((ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
        statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
        )))
  ) {
    return true;
  }
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name?.text === exportedName &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  ) {
    return true;
  }
  if (
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  ) {
    return statement.declarationList.declarations.some(
      (declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportedName,
    );
  }
  return false;
}

function executableExportPath(input: {
  root: string;
  moduleSourceFile: string;
  exportedName: string;
  seen?: Set<string>;
}): readonly string[] {
  const moduleSourceFile = normalizeSourcePath(input.moduleSourceFile);
  const resolutionKey = `${moduleSourceFile}:${input.exportedName}`;
  const seen = input.seen ?? new Set<string>();
  if (seen.has(resolutionKey)) return [];
  const cacheKey = `${resolve(input.root)}:${resolutionKey}`;
  const cached = executableExportPathCache.get(cacheKey);
  if (cached) return cached;
  seen.add(resolutionKey);
  const absoluteSourceFile = join(input.root, moduleSourceFile);
  if (!existsSync(absoluteSourceFile)) return [];
  const parsed = parseWorkspaceModule(input.root, moduleSourceFile);
  if (
    parsed.statements.some((statement) =>
      declarationExportsName(statement, input.exportedName),
    )
  ) {
    const path = [moduleSourceFile] as const;
    executableExportPathCache.set(cacheKey, path);
    return path;
  }

  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.isTypeOnly ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const dependency = resolveModule(
      input.root,
      moduleSourceFile,
      statement.moduleSpecifier.text,
    );
    if (!dependency) continue;
    const exportedName =
      statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.find(
            (element) =>
              element.name.text === input.exportedName && !element.isTypeOnly,
          )
        : null;
    if (statement.exportClause && !exportedName) continue;
    const dependencyPath = executableExportPath({
      root: input.root,
      moduleSourceFile: dependency,
      exportedName: exportedName
        ? (exportedName.propertyName ?? exportedName.name).text
        : input.exportedName,
      seen,
    });
    if (dependencyPath.length > 0) {
      const path = [moduleSourceFile, ...dependencyPath];
      executableExportPathCache.set(cacheKey, path);
      return path;
    }
  }

  const localExport = parsed.statements
    .filter(ts.isExportDeclaration)
    .flatMap((statement) =>
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      !statement.moduleSpecifier
        ? statement.exportClause.elements
        : [],
    )
    .find(
      (element) =>
        element.name.text === input.exportedName && !element.isTypeOnly,
    );
  if (localExport) {
    const localName = (localExport.propertyName ?? localExport.name).text;
    for (const statement of parsed.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const imported = runtimeImports(statement, parsed).find(
        ({ local }) => local === localName,
      );
      const dependency = resolveModule(
        input.root,
        moduleSourceFile,
        statement.moduleSpecifier.text,
      );
      if (!imported || !dependency) continue;
      const dependencyPath = executableExportPath({
        root: input.root,
        moduleSourceFile: dependency,
        exportedName: imported.exported,
        seen,
      });
      if (dependencyPath.length > 0) {
        const path = [moduleSourceFile, ...dependencyPath];
        executableExportPathCache.set(cacheKey, path);
        return path;
      }
    }
  }
  executableExportPathCache.set(cacheKey, []);
  return [];
}

export function collectExecutableSourceGraph(input: {
  root: string;
  entrySourceFiles: readonly string[];
  sourceOverrides?: SourceOverrides;
}) {
  const graph = new Map<string, ts.SourceFile>();
  const queue = [...new Set(input.entrySourceFiles.map(normalizeSourcePath))];
  while (queue.length > 0) {
    const sourceFile = queue.shift()!;
    if (graph.has(sourceFile)) continue;
    const absoluteSourceFile = join(input.root, sourceFile);
    if (
      !input.sourceOverrides?.has(sourceFile) &&
      !existsSync(absoluteSourceFile)
    ) {
      continue;
    }
    const source =
      input.sourceOverrides?.get(sourceFile) ??
      readFileSync(absoluteSourceFile, "utf8");
    const parsed = input.sourceOverrides
      ? parseTypeScriptSource(sourceFile, source)
      : parseWorkspaceModule(input.root, sourceFile);
    graph.set(sourceFile, parsed);
    for (const statement of parsed.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        importIsExecutable(parsed, statement)
      ) {
        const dependency = resolveModule(
          input.root,
          sourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        );
        if (dependency) {
          if (!graph.has(dependency)) queue.push(dependency);
          for (const imported of runtimeImports(statement, parsed)) {
            for (const executableModule of executableExportPath({
              root: input.root,
              moduleSourceFile: dependency,
              exportedName: imported.exported,
            })) {
              if (!graph.has(executableModule)) queue.push(executableModule);
            }
          }
        }
      }
    }
  }
  return graph;
}

export function graphReachesAnyOwner(
  graph: ExecutableSourceGraph,
  ownerSourceFiles: readonly string[],
) {
  return ownerSourceFiles.some((sourceFile) =>
    graph.has(normalizeSourcePath(sourceFile)),
  );
}

export function registeredSourcesBindOwner(input: {
  root: string;
  graph: ExecutableSourceGraph;
  registeredSourceFiles: readonly string[];
  ownerSourceFiles: readonly string[];
}) {
  const registered = new Set(
    input.registeredSourceFiles.map(normalizeSourcePath),
  );
  const owners = new Set(input.ownerSourceFiles.map(normalizeSourcePath));
  for (const [sourceFile, parsed] of input.graph) {
    if (!registered.has(sourceFile)) continue;
    for (const statement of parsed.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !importIsExecutable(parsed, statement)
      ) {
        continue;
      }
      const dependency = resolveModule(
        input.root,
        sourceFile,
        statement.moduleSpecifier.text,
      );
      if (dependency && owners.has(dependency)) return true;
    }
  }
  return input.registeredSourceFiles.some((sourceFile) =>
    owners.has(normalizeSourcePath(sourceFile)),
  );
}

function runtimeImports(
  declaration: ts.ImportDeclaration,
  parsed: ts.SourceFile,
) {
  if (declaration.importClause?.isTypeOnly) return [];
  const bindings: Array<{ exported: string; local: string }> = [];
  if (declaration.importClause?.name) {
    bindings.push({
      exported: "default",
      local: declaration.importClause.name.text,
    });
  }
  const namedBindings = declaration.importClause?.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      if (!element.isTypeOnly) {
        bindings.push({
          exported: (element.propertyName ?? element.name).text,
          local: element.name.text,
        });
      }
    }
  }
  return bindings.filter(({ local }) =>
    parsed.statements.some(
      (statement) =>
        statement !== declaration &&
        nodeContainsRuntimeIdentifier(statement, new Set([local])),
    ),
  );
}

function moduleExportsBinding(input: {
  root: string;
  moduleSourceFile: string;
  exportedName: string;
  binding: ExecutableBinding;
  seen: Set<string>;
}) {
  const moduleSourceFile = normalizeSourcePath(input.moduleSourceFile);
  const bindingSourceFile = normalizeSourcePath(input.binding.sourceFile);
  const resolutionKey = `${moduleSourceFile}:${input.exportedName}`;
  if (input.seen.has(resolutionKey)) return false;
  const cacheKey = [
    resolve(input.root),
    resolutionKey,
    bindingSourceFile,
    ...input.binding.exportNames,
  ].join("|");
  const cached = exportBindingCache.get(cacheKey);
  if (cached !== undefined) return cached;
  input.seen.add(resolutionKey);
  if (
    moduleSourceFile === bindingSourceFile &&
    input.binding.exportNames.some((name) => name === input.exportedName)
  ) {
    exportBindingCache.set(cacheKey, true);
    return true;
  }
  const absoluteSourceFile = join(input.root, moduleSourceFile);
  if (!existsSync(absoluteSourceFile)) {
    exportBindingCache.set(cacheKey, false);
    return false;
  }
  const parsed = parseWorkspaceModule(input.root, moduleSourceFile);

  for (const statement of parsed.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const dependency = resolveModule(
        input.root,
        moduleSourceFile,
        statement.moduleSpecifier.text,
      );
      if (!dependency) continue;
      if (!statement.exportClause) {
        if (
          moduleExportsBinding({
            ...input,
            moduleSourceFile: dependency,
          })
        ) {
          exportBindingCache.set(cacheKey, true);
          return true;
        }
        continue;
      }
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (element.name.text !== input.exportedName) continue;
          if (
            moduleExportsBinding({
              ...input,
              moduleSourceFile: dependency,
              exportedName: (element.propertyName ?? element.name).text,
            })
          ) {
            exportBindingCache.set(cacheKey, true);
            return true;
          }
        }
      }
    }
  }

  const localExports = parsed.statements
    .filter(ts.isExportDeclaration)
    .flatMap((statement) =>
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      !statement.moduleSpecifier
        ? statement.exportClause.elements
        : [],
    );
  for (const exported of localExports) {
    if (exported.name.text !== input.exportedName) continue;
    const localName = (exported.propertyName ?? exported.name).text;
    for (const statement of parsed.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const imported = runtimeImports(statement, parsed).find(
        ({ local }) => local === localName,
      );
      const dependency = resolveModule(
        input.root,
        moduleSourceFile,
        statement.moduleSpecifier.text,
      );
      if (
        imported &&
        dependency &&
        moduleExportsBinding({
          ...input,
          moduleSourceFile: dependency,
          exportedName: imported.exported,
        })
      ) {
        exportBindingCache.set(cacheKey, true);
        return true;
      }
    }
  }
  exportBindingCache.set(cacheKey, false);
  return false;
}

export function graphUsesExecutableBinding(input: {
  root: string;
  graph: ExecutableSourceGraph;
  bindings: readonly ExecutableBinding[];
}) {
  for (const binding of input.bindings) {
    for (const [sourceFile, parsed] of input.graph) {
      for (const statement of parsed.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          continue;
        }
        const dependency = resolveModule(
          input.root,
          sourceFile,
          statement.moduleSpecifier.text,
        );
        if (!dependency) continue;
        for (const imported of runtimeImports(statement, parsed)) {
          if (
            moduleExportsBinding({
              root: input.root,
              moduleSourceFile: dependency,
              exportedName: imported.exported,
              binding,
              seen: new Set(),
            })
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function jsxTagName(node: ts.JsxOpeningLikeElement) {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : null;
}

function literalAttributeValue(attribute: ts.JsxAttribute) {
  if (!attribute.initializer) return true;
  if (ts.isStringLiteral(attribute.initializer))
    return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    (ts.isStringLiteralLike(attribute.initializer.expression) ||
      attribute.initializer.expression.kind === ts.SyntaxKind.TrueKeyword ||
      attribute.initializer.expression.kind === ts.SyntaxKind.FalseKeyword)
  ) {
    return ts.isStringLiteralLike(attribute.initializer.expression)
      ? attribute.initializer.expression.text
      : attribute.initializer.expression.kind === ts.SyntaxKind.TrueKeyword;
  }
  return undefined;
}

export function graphHasJsxElement(
  graph: ExecutableSourceGraph,
  elementName: string,
  attribute?: { name: string; value?: string | boolean },
) {
  for (const parsed of graph.values()) {
    let found = false;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        jsxTagName(node) === elementName
      ) {
        if (!attribute) {
          found = true;
          return;
        }
        const matched = node.attributes.properties.some(
          (property) =>
            ts.isJsxAttribute(property) &&
            property.name.getText(parsed) === attribute.name &&
            (attribute.value === undefined ||
              literalAttributeValue(property) === attribute.value),
        );
        if (matched) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (found) return true;
  }
  return false;
}

function propertyAccessChain(node: ts.Node) {
  if (!ts.isPropertyAccessExpression(node)) return null;
  const names: string[] = [node.name.text];
  let expression = node.expression;
  while (ts.isPropertyAccessExpression(expression)) {
    names.unshift(expression.name.text);
    expression = expression.expression;
  }
  if (!ts.isIdentifier(expression)) return null;
  names.unshift(expression.text);
  return names;
}

export function graphHasCall(
  graph: ExecutableSourceGraph,
  callee: readonly string[],
) {
  for (const parsed of graph.values()) {
    let found = false;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (ts.isCallExpression(node)) {
        const actual = ts.isIdentifier(node.expression)
          ? [node.expression.text]
          : propertyAccessChain(node.expression);
        if (
          actual &&
          actual.length === callee.length &&
          actual.every((part, index) => part === callee[index])
        ) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (found) return true;
  }
  return false;
}

function classTokens(node: ts.JsxAttribute) {
  const value = literalAttributeValue(node);
  if (typeof value !== "string") return [];
  const tokens: string[] = [];
  let current = "";
  for (const character of value) {
    if (character.trim() === "") {
      if (current) tokens.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export function detectLocalImplementations(graph: ExecutableSourceGraph) {
  const detected = new Set<LocalImplementationKind>();
  for (const parsed of graph.values()) {
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = jsxTagName(node);
        const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
        const attribute = (name: string) =>
          attributes.find((item) => item.name.getText(parsed) === name);
        if (tag === "form") detected.add("native_form");
        if (tag === "table") detected.add("native_table");
        if (tag === "select") detected.add("native_select");
        if (tag === "input") {
          const type = attribute("type");
          const value = type ? literalAttributeValue(type) : undefined;
          if (value === "search") detected.add("native_search_input");
          if (value === "date") detected.add("native_date_input");
          if (value === "file") detected.add("native_file_input");
          if (value === "checkbox") detected.add("native_checkbox");
        }
        const role = attribute("role");
        const roleValue = role ? literalAttributeValue(role) : undefined;
        if (roleValue === "switch") detected.add("native_switch");
        if (roleValue === "dialog") detected.add("native_dialog");
        for (const classAttribute of attributes.filter((item) =>
          ["class", "className"].includes(item.name.getText(parsed)),
        )) {
          if (
            classTokens(classAttribute).some((token) =>
              token.startsWith("[&::-webkit-scrollbar"),
            )
          ) {
            detected.add("local_scrollbar_style");
          }
        }
      }
      if (ts.isCallExpression(node)) {
        const callee = propertyAccessChain(node.expression);
        if (callee?.length === 2 && callee[0] === "window") {
          if (callee[1] === "confirm") detected.add("window_confirm");
          if (callee[1] === "alert") detected.add("window_alert");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return detected;
}
