import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

export function classifyVerificationImport(specifier, from, root) {
  if (isBuiltin(specifier)) return { kind: "builtin", target: specifier };
  const local = specifier.startsWith("./") || specifier.startsWith("../");
  const alias = specifier.startsWith("@/") || specifier.startsWith("@src/");
  if (!local && !alias) return { kind: "package", target: specifier };
  const base = local ? resolve(dirname(from), specifier)
    : resolve(root, "src", specifier.slice(specifier.startsWith("@src/") ? 5 : 2));
  const within = relative(root, base);
  assert.ok(within && within !== ".." && !within.startsWith(`..${sep}`) && !within.startsWith("..\\"),
    `Verification import escapes the source root: ${specifier}`);
  const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, "index.ts")]
    .find(candidate => existsSync(candidate) && statSync(candidate).isFile());
  assert.ok(target, `Unresolved verification source dependency: ${specifier}`);
  return { kind: "source", target };
}

/** Execute current TypeScript owners for a local test, leaving Node resolution to Node. */
export function loadVerificationOwner(entry, root) {
  const cache = new Map();
  function load(file) {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const output = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const requireDependency = (specifier) => {
      const dependency = classifyVerificationImport(specifier, file, root);
      return dependency.kind === "source" ? load(dependency.target) : createRequire(file)(dependency.target);
    };
    Function("module", "exports", "require", output)(mod, mod.exports, requireDependency);
    return mod.exports;
  }
  return load(resolve(entry));
}
