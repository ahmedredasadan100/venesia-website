import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

type BoundaryFailure = { owner: string; source: string; dependency: string; contract: string };
const normalize = (value: string) => value.replaceAll("\\", "/");

/** The groups below are the existing owners in the architecture constitution. */
function boundaryFor(source: string, dependency: string): BoundaryFailure | null {
  if ((source.startsWith("src/app/(site)/")
    || (source.startsWith("src/components/") && !source.startsWith("src/components/admin/")))
    && (dependency === "src/lib/supabase-admin.ts" || dependency === "src/lib/supabase-fetch.ts"
      || dependency.startsWith("node_modules/@supabase/supabase-js/")
      || /node_modules\/next\/cache(?:\.d)?\.(?:ts|js)$/u.test(dependency)))
    return { owner: "Public presentation and composition", source, dependency,
      contract: "Public templates and presentation modules must use existing public data and cache owners, never database clients, transport, or revalidation directly." };
  if (source.startsWith("src/components/admin/entity-list/")
    && (dependency === "src/lib/supabase-admin.ts" || dependency.startsWith("src/app/admin/")))
    return { owner: "Admin Entity List shared presentation", source, dependency,
      contract: "Shared components collect intent; database actions belong to the consumer or domain owner." };
  if (source.startsWith("src/lib/admin/entity-list/data-engine/")
    && (dependency.startsWith("src/lib/admin/projects/") || dependency.startsWith("src/lib/admin/content/") || dependency.startsWith("src/app/admin/"))) {
    // The canonical server-only registry is the declared composition root for adapters.
    if (!(source === "src/lib/admin/entity-list/data-engine/registry.ts"
      && (dependency.endsWith("-adapter.ts") || dependency.includes("/entity-list-adapters/"))))
      return { owner: "Admin Data Runtime", source, dependency,
        contract: "The generic data lifecycle consumes typed callbacks and contracts, not entity implementations." };
  }
  if ((source.startsWith("src/lib/content/public-content-read/") || /^src\/lib\/admin\/projects\/[^/]+-data\.ts$/u.test(source))
    && dependency === "src/lib/supabase-fetch.ts")
    return { owner: "Domain read owner", source, dependency,
      contract: "Read owners receive timing callbacks from their coordinator; transport tracing remains transport owned." };
  return null;
}

export function evaluateArchitectureBoundaries(root: string, files: readonly string[], overrides = new Map<string, string>()) {
  const config = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  const failures: BoundaryFailure[] = [];
  for (const file of files) {
    if (!/\.[cm]?[jt]sx?$/u.test(file)) continue;
    const absolute = resolve(root, file);
    const source = ts.createSourceFile(absolute, overrides.get(file) ?? readFileSync(absolute, "utf8"), ts.ScriptTarget.Latest, true);
    const inspect = (specifier: string) => {
      const target = ts.resolveModuleName(specifier, absolute, options, ts.sys).resolvedModule?.resolvedFileName;
      if (!target) return;
      const dependency = normalize(relative(root, target));
      const failure = boundaryFor(file, dependency);
      if (failure) failures.push(failure);
    };
    const walk = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const allTypeOnly = clause?.isTypeOnly || (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
          && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(item => item.isTypeOnly));
        if (!allTypeOnly) inspect(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        inspect(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        inspect(node.arguments[0].text);
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  return failures;
}

export function currentArchitectureBoundaryFiles(root: string) {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "src/components/admin/entity-list",
    "src/lib/admin/entity-list/data-engine", "src/lib/admin/projects", "src/lib/content/public-content-read",
    "src/app/(site)", "src/components"],
    { cwd: root }).toString("utf8").split("\0").filter(Boolean);
}
