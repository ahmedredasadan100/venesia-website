import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Execute the current source owners with fail-closed, in-memory infrastructure ports. */
export function createRemainingContentOwnerHarness(root, { sourceOverrides = new Map(), additionalPorts = new Map() } = {}) {
  const require = createRequire(import.meta.url);
  const files = new Set();
  const state = { rows: [], failWrite: false, writes: 0, actorCalls: 0 };
  const category = { id: 1, name: "Proof category", slug: "proof-category", parent_id: null, sort_order: 1, status: "published", is_active: true, deleted_at: null };
  function from(table) {
    assert.ok(["topics", "topic_categories", "topic_series", "projects"].includes(table), `Unexpected table ${table}`);
    let rows = table === "topics" ? state.rows : table === "topic_categories" ? [category] : table === "projects" ? [{ code: "P101" }] : [];
    let insert;
    const query = {
      select() { return query; }, limit(n) { rows = rows.slice(0, n); return query; },
      order() { return query; },
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
    // Load the real bounded retry owner; only its Next infrastructure is isolated.
    ["next/cache", { revalidatePath() {}, revalidateTag() {}, updateTag() {} }],
    ["src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from }) }],
    ["src/lib/admin/auth/require-admin-session", { async requireAdminSession() { state.actorCalls++; return { id: 7, username: "synthetic" }; } }],
    ["src/lib/admin/audit-log", { async recordCmsAdminAudit() {} }],
    ["src/lib/admin/media-catalog/domain-write-coordination", { async coordinateMediaReferenceEntityMutation(input) { return { value: await input.mutate(), mediaSynchronization: { status: "synced" } }; } }],
    ["src/lib/admin/media-catalog/write-lease", { MediaReferenceWriteLeaseError: class extends Error {}, getMediaReferenceWriteLeaseUserMessage: String }],
    ["src/app/admin/content/topics/editor-actions/revalidate", { revalidateUnifiedContentPaths() {} }],
    ["src/lib/logging", { logError() {} }],
  ]);
  const cache = new Map();
  for (const [specifier, value] of additionalPorts) ports.set(specifier, value);
  function load(file, roots) {
    const key = file + (roots?.join(",") ?? "");
    if (cache.has(key)) return cache.get(key).exports;
    files.add(path.relative(root, file).replaceAll("\\", "/"));
    let source = sourceOverrides.get(path.relative(root, file).replaceAll("\\", "/")) ?? readFileSync(file, "utf8");
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
    // The isolated executor is CommonJS, including selected roots from .mts fixtures.
    const output = ts.transpileModule(source, { fileName: file.replace(/\.mts$/, ".ts"), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
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
    files, state, load,
    media: load(path.join(root, "src/app/admin/content/topics/media-actions/save.ts")),
    hero: load(path.join(root, "src/app/admin/pages-blocks/blocks/hero/actions.ts"), ["buildHeroConfig"]),
    content: load(path.join(root, "src/app/admin/pages-blocks/blocks/content/actions.ts"), ["buildContentConfig"]),
  };
}

/** Real topic actions and payload/validation owners; only infrastructure is isolated.
 * The production slug constraint is enforced by in-memory PostgreSQL. The second
 * unique constraint exists only to prove that a non-slug uniqueness error is not
 * reported as a slug conflict. This fixture never connects to a hosted database.
 */
export async function createTopicSlugSaveHarness(root, {
  rows = [],
  sourceOverrides = new Map(),
  categories = [{ id: 1, name: "Proof category", slug: "proof-category", parent_id: null, is_active: true, status: "published", deleted_at: null }],
  series = [],
} = {}) {
  const { PGlite } = await import("@electric-sql/pglite");
  const database = new PGlite();
  await database.exec(`create table topics (
    id integer generated by default as identity primary key,
    slug text not null constraint topics_slug_key unique,
    title text not null constraint topics_non_slug_fixture_key unique,
    row_data jsonb not null
  )`);
  const state = { writeAttempts: 0, writeErrors: [], reads: [], outcome: "success", raceRows: 0, injectedRowIds: [], audits: 0, revalidations: [], revalidatedPaths: [] };
  const readAll = async () => (await database.query("select row_data || jsonb_build_object('id', id, 'slug', slug) as row from topics order by id")).rows.map(({ row }) => row);
  async function seed(row) {
    const value = structuredClone(row);
    assert.ok(typeof value.slug === "string" && typeof value.title === "string", "A seed requires persisted title and slug");
    const columns = value.id ? "id, slug, title, row_data" : "slug, title, row_data";
    const parameters = value.id ? [value.id, value.slug, value.title, value] : [value.slug, value.title, value];
    const placeholders = parameters.map((_, index) => `$${index + 1}`).join(", ");
    const result = await database.query(`insert into topics (${columns}) values (${placeholders}) returning id`, parameters);
    return result.rows[0].id;
  }
  async function read(id) {
    return (await readAll()).find(row => row.id === Number(id)) ?? null;
  }
  function matches(row, filters) {
    return filters.every(([operation, key, value]) => operation === "in"
      ? value.includes(row[key])
      : operation === "neq" ? row[key] !== value
        : (row[key] ?? null) === value);
  }
  function from(table) {
    assert.ok(["topics", "topic_categories", "topic_series", "projects"].includes(table), `Unexpected table ${table}`);
    const filters = [];
    let payload, inserting = false, limit;
    const query = {
      select() { return query; }, order() { return query; },
      limit(value) { limit = value; return query; },
      eq(key, value) { filters.push(["eq", key, value]); return query; },
      neq(key, value) { filters.push(["neq", key, value]); return query; },
      is(key, value) { filters.push(["eq", key, value]); return query; },
      in(key, value) { filters.push(["in", key, value]); return query; },
      insert(value) { assert.equal(table, "topics"); payload = structuredClone(value); inserting = true; return query; },
      update(value) { assert.equal(table, "topics"); payload = structuredClone(value); return query; },
      async maybeSingle() { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
      single() { return query.maybeSingle(); },
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    async function execute() {
      if (!payload) {
        const source = table === "topics" ? await readAll() : table === "topic_categories" ? categories : table === "topic_series" ? series : [{ code: "P101" }];
        const selected = source.filter(row => matches(row, filters));
        state.reads.push({ table, filters: structuredClone(filters), ids: selected.map(row => row.id) });
        return { data: structuredClone(limit === undefined ? selected : selected.slice(0, limit)), error: null };
      }
      state.writeAttempts++;
      try {
        if (state.outcome === "database-error") {
          return { data: null, error: { code: "42501", message: "isolated_permission_denied: slug write was rejected" } };
        }
        if (["slug-conflict", "non-slug-unique"].includes(state.outcome)) {
          const competing = {
            title: state.outcome === "non-slug-unique" ? payload.title : `Competing ${++state.raceRows}`,
            slug: state.outcome === "slug-conflict" ? payload.slug : `other-slug-${++state.raceRows}`,
            content_type: payload.content_type === "article" ? "news" : "article", deleted_at: null,
          };
          state.injectedRowIds.push(await seed(competing));
        }
        if (inserting) {
          const id = await seed(payload);
          return { data: [await read(id)], error: null };
        }
        const current = (await readAll()).find(row => matches(row, filters));
        if (!current) return { data: [], error: null };
        const updated = { ...current, ...payload };
        // Keep the action's revision comparison at the SQL write boundary.
        const expected = filters.find(([, key]) => key === "updated_at");
        const revisionSql = expected ? " and row_data->>'updated_at' is not distinct from $5::text" : "";
        const parameters = [updated.slug, updated.title, updated, current.id, ...(expected ? [expected[2]] : [])];
        const result = await database.query(`update topics set slug = $1, title = $2, row_data = $3 where id = $4${revisionSql} returning id`, parameters);
        return { data: result.rows.length ? [await read(current.id)] : [], error: null };
      } catch (error) {
        // Match PostgREST's public error shape: structured PG constraint identity
        // is deliberately absent, so the exact known message path is exercised.
        const publicError = { code: error.code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null };
        state.writeErrors.push({ ...publicError, postgresConstraint: error.constraint ?? null });
        return { data: null, error: publicError };
      }
    }
    return query;
  }
  let revalidationOwner;
  const owners = createRemainingContentOwnerHarness(root, { sourceOverrides, additionalPorts: new Map([
    ["src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from }) }],
    ["src/lib/admin/audit-log", { async recordCmsAdminAudit() { state.audits++; } }],
    ["next/cache", { revalidatePath(value) { state.revalidatedPaths.push(value); }, revalidateTag() {}, updateTag() {} }],
    ["src/app/admin/content/topics/editor-actions/revalidate", { revalidateUnifiedContentPaths(options) { state.revalidations.push(structuredClone(options)); return revalidationOwner.revalidateUnifiedContentPaths(options); } }],
  ]) });
  revalidationOwner = owners.load(path.join(root, "src/app/admin/content/topics/editor-actions/revalidate.ts"));
  const article = owners.load(path.join(root, "src/app/admin/content/topics/article-actions/save.ts"));
  const { CONTENT_TYPES } = owners.load(path.join(root, "src/lib/admin/content/content-types.ts"));
  async function reset(nextRows = []) {
    await database.exec("truncate topics restart identity");
    state.writeAttempts = 0; state.writeErrors = []; state.reads = []; state.outcome = "success"; state.raceRows = 0; state.injectedRowIds = []; state.audits = 0; state.revalidations = []; state.revalidatedPaths = [];
    for (const row of nextRows) await seed(row);
    // Explicit fixture IDs must not collide with generated IDs on later saves.
    await database.query("select setval(pg_get_serial_sequence('topics', 'id'), greatest(coalesce((select max(id) from topics), 0) + 1, 1), false)");
  }
  await reset(rows);
  return {
    state, owners, seed, read, reset, close: () => database.close(),
    async clearInjectedRows() {
      for (const id of state.injectedRowIds) await database.query("delete from topics where id = $1", [id]);
      state.injectedRowIds = [];
    },
    async save({ contentType, mode, entries, outcome = "success", previousState }) {
      assert.ok(CONTENT_TYPES.includes(contentType));
      assert.ok(["create", "edit"].includes(mode));
      assert.ok(["success", "slug-conflict", "non-slug-unique", "database-error"].includes(outcome));
      const form = new FormData();
      for (const [key, value] of entries instanceof FormData ? entries : Array.isArray(entries) ? entries : Object.entries(entries)) form.append(key, value);
      form.set("content_type", contentType);
      assert.equal(form.has("id"), mode === "edit", "Save mode must match the native id field");
      state.outcome = outcome;
      const beforeRows = await readAll(), beforeAttempts = state.writeAttempts, beforeErrors = state.writeErrors.length;
      const action = contentType === "article" ? article.saveArticleContentAdapter : owners.media.saveMediaContentAdapter;
      const result = await action(previousState ?? { status: "idle", mode, revision: 0 }, form);
      const afterRows = await readAll();
      return {
        result, beforeRows, afterRows,
        row: result.entityId ? await read(result.entityId) : form.has("id") ? await read(form.get("id")) : null,
        writeAttempts: state.writeAttempts - beforeAttempts,
        writeErrors: state.writeErrors.slice(beforeErrors),
      };
    },
  };
}
