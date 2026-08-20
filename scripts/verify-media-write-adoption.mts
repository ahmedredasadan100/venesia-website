import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
  parseTypeScriptSource,
  type ExecutableBinding,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_SOURCE =
  "src/lib/admin/media-catalog/write-adoption-manifest.json";
const PROVIDER_SOURCE =
  "src/lib/admin/media-catalog/reference-providers.ts";
const COORDINATION_BINDINGS = [
  {
    sourceFile:
      "src/lib/admin/media-catalog/domain-write-coordination.ts",
    exportNames: [
      "coordinateMediaReferenceDomainMutation",
      "coordinateMediaReferenceEntityMutation",
    ],
  },
] as const satisfies readonly ExecutableBinding[];
const EXPLICIT_EMPTY_SYNC_BINDING = [
  {
    sourceFile: "src/lib/admin/media-catalog/synchronization.ts",
    exportNames: [
      "synchronizeMediaReferenceWriteScopesAfterDomainMutation",
    ],
  },
] as const satisfies readonly ExecutableBinding[];
const SUPPORTED_SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".jsx",
  ".mjs",
] as const;
const ALLOWED_CLASSIFICATIONS = new Set([
  "adopted",
  "neutral",
  "explicit_exception",
]);
const ALLOWED_MUTATION_CONTRACTS = new Set([
  "explicit_empty_delete",
  "explicit_empty_bulk_delete",
]);

type ProviderRegistration = {
  domainKey: string;
  table: string;
  mediaFields: readonly string[];
};

type MutationPath = {
  sourceFile: string;
  exportName: string;
  domainKey: string;
  contract: string;
};

type MediaWriteOwner = {
  id: string;
  classification: string;
  rationale: string;
  tables: readonly string[];
  mediaFields: readonly string[];
  sourceFiles: readonly string[];
  acquiresWriteLease: boolean;
  completesReferenceSync: boolean;
  structuredWarning: boolean;
  requiresExplicitEmptyCleanup?: boolean;
  mutationPaths?: readonly MutationPath[];
};

type MediaWriteManifest = {
  schemaVersion: number;
  globalClosure: boolean;
  classifications: readonly string[];
  providerRegistry: readonly ProviderRegistration[];
  owners: readonly MediaWriteOwner[];
};

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}

function parseWorkspaceSource(sourceFile: string) {
  return parseTypeScriptSource(
    sourceFile,
    readFileSync(join(ROOT, sourceFile), "utf8"),
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string,
) {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
      property.name.text === propertyName,
  );
}

function stringProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string,
) {
  const property = objectProperty(object, propertyName);
  const initializer = property ? unwrapExpression(property.initializer) : null;
  assert.ok(
    initializer && ts.isStringLiteralLike(initializer),
    `${PROVIDER_SOURCE}:${propertyName} must be a string literal.`,
  );
  return initializer.text;
}

function stringArrayProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string,
) {
  const property = objectProperty(object, propertyName);
  const initializer = property ? unwrapExpression(property.initializer) : null;
  assert.ok(
    initializer && ts.isArrayLiteralExpression(initializer),
    `${PROVIDER_SOURCE}:${propertyName} must be an explicit array.`,
  );
  return initializer.elements.map((element) => {
    const value = unwrapExpression(element);
    assert.ok(
      ts.isStringLiteralLike(value),
      `${PROVIDER_SOURCE}:${propertyName} entries must be string literals.`,
    );
    return value.text;
  });
}

function providerRegistryFromAst() {
  const parsed = parseWorkspaceSource(PROVIDER_SOURCE);
  const declaration = parsed.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find(
      (candidate) =>
        ts.isIdentifier(candidate.name) &&
        candidate.name.text === "PROVIDER_CONFIGS",
    );
  assert.ok(
    declaration?.initializer,
    `${PROVIDER_SOURCE} must declare PROVIDER_CONFIGS.`,
  );
  const initializer = unwrapExpression(declaration.initializer);
  assert.ok(
    ts.isArrayLiteralExpression(initializer),
    "PROVIDER_CONFIGS must remain an explicit AST-readable registry.",
  );
  return initializer.elements.map((element) => {
    const value = unwrapExpression(element);
    assert.ok(
      ts.isObjectLiteralExpression(value),
      "Every provider registration must be an explicit object.",
    );
    return {
      domainKey: stringProperty(value, "domainKey"),
      table: stringProperty(value, "table"),
      mediaFields: stringArrayProperty(value, "fields"),
    } satisfies ProviderRegistration;
  });
}

function compilerDiscoveredSourceFiles() {
  return ts.sys
    .readDirectory(
      ROOT,
      [...SUPPORTED_SOURCE_EXTENSIONS],
      ["**/.git/**", "**/.next/**", "**/node_modules/**"],
      ["src/**/*", "scripts/**/*"],
    )
    .map((absolutePath) => normalizePath(relative(ROOT, absolutePath)))
    .sort();
}

function callMethodName(node: ts.CallExpression) {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  return ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : null;
}

function providerTableFromReceiver(
  node: ts.Node,
  providerTables: ReadonlySet<string>,
): string | null {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "from" &&
    node.arguments.length === 1 &&
    ts.isStringLiteralLike(node.arguments[0]) &&
    providerTables.has(node.arguments[0].text)
  ) {
    return node.arguments[0].text;
  }
  let result: string | null = null;
  ts.forEachChild(node, (child) => {
    if (result === null) result = providerTableFromReceiver(child, providerTables);
  });
  return result;
}

function discoverDirectProviderWriters(
  sourceFiles: readonly string[],
  providerTables: ReadonlySet<string>,
) {
  const writers = new Map<string, Set<string>>();
  for (const sourceFile of sourceFiles) {
    const parsed = parseWorkspaceSource(sourceFile);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ["insert", "update", "upsert", "delete"].includes(
          callMethodName(node) ?? "",
        )
      ) {
        const table = providerTableFromReceiver(
          node.expression,
          providerTables,
        );
        if (table) {
          const tables = writers.get(sourceFile) ?? new Set<string>();
          tables.add(table);
          writers.set(sourceFile, tables);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return writers;
}

function exportedRuntimeDeclaration(
  parsed: ts.SourceFile,
  exportName: string,
) {
  return parsed.statements.find((statement) => {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name?.text === exportName
    ) {
      return statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
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
          declaration.name.text === exportName,
      );
    }
    return false;
  });
}

function filesCallingProviderWideSynchronization(
  sourceFiles: readonly string[],
) {
  const violations: string[] = [];
  for (const sourceFile of sourceFiles) {
    if (
      sourceFile === "src/lib/admin/media-catalog/synchronization.ts"
    ) {
      continue;
    }
    const parsed = parseWorkspaceSource(sourceFile);
    let found = false;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (
        ts.isCallExpression(node) &&
        callMethodName(node) ===
          "synchronizeMediaReferenceProvidersAfterMutation"
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (found) violations.push(sourceFile);
  }
  return violations;
}

const manifest = JSON.parse(
  readFileSync(join(ROOT, MANIFEST_SOURCE), "utf8"),
) as MediaWriteManifest;
const providers = providerRegistryFromAst();
const sourceFiles = compilerDiscoveredSourceFiles();

assert.equal(manifest.schemaVersion, 2, "Media write manifest schema must be 2.");
assert.equal(
  manifest.globalClosure,
  true,
  "Media write adoption cannot claim partial global closure.",
);
assert.deepEqual(
  new Set(manifest.classifications),
  ALLOWED_CLASSIFICATIONS,
  "Media write classifications must remain explicit and complete.",
);
assert.equal(
  new Set(providers.map((provider) => provider.domainKey)).size,
  providers.length,
  "Provider domain keys must be unique.",
);
assert.equal(
  new Set(manifest.owners.map((owner) => owner.id)).size,
  manifest.owners.length,
  "Media write owner IDs must be unique.",
);
assert.deepEqual(
  manifest.providerRegistry
    .map((provider) => ({
      ...provider,
      mediaFields: [...provider.mediaFields].sort(),
    }))
    .sort((left, right) => left.domainKey.localeCompare(right.domainKey)),
  providers
    .map((provider) => ({
      ...provider,
      mediaFields: [...provider.mediaFields].sort(),
    }))
    .sort((left, right) => left.domainKey.localeCompare(right.domainKey)),
  "Manifest providers must equal the AST-extracted executable provider registry.",
);

const providerTables = new Set(providers.map((provider) => provider.table));
const classifiedFiles = new Map<string, Set<string>>();
const classifiedTables = new Map<string, Set<string>>();

for (const owner of manifest.owners) {
  assert.ok(
    ALLOWED_CLASSIFICATIONS.has(owner.classification),
    `${owner.id} has an unknown classification.`,
  );
  assert.ok(
    owner.rationale.trim().length >= 20,
    `${owner.id} requires an explicit rationale.`,
  );
  assert.equal(
    typeof owner.acquiresWriteLease,
    "boolean",
    `${owner.id} must declare write-lease applicability.`,
  );
  assert.equal(
    typeof owner.completesReferenceSync,
    "boolean",
    `${owner.id} must declare reference-sync applicability.`,
  );
  assert.equal(
    typeof owner.structuredWarning,
    "boolean",
    `${owner.id} must declare warning applicability.`,
  );
  for (const sourceFile of owner.sourceFiles) {
    assert.ok(
      existsSync(join(ROOT, sourceFile)),
      `${owner.id} registers missing source ${sourceFile}.`,
    );
    const classifications = classifiedFiles.get(sourceFile) ?? new Set<string>();
    classifications.add(owner.classification);
    classifiedFiles.set(sourceFile, classifications);
    const tables = classifiedTables.get(sourceFile) ?? new Set<string>();
    for (const table of owner.tables) tables.add(table);
    classifiedTables.set(sourceFile, tables);
  }

  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: owner.sourceFiles,
  });
  if (owner.classification === "adopted") {
    assert.equal(owner.acquiresWriteLease, true, `${owner.id} must acquire a lease.`);
    assert.equal(owner.completesReferenceSync, true, `${owner.id} must sync references.`);
    assert.equal(owner.structuredWarning, true, `${owner.id} must expose warnings.`);
    assert.ok(
      graphUsesExecutableBinding({
        root: ROOT,
        graph,
        bindings: COORDINATION_BINDINGS,
      }),
      `${owner.id} has no executable Media coordination binding.`,
    );
  }
  if (owner.requiresExplicitEmptyCleanup) {
    assert.equal(
      owner.classification,
      "explicit_exception",
      `${owner.id} explicit-empty cleanup must be an approved exception.`,
    );
    assert.ok(
      graphUsesExecutableBinding({
        root: ROOT,
        graph,
        bindings: EXPLICIT_EMPTY_SYNC_BINDING,
      }),
      `${owner.id} has no executable explicit-empty synchronization binding.`,
    );
  }

  for (const mutationPath of owner.mutationPaths ?? []) {
    assert.ok(
      owner.sourceFiles.includes(mutationPath.sourceFile),
      `${owner.id}:${mutationPath.exportName} must bind a registered owner source.`,
    );
    assert.ok(
      owner.tables.includes(mutationPath.domainKey),
      `${owner.id}:${mutationPath.exportName} names an undeclared provider.`,
    );
    assert.ok(
      ALLOWED_MUTATION_CONTRACTS.has(mutationPath.contract),
      `${owner.id}:${mutationPath.exportName} has an unknown mutation contract.`,
    );
    const parsed = parseWorkspaceSource(mutationPath.sourceFile);
    assert.ok(
      exportedRuntimeDeclaration(parsed, mutationPath.exportName),
      `${owner.id}:${mutationPath.exportName} is not an executable export.`,
    );
    const mutationGraph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: [mutationPath.sourceFile],
    });
    assert.ok(
      graphUsesExecutableBinding({
        root: ROOT,
        graph: mutationGraph,
        bindings: EXPLICIT_EMPTY_SYNC_BINDING,
      }),
      `${owner.id}:${mutationPath.exportName} cannot reach explicit-empty synchronization.`,
    );
  }
}

const directWriters = discoverDirectProviderWriters(sourceFiles, providerTables);
for (const [sourceFile, tables] of directWriters) {
  assert.ok(
    classifiedFiles.has(sourceFile),
    `Direct provider writer ${sourceFile} is not registered.`,
  );
  const registeredTables = classifiedTables.get(sourceFile) ?? new Set<string>();
  for (const table of tables) {
    assert.ok(
      registeredTables.has(table),
      `${sourceFile} writes unregistered provider table ${table}.`,
    );
  }
  assert.ok(
    !sourceFile.startsWith("scripts/"),
    `Direct tooling writer ${sourceFile} is forbidden after global closure.`,
  );
}

assert.deepEqual(
  filesCallingProviderWideSynchronization(sourceFiles),
  [],
  "Domain mutations cannot invoke provider-wide synchronization.",
);

const classificationCounts = Object.fromEntries(
  [...ALLOWED_CLASSIFICATIONS].map((classification) => [
    classification,
    manifest.owners.filter(
      (owner) => owner.classification === classification,
    ).length,
  ]),
);

console.log("Executable Media write adoption guard passed.");
console.log(
  JSON.stringify(
    {
      providers: providers.length,
      compilerDiscoveredSources: sourceFiles.length,
      directWriterOwners: directWriters.size,
      classifications: classificationCounts,
      globalClosure: manifest.globalClosure,
    },
    null,
    2,
  ),
);
