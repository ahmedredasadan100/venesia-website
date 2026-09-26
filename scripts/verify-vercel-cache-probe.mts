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
  let ambientCalls = 0;
  const context = { exports, process:{env:{...baseEnv}}, Buffer, console, setTimeout, clearTimeout,
    require: (name:string) => {
      if(name==="server-only")return {};
      if(name==="@electric-sql/pglite")return {PGlite:class{constructor(){throw Error("Unexpected DB creation in a guard control.");}}};
      if(name==="next/cache")return {};
      if(name==="next/dist/server/app-render/work-async-storage.external")return {workAsyncStorage:{getStore:()=>{ambientCalls++;return undefined;}}};
      assert.ok(["node:assert/strict","node:crypto"].includes(name));return required(name);
    } };
  const sandbox = vm.createContext(context);
  vm.runInContext(compiled.outputText+"\nexports.checkTicket=ticketFor;",sandbox);
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
  assert.equal(ambientCalls,0);
  console.log(JSON.stringify({status:"pass",checks:cases.length,cases,ambientCalls,generatedProductionRoutes:0},null,2));
} finally {
  assert.ok(realpathSync(out).startsWith(resolve(root,".tmp-qa/core-final-closure")+sep));
  rmSync(out,{recursive:true,force:true});
}
