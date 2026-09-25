import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Actual hook and shared QueryProvider; only authenticated action transport is deferred. */
export async function verifyPageAssignmentQueryRuntime(root, out) {
  const { mkdir, writeFile, readFile } = await import("node:fs/promises");
  const { createServer } = await import("node:http");
  const { chromium } = await import("playwright");
  const { createHash } = await import("node:crypto");
  const require = createRequire(import.meta.url);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "entry.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useQueryClient} from '@tanstack/react-query';
import Provider from '@src/components/admin/entity-list/AdminEntityListQueryProvider';
import {usePageBlocksAssignModal} from '@src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-assign-modal';
window.calls=[];
window.catalogMode='deferred';
function Fixture({initialContentTemplates}){
 window.queryClient=useQueryClient();
 const hook=usePageBlocksAssignModal({assignments:[{module_kind:'content',block_type:'content',template_id:501},{module_kind:'hero',block_type:null,template_id:501}],initialContentTemplates,setActionMessage:()=>{}});
 window.fixture=hook;
 return <output>{JSON.stringify({open:hook.assignModalOpen,kind:hook.assignModuleKind,loading:hook.templatesLoading,error:hook.templatesError,options:hook.templateOptions,assignable:hook.assignableTemplates,hero:hook.heroAssignmentExists})}</output>;
}
function App(){
 const [scenario,setScenario]=React.useState({key:0,seed:null});
 window.remountWithSnapshot=seed=>setScenario(previous=>({key:previous.key+1,seed}));
 window.updateSnapshot=seed=>setScenario(previous=>({...previous,seed}));
 return <Fixture key={scenario.key} initialContentTemplates={scenario.seed}/>;
}
createRoot(document.getElementById('root')).render(<Provider><App/></Provider>);
`);
  await writeFile(path.join(out, "actions.ts"), `
export function loadPageModuleTemplateOptions(kind){return new Promise((resolve,reject)=>{
 const call={kind,settled:false,resolve:()=>{call.settled=true;resolve([501,502].map(id=>({id,name:kind+' '+id,slug:kind+'-'+id,status:'published'})))},reject:()=>{call.settled=true;reject(Object.assign(new Error('isolated catalog failure'),{status:400}))}};
 window.calls.push(call);
 if(window.catalogMode==='immediate-error') call.reject();
})}
export const assignPageBlock=async()=>({ok:true});
export const assignHeroModule=assignPageBlock;
export const assignMediaSidebarModule=assignPageBlock;
export const assignMediaHubModule=assignPageBlock;
`);
  await require("next/dist/build/swc").loadBindings();
  const webpack = require("next/dist/compiled/webpack/webpack").webpack;
  const compiler = webpack({
    mode: "development", target: "web", context: root,
    entry: path.join(out, "entry.tsx"), output: { path: out, filename: "fixture.js" }, devtool: false,
    plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("development") })],
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@src": path.join(root, "src"), "../../actions$": path.join(out, "actions.ts") } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{
      loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: {
        rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {},
        swcCacheDir: path.join(out, "swc-cache"), serverComponents: false, serverReferenceHashSalt: "isolated-assignment-query", esm: false, transpilePackages: [],
      },
    }] }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => {
    if (error || closeError || stats?.hasErrors()) reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)));
    else resolve();
  })));
  const bundle = await readFile(path.join(out, "fixture.js"));
  const server = createServer((request, response) => {
    response.setHeader("content-type", request.url === "/fixture.js" ? "application/javascript" : "text/html; charset=utf-8");
    response.end(request.url === "/fixture.js" ? bundle : '<!doctype html><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const assertions = [];
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin);
    await page.waitForFunction(() => Boolean(window.fixture));
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    assertions.push("closed picker performs zero catalog reads");
    const openDispatchCount = await page.evaluate(() => {
      window.fixture.openAssignModal();
      return window.calls.length;
    });
    assert.equal(openDispatchCount, 1, "The existing query begins in the open handler before the modal render");
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.fixture.templatesLoading), true);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    const kindDispatchCount = await page.evaluate(() => {
      window.fixture.setAssignModuleKind("cta");
      return window.calls.length;
    });
    assert.equal(kindDispatchCount, 2, "The new kind's existing query begins before its state change renders");
    await page.waitForFunction(() => window.calls.length === 2);
    await page.evaluate(() => window.calls[1].resolve());
    await page.waitForFunction(() => window.fixture.templateOptions[0]?.name === "cta 501");
    await page.evaluate(() => window.calls[0].resolve());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.fixture.templateOptions[0].name), "cta 501");
    assert.equal(await page.evaluate(() => window.calls.length), 2);
    assertions.push("one request per open/type change; late prior-kind response cannot replace current choices");
    await page.evaluate(() => window.fixture.closeAssignModal());
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(() => window.calls.length === 3);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.calls[2].reject());
    await page.waitForFunction(() => Boolean(window.fixture.templatesError));
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.fixture.retryTemplates());
    await page.waitForFunction(() => window.calls.length === 4);
    await page.evaluate(() => window.calls[3].resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading && !window.fixture.templatesError);
    assertions.push("reopen refreshes cached choices once; failure hides stale choices; explicit retry recovers");
    const kinds = ["content", "cards", "breadcrumb", "feed", "featured", "hero", "media-sidebar", "media-hub"];
    for (const kind of kinds) {
      const count = await page.evaluate(() => window.calls.length);
      await page.evaluate(value => window.fixture.setAssignModuleKind(value), kind);
      await page.waitForFunction(n => window.calls.length === n + 1, count);
      assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
      await page.evaluate(() => window.calls.at(-1).resolve());
      await page.waitForFunction(() => !window.fixture.templatesLoading);
      assert.equal(await page.evaluate(() => window.fixture.templateOptions[0]?.name), `${kind} 501`);
      const expected = kind === "hero" ? [] : kind === "content" ? [502] : [501, 502];
      assert.deepEqual(await page.evaluate(() => window.fixture.assignableTemplates.map(row => row.id)), expected);
      await page.evaluate(value => window.fixture.setAssignModuleKind(value), kind);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.equal(await page.evaluate(() => window.calls.length), count + 1);
    }
    assertions.push("all nine kinds preserve correct summaries, Content exclusion, existing-Hero rule and same-kind no-op");
    for (const kind of ["media-sidebar", "media-hub"]) {
      await page.evaluate(value => window.fixture.setAssignModuleKind(value), kind);
      await page.waitForFunction(() => window.fixture.templatesLoading);
      await page.evaluate(() => window.calls.at(-1).resolve());
      await page.waitForFunction(() => !window.fixture.templatesLoading);
      const count = await page.evaluate(() => window.calls.length);
      await page.evaluate(value => { void window.queryClient.invalidateQueries({ queryKey: ['admin-entity-list', value + '-block-templates'] }); }, kind);
      await page.waitForFunction(n => window.calls.length === n + 1, count);
      assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
      await page.evaluate(() => window.calls.at(-1).resolve());
      await page.waitForFunction(() => !window.fixture.templatesLoading);
    }
    assertions.push("both Media catalogs share their existing manager entity invalidation namespace");
    await page.evaluate(() => window.fixture.closeAssignModal());
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    const pendingStart = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n + 1, pendingStart);
    await page.evaluate(() => window.fixture.closeAssignModal());
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n + 2, pendingStart);
    await page.evaluate(n => window.calls[n].resolve(), pendingStart);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.fixture.templatesLoading), true);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.calls.at(-1).resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading);
    assertions.push("closing and reopening an in-flight request starts a fresh activation and ignores its old late response");
    await page.evaluate(() => window.fixture.closeAssignModal());
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    const beforeFastFailure = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => {
      window.catalogMode = "immediate-error";
      window.fixture.openAssignModal();
    });
    await page.waitForFunction(() => Boolean(window.fixture.templatesError));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.calls.length), beforeFastFailure + 1, "An immediate terminal error is not duplicated when the observer enables");
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    const beforeFailedKind = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => window.fixture.setAssignModuleKind("breadcrumb"));
    await page.waitForFunction(() => window.fixture.assignModuleKind === "breadcrumb" && Boolean(window.fixture.templatesError));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.calls.length), beforeFailedKind + 1, "An immediate error on a type switch does not start an implicit second request");
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => { window.catalogMode = "deferred"; window.fixture.retryTemplates(); });
    await page.waitForFunction(n => window.calls.length === n + 2, beforeFailedKind);
    await page.evaluate(() => window.calls.at(-1).resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading && !window.fixture.templatesError);
    assertions.push("open/type dispatch precedes rendering; observer reuse and immediate failure preserve one request per activation");
    const contentKey = ["admin-entity-list", "content-block-templates", "assignment-options", "content"];
    const seed = [501, 502].map(id => ({ id, name: `content ${id}`, slug: `content-${id}`, status: "published" }));
    await page.evaluate(key => window.queryClient.removeQueries({ queryKey:key, exact:true }), contentKey);
    await page.evaluate(value => window.remountWithSnapshot(value), seed);
    await page.waitForFunction(() => !window.fixture.assignModalOpen && window.fixture.assignModuleKind === "content" && window.fixture.templateOptions.length === 2);
    const seededCount = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(() => window.fixture.assignModalOpen && !window.fixture.templatesLoading);
    assert.equal(await page.evaluate(() => window.calls.length), seededCount, "Fresh Page default summaries require no additional action");
    assert.deepEqual(await page.evaluate(() => window.fixture.assignableTemplates.map(row => row.id)), [502]);
    await page.evaluate(() => window.fixture.closeAssignModal());
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n+1, seededCount);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.calls.at(-1).resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading);
    assertions.push("Page default summary serves only first Content activation; reopen refreshes and hides stale data");
    const beforeRevisitUpdatedAt = await page.evaluate(key => window.queryClient.getQueryState(key).dataUpdatedAt, contentKey);
    await page.evaluate(value => window.remountWithSnapshot(value), seed);
    await page.waitForFunction(() => !window.fixture.assignModalOpen && window.fixture.templateOptions.length === 2);
    assert.equal(await page.evaluate(key => window.queryClient.getQueryState(key).dataUpdatedAt, contentKey), beforeRevisitUpdatedAt, "Equal Page props do not reset canonical query freshness");
    const matchingCount = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(() => window.fixture.assignModalOpen && !window.fixture.templatesLoading);
    assert.equal(await page.evaluate(() => window.calls.length), matchingCount, "Identical settled cache is reused on Page revisit without resetting its freshness");
    await page.evaluate(value => window.remountWithSnapshot(value), seed);
    await page.waitForFunction(() => !window.fixture.assignModalOpen && window.fixture.templateOptions.length === 2);
    await page.evaluate(() => { void window.queryClient.invalidateQueries({queryKey:['admin-entity-list','content-block-templates']}); });
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n+1, matchingCount);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.calls.at(-1).resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading);
    assertions.push("Canonical prefix invalidation between mount and first open rejects the Page seed");
    const conflictingSeed = [{ id:601, name:"Older RSC", slug:"older-rsc", status:"unpublished" }];
    await page.evaluate(value => window.remountWithSnapshot(value), conflictingSeed);
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    assert.deepEqual(await page.evaluate(key => window.queryClient.getQueryData(key).map(row=>row.id), contentKey), [501,502], "A different Page snapshot never overwrites canonical cache data");
    const conflictingCount = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n+1, conflictingCount);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(value => window.remountWithSnapshot(value), seed);
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n+2, conflictingCount);
    await page.evaluate(n => window.calls[n].resolve(), conflictingCount);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.fixture.templatesLoading), true);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.calls.at(-1).resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading);
    assertions.push("Conflicting or pending cache is never overwritten by new Page props; remount cancels the old activation before fresh read");
    await page.evaluate(({key,seed}) => window.queryClient.setQueryData(key,seed,{updatedAt:1}), {key:contentKey,seed});
    await page.evaluate(value => window.remountWithSnapshot(value), seed);
    await page.waitForFunction(() => !window.fixture.assignModalOpen);
    const staleCount = await page.evaluate(() => window.calls.length);
    await page.evaluate(() => window.fixture.openAssignModal());
    await page.waitForFunction(n => window.calls.length === n+1, staleCount);
    assert.deepEqual(await page.evaluate(() => window.fixture.templateOptions), []);
    await page.evaluate(() => window.calls.at(-1).resolve());
    await page.waitForFunction(() => !window.fixture.templatesLoading);
    assertions.push("Matching expired cache still obeys the existing QueryClient freshness policy; no TTL reset or stale-ready result");
    assert.deepEqual(errors, []);
    const files = ["src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-assign-modal.ts", "src/components/admin/entity-list/AdminEntityListQueryProvider.tsx", "src/lib/admin/entity-list/data-engine/query-keys.ts"];
    const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await readFile(path.join(root, file))).digest("hex")])));
    const result = { status: "pass", assertions, sourceHashes: hashes, scope: "Actual mounted hook/shared QueryProvider; deferred action transport only. No DB or authenticated production proof." };
    await writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

/** Current read/revalidation owners; isolated transport and cache only. No DB/Auth/UI proof. */
export function createPageBlockPerformanceHarness(root, { delayMs = 0, fixtureRows = {} } = {}) {
  const nativeRequire = createRequire(import.meta.url);
  const files = new Set();
  const state = { reads: [], cache: [], events: [], failTable: "", failTables: [], errorMessages: {}, publicFailure: false };
  const wait = () => delayMs ? new Promise(resolve => setTimeout(resolve, delayMs)) : Promise.resolve();
  const layout = {
    id: 1,
    key: "venisia-legacy",
    admin_label: "Venesia Legacy",
    page_composition_regions: [
      { key: "hero", admin_label: "Hero", sort_order: 0 },
      { key: "main", admin_label: "Main", sort_order: 10 },
      { key: "sidebar", admin_label: "Sidebar", sort_order: 20 },
      { key: "footer", admin_label: "Footer", sort_order: 30 },
    ],
  };
  const pages = [
    { id: 1, title: "Home", path: "/", slug: "home", layout_id: layout.id, page_composition_layouts: layout },
    { id: 2, title: "Detached", path: "/detached-custom", slug: "detached-custom", layout_id: layout.id, page_composition_layouts: layout },
    { id: 3, title: "Assigned", path: "/assigned-custom", slug: "assigned-custom", layout_id: layout.id, page_composition_layouts: layout },
  ];
  const template = { id: 501, name: "Template", slug: "sample", status: "published", variant: "default", config: { text: "Authored copy ".repeat(200) }, feed_type: "latest", widget_key: "sections", section_key: "featured" };
  const rows = {
    pages,
    topic_categories: [
      { id: 1, name: "Root", slug: "root", parent_id: null, sort_order: 0, status: "published", is_active: true, deleted_at: null },
      { id: 2, name: "Child", slug: "child", parent_id: 1, sort_order: 1, status: "published", is_active: true, deleted_at: null },
      { id: 3, name: "Hidden", slug: "hidden", parent_id: null, sort_order: 2, status: "unpublished", is_active: true, deleted_at: null },
    ],
    topic_series: [{ id: 9, name: "Child series", slug: "child-series", category_id: 2, status: "published", deleted_at: null }],
    ...fixtureRows,
  };
  function splitSelectFields(fields) {
    const result = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < fields.length; index += 1) {
      if (fields[index] === "(") depth += 1;
      if (fields[index] === ")") depth -= 1;
      if (fields[index] === "," && depth === 0) {
        result.push(fields.slice(start, index));
        start = index + 1;
      }
    }
    result.push(fields.slice(start));
    return result;
  }
  function projectRow(row, fields) {
    if (fields === "*") return structuredClone(row);
    return Object.fromEntries(splitSelectFields(fields).map(field => {
      const hintedRelation = /^([a-z_]+)![^(]+\((.*)\)$/.exec(field);
      if (hintedRelation) {
        const related = row[hintedRelation[1]];
        return [hintedRelation[1], related ? projectRow(related, hintedRelation[2]) : null];
      }
      const relation = /^([a-z_]+)\(([^()]+)\)$/.exec(field);
      if (!relation) return [field, structuredClone(row[field])];
      const embedded = row[relation[1]];
      if (embedded) {
        return [relation[1], Array.isArray(embedded)
          ? embedded.map(item => projectRow(item, relation[2]))
          : projectRow(embedded, relation[2])];
      }
      const relatedRows = rows[relation[1]] ?? [template];
      const related = relatedRows.find(candidate => candidate.id === (row.template_id ?? row.hero_id));
      return [relation[1], related ? projectRow(related, relation[2]) : null];
    }));
  }
  function from(table) {
    assert.ok(table in rows || /(?:_assignments|_templates)$/.test(table), `Unexpected transport table ${table}`);
    let selected = rows[table] ?? (table.endsWith("_templates") ? [template] : table === "page_content_block_assignments" ? [
      { id: 101, page_id: 1, template_id: 501, slot: "main", sort_order: 0, is_visible: true, updated_at: "2026-09-17" },
      { id: 103, page_id: 3, template_id: 501, slot: "main", sort_order: 0, is_visible: true, updated_at: "2026-09-17" },
    ] : []);
    let fields = "*", single = false;
    const query = {
      select(value) { fields = value; return query; }, order() { return query; },
      eq(key, value) { selected = selected.filter(row => row[key] === value); return query; },
      is(key, value) { selected = selected.filter(row => (row[key] ?? null) === value); return query; },
      in(key, values) { selected = selected.filter(row => values.includes(row[key])); return query; },
      not(key, operator, value) { assert.equal(operator, "is"); selected = selected.filter(row => (row[key] ?? null) !== value); return query; },
      maybeSingle() { single = true; return query; },
      single() { single = true; return query; },
      then(resolve, reject) {
        const read = { table, fields, responseBytes: 0 };
        state.reads.push(read); state.events.push(`start:${table}`);
        return wait().then(() => {
          state.events.push(`end:${table}`);
          if (state.failTable === table || state.failTables.includes(table)) return { data: null, error: { message: state.errorMessages[table] ?? "isolated_read_failure" } };
          const result = selected.map(row => projectRow(row, fields));
          const data = single ? result[0] ?? null : result;
          read.responseBytes = Buffer.byteLength(JSON.stringify(data));
          return { data, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  }
  const record = kind => (...args) => state.cache.push({ kind, args });
  const ports = new Map([
    ["server-only", {}],
    ["next/cache", { revalidatePath: record("path"), revalidateTag: record("tag"), updateTag: record("update") }],
    ["src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from }) }],
    ["src/lib/logging", { logError() {} }],
    ["src/lib/content/public-content-read/owner", { async loadPublicContentCollection(query) {
      state.reads.push({ table: "public-content", fields: query }); state.events.push(`start:public:${query.contentTypes[0]}:${query.page}`);
      await wait(); state.events.push(`end:public:${query.contentTypes[0]}:${query.page}`);
      if (state.publicFailure) throw new Error("isolated_public_failure");
      return { totalPages: 2, items: [{ id: query.page, contentType: query.contentTypes[0], title: "Published item", categorySlug: "child", publishedAt: "2026-09-17" }] };
    } }],
  ]);
  const modules = new Map();
  function load(relativeFile) {
    const file = path.resolve(root, relativeFile);
    if (modules.has(file)) return modules.get(file).exports;
    assert.ok(file.startsWith(path.resolve(root, "src") + path.sep), "Only source owners can load");
    files.add(path.relative(root, file).replaceAll("\\", "/"));
    const mod = { exports: {} }; modules.set(file, mod);
    const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const require = specifier => {
      if (ports.has(specifier)) return ports.get(specifier);
      if (!specifier.startsWith(".")) {
        assert.ok(["react", "zod"].includes(specifier), `Undeclared package ${specifier}`);
        return nativeRequire(specifier);
      }
      const base = path.resolve(path.dirname(file), specifier);
      const relative = path.relative(root, base).replaceAll("\\", "/");
      if (ports.has(relative)) return ports.get(relative);
      const target = [base, base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(target, `Unresolved ${specifier}`);
      return load(target);
    };
    new Function("require", "module", "exports", output)(require, mod, mod.exports);
    return mod.exports;
  }
  return {
    files, state,
    registry: load("src/lib/page-blocks/block-module-registry.ts"),
    revalidation: load("src/lib/page-blocks/admin-revalidate.ts"),
    assignment: load("src/lib/page-blocks/admin-queries.ts"),
    references: load("src/lib/feed-modules/load-topic-filter-options.ts"),
    featured: load("src/lib/featured-modules/load-editor-options.ts"),
    reset() { state.reads.length = 0; state.cache.length = 0; state.events.length = 0; state.failTable = ""; state.failTables.length = 0; state.errorMessages = {}; state.publicFailure = false; },
  };
}

export function createPageCompositionProjectionFixture() {
  const kinds = ["content", "cta", "cards", "breadcrumb", "feed", "featured", "hero", "media_sidebar", "media_hub"];
  const rows = {};
  kinds.forEach((kind, kindIndex) => {
    const templateTable = kind === "hero" ? "hero_templates" : `${kind}_${["content", "cta", "cards", "breadcrumb"].includes(kind) ? "block" : "module"}_templates`;
    const assignmentTable = kind === "hero" ? "hero_assignments" : `page_${kind}_${["content", "cta", "cards", "breadcrumb"].includes(kind) ? "block" : "module"}_assignments`;
    rows[templateTable] = Array.from({ length: 9 }, (_, index) => ({
      id: index + 501, name: `${kind} ${index}`, slug: `qa-${kind}-${index}`, status: "published", variant: "default",
      feed_type: "latest", widget_key: "sections", section_key: "featured",
      config: { title: `Saved ${kind}`, text: index === 0 ? `Assigned ${kind} copy` : "Unused authored catalog content. ".repeat(512), presentation: { variant: "split" } },
    }));
    rows[assignmentTable] = [{ id: kindIndex + 1, page_id: 1, template_id: 501, hero_id: 501, target_type: "page", target_id: 1, priority: 1000, slot: "main", sort_order: kindIndex * 10, is_visible: true, is_active: true, updated_at: "2026-09-17" }];
  });
  return rows;
}

export async function verifyPageBlockReadAndRevalidationContract(root) {
  const h = createPageBlockPerformanceHarness(root);
  const canonicalCalls = calls => [...new Set(calls.map(call => JSON.stringify(call)))].sort();
  const moduleKinds = [...Object.keys(h.registry.BLOCK_MODULE_REGISTRY), "media-hub", "media-sidebar"];
  for (const moduleKind of moduleKinds) {
    // Compare the prior composed operations with the batch through the actual
    // current owner. The individual page command remains supported separately.
    h.reset();
    await Promise.all([2, 3].map(h.revalidation.revalidatePageBlocksPath));
    await h.revalidation.revalidateBlockModulePaths(moduleKind);
    const previousCoverage = canonicalCalls(h.state.cache);
    const priorReadCount = h.state.reads.length;
    h.reset();
    await h.revalidation.revalidateBlockModulePaths(moduleKind, [2, 3, 3]);
    assert.deepEqual(canonicalCalls(h.state.cache), previousCoverage, `${moduleKind}: exact path/tag/update coverage, including detached pages`);
    assert.equal(h.state.reads.length, priorReadCount - 2, "Affected pages must join the existing batch read");
    assert.equal(h.state.reads.filter(row => row.table === "pages").length, 1, "One page-path read across assignments and affected pages");
    assert.equal(h.state.cache.filter(call => call.kind === "path" && call.args[0] === "/admin/pages-blocks/pages/3").length, 1, "Duplicate affected IDs must not repeat invalidation");
    assert.ok(h.state.cache.some(call => call.kind === "path" && call.args[0] === "/detached-custom"));
    const action = readFileSync(path.join(root, `src/app/admin/pages-blocks/blocks/${moduleKind}/actions.ts`), "utf8");
    assert.ok(action.includes(`revalidateBlockModulePaths("${moduleKind}", coordinated.value.affectedPageIds)`), `${moduleKind}: adopt shared batch`);
    assert.ok(!action.includes("affectedPageIds.map(revalidatePageBlocksPath)"), `${moduleKind}: reject duplicate per-page save reload`);

    h.reset(); h.state.failTable = h.registry.ALL_ASSIGNMENT_TABLES[0];
    await Promise.all([2, 3].map(h.revalidation.revalidatePageBlocksPath));
    await assert.rejects(() => h.revalidation.revalidateBlockModulePaths(moduleKind), /isolated_read_failure/);
    const previousFailureCoverage = canonicalCalls(h.state.cache);
    h.reset(); h.state.failTable = h.registry.ALL_ASSIGNMENT_TABLES[0];
    await assert.rejects(() => h.revalidation.revalidateBlockModulePaths(moduleKind, [2, 3, 3]), /isolated_read_failure/);
    assert.deepEqual(canonicalCalls(h.state.cache), previousFailureCoverage, `${moduleKind}: unrelated read failure retains known affected literal/SEO paths`);
    assert.equal(h.state.reads.filter(row => row.table === "pages").length, 1, "Failure fallback reads affected pages in one deduplicated batch");
  }
  h.reset(); h.state.failTable = h.registry.ALL_ASSIGNMENT_TABLES[0];
  await assert.rejects(() => h.revalidation.revalidateBlockModulePaths("content", [2]), /isolated_read_failure/);
  h.reset(); h.state.failTable = "pages";
  await assert.rejects(() => h.revalidation.revalidateBlockModulePaths("content", [2]), /isolated_read_failure/);
  h.reset(); h.state.failTables.push(h.registry.ALL_ASSIGNMENT_TABLES[0], "pages");
  await assert.rejects(() => h.revalidation.revalidateBlockModulePaths("content", [2]), error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 2, "Both the broad lookup and fallback failures remain observable");
    assert.equal(error.cause, error.errors[0], "The original failure remains the primary cause");
    assert.match(error.errors[0].message, /Assignment path read failed/);
    assert.match(error.errors[1].message, /Assigned page path read failed/);
    return true;
  });
  h.reset();
  const composition = await h.assignment.getPageModuleAssignmentsForAdmin(1);
  assert.equal(composition.assignments.length, 1);
  assert.ok(composition.seoContent.includes("Authored copy"), "Saved visible SEO text still comes from full server config");
  for (const kind of ["content", "cta", "cards", "breadcrumb", "feed", "featured", "hero", "media-sidebar", "media-hub"]) {
    h.reset();
    const templates = await h.assignment.getPageModuleTemplateOptionsForAdmin(kind);
    assert.equal(h.state.reads.length, 1, "Only the requested catalog is read");
    assert.equal(h.state.reads[0].fields, "id,name,slug,status");
    assert.ok(templates.length > 0, "Fixture covers every template kind");
    for (const template of templates) assert.deepEqual(Object.keys(template).sort(), ["id", "name", "slug", "status"], "Picker payload must only carry declared summary fields");
    h.state.failTable = h.state.reads[0].table;
    await assert.rejects(() => h.assignment.getPageModuleTemplateOptionsForAdmin(kind), error => error.message === "Page Composition template read failed: isolated_read_failure");
  }
  h.reset(); h.state.failTable = "page_breadcrumb_block_assignments";
  await assert.rejects(() => h.assignment.getPageModuleAssignmentsForAdmin(1), /isolated_read_failure/);
  const projectionRows = createPageCompositionProjectionFixture();
  const projection = createPageBlockPerformanceHarness(root, { fixtureRows: projectionRows });
  const page = await projection.assignment.getPageModuleAssignmentsForAdmin(1);
  const projectionReads = structuredClone(projection.state.reads);
  assert.equal(page.assignments.length, 9, "Every assigned module kind remains present");
  assert.equal(page.assignments.find(row => row.module_kind === "featured").template_variant, "split");
  for (const kind of ["hero", "content", "cta", "cards", "breadcrumb"]) {
    assert.ok(page.seoContent.includes(`Assigned ${kind} copy`), "Assigned authored config feeds SEO");
  }
  assert.ok(!page.seoContent.includes("Unused authored"));
  assert.equal(projectionReads.length, 11, "Nine assigned metadata reads plus the default Content summary and canonical Layout read run in the initial owner");
  assert.equal(projectionReads.filter(read => read.fields.includes(",config)")).length, 9, "Every assigned module reads only its joined saved config");
  assert.equal(projectionReads.filter(read => read.table.endsWith("_assignments")).length, 9);
  assert.deepEqual(projectionReads.filter(read => !read.table.endsWith("_assignments")).map(read => ({table:read.table,fields:read.fields})), [
    {table:"content_block_templates",fields:"id,name,slug,status"},
    {table:"pages",fields:"layout_id,page_composition_layouts!pages_layout_id_fkey(id,key,admin_label,page_composition_regions(key,admin_label,sort_order))"},
  ], "Other eight catalogs remain on demand while the Page Composition owner reads the canonical Layout once");
  assert.equal(page.initialContentTemplates.length, 9);
  for (const row of page.initialContentTemplates) assert.deepEqual(Object.keys(row).sort(), ["id", "name", "slug", "status"]);
  for (const assignment of page.assignments) {
    const kind = assignment.module_kind.replaceAll("-", "_");
    assert.equal(assignment.template_name, `${kind} 0`);
    assert.equal(assignment.template_slug, `qa-${kind}-0`);
    assert.equal(assignment.template_status, "published");
    assert.equal(assignment.template_id, 501);
    assert.equal(assignment.is_publicly_visible, true);
  }
  const payloadBytes = projectionReads.reduce((sum, read) => sum + read.responseBytes, 0);
  for (const [table, rows] of Object.entries(projectionRows)) {
    if (table.endsWith("_templates")) for (const row of rows.slice(1)) row.config.text = "Unrelated large draft. ".repeat(4096);
  }
  projection.reset();
  assert.deepEqual(await projection.assignment.getPageModuleAssignmentsForAdmin(1), page, "Unassigned config changes cannot affect current page output");
  assert.equal(projection.state.reads.reduce((sum, read) => sum + read.responseBytes, 0), payloadBytes, "Unassigned config growth must not increase transport bytes");
  projection.reset(); projection.state.failTable = "content_block_templates";
  const optionalFailure = await projection.assignment.getPageModuleAssignmentsForAdmin(1);
  assert.equal(optionalFailure.initialContentTemplates, null, "Failed optional default options do not block the Page");
  assert.deepEqual(optionalFailure.assignments, page.assignments);
  assert.equal(optionalFailure.seoContent, page.seoContent);
  for (const { table } of projectionReads.filter(read => read.table.endsWith("_assignments"))) {
    projection.reset(); projection.state.failTable = table; projection.state.errorMessages[table] = `failed:${table}`;
    await assert.rejects(() => projection.assignment.getPageModuleAssignmentsForAdmin(1), error => error.message === `Page Composition assignment read failed: failed:${table}`);
  }
  const assignmentReads = projectionReads.filter(read => read.table.endsWith("_assignments"));
  projection.reset(); projection.state.failTables = assignmentReads.map(read => read.table);
  projection.state.errorMessages = Object.fromEntries(assignmentReads.map(read => [read.table, `failed:${read.table}`]));
  await assert.rejects(() => projection.assignment.getPageModuleAssignmentsForAdmin(1), error => error.message === `Page Composition assignment read failed: failed:${projectionReads[0].table}`);
  projection.reset(); projection.state.failTable = "pages";
  await assert.rejects(() => projection.assignment.getPageModuleAssignmentsForAdmin(1), /Page Composition Layout read failed: isolated_read_failure/);
  const retiredRows = createPageCompositionProjectionFixture();
  retiredRows.content_block_templates[0].slug = "project-details-presentation";
  const retiredOwner = createPageBlockPerformanceHarness(root, { fixtureRows: retiredRows }).assignment;
  const retired = await retiredOwner.getPageModuleAssignmentsForAdmin(1);
  assert.equal(retired.assignments.length, 8);
  assert.ok(!retired.seoContent.includes("Assigned content copy"));
  assert.equal((await retiredOwner.getPageModuleTemplateOptionsForAdmin("content")).length, 8, "Retired content stays absent from the picker");
  const missingRows = createPageCompositionProjectionFixture();
  for (const table of Object.keys(missingRows).filter(table => table.endsWith("_templates"))) missingRows[table] = [];
  const missingOwner = createPageBlockPerformanceHarness(root, { fixtureRows: missingRows }).assignment;
  const missing = await missingOwner.getPageModuleAssignmentsForAdmin(1);
  assert.equal(missing.assignments.length, 7, "Missing Hero/Content templates stay omitted; other kinds retain assignment fallback");
  assert.equal(missing.seoContent, "");
  assert.ok(missing.assignments.every(row => row.template_name === "—" && row.template_status === "unpublished" && !row.is_publicly_visible));
  assert.deepEqual(await missingOwner.getPageModuleTemplateOptionsForAdmin("content"), [], "A successful empty catalog remains distinguishable from failure");
  const hiddenRows = createPageCompositionProjectionFixture();
  hiddenRows.content_block_templates[0].status = "unpublished";
  hiddenRows.hero_assignments[0].is_active = false;
  const hidden = await createPageBlockPerformanceHarness(root, { fixtureRows: hiddenRows }).assignment.getPageModuleAssignmentsForAdmin(1);
  assert.equal(hidden.assignments.length, 9);
  assert.ok(!hidden.seoContent.includes("Assigned content copy") && !hidden.seoContent.includes("Assigned hero copy"), "Joined metadata retains publication and assignment visibility truth");
  return { moduleKinds: moduleKinds.length, sourceFiles: [...h.files] };
}

export async function verifyFeaturedReferenceReadContract(root) {
  const h = createPageBlockPerformanceHarness(root);
  const full = await h.references.loadTopicFilterOptionsForAdmin();
  assert.deepEqual(full.categories.map(row => row.slug), ["root", "child"]);
  assert.equal(full.seriesByCategorySlug.root[0].slug, "child-series", "Default Feed series inheritance stays available");
  h.reset();
  const categoriesOnly = await h.references.loadTopicFilterOptionsForAdmin({ includeSeries: false });
  assert.deepEqual(categoriesOnly.categories, full.categories, "Category projection preserves topology/order/published filter");
  assert.deepEqual(categoriesOnly.series, []);
  assert.deepEqual(categoriesOnly.seriesByCategorySlug, {});
  assert.equal(h.state.reads.length, 1);
  assert.equal(h.state.reads[0].table, "topic_categories");
  h.reset();
  const options = await h.featured.loadFeaturedEditorOptions();
  assert.deepEqual(options.categories[0].scopeSlugs, ["root", "child"]);
  assert.ok(options.items.length > 0);
  const itemTypes = [...new Set(options.items.map(item => item.contentType))];
  assert.equal(options.items.length, itemTypes.length * 2, "All canonical content types and pages remain available");
  assert.equal(h.state.reads.filter(row => row.table === "topic_series").length, 0, "Featured does not consume series");
  const firstReferenceEnd = h.state.events.indexOf("end:topic_categories");
  assert.ok(firstReferenceEnd >= 0);
  for (const type of itemTypes) assert.ok(h.state.events.indexOf(`start:public:${type}:1`) < firstReferenceEnd, "Independent public content reads must start before references finish");
  for (const file of [
    "src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx",
    "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
    "src/app/admin/pages-blocks/blocks/content/actions.ts",
    "src/app/admin/pages-blocks/blocks/featured/actions.ts",
  ]) assert.ok(readFileSync(path.join(root, file), "utf8").includes("loadTopicFilterOptionsForAdmin({ includeSeries: false })"), `${file}: category-only adoption`);
  h.reset(); h.state.publicFailure = true;
  await assert.rejects(() => h.featured.loadFeaturedEditorOptions(), /isolated_public_failure/);
  h.reset(); h.state.failTable = "topic_categories";
  const failedCategories = await h.references.loadTopicFilterOptionsForAdmin({ includeSeries: false });
  assert.deepEqual(failedCategories.categories, [], "Existing logged category failure fallback is retained");
  return { itemTypes: itemTypes.length, sourceFiles: [...h.files] };
}
