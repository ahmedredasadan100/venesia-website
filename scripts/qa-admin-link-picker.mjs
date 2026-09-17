import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const phase = process.argv.find((arg) => arg.startsWith("--phase="))?.slice(8) ?? "verify";
assert.ok(["before", "after", "verify", "verify-continuation", "journey-before", "journey-after", "journey-contract"].includes(phase));
const journey = phase.startsWith("journey-");
const verifying = phase === "verify" || phase === "verify-continuation";
const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice(9);
if (runId !== undefined) assert.match(runId, /^[a-z0-9-]+$/u);
const out = path.join(root, journey || phase === "verify-continuation" ? ".tmp-qa/admin-near-instant-continuation-2026-09-17/link-picker" : ".tmp-qa/admin-near-instant-2026-09-17/link-picker", phase, ...(runId ? [runId] : []));
await mkdir(out, { recursive: true });
const sourcePath = "src/components/admin/ui/AdminLinkPicker.tsx";
const source = await readFile(path.join(root, sourcePath), "utf8");
const sourceSha256 = createHash("sha256").update(source).digest("hex");
if (phase === "before") await writeFile(path.join(out, "source.txt"), source, { flag: "wx" });
await writeFile(path.join(out, "entry.tsx"), String.raw`
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Picker from '@src/components/admin/ui/AdminLinkPicker';
import Field from '@src/components/admin/ui/AdminLinkField';
window.qa={calls:[],resolves:[],delay:40,deferred:false,selected:null,actionAt:0,errors:[]};
document.addEventListener('click',event=>{if(event.target.closest('button'))window.qa.actionAt=performance.now()},true);
function Fixture(){const [open,setOpen]=useState(false);const [,setRender]=useState(0);window.qa.rerender=()=>setRender(n=>n+1);return window.location.search.includes('journey') ? <form><Field prefix="destination" label="Destination" defaultValue={window.location.search.includes('anchored')?{link_kind:'internal',linked_type:'pages',linked_id:43,anchor:'existing',target:'_self'}:undefined}/></form> : <><button onClick={()=>setOpen(true)}>Open picker</button><Picker open={open} initialValue={window.location.search.includes('parent')?{link_kind:'external',href:'https://initial.example',target:'_blank'}:undefined} onClose={()=>setOpen(false)} onSelect={value=>window.qa.selected=value}/></>}
createRoot(document.getElementById('root')).render(<Fixture/>);
`);
await writeFile(path.join(out, "actions.ts"), String.raw`
function row(type,query=''){return {id:type+':42',resourceId:42,resourceType:type,title:type+':'+(query||'ready'),publicPath:'/'+type+'/42',subtitle:'Isolated result',status:'published'}}
async function request(type,query='',shape='results'){
 const call={type,query,start:performance.now(),end:null};window.qa.calls.push(call);
 const result={ok:true,[shape]:[row(type,query)]};
 if(window.qa.deferred)return new Promise((resolve,reject)=>{call.finish=(value=result)=>{call.end=performance.now();resolve(value)};call.fail=()=>{call.end=performance.now();reject(new Error('isolated request rejected'))}});
 await new Promise(resolve=>setTimeout(resolve,window.qa.delay));call.end=performance.now();return result;
}
export const browseAdminLinksAjax=({type,query})=>request(type,query);
export const browseTopicCategoriesPickerAjax=({query})=>request('topic_categories',query,'items');
export const browseMenusPickerAjax=()=>request('menus','','menus');
export const browseMenuItemsPickerAjax=({query})=>request('menu_items',query,'items');
export const resolveAdminLinkAjax=async link=>{const call={link,start:performance.now(),end:null};window.qa.resolves.push(call);if(window.qa.previewDeferred)await new Promise((resolve,reject)=>{call.finish=resolve;call.fail=()=>reject(new Error('isolated preview failure'))});else await new Promise(resolve=>setTimeout(resolve,window.qa.delay));call.end=performance.now();return {ok:true,display:{kind:link.link_kind,kindLabel:'Isolated resource',title:window.qa.previewIdentity?'Preview '+(link.linked_type||link.href):'Isolated preview',publicPath:(link.href||'/'+link.linked_type+'/'+(link.linked_id||42))+(link.anchor?'#'+link.anchor:''),target:'_self'}}};
`);
await writeFile(path.join(out, "media.tsx"), "export const AdminMediaPickerModal=()=>null;\n");
await writeFile(path.join(out, "navigation.ts"), "export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';\n");
await writeFile(path.join(out, "link.tsx"), "export default function Link(props){return <a {...props}/>;}\n");
await require("next/dist/build/swc").loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({
  mode: "development", target: "web", context: root,
  entry: path.join(out, "entry.tsx"), output: {path: out, filename: "fixture.js"}, devtool: false,
  plugins: [new webpack.DefinePlugin({"process.env.NODE_ENV": JSON.stringify("development")})],
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias: {
    "@src": path.join(root, "src"),
    "../../../lib/admin/links/actions$": path.join(out, "actions.ts"),
    "../media$": path.join(out, "media.tsx"),
    "next/navigation$": path.join(out, "navigation.ts"),
    "next/link$": path.join(out, "link.tsx"),
  } },
  module: {rules: [{test:/\.[jt]sx?$/,exclude:/node_modules/,use:[{
    loader:require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options:{
      rootDir:root,isServer:false,compilerType:"client",hasReactRefresh:false,nextConfig:{},jsConfig:{},
      swcCacheDir:path.join(out,"swc-cache"),serverComponents:false,serverReferenceHashSalt:"isolated-link-picker-qa",esm:false,transpilePackages:[],
    },
  }]}]},
});
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close((closeError) => {
  if(error || closeError || stats?.hasErrors()) reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors)));
  else resolve();
})));
const bundle = await readFile(path.join(out, "fixture.js"));
const server = createServer((request, response) => {
  if(request.url === "/fixture.js") {response.setHeader("content-type","application/javascript");response.end(bundle);return;}
  response.setHeader("content-type","text/html; charset=utf-8");
  response.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{font:16px Arial}button,input{padding:8px;margin:3px} [role=dialog]{position:fixed;inset:5%;overflow:auto;background:white}button{cursor:pointer}</style><div id="root"></div><script src="/fixture.js"></script></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
const samples = [];
const assertions = [];
try {
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.qaTimers = [];
    const nativeTimer = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      window.qaTimers.push(delay);
      return nativeTimer(callback, delay, ...args);
    };
  });
  await page.route("**/*", route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
  async function reset(deferred=false) {
    await page.goto(url);
    await page.getByRole("button",{name:"Open picker",exact:true}).waitFor().catch(error=>{
      throw new Error(`Picker harness did not mount: ${JSON.stringify(errors)}`, {cause:error});
    });
    await page.evaluate(value=>{window.qa.deferred=value},deferred);
  }
  async function waitForCall(type, query="") {
    await page.waitForFunction(({type,query})=>window.qa.calls.some(call=>call.type===type&&call.query===query),{type,query});
  }
  async function resolveCall(type, query="") {
    await page.evaluate(({type,query})=>window.qa.calls.find(call=>call.type===type&&call.query===query).finish(),{type,query});
  }
  async function measure(kind, button, resultType) {
    await button.click();
    await page.getByRole("button",{name:new RegExp(`${resultType}:ready`)}).waitFor();
    assert.equal(await page.getByRole("button",{name:new RegExp(`${resultType}:ready`)}).isEnabled(),true);
    const sample=await page.evaluate(type=>new Promise(resolve=>requestAnimationFrame(()=>{
      const call=window.qa.calls.findLast(call=>call.type===type);
      resolve({actionToUsableMs:performance.now()-window.qa.actionAt,actionToDispatchMs:call.start-window.qa.actionAt,transportMs:call.end-call.start,readCalls:window.qa.calls.filter(call=>call.start>=window.qa.actionAt).length});
    })),resultType);
    samples.push({kind,...sample});
  }
  if (journey) {
    for (let i = 0; i < (phase === "journey-contract" ? 1 : 5); i++) {
      await page.goto(`${url}?journey`);
      const choose = page.getByRole("button", { name: "اختيار الرابط", exact: true });
      await choose.waitFor().catch(async error => {
        await writeFile(path.join(out, "setup-failure.json"), JSON.stringify({errors, body: await page.locator("body").innerText()}, null, 2));
        throw error;
      });
      await choose.click();
      await page.getByRole("button", { name: /pages:ready/ }).waitFor();
      const openAt = await page.evaluate(() => window.qa.actionAt);
      await page.getByRole("button", { name: /pages:ready/ }).click();
      await page.getByText("Isolated preview", { exact: true }).waitFor();
      await page.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByText("Isolated preview", { exact: true }).waitFor();
      assert.equal(await page.locator('input[name="destination_linked_id"]').inputValue(), "42");
      assert.equal(await choose.isEnabled(), true);
      const sample = await page.evaluate(openAt => new Promise(resolve => requestAnimationFrame(() => resolve({
        kind: "field-open-select-apply", sample: window.qa.resolves.length,
        confirmToCorrectFieldMs: performance.now() - window.qa.actionAt,
        scriptedOpenToCorrectFieldMs: performance.now() - openAt,
        browseCalls: window.qa.calls.length, resolveCalls: window.qa.resolves.length,
        selectedId: document.querySelector('input[name="destination_linked_id"]').value,
        visibility: document.visibilityState,
      }))), openAt);
      samples.push(sample);
    }
    if (phase !== "journey-before") {
      assert.ok(samples.every(sample => sample.resolveCalls === 1), "Exact picker preview must be reused by its caller");
      await page.goto(`${url}?journey`);
      await page.getByRole("button", { name: "اختيار الرابط", exact: true }).waitFor();
      await page.evaluate(() => { window.qa.previewDeferred = true; window.qa.previewIdentity = true; });
      await page.getByRole("button", { name: "اختيار الرابط", exact: true }).click();
      await page.getByRole("button", { name: /pages:ready/ }).click();
      await page.waitForFunction(() => window.qa.resolves.length === 1);
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await page.getByRole("button", { name: /projects:ready/ }).click();
      await page.waitForFunction(() => window.qa.resolves.length === 2);
      await page.evaluate(() => window.qa.resolves[1].finish());
      await page.getByText("Preview projects", { exact: true }).waitFor();
      await page.evaluate(() => window.qa.resolves[0].finish());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByText("Preview pages", { exact: true }).count(), 0);
      await page.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByText("Preview projects", { exact: true }).waitFor();
      assert.equal(await page.locator('input[name="destination_linked_type"]').inputValue(), "projects");
      assert.equal(await page.evaluate(() => window.qa.resolves.length), 2);
      assertions.push("Late preview cannot replace selection; exact current preview reaches caller without another read");
      await page.getByRole("button", { name: "مسح الرابط", exact: true }).click();
      assert.equal(await page.locator('input[name="destination_link_kind"]').inputValue(), "none");
      assert.equal(await page.getByText("Preview projects", { exact: true }).count(), 0);
      assertions.push("Clear removes the resolved presentation and serialized identity together");
      await page.goto(`${url}?journey&anchored`);
      await page.getByText("Isolated preview", { exact: true }).waitFor();
      await page.getByRole("button", { name: "اختيار الرابط", exact: true }).click();
      await page.getByRole("button", { name: /pages:ready/ }).click();
      await page.getByRole("dialog").getByText("Isolated preview", { exact: true }).waitFor();
      await page.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByText("/pages/42#existing", { exact: true }).waitFor();
      assert.equal(await page.locator('input[name="destination_link_anchor"]').inputValue(), "existing");
      assert.equal(await page.evaluate(() => window.qa.resolves.length), 3);
      assertions.push("Caller-owned anchor mismatch forces fresh canonical resolution");
      await page.goto(`${url}?parent`);
      await page.getByRole("button", { name: "Open picker", exact: true }).waitFor();
      await page.evaluate(() => { window.qa.previewIdentity = true; });
      await page.getByRole("button", { name: "Open picker", exact: true }).click();
      await page.getByText("Preview https://initial.example", { exact: true }).waitFor();
      await page.getByRole("textbox").fill("https://draft.example");
      await page.getByText("Preview https://draft.example", { exact: true }).waitFor();
      const resolvedCount = await page.evaluate(() => window.qa.resolves.length);
      await page.evaluate(() => window.qa.rerender());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByText("Preview https://draft.example", { exact: true }).isVisible(), true);
      assert.equal(await page.evaluate(() => window.qa.resolves.length), resolvedCount);
      assertions.push("Equivalent fresh initialValue objects cannot reset an edited preview or issue another read");
    }
    assert.deepEqual(errors, []);
    const files = [sourcePath, "src/components/admin/ui/AdminLinkField.tsx", "src/components/admin/VenesiaModal.tsx"];
    const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await readFile(path.join(root, file))).digest("hex")])));
    await writeFile(path.join(out, "result.json"), JSON.stringify({phase, hashes, samples, assertions, kind: "Actual shared Field→Picker→resolved preview→apply→correct serialized caller field, production transport excluded; scripted whole journey includes automation waits"}, null, 2));
    console.log(JSON.stringify({phase, samples}));
  } else {
  if(!verifying) {
    for(let i=0;i<5;i++) {
      await reset();
      await measure("open",page.getByRole("button",{name:"Open picker",exact:true}),"pages");
      await measure("resource",page.getByRole("button",{name:"Projects",exact:true}),"projects");
    }
    await writeFile(path.join(out,"timing-samples.json"),JSON.stringify({sourceSha256,samples},null,2));
  }
  await reset(true);
  await page.getByRole("button",{name:"Open picker",exact:true}).click();
  await waitForCall("pages");
  await page.getByRole("button",{name:"Projects",exact:true}).click();
  await waitForCall("projects");
  await resolveCall("projects");
  await page.getByRole("button",{name:/projects:ready/}).waitFor();
  await resolveCall("pages");
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const wrongLateResult=await page.getByRole("button",{name:/pages:ready/}).count();
  if(phase !== "before") {
    assert.equal(wrongLateResult,0,"Late previous resource cannot replace current usable results");
    assert.equal(await page.getByRole("button",{name:/projects:ready/}).count(),1);
    assertions.push("obsolete resource response cannot replace current target");
    assert.equal(await page.evaluate(()=>window.qaTimers.includes(220)),false,"Open/resource transitions must not incur the search debounce");
    assertions.push("open and resource dispatch do not schedule the search timer");
    for (const resource of ["External", "Anchor", "Download"]) {
      await reset(true);
      await page.getByRole("button",{name:"Open picker",exact:true}).click();
      await waitForCall("pages");
      await page.getByRole("button",{name:resource,exact:true}).click();
      const localControl=resource === "External" ? page.getByRole("button",{name:"https",exact:true})
        : resource === "Anchor" ? page.getByPlaceholder("section-id")
        : page.getByRole("button",{name:"اختر من المكتبة",exact:true});
      await localControl.waitFor();
      assert.equal(await localControl.isEnabled(),true);
      await resolveCall("pages");
      assert.equal(await localControl.isVisible(),true);
    }
    assertions.push("local link forms become usable while obsolete browse remains pending");
    await reset(true);
    await page.getByRole("button",{name:"Open picker",exact:true}).click();
    await waitForCall("pages");
    await resolveCall("pages");
    await page.getByRole("button",{name:/pages:ready/}).waitFor();
    await page.getByRole("textbox").fill("first");
    await waitForCall("pages","first");
    await page.getByRole("textbox").fill("last");
    await waitForCall("pages","last");
    await resolveCall("pages","last");
    await page.getByRole("button",{name:/pages:last/}).waitFor();
    await resolveCall("pages","first");
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.getByRole("button",{name:/pages:first/}).count(),0);
    assert.equal(await page.getByRole("button",{name:/pages:last/}).count(),1);
    assert.equal(await page.evaluate(()=>window.qaTimers.includes(220)),true);
    assertions.push("typing retains bounded debounce and late search results cannot win");
    await reset(true);
    await page.getByRole("button",{name:"Open picker",exact:true}).click();
    await waitForCall("pages");
    await page.evaluate(()=>window.qa.calls[0].fail());
    await page.getByText("تعذر تحميل الموارد. أعد المحاولة.",{exact:true}).waitFor();
    assertions.push("transport rejection settles with recoverable feedback");
    await reset(true);
    await page.getByRole("button",{name:"Open picker",exact:true}).click();
    await waitForCall("pages");
    await page.getByRole("button",{name:"إلغاء",exact:true}).click();
    await resolveCall("pages");
    await page.getByRole("button",{name:"Open picker",exact:true}).click();
    await page.waitForFunction(()=>window.qa.calls.length===2);
    assert.equal(await page.getByRole("button",{name:/pages:ready/}).count(),0);
    await page.evaluate(()=>window.qa.calls[1].finish());
    await page.getByRole("button",{name:/pages:ready/}).waitFor();
    assertions.push("closed picker read cannot populate a new opening");
    await page.getByRole("button",{name:/pages:ready/}).click();
    await page.getByText("Isolated preview",{exact:true}).waitFor();
    await page.getByRole("button",{name:"اعتماد الرابط",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.qa.selected?.linked_id),42);
    assertions.push("confirmed result retains canonical selected identity");
  }
  assert.deepEqual(errors,[]);
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const summary=Object.fromEntries(["open","resource"].map(kind=>{
    const values=samples.filter(sample=>sample.kind===kind).map(sample=>sample.actionToUsableMs);
    return [kind,values.length?{n:values.length,medianMs:median(values),minMs:Math.min(...values),maxMs:Math.max(...values)}:null];
  }));
  const result={phase,sourcePath,sourceSha256,kind:"mounted actual AdminLinkPicker and VenesiaModal; isolated 40ms actions; no Next/Auth/DB transport proof",samples,summary,wrongLateResult,assertions,externalRequestsAllowed:false};
  await writeFile(path.join(out,"result.json"),JSON.stringify(result,null,2));
  await page.screenshot({path:path.join(out,"result.png")});
  console.log(JSON.stringify({phase,sourceSha256,summary,wrongLateResult,assertions}));
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
