import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { classifyVercelCacheProbeRequest, parseVercelCacheProbeFenceMode, parseVercelCacheProbeReadTransport, prepareVercelCacheProbe } from "./lib/vercel-cache-probe.mts";
const root = realpathSync(resolve(".")), out = resolve(root, ".tmp-qa/core-final-closure/probe-guard-tests-" + Date.now());
assert.ok(out.startsWith(resolve(root, ".tmp-qa/core-final-closure") + sep)); mkdirSync(out, { recursive: true });
const source = resolve(root, "scripts/fixtures/vercel-cache-probe");
const baseEnv = { NODE_ENV: "production" as const, VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "codex/audit2-root-cause-closure", VERCEL_GIT_COMMIT_SHA: "a".repeat(40) };
const manifest = JSON.parse(readFileSync(resolve(source, "manifest.json"), "utf8"));
const cases: string[] = [];
const fresh = (name: string) => { const path = resolve(out, name); mkdirSync(resolve(path, "scripts/fixtures"), { recursive: true }); cpSync(source, resolve(path, "scripts/fixtures/vercel-cache-probe"), { recursive: true }); return path; };
try {
  assert.equal(parseVercelCacheProbeFenceMode(["run", "--head", "a".repeat(40)]),false); cases.push("omitted-mode-retains-positive-old-race-baseline");
  assert.equal(parseVercelCacheProbeFenceMode(["run", "--expect-fenced", "--head", "a".repeat(40)]),true); cases.push("explicit-flag-selects-fixed-fence-proof");
  for (const [name,args] of [
    ["duplicate-mode",["--expect-fenced","--expect-fenced"]],
    ["assigned-mode",["--expect-fenced=true"]],
    ["value-mode",["--expect-fenced","false"]],
  ] as const) { assert.throws(() => parseVercelCacheProbeFenceMode(args)); cases.push(name+"-rejected"); }
  assert.equal(parseVercelCacheProbeReadTransport([]),"get"); cases.push("default-transport-preserves-independent-get");
  assert.equal(parseVercelCacheProbeReadTransport(["--read-after-action"]),"action"); cases.push("explicit-independent-action-transport");
  for(const args of [["--read-after-action","--read-after-action"],["--read-after-action=true"],["--read-after-action","get"]]) { assert.throws(()=>parseVercelCacheProbeReadTransport(args)); cases.push("invalid-read-transport-rejected"); }
  const classify = (url: string, method = "GET", resourceType = "script") => classifyVercelCacheProbeRequest({url,method,resourceType},"https://owned.vercel.app");
  assert.equal(classify("https://owned.vercel.app/verification-cache-probe"),"allowed-owned-or-inline"); cases.push("same-deployment-request-allowed");
  assert.equal(classify("https://vercel.live/_next-live/feedback/feedback.js"),"expected-denied-preview-feedback"); cases.push("exact-preview-feedback-script-remains-denied");
  assert.equal(classify("https://vercel.live/_next-live/feedback/feedback.js","GET","fetch"),"expected-denied-preview-feedback"); cases.push("measured-preview-feedback-fetch-remains-denied");
  for (const [name,url,method,type] of [
    ["unexpected-origin","https://example.com/script.js","GET","script"],
    ["feedback-query","https://vercel.live/_next-live/feedback/feedback.js?token=untrusted","GET","script"],
    ["feedback-path","https://vercel.live/_next-live/feedback/other.js","GET","script"],
    ["feedback-post","https://vercel.live/_next-live/feedback/feedback.js","POST","script"],
    ["feedback-xhr","https://vercel.live/_next-live/feedback/feedback.js","GET","xhr"],
    ["feedback-subdomain","https://vercel.live.evil.invalid/_next-live/feedback/feedback.js","GET","script"],
    ["malformed-url","not-a-url","GET","script"],
  ]) { assert.equal(classify(url,method,type),"unexpected-denied-foreign"); cases.push(name+"-denied-and-fails-policy"); }
  const driver = readFileSync(resolve(root,"scripts/qa-vercel-cache-probe.mts"),"utf8");
  assert.match(driver,/timeout: 30_000, maxRedirects: 0/); cases.push("signed-api-get-never-follows-redirects");
  assert.ok(driver.indexOf("await context.close()") >= 0 && driver.indexOf("assert.equal(proof.network.blockedUnexpectedForeignRequests") > driver.indexOf("await context.close()")); cases.push("network-completeness-checked-after-context-closed");
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
  const rawTemplate = readFileSync(resolve(source,"runtime.ts.template"),"utf8").replaceAll("\r\n","\n");
  const sourceHash = createHash("sha256").update(rawTemplate).digest("hex");
  const template = rawTemplate.replace("__PROBE_MANIFEST__",JSON.stringify(testManifest)).replaceAll("__PROBE_SOURCE_SHA256__",sourceHash);
  const compiled = ts.transpileModule(template,{ compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true },reportDiagnostics:true});
  assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const required = createRequire(import.meta.url), exports: Record<string, unknown> = {};
  const fenceExports: Record<string, unknown> = {};
  const fenceSource = readFileSync(resolve(source,"../../../src/lib/cache/public-cache-generation.ts"),"utf8");
  const fenceCompiled = ts.transpileModule(fenceSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(fenceCompiled,{exports:fenceExports,process:{env:{}},URL,BigInt,
    require:(name:string)=>{
      if(name==="server-only")return {};
      if(name==="next/cache")return {unstable_cache:(callback:()=>unknown)=>callback};
      if(name==="next/navigation" || name==="react")return required(name);
      if(name==="../supabase-admin")return {getSupabaseAdmin:()=>{throw Error("Synthetic adapter probe must never access configured Supabase.");}};
      assert.equal(name,"node:crypto");return required(name);
    }});
  let ambientCalls = 0, builtinCalls = 0;
  const context = { exports, process:{env:{...baseEnv}, versions: process.versions,
    getBuiltinModule: (name: string): object | undefined => { builtinCalls++; assert.equal(name, "node:sqlite"); return process.getBuiltinModule(name); } }, Buffer, console, setTimeout, clearTimeout,
    require: (name:string) => {
      if(name==="server-only")return {};
      if(name==="next/cache")return { unstable_cache: (callback: () => unknown) => callback };
      if(name==="../../lib/cache/public-cache-generation")return fenceExports;
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
  context.process.env.VERCEL_ENV="preview";
  const readAfter={...payload,phase:"read-after",worker:randomUUID()};
  assert.equal((await action(signed(readAfter))).status,"inconclusive"); cases.push("valid-independent-action-read-reaches-actual-adapter-guard");
  const executeRead=exports.executeRead as (raw:string)=>Promise<{status:string}>;
  assert.equal((await executeRead(signed(readAfter))).status,"inconclusive"); cases.push("valid-independent-get-read-keeps-adapter-diagnostic");
  await assert.rejects(executeRead("invalid.invalid")); cases.push("invalid-read-ticket-remains-denied-before-diagnostics");
  context.process.env.VERCEL_ENV="production";
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
    type ProbeReader = (state: Record<string, unknown>, cache: {generateSimpleCacheKey(key: string): Promise<string>}) => Promise<{read(): Promise<{revision: string}>;key: string;callbackSha256: string;readerSourceSha256: string}>;
    const reader = exports.reader as ProbeReader;
    const state = { ticket: { run: "isolated-projection-control", scenario: "serial" }, db: old, callbackCount: 0, hold: null, captured: null };
    const keyPort = {generateSimpleCacheKey: async (key: string) => createHash("sha256").update(key).digest("hex")};
    const originalReader = await reader(state,keyPort), projected = await originalReader.read();
    const transformedExports: Record<string, unknown> = {};
    // This models independent bundler identifier rewriting without changing canonical source.
    vm.runInNewContext(compiled.outputText.replace(/\bstate\b/gu,"bundledState")+"\nexports.reader=reader;",{...context,exports:transformedExports});
    const transformedReader = await (transformedExports.reader as ProbeReader)(state,keyPort);
    assert.equal(transformedReader.key,originalReader.key);
    assert.equal(transformedReader.callbackSha256,originalReader.callbackSha256);
    assert.equal(transformedReader.readerSourceSha256,sourceHash);
    cases.push("bound-reader-key-survives-independent-identifier-rewriting");
    const changedExports: Record<string, unknown> = {};
    vm.runInNewContext(compiled.outputText.replaceAll(sourceHash,"0".repeat(64))+"\nexports.reader=reader;",{...context,exports:changedExports});
    const changedReader = await (changedExports.reader as ProbeReader)(state,keyPort);
    assert.notEqual(changedReader.key,originalReader.key); cases.push("different-canonical-source-hash-changes-key");
    const differentRun = await reader({...state,ticket:{...state.ticket,run:"another-isolated-control"}},keyPort);
    assert.notEqual(differentRun.key,originalReader.key); cases.push("different-run-nonce-changes-key");
    old.exec("update synthetic_cache_generation set generation=generation+1 where id=1");
    const advancedReader = await reader(state,keyPort);
    assert.notEqual(advancedReader.key,originalReader.key); cases.push("shared-production-fence-changes-key-after-sql-generation");
    assert.equal(advancedReader.callbackSha256,originalReader.callbackSha256); cases.push("generation-preserves-reader-callback-identity");
    const stableReader = await reader(state,keyPort);
    assert.equal(stableReader.key,advancedReader.key); cases.push("same-sql-generation-preserves-exact-key");
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
