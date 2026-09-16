import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Execute unchanged Page read/edit/publication owners. Only infrastructure and
// the terminal Client Component are isolated, following the existing action
// verification harness pattern. This is not DB, Auth, Browser or E2E proof.
const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const ports = new Map<string, unknown>([["server-only", {}]]);
const modules = new Map<string, { exports: unknown }>();
const sourceFiles = new Set<string>();
const port = (file: string, value: unknown) => ports.set(path.resolve(root, file), value);

function load<T>(file: string): T {
  const filename = path.resolve(root, file);
  if (ports.has(filename)) return ports.get(filename) as T;
  if (modules.has(filename)) return modules.get(filename)!.exports as T;
  assert.ok(filename.startsWith(`${root}${path.sep}src${path.sep}`), "Only current source owners may load");
  const target = { exports: {} as unknown };
  modules.set(filename, target);
  sourceFiles.add(path.relative(root, filename).replaceAll("\\", "/"));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (ports.has(specifier)) return ports.get(specifier);
    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), specifier);
      if (ports.has(base)) return ports.get(base);
      const candidate = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]
        .find((item) => ports.has(item) || existsSync(item) && statSync(item).isFile());
      assert.ok(candidate, `Unresolved current owner: ${specifier}`);
      return load(candidate);
    }
    assert.ok(["react", "react/jsx-runtime", "zod"].includes(specifier), `Undeclared package/transport: ${specifier}`);
    return nativeRequire(specifier);
  };
  new vm.Script(`(function(require,module,exports){${compiled}\n})`, { filename })
    .runInThisContext()(localRequire, target, target.exports);
  return target.exports as T;
}

type Row = Record<string, unknown>;
type Result = { data: Row | Row[] | null; error: { message: string } | null };
const state = {
  page: null as Row | null,
  reads: [] as string[],
  writes: [] as { table: string; filters: Row; payload: Row }[],
  audits: [] as Row[],
  cache: [] as { kind: string; args: unknown[] }[],
  authCalls: 0, denyAuth: false, failWrite: false, failReadTable: "",
};
const assignmentTables = new Set([
  "page_content_block_assignments", "page_cta_block_assignments", "page_cards_block_assignments",
  "page_breadcrumb_block_assignments", "page_feed_module_assignments", "page_featured_module_assignments",
  "hero_assignments", "page_media_sidebar_module_assignments", "page_media_hub_module_assignments",
]);
const templateTables = new Set([
  "content_block_templates", "cta_block_templates", "cards_block_templates", "breadcrumb_block_templates",
  "feed_module_templates", "featured_module_templates", "hero_templates",
  "media_sidebar_module_templates", "media_hub_module_templates",
]);
const availableTemplate: Row = {
  id: 401, name: "Available authored module", slug: "home-story", status: "published", variant: "about-intro", config: {},
};

class Query implements PromiseLike<Result> {
  private table: string;
  private filters: Row = {};
  private payload: Row | null = null;
  private singular = false;
  constructor(table: string) {
    this.table = table;
    assert.ok(table === "pages" || assignmentTables.has(table) || templateTables.has(table), `Unexpected table: ${table}`);
  }
  select() { return this; }
  order() { return this; }
  eq(key: string, value: unknown) { this.filters[key] = value; return this; }
  maybeSingle() { this.singular = true; return this; }
  update(payload: Row) { assert.equal(this.table, "pages"); this.payload = structuredClone(payload); return this; }
  then<T = Result, U = never>(fulfilled?: ((value: Result) => T | PromiseLike<T>) | null, rejected?: ((reason: unknown) => U | PromiseLike<U>) | null): PromiseLike<T | U> {
    return Promise.resolve().then((): Result => {
      if (this.payload) {
        assert.deepEqual(this.filters, { id: state.page?.id }, "Writes must target exactly the persisted Home ID");
        state.writes.push({ table: this.table, filters: { ...this.filters }, payload: { ...this.payload } });
        if (state.failWrite) return { data: null, error: { message: "isolated_write_rejected" } };
        assert.ok(state.page);
        Object.assign(state.page, this.payload);
        return { data: null, error: null };
      }
      state.reads.push(this.table);
      if (this.table === state.failReadTable) return { data: null, error: { message: "isolated_read_rejected" } };
      const rows = this.table === "pages" ? state.page ? [state.page] : []
        : this.table === "content_block_templates" ? [availableTemplate] : [];
      const selected = rows.filter((row) => Object.entries(this.filters).every(([key, value]) => row[key] === value));
      return { data: structuredClone(this.singular ? selected[0] ?? null : selected), error: null };
    }).then(fulfilled, rejected);
  }
}

class RedirectSignal extends Error {
  readonly href: string;
  constructor(href: string) { super("isolated_redirect"); this.href = href; }
}
class NotFoundSignal extends Error {}
const terminalClient = () => null;
const emptyComponent = () => null;
const cacheCall = (kind: string, ...args: unknown[]) => state.cache.push({ kind, args });
ports.set("next/navigation", {
  redirect(href: string): never { throw new RedirectSignal(href); },
  notFound(): never { throw new NotFoundSignal(); },
});
ports.set("next/cache", {
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: (...args: unknown[]) => cacheCall("path", ...args),
  revalidateTag: (...args: unknown[]) => cacheCall("tag", ...args),
  updateTag: (...args: unknown[]) => cacheCall("update", ...args),
});
port("src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from: (table: string) => new Query(table) }) });
port("src/lib/admin/auth/require-admin-session", {
  async requireAdminSession() {
    state.authCalls++;
    if (state.denyAuth) throw new Error("isolated_auth_rejected");
    return { id: 7, username: "synthetic" };
  },
});
port("src/lib/admin/audit-log", { async recordCmsAdminAudit(value: Row) { state.audits.push(structuredClone(value)); } });
port("src/lib/cache/revalidate-public-cache-tags", {
  revalidatePublicCacheTags: (...args: unknown[]) => cacheCall("public", ...args),
  revalidatePageCompositionCache: (...args: unknown[]) => cacheCall("composition", ...args),
  revalidateBlockModuleCache: (...args: unknown[]) => cacheCall("module", ...args),
});
port("src/lib/logging", { logError() {} });
port("src/lib/admin/preferences/admin-column-preferences", { async readAdminColumnPreferences() { return { visibleColumns: null, error: null }; } });
port("src/components/admin/AdminFeedbackProvider", { AdminFeedbackRegion: emptyComponent });
port("src/components/admin/ui", { AdminPageContextHeader: emptyComponent, AdminPageExperience: emptyComponent });
port("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient", { __esModule: true, default: terminalClient });

const defaults = load<typeof import("../src/lib/seo/global-seo-defaults.ts")>("src/lib/seo/global-seo-defaults.ts");
port("src/lib/seo/load-global-seo-settings", { async loadGlobalSeoSettings() { return defaults.getGlobalSeoDefaults(); } });
const routes = load<typeof import("../src/lib/admin/links/static-routes.ts")>("src/lib/admin/links/static-routes.ts");
const route = routes.getPublicPageRoute("home");
const initialHome: Row = {
  id: 9001, title: route.label, slug: route.cmsPageSlug, path: route.href, page_type: "home",
  status: "unpublished", is_system: true, sort_order: 0,
  seo_title: "", seo_description: "", seo_keywords: [], focus_keyword: "", og_image_alt: "",
  canonical_url: null, robots_index: null, robots_follow: null, og_image: null,
  created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
};
function reset() {
  state.page = structuredClone(initialHome);
  state.reads.length = state.writes.length = state.audits.length = state.cache.length = 0;
  state.authCalls = 0; state.denyAuth = state.failWrite = false; state.failReadTable = "";
}
const detail = load<typeof import("../src/app/admin/pages-blocks/pages/[id]/page.tsx")>("src/app/admin/pages-blocks/pages/[id]/page.tsx");
const assignment = load<typeof import("../src/lib/page-blocks/admin-queries.ts")>("src/lib/page-blocks/admin-queries.ts");
const readModel = load<typeof import("../src/lib/admin/pages/entity-list-read-model-boundary.ts")>("src/lib/admin/pages/entity-list-read-model-boundary.ts");
const rowContract = load<typeof import("../src/lib/admin/pages/entity-list-contract.ts")>("src/lib/admin/pages/entity-list-contract.ts");
const seoOwner = load<typeof import("../src/lib/admin/seo-score.ts")>("src/lib/admin/seo-score.ts");
const status = load<typeof import("../src/app/admin/pages-blocks/pages/page-actions/page-status.ts")>("src/app/admin/pages-blocks/pages/page-actions/page-status.ts");
const edit = load<typeof import("../src/app/admin/pages-blocks/pages/page-seo-actions.ts")>("src/app/admin/pages-blocks/pages/page-seo-actions.ts");
const publicRead = load<typeof import("../src/lib/pages/get-published-page-by-slug.ts")>("src/lib/pages/get-published-page-by-slug.ts");
const policy = load<typeof import("../src/lib/pages/page-admin-policy.ts")>("src/lib/pages/page-admin-policy.ts");

const checks: string[] = [];
async function check(name: string, run: () => void | Promise<void>) {
  reset(); await run(); checks.push(name); console.log(`PASS ${name}`);
}
function assertNoMutation() {
  assert.deepEqual(state.writes, []); assert.deepEqual(state.audits, []); assert.deepEqual(state.cache, []);
}
function seoForm(title = "Explicit Home SEO edit") {
  const form = new FormData();
  form.set("page_id", String(initialHome.id));
  form.set("redirect_to", `/admin/pages-blocks/pages/${initialHome.id}?tab=seo`);
  form.set("seo_title", title);
  return form;
}
async function expectRedirect(action: () => Promise<unknown>, queryKey: string) {
  await assert.rejects(action, (error: unknown) => error instanceof RedirectSignal
    && new URL(error.href, "http://isolated.invalid").searchParams.has(queryKey));
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Network forbidden in Home owner verification"); };
try {
  await check("unpublished Home identity and zero-module list row are accepted", () => {
    const result = readModel.adaptPagesReadModel({ rows: [{ ...state.page, block_count: 0 }], total_count: 1, page: 1, contract_version: 2 }, {
      analyzeSeo: seoOwner.analyzeEntitySeo, legacySortFields: rowContract.legacyPageSortFields, extendedSortFields: rowContract.pageSortFields,
    });
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].id, initialHome.id);
    assert.equal(result.rows[0].status, "unpublished");
    assert.equal(result.rows[0].moduleCount, 0);
    assert.equal(policy.resolvePagePublicPath(result.rows[0]), "/");
    assert.ok(policy.getPageDeleteBlockReason(result.rows[0]));
    assertNoMutation();
  });
  await check("Admin assignments read remains empty and exposes available modules", async () => {
    const result = await assignment.getPageModuleAssignmentsForAdmin(Number(initialHome.id));
    assert.deepEqual(result.assignments, []);
    assert.equal(result.seoContent, "");
    assert.equal(result.templates.content[0]?.id, availableTemplate.id);
    assert.equal(state.reads.filter((table) => assignmentTables.has(table)).length, assignmentTables.size);
    assertNoMutation();
  });
  await check("actual Admin detail route exposes editors without publication or assignments", async () => {
    const element = await detail.default({ params: Promise.resolve({ id: String(initialHome.id) }) });
    assert.equal(element.type, terminalClient);
    assert.equal(element.props.page.id, initialHome.id);
    assert.equal(element.props.page.status, "unpublished");
    assert.deepEqual(element.props.assignments, []);
    assert.equal(element.props.templates.content[0]?.id, availableTemplate.id);
    assert.equal(element.props.seo.content, "");
    assert.equal((await publicRead.getPublishedPageStateBySlug("home")).sourceStatus, "missing");
    assert.equal(state.authCalls, 0, "No login/session is synthesized by reads");
    assertNoMutation();
  });
  await check("explicit SEO edit uses current writer and preserves nonpublication", async () => {
    assertNoMutation();
    await expectRedirect(() => edit.savePageSeoAction(seoForm()), "seo_notice");
    assert.equal(state.authCalls, 1); assert.equal(state.writes.length, 1); assert.equal(state.audits.length, 1);
    assert.equal(state.page?.seo_title, "Explicit Home SEO edit");
    assert.equal(state.page?.status, "unpublished");
    assert.ok(!Object.hasOwn(state.writes[0].payload, "status"));
    assert.equal(state.audits[0].entityId, initialHome.id);
    const element = await detail.default({ params: { id: String(initialHome.id) } });
    assert.equal(element.props.seo.seoTitle, "Explicit Home SEO edit");
    assert.deepEqual(element.props.assignments, []);
    assert.ok(state.cache.some((entry) => entry.kind === "path" && entry.args[0] === "/"));
  });
  await check("invalid SEO input is rejected before persistence", async () => {
    await expectRedirect(() => edit.savePageSeoAction(seoForm("x".repeat(61))), "seo_error");
    assertNoMutation(); assert.deepEqual(state.page, initialHome);
  });
  await check("failed SEO persistence retains draft and produces no success audit", async () => {
    state.failWrite = true;
    await expectRedirect(() => edit.savePageSeoAction(seoForm()), "seo_error");
    assert.equal(state.writes.length, 1); assert.deepEqual(state.audits, []); assert.deepEqual(state.cache, []);
    assert.deepEqual(state.page, initialHome);
  });
  await check("publication occurs only through explicit current Page action", async () => {
    assertNoMutation();
    const result = await status.togglePageStatus(Number(initialHome.id));
    assert.equal(result.ok, true); assert.equal(result.status, "published");
    assert.equal(state.writes.length, 1); assert.equal(state.audits.length, 1); assert.equal(state.authCalls, 1);
    assert.deepEqual(Object.keys(state.writes[0].payload).sort(), ["status", "updated_at"]);
    assert.equal(state.audits[0].entityId, initialHome.id);
    assert.equal((await publicRead.getPublishedPageStateBySlug("home")).page?.id, initialHome.id);
    assert.deepEqual((await assignment.getPageModuleAssignmentsForAdmin(Number(initialHome.id))).assignments, []);
    const reverse = await status.togglePageStatus(Number(initialHome.id));
    assert.equal(reverse.status, "unpublished"); assert.equal(state.writes.length, 2);
    assert.equal((await publicRead.getPublishedPageStateBySlug("home")).page, null);
  });
  await check("publication write failure does not release false success", async () => {
    state.failWrite = true;
    const result = await status.togglePageStatus(Number(initialHome.id));
    assert.equal(result.ok, false); assert.equal(result.code, "status_update_failed");
    assert.equal(state.writes.length, 1); assert.deepEqual(state.audits, []); assert.deepEqual(state.cache, []);
    assert.deepEqual(state.page, initialHome);
  });
  await check("session rejection prevents Page read/write attempts", async () => {
    state.denyAuth = true;
    await assert.rejects(() => status.togglePageStatus(Number(initialHome.id)), /isolated_auth_rejected/);
    await assert.rejects(() => edit.savePageSeoAction(seoForm()), /isolated_auth_rejected/);
    assert.deepEqual(state.reads, []); assertNoMutation();
  });
  await check("missing Home stays missing without implicit creation", async () => {
    state.page = null;
    await assert.rejects(() => detail.default({ params: { id: String(initialHome.id) } }), NotFoundSignal);
    const result = await status.togglePageStatus(Number(initialHome.id));
    assert.equal(result.ok, false); assert.equal(result.code, "page_not_found");
    assertNoMutation();
  });
  await check("assignment read error is not converted to manageable empty content", async () => {
    state.failReadTable = "page_content_block_assignments";
    await assert.rejects(() => assignment.getPageModuleAssignmentsForAdmin(Number(initialHome.id)), /isolated_read_rejected/);
    const element = await detail.default({ params: { id: String(initialHome.id) } });
    assert.notEqual(element.type, terminalClient);
    assert.match(element.props.message, /isolated_read_rejected/);
    assertNoMutation();
  });
  console.log(JSON.stringify({ passed: checks.length, failed: 0, actualSourceModules: sourceFiles.size,
    scope: "Current Home Admin read/edit/publication owners with isolated in-memory ports; no Product changes, DB, network, login or Browser proof." }));
} finally {
  globalThis.fetch = originalFetch;
}
