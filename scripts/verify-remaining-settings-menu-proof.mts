import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Actual action, parser, domain-persistence and cache-retry modules execute.
// Only session, database transport, Media side-service and Next cache ports are
// isolated. No network, database, storage, or production settings are mutated.
const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const stubs = new Map<string, unknown>([["server-only", {}]]);
const modules = new Map<string, { exports: unknown }>();
const stub = (file: string, value: unknown) => stubs.set(path.resolve(root, file), value);
function load<T>(file: string): T {
  const filename = path.resolve(root, file);
  if (stubs.has(filename)) return stubs.get(filename) as T;
  if (modules.has(filename)) return modules.get(filename)!.exports as T;
  const target = { exports: {} as unknown }; modules.set(filename, target);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
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
  new vm.Script(`(function(require,module,exports){${source}\n})`, { filename })
    .runInThisContext()(localRequire, target, target.exports);
  return target.exports as T;
}

const state = {
  reads: 0, writes: 0, audits: 0, cacheCalls: [] as string[], cacheFailures: 0,
  writeFailure: false, missingMenu: false, maintenance: false,
  menuListRead: false, menuListFailure: false, menuListColumns: "", menuItemReads: 0,
  settings: new Map<string, unknown>(),
};
function reset() {
  Object.assign(state, { reads: 0, writes: 0, audits: 0, cacheFailures: 0,
    writeFailure: false, missingMenu: false, maintenance: false,
    menuListRead: false, menuListFailure: false, menuListColumns: "", menuItemReads: 0 });
  state.cacheCalls.length = 0; state.settings.clear();
}
type Result = { data: unknown; error: { message: string; code?: string } | null };
class Query {
  table: string; operation = "read"; payload: Record<string, unknown> = {};
  filters: Record<string, unknown> = {}; selected = false;
  constructor(table: string) { this.table = table; }
  select(columns = "") { this.selected = true; if (state.menuListRead && this.table === "menus") state.menuListColumns = columns; return this; }
  order() { return this; }
  eq(key: string, value: unknown) { this.filters[key] = value; return this; }
  neq() { return this; } maybeSingle() { return this; } single() { return this; }
  update(payload: Record<string, unknown>) { this.operation = "update"; this.payload = payload; return this; }
  upsert(payload: Record<string, unknown>) { this.operation = "upsert"; this.payload = payload; return this; }
  then<T, U>(fulfilled?: (result: Result) => T | PromiseLike<T>, rejected?: (reason: unknown) => U | PromiseLike<U>) {
    return Promise.resolve().then(() => {
      if (this.operation === "read") {
        state.reads++;
        if (state.menuListRead) {
          if (this.table === "menu_items") state.menuItemReads++;
          if (this.table === "menus" && state.menuListFailure) return { data: null, error: { message: "isolated list read failure" } };
          if (this.table === "menus") return { data: [
            { id: 11, name: "Main", slug: "main", location: "main", is_active: true, menu_items: [{ count: 3 }] },
            { id: 12, name: "Footer", slug: "footer", location: "footer", is_active: false, menu_items: [{ count: 0 }] },
          ], error: null };
        }
        return { data: this.table === "site_settings" ? { value: { enabled: state.maintenance } } : null, error: null };
      }
      if (state.writeFailure) return { data: null, error: { message: "isolated write rejection" } };
      if (this.table === "menus" && state.missingMenu) return { data: null, error: null };
      state.writes++;
      if (this.table === "site_settings") {
        state.settings.set(String(this.payload.key), this.payload.value);
        if (this.payload.key === "maintenance_mode") state.maintenance = !!(this.payload.value as { enabled: boolean }).enabled;
      }
      return { data: this.selected ? { id: this.filters.id } : null, error: null };
    }).then(fulfilled, rejected);
  }
}
stub("src/lib/supabase-admin.ts", { getSupabaseAdmin: () => ({
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: Record<string, unknown>) => {
    assert.equal(name, "save_footer_settings");
    if (state.writeFailure) return { data: null, error: { message: "isolated footer rejection" } };
    state.writes++;
    for (const setting of args.p_settings as { key: string; value: unknown }[]) state.settings.set(setting.key, setting.value);
    return { data: null, error: null };
  },
}) });
stub("src/lib/admin/auth/require-admin-session.ts", { requireAdminSession: async () => ({ id: 17, username: "isolated-proof" }) });
stub("src/lib/admin/preferences/admin-column-preferences.ts", { readAdminColumnPreferences: async () => ({ visibleColumns: null, error: null }) });
stub("src/lib/page-blocks/admin-collection-columns.ts", { getPageCompositionColumnPreferenceConfig: () => ({ viewKey: "menus" }) });
stub("src/app/admin/pages-blocks/menus/MenusTableClient.tsx", { default: () => null });
stub("src/lib/admin/audit-log.ts", { recordCmsAdminAudit: async () => { state.audits++; } });
stub("src/lib/logging.ts", { logError() {}, logWarn() {} });
stub("src/lib/maintenance/read-maintenance-mode.ts", { clearMaintenanceModeCache() {} });
stub("src/lib/admin/media-catalog/write-lease.ts", {
  MediaReferenceWriteLeaseError: class extends Error {}, getMediaReferenceWriteLeaseUserMessage: (x: string) => x,
  acquireMediaReferenceWriteLease: async () => null,
  completeMediaReferenceWriteLease: async () => {}, failMediaReferenceWriteLease: async () => {},
});
const synced = { status: "synced", code: "media_reference_sync_succeeded", domainKey: "site_settings",
  entityIdentity: "fixture", failureReason: null, requiresReconciliation: false,
  mediaSynchronizationState: "synced", uncertainties: [], explicitEmpty: true };
stub("src/lib/admin/media-catalog/synchronization.ts", {
  markMediaCatalogRuntimeUncertain: async () => {},
  synchronizeMediaReferencesAfterDomainMutation: async () => ({ ...synced }),
  synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => ({ ...synced }),
});
function cache(kind: string, target: string) {
  state.cacheCalls.push(`${kind}:${target}`);
  if (state.cacheFailures > 0) { state.cacheFailures--; throw new Error("isolated cache failure"); }
}
stubs.set("next/cache", { revalidatePath: (target: string) => cache("path", target),
  revalidateTag: (target: string) => cache("tag", target), updateTag: (target: string) => cache("update", target),
  unstable_cache: (fn: unknown) => fn, unstable_noStore() {} });
stub("src/lib/cache/public-cache-generation.ts", {
  cachePublicRead: (fn: unknown) => fn,
  advancePublicCacheGeneration: async () => undefined,
});
class Redirect extends Error { href: string; constructor(href: string) { super("isolated redirect"); this.href = href; } }
stubs.set("next/navigation", { redirect: (href: string) => { throw new Redirect(href); } });
stubs.set("react", { ...require("react"), cache: (fn: unknown) => fn });

const footerSave = load<typeof import("../src/app/admin/pages-blocks/footer/footer-actions/save.ts")>("src/app/admin/pages-blocks/footer/footer-actions/save.ts");
const footerRestore = load<typeof import("../src/app/admin/pages-blocks/footer/footer-actions/restore-default.ts")>("src/app/admin/pages-blocks/footer/footer-actions/restore-default.ts");
const general = load<typeof import("../src/app/admin/settings/general/actions.ts")>("src/app/admin/settings/general/actions.ts");
const media = load<typeof import("../src/app/admin/settings/media/actions.ts")>("src/app/admin/settings/media/actions.ts");
const menus = load<typeof import("../src/app/admin/pages-blocks/menus/menu-actions/save.ts")>("src/app/admin/pages-blocks/menus/menu-actions/save.ts");
const menusPage = load<typeof import("../src/app/admin/pages-blocks/menus/page.tsx")>("src/app/admin/pages-blocks/menus/page.tsx");
const { DEFAULT_FOOTER_SLOTS } = load<typeof import("../src/lib/footer/defaults.ts")>("src/lib/footer/defaults.ts");
const footerInput = { slots: structuredClone(DEFAULT_FOOTER_SLOTS), contactItems: [{ label: "Call", value: "123" }],
  socialLinks: [{ platform: "facebook" as const, label: "Facebook", href: "https://example.com" }], legal: { copyright: "Proof", tagline: "Proof" } };
const previous = { status: "idle" as const, mode: "edit" as const, revision: 0, message: "" };
function mediaInput() {
  const data = new FormData();
  for (const [key, value] of [["maxImageMb", "2"], ["maxDocumentMb", "2"], ["allowedKinds", "image"],
    ["allowedImageExtensions", ".jpg"], ["mimeVerification", "on"]]) data.append(key, value);
  return data;
}
function menuInput(id: string) {
  const data = new FormData();
  for (const [key, value] of [["id", id], ["name", "Proof"], ["slug", "proof"], ["location", "main"]]) data.set(key, value);
  return data;
}
async function redirectOf(action: () => Promise<unknown>) {
  try { await action(); } catch (error) { if (error instanceof Redirect) return new URL(error.href, "https://fixture.example"); throw error; }
  throw new Error("Expected navigation result");
}
const failures: string[] = [];
async function check(name: string, action: () => Promise<void>) {
  reset();
  const originalError = console.error;
  const diagnostics: unknown[][] = [];
  console.error = (...args) => { diagnostics.push(args); };
  try { await action(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); originalError(`FAIL ${name}: ${error instanceof Error ? error.message : error}`); }
  finally { console.error = originalError; }
}

for (const [label, invoke] of [
  ["footer-save", () => footerSave.saveFooterBuilderAction(structuredClone(footerInput))],
  ["footer-restore", () => footerRestore.restoreDefaultFooterAction()],
] as const) {
  await check(`${label}: cache exhaustion preserves committed result`, async () => {
    state.cacheFailures = 99;
    const result = await invoke();
    assert.equal(state.writes, 1); assert.equal(result.ok, true); assert.equal(result.status, "warning");
    assert.equal((result as { code?: string }).code, "committed_cache_revalidation_pending");
    assert.equal(state.cacheCalls.length, 2);
  });
  await check(`${label}: transient retry never repeats persistence`, async () => {
    state.cacheFailures = 1;
    const result = await invoke();
    assert.equal(state.writes, 1); assert.equal(result.status, "success");
    assert.equal(state.cacheCalls.filter((item) => item === "tag:footer").length, 2);
  });
  await check(`${label}: rejected write performs no cache follow-up`, async () => {
    state.writeFailure = true;
    await assert.rejects(invoke); assert.equal(state.writes, 0); assert.equal(state.cacheCalls.length, 0);
  });
}
await check("maintenance: cache exhaustion preserves persisted toggle", async () => {
  state.cacheFailures = 99;
  const result = await general.updateMaintenanceModeAction(true) as unknown as { ok: boolean; feedbackStatus: string; code: string };
  assert.equal(state.writes, 1); assert.equal(state.maintenance, true);
  assert.equal(result.ok, true); assert.equal(result.feedbackStatus, "warning");
  assert.equal(result.code, "committed_cache_revalidation_pending"); assert.equal(state.cacheCalls.length, 2);
});
await check("maintenance: invalid input remains non-mutating", async () => {
  await assert.rejects(() => general.updateMaintenanceModeAction("yes" as unknown as boolean));
  assert.equal(state.writes, 0); assert.equal(state.reads, 0); assert.equal(state.cacheCalls.length, 0);
});
await check("media settings: cache failure cannot report that nothing was saved", async () => {
  state.cacheFailures = 99;
  const result = await media.updateMediaSettingsAction(previous, mediaInput());
  assert.equal(state.writes, 1); assert.ok(state.settings.has("media.settings"));
  assert.equal(result.status, "warning"); assert.equal(result.code, "committed_cache_revalidation_pending");
  assert.ok(result.savedRevision); assert.equal(state.cacheCalls.length, 2);
});
await check("media settings: transient cache retry preserves one write", async () => {
  state.cacheFailures = 1;
  assert.equal((await media.updateMediaSettingsAction(previous, mediaInput())).status, "success");
  assert.equal(state.writes, 1); assert.equal(state.cacheCalls.length, 2);
});
for (const id of ["-1", "1.5", "9007199254740992"]) {
  await check(`menu update: invalid identity ${id} rejected before reads or writes`, async () => {
    const result = await redirectOf(() => menus.updateMenu(menuInput(id)));
    assert.notEqual(result.searchParams.get("message"), "تم تحديث القائمة.");
    assert.equal(state.reads, 0); assert.equal(state.writes, 0); assert.equal(state.audits, 0);
  });
}
await check("menu update: absent target cannot claim successful save", async () => {
  state.missingMenu = true;
  const result = await redirectOf(() => menus.updateMenu(menuInput("31")));
  assert.notEqual(result.searchParams.get("message"), "تم تحديث القائمة.");
  assert.equal(state.writes, 0); assert.equal(state.audits, 0); assert.equal(state.cacheCalls.length, 0);
});
await check("menu update: cache exhaustion preserves committed redirect and warning kind", async () => {
  state.cacheFailures = 99;
  const result = await redirectOf(() => menus.updateMenu(menuInput("31")));
  assert.equal(state.writes, 1); assert.equal(state.audits, 1); assert.equal(state.cacheCalls.length, 2);
  assert.equal(result.searchParams.get("notice"), "committed_cache_revalidation_pending");
  assert.ok(result.searchParams.get("message")?.startsWith("تم تحديث القائمة."));
  assert.equal(result.searchParams.get("message")?.includes("مزامنة ارتباطات الميديا"), false);
});
await check("menu update: transient cache retry never repeats persistence", async () => {
  state.cacheFailures = 1;
  const result = await redirectOf(() => menus.updateMenu(menuInput("31")));
  assert.equal(state.writes, 1); assert.equal(state.audits, 1);
  assert.equal(result.searchParams.get("message"), "تم تحديث القائمة.");
  assert.equal(state.cacheCalls.filter((item) => item === "tag:navigation").length, 2);
});
await check("menu update: duplicate identity cannot silently choose one target", async () => {
  const data = menuInput("31"); data.append("id", "32");
  await redirectOf(() => menus.updateMenu(data));
  assert.equal(state.reads, 0); assert.equal(state.writes, 0);
});
await check("menu list: embedded counts preserve rows with one bounded menu read", async () => {
  state.menuListRead = true;
  const result = await menusPage.default({ searchParams: Promise.resolve({}) });
  const rows = result.props.menus as Array<{ id: number; item_count: number }>;
  assert.deepEqual(rows.map(({ id, item_count }) => [id, item_count]), [[11, 3], [12, 0]]);
  assert.equal(state.menuListColumns.includes("menu_items(count)"), true);
  assert.equal(state.reads, 1);
  assert.equal(state.menuItemReads, 0);
});
await check("menu list: failed aggregate read reports failure without false counts", async () => {
  state.menuListRead = true;
  state.menuListFailure = true;
  const result = await menusPage.default({ searchParams: Promise.resolve({}) });
  assert.deepEqual(result.props.menus, []);
  assert.match(result.props.loadError, /isolated list read failure/);
  assert.equal(state.reads, 1);
  assert.equal(state.menuItemReads, 0);
});
if (failures.length) throw new Error(`${failures.length} remaining settings/menu proof failures: ${failures.join(", ")}`);
console.log("Remaining settings/menu proof: actual action input, persistence, output and bounded-cache failure boundaries passed; no live mutations.");
