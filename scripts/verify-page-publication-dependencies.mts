import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const ports = new Map<string, unknown>([["server-only", {}]]);
const modules = new Map<string, { exports: unknown }>();
const port = (file: string, value: unknown) => ports.set(path.resolve(root, file), value);

function load<T>(file: string): T {
  const filename = path.resolve(root, file);
  if (ports.has(filename)) return ports.get(filename) as T;
  if (modules.has(filename)) return modules.get(filename)!.exports as T;
  assert.ok(filename.startsWith(`${root}${path.sep}src${path.sep}`));
  const target = { exports: {} as unknown };
  modules.set(filename, target);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (ports.has(specifier)) return ports.get(specifier);
    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), specifier);
      if (ports.has(base)) return ports.get(base);
      const candidate = [base, `${base}.ts`, path.join(base, "index.ts")]
        .find((item) => ports.has(item) || existsSync(item) && statSync(item).isFile());
      assert.ok(candidate, `Unresolved current owner: ${specifier}`);
      return load(candidate);
    }
    assert.ok(["zod"].includes(specifier), `Unexpected dependency: ${specifier}`);
    return nativeRequire(specifier);
  };
  new vm.Script(`(function(require,module,exports){${compiled}\n})`, { filename })
    .runInThisContext()(localRequire, target, target.exports);
  return target.exports as T;
}

type Row = Record<string, unknown>;
type DbResult = { data: Row | Row[] | null; error: { message: string } | null };
const initial = {
  pages: [
    { id: 69, slug: "search", path: "/search", status: "published", updated_at: "2026-09-18T00:00:00.000Z" },
    { id: 4, slug: "topics", path: "/topics", status: "published", updated_at: "2026-09-17T00:00:00.000Z" },
    { id: 8, slug: "about", path: "/about", status: "published", updated_at: "2026-09-17T00:00:00.000Z" },
  ],
  content_block_templates: [
    { id: 182, slug: "search-platform", variant: "search-platform", status: "published" },
    { id: 183, slug: "topics-search", variant: "search-platform", status: "published" },
  ],
  page_content_block_assignments: [
    { page_id: 69, template_id: 182, is_visible: true },
    { page_id: 4, template_id: 183, is_visible: true },
  ],
};
const state = {
  tables: structuredClone(initial) as Record<string, Row[]>,
  writes: [] as Row[], audits: [] as Row[], revalidations: [] as number[],
  authCalls: 0, failRead: "", conflictOnWrite: false,
};

class Query implements PromiseLike<DbResult> {
  private readonly table: string;
  private filters: Array<{ key: string; value: unknown; mode: "eq" | "in" }> = [];
  private payload: Row | null = null;
  private singular = false;
  constructor(table: string) {
    this.table = table;
    assert.ok(Object.hasOwn(state.tables, table), `Unexpected table ${table}`);
  }
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push({ key, value, mode: "eq" }); return this; }
  in(key: string, value: unknown[]) { this.filters.push({ key, value, mode: "in" }); return this; }
  update(payload: Row) { this.payload = structuredClone(payload); return this; }
  maybeSingle() { this.singular = true; return this; }
  then<T = DbResult, U = never>(ok?: ((value: DbResult) => T | PromiseLike<T>) | null, fail?: ((reason: unknown) => U | PromiseLike<U>) | null): PromiseLike<T | U> {
    return Promise.resolve().then((): DbResult => {
      if (!this.payload && state.failRead === this.table) return { data: null, error: { message: "isolated_dependency_read_failure" } };
      let rows = state.tables[this.table].filter((row) => this.filters.every((filter) =>
        filter.mode === "eq" ? row[filter.key] === filter.value : (filter.value as unknown[]).includes(row[filter.key]),
      ));
      if (this.payload) {
        state.writes.push({ table: this.table, filters: structuredClone(this.filters), payload: structuredClone(this.payload) });
        if (state.conflictOnWrite) rows = [];
        else rows.forEach((row) => Object.assign(row, this.payload));
      }
      return { data: structuredClone(this.singular ? rows[0] ?? null : rows), error: null };
    }).then(ok, fail);
  }
}

port("src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from: (table: string) => new Query(table) }) });
port("src/lib/admin/auth/require-admin-session", { async requireAdminSession() { state.authCalls++; return { id: 7, username: "qa" }; } });
port("src/lib/admin/audit-log", { async recordCmsAdminAudit(value: Row) { state.audits.push(structuredClone(value)); } });
port("src/lib/page-blocks/admin-revalidate", { async revalidatePageBlocksPath(id: number) { state.revalidations.push(id); } });

const action = load<typeof import("../src/app/admin/pages-blocks/pages/page-actions/page-status.ts")>(
  "src/app/admin/pages-blocks/pages/page-actions/page-status.ts",
);
const searchConfig = load<typeof import("../src/lib/page-blocks/search-platform-config.ts")>("src/lib/page-blocks/search-platform-config.ts");

function reset() {
  state.tables = structuredClone(initial) as Record<string, Row[]>;
  state.writes.length = state.audits.length = state.revalidations.length = 0;
  state.authCalls = 0; state.failRead = ""; state.conflictOnWrite = false;
}
function page(id = 69) { return state.tables.pages.find((row) => row.id === id)!; }
async function toggle(id = 69, status = String(page(id).status), revision = String(page(id).updated_at)) {
  return action.togglePageStatus(id, status, revision);
}
function assertNoWrite() { assert.equal(state.writes.length, 0); assert.equal(state.audits.length, 0); assert.equal(state.revalidations.length, 0); }
const passed: string[] = [];
async function check(name: string, run: () => Promise<void> | void) { reset(); await run(); passed.push(name); console.log(`PASS ${name}`); }

await check("canonical Search destination is owned by the Search Platform contract", () => {
  assert.equal(searchConfig.SEARCH_PLATFORM_PUBLIC_ROUTE.href, "/search");
  assert.equal(searchConfig.SEARCH_PLATFORM_PUBLIC_ROUTE.cmsPageSlug, "search");
});
await check("published visible launcher blocks destination unpublish before write", async () => {
  const result = await toggle();
  assert.equal(result.ok, false); assert.equal(result.code, "dependency_invariant_broken");
  assert.match(result.message, /اعتمادات عامة/); assertNoWrite();
});
await check("the invariant follows a different Search Page ID", async () => {
  page().id = 901; state.tables.page_content_block_assignments[0].page_id = 901;
  const result = await toggle(901);
  assert.equal(result.ok, false); assert.equal(result.code, "dependency_invariant_broken"); assertNoWrite();
});
await check("unrelated published Page can unpublish with revision and audit", async () => {
  const result = await toggle(8);
  assert.equal(result.ok, true); assert.equal(result.status, "unpublished");
  assert.equal(state.writes.length, 1); assert.equal(state.audits.length, 1); assert.deepEqual(state.revalidations, [8]);
});
await check("Search destination can unpublish when no public dependency exists", async () => {
  state.tables.page_content_block_assignments = state.tables.page_content_block_assignments.filter((row) => row.template_id !== 183);
  const result = await toggle(); assert.equal(result.ok, true); assert.equal(result.status, "unpublished");
});
await check("hidden launcher does not block", async () => {
  state.tables.page_content_block_assignments[1].is_visible = false;
  const result = await toggle(); assert.equal(result.ok, true);
});
await check("unpublished launcher template does not block", async () => {
  state.tables.content_block_templates[1].status = "unpublished";
  const result = await toggle(); assert.equal(result.ok, true);
});
await check("launcher on unpublished Page does not block", async () => {
  page(4).status = "unpublished";
  const result = await toggle(); assert.equal(result.ok, true);
});
await check("publishing the destination requires visible assignment and published template", async () => {
  page().status = "unpublished";
  state.tables.page_content_block_assignments[0].is_visible = false;
  const result = await toggle(); assert.equal(result.ok, false); assert.equal(result.code, "dependency_invariant_broken"); assertNoWrite();
});
await check("dependency read failure fails closed before write", async () => {
  state.failRead = "page_content_block_assignments";
  const result = await toggle(); assert.equal(result.ok, false); assert.equal(result.code, "dependency_read_failed"); assertNoWrite();
});
await check("stale caller state is rejected before dependency reads or write", async () => {
  const result = await toggle(69, "unpublished", String(page().updated_at));
  assert.equal(result.ok, false); assert.equal(result.code, "revision_conflict"); assertNoWrite();
});
await check("concurrent revision conflict creates no audit or revalidation", async () => {
  state.tables.page_content_block_assignments[1].is_visible = false;
  state.conflictOnWrite = true;
  const result = await toggle(); assert.equal(result.ok, false); assert.equal(result.code, "revision_conflict");
  assert.equal(state.writes.length, 1); assert.equal(state.audits.length, 0); assert.equal(state.revalidations.length, 0);
});
await check("publishing valid Search destination records dependency audit and revalidation", async () => {
  page().status = "unpublished";
  const result = await toggle(); assert.equal(result.ok, true); assert.equal(result.status, "published");
  assert.equal(state.audits.length, 1); assert.equal((state.audits[0].metadata as Row).previous_status, "unpublished");
  assert.deepEqual(state.revalidations, [69]);
});

console.log(JSON.stringify({ passed: passed.length, failed: 0, scope: "Current Page publication mutation owner and Search public dependency owners; isolated DB/Auth/cache ports." }));
