import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/remaining-system-proof/projects-browser");
const widthArgument = process.argv.find(argument => argument.startsWith("--width="));
const widths = widthArgument ? [Number(widthArgument.slice("--width=".length))] : [1280, 390];
assert.ok(widths.every(width => width === 1280 || width === 390), "Supported proof viewports are 1280 and 390 pixels");
await mkdir(out, { recursive: true });
await writeFile(path.join(out, "entry.tsx"), String.raw`
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';
import Location from '@src/app/admin/projects/locations/ProjectLocationFormModal';
import {TrackingStageFormModal} from '@src/components/admin/projects/tracking/TrackingForms';
import Project from '@src/app/admin/projects/ProjectEditForm';
import {createEmptyProjectEntry} from '@src/lib/admin/projects/project-entry-contract';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
window.calls=0; window.saved=0; window.proofClosed=0; window.payloads=[];
window.action=async(previous,data)=>{window.calls++;window.payloads.push([...data.entries()]);return new Promise(resolve=>window.finish=()=>resolve({status:'warning',mode:'create',revision:previous.revision+1,title:'تم الحفظ — يلزم التحقق من النتيجة',message:'حدّث القائمة للتحقق ولا تعِد العملية.',code:'saved_requires_reconciliation_reload'}));};
const root=createRoot(document.getElementById('root'));
function Fixture({kind}) {const [open,setOpen]=useState(true);const props={open,onClose:()=>{window.proofClosed++;setOpen(false);},onSaved:()=>{window.saved++;}};return <>{kind==='project'?<Project bundle={createEmptyProjectEntry('residential')}/>:kind==='location'?<Location {...props} mode="create" level="governorate" parentOptions={[]}/>:<TrackingStageFormModal {...props} projectId={1}/>}</>;}
const client=new QueryClient();window.mount=kind=>{window.calls=0;window.saved=0;window.proofClosed=0;window.payloads=[];window.proofNavigations=[];root.render(<QueryClientProvider client={client}><AdminFeedbackProvider><Fixture key={kind} kind={kind}/></AdminFeedbackProvider></QueryClientProvider>);};
`);
await writeFile(path.join(out, "navigation.ts"), `export { unstable_rethrow } from 'next/dist/client/components/unstable-rethrow.browser'; const router={push(href){window.proofNavigations.push(href);history.pushState({},'',href);},replace(href){window.proofNavigations.push(href);history.replaceState({},'',href);},refresh(){}};export const useRouter=()=>router;export const usePathname=()=>'/fixture';export const useSearchParams=()=>new URLSearchParams();`);
await writeFile(path.join(out, "link.tsx"), `import React from 'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>;}`);
await writeFile(path.join(out, "image.tsx"), `import React from 'react';export default function Image({fill,priority,unoptimized,quality,loader,...props}){return <img {...props}/>;}`);
await writeFile(path.join(out, "actions.ts"), `const run=(...args)=>window.action(...args);export const saveProjectEntry=run,createProjectLocationAction=run,updateProjectLocationAction=run,createTrackingItemAction=run,createTrackingStageAction=run,createTrackingUpdateAction=run,saveTrackingProfileAction=run,updateTrackingItemAction=run,updateTrackingStageAction=run,updateTrackingUpdateAction=run;`);
await writeFile(path.join(out, "links.ts"), "export const browseAdminLinksAjax=async()=>[],browseMenusPickerAjax=async()=>[],browseMenuItemsPickerAjax=async()=>[],browseTopicCategoriesPickerAjax=async()=>[],resolveAdminLinkAjax=async()=>[];");
const { loadBindings } = require("next/dist/build/swc");
await loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({ mode: "development", target: "web", context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "fixture.js" }, devtool: false,
  plugins: [new webpack.NormalModuleReplacementPlugin(/(actions|tracking-actions|save-entry|\/ui)$/, resource => {
    const full = path.resolve(resource.context, resource.request).replaceAll("\\", "/");
    if (full.endsWith("/components/admin/ui")) resource.request = path.join(root, "src/components/admin/ui/index.ts");
    else if (full.endsWith("/lib/admin/links/actions")) resource.request = path.join(out, "links.ts");
    else if (/src\/app\/admin\/projects\/(locations\/actions|tracking-actions|project-actions\/save-entry)$/.test(full)) resource.request = path.join(out, "actions.ts");
  }), new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias: { "@src": path.join(root, "src"), "next/navigation": path.join(out, "navigation.ts"), "next/link": path.join(out, "link.tsx"), "next/image": path.join(out, "image.tsx") } },
  module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{ loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: { rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {}, swcCacheDir: path.join(out, "swc-cache"), serverComponents: false, serverReferenceHashSalt: "remaining-project-proof", esm: false, transpilePackages: [] } }] }] },
});
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => error || closeError || stats?.hasErrors() ? reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors))) : resolve())));
const bundle = await readFile(path.join(out, "fixture.js"));
const server = createServer((request, response) => { if (request.url === "/fixture.js") { response.setHeader("content-type", "application/javascript"); response.end(bundle); return; } response.setHeader("content-type", "text/html"); response.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{font-family:Arial;background:#111;color:white}input,button{margin:8px;padding:8px}[role=dialog]{position:fixed;inset:10%;background:#222;overflow:auto}</style><div id="root"></div><script src="/fixture.js"></script></html>'); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true });
  for (const { width, kind } of widths.flatMap(width => ["location", "tracking", "project"].map(kind => ({ width, kind })))) {
    const viewport = { width, height: 900 };
    const context = await browser.newContext({ viewport });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => typeof window.mount === "function").catch(error => { throw new Error(`${error.message}; browser errors: ${JSON.stringify(errors)}`); });
    await page.evaluate(kind => window.mount(kind), kind);
    if (kind === "project") {
      await page.locator("form").waitFor();
      await page.locator("form").evaluate(element => { element.noValidate = true; element.requestSubmit(); });
      await page.waitForFunction(() => window.calls === 1);
      await page.evaluate(() => window.finish());
      await page.waitForFunction(() => window.proofNavigations.length === 1);
      assert.deepEqual(await page.evaluate(() => window.proofNavigations), ["/admin/projects/residential"]);
      assert.equal(await page.getByRole("alertdialog").count(), 0);
      assert.equal(await page.evaluate(() => window.calls), 1);
      assert.deepEqual(errors, []);
      results.push({ kind, viewport, status: "PASS", claims: ["actual Project form and Form Runtime", "committed warning without identity invokes existing close owner to known list", "no discard prompt or guessed edit link"] });
      console.log(`PASS project (${width}px): unknown saved identity closes through existing Form navigation owner`);
      await context.close();
      continue;
    }
    const input = page.locator(kind === "location" ? 'input[name="name_ar"]' : 'input[name="name"]');
    await input.fill("Submitted preserved draft");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.calls === 1);
    assert.equal(await input.isDisabled(), true);
    await page.locator('button[type="submit"]').evaluate(element => element.click());
    assert.equal(await page.evaluate(() => window.calls), 1);
    assert.ok(JSON.stringify(await page.evaluate(() => window.payloads)).includes("Submitted preserved draft"));
    await page.evaluate(() => window.finish());
    await page.waitForFunction(() => window.saved === 1 && window.proofClosed === 1).catch(async error => { throw new Error(`${error.message}; facts=${JSON.stringify(await page.evaluate(()=>({calls:window.calls,saved:window.saved,closed:window.proofClosed,body:document.body.innerText})))}, errors=${JSON.stringify(errors)}`); });
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.evaluate(() => window.calls), 1);
    assert.equal(await page.locator("[data-admin-feedback-entry]").count(), 1);
    assert.deepEqual(errors, []);
    results.push({ kind, viewport, status: "PASS", claims: ["actual modal and Form/Feedback owners", "pending preserves submitted values and blocks duplicate button submit", "warning without result closes once and triggers existing list invalidation callback once", "one warning"] });
    console.log(`PASS ${kind} (${width}px): committed warning without result completes once through existing Form owner`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, widthArgument ? `results-${widths[0]}.json` : "results.json"), JSON.stringify({ results, limits: "Mounted real components; deferred Action and Next navigation ports isolated. Separate verifier proves actual Actions/SQL. No authenticated HTTP, full page, live DB or production claim." }, null, 2));
}
