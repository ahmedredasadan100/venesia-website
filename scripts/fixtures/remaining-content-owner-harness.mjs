import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Execute the current source owners with fail-closed, in-memory infrastructure ports. */
export function createRemainingContentOwnerHarness(root) {
  const require = createRequire(import.meta.url);
  const files = new Set();
  const state = { rows: [], failWrite: false, writes: 0, actorCalls: 0 };
  const category = { id: 1, name: "Proof category", slug: "proof-category", is_active: true, deleted_at: null };
  function from(table) {
    assert.ok(["topics", "topic_categories", "topic_series", "projects"].includes(table), `Unexpected table ${table}`);
    let rows = table === "topics" ? state.rows : table === "topic_categories" ? [category] : table === "projects" ? [{ code: "P101" }] : [];
    let insert;
    const query = {
      select() { return query; }, limit(n) { rows = rows.slice(0, n); return query; },
      eq(k, v) { rows = rows.filter(r => r[k] === v); return query; },
      neq(k, v) { rows = rows.filter(r => r[k] !== v); return query; },
      is(k, v) { rows = rows.filter(r => (r[k] ?? null) === v); return query; },
      in(k, v) { rows = rows.filter(r => v.includes(r[k])); return query; },
      insert(value) { assert.equal(table, "topics"); insert = structuredClone(value); return query; },
      async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
      async single() {
        assert.ok(insert, "Only declared create writes are supported");
        if (state.failWrite) return { data: null, error: { message: "isolated_create_failure" } };
        const row = { ...insert, id: state.rows.length + 101 };
        state.rows.push(row); state.writes++;
        return { data: row, error: null };
      },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return query;
  }
  const ports = new Map([
    ["server-only", {}],
    ["next/navigation", { redirect(href) { throw Object.assign(new Error("isolated redirect"), { href }); } }],
    ["src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from }) }],
    ["src/lib/admin/auth/require-admin-session", { async requireAdminSession() { state.actorCalls++; return { id: 7, username: "synthetic" }; } }],
    ["src/lib/admin/audit-log", { async recordCmsAdminAudit() {} }],
    ["src/lib/admin/media-catalog/domain-write-coordination", { async coordinateMediaReferenceEntityMutation(input) { return { value: await input.mutate(), mediaSynchronization: { status: "synced" } }; } }],
    ["src/lib/admin/media-catalog/write-lease", { MediaReferenceWriteLeaseError: class extends Error {}, getMediaReferenceWriteLeaseUserMessage: String }],
    ["src/app/admin/content/topics/editor-actions/revalidate", { revalidateUnifiedContentPaths() {} }],
    ["src/lib/logging", { logError() {} }],
  ]);
  const cache = new Map();
  function load(file, roots) {
    const key = file + (roots?.join(",") ?? "");
    if (cache.has(key)) return cache.get(key).exports;
    files.add(path.relative(root, file).replaceAll("\\", "/"));
    let source = readFileSync(file, "utf8");
    if (roots) {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const declarations = new Map();
      for (const node of ast.statements) {
        if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
        if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, node);
      }
      const selected = new Set();
      function select(name) {
        const node = declarations.get(name);
        if (!node || selected.has(node)) return;
        selected.add(node);
        function visit(child) { if (ts.isIdentifier(child) && declarations.has(child.text)) select(child.text); ts.forEachChild(child, visit); }
        ts.forEachChild(node, visit);
      }
      roots.forEach(name => { assert.ok(declarations.has(name), `Current owner missing ${name}`); select(name); });
      source = ast.statements.filter(node => ts.isImportDeclaration(node) || selected.has(node)).map(node => node.getText(ast)).join("\n") + `\nexport {${roots.join(",")}};`;
    }
    const loadedModule = { exports: {} }; cache.set(key, loadedModule);
    const output = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    function resolve(specifier) {
      if (ports.has(specifier)) return ports.get(specifier);
      if (!specifier.startsWith(".")) {
        assert.ok(!specifier.startsWith("next/") && specifier !== "@supabase/supabase-js", `Undeclared infrastructure ${specifier}`);
        return require(specifier);
      }
      const base = path.resolve(path.dirname(file), specifier);
      const relative = path.relative(root, base).replaceAll("\\", "/");
      if (ports.has(relative)) return ports.get(relative);
      const target = [base, base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(target, `Unresolved current source ${relative}`);
      return load(target);
    }
    new Function("require", "module", "exports", output)(resolve, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return {
    files, state,
    media: load(path.join(root, "src/app/admin/content/topics/media-actions/save.ts")),
    hero: load(path.join(root, "src/app/admin/pages-blocks/blocks/hero/actions.ts"), ["buildHeroConfig"]),
    content: load(path.join(root, "src/app/admin/pages-blocks/blocks/content/actions.ts"), ["buildContentConfig"]),
  };
}
