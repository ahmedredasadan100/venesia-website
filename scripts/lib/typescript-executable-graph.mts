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
const runtimeReferenceCache = new WeakMap<
  ts.Node,
  Map<string, readonly ts.Identifier[]>
>();
const functionVarNameCache = new WeakMap<
  ts.FunctionLikeDeclaration,
  ReadonlySet<string>
>();
const selectedSourceFileCache = new WeakMap<
  ts.SourceFile,
  Map<string, ts.SourceFile>
>();
const executableGraphBindingCaches = new WeakMap<
  object,
  Map<string, boolean>
>();

function executableGraphBindingCache(graph: ExecutableSourceGraph) {
  const key = graph as object;
  const existing = executableGraphBindingCaches.get(key);
  if (existing) return existing;
  const next = new Map<string, boolean>();
  executableGraphBindingCaches.set(key, next);
  return next;
}

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

function runtimeIdentifierReferences(
  node: ts.Node,
  names: ReadonlySet<string>,
  options?: { bindingDeclaration?: ts.Declaration },
) {
  const referenceCacheKey = `${[...names].sort().join(",")}|${
    options?.bindingDeclaration
      ? `${options.bindingDeclaration.pos}:${options.bindingDeclaration.end}`
      : ""
  }`;
  const cachedReferences = runtimeReferenceCache
    .get(node)
    ?.get(referenceCacheKey);
  if (cachedReferences) return [...cachedReferences];
  const references: ts.Identifier[] = [];
  const bindingNameContains = (
    name: ts.BindingName,
    identifier: string,
  ): boolean => {
    if (ts.isIdentifier(name)) return name.text === identifier;
    return name.elements.some(
      (element) =>
        ts.isBindingElement(element) &&
        bindingNameContains(element.name, identifier),
    );
  };
  const isRuntimeFunctionLike = (
    candidate: ts.Node,
  ): candidate is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(candidate) ||
    ts.isMethodDeclaration(candidate) ||
    ts.isGetAccessorDeclaration(candidate) ||
    ts.isSetAccessorDeclaration(candidate) ||
    ts.isConstructorDeclaration(candidate) ||
    ts.isFunctionExpression(candidate) ||
    ts.isArrowFunction(candidate);
  const identifierIsDeclarationName = (identifier: ts.Identifier) => {
    let current: ts.Node = identifier;
    for (let parent = identifier.parent; parent; parent = parent.parent) {
      if (
        (ts.isVariableDeclaration(parent) ||
          ts.isParameter(parent) ||
          ts.isBindingElement(parent)) &&
        parent.name === current
      ) {
        return true;
      }
      if (
        (ts.isFunctionDeclaration(parent) ||
          ts.isFunctionExpression(parent) ||
          ts.isClassDeclaration(parent) ||
          ts.isClassExpression(parent) ||
          ts.isEnumDeclaration(parent) ||
          ts.isInterfaceDeclaration(parent) ||
          ts.isTypeAliasDeclaration(parent) ||
          ts.isTypeParameterDeclaration(parent)) &&
        parent.name === current
      ) {
        return true;
      }
      if (
        ts.isImportClause(parent) ||
        ts.isImportSpecifier(parent) ||
        ts.isNamespaceImport(parent) ||
        ts.isImportEqualsDeclaration(parent)
      ) {
        return true;
      }
      if (!ts.isBindingElement(parent)) break;
      current = parent;
    }
    return false;
  };
  const statementDeclaresLexicalName = (
    statement: ts.Statement,
    identifier: string,
  ) => {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement !== options?.bindingDeclaration &&
      statement.name?.text === identifier
    ) {
      return true;
    }
    return (
      ts.isVariableStatement(statement) &&
      (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !== 0 &&
      statement.declarationList.declarations.some((declaration) =>
        declaration !== options?.bindingDeclaration &&
        bindingNameContains(declaration.name, identifier),
      )
    );
  };
  const functionDeclaresVarName = (
    declaration: ts.FunctionLikeDeclaration,
    identifier: string,
  ) => {
    let declaredNames = functionVarNameCache.get(declaration);
    if (declaredNames) return declaredNames.has(identifier);
    const collectedNames = new Set<string>();
    const visit = (current: ts.Node) => {
      if (current !== declaration && isRuntimeFunctionLike(current)) return;
      if (
        ts.isVariableDeclarationList(current) &&
        (current.flags & ts.NodeFlags.BlockScoped) === 0
      ) {
        const collectName = (name: ts.BindingName) => {
          if (ts.isIdentifier(name)) {
            collectedNames.add(name.text);
            return;
          }
          for (const element of name.elements) {
            if (ts.isBindingElement(element)) collectName(element.name);
          }
        };
        current.declarations.forEach((item) => collectName(item.name));
      }
      ts.forEachChild(current, visit);
    };
    if (declaration.body) visit(declaration.body);
    declaredNames = collectedNames;
    functionVarNameCache.set(declaration, declaredNames);
    return declaredNames.has(identifier);
  };
  const isShadowed = (identifier: ts.Identifier) => {
    for (
      let ancestor: ts.Node | undefined = identifier.parent;
      ancestor && ancestor !== node.parent;
      ancestor = ancestor.parent
    ) {
      if (isRuntimeFunctionLike(ancestor)) {
        if (
          ancestor.parameters.some(
            (parameter) =>
              parameter !== options?.bindingDeclaration &&
              bindingNameContains(parameter.name, identifier.text),
          ) ||
          ((ts.isFunctionExpression(ancestor) ||
            ts.isClassExpression(ancestor)) &&
            ancestor.name?.text === identifier.text) ||
          functionDeclaresVarName(ancestor, identifier.text)
        ) {
          return true;
        }
      }
      if (
        ts.isBlock(ancestor) &&
        ancestor.statements.some((statement) =>
          statementDeclaresLexicalName(statement, identifier.text),
        )
      ) {
        return true;
      }
      if (
        ts.isCatchClause(ancestor) &&
        ancestor.variableDeclaration &&
        bindingNameContains(
          ancestor.variableDeclaration.name,
          identifier.text,
        )
      ) {
        return true;
      }
      if (
        (ts.isForStatement(ancestor) ||
          ts.isForInStatement(ancestor) ||
          ts.isForOfStatement(ancestor)) &&
        ancestor.initializer &&
        ts.isVariableDeclarationList(ancestor.initializer) &&
        ancestor.initializer.declarations.some((declaration) =>
          bindingNameContains(declaration.name, identifier.text),
        )
      ) {
        return true;
      }
    }
    return false;
  };
  const isRuntimeReference = (identifier: ts.Identifier) => {
    if (identifierIsDeclarationName(identifier) || isShadowed(identifier)) {
      return false;
    }
    for (
      let ancestor: ts.Node | undefined = identifier.parent;
      ancestor;
      ancestor = ancestor.parent
    ) {
      if (
        (ts.isExportSpecifier(ancestor) && ancestor.isTypeOnly) ||
        (ts.isExportDeclaration(ancestor) && ancestor.isTypeOnly)
      ) {
        return false;
      }
      if (ts.isTypeNode(ancestor)) {
        if (ts.isExpressionWithTypeArguments(ancestor)) {
          const heritageClause = ancestor.parent;
          const classExtendsExpression =
            ts.isHeritageClause(heritageClause) &&
            heritageClause.token === ts.SyntaxKind.ExtendsKeyword &&
            (ts.isClassDeclaration(heritageClause.parent) ||
              ts.isClassExpression(heritageClause.parent)) &&
            identifier.pos >= ancestor.expression.pos &&
            identifier.end <= ancestor.expression.end;
          if (classExtendsExpression) continue;
        }
        return false;
      }
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
    if (
      ts.isIdentifier(current) &&
      names.has(current.text) &&
      isRuntimeReference(current)
    ) {
      references.push(current);
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  const nodeCache = runtimeReferenceCache.get(node) ?? new Map();
  nodeCache.set(referenceCacheKey, references);
  runtimeReferenceCache.set(node, nodeCache);
  return references;
}

function referenceIsDirectExecutableBindingUse(reference: ts.Identifier) {
  let current: ts.Node = reference;
  while (
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent) ||
      ts.isPropertyAccessExpression(current.parent) ||
      ts.isElementAccessExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  return !(
    (ts.isVoidExpression(current.parent) ||
      ts.isTypeOfExpression(current.parent)) &&
    current.parent.expression === current ||
    (ts.isExpressionStatement(current.parent) &&
      current.parent.expression === current)
  );
}

function declarationIsExported(declaration: ts.Node) {
  for (let current: ts.Node | undefined = declaration; current; current = current.parent) {
    if (ts.isExportAssignment(current)) return true;
    if (ts.isStatement(current)) {
      return (
        ts.canHaveModifiers(current) &&
        ts
          .getModifiers(current)
          ?.some(
            (modifier) =>
              modifier.kind === ts.SyntaxKind.ExportKeyword ||
              modifier.kind === ts.SyntaxKind.DefaultKeyword,
          ) === true
      );
    }
  }
  return false;
}

function bindingDeclarationHasLiveUse(
  parsed: ts.SourceFile,
  declaration: ts.Declaration,
  name: string,
  seenDeclarations = new Set<ts.Declaration>(),
) {
  if (seenDeclarations.has(declaration)) return false;
  const nextSeenDeclarations = new Set(seenDeclarations);
  nextSeenDeclarations.add(declaration);
  return runtimeIdentifierReferences(parsed, new Set([name]), {
    bindingDeclaration: declaration,
  }).some((reference) =>
    referenceIsExecutableBindingUse(
      reference,
      parsed,
      nextSeenDeclarations,
    ),
  );
}

function referenceIsExecutableBindingUse(
  reference: ts.Identifier,
  parsed?: ts.SourceFile,
  seenDeclarations = new Set<ts.Declaration>(),
) {
  if (!referenceIsDirectExecutableBindingUse(reference)) return false;
  for (
    let ancestor: ts.Node | undefined = reference.parent;
    ancestor && !ts.isSourceFile(ancestor);
    ancestor = ancestor.parent
  ) {
    if (ts.isIfStatement(ancestor)) {
      if (
        ancestor.expression.kind === ts.SyntaxKind.FalseKeyword &&
        nodeIsWithin(reference, ancestor.thenStatement)
      ) {
        return false;
      }
      if (
        ancestor.expression.kind === ts.SyntaxKind.TrueKeyword &&
        ancestor.elseStatement &&
        nodeIsWithin(reference, ancestor.elseStatement)
      ) {
        return false;
      }
    }
    if (
      ts.isBinaryExpression(ancestor) &&
      nodeIsWithin(reference, ancestor.right) &&
      ((ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        ancestor.left.kind === ts.SyntaxKind.FalseKeyword) ||
        (ancestor.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
          ancestor.left.kind === ts.SyntaxKind.TrueKeyword))
    ) {
      return false;
    }
    if (
      ts.isConditionalExpression(ancestor) &&
      ((ancestor.condition.kind === ts.SyntaxKind.FalseKeyword &&
        nodeIsWithin(reference, ancestor.whenTrue)) ||
        (ancestor.condition.kind === ts.SyntaxKind.TrueKeyword &&
          nodeIsWithin(reference, ancestor.whenFalse)))
    ) {
      return false;
    }
    if (
      ((ts.isWhileStatement(ancestor) &&
        ancestor.expression.kind === ts.SyntaxKind.FalseKeyword &&
        nodeIsWithin(reference, ancestor.statement)) ||
        (ts.isForStatement(ancestor) &&
          ancestor.condition?.kind === ts.SyntaxKind.FalseKeyword &&
          nodeIsWithin(reference, ancestor.statement)))
    ) {
      return false;
    }
    if (ts.isCallExpression(ancestor)) {
      const callee = ancestor.expression;
      if (
        (ts.isIdentifier(callee) &&
          ["Boolean", "String"].includes(callee.text)) ||
        (ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === "console")
      ) {
        return false;
      }
    }
    if (
      parsed &&
      ts.isVariableDeclaration(ancestor) &&
      ancestor.initializer &&
      nodeIsWithin(reference, ancestor.initializer) &&
      ts.isIdentifier(ancestor.name) &&
      !(
        (ts.isArrowFunction(ancestor.initializer) ||
          ts.isFunctionExpression(ancestor.initializer)) &&
        declarationIsExported(ancestor)
      ) &&
      !bindingDeclarationHasLiveUse(
        parsed,
        ancestor,
        ancestor.name.text,
        seenDeclarations,
      )
    ) {
      return false;
    }
    if (
      parsed &&
      ts.isFunctionDeclaration(ancestor) &&
      ancestor.name &&
      !declarationIsExported(ancestor) &&
      !bindingDeclarationHasLiveUse(
        parsed,
        ancestor,
        ancestor.name.text,
        seenDeclarations,
      )
    ) {
      return false;
    }
    if (
      parsed &&
      (ts.isMethodDeclaration(ancestor) ||
        ts.isPropertyDeclaration(ancestor)) &&
      !ancestor.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
      )
    ) {
      const classDeclaration = ancestor.parent;
      if (
        ts.isClassDeclaration(classDeclaration) &&
        classDeclaration.name &&
        !declarationIsExported(classDeclaration) &&
        !bindingDeclarationHasLiveUse(
          parsed,
          classDeclaration,
          classDeclaration.name.text,
          seenDeclarations,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function nodeContainsRuntimeIdentifier(
  node: ts.Node,
  names: ReadonlySet<string>,
) {
  return runtimeIdentifierReferences(node, names).length > 0;
}

function nodeContainsLocalTypeReference(
  node: ts.Node,
  names: ReadonlySet<string>,
) {
  let found = false;
  const visit = (current: ts.Node) => {
    if (found) return;
    if (
      ts.isTypeReferenceNode(current) &&
      ts.isIdentifier(current.typeName) &&
      names.has(current.typeName.text)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function runtimeReferenceMemberRequests(
  parsed: ts.SourceFile,
  declaration: ts.Node,
  localName: string,
  referenceFilter: (reference: ts.Identifier) => boolean = () => true,
  bindingDeclaration?: ts.Declaration,
  emptyAliasIsWhole = false,
) {
  const requested = new Set<string>();
  let requiresWholeNamespace = false;
  for (const statement of parsed.statements) {
    if (statement === declaration) continue;
    for (const reference of runtimeIdentifierReferences(
      statement,
      new Set([localName]),
      { bindingDeclaration },
    )) {
      if (!referenceFilter(reference)) continue;
      const parent = reference.parent;
      if (
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === reference
      ) {
        requested.add(parent.name.text);
        continue;
      }
      if (
        ts.isElementAccessExpression(parent) &&
        parent.expression === reference &&
        parent.argumentExpression &&
        ts.isStringLiteralLike(parent.argumentExpression)
      ) {
        requested.add(parent.argumentExpression.text);
        continue;
      }
      if (
        ts.isVariableDeclaration(parent) &&
        parent.initializer === reference
      ) {
        const destructured = bindingPatternRequestedNames(parent.name);
        if (destructured.length > 0) {
          destructured.forEach((name) => requested.add(name));
          continue;
        }
        if (ts.isIdentifier(parent.name)) {
          const aliasMembers = runtimeReferenceMemberRequests(
            parsed,
            parent,
            parent.name.text,
            referenceFilter,
            parent,
            emptyAliasIsWhole,
          );
          if (aliasMembers !== null) {
            if (emptyAliasIsWhole && aliasMembers.length === 0) {
              requiresWholeNamespace = true;
              break;
            }
            aliasMembers.forEach((name) => requested.add(name));
            continue;
          }
        }
      }
      requiresWholeNamespace = true;
      break;
    }
    if (requiresWholeNamespace) break;
  }
  return requiresWholeNamespace ? null : [...requested];
}

function namespaceImportRequests(
  parsed: ts.SourceFile,
  declaration: ts.ImportDeclaration,
  referenceFilter?: (reference: ts.Identifier) => boolean,
) {
  const bindings = declaration.importClause?.namedBindings;
  if (!bindings || !ts.isNamespaceImport(bindings)) return [];
  return runtimeReferenceMemberRequests(
    parsed,
    declaration,
    bindings.name.text,
    referenceFilter,
  );
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

function bindingNameHasIdentifier(name: ts.BindingName, identifier: string): boolean {
  if (ts.isIdentifier(name)) return name.text === identifier;
  return name.elements.some(
    (element) =>
      ts.isBindingElement(element) &&
      bindingNameHasIdentifier(element.name, identifier),
  );
}

function moduleDeclarationIsRuntime(statement: ts.ModuleDeclaration) {
  return !statement.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
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
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name?.text === exportedName &&
    (!ts.isModuleDeclaration(statement) ||
      moduleDeclarationIsRuntime(statement)) &&
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
        bindingNameHasIdentifier(declaration.name, exportedName),
    );
  }
  return false;
}

function executableExportPath(input: {
  root: string;
  moduleSourceFile: string;
  exportedName: string;
  sourceOverrides?: SourceOverrides;
  seen?: Set<string>;
}): readonly string[] {
  const moduleSourceFile = normalizeSourcePath(input.moduleSourceFile);
  const resolutionKey = `${moduleSourceFile}:${input.exportedName}`;
  const seen = input.seen ?? new Set<string>();
  if (seen.has(resolutionKey)) return [];
  const cacheKey = input.sourceOverrides
    ? null
    : `${resolve(input.root)}:${resolutionKey}`;
  const cached = cacheKey
    ? executableExportPathCache.get(cacheKey)
    : undefined;
  if (cached) return cached;
  seen.add(resolutionKey);
  const absoluteSourceFile = join(input.root, moduleSourceFile);
  if (
    !input.sourceOverrides?.has(moduleSourceFile) &&
    !existsSync(absoluteSourceFile)
  ) {
    return [];
  }
  const parsed = input.sourceOverrides
    ? parseTypeScriptSource(
        moduleSourceFile,
        input.sourceOverrides.get(moduleSourceFile) ??
          readFileSync(absoluteSourceFile, "utf8"),
      )
    : parseWorkspaceModule(input.root, moduleSourceFile);
  if (
    parsed.statements.some((statement) =>
      declarationExportsName(statement, input.exportedName),
    )
  ) {
    const path = [moduleSourceFile] as const;
    if (cacheKey) executableExportPathCache.set(cacheKey, path);
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
      input.sourceOverrides,
    );
    if (!dependency) continue;
    if (
      statement.exportClause &&
      ts.isNamespaceExport(statement.exportClause)
    ) {
      if (statement.exportClause.name.text !== input.exportedName) continue;
      const path = [moduleSourceFile, dependency] as const;
      if (cacheKey) executableExportPathCache.set(cacheKey, path);
      return path;
    }
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
      sourceOverrides: input.sourceOverrides,
      seen,
    });
    if (dependencyPath.length > 0) {
      const path = [moduleSourceFile, ...dependencyPath];
      if (cacheKey) executableExportPathCache.set(cacheKey, path);
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
    if (
      parsed.statements.some((statement) =>
        statementRuntimeNames(statement).includes(localName),
      )
    ) {
      const path = [moduleSourceFile] as const;
      if (cacheKey) executableExportPathCache.set(cacheKey, path);
      return path;
    }
    for (const statement of parsed.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const namespaceImport = statement.importClause?.namedBindings;
      if (
        namespaceImport &&
        ts.isNamespaceImport(namespaceImport) &&
        namespaceImport.name.text === localName
      ) {
        const dependency = resolveModule(
          input.root,
          moduleSourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        );
        if (dependency) {
          const path = [moduleSourceFile, dependency] as const;
          if (cacheKey) executableExportPathCache.set(cacheKey, path);
          return path;
        }
      }
      const imported = runtimeImports(statement, parsed).find(
        ({ local }) => local === localName,
      );
      const dependency = resolveModule(
        input.root,
        moduleSourceFile,
        statement.moduleSpecifier.text,
        input.sourceOverrides,
      );
      if (!imported || !dependency) continue;
      const dependencyPath = executableExportPath({
        root: input.root,
        moduleSourceFile: dependency,
        exportedName: imported.exported,
        sourceOverrides: input.sourceOverrides,
        seen,
      });
      if (dependencyPath.length > 0) {
        const path = [moduleSourceFile, ...dependencyPath];
        if (cacheKey) executableExportPathCache.set(cacheKey, path);
        return path;
      }
    }
  }
  if (cacheKey) executableExportPathCache.set(cacheKey, []);
  return [];
}

function statementRuntimeNames(statement: ts.Statement) {
  const names: string[] = [];
  const addBindingName = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) {
      names.push(name.text);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBindingName(element.name);
    }
  };
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name
  ) {
    names.push(statement.name.text);
  }
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      addBindingName(declaration.name);
    }
  }
  return names;
}

function statementExportsRequestedName(
  statement: ts.Statement,
  requestedExports: ReadonlySet<string>,
) {
  for (const exportedName of requestedExports) {
    if (declarationExportsName(statement, exportedName.split(".")[0]!)) {
      return true;
    }
  }
  if (
    ts.isExportDeclaration(statement) &&
    statement.exportClause &&
    ts.isNamespaceExport(statement.exportClause)
  ) {
    const members = namespaceMemberRequestsFromExportRequests(
      requestedExports,
      statement.exportClause.name.text,
    );
    return members === null || members.length > 0;
  }
  if (
    ts.isExportDeclaration(statement) &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
  ) {
    return statement.exportClause.elements.some(
      (element) =>
        !element.isTypeOnly &&
        [...requestedExports].some(
          (requested) => requested.split(".")[0] === element.name.text,
        ),
    );
  }
  return false;
}

function namespaceMemberRequestsFromExportRequests(
  requestedExports: ReadonlySet<string> | null,
  namespaceName: string,
) {
  if (requestedExports === null || requestedExports.has(namespaceName)) {
    return null;
  }
  const prefix = `${namespaceName}.`;
  return [...requestedExports]
    .filter((requested) => requested.startsWith(prefix))
    .map((requested) => requested.slice(prefix.length));
}

function translatedNamedExportRequests(
  requestedExports: ReadonlySet<string> | null,
  outwardName: string,
  inwardName: string,
) {
  const members = namespaceMemberRequestsFromExportRequests(
    requestedExports,
    outwardName,
  );
  if (members === null) return [inwardName];
  return members.map((member) => `${inwardName}.${member}`);
}

function expressionHasEagerModuleEffect(expression: ts.Expression) {
  const assignmentOperators = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
  ]);
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      node !== expression &&
      (ts.isFunctionExpression(node) || ts.isArrowFunction(node))
    ) {
      return;
    }
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isDeleteExpression(node) ||
      ts.isPostfixUnaryExpression(node) ||
      (ts.isPrefixUnaryExpression(node) &&
        [
          ts.SyntaxKind.PlusPlusToken,
          ts.SyntaxKind.MinusMinusToken,
        ].includes(node.operator)) ||
      (ts.isBinaryExpression(node) &&
        assignmentOperators.has(node.operatorToken.kind))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

function statementExecutesForModuleInitialization(statement: ts.Statement) {
  if (
    ts.isExpressionStatement(statement) ||
    ts.isExportAssignment(statement) ||
    ts.isIfStatement(statement) ||
    ts.isDoStatement(statement) ||
    ts.isWhileStatement(statement) ||
    ts.isForStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement) ||
    ts.isSwitchStatement(statement) ||
    ts.isTryStatement(statement) ||
    ts.isThrowStatement(statement) ||
    ts.isWithStatement(statement) ||
    ts.isLabeledStatement(statement) ||
    ts.isBlock(statement)
  ) {
    return true;
  }
  if (ts.isClassDeclaration(statement)) {
    const hasRuntimeDecorator = (node: ts.Node) =>
      ts.canHaveDecorators(node) && (ts.getDecorators(node)?.length ?? 0) > 0;
    return (
      hasRuntimeDecorator(statement) ||
      statement.heritageClauses?.some(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
      ) === true ||
      statement.members.some(
        (member) =>
          hasRuntimeDecorator(member) ||
          ("name" in member &&
            member.name !== undefined &&
            ts.isComputedPropertyName(member.name)) ||
          ts.isClassStaticBlockDeclaration(member) ||
          (ts.isPropertyDeclaration(member) &&
            member.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
            ) === true &&
            member.initializer !== undefined),
      )
    );
  }
  if (ts.isEnumDeclaration(statement)) {
    return statement.members.some((member) => member.initializer !== undefined);
  }
  if (ts.isModuleDeclaration(statement)) {
    return moduleDeclarationIsRuntime(statement);
  }
  return (
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (declaration) =>
        declaration.initializer &&
        expressionHasEagerModuleEffect(declaration.initializer),
    )
  );
}

function staticDynamicImportSpecifiers(
  expression: ts.Expression,
  parsed: ts.SourceFile,
  seen = new Set<string>(),
): ReadonlySet<string> | null {
  const current = unwrapStaticExpression(expression);
  if (
    ts.isStringLiteralLike(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return new Set([current.text]);
  }
  if (ts.isIdentifier(current)) {
    const binding = lexicalBindingForReference(parsed, current);
    const key = `${current.text}:${binding?.declaration.pos ?? current.pos}`;
    if (seen.has(key)) return null;
    if (
      binding?.kind !== "variable" ||
      !binding.declaration.initializer ||
      (binding.declarationList.flags & ts.NodeFlags.Const) === 0
    ) {
      return null;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(key);
    return staticDynamicImportSpecifiers(
      binding.declaration.initializer,
      parsed,
      nextSeen,
    );
  }
  if (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticDynamicImportSpecifiers(current.left, parsed, seen);
    const right = staticDynamicImportSpecifiers(current.right, parsed, seen);
    if (!left || !right) return null;
    return new Set(
      [...left].flatMap((leftValue) =>
        [...right].map((rightValue) => `${leftValue}${rightValue}`),
      ),
    );
  }
  if (ts.isTemplateExpression(current)) {
    let values = [current.head.text];
    for (const span of current.templateSpans) {
      const expressions = staticDynamicImportSpecifiers(
        span.expression,
        parsed,
        seen,
      );
      if (!expressions) return null;
      values = values.flatMap((prefix) =>
        [...expressions].map(
          (value) => `${prefix}${value}${span.literal.text}`,
        ),
      );
    }
    return new Set(values);
  }
  if (ts.isConditionalExpression(current)) {
    const whenTrue = staticDynamicImportSpecifiers(
      current.whenTrue,
      parsed,
      seen,
    );
    const whenFalse = staticDynamicImportSpecifiers(
      current.whenFalse,
      parsed,
      seen,
    );
    return whenTrue && whenFalse
      ? new Set([...whenTrue, ...whenFalse])
      : null;
  }
  return null;
}

function dynamicImportSpecifiers(
  node: ts.Node,
  parsed: ts.SourceFile,
) {
  return dynamicImportCalls(node).flatMap((call) => {
    const argument = call.arguments[0];
    const specifiers =
      argument && ts.isExpression(argument)
        ? staticDynamicImportSpecifiers(argument, parsed)
        : null;
    if (!specifiers) {
      const { line, character } = parsed.getLineAndCharacterOfPosition(call.pos);
      throw new Error(
        `${parsed.fileName}:${line + 1}:${character + 1}: unresolved dynamic import`,
      );
    }
    return [...specifiers];
  });
}

function dynamicImportCalls(node: ts.Node) {
  const calls: ts.CallExpression[] = [];
  const visit = (current: ts.Node) => {
    if (
      ts.isCallExpression(current) &&
      current.expression.kind === ts.SyntaxKind.ImportKeyword &&
      current.arguments.length === 1
    ) {
      calls.push(current);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return calls;
}

function bindingPatternRequestedNames(name: ts.BindingName) {
  if (!ts.isObjectBindingPattern(name)) return [];
  return name.elements.flatMap((element) => {
    if (element.dotDotDotToken) return [];
    const importedName = element.propertyName ?? element.name;
    return ts.isIdentifier(importedName) || ts.isStringLiteralLike(importedName)
      ? [importedName.text]
      : [];
  });
}

function dynamicImportBindingRequests(
  call: ts.CallExpression,
  parsed: ts.SourceFile,
) {
  let current: ts.Node = call;
  while (
    (ts.isAwaitExpression(current.parent) ||
      ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  const parent = current.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === current) {
    if (
      parent.name.text === "then" &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.expression === parent
    ) {
      const callback = parent.parent.arguments[0];
      if (
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        callback.parameters[0]
      ) {
        const parameter = callback.parameters[0];
        const requested = bindingPatternRequestedNames(parameter.name);
        if (requested.length > 0) return requested;
        if (ts.isIdentifier(parameter.name)) {
          const members = runtimeReferenceMemberRequests(
            parsed,
            parameter,
            parameter.name.text,
            (reference) => referenceIsExecutableBindingUse(reference, parsed),
            parameter,
          );
          return members === null ? [] : members;
        }
      }
      return [];
    }
    return [parent.name.text];
  }
  if (
    ts.isElementAccessExpression(parent) &&
    parent.expression === current &&
    parent.argumentExpression &&
    ts.isStringLiteralLike(parent.argumentExpression)
  ) {
    return [parent.argumentExpression.text];
  }
  if (ts.isVariableDeclaration(parent) && parent.initializer === current) {
    const requested = bindingPatternRequestedNames(parent.name);
    if (requested.length > 0) return requested;
    if (ts.isIdentifier(parent.name)) {
      const members = runtimeReferenceMemberRequests(
        parsed,
        parent,
        parent.name.text,
        (reference) => referenceIsExecutableBindingUse(reference, parsed),
        parent,
      );
      return members === null ? [] : members;
    }
  }
  return [];
}

function selectRequestedExportStatements(
  parsed: ts.SourceFile,
  requestedExports: ReadonlySet<string>,
) {
  const selected = new Set<ts.Statement>();
  for (const statement of parsed.statements) {
    if (statementExportsRequestedName(statement, requestedExports)) {
      selected.add(statement);
    }
    if (statementExecutesForModuleInitialization(statement)) {
      selected.add(statement);
    }
  }

  // A bare import executes whenever the selected module executes, regardless
  // of which export caused the module to enter the graph.
  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement) && !statement.importClause) {
      selected.add(statement);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const statement of parsed.statements) {
      if (
        selected.has(statement) ||
        (!ts.isTypeAliasDeclaration(statement) &&
          !ts.isInterfaceDeclaration(statement))
      ) {
        continue;
      }
      const typeName = statement.name.text;
      if (
        [...selected].some((candidate) =>
          nodeContainsLocalTypeReference(candidate, new Set([typeName])),
        )
      ) {
        selected.add(statement);
        changed = true;
      }
    }
    for (const statement of parsed.statements) {
      if (selected.has(statement) || ts.isImportDeclaration(statement)) {
        continue;
      }
      const names = statementRuntimeNames(statement);
      if (
        names.length > 0 &&
        [...selected].some((candidate) =>
          nodeContainsRuntimeIdentifier(candidate, new Set(names)),
        )
      ) {
        selected.add(statement);
        changed = true;
      }
    }
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) || selected.has(statement)) {
        continue;
      }
      const names = importLocalNames(statement);
      if (
        names.length > 0 &&
        [...selected].some((candidate) =>
          nodeContainsRuntimeIdentifier(candidate, new Set(names)),
        )
      ) {
        selected.add(statement);
        changed = true;
      }
    }
  }
  return selected;
}

function selectedSourceFile(
  parsed: ts.SourceFile,
  requestedExports: ReadonlySet<string> | null,
) {
  if (requestedExports === null) return parsed;
  const cacheKey = [...requestedExports].sort().join("\u0000");
  const cached = selectedSourceFileCache.get(parsed)?.get(cacheKey);
  if (cached) return cached;
  const selected = selectRequestedExportStatements(parsed, requestedExports);
  const sliced = parseTypeScriptSource(
    parsed.fileName,
    parsed.statements
      .filter((statement) => selected.has(statement))
      .map((statement) => statement.getFullText(parsed))
      .join("\n"),
  );
  const sourceCache = selectedSourceFileCache.get(parsed) ?? new Map();
  sourceCache.set(cacheKey, sliced);
  selectedSourceFileCache.set(parsed, sourceCache);
  return sliced;
}

function requestedSliceRuntimeImports(
  declaration: ts.ImportDeclaration,
  parsed: ts.SourceFile,
  requestedExports: ReadonlySet<string> | null,
) {
  const bindings = [...runtimeImports(declaration, parsed)];
  if (requestedExports !== null) {
    const requestedRoots = new Set(
      [...requestedExports].map((name) => name.split(".")[0]!),
    );
    bindings.push(
      ...runtimeImports(
        declaration,
        parsed,
        (reference) => {
          const exportedAlias = referenceExportedValueName(reference);
          return exportedAlias !== null && requestedRoots.has(exportedAlias);
        },
        true,
      ),
    );
  }
  const merged = new Map<
    string,
    (typeof bindings)[number]
  >();
  for (const binding of bindings) {
    const key = `${binding.exported}\u0000${binding.local}`;
    const existing = merged.get(key);
    if (!existing || existing.memberRequests === null) {
      if (!existing) merged.set(key, binding);
      continue;
    }
    if (binding.memberRequests === null) {
      merged.set(key, binding);
      continue;
    }
    merged.set(key, {
      ...binding,
      memberRequests: [
        ...new Set([...existing.memberRequests, ...binding.memberRequests]),
      ],
    });
  }
  return [...merged.values()];
}

function collectSymbolAwareExecutableSourceGraph(input: {
  root: string;
  entrySourceFiles: readonly string[];
  sourceOverrides?: SourceOverrides;
  traversalBoundarySourceFiles?: readonly string[];
}) {
  const graph = new Map<string, ts.SourceFile>();
  const traversalBoundaries = new Set(
    input.traversalBoundarySourceFiles?.map(normalizeSourcePath) ?? [],
  );
  const requests = new Map<string, Set<string> | null>();
  const queue: string[] = [];
  const enqueue = (
    sourceFile: string,
    requestedExports: readonly string[] | null,
  ) => {
    const normalized = normalizeSourcePath(sourceFile);
    const existing = requests.get(normalized);
    if (existing === null) return;
    if (requestedExports === null) {
      requests.set(normalized, null);
      queue.push(normalized);
      return;
    }
    const next = existing ?? new Set<string>();
    const previousSize = next.size;
    requestedExports.forEach((name) => next.add(name));
    requests.set(normalized, next);
    if (!graph.has(normalized) || next.size !== previousSize) {
      queue.push(normalized);
    }
  };
  input.entrySourceFiles.forEach((sourceFile) => enqueue(sourceFile, null));

  while (queue.length > 0) {
    const sourceFile = queue.shift()!;
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
    const requestedExports = requests.get(sourceFile) ?? null;
    const selected = selectedSourceFile(parsed, requestedExports);
    graph.set(sourceFile, selected);
    if (traversalBoundaries.has(sourceFile)) continue;

    for (const statement of selected.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        importIsExecutable(selected, statement)
      ) {
        const dependency = resolveModule(
          input.root,
          sourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        );
        if (!dependency) continue;
        if (!statement.importClause) {
          enqueue(dependency, null);
          continue;
        }
        const namespaceImport = statement.importClause.namedBindings;
        if (namespaceImport && ts.isNamespaceImport(namespaceImport)) {
          const forwardedMembers = selected.statements.flatMap(
            (candidate) => {
              if (
                !ts.isExportDeclaration(candidate) ||
                candidate.isTypeOnly ||
                candidate.moduleSpecifier ||
                !candidate.exportClause ||
                !ts.isNamedExports(candidate.exportClause)
              ) {
                return [];
              }
              return candidate.exportClause.elements.flatMap((element) => {
                if (
                  element.isTypeOnly ||
                  (element.propertyName ?? element.name).text !==
                    namespaceImport.name.text
                ) {
                  return [];
                }
                const members = namespaceMemberRequestsFromExportRequests(
                  requestedExports,
                  element.name.text,
                );
                return members === null ? [null] : members;
              });
            },
          );
          if (forwardedMembers.includes(null)) {
            enqueue(dependency, null);
          } else if (forwardedMembers.length > 0) {
            enqueue(
              dependency,
              forwardedMembers.filter(
                (member): member is string => member !== null,
              ),
            );
          } else {
            const directRequests = namespaceImportRequests(
              selected,
              statement,
            );
            const requestedRoots =
              requestedExports === null
                ? null
                : new Set(
                    [...requestedExports].map(
                      (name) => name.split(".")[0]!,
                    ),
                  );
            const aliasRequests = requestedRoots
              ? runtimeReferenceMemberRequests(
                  selected,
                  statement,
                  namespaceImport.name.text,
                  (reference) => {
                    const exportedAlias =
                      referenceExportedValueName(reference);
                    return (
                      exportedAlias !== null &&
                      requestedRoots.has(exportedAlias)
                    );
                  },
                  undefined,
                  true,
                )
              : [];
            if (directRequests === null || aliasRequests === null) {
              enqueue(dependency, null);
            } else {
              enqueue(dependency, [
                ...new Set([...directRequests, ...aliasRequests]),
              ]);
            }
          }
          continue;
        }
        enqueue(
          dependency,
          requestedSliceRuntimeImports(
            statement,
            selected,
            requestedExports,
          ).flatMap((binding) =>
            binding.memberRequests === null
              ? [binding.exported]
              : binding.memberRequests.map(
                  (member) => `${binding.exported}.${member}`,
                ),
          ),
        );
      }
      if (
        ts.isExportDeclaration(statement) &&
        !statement.isTypeOnly &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const dependency = resolveModule(
          input.root,
          sourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        );
        if (!dependency) continue;
        if (!statement.exportClause) {
          enqueue(
            dependency,
            requestedExports === null ? null : [...requestedExports],
          );
          continue;
        }
        if (ts.isNamedExports(statement.exportClause)) {
          enqueue(
            dependency,
            statement.exportClause.elements.flatMap((element) =>
              element.isTypeOnly
                ? []
                : translatedNamedExportRequests(
                    requestedExports,
                    element.name.text,
                    (element.propertyName ?? element.name).text,
                  ),
            ),
          );
        }
        if (ts.isNamespaceExport(statement.exportClause)) {
          const members = namespaceMemberRequestsFromExportRequests(
            requestedExports,
            statement.exportClause.name.text,
          );
          if (members === null) enqueue(dependency, null);
          else if (members.length > 0) enqueue(dependency, members);
        }
      }
      for (const dynamicImport of dynamicImportCalls(statement)) {
        for (const moduleSpecifier of dynamicImportSpecifiers(
          dynamicImport,
          selected,
        )) {
          const dependency = resolveModule(
            input.root,
            sourceFile,
            moduleSpecifier,
            input.sourceOverrides,
          );
          if (dependency) {
            enqueue(
              dependency,
              dynamicImportBindingRequests(dynamicImport, selected),
            );
          }
        }
      }
    }


    // `export *` cannot be selected from syntax alone because its outward
    // names live in the dependency. Resolve only the requested names that are
    // actually supplied by each star branch, avoiding unrelated exports.
    if (requestedExports !== null) {
      for (const statement of parsed.statements) {
        if (
          !ts.isExportDeclaration(statement) ||
          statement.isTypeOnly ||
          statement.exportClause ||
          !statement.moduleSpecifier ||
          !ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          continue;
        }
        const dependency = resolveModule(
          input.root,
          sourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        );
        if (!dependency) continue;
        const dependencyExports = [...requestedExports].filter(
          (exportedName) =>
            executableExportPath({
              root: input.root,
              moduleSourceFile: dependency,
              exportedName: exportedName.split(".")[0]!,
              sourceOverrides: input.sourceOverrides,
            }).length > 0,
        );
        if (dependencyExports.length > 0) {
          enqueue(dependency, dependencyExports);
        }
      }
    }
  }
  return graph;
}

export function collectExecutableSourceGraph(input: {
  root: string;
  entrySourceFiles: readonly string[];
  sourceOverrides?: SourceOverrides;
  traversalBoundarySourceFiles?: readonly string[];
  symbolAware?: boolean;
}) {
  if (input.symbolAware !== false) {
    return collectSymbolAwareExecutableSourceGraph(input);
  }
  const graph = new Map<string, ts.SourceFile>();
  const traversalBoundaries = new Set(
    input.traversalBoundarySourceFiles?.map(normalizeSourcePath) ?? [],
  );
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
    if (traversalBoundaries.has(sourceFile)) continue;
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
              sourceOverrides: input.sourceOverrides,
            })) {
              if (!graph.has(executableModule)) queue.push(executableModule);
            }
          }
        }
      }
      for (const moduleSpecifier of dynamicImportSpecifiers(statement, parsed)) {
        const dependency = resolveModule(
          input.root,
          sourceFile,
          moduleSpecifier,
          input.sourceOverrides,
        );
        if (dependency && !graph.has(dependency)) queue.push(dependency);
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
  referenceFilter: (reference: ts.Identifier) => boolean = () => true,
  emptyAliasIsWhole = false,
) {
  if (declaration.importClause?.isTypeOnly) return [];
  const bindings: Array<{
    exported: string;
    local: string;
    memberRequests: readonly string[] | null;
  }> = [];
  if (declaration.importClause?.name) {
    bindings.push({
      exported: "default",
      local: declaration.importClause.name.text,
      memberRequests: null,
    });
  }
  const namedBindings = declaration.importClause?.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      if (!element.isTypeOnly) {
        bindings.push({
          exported: (element.propertyName ?? element.name).text,
          local: element.name.text,
          memberRequests: null,
        });
      }
    }
  }
  return bindings.flatMap((binding) => {
    const memberRequests = runtimeReferenceMemberRequests(
      parsed,
      declaration,
      binding.local,
      referenceFilter,
      undefined,
      emptyAliasIsWhole,
    );
    return memberRequests !== null && memberRequests.length === 0
      ? []
      : [{ ...binding, memberRequests }];
  });
}

function moduleExportsBinding(input: {
  root: string;
  moduleSourceFile: string;
  exportedName: string;
  binding: ExecutableBinding;
  namespaceMembers?: readonly string[] | null;
  implementationSourceFiles?: ReadonlySet<string>;
  bindingCache?: Map<string, boolean>;
  sourceOverrides?: SourceOverrides;
  seen: Set<string>;
}) {
  const moduleSourceFile = normalizeSourcePath(input.moduleSourceFile);
  const bindingSourceFile = normalizeSourcePath(input.binding.sourceFile);
  const namespaceRequestKey =
    input.namespaceMembers === undefined
      ? ""
      : input.namespaceMembers === null
        ? ":namespace=*"
        : `:namespace=${input.namespaceMembers.join(",")}`;
  const resolutionKey = `${moduleSourceFile}:${input.exportedName}${namespaceRequestKey}`;
  if (input.seen.has(resolutionKey)) return false;
  const cacheKey = input.sourceOverrides
    ? null
    : [
        resolve(input.root),
        resolutionKey,
        bindingSourceFile,
        ...input.binding.exportNames,
      ].join("|");
  const bindingCache = input.bindingCache ?? exportBindingCache;
  const cached = cacheKey ? bindingCache.get(cacheKey) : undefined;
  if (cached !== undefined) return cached;
  input.seen.add(resolutionKey);
  if (
    moduleSourceFile === bindingSourceFile &&
    input.binding.exportNames.some((name) => name === input.exportedName)
  ) {
    if (cacheKey) bindingCache.set(cacheKey, true);
    return true;
  }
  const absoluteSourceFile = join(input.root, moduleSourceFile);
  if (
    !input.sourceOverrides?.has(moduleSourceFile) &&
    !existsSync(absoluteSourceFile)
  ) {
    if (cacheKey) bindingCache.set(cacheKey, false);
    return false;
  }
  const parsed = input.sourceOverrides
    ? parseTypeScriptSource(
        moduleSourceFile,
        input.sourceOverrides.get(moduleSourceFile) ??
          readFileSync(absoluteSourceFile, "utf8"),
      )
    : parseWorkspaceModule(input.root, moduleSourceFile);
  // A requested exported value may be a compatibility alias for an imported
  // owner token. Follow that exact initializer only when the alias source is
  // present in the executable graph. Ordinary wrapper internals remain graph
  // edges of their own, so owner-boundary graphs cannot inherit them here.
  if (input.implementationSourceFiles?.has(moduleSourceFile)) {
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
        moduleSourceFile,
        statement.moduleSpecifier.text,
        input.sourceOverrides,
      );
      if (!dependency) continue;
      const namespaceImport = statement.importClause?.namedBindings;
      if (namespaceImport && ts.isNamespaceImport(namespaceImport)) {
        const namespaceMembers = namespaceImportRequests(
          parsed,
          statement,
          (reference) =>
            referenceExportedValueName(reference) === input.exportedName,
        );
        const requestedMembers =
          namespaceMembers === null
            ? input.binding.exportNames
            : namespaceMembers;
        for (const requestedMember of requestedMembers) {
          if (
            moduleExportsBinding({
              ...input,
              moduleSourceFile: dependency,
              exportedName: requestedMember,
              namespaceMembers: undefined,
            })
          ) {
            if (cacheKey) bindingCache.set(cacheKey, true);
            return true;
          }
        }
        continue;
      }
      for (const imported of runtimeImports(
        statement,
        parsed,
        (reference) =>
          referenceExportedValueName(reference) === input.exportedName,
        true,
      )) {
        if (
          moduleExportsBinding({
            ...input,
            moduleSourceFile: dependency,
            exportedName: imported.exported,
            namespaceMembers: imported.memberRequests,
          })
        ) {
          if (cacheKey) bindingCache.set(cacheKey, true);
          return true;
        }
      }
    }
  }

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
        input.sourceOverrides,
      );
      if (!dependency) continue;
      if (!statement.exportClause) {
        if (
          moduleExportsBinding({
            ...input,
            moduleSourceFile: dependency,
          })
        ) {
          if (cacheKey) bindingCache.set(cacheKey, true);
          return true;
        }
        continue;
      }
      if (ts.isNamespaceExport(statement.exportClause)) {
        if (statement.exportClause.name.text !== input.exportedName) continue;
        const requestedMembers =
          input.namespaceMembers === null ||
          input.namespaceMembers === undefined
            ? input.binding.exportNames
            : input.namespaceMembers;
        for (const requestedMember of requestedMembers) {
          if (
            moduleExportsBinding({
              ...input,
              moduleSourceFile: dependency,
              exportedName: requestedMember,
              namespaceMembers: undefined,
            })
          ) {
            if (cacheKey) bindingCache.set(cacheKey, true);
            return true;
          }
        }
        continue;
      }
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (
            element.isTypeOnly ||
            element.name.text !== input.exportedName
          ) {
            continue;
          }
          if (
            moduleExportsBinding({
              ...input,
              moduleSourceFile: dependency,
              exportedName: (element.propertyName ?? element.name).text,
            })
          ) {
            if (cacheKey) bindingCache.set(cacheKey, true);
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
    if (exported.isTypeOnly || exported.name.text !== input.exportedName) {
      continue;
    }
    const localName = (exported.propertyName ?? exported.name).text;
    for (const statement of parsed.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const namespaceImport = statement.importClause?.namedBindings;
      if (
        namespaceImport &&
        ts.isNamespaceImport(namespaceImport) &&
        namespaceImport.name.text === localName
      ) {
        const dependency = resolveModule(
          input.root,
          moduleSourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        );
        if (!dependency) continue;
        const requestedMembers =
          input.namespaceMembers === null ||
          input.namespaceMembers === undefined
            ? input.binding.exportNames
            : input.namespaceMembers;
        for (const requestedMember of requestedMembers) {
          if (
            moduleExportsBinding({
              ...input,
              moduleSourceFile: dependency,
              exportedName: requestedMember,
              namespaceMembers: undefined,
            })
          ) {
            if (cacheKey) bindingCache.set(cacheKey, true);
            return true;
          }
        }
        continue;
      }
      const imported = runtimeImports(statement, parsed).find(
        ({ local }) => local === localName,
      );
      const dependency = resolveModule(
        input.root,
        moduleSourceFile,
        statement.moduleSpecifier.text,
        input.sourceOverrides,
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
        if (cacheKey) bindingCache.set(cacheKey, true);
        return true;
      }
    }
  }
  if (cacheKey) bindingCache.set(cacheKey, false);
  return false;
}

function referenceExportedValueName(reference: ts.Identifier) {
  for (
    let current: ts.Node | undefined = reference.parent;
    current && !ts.isSourceFile(current);
    current = current.parent
  ) {
    if (
      ts.isVariableDeclaration(current) &&
      current.initializer &&
      nodeIsWithin(reference, current.initializer) &&
      ts.isIdentifier(current.name)
    ) {
      const localName = current.name.text;
      const statement = current.parent.parent;
      if (
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
      ) {
        return current.name.text;
      }
      const parsed = current.getSourceFile();
      const exported = parsed.statements.some(
        (statement) =>
          ts.isExportDeclaration(statement) &&
          !statement.moduleSpecifier &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.some(
            (element) =>
              !element.isTypeOnly &&
              (element.propertyName ?? element.name).text === localName,
          ),
      );
      return exported ? localName : null;
    }
  }
  return null;
}

function graphConsumesExportedName(input: {
  root: string;
  graph: ExecutableSourceGraph;
  sourceFile: string;
  exportedName: string;
  sourceOverrides?: SourceOverrides;
}) {
  for (const [consumerSourceFile, parsed] of input.graph) {
    if (consumerSourceFile === input.sourceFile) continue;
    for (const statement of parsed.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        resolveModule(
          input.root,
          consumerSourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        ) === input.sourceFile &&
        runtimeImports(statement, parsed).some(
          (binding) => binding.exported === input.exportedName,
        )
      ) {
        return true;
      }
      if (
        ts.isExportDeclaration(statement) &&
        !statement.isTypeOnly &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        resolveModule(
          input.root,
          consumerSourceFile,
          statement.moduleSpecifier.text,
          input.sourceOverrides,
        ) === input.sourceFile &&
        (!statement.exportClause ||
          (ts.isNamedExports(statement.exportClause) &&
            statement.exportClause.elements.some(
              (element) =>
                !element.isTypeOnly &&
                (element.propertyName ?? element.name).text ===
                  input.exportedName,
            )))
      ) {
        return true;
      }
    }
  }
  return false;
}

export function graphUsesExecutableBinding(input: {
  root: string;
  graph: ExecutableSourceGraph;
  bindings: readonly ExecutableBinding[];
  sourceOverrides?: SourceOverrides;
}) {
  const implementationSourceFiles = new Set(input.graph.keys());
  const bindingCache = executableGraphBindingCache(input.graph);
  for (const binding of input.bindings) {
    for (const [sourceFile, parsed] of input.graph) {
      for (const statement of parsed.statements) {
        if (
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          const dependency = resolveModule(
            input.root,
            sourceFile,
            statement.moduleSpecifier.text,
            input.sourceOverrides,
          );
          if (dependency) {
            const namespaceImport = statement.importClause?.namedBindings;
            if (
              namespaceImport &&
              ts.isNamespaceImport(namespaceImport)
            ) {
              const namespaceMembers = namespaceImportRequests(
                parsed,
                statement,
                (reference) =>
                  referenceIsExecutableBindingUse(reference, parsed),
              );
              const requestedMembers =
                namespaceMembers === null
                  ? binding.exportNames
                  : namespaceMembers;
              for (const requestedMember of requestedMembers) {
                if (
                  moduleExportsBinding({
                    root: input.root,
                    moduleSourceFile: dependency,
                    exportedName: requestedMember,
                    binding,
                    implementationSourceFiles,
                    bindingCache,
                    sourceOverrides: input.sourceOverrides,
                    seen: new Set(),
                  })
                ) {
                  return true;
                }
              }
            } else {
              for (const imported of runtimeImports(
                statement,
                parsed,
                (reference) => {
                  if (referenceIsExecutableBindingUse(reference, parsed)) {
                    return true;
                  }
                  const exportedName = referenceExportedValueName(reference);
                  return exportedName
                    ? graphConsumesExportedName({
                        root: input.root,
                        graph: input.graph,
                        sourceFile,
                        exportedName,
                        sourceOverrides: input.sourceOverrides,
                      })
                    : false;
                },
              )) {
                if (
                  moduleExportsBinding({
                    root: input.root,
                    moduleSourceFile: dependency,
                    exportedName: imported.exported,
                    binding,
                    namespaceMembers: imported.memberRequests,
                    implementationSourceFiles,
                    bindingCache,
                    sourceOverrides: input.sourceOverrides,
                    seen: new Set(),
                  })
                ) {
                  return true;
                }
              }
            }
          }
        }
        for (const dynamicImport of dynamicImportCalls(statement)) {
          for (const moduleSpecifier of dynamicImportSpecifiers(
            dynamicImport,
            parsed,
          )) {
            const dependency = resolveModule(
              input.root,
              sourceFile,
              moduleSpecifier,
              input.sourceOverrides,
            );
            if (!dependency) continue;
            for (const requestedExport of dynamicImportBindingRequests(
              dynamicImport,
              parsed,
            )) {
              if (
                moduleExportsBinding({
                  root: input.root,
                  moduleSourceFile: dependency,
                  exportedName: requestedExport,
                  binding,
                  implementationSourceFiles,
                  bindingCache,
                  sourceOverrides: input.sourceOverrides,
                  seen: new Set(),
                })
              ) {
                return true;
              }
            }
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

function jsxIntrinsicTagNames(
  node: ts.JsxOpeningLikeElement,
  context: StaticResolutionContext,
) {
  if (!ts.isIdentifier(node.tagName)) return new Set<string>();
  if (/^[a-z]/u.test(node.tagName.text)) {
    return new Set([node.tagName.text.toLowerCase()]);
  }
  const resolved = staticPrimitiveValues(node.tagName, context);
  return new Set(
    [...resolved.values].flatMap((value) =>
      typeof value === "string" && /^[a-z][a-z0-9-]*$/u.test(value)
        ? [value.toLowerCase()]
        : [],
    ),
  );
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

type StaticPrimitive = string | boolean;
type StaticPrimitiveResolution = {
  values: ReadonlySet<StaticPrimitive>;
  certain: boolean;
};
type StaticObjectResolution = {
  properties: ReadonlyMap<string, StaticPrimitiveResolution>;
  certain: boolean;
};
type StaticResolutionContext = {
  graph: ExecutableSourceGraph;
  sourceFile: string;
  parsed: ts.SourceFile;
  evaluationPosition?: number;
};
type ResolvedStaticExpression = {
  expression: ts.Expression;
  context: StaticResolutionContext;
};

function unwrapStaticExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapStaticExpression(expression.expression);
  }
  return expression;
}

function lexicalScope(node: ts.Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      ts.isSourceFile(current) ||
      ts.isBlock(current) ||
      ts.isModuleBlock(current) ||
      ts.isCaseBlock(current) ||
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current)
    ) {
      return current;
    }
  }
  return node.getSourceFile();
}

function nodeIsWithin(node: ts.Node, container: ts.Node) {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (current === container) return true;
  }
  return false;
}

function nodeDepth(node: ts.Node) {
  let depth = 0;
  for (let current = node.parent; current; current = current.parent) depth += 1;
  return depth;
}

type LexicalBinding =
  | {
      kind: "variable";
      declaration: ts.VariableDeclaration;
      declarationList: ts.VariableDeclarationList;
      scope: ts.Node;
    }
  | {
      kind: "parameter";
      declaration: ts.ParameterDeclaration;
      scope: ts.Node;
    }
  | {
      kind: "import";
      declaration: ts.ImportClause | ts.ImportSpecifier | ts.NamespaceImport;
      scope: ts.SourceFile;
    }
  | {
      kind: "other";
      declaration: ts.Declaration;
      scope: ts.Node;
    };

type StaticSourceIndex = {
  bindingsByName: ReadonlyMap<string, readonly LexicalBinding[]>;
  binaryExpressions: readonly ts.BinaryExpression[];
  variableDeclarations: readonly ts.VariableDeclaration[];
  callExpressions: readonly ts.CallExpression[];
};

const staticSourceIndexCache = new WeakMap<ts.SourceFile, StaticSourceIndex>();

function bindingScope(declaration: ts.Node) {
  if (ts.isParameter(declaration)) return declaration.parent;
  if (
    ts.isImportClause(declaration) ||
    ts.isImportSpecifier(declaration) ||
    ts.isNamespaceImport(declaration)
  ) {
    return declaration.getSourceFile();
  }
  return lexicalScope(declaration);
}

function staticSourceIndex(parsed: ts.SourceFile): StaticSourceIndex {
  const cached = staticSourceIndexCache.get(parsed);
  if (cached) return cached;
  const bindingsByName = new Map<string, LexicalBinding[]>();
  const binaryExpressions: ts.BinaryExpression[] = [];
  const variableDeclarations: ts.VariableDeclaration[] = [];
  const callExpressions: ts.CallExpression[] = [];
  const addBinding = (name: string, binding: LexicalBinding) => {
    const bindings = bindingsByName.get(name) ?? [];
    bindings.push(binding);
    bindingsByName.set(name, bindings);
  };
  const addBindingName = (name: ts.BindingName, binding: LexicalBinding) => {
    if (ts.isIdentifier(name)) {
      addBinding(name.text, binding);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBindingName(element.name, binding);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node)) binaryExpressions.push(node);
    if (ts.isCallExpression(node)) callExpressions.push(node);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isVariableDeclarationList(node.parent)
    ) {
      variableDeclarations.push(node);
      const binding: LexicalBinding = {
        kind: "variable",
        declaration: node,
        declarationList: node.parent,
        scope: bindingScope(node),
      };
      addBindingName(node.name, binding);
    } else if (ts.isParameter(node)) {
      const binding: LexicalBinding = {
        kind: "parameter",
        declaration: node,
        scope: bindingScope(node),
      };
      addBindingName(node.name, binding);
    } else if (ts.isImportClause(node) && node.name) {
      addBinding(node.name.text, {
        kind: "import",
        declaration: node,
        scope: parsed,
      });
    } else if (ts.isImportSpecifier(node)) {
      addBinding(node.name.text, {
        kind: "import",
        declaration: node,
        scope: parsed,
      });
    } else if (ts.isNamespaceImport(node)) {
      addBinding(node.name.text, {
        kind: "import",
        declaration: node,
        scope: parsed,
      });
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isModuleDeclaration(node)) &&
      node.name
    ) {
      addBinding(node.name.text, {
        kind: "other",
        declaration: node,
        scope: bindingScope(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  const index = {
    bindingsByName,
    binaryExpressions,
    variableDeclarations,
    callExpressions,
  } satisfies StaticSourceIndex;
  staticSourceIndexCache.set(parsed, index);
  return index;
}

function lexicalBindingForReference(
  parsed: ts.SourceFile,
  reference: ts.Identifier,
): LexicalBinding | null {
  const matches = [
    ...(staticSourceIndex(parsed).bindingsByName.get(reference.text) ?? []),
  ].filter((binding) => nodeIsWithin(reference, binding.scope));
  matches.sort((left, right) => {
    const depthDifference = nodeDepth(right.scope) - nodeDepth(left.scope);
    if (depthDifference !== 0) return depthDifference;
    const leftBefore = left.declaration.pos <= reference.pos ? 1 : 0;
    const rightBefore = right.declaration.pos <= reference.pos ? 1 : 0;
    if (leftBefore !== rightBefore) return rightBefore - leftBefore;
    return right.declaration.pos - left.declaration.pos;
  });
  return matches[0] ?? null;
}

function resolveGraphModule(
  graph: ExecutableSourceGraph,
  importer: string,
  moduleSpecifier: string,
) {
  if (!moduleSpecifier.startsWith(".")) return null;
  const base = normalizeSourcePath(join(dirname(importer), moduleSpecifier));
  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mts`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}.mjs`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
        `${base}/index.mts`,
        `${base}/index.js`,
      ];
  return candidates.find((candidate) => graph.has(candidate)) ?? null;
}

function exportedStaticExpression(
  graph: ExecutableSourceGraph,
  sourceFile: string,
  exportedName: string,
  seen: Set<string>,
): ResolvedStaticExpression | null {
  const key = `${sourceFile}:${exportedName}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const parsed = graph.get(sourceFile);
  if (!parsed) return null;
  const context = { graph, sourceFile, parsed, evaluationPosition: parsed.end };

  for (const statement of parsed.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === exportedName &&
          declaration.initializer
        ) {
          return { expression: declaration.name, context };
        }
      }
    }
    if (
      exportedName === "default" &&
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals
    ) {
      return { expression: statement.expression, context };
    }
  }

  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.isTypeOnly ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }
    const element = statement.exportClause.elements.find(
      (candidate) =>
        !candidate.isTypeOnly && candidate.name.text === exportedName,
    );
    if (!element) continue;
    const localOrImportedName = (element.propertyName ?? element.name).text;
    if (
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const dependency = resolveGraphModule(
        graph,
        sourceFile,
        statement.moduleSpecifier.text,
      );
      return dependency
        ? exportedStaticExpression(
            graph,
            dependency,
            localOrImportedName,
            seen,
          )
        : null;
    }
    for (const candidate of parsed.statements) {
      if (!ts.isVariableStatement(candidate)) continue;
      for (const declaration of candidate.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === localOrImportedName &&
          declaration.initializer
        ) {
          return { expression: declaration.name, context };
        }
      }
    }
  }

  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.isTypeOnly ||
      statement.exportClause ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const dependency = resolveGraphModule(
      graph,
      sourceFile,
      statement.moduleSpecifier.text,
    );
    if (!dependency) continue;
    const resolved = exportedStaticExpression(
      graph,
      dependency,
      exportedName,
      seen,
    );
    if (resolved) return resolved;
  }
  return null;
}

function importedStaticExpression(
  context: StaticResolutionContext,
  reference: ts.Identifier,
  seen: Set<string>,
) {
  const lexicalBinding = lexicalBindingForReference(context.parsed, reference);
  if (lexicalBinding?.kind !== "import") return null;
  for (const statement of context.parsed.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause?.isTypeOnly ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    let exportedName: string | null = null;
    if (
      lexicalBinding.declaration === statement.importClause &&
      statement.importClause?.name?.text === reference.text
    ) {
      exportedName = "default";
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      const element = bindings.elements.find(
        (candidate) =>
          !candidate.isTypeOnly && candidate.name.text === reference.text,
      );
      if (element && lexicalBinding.declaration === element) {
        exportedName = (element.propertyName ?? element.name).text;
      }
    }
    if (!exportedName) continue;
    const dependency = resolveGraphModule(
      context.graph,
      context.sourceFile,
      statement.moduleSpecifier.text,
    );
    if (!dependency) return null;
    return exportedStaticExpression(
      context.graph,
      dependency,
      exportedName,
      seen,
    );
  }
  return null;
}

function namespaceImportedStaticExpression(
  context: StaticResolutionContext,
  reference: ts.Identifier,
  exportedName: string,
  seen: Set<string>,
) {
  const lexicalBinding = lexicalBindingForReference(context.parsed, reference);
  if (
    lexicalBinding?.kind !== "import" ||
    !ts.isNamespaceImport(lexicalBinding.declaration)
  ) {
    return null;
  }
  let importDeclaration: ts.Node | undefined = lexicalBinding.declaration;
  while (importDeclaration && !ts.isImportDeclaration(importDeclaration)) {
    importDeclaration = importDeclaration.parent;
  }
  if (
    !ts.isImportDeclaration(importDeclaration) ||
    !ts.isStringLiteral(importDeclaration.moduleSpecifier)
  ) {
    return null;
  }
  const dependency = resolveGraphModule(
    context.graph,
    context.sourceFile,
    importDeclaration.moduleSpecifier.text,
  );
  return dependency
    ? exportedStaticExpression(context.graph, dependency, exportedName, seen)
    : null;
}

function primitiveResolution(
  values: Iterable<StaticPrimitive> = [],
  certain = true,
): StaticPrimitiveResolution {
  return { values: new Set(values), certain };
}

function mergePrimitiveResolutions(
  resolutions: readonly StaticPrimitiveResolution[],
): StaticPrimitiveResolution {
  return primitiveResolution(
    resolutions.flatMap((resolution) => [...resolution.values]),
    resolutions.every((resolution) => resolution.certain),
  );
}

function bindingElementForIdentifier(
  name: ts.BindingName,
  identifier: string,
): ts.BindingElement | null {
  if (ts.isIdentifier(name)) return null;
  for (const element of name.elements) {
    if (!ts.isBindingElement(element)) continue;
    if (ts.isIdentifier(element.name) && element.name.text === identifier) {
      return element;
    }
    const nested = bindingElementForIdentifier(element.name, identifier);
    if (nested) return nested;
  }
  return null;
}

function nearestExecutionContainer(node: ts.Node) {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current) ||
      ts.isSourceFile(current)
    ) {
      return current;
    }
  }
  return node.getSourceFile();
}

function mutationIsConditional(node: ts.Node, container: ts.Node) {
  for (
    let current: ts.Node | undefined = node.parent;
    current && current !== container;
    current = current.parent
  ) {
    if (
      ts.isIfStatement(current) ||
      ts.isConditionalExpression(current) ||
      ts.isSwitchStatement(current) ||
      ts.isCaseClause(current) ||
      ts.isDefaultClause(current) ||
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current) ||
      ts.isTryStatement(current) ||
      ts.isCatchClause(current)
    ) {
      return true;
    }
  }
  return false;
}

function simpleIdentifierAssignmentsBeforeReference(
  context: StaticResolutionContext,
  binding: LexicalBinding & { kind: "variable" },
  reference: ts.Identifier,
) {
  const assignments: ts.BinaryExpression[] = [];
  const executionContainer = nearestExecutionContainer(reference);
  const evaluationPosition = context.evaluationPosition ?? reference.pos;
  for (const node of staticSourceIndex(context.parsed).binaryExpressions) {
    if (node.pos >= evaluationPosition) continue;
    if (
      ts.isIdentifier(node.left) &&
      node.left.text === reference.text &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      nearestExecutionContainer(node) === executionContainer &&
      lexicalBindingForReference(context.parsed, node.left)?.declaration ===
        binding.declaration
    ) {
      assignments.push(node);
    }
  }
  return assignments.sort((left, right) => left.pos - right.pos);
}

function primitiveResolutionFromTypeNode(
  type: ts.TypeNode,
  parsed: ts.SourceFile,
  propertyName?: string,
  seen = new Set<string>(),
): StaticPrimitiveResolution | null {
  if (ts.isParenthesizedTypeNode(type)) {
    return primitiveResolutionFromTypeNode(
      type.type,
      parsed,
      propertyName,
      seen,
    );
  }
  if (ts.isUnionTypeNode(type)) {
    const members = type.types.map((member) =>
      primitiveResolutionFromTypeNode(member, parsed, propertyName, seen),
    );
    return members.every(
      (member): member is StaticPrimitiveResolution => member !== null,
    )
      ? mergePrimitiveResolutions(members)
      : null;
  }
  if (ts.isLiteralTypeNode(type)) {
    if (ts.isStringLiteralLike(type.literal)) {
      return primitiveResolution([type.literal.text]);
    }
    if (type.literal.kind === ts.SyntaxKind.TrueKeyword) {
      return primitiveResolution([true]);
    }
    if (type.literal.kind === ts.SyntaxKind.FalseKeyword) {
      return primitiveResolution([false]);
    }
    return primitiveResolution();
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const key = `${type.typeName.text}:${propertyName ?? ""}`;
    if (seen.has(key)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(key);
    for (const statement of parsed.statements) {
      if (
        ts.isTypeAliasDeclaration(statement) &&
        statement.name.text === type.typeName.text
      ) {
        return primitiveResolutionFromTypeNode(
          statement.type,
          parsed,
          propertyName,
          nextSeen,
        );
      }
      if (
        ts.isInterfaceDeclaration(statement) &&
        statement.name.text === type.typeName.text &&
        propertyName
      ) {
        const property = statement.members.find(
          (member): member is ts.PropertySignature =>
            ts.isPropertySignature(member) &&
            member.name.getText(parsed).replaceAll(/["']/gu, "") ===
              propertyName,
        );
        return property?.type
          ? primitiveResolutionFromTypeNode(
              property.type,
              parsed,
              undefined,
              nextSeen,
            )
          : null;
      }
    }
    return null;
  }
  if (ts.isTypeLiteralNode(type) && propertyName) {
    const property = type.members.find(
      (member): member is ts.PropertySignature =>
        ts.isPropertySignature(member) &&
        member.name.getText(parsed).replaceAll(/["']/gu, "") === propertyName,
    );
    return property?.type
      ? primitiveResolutionFromTypeNode(
          property.type,
          parsed,
          undefined,
          seen,
        )
      : null;
  }
  return null;
}

function bindingPrimitiveTypeResolution(
  binding: LexicalBinding,
  reference: ts.Identifier,
  parsed: ts.SourceFile,
) {
  if (binding.kind !== "parameter" && binding.kind !== "variable") {
    return null;
  }
  const declaration = binding.declaration;
  if (!declaration.type) return null;
  const element = bindingElementForIdentifier(declaration.name, reference.text);
  const propertyName = element
    ? (element.propertyName ?? element.name)
    : undefined;
  return primitiveResolutionFromTypeNode(
    declaration.type,
    parsed,
    propertyName &&
      (ts.isIdentifier(propertyName) || ts.isStringLiteralLike(propertyName))
      ? propertyName.text
      : undefined,
  );
}

function staticBindingPrimitiveResolution(
  binding: LexicalBinding,
  reference: ts.Identifier,
  context: StaticResolutionContext,
  resolvingNames: Set<string>,
): StaticPrimitiveResolution {
  if (binding.kind === "import") {
    const imported = importedStaticExpression(context, reference, resolvingNames);
    return imported
      ? staticPrimitiveValues(imported.expression, imported.context, resolvingNames)
      : primitiveResolution([], false);
  }
  if (binding.kind === "other") return primitiveResolution([], false);
  const declaration = binding.declaration;
  if (!declaration.initializer) {
    return (
      bindingPrimitiveTypeResolution(binding, reference, context.parsed) ??
      primitiveResolution([], false)
    );
  }
  if (
    binding.kind === "variable" &&
    declaration.pos >= (context.evaluationPosition ?? reference.pos)
  ) {
    return primitiveResolution([], false);
  }
  let resolved: StaticPrimitiveResolution;
  if (ts.isIdentifier(declaration.name)) {
    resolved = staticPrimitiveValues(
      declaration.initializer,
      context,
      resolvingNames,
    );
  } else {
    const element = bindingElementForIdentifier(
      declaration.name,
      reference.text,
    );
    if (!element || !ts.isObjectBindingPattern(declaration.name)) {
      return primitiveResolution([], false);
    }
    const propertyName = element.propertyName ?? element.name;
    if (
      !ts.isIdentifier(propertyName) &&
      !ts.isStringLiteralLike(propertyName) &&
      !ts.isNumericLiteral(propertyName)
    ) {
      return primitiveResolution([], false);
    }
    const source = staticObjectProperties(
      declaration.initializer,
      context,
      resolvingNames,
    );
    resolved =
      source.properties.get(propertyName.text) ??
      primitiveResolution([], source.certain);
    if (element.initializer) {
      resolved = mergePrimitiveResolutions([
        resolved,
        staticPrimitiveValues(element.initializer, context, resolvingNames),
      ]);
    }
  }
  if (binding.kind !== "variable") return resolved;
  if ((binding.declarationList.flags & ts.NodeFlags.BlockScoped) === 0) {
    return { ...resolved, certain: false };
  }
  for (const assignment of simpleIdentifierAssignmentsBeforeReference(
    context,
    binding,
    reference,
  )) {
    const assignmentResolution = staticPrimitiveValues(
      assignment.right,
      context,
      resolvingNames,
    );
    resolved = mutationIsConditional(
      assignment,
      nearestExecutionContainer(reference),
    )
      ? {
          ...mergePrimitiveResolutions([resolved, assignmentResolution]),
          certain: false,
        }
      : assignmentResolution;
  }
  return resolved;
}

function staticPrimitiveValues(
  expression: ts.Expression,
  context: StaticResolutionContext,
  resolvingNames = new Set<string>(),
): StaticPrimitiveResolution {
  const current = unwrapStaticExpression(expression);
  if (
    ts.isStringLiteralLike(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return primitiveResolution([current.text]);
  }
  if (current.kind === ts.SyntaxKind.TrueKeyword)
    return primitiveResolution([true]);
  if (current.kind === ts.SyntaxKind.FalseKeyword)
    return primitiveResolution([false]);
  if (
    ts.isNumericLiteral(current) ||
    current.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(current) && current.text === "undefined")
  ) {
    return primitiveResolution();
  }
  if (ts.isIdentifier(current)) {
    const binding = lexicalBindingForReference(context.parsed, current);
    const resolutionKey = `${context.sourceFile}:${binding?.declaration.pos ?? current.pos}:${current.text}`;
    if (resolvingNames.has(resolutionKey)) {
      return primitiveResolution([], false);
    }
    const nextNames = new Set(resolvingNames);
    nextNames.add(resolutionKey);
    return binding
      ? staticBindingPrimitiveResolution(
          binding,
          current,
          context,
          nextNames,
        )
      : primitiveResolution([], false);
  }
  if (ts.isConditionalExpression(current)) {
    return mergePrimitiveResolutions([
      staticPrimitiveValues(current.whenTrue, context, resolvingNames),
      staticPrimitiveValues(current.whenFalse, context, resolvingNames),
    ]);
  }
  if (
    ts.isBinaryExpression(current) &&
    [
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(current.operatorToken.kind)
  ) {
    return mergePrimitiveResolutions([
      staticPrimitiveValues(current.left, context, resolvingNames),
      staticPrimitiveValues(current.right, context, resolvingNames),
    ]);
  }
  if (ts.isPropertyAccessExpression(current)) {
    if (ts.isIdentifier(current.expression)) {
      const imported = namespaceImportedStaticExpression(
        context,
        current.expression,
        current.name.text,
        resolvingNames,
      );
      if (imported) {
        return staticPrimitiveValues(
          imported.expression,
          imported.context,
          resolvingNames,
        );
      }
    }
    const object = staticObjectProperties(
      current.expression,
      context,
      resolvingNames,
    );
    return (
      object.properties.get(current.name.text) ??
      primitiveResolution([], object.certain)
    );
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression &&
    ts.isStringLiteralLike(current.argumentExpression)
  ) {
    if (ts.isIdentifier(current.expression)) {
      const imported = namespaceImportedStaticExpression(
        context,
        current.expression,
        current.argumentExpression.text,
        resolvingNames,
      );
      if (imported) {
        return staticPrimitiveValues(
          imported.expression,
          imported.context,
          resolvingNames,
        );
      }
    }
    const object = staticObjectProperties(
      current.expression,
      context,
      resolvingNames,
    );
    return (
      object.properties.get(current.argumentExpression.text) ??
      primitiveResolution([], object.certain)
    );
  }
  return primitiveResolution([], false);
}

function staticPropertyName(
  name: ts.PropertyName,
  context: StaticResolutionContext,
) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const resolution = staticPrimitiveValues(name.expression, context);
    if (resolution.certain && resolution.values.size === 1) {
      const [value] = resolution.values;
      return typeof value === "string" ? value : null;
    }
  }
  return null;
}

function mergeStaticObjectProperties(
  target: Map<string, StaticPrimitiveResolution>,
  source: ReadonlyMap<string, StaticPrimitiveResolution>,
) {
  for (const [name, resolution] of source) {
    target.set(name, {
      values: new Set(resolution.values),
      certain: resolution.certain,
    });
  }
}

function objectPropertyAssignment(
  expression: ts.Expression,
  context: StaticResolutionContext,
  binding: LexicalBinding & { kind: "variable" },
) {
  const current = unwrapStaticExpression(expression);
  if (
    !ts.isPropertyAccessExpression(current) &&
    !ts.isElementAccessExpression(current)
  ) {
    return null;
  }
  if (!ts.isIdentifier(current.expression)) return null;
  if (
    lexicalBindingForReference(context.parsed, current.expression)
      ?.declaration !== binding.declaration
  ) {
    return null;
  }
  if (ts.isPropertyAccessExpression(current)) return current.name.text;
  return current.argumentExpression &&
    ts.isStringLiteralLike(current.argumentExpression)
    ? current.argumentExpression.text
    : undefined;
}

function applyObjectMutationsBeforeReference(
  base: StaticObjectResolution,
  context: StaticResolutionContext,
  binding: LexicalBinding & { kind: "variable" },
  reference: ts.Identifier,
  resolvingNames: Set<string>,
): StaticObjectResolution {
  const properties = new Map(base.properties);
  let certain = base.certain;
  const executionContainer = nearestExecutionContainer(reference);
  const evaluationPosition = context.evaluationPosition ?? reference.pos;
  const assignments: ts.BinaryExpression[] = [];
  for (const node of staticSourceIndex(context.parsed).binaryExpressions) {
    if (node.pos >= evaluationPosition) continue;
    const property = objectPropertyAssignment(node.left, context, binding);
    if (property !== null) assignments.push(node);
  }
  assignments.sort((left, right) => left.pos - right.pos);
  for (const assignment of assignments) {
    const property = objectPropertyAssignment(assignment.left, context, binding);
    if (
      typeof property !== "string" ||
      assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken
    ) {
      certain = false;
      continue;
    }
    const next = staticPrimitiveValues(
      assignment.right,
      context,
      resolvingNames,
    );
    if (
      nearestExecutionContainer(assignment) !== executionContainer ||
      mutationIsConditional(assignment, executionContainer)
    ) {
      properties.set(
        property,
        mergePrimitiveResolutions([
          properties.get(property) ?? primitiveResolution(),
          next,
        ]),
      );
      certain = false;
    } else {
      properties.set(property, next);
    }
  }
  const aliases: Array<{
    name: string;
    binding: LexicalBinding & { kind: "variable" };
  }> = [];
  for (const node of staticSourceIndex(context.parsed).variableDeclarations) {
    if (node.pos >= evaluationPosition) continue;
    if (
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isIdentifier(unwrapStaticExpression(node.initializer))
    ) {
      const initializer = unwrapStaticExpression(node.initializer);
      if (
        ts.isIdentifier(initializer) &&
        lexicalBindingForReference(context.parsed, initializer)?.declaration ===
          binding.declaration &&
        ts.isVariableDeclarationList(node.parent)
      ) {
        aliases.push({
          name: node.name.text,
          binding: {
            kind: "variable",
            declaration: node,
            declarationList: node.parent,
            scope: bindingScope(node),
          },
        });
      }
    }
  }
  const callMayMutate = (node: ts.CallExpression) => {
      if (node.pos >= evaluationPosition) return false;
      const directMutationTarget = [
        ...node.arguments,
        ...(ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression)
          ? [node.expression.expression]
          : []),
      ].some((candidate) => {
        const current = unwrapStaticExpression(candidate);
        if (!ts.isIdentifier(current)) return false;
        const candidateBinding = lexicalBindingForReference(
          context.parsed,
          current,
        );
        return (
          candidateBinding?.declaration === binding.declaration ||
          aliases.some(
            (alias) =>
              alias.name === current.text &&
              candidateBinding?.declaration === alias.binding.declaration,
          )
        );
      });
      return directMutationTarget;
  };
  const aliasWriteMayMutate = (node: ts.BinaryExpression) => {
      if (node.pos >= evaluationPosition) return false;
      const current = unwrapStaticExpression(node.left);
      if (
        (ts.isPropertyAccessExpression(current) ||
          ts.isElementAccessExpression(current)) &&
        ts.isIdentifier(current.expression)
      ) {
        const aliasBinding = lexicalBindingForReference(
          context.parsed,
          current.expression,
        );
        if (
          aliases.some(
            (alias) => alias.binding.declaration === aliasBinding?.declaration,
          )
        ) {
          return true;
        }
      }
      return false;
  };
  const sourceIndex = staticSourceIndex(context.parsed);
  if (
    sourceIndex.callExpressions.some(callMayMutate) ||
    sourceIndex.binaryExpressions.some(aliasWriteMayMutate)
  ) {
    certain = false;
  }
  return { properties, certain };
}

function staticObjectProperties(
  expression: ts.Expression,
  context: StaticResolutionContext,
  resolvingNames = new Set<string>(),
): StaticObjectResolution {
  const current = unwrapStaticExpression(expression);
  if (ts.isIdentifier(current)) {
    const binding = lexicalBindingForReference(context.parsed, current);
    const resolutionKey = `${context.sourceFile}:${binding?.declaration.pos ?? current.pos}:${current.text}:object`;
    if (resolvingNames.has(resolutionKey)) {
      return { properties: new Map(), certain: false };
    }
    const nextNames = new Set(resolvingNames);
    nextNames.add(resolutionKey);
    if (
      binding?.kind === "variable" &&
      ts.isIdentifier(binding.declaration.name) &&
      binding.declaration.initializer &&
      binding.declaration.pos <
        (context.evaluationPosition ?? current.pos)
    ) {
      let base = staticObjectProperties(
        binding.declaration.initializer,
        context,
        nextNames,
      );
      for (const assignment of simpleIdentifierAssignmentsBeforeReference(
        context,
        binding,
        current,
      )) {
        const next = staticObjectProperties(
          assignment.right,
          context,
          nextNames,
        );
        if (
          nearestExecutionContainer(assignment) !==
            nearestExecutionContainer(current) ||
          mutationIsConditional(
            assignment,
            nearestExecutionContainer(current),
          )
        ) {
          base = { properties: new Map(), certain: false };
        } else {
          base = next;
        }
      }
      return applyObjectMutationsBeforeReference(
        base,
        context,
        binding,
        current,
        nextNames,
      );
    }
    if (binding?.kind === "parameter" && binding.declaration.initializer) {
      return staticObjectProperties(
        binding.declaration.initializer,
        context,
        nextNames,
      );
    }
    const imported = importedStaticExpression(context, current, nextNames);
    return imported
      ? staticObjectProperties(imported.expression, imported.context, nextNames)
      : { properties: new Map(), certain: false };
  }
  if (ts.isConditionalExpression(current)) {
    const merged = new Map<string, StaticPrimitiveResolution>();
    let certain = true;
    for (const candidate of [current.whenTrue, current.whenFalse]) {
      const resolution = staticObjectProperties(
        candidate,
        context,
        resolvingNames,
      );
      certain &&= resolution.certain;
      for (const [name, property] of resolution.properties) {
        merged.set(
          name,
          mergePrimitiveResolutions([
            merged.get(name) ?? primitiveResolution(),
            property,
          ]),
        );
      }
    }
    return { properties: merged, certain };
  }
  if (!ts.isObjectLiteralExpression(current)) {
    return { properties: new Map(), certain: false };
  }

  const properties = new Map<string, StaticPrimitiveResolution>();
  let certain = true;
  for (const property of current.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = staticObjectProperties(
        property.expression,
        context,
        resolvingNames,
      );
      mergeStaticObjectProperties(
        properties,
        spread.properties,
      );
      certain &&= spread.certain;
      continue;
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      const resolved =
        staticPrimitiveValues(property.name, context, resolvingNames);
      properties.set(
        property.name.text,
        resolved,
      );
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      const name = staticPropertyName(property.name, context);
      if (name !== null) {
        const resolved = staticPrimitiveValues(
          property.initializer,
          context,
          resolvingNames,
        );
        properties.set(
          name,
          resolved,
        );
      } else {
        certain = false;
      }
      continue;
    }
    if (
      ts.isGetAccessorDeclaration(property) ||
      ts.isSetAccessorDeclaration(property)
    ) {
      certain = false;
    }
  }
  return { properties, certain };
}

function jsxStaticAttributeValues(
  attributes: ts.JsxAttributes,
  name: string,
  context: StaticResolutionContext,
  options?: { unresolvedSpreadTaints?: boolean },
) {
  let resolution = primitiveResolution();
  for (const property of attributes.properties) {
    if (
      ts.isJsxAttribute(property) &&
      property.name.getText(context.parsed) === name
    ) {
      const literal = literalAttributeValue(property);
      if (literal !== undefined) {
        resolution = primitiveResolution([literal]);
      } else if (
        property.initializer &&
        ts.isJsxExpression(property.initializer) &&
        property.initializer.expression
      ) {
        resolution = staticPrimitiveValues(
          property.initializer.expression,
          context,
        );
      } else {
        resolution = primitiveResolution([], false);
      }
      continue;
    }
    if (ts.isJsxSpreadAttribute(property)) {
      const spread = staticObjectProperties(
        property.expression,
        context,
      );
      const spreadResolution = spread.properties.get(name);
      if (spreadResolution) {
        resolution = {
          values: spreadResolution.values,
          certain: spreadResolution.certain && spread.certain,
        };
      }
      else if (
        !spread.certain &&
        options?.unresolvedSpreadTaints !== false
      ) {
        resolution = { ...resolution, certain: false };
      }
    }
  }
  return resolution;
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

const FEEDBACK_GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);
const FEEDBACK_METHODS = new Set(["confirm", "alert"]);

function sourceFileDeclaresName(parsed: ts.SourceFile, name: string) {
  return parsed.statements.some((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      importLocalNames(statement).includes(name)
    ) {
      return true;
    }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      statement.name?.text === name
    ) {
      return true;
    }
    return (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((declaration) =>
        bindingNameHasIdentifier(declaration.name, name),
      )
    );
  });
}

function identifierIsUnshadowedGlobal(
  parsed: ts.SourceFile,
  identifier: ts.Identifier,
) {
  return (
    !sourceFileDeclaresName(parsed, identifier.text) &&
    runtimeIdentifierReferences(parsed, new Set([identifier.text])).includes(
      identifier,
    )
  );
}

function feedbackAliasExpressions(
  binding: LexicalBinding & { kind: "variable" },
  reference: ts.Identifier,
  context: StaticResolutionContext,
) {
  let expressions = binding.declaration.initializer
    ? [binding.declaration.initializer]
    : [];
  for (const assignment of simpleIdentifierAssignmentsBeforeReference(
    context,
    binding,
    reference,
  )) {
    if (
      mutationIsConditional(
        assignment,
        nearestExecutionContainer(reference),
      )
    ) {
      expressions.push(assignment.right);
    } else {
      expressions = [assignment.right];
    }
  }
  return expressions;
}

function expressionIsFeedbackGlobalObject(
  expression: ts.Expression,
  context: StaticResolutionContext,
  seenAliases: Set<string>,
): boolean {
  const current = unwrapStaticExpression(expression);
  if (!ts.isIdentifier(current)) return false;
  if (
    FEEDBACK_GLOBAL_OBJECTS.has(current.text) &&
    identifierIsUnshadowedGlobal(context.parsed, current)
  ) {
    return true;
  }
  const binding = lexicalBindingForReference(context.parsed, current);
  if (binding?.kind !== "variable") return false;
  const key = `${context.sourceFile}:${binding.declaration.pos}:global-object`;
  if (seenAliases.has(key)) return false;
  const nextAliases = new Set(seenAliases);
  nextAliases.add(key);
  return feedbackAliasExpressions(binding, current, context).some((candidate) =>
    expressionIsFeedbackGlobalObject(candidate, context, nextAliases),
  );
}

function objectFeedbackProperty(
  expression: ts.Expression,
  propertyName: string,
  context: StaticResolutionContext,
  seenAliases: Set<string>,
): "confirm" | "alert" | null {
  const current = unwrapStaticExpression(expression);
  if (!ts.isIdentifier(current)) return null;
  const binding = lexicalBindingForReference(context.parsed, current);
  if (binding?.kind !== "variable") return null;
  const key = `${context.sourceFile}:${binding.declaration.pos}:${propertyName}:object-field`;
  if (seenAliases.has(key)) return null;
  const nextAliases = new Set(seenAliases);
  nextAliases.add(key);
  for (const candidate of feedbackAliasExpressions(binding, current, context)) {
    const object = unwrapStaticExpression(candidate);
    if (!ts.isObjectLiteralExpression(object)) continue;
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (staticPropertyName(property.name, context) !== propertyName) continue;
      const feedback = globalFeedbackCall(
        property.initializer as ts.LeftHandSideExpression,
        context,
        nextAliases,
      );
      if (feedback) return feedback;
    }
  }
  return null;
}

function globalFeedbackCall(
  expression: ts.LeftHandSideExpression,
  context: StaticResolutionContext,
  seenAliases = new Set<string>(),
): "confirm" | "alert" | null {
  const current = unwrapStaticExpression(expression);
  if (ts.isIdentifier(current)) {
    if (
      FEEDBACK_METHODS.has(current.text) &&
      identifierIsUnshadowedGlobal(context.parsed, current)
    ) {
      return current.text as "confirm" | "alert";
    }
    const binding = lexicalBindingForReference(context.parsed, current);
    if (binding?.kind !== "variable") return null;
    const key = `${context.sourceFile}:${binding.declaration.pos}:feedback`;
    if (seenAliases.has(key)) return null;
    const nextAliases = new Set(seenAliases);
    nextAliases.add(key);
    if (ts.isObjectBindingPattern(binding.declaration.name)) {
      const element = bindingElementForIdentifier(
        binding.declaration.name,
        current.text,
      );
      const propertyName = element
        ? (element.propertyName ?? element.name)
        : undefined;
      if (
        propertyName &&
        (ts.isIdentifier(propertyName) ||
          ts.isStringLiteralLike(propertyName)) &&
        FEEDBACK_METHODS.has(propertyName.text) &&
        binding.declaration.initializer &&
        expressionIsFeedbackGlobalObject(
          binding.declaration.initializer,
          context,
          nextAliases,
        )
      ) {
        return propertyName.text as "confirm" | "alert";
      }
    }
    for (const initializer of feedbackAliasExpressions(
      binding,
      current,
      context,
    )) {
      const feedback = globalFeedbackCall(
        unwrapStaticExpression(initializer) as ts.LeftHandSideExpression,
        context,
        nextAliases,
      );
      if (feedback) return feedback;
    }
    return null;
  }
  if (
    ts.isPropertyAccessExpression(current) &&
    ["call", "apply", "bind"].includes(current.name.text)
  ) {
    return globalFeedbackCall(current.expression, context, seenAliases);
  }
  if (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    return globalFeedbackCall(
      unwrapStaticExpression(current.right) as ts.LeftHandSideExpression,
      context,
      seenAliases,
    );
  }
  if (ts.isPropertyAccessExpression(current)) {
    if (
      FEEDBACK_METHODS.has(current.name.text) &&
      expressionIsFeedbackGlobalObject(
        current.expression,
        context,
        seenAliases,
      )
    ) {
      return current.name.text as "confirm" | "alert";
    }
    return objectFeedbackProperty(
      current.expression,
      current.name.text,
      context,
      seenAliases,
    );
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression
  ) {
    const propertyNames = staticPrimitiveValues(
      current.argumentExpression,
      context,
    );
    for (const propertyName of propertyNames.values) {
      if (typeof propertyName !== "string") continue;
      if (
        FEEDBACK_METHODS.has(propertyName) &&
        expressionIsFeedbackGlobalObject(
          current.expression,
          context,
          seenAliases,
        )
      ) {
        return propertyName as "confirm" | "alert";
      }
      const feedback = objectFeedbackProperty(
        current.expression,
        propertyName,
        context,
        seenAliases,
      );
      if (feedback) return feedback;
    }
  }
  return null;
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

export function detectLocalImplementations(graph: ExecutableSourceGraph) {
  const detected = new Set<LocalImplementationKind>();
  for (const [sourceFile, parsed] of graph) {
    const staticResolutionContext = { graph, sourceFile, parsed };
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const intrinsicTags = jsxIntrinsicTagNames(
          node,
          staticResolutionContext,
        );
        const isNativeElement = intrinsicTags.size > 0;
        if (intrinsicTags.has("form")) detected.add("native_form");
        if (intrinsicTags.has("table")) detected.add("native_table");
        if (intrinsicTags.has("select")) detected.add("native_select");
        if (intrinsicTags.has("dialog")) detected.add("native_dialog");
        if (intrinsicTags.has("input")) {
          const resolution = jsxStaticAttributeValues(
            node.attributes,
            "type",
            staticResolutionContext,
          );
          const normalizedValues = new Set(
            [...resolution.values].map((value) =>
              typeof value === "string" ? value.toLowerCase() : value,
            ),
          );
          if (normalizedValues.has("search"))
            detected.add("native_search_input");
          if (normalizedValues.has("date")) detected.add("native_date_input");
          if (normalizedValues.has("file")) detected.add("native_file_input");
          if (normalizedValues.has("checkbox"))
            detected.add("native_checkbox");
          if (!resolution.certain) {
            detected.add("native_search_input");
            detected.add("native_date_input");
            detected.add("native_file_input");
            detected.add("native_checkbox");
          }
        }
        const roleResolution = jsxStaticAttributeValues(
          node.attributes,
          "role",
          staticResolutionContext,
          { unresolvedSpreadTaints: false },
        );
        const normalizedRoleValues = new Set(
          [...roleResolution.values].map((value) =>
            typeof value === "string" ? value.toLowerCase() : value,
          ),
        );
        if (isNativeElement) {
          if (normalizedRoleValues.has("switch"))
            detected.add("native_switch");
          if (normalizedRoleValues.has("dialog"))
            detected.add("native_dialog");
          if (
            normalizedRoleValues.has("listbox") ||
            normalizedRoleValues.has("combobox")
          ) {
            detected.add("native_select");
          }
          if (!roleResolution.certain) {
            detected.add("native_switch");
            detected.add("native_dialog");
            detected.add("native_select");
          }
        }
        const classValues = new Set([
          ...jsxStaticAttributeValues(
            node.attributes,
            "class",
            staticResolutionContext,
          ).values,
          ...jsxStaticAttributeValues(
            node.attributes,
            "className",
            staticResolutionContext,
          ).values,
        ]);
        for (const classValue of classValues) {
          if (
            typeof classValue === "string" &&
            classValue
              .split(/\s+/u)
              .some((token) => token.startsWith("[&::-webkit-scrollbar"))
          ) {
            detected.add("local_scrollbar_style");
          }
        }
      }
      if (ts.isCallExpression(node)) {
        const isReflectApply =
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "Reflect" &&
          node.expression.name.text === "apply" &&
          identifierIsUnshadowedGlobal(parsed, node.expression.expression);
        const feedbackCall = isReflectApply && node.arguments[0]
          ? globalFeedbackCall(
              node.arguments[0] as ts.LeftHandSideExpression,
              staticResolutionContext,
            )
          : globalFeedbackCall(node.expression, staticResolutionContext);
        if (feedbackCall === "confirm") detected.add("window_confirm");
        if (feedbackCall === "alert") detected.add("window_alert");
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return detected;
}
