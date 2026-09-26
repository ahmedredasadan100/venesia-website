import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { chromium, expect } from "playwright/test";
import { captureCommittedCreateReplyLoss, validateOwnedCreateSpecimen, verifyReopenedCreatedCategory } from "./fixtures/admin-core-create-recovery-journeys.mjs";

const targetPath = "/admin/content/categories/new", sourcePath = "scripts/fixtures/admin-core-create-recovery-journeys.mjs";
const output = ".tmp-qa/core-final-closure"; mkdirSync(output, { recursive: true });
const driverSource = readFileSync("scripts/qa-admin-adoption-journeys.mjs", "utf8");
const driverAst = ts.createSourceFile("driver.mjs", driverSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let guardSource;
for (const node of driverAst.statements) if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations)
  if (declaration.name.getText(driverAst) === "ownedNetworkOnly") guardSource = declaration.initializer.getText(driverAst);
assert.ok(guardSource, "Controls must execute the current context-wide guard.");
const action = "a".repeat(40), raw = Buffer.from('0=["synthetic-private-request-marker"]', "utf8");
const checks = [];
function specimen(patch = {}) {
  const headers = { origin: "http://127.0.0.1:31001", "next-action": action, "content-type": "text/plain;charset=UTF-8", cookie: "synthetic=private", ...patch.headers };
  return { url: () => patch.url ?? "http://127.0.0.1:31001" + targetPath, method: () => patch.method ?? "POST",
    allHeaders: async () => headers, postDataBuffer: () => patch.body === undefined ? raw : patch.body };
}
for (const [kind, patch] of [
  ["valid", {}], ["foreign-port", { url: "http://127.0.0.1:31002" + targetPath }],
  ["foreign-host", { url: "http://example.invalid" + targetPath }], ["different-path", { url: "http://127.0.0.1:31001/admin/content/categories/1" }],
  ["query-drift", { url: "http://127.0.0.1:31001" + targetPath + "?unexpected=1" }], ["wrong-method", { method: "GET" }],
  ["missing-origin", { headers: { origin: undefined } }], ["foreign-origin", { headers: { origin: "https://example.invalid" } }],
  ["wrong-host-header", { headers: { host: "example.invalid" } }], ["bad-action", { headers: { "next-action": "not-current-action" } }],
  ["bad-content-type", { headers: { "content-type": "application/json" } }], ["empty-body", { body: Buffer.alloc(0) }],
  ["wrong-length", { headers: { "content-length": "1" } }], ["chunked-input", { headers: { "transfer-encoding": "chunked" } }],
  ["proxy-header", { headers: { "proxy-authorization": "never-forward" } }],
]) {
  if (kind === "valid") {
    const value = await validateOwnedCreateSpecimen(specimen(patch), "http://127.0.0.1:31001");
    assert.ok(value.body.equals(raw)); assert.equal(value.headers.cookie, "synthetic=private");
    assert.equal(value.hostname, "127.0.0.1"); assert.equal(value.port, 31001); value.body.fill(0);
  } else await assert.rejects(() => validateOwnedCreateSpecimen(specimen(patch), "http://127.0.0.1:31001"),
    error => error.name === "CreateReplyLossVerificationError" && !error.message.includes("synthetic-private"));
  checks.push({ case: "request-" + kind, status: "pass" });
}

const actual = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const kind of ["unfinished-flight-body", "complete-flight-body", "redirect-refused", "action-redirect-refused",
    "non-flight-refused", "http500-refused", "native-failure", "native-missing-row", "native-unattributed-audit",
    "native-timeout", "headers-timeout", "duplicate-original-post"]) {
    let server, context, foreign, foreignRequests = 0, requests = 0, writes = 0, audits = 0, bodyExact = false,
      cookieExact = false, actionExact = false, originExact = false, nativeCalls = 0, beforeLossObserved = false,
      originalForwardClosed = false, guardCalls = 0;
    const sockets = new Set(), foreignSockets = new Set();
    try {
      foreign = createServer((_request, response) => { foreignRequests++; response.end("should-never-follow"); });
      foreign.on("connection", socket => { foreignSockets.add(socket); socket.on("close", () => foreignSockets.delete(socket)); });
      foreign.listen(0, "127.0.0.1"); await once(foreign, "listening");
      const foreignOrigin = "http://127.0.0.1:" + foreign.address().port;
      server = createServer((request, response) => {
        if (request.method === "POST" && request.url === targetPath) {
          requests++;
          const chunks = [];
          request.on("data", chunk => chunks.push(chunk));
          request.on("end", () => {
            const received = Buffer.concat(chunks);
            bodyExact = received.equals(raw); received.fill(0); for (const chunk of chunks) chunk.fill(0);
            cookieExact = request.headers.cookie === "synthetic=private";
            actionExact = request.headers["next-action"] === action;
            originExact = request.headers.origin === "http://127.0.0.1:" + server.address().port;
            request.socket.once("close", () => { originalForwardClosed = true; });
            if (writes > 0) {
              response.writeHead(200, { "content-type": "text/x-component" }); response.end("duplicate-rejected"); return;
            }
            writes++; audits++;
            if (kind === "headers-timeout") return;
            if (kind === "redirect-refused") { response.writeHead(307, { location: foreignOrigin + "/never" }); response.end(); return; }
            const headers = { "content-type": kind === "non-flight-refused" ? "text/html" : "text/x-component" };
            if (kind === "action-redirect-refused") headers["x-action-redirect"] = foreignOrigin + "/never;push";
            response.writeHead(kind === "http500-refused" ? 500 : 200, headers);
            response.flushHeaders();
            if (kind === "complete-flight-body") response.end('0:{"ack":"complete"}\n');
            // Every other 200 response deliberately keeps its Flight body open.
          });
          return;
        }
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end('<button id="save">Save</button><script>window.outcome="idle";window.fire=()=>{window.outcome="pending";return fetch(location.pathname,{method:"POST",headers:{"Next-Action":' +
          JSON.stringify(action) + ',"Content-Type":"text/plain;charset=UTF-8"},body:' + JSON.stringify(raw.toString()) +
          '}).then(()=>window.outcome="delivered",()=>window.outcome="failed");};document.querySelector("#save").onclick=()=>void window.fire();</script>');
      });
      server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
      server.listen(0, "127.0.0.1"); await once(server, "listening");
      const origin = "http://127.0.0.1:" + server.address().port;
      context = await browser.newContext();
      await context.addCookies([{ name: "synthetic", value: "private", url: origin, httpOnly: true }]);
      const page = await context.newPage(); page.setDefaultTimeout(3000);
      const actualGuard = vm.runInNewContext(guardSource, { origin, allowedStorage: [], coreClosure: true,
        activeCase: "category-create-committed-reply-loss-identical-input-retry", expectedLogoutDestination: null, expectedBlockedRequests: [], externalRequests: [], URL });
      await context.route("**/*", route => { guardCalls++; return actualGuard(route); });
      await page.goto(origin + targetPath);
      const nativeProbe = async signal => {
        nativeCalls++;
        assert.equal(writes, 1); assert.equal(audits, 1);
        assert.equal(await page.evaluate(() => window.outcome), "pending");
        beforeLossObserved = true;
        if (kind === "native-failure") throw Error("synthetic-private-request-marker must never become artifact text");
        if (kind === "native-timeout") await new Promise((_, reject) => signal.addEventListener("abort", () => reject(Error("cancelled")), { once: true }));
        if (kind === "duplicate-original-post") {
          await page.evaluate(() => { void window.fire(); });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return { status: "pass", id: "native-control", rows: kind === "native-missing-row" ? [] : [{ id: 41 }],
          audit: [{ id: 72, entity_id: 41, action: "topic_category.create", actor_admin_user_id: kind === "native-unattributed-audit" ? null : 7 }] };
      };
      const invoke = () => captureCommittedCreateReplyLoss({ page, origin, nativeProbe, trigger: () => page.locator("#save").click(),
        timeoutMs: ["native-timeout", "headers-timeout"].includes(kind) ? 1200 : 5000 });
      const shouldPass = ["unfinished-flight-body", "complete-flight-body"].includes(kind);
      let result, errorCode = null;
      if (shouldPass) {
        result = await invoke();
        assert.equal(result.statistics.matchedRequests, 1); assert.equal(result.statistics.forwardedRequests, 1);
        for (const key of ["headersObserved", "nativeCommitConfirmed", "browserResponseAborted", "originalSocketClosed", "requestBodyWiped"])
          assert.equal(result.statistics[key], true);
        await expect.poll(() => page.evaluate(() => window.outcome)).toBe("failed");
        assert.equal(requests, 1);
        // Intentional same authored identity retry occurs only after collector cleanup.
        const retry = await page.evaluate(async () => {
          const response = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": "a".repeat(40), "Content-Type": "text/plain;charset=UTF-8" },
            body: '0=["synthetic-private-request-marker"]' });
          return response.text();
        });
        assert.equal(retry, "duplicate-rejected"); assert.equal(requests, 2); assert.equal(writes, 1); assert.equal(audits, 1);
      } else {
        await assert.rejects(invoke, error => {
          errorCode = error.code;
          return error.name === "CreateReplyLossVerificationError" && typeof errorCode === "string"
            && !error.message.includes("synthetic-private") && !error.message.includes("Cookie");
        });
        assert.equal(requests, 1, "There is never an automatic or duplicate forward.");
      }
      assert.equal(foreignRequests, 0, "Node forwarding must never follow redirects.");
      assert.equal(bodyExact && cookieExact && actionExact && originExact, true, "The exact authenticated original request must reach only its owned authority.");
      await expect.poll(() => originalForwardClosed).toBe(true);
      await page.goto(origin + targetPath); // Current context guard still owns future requests after unroute.
      assert.ok(guardCalls >= 2);
      if (["redirect-refused", "action-redirect-refused", "non-flight-refused", "http500-refused", "headers-timeout"].includes(kind)) assert.equal(nativeCalls, 0);
      actual.push({ case: kind, status: "pass", originalForwardCount: 1, intentionalRetryCount: shouldPass ? 1 : 0,
        durableWrites: writes, durableAudits: audits, nativeCalls, beforeLossObserved, errorCode,
        exactOriginalBytesAndAuthenticatedHeaders: true, foreignRequests, originalForwardClosed, currentContextGuardRetained: true });
    } finally {
      await context?.close();
      for (const socket of sockets) socket.destroy(); for (const socket of foreignSockets) socket.destroy();
      if (server) await new Promise(resolve => server.close(resolve));
      if (foreign) await new Promise(resolve => foreign.close(resolve));
    }
  }
} finally { await browser?.close(); raw.fill(0); }

async function runReopenedCategoryIdentityControls() {
const root=process.cwd();
const require=createRequire(import.meta.url),checks=[];
const compile=(file,ports)=>{
 const compiledModule={exports:{}};const source=readFileSync(resolve(root,file),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext('(function(require,module,exports){'+output+'\n})',{console})((name)=>name in ports?ports[name]:require(name),compiledModule,compiledModule.exports);return compiledModule.exports.default;
};
const box=({children})=>React.createElement('div',null,children);
const slug=compile('src/components/admin/ui/AdminSlugField.tsx',{
 '../../../lib/admin/slug':{normalizeSlugInput:v=>v,slugifyFromTitle:v=>v},
 '../VenesiaModal':{adminFormFieldClassName:()=>'',adminFormHintClassName:()=>'',adminFormLabelClassName:()=>''},
});
const category=compile('src/app/admin/content/categories/CategoryForm.tsx',{
 '../../../../components/admin/content/CategoryColorPicker':{default:()=>null,__esModule:true},
 '../../../../components/admin/ui':{AdminFormField:box,AdminFormSection:box,AdminSlugField:slug,ADMIN_FORM_STACK_CLASS_NAME:'',adminFormFieldClassName:()=>''},
 '../../../../components/admin/ui/AdminFormListboxSelect':{default:()=>null,__esModule:true},
 '../../../../components/admin/ui/AdminFormRuntime':{__esModule:true,default:({children,formId,mode})=>React.createElement('form',{id:formId,'data-admin-form-runtime':'','data-admin-form-mode':mode},children({fieldErrors:{},pending:false})),AdminFormActions:()=>null,AdminFormError:()=>null,AdminFormGrid:box,AdminFormGridItem:box},
 '../../../../components/admin/ui/AdminFormSwitch':{__esModule:true,default:()=>null},
 '../taxonomy-form-actions':{createCategoryForm:()=>{},updateCategoryForm:()=>{}},
 '../TaxonomyExpectedRevisionInput':{__esModule:true,default:()=>null},
});
const id=41,name='Owned reopened category',slugValue='qa-core-create-owned';
const categoryRow={id,name,slug:slugValue,status:'draft',parent_id:null,color_token:null,updated_at:'2026-09-26T00:00:00Z'};
const html=mode=>renderToStaticMarkup(React.createElement(category,{mode,category:mode==='edit'?categoryRow:null,parentOptions:[]}));
const actualEditHtml=html('edit'),actualCreateHtml=html('create');
assert.ok(!actualEditHtml.includes('name="slug"'));assert.ok(actualEditHtml.includes('name="id"'));assert.ok(actualCreateHtml.includes('name="slug"'));
checks.push({case:'actual-CategoryForm-mode-contract',status:'pass',boundary:'Current CategoryForm and AdminSlugField rendered; only shared layout/runtime and Actions are controlled ports.'});
const original={id:'native-before',rows:[{id,name,slug:slugValue,status:'draft'}],audit:[{id:8,entity_id:id,action:'topic_category.create',actor_admin_user_id:7}]};
let served=actualEditHtml,server,browser;
try{
 server=createServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end('<!doctype html><body>'+served+'</body>');});server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
 const page=await context.newPage();let nativeCalls=0;
 for(const kind of ['valid-edit','create-mode','missing-form','wrong-id','wrong-name','mutable-slug','wrong-route','native-row-changed','native-audit-changed']){
  served=kind==='create-mode'?actualCreateHtml:kind==='missing-form'?'<div>missing</div>':actualEditHtml;
  if(kind==='wrong-id')served=served.replace('value="41"','value="42"');
  if(kind==='wrong-name')served=served.replace('value="Owned reopened category"','value="Another category"');
  if(kind==='mutable-slug')served=served.replace('</form>','<input name="slug" value="'+slugValue+'"></form>');
  await page.goto(origin+'/admin/content/categories/'+(kind==='wrong-route'?42:id));
  const beforeCalls=nativeCalls;
  const nativeProbe=async()=>{nativeCalls++;const result=structuredClone(original);result.id='native-after-open';if(kind==='native-row-changed')result.rows[0].slug='another-slug';if(kind==='native-audit-changed')result.audit.push({...result.audit[0],id:9});return result;};
  const execute=()=>verifyReopenedCreatedCategory({page,origin,id,name,slug:slugValue,nativeProbe,expectedNative:original});
  if(kind==='valid-edit'){const result=await execute();assert.equal(result.id,'native-after-open');}
  else await assert.rejects(execute);
  assert.equal(nativeCalls-beforeCalls,['valid-edit','native-row-changed','native-audit-changed'].includes(kind)?1:0);
  checks.push({case:kind,status:'pass',expected:kind==='valid-edit'?'accepted':'rejected'});
 }
 await context.close();
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}

return checks;
}
const reopenedIdentityControls = await runReopenedCategoryIdentityControls();

const receipt = { status: "pass", sourceSha256: createHash("sha256").update(readFileSync(sourcePath)).digest("hex"),
  currentGuardSha256: createHash("sha256").update(guardSource).digest("hex"), requestControls: checks,
  actualInstalledChromiumControls: actual, reopenedIdentityControls, count: checks.length + actual.length + reopenedIdentityControls.length,
  cleanup: { browserClosed: true, localServersAndSocketsClosed: true, noRequestBodyOrCookieArtifacts: true },
  boundary: "Actual collector and current context guard against loopback HTTP/Chromium controls. Native checkpoints here are controlled ports over fixture counters, not Product DB evidence. Current-build Category Browser/native joined proof remains pending." };
writeFileSync(output + "/create-recovery-protocol-controls.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ status: receipt.status, count: receipt.count, sourceSha256: receipt.sourceSha256 }));
