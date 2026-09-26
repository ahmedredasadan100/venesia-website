import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { prepareVercelCacheProbe } from "./lib/vercel-cache-probe.mts";
const root = realpathSync(resolve(".")), out = resolve(root, ".tmp-qa/core-final-closure/probe-guard-tests-" + Date.now());
assert.ok(out.startsWith(resolve(root, ".tmp-qa/core-final-closure") + sep)); mkdirSync(out, { recursive: true });
const source = resolve(root, "scripts/fixtures/vercel-cache-probe");
const baseEnv = { NODE_ENV: "production" as const, VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "codex/audit2-root-cause-closure", VERCEL_GIT_COMMIT_SHA: "a".repeat(40) };
const manifest = JSON.parse(readFileSync(resolve(source, "manifest.json"), "utf8"));
const cases: string[] = [];
const fresh = (name: string) => { const path = resolve(out, name); mkdirSync(resolve(path, "scripts/fixtures"), { recursive: true }); cpSync(source, resolve(path, "scripts/fixtures/vercel-cache-probe"), { recursive: true }); return path; };
try {
  const preview = fresh("preview");
  assert.equal(prepareVercelCacheProbe({ root: preview, env: baseEnv }).generated, true);
  for (const file of ["src/app/verification-cache-probe/page.tsx", "src/app/verification-cache-probe/actions.ts", "src/app/verification-cache-probe/runtime.ts", "src/app/api/verification-cache-probe/route.ts"]) assert.ok(existsSync(resolve(preview,file)));
  cases.push("exact-preview-generates-four-owned-sources");
  for (const [name, patch] of Object.entries({ production: { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production" },
    branch: { VERCEL_GIT_COMMIT_REF: "main" }, missing: { VERCEL: "" }, sha: { VERCEL_GIT_COMMIT_SHA: "bad" } })) {
    prepareVercelCacheProbe({ root: preview, env: baseEnv });
    assert.equal(prepareVercelCacheProbe({ root: preview, env: { ...baseEnv, ...patch } }).generated, false);
    assert.equal(existsSync(resolve(preview, "src/app/verification-cache-probe")), false);
    assert.equal(existsSync(resolve(preview, "src/app/api/verification-cache-probe")), false);
    cases.push(name + "-removes-generated-routes");
  }
  assert.equal(prepareVercelCacheProbe({ root: preview, env: baseEnv, now: manifest.expiresAt + 1 }).generated, false);
  cases.push("expired-build-denied");
  const unowned = fresh("unowned"), ownedPath = resolve(unowned, "src/app/verification-cache-probe");
  mkdirSync(ownedPath, { recursive: true }); writeFileSync(resolve(ownedPath,"page.tsx"), "user code");
  assert.throws(() => prepareVercelCacheProbe({ root: unowned, env: baseEnv }), /non-owned route/);
  assert.equal(readFileSync(resolve(ownedPath,"page.tsx"),"utf8"),"user code"); cases.push("unowned-source-never-overwritten");
  const linked = fresh("symlink"), external = resolve(out, "external");
  mkdirSync(external); mkdirSync(resolve(linked,"src")); symlinkSync(external,resolve(linked,"src/app"),"junction");
  assert.throws(() => prepareVercelCacheProbe({ root: linked, env: baseEnv }), /symlinks/);
  assert.equal(existsSync(resolve(external,"verification-cache-probe")),false); cases.push("symlink-escape-rejected");

  const pair = generateKeyPairSync("ed25519");
  const testManifest = { ...manifest, publicKey: createPublicKey(pair.privateKey).export({format:"pem",type:"spki"}).toString() };
  const template = readFileSync(resolve(source,"runtime.ts.template"),"utf8").replace("__PROBE_MANIFEST__",JSON.stringify(testManifest));
  const compiled = ts.transpileModule(template,{ compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true },reportDiagnostics:true});
  assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const required = createRequire(import.meta.url), exports: Record<string, unknown> = {};
  let ambientCalls = 0, builtinCalls = 0;
  const context = { exports, process:{env:{...baseEnv}, versions: process.versions,
    getBuiltinModule: (name: string): object | undefined => { builtinCalls++; assert.equal(name, "node:sqlite"); return process.getBuiltinModule(name); } }, Buffer, console, setTimeout, clearTimeout,
    require: (name:string) => {
      if(name==="server-only")return {};
      if(name==="next/cache")return { unstable_cache: (callback: () => unknown) => callback };
      if(name==="next/dist/server/app-render/work-async-storage.external")return {workAsyncStorage:{getStore:()=>{ambientCalls++;return undefined;}}};
      assert.ok(["node:assert/strict","node:crypto"].includes(name));return required(name);
    } };
  const sandbox = vm.createContext(context);
  vm.runInContext(compiled.outputText+"\nexports.checkTicket=ticketFor;exports.database=database;exports.reader=reader;",sandbox);
  const check = exports.checkTicket as (raw:string, phases:string[])=>unknown;
  const action = exports.executeAction as (raw:string)=>Promise<{status:string}>;
  const payload={requestId:randomUUID(),run:randomUUID(),phase:"init",scenario:"serial",expiresAt:Date.now()+300_000,sourceHead:baseEnv.VERCEL_GIT_COMMIT_SHA};
  const signed=(value:object)=>{const encoded=Buffer.from(JSON.stringify(value)).toString("base64url");return encoded+"."+sign(null,Buffer.from(encoded),pair.privateKey).toString("base64url");};
  assert.ok(check(signed(payload),["init"]));cases.push("valid-bound-ticket-accepted");
  for(const [name,raw] of [["bad-signature",signed(payload).slice(0,-4)+"AAAA"],["expired",signed({...payload,expiresAt:Date.now()-1})],
    ["wrong-sha",signed({...payload,sourceHead:"b".repeat(40)})],["wrong-phase",signed({...payload,phase:"arbitrary"})],
    ["arbitrary-run",signed({...payload,run:"projects"})],["unbounded-expiry",signed({...payload,expiresAt:Date.now()+3_600_000})]]) {
    assert.equal((await action(raw)).status,"denied");cases.push(name+"-denied-before-adapter");
  }
  context.process.env.VERCEL_ENV="production";assert.equal((await action(signed(payload))).status,"denied");
  cases.push("runtime-production-denied-before-adapter");
  assert.equal(ambientCalls,0); assert.equal(builtinCalls,0);
  const database = exports.database as (revision: "Old" | "New") => Promise<{
    exec(sql: string): void; close(): void; prepare(sql: string): { get(): { revision: string } };
  }>;
  const old = await database("Old"), independent = await database("New");
  const read = (db: Awaited<ReturnType<typeof database>>) => db.prepare("select revision from synthetic_cache_source where id=1").get().revision;
  try {
    assert.equal(read(old),"Old"); cases.push("synthetic-sql-old-read");
    assert.equal(read(independent),"New"); cases.push("synthetic-sql-independent-new-read");
    old.exec("begin; update synthetic_cache_source set revision='New' where id=1; rollback;");
    assert.equal(read(old),"Old"); cases.push("synthetic-sql-rollback-preserves-old");
    old.exec("begin; update synthetic_cache_source set revision='New' where id=1; commit;");
    assert.equal(read(old),"New"); cases.push("synthetic-sql-committed-new-readback");
    // Exercise the installed Flight serializer, including the measured null-prototype failure.
    const serializer: { renderToReadableStream?: (value: unknown, map: object, options: { onError(error: Error): string }) => ReadableStream<Uint8Array> } = {};
    vm.runInNewContext(readFileSync(resolve(root,"node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/react-server-dom-turbopack-server.edge.production.js"),"utf8"), {
      exports: serializer, AbortController, TextEncoder, ReadableStream, Uint8Array, ArrayBuffer, setTimeout, clearTimeout, queueMicrotask,
      require: (name: string) => {
        if(name==="react")return required("next/dist/compiled/react/react.react-server");
        if(name==="react-dom")return required("next/dist/compiled/react-dom");
        throw Error("Unexpected installed serializer dependency.");
      },
    });
    const serialize = async (value: unknown) => {
      const errors: string[] = [];
      const stream = serializer.renderToReadableStream!(value, {}, {onError(error) { errors.push(error.message); return "test-null-prototype"; }});
      return { body: await new Response(stream).text(), errors };
    };
    const raw = old.prepare("select revision from synthetic_cache_source where id=1").get();
    assert.equal(Object.getPrototypeOf(raw),null);
    const rejected = await serialize({value:raw});
    assert.equal(rejected.errors.length,1); assert.match(rejected.errors[0],/null prototypes are not supported/);
    cases.push("installed-flight-rejects-raw-sql-row");
    const reader = exports.reader as (state: Record<string, unknown>, cache: {generateSimpleCacheKey(key: string): Promise<string>}) => Promise<{read(): Promise<{revision: string}>}>;
    const state = { ticket: { run: "isolated-projection-control", scenario: "serial" }, db: old, callbackCount: 0, hold: null, captured: null };
    const projected = await (await reader(state,{generateSimpleCacheKey:async()=>"isolated-projection-control"})).read();
    const accepted = await serialize({value:projected,captured:state.captured});
    assert.equal(projected.revision,"New"); assert.equal(accepted.errors.length,0); assert.ok(accepted.body.includes("New"));
    cases.push("installed-flight-accepts-actual-reader-projection");
  } finally { old.close(); independent.close(); }
  assert.throws(()=>read(old)); cases.push("synthetic-sql-close-rejects-read");
  context.process.getBuiltinModule=()=>undefined;
  await assert.rejects(database("Old"),/built-in SQLite fixture/); cases.push("unsupported-node-sqlite-fails-closed");
  console.log(JSON.stringify({status:"pass",checks:cases.length,cases,ambientCalls,generatedProductionRoutes:0},null,2));
} finally {
  assert.ok(realpathSync(out).startsWith(resolve(root,".tmp-qa/core-final-closure")+sep));
  rmSync(out,{recursive:true,force:true});
}
