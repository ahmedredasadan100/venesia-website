import { normalizeVerificationText } from "./lib/verification-text.mjs";
import assert from "node:assert/strict";
/**
 * Static and pure-behavior guardrails for the shared Admin Collection
 * Toolbar/Search/Filter System. Live interaction remains Browser QA owned.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let assertionCount = 0;

function read(path) {
  // Source fixtures must be identical on Windows and CI before mutation proof.
  return normalizeVerificationText(readFileSync(resolve(ROOT, path), "utf8"), { loneCR: true });
}

function check(label, condition) {
  assertionCount += 1;
  if (!condition) failures.push(label);
}

function loadPureTypeScriptModule(path, ports = {}, source = read(path), globals = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", ...Object.keys(globals), output)(commonJsModule.exports, commonJsModule, name => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    assert.ok(Object.hasOwn(ports, name), `Unexpected fixture dependency ${name} in ${path}`);
    return ports[name];
  }, ...Object.values(globals));
  return commonJsModule.exports;
}

const toolbar = read(
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
);
const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const searchInput = read("src/components/admin/ui/AdminSearchInput.tsx");
const urlState = read("src/lib/admin/entity-list/url-state.ts");
const serverPageController = read(
  "src/lib/admin/entity-list/data-engine/client-controller.ts",
);
const boundedClientController = read(
  "src/lib/admin/entity-list/bounded-client-pagination.ts",
);
const uiBarrel = read("src/components/admin/ui/index.ts");
const topicsAdapter = read(
  "src/components/admin/content/UnifiedContentFilters.tsx",
);

check(
  "Shared owner renders Toolbar, Context Row, Filter Modal, and Suggestions",
  toolbar.includes('data-admin-collection-toolbar-owner=""') &&
    toolbar.includes('data-admin-collection-context-row=""') &&
    toolbar.includes("<VenesiaModal") &&
    toolbar.includes('data-admin-search-suggestions=""'),
);
check(
  "Toolbar source order is Search, Filter, then Columns",
  toolbar.indexOf("<AdminSearchInput") <
    toolbar.indexOf('data-admin-filter-trigger=""') &&
    toolbar.indexOf('data-admin-filter-trigger=""') <
      toolbar.indexOf('data-admin-toolbar-columns=""'),
);
check(
  "Context Row gives bulk actions priority over applied filter chips",
  toolbar.includes(
    'data-admin-context-mode={contextOverrideActive ? "bulk" : "filters"}',
  ) &&
    toolbar.includes("contextOverrideActive ? (") &&
    toolbar.includes("appliedFilters.map"),
);
check(
  "Filter modal keeps draft separate and performs one shared apply",
  toolbar.includes("draftFilters") &&
    toolbar.includes("cancelFilters") &&
    toolbar.includes("clearDraftFilters") &&
    toolbar.includes("applyDraftFilters") &&
    toolbar.includes('navigate(patch, "push")'),
);
check(
  "Search owns 350ms default debounce, immediate Enter/Clear, and abortable suggestions",
  toolbar.includes("search.debounceMs ?? 350") &&
    toolbar.includes("commitSearch(draftSearch)") &&
    toolbar.includes('commitSearch("")') &&
    toolbar.includes("new AbortController()") &&
    searchInput.includes('event.key === "Enter"'),
);
check(
  "Search suggestions prevent stale results and expose keyboard semantics",
  toolbar.includes("controller.signal.aborted") &&
    toolbar.includes("suggestionsQuery === trimmedSearch") &&
    toolbar.includes('event.key === "ArrowDown"') &&
    toolbar.includes('event.key === "ArrowUp"') &&
    searchInput.includes('role="combobox"'),
);
check(
  "Shared URL patch resets page and supports push/replace history behavior",
  urlState.includes("next.delete(resetPageParam)") &&
    toolbar.includes('type HistoryBehavior = "push" | "replace"') &&
    toolbar.includes("router[behavior](href, { scroll: false })"),
);
check(
  "Server-page controller owns contract-normalized toolbar query patches",
  serverPageController.includes("const applyQueryPatch = useCallback") &&
    serverPageController.includes(
      "applyAdminEntityUrlPatch(currentParams, patch",
    ) &&
    serverPageController.includes(
      "normalizeAdminEntityListQuery(contract, nextParams)",
    ) &&
    serverPageController.includes("applyQueryPatch,"),
);
check(
  "AdminEntityList composes one toolbar owner with columns and bulk context",
  entityList.includes("<AdminEntityListFilters") &&
    entityList.includes("columnsControl={columnsControl}") &&
    entityList.includes("contextOverride={bulkBar}") &&
    entityList.includes(
      'className={toolbar ? ADMIN_ENTITY_LIST_JOINED_TABLE_CLASS : undefined}',
    ) &&
    entityList.includes("<AdminEntityListTableFrame") &&
    read("src/components/admin/entity-list/AdminEntityListSurface.tsx").includes(
      'ADMIN_ENTITY_LIST_JOINED_TABLE_CLASS = "!rounded-t-none !border-t-0"',
    ),
);

const normalizer = loadPureTypeScriptModule(
  "src/lib/admin/entity-list/search-normalization.ts",
);
check(
  "Arabic normalizer covers alif variants, ya, marks, spaces, and digits",
  normalizer.normalizeAdminCollectionSearchText("  آإأا ـ فَتَى ١۲  ") ===
    "اااا فتي 12",
);
check(
  "Arabic normalizer deliberately keeps taa marbuta distinct from haa",
  normalizer.normalizeAdminCollectionSearchText("مدرسة") !==
    normalizer.normalizeAdminCollectionSearchText("مدرسه"),
);
check(
  "Arabic-aware bounded matching uses the same canonical normalizer",
  normalizer.adminCollectionSearchIncludes("فتى ١٢", "فتي 12") === true,
);

const entityListAdopters = [
  "src/components/admin/content/UnifiedContentList.tsx",
  "src/app/admin/content/categories/CategoriesListClient.tsx",
  "src/app/admin/content/series/SeriesTableClient.tsx",
  "src/app/admin/projects/ProjectsTableClient.tsx",
  "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
  "src/app/admin/seo/redirects/RedirectsClient.tsx",
  "src/app/admin/activity-log/ActivityLogClient.tsx",
  "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  "src/app/admin/users-roles/UsersManagementClient.tsx",
];
check(
  "Every server-page Entity List adopter delegates layout to toolbar props",
  entityListAdopters.every((path) => read(path).includes("toolbar=")),
);
const serverPageQueryAdopters = [
  "src/components/admin/content/TopicsListClient.tsx",
  "src/app/admin/content/categories/CategoriesListClient.tsx",
  "src/app/admin/content/series/SeriesTableClient.tsx",
  "src/app/admin/projects/ProjectsTableClient.tsx",
  "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
  "src/app/admin/seo/redirects/RedirectsClient.tsx",
  "src/app/admin/activity-log/ActivityLogClient.tsx",
  "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  "src/app/admin/users-roles/UsersManagementClient.tsx",
];
check(
  "Every server-page toolbar delegates query patches to the Collection controller",
  serverPageQueryAdopters.every((path) =>
    read(path).includes("onQueryPatch: controller.applyQueryPatch"),
  ) &&
    serverPageQueryAdopters.every(
      (path) => !read(path).includes("onQueryPatch: (patch"),
    ),
);
check(
  "Topics declares suggestions in its domain adapter without local UI runtime",
  topicsAdapter.includes("suggestions") &&
    topicsAdapter.includes("minLength: 2") &&
    topicsAdapter.includes("maxResults: 8") &&
    topicsAdapter.includes("{ signal") &&
    !topicsAdapter.includes("<AdminSearchInput") &&
    !topicsAdapter.includes("<VenesiaModal"),
);

const boundedAdopters = [
  "src/components/admin/media/MediaLibraryCore.tsx",
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
];
check(
  "Every bounded or specialized adopter uses the shared toolbar owner",
  boundedAdopters.every((path) =>
    read(path).includes("<AdminEntityListFilters"),
  ),
);
check(
  "Eligible bounded adopters do not rebuild local search inputs",
  boundedAdopters.every((path) => !read(path).includes('<input type="search"')),
);
const eligibleBoundedAdopters = [
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
];
check(
  "Bounded Collection controller owns query, filtering, membership, pagination, and URL history",
  boundedClientController.includes('mode: "bounded-client"') &&
    boundedClientController.includes("queryContract.matchesRow") &&
    boundedClientController.includes("const resolvedDatasetKey") &&
    boundedClientController.includes("const applyQueryPatch = useCallback") &&
    boundedClientController.includes("filterValues") &&
    boundedClientController.includes("rows: paginatedRows") &&
    boundedClientController.includes("useSearchParams") &&
    boundedClientController.includes("window.history[behavior") &&
    boundedClientController.includes("window.history.replaceState(null") &&
    !boundedClientController.includes("useRouter"),
);
check(
  "Eligible bounded adopters declare one contract and no local URL/query lifecycle",
  eligibleBoundedAdopters.every((path) => {
    const source = read(path);
    return (
      source.includes("useAdminBoundedClientPagination") &&
      source.includes('mode: "bounded-client"') &&
      source.includes("queryContract") &&
      source.includes("onQueryPatch={pagination.applyQueryPatch}") &&
      !source.includes("useSearchParams") &&
      !source.includes("applyAdminEntityUrlPatch") &&
      !source.includes("window.history")
    );
  }),
);
check(
  "Retired parallel filter, shell, and toolbar implementations stay absent",
  !uiBarrel.includes("AdminFilterListbox") &&
    !uiBarrel.includes("AdminFiltersShell") &&
    !uiBarrel.includes("AdminToolbar") &&
    !existsSync(
      resolve(ROOT, "src/components/admin/ui/AdminFilterListbox.tsx"),
    ) &&
    !existsSync(
      resolve(ROOT, "src/components/admin/ui/AdminFiltersShell.tsx"),
    ) &&
    !existsSync(resolve(ROOT, "src/components/admin/ui/AdminToolbar.tsx")),
);
check(
  "Media keeps Folder and Smart Views outside its one kind filter",
  read("src/components/admin/media/MediaLibraryCore.tsx").includes(
    "MEDIA_LIBRARY_FILTERS",
  ) &&
    !toolbar.includes("SMART_VIEWS") &&
    !toolbar.includes("initialFolder"),
);
check(
  "Media search maps every declared field before pagination",
  ["displayName", "originalFilename", "objectKey", "defaultAltText"].every(
    (field) =>
      read("src/lib/admin/media-catalog/catalog.ts").includes(`asset.${field}`),
  ) &&
    read("src/lib/admin/media-catalog/catalog.ts").includes(
      "adminCollectionSearchIncludes",
    ),
);
check(
  "Pages exposes active search through its authoritative Read Model",
  read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx").includes(
    "ابحث في الصفحات",
  ) &&
    !read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx").includes(
      "البحث غير متاح قبل تحديث Read Model",
    ) &&
    !read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx").includes(
      "disabled: true",
    ),
);

// Execute the canonical hook with controlled React scheduling and the installed
// Next History adapter. No DOM, RSC fetch, database or Browser claim is made.
function verifyBoundedQueryHistory(ownerSource) {
  const compile = (source, ports = {}) => {
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const compiledModule = { exports: {} };
    Function("require", "exports", "module", compiled)((name) => {
      assert.ok(Object.hasOwn(ports, name), `Unexpected bounded-owner import ${name}`);
      return ports[name];
    }, compiledModule.exports, compiledModule);
    return compiledModule.exports;
  };
  const pagination = compile(read("src/lib/admin/entity-list/pagination.ts"));
  const url = compile(urlState);
  const nextSource = read("node_modules/next/dist/client/components/app-router.js");
  const nextFile = ts.createSourceFile("app-router.js", nextSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const find = (predicate) => {
    const found = [];
    function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
    visit(nextFile); return found;
  };
  const historyEffects = find((node) => ts.isArrowFunction(node) && node.getText(nextFile).includes("const originalPushState"));
  const copies = find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "copyNextJsInternalHistoryState");
  assert.equal(historyEffects.length, 1); assert.equal(copies.length, 1);
  function using(source, callback, options = {}) {
    let actual = new URL(options.href ?? "http://127.0.0.1/admin/list?tab=owned&q=qa#details");
    let subscribed = new URL(actual), pending = null, pointer = 0, refIndex = 0, effect = null;
    const refs = [], transitions = [], routerRequests = [], listeners = new Map();
    const initialState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["owned-tree"] };
    const stack = [{ url: actual.href, state: initialState }];
    const localWindow = {
      get location() { return actual; },
      history: {
        get state() { return stack[pointer].state; },
        pushState(state, unused, href) { actual = new URL(href, actual); stack.splice(++pointer); stack.push({ url: actual.href, state }); },
        replaceState(state, unused, href) { actual = new URL(href, actual); stack[pointer] = { url: actual.href, state }; },
      },
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name, fn) { assert.equal(listeners.get(name), fn); listeners.delete(name); },
    };
    const schedule = (value) => { pending = new URL(value); transitions.push(pending.href); };
    const uninstall = Function("window", "_react", "_useactionqueue", "_routerreducertypes", "_approuterinstance",
      copies[0].getText(nextFile) + "; return (" + historyEffects[0].getText(nextFile) + ")();")(
      localWindow, { startTransition: (fn) => fn() },
      { dispatchAppRouterAction: (action) => { assert.equal(action.type, "restore"); schedule(action.url); } },
      { ACTION_RESTORE: "restore" }, { dispatchTraverseAction: (href) => schedule(href) },
    );
    const oldWindow = globalThis.window;
    globalThis.window = localWindow;
    const reactPorts = {
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useRef: (value) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }),
      useEffect: (fn) => { effect = fn; },
    };
    const runtime = compile(source, {
      react: reactPorts,
      "next/navigation": { useSearchParams: () => new URLSearchParams(subscribed.search), useRouter: () => ({
        push: (href) => routerRequests.push(href), replace: (href) => routerRequests.push(href),
      }) },
      "./pagination": pagination, "./url-state": url,
    });
    let rows = options.rows ?? Array.from({ length: 123 }, (_, id) => ({ id: id + 1, name: "qa " + (id + 1) }));
    const contract = options.contract ?? { mode: "bounded-client", search: { paramKey: "q", minLength: 1 },
      matchesRow: (row, query) => row.name.includes(query.search), getRowId: (row) => row.id };
    const render = ({ effects = true } = {}) => {
      if (pending) { subscribed = pending; pending = null; }
      refIndex = 0;
      const result = runtime.useAdminBoundedClientPagination({ rows, datasetKey: "owned-dataset", queryContract: contract, ...options.hook });
      if (effects) effect(); return result;
    };
    try {
      callback({ render, url: () => new URL(actual), transitions, routerRequests, stack,
        effect: () => effect(), updateRows: (next) => { rows = next; },
        travel: (direction) => { pointer += direction; assert.ok(stack[pointer]); actual = new URL(stack[pointer].url); listeners.get("popstate")({ state: stack[pointer].state }); },
        external: (href) => localWindow.history.pushState(null, "", href),
      });
    } finally {
      uninstall(); assert.equal(listeners.size, 0);
      if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    }
  }
  const scenarios = {
    overlap(m) { const value = m.render(); value.setPageSize(50); value.applyQueryPatch({ q: "q" }, "replace"); assert.equal(m.url().searchParams.get("limit"), "50"); assert.equal(m.url().searchParams.get("q"), "q"); assert.equal(m.render().pageSize, 50); assert.equal(m.routerRequests.length, 0); },
    reverse(m) { const value = m.render(); value.applyQueryPatch({ q: "qa 1" }, "replace"); value.setPageSize(50); assert.equal(m.url().searchParams.get("q"), "qa 1"); assert.equal(m.render().pageSize, 50); },
    stalePage(m) { const value = m.render(); value.setPageSize(50); value.setPage(2); assert.equal(m.url().searchParams.get("limit"), "50"); const next = m.render(); assert.equal(next.pageSize, 50); assert.equal(next.page, 2); assert.equal(next.rows[0].id, 51); },
    staleReset(m) { const value = m.render(); value.setPageSize(50); value.resetPage(); assert.equal(m.url().searchParams.get("limit"), "50"); assert.equal(m.render().pageSize, 50); },
    staleEffect(m) { const value = m.render({ effects: false }); value.setPageSize(50); m.effect(); assert.equal(m.url().searchParams.get("limit"), "50"); assert.equal(m.render().pageSize, 50); },
    integration(m) { const value = m.render(); value.setPageSize(50); assert.equal(m.transitions.length, 1); assert.equal(m.render().pageSize, 50); assert.deepEqual(m.stack.at(-1).state.__PRIVATE_NEXTJS_INTERNALS_TREE, ["owned-tree"]); },
    history(m) { let value = m.render(); value.setPageSize(50); value = m.render(); value.setPage(2); assert.equal(m.render().page, 2); m.travel(-1); assert.equal(m.render().page, 1); assert.equal(m.render().pageSize, 50); m.travel(1); assert.equal(m.render().page, 2); assert.equal(m.url().hash, "#details"); assert.equal(m.url().searchParams.get("tab"), "owned"); },
    constraints(m) { let value = m.render(); value.setPageSize(7); assert.equal(m.render().pageSize, 10); value = m.render(); value.setPage(999); value = m.render(); assert.equal(value.page, 13); assert.equal(m.url().searchParams.get("page"), "13"); m.updateRows(Array.from({ length: 3 }, (_, id) => ({ id: id + 1, name: "qa" }))); m.render(); assert.equal(m.render().page, 1); assert.equal(m.url().searchParams.has("page"), false); },
    external(m) { m.render(); m.external("/admin/list?tab=external&q=qa&page=3&limit=20#external"); const restored = m.render(); assert.equal(restored.pageSize, 20); assert.equal(restored.page, 3); restored.setPage(2); assert.equal(m.url().searchParams.get("tab"), "external"); assert.equal(m.url().hash, "#external"); },
  };
  for (const scenario of Object.values(scenarios)) using(ownerSource, scenario);
  using(ownerSource, (m) => {
    const value = m.render(); value.setPageSize(20); value.setPage(2); assert.equal(m.url().searchParams.get("size"), "20");
    value.applyQueryPatch({ term: "qa 1" }, "replace"); assert.equal(m.url().searchParams.has("p"), false); assert.equal(m.render().pageSize, 20); assert.equal(m.url().searchParams.get("tab"), "owned"); assert.equal(m.url().hash, "#details");
  }, { href: "http://127.0.0.1/admin/list?tab=owned&term=qa#details", hook: { pageParamName: "p", limitParamName: "size", defaultPageSize: 5, pageSizeOptions: [5, 20] }, contract: { mode: "bounded-client", search: { paramKey: "term", minLength: 1 }, matchesRow: (r, q) => r.name.includes(q.search), getRowId: (r) => r.id } });
  const mutations = [
    ["internal history state skips Next synchronization", ownerSource.replaceAll('null,\n        "",', 'window.history.state,\n        "",'), scenarios.integration],
    ["stale size closure", ownerSource.replaceAll('currentPageSize(), "push"', 'pagination.pageSize, "push"'), scenarios.stalePage],
    ["stale reset closure", ownerSource.replaceAll('currentPageSize(), "replace"', 'pagination.pageSize, "replace"'), scenarios.staleReset],
    ["stale render normalization", ownerSource.replace('if (current.toString() !== searchParams.toString()) return;', ''), scenarios.staleEffect],
    ["stale committed-query source", ownerSource.replaceAll('new URLSearchParams(window.location.search)', 'new URLSearchParams(searchParams.toString())'), scenarios.overlap],
    ["hash dropped", ownerSource.replace('${window.location.hash}', ''), scenarios.history],
  ];
  for (const [name, mutant, scenario] of mutations) { assert.notEqual(mutant, ownerSource, name); assert.throws(() => using(mutant, scenario), undefined, name); }
  return { scenarios: Object.keys(scenarios).length + 1, negatives: mutations.length };
}
const boundedQueryProof = verifyBoundedQueryHistory(boundedClientController);
check("Bounded accepted intents preserve URL/history through actual Next integration", boundedQueryProof.scenarios === 10 && boundedQueryProof.negatives === 6);

// Execute actual consumer/owner callbacks. Effects are scheduled locally; no
// React DOM, browser, request, DB, or modal focus-trap claim is made here.
function filterFixture(source = toolbar, adapterSource = topicsAdapter, sourceFor = read) {
  let active;
  const equalDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const hooks = {
    useState(initial) {
      const runner = active, index = runner.index++;
      if (!runner.slots[index]) runner.slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [runner.slots[index].value, update => {
        const value = typeof update === "function" ? update(runner.slots[index].value) : update;
        if (!Object.is(value, runner.slots[index].value)) { runner.slots[index].value = value; if (active === runner) runner.dirty = true; }
      }];
    },
    useRef(value) { const runner = active, index = runner.index++; return (runner.slots[index] ??= { current: value }); },
    useId() { const runner = active, index = runner.index++; return `filter-fixture-${index}`; },
    useMemo(factory, deps) { const runner = active, index = runner.index++; const previous = runner.slots[index]; if (!previous || !equalDeps(previous.deps, deps)) runner.slots[index] = { value: factory(), deps }; return runner.slots[index].value; },
    useEffect(effect, deps) { const runner = active, index = runner.index++; const previous = runner.slots[index]; if (!previous || !equalDeps(previous.deps, deps)) runner.slots[index] = { effect, deps, cleanup: previous?.cleanup, pending: true }; },
    useTransition: () => [false, callback => callback()],
    useCallback: (callback, deps) => hooks.useMemo(() => callback, deps),
  };
  function runner(component) {
    const state = { slots: [], index: 0, dirty: false };
    return {
      render(props) {
        let tree, passes = 0;
        do { state.index = 0; state.dirty = false; const previous = active; active = state; try { tree = component(props); } finally { active = previous; } assert.ok(++passes < 10, "Controlled hooks settle"); } while (state.dirty);
        return tree;
      },
      effects() { for (const slot of state.slots) if (slot?.pending) { slot.cleanup?.(); slot.cleanup = slot.effect(); slot.pending = false; } },
      close() { for (const slot of state.slots) slot?.cleanup?.(); },
    };
  }
  let current = new URL("http://fixture.local/admin/content/topics?q=seed&sort=title_asc&limit=50&view=trash&page=4&owned=keep#content-topics-table");
  const patches = [], routeCalls = [], timers = new Map();
  let timerId = 0;
  const localWindow = { setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout: id => timers.delete(id) };
  const localDocument = { body: {}, activeElement: null, addEventListener() {}, removeEventListener() {} };
  const deniedFetch = () => { throw new Error("Data fetch is outside this local callback fixture"); };
  const globals = { window: localWindow, document: localDocument, fetch: deniedFetch };
  const pure = path => loadPureTypeScriptModule(path, {}, sourceFor(path));
  const url = pure("src/lib/admin/entity-list/url-state.ts");
  const scrollbar = pure("src/components/venesia-scrollbar-styles.ts");
  const styles = loadPureTypeScriptModule("src/lib/admin/admin-ui-styles.ts", { "../../components/venesia-scrollbar-styles": scrollbar }, sourceFor("src/lib/admin/admin-ui-styles.ts"));
  const buttons = pure("src/components/admin/ui/AdminModalButtons.tsx");
  const modalModule = loadPureTypeScriptModule("src/components/admin/VenesiaModal.tsx", {
    react: hooks, "react-dom": { createPortal: node => node }, "../../lib/admin/admin-ui-styles": styles,
    "./ui/AdminModalButtons": buttons, "../../hooks/use-client-mounted": { useClientMounted: () => true },
    "../venesia-scrollbar-styles": scrollbar, "./AdminFeedbackProvider": { useAdminFeedbackModalHost: () => ({ current: null }) },
  }, sourceFor("src/components/admin/VenesiaModal.tsx"), globals);
  const Search = props => React.createElement("input", { type: "search", value: props.value, placeholder: props.placeholder, disabled: props.disabled, onChange() {} });
  const DatePicker = props => React.createElement("input", props);
  const owner = loadPureTypeScriptModule("src/components/admin/entity-list/AdminEntityListFilters.tsx", {
    "../../../lib/admin/admin-ui-styles": styles,
    react: hooks, "react-dom": { createPortal: node => node }, "next/navigation": { useSearchParams: () => new URLSearchParams(current.search), useRouter: () => Object.fromEntries(["push", "replace"].map(behavior => [behavior, (href, options) => { routeCalls.push({ behavior, href, options }); current = new URL(href, current); }])) },
    "../../../hooks/use-client-mounted": { useClientMounted: () => true }, "../../../lib/admin/entity-list": { ...url, ...normalizer },
    "../VenesiaModal": modalModule, "../ui/AdminSearchInput": { default: Search }, "../ui/AdminDatePicker": { default: DatePicker },
    "../ui/admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: scrollbar.VENESIA_SCROLLBAR_VISUAL_CLASSES },
    "../ui/useAdminFloatingMenuPosition": { useAdminFloatingMenuPosition: () => null }, "./AdminFloatingLayerContext": { useAdminFloatingLayer: () => ({ setOpenLayerId() {} }) },
  }, source, globals).default;
  const dateTimeCell = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGridDateTimeCell.tsx", {
    react: hooks, "react-dom": { createPortal: node => node },
    "../../../lib/content-dates": pure("src/lib/content-dates.ts"),
    "./useAdminFloatingMenuPosition": { useAdminFloatingMenuPosition: () => null },
  }, sourceFor("src/components/admin/ui/AdminDataGridDateTimeCell.tsx"), globals);
  const gridIcons = loadPureTypeScriptModule("src/components/admin/ui/AdminDataGrid.tsx", { "../../../lib/admin/admin-ui-styles": styles, "next/link": { default: () => null }, "./AdminCheckbox": { default: () => null }, "./AdminDataGridQueryStatus": { default: () => null }, "./AdminDataGridDateTimeCell": dateTimeCell, "./admin-scrollbar-styles": { ADMIN_SCROLLBAR_VISUAL_CLASSES: scrollbar.VENESIA_SCROLLBAR_VISUAL_CLASSES } }, sourceFor("src/components/admin/ui/AdminDataGrid.tsx"));
  const iconModule = loadPureTypeScriptModule("src/components/admin/ui/AdminModuleTabs.tsx", { react: hooks, "./AdminForm": {}, "./AdminDataGrid": gridIcons, "../../../lib/admin/admin-ui-styles": styles }, sourceFor("src/components/admin/ui/AdminModuleTabs.tsx"));
  const adapter = loadPureTypeScriptModule("src/components/admin/content/UnifiedContentFilters.tsx", {
    react: hooks, "../../../lib/admin/content/category-hierarchy": pure("src/lib/admin/content/category-hierarchy.ts"),
    "../../../lib/admin/content/content-types": pure("src/lib/admin/content/content-types.ts"), "../ui/AdminModuleTabs": iconModule, "../ui/AdminDataGrid": gridIcons,
  }, adapterSource, globals).useUnifiedContentToolbar;
  const adapterRunner = runner(adapter), ownerRunner = runner(owner);
  const categories = [{ id: 11, name: "رئيسي", depth: 0, parent_id: null, children: [] }, { id: 12, name: "فرعي", depth: 1, parent_id: 11, children: [] }];
  const series = [{ id: 21, name: "منشورة", status: "published", deleted_at: null }, { id: 22, name: "مسودة", status: "unpublished", deleted_at: null }, { id: 23, name: "محذوفة", status: "published", deleted_at: "2026-01-01" }];
  function props(overrides = {}) {
    const params = current.searchParams;
    const initial = adapterRunner.render({ values: { q: params.get("q") ?? "", view: params.get("view") ?? "active", contentType: params.get("content_type") ?? "all", category: params.get("category") ?? "all", series: params.get("series") ?? "all", status: params.get("status") ?? "all", featured: params.get("featured") ?? "all", image: params.get("image") ?? "all" }, categories, series,
      onQueryPatch: (patch, behavior) => { patches.push({ patch: { ...patch }, behavior }); current = new URL(url.buildAdminEntityListHref(current.pathname, current.searchParams, patch, current.hash), current); },
    });
    return { ...initial, ...overrides };
  }
  let lastProps, tree;
  const renderProps = next => { lastProps = next; tree = ownerRunner.render(lastProps); return tree; };
  const render = overrides => renderProps(props(overrides));
  const elements = (node = tree, predicate = () => true) => {
    const visit = value => Array.isArray(value) ? value.flatMap(visit) : React.isValidElement(value) ? [...(predicate(value) ? [value] : []), ...visit(value.props.children)] : [];
    return visit(node);
  };
  const modal = () => elements(tree, node => node.type === modalModule.default)[0];
  const fields = () => elements(modal().props.children, node => typeof node.type === "function" && node.props.filter);
  const button = label => elements(modal().props.footer, node => node.props.children === label)[0];
  const search = () => elements(tree, node => node.type === Search)[0];
  function materialize(node) {
    if (Array.isArray(node)) return node.map((child, index) => { const value = materialize(child); return React.isValidElement(value) && value.key === null ? React.cloneElement(value, { key: `materialized-${index}` }) : value; });
    if (!React.isValidElement(node)) return node;
    if (typeof node.type === "function") return materialize(runner(node.type).render(node.props));
    return React.cloneElement(node, {}, materialize(node.props.children));
  }
  return { render, renderProps, props, ownerRunner, runner, modal, fields, button, search, elements, materialize, Search, DatePicker, modalModule, styles, patches, routeCalls, timers, hooks,
    queryOwner: url, icons: { AdminModuleTabIcon: iconModule.AdminModuleTabIcon, AdminDataGridActionIcon: gridIcons.AdminDataGridActionIcon },
    url: () => new URL(current), setUrl: href => { current = new URL(href, current); }, currentProps: () => lastProps,
    open: () => elements(tree, node => "data-admin-filter-trigger" in node.props)[0].props.onClick(),
    tree: () => tree, ssr: () => renderToStaticMarkup(materialize(tree)),
  };
}

const FILTER_IDS = ["content-type", "category", "series", "status", "image", "featured"];
const FILTER_KEYS = ["content_type", "category", "series", "status", "image", "featured"];
function verifyCinematicToolbarContract(source = toolbar) {
  const fixture = filterFixture(source);
  fixture.render(); const omitted = fixture.ssr();
  fixture.render({ presentation: "default" }); assert.equal(fixture.ssr(), omitted, "Explicit default and omission retain exact shared toolbar output");
  const before = fixture.elements(undefined, node => "data-admin-collection-toolbar-owner" in node.props)[0];
  assert.equal(before.props["data-admin-collection-toolbar-presentation"], "cinematic");
  fixture.render({ presentation: "cinematic" });
  const after = fixture.elements(undefined, node => "data-admin-collection-toolbar-owner" in node.props)[0];
  assert.equal(after.props["data-admin-collection-toolbar-presentation"], "cinematic");
  assert.equal(after.props.className, before.props.className, "Both compatibility names select the official shared Cinematic tokens");
  assert.ok(after.props.className.includes(fixture.styles.ADMIN_CINEMATIC_GOLD_V1.collection.toolbarSurface), "The official toolbar consumes its shared cinematic surface");
  assert.equal(fixture.search().props.presentation, "cinematic", "The canonical Search control receives the selected presentation");
  fixture.open(); fixture.render({ presentation: "cinematic" });
  assert.deepEqual(fixture.fields().map(field => field.props.filter.id), FILTER_IDS, "Presentation retains every existing Topics filter in original order");
  assert.equal(fixture.button("تطبيق الفلاتر").props.disabled, true);
  fixture.button("إلغاء").props.onClick(); fixture.render({ presentation: "cinematic" });
  fixture.search().props.onChange("بحث سينمائي"); fixture.render({ presentation: "cinematic" }); fixture.search().props.onEnter();
  assert.deepEqual(fixture.patches.at(-1), { patch: { q: "بحث سينمائي" }, behavior: "replace" });
  for (const [key, value] of [["sort", "title_asc"], ["limit", "50"], ["view", "trash"], ["owned", "keep"]]) assert.equal(fixture.url().searchParams.get(key), value);
  return true;
}
check("Cinematic Toolbar preserves default output, native filters and accepted Search URL semantics", verifyCinematicToolbarContract());
const cinematicToolbarMutants = [toolbar.replace('resolveAdminCollectionPresentation(requestedPresentation)', 'requestedPresentation'), toolbar.replaceAll('presentation === "cinematic"', 'false')];
check("Cinematic Toolbar negatives reject a legacy default alias and ignored official presentation", cinematicToolbarMutants.every(source => { assert.notEqual(source, toolbar); try { verifyCinematicToolbarContract(source); return false; } catch { return true; } }));
async function verifyColumnMenuCommitBoundary(source = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx")) {
  for (const presentation of ["default", "cinematic"]) {
    const fixture = filterFixture(), pending = [], attempts = [], commits = [];
    const Checkbox = () => null;
    let visible = ["title", "seo"], tree, runner;
    const document = { body: {}, addEventListener() {}, removeEventListener() {}, activeElement: null };
    const window = { requestAnimationFrame: callback => { callback(); return 1; }, cancelAnimationFrame() {} };
    function commit() {
      tree = runner.render({ presentation, columns: [{ key: "title", label: "العنوان", hideable: false }, { key: "seo", label: "SEO", hideable: true }], visibleColumns: visible, defaultColumns: ["title", "seo"], onChange: next => { visible = next; }, onPersist: columns => new Promise(resolve => { attempts.push([...columns]); pending.push(resolve); }) });
      commits.push({ columns: [...visible], pending: fixture.elements(tree, node => node.type === "span" && node.props.className?.includes("animate-spin")).length > 0 });
      runner.effects(); return tree;
    }
    const Owner = loadPureTypeScriptModule("src/components/admin/ui/AdminColumnVisibilityMenu.tsx", {
      react: fixture.hooks, "react-dom": { createPortal: node => node, flushSync: callback => { callback(); commit(); } },
      "../../../hooks/use-client-mounted": { useClientMounted: () => true },
      "../../../lib/admin/entity-list/column-preferences": loadPureTypeScriptModule("src/lib/admin/entity-list/column-preferences.ts"),
      "../../../lib/admin/admin-ui-styles": fixture.styles,
      "../entity-list/AdminFloatingLayerContext": { useAdminFloatingLayer: () => null },
      "./AdminCheckbox": { default: Checkbox }, "./useAdminFloatingMenuPosition": { useAdminFloatingMenuPosition: () => ({ style: {}, placement: "bottom" }) },
    }, source, { window, document }).default;
    runner = fixture.runner(Owner); commit();
    fixture.elements(tree, node => node.type === "button")[0].props.onClick(); commit();
    const toggle = () => fixture.elements(tree, node => node.type === Checkbox && node.props.label.endsWith("SEO"))[0].props.onChange();
    const drain = async () => { for (let count = 0; count < 8; count++) await Promise.resolve(); commit(); };
    toggle();
    assert.deepEqual(visible, ["title"]);
    assert.equal(commits.at(-1).pending, true, "The actual optimistic commit must already expose pending before passive effects run");
    await drain(); assert.deepEqual(attempts, [["title"]]); pending.shift()({ ok: false, message: "رفض العينة" }); await drain();
    assert.deepEqual(visible, ["title", "seo"], "Rejected first save restores the committed columns under both presentations");
    assert.ok(fixture.elements(tree, node => node.props.role === "alert").length === 1);
    toggle(); toggle(); await drain(); assert.equal(attempts.length, 2, "Only one serial queued write starts before settlement");
    pending.shift()({ ok: true }); await drain(); assert.equal(attempts.length, 3); assert.deepEqual(attempts.slice(1), [["title"], ["title", "seo"]]);
    pending.shift()({ ok: true }); await drain(); assert.deepEqual(visible, ["title", "seo"]); assert.equal(commits.at(-1).pending, false);
    runner.close();
  }
  return true;
}
check("Actual default and Cinematic Column Menu mark optimistic commits pending, roll back rejected saves and keep serial order", await verifyColumnMenuCommitBoundary());
const columnMenuCurrent = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx");
const prematureColumnCommit = columnMenuCurrent.replace(/flushSync\(\(\) => \{\s*setPendingSaves\(\(count\) => count \+ 1\);\s*onChange\(next\);\s*\}\);/u, 'flushSync(() => onChange(next)); setPendingSaves((count) => count + 1);');
assert.notEqual(prematureColumnCommit, columnMenuCurrent, "Rollback negative must apply to the current canonical owner");
await assert.rejects(() => verifyColumnMenuCommitBoundary(prematureColumnCommit), { name: "AssertionError" });
check("Column Menu negative reproduces the premature idle commit that loses rollback", true);
function verifyFilterTransactions(source = toolbar, adapterSource = topicsAdapter) {
  const fixture = filterFixture(source, adapterSource);
  fixture.render();
  const props = fixture.currentProps();
  assert.deepEqual(props.filters.map(filter => filter.id), FILTER_IDS);
  assert.deepEqual(props.filters.map(filter => filter.paramKey), FILTER_KEYS);
  assert.deepEqual(props.preserveParams, ["sort", "limit", "view"]);
  assert.equal(props.search.minLength, 2); assert.equal(props.search.debounceMs, 350);
  assert.equal(props.search.suggestions.maxResults, 8);
  assert.deepEqual(props.filters[1].options.map(option => [option.value, option.depth]), [["11", 0], ["12", 1]]);
  assert.deepEqual(props.filters[2].options.map(option => option.value), ["21", "any"]);
  const unchanged = fixture.url().href;
  fixture.open(); fixture.render(); assert.equal(fixture.modal().props.open, true);
  assert.equal(fixture.button("تطبيق الفلاتر").props.disabled, true);
  const chosen = ["news", "12", "21", "published", "without", "yes"];
  fixture.fields().forEach((field, index) => field.props.onChange(chosen[index])); fixture.render();
  assert.equal(fixture.url().href, unchanged); assert.equal(fixture.patches.length, 0);
  fixture.button("إلغاء").props.onClick(); fixture.render();
  assert.equal(fixture.modal().props.open, false);
  fixture.open(); fixture.render(); assert.ok(fixture.fields().every(field => field.props.value === "all"));
  fixture.fields()[0].props.onChange("news"); fixture.render(); fixture.modal().props.onClose(); fixture.render();
  fixture.open(); fixture.render(); assert.equal(fixture.fields()[0].props.value, "all");
  fixture.fields().forEach((field, index) => field.props.onChange(chosen[index])); fixture.render();
  assert.equal(fixture.button("تطبيق الفلاتر").props.disabled, false);
  fixture.button("تطبيق الفلاتر").props.onClick(); fixture.render();
  assert.deepEqual(fixture.patches, [{ patch: Object.fromEntries(FILTER_KEYS.map((key, index) => [key, chosen[index]])), behavior: "push" }]);
  const preserved = () => {
    for (const [key, value] of [["q", "seed"], ["sort", "title_asc"], ["limit", "50"], ["view", "trash"], ["owned", "keep"]]) assert.equal(fixture.url().searchParams.get(key), value);
    assert.equal(fixture.url().searchParams.has("page"), false); assert.equal(fixture.url().hash, "#content-topics-table");
  };
  preserved(); assert.equal(fixture.modal().props.open, false);
  fixture.open(); fixture.render(); fixture.button("مسح الكل").props.onClick(); fixture.render();
  assert.equal(fixture.patches.length, 1); assert.ok(fixture.fields().every(field => field.props.value === "all"));
  fixture.button("إلغاء").props.onClick(); fixture.render(); fixture.open(); fixture.render();
  assert.deepEqual(fixture.fields().map(field => field.props.value), chosen);
  fixture.modal().props.onClose(); fixture.render();
  const removeStatus = fixture.elements(undefined, node => node.props["aria-label"] === "إزالة فلتر الحالة")[0];
  assert.ok(removeStatus); removeStatus.props.onClick(); fixture.render();
  assert.deepEqual(fixture.patches.at(-1), { patch: { status: null }, behavior: "push" }); preserved();
  fixture.open(); fixture.render(); fixture.button("مسح الكل").props.onClick(); fixture.render();
  fixture.button("تطبيق الفلاتر").props.onClick(); fixture.render();
  assert.deepEqual(fixture.patches.at(-1).patch, Object.fromEntries(FILTER_KEYS.map(key => [key, null]))); preserved();
  let cleared = 0;
  fixture.setUrl("?q=seed&sort=title_asc&limit=50&view=trash&status=published&owned=keep#content-topics-table");
  fixture.render({ onClearFilters: () => { cleared += 1; } });
  fixture.elements(undefined, node => node.props.children === "مسح كل الفلاتر")[0].props.onClick(); fixture.render();
  assert.equal(cleared, 1); assert.ok(FILTER_KEYS.every(key => !fixture.url().searchParams.has(key))); preserved();
  fixture.render({ contextOverrideActive: true, contextOverride: React.createElement("span", { "data-bulk-probe": "" }, "تحديد") });
  assert.equal(fixture.elements(undefined, node => "data-admin-context-mode" in node.props)[0].props["data-admin-context-mode"], "bulk");
  fixture.search().props.onChange("  بحث    جديد  "); fixture.render(); fixture.search().props.onEnter(); fixture.render();
  assert.deepEqual(fixture.patches.at(-1), { patch: { q: "بحث جديد" }, behavior: "replace" });
  fixture.search().props.onChange("س"); fixture.render(); fixture.search().props.onEnter(); fixture.render();
  assert.deepEqual(fixture.patches.at(-1), { patch: { q: null }, behavior: "replace" });
  fixture.search().props.onClear(); fixture.render(); assert.equal(fixture.search().props.value, "");
  fixture.search().props.onChange("مؤقت"); fixture.render(); fixture.search().props.onEscape(); fixture.render();
  assert.equal(fixture.search().props.value, fixture.currentProps().search.value);
  fixture.render({ search: { ...fixture.props().search, disabled: true } }); assert.equal(fixture.search().props.disabled, true);
  fixture.render({ filters: [] }); assert.equal(fixture.elements(undefined, node => "data-admin-filter-trigger" in node.props)[0].props.disabled, true);
  fixture.setUrl("?q=seed&sort=title_asc&limit=50&view=trash&page=4&owned=keep#content-topics-table");
  fixture.render({ onQueryPatch: undefined }); fixture.open(); fixture.render({ onQueryPatch: undefined });
  fixture.fields()[3].props.onChange("published"); fixture.render({ onQueryPatch: undefined });
  fixture.button("تطبيق الفلاتر").props.onClick();
  assert.equal(fixture.routeCalls.length, 1); assert.equal(fixture.routeCalls[0].behavior, "push"); assert.deepEqual(fixture.routeCalls[0].options, { scroll: false }); preserved();
  const debounce = filterFixture(source, adapterSource);
  const withoutSuggestions = () => ({ search: { ...debounce.props().search, suggestions: undefined } });
  debounce.render(withoutSuggestions()); debounce.ownerRunner.effects();
  debounce.search().props.onChange("  بحث    مؤجل "); debounce.render(withoutSuggestions()); debounce.ownerRunner.effects();
  assert.equal(debounce.patches.length, 0); assert.equal(debounce.timers.size, 1);
  const timer = [...debounce.timers.values()][0]; assert.equal(timer.delay, 350);
  debounce.timers.clear(); timer.callback();
  assert.deepEqual(debounce.patches, [{ patch: { q: "بحث مؤجل" }, behavior: "replace" }]);
  debounce.ownerRunner.close();
  const selection = loadPureTypeScriptModule("src/components/admin/ui/useAdminGridSelection.ts", { react: fixture.hooks }).useAdminGridSelection;
  const selectionRunner = fixture.runner(({ ids }) => selection(ids));
  let selected = selectionRunner.render({ ids: [1, 2] }); selectionRunner.effects();
  selected.toggleOne(1, true); selected = selectionRunner.render({ ids: [1, 2] }); selectionRunner.effects();
  assert.deepEqual(selected.selectedIds, [1]);
  selected = selectionRunner.render({ ids: [1, 2] }); selectionRunner.effects(); assert.deepEqual(selected.selectedIds, [1]);
  selectionRunner.render({ ids: [2, 3] }); selectionRunner.effects();
  assert.deepEqual(selectionRunner.render({ ids: [2, 3] }).selectedIds, []);
  return fixture;
}
function verifyFilterComposition(source = toolbar, adapterSource = topicsAdapter) {
  const fixture = filterFixture(source, adapterSource);
  fixture.render(); fixture.open(); fixture.render();
  const modal = fixture.modal();
  assert.equal(modal.props.density, "compact"); assert.ok(modal.props.headerIcon);
  assert.equal(modal.props.closeOnEscape, true, "Filter dialog explicitly opts into its existing cancel path");
  const grid = fixture.elements(modal.props.children, node => "data-admin-filter-modal-fields" in node.props)[0];
  assert.equal(grid.props["data-admin-filter-panel-presentation"], "premium");
  assert.ok(grid.props.className.split(/\s+/u).includes("md:grid-cols-2"), "The real fields parent supplies the paired-column layout");
  assert.deepEqual(fixture.fields().map(field => field.props.filter.id), FILTER_IDS);
  const widths = fixture.fields().map(field => {
    const tree = fixture.runner(field.type).render(field.props);
    assert.equal(tree.type, "fieldset");
    assert.equal(tree.props["data-admin-filter-field"], field.props.filter.id);
    assert.equal(tree.props.className.split(/\s+/u).includes("md:col-span-2"), ["content-type", "featured"].includes(field.props.filter.id), "Full-width markers must agree with the real fieldset's grid span");
    const actual = fixture.materialize(tree);
    assert.equal(fixture.elements(actual, node => node.type === "legend").length, 1);
    assert.equal(fixture.elements(actual, node => node.props.role === "listbox").length, 1);
    assert.equal(fixture.elements(actual, node => node.type === "input" && node.props.type === "checkbox").length, 0);
    const options = fixture.elements(actual, node => node.props.role === "option");
    assert.equal(options.length, field.props.filter.options.length + 1);
    assert.ok(options.every(option => option.type === "button" && option.props.type === "button" && typeof option.props["aria-selected"] === "boolean"));
    return tree.props["data-admin-filter-field-width"];
  });
  assert.deepEqual(widths, ["full", "half", "half", "half", "half", "full"], "Actual fieldsets keep two full rows and four paired fields including featured");
  const props = fixture.currentProps();
  for (const presentation of [undefined, props.filterPanelPresentation]) {
    const field = fixture.fields()[1];
    const disabled = fixture.runner(field.type).render({ ...field.props, filter: { ...field.props.filter, disabled: true, options: [{ value: "blocked", label: "محظور", disabled: true }] }, presentation });
    assert.equal(disabled.props.disabled, true);
    const native = fixture.materialize(disabled);
    assert.equal(fixture.elements(native, node => node.props.role === "option" && node.props.disabled)[0].props.disabled, true);
  }
  const field = fixture.fields()[1], fieldRunner = fixture.runner(field.type);
  let fieldTree = fieldRunner.render(field.props);
  fixture.elements(fieldTree, node => node.type === "input")[0].props.onChange({ currentTarget: { value: "غير موجود" } });
  fieldTree = fixture.materialize(fieldRunner.render(field.props));
  assert.equal(fixture.elements(fieldTree, node => node.props.role === "option").length, 1, "Search keeps the canonical All option and empty-result state");
  assert.ok(renderToStaticMarkup(fieldTree).includes("لا توجد خيارات مطابقة."));
  fixture.render({ filterPanelPresentation: undefined });
  assert.equal(fixture.modal().props.density, undefined); assert.equal(fixture.modal().props.headerIcon, undefined);
  assert.ok(fixture.fields().every(item => item.props.presentation === undefined));
  return fixture;
}
check("Actual Topics filter transactions execute draft/apply/cancel/clear/search and canonical URL preservation", Boolean(verifyFilterTransactions()));
check("Actual premium fields retain all six native contracts, paired/full ancestry, disabled/default states and scoped decoration", Boolean(verifyFilterComposition()));
const filterMutants = [
  toolbar.replace('navigate(patch, "push");', 'navigate(patch, "replace");'),
  toolbar.replace('function cancelFilters() {', 'function cancelFilters() { navigate({ q: null }, "push");'),
  toolbar.replace('function clearDraftFilters() {', 'function clearDraftFilters() { navigate({ q: null }, "push");'),
  toolbar.replace('navigate({ [searchParamKey]: next || null }, "replace")', 'navigate({ [searchParamKey]: next || null }, "push")'),
  toolbar.replace('setDraftFilters({ ...values });', 'setDraftFilters({});'),
];
check("Transaction negatives reject wrong history, premature cancel/clear writes and stale reopening", filterMutants.every(source => {
  if (source === toolbar) return false;
  try { verifyFilterTransactions(source); return false; } catch { return true; }
}));
const compositionMutants = [
  toolbar.replace('        closeOnEscape\n', '        closeOnEscape={false}\n'),
  toolbar.replace('presentation={filterPanelPresentation}', 'presentation={undefined}'),
  toolbar.replace('data-admin-filter-field-width={premium ? fullWidth ? "full" : "half" : undefined}', 'data-admin-filter-field-width={premium ? "half" : undefined}'),
  toolbar.replace('{filters.map((filter) => (', '{filters.slice(0, -1).map((filter) => ('),
  toolbar.replaceAll('fullWidth ? "md:col-span-2" : ""', '""'),
];
check("Composition negatives reject premium tokens on an unrelated path and flattened real field widths", compositionMutants.every(source => {
  if (source === toolbar) return false;
  try { verifyFilterComposition(source); return false; } catch { return true; }
}));

// These are acceptance cases for the named adoption, not a second filter
// registry. Definitions, conditions, value mapping and callbacks are extracted
// from the actual consumer mount; the shared fields execute without a browser.
const filterAdoptionCases = [
  { id: "categories", path: "src/app/admin/content/categories/CategoriesListClient.tsx", route: "/admin/content/categories", declarations: ["BASE_PATH", "STATUS_FILTER", "isTrashView", "filters"], ids: ["categories-status-filter"], keys: ["status"], types: ["status"], widths: ["full"] },
  { id: "series", path: "src/app/admin/content/series/SeriesTableClient.tsx", route: "/admin/content/series", declarations: ["BASE_PATH", "STATUS_FILTER", "isTrashView", "filters"], ids: ["series-status-filter", "series-category-filter"], keys: ["status", "category"], types: ["status", "hierarchical_entity_select"], widths: ["full", "full"] },
  { id: "media", path: "src/components/admin/media/MediaLibraryCore.tsx", route: "/admin/media-library", declarations: ["MEDIA_LIBRARY_FILTERS", "pickerKind"], ids: ["kind"], keys: ["kind"], types: ["single_select"], widths: ["full"] },
  { id: "projects", path: "src/app/admin/projects/ProjectsTableClient.tsx", route: "/admin/projects/residential", declarations: ["PROJECT_FILTERS"], ids: ["project-publication-status", "project-featured"], keys: ["publication_status", "featured"], types: ["status", "boolean"], widths: ["half", "half"] },
];
function descendants(node, predicate) {
  const result = [];
  const visit = value => { if (predicate(value)) result.push(value); ts.forEachChild(value, visit); };
  visit(node); return result;
}
function consumerFilterSource(spec, source) {
  const tree = ts.createSourceFile(spec.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(tree.parseDiagnostics.length, 0, `Consumer fixture parses ${spec.path}`);
  const media = spec.id === "media";
  const imported = descendants(tree, ts.isImportDeclaration).flatMap(node => {
    const path = node.moduleSpecifier.text;
    if (media && path === "../entity-list/AdminEntityListFilters" && node.importClause?.name) return [node.importClause.name.text];
    if (!media && path.endsWith("/components/admin/entity-list")) {
      return (node.importClause?.namedBindings?.elements ?? []).filter(item => (item.propertyName ?? item.name).text === "AdminEntityList").map(item => item.name.text);
    }
    return [];
  });
  assert.equal(imported.length, 1, `Exactly one canonical filter composition import ${spec.path}`);
  const mounts = descendants(tree, node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === imported[0]);
  assert.equal(mounts.length, 1, `Exactly one actual consumer mount ${spec.path}`);
  const attributes = mounts[0].attributes.properties;
  let expression;
  if (media) {
    const names = new Set(["basePath", "search", "filters", "values", "onQueryPatch", "filterPanelPresentation"]);
    const entries = attributes.filter(node => ts.isJsxAttribute(node) && names.has(node.name.getText(tree))).map(node => {
      const value = node.initializer;
      assert.ok(value && (ts.isStringLiteral(value) || ts.isJsxExpression(value)), "Supported actual toolbar prop syntax");
      return `${node.name.getText(tree)}: ${ts.isStringLiteral(value) ? JSON.stringify(value.text) : value.expression.getText(tree)}`;
    });
    expression = `({${entries.join(",\n")}})`;
  } else {
    const toolbarAttribute = attributes.find(node => ts.isJsxAttribute(node) && node.name.getText(tree) === "toolbar");
    assert.ok(toolbarAttribute && ts.isJsxExpression(toolbarAttribute.initializer) && ts.isObjectLiteralExpression(toolbarAttribute.initializer.expression), "Actual Entity List toolbar object required");
    expression = toolbarAttribute.initializer.expression.getText(tree);
  }
  const declarations = spec.declarations.map(name => {
    const declarations = descendants(tree, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name);
    assert.equal(declarations.length, 1, `Exactly one actual ${name} binding ${spec.path}`);
    assert.ok(declarations[0].initializer, `Actual ${name} has an initializer`);
    return `const ${declarations[0].getText(tree)};`;
  });
  if (media) {
    const histories = descendants(tree, node => ts.isFunctionDeclaration(node) && node.name?.text === "updateLibraryHistory");
    assert.equal(histories.length, 1, "Actual Media history adapter remains authoritative");
    declarations.push(histories[0].getText(tree));
  }
  const selected = `${declarations.join("\n")}\nreturn (${expression});`;
  const selectedTree = ts.createSourceFile("filter-contract.tsx", `function consumerFixture(){${selected}}`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const transformed = ts.transform(selectedTree, [context => {
    const visit = node => ts.isPropertyAssignment(node) && node.name.getText(selectedTree) === "filterPanelPresentation" ? undefined : ts.visitEachChild(node, visit, context);
    return node => ts.visitNode(node, visit);
  }]);
  const structure = node => {
    const children = []; ts.forEachChild(node, child => { children.push(structure(child)); });
    return { kind: node.kind, text: !ts.isSourceFile(node) && typeof node.text === "string" ? node.text : undefined, children };
  };
  let contract;
  try { contract = JSON.stringify(structure(transformed.transformed[0])); } finally { transformed.dispose(); }
  return { executable: `export function consumerFixture(){${selected}}`, contract };
}
function actualConsumerToolbar(spec, fixture, { source = read(spec.path), view = "active", type = "residential", mode = "manage", initialKind = "image", values = {} } = {}) {
  const analyzed = consumerFilterSource(spec, source);
  const history = [], patches = [], state = { query: "seed", kind: "all", page: 4, selected: [11] };
  fixture.setUrl(`http://fixture.local${spec.route}?q=seed&sort=title_asc&limit=20&view=${view}&folder=images%2Fproject%2Fj191%2Fwork&page=4&owned=keep#owned`);
  const categoryOptions = [{ value: "11", label: "رئيسي", depth: 0 }, { value: "12", label: "فرعي", depth: 1 }, { value: "blocked", label: "محظور", disabled: true, depth: 1 }];
  const controller = {
    query: { search: "seed", filters: { view, status: "all", categoryId: null, publicationStatus: "all", featured: "all", ...values } },
    result: { metrics: { categoryOptions } },
    applyQueryPatch(patch, behavior = "push") {
      patches.push({ patch: { ...patch }, behavior });
      const href = fixture.queryOwner.buildAdminEntityListHref(spec.route, fixture.url().searchParams, patch, fixture.url().hash);
      history.push({ behavior, href }); fixture.setUrl(href);
    },
  };
  const localWindow = {
    get location() { return fixture.url(); },
    history: { state: { fixture: true }, pushState(_state, _title, href) { history.push({ behavior: "push", href }); fixture.setUrl(href); }, replaceState(_state, _title, href) { history.push({ behavior: "replace", href }); fixture.setUrl(href); } },
  };
  const component = loadPureTypeScriptModule(spec.path, {}, analyzed.executable, {
    useMemo: fixture.hooks.useMemo, controller, type, basePath: type === "commercial" ? "/admin/projects/commercial" : spec.route,
    mode, initialKind, query: state.query, kind: values.kind ?? state.kind,
    setQuery: value => { state.query = value; }, setKind: value => { state.kind = value; },
    setPageNumber: value => { state.page = value; }, setSelectedIds: value => { state.selected = value; },
    applyAdminEntityUrlPatch: fixture.queryOwner.applyAdminEntityUrlPatch, window: localWindow, ...fixture.icons,
  }).consumerFixture;
  const props = fixture.runner(component).render({});
  if (spec.id !== "media") assert.equal(props.onQueryPatch, controller.applyQueryPatch, "Canonical controller callback identity");
  assert.equal(props.basePath, type === "commercial" && spec.id === "projects" ? "/admin/projects/commercial" : spec.route);
  return { props, history, patches, state, categoryOptions, contract: analyzed.contract };
}
function verifyConsumerFilterAdoption(spec, source = read(spec.path), ownerSource = toolbar) {
  const fixture = filterFixture(ownerSource), actual = actualConsumerToolbar(spec, fixture, { source });
  const props = actual.props;
  assert.equal(props.filterPanelPresentation?.variant, "premium", `${spec.id} explicitly adopts the shared panel`);
  assert.deepEqual(props.filters.map(filter => filter.id), spec.ids);
  assert.deepEqual(props.filters.map(filter => filter.paramKey), spec.keys);
  assert.deepEqual(props.filters.map(filter => filter.type), spec.types);
  fixture.renderProps(props); fixture.open(); fixture.renderProps(props);
  assert.equal(fixture.modal().props.size, "md", "One/two-filter Premium panels use the bounded shared width");
  assert.equal(fixture.modal().props.density, "compact"); assert.equal(fixture.modal().props.closeOnEscape, true);
  const initialUrl = fixture.url().href, initialValues = fixture.fields().map(field => field.props.value);
  const selected = props.filters.map(filter => filter.options.find(option => !option.disabled).value);
  const expectedWidths = fixture.fields().map((field, index) => {
    const rendered = fixture.runner(field.type).render(field.props);
    assert.equal(rendered.type, "fieldset"); assert.equal(rendered.props["data-admin-filter-field"], spec.ids[index]);
    assert.equal(rendered.props.className.split(/\s+/u).includes("md:col-span-2"), spec.widths[index] === "full");
    const native = fixture.materialize(rendered), options = fixture.elements(native, node => node.props.role === "option");
    assert.equal(options.length, field.props.filter.options.length + 1);
    assert.ok(options.every(option => option.type === "button" && option.props.type === "button" && typeof option.props["aria-selected"] === "boolean"));
    assert.equal(fixture.elements(native, node => node.type === "input" && ["checkbox", "radio"].includes(node.props.type)).length, 0, "Presentation must not replace the single-selection contract");
    assert.equal(Boolean(field.props.filter.searchable), spec.id === "series" && index === 1, "Only the existing Series category declares option search");
    const selection = options.find(option => option.props["aria-selected"]);
    assert.ok(selection, "All/current selection remains present");
    if (field.props.filter.searchable) {
      const search = fixture.elements(native, node => node.type === "input" && node.props.type === "search")[0];
      assert.ok(search?.props["aria-label"]); assert.equal(field.props.filter.type, "hierarchical_entity_select");
      assert.deepEqual(field.props.filter.options, actual.categoryOptions);
      assert.equal(options.find(option => option.props.disabled)?.props.disabled, true);
      const fieldRunner = fixture.runner(field.type);
      let tree = fieldRunner.render(field.props);
      fixture.elements(tree, node => node.type === "input")[0].props.onChange({ currentTarget: { value: "فرعي" } });
      tree = fixture.materialize(fieldRunner.render(field.props));
      assert.equal(fixture.elements(tree, node => node.props.role === "option").length, 2, "Actual list search retains All and the matching descendant");
    }
    // Invoke the actual native option callback, through the field's onChange.
    options[1].props.onClick();
    return rendered.props["data-admin-filter-field-width"];
  });
  assert.deepEqual(expectedWidths, spec.widths);
  fixture.renderProps(props); assert.equal(fixture.url().href, initialUrl); assert.equal(actual.history.length, 0);
  fixture.button("إلغاء").props.onClick(); fixture.renderProps(props); fixture.open(); fixture.renderProps(props);
  assert.deepEqual(fixture.fields().map(field => field.props.value), initialValues, "Cancel discards drafts");
  fixture.button("مسح الكل").props.onClick(); fixture.renderProps(props); assert.equal(actual.history.length, 0, "Clear changes only the draft");
  fixture.modal().props.onClose(); fixture.renderProps(props); fixture.open(); fixture.renderProps(props);
  assert.deepEqual(fixture.fields().map(field => field.props.value), initialValues, "Escape/close shares the existing cancel path");
  fixture.fields().forEach((field, index) => field.props.onChange(selected[index])); fixture.renderProps(props);
  assert.equal(fixture.button("تطبيق الفلاتر").props.disabled, false);
  fixture.button("تطبيق الفلاتر").props.onClick(); fixture.renderProps(props);
  assert.equal(actual.history.length, 1, "Apply reaches the actual consumer callback exactly once"); assert.equal(actual.history[0].behavior, "push");
  spec.keys.forEach((key, index) => assert.equal(fixture.url().searchParams.get(key), selected[index]));
  for (const [key, value] of [["q", "seed"], ["sort", "title_asc"], ["limit", "20"], ["view", "active"], ["folder", "images/project/j191/work"], ["owned", "keep"]]) assert.equal(fixture.url().searchParams.get(key), value);
  assert.equal(fixture.url().searchParams.has("page"), false); assert.equal(fixture.url().hash, "#owned");
  if (spec.id === "media") { assert.equal(actual.state.kind, selected[0]); assert.equal(actual.state.page, 1); assert.deepEqual(actual.state.selected, []); }
  else assert.deepEqual(actual.patches, [{ patch: Object.fromEntries(spec.keys.map((key, index) => [key, selected[index]])), behavior: "push" }]);
  const inactive = Object.fromEntries(spec.keys.map(key => [key, "legacy-inactive"]));
  fixture.renderProps({ ...props, values: inactive }); fixture.open(); fixture.renderProps({ ...props, values: inactive });
  assert.deepEqual(fixture.fields().map(field => field.props.value), spec.keys.map(() => "legacy-inactive"));
  fixture.modal().props.onClose(); fixture.renderProps({ ...props, values: inactive }); assert.equal(actual.history.length, 1, "Unchanged inactive native values are not silently submitted or normalized");
  return { id: spec.id, route: spec.route, filterIds: spec.ids, queryKeys: spec.keys, nativeWidths: expectedWidths, panelSize: "md", callbackAndDraftParity: true, inactiveNativeRetention: true };
}
function verifyNonTargetFilterModes(spec, source = read(spec.path), ownerSource = toolbar) {
  const scenarios = spec.id === "projects" ? [{ type: "commercial" }] : spec.id === "media" ? ["select-one", "select-many"].flatMap(mode => ["image", "document"].map(initialKind => ({ mode, initialKind }))) : [{ view: "trash" }];
  for (const scenario of scenarios) {
    const fixture = filterFixture(ownerSource), actual = actualConsumerToolbar(spec, fixture, { source, ...scenario });
    fixture.renderProps(actual.props);
    const trigger = fixture.elements(undefined, node => "data-admin-filter-trigger" in node.props)[0];
    if (scenario.type === "commercial") {
      assert.equal(actual.props.filterPanelPresentation, undefined, "Commercial retains the default presentation");
      fixture.open(); fixture.renderProps(actual.props); assert.equal(fixture.modal().props.size, "lg"); assert.equal(fixture.modal().props.density, undefined);
    } else {
      assert.equal(actual.props.filters.length, 0, "Trash and typed picker retain their current no-filter capability");
      assert.equal(trigger.props.disabled, true);
      if (spec.id === "media") assert.equal(actual.props.filterPanelPresentation, undefined, "Picker never inherits management's Premium presentation");
    }
    assert.equal(actual.history.length, 0);
  }
  return scenarios.length;
}
const adoptionProof = { targets: filterAdoptionCases.map(spec => verifyConsumerFilterAdoption(spec)), retainedModes: filterAdoptionCases.reduce((sum, spec) => sum + verifyNonTargetFilterModes(spec), 0) };
check("Actual target consumer mounts preserve definitions, native selection, drafts, callbacks, URL context and compact panel sizing", adoptionProof.targets.length === 4);
check("Commercial, typed Media pickers and taxonomy Trash retain their current presentation/capabilities", adoptionProof.retainedModes === 7);
const adoptionNegativeCases = [
  { id: "wrong modality width", spec: filterAdoptionCases[0], owner: toolbar.replace(/size=\{[^\n]+\}/u, 'size="lg"') },
  { id: "wrong consumer mount", spec: filterAdoptionCases[0], source: read(filterAdoptionCases[0].path).replace("toolbar={{", "unrelatedToolbar={{") },
  { id: "wrong query key", spec: filterAdoptionCases[0], source: read(filterAdoptionCases[0].path).replace('paramKey: "status"', 'paramKey: "wrong-status"') },
  { id: "lost canonical callback", spec: filterAdoptionCases[1], source: read(filterAdoptionCases[1].path).replace("onQueryPatch: controller.applyQueryPatch", "onQueryPatch: () => {}") },
  { id: "lost hierarchy search", spec: filterAdoptionCases[1], source: read(filterAdoptionCases[1].path).replace("searchable: true", "searchable: false") },
  { id: "lost native field", spec: filterAdoptionCases[2], source: read(filterAdoptionCases[2].path).replace("filters={pickerKind ? [] : MEDIA_LIBRARY_FILTERS}", "filters={[]}") },
  { id: "lost Media selection reset", spec: filterAdoptionCases[2], source: read(filterAdoptionCases[2].path).replace("setSelectedIds([]);\n            }}", "setSelectedIds([11]);\n            }}") },
];
check("Consumer mutation probes reject wrong paths, widths, query keys, callbacks, search, fields and adapter state loss", adoptionNegativeCases.every(({ spec, source, owner }) => {
  assert.ok(source ? source !== read(spec.path) : owner !== toolbar, "Every mutation must change actual source");
  try { verifyConsumerFilterAdoption(spec, source, owner); return false; } catch { return true; }
}));
const eligibilityNegatives = [
  { spec: filterAdoptionCases[3], condition: 'type === "residential"' },
  { spec: filterAdoptionCases[2], condition: 'mode === "manage" && !pickerKind' },
];
check("Eligibility mutation probes reject forced Premium on Commercial and Media picker modes", eligibilityNegatives.every(({ spec, condition }) => {
  const source = read(spec.path), tree = ts.createSourceFile(spec.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = descendants(tree, node => (ts.isPropertyAssignment(node) || ts.isJsxAttribute(node)) && node.name.getText(tree) === "filterPanelPresentation");
  assert.equal(declarations.length, 1, "Mutate the actual consumer presentation property, not an unrelated header condition");
  const initializer = declarations[0].initializer;
  const expression = ts.isJsxExpression(initializer) ? initializer.expression : initializer;
  assert.ok(ts.isConditionalExpression(expression)); assert.equal(expression.condition.getText(tree), condition);
  const mutated = source.slice(0, expression.condition.getStart(tree)) + "true" + source.slice(expression.condition.end);
  try { verifyNonTargetFilterModes(spec, mutated); return false; } catch { return true; }
}));
const adoptionBaselineArgument = process.argv.find(argument => argument.startsWith("--adoption-baseline-file="));
if (adoptionBaselineArgument) {
  const receiptPath = resolve(ROOT, adoptionBaselineArgument.slice("--adoption-baseline-file=".length));
  const entries = JSON.parse(readFileSync(receiptPath, "utf8"));
  const sourceRoot = resolve(dirname(receiptPath), basename(receiptPath, ".json"));
  const before = path => {
    const entry = entries.find(item => item.path === path); assert.ok(entry, `Captured adoption baseline ${path}`);
    const bytes = readFileSync(resolve(sourceRoot, path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256.toLowerCase(), `Unchanged captured bytes ${path}`);
    return normalizeVerificationText(bytes.toString("utf8"), { loneCR: true });
  };
  for (const spec of filterAdoptionCases) assert.equal(consumerFilterSource(spec, read(spec.path)).contract, consumerFilterSource(spec, before(spec.path)).contract, `Exact ${spec.id} filter definitions, conditions, values and callbacks AST parity`);
  adoptionProof.capturedContractParity = filterAdoptionCases.map(spec => spec.id);
  check("Captured exact consumer ASTs preserve domain/query/callback contracts apart from the declared presentation property", adoptionProof.capturedContractParity.length === 4);
}
const adoptionOutputArgument = process.argv.find(argument => argument.startsWith("--adoption-output-file="));
if (adoptionOutputArgument) writeFileSync(resolve(ROOT, adoptionOutputArgument.slice("--adoption-output-file=".length)), JSON.stringify({ status: failures.length ? "FAIL" : "PASS", ...adoptionProof, negatives: adoptionNegativeCases.map(item => item.id), eligibilityNegatives: eligibilityNegatives.length, sources: filterAdoptionCases.map(({ path }) => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(ROOT, path))).digest("hex") })), limitations: ["Actual consumer toolbar/filter subtrees are extracted from their canonical JSX mount and executed with controlled hooks; opaque collection callbacks use canonical URL helpers and local memory history.", "Actual field/native callbacks run, including Media history/reset adapter. Network, DB, full consumer lifecycle, rendered viewport geometry, browser focus/Escape and Owner Visual Approval remain separate.", "Inactive-value retention proves the shared native draft/cancel boundary, not acceptance of unknown values by each domain's server query schema."] }, null, 2) + "\n");

const baselineArgument = process.argv.find(argument => argument.startsWith("--baseline-file="));
if (baselineArgument) {
  const baselinePath = resolve(ROOT, baselineArgument.slice("--baseline-file=".length));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const sha = value => createHash("sha256").update(value).digest("hex");
  const owners = ["src/components/admin/entity-list/AdminEntityListFilters.tsx", "src/components/admin/content/UnifiedContentFilters.tsx", "src/components/admin/VenesiaModal.tsx", "src/lib/admin/admin-ui-styles.ts"];
  const before = path => {
    const entry = baseline.entries.find(item => item.path === path);
    if (!entry) { assert.ok(!owners.includes(path), `Missing owned baseline ${path}`); return read(path); }
    const bytes = readFileSync(resolve(dirname(baselinePath), "baseline", path));
    assert.equal(sha(bytes), entry.sha256.toLowerCase(), `Exact baseline bytes ${path}`);
    return normalizeVerificationText(bytes.toString("utf8"), { loneCR: true });
  };
  const snapshots = sourceFor => {
    const results = [];
    for (const surface of ["standalone", "embedded"]) for (const mode of ["closed", "open", "active", "disabled", "date"]) {
      const fixture = filterFixture(sourceFor(owners[0]), sourceFor(owners[1]), sourceFor);
      if (mode === "active") fixture.setUrl("?q=seed&status=published&category=12&view=trash#content-topics-table");
      const overrides = { surface, filterPanelPresentation: undefined };
      if (mode === "disabled") overrides.search = { ...fixture.props().search, disabled: true };
      if (mode === "date") Object.assign(overrides, { filters: [{ id: "from", paramKey: "dateFrom", type: "date", label: "من" }, { id: "to", paramKey: "dateTo", type: "date_range", label: "إلى" }], values: { dateFrom: "2026-01-01", dateTo: "2026-02-01" } });
      fixture.render(overrides);
      if (mode !== "closed") { fixture.open(); fixture.render(overrides); }
      results.push({ surface, mode, html: fixture.ssr() });
    }
    const fixture = filterFixture(sourceFor(owners[0]), sourceFor(owners[1]), sourceFor);
    for (const size of ["sm", "md", "lg", "xl"]) for (const context of [false, true]) {
      const props = { open: true, title: "نافذة اختبار", size, onClose() {}, children: React.createElement("button", { type: "button" }, "محتوى"), ...(context ? { description: "وصف", eyebrow: "TEST", footer: React.createElement("button", { type: "button" }, "إغلاق") } : {}) };
      const tree = fixture.runner(fixture.modalModule.default).render(props);
      results.push({ size, context, html: renderToStaticMarkup(fixture.materialize(tree)) });
    }
    return results;
  };
  const original = snapshots(before), current = snapshots(read);
  assert.deepEqual(current, original, "Actual default toolbar/fields/modal SSR output remains exact across standalone/embedded/date/disabled and every modal size");
  const ast = source => ts.createSourceFile("UnifiedContentFilters.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function adapterStructure(source) {
    const tree = ast(source);
    const transformed = ts.transform(tree, [context => {
      const visit = node => {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.every(declaration => declaration.name.getText(tree) === "TOPICS_FILTER_PANEL_PRESENTATION")) return undefined;
        if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "filterPanelPresentation") { assert.ok(ts.isReturnStatement(node.parent.parent)); return undefined; }
        if (ts.isImportDeclaration(node) && ["../ui/AdminDataGrid", "../ui/AdminModuleTabs"].includes(node.moduleSpecifier.text)) return undefined;
        return ts.visitEachChild(node, visit, context);
      };
      return node => ts.visitNode(node, visit);
    }]);
    function structure(node) {
      const children = []; ts.forEachChild(node, child => { children.push(structure(child)); });
      return { kind: node.kind, text: !ts.isSourceFile(node) && typeof node.text === "string" ? node.text : undefined, isTypeOnly: node.isTypeOnly, children };
    }
    try { return JSON.stringify(structure(transformed.transformed[0])); } finally { transformed.dispose(); }
  }
  assert.equal(adapterStructure(topicsAdapter), adapterStructure(before(owners[1])), "Topics definitions, URL/search mapping and callbacks change only by the declared presentation opt-in");
  const receipt = { status: "PASS", capturedAt: new Date().toISOString(), baseline: baselinePath, owners: owners.map(path => ({ path, beforeSha256: baseline.entries.find(entry => entry.path === path).sha256.toLowerCase(), afterSha256: sha(readFileSync(resolve(ROOT, path))) })), exactDefaultSsrCases: current.length, nativeTopicFilterCount: FILTER_IDS.length, topicAdapterContractAstParity: true, boundedHistory: boundedQueryProof, negatives: { transactions: filterMutants.length, composition: compositionMutants.length }, limitations: ["Actual components and callbacks with controlled hooks, local URL transports, native Search/Date render ports and identity portals; effects do not prove browser geometry or modal focus behavior.", "Search suggestions are not fetched. Existing modal accessibility guard and actual root-owned Browser evidence remain separate."] };
  const outputArgument = process.argv.find(argument => argument.startsWith("--output-file="));
  if (outputArgument) writeFileSync(resolve(ROOT, outputArgument.slice("--output-file=".length)), JSON.stringify(receipt, null, 2) + "\n");
  check("Exact baseline preserves18 actual default SSR cases and all Topics domain/query contracts", current.length === 18);
}

if (failures.length) {
  console.error("verify-admin-collection-toolbar-system FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `verify-admin-collection-toolbar-system passed (${assertionCount} assertions).`,
);
