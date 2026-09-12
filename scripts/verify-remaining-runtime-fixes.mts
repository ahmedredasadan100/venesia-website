import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
require("next/dist/server/node-environment-baseline");
const stubs = new Map<string, unknown>([["server-only", {}]]);
const modules = new Map<string, { exports: unknown }>();
const stub = (file: string, value: unknown) => stubs.set(path.resolve(root, file), value);
function load<T>(file: string): T {
  const filename = path.resolve(root, file);
  if (stubs.has(filename)) return stubs.get(filename) as T;
  if (modules.has(filename)) return modules.get(filename)!.exports as T;
  const target = { exports: {} as unknown }; modules.set(filename, target);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (stubs.has(specifier)) return stubs.get(specifier);
    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), specifier);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
        if (stubs.has(candidate) || existsSync(candidate) && /\.tsx?$/.test(candidate)) return load(candidate);
      }
    }
    return createRequire(filename)(specifier);
  };
  new vm.Script(`(function(require,module,exports){${source}\n})`, { filename }).runInThisContext()(localRequire, target, target.exports);
  return target.exports as T;
}
stub("src/lib/logging.ts", { logError() {}, logWarn() {} });
stubs.set("react", { ...require("react"), cache: (fn: unknown) => fn }); // Request memoization is separate from persistent caching.

type Result = { data: unknown; error: { message: string } | null; count?: number | null };
let respond: (query: Query) => Result = () => { throw new Error("Unconfigured isolated source"); };
class Query {
  table: string; columns = ""; head = false; start = 0; end = 999; orders: string[] = []; filters: Record<string, unknown> = {};
  constructor(table: string) { this.table = table; }
  select(columns: string, options?: { head?: boolean; count?: string }) { this.columns = columns; this.head = !!options?.head; return this; }
  order(column: string) { this.orders.push(column); return this; }
  eq(key: string, value: unknown) { this.filters[key] = value; return this; }
  in() { return this; } is() { return this; } limit() { return this; } maybeSingle() { return this; }
  range(start: number, end: number) { this.start = start; this.end = end; return this; }
  then<T, U>(fulfilled?: (result: Result) => T | PromiseLike<T>, rejected?: (reason: unknown) => U | PromiseLike<U>) {
    return Promise.resolve().then(() => respond(this)).then(fulfilled, rejected);
  }
}
stub("src/lib/supabase-admin.ts", { getSupabaseAdmin: () => ({ from: (table: string) => new Query(table) }) });

async function cronBoundary() {
  let maintenance = false; let syncCalls = 0;
  const original = { ...process.env };
  try {
    process.env.CRON_SECRET = "isolated-cron-fixture"; process.env.ADMIN_SESSION_SECRET = "isolated-admin-fixture";
    stub("src/lib/maintenance/read-maintenance-mode.ts", { isMaintenanceModeEnabled: async () => maintenance });
    stub("src/lib/admin/auth/admin-users.ts", { validateAdminSessionPayload: async () => true });
    stub("src/lib/redirects/resolve-public-redirect.ts", { resolvePublicRedirect: async () => null });
    stub("src/lib/admin/integrations/sync-runtime.ts", { runDueIntegrationSyncs: async () => { throw new Error("Wrong sync owner binding"); } });
    const handlerSource = readFileSync(path.join(root, "src/app/api/admin/integrations/sync/route.ts"), "utf8");
    const owner = handlerSource.match(/import\s*\{\s*runDueIntegrationSyncs\s*\}\s*from\s*"([^"]+)"/)?.[1];
    assert.ok(owner, "existing external synchronization owner must be explicit");
    stub(path.resolve(root, "src/app/api/admin/integrations/sync", `${owner}.ts`), {
      runDueIntegrationSyncs: async (limit: number) => { assert.equal(limit, 8); syncCalls++; return { processed: 0 }; },
    });
    const { GET } = load<typeof import("../src/app/api/admin/integrations/sync/route.ts")>("src/app/api/admin/integrations/sync/route.ts");
    const { proxy, config } = load<typeof import("../src/proxy.ts")>("src/proxy.ts");
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const { unstable_doesMiddlewareMatch } = require("next/experimental/testing/server") as typeof import("next/experimental/testing/server");
    const url = "https://fixture.example/api/admin/integrations/sync";
    const authorized = { authorization: `Bearer ${process.env.CRON_SECRET}` };
    assert.ok(unstable_doesMiddlewareMatch({ config, url }));
    for (maintenance of [false, true]) {
      const request = new NextRequest(url, { headers: authorized });
      assert.equal(request.cookies.size, 0);
      assert.equal((await proxy(request)).headers.get("x-middleware-next"), "1");
      assert.equal((await GET(request)).status, 200);
      const before = syncCalls;
      for (const headers of [{}, { authorization: "Bearer wrong" }] as Record<string, string>[]) {
        const denied = new NextRequest(url, { headers });
        assert.equal((await proxy(denied)).status, 401);
        assert.equal((await GET(denied)).status, 401, "handler must retain its own authentication");
      }
      for (const [pathname, method] of [["/api/admin/integrations/sync", "POST"], ["/api/admin/integrations/sync/extra", "GET"], ["/api/admin/entity-lists/topics", "GET"]]) {
        assert.equal((await proxy(new NextRequest(`https://fixture.example${pathname}`, { method, headers: authorized }))).status, 401);
      }
      assert.equal(new URL((await proxy(new NextRequest("https://fixture.example/admin/content/topics", { headers: authorized }))).headers.get("location")!).pathname, "/admin/login");
      assert.equal(syncCalls, before);
    }
    assert.equal(syncCalls, 2);
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request(url, { headers: authorized }))).status, 503);
    console.log("PASS VEN-A01 actual matcher -> proxy -> handler; maintenance ON/OFF, exact GET, dual auth, no external sync.");
  } finally { process.env = original; }
}

async function cacheBoundaries() {
  // Run installed Next unstable_cache itself. This in-memory IncrementalCache
  // storage adapter substitutes persistence only, not callback/revalidation logic.
  type Entry = { value: { kind: string; data: { body: string } }; isStale: boolean };
  const entries = new Map<string, Entry>();
  let writes = 0;
  const globalCache = globalThis as unknown as { __incrementalCache: unknown };
  const previous = globalCache.__incrementalCache;
  globalCache.__incrementalCache = {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string) => entries.get(key),
    set: async (key: string, value: Entry["value"]) => { entries.set(key, { value, isStale: false }); writes++; },
  };
  stubs.set("next/cache", { ...require("next/cache"), unstable_noStore() {} });
  const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
  const template = { id: 1, name: "Fixture", slug: "fixture", variant: "project-detail", style_preset: "gold", status: "published", is_visible: true, sort_order: 0, config: {} };
  const page = { id: 1, slug: "fixture", path: "/fixture" };
  stub("src/lib/pages/get-published-page-by-slug.ts", { getPublishedPageStateBySlug: async () => ({ page, sourceStatus: "database" }) });
  const slots = load<typeof import("../src/lib/footer/defaults.ts")>("src/lib/footer/defaults.ts").DEFAULT_FOOTER_SLOTS;
  const footer = [{ key: "footer.slots", value: slots }, { key: "footer.contact_items", value: [{ label: "Call", value: "123" }] },
    { key: "footer.social_links", value: [{ platform: "facebook", label: "Facebook", href: "https://example.com" }] }, { key: "footer.legal", value: { copyright: "Fixture", tagline: "Fixture" } }];
  const cases = [
    { file: "src/lib/projects/load-project-location-section-presentation.ts", name: "loadProjectLocationSectionPresentation", arg: 1, data: () => ({ show_location_label: false, show_location_tags: false }) },
    { file: "src/lib/footer/load-footer-settings.ts", name: "loadFooterSettings", data: () => footer },
    ...["getPublicNavigationSnapshot", "getPublicNavigationItemsByMenuId"].map(name => ({ file: "src/lib/navigation/get-public-navigation.ts", name, arg: name.endsWith("Id") ? 1 : "main", data: (q: Query) => q.table === "menus" ? { id: 1, name: "Fixture", slug: "fixture", location: "main", is_active: true } : [{ id: 1, parent_id: null, label: "Fixture", item_type: "link", href: "/fixture", is_visible: true, sort_order: 0 }] })),
    { file: "src/lib/featured-modules/load-featured-modules.ts", name: "loadFeaturedModuleStateForPageSlug", arg: "fixture", data: () => [] },
    { file: "src/lib/load-hero-section.ts", name: "getHeroSectionState", arg: "fixture", data: () => ({ id: 1, hero_templates: template }) },
    { file: "src/lib/load-hero-section.ts", name: "getDomainBackedHeroTemplateState", arg: "project-detail", data: () => [template] },
    { file: "src/lib/seo/load-global-seo-settings.ts", name: "loadGlobalSeoEffectiveContract", data: () => ({ value: { site_name: "Fixture" } }) },
    { file: "src/lib/seo/load-page-seo.ts", name: "loadPageSeoByPath", arg: "/fixture", data: () => ({ path: "/fixture", meta_title: "Fixture" }) },
  ];
  try {
    for (const item of cases) {
      entries.clear(); let calls = 0; let failure = false;
      respond = q => { calls++; return failure ? { data: null, error: { message: "isolated outage" } } : { data: item.data(q), error: null }; };
      const invoke = () => load<Record<string, (arg?: unknown) => Promise<unknown>>>(item.file)[item.name](item.arg);
      const wire = (value: unknown) => JSON.parse(JSON.stringify(value));
      const good = wire(await invoke()); const initialWrites = writes; const initialCalls = calls;
      if (item.name === "loadFooterSettings") assert.equal(good.sourceStatus, "database");
      assert.equal(entries.size, 1, `${item.name}: successful source must be cached`);
      assert.deepEqual(wire(await invoke()), good); assert.equal(calls, initialCalls, `${item.name}: fresh hit`);
      for (const entry of entries.values()) entry.isStale = true;
      failure = true;
      const store = { pendingRevalidates: {} as Record<string, Promise<unknown>>, isStaticGeneration: false };
      assert.deepEqual(wire(await workAsyncStorage.run(store, invoke)), good, `${item.name}: stale success survives failed refresh`);
      await Promise.allSettled(Object.values(store.pendingRevalidates));
      assert.equal(writes, initialWrites, `${item.name}: failed refresh cannot overwrite success`);
      failure = false; assert.deepEqual(wire(await invoke()), good); assert.equal(writes, initialWrites + 1);
      entries.clear(); failure = true; const beforeCold = writes;
      await invoke(); assert.equal(entries.size, 0, `${item.name}: safe outage rendering cannot enter cache`);
      assert.equal(writes, beforeCold);
      failure = false; assert.deepEqual(wire(await invoke()), good); assert.equal(entries.size, 1);
      console.log(`PASS VEN-A02 ${item.name}: installed Next stale success/failure/recovery and cold failure/recovery.`);
    }
    // Visibility distinctions are real cacheable states, never treated as an outage.
    const hero = load<typeof import("../src/lib/load-hero-section.ts")>("src/lib/load-hero-section.ts");
    for (const hidden of [false, true]) {
      entries.clear(); respond = () => ({ data: hidden ? [{ ...template, status: "unpublished", is_visible: false }] : [], error: null });
      assert.equal((await hero.getDomainBackedHeroTemplateState("project-detail")).visibility, hidden ? "hidden" : "none");
      assert.equal(entries.size, 1);
    }
  } finally { globalCache.__incrementalCache = previous; }
}

async function exportCompleteness() {
  const { CMS_BACKUP_TABLES } = load<typeof import("../src/lib/export/cms-backup-config.ts")>("src/lib/export/cms-backup-config.ts");
  const { exportCmsBackup } = load<typeof import("../src/lib/export/export-cms-backup.ts")>("src/lib/export/export-cms-backup.ts");
  const rows = Array.from({ length: 2507 }, (_, i) => ({ id: i + 1, key: `key-${String(i).padStart(5, "0")}`, sort_order: Math.floor(i / 3) }));
  const modes = ["stable", "later-failure", "short-page", "duplicate", "count-drift", "missing-count", "final-failure", "empty"] as const;
  for (const mode of modes) {
    const queries: Query[] = [];
    respond = q => {
      queries.push(q); const size = mode === "empty" ? 0 : rows.length;
      if (q.table === "topics") {
        if (mode === "later-failure" && q.start > 0 || mode === "final-failure" && q.head) return { data: null, error: { message: "fixture later page failure" }, count: null };
        if (mode === "short-page" && q.start > 0) return { data: [], error: null, count: size };
      }
      const start = mode === "duplicate" && q.table === "topics" && q.start > 0 ? 0 : q.start;
      return { data: q.head ? null : rows.slice(start, Math.min(start + 400, size)), error: null,
        count: q.table === "topics" && mode === "missing-count" ? null : size + (q.table === "topics" && mode === "count-drift" && q.start > 0 ? 1 : 0) };
    };
    const result = await exportCmsBackup();
    const partial = !["stable", "empty"].includes(mode);
    assert.equal(result.partial, partial, mode);
    for (const table of CMS_BACKUP_TABLES) {
      const primary = table.name === "site_settings" ? "key" : "id";
      const expected = partial && table.name === "topics" || mode === "empty" ? [] : rows;
      assert.deepEqual(result.tables[table.name], expected, `${mode}:${table.name}: no loss or duplication`);
      for (const q of queries.filter(q => q.table === table.name && !q.head)) {
        assert.deepEqual(q.orders, table.orderBy === primary ? [primary] : [table.orderBy, primary]);
        assert.equal(q.end - q.start + 1, 1000);
      }
    }
  }
  console.log("PASS VEN-A06 all registered tables, 2507 rows/server cap 400, deterministic unique order, failures/duplicates/count drift cannot claim a complete export.");
}

await cronBoundary();
await cacheBoundaries();
await exportCompleteness();
