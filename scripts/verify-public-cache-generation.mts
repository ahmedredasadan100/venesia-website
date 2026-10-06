import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const serverGlobals = globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage; __incrementalCache?: unknown };
const priorAsyncLocalStorage = serverGlobals.AsyncLocalStorage, priorIncrementalCache = serverGlobals.__incrementalCache;
serverGlobals.AsyncLocalStorage ??= AsyncLocalStorage;
const output = ts.transpileModule(readFileSync(resolve(ROOT, "src/lib/cache/public-cache-generation.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let rpc: () => Promise<{ data: unknown; error: { code: string } | null }> = async () => ({ data: "0", error: null });
const loaded = { exports: {} };
new Function("require", "module", "exports", output)((id: string) => {
  if (id === "server-only") return {};
  if (id === "next/navigation") return { unstable_rethrow: require("next/navigation").unstable_rethrow };
  if (id === "next/cache") return { unstable_cache: (callback: unknown) => callback };
  if (id === "../supabase-admin") return { getSupabaseAdmin: () => ({ rpc: () => ({ then: (yes: (value: Awaited<ReturnType<typeof rpc>>) => unknown, no: (error: unknown) => unknown) => rpc().then(yes, no), throwOnError: () => rpc().then(result => { if (result.error) throw result.error; return result; }) }) }) };
  return require(id);
}, loaded, loaded.exports);
const owner = loaded.exports as typeof import("../src/lib/cache/public-cache-generation.ts");
let checks = 0;
const check = async (label: string, run: () => unknown) => { await run(); checks++; console.log("PASS " + label); };
type Cache = typeof import("next/cache").unstable_cache;
function memoryCache() {
  const entries = new Map<string, unknown>();
  const requests: Array<{ callback: unknown; key: string[]; options: unknown }> = [];
  const cache: Cache = (callback, keyParts, options) => {
    requests.push({ callback, key: keyParts ?? [], options });
    return (async (...args: unknown[]) => {
      const key = JSON.stringify([callback.toString(), keyParts, args]);
      if (entries.has(key)) return entries.get(key);
      const value = await callback(...args); entries.set(key, value); return value;
    }) as typeof callback;
  };
  return { entries, requests, cache };
}
async function verifyInstalledReactRequestFence() {
  const react = require("next/dist/compiled/react/cjs/react.react-server.production.js") as typeof import("react");
  type Flight = { renderToReadableStream(model: unknown, map: object, options: { onError(error: Error): void }): ReadableStream<Uint8Array> };
  const renderer = { exports: {} as Flight };
  new Function("require", "module", "exports", readFileSync(require.resolve("next/dist/compiled/react-server-dom-turbopack/cjs/react-server-dom-turbopack-server.node.production.js"), "utf8"))(
    (id: string) => id === "react" ? react : id === "react-dom" ? require("next/dist/compiled/react-dom") : require(id), renderer, renderer.exports);
  const installedCache = require("next/cache").unstable_cache as Cache;
  for (const mode of ["unpinned-negative", "request-pinned", "request-pinned-missing"] as const) {
    let generation = "0", value = "Old", available = mode !== "request-pinned-missing", generationReads = 0, childReads = 0;
    type Entry = { data: { body: string } };
    const entries = new Map<string, { value: Entry; isStale: boolean }>();
    serverGlobals.__incrementalCache = {
      generateSimpleCacheKey: async (key: string) => key,
      get: async (key: string) => entries.get(key),
      set: async (key: string, entry: Entry) => { entries.set(key, { value: entry, isStale: false }); },
    };
    const model = { exports: {} };
    const rpcResult = async (name: string) => {
      if (name === "advance_public_cache_generation") { generation = String(BigInt(generation) + BigInt(1)); return { data: generation, error: null }; }
      assert.equal(name, "read_public_cache_generation"); generationReads++;
      return available ? { data: generation, error: null } : { data: null, error: { code: "PGRST202" } };
    };
    new Function("require", "module", "exports", output)((id: string) => {
      if (id === "server-only") return {};
      if (id === "react") return react;
      if (id === "next/cache") return { unstable_cache: installedCache };
      if (id === "../supabase-admin") return { getSupabaseAdmin: () => ({ rpc: (name: string) => ({
        then: (yes: (value: Awaited<ReturnType<typeof rpcResult>>) => unknown, no: (error: unknown) => unknown) => rpcResult(name).then(yes, no),
        throwOnError: () => rpcResult(name).then(result => { if (result.error) throw result.error; return result; }),
      }) }) };
      return require(id);
    }, model, model.exports);
    const subject = model.exports as typeof owner;
    const wrap = mode === "unpinned-negative" ? subject.createGenerationFencedCache(subject.readPublicCacheGeneration, installedCache) : subject.cachePublicRead;
    const child = react.cache(wrap(async () => { childReads++; return value; }, ["react-child"], { revalidate: 300 }));
    const outer = wrap(async () => child(), ["react-outer"], { revalidate: 300 });
    let captured!: () => void, release!: () => void;
    const capture = new Promise<void>(resolve => { captured = resolve; }), hold = new Promise<void>(resolve => { release = resolve; });
    let firstChild: string | undefined, firstOuter: string | undefined, subsequent: string | undefined;
    async function First() { firstChild = await child(); captured(); await hold; firstOuter = await outer(); return react.createElement("p", null, firstOuter); }
    const errors: Error[] = [];
    const render = (component: () => Promise<import("react").ReactElement>) => new Response(renderer.exports.renderToReadableStream(react.createElement(component), {}, { onError(error) { errors.push(error); captured(); } })).text();
    const first = render(First); await capture; value = "New"; generation = "1"; available = true; release(); await first;
    assert.equal(firstChild, "Old"); assert.equal(firstOuter, "Old");
    if (mode === "request-pinned-missing") {
      assert.equal(entries.size, 0, "A null generation stays uncached for the whole render, even if availability recovers midway.");
      assert.equal(generationReads, 1);
    }
    async function Second() { subsequent = await outer(); return react.createElement("p", null, subsequent); }
    await render(Second); assert.deepEqual(errors, []);
    assert.equal(subsequent, mode === "unpinned-negative" ? "Old" : "New");
    if (mode !== "unpinned-negative") { assert.equal(generationReads, 2, "Each independent render obtains exactly one generation."); assert.equal(childReads, 2); }
    const outsideBefore = generationReads;
    await subject.advancePublicCacheGeneration(); assert.equal(generation, "2");
    const later = await subject.readPublicCacheGeneration(); assert.ok(later?.endsWith(":2"), "Mutation acknowledgement and later raw reads are not pinned to the completed RSC request.");
    await subject.cachePublicRead(async () => value, ["outside-render"])();
    await subject.cachePublicRead(async () => value, ["outside-render"])();
    assert.equal(generationReads - outsideBefore, 3, "Outside rendering React.cache does not reuse the RSC fence.");
    checks++; console.log("PASS installed React Flight / Next unstable_cache " + mode);
  }
}

const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, priorVercel = process.env.VERCEL;
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co"; delete process.env.VERCEL;
  await check("direct primary and local routing class", () => {
    assert.equal(owner.publicCachePrimaryOrigin(), process.env.NEXT_PUBLIC_SUPABASE_URL);
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) assert.equal(owner.publicCachePrimaryOrigin(`http://${host}:54321`), `http://${host}:54321`);
  });
  for (const bad of ["", "https://abcdefghijklmnopqrst-all.supabase.co", "https://example.com", "https://abcdefghijklmnopqrst.supabase.co/path", "https://abcdefghijklmnopqrst.supabase.co/?x=1", "https://abcdefghijklmnopqrst.supabase.co/#fragment", "https://user:pass@abcdefghijklmnopqrst.supabase.co", "http://abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co:8443"])
    await check("reject unverified origin " + checks, () => assert.throws(() => owner.publicCachePrimaryOrigin(bad), owner.PublicCachePrimaryOriginError));
  await check("Vercel rejects loopback", () => { process.env.VERCEL = "1"; assert.throws(() => owner.publicCachePrimaryOrigin("http://127.0.0.1:54321"), owner.PublicCachePrimaryOriginError); delete process.env.VERCEL; });
  await check("schema112 missing RPC uses direct callback without persistent access", async () => {
    rpc = async () => ({ data: null, error: { code: "PGRST202" } }); const m = memoryCache(); let calls = 0;
    const cached = owner.createGenerationFencedCache(owner.readPublicCacheGeneration, m.cache)(async () => ++calls, ["missing"]);
    assert.equal(await cached(), 1); assert.equal(await cached(), 2); assert.equal(m.requests.length, 0);
  });
  await check("invalid origin never reaches RPC or callback", async () => {
    let called = false; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.com";
    rpc = async () => { called = true; throw Error("must not run"); };
    const cached = owner.createGenerationFencedCache(owner.readPublicCacheGeneration)(async () => { called = true; });
    await assert.rejects(cached, owner.PublicCachePrimaryOriginError); assert.equal(called, false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
  });
  await check("recovery/isolation rejection is not availability fallback", async () => { rpc = async () => ({ data: null, error: { code: "25006" } }); await assert.rejects(owner.readPublicCacheGeneration, owner.PublicCachePrimaryOriginError); });
  await check("transport faults and malformed generations never select a remembered key", async () => {
    rpc = async () => { throw Error("disconnected"); }; assert.equal(await owner.readPublicCacheGeneration(), null);
    for (const data of [0, {}, [], null, "-1", "01", "1.5", "9223372036854775808", "1e3"]) { rpc = async () => ({ data, error: null }); assert.equal(await owner.readPublicCacheGeneration(), null); }
  });
  await check("64-bit decimal generation and separate source namespaces", async () => {
    rpc = async () => ({ data: "9223372036854775807", error: null }); const first = await owner.readPublicCacheGeneration(); assert.match(first!, /^[a-f0-9]{64}:9223372036854775807$/u);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://tsrqponmlkjihgfedcba.supabase.co"; assert.notEqual(await owner.readPublicCacheGeneration(), first); process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
  });
  await check("Next dynamic control errors are rethrown", async () => {
    const control = Object.assign(new Error("dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    rpc = async () => { throw control; }; await assert.rejects(owner.readPublicCacheGeneration, error => error === control);
  });
  await check("advance failure reaches post-commit warning owner", async () => { rpc = async () => ({ data: null, error: { code: "PGRST202" } }); await assert.rejects(owner.advancePublicCacheGeneration, /not acknowledged/u); rpc = async () => ({ data: "8", error: null }); await owner.advancePublicCacheGeneration(); });
  await check("preserve original callback args keys tags TTL and hit", async () => {
    const m = memoryCache(); let calls = 0; const options = { tags: ["original"], revalidate: 300 }; const callback = async (id: number) => { calls++; return { id }; };
    const cached = owner.createGenerationFencedCache(async () => "db:4", m.cache)(callback, ["original"], options);
    assert.deepEqual(await cached(7), { id: 7 }); assert.deepEqual(await cached(7), { id: 7 }); assert.equal(calls, 1);
    assert.equal(m.requests[0].callback, callback); assert.equal(m.requests[0].options, options); assert.deepEqual(m.requests[0].key, ["original", "public-invalidation-generation-v1", "db:4"]); await cached(8); assert.equal(calls, 2);
  });
  await check("independent readers reject late old fill after generation commit", async () => {
    const m = memoryCache(); let generation = "0", value = "Old", calls = 0; let release!: () => void, captured!: () => void;
    const held = new Promise<void>(r => { release = r; }), capture = new Promise<void>(r => { captured = r; });
    const callback = async () => { const read = value; calls++; if (read === "Old") { captured(); await held; } return read; };
    const a = owner.createGenerationFencedCache(async () => generation, m.cache)(callback, ["shared"]), b = owner.createGenerationFencedCache(async () => generation, m.cache)(callback, ["shared"]);
    const old = a(); await capture; value = "New"; generation = "1"; release(); assert.equal(await old, "Old"); assert.equal(await b(), "New"); assert.equal(await b(), "New"); assert.equal(calls, 2);
  });
  await check("no immediate bump preserves max/SWR key policy", async () => {
    const m = memoryCache(); let value = "Old", calls = 0; const cached = owner.createGenerationFencedCache(async () => "0", m.cache)(async () => { calls++; return value; }, ["max"]);
    assert.equal(await cached(), "Old"); value = "New"; assert.equal(await cached(), "Old"); assert.equal(calls, 1);
  });
  await check("outer fallback with healthy inner fence is safe", async () => {
    const m = memoryCache(); let generation = "0", value = "Old";
    const inner = owner.createGenerationFencedCache(async () => generation, m.cache)(async () => value, ["inner"]), outer = owner.createGenerationFencedCache(async () => null, m.cache)(async () => inner(), ["outer"]);
    assert.equal(await outer(), "Old"); value = "New"; generation = "1"; assert.equal(await outer(), "New"); assert.ok(m.requests.every(r => r.key[0] === "inner"));
  });
  await check("all nested failures execute direct without filling keys", async () => {
    const m = memoryCache(); let value = "Old"; const factory = owner.createGenerationFencedCache(async () => null, m.cache), inner = factory(async () => value, ["inner"]), outer = factory(async () => inner(), ["outer"]);
    assert.equal(await outer(), "Old"); value = "New"; assert.equal(await outer(), "New"); assert.equal(m.requests.length, 0);
  });
  await check("failed source read never poisons cache", async () => {
    const m = memoryCache(); let fail = true; const cached = owner.createGenerationFencedCache(async () => "0", m.cache)(async () => { if (fail) throw Error("source failed"); return "New"; }, ["error"]);
    await assert.rejects(cached, /source failed/u); assert.equal(m.entries.size, 0); fail = false; assert.equal(await cached(), "New");
  });
  await check("only immediate owner advances before scheduling; max stays unchanged", async () => {
    const code = ts.transpileModule(readFileSync(resolve(ROOT, "src/lib/cache/revalidate-public-cache-tags.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const events: string[] = []; let fail = false; const cacheModule = { exports: {} };
    new Function("require", "module", "exports", code)((id: string) => {
      if (id === "server-only") return {};
      if (id === "next/cache") return { revalidatePath: () => events.push("path"), updateTag: () => events.push("immediate"), revalidateTag: (_tag: string, profile: unknown) => events.push(profile === "max" ? "max" : "expire0") };
      if (id === "./public-cache-generation") return { advancePublicCacheGeneration: async () => { events.push("bump"); if (fail) throw Error("generation failed"); } };
      throw Error("Unexpected owner dependency: " + id);
    }, cacheModule, cacheModule.exports);
    const invalidation = cacheModule.exports as typeof import("../src/lib/cache/revalidate-public-cache-tags.ts");
    invalidation.revalidateTopicsCache(); invalidation.revalidateGlobalSeoCaches(); invalidation.revalidateNavigationCache();
    assert.ok(events.includes("max")); assert.ok(!events.includes("bump")); events.length = 0;
    for (const operation of [invalidation.revalidateProjectsCache, invalidation.revalidatePageCompositionCache, invalidation.revalidateHeroCache, invalidation.revalidatePageBlocksCache, invalidation.revalidateFeedModulesCache, invalidation.revalidateMediaSidebarCache]) {
      await operation(); assert.equal(events[0], "bump"); assert.ok(events.includes("immediate")); events.length = 0;
    }
    await invalidation.expirePublicCacheTags(["admin-company-config"]); assert.deepEqual(events, ["bump", "expire0"]); events.length = 0;
    fail = true; const outcome = await invalidation.runBoundedPublicCacheRevalidation(invalidation.revalidateProjectsCache);
    assert.equal(outcome.ok, false); assert.equal(outcome.attempts, 2); assert.deepEqual(events, ["bump", "bump"]);
  });
  await verifyInstalledReactRequestFence();
  await check("security revision changes only new metadata classification and provenance", () => {
    const priorSql = readFileSync(resolve(ROOT, "sql/migrations/20260920011000_page_composition_layout_regions.sql"), "utf8").replace(/\r\n?/gu, "\n");
    const nextSql = readFileSync(resolve(ROOT, "sql/migrations/20260926153347_public_cache_invalidation_generation.sql"), "utf8");
    const prior = JSON.parse(priorSql.split("$venisia_security_contract$")[1]);
    const next = JSON.parse(nextSql.split("$venisia_security_contract$")[1]);
    assert.equal(prior.revision, 3); assert.equal(next.revision, 4);
    assert.deepEqual(next.supersedes, { revision: 3, migrationVersion: "20260920011000", migrationSourceSha256: createHash("sha256").update(priorSql).digest("hex") });
    const extra = next.tables.filter((table: { name: string }) => !prior.tables.some((old: { name: string }) => old.name === table.name));
    assert.equal(extra.length, 1); assert.equal(extra[0].name, "public_cache_generation");
    assert.deepEqual(extra[0].grants.PUBLIC, []); assert.deepEqual(extra[0].grants.anon, []); assert.deepEqual(extra[0].grants.authenticated, []); assert.deepEqual(extra[0].grants.service_role, []);
    assert.deepEqual({ ...next, revision: prior.revision, supersedes: prior.supersedes, tables: next.tables.filter((table: { name: string }) => table.name !== "public_cache_generation") }, prior);
  });
  await check("Product source has no unfenced persistent cache import", () => {
    let adopted = 0;
    function walk(path: string) { for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name); if (entry.isDirectory()) { walk(full); continue; } if (!/\.tsx?$/u.test(entry.name) || full.endsWith("public-cache-generation.ts")) continue;
      const parsed = ts.createSourceFile(full, readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "next/cache") {
          const clause = node.importClause?.namedBindings;
          if (clause && ts.isNamedImports(clause)) assert.ok(clause.elements.every(item => (item.propertyName ?? item.name).text !== "unstable_cache"), "Unfenced cache: " + full);
          assert.ok(!clause || !ts.isNamespaceImport(clause), "Namespace bypass: " + full);
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cachePublicRead") adopted++; ts.forEachChild(node, visit);
      } visit(parsed);
    }} walk(resolve(ROOT, "src")); assert.ok(adopted > 0); console.log("ADOPTION persistent readers=" + adopted);
  });
} finally {
  if (priorAsyncLocalStorage === undefined) Reflect.deleteProperty(serverGlobals, "AsyncLocalStorage"); else serverGlobals.AsyncLocalStorage = priorAsyncLocalStorage;
  if (priorIncrementalCache === undefined) delete serverGlobals.__incrementalCache; else serverGlobals.__incrementalCache = priorIncrementalCache;
  if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
  if (priorVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = priorVercel;
}
console.log(`PASS public cache generation: ${checks} controls`);
