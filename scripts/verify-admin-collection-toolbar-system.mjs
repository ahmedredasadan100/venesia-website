import assert from "node:assert/strict";
/**
 * Static and pure-behavior guardrails for the shared Admin Collection
 * Toolbar/Search/Filter System. Live interaction remains Browser QA owned.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let assertionCount = 0;

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(label, condition) {
  assertionCount += 1;
  if (!condition) failures.push(label);
}

function loadPureTypeScriptModule(path) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", output)(commonJsModule.exports, commonJsModule);
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
      'className={toolbar ? "!rounded-t-none !border-t-0" : undefined}',
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


if (failures.length) {
  console.error("verify-admin-collection-toolbar-system FAILED:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `verify-admin-collection-toolbar-system passed (${assertionCount} assertions).`,
);
